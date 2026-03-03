import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const CONDITIONS = [
  { code: 'BLD', label: 'Blinded' },
  { code: 'CHM', label: 'Charmed' },
  { code: 'DEF', label: 'Deafened' },
  { code: 'FRI', label: 'Frightened' },
  { code: 'GRP', label: 'Grappled' },
  { code: 'INC', label: 'Incapacitated' },
  { code: 'INV', label: 'Invisible' },
  { code: 'PAR', label: 'Paralyzed' },
  { code: 'PET', label: 'Petrified' },
  { code: 'POI', label: 'Poisoned' },
  { code: 'PRN', label: 'Prone' },
  { code: 'RES', label: 'Restrained' },
  { code: 'STN', label: 'Stunned' },
  { code: 'UNC', label: 'Unconscious' },
];

const CONDITION_COLOURS = {
  BLD: '#6a3a3a', CHM: '#3a3a6a', DEF: '#4a4a4a',
  FRI: '#5a3a5a', GRP: '#5a4a2a', INC: '#6a2a2a',
  INV: '#2a4a4a', PAR: '#6a5a2a', PET: '#4a4a3a',
  POI: '#2a5a2a', PRN: '#5a5a2a', RES: '#3a4a5a',
  STN: '#5a3a2a', UNC: '#2a2a2a',
};

export default function ConditionChipRow({ conditions, concentration, stateId, readOnly, onUpdate }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exhLevel, setExhLevel] = useState(() => {
    const exh = (conditions || []).find(c => c.startsWith('EXH'));
    return exh ? parseInt(exh.replace('EXH', '')) : 0;
  });

  async function addCondition(code) {
    if (!stateId || readOnly) return;
    const updated = [...new Set([...(conditions || []), code])];
    await supabase.from('player_encounter_state').update({ conditions: updated }).eq('id', stateId);
    onUpdate();
  }

  async function removeCondition(code) {
    if (!stateId || readOnly) return;
    const updated = (conditions || []).filter(c => c !== code);
    await supabase.from('player_encounter_state').update({ conditions: updated }).eq('id', stateId);
    onUpdate();
  }

  async function setExhaustion(level) {
    if (!stateId || readOnly) return;
    const filtered = (conditions || []).filter(c => !c.startsWith('EXH'));
    const updated = level > 0 ? [...filtered, `EXH${level}`] : filtered;
    await supabase.from('player_encounter_state').update({ conditions: updated }).eq('id', stateId);
    setExhLevel(level);
    onUpdate();
  }

  const activeConditions = (conditions || []).filter(c => !c.startsWith('EXH'));

  return (
    <div className="conditions-wrap">
      <div className="conditions-row">
        {activeConditions.map(code => (
          <span
            key={code}
            className="condition-chip"
            style={{ background: CONDITION_COLOURS[code] || 'var(--cond-default)', cursor: readOnly ? 'default' : 'pointer' }}
            onClick={() => !readOnly && removeCondition(code)}
            title={readOnly ? code : `Remove ${code}`}
          >
            {code}
          </span>
        ))}

        {exhLevel > 0 && (
          <span className="condition-chip condition-chip-exh">
            EXH{exhLevel}
            {!readOnly && (
              <>
                <button className="exh-btn" onClick={() => setExhaustion(Math.max(0, exhLevel - 1))}>−</button>
                <button className="exh-btn" onClick={() => setExhaustion(Math.min(6, exhLevel + 1))}>+</button>
              </>
            )}
          </span>
        )}

        {!readOnly && (
          <button
            className="condition-add-btn"
            onClick={() => setPickerOpen(p => !p)}
            title="Add condition"
          >
            {pickerOpen ? '✕' : '+'}
          </button>
        )}
      </div>

      {pickerOpen && !readOnly && (
        <div className="condition-picker">
          {CONDITIONS.map(({ code, label }) => (
            <button
              key={code}
              className={`condition-picker-btn ${activeConditions.includes(code) ? 'active' : ''}`}
              style={{ background: activeConditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
              onClick={() => activeConditions.includes(code) ? removeCondition(code) : addCondition(code)}
            >
              {code}
            </button>
          ))}
          <div className="exh-picker-row">
            <span className="form-label">EXH</span>
            {[0,1,2,3,4,5,6].map(n => (
              <button
                key={n}
                className={`condition-picker-btn ${exhLevel === n ? 'active' : ''}`}
                onClick={() => setExhaustion(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}