import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CONDITIONS = [
  { code: 'BLD' }, { code: 'CHM' }, { code: 'DEF' },
  { code: 'FRI' }, { code: 'GRP' }, { code: 'INC' },
  { code: 'INV' }, { code: 'PAR' }, { code: 'PET' },
  { code: 'POI' }, { code: 'PRN' }, { code: 'RES' },
  { code: 'STN' }, { code: 'UNC' },
];

const CONDITION_COLOURS = {
  BLD: '#6a3a3a', CHM: '#3a3a6a', DEF: '#4a4a4a',
  FRI: '#5a3a5a', GRP: '#5a4a2a', INC: '#6a2a2a',
  INV: '#2a4a4a', PAR: '#6a5a2a', PET: '#4a4a3a',
  POI: '#2a5a2a', PRN: '#5a5a2a', RES: '#3a4a5a',
  STN: '#5a3a2a', UNC: '#2a2a2a',
};

function sortCombatants(list) {
  return [...list].sort((a, b) => {
    if (a.initiative_total == null && b.initiative_total == null) return 0;
    if (a.initiative_total == null) return 1;
    if (b.initiative_total == null) return -1;
    return b.initiative_total - a.initiative_total;
  });
}

function hpColor(pct) {
  if (pct > 50) return 'var(--hp-high)';
  if (pct > 25) return 'var(--hp-mid)';
  return 'var(--hp-low)';
}

export default function InitiativePanel({ encounter, combatants, playerStates = [], role, onUpdate }) {
  const isDM = role === 'dm';
  const sorted = sortCombatants(combatants);
  const activeTurnIndex = encounter?.turn_index ?? 0;

  return (
    <div className="panel">
      <div className="panel-title">Initiative Order</div>
      <div className="initiative-list">
        {sorted.length === 0 && <div className="empty-state">No combatants yet.</div>}
        {sorted.map((c, idx) => {
          const playerState = playerStates.find(s => s.combatant_id === c.id);
          return (
            <InitiativeRow
              key={c.id}
              combatant={c}
              playerState={playerState}
              isActive={idx === activeTurnIndex}
              isDM={isDM}
              onUpdate={onUpdate}
            />
          );
        })}
      </div>
      {isDM && encounter && (
        <div style={{ marginTop: 12 }}>
          <AddCombatantInline encounterId={encounter.id} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

function InitiativeRow({ combatant, playerState, isActive, isDM, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [inputValue, setInputValue] = useState(
    combatant.initiative_total != null ? String(combatant.initiative_total) : ''
  );
  const isFocused = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setInputValue(
        combatant.initiative_total != null ? String(combatant.initiative_total) : ''
      );
    }
  }, [combatant.initiative_total]);

  const isPC = combatant.side === 'PC';
  const isEnemy = combatant.side === 'ENEMY' || combatant.side === 'NPC';
  const conditions = combatant.conditions || [];

  // HP — PCs use playerState, enemies use combatant (DM only via RLS)
  const pcHpCurrent = playerState?.current_hp ?? null;
  const pcHpMax = playerState?.profiles_players?.max_hp ?? null;
  const enemyHpCurrent = combatant.hp_current ?? null;
  const enemyHpMax = combatant.hp_max ?? null;

  const hpCurrent = isPC ? pcHpCurrent : (isDM ? enemyHpCurrent : null);
  const hpMax = isPC ? pcHpMax : (isDM ? enemyHpMax : null);
  const hpPct = hpMax > 0 ? Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) : 0;
  const showHpBar = hpCurrent !== null && hpMax !== null && hpMax > 0;

  // PC status
  const concentration = playerState?.concentration ?? false;
  const reactionUsed = playerState?.reaction_used ?? false;
  const tempHp = playerState?.temp_hp ?? 0;

  // PC conditions come from playerState for display, enemy conditions from combatant
  const displayConditions = isPC
    ? (playerState?.conditions || [])
    : conditions;

  async function saveInitiative() {
    if (savingRef.current) return;
    const total = parseInt(inputValue, 10);
    if (isNaN(total)) return;
    savingRef.current = true;
    await supabase.rpc('set_initiative', {
      p_combatant_id: combatant.id,
      p_total: total,
    });
    savingRef.current = false;
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

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''}`} style={{ display: 'block', padding: '8px 12px' }}>
      {/* Main row */}
      <div className="initiative-row-main" onClick={() => isDM && isEnemy && setExpanded(e => !e)}>
        {isDM ? (
          <input
            className="initiative-number-input"
            type="number"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onFocus={() => { isFocused.current = true; }}
            onBlur={() => { isFocused.current = false; saveInitiative(); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            placeholder="—"
          />
        ) : (
          <span className="initiative-number">{combatant.initiative_total ?? '—'}</span>
        )}

        <div className="initiative-name-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="initiative-name">{combatant.name}</span>
            <span className={`badge badge-${combatant.side.toLowerCase()}`}>{combatant.side}</span>
            {combatant.public_status === 'BLOODIED' && (
              <span className="badge badge-bloodied">BLOODIED</span>
            )}
          </div>
        </div>

        {isDM && isEnemy && (
          <span className="expand-toggle">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* HP bar */}
      {showHpBar && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            height: 5,
            background: 'var(--bg-panel-3)',
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              height: '100%',
              width: `${hpPct}%`,
              background: hpColor(hpPct),
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
            {isPC && tempHp > 0 && hpMax > 0 && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: `${hpPct}%`,
                width: `${Math.min(100 - hpPct, (tempHp / hpMax) * 100)}%`,
                height: '100%',
                background: 'var(--hp-temp)',
                opacity: 0.7,
                borderRadius: 3,
              }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {hpCurrent}{tempHp > 0 ? ` (+${tempHp})` : ''} / {hpMax}
            </span>
            {/* Status icons */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isPC && concentration && (
                <span style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700 }}>🔮CON</span>
              )}
              {isPC && (
                <span style={{ fontSize: 10, color: reactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)', opacity: reactionUsed ? 0.4 : 1 }}>
                  ⚡
                </span>
              )}
              {displayConditions.filter(c => !c.startsWith('EXH')).map(code => (
                <span
                  key={code}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: CONDITION_COLOURS[code] || 'var(--cond-default)',
                    color: 'var(--text-primary)',
                    cursor: isDM && isEnemy ? 'pointer' : 'default',
                  }}
                  onClick={e => { e.stopPropagation(); if (isDM && isEnemy) toggleCondition(code); }}
                >{code}</span>
              ))}
              {displayConditions.filter(c => c.startsWith('EXH')).map(code => (
                <span
                  key={code}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: '#2a1a3a',
                    color: 'var(--accent-purple)',
                  }}
                >{code}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Enemy expanded DM controls */}
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