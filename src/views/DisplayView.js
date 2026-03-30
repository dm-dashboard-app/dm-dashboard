import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanel';

function flattenStates(data) {
  return (data || []).map(s => ({
    ...s,
    wildshape_form_name: s.profiles_wildshape?.form_name ?? null,
    wildshape_hp_max: s.profiles_wildshape?.hp_max ?? null,
  }));
}

export default function DisplayView() {
  const [encounter, setEncounter]       = useState(null);
  const [combatants, setCombatants]     = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const displayToken = localStorage.getItem('display_token');

  useEffect(() => {
    async function init() {
      if (!displayToken) {
        setError('No display token. Re-enter token.');
        setLoading(false);
        return;
      }
      const { data: session } = await supabase
        .from('display_sessions')
        .select('encounter_id')
        .eq('token', displayToken)
        .maybeSingle();
      if (!session) {
        setError('Invalid or expired display token.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    init();
  }, [displayToken]);

  const refresh = useCallback(async () => {
    if (!displayToken) return;
    const { data: session } = await supabase
      .from('display_sessions')
      .select('encounter_id')
      .eq('token', displayToken)
      .maybeSingle();
    if (!session) return;
    const encounterId = session.encounter_id;

    const [enc, comb, states] = await Promise.all([
      supabase.from('encounters').select('*').eq('id', encounterId).maybeSingle(),
      supabase.from('combatants').select('*').eq('encounter_id', encounterId)
        .order('initiative_total', { ascending: false, nullsFirst: false }),
      supabase.from('player_encounter_state')
        .select('*, profiles_players(*), profiles_wildshape(form_name, hp_max)')
        .eq('encounter_id', encounterId),
    ]);
    if (enc.data) setEncounter(enc.data);
    setCombatants(comb.data || []);
    setPlayerStates(flattenStates(states.data));
  }, [displayToken]);

  usePolling(refresh, 2000, !!displayToken && !loading && !error);

  useEffect(() => {
    if (!loading && !error) refresh();
  }, [loading, error, refresh]);

  function handleLeave() {
    localStorage.removeItem('display_token');
    localStorage.removeItem('app_role');
    window.location.reload();
  }

  if (loading) return <div className="splash"><div className="splash-text">Connecting…</div></div>;

  if (error) return (
    <div className="splash">
      <div className="splash-logo">📺</div>
      <div className="splash-text">{error}</div>
      <button className="btn btn-ghost" onClick={handleLeave}>Back</button>
    </div>
  );

  const pcCombatants = combatants.filter(c => c.side === 'PC');

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div className="top-bar">
        {encounter && <div className="top-bar-round">R{encounter.round}</div>}
        <span className="top-bar-title">{encounter?.name || 'Loading…'}</span>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleLeave}>✕</button>
      </div>

      {/* Two-column body */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
        padding: '12px 16px',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* LEFT — Player cards */}
        <div style={{
          flex: '0 0 380px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
            Party
          </div>
          {pcCombatants.length === 0 && (
            <div className="empty-state">No players in encounter.</div>
          )}
          {pcCombatants.map(c => {
            const state = playerStates.find(s => s.combatant_id === c.id);
            return (
              <PlayerCard
                key={c.id}
                combatant={c}
                state={state}
                role="display"
                isEditMode={false}
                encounterId={encounter?.id}
                onUpdate={() => {}}
              />
            );
          })}
        </div>

        {/* RIGHT — Initiative order */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          minWidth: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', paddingBottom: 4, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            Initiative Order
          </div>
          {encounter && (
            <InitiativePanel
              encounter={encounter}
              combatants={combatants}
              playerStates={playerStates}
              role="display"
              onUpdate={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}