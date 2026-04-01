import React, { useCallback, useState } from 'react';
import { supabase } from '../../supabaseClient';
import usePolling from '../../hooks/usePolling';

export default function PlayerConCheckLog({ encounterId, playerName, pendingDc, onPass, onFail }) {
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

  function resultLabel(result) {
    if (result === 'pending') return { text: 'Pending', cls: 'con-log-result-badge--pending' };
    if (result === 'passed') return { text: 'Passed', cls: 'con-log-result-badge--passed' };
    if (result === 'failed') return { text: 'Failed', cls: 'con-log-result-badge--failed' };
    return { text: result, cls: '' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <button className="con-check-pass" onClick={onPass} style={{ flex: 1, padding: '10px 0', fontSize: 15 }}>✅ Passed — keep concentration</button>
            <button className="con-check-fail" onClick={onFail} style={{ flex: 1, padding: '10px 0', fontSize: 15 }}>❌ Failed — lose concentration</button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Concentration Check History</div>
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && checks.length === 0 && <div className="empty-state">No concentration checks this session.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checks.map(check => {
            const { text, cls } = resultLabel(check.result);
            return (
              <div key={check.id} className={`con-log-item con-log-item--${check.result}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>DC {check.dc}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeLabel(check.created_at)}</span>
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
