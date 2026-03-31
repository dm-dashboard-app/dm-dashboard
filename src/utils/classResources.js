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

const SPELLCASTING_ABILITY_BY_CLASS = {
  bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int',
};

const FULL_CASTER_CLASSES = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
const HALF_CASTER_CLASSES = ['paladin', 'ranger'];
const SPELLCASTER_PRIORITY = ['wizard', 'sorcerer', 'warlock', 'bard', 'cleric', 'druid', 'paladin', 'ranger'];

const SPELL_SLOT_TABLE = {
  0: [0,0,0,0,0,0,0,0,0],1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],4:[4,3,0,0,0,0,0,0,0],5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],9:[4,3,3,3,1,0,0,0,0],10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1],
};

export const HIT_DIE_SIZES = [6, 8, 10, 12];
export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const DEFAULT_ABILITY_SCORE = 10;
export const SKILL_DEFINITIONS = [
  { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' }, { key: 'animal_handling', label: 'Animal Handling', ability: 'wis' }, { key: 'arcana', label: 'Arcana', ability: 'int' }, { key: 'athletics', label: 'Athletics', ability: 'str' }, { key: 'deception', label: 'Deception', ability: 'cha' }, { key: 'history', label: 'History', ability: 'int' }, { key: 'insight', label: 'Insight', ability: 'wis' }, { key: 'intimidation', label: 'Intimidation', ability: 'cha' }, { key: 'investigation', label: 'Investigation', ability: 'int' }, { key: 'medicine', label: 'Medicine', ability: 'wis' }, { key: 'nature', label: 'Nature', ability: 'int' }, { key: 'perception', label: 'Perception', ability: 'wis' }, { key: 'performance', label: 'Performance', ability: 'cha' }, { key: 'persuasion', label: 'Persuasion', ability: 'cha' }, { key: 'religion', label: 'Religion', ability: 'int' }, { key: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'dex' }, { key: 'stealth', label: 'Stealth', ability: 'dex' }, { key: 'survival', label: 'Survival', ability: 'wis' },
];

export function toInt(value, fallback = 0) { const n = parseInt(value, 10); return Number.isFinite(n) ? n : fallback; }
function normalizeText(value) { return String(value || '').trim().toLowerCase(); }
function compactObject(obj) { return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)); }
export function findExistingKey(source, candidates = []) { if (!source) return null; for (const key of candidates) if (Object.prototype.hasOwnProperty.call(source, key)) return key; return null; }
export function readNumberField(source, candidates = [], fallback = null) { const key = findExistingKey(source, candidates); if (!key) return fallback; const raw = source[key]; if (raw === null || raw === undefined || raw === '') return fallback; const n = parseInt(raw, 10); return Number.isFinite(n) ? n : fallback; }
export function readBooleanField(source, candidates = [], fallback = null) { const key = findExistingKey(source, candidates); if (!key) return fallback; const raw = source[key]; if (raw === null || raw === undefined) return fallback; return !!raw; }
export function readTextField(source, candidates = [], fallback = '') { const key = findExistingKey(source, candidates); if (!key) return fallback; const raw = source[key]; if (raw === null || raw === undefined || raw === '') return fallback; return String(raw); }

export function clampAbilityScore(value) { const n = toInt(value, DEFAULT_ABILITY_SCORE); return Math.max(1, Math.min(30, n)); }
export function getAbilityModifier(score) { const safeScore = clampAbilityScore(score); return Math.floor((safeScore - 10) / 2); }
export function formatModifier(mod) { const n = toInt(mod, 0); return n >= 0 ? `+${n}` : `${n}`; }
export function getClassEntries(source = {}) { const entries = []; if (source.class_name) entries.push({ className: normalizeText(source.class_name), displayClass: source.class_name, subclassName: normalizeText(source.subclass_name), level: Math.max(0, toInt(source.class_level, 0)) }); if (source.class_name_2) entries.push({ className: normalizeText(source.class_name_2), displayClass: source.class_name_2, subclassName: normalizeText(source.subclass_name_2), level: Math.max(0, toInt(source.class_level_2, 0)) }); return entries.filter(entry => entry.className); }
export function getPrimaryClassName(source = {}) { return getClassEntries(source)[0]?.className || ''; }
export function getClassLevel(source = {}, targetClass) { const wanted = normalizeText(targetClass); return getClassEntries(source).filter(entry => entry.className === wanted).reduce((sum, entry) => sum + (entry.level || 0), 0); }
export function hasClass(source = {}, targetClass) { return getClassLevel(source, targetClass) > 0; }
export function getTotalLevel(source = {}) { return getClassEntries(source).reduce((sum, entry) => sum + (entry.level || 0), 0); }
export function getProficiencyBonus(totalLevel) { if (totalLevel <= 0) return 0; if (totalLevel <= 4) return 2; if (totalLevel <= 8) return 3; if (totalLevel <= 12) return 4; if (totalLevel <= 16) return 5; return 6; }
export function getAbilityScores(source = {}) { return Object.fromEntries(ABILITY_KEYS.map(key => [key, clampAbilityScore(source[`ability_${key}`] ?? DEFAULT_ABILITY_SCORE)])); }
export function getAbilityModifiers(source = {}) { const scores = getAbilityScores(source); return Object.fromEntries(ABILITY_KEYS.map(key => [key, getAbilityModifier(scores[key])])); }
export function getSaveProficiencies(source = {}) { const primaryClass = getPrimaryClassName(source); const profs = CLASS_SAVE_PROFICIENCIES[primaryClass] || []; return Object.fromEntries(ABILITY_KEYS.map(key => [key, profs.includes(key)])); }
export function getSavingThrowTotals(source = {}) { const modifiers = getAbilityModifiers(source); const saveProficiencies = getSaveProficiencies(source); const proficiencyBonus = getProficiencyBonus(getTotalLevel(source)); return Object.fromEntries(ABILITY_KEYS.map(key => [key, modifiers[key] + (saveProficiencies[key] ? proficiencyBonus : 0)])); }
export function getSkillRank(source = {}, skillKey) { return Math.max(0, Math.min(2, toInt(source[`skill_${skillKey}_rank`], 0))); }
export function getJackOfAllTradesBonus(source = {}) { const bardLevel = getClassLevel(source, 'bard'); if (bardLevel < 2) return 0; return Math.floor(getProficiencyBonus(getTotalLevel(source)) / 2); }
export function getSkillTotals(source = {}) { const modifiers = getAbilityModifiers(source); const proficiencyBonus = getProficiencyBonus(getTotalLevel(source)); const jackOfAllTradesBonus = getJackOfAllTradesBonus(source); return Object.fromEntries(SKILL_DEFINITIONS.map(skill => { const rank = getSkillRank(source, skill.key); const multiplier = rank === 2 ? 2 : rank === 1 ? 1 : 0; const proficiencyContribution = proficiencyBonus * multiplier; const jackContribution = rank === 0 ? jackOfAllTradesBonus : 0; return [skill.key, modifiers[skill.ability] + proficiencyContribution + jackContribution]; })); }
export function getPrimarySpellcastingClass(source = {}) { const classEntries = getClassEntries(source); for (const className of SPELLCASTER_PRIORITY) { const entry = classEntries.find(item => item.className === className && item.level > 0); if (entry) return entry.className; } return ''; }
export function getSpellcastingAbilityKey(source = {}) { return SPELLCASTING_ABILITY_BY_CLASS[getPrimarySpellcastingClass(source)] || ''; }
export function getSpellcastingAbilityModifier(source = {}) { const abilityKey = getSpellcastingAbilityKey(source); if (!abilityKey) return 0; return getAbilityModifiers(source)[abilityKey] ?? 0; }
export function getDerivedInitiativeModifier(source = {}) { return getAbilityModifiers(source).dex ?? 0; }
export function getManualInitiativeBonus(source = {}) { return toInt(source.initiative_bonus, 0); }
export function getManualSpellSaveBonus(source = {}) { return toInt(source.spell_save_bonus, 0); }
export function getManualSpellAttackBonus(source = {}) { return toInt(source.spell_attack_bonus_mod, 0); }
export function getFinalInitiativeModifier(source = {}) { return getDerivedInitiativeModifier(source) + getManualInitiativeBonus(source); }
export function getDerivedSpellSaveDC(source = {}) { const abilityKey = getSpellcastingAbilityKey(source); if (!abilityKey) return 0; return 8 + getProficiencyBonus(getTotalLevel(source)) + getSpellcastingAbilityModifier(source); }
export function getFinalSpellSaveDC(source = {}) { const base = getDerivedSpellSaveDC(source); return base > 0 ? base + getManualSpellSaveBonus(source) : 0; }
export function getDerivedSpellAttackBonus(source = {}) { const abilityKey = getSpellcastingAbilityKey(source); if (!abilityKey) return 0; return getProficiencyBonus(getTotalLevel(source)) + getSpellcastingAbilityModifier(source); }
export function getFinalSpellAttackBonus(source = {}) { const base = getDerivedSpellAttackBonus(source); return base > 0 ? base + getManualSpellAttackBonus(source) : 0; }
export function getHighestHitDie(source = {}, fallback = 8) { const dice = getClassEntries(source).map(entry => CLASS_HIT_DIE[entry.className] || 0).filter(Boolean); return dice.length > 0 ? Math.max(...dice) : fallback; }
export function getHitDiePools(source = {}) { const pools = { 6: 0, 8: 0, 10: 0, 12: 0 }; getClassEntries(source).forEach(entry => { const dieSize = CLASS_HIT_DIE[entry.className]; if (!dieSize) return; pools[dieSize] = (pools[dieSize] || 0) + (entry.level || 0); }); return pools; }
export function formatHitDiceSummary(source = {}) { const pools = getHitDiePools(source); return HIT_DIE_SIZES.filter(size => (pools[size] || 0) > 0).map(size => `${pools[size]} × d${size}`).join(' • '); }
export function getStandardCasterLevel(source = {}) { const entries = getClassEntries(source); return entries.reduce((sum, entry) => { if (FULL_CASTER_CLASSES.includes(entry.className)) return sum + entry.level; if (HALF_CASTER_CLASSES.includes(entry.className)) return sum + Math.floor(entry.level / 2); return sum; }, 0); }
export function getStandardSpellSlots(source = {}) { const casterLevel = Math.max(0, Math.min(20, getStandardCasterLevel(source))); const slots = SPELL_SLOT_TABLE[casterLevel] || SPELL_SLOT_TABLE[0]; const result = {}; for (let level = 1; level <= 9; level += 1) result[`slots_max_${level}`] = slots[level - 1] || 0; return result; }
export function formatStandardSpellSlotsSummary(source = {}) { const slots = getStandardSpellSlots(source); return Array.from({ length: 9 }, (_, index) => index + 1).filter(level => (slots[`slots_max_${level}`] || 0) > 0).map(level => `L${level} ${slots[`slots_max_${level}`]}`).join(' • '); }
function getBardicInspirationDie(level) { if (level >= 15) return 'd12'; if (level >= 10) return 'd10'; if (level >= 5) return 'd8'; if (level >= 1) return 'd6'; return ''; }
function getWarlockSlotProgression(level) { if (level <= 0) return { slots: 0, slotLevel: 0 }; if (level === 1) return { slots: 1, slotLevel: 1 }; if (level >= 2 && level <= 10) return { slots: 2, slotLevel: Math.ceil(level / 2) }; if (level >= 11 && level <= 16) return { slots: 3, slotLevel: 5 }; return { slots: 4, slotLevel: 5 }; }
function getBarbarianRages(level) { if (level <= 0) return 0; if (level <= 2) return 2; if (level <= 5) return 3; if (level <= 11) return 4; if (level <= 16) return 5; if (level <= 19) return 6; return 999; }
function getFighterActionSurges(level) { if (level <= 0) return 0; return level >= 17 ? 2 : 1; }
function getPaladinChannelDivinity(level) { if (level < 3) return 0; return 1; }
function getClericChannelDivinity(level) { if (level < 2) return 0; if (level >= 18) return 3; if (level >= 6) return 2; return 1; }
function getChannelDivinityUses(source = {}) { const cleric = getClassLevel(source, 'cleric'); const paladin = getClassLevel(source, 'paladin'); return Math.max(getClericChannelDivinity(cleric), getPaladinChannelDivinity(paladin)); }
function getLayOnHandsPool(source = {}) { const paladin = getClassLevel(source, 'paladin'); return paladin > 0 ? paladin * 5 : 0; }
function getBattleMasterLevel(source = {}) { const fighterEntry = getClassEntries(source).find(entry => entry.className === 'fighter' && (entry.subclassName === 'battle master' || entry.subclassName === 'battlemaster')); return fighterEntry?.level || 0; }
function getSuperiorityDieSize(level) { if (level >= 18) return 'd12'; if (level >= 10) return 'd10'; if (level >= 3) return 'd8'; return ''; }
function getSuperiorityDiceCount(level) { if (level >= 15) return 6; if (level >= 3) return 4; return 0; }

export function getUnifiedResourceConfig(profile = {}, state = {}, options = {}) {
  const { compactLabels = false, includeHitDice = true, includeWarlockSlots = true, includeNaturalRecovery = false } = options;
  const label = (shortLabel, fullLabel) => compactLabels ? shortLabel : fullLabel;
  const resources = [];
  if (includeHitDice) {
    const profilePools = getHitDiePools(profile);
    const poolSpecs = [{ size: 6, currentKey: 'hit_dice_d6_current', maxKey: 'hit_dice_d6_max' }, { size: 8, currentKey: 'hit_dice_d8_current', maxKey: 'hit_dice_d8_max' }, { size: 10, currentKey: 'hit_dice_d10_current', maxKey: 'hit_dice_d10_max' }, { size: 12, currentKey: 'hit_dice_d12_current', maxKey: 'hit_dice_d12_max' }];
    const poolResources = poolSpecs.map(spec => {
      const fallbackMax = profilePools[spec.size] || 0;
      const maxValue = readNumberField(state, [spec.maxKey], fallbackMax);
      const currentValue = readNumberField(state, [spec.currentKey], maxValue);
      if (!maxValue && !currentValue) return null;
      return { id: `hit-dice-d${spec.size}`, label: label('HD', 'Hit Dice'), type: 'counter', currentKey: spec.currentKey, maxKey: spec.maxKey, fallbackCurrent: currentValue, fallbackMax: maxValue, meta: `d${spec.size}` };
    }).filter(Boolean);
    if (poolResources.length > 0) resources.push(...poolResources); else {
      const fallbackMax = readNumberField(profile, ['hit_dice_max'], getTotalLevel(profile));
      const hitDiceCurrentKey = findExistingKey(state, ['hit_dice_current', 'hit_dice_remaining']);
      const hitDiceMaxKey = findExistingKey(state, ['hit_dice_max']);
      const hitDieSize = readNumberField(state, ['hit_die_size'], readNumberField(profile, ['hit_die_size'], null));
      const fallbackCurrent = readNumberField(state, [hitDiceCurrentKey].filter(Boolean), fallbackMax);
      if (hitDiceCurrentKey || hitDiceMaxKey || hitDieSize || fallbackMax) resources.push({ id: 'hit-dice', label: label('HD', 'Hit Dice'), type: 'counter', currentKey: hitDiceCurrentKey || 'hit_dice_current', maxKey: hitDiceMaxKey || 'hit_dice_max', fallbackCurrent, fallbackMax, meta: hitDieSize ? `d${hitDieSize}` : '' });
    }
  }
  if (profile.feat_lucky) {
    const luckyCurrentKey = findExistingKey(state, ['lucky_current', 'lucky_uses_current', 'lucky_uses_remaining']);
    const luckyMaxKey = findExistingKey(state, ['lucky_max', 'lucky_uses_max']);
    const luckyUsedKey = findExistingKey(state, ['lucky_used']);
    if (luckyCurrentKey || luckyMaxKey) resources.push({ id: 'lucky', label: label('Lucky', 'Lucky'), type: 'pips', currentKey: luckyCurrentKey || 'lucky_current', maxKey: luckyMaxKey || 'lucky_max', fallbackCurrent: readNumberField(state, [luckyCurrentKey].filter(Boolean), 0), fallbackMax: readNumberField(state, [luckyMaxKey].filter(Boolean), 0) });
    else if (luckyUsedKey) resources.push({ id: 'lucky', label: label('Lucky', 'Lucky'), type: 'toggle', boolKey: luckyUsedKey, trueLabel: 'Used', falseLabel: 'Ready' });
  }
  if (profile.feat_relentless_endurance || String(profile.ancestry_name || '').toLowerCase() === 'half-orc') {
    const relentlessKey = findExistingKey(state, ['relentless_endurance_used']);
    if (relentlessKey) resources.push({ id: 'relentless-endurance', label: label('RE', 'Relentless Endurance'), type: 'toggle', boolKey: relentlessKey, trueLabel: 'Used', falseLabel: 'Ready' });
  }
  if (profile.feat_fey_step) {
    const currentKey = findExistingKey(state, ['fey_step_current']); const maxKey = findExistingKey(state, ['fey_step_max']);
    if (currentKey || maxKey) resources.push({ id: 'fey-step', label: label('Fey Step', 'Fey Step'), type: 'pips', currentKey: currentKey || 'fey_step_current', maxKey: maxKey || 'fey_step_max', fallbackCurrent: readNumberField(state, [currentKey].filter(Boolean), 0), fallbackMax: readNumberField(state, [maxKey].filter(Boolean), 0) });
  }
  if (profile.feat_celestial_revelation) {
    const usedKey = findExistingKey(state, ['celestial_revelation_used']);
    if (usedKey) resources.push({ id: 'celestial-revelation', label: label('Celestial Rev.', 'Celestial Revelation'), type: 'toggle', boolKey: usedKey, trueLabel: 'Used', falseLabel: 'Ready' });
  }
  const classResources = [
    { id: 'bardic-inspiration', classes: ['bard'], label: label('BI', 'Bardic Inspiration'), type: 'pips', currentKeys: ['bardic_inspiration_current', 'bardic_inspiration_uses_current', 'bardic_inspiration_remaining'], maxKeys: ['bardic_inspiration_max', 'bardic_inspiration_uses_max'], meta: () => readTextField(state, ['bardic_inspiration_die', 'bardic_inspiration_die_size'], '') },
    { id: 'ki', classes: ['monk'], label: label('Ki', 'Ki'), type: 'counter', currentKeys: ['ki_current', 'ki_points_current'], maxKeys: ['ki_max', 'ki_points_max'] },
    { id: 'channel-divinity', classes: ['cleric', 'paladin'], label: label('CD', 'Channel Divinity'), type: 'pips', currentKeys: ['channel_divinity_current', 'channel_divinity_uses_current'], maxKeys: ['channel_divinity_max', 'channel_divinity_uses_max'] },
    { id: 'rage', classes: ['barbarian'], label: label('Rage', 'Rage'), type: 'pips', currentKeys: ['rage_current', 'rage_uses_current', 'rages_current'], maxKeys: ['rage_max', 'rage_uses_max', 'rages_max'] },
    { id: 'sorcery-points', classes: ['sorcerer'], label: label('SP', 'Sorcery Points'), type: 'counter', currentKeys: ['sorcery_points_current'], maxKeys: ['sorcery_points_max'] },
    { id: 'second-wind', classes: ['fighter'], label: label('SW', 'Second Wind'), type: 'toggle', boolKeys: ['second_wind_available', 'second_wind_used'], trueLabel: 'Ready', falseLabel: 'Spent', invertStoredBoolean: true },
    { id: 'action-surge', classes: ['fighter'], label: label('AS', 'Action Surge'), type: 'pips', currentKeys: ['action_surge_current', 'action_surge_uses_current'], maxKeys: ['action_surge_max', 'action_surge_uses_max'] },
    { id: 'superiority-dice', classes: ['fighter'], label: label('SD', 'Superiority Dice'), type: 'pips', currentKeys: ['superiority_dice_current'], maxKeys: ['superiority_dice_max'], meta: () => readTextField(state, ['superiority_die_size'], '') },
    { id: 'lay-on-hands', classes: ['paladin'], label: label('LoH', 'Lay on Hands'), type: 'counter', currentKeys: ['lay_on_hands_current'], maxKeys: ['lay_on_hands_max'] },
    { id: 'arcane-recovery', classes: ['wizard'], label: label('AR', 'Arcane Recovery'), type: 'toggle', boolKeys: ['arcane_recovery_available', 'arcane_recovery_used'], trueLabel: 'Ready', falseLabel: 'Used', invertStoredBoolean: true },
    { id: 'natural-recovery', classes: ['druid'], label: label('NR', 'Natural Recovery'), type: 'toggle', boolKeys: ['natural_recovery_available', 'natural_recovery_used'], trueLabel: 'Ready', falseLabel: 'Used', disabled: !includeNaturalRecovery, invertStoredBoolean: true },
    { id: 'warlock-slots', classes: ['warlock'], label: label('W Slots', 'Warlock Slots'), type: 'pips', currentKeys: ['warlock_slots_current', 'warlock_spell_slots_current'], maxKeys: ['warlock_slots_max', 'warlock_spell_slots_max'], meta: () => { const lvl = readNumberField(state, ['warlock_slots_level', 'warlock_slot_level'], null); return lvl ? `Lv ${lvl}` : ''; }, disabled: !includeWarlockSlots },
  ];
  classResources.forEach(resource => {
    if (resource.disabled) return; if (!resource.classes.some(className => hasClass(profile, className))) return;
    if (resource.type === 'toggle') { const boolKey = findExistingKey(state, resource.boolKeys || []); if (!boolKey) return; resources.push({ id: resource.id, label: resource.label, type: 'toggle', boolKey, trueLabel: resource.trueLabel || 'Used', falseLabel: resource.falseLabel || 'Ready', invertStoredBoolean: !!resource.invertStoredBoolean, meta: resource.meta ? resource.meta() : '' }); return; }
    const currentKey = findExistingKey(state, resource.currentKeys || []); const maxKey = findExistingKey(state, resource.maxKeys || []); if (!currentKey && !maxKey) return;
    resources.push({ id: resource.id, label: resource.label, type: resource.type, currentKey: currentKey || (resource.currentKeys || [])[0], maxKey: maxKey || (resource.maxKeys || [])[0], fallbackCurrent: readNumberField(state, [currentKey].filter(Boolean), 0), fallbackMax: readNumberField(state, [maxKey].filter(Boolean), 0), meta: resource.meta ? resource.meta() : '' });
  });
  return resources;
}

export function derivePlayerProfileDefaults(source = {}) { const totalLevel = getTotalLevel(source); const druidLevel = getClassLevel(source, 'druid'); const saveTotals = getSavingThrowTotals(source); const skillTotals = getSkillTotals(source); const abilityScores = getAbilityScores(source); return compactObject({ ability_str: abilityScores.str, ability_dex: abilityScores.dex, ability_con: abilityScores.con, ability_int: abilityScores.int, ability_wis: abilityScores.wis, ability_cha: abilityScores.cha, hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined, hit_dice_max: totalLevel > 0 ? totalLevel : undefined, initiative_mod: getFinalInitiativeModifier(source), spell_save_dc: getFinalSpellSaveDC(source), spell_attack_bonus: getFinalSpellAttackBonus(source), ...getStandardSpellSlots(source), save_str: saveTotals.str, save_dex: saveTotals.dex, save_con: saveTotals.con, save_int: saveTotals.int, save_wis: saveTotals.wis, save_cha: saveTotals.cha, ...Object.fromEntries(SKILL_DEFINITIONS.map(skill => [`skill_${skill.key}`, skillTotals[skill.key]])), wildshape_enabled: druidLevel > 0 }); }
export function derivePlayerEncounterStateResources(source = {}) { const totalLevel = getTotalLevel(source); const proficiencyBonus = getProficiencyBonus(totalLevel); const hitDiePools = getHitDiePools(source); const bardLevel = getClassLevel(source, 'bard'); const monkLevel = getClassLevel(source, 'monk'); const warlockLevel = getClassLevel(source, 'warlock'); const fighterLevel = getClassLevel(source, 'fighter'); const barbarianLevel = getClassLevel(source, 'barbarian'); const sorcererLevel = getClassLevel(source, 'sorcerer'); const wizardLevel = getClassLevel(source, 'wizard'); const druidLevel = getClassLevel(source, 'druid'); const battleMasterLevel = getBattleMasterLevel(source); const { slots: warlockSlots, slotLevel: warlockSlotLevel } = getWarlockSlotProgression(warlockLevel); const superiorityDice = getSuperiorityDiceCount(battleMasterLevel); const superiorityDieSize = getSuperiorityDieSize(battleMasterLevel); const rageUses = getBarbarianRages(barbarianLevel); const channelDivinityUses = getChannelDivinityUses(source); const layOnHands = getLayOnHandsPool(source); const bardicInspirationDie = getBardicInspirationDie(bardLevel); return compactObject({ temp_hp: 0, hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined, hit_dice_max: totalLevel > 0 ? totalLevel : undefined, hit_dice_current: totalLevel > 0 ? totalLevel : undefined, hit_dice_d6_max: hitDiePools[6] > 0 ? hitDiePools[6] : undefined, hit_dice_d6_current: hitDiePools[6] > 0 ? hitDiePools[6] : undefined, hit_dice_d8_max: hitDiePools[8] > 0 ? hitDiePools[8] : undefined, hit_dice_d8_current: hitDiePools[8] > 0 ? hitDiePools[8] : undefined, hit_dice_d10_max: hitDiePools[10] > 0 ? hitDiePools[10] : undefined, hit_dice_d10_current: hitDiePools[10] > 0 ? hitDiePools[10] : undefined, hit_dice_d12_max: hitDiePools[12] > 0 ? hitDiePools[12] : undefined, hit_dice_d12_current: hitDiePools[12] > 0 ? hitDiePools[12] : undefined, bardic_inspiration_max: bardLevel > 0 ? proficiencyBonus : undefined, bardic_inspiration_current: bardLevel > 0 ? proficiencyBonus : undefined, bardic_inspiration_die: bardicInspirationDie || undefined, ki_points_max: monkLevel > 0 ? monkLevel : undefined, ki_points_current: monkLevel > 0 ? monkLevel : undefined, warlock_slots_max: warlockSlots > 0 ? warlockSlots : undefined, warlock_slots_current: warlockSlots > 0 ? warlockSlots : undefined, warlock_slots_level: warlockSlotLevel > 0 ? warlockSlotLevel : undefined, action_surge_max: fighterLevel > 0 ? getFighterActionSurges(fighterLevel) : undefined, action_surge_current: fighterLevel > 0 ? getFighterActionSurges(fighterLevel) : undefined, second_wind_available: fighterLevel > 0 ? true : undefined, action_surge_current: fighterLevel > 0 ? getFighterActionSurges(fighterLevel) : undefined, superiority_dice_max: superiorityDice > 0 ? superiorityDice : undefined, superiority_dice_current: superiorityDice > 0 ? superiorityDice : undefined, superiority_die_size: superiorityDieSize || undefined, rage_max: barbarianLevel > 0 ? rageUses : undefined, rage_current: barbarianLevel > 0 ? rageUses : undefined, sorcery_points_max: sorcererLevel > 0 ? sorcererLevel : undefined, sorcery_points_current: sorcererLevel > 0 ? sorcererLevel : undefined, channel_divinity_max: channelDivinityUses > 0 ? channelDivinityUses : undefined, channel_divinity_current: channelDivinityUses > 0 ? channelDivinityUses : undefined, lay_on_hands_max: layOnHands > 0 ? layOnHands : undefined, lay_on_hands_current: layOnHands > 0 ? layOnHands : undefined, arcane_recovery_available: wizardLevel > 0 ? true : undefined, arcane_recovery_used: wizardLevel > 0 ? false : undefined, natural_recovery_available: druidLevel > 0 ? true : undefined, natural_recovery_used: druidLevel > 0 ? false : undefined, wildshape_uses_remaining: druidLevel > 0 ? 2 : undefined, fey_step_max: source.feat_fey_step ? proficiencyBonus : undefined, fey_step_current: source.feat_fey_step ? proficiencyBonus : undefined, celestial_revelation_available: source.feat_celestial_revelation ? true : undefined, celestial_revelation_used: source.feat_celestial_revelation ? false : undefined, relentless_endurance_available: source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc' ? true : undefined, relentless_endurance_used: source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc' ? false : undefined, mage_armour_active: false }); }
export function deriveCombatantResourceFields() { return {}; }
