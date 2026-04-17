import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_TYPE = 'custom_homebrew_private_seed';
const DEFAULT_RULES_ERA = '2014';
const SOURCE_LAYER_LABEL = '5etools_items_by_source_curated';

const WEAPON_TYPE_CODES = new Set(['M', 'R', 'A', 'AF']);
const ARMOR_TYPE_CODES = new Set(['LA', 'MA', 'HA', 'S']);
const TOOL_TYPE_CODES = new Set(['AT', 'INS', 'GS', 'T']);
const RING_TYPE_CODES = new Set(['RG']);
const ROD_TYPE_CODES = new Set(['RD']);
const WAND_TYPE_CODES = new Set(['WD']);
const STAFF_TYPE_CODES = new Set(['ST', 'SCF']);
const OVERLAY_PRICE_SOURCE = 'shop_magic_pricing_2014_overlay';
const FALLBACK_PRICE_SOURCE = '5etools_fallback_policy_v1';
const MANUAL_MAGIC_BUCKET = 'manual_magic_review';
const MANUAL_UNPRICED_BUCKET = 'manual_unpriced';
const HAZARDOUS_NON_DEFAULT_BUCKET = 'hazardous_non_default';
const CATALOG_ADMISSION_POLICY_VERSION = '5etools_shop_admission_v2';
const EXCLUDED_TYPE_CODE_FAMILIES = new Map([
  ['$G', 'gemstone_treasure_value_only'],
  ['$A', 'art_object_treasure_value_only'],
  ['$C', 'coin_denomination_economy_noise'],
  ['TG', 'trade_goods_economy_noise'],
  ['SHP', 'ships_not_default_catalog_stock'],
  ['AIR', 'airships_not_default_catalog_stock'],
  ['VEH', 'large_vehicles_not_default_catalog_stock'],
]);
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const PHASE1_ALLOWED_SLOTS = new Set(['armor', 'shield', 'main_hand', 'off_hand', 'neck', 'ring', 'inventory']);
const PHASE1_ALLOWED_ACTIVATION = new Set(['equip', 'attunement_only']);
const PHASE1_ALLOWED_EFFECT_TYPES = new Set([
  'flat_bonus',
  'ac_flat',
  'shield_ac_bonus',
  'spell_save_dc_bonus',
  'spell_attack_bonus',
  'ability_score_bonus',
  'ability_score_set_min',
  'all_saves_bonus',
  'saving_throw_bonus',
  'weapon_attack_bonus',
]);

const RARITY_FALLBACK_GP = {
  common: 100,
  uncommon: 500,
  rare: 5000,
  'very rare': 50000,
  legendary: 200000,
};

export function slugify(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function normalizePricingKey(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-{2,}/g, '-');
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

function normalizeRarity(value = '') {
  return String(value || '').trim().toLowerCase();
}

function parseAttunementFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'false' || normalized === 'no' || normalized === 'none') return false;
    return true;
  }
  return null;
}

function deriveAttunement(item = {}, description = '') {
  const directSignals = [
    item.reqAttune,
    item.requiresAttunement,
    item.requires_attunement,
    item?.mechanics?.requires_attunement,
    item?.metadata_json?.mechanics?.requires_attunement,
  ];

  for (const signal of directSignals) {
    const parsed = parseAttunementFlag(signal);
    if (parsed !== null) return parsed;
  }

  if (Array.isArray(item.reqAttuneTags) && item.reqAttuneTags.length > 0) return true;
  if (Array.isArray(item?.metadata_json?.req_attune_tags) && item.metadata_json.req_attune_tags.length > 0) return true;

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

function deriveSlotFamily(item = {}, name = '') {
  const typeCode = parseTypeCode(item);
  const loweredName = String(name || '').toLowerCase();
  if (item.weaponCategory || WEAPON_TYPE_CODES.has(typeCode) || ROD_TYPE_CODES.has(typeCode) || WAND_TYPE_CODES.has(typeCode) || STAFF_TYPE_CODES.has(typeCode)) return 'main_hand';
  if (typeCode === 'S') return 'shield';
  if (item.ac || ARMOR_TYPE_CODES.has(typeCode)) return 'armor';
  if (item.ring || RING_TYPE_CODES.has(typeCode)) return 'ring';
  if (loweredName.includes('amulet') || loweredName.includes('necklace')) return 'neck';
  return 'inventory';
}

function deriveAbilityEffects(item = {}) {
  const ability = item?.ability;
  if (!ability || typeof ability !== 'object') return [];
  const effects = [];

  if (ability.static && typeof ability.static === 'object') {
    ABILITY_KEYS.forEach((key) => {
      const min = Number(ability.static[key]);
      if (Number.isFinite(min) && min > 0) {
        effects.push({ type: 'ability_score_set_min', ability: key, min });
      }
    });
  }

  ABILITY_KEYS.forEach((key) => {
    const value = Number(ability[key]);
    if (Number.isFinite(value) && value !== 0) {
      effects.push({ type: 'ability_score_bonus', ability: key, value });
    }
  });

  return effects;
}

function isMechanicsPhase1Compatible(mechanics = {}, requiresAttunement = false) {
  if (!mechanics || typeof mechanics !== 'object') return false;
  const slot = String(mechanics.slot_family || '').toLowerCase();
  if (!slot || !PHASE1_ALLOWED_SLOTS.has(slot)) return false;
  const activation = String(mechanics.activation_mode || 'equip').toLowerCase();
  if (!activation || !PHASE1_ALLOWED_ACTIVATION.has(activation)) return false;

  if (requiresAttunement && mechanics.requires_attunement !== true) return false;
  if (!requiresAttunement && mechanics.requires_attunement === true) return false;

  const passive = Array.isArray(mechanics.passive_effects) ? mechanics.passive_effects : [];
  for (const effect of passive) {
    const type = String(effect?.type || '').toLowerCase();
    if (!type || !PHASE1_ALLOWED_EFFECT_TYPES.has(type)) return false;
  }

  return true;
}

function deriveMechanics(item = {}, requiresAttunement = false) {
  const passiveEffects = [];
  const slotFamily = deriveSlotFamily(item, item?.name);

  const weaponBonus = parseBonus(item.bonusWeapon);
  if (weaponBonus !== null) passiveEffects.push({ type: 'weapon_attack_bonus', value: weaponBonus });

  const acBonus = parseBonus(item.bonusAc);
  if (acBonus !== null) {
    if (slotFamily === 'shield') passiveEffects.push({ type: 'shield_ac_bonus', value: acBonus });
    else passiveEffects.push({ type: 'flat_bonus', target: 'ac', value: acBonus });
  }

  const spellAttackBonus = parseBonus(item.bonusSpellAttack);
  if (spellAttackBonus !== null) passiveEffects.push({ type: 'flat_bonus', target: 'spell_attack', value: spellAttackBonus });

  const spellSaveBonus = parseBonus(item.bonusSpellSaveDc);
  if (spellSaveBonus !== null) passiveEffects.push({ type: 'flat_bonus', target: 'spell_save_dc', value: spellSaveBonus });

  const allSavesBonus = parseBonus(item.bonusSavingThrow);
  if (allSavesBonus !== null) passiveEffects.push({ type: 'all_saves_bonus', value: allSavesBonus });

  if (!item.potion) passiveEffects.push(...deriveAbilityEffects(item));

  const charges = Number.isFinite(Number(item.charges))
    ? {
      max: Number(item.charges),
      recharge_amount: Number.isFinite(Number(item.rechargeAmount)) ? Number(item.rechargeAmount) : null,
    }
    : null;

  const recharge = item.recharge ? { text: String(item.recharge) } : null;

  if (!passiveEffects.length && !charges && !recharge) return null;

  return {
    slot_family: slotFamily,
    activation_mode: requiresAttunement && slotFamily === 'inventory' ? 'attunement_only' : 'equip',
    requires_attunement: requiresAttunement,
    passive_effects: passiveEffects,
    charges,
    recharge,
  };
}

function hasTrustworthyPrice(value) {
  if (value === null || value === undefined) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0;
}

function isClearlyMagicalItem(item = {}, row = {}) {
  const rarity = String(row.rarity || item.rarity || '').trim().toLowerCase();
  const itemType = String(row.item_type || '').trim();

  if (itemType === 'magic_item') return true;
  if (row.requires_attunement) return true;
  if (rarity && rarity !== 'none' && rarity !== 'unknown') return true;
  if (item.wondrous || item.staff || item.wand || item.rod || item.ring || item.potion || item.tattoo) return true;
  if (item.charges || item.recharge || item.reqAttune) return true;
  if (item.bonusWeapon || item.bonusAc || item.bonusSpellAttack || item.bonusSpellSaveDc) return true;

  return false;
}


function deriveCatalogAdmissionPolicy({ item = {}, row = {} } = {}) {
  const typeCode = parseTypeCode(item);
  const excludedFamily = EXCLUDED_TYPE_CODE_FAMILIES.get(typeCode);
  if (excludedFamily) {
    return {
      includeInActiveLane: false,
      policyDecision: 'excluded',
      reason: excludedFamily,
      bucket: 'catalog_noise_excluded',
    };
  }

  if (item.poison) {
    return {
      includeInActiveLane: true,
      policyDecision: 'demoted_non_shop',
      reason: 'hazardous_poison_non_default_stock',
      bucket: HAZARDOUS_NON_DEFAULT_BUCKET,
    };
  }

  if (typeCode === 'EXP') {
    return {
      includeInActiveLane: true,
      policyDecision: 'demoted_non_shop',
      reason: 'hazardous_explosive_non_default_stock',
      bucket: HAZARDOUS_NON_DEFAULT_BUCKET,
    };
  }

  return {
    includeInActiveLane: true,
    policyDecision: 'included',
    reason: 'default_adventuring_catalog_item',
    bucket: null,
  };
}

function applyCatalogAdmissionPolicy({ item = {}, row = {} } = {}) {
  const policy = deriveCatalogAdmissionPolicy({ item, row });
  const metadata = {
    ...(row.metadata_json || {}),
    catalog_admission: {
      policy_version: CATALOG_ADMISSION_POLICY_VERSION,
      active_lane_decision: policy.policyDecision,
      reason: policy.reason,
      include_in_active_lane: policy.includeInActiveLane,
    },
  };

  if (policy.policyDecision === 'demoted_non_shop') {
    return {
      ...row,
      is_shop_eligible: false,
      shop_bucket: policy.bucket,
      metadata_json: metadata,
    };
  }

  if (policy.policyDecision === 'excluded') {
    return {
      ...row,
      is_shop_eligible: false,
      shop_bucket: policy.bucket,
      metadata_json: metadata,
    };
  }

  return {
    ...row,
    metadata_json: metadata,
  };
}

function buildShopEligibility({ item = {}, row = {} } = {}) {
  const hasPrice = hasTrustworthyPrice(row.base_price_gp);
  if (isClearlyMagicalItem(item, row)) return { eligible: false, bucket: MANUAL_MAGIC_BUCKET };
  if (!hasPrice) return { eligible: false, bucket: MANUAL_UNPRICED_BUCKET };
  return { eligible: true, bucket: 'mundane' };
}

function buildPricingOverlayMap(pricingItems = []) {
  const map = new Map();
  const addKey = (key, item) => {
    const normalized = normalizePricingKey(key);
    if (!normalized) return;
    if (!map.has(normalized)) map.set(normalized, item);
  };

  (pricingItems || []).forEach((item) => {
    const name = String(item?.name || '').trim();
    const normalized = String(item?.normalized_name || '').trim();
    addKey(normalized, item);
    addKey(name, item);
  });

  return map;
}

function buildNameAliasCandidates(name = '') {
  const rawName = String(name || '').trim();
  if (!rawName) return [];
  const aliases = new Set([rawName]);

  const commaPlusMatch = rawName.match(/^(.+?),\s*\+(\d+)$/i);
  if (commaPlusMatch) {
    const base = commaPlusMatch[1].trim();
    const plus = commaPlusMatch[2].trim();
    aliases.add(`${base} +${plus}`);
    aliases.add(`${base} Plus ${plus}`);
    aliases.add(`+${plus} ${base}`);
    aliases.add(`Plus ${plus} ${base}`);
  }

  const leadingPlusMatch = rawName.match(/^\+(\d+)\s+(.+)$/i);
  if (leadingPlusMatch) {
    const plus = leadingPlusMatch[1].trim();
    const base = leadingPlusMatch[2].trim();
    aliases.add(`${base} +${plus}`);
    aliases.add(`${base} Plus ${plus}`);
    aliases.add(`${base}, +${plus}`);
  }

  const trailingPlusMatch = rawName.match(/^(.+?)\s+\+(\d+)$/i);
  if (trailingPlusMatch) aliases.add(`${trailingPlusMatch[1].trim()}, +${trailingPlusMatch[2].trim()}`);

  aliases.forEach((alias) => {
    const normalized = String(alias || '').replace(/\(each\)/ig, '').trim();
    if (normalized && normalized !== alias) aliases.add(normalized);
  });

  aliases.forEach((alias) => {
    const withoutParens = String(alias || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (withoutParens && withoutParens !== alias) aliases.add(withoutParens);
    const dePunctuated = String(alias || '').replace(/['’]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    if (dePunctuated && dePunctuated !== alias) aliases.add(dePunctuated);
  });

  return Array.from(aliases);
}

function resolvePricingOverlayMatch(name = '', overlayMap = new Map()) {
  const candidates = buildNameAliasCandidates(name);
  for (const candidate of candidates) {
    const found = overlayMap.get(normalizePricingKey(candidate));
    if (found) return found;
  }
  return null;
}

function deriveEnhancementBonus(item = {}, row = {}) {
  const parsedWeaponBonus = parseBonus(item?.bonusWeapon);
  if (parsedWeaponBonus !== null && parsedWeaponBonus > 0) return parsedWeaponBonus;
  const parsedSpellAttackBonus = parseBonus(item?.bonusSpellAttack);
  if (parsedSpellAttackBonus !== null && parsedSpellAttackBonus > 0) return parsedSpellAttackBonus;
  const parsedSpellSaveBonus = parseBonus(item?.bonusSpellSaveDc);
  if (parsedSpellSaveBonus !== null && parsedSpellSaveBonus > 0) return parsedSpellSaveBonus;
  const parsedAcBonus = parseBonus(item?.bonusAc);
  if (parsedAcBonus !== null && parsedAcBonus > 0) return parsedAcBonus;
  const name = String(row?.name || '').trim();
  const nameMatch = name.match(/(?:^|[,\s])\+(\d+)(?:$|\s|\))/);
  if (!nameMatch) return null;
  const bonus = Number(nameMatch[1]);
  return Number.isFinite(bonus) && bonus > 0 ? bonus : null;
}

function deriveFallbackPricing({ item = {}, row = {} } = {}) {
  const rarity = normalizeRarity(row.rarity || item.rarity || '');
  const bonus = deriveEnhancementBonus(item, row);
  const isMagic = isClearlyMagicalItem(item, row);
  const name = String(row?.name || '').trim();
  if (!isMagic) return null;

  if (row.item_type === 'weapon' && bonus && bonus <= 3) {
    const priceByBonus = { 1: 600, 2: 6000, 3: 50000 };
    return {
      priceGp: priceByBonus[bonus] || null,
      bucket: 'combat',
      reason: `enhancement_weapon_plus_${bonus}`,
      makeEligible: bonus <= 2 && !row.requires_attunement,
    };
  }

  if ((row.item_type === 'armor' || row.item_type === 'shield') && bonus && bonus <= 3) {
    const priceByBonus = { 1: 800, 2: 8000, 3: 60000 };
    return {
      priceGp: priceByBonus[bonus] || null,
      bucket: 'combat',
      reason: `enhancement_${row.item_type}_plus_${bonus}`,
      makeEligible: bonus <= 2 && !row.requires_attunement,
    };
  }

  if (row.item_type === 'magic_item' && bonus && bonus <= 3) {
    const priceByBonus = { 1: 500, 2: 5000, 3: 50000 };
    return {
      priceGp: priceByBonus[bonus] || null,
      bucket: 'utility',
      reason: `enhancement_magic_item_plus_${bonus}`,
      makeEligible: false,
    };
  }

  const spellScrollLevelMatch = name.match(/^Spell Scroll \((Cantrip|\d+(?:st|nd|rd|th) Level)\)$/i);
  if (spellScrollLevelMatch) {
    const levelLabel = spellScrollLevelMatch[1].toLowerCase();
    const priceByLevel = {
      cantrip: 50,
      '1st level': 100,
      '2nd level': 250,
      '3rd level': 500,
      '4th level': 2500,
      '5th level': 5000,
      '6th level': 15000,
      '7th level': 25000,
      '8th level': 50000,
      '9th level': 250000,
    };
    const priceGp = priceByLevel[levelLabel];
    if (priceGp) {
      return {
        priceGp,
        bucket: 'consumable',
        reason: `spell_scroll_${levelLabel.replace(/\s+/g, '_')}`,
        makeEligible: false,
      };
    }
  }

  const spellwroughtLevelMatch = name.match(/^Spellwrought Tattoo \((Cantrip|\d+(?:st|nd|rd|th) Level)\)$/i);
  if (spellwroughtLevelMatch) {
    const levelLabel = spellwroughtLevelMatch[1].toLowerCase();
    const priceByLevel = {
      cantrip: 75,
      '1st level': 150,
      '2nd level': 350,
      '3rd level': 700,
      '4th level': 5000,
      '5th level': 5000,
    };
    const priceGp = priceByLevel[levelLabel];
    if (priceGp) {
      return {
        priceGp,
        bucket: 'consumable',
        reason: `spellwrought_tattoo_${levelLabel.replace(/\s+/g, '_')}`,
        makeEligible: false,
      };
    }
  }

  const isConsumableFamily = !!(item.potion || item.poison || item.ammo || /potion|elixir|ammo|ammunition|arrow/i.test(String(row.name || '')));
  if (isConsumableFamily && (rarity === 'common' || rarity === 'uncommon')) {
    return {
      priceGp: rarity === 'common' ? 75 : 300,
      bucket: 'consumable',
      reason: `consumable_${rarity || 'unspecified'}`,
      makeEligible: true,
    };
  }

  if (row.item_type === 'tool' && rarity === 'common') {
    return {
      priceGp: 150,
      bucket: 'utility',
      reason: 'common_magic_tool',
      makeEligible: true,
    };
  }

  if ((row.item_type === 'magic_item' || row.item_type === 'equipment') && (rarity === 'common' || rarity === 'uncommon')) {
    const fallbackPrice = RARITY_FALLBACK_GP[rarity];
    if (fallbackPrice) {
      return {
        priceGp: fallbackPrice,
        bucket: 'utility',
        reason: `rarity_band_${rarity}`,
        makeEligible: rarity === 'common',
      };
    }
  }

  return null;
}

function applyPricingEnrichment({ item = {}, row = {}, pricingOverlayMap = new Map() } = {}) {
  if (hasTrustworthyPrice(row.base_price_gp)) {
    return {
      ...row,
      suggested_price_gp: row.base_price_gp,
      price_source: '5etools_value_cp',
      metadata_json: {
        ...(row.metadata_json || {}),
        pricing: {
          strategy: 'direct_source_value_cp',
          trusted: true,
        },
      },
    };
  }

  const overlay = resolvePricingOverlayMatch(row.name, pricingOverlayMap);
  if (overlay) {
    const excluded = !!overlay.exclude_from_shop;
    const rawOverlayPrice = overlay.suggested_price_gp;
    const overlayPrice = rawOverlayPrice === null || rawOverlayPrice === undefined
      ? null
      : (Number.isFinite(Number(rawOverlayPrice)) ? Number(rawOverlayPrice) : null);
    const makeEligible = !excluded && Number.isFinite(overlayPrice);
    return {
      ...row,
      base_price_gp: overlayPrice,
      suggested_price_gp: overlayPrice,
      price_source: OVERLAY_PRICE_SOURCE,
      rarity: overlay.rarity && String(overlay.rarity).toLowerCase() !== 'unspecified' ? overlay.rarity : row.rarity,
      is_shop_eligible: makeEligible,
      shop_bucket: excluded ? String(overlay.shop_bucket || MANUAL_MAGIC_BUCKET).trim() : (overlay.shop_bucket || 'manual_magic_review'),
      metadata_json: {
        ...(row.metadata_json || {}),
        pricing_overlay: {
          normalized_name: overlay.normalized_name || null,
          exclude_from_shop: excluded,
          exclusion_reason: overlay.exclusion_reason || '',
          notes: overlay.notes || '',
        },
        pricing: {
          strategy: 'curated_overlay_match',
          trusted: Number.isFinite(overlayPrice),
        },
      },
    };
  }

  const fallback = deriveFallbackPricing({ item, row });
  if (fallback?.priceGp && Number.isFinite(Number(fallback.priceGp))) {
    return {
      ...row,
      base_price_gp: Number(fallback.priceGp),
      suggested_price_gp: Number(fallback.priceGp),
      price_source: FALLBACK_PRICE_SOURCE,
      is_shop_eligible: !!fallback.makeEligible,
      shop_bucket: fallback.makeEligible ? fallback.bucket : MANUAL_MAGIC_BUCKET,
      metadata_json: {
        ...(row.metadata_json || {}),
        pricing: {
          strategy: 'fallback_policy',
          trusted: false,
          fallback_reason: fallback.reason || 'policy_default',
          fallback_bucket: fallback.bucket,
        },
      },
    };
  }

  return {
    ...row,
    base_price_gp: null,
    suggested_price_gp: null,
    price_source: null,
    is_shop_eligible: false,
    shop_bucket: isClearlyMagicalItem(item, row) ? MANUAL_MAGIC_BUCKET : MANUAL_UNPRICED_BUCKET,
    metadata_json: {
      ...(row.metadata_json || {}),
      pricing: {
        strategy: 'unresolved_manual_review',
        trusted: false,
      },
    },
  };
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
  const mechanics = deriveMechanics(item, requiresAttunement);
  const pricingOverlayMap = context.pricingOverlayMap instanceof Map ? context.pricingOverlayMap : new Map();
  const shop = buildShopEligibility({
    item,
    row: {
      item_type: itemType,
      rarity,
      requires_attunement: requiresAttunement,
      base_price_gp: toGpFromValueCp(item.value),
    },
  });
  const baseRow = {
    name,
    slug: `five-tools-${sourceItemSlug}`,
    item_type: itemType,
    category,
    subcategory,
    rarity,
    requires_attunement: requiresAttunement,
    description,
    base_price_gp: toGpFromValueCp(item.value),
    suggested_price_gp: toGpFromValueCp(item.value),
    price_source: toGpFromValueCp(item.value) !== null ? '5etools_value_cp' : null,
    source_type: SOURCE_TYPE,
    source_book: `${sourceKey} (5etools curated source split)`,
    source_slug: sourceItemSlug,
    external_key: `${SOURCE_LAYER_LABEL}:${sourceItemSlug}`,
    rules_era: DEFAULT_RULES_ERA,
    is_shop_eligible: shop.eligible,
    shop_bucket: shop.bucket,
    metadata_json: {
      import_quality: mechanics ? 'detail_verified_partial_mechanics' : 'detail_verified_manual',
      mechanics_support: mechanics
        ? (isMechanicsPhase1Compatible(mechanics, requiresAttunement) ? 'phase1_supported' : 'partial_supported')
        : 'manual_required',
      source_layer: SOURCE_LAYER_LABEL,
      source_key: sourceKey,
      source_filename: context.sourceFilename || null,
      source_page: Number.isFinite(Number(item.page)) ? Number(item.page) : null,
      source_record_hash_key: `${sourceKey}:${nameSlug}`,
      has_structured_entries: Array.isArray(item.entries),
      req_attune_raw: item.reqAttune ?? null,
      req_attune_tags: Array.isArray(item.reqAttuneTags) ? item.reqAttuneTags : [],
      mechanics,
    },
  };

  return applyCatalogAdmissionPolicy({
    item,
    row: applyPricingEnrichment({
      item,
      row: baseRow,
      pricingOverlayMap,
    }),
  });
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
  const overlayPath = path.resolve(path.dirname(manifestPath), '../../docs/data/shop_magic_pricing_2014.json');
  const overlayParsed = JSON.parse(await fs.readFile(overlayPath, 'utf8'));
  const pricingOverlayMap = buildPricingOverlayMap(Array.isArray(overlayParsed?.items) ? overlayParsed.items : []);
  const { manifest, loaded } = await loadSourceSplitItems({ manifestPath });
  const dedupeCounter = new Map();
  const rows = [];
  const excludedRows = [];
  let processedInputItems = 0;

  loaded.forEach((fileBundle) => {
    const sourceSlug = slugify(fileBundle.sourceKey);
    fileBundle.items.forEach((item) => {
      processedInputItems += 1;
      const baseNameSlug = slugify(item?.name || 'item');
      const dedupeKey = `${sourceSlug}:${baseNameSlug}`;
      const nextCount = (dedupeCounter.get(dedupeKey) || 0) + 1;
      dedupeCounter.set(dedupeKey, nextCount);
      const converted = convert5etoolsItemToImportRow(item, {
        sourceKey: fileBundle.sourceKey,
        sourceSlug,
        duplicateIndex: nextCount,
        sourceFilename: fileBundle.filename,
        pricingOverlayMap,
      });

      if (converted?.metadata_json?.catalog_admission?.active_lane_decision === 'excluded') {
        excludedRows.push(converted);
      } else {
        rows.push(converted);
      }
    });
  });

  const manifestDeclaredFiles = Number(manifest?.total_source_file_count || 0);
  const manifestDeclaredItems = Number(manifest?.total_item_count_represented || 0);
  if (manifestDeclaredFiles !== loaded.length) {
    throw new Error(`Manifest source count mismatch: expected ${manifestDeclaredFiles}, loaded ${loaded.length}.`);
  }
  if (manifestDeclaredItems !== processedInputItems) {
    throw new Error(`Manifest item count mismatch: expected ${manifestDeclaredItems}, processed ${processedInputItems}.`);
  }

  const excludedSummaryByReason = excludedRows.reduce((acc, row) => {
    const reason = String(row?.metadata_json?.catalog_admission?.reason || 'unspecified_exclusion').trim() || 'unspecified_exclusion';
    return { ...acc, [reason]: Number(acc[reason] || 0) + 1 };
  }, {});

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
    total_items_processed_from_sources: processedInputItems,
    total_items_excluded_from_active_lane: excludedRows.length,
    excluded_from_active_lane_by_reason: excludedSummaryByReason,
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
