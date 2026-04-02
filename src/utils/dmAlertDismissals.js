export function dismissalStorageKey(encounterId, type) {
  return `dm_dashboard_dismissed_${type}_${encounterId}`;
}

export function readDismissedIds(encounterId, type) {
  if (!encounterId) return [];
  try {
    return JSON.parse(localStorage.getItem(dismissalStorageKey(encounterId, type)) || '[]');
  } catch {
    return [];
  }
}

export function writeDismissedIds(encounterId, type, ids) {
  if (!encounterId) return;
  localStorage.setItem(dismissalStorageKey(encounterId, type), JSON.stringify(ids));
}

export function appendDismissedId(encounterId, type, ids, id) {
  const next = Array.from(new Set([...(ids || []), id]));
  writeDismissedIds(encounterId, type, next);
  return next;
}
