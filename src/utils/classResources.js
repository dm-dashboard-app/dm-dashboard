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

export const HIT_DIE_SIZES = [6, 8, 10, 12];

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

export function getClassEntries(source = {}) {
  const entries = [];

  if (source.class_name) {
    entries.push({
      className: normalizeText(source.class_name),
      displayClass: source.class_name,
      subclassName: normalizeText(source.subclass_name),
      level: Math.max(0, toInt(source.class_level, 0)),
    });
  }

  if (source.class_name_2) {
    entries.push({
      className: normalizeText(source.class_name_2),
      displayClass: source.class_name_2,
      subclassName: normalizeText(source.subclass_name_2),
      level: Math.max(0, toInt(source.class_level_2, 0)),
    });
  }

  return entries.filter(entry => entry.className);
}

export function getClassLevel(source = {}, targetClass) {
  const wanted = normalizeText(targetClass);
  return getClassEntries(source)
    .filter(entry => entry.className === wanted)
    .reduce((sum, entry) => sum + (entry.level || 0), 0);
}

export function hasClass(source = {}, targetClass) {
  return getClassLevel(source, targetClass) > 0;
}

export function getTotalLevel(source = {}) {
  return getClassEntries(source).reduce((sum, entry) => sum + (entry.level || 0), 0);
}

export function getHighestHitDie(source = {}, fallback = 8) {
  const dice = getClassEntries(source)
    .map(entry => CLASS_HIT_DIE[entry.className] || 0)
    .filter(Boolean);

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

  return HIT_DIE_SIZES
    .filter(size => (pools[size] || 0) > 0)
    .map(size => `${pools[size]} × d${size}`)
    .join(' • ');
}

function getProficiencyBonus(totalLevel) {
  if (totalLevel <= 0) return 0;
  if (totalLevel <= 4) return 2;
  if (totalLevel <= 8) return 3;
  if (totalLevel <= 12) return 4;
  if (totalLevel <= 16) return 5;
  return 6;
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
  const fighterEntry = getClassEntries(source).find(
    entry =>
      entry.className === 'fighter' &&
      (entry.subclassName === 'battle master' || entry.subclassName === 'battlemaster')
  );
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

  return compactObject({
    hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined,
    hit_dice_max: totalLevel > 0 ? totalLevel : undefined,
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
  const paladinLevel = getClassLevel(source, 'paladin');
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

    natural_recovery_available: druidLevel > 0 ? true : undefined,
    natural_recovery_used: druidLevel > 0 ? false : undefined,

    relentless_endurance_available:
      source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc'
        ? true
        : undefined,
    relentless_endurance_used:
      source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc'
        ? false
        : undefined,
  });
}

export function deriveCombatantResourceFields() {
  return {};
}
