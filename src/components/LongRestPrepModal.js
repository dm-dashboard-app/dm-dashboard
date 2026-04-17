import React, { useMemo, useState } from 'react';
import SpellWorkflowPanel from './SpellWorkflowPanel';
import InventoryModal from '../inventory/InventoryModal';
import { getPreparedCapTotal, hasPreparationRequirement } from '../utils/spellWorkflow';

export default function LongRestPrepModal({ open, playerStates = [], onClose, onComplete, onRefresh }) {
  const [selectedState, setSelectedState] = useState(null);
  const [selectedInventoryState, setSelectedInventoryState] = useState(null);

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
            <div className="modal-subtitle">Each player who prepares spells must review their list, then mark ready. Once everyone is ready, complete the long rest.</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requiredPlayers.map(state => {
            const profile = state?.profiles_players || {};
            const prepCap = getPreparedCapTotal(profile);
            return (
              <div key={state.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{profile.name || 'Player'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prepared cap {prepCap || 0} • {state.spell_prep_ready ? 'Ready' : 'Not ready yet'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: state.spell_prep_ready ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 700 }}>{state.spell_prep_ready ? 'READY' : 'PENDING'}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSelectedState(state)}>Review</button>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setSelectedInventoryState(state)}>Items / Attunement</button>
                </div>
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


      {selectedInventoryState && (
        <InventoryModal
          open={!!selectedInventoryState}
          onClose={() => setSelectedInventoryState(null)}
          role="dm"
          playerProfileId={selectedInventoryState.player_profile_id}
          playerName={selectedInventoryState.profiles_players?.name || 'Player'}
          attunementRestContext
          allowChargeRecharge
        />
      )}
    </div>
  );
}
