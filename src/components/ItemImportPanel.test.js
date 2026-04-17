jest.mock('../supabaseClient', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              ilike: jest.fn(() => ({
                order: jest.fn(),
              })),
              order: jest.fn(),
            })),
            order: jest.fn(),
          })),
          order: jest.fn(),
        })),
      })),
    })),
  },
}));

import { buildItemImportRpcArgs } from './ItemImportPanel';

describe('buildItemImportRpcArgs', () => {
  test('sends five_tools_2014 mode with artifact metadata for RPC safety checks', () => {
    const rows = [{ external_key: '5etools_items_by_source_curated:phb-abacus' }];
    const importMeta = {
      source_layer: '5etools_items_by_source_curated',
      expected_active_row_count: 752,
      artifact_generated_at: '2026-04-17T10:00:00.000Z',
    };

    const args = buildItemImportRpcArgs({ is5etoolsMode: true, rows, importMeta });
    expect(args).toEqual({
      p_import_mode: 'five_tools_2014',
      p_rows: rows,
      p_import_meta: importMeta,
    });
  });

  test('does not send import metadata for non-5etools modes', () => {
    const srdArgs = buildItemImportRpcArgs({ isSrdMode: true, rows: [] });
    expect(srdArgs.p_import_mode).toBe('srd_2014');
    expect(srdArgs.p_import_meta).toBeNull();

    const customArgs = buildItemImportRpcArgs({ rows: [] });
    expect(customArgs.p_import_mode).toBe('custom_seed_2014');
    expect(customArgs.p_import_meta).toBeNull();
  });
});
