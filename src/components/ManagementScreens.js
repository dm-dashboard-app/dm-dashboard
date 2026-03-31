import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadPortrait } from '../supabaseClient';
import {
  ABILITY_KEYS,
  SKILL_DEFINITIONS,
  derivePlayerProfileDefaults,
  formatHitDiceSummary,
  formatModifier,
  formatStandardSpellSlotsSummary,
  getAbilityModifiers,
  getClassLevel,
  getJackOfAllTradesBonus,
  getPrimaryClassName,
  getProficiencyBonus,
  getSaveProficiencies,
  getSavingThrowTotals,
  getSkillRank,
  getSkillTotals,
  getTotalLevel,
} from '../utils/classResources';
import SpellManagementPanel from './SpellManagementPanel';
import PlayerProfileSpellManager from './PlayerProfileSpellManager';

const CLASS_OPTIONS = ['', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const SKILL_RANK_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Proficient' },
  { value: 2, label: 'Expertise' },
];

function classSummary(entity = {}) {
  const parts = [];
  if (entity.class_name) parts.push([entity.class_name, entity.class_level ? entity.class_level : null, entity.subclass_name ? `— ${entity.subclass_name}` : null].filter(Boolean).join(' '));
  if (entity.class_name_2) parts.push([entity.class_name_2, entity.class_level_2 ? entity.class_level_2 : null, entity.subclass_name_2 ? `— ${entity.subclass_name_2}` : null].filter(Boolean).join(' '));
  return parts.join(' / ');
}

function applyDerivedPlayerDefaults(profile = {}) {
  return { ...profile, ...derivePlayerProfileDefaults(profile) };
}

function intFromForm(value, fallback = 0) {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export default function ManagementScreens({ onEncounterCreated, currentEncounter = null, displayToken = null, joinCodes = [], onToggleEditMode = null, onGenerateDisplayToken = null, onRevokeDisplayToken = null, onFrontScreen = null, onSignOut = null }) {
  const [tab, setTab] = useState(currentEncounter ? 'session' : 'players');
  useEffect(() => { if (!currentEncounter && tab === 'session') setTab('players'); }, [currentEncounter, tab]);

  return (
    <div className="panel">
      <div className="panel-title">Manage</div>
      <div className="tab-bar manage-tab-bar" style={{ position: 'static' }}>
        {currentEncounter && <button className={`tab-btn ${tab === 'session' ? 'active' : ''}`} onClick={() => setTab('session')}>Session</button>}
        <button className={`tab-btn ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>Players</button>
        <button className={`tab-btn ${tab === 'monsters' ? 'active' : ''}`} onClick={() => setTab('monsters')}>Monsters & NPCs</button>
        <button className={`tab-btn ${tab === 'spells' ? 'active' : ''}`} onClick={() => setTab('spells')}>Spells</button>
        <button className={`tab-btn ${tab === 'wildshape' ? 'active' : ''}`} onClick={() => setTab('wildshape')}>Wild Shape</button>
      </div>
      {tab === 'session' && currentEncounter && <SessionControls currentEncounter={currentEncounter} displayToken={displayToken} joinCodes={joinCodes} onToggleEditMode={onToggleEditMode} onGenerateDisplayToken={onGenerateDisplayToken} onRevokeDisplayToken={onRevokeDisplayToken} onFrontScreen={onFrontScreen} onSignOut={onSignOut} />}
      {tab === 'players' && <PlayerProfileManager />}
      {tab === 'monsters' && <MonsterTemplateManager />}
      {tab === 'spells' && <SpellManagementPanel />}
      {tab === 'wildshape' && <WildShapeLibrary />}
    </div>
  );
}

function SessionControls({ currentEncounter, displayToken, joinCodes, onToggleEditMode, onGenerateDisplayToken, onRevokeDisplayToken, onFrontScreen, onSignOut }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}><div className="panel session-subpanel"><div className="panel-title">Current Session</div><div className="session-meta-grid"><div className="session-meta-item"><span className="session-meta-label">Encounter</span><span className="session-meta-value">{currentEncounter?.name || 'Active session'}</span></div><div className="session-meta-item"><span className="session-meta-label">Round</span><span className="session-meta-value">{currentEncounter?.round ?? 1}</span></div><div className="session-meta-item"><span className="session-meta-label">Player Edit Mode</span><span className="session-meta-value">{currentEncounter?.player_edit_mode ? 'On' : 'Off'}</span></div></div><div className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>{onToggleEditMode && <button className="btn btn-ghost" onClick={onToggleEditMode}>{currentEncounter?.player_edit_mode ? 'Lock Player Editing' : 'Enable Player Editing'}</button>}{onFrontScreen && <button className="btn btn-ghost" onClick={onFrontScreen}>Front Screen</button>}{onSignOut && <button className="btn btn-danger" onClick={onSignOut}>Sign Out</button>}</div></div><div className="panel session-subpanel"><div className="panel-title">Display Screen</div>{displayToken ? <div className="display-token-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="display-token-value">{displayToken}</span>{onRevokeDisplayToken && <button className="btn btn-danger" onClick={onRevokeDisplayToken}>Revoke</button>}</div> : <div className="form-row" style={{ flexWrap: 'wrap' }}>{onGenerateDisplayToken && <button className="btn btn-ghost" onClick={onGenerateDisplayToken}>Generate Display Token</button>}</div>}</div><div className="panel session-subpanel"><div className="panel-title">Player Join Codes {joinCodes.length > 0 ? `(${joinCodes.length})` : ''}</div>{joinCodes.length === 0 ? <div className="empty-state">No join codes for this encounter.</div> : joinCodes.map((s, i) => <div key={i} className="join-code-row"><span className="join-code-name">{s.profiles_players?.name || 'Player'}</span><span className="join-code-value">{s.join_code}</span></div>)}</div></div>;
}

function NumInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(value === 0 ? '' : String(value ?? ''));
  useEffect(() => { setDraft(value === 0 ? '' : String(value ?? '')); }, [value]);

  function normalize(nextDraft) {
    const n = parseInt(nextDraft, 10);
    const fallback = props.min != null ? parseInt(props.min, 10) : 0;
    const final = Number.isNaN(n) ? fallback : n;
    return { fallback, final };
  }

  return (
    <input
      {...props}
      className="form-input"
      type="number"
      value={draft}
      onChange={e => {
        const nextDraft = e.target.value;
        setDraft(nextDraft);
        const { final } = normalize(nextDraft);
        if (nextDraft !== '') onChange(final);
      }}
      onBlur={() => {
        const { fallback, final } = normalize(draft);
        setDraft(final === 0 && fallback === 0 ? '' : String(final));
        onChange(final);
      }}
    />
  );
}
function SelectField({ value, onChange, options }) { return <select className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}>{options.map(opt => <option key={opt || 'blank'} value={opt}>{opt || '—'}</option>)}</select>; }
function DerivedValueField({ label, value, helpText = '' }) { return <div className="form-group" style={{ flex: 1 }}><label className="form-label">{label}</label><div className="form-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>{value || '—'}</div>{helpText ? <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{helpText}</div> : null}</div>; }
function Field({ label, children }) { return <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">{label}</label>{children}</div>; }

function SkillRankSelect({ name, value, onChange }) {
  return (
    <select name={name} className="form-input" value={value} onChange={e => onChange(parseInt(e.target.value, 10) || 0)} style={{ minHeight: 36, paddingTop: 0, paddingBottom: 0 }}>
      {SKILL_RANK_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function PlayerProfileManager() {
  const [profiles, setProfiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => { load(); }, []);
  async function load() { const { data } = await supabase.from('profiles_players').select('*').order('name'); setProfiles(data || []); }
  async function save(profile) { const finalProfile = applyDerivedPlayerDefaults(profile); if (finalProfile.id) await supabase.from('profiles_players').update(finalProfile).eq('id', finalProfile.id); else await supabase.from('profiles_players').insert(finalProfile); setEditing(null); load(); }
  async function remove(id) {
    if (!window.confirm('Delete this player profile? This will also remove that player from saved encounter state and join sessions.')) return;
    setDeleteError('');
    const { data: ownedCombatants, error: combatantLookupError } = await supabase.from('combatants').select('id').eq('owner_player_id', id);
    if (combatantLookupError) { setDeleteError(combatantLookupError.message || 'Failed to look up linked combatants.'); return; }
    const combatantIds = (ownedCombatants || []).map(row => row.id);
    if (combatantIds.length > 0) {
      const { error: playerStateDeleteError } = await supabase.from('player_encounter_state').delete().in('combatant_id', combatantIds);
      if (playerStateDeleteError) { setDeleteError(playerStateDeleteError.message || 'Failed to remove linked player encounter state.'); return; }
      const { error: combatantDeleteError } = await supabase.from('combatants').delete().in('id', combatantIds);
      if (combatantDeleteError) { setDeleteError(combatantDeleteError.message || 'Failed to remove linked combatants.'); return; }
    }
    const { error: directStateDeleteError } = await supabase.from('player_encounter_state').delete().eq('player_profile_id', id);
    if (directStateDeleteError) { setDeleteError(directStateDeleteError.message || 'Failed to remove linked player encounter state.'); return; }
    const { error: playerSessionDeleteError } = await supabase.from('player_sessions').delete().eq('player_profile_id', id);
    if (playerSessionDeleteError) { setDeleteError(playerSessionDeleteError.message || 'Failed to remove linked player sessions.'); return; }
    const { error: playerSpellsDeleteError } = await supabase.from('profile_player_spells').delete().eq('player_profile_id', id);
    if (playerSpellsDeleteError) { setDeleteError(playerSpellsDeleteError.message || 'Failed to remove linked player spells.'); return; }
    const { error: profileDeleteError } = await supabase.from('profiles_players').delete().eq('id', id);
    if (profileDeleteError) { setDeleteError(profileDeleteError.message || 'Failed to delete player profile.'); return; }
    load();
  }
  if (editing !== null) return <PlayerProfileForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />;
  return <div>{deleteError && <div className="empty-state" style={{ color: 'var(--accent-red)', marginBottom: 10 }}>{deleteError}</div>}{profiles.map(p => <div key={p.id} className="manage-row"><span><strong>{p.name}</strong>{classSummary(p) ? <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>{classSummary(p)}</span> : null}</span><div className="form-row"><button className="btn btn-ghost" onClick={() => setEditing(p)}>Edit</button><button className="btn btn-danger" onClick={() => remove(p.id)}>Delete</button></div></div>)}<button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing({})}>+ New Player</button></div>;
}

function PlayerProfileForm({ initial, onSave, onCancel }) {
  const formRef = useRef(null);
  const [f, setF] = useState({
    name: '', max_hp: 10, ac: 10, initiative_mod: 0,
    class_name: '', subclass_name: '', class_level: 1,
    class_name_2: '', subclass_name_2: '', class_level_2: 0,
    ancestry_name: '',
    feat_lucky: false, feat_relentless_endurance: false, feat_fey_step: false, feat_celestial_revelation: false,
    ability_str: 10, ability_dex: 10, ability_con: 10, ability_int: 10, ability_wis: 10, ability_cha: 10,
    save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0,
    spell_save_dc: 8, spell_attack_bonus: 0,
    slots_max_1: 0, slots_max_2: 0, slots_max_3: 0, slots_max_4: 0, slots_max_5: 0, slots_max_6: 0, slots_max_7: 0, slots_max_8: 0, slots_max_9: 0,
    wildshape_enabled: false, portrait_url: '',
    ...Object.fromEntries(SKILL_DEFINITIONS.map(skill => [`skill_${skill.key}_rank`, 0])),
    ...initial,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const derivedProfile = applyDerivedPlayerDefaults(f);
  const hitDiceSummary = formatHitDiceSummary(f);
  const spellSlotsSummary = formatStandardSpellSlotsSummary(f);
  const druidLevel = getClassLevel(f, 'druid');
  const totalLevel = getTotalLevel(f);
  const proficiencyBonus = getProficiencyBonus(totalLevel);
  const abilityModifiers = getAbilityModifiers(f);
  const saveTotals = getSavingThrowTotals(f);
  const saveProficiencies = getSaveProficiencies(f);
  const skillTotals = getSkillTotals(f);
  const primaryClassName = getPrimaryClassName(f);
  const jackOfAllTradesBonus = getJackOfAllTradesBonus(f);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function handlePortraitUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!f.name.trim()) { setUploadError('Enter the player name first.'); return; }
    setUploading(true); setUploadError(null);
    try { const url = await uploadPortrait(file, f.name); set('portrait_url', url); }
    catch (err) { setUploadError('Upload failed: ' + err.message); }
    finally { setUploading(false); }
  }

  function buildSavePayload() {
    const form = formRef.current;
    if (!form) return applyDerivedPlayerDefaults(f);
    const fd = new FormData(form);
    const next = {
      ...f,
      ability_str: intFromForm(fd.get('ability_str'), 10),
      ability_dex: intFromForm(fd.get('ability_dex'), 10),
      ability_con: intFromForm(fd.get('ability_con'), 10),
      ability_int: intFromForm(fd.get('ability_int'), 10),
      ability_wis: intFromForm(fd.get('ability_wis'), 10),
      ability_cha: intFromForm(fd.get('ability_cha'), 10),
      max_hp: intFromForm(fd.get('max_hp'), 1),
      ac: intFromForm(fd.get('ac'), 1),
      initiative_mod: intFromForm(fd.get('initiative_mod'), 0),
      spell_save_dc: intFromForm(fd.get('spell_save_dc'), 0),
      spell_attack_bonus: intFromForm(fd.get('spell_attack_bonus'), 0),
      class_level: intFromForm(fd.get('class_level'), 1),
      class_level_2: intFromForm(fd.get('class_level_2'), 0),
    };
    SKILL_DEFINITIONS.forEach(skill => {
      next[`skill_${skill.key}_rank`] = intFromForm(fd.get(`skill_${skill.key}_rank`), 0);
    });
    return applyDerivedPlayerDefaults(next);
  }

  function handleSave() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    onSave(buildSavePayload());
  }

  return (
    <form ref={formRef} className="profile-form" onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Field label="Name"><input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
      <div className="panel-title" style={{ marginTop: 12 }}>Class & Identity</div>
      <Field label="Primary Class"><SelectField value={f.class_name} onChange={v => set('class_name', v)} options={CLASS_OPTIONS} /></Field>
      <Field label="Primary Subclass"><input className="form-input" value={f.subclass_name || ''} onChange={e => set('subclass_name', e.target.value)} /></Field>
      <Field label="Primary Level"><NumInput name="class_level" value={f.class_level ?? 1} onChange={v => set('class_level', v || 1)} min={1} /></Field>
      <Field label="Secondary Class"><SelectField value={f.class_name_2} onChange={v => { set('class_name_2', v); if (!v) { set('subclass_name_2', ''); set('class_level_2', 0); } }} options={CLASS_OPTIONS} /></Field>
      <Field label="Secondary Subclass"><input className="form-input" value={f.subclass_name_2 || ''} onChange={e => set('subclass_name_2', e.target.value)} /></Field>
      <Field label="Secondary Level"><NumInput name="class_level_2" value={f.class_level_2 ?? 0} onChange={v => set('class_level_2', v)} min={0} /></Field>
      <Field label="Ancestry / Heritage"><input className="form-input" value={f.ancestry_name || ''} onChange={e => set('ancestry_name', e.target.value)} /></Field>
      <div className="form-row" style={{ flexWrap: 'wrap' }}><DerivedValueField label="Hit Dice" value={hitDiceSummary || '—'} helpText="Derived automatically from class selection and multiclass levels." /><DerivedValueField label="Spell Slots" value={spellSlotsSummary || 'No standard slots'} helpText="Derived automatically from multiclass caster level. Warlock pact slots remain separate in encounter state." /></div>
      <div className="panel-title" style={{ marginTop: 12 }}>Core Stats</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>{ABILITY_KEYS.map(key => <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-panel-2)', display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{ABILITY_LABELS[key]}</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)' }}>{formatModifier(abilityModifiers[key])}</span></div><NumInput name={`ability_${key}`} value={f[`ability_${key}`]} onChange={v => set(`ability_${key}`, v)} min={1} max={30} /></div>)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ability scores are entered as raw values from 1 to 30. Modifiers are derived automatically, including low and high ends.</div>
      <div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>{ABILITY_KEYS.map(key => <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-panel-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{ABILITY_LABELS[key]}</span><span style={{ fontSize: 10, color: saveProficiencies[key] ? 'var(--accent-green)' : 'var(--text-muted)' }}>{saveProficiencies[key] ? 'Proficient' : 'Not proficient'}</span></div><span style={{ fontSize: 16, fontWeight: 700 }}>{formatModifier(saveTotals[key])}</span></div>)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Save proficiency is linked to the primary class only{primaryClassName ? ` (${primaryClassName}).` : '.'}</div>
      <div className="panel-title" style={{ marginTop: 12 }}>Skills</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Choose None, Proficient, or Expertise for each skill. Totals are derived from the linked ability modifier plus proficiency bonus ({formatModifier(proficiencyBonus)}).{jackOfAllTradesBonus > 0 ? ` Jack of All Trades is active, so unproficient Bard skills also gain ${formatModifier(jackOfAllTradesBonus)}.` : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{SKILL_DEFINITIONS.map(skill => <div key={skill.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-panel-2)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 56px', gap: 8, alignItems: 'center' }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{skill.label}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ABILITY_LABELS[skill.ability]} • base {formatModifier(abilityModifiers[skill.ability])}</div></div><SkillRankSelect name={`skill_${skill.key}_rank`} value={getSkillRank(f, skill.key)} onChange={value => set(`skill_${skill.key}_rank`, value)} /><div style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>{formatModifier(skillTotals[skill.key])}</div></div>)}</div>
      <div className="panel-title" style={{ marginTop: 12 }}>Table Toggles</div>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_lucky} onChange={e => set('feat_lucky', e.target.checked)} /><span>Lucky</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_relentless_endurance} onChange={e => set('feat_relentless_endurance', e.target.checked)} /><span>Relentless Endurance</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_fey_step} onChange={e => set('feat_fey_step', e.target.checked)} /><span>Fey Step</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_celestial_revelation} onChange={e => set('feat_celestial_revelation', e.target.checked)} /><span>Celestial Revelation</span></label>
      {druidLevel > 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>Wild Shape is auto-enabled for Druids.</div>}
      <PlayerProfileSpellManager profile={derivedProfile} />
      <Field label="Portrait"><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{f.portrait_url && <img src={f.portrait_url} alt="Portrait" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6 }} />}<input type="file" accept="image/*" onChange={handlePortraitUpload} disabled={uploading} style={{ fontSize: 13 }} />{uploading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</span>}{uploadError && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>{uploadError}</span>}</div></Field>
      <Field label="Max HP"><NumInput name="max_hp" value={f.max_hp} onChange={v => set('max_hp', v)} min={1} /></Field>
      <Field label="AC"><NumInput name="ac" value={f.ac} onChange={v => set('ac', v)} min={1} /></Field>
      <Field label="Initiative Mod (tiebreaker only)"><NumInput name="initiative_mod" value={f.initiative_mod ?? 0} onChange={v => set('initiative_mod', v)} /></Field>
      <Field label="Spell Save DC"><NumInput name="spell_save_dc" value={f.spell_save_dc} onChange={v => set('spell_save_dc', v)} min={0} /></Field>
      <Field label="Spell Attack Bonus"><NumInput name="spell_attack_bonus" value={f.spell_attack_bonus} onChange={v => set('spell_attack_bonus', v)} /></Field>
      <div className="form-row" style={{ marginTop: 16 }}><button type="submit" className="btn btn-primary" disabled={!f.name || uploading}>Save</button><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function MonsterTemplateManager() { const [monsters, setMonsters] = useState([]); const [editing, setEditing] = useState(null); const [filter, setFilter] = useState('ALL'); useEffect(() => { load(); }, []); async function load() { const { data } = await supabase.from('profiles_monsters').select('*').order('name'); setMonsters(data || []); } async function save(m) { if (m.id) await supabase.from('profiles_monsters').update(m).eq('id', m.id); else await supabase.from('profiles_monsters').insert(m); setEditing(null); load(); } async function remove(id) { if (!window.confirm('Delete this template?')) return; await supabase.from('profiles_monsters').delete().eq('id', id); load(); } if (editing !== null) return <MonsterForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />; const filtered = filter === 'ALL' ? monsters : monsters.filter(m => m.side === filter); return <div><div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 8 }}>{['ALL','ENEMY','NPC'].map(f => <button key={f} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 10px', borderColor: filter === f ? 'var(--accent-blue)' : 'var(--border)', color: filter === f ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => setFilter(f)}>{f}</button>)}</div>{filtered.map(m => <div key={m.id} className="manage-row"><span><span className={`badge badge-${(m.side || 'ENEMY').toLowerCase()}`} style={{ marginRight: 6 }}>{m.side || 'ENEMY'}</span>{m.name}{m.mini_marker ? <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--accent-gold)' }}>• {m.mini_marker}</span> : null}<span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>AC {m.ac}, HP {m.hp_max}</span>{classSummary(m) ? <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 12 }}>{classSummary(m)}</span> : null}{(m.legendary_actions_max > 0 || m.legendary_resistances_max > 0) && <span style={{ fontSize: 10, color: 'var(--accent-gold)', marginLeft: 6 }}>★</span>}</span><div className="form-row"><button className="btn btn-ghost" onClick={() => setEditing(m)}>Edit</button><button className="btn btn-danger" onClick={() => remove(m.id)}>Delete</button></div></div>)}<div className="form-row" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => setEditing({ side: 'ENEMY' })}>+ New Enemy</button><button className="btn btn-ghost" onClick={() => setEditing({ side: 'NPC' })}>+ New NPC</button></div></div>; }
function MonsterForm({ initial, onSave, onCancel }) { const [f, setF] = useState({ name: '', ac: 10, hp_max: 10, initiative_mod: 0, notes: '', side: 'ENEMY', class_name: '', subclass_name: '', class_level: 1, class_name_2: '', subclass_name_2: '', class_level_2: 0, mini_marker: '', mod_str: 0, mod_dex: 0, mod_con: 0, mod_int: 0, mod_wis: 0, mod_cha: 0, resistances: [], immunities: [], legendary_actions_max: 0, legendary_resistances_max: 0, slots_max_1: 0, slots_max_2: 0, slots_max_3: 0, slots_max_4: 0, slots_max_5: 0, slots_max_6: 0, slots_max_7: 0, slots_max_8: 0, slots_max_9: 0, ...initial }); const set = (k, v) => setF(p => ({ ...p, [k]: v })); const DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder']; function toggleDamageType(field, type) { const arr = f[field] || []; set(field, arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type]); } return <div className="profile-form"><Field label="Type"><div style={{ display: 'flex', gap: 8 }}>{['ENEMY','NPC'].map(s => <button key={s} className="btn btn-ghost" style={{ flex: 1, borderColor: f.side === s ? 'var(--accent-blue)' : 'var(--border)', color: f.side === s ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => set('side', s)}>{s}</button>)}</div></Field><Field label="Name"><input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} /></Field><div className="panel-title" style={{ marginTop: 12 }}>Class & Marker</div><Field label="Primary Class"><SelectField value={f.class_name} onChange={v => set('class_name', v)} options={CLASS_OPTIONS} /></Field><Field label="Primary Subclass"><input className="form-input" value={f.subclass_name || ''} onChange={e => set('subclass_name', e.target.value)} /></Field><Field label="Primary Level"><NumInput value={f.class_level ?? 1} onChange={v => set('class_level', v || 1)} /></Field><Field label="Secondary Class"><SelectField value={f.class_name_2} onChange={v => { set('class_name_2', v); if (!v) { set('subclass_name_2', ''); set('class_level_2', 0); } }} options={CLASS_OPTIONS} /></Field><Field label="Secondary Subclass"><input className="form-input" value={f.subclass_name_2 || ''} onChange={e => set('subclass_name_2', e.target.value)} /></Field><Field label="Secondary Level"><NumInput value={f.class_level_2 ?? 0} onChange={v => set('class_level_2', v)} /></Field><Field label="Mini Marker"><input className="form-input" value={f.mini_marker || ''} onChange={e => set('mini_marker', e.target.value.slice(0, 12))} placeholder="A, B, 1, red dot, etc." /></Field><Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field><Field label="HP Max"><NumInput value={f.hp_max} onChange={v => set('hp_max', v)} /></Field><Field label="Initiative Mod"><NumInput value={f.initiative_mod} onChange={v => set('initiative_mod', v)} /></Field><div className="panel-title" style={{ marginTop: 12 }}>Ability Modifiers</div><div className="saves-grid">{['str','dex','con','int','wis','cha'].map(s => <div key={s} className="form-group"><label className="form-label">{s.toUpperCase()}</label><NumInput value={f[`mod_${s}`] ?? 0} onChange={v => set(`mod_${s}`, v)} /></div>)}</div><div className="panel-title" style={{ marginTop: 12 }}>Legendary</div><div className="form-row"><div className="form-group" style={{ flex: 1 }}><label className="form-label">Legendary Actions</label><NumInput value={f.legendary_actions_max ?? 0} onChange={v => set('legendary_actions_max', v)} /></div><div className="form-group" style={{ flex: 1 }}><label className="form-label">Legendary Resistances</label><NumInput value={f.legendary_resistances_max ?? 0} onChange={v => set('legendary_resistances_max', v)} /></div></div><div className="panel-title" style={{ marginTop: 12 }}>Spell Slots (max per level)</div><div className="saves-grid">{[1,2,3,4,5,6,7,8,9].map(l => <div key={l} className="form-group"><label className="form-label">L{l}</label><NumInput value={f[`slots_max_${l}`] ?? 0} onChange={v => set(`slots_max_${l}`, v)} /></div>)}</div><div className="panel-title" style={{ marginTop: 12 }}>Resistances</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>{DAMAGE_TYPES.map(t => <button key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, cursor: 'pointer', border: `1px solid ${(f.resistances || []).includes(t) ? 'var(--accent-blue)' : 'var(--border)'}`, background: (f.resistances || []).includes(t) ? 'rgba(74,158,255,0.2)' : 'var(--bg-panel-3)', color: (f.resistances || []).includes(t) ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('resistances', t)}>{t}</button>)}</div><div className="panel-title">Immunities</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>{DAMAGE_TYPES.map(t => <button key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, cursor: 'pointer', border: `1px solid ${(f.immunities || []).includes(t) ? 'var(--accent-gold)' : 'var(--border)'}`, background: (f.immunities || []).includes(t) ? 'rgba(240,180,41,0.15)' : 'var(--bg-panel-3)', color: (f.immunities || []).includes(t) ? 'var(--accent-gold)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('immunities', t)}>{t}</button>)}</div><Field label="Notes (DM only)"><textarea className="form-input" value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field><div className="form-row" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name}>Save</button><button className="btn btn-ghost" onClick={onCancel}>Cancel</button></div></div>; }
function WildShapeLibrary() { const [forms, setForms] = useState([]); const [editing, setEditing] = useState(null); useEffect(() => { load(); }, []); async function load() { const { data } = await supabase.from('profiles_wildshape').select('*').order('form_name'); setForms(data || []); } async function save(f) { if (f.id) await supabase.from('profiles_wildshape').update(f).eq('id', f.id); else await supabase.from('profiles_wildshape').insert(f); setEditing(null); load(); } async function remove(id) { if (!window.confirm('Delete this wild shape form?')) return; await supabase.from('profiles_wildshape').delete().eq('id', id); load(); } if (editing !== null) return <WildShapeForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />; return <div>{forms.map(f => <div key={f.id} className="manage-row"><span>{f.form_name} — AC {f.ac}, HP {f.hp_max}</span><div className="form-row"><button className="btn btn-ghost" onClick={() => setEditing(f)}>Edit</button><button className="btn btn-danger" onClick={() => remove(f.id)}>Delete</button></div></div>)}<button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing({})}>+ New Form</button></div>; }
function WildShapeForm({ initial, onSave, onCancel }) { const [f, setF] = useState({ form_name: '', ac: 10, hp_max: 10, save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0, speed: '', notes: '', ...initial }); const set = (k, v) => setF(p => ({ ...p, [k]: v })); return <div className="profile-form"><Field label="Form Name"><input className="form-input" value={f.form_name} onChange={e => set('form_name', e.target.value)} /></Field><Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field><Field label="HP Max"><NumInput value={f.hp_max} onChange={v => set('hp_max', v)} /></Field><div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div><div className="saves-grid">{['str','dex','con','int','wis','cha'].map(s => <div key={s} className="form-group"><label className="form-label">{s.toUpperCase()}</label><NumInput value={f[`save_${s}`]} onChange={v => set(`save_${s}`, v)} /></div>)}</div><Field label="Speed (optional)"><input className="form-input" value={f.speed || ''} onChange={e => set('speed', e.target.value)} /></Field><Field label="Notes (optional)"><textarea className="form-input" value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field><div className="form-row" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.form_name}>Save</button><button className="btn btn-ghost" onClick={onCancel}>Cancel</button></div></div>; }
