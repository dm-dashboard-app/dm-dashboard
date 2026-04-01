export const CONDITIONS = [
  { code: 'BLD', colour: '#6b5b95' },
  { code: 'CHM', colour: '#e8a0bf' },
  { code: 'DEF', colour: '#888' },
  { code: 'FRG', colour: '#9b2335' },
  { code: 'GRP', colour: '#8b6914' },
  { code: 'INC', colour: '#b5451b' },
  { code: 'INV', colour: '#4a4a7a' },
  { code: 'PAR', colour: '#7a4a9a' },
  { code: 'PET', colour: '#888' },
  { code: 'PSN', colour: '#3a7a3a' },
  { code: 'PRN', colour: '#7a6030' },
  { code: 'RST', colour: '#8b4513' },
  { code: 'STN', colour: '#4a4a7a' },
  { code: 'UNC', colour: '#2a2a3a' },
  { code: 'EXH', colour: '#5a3a7a' },
  { code: 'HEX', colour: '#6a0dad' },
];

export const CONDITION_COLOURS = Object.fromEntries(CONDITIONS.map(c => [c.code, c.colour]));

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

export const MODS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
