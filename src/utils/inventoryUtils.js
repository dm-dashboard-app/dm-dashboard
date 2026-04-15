export function formatInventorySummary(summary = {}) {
  const totalItemQuantity = Math.max(0, parseInt(summary.total_item_quantity ?? summary.totalItemQuantity ?? 0, 10) || 0);
  const gp = Math.max(0, parseInt(summary.gp ?? 0, 10) || 0);
  return `Inventory • ${totalItemQuantity} items • ${gp} gp`;
}

export function normalizeInventoryItemPayload({ itemMasterId = null, customName = '', quantity = 1, notes = '' } = {}) {
  const cleanQuantity = Math.max(1, parseInt(quantity, 10) || 1);
  const cleanNotes = String(notes || '').trim() || null;
  const cleanCustomName = String(customName || '').trim();
  if (!itemMasterId && !cleanCustomName) {
    throw new Error('Item requires catalog id or custom name.');
  }
  return {
    itemMasterId: itemMasterId || null,
    customName: itemMasterId ? null : cleanCustomName,
    quantity: cleanQuantity,
    notes: cleanNotes,
  };
}

export function mergeCatalogItems(items = [], incoming = {}) {
  if (!incoming.item_master_id) return [...items, incoming];
  const index = items.findIndex((item) => item.item_master_id === incoming.item_master_id);
  if (index === -1) return [...items, incoming];
  const next = [...items];
  next[index] = {
    ...next[index],
    quantity: Math.max(0, parseInt(next[index].quantity || 0, 10)) + Math.max(0, parseInt(incoming.quantity || 0, 10)),
    notes: incoming.notes ?? next[index].notes,
  };
  return next;
}

export function evaluateTransferLifecycle({ senderAvailable = 0, requestedAmount = 0, accepted = false, isDmFlow = false } = {}) {
  if (isDmFlow) {
    return senderAvailable >= requestedAmount ? 'completed' : 'failed';
  }
  if (!accepted) return 'pending';
  return senderAvailable >= requestedAmount ? 'completed' : 'failed';
}
