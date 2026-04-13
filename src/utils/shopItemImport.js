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

function buildFallbackDetail(indexRow = {}, kind = 'equipment') {
  const index = String(indexRow.index || '').trim();
  const name = String(indexRow.name || index || 'Unknown item').trim();
  return {
    index: index || slugify(name),
    name,
    url: indexRow.url || null,
    desc: ['Imported from upstream index because the detail endpoint is unavailable.'],
    metadata_fallback: true,
    metadata_fallback_reason: 'detail_endpoint_unavailable',
    equipment_category: kind === 'equipment' ? { name: 'Equipment' } : undefined,
  };
}

async function fetchAllDetails(indexPath, kind = 'equipment', onProgress = null) {
  const list = await fetchJson(indexPath);
  const rows = list?.results || [];
  const details = [];
  const degraded = [];
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
      const fallback = buildFallbackDetail(sourceRow, kind);
      details.push(fallback);
      degraded.push({
        index: sourceRow.index || null,
        name: sourceRow.name || null,
        url: sourceRow.url || null,
        reason: result.reason?.message || 'Unknown detail fetch failure.',
      });
    });
    if (onProgress) {
      onProgress(`Fetched ${Math.min(i + batch.length, rows.length)} / ${rows.length} ${indexPath.replace('/', '')} rows…${degraded.length ? ` (${degraded.length} fallback)` : ''}`);
    }
  }

  return {
    details,
    degraded,
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

function applyPricingOverlay(row, overlayByName) {
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
  for (const item of items) {
    const externalKey = String(item.external_key || '').trim();
    const sourceSlug = String(item.source_slug || '').trim();
    if (externalKey) map.set(externalKey, item);
    if (sourceSlug) map.set(`${IMPORT_SOURCE_TYPE}:${sourceSlug}`, item);
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
  const [equipmentResult, magicResult] = await Promise.all([
    fetchAllDetails('/equipment', 'equipment', onProgress),
    fetchAllDetails('/magic-items', 'magic', onProgress),
  ]);
  const equipmentDetails = equipmentResult.details || [];
  const magicDetails = magicResult.details || [];

  const imported = [
    ...equipmentDetails.map(detail => mapApiItem(detail, 'equipment')),
    ...magicDetails.map(detail => mapApiItem(detail, 'magic')),
  ].map(item => applyPricingOverlay(item, overlayByName));

  const rows = Array.from(new Map(imported.map(item => [item.external_key, item])).values());
  const degradedDetails = [...(equipmentResult.degraded || []), ...(magicResult.degraded || [])];
  return {
    rows,
    degradedDetails,
    degradedCount: degradedDetails.length,
    attemptedCount: Number(equipmentResult.total || 0) + Number(magicResult.total || 0),
    succeededCount: rows.length,
  };
}

export async function loadCustomSeedRows() {
  const response = await fetch('/data/shop_custom_items_seed_2014.json');
  if (!response.ok) throw new Error('Failed to load custom seed JSON.');
  const parsed = await response.json();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items;
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
