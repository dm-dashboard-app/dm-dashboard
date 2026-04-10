import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SKILLS = [
  { key: 'perception',   label: 'Perception',   icon: 'View' },
  { key: 'insight',      label: 'Insight',       icon: '🧠' },
  { key: 'investigation',label: 'Investigation', icon: '🔍' },
  { key: 'survival',     label: 'Survival',      icon: '🌿' },
];

export default function SecretRollPanel({ playerId, encounterId }) {
  const [sending, setSending] = useState(null); // skill key while in-flight
  const [sent, setSent]       = useState(null); // skill key after success
  const [error, setError]     = useState(null);

  async function handleRoll(skill) {
    if (sending) return;
    setSending(skill);
    setError(null);
    setSent(null);

    const { error: rpcError } = await supabase.rpc('submit_secret_roll', {
      p_player_profile_id: playerId,
      p_encounter_id:      encounterId,
      p_skill:             skill,
    });

    setSending(null);

    if (rpcError) {
      console.error('Secret roll error:', rpcError);
      setError(`Failed: ${rpcError.message}`);
    } else {
      setSent(skill);
      setTimeout(() => setSent(null), 3000);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Secret Rolls</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        The DM sees the result — you only see confirmation.
      </div>

      <div className="secret-roll-buttons">
        {SKILLS.map(({ key, label, icon }) => {
          const isActive  = sending === key;
          const wasSent   = sent === key;

          return (
            <button
              key={key}
              className={`btn secret-roll-btn ${wasSent ? 'sent' : 'btn-ghost'}`}
              onClick={() => handleRoll(key)}
              disabled={!!sending}
              style={{ opacity: sending && !isActive ? 0.4 : 1 }}
            >
              {isActive ? 'Rolling…' : wasSent ? `${icon} Sent ` : `${icon} ${label}`}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-red)', background: 'rgba(224,48,80,0.08)', border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
          {error}
        </div>
      )}
    </div>
  );
}
