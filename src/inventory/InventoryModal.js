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

const EMPTY_CURRENCY_TRANSFER = {
  receiver: '',
  currencyType: 'gp',
  amount: 1,
};

const EMPTY_ITEM_TRANSFER = {
  receiver: '',
  quantity: 1,
};

function asInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

  const [currencyTransferOpen, setCurrencyTransferOpen] = useState(false);
  const [currencyTransferPayload, setCurrencyTransferPayload] = useState(EMPTY_CURRENCY_TRANSFER);
  const [itemTransferOpen, setItemTransferOpen] = useState(false);
  const [itemTransferPayload, setItemTransferPayload] = useState(EMPTY_ITEM_TRANSFER);

  const [transferTargets, setTransferTargets] = useState([]);
  const [dmGrant, setDmGrant] = useState({ itemMasterId: '', quantity: 1, notes: '' });
  const [logRows, setLogRows] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [status, setStatus] = useState('');

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

  useEffect(() => {
    if (!currencyTransferOpen) {
      setCurrencyTransferPayload(EMPTY_CURRENCY_TRANSFER);
      return;
    }
    setCurrencyTransferPayload((curr) => ({
      ...curr,
      receiver: curr.receiver || transferTargets[0]?.profile_id || '',
    }));
  }, [currencyTransferOpen, transferTargets]);

  useEffect(() => {
    if (!itemTransferOpen) {
      setItemTransferPayload(EMPTY_ITEM_TRANSFER);
      return;
    }
    setItemTransferPayload((curr) => ({
      ...curr,
      receiver: curr.receiver || transferTargets[0]?.profile_id || '',
      quantity: Math.max(1, Math.min(selectedItem?.quantity || 1, asInt(curr.quantity, 1))),
    }));
  }, [itemTransferOpen, transferTargets, selectedItem?.quantity]);

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
    setStatus('Item granted.');
    await loadAll();
  }

  async function removeItem(itemRowId) {
    await inventoryRemoveItem({ playerProfileId, role, itemRowId, joinCode });
    setSelectedItem(null);
    await loadAll();
  }

  async function submitCurrencyTransfer() {
    if (!currencyTransferPayload.receiver) return;

    await inventoryCreateTransfer({
      senderProfileId: senderProfileId || playerProfileId,
      receiverProfileId: currencyTransferPayload.receiver,
      role,
      joinCode,
      currencyType: currencyTransferPayload.currencyType,
      currencyAmount: Math.max(1, asInt(currencyTransferPayload.amount, 1)),
      itemRowId: null,
      itemQuantity: null,
    });

    setCurrencyTransferOpen(false);
    setStatus(isDm ? 'Currency transferred.' : 'Currency transfer request sent.');
    await loadAll();
  }

  async function submitItemTransfer() {
    if (!selectedItem?.id || !itemTransferPayload.receiver) return;

    await inventoryCreateTransfer({
      senderProfileId: senderProfileId || playerProfileId,
      receiverProfileId: itemTransferPayload.receiver,
      role,
      joinCode,
      itemRowId: selectedItem.id,
      itemQuantity: Math.max(1, Math.min(selectedItem.quantity || 1, asInt(itemTransferPayload.quantity, 1))),
      currencyType: null,
      currencyAmount: null,
    });

    setItemTransferOpen(false);
    setSelectedItem(null);
    setStatus(isDm ? 'Item transferred instantly.' : 'Item transfer request sent.');
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
          minHeight: '56vh',
          maxHeight: '92vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
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

          {isDm ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {['pp', 'gp', 'sp', 'cp'].map((key) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{key}</span>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={snapshot.currency?.[key] ?? 0}
                    onChange={(event) => setSnapshot((curr) => ({ ...curr, currency: { ...(curr.currency || {}), [key]: Math.max(0, asInt(event.target.value, 0)) } }))}
                    onBlur={() => saveCurrency(snapshot.currency || {})}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--bg-panel-2)',
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              PP - {snapshot.currency?.pp ?? 0} &nbsp; GP - {snapshot.currency?.gp ?? 0} &nbsp; SP - {snapshot.currency?.sp ?? 0} &nbsp; CP - {snapshot.currency?.cp ?? 0}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-ghost"
              style={{ width: 'min(180px, 100%)', minHeight: 36 }}
              onClick={() => setCurrencyTransferOpen((curr) => !curr)}
            >
              {currencyTransferOpen ? 'Close Transfer' : 'Transfer'}
            </button>
          </div>
        </div>

        {currencyTransferOpen && (
          <div className="panel" style={{ marginTop: 2, padding: 8 }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>Currency Transfer</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <select className="form-input" value={currencyTransferPayload.receiver} onChange={(event) => setCurrencyTransferPayload((curr) => ({ ...curr, receiver: event.target.value }))}>
                <option value="">Select receiver</option>
                {transferTargets.map((row) => <option key={row.profile_id} value={row.profile_id}>{row.name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 6 }}>
                <select className="form-input" value={currencyTransferPayload.currencyType} onChange={(event) => setCurrencyTransferPayload((curr) => ({ ...curr, currencyType: event.target.value }))}>
                  <option value="pp">PP</option>
                  <option value="gp">GP</option>
                  <option value="sp">SP</option>
                  <option value="cp">CP</option>
                </select>
                <input className="form-input" type="number" min={1} value={currencyTransferPayload.amount} onChange={(event) => setCurrencyTransferPayload((curr) => ({ ...curr, amount: event.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={submitCurrencyTransfer}>{isDm ? 'Send Instantly' : 'Send Request'}</button>
              {isPlayer ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Receiver confirmation is required for player-initiated transfers.</div> : null}
            </div>
          </div>
        )}

        <div className="panel" style={{ padding: 8, marginTop: 2 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Items</div>
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
          <div className="panel" style={{ marginTop: 2, padding: 8 }}>
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
          <div style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
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

        {status ? <div className="world-shops-import-status">{status}</div> : null}

        {selectedItem && (
          <div className="world-shop-modal-backdrop" onClick={() => { setSelectedItem(null); setItemTransferOpen(false); }}>
            <div className="world-shop-modal" onClick={(event) => event.stopPropagation()}>
              <div className="world-shop-modal-head">
                <strong>{selectedItemCatalog?.name || selectedItem.name}</strong>
                <button className="btn btn-ghost" onClick={() => { setSelectedItem(null); setItemTransferOpen(false); }}>Close</button>
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

              {itemTransferOpen ? (
                <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                  <select className="form-input" value={itemTransferPayload.receiver} onChange={(event) => setItemTransferPayload((curr) => ({ ...curr, receiver: event.target.value }))}>
                    <option value="">Select receiver</option>
                    {transferTargets.map((row) => <option key={row.profile_id} value={row.profile_id}>{row.name}</option>)}
                  </select>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={Math.max(1, selectedItem.quantity || 1)}
                    value={itemTransferPayload.quantity}
                    onChange={(event) => setItemTransferPayload((curr) => ({ ...curr, quantity: event.target.value }))}
                  />
                  <button className="btn btn-primary" onClick={submitItemTransfer}>{isDm ? 'Send Instantly' : 'Send Request'}</button>
                  {isPlayer ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Receiver confirmation is required for player-initiated transfers.</div> : null}
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setItemTransferOpen((curr) => !curr)}>
                  {itemTransferOpen ? 'Cancel Transfer' : 'Transfer'}
                </button>
                {isDm ? <button className="btn btn-ghost" onClick={() => removeItem(selectedItem.id)}>Remove Item</button> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
