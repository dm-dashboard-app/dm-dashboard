-- Stage 4 correction: in-app DM/admin item import RPC for shop catalog refresh.
-- This keeps write authority server-mediated and removes terminal-only dependency.

drop function if exists public.dm_import_item_master_rows(text, jsonb);

create or replace function public.dm_import_item_master_rows(
  p_import_mode text,
  p_rows jsonb,
  p_import_meta jsonb default '{}'::jsonb
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
  v_import_meta jsonb := coalesce(p_import_meta, '{}'::jsonb);
  v_source_layer text;
  v_source_layers text[];
  v_five_tools_expected_count integer;
  v_five_tools_valid_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if v_mode not in ('srd_2014', 'custom_seed_2014', 'five_tools_2014') then
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

  if v_mode = 'five_tools_2014' then
    v_source_layer := trim(coalesce(v_import_meta->>'source_layer', ''));
    if v_source_layer = '' then
      v_source_layer := '5etools_items_by_source_curated';
    end if;

    if v_source_layer = '5etools_items_by_source_curated_plus_generated' then
      v_source_layers := array[
        '5etools_items_by_source_curated',
        '5etools_items_by_source_curated_generated_canonical_enhancements'
      ];
    elsif v_source_layer = '5etools_items_by_source_curated' then
      v_source_layers := array['5etools_items_by_source_curated'];
    else
      raise exception 'five_tools_2014 import_meta source_layer must be 5etools_items_by_source_curated or 5etools_items_by_source_curated_plus_generated.';
    end if;

    if coalesce(v_import_meta->>'expected_active_row_count', '') !~ '^[0-9]+$' then
      raise exception 'five_tools_2014 import_meta expected_active_row_count must be a positive integer.';
    end if;
    v_five_tools_expected_count := (v_import_meta->>'expected_active_row_count')::integer;
    if coalesce(v_five_tools_expected_count, 0) <= 0 then
      raise exception 'five_tools_2014 expected_active_row_count must be > 0.';
    end if;

    with parsed as (
      select
        trim(coalesce(row_data->>'name', '')) as name,
        trim(coalesce(row_data->>'source_type', v_source_type)) as source_type,
        trim(coalesce(row_data->>'rules_era', '2014')) as rules_era,
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
        and coalesce(metadata_json->>'source_layer', '') = any (coalesce(v_source_layers, array[]::text[]))
    )
    select count(*)::integer
    into v_five_tools_valid_count
    from valid;

    if coalesce(v_five_tools_valid_count, 0) <> v_five_tools_expected_count then
      raise exception 'five_tools_2014 payload safety check failed: valid row count % does not match expected_active_row_count %.',
        coalesce(v_five_tools_valid_count, 0), v_five_tools_expected_count;
    end if;
  else
    v_source_layer := null;
    v_source_layers := null;
    v_five_tools_expected_count := null;
    v_five_tools_valid_count := null;
  end if;

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
      and (
        v_mode <> 'five_tools_2014'
        or coalesce(metadata_json->>'source_layer', '') = any (coalesce(v_source_layers, array[]::text[]))
      )
  ), five_tools_payload_keys as (
    select distinct external_key
    from valid
    where v_mode = 'five_tools_2014'
      and external_key <> ''
  ), five_tools_stale_demoted as (
    update public.item_master as im
    set
      is_shop_eligible = false,
      shop_bucket = 'catalog_noise_excluded',
      metadata_json = jsonb_set(
        coalesce(im.metadata_json, '{}'::jsonb),
        '{catalog_admission}',
        jsonb_build_object(
          'policy_version', '5etools_shop_admission_v2',
          'active_lane_decision', 'excluded_stale_after_reimport',
          'reason', 'no_longer_present_in_active_generated_artifact',
          'include_in_active_lane', false
        ),
        true
      )
    where v_mode = 'five_tools_2014'
      and v_five_tools_valid_count = v_five_tools_expected_count
      and im.source_type = v_source_type
      and coalesce(im.metadata_json->>'source_layer', '') = any (coalesce(v_source_layers, array[]::text[]))
      and im.external_key not in (select external_key from five_tools_payload_keys)
      and (
        im.is_shop_eligible = true
        or coalesce(im.shop_bucket, '') <> 'catalog_noise_excluded'
        or coalesce(im.metadata_json->'catalog_admission'->>'active_lane_decision', '') = ''
      )
    returning im.external_key
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
          and coalesce(excluded.metadata_json->>'mechanics_support', '') = 'phase1_supported'
          then 5
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
          and coalesce(item_master.metadata_json->>'mechanics_support', '') = 'phase1_supported'
          then 5
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

revoke all on function public.dm_import_item_master_rows(text, jsonb, jsonb) from public;
grant execute on function public.dm_import_item_master_rows(text, jsonb, jsonb) to authenticated;
