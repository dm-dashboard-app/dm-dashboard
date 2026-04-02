import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanelNext';
import { flattenEncounterStates } from '../utils/encounterState';

function sortCombatants(combatants) {
  return [...combatants].sort((a, b) => {
    const ai = a.initiative_total ?? -999;
    const bi = b.initiative_total ?? -999;
    if (bi !== ai) return bi - ai;
    const am = a.initiative_mod ?? 0;
    const bm = b.initiative_mod ?? 0;
    if (bm !== am) return bm - am;
    return a.id < b.id ? -1 : 1;
  });
}

function rotateCombatants(combatants, turnIndex) {
  if (!combatants.length) return [];
  const safeIndex = Math.max(0, Math.min(turnIndex ?? 0, combatants.length - 1));
  return [...combatants.slice(safeIndex), ...combatants.slice(0, safeIndex)];
}

function DisplayTurnFeature({ label, combatant, accentClass, stateLabel }) {
  return (
    <div className={`display-turn-feature ${accentClass}`}>
      <div className="display-turn-feature-label-row">
        <div className="display-turn-feature-label">{label}</div>
        {combatant?.initiative_total != null && (
          <div className="display-turn-feature-init">Init {combatant.initiative_total}</div>
        )}
      </div>
      {combatant ? (
        <>
          <div className="display-turn-feature-name-row">
            <span className="display-turn-feature-name">{combatant.name}</span>
            <span className={`badge badge-${combatant.side.toLowerCase()}`}>{combatant.side}</span>
          </div>
          <div className="display-turn-feature-meta">
            <span>{stateLabel}</span>
            <span>{combatant.side === 'PC' ? 'Party turn' : 'Enemy turn'}</span>
          </div>
        </>
      ) : (
        <div className="display-turn-feature-empty">No combatant ready.</div>
      )}
    </div>
  );
}

export default function DisplayView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    setPlayerStates(flattenEncounterStates(states.data));
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

  const pcCombatants = useMemo(() => combatants.filter(c => c.side === 'PC'), [combatants]);
  const sortedCombatants = useMemo(() => sortCombatants(combatants), [combatants]);
  const rotatedCombatants = useMemo(
    () => rotateCombatants(sortedCombatants, encounter?.turn_index ?? 0),
    [sortedCombatants, encounter?.turn_index]
  );
  const activeCombatant = rotatedCombatants[0] || null;
  const onDeckCombatant = rotatedCombatants[1] || null;

  if (loading) return <div className="splash"><div className="splash-text">Connecting…</div></div>;

  if (error) return (
    <div className="splash">
      <div className="splash-logo">📺</div>
      <div className="splash-text">{error}</div>
      <button className="btn btn-ghost" onClick={handleLeave}>Back</button>
    </div>
  );

  return (
    <div className="app-shell display-screen-shell">
      <div className="shell-nav-stack">
        <div className="top-bar top-bar--display">
          <div className="top-bar-spacer" />
          <button className="btn btn-ghost display-exit-button" style={{ fontSize: 12 }} onClick={handleLeave}>✕</button>
        </div>
      </div>

      <div className="display-screen-body">
        <div className="initiative-top-bar initiative-top-bar--display">
          <div className="initiative-top-bar-primary">Round {encounter?.round || 1}</div>
        </div>

        <div className="display-turn-state-grid">
          <DisplayTurnFeature label="Current Turn" combatant={activeCombatant} accentClass="display-turn-feature--current" stateLabel="Acting now" />
          <DisplayTurnFeature label="On Deck" combatant={onDeckCombatant} accentClass="display-turn-feature--next" stateLabel="Up next" />
        </div>

        <div className="display-reference-layout">
          <div className="display-party-column">
            <div className="display-section-header">Party{pcCombatants.length > 0 ? ` (${pcCombatants.length})` : ''}</div>
            <div className="display-party-card-stack">
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
          </div>

          <div className="display-initiative-column">
            <div className="display-section-header">Initiative Feed</div>
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
    </div>
  );
}
