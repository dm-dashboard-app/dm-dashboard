import React, { useState, useEffect, useCallback } from 'react';
import { supabase, signOut } from '../supabaseClient';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';
import SecretRollInbox from '../components/SecretRollInbox';
import EncounterSetup from '../components/EncounterSetup';
import ManagementScreens from '../components/ManagementScreens';

export default function DMView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [tab, setTab] = useState('combat');
  const [loading, setLoading] = useState(true);
  const [displayToken, setDisplayToken] = useState(null);
  const [joinCodes, setJoinCodes] = useState([]);
  const [showJoinCodes, setShowJoinCodes] = useState(false);

  useEffect(() => {
    loadLatestEncounter();
  }, []);

  const loadCombatants = useCallback(async (encId) => {
    const { data } = await supabase
      .from('combatants')
      .select('*')
      .eq('encounter_id', encId)
      .order('initiative_total', { ascending: false });
    setCombatants(data || []);
  }, []);

  const loadPlayerStates = useCallback(async (encId) => {
    const { data } = await supabase
      .from('player_encounter_state')
      .select('*, profiles_players(*)')
      .eq('encounter_id', encId);
    setPlayerStates(data || []);
  }, []);

  const loadJoinCodes = useCallback(async (encId) => {
    const { data } = await supabase
      .from('player_sessions')
      .select('join_code, profiles_players(name)')
      .eq('encounter_id', encId);
    setJoinCodes(data || []);
  }, []);

  useEffect(() => {
    if (!encounter) return;

    const enc = supabase
      .channel('dm-encounter')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'encounters',
        filter: `id=eq.${encounter.id}`
      }, payload => {
        if (payload.new) setEncounter(payload.new);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'combatants',
        filter: `encounter_id=eq.${encounter.id}`
      }, () => loadCombatants(encounter.id))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_encounter_state',
        filter: `encounter_id=eq.${encounter.id}`
      }, () => loadPlayerStates(encounter.id))
      .subscribe();

    loadCombatants(encounter.id);
    loadPlayerStates(encounter.id);
    loadDisplayToken(encounter.id);
    loadJoinCodes(encounter.id);

    return () => supabase.removeChannel(enc);
  }, [encounter?.id, loadCombatants, loadPlayerStates, loadJoinCodes]);

  async function loadLatestEncounter() {
    setLoading(true);
    const { data } = await supabase
      .from('encounters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setEncounter(data || null);
    setLoading(false);
  }

  async function loadDisplayToken(encId) {
    const { data } = await supabase
      .from('display_sessions')
      .select('token')
      .eq('encounter_id', encId)
      .single();
    setDisplayToken(data?.token || null);
  }

  async function handleNextTurn() {
    if (!encounter) return;
    await supabase.rpc('advance_turn', { p_encounter_id: encounter.id });
  }

  async function handleToggleEditMode() {
    if (!encounter) return;
    await supabase
      .from('encounters')
      .update({ player_edit_mode: !encounter.player_edit_mode })
      .eq('id', encounter.id);
  }

  async function handleGenerateDisplayToken() {
    if (!encounter) return;
    const { data } = await supabase.rpc('generate_display_token', {
      p_encounter_id: encounter.id
    });
    setDisplayToken(data);
  }

  async function handleRevokeDisplayToken() {
    if (!encounter) return;
    await supabase
      .from('display_sessions')
      .delete()
      .eq('encounter_id', encounter.id);
    setDisplayToken(null);
  }

  if (loading) return <div className="splash"><div className="splash-text">Loading…</div></div>;

  if (!encounter) {
    return (
      <div className="app-shell">
        <div className="top-bar">
          <span className="top-bar-title">DM Dashboard</span>
          <button className="btn btn-ghost" onClick={signOut}>Sign Out</button>
        </div>
        <div className="main-content">
          <EncounterSetup onEncounterCreated={enc => { setEncounter(enc); }} />
          <ManagementScreens />
        </div>
      </div>
    );
  }

  const pcCombatants = combatants.filter(c => c.side === 'PC');

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-round">R{encounter.round}</div>
        <button className="btn btn-primary" onClick={handleNextTurn}>
          ▶ Next
        </button>
        <span className="top-bar-title">{encounter.name}</span>
        <button className="btn btn-ghost" onClick={handleToggleEditMode} title="Player Edit Mode">
          {encounter.player_edit_mode ? '✏️' : '🔒'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>⚔ Combat</button>
        <button className={`tab-btn ${tab === 'rolls' ? 'active' : ''}`} onClick={() => setTab('rolls')}>🎲 Rolls</button>
        <button className={`tab-btn ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>⚙ Manage</button>
      </div>

      <div className="main-content">
        {tab === 'combat' && (
          <>
            {/* Display Token */}
            <div className="panel">
              <div className="panel-title">Display Token</div>
              {displayToken ? (
                <div className="display-token-row">
                  <span className="display-token-value">{displayToken}</span>
                  <button className="btn btn-danger" onClick={handleRevokeDisplayToken}>Revoke</button>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={handleGenerateDisplayToken}>
                  Generate Display Token
                </button>
              )}
            </div>

            {/* Join Codes */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="panel-title" style={{ marginBottom: 0 }}>Player Join Codes</div>
                <button className="btn btn-ghost" onClick={() => setShowJoinCodes(s => !s)}>
                  {showJoinCodes ? 'Hide' : 'Show'}
                </button>
              </div>
              {showJoinCodes && (
                <div style={{ marginTop: 12 }}>
                  {joinCodes.length === 0 && (
                    <div className="empty-state">No join codes yet. Create an encounter with players first.</div>
                  )}
                  {joinCodes.map((s, i) => (
                    <div key={i} className="join-code-row">
                      <span className="join-code-name">{s.profiles_players?.name || 'Player'}</span>
                      <span className="join-code-value">{s.join_code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Player Cards */}
            {pcCombatants.map(c => {
              const state = playerStates.find(s => s.combatant_id === c.id);
              return (
                <PlayerCard
                  key={c.id}
                  combatant={c}
                  state={state}
                  role="dm"
                  isEditMode={encounter.player_edit_mode}
                  encounterId={encounter.id}
                  onUpdate={() => {
                    loadCombatants(encounter.id);
                    loadPlayerStates(encounter.id);
                  }}
                />
              );
            })}

            {/* Initiative Panel */}
            <InitiativePanel
              encounter={encounter}
              combatants={combatants}
              role="dm"
              onUpdate={() => loadCombatants(encounter.id)}
            />

            {/* Encounter controls */}
            <div className="panel">
              <div className="panel-title">Encounter</div>
              <div className="form-row">
                <button className="btn btn-ghost" onClick={() => { setEncounter(null); setCombatants([]); setPlayerStates([]); }}>
                  New Encounter
                </button>
                <button className="btn btn-ghost" onClick={signOut}>
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'rolls' && (
          <SecretRollInbox encounterId={encounter.id} />
        )}

        {tab === 'manage' && (
          <ManagementScreens onEncounterCreated={setEncounter} currentEncounter={encounter} />
        )}
      </div>
    </div>
  );
}