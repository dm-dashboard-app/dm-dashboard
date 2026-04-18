export function normalizeLongRestAttunedIds(selectedIds = [], maxAttuned = 3) {
  return Array.from(new Set((selectedIds || []).filter(Boolean))).slice(0, maxAttuned);
}

export function buildLongRestRechargePlan({ rechargeDraft = {}, items = [] } = {}) {
  return (items || [])
    .map((item) => ({
      itemRowId: item.id,
      restoredCharges: Math.max(0, parseInt(rechargeDraft[item.id] || 0, 10) || 0),
    }))
    .filter((row) => row.itemRowId && row.restoredCharges > 0);
}
