import {
  getAbilityModifiers,
  getAbilityScores,
  getFinalArmorClass,
  getFinalSpellAttackBonus,
  getFinalSpellSaveDC,
  getSavingThrowTotals,
} from './classResources';
import { applyItemEffectsToProfile } from './itemEffects';

export function buildDerivedPlayerStats({ profile = {}, state = {}, inventoryItems = [] } = {}) {
  const baseAbilityScores = getAbilityScores(profile || {});
  const itemEffects = applyItemEffectsToProfile(profile || {}, inventoryItems || []);
  const abilityScores = Object.fromEntries(
    Object.entries(baseAbilityScores).map(([key, value]) => [key, value + (itemEffects.abilityBonus?.[key] || 0)]),
  );

  const scoreOverlay = {
    ...(profile || {}),
    ability_str: abilityScores.str,
    ability_dex: abilityScores.dex,
    ability_con: abilityScores.con,
    ability_int: abilityScores.int,
    ability_wis: abilityScores.wis,
    ability_cha: abilityScores.cha,
  };

  const abilityModifiers = getAbilityModifiers(scoreOverlay);
  const baseSaveTotals = getSavingThrowTotals(scoreOverlay);
  const saveTotals = Object.fromEntries(
    Object.entries(baseSaveTotals).map(([key, value]) => [key, value + (itemEffects.saveBonus?.[key] || 0)]),
  );

  return {
    abilityScores,
    abilityModifiers,
    saveTotals,
    spellSaveDc: (profile?.spell_save_dc || getFinalSpellSaveDC(profile || {})) + (itemEffects.spellSaveDcBonus || 0),
    spellAttackBonus: (profile?.spell_attack_bonus || getFinalSpellAttackBonus(profile || {})) + (itemEffects.spellAttackBonus || 0),
    armorClass: Math.max(getFinalArmorClass(profile || {}, state || {}), itemEffects.acFromItems || 0),
    itemEffects,
  };
}
