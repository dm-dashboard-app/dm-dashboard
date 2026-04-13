-- Stage 2 DM-only shops foundation (shop records + generated inventory rows)
-- Security posture: dm_shops/dm_shop_inventory are server-managed via SECURITY DEFINER RPCs.

create table if not exists public.dm_shops (
  id uuid primary key default gen_random_uuid(),
  shop_type text not null,
  affluence_tier text not null,
  generation_seed text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_shop_inventory (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.dm_shops(id) on delete cascade,
  item_id uuid not null references public.item_master(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  listed_price_gp numeric not null check (listed_price_gp >= 0),
  minimum_price_gp numeric not null check (minimum_price_gp >= 0),
  barter_dc integer not null check (barter_dc >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, item_id)
);

create index if not exists idx_dm_shops_updated_at on public.dm_shops(updated_at desc);
create index if not exists idx_dm_shop_inventory_shop on public.dm_shop_inventory(shop_id, sort_order);
create index if not exists idx_dm_shop_inventory_item on public.dm_shop_inventory(item_id);

create or replace function public.set_dm_shops_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dm_shops_updated_at on public.dm_shops;
create trigger trg_dm_shops_updated_at
before update on public.dm_shops
for each row
execute function public.set_dm_shops_updated_at();

alter table public.dm_shops enable row level security;
alter table public.dm_shop_inventory enable row level security;

-- Remove broad client table access.
revoke all on public.dm_shops from anon, authenticated;
revoke all on public.dm_shop_inventory from anon, authenticated;

drop policy if exists dm_shops_authenticated_rw on public.dm_shops;
drop policy if exists dm_shop_inventory_authenticated_rw on public.dm_shop_inventory;

create or replace function public.dm_list_shops()
returns table (
  id uuid,
  shop_type text,
  affluence_tier text,
  generation_seed text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.shop_type, s.affluence_tier, s.generation_seed, s.created_at, s.updated_at
  from public.dm_shops s
  order by s.updated_at desc;
$$;

create or replace function public.dm_get_shop_inventory(p_shop_id uuid)
returns table (
  id uuid,
  item_id uuid,
  quantity integer,
  listed_price_gp numeric,
  minimum_price_gp numeric,
  barter_dc integer,
  sort_order integer,
  item_name text,
  item_type text,
  category text,
  rarity text,
  description text,
  price_source text,
  shop_bucket text,
  source_type text,
  source_book text
)
language sql
security definer
set search_path = public
as $$
  select
    inv.id,
    inv.item_id,
    inv.quantity,
    inv.listed_price_gp,
    inv.minimum_price_gp,
    inv.barter_dc,
    inv.sort_order,
    im.name as item_name,
    im.item_type,
    im.category,
    im.rarity,
    im.description,
    im.price_source,
    im.shop_bucket,
    im.source_type,
    im.source_book
  from public.dm_shop_inventory inv
  join public.item_master im on im.id = inv.item_id
  where inv.shop_id = p_shop_id
  order by inv.sort_order asc;
$$;

create or replace function public.dm_save_shop(
  p_shop_type text,
  p_affluence_tier text,
  p_generation_seed text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  insert into public.dm_shops (shop_type, affluence_tier, generation_seed)
  values (p_shop_type, p_affluence_tier, p_generation_seed)
  returning id into v_shop_id;

  insert into public.dm_shop_inventory (
    shop_id,
    item_id,
    quantity,
    listed_price_gp,
    minimum_price_gp,
    barter_dc,
    sort_order
  )
  select
    v_shop_id,
    (row_data->>'item_id')::uuid,
    greatest(1, coalesce((row_data->>'quantity')::integer, 1)),
    greatest(0, coalesce((row_data->>'listed_price_gp')::numeric, 0)),
    greatest(0, coalesce((row_data->>'minimum_price_gp')::numeric, 0)),
    greatest(0, coalesce((row_data->>'barter_dc')::integer, 0)),
    coalesce((row_data->>'sort_order')::integer, ordinality - 1)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(row_data, ordinality);

  return v_shop_id;
end;
$$;

create or replace function public.dm_replace_shop_inventory(
  p_shop_id uuid,
  p_shop_type text,
  p_affluence_tier text,
  p_generation_seed text,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_shops
  set
    shop_type = p_shop_type,
    affluence_tier = p_affluence_tier,
    generation_seed = p_generation_seed,
    updated_at = now()
  where id = p_shop_id;

  delete from public.dm_shop_inventory where shop_id = p_shop_id;

  insert into public.dm_shop_inventory (
    shop_id,
    item_id,
    quantity,
    listed_price_gp,
    minimum_price_gp,
    barter_dc,
    sort_order
  )
  select
    p_shop_id,
    (row_data->>'item_id')::uuid,
    greatest(1, coalesce((row_data->>'quantity')::integer, 1)),
    greatest(0, coalesce((row_data->>'listed_price_gp')::numeric, 0)),
    greatest(0, coalesce((row_data->>'minimum_price_gp')::numeric, 0)),
    greatest(0, coalesce((row_data->>'barter_dc')::integer, 0)),
    coalesce((row_data->>'sort_order')::integer, ordinality - 1)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t(row_data, ordinality);
end;
$$;

revoke all on function public.dm_list_shops() from public;
revoke all on function public.dm_get_shop_inventory(uuid) from public;
revoke all on function public.dm_save_shop(text, text, text, jsonb) from public;
revoke all on function public.dm_replace_shop_inventory(uuid, text, text, text, jsonb) from public;

grant execute on function public.dm_list_shops() to authenticated;
grant execute on function public.dm_get_shop_inventory(uuid) to authenticated;
grant execute on function public.dm_save_shop(text, text, text, jsonb) to authenticated;
grant execute on function public.dm_replace_shop_inventory(uuid, text, text, text, jsonb) to authenticated;

-- Stage 2 generator reads item catalog from client (DM surface only).
revoke all on public.item_master from authenticated;
grant select on public.item_master to authenticated;

drop policy if exists item_master_authenticated_select on public.item_master;
create policy item_master_authenticated_select
on public.item_master
for select
to authenticated
using (true);
