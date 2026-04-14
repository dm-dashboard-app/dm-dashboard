const SHOP_TARGET_COUNTS = {
  blacksmith: 16,
  general_store: 20,
  apothecary: 14,
  magic_shop: 6,
};

const AFFLUENCE_PRICE_MULTIPLIER = {
  poor: 0.9,
  modest: 1,
  middle_class: 1.08,
  wealthy: 1.2,
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

const MAGIC_SHOP_TARGET_BY_AFFLUENCE = {
  poor: 4,
  modest: 5,
  middle_class: 7,
  wealthy: 9,
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
  return MAGIC_SHOP_TARGET_BY_AFFLUENCE[affluence] || SHOP_TARGET_COUNTS.magic_shop;
}

function computePricing(item = {}, { affluence = 'modest', shopType = 'general_store' } = {}) {
  const rarity = normalizeRarity(item.rarity);
  const anchor = Math.max(1, numericPrice(item) || rarityBaselinePrice(rarity));
  const affluenceMult = AFFLUENCE_PRICE_MULTIPLIER[affluence] || 1;
  const magicPremium = shopType === 'magic_shop' ? 1.2 : 1;
  const rarityPremium = rarity === 'legendary' ? 1.25 : rarity === 'very rare' ? 1.16 : rarity === 'rare' ? 1.1 : 1;
  const jitter = 0.96 + Math.random() * 0.15;

  const listedPriceGp = Math.max(1, Math.round(anchor * affluenceMult * magicPremium * rarityPremium * jitter));
  const floorFactor = shopType === 'magic_shop' ? 0.93 : affluence === 'poor' ? 0.78 : affluence === 'wealthy' ? 0.9 : 0.84;
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
    return (bucket === 'consumable' || bucket === 'healing' || name.includes('potion'))
      && (rarity === 'common' || rarity === 'uncommon');
  }

  return isShopTypeMundaneMatch(item, shopType);
}

export function generateShopRows(items = [], { shopType = 'general_store', affluence = 'modest' } = {}) {
  const targetRows = targetRowCount(shopType, affluence);
  const rarityWeights = (shopType === 'magic_shop' ? MAGIC_RARITY_WEIGHT_BY_AFFLUENCE : RARITY_WEIGHT_BY_AFFLUENCE)[affluence]
    || RARITY_WEIGHT_BY_AFFLUENCE.modest;
  const candidates = items.filter(item => isEligible(item, shopType));

  const initialWeightedPool = candidates
    .map(item => {
      const rarity = normalizeRarity(item.rarity);
      const rarityWeight = rarityWeights[rarity] ?? 0.2;
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
  const picked = [];
  const byId = new Map();

  for (let index = 0; index < targetRows; index += 1) {
    const item = weightedPick(weightedPool);
    if (!item) break;
    const poolIndex = weightedPool.findIndex(row => row.item.id === item.id);

    if (byId.has(item.id)) {
      const row = byId.get(item.id);
      const bucket = normalizeBucket(item.shop_bucket);
      const canStack = bucket === 'consumable' || String(item.name || '').toLowerCase().includes('ammunition');
      if (canStack) row.quantity += generateQuantity(item, shopType, affluence);
      if (poolIndex >= 0) weightedPool.splice(poolIndex, 1);
      continue;
    }

    const pricing = computePricing(item, { affluence, shopType });
    const row = {
      item_id: item.id,
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
      quantity: generateQuantity(item, shopType, affluence),
      ...pricing,
    };

    byId.set(item.id, row);
    picked.push(row);
    if (poolIndex >= 0) weightedPool.splice(poolIndex, 1);
  }

  return picked.sort((a, b) => a.item_name.localeCompare(b.item_name));
}
