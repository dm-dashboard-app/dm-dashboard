import React from 'react';
import {
  getSpellSlotAvailability,
  getStandardSlotState,
  getPactSlotState,
  spendStandardSlot,
  restoreStandardSlot,
  resetStandardSlotsForLevel,
  spendPactSlot,
  restorePactSlot,
  spendSpellSlotWithChoice,
} from '../utils/spellSlotMutations';

function PactPip({ isAvailable, onClick, disabled, title }) {
  return (
    <button className={`slot-pip ${isAvailable ? 'available' : 'used'}`} onClick={onClick} disabled={disabled} title={title} style={{ borderColor: isAvailable ? 'var(--accent-gold)' : '#6f6f6f', background: isAvailable ? 'rgba(240,180,41,0.22)' : 'rgba(255,255,255,0.04)', boxShadow: isAvailable ? '0 0 0 1px rgba(240,180,41,0.28) inset' : 'none', opacity: isAvailable ? 1 : 0.45, cursor: disabled ? 'default' : 'pointer' }} />
  );
}

export default function SpellSlotGrid({ profile, state, readOnly, canRestore = false, onUpdate }) {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const standardActiveLevels = levels.filter(level => (profile[`slots_max_${level}`] || 0) > 0);
  const pactLevel = state?.warlock_slots_level || 0;
  const pactMax = state?.warlock_slots_max || 0;
  const activeLevels = Array.from(new Set([...standardActiveLevels, ...(pactLevel > 0 && pactMax > 0 ? [pactLevel] : [])])).sort((a, b) => a - b);
  if (activeLevels.length === 0) return null;

  async function useStandard(level) {
    if (!state?.id) return;
    const changed = await spendStandardSlot(state.id, profile, state, level);
    if (changed) onUpdate();
  }

  async function restoreStandard(level) {
    if (!state?.id || !canRestore) return;
    const changed = await restoreStandardSlot(state.id, state, level);
    if (changed) onUpdate();
  }

  async function resetLevel(level) {
    if (!state?.id || !canRestore) return;
    const changed = await resetStandardSlotsForLevel(state.id, level);
    if (changed) onUpdate();
  }

  async function usePact() {
    if (!state?.id) return;
    const changed = await spendPactSlot(state.id, state);
    if (changed) onUpdate();
  }

  async function restorePact() {
    if (!state?.id || !canRestore) return;
    const changed = await restorePactSlot(state.id, state);
    if (changed) onUpdate();
  }

  async function choosePlayerUse(level) {
    if (!state?.id) return;
    const { standard, pact } = getSpellSlotAvailability(profile, state, level);
    if (pact.canSpend && standard.canSpend) {
      const usePact = window.confirm(`Use a Warlock pact slot for level ${level}?\n\nOK = Pact slot\nCancel = Standard slot`);
      const changed = await spendSpellSlotWithChoice({ stateId: state.id, profile, state, level, preferPact: usePact });
      if (changed) onUpdate();
      return;
    }
    const changed = await spendSpellSlotWithChoice({ stateId: state.id, profile, state, level });
    if (changed) onUpdate();
  }

  return (
    <div className="slots-grid">
      {activeLevels.map(level => {
        const standard = getStandardSlotState(profile, state, level);
        const pact = getPactSlotState(state, level);
        const allUsed = standard.used >= standard.max;
        const isPlayer = !canRestore && !readOnly;
        const pactOnRow = pact.hasAny && pact.level === level;
        const pactCanPowerThisLevel = pact.canPowerLevel;
        const pactAllUsed = pact.current <= 0;

        return (
          <div key={level} className="slots-row">
            <span className="slots-label">{level}</span>
            {Array.from({ length: standard.max }).map((_, i) => {
              const isUsed = i < standard.used;
              return (
                <button key={`std-${i}`} className={`slot-pip ${isUsed ? 'used' : 'available'}`} onClick={() => {
                  if (readOnly) return;
                  if (canRestore) {
                    if (isUsed) restoreStandard(level);
                    else useStandard(level);
                  }
                }} disabled={readOnly} title={canRestore ? (isUsed ? 'Click to restore slot' : 'Click to use slot') : isUsed ? 'Expended' : 'Available'} style={{ cursor: canRestore ? 'pointer' : 'default' }} />
              );
            })}

            {pactOnRow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: standard.max > 0 ? 8 : 0 }}>
                <span className="slots-empty-label" style={{ color: 'var(--accent-gold)' }}>Pact</span>
                {Array.from({ length: pact.max }).map((_, i) => {
                  const isAvailable = i < pact.current;
                  return <PactPip key={`pact-${i}`} isAvailable={isAvailable} onClick={() => {
                    if (readOnly) return;
                    if (canRestore) {
                      if (isAvailable) usePact();
                      else restorePact();
                    }
                  }} disabled={readOnly} title={canRestore ? (isAvailable ? 'Click to use pact slot' : 'Click to restore pact slot') : isAvailable ? 'Available pact slot' : 'Expended pact slot'} />;
                })}
              </div>
            )}

            {isPlayer && (
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '1px 6px', marginLeft: 4, opacity: (!pactCanPowerThisLevel && allUsed) || (pactCanPowerThisLevel && pactAllUsed && allUsed) ? 0.3 : 1 }} onClick={() => choosePlayerUse(level)} disabled={(!pactCanPowerThisLevel && allUsed) || (pactCanPowerThisLevel && pactAllUsed && allUsed)} title={pactCanPowerThisLevel ? 'Use a standard or pact slot' : allUsed ? 'All slots used' : 'Use one slot'}>Use</button>
            )}

            {canRestore && !readOnly && standard.used > 0 && <button className="slots-reset-btn" onClick={() => resetLevel(level)} title="Restore all standard slots at this level">↺</button>}
            {allUsed && !readOnly && !pactCanPowerThisLevel && <span className="slots-empty-label">expended</span>}
          </div>
        );
      })}
    </div>
  );
}
