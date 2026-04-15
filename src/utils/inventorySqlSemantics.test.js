import fs from 'fs';
import path from 'path';

describe('inventory SQL merge semantics guard', () => {
  test('catalog add ON CONFLICT merges quantity instead of replacing it', () => {
    const sqlPath = path.join(process.cwd(), 'docs/sql/inventory_phase1_inventory_transfers_and_logs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/on conflict \(player_profile_id, item_master_id\)/i);
    expect(sql).toMatch(/quantity\s*=\s*public\.player_inventory_items\.quantity\s*\+\s*excluded\.quantity/i);
    expect(sql).not.toMatch(/quantity\s*=\s*excluded\.quantity\s*,/i);
  });
});
