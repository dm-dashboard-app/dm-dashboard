import React, { useCallback, useState } from 'react';
import { supabase } from '../../supabaseClient';
import usePolling from '../../hooks/usePolling';

export default function DMCombatLog({ encounterId }) {
  const [logSection, setLogSection] = useState('combat');
  const [combatEntries, setCombatEntries] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadingCombat, setLoadingCombat] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const loadCombat = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase
      .from('combat_log')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(100);
    setCombatEntries(data || []);
    setLoadingCombat(false);
  }, [encounterId]);

  const loadAlerts = useCallback(async () => {
    if (!encounterId) return;
    const { data } = await supabase
      .from('concentration_checks')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(50);
    setAlerts(data || []);
    setLoadingAlerts(false);
  }, [encounterId]);

  usePolling(loadCombat, 3000, !!encounterId && logSection === 'combat');
  usePolling(loadAlerts, 3000, !!encounterId && logSection === 'alerts');

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function actionClass(action) {
    if (action === 'damage') return 'log-item--dmg';
    if (action === 'heal') return 'log-item--heal';
    if (action === 'remove') return 'log-item--remove';
    if (action === 'turn') return 'log-item--turn';
    if (action === 'con') return 'log-item--con';
    if (action === 'rest') return 'log-item--heal';
    return '';
  }

  function resultLabel(r) {
    if (r === 'pending') return { text: '⏳ Pending', cls: 'con-log-result-badge--pending' };
    if (r === 'passed') return { text: '✅ Passed', cls: 'con-log-result-badge--passed' };
    if (r === 'failed') return { text: '❌ Failed', cls: 'con-log-result-badge--failed' };
    return { text: r, cls: '' };
  }

  const pendingAlertCount = alerts.filter(c => c.result === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: logSection === 'combat' ? 'var(--accent-blue)' : 'var(--border)', color: logSection === 'combat' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => { setLogSection('combat'); loadCombat(); }}>⚔ Events</button>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: logSection === 'alerts' ? 'var(--accent-gold)' : 'var(--border)', color: logSection === 'alerts' ? 'var(--accent-gold)' : 'var(--text-secondary)' }} onClick={() => { setLogSection('alerts'); loadAlerts(); }}>⚠ Alerts {pendingAlertCount > 0 && <span className="tab-badge">{pendingAlertCount}</span>}</button>
      </div>

      {logSection === 'combat' && (
        <div className="panel">
          <div className="panel-title">Combat Events</div>
          {loadingCombat && <div className="empty-state">Loading…</div>}
          {!loadingCombat && combatEntries.length === 0 && <div className="empty-state">No events logged yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: '60vh', overflowY: 'auto' }}>
            {combatEntries.map(e => (
              <div key={e.id} className={`log-item ${actionClass(e.action)}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="log-item-action">{e.detail || e.action}</span>
                  <span className="log-item-meta" style={{ flexShrink: 0, marginLeft: 8 }}>{timeLabel(e.created_at)}</span>
                </div>
                {e.actor && <span className="log-item-meta">by {e.actor}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {logSection === 'alerts' && (
        <div className="panel">
          <div className="panel-title">Alerts</div>
          {loadingAlerts && <div className="empty-state">Loading…</div>}
          {!loadingAlerts && alerts.length === 0 && <div className="empty-state">No alerts this encounter.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
            {alerts.map(c => {
              const { text, cls } = resultLabel(c.result);
              return (
                <div key={c.id} className={`con-log-item con-log-item--${c.result}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.player_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>DC {c.dc}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeLabel(c.created_at)}</span>
                  </div>
                  <span className={`con-log-result-badge ${cls}`}>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
