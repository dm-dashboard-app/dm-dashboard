import {
  evaluateTransferLifecycle,
  formatInventorySummary,
  mergeCatalogItems,
  normalizeInventoryItemPayload,
} from './inventoryUtils';

describe('inventory summary formatting', () => {
  test('uses exact compact line format', () => {
    expect(formatInventorySummary({ total_item_quantity: 27, gp: 143 })).toBe('Inventory • 27 items • 143 gp');
  });

  test('defaults to zero values safely', () => {
    expect(formatInventorySummary({})).toBe('Inventory • 0 items • 0 gp');
  });
});

describe('inventory item normalization / merge', () => {
  test('normalizes custom item payload and quantity', () => {
    expect(normalizeInventoryItemPayload({ customName: ' Rope ', quantity: '3', notes: ' 50ft ' })).toEqual({
      itemMasterId: null,
      customName: 'Rope',
      quantity: 3,
      notes: '50ft',
    });
  });

  test('merges duplicate catalog rows', () => {
    const merged = mergeCatalogItems(
      [{ item_master_id: 'catalog-id', quantity: 2, notes: null }],
      { item_master_id: 'catalog-id', quantity: 5, notes: 'packed' },
    );
    expect(merged).toEqual([{ item_master_id: 'catalog-id', quantity: 7, notes: 'packed' }]);
  });
});

describe('transfer lifecycle rules', () => {
  test('pending request leaves sender unchanged until accepted', () => {
    expect(evaluateTransferLifecycle({ senderAvailable: 5, requestedAmount: 2, accepted: false, isDmFlow: false })).toBe('pending');
  });

  test('accepted player transfer completes when sender still has enough', () => {
    expect(evaluateTransferLifecycle({ senderAvailable: 5, requestedAmount: 2, accepted: true, isDmFlow: false })).toBe('completed');
  });

  test('accepted player transfer fails when sender no longer has enough', () => {
    expect(evaluateTransferLifecycle({ senderAvailable: 1, requestedAmount: 2, accepted: true, isDmFlow: false })).toBe('failed');
  });

  test('dm direct transfer completes immediately when valid', () => {
    expect(evaluateTransferLifecycle({ senderAvailable: 10, requestedAmount: 4, isDmFlow: true })).toBe('completed');
  });

  test('dm direct transfer fails cleanly when invalid', () => {
    expect(evaluateTransferLifecycle({ senderAvailable: 1, requestedAmount: 4, isDmFlow: true })).toBe('failed');
  });
});
