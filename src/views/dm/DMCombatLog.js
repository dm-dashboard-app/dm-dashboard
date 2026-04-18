import React, { useCallback, useState } from 'react';
import { supabase } from '../../supabaseClient';
import usePolling from '../../hooks/usePolling';
import {
  SHORT_REST_LOG_ACTION,
  SHORT_REST_RESPONSE_ACTION,
  formatShortRestResponseLogDetail,
} from '../../utils/shortRestWorkflow';

export default function DMCombatLog({ encounterId }) {
  const [logSection, setLogSection] = useState('combat');
  const [combatEntries, setCombatEntries] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadingCombat, setLoadingCombat] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [clearingId, setClearingId] = useState(null);

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
    if (r === 'pending') return { text: 'Pending', cls: 'con-log-result-badge--pending' };
    if (r === 'passed') return { text: 'Passed', cls: 'con-log-result-badge--passed' };
    if (r === 'failed') return { text: 'Failed', cls: 'con-log-result-badge--failed' };
    if (r === 'cleared') return { text: 'Cleared', cls: '' };
    return { text: r, cls: '' };
  }

  async function resolveAlert(alert, result) {
    if (clearingId) return;
    setClearingId(alert.id);
    await supabase.from('concentration_checks').update({ result }).eq('id', alert.id);
    const { data: states } = await supabase
      .from('player_encounter_state')
      .select('id, profiles_players(name)')
      .eq('encounter_id', encounterId);
    const targetState = (states || []).find(state => state.profiles_players?.name === alert.player_name);
    if (targetState?.id) {
      const statePatch = result === 'failed'
        ? { concentration_check_dc: null, concentration: false, concentration_spell_id: null }
        : { concentration_check_dc: null };
      await supabase.from('player_encounter_state').update(statePatch).eq('id', targetState.id);
    }
    setClearingId(null);
    loadAlerts();
  }

  async function clearAlert(alert) {
    await resolveAlert(alert, 'cleared');
  }


  function formatCombatDetail(entry) {
    if (!entry) return '';
    if (entry.action === SHORT_REST_LOG_ACTION) {
      try {
        const payload = typeof entry.detail === 'object' ? entry.detail : JSON.parse(entry.detail);
        if (payload?.type === 'start') return 'Short rest procedure started';
        if (payload?.type === 'cancel') return 'Short rest procedure canceled';
        if (payload?.type === 'complete') return 'Short rest procedure completed';
      } catch (_err) {
        return 'Short rest procedure event';
      }
    }
    if (entry.action === SHORT_REST_RESPONSE_ACTION) {
      try {
        const payload = typeof entry.detail === 'object' ? entry.detail : JSON.parse(entry.detail);
        return formatShortRestResponseLogDetail(payload);
      } catch (_err) {
        return 'Short rest response submitted';
      }
    }
    return entry.detail || entry.action;
  }

  const pendingAlertCount = alerts.filter(c => c.result === 'pending').length;

  return (
    <div className="panel dm-section-panel dm-log-panel">
      <div className="dm-section-heading-row">
        <div>
          <div className="panel-title">Activity Log</div>
          <div className="dm-section-subtitle">Combat events and concentration history</div>
        </div>
      </div>

      <div className="dm-log-tab-row">
        <button className={`btn btn-ghost dm-log-tab ${logSection === 'combat' ? 'active' : ''}`} onClick={() => { setLogSection('combat'); loadCombat(); }}>Events</button>
        <button className={`btn btn-ghost dm-log-tab dm-log-tab--alerts ${logSection === 'alerts' ? 'active' : ''}`} onClick={() => { setLogSection('alerts'); loadAlerts(); }}>Alerts {pendingAlertCount > 0 && <span className="tab-badge">{pendingAlertCount}</span>}</button>
      </div>

      {logSection === 'combat' && (
        <div className="dm-log-scroll-area">
          {loadingCombat && <div className="empty-state">Loading…</div>}
          {!loadingCombat && combatEntries.length === 0 && <div className="empty-state">No events logged yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {combatEntries.map(e => (
              <div key={e.id} className={`log-item ${actionClass(e.action)}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span className="log-item-action">{formatCombatDetail(e)}</span>
                  <span className="log-item-meta" style={{ flexShrink: 0 }}>{timeLabel(e.created_at)}</span>
                </div>
                {e.actor && <span className="log-item-meta">by {e.actor}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {logSection === 'alerts' && (
        <div className="dm-log-scroll-area">
          {loadingAlerts && <div className="empty-state">Loading…</div>}
          {!loadingAlerts && alerts.length === 0 && <div className="empty-state">No alerts this encounter.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map(c => {
              const { text, cls } = resultLabel(c.result);
              const canClear = c.result === 'pending';
              return (
                <div key={c.id} className={`con-log-item con-log-item--${c.result}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.player_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Concentration check • DC {c.dc}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeLabel(c.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`con-log-result-badge ${cls}`}>{text}</span>
                    {canClear ? (
                      <>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => resolveAlert(c, 'passed')} disabled={clearingId === c.id}>{clearingId === c.id ? 'Saving...' : 'Pass'}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => resolveAlert(c, 'failed')} disabled={clearingId === c.id}>{clearingId === c.id ? 'Saving...' : 'Fail'}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => clearAlert(c)} disabled={clearingId === c.id}>{clearingId === c.id ? 'Saving...' : 'Clear'}</button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
