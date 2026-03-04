import React, { useState, useEffect, useCallback } from 'react';
import { supabase, clearPlayerSession } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';
import SecretRollPanel from '../components/SecretRollPanel';

export default function PlayerView() {
  const [encounter, setEncounter] = useState(null);
  const [combatant, setCombatant] = useState(null);
  const [state, setState] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initiativeInput, setInitiativeInput] = useState('');

  const profileId = localStorage.getItem('player_profile_id');
  const encounterId = localStorage.getItem('player_encounter_id');

  const refreshAll = useCallback(async () => {
    if (!encounterId || !profileId) return;
    try {
      const [enc, combs, myState] = await Promise.all([
        supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
        supabase.from('combatants').select('*').eq('encounter_id', encounterId).order('initiative_total', { ascending: false }),
        supabase.from('player_encounter_state').select('*, profiles_players(*)').eq('encounter_id', encounterId).eq('player_profile_id', profileId).maybeSingle(),
      ]);
      if (enc.data) setEncounter(enc.data);
      const all = combs.data || [];
      setCombatants(all);
      const mine = all.find(c => c.owner_player_id === profileId);
      setCombatant(mine || null);
      if (myState.data) setState(myState.data);
    } catch (err) {
      setError(err.message);
    }
  }, [encounterId, profileId]);

  useEffect(() => {
    if (!profileId || !encounterId) {
      setError('Session not found. Please re-enter your join code.');
      setLoading(false);
      return;
    }
    refreshAll().then(() => setLoading(false));
  }, [refreshAll]);

  usePolling(refreshAll, 2000, !!encounterId);

  async function handleSubmitInitiative() {
    if (!combatant || !initiativeInput) return;
    const total = parseInt(initiativeInput);
    if (isNaN(total)) return;
    // Update initiative_total directly — avoids the DB trigger
    // which would recalculate from initiative_roll + mod
    await supabase
      .from('combatants')
      .update({ initiative_total: total })
      .eq('id', combatant.id);
    refreshAll();
  }

  function handleLeave() {
    clearPlayerSession();
    window.location.reload();
  }

  if (loading) return <div className="splash"><div className="splash-text">Joining session…</div></div>;

  if (error) return (
    <div className="splash">
      <div className="splash-text">⚠ {error}</div>
      <button className="btn btn-ghost" onClick={handleLeave}>Back to Join Screen</button>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="top-bar">
        <span className="top-bar-title">{encounter?.name || 'Encounter'}</span>
        <span className="top-bar-round">R{encounter?.round || 1}</span>
      </div>

      <div className="main-content">
        {combatant && state && (
          <PlayerCard
            combatant={combatant}
            state={state}
            role="player"
            isEditMode={encounter?.player_edit_mode}
            encounterId={encounterId}
            onUpdate={refreshAll}
          />
        )}

        {/* Initiative entry — always visible, type and submit any time */}
        {combatant && (
          <div className="panel">
            <div className="panel-title">Initiative</div>
            <div className="form-row">
              <input
                className="form-input"
                type="number"
                inputMode="numeric"
                placeholder="Enter your total…"
                value={initiativeInput}
                onChange={e => setInitiativeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitInitiative()}
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, width: 140, textAlign: 'center' }}
              />
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmitInitiative}
                disabled={!initiativeInput}
              >Submit</button>
            </div>
            {combatant.initiative_total != null && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                Current: <strong style={{ color: 'var(--accent-blue)' }}>{combatant.initiative_total}</strong>
              </div>
            )}
          </div>
        )}

        {profileId && encounterId && (
          <SecretRollPanel encounterId={encounterId} playerProfileId={profileId} />
        )}

        <InitiativePanel
          encounter={encounter}
          combatants={combatants}
          role="player"
          onUpdate={() => {}}
        />

        <button className="btn btn-ghost" onClick={handleLeave}>Leave Session</button>
      </div>
    </div>
  );
}