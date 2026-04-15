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

const EMPTY_SNAPSHOT = {
  items: [],
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  summary: { total_item_quantity: 0, gp: 0 },
};

export default function InventoryModal({
  open,
  onClose,
  role,
  playerProfileId,
  playerName,
  joinCode = null,
  senderProfileId = null,
}) {
  const isDm = role === 'dm';
  const isPlayer = role === 'player';
  const canManageItems = isDm;

  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [itemFilter, setItemFilter] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargets, setTransferTargets] = useState([]);
  const [transferPayload, setTransferPayload] = useState({
    kind: 'item',
    itemRowId: '',
    quantity: 1,
    currencyType: 'gp',
    amount: 1,
    receiver: '',
  });
  const [dmGrant, setDmGrant] = useState({ itemMasterId: '', quantity: 1, notes: '' });
  const [logRows, setLogRows] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const loadAll = useCallback(async () => {
    if (!playerProfileId) return;
    const [nextSnapshot, targets] = await Promise.all([
      inventoryGetSnapshot({ playerProfileId, role, joinCode }),
      inventoryGetTransferTargets({ playerProfileId, role, joinCode }),
    ]);
    setSnapshot(nextSnapshot || EMPTY_SNAPSHOT);
    setTransferTargets((targets || []).filter((row) => row.profile_id !== playerProfileId));

    if (isDm) {
      const rows = await inventoryGetLog({ playerProfileId });
      setLogRows(rows || []);
    }
  }, [isDm, joinCode, playerProfileId, role]);

  useEffect(() => {
    if (!open) return;
    loadAll();
  }, [loadAll, open]);

  useEffect(() => {
    if (!open || !canManageItems) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await inventorySearchCatalog({ profileId: playerProfileId, role, query: catalogQuery, joinCode });
      if (!cancelled) setCatalogResults(rows || []);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, canManageItems, catalogQuery, playerProfileId, role, joinCode]);

  const filteredItems = useMemo(() => {
    const q = itemFilter.trim().toLowerCase();
    if (!q) return snapshot.items || [];
    return (snapshot.items || []).filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [snapshot.items, itemFilter]);

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

  async function saveDmGrant() {
    const normalized = normalizeInventoryItemPayload({
      itemMasterId: dmGrant.itemMasterId || null,
      customName: null,
      quantity: dmGrant.quantity,
      notes: dmGrant.notes,
    });

    await inventoryUpsertItem({
      playerProfileId,
      role,
      joinCode,
      itemMasterId: normalized.itemMasterId,
      customName: null,
      quantity: normalized.quantity,
      notes: normalized.notes,
      itemRowId: null,
    });

    setDmGrant({ itemMasterId: '', quantity: 1, notes: '' });
    await loadAll();
  }

  async function removeItem(itemRowId) {
    await inventoryRemoveItem({ playerProfileId, role, itemRowId, joinCode });
    setSelectedItem(null);
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
    setTransferPayload({ kind: 'item', itemRowId: '', quantity: 1, currencyType: 'gp', amount: 1, receiver: '' });
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

        <div className="panel" style={{ padding: 8 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Currency</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            {['pp', 'gp', 'sp', 'cp'].map((key) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{key}</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  disabled={!isDm}
                  value={snapshot.currency?.[key] ?? 0}
                  onChange={(event) => setSnapshot((curr) => ({ ...curr, currency: { ...(curr.currency || {}), [key]: Math.max(0, parseInt(event.target.value || '0', 10) || 0) } }))}
                  onBlur={() => isDm && saveCurrency(snapshot.currency || {})}
                />
              </label>
            ))}
          </div>
          {isPlayer ? <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>Players can transfer currency, but only the DM can directly edit totals.</div> : null}
        </div>

        <div className="panel" style={{ padding: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="panel-title">Items</div>
            <button className="btn btn-ghost" onClick={() => setTransferOpen((curr) => !curr)}>{transferOpen ? 'Close Transfer' : 'Transfer'}</button>
          </div>
          <input className="form-input" placeholder="Search items" value={itemFilter} onChange={(event) => setItemFilter(event.target.value)} />
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {filteredItems.length === 0 ? <div className="empty-state" style={{ padding: 8 }}>No items yet.</div> : null}
            {filteredItems.map((item) => (
              <button key={item.id} className="world-shops-saved-item" style={{ textAlign: 'left' }} onClick={() => setSelectedItem(item)}>
                <strong>{item.name}</strong>
                <span>Quantity: {item.quantity}</span>
                {item.notes ? <span>{item.notes}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {transferOpen && (
          <div className="panel" style={{ marginTop: 8, padding: 8 }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>Transfer</div>
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
                  <select className="form-input" value={transferPayload.itemRowId} onChange={(event) => setTransferPayload((curr) => ({ ...curr, itemRowId: event.target.value }))}>
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
              {isPlayer ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Receiver confirmation is required for player-initiated transfers.</div> : null}
            </div>
          </div>
        )}

        {isDm && (
          <div className="panel" style={{ marginTop: 8, padding: 8 }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>DM Item Grant</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <input className="form-input" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search item catalog" />
              <select className="form-input" value={dmGrant.itemMasterId} onChange={(event) => setDmGrant((curr) => ({ ...curr, itemMasterId: event.target.value }))}>
                <option value="">Select catalog item</option>
                {catalogResults.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 6 }}>
                <input className="form-input" type="number" min={1} value={dmGrant.quantity} onChange={(event) => setDmGrant((curr) => ({ ...curr, quantity: event.target.value }))} />
                <input className="form-input" value={dmGrant.notes} onChange={(event) => setDmGrant((curr) => ({ ...curr, notes: event.target.value }))} placeholder="Optional notes" />
              </div>
              <button className="btn btn-primary" disabled={!dmGrant.itemMasterId} onClick={saveDmGrant}>Grant Item</button>
            </div>
          </div>
        )}

        {isDm && (
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowLog((curr) => !curr)}>{showLog ? 'Hide DM Log' : 'Show DM Log'}</button>
            {showLog ? (
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {logRows.length === 0 ? <div className="empty-state" style={{ padding: 6 }}>No inventory log rows yet.</div> : null}
                {logRows.map((row) => (
                  <div key={row.id} style={{ fontSize: 12, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px' }}>
                    <strong>{row.actor_name || row.actor_role}</strong> • {row.summary}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {selectedItem && (
          <div className="world-shop-modal-backdrop" onClick={() => setSelectedItem(null)}>
            <div className="world-shop-modal" onClick={(event) => event.stopPropagation()}>
              <div className="world-shop-modal-head">
                <strong>{selectedItem.name}</strong>
                <button className="btn btn-ghost" onClick={() => setSelectedItem(null)}>Close</button>
              </div>
              <div className="world-shop-item-meta">
                <span>Quantity: {selectedItem.quantity}</span>
                {selectedItem.updated_at ? <span>Updated: {new Date(selectedItem.updated_at).toLocaleString()}</span> : null}
              </div>
              <p className="world-shop-item-description">{selectedItem.notes || 'No notes on this item.'}</p>
              {isDm ? <button className="btn btn-ghost" onClick={() => removeItem(selectedItem.id)}>Remove Item</button> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
