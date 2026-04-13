import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = 'https://www.dnd5eapi.co/api/2014';
const SOURCE_TYPE = 'official_srd_2014';
const SOURCE_BOOK = 'SRD 5.1 (2014)';

function slugify(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
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

function buildFallbackDetail(indexRow = {}, kind = 'equipment') {
  const index = String(indexRow.index || '').trim();
  const name = String(indexRow.name || index || 'Unknown item').trim();
  return {
    index: index || slugify(name),
    name,
    url: indexRow.url || null,
    metadata_fallback: true,
    metadata_fallback_reason: 'detail_endpoint_unavailable',
    equipment_category: kind === 'equipment' ? { name: 'Equipment' } : undefined,
  };
}

function mapFallbackRow(detail = {}, kind = 'equipment') {
  const name = String(detail.name || '').trim();
  const sourceSlug = String(detail.index || '').trim() || slugify(name);
  const sourceBasePrice = kind === 'equipment' ? parseCostGp(detail.cost) : null;

  return {
    external_key: `${SOURCE_TYPE}:${sourceSlug}`,
    source_slug: sourceSlug,
    name,
    attempted_url: detail.url || null,
    degraded_reason: String(detail.metadata_fallback_reason || 'detail_endpoint_unavailable'),
    fallback_item_type: kind === 'equipment' ? 'equipment_fallback' : deriveItemType(detail, kind),
    fallback_category: kind === 'equipment' ? 'Fallback Equipment' : deriveCategory(detail, kind),
    fallback_subcategory: kind === 'equipment' ? 'unclassified' : deriveSubcategory(detail, kind),
    fallback_is_shop_eligible: false,
    fallback_shop_bucket: 'fallback_quarantine',
    fallback_base_price_gp: Number.isFinite(sourceBasePrice) ? sourceBasePrice : null,
    fallback_suggested_price_gp: Number.isFinite(sourceBasePrice) ? sourceBasePrice : null,
    fallback_price_source: Number.isFinite(sourceBasePrice) ? 'srd_2014_base_cost' : 'degraded_fallback_untrusted',
    source_type: SOURCE_TYPE,
    source_book: SOURCE_BOOK,
    rules_era: '2014',
  };
}

async function fetchDegradedRows(indexPath, kind = 'equipment') {
  const list = await fetchJson(indexPath);
  const rows = list?.results || [];
  const degraded = [];
  const batchSize = 20;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const loaded = await Promise.allSettled(batch.map(row => fetchJson(row.url)));

    loaded.forEach((result, index) => {
      if (result.status === 'fulfilled') return;
      const sourceRow = batch[index] || {};
      degraded.push(mapFallbackRow(buildFallbackDetail(sourceRow, kind), kind));
    });
  }

  return degraded;
}

async function loadRepairOverlayMap(fileDir) {
  const overlayPath = path.resolve(fileDir, '../docs/data/shop_srd_degraded_repairs_2014.json');
  const text = await fs.readFile(overlayPath, 'utf8');
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const map = new Map();
  for (const item of items) {
    const key = String(item.external_key || '').trim();
    const slug = String(item.source_slug || '').trim();
    if (key) map.set(key, true);
    if (slug) map.set(`${SOURCE_TYPE}:${slug}`, true);
  }
  return map;
}

async function writeReport(report, fileDir) {
  const docsPath = path.resolve(fileDir, '../docs/data/shop_srd_degraded_report_2014.json');
  const publicPath = path.resolve(fileDir, '../public/data/shop_srd_degraded_report_2014.json');
  const payload = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(docsPath, payload, 'utf8');
  await fs.writeFile(publicPath, payload, 'utf8');
  return { docsPath, publicPath };
}

async function main() {
  const fileDir = path.dirname(fileURLToPath(import.meta.url));
  const repairOverlayMap = await loadRepairOverlayMap(fileDir);

  const degradedRows = [
    ...(await fetchDegradedRows('/equipment', 'equipment')),
    ...(await fetchDegradedRows('/magic-items', 'magic')),
  ];

  const deduped = Array.from(new Map(degradedRows.map(row => [row.external_key, row])).values()).map(row => ({
    ...row,
    has_repair_overlay: repairOverlayMap.has(row.external_key),
  }));

  const report = {
    version: '2026-04-13',
    generated_at: new Date().toISOString(),
    source: 'shopItemImport degraded fallback detection path (equipment + magic-items detail fetch failures)',
    item_count: deduped.length,
    overlay_covered_count: deduped.filter(row => row.has_repair_overlay).length,
    unresolved_count: deduped.filter(row => !row.has_repair_overlay).length,
    items: deduped,
  };

  const written = await writeReport(report, fileDir);
  console.log(`Wrote degraded report: ${written.docsPath}`);
  console.log(`Wrote degraded report mirror: ${written.publicPath}`);
  console.log(`Needs-repair rows: ${report.item_count} (${report.overlay_covered_count} overlay-covered / ${report.unresolved_count} unresolved)`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
