import React, { useEffect, useMemo, useState } from 'react';
import SpellWorkflowPanel from './SpellWorkflowPanel';
import {
  inventoryAttuneItem,
  inventoryGetSnapshot,
  inventoryRechargeItem,
  inventoryUnattuneItem,
} from '../inventory/inventoryClient';
import { getItemMaxCharges, itemRequiresAttunement } from '../utils/itemEffects';
import { getPreparedCapTotal, hasPreparationRequirement } from '../utils/spellWorkflow';

function LongRestItemsSection({ state, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedAttunedIds, setSelectedAttunedIds] = useState([]);
  const [rechargeDraft, setRechargeDraft] = useState({});
  const profileId = state?.player_profile_id;

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profileId) return;
      setLoading(true);
      try {
        const snapshot = await inventoryGetSnapshot({ playerProfileId: profileId, role: 'dm' });
        if (!active) return;
        const nextItems = snapshot?.items || [];
        setItems(nextItems);
        setSelectedAttunedIds(nextItems.filter((row) => row.attuned).map((row) => row.id));
        const nextRecharge = {};
        nextItems.forEach((row) => {
          const maxCharges = getItemMaxCharges(row);
          if (maxCharges > 0) nextRecharge[row.id] = 0;
        });
        setRechargeDraft(nextRecharge);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [profileId]);

  const attunableItems = useMemo(
    () => items.filter((row) => itemRequiresAttunement(row)),
    [items],
  );
  const rechargeableItems = useMemo(
    () => items.filter((row) => getItemMaxCharges(row) > 0),
    [items],
  );

  async function applyRestItemChanges() {
    if (!profileId) return;
    setLoading(true);
    try {
      for (const row of attunableItems) {
        const shouldAttune = selectedAttunedIds.includes(row.id);
        if (shouldAttune && !row.attuned) {
          await inventoryAttuneItem({ playerProfileId: profileId, role: 'dm', itemRowId: row.id, restContext: true });
        }
        if (!shouldAttune && row.attuned) {
          await inventoryUnattuneItem({ playerProfileId: profileId, role: 'dm', itemRowId: row.id });
        }
      }

      for (const row of rechargeableItems) {
        const restored = Math.max(0, parseInt(rechargeDraft[row.id] || 0, 10) || 0);
        if (restored > 0) {
          await inventoryRechargeItem({
            playerProfileId: profileId,
            role: 'dm',
            itemRowId: row.id,
            restoredCharges: restored,
          });
        }
      }
      await onApplied?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 8, padding: 10 }}>
      <div className="panel-title" style={{ marginBottom: 6 }}>Long Rest • Attunement & Recharge</div>
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading items…</div> : null}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        Supported automation applies to curated enrichment-backed items only. Other items remain manual.
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Attunement (max 3)</div>
        {attunableItems.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 0 }}>No attunement-eligible items found.</div>
        ) : (
          attunableItems.map((item) => {
            const checked = selectedAttunedIds.includes(item.id);
            return (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelectedAttunedIds((curr) => {
                      if (checked) return curr.filter((id) => id !== item.id);
                      if (curr.length >= 3) return curr;
                      return [...curr, item.id];
                    });
                  }}
                />
                <span>{item.name}</span>
              </label>
            );
          })
        )}
      </div>

      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Charge Recharge</div>
        {rechargeableItems.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 0 }}>No charge-tracked items found.</div>
        ) : (
          rechargeableItems.map((item) => {
            const maxCharges = getItemMaxCharges(item);
            return (
              <label key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 82px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12 }}>{item.name} ({item.current_charges || 0}/{maxCharges})</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={maxCharges}
                  value={rechargeDraft[item.id] ?? 0}
                  onChange={(event) => {
                    setRechargeDraft((curr) => ({ ...curr, [item.id]: event.target.value }));
                  }}
                />
              </label>
            );
          })
        )}
      </div>

      <div className="form-row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn btn-primary" onClick={applyRestItemChanges} disabled={loading}>Apply Item Rest Changes</button>
      </div>
    </div>
  );
}

export default function LongRestPrepModal({ open, playerStates = [], onClose, onComplete, onRefresh }) {
  const [selectedState, setSelectedState] = useState(null);
  const [selectedItemsState, setSelectedItemsState] = useState(null);

  const requiredPlayers = useMemo(() => {
    return (playerStates || []).filter(state => hasPreparationRequirement(state?.profiles_players || {}));
  }, [playerStates]);

  const allReady = requiredPlayers.length > 0 && requiredPlayers.every(state => !!state.spell_prep_ready);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 'min(860px, calc(100vw - 24px))', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>Long Rest Preparation</div>
            <div className="modal-subtitle">Each player who prepares spells must review their list, then mark ready. Attunement + charge recharge are handled directly below in this flow.</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requiredPlayers.map(state => {
            const profile = state?.profiles_players || {};
            const prepCap = getPreparedCapTotal(profile);
            return (
              <div key={state.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{profile.name || 'Player'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prepared cap {prepCap || 0} • {state.spell_prep_ready ? 'Ready' : 'Not ready yet'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: state.spell_prep_ready ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 700 }}>{state.spell_prep_ready ? 'READY' : 'PENDING'}</span>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSelectedState(state)}>Review Spells</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSelectedItemsState((curr) => (curr?.id === state.id ? null : state))}>Items Section</button>
                  </div>
                </div>

                {selectedItemsState?.id === state.id ? (
                  <LongRestItemsSection
                    state={state}
                    onApplied={async () => {
                      await onRefresh?.();
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          {requiredPlayers.length === 0 && <div className="empty-state">No players need spell preparation. You can complete the long rest immediately.</div>}
        </div>

        <div className="form-row" style={{ justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onComplete} disabled={requiredPlayers.length > 0 && !allReady}>Complete Long Rest</button>
        </div>
      </div>

      {selectedState && (
        <SpellWorkflowPanel
          variant="modal"
          mode="runtime"
          role="dm"
          profile={selectedState.profiles_players}
          state={selectedState}
          onUpdate={onRefresh}
          onClose={() => setSelectedState(null)}
          title={`${selectedState.profiles_players?.name || 'Player'} Spells`}
          subtitle="Browse current spell lists and inspect spell details while long-rest preparation is in progress."
        />
      )}
    </div>
  );
}
