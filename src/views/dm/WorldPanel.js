import React, { useState } from 'react';
import WorldShopsPanel from './WorldShopsPanel';
import WorldRewardsPanel from './WorldRewardsPanel';

export default function WorldPanel({ encounterId, playerStates, refreshAll = null, onInventoryRefresh = null }) {
  const [tab, setTab] = useState('shops');

  return (
    <div className="world-shops-shell">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <button className="btn btn-ghost" style={{ borderColor: tab === 'shops' ? 'var(--accent-blue)' : 'var(--border)' }} onClick={() => setTab('shops')}>Shops</button>
        <button className="btn btn-ghost" style={{ borderColor: tab === 'rewards' ? 'var(--accent-blue)' : 'var(--border)' }} onClick={() => setTab('rewards')}>Rewards</button>
      </div>

      {tab === 'shops' ? <WorldShopsPanel showImportControls={false} encounterId={encounterId} playerStates={playerStates} /> : null}
      {tab === 'rewards' ? <WorldRewardsPanel encounterId={encounterId} playerStates={playerStates} onInventoryChanged={refreshAll} onInventoryRefresh={onInventoryRefresh} /> : null}
    </div>
  );
}
