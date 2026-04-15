import React from 'react';

function describeTransfer(transfer) {
  if (!transfer) return '';
  if (transfer.transfer_type === 'item') return `${transfer.item_name_snapshot || 'Item'} x${transfer.item_quantity}`;
  return `${String(transfer.currency_type || '').toUpperCase()} ${transfer.currency_amount}`;
}

export default function IncomingTransferPopup({ transfer, onAccept, onDecline }) {
  if (!transfer) return null;
  return (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(78px + env(safe-area-inset-bottom,0px))', zIndex: 160 }}>
      <div className="panel" style={{ borderColor: 'var(--accent-blue)', boxShadow: '0 10px 28px rgba(0,0,0,.32)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Incoming Transfer Request</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{transfer.sender_name || 'Player'} → You</div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>{describeTransfer(transfer)}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary" onClick={onAccept}>Accept</button>
          <button className="btn btn-danger" onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  );
}
