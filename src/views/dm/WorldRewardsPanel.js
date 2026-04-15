import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { inventoryDmAwardCurrency, inventoryUpsertItem } from '../../inventory/inventoryClient';

export default function WorldRewardsPanel({ encounterId, playerStates = [], onInventoryChanged = null }) {
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [targetProfileId, setTargetProfileId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [currencyType, setCurrencyType] = useState('gp');
  const [currencyAmount, setCurrencyAmount] = useState(100);
  const [currencyTarget, setCurrencyTarget] = useState('single');
  const [status, setStatus] = useState('');

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
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('item_master')
        .select('id, name, item_type, category, rarity, description')
        .eq('rules_era', '2014')
        .ilike('name', `%${query.trim()}%`)
        .order('name')
        .limit(40);
      if (!cancelled && !error) {
        setCatalog(data || []);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleAssignItem() {
    if (!selectedItem || !targetProfileId) return;
    await inventoryUpsertItem({
      playerProfileId: targetProfileId,
      role: 'dm',
      itemMasterId: selectedItem.id,
      quantity: Number(quantity) || 1,
      notes: notes || null,
    });
    setStatus(`Assigned ${selectedItem.name} x${Number(quantity) || 1}.`);
    if (typeof onInventoryChanged === 'function') onInventoryChanged();
  }

  async function handleAwardCurrency() {
    const amount = Number(currencyAmount) || 0;
    if (amount <= 0) return;

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
      setStatus(`Awarded ${amount} ${currencyType.toUpperCase()} split across ${rowCount} active players.`);
    } else {
      setStatus(`Awarded ${amount} ${currencyType.toUpperCase()} to selected player.`);
    }
    if (typeof onInventoryChanged === 'function') onInventoryChanged();
  }

  return (
    <div className="world-shops-shell">
      <div className="world-shops-layout">
        <div className="world-shops-saved-list">
          <div className="world-shops-panel-title">Rewards Catalog</div>
          <input className="form-input" placeholder="Search item catalog" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div style={{ display: 'grid', gap: 6, marginTop: 6, maxHeight: 360, overflow: 'auto' }}>
            {catalog.map((item) => (
              <button key={item.id} className="world-shops-saved-item" data-active={selectedItem?.id === item.id} onClick={() => setSelectedItem(item)}>
                <strong>{item.name}</strong>
                <span>{item.item_type || 'Unknown'}{item.rarity ? ` • ${item.rarity}` : ''}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="world-shops-stock-panel">
          <div className="world-shops-panel-title">Assign Item</div>
          {selectedItem ? (
            <>
              <button className="world-shops-saved-item" style={{ textAlign: 'left' }} onClick={() => setSelectedItem(selectedItem)}>
                <strong>{selectedItem.name}</strong>
                <span>{selectedItem.category || selectedItem.item_type || 'Unknown category'}{selectedItem.rarity ? ` • ${selectedItem.rarity}` : ''}</span>
                <span>{selectedItem.description?.slice(0, 160) || 'No description available.'}</span>
              </button>
              <select className="form-input" value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)}>
                <option value="">Select player</option>
                {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 6 }}>
                <input className="form-input" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                <input className="form-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />
              </div>
              <button className="btn btn-primary" disabled={!targetProfileId} onClick={handleAssignItem}>Assign Item</button>
            </>
          ) : (
            <div className="empty-state">Search and pick an item to assign.</div>
          )}

          <div className="world-shops-panel-title" style={{ marginTop: 8 }}>Currency Reward</div>
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
          <button className="btn btn-primary" onClick={handleAwardCurrency} disabled={currencyTarget === 'single' && !targetProfileId}>Award Currency</button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remainder policy: extra currency is distributed one-by-one in ascending player-profile UUID order.</div>
        </div>
      </div>
      {status ? <div className="world-shops-import-status">{status}</div> : null}
    </div>
  );
}
