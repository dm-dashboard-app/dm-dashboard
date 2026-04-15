-- Inventory rewards + shop assignment rebuild
-- Adds DM-only RPCs for currency rewards (single/all active split) and atomic shop->player assignment.

create or replace function public.dm_inventory_award_currency(
  p_encounter_id uuid default null,
  p_receiver_profile_id uuid default null,
  p_currency_type text default 'gp',
  p_amount integer default 0,
  p_award_all boolean default false,
  p_note text default null
)
returns table (
  receiver_profile_id uuid,
  amount_awarded integer,
  currency_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text := lower(trim(coalesce(p_currency_type, 'gp')));
  v_total integer := coalesce(p_amount, 0);
  v_count integer := 0;
  v_base integer := 0;
  v_remainder integer := 0;
  v_idx integer := 0;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  r record;
  v_award integer;
begin
  if not public.inventory_is_dm() then
    raise exception 'DM authorization required';
  end if;

  if v_currency not in ('pp', 'gp', 'sp', 'cp') then
    raise exception 'Unsupported currency type';
  end if;

  if v_total <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if p_award_all then
    if p_encounter_id is null then
      raise exception 'Encounter is required when awarding to all active players';
    end if;

    select count(*) into v_count
    from (
      select distinct ps.player_profile_id
      from public.player_sessions ps
      where ps.encounter_id = p_encounter_id
        and ps.player_profile_id is not null
    ) active_players;

    if v_count <= 0 then
      raise exception 'No active players found for encounter';
    end if;

    v_base := floor(v_total::numeric / v_count::numeric);
    v_remainder := mod(v_total, v_count);

    for r in
      select distinct ps.player_profile_id
      from public.player_sessions ps
      where ps.encounter_id = p_encounter_id
        and ps.player_profile_id is not null
      order by ps.player_profile_id asc
    loop
      v_idx := v_idx + 1;
      v_award := v_base + case when v_idx <= v_remainder then 1 else 0 end;

      perform public.inventory_ensure_currency_row(r.player_profile_id);

      execute format('update public.player_inventory_currency set %I = %I + $1 where player_profile_id = $2', v_currency, v_currency)
      using v_award, r.player_profile_id;

      perform public.inventory_log_event(
        r.player_profile_id,
        'dm',
        null,
        'dm_award_currency',
        format('DM awarded %s %s (all-active split from %s total; deterministic remainder by profile UUID order)%s',
          upper(v_currency),
          v_award,
          v_total,
          case when v_note is not null then ' • ' || v_note else '' end
        )
      );

      receiver_profile_id := r.player_profile_id;
      amount_awarded := v_award;
      currency_type := v_currency;
      return next;
    end loop;

    return;
  end if;

  if p_receiver_profile_id is null then
    raise exception 'Receiver is required for single-player currency award';
  end if;

  perform public.inventory_ensure_currency_row(p_receiver_profile_id);

  execute format('update public.player_inventory_currency set %I = %I + $1 where player_profile_id = $2', v_currency, v_currency)
  using v_total, p_receiver_profile_id;

  perform public.inventory_log_event(
    p_receiver_profile_id,
    'dm',
    null,
    'dm_award_currency',
    format('DM awarded %s %s%s', upper(v_currency), v_total, case when v_note is not null then ' • ' || v_note else '' end)
  );

  receiver_profile_id := p_receiver_profile_id;
  amount_awarded := v_total;
  currency_type := v_currency;
  return next;
end;
$$;

create or replace function public.dm_shop_assign_inventory_item(
  p_receiver_profile_id uuid,
  p_shop_inventory_id uuid,
  p_quantity integer default 1,
  p_price_mode text default 'listed',
  p_custom_price_gp integer default null,
  p_note text default null
)
returns table (
  receiver_profile_id uuid,
  item_name text,
  quantity_assigned integer,
  price_mode text,
  unit_gp_charged integer,
  total_gp_charged integer,
  receiver_gp_after integer,
  remaining_shop_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(trim(coalesce(p_price_mode, 'listed')));
  v_qty integer := greatest(1, coalesce(p_quantity, 1));
  v_row public.dm_shop_inventory%rowtype;
  v_item_name text;
  v_unit integer;
  v_total integer;
  v_gp_after integer;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.inventory_is_dm() then
    raise exception 'DM authorization required';
  end if;

  if p_receiver_profile_id is null then
    raise exception 'Receiver is required';
  end if;

  if p_shop_inventory_id is null then
    raise exception 'Shop inventory row is required';
  end if;

  select * into v_row
  from public.dm_shop_inventory
  where id = p_shop_inventory_id
  for update;

  if v_row.id is null then
    raise exception 'Shop item row not found';
  end if;

  if v_row.quantity < v_qty then
    raise exception 'Not enough stock in selected shop row';
  end if;

  if v_mode not in ('listed', 'minimum', 'custom') then
    raise exception 'Unsupported price mode';
  end if;

  if v_mode = 'listed' then
    v_unit := greatest(0, coalesce(v_row.listed_price_gp, 0));
  elsif v_mode = 'minimum' then
    v_unit := greatest(0, coalesce(v_row.minimum_price_gp, 0));
  else
    v_unit := greatest(0, coalesce(p_custom_price_gp, 0));
  end if;

  v_total := v_unit * v_qty;

  perform public.inventory_ensure_currency_row(p_receiver_profile_id);

  update public.player_inventory_currency
  set gp = gp - v_total
  where player_profile_id = p_receiver_profile_id
    and gp >= v_total
  returning gp into v_gp_after;

  if v_gp_after is null then
    raise exception 'Player does not have enough GP for this assignment';
  end if;

  insert into public.player_inventory_items (player_profile_id, item_master_id, quantity, notes)
  values (p_receiver_profile_id, v_row.item_id, v_qty, v_note)
  on conflict (player_profile_id, item_master_id)
  do update set
    quantity = public.player_inventory_items.quantity + excluded.quantity,
    notes = coalesce(excluded.notes, public.player_inventory_items.notes);

  update public.dm_shop_inventory
  set quantity = quantity - v_qty
  where id = v_row.id
  returning quantity into remaining_shop_quantity;

  select coalesce(im.name, 'Item') into v_item_name
  from public.item_master im
  where im.id = v_row.item_id;

  perform public.inventory_log_event(
    p_receiver_profile_id,
    'dm',
    null,
    'dm_shop_assignment',
    format('DM shop assignment: %s x%s at %s gp each (%s mode)%s', v_item_name, v_qty, v_unit, v_mode, case when v_note is not null then ' • ' || v_note else '' end)
  );

  receiver_profile_id := p_receiver_profile_id;
  item_name := v_item_name;
  quantity_assigned := v_qty;
  price_mode := v_mode;
  unit_gp_charged := v_unit;
  total_gp_charged := v_total;
  receiver_gp_after := v_gp_after;
  return next;
end;
$$;

revoke all on function public.dm_inventory_award_currency(uuid, uuid, text, integer, boolean, text) from public;
revoke all on function public.dm_shop_assign_inventory_item(uuid, uuid, integer, text, integer, text) from public;

grant execute on function public.dm_inventory_award_currency(uuid, uuid, text, integer, boolean, text) to authenticated;
grant execute on function public.dm_shop_assign_inventory_item(uuid, uuid, integer, text, integer, text) to authenticated;
