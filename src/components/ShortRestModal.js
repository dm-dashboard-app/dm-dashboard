import React, { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { readNumberField } from '../utils/classResources';
import {
  buildShortRestPatch,
  computeHealingTotal,
  getSongOfRestDie,
  getSongOfRestOwnerStateId,
  getSharedSongOfRestTotal,
  SHORT_REST_LOG_ACTION,
} from '../utils/shortRestWorkflow';

function spentSummary(spendBySize = {}) {
  return Object.entries(spendBySize)
    .map(([label, value]) => ({ label, value: Math.max(0, parseInt(value, 10) || 0) }))
    .filter(entry => entry.value > 0)
    .map(entry => `${entry.value}${entry.label}`)
    .join(' ');
}

export default function ShortRestModal({
  open,
  playerStates,
  encounterId,
  responsesByStateId = {},
  shortRestProcedureActive = false,
  onClose,
  onCancelProcedure,
  onComplete,
}) {
  const [submitting, setSubmitting] = useState(false);

  const rows = useMemo(() => {
    const songOwnerId = getSongOfRestOwnerStateId(playerStates || []);
    const baseRows = (playerStates || []).map((state) => {
      const profile = state?.profiles_players || {};
      const responsePayload = responsesByStateId[state.id] || {};
      const response = responsePayload?.response || null;
      const healingSection = response?.sections?.healing || {};
      return {
        state,
        profile,
        name: profile.name || 'Unknown Player',
        response,
        responsePayload,
        totalHitDiceUsed: Math.max(0, parseInt(healingSection.totalHitDiceUsed, 10) || 0),
        spendBySize: healingSection.spendBySize || {},
        isReady: !!response?.ready,
        isSongOwner: state.id === songOwnerId,
      };
    });

    const sharedSong = getSharedSongOfRestTotal({ playerStates, responsesByStateId });

    return baseRows.map((row) => ({
      ...row,
      healingTotal: row.response ? computeHealingTotal(row.response, row.profile, sharedSong) : 0,
      sharedSong,
    }));
  }, [playerStates, responsesByStateId]);

  const allReady = rows.length > 0 && rows.every(row => row.isReady);

  async function handleConfirm() {
    if (!encounterId || submitting || !allReady) return;
    setSubmitting(true);
    try {
      for (const row of rows) {
        const patch = buildShortRestPatch({
          state: row.state,
          profile: row.profile,
          healingTotal: row.healingTotal,
          spendBySize: row.spendBySize,
        });
        await supabase.from('player_encounter_state').update(patch).eq('id', row.state.id);
        const fromHp = readNumberField(row.state, ['current_hp'], 0);
        const toHp = patch.current_hp ?? fromHp;
        const spends = spentSummary(row.spendBySize);
        await supabase.from('combat_log').insert({
          encounter_id: encounterId,
          actor: 'DM',
          action: 'heal',
          detail: `${row.name}: short rest +${row.healingTotal} HP (${fromHp} → ${toHp})${spends ? ` • ${spends} spent` : ''}`,
        });
      }
      await supabase.from('encounters').update({ round: 1, turn_index: 0, short_rest_active: false, short_rest_started_at: null }).eq('id', encounterId);
      await supabase.from('combat_log').insert({ encounter_id: encounterId, actor: 'DM', action: SHORT_REST_LOG_ACTION, detail: JSON.stringify({ type: 'complete' }) });
      await supabase.from('combat_log').insert({ encounter_id: encounterId, actor: 'DM', action: 'rest', detail: 'Short Rest completed — short-rest resources restored and round reset to 1' });
      onComplete?.();
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  return (
    <div className="rest-modal-overlay" onClick={onClose}>
      <div className="rest-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="rest-modal">
          <div className="rest-modal-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="panel-title" style={{ margin: 0 }}>Short Rest Review</div>
              <div className="rest-modal-subtitle">Await player responses, review healing + hit dice, then confirm.</div>
            </div>
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Close</button>
          </div>
          <div className="rest-modal-body">
            {rows.map((row) => (
              <div key={row.state.id} className="rest-modal-player-card">
                <div className="rest-modal-player-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span className="rest-modal-player-name">{row.name}</span>
                    <span className="rest-modal-player-meta">
                      {row.isReady ? `Healing ${row.healingTotal} • Hit Dice ${row.totalHitDiceUsed}` : 'Waiting for player response'}
                    </span>
                  </div>
                  <span className="rest-modal-hit-dice" style={{ color: row.isReady ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {row.isReady ? 'READY' : 'PENDING'}
                  </span>
                </div>
                {row.isSongOwner && getSongOfRestDie(row.profile) && row.response?.sections?.healing?.songOfRestTotal > 0 && (
                  <div className="rest-modal-player-meta">Song of Rest shared total: +{row.response.sections.healing.songOfRestTotal}</div>
                )}
              </div>
            ))}
            {rows.length === 0 && <div className="empty-state">No player states found for this encounter.</div>}
          </div>
          <div className="rest-modal-actions">
            <button className="btn btn-ghost" onClick={shortRestProcedureActive ? onCancelProcedure : onClose} disabled={submitting}>
              {shortRestProcedureActive ? 'Cancel Short Rest' : 'Cancel'}
            </button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={submitting || !allReady}>
              {submitting ? 'Applying…' : 'Confirm Short Rest'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
