import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const CLASS_OPTIONS = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
const SOURCE_OPTIONS = ['all', 'official_srd', 'homebrew'];
const LEVEL_OPTIONS = ['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const API_ROOT = 'https://www.dnd5eapi.co/api/2014';

function normalizeClassName(name) {
  return String(name || '').trim().toLowerCase();
}

function classSummary(entity = {}) {
  const parts = [];
  if (entity.class_name) parts.push([entity.class_name, entity.class_level ? `Lv ${entity.class_level}` : null, entity.subclass_name || null].filter(Boolean).join(' • '));
  if (entity.class_name_2) parts.push([entity.class_name_2, entity.class_level_2 ? `Lv ${entity.class_level_2}` : null, entity.subclass_name_2 || null].filter(Boolean).join(' • '));
  return parts.join(' / ');
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

function getTargetClassTags(target = {}) {
  return [target.class_name, target.class_name_2].map(normalizeClassName).filter(Boolean);
}

function getPlayerAssignmentMode(player = {}) {
  const classTags = getTargetClassTags(player);
  if (classTags.includes('wizard')) return 'wizard';
  if (classTags.some(tag => ['cleric', 'druid', 'paladin'].includes(tag))) return 'prepared';
  if (classTags.some(tag => ['bard', 'ranger', 'sorcerer', 'warlock'].includes(tag))) return 'known';
  return 'manual';
}

function modeHelpText(mode) {
  if (mode === 'wizard') return 'Wizard: learn spells into the spellbook, then prepare from learned spells. Cantrips are learned only.';
  if (mode === 'prepared') return 'Prepared caster: prepare from the legal class list. Cantrips are added or removed separately.';
  if (mode === 'known') return 'Known caster: maintain a learned spell pool. Cantrips are learned too.';
  return 'Manual mode: assign and prepare spells directly as needed.';
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

async function ensurePlayerSpell(playerId, spellId, patch = {}) {
  const { data: existing } = await supabase.from('profile_player_spells').select('*').eq('player_profile_id', playerId).eq('spell_id', spellId).maybeSingle();
  if (existing?.id) return supabase.from('profile_player_spells').update(patch).eq('id', existing.id);
  return supabase.from('profile_player_spells').insert({ player_profile_id: playerId, spell_id: spellId, is_known: true, is_prepared: false, ...patch });
}

async function removePlayerSpell(playerId, spellId) {
  return supabase.from('profile_player_spells').delete().eq('player_profile_id', playerId).eq('spell_id', spellId);
}

async function ensureMonsterSpell(monsterId, spellId, patch = {}) {
  const { data: existing } = await supabase.from('profile_monster_spells').select('*').eq('monster_profile_id', monsterId).eq('spell_id', spellId).maybeSingle();
  if (existing?.id) return supabase.from('profile_monster_spells').update(patch).eq('id', existing.id);
  return supabase.from('profile_monster_spells').insert({ monster_profile_id: monsterId, spell_id: spellId, is_known: true, is_prepared: true, ...patch });
}

async function removeMonsterSpell(monsterId, spellId) {
  return supabase.from('profile_monster_spells').delete().eq('monster_profile_id', monsterId).eq('spell_id', spellId);
}

function SpellRow({ spell, assigned, targetType, assignmentMode, targetId, onAssign, onPrepare, onEditHomebrew }) {
  const isKnown = !!assigned?.is_known;
  const isPrepared = !!assigned?.is_prepared;
  const isCantrip = Number(spell.level) === 0;
  const classesText = (spell.class_tags || []).join(', ');

  let buttons = null;
  if (targetType === 'player') {
    if (assignmentMode === 'wizard') {
      buttons = (
        <>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onAssign(spell, !isKnown)}>{isKnown ? 'Forget' : 'Learn'}</button>
          {!isCantrip && <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onPrepare(spell, !isPrepared)} disabled={!isKnown && !isPrepared}>{isPrepared ? 'Unprepare' : 'Prepare'}</button>}
        </>
      );
    } else if (assignmentMode === 'prepared') {
      buttons = isCantrip
        ? <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onAssign(spell, !isKnown)}>{isKnown ? 'Remove Cantrip' : 'Add Cantrip'}</button>
        : <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onPrepare(spell, !isPrepared)}>{isPrepared ? 'Unprepare' : 'Prepare'}</button>;
    } else {
      buttons = <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onAssign(spell, !isKnown)}>{isKnown ? 'Forget' : (isCantrip ? 'Add Cantrip' : 'Learn')}</button>;
    }
  } else {
    buttons = (
      <>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onAssign(spell, !isKnown)}>{isKnown ? 'Unassign' : 'Assign'}</button>
        {!isCantrip && targetId && isKnown && <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onPrepare(spell, !isPrepared)}>{isPrepared ? 'Unprep' : 'Prepare'}</button>}
      </>
    );
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
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
          {spell.description && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{String(spell.description).slice(0, 220)}{String(spell.description).length > 220 ? '…' : ''}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {spell.source_type === 'homebrew' && <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onEditHomebrew(spell)}>Edit</button>}
          {buttons}
        </div>
      </div>
      {(isKnown || isPrepared) && <div style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{isKnown ? 'Assigned' : ''}{isKnown && isPrepared ? ' • ' : ''}{isPrepared ? 'Prepared' : ''}</div>}
    </div>
  );
}

function HomebrewEditor({ form, setForm, onSave, onCancel, saving }) {
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

        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} /></div>
        <div className="form-row" style={{ gap: 8 }}>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Level</label><input className="form-input" type="number" min={0} max={9} value={form.level} onChange={e => { const level = parseInt(e.target.value || '0', 10); setForm(current => ({ ...current, level, is_cantrip: level === 0 })); }} /></div>
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
  const [players, setPlayers] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [targetType, setTargetType] = useState('player');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [assignments, setAssignments] = useState({});
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [status, setStatus] = useState('');
  const [homebrewOpen, setHomebrewOpen] = useState(false);
  const [homebrewForm, setHomebrewForm] = useState(emptyHomebrewForm());
  const [savingHomebrew, setSavingHomebrew] = useState(false);
  const [importing, setImporting] = useState(false);

  const selectedTarget = useMemo(() => {
    if (targetType === 'player') return players.find(player => player.id === selectedTargetId) || null;
    return monsters.find(monster => monster.id === selectedTargetId) || null;
  }, [targetType, selectedTargetId, players, monsters]);

  const assignmentMode = targetType === 'player' ? getPlayerAssignmentMode(selectedTarget || {}) : 'manual';

  async function loadAll() {
    const [spellsRes, playersRes, monstersRes] = await Promise.all([
      supabase.from('spells').select('*').order('level').order('name'),
      supabase.from('profiles_players').select('*').order('name'),
      supabase.from('profiles_monsters').select('*').order('name'),
    ]);
    setSpells(spellsRes.data || []);
    setPlayers(playersRes.data || []);
    setMonsters(monstersRes.data || []);
    setSelectedTargetId(current => current || playersRes.data?.[0]?.id || '');
  }

  async function loadAssignments(nextTargetType = targetType, nextTargetId = selectedTargetId) {
    if (!nextTargetId) { setAssignments({}); return; }
    if (nextTargetType === 'player') {
      const { data } = await supabase.from('profile_player_spells').select('*').eq('player_profile_id', nextTargetId);
      setAssignments(Object.fromEntries((data || []).map(row => [row.spell_id, row])));
    } else {
      const { data } = await supabase.from('profile_monster_spells').select('*').eq('monster_profile_id', nextTargetId);
      setAssignments(Object.fromEntries((data || []).map(row => [row.spell_id, row])));
    }
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadAssignments(targetType, selectedTargetId); }, [targetType, selectedTargetId]);

  const filteredSpells = useMemo(() => {
    return spells.filter(spell => {
      if (sourceFilter !== 'all' && spell.source_type !== sourceFilter) return false;
      if (levelFilter !== 'all' && Number(spell.level) !== Number(levelFilter)) return false;
      if (classFilter !== 'all' && !(spell.class_tags || []).includes(classFilter)) return false;
      if (search.trim()) {
        const haystack = [spell.name, spell.school, spell.description].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [spells, sourceFilter, levelFilter, classFilter, search]);

  async function handleImportSrd() {
    setImporting(true);
    setStatus('Starting SRD 5.1 import…');
    try {
      await importSrdSpells(setStatus);
      setStatus('SRD 5.1 spell import complete.');
      await loadAll();
    } catch (error) {
      setStatus(error.message || 'Failed to import SRD spells.');
    } finally {
      setImporting(false);
    }
  }

  async function saveHomebrew() {
    setSavingHomebrew(true);
    const normalizedName = homebrewForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const payload = {
      ...homebrewForm,
      external_key: homebrewForm.external_key || `homebrew:${normalizedName}`,
      source_type: 'homebrew',
      is_homebrew: true,
      is_cantrip: Number(homebrewForm.level) === 0,
      class_tags: (homebrewForm.class_tags || []).map(normalizeClassName),
    };
    const { error } = await supabase.from('spells').upsert(payload, { onConflict: 'external_key' });
    setSavingHomebrew(false);
    if (error) {
      setStatus(error.message || 'Failed to save homebrew spell.');
      return;
    }
    setHomebrewOpen(false);
    setHomebrewForm(emptyHomebrewForm());
    setStatus('Homebrew spell saved.');
    loadAll();
  }

  async function handleAssign(spell, nextKnown) {
    if (!selectedTargetId) return;
    if (targetType === 'player') {
      if (nextKnown) {
        const patch = assignmentMode === 'prepared' && Number(spell.level) > 0 ? { is_known: true, is_prepared: true } : { is_known: true };
        await ensurePlayerSpell(selectedTargetId, spell.id, patch);
      } else {
        await removePlayerSpell(selectedTargetId, spell.id);
      }
    } else {
      if (nextKnown) await ensureMonsterSpell(selectedTargetId, spell.id, { is_known: true, is_prepared: Number(spell.level) > 0 });
      else await removeMonsterSpell(selectedTargetId, spell.id);
    }
    loadAssignments(targetType, selectedTargetId);
  }

  async function handlePrepare(spell, nextPrepared) {
    if (!selectedTargetId) return;
    if (targetType === 'player') {
      if (assignmentMode === 'wizard' && !assignments[spell.id]?.is_known && nextPrepared) {
        await ensurePlayerSpell(selectedTargetId, spell.id, { is_known: true, is_prepared: true });
      } else if (assignmentMode === 'prepared' && nextPrepared) {
        await ensurePlayerSpell(selectedTargetId, spell.id, { is_known: true, is_prepared: true });
      } else if (assignmentMode === 'prepared' && !nextPrepared) {
        const existing = assignments[spell.id];
        if (existing?.id) await supabase.from('profile_player_spells').update({ is_prepared: false }).eq('id', existing.id);
      } else {
        const existing = assignments[spell.id];
        if (existing?.id) await supabase.from('profile_player_spells').update({ is_prepared: nextPrepared }).eq('id', existing.id);
      }
    } else {
      await ensureMonsterSpell(selectedTargetId, spell.id, { is_known: true, is_prepared: nextPrepared });
    }
    loadAssignments(targetType, selectedTargetId);
  }

  function openEditHomebrew(spell) {
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
    setHomebrewOpen(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div className="panel">
        <div className="panel-title">Spells</div>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <button type="button" className="btn btn-primary" onClick={handleImportSrd} disabled={importing}>{importing ? 'Importing…' : 'Import SRD 5.1'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setHomebrewForm(emptyHomebrewForm()); setHomebrewOpen(true); }}>+ Homebrew Spell</button>
        </div>
        {status && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{status}</div>}
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <input className="form-input" style={{ flex: '1 1 220px' }} placeholder="Search spells" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input" style={{ width: 130 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>{SOURCE_OPTIONS.map(option => <option key={option} value={option}>{option === 'all' ? 'All Sources' : option}</option>)}</select>
          <select className="form-input" style={{ width: 130 }} value={String(levelFilter)} onChange={e => setLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>{LEVEL_OPTIONS.map(option => <option key={String(option)} value={String(option)}>{option === 'all' ? 'All Levels' : option === 0 ? 'Cantrip' : `Level ${option}`}</option>)}</select>
          <select className="form-input" style={{ width: 140 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}><option value="all">All Classes</option>{CLASS_OPTIONS.map(option => <option key={option} value={normalizeClassName(option)}>{option}</option>)}</select>
        </div>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <select className="form-input" style={{ width: 160 }} value={targetType} onChange={e => { const nextType = e.target.value; setTargetType(nextType); setSelectedTargetId(nextType === 'player' ? (players[0]?.id || '') : (monsters[0]?.id || '')); }}><option value="player">Players</option><option value="monster">Monsters/NPCs</option></select>
          <select className="form-input" style={{ flex: '1 1 260px' }} value={selectedTargetId} onChange={e => setSelectedTargetId(e.target.value)}>
            <option value="">No target selected</option>
            {(targetType === 'player' ? players : monsters).map(target => <option key={target.id} value={target.id}>{target.name}{classSummary(target) ? ` — ${classSummary(target)}` : ''}</option>)}
          </select>
        </div>
        {selectedTarget && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{targetType === 'player' ? modeHelpText(assignmentMode) : 'Monster/NPC mode: assign any spell, optionally mark as prepared.'}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredSpells.map(spell => <SpellRow key={spell.id} spell={spell} assigned={assignments[spell.id]} targetType={targetType} assignmentMode={assignmentMode} targetId={selectedTargetId} onAssign={handleAssign} onPrepare={handlePrepare} onEditHomebrew={openEditHomebrew} />)}
          {filteredSpells.length === 0 && <div className="empty-state">No spells match the current filters yet.</div>}
        </div>
      </div>
      {homebrewOpen && <HomebrewEditor form={homebrewForm} setForm={setHomebrewForm} onSave={saveHomebrew} onCancel={() => { setHomebrewOpen(false); setHomebrewForm(emptyHomebrewForm()); }} saving={savingHomebrew} />}
    </div>
  );
}
