import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';
import { appendDismissedId, readDismissedIds } from '../utils/dmAlertDismissals';
import { ensureSeenBoundary, markSeenBoundary, readSeenBoundary } from '../utils/dmActivityWatermark';

export default function DMNotificationOverlay({ encounterId, inline = false, docked = false, bottomOffset = 0, onActivityUpdate = null }) {
  const [secretRolls, setSecretRolls] = useState([]);
  const [conChecks, setConChecks] = useState([]);
  const [dismissedRollIds, setDismissedRollIds] = useState(() => readDismissedIds(encounterId, 'rolls'));
  const [dismissedCheckIds, setDismissedCheckIds] = useState(() => readDismissedIds(encounterId, 'checks'));

  useEffect(() => {
    ensureSeenBoundary(encounterId, 'rolls');
    ensureSeenBoundary(encounterId, 'checks');
    setDismissedRollIds(readDismissedIds(encounterId, 'rolls'));
    setDismissedCheckIds(readDismissedIds(encounterId, 'checks'));
  }, [encounterId]);

  const load = useCallback(async () => {
    if (!encounterId) return;
    const rollSince = readSeenBoundary(encounterId, 'rolls') || ensureSeenBoundary(encounterId, 'rolls');
    const checkSince = readSeenBoundary(encounterId, 'checks') || ensureSeenBoundary(encounterId, 'checks');

    const [rollsResult, checksResult] = await Promise.all([
      supabase
        .from('secret_rolls')
        .select('*, profiles_players(name)')
        .eq('encounter_id', encounterId)
        .gt('created_at', rollSince)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('concentration_checks')
        .select('*')
        .eq('encounter_id', encounterId)
        .eq('result', 'pending')
        .gt('created_at', checkSince)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setSecretRolls(rollsResult.data || []);
    setConChecks(checksResult.data || []);
  }, [encounterId]);

  usePolling(load, 2000, !!encounterId);

  const visibleRolls = useMemo(() => secretRolls.filter(item => !dismissedRollIds.includes(item.id)), [secretRolls, dismissedRollIds]);
  const visibleChecks = useMemo(() => conChecks.filter(item => !dismissedCheckIds.includes(item.id)), [conChecks, dismissedCheckIds]);

  function dismissRoll(roll) {
    setDismissedRollIds(ids => appendDismissedId(encounterId, 'rolls', ids, roll.id));
    if (roll?.created_at) markSeenBoundary(encounterId, 'rolls', roll.created_at);
    if (onActivityUpdate) onActivityUpdate();
  }

  function dismissCheck(check) {
    setDismissedCheckIds(ids => appendDismissedId(encounterId, 'checks', ids, check.id));
    if (check?.created_at) markSeenBoundary(encounterId, 'checks', check.created_at);
    if (onActivityUpdate) onActivityUpdate();
  }

  if (visibleRolls.length === 0 && visibleChecks.length === 0) return null;

  const stackStyle = inline
    ? { position: 'relative', inset: 'auto', left: 'auto', right: 'auto', top: 'auto', bottom: 'auto', maxWidth: 'none', width: '100%' }
    : docked
      ? { top: 'auto', bottom: bottomOffset, left: 12, right: 12, maxWidth: 'none' }
      : undefined;

  return (
    <div className={`dm-notification-stack ${inline ? 'dm-notification-stack--inline' : ''}`} style={stackStyle}>
      {visibleChecks.map(check => (
        <div key={`check-${check.id}`} className="dm-notification-card dm-notification-card--alert">
          <div className="dm-notification-main">
            <div className="dm-notification-kicker">Concentration Check</div>
            <div className="dm-notification-title">{check.player_name}</div>
            <div className="dm-notification-meta">DC {check.dc}</div>
          </div>
          <button className="dm-notification-dismiss" onClick={() => dismissCheck(check)}>Dismiss</button>
        </div>
      ))}

      {visibleRolls.map(roll => (
        <div key={`roll-${roll.id}`} className="dm-notification-card dm-notification-card--roll">
          <div className="dm-notification-main">
            <div className="dm-notification-kicker">Secret Roll</div>
            <div className="dm-notification-title">{roll.profiles_players?.name || 'Unknown'} • {roll.skill}</div>
            <div className="dm-notification-meta">{roll.total} total ({roll.d20_roll} + {roll.skill_bonus})</div>
          </div>
          <button className="dm-notification-dismiss" onClick={() => dismissRoll(roll)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
