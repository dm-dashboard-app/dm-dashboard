import { formatSpellScrollName, generateSpellScrollBatch, getEligibleSpellsForLevel } from './spellScrolls';

const SPELLS = [
  { id: 'c-fire', name: 'Fire Bolt', level: 0, is_cantrip: true },
  { id: 'm-missile', name: 'Magic Missile', level: 1, is_cantrip: false },
  { id: 'shield', name: 'Shield', level: 1, is_cantrip: false },
  { id: 'mage-armor', name: 'Mage Armor', level: 1, is_cantrip: false },
  { id: 'scorching', name: 'Scorching Ray', level: 2, is_cantrip: false },
];

describe('spell scroll helpers', () => {
  test('formats locked spell scroll display name', () => {
    expect(formatSpellScrollName(3, 'Fireball')).toBe('Spell Scroll (3rd Level) — Fireball');
  });

  test('eligible source pool excludes cantrips and respects exact selected level', () => {
    const levelOne = getEligibleSpellsForLevel(SPELLS, 1);
    expect(levelOne.map(spell => spell.name)).toEqual(expect.arrayContaining(['Magic Missile', 'Shield', 'Mage Armor']));
    expect(levelOne.some(spell => spell.level === 0)).toBe(false);
    expect(levelOne.every(spell => Number(spell.level) === 1)).toBe(true);
  });

  test('multiple generation prefers unique spells when enough are available', () => {
    const rows = generateSpellScrollBatch(SPELLS, { level: 1, quantity: 3 });
    const unique = new Set(rows.map(row => row.name));
    expect(rows).toHaveLength(3);
    expect(unique.size).toBe(3);
    expect(rows.every(row => row.scroll_name.includes('Spell Scroll (1st Level) — '))).toBe(true);
  });

  test('duplicates are allowed only when requested quantity exceeds unique pool', () => {
    const rows = generateSpellScrollBatch(SPELLS, { level: 2, quantity: 3 });
    const unique = new Set(rows.map(row => row.name));
    expect(rows).toHaveLength(3);
    expect(unique.size).toBe(1);
    expect(rows.every(row => row.name === 'Scorching Ray')).toBe(true);
  });
});
