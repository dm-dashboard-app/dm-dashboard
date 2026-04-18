import { buildLongRestRechargePlan, normalizeLongRestAttunedIds } from './longRestItemsWorkflow';

describe('longRestItemsWorkflow', () => {
  test('normalizes selected attuned ids to unique max-3 list', () => {
    expect(normalizeLongRestAttunedIds(['a', 'b', 'a', 'c', 'd'])).toEqual(['a', 'b', 'c']);
  });

  test('builds recharge plan only for positive charge entries', () => {
    const plan = buildLongRestRechargePlan({
      rechargeDraft: { a: '2', b: '0', c: '-1', d: 'x' },
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
    });

    expect(plan).toEqual([{ itemRowId: 'a', restoredCharges: 2 }]);
  });
});
