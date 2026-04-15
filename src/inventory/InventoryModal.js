import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  inventoryCreateTransfer,
  inventoryGetLog,
  inventoryGetSnapshot,
  inventoryGetTransferTargets,
  inventoryRemoveItem,
  inventorySearchCatalog,
  inventorySetCurrency,
  inventoryUpsertItem,
} from './inventoryClient';
import { formatInventorySummary, normalizeInventoryItemPayload } from '../utils/inventoryUtils';

export default function InventoryModal({
  open,
  onClose,
  role,
  playerProfileId,
  playerName,
  joinCode = null,
  senderProfileId = null,
}) {
  const [snapshot, setSnapshot] = useState({ items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, summary: { total_item_quantity: 0, gp: 0 } });
  const [query, setQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargets, setTransferTargets] = useState([]);
  const [transferPayload, setTransferPayload] = useState({
    kind: 'item',
    itemRowId: null,
    quantity: 1,
    currencyType: 'gp',
    amount: 1,
    receiver: '',
  });
  const [logRows, setLogRows] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const canEdit = role === 'dm' || role === 'player';
  const isDm = role === 'dm';

  const loadAll = useCallback(async () => {
    if (!playerProfileId) return;
    const [nextSnapshot, targets] = await Promise.all([
      inventoryGetSnapshot({ playerProfileId, role, joinCode }),
      inventoryGetTransferTargets({ playerProfileId, role, joinCode }),
    ]);
    setSnapshot(nextSnapshot || { items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, summary: { total_item_quantity: 0, gp: 0 } });
    setTransferTargets((targets || []).filter((row) => row.profile_id !== playerProfileId));
    if (isDm) {
      const rows = await inventoryGetLog({ playerProfileId });
      setLogRows(rows || []);
    }
  }, [isDm, joinCode, playerProfileId, role]);

  useEffect(() => {
    if (!open) return;
    loadAll();
  }, [loadAll, open, playerProfileId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await inventorySearchCatalog({ profileId: playerProfileId, role, query, joinCode });
      if (!cancelled) setCatalogResults(rows || []);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, playerProfileId, role, joinCode]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snapshot.items || [];
    return (snapshot.items || []).filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [snapshot.items, query]);

  async function saveCurrency(nextCurrency) {
    await inventorySetCurrency({
      playerProfileId,
      role,
      joinCode,
      pp: Number(nextCurrency.pp) || 0,
      gp: Number(nextCurrency.gp) || 0,
      sp: Number(nextCurrency.sp) || 0,
      cp: Number(nextCurrency.cp) || 0,
    });
    await loadAll();
  }

  async function saveItem({ itemMasterId = null, customName: nextCustom = null, quantity: nextQty = 1, notes: nextNotes = null, itemRowId = null }) {
    const normalized = normalizeInventoryItemPayload({ itemMasterId, customName: nextCustom, quantity: nextQty, notes: nextNotes });
    await inventoryUpsertItem({
      playerProfileId,
      role,
      joinCode,
      itemMasterId: normalized.itemMasterId,
      customName: normalized.customName,
      quantity: normalized.quantity,
      notes: normalized.notes,
      itemRowId,
    });
    setEditingItem(null);
    setCustomName('');
    setQuantity('1');
    setNotes('');
    await loadAll();
  }

  async function removeItem(itemRowId) {
    await inventoryRemoveItem({ playerProfileId, role, itemRowId, joinCode });
    await loadAll();
  }

  async function submitTransfer() {
    if (!transferPayload.receiver) return;
    if (transferPayload.kind === 'item' && !transferPayload.itemRowId) return;
    await inventoryCreateTransfer({
      senderProfileId: senderProfileId || playerProfileId,
      receiverProfileId: transferPayload.receiver,
      role,
      joinCode,
      itemRowId: transferPayload.kind === 'item' ? transferPayload.itemRowId : null,
      itemQuantity: transferPayload.kind === 'item' ? Number(transferPayload.quantity) || 1 : null,
      currencyType: transferPayload.kind === 'currency' ? transferPayload.currencyType : null,
      currencyAmount: transferPayload.kind === 'currency' ? Number(transferPayload.amount) || 1 : null,
    });
    setTransferOpen(false);
    setTransferPayload({ kind: 'item', itemRowId: null, quantity: 1, currencyType: 'gp', amount: 1, receiver: '' });
    await loadAll();
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 'min(760px, calc(100vw - 16px))', maxHeight: '88vh', overflow: 'auto' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 2 }}>{playerName || 'Inventory'}</div>
            <div className="modal-subtitle">{formatInventorySummary(snapshot.summary || {})}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {['pp', 'gp', 'sp', 'cp'].map((key) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{key}</span>
              <input
                className="form-input"
                type="number"
                min={0}
                value={snapshot.currency?.[key] ?? 0}
                disabled={!canEdit}
                onChange={(event) => setSnapshot((curr) => ({ ...curr, currency: { ...(curr.currency || {}), [key]: Math.max(0, parseInt(event.target.value || '0', 10) || 0) } }))}
                onBlur={() => canEdit && saveCurrency(snapshot.currency || {})}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="form-input" placeholder="Search inventory / catalog" value={query} onChange={(event) => setQuery(event.target.value)} />
          {canEdit && <button className="btn btn-ghost" onClick={() => setEditingItem({})}>Add Item</button>}
          {canEdit && <button className="btn btn-ghost" onClick={() => setTransferOpen((curr) => !curr)}>Transfer</button>}
          {isDm && <button className="btn btn-ghost" onClick={() => setShowLog((curr) => !curr)}>{showLog ? 'Hide Log' : 'Show Log'}</button>}
        </div>

        {editingItem !== null && (
          <div className="panel" style={{ marginTop: 8, padding: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input className="form-input" placeholder="Custom item name" value={customName} onChange={(event) => setCustomName(event.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 6 }}>
                <input className="form-input" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                <input className="form-input" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => saveItem({ itemRowId: editingItem.id || null, customName, quantity, notes })}>Save Custom</button>
                {catalogResults.slice(0, 5).map((row) => (
                  <button key={row.id} className="btn btn-ghost" onClick={() => saveItem({ itemMasterId: row.id, quantity, notes })}>{row.name}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {transferOpen && (
          <div className="panel" style={{ marginTop: 8, padding: 8 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <select className="form-input" value={transferPayload.kind} onChange={(event) => setTransferPayload((curr) => ({ ...curr, kind: event.target.value }))}>
                <option value="item">Item</option>
                <option value="currency">Currency</option>
              </select>
              <select className="form-input" value={transferPayload.receiver} onChange={(event) => setTransferPayload((curr) => ({ ...curr, receiver: event.target.value }))}>
                <option value="">Select receiver</option>
                {transferTargets.map((row) => <option key={row.profile_id} value={row.profile_id}>{row.name}</option>)}
              </select>
              {transferPayload.kind === 'item' ? (
                <>
                  <select className="form-input" value={transferPayload.itemRowId || ''} onChange={(event) => setTransferPayload((curr) => ({ ...curr, itemRowId: event.target.value }))}>
                    <option value="">Select item</option>
                    {(snapshot.items || []).map((item) => <option key={item.id} value={item.id}>{item.name} (x{item.quantity})</option>)}
                  </select>
                  <input className="form-input" type="number" min={1} value={transferPayload.quantity} onChange={(event) => setTransferPayload((curr) => ({ ...curr, quantity: event.target.value }))} />
                </>
              ) : (
                <>
                  <select className="form-input" value={transferPayload.currencyType} onChange={(event) => setTransferPayload((curr) => ({ ...curr, currencyType: event.target.value }))}>
                    <option value="pp">PP</option>
                    <option value="gp">GP</option>
                    <option value="sp">SP</option>
                    <option value="cp">CP</option>
                  </select>
                  <input className="form-input" type="number" min={1} value={transferPayload.amount} onChange={(event) => setTransferPayload((curr) => ({ ...curr, amount: event.target.value }))} />
                </>
              )}
              <button className="btn btn-primary" onClick={submitTransfer}>{isDm ? 'Send Instantly' : 'Send Request'}</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {filteredItems.length === 0 && <div className="empty-state" style={{ padding: 6 }}>No items yet.</div>}
          {filteredItems.map((item) => (
            <button key={item.id} className="manage-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => {
              setEditingItem(item);
              setCustomName(item.custom_name || item.name || '');
              setQuantity(String(item.quantity || 1));
              setNotes(item.notes || '');
            }}>
              <span>{item.name} • x{item.quantity}{item.notes ? ` • ${item.notes}` : ''}</span>
              {canEdit && <span style={{ display: 'flex', gap: 6 }}><button className="btn btn-ghost" onClick={(event) => { event.stopPropagation(); removeItem(item.id); }}>Remove</button></span>}
            </button>
          ))}
        </div>

        {isDm && showLog && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>Inventory Audit Log (DM)</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {logRows.length === 0 && <div className="empty-state" style={{ padding: 6 }}>No inventory log rows yet.</div>}
              {logRows.map((row) => (
                <div key={row.id} style={{ fontSize: 12, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px' }}>
                  <strong>{row.actor_name || row.actor_role}</strong> • {row.summary}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
