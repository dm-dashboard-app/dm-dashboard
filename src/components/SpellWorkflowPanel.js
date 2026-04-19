import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import SpellDetailsModal from './SpellDetailsModal';
import {
  SPELL_FILTER_LEVELS,
  SPELL_FILTER_PRIMARY,
  createSpellFilterState,
  getClassEntries,
  getKnownRuntimeSpells,
  getPreparedCapTotal,
  getPreparedPreparationSpells,
  getPreparedRuntimeSpells,
  getSpellRecord,
  getSpellRowMap,
  getSpellSummary,
  hasPreparationRequirement,
  sortSpells,
  spellMatchesFilterState,
  toggleSpellFilter,
} from '../utils/spellWorkflow';

function FilterChip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderColor: selected ? 'var(--accent-blue)' : 'var(--border)',
        color: selected ? 'var(--accent-blue)' : 'var(--text-secondary)',
        background: selected ? 'rgba(143,108,244,0.12)' : 'transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SpellRow({ spell, action, onOpenDetail, compact = false }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(spell)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetail(spell);
        }
      }}
      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: compact ? '8px 10px' : '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{spell.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {Number(spell.level) === 0 ? 'Cantrip' : `Level ${spell.level}`}
            {getSpellSummary(spell) ? ` • ${getSpellSummary(spell)}` : ''}
            {spell.ritual ? ' • Ritual' : ''}
            {spell.concentration ? ' • Concentration' : ''}
          </div>
        </div>
        {action ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>{action}</div> : null}
      </div>
    </div>
  );
}

function PanelBody({ title, subtitle, tabs, activeTab, setActiveTab, filterState, setFilterState, displayed, selectedSpell, setSelectedSpell, prepExtraSection, footer }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {title ? <div className="panel-title" style={{ marginBottom: 0 }}>{title}</div> : null}
        {subtitle ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {tabs.map(tab => (
            <button type="button" key={tab.value} className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13, padding: '8px 10px', borderColor: activeTab === tab.value ? 'var(--accent-blue)' : 'var(--border)', color: activeTab === tab.value ? 'var(--accent-blue)' : 'var(--text-secondary)', background: activeTab === tab.value ? 'rgba(143,108,244,0.12)' : 'transparent', fontWeight: 800 }} onClick={() => setActiveTab(tab.value)}>{tab.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPELL_FILTER_PRIMARY.map(item => <FilterChip key={item.value} label={item.label} selected={(filterState.primary || ['all']).includes(item.value)} onClick={() => setFilterState(current => toggleSpellFilter(current, item.value))} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPELL_FILTER_LEVELS.map(item => <FilterChip key={item.value} label={item.label} selected={filterState.level === item.value} onClick={() => setFilterState(current => toggleSpellFilter(current, item.value))} />)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '44vh', overflowY: 'auto', paddingRight: 2 }}>
        {displayed.length === 0 && <div className="empty-state">No spells in this view.</div>}
        {displayed.map(item => item.render(setSelectedSpell))}
      </div>
      {prepExtraSection ? <div style={{ marginTop: 12 }}>{prepExtraSection}</div> : null}
      {footer ? <div style={{ marginTop: 12 }}>{footer}</div> : null}
      <SpellDetailsModal spell={selectedSpell} onClose={() => setSelectedSpell(null)} />
    </>
  );
}

export default function SpellWorkflowPanel({ profile, state, encounterId, onUpdate, role = 'player', mode = 'runtime', variant = 'panel', onClose = null, prepReady = false, onMarkReady = null, onPrepChanged = null, title = '', subtitle = '', prepExtraSection = null }) {
  const [allSpells, setAllSpells] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpell, setSelectedSpell] = useState(null);
  const [activeTab, setActiveTab] = useState('known');
  const [filterState, setFilterState] = useState(createSpellFilterState());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile?.id) {
        setAllSpells([]);
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [spellsRes, rowsRes] = await Promise.all([
        supabase.from('spells').select('*').order('level').order('name'),
        supabase.from('profile_player_spells').select('*, spells(*)').eq('player_profile_id', profile.id),
      ]);
      if (cancelled) return;
      setAllSpells((spellsRes.data || []).map(getSpellRecord));
      setRows((rowsRes.data || []).map(getSpellRecord));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const classEntries = useMemo(() => getClassEntries(profile), [profile]);
  const hasPreparedTab = useMemo(() => hasPreparationRequirement(profile), [profile]);
  const knownRuntime = useMemo(() => getKnownRuntimeSpells(profile, allSpells, rows), [profile, allSpells, rows]);
  const preparedRuntime = useMemo(() => getPreparedRuntimeSpells(profile, rows), [profile, rows]);
  const prepKnown = useMemo(() => getPreparedPreparationSpells(profile, allSpells, rows), [profile, allSpells, rows]);
  const prepPrepared = useMemo(() => sortSpells(prepKnown.filter(spell => spell.prepared)), [prepKnown]);
  const prepCapTotal = useMemo(() => getPreparedCapTotal(profile), [profile]);
  const preparedCount = useMemo(() => rows.filter(row => row.prepared && row.level > 0).length, [rows]);

  useEffect(() => {
    if (mode === 'prep') {
      setActiveTab('known');
    } else {
      setActiveTab(hasPreparedTab ? 'prepared' : 'known');
    }
    setFilterState(createSpellFilterState());
  }, [profile?.id, mode, hasPreparedTab]);

  const tabs = useMemo(() => {
    if (!hasPreparedTab) return [{ value: 'known', label: 'Known' }];
    return [{ value: 'prepared', label: 'Prepared' }, { value: 'known', label: 'Known' }];
  }, [hasPreparedTab]);

  async function refreshRows() {
    if (!profile?.id) return;
    const { data } = await supabase.from('profile_player_spells').select('*, spells(*)').eq('player_profile_id', profile.id);
    setRows((data || []).map(getSpellRecord));
    onUpdate?.();
  }

  async function ensureRow(spell, patch = {}) {
    const rowMap = getSpellRowMap(rows);
    const existing = rowMap[spell.spellId];
    if (existing?.rowId) {
      await supabase.from('profile_player_spells').update(patch).eq('id', existing.rowId);
    } else {
      await supabase.from('profile_player_spells').insert({ player_profile_id: profile.id, spell_id: spell.spellId, is_known: true, is_prepared: false, ...patch });
    }
    await refreshRows();
  }

  async function setPrepDirty() {
    if (mode !== 'prep' || !state?.id) return;
    await supabase.from('player_encounter_state').update({ spell_prep_ready: false }).eq('id', state.id);
    onPrepChanged?.();
  }

  async function togglePrepared(spell) {
    if (mode !== 'prep' || Number(spell.level) === 0) return;
    if (!spell.prepared && prepCapTotal > 0 && preparedCount >= prepCapTotal) {
      window.alert('Prepared spell limit reached.');
      return;
    }
    await ensureRow(spell, { is_known: true, is_prepared: !spell.prepared });
    await setPrepDirty();
  }

  const displayedSource = activeTab === 'prepared'
    ? (mode === 'prep' ? prepPrepared : preparedRuntime)
    : (mode === 'prep' ? prepKnown : knownRuntime);

  const displayed = useMemo(() => {
    const list = sortSpells(displayedSource.filter(spell => spellMatchesFilterState(spell, filterState)));
    return list.map(spell => ({
      ...spell,
      render: openDetail => {
        const showPrepAction = mode === 'prep' && Number(spell.level) > 0;
        const action = showPrepAction ? (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => togglePrepared(spell)}>{spell.prepared ? 'Unprepare' : 'Prepare'}</button>
        ) : null;
        return <SpellRow key={`${activeTab}-${spell.spellId}`} spell={spell} action={action} onOpenDetail={openDetail} />;
      },
    }));
  }, [displayedSource, filterState, mode, activeTab, preparedCount, prepCapTotal, togglePrepared]);

  const actorLabel = role === 'dm' ? 'DM view' : 'Player view';
  const panelTitle = title || (mode === 'prep' ? 'Long Rest Preparation' : 'Spells');
  const panelSubtitle = subtitle || (mode === 'prep'
    ? `Choose prepared spells from Known, review them in Prepared, then mark ready. Prepared ${preparedCount}/${prepCapTotal || 0}.`
    : `${actorLabel} • ${classEntries.map(entry => `${entry.label} ${entry.level}`).join(' / ')}`);

  const footer = mode === 'prep' && onMarkReady ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 11, color: prepReady ? 'var(--accent-green)' : 'var(--text-muted)' }}>
        {prepReady ? 'Ready for long rest.' : 'Not ready yet.'}
      </div>
      <button type="button" className="btn btn-primary" onClick={onMarkReady}>{prepReady ? 'Ready ✓' : 'Mark Ready'}</button>
    </div>
  ) : null;

  const body = loading
    ? <div className="empty-state">Loading spells…</div>
    : <PanelBody title={panelTitle} subtitle={panelSubtitle} tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} filterState={filterState} setFilterState={setFilterState} displayed={displayed} selectedSpell={selectedSpell} setSelectedSpell={setSelectedSpell} prepExtraSection={prepExtraSection} footer={footer} />;

  if (variant === 'modal') {
    return (
      <div className="modal-overlay" onClick={onClose || (() => {})}>
        <div className="modal-panel" style={{ width: 'min(860px, calc(100vw - 24px))', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="panel-title" style={{ marginBottom: 4 }}>{panelTitle}</div>
              <div className="modal-subtitle">{panelSubtitle}</div>
            </div>
            {onClose ? <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button> : null}
          </div>
          <div style={{ marginTop: 8 }}>{loading ? <div className="empty-state">Loading spells…</div> : <PanelBody title="" subtitle="" tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} filterState={filterState} setFilterState={setFilterState} displayed={displayed} selectedSpell={selectedSpell} setSelectedSpell={setSelectedSpell} prepExtraSection={prepExtraSection} footer={footer} />}</div>
        </div>
      </div>
    );
  }

  return <div className="panel" style={{ marginTop: 12 }}>{body}</div>;
}

export function ConcentrationSpellPickerModal({ open, profile, encounterId, state, actor = 'Player', onClose, onUpdate }) {
  const [rows, setRows] = useState([]);
  const [selectedSpell, setSelectedSpell] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open || !profile?.id) return;
      const { data: rowsData } = await supabase
        .from('profile_player_spells')
        .select('*, spells(*)')
        .eq('player_profile_id', profile.id);
      if (cancelled) return;
      setRows((rowsData || []).map(getSpellRecord));
    }
    load();
    return () => { cancelled = true; };
  }, [open, profile?.id]);

  const spells = useMemo(() => {
    const prepared = getPreparedRuntimeSpells(profile, rows);
    return sortSpells(prepared.filter(spell => !!spell.concentration));
  }, [profile, rows]);

  async function setConcentration(spell = null) {
    if (!state?.id) return;
    await supabase.from('player_encounter_state').update({ concentration: true, concentration_spell_id: spell?.spellId || null, concentration_check_dc: null }).eq('id', state.id);
    if (encounterId) await supabase.from('combat_log').insert({ encounter_id: encounterId, actor, action: 'con', detail: spell ? `Concentration started: ${spell.name}` : 'Concentration started' });
    onUpdate?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 'min(760px, calc(100vw - 24px))', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>Choose Concentration Spell</div>
            <div className="modal-subtitle">Pick the concentration spell for this player, or set a generic concentration state.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Generic Concentration</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Use this when you just want concentration active without linking a spell.</div>
            </div>
            <button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setConcentration(null)}>Choose</button>
          </div>
          {spells.map(spell => (
            <SpellRow key={spell.spellId} spell={spell} action={<button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setConcentration(spell)}>Choose</button>} onOpenDetail={setSelectedSpell} compact />
          ))}
          {spells.length === 0 && <div className="empty-state">No concentration-capable spells available in the current spell lists.</div>}
        </div>
        <SpellDetailsModal spell={selectedSpell} onClose={() => setSelectedSpell(null)} />
      </div>
    </div>
  );
}
