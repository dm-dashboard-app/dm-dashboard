-- World tab expansion baseline: Locales + locale districts + locale shops + persisted locale shop inventory + NPC library.
-- Mobile-first worldbuilding persistence layer with SECURITY DEFINER RPCs for write/read mediation.

create table if not exists public.dm_world_locales (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  locale_type text not null default 'Town',
  short_description text,
  politics_leadership text,
  purpose text,
  settlement_structure text,
  notable_features text,
  hidden_or_underbelly_notes text,
  free_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_world_locale_districts (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.dm_world_locales(id) on delete cascade,
  name text not null,
  short_description text,
  atmosphere_or_identity text,
  notable_locations text,
  free_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_world_locale_shops (
  id uuid primary key default gen_random_uuid(),
  locale_id uuid not null references public.dm_world_locales(id) on delete cascade,
  district_id uuid references public.dm_world_locale_districts(id) on delete set null,
  shop_name text not null,
  shop_type text not null,
  affluence_tier text not null default 'modest',
  proprietor_name text,
  proprietor_race text,
  proprietor_description text,
  exterior_description text,
  interior_description text,
  shop_notes text,
  inventory_notes text,
  generation_seed text,
  inventory_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_world_locale_shop_inventory (
  id uuid primary key default gen_random_uuid(),
  locale_shop_id uuid not null references public.dm_world_locale_shops(id) on delete cascade,
  item_id uuid references public.item_master(id) on delete set null,
  item_name text not null,
  item_type text,
  category text,
  subcategory text,
  rarity text,
  description text,
  source_type text,
  source_book text,
  price_source text,
  shop_bucket text,
  metadata_json jsonb,
  quantity integer not null check (quantity > 0),
  listed_price_gp numeric not null check (listed_price_gp >= 0),
  minimum_price_gp numeric not null check (minimum_price_gp >= 0),
  barter_dc integer not null check (barter_dc >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dm_world_npcs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  race text,
  portrait_url text,
  body_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dm_world_locales_updated_at on public.dm_world_locales(updated_at desc);
create index if not exists idx_dm_world_locale_districts_locale on public.dm_world_locale_districts(locale_id, updated_at desc);
create index if not exists idx_dm_world_locale_shops_locale on public.dm_world_locale_shops(locale_id, updated_at desc);
create index if not exists idx_dm_world_locale_shops_district on public.dm_world_locale_shops(district_id);
create index if not exists idx_dm_world_locale_shop_inventory_shop on public.dm_world_locale_shop_inventory(locale_shop_id, sort_order);
create index if not exists idx_dm_world_npcs_name on public.dm_world_npcs(name);

create or replace function public.set_dm_world_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dm_world_locales_updated_at on public.dm_world_locales;
create trigger trg_dm_world_locales_updated_at
before update on public.dm_world_locales
for each row
execute function public.set_dm_world_updated_at();

drop trigger if exists trg_dm_world_locale_districts_updated_at on public.dm_world_locale_districts;
create trigger trg_dm_world_locale_districts_updated_at
before update on public.dm_world_locale_districts
for each row
execute function public.set_dm_world_updated_at();

drop trigger if exists trg_dm_world_locale_shops_updated_at on public.dm_world_locale_shops;
create trigger trg_dm_world_locale_shops_updated_at
before update on public.dm_world_locale_shops
for each row
execute function public.set_dm_world_updated_at();

drop trigger if exists trg_dm_world_npcs_updated_at on public.dm_world_npcs;
create trigger trg_dm_world_npcs_updated_at
before update on public.dm_world_npcs
for each row
execute function public.set_dm_world_updated_at();

alter table public.dm_world_locales enable row level security;
alter table public.dm_world_locale_districts enable row level security;
alter table public.dm_world_locale_shops enable row level security;
alter table public.dm_world_locale_shop_inventory enable row level security;
alter table public.dm_world_npcs enable row level security;

revoke all on public.dm_world_locales from anon, authenticated;
revoke all on public.dm_world_locale_districts from anon, authenticated;
revoke all on public.dm_world_locale_shops from anon, authenticated;
revoke all on public.dm_world_locale_shop_inventory from anon, authenticated;
revoke all on public.dm_world_npcs from anon, authenticated;

create or replace function public.dm_world_upsert_locale(
  p_locale_id uuid,
  p_name text,
  p_locale_type text,
  p_short_description text,
  p_politics_leadership text,
  p_purpose text,
  p_settlement_structure text,
  p_notable_features text,
  p_hidden_or_underbelly_notes text,
  p_free_notes text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Locale name is required.';
  end if;

  if p_locale_id is null then
    insert into public.dm_world_locales (
      name,
      locale_type,
      short_description,
      politics_leadership,
      purpose,
      settlement_structure,
      notable_features,
      hidden_or_underbelly_notes,
      free_notes,
      notes
    ) values (
      trim(p_name),
      coalesce(nullif(trim(p_locale_type), ''), 'Town'),
      nullif(trim(p_short_description), ''),
      nullif(trim(p_politics_leadership), ''),
      nullif(trim(p_purpose), ''),
      nullif(trim(p_settlement_structure), ''),
      nullif(trim(p_notable_features), ''),
      nullif(trim(p_hidden_or_underbelly_notes), ''),
      nullif(trim(p_free_notes), ''),
      nullif(trim(p_notes), '')
    ) returning id into v_id;
  else
    update public.dm_world_locales
    set
      name = trim(p_name),
      locale_type = coalesce(nullif(trim(p_locale_type), ''), 'Town'),
      short_description = nullif(trim(p_short_description), ''),
      politics_leadership = nullif(trim(p_politics_leadership), ''),
      purpose = nullif(trim(p_purpose), ''),
      settlement_structure = nullif(trim(p_settlement_structure), ''),
      notable_features = nullif(trim(p_notable_features), ''),
      hidden_or_underbelly_notes = nullif(trim(p_hidden_or_underbelly_notes), ''),
      free_notes = nullif(trim(p_free_notes), ''),
      notes = nullif(trim(p_notes), '')
    where id = p_locale_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Locale not found.';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.dm_world_set_locale_notes(
  p_locale_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_world_locales
  set notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_locale_id;

  if not found then
    raise exception 'Locale not found.';
  end if;
end;
$$;

create or replace function public.dm_world_upsert_district(
  p_district_id uuid,
  p_locale_id uuid,
  p_name text,
  p_short_description text,
  p_atmosphere_or_identity text,
  p_notable_locations text,
  p_free_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_locale_id is null then
    raise exception 'Locale id is required.';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'District name is required.';
  end if;

  if p_district_id is null then
    insert into public.dm_world_locale_districts (
      locale_id,
      name,
      short_description,
      atmosphere_or_identity,
      notable_locations,
      free_notes
    ) values (
      p_locale_id,
      trim(p_name),
      nullif(trim(p_short_description), ''),
      nullif(trim(p_atmosphere_or_identity), ''),
      nullif(trim(p_notable_locations), ''),
      nullif(trim(p_free_notes), '')
    ) returning id into v_id;
  else
    update public.dm_world_locale_districts
    set
      locale_id = p_locale_id,
      name = trim(p_name),
      short_description = nullif(trim(p_short_description), ''),
      atmosphere_or_identity = nullif(trim(p_atmosphere_or_identity), ''),
      notable_locations = nullif(trim(p_notable_locations), ''),
      free_notes = nullif(trim(p_free_notes), '')
    where id = p_district_id
    returning id into v_id;

    if v_id is null then
      raise exception 'District not found.';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.dm_world_upsert_locale_shop(
  p_shop_id uuid,
  p_locale_id uuid,
  p_district_id uuid,
  p_shop_name text,
  p_shop_type text,
  p_affluence_tier text,
  p_proprietor_name text,
  p_proprietor_race text,
  p_proprietor_description text,
  p_exterior_description text,
  p_interior_description text,
  p_shop_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_locale_id is null then
    raise exception 'Locale id is required.';
  end if;

  if coalesce(trim(p_shop_name), '') = '' then
    raise exception 'Shop name is required.';
  end if;

  if coalesce(trim(p_shop_type), '') = '' then
    raise exception 'Shop type is required.';
  end if;

  if p_district_id is not null then
    if not exists (
      select 1
      from public.dm_world_locale_districts d
      where d.id = p_district_id
      and d.locale_id = p_locale_id
    ) then
      raise exception 'District is not part of this locale.';
    end if;
  end if;

  if p_shop_id is null then
    insert into public.dm_world_locale_shops (
      locale_id,
      district_id,
      shop_name,
      shop_type,
      affluence_tier,
      proprietor_name,
      proprietor_race,
      proprietor_description,
      exterior_description,
      interior_description,
      shop_notes
    ) values (
      p_locale_id,
      p_district_id,
      trim(p_shop_name),
      trim(p_shop_type),
      coalesce(nullif(trim(p_affluence_tier), ''), 'modest'),
      nullif(trim(p_proprietor_name), ''),
      nullif(trim(p_proprietor_race), ''),
      nullif(trim(p_proprietor_description), ''),
      nullif(trim(p_exterior_description), ''),
      nullif(trim(p_interior_description), ''),
      nullif(trim(p_shop_notes), '')
    ) returning id into v_id;
  else
    update public.dm_world_locale_shops
    set
      locale_id = p_locale_id,
      district_id = p_district_id,
      shop_name = trim(p_shop_name),
      shop_type = trim(p_shop_type),
      affluence_tier = coalesce(nullif(trim(p_affluence_tier), ''), 'modest'),
      proprietor_name = nullif(trim(p_proprietor_name), ''),
      proprietor_race = nullif(trim(p_proprietor_race), ''),
      proprietor_description = nullif(trim(p_proprietor_description), ''),
      exterior_description = nullif(trim(p_exterior_description), ''),
      interior_description = nullif(trim(p_interior_description), ''),
      shop_notes = nullif(trim(p_shop_notes), '')
    where id = p_shop_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Locale shop not found.';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.dm_world_set_locale_shop_inventory_notes(
  p_shop_id uuid,
  p_inventory_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_world_locale_shops
  set inventory_notes = nullif(trim(coalesce(p_inventory_notes, '')), '')
  where id = p_shop_id;

  if not found then
    raise exception 'Locale shop not found.';
  end if;
end;
$$;

create or replace function public.dm_world_replace_locale_shop_inventory(
  p_shop_id uuid,
  p_generation_seed text,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.dm_world_locale_shops where id = p_shop_id) then
    raise exception 'Locale shop not found.';
  end if;

  delete from public.dm_world_locale_shop_inventory where locale_shop_id = p_shop_id;

  insert into public.dm_world_locale_shop_inventory (
    locale_shop_id,
    item_id,
    item_name,
    item_type,
    category,
    subcategory,
    rarity,
    description,
    source_type,
    source_book,
    price_source,
    shop_bucket,
    metadata_json,
    quantity,
    listed_price_gp,
    minimum_price_gp,
    barter_dc,
    sort_order
  )
  select
    p_shop_id,
    nullif(row_data->>'item_id', '')::uuid,
    coalesce(nullif(row_data->>'item_name', ''), 'Unknown Item'),
    nullif(row_data->>'item_type', ''),
    nullif(row_data->>'category', ''),
    nullif(row_data->>'subcategory', ''),
    nullif(row_data->>'rarity', ''),
    nullif(row_data->>'description', ''),
    nullif(row_data->>'source_type', ''),
    nullif(row_data->>'source_book', ''),
    nullif(row_data->>'price_source', ''),
    nullif(row_data->>'shop_bucket', ''),
    case
      when jsonb_typeof(row_data->'metadata_json') = 'object' then row_data->'metadata_json'
      else null
    end,
    greatest(1, coalesce((row_data->>'quantity')::integer, 1)),
    greatest(0, coalesce((row_data->>'listed_price_gp')::numeric, 0)),
    greatest(0, coalesce((row_data->>'minimum_price_gp')::numeric, 0)),
    greatest(0, coalesce((row_data->>'barter_dc')::integer, 0)),
    coalesce((row_data->>'sort_order')::integer, ordinality - 1)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(row_data, ordinality);

  update public.dm_world_locale_shops
  set
    generation_seed = coalesce(nullif(trim(p_generation_seed), ''), generation_seed, gen_random_uuid()::text),
    inventory_generated_at = now(),
    updated_at = now()
  where id = p_shop_id;
end;
$$;

create or replace function public.dm_world_upsert_npc(
  p_npc_id uuid,
  p_name text,
  p_race text,
  p_portrait_url text,
  p_body_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'NPC name is required.';
  end if;

  if p_npc_id is null then
    insert into public.dm_world_npcs (name, race, portrait_url, body_text)
    values (
      trim(p_name),
      nullif(trim(p_race), ''),
      nullif(trim(p_portrait_url), ''),
      nullif(trim(p_body_text), '')
    ) returning id into v_id;
  else
    update public.dm_world_npcs
    set
      name = trim(p_name),
      race = nullif(trim(p_race), ''),
      portrait_url = nullif(trim(p_portrait_url), ''),
      body_text = nullif(trim(p_body_text), '')
    where id = p_npc_id
    returning id into v_id;

    if v_id is null then
      raise exception 'NPC not found.';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.dm_world_get_locales_overview()
returns table (
  id uuid,
  name text,
  locale_type text,
  short_description text,
  districts_count bigint,
  shops_count bigint,
  notes_count integer,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.locale_type,
    l.short_description,
    coalesce(d.cnt, 0) as districts_count,
    coalesce(s.cnt, 0) as shops_count,
    (
      case when nullif(l.hidden_or_underbelly_notes, '') is not null then 1 else 0 end
      + case when nullif(l.free_notes, '') is not null then 1 else 0 end
      + case when nullif(l.notes, '') is not null then 1 else 0 end
    )::integer as notes_count,
    l.updated_at
  from public.dm_world_locales l
  left join (
    select locale_id, count(*) as cnt
    from public.dm_world_locale_districts
    group by locale_id
  ) d on d.locale_id = l.id
  left join (
    select locale_id, count(*) as cnt
    from public.dm_world_locale_shops
    group by locale_id
  ) s on s.locale_id = l.id
  order by l.updated_at desc;
$$;

create or replace function public.dm_world_get_locale_detail(p_locale_id uuid)
returns table (
  id uuid,
  name text,
  locale_type text,
  short_description text,
  politics_leadership text,
  purpose text,
  settlement_structure text,
  notable_features text,
  hidden_or_underbelly_notes text,
  free_notes text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  districts_count bigint,
  shops_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.locale_type,
    l.short_description,
    l.politics_leadership,
    l.purpose,
    l.settlement_structure,
    l.notable_features,
    l.hidden_or_underbelly_notes,
    l.free_notes,
    l.notes,
    l.created_at,
    l.updated_at,
    coalesce((select count(*) from public.dm_world_locale_districts d where d.locale_id = l.id), 0) as districts_count,
    coalesce((select count(*) from public.dm_world_locale_shops s where s.locale_id = l.id), 0) as shops_count
  from public.dm_world_locales l
  where l.id = p_locale_id
  limit 1;
$$;

create or replace function public.dm_world_get_locale_districts(p_locale_id uuid)
returns table (
  id uuid,
  locale_id uuid,
  name text,
  short_description text,
  atmosphere_or_identity text,
  notable_locations text,
  free_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    d.id,
    d.locale_id,
    d.name,
    d.short_description,
    d.atmosphere_or_identity,
    d.notable_locations,
    d.free_notes,
    d.created_at,
    d.updated_at
  from public.dm_world_locale_districts d
  where d.locale_id = p_locale_id
  order by d.updated_at desc;
$$;

create or replace function public.dm_world_get_locale_shops(p_locale_id uuid)
returns table (
  id uuid,
  locale_id uuid,
  district_id uuid,
  district_name text,
  shop_name text,
  shop_type text,
  affluence_tier text,
  proprietor_name text,
  proprietor_race text,
  proprietor_description text,
  exterior_description text,
  interior_description text,
  shop_notes text,
  inventory_notes text,
  generation_seed text,
  inventory_generated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  inventory_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.locale_id,
    s.district_id,
    d.name as district_name,
    s.shop_name,
    s.shop_type,
    s.affluence_tier,
    s.proprietor_name,
    s.proprietor_race,
    s.proprietor_description,
    s.exterior_description,
    s.interior_description,
    s.shop_notes,
    s.inventory_notes,
    s.generation_seed,
    s.inventory_generated_at,
    s.created_at,
    s.updated_at,
    coalesce((select count(*) from public.dm_world_locale_shop_inventory i where i.locale_shop_id = s.id), 0) as inventory_count
  from public.dm_world_locale_shops s
  left join public.dm_world_locale_districts d on d.id = s.district_id
  where s.locale_id = p_locale_id
  order by s.updated_at desc;
$$;

create or replace function public.dm_world_get_locale_shop_inventory(p_shop_id uuid)
returns table (
  id uuid,
  locale_shop_id uuid,
  item_id uuid,
  item_name text,
  item_type text,
  category text,
  subcategory text,
  rarity text,
  description text,
  source_type text,
  source_book text,
  price_source text,
  shop_bucket text,
  metadata_json jsonb,
  quantity integer,
  listed_price_gp numeric,
  minimum_price_gp numeric,
  barter_dc integer,
  sort_order integer
)
language sql
security definer
set search_path = public
as $$
  select
    i.id,
    i.locale_shop_id,
    i.item_id,
    i.item_name,
    i.item_type,
    i.category,
    i.subcategory,
    i.rarity,
    i.description,
    i.source_type,
    i.source_book,
    i.price_source,
    i.shop_bucket,
    i.metadata_json,
    i.quantity,
    i.listed_price_gp,
    i.minimum_price_gp,
    i.barter_dc,
    i.sort_order
  from public.dm_world_locale_shop_inventory i
  where i.locale_shop_id = p_shop_id
  order by i.sort_order asc;
$$;

create or replace function public.dm_world_get_npcs()
returns table (
  id uuid,
  name text,
  race text,
  portrait_url text,
  body_text text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    n.id,
    n.name,
    n.race,
    n.portrait_url,
    n.body_text,
    n.created_at,
    n.updated_at
  from public.dm_world_npcs n
  order by n.updated_at desc;
$$;

revoke all on function public.dm_world_upsert_locale(uuid, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.dm_world_set_locale_notes(uuid, text) from public;
revoke all on function public.dm_world_upsert_district(uuid, uuid, text, text, text, text, text) from public;
revoke all on function public.dm_world_upsert_locale_shop(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.dm_world_set_locale_shop_inventory_notes(uuid, text) from public;
revoke all on function public.dm_world_replace_locale_shop_inventory(uuid, text, jsonb) from public;
revoke all on function public.dm_world_upsert_npc(uuid, text, text, text, text) from public;
revoke all on function public.dm_world_get_locales_overview() from public;
revoke all on function public.dm_world_get_locale_detail(uuid) from public;
revoke all on function public.dm_world_get_locale_districts(uuid) from public;
revoke all on function public.dm_world_get_locale_shops(uuid) from public;
revoke all on function public.dm_world_get_locale_shop_inventory(uuid) from public;
revoke all on function public.dm_world_get_npcs() from public;

grant execute on function public.dm_world_upsert_locale(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.dm_world_set_locale_notes(uuid, text) to authenticated;
grant execute on function public.dm_world_upsert_district(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.dm_world_upsert_locale_shop(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.dm_world_set_locale_shop_inventory_notes(uuid, text) to authenticated;
grant execute on function public.dm_world_replace_locale_shop_inventory(uuid, text, jsonb) to authenticated;
grant execute on function public.dm_world_upsert_npc(uuid, text, text, text, text) to authenticated;
grant execute on function public.dm_world_get_locales_overview() to authenticated;
grant execute on function public.dm_world_get_locale_detail(uuid) to authenticated;
grant execute on function public.dm_world_get_locale_districts(uuid) to authenticated;
grant execute on function public.dm_world_get_locale_shops(uuid) to authenticated;
grant execute on function public.dm_world_get_locale_shop_inventory(uuid) to authenticated;
grant execute on function public.dm_world_get_npcs() to authenticated;
