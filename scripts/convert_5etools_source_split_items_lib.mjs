import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_TYPE = 'custom_homebrew_private_seed';
const DEFAULT_RULES_ERA = '2014';
const SOURCE_LAYER_LABEL = '5etools_items_by_source_curated';

const WEAPON_TYPE_CODES = new Set(['M', 'R', 'A', 'AF']);
const ARMOR_TYPE_CODES = new Set(['LA', 'MA', 'HA', 'S']);
const TOOL_TYPE_CODES = new Set(['AT', 'INS', 'GS', 'T']);

export function slugify(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function sanitizeInlineTags(text = '') {
  return String(text || '').replace(/\{@([^\s}]+)\s+([^}]+)\}/g, (_, tag, body) => {
    const pieces = String(body || '').split('|').map(part => part.trim()).filter(Boolean);
    if (!pieces.length) return '';
    const primary = pieces[0];
    if (tag === 'damage') return `${primary} damage`;
    if (tag === 'dc') return `DC ${primary}`;
    if (tag === 'condition') return primary;
    return primary;
  });
}

function renderEntry(entry, depth = 0) {
  if (entry === null || entry === undefined) return '';
  if (typeof entry === 'string') return sanitizeInlineTags(entry);
  if (Array.isArray(entry)) {
    return entry.map(value => renderEntry(value, depth + 1)).filter(Boolean).join('\n');
  }
  if (typeof entry !== 'object') return sanitizeInlineTags(String(entry));

  if (entry.type === 'list' && Array.isArray(entry.items)) {
    return entry.items.map(item => `- ${renderEntry(item, depth + 1)}`).join('\n');
  }

  if (entry.type === 'table' && Array.isArray(entry.rows)) {
    const labels = Array.isArray(entry.colLabels) ? entry.colLabels.map(label => renderEntry(label, depth + 1)).join(' | ') : '';
    const rows = entry.rows.map(row => Array.isArray(row)
      ? row.map(cell => renderEntry(cell, depth + 1)).join(' | ')
      : renderEntry(row, depth + 1));
    return [labels ? `Table: ${labels}` : 'Table', ...rows.map(row => `- ${row}`)].join('\n');
  }

  if (entry.entry) return renderEntry(entry.entry, depth + 1);
  if (entry.entries) {
    const heading = entry.name ? `${sanitizeInlineTags(entry.name)}:` : '';
    const body = renderEntry(entry.entries, depth + 1);
    return [heading, body].filter(Boolean).join('\n');
  }

  if (entry.name && entry.text) {
    return `${sanitizeInlineTags(entry.name)}: ${sanitizeInlineTags(entry.text)}`;
  }

  if (entry.name) return sanitizeInlineTags(entry.name);
  return sanitizeInlineTags(JSON.stringify(entry));
}

function flattenDescription(item = {}) {
  const blocks = [];
  if (Array.isArray(item.entries)) blocks.push(renderEntry(item.entries));
  if (Array.isArray(item.additionalEntries)) blocks.push(renderEntry(item.additionalEntries));
  if (Array.isArray(item.items)) blocks.push(renderEntry(item.items));
  return blocks.map(value => String(value || '').trim()).filter(Boolean).join('\n\n').trim();
}

function parseTypeCode(item = {}) {
  const raw = String(item.type || '').trim();
  return raw.includes('|') ? raw.split('|')[0].trim() : raw;
}

function deriveItemType(item = {}) {
  const typeCode = parseTypeCode(item);
  if (item.weaponCategory || item.dmg1 || WEAPON_TYPE_CODES.has(typeCode)) return 'weapon';
  if (item.ac || ARMOR_TYPE_CODES.has(typeCode)) return typeCode === 'S' ? 'shield' : 'armor';
  if (item.wondrous || item.staff || item.tattoo || item.reqAttune || item.charges || item.recharge || item.tier || (item.rarity && item.rarity !== 'none')) return 'magic_item';
  if (TOOL_TYPE_CODES.has(typeCode)) return 'tool';
  return 'equipment';
}

function deriveCategory(item = {}, itemType = 'equipment') {
  if (itemType === 'magic_item') return 'magic';
  if (itemType === 'weapon') return 'Weapon';
  if (itemType === 'armor' || itemType === 'shield') return 'Armor';
  if (itemType === 'tool') return 'Tool';
  return 'Equipment';
}

function deriveSubcategory(item = {}, itemType = 'equipment') {
  const typeCode = parseTypeCode(item);
  if (itemType === 'weapon') return String(item.weaponCategory || 'standard').trim();
  if (itemType === 'armor' || itemType === 'shield') return typeCode === 'S' ? 'Shield' : String(typeCode || 'Armor').trim();
  if (itemType === 'magic_item') {
    if (item.staff) return 'staff';
    if (item.wand) return 'wand';
    if (item.rod) return 'rod';
    if (item.ring) return 'ring';
    if (item.potion) return 'potion';
    if (item.wondrous) return 'wondrous';
    return 'standard';
  }
  return String(typeCode || '').trim() || null;
}

function parseRarity(item = {}) {
  const rarity = String(item.rarity || '').trim();
  if (!rarity || rarity.toLowerCase() === 'none') return null;
  return rarity;
}

function deriveAttunement(item = {}, description = '') {
  if (typeof item.reqAttune === 'boolean') return item.reqAttune;
  if (typeof item.reqAttune === 'string' && item.reqAttune.trim()) return true;
  return /requires attunement/i.test(description);
}

function toGpFromValueCp(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(value) / 100;
}

function parseBonus(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const match = text.match(/[-+]?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveMechanics(item = {}, requiresAttunement = false) {
  const passiveEffects = [];

  const weaponBonus = parseBonus(item.bonusWeapon);
  if (weaponBonus !== null) passiveEffects.push({ type: 'weapon_attack_bonus', value: weaponBonus });

  const acBonus = parseBonus(item.bonusAc);
  if (acBonus !== null) passiveEffects.push({ type: 'flat_bonus', target: 'ac', value: acBonus });

  const spellAttackBonus = parseBonus(item.bonusSpellAttack);
  if (spellAttackBonus !== null) passiveEffects.push({ type: 'flat_bonus', target: 'spell_attack', value: spellAttackBonus });

  const spellSaveBonus = parseBonus(item.bonusSpellSaveDc);
  if (spellSaveBonus !== null) passiveEffects.push({ type: 'flat_bonus', target: 'spell_save_dc', value: spellSaveBonus });

  const charges = Number.isFinite(Number(item.charges))
    ? {
      max: Number(item.charges),
      recharge_amount: Number.isFinite(Number(item.rechargeAmount)) ? Number(item.rechargeAmount) : null,
    }
    : null;

  const recharge = item.recharge ? { text: String(item.recharge) } : null;

  if (!passiveEffects.length && !charges && !recharge) return null;

  return {
    slot_family: item.weaponCategory ? 'main_hand' : (item.ac ? 'armor' : 'inventory'),
    activation_mode: 'equip',
    requires_attunement: requiresAttunement,
    passive_effects: passiveEffects,
    charges,
    recharge,
  };
}

function buildShopEligibility(row = {}) {
  const hasPrice = Number.isFinite(Number(row.base_price_gp));
  if (row.item_type === 'magic_item') return { eligible: false, bucket: 'manual_magic_review' };
  if (!hasPrice) return { eligible: false, bucket: 'manual_unpriced' };
  return { eligible: true, bucket: 'mundane' };
}

export function convert5etoolsItemToImportRow(item = {}, context = {}) {
  const sourceKey = String(context.sourceKey || item.source || 'UNKNOWN').trim() || 'UNKNOWN';
  const sourceSlug = String(context.sourceSlug || slugify(sourceKey)).trim() || 'unknown';
  const name = String(item.name || '').trim();
  const nameSlug = slugify(name);
  const duplicateIndex = Number(context.duplicateIndex || 1);
  const sourceItemSlug = duplicateIndex > 1 ? `${sourceSlug}-${nameSlug}-${duplicateIndex}` : `${sourceSlug}-${nameSlug}`;
  const description = flattenDescription(item);
  const itemType = deriveItemType(item);
  const category = deriveCategory(item, itemType);
  const subcategory = deriveSubcategory(item, itemType);
  const rarity = parseRarity(item);
  const requiresAttunement = deriveAttunement(item, description);
  const basePriceGp = toGpFromValueCp(item.value);
  const suggestedPriceGp = basePriceGp;
  const mechanics = deriveMechanics(item, requiresAttunement);
  const shop = buildShopEligibility({ item_type: itemType, base_price_gp: basePriceGp });

  return {
    name,
    slug: `five-tools-${sourceItemSlug}`,
    item_type: itemType,
    category,
    subcategory,
    rarity,
    requires_attunement: requiresAttunement,
    description,
    base_price_gp: basePriceGp,
    suggested_price_gp: suggestedPriceGp,
    price_source: basePriceGp !== null ? '5etools_value_cp' : null,
    source_type: SOURCE_TYPE,
    source_book: `${sourceKey} (5etools curated source split)`,
    source_slug: sourceItemSlug,
    external_key: `${SOURCE_LAYER_LABEL}:${sourceItemSlug}`,
    rules_era: DEFAULT_RULES_ERA,
    is_shop_eligible: shop.eligible,
    shop_bucket: shop.bucket,
    metadata_json: {
      import_quality: mechanics ? 'detail_verified_partial_mechanics' : 'detail_verified_manual',
      mechanics_support: mechanics ? 'partial_supported' : 'manual_required',
      source_layer: SOURCE_LAYER_LABEL,
      source_key: sourceKey,
      source_filename: context.sourceFilename || null,
      source_page: Number.isFinite(Number(item.page)) ? Number(item.page) : null,
      source_record_hash_key: `${sourceKey}:${nameSlug}`,
      has_structured_entries: Array.isArray(item.entries),
      req_attune_raw: item.reqAttune ?? null,
      mechanics,
    },
  };
}

export async function loadSourceSplitItems({
  manifestPath,
}) {
  const manifestText = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const baseDir = path.dirname(manifestPath);
  const loaded = [];

  for (const fileEntry of manifestFiles) {
    const filename = String(fileEntry?.filename || '').trim();
    if (!filename) continue;
    const filePath = path.resolve(baseDir, filename);
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected source file "${filename}" to contain an array of items.`);
    }
    loaded.push({
      sourceKey: String(fileEntry.source_key || '').trim() || slugify(filename).toUpperCase(),
      filename,
      items: parsed,
    });
  }

  return {
    manifest,
    loaded,
  };
}

export async function buildConverted5etoolsDataset({ manifestPath }) {
  const { manifest, loaded } = await loadSourceSplitItems({ manifestPath });
  const dedupeCounter = new Map();
  const rows = [];

  loaded.forEach((fileBundle) => {
    const sourceSlug = slugify(fileBundle.sourceKey);
    fileBundle.items.forEach((item) => {
      const baseNameSlug = slugify(item?.name || 'item');
      const dedupeKey = `${sourceSlug}:${baseNameSlug}`;
      const nextCount = (dedupeCounter.get(dedupeKey) || 0) + 1;
      dedupeCounter.set(dedupeKey, nextCount);
      rows.push(convert5etoolsItemToImportRow(item, {
        sourceKey: fileBundle.sourceKey,
        sourceSlug,
        duplicateIndex: nextCount,
        sourceFilename: fileBundle.filename,
      }));
    });
  });

  const manifestDeclaredFiles = Number(manifest?.total_source_file_count || 0);
  const manifestDeclaredItems = Number(manifest?.total_item_count_represented || 0);
  if (manifestDeclaredFiles !== loaded.length) {
    throw new Error(`Manifest source count mismatch: expected ${manifestDeclaredFiles}, loaded ${loaded.length}.`);
  }
  if (manifestDeclaredItems !== rows.length) {
    throw new Error(`Manifest item count mismatch: expected ${manifestDeclaredItems}, converted ${rows.length}.`);
  }

  return {
    source_type: SOURCE_TYPE,
    source_book: '5etools Curated Source-Split Items',
    rules_era: DEFAULT_RULES_ERA,
    generated_at: null,
    source_layer: SOURCE_LAYER_LABEL,
    source_manifest_path: path.relative(process.cwd(), manifestPath).replace(/\\/g, '/'),
    source_manifest_total_entries: Number(manifest?.total_source_file_count || 0),
    source_files_loaded: loaded.length,
    total_items_converted: rows.length,
    notes: [
      'Generated from resources/items_by_source/manifest.json and surviving source files only.',
      'Rows are mapped to DM Dashboard item import row shape for item_master pipeline import.',
      'Magic/unpriced rows remain importable but intentionally non-shop-eligible pending manual review.',
    ],
    items: rows,
  };
}

export function getDefaultPaths() {
  const fileDir = path.dirname(fileURLToPath(import.meta.url));
  return {
    manifestPath: path.resolve(fileDir, '../resources/items_by_source/manifest.json'),
    docsOutputPath: path.resolve(fileDir, '../docs/data/shop_5etools_items_source_split_2014.json'),
    publicOutputPath: path.resolve(fileDir, '../public/data/shop_5etools_items_source_split_2014.json'),
  };
}
