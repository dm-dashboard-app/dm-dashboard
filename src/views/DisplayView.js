import React, { useState, useEffect } from 'react';
import { supabase, clearPlayerSession } from '../supabaseClient';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';

export default function DisplayView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const encounterId = localStorage.getItem('display_encounter_id');

  useEffect(() => {
    if (!encounterId) {
      setError('No display session found.');
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!encounterId) return;

    const channel = supabase
      .channel('display-encounter')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'encounters',
        filter: `id=eq.${encounterId}`
      }, payload => {
        if (payload.new) setEncounter(payload.new);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'combatants',
        filter: `encounter_id=eq.${encounterId}`
      }, () => loadCombatants())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_encounter_state',
        filter: `encounter_id=eq.${encounterId}`
      }, () => loadPlayerStates())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [encounterId]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadEncounter(), loadCombatants(), loadPlayerStates()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEncounter() {
    const { data } = await supabase
      .from('encounters')
      .select('*')
      .eq('id', encounterId)
      .single();
    setEncounter(data);
  }

  async function loadCombatants() {
    const { data } = await supabase
      .from('combatants_public')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('initiative_total', { ascending: false });
    setCombatants(data || []);
  }

  async function loadPlayerStates() {
    const { data } = await supabase
      .from('player_encounter_state')
      .select('*, profiles_players(*)')
      .eq('encounter_id', encounterId);
    setPlayerStates(data || []);
  }

  function handleDisconnect() {
    clearPlayerSession();
    window.location.reload();
  }

  if (loading) return (
    <div className="splash">
      <div className="splash-logo">📺</div>
      <div className="splash-text">Connecting to encounter…</div>
    </div>
  );

  if (error) return (
    <div className="splash">
      <div className="splash-text">⚠ {error}</div>
      <button className="btn btn-ghost" onClick={handleDisconnect}>
        Back
      </button>
    </div>
  );

  // Always show exactly 4 player card slots
  const pcCombatants = combatants.filter(c => c.side === 'PC');
  const slots = [0, 1, 2, 3].map(i => pcCombatants[i] || null);

  return (
    <div className="display-layout">
      {/* Left: 4 player card slots */}
      <div className="display-player-cards">
        <div className="display-header">
          <span className="display-encounter-name">{encounter?.name}</span>
          <span className="display-round">Round {encounter?.round || 1}</span>
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

      {/* Right: Initiative panel */}
      <div className="display-initiative">
        <InitiativePanel
          encounter={encounter}
          combatants={combatants}
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