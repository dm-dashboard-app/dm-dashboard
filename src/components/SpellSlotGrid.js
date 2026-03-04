import React from 'react';
import { supabase } from '../supabaseClient';

export default function SpellSlotGrid({ profile, state, readOnly, onUpdate }) {
  const levels = [1,2,3,4,5,6,7,8,9];
  const activeLevels = levels.filter(l => (profile[`slots_max_${l}`] || 0) > 0);
  if (activeLevels.length === 0) return null;

  async function handlePipClick(level, index) {
    if (readOnly || !state) return;
    const used = state[`slots_used_${level}`] || 0;
    const max = profile[`slots_max_${level}`] || 0;

    let newUsed;
    if (index < used) {
      // Clicking a used pip — restore it (reduce used count to this index)
      newUsed = index;
    } else {
      // Clicking an available pip — use it
      newUsed = Math.min(max, index + 1);
    }

    await supabase
      .from('player_encounter_state')
      .update({ [`slots_used_${level}`]: newUsed })
      .eq('id', state.id);
    onUpdate();
  }

  async function resetLevel(level) {
    if (readOnly || !state) return;
    await supabase
      .from('player_encounter_state')
      .update({ [`slots_used_${level}`]: 0 })
      .eq('id', state.id);
    onUpdate();
  }

  return (
    <div className="slots-grid">
      {activeLevels.map(level => {
        const max = profile[`slots_max_${level}`] || 0;
        const used = state?.[`slots_used_${level}`] || 0;
        const allUsed = used >= max;

        return (
          <div key={level} className="slots-row">
            <span className="slots-label">{level}</span>
            {Array.from({ length: max }).map((_, i) => (
              <button
                key={i}
                className={`slot-pip ${i < used ? 'used' : 'available'}`}
                onClick={() => handlePipClick(level, i)}
                disabled={readOnly}
                title={i < used ? `Restore level ${level} slot` : `Use level ${level} slot`}
              />
            ))}
            {/* Reset button — only shows when at least one slot is used */}
            {!readOnly && used > 0 && (
              <button
                className="slots-reset-btn"
                onClick={() => resetLevel(level)}
                title={`Restore all level ${level} slots`}
              >↺</button>
            )}
            {allUsed && !readOnly && (
              <span className="slots-empty-label">expended</span>
            )}
          </div>
        );
      })}
    </div>
  );
}