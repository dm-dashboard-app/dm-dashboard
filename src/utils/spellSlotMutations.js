import { supabase } from '../supabaseClient';

function getClassLevel(profile = {}, className) {
  const wanted = String(className || '').trim().toLowerCase();
  const entries = [
    [profile.class_name, profile.class_level],
    [profile.class_name_2, profile.class_level_2],
  ];
  return entries.reduce((sum, [name, level]) => {
    return String(name || '').trim().toLowerCase() === wanted ? sum + (parseInt(level, 10) || 0) : sum;
  }, 0);
}

function getWarlockFallback(profile = {}) {
  const level = getClassLevel(profile, 'warlock');
  if (level <= 0) return { slots: 0, slotLevel: 0 };
  if (level === 1) return { slots: 1, slotLevel: 1 };
  if (level <= 10) return { slots: 2, slotLevel: Math.ceil(level / 2) };
  if (level <= 16) return { slots: 3, slotLevel: 5 };
  return { slots: 4, slotLevel: 5 };
}

export function getStandardSlotState(profile = {}, state = {}, level) {
  const max = profile?.[`slots_max_${level}`] || 0;
  const used = state?.[`slots_used_${level}`] || 0;
  const available = Math.max(0, max - used);
  return {
    level,
    max,
    used,
    available,
    hasAny: max > 0,
    canSpend: available > 0,
    canRestore: used > 0,
  };
}

export function getPactSlotState(profile = {}, state = {}, level = 0) {
  const fallback = getWarlockFallback(profile);
  const pactLevel = state?.warlock_slots_level > 0 ? state.warlock_slots_level : fallback.slotLevel;
  const max = state?.warlock_slots_max > 0 ? state.warlock_slots_max : fallback.slots;
  const current = state?.warlock_slots_current > 0 ? state.warlock_slots_current : (max > 0 && (state?.warlock_slots_current === 0) && (state?.warlock_slots_max || 0) <= 0 ? max : (state?.warlock_slots_current || 0));
  const canPowerLevel = max > 0 && pactLevel >= level;
  return {
    level: pactLevel,
    max,
    current,
    available: current,
    hasAny: max > 0,
    canPowerLevel,
    canSpend: canPowerLevel && current > 0,
    canRestore: current < max,
  };
}

export function getSpellSlotAvailability(profile = {}, state = {}, level) {
  const standard = getStandardSlotState(profile, state, level);
  const pact = getPactSlotState(profile, state, level);
  return {
    standard,
    pact,
    hasAnyAvailable: standard.canSpend || pact.canSpend,
  };
}

export async function spendStandardSlot(stateId, profile = {}, state = {}, level) {
  if (!stateId) return false;
  const standard = getStandardSlotState(profile, state, level);
  if (!standard.canSpend) return false;
  await supabase
    .from('player_encounter_state')
    .update({ [`slots_used_${level}`]: standard.used + 1 })
    .eq('id', stateId);
  return true;
}

export async function restoreStandardSlot(stateId, state = {}, level) {
  if (!stateId) return false;
  const used = state?.[`slots_used_${level}`] || 0;
  if (used <= 0) return false;
  await supabase
    .from('player_encounter_state')
    .update({ [`slots_used_${level}`]: used - 1 })
    .eq('id', stateId);
  return true;
}

export async function resetStandardSlotsForLevel(stateId, level) {
  if (!stateId) return false;
  await supabase
    .from('player_encounter_state')
    .update({ [`slots_used_${level}`]: 0 })
    .eq('id', stateId);
  return true;
}

export async function spendPactSlot(stateId, profile = {}, state = {}) {
  if (!stateId) return false;
  const pact = getPactSlotState(profile, state, 1);
  if (pact.current <= 0) return false;
  await supabase
    .from('player_encounter_state')
    .update({ warlock_slots_current: pact.current - 1, warlock_slots_max: pact.max, warlock_slots_level: pact.level })
    .eq('id', stateId);
  return true;
}

export async function restorePactSlot(stateId, profile = {}, state = {}) {
  if (!stateId) return false;
  const pact = getPactSlotState(profile, state, 1);
  if (pact.current >= pact.max) return false;
  await supabase
    .from('player_encounter_state')
    .update({ warlock_slots_current: pact.current + 1, warlock_slots_max: pact.max, warlock_slots_level: pact.level })
    .eq('id', stateId);
  return true;
}

export async function spendSpellSlotWithChoice({
  stateId,
  profile = {},
  state = {},
  level,
  preferPact = null,
}) {
  if (!stateId || !level) return false;

  const { standard, pact } = getSpellSlotAvailability(profile, state, level);

  if (standard.canSpend && pact.canSpend) {
    if (preferPact === true) return spendPactSlot(stateId, profile, state);
    if (preferPact === false) return spendStandardSlot(stateId, profile, state, level);
    return false;
  }

  if (pact.canSpend) return spendPactSlot(stateId, profile, state);
  if (standard.canSpend) return spendStandardSlot(stateId, profile, state, level);
  return false;
}
