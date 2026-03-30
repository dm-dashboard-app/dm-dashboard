import React from 'react';
import { supabase } from '../supabaseClient';

function PactPip({ isAvailable, onClick, disabled, title }) {
  return (
    <button
      className={`slot-pip ${isAvailable ? 'available' : 'used'}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        borderColor: isAvailable ? 'var(--accent-gold)' : '#6f6f6f',
        background: isAvailable ? 'rgba(240,180,41,0.22)' : 'rgba(255,255,255,0.04)',
        boxShadow: isAvailable ? '0 0 0 1px rgba(240,180,41,0.28) inset' : 'none',
        opacity: isAvailable ? 1 : 0.45,
        cursor: disabled ? 'default' : 'pointer',
      }}
    />
  );
}

export default function SpellSlotGrid({ profile, state, readOnly, canRestore = false, onUpdate }) {
  const levels = [1,2,3,4,5,6,7,8,9];
  const standardActiveLevels = levels.filter(l => (profile[`slots_max_${l}`] || 0) > 0);
  const pactLevel = state?.warlock_slots_level || 0;
  const pactMax = state?.warlock_slots_max || 0;
  const pactCurrent = state?.warlock_slots_current || 0;
  const activeLevels = Array.from(new Set([...standardActiveLevels, ...(pactLevel > 0 && pactMax > 0 ? [pactLevel] : [])])).sort((a, b) => a - b);
  if (activeLevels.length === 0) return null;

  async function useStandardSlot(level) {
    if (!state) return;
    const used = state[`slots_used_${level}`] || 0;
    const max = profile[`slots_max_${level}`] || 0;
    if (used >= max) return;
    await supabase.from('player_encounter_state').update({ [`slots_used_${level}`]: used + 1 }).eq('id', state.id);
    onUpdate();
  }

  async function restoreStandardSlot(level) {
    if (!state || !canRestore) return;
    const used = state[`slots_used_${level}`] || 0;
    if (used <= 0) return;
    await supabase.from('player_encounter_state').update({ [`slots_used_${level}`]: used - 1 }).eq('id', state.id);
    onUpdate();
  }

  async function resetLevel(level) {
    if (!state || !canRestore) return;
    await supabase.from('player_encounter_state').update({ [`slots_used_${level}`]: 0 }).eq('id', state.id);
    onUpdate();
  }

  async function usePactSlot() {
    if (!state || pactCurrent <= 0) return;
    await supabase.from('player_encounter_state').update({ warlock_slots_current: pactCurrent - 1 }).eq('id', state.id);
    onUpdate();
  }

  async function restorePactSlot() {
    if (!state || !canRestore || pactCurrent >= pactMax) return;
    await supabase.from('player_encounter_state').update({ warlock_slots_current: pactCurrent + 1 }).eq('id', state.id);
    onUpdate();
  }

  async function choosePlayerUse(level) {
    const standardMax = profile[`slots_max_${level}`] || 0;
    const standardUsed = state?.[`slots_used_${level}`] || 0;
    const standardAvailable = standardMax - standardUsed > 0;
    const pactAvailable = pactMax > 0 && pactCurrent > 0 && pactLevel >= level;

    if (pactAvailable && standardAvailable) {
      const usePact = window.confirm(`Use a Warlock pact slot for level ${level}?\n\nOK = Pact slot\nCancel = Standard slot`);
      if (usePact) await usePactSlot();
      else await useStandardSlot(level);
      return;
    }
    if (pactAvailable) return usePactSlot();
    if (standardAvailable) return useStandardSlot(level);
  }

  return (
    <div className="slots-grid">
      {activeLevels.map(level => {
        const max = profile[`slots_max_${level}`] || 0;
        const used = state?.[`slots_used_${level}`] || 0;
        const allUsed = used >= max;
        const isPlayer = !canRestore && !readOnly;
        const pactOnRow = pactMax > 0 && pactLevel === level;
        const pactCanPowerThisLevel = pactMax > 0 && pactLevel >= level;
        const pactAllUsed = pactCurrent <= 0;

        return (
          <div key={level} className="slots-row">
            <span className="slots-label">{level}</span>
            {Array.from({ length: max }).map((_, i) => {
              const isUsed = i < used;
              return (
                <button
                  key={`std-${i}`}
                  className={`slot-pip ${isUsed ? 'used' : 'available'}`}
                  onClick={() => {
                    if (readOnly) return;
                    if (canRestore) {
                      if (isUsed) restoreStandardSlot(level);
                      else useStandardSlot(level);
                    }
                  }}
                  disabled={readOnly}
                  title={canRestore ? (isUsed ? 'Click to restore slot' : 'Click to expend slot') : isUsed ? 'Expended' : 'Available'}
                  style={{ cursor: canRestore ? 'pointer' : 'default' }}
                />
              );
            })}

            {pactOnRow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: max > 0 ? 8 : 0 }}>
                <span className="slots-empty-label" style={{ color: 'var(--accent-gold)' }}>Pact</span>
                {Array.from({ length: pactMax }).map((_, i) => {
                  const isAvailable = i < pactCurrent;
                  return (
                    <PactPip
                      key={`pact-${i}`}
                      isAvailable={isAvailable}
                      onClick={() => {
                        if (readOnly) return;
                        if (canRestore) {
                          if (isAvailable) usePactSlot();
                          else restorePactSlot();
                        }
                      }}
                      disabled={readOnly}
                      title={canRestore ? (isAvailable ? 'Click to expend pact slot' : 'Click to restore pact slot') : isAvailable ? 'Available pact slot' : 'Expended pact slot'}
                    />
                  );
                })}
              </div>
            )}

            {isPlayer && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '1px 6px', marginLeft: 4, opacity: (!pactCanPowerThisLevel && allUsed) || (pactCanPowerThisLevel && pactAllUsed && allUsed) ? 0.3 : 1 }}
                onClick={() => choosePlayerUse(level)}
                disabled={(!pactCanPowerThisLevel && allUsed) || (pactCanPowerThisLevel && pactAllUsed && allUsed)}
                title={pactCanPowerThisLevel ? 'Use a standard or pact slot' : allUsed ? 'All slots expended' : 'Use one slot'}
              >Use</button>
            )}

            {canRestore && !readOnly && used > 0 && <button className="slots-reset-btn" onClick={() => resetLevel(level)} title="Restore all standard slots at this level">↺</button>}
            {allUsed && !readOnly && !pactCanPowerThisLevel && <span className="slots-empty-label">expended</span>}
          </div>
        );
      })}
    </div>
  );
}
