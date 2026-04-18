import { buildDerivedPlayerStats } from './derivedPlayerStats';

describe('buildDerivedPlayerStats', () => {
  test('uses automatic unarmored fallback (10 + dex mod) and ignores legacy profile.ac', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_dex: 14,
        ac: 18,
      },
      state: {},
      inventoryItems: [],
    });

    expect(result.armorClass).toBe(12);
  });

  test('applies Mage Armour formula when active', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_dex: 16,
        ac: 20,
      },
      state: { mage_armour_active: true },
      inventoryItems: [],
    });

    expect(result.armorClass).toBe(16);
  });

  test('active armor formula overrides generic fallback baseline', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_dex: 16,
        ac_bonus: 1,
      },
      state: { mage_armour_active: true },
      inventoryItems: [
        {
          equipped: true,
          metadata_json: {
            mechanics_support: 'phase1_supported',
            mechanics: {
              armor: { base_ac: 14, add_dex: true, dex_cap: 2 },
              passive_effects: [],
            },
          },
        },
      ],
    });

    expect(result.armorClass).toBe(17);
  });

  test('equipped curated-lane mundane armor row applies armor formula to AC', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_dex: 16,
      },
      state: {},
      inventoryItems: [
        {
          equipped: true,
          source_type: 'custom_homebrew_private_seed',
          source_slug: 'phb-leather-armor',
          metadata_json: {
            mechanics_support: 'phase1_supported',
            mechanics: {
              slot_family: 'armor',
              activation_mode: 'equip',
              requires_attunement: false,
              armor: { base_ac: 11, add_dex: true, dex_cap: null },
              passive_effects: [],
            },
          },
        },
      ],
    });

    expect(result.armorClass).toBe(14);
  });

  test('layers shield and flat AC item bonuses and preserves ac_bonus manual override', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_dex: 14,
        ac_bonus: 2,
      },
      state: {},
      inventoryItems: [
        {
          equipped: true,
          metadata_json: {
            mechanics_support: 'phase1_supported',
            mechanics: {
              passive_effects: [
                { type: 'shield_ac_bonus', value: 2 },
                { type: 'ac_flat', value: 1 },
              ],
            },
          },
        },
      ],
    });

    expect(result.armorClass).toBe(17);
  });

  test('continues layering spell bonuses from item effects', () => {
    const result = buildDerivedPlayerStats({
      profile: {
        ability_cha: 18,
        class_name: 'warlock',
        class_level: 5,
        spell_save_bonus: 1,
        spell_attack_bonus_mod: 1,
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
              ],
            },
          },
        },
      ],
    });

    expect(result.spellSaveDc).toBeGreaterThan(0);
    expect(result.spellAttackBonus).toBeGreaterThan(0);
    expect(result.armorClass).toBe(10);
  });
});
