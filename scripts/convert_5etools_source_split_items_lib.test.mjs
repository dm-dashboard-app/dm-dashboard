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

function buildOverlayMap(...items) {
  return new Map(items.map(item => [String(item.normalized_name), item]));
}

test('maps mundane equipment with value into import row shape', () => {
  const row = convert({ name: 'Abacus', source: 'PHB', type: 'G', rarity: 'none', value: 200, page: 150 });
  assert.equal(row.item_type, 'equipment');
  assert.equal(row.base_price_gp, 2);
  assert.equal(row.is_shop_eligible, true);
  assert.equal(row.shop_bucket, 'mundane');
  assert.equal(row.source_slug, 'tst-abacus');
  assert.equal(row.price_source, '5etools_value_cp');
});

test('maps attunement magic item truthfully', () => {
  const row = convert({ name: 'Ring of Testing', rarity: 'rare', reqAttune: 'by a wizard', entries: ['Useful thing.'] });
  assert.equal(row.item_type, 'magic_item');
  assert.equal(row.requires_attunement, true);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.metadata_json.mechanics_support, 'manual_required');
});

test('derives top-level attunement from nested mechanics/runtime signals', () => {
  const row = convert({
    name: 'Nested Signal Wand',
    rarity: 'rare',
    metadata_json: {
      mechanics: {
        requires_attunement: true,
      },
    },
  });
  assert.equal(row.requires_attunement, true);
});

test('keeps explicit non-attunement false when present', () => {
  const row = convert({ name: 'Plain Buckler', type: 'S', reqAttune: false, entries: ['No attunement required.'] });
  assert.equal(row.requires_attunement, false);
});

test('maps weapon-like bonus fields into mechanics support', () => {
  const row = convert({ name: 'Blade of +1', rarity: 'rare', type: 'M', weaponCategory: 'martial', bonusWeapon: '+1' });
  assert.equal(row.item_type, 'weapon');
  assert.equal(row.metadata_json.mechanics_support, 'phase1_supported');
  assert.deepEqual(row.metadata_json.mechanics.passive_effects[0], { type: 'weapon_attack_bonus', value: 1 });
});

test('derives simple +N weapon mechanics from item name when raw bonus fields are absent', () => {
  const row = convert({ name: 'Longsword +2', rarity: 'rare', type: 'M', weaponCategory: 'martial' });
  assert.equal(row.metadata_json.mechanics_support, 'phase1_supported');
  assert.ok(row.metadata_json.mechanics.passive_effects.some((effect) => effect.type === 'weapon_attack_bonus' && effect.value === 2));
});

test('derives simple +N armor mechanics from item name when raw bonus fields are absent', () => {
  const row = convert({ name: 'Shield +1', rarity: 'uncommon', type: 'S' });
  assert.equal(row.metadata_json.mechanics_support, 'phase1_supported');
  assert.ok(row.metadata_json.mechanics.passive_effects.some((effect) => effect.type === 'shield_ac_bonus' && effect.value === 1));
});

test('maps charge/recharge fields into mechanics metadata', () => {
  const row = convert({ name: 'Wand of Charges', rarity: 'rare', charges: 7, recharge: 'dawn', rechargeAmount: 1 });
  assert.equal(row.metadata_json.mechanics.charges.max, 7);
  assert.equal(row.metadata_json.mechanics.recharge.text, 'dawn');
});

test('derives dragon-touched focus tier mechanics for spell attack/save bonuses', () => {
  const row = convert({ name: 'Wakened Dragon-Touched Focus', rarity: 'very rare', reqAttune: 'by a spellcaster', type: 'SCF' });
  assert.equal(row.metadata_json.mechanics_support, 'phase1_supported');
  assert.ok(row.metadata_json.mechanics.passive_effects.some((effect) => effect.type === 'flat_bonus' && effect.target === 'spell_attack' && effect.value === 2));
  assert.ok(row.metadata_json.mechanics.passive_effects.some((effect) => effect.type === 'flat_bonus' && effect.target === 'spell_save_dc' && effect.value === 2));
});

test('maps ability score floor items into supported mechanics payloads', () => {
  const row = convert({
    name: 'Amulet of Health',
    rarity: 'rare',
    reqAttune: true,
    ability: {
      static: { con: 19 },
    },
    wondrous: true,
  });
  assert.equal(row.requires_attunement, true);
  assert.equal(row.metadata_json.mechanics_support, 'phase1_supported');
  assert.equal(row.metadata_json.mechanics.activation_mode, 'equip');
  assert.equal(row.metadata_json.mechanics.slot_family, 'neck');
  assert.deepEqual(row.metadata_json.mechanics.passive_effects, [{ type: 'ability_score_set_min', ability: 'con', min: 19 }]);
});

test('maps all-saves passive bonus families', () => {
  const row = convert({
    name: 'Cloak of Protection',
    rarity: 'uncommon',
    reqAttune: true,
    bonusAc: '+1',
    bonusSavingThrow: '+1',
    wondrous: true,
  });
  assert.equal(row.metadata_json.mechanics_support, 'phase1_supported');
  assert.equal(row.metadata_json.mechanics.activation_mode, 'attunement_only');
  assert.ok(row.metadata_json.mechanics.passive_effects.some((effect) => effect.type === 'all_saves_bonus' && effect.value === 1));
});

test('maps shield ac bonuses to shield-specific effect type', () => {
  const row = convert({ name: 'Arrow-Catching Shield', type: 'S', rarity: 'rare', reqAttune: true, bonusAc: '+2' });
  assert.equal(row.metadata_json.mechanics.slot_family, 'shield');
  assert.ok(row.metadata_json.mechanics.passive_effects.some((effect) => effect.type === 'shield_ac_bonus' && effect.value === 2));
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

test('keeps attunement-gated magic rows non-shop-eligible even when fallback pricing exists', () => {
  const row = convert({ name: 'Moon Sickle +1', source: 'TCE', type: 'M', weaponCategory: 'martial', rarity: 'uncommon', reqAttune: true });
  assert.equal(row.base_price_gp, 600);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.shop_bucket, 'manual_magic_review');
  assert.equal(row.price_source, '5etools_fallback_policy_v1');
});

test('uses curated pricing overlay match for trustworthy 5etools names', () => {
  const row = convert(
    { name: 'Wand of Magic Missiles', rarity: 'uncommon', wand: true },
    {
      pricingOverlayMap: buildOverlayMap({
        normalized_name: 'wand-of-magic-missiles',
        suggested_price_gp: 2000,
        rarity: 'Uncommon',
        shop_bucket: 'combat',
        exclude_from_shop: false,
      }),
    },
  );

  assert.equal(row.base_price_gp, 2000);
  assert.equal(row.price_source, 'shop_magic_pricing_2014_overlay');
  assert.equal(row.is_shop_eligible, true);
  assert.equal(row.shop_bucket, 'combat');
});

test('matches plus-ordering aliases against overlay pricing keys', () => {
  const row = convert(
    { name: 'Rod of the Pact Keeper, +1', rod: true, rarity: 'uncommon' },
    {
      pricingOverlayMap: buildOverlayMap({
        normalized_name: 'rod-of-the-pact-keeper-plus-1',
        suggested_price_gp: 3500,
        rarity: 'Uncommon',
        shop_bucket: 'combat',
        exclude_from_shop: false,
      }),
    },
  );

  assert.equal(row.base_price_gp, 3500);
  assert.equal(row.price_source, 'shop_magic_pricing_2014_overlay');
  assert.equal(row.is_shop_eligible, true);
});

test('matches punctuation-normalized aliases against overlay pricing keys', () => {
  const row = convert(
    { name: "Rhythm-Maker's Drum, +1", rarity: 'uncommon', wondrous: true },
    {
      pricingOverlayMap: buildOverlayMap({
        normalized_name: 'rhythm-makers-drum-plus-1',
        suggested_price_gp: 700,
        rarity: 'Uncommon',
        shop_bucket: 'utility',
        exclude_from_shop: false,
      }),
    },
  );

  assert.equal(row.base_price_gp, 700);
  assert.equal(row.price_source, 'shop_magic_pricing_2014_overlay');
});

test('matches parenthetical alias variants against overlay pricing keys', () => {
  const row = convert(
    { name: 'Shield +1 (Dragonhide)', type: 'S', rarity: 'rare' },
    {
      pricingOverlayMap: buildOverlayMap({
        normalized_name: 'dragonhide-shield-plus-1',
        suggested_price_gp: 4200,
        rarity: 'Rare',
        shop_bucket: 'combat',
        exclude_from_shop: false,
      }),
    },
  );

  assert.equal(row.base_price_gp, 4200);
  assert.equal(row.price_source, 'shop_magic_pricing_2014_overlay');
});

test('keeps overlay-excluded items non-shop-eligible', () => {
  const row = convert(
    { name: 'Deck of Many Things', rarity: 'legendary', wondrous: true },
    {
      pricingOverlayMap: buildOverlayMap({
        normalized_name: 'deck-of-many-things',
        suggested_price_gp: null,
        rarity: 'Legendary',
        shop_bucket: 'unpriced',
        exclude_from_shop: true,
        exclusion_reason: 'explicitly excluded',
      }),
    },
  );

  assert.equal(row.base_price_gp, null);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.shop_bucket, 'unpriced');
  assert.equal(row.price_source, 'shop_magic_pricing_2014_overlay');
});

test('uses constrained fallback pricing for straightforward enhancement items', () => {
  const row = convert({ name: '+1 Weapon', type: 'M', weaponCategory: 'martial', rarity: 'uncommon', bonusWeapon: '+1' });
  assert.equal(row.price_source, '5etools_fallback_policy_v1');
  assert.equal(row.base_price_gp, 600);
  assert.equal(row.is_shop_eligible, true);
  assert.equal(row.shop_bucket, 'combat');
});

test('uses constrained fallback pricing for magic-item enhancement bonus families', () => {
  const row = convert({
    name: '+2 Arcane Grimoire',
    rarity: 'rare',
    reqAttune: 'by a wizard',
    wondrous: true,
    type: 'SCF',
    bonusSpellAttack: '+2',
    bonusSpellSaveDc: '+2',
  });

  assert.equal(row.price_source, '5etools_fallback_policy_v1');
  assert.equal(row.base_price_gp, 5000);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.metadata_json.pricing.fallback_reason, 'enhancement_magic_item_plus_2');
});

test('does not apply generic enhancement fallback to special/high-power outlier items', () => {
  const badExamples = [
    {
      name: "Baba Yaga's Mortar and Pestle",
      rarity: 'artifact',
      bonusSpellAttack: '+3',
      bonusSpellSaveDc: '+3',
    },
    {
      name: 'Teeth of Dahlver-Nar',
      rarity: 'legendary',
      bonusSpellAttack: '+2',
    },
    {
      name: 'Platinum Scarf',
      rarity: 'uncommon',
      bonusWeapon: '+1',
    },
    {
      name: "Jester's Mask",
      rarity: 'very rare',
      bonusSpellAttack: '+3',
    },
  ];

  for (const item of badExamples) {
    const row = convert({
      ...item,
      reqAttune: true,
      wondrous: true,
      type: 'SCF',
    });
    assert.equal(row.price_source, null, `${item.name} should stay unresolved/manual`);
    assert.equal(row.base_price_gp, null, `${item.name} should not receive generic +N fallback pricing`);
    assert.equal(row.metadata_json.pricing.strategy, 'unresolved_manual_review');
  }
});

test('uses deterministic fallback pricing for higher-level spell scroll families', () => {
  const row = convert({ name: 'Spell Scroll (7th Level)', rarity: 'very rare', type: 'SC|DMG' });
  assert.equal(row.price_source, '5etools_fallback_policy_v1');
  assert.equal(row.base_price_gp, 25000);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.metadata_json.pricing.fallback_reason, 'spell_scroll_7th_level');
});

test('uses deterministic fallback pricing for spellwrought tattoo level variants', () => {
  const row = convert({
    name: 'Spellwrought Tattoo (4th Level)',
    rarity: 'rare',
    wondrous: true,
    tattoo: true,
  });
  assert.equal(row.price_source, '5etools_fallback_policy_v1');
  assert.equal(row.base_price_gp, 5000);
  assert.equal(row.is_shop_eligible, false);
  assert.equal(row.metadata_json.pricing.fallback_reason, 'spellwrought_tattoo_4th_level');
});

test('uses curated family matrix fallback pricing for clustered unresolved families', () => {
  const shard = convert({ name: 'Elemental Essence Shard (Fire)', rarity: 'rare', reqAttune: 'by a sorcerer', wondrous: true });
  const tattoo = convert({ name: 'Lightning Absorbing Tattoo', rarity: 'very rare', reqAttune: true, wondrous: true, tattoo: true });
  const vessel = convert({ name: 'Wakened Dragon Vessel', rarity: 'very rare', reqAttune: true, wondrous: true });

  assert.equal(shard.price_source, '5etools_fallback_policy_v1');
  assert.equal(shard.base_price_gp, 5000);
  assert.equal(shard.metadata_json.pricing.fallback_reason, 'curated_family_elemental_essence_shard_rare');

  assert.equal(tattoo.price_source, '5etools_fallback_policy_v1');
  assert.equal(tattoo.base_price_gp, 50000);
  assert.equal(tattoo.metadata_json.pricing.fallback_reason, 'curated_family_absorbing_tattoo_very_rare');

  assert.equal(vessel.price_source, '5etools_fallback_policy_v1');
  assert.equal(vessel.base_price_gp, 50000);
  assert.equal(vessel.metadata_json.pricing.fallback_reason, 'curated_family_dragon_vessel_wakened');
});

test('keeps manuals and tomes as explicit manual-review pricing overrides', () => {
  const manual = convert({ name: 'Manual of Bodily Health', rarity: 'Very Rare', wondrous: true, reqAttune: true });
  const tome = convert({ name: 'Tome of Understanding', rarity: 'Very Rare', wondrous: true, reqAttune: true });

  for (const row of [manual, tome]) {
    assert.equal(row.price_source, null);
    assert.equal(row.base_price_gp, null);
    assert.equal(row.is_shop_eligible, false);
    assert.equal(row.shop_bucket, 'manual_magic_review');
    assert.equal(row.metadata_json.pricing.strategy, 'unresolved_manual_review');
  }
});

test('keeps mundane priced equipment shop-eligible', () => {
  const row = convert({ name: 'Bedroll', source: 'PHB', type: 'G', rarity: 'none', value: 100 });
  assert.equal(row.base_price_gp, 1);
  assert.equal(row.is_shop_eligible, true);
  assert.equal(row.shop_bucket, 'mundane');
});



test('excludes treasure/economy clutter families from active lane artifact policy', () => {
  const gemRow = convert({ name: 'Alexandrite', source: 'DMG', type: '$G', value: 50000 });
  const artRow = convert({ name: 'Fancy Chalice', source: 'DMG', type: '$A', value: 25000 });
  const coinRow = convert({ name: 'Gold (gp)', source: 'PHB', type: '$C', value: 100 });
  const shipRow = convert({ name: 'Airship', source: 'DMG', type: 'AIR|DMG', value: 2000000 });

  for (const row of [gemRow, artRow, coinRow, shipRow]) {
    assert.equal(row.metadata_json.catalog_admission.active_lane_decision, 'excluded');
    assert.equal(row.metadata_json.catalog_admission.include_in_active_lane, false);
    assert.equal(row.is_shop_eligible, false);
    assert.equal(row.shop_bucket, 'catalog_noise_excluded');
  }
});

test('demotes hazardous poisons/explosives to non-shop by default', () => {
  const poisonRow = convert({ name: "Assassin's Blood", source: 'DMG', type: 'G', poison: true, value: 15000 });
  const explosiveRow = convert({ name: 'Bomb', source: 'DMG', type: 'EXP|DMG', value: 15000 });

  for (const row of [poisonRow, explosiveRow]) {
    assert.equal(row.metadata_json.catalog_admission.active_lane_decision, 'demoted_non_shop');
    assert.equal(row.metadata_json.catalog_admission.include_in_active_lane, true);
    assert.equal(row.is_shop_eligible, false);
    assert.equal(row.shop_bucket, 'hazardous_non_default');
  }
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
