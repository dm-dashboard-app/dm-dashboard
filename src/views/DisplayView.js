import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import PlayerCard from '../components/PlayerCard';
import InitiativePanel from '../components/InitiativePanelNext';
import { flattenEncounterStates } from '../utils/encounterState';
import { DISPLAY_MODE_IN_COMBAT, DISPLAY_MODE_OUT_OF_COMBAT, readDisplayModeFromEncounter } from '../utils/displayMode';

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
  const sideCopy = combatant?.side === 'PC' ? 'Party turn' : combatant?.side === 'NPC' ? 'NPC turn' : 'Enemy turn';
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
            <span>{sideCopy}</span>
          </div>
        </>
      ) : (
        <div className="display-turn-feature-empty">No combatant ready.</div>
      )}
    </div>
  );
}

function WorldMapViewport({ src, alt }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ startX: 0, startY: 0, startScale: 1, startDistance: null, panStartX: 0, panStartY: 0 });

  const clampScale = useCallback(scale => Math.max(1, Math.min(4, scale)), []);

  const onPointerDown = useCallback((event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      gestureRef.current.panStartX = transform.x;
      gestureRef.current.panStartY = transform.y;
      gestureRef.current.startX = event.clientX;
      gestureRef.current.startY = event.clientY;
    }

    if (pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()].slice(0, 2);
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      gestureRef.current.startDistance = Math.hypot(dx, dy);
      gestureRef.current.startScale = transform.scale;
    }
  }, [transform]);

  const onPointerMove = useCallback((event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      const dx = event.clientX - gestureRef.current.startX;
      const dy = event.clientY - gestureRef.current.startY;
      setTransform(current => ({ ...current, x: gestureRef.current.panStartX + dx, y: gestureRef.current.panStartY + dy }));
      return;
    }

    const pts = [...pointersRef.current.values()].slice(0, 2);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const distance = Math.hypot(dx, dy);
    const startDistance = gestureRef.current.startDistance || distance;
    const rawScale = gestureRef.current.startScale * (distance / Math.max(1, startDistance));
    setTransform(current => ({ ...current, scale: clampScale(rawScale) }));
  }, [clampScale]);

  const onPointerUp = useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      gestureRef.current.startDistance = null;
    } else if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      gestureRef.current.startX = remaining.x;
      gestureRef.current.startY = remaining.y;
      gestureRef.current.panStartX = transform.x;
      gestureRef.current.panStartY = transform.y;
      gestureRef.current.startDistance = null;
      gestureRef.current.startScale = transform.scale;
    }
  }, [transform]);

  const onWheel = useCallback((event) => {
    event.preventDefault();
    setTransform(current => ({ ...current, scale: clampScale(current.scale + (event.deltaY > 0 ? -0.1 : 0.1)) }));
  }, [clampScale]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#06080d', zIndex: 999, overflow: 'hidden', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`,
          transformOrigin: 'center center',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function QuickInitiativeList({ sortedCombatants, activeId }) {
  return (
    <div className="display-quick-order-panel">
      <div className="display-quick-order-header">Initiative Order</div>
      <div className="display-quick-order-list">
        {sortedCombatants.map(c => (
          <div key={c.id} className={`display-quick-order-row ${c.id === activeId ? 'display-quick-order-row--active' : ''}`}>
            <span className="display-quick-order-name">{c.name}</span>
            <span className="display-quick-order-init">{c.initiative_total ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DisplayView() {
  const [encounter, setEncounter] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [playerStates, setPlayerStates] = useState([]);
  const [displayCombatMode, setDisplayCombatMode] = useState(DISPLAY_MODE_OUT_OF_COMBAT);
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
    const mode = readDisplayModeFromEncounter(enc.data, { logMissing: true });
    if (enc.data) setEncounter(enc.data);
    setCombatants(comb.data || []);
    setPlayerStates(flattenEncounterStates(states.data));
    setDisplayCombatMode(mode || DISPLAY_MODE_OUT_OF_COMBAT);
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
  const featuredPlayer = useMemo(() => {
    if (!rotatedCombatants.length) return null;
    if (activeCombatant?.side === 'PC') return activeCombatant;
    return rotatedCombatants.find(c => c.side === 'PC') || null;
  }, [activeCombatant, rotatedCombatants]);
  const featuredPlayerState = useMemo(
    () => playerStates.find(state => state.combatant_id === featuredPlayer?.id) || null,
    [playerStates, featuredPlayer?.id]
  );
  const displayWindowCombatants = useMemo(() => rotatedCombatants.slice(0, 4), [rotatedCombatants]);
  const displayWindowEncounter = useMemo(
    () => ({ ...encounter, turn_index: 0 }),
    [encounter]
  );
  const outOfCombatPlayers = useMemo(() => {
    const ordered = [...pcCombatants].sort((a, b) => a.name.localeCompare(b.name));
    return ordered.slice(0, 4);
  }, [pcCombatants]);

  if (loading) return <div className="splash"><div className="splash-text">Connecting…</div></div>;

  if (error) {
    return (
      <div className="splash">
        <div className="splash-logo"></div>
        <div className="splash-text">{error}</div>
        <button className="btn btn-ghost" onClick={handleLeave}>Back</button>
      </div>
    );
  }

  if (encounter?.display_world_map) {
    if (!encounter?.world_map_url) {
      return (
        <div className="splash">
          <div className="splash-logo">Map</div>
          <div className="splash-text">World Map mode is enabled, but no map image URL is set for this encounter.</div>
        </div>
      );
    }
    return <WorldMapViewport src={encounter.world_map_url} alt="World map" />;
  }

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
          <div className="initiative-top-bar-secondary">{displayCombatMode === DISPLAY_MODE_IN_COMBAT ? 'In Combat' : 'Out of Combat'}</div>
        </div>

        {displayCombatMode === DISPLAY_MODE_IN_COMBAT ? (
          <>
            <div className="display-turn-state-grid">
              <DisplayTurnFeature label="Current Turn" combatant={activeCombatant} accentClass="display-turn-feature--current" stateLabel="Acting now" />
              <DisplayTurnFeature label="On Deck" combatant={onDeckCombatant} accentClass="display-turn-feature--next" stateLabel="Up next" />
            </div>

            <div className="display-combat-layout-grid">
              <div className="display-featured-player-window">
                {featuredPlayer ? (
                  <PlayerCard
                    combatant={featuredPlayer}
                    state={featuredPlayerState}
                    role="display"
                    isEditMode={false}
                    encounterId={encounter?.id}
                    onUpdate={() => {}}
                  />
                ) : (
                  <div className="empty-state">No player available to feature.</div>
                )}
              </div>

              <div className="display-initiative-window">
                {encounter && (
                  <InitiativePanel
                    encounter={displayWindowEncounter}
                    combatants={displayWindowCombatants}
                    playerStates={playerStates}
                    role="display"
                    onUpdate={() => {}}
                  />
                )}
              </div>

              <QuickInitiativeList sortedCombatants={sortedCombatants} activeId={activeCombatant?.id} />
            </div>
          </>
        ) : (
          <div className={`display-ooc-grid display-ooc-grid--count-${Math.max(1, outOfCombatPlayers.length)}`}>
            {outOfCombatPlayers.length === 0 && <div className="empty-state">No players in encounter.</div>}
            {outOfCombatPlayers.map(c => {
              const state = playerStates.find(s => s.combatant_id === c.id);
              return (
                <div key={c.id} className="display-ooc-card-window">
                  <PlayerCard
                    combatant={c}
                    state={state}
                    role="display"
                    isEditMode={false}
                    encounterId={encounter?.id}
                    onUpdate={() => {}}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
