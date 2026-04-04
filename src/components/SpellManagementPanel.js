import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import SpellDetailsModal from './SpellDetailsModal';
import {
  SPELL_FILTER_LEVELS,
  SPELL_FILTER_PRIMARY,
  createSpellFilterState,
  spellMatchesFilterState,
  toggleSpellFilter,
} from '../utils/spellWorkflow';

const CLASS_OPTIONS = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
const SOURCE_OPTIONS = ['all', 'official_srd', 'homebrew'];
const API_ROOT = 'https://www.dnd5eapi.co/api/2014';

function normalizeClassName(name) {
  return String(name || '').trim().toLowerCase();
}

function emptyHomebrewForm() {
  return {
    id: null,
    external_key: '',
    name: '',
    level: 0,
    school: '',
    casting_time: '',
    range_text: '',
    duration_text: '',
    components_text: '',
    material_text: '',
    concentration: false,
    ritual: false,
    is_cantrip: true,
    description: '',
    higher_level: '',
    class_tags: [],
    source_type: 'homebrew',
    is_homebrew: true,
  };
}

function buildComponentsText(components = [], material = '') {
  const base = Array.isArray(components) ? components.join(', ') : String(components || '');
  if (material && !base.includes('M')) return base ? `${base}, M` : 'M';
  return base;
}

function mapApiSpell(detail = {}) {
  const classTags = (detail.classes || []).map(entry => normalizeClassName(entry.name)).filter(Boolean);
  const level = Number.isFinite(detail.level) ? detail.level : 0;
  return {
    external_key: `srd_2014:${detail.index}`,
    source_type: 'official_srd',
    is_homebrew: false,
    name: detail.name,
    level,
    is_cantrip: level === 0,
    school: detail.school?.name || '',
    casting_time: detail.casting_time || '',
    range_text: detail.range || '',
    duration_text: detail.duration || '',
    components_text: buildComponentsText(detail.components, detail.material),
    material_text: detail.material || '',
    concentration: !!detail.concentration,
    ritual: !!detail.ritual,
    description: Array.isArray(detail.desc) ? detail.desc.join('\n\n') : String(detail.desc || ''),
    higher_level: Array.isArray(detail.higher_level) ? detail.higher_level.join('\n\n') : String(detail.higher_level || ''),
    class_tags: classTags,
  };
}

async function fetchSpellDetails(index) {
  const response = await fetch(`${API_ROOT}/spells/${index}`);
  if (!response.ok) throw new Error(`Failed to fetch SRD spell ${index}`);
  return response.json();
}

async function importSrdSpells(onProgress) {
  const response = await fetch(`${API_ROOT}/spells`);
  if (!response.ok) throw new Error('Failed to fetch SRD 5.1 spell index');
  const data = await response.json();
  const results = data.results || [];
  const batchSize = 20;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const details = await Promise.all(batch.map(item => fetchSpellDetails(item.index)));
    const mapped = details.map(mapApiSpell);
    const { error } = await supabase.from('spells').upsert(mapped, { onConflict: 'external_key' });
    if (error) throw error;
    onProgress(`Imported ${Math.min(i + batch.length, results.length)} / ${results.length} SRD spells…`);
  }
}

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
        background: selected ? 'rgba(74,158,255,0.12)' : 'transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SpellRow({ spell, onOpenDetails }) {
  const classesText = (spell.class_tags || []).join(', ');
  const previewText = String(spell.description || '').replace(/\s+/g, ' ').trim();

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => onOpenDetails(spell)}
      style={{
        width: '100%',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        textAlign: 'left',
        background: 'var(--bg-panel-2)',
        appearance: 'none',
        WebkitAppearance: 'none',
        WebkitTapHighlightColor: 'transparent',
        whiteSpace: 'normal',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{spell.name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Number(spell.level) === 0 ? 'Cantrip' : `Level ${spell.level}`}</span>
            {spell.source_type === 'homebrew' && <span style={{ fontSize: 10, color: 'var(--accent-gold)' }}>Homebrew</span>}
            {spell.concentration && <span style={{ fontSize: 10, color: 'var(--accent-gold)' }}>Concentration</span>}
            {spell.ritual && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ritual</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {[spell.school, spell.casting_time, spell.range_text, spell.duration_text].filter(Boolean).join(' • ')}
          </div>
          {classesText && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Classes: {classesText}</div>}
          {previewText && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginTop: 4,
                whiteSpace: 'normal',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.4,
              }}
            >
              {previewText}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--accent-blue)', whiteSpace: 'nowrap', flex: '0 0 auto', paddingTop: 1 }}>View details</div>
      </div>
    </button>
  );
}

function HomebrewEditor({ form, setForm, onSave, onCancel, saving, errorMessage }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  function toggleClassTag(className) {
    const normalized = normalizeClassName(className);
    setForm(current => ({
      ...current,
      class_tags: current.class_tags.includes(normalized)
        ? current.class_tags.filter(tag => tag !== normalized)
        : [...current.class_tags, normalized],
    }));
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel" style={{ width: 'min(760px, calc(100vw - 24px))', maxHeight: '90vh', overflowY: 'auto' }} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>{form.id ? 'Edit Homebrew Spell' : 'New Homebrew Spell'}</div>
            <div className="modal-subtitle">Create or edit a homebrew spell in a focused editor.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onCancel}>✕</button>
        </div>

        {errorMessage && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginBottom: 10 }}>{errorMessage}</div>}

        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} /></div>
        <div className="form-row" style={{ gap: 8 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Level</label>
            <input className="form-input" type="number" min={0} max={9} value={form.level === '' ? '' : String(form.level)} onChange={e => {
              const rawValue = e.target.value;
              setForm(current => {
                if (rawValue === '') return { ...current, level: '', is_cantrip: true };
                const nextLevel = parseInt(rawValue, 10);
                if (Number.isNaN(nextLevel)) return current;
                return { ...current, level: nextLevel, is_cantrip: nextLevel === 0 };
              });
            }} />
          </div>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">School</label><input className="form-input" value={form.school} onChange={e => setForm(current => ({ ...current, school: e.target.value }))} /></div>
        </div>
        <div className="form-row" style={{ gap: 8 }}>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Casting Time</label><input className="form-input" value={form.casting_time} onChange={e => setForm(current => ({ ...current, casting_time: e.target.value }))} /></div>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Range</label><input className="form-input" value={form.range_text} onChange={e => setForm(current => ({ ...current, range_text: e.target.value }))} /></div>
        </div>
        <div className="form-row" style={{ gap: 8 }}>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Duration</label><input className="form-input" value={form.duration_text} onChange={e => setForm(current => ({ ...current, duration_text: e.target.value }))} /></div>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Components</label><input className="form-input" value={form.components_text} onChange={e => setForm(current => ({ ...current, components_text: e.target.value }))} placeholder="V, S, M" /></div>
        </div>
        <div className="form-group"><label className="form-label">Material</label><input className="form-input" value={form.material_text} onChange={e => setForm(current => ({ ...current, material_text: e.target.value }))} /></div>
        <label className="checkbox-row"><input type="checkbox" checked={!!form.concentration} onChange={e => setForm(current => ({ ...current, concentration: e.target.checked }))} /><span>Concentration</span></label>
        <label className="checkbox-row"><input type="checkbox" checked={!!form.ritual} onChange={e => setForm(current => ({ ...current, ritual: e.target.checked }))} /><span>Ritual</span></label>
        <div className="panel-title" style={{ marginTop: 10 }}>Classes</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {CLASS_OPTIONS.map(className => {
            const active = form.class_tags.includes(normalizeClassName(className));
            return <button type="button" key={className} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', borderColor: active ? 'var(--accent-blue)' : 'var(--border)', color: active ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => toggleClassTag(className)}>{className}</button>;
          })}
        </div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={5} value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Higher Level</label><textarea className="form-input" rows={3} value={form.higher_level} onChange={e => setForm(current => ({ ...current, higher_level: e.target.value }))} /></div>
        <div className="form-row" style={{ marginTop: 12 }}><button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save Homebrew Spell'}</button><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  );
}

export default function SpellManagementPanel() {
  const [spells, setSpells] = useState([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [spellFilters, setSpellFilters] = useState(createSpellFilterState());
  const [status, setStatus] = useState('');
  const [detailSpell, setDetailSpell] = useState(null);
  const [homebrewOpen, setHomebrewOpen] = useState(false);
  const [homebrewForm, setHomebrewForm] = useState(emptyHomebrewForm());
  const [homebrewError, setHomebrewError] = useState('');
  const [savingHomebrew, setSavingHomebrew] = useState(false);
  const [importing, setImporting] = useState(false);

  async function loadAll() {
    const { data, error } = await supabase.from('spells').select('*').order('level').order('name');
    if (error) {
      setStatus(error.message || 'Failed to load spells.');
      return;
    }
    setSpells(data || []);
  }

  useEffect(() => { loadAll(); }, []);

  const filteredSpells = useMemo(() => {
    return spells.filter(spell => {
      if (sourceFilter !== 'all' && spell.source_type !== sourceFilter) return false;
      if (classFilter !== 'all' && !(spell.class_tags || []).includes(classFilter)) return false;
      if (!spellMatchesFilterState(spell, spellFilters)) return false;
      if (search.trim()) {
        const haystack = [spell.name, spell.school, spell.description].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [spells, sourceFilter, classFilter, search, spellFilters]);

  async function handleImportSrd() {
    setImporting(true);
    setStatus('Starting SRD 5.1 import…');
    try {
      await importSrdSpells(setStatus);
      setStatus('SRD 5.1 spell import complete.');
      await loadAll();
    } catch (error) {
      setStatus(error?.message || 'Failed to import SRD spells.');
    } finally {
      setImporting(false);
    }
  }

  async function saveHomebrew() {
    setSavingHomebrew(true);
    setHomebrewError('');
    setStatus('');

    try {
      const { id, ...rest } = homebrewForm;
      const normalizedName = rest.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const normalizedLevel = rest.level === '' ? 0 : Number(rest.level || 0);
      const payload = {
        ...rest,
        level: normalizedLevel,
        external_key: rest.external_key || `homebrew:${normalizedName}`,
        source_type: 'homebrew',
        is_homebrew: true,
        is_cantrip: normalizedLevel === 0,
        class_tags: (rest.class_tags || []).map(normalizeClassName),
      };

      let result;
      if (id) result = await supabase.from('spells').update(payload).eq('id', id).select().single();
      else result = await supabase.from('spells').insert(payload).select().single();

      if (result.error) throw result.error;

      setHomebrewOpen(false);
      setHomebrewForm(emptyHomebrewForm());
      setHomebrewError('');
      setStatus(result.data?.name ? `Homebrew spell saved: ${result.data.name}` : 'Homebrew spell saved.');
      await loadAll();
      if (result.data) {
        setDetailSpell({
          ...result.data,
          castingTime: result.data.casting_time,
          rangeText: result.data.range_text,
          durationText: result.data.duration_text,
          componentsText: result.data.components_text,
          materialText: result.data.material_text,
          classTags: result.data.class_tags,
          higherLevel: result.data.higher_level,
        });
      }
    } catch (error) {
      const message = error?.message || error?.details || error?.hint || 'Failed to save homebrew spell.';
      setHomebrewError(message);
      setStatus(message);
    } finally {
      setSavingHomebrew(false);
    }
  }

  function openEditHomebrew(spell) {
    setHomebrewError('');
    setHomebrewForm({
      id: spell.id,
      external_key: spell.external_key || '',
      name: spell.name || '',
      level: Number(spell.level) || 0,
      school: spell.school || '',
      casting_time: spell.casting_time || '',
      range_text: spell.range_text || '',
      duration_text: spell.duration_text || '',
      components_text: spell.components_text || '',
      material_text: spell.material_text || '',
      concentration: !!spell.concentration,
      ritual: !!spell.ritual,
      is_cantrip: !!spell.is_cantrip,
      description: spell.description || '',
      higher_level: spell.higher_level || '',
      class_tags: spell.class_tags || [],
      source_type: 'homebrew',
      is_homebrew: true,
    });
    setDetailSpell(null);
    setHomebrewOpen(true);
  }

  function openDetails(spell) {
    setDetailSpell({
      ...spell,
      castingTime: spell.casting_time,
      rangeText: spell.range_text,
      durationText: spell.duration_text,
      componentsText: spell.components_text,
      materialText: spell.material_text,
      classTags: spell.class_tags,
      higherLevel: spell.higher_level,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div className="panel">
        <div className="panel-title">Spells</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Library/admin view. Browse spell details here. Homebrew spells remain editable through the detail modal.
        </div>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <button type="button" className="btn btn-primary" onClick={handleImportSrd} disabled={importing}>{importing ? 'Importing…' : 'Import SRD 5.1'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setDetailSpell(null); setHomebrewError(''); setHomebrewForm(emptyHomebrewForm()); setHomebrewOpen(true); }}>+ Homebrew Spell</button>
        </div>
        {status && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{status}</div>}
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <input className="form-input" style={{ flex: '1 1 220px' }} placeholder="Search spells" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input" style={{ width: 130 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>{SOURCE_OPTIONS.map(option => <option key={option} value={option}>{option === 'all' ? 'All Sources' : option}</option>)}</select>
          <select className="form-input" style={{ width: 140 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}><option value="all">All Classes</option>{CLASS_OPTIONS.map(option => <option key={option} value={normalizeClassName(option)}>{option}</option>)}</select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPELL_FILTER_PRIMARY.map(item => <FilterChip key={item.value} label={item.label} selected={(spellFilters.primary || ['all']).includes(item.value)} onClick={() => setSpellFilters(current => toggleSpellFilter(current, item.value))} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPELL_FILTER_LEVELS.map(item => <FilterChip key={item.value} label={item.label} selected={spellFilters.level === item.value} onClick={() => setSpellFilters(current => toggleSpellFilter(current, item.value))} />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredSpells.map(spell => <SpellRow key={spell.id} spell={spell} onOpenDetails={openDetails} />)}
          {filteredSpells.length === 0 && <div className="empty-state">No spells match the current filters yet.</div>}
        </div>
      </div>
      {detailSpell && <SpellDetailsModal spell={detailSpell} onClose={() => setDetailSpell(null)} onEditHomebrew={detailSpell?.source_type === 'homebrew' ? () => openEditHomebrew(detailSpell) : null} />}
      {homebrewOpen && <HomebrewEditor form={homebrewForm} setForm={setHomebrewForm} onSave={saveHomebrew} onCancel={() => { setHomebrewOpen(false); setHomebrewError(''); setHomebrewForm(emptyHomebrewForm()); }} saving={savingHomebrew} errorMessage={homebrewError} />}
    </div>
  );
}
