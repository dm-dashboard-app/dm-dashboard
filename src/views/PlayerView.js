import React, { useState, useEffect } from 'react';
import { supabase, clearPlayerSession } from '../supabaseClient';
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

  const profileId = localStorage.getItem('player_profile_id');
  const encounterId = localStorage.getItem('player_encounter_id');

  useEffect(() => {
    if (!profileId || !encounterId) {
      setError('Session not found. Please re-enter your join code.');
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!encounterId) return;

    const channel = supabase
      .channel('player-encounter')
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
      }, () => loadMyState())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [encounterId]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadEncounter(), loadCombatants(), loadMyState()]);
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

    // Find my combatant
    const mine = (data || []).find(c => c.owner_player_id === profileId);
    setCombatant(mine || null);
  }

  async function loadMyState() {
    const { data } = await supabase
      .from('player_encounter_state')
      .select('*, profiles_players(*)')
      .eq('encounter_id', encounterId)
      .eq('player_profile_id', profileId)
      .single();
    setState(data || null);
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
        {/* My character card */}
        {combatant && state && (
          <PlayerCard
            combatant={combatant}
            state={state}
            role="player"
            isEditMode={encounter?.player_edit_mode}
            encounterId={encounterId}
            onUpdate={loadMyState}
          />
        )}

        {/* Secret rolls */}
        {profileId && encounterId && (
          <SecretRollPanel
            encounterId={encounterId}
            playerProfileId={profileId}
          />
        )}

        {/* Initiative list */}
        <InitiativePanel
          encounter={encounter}
          combatants={combatants}
          role="player"
          onUpdate={() => {}}
        />

        <button className="btn btn-ghost" onClick={handleLeave}>
          Leave Session
        </button>
      </div>
    </div>
  );
}