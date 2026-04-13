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
});
