import { supabase } from '../../supabaseClient';
import { getClassEntries } from '../../utils/classResources';

export function sortCombatants(combatants) {
  return [...combatants].sort((a, b) => {
    const ai = a.initiative_total ?? -999;
    const bi = b.initiative_total ?? -999;
    if (bi !== ai) return bi - ai;
    const am = a.initiative_mod ?? 0;
    const bm = b.initiative_mod ?? 0;
    if (bm !== am) return bm - am;
    return a.id < b.id ? -1 : 1;
  });
}

export function getDisplayOrderedCombatants(combatants, turnIndex) {
  if (!combatants.length) return [];
  const safe = Math.max(0, Math.min(turnIndex ?? 0, combatants.length - 1));
  return [...combatants.slice(safe), ...combatants.slice(0, safe)];
}

export function logCombat(encounterId, actor, action, detail) {
  if (!encounterId) return;
  supabase
    .from('combat_log')
    .insert({ encounter_id: encounterId, actor, action, detail })
    .then(() => {});
}

export function nextZeroHpConditions(newHp, conditions = []) {
  const next = [...conditions];
  if (newHp === 0) {
    if (!next.includes('UNC')) next.push('UNC');
    if (!next.includes('PRN')) next.push('PRN');
    return next;
  }
  if (newHp > 0) return next.filter(c => c !== 'UNC');
  return next;
}

export function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

export function formatClassLine(source = {}) {
  return getClassEntries(source)
    .map(entry => {
      const left = [entry.displayClass, entry.subclassName].filter(Boolean).join(' • ');
      const levelPart = entry.level ? `Lv ${entry.level}` : '';
      return [left, levelPart].filter(Boolean).join(' • ');
    })
    .filter(Boolean)
    .join(' / ');
}
