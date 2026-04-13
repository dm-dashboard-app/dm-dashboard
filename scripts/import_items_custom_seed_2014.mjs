import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chunk, normalizeName, parseAttunementFromName, slugify } from './item_import_utils.mjs';

const DEFAULT_SOURCE_TYPE = 'custom_homebrew_private_seed';
const DEFAULT_SOURCE_BOOK = 'DM Dashboard Custom Seed';
const DEFAULT_RULES_ERA = '2014';
const DEFAULT_PRICE_SOURCE = 'custom_seed_curated';
const SEED_FILE = '../docs/data/shop_custom_items_seed_2014.json';

function readSeedFilePath() {
  const fileDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(fileDir, SEED_FILE);
}

function assertItem(item = {}, index = 0) {
  if (!item || typeof item !== 'object') throw new Error(`Seed item[${index}] must be an object.`);
  if (!String(item.name || '').trim()) throw new Error(`Seed item[${index}] is missing required field: name.`);
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toImportRow(item = {}, seedDefaults = {}) {
  const name = String(item.name || '').trim();
  const slug = slugify(item.slug || name);
  const sourceType = String(item.source_type || seedDefaults.source_type || DEFAULT_SOURCE_TYPE).trim();
  const sourceBook = String(item.source_book || seedDefaults.source_book || DEFAULT_SOURCE_BOOK).trim();
  const sourceSlug = String(item.source_slug || slug).trim();
  const rulesEra = String(item.rules_era || seedDefaults.rules_era || DEFAULT_RULES_ERA).trim();

  const basePrice = parseNumeric(item.base_price_gp);
  const suggestedPrice = parseNumeric(item.suggested_price_gp);
  const explicitAttunement = typeof item.requires_attunement === 'boolean' ? item.requires_attunement : null;

  return {
    name,
    slug,
    item_type: String(item.item_type || 'equipment').trim(),
    category: String(item.category || 'Equipment').trim(),
    subcategory: String(item.subcategory || '').trim() || null,
    rarity: String(item.rarity || 'common').trim(),
    requires_attunement: explicitAttunement ?? parseAttunementFromName(name),
    description: String(item.description || '').trim(),
    base_price_gp: basePrice,
    suggested_price_gp: suggestedPrice ?? basePrice,
    price_source: String(item.price_source || DEFAULT_PRICE_SOURCE).trim(),
    source_type: sourceType,
    source_book: sourceBook,
    source_slug: sourceSlug,
    rules_era: rulesEra,
    is_shop_eligible: item.is_shop_eligible === true,
    shop_bucket: String(item.shop_bucket || (item.is_shop_eligible ? 'custom' : 'manual')).trim(),
    metadata_json: {
      seed_type: 'custom_homebrew_private',
      normalized_name: normalizeName(name),
      ...(item.metadata_json && typeof item.metadata_json === 'object' ? item.metadata_json : {}),
    },
    external_key: `${sourceType}:${sourceSlug || slug}`,
  };
}

async function loadSeed() {
  const seedPath = readSeedFilePath();
  const text = await fs.readFile(seedPath, 'utf8');
  const parsed = JSON.parse(text);

  const defaults = {
    source_type: parsed?.source_type,
    source_book: parsed?.source_book,
    rules_era: parsed?.rules_era,
  };

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  items.forEach((item, idx) => assertItem(item, idx));

  return {
    seedPath,
    rows: items.map(item => toImportRow(item, defaults)),
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required import credentials. Set SUPABASE_URL (or REACT_APP_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. Anon/browser keys are not allowed for item import writes.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { seedPath, rows } = await loadSeed();
  const deduped = Array.from(new Map(rows.map(row => [row.external_key, row])).values());

  for (const part of chunk(deduped, 200)) {
    const { error } = await supabase.from('item_master').upsert(part, { onConflict: 'external_key' });
    if (error) throw error;
  }

  const eligible = deduped.filter(row => row.is_shop_eligible).length;
  const rules2014 = deduped.filter(row => row.rules_era === '2014').length;

  console.log(`Imported custom seed rows: ${deduped.length}`);
  console.log(`Shop-eligible rows: ${eligible}`);
  console.log(`2014 rows: ${rules2014}`);
  console.log(`Seed source: ${seedPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
