import React, { useState } from 'react';
import WorldShopsPanel from './WorldShopsPanel';
import WorldRewardsPanel from './WorldRewardsPanel';
import WorldLocalesPanel from './WorldLocalesPanel';
import WorldNpcsPanel from './WorldNpcsPanel';

export default function WorldPanel({ encounterId, playerStates, refreshAll = null, onInventoryRefresh = null }) {
  const [tab, setTab] = useState('locales');

  return (
    <div className="world-shops-shell">
      <div className="world-tabs-row world-tabs-row--world-main">
        <button className="btn btn-ghost" style={{ borderColor: tab === 'locales' ? 'var(--accent-blue)' : 'var(--border)' }} onClick={() => setTab('locales')}>Locales</button>
        <button className="btn btn-ghost" style={{ borderColor: tab === 'shops' ? 'var(--accent-blue)' : 'var(--border)' }} onClick={() => setTab('shops')}>Shop Generator</button>
        <button className="btn btn-ghost" style={{ borderColor: tab === 'rewards' ? 'var(--accent-blue)' : 'var(--border)' }} onClick={() => setTab('rewards')}>Rewards</button>
        <button className="btn btn-ghost" style={{ borderColor: tab === 'npcs' ? 'var(--accent-blue)' : 'var(--border)' }} onClick={() => setTab('npcs')}>NPCs</button>
      </div>

      {tab === 'locales' ? <WorldLocalesPanel playerStates={playerStates} role="dm" /> : null}
      {tab === 'shops' ? <WorldShopsPanel showImportControls={false} encounterId={encounterId} playerStates={playerStates} /> : null}
      {tab === 'rewards' ? <WorldRewardsPanel encounterId={encounterId} playerStates={playerStates} onInventoryChanged={refreshAll} onInventoryRefresh={onInventoryRefresh} /> : null}
      {tab === 'npcs' ? <WorldNpcsPanel role="dm" /> : null}
    </div>
  );
}
