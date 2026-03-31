import React, { useState, useEffect, useCallback } from 'react';
import { supabase, signOut } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';
import SecretRollInbox from '../components/SecretRollInbox';
import EncounterSetup from '../components/EncounterSetup';
import ManagementScreens from '../components/ManagementScreens';
import ShortRestModal from '../components/ShortRestModal';

function flattenStates(data) {
  return (data || []).map(s => ({ ...s, wildshape_form_name: s.profiles_wildshape?.form_name ?? null, wildshape_hp_max: s.profiles_wildshape?.hp_max ?? null }));
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function RecentRollsStrip({ encounterId, expanded, onToggle }) {
  const [rolls, setRolls] = useState([]);
  const load = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase.from('secret_rolls').select('*, profiles_players(name)').eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(3);
    setRolls(data || []);
  }, [encounterId]);
  usePolling(load, 2000, !!encounterId);
  const latest = rolls[0];
  if (!latest) return null;
  return <button type="button" className={`dm-bottom-strip ${expanded ? 'expanded' : ''}`} onClick={onToggle} aria-expanded={expanded}><div className="dm-bottom-strip-header"><span className="dm-bottom-strip-title">Recent Secret Rolls</span><span className="dm-bottom-strip-toggle">{expanded ? 'Hide' : 'Show'}</span></div>{!expanded && <div className="dm-bottom-strip-summary"><span className="dm-bottom-strip-summary-name">{latest.profiles_players?.name || 'Unknown'}</span><span className="dm-bottom-strip-summary-meta">{latest.skill}</span><span className="dm-bottom-strip-summary-meta">{formatTime(latest.created_at)}</span><span className="dm-bottom-strip-summary-value">{latest.total}</span></div>}{expanded && <div className="dm-bottom-strip-body"><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{rolls.map(r => <div key={r.id} className="dm-bottom-strip-row"><div className="dm-bottom-strip-row-left"><span className="dm-bottom-strip-row-name">{r.profiles_players?.name || 'Unknown'}</span><span className="dm-bottom-strip-row-meta" style={{ color: 'var(--accent-gold)', textTransform: 'capitalize' }}>{r.skill}</span><span className="dm-bottom-strip-row-meta">{formatTime(r.created_at)}</span></div><div className="dm-bottom-strip-row-right"><span className="dm-bottom-strip-row-value">{r.total}</span><span className="dm-bottom-strip-row-breakdown">({r.d20_roll}+{r.skill_bonus})</span></div></div>)}</div></div>}</button>;
}

function RecentAlertsStrip({ encounterId, expanded, onToggle }) {
  const [checks, setChecks] = useState([]);
  const load = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase.from('concentration_checks').select('*').eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(5);
    setChecks((data || []).filter(item => item.result === 'pending' || item.result === 'failed'));
  }, [encounterId]);
  usePolling(load, 2000, !!encounterId);
  function resultStyle(result) { if (result === 'passed') return { color: 'var(--accent-green)', label: '✅ Passed' }; if (result === 'failed') return { color: 'var(--accent-red)', label: '❌ Failed' }; return { color: 'var(--accent-gold)', label: '⏳ Pending' }; }
  const latest = checks[0];
  const latestResult = latest ? resultStyle(latest.result) : null;
  if (!latest) return null;
  return <button type="button" className={`dm-bottom-strip ${expanded ? 'expanded' : ''}`} onClick={onToggle} aria-expanded={expanded}><div className="dm-bottom-strip-header"><span className="dm-bottom-strip-title">Recent Alerts</span><span className="dm-bottom-strip-toggle">{expanded ? 'Hide' : 'Show'}</span></div>{!expanded && <div className="dm-bottom-strip-summary"><span className="dm-bottom-strip-summary-name">{latest.player_name}</span><span className="dm-bottom-strip-summary-meta">DC {latest.dc}</span><span className="dm-bottom-strip-summary-meta">{formatTime(latest.created_at)}</span><span className="dm-bottom-strip-summary-status" style={{ color: latestResult.color }}>{latestResult.label}</span></div>}{expanded && <div className="dm-bottom-strip-body"><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{checks.map(c => { const { color, label } = resultStyle(c.result); return <div key={c.id} className="dm-bottom-strip-row"><div className="dm-bottom-strip-row-left"><span className="dm-bottom-strip-row-name">{c.player_name}</span><span className="dm-bottom-strip-row-meta">DC {c.dc}</span><span className="dm-bottom-strip-row-meta">{formatTime(c.created_at)}</span></div><div className="dm-bottom-strip-row-right"><span className="dm-bottom-strip-row-status" style={{ color }}>{label}</span></div></div>; })}</div></div>}</button>;
}

function CombatLog({ encounterId }) {
  const [logSection, setLogSection] = useState('combat');
  const [combatEntries, setCombatEntries] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadingCombat, setLoadingCombat] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const loadCombat = useCallback(async () => { if (!encounterId) return; const { data } = await supabase.from('combat_log').select('*').eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(100); setCombatEntries(data || []); setLoadingCombat(false); }, [encounterId]);
  const loadAlerts = useCallback(async () => { if (!encounterId) return; const { data } = await supabase.from('concentration_checks').select('*').eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(50); setAlerts(data || []); setLoadingAlerts(false); }, [encounterId]);
  usePolling(loadCombat, 3000, !!encounterId && logSection === 'combat');
  usePolling(loadAlerts, 3000, !!encounterId && logSection === 'alerts');
  function timeLabel(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function actionClass(action) { if (action === 'damage') return 'log-item--dmg'; if (action === 'heal') return 'log-item--heal'; if (action === 'remove') return 'log-item--remove'; if (action === 'turn') return 'log-item--turn'; if (action === 'con') return 'log-item--con'; if (action === 'rest') return 'log-item--heal'; return ''; }
  function resultLabel(r) { if (r === 'pending') return { text: '⏳ Pending', cls: 'con-log-result-badge--pending' }; if (r === 'passed') return { text: '✅ Passed', cls: 'con-log-result-badge--passed' }; if (r === 'failed') return { text: '❌ Failed', cls: 'con-log-result-badge--failed' }; return { text: r, cls: '' }; }
  const pendingAlertCount = alerts.filter(c => c.result === 'pending').length;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><div style={{ display: 'flex', gap: 6 }}><button className="btn btn-ghost" style={{ flex: 1, borderColor: logSection === 'combat' ? 'var(--accent-blue)' : 'var(--border)', color: logSection === 'combat' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => { setLogSection('combat'); loadCombat(); }}>⚔ Events</button><button className="btn btn-ghost" style={{ flex: 1, borderColor: logSection === 'alerts' ? 'var(--accent-gold)' : 'var(--border)', color: logSection === 'alerts' ? 'var(--accent-gold)' : 'var(--text-secondary)' }} onClick={() => { setLogSection('alerts'); loadAlerts(); }}>⚠ Alerts {pendingAlertCount > 0 && <span className="tab-badge">{pendingAlertCount}</span>}</button></div>{logSection === 'combat' && <div className="panel"><div className="panel-title">Combat Events</div>{loadingCombat && <div className="empty-state">Loading…</div>}{!loadingCombat && combatEntries.length === 0 && <div className="empty-state">No events logged yet.</div>}<div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: '60vh', overflowY: 'auto' }}>{combatEntries.map(e => <div key={e.id} className={`log-item ${actionClass(e.action)}`}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="log-item-action">{e.detail || e.action}</span><span className="log-item-meta" style={{ flexShrink: 0, marginLeft: 8 }}>{timeLabel(e.created_at)}</span></div>{e.actor && <span className="log-item-meta">by {e.actor}</span>}</div>)}</div></div>}{logSection === 'alerts' && <div className="panel"><div className="panel-title">Alerts</div>{loadingAlerts && <div className="empty-state">Loading…</div>}{!loadingAlerts && alerts.length === 0 && <div className="empty-state">No alerts this encounter.</div>}<div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>{alerts.map(c => { const { text, cls } = resultLabel(c.result); return <div key={c.id} className={`con-log-item con-log-item--${c.result}`}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{c.player_name}</span><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>DC {c.dc}</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeLabel(c.created_at)}</span></div><span className={`con-log-result-badge ${cls}`}>{text}</span></div>; })}</div></div>}</div>;
}

function PlayerCardsSection({ combatants, playerStates, encounterId, playerEditMode, onUpdate }) { return <div className="panel"><div className="panel-title">Party Status</div><div className="dm-player-card-stack">{combatants.length === 0 && <div className="empty-state">No players in encounter.</div>}{combatants.map(c => { const s = playerStates.find(ps => ps.combatant_id === c.id); return <PlayerCard key={c.id} combatant={c} state={s} role="dm" isEditMode={playerEditMode} encounterId={encounterId} onUpdate={onUpdate} />; })}</div></div>; }

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

  useEffect(() => { loadLatestEncounter(); }, []);
  async function loadLatestEncounter() { setLoading(true); const { data } = await supabase.from('encounters').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(); if (data) { setEncounter(data); setEncounterId(data.id); } setLoading(false); }
  const refreshAll = useCallback(async () => { if (!encounterId) return; const [enc, comb, states, token, codes] = await Promise.all([supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(), supabase.from('combatants').select('*').eq('encounter_id', encounterId).order('initiative_total', { ascending: false, nullsFirst: false }), supabase.from('player_encounter_state').select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)').eq('encounter_id', encounterId), supabase.from('display_sessions').select('token').eq('encounter_id', encounterId).maybeSingle(), supabase.from('player_sessions').select('join_code, profiles_players(name)').eq('encounter_id', encounterId)]); if (enc.data) setEncounter(enc.data); setCombatants(comb.data || []); setPlayerStates(flattenStates(states.data)); setDisplayToken(token.data?.token || null); setJoinCodes(codes.data || []); }, [encounterId]);
  usePolling(refreshAll, 2000, !!encounterId);
  useEffect(() => { if (encounterId) refreshAll(); }, [encounterId, refreshAll]);
  useEffect(() => { if (tab !== 'combat' && openBottomStrip !== null) setOpenBottomStrip(null); }, [tab, openBottomStrip]);
  async function handleNextTurn() { if (!encounter) return; await supabase.rpc('advance_turn', { p_encounter_id: encounter.id }); refreshAll(); }
  async function handleToggleEditMode() { if (!encounter) return; await supabase.from('encounters').update({ player_edit_mode: !encounter.player_edit_mode }).eq('id', encounter.id); refreshAll(); }
  async function handleGenerateDisplayToken() { if (!encounter) return; await supabase.rpc('generate_display_token', { p_encounter_id: encounter.id }); refreshAll(); }
  async function handleRevokeDisplayToken() { if (!encounter) return; await supabase.from('display_sessions').delete().eq('encounter_id', encounter.id); setDisplayToken(null); }
  async function clearInitiativeTracking() { if (!encounter) return; await supabase.from('combatants').update({ initiative_total: null }).eq('encounter_id', encounter.id); await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id); }
  async function handleLongRest() { if (!encounter) return; if (!window.confirm('Long Rest — restore all player HP, spell slots, wild shape uses, and clear initiative?')) return; await supabase.rpc('long_rest', { p_encounter_id: encounter.id }); await clearInitiativeTracking(); refreshAll(); }
  async function handleShortRestComplete() { await clearInitiativeTracking(); refreshAll(); }
  async function handleRollEnemyInitiative() { if (!encounter) return; const targets = combatants.filter(c => c.side !== 'PC' && c.initiative_total == null); if (targets.length === 0) { const reroll = combatants.filter(c => c.side !== 'PC'); if (!window.confirm('All enemies already have initiative. Reroll everyone and reset round to 1?')) return; setRollingInit(true); await Promise.all(reroll.map(c => { const roll = Math.floor(Math.random() * 20) + 1 + (c.initiative_mod ?? 0); return supabase.rpc('set_initiative', { p_combatant_id: c.id, p_total: roll }); })); await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id); setRollingInit(false); refreshAll(); return; } setRollingInit(true); await Promise.all(targets.map(c => { const roll = Math.floor(Math.random() * 20) + 1 + (c.initiative_mod ?? 0); return supabase.rpc('set_initiative', { p_combatant_id: c.id, p_total: roll }); })); await supabase.from('encounters').update({ round: 1, turn_index: 0 }).eq('id', encounter.id); setRollingInit(false); refreshAll(); }
  function handleFrontScreen() { setEncounter(null); setEncounterId(null); setCombatants([]); setPlayerStates([]); setDisplayToken(null); setJoinCodes([]); setTab('manage'); }
  function toggleBottomStrip(name) { setOpenBottomStrip(current => current === name ? null : name); }
  if (loading) return <div className="splash"><div className="splash-text">Loading…</div></div>;
  if (!encounter) return <div className="app-shell"><div className="top-bar"><span className="top-bar-title">DM Dashboard</span></div><div className="main-content"><EncounterSetup onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); setTab('combat'); }} /><ManagementScreens currentEncounter={null} displayToken={null} joinCodes={[]} onToggleEditMode={null} onGenerateDisplayToken={null} onRevokeDisplayToken={null} onFrontScreen={null} onSignOut={signOut} /></div></div>;
  const pcCombatants = combatants.filter(c => c.side === 'PC');
  const nonPcCount = combatants.filter(c => c.side !== 'PC').length;
  const pendingAlertCount = playerStates.filter(s => s.concentration_check_dc != null).length;
  const combatContentClass = tab === 'combat' ? 'main-content main-content--with-bottom-dock' : 'main-content';
  return <div className="app-shell"><div className="top-bar top-bar--dm-actions"><div className="dm-action-round">Round {encounter.round}</div><div className="dm-action-button-row"><button className="btn btn-primary" onClick={handleNextTurn}>▶ Next</button><button className="btn btn-ghost" onClick={handleRollEnemyInitiative} disabled={rollingInit}>{rollingInit ? 'Rolling…' : 'Initiative'}</button><button className="btn btn-ghost" onClick={() => setShortRestOpen(true)}>Short Rest</button><button className="btn btn-ghost" onClick={handleLongRest}>Long Rest</button></div></div><div className="tab-bar"><button className={`tab-btn ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>⚔ Combat</button><button className={`tab-btn ${tab === 'rolls' ? 'active' : ''}`} onClick={() => setTab('rolls')}>🎲 Rolls</button><button className={`tab-btn ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>📋 Log{pendingAlertCount > 0 ? <span className="tab-badge">{pendingAlertCount}</span> : ''}</button><button className={`tab-btn ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>⚙ Manage</button></div><div className={combatContentClass}>{tab === 'combat' && <><div className="dm-combat-layout"><div className="dm-initiative-column"><InitiativePanel encounter={encounter} combatants={combatants} playerStates={playerStates} role="dm" onUpdate={refreshAll} /><div className="panel"><div className="panel-title">Live Session</div><div className="dm-live-session-actions">{nonPcCount > 0 && <button className="btn btn-ghost" onClick={handleRollEnemyInitiative} disabled={rollingInit}>{rollingInit ? 'Rolling…' : 'Roll Enemy Initiative'}</button>}<button className="btn btn-ghost" onClick={() => setShortRestOpen(true)}>Open Short Rest</button><button className="btn btn-ghost" onClick={() => setTab('manage')}>Open Manage</button></div></div></div><PlayerCardsSection combatants={pcCombatants} playerStates={playerStates} encounterId={encounter.id} playerEditMode={encounter.player_edit_mode} onUpdate={refreshAll} /></div><div className="dm-bottom-dock"><RecentRollsStrip encounterId={encounter.id} expanded={openBottomStrip === 'rolls'} onToggle={() => toggleBottomStrip('rolls')} /><RecentAlertsStrip encounterId={encounter.id} expanded={openBottomStrip === 'alerts'} onToggle={() => toggleBottomStrip('alerts')} /></div></>}{tab === 'rolls' && <SecretRollInbox encounterId={encounter.id} />}{tab === 'log' && <CombatLog encounterId={encounter.id} />}{tab === 'manage' && <ManagementScreens onEncounterCreated={enc => { setEncounter(enc); setEncounterId(enc.id); setTab('combat'); }} currentEncounter={encounter} displayToken={displayToken} joinCodes={joinCodes} onToggleEditMode={handleToggleEditMode} onGenerateDisplayToken={handleGenerateDisplayToken} onRevokeDisplayToken={handleRevokeDisplayToken} onFrontScreen={handleFrontScreen} onSignOut={signOut} />}</div><ShortRestModal open={shortRestOpen} playerStates={playerStates} encounterId={encounter.id} onClose={() => setShortRestOpen(false)} onComplete={handleShortRestComplete} /></div>;
}
