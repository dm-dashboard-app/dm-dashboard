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
    if (a.initiative_total == null && b.initiative_total == null) return a.id < b.id ? -1 : 1;
    if (a.initiative_total == null) return 1;
    if (b.initiative_total == null) return -1;
    if (b.initiative_total !== a.initiative_total) return b.initiative_total - a.initiative_total;
    const aMod = a.initiative_mod ?? 0;
    const bMod = b.initiative_mod ?? 0;
    if (bMod !== aMod) return bMod - aMod;
    return a.id < b.id ? -1 : 1;
  });
}

function formatMod(val) {
  if (val === undefined || val === null) return '+0';
  return val >= 0 ? `+${val}` : `${val}`;
}

function hpColor(pct) {
  if (pct > 50) return 'var(--hp-high)';
  if (pct > 25) return 'var(--hp-mid)';
  return 'var(--hp-low)';
}

function MiniHpBar({ current, max, tempHp = 0, color = null, label = null }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const barColor = color || hpColor(pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      )}
      <div style={{ height: 5, background: 'var(--bg-panel-3)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s ease' }} />
        {tempHp > 0 && max > 0 && (
          <div style={{ position: 'absolute', top: 0, left: `${pct}%`, width: `${Math.min(100 - pct, (tempHp / max) * 100)}%`, height: '100%', background: 'var(--hp-temp)', opacity: 0.7, borderRadius: 3 }} />
        )}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        {current}{tempHp > 0 ? ` (+${tempHp})` : ''} / {max}
      </span>
    </div>
  );
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
      setInputValue(combatant.initiative_total != null ? String(combatant.initiative_total) : '');
    }
  }, [combatant.initiative_total]);

  const isPC = combatant.side === 'PC';
  const isEnemy = combatant.side === 'ENEMY' || combatant.side === 'NPC';
  const conditions = combatant.conditions || [];

  const pcHpCurrent = playerState?.current_hp ?? null;
  const pcHpMax = playerState?.max_hp_override ?? playerState?.profiles_players?.max_hp ?? null;
  const tempHp = playerState?.temp_hp ?? 0;
  const concentration = playerState?.concentration ?? false;
  const reactionUsed = playerState?.reaction_used ?? false;
  const displayConditions = isPC ? (playerState?.conditions || []) : conditions;

  const wsActive = playerState?.wildshape_active ?? false;
  const wsHpCurrent = playerState?.wildshape_hp_current ?? 0;
  const wsFormName = playerState?.wildshape_form_name ?? null;
  const wsHpMax = playerState?.wildshape_hp_max ?? null;

  const enemyHpCurrent = combatant.hp_current ?? null;
  const enemyHpMax = combatant.hp_max ?? null;

  const showPcHp = isPC && pcHpCurrent !== null && pcHpMax !== null;
  const showEnemyHp = isEnemy && isDM && enemyHpCurrent !== null && enemyHpMax !== null;

  // Has any non-zero ability modifier been saved
  const hasAbilityMods = isEnemy && ['str','dex','con','int','wis','cha'].some(s => (combatant[`mod_${s}`] ?? 0) !== 0);

  async function saveInitiative() {
    if (savingRef.current) return;
    const total = parseInt(inputValue, 10);
    if (isNaN(total)) return;
    savingRef.current = true;
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: total });
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

  // PC condition management (DM in initiative panel)
  async function togglePcCondition(code) {
    if (!playerState) return;
    const conds = playerState.conditions || [];
    const updated = conds.includes(code) ? conds.filter(c => c !== code) : [...conds, code];
    await supabase.from('player_encounter_state').update({ conditions: updated }).eq('id', playerState.id);
    onUpdate();
  }

  // PC HP adjustment from initiative panel (DM)
  async function adjustPcHp(delta) {
    if (!playerState) return;
    const tempHpVal = playerState.temp_hp ?? 0;
    if (delta < 0 && tempHpVal > 0) {
      const newTemp = Math.max(0, tempHpVal + delta);
      await supabase.from('player_encounter_state').update({ temp_hp: newTemp }).eq('id', playerState.id);
      onUpdate();
      return;
    }
    const max = playerState.max_hp_override ?? playerState.profiles_players?.max_hp ?? 1;
    const current = playerState.current_hp ?? 0;
    const newHp = Math.max(0, Math.min(max, current + delta));
    const conds = playerState.conditions || [];
    const updates = { current_hp: newHp };
    if (newHp === 0 && !conds.includes('UNC')) updates.conditions = [...conds, 'UNC'];
    else if (newHp > 0 && conds.includes('UNC')) updates.conditions = conds.filter(c => c !== 'UNC');
    await supabase.from('player_encounter_state').update(updates).eq('id', playerState.id);
    onUpdate();
  }

  // Max HP override (DM, from initiative panel)
  async function adjustPcMaxHp(delta) {
    if (!playerState) return;
    const profileMax = playerState.profiles_players?.max_hp ?? 1;
    const current = playerState.max_hp_override ?? profileMax;
    const newMax = Math.max(1, current + delta);
    const override = newMax === profileMax ? null : newMax;
    await supabase.from('player_encounter_state').update({ max_hp_override: override }).eq('id', playerState.id);
    onUpdate();
  }

  async function resetPcMaxHp() {
    if (!playerState) return;
    await supabase.from('player_encounter_state').update({ max_hp_override: null }).eq('id', playerState.id);
    onUpdate();
  }

  async function removeCombatant() {
    if (!window.confirm(`Remove ${combatant.name}?`)) return;
    await supabase.from('combatants').delete().eq('id', combatant.id);
    onUpdate();
  }

  const canExpand = isDM && (isEnemy || isPC);
  const pcEffectiveMax = playerState?.max_hp_override ?? playerState?.profiles_players?.max_hp ?? 1;

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''}`} style={{ display: 'block', padding: '8px 12px' }}>

      {/* Main row */}
      <div className="initiative-row-main" onClick={() => canExpand && setExpanded(e => !e)}>
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
            {combatant.public_status === 'BLOODIED' && <span className="badge badge-bloodied">BLOODIED</span>}
            {wsActive && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#1a3a1a', color: 'var(--accent-green)' }}>🐻 BEAST</span>}
            {isPC && playerState?.max_hp_override != null && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: '#3a2e00', color: 'var(--accent-gold)' }}>MAX✦</span>
            )}
          </div>
        </div>

        {canExpand && <span className="expand-toggle">{expanded ? '▲' : '▼'}</span>}
      </div>

      {/* Mini-status: HP bars + badges */}
      {(showPcHp || showEnemyHp) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isPC && wsActive && wsHpMax != null && (
            <MiniHpBar current={wsHpCurrent} max={wsHpMax} color="var(--accent-green)" label={wsFormName ? `🐻 ${wsFormName}` : '🐻 Beast Form'} />
          )}
          {showPcHp && <MiniHpBar current={pcHpCurrent} max={pcHpMax} tempHp={tempHp} label={wsActive ? 'Player HP' : null} />}
          {showEnemyHp && <MiniHpBar current={enemyHpCurrent} max={enemyHpMax} />}

          {isPC && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {concentration && <span style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700 }}>🔮CON</span>}
              <span style={{ fontSize: 10, color: reactionUsed ? 'var(--text-muted)' : 'var(--accent-gold)', opacity: reactionUsed ? 0.4 : 1 }}>⚡</span>
              {/* Condition chips — single click removes for DM */}
              {displayConditions.filter(c => !c.startsWith('EXH')).map(code => (
                <span
                  key={code}
                  style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: CONDITION_COLOURS[code] || 'var(--cond-default)', color: 'var(--text-primary)', cursor: isDM ? 'pointer' : 'default' }}
                  onClick={isDM ? e => { e.stopPropagation(); togglePcCondition(code); } : undefined}
                  title={isDM ? `Remove ${code}` : code}
                >{code}</span>
              ))}
              {displayConditions.filter(c => c.startsWith('EXH')).map(code => (
                <span key={code} style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: '#2a1a3a', color: 'var(--accent-purple)' }}>{code}</span>
              ))}
            </div>
          )}

          {isEnemy && isDM && conditions.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {conditions.map(code => (
                <span
                  key={code}
                  style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: CONDITION_COLOURS[code] || 'var(--cond-default)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); toggleCondition(code); }}
                  title={`Remove ${code}`}
                >{code}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DM expanded: PC controls ── */}
      {isDM && isPC && expanded && playerState && (
        <div className="monster-dm-controls">
          {/* HP */}
          <div className="hp-controls" style={{ marginBottom: 8 }}>
            <button className="btn btn-icon btn-danger" onClick={e => { e.stopPropagation(); adjustPcHp(-1); }}>−</button>
            <span className="hp-value" style={{ margin: '0 8px' }}>
              {playerState.current_hp ?? 0}
              {(playerState.temp_hp ?? 0) > 0 && <span style={{ fontSize: 12, color: 'var(--hp-temp)', marginLeft: 4 }}>+{playerState.temp_hp} tmp</span>}
            </span>
            <button className="btn btn-icon btn-success" onClick={e => { e.stopPropagation(); adjustPcHp(1); }}>+</button>
          </div>

          {/* Max HP override */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Max HP:</span>
            <button className="exh-btn" onClick={e => { e.stopPropagation(); adjustPcMaxHp(-1); }}>−</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: playerState.max_hp_override != null ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
              {pcEffectiveMax}
            </span>
            <button className="exh-btn" onClick={e => { e.stopPropagation(); adjustPcMaxHp(1); }}>+</button>
            {playerState.max_hp_override != null && (
              <button className="slots-reset-btn" onClick={e => { e.stopPropagation(); resetPcMaxHp(); }} title="Reset to profile max">↺</button>
            )}
          </div>

          {/* Conditions */}
          <div>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={e => { e.stopPropagation(); setCondPickerOpen(p => !p); }}>
              {condPickerOpen ? 'Close Conditions' : '+ Conditions'}
            </button>
            {condPickerOpen && (
              <div className="condition-picker" style={{ marginTop: 6 }}>
                {CONDITIONS.map(({ code }) => (
                  <button
                    key={code}
                    className={`condition-picker-btn ${displayConditions.includes(code) ? 'active' : ''}`}
                    style={{ background: displayConditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
                    onClick={e => { e.stopPropagation(); togglePcCondition(code); }}
                  >{code}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DM expanded: Enemy/NPC controls ── */}
      {isDM && isEnemy && expanded && (
        <div className="monster-dm-controls">
          {/* HP */}
          <div className="hp-controls" style={{ marginBottom: 8 }}>
            <button className="btn btn-icon btn-danger" onClick={e => { e.stopPropagation(); adjustMonsterHp(-1); }}>−</button>
            <span className="hp-value" style={{ margin: '0 8px' }}>{combatant.hp_current} / {combatant.hp_max}</span>
            <button className="btn btn-icon btn-success" onClick={e => { e.stopPropagation(); adjustMonsterHp(1); }}>+</button>
          </div>

          {/* Ability modifiers — shown when at least one is non-zero */}
          {hasAbilityMods && (
            <div className="saves-grid" style={{ marginBottom: 8 }}>
              {['str','dex','con','int','wis','cha'].map(s => (
                <div key={s} className="save-cell">
                  <span className="save-label">{s.toUpperCase()}</span>
                  <span className="save-value">{formatMod(combatant[`mod_${s}`] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Conditions */}
          <div style={{ marginBottom: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={e => { e.stopPropagation(); setCondPickerOpen(p => !p); }}>
              {condPickerOpen ? 'Close Conditions' : '+ Conditions'}
            </button>
            {condPickerOpen && (
              <div className="condition-picker" style={{ marginTop: 6 }}>
                {CONDITIONS.map(({ code }) => (
                  <button
                    key={code}
                    className={`condition-picker-btn ${conditions.includes(code) ? 'active' : ''}`}
                    style={{ background: conditions.includes(code) ? CONDITION_COLOURS[code] : undefined }}
                    onClick={e => { e.stopPropagation(); toggleCondition(code); }}
                  >{code}</button>
                ))}
              </div>
            )}
          </div>

          {combatant.notes && <div className="monster-notes" style={{ marginBottom: 8 }}>{combatant.notes}</div>}
          <button className="btn btn-danger" onClick={e => { e.stopPropagation(); removeCombatant(); }}>Remove</button>
        </div>
      )}
    </div>
  );
}

function AddCombatantInline({ encounterId, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState('');
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [mod, setMod] = useState(0);
  const [side, setSide] = useState('ENEMY');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && mode === 'template') {
      supabase.from('profiles_monsters').select('*').order('name').then(({ data }) => {
        setTemplates(data || []);
      });
    }
  }, [open, mode]);

  async function addFromTemplate(template) {
    setAdding(true);
    await supabase.from('combatants').insert({
      encounter_id: encounterId,
      name: template.name,
      side: template.side || 'ENEMY',
      ac: template.ac,
      hp_max: template.hp_max,
      hp_current: template.hp_max,
      initiative_mod: template.initiative_mod || 0,
      notes: template.notes || null,
      mod_str: template.mod_str || 0,
      mod_dex: template.mod_dex || 0,
      mod_con: template.mod_con || 0,
      mod_int: template.mod_int || 0,
      mod_wis: template.mod_wis || 0,
      mod_cha: template.mod_cha || 0,
    });
    setAdding(false);
    onUpdate();
  }

  async function addManual() {
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
    onUpdate();
  }

  if (!open) return (
    <button className="btn btn-ghost" onClick={() => setOpen(true)}>+ Add Combatant</button>
  );

  const filteredTemplates = templateFilter === 'ALL'
    ? templates
    : templates.filter(t => t.side === templateFilter);

  return (
    <div className="add-combatant-form">
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'template' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'template' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
          onClick={() => setMode('template')}>From Template</button>
        <button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'manual' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'manual' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
          onClick={() => setMode('manual')}>Manual</button>
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}>✕</button>
      </div>

      {mode === 'template' && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'ENEMY', 'NPC'].map(f => (
              <button key={f} className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderColor: templateFilter === f ? 'var(--accent-blue)' : 'var(--border)', color: templateFilter === f ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                onClick={() => setTemplateFilter(f)}>{f}</button>
            ))}
          </div>
          {templates.length === 0 && <div className="empty-state">No templates yet. Add them in Manage.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {filteredTemplates.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                <div>
                  <span className={`badge badge-${(t.side || 'enemy').toLowerCase()}`} style={{ marginRight: 6 }}>{t.side || 'ENEMY'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>AC {t.ac} HP {t.hp_max}</span>
                </div>
                <button className="btn btn-primary btn-icon" onClick={() => addFromTemplate(t)} disabled={adding} style={{ fontSize: 16, minWidth: 32, minHeight: 32 }}>+</button>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'manual' && (
        <>
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
            <button className="btn btn-primary" onClick={addManual} disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}