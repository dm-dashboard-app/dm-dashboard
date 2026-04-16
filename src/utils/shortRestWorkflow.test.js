import {
  computeHealingTotal,
  deriveShortRestProcedureSnapshot,
  deriveShortRestProcedureState,
  validateShortRestResponse,
} from './shortRestWorkflow';

describe('shortRestWorkflow', () => {
  test('validates hit-dice total against spend breakdown', () => {
    const state = { hit_dice_d8_current: 3, hit_dice_d8_max: 3 };
    const profile = { ability_con: 14 };
    const invalid = validateShortRestResponse({
      input: { rolledTotal: 6, totalHitDiceUsed: 2, spendBySize: { d8: 1 } },
      state,
      profile,
    });
    expect(invalid.valid).toBe(false);

    const valid = validateShortRestResponse({
      input: { rolledTotal: 6, totalHitDiceUsed: 2, spendBySize: { d8: 2 } },
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
