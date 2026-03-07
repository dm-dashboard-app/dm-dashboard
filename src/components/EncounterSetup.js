import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function EncounterSetup({ onEncounterCreated }) {
  const [name, setName]                   = useState('Exploration');
  const [players, setPlayers]             = useState([]);
  const [monsters, setMonsters]           = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [monsterQueue, setMonsterQueue]   = useState([]);
  const [saving, setSaving]               = useState(false);
  const [joinCodes, setJoinCodes]         = useState({});

  useEffect(() => {
    supabase.from('profiles_players').select('*').then(({ data }) => {
      const profiles = data || [];
      setPlayers(profiles);
      setSelectedPlayers(profiles.map(p => p.id));
    });
    supabase.from('profiles_monsters').select('*').then(({ data }) => setMonsters(data || []));
  }, []);

  function togglePlayer(id) {
    setSelectedPlayers(s => s.includes(id) ? s.filter(p => p !== id) : [...s, id]);
  }

  function addMonsterToQueue(template) {
    setMonsterQueue(q => {
      const existing = q.find(m => m.template.id === template.id);
      if (existing) return q.map(m => m.template.id === template.id ? { ...m, qty: m.qty + 1 } : m);
      return [...q, { template, qty: 1 }];
    });
  }

  function removeMonsterFromQueue(id) {
    setMonsterQueue(q => q.filter(m => m.template.id !== id));
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data: enc } = await supabase
        .from('encounters')
        .insert({ name: name.trim() })
        .select()
        .single();

      const codes = {};

      for (const pid of selectedPlayers) {
        const profile = players.find(p => p.id === pid);
        if (!profile) continue;

        const { data: combatant } = await supabase
          .from('combatants')
          .insert({
            encounter_id:   enc.id,
            name:           profile.name,
            side:           'PC',
            owner_player_id: pid,
            ac:             profile.ac,
            hp_max:         profile.max_hp,
            hp_current:     profile.max_hp,
            initiative_mod: profile.initiative_mod ?? 0,
          })
          .select()
          .single();

        await supabase.from('player_encounter_state').insert({
          combatant_id:       combatant.id,
          encounter_id:       enc.id,
          player_profile_id:  pid,
          current_hp:         profile.max_hp,
        });

        const { data: code } = await supabase.rpc('generate_join_code', {
          p_encounter_id:        enc.id,
          p_player_profile_id:   pid,
        });
        codes[profile.name] = code;
      }

      const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const { template, qty } of monsterQueue) {
        for (let i = 0; i < qty; i++) {
          await supabase.from('combatants').insert({
            encounter_id:              enc.id,
            name:                      qty > 1 ? `${template.name} ${LABELS[i]}` : template.name,
            side:                      template.side || 'ENEMY',
            ac:                        template.ac,
            hp_max:                    template.hp_max,
            hp_current:                template.hp_max,
            initiative_mod:            template.initiative_mod ?? 0,
            notes:                     template.notes || null,
            mod_str:                   template.mod_str || 0,
            mod_dex:                   template.mod_dex || 0,
            mod_con:                   template.mod_con || 0,
            mod_int:                   template.mod_int || 0,
            mod_wis:                   template.mod_wis || 0,
            mod_cha:                   template.mod_cha || 0,
            resistances:               template.resistances || [],
            immunities:                template.immunities  || [],
            legendary_actions_max:     template.legendary_actions_max  || 0,
            legendary_resistances_max: template.legendary_resistances_max || 0,
            slots_max_1: template.slots_max_1 || 0,
            slots_max_2: template.slots_max_2 || 0,
            slots_max_3: template.slots_max_3 || 0,
            slots_max_4: template.slots_max_4 || 0,
            slots_max_5: template.slots_max_5 || 0,
            slots_max_6: template.slots_max_6 || 0,
            slots_max_7: template.slots_max_7 || 0,
            slots_max_8: template.slots_max_8 || 0,
            slots_max_9: template.slots_max_9 || 0,
          });
        }
      }

      setJoinCodes(codes);
      onEncounterCreated(enc);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">New Encounter</div>

      <div className="form-group">
        <label className="form-label">Encounter Name</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Goblin Ambush" />
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Players</label>
        {players.length === 0 && <div className="empty-state">No player profiles yet. Create them in Manage.</div>}
        {players.map(p => (
          <label key={p.id} className="checkbox-row">
            <input type="checkbox" checked={selectedPlayers.includes(p.id)} onChange={() => togglePlayer(p.id)} />
            <span>{p.name}</span>
          </label>
        ))}
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Monsters</label>
        {monsters.length === 0 && <div className="empty-state">No monster templates yet. Create them in Manage.</div>}
        <div className="monster-template-list">
          {monsters.map(m => (
            <div key={m.id} className="monster-template-row">
              <span>
                {m.name} (AC {m.ac}, HP {m.hp_max})
                {(m.legendary_actions_max > 0 || m.legendary_resistances_max > 0) && (
                  <span style={{ color: 'var(--accent-gold)', marginLeft: 6, fontSize: 12 }}>★</span>
                )}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => addMonsterToQueue(m)}>+</button>
            </div>
          ))}
        </div>
        {monsterQueue.length > 0 && (
          <div className="monster-queue">
            {monsterQueue.map(({ template, qty }) => (
              <div key={template.id} className="monster-queue-row">
                <span>{template.name} ×{qty}</span>
                <button className="btn btn-danger btn-icon" onClick={() => removeMonsterFromQueue(template.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="divider" />

      <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={saving || !name.trim()}>
        {saving ? 'Creating…' : 'Create Encounter'}
      </button>

      {Object.keys(joinCodes).length > 0 && (
        <div className="join-codes-panel">
          <div className="panel-title">Join Codes — Send to Players</div>
          {Object.entries(joinCodes).map(([playerName, code]) => (
            <div key={playerName} className="join-code-row">
              <span className="join-code-name">{playerName}</span>
              <span className="join-code-value">{code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}