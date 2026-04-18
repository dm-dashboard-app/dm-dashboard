import { applyItemEffectsToProfile, classifyInventoryRows, isItemActive } from './itemEffects';

function item(overrides = {}) {
  return {
    equipped: false,
    attuned: false,
    requires_attunement: false,
    metadata_json: { mechanics_support: 'phase1_supported', mechanics: { passive_effects: [] } },
    ...overrides,
  };
}

describe('itemEffects', () => {
  test('attunement-gated slot-bound item is active when attuned and occupying its slot', () => {
    const gated = item({
      equipped: false,
      attuned: false,
      requires_attunement: true,
      metadata_json: { mechanics_support: 'phase1_supported', mechanics: { activation_mode: 'equip', slot_family: 'armor', passive_effects: [] } },
    });
    expect(isItemActive(gated)).toBe(false);
    expect(isItemActive({ ...gated, attuned: true })).toBe(true);
  });

  test('attuned item without slot data still requires explicit equip state', () => {
    const itemRow = item({
      equipped: false,
      attuned: true,
      requires_attunement: true,
      metadata_json: { mechanics_support: 'phase1_supported', mechanics: { activation_mode: 'equip', passive_effects: [] } },
    });
    expect(isItemActive(itemRow)).toBe(false);
    expect(isItemActive({ ...itemRow, equipped: true })).toBe(true);
  });

  test('applies armor, shield, and spell bonuses from active item effects', () => {
    const result = applyItemEffectsToProfile(
      { ac: 10, ability_dex: 14 },
      [
        item({
          equipped: true,
          metadata_json: { mechanics_support: 'phase1_supported', mechanics: { armor: { base_ac: 12, add_dex: true, dex_cap: 2 }, passive_effects: [] } },
        }),
        item({
          equipped: true,
          metadata_json: { mechanics_support: 'phase1_supported', mechanics: { passive_effects: [{ type: 'shield_ac_bonus', value: 2 }, { type: 'spell_save_dc_bonus', value: 1 }] } },
        }),
      ],
    );

    expect(result.acFromItems).toBe(16);
    expect(result.spellSaveDcBonus).toBe(1);
  });

  test('supports ability floor semantics', () => {
    const result = applyItemEffectsToProfile(
      { ability_con: 12, ac: 10 },
      [
        item({
          equipped: true,
          attuned: true,
          requires_attunement: true,
          metadata_json: {
            mechanics_support: 'phase1_supported',
            mechanics: {
              passive_effects: [{ type: 'ability_score_set_min', ability: 'con', min: 19 }],
            },
          },
        }),
      ],
    );

    expect(result.abilityBonus.con).toBe(7);
  });

  test('ignores unsupported mechanics rows', () => {
    const result = applyItemEffectsToProfile(
      { ac: 10, ability_dex: 14 },
      [
        item({
          equipped: true,
          metadata_json: { mechanics_support: 'unsupported', mechanics: { passive_effects: [{ type: 'shield_ac_bonus', value: 99 }] } },
        }),
      ],
    );

    expect(result.acFromItems).toBe(10);
  });

  test('classifies rows into non-overlapping items/equipment/attuned buckets', () => {
    const rows = classifyInventoryRows([
      item({ id: 'a', equipped: true }),
      item({ id: 'b', equipped: true, attuned: true, requires_attunement: true }),
      item({ id: 'c', attuned: true, requires_attunement: true }),
      item({ id: 'd', requires_attunement: true }),
      item({ id: 'e' }),
    ]);
    expect(rows.equipmentRows.map((row) => row.id)).toEqual(['a']);
    expect(rows.attunementRows.map((row) => row.id)).toEqual(['b', 'c']);
    expect(rows.itemRows.map((row) => row.id)).toEqual(['d', 'e']);
  });
});
