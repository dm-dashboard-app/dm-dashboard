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

export default function InitiativePanel({ encounter, combatants, role, onUpdate }) {
  const isDM = role === 'dm';
  const activeTurnIndex = encounter?.turn_index ?? 0;

  return (
    <div className="panel">
      <div className="panel-title">Initiative Order</div>
      <div className="initiative-list">
        {combatants.length === 0 && <div className="empty-state">No combatants yet.</div>}
        {combatants.map((c, idx) => (
          <InitiativeRow
            key={c.id}
            combatant={c}
            isActive={idx === activeTurnIndex}
            isDM={isDM}
            onUpdate={onUpdate}
          />
        ))}
      </div>
      {isDM && encounter && (
        <div style={{ marginTop: 12 }}>
          <AddCombatantInline encounterId={encounter.id} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

function InitiativeRow({ combatant, isActive, isDM, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  // Draft input — separate from combatant prop so typing doesn't fight re-renders
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const isEnemy = combatant.side === 'ENEMY' || combatant.side === 'NPC';
  const conditions = combatant.conditions || [];

  async function commitInitiative(val) {
    const total = parseInt(val);
    if (isNaN(total)) { setEditing(false); return; }
    await supabase.rpc('set_initiative', {
      p_combatant_id: combatant.id,
      p_total: total,
    });
    setEditing(false);
    onUpdate();
  }

  async function adjustMonsterHp(delta) {
    const newHp = Math.max(0, (combatant.hp_current ?? 0) + delta);
    await supabase.from('combatants').update({ hp_current: newHp }).eq('id', combatant.id);
    onUpdate();
  }

  async function toggleCondition(code) {
    const updated = conditions.includes(code)
      ? conditions.filter(c => c !== code)
      : [...conditions, code];
    await supabase.from('combatants').update({ conditions: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function removeCombatant() {
    if (!window.confirm(`Remove ${combatant.name}?`)) return;
    await supabase.from('combatants').delete().eq('id', combatant.id);
    onUpdate();
  }

  const showBlooded = combatant.public_status === 'BLOODIED';

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''}`}>
      <div className="initiative-row-main" onClick={() => isDM && isEnemy && setExpanded(e => !e)}>

        {/* Initiative number — DM gets editable input */}
        {isDM ? (
          editing ? (
            <input
              className="initiative-number-input"
              type="number"
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={() => commitInitiative(draft)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitInitiative(draft);
                if (e.key === 'Escape') setEditing(false);
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className="initiative-number"
              onClick={e => {
                e.stopPropagation();
                setDraft(combatant.initiative_total != null ? String(combatant.initiative_total) : '');
                setEditing(true);
              }}
              style={{ cursor: 'text', minWidth: 32, display: 'inline-block', textAlign: 'center' }}
            >
              {combatant.initiative_total ?? '—'}
            </span>
          )
        ) : (
          <span className="initiative-number">{combatant.initiative_total ?? '—'}</span>
        )}

        {/* Name + badges */}
        <div className="initiative-name-block">
          <span className="initiative-name">{combatant.name}</span>
          <div className="initiative-badges">
            <span className={`badge badge-${combatant.side.toLowerCase()}`}>{combatant.side}</span>
            {showBlooded && <span className="badge badge-bloodied">BLOODIED</span>}
            {combatant.concentration && <span className="condition-chip condition-chip-con">CON</span>}
            {conditions.map(cond => (
              <span
                key={cond}
                className="condition-chip"
                style={{ background: CONDITION_COLOURS[cond] || 'var(--cond-default)', cursor: isDM ? 'pointer' : 'default' }}
                onClick={e => { e.stopPropagation(); isDM && toggleCondition(cond); }}
                title={isDM ? `Remove ${cond}` : cond}
              >{cond}</span>
            ))}
          </div>
        </div>

        {isDM && isEnemy && (
          <span className="expand-toggle">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* DM expanded monster controls */}
      {isDM && isEnemy && expanded && (
        <div className="monster-dm-controls">
          <div className="hp-controls" style={{ marginBottom: 8 }}>
            <button className="btn btn-icon btn-danger" onClick={() => adjustMonsterHp(-1)}>−</button>
            <span className="hp-value" style={{ margin: '0 8px' }}>
              {combatant.hp_current} / {combatant.hp_max}
            </span>
            <button className="btn btn-icon btn-success" onClick={() => adjustMonsterHp(1)}>+</button>
          </div>

          <div style={{ marginBottom: 8 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '2px 8px' }}
              onClick={() => setCondPickerOpen(p => !p)}
            >
              {condPickerOpen ? 'Close Conditions' : '+ Conditions'}
            </button>
            {condPickerOpen && (
              <div className="condition-picker" style={{ marginTop: 6 }}>
                {CONDITIONS.map(({ code }) => (
                  <button
                    key={code}
                    className={`condition-picker-btn ${conditions.includes(code) ? 'active' : ''}`}
                    style={{ background: conditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
                    onClick={() => toggleCondition(code)}
                  >{code}</button>
                ))}
              </div>
            )}
          </div>

          {combatant.notes && <div className="monster-notes">{combatant.notes}</div>}
          <button className="btn btn-danger" onClick={removeCombatant}>Remove</button>
        </div>
      )}
    </div>
  );
}

function AddCombatantInline({ encounterId, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [mod, setMod] = useState(0);
  const [side, setSide] = useState('ENEMY');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('combatants').insert({
      encounter_id: encounterId,
      name: name.trim(),
      side,
      ac: parseInt(ac),
      hp_max: parseInt(hp),
      hp_current: parseInt(hp),
      initiative_mod: parseInt(mod),
    });
    setName(''); setAc(10); setHp(10); setMod(0);
    setSaving(false);
    setOpen(false);
    onUpdate();
  }

  if (!open) return (
    <button className="btn btn-ghost" onClick={() => setOpen(true)}>+ Add Combatant</button>
  );

  return (
    <div className="add-combatant-form">
      <input className="form-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Side</label>
          <select className="form-input" value={side} onChange={e => setSide(e.target.value)}>
            <option value="ENEMY">Enemy</option>
            <option value="NPC">NPC</option>
            <option value="PC">PC</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">AC</label>
          <input className="form-input" type="number" value={ac} onChange={e => setAc(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">HP</label>
          <input className="form-input" type="number" value={hp} onChange={e => setHp(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Init Mod</label>
          <input className="form-input" type="number" value={mod} onChange={e => setMod(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}