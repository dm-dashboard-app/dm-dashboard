import React, { useState, useEffect, useCallback } from 'react';
import { supabase, clearPlayerSession } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';

export default function DisplayView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const encounterId = localStorage.getItem('display_encounter_id');

  const refreshAll = useCallback(async () => {
    if (!encounterId) return;
    try {
      const [enc, combs, states] = await Promise.all([
        supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
        supabase.from('combatants').select('*').eq('encounter_id', encounterId).order('initiative_total', { ascending: false }),
        supabase.from('player_encounter_state').select('*, profiles_players(*)').eq('encounter_id', encounterId),
      ]);
      if (enc.data) setEncounter(enc.data);
      setCombatants(combs.data || []);
      setPlayerStates(states.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId) {
      setError('No display session found.');
      setLoading(false);
      return;
    }
    refreshAll().then(() => setLoading(false));
  }, [refreshAll]);

  usePolling(refreshAll, 2000, !!encounterId);

  if (loading) return (
    <div className="splash">
      <div className="splash-logo">📺</div>
      <div className="splash-text">Connecting…</div>
    </div>
  );

  if (error) return (
    <div className="splash">
      <div className="splash-text">⚠ {error}</div>
      <button className="btn btn-ghost" onClick={() => { clearPlayerSession(); window.location.reload(); }}>Back</button>
    </div>
  );

  const pcCombatants = combatants.filter(c => c.side === 'PC');
  const slots = [0, 1, 2, 3].map(i => pcCombatants[i] || null);

  return (
    <div className="display-layout">
      <div className="display-player-cards">
        <div className="display-header">
          <span className="display-encounter-name">{encounter?.name}</span>
          <span className="display-round">Round {encounter?.round || 1}</span>
          <button
            onClick={() => { clearPlayerSession(); window.location.reload(); }}
            title="Exit Display Mode"
            style={{
              opacity: 0.2,
              fontSize: 11,
              color: 'var(--text-muted)',
              padding: '2px 6px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.target.style.opacity = 0.8}
            onMouseLeave={e => e.target.style.opacity = 0.2}
          >exit</button>
        </div>
        {slots.map((c, i) => {
          if (!c) return <EmptySlot key={i} />;
          const state = playerStates.find(s => s.combatant_id === c.id);
          return (
            <PlayerCard
              key={c.id}
              combatant={c}
              state={state}
              role="display"
              isEditMode={false}
              encounterId={encounterId}
              onUpdate={() => {}}
            />
          );
        })}
      </div>
      <div className="display-initiative">
        <InitiativePanel
          encounter={encounter}
          combatants={combatants}
          playerStates={playerStates}
          role="display"
          onUpdate={() => {}}
        />
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="player-card player-card-empty">
      <div className="portrait-strip portrait-strip-empty" />
      <div className="card-body">
        <div className="empty-slot-label">Empty Slot</div>
      </div>
    </div>
  );
}