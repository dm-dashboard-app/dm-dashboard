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

  test('equip RPC preserves attuned state on the equipped row', () => {
    const sqlPath = path.join(process.cwd(), 'docs/sql/equipment_attunement_phase1.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/create or replace function public\.inventory_equip_item/i);
    expect(sql).toMatch(/update public\.player_inventory_items\s+set equipped = true\s+where id = p_item_row_id/i);
    expect(sql).not.toMatch(/set equipped = true,\s*attuned = false\s*where id = p_item_row_id/i);
  });


  test('attune RPC does not force equipped=true when attuning', () => {
    const sqlPath = path.join(process.cwd(), 'docs/sql/equipment_attunement_phase1.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/create or replace function public\.inventory_attune_item/i);
    expect(sql).toMatch(/update public\.player_inventory_items pi\s+set attuned = true/i);
    expect(sql).not.toMatch(/set attuned = true,\s*equipped\s*=\s*case/i);
  });
  test('manual AC bonus persistence migration exists for profiles', () => {
    const sqlPath = path.join(process.cwd(), 'docs/sql/profile_ac_bonus_manual_modifier.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/alter table if exists public\.profiles_players/i);
    expect(sql).toMatch(/add column if not exists ac_bonus integer not null default 0/i);
  });
});
