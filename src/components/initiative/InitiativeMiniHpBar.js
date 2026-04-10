import React from 'react';

function resolveThresholdColor(pct) {
  return pct > 50 ? 'var(--hp-high)' : pct > 25 ? 'var(--hp-mid)' : 'var(--hp-low)';
}

export default function InitiativeMiniHpBar({ current, max, tempHp = 0, bonusMaxHp = 0, color, label }) {
  const safeCurrent = Math.max(0, current ?? 0);
  const safeMax = Math.max(0, max ?? 0);
  const safeTemp = Math.max(0, tempHp ?? 0);
  const baseMax = Math.max(0, safeMax - Math.max(0, bonusMaxHp));
  const baseCurrent = Math.max(0, Math.min(safeCurrent, baseMax));
  const bonusCurrent = Math.max(0, safeCurrent - baseMax);
  const totalBar = Math.max(1, safeMax + safeTemp);
  const basePct = (baseCurrent / totalBar) * 100;
  const bonusLeftPct = (baseMax / totalBar) * 100;
  const bonusPct = (bonusCurrent / totalBar) * 100;
  const tempLeftPct = (safeCurrent / totalBar) * 100;
  const tempPct = (safeTemp / totalBar) * 100;
  const looksLikeWildShape = typeof label === 'string' && (label.includes('') || label.toLowerCase().includes('beast'));
  const hpPct = safeMax > 0 ? Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100)) : 0;
  const barColor = looksLikeWildShape ? resolveThresholdColor(hpPct) : (color || resolveThresholdColor(hpPct));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label && <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>}
      <div style={{ position: 'relative', height: 6, background: 'var(--bg-panel-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${basePct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
        {bonusCurrent > 0 && <div style={{ position: 'absolute', left: `${bonusLeftPct}%`, top: 0, height: '100%', width: `${bonusPct}%`, background: 'var(--accent-gold)', opacity: 0.75, borderRadius: 3 }} />}
        {safeTemp > 0 && <div style={{ position: 'absolute', left: `${tempLeftPct}%`, top: 0, height: '100%', width: `${tempPct}%`, background: 'var(--hp-temp)', opacity: 0.75, borderRadius: 3 }} />}
      </div>
    </div>
  );
}
