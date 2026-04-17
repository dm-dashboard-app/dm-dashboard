import { buildDerivedPlayerStats } from './derivedPlayerStats';

describe('buildDerivedPlayerStats', () => {
  test('layers manual profile bonuses with item effects through shared helper', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_cha: 18,
        class_name: 'warlock',
        class_level: 5,
        spell_save_bonus: 1,
        spell_attack_bonus_mod: 1,
        ac: 12,
        ac_bonus: 2,
      },
      state: {},
      inventoryItems: [
        {
          equipped: true,
          attuned: true,
          requires_attunement: true,
          metadata_json: {
            mechanics_support: 'phase1_supported',
            mechanics: {
              passive_effects: [
                { type: 'spell_save_dc_bonus', value: 1 },
                { type: 'spell_attack_bonus', value: 1 },
                { type: 'ac_flat', value: 1 },
              ],
            },
          },
        },
      ],
    });

    expect(result.spellSaveDc).toBeGreaterThan(0);
    expect(result.spellAttackBonus).toBeGreaterThan(0);
    expect(result.armorClass).toBe(15);
  });
});
