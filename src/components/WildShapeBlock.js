import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function WildShapeBlock({ state, readOnly, onUpdate }) {
  const [forms, setForms] = useState([]);

  useEffect(() => {
    supabase.from('profiles_wildshape').select('*').then(({ data }) => setForms(data || []));
  }, []);

  async function toggleActive(val) {
    await supabase
      .from('player_encounter_state')
      .update({ wildshape_active: val, wildshape_form_id: val ? state.wildshape_form_id : null, wildshape_hp_current: null })
      .eq('id', state.id);
    onUpdate();
  }

  async function selectForm(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    await supabase
      .from('player_encounter_state')
      .update({ wildshape_form_id: formId, wildshape_hp_current: form.hp_max, wildshape_active: true })
      .eq('id', state.id);
    onUpdate();
  }

  async function adjustFormHp(delta) {
    const form = forms.find(f => f.id === state.wildshape_form_id);
    if (!form) return;
    const cur = state.wildshape_hp_current ?? form.hp_max;
    const newHp = Math.max(0, Math.min(form.hp_max, cur + delta));
    await supabase
      .from('player_encounter_state')
      .update({ wildshape_hp_current: newHp })
      .eq('id', state.id);
    onUpdate();
  }

  async function adjustUses(delta) {
    const newUses = Math.max(0, (state.wildshape_uses_remaining ?? 2) + delta);
    await supabase
      .from('player_encounter_state')
      .update({ wildshape_uses_remaining: newUses })
      .eq('id', state.id);
    onUpdate();
  }

  const activeForm = forms.find(f => f.id === state.wildshape_form_id);
  const formHp = state.wildshape_hp_current ?? activeForm?.hp_max ?? 0;
  const formMax = activeForm?.hp_max ?? 1;
  const formPct = Math.max(0, Math.min(100, (formHp / formMax) * 100));

  return (
    <div className="wildshape-block">
      <div className="wildshape-header">
        <span className="wildshape-title">🐻 Wild Shape</span>
        <div className="wildshape-uses">
          {!readOnly && <button className="exh-btn" onClick={() => adjustUses(-1)}>−</button>}
          <span className="wildshape-uses-count">{state.wildshape_uses_remaining ?? 2} uses</span>
          {!readOnly && <button className="exh-btn" onClick={() => adjustUses(1)}>+</button>}
        </div>
        {!readOnly && (
          <button
            className={`btn btn-ghost ${state.wildshape_active ? 'active' : ''}`}
            onClick={() => toggleActive(!state.wildshape_active)}
          >
            {state.wildshape_active ? 'Revert' : 'Activate'}
          </button>
        )}
      </div>

      {!readOnly && !state.wildshape_active && forms.length > 0 && (
        <select
          className="form-input"
          value={state.wildshape_form_id || ''}
          onChange={e => selectForm(e.target.value)}
        >
          <option value="">Select form…</option>
          {forms.map(f => (
            <option key={f.id} value={f.id}>{f.form_name} (AC {f.ac}, HP {f.hp_max})</option>
          ))}
        </select>
      )}

      {state.wildshape_active && activeForm && (
        <div className="wildshape-active-block">
          <div className="wildshape-form-name">{activeForm.form_name}</div>
          <div className="hp-bar-wrap">
            <div className="hp-bar-track">
              <div className="hp-bar-fill" style={{ width: `${formPct}%`, background: formPct > 50 ? 'var(--hp-high)' : formPct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)' }} />
            </div>
            <div className="hp-controls">
              {!readOnly && <button className="btn btn-icon btn-danger" onClick={() => adjustFormHp(-1)}>−</button>}
              <span className="hp-value">{formHp} / {formMax}</span>
              {!readOnly && <button className="btn btn-icon btn-success" onClick={() => adjustFormHp(1)}>+</button>}
            </div>
          </div>
          <div className="stats-row">
            <span className="stat-pill"><span className="stat-pill-label">AC</span><span className="stat-pill-value">{activeForm.ac}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}