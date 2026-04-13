const API_ROOT = 'https://www.dnd5eapi.co/api/2014';
const IMPORT_SOURCE_TYPE = 'official_srd_2014';
const IMPORT_SOURCE_BOOK = 'SRD 5.1 (2014)';
const RULES_ERA = '2014';
const PRICING_SOURCE = 'shop_magic_pricing_2014_overlay';

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

async function fetchJson(pathname) {
  const response = await fetch(`${API_ROOT}${pathname}`);
  if (!response.ok) throw new Error(`API request failed: ${pathname} (${response.status})`);
  return response.json();
}

async function fetchAllDetails(indexPath, onProgress = null) {
  const list = await fetchJson(indexPath);
  const rows = list?.results || [];
  const details = [];
  const batchSize = 20;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const loaded = await Promise.all(batch.map(row => fetchJson(row.url)));
    details.push(...loaded);
    if (onProgress) {
      onProgress(`Fetched ${Math.min(i + batch.length, rows.length)} / ${rows.length} ${indexPath.replace('/', '')} rows…`);
    }
  }

  return details;
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
  const slug = slugify(name);
  const requiresAttunement = parseAttunementFromName(name);
  const basePrice = kind === 'equipment' ? parseCostGp(detail.cost) : null;

  return {
    name,
    slug,
    item_type: deriveItemType(detail, kind),
    category: deriveCategory(detail, kind),
    subcategory: deriveSubcategory(detail, kind),
    rarity: detail.rarity?.name || detail.rarity || null,
    requires_attunement: requiresAttunement,
    description: buildDescription(detail),
    base_price_gp: basePrice,
    suggested_price_gp: basePrice,
    price_source: basePrice !== null ? 'srd_2014_base_cost' : null,
    source_type: IMPORT_SOURCE_TYPE,
    source_book: IMPORT_SOURCE_BOOK,
    source_slug: detail.index || slug,
    external_key: `${IMPORT_SOURCE_TYPE}:${detail.index || slug}`,
    rules_era: RULES_ERA,
    is_shop_eligible: true,
    shop_bucket: kind === 'magic' ? 'magic' : 'mundane',
    metadata_json: {
      api_index: detail.index || null,
      api_url: detail.url || null,
      kind,
      contents: detail.contents || null,
      properties: detail.properties || null,
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

export async function buildSrdImportRows(onProgress = null) {
  const overlayByName = await loadPricingOverlay();
  const [equipmentDetails, magicDetails] = await Promise.all([
    fetchAllDetails('/equipment', onProgress),
    fetchAllDetails('/magic-items', onProgress),
  ]);

  const imported = [
    ...equipmentDetails.map(detail => mapApiItem(detail, 'equipment')),
    ...magicDetails.map(detail => mapApiItem(detail, 'magic')),
  ].map(item => applyPricingOverlay(item, overlayByName));

  return Array.from(new Map(imported.map(item => [item.external_key, item])).values());
}

export async function loadCustomSeedRows() {
  const response = await fetch('/data/shop_custom_items_seed_2014.json');
  if (!response.ok) throw new Error('Failed to load custom seed JSON.');
  const parsed = await response.json();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items;
}
