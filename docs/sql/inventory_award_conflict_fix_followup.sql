-- Follow-up hotfix: fix ON CONFLICT targets for partial unique index-backed inventory item merges.
-- Apply in Supabase SQL editor after inventory phase 1 + rewards/shop assignment SQL are already present.

create or replace function public.inventory_upsert_item(
  p_player_profile_id uuid,
  p_join_code text default null,
  p_item_master_id uuid default null,
  p_custom_name text default null,
  p_quantity integer default 1,
  p_notes text default null,
  p_item_row_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dm boolean := public.inventory_is_dm();
  v_actor_role text;
  v_actor_profile_id uuid := null;
  v_item_id uuid;
  v_normalized_custom_name text := nullif(trim(coalesce(p_custom_name, '')), '');
  v_resolved_name text;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  if v_is_dm then
    v_actor_role := 'dm';
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
    v_actor_role := 'player';
    v_actor_profile_id := p_player_profile_id;
  end if;

  if p_item_row_id is not null then
    update public.player_inventory_items
    set quantity = p_quantity,
        notes = nullif(trim(coalesce(p_notes, '')), '')
    where id = p_item_row_id
      and player_profile_id = p_player_profile_id
    returning id, coalesce((select name from public.item_master where id = item_master_id), custom_name)
    into v_item_id, v_resolved_name;

    if v_item_id is null then
      raise exception 'Inventory item not found';
    end if;
  else
    if p_item_master_id is null and v_normalized_custom_name is null then
      raise exception 'Either item_master_id or custom_name is required';
    end if;

    if p_item_master_id is not null then
      insert into public.player_inventory_items (player_profile_id, item_master_id, quantity, notes)
      values (p_player_profile_id, p_item_master_id, p_quantity, nullif(trim(coalesce(p_notes, '')), ''))
      on conflict (player_profile_id, item_master_id) where item_master_id is not null
      do update set
        quantity = public.player_inventory_items.quantity + excluded.quantity,
        notes = excluded.notes
      returning id, coalesce((select name from public.item_master where id = p_item_master_id), 'Item')
      into v_item_id, v_resolved_name;
    else
      insert into public.player_inventory_items (player_profile_id, custom_name, quantity, notes)
      values (p_player_profile_id, v_normalized_custom_name, p_quantity, nullif(trim(coalesce(p_notes, '')), ''))
      returning id, v_normalized_custom_name into v_item_id, v_resolved_name;
    end if;
  end if;

  perform public.inventory_log_event(
    p_player_profile_id,
    v_actor_role,
    v_actor_profile_id,
    'upsert_item',
    format('Item updated: %s x%s', coalesce(v_resolved_name, 'Item'), p_quantity),
    null,
    null,
    jsonb_build_object('item_id', v_item_id)
  );

  return v_item_id;
end;
$$;


create or replace function public.inventory_apply_transfer(p_transfer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.player_inventory_transfers%rowtype;
  v_sender_item public.player_inventory_items%rowtype;
  v_sender_name text;
  v_receiver_name text;
  v_failure text;
begin
  select * into v_transfer
  from public.player_inventory_transfers
  where id = p_transfer_id
  for update;

  if v_transfer.id is null then
    raise exception 'Transfer not found';
  end if;

  if v_transfer.status <> 'pending' then
    return v_transfer.status;
  end if;

  perform public.inventory_ensure_currency_row(v_transfer.sender_profile_id);
  perform public.inventory_ensure_currency_row(v_transfer.receiver_profile_id);

  if v_transfer.transfer_type = 'item' then
    select * into v_sender_item
    from public.player_inventory_items
    where id = v_transfer.item_inventory_id
      and player_profile_id = v_transfer.sender_profile_id
    for update;

    if v_sender_item.id is null or v_sender_item.quantity < v_transfer.item_quantity then
      v_failure := 'Sender no longer has enough item quantity.';
      update public.player_inventory_transfers
      set status = 'failed', failure_reason = v_failure, responded_at = now()
      where id = p_transfer_id;

      perform public.inventory_log_event(v_transfer.sender_profile_id, 'system', null, 'transfer_failed', format('Transfer failed: %s', v_failure), v_transfer.receiver_profile_id, p_transfer_id);
      perform public.inventory_log_event(v_transfer.receiver_profile_id, 'system', null, 'transfer_failed', format('Incoming transfer failed: %s', v_failure), v_transfer.sender_profile_id, p_transfer_id);
      return 'failed';
    end if;

    update public.player_inventory_items
    set quantity = quantity - v_transfer.item_quantity
    where id = v_sender_item.id;

    delete from public.player_inventory_items where id = v_sender_item.id and quantity <= 0;

    if v_sender_item.item_master_id is not null then
      insert into public.player_inventory_items (player_profile_id, item_master_id, quantity, notes)
      values (v_transfer.receiver_profile_id, v_sender_item.item_master_id, v_transfer.item_quantity, v_sender_item.notes)
      on conflict (player_profile_id, item_master_id) where item_master_id is not null
      do update set quantity = public.player_inventory_items.quantity + excluded.quantity;
    else
      insert into public.player_inventory_items (player_profile_id, custom_name, quantity, notes)
      values (v_transfer.receiver_profile_id, v_sender_item.custom_name, v_transfer.item_quantity, v_sender_item.notes);
    end if;
  else
    execute format('update public.player_inventory_currency set %I = %I - $1 where player_profile_id = $2 and %I >= $1', v_transfer.currency_type, v_transfer.currency_type, v_transfer.currency_type)
    using v_transfer.currency_amount, v_transfer.sender_profile_id;

    if not found then
      v_failure := 'Sender no longer has enough currency.';
      update public.player_inventory_transfers
      set status = 'failed', failure_reason = v_failure, responded_at = now()
      where id = p_transfer_id;

      perform public.inventory_log_event(v_transfer.sender_profile_id, 'system', null, 'transfer_failed', format('Transfer failed: %s', v_failure), v_transfer.receiver_profile_id, p_transfer_id);
      perform public.inventory_log_event(v_transfer.receiver_profile_id, 'system', null, 'transfer_failed', format('Incoming transfer failed: %s', v_failure), v_transfer.sender_profile_id, p_transfer_id);
      return 'failed';
    end if;

    execute format('update public.player_inventory_currency set %I = %I + $1 where player_profile_id = $2', v_transfer.currency_type, v_transfer.currency_type)
    using v_transfer.currency_amount, v_transfer.receiver_profile_id;
  end if;

  update public.player_inventory_transfers
  set status = 'completed', responded_at = now(), failure_reason = null
  where id = p_transfer_id;

  select coalesce(name, 'Sender') into v_sender_name from public.profiles_players where id = v_transfer.sender_profile_id;
  select coalesce(name, 'Receiver') into v_receiver_name from public.profiles_players where id = v_transfer.receiver_profile_id;

  perform public.inventory_log_event(
    v_transfer.sender_profile_id,
    case when v_transfer.initiated_by_role = 'dm' then 'dm' else 'player' end,
    v_transfer.initiated_by_profile_id,
    'transfer_completed',
    case when v_transfer.transfer_type = 'item'
      then format('Transfer completed to %s: %s x%s', v_receiver_name, coalesce(v_transfer.item_name_snapshot, 'Item'), v_transfer.item_quantity)
      else format('Transfer completed to %s: %s %s', v_receiver_name, upper(v_transfer.currency_type), v_transfer.currency_amount)
    end,
    v_transfer.receiver_profile_id,
    p_transfer_id
  );

  perform public.inventory_log_event(
    v_transfer.receiver_profile_id,
    case when v_transfer.initiated_by_role = 'dm' then 'dm' else 'player' end,
    v_transfer.initiated_by_profile_id,
    'transfer_completed',
    case when v_transfer.transfer_type = 'item'
      then format('Transfer received from %s: %s x%s', v_sender_name, coalesce(v_transfer.item_name_snapshot, 'Item'), v_transfer.item_quantity)
      else format('Transfer received from %s: %s %s', v_sender_name, upper(v_transfer.currency_type), v_transfer.currency_amount)
    end,
    v_transfer.sender_profile_id,
    p_transfer_id
  );

  return 'completed';
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
  on conflict (player_profile_id, item_master_id) where item_master_id is not null
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
