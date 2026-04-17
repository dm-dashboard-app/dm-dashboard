import { generateShopRows } from './shopGenerator';

function baseItem(overrides = {}) {
  return {
    id: overrides.id || `item-${Math.random()}`,
    name: 'Item',
    item_type: 'adventuring_gear',
    category: 'Adventuring Gear',
    subcategory: 'kit',
    rarity: 'Common',
    description: '',
    source_type: 'official_srd_2014',
    source_book: 'SRD 5.1 (2014)',
    price_source: 'srd_2014_base_cost',
    shop_bucket: 'mundane',
    suggested_price_gp: 10,
    rules_era: '2014',
    is_shop_eligible: true,
    metadata_json: {},
    ...overrides,
  };
}

function withFixedRandom(value, callback) {
  const spy = jest.spyOn(Math, 'random').mockReturnValue(value);
  try {
    return callback();
  } finally {
    spy.mockRestore();
  }
}

describe('generateShopRows', () => {
  test('excludes degraded fallback rows even when legacy rows are marked eligible', () => {
    const rows = generateShopRows([
      baseItem({
        id: 'degraded',
        name: 'Galley',
        item_type: 'equipment_fallback',
        category: 'Fallback Equipment',
        shop_bucket: 'fallback_quarantine',
        metadata_json: { degraded_import: true, import_quality: 'degraded_fallback' },
      }),
      baseItem({ id: 'normal', name: 'Rations', category: 'Adventuring Gear' }),
    ], { shopType: 'general_store', affluence: 'modest' });

    expect(rows.some(row => row.item_name === 'Galley')).toBe(false);
    expect(rows.some(row => row.item_name === 'Rations')).toBe(true);
  });

  test('apothecary includes guaranteed core stock and places core rows first', () => {
    const rows = withFixedRandom(0.01, () => generateShopRows([
      baseItem({ id: 'p-heal', name: 'Potion of Healing', item_type: 'magic_item', shop_bucket: 'healing', suggested_price_gp: 50 }),
      baseItem({ id: 'p-greater', name: 'Potion of Greater Healing', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Uncommon', suggested_price_gp: 150 }),
      baseItem({ id: 'healer-kit', name: "Healer's Kit", subcategory: 'healer kit', suggested_price_gp: 5 }),
      baseItem({ id: 'alc-sup', name: "Alchemist's Supplies", category: 'Tools', suggested_price_gp: 50 }),
      baseItem({ id: 'herb-kit', name: 'Herbalism Kit', category: 'Tools', suggested_price_gp: 5 }),
      baseItem({ id: 'bonus', name: 'Antitoxin (vial)', category: 'Adventuring Gear', suggested_price_gp: 50 }),
    ], { shopType: 'apothecary', affluence: 'modest' }));

    expect(rows.slice(0, 5).every(row => row.stock_lane === 'core')).toBe(true);
    expect(rows.filter(row => row.stock_lane === 'core').map(row => row.item_name)).toEqual([
      'Potion of Healing',
      'Potion of Greater Healing',
      "Healer's Kit",
      "Alchemist's Supplies",
      'Herbalism Kit',
    ]);
  });

  test('blacksmith includes guaranteed anchors, rotating lane staples, and ammo support when available', () => {
    const rows = withFixedRandom(0.01, () => generateShopRows([
      baseItem({ id: 'shield', name: 'Shield', item_type: 'armor', category: 'Armor', subcategory: 'Shield', suggested_price_gp: 10 }),
      baseItem({ id: 'smith-tools', name: "Smith's Tools", item_type: 'tool', category: 'Tools', subcategory: 'artisan', suggested_price_gp: 20 }),
      baseItem({ id: 'club', name: 'Club', item_type: 'weapon', category: 'Simple Weapon', subcategory: 'Melee', suggested_price_gp: 1 }),
      baseItem({ id: 'spear', name: 'Spear', item_type: 'weapon', category: 'Simple Weapon', subcategory: 'Melee', suggested_price_gp: 1 }),
      baseItem({ id: 'longsword', name: 'Longsword', item_type: 'weapon', category: 'Martial Weapon', subcategory: 'Melee', suggested_price_gp: 15 }),
      baseItem({ id: 'warhammer', name: 'Warhammer', item_type: 'weapon', category: 'Martial Weapon', subcategory: 'Melee', suggested_price_gp: 15 }),
      baseItem({ id: 'chain-shirt', name: 'Chain Shirt', item_type: 'armor', category: 'Armor', subcategory: 'Medium Armor', suggested_price_gp: 50 }),
      baseItem({ id: 'leather', name: 'Leather Armor', item_type: 'armor', category: 'Armor', subcategory: 'Light Armor', suggested_price_gp: 10 }),
      baseItem({ id: 'arrows', name: 'Arrows (20)', item_type: 'ammo', category: 'Ammunition', subcategory: 'Arrow', suggested_price_gp: 1 }),
      baseItem({ id: 'bullets', name: 'Sling Bullets (20)', item_type: 'ammo', category: 'Ammunition', subcategory: 'Sling Bullets', suggested_price_gp: 1 }),
      baseItem({ id: 'bolts', name: 'Crossbow Bolts (20)', item_type: 'ammo', category: 'Ammunition', subcategory: 'Bolt', suggested_price_gp: 1 }),
    ], { shopType: 'blacksmith', affluence: 'modest' }));

    const coreRows = rows.filter(row => row.stock_lane === 'core').map(row => row.item_name);
    expect(coreRows).toContain('Shield');
    expect(coreRows).toContain("Smith's Tools");
    expect(coreRows.some(name => ['Club', 'Spear'].includes(name))).toBe(true);
    expect(coreRows.some(name => ['Longsword', 'Warhammer'].includes(name))).toBe(true);
    expect(coreRows.some(name => ['Chain Shirt', 'Leather Armor', 'Shield'].includes(name))).toBe(true);
    expect(coreRows).toContain('Arrows (20)');
    expect(coreRows).toContain('Sling Bullets (20)');
    expect(coreRows).toContain('Crossbow Bolts (20)');
  });

  test('general store includes guaranteed staples and camp-gear core rows when available', () => {
    const rows = withFixedRandom(0.01, () => generateShopRows([
      baseItem({ id: 'torch', name: 'Torch', suggested_price_gp: 0.1 }),
      baseItem({ id: 'rope', name: 'Rope, hempen (50 feet)', suggested_price_gp: 1 }),
      baseItem({ id: 'rations', name: 'Rations (1 day)', suggested_price_gp: 0.5 }),
      baseItem({ id: 'tent', name: 'Tent, Two-Person', suggested_price_gp: 2 }),
      baseItem({ id: 'bedroll', name: 'Bedroll', suggested_price_gp: 1 }),
      baseItem({ id: 'waterskin', name: 'Waterskin', suggested_price_gp: 0.2 }),
      baseItem({ id: 'tinderbox', name: 'Tinderbox', suggested_price_gp: 0.5 }),
    ], { shopType: 'general_store', affluence: 'modest' }));

    const coreRows = rows.filter(row => row.stock_lane === 'core').map(row => row.item_name);
    expect(coreRows).toEqual(expect.arrayContaining([
      'Torch',
      'Rope, hempen (50 feet)',
      'Rations (1 day)',
      'Tent, Two-Person',
      'Bedroll',
    ]));
    expect(coreRows.some(name => ['Waterskin', 'Tinderbox'].includes(name))).toBe(true);
  });

  test('core rows are always ordered before rotating rows', () => {
    const rows = withFixedRandom(0.01, () => generateShopRows([
      baseItem({ id: 'torch', name: 'Torch', suggested_price_gp: 0.1 }),
      baseItem({ id: 'rope', name: 'Rope, hempen (50 feet)', suggested_price_gp: 1 }),
      baseItem({ id: 'rations', name: 'Rations (1 day)', suggested_price_gp: 0.5 }),
      baseItem({ id: 'tent', name: 'Tent, Two-Person', suggested_price_gp: 2 }),
      baseItem({ id: 'bedroll', name: 'Bedroll', suggested_price_gp: 1 }),
      baseItem({ id: 'extra', name: 'Ink (1 ounce)', suggested_price_gp: 10 }),
    ], { shopType: 'general_store', affluence: 'modest' }));

    const firstRotatingIndex = rows.findIndex(row => row.stock_lane === 'rotating');
    expect(firstRotatingIndex).toBeGreaterThan(0);
    expect(rows.slice(0, firstRotatingIndex).every(row => row.stock_lane === 'core')).toBe(true);
  });

  test('affluence changes core quantities in intended direction', () => {
    const catalog = [
      baseItem({ id: 'torch', name: 'Torch', suggested_price_gp: 1 }),
      baseItem({ id: 'rope', name: 'Rope, hempen (50 feet)', suggested_price_gp: 1 }),
      baseItem({ id: 'rations', name: 'Rations (1 day)', suggested_price_gp: 1 }),
      baseItem({ id: 'tent', name: 'Tent, Two-Person', suggested_price_gp: 2 }),
      baseItem({ id: 'bedroll', name: 'Bedroll', suggested_price_gp: 1 }),
    ];

    const poorRows = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'general_store', affluence: 'poor' }));
    const richRows = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'general_store', affluence: 'wealthy' }));

    const poorTorchQty = poorRows.find(row => row.item_name === 'Torch')?.quantity || 0;
    const richTorchQty = richRows.find(row => row.item_name === 'Torch')?.quantity || 0;
    const poorRationQty = poorRows.find(row => row.item_name === 'Rations (1 day)')?.quantity || 0;
    const richRationQty = richRows.find(row => row.item_name === 'Rations (1 day)')?.quantity || 0;

    expect(richTorchQty).toBeGreaterThan(poorTorchQty);
    expect(richRationQty).toBeGreaterThan(poorRationQty);
  });

  test('affluence changes prices in intended direction across whole inventory', () => {
    const catalog = [
      baseItem({ id: 'torch', name: 'Torch', suggested_price_gp: 1 }),
      baseItem({ id: 'rope', name: 'Rope, hempen (50 feet)', suggested_price_gp: 1 }),
      baseItem({ id: 'rations', name: 'Rations (1 day)', suggested_price_gp: 1 }),
      baseItem({ id: 'tent', name: 'Tent, Two-Person', suggested_price_gp: 2 }),
      baseItem({ id: 'bedroll', name: 'Bedroll', suggested_price_gp: 1 }),
      baseItem({ id: 'crowbar', name: 'Crowbar', suggested_price_gp: 25 }),
    ];

    const poorRows = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'general_store', affluence: 'poor' }));
    const richRows = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'general_store', affluence: 'wealthy' }));

    const poorTotal = poorRows.reduce((sum, row) => sum + row.listed_price_gp, 0);
    const richTotal = richRows.reduce((sum, row) => sum + row.listed_price_gp, 0);

    expect(richTotal).toBeGreaterThan(poorTotal);
  });

  test('magic shop includes guaranteed spell scroll core stock (levels 1-5) and total target of 12', () => {
    const rows = withFixedRandom(0.01, () => generateShopRows([
      baseItem({ id: 'wand', name: 'Wand of Secrets', item_type: 'magic_item', rarity: 'Rare', suggested_price_gp: 250, shop_bucket: 'utility' }),
      baseItem({ id: 'healing', name: 'Potion of Healing', item_type: 'magic_item', rarity: 'Common', suggested_price_gp: 50, shop_bucket: 'healing' }),
      baseItem({ id: 'amulet', name: 'Amulet of Proof', item_type: 'magic_item', rarity: 'Uncommon', suggested_price_gp: 120, shop_bucket: 'utility' }),
      baseItem({ id: '11111111-1111-4111-8111-111111111111', source_slug: 'spell-scroll-1st', name: 'Spell Scroll (1st level)', rarity: 'Common', shop_bucket: 'consumable', suggested_price_gp: 75 }),
      baseItem({ id: '22222222-2222-4222-8222-222222222222', source_slug: 'spell-scroll-2nd', name: 'Spell Scroll (2nd level)', rarity: 'Uncommon', shop_bucket: 'consumable', suggested_price_gp: 150 }),
      baseItem({ id: '33333333-3333-4333-8333-333333333333', source_slug: 'spell-scroll-3rd', name: 'Spell Scroll (3rd level)', rarity: 'Uncommon', shop_bucket: 'consumable', suggested_price_gp: 300 }),
      baseItem({ id: '44444444-4444-4444-8444-444444444444', source_slug: 'spell-scroll-4th', name: 'Spell Scroll (4th level)', rarity: 'Rare', shop_bucket: 'consumable', suggested_price_gp: 600 }),
      baseItem({ id: '55555555-5555-4555-8555-555555555555', source_slug: 'spell-scroll-5th', name: 'Spell Scroll (5th level)', rarity: 'Rare', shop_bucket: 'consumable', suggested_price_gp: 1500 }),
      baseItem({ id: '66666666-6666-4666-8666-666666666666', source_slug: 'spell-scroll-6th', name: 'Spell Scroll (6th level)', rarity: 'Very Rare', shop_bucket: 'consumable', suggested_price_gp: 3500 }),
      baseItem({ id: '77777777-7777-4777-8777-777777777777', source_slug: 'spell-scroll-7th', name: 'Spell Scroll (7th level)', rarity: 'Very Rare', shop_bucket: 'consumable', suggested_price_gp: 10000 }),
      baseItem({ id: '88888888-8888-4888-8888-888888888888', source_slug: 'spell-scroll-8th', name: 'Spell Scroll (8th level)', rarity: 'Very Rare', shop_bucket: 'consumable', suggested_price_gp: 15000 }),
      baseItem({ id: '99999999-9999-4999-8999-999999999999', source_slug: 'spell-scroll-9th', name: 'Spell Scroll (9th level)', rarity: 'Legendary', shop_bucket: 'consumable', suggested_price_gp: 25000 }),
    ], {
      shopType: 'magic_shop',
      affluence: 'modest',
      spells: [
        { id: 's1', name: 'Magic Missile', level: 1, is_cantrip: false },
        { id: 's2', name: 'Scorching Ray', level: 2, is_cantrip: false },
        { id: 's3', name: 'Fireball', level: 3, is_cantrip: false },
        { id: 's4', name: 'Dimension Door', level: 4, is_cantrip: false },
        { id: 's5', name: 'Wall of Force', level: 5, is_cantrip: false },
        { id: 's6', name: 'Disintegrate', level: 6, is_cantrip: false },
        { id: 's7', name: 'Teleport', level: 7, is_cantrip: false },
        { id: 's8', name: 'Sunburst', level: 8, is_cantrip: false },
        { id: 's9', name: 'Wish', level: 9, is_cantrip: false },
        { id: 'c0', name: 'Fire Bolt', level: 0, is_cantrip: true },
      ],
    }));

    expect(rows).toHaveLength(12);
    const coreRows = rows.filter(row => row.stock_lane === 'core');
    expect(coreRows).toHaveLength(5);
    expect(coreRows.map(row => row.item_name)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Spell Scroll \(1st Level\) — /),
      expect.stringMatching(/^Spell Scroll \(2nd Level\) — /),
      expect.stringMatching(/^Spell Scroll \(3rd Level\) — /),
      expect.stringMatching(/^Spell Scroll \(4th Level\) — /),
      expect.stringMatching(/^Spell Scroll \(5th Level\) — /),
    ]));
    expect(coreRows.every(row => row.quantity === 1)).toBe(true);
    expect(coreRows.some(row => row.item_name.includes('Cantrip'))).toBe(false);
    expect(rows.some(row => /^Spell Scroll \(6th Level\) — /.test(row.item_name) && row.stock_lane === 'rotating')).toBe(false);
    expect(rows.some(row => /^Spell Scroll \(9th Level\) — /.test(row.item_name) && row.stock_lane === 'core')).toBe(false);
    const firstLevelScroll = coreRows.find(row => /^Spell Scroll \(1st Level\) — /.test(row.item_name));
    expect(firstLevelScroll?.item_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(firstLevelScroll?.item_master_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  test('prevents known high-end leakage regressions across shop surfaces', () => {
    const catalog = [
      baseItem({
        id: 'hammer-thunderbolts',
        name: 'Hammer of Thunderbolts',
        item_type: 'weapon',
        category: 'Martial Weapon',
        rarity: 'Legendary',
        suggested_price_gp: 16000,
        shop_bucket: 'combat',
      }),
      baseItem({
        id: 'staff-woodlands',
        name: 'Staff of the Woodlands',
        item_type: 'staff',
        category: 'Magic',
        rarity: 'Rare',
        suggested_price_gp: 44000,
        shop_bucket: 'noncombat',
      }),
      baseItem({
        id: 'plate-ethereal',
        name: 'Plate Armor of Etherealness',
        item_type: 'armor',
        category: 'Armor',
        rarity: 'Legendary',
        suggested_price_gp: 48000,
        shop_bucket: 'noncombat',
      }),
      baseItem({
        id: 'manual-bodily-health',
        name: 'Manual of Bodily Health',
        item_type: 'magic_item',
        category: 'Magic',
        rarity: 'Very Rare',
        suggested_price_gp: 55000,
        shop_bucket: 'manual_magic_review',
      }),
      baseItem({ id: 'torch', name: 'Torch', suggested_price_gp: 1 }),
      baseItem({ id: 'club', name: 'Club', item_type: 'weapon', category: 'Simple Weapon', subcategory: 'Melee', suggested_price_gp: 1 }),
      baseItem({ id: 'shield', name: 'Shield', item_type: 'armor', category: 'Armor', subcategory: 'Shield', suggested_price_gp: 10 }),
    ];

    const generalStore = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'general_store', affluence: 'modest' }));
    const blacksmithPoor = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'blacksmith', affluence: 'poor' }));
    const magicShopPoor = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'magic_shop', affluence: 'poor' }));

    expect(generalStore.some(row => row.item_name === 'Hammer of Thunderbolts')).toBe(false);
    expect(blacksmithPoor.some(row => row.item_name === 'Staff of the Woodlands')).toBe(false);
    expect(blacksmithPoor.some(row => row.item_name === 'Plate Armor of Etherealness')).toBe(false);
    expect(magicShopPoor.some(row => row.item_name === 'Manual of Bodily Health')).toBe(false);
  });

  test('spell scrolls remain magic-shop stock and do not leak to non-magic shops', () => {
    const catalog = [
      baseItem({ id: 'wand', name: 'Wand of Secrets', item_type: 'magic_item', rarity: 'Common', suggested_price_gp: 250, shop_bucket: 'utility' }),
      baseItem({ id: 'torch', name: 'Torch', suggested_price_gp: 1 }),
      baseItem({ id: 'club', name: 'Club', item_type: 'weapon', category: 'Simple Weapon', subcategory: 'Melee', suggested_price_gp: 1 }),
      baseItem({ id: 'shield', name: 'Shield', item_type: 'armor', category: 'Armor', subcategory: 'Shield', suggested_price_gp: 10 }),
      baseItem({ id: '11111111-1111-4111-8111-111111111111', source_slug: 'spell-scroll-1st', name: 'Spell Scroll (1st level)', rarity: 'Common', shop_bucket: 'consumable', suggested_price_gp: 75 }),
      baseItem({ id: '22222222-2222-4222-8222-222222222222', source_slug: 'spell-scroll-2nd', name: 'Spell Scroll (2nd level)', rarity: 'Uncommon', shop_bucket: 'consumable', suggested_price_gp: 150 }),
      baseItem({ id: '33333333-3333-4333-8333-333333333333', source_slug: 'spell-scroll-3rd', name: 'Spell Scroll (3rd level)', rarity: 'Uncommon', shop_bucket: 'consumable', suggested_price_gp: 300 }),
      baseItem({ id: '44444444-4444-4444-8444-444444444444', source_slug: 'spell-scroll-4th', name: 'Spell Scroll (4th level)', rarity: 'Rare', shop_bucket: 'consumable', suggested_price_gp: 600 }),
      baseItem({ id: '55555555-5555-4555-8555-555555555555', source_slug: 'spell-scroll-5th', name: 'Spell Scroll (5th level)', rarity: 'Rare', shop_bucket: 'consumable', suggested_price_gp: 1500 }),
    ];

    const generalStore = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'general_store', affluence: 'modest' }));
    const blacksmith = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'blacksmith', affluence: 'modest' }));
    const magicShop = withFixedRandom(0.01, () => generateShopRows(catalog, {
      shopType: 'magic_shop',
      affluence: 'modest',
      spells: [
        { id: 's1', name: 'Magic Missile', level: 1, is_cantrip: false },
        { id: 's2', name: 'Scorching Ray', level: 2, is_cantrip: false },
        { id: 's3', name: 'Fireball', level: 3, is_cantrip: false },
        { id: 's4', name: 'Dimension Door', level: 4, is_cantrip: false },
        { id: 's5', name: 'Wall of Force', level: 5, is_cantrip: false },
      ],
    }));

    expect(generalStore.some(row => row.item_name.includes('Spell Scroll'))).toBe(false);
    expect(blacksmith.some(row => row.item_name.includes('Spell Scroll'))).toBe(false);
    expect(magicShop.some(row => row.item_name.includes('Spell Scroll'))).toBe(true);
  });

  test('poor magic shops block very-rare and extreme-value items through affluence guardrails', () => {
    const catalog = [
      baseItem({ id: 'wand', name: 'Wand of Secrets', item_type: 'magic_item', rarity: 'Common', suggested_price_gp: 250, shop_bucket: 'utility' }),
      baseItem({ id: 'very-rare-item', name: 'Very Rare Widget', item_type: 'magic_item', rarity: 'Very Rare', suggested_price_gp: 8000, shop_bucket: 'utility' }),
      baseItem({ id: 'too-expensive', name: 'Pricey Uncommon Trinket', item_type: 'magic_item', rarity: 'Uncommon', suggested_price_gp: 5000, shop_bucket: 'utility' }),
      baseItem({ id: 'combat-item', name: 'Aggressive Curio', item_type: 'magic_item', rarity: 'Common', suggested_price_gp: 400, shop_bucket: 'combat' }),
    ];

    const poorRows = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'magic_shop', affluence: 'poor' }));
    const wealthyRows = withFixedRandom(0.01, () => generateShopRows(catalog, { shopType: 'magic_shop', affluence: 'wealthy' }));

    expect(poorRows.some(row => row.item_name === 'Very Rare Widget')).toBe(false);
    expect(poorRows.some(row => row.item_name === 'Pricey Uncommon Trinket')).toBe(false);
    expect(poorRows.some(row => row.item_name === 'Aggressive Curio')).toBe(false);
    expect(wealthyRows.some(row => row.item_name === 'Very Rare Widget')).toBe(true);
  });
});
