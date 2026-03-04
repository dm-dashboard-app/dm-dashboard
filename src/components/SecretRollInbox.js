import React, { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import usePolling from '../hooks/usePolling';

export default function SecretRollInbox({ encounterId }) {
  const [rolls, setRolls] = useState([]);

  const loadRolls = useCallback(async () => {
    const { data } = await supabase
      .from('secret_rolls')
      .select('*, profiles_players(name)')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(20);
    setRolls(data || []);
  }, [encounterId]);

  usePolling(loadRolls, 2000, !!encounterId);

  return (
    <div className="panel">
      <div className="panel-title">Secret Roll Inbox</div>
      {rolls.length === 0 && <div className="empty-state">No secret rolls yet.</div>}
      <div className="secret-roll-list">
        {rolls.map(r => (
          <div key={r.id} className="secret-roll-item">
            <div className="secret-roll-who">
              <span className="secret-roll-player">{r.profiles_players?.name || 'Unknown'}</span>
              <span className="secret-roll-skill">{r.skill}</span>
              <span className="secret-roll-time">{new Date(r.created_at).toLocaleTimeString()}</span>
            </div>
            <div className="secret-roll-result">
              <span className="secret-roll-total">{r.total}</span>
              <span className="secret-roll-breakdown">({r.d20_roll} + {r.skill_bonus})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}