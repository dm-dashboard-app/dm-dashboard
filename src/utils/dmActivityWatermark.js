function storageKey(encounterId, type) {
  return `dm_dashboard_seen_${type}_${encounterId}`;
}

export function readSeenBoundary(encounterId, type) {
  if (!encounterId) return null;
  const raw = localStorage.getItem(storageKey(encounterId, type));
  return raw || null;
}

export function ensureSeenBoundary(encounterId, type) {
  if (!encounterId) return null;
  const existing = readSeenBoundary(encounterId, type);
  if (existing) return existing;
  const nowIso = new Date().toISOString();
  localStorage.setItem(storageKey(encounterId, type), nowIso);
  return nowIso;
}

export function markSeenBoundary(encounterId, type, isoTimestamp = null) {
  if (!encounterId) return null;
  const next = isoTimestamp || new Date().toISOString();
  localStorage.setItem(storageKey(encounterId, type), next);
  return next;
}
