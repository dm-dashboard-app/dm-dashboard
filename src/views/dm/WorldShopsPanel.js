import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { generateShopRows } from '../../utils/shopGenerator';
import { applyPersistedStockLanes } from '../../utils/shopLanePersistence';
import ItemImportPanel from '../../components/ItemImportPanel';
import { generateSpellScrollBatch } from '../../utils/spellScrolls';
import { inventoryDmAssignGeneratedShopItem, inventoryDmShopAssignItem } from '../../inventory/inventoryClient';
import { getItemMechanicsSummary, resolveItemDetailText } from '../../utils/itemDetailText';

const SHOP_TYPES = [
  { value: 'blacksmith', label: 'Blacksmith' },
  { value: 'general_store', label: 'General Store' },
  { value: 'apothecary', label: 'Apothecary / Alchemy' },
  { value: 'magic_shop', label: 'Magic Shop' },
];

const AFFLUENCE_TIERS = [
  { value: 'poor', label: 'Poor' },
  { value: 'modest', label: 'Modest' },
  { value: 'middle_class', label: 'Middle Class' },
  { value: 'wealthy', label: 'Wealthy' },
];

function gpLabel(value) {
  return `${Number(value || 0).toLocaleString()} gp`;
}

function isSyntheticSpellScrollId(value) {
  return String(value || '').startsWith('spell-scroll:');
}

function ItemDetailModal({ item, onClose, players = [], onAssignmentSuccess }) {
  const [receiverProfileId, setReceiverProfileId] = useState(players[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [pricingMode, setPricingMode] = useState('listed');
  const [customPrice, setCustomPrice] = useState(item?.listed_price_gp || 0);
  const [status, setStatus] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    setReceiverProfileId(players[0]?.id || '');
    setQuantity(1);
    setPricingMode('listed');
    setCustomPrice(item?.listed_price_gp || 0);
    setStatus('');
  }, [item?.id, item?.listed_price_gp, item?.shop_inventory_id, players]);

  if (!item) return null;
  const detail = resolveItemDetailText(item);
  const mechanicsSummary = getItemMechanicsSummary(item);

  async function handleAssignToPlayer() {
    if (!receiverProfileId) return;
    try {
      setAssignLoading(true);
      setStatus('');
      const hasPersistedShopInventoryId = !!item.shop_inventory_id;
      const assignmentPayload = {
        receiverProfileId,
        quantity: Number(quantity) || 1,
        priceMode: pricingMode,
        customPriceGp: pricingMode === 'custom' ? Number(customPrice) || 0 : null,
        note: 'World shop assignment',
      };
      const generatedItemMasterId = item.item_master_id || item.item_id;
      if (!hasPersistedShopInventoryId && isSyntheticSpellScrollId(generatedItemMasterId)) {
        throw new Error('Generated spell scroll could not be mapped to an assignable catalog UUID. Refresh imports and regenerate the shop.');
      }

      const result = hasPersistedShopInventoryId
        ? await inventoryDmShopAssignItem({
          ...assignmentPayload,
          shopInventoryId: item.shop_inventory_id,
        })
        : await inventoryDmAssignGeneratedShopItem({
          ...assignmentPayload,
          itemMasterId: generatedItemMasterId,
          listedPriceGp: Number(item.listed_price_gp) || 0,
          minimumPriceGp: Number(item.minimum_price_gp) || 0,
          sourceContext: 'World shop generated row assignment',
        });
      await onAssignmentSuccess?.();
      setStatus(`Success: assigned ${result?.item_name || item.item_name} x${result?.quantity_assigned || quantity}. Charged ${result?.total_gp_charged || 0} gp.`);
    } catch (error) {
      setStatus(`Assignment failed: ${error?.message || 'Unable to assign this item right now.'}`);
    } finally {
      setAssignLoading(false);
    }
  }

  return (
    <div className="world-shop-modal-backdrop" onClick={onClose}>
      <div className="world-shop-modal" onClick={(event) => event.stopPropagation()}>
        <div className="world-shop-modal-head">
          <strong>{item.item_name}</strong>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="world-shop-item-meta">
          <span>{item.item_type || 'Unknown Type'}</span>
          {item.category ? <span>• {item.category}</span> : null}
          {item.rarity ? <span>• {item.rarity}</span> : null}
          {item.shop_bucket ? <span>• {item.shop_bucket}</span> : null}
          <span>• Stock: {item.quantity}</span>
        </div>
        <div className="world-shop-pricing-meta">
          <span>Listed: {gpLabel(item.listed_price_gp)}</span>
          <span>Minimum: {gpLabel(item.minimum_price_gp)}</span>
          <span>Barter DC: {item.barter_dc}</span>
        </div>
        {item.price_source ? <div className="world-shop-pricing-meta"><span>Pricing Basis: {item.price_source}</span></div> : null}
        {detail.mode === 'structured_fallback' ? <pre className="world-shop-item-description">{detail.text}</pre> : <p className="world-shop-item-description">{detail.text}</p>}
        {mechanicsSummary.length > 0 ? (
          <div className="item-mechanics-summary">
            <div className="item-mechanics-summary__title">Mechanics &amp; Stat Bonuses</div>
            <div className="item-mechanics-summary__rows">
              {mechanicsSummary.map((entry, index) => (
                <div key={`${entry.label}-${entry.value}-${index}`} className="item-mechanics-summary__row">
                  <span className="item-mechanics-summary__label">{entry.label}</span>
                  <span className="item-mechanics-summary__value">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="panel" style={{ padding: 8 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Assign / Sell to Player</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <select className="form-input" value={receiverProfileId} onChange={(event) => setReceiverProfileId(event.target.value)}>
              <option value="">Select player</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
            <input className="form-input" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <select className="form-input" value={pricingMode} onChange={(event) => setPricingMode(event.target.value)}>
              <option value="listed">Listed price</option>
              <option value="minimum">Minimum price</option>
              <option value="custom">Custom price</option>
            </select>
            {pricingMode === 'custom' ? (
              <input className="form-input" type="number" min={0} value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} />
            ) : null}
            <button className="btn btn-primary" disabled={!receiverProfileId || assignLoading} onClick={handleAssignToPlayer}>
              {assignLoading ? 'Applying…' : 'Apply Assignment'}
            </button>
            {status ? <div className="world-shops-import-status">{status}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorldShopsPanel({ showImportControls = false, playerStates = [] }) {
  const [shopType, setShopType] = useState('general_store');
  const [affluenceTier, setAffluenceTier] = useState('modest');
  const [catalogItems, setCatalogItems] = useState([]);
  const [spellItems, setSpellItems] = useState([]);
  const [generatedRows, setGeneratedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [scrollLevel, setScrollLevel] = useState(1);
  const [scrollQuantity, setScrollQuantity] = useState(1);
  const [generatedScrolls, setGeneratedScrolls] = useState([]);

  const players = useMemo(() => {
    const map = new Map();
    (playerStates || []).forEach((row) => {
      const id = row.player_profile_id || row.profiles_players?.id;
      if (!id || map.has(id)) return;
      map.set(id, { id, name: row.profiles_players?.name || 'Player' });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [playerStates]);

  const loadCatalog = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('item_master')
      .select('id, external_key, source_slug, name, item_type, category, subcategory, rarity, description, base_price_gp, suggested_price_gp, price_source, source_type, source_book, rules_era, is_shop_eligible, shop_bucket, metadata_json')
      .eq('rules_era', '2014')
      .eq('is_shop_eligible', true)
      .order('name');
    if (loadError) throw loadError;
    const filtered = (data || []).filter((item) => item?.metadata_json?.degraded_import !== true);
    setCatalogItems(filtered);
  }, []);

  const loadSpells = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('spells')
      .select('id, name, level, is_cantrip, school, casting_time')
      .order('level')
      .order('name');
    if (loadError) throw loadError;
    setSpellItems(data || []);
  }, []);

  const refreshWorldShopData = useCallback(async () => {
    await Promise.all([loadCatalog(), loadSpells()]);
  }, [loadCatalog, loadSpells]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        await refreshWorldShopData();
      } catch (loadError) {
        if (active) setError(loadError.message || 'Failed to load shop data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [refreshWorldShopData]);

  async function handleGenerate() {
    setError('');
    const rows = generateShopRows(catalogItems, { shopType, affluence: affluenceTier, spells: spellItems });
    const laneRows = applyPersistedStockLanes(rows, { shopType });
    setGeneratedRows(laneRows);
  }

  function handleGenerateScrolls() {
    const scrolls = generateSpellScrollBatch(spellItems, {
      level: Number(scrollLevel || 1),
      quantity: Number(scrollQuantity || 1),
    });
    setGeneratedScrolls(scrolls);
  }

  if (loading) return <div className="empty-state">Loading World Shops…</div>;

  return (
    <div className="world-shops-shell">
      {showImportControls ? <ItemImportPanel onImportComplete={refreshWorldShopData} /> : null}

      <div className="world-shops-controls world-shops-controls--generator">
        <div className="world-shops-control-group">
          <label>Shop Type</label>
          <select className="world-shops-select" value={shopType} onChange={(event) => setShopType(event.target.value)}>
            {SHOP_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="world-shops-control-group">
          <label>Affluence</label>
          <select className="world-shops-select" value={affluenceTier} onChange={(event) => setAffluenceTier(event.target.value)}>
            {AFFLUENCE_TIERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary world-shops-generate-btn" onClick={handleGenerate}>Generate</button>
      </div>

      {error ? <div className="world-shops-error">{error}</div> : null}

      <div className="world-shops-stock-panel">
        <div className="world-shops-panel-title">Generated Stock ({generatedRows.length})</div>
          <div className="world-shops-stock-head">
            <span>Item</span>
            <span>Qty</span>
            <span>Listed</span>
            <span>Min</span>
            <span>DC</span>
          </div>
          {generatedRows.map((row, index) => {
            const previousLane = index > 0 ? generatedRows[index - 1].stock_lane : null;
            const showLaneLabel = (row.stock_lane || 'rotating') !== previousLane;
            return (
              <React.Fragment key={`${row.item_id}-${row.item_name}-${index}`}>
                {showLaneLabel ? <div className="world-shops-stock-lane-label">{row.stock_lane === 'core' ? 'Core Stock' : 'Rotating Stock'}</div> : null}
                <button className="world-shops-stock-row" data-lane={row.stock_lane || 'rotating'} onClick={() => setSelectedItem(row)}>
                  <span className="item-name">{row.item_name}</span>
                  <span>{row.quantity}</span>
                  <span>{gpLabel(row.listed_price_gp)}</span>
                  <span>{gpLabel(row.minimum_price_gp)}</span>
                  <span>{row.barter_dc}</span>
                </button>
              </React.Fragment>
            );
          })}
          {generatedRows.length === 0 ? <div className="empty-state">Generate stock to start building a shop.</div> : null}
      </div>

      <div className="world-shops-scroll-tool">
        <div className="world-shops-panel-title">Spell Scroll Generator</div>
        <div className="world-shops-controls">
          <div className="world-shops-control-group">
            <label>Spell Level</label>
            <select className="world-shops-select" value={scrollLevel} onChange={(event) => setScrollLevel(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <div className="world-shops-control-group">
            <label>Quantity</label>
            <input
              className="world-shops-scroll-input"
              type="number"
              min={1}
              max={30}
              value={scrollQuantity}
              onChange={(event) => setScrollQuantity(Math.max(1, Number(event.target.value || 1)))}
            />
          </div>
          <button className="btn btn-primary" onClick={handleGenerateScrolls}>Generate Scrolls</button>
        </div>
        {generatedScrolls.length === 0 ? (
          <div className="empty-state">Choose a level and quantity, then generate spell scrolls.</div>
        ) : (
          <div className="world-shops-scroll-list">
            {generatedScrolls.map((scroll, index) => (
              <div className="world-shops-scroll-row" key={`${scroll.id || scroll.name}-${index}`}>
                <strong>{scroll.scroll_name}</strong>
                <span>{scroll.school || 'Unknown school'}{scroll.casting_time ? ` • ${scroll.casting_time}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ItemDetailModal
        item={selectedItem}
        onClose={() => { setSelectedItem(null); refreshWorldShopData(); }}
        players={players}
        onAssignmentSuccess={refreshWorldShopData}
      />
    </div>
  );
}
