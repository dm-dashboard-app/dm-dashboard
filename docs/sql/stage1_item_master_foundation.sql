-- Stage 1 item-master foundation for DM World shop system (2014 import lane)

create table if not exists public.item_master (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  name text not null,
  slug text not null unique,
  item_type text not null,
  category text,
  subcategory text,
  rarity text,
  requires_attunement boolean not null default false,
  description text,
  base_price_gp numeric,
  suggested_price_gp numeric,
  price_source text,
  source_type text not null,
  source_book text,
  source_slug text,
  rules_era text not null default '2014',
  is_shop_eligible boolean not null default true,
  shop_bucket text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_item_master_rules_era on public.item_master (rules_era);
create index if not exists idx_item_master_shop_eligible on public.item_master (is_shop_eligible);
create index if not exists idx_item_master_shop_bucket on public.item_master (shop_bucket);
create index if not exists idx_item_master_source_type on public.item_master (source_type);
create index if not exists idx_item_master_name on public.item_master (name);

create or replace function public.set_item_master_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_item_master_updated_at on public.item_master;
create trigger trg_item_master_updated_at
before update on public.item_master
for each row
execute function public.set_item_master_updated_at();

alter table public.item_master enable row level security;

revoke all on public.item_master from anon, authenticated;

drop policy if exists item_master_no_client_access on public.item_master;
create policy item_master_no_client_access
on public.item_master
for all
to anon, authenticated
using (false)
with check (false);
