const API_ROOT = 'https://www.dnd5eapi.co/api/2014';
const IMPORT_SOURCE_TYPE = 'official_srd_2014';
const IMPORT_SOURCE_BOOK = 'SRD 5.1 (2014)';
const RULES_ERA = '2014';
const PRICING_SOURCE = 'shop_magic_pricing_2014_overlay';
const REPAIR_SOURCE = 'shop_srd_degraded_repairs_2014_overlay';

function slugify(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function normalizeName(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttunementFromName(name = '') {
  return /\brequires attunement\b/i.test(String(name || ''));
}

function parseCostGp(cost) {
  if (!cost || !Number.isFinite(cost.quantity)) return null;
  const quantity = Number(cost.quantity);
  const unit = String(cost.unit || '').toLowerCase();
  if (unit === 'gp') return quantity;
  if (unit === 'sp') return quantity / 10;
  if (unit === 'cp') return quantity / 100;
  if (unit === 'ep') return quantity / 2;
  if (unit === 'pp') return quantity * 10;
  return null;
}

function resolveApiUrl(pathname = '') {
  const value = String(pathname || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/api/')) return `https://www.dnd5eapi.co${value}`;
  if (value.startsWith('/api/2014/')) return `https://www.dnd5eapi.co${value}`;
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${API_ROOT}${normalized}`;
}

function alternatePathCandidates(pathname = '') {
  const value = String(pathname || '').trim();
  if (!value || /^https?:\/\//i.test(value)) return [value];
  if (value.startsWith('/api/2014/')) return [value, value.replace('/api/2014/', '/api/')];
  if (value.startsWith('/api/')) return [value, `/api/2014${value.replace('/api', '')}`];
  return [value, value.startsWith('/') ? `/api/2014${value}` : `/api/2014/${value}`];
}

async function fetchJson(pathname) {
  const candidates = Array.from(new Set(alternatePathCandidates(pathname)));
  let lastError = null;
  for (const candidate of candidates) {
    const response = await fetch(resolveApiUrl(candidate));
    if (response.ok) return response.json();
    lastError = new Error(`API request failed: ${candidate} (${response.status})`);
  }
  throw lastError || new Error(`API request failed: ${pathname}`);
}

async function fetchAllDetails(indexPath, kind = 'equipment', onProgress = null) {
  const list = await fetchJson(indexPath);
  const rows = list?.results || [];
  const details = [];
  const fetchFailures = [];
  const batchSize = 20;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const loaded = await Promise.allSettled(batch.map(row => fetchJson(row.url)));
    loaded.forEach((result, index) => {
      const sourceRow = batch[index] || {};
      if (result.status === 'fulfilled') {
        details.push(result.value);
        return;
      }

      fetchFailures.push({
        index: sourceRow.index || null,
        name: sourceRow.name || null,
        url: sourceRow.url || null,
        reason: result.reason?.message || 'Unknown detail fetch failure.',
        kind,
      });
    });

    if (onProgress) {
      onProgress(
        `Fetched ${Math.min(i + batch.length, rows.length)} / ${rows.length} ${indexPath.replace('/', '')} rows…${fetchFailures.length ? ` (${fetchFailures.length} detail fetch failures)` : ''}`,
      );
    }
  }

  return {
    details,
    fetchFailures,
    total: rows.length,
  };
}

function deriveItemType(detail = {}, kind = 'equipment') {
  if (kind === 'magic') return 'magic_item';
  if (detail.weapon_category) return 'weapon';
  if (detail.armor_category) return 'armor';
  if (detail.gear_category?.name) return 'adventuring_gear';
  if (detail.tool_category) return 'tool';
  if (detail.vehicle_category) return 'vehicle';
  return 'equipment';
}

function deriveCategory(detail = {}, kind = 'equipment') {
  if (kind === 'magic') return 'magic';
  return detail.equipment_category?.name || 'Equipment';
}

function deriveSubcategory(detail = {}, kind = 'equipment') {
  if (kind === 'magic') return detail?.variant ? 'variant' : 'standard';
  return detail.weapon_category || detail.armor_category || detail.gear_category?.name || detail.tool_category || detail.vehicle_category || '';
}

function buildDescription(detail = {}) {
  const lines = [];
  if (Array.isArray(detail.desc)) lines.push(...detail.desc);
  if (detail.special?.length) lines.push(...detail.special);
  if (detail.contents?.length) {
    const contents = detail.contents.map(entry => `${entry.quantity}x ${entry.item?.name || 'item'}`).join(', ');
    lines.push(`Contents: ${contents}`);
  }
  return lines.join('\n\n').trim();
}

function mapApiItem(detail = {}, kind = 'equipment') {
  const name = String(detail.name || '').trim();
  const sourceSlug = String(detail.index || '').trim() || slugify(name);
  const slug = slugify(`${IMPORT_SOURCE_TYPE}-${sourceSlug}`);
  const requiresAttunement = parseAttunementFromName(name);
  const isDegradedFallback = !!detail.metadata_fallback;
  const sourceBasePrice = kind === 'equipment' ? parseCostGp(detail.cost) : null;
  const trustedBasePrice = !isDegradedFallback && Number.isFinite(sourceBasePrice) ? sourceBasePrice : null;

  return {
    name,
    slug,
    item_type: isDegradedFallback && kind === 'equipment' ? 'equipment_fallback' : deriveItemType(detail, kind),
    category: isDegradedFallback && kind === 'equipment' ? 'Fallback Equipment' : deriveCategory(detail, kind),
    subcategory: isDegradedFallback ? 'unclassified' : deriveSubcategory(detail, kind),
    rarity: detail.rarity?.name || detail.rarity || null,
    requires_attunement: requiresAttunement,
    description: buildDescription(detail),
    base_price_gp: trustedBasePrice,
    suggested_price_gp: trustedBasePrice,
    price_source: trustedBasePrice !== null ? 'srd_2014_base_cost' : (isDegradedFallback ? 'degraded_fallback_untrusted' : null),
    source_type: IMPORT_SOURCE_TYPE,
    source_book: IMPORT_SOURCE_BOOK,
    source_slug: sourceSlug,
    external_key: `${IMPORT_SOURCE_TYPE}:${sourceSlug}`,
    rules_era: RULES_ERA,
    is_shop_eligible: !isDegradedFallback,
    shop_bucket: isDegradedFallback ? 'fallback_quarantine' : (kind === 'magic' ? 'magic' : 'mundane'),
    metadata_json: {
      api_index: detail.index || null,
      api_url: detail.url || null,
      kind,
      contents: detail.contents || null,
      properties: detail.properties || null,
      degraded_import: isDegradedFallback,
      import_quality: isDegradedFallback ? 'degraded_fallback' : 'detail_verified',
      degraded_reason: isDegradedFallback ? String(detail.metadata_fallback_reason || 'detail_endpoint_unavailable') : null,
    },
  };
}


async function loadMechanicsEnrichmentOverlay() {
  const response = await fetch('/data/item_mechanics_enrichment_2014.json');
  if (!response.ok) return new Map();
  const parsed = await response.json();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const map = new Map();
  items.forEach((item) => {
    const externalKey = String(item?.external_key || '').trim();
    const sourceSlug = String(item?.source_slug || '').trim();
    if (externalKey) map.set(externalKey, item);
    if (sourceSlug) map.set(`${IMPORT_SOURCE_TYPE}:${sourceSlug}`, item);
  });
  return map;
}

function applyMechanicsEnrichment(row = {}, enrichmentMap = new Map()) {
  const externalKey = String(row.external_key || '').trim();
  const sourceSlug = String(row.source_slug || '').trim();
  const overlay = enrichmentMap.get(externalKey) || enrichmentMap.get(`${IMPORT_SOURCE_TYPE}:${sourceSlug}`);
  if (!overlay) return row;

  return {
    ...row,
    requires_attunement: typeof overlay.requires_attunement === 'boolean' ? overlay.requires_attunement : row.requires_attunement,
    metadata_json: {
      ...(row.metadata_json || {}),
      mechanics: {
        slot_family: overlay.slot_family || null,
        activation_mode: overlay.activation_mode || 'equip',
        requires_attunement: typeof overlay.requires_attunement === 'boolean' ? overlay.requires_attunement : row.requires_attunement,
        armor: overlay.armor || null,
        passive_effects: Array.isArray(overlay.passive_effects) ? overlay.passive_effects : [],
        charges: overlay.charges || null,
        recharge: overlay.recharge || null,
      },
      mechanics_enrichment_source: 'repo_item_mechanics_enrichment_2014',
    },
  };
}

function applyPricingOverlay(row, overlayByName) {
  const importQuality = String(row?.metadata_json?.import_quality || '').toLowerCase();
  const isDegraded = row?.metadata_json?.degraded_import === true
    || importQuality === 'degraded_fallback'
    || importQuality === 'degraded_import';
  if (isDegraded) return row;

  const overlay = overlayByName.get(normalizeName(row.name)) || overlayByName.get(row.slug);
  if (!overlay) return row;

  const excluded = !!overlay.exclude_from_shop;
  return {
    ...row,
    suggested_price_gp: overlay.suggested_price_gp ?? row.suggested_price_gp,
    price_source: PRICING_SOURCE,
    rarity: overlay.rarity || row.rarity,
    shop_bucket: overlay.shop_bucket || row.shop_bucket,
    is_shop_eligible: excluded ? false : row.is_shop_eligible,
    metadata_json: {
      ...(row.metadata_json || {}),
      pricing_overlay: {
        normalized_name: overlay.normalized_name || null,
        exclude_from_shop: excluded,
        exclusion_reason: overlay.exclusion_reason || '',
        notes: overlay.notes || '',
      },
    },
  };
}

async function loadPricingOverlay() {
  const response = await fetch('/data/shop_magic_pricing_2014.json');
  if (!response.ok) throw new Error('Failed to load magic pricing overlay JSON.');
  const parsed = await response.json();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const map = new Map();
  for (const item of items) {
    const normalized = normalizeName(item.normalized_name || item.name || '');
    if (normalized) map.set(normalized, item);
  }
  return map;
}

async function loadSrdRepairOverlay() {
  const response = await fetch('/data/shop_srd_degraded_repairs_2014.json');
  if (!response.ok) throw new Error('Failed to load degraded SRD repair overlay JSON.');
  const parsed = await response.json();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const map = new Map();

  const buildAliasKeys = (sourceSlug = '') => {
    const slug = String(sourceSlug || '').trim();
    if (!slug) return [];
    const aliases = new Set([slug]);

    const hornMatch = slug.match(/^horn-of-valhalla-(brass|bronze|iron|silver)$/);
    if (hornMatch) aliases.add(`${hornMatch[1]}-horn-of-valhalla`);
    const reverseHornMatch = slug.match(/^(brass|bronze|iron|silver)-horn-of-valhalla$/);
    if (reverseHornMatch) aliases.add(`horn-of-valhalla-${reverseHornMatch[1]}`);

    const elementalMatch = slug.match(/^ring-of-elemental-command-(air|earth|fire|water)$/);
    if (elementalMatch) aliases.add(`ring-of-${elementalMatch[1]}-elemental-command`);
    const reverseElementalMatch = slug.match(/^ring-of-(air|earth|fire|water)-elemental-command$/);
    if (reverseElementalMatch) aliases.add(`ring-of-elemental-command-${reverseElementalMatch[1]}`);

    if (slug === 'helm-of-comprehending-languages') aliases.add('helm-of-comprehend-languages');
    if (slug === 'helm-of-comprehend-languages') aliases.add('helm-of-comprehending-languages');

    if (slug === 'horseshoes-of-a-zephyr') aliases.add('horseshoes-of-the-zephyr');
    if (slug === 'horseshoes-of-the-zephyr') aliases.add('horseshoes-of-a-zephyr');

    return Array.from(aliases);
  };

  for (const item of items) {
    const externalKey = String(item.external_key || '').trim();
    const sourceSlug = String(item.source_slug || '').trim();
    if (externalKey) map.set(externalKey, item);
    if (sourceSlug) {
      const aliasKeys = buildAliasKeys(sourceSlug);
      aliasKeys.forEach(alias => {
        map.set(`${IMPORT_SOURCE_TYPE}:${alias}`, item);
      });
    }
  }
  return map;
}

function repairDescription(currentDescription = '', overlayDescription = '') {
  const overlay = String(overlayDescription || '').trim();
  if (overlay) return overlay;
  return String(currentDescription || '').trim();
}

function toNumericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasRepairShape(overlay = {}) {
  const itemType = String(overlay.item_type || '').trim();
  const category = String(overlay.category || '').trim();
  const subcategory = String(overlay.subcategory || '').trim();
  const price = toNumericOrNull(overlay.base_price_gp ?? overlay.suggested_price_gp);
  return !!itemType && !!category && !!subcategory && price !== null;
}

function isExplicitExclusion(overlay = {}) {
  return String(overlay.resolution_state || '').trim() === 'excluded_on_purpose';
}

function applyDegradedExclusionOverlay(row = {}, overlay = {}) {
  const metadata = row.metadata_json || {};
  return {
    ...row,
    item_type: String(overlay.item_type || row.item_type || 'magic_item').trim(),
    category: String(overlay.category || row.category || 'magic').trim(),
    subcategory: String(overlay.subcategory || row.subcategory || 'standard').trim(),
    base_price_gp: toNumericOrNull(overlay.base_price_gp),
    suggested_price_gp: toNumericOrNull(overlay.suggested_price_gp),
    price_source: REPAIR_SOURCE,
    shop_bucket: String(overlay.shop_bucket || 'excluded').trim(),
    is_shop_eligible: false,
    metadata_json: {
      ...metadata,
      degraded_import: false,
      import_quality: 'excluded_on_purpose',
      repaired_from_overlay: true,
      repaired_overlay_source: REPAIR_SOURCE,
      repaired_at: new Date().toISOString(),
      repaired_reason: String(overlay.repair_reason || 'overlay_curated_exclusion').trim(),
      degraded_reason: null,
      exclusion_reason: String(overlay.excluded_reason || 'no_curated_supported_shop_policy').trim(),
    },
  };
}

function applyDegradedRepairOverlay(row = {}, overlay = {}) {
  const repairedBasePrice = toNumericOrNull(overlay.base_price_gp);
  const repairedSuggestedPrice = toNumericOrNull(overlay.suggested_price_gp);
  const resolvedBasePrice = repairedBasePrice ?? toNumericOrNull(row.base_price_gp);
  const resolvedSuggestedPrice = repairedSuggestedPrice ?? repairedBasePrice ?? toNumericOrNull(row.suggested_price_gp) ?? resolvedBasePrice;
  const repairedDescription = repairDescription(row.description, overlay.description);
  const metadata = row.metadata_json || {};

  const repaired = {
    ...row,
    item_type: String(overlay.item_type || row.item_type || '').trim(),
    category: String(overlay.category || row.category || '').trim(),
    subcategory: String(overlay.subcategory || row.subcategory || '').trim(),
    description: repairedDescription,
    base_price_gp: resolvedBasePrice,
    suggested_price_gp: resolvedSuggestedPrice,
    price_source: REPAIR_SOURCE,
    shop_bucket: String(overlay.shop_bucket || 'mundane').trim(),
    is_shop_eligible: true,
    metadata_json: {
      ...metadata,
      degraded_import: false,
      import_quality: 'repaired_overlay_verified',
      repaired_from_overlay: true,
      repaired_overlay_source: REPAIR_SOURCE,
      repaired_at: new Date().toISOString(),
      repaired_reason: String(overlay.repair_reason || 'overlay_curated_repair').trim(),
      degraded_reason: null,
    },
  };

  return repaired;
}

export async function buildSrdImportRows(onProgress = null) {
  const overlayByName = await loadPricingOverlay();
  const mechanicsEnrichment = await loadMechanicsEnrichmentOverlay();
  const [equipmentResult, magicResult] = await Promise.all([
    fetchAllDetails('/equipment', 'equipment', onProgress),
    fetchAllDetails('/magic-items', 'magic', onProgress),
  ]);
  const equipmentDetails = equipmentResult.details || [];
  const magicDetails = magicResult.details || [];

  const imported = [
    ...equipmentDetails.map(detail => mapApiItem(detail, 'equipment')),
    ...magicDetails.map(detail => mapApiItem(detail, 'magic')),
  ].map(item => applyMechanicsEnrichment(applyPricingOverlay(item, overlayByName), mechanicsEnrichment));

  const rows = Array.from(new Map(imported.map(item => [item.external_key, item])).values());
  const fetchFailures = [...(equipmentResult.fetchFailures || []), ...(magicResult.fetchFailures || [])];
  return {
    rows,
    fetchFailures,
    fetchFailureCount: fetchFailures.length,
    attemptedCount: Number(equipmentResult.total || 0) + Number(magicResult.total || 0),
    succeededCount: rows.length,
  };
}

export async function loadCustomSeedRows() {
  const response = await fetch('/data/shop_custom_items_seed_2014.json');
  if (!response.ok) throw new Error('Failed to load custom seed JSON.');
  const parsed = await response.json();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const mechanicsEnrichment = await loadMechanicsEnrichmentOverlay();
  return items.map((row) => applyMechanicsEnrichment(row, mechanicsEnrichment));
}

export async function loadSrdDegradedReportRows() {
  const response = await fetch('/data/shop_srd_degraded_report_2014.json');
  if (!response.ok) throw new Error('Failed to load degraded SRD report JSON.');
  const parsed = await response.json();
  const rows = Array.isArray(parsed?.items) ? parsed.items : [];
  return {
    rows,
    generatedAt: parsed?.generated_at || null,
  };
}

export async function buildSrdRepairRows(existingRows = []) {
  const overlayMap = await loadSrdRepairOverlay();
  const degradedRows = (existingRows || []).filter(row => row?.metadata_json?.degraded_import === true);
  const repairedRows = [];
  const skippedRows = [];

  degradedRows.forEach(row => {
    const externalKey = String(row.external_key || '').trim();
    const sourceSlug = String(row.source_slug || '').trim();
    const overlay = overlayMap.get(externalKey) || overlayMap.get(`${IMPORT_SOURCE_TYPE}:${sourceSlug}`) || null;
    if (!overlay) {
      skippedRows.push({
        external_key: externalKey,
        source_slug: sourceSlug,
        reason: 'overlay_not_found',
      });
      return;
    }

    if (isExplicitExclusion(overlay)) {
      repairedRows.push(applyDegradedExclusionOverlay(row, overlay));
      return;
    }

    if (!hasRepairShape(overlay)) {
      skippedRows.push({
        external_key: externalKey,
        source_slug: sourceSlug,
        reason: 'overlay_missing_required_fields',
      });
      return;
    }

    repairedRows.push(applyDegradedRepairOverlay(row, overlay));
  });

  return {
    rows: repairedRows,
    degradedCount: degradedRows.length,
    repairedCount: repairedRows.length,
    skippedCount: skippedRows.length,
    skippedRows,
  };
}

export async function applySrdRepairsToImportRows(existingRows = []) {
  const repairResult = await buildSrdRepairRows(existingRows);
  if (!repairResult.repairedCount) {
    return {
      rows: existingRows,
      degradedCount: repairResult.degradedCount,
      repairedCount: 0,
      skippedCount: repairResult.skippedCount,
      skippedRows: repairResult.skippedRows,
    };
  }

  const repairedByKey = new Map(repairResult.rows.map(row => [String(row.external_key || '').trim(), row]));
  const mergedRows = (existingRows || []).map(row => {
    const externalKey = String(row?.external_key || '').trim();
    return repairedByKey.get(externalKey) || row;
  });

  return {
    rows: mergedRows,
    degradedCount: repairResult.degradedCount,
    repairedCount: repairResult.repairedCount,
    skippedCount: repairResult.skippedCount,
    skippedRows: repairResult.skippedRows,
  };
}
