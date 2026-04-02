import React, { useState, useEffect, useCallback } from 'react';
import { supabase, signOut } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import InitiativePanel from '../components/InitiativePanelNext';
import SecretRollInbox from '../components/SecretRollInbox';
import EncounterSetup from '../components/EncounterSetup';
import ManagementScreens from '../components/ManagementScreens';
import ShortRestModal from '../components/ShortRestModal';
import DMNotificationOverlay from '../components/DMNotificationOverlay';
import { readNumberField } from '../utils/classResources';
import { getLongRestResourcePatch } from '../utils/resourcePolicy';
import { flattenStates } from './dm/dmViewUtils';
import RecentAlertsStrip from './dm/RecentAlertsStrip';
import DMCombatLog from './dm/DMCombatLog';
import DMPlayerCardsSection from './dm/DMPlayerCardsSection';

function buildLongRestStatePatch(state = {}) {
  const profile = state?.profiles_players || {};
  const patch = { ...getLongRestResourcePatch(state, profile) };
  const maxHpOverride = readNumberField(state, ['max_hp_override'], null);
  const profileMax = readNumberField(profile, ['max_hp'], 0);
  const maxHp = maxHpOverride !== null ? maxHpOverride : profileMax;

  if (maxHp > 0 && Object.prototype.hasOwnProperty.call(state, 'current_hp')) {
    patch.current_hp = maxHp;
  }

  if (Object.prototype.hasOwnProperty.call(state, 'conditions')) {
    const currentConditions = state.conditions || [];
    patch.conditions = currentConditions.filter(code => code !== 'UNC' && code !== 'PRN');
  }

  if (Object.prototype.hasOwnProperty.call(state, 'concentration')) patch.concentration = false;
  if (Object.prototype.hasOwnProperty.call(state, 'concentration_check_dc')) patch.concentration_check_dc = null;
  if (Object.prototype.hasOwnProperty.call(state, 'concentration_spell_id')) patch.concentration_spell_id = null;
  if (Object.prototype.hasOwnProperty.call(state, 'wildshape_active')) patch.wildshape_active = false;
  if (Object.prototype.hasOwnProperty.call(state, 'wildshape_form_id')) patch.wildshape_form_id = null;
  if (Object.prototype.hasOwnProperty.call(state, 'wildshape_hp_current')) patch.wildshape_hp_current = null;

  for (let level = 1; level <= 9; level += 1) {
    if (Object.prototype.hasOwnProperty.call(state, `slots_used_${level}`)) {
      patch[`slots_used_${level}`] = 0;
    }
  }

  return patch;
}

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
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [recentRollCount, setRecentRollCount] = useState(0);
  const [recentAlertCount, setRecentAlertCount] = useState(0);

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

  const refreshActivityPresence = useCallback(async () => {
    if (!encounterId) return;
    const [rolls, alerts] = await Promise.all([
      supabase.from('secret_rolls').select('id', { count: 'exact', head: true }).eq('encounter_id', encounterId),
      supabase.from('concentration_checks').select('id', { count: 'exact', head: true }).eq('encounter_id', encounterId).eq('result', 'pending'),
    ]);
    setRecentRollCount(rolls.count || 0);
    setRecentAlertCount(alerts.count || 0);
  }, [encounterId]);

  usePolling(refreshAll, 2000, !!encounterId);
  usePolling(refreshActivityPresence, 3000, !!encounterId);

  useEffect(() => {
    if (encounterId) {
      refreshAll();
      refreshActivityPresence();
    }
  }, [encounterId, refreshAll, refreshActivityPresence]);

  async function handleNextTurn() {
    if (!encounter) return;
    await supabase.rpc('advance_turn', { p_encounter_id: encounter.id });
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

    const { data: latestStates, error: latestStatesError } = await supabase
      .from('player_encounter_state')
      .select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)')
      .eq('encounter_id', encounter.id);

    if (latestStatesError) return;

    const states = flattenStates(latestStates || []);
    const updateResults = await Promise.all(
      states.map(async state => {
        const patch = buildLongRestStatePatch(state);
        return supabase.from('player_encounter_state').update(patch).eq('id', state.id);
      })
    );

    const failedUpdate = updateResults.find(result => result.error);
    if (failedUpdate?.error) return;

    await supabase.from('concentration_checks').update({ result: 'cleared' }).eq('encounter_id', encounter.id).eq('result', 'pending');
    await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id);
    await supabase.from('combat_log').insert({ encounter_id: encounter.id, actor: 'DM', action: 'rest', detail: 'Long Rest completed — HP, spell slots, concentration, and Wild Shape reset' });
    await refreshAll();
    await refreshActivityPresence();
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

  if (loading) return <div className="splash"><div className="splash-text">Loading…</div></div>;

  if (!encounter) {
    return (
      <div className="app-shell">
        <div className="shell-nav-stack">
          <div className="top-bar"><div className="top-bar-spacer" /></div>
        </div>
        <div className="main-content dm-main-content">
          <EncounterSetup onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); setTab('combat'); }} />
          <ManagementScreens currentEncounter={null} displayToken={null} joinCodes={[]} onGenerateDisplayToken={null} onRevokeDisplayToken={null} onFrontScreen={null} onSignOut={signOut} />
        </div>
      </div>
    );
  }

  const pcCombatants = combatants.filter(c => c.side === 'PC');
  const pendingAlertCount = playerStates.filter(s => s.concentration_check_dc != null).length;
  const activityCount = recentRollCount + recentAlertCount + pendingAlertCount;

  return (
    <div className="app-shell">
      <div className="shell-nav-stack">
        <div className="top-bar"><div className="top-bar-spacer" /></div>
        <div className="tab-bar dm-tab-bar-bottom-adjusted">
          <button className={`tab-btn ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>⚔ Combat</button>
          <button className={`tab-btn ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>🧙 Players</button>
          <button className={`tab-btn ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>📋 Activity{activityCount > 0 ? <span className="tab-badge">{activityCount}</span> : ''}</button>
          <button className={`tab-btn ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>⚙ Manage</button>
        </div>
      </div>

      <DMNotificationOverlay encounterId={encounter.id} />

      <div className="main-content dm-main-content main-content--with-bottom-dock">
        {tab === 'combat' && (
          <div className="dm-combat-layout">
            <div className="dm-initiative-column">
              <div className="initiative-top-bar">
                <div className="initiative-top-bar-primary">Round {encounter.round}</div>
              </div>
              <InitiativePanel encounter={encounter} combatants={combatants} playerStates={playerStates} role="dm" onUpdate={refreshAll} />
            </div>
          </div>
        )}

        {tab === 'players' && (
          <DMPlayerCardsSection
            combatants={pcCombatants}
            playerStates={playerStates}
            encounterId={encounter.id}
            playerEditMode={encounter.player_edit_mode}
            onUpdate={refreshAll}
            title="Players"
            subtitle={`${pcCombatants.length} player${pcCombatants.length === 1 ? '' : 's'} in encounter`}
          />
        )}

        {tab === 'activity' && (
          <div className="dm-activity-layout">
            <div className="dm-activity-primary">
              <RecentAlertsStrip encounterId={encounter.id} mode="panel" />
              <SecretRollInbox encounterId={encounter.id} />
            </div>
            <div className="dm-activity-secondary">
              <DMCombatLog encounterId={encounter.id} />
            </div>
          </div>
        )}

        {tab === 'manage' && <ManagementScreens onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); setTab('combat'); }} currentEncounter={encounter} displayToken={displayToken} joinCodes={joinCodes} onGenerateDisplayToken={handleGenerateDisplayToken} onRevokeDisplayToken={handleRevokeDisplayToken} onFrontScreen={handleFrontScreen} onSignOut={signOut} />}
      </div>

      <div className="dm-bottom-action-bar">
        <div className="dm-bottom-action-row">
          <button className="btn btn-ghost" onClick={handleLongRest}>Long Rest</button>
          <button className="btn btn-ghost" onClick={() => setShortRestOpen(true)}>Short Rest</button>
          <button className="btn btn-ghost" onClick={handleRollEnemyInitiative} disabled={rollingInit}>{rollingInit ? 'Rolling…' : 'Initiative'}</button>
          <button className="btn btn-primary dm-bottom-action-next" onClick={handleNextTurn}>▶ Next</button>
        </div>
      </div>

      <ShortRestModal open={shortRestOpen} playerStates={playerStates} encounterId={encounter.id} onClose={() => setShortRestOpen(false)} onComplete={refreshAll} />
    </div>
  );
}
