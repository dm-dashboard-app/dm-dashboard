import {
  applyPersistedStockLanes,
  buildGenerationSeedWithCoreCount,
  countCoreRows,
  parseCoreCountFromGenerationSeed,
} from './shopLanePersistence';

describe('shop lane persistence', () => {
  test('preserves generated core rows after save/load round-trip by generation seed core count', () => {
    const generatedRows = [
      { item_id: 'a', item_name: 'Torch', stock_lane: 'core' },
      { item_id: 'b', item_name: 'Rope, hempen (50 feet)', stock_lane: 'core' },
      { item_id: 'c', item_name: 'Rations (1 day)', stock_lane: 'core' },
      { item_id: 'd', item_name: 'Waterskin', stock_lane: 'rotating' },
    ];

    const generationSeed = buildGenerationSeedWithCoreCount('seed-123', countCoreRows(generatedRows));
    const reloadedRowsWithoutLane = generatedRows.map(({ stock_lane, ...row }) => row);
    const resolved = applyPersistedStockLanes(reloadedRowsWithoutLane, {
      shopType: 'general_store',
      generationSeed,
    });

    expect(resolved.map(row => row.stock_lane)).toEqual(['core', 'core', 'core', 'rotating']);
  });

  test('does not promote rotating camp gear to core on reload', () => {
    const generationSeed = buildGenerationSeedWithCoreCount('seed-456', 5);
    const reloadedRows = [
      { item_name: 'Torch' },
      { item_name: 'Rope, hempen (50 feet)' },
      { item_name: 'Rations (1 day)' },
      { item_name: 'Tent, Two-Person' },
      { item_name: 'Bedroll' },
      { item_name: 'Waterskin' },
      { item_name: 'Tinderbox' },
      { item_name: 'Crowbar' },
    ];

    const resolved = applyPersistedStockLanes(reloadedRows, { shopType: 'general_store', generationSeed });

    expect(resolved.slice(0, 5).every(row => row.stock_lane === 'core')).toBe(true);
    expect(resolved.slice(5).every(row => row.stock_lane === 'rotating')).toBe(true);
  });

  test('magic shop restores core lane rows when generation seed encodes core count', () => {
    const rows = [
      { item_name: 'Spell Scroll (1st Level) — Magic Missile' },
      { item_name: 'Spell Scroll (2nd Level) — Scorching Ray' },
      { item_name: 'Wand of Secrets' },
      { item_name: 'Potion of Healing' },
    ];

    const resolved = applyPersistedStockLanes(rows, {
      shopType: 'magic_shop',
      generationSeed: buildGenerationSeedWithCoreCount('seed-magic', 2),
    });

    expect(resolved.slice(0, 2).every(row => row.stock_lane === 'core')).toBe(true);
    expect(resolved.slice(2).every(row => row.stock_lane === 'rotating')).toBe(true);
  });

  test('preserves explicit is_core_stock metadata when stock_lane is missing', () => {
    const resolved = applyPersistedStockLanes([
      { item_name: 'Spell Scroll (1st Level) — Magic Missile', is_core_stock: true },
      { item_name: 'Wand of Secrets', is_core_stock: false },
    ], {
      shopType: 'magic_shop',
      generationSeed: 'legacy-seed-without-core-count',
    });

    expect(resolved.map(row => row.stock_lane)).toEqual(['core', 'rotating']);
    expect(resolved.map(row => row.is_core_stock)).toEqual([true, false]);
  });

  test('legacy rows without metadata stay conservative (rotating)', () => {
    const resolved = applyPersistedStockLanes([
      { item_name: 'Torch' },
      { item_name: 'Rope, hempen (50 feet)' },
    ], { shopType: 'general_store', generationSeed: 'legacy-seed' });

    expect(resolved.every(row => row.stock_lane === 'rotating')).toBe(true);
  });

  test('parses encoded core count from generation seed', () => {
    expect(parseCoreCountFromGenerationSeed('abc|core:7')).toBe(7);
    expect(parseCoreCountFromGenerationSeed('abc')).toBeNull();
  });
});
