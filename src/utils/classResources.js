const CLASS_HIT_DIE = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};

const CLASS_SAVE_PROFICIENCIES = {
  barbarian: ['str', 'con'],
  bard: ['dex', 'cha'],
  cleric: ['wis', 'cha'],
  druid: ['int', 'wis'],
  fighter: ['str', 'con'],
  monk: ['str', 'dex'],
  paladin: ['wis', 'cha'],
  ranger: ['str', 'dex'],
  rogue: ['dex', 'int'],
  sorcerer: ['con', 'cha'],
  warlock: ['wis', 'cha'],
  wizard: ['int', 'wis'],
};

const FULL_CASTER_CLASSES = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
const HALF_CASTER_CLASSES = ['paladin', 'ranger'];

const SPELL_SLOT_TABLE = {
  0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

export const HIT_DIE_SIZES = [6, 8, 10, 12];
export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const DEFAULT_ABILITY_SCORE = 10;
export const SKILL_DEFINITIONS = [
  { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { key: 'animal_handling', label: 'Animal Handling', ability: 'wis' },
  { key: 'arcana', label: 'Arcana', ability: 'int' },
  { key: 'athletics', label: 'Athletics', ability: 'str' },
  { key: 'deception', label: 'Deception', ability: 'cha' },
  { key: 'history', label: 'History', ability: 'int' },
  { key: 'insight', label: 'Insight', ability: 'wis' },
  { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { key: 'investigation', label: 'Investigation', ability: 'int' },
  { key: 'medicine', label: 'Medicine', ability: 'wis' },
  { key: 'nature', label: 'Nature', ability: 'int' },
  { key: 'perception', label: 'Perception', ability: 'wis' },
  { key: 'performance', label: 'Performance', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
  { key: 'religion', label: 'Religion', ability: 'int' },
  { key: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', label: 'Stealth', ability: 'dex' },
  { key: 'survival', label: 'Survival', ability: 'wis' },
];

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

export function clampAbilityScore(value) {
  const n = toInt(value, DEFAULT_ABILITY_SCORE);
  return Math.max(1, Math.min(30, n));
}

export function getAbilityModifier(score) {
  const safeScore = clampAbilityScore(score);
  return Math.floor((safeScore - 10) / 2);
}

export function formatModifier(mod) {
  const n = toInt(mod, 0);
  return n >= 0 ? `+${n}` : `${n}`;
}

export function getClassEntries(source = {}) {
  const entries = [];
  if (source.class_name) {
    entries.push({ className: normalizeText(source.class_name), displayClass: source.class_name, subclassName: normalizeText(source.subclass_name), level: Math.max(0, toInt(source.class_level, 0)) });
  }
  if (source.class_name_2) {
    entries.push({ className: normalizeText(source.class_name_2), displayClass: source.class_name_2, subclassName: normalizeText(source.subclass_name_2), level: Math.max(0, toInt(source.class_level_2, 0)) });
  }
  return entries.filter(entry => entry.className);
}

export function getPrimaryClassName(source = {}) {
  const entries = getClassEntries(source);
  return entries[0]?.className || '';
}

export function getClassLevel(source = {}, targetClass) {
  const wanted = normalizeText(targetClass);
  return getClassEntries(source).filter(entry => entry.className === wanted).reduce((sum, entry) => sum + (entry.level || 0), 0);
}

export function hasClass(source = {}, targetClass) {
  return getClassLevel(source, targetClass) > 0;
}

export function getTotalLevel(source = {}) {
  return getClassEntries(source).reduce((sum, entry) => sum + (entry.level || 0), 0);
}

export function getProficiencyBonus(totalLevel) {
  if (totalLevel <= 0) return 0;
  if (totalLevel <= 4) return 2;
  if (totalLevel <= 8) return 3;
  if (totalLevel <= 12) return 4;
  if (totalLevel <= 16) return 5;
  return 6;
}

export function getAbilityScores(source = {}) {
  return Object.fromEntries(
    ABILITY_KEYS.map(key => [key, clampAbilityScore(source[`ability_${key}`] ?? DEFAULT_ABILITY_SCORE)])
  );
}

export function getAbilityModifiers(source = {}) {
  const scores = getAbilityScores(source);
  return Object.fromEntries(
    ABILITY_KEYS.map(key => [key, getAbilityModifier(scores[key])])
  );
}

export function getSaveProficiencies(source = {}) {
  const primaryClass = getPrimaryClassName(source);
  const profs = CLASS_SAVE_PROFICIENCIES[primaryClass] || [];
  return Object.fromEntries(ABILITY_KEYS.map(key => [key, profs.includes(key)]));
}

export function getSavingThrowTotals(source = {}) {
  const modifiers = getAbilityModifiers(source);
  const saveProficiencies = getSaveProficiencies(source);
  const proficiencyBonus = getProficiencyBonus(getTotalLevel(source));
  return Object.fromEntries(
    ABILITY_KEYS.map(key => [key, modifiers[key] + (saveProficiencies[key] ? proficiencyBonus : 0)])
  );
}

export function getSkillRank(source = {}, skillKey) {
  return Math.max(0, Math.min(2, toInt(source[`skill_${skillKey}_rank`], 0)));
}

export function getSkillTotals(source = {}) {
  const modifiers = getAbilityModifiers(source);
  const proficiencyBonus = getProficiencyBonus(getTotalLevel(source));
  return Object.fromEntries(
    SKILL_DEFINITIONS.map(skill => {
      const rank = getSkillRank(source, skill.key);
      const multiplier = rank === 2 ? 2 : rank === 1 ? 1 : 0;
      return [skill.key, modifiers[skill.ability] + (proficiencyBonus * multiplier)];
    })
  );
}

export function getHighestHitDie(source = {}, fallback = 8) {
  const dice = getClassEntries(source).map(entry => CLASS_HIT_DIE[entry.className] || 0).filter(Boolean);
  return dice.length > 0 ? Math.max(...dice) : fallback;
}

export function getHitDiePools(source = {}) {
  const pools = { 6: 0, 8: 0, 10: 0, 12: 0 };
  getClassEntries(source).forEach(entry => {
    const dieSize = CLASS_HIT_DIE[entry.className];
    if (!dieSize) return;
    pools[dieSize] = (pools[dieSize] || 0) + (entry.level || 0);
  });
  return pools;
}

export function formatHitDiceSummary(source = {}) {
  const pools = getHitDiePools(source);
  return HIT_DIE_SIZES.filter(size => (pools[size] || 0) > 0).map(size => `${pools[size]} × d${size}`).join(' • ');
}

export function getStandardCasterLevel(source = {}) {
  const entries = getClassEntries(source);
  return entries.reduce((sum, entry) => {
    if (FULL_CASTER_CLASSES.includes(entry.className)) return sum + entry.level;
    if (HALF_CASTER_CLASSES.includes(entry.className)) return sum + Math.floor(entry.level / 2);
    return sum;
  }, 0);
}

export function getStandardSpellSlots(source = {}) {
  const casterLevel = Math.max(0, Math.min(20, getStandardCasterLevel(source)));
  const slots = SPELL_SLOT_TABLE[casterLevel] || SPELL_SLOT_TABLE[0];
  const result = {};
  for (let level = 1; level <= 9; level += 1) result[`slots_max_${level}`] = slots[level - 1] || 0;
  return result;
}

export function formatStandardSpellSlotsSummary(source = {}) {
  const slots = getStandardSpellSlots(source);
  return Array.from({ length: 9 }, (_, index) => index + 1).filter(level => (slots[`slots_max_${level}`] || 0) > 0).map(level => `L${level} ${slots[`slots_max_${level}`]}`).join(' • ');
}

function getBardicInspirationDie(level) {
  if (level >= 15) return 'd12';
  if (level >= 10) return 'd10';
  if (level >= 5) return 'd8';
  if (level >= 1) return 'd6';
  return '';
}

function getWarlockSlotProgression(level) {
  if (level <= 0) return { slots: 0, slotLevel: 0 };
  if (level === 1) return { slots: 1, slotLevel: 1 };
  if (level >= 2 && level <= 10) return { slots: 2, slotLevel: Math.ceil(level / 2) };
  if (level >= 11 && level <= 16) return { slots: 3, slotLevel: 5 };
  return { slots: 4, slotLevel: 5 };
}

function getBarbarianRages(level) {
  if (level <= 0) return 0;
  if (level >= 1 && level <= 2) return 2;
  if (level >= 3 && level <= 5) return 3;
  if (level >= 6 && level <= 11) return 4;
  if (level >= 12 && level <= 16) return 5;
  if (level >= 17 && level <= 19) return 6;
  return 999;
}

function getFighterActionSurges(level) {
  if (level <= 0) return 0;
  return level >= 17 ? 2 : 1;
}

function getPaladinChannelDivinity(level) {
  if (level < 3) return 0;
  return 1;
}

function getClericChannelDivinity(level) {
  if (level < 2) return 0;
  if (level >= 18) return 3;
  if (level >= 6) return 2;
  return 1;
}

function getChannelDivinityUses(source = {}) {
  const cleric = getClassLevel(source, 'cleric');
  const paladin = getClassLevel(source, 'paladin');
  return Math.max(getClericChannelDivinity(cleric), getPaladinChannelDivinity(paladin));
}

function getLayOnHandsPool(source = {}) {
  const paladin = getClassLevel(source, 'paladin');
  return paladin > 0 ? paladin * 5 : 0;
}

function getBattleMasterLevel(source = {}) {
  const fighterEntry = getClassEntries(source).find(entry => entry.className === 'fighter' && (entry.subclassName === 'battle master' || entry.subclassName === 'battlemaster'));
  return fighterEntry?.level || 0;
}

function getSuperiorityDieSize(level) {
  if (level >= 18) return 'd12';
  if (level >= 10) return 'd10';
  if (level >= 3) return 'd8';
  return '';
}

function getSuperiorityDiceCount(level) {
  if (level >= 15) return 6;
  if (level >= 3) return 4;
  return 0;
}

export function derivePlayerProfileDefaults(source = {}) {
  const totalLevel = getTotalLevel(source);
  const druidLevel = getClassLevel(source, 'druid');
  const saveTotals = getSavingThrowTotals(source);
  const skillTotals = getSkillTotals(source);
  const abilityScores = getAbilityScores(source);

  return compactObject({
    ability_str: abilityScores.str,
    ability_dex: abilityScores.dex,
    ability_con: abilityScores.con,
    ability_int: abilityScores.int,
    ability_wis: abilityScores.wis,
    ability_cha: abilityScores.cha,
    hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined,
    hit_dice_max: totalLevel > 0 ? totalLevel : undefined,
    ...getStandardSpellSlots(source),
    save_str: saveTotals.str,
    save_dex: saveTotals.dex,
    save_con: saveTotals.con,
    save_int: saveTotals.int,
    save_wis: saveTotals.wis,
    save_cha: saveTotals.cha,
    ...Object.fromEntries(SKILL_DEFINITIONS.map(skill => [`skill_${skill.key}`, skillTotals[skill.key]])),
    wildshape_enabled: druidLevel > 0,
  });
}

export function derivePlayerEncounterStateResources(source = {}) {
  const totalLevel = getTotalLevel(source);
  const proficiencyBonus = getProficiencyBonus(totalLevel);
  const hitDiePools = getHitDiePools(source);
  const bardLevel = getClassLevel(source, 'bard');
  const monkLevel = getClassLevel(source, 'monk');
  const warlockLevel = getClassLevel(source, 'warlock');
  const fighterLevel = getClassLevel(source, 'fighter');
  const barbarianLevel = getClassLevel(source, 'barbarian');
  const sorcererLevel = getClassLevel(source, 'sorcerer');
  const wizardLevel = getClassLevel(source, 'wizard');
  const druidLevel = getClassLevel(source, 'druid');
  const battleMasterLevel = getBattleMasterLevel(source);
  const { slots: warlockSlots, slotLevel: warlockSlotLevel } = getWarlockSlotProgression(warlockLevel);
  const superiorityDice = getSuperiorityDiceCount(battleMasterLevel);
  const superiorityDieSize = getSuperiorityDieSize(battleMasterLevel);
  const rageUses = getBarbarianRages(barbarianLevel);
  const channelDivinityUses = getChannelDivinityUses(source);
  const layOnHands = getLayOnHandsPool(source);
  const bardicInspirationDie = getBardicInspirationDie(bardLevel);

  return compactObject({
    temp_hp: 0,
    hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined,
    hit_dice_max: totalLevel > 0 ? totalLevel : undefined,
    hit_dice_current: totalLevel > 0 ? totalLevel : undefined,
    hit_dice_d6_max: hitDiePools[6] > 0 ? hitDiePools[6] : undefined,
    hit_dice_d6_current: hitDiePools[6] > 0 ? hitDiePools[6] : undefined,
    hit_dice_d8_max: hitDiePools[8] > 0 ? hitDiePools[8] : undefined,
    hit_dice_d8_current: hitDiePools[8] > 0 ? hitDiePools[8] : undefined,
    hit_dice_d10_max: hitDiePools[10] > 0 ? hitDiePools[10] : undefined,
    hit_dice_d10_current: hitDiePools[10] > 0 ? hitDiePools[10] : undefined,
    hit_dice_d12_max: hitDiePools[12] > 0 ? hitDiePools[12] : undefined,
    hit_dice_d12_current: hitDiePools[12] > 0 ? hitDiePools[12] : undefined,
    bardic_inspiration_max: bardLevel > 0 ? proficiencyBonus : undefined,
    bardic_inspiration_current: bardLevel > 0 ? proficiencyBonus : undefined,
    bardic_inspiration_die: bardicInspirationDie || undefined,
    ki_points_max: monkLevel > 0 ? monkLevel : undefined,
    ki_points_current: monkLevel > 0 ? monkLevel : undefined,
    warlock_slots_max: warlockSlots > 0 ? warlockSlots : undefined,
    warlock_slots_current: warlockSlots > 0 ? warlockSlots : undefined,
    warlock_slots_level: warlockSlotLevel > 0 ? warlockSlotLevel : undefined,
    action_surge_max: fighterLevel > 0 ? getFighterActionSurges(fighterLevel) : undefined,
    action_surge_current: fighterLevel > 0 ? getFighterActionSurges(fighterLevel) : undefined,
    second_wind_available: fighterLevel > 0 ? true : undefined,
    superiority_dice_max: superiorityDice > 0 ? superiorityDice : undefined,
    superiority_dice_current: superiorityDice > 0 ? superiorityDice : undefined,
    superiority_die_size: superiorityDieSize || undefined,
    rage_max: barbarianLevel > 0 ? rageUses : undefined,
    rage_current: barbarianLevel > 0 ? rageUses : undefined,
    sorcery_points_max: sorcererLevel > 0 ? sorcererLevel : undefined,
    sorcery_points_current: sorcererLevel > 0 ? sorcererLevel : undefined,
    channel_divinity_max: channelDivinityUses > 0 ? channelDivinityUses : undefined,
    channel_divinity_current: channelDivinityUses > 0 ? channelDivinityUses : undefined,
    lay_on_hands_max: layOnHands > 0 ? layOnHands : undefined,
    lay_on_hands_current: layOnHands > 0 ? layOnHands : undefined,
    arcane_recovery_available: wizardLevel > 0 ? true : undefined,
    arcane_recovery_used: wizardLevel > 0 ? false : undefined,
    wildshape_uses_remaining: druidLevel > 0 ? 2 : undefined,
    fey_step_max: source.feat_fey_step ? proficiencyBonus : undefined,
    fey_step_current: source.feat_fey_step ? proficiencyBonus : undefined,
    celestial_revelation_available: source.feat_celestial_revelation ? true : undefined,
    celestial_revelation_used: source.feat_celestial_revelation ? false : undefined,
    relentless_endurance_available: source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc' ? true : undefined,
    relentless_endurance_used: source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc' ? false : undefined,
  });
}

export function deriveCombatantResourceFields() {
  return {};
}
