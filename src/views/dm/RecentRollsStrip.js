import React, { useCallback, useState } from 'react';
import { supabase } from '../../supabaseClient';
import usePolling from '../../hooks/usePolling';
import { formatTime } from './dmViewUtils';

export default function RecentRollsStrip({ encounterId, expanded, onToggle }) {
  const [rolls, setRolls] = useState([]);

  const load = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase
      .from('secret_rolls')
      .select('*, profiles_players(name)')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(3);
    setRolls(data || []);
  }, [encounterId]);

  usePolling(load, 2000, !!encounterId);

  const latest = rolls[0];

  return (
    <button type="button" className={`dm-bottom-strip ${expanded ? 'expanded' : ''}`} onClick={onToggle} aria-expanded={expanded}>
      <div className="dm-bottom-strip-header">
        <span className="dm-bottom-strip-title">Recent Secret Rolls</span>
        <span className="dm-bottom-strip-toggle">{expanded ? 'Hide' : 'Show'}</span>
      </div>

      {!expanded && (
        <div className="dm-bottom-strip-summary">
          {latest ? (
            <>
              <span className="dm-bottom-strip-summary-name">{latest.profiles_players?.name || 'Unknown'}</span>
              <span className="dm-bottom-strip-summary-meta">{latest.skill}</span>
              <span className="dm-bottom-strip-summary-meta">{formatTime(latest.created_at)}</span>
              <span className="dm-bottom-strip-summary-value">{latest.total}</span>
            </>
          ) : (
            <span className="dm-bottom-strip-summary-empty">No secret rolls yet.</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="dm-bottom-strip-body">
          {rolls.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 4, paddingBottom: 0 }}>No secret rolls yet this encounter.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rolls.map(r => (
                <div key={r.id} className="dm-bottom-strip-row">
                  <div className="dm-bottom-strip-row-left">
                    <span className="dm-bottom-strip-row-name">{r.profiles_players?.name || 'Unknown'}</span>
                    <span className="dm-bottom-strip-row-meta" style={{ color: 'var(--accent-gold)', textTransform: 'capitalize' }}>{r.skill}</span>
                    <span className="dm-bottom-strip-row-meta">{formatTime(r.created_at)}</span>
                  </div>
                  <div className="dm-bottom-strip-row-right">
                    <span className="dm-bottom-strip-row-value">{r.total}</span>
                    <span className="dm-bottom-strip-row-breakdown">({r.d20_roll}+{r.skill_bonus})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
