import test from 'node:test';
import assert from 'node:assert/strict';
import { convert5etoolsItemToImportRow } from './convert_5etools_source_split_items_lib.mjs';

function convert(item, ctx = {}) {
  return convert5etoolsItemToImportRow(item, {
    sourceKey: 'TST',
    sourceSlug: 'tst',
    sourceFilename: 'TST.json',
    ...ctx,
  });
}

test('maps mundane equipment with value into import row shape', () => {
  const row = convert({ name: 'Abacus', source: 'PHB', type: 'G', rarity: 'none', value: 200, page: 150 });
  assert.equal(row.item_type, 'equipment');
  assert.equal(row.base_price_gp, 2);
  assert.equal(row.is_shop_eligible, true);
  assert.equal(row.shop_bucket, 'mundane');
  assert.equal(row.source_slug, 'tst-abacus');
});

test('maps attunement magic item truthfully', () => {
  const row = convert({ name: 'Ring of Testing', rarity: 'rare', reqAttune: 'by a wizard', entries: ['Useful thing.'] });
  assert.equal(row.item_type, 'magic_item');
  assert.equal(row.requires_attunement, true);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.metadata_json.mechanics_support, 'manual_required');
});

test('maps weapon-like bonus fields into mechanics support', () => {
  const row = convert({ name: 'Blade of +1', rarity: 'rare', type: 'M', weaponCategory: 'martial', bonusWeapon: '+1' });
  assert.equal(row.item_type, 'weapon');
  assert.equal(row.metadata_json.mechanics_support, 'partial_supported');
  assert.deepEqual(row.metadata_json.mechanics.passive_effects[0], { type: 'weapon_attack_bonus', value: 1 });
});

test('maps charge/recharge fields into mechanics metadata', () => {
  const row = convert({ name: 'Wand of Charges', rarity: 'rare', charges: 7, recharge: 'dawn', rechargeAmount: 1 });
  assert.equal(row.metadata_json.mechanics.charges.max, 7);
  assert.equal(row.metadata_json.mechanics.recharge.text, 'dawn');
});

test('flattens nested entries and keeps weird rows importable/manual', () => {
  const row = convert({
    name: 'Odd Relic',
    rarity: 'legendary',
    entries: [
      'Line one with {@damage 2d6}.',
      { type: 'list', items: ['alpha', 'beta'] },
      { type: 'table', colLabels: ['Result', 'Effect'], rows: [['1', '{@dc 15} save']] },
    ],
  });

  assert.match(row.description, /2d6 damage/);
  assert.match(row.description, /- alpha/);
  assert.match(row.description, /Table: Result \| Effect/);
  assert.equal(row.metadata_json.mechanics_support, 'manual_required');
  assert.equal(row.is_shop_eligible, false);
});

test('does not treat null-priced rows as shop-eligible', () => {
  const row = convert({ name: 'Moon Sickle +1', source: 'TCE', type: 'M', weaponCategory: 'martial', rarity: 'uncommon', reqAttune: true });
  assert.equal(row.base_price_gp, null);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.shop_bucket, 'manual_magic_review');
});

test('keeps mundane priced equipment shop-eligible', () => {
  const row = convert({ name: 'Bedroll', source: 'PHB', type: 'G', rarity: 'none', value: 100 });
  assert.equal(row.base_price_gp, 1);
  assert.equal(row.is_shop_eligible, true);
  assert.equal(row.shop_bucket, 'mundane');
});

test('marks magical armor and weapon examples non-shop-eligible by default', () => {
  const animatedShield = convert({ name: 'Animated Shield', source: 'DMG', type: 'S', rarity: 'very rare', reqAttune: true });
  const armorOfInvulnerability = convert({ name: 'Armor of Invulnerability', source: 'DMG', type: 'HA', rarity: 'legendary', reqAttune: true });
  const blackrazor = convert({ name: 'Blackrazor', source: 'DMG', type: 'M', weaponCategory: 'martial', rarity: 'legendary', reqAttune: true });

  assert.equal(animatedShield.is_shop_eligible, false);
  assert.equal(animatedShield.shop_bucket, 'manual_magic_review');
  assert.equal(armorOfInvulnerability.is_shop_eligible, false);
  assert.equal(blackrazor.is_shop_eligible, false);
});
