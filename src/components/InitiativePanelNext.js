import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { MODS, CONDITIONS, CONDITION_COLOURS, DAMAGE_TYPES } from './initiative/initiativeConstants';
import { compactObject, formatClassLine, getDisplayOrderedCombatants, logCombat, nextZeroHpConditions, sortCombatants, toInt } from './initiative/initiativeUtils';
import InitiativeInlineDmgHeal from './initiative/InitiativeInlineDmgHeal';
import InitiativeEnemySlotGrid from './initiative/InitiativeEnemySlotGrid';
import InitiativeLegendaryPips from './initiative/InitiativeLegendaryPips';
import InitiativeNameplate from './initiative/InitiativeNameplate';
import { applyPlayerDamage, applyPlayerHeal } from '../utils/playerStateMutations';

export default function InitiativePanelNext({ encounter, combatants, playerStates = [], role, onUpdate }) {
  const isDM = role === 'dm';
  const isDisplay = role === 'display';
  const sortedOriginal = sortCombatants(combatants);
  const activeTurnIndex = encounter?.turn_index ?? 0;
  const displayOrdered = getDisplayOrderedCombatants(sortedOriginal, activeTurnIndex);
  const [showAddCombatant, setShowAddCombatant] = useState(false);
  const activeRowRef = useRef(null);
  const activeCombatantId = sortedOriginal[activeTurnIndex]?.id ?? null;

  useEffect(() => {
    if (!activeCombatantId || !activeRowRef.current) return;
    activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeCombatantId]);

  return (
    <div className="panel">
      <div className="panel-title">{isDisplay ? 'Initiative Feed' : 'Initiative Order'}</div>
      <div className="initiative-list">
        {displayOrdered.length === 0 && <div className="empty-state">No combatants yet.</div>}
        {displayOrdered.map((combatant, displayIndex) => {
          const playerState = playerStates.find(s => s.combatant_id === combatant.id);
          const originalIndex = sortedOriginal.findIndex(item => item.id === combatant.id);
          return <div key={combatant.id} ref={combatant.id === activeCombatantId ? activeRowRef : null}><InitiativeRow combatant={combatant} playerState={playerState} isActive={combatant.id === activeCombatantId} isNextUp={displayIndex === 1} isDM={isDM} isDisplay={isDisplay} onUpdate={onUpdate} sorted={sortedOriginal} idx={originalIndex} encounterId={encounter?.id} /></div>;
        })}
      </div>
      {isDM && encounter && <div style={{ marginTop: 12 }}><button className="btn btn-ghost" onClick={() => setShowAddCombatant(true)}>+ Add Combatant</button></div>}
      {isDM && encounter && showAddCombatant && <AddCombatantModal encounterId={encounter.id} onUpdate={onUpdate} onClose={() => setShowAddCombatant(false)} />}
    </div>
  );
}

function InitiativeRow({ combatant, playerState, isActive, isNextUp, isDM, isDisplay, onUpdate, sorted, idx, encounterId }) {
  const [expanded, setExpanded] = useState(false);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [resPicker, setResPicker] = useState(false);
  const [inputValue, setInputValue] = useState(combatant.initiative_total != null ? String(combatant.initiative_total) : '');
  const isFocused = useRef(false);
  const savingRef = useRef(false);
  useEffect(() => { if (!isFocused.current) setInputValue(combatant.initiative_total != null ? String(combatant.initiative_total) : ''); }, [combatant.initiative_total]);

  const isPC = combatant.side === 'PC';
  const isNonPC = combatant.side === 'NPC' || combatant.side === 'ENEMY';
  const conditions = combatant.conditions || [];
  const pcConditions = playerState?.conditions || [];
  const classLine = isPC ? formatClassLine(playerState?.profiles_players || {}) : formatClassLine(combatant);
  const miniMarker = combatant.mini_marker || '';
  const laMax = combatant.legendary_actions_max ?? 0;
  const laUsed = combatant.legendary_actions_used ?? 0;
  const lrMax = combatant.legendary_resistances_max ?? 0;
  const lrUsed = combatant.legendary_resistances_used ?? 0;
  const resistances = combatant.resistances || [];
  const immunities = combatant.immunities || [];
  const hasAnyMod = MODS.some(m => (combatant[`mod_${m}`] ?? 0) !== 0);

  async function saveInitiative() {
    if (savingRef.current) return;
    const total = parseInt(inputValue, 10);
    if (isNaN(total)) return;
    savingRef.current = true;
    await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: total });
    savingRef.current = false;
    onUpdate();
  }
  async function moveUp() { if (idx <= 0) return; const neighbor = sorted[idx - 1]; await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: (neighbor.initiative_total ?? 0) + 1 }); onUpdate(); }
  async function moveDown() { if (idx === -1 || idx >= sorted.length - 1) return; const neighbor = sorted[idx + 1]; await supabase.rpc('set_initiative', { p_combatant_id: combatant.id, p_total: Math.max(0, (neighbor.initiative_total ?? 0) - 1) }); onUpdate(); }
  async function applyEnemyDamage(amount) { if (!amount || amount <= 0) return; const oldHp = combatant.hp_current ?? 0; const newHp = Math.max(0, oldHp - amount); const isBloodiedNow = newHp > 0 && newHp <= Math.floor((combatant.hp_max ?? 0) / 2); const updatedConditions = nextZeroHpConditions(newHp, conditions); await supabase.from('combatants').update({ hp_current: newHp, public_status: isBloodiedNow ? 'BLOODIED' : null, conditions: updatedConditions }).eq('id', combatant.id); logCombat(encounterId, 'DM', 'damage', `${combatant.name}: -${amount} HP (${oldHp} → ${newHp})`); onUpdate(); }
  async function applyEnemyHeal(amount) { if (!amount || amount <= 0) return; const oldHp = combatant.hp_current ?? 0; const newHp = Math.min(combatant.hp_max ?? 999, oldHp + amount); const isBloodiedNow = newHp > 0 && newHp <= Math.floor((combatant.hp_max ?? 0) / 2); const updatedConditions = nextZeroHpConditions(newHp, conditions); await supabase.from('combatants').update({ hp_current: newHp, public_status: isBloodiedNow ? 'BLOODIED' : null, conditions: updatedConditions }).eq('id', combatant.id); logCombat(encounterId, 'DM', 'heal', `${combatant.name}: +${amount} HP (${oldHp} → ${newHp})`); onUpdate(); }
  async function applyPcDamage(amount) { if (!playerState || !amount || amount <= 0) return; await applyPlayerDamage({ state: playerState, combatant, encounterId, amount, actor: 'DM' }); onUpdate(); }
  async function applyPcHeal(amount) { if (!playerState || !amount || amount <= 0) return; await applyPlayerHeal({ state: playerState, combatant, encounterId, amount, actor: 'DM' }); onUpdate(); }
  async function toggleEnemyCondition(code) { const updated = conditions.includes(code) ? conditions.filter(c => c !== code) : [...conditions, code]; await supabase.from('combatants').update({ conditions: updated }).eq('id', combatant.id); onUpdate(); }
  async function toggleDamageType(field, type) { const arr = combatant[field] || []; const updated = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type]; await supabase.from('combatants').update({ [field]: updated }).eq('id', combatant.id); onUpdate(); }
  async function spendLegendary(field, max) { const cur = combatant[field] ?? 0; if (cur >= max) return; await supabase.from('combatants').update({ [field]: cur + 1 }).eq('id', combatant.id); onUpdate(); }
  async function restoreLegendary(field) { const cur = combatant[field] ?? 0; if (cur <= 0) return; await supabase.from('combatants').update({ [field]: cur - 1 }).eq('id', combatant.id); onUpdate(); }
  async function resetLegendary(field) { await supabase.from('combatants').update({ [field]: 0 }).eq('id', combatant.id); onUpdate(); }
  async function removeCombatant() { if (!window.confirm(`Remove ${combatant.name}?`)) return; logCombat(encounterId, 'DM', 'remove', `${combatant.name} removed from encounter`); await supabase.from('combatants').delete().eq('id', combatant.id); onUpdate(); }

  const atTop = idx <= 0; const atBottom = idx === -1 || idx >= sorted.length - 1;

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''} ${isNextUp ? 'initiative-row--next-up' : ''}`}>
      <div className="initiative-row-main" onClick={() => isDM && isNonPC && setExpanded(e => !e)}>
        {isDM ? <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}><button style={{ fontSize: 9, lineHeight: 1, padding: '1px 3px', opacity: atTop ? 0.15 : 0.5, cursor: atTop ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }} onClick={e => { e.stopPropagation(); moveUp(); }} disabled={atTop}>▲</button><button style={{ fontSize: 9, lineHeight: 1, padding: '1px 3px', opacity: atBottom ? 0.15 : 0.5, cursor: atBottom ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }} onClick={e => { e.stopPropagation(); moveDown(); }} disabled={atBottom}>▼</button></div> : null}
        {isDM ? <input className="initiative-number-input" type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} onFocus={() => { isFocused.current = true; }} onBlur={() => { isFocused.current = false; saveInitiative(); }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); }} onClick={e => e.stopPropagation()} placeholder="—" /> : <span className="initiative-number">{combatant.initiative_total ?? '—'}</span>}
        <InitiativeNameplate miniMarker={miniMarker} name={combatant.name} />
        {isDM && isNonPC ? <span className="expand-toggle" style={{ marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span> : null}
      </div>

      {isDM && isPC ? <div style={{ marginTop: 6 }}><InitiativeInlineDmgHeal onDamage={applyPcDamage} onHeal={applyPcHeal} /></div> : null}

      {isDM && isNonPC && expanded ? (
        <div className="monster-dm-controls">
          <div style={{ marginBottom: 10 }}>
            <InitiativeInlineDmgHeal onDamage={applyEnemyDamage} onHeal={applyEnemyHeal} />
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{combatant.hp_current} / {combatant.hp_max} HP</div>
          </div>
          {classLine ? <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>{classLine}</div> : null}
          <InitiativeEnemySlotGrid combatant={combatant} onUpdate={onUpdate} />
          {hasAnyMod ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>{MODS.map(mod => { const val = combatant[`mod_${mod}`] ?? 0; return <div key={mod} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-panel-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', minWidth: 30 }}><span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{mod}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{val >= 0 ? '+' : ''}{val}</span></div>; })}</div> : null}
          {(laMax > 0 || lrMax > 0) ? <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 2 }}>{laMax > 0 ? <InitiativeLegendaryPips label="LA" max={laMax} used={laUsed} isDM={isDM} onSpend={() => spendLegendary('legendary_actions_used', laMax)} onRestore={() => restoreLegendary('legendary_actions_used')} onReset={() => resetLegendary('legendary_actions_used')} isActive={isActive} /> : null}{lrMax > 0 ? <InitiativeLegendaryPips label="LR" max={lrMax} used={lrUsed} isDM={isDM} onSpend={() => spendLegendary('legendary_resistances_used', lrMax)} onRestore={() => restoreLegendary('legendary_resistances_used')} onReset={() => resetLegendary('legendary_resistances_used')} isActive={false} /> : null}</div> : null}
          <div style={{ marginBottom: 8 }}><button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setResPicker(p => !p)}>{resPicker ? 'Close' : `Resist/Immune ${resistances.length + immunities.length > 0 ? `(${resistances.length + immunities.length})` : ''}`}</button>{resPicker ? <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Resistances</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>{DAMAGE_TYPES.map(type => <button key={type} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${resistances.includes(type) ? 'var(--accent-blue)' : 'var(--border)'}`, background: resistances.includes(type) ? 'rgba(74,158,255,0.2)' : 'var(--bg-panel-3)', color: resistances.includes(type) ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('resistances', type)}>{type}</button>)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Immunities</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{DAMAGE_TYPES.map(type => <button key={type} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${immunities.includes(type) ? 'var(--accent-gold)' : 'var(--border)'}`, background: immunities.includes(type) ? 'rgba(240,180,41,0.15)' : 'var(--bg-panel-3)', color: immunities.includes(type) ? 'var(--accent-gold)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('immunities', type)}>{type}</button>)}</div></div> : null}</div>
          <div style={{ marginBottom: 8 }}><button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setCondPickerOpen(p => !p)}>{condPickerOpen ? 'Close Conditions' : '+ Conditions'}</button>{condPickerOpen ? <div className="condition-picker" style={{ marginTop: 6 }}>{CONDITIONS.map(({ code }) => <button key={code} className={`condition-picker-btn ${conditions.includes(code) ? 'active' : ''}`} style={{ background: conditions.includes(code) ? CONDITION_COLOURS[code] : undefined }} onClick={() => toggleEnemyCondition(code)}>{code}</button>)}</div> : null}</div>
          <button className="btn btn-danger" onClick={removeCombatant}>Remove</button>
        </div>
      ) : null}
    </div>
  );
}

function AddCombatantModal({ encounterId, onUpdate, onClose }) {
  const [mode, setMode] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [mod, setMod] = useState(0);
  const [side, setSide] = useState('ENEMY');
  const [className, setClassName] = useState('');
  const [subclassName, setSubclassName] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [className2, setClassName2] = useState('');
  const [subclassName2, setSubclassName2] = useState('');
  const [classLevel2, setClassLevel2] = useState('');
  const [miniMarker, setMiniMarker] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (mode === 'template') supabase.from('profiles_monsters').select('*').order('name').then(({ data }) => setTemplates(data || [])); }, [mode]);
  async function addFromTemplate(template) { if (adding) return; setAdding(true); const basePayload = { encounter_id: encounterId, name: template.name, side: template.side || 'ENEMY', ac: template.ac, hp_max: template.hp_max, hp_current: template.hp_max, initiative_mod: template.initiative_mod || 0, notes: template.notes || null, mod_str: template.mod_str || 0, mod_dex: template.mod_dex || 0, mod_con: template.mod_con || 0, mod_int: template.mod_int || 0, mod_wis: template.mod_wis || 0, mod_cha: template.mod_cha || 0, resistances: template.resistances || [], immunities: template.immunities || [], legendary_actions_max: template.legendary_actions_max || 0, legendary_resistances_max: template.legendary_resistances_max || 0, slots_max_1: template.slots_max_1 || 0, slots_max_2: template.slots_max_2 || 0, slots_max_3: template.slots_max_3 || 0, slots_max_4: template.slots_max_4 || 0, slots_max_5: template.slots_max_5 || 0, slots_max_6: template.slots_max_6 || 0, slots_max_7: template.slots_max_7 || 0, slots_max_8: template.slots_max_8 || 0, slots_max_9: template.slots_max_9 || 0 }; const enrichedPayload = compactObject({ ...basePayload, class_name: template.class_name || null, subclass_name: template.subclass_name || null, class_level: template.class_level != null ? toInt(template.class_level, 1) : null, class_name_2: template.class_name_2 || null, subclass_name_2: template.subclass_name_2 || null, class_level_2: template.class_level_2 != null ? toInt(template.class_level_2, 0) : null, mini_marker: template.mini_marker || null }); const attempt = await supabase.from('combatants').insert(enrichedPayload); if (attempt.error) await supabase.from('combatants').insert(basePayload); setAdding(false); onUpdate(); onClose(); }
  async function addManual() { if (!name.trim() || saving) return; setSaving(true); const basePayload = { encounter_id: encounterId, name: name.trim(), side, ac: toInt(ac, 10), hp_max: toInt(hp, 10), hp_current: toInt(hp, 10), initiative_mod: toInt(mod, 0) }; const enrichedPayload = compactObject({ ...basePayload, class_name: className.trim() || null, subclass_name: subclassName.trim() || null, class_level: classLevel !== '' ? toInt(classLevel, 1) : null, class_name_2: className2.trim() || null, subclass_name_2: subclassName2.trim() || null, class_level_2: classLevel2 !== '' ? toInt(classLevel2, 0) : null, mini_marker: miniMarker.trim() || null }); const attempt = await supabase.from('combatants').insert(enrichedPayload); if (attempt.error) await supabase.from('combatants').insert(basePayload); setSaving(false); onUpdate(); onClose(); }
  const filteredTemplates = templateFilter === 'ALL' ? templates : templates.filter(t => t.side === templateFilter);
  return <div className="modal-overlay" onClick={onClose}><div className="modal-panel add-combatant-modal" onClick={e => e.stopPropagation()}><div className="modal-header"><div><div className="panel-title" style={{ marginBottom: 4 }}>Add Combatant</div><div className="modal-subtitle">Add from template or enter a manual combatant.</div></div><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close add combatant">✕</button></div><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'template' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'template' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setMode('template')}>From Template</button><button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'manual' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'manual' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setMode('manual')}>Manual</button></div>{mode === 'template' && <><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['ALL', 'ENEMY', 'NPC'].map(filter => <button key={filter} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: templateFilter === filter ? 'var(--accent-blue)' : 'var(--border)', color: templateFilter === filter ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setTemplateFilter(filter)}>{filter}</button>)}</div>{templates.length === 0 && <div className="empty-state">No templates yet. Add them in Manage.</div>}<div className="add-combatant-template-list">{filteredTemplates.map(template => <div key={template.id} className="add-combatant-template-row"><div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ minWidth: 0 }}><span className={`badge badge-${(template.side || 'enemy').toLowerCase()}`} style={{ marginRight: 6 }}>{template.side || 'ENEMY'}</span><span style={{ fontSize: 13, fontWeight: 600 }}>{template.name}</span><span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>AC {template.ac} HP {template.hp_max}</span></div></div><button className="btn btn-primary btn-icon" onClick={() => addFromTemplate(template)} disabled={adding} style={{ fontSize: 16, minWidth: 32, minHeight: 32 }}>+</button></div>)}</div></>}{mode === 'manual' && <><input className="form-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} /><div className="form-row add-combatant-manual-grid"><div className="form-group"><label className="form-label">Side</label><select className="form-input" value={side} onChange={e => setSide(e.target.value)}><option value="ENEMY">Enemy</option><option value="NPC">NPC</option><option value="PC">PC</option></select></div><div className="form-group"><label className="form-label">AC</label><input className="form-input" type="number" value={ac} onChange={e => setAc(e.target.value)} /></div><div className="form-group"><label className="form-label">HP</label><input className="form-input" type="number" value={hp} onChange={e => setHp(e.target.value)} /></div><div className="form-group"><label className="form-label">Init Mod</label><input className="form-input" type="number" value={mod} onChange={e => setMod(e.target.value)} /></div></div><div className="form-row" style={{ flexWrap: 'wrap' }}><button className="btn btn-primary" onClick={addManual} disabled={saving || !name.trim()}>{saving ? 'Adding…' : 'Add'}</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div></>}</div></div>;
}
