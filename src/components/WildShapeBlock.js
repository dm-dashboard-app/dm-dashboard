import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function WildShapeBlock({ state, readOnly, canRestore, onUpdate }) {
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(state.wildshape_form_id || '');
  const [localHp, setLocalHp] = useState(null);
  const [localUses, setLocalUses] = useState(state.wildshape_uses_remaining ?? 2);

  useEffect(() => {
    supabase.from('profiles_wildshape').select('*').order('form_name').then(({ data }) => {
      setForms(data || []);
    });
  }, []);

  useEffect(() => {
    setLocalUses(state.wildshape_uses_remaining ?? 2);
    setLocalHp(null);
    if (state.wildshape_form_id) setSelectedFormId(state.wildshape_form_id);
  }, [state.wildshape_uses_remaining, state.wildshape_form_id, state.wildshape_hp_current]);

  const activeForm = forms.find(f => f.id === state.wildshape_form_id);
  const formHpDb = state.wildshape_hp_current ?? activeForm?.hp_max ?? 0;
  const formHp = localHp !== null ? localHp : formHpDb;
  const formMax = activeForm?.hp_max ?? 1;
  const formPct = Math.max(0, Math.min(100, (formHp / formMax) * 100));

  async function handleActivate() {
    if (!selectedFormId) return;
    const form = forms.find(f => f.id === selectedFormId);
    if (!form) return;
    const newUses = Math.max(0, localUses - 1);
    setLocalUses(newUses);
    await supabase.from('player_encounter_state').update({
      wildshape_active: true,
      wildshape_form_id: selectedFormId,
      wildshape_hp_current: form.hp_max,
      wildshape_uses_remaining: newUses,
    }).eq('id', state.id);
    onUpdate();
  }

  async function handleRevert() {
    await supabase.from('player_encounter_state').update({
      wildshape_active: false,
    }).eq('id', state.id);
    onUpdate();
  }

  async function adjustFormHp(delta) {
    if (!activeForm) return;
    const newHp = Math.max(0, Math.min(formMax, formHp + delta));
    setLocalHp(newHp);
    await supabase.from('player_encounter_state').update({
      wildshape_hp_current: newHp,
    }).eq('id', state.id);
    onUpdate();
  }

  async function adjustUses(delta) {
    const newUses = Math.max(0, Math.min(2, localUses + delta));
    setLocalUses(newUses);
    await supabase.from('player_encounter_state').update({
      wildshape_uses_remaining: newUses,
    }).eq('id', state.id);
    onUpdate();
  }

  return (
    <div className="wildshape-block">
      {/* Header row — uses tracker */}
      <div className="wildshape-header">
        <span className="wildshape-title">🐻 Wild Shape</span>
        <div className="wildshape-uses">
          {/* Anyone not in readOnly can spend a use */}
          {!readOnly && (
            <button className="exh-btn" onClick={() => adjustUses(-1)} disabled={localUses <= 0}>−</button>
          )}
          <span className="wildshape-uses-count">{localUses} uses</span>
          {/* Only DM can restore uses */}
          {canRestore && (
            <button className="exh-btn" onClick={() => adjustUses(1)} disabled={localUses >= 2}>+</button>
          )}
        </div>
      </div>

      {/* Not active — show form selector + activate button */}
      {!state.wildshape_active && !readOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {forms.length === 0 ? (
            <div className="empty-state">No wild shape forms. Add them in Manage.</div>
          ) : (
            <>
              <select
                className="form-input"
                value={selectedFormId}
                onChange={e => setSelectedFormId(e.target.value)}
              >
                <option value="">Select form…</option>
                {forms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.form_name} (AC {f.ac}, HP {f.hp_max})
                  </option>
                ))}
              </select>
              <button
                className="btn btn-success"
                onClick={handleActivate}
                disabled={!selectedFormId || localUses <= 0}
              >
                {localUses <= 0 ? 'No uses remaining' : 'Activate Wild Shape'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Active — show form HP + revert */}
      {state.wildshape_active && activeForm && (
        <div className="wildshape-active-block">
          <div className="wildshape-form-name">{activeForm.form_name}</div>

          <div className="hp-bar-wrap">
            <div className="hp-bar-track">
              <div
                className="hp-bar-fill"
                style={{
                  width: `${formPct}%`,
                  background: formPct > 50 ? 'var(--hp-high)' : formPct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)'
                }}
              />
            </div>
            <div className="hp-controls">
              {!readOnly && (
                <button className="btn btn-icon btn-danger" onClick={() => adjustFormHp(-1)}>−</button>
              )}
              <span className="hp-value">{formHp} <span className="hp-max-label">/ {formMax}</span></span>
              {!readOnly && (
                <button className="btn btn-icon btn-success" onClick={() => adjustFormHp(1)}>+</button>
              )}
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-pill">
              <span className="stat-pill-label">AC</span>
              <span className="stat-pill-value">{activeForm.ac}</span>
            </div>
            {['str','dex','con','int','wis','cha'].map(s => (
              <div key={s} className="stat-pill">
                <span className="stat-pill-label">{s.toUpperCase()}</span>
                <span className="stat-pill-value">{activeForm[`save_${s}`] >= 0 ? '+' : ''}{activeForm[`save_${s}`]}</span>
              </div>
            ))}
          </div>

          {!readOnly && (
            <button className="btn btn-ghost" onClick={handleRevert}>
              Revert to Normal Form
            </button>
          )}
        </div>
      )}
    </div>
  );
}