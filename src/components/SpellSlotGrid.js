import React from 'react';
import { supabase } from '../supabaseClient';

export default function SpellSlotGrid({ profile, state, readOnly, canRestore = false, onUpdate }) {
  const levels = [1,2,3,4,5,6,7,8,9];
  const activeLevels = levels.filter(l => (profile[`slots_max_${l}`] || 0) > 0);
  if (activeLevels.length === 0) return null;

  async function useSlot(level) {
    if (!state) return;
    const used = state[`slots_used_${level}`] || 0;
    const max = profile[`slots_max_${level}`] || 0;
    if (used >= max) return;
    await supabase
      .from('player_encounter_state')
      .update({ [`slots_used_${level}`]: used + 1 })
      .eq('id', state.id);
    onUpdate();
  }

  async function restoreSlot(level) {
    if (!state || !canRestore) return;
    const used = state[`slots_used_${level}`] || 0;
    if (used <= 0) return;
    await supabase
      .from('player_encounter_state')
      .update({ [`slots_used_${level}`]: used - 1 })
      .eq('id', state.id);
    onUpdate();
  }

  async function resetLevel(level) {
    if (!state || !canRestore) return;
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
        const isPlayer = !canRestore && !readOnly;

        return (
          <div key={level} className="slots-row">
            <span className="slots-label">{level}</span>

            {Array.from({ length: max }).map((_, i) => {
              const isUsed = i < used;
              return (
                <button
                  key={i}
                  className={`slot-pip ${isUsed ? 'used' : 'available'}`}
                  onClick={() => {
                    if (readOnly) return;
                    // DM: click used pip → restore; click available pip → expend
                    if (canRestore) {
                      if (isUsed) restoreSlot(level);
                      else useSlot(level);
                    }
                  }}
                  disabled={readOnly}
                  title={
                    canRestore
                      ? isUsed ? 'Click to restore slot' : 'Click to expend slot'
                      : isUsed ? 'Expended' : 'Available'
                  }
                  style={{ cursor: canRestore ? 'pointer' : 'default' }}
                />
              );
            })}

            {/* Player: Use Slot button */}
            {isPlayer && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '1px 6px', marginLeft: 4, opacity: allUsed ? 0.3 : 1 }}
                onClick={() => useSlot(level)}
                disabled={allUsed}
                title={allUsed ? 'All slots expended' : 'Use one slot'}
              >
                Use
              </button>
            )}

            {/* DM: restore-all button */}
            {canRestore && !readOnly && used > 0 && (
              <button
                className="slots-reset-btn"
                onClick={() => resetLevel(level)}
                title="Restore all slots at this level"
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