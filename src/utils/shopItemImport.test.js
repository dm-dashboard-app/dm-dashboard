import { applySrdRepairsToImportRows, buildSrdImportRows, buildSrdRepairRows, loadSrdDegradedReportRows } from './shopItemImport';
import { generateShopRows } from './shopGenerator';
import fs from 'fs';

function degradedRow(overrides = {}) {
  return {
    id: 'degraded-1',
    external_key: 'official_srd_2014:hempen-rope-50-feet',
    source_slug: 'hempen-rope-50-feet',
    name: 'Hempen Rope (50 feet)',
    slug: 'official-srd-2014-hempen-rope-50-feet',
    item_type: 'equipment_fallback',
    category: 'Fallback Equipment',
    subcategory: 'unclassified',
    rarity: null,
    requires_attunement: false,
    description: 'Imported from upstream index because the detail endpoint is unavailable.',
    base_price_gp: null,
    suggested_price_gp: null,
    price_source: 'degraded_fallback_untrusted',
    source_type: 'official_srd_2014',
    source_book: 'SRD 5.1 (2014)',
    rules_era: '2014',
    is_shop_eligible: false,
    shop_bucket: 'fallback_quarantine',
    metadata_json: {
      degraded_import: true,
      import_quality: 'degraded_fallback',
      degraded_reason: 'detail_endpoint_unavailable',
    },
    ...overrides,
  };
}

describe('buildSrdRepairRows', () => {
  test('repairs degraded SRD rows when overlay data is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            external_key: 'official_srd_2014:hempen-rope-50-feet',
            item_type: 'adventuring_gear',
            category: 'Adventuring Gear',
            subcategory: 'Tools and Utility',
            description: 'Curated rope description',
            base_price_gp: 1,
            suggested_price_gp: 1,
            shop_bucket: 'mundane',
          },
        ],
      }),
    });

    const result = await buildSrdRepairRows([degradedRow()]);

    expect(result.degradedCount).toBe(1);
    expect(result.repairedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.rows[0].is_shop_eligible).toBe(true);
    expect(result.rows[0].shop_bucket).toBe('mundane');
    expect(result.rows[0].metadata_json.degraded_import).toBe(false);
    expect(result.rows[0].metadata_json.import_quality).toBe('repaired_overlay_verified');
  });

  test('keeps degraded rows quarantined when repair data is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await buildSrdRepairRows([degradedRow()]);

    expect(result.repairedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.skippedRows[0].reason).toBe('overlay_not_found');
  });

  test('can resolve degraded rows by explicit exclusion policy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            external_key: 'official_srd_2014:broom-of-flying',
            source_slug: 'broom-of-flying',
            resolution_state: 'excluded_on_purpose',
            excluded_reason: 'excluded_legacy_balance_item',
            item_type: 'magic_item',
            category: 'magic',
            subcategory: 'standard',
            shop_bucket: 'excluded',
          },
        ],
      }),
    });

    const result = await buildSrdRepairRows([degradedRow({ external_key: 'official_srd_2014:broom-of-flying', source_slug: 'broom-of-flying' })]);

    expect(result.repairedCount).toBe(1);
    expect(result.rows[0].is_shop_eligible).toBe(false);
    expect(result.rows[0].metadata_json.degraded_import).toBe(false);
    expect(result.rows[0].metadata_json.import_quality).toBe('excluded_on_purpose');
    expect(result.rows[0].metadata_json.exclusion_reason).toBe('excluded_legacy_balance_item');
  });

  test('repaired rows can re-enter normal shop generation while degraded rows cannot', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            external_key: 'official_srd_2014:hempen-rope-50-feet',
            item_type: 'adventuring_gear',
            category: 'Adventuring Gear',
            subcategory: 'Tools and Utility',
            description: 'Curated rope description',
            base_price_gp: 1,
            suggested_price_gp: 1,
            shop_bucket: 'mundane',
          },
        ],
      }),
    });

    const degraded = degradedRow({ id: 'degraded-rope' });
    const repaired = (await buildSrdRepairRows([degraded])).rows[0];

    const degradedGenerated = generateShopRows([degraded], { shopType: 'general_store', affluence: 'modest' });
    const repairedGenerated = generateShopRows([{ ...repaired, id: 'repaired-rope' }], { shopType: 'general_store', affluence: 'modest' });

    expect(degradedGenerated.some(row => row.item_name === 'Hempen Rope (50 feet)')).toBe(false);
    expect(repairedGenerated.some(row => row.item_name === 'Hempen Rope (50 feet)')).toBe(true);
  });
});


  test('applies mechanics enrichment overlay into import rows metadata', async () => {
    global.fetch = jest.fn((url) => {
      const value = String(url);
      if (value.includes('/data/item_mechanics_enrichment_2014.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{
              external_key: 'official_srd_2014:shield',
              source_slug: 'shield',
              slot_family: 'shield',
              activation_mode: 'equip',
              requires_attunement: false,
              passive_effects: [{ type: 'shield_ac_bonus', value: 2 }],
            }],
          }),
        });
      }
      if (value.includes('/data/shop_magic_pricing_2014.json')) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      if (value.endsWith('/equipment/shield')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            index: 'shield',
            name: 'Shield',
            equipment_category: { name: 'Armor' },
            armor_category: 'Shield',
            cost: { quantity: 10, unit: 'gp' },
            desc: ['A shield.'],
          }),
        });
      }
      if (value.endsWith('/equipment')) return Promise.resolve({ ok: true, json: async () => ({ results: [{ index: 'shield', name: 'Shield', url: '/equipment/shield' }] }) });
      if (value.endsWith('/magic-items')) return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
    });

    const result = await buildSrdImportRows();
    const shield = result.rows.find((row) => row.source_slug === 'shield');

    expect(shield).toBeTruthy();
    expect(shield.metadata_json.mechanics.slot_family).toBe('shield');
    expect(shield.metadata_json.mechanics.passive_effects[0].type).toBe('shield_ac_bonus');
  });

describe('applySrdRepairsToImportRows', () => {
  test('replaces degraded rows with repaired overlay rows in SRD import payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            external_key: 'official_srd_2014:elemental-gem-air',
            source_slug: 'elemental-gem-air',
            item_type: 'wondrous_item',
            category: 'Wondrous Item',
            subcategory: 'gem',
            description: 'Elemental gem (air) repaired description',
            base_price_gp: 5000,
            suggested_price_gp: 5000,
            shop_bucket: 'magic',
          },
        ],
      }),
    });

    const degraded = degradedRow({
      external_key: 'official_srd_2014:elemental-gem-air',
      source_slug: 'elemental-gem-air',
      name: 'Elemental Gem (Air)',
    });
    const clean = degradedRow({
      id: 'clean-row',
      external_key: 'official_srd_2014:rope-of-climbing',
      source_slug: 'rope-of-climbing',
      name: 'Rope of Climbing',
      metadata_json: { degraded_import: false, import_quality: 'detail_verified' },
      is_shop_eligible: true,
      shop_bucket: 'magic',
      item_type: 'wondrous_item',
      category: 'Wondrous Item',
      subcategory: 'standard',
      price_source: 'shop_magic_pricing_2014_overlay',
    });

    const result = await applySrdRepairsToImportRows([degraded, clean]);

    expect(result.degradedCount).toBe(1);
    expect(result.repairedCount).toBe(1);
    expect(result.rows).toHaveLength(2);
    const repaired = result.rows.find(row => row.external_key === 'official_srd_2014:elemental-gem-air');
    expect(repaired.shop_bucket).toBe('magic');
    expect(repaired.price_source).toBe('shop_srd_degraded_repairs_2014_overlay');
    expect(repaired.subcategory).toBe('gem');
    expect(repaired.metadata_json.degraded_import).toBe(false);
    const untouched = result.rows.find(row => row.external_key === 'official_srd_2014:rope-of-climbing');
    expect(untouched.price_source).toBe('shop_magic_pricing_2014_overlay');
  });

  test('repairs elemental gem + dragon scale rows out of fallback quarantine shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            external_key: 'official_srd_2014:elemental-gem-air',
            source_slug: 'elemental-gem-air',
            item_type: 'wondrous_item',
            category: 'Wondrous Item',
            subcategory: 'gem',
            base_price_gp: 5000,
            suggested_price_gp: 5000,
            shop_bucket: 'consumable',
          },
          {
            external_key: 'official_srd_2014:dragon-scale-mail-black',
            source_slug: 'dragon-scale-mail-black',
            item_type: 'armor',
            category: 'Armor',
            subcategory: 'medium',
            base_price_gp: 8000,
            suggested_price_gp: 8000,
            shop_bucket: 'combat',
          },
          {
            external_key: 'official_srd_2014:dragon-scale-mail-blue',
            source_slug: 'dragon-scale-mail-blue',
            item_type: 'armor',
            category: 'Armor',
            subcategory: 'medium',
            base_price_gp: 8000,
            suggested_price_gp: 8000,
            shop_bucket: 'combat',
          },
        ],
      }),
    });

    const makeTarget = (key, slug, name) => degradedRow({ external_key: key, source_slug: slug, name });
    const result = await applySrdRepairsToImportRows([
      makeTarget('official_srd_2014:elemental-gem-air', 'elemental-gem-air', 'Elemental Gem (Air)'),
      makeTarget('official_srd_2014:dragon-scale-mail-black', 'dragon-scale-mail-black', 'Dragon Scale Mail (Black)'),
      makeTarget('official_srd_2014:dragon-scale-mail-blue', 'dragon-scale-mail-blue', 'Dragon Scale Mail (Blue)'),
    ]);

    expect(result.repairedCount).toBe(3);
    result.rows.forEach(row => {
      expect(row.shop_bucket).not.toBe('fallback_quarantine');
      expect(row.price_source).toBe('shop_srd_degraded_repairs_2014_overlay');
      expect(row.subcategory).not.toBe('unclassified');
      expect(row.metadata_json.degraded_import).toBe(false);
    });
  });
});

describe('loadSrdDegradedReportRows', () => {
  test('loads durable degraded report rows from artifact JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generated_at: '2026-04-13T00:00:00.000Z',
        items: [{ external_key: 'official_srd_2014:test-item' }],
      }),
    });

    const report = await loadSrdDegradedReportRows();

    expect(report.generatedAt).toBe('2026-04-13T00:00:00.000Z');
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].external_key).toBe('official_srd_2014:test-item');
  });
});

describe('degraded SRD repair overlay coverage', () => {


  test('includes explicit repairs for remaining fallback equipment row targets', () => {
    const repairOverlay = JSON.parse(fs.readFileSync('docs/data/shop_srd_degraded_repairs_2014.json', 'utf8'));
    const repairedRows = Array.isArray(repairOverlay.items) ? repairOverlay.items : [];
    const bySlug = new Map(repairedRows.map(row => [row.source_slug, row]));

    const targets = [
      'saddle-military','saddle-pack','saddle-riding','saddlebags','sailing-ship','scale-mail','scale-merchants','scholars-pack','scimitar','sealing-wax','shawm','shield','shortbow','shortsword','shovel','sickle','signal-whistle','signet-ring','sled','sling',
    ];

    expect(targets.every(slug => bySlug.has(slug))).toBe(true);

    targets.forEach(slug => {
      const row = bySlug.get(slug);
      expect(row.item_type).not.toBe('equipment_fallback');
      expect(row.category).not.toBe('Fallback Equipment');
      expect(row.subcategory).not.toBe('unclassified');
      expect(row.shop_bucket).not.toBe('fallback_quarantine');
      expect(row.base_price_gp).toBeGreaterThan(0);
      expect(row.suggested_price_gp).toBeGreaterThan(0);
    });
  });

  test('covers the full repo target list with explicit unresolved remainder', () => {
    const targetRows = JSON.parse(fs.readFileSync('docs/degraded-srd-item-master-rows.json', 'utf8'));
    const repairOverlay = JSON.parse(fs.readFileSync('docs/data/shop_srd_degraded_repairs_2014.json', 'utf8'));
    const repairedRows = Array.isArray(repairOverlay.items) ? repairOverlay.items : [];
    const unresolvedRows = repairOverlay?.coverage?.unresolved_rows_detail || [];

    expect(repairOverlay.coverage.target_rows).toBe(targetRows.length);
    const targetKeys = new Set(targetRows.map(row => row.external_key));
    const resolvedRows = repairedRows.filter(row => targetKeys.has(row.external_key));
    expect(repairOverlay.coverage.repaired_rows + (repairOverlay.coverage.excluded_rows || 0)).toBe(resolvedRows.length);
    expect(repairOverlay.coverage.unresolved_rows).toBe(unresolvedRows.length);
    expect(resolvedRows.length + unresolvedRows.length).toBe(targetRows.length);
    const allowedReasons = new Set([
      'variant_ambiguity',
      'overlay_present_but_explicitly_unpriced',
      'no_trustworthy_curated_price_source',
      'overlay_not_found',
    ]);
    expect(unresolvedRows.every(row => allowedReasons.has(row.reason))).toBe(true);
  });
});


describe('dm_import_item_master_rows SQL downgrade protection', () => {
  test('enforces SQL upsert quality gate to block degraded downgrades', () => {
    const sql = fs.readFileSync('docs/sql/stage4_shop_item_import_rpc.sql', 'utf8');

    expect(sql).toContain('on conflict (external_key)');
    expect(sql).toContain('do update set');
    expect(sql).toContain('where (');
    expect(sql).toContain("excluded.metadata_json->>'degraded_import'");
    expect(sql).toContain("v_mode <> 'srd_2014'");
    expect(sql).toContain("degraded_fallback_untrusted");
    expect(sql).toContain("fallback_quarantine");
    expect(sql).toContain("item_master.metadata_json->>'degraded_import'");
    expect(sql).toContain("= 'degraded_fallback'");
    expect(sql).toContain("= 'repaired_overlay_verified'");
    expect(sql).toContain("= 'excluded_on_purpose'");
    expect(sql).toContain('degraded_fallback_untrusted');
    expect(sql).toContain(') >= (');
  });
});


describe('buildSrdImportRows trust-boundary hardening', () => {
  function mockSrdFetch({ equipmentIndex = [], magicIndex = [], equipmentDetails = {}, magicDetails = {}, pricingItems = [] }) {
    global.fetch = jest.fn(async (url) => {
      if (url === '/data/shop_magic_pricing_2014.json') {
        return { ok: true, json: async () => ({ items: pricingItems }) };
      }

      if (url === 'https://www.dnd5eapi.co/api/2014/equipment') {
        return { ok: true, json: async () => ({ results: equipmentIndex }) };
      }
      if (url === 'https://www.dnd5eapi.co/api/2014/magic-items') {
        return { ok: true, json: async () => ({ results: magicIndex }) };
      }

      if (url.includes('/equipment/')) {
        const detail = equipmentDetails[url];
        if (detail) return { ok: true, json: async () => detail };
        return { ok: false, status: 503 };
      }

      if (url.includes('/magic-items/')) {
        const detail = magicDetails[url];
        if (detail) return { ok: true, json: async () => detail };
        return { ok: false, status: 503 };
      }

      return { ok: false, status: 404 };
    });
  }

  test('failed detail endpoint does not produce a persisted import row', async () => {
    mockSrdFetch({
      equipmentIndex: [{ index: 'rope', name: 'Rope', url: '/api/2014/equipment/rope' }],
      magicIndex: [],
      equipmentDetails: {},
    });

    const result = await buildSrdImportRows();

    expect(result.attemptedCount).toBe(1);
    expect(result.rows).toHaveLength(0);
    expect(result.fetchFailureCount).toBe(1);
    expect(result.fetchFailures[0].index).toBe('rope');
  });

  test('degraded magic fetch failure does not get pricing-overlay-shaped into persisted rows', async () => {
    mockSrdFetch({
      equipmentIndex: [],
      magicIndex: [{ index: 'wand-of-secrets', name: 'Wand of Secrets', url: '/api/2014/magic-items/wand-of-secrets' }],
      magicDetails: {},
      pricingItems: [{ normalized_name: 'wand of secrets', suggested_price_gp: 2000, shop_bucket: 'magic' }],
    });

    const result = await buildSrdImportRows();

    expect(result.rows).toHaveLength(0);
    expect(result.fetchFailureCount).toBe(1);
    expect(result.fetchFailures[0].name).toBe('Wand of Secrets');
  });

  test('repaired and excluded overlay rows still persist in repair pipeline', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            external_key: 'official_srd_2014:repair-me',
            source_slug: 'repair-me',
            item_type: 'wondrous_item',
            category: 'Wondrous Item',
            subcategory: 'standard',
            base_price_gp: 250,
            suggested_price_gp: 250,
            shop_bucket: 'magic',
          },
          {
            external_key: 'official_srd_2014:exclude-me',
            source_slug: 'exclude-me',
            resolution_state: 'excluded_on_purpose',
            excluded_reason: 'test_exclusion',
            item_type: 'magic_item',
            category: 'magic',
            subcategory: 'standard',
            shop_bucket: 'excluded',
          },
        ],
      }),
    });

    const rows = [
      degradedRow({ external_key: 'official_srd_2014:repair-me', source_slug: 'repair-me', name: 'Repair Me' }),
      degradedRow({ external_key: 'official_srd_2014:exclude-me', source_slug: 'exclude-me', name: 'Exclude Me' }),
    ];

    const result = await applySrdRepairsToImportRows(rows);

    expect(result.rows).toHaveLength(2);
    expect(result.repairedCount).toBe(2);
    const repaired = result.rows.find(row => row.external_key === 'official_srd_2014:repair-me');
    const excluded = result.rows.find(row => row.external_key === 'official_srd_2014:exclude-me');
    expect(repaired.metadata_json.import_quality).toBe('repaired_overlay_verified');
    expect(repaired.is_shop_eligible).toBe(true);
    expect(excluded.metadata_json.import_quality).toBe('excluded_on_purpose');
    expect(excluded.is_shop_eligible).toBe(false);
  });
});
