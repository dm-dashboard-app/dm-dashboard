import {
  buildShortRestPatch,
  computeHealingTotal,
  deriveShortRestProcedureSnapshot,
  deriveShortRestProcedureState,
  getSharedSongOfRestTotal,
  validateShortRestResponse,
} from './shortRestWorkflow';

describe('shortRestWorkflow', () => {
  test('validates hit-dice total against spend breakdown', () => {
    const state = { hit_dice_d8_current: 3, hit_dice_d8_max: 3, hit_dice_d10_current: 2, hit_dice_d10_max: 2 };
    const profile = { ability_con: 14 };
    const invalid = validateShortRestResponse({
      input: { rolledTotal: 6, totalHitDiceUsed: 2, spendBySize: { d8: 1, d10: 0 } },
      state,
      profile,
    });
    expect(invalid.valid).toBe(false);

    const valid = validateShortRestResponse({
      input: { rolledTotal: 6, totalHitDiceUsed: 2, spendBySize: { d8: 1, d10: 1 } },
      state,
      profile,
    });
    expect(valid.valid).toBe(true);
  });

  test('computes healing with con modifier and shared song of rest', () => {
    const response = { sections: { healing: { rolledTotal: 7, totalHitDiceUsed: 2 } } };
    const profile = { ability_con: 14 };
    expect(computeHealingTotal(response, profile, 4)).toBe(15);
  });

  test('auto-infers spend breakdown for single hit-die pool', () => {
    const state = { hit_dice_d10_current: 4, hit_dice_d10_max: 4 };
    const valid = validateShortRestResponse({
      input: { rolledTotal: 8, totalHitDiceUsed: 2 },
      state,
      profile: { ability_con: 16 },
    });
    expect(valid.valid).toBe(true);
    expect(valid.response.sections.healing.spendBySize).toEqual({ d10: 2 });
  });

  test('single-pool validation still enforces available dice cap', () => {
    const state = { hit_dice_d10_current: 1, hit_dice_d10_max: 2 };
    const invalid = validateShortRestResponse({
      input: { rolledTotal: 5, totalHitDiceUsed: 2 },
      state,
      profile: { ability_con: 12 },
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain('Cannot spend more than 1d10.');
  });

  test('shared Song of Rest total is derived from owner response and used in patch-healing flow', () => {
    const playerStates = [
      { id: 'state-bard', profiles_players: { class_name: 'Bard', class_level: 5 } },
      { id: 'state-fighter', profiles_players: { class_name: 'Fighter', class_level: 5 } },
    ];
    const responsesByStateId = {
      'state-bard': {
        response: {
          sections: {
            healing: {
              rolledTotal: 8,
              totalHitDiceUsed: 2,
              spendBySize: { d10: 2 },
              songOfRestTotal: 4,
            },
          },
        },
      },
      'state-fighter': {
        response: {
          sections: {
            healing: {
              rolledTotal: 8,
              totalHitDiceUsed: 2,
              spendBySize: { d10: 2 },
            },
          },
        },
      },
    };
    const sharedSong = getSharedSongOfRestTotal({ playerStates, responsesByStateId });
    expect(sharedSong).toBe(4);

    const profile = { ability_con: 16, max_hp: 30 };
    const response = responsesByStateId['state-fighter'].response;
    const healingTotal = computeHealingTotal(response, profile, sharedSong);
    expect(healingTotal).toBe(18);

    const patch = buildShortRestPatch({
      state: { current_hp: 5, hit_dice_d10_current: 4, hit_dice_d10_max: 4 },
      profile,
      healingTotal,
      spendBySize: { d10: 2 },
    });
    expect(patch.current_hp).toBe(23);
  });


  test('clears previous responses when a new short rest starts', () => {
    const logs = [
      { created_at: '2026-04-16T10:00:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'start' }) },
      { created_at: '2026-04-16T10:01:00Z', action: 'short_rest_response', detail: JSON.stringify({ player_state_id: 'state-old', response: { ready: true } }) },
      { created_at: '2026-04-16T10:10:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'start' }) },
      { created_at: '2026-04-16T10:11:00Z', action: 'short_rest_response', detail: JSON.stringify({ player_state_id: 'state-new', response: { ready: true } }) },
    ];
    const state = deriveShortRestProcedureState(logs);
    expect(state.responsesByStateId['state-old']).toBeUndefined();
    expect(state.responsesByStateId['state-new']).toBeTruthy();
  });

  test('derives active procedure and responses from logs', () => {
    const logs = [
      { created_at: '2026-04-16T10:00:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'start' }) },
      { created_at: '2026-04-16T10:01:00Z', action: 'short_rest_response', detail: JSON.stringify({ player_state_id: 'state-1', response: { ready: true } }) },
    ];
    const state = deriveShortRestProcedureState(logs);
    expect(state.active).toBe(true);
    expect(state.responsesByStateId['state-1']).toBeTruthy();
  });

  test('detects active cycle from latest procedure event and filters responses to that cycle', () => {
    const state = deriveShortRestProcedureSnapshot({
      procedureRows: [
        { created_at: '2026-04-16T09:00:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'start' }) },
        { created_at: '2026-04-16T09:05:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'cancel' }) },
        { created_at: '2026-04-16T10:00:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'start' }) },
      ],
      responseRows: [
        { created_at: '2026-04-16T09:02:00Z', action: 'short_rest_response', detail: JSON.stringify({ player_state_id: 'state-old', response: { ready: true } }) },
        { created_at: '2026-04-16T10:02:00Z', action: 'short_rest_response', detail: JSON.stringify({ player_state_id: 'state-new', response: { ready: true } }) },
      ],
    });
    expect(state.active).toBe(true);
    expect(state.responsesByStateId['state-old']).toBeUndefined();
    expect(state.responsesByStateId['state-new']).toBeTruthy();
  });

  test('marks procedure inactive when latest event is cancel', () => {
    const state = deriveShortRestProcedureSnapshot({
      procedureRows: [
        { created_at: '2026-04-16T10:00:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'start' }) },
        { created_at: '2026-04-16T10:03:00Z', action: 'short_rest_procedure', detail: JSON.stringify({ type: 'cancel' }) },
      ],
      responseRows: [
        { created_at: '2026-04-16T10:02:00Z', action: 'short_rest_response', detail: JSON.stringify({ player_state_id: 'state-1', response: { ready: true } }) },
      ],
    });
    expect(state.active).toBe(false);
    expect(Object.keys(state.responsesByStateId)).toHaveLength(0);
  });
});
