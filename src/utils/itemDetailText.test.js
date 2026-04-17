import { getItemMechanicsSummary } from './itemDetailText';

describe('getItemMechanicsSummary', () => {
  test('returns a readable mechanics summary for supported items', () => {
    const lines = getItemMechanicsSummary({
      requires_attunement: true,
      metadata_json: {
        mechanics_support: 'phase1_supported',
        mechanics: {
          slot_family: 'ring',
          activation_mode: 'equip',
          passive_effects: [
            { type: 'ac_flat', value: 1 },
            { type: 'spell_save_dc_bonus', value: 1 },
            { type: 'ability_score_set_min', ability: 'con', min: 19 },
          ],
          charges: {
            max: 7,
            recharge: 'long_rest',
            allow_when_unattuned: true,
          },
        },
      },
    });

    expect(lines).toEqual(
      expect.arrayContaining([
        { label: 'Requires Attunement', value: 'Yes' },
        { label: 'Slot', value: 'Ring' },
        { label: 'Activation', value: 'Equip' },
        { label: 'AC Bonus', value: '+1' },
        { label: 'Spell Save DC Bonus', value: '+1' },
        { label: 'Ability Floor', value: 'Set CON minimum 19' },
        { label: 'Charges', value: 'Max 7' },
        { label: 'Recharge', value: 'Long Rest' },
        { label: 'Recharge While Unattuned', value: 'Yes' },
      ]),
    );
  });

  test('returns empty mechanics summary for unsupported items with no mechanics', () => {
    expect(getItemMechanicsSummary({ metadata_json: { mechanics_support: 'unsupported' } })).toEqual([]);
  });
});
