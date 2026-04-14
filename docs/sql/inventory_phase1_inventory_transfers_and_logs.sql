-- Inventory Phase 1: inventory items, currency, transfer flow, and DM audit log.

create table if not exists public.player_inventory_items (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.profiles_players(id) on delete cascade,
  item_master_id uuid references public.item_master(id) on delete set null,
  custom_name text,
  quantity integer not null check (quantity > 0),
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_inventory_items_item_source_ck check (
    item_master_id is not null or nullif(trim(coalesce(custom_name, '')), '') is not null
  )
);

create unique index if not exists uq_player_inventory_items_catalog
  on public.player_inventory_items(player_profile_id, item_master_id)
  where item_master_id is not null;

create index if not exists idx_player_inventory_items_profile on public.player_inventory_items(player_profile_id);
create index if not exists idx_player_inventory_items_custom_name on public.player_inventory_items(lower(custom_name));

create table if not exists public.player_inventory_currency (
  player_profile_id uuid primary key references public.profiles_players(id) on delete cascade,
  pp integer not null default 0 check (pp >= 0),
  gp integer not null default 0 check (gp >= 0),
  sp integer not null default 0 check (sp >= 0),
  cp integer not null default 0 check (cp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles_players(id) on delete cascade,
  receiver_profile_id uuid not null references public.profiles_players(id) on delete cascade,
  initiated_by_role text not null check (initiated_by_role in ('dm', 'player')),
  initiated_by_profile_id uuid references public.profiles_players(id) on delete set null,
  transfer_type text not null check (transfer_type in ('item', 'currency')),
  item_inventory_id uuid references public.player_inventory_items(id) on delete set null,
  item_master_id uuid references public.item_master(id) on delete set null,
  item_name_snapshot text,
  item_notes_snapshot text,
  item_quantity integer check (item_quantity > 0),
  currency_type text check (currency_type in ('pp', 'gp', 'sp', 'cp')),
  currency_amount integer check (currency_amount > 0),
  note text,
  status text not null check (status in ('pending', 'completed', 'declined', 'failed', 'cancelled')),
  failure_reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint player_inventory_transfers_sender_receiver_ck check (sender_profile_id <> receiver_profile_id),
  constraint player_inventory_transfers_payload_ck check (
    (transfer_type = 'item' and item_quantity is not null and currency_type is null and currency_amount is null)
    or
    (transfer_type = 'currency' and currency_type is not null and currency_amount is not null and item_quantity is null)
  )
);

create index if not exists idx_player_inventory_transfers_receiver_status on public.player_inventory_transfers(receiver_profile_id, status, created_at desc);
create index if not exists idx_player_inventory_transfers_sender on public.player_inventory_transfers(sender_profile_id, created_at desc);

create table if not exists public.player_inventory_log (
  id bigserial primary key,
  player_profile_id uuid not null references public.profiles_players(id) on delete cascade,
  actor_role text not null check (actor_role in ('dm', 'player', 'system')),
  actor_profile_id uuid references public.profiles_players(id) on delete set null,
  action_type text not null,
  summary text not null,
  related_profile_id uuid references public.profiles_players(id) on delete set null,
  transfer_id uuid references public.player_inventory_transfers(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_inventory_log_profile_created on public.player_inventory_log(player_profile_id, created_at desc);
create index if not exists idx_player_inventory_log_transfer on public.player_inventory_log(transfer_id);

create or replace function public.set_player_inventory_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_inventory_items_updated_at on public.player_inventory_items;
create trigger trg_player_inventory_items_updated_at
before update on public.player_inventory_items
for each row
execute function public.set_player_inventory_items_updated_at();

create or replace function public.set_player_inventory_currency_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_inventory_currency_updated_at on public.player_inventory_currency;
create trigger trg_player_inventory_currency_updated_at
before update on public.player_inventory_currency
for each row
execute function public.set_player_inventory_currency_updated_at();

alter table public.player_inventory_items enable row level security;
alter table public.player_inventory_currency enable row level security;
alter table public.player_inventory_transfers enable row level security;
alter table public.player_inventory_log enable row level security;

revoke all on public.player_inventory_items from anon, authenticated;
revoke all on public.player_inventory_currency from anon, authenticated;
revoke all on public.player_inventory_transfers from anon, authenticated;
revoke all on public.player_inventory_log from anon, authenticated;

create or replace function public.inventory_ensure_currency_row(p_player_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_inventory_currency (player_profile_id)
  values (p_player_profile_id)
  on conflict (player_profile_id) do nothing;
end;
$$;

create or replace function public.inventory_authorize_player(p_player_profile_id uuid, p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encounter_id uuid;
begin
  if p_player_profile_id is null then
    raise exception 'player_profile_id is required';
  end if;

  if nullif(trim(coalesce(p_join_code, '')), '') is null then
    raise exception 'join code is required';
  end if;

  select ps.encounter_id
  into v_encounter_id
  from public.player_sessions ps
  where ps.player_profile_id = p_player_profile_id
    and upper(ps.join_code) = upper(trim(p_join_code))
  limit 1;

  if v_encounter_id is null then
    raise exception 'Player session authorization failed';
  end if;

  return v_encounter_id;
end;
$$;

create or replace function public.inventory_is_dm()
returns boolean
language sql
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.inventory_log_event(
  p_player_profile_id uuid,
  p_actor_role text,
  p_actor_profile_id uuid,
  p_action_type text,
  p_summary text,
  p_related_profile_id uuid default null,
  p_transfer_id uuid default null,
  p_metadata_json jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.player_inventory_log (
    player_profile_id,
    actor_role,
    actor_profile_id,
    action_type,
    summary,
    related_profile_id,
    transfer_id,
    metadata_json
  )
  values (
    p_player_profile_id,
    p_actor_role,
    p_actor_profile_id,
    p_action_type,
    p_summary,
    p_related_profile_id,
    p_transfer_id,
    coalesce(p_metadata_json, '{}'::jsonb)
  );
$$;

create or replace function public.inventory_get_summary(
  p_player_profile_id uuid,
  p_join_code text default null
)
returns table (
  player_profile_id uuid,
  total_item_quantity integer,
  gp integer,
  pp integer,
  sp integer,
  cp integer
)
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

  perform public.inventory_ensure_currency_row(p_player_profile_id);

  return query
  with item_totals as (
    select coalesce(sum(quantity), 0)::integer as total_item_quantity
    from public.player_inventory_items
    where player_profile_id = p_player_profile_id
  )
  select
    p_player_profile_id,
    item_totals.total_item_quantity,
    c.gp,
    c.pp,
    c.sp,
    c.cp
  from item_totals
  join public.player_inventory_currency c on c.player_profile_id = p_player_profile_id;
end;
$$;

create or replace function public.inventory_get_summaries_for_profiles(p_profile_ids uuid[])
returns table (
  player_profile_id uuid,
  total_item_quantity integer,
  gp integer,
  pp integer,
  sp integer,
  cp integer
)
language sql
security definer
set search_path = public
as $$
  select s.player_profile_id, s.total_item_quantity, s.gp, s.pp, s.sp, s.cp
  from unnest(coalesce(p_profile_ids, '{}')) as pid
  cross join lateral public.inventory_get_summary(pid, null) s;
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

create or replace function public.inventory_search_catalog(
  p_query text,
  p_player_profile_id uuid,
  p_join_code text default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  name text,
  item_type text,
  category text,
  rarity text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dm boolean := public.inventory_is_dm();
  v_q text := trim(coalesce(p_query, ''));
begin
  if not v_is_dm then
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
  end if;

  return query
  select i.id, i.name, i.item_type, i.category, i.rarity
  from public.item_master i
  where i.rules_era = '2014'
    and coalesce(i.metadata_json->>'import_quality', '') not in ('degraded_fallback', 'degraded_import')
    and coalesce(i.shop_bucket, '') <> 'fallback_quarantine'
    and coalesce(i.price_source, '') <> 'degraded_fallback_untrusted'
    and (v_q = '' or i.name ilike '%' || v_q || '%')
  order by i.name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

create or replace function public.inventory_get_transfer_targets(
  p_player_profile_id uuid,
  p_join_code text
)
returns table (
  profile_id uuid,
  name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encounter_id uuid;
begin
  if public.inventory_is_dm() then
    return query select p.id, p.name from public.profiles_players p order by p.name asc;
    return;
  end if;

  v_encounter_id := public.inventory_authorize_player(p_player_profile_id, p_join_code);

  return query
  select ps.player_profile_id, coalesce(pp.name, 'Player')
  from public.player_sessions ps
  join public.profiles_players pp on pp.id = ps.player_profile_id
  where ps.encounter_id = v_encounter_id
    and ps.player_profile_id <> p_player_profile_id
  order by pp.name asc;
end;
$$;

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
      on conflict (player_profile_id, item_master_id)
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

create or replace function public.inventory_remove_item(
  p_player_profile_id uuid,
  p_item_row_id uuid,
  p_join_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dm boolean := public.inventory_is_dm();
  v_actor_role text;
  v_actor_profile_id uuid := null;
  v_item_name text;
begin
  if v_is_dm then
    v_actor_role := 'dm';
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
    v_actor_role := 'player';
    v_actor_profile_id := p_player_profile_id;
  end if;

  delete from public.player_inventory_items
  where id = p_item_row_id
    and player_profile_id = p_player_profile_id
  returning coalesce((select name from public.item_master where id = item_master_id), custom_name)
  into v_item_name;

  if v_item_name is null then
    raise exception 'Inventory item not found';
  end if;

  perform public.inventory_log_event(
    p_player_profile_id,
    v_actor_role,
    v_actor_profile_id,
    'remove_item',
    format('Item removed: %s', v_item_name)
  );
end;
$$;

create or replace function public.inventory_set_currency(
  p_player_profile_id uuid,
  p_pp integer,
  p_gp integer,
  p_sp integer,
  p_cp integer,
  p_join_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dm boolean := public.inventory_is_dm();
  v_actor_role text;
  v_actor_profile_id uuid := null;
begin
  if least(coalesce(p_pp, 0), coalesce(p_gp, 0), coalesce(p_sp, 0), coalesce(p_cp, 0)) < 0 then
    raise exception 'Currency cannot be negative';
  end if;

  if v_is_dm then
    v_actor_role := 'dm';
  else
    perform public.inventory_authorize_player(p_player_profile_id, p_join_code);
    v_actor_role := 'player';
    v_actor_profile_id := p_player_profile_id;
  end if;

  perform public.inventory_ensure_currency_row(p_player_profile_id);

  update public.player_inventory_currency
  set pp = coalesce(p_pp, 0),
      gp = coalesce(p_gp, 0),
      sp = coalesce(p_sp, 0),
      cp = coalesce(p_cp, 0)
  where player_profile_id = p_player_profile_id;

  perform public.inventory_log_event(
    p_player_profile_id,
    v_actor_role,
    v_actor_profile_id,
    'set_currency',
    format('Currency set to PP %s • GP %s • SP %s • CP %s', coalesce(p_pp, 0), coalesce(p_gp, 0), coalesce(p_sp, 0), coalesce(p_cp, 0))
  );
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
      on conflict (player_profile_id, item_master_id)
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

create or replace function public.inventory_create_transfer(
  p_sender_profile_id uuid,
  p_receiver_profile_id uuid,
  p_join_code text default null,
  p_item_row_id uuid default null,
  p_item_quantity integer default null,
  p_currency_type text default null,
  p_currency_amount integer default null,
  p_note text default null
)
returns table (
  transfer_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dm boolean := public.inventory_is_dm();
  v_initiated_by_role text;
  v_transfer_id uuid;
  v_item public.player_inventory_items%rowtype;
  v_transfer_type text;
  v_item_name text;
begin
  if p_sender_profile_id is null or p_receiver_profile_id is null then
    raise exception 'sender and receiver are required';
  end if;

  if p_sender_profile_id = p_receiver_profile_id then
    raise exception 'sender and receiver must be different';
  end if;

  if p_item_row_id is not null then
    v_transfer_type := 'item';
  elsif nullif(trim(coalesce(p_currency_type, '')), '') is not null then
    v_transfer_type := 'currency';
  else
    raise exception 'item or currency payload required';
  end if;

  if v_is_dm then
    v_initiated_by_role := 'dm';
  else
    perform public.inventory_authorize_player(p_sender_profile_id, p_join_code);
    v_initiated_by_role := 'player';
  end if;

  if v_transfer_type = 'item' then
    if coalesce(p_item_quantity, 0) <= 0 then
      raise exception 'item quantity must be positive';
    end if;

    select * into v_item
    from public.player_inventory_items
    where id = p_item_row_id
      and player_profile_id = p_sender_profile_id;

    if v_item.id is null then
      raise exception 'Sender item not found';
    end if;

    v_item_name := coalesce((select name from public.item_master where id = v_item.item_master_id), v_item.custom_name);

    insert into public.player_inventory_transfers (
      sender_profile_id,
      receiver_profile_id,
      initiated_by_role,
      initiated_by_profile_id,
      transfer_type,
      item_inventory_id,
      item_master_id,
      item_name_snapshot,
      item_notes_snapshot,
      item_quantity,
      note,
      status
    )
    values (
      p_sender_profile_id,
      p_receiver_profile_id,
      v_initiated_by_role,
      case when v_initiated_by_role = 'player' then p_sender_profile_id else null end,
      'item',
      p_item_row_id,
      v_item.item_master_id,
      v_item_name,
      v_item.notes,
      p_item_quantity,
      nullif(trim(coalesce(p_note, '')), ''),
      case when v_initiated_by_role = 'dm' then 'pending' else 'pending' end
    )
    returning id into v_transfer_id;
  else
    if coalesce(p_currency_amount, 0) <= 0 then
      raise exception 'currency amount must be positive';
    end if;

    insert into public.player_inventory_transfers (
      sender_profile_id,
      receiver_profile_id,
      initiated_by_role,
      initiated_by_profile_id,
      transfer_type,
      currency_type,
      currency_amount,
      note,
      status
    )
    values (
      p_sender_profile_id,
      p_receiver_profile_id,
      v_initiated_by_role,
      case when v_initiated_by_role = 'player' then p_sender_profile_id else null end,
      'currency',
      lower(trim(p_currency_type)),
      p_currency_amount,
      nullif(trim(coalesce(p_note, '')), ''),
      'pending'
    )
    returning id into v_transfer_id;
  end if;

  perform public.inventory_log_event(
    p_sender_profile_id,
    v_initiated_by_role,
    case when v_initiated_by_role = 'player' then p_sender_profile_id else null end,
    'transfer_requested',
    case when v_transfer_type = 'item'
      then format('Transfer requested to player: %s x%s', coalesce(v_item_name, 'Item'), p_item_quantity)
      else format('Transfer requested to player: %s %s', upper(lower(trim(p_currency_type))), p_currency_amount)
    end,
    p_receiver_profile_id,
    v_transfer_id
  );

  if v_initiated_by_role = 'player' then
    perform public.inventory_log_event(
      p_receiver_profile_id,
      'player',
      p_sender_profile_id,
      'transfer_requested',
      case when v_transfer_type = 'item'
        then format('Incoming transfer request: %s x%s', coalesce(v_item_name, 'Item'), p_item_quantity)
        else format('Incoming transfer request: %s %s', upper(lower(trim(p_currency_type))), p_currency_amount)
      end,
      p_sender_profile_id,
      v_transfer_id
    );
  else
    status := public.inventory_apply_transfer(v_transfer_id);
    transfer_id := v_transfer_id;
    return next;
    return;
  end if;

  transfer_id := v_transfer_id;
  status := 'pending';
  return next;
end;
$$;

create or replace function public.inventory_respond_transfer(
  p_transfer_id uuid,
  p_receiver_profile_id uuid,
  p_accept boolean,
  p_join_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.player_inventory_transfers%rowtype;
  v_result text;
begin
  perform public.inventory_authorize_player(p_receiver_profile_id, p_join_code);

  select * into v_transfer
  from public.player_inventory_transfers
  where id = p_transfer_id
  for update;

  if v_transfer.id is null then
    raise exception 'Transfer not found';
  end if;

  if v_transfer.receiver_profile_id <> p_receiver_profile_id then
    raise exception 'Not authorized for this transfer';
  end if;

  if v_transfer.status <> 'pending' then
    return v_transfer.status;
  end if;

  if not p_accept then
    update public.player_inventory_transfers
    set status = 'declined', responded_at = now(), failure_reason = null
    where id = p_transfer_id;

    perform public.inventory_log_event(v_transfer.sender_profile_id, 'player', p_receiver_profile_id, 'transfer_declined', 'Transfer declined by receiver', v_transfer.receiver_profile_id, p_transfer_id);
    perform public.inventory_log_event(v_transfer.receiver_profile_id, 'player', p_receiver_profile_id, 'transfer_declined', 'You declined incoming transfer', v_transfer.sender_profile_id, p_transfer_id);
    return 'declined';
  end if;

  v_result := public.inventory_apply_transfer(p_transfer_id);
  return v_result;
end;
$$;

create or replace function public.inventory_get_pending_incoming(
  p_player_profile_id uuid,
  p_join_code text
)
returns table (
  id uuid,
  sender_profile_id uuid,
  sender_name text,
  transfer_type text,
  item_name_snapshot text,
  item_quantity integer,
  currency_type text,
  currency_amount integer,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.inventory_authorize_player(p_player_profile_id, p_join_code);

  return query
  select
    t.id,
    t.sender_profile_id,
    coalesce(p.name, 'Player') as sender_name,
    t.transfer_type,
    t.item_name_snapshot,
    t.item_quantity,
    t.currency_type,
    t.currency_amount,
    t.note,
    t.created_at
  from public.player_inventory_transfers t
  left join public.profiles_players p on p.id = t.sender_profile_id
  where t.receiver_profile_id = p_player_profile_id
    and t.status = 'pending'
  order by t.created_at asc;
end;
$$;

create or replace function public.inventory_get_log(p_player_profile_id uuid)
returns table (
  id bigint,
  player_profile_id uuid,
  actor_role text,
  actor_name text,
  action_type text,
  summary text,
  related_profile_id uuid,
  related_name text,
  transfer_id uuid,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.player_profile_id,
    l.actor_role,
    coalesce(ap.name, case when l.actor_role = 'dm' then 'DM' else 'System' end) as actor_name,
    l.action_type,
    l.summary,
    l.related_profile_id,
    rp.name as related_name,
    l.transfer_id,
    l.created_at
  from public.player_inventory_log l
  left join public.profiles_players ap on ap.id = l.actor_profile_id
  left join public.profiles_players rp on rp.id = l.related_profile_id
  where l.player_profile_id = p_player_profile_id
    and public.inventory_is_dm()
  order by l.created_at desc
  limit 200;
$$;

revoke all on function public.inventory_ensure_currency_row(uuid) from public;
revoke all on function public.inventory_authorize_player(uuid, text) from public;
revoke all on function public.inventory_is_dm() from public;
revoke all on function public.inventory_log_event(uuid, text, uuid, text, text, uuid, uuid, jsonb) from public;
revoke all on function public.inventory_get_summary(uuid, text) from public;
revoke all on function public.inventory_get_summaries_for_profiles(uuid[]) from public;
revoke all on function public.inventory_get_snapshot(uuid, text) from public;
revoke all on function public.inventory_search_catalog(text, uuid, text, integer) from public;
revoke all on function public.inventory_get_transfer_targets(uuid, text) from public;
revoke all on function public.inventory_upsert_item(uuid, text, uuid, text, integer, text, uuid) from public;
revoke all on function public.inventory_remove_item(uuid, uuid, text) from public;
revoke all on function public.inventory_set_currency(uuid, integer, integer, integer, integer, text) from public;
revoke all on function public.inventory_apply_transfer(uuid) from public;
revoke all on function public.inventory_create_transfer(uuid, uuid, text, uuid, integer, text, integer, text) from public;
revoke all on function public.inventory_respond_transfer(uuid, uuid, boolean, text) from public;
revoke all on function public.inventory_get_pending_incoming(uuid, text) from public;
revoke all on function public.inventory_get_log(uuid) from public;

grant execute on function public.inventory_get_summary(uuid, text) to anon, authenticated;
grant execute on function public.inventory_get_summaries_for_profiles(uuid[]) to authenticated;
grant execute on function public.inventory_get_snapshot(uuid, text) to anon, authenticated;
grant execute on function public.inventory_search_catalog(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.inventory_get_transfer_targets(uuid, text) to anon, authenticated;
grant execute on function public.inventory_upsert_item(uuid, text, uuid, text, integer, text, uuid) to anon, authenticated;
grant execute on function public.inventory_remove_item(uuid, uuid, text) to anon, authenticated;
grant execute on function public.inventory_set_currency(uuid, integer, integer, integer, integer, text) to anon, authenticated;
grant execute on function public.inventory_create_transfer(uuid, uuid, text, uuid, integer, text, integer, text) to anon, authenticated;
grant execute on function public.inventory_respond_transfer(uuid, uuid, boolean, text) to anon, authenticated;
grant execute on function public.inventory_get_pending_incoming(uuid, text) to anon, authenticated;
grant execute on function public.inventory_get_log(uuid) to authenticated;
