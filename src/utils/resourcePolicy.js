import {
  getUnifiedResourceConfig,
  findExistingKey,
  readNumberField,
  readBooleanField,
  getHitDiePools,
} from './classResources';

export const RESOURCE_SURFACES = {
  PLAYER_CARD: 'playerCard',
  INITIATIVE: 'initiative',
  DISPLAY: 'display',
  SHORT_REST: 'shortRest',
};

const SURFACE_RULES = {
  'hit-dice': { playerCard: true, initiative: false, display: false, shortRest: true },
  'warlock-slots': { playerCard: false, initiative: false, display: false, shortRest: true, managedBySpellSlotGrid: true },
  'natural-recovery': { playerCard: false, initiative: false, display: false, shortRest: true },
  lucky: { playerCard: true, initiative: true, display: false, shortRest: false },
  'relentless-endurance': { playerCard: true, initiative: true, display: false, shortRest: false },
  'fey-step': { playerCard: true, initiative: false, display: false, shortRest: false },
  'celestial-revelation': { playerCard: true, initiative: false, display: false, shortRest: false },
  'bardic-inspiration': { playerCard: true, initiative: true, display: false, shortRest: true },
  ki: { playerCard: true, initiative: true, display: false, shortRest: true },
  'channel-divinity': { playerCard: true, initiative: true, display: false, shortRest: true },
  rage: { playerCard: true, initiative: true, display: false, shortRest: false },
  'sorcery-points': { playerCard: true, initiative: true, display: false, shortRest: false },
  'second-wind': { playerCard: true, initiative: true, display: false, shortRest: true },
  'action-surge': { playerCard: true, initiative: true, display: false, shortRest: true },
  'superiority-dice': { playerCard: true, initiative: true, display: false, shortRest: true },
  'lay-on-hands': { playerCard: true, initiative: true, display: false, shortRest: false },
  'arcane-recovery': { playerCard: true, initiative: true, display: false, shortRest: true },
};

function shouldIncludeHitDiceForSurface(surface) {
  return surface === RESOURCE_SURFACES.PLAYER_CARD;
}

function shouldIncludeWarlockSlotsForSurface() {
  return false;
}

function shouldIncludeNaturalRecoveryForSurface() {
  return false;
}

function assignIfPresent(state, patch, key, value) {
  if (Object.prototype.hasOwnProperty.call(state || {}, key)) {
    patch[key] = value;
  }
}

function resolveRestMaxValue(state, resource) {
  const fallbackMax = resource.fallbackMax ?? null;
  const maxKey = resource.maxKey ? findExistingKey(state, [resource.maxKey]) || resource.maxKey : null;
  const rawMax = maxKey ? readNumberField(state, [maxKey], null) : null;
  if (rawMax === null) return fallbackMax;
  if (rawMax <= 0 && fallbackMax !== null && fallbackMax > 0) return fallbackMax;
  return rawMax;
}

export function getSurfaceResourceConfig(profile = {}, state = {}, surface = RESOURCE_SURFACES.PLAYER_CARD) {
  const base = getUnifiedResourceConfig(profile, state, {
    compactLabels: surface === RESOURCE_SURFACES.INITIATIVE,
    includeHitDice: shouldIncludeHitDiceForSurface(surface),
    includeWarlockSlots: shouldIncludeWarlockSlotsForSurface(surface),
    includeNaturalRecovery: shouldIncludeNaturalRecoveryForSurface(surface),
  });

  return base.filter(resource => {
    const familyId = resource.id.startsWith('hit-dice-d') ? 'hit-dice' : resource.id;
    const rules = SURFACE_RULES[familyId];
    if (!rules) return surface !== RESOURCE_SURFACES.DISPLAY;
    return !!rules[surface];
  });
}

export function resolveResourceToggleState(resource, source = {}) {
  const raw = readBooleanField(source, [resource.boolKey], null);
  const ready = resource.toggleMode === 'available'
    ? (raw !== null ? raw : !!resource.fallbackReady)
    : (raw !== null ? !raw : !!resource.fallbackReady);

  return {
    ready,
    spent: !ready,
    label: ready ? (resource.readyLabel || 'Ready') : (resource.spentLabel || 'Used'),
  };
}

export function getShortRestResourcePatch(state = {}, profile = {}) {
  const patch = {};
  const resources = getUnifiedResourceConfig(profile, state, {
    compactLabels: false,
    includeHitDice: false,
    includeWarlockSlots: true,
    includeNaturalRecovery: false,
  });

  resources.forEach(resource => {
    const familyId = resource.id.startsWith('hit-dice-d') ? 'hit-dice' : resource.id;
    const rules = SURFACE_RULES[familyId];
    if (!rules?.shortRest) return;

    if (resource.type === 'toggle') {
      if (!resource.boolKey) return;
      assignIfPresent(state, patch, resource.boolKey, resource.toggleMode === 'available' ? true : false);
      return;
    }

    if (!resource.currentKey) return;
    const maxValue = resolveRestMaxValue(state, resource);
    if (maxValue === null) return;
    assignIfPresent(state, patch, resource.currentKey, maxValue);
    if (resource.maxKey) assignIfPresent(state, patch, resource.maxKey, maxValue);
  });

  const wildshapeKey = findExistingKey(state, ['wildshape_uses_remaining']);
  if (wildshapeKey) {
    const explicitMax = readNumberField(state, ['wildshape_uses_max'], null);
    patch[wildshapeKey] = explicitMax ?? (profile?.wildshape_enabled ? 2 : state[wildshapeKey]);
  }

  return patch;
}

export function getLongRestResourcePatch(state = {}, profile = {}) {
  const patch = {};
  const resources = getUnifiedResourceConfig(profile, state, {
    compactLabels: false,
    includeHitDice: true,
    includeWarlockSlots: true,
    includeNaturalRecovery: false,
  });

  resources.forEach(resource => {
    const familyId = resource.id.startsWith('hit-dice-d') ? 'hit-dice' : resource.id;
    if (familyId === 'natural-recovery') return;

    if (resource.type === 'toggle') {
      if (!resource.boolKey) return;
      assignIfPresent(state, patch, resource.boolKey, resource.toggleMode === 'available' ? true : false);
      return;
    }

    if (!resource.currentKey) return;
    const maxValue = resolveRestMaxValue(state, resource);
    if (maxValue === null) return;
    assignIfPresent(state, patch, resource.currentKey, maxValue);
    if (resource.maxKey) assignIfPresent(state, patch, resource.maxKey, maxValue);
  });

  const pools = getHitDiePools(profile);
  [6, 8, 10, 12].forEach(size => {
    const currentKey = `hit_dice_d${size}_current`;
    const maxKey = `hit_dice_d${size}_max`;
    if (findExistingKey(state, [currentKey, maxKey]) || pools[size] > 0) {
      assignIfPresent(state, patch, currentKey, readNumberField(state, [maxKey], pools[size] || 0));
      assignIfPresent(state, patch, maxKey, readNumberField(state, [maxKey], pools[size] || 0));
    }
  });

  if (findExistingKey(state, ['hit_dice_current'])) {
    assignIfPresent(state, patch, 'hit_dice_current', readNumberField(state, ['hit_dice_max'], profile?.hit_dice_max ?? 0));
    assignIfPresent(state, patch, 'hit_dice_max', readNumberField(state, ['hit_dice_max'], profile?.hit_dice_max ?? 0));
  }

  for (let level = 1; level <= 9; level += 1) {
    const usedKey = findExistingKey(state, [`slots_used_${level}`]);
    if (usedKey) patch[usedKey] = 0;
  }

  assignIfPresent(state, patch, 'temp_hp', 0);
  assignIfPresent(state, patch, 'concentration', false);
  assignIfPresent(state, patch, 'concentration_check_dc', null);
  assignIfPresent(state, patch, 'concentration_spell_id', null);
  assignIfPresent(state, patch, 'reaction_used', false);
  assignIfPresent(state, patch, 'wildshape_active', false);
  assignIfPresent(state, patch, 'wildshape_form_id', null);
  assignIfPresent(state, patch, 'wildshape_hp_current', null);
  assignIfPresent(state, patch, 'mage_armour_active', false);

  const wildshapeKey = findExistingKey(state, ['wildshape_uses_remaining']);
  if (wildshapeKey) {
    const explicitMax = readNumberField(state, ['wildshape_uses_max'], null);
    patch[wildshapeKey] = explicitMax ?? (profile?.wildshape_enabled ? 2 : state[wildshapeKey]);
  }

  return patch;
}
