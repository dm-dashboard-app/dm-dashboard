import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
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
import { compactItemMeta, resolveItemDetailText } from '../utils/itemDetailText';

const EMPTY_SNAPSHOT = {
  items: [],
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  summary: { total_item_quantity: 0, gp: 0 },
};

const DEFAULT_CURRENCY_TRANSFER = {
  currencyType: 'gp',
  amount: 1,
  receiver: '',
};

const DEFAULT_ITEM_TRANSFER = {
  quantity: 1,
  receiver: '',
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
  const [selectedItemCatalog, setSelectedItemCatalog] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargets, setTransferTargets] = useState([]);
  const [currencyTransfer, setCurrencyTransfer] = useState(DEFAULT_CURRENCY_TRANSFER);
  const [selectedItemTransferOpen, setSelectedItemTransferOpen] = useState(false);
  const [selectedItemTransfer, setSelectedItemTransfer] = useState(DEFAULT_ITEM_TRANSFER);
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

  async function submitCurrencyTransfer() {
    if (!currencyTransfer.receiver) return;

    await inventoryCreateTransfer({
      senderProfileId: senderProfileId || playerProfileId,
      receiverProfileId: currencyTransfer.receiver,
      role,
      joinCode,
      itemRowId: null,
      itemQuantity: null,
      currencyType: currencyTransfer.currencyType,
      currencyAmount: Number(currencyTransfer.amount) || 1,
    });

    setTransferOpen(false);
    setCurrencyTransfer(DEFAULT_CURRENCY_TRANSFER);
    await loadAll();
  }

  async function submitSelectedItemTransfer() {
    if (!selectedItem?.id || !selectedItemTransfer.receiver) return;

    await inventoryCreateTransfer({
      senderProfileId: senderProfileId || playerProfileId,
      receiverProfileId: selectedItemTransfer.receiver,
      role,
      joinCode,
      itemRowId: selectedItem.id,
      itemQuantity: Number(selectedItemTransfer.quantity) || 1,
      currencyType: null,
      currencyAmount: null,
    });

    setSelectedItemTransferOpen(false);
    setSelectedItemTransfer(DEFAULT_ITEM_TRANSFER);
    setSelectedItem(null);
    await loadAll();
  }

  useEffect(() => {
    let active = true;
    async function loadSelectedCatalog() {
      if (!selectedItem?.item_master_id) {
        setSelectedItemCatalog(null);
        return;
      }
      const { data, error } = await supabase
        .from('item_master')
        .select('id, name, item_type, category, subcategory, rarity, description, metadata_json')
        .eq('id', selectedItem.item_master_id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setSelectedItemCatalog(null);
        return;
      }
      setSelectedItemCatalog(data || null);
    }
    loadSelectedCatalog();
    return () => {
      active = false;
    };
  }, [selectedItem?.id, selectedItem?.item_master_id]);

  const selectedItemDetail = selectedItemCatalog ? resolveItemDetailText(selectedItemCatalog) : null;

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{
          width: 'min(760px, calc(100vw - 16px))',
          maxHeight: '92vh',
          minHeight: '56vh',
          overflow: 'auto',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 2 }}>{playerName || 'Inventory'}</div>
            <div className="modal-subtitle">{formatInventorySummary(snapshot.summary || {})}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="panel" style={{ padding: 8 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Currency</div>
          {isPlayer ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                PP - {snapshot.currency?.pp ?? 0} GP - {snapshot.currency?.gp ?? 0} SP - {snapshot.currency?.sp ?? 0} CP - {snapshot.currency?.cp ?? 0}
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setTransferOpen((curr) => !curr)}
                style={{ width: 'calc((100% - 18px) / 4)', minWidth: 92 }}
              >
                {transferOpen ? 'Close Transfer' : 'Transfer'}
              </button>
            </>
          ) : (
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
          )}
        </div>

        {transferOpen && (
          <div className="panel" style={{ marginTop: 8, padding: 8 }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>Currency Transfer</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <select className="form-input" value={currencyTransfer.receiver} onChange={(event) => setCurrencyTransfer((curr) => ({ ...curr, receiver: event.target.value }))}>
                <option value="">Select receiver</option>
                {transferTargets.map((row) => <option key={row.profile_id} value={row.profile_id}>{row.name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '98px 1fr', gap: 6 }}>
                <select className="form-input" value={currencyTransfer.currencyType} onChange={(event) => setCurrencyTransfer((curr) => ({ ...curr, currencyType: event.target.value }))}>
                  <option value="pp">PP</option>
                  <option value="gp">GP</option>
                  <option value="sp">SP</option>
                  <option value="cp">CP</option>
                </select>
                <input className="form-input" type="number" min={1} value={currencyTransfer.amount} onChange={(event) => setCurrencyTransfer((curr) => ({ ...curr, amount: event.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={submitCurrencyTransfer}>{isDm ? 'Send Instantly' : 'Send Request'}</button>
              {isPlayer ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Receiver confirmation is required for player-initiated transfers.</div> : null}
            </div>
          </div>
        )}

        <div className="panel" style={{ padding: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="panel-title">Items</div>
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
                <strong>{selectedItemCatalog?.name || selectedItem.name}</strong>
                <button className="btn btn-ghost" onClick={() => setSelectedItem(null)}>Close</button>
              </div>
              <div className="world-shop-item-meta">
                {compactItemMeta(selectedItemCatalog || {}).length > 0 ? (
                  compactItemMeta(selectedItemCatalog || {}).map((entry) => <span key={entry}>{entry}</span>)
                ) : (
                  <span>Custom item</span>
                )}
                <span>• Quantity: {selectedItem.quantity}</span>
                {selectedItem.updated_at ? <span>• Updated: {new Date(selectedItem.updated_at).toLocaleString()}</span> : null}
              </div>
              {selectedItemCatalog ? (
                selectedItemDetail?.mode === 'structured_fallback' ? (
                  <pre className="world-shop-item-description">{selectedItemDetail?.text}</pre>
                ) : (
                  <p className="world-shop-item-description">{selectedItemDetail?.text}</p>
                )
              ) : (
                <p className="world-shop-item-description">{selectedItem.notes || 'No additional details available for this custom item.'}</p>
              )}
              {selectedItem.notes && selectedItemCatalog ? <p className="world-shop-item-description" style={{ opacity: 0.9 }}>Inventory notes: {selectedItem.notes}</p> : null}

              <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 6 }}>
                <button className="btn btn-primary" onClick={() => setSelectedItemTransferOpen((curr) => !curr)}>
                  {selectedItemTransferOpen ? 'Cancel Transfer' : 'Transfer Item'}
                </button>
                {selectedItemTransferOpen ? (
                  <>
                    <select className="form-input" value={selectedItemTransfer.receiver} onChange={(event) => setSelectedItemTransfer((curr) => ({ ...curr, receiver: event.target.value }))}>
                      <option value="">Select receiver</option>
                      {transferTargets.map((row) => <option key={row.profile_id} value={row.profile_id}>{row.name}</option>)}
                    </select>
                    <input className="form-input" type="number" min={1} max={Math.max(1, Number(selectedItem.quantity) || 1)} value={selectedItemTransfer.quantity} onChange={(event) => setSelectedItemTransfer((curr) => ({ ...curr, quantity: event.target.value }))} />
                    <button className="btn btn-primary" onClick={submitSelectedItemTransfer}>{isDm ? 'Send Instantly' : 'Send Request'}</button>
                    {isPlayer ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Receiver confirmation is required for player-initiated transfers.</div> : null}
                  </>
                ) : null}
              </div>

              {isDm ? <button className="btn btn-ghost" onClick={() => removeItem(selectedItem.id)}>Remove Item</button> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
