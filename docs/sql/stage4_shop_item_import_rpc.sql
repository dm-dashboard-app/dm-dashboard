-- Stage 4 correction: in-app DM/admin item import RPC for shop catalog refresh.
-- This keeps write authority server-mediated and removes terminal-only dependency.

create or replace function public.dm_import_item_master_rows(
  p_import_mode text,
  p_rows jsonb
)
returns table (
  import_mode text,
  imported_rows integer,
  shop_eligible_rows integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(p_import_mode, ''));
  v_source_type text;
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if v_mode not in ('srd_2014', 'custom_seed_2014') then
    raise exception 'Unsupported import mode: %', p_import_mode;
  end if;

  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'Import rows payload must be a JSON array.';
  end if;

  if jsonb_array_length(v_rows) > 5000 then
    raise exception 'Import payload too large. Limit: 5000 rows.';
  end if;

  v_source_type := case
    when v_mode = 'srd_2014' then 'official_srd_2014'
    else 'custom_homebrew_private_seed'
  end;

  with parsed as (
    select
      trim(coalesce(row_data->>'name', '')) as name,
      trim(coalesce(row_data->>'slug', '')) as slug,
      trim(coalesce(row_data->>'item_type', 'equipment')) as item_type,
      nullif(trim(coalesce(row_data->>'category', '')), '') as category,
      nullif(trim(coalesce(row_data->>'subcategory', '')), '') as subcategory,
      nullif(trim(coalesce(row_data->>'rarity', '')), '') as rarity,
      coalesce((row_data->>'requires_attunement')::boolean, false) as requires_attunement,
      nullif(trim(coalesce(row_data->>'description', '')), '') as description,
      nullif((row_data->>'base_price_gp')::numeric, null) as base_price_gp,
      nullif((row_data->>'suggested_price_gp')::numeric, null) as suggested_price_gp,
      nullif(trim(coalesce(row_data->>'price_source', '')), '') as price_source,
      trim(coalesce(row_data->>'source_type', v_source_type)) as source_type,
      nullif(trim(coalesce(row_data->>'source_book', '')), '') as source_book,
      nullif(trim(coalesce(row_data->>'source_slug', '')), '') as source_slug,
      trim(coalesce(row_data->>'rules_era', '2014')) as rules_era,
      coalesce((row_data->>'is_shop_eligible')::boolean, false) as is_shop_eligible,
      nullif(trim(coalesce(row_data->>'shop_bucket', '')), '') as shop_bucket,
      coalesce(row_data->'metadata_json', '{}'::jsonb) as metadata_json,
      trim(coalesce(row_data->>'external_key', '')) as external_key
    from jsonb_array_elements(v_rows) as t(row_data)
  ), valid as (
    select *
    from parsed
    where name <> ''
      and external_key <> ''
      and rules_era = '2014'
      and source_type = v_source_type
      and (
        v_mode <> 'srd_2014'
        or (
          coalesce((metadata_json->>'degraded_import')::boolean, false) = false
          and lower(coalesce(metadata_json->>'import_quality', '')) not in ('degraded_fallback', 'degraded_import')
          and coalesce(item_type, '') <> 'equipment_fallback'
          and coalesce(shop_bucket, '') <> 'fallback_quarantine'
          and coalesce(price_source, '') <> 'degraded_fallback_untrusted'
        )
      )
  ), upserted as (
    insert into public.item_master (
      external_key,
      name,
      slug,
      item_type,
      category,
      subcategory,
      rarity,
      requires_attunement,
      description,
      base_price_gp,
      suggested_price_gp,
      price_source,
      source_type,
      source_book,
      source_slug,
      rules_era,
      is_shop_eligible,
      shop_bucket,
      metadata_json
    )
    select
      external_key,
      name,
      coalesce(nullif(slug, ''), regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
      item_type,
      category,
      subcategory,
      rarity,
      requires_attunement,
      description,
      base_price_gp,
      suggested_price_gp,
      price_source,
      source_type,
      source_book,
      coalesce(source_slug, regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
      rules_era,
      is_shop_eligible,
      shop_bucket,
      metadata_json
    from valid
    on conflict (external_key)
    do update set
      name = excluded.name,
      slug = excluded.slug,
      item_type = excluded.item_type,
      category = excluded.category,
      subcategory = excluded.subcategory,
      rarity = excluded.rarity,
      requires_attunement = excluded.requires_attunement,
      description = excluded.description,
      base_price_gp = excluded.base_price_gp,
      suggested_price_gp = excluded.suggested_price_gp,
      price_source = excluded.price_source,
      source_type = excluded.source_type,
      source_book = excluded.source_book,
      source_slug = excluded.source_slug,
      rules_era = excluded.rules_era,
      is_shop_eligible = excluded.is_shop_eligible,
      shop_bucket = excluded.shop_bucket,
      metadata_json = excluded.metadata_json
    where (
      case
        when coalesce((excluded.metadata_json->>'degraded_import')::boolean, false)
          or lower(coalesce(excluded.metadata_json->>'import_quality', '')) = 'degraded_fallback'
          or coalesce(excluded.item_type, '') = 'equipment_fallback'
          or coalesce(excluded.shop_bucket, '') = 'fallback_quarantine'
          or coalesce(excluded.price_source, '') = 'degraded_fallback_untrusted'
          then 1
        when lower(coalesce(excluded.metadata_json->>'import_quality', '')) = 'excluded_on_purpose'
          then 2
        when lower(coalesce(excluded.metadata_json->>'import_quality', '')) = 'detail_verified'
          then 3
        when lower(coalesce(excluded.metadata_json->>'import_quality', '')) = 'repaired_overlay_verified'
          then 4
        else 3
      end
    ) >= (
      case
        when coalesce((item_master.metadata_json->>'degraded_import')::boolean, false)
          or lower(coalesce(item_master.metadata_json->>'import_quality', '')) = 'degraded_fallback'
          or coalesce(item_master.item_type, '') = 'equipment_fallback'
          or coalesce(item_master.shop_bucket, '') = 'fallback_quarantine'
          or coalesce(item_master.price_source, '') = 'degraded_fallback_untrusted'
          then 1
        when lower(coalesce(item_master.metadata_json->>'import_quality', '')) = 'excluded_on_purpose'
          then 2
        when lower(coalesce(item_master.metadata_json->>'import_quality', '')) = 'detail_verified'
          then 3
        when lower(coalesce(item_master.metadata_json->>'import_quality', '')) = 'repaired_overlay_verified'
          then 4
        else 3
      end
    )
    returning is_shop_eligible
  )
  select
    v_mode,
    count(*)::integer,
    count(*) filter (where is_shop_eligible)::integer
  into import_mode, imported_rows, shop_eligible_rows
  from upserted;

  return next;
end;
$$;

revoke all on function public.dm_import_item_master_rows(text, jsonb) from public;
grant execute on function public.dm_import_item_master_rows(text, jsonb) to authenticated;
