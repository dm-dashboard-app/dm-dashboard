import React, { useRef, useState } from 'react';

export default function InitiativeInlineDmgHeal({ onDamage, onHeal }) {
  const [amount, setAmount] = useState('');
  const inputRef = useRef(null);
  const n = parseInt(amount, 10);
  const valid = !isNaN(n) && n > 0;

  function handleDamage() {
    if (!valid) return;
    onDamage(n);
    setAmount('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleHeal() {
    if (!valid) return;
    onHeal(n);
    setAmount('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="hp-dmg-row hp-dmg-row--compact">
      <button className="hp-action-btn hp-action-dmg" onClick={handleDamage} disabled={!valid}>
        ⚔ DMG
      </button>
      <input
        ref={inputRef}
        className="hp-amount-input hp-amount-input--compact"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleDamage();
          if (e.key === 'Escape') setAmount('');
        }}
        placeholder="—"
        min={1}
      />
      <button className="hp-action-btn hp-action-heal" onClick={handleHeal} disabled={!valid}>
        HEAL ♥
      </button>
    </div>
  );
}
