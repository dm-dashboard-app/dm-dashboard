import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

function formatClassLine(entity) {
  const parts = [];
  if (entity.class_name) parts.push(entity.class_name);
  if (entity.subclass_name) parts.push(entity.subclass_name);
  if (entity.class_level) parts.push(`Lv ${entity.class_level}`);
  return parts.join(' • ');
}

async function insertCombatantWithFallback(payload, fallbackPayload) {
  const attempt = await supabase.from('combatants').insert(payload).select().single();
  if (!attempt.error) return attempt;

  console.warn('EncounterSetup combatant enriched insert failed, retrying with fallback payload.', attempt.error);

  return supabase.from('combatants').insert(fallbackPayload).select().single();
}

async function insertPlayerStateWithFallback(payload, fallbackPayload) {
  const attempt = await supabase.from('player_encounter_state').insert(payload);
  if (!attempt.error) return attempt;

  console.warn('EncounterSetup player state enriched insert failed, retrying with fallback payload.', attempt.error);

  return supabase.from('player_encounter_state').insert(fallbackPayload);
}

export default function EncounterSetup({ onEncounterCreated }) {
  const [name, setName] = useState('Exploration');
  const [players, setPlayers] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [monsterQueue, setMonsterQueue] = useState([]);
  const [saving, setSaving] = useState(false);
  const [joinCodes, setJoinCodes] = useState({});

  useEffect(() => {
    supabase.from('profiles_players').select('*').order('name').then(({ data }) => {
      const profiles = data || [];
      setPlayers(profiles);
      setSelectedPlayers(profiles.map(p => p.id));
    });

    supabase.from('profiles_monsters').select('*').order('name').then(({ data }) => {
      setMonsters(data || []);
    });
  }, []);

  function togglePlayer(id) {
    setSelectedPlayers(current =>
      current.includes(id) ? current.filter(playerId => playerId !== id) : [...current, id]
    );
  }

  function addMonsterToQueue(template) {
    setMonsterQueue(current => {
      const existing = current.find(item => item.template.id === template.id);
      if (existing) {
        return current.map(item =>
          item.template.id === template.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...current, { template, qty: 1 }];
    });
  }

  function removeMonsterFromQueue(id) {
    setMonsterQueue(current => current.filter(item => item.template.id !== id));
  }

  async function handleCreate() {
    if (!name.trim()) return;

    setSaving(true);

    try {
      const { data: enc, error: encounterError } = await supabase
        .from('encounters')
        .insert({ name: name.trim() })
        .select()
        .single();

      if (encounterError) throw encounterError;

      const codes = {};

      for (const playerId of selectedPlayers) {
        const profile = players.find(p => p.id === playerId);
        if (!profile) continue;

        const baseCombatantPayload = {
          encounter_id: enc.id,
          name: profile.name,
          side: 'PC',
          owner_player_id: playerId,
          ac: toInt(profile.ac, 10),
          hp_max: toInt(profile.max_hp, 1),
          hp_current: toInt(profile.max_hp, 1),
          initiative_mod: toInt(profile.initiative_mod, 0),
        };

        const enrichedCombatantPayload = compactObject({
          ...baseCombatantPayload,
          class_name: profile.class_name || null,
          subclass_name: profile.subclass_name || null,
          class_level: profile.class_level != null ? toInt(profile.class_level, 1) : null,
          ancestry_name: profile.ancestry_name || null,
        });

        const { data: combatant, error: combatantError } = await insertCombatantWithFallback(
          enrichedCombatantPayload,
          baseCombatantPayload
        );

        if (combatantError) throw combatantError;

        const basePlayerStatePayload = {
          combatant_id: combatant.id,
          encounter_id: enc.id,
          player_profile_id: playerId,
          current_hp: toInt(profile.max_hp, 1),
        };

        const enrichedPlayerStatePayload = compactObject({
          ...basePlayerStatePayload,
          temp_hp: 0,
          hit_die_size: profile.hit_die_size != null ? toInt(profile.hit_die_size, 0) : null,
          hit_dice_max: profile.hit_dice_max != null ? toInt(profile.hit_dice_max, 0) : null,
          hit_dice_current: profile.hit_dice_max != null ? toInt(profile.hit_dice_max, 0) : null,
        });

        const { error: playerStateError } = await insertPlayerStateWithFallback(
          enrichedPlayerStatePayload,
          basePlayerStatePayload
        );

        if (playerStateError) throw playerStateError;

        const { data: code, error: codeError } = await supabase.rpc('generate_join_code', {
          p_encounter_id: enc.id,
          p_player_profile_id: playerId,
        });

        if (codeError) throw codeError;

        codes[profile.name] = code;
      }

      const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      for (const { template, qty } of monsterQueue) {
        for (let i = 0; i < qty; i++) {
          const displayName = qty > 1 ? `${template.name} ${LABELS[i] || i + 1}` : template.name;

          const baseCombatantPayload = {
            encounter_id: enc.id,
            name: displayName,
            side: template.side || 'ENEMY',
            ac: toInt(template.ac, 10),
            hp_max: toInt(template.hp_max, 1),
            hp_current: toInt(template.hp_max, 1),
            initiative_mod: toInt(template.initiative_mod, 0),
            notes: template.notes || null,
            mod_str: toInt(template.mod_str, 0),
            mod_dex: toInt(template.mod_dex, 0),
            mod_con: toInt(template.mod_con, 0),
            mod_int: toInt(template.mod_int, 0),
            mod_wis: toInt(template.mod_wis, 0),
            mod_cha: toInt(template.mod_cha, 0),
            resistances: template.resistances || [],
            immunities: template.immunities || [],
            legendary_actions_max: toInt(template.legendary_actions_max, 0),
            legendary_resistances_max: toInt(template.legendary_resistances_max, 0),
            slots_max_1: toInt(template.slots_max_1, 0),
            slots_max_2: toInt(template.slots_max_2, 0),
            slots_max_3: toInt(template.slots_max_3, 0),
            slots_max_4: toInt(template.slots_max_4, 0),
            slots_max_5: toInt(template.slots_max_5, 0),
            slots_max_6: toInt(template.slots_max_6, 0),
            slots_max_7: toInt(template.slots_max_7, 0),
            slots_max_8: toInt(template.slots_max_8, 0),
            slots_max_9: toInt(template.slots_max_9, 0),
          };

          const enrichedCombatantPayload = compactObject({
            ...baseCombatantPayload,
            class_name: template.class_name || null,
            subclass_name: template.subclass_name || null,
            class_level: template.class_level != null ? toInt(template.class_level, 1) : null,
            mini_marker: template.mini_marker || null,
          });

          const { error: monsterInsertError } = await insertCombatantWithFallback(
            enrichedCombatantPayload,
            baseCombatantPayload
          );

          if (monsterInsertError) throw monsterInsertError;
        }
      }

      setJoinCodes(codes);
      onEncounterCreated(enc);
    } catch (err) {
      console.error(err);
      window.alert('Failed to create encounter. Check console for details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">New Encounter</div>

      <div className="form-group">
        <label className="form-label">Encounter Name</label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Goblin Ambush"
        />
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Players</label>
        {players.length === 0 && (
          <div className="empty-state">No player profiles yet. Create them in Manage.</div>
        )}

        {players.map(player => {
          const classLine = formatClassLine(player);

          return (
            <label key={player.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedPlayers.includes(player.id)}
                onChange={() => togglePlayer(player.id)}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{player.name}</span>
                {(classLine || player.ancestry_name) && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {[classLine, player.ancestry_name].filter(Boolean).join(' • ')}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Monsters</label>
        {monsters.length === 0 && (
          <div className="empty-state">No monster templates yet. Create them in Manage.</div>
        )}

        <div className="monster-template-list">
          {monsters.map(monster => {
            const classLine = formatClassLine(monster);

            return (
              <div key={monster.id} className="monster-template-row">
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>
                    {monster.mini_marker && (
                      <span style={{ marginRight: 6, color: 'var(--accent-blue)', fontWeight: 700 }}>
                        [{monster.mini_marker}]
                      </span>
                    )}
                    {monster.name} (AC {monster.ac}, HP {monster.hp_max})
                    {(monster.legendary_actions_max > 0 || monster.legendary_resistances_max > 0) && (
                      <span style={{ color: 'var(--accent-gold)', marginLeft: 6, fontSize: 12 }}>★</span>
                    )}
                  </span>
                  {classLine && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{classLine}</span>
                  )}
                </span>

                <button className="btn btn-ghost btn-icon" onClick={() => addMonsterToQueue(monster)}>
                  +
                </button>
              </div>
            );
          })}
        </div>

        {monsterQueue.length > 0 && (
          <div className="monster-queue">
            {monsterQueue.map(({ template, qty }) => {
              const classLine = formatClassLine(template);

              return (
                <div key={template.id} className="monster-queue-row">
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>
                      {template.mini_marker && (
                        <span style={{ marginRight: 6, color: 'var(--accent-blue)', fontWeight: 700 }}>
                          [{template.mini_marker}]
                        </span>
                      )}
                      {template.name} ×{qty}
                    </span>
                    {classLine && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{classLine}</span>
                    )}
                  </span>

                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => removeMonsterFromQueue(template.id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
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