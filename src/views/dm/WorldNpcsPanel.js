import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, removePortraitPath, resolvePortraitUrl, uploadNpcPortrait } from '../../supabaseClient';

function NpcEditor({ npc, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: npc?.name || '',
    race: npc?.race || '',
    portrait_path: npc?.portrait_path || '',
    portrait_url: npc?.portrait_url || '',
    body_text: npc?.body_text || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const previewUrl = useMemo(
    () => resolvePortraitUrl(form.portrait_path, form.portrait_url),
    [form.portrait_path, form.portrait_url],
  );

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      setUploading(true);
      const uploadedPath = await uploadNpcPortrait(file, form.name || npc?.name || 'npc');
      if (form.portrait_path && form.portrait_path !== uploadedPath) {
        await removePortraitPath(form.portrait_path);
      }
      setForm((prev) => ({ ...prev, portrait_path: uploadedPath, portrait_url: '' }));
    } catch (uploadError) {
      setError(uploadError?.message || 'Portrait upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleRemovePortrait() {
    setError('');
    try {
      if (form.portrait_path) await removePortraitPath(form.portrait_path);
      setForm((prev) => ({ ...prev, portrait_path: '', portrait_url: '' }));
    } catch (removeError) {
      setError(removeError?.message || 'Failed to remove portrait.');
    }
  }

  async function submit() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save NPC.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="world-sheet-backdrop" onClick={onCancel}>
      <div className="world-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="world-sheet-head">
          <strong>{npc?.id ? 'Edit NPC' : 'New NPC'}</strong>
          <button className="btn btn-ghost" onClick={onCancel}>Close</button>
        </div>
        <div className="world-form-grid">
          <input className="form-input" placeholder="Name" value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} />
          <input className="form-input" placeholder="Race / species" value={form.race} onChange={(event) => setForm((v) => ({ ...v, race: event.target.value }))} />

          <div className="world-card" style={{ padding: 10 }}>
            <div className="world-sheet-head" style={{ marginBottom: 8 }}>
              <strong>Portrait</strong>
              {uploading ? <span className="world-inline-meta">Uploading…</span> : null}
            </div>
            <div className="world-npc-upload-row">
              {previewUrl ? (
                <img className="world-npc-thumb world-npc-thumb-lg" src={previewUrl} alt="NPC portrait preview" />
              ) : (
                <div className="world-npc-thumb world-npc-thumb-lg world-npc-thumb-empty">No portrait</div>
              )}
              <div className="world-mobile-stack" style={{ flex: 1 }}>
                <label className="btn btn-ghost" style={{ width: 'fit-content' }}>
                  <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading || saving} />
                  {previewUrl ? 'Replace Portrait' : 'Upload Portrait'}
                </label>
                {previewUrl ? <button className="btn btn-ghost" onClick={handleRemovePortrait} disabled={uploading || saving}>Remove Portrait</button> : null}
                <span className="world-inline-meta">Use an in-app upload (mobile-friendly).</span>
              </div>
            </div>
          </div>

          <textarea className="form-input" rows={10} placeholder="NPC info and notes" value={form.body_text} onChange={(event) => setForm((v) => ({ ...v, body_text: event.target.value }))} />
          <button className="btn btn-primary" onClick={submit} disabled={!form.name.trim() || saving}>{saving ? 'Saving…' : 'Save NPC'}</button>
          {error ? <div className="world-shops-error">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function WorldNpcsPanel({ role = 'dm' }) {
  const canEdit = role === 'dm';
  const readRpc = canEdit ? 'dm_world_get_npcs' : 'player_world_get_npcs';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [npcs, setNpcs] = useState([]);
  const [selectedNpcId, setSelectedNpcId] = useState(null);
  const [editingNpc, setEditingNpc] = useState(null);
  const [loadedImageKeys, setLoadedImageKeys] = useState({});

  const loadNpcs = useCallback(async (preferredNpcId = null) => {
    const { data, error: loadError } = await supabase.rpc(readRpc);
    if (loadError) throw loadError;
    const rows = data || [];
    setNpcs(rows);
    if (preferredNpcId) {
      setSelectedNpcId(preferredNpcId);
    }
  }, [readRpc]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        await loadNpcs();
      } catch (loadError) {
        if (active) setError(loadError.message || 'Failed to load NPCs.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [loadNpcs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return npcs;
    return npcs.filter((npc) => `${npc.name || ''} ${npc.race || ''} ${npc.body_text || ''}`.toLowerCase().includes(needle));
  }, [npcs, query]);

  const selectedNpc = useMemo(() => npcs.find((npc) => npc.id === selectedNpcId) || null, [npcs, selectedNpcId]);

  async function saveNpc(form) {
    const { data, error: saveError } = await supabase.rpc('dm_world_upsert_npc', {
      p_npc_id: editingNpc?.id || null,
      p_name: form.name,
      p_race: form.race,
      p_portrait_url: form.portrait_url,
      p_portrait_path: form.portrait_path,
      p_body_text: form.body_text,
    });
    if (saveError) throw saveError;
    setEditingNpc(null);
    setStatus('NPC saved.');
    setError('');
    await loadNpcs(data);
  }

  if (loading) return <div className="empty-state">Loading NPC library…</div>;

  return (
    <div className="world-shops-shell">
      {status ? <div className="world-shops-import-status">{status}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}

      {!selectedNpc ? (
        <>
          <div className="world-mobile-stack">
            <input className="form-input" placeholder="Search NPCs" value={query} onChange={(event) => setQuery(event.target.value)} />
            {canEdit ? <button className="btn btn-primary" onClick={() => setEditingNpc({})}>New NPC</button> : null}
          </div>
          <div className="world-card-grid">
            {filtered.map((npc) => {
              const thumbUrl = resolvePortraitUrl(npc.portrait_path, npc.portrait_url);
              return (
                <button key={npc.id} type="button" className="world-card world-card-button world-npc-list-row" onClick={() => setSelectedNpcId(npc.id)}>
                  {thumbUrl ? (
                    <>
                      {!loadedImageKeys[npc.id] ? <div className="world-npc-list-portrait world-npc-thumb-empty">Loading…</div> : null}
                      <img
                        className="world-npc-list-portrait"
                        src={thumbUrl}
                        alt="NPC portrait"
                        loading="lazy"
                        decoding="async"
                        style={{ display: loadedImageKeys[npc.id] ? 'block' : 'none' }}
                        onLoad={() => setLoadedImageKeys((curr) => ({ ...curr, [npc.id]: true }))}
                      />
                    </>
                  ) : <div className="world-npc-list-portrait world-npc-thumb-empty">No portrait</div>}
                  <div className="world-npc-list-content">
                    <div className="world-card-head"><strong>{npc.name}</strong><span>{npc.race || 'Unknown race'}</span></div>
                    <div className="world-card-body">{(npc.body_text || 'No profile text saved.').slice(0, 160)}</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 ? <div className="empty-state">No NPCs match this search.</div> : null}
          </div>
        </>
      ) : (
        <div className="world-npc-page">
          <button className="btn btn-ghost" onClick={() => setSelectedNpcId(null)}>← Back to NPC list</button>
          <div className="world-npc-hero">
            {resolvePortraitUrl(selectedNpc.portrait_path, selectedNpc.portrait_url)
              ? <img className="world-npc-portrait" loading="lazy" decoding="async" src={resolvePortraitUrl(selectedNpc.portrait_path, selectedNpc.portrait_url)} alt={`${selectedNpc.name} portrait`} />
              : <div className="world-npc-portrait world-npc-portrait-empty">No Portrait</div>}
            <div className="world-card">
              <div className="world-card-head"><strong>{selectedNpc.name}</strong><span>{selectedNpc.race || 'Race not set'}</span></div>
              <div className="world-card-body world-npc-body-compact" style={{ whiteSpace: 'pre-wrap' }}>{selectedNpc.body_text || 'No NPC details saved yet.'}</div>
            </div>
          </div>
          {canEdit ? <button className="btn btn-primary world-fab" onClick={() => setEditingNpc(selectedNpc)}>Edit NPC</button> : null}
        </div>
      )}

      {canEdit && editingNpc ? <NpcEditor npc={editingNpc.id ? editingNpc : null} onSave={saveNpc} onCancel={() => setEditingNpc(null)} /> : null}
    </div>
  );
}
