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

  test('apothecary shop keeps to healing/alchemy-style stock', () => {
    const rows = generateShopRows([
      baseItem({ id: 'potion-healing', name: 'Potion of Healing', item_type: 'magic_item', shop_bucket: 'healing', rarity: 'Common', suggested_price_gp: 50 }),
      baseItem({ id: 'alchemist-fire', name: "Alchemist's Fire", category: 'Adventuring Gear', subcategory: 'Alchemical', suggested_price_gp: 50 }),
      baseItem({ id: 'battleaxe', name: 'Battleaxe', item_type: 'weapon', category: 'Martial Weapon', subcategory: 'Melee', suggested_price_gp: 10 }),
      baseItem({ id: 'horse', name: 'Riding Horse', item_type: 'equipment', category: 'Mounts and Vehicles', subcategory: 'Mount', suggested_price_gp: 75 }),
    ], { shopType: 'apothecary', affluence: 'modest' });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some(row => row.item_name === 'Battleaxe')).toBe(false);
    expect(rows.some(row => row.item_name === 'Riding Horse')).toBe(false);
    expect(rows.some(row => row.item_name === 'Potion of Healing' || row.item_name === "Alchemist's Fire")).toBe(true);
  });

  test('dedupes duplicate-looking Potion of Healing rows from different source ids', () => {
    const rows = generateShopRows([
      baseItem({ id: 'potion-healing-a', name: 'Potion of Healing', item_type: 'magic_item', shop_bucket: 'healing', rarity: 'Common', suggested_price_gp: 50 }),
      baseItem({ id: 'potion-healing-b', name: 'Potion of Healing', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Common', suggested_price_gp: 60 }),
      baseItem({ id: 'potion-greater', name: 'Potion of Greater Healing', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Uncommon', suggested_price_gp: 150 }),
    ], { shopType: 'apothecary', affluence: 'modest' });

    const baseHealingRows = rows.filter(row => row.item_name === 'Potion of Healing');
    expect(baseHealingRows).toHaveLength(1);
  });

  test('apothecary can stock greater/superior/supreme healing without widening to unrelated rare magic', () => {
    const rows = generateShopRows([
      baseItem({ id: 'potion-healing', name: 'Potion of Healing', item_type: 'magic_item', shop_bucket: 'healing', rarity: 'Common', suggested_price_gp: 50 }),
      baseItem({ id: 'potion-greater', name: 'Potion of Greater Healing', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Uncommon', suggested_price_gp: 150 }),
      baseItem({ id: 'potion-superior', name: 'Potion of Superior Healing', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Very Rare', suggested_price_gp: 450 }),
      baseItem({ id: 'potion-supreme', name: 'Potion of Supreme Healing', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Very Rare', suggested_price_gp: 1350 }),
      baseItem({ id: 'potion-heroism', name: 'Potion of Heroism', item_type: 'magic_item', shop_bucket: 'consumable', rarity: 'Rare', suggested_price_gp: 180 }),
      baseItem({ id: 'rare-wand', name: 'Wand of Secrets', item_type: 'magic_item', shop_bucket: 'utility', rarity: 'Rare', suggested_price_gp: 250 }),
    ], { shopType: 'apothecary', affluence: 'wealthy' });

    expect(rows.some(row => row.item_name === 'Potion of Greater Healing')).toBe(true);
    expect(rows.some(row => row.item_name === 'Potion of Superior Healing')).toBe(true);
    expect(rows.some(row => row.item_name === 'Potion of Supreme Healing')).toBe(true);
    expect(rows.some(row => row.item_name === 'Potion of Heroism')).toBe(false);
    expect(rows.some(row => row.item_name === 'Wand of Secrets')).toBe(false);
  });

});
