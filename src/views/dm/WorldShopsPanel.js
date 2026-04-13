import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { generateShopRows } from '../../utils/shopGenerator';

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

function ItemDetailModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="world-shop-modal-backdrop" onClick={onClose}>
      <div className="world-shop-modal" onClick={event => event.stopPropagation()}>
        <div className="world-shop-modal-head">
          <strong>{item.item_name}</strong>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="world-shop-item-meta">
          <span>{item.item_type || 'Unknown Type'}</span>
          {item.category ? <span>• {item.category}</span> : null}
          {item.rarity ? <span>• {item.rarity}</span> : null}
          {item.source_book ? <span>• {item.source_book}</span> : null}
        </div>
        <div className="world-shop-pricing-meta">
          <span>Listed: {gpLabel(item.listed_price_gp)}</span>
          <span>Minimum: {gpLabel(item.minimum_price_gp)}</span>
          <span>Barter DC: {item.barter_dc}</span>
        </div>
        <p className="world-shop-item-description">{item.description || 'No description available in the imported catalog.'}</p>
      </div>
    </div>
  );
}

export default function WorldShopsPanel() {
  const [shopType, setShopType] = useState('general_store');
  const [affluenceTier, setAffluenceTier] = useState('modest');
  const [catalogItems, setCatalogItems] = useState([]);
  const [generatedRows, setGeneratedRows] = useState([]);
  const [savedShops, setSavedShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const selectedShop = useMemo(() => savedShops.find(shop => shop.id === selectedShopId) || null, [savedShops, selectedShopId]);

  const loadCatalog = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('item_master')
      .select('id, name, item_type, category, subcategory, rarity, description, base_price_gp, suggested_price_gp, source_type, source_book, rules_era, is_shop_eligible, shop_bucket')
      .eq('rules_era', '2014')
      .eq('is_shop_eligible', true)
      .order('name');
    if (loadError) throw loadError;
    setCatalogItems(data || []);
  }, []);

  const loadSavedShops = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('dm_shops')
      .select('id, shop_type, affluence_tier, generation_seed, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (loadError) throw loadError;
    setSavedShops(data || []);
  }, []);

  const loadShopInventory = useCallback(async shopId => {
    const { data, error: loadError } = await supabase
      .from('dm_shop_inventory')
      .select('id, item_id, quantity, listed_price_gp, minimum_price_gp, barter_dc, sort_order, item_master(name, item_type, category, rarity, description, source_type, source_book)')
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true });
    if (loadError) throw loadError;

    const normalized = (data || []).map(row => ({
      id: row.id,
      item_id: row.item_id,
      item_name: row.item_master?.name,
      item_type: row.item_master?.item_type,
      category: row.item_master?.category,
      rarity: row.item_master?.rarity,
      description: row.item_master?.description,
      source_type: row.item_master?.source_type,
      source_book: row.item_master?.source_book,
      quantity: row.quantity,
      listed_price_gp: row.listed_price_gp,
      minimum_price_gp: row.minimum_price_gp,
      barter_dc: row.barter_dc,
    }));

    setGeneratedRows(normalized);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        await Promise.all([loadCatalog(), loadSavedShops()]);
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
  }, [loadCatalog, loadSavedShops]);

  async function handleGenerate() {
    setError('');
    const rows = generateShopRows(catalogItems, { shopType, affluence: affluenceTier });
    setGeneratedRows(rows);
    setSelectedShopId(null);
  }

  async function handleSaveNewShop() {
    if (generatedRows.length === 0) {
      setError('Generate stock before saving a shop.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const generationSeed = crypto.randomUUID();
      const { data: shop, error: shopError } = await supabase
        .from('dm_shops')
        .insert({
          shop_type: shopType,
          affluence_tier: affluenceTier,
          generation_seed: generationSeed,
        })
        .select('id')
        .single();

      if (shopError) throw shopError;

      const payload = generatedRows.map((row, index) => ({
        shop_id: shop.id,
        item_id: row.item_id,
        quantity: row.quantity,
        listed_price_gp: row.listed_price_gp,
        minimum_price_gp: row.minimum_price_gp,
        barter_dc: row.barter_dc,
        sort_order: index,
      }));

      const { error: rowsError } = await supabase.from('dm_shop_inventory').insert(payload);
      if (rowsError) throw rowsError;

      await loadSavedShops();
      setSelectedShopId(shop.id);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save shop.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectShop(shop) {
    setShopType(shop.shop_type);
    setAffluenceTier(shop.affluence_tier);
    setSelectedShopId(shop.id);
    setError('');
    try {
      await loadShopInventory(shop.id);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load saved shop inventory.');
    }
  }

  async function handleRegenerateExisting() {
    if (!selectedShopId) {
      await handleGenerate();
      return;
    }

    const rows = generateShopRows(catalogItems, { shopType, affluence: affluenceTier });
    setGeneratedRows(rows);

    try {
      setSaving(true);
      const generationSeed = crypto.randomUUID();
      await supabase.from('dm_shop_inventory').delete().eq('shop_id', selectedShopId);
      const payload = rows.map((row, index) => ({
        shop_id: selectedShopId,
        item_id: row.item_id,
        quantity: row.quantity,
        listed_price_gp: row.listed_price_gp,
        minimum_price_gp: row.minimum_price_gp,
        barter_dc: row.barter_dc,
        sort_order: index,
      }));
      const { error: insertError } = await supabase.from('dm_shop_inventory').insert(payload);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('dm_shops')
        .update({
          shop_type: shopType,
          affluence_tier: affluenceTier,
          generation_seed: generationSeed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedShopId);

      if (updateError) throw updateError;
      await loadSavedShops();
    } catch (saveError) {
      setError(saveError.message || 'Failed to regenerate shop.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-state">Loading World Shops…</div>;

  return (
    <div className="world-shops-shell">
      <div className="world-shops-controls">
        <div className="world-shops-control-group">
          <label>Shop Type</label>
          <select value={shopType} onChange={event => setShopType(event.target.value)}>
            {SHOP_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="world-shops-control-group">
          <label>Affluence</label>
          <select value={affluenceTier} onChange={event => setAffluenceTier(event.target.value)}>
            {AFFLUENCE_TIERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleGenerate}>Generate</button>
        <button className="btn btn-ghost" onClick={handleRegenerateExisting} disabled={saving}>{selectedShop ? 'Regenerate Saved' : 'Regenerate'}</button>
        <button className="btn btn-ghost" onClick={handleSaveNewShop} disabled={saving || generatedRows.length === 0}>{saving ? 'Saving…' : 'Save Shop'}</button>
      </div>

      {error ? <div className="world-shops-error">{error}</div> : null}

      <div className="world-shops-layout">
        <div className="world-shops-saved-list">
          <div className="world-shops-panel-title">Saved Shops</div>
          {savedShops.length === 0 ? <div className="empty-state">No saved shops yet.</div> : null}
          {savedShops.map(shop => (
            <button
              type="button"
              key={shop.id}
              className="world-shops-saved-item"
              data-active={shop.id === selectedShopId}
              onClick={() => handleSelectShop(shop)}
            >
              <strong>{shop.shop_type.replace('_', ' ')}</strong>
              <span>{shop.affluence_tier.replace('_', ' ')}</span>
              <span>{new Date(shop.updated_at || shop.created_at).toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div className="world-shops-stock-panel">
          <div className="world-shops-panel-title">Generated Stock ({generatedRows.length})</div>
          <div className="world-shops-stock-head">
            <span>Item</span>
            <span>Qty</span>
            <span>Listed</span>
            <span>Min</span>
            <span>DC</span>
          </div>
          {generatedRows.map(row => (
            <button key={`${row.item_id}-${row.item_name}`} className="world-shops-stock-row" onClick={() => setSelectedItem(row)}>
              <span className="item-name">{row.item_name}</span>
              <span>{row.quantity}</span>
              <span>{gpLabel(row.listed_price_gp)}</span>
              <span>{gpLabel(row.minimum_price_gp)}</span>
              <span>{row.barter_dc}</span>
            </button>
          ))}
          {generatedRows.length === 0 ? <div className="empty-state">Generate stock to start building a shop.</div> : null}
        </div>
      </div>

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
