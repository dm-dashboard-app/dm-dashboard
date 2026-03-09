import React, { useState, useEffect, useCallback } from 'react';
import { supabase, clearPlayerSession } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';
import SecretRollPanel from '../components/SecretRollPanel';

function flattenStates(data) {
  return (data || []).map(s => ({
    ...s,
    wildshape_form_name: s.profiles_wildshape?.form_name ?? null,
    wildshape_hp_max: s.profiles_wildshape?.hp_max ?? null,
  }));
}

// ============================================================
// CON CHECK LOG — shows this player's concentration check history
// ============================================================
function ConCheckLog({ encounterId, playerName, pendingDc, onPass, onFail }) {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!encounterId || !playerName) return;
    const { data } = await supabase
      .from('concentration_checks')
      .select('*')
      .eq('encounter_id', encounterId)
      .eq('player_name', playerName)
      .order('created_at', { ascending: false })
      .limit(20);
    setChecks(data || []);
    setLoading(false);
  }, [encounterId, playerName]);

  usePolling(load, 3000, !!encounterId && !!playerName);

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function resultLabel(r) {
    if (r === 'pending') return { text: 'Pending', cls: 'con-log-result-badge--pending' };
    if (r === 'passed')  return { text: 'Passed',  cls: 'con-log-result-badge--passed' };
    if (r === 'failed')  return { text: 'Failed',  cls: 'con-log-result-badge--failed' };
    return { text: r, cls: '' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Active pending check — confirm buttons */}
      {pendingDc !== null && (
        <div className="panel" style={{ border: '1.5px solid var(--accent-gold)' }}>
          <div className="panel-title" style={{ color: 'var(--accent-gold)' }}>🔮 Concentration Check Required</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You took damage while concentrating</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Roll a CON saving throw</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DC</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-gold)', lineHeight: 1 }}>{pendingDc}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="con-check-pass" onClick={onPass} style={{ flex: 1, padding: '10px 0', fontSize: 15 }}>
              ✅ Passed — keep concentration
            </button>
            <button className="con-check-fail" onClick={onFail} style={{ flex: 1, padding: '10px 0', fontSize: 15 }}>
              ❌ Failed — lose concentration
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="panel">
        <div className="panel-title">Concentration Check History</div>
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && checks.length === 0 && (
          <div className="empty-state">No concentration checks this session.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checks.map(c => {
            const { text, cls } = resultLabel(c.result);
            const itemCls = `con-log-item con-log-item--${c.result}`;
            return (
              <div key={c.id} className={itemCls}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>DC {c.dc}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeLabel(c.created_at)}</span>
                </div>
                <span className={`con-log-result-badge ${cls}`}>{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PLAYER VIEW
// ============================================================
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
  const [tab, setTab] = useState('char');

  const profileId = localStorage.getItem('player_profile_id');
  const encounterId = localStorage.getItem('player_encounter_id');

  const refreshAll = useCallback(async () => {
    if (!encounterId || !profileId) return;
    try {
      const [enc, combs, allStates] = await Promise.all([
        supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
        supabase.from('combatants').select('*').eq('encounter_id', encounterId).order('initiative_total', { ascending: false }),
        supabase.from('player_encounter_state')
          .select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)')
          .eq('encounter_id', encounterId),
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
    setInitError(null);
    setInitSuccess(false);
    try {
      const { error } = await supabase.rpc('set_initiative', {
        p_combatant_id: combatant.id,
        p_total: total,
      });
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

  // CON check data derived from state
  const concentration = state?.concentration ?? false;
  const pendingConDc = concentration ? (state?.concentration_check_dc ?? null) : null;
  const playerName = state?.profiles_players?.name || combatant?.name || null;

  // CON check confirm handlers (same logic as in PlayerCard)
  async function handleConPass() {
    if (!state) return;
    if (playerName) {
      const { data: checks } = await supabase
        .from('concentration_checks')
        .select('id')
        .eq('encounter_id', encounterId)
        .eq('player_name', playerName)
        .eq('result', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      if (checks && checks.length > 0) {
        await supabase.from('concentration_checks').update({ result: 'passed' }).eq('id', checks[0].id);
      }
    }
    await supabase.from('player_encounter_state').update({ concentration_check_dc: null }).eq('id', state.id);
    refreshAll();
  }

  async function handleConFail() {
    if (!state) return;
    if (playerName) {
      const { data: checks } = await supabase
        .from('concentration_checks')
        .select('id')
        .eq('encounter_id', encounterId)
        .eq('player_name', playerName)
        .eq('result', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      if (checks && checks.length > 0) {
        await supabase.from('concentration_checks').update({ result: 'failed' }).eq('id', checks[0].id);
      }
    }
    await supabase.from('player_encounter_state').update({
      concentration_check_dc: null,
      concentration: false,
    }).eq('id', state.id);
    refreshAll();
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

      {/* Persistent CON check alert — shown above tab bar on any tab */}
      {pendingConDc !== null && tab !== 'char' && tab !== 'con' && (
        <div
          style={{
            background: 'rgba(240,180,41,0.12)',
            borderBottom: '1.5px solid var(--accent-gold)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            cursor: 'pointer',
          }}
          onClick={() => setTab('con')}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)' }}>
            🔮 CON Save Required — DC {pendingConDc}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tap to confirm →</span>
        </div>
      )}

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'char' ? 'active' : ''}`} onClick={() => setTab('char')}>🧙 Char</button>
        <button className={`tab-btn ${tab === 'combat' ? 'active' : ''}`} onClick={() => setTab('combat')}>⚔ Combat</button>
        <button className={`tab-btn ${tab === 'rolls' ? 'active' : ''}`} onClick={() => setTab('rolls')}>🎲 Rolls</button>
        <button className={`tab-btn ${tab === 'con' ? 'active' : ''}`} onClick={() => setTab('con')}>
          🔮 CON{pendingConDc !== null ? <span className="tab-badge">!</span> : ''}
        </button>
      </div>

      <div className="main-content">

        {/* ---- CHAR TAB ---- */}
        {tab === 'char' && (
          <>
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
          </>
        )}

        {/* ---- COMBAT TAB ---- */}
        {tab === 'combat' && (
          <>
            {combatant && (
              <div className="panel">
                <div className="panel-title">Initiative</div>
                <div className="form-row">
                  <input
                    className="form-input"
                    type="number"
                    inputMode="numeric"
                    value={initiativeInput}
                    onChange={e => setInitiativeInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmitInitiative()}
                    style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, width: 140, textAlign: 'center' }}
                  />
                  <button
                    className={`btn ${initSuccess ? 'btn-success' : 'btn-primary'}`}
                    onClick={handleSubmitInitiative}
                    disabled={!initiativeInput}
                  >
                    {initSuccess ? '✓ Set' : 'Set Initiative'}
                  </button>
                </div>
                {initError && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 4 }}>{initError}</div>}
              </div>
            )}

            <InitiativePanel
              encounter={encounter}
              combatants={combatants}
              playerStates={playerStates}
              role="player"
              myCombatantId={combatant?.id}
              onUpdate={refreshAll}
            />
          </>
        )}

        {/* ---- ROLLS TAB ---- */}
        {tab === 'rolls' && combatant && (
          <SecretRollPanel
            playerId={profileId}
            encounterId={encounterId}
          />
        )}

        {/* ---- CON TAB ---- */}
        {tab === 'con' && (
          <ConCheckLog
            encounterId={encounterId}
            playerName={playerName}
            pendingDc={pendingConDc}
            onPass={handleConPass}
            onFail={handleConFail}
          />
        )}
      </div>

      {/* Leave link at bottom */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={handleLeave}>
          Leave Session
        </button>
      </div>
    </div>
  );
}