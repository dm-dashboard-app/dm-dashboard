import { getAbilityModifier, getClassLevel, readNumberField, findExistingKey } from './classResources';
import { getShortRestResourcePatch } from './resourcePolicy';

export const SHORT_REST_LOG_ACTION = 'short_rest_procedure';
export const SHORT_REST_RESPONSE_ACTION = 'short_rest_response';

function parseJsonDetail(detail) {
  if (!detail) return null;
  if (typeof detail === 'object') return detail;
  try { return JSON.parse(detail); } catch (_err) { return null; }
}

export function getStateHitDicePools(state = {}, profile = {}) {
  const pools = [6, 8, 10, 12].map(size => ({
    size,
    currentKey: `hit_dice_d${size}_current`,
    maxKey: `hit_dice_d${size}_max`,
    current: readNumberField(state, [`hit_dice_d${size}_current`], 0),
    max: readNumberField(state, [`hit_dice_d${size}_max`], 0),
  })).filter(pool => pool.max > 0 || pool.current > 0);
  if (pools.length > 0) return pools;
  const legacyCurrent = readNumberField(state, ['hit_dice_current', 'hit_dice_remaining'], null);
  const legacyMax = readNumberField(state, ['hit_dice_max'], null);
  const legacySize = readNumberField(state, ['hit_die_size'], readNumberField(profile, ['hit_die_size'], null));
  if (legacyCurrent !== null || legacyMax !== null || legacySize !== null) {
    return [{
      size: legacySize || 0,
      currentKey: findExistingKey(state, ['hit_dice_current', 'hit_dice_remaining']) || 'hit_dice_current',
      maxKey: findExistingKey(state, ['hit_dice_max']) || 'hit_dice_max',
      current: legacyCurrent ?? 0,
      max: legacyMax ?? 0,
    }];
  }
  return [];
}

export function getSongOfRestDie(profile = {}) {
  const level = getClassLevel(profile, 'bard');
  if (level >= 17) return 'd12';
  if (level >= 13) return 'd10';
  if (level >= 9) return 'd8';
  if (level >= 2) return 'd6';
  return null;
}

export function getSongOfRestOwnerStateId(playerStates = []) {
  const eligible = (playerStates || [])
    .map((state) => ({
      stateId: state?.id,
      level: getClassLevel(state?.profiles_players || {}, 'bard'),
      die: getSongOfRestDie(state?.profiles_players || {}),
    }))
    .filter((row) => row.stateId && row.die);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => b.level - a.level);
  return eligible[0].stateId;
}

export function normalizeShortRestResponseInput(input = {}, pools = []) {
  const spendBySize = {};
  const totalHitDiceUsed = Math.max(0, parseInt(input.totalHitDiceUsed, 10) || 0);
  const singlePool = pools.length === 1 ? pools[0] : null;
  pools.forEach((pool) => {
    const key = `d${pool.size}`;
    if (singlePool && pool.size === singlePool.size) {
      spendBySize[key] = totalHitDiceUsed;
      return;
    }
    spendBySize[key] = Math.max(0, parseInt(input.spendBySize?.[key], 10) || 0);
  });
  return {
    rolledTotal: Math.max(0, parseInt(input.rolledTotal, 10) || 0),
    totalHitDiceUsed,
    songOfRestTotal: Math.max(0, parseInt(input.songOfRestTotal, 10) || 0),
    spendBySize,
  };
}

export function validateShortRestResponse({ input = {}, state = {}, profile = {}, isSongOfRestOwner = false }) {
  const pools = getStateHitDicePools(state, profile);
  const normalized = normalizeShortRestResponseInput(input, pools);
  const errors = [];
  const spendSum = Object.values(normalized.spendBySize).reduce((sum, value) => sum + value, 0);
  if (normalized.totalHitDiceUsed !== spendSum) errors.push('Total hit dice used must match hit-die breakdown.');
  pools.forEach((pool) => {
    const spent = normalized.spendBySize[`d${pool.size}`] || 0;
    if (spent > pool.current) errors.push(`Cannot spend more than ${pool.current}d${pool.size}.`);
  });
  return {
    pools,
    valid: errors.length === 0,
    errors,
    response: {
      sections: {
        healing: {
          rolledTotal: normalized.rolledTotal,
          totalHitDiceUsed: normalized.totalHitDiceUsed,
          spendBySize: normalized.spendBySize,
          songOfRestTotal: isSongOfRestOwner ? normalized.songOfRestTotal : 0,
        },
      },
      ready: errors.length === 0,
      version: 1,
    },
  };
}

export function computeHealingTotal(response = {}, profile = {}, sharedSongOfRestTotal = 0) {
  const healing = response?.sections?.healing || {};
  const rolled = Math.max(0, parseInt(healing.rolledTotal, 10) || 0);
  const used = Math.max(0, parseInt(healing.totalHitDiceUsed, 10) || 0);
  const conMod = getAbilityModifier(readNumberField(profile, ['ability_con'], 10));
  return Math.max(0, rolled + (conMod * used) + Math.max(0, parseInt(sharedSongOfRestTotal, 10) || 0));
}

export function getSharedSongOfRestTotal({ playerStates = [], responsesByStateId = {} } = {}) {
  const songOwnerId = getSongOfRestOwnerStateId(playerStates || []);
  if (!songOwnerId) return 0;
  return Math.max(0, parseInt(responsesByStateId?.[songOwnerId]?.response?.sections?.healing?.songOfRestTotal, 10) || 0);
}

export function buildShortRestPatch({ state = {}, profile = {}, healingTotal = 0, spendBySize = {} }) {
  const patch = { ...getShortRestResourcePatch(state, profile) };
  const hpCurrent = readNumberField(state, ['current_hp'], 0);
  const maxHpOverride = readNumberField(state, ['max_hp_override'], null);
  const profileMax = readNumberField(profile, ['max_hp'], hpCurrent);
  const maxHp = maxHpOverride !== null ? maxHpOverride : profileMax;
  patch.current_hp = Math.min(maxHp, hpCurrent + Math.max(0, parseInt(healingTotal, 10) || 0));
  const pools = getStateHitDicePools(state, profile);
  if (pools.length > 0) {
    pools.forEach(pool => {
      const spend = Math.max(0, Math.min(pool.current, parseInt(spendBySize[`d${pool.size}`], 10) || 0));
      patch[pool.currentKey] = pool.current - spend;
    });
  }
  return patch;
}


export function deriveShortRestAttunementChanges({ selectedAttuneIds = [], inventoryRows = [], maxAttuned = 3 } = {}) {
  const targetIds = Array.from(new Set((selectedAttuneIds || []).filter(Boolean))).slice(0, maxAttuned);
  const targetSet = new Set(targetIds);
  return (inventoryRows || []).map((row) => {
    const shouldBeAttuned = targetSet.has(row.id);
    return {
      ...row,
      shouldBeAttuned,
      needsUpdate: shouldBeAttuned !== !!row.attuned,
    };
  });
}

export function formatShortRestResponseLogDetail(detail = {}) {
  const response = detail?.response || {};
  const healing = response?.sections?.healing || {};
  const attunement = response?.sections?.attunement || {};
  const spendBySize = healing?.spendBySize || {};
  const spendSummary = Object.entries(spendBySize)
    .map(([size, amount]) => ({ size, amount: Math.max(0, parseInt(amount, 10) || 0) }))
    .filter((row) => row.amount > 0)
    .map((row) => `${row.amount}${row.size}`)
    .join(', ');
  const attunedCount = Array.isArray(attunement?.item_ids) ? attunement.item_ids.length : 0;

  return [
    'Short rest response ready',
    `rolled ${Math.max(0, parseInt(healing?.rolledTotal, 10) || 0)}`,
    `hit dice ${Math.max(0, parseInt(healing?.totalHitDiceUsed, 10) || 0)}`,
    spendSummary ? `spend ${spendSummary}` : null,
    `song ${Math.max(0, parseInt(healing?.songOfRestTotal, 10) || 0)}`,
    `attuned ${attunedCount}/3`,
  ].filter(Boolean).join(' • ');
}

export function deriveShortRestProcedureState(logRows = []) {
  let active = false;
  const responsesByStateId = {};
  let startedAt = null;

  const rows = [...(logRows || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  rows.forEach((row) => {
    if (row.action === SHORT_REST_LOG_ACTION) {
      const detail = parseJsonDetail(row.detail);
      if (detail?.type === 'start') {
        active = true;
        startedAt = row.created_at;
        Object.keys(responsesByStateId).forEach((key) => { delete responsesByStateId[key]; });
      }
      if (detail?.type === 'cancel' || detail?.type === 'complete') active = false;
      return;
    }

    if (row.action === SHORT_REST_RESPONSE_ACTION) {
      const detail = parseJsonDetail(row.detail);
      const stateId = detail?.player_state_id;
      if (active && stateId) responsesByStateId[stateId] = detail;
      return;
    }

    if (row.action === 'rest' && String(row.detail || '').toLowerCase().includes('short rest completed')) active = false;
  });

  return { active, startedAt, responsesByStateId };
}

export function deriveShortRestProcedureSnapshot({ procedureRows = [], responseRows = [] } = {}) {
  const rows = [...(procedureRows || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const latestProcedure = rows.reduce((latest, row) => {
    const detail = parseJsonDetail(row?.detail);
    if (!detail?.type) return latest;
    return row;
  }, null);

  if (!latestProcedure) return { active: false, startedAt: null, responsesByStateId: {} };
  const latestType = parseJsonDetail(latestProcedure.detail)?.type;
  if (latestType !== 'start') return { active: false, startedAt: null, responsesByStateId: {} };

  const startedAt = latestProcedure.created_at;
  const responsesByStateId = {};
  (responseRows || [])
    .filter((row) => row?.action === SHORT_REST_RESPONSE_ACTION && row?.created_at >= startedAt)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((row) => {
      const detail = parseJsonDetail(row.detail);
      const stateId = detail?.player_state_id;
      if (stateId) responsesByStateId[stateId] = detail;
    });

  return {
    active: true,
    startedAt,
    responsesByStateId,
  };
}
