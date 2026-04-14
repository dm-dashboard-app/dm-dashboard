export function countCoreRows(rows = []) {
  return rows.filter(row => row?.stock_lane === 'core' || row?.is_core_stock === true).length;
}

export function buildGenerationSeedWithCoreCount(baseSeed, coreCount = 0) {
  const safeBase = String(baseSeed || '').trim() || 'seed';
  const safeCount = Math.max(0, Number(coreCount) || 0);
  return `${safeBase}|core:${safeCount}`;
}

export function parseCoreCountFromGenerationSeed(seed = '') {
  const text = String(seed || '');
  const match = text.match(/(?:^|\|)core:(\d+)(?:\||$)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function normalizeLane(value) {
  const lane = String(value || '').trim().toLowerCase();
  if (lane === 'core' || lane === 'rotating') return lane;
  return null;
}

export function applyPersistedStockLanes(rows = [], { shopType = 'general_store', generationSeed = '' } = {}) {
  const hasExplicitLane = rows.some(row => normalizeLane(row?.stock_lane));
  if (hasExplicitLane) {
    return rows.map(row => {
      const lane = normalizeLane(row?.stock_lane) || 'rotating';
      return { ...row, stock_lane: lane, is_core_stock: lane === 'core' };
    });
  }

  const coreCount = parseCoreCountFromGenerationSeed(generationSeed);
  if (coreCount !== null) {
    return rows.map((row, index) => {
      const lane = index < coreCount ? 'core' : 'rotating';
      return { ...row, stock_lane: lane, is_core_stock: lane === 'core' };
    });
  }

  return rows.map(row => ({ ...row, stock_lane: 'rotating', is_core_stock: false }));
}
