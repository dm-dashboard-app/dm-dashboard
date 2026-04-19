import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadPortrait, uploadWorldMap, removeStoragePublicUrl } from '../supabaseClient';
import {
  ABILITY_KEYS,
  SKILL_DEFINITIONS,
  derivePlayerProfileDefaults,
  formatHitDiceSummary,
  formatModifier,
  formatStandardSpellSlotsSummary,
  getAbilityModifiers,
  getClassLevel,
  getDerivedInitiativeModifier,
  getDerivedSpellAttackBonus,
  getDerivedSpellSaveDC,
  getFinalArmorClass,
  getJackOfAllTradesBonus,
  getPrimaryClassName,
  getProficiencyBonus,
  getSaveProficiencies,
  getSavingThrowTotals,
  getSkillRank,
  getSkillTotals,
  getSpellcastingAbilityKey,
  getTotalLevel,
} from '../utils/classResources';
import SpellManagementPanel, { SpellImportPanel } from './SpellManagementPanel';
import PlayerProfileSpellManager from './PlayerProfileSpellManager';
import ItemImportPanel from './ItemImportPanel';

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


function resolveBuildMarker() {
  const read = (...keys) => {
    for (const key of keys) {
      const value = String(process.env[key] || '').trim();
      if (value) return value;
    }
    return '';
  };

  const prNumber = read('REACT_APP_PR_NUMBER', 'REACT_APP_PR', 'REACT_APP_VERCEL_GIT_PULL_REQUEST_ID');
  const prIteration = read('REACT_APP_PR_ITERATION', 'REACT_APP_ITERATION');
  const branch = read('REACT_APP_VERCEL_GIT_COMMIT_REF', 'REACT_APP_GIT_BRANCH');
  const shortSha = read('REACT_APP_VERCEL_GIT_COMMIT_SHA', 'REACT_APP_GIT_SHA').slice(0, 7);

  if (prNumber && prIteration) return `PR ${prNumber} (Iteration ${prIteration})`;
  if (prNumber) return shortSha ? `PR ${prNumber} • ${shortSha}` : `PR ${prNumber}`;
  if (branch === 'main') return shortSha ? `main • ${shortSha}` : 'main';
  if (branch) return shortSha ? `${branch} • ${shortSha}` : branch;
  if (shortSha) return `build ${shortSha}`;
  return 'build marker unavailable';
}

function intFromForm(value, fallback = 0) {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

async function insertCombatantWithFallback(payload, fallbackPayload) {
  const attempt = await supabase.from('combatants').insert(payload).select().single();
  if (!attempt.error) return attempt;
  console.warn('ManagementScreens combatant enriched insert failed, retrying with fallback payload.', attempt.error);
  return supabase.from('combatants').insert(fallbackPayload).select().single();
}

async function insertPlayerStateWithFallback(payload, fallbackPayload) {
  const attempt = await supabase.from('player_encounter_state').insert(payload);
  if (!attempt.error) return attempt;
  console.warn('ManagementScreens player state enriched insert failed, retrying with fallback payload.', attempt.error);
  return supabase.from('player_encounter_state').insert(fallbackPayload);
}

export default function ManagementScreens({ onEncounterCreated, currentEncounter = null, displayToken = null, joinCodes = [], onGenerateDisplayToken = null, onFrontScreen = null, onSignOut = null, displayCombatMode = 'out_of_combat', onSetDisplayCombatMode = null, inventoryRefreshTick = 0 }) {
  const [tab, setTab] = useState(currentEncounter ? 'session' : 'players');
  const buildMarker = resolveBuildMarker();
  useEffect(() => { if (!currentEncounter && tab === 'session') setTab('players'); }, [currentEncounter, tab]);

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div className="panel-title" style={{ marginBottom: 0 }}>Manage</div>
        {buildMarker ? <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>{buildMarker}</div> : null}
      </div>
      <div className="tab-bar manage-tab-bar" style={{ position: 'static' }}>
        {currentEncounter && <button className={`tab-btn ${tab === 'session' ? 'active' : ''}`} onClick={() => setTab('session')}>Session</button>}
        <button className={`tab-btn ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>Players</button>
        <button className={`tab-btn ${tab === 'monsters' ? 'active' : ''}`} onClick={() => setTab('monsters')}>Monsters & NPCs</button>
        <button className={`tab-btn ${tab === 'spells' ? 'active' : ''}`} onClick={() => setTab('spells')}>Spells</button>
        <button className={`tab-btn ${tab === 'wildshape' ? 'active' : ''}`} onClick={() => setTab('wildshape')}>Wild Shape</button>
        <button className={`tab-btn ${tab === 'imports' ? 'active' : ''}`} onClick={() => setTab('imports')}>Imports</button>
      </div>
      {tab === 'session' && currentEncounter && <SessionControls currentEncounter={currentEncounter} displayToken={displayToken} joinCodes={joinCodes} onGenerateDisplayToken={onGenerateDisplayToken} onFrontScreen={onFrontScreen} onSignOut={onSignOut} displayCombatMode={displayCombatMode} onSetDisplayCombatMode={onSetDisplayCombatMode} onToggleDisplayWorldMap={async enabled => { if (!currentEncounter) return; await supabase.from('encounters').update({ display_world_map: !!enabled }).eq('id', currentEncounter.id); }} />}
      {tab === 'players' && <PlayerProfileManager inventoryRefreshTick={inventoryRefreshTick} />}
      {tab === 'monsters' && <MonsterTemplateManager />}
      {tab === 'spells' && <SpellManagementPanel />}
      {tab === 'wildshape' && <WildShapeLibrary />}
      {tab === 'imports' && <ImportsManager />}
    </div>
  );
}

function SessionControls({ currentEncounter, displayToken, joinCodes, onGenerateDisplayToken, onFrontScreen, onSignOut, displayCombatMode = 'out_of_combat', onSetDisplayCombatMode = null, onToggleDisplayWorldMap = null }) {
  const [uploadingMap, setUploadingMap] = useState(false);
  const [mapError, setMapError] = useState('');
  const [players, setPlayers] = useState([]);
  const [addingPlayerId, setAddingPlayerId] = useState(null);
  const [playerAddError, setPlayerAddError] = useState('');

  useEffect(() => {
    if (!currentEncounter || displayToken || !onGenerateDisplayToken) return;
    onGenerateDisplayToken();
  }, [currentEncounter, displayToken, onGenerateDisplayToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlayers() {
      if (!currentEncounter?.id) {
        setPlayers([]);
        return;
      }
      const [{ data: profiles }, { data: combatants }] = await Promise.all([
        supabase.from('profiles_players').select('*').order('name'),
        supabase.from('combatants').select('owner_player_id').eq('encounter_id', currentEncounter.id).eq('side', 'PC'),
      ]);
      if (cancelled) return;
      const existingIds = new Set((combatants || []).map(row => row.owner_player_id).filter(Boolean));
      setPlayers((profiles || []).filter(profile => !existingIds.has(profile.id)));
    }
    loadPlayers();
    return () => { cancelled = true; };
  }, [currentEncounter?.id, joinCodes.length]);

  async function handleWorldMapUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !currentEncounter) return;
    setUploadingMap(true);
    setMapError('');
    try {
      const nextUrl = await uploadWorldMap(file, currentEncounter?.name || 'encounter');
      const prevUrl = currentEncounter.world_map_url || null;
      await supabase.from('encounters').update({ world_map_url: nextUrl }).eq('id', currentEncounter.id);
      if (prevUrl) await removeStoragePublicUrl(null, prevUrl);
    } catch (error) {
      setMapError(error?.message || 'World map upload failed.');
    } finally {
      setUploadingMap(false);
      event.target.value = '';
    }
  }

  async function addPlayerToSession(profile) {
    if (!profile || !currentEncounter?.id || addingPlayerId) return;
    setAddingPlayerId(profile.id);
    setPlayerAddError('');
    try {
      const baseCombatantPayload = {
        encounter_id: currentEncounter.id,
        name: profile.name,
        side: 'PC',
        owner_player_id: profile.id,
        ac: intFromForm(profile.ac, 10),
        hp_max: intFromForm(profile.max_hp, 1),
        hp_current: intFromForm(profile.max_hp, 1),
        initiative_mod: intFromForm(profile.initiative_mod, 0),
      };
      const enrichedCombatantPayload = compactObject({
        ...baseCombatantPayload,
        class_name: profile.class_name || null,
        subclass_name: profile.subclass_name || null,
        class_level: profile.class_level != null ? intFromForm(profile.class_level, 1) : null,
        class_name_2: profile.class_name_2 || null,
        subclass_name_2: profile.subclass_name_2 || null,
        class_level_2: profile.class_level_2 != null ? intFromForm(profile.class_level_2, 0) : null,
        ancestry_name: profile.ancestry_name || null,
      });
      const { data: combatant, error: combatantError } = await insertCombatantWithFallback(enrichedCombatantPayload, baseCombatantPayload);
      if (combatantError) throw combatantError;

      const baseStatePayload = {
        combatant_id: combatant.id,
        encounter_id: currentEncounter.id,
        player_profile_id: profile.id,
        current_hp: intFromForm(profile.max_hp, 1),
      };
      const { error: playerStateError } = await insertPlayerStateWithFallback(baseStatePayload, baseStatePayload);
      if (playerStateError) throw playerStateError;

      const { error: joinCodeError } = await supabase.rpc('generate_join_code', {
        p_encounter_id: currentEncounter.id,
        p_player_profile_id: profile.id,
      });
      if (joinCodeError) throw joinCodeError;
      setPlayers(current => current.filter(item => item.id !== profile.id));
    } catch (error) {
      setPlayerAddError(error?.message || 'Failed to add player to session.');
    } finally {
      setAddingPlayerId(null);
    }
  }

  async function removeWorldMap() {
    if (!currentEncounter?.world_map_url) return;
    const previous = currentEncounter.world_map_url;
    await supabase.from('encounters').update({ world_map_url: null, display_world_map: false }).eq('id', currentEncounter.id);
    await removeStoragePublicUrl(null, previous);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div className="manage-create-row">
        {onFrontScreen && <button className="btn btn-ghost" onClick={onFrontScreen}>Front Screen</button>}
        {onSignOut && <button className="btn btn-danger" onClick={onSignOut}>Sign Out</button>}
      </div>

      <div className="panel session-subpanel">
        <div className="display-screen-header-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Display Screen</div>
          <div className="display-screen-header-codes">
            <span className="display-screen-header-token">{displayToken || 'Generating…'}</span>
            {joinCodes.length === 0 ? <span className="display-screen-header-join">No join codes</span> : joinCodes.map((row, idx) => <span key={`${row.join_code}-${idx}`} className="display-screen-header-join">{row.profiles_players?.name || 'Player'}: {row.join_code}</span>)}
          </div>
        </div>

        {onToggleDisplayWorldMap ? (
          <button className="btn btn-ghost display-screen-bar-btn" onClick={() => onToggleDisplayWorldMap(!currentEncounter?.display_world_map)}>
            {currentEncounter?.display_world_map ? 'Disable World Map Mode' : 'Enable World Map Mode'}
          </button>
        ) : null}

        {onSetDisplayCombatMode ? (
          <div className="display-layout-btn-row">
            <button className="btn btn-ghost" style={{ borderColor: displayCombatMode === 'in_combat' ? 'var(--accent-red)' : 'var(--border)', color: displayCombatMode === 'in_combat' ? 'var(--accent-red)' : 'var(--text-primary)' }} onClick={() => onSetDisplayCombatMode('in_combat')}>In Combat</button>
            <button className="btn btn-ghost" style={{ borderColor: displayCombatMode === 'out_of_combat' ? 'var(--accent-blue)' : 'var(--border)', color: displayCombatMode === 'out_of_combat' ? 'var(--accent-blue)' : 'var(--text-primary)' }} onClick={() => onSetDisplayCombatMode('out_of_combat')}>Out of Combat</button>
          </div>
        ) : null}

        <label className="btn btn-ghost display-screen-bar-btn" style={{ cursor: uploadingMap ? 'default' : 'pointer' }}>
          {uploadingMap ? 'Uploading…' : 'Upload Map'}
          <input type="file" accept="image/*" onChange={handleWorldMapUpload} disabled={uploadingMap} style={{ display: 'none' }} />
        </label>

        <div className="world-map-image-state">
          {currentEncounter?.world_map_url
            ? <img src={currentEncounter.world_map_url} alt="World map preview" className="world-map-preview" />
            : <div className="world-map-empty">No world map uploaded yet.</div>}
        </div>

        {currentEncounter?.world_map_url ? <button className="btn btn-ghost" onClick={removeWorldMap}>Remove Map</button> : null}
        {mapError ? <div className="empty-state" style={{ color: 'var(--accent-red)', paddingTop: 0, paddingBottom: 0 }}>{mapError}</div> : null}
      </div>

      <div className="panel session-subpanel">
        <div className="panel-title">Add Player Mid-Session</div>
        {players.length === 0 ? (
          <div className="empty-state">All player profiles are already in this encounter.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map(profile => (
              <div key={profile.id} className="manage-row">
                <span>{profile.name}</span>
                <button className="btn btn-ghost" disabled={addingPlayerId === profile.id} onClick={() => addPlayerToSession(profile)}>
                  {addingPlayerId === profile.id ? 'Adding…' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}
        {playerAddError ? <div className="empty-state" style={{ color: 'var(--accent-red)', paddingTop: 8, paddingBottom: 0 }}>{playerAddError}</div> : null}
      </div>
    </div>
  );
}

function NumInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(value === 0 ? '' : String(value ?? ''));
  useEffect(() => { setDraft(value === 0 ? '' : String(value ?? '')); }, [value]);
  function normalize(nextDraft) { const n = parseInt(nextDraft, 10); const fallback = props.min != null ? parseInt(props.min, 10) : 0; const final = Number.isNaN(n) ? fallback : n; return { fallback, final }; }
  return <input {...props} className="form-input" type="number" value={draft} onChange={e => { const nextDraft = e.target.value; setDraft(nextDraft); const { final } = normalize(nextDraft); if (nextDraft !== '') onChange(final); }} onBlur={() => { const { fallback, final } = normalize(draft); setDraft(final === 0 && fallback === 0 ? '' : String(final)); onChange(final); }} />;
}
function SelectField({ value, onChange, options }) { return <select className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}>{options.map(opt => <option key={opt || 'blank'} value={opt}>{opt || '—'}</option>)}</select>; }
function DerivedValueField({ label, value, helpText = '' }) { return <div className="form-group" style={{ flex: 1 }}><label className="form-label">{label}</label><div className="form-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>{value || '—'}</div>{helpText ? <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{helpText}</div> : null}</div>; }
function Field({ label, children }) { return <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">{label}</label>{children}</div>; }

function SkillRankSelect({ name, value, onChange }) {
  return <select name={name} className="form-input" value={value} onChange={e => onChange(parseInt(e.target.value, 10) || 0)} style={{ minHeight: 36, paddingTop: 0, paddingBottom: 0 }}>{SKILL_RANK_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function PlayerProfileManager({ inventoryRefreshTick = 0 }) {
  const [profiles, setProfiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [inventoryRefreshTick]);

  async function load() {
    const { data } = await supabase.from('profiles_players').select('*').order('name');
    setProfiles(data || []);
  }

  async function save(profile) {
    const finalProfile = applyDerivedPlayerDefaults(profile);
    if (finalProfile.id) await supabase.from('profiles_players').update(finalProfile).eq('id', finalProfile.id);
    else await supabase.from('profiles_players').insert(finalProfile);
    setEditing(null);
    load();
  }

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
    setEditing(null);
    load();
  }

  if (editing !== null) {
    const isExisting = !!editing?.id;
    return <PlayerProfileForm initial={editing} onSave={save} onCancel={() => setEditing(null)} onDelete={isExisting ? () => remove(editing.id) : null} />;
  }

  return (
    <div>
      {deleteError && <div className="empty-state" style={{ color: 'var(--accent-red)', marginBottom: 10 }}>{deleteError}</div>}
      {profiles.map((profile) => (
        <div key={profile.id} className="manage-row manage-row--list-item">
          <div className="manage-row-main">
            <strong className="manage-row-title">{profile.name}</strong>
            <span className="manage-row-meta">{classSummary(profile) || 'Class not set'}</span>
          </div>
          <div className="manage-row-actions">
            <button className="btn btn-ghost" onClick={() => setEditing(profile)}>Edit</button>
          </div>
        </div>
      ))}
      {profiles.length === 0 ? <div className="empty-state">No players yet.</div> : null}
      <button className="btn btn-primary world-action-btn-full" style={{ marginTop: 12 }} onClick={() => setEditing({})}>+ New Player</button>
    </div>
  );
}


function normalizeManualBonusInitial(initial = {}) {
  return {
    ...initial,
    ac_bonus: initial?.ac_bonus ?? 0,
    spell_save_bonus: initial?.spell_save_bonus ?? 0,
    spell_attack_bonus_mod: initial?.spell_attack_bonus_mod ?? initial?.spell_attack_bonus ?? 0,
  };
}

function PlayerProfileForm({ initial, onSave, onCancel, onDelete = null }) {
  const formRef = useRef(null);
  const [f, setF] = useState({ name: '', max_hp: 10, ac: 10, ac_bonus: 0, initiative_mod: 0, initiative_bonus: 0, spell_save_bonus: 0, spell_attack_bonus_mod: 0, class_name: '', subclass_name: '', class_level: 1, class_name_2: '', subclass_name_2: '', class_level_2: 0, ancestry_name: '', feat_lucky: false, feat_relentless_endurance: false, feat_fey_step: false, feat_celestial_revelation: false, mage_armour_enabled: false, ability_str: 10, ability_dex: 10, ability_con: 10, ability_int: 10, ability_wis: 10, ability_cha: 10, save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0, spell_save_dc: 8, spell_attack_bonus: 0, slots_max_1: 0, slots_max_2: 0, slots_max_3: 0, slots_max_4: 0, slots_max_5: 0, slots_max_6: 0, slots_max_7: 0, slots_max_8: 0, slots_max_9: 0, wildshape_enabled: false, portrait_url: '', ...Object.fromEntries(SKILL_DEFINITIONS.map(skill => [`skill_${skill.key}_rank`, 0])), ...normalizeManualBonusInitial(initial) });
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
  const derivedInitiativeModifier = getDerivedInitiativeModifier(f);
  const derivedArmorClass = getFinalArmorClass({ ...f, ac_bonus: 0 }, {});
  const derivedSpellSaveDC = getDerivedSpellSaveDC(f);
  const derivedSpellAttackBonus = getDerivedSpellAttackBonus(f);
  const spellcastingAbilityKey = getSpellcastingAbilityKey(f);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  async function handlePortraitUpload(e) { const file = e.target.files?.[0]; if (!file) return; if (!f.name.trim()) { setUploadError('Enter the player name first.'); return; } setUploading(true); setUploadError(null); try { const url = await uploadPortrait(file, f.name); set('portrait_url', url); } catch (err) { setUploadError('Upload failed: ' + err.message); } finally { setUploading(false); } }
  function buildSavePayload() { const form = formRef.current; if (!form) return applyDerivedPlayerDefaults(f); const fd = new FormData(form); const next = { ...f, ability_str: intFromForm(fd.get('ability_str'), 10), ability_dex: intFromForm(fd.get('ability_dex'), 10), ability_con: intFromForm(fd.get('ability_con'), 10), ability_int: intFromForm(fd.get('ability_int'), 10), ability_wis: intFromForm(fd.get('ability_wis'), 10), ability_cha: intFromForm(fd.get('ability_cha'), 10), max_hp: intFromForm(fd.get('max_hp'), 1), ac: intFromForm(fd.get('ac'), 1), ac_bonus: intFromForm(fd.get('ac_bonus'), 0), class_level: intFromForm(fd.get('class_level'), 1), class_level_2: intFromForm(fd.get('class_level_2'), 0), initiative_bonus: intFromForm(fd.get('initiative_bonus'), 0), spell_save_bonus: intFromForm(fd.get('spell_save_bonus'), 0), spell_attack_bonus_mod: intFromForm(fd.get('spell_attack_bonus_mod'), 0) }; SKILL_DEFINITIONS.forEach(skill => { next[`skill_${skill.key}_rank`] = intFromForm(fd.get(`skill_${skill.key}_rank`), 0); }); return applyDerivedPlayerDefaults(next); }
  function handleSave() { if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); onSave(buildSavePayload()); }

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
      <div className="panel-title" style={{ marginTop: 12 }}>Derived Combat Maths</div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}><DerivedValueField label="Derived Initiative" value={formatModifier(derivedInitiativeModifier)} helpText="DEX modifier" /><div className="form-group" style={{ flex: 1 }}><label className="form-label">Initiative Bonus</label><NumInput name="initiative_bonus" value={f.initiative_bonus ?? 0} onChange={v => set('initiative_bonus', v)} /></div><DerivedValueField label="Final Initiative" value={formatModifier(derivedProfile.initiative_mod || 0)} helpText="Derived + bonus" /></div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <DerivedValueField label="Derived AC" value={String(derivedArmorClass || 0)} helpText="Base AC + DEX (respecting class toggles)" />
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Custom AC Modifier</label>
          <NumInput name="ac_bonus" value={f.ac_bonus ?? 0} onChange={v => set('ac_bonus', v)} />
        </div>
        <DerivedValueField label="Final AC" value={String(getFinalArmorClass(f, {}))} helpText="Derived + custom modifier" />
      </div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}><DerivedValueField label="Derived Spell Save DC" value={derivedSpellSaveDC > 0 ? String(derivedSpellSaveDC) : '—'} helpText={spellcastingAbilityKey ? `Uses ${ABILITY_LABELS[spellcastingAbilityKey]}` : 'No spellcasting class found'} /><div className="form-group" style={{ flex: 1 }}><label className="form-label">Spell Save Bonus</label><NumInput name="spell_save_bonus" value={f.spell_save_bonus ?? 0} onChange={v => set('spell_save_bonus', v)} /></div><DerivedValueField label="Final Spell Save DC" value={derivedProfile.spell_save_dc > 0 ? String(derivedProfile.spell_save_dc) : '—'} helpText="Derived + bonus" /></div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}><DerivedValueField label="Derived Spell Attack" value={derivedSpellAttackBonus > 0 ? formatModifier(derivedSpellAttackBonus) : '—'} helpText={spellcastingAbilityKey ? `Uses ${ABILITY_LABELS[spellcastingAbilityKey]}` : 'No spellcasting class found'} /><div className="form-group" style={{ flex: 1 }}><label className="form-label">Spell Attack Bonus</label><NumInput name="spell_attack_bonus_mod" value={f.spell_attack_bonus_mod ?? 0} onChange={v => set('spell_attack_bonus_mod', v)} /></div><DerivedValueField label="Final Spell Attack" value={derivedProfile.spell_attack_bonus ? formatModifier(derivedProfile.spell_attack_bonus) : '—'} helpText="Derived + bonus" /></div>
      <div className="panel-title" style={{ marginTop: 12 }}>Table Toggles</div>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_lucky} onChange={e => set('feat_lucky', e.target.checked)} /><span>Lucky</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_relentless_endurance} onChange={e => set('feat_relentless_endurance', e.target.checked)} /><span>Relentless Endurance</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_fey_step} onChange={e => set('feat_fey_step', e.target.checked)} /><span>Fey Step</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.feat_celestial_revelation} onChange={e => set('feat_celestial_revelation', e.target.checked)} /><span>Celestial Revelation</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={!!f.mage_armour_enabled} onChange={e => set('mage_armour_enabled', e.target.checked)} /><span>Mage Armour</span></label>
      {druidLevel > 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>Wild Shape is auto-enabled for Druids.</div>}
      <PlayerProfileSpellManager profile={derivedProfile} />
      <Field label="Portrait"><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{f.portrait_url && <img src={f.portrait_url} alt="Portrait" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 6 }} />}<input type="file" accept="image/*" onChange={handlePortraitUpload} disabled={uploading} style={{ fontSize: 13 }} />{uploading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</span>}{uploadError && <span style={{ fontSize: 12, color: 'var(--accent-red)' }}>{uploadError}</span>}</div></Field>
      <Field label="Base AC"><NumInput name="ac" value={f.ac} onChange={v => set('ac', v)} min={1} /></Field>
      <Field label="Max HP"><NumInput name="max_hp" value={f.max_hp} onChange={v => set('max_hp', v)} min={1} /></Field>
      <div className="form-row" style={{ marginTop: 16 }}><button type="submit" className="btn btn-primary" disabled={!f.name || uploading}>Save</button><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button></div>{onDelete ? <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}><button type="button" className="btn btn-danger" onClick={onDelete}>Delete Player</button></div> : null}
    </form>
  );
}

function MonsterTemplateManager() {
  const [monsters, setMonsters] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('profiles_monsters').select('*').order('name');
    setMonsters(data || []);
  }

  async function save(monster) {
    const payload = monster.id ? { ...monster } : { archived: false, ...monster };
    if (payload.id) await supabase.from('profiles_monsters').update(payload).eq('id', payload.id);
    else await supabase.from('profiles_monsters').insert(payload);
    setEditing(null);
    load();
  }

  async function setArchived(id, archived) {
    await supabase.from('profiles_monsters').update({ archived }).eq('id', id);
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this template?')) return;
    await supabase.from('profiles_monsters').delete().eq('id', id);
    setEditing(null);
    load();
  }

  if (editing !== null) {
    const isExisting = !!editing?.id;
    return <MonsterForm initial={editing} onSave={save} onCancel={() => setEditing(null)} onArchiveToggle={isExisting ? (archived) => setArchived(editing.id, archived) : null} onDelete={isExisting ? () => remove(editing.id) : null} />;
  }

  const active = monsters.filter((monster) => !monster.archived);
  const archived = monsters.filter((monster) => monster.archived);
  const filtered = filter === 'ARCHIVED'
    ? archived
    : filter === 'ALL'
      ? active
      : active.filter((monster) => monster.side === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {['ALL', 'ENEMY', 'NPC', 'ARCHIVED'].map((entry) => (
          <button
            key={entry}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '2px 10px', borderColor: filter === entry ? 'var(--accent-blue)' : 'var(--border)', color: filter === entry ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
            onClick={() => setFilter(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      {filtered.map((monster) => (
        <div key={monster.id} className="manage-row manage-row--list-item">
          <div className="manage-row-main">
            <div className="manage-row-title-wrap">
              <span className={`badge badge-${(monster.side || 'ENEMY').toLowerCase()}`}>{monster.side || 'ENEMY'}</span>
              <strong className="manage-row-title">{monster.name}</strong>
            </div>
            <span className="manage-row-meta">AC {monster.ac}, HP {monster.hp_max}</span>
          </div>
          <div className="manage-row-actions">
            <button className="btn btn-ghost" onClick={() => setEditing(monster)}>Edit</button>
          </div>
        </div>
      ))}

      {filtered.length === 0 && <div className="empty-state">{filter === 'ARCHIVED' ? 'No archived templates.' : 'No active templates in this filter.'}</div>}

      <div className="manage-create-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => setEditing({ side: 'ENEMY', archived: false })}>+ New Enemy</button>
        <button className="btn btn-ghost" onClick={() => setEditing({ side: 'NPC', archived: false })}>+ New NPC</button>
      </div>
    </div>
  );
}


function MonsterForm({ initial, onSave, onCancel, onArchiveToggle = null, onDelete = null }) { const [f, setF] = useState({ name: '', ac: 10, hp_max: 10, initiative_mod: 0, notes: '', side: 'ENEMY', class_name: '', subclass_name: '', class_level: 1, class_name_2: '', subclass_name_2: '', class_level_2: 0, mini_marker: '', mod_str: 0, mod_dex: 0, mod_con: 0, mod_int: 0, mod_wis: 0, mod_cha: 0, resistances: [], immunities: [], legendary_actions_max: 0, legendary_resistances_max: 0, slots_max_1: 0, slots_max_2: 0, slots_max_3: 0, slots_max_4: 0, slots_max_5: 0, slots_max_6: 0, slots_max_7: 0, slots_max_8: 0, slots_max_9: 0, ...initial }); const set = (k, v) => setF(p => ({ ...p, [k]: v })); const DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder']; function toggleDamageType(field, type) { const arr = f[field] || []; set(field, arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type]); } return <div className="profile-form"><Field label="Type"><div style={{ display: 'flex', gap: 8 }}>{['ENEMY','NPC'].map(s => <button key={s} className="btn btn-ghost" style={{ flex: 1, borderColor: f.side === s ? 'var(--accent-blue)' : 'var(--border)', color: f.side === s ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => set('side', s)}>{s}</button>)}</div></Field><Field label="Name"><input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} /></Field><div className="panel-title" style={{ marginTop: 12 }}>Class & Marker</div><Field label="Primary Class"><SelectField value={f.class_name} onChange={v => set('class_name', v)} options={CLASS_OPTIONS} /></Field><Field label="Primary Subclass"><input className="form-input" value={f.subclass_name || ''} onChange={e => set('subclass_name', e.target.value)} /></Field><Field label="Primary Level"><NumInput value={f.class_level ?? 1} onChange={v => set('class_level', v || 1)} /></Field><Field label="Secondary Class"><SelectField value={f.class_name_2} onChange={v => { set('class_name_2', v); if (!v) { set('subclass_name_2', ''); set('class_level_2', 0); } }} options={CLASS_OPTIONS} /></Field><Field label="Secondary Subclass"><input className="form-input" value={f.subclass_name_2 || ''} onChange={e => set('subclass_name_2', e.target.value)} /></Field><Field label="Secondary Level"><NumInput value={f.class_level_2 ?? 0} onChange={v => set('class_level_2', v)} /></Field><Field label="Mini Marker"><input className="form-input" value={f.mini_marker || ''} onChange={e => set('mini_marker', e.target.value.slice(0, 12))} placeholder="A, B, 1, red dot, etc." /></Field><Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field><Field label="HP Max"><NumInput value={f.hp_max} onChange={v => set('hp_max', v)} /></Field><Field label="Initiative Mod"><NumInput value={f.initiative_mod} onChange={v => set('initiative_mod', v)} /></Field><div className="panel-title" style={{ marginTop: 12 }}>Ability Modifiers</div><div className="saves-grid">{['str','dex','con','int','wis','cha'].map(s => <div key={s} className="form-group"><label className="form-label">{s.toUpperCase()}</label><NumInput value={f[`mod_${s}`] ?? 0} onChange={v => set(`mod_${s}`, v)} /></div>)}</div><div className="panel-title" style={{ marginTop: 12 }}>Legendary</div><div className="form-row"><div className="form-group" style={{ flex: 1 }}><label className="form-label">Legendary Actions</label><NumInput value={f.legendary_actions_max ?? 0} onChange={v => set('legendary_actions_max', v)} /></div><div className="form-group" style={{ flex: 1 }}><label className="form-label">Legendary Resistances</label><NumInput value={f.legendary_resistances_max ?? 0} onChange={v => set('legendary_resistances_max', v)} /></div></div><div className="panel-title" style={{ marginTop: 12 }}>Spell Slots (max per level)</div><div className="saves-grid">{[1,2,3,4,5,6,7,8,9].map(l => <div key={l} className="form-group"><label className="form-label">L{l}</label><NumInput value={f[`slots_max_${l}`] ?? 0} onChange={v => set(`slots_max_${l}`, v)} /></div>)}</div><div className="panel-title" style={{ marginTop: 12 }}>Resistances</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>{DAMAGE_TYPES.map(t => <button key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, cursor: 'pointer', border: `1px solid ${(f.resistances || []).includes(t) ? 'var(--accent-blue)' : 'var(--border)'}`, background: (f.resistances || []).includes(t) ? 'rgba(74,158,255,0.2)' : 'var(--bg-panel-3)', color: (f.resistances || []).includes(t) ? 'var(--accent-blue)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('resistances', t)}>{t}</button>)}</div><div className="panel-title">Immunities</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>{DAMAGE_TYPES.map(t => <button key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, cursor: 'pointer', border: `1px solid ${(f.immunities || []).includes(t) ? 'var(--accent-gold)' : 'var(--border)'}`, background: (f.immunities || []).includes(t) ? 'rgba(240,180,41,0.15)' : 'var(--bg-panel-3)', color: (f.immunities || []).includes(t) ? 'var(--accent-gold)' : 'var(--text-secondary)' }} onClick={() => toggleDamageType('immunities', t)}>{t}</button>)}</div><Field label="Notes (DM only)"><textarea className="form-input" value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field><div className="form-row" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name}>Save</button><button className="btn btn-ghost" onClick={onCancel}>Cancel</button></div>{onArchiveToggle || onDelete ? <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{onArchiveToggle ? <button className="btn btn-ghost" onClick={() => onArchiveToggle(!f.archived)}>{f.archived ? 'Restore Template' : 'Archive Template'}</button> : null}{onDelete ? <button className="btn btn-danger" onClick={onDelete}>Delete Template</button> : null}</div> : null}</div>; }
function WildShapeLibrary() { const [forms, setForms] = useState([]); const [editing, setEditing] = useState(null); useEffect(() => { load(); }, []);
  async function load() { const { data } = await supabase.from('profiles_wildshape').select('*').order('form_name'); setForms(data || []); } async function save(f) { if (f.id) await supabase.from('profiles_wildshape').update(f).eq('id', f.id); else await supabase.from('profiles_wildshape').insert(f); setEditing(null); load(); } async function remove(id) { if (!window.confirm('Delete this wild shape form?')) return; await supabase.from('profiles_wildshape').delete().eq('id', id); load(); } if (editing !== null) return <WildShapeForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />; return <div>{forms.map(f => <div key={f.id} className="manage-row"><span>{f.form_name} — AC {f.ac}, HP {f.hp_max}</span><div className="form-row"><button className="btn btn-ghost" onClick={() => setEditing(f)}>Edit</button><button className="btn btn-danger" onClick={() => remove(f.id)}>Delete</button></div></div>)}<button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing({})}>+ New Form</button></div>; }
function WildShapeForm({ initial, onSave, onCancel }) { const [f, setF] = useState({ form_name: '', ac: 10, hp_max: 10, save_str: 0, save_dex: 0, save_con: 0, save_int: 0, save_wis: 0, save_cha: 0, speed: '', notes: '', ...initial }); const set = (k, v) => setF(p => ({ ...p, [k]: v })); return <div className="profile-form"><Field label="Form Name"><input className="form-input" value={f.form_name} onChange={e => set('form_name', e.target.value)} /></Field><Field label="AC"><NumInput value={f.ac} onChange={v => set('ac', v)} /></Field><Field label="HP Max"><NumInput value={f.hp_max} onChange={v => set('hp_max', v)} /></Field><div className="panel-title" style={{ marginTop: 12 }}>Saving Throws</div><div className="saves-grid">{['str','dex','con','int','wis','cha'].map(s => <div key={s} className="form-group"><label className="form-label">{s.toUpperCase()}</label><NumInput value={f[`save_${s}`]} onChange={v => set(`save_${s}`, v)} /></div>)}</div><Field label="Speed (optional)"><input className="form-input" value={f.speed || ''} onChange={e => set('speed', e.target.value)} /></Field><Field label="Notes (optional)"><textarea className="form-input" value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field><div className="form-row" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.form_name}>Save</button><button className="btn btn-ghost" onClick={onCancel}>Cancel</button></div></div>; }


function ImportsManager() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <ItemImportPanel />
      <SpellImportPanel />
    </div>
  );
}
