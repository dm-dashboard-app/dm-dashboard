import { supabase } from '../supabaseClient';

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

export function getPactSlotState(state = {}, level = 0) {
  const pactLevel = state?.warlock_slots_level || 0;
  const max = state?.warlock_slots_max || 0;
  const current = state?.warlock_slots_current || 0;
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
  const pact = getPactSlotState(state, level);
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

export async function spendPactSlot(stateId, state = {}) {
  if (!stateId) return false;
  const current = state?.warlock_slots_current || 0;
  if (current <= 0) return false;
  await supabase
    .from('player_encounter_state')
    .update({ warlock_slots_current: current - 1 })
    .eq('id', stateId);
  return true;
}

export async function restorePactSlot(stateId, state = {}) {
  if (!stateId) return false;
  const current = state?.warlock_slots_current || 0;
  const max = state?.warlock_slots_max || 0;
  if (current >= max) return false;
  await supabase
    .from('player_encounter_state')
    .update({ warlock_slots_current: current + 1 })
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
    if (preferPact === true) return spendPactSlot(stateId, state);
    if (preferPact === false) return spendStandardSlot(stateId, profile, state, level);
    return false;
  }

  if (pact.canSpend) return spendPactSlot(stateId, state);
  if (standard.canSpend) return spendStandardSlot(stateId, profile, state, level);
  return false;
}
