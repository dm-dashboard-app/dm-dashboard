import React from 'react';
import { supabase } from '../../supabaseClient';

export default function InitiativeEnemySlotGrid({ combatant, onUpdate }) {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(level => (combatant[`slots_max_${level}`] || 0) > 0);
  if (!levels.length) return null;

  async function setLevel(level, nextUsed) {
    await supabase
      .from('combatants')
      .update({ [`slots_used_${level}`]: nextUsed })
      .eq('id', combatant.id);
    onUpdate();
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Spell Slots
      </div>
      <div className="slots-grid">
        {levels.map(level => {
          const max = combatant[`slots_max_${level}`] || 0;
          const used = combatant[`slots_used_${level}`] || 0;
          return (
            <div key={level} className="slots-row">
              <span className="slots-label">{level}</span>
              {Array.from({ length: max }).map((_, i) => {
                const isUsed = i < used;
                return (
                  <button
                    key={i}
                    className={`slot-pip ${isUsed ? 'used' : 'available'}`}
                    onClick={() => setLevel(level, isUsed ? used - 1 : used + 1)}
                    style={{ cursor: 'pointer' }}
                    title={isUsed ? 'Restore slot' : 'Use slot'}
                  />
                );
              })}
              {used > 0 && (
                <button className="slots-reset-btn" onClick={() => setLevel(level, 0)} title="Restore all">
                  ↺
                </button>
              )}
              {used >= max && <span className="slots-empty-label">expended</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
