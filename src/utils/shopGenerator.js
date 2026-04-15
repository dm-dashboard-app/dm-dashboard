import { buildSpellScrollItem, getEligibleSpellsForLevel } from './spellScrolls';

const SHOP_TARGET_COUNTS = {
  blacksmith: 16,
  general_store: 20,
  apothecary: 14,
  magic_shop: 12,
};

const AFFLUENCE_PRICE_MULTIPLIER = {
  poor: 0.92,
  modest: 1,
  middle_class: 1.09,
  wealthy: 1.18,
};

const RARITY_WEIGHT_BY_AFFLUENCE = {
  poor: { common: 1.2, uncommon: 0.25, rare: 0.05, 'very rare': 0.01, legendary: 0 },
  modest: { common: 1, uncommon: 0.5, rare: 0.15, 'very rare': 0.03, legendary: 0 },
  middle_class: { common: 0.95, uncommon: 0.9, rare: 0.35, 'very rare': 0.08, legendary: 0.01 },
  wealthy: { common: 0.85, uncommon: 1.1, rare: 0.7, 'very rare': 0.2, legendary: 0.03 },
};

const MAGIC_RARITY_WEIGHT_BY_AFFLUENCE = {
  poor: { common: 1.55, uncommon: 0.35, rare: 0, 'very rare': 0, legendary: 0 },
  modest: { common: 1.35, uncommon: 0.7, rare: 0.08, 'very rare': 0, legendary: 0 },
  middle_class: { common: 1.1, uncommon: 1, rare: 0.32, 'very rare': 0.04, legendary: 0 },
  wealthy: { common: 0.9, uncommon: 1.05, rare: 0.75, 'very rare': 0.16, legendary: 0.01 },
};

const SHOP_KEYWORDS = {
  blacksmith: ['weapon', 'armor', 'shield', 'ammo', 'smith', 'metal', 'martial'],
  general_store: ['adventuring', 'gear', 'tool', 'pack', 'kit', 'ration', 'utility', 'travel'],
  apothecary: ['potion', 'poison', 'healing', 'herbal', 'alchem', 'consumable'],
  magic_shop: ['magic', 'wondrous', 'scroll', 'wand', 'rod', 'ring', 'staff', 'potion'],
};

const APOTHECARY_ALLOWED_TERMS = ['potion', 'poison', 'healing', 'herbal', 'alchem', 'antitoxin', 'healer', 'vial', 'flask'];
const BLACKSMITH_ALLOWED_TERMS = ['weapon', 'armor', 'shield', 'ammo', 'smith', 'metal', 'martial'];
const GENERAL_STORE_BLOCKLIST = ['vehicle', 'mount', 'ship', 'siege'];

const EXCLUDED_BUCKETS = new Set(['excluded', 'manual', 'unpriced', 'gamechanging', 'fallback_quarantine']);
const SPECIAL_BUCKETS = new Set(['special', 'artifact']);

const MAGIC_BUCKET_WEIGHT = {
  consumable: 1.45,
  utility: 1.35,
  noncombat: 1.25,
  healing: 1.2,
  magic: 1.1,
  combat: 0.74,
};

const HEALING_POTION_TIER_BY_NAME = {
  'potion of healing': 'basic',
  'potion of greater healing': 'greater',
  'potion of superior healing': 'superior',
  'potion of supreme healing': 'supreme',
};

const CORE_STOCK_AFFLUENCE_MULTIPLIER = {
  poor: 0.75,
  modest: 1,
  middle_class: 1.25,
  wealthy: 1.55,
};

const APOTHECARY_CORE_NAMES = [
  'Potion of Healing',
  'Potion of Greater Healing',
  "Healer's Kit",
  "Alchemist's Supplies",
  'Herbalism Kit',
];

const GENERAL_STORE_CORE_NAME_GROUPS = [
  ['Torch'],
  ['Rope, hempen (50 feet)', 'Hempen Rope (50 feet)', 'Rope, hempen'],
  ['Rations (1 day)', 'Rations'],
  ['Tent, Two-Person', 'Tent (Two-Person)', 'Tent'],
  ['Bedroll'],
];

const BLACKSMITH_ANCHOR_NAMES = ['Shield', "Smith's Tools"];
const BLACKSMITH_AMMO_TERMS = ['arrows', 'arrow', 'sling bullets', 'crossbow bolts', 'bolts'];

const CAMP_GEAR_TERMS = [
  'waterskin',
  'mess kit',
  'flint and steel',
  'tinderbox',
  'blanket',
  'grappling hook',
  'lantern',
  'piton',
  'hammer',
  'crowbar',
];

const SPELL_SCROLL_LEVEL_SOURCE_SLUGS = {
  1: 'spell-scroll-1st',
  2: 'spell-scroll-2nd',
  3: 'spell-scroll-3rd',
  4: 'spell-scroll-4th',
  5: 'spell-scroll-5th',
  6: 'spell-scroll-6th',
  7: 'spell-scroll-7th',
  8: 'spell-scroll-8th',
  9: 'spell-scroll-9th',
};

function getHealingPotionTier(item = {}) {
  const normalizedName = String(item.name || '').trim().toLowerCase();
  return HEALING_POTION_TIER_BY_NAME[normalizedName] || null;
}

function getShopIdentityKey(item = {}) {
  const healingTier = getHealingPotionTier(item);
  if (healingTier) return `healing:${healingTier}`;
  return `id:${item.id}`;
}

function normalizeRarity(rarity = '') {
  const value = String(rarity || '').trim().toLowerCase();
  if (!value) return 'common';
  if (value.includes('very rare')) return 'very rare';
  if (value.includes('legendary')) return 'legendary';
  if (value.includes('rare')) return 'rare';
  if (value.includes('uncommon')) return 'uncommon';
  return 'common';
}

function isMagicItem(item = {}) {
  const type = String(item.item_type || '').toLowerCase();
  return type === 'magic' || type === 'magic_item';
}

function numericPrice(item = {}) {
  return Number(item.suggested_price_gp ?? item.base_price_gp ?? 0) || 0;
}

function rarityBaselinePrice(rarity = 'common') {
  if (rarity === 'legendary') return 75000;
  if (rarity === 'very rare') return 10000;
  if (rarity === 'rare') return 2500;
  if (rarity === 'uncommon') return 250;
  return 25;
}

function itemHaystack(item = {}) {
  return `${item.item_type || ''} ${item.category || ''} ${item.subcategory || ''} ${item.shop_bucket || ''} ${item.name || ''}`.toLowerCase();
}

function scoreShopFit(item = {}, shopType) {
  const haystack = itemHaystack(item);
  const keywords = SHOP_KEYWORDS[shopType] || [];
  let score = 1;
  keywords.forEach(keyword => {
    if (haystack.includes(keyword)) score += 1.6;
  });

  const isMagic = isMagicItem(item);
  if (shopType === 'magic_shop') {
    score *= isMagic ? 3.5 : 0.05;
  } else if (isMagic) {
    score *= shopType === 'apothecary' && haystack.includes('potion') ? 0.55 : 0.08;
  }

  if (shopType === 'general_store' && haystack.includes('weapon')) score *= 0.35;
  if (shopType === 'blacksmith' && haystack.includes('potion')) score *= 0.25;
  if (shopType === 'apothecary' && haystack.includes('armor')) score *= 0.2;

  return Math.max(score, 0);
}

function normalizeBucket(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isDegradedFallback(item = {}) {
  return item.metadata_json?.degraded_import === true || String(item.metadata_json?.import_quality || '').toLowerCase() === 'degraded_fallback';
}

function getOverlayState(item = {}) {
  const bucket = normalizeBucket(item.shop_bucket);
  const overlay = item.metadata_json?.pricing_overlay || {};
  const exclusionReason = String(overlay.exclusion_reason || '').trim();
  const hasManualExclusion = !!overlay.exclude_from_shop || !!exclusionReason;
  const hasSuggestedPrice = Number.isFinite(Number(item.suggested_price_gp));

  return {
    bucket,
    excluded: hasManualExclusion || EXCLUDED_BUCKETS.has(bucket) || SPECIAL_BUCKETS.has(bucket),
    hasSuggestedPrice,
  };
}

function weightedPick(pool = []) {
  const total = pool.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const row of pool) {
    roll -= row.weight;
    if (roll <= 0) return row.item;
  }
  return pool[pool.length - 1]?.item || null;
}

function generateQuantity(item = {}, shopType, affluence) {
  const rarity = normalizeRarity(item.rarity);
  const isMagic = isMagicItem(item);

  if (isMagic && rarity !== 'common') return 1;
  if (shopType === 'magic_shop') return rarity === 'common' ? 2 : 1;
  if (shopType === 'apothecary' && String(item.name || '').toLowerCase().includes('potion')) return affluence === 'wealthy' ? 4 : 3;
  if (shopType === 'general_store') return rarity === 'common' ? 2 + Math.floor(Math.random() * 3) : 1;
  if (shopType === 'blacksmith' && String(item.item_type || '').toLowerCase().includes('ammo')) return 6 + Math.floor(Math.random() * 7);

  return rarity === 'common' ? 1 + Math.floor(Math.random() * 2) : 1;
}

function targetRowCount(shopType, affluence) {
  if (shopType !== 'magic_shop') return SHOP_TARGET_COUNTS[shopType] || 20;
  return SHOP_TARGET_COUNTS.magic_shop;
}

function computePricing(item = {}, { affluence = 'modest', shopType = 'general_store' } = {}) {
  const rarity = normalizeRarity(item.rarity);
  const anchor = Math.max(1, numericPrice(item) || rarityBaselinePrice(rarity));
  const affluenceMult = AFFLUENCE_PRICE_MULTIPLIER[affluence] || 1;
  const magicPremium = shopType === 'magic_shop' ? 1.2 : 1;
  const rarityPremium = rarity === 'legendary' ? 1.25 : rarity === 'very rare' ? 1.16 : rarity === 'rare' ? 1.1 : 1;
  const jitter = 0.98 + Math.random() * 0.11;

  const listedPriceGp = Math.max(1, Math.round(anchor * affluenceMult * magicPremium * rarityPremium * jitter));
  const floorFactor = shopType === 'magic_shop' ? 0.93 : affluence === 'poor' ? 0.8 : affluence === 'wealthy' ? 0.91 : 0.85;
  const minimumPriceGp = Math.max(1, Math.floor(listedPriceGp * floorFactor));

  const dcBase = shopType === 'magic_shop' ? 15 : 11;
  const affluenceDc = affluence === 'wealthy' ? 2 : affluence === 'poor' ? -1 : 0;
  const rarityDc = rarity === 'legendary' ? 7 : rarity === 'very rare' ? 5 : rarity === 'rare' ? 3 : rarity === 'uncommon' ? 1 : 0;
  const valueDc = Math.min(4, Math.floor(Math.log10(Math.max(10, listedPriceGp))));
  const barterDc = Math.max(8, Math.min(30, dcBase + affluenceDc + rarityDc + valueDc));

  return {
    listed_price_gp: listedPriceGp,
    minimum_price_gp: minimumPriceGp,
    barter_dc: barterDc,
  };
}

function isShopTypeMundaneMatch(item = {}, shopType) {
  const haystack = itemHaystack(item);

  if (shopType === 'apothecary') {
    return APOTHECARY_ALLOWED_TERMS.some(term => haystack.includes(term));
  }

  if (shopType === 'blacksmith') {
    return BLACKSMITH_ALLOWED_TERMS.some(term => haystack.includes(term));
  }

  if (shopType === 'general_store') {
    return !GENERAL_STORE_BLOCKLIST.some(term => haystack.includes(term));
  }

  return true;
}

function isEligible(item = {}, shopType) {
  if (!item || item.rules_era !== '2014') return false;
  if (item.is_shop_eligible === false) return false;
  if (isDegradedFallback(item)) return false;

  const overlayState = getOverlayState(item);
  if (overlayState.excluded) return false;

  const isMagic = isMagicItem(item);
  if (shopType === 'magic_shop') {
    if (!isMagic) return false;
    if (!overlayState.hasSuggestedPrice && normalizeRarity(item.rarity) !== 'common') return false;
    return true;
  }

  if (isMagic) {
    if (shopType !== 'apothecary') return false;
    const rarity = normalizeRarity(item.rarity);
    const name = String(item.name || '').toLowerCase();
    const bucket = overlayState.bucket;
    const isApothecaryStyle = bucket === 'consumable' || bucket === 'healing' || name.includes('potion');
    if (!isApothecaryStyle) return false;

    if (rarity === 'common' || rarity === 'uncommon') return true;
    return getHealingPotionTier(item) !== null;
  }

  return isShopTypeMundaneMatch(item, shopType);
}

function normalizeName(value = '') {
  return String(value || '').trim().toLowerCase();
}

function findByExactName(candidates = [], name = '') {
  const target = normalizeName(name);
  return candidates.find(item => normalizeName(item.name) === target) || null;
}

function hasAnyTerm(item = {}, terms = []) {
  const haystack = itemHaystack(item);
  return terms.some(term => haystack.includes(term));
}

function coreScaledQuantity(base, affluence, min = 1, max = 99) {
  const multiplier = CORE_STOCK_AFFLUENCE_MULTIPLIER[affluence] || 1;
  return Math.max(min, Math.min(max, Math.round(base * multiplier)));
}

function coreQuantity(item = {}, { shopType = 'general_store', affluence = 'modest', coreRole = 'default' } = {}) {
  if (item?.metadata_json?.spell_scroll === true) return 1;
  const name = normalizeName(item.name);

  if (shopType === 'apothecary') {
    if (name === 'potion of healing') return coreScaledQuantity(4, affluence, 2, 10);
    if (name === 'potion of greater healing') return coreScaledQuantity(2, affluence, 1, 6);
    return coreScaledQuantity(1, affluence, 1, 3);
  }

  if (shopType === 'blacksmith') {
    if (coreRole === 'ammo') return coreScaledQuantity(14, affluence, 8, 28);
    if (name === 'shield') return coreScaledQuantity(1, affluence, 1, 2);
    if (name === "smith's tools") return coreScaledQuantity(1, affluence, 1, 2);
    return 1;
  }

  if (shopType === 'general_store') {
    if (name.includes('ration')) return coreScaledQuantity(8, affluence, 4, 16);
    if (name.includes('torch')) return coreScaledQuantity(6, affluence, 3, 14);
    if (name.includes('rope')) return coreScaledQuantity(3, affluence, 1, 6);
    if (name.includes('tent')) return coreScaledQuantity(2, affluence, 1, 4);
    if (name.includes('bedroll')) return coreScaledQuantity(3, affluence, 1, 6);
    return coreScaledQuantity(2, affluence, 1, 5);
  }

  return generateQuantity(item, shopType, affluence);
}

function buildRow(item = {}, { shopType, affluence, stockLane = 'rotating', coreRole = 'default', coreOrder = null } = {}) {
  const pricing = computePricing(item, { affluence, shopType });
  const quantity = stockLane === 'core'
    ? coreQuantity(item, { shopType, affluence, coreRole })
    : generateQuantity(item, shopType, affluence);

  return {
    item_id: item.item_master_id || item.id,
    item_master_id: item.item_master_id || null,
    item_name: item.name,
    item_type: item.item_type,
    category: item.category,
    subcategory: item.subcategory,
    rarity: item.rarity,
    description: item.description,
    source_type: item.source_type,
    source_book: item.source_book,
    price_source: item.price_source,
    shop_bucket: item.shop_bucket,
    metadata_json: item.metadata_json || null,
    requires_attunement: item.requires_attunement ?? null,
    quantity,
    stock_lane: stockLane,
    is_core_stock: stockLane === 'core',
    core_order: coreOrder,
    ...pricing,
  };
}

function addCoreRow(item, context, state = {}, { coreRole = 'default' } = {}) {
  if (!item) return;
  const identityKey = getShopIdentityKey(item);
  if (state.byIdentity.has(identityKey)) return;
  const row = buildRow(item, { ...context, stockLane: 'core', coreRole, coreOrder: state.coreRows.length });
  state.byIdentity.set(identityKey, row);
  state.coreRows.push(row);
}

function pickOneFromPool(candidates = [], byIdentity = new Map()) {
  const pool = candidates.filter(item => !byIdentity.has(getShopIdentityKey(item)));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildCoreStock(candidates = [], { shopType = 'general_store', affluence = 'modest' } = {}) {
  const state = {
    byIdentity: new Map(),
    coreRows: [],
  };
  const context = { shopType, affluence };

  if (shopType === 'apothecary') {
    APOTHECARY_CORE_NAMES.forEach(name => addCoreRow(findByExactName(candidates, name), context, state));
    return state;
  }

  if (shopType === 'blacksmith') {
    BLACKSMITH_ANCHOR_NAMES.forEach(name => addCoreRow(findByExactName(candidates, name), context, state));

    const simplePool = candidates.filter(item => {
      const haystack = itemHaystack(item);
      return haystack.includes('simple') && haystack.includes('weapon');
    });
    addCoreRow(pickOneFromPool(simplePool, state.byIdentity), context, state);

    const martialPool = candidates.filter(item => {
      const haystack = itemHaystack(item);
      return haystack.includes('martial') && haystack.includes('weapon');
    });
    addCoreRow(pickOneFromPool(martialPool, state.byIdentity), context, state);

    const armorPool = candidates.filter(item => {
      const haystack = itemHaystack(item);
      return haystack.includes('armor') || haystack.includes('shield');
    });
    addCoreRow(pickOneFromPool(armorPool, state.byIdentity), context, state);

    const ammoPool = candidates.filter(item => hasAnyTerm(item, BLACKSMITH_AMMO_TERMS));
    ['arrows', 'sling bullets', 'crossbow bolts'].forEach(ammoName => {
      const matched = ammoPool.find(item => normalizeName(item.name).includes(ammoName));
      addCoreRow(matched, context, state, { coreRole: 'ammo' });
    });

    return state;
  }

  if (shopType === 'general_store') {
    GENERAL_STORE_CORE_NAME_GROUPS.forEach(group => {
      const matched = group
        .map(name => findByExactName(candidates, name))
        .find(Boolean);
      addCoreRow(matched, context, state);
    });

    const campPool = candidates.filter(item => hasAnyTerm(item, CAMP_GEAR_TERMS));
    const campCount = affluence === 'poor' ? 1 : affluence === 'wealthy' ? 2 : Math.random() < 0.55 ? 2 : 1;
    for (let index = 0; index < campCount; index += 1) {
      addCoreRow(pickOneFromPool(campPool, state.byIdentity), context, state);
    }

    return state;
  }

  return state;
}

function buildMagicCoreScrollStock(spells = [], { shopType = 'magic_shop', affluence = 'modest' } = {}) {
  const state = {
    byIdentity: new Map(),
    coreRows: [],
  };
  const context = { shopType, affluence };
  const spellScrollCatalogIdByLevel = buildSpellScrollCatalogIdByLevelMap(spells.catalogItems || []);

  [1, 2, 3, 4, 5].forEach(level => {
    const eligible = getEligibleSpellsForLevel(spells, level);
    if (eligible.length === 0) return;
    const selectedSpell = eligible[Math.floor(Math.random() * eligible.length)];
    addCoreRow(
      buildSpellScrollItem(selectedSpell, level, {
        assignableItemId: spellScrollCatalogIdByLevel.get(level) || null,
      }),
      context,
      state,
      { coreRole: `scroll-${level}` },
    );
  });

  return state;
}

function buildMagicRotatingScrollCandidates(spells = []) {
  const spellScrollCatalogIdByLevel = buildSpellScrollCatalogIdByLevelMap(spells.catalogItems || []);
  const rows = [];
  [6, 7, 8, 9].forEach(level => {
    const eligible = getEligibleSpellsForLevel(spells, level);
    eligible.forEach(spell => {
      rows.push(buildSpellScrollItem(spell, level, { assignableItemId: spellScrollCatalogIdByLevel.get(level) || null }));
    });
  });
  return rows;
}

function buildSpellScrollCatalogIdByLevelMap(items = []) {
  const map = new Map();
  (items || []).forEach((item) => {
    const sourceSlug = String(item?.source_slug || '').trim().toLowerCase();
    const matched = Object.entries(SPELL_SCROLL_LEVEL_SOURCE_SLUGS).find(([, slug]) => slug === sourceSlug);
    if (!matched || !item?.id) return;
    const level = Number(matched[0]);
    if (!map.has(level)) map.set(level, item.id);
  });
  return map;
}

export function generateShopRows(items = [], { shopType = 'general_store', affluence = 'modest', spells = [] } = {}) {
  const targetRows = targetRowCount(shopType, affluence);
  const rarityWeights = (shopType === 'magic_shop' ? MAGIC_RARITY_WEIGHT_BY_AFFLUENCE : RARITY_WEIGHT_BY_AFFLUENCE)[affluence]
    || RARITY_WEIGHT_BY_AFFLUENCE.modest;
  const baseCandidates = items.filter(item => isEligible(item, shopType));
  const spellContext = Object.assign([], spells, { catalogItems: items });
  const rotatingSpellCandidates = shopType === 'magic_shop' ? buildMagicRotatingScrollCandidates(spellContext) : [];
  const candidates = [...baseCandidates, ...rotatingSpellCandidates];

  const { byIdentity, coreRows } = shopType === 'magic_shop'
    ? buildMagicCoreScrollStock(spellContext, { shopType, affluence })
    : buildCoreStock(candidates, { shopType, affluence });

  const initialWeightedPool = candidates
    .filter(item => !byIdentity.has(getShopIdentityKey(item)))
    .map(item => {
      const rarity = normalizeRarity(item.rarity);
      const baseRarityWeight = rarityWeights[rarity] ?? 0.2;
      const rarityWeight = shopType === 'magic_shop' ? Math.max(0.05, baseRarityWeight) : baseRarityWeight;
      const fitWeight = scoreShopFit(item, shopType);
      const overlayState = getOverlayState(item);
      const magicBucketWeight = shopType === 'magic_shop'
        ? (MAGIC_BUCKET_WEIGHT[overlayState.bucket] ?? 0.88)
        : 1;
      const suggestedPriceWeight = shopType === 'magic_shop' && !overlayState.hasSuggestedPrice ? 0.55 : 1;
      return { item, weight: fitWeight * rarityWeight * magicBucketWeight * suggestedPriceWeight };
    })
    .filter(row => row.weight > 0);

  const weightedPool = [...initialWeightedPool];
  const rotatingRows = [];
  const targetRotatingCount = Math.max(0, targetRows - coreRows.length);

  for (let index = 0; index < targetRotatingCount; index += 1) {
    const item = weightedPick(weightedPool);
    if (!item) break;
    const poolIndex = weightedPool.findIndex(row => row.item.id === item.id);

    const shopIdentityKey = getShopIdentityKey(item);

    if (byIdentity.has(shopIdentityKey)) {
      const row = byIdentity.get(shopIdentityKey);
      const bucket = normalizeBucket(item.shop_bucket);
      const canStack = bucket === 'consumable' || String(item.name || '').toLowerCase().includes('ammunition');
      if (canStack && row.stock_lane !== 'core') row.quantity += generateQuantity(item, shopType, affluence);
      if (poolIndex >= 0) weightedPool.splice(poolIndex, 1);
      continue;
    }

    const row = buildRow(item, { shopType, affluence, stockLane: 'rotating' });
    byIdentity.set(shopIdentityKey, row);
    rotatingRows.push(row);
    if (poolIndex >= 0) weightedPool.splice(poolIndex, 1);
  }

  const sortedCoreRows = [...coreRows].sort((a, b) => {
    const orderA = Number.isFinite(a.core_order) ? a.core_order : 999;
    const orderB = Number.isFinite(b.core_order) ? b.core_order : 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.item_name.localeCompare(b.item_name);
  });
  const sortedRotatingRows = [...rotatingRows].sort((a, b) => a.item_name.localeCompare(b.item_name));

  return [...sortedCoreRows, ...sortedRotatingRows].map((row, index) => ({
    ...row,
    core_order: row.stock_lane === 'core' ? index : null,
  }));
}
