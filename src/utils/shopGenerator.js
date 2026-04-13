const SHOP_TARGET_COUNTS = {
  blacksmith: 16,
  general_store: 20,
  apothecary: 14,
  magic_shop: 8,
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

const SHOP_KEYWORDS = {
  blacksmith: ['weapon', 'armor', 'shield', 'ammo', 'smith', 'metal', 'martial'],
  general_store: ['adventuring', 'gear', 'tool', 'pack', 'kit', 'ration', 'utility', 'travel'],
  apothecary: ['potion', 'poison', 'healing', 'herbal', 'alchem', 'consumable'],
  magic_shop: ['magic', 'wondrous', 'scroll', 'wand', 'rod', 'ring', 'staff', 'potion'],
};

const EXCLUDED_BUCKETS = new Set(['excluded', 'manual', 'unpriced', 'gamechanging']);

function normalizeRarity(rarity = '') {
  const value = String(rarity || '').trim().toLowerCase();
  if (!value) return 'common';
  if (value.includes('very rare')) return 'very rare';
  if (value.includes('legendary')) return 'legendary';
  if (value.includes('rare')) return 'rare';
  if (value.includes('uncommon')) return 'uncommon';
  return 'common';
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

function scoreShopFit(item = {}, shopType) {
  const haystack = `${item.item_type || ''} ${item.category || ''} ${item.subcategory || ''} ${item.shop_bucket || ''} ${item.name || ''}`.toLowerCase();
  const keywords = SHOP_KEYWORDS[shopType] || [];
  let score = 1;
  keywords.forEach(keyword => {
    if (haystack.includes(keyword)) score += 1.6;
  });

  const isMagic = String(item.item_type || '').toLowerCase() === 'magic';
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
  const isMagic = String(item.item_type || '').toLowerCase() === 'magic';

  if (isMagic && rarity !== 'common') return 1;
  if (shopType === 'magic_shop') return rarity === 'common' ? 2 : 1;
  if (shopType === 'apothecary' && String(item.name || '').toLowerCase().includes('potion')) return affluence === 'wealthy' ? 4 : 3;
  if (shopType === 'general_store') return rarity === 'common' ? 2 + Math.floor(Math.random() * 3) : 1;
  if (shopType === 'blacksmith' && String(item.item_type || '').toLowerCase().includes('ammo')) return 6 + Math.floor(Math.random() * 7);

  return rarity === 'common' ? 1 + Math.floor(Math.random() * 2) : 1;
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

function isEligible(item = {}, shopType) {
  if (!item || item.rules_era !== '2014') return false;
  if (item.is_shop_eligible === false) return false;
  if (EXCLUDED_BUCKETS.has(String(item.shop_bucket || '').toLowerCase())) return false;

  const isMagic = String(item.item_type || '').toLowerCase() === 'magic';
  if (shopType === 'magic_shop') return isMagic;
  return true;
}

export function generateShopRows(items = [], { shopType = 'general_store', affluence = 'modest' } = {}) {
  const targetRows = SHOP_TARGET_COUNTS[shopType] || 20;
  const rarityWeights = RARITY_WEIGHT_BY_AFFLUENCE[affluence] || RARITY_WEIGHT_BY_AFFLUENCE.modest;
  const candidates = items.filter(item => isEligible(item, shopType));

  const weightedPool = candidates
    .map(item => {
      const rarity = normalizeRarity(item.rarity);
      const rarityWeight = rarityWeights[rarity] ?? 0.2;
      const fitWeight = scoreShopFit(item, shopType);
      return { item, weight: fitWeight * rarityWeight };
    })
    .filter(row => row.weight > 0);

  const picked = [];
  const byId = new Map();

  for (let index = 0; index < targetRows; index += 1) {
    const item = weightedPick(weightedPool);
    if (!item) break;

    if (byId.has(item.id)) {
      const row = byId.get(item.id);
      row.quantity += generateQuantity(item, shopType, affluence);
      continue;
    }

    const pricing = computePricing(item, { affluence, shopType });
    const row = {
      item_id: item.id,
      item_name: item.name,
      item_type: item.item_type,
      category: item.category,
      rarity: item.rarity,
      description: item.description,
      source_type: item.source_type,
      source_book: item.source_book,
      quantity: generateQuantity(item, shopType, affluence),
      ...pricing,
    };

    byId.set(item.id, row);
    picked.push(row);
  }

  return picked.sort((a, b) => a.item_name.localeCompare(b.item_name));
}
