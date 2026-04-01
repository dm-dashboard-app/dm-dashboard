import React, { useCallback, useState } from 'react';
import { supabase } from '../../supabaseClient';
import usePolling from '../../hooks/usePolling';
import { formatTime } from './dmViewUtils';

export default function RecentAlertsStrip({ encounterId, expanded, onToggle }) {
  const [checks, setChecks] = useState([]);

  const load = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase
      .from('concentration_checks')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(5);
    setChecks(data || []);
  }, [encounterId]);

  usePolling(load, 2000, !!encounterId);

  function resultStyle(result) {
    if (result === 'passed') return { color: 'var(--accent-green)', label: '✅ Passed' };
    if (result === 'failed') return { color: 'var(--accent-red)', label: '❌ Failed' };
    return { color: 'var(--accent-gold)', label: '⏳ Pending' };
  }

  const latest = checks[0];
  const latestResult = latest ? resultStyle(latest.result) : null;

  return (
    <button type="button" className={`dm-bottom-strip ${expanded ? 'expanded' : ''}`} onClick={onToggle} aria-expanded={expanded}>
      <div className="dm-bottom-strip-header">
        <span className="dm-bottom-strip-title">Recent Alerts</span>
        <span className="dm-bottom-strip-toggle">{expanded ? 'Hide' : 'Show'}</span>
      </div>

      {!expanded && (
        <div className="dm-bottom-strip-summary">
          {latest ? (
            <>
              <span className="dm-bottom-strip-summary-name">{latest.player_name}</span>
              <span className="dm-bottom-strip-summary-meta">DC {latest.dc}</span>
              <span className="dm-bottom-strip-summary-meta">{formatTime(latest.created_at)}</span>
              <span className="dm-bottom-strip-summary-status" style={{ color: latestResult.color }}>{latestResult.label}</span>
            </>
          ) : (
            <span className="dm-bottom-strip-summary-empty">No alerts right now.</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="dm-bottom-strip-body">
          {checks.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 4, paddingBottom: 0 }}>No alerts this encounter.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checks.map(c => {
                const { color, label } = resultStyle(c.result);
                return (
                  <div key={c.id} className="dm-bottom-strip-row">
                    <div className="dm-bottom-strip-row-left">
                      <span className="dm-bottom-strip-row-name">{c.player_name}</span>
                      <span className="dm-bottom-strip-row-meta">DC {c.dc}</span>
                      <span className="dm-bottom-strip-row-meta">{formatTime(c.created_at)}</span>
                    </div>
                    <div className="dm-bottom-strip-row-right">
                      <span className="dm-bottom-strip-row-status" style={{ color }}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
