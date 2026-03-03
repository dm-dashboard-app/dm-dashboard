import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SKILLS = ['perception', 'insight', 'survival'];

export default function SecretRollPanel({ encounterId, playerProfileId }) {
  const [sent, setSent] = useState({});
  const [loading, setLoading] = useState({});

  async function handleRoll(skill) {
    setLoading(l => ({ ...l, [skill]: true }));
    try {
      await supabase.rpc('submit_secret_roll', {
        p_encounter_id: encounterId,
        p_player_profile_id: playerProfileId,
        p_skill: skill,
      });
      setSent(s => ({ ...s, [skill]: true }));
      setTimeout(() => setSent(s => ({ ...s, [skill]: false })), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(l => ({ ...l, [skill]: false }));
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Secret Rolls</div>
      <div className="secret-roll-buttons">
        {SKILLS.map(skill => (
          <button
            key={skill}
            className={`btn btn-ghost secret-roll-btn ${sent[skill] ? 'sent' : ''}`}
            onClick={() => handleRoll(skill)}
            disabled={loading[skill] || sent[skill]}
          >
            {sent[skill] ? `✅ Sent` : `🎲 ${skill.charAt(0).toUpperCase() + skill.slice(1)}`}
          </button>
        ))}
      </div>
    </div>
  );
}