const CLASS_HIT_DIE = { barbarian: 12, bard: 8, cleric: 8, druid: 8, fighter: 10, monk: 8, paladin: 10, ranger: 10, rogue: 8, sorcerer: 6, warlock: 8, wizard: 6 };
const CLASS_SAVE_PROFICIENCIES = { barbarian: ['str','con'], bard: ['dex','cha'], cleric: ['wis','cha'], druid: ['int','wis'], fighter: ['str','con'], monk: ['str','dex'], paladin: ['wis','cha'], ranger: ['str','dex'], rogue: ['dex','int'], sorcerer: ['con','cha'], warlock: ['wis','cha'], wizard: ['int','wis'] };
const SPELLCASTING_ABILITY_BY_CLASS = { bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int' };
const FULL_CASTER_CLASSES = ['bard','cleric','druid','sorcerer','wizard'];
const HALF_CASTER_CLASSES = ['paladin','ranger'];
const SPELLCASTER_PRIORITY = ['wizard','sorcerer','warlock','bard','cleric','druid','paladin','ranger'];
const SPELL_SLOT_TABLE = { 0:[0,0,0,0,0,0,0,0,0],1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],4:[4,3,0,0,0,0,0,0,0],5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],9:[4,3,3,3,1,0,0,0,0],10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1] };

export const HIT_DIE_SIZES = [6,8,10,12];
export const ABILITY_KEYS = ['str','dex','con','int','wis','cha'];
export const DEFAULT_ABILITY_SCORE = 10;
export const SKILL_DEFINITIONS = [
  { key:'acrobatics', label:'Acrobatics', ability:'dex' }, { key:'animal_handling', label:'Animal Handling', ability:'wis' }, { key:'arcana', label:'Arcana', ability:'int' }, { key:'athletics', label:'Athletics', ability:'str' }, { key:'deception', label:'Deception', ability:'cha' }, { key:'history', label:'History', ability:'int' }, { key:'insight', label:'Insight', ability:'wis' }, { key:'intimidation', label:'Intimidation', ability:'cha' }, { key:'investigation', label:'Investigation', ability:'int' }, { key:'medicine', label:'Medicine', ability:'wis' }, { key:'nature', label:'Nature', ability:'int' }, { key:'perception', label:'Perception', ability:'wis' }, { key:'performance', label:'Performance', ability:'cha' }, { key:'persuasion', label:'Persuasion', ability:'cha' }, { key:'religion', label:'Religion', ability:'int' }, { key:'sleight_of_hand', label:'Sleight of Hand', ability:'dex' }, { key:'stealth', label:'Stealth', ability:'dex' }, { key:'survival', label:'Survival', ability:'wis' },
];

export function toInt(value, fallback = 0) { const n = parseInt(value, 10); return Number.isFinite(n) ? n : fallback; }
function normalizeText(value) { return String(value || '').trim().toLowerCase(); }
function compactObject(obj) { return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)); }
export function findExistingKey(source, candidates = []) { if (!source) return null; for (const key of candidates) if (Object.prototype.hasOwnProperty.call(source, key)) return key; return null; }
export function readNumberField(source, candidates = [], fallback = null) { const key = findExistingKey(source, candidates); if (!key) return fallback; const raw = source[key]; if (raw === null || raw === undefined || raw === '') return fallback; const n = parseInt(raw, 10); return Number.isFinite(n) ? n : fallback; }
export function readBooleanField(source, candidates = [], fallback = null) { const key = findExistingKey(source, candidates); if (!key) return fallback; const raw = source[key]; if (raw === null || raw === undefined) return fallback; return !!raw; }
export function readTextField(source, candidates = [], fallback = '') { const key = findExistingKey(source, candidates); if (!key) return fallback; const raw = source[key]; if (raw === null || raw === undefined || raw === '') return fallback; return String(raw); }
export function clampAbilityScore(value) { const n = toInt(value, DEFAULT_ABILITY_SCORE); return Math.max(1, Math.min(30, n)); }
export function getAbilityModifier(score) { return Math.floor((clampAbilityScore(score) - 10) / 2); }
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
export function getJackOfAllTradesBonus(source = {}) { const bardLevel = getClassLevel(source, 'bard'); return bardLevel < 2 ? 0 : Math.floor(getProficiencyBonus(getTotalLevel(source)) / 2); }
export function getSkillTotals(source = {}) { const modifiers = getAbilityModifiers(source); const proficiencyBonus = getProficiencyBonus(getTotalLevel(source)); const jackOfAllTradesBonus = getJackOfAllTradesBonus(source); return Object.fromEntries(SKILL_DEFINITIONS.map(skill => { const rank = getSkillRank(source, skill.key); const prof = rank === 2 ? proficiencyBonus * 2 : rank === 1 ? proficiencyBonus : 0; const joat = rank === 0 ? jackOfAllTradesBonus : 0; return [skill.key, modifiers[skill.ability] + prof + joat]; })); }
export function getPrimarySpellcastingClass(source = {}) { const entries = getClassEntries(source); for (const className of SPELLCASTER_PRIORITY) { const entry = entries.find(item => item.className === className && item.level > 0); if (entry) return entry.className; } return ''; }
export function getSpellcastingAbilityKey(source = {}) { return SPELLCASTING_ABILITY_BY_CLASS[getPrimarySpellcastingClass(source)] || ''; }
export function getSpellcastingAbilityModifier(source = {}) { const abilityKey = getSpellcastingAbilityKey(source); return abilityKey ? (getAbilityModifiers(source)[abilityKey] ?? 0) : 0; }
export function getDerivedInitiativeModifier(source = {}) { return getAbilityModifiers(source).dex ?? 0; }
export function getManualInitiativeBonus(source = {}) { return toInt(source.initiative_bonus, 0); }
export function getManualSpellSaveBonus(source = {}) { return toInt(source.spell_save_bonus, 0); }
export function getManualSpellAttackBonus(source = {}) { return toInt(source.spell_attack_bonus_mod, 0); }
export function getFinalInitiativeModifier(source = {}) { return getDerivedInitiativeModifier(source) + getManualInitiativeBonus(source); }
export function getDerivedSpellSaveDC(source = {}) { return getSpellcastingAbilityKey(source) ? 8 + getProficiencyBonus(getTotalLevel(source)) + getSpellcastingAbilityModifier(source) : 0; }
export function getFinalSpellSaveDC(source = {}) { const base = getDerivedSpellSaveDC(source); return base > 0 ? base + getManualSpellSaveBonus(source) : 0; }
export function getDerivedSpellAttackBonus(source = {}) { return getSpellcastingAbilityKey(source) ? getProficiencyBonus(getTotalLevel(source)) + getSpellcastingAbilityModifier(source) : 0; }
export function getFinalSpellAttackBonus(source = {}) { const base = getDerivedSpellAttackBonus(source); return base > 0 ? base + getManualSpellAttackBonus(source) : 0; }
export function getHighestHitDie(source = {}, fallback = 8) { const dice = getClassEntries(source).map(entry => CLASS_HIT_DIE[entry.className] || 0).filter(Boolean); return dice.length ? Math.max(...dice) : fallback; }
export function getHitDiePools(source = {}) { const pools = { 6:0, 8:0, 10:0, 12:0 }; getClassEntries(source).forEach(entry => { const size = CLASS_HIT_DIE[entry.className]; if (size) pools[size] += entry.level || 0; }); return pools; }
export function formatHitDiceSummary(source = {}) { const pools = getHitDiePools(source); return HIT_DIE_SIZES.filter(size => pools[size] > 0).map(size => `${pools[size]} × d${size}`).join(' • '); }
export function getStandardCasterLevel(source = {}) { return getClassEntries(source).reduce((sum, entry) => { if (FULL_CASTER_CLASSES.includes(entry.className)) return sum + entry.level; if (HALF_CASTER_CLASSES.includes(entry.className)) return sum + Math.floor(entry.level / 2); return sum; }, 0); }
export function getStandardSpellSlots(source = {}) { const casterLevel = Math.max(0, Math.min(20, getStandardCasterLevel(source))); const slots = SPELL_SLOT_TABLE[casterLevel] || SPELL_SLOT_TABLE[0]; const result = {}; for (let level = 1; level <= 9; level += 1) result[`slots_max_${level}`] = slots[level - 1] || 0; return result; }
export function formatStandardSpellSlotsSummary(source = {}) { const slots = getStandardSpellSlots(source); return Array.from({ length: 9 }, (_, i) => i + 1).filter(level => (slots[`slots_max_${level}`] || 0) > 0).map(level => `L${level} ${slots[`slots_max_${level}`]}`).join(' • '); }
function getBardicInspirationDie(level) { if (level >= 15) return 'd12'; if (level >= 10) return 'd10'; if (level >= 5) return 'd8'; if (level >= 1) return 'd6'; return ''; }
function getWarlockSlotProgression(level) { if (level <= 0) return { slots:0, slotLevel:0 }; if (level === 1) return { slots:1, slotLevel:1 }; if (level <= 10) return { slots:2, slotLevel:Math.ceil(level / 2) }; if (level <= 16) return { slots:3, slotLevel:5 }; return { slots:4, slotLevel:5 }; }
function getBarbarianRages(level) { if (level <= 0) return 0; if (level <= 2) return 2; if (level <= 5) return 3; if (level <= 11) return 4; if (level <= 16) return 5; if (level <= 19) return 6; return 999; }
function getFighterActionSurges(level) { if (level <= 0) return 0; return level >= 17 ? 2 : 1; }
function getPaladinChannelDivinity(level) { return level < 3 ? 0 : 1; }
function getClericChannelDivinity(level) { if (level < 2) return 0; if (level >= 18) return 3; if (level >= 6) return 2; return 1; }
function getChannelDivinityUses(source = {}) { return Math.max(getClericChannelDivinity(getClassLevel(source, 'cleric')), getPaladinChannelDivinity(getClassLevel(source, 'paladin'))); }
function getLayOnHandsPool(source = {}) { const paladin = getClassLevel(source, 'paladin'); return paladin > 0 ? paladin * 5 : 0; }
function getBattleMasterLevel(source = {}) { const entry = getClassEntries(source).find(item => item.className === 'fighter' && (item.subclassName === 'battle master' || item.subclassName === 'battlemaster')); return entry?.level || 0; }
function getSuperiorityDieSize(level) { if (level >= 18) return 'd12'; if (level >= 10) return 'd10'; if (level >= 3) return 'd8'; return ''; }
function getSuperiorityDiceCount(level) { if (level >= 15) return 6; if (level >= 3) return 4; return 0; }
function getResourceFallback(profile = {}, resourceId) {
  const total = getTotalLevel(profile); const prof = getProficiencyBonus(total); const bard = getClassLevel(profile, 'bard'); const monk = getClassLevel(profile, 'monk'); const warlock = getClassLevel(profile, 'warlock'); const fighter = getClassLevel(profile, 'fighter'); const barbarian = getClassLevel(profile, 'barbarian'); const sorcerer = getClassLevel(profile, 'sorcerer'); const wizard = getClassLevel(profile, 'wizard'); const druid = getClassLevel(profile, 'druid'); const battleMaster = getBattleMasterLevel(profile);
  if (resourceId === 'bardic-inspiration') return { current: bard > 0 ? prof : 0, max: bard > 0 ? prof : 0, meta: getBardicInspirationDie(bard) };
  if (resourceId === 'ki') return { current: monk, max: monk };
  if (resourceId === 'channel-divinity') { const uses = getChannelDivinityUses(profile); return { current: uses, max: uses }; }
  if (resourceId === 'rage') { const uses = getBarbarianRages(barbarian); return { current: uses, max: uses }; }
  if (resourceId === 'sorcery-points') return { current: sorcerer, max: sorcerer };
  if (resourceId === 'second-wind') return { ready: fighter > 0 };
  if (resourceId === 'action-surge') { const uses = getFighterActionSurges(fighter); return { current: uses, max: uses }; }
  if (resourceId === 'superiority-dice') { const count = getSuperiorityDiceCount(battleMaster); return { current: count, max: count, meta: getSuperiorityDieSize(battleMaster) } ; }
  if (resourceId === 'lay-on-hands') { const pool = getLayOnHandsPool(profile); return { current: pool, max: pool }; }
  if (resourceId === 'arcane-recovery') return { ready: wizard > 0 };
  if (resourceId === 'natural-recovery') return { ready: druid > 0 };
  if (resourceId === 'warlock-slots') { const prog = getWarlockSlotProgression(warlock); return { current: prog.slots, max: prog.slots, meta: prog.slotLevel ? `Lv ${prog.slotLevel}` : '' }; }
  if (resourceId === 'fey-step') return { current: profile.feat_fey_step ? prof : 0, max: profile.feat_fey_step ? prof : 0 };
  if (resourceId === 'celestial-revelation') return { ready: !!profile.feat_celestial_revelation };
  if (resourceId === 'relentless-endurance') return { ready: !!(profile.feat_relentless_endurance || normalizeText(profile.ancestry_name) === 'half-orc') };
  if (resourceId === 'hit-dice') { const max = readNumberField(profile, ['hit_dice_max'], total); return { current: max, max, meta: `d${getHighestHitDie(profile, 8)}` }; }
  return { current: 0, max: 0, ready: false, meta: '' };
}
function resolveToggleSpec(spec, state, fallback) {
  const usedKey = findExistingKey(state, spec.usedKeys || []);
  if (usedKey) return { boolKey: usedKey, toggleMode: 'used', fallbackReady: fallback.ready ?? false };
  const availableKey = findExistingKey(state, spec.availableKeys || []);
  if (availableKey) return { boolKey: availableKey, toggleMode: 'available', fallbackReady: fallback.ready ?? false };
  return { boolKey: (spec.usedKeys || spec.availableKeys || [])[0], toggleMode: spec.defaultToggleMode || 'used', fallbackReady: fallback.ready ?? false };
}

export function getUnifiedResourceConfig(profile = {}, state = {}, options = {}) {
  const { compactLabels = false, includeHitDice = true, includeWarlockSlots = true, includeNaturalRecovery = false } = options;
  const label = (shortLabel, fullLabel) => compactLabels ? shortLabel : fullLabel;
  const resources = [];
  if (includeHitDice) {
    const profilePools = getHitDiePools(profile);
    const poolSpecs = [6,8,10,12].map(size => ({ size, currentKey:`hit_dice_d${size}_current`, maxKey:`hit_dice_d${size}_max` }));
    const poolResources = poolSpecs.map(spec => {
      const fallbackMax = profilePools[spec.size] || 0; const maxValue = readNumberField(state, [spec.maxKey], fallbackMax); const currentValue = readNumberField(state, [spec.currentKey], maxValue);
      if (!maxValue && !currentValue) return null;
      return { id:`hit-dice-d${spec.size}`, label:label('HD','Hit Dice'), type:'counter', currentKey:spec.currentKey, maxKey:spec.maxKey, fallbackCurrent:currentValue, fallbackMax:maxValue, meta:`d${spec.size}` };
    }).filter(Boolean);
    if (poolResources.length) resources.push(...poolResources); else {
      const fallback = getResourceFallback(profile, 'hit-dice');
      resources.push({ id:'hit-dice', label:label('HD','Hit Dice'), type:'counter', currentKey:'hit_dice_current', maxKey:'hit_dice_max', fallbackCurrent:fallback.current, fallbackMax:fallback.max, meta:fallback.meta });
    }
  }
  const specs = [
    { id:'lucky', label:label('Lucky','Lucky'), type:'pips', feature: !!profile.feat_lucky, currentKeys:['lucky_current','lucky_uses_current','lucky_uses_remaining'], maxKeys:['lucky_max','lucky_uses_max'] },
    { id:'relentless-endurance', label:label('RE','Relentless Endurance'), type:'toggle', feature: !!(profile.feat_relentless_endurance || normalizeText(profile.ancestry_name)==='half-orc'), usedKeys:['relentless_endurance_used'] },
    { id:'fey-step', label:label('Fey Step','Fey Step'), type:'pips', feature: !!profile.feat_fey_step, currentKeys:['fey_step_current'], maxKeys:['fey_step_max'] },
    { id:'celestial-revelation', label:label('Celestial Rev.','Celestial Revelation'), type:'toggle', feature: !!profile.feat_celestial_revelation, usedKeys:['celestial_revelation_used'] },
    { id:'bardic-inspiration', label:label('BI','Bardic Inspiration'), type:'pips', feature: bardLevel(profile)>0, currentKeys:['bardic_inspiration_current','bardic_inspiration_uses_current','bardic_inspiration_remaining'], maxKeys:['bardic_inspiration_max','bardic_inspiration_uses_max'] },
    { id:'ki', label:label('Ki','Ki'), type:'counter', feature: monkLevel(profile)>0, currentKeys:['ki_current','ki_points_current'], maxKeys:['ki_max','ki_points_max'] },
    { id:'channel-divinity', label:label('CD','Channel Divinity'), type:'pips', feature: getChannelDivinityUses(profile)>0, currentKeys:['channel_divinity_current','channel_divinity_uses_current'], maxKeys:['channel_divinity_max','channel_divinity_uses_max'] },
    { id:'rage', label:label('Rage','Rage'), type:'pips', feature: getClassLevel(profile,'barbarian')>0, currentKeys:['rage_current','rage_uses_current','rages_current'], maxKeys:['rage_max','rage_uses_max','rages_max'] },
    { id:'sorcery-points', label:label('SP','Sorcery Points'), type:'counter', feature: getClassLevel(profile,'sorcerer')>0, currentKeys:['sorcery_points_current'], maxKeys:['sorcery_points_max'] },
    { id:'second-wind', label:label('SW','Second Wind'), type:'toggle', feature: getClassLevel(profile,'fighter')>0, availableKeys:['second_wind_available'], usedKeys:['second_wind_used'], defaultToggleMode:'available', readyLabel:'Ready', spentLabel:'Spent' },
    { id:'action-surge', label:label('AS','Action Surge'), type:'pips', feature: getClassLevel(profile,'fighter')>0, currentKeys:['action_surge_current','action_surge_uses_current'], maxKeys:['action_surge_max','action_surge_uses_max'] },
    { id:'superiority-dice', label:label('SD','Superiority Dice'), type:'pips', feature: getBattleMasterLevel(profile)>0, currentKeys:['superiority_dice_current'], maxKeys:['superiority_dice_max'] },
    { id:'lay-on-hands', label:label('LoH','Lay on Hands'), type:'counter', feature: getClassLevel(profile,'paladin')>0, currentKeys:['lay_on_hands_current'], maxKeys:['lay_on_hands_max'] },
    { id:'arcane-recovery', label:label('AR','Arcane Recovery'), type:'toggle', feature: getClassLevel(profile,'wizard')>0, availableKeys:['arcane_recovery_available'], usedKeys:['arcane_recovery_used'], defaultToggleMode:'available', readyLabel:'Ready', spentLabel:'Used' },
    { id:'natural-recovery', label:label('NR','Natural Recovery'), type:'toggle', feature: includeNaturalRecovery && getClassLevel(profile,'druid')>0, availableKeys:['natural_recovery_available'], usedKeys:['natural_recovery_used'], defaultToggleMode:'available', readyLabel:'Ready', spentLabel:'Used' },
    { id:'warlock-slots', label:label('W Slots','Warlock Slots'), type:'pips', feature: includeWarlockSlots && getClassLevel(profile,'warlock')>0, currentKeys:['warlock_slots_current','warlock_spell_slots_current'], maxKeys:['warlock_slots_max','warlock_spell_slots_max'] },
  ];
  specs.forEach(spec => {
    if (!spec.feature) return;
    const fallback = getResourceFallback(profile, spec.id);
    if (spec.type === 'toggle') {
      const toggle = resolveToggleSpec(spec, state, fallback);
      resources.push({ id:spec.id, label:spec.label, type:'toggle', boolKey:toggle.boolKey, toggleMode:toggle.toggleMode, readyLabel:spec.readyLabel || 'Ready', spentLabel:spec.spentLabel || 'Used', fallbackReady:toggle.fallbackReady, meta:fallback.meta || '' }); return;
    }
    const currentKey = findExistingKey(state, spec.currentKeys || []) || spec.currentKeys?.[0];
    const maxKey = findExistingKey(state, spec.maxKeys || []) || spec.maxKeys?.[0];
    if (!currentKey && !maxKey) return;
    resources.push({ id:spec.id, label:spec.label, type:spec.type, currentKey, maxKey, fallbackCurrent:fallback.current ?? 0, fallbackMax:fallback.max ?? 0, meta:fallback.meta || '' });
  });
  return resources;
}
function bardLevel(profile){ return getClassLevel(profile,'bard'); }
function monkLevel(profile){ return getClassLevel(profile,'monk'); }

export function derivePlayerProfileDefaults(source = {}) {
  const totalLevel = getTotalLevel(source); const druidLevel = getClassLevel(source, 'druid'); const saveTotals = getSavingThrowTotals(source); const skillTotals = getSkillTotals(source); const abilityScores = getAbilityScores(source);
  return compactObject({ ability_str:abilityScores.str, ability_dex:abilityScores.dex, ability_con:abilityScores.con, ability_int:abilityScores.int, ability_wis:abilityScores.wis, ability_cha:abilityScores.cha, hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined, hit_dice_max: totalLevel > 0 ? totalLevel : undefined, initiative_mod:getFinalInitiativeModifier(source), spell_save_dc:getFinalSpellSaveDC(source), spell_attack_bonus:getFinalSpellAttackBonus(source), ...getStandardSpellSlots(source), save_str:saveTotals.str, save_dex:saveTotals.dex, save_con:saveTotals.con, save_int:saveTotals.int, save_wis:saveTotals.wis, save_cha:saveTotals.cha, ...Object.fromEntries(SKILL_DEFINITIONS.map(skill => [`skill_${skill.key}`, skillTotals[skill.key]])), wildshape_enabled:druidLevel > 0 });
}
export function derivePlayerEncounterStateResources(source = {}) {
  const totalLevel = getTotalLevel(source); const hitDiePools = getHitDiePools(source); const bard = getClassLevel(source, 'bard'); const monk = getClassLevel(source, 'monk'); const warlock = getClassLevel(source, 'warlock'); const fighter = getClassLevel(source, 'fighter'); const barbarian = getClassLevel(source, 'barbarian'); const sorcerer = getClassLevel(source, 'sorcerer'); const wizard = getClassLevel(source, 'wizard'); const druid = getClassLevel(source, 'druid'); const battleMaster = getBattleMasterLevel(source); const prof = getProficiencyBonus(totalLevel); const warlockProg = getWarlockSlotProgression(warlock); const superiorityDice = getSuperiorityDiceCount(battleMaster); const superiorityDieSize = getSuperiorityDieSize(battleMaster); const rageUses = getBarbarianRages(barbarian); const channelDivinityUses = getChannelDivinityUses(source); const layOnHands = getLayOnHandsPool(source); const bardicDie = getBardicInspirationDie(bard);
  return compactObject({ temp_hp:0, hit_die_size: totalLevel > 0 ? getHighestHitDie(source, 8) : undefined, hit_dice_max: totalLevel > 0 ? totalLevel : undefined, hit_dice_current: totalLevel > 0 ? totalLevel : undefined, hit_dice_d6_max: hitDiePools[6] || undefined, hit_dice_d6_current: hitDiePools[6] || undefined, hit_dice_d8_max: hitDiePools[8] || undefined, hit_dice_d8_current: hitDiePools[8] || undefined, hit_dice_d10_max: hitDiePools[10] || undefined, hit_dice_d10_current: hitDiePools[10] || undefined, hit_dice_d12_max: hitDiePools[12] || undefined, hit_dice_d12_current: hitDiePools[12] || undefined, bardic_inspiration_max: bard > 0 ? prof : undefined, bardic_inspiration_current: bard > 0 ? prof : undefined, bardic_inspiration_die: bardicDie || undefined, ki_points_max: monk > 0 ? monk : undefined, ki_points_current: monk > 0 ? monk : undefined, warlock_slots_max: warlockProg.slots || undefined, warlock_slots_current: warlockProg.slots || undefined, warlock_slots_level: warlockProg.slotLevel || undefined, action_surge_max: fighter > 0 ? getFighterActionSurges(fighter) : undefined, action_surge_current: fighter > 0 ? getFighterActionSurges(fighter) : undefined, second_wind_available: fighter > 0 ? true : undefined, arcane_recovery_available: wizard > 0 ? true : undefined, arcane_recovery_used: wizard > 0 ? false : undefined, natural_recovery_available: druid > 0 ? true : undefined, natural_recovery_used: druid > 0 ? false : undefined, superiority_dice_max: superiorityDice || undefined, superiority_dice_current: superiorityDice || undefined, superiority_die_size: superiorityDieSize || undefined, rage_max: barbarian > 0 ? rageUses : undefined, rage_current: barbarian > 0 ? rageUses : undefined, sorcery_points_max: sorcerer > 0 ? sorcerer : undefined, sorcery_points_current: sorcerer > 0 ? sorcerer : undefined, channel_divinity_max: channelDivinityUses || undefined, channel_divinity_current: channelDivinityUses || undefined, lay_on_hands_max: layOnHands || undefined, lay_on_hands_current: layOnHands || undefined, wildshape_uses_remaining: druid > 0 ? 2 : undefined, fey_step_max: source.feat_fey_step ? prof : undefined, fey_step_current: source.feat_fey_step ? prof : undefined, celestial_revelation_used: source.feat_celestial_revelation ? false : undefined, relentless_endurance_used: source.feat_relentless_endurance || normalizeText(source.ancestry_name) === 'half-orc' ? false : undefined, mage_armour_active:false });
}
export function deriveCombatantResourceFields() { return {}; }
