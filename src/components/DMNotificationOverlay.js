import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import { appendDismissedId, readDismissedIds } from '../utils/dmAlertDismissals';

export default function DMNotificationOverlay({ encounterId, docked = false, bottomOffset = 0 }) {
  const [secretRolls, setSecretRolls] = useState([]);
  const [conChecks, setConChecks] = useState([]);
  const [dismissedRollIds, setDismissedRollIds] = useState(() => readDismissedIds(encounterId, 'rolls'));
  const [dismissedCheckIds, setDismissedCheckIds] = useState(() => readDismissedIds(encounterId, 'checks'));

  useEffect(() => {
    setDismissedRollIds(readDismissedIds(encounterId, 'rolls'));
    setDismissedCheckIds(readDismissedIds(encounterId, 'checks'));
  }, [encounterId]);

  const load = useCallback(async () => {
    if (!encounterId) return;
    const [rollsResult, checksResult] = await Promise.all([
      supabase.from('secret_rolls').select('*, profiles_players(name)').eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(10),
      supabase.from('concentration_checks').select('*').eq('encounter_id', encounterId).eq('result', 'pending').order('created_at', { ascending: false }).limit(10),
    ]);
    setSecretRolls(rollsResult.data || []);
    setConChecks(checksResult.data || []);
  }, [encounterId]);

  usePolling(load, 2000, !!encounterId);

  const visibleRolls = useMemo(() => secretRolls.filter(item => !dismissedRollIds.includes(item.id)), [secretRolls, dismissedRollIds]);
  const visibleChecks = useMemo(() => conChecks.filter(item => !dismissedCheckIds.includes(item.id)), [conChecks, dismissedCheckIds]);

  function dismissRoll(id) {
    setDismissedRollIds(ids => appendDismissedId(encounterId, 'rolls', ids, id));
  }

  function dismissCheck(id) {
    setDismissedCheckIds(ids => appendDismissedId(encounterId, 'checks', ids, id));
  }

  if (visibleRolls.length === 0 && visibleChecks.length === 0) return null;

  return (
    <div
      className="dm-notification-stack"
      style={docked ? { top: 'auto', bottom: bottomOffset, left: 12, right: 12, maxWidth: 'none' } : undefined}
    >
      {visibleChecks.map(check => (
        <div key={`check-${check.id}`} className="dm-notification-card dm-notification-card--alert">
          <div className="dm-notification-main">
            <div className="dm-notification-kicker">Concentration Check</div>
            <div className="dm-notification-title">{check.player_name}</div>
            <div className="dm-notification-meta">DC {check.dc}</div>
          </div>
          <button className="dm-notification-dismiss" onClick={() => dismissCheck(check.id)}>Dismiss</button>
        </div>
      ))}

      {visibleRolls.map(roll => (
        <div key={`roll-${roll.id}`} className="dm-notification-card dm-notification-card--roll">
          <div className="dm-notification-main">
            <div className="dm-notification-kicker">Secret Roll</div>
            <div className="dm-notification-title">{roll.profiles_players?.name || 'Unknown'} • {roll.skill}</div>
            <div className="dm-notification-meta">{roll.total} total ({roll.d20_roll} + {roll.skill_bonus})</div>
          </div>
          <button className="dm-notification-dismiss" onClick={() => dismissRoll(roll.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
