-- World follow-up batch: player-facing world read access + NPC portrait upload path support.

alter table if exists public.dm_world_npcs
  add column if not exists portrait_path text;

drop function if exists public.dm_world_get_npcs();
drop function if exists public.player_world_get_npcs();

create or replace function public.dm_world_upsert_npc(
  p_npc_id uuid,
  p_name text,
  p_race text,
  p_portrait_url text,
  p_portrait_path text,
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
    insert into public.dm_world_npcs (name, race, portrait_url, portrait_path, body_text)
    values (
      trim(p_name),
      nullif(trim(p_race), ''),
      nullif(trim(p_portrait_url), ''),
      nullif(trim(p_portrait_path), ''),
      nullif(trim(p_body_text), '')
    ) returning id into v_id;
  else
    update public.dm_world_npcs
    set
      name = trim(p_name),
      race = nullif(trim(p_race), ''),
      portrait_url = nullif(trim(p_portrait_url), ''),
      portrait_path = nullif(trim(p_portrait_path), ''),
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

create or replace function public.dm_world_get_npcs()
returns table (
  id uuid,
  name text,
  race text,
  portrait_url text,
  portrait_path text,
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
    n.portrait_path,
    n.body_text,
    n.created_at,
    n.updated_at
  from public.dm_world_npcs n
  order by n.updated_at desc;
$$;

create or replace function public.player_world_get_locales_overview()
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
      case when nullif(l.free_notes, '') is not null then 1 else 0 end
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

create or replace function public.player_world_get_locale_detail(p_locale_id uuid)
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
    null::text as hidden_or_underbelly_notes,
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

create or replace function public.player_world_get_locale_districts(p_locale_id uuid)
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

create or replace function public.player_world_get_locale_shops(p_locale_id uuid)
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
    null::text as inventory_notes,
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

create or replace function public.player_world_get_npcs()
returns table (
  id uuid,
  name text,
  race text,
  portrait_url text,
  portrait_path text,
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
    n.portrait_path,
    n.body_text,
    n.created_at,
    n.updated_at
  from public.dm_world_npcs n
  order by n.updated_at desc;
$$;

revoke all on function public.dm_world_upsert_npc(uuid, text, text, text, text) from public;
revoke all on function public.dm_world_upsert_npc(uuid, text, text, text, text, text) from public;
revoke all on function public.dm_world_get_npcs() from public;
revoke all on function public.player_world_get_locales_overview() from public;
revoke all on function public.player_world_get_locale_detail(uuid) from public;
revoke all on function public.player_world_get_locale_districts(uuid) from public;
revoke all on function public.player_world_get_locale_shops(uuid) from public;
revoke all on function public.player_world_get_npcs() from public;

grant execute on function public.dm_world_upsert_npc(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.dm_world_get_npcs() to authenticated;

grant execute on function public.player_world_get_locales_overview() to anon, authenticated;
grant execute on function public.player_world_get_locale_detail(uuid) to anon, authenticated;
grant execute on function public.player_world_get_locale_districts(uuid) to anon, authenticated;
grant execute on function public.player_world_get_locale_shops(uuid) to anon, authenticated;
grant execute on function public.player_world_get_npcs() to anon, authenticated;
