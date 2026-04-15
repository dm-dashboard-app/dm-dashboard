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
import { formatInventorySummary, isClearlyUsableInventoryItem, normalizeInventoryItemPayload } from '../utils/inventoryUtils';
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

const DEFAULT_REMOVE_STATE = {
  quantity: 1,
  loading: false,
  status: '',
  error: '',
};

const CURRENCY_KEYS = ['pp', 'gp', 'sp', 'cp'];

const CURRENCY_STYLE_MAP = {
  pp: { label: 'PP', color: '#d6e4f0', border: 'rgba(214, 228, 240, 0.35)' },
  gp: { label: 'GP', color: '#f2d48a', border: 'rgba(242, 212, 138, 0.45)' },
  sp: { label: 'SP', color: '#d2d7e0', border: 'rgba(210, 215, 224, 0.42)' },
  cp: { label: 'CP', color: '#d9a58a', border: 'rgba(217, 165, 138, 0.45)' },
};

export default function InventoryModal({
  open,
  onClose,
  role,
  playerProfileId,
  playerName,
  joinCode = null,
  senderProfileId = null,
  inventoryRefreshTick = 0,
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
  const [snapshotLoadError, setSnapshotLoadError] = useState('');
  const [removeItemState, setRemoveItemState] = useState(DEFAULT_REMOVE_STATE);

  const loadAll = useCallback(async () => {
    if (!playerProfileId) return;
    setSnapshotLoadError('');

    let nextSnapshot = null;
    try {
      nextSnapshot = await inventoryGetSnapshot({ playerProfileId, role, joinCode });
    } catch (error) {
      setSnapshotLoadError(error?.message || 'Unable to load inventory right now.');
      return;
    }

    if (!nextSnapshot) {
      setSnapshotLoadError('Inventory snapshot is unavailable right now.');
      return;
    }

    setSnapshot(nextSnapshot);

    try {
      const targets = await inventoryGetTransferTargets({ playerProfileId, role, joinCode });
      setTransferTargets((targets || []).filter((row) => row.profile_id !== playerProfileId));
    } catch (error) {
      // Keep valid snapshot visible even if transfer targets fail.
    }

    if (isDm) {
      try {
        const rows = await inventoryGetLog({ playerProfileId });
        setLogRows(rows || []);
      } catch (error) {
        // Keep valid snapshot visible even if DM log fails.
      }
    }
  }, [isDm, joinCode, playerProfileId, role]);

  useEffect(() => {
    if (!open) return;
    loadAll();
  }, [loadAll, open, inventoryRefreshTick]);

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

  async function removeItem(itemRowId, quantity, reason = 'remove') {
    if (!itemRowId) return;
    try {
      setRemoveItemState((curr) => ({ ...curr, loading: true, error: '', status: '' }));
      await inventoryRemoveItem({ playerProfileId, role, itemRowId, quantity, reason, joinCode });
      setSelectedItem(null);
      await loadAll();
    } catch (error) {
      setRemoveItemState((curr) => ({ ...curr, error: error?.message || 'Unable to update inventory item right now.' }));
    } finally {
      setRemoveItemState((curr) => ({ ...curr, loading: false }));
    }
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
  const selectedItemQuantity = Math.max(1, parseInt(selectedItem?.quantity || 1, 10) || 1);
  const removeQuantity = Math.max(1, Math.min(selectedItemQuantity, parseInt(removeItemState.quantity || 1, 10) || 1));
  const canUseOne = isClearlyUsableInventoryItem({ inventoryItem: selectedItem, catalogItem: selectedItemCatalog });

  useEffect(() => {
    if (!selectedItem) return;
    setRemoveItemState(DEFAULT_REMOVE_STATE);
  }, [selectedItem]);

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

        {snapshotLoadError ? (
          <div
            className="panel"
            style={{
              marginBottom: 8,
              borderColor: 'rgba(255, 120, 120, 0.45)',
              background: 'rgba(120, 20, 20, 0.18)',
              padding: 8,
              fontSize: 13,
            }}
          >
            Inventory load error: {snapshotLoadError}
          </div>
        ) : null}

        <div className="panel" style={{ padding: 8 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Currency</div>
          {isPlayer ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {CURRENCY_KEYS.map((key) => {
                  const tone = CURRENCY_STYLE_MAP[key];
                  return (
                    <div
                      key={key}
                      style={{
                        border: `1px solid ${tone.border}`,
                        borderRadius: 10,
                        padding: '8px 6px',
                        minHeight: 54,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(255, 255, 255, 0.02)',
                      }}
                    >
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.35, color: 'var(--text-muted)' }}>{tone.label}</div>
                      <div style={{ fontSize: 18, lineHeight: 1.15, fontWeight: 800, color: tone.color }}>{snapshot.currency?.[key] ?? 0}</div>
                    </div>
                  );
                })}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setTransferOpen((curr) => !curr)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 40,
                  fontWeight: 700,
                }}
              >
                {transferOpen ? 'Close Currency Transfer' : 'Transfer Currency'}
              </button>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {CURRENCY_KEYS.map((key) => (
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
              <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 6 }}>
                {canUseOne ? (
                  <button
                    className="btn btn-primary"
                    disabled={removeItemState.loading}
                    onClick={() => removeItem(selectedItem.id, 1, 'use_one')}
                  >
                    {removeItemState.loading ? 'Using…' : 'Use 1'}
                  </button>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={selectedItemQuantity}
                    disabled={removeItemState.loading}
                    value={removeQuantity}
                    onChange={(event) => setRemoveItemState((curr) => ({ ...curr, quantity: event.target.value }))}
                  />
                  <button
                    className="btn btn-ghost"
                    disabled={removeItemState.loading}
                    onClick={() => removeItem(selectedItem.id, removeQuantity, 'remove')}
                  >
                    {removeItemState.loading ? 'Applying…' : removeQuantity >= selectedItemQuantity ? 'Remove Item' : `Remove ${removeQuantity}`}
                  </button>
                </div>
                {removeItemState.error ? <div style={{ fontSize: 12, color: 'var(--danger, #ff8b8b)' }}>{removeItemState.error}</div> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
