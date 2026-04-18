import React, { useState, useEffect, useCallback } from 'react';
import { supabase, clearPlayerSession } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanelNext';
import SecretRollPanel from '../components/SecretRollPanel';
import SpellWorkflowPanel from '../components/SpellWorkflowPanel';
import SkillsModal from '../components/SkillsModal';
import { flattenStates } from './player/playerViewUtils';
import PlayerConCheckLog from './player/PlayerConCheckLog';
import { hasPreparationRequirement } from '../utils/spellWorkflow';
import IncomingTransferPopup from '../inventory/IncomingTransferPopup';
import { inventoryGetPendingIncoming, inventoryRespondTransfer } from '../inventory/inventoryClient';
import PlayerWorldPanel from './player/PlayerWorldPanel';
import ShortRestResponsePanel from '../components/ShortRestResponsePanel';
import InventoryModal from '../inventory/InventoryModal';
import {
  getSharedSongOfRestTotal,
} from '../utils/shortRestWorkflow';

export default function PlayerView() {
  const [encounter, setEncounter] = useState(null);
  const [combatant, setCombatant] = useState(null);
  const [state, setState] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initiativeInput, setInitiativeInput] = useState('');
  const [initError, setInitError] = useState(null);
  const [initSuccess, setInitSuccess] = useState(false);
  const [topTab, setTopTab] = useState('char');
  const [charTab, setCharTab] = useState('sheet');
  const [showConPanel, setShowConPanel] = useState(false);
  const [pendingIncoming, setPendingIncoming] = useState([]);
  const [dismissedTransferIds, setDismissedTransferIds] = useState(() => new Set());
  const [shortRestActive, setShortRestActive] = useState(false);
  const [shortRestResponsesByStateId, setShortRestResponsesByStateId] = useState({});
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [longRestItemsOpen, setLongRestItemsOpen] = useState(false);
  const [lastSeenShortRestStartAt, setLastSeenShortRestStartAt] = useState(null);
  const profileId = localStorage.getItem('player_profile_id');
  const encounterId = localStorage.getItem('player_encounter_id');

  const refreshAll = useCallback(async () => {
    if (!encounterId || !profileId) return;
    try {
      const [enc, combs, allStates] = await Promise.all([
        supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
        supabase.from('combatants').select('*').eq('encounter_id', encounterId).order('initiative_total', { ascending: false }),
        supabase.from('player_encounter_state').select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)').eq('encounter_id', encounterId),
      ]);
      if (enc.data) setEncounter(enc.data);
      const all = combs.data || [];
      setCombatants(all);
      const flat = flattenStates(allStates.data);
      setPlayerStates(flat);
      const mine = all.find(c => c.owner_player_id === profileId);
      setCombatant(mine || null);
      const myState = flat.find(s => s.player_profile_id === profileId);
      if (myState) setState(myState);
      const shortRestIsActive = !!enc.data?.short_rest_active;
      const shortRestStartedAt = enc.data?.short_rest_started_at || null;
      setShortRestActive(shortRestIsActive);
      if (shortRestIsActive && shortRestStartedAt && shortRestStartedAt !== lastSeenShortRestStartAt) {
        setShortRestOpen(true);
        setLastSeenShortRestStartAt(shortRestStartedAt);
        setShortRestResponsesByStateId({});
      }
      if (!shortRestIsActive) {
        setLastSeenShortRestStartAt(null);
        setShortRestResponsesByStateId({});
      }
    } catch (err) {
      setError(err.message);
    }
  }, [encounterId, lastSeenShortRestStartAt, profileId]);

  const refreshPendingIncoming = useCallback(async () => {
    if (!profileId || !localStorage.getItem('player_join_code')) return;
    try {
      const rows = await inventoryGetPendingIncoming({ playerProfileId: profileId, joinCode: localStorage.getItem('player_join_code') });
      setPendingIncoming(rows || []);
    } catch (_err) {
      setPendingIncoming([]);
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !encounterId) {
      setError('Session not found. Please re-enter your join code.');
      setLoading(false);
      return;
    }
    refreshAll().then(() => setLoading(false));
    refreshPendingIncoming();
  }, [refreshAll, refreshPendingIncoming, profileId, encounterId]);

  usePolling(refreshAll, 2000, !!encounterId);
  usePolling(refreshPendingIncoming, 2500, !!profileId);

  async function handleSubmitInitiative() {
    if (!combatant || !initiativeInput) return;
    const total = parseInt(initiativeInput, 10);
    if (isNaN(total)) return;
    setInitError(null);
    setInitSuccess(false);
    try {
      const { error } = await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: total });
      if (error) throw error;
      setInitSuccess(true);
      setTimeout(() => setInitSuccess(false), 2000);
      refreshAll();
    } catch (err) {
      setInitError(err.message);
    }
  }

  function handleLeave() {
    clearPlayerSession();
    window.location.reload();
  }

  const concentration = state?.concentration ?? false;
  const pendingConDc = concentration ? (state?.concentration_check_dc ?? null) : null;
  const playerName = state?.profiles_players?.name || combatant?.name || null;
  const prepRequired = hasPreparationRequirement(state?.profiles_players || {});
  const prepActive = !!encounter?.long_rest_prep_active;
  const prepReady = !!state?.spell_prep_ready;
  const showPrepModal = prepActive && prepRequired && !prepReady && !!state?.profiles_players;
  const sharedSongOfRestTotal = getSharedSongOfRestTotal({ playerStates, responsesByStateId: shortRestResponsesByStateId });

  useEffect(() => {
    if (pendingConDc === null) setShowConPanel(false);
  }, [pendingConDc]);

  async function handleConPass() {
    if (!state) return;
    if (playerName) {
      const { data: checks } = await supabase.from('concentration_checks').select('id').eq('encounter_id', encounterId).eq('player_name', playerName).eq('result', 'pending').order('created_at', { ascending: false }).limit(1);
      if (checks && checks.length > 0) await supabase.from('concentration_checks').update({ result: 'passed' }).eq('id', checks[0].id);
    }
    await supabase.from('player_encounter_state').update({ concentration_check_dc: null }).eq('id', state.id);
    refreshAll();
  }

  async function handleConFail() {
    if (!state) return;
    if (playerName) {
      const { data: checks } = await supabase.from('concentration_checks').select('id').eq('encounter_id', encounterId).eq('player_name', playerName).eq('result', 'pending').order('created_at', { ascending: false }).limit(1);
      if (checks && checks.length > 0) await supabase.from('concentration_checks').update({ result: 'failed' }).eq('id', checks[0].id);
    }
    await supabase.from('player_encounter_state').update({ concentration_check_dc: null, concentration: false, concentration_spell_id: null }).eq('id', state.id);
    refreshAll();
  }

  async function markPrepReady() {
    if (!state?.id) return;
    await supabase.from('player_encounter_state').update({ spell_prep_ready: true }).eq('id', state.id);
    refreshAll();
  }

  async function markPrepDirty() {
    if (!state?.id) return;
    await supabase.from('player_encounter_state').update({ spell_prep_ready: false }).eq('id', state.id);
    refreshAll();
  }


  async function respondToTransfer(transferId, accept) {
    await inventoryRespondTransfer({
      transferId,
      receiverProfileId: profileId,
      accept,
      joinCode: localStorage.getItem('player_join_code'),
    });
    setDismissedTransferIds((curr) => new Set([...curr, transferId]));
    await refreshPendingIncoming();
    await refreshAll();
  }

  const activeIncoming = pendingIncoming.find((row) => !dismissedTransferIds.has(row.id)) || null;
  if (loading) return <div className="splash"><div className="splash-text">Joining session...</div></div>;
  if (error) return <div className="splash"><div className="splash-text">Warning: {error}</div><button className="btn btn-ghost" onClick={handleLeave}>Back to Join Screen</button></div>;

  return (
    <div className="app-shell">
      <div className="shell-nav-stack">
        <div className="top-bar"><div className="top-bar-spacer" /></div>
        <div className="tab-bar">
          <button className={`tab-btn ${topTab === 'char' ? 'active' : ''}`} onClick={() => setTopTab('char')}>Char</button>
          <button className={`tab-btn ${topTab === 'combat' ? 'active' : ''}`} onClick={() => setTopTab('combat')}>Combat</button>
          <button className={`tab-btn ${topTab === 'rolls' ? 'active' : ''}`} onClick={() => setTopTab('rolls')}>Rolls</button>
          <button className={`tab-btn ${topTab === 'world' ? 'active' : ''}`} onClick={() => setTopTab('world')}>World</button>
        </div>
        {topTab === 'char' && (
          <div className="tab-bar tab-bar-subnav">
            <button className={`tab-btn ${charTab === 'sheet' ? 'active' : ''}`} onClick={() => setCharTab('sheet')}>Sheet</button>
            <button className={`tab-btn ${charTab === 'skills' ? 'active' : ''}`} onClick={() => setCharTab('skills')}>Skills</button>
            <button className={`tab-btn ${charTab === 'spells' ? 'active' : ''}`} onClick={() => setCharTab('spells')}>Spells</button>
          </div>
        )}
      </div>

      {shortRestActive && state && (
        <div style={{ background: 'rgba(74,158,255,0.10)', borderBottom: '1.5px solid var(--accent-blue)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: shortRestResponsesByStateId[state.id]?.response?.ready ? 'var(--accent-green)' : 'var(--accent-blue)' }}>
            {shortRestResponsesByStateId[state.id]?.response?.ready ? 'Short rest response submitted. Waiting for DM confirmation.' : 'Short rest in progress — submit your healing response.'}
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setShortRestOpen(true)}>{shortRestResponsesByStateId[state.id]?.response?.ready ? 'Review' : 'Open'}</button>
        </div>
      )}

      {prepActive && prepRequired && !showPrepModal && (
        <div style={{ background: 'rgba(74,158,255,0.10)', borderBottom: '1.5px solid var(--accent-blue)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: prepReady ? 'var(--accent-green)' : 'var(--accent-blue)' }}>
            {prepReady ? 'Long rest spell prep complete. Waiting for DM to finish the long rest.' : 'Long rest spell prep required.'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {!prepReady && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setTopTab('char'); setCharTab('spells'); }}>Open Spells</button>}
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setLongRestItemsOpen(true)}>Open Items</button>
          </div>
        </div>
      )}

      {pendingConDc !== null && (
        <div style={{ background: 'rgba(240,180,41,0.12)', borderBottom: '1.5px solid var(--accent-gold)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }} onClick={() => setShowConPanel(true)}><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)' }}>CON Save Required - DC {pendingConDc}</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tap to confirm</span></div>
      )}

      <div className="main-content">
        {showConPanel && pendingConDc !== null && <PlayerConCheckLog encounterId={encounterId} playerName={playerName} pendingDc={pendingConDc} onPass={handleConPass} onFail={handleConFail} />}
        {topTab === 'char' && charTab === 'sheet' && combatant && state && <PlayerCard combatant={combatant} state={state} role="player" isEditMode={encounter?.player_edit_mode} encounterId={encounterId} onUpdate={refreshAll} attunementRestContext={shortRestActive || prepActive} longRestRechargeContext={prepActive} />}
        {topTab === 'char' && charTab === 'skills' && state?.profiles_players && <SkillsModal variant="panel" profile={state.profiles_players} title="Skills" />}
        {topTab === 'char' && charTab === 'spells' && state?.profiles_players && <SpellWorkflowPanel profile={state.profiles_players} state={state} encounterId={encounterId} onUpdate={refreshAll} role="player" mode="runtime" />}
        {topTab === 'combat' && (
          <>
            <div className="initiative-top-bar">
              <div className="initiative-top-bar-primary">Round {encounter?.round || 1}</div>
            </div>
            {combatant && <div className="panel"><div className="panel-title">Initiative</div><div className="form-row"><input className="form-input" type="number" inputMode="numeric" value={initiativeInput} onChange={e => setInitiativeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitInitiative()} style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, width: 140, textAlign: 'center' }} /><button className={`btn ${initSuccess ? 'btn-success' : 'btn-primary'}`} onClick={handleSubmitInitiative} disabled={!initiativeInput}>{initSuccess ? 'Set' : 'Set Initiative'}</button></div>{initError && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 4 }}>{initError}</div>}</div>}
            <InitiativePanel encounter={encounter} combatants={combatants} playerStates={playerStates} role="player" myCombatantId={combatant?.id} onUpdate={refreshAll} />
          </>
        )}
        {topTab === 'rolls' && combatant && <SecretRollPanel playerId={profileId} encounterId={encounterId} />}
        {topTab === 'world' && <PlayerWorldPanel />}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}><button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={handleLeave}>Leave Session</button></div>

      <IncomingTransferPopup transfer={activeIncoming} onAccept={() => respondToTransfer(activeIncoming.id, true)} onDecline={() => respondToTransfer(activeIncoming.id, false)} />

      <ShortRestResponsePanel
        open={shortRestOpen}
        encounterId={encounterId}
        state={state}
        playerStates={playerStates}
        initialResponse={shortRestResponsesByStateId[state?.id]?.response}
        sharedSongOfRestTotal={sharedSongOfRestTotal}
        onClose={() => setShortRestOpen(false)}
        onSubmitted={(response) => {
          if (!state?.id) return;
          setShortRestResponsesByStateId((curr) => ({ ...curr, [state.id]: { response } }));
          refreshAll();
        }}
      />

      {showPrepModal && (
        <SpellWorkflowPanel
          variant="modal"
          mode="prep"
          role="player"
          profile={state.profiles_players}
          state={state}
          encounterId={encounterId}
          onUpdate={refreshAll}
          prepReady={prepReady}
          onMarkReady={markPrepReady}
          onPrepChanged={markPrepDirty}
          title="Long Rest Preparation"
          subtitle="Choose your prepared spells, inspect details if needed, then mark ready. Use Open Items in the long-rest banner for attunement/recharge updates."
        />
      )}

      {prepActive && state && longRestItemsOpen && (
        <InventoryModal
          open={longRestItemsOpen}
          onClose={() => setLongRestItemsOpen(false)}
          role="player"
          playerProfileId={state.player_profile_id}
          playerName={state?.profiles_players?.name || combatant?.name || 'Player'}
          joinCode={localStorage.getItem('player_join_code')}
          senderProfileId={state.player_profile_id}
          attunementRestContext
          allowChargeRecharge
        />
      )}
    </div>
  );
}
