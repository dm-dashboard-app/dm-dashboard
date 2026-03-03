import React from 'react';
import { supabase } from '../supabaseClient';

export default function SpellSlotGrid({ profile, state, readOnly, onUpdate }) {
  const levels = [1,2,3,4,5,6,7,8,9];

  // Only show levels where max slots > 0
  const activelevels = levels.filter(l => (profile[`slots_max_${l}`] || 0) > 0);
  if (activelevels.length === 0) return null;

  async function toggleSlot(level, index) {
    if (readOnly || !state) return;
    const used = state[`slots_used_${level}`] || 0;
    const max = profile[`slots_max_${level}`] || 0;
    // clicking a used slot restores it, clicking available uses it
    const newUsed = index < used ? index : Math.min(max, index + 1);
    await supabase
      .from('player_encounter_state')
      .update({ [`slots_used_${level}`]: newUsed })
      .eq('id', state.id);
    onUpdate();
  }

  return (
    <div className="slots-grid">
      {activelevels.map(level => {
        const max = profile[`slots_max_${level}`] || 0;
        const used = state?.[`slots_used_${level}`] || 0;
        return (
          <div key={level} className="slots-row">
            <span className="slots-label">{level}</span>
            {Array.from({ length: max }).map((_, i) => (
              <button
                key={i}
                className={`slot-pip ${i < used ? 'used' : 'available'}`}
                onClick={() => toggleSlot(level, i)}
                disabled={readOnly}
                title={`Level ${level} slot ${i + 1}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}