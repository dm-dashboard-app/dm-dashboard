import React, { useState, useEffect, useCallback } from 'react';
import { supabase, signOut } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import InitiativePanel from '../components/InitiativePanelNext';
import SecretRollInbox from '../components/SecretRollInbox';
import EncounterSetup from '../components/EncounterSetup';
import ManagementScreens from '../components/ManagementScreens';
import ShortRestModal from '../components/ShortRestModal';
import { flattenStates } from './dm/dmViewUtils';
import RecentRollsStrip from './dm/RecentRollsStrip';
import RecentAlertsStrip from './dm/RecentAlertsStrip';
import DMCombatLog from './dm/DMCombatLog';
import DMPlayerCardsSection from './dm/DMPlayerCardsSection';

export default function DMView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [tab, setTab] = useState('combat');
  const [loading, setLoading] = useState(true);
  const [displayToken, setDisplayToken] = useState(null);
  const [joinCodes, setJoinCodes] = useState([]);
  const [encounterId, setEncounterId] = useState(null);
  const [rollingInit, setRollingInit] = useState(false);
  const [openBottomStrip, setOpenBottomStrip] = useState(null);
  const [shortRestOpen, setShortRestOpen] = useState(false);

  useEffect(() => {
    loadLatestEncounter();
  }, []);

  async function loadLatestEncounter() {
    setLoading(true);
    const { data } = await supabase
      .from('encounters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setEncounter(data);
      setEncounterId(data.id);
    }
    setLoading(false);
  }

  const refreshAll = useCallback(async () => {
    if (!encounterId) return;
    const [enc, comb, states, token, codes] = await Promise.all([
      supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
      supabase.from('combatants').select('*').eq('encounter_id', encounterId).order('initiative_total', { ascending: false, nullsFirst: false }),
      supabase.from('player_encounter_state').select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)').eq('encounter_id', encounterId),
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

  useEffect(() => {
    if (encounterId) refreshAll();
  }, [encounterId, refreshAll]);

  useEffect(() => {
    if (tab !== 'combat' && openBottomStrip !== null) setOpenBottomStrip(null);
  }, [tab, openBottomStrip]);

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
    await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id);
    refreshAll();
  }

  async function handleRollEnemyInitiative() {
    if (!encounter) return;
    const targets = combatants.filter(c => c.side !== 'PC' && c.initiative_total == null);
    if (targets.length === 0) {
      const reroll = combatants.filter(c => c.side !== 'PC');
      if (!window.confirm('All enemies already have initiative. Reroll everyone and reset round to 1?')) return;
      setRollingInit(true);
      await Promise.all(
        reroll.map(c => {
          const roll = Math.floor(Math.random() * 20) + 1 + (c.initiative_mod ?? 0);
          return supabase.rpc('set_initiative', { p_combatant_id: c.id, p_total: roll });
        })
      );
      await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id);
      setRollingInit(false);
      refreshAll();
      return;
    }

    setRollingInit(true);
    await Promise.all(
      targets.map(c => {
        const roll = Math.floor(Math.random() * 20) + 1 + (c.initiative_mod ?? 0);
        return supabase.rpc('set_initiative', { p_combatant_id: c.id, p_total: roll });
      })
    );
    await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id);
    setRollingInit(false);
    refreshAll();
  }

  function handleFrontScreen() {
    setEncounter(null);
    setEncounterId(null);
    setCombatants([]);
    setPlayerStates([]);
    setDisplayToken(null);
    setJoinCodes([]);
    setTab('manage');
  }

  function toggleBottomStrip(name) {
    setOpenBottomStrip(current => (current === name ? null : name));
  }

  if (loading) return <div className="splash"><div className="splash-text">Loading…</div></div>;

  if (!encounter) {
    return (
      <div className="app-shell">
        <div className="top-bar"><span className="top-bar-title">DM Dashboard</span></div>
        <div className="main-content">
          <EncounterSetup onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); setTab('combat'); }} />
          <ManagementScreens currentEncounter={null} displayToken={null} joinCodes={[]} onToggleEditMode={null} onGenerateDisplayToken={null} onRevokeDisplayToken={null} onFrontScreen={null} onSignOut={signOut} />
        </div>
      </div>
    );
  }

  const pcCombatants = combatants.filter(c => c.side === 'PC');
  const nonPcCount = combatants.filter(c => c.side !== 'PC').length;
  const pendingAlertCount = playerStates.filter(s => s.concentration_check_dc != null).length;
  const hasRecentRolls = tab === 'combat' && encounter?.id && openBottomStrip === 'rolls';
  const hasRecentAlerts = tab === 'combat' && encounter?.id && openBottomStrip === 'alerts';

  return (
    <div className="app-shell">
      <div className="top-bar top-bar--dm-actions">
        <div className="dm-action-round">Round {encounter.round}</div>
        <div className="dm-action-button-row">
          <button className="btn btn-primary" onClick={handleNextTurn}>▶ Next</button>
          <button className="btn btn-ghost" onClick={handleRollEnemyInitiative} disabled={rollingInit}>{rollingInit ? 'Rolling…' : 'Initiative'}</button>
          <button className="btn btn-ghost" onClick={() => setShortRestOpen(true)}>Short Rest</button>
          <button className="btn btn-ghost" onClick={handleLongRest}>Long Rest</button>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>⚔ Combat</button>
        <button className={`tab-btn ${tab === 'rolls' ? 'active' : ''}`} onClick={() => setTab('rolls')}>🎲 Rolls</button>
        <button className={`tab-btn ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>📋 Activity{pendingAlertCount > 0 ? <span className="tab-badge">{pendingAlertCount}</span> : ''}</button>
        <button className={`tab-btn ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>⚙ Manage</button>
      </div>

      <div className="main-content">
        {tab === 'combat' && (
          <div className="dm-combat-layout">
            <div className="dm-initiative-column">
              <InitiativePanel encounter={encounter} combatants={combatants} playerStates={playerStates} role="dm" onUpdate={refreshAll} />

              <div className="panel">
                <div className="panel-title">Live Session</div>
                <div className="dm-live-session-actions">
                  {nonPcCount > 0 && <button className="btn btn-ghost" onClick={handleRollEnemyInitiative} disabled={rollingInit}>{rollingInit ? 'Rolling…' : 'Roll Enemy Initiative'}</button>}
                  <button className="btn btn-ghost" onClick={() => setShortRestOpen(true)}>Open Short Rest</button>
                  <button className="btn btn-ghost" onClick={() => setTab('manage')}>Open Manage</button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => toggleBottomStrip('rolls')}>{hasRecentRolls ? 'Hide recent rolls' : 'Show recent rolls'}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => toggleBottomStrip('alerts')}>{hasRecentAlerts ? 'Hide alerts' : 'Show alerts'}</button>
                </div>
              </div>

              {hasRecentRolls && <RecentRollsStrip encounterId={encounter.id} expanded onToggle={() => toggleBottomStrip('rolls')} />}
              {hasRecentAlerts && <RecentAlertsStrip encounterId={encounter.id} expanded onToggle={() => toggleBottomStrip('alerts')} />}
            </div>

            <DMPlayerCardsSection
              combatants={pcCombatants}
              playerStates={playerStates}
              encounterId={encounter.id}
              playerEditMode={encounter.player_edit_mode}
              onUpdate={refreshAll}
            />
          </div>
        )}

        {tab === 'rolls' && <SecretRollInbox encounterId={encounter.id} />}
        {tab === 'log' && <DMCombatLog encounterId={encounter.id} />}
        {tab === 'manage' && <ManagementScreens onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); setTab('combat'); }} currentEncounter={encounter} displayToken={displayToken} joinCodes={joinCodes} onToggleEditMode={handleToggleEditMode} onGenerateDisplayToken={handleGenerateDisplayToken} onRevokeDisplayToken={handleRevokeDisplayToken} onFrontScreen={handleFrontScreen} onSignOut={signOut} />}
      </div>

      <ShortRestModal open={shortRestOpen} playerStates={playerStates} encounterId={encounter.id} onClose={() => setShortRestOpen(false)} onComplete={refreshAll} />
    </div>
  );
}
