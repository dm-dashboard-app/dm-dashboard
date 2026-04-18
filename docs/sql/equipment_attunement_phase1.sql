-- Equipment + Attunement Phase 1: inventory instance state, equip/attune RPCs, and snapshot enrichment.
-- Revised contract: mechanics-dependent automation is only allowed for item_master rows marked metadata_json.mechanics_support = 'phase1_supported'.

alter table if exists public.player_inventory_items
  add column if not exists equipped boolean not null default false,
  add column if not exists attuned boolean not null default false,
  add column if not exists current_charges integer not null default 0 check (current_charges >= 0);

create or replace function public.inventory_is_phase1_supported(p_item_master_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(i.metadata_json->>'mechanics_support', 'unsupported') = 'phase1_supported'
  from public.item_master i
  where i.id = p_item_master_id;
$$;

create or replace function public.inventory_get_snapshot(
  p_player_profile_id uuid,
  p_join_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_currency jsonb;
  v_summary jsonb;
begin
  if public.inventory_is_dm() then
    null;
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
  end if;

  perform public.inventory_ensure_currency_row(p_player_profile_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'player_profile_id', i.player_profile_id,
    'item_master_id', i.item_master_id,
    'name', coalesce(im.name, i.custom_name),
    'custom_name', i.custom_name,
    'quantity', i.quantity,
    'notes', i.notes,
    'equipped', i.equipped,
    'attuned', i.attuned,
    'current_charges', i.current_charges,
    'requires_attunement', coalesce(im.requires_attunement, false),
    'metadata_json', coalesce(im.metadata_json, '{}'::jsonb),
    'created_at', i.created_at,
    'updated_at', i.updated_at
  ) order by coalesce(im.name, i.custom_name) asc), '[]'::jsonb)
  into v_items
  from public.player_inventory_items i
  left join public.item_master im on im.id = i.item_master_id
  where i.player_profile_id = p_player_profile_id;

  select jsonb_build_object('pp', c.pp, 'gp', c.gp, 'sp', c.sp, 'cp', c.cp)
  into v_currency
  from public.player_inventory_currency c
  where c.player_profile_id = p_player_profile_id;

  select to_jsonb(s.*) into v_summary
  from public.inventory_get_summary(p_player_profile_id, p_join_code) s;

  return jsonb_build_object('summary', v_summary, 'currency', v_currency, 'items', v_items);
end;
$$;

create or replace function public.inventory_equip_item(
  p_player_profile_id uuid,
  p_item_row_id uuid,
  p_join_code text default null,
  p_confirm_replace boolean default false
)
returns table (item_row_id uuid, replaced_item_row_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot text;
  v_existing uuid;
  v_item_master_id uuid;
  v_supported boolean := false;
begin
  if public.inventory_is_dm() then
    null;
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
  end if;

  select pi.item_master_id,
         coalesce(im.metadata_json->'mechanics'->>'slot_family', null),
         coalesce(im.metadata_json->>'mechanics_support', 'unsupported') = 'phase1_supported'
  into v_item_master_id, v_slot, v_supported
  from public.player_inventory_items pi
  left join public.item_master im on im.id = pi.item_master_id
  where pi.id = p_item_row_id and pi.player_profile_id = p_player_profile_id;

  if v_item_master_id is null then
    update public.player_inventory_items
    set equipped = true
    where id = p_item_row_id and player_profile_id = p_player_profile_id;

    return query select p_item_row_id, null::uuid;
    return;
  end if;

  -- Unsupported/manual rows can still be toggled equipped for inventory bookkeeping,
  -- but do not run mechanics slot automation or replacement semantics.
  if not v_supported then
    update public.player_inventory_items
    set equipped = true
    where id = p_item_row_id and player_profile_id = p_player_profile_id;

    return query select p_item_row_id, null::uuid;
    return;
  end if;

  if v_slot is null then
    raise exception 'Phase 1 supported item is missing slot_family mechanics data.';
  end if;

  if v_slot <> 'ring' then
    select pi.id into v_existing
    from public.player_inventory_items pi
    join public.item_master i on i.id = pi.item_master_id
    where pi.player_profile_id = p_player_profile_id
      and pi.equipped = true
      and pi.id <> p_item_row_id
      and coalesce(i.metadata_json->>'mechanics_support', 'unsupported') = 'phase1_supported'
      and coalesce(i.metadata_json->'mechanics'->>'slot_family', '') = v_slot
    limit 1;

    if v_existing is not null and not coalesce(p_confirm_replace, false) then
      raise exception 'Slot occupied. Confirmation required to replace equipped item.';
    end if;

    if v_existing is not null then
      update public.player_inventory_items set equipped = false, attuned = false where id = v_existing;
    end if;
  end if;

  update public.player_inventory_items
  set equipped = true
  where id = p_item_row_id and player_profile_id = p_player_profile_id;

  return query select p_item_row_id, v_existing;
end;
$$;

create or replace function public.inventory_unequip_item(
  p_player_profile_id uuid,
  p_item_row_id uuid,
  p_join_code text default null
)
returns table (item_row_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.inventory_is_dm() then
    null;
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
  end if;

  update public.player_inventory_items
  set equipped = false,
      attuned = false
  where id = p_item_row_id and player_profile_id = p_player_profile_id;

  return query select p_item_row_id;
end;
$$;

create or replace function public.inventory_attune_item(
  p_player_profile_id uuid,
  p_item_row_id uuid,
  p_join_code text default null,
  p_rest_context boolean default false
)
returns table (item_row_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dm boolean := public.inventory_is_dm();
  v_requires_attunement boolean := false;
  v_is_attunement_only boolean := false;
  v_attuned_count integer := 0;
  v_supported boolean := false;
begin
  if v_is_dm then
    null;
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
    if not coalesce(p_rest_context, false) then
      raise exception 'Attunement is only available during short or long rest.';
    end if;
  end if;

  select
    coalesce(im.requires_attunement, false),
    coalesce(im.metadata_json->'mechanics'->>'activation_mode', '') = 'attunement_only',
    coalesce(im.metadata_json->>'mechanics_support', 'unsupported') = 'phase1_supported'
  into v_requires_attunement, v_is_attunement_only, v_supported
  from public.player_inventory_items pi
  left join public.item_master im on im.id = pi.item_master_id
  where pi.id = p_item_row_id and pi.player_profile_id = p_player_profile_id;

  if not v_supported then
    raise exception 'Attunement automation is only supported for phase1_supported enriched items.';
  end if;

  if not v_requires_attunement and not v_is_attunement_only then
    raise exception 'This phase1_supported item does not support attunement semantics.';
  end if;

  select count(*)::integer into v_attuned_count
  from public.player_inventory_items pi
  join public.item_master im on im.id = pi.item_master_id
  where pi.player_profile_id = p_player_profile_id
    and pi.attuned = true
    and pi.id <> p_item_row_id
    and coalesce(im.metadata_json->>'mechanics_support', 'unsupported') = 'phase1_supported';

  if v_attuned_count >= 3 then
    raise exception 'Attunement limit reached (3).';
  end if;

  update public.player_inventory_items pi
  set attuned = true
  from public.item_master im
  where pi.item_master_id = im.id
    and pi.id = p_item_row_id
    and pi.player_profile_id = p_player_profile_id;

  return query select p_item_row_id;
end;
$$;

create or replace function public.inventory_unattune_item(
  p_player_profile_id uuid,
  p_item_row_id uuid,
  p_join_code text default null,
  p_rest_context boolean default false
)
returns table (item_row_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.inventory_is_dm() then
    null;
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
  end if;

  update public.player_inventory_items
  set attuned = false
  where id = p_item_row_id and player_profile_id = p_player_profile_id;

  return query select p_item_row_id;
end;
$$;

create or replace function public.inventory_recharge_item(
  p_player_profile_id uuid,
  p_item_row_id uuid,
  p_join_code text default null,
  p_restored_charges integer default 0
)
returns table (item_row_id uuid, current_charges integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_charges integer := 0;
  v_current integer := 0;
  v_next integer := 0;
  v_supported boolean := false;
  v_has_recharge boolean := false;
begin
  if public.inventory_is_dm() then
    null;
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
  end if;

  select
    greatest(0, coalesce((im.metadata_json->'mechanics'->'charges'->>'max')::integer, 0)),
    greatest(0, coalesce(pi.current_charges, 0)),
    coalesce(im.metadata_json->>'mechanics_support', 'unsupported') = 'phase1_supported',
    (im.metadata_json->'mechanics'->'recharge') is not null
  into v_max_charges, v_current, v_supported, v_has_recharge
  from public.player_inventory_items pi
  left join public.item_master im on im.id = pi.item_master_id
  where pi.id = p_item_row_id and pi.player_profile_id = p_player_profile_id;

  if not v_supported then
    raise exception 'Charge recharge automation is only supported for phase1_supported enriched items.';
  end if;

  if not v_has_recharge then
    raise exception 'This phase1_supported item has no recharge configuration.';
  end if;

  if v_max_charges <= 0 then
    raise exception 'This phase1_supported item has no charge track.';
  end if;

  v_next := least(v_max_charges, v_current + greatest(0, coalesce(p_restored_charges, 0)));

  update public.player_inventory_items
  set current_charges = v_next
  where id = p_item_row_id and player_profile_id = p_player_profile_id;

  return query select p_item_row_id, v_next;
end;
$$;

revoke all on function public.inventory_is_phase1_supported(uuid) from public;
revoke all on function public.inventory_equip_item(uuid, uuid, text, boolean) from public;
revoke all on function public.inventory_unequip_item(uuid, uuid, text) from public;
revoke all on function public.inventory_attune_item(uuid, uuid, text, boolean) from public;
revoke all on function public.inventory_unattune_item(uuid, uuid, text, boolean) from public;
revoke all on function public.inventory_recharge_item(uuid, uuid, text, integer) from public;

grant execute on function public.inventory_is_phase1_supported(uuid) to anon, authenticated;
grant execute on function public.inventory_equip_item(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function public.inventory_unequip_item(uuid, uuid, text) to anon, authenticated;
grant execute on function public.inventory_attune_item(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function public.inventory_unattune_item(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function public.inventory_recharge_item(uuid, uuid, text, integer) to anon, authenticated;
