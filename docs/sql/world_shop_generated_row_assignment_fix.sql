-- World shop generated-row assignment fix
-- Allows DM assignment/sell directly from generated (unsaved) shop rows without persisted dm_shop_inventory.id.

create or replace function public.dm_assign_generated_shop_item(
  p_receiver_profile_id uuid,
  p_item_id uuid,
  p_quantity integer default 1,
  p_price_mode text default 'listed',
  p_listed_price_gp integer default 0,
  p_minimum_price_gp integer default 0,
  p_custom_price_gp integer default null,
  p_note text default null,
  p_source_context text default 'World shop generated row assignment'
)
returns table (
  receiver_profile_id uuid,
  item_name text,
  quantity_assigned integer,
  price_mode text,
  unit_gp_charged integer,
  total_gp_charged integer,
  receiver_gp_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(trim(coalesce(p_price_mode, 'listed')));
  v_qty integer := greatest(1, coalesce(p_quantity, 1));
  v_item_name text;
  v_unit integer;
  v_total integer;
  v_gp_after integer;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_source_context text := nullif(trim(coalesce(p_source_context, '')), '');
begin
  if not public.inventory_is_dm() then
    raise exception 'DM authorization required';
  end if;

  if p_receiver_profile_id is null then
    raise exception 'Receiver is required';
  end if;

  if p_item_id is null then
    raise exception 'Item is required';
  end if;

  if v_mode not in ('listed', 'minimum', 'custom') then
    raise exception 'Unsupported price mode';
  end if;

  select coalesce(im.name, 'Item')
  into v_item_name
  from public.item_master im
  where im.id = p_item_id;

  if v_item_name is null then
    raise exception 'Item not found in catalog';
  end if;

  if v_mode = 'listed' then
    v_unit := greatest(0, coalesce(p_listed_price_gp, 0));
  elsif v_mode = 'minimum' then
    v_unit := greatest(0, coalesce(p_minimum_price_gp, 0));
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
  values (p_receiver_profile_id, p_item_id, v_qty, v_note)
  on conflict (player_profile_id, item_master_id) where item_master_id is not null
  do update set
    quantity = public.player_inventory_items.quantity + excluded.quantity,
    notes = coalesce(excluded.notes, public.player_inventory_items.notes);

  perform public.inventory_log_event(
    p_receiver_profile_id,
    'dm',
    null,
    'dm_generated_shop_assignment',
    format(
      '%s: %s x%s at %s gp each (%s mode)%s',
      coalesce(v_source_context, 'World shop generated row assignment'),
      v_item_name,
      v_qty,
      v_unit,
      v_mode,
      case when v_note is not null then ' • ' || v_note else '' end
    )
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

revoke all on function public.dm_assign_generated_shop_item(uuid, uuid, integer, text, integer, integer, integer, text, text) from public;
grant execute on function public.dm_assign_generated_shop_item(uuid, uuid, integer, text, integer, integer, integer, text, text) to authenticated;
