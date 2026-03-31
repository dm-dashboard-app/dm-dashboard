import { supabase } from '../supabaseClient';

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function nextZeroHpConditions(newHp, conditions = []) {
  const next = [...conditions];
  if (newHp === 0) {
    if (!next.includes('UNC')) next.push('UNC');
    if (!next.includes('PRN')) next.push('PRN');
    return next;
  }
  if (newHp > 0) return next.filter(c => c !== 'UNC');
  return next;
}

function getPlayerName(combatant = {}, profile = {}) {
  return profile?.name || combatant?.name || 'PC';
}

async function insertConcentrationCheck(encounterId, playerName, dc) {
  if (!encounterId || !playerName || !dc) return;
  await supabase.from('concentration_checks').insert({ encounter_id: encounterId, player_name: playerName, dc });
}

async function logCombat(encounterId, actor, action, detail) {
  if (!encounterId || !detail) return;
  await supabase.from('combat_log').insert({ encounter_id: encounterId, actor, action, detail });
}

export async function applyPlayerDamage({ state, combatant, encounterId, amount, actor = 'DM' }) {
  if (!state || !amount || amount <= 0) return { updated: false };

  const profile = state.profiles_players || {};
  const playerName = getPlayerName(combatant, profile);
  const currentConditions = state.conditions || [];
  const currentBaseHp = toInt(state.current_hp, 0);
  const currentTempHp = toInt(state.temp_hp, 0);
  const currentWildshapeHp = toInt(state.wildshape_hp_current, 0);
  const wildshapeActive = !!state.wildshape_active;
  const concentration = !!state.concentration;
  const updates = {};
  let remaining = toInt(amount, 0);

  if (concentration) {
    const dc = Math.max(10, Math.floor(remaining / 2));
    updates.concentration_check_dc = dc;
    await insertConcentrationCheck(encounterId, playerName, dc);
  }

  if (currentTempHp > 0) {
    const burn = Math.min(currentTempHp, remaining);
    remaining -= burn;
    updates.temp_hp = currentTempHp - burn;
  }

  if (wildshapeActive && currentWildshapeHp > 0 && remaining > 0) {
    const nextWildshapeHp = Math.max(0, currentWildshapeHp - remaining);
    const overflow = Math.max(0, remaining - currentWildshapeHp);
    updates.wildshape_hp_current = nextWildshapeHp;

    if (nextWildshapeHp === 0) {
      updates.wildshape_active = false;
      updates.wildshape_form_id = null;
      updates.wildshape_hp_current = null;
    }

    if (overflow > 0) {
      const newBaseHp = Math.max(0, currentBaseHp - overflow);
      updates.current_hp = newBaseHp;
      updates.conditions = nextZeroHpConditions(newBaseHp, currentConditions);
      await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
      await logCombat(encounterId, actor, 'damage', `${playerName}: -${amount} HP (${currentBaseHp} → ${newBaseHp})`);
      return { updated: true, updates };
    }

    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    await logCombat(encounterId, actor, 'damage', `${playerName}: -${amount} Wild Shape HP`);
    return { updated: true, updates };
  }

  if (remaining > 0) {
    const newBaseHp = Math.max(0, currentBaseHp - remaining);
    updates.current_hp = newBaseHp;
    updates.conditions = nextZeroHpConditions(newBaseHp, currentConditions);
    await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
    await logCombat(encounterId, actor, 'damage', `${playerName}: -${amount} HP (${currentBaseHp} → ${newBaseHp})`);
    return { updated: true, updates };
  }

  await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
  await logCombat(encounterId, actor, 'damage', `${playerName}: -${amount} (temp HP absorbed)`);
  return { updated: true, updates };
}

export async function applyPlayerHeal({ state, combatant, encounterId, amount, actor = 'DM' }) {
  if (!state || !amount || amount <= 0) return { updated: false };

  const profile = state.profiles_players || {};
  const playerName = getPlayerName(combatant, profile);
  const currentConditions = state.conditions || [];
  const currentBaseHp = toInt(state.current_hp, 0);
  const baseMaxHp = toInt(state.max_hp_override ?? profile.max_hp, currentBaseHp);
  const wildshapeActive = !!state.wildshape_active;
  const currentWildshapeHp = toInt(state.wildshape_hp_current, 0);
  const wildshapeMaxHp = toInt(state.wildshape_hp_max, currentWildshapeHp);

  if (wildshapeActive && currentWildshapeHp > 0 && wildshapeMaxHp > 0) {
    const nextWildshapeHp = Math.min(wildshapeMaxHp, currentWildshapeHp + amount);
    await supabase.from('player_encounter_state').update({ wildshape_hp_current: nextWildshapeHp }).eq('id', state.id);
    await logCombat(encounterId, actor, 'heal', `${playerName}: +${amount} Wild Shape HP (${currentWildshapeHp} → ${nextWildshapeHp})`);
    return { updated: true, updates: { wildshape_hp_current: nextWildshapeHp } };
  }

  const nextBaseHp = Math.min(baseMaxHp, currentBaseHp + amount);
  const updates = {
    current_hp: nextBaseHp,
    conditions: nextZeroHpConditions(nextBaseHp, currentConditions),
  };

  await supabase.from('player_encounter_state').update(updates).eq('id', state.id);
  await logCombat(encounterId, actor, 'heal', `${playerName}: +${amount} HP (${currentBaseHp} → ${nextBaseHp})`);
  return { updated: true, updates };
}

export async function togglePlayerReaction(stateId, reactionUsed) {
  if (!stateId) return;
  await supabase.from('player_encounter_state').update({ reaction_used: !reactionUsed }).eq('id', stateId);
}

export async function togglePlayerConcentration(stateId, concentration) {
  if (!stateId) return;
  const updates = { concentration: !concentration };
  if (concentration) updates.concentration_check_dc = null;
  await supabase.from('player_encounter_state').update(updates).eq('id', stateId);
}
