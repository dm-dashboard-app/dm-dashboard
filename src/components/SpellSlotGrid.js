import React from 'react';
import { supabase } from '../supabaseClient';

export default function SpellSlotGrid({ profile, state, readOnly, onUpdate }) {
  const levels = [1,2,3,4,5,6,7,8,9];
  const activeLevels = levels.filter(l => (profile[`slots_max_${l}`] || 0) > 0);
  if (activeLevels.length === 0) return null;

  async function handlePipClick(level, isUsed) {
    if (readOnly || !state) return;
    const used = state[`slots_used_${level}`] || 0;
    const max = profile[`slots_max_${level}`] || 0;

    // Used pip — restore one slot. Available pip — use one slot.
    const newUsed = isUsed
      ? Math.max(0, used - 1)
      : Math.min(max, used + 1);

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
            {Array.from({ length: max }).map((_, i) => {
              const isUsed = i < used;
              return (
                <button
                  key={i}
                  className={`slot-pip ${isUsed ? 'used' : 'available'}`}
                  onClick={() => handlePipClick(level, isUsed)}
                  disabled={readOnly}
                  title={isUsed ? 'Restore slot' : 'Use slot'}
                />
              );
            })}
            {!readOnly && used > 0 && (
              <button
                className="slots-reset-btn"
                onClick={() => resetLevel(level)}
                title="Restore all slots"
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