import React, { useCallback, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';

function storageKey(encounterId, type) {
  return `dm_dashboard_dismissed_${type}_${encounterId}`;
}

function readDismissed(encounterId, type) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(encounterId, type)) || '[]');
  } catch {
    return [];
  }
}

function writeDismissed(encounterId, type, ids) {
  localStorage.setItem(storageKey(encounterId, type), JSON.stringify(ids));
}

export default function DMNotificationOverlay({ encounterId }) {
  const [secretRolls, setSecretRolls] = useState([]);
  const [conChecks, setConChecks] = useState([]);
  const [dismissedRollIds, setDismissedRollIds] = useState(() => readDismissed(encounterId, 'rolls'));
  const [dismissedCheckIds, setDismissedCheckIds] = useState(() => readDismissed(encounterId, 'checks'));

  const load = useCallback(async () => {
    if (!encounterId) return;
    const [rollsResult, checksResult] = await Promise.all([
      supabase
        .from('secret_rolls')
        .select('*, profiles_players(name)')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('concentration_checks')
        .select('*')
        .eq('encounter_id', encounterId)
        .eq('result', 'pending')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    setSecretRolls(rollsResult.data || []);
    setConChecks(checksResult.data || []);
  }, [encounterId]);

  usePolling(load, 2000, !!encounterId);

  const visibleRolls = useMemo(
    () => secretRolls.filter(item => !dismissedRollIds.includes(item.id)),
    [secretRolls, dismissedRollIds]
  );
  const visibleChecks = useMemo(
    () => conChecks.filter(item => !dismissedCheckIds.includes(item.id)),
    [conChecks, dismissedCheckIds]
  );

  function dismissRoll(id) {
    const next = [...dismissedRollIds, id];
    setDismissedRollIds(next);
    writeDismissed(encounterId, 'rolls', next);
  }

  function dismissCheck(id) {
    const next = [...dismissedCheckIds, id];
    setDismissedCheckIds(next);
    writeDismissed(encounterId, 'checks', next);
  }

  if (visibleRolls.length === 0 && visibleChecks.length === 0) return null;

  return (
    <div className="dm-notification-stack">
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
