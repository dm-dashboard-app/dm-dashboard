-- Stage 2 DM-only shops foundation (shop records + generated inventory rows)

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

revoke all on public.dm_shops from anon;
revoke all on public.dm_shop_inventory from anon;

grant select, insert, update, delete on public.dm_shops to authenticated;
grant select, insert, update, delete on public.dm_shop_inventory to authenticated;

-- DM app uses authenticated sessions; keep policy broad to match existing gameplay table model.
drop policy if exists dm_shops_authenticated_rw on public.dm_shops;
create policy dm_shops_authenticated_rw
on public.dm_shops
for all
to authenticated
using (true)
with check (true);

drop policy if exists dm_shop_inventory_authenticated_rw on public.dm_shop_inventory;
create policy dm_shop_inventory_authenticated_rw
on public.dm_shop_inventory
for all
to authenticated
using (true)
with check (true);

-- Stage 2 client UI needs catalog reads for generation and item detail.
revoke all on public.item_master from authenticated;
grant select on public.item_master to authenticated;

drop policy if exists item_master_authenticated_select on public.item_master;
create policy item_master_authenticated_select
on public.item_master
for select
to authenticated
using (true);
