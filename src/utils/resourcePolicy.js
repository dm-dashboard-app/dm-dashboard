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

function shouldIncludeWarlockSlotsForSurface(surface) {
  return surface === RESOURCE_SURFACES.PLAYER_CARD;
}

function shouldIncludeNaturalRecoveryForSurface(surface) {
  return false;
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
      patch[resource.boolKey] = resource.toggleMode === 'available' ? true : false;
      return;
    }

    if (!resource.currentKey) return;
    const maxKey = resource.maxKey ? findExistingKey(state, [resource.maxKey]) || resource.maxKey : null;
    const maxValue = maxKey ? readNumberField(state, [maxKey], resource.fallbackMax ?? null) : (resource.fallbackMax ?? null);
    if (maxValue === null) return;
    patch[resource.currentKey] = maxValue;
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
    const restoreOnLongRest = familyId !== 'natural-recovery';
    if (!restoreOnLongRest) return;

    if (resource.type === 'toggle') {
      if (!resource.boolKey) return;
      patch[resource.boolKey] = resource.toggleMode === 'available' ? true : false;
      return;
    }

    if (!resource.currentKey) return;
    const maxKey = resource.maxKey ? findExistingKey(state, [resource.maxKey]) || resource.maxKey : null;
    const maxValue = maxKey ? readNumberField(state, [maxKey], resource.fallbackMax ?? null) : (resource.fallbackMax ?? null);
    if (maxValue === null) return;
    patch[resource.currentKey] = maxValue;
  });

  const pools = getHitDiePools(profile);
  [6, 8, 10, 12].forEach(size => {
    const currentKey = `hit_dice_d${size}_current`;
    const maxKey = `hit_dice_d${size}_max`;
    if (findExistingKey(state, [currentKey, maxKey]) || pools[size] > 0) {
      patch[currentKey] = readNumberField(state, [maxKey], pools[size] || 0);
    }
  });

  if (findExistingKey(state, ['hit_dice_current'])) {
    patch.hit_dice_current = readNumberField(state, ['hit_dice_max'], profile?.hit_dice_max ?? 0);
  }

  patch.temp_hp = 0;
  patch.concentration = false;
  patch.concentration_check_dc = null;
  patch.reaction_used = false;
  patch.wildshape_active = false;
  patch.wildshape_form_id = null;
  patch.wildshape_hp_current = null;

  const wildshapeKey = findExistingKey(state, ['wildshape_uses_remaining']);
  if (wildshapeKey) {
    const explicitMax = readNumberField(state, ['wildshape_uses_max'], null);
    patch[wildshapeKey] = explicitMax ?? (profile?.wildshape_enabled ? 2 : state[wildshapeKey]);
  }

  return patch;
}
