import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { MODS, CONDITIONS, CONDITION_COLOURS, DAMAGE_TYPES } from './initiative/initiativeConstants';
import { compactObject, formatClassLine, getDisplayOrderedCombatants, logCombat, nextZeroHpConditions, sortCombatants, toInt } from './initiative/initiativeUtils';
import InitiativeInlineDmgHeal from './initiative/InitiativeInlineDmgHeal';
import InitiativeEnemySlotGrid from './initiative/InitiativeEnemySlotGrid';
import InitiativePcResourceSummary from './initiative/InitiativePcResourceSummary';
import InitiativeLegendaryPips from './initiative/InitiativeLegendaryPips';
import { applyPlayerDamage, applyPlayerHeal, togglePlayerReaction, togglePlayerConcentration } from '../utils/playerStateMutations';
import { getFinalArmorClass, getFinalSpellAttackBonus, getFinalSpellSaveDC } from '../utils/classResources';

function resolveThresholdColor(pct) {
  return pct > 50 ? 'var(--hp-high)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)';
}

function InitiativeHeroHpBar({ current, max, tempHp = 0, bonusMaxHp = 0 }) {
  const safeCurrent = Math.max(0, current ?? 0);
  const safeMax = Math.max(0, max ?? 0);
  const safeTemp = Math.max(0, tempHp ?? 0);
  const baseMax = Math.max(0, safeMax - Math.max(0, bonusMaxHp));
  const baseCurrent = Math.max(0, Math.min(safeCurrent, baseMax));
  const bonusCurrent = Math.max(0, safeCurrent - baseMax);
  const totalBar = Math.max(1, safeMax + safeTemp);
  const basePct = (baseCurrent / totalBar) * 100;
  const bonusLeftPct = (baseMax / totalBar) * 100;
  const bonusPct = (bonusCurrent / totalBar) * 100;
  const tempLeftPct = (safeCurrent / totalBar) * 100;
  const tempPct = (safeTemp / totalBar) * 100;
  const hpPct = safeMax > 0 ? Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100)) : 0;
  const barColor = resolveThresholdColor(hpPct);

  return (
    <div style={{ position: 'relative', height: 34, background: 'var(--bg-panel-3)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${basePct}%`, background: barColor }} />
      {bonusCurrent > 0 && <div style={{ position: 'absolute', left: `${bonusLeftPct}%`, top: 0, bottom: 0, width: `${bonusPct}%`, background: 'var(--accent-gold)', opacity: 0.72 }} />}
      {safeTemp > 0 && <div style={{ position: 'absolute', left: `${tempLeftPct}%`, top: 0, bottom: 0, width: `${tempPct}%`, background: 'var(--hp-temp)', opacity: 0.72 }} />}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', fontSize: 16, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
        {safeCurrent} / {safeMax}{safeTemp > 0 ? ` +${safeTemp}` : ''}
      </div>
    </div>
  );
}

function StatBox({ label, value, visible = true, accent = 'var(--accent-blue)' }) {
  if (!visible) return <div style={{ minHeight: 52 }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, borderRadius: 14, border: `1px solid ${accent}55`, background: 'rgba(74,158,255,0.12)', color: 'var(--text-primary)', padding: '4px 3px', textAlign: 'center' }}>
      <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function FullWidthStatusBar({ label, value, active = false, onClick = null, accent = 'var(--accent-blue)' }) {
  const clickable = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      style={{ minHeight: 36, width: '100%', padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontWeight: 700, border: active ? `1px solid ${accent}` : '1px solid var(--border)', background: active ? `${accent}22` : 'var(--bg-panel-3)', color: active ? accent : 'var(--text-primary)', cursor: clickable ? 'pointer' : 'default' }}
    >
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </button>
  );
}

function MetaPill({ children }) {
  if (children === null || children === undefined || children === '') return null;
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '5px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-panel-3)', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', whiteSpace: 'nowrap' }}>{children}</span>;
}

export default function InitiativePanelNext({ encounter, combatants, playerStates = [], role, onUpdate, myCombatantId = null }) {
  const isDM = role === 'dm';
  const isDisplay = role === 'display';
  const sortedOriginal = sortCombatants(combatants);
  const activeTurnIndex = encounter?.turn_index ?? 0;
  const displayOrdered = getDisplayOrderedCombatants(sortedOriginal, activeTurnIndex);
  const [showAddCombatant, setShowAddCombatant] = useState(false);
  const activeRowRef = useRef(null);
  const lastActiveIdRef = useRef(null);
  const activeCombatantId = sortedOriginal[activeTurnIndex]?.id ?? null;

  useEffect(() => {
    if (!activeCombatantId || !activeRowRef.current) return;
    if (lastActiveIdRef.current === activeCombatantId) return;
    lastActiveIdRef.current = activeCombatantId;
    activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeCombatantId]);

  return (
    <div className="panel">
      <div className="panel-title">{isDisplay ? 'Initiative Feed' : 'Initiative Order'}</div>
      <div className="initiative-list" style={{ gap: 10 }}>
        {displayOrdered.length === 0 && <div className="empty-state">No combatants yet.</div>}
        {displayOrdered.map((combatant, displayIndex) => {
          const playerState = playerStates.find(s => s.combatant_id === combatant.id);
          const originalIndex = sortedOriginal.findIndex(item => item.id === combatant.id);
          const isActive = combatant.id === activeCombatantId;
          const isNextUp = displayIndex === 1;
          return (
            <div key={combatant.id} ref={isActive ? activeRowRef : null}>
              <InitiativeRow combatant={combatant} playerState={playerState} isActive={isActive} isNextUp={isNextUp} isDM={isDM} isDisplay={isDisplay} onUpdate={onUpdate} sorted={sortedOriginal} idx={originalIndex} encounterId={encounter?.id} myCombatantId={myCombatantId} />
            </div>
          );
        })}
      </div>

      {isDM && encounter && <div style={{ marginTop: 12 }}><button className="btn btn-ghost" onClick={() => setShowAddCombatant(true)}>+ Add Combatant</button></div>}
      {isDM && encounter && showAddCombatant && <AddCombatantModal encounterId={encounter.id} onUpdate={onUpdate} onClose={() => setShowAddCombatant(false)} />}
    </div>
  );
}

function InitiativeRow({ combatant, playerState, isActive, isNextUp, isDM, isDisplay, onUpdate, encounterId, myCombatantId }) {
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [resPicker, setResPicker] = useState(false);
  const [conDc, setConDc] = useState(null);
  const [concentrationSpellName, setConcentrationSpellName] = useState('');
  const conTimer = useRef(null);

  useEffect(() => () => clearTimeout(conTimer.current), []);
  useEffect(() => {
    let cancelled = false;
    async function loadSpellName() {
      const spellId = playerState?.concentration_spell_id ?? combatant?.concentration_spell_id ?? null;
      if (!spellId) {
        setConcentrationSpellName('');
        return;
      }
      const { data } = await supabase.from('spells').select('name').eq('id', spellId).maybeSingle();
      if (!cancelled) setConcentrationSpellName(data?.name || '');
    }
    loadSpellName();
    return () => { cancelled = true; };
  }, [playerState?.concentration_spell_id, combatant?.concentration_spell_id]);

  const isPC = combatant.side === 'PC';
  const isNPC = combatant.side === 'NPC';
  const isEnemy = combatant.side === 'ENEMY';
  const isNonPC = isNPC || isEnemy;
  const conditions = combatant.conditions || [];

  const pcHpCurrent = playerState?.current_hp ?? null;
  const pcProfileMax = playerState?.profiles_players?.max_hp ?? null;
  const pcMaxOverride = playerState?.max_hp_override ?? null;
  const pcHpMax = pcMaxOverride !== null ? pcMaxOverride : pcProfileMax;
  const pcBonusMaxHp = Math.max(0, (pcHpMax ?? 0) - (pcProfileMax ?? 0));
  const tempHp = playerState?.temp_hp ?? 0;
  const concentration = playerState?.concentration ?? combatant?.concentration ?? false;
  const reactionUsed = playerState?.reaction_used ?? false;
  const pcConditions = playerState?.conditions || [];
  const displayConditions = isPC ? pcConditions : conditions;
  const passivePerception = isPC && playerState?.profiles_players ? 10 + (playerState.profiles_players.skill_perception ?? 0) : (combatant.passive_perception ?? null);
  const enemyHpCurrent = combatant.hp_current ?? null;
  const enemyHpMax = combatant.hp_max ?? null;
  const enemyReactionUsed = combatant.reaction_used ?? false;
  const showPcHp = isPC && pcHpCurrent !== null && pcHpMax !== null;
  const showNpcHp = isNPC && enemyHpCurrent !== null && enemyHpMax !== null;
  const showEnemyHp = isEnemy && enemyHpCurrent !== null && enemyHpMax !== null && isDM;
  const showHpBar = isPC ? showPcHp : isNPC ? (isDM || isDisplay) && showNpcHp : isDM && showEnemyHp;
  const pcBloodied = isPC && pcHpCurrent !== null && pcHpMax !== null && pcHpCurrent > 0 && pcHpCurrent <= Math.floor(pcHpMax / 2);
  const enemyBloodied = isNonPC && combatant.public_status === 'BLOODIED';
  const rxUsed = isPC ? reactionUsed : enemyReactionUsed;
  const canToggleReaction = isDM || (!isDM && isPC && myCombatantId && combatant.id === myCombatantId);
  const pcProfile = playerState?.profiles_players || {};
  const armorClass = isPC ? getFinalArmorClass(pcProfile, playerState || {}) : combatant.ac ?? '—';
  const spellSave = isPC ? (pcProfile?.spell_save_dc || getFinalSpellSaveDC(pcProfile || {})) : (combatant.spell_save_dc ?? null);
  const spellAttack = isPC ? (pcProfile?.spell_attack_bonus || getFinalSpellAttackBonus(pcProfile || {})) : (combatant.spell_attack_bonus ?? combatant.spell_attack_bonus_mod ?? null);
  const sideLabel = isPC ? 'PC' : isNPC ? 'NPC' : 'ENEMY';
  const topBorder = isActive ? 'var(--accent-blue)' : isNextUp ? 'var(--accent-gold)' : 'var(--border)';
  const cardBg = isActive ? 'rgba(74,158,255,0.06)' : isNextUp ? 'rgba(240,180,41,0.05)' : 'var(--bg-panel-2)';
  const showAc = !(isEnemy && !isDM);
  const showBottomMeta = !(isEnemy && !isDM);
  const conditionsLabel = displayConditions.length ? `Conditions (${displayConditions.length})` : '+ Conditions';
  const concentrationText = concentration ? (concentrationSpellName || 'Concentrating') : 'Not concentrating';

  async function handleToggleReaction() {
    if (!canToggleReaction) return;
    if (isPC) {
      if (!playerState) return;
      await togglePlayerReaction(playerState.id, reactionUsed);
    } else {
      await supabase.from('combatants').update({ reaction_used: !enemyReactionUsed }).eq('id', combatant.id);
    }
    onUpdate();
  }

  async function togglePcCondition(code) {
    if (!isDM || !playerState) return;
    const updated = pcConditions.includes(code) ? pcConditions.filter(c => c !== code) : [...pcConditions, code];
    await supabase.from('player_encounter_state').update({ conditions: updated }).eq('id', playerState.id);
    onUpdate();
  }

  async function handleTogglePcConcentration() {
    if (!isDM || !playerState) return;
    await togglePlayerConcentration(playerState.id, concentration);
    onUpdate();
  }

  async function applyEnemyDamage(amount) {
    if (!amount || amount <= 0) return;
    const oldHp = combatant.hp_current ?? 0;
    const newHp = Math.max(0, oldHp - amount);
    const isBloodiedNow = newHp > 0 && newHp <= Math.floor((combatant.hp_max ?? 0) / 2);
    const updatedConditions = nextZeroHpConditions(newHp, conditions);
    await supabase.from('combatants').update({ hp_current: newHp, public_status: isBloodiedNow ? 'BLOODIED' : null, conditions: updatedConditions }).eq('id', combatant.id);
    logCombat(encounterId, 'DM', 'damage', `${combatant.name}: -${amount} HP (${oldHp} → ${newHp})`);
    onUpdate();
  }

  async function applyEnemyHeal(amount) {
    if (!amount || amount <= 0) return;
    const oldHp = combatant.hp_current ?? 0;
    const newHp = Math.min(combatant.hp_max ?? 999, oldHp + amount);
    const isBloodiedNow = newHp > 0 && newHp <= Math.floor((combatant.hp_max ?? 0) / 2);
    const updatedConditions = nextZeroHpConditions(newHp, conditions);
    await supabase.from('combatants').update({ hp_current: newHp, public_status: isBloodiedNow ? 'BLOODIED' : null, conditions: updatedConditions }).eq('id', combatant.id);
    logCombat(encounterId, 'DM', 'heal', `${combatant.name}: +${amount} HP (${oldHp} → ${newHp})`);
    onUpdate();
  }

  async function applyPcDamage(amount) {
    if (!playerState || !amount || amount <= 0) return;
    if (concentration) {
      const dc = Math.max(10, Math.floor(amount / 2));
      clearTimeout(conTimer.current);
      setConDc(dc);
      conTimer.current = setTimeout(() => setConDc(null), 7000);
    }
    await applyPlayerDamage({ state: playerState, combatant, encounterId, amount, actor: 'DM' });
    onUpdate();
  }

  async function applyPcHeal(amount) {
    if (!playerState || !amount || amount <= 0) return;
    await applyPlayerHeal({ state: playerState, combatant, encounterId, amount, actor: 'DM' });
    onUpdate();
  }

  async function toggleEnemyCondition(code) {
    const updated = conditions.includes(code) ? conditions.filter(c => c !== code) : [...conditions, code];
    await supabase.from('combatants').update({ conditions: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function toggleDamageType(field, type) {
    const arr = combatant[field] || [];
    const updated = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type];
    await supabase.from('combatants').update({ [field]: updated }).eq('id', combatant.id);
    onUpdate();
  }

  async function spendLegendary(field, max) {
    const cur = combatant[field] ?? 0;
    if (cur >= max) return;
    await supabase.from('combatants').update({ [field]: cur + 1 }).eq('id', combatant.id);
    onUpdate();
  }

  async function restoreLegendary(field) {
    const cur = combatant[field] ?? 0;
    if (cur <= 0) return;
    await supabase.from('combatants').update({ [field]: cur - 1 }).eq('id', combatant.id);
    onUpdate();
  }

  async function resetLegendary(field) {
    await supabase.from('combatants').update({ [field]: 0 }).eq('id', combatant.id);
    onUpdate();
  }

  async function removeCombatant() {
    if (!window.confirm(`Remove ${combatant.name}?`)) return;
    logCombat(encounterId, 'DM', 'remove', `${combatant.name} removed from encounter`);
    await supabase.from('combatants').delete().eq('id', combatant.id);
    onUpdate();
  }

  return (
    <div className={`initiative-row ${isActive ? 'active-turn' : ''} ${isNextUp ? 'initiative-row--next-up' : ''}`} style={{ display: 'block', padding: 10, borderColor: topBorder, background: cardBg, borderRadius: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateRows: '52px 52px', gap: 6 }}>
          <StatBox label="Init" value={combatant.initiative_total ?? '—'} accent={isActive ? 'var(--accent-blue)' : isNextUp ? 'var(--accent-gold)' : 'var(--accent-blue)'} />
          <StatBox label="AC" value={armorClass ?? '—'} visible={showAc} accent="var(--accent-blue)" />
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6, minHeight: 110 }}>
          <div style={{ fontSize: 'clamp(1rem,2.2vw,1.45rem)', lineHeight: 1.02, fontWeight: 800, color: 'var(--text-primary)', minHeight: 52, display: 'flex', alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{combatant.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {isActive && <span className="display-order-tag display-order-tag--active">Current</span>}
            {!isActive && isNextUp && <span className="display-order-tag display-order-tag--next">On Deck</span>}
            <span className={`badge badge-${combatant.side.toLowerCase()}`}>{sideLabel}</span>
            {(enemyBloodied || pcBloodied) && <span className="badge badge-bloodied">Bloodied</span>}
            {isPC && playerState?.mage_armour_active && <span className="initiative-inline-flag">Mage Armour</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <FullWidthStatusBar label="Reaction" value={rxUsed ? 'Used' : 'Available'} active={!rxUsed} onClick={canToggleReaction ? handleToggleReaction : null} accent={rxUsed ? 'var(--accent-red)' : 'var(--accent-green)'} />
        <FullWidthStatusBar label="Concentration" value={concentrationText} active={!!concentration} onClick={isPC && isDM ? handleTogglePcConcentration : null} accent="var(--accent-gold)" />

        {showHpBar ? (
          <InitiativeHeroHpBar current={isPC ? pcHpCurrent : enemyHpCurrent} max={isPC ? pcHpMax : enemyHpMax} tempHp={isPC ? tempHp : 0} bonusMaxHp={isPC ? pcBonusMaxHp : 0} />
        ) : (
          isEnemy && !isDM ? <div style={{ display: 'flex', justifyContent: 'flex-start' }}>{enemyBloodied ? <span className="badge badge-bloodied">Bloodied</span> : null}</div> : null
        )}

        {conDc !== null && <div className="con-check-banner con-check-banner--dm" style={{ marginTop: 1 }}><span className="con-check-label">🔮 CON SAVE</span><span className="con-check-dc">DC {conDc}</span></div>}

        {isDM && showHpBar && <div style={{ marginTop: -1 }}>{isPC ? <InitiativeInlineDmgHeal onDamage={applyPcDamage} onHeal={applyPcHeal} /> : <InitiativeInlineDmgHeal onDamage={applyEnemyDamage} onHeal={applyEnemyHeal} />}</div>}

        {isDM && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn btn-ghost initiative-small-action" style={{ width: '100%', minHeight: 34, justifyContent: 'center' }} onClick={e => { e.stopPropagation(); setCondPickerOpen(p => !p); }}>{conditionsLabel}</button>
            {isNonPC && <button className="btn btn-ghost initiative-small-action" style={{ width: '100%', minHeight: 30, justifyContent: 'center' }} onClick={e => { e.stopPropagation(); setResPicker(p => !p); }}>{resPicker ? 'Hide More' : 'More'}</button>}
          </div>
        )}

        {isDM && condPickerOpen && <div className="condition-picker">{CONDITIONS.map(({ code }) => <button key={code} className={`condition-picker-btn ${displayConditions.includes(code) ? 'active' : ''}`} style={{ background: displayConditions.includes(code) ? CONDITION_COLOURS[code] : undefined }} onClick={e => { e.stopPropagation(); isPC ? togglePcCondition(code) : toggleEnemyCondition(code); }}>{code}</button>)}</div>}

        {displayConditions.length > 0 && <div className="initiative-chip-row" style={{ marginTop: -1 }}>{displayConditions.map(code => <span key={code} className="condition-chip" style={{ background: CONDITION_COLOURS[code] || 'var(--cond-default)' }}>{code}</span>)}</div>}

        {isPC && playerState && <InitiativePcResourceSummary profile={pcProfile} state={playerState} isDM={isDM} onUpdate={onUpdate} />}

        {isDM && isNonPC && resPicker && (
          <div className="monster-dm-controls" style={{ marginTop: 2 }}>
            <InitiativeEnemySlotGrid combatant={combatant} onUpdate={onUpdate} />
            {(combatant.legendary_actions_max > 0 || combatant.legendary_resistances_max > 0) && <div className="initiative-secondary-block initiative-secondary-block--legendary">{combatant.legendary_actions_max > 0 && <InitiativeLegendaryPips label="LA" max={combatant.legendary_actions_max} used={combatant.legendary_actions_used ?? 0} isDM={isDM} onSpend={() => spendLegendary('legendary_actions_used', combatant.legendary_actions_max)} onRestore={() => restoreLegendary('legendary_actions_used')} onReset={() => resetLegendary('legendary_actions_used')} isActive={isActive} />}{combatant.legendary_resistances_max > 0 && <InitiativeLegendaryPips label="LR" max={combatant.legendary_resistances_max} used={combatant.legendary_resistances_used ?? 0} isDM={isDM} onSpend={() => spendLegendary('legendary_resistances_used', combatant.legendary_resistances_max)} onRestore={() => restoreLegendary('legendary_resistances_used')} onReset={() => resetLegendary('legendary_resistances_used')} isActive={false} />}</div>}
            {MODS.some(m => (combatant[`mod_${m}`] ?? 0) !== 0) && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>{MODS.map(mod => { const val = combatant[`mod_${mod}`] ?? 0; return <div key={mod} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-panel-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', minWidth: 30 }}><span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{mod}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{val >= 0 ? '+' : ''}{val}</span></div>; })}</div>}
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Resistances</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>{DAMAGE_TYPES.map(type => <button key={type} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${(combatant.resistances || []).includes(type) ? 'var(--accent-blue)' : 'var(--border)'}`, background: (combatant.resistances || []).includes(type) ? 'rgba(74,158,255,0.2)' : 'var(--bg-panel-3)', color: (combatant.resistances || []).includes(type) ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('resistances', type)}>{type}</button>)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Immunities</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{DAMAGE_TYPES.map(type => <button key={type} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${(combatant.immunities || []).includes(type) ? 'var(--accent-gold)' : 'var(--border)'}`, background: (combatant.immunities || []).includes(type) ? 'rgba(240,180,41,0.15)' : 'var(--bg-panel-3)', color: (combatant.immunities || []).includes(type) ? 'var(--accent-gold)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('immunities', type)}>{type}</button>)}</div></div>
            {(combatant.notes || formatClassLine(combatant)) && <div className="monster-notes" style={{ marginBottom: 8 }}>{[formatClassLine(combatant), combatant.notes].filter(Boolean).join(' • ')}</div>}
            <button className="btn btn-danger" onClick={removeCombatant}>Remove</button>
          </div>
        )}

        {showBottomMeta && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, alignItems: 'center', marginTop: 1 }}><MetaPill>PP {passivePerception ?? '—'}</MetaPill><MetaPill>Spell DC {spellSave ?? '—'}</MetaPill><MetaPill>Spell ATK {spellAttack !== null && spellAttack !== undefined && spellAttack !== '' ? `${spellAttack > 0 ? '+' : ''}${spellAttack}` : '—'}</MetaPill></div>}
      </div>
    </div>
  );
}

function AddCombatantModal({ encounterId, onUpdate, onClose }) { const [mode, setMode] = useState('template'); const [templates, setTemplates] = useState([]); const [templateFilter, setTemplateFilter] = useState('ALL'); const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [ac, setAc] = useState(10); const [hp, setHp] = useState(10); const [mod, setMod] = useState(0); const [side, setSide] = useState('ENEMY'); const [className, setClassName] = useState(''); const [subclassName, setSubclassName] = useState(''); const [classLevel, setClassLevel] = useState(''); const [className2, setClassName2] = useState(''); const [subclassName2, setSubclassName2] = useState(''); const [classLevel2, setClassLevel2] = useState(''); const [miniMarker, setMiniMarker] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (mode === 'template') supabase.from('profiles_monsters').select('*').order('name').then(({ data }) => setTemplates(data || [])); }, [mode]);
  useEffect(() => { const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; function handleKeyDown(e) { if (e.key === 'Escape') onClose(); } window.addEventListener('keydown', handleKeyDown); return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKeyDown); }; }, [onClose]);
  async function addFromTemplate(template) { if (adding) return; setAdding(true); const basePayload = { encounter_id: encounterId, name: template.name, side: template.side || 'ENEMY', ac: template.ac, hp_max: template.hp_max, hp_current: template.hp_max, initiative_mod: template.initiative_mod || 0, notes: template.notes || null, mod_str: template.mod_str || 0, mod_dex: template.mod_dex || 0, mod_con: template.mod_con || 0, mod_int: template.mod_int || 0, mod_wis: template.mod_wis || 0, mod_cha: template.mod_cha || 0, resistances: template.resistances || [], immunities: template.immunities || [], legendary_actions_max: template.legendary_actions_max || 0, legendary_resistances_max: template.legendary_resistances_max || 0, slots_max_1: template.slots_max_1 || 0, slots_max_2: template.slots_max_2 || 0, slots_max_3: template.slots_max_3 || 0, slots_max_4: template.slots_max_4 || 0, slots_max_5: template.slots_max_5 || 0, slots_max_6: template.slots_max_6 || 0, slots_max_7: template.slots_max_7 || 0, slots_max_8: template.slots_max_8 || 0, slots_max_9: template.slots_max_9 || 0 }; const enrichedPayload = compactObject({ ...basePayload, class_name: template.class_name || null, subclass_name: template.subclass_name || null, class_level: template.class_level != null ? toInt(template.class_level, 1) : null, class_name_2: template.class_name_2 || null, subclass_name_2: template.subclass_name_2 || null, class_level_2: template.class_level_2 != null ? toInt(template.class_level_2, 0) : null, mini_marker: template.mini_marker || null }); const attempt = await supabase.from('combatants').insert(enrichedPayload); if (attempt.error) await supabase.from('combatants').insert(basePayload); setAdding(false); onUpdate(); onClose(); }
  async function addManual() { if (!name.trim() || saving) return; setSaving(true); const basePayload = { encounter_id: encounterId, name: name.trim(), side, ac: toInt(ac, 10), hp_max: toInt(hp, 10), hp_current: toInt(hp, 10), initiative_mod: toInt(mod, 0) }; const enrichedPayload = compactObject({ ...basePayload, class_name: className.trim() || null, subclass_name: subclassName.trim() || null, class_level: classLevel !== '' ? toInt(classLevel, 1) : null, class_name_2: className2.trim() || null, subclass_name_2: subclassName2.trim() || null, class_level_2: classLevel2 !== '' ? toInt(classLevel2, 0) : null, mini_marker: miniMarker.trim() || null }); const attempt = await supabase.from('combatants').insert(enrichedPayload); if (attempt.error) await supabase.from('combatants').insert(basePayload); setSaving(false); onUpdate(); onClose(); }
  const filteredTemplates = templateFilter === 'ALL' ? templates : templates.filter(t => t.side === templateFilter);
  return <div className="modal-overlay" onClick={onClose}><div className="modal-panel add-combatant-modal" onClick={e => e.stopPropagation()}><div className="modal-header"><div><div className="panel-title" style={{ marginBottom: 4 }}>Add Combatant</div><div className="modal-subtitle">Add from template or enter a manual combatant.</div></div><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close add combatant">✕</button></div><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'template' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'template' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setMode('template')}>From Template</button><button className="btn btn-ghost" style={{ flex: 1, borderColor: mode === 'manual' ? 'var(--accent-blue)' : 'var(--border)', color: mode === 'manual' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setMode('manual')}>Manual</button></div>{mode === 'template' && <><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['ALL', 'ENEMY', 'NPC'].map(filter => <button key={filter} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: templateFilter === filter ? 'var(--accent-blue)' : 'var(--border)', color: templateFilter === filter ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setTemplateFilter(filter)}>{filter}</button>)}</div>{templates.length === 0 && <div className="empty-state">No templates yet. Add them in Manage.</div>}<div className="add-combatant-template-list">{filteredTemplates.map(template => <div key={template.id} className="add-combatant-template-row"><div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ minWidth: 0 }}><span className={`badge badge-${(template.side || 'enemy').toLowerCase()}`} style={{ marginRight: 6 }}>{template.side || 'ENEMY'}</span>{template.mini_marker && <span style={{ marginRight: 6, color: 'var(--accent-blue)', fontSize: 11, fontWeight: 700 }}>[{template.mini_marker}]</span>}<span style={{ fontSize: 13, fontWeight: 600 }}>{template.name}</span><span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>AC {template.ac} HP {template.hp_max}</span>{(template.legendary_actions_max > 0 || template.legendary_resistances_max > 0) && <span style={{ fontSize: 10, color: 'var(--accent-gold)', marginLeft: 6 }}>★ Legendary</span>}</div>{formatClassLine(template) && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatClassLine(template)}</div>}</div><button className="btn btn-primary btn-icon" onClick={() => addFromTemplate(template)} disabled={adding} style={{ fontSize: 16, minWidth: 32, minHeight: 32 }}>+</button></div>)}</div></>}{mode === 'manual' && <><input className="form-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} /><div className="form-row add-combatant-manual-grid"><div className="form-group"><label className="form-label">Side</label><select className="form-input" value={side} onChange={e => setSide(e.target.value)}><option value="ENEMY">Enemy</option><option value="NPC">NPC</option><option value="PC">PC</option></select></div><div className="form-group"><label className="form-label">AC</label><input className="form-input" type="number" value={ac} onChange={e => setAc(e.target.value)} /></div><div className="form-group"><label className="form-label">HP</label><input className="form-input" type="number" value={hp} onChange={e => setHp(e.target.value)} /></div><div className="form-group"><label className="form-label">Init Mod</label><input className="form-input" type="number" value={mod} onChange={e => setMod(e.target.value)} /></div></div><div className="form-row add-combatant-manual-grid"><div className="form-group"><label className="form-label">Primary Class</label><input className="form-input" value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. Fighter" /></div><div className="form-group"><label className="form-label">Primary Subclass</label><input className="form-input" value={subclassName} onChange={e => setSubclassName(e.target.value)} placeholder="Optional" /></div><div className="form-group"><label className="form-label">Primary Level</label><input className="form-input" type="number" value={classLevel} onChange={e => setClassLevel(e.target.value)} placeholder="Optional" /></div><div className="form-group"><label className="form-label">Mini Marker</label><input className="form-input" value={miniMarker} onChange={e => setMiniMarker(e.target.value)} placeholder="A / 1 / 🔴" maxLength={8} /></div></div><div className="form-row add-combatant-manual-grid"><div className="form-group"><label className="form-label">Secondary Class</label><input className="form-input" value={className2} onChange={e => setClassName2(e.target.value)} placeholder="Optional" /></div><div className="form-group"><label className="form-label">Secondary Subclass</label><input className="form-input" value={subclassName2} onChange={e => setSubclassName2(e.target.value)} placeholder="Optional" /></div><div className="form-group"><label className="form-label">Secondary Level</label><input className="form-input" type="number" value={classLevel2} onChange={e => setClassLevel2(e.target.value)} placeholder="Optional" /></div></div><div className="form-row" style={{ flexWrap: 'wrap' }}><button className="btn btn-primary" onClick={addManual} disabled={saving || !name.trim()}>{saving ? 'Adding…' : 'Add'}</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div></>}</div></div>;
}
