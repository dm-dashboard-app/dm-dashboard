import React, { useState, useEffect, useCallback } from 'react';
import { supabase, signOut } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';
import SecretRollInbox from '../components/SecretRollInbox';
import EncounterSetup from '../components/EncounterSetup';
import ManagementScreens from '../components/ManagementScreens';

function flattenStates(data) {
  return (data || []).map(s => ({
    ...s,
    wildshape_form_name: s.profiles_wildshape?.form_name ?? null,
    wildshape_hp_max: s.profiles_wildshape?.hp_max ?? null,
  }));
}

// Compact strip showing last 3 secret rolls — shown above initiative in combat tab
function RecentRollsStrip({ encounterId }) {
  const [rolls, setRolls] = useState([]);

  const load = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase
      .from('secret_rolls')
      .select('*, profiles_players(name)')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(3);
    setRolls(data || []);
  }, [encounterId]);

  usePolling(load, 2000, !!encounterId);

  if (rolls.length === 0) return null;

  return (
    <div className="panel" style={{ padding: '10px 14px' }}>
      <div className="panel-title" style={{ marginBottom: 6 }}>Recent Rolls</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rolls.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {r.profiles_players?.name || 'Unknown'}
              </span>
              <span style={{ color: 'var(--accent-gold)', fontSize: 11, textTransform: 'capitalize' }}>
                {r.skill}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-blue)' }}>{r.total}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({r.d20_roll}+{r.skill_bonus})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DMView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [tab, setTab] = useState('combat');
  const [loading, setLoading] = useState(true);
  const [displayToken, setDisplayToken] = useState(null);
  const [joinCodes, setJoinCodes] = useState([]);
  const [showJoinCodes, setShowJoinCodes] = useState(false);
  const [encounterId, setEncounterId] = useState(null);
  const [rollingInit, setRollingInit] = useState(false);

  useEffect(() => { loadLatestEncounter(); }, []);

  async function loadLatestEncounter() {
    setLoading(true);
    const { data } = await supabase
      .from('encounters').select('*')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (data) { setEncounter(data); setEncounterId(data.id); }
    setLoading(false);
  }

  const refreshAll = useCallback(async () => {
    if (!encounterId) return;
    const [enc, comb, states, token, codes] = await Promise.all([
      supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
      supabase.from('combatants').select('*').eq('encounter_id', encounterId)
        .order('initiative_total', { ascending: false, nullsFirst: false }),
      supabase.from('player_encounter_state')
        .select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)')
        .eq('encounter_id', encounterId),
      supabase.from('display_sessions').select('token').eq('encounter_id', encounterId).maybeSingle(),
      supabase.from('player_sessions').select('join_code, profiles_players(name)').eq('encounter_id', encounterId),
    ]);
    if (enc.data) setEncounter(enc.data);
    setCombatants(comb.data || []);
    setPlayerStates(flattenStates(states.data));
    setDisplayToken(token.data?.token || null);
    setJoinCodes(codes.data || []);
  }, [encounterId]);

  usePolling(refreshAll, 2000, !!encounterId);

  async function handleNextTurn() {
    if (!encounter) return;
    await supabase.rpc('advance_turn', { p_encounter_id: encounter.id });
    refreshAll();
  }

  async function handleToggleEditMode() {
    if (!encounter) return;
    await supabase.from('encounters').update({ player_edit_mode: !encounter.player_edit_mode }).eq('id', encounter.id);
    refreshAll();
  }

  async function handleGenerateDisplayToken() {
    if (!encounter) return;
    await supabase.rpc('generate_display_token', { p_encounter_id: encounter.id });
    refreshAll();
  }

  async function handleRevokeDisplayToken() {
    if (!encounter) return;
    await supabase.from('display_sessions').delete().eq('encounter_id', encounter.id);
    setDisplayToken(null);
  }

  async function handleLongRest() {
    if (!encounter) return;
    if (!window.confirm('Long Rest — restore all player HP, spell slots, and wild shape uses?')) return;
    await supabase.rpc('long_rest', { p_encounter_id: encounter.id });
    refreshAll();
  }

  async function handleRollEnemyInitiative() {
    const targets = combatants.filter(c => c.side !== 'PC' && c.initiative_total == null);
    if (targets.length === 0) {
      const reroll = combatants.filter(c => c.side !== 'PC');
      if (!window.confirm('All enemies already have initiative. Reroll everyone?')) return;
      setRollingInit(true);
      await Promise.all(reroll.map(c => {
        const roll = Math.floor(Math.random() * 20) + 1 + (c.initiative_mod ?? 0);
        return supabase.rpc('set_initiative', { p_combatant_id: c.id, p_total: roll });
      }));
      setRollingInit(false);
      refreshAll();
      return;
    }
    setRollingInit(true);
    await Promise.all(targets.map(c => {
      const roll = Math.floor(Math.random() * 20) + 1 + (c.initiative_mod ?? 0);
      return supabase.rpc('set_initiative', { p_combatant_id: c.id, p_total: roll });
    }));
    setRollingInit(false);
    refreshAll();
  }

  function handleNewEncounter() {
    setEncounter(null); setEncounterId(null);
    setCombatants([]); setPlayerStates([]);
    setDisplayToken(null); setJoinCodes([]);
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
          <EncounterSetup onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); }} />
          <ManagementScreens />
        </div>
      </div>
    );
  }

  const pcCombatants = combatants.filter(c => c.side === 'PC');
  const nonPcCount = combatants.filter(c => c.side !== 'PC').length;

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="top-bar-round">R{encounter.round}</div>
        <button className="btn btn-primary" onClick={handleNextTurn}>▶ Next</button>
        <span className="top-bar-title">{encounter.name}</span>
        <button className="btn btn-ghost" onClick={handleToggleEditMode} title="Player Edit Mode">
          {encounter.player_edit_mode ? '✏️' : '🔒'}
        </button>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>⚔ Combat</button>
        <button className={`tab-btn ${tab === 'rolls' ? 'active' : ''}`} onClick={() => setTab('rolls')}>🎲 Rolls</button>
        <button className={`tab-btn ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>⚙ Manage</button>
      </div>

      <div className="main-content">
        {tab === 'combat' && (
          <>
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
                  onUpdate={refreshAll}
                />
              );
            })}

            {/* Last 3 secret rolls — sits just above initiative order */}
            <RecentRollsStrip encounterId={encounter.id} />

            <InitiativePanel
              encounter={encounter}
              combatants={combatants}
              playerStates={playerStates}
              role="dm"
              onUpdate={refreshAll}
            />

            <div className="panel">
              <div className="panel-title">Display Token</div>
              {displayToken ? (
                <div className="display-token-row">
                  <span className="display-token-value">{displayToken}</span>
                  <button className="btn btn-danger" onClick={handleRevokeDisplayToken}>Revoke</button>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={handleGenerateDisplayToken}>Generate Display Token</button>
              )}
            </div>

            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="panel-title" style={{ marginBottom: 0 }}>
                  Player Join Codes {joinCodes.length > 0 && `(${joinCodes.length})`}
                </div>
                <button className="btn btn-ghost" onClick={() => setShowJoinCodes(s => !s)}>
                  {showJoinCodes ? 'Hide' : 'Show'}
                </button>
              </div>
              {showJoinCodes && (
                <div style={{ marginTop: 12 }}>
                  {joinCodes.length === 0
                    ? <div className="empty-state">No join codes for this encounter.</div>
                    : joinCodes.map((s, i) => (
                      <div key={i} className="join-code-row">
                        <span className="join-code-name">{s.profiles_players?.name || 'Player'}</span>
                        <span className="join-code-value">{s.join_code}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="panel">
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={handleNewEncounter}>New Encounter</button>
                <button className="btn btn-ghost" onClick={handleLongRest}>🌙 Long Rest</button>
                {nonPcCount > 0 && (
                  <button
                    className="btn btn-ghost"
                    onClick={handleRollEnemyInitiative}
                    disabled={rollingInit}
                    title="Roll initiative for all enemies and NPCs"
                  >
                    {rollingInit ? 'Rolling…' : '🎲 Roll Enemy Init'}
                  </button>
                )}
                <button className="btn btn-ghost" onClick={signOut}>Sign Out</button>
              </div>
            </div>
          </>
        )}

        {tab === 'rolls' && <SecretRollInbox encounterId={encounter.id} />}
        {tab === 'manage' && (
          <ManagementScreens
            onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); }}
            currentEncounter={encounter}
          />
        )}
      </div>
    </div>
  );
}