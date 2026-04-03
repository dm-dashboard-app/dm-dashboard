import { getClassLevel } from './classResources';

const FULL_CASTER_CLASSES = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
const HALF_CASTER_CLASSES = ['paladin', 'ranger'];
const PACT_CASTER_CLASSES = ['warlock'];
const PREPARED_CLASSES = ['cleric', 'druid', 'paladin'];
const KNOWN_CLASSES = ['bard', 'ranger', 'sorcerer', 'warlock'];

export const SPELL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'cantrip', label: 'Cantrips' },
  { value: 'concentration', label: 'Concentration' },
  { value: 'ritual', label: 'Ritual' },
  { value: 'level-1', label: 'L1' },
  { value: 'level-2', label: 'L2' },
  { value: 'level-3', label: 'L3' },
  { value: 'level-4', label: 'L4' },
  { value: 'level-5', label: 'L5' },
  { value: 'level-6', label: 'L6' },
  { value: 'level-7', label: 'L7' },
  { value: 'level-8', label: 'L8' },
  { value: 'level-9', label: 'L9' },
];

function normalizeClassName(name) {
  return String(name || '').trim().toLowerCase();
}

export function titleCase(name) {
  const value = String(name || '').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function getTotalLevel(profile = {}) {
  return Math.max(0, Number(profile.class_level || 0)) + Math.max(0, Number(profile.class_level_2 || 0));
}

function getProficiencyBonus(level) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function getSpellcastingModifier(profile = {}) {
  const totalLevel = getTotalLevel(profile);
  const proficiency = getProficiencyBonus(totalLevel);
  const dc = Number(profile.spell_save_dc || 0);
  if (!dc) return 0;
  return Math.max(-5, dc - 8 - proficiency);
}

export function getCasterMode(className) {
  if (className === 'wizard') return 'wizard';
  if (PREPARED_CLASSES.includes(className)) return 'prepared';
  if (KNOWN_CLASSES.includes(className)) return 'known';
  return 'manual';
}

export function getMaxSpellLevelForClass(className, classLevel) {
  const level = Number(classLevel || 0);
  if (level <= 0) return 0;
  if (FULL_CASTER_CLASSES.includes(className)) {
    if (level >= 17) return 9;
    if (level >= 15) return 8;
    if (level >= 13) return 7;
    if (level >= 11) return 6;
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }
  if (HALF_CASTER_CLASSES.includes(className)) {
    if (level < 2) return 0;
    if (level >= 17) return 5;
    if (level >= 13) return 4;
    if (level >= 9) return 3;
    if (level >= 5) return 2;
    return 1;
  }
  if (PACT_CASTER_CLASSES.includes(className)) {
    if (level >= 9) return 5;
    if (level >= 7) return 4;
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }
  return 0;
}

export function getPreparedCap(profile = {}, className, classLevel) {
  const level = Number(classLevel || 0);
  const spellMod = getSpellcastingModifier(profile);
  if (className === 'paladin') return Math.max(1, Math.floor(level / 2) + spellMod);
  if (className === 'cleric' || className === 'druid' || className === 'wizard') return Math.max(1, level + spellMod);
  return 0;
}

export function getClassEntries(profile = {}) {
  const entries = [];
  const primaryClass = normalizeClassName(profile.class_name);
  const secondaryClass = normalizeClassName(profile.class_name_2);
  if (primaryClass) {
    const primaryLevel = getClassLevel(profile, primaryClass);
    entries.push({
      key: primaryClass,
      className: primaryClass,
      label: titleCase(primaryClass),
      level: primaryLevel,
      mode: getCasterMode(primaryClass),
      maxSpellLevel: getMaxSpellLevelForClass(primaryClass, primaryLevel),
      prepCap: getPreparedCap(profile, primaryClass, primaryLevel),
    });
  }
  if (secondaryClass && secondaryClass !== primaryClass) {
    const secondaryLevel = getClassLevel(profile, secondaryClass);
    entries.push({
      key: secondaryClass,
      className: secondaryClass,
      label: titleCase(secondaryClass),
      level: secondaryLevel,
      mode: getCasterMode(secondaryClass),
      maxSpellLevel: getMaxSpellLevelForClass(secondaryClass, secondaryLevel),
      prepCap: getPreparedCap(profile, secondaryClass, secondaryLevel),
    });
  }
  return entries.filter(entry => entry.level > 0);
}

export function hasPreparationRequirement(profile = {}) {
  return getClassEntries(profile).some(entry => entry.mode === 'prepared' || entry.mode === 'wizard');
}

export function getPreparedCapTotal(profile = {}) {
  return getClassEntries(profile)
    .filter(entry => entry.mode === 'prepared' || entry.mode === 'wizard')
    .reduce((sum, entry) => sum + (entry.prepCap || 0), 0);
}

export function normalizeClassTags(raw) {
  if (Array.isArray(raw)) return raw.map(v => normalizeClassName(v)).filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map(v => normalizeClassName(v)).filter(Boolean);
}

function readBool(obj, keys, fallback = false) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, key)) return !!obj[key];
  }
  return fallback;
}

function readText(obj, keys, fallback = '') {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
}

function readNumber(obj, keys, fallback = 0) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') {
      const n = parseInt(value, 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

export function getSpellRecord(row = {}) {
  const spell = row.spells || row.spell || row || {};
  const classTags = normalizeClassTags(spell.class_tags || spell.class_tag_list || spell.classes);
  return {
    rowId: row.id || null,
    spellId: row.spell_id || spell.id,
    name: readText(spell, ['name'], 'Unnamed Spell'),
    level: readNumber(spell, ['level'], 0),
    school: readText(spell, ['school'], ''),
    castingTime: readText(spell, ['casting_time'], ''),
    rangeText: readText(spell, ['range_text'], ''),
    durationText: readText(spell, ['duration_text'], ''),
    componentsText: readText(spell, ['components_text'], ''),
    materialText: readText(spell, ['material_text'], ''),
    description: readText(spell, ['description'], ''),
    higherLevel: readText(spell, ['higher_level'], ''),
    concentration: readBool(spell, ['concentration', 'is_concentration'], false),
    ritual: readBool(spell, ['ritual', 'is_ritual'], false),
    classTags,
    prepared: readBool(row, ['is_prepared', 'prepared'], false),
    known: readBool(row, ['is_known', 'known'], true),
    spell: { ...spell, class_tags: classTags },
  };
}

export function sortSpells(spells = []) {
  return [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function getSpellRowMap(rows = []) {
  return Object.fromEntries((rows || []).map(row => [row.spellId, row]));
}

export function spellMatchesClass(spell, className) {
  return normalizeClassTags(spell.classTags || spell.class_tags || []).includes(normalizeClassName(className));
}

export function spellIsLegalForClass(spell, classEntry) {
  if (!spellMatchesClass(spell, classEntry.className)) return false;
  if (Number(spell.level) === 0) return true;
  return Number(spell.level) <= Number(classEntry.maxSpellLevel || 0);
}

function dedupeSpells(spells = []) {
  const seen = new Map();
  spells.forEach(spell => {
    if (!spell?.spellId) return;
    if (!seen.has(spell.spellId)) seen.set(spell.spellId, spell);
  });
  return Array.from(seen.values());
}

export function getPreparedRuntimeSpells(profile = {}, rows = []) {
  return sortSpells(dedupeSpells(rows.filter(row => row.prepared || row.level === 0)));
}

export function getKnownRuntimeSpells(profile = {}, rows = []) {
  return sortSpells(dedupeSpells(rows.filter(row => row.known || row.level === 0)));
}

export function getPreparedPreparationSpells(profile = {}, allSpells = [], rows = []) {
  const rowMap = getSpellRowMap(rows);
  const classEntries = getClassEntries(profile);
  const preparedEntries = classEntries.filter(entry => entry.mode === 'prepared');
  const wizardEntries = classEntries.filter(entry => entry.mode === 'wizard');
  const spells = [];

  allSpells.forEach(rawSpell => {
    const spell = getSpellRecord(rawSpell);
    if (spell.level === 0) return;
    if (preparedEntries.some(entry => spellIsLegalForClass(spell, entry))) {
      const row = rowMap[spell.spellId];
      spells.push({ ...spell, prepared: !!row?.prepared, known: row ? !!row.known : true, rowId: row?.rowId || null });
    }
  });

  rows.forEach(row => {
    if (row.level === 0 || !row.known) return;
    if (wizardEntries.some(entry => spellMatchesClass(row, entry.className))) {
      const rowMatch = rowMap[row.spellId];
      spells.push({ ...row, prepared: !!rowMatch?.prepared, known: true, rowId: rowMatch?.rowId || row.rowId || null });
    }
  });

  return sortSpells(dedupeSpells(spells));
}

export function matchesSpellFilter(spell, filter = 'all') {
  if (filter === 'all') return true;
  if (filter === 'cantrip') return Number(spell.level) === 0;
  if (filter === 'concentration') return !!spell.concentration;
  if (filter === 'ritual') return !!spell.ritual;
  if (filter.startsWith('level-')) return Number(spell.level) === Number(filter.replace('level-', ''));
  return true;
}

export function getAccessibleConcentrationSpells(profile = {}, rows = []) {
  const candidates = dedupeSpells([...getPreparedRuntimeSpells(profile, rows), ...getKnownRuntimeSpells(profile, rows)]);
  return sortSpells(candidates.filter(spell => spell.concentration));
}

export function getSpellSummary(spell = {}) {
  return [spell.school, spell.castingTime, spell.rangeText, spell.durationText].filter(Boolean).join(' • ');
}
