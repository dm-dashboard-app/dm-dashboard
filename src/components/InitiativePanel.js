import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

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
        {combatants.length === 0 && (
          <div className="empty-state">No combatants yet.</div>
        )}
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
  const [dmHp, setDmHp] = useState(combatant.hp_current);
  const [initRoll, setInitRoll] = useState(combatant.initiative_roll ?? '');

  const isEnemy = combatant.side === 'ENEMY' || combatant.side === 'NPC';

  async function updateInitiative(val) {
    const roll = parseInt(val);
    if (isNaN(roll)) return;
    await supabase
      .from('combatants')
      .update({ initiative_roll: roll })
      .eq('id', combatant.id);
    onUpdate();
  }

  async function adjustMonsterHp(delta) {
    const newHp = Math.max(0, (combatant.hp_current ?? 0) + delta);
    await supabase
      .from('combatants')
      .update({ hp_current: newHp })
      .eq('id', combatant.id);
    setDmHp(newHp);
    onUpdate();
  }

  async function removeCondition(cond) {
    const updated = (combatant.conditions || []).filter(c => c !== cond);
    await supabase
      .from('combatants')
      .update({ conditions: updated })
      .eq('id', combatant.id);
    onUpdate();
  }

  async function removeCombatant() {
    await supabase.from('combatants').delete().eq('id', combatant.id);
    onUpdate();
  }

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''}`}>
      <div className="initiative-row-main" onClick={() => isDM && isEnemy && setExpanded(e => !e)}>
        {/* Initiative number */}
        {isDM ? (
          <input
            className="initiative-number-input"
            type="number"
            value={initRoll}
            onChange={e => setInitRoll(e.target.value)}
            onBlur={e => updateInitiative(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && updateInitiative(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="initiative-number">{combatant.initiative_total ?? '—'}</span>
        )}

        {/* Name + badges */}
        <div className="initiative-name-block">
          <span className="initiative-name">{combatant.name}</span>
          <div className="initiative-badges">
            <span className={`badge badge-${combatant.side.toLowerCase()}`}>{combatant.side}</span>
            {combatant.public_status === 'BLOODIED' && (
              <span className="badge badge-bloodied">BLOODIED</span>
            )}
            {combatant.concentration && (
              <span className="condition-chip condition-chip-con">CON</span>
            )}
            {(combatant.conditions || []).map(cond => (
              <span
                key={cond}
                className="condition-chip"
                style={{ background: CONDITION_COLOURS[cond] || 'var(--cond-default)' }}
              >
                {cond}
              </span>
            ))}
          </div>
        </div>

        {/* Public status for non-DM */}
        {!isDM && isEnemy && combatant.public_status && (
          <span className="badge badge-bloodied">{combatant.public_status}</span>
        )}

        {/* DM expand toggle for monsters */}
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
          {combatant.notes && (
            <div className="monster-notes">{combatant.notes}</div>
          )}
          <button className="btn btn-danger" style={{ marginTop: 8 }} onClick={removeCombatant}>
            Remove
          </button>
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
    <button className="btn btn-ghost" onClick={() => setOpen(true)}>
      + Add Combatant
    </button>
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