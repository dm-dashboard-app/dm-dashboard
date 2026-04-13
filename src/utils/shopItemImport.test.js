import { buildSrdRepairRows, loadSrdDegradedReportRows } from './shopItemImport';
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
  test('covers the full repo target list with explicit unresolved remainder', () => {
    const targetRows = JSON.parse(fs.readFileSync('docs/degraded-srd-item-master-rows.json', 'utf8'));
    const repairOverlay = JSON.parse(fs.readFileSync('docs/data/shop_srd_degraded_repairs_2014.json', 'utf8'));
    const repairedRows = Array.isArray(repairOverlay.items) ? repairOverlay.items : [];
    const unresolvedRows = repairOverlay?.coverage?.unresolved_rows_detail || [];

    expect(targetRows).toHaveLength(307);
    expect(repairOverlay.coverage.target_rows).toBe(targetRows.length);
    expect(repairOverlay.coverage.repaired_rows).toBe(repairedRows.length);
    expect(repairOverlay.coverage.unresolved_rows).toBe(unresolvedRows.length);
    expect(repairedRows.length + unresolvedRows.length).toBe(targetRows.length);
    const allowedReasons = new Set([
      'variant_ambiguity',
      'overlay_present_but_explicitly_unpriced',
      'no_trustworthy_curated_price_source',
    ]);
    expect(unresolvedRows.every(row => allowedReasons.has(row.reason))).toBe(true);
  });
});
