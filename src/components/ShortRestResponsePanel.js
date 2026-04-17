import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { inventoryGetSnapshot } from '../inventory/inventoryClient';
import { getAbilityModifier, readNumberField } from '../utils/classResources';
import {
  getSongOfRestDie,
  getSongOfRestOwnerStateId,
  validateShortRestResponse,
  SHORT_REST_RESPONSE_ACTION,
  computeHealingTotal,
} from '../utils/shortRestWorkflow';

export default function ShortRestResponsePanel({ open, encounterId, state, playerStates, initialResponse, sharedSongOfRestTotal = 0, onClose, onSubmitted }) {
  const profile = useMemo(() => state?.profiles_players || {}, [state?.profiles_players]);
  const songOwnerId = useMemo(() => getSongOfRestOwnerStateId(playerStates || []), [playerStates]);
  const isSongOwner = state?.id === songOwnerId;
  const songDie = getSongOfRestDie(profile);
  const initialHealing = initialResponse?.sections?.healing || {};
  const [draft, setDraft] = useState(() => ({
    rolledTotal: initialHealing.rolledTotal ?? '',
    totalHitDiceUsed: initialHealing.totalHitDiceUsed ?? '',
    songOfRestTotal: initialHealing.songOfRestTotal ?? '',
    spendBySize: initialHealing.spendBySize || {},
  }));
  const [submitting, setSubmitting] = useState(false);
  const [snapshotItems, setSnapshotItems] = useState([]);
  const [selectedAttuneIds, setSelectedAttuneIds] = useState([]);


  useEffect(() => {
    let active = true;
    async function loadInventory() {
      if (!open || !state?.player_profile_id) return;
      try {
        const snapshot = await inventoryGetSnapshot({
          playerProfileId: state.player_profile_id,
          role: 'player',
          joinCode: localStorage.getItem('player_join_code'),
        });
        if (!active) return;
        const items = snapshot?.items || [];
        setSnapshotItems(items);
        setSelectedAttuneIds(items.filter((row) => row.attuned).map((row) => row.id));
      } catch (_err) {
        if (active) {
          setSnapshotItems([]);
          setSelectedAttuneIds([]);
        }
      }
    }
    loadInventory();
    return () => {
      active = false;
    };
  }, [open, state?.id, state?.player_profile_id]);

  const attunableItems = useMemo(() => (snapshotItems || []).filter((row) => row.requires_attunement), [snapshotItems]);

  const validation = useMemo(() => validateShortRestResponse({ input: draft, state, profile, isSongOfRestOwner: isSongOwner }), [draft, state, profile, isSongOwner]);
  const healing = validation.response.sections.healing;
  const singlePool = validation.pools.length === 1 ? validation.pools[0] : null;
  const effectiveSharedSong = isSongOwner
    ? Math.max(sharedSongOfRestTotal, Math.max(0, parseInt(draft.songOfRestTotal, 10) || 0))
    : sharedSongOfRestTotal;
  const computedHealingTotal = computeHealingTotal(validation.response, profile, effectiveSharedSong);
  const conMod = getAbilityModifier(readNumberField(profile, ['ability_con'], 10));
  const conContribution = conMod * healing.totalHitDiceUsed;

  function updateField(key, value) { setDraft(curr => ({ ...curr, [key]: value })); }
  function updateSpend(size, value) { setDraft(curr => ({ ...curr, spendBySize: { ...(curr.spendBySize || {}), [size]: value } })); }

  async function handleSubmit() {
    if (!encounterId || !state?.id || !validation.valid || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('combat_log').insert({
        encounter_id: encounterId,
        actor: profile?.name || 'Player',
        action: SHORT_REST_RESPONSE_ACTION,
        detail: JSON.stringify({
          player_state_id: state.id,
          player_profile_id: state.player_profile_id,
          response: { ...validation.response, sections: { ...(validation.response.sections || {}), attunement: { item_ids: selectedAttuneIds } } },
        }),
      });
      onSubmitted?.(validation.response);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !state) return null;

  return (
    <div className="rest-modal-overlay" onClick={onClose}>
      <div className="rest-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="rest-modal">
          <div className="rest-modal-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="panel-title" style={{ margin: 0 }}>Short Rest Response</div>
              <div className="rest-modal-subtitle">Enter totals, check your preview, then mark ready.</div>
            </div>
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Close</button>
          </div>
          <div className="rest-modal-body">
            <div className="rest-modal-player-card">
              <div className="rest-modal-grid">
                <label className="rest-modal-field"><span className="rest-modal-label">Rolled dice total</span><input className="rest-modal-input" type="number" min={0} inputMode="numeric" value={draft.rolledTotal} onChange={(e) => updateField('rolledTotal', e.target.value)} /></label>
                <label className="rest-modal-field"><span className="rest-modal-label">Total hit dice used</span><input className="rest-modal-input" type="number" min={0} inputMode="numeric" value={draft.totalHitDiceUsed} onChange={(e) => updateField('totalHitDiceUsed', e.target.value)} /></label>
              </div>

              {validation.pools.length > 1 && (
                <div className="rest-modal-grid" style={{ marginTop: 8 }}>
                  {validation.pools.map(pool => (
                    <label key={`spend-d${pool.size}`} className="rest-modal-field">
                      <span className="rest-modal-label">Spend d{pool.size} (max {pool.current})</span>
                      <input className="rest-modal-input" type="number" min={0} max={pool.current} inputMode="numeric" value={draft.spendBySize?.[`d${pool.size}`] ?? ''} onChange={(e) => updateSpend(`d${pool.size}`, e.target.value)} />
                    </label>
                  ))}
                </div>
              )}
              {singlePool && (
                <div className="rest-modal-player-meta" style={{ marginTop: 8 }}>
                  Hit dice spend inferred: {healing.totalHitDiceUsed}d{singlePool.size} (max {singlePool.current})
                </div>
              )}

              {isSongOwner && songDie && (
                <div className="rest-modal-grid" style={{ marginTop: 8 }}>
                  <label className="rest-modal-field"><span className="rest-modal-label">Song of Rest shared total ({songDie})</span><input className="rest-modal-input" type="number" min={0} inputMode="numeric" value={draft.songOfRestTotal} onChange={(e) => updateField('songOfRestTotal', e.target.value)} /></label>
                </div>
              )}


              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div className="rest-modal-label" style={{ marginBottom: 4 }}>Attunement (short rest)</div>
                {attunableItems.length === 0 ? (
                  <div className="rest-modal-player-meta">No attunement-eligible items in your inventory.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {attunableItems.map((item) => {
                      const checked = selectedAttuneIds.includes(item.id);
                      return (
                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedAttuneIds((curr) => checked ? curr.filter((id) => id !== item.id) : [...curr, item.id].slice(0, 3));
                            }}
                          />
                          <span>{item.name}</span>
                        </label>
                      );
                    })}
                    <div className="rest-modal-player-meta">Selected: {selectedAttuneIds.length} / 3</div>
                  </div>
                )}
              </div>

              {validation.errors.map(error => <div key={error} style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 6 }}>{error}</div>)}

              <div className="rest-modal-player-meta" style={{ marginTop: 8 }}>
                Healing preview: {computedHealingTotal} HP (rolled {healing.rolledTotal} + CON {conMod >= 0 ? `+${conMod}` : conMod} × {healing.totalHitDiceUsed} = {conContribution} + Song {effectiveSharedSong})
              </div>
            </div>
          </div>
          <div className="rest-modal-actions">
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !validation.valid}>{submitting ? 'Submitting…' : 'Mark Ready'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
