import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inventoryDmAwardCurrency, inventoryUpsertItem } from '../../inventory/inventoryClient';
import { getItemMechanicsSummary, resolveItemDetailText } from '../../utils/itemDetailText';

function RewardsItemPreviewModal({
  item,
  players,
  targetProfileId,
  quantity,
  notes,
  loading,
  onClose,
  onAssign,
  onTargetProfileChange,
  onQuantityChange,
  onNotesChange,
}) {
  if (!item) return null;
  const detail = resolveItemDetailText(item);
  const mechanicsSummary = getItemMechanicsSummary(item);

  return (
    <div className="world-shop-modal-backdrop" onClick={onClose}>
      <div className="world-shop-modal" onClick={(event) => event.stopPropagation()}>
        <div className="world-shop-modal-head">
          <strong>{item.name}</strong>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="world-shop-item-meta">
          <span>{item.item_type || 'Unknown Type'}</span>
          {item.category ? <span>• {item.category}</span> : null}
          {item.rarity ? <span>• {item.rarity}</span> : null}
        </div>
        {detail.mode === 'structured_fallback'
          ? <pre className="world-shop-item-description">{detail.text}</pre>
          : <p className="world-shop-item-description">{detail.text}</p>}
        {mechanicsSummary.length > 0 ? (
          <div className="item-mechanics-summary">
            <div className="item-mechanics-summary__title">Mechanics &amp; Stat Bonuses</div>
            <div className="item-mechanics-summary__rows">
              {mechanicsSummary.map((entry, index) => (
                <div key={`${entry.label}-${entry.value}-${index}`} className="item-mechanics-summary__row">
                  <span className="item-mechanics-summary__label">{entry.label}</span>
                  <span className="item-mechanics-summary__value">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="world-rewards-modal-assign-section">
          <div className="world-rewards-modal-assign-title">Assign Item</div>
          <select className="form-input" value={targetProfileId} onChange={(event) => onTargetProfileChange(event.target.value)}>
            <option value="">Select player</option>
            {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          <div className="world-rewards-modal-assign-grid">
            <input className="form-input" type="number" min={1} value={quantity} onChange={(event) => onQuantityChange(event.target.value)} />
            <input className="form-input" value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Optional notes" />
          </div>
          <button className="btn btn-primary" disabled={!targetProfileId || loading} onClick={() => onAssign(item)}>
            {loading ? 'Assigning…' : 'Assign Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorldRewardsPanel({ encounterId, playerStates = [], onInventoryChanged = null, onInventoryRefresh = null }) {
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [targetProfileId, setTargetProfileId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [currencyType, setCurrencyType] = useState('gp');
  const [currencyAmount, setCurrencyAmount] = useState(100);
  const [currencyTarget, setCurrencyTarget] = useState('single');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogOffset, setCatalogOffset] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const PAGE_SIZE = 60;

  const players = useMemo(() => {
    const map = new Map();
    (playerStates || []).forEach((row) => {
      const id = row.player_profile_id || row.profiles_players?.id;
      if (!id || map.has(id)) return;
      map.set(id, { id, name: row.profiles_players?.name || 'Player' });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [playerStates]);

  useEffect(() => {
    if (!targetProfileId && players.length > 0) {
      setTargetProfileId(players[0].id);
    }
  }, [players, targetProfileId]);

  useEffect(() => {
    setCatalogOffset(0);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('item_master')
        .select('id, name, item_type, category, rarity, description')
        .eq('rules_era', '2014')
        .ilike('name', `%${query.trim()}%`)
        .order('name')
        .range(catalogOffset, catalogOffset + PAGE_SIZE - 1);
      if (!cancelled) {
        if (error) {
          setStatus(`Item search failed: ${error.message || 'Unknown error'}`);
          return;
        }
        const rows = data || [];
        setCatalog((curr) => (catalogOffset === 0 ? rows : [...curr, ...rows]));
        setCatalogHasMore(rows.length === PAGE_SIZE);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [catalogOffset, query]);

  function getPlayerName(profileId) {
    const player = players.find((entry) => entry.id === profileId);
    return player?.name || 'Unknown player';
  }

  async function notifyInventoryRefresh() {
    if (typeof onInventoryChanged === 'function') await onInventoryChanged();
    if (typeof onInventoryRefresh === 'function') onInventoryRefresh();
  }

  async function handleAssignItem(item) {
    if (!item || !targetProfileId || loading) return;
    setLoading(true);
    setStatus('');
    try {
      await inventoryUpsertItem({
        playerProfileId: targetProfileId,
        role: 'dm',
        itemMasterId: item.id,
        quantity: Number(quantity) || 1,
        notes: notes || null,
      });
      const grantedQuantity = Number(quantity) || 1;
      const targetName = getPlayerName(targetProfileId);
      setStatus(`${targetName} received ${item.name} x${grantedQuantity}.`);
      await notifyInventoryRefresh();
      setPreviewItem(null);
      setQuantity(1);
      setNotes('');
    } catch (error) {
      setStatus(`Item grant failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAwardCurrency() {
    const amount = Number(currencyAmount) || 0;
    if (amount <= 0 || loading) return;

    setLoading(true);
    setStatus('');
    try {
      const rows = await inventoryDmAwardCurrency({
        encounterId,
        receiverProfileId: currencyTarget === 'single' ? targetProfileId : null,
        currencyType,
        amount,
        awardAll: currencyTarget === 'all',
        note: 'World rewards panel',
      });

      if (currencyTarget === 'all') {
        const rowCount = Array.isArray(rows) ? rows.length : 0;
        setStatus(`Awarded ${amount} ${currencyType.toUpperCase()} to all active players (${rowCount} recipients; equal split).`);
      } else {
        const targetName = getPlayerName(targetProfileId);
        setStatus(`${targetName} received ${amount} ${currencyType.toUpperCase()}.`);
      }
      await notifyInventoryRefresh();
    } catch (error) {
      setStatus(`Currency award failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="world-shops-shell">
      <div className="world-shops-layout">
        <div className="world-shops-saved-list">
          <div className="world-shops-panel-title">Rewards Catalog</div>
          <input className="form-input" placeholder="Search item catalog" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div style={{ display: 'grid', gap: 6, marginTop: 6, maxHeight: 360, overflow: 'auto' }}>
            {catalog.map((item) => (
              <button key={item.id} className="world-shops-saved-item" onClick={() => setPreviewItem(item)}>
                <strong>{item.name}</strong>
                <span>{item.item_type || 'Unknown'}{item.rarity ? ` • ${item.rarity}` : ''}</span>
              </button>
            ))}
            {catalog.length === 0 ? <div className="empty-state">No catalog matches your search.</div> : null}
          </div>
          {catalogHasMore ? (
            <button className="btn btn-ghost" type="button" onClick={() => setCatalogOffset((curr) => curr + PAGE_SIZE)}>
              Load More
            </button>
          ) : null}
        </div>

        <div className="world-shops-stock-panel">
          <div className="world-shops-panel-title">Currency Reward</div>
          <select className="form-input" value={currencyTarget} onChange={(event) => setCurrencyTarget(event.target.value)}>
            <option value="single">One player</option>
            <option value="all">All active players (equal split)</option>
          </select>
          {currencyTarget === 'single' ? (
            <select className="form-input" value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)}>
              <option value="">Select player</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: '98px 1fr', gap: 6 }}>
            <select className="form-input" value={currencyType} onChange={(event) => setCurrencyType(event.target.value)}>
              <option value="gp">GP</option>
              <option value="pp">PP</option>
              <option value="sp">SP</option>
              <option value="cp">CP</option>
            </select>
            <input className="form-input" type="number" min={1} value={currencyAmount} onChange={(event) => setCurrencyAmount(event.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleAwardCurrency} disabled={loading || (currencyTarget === 'single' && !targetProfileId)}>Award Currency</button>
        </div>
      </div>
      {status ? <div className="world-shops-import-status">{status}</div> : null}
      <RewardsItemPreviewModal
        item={previewItem}
        players={players}
        targetProfileId={targetProfileId}
        quantity={quantity}
        notes={notes}
        loading={loading}
        onClose={() => setPreviewItem(null)}
        onAssign={handleAssignItem}
        onTargetProfileChange={setTargetProfileId}
        onQuantityChange={setQuantity}
        onNotesChange={setNotes}
      />
    </div>
  );
}
