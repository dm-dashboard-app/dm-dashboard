import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  inventoryAttuneItem,
  inventoryGetSnapshot,
  inventoryRechargeItem,
  inventoryUnattuneItem,
} from '../inventory/inventoryClient';
import { getItemMaxCharges, itemRequiresAttunement } from '../utils/itemEffects';
import { buildLongRestRechargePlan, normalizeLongRestAttunedIds } from '../utils/longRestItemsWorkflow';

export default function PlayerLongRestItemsSection({ state, joinCode, onApplied }) {
  const profileId = state?.player_profile_id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [selectedAttunedIds, setSelectedAttunedIds] = useState([]);
  const [rechargeDraft, setRechargeDraft] = useState({});

  const loadSnapshot = useCallback(async () => {
    if (!profileId) return;
    setError('');
    setLoading(true);
    try {
      const snapshot = await inventoryGetSnapshot({
        playerProfileId: profileId,
        role: 'player',
        joinCode,
      });
      const nextItems = snapshot?.items || [];
      setItems(nextItems);
      setSelectedAttunedIds(nextItems.filter((row) => row.attuned).map((row) => row.id));
      const nextRecharge = {};
      nextItems.forEach((row) => {
        if (getItemMaxCharges(row) > 0) nextRecharge[row.id] = 0;
      });
      setRechargeDraft(nextRecharge);
    } catch (loadError) {
      setItems([]);
      setSelectedAttunedIds([]);
      setRechargeDraft({});
      setError(loadError?.message || 'Unable to load long-rest item prep right now.');
    } finally {
      setLoading(false);
    }
  }, [joinCode, profileId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const attunableItems = useMemo(() => items.filter((row) => itemRequiresAttunement(row)), [items]);
  const rechargeableItems = useMemo(() => items.filter((row) => getItemMaxCharges(row) > 0), [items]);
  const normalizedSelectedIds = useMemo(() => normalizeLongRestAttunedIds(selectedAttunedIds, 3), [selectedAttunedIds]);

  async function applyItemChanges() {
    if (!profileId || loading) return;
    setLoading(true);
    setError('');
    try {
      const selectedSet = new Set(normalizedSelectedIds);
      for (const row of attunableItems) {
        const shouldAttune = selectedSet.has(row.id);
        if (shouldAttune && !row.attuned) {
          await inventoryAttuneItem({ playerProfileId: profileId, role: 'player', joinCode, itemRowId: row.id, restContext: true });
        }
        if (!shouldAttune && row.attuned) {
          await inventoryUnattuneItem({ playerProfileId: profileId, role: 'player', joinCode, itemRowId: row.id });
        }
      }

      const rechargePlan = buildLongRestRechargePlan({ rechargeDraft, items: rechargeableItems });
      for (const row of rechargePlan) {
        await inventoryRechargeItem({
          playerProfileId: profileId,
          role: 'player',
          joinCode,
          itemRowId: row.itemRowId,
          restoredCharges: row.restoredCharges,
        });
      }

      await loadSnapshot();
      await onApplied?.();
    } catch (applyError) {
      setError(applyError?.message || 'Unable to apply long-rest item changes right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Item Attunement & Recharge</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Keep attuned items at or below 3 and enter any long-rest charge restoration here before marking ready.
      </div>

      {loading ? <div className="rest-modal-player-meta">Loading item prep…</div> : null}
      {error ? <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>{error}</div> : null}

      <div style={{ display: 'grid', gap: 4 }}>
        <div className="rest-modal-label">Attunement (max 3)</div>
        {attunableItems.length === 0 ? (
          <div className="rest-modal-player-meta">No attunement-eligible items in your inventory.</div>
        ) : (
          <>
            {attunableItems.map((item) => {
              const checked = normalizedSelectedIds.includes(item.id);
              return (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedAttunedIds((curr) => {
                        const next = checked ? curr.filter((id) => id !== item.id) : [...curr, item.id];
                        return normalizeLongRestAttunedIds(next, 3);
                      });
                    }}
                  />
                  <span>{item.name}</span>
                </label>
              );
            })}
            <div className="rest-modal-player-meta">Selected: {normalizedSelectedIds.length} / 3</div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        <div className="rest-modal-label">Charge Recharge</div>
        {rechargeableItems.length === 0 ? (
          <div className="rest-modal-player-meta">No charge-tracked items found.</div>
        ) : (
          rechargeableItems.map((item) => {
            const maxCharges = getItemMaxCharges(item);
            return (
              <label key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12 }}>{item.name} ({item.current_charges || 0}/{maxCharges})</span>
                <input
                  className="rest-modal-input"
                  type="number"
                  min={0}
                  max={maxCharges}
                  inputMode="numeric"
                  value={rechargeDraft[item.id] ?? 0}
                  onChange={(event) => setRechargeDraft((curr) => ({ ...curr, [item.id]: event.target.value }))}
                />
              </label>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" type="button" onClick={applyItemChanges} disabled={loading}>Apply Item Changes</button>
      </div>
    </div>
  );
}
