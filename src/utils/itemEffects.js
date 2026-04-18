import { getAbilityModifier, readNumberField } from './classResources';

export const EQUIPMENT_SLOT_LIMITS = {
  armor: 1,
  shield: 1,
  main_hand: 1,
  off_hand: 1,
  neck: 1,
  ring: null,
};

const EMPTY_EFFECTS = Object.freeze([]);

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function extractItemMechanics(item = {}) {
  const metadata = item?.metadata_json || {};
  return metadata.mechanics || item.mechanics || null;
}

export function mechanicsSupportLevel(item = {}) {
  return String(item?.metadata_json?.mechanics_support || 'unsupported');
}

export function isMechanicsSupported(item = {}) {
  return mechanicsSupportLevel(item) === 'phase1_supported';
}

export function resolveItemSlot(item = {}) {
  const mechanics = extractItemMechanics(item);
  const raw = String(mechanics?.slot_family || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'rings') return 'ring';
  return raw;
}

export function getItemMaxCharges(item = {}) {
  const mechanics = extractItemMechanics(item);
  return Math.max(0, toNumber(mechanics?.charges?.max, 0));
}

export function getItemPassiveEffects(item = {}) {
  const mechanics = extractItemMechanics(item);
  return Array.isArray(mechanics?.passive_effects) ? mechanics.passive_effects : EMPTY_EFFECTS;
}

export function itemRequiresAttunement(item = {}) {
  const mechanics = extractItemMechanics(item);
  if (typeof mechanics?.requires_attunement === 'boolean') return mechanics.requires_attunement;
  return !!item.requires_attunement;
}

export function isItemActive(item = {}) {
  const equipped = !!item.equipped;
  const attuned = !!item.attuned;
  const mechanics = extractItemMechanics(item);
  const activation = String(mechanics?.activation_mode || '').toLowerCase();
  const requiresAttune = itemRequiresAttunement(item);

  if (activation === 'attunement_only') return attuned;
  if (requiresAttune) return equipped && attuned;
  return equipped;
}

export function applyItemEffectsToProfile(profile = {}, inventoryItems = []) {
  const abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const abilitySetMin = {};
  const saveBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const bonuses = {
    acFlat: 0,
    shieldAc: 0,
    spellSaveDc: 0,
    spellAttack: 0,
  };

  let armorFormula = null;

  (inventoryItems || []).forEach((item) => {
    if (!isMechanicsSupported(item)) return;
    if (!isItemActive(item)) return;
    const mechanics = extractItemMechanics(item);
    if (mechanics?.armor?.base_ac) {
      armorFormula = {
        baseAc: toNumber(mechanics.armor.base_ac, 10),
        dexCap: mechanics.armor.dex_cap === null || mechanics.armor.dex_cap === undefined ? null : toNumber(mechanics.armor.dex_cap, null),
        addDex: mechanics.armor.add_dex !== false,
      };
    }

    getItemPassiveEffects(item).forEach((effect) => {
      const type = String(effect?.type || '').toLowerCase();
      const value = toNumber(effect?.value, 0);

      if (type === 'flat_bonus') {
        const target = String(effect?.target || '').toLowerCase();
        if (target === 'ac') bonuses.acFlat += value;
        if (target === 'spell_attack') bonuses.spellAttack += value;
        if (target === 'spell_save_dc') bonuses.spellSaveDc += value;
        return;
      }

      if (!value && type !== 'ability_score_set_min') return;

      if (type === 'ac_flat') bonuses.acFlat += value;
      else if (type === 'shield_ac_bonus') bonuses.shieldAc += value;
      else if (type === 'spell_save_dc_bonus') bonuses.spellSaveDc += value;
      else if (type === 'spell_attack_bonus') bonuses.spellAttack += value;
      else if (type === 'ability_score_bonus') {
        const key = String(effect?.ability || '').toLowerCase();
        if (Object.prototype.hasOwnProperty.call(abilityBonus, key)) abilityBonus[key] += value;
      } else if (type === 'ability_score_set_min') {
        const key = String(effect?.ability || '').toLowerCase();
        const minValue = Math.max(1, toNumber(effect?.min, 0));
        if (Object.prototype.hasOwnProperty.call(abilityBonus, key) && minValue > 0) {
          abilitySetMin[key] = Math.max(abilitySetMin[key] || 0, minValue);
        }
      } else if (type === 'all_saves_bonus') {
        Object.keys(saveBonus).forEach((saveKey) => {
          saveBonus[saveKey] += value;
        });
      } else if (type === 'saving_throw_bonus') {
        const key = String(effect?.save || '').toLowerCase();
        if (key === 'all') {
          Object.keys(saveBonus).forEach((saveKey) => {
            saveBonus[saveKey] += value;
          });
        } else if (Object.prototype.hasOwnProperty.call(saveBonus, key)) {
          saveBonus[key] += value;
        }
      }
    });
  });

  const nextAbilities = { ...abilityBonus };
  Object.keys(nextAbilities).forEach((abilityKey) => {
    const baseScore = readNumberField(profile, [`ability_${abilityKey}`], 10);
    const adjusted = baseScore + nextAbilities[abilityKey];
    const floor = abilitySetMin[abilityKey] || 0;
    if (floor > adjusted) {
      nextAbilities[abilityKey] += floor - adjusted;
    }
  });

  const dexScore = readNumberField(profile, ['ability_dex'], 10) + nextAbilities.dex;
  const dexMod = getAbilityModifier(dexScore);
  let armorAc = readNumberField(profile, ['ac'], 10);
  if (armorFormula) {
    const cappedDex = armorFormula.dexCap === null ? dexMod : Math.min(dexMod, armorFormula.dexCap);
    armorAc = armorFormula.baseAc + (armorFormula.addDex ? cappedDex : 0);
  }

  return {
    abilityBonus: nextAbilities,
    saveBonus,
    acFromItems: armorAc + bonuses.shieldAc + bonuses.acFlat,
    spellSaveDcBonus: bonuses.spellSaveDc,
    spellAttackBonus: bonuses.spellAttack,
    supportCoverage: (inventoryItems || []).filter((row) => isMechanicsSupported(row)).length,
  };
}

export function classifyInventoryRows(items = []) {
  const itemRows = [];
  const equipmentRows = [];
  const attunementRows = [];

  (items || []).forEach((item) => {
    if (item?.attuned) {
      attunementRows.push(item);
      return;
    }
    if (item?.equipped) {
      equipmentRows.push(item);
      return;
    }
    itemRows.push(item);
  });

  return {
    itemRows,
    equipmentRows,
    attunementRows,
  };
}
