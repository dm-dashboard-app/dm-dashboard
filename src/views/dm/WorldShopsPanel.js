import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { generateShopRows } from '../../utils/shopGenerator';
import ItemImportPanel from '../../components/ItemImportPanel';

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

function textValue(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function listFromMetadata(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry) return null;
      if (typeof entry === 'string') return textValue(entry);
      const name = textValue(entry?.item?.name || entry?.name || entry?.property?.name);
      if (!name) return null;
      const qty = Number(entry?.quantity);
      if (Number.isFinite(qty) && qty > 1) return `${qty}x ${name}`;
      return name;
    })
    .filter(Boolean);
}

function extractDetailTextFromMetadata(metadata = {}) {
  const contents = listFromMetadata(metadata.contents);
  const properties = listFromMetadata(metadata.properties);
  const special = listFromMetadata(metadata.special);
  const desc = listFromMetadata(metadata.desc);
  const blocks = [];
  if (desc.length) blocks.push(desc.join('\n\n'));
  if (special.length) blocks.push(special.join('\n\n'));
  if (contents.length) blocks.push(`Contents: ${contents.join(', ')}`);
  if (properties.length) blocks.push(`Properties: ${properties.join(', ')}`);
  return blocks.join('\n\n').trim() || null;
}

function buildStructuredFallback(item = {}) {
  const lines = [];
  lines.push(`Type: ${textValue(item.item_type) || 'Unknown'}`);
  if (textValue(item.category)) lines.push(`Category: ${item.category}`);
  if (textValue(item.subcategory)) lines.push(`Subcategory: ${item.subcategory}`);
  if (textValue(item.rarity)) lines.push(`Rarity: ${item.rarity}`);
  if (item.requires_attunement === true) lines.push('Attunement: Required');
  if (item.requires_attunement === false) lines.push('Attunement: Not required');
  if (textValue(item.shop_bucket)) lines.push(`Shop bucket: ${item.shop_bucket}`);

  const metadata = item.metadata_json || {};
  const contents = listFromMetadata(metadata.contents);
  if (contents.length) lines.push(`Contents: ${contents.join(', ')}`);
  const properties = listFromMetadata(metadata.properties);
  if (properties.length) lines.push(`Properties: ${properties.join(', ')}`);

  return lines.join('\n');
}

function resolveItemDetailText(item = {}) {
  const primaryDescription = textValue(item.description);
  if (primaryDescription) return { text: primaryDescription, mode: 'description' };

  const metadataDescription = extractDetailTextFromMetadata(item.metadata_json || {});
  if (metadataDescription) return { text: metadataDescription, mode: 'metadata' };

  return { text: buildStructuredFallback(item), mode: 'structured_fallback' };
}

function ItemDetailModal({ item, onClose }) {
  if (!item) return null;
  const detail = resolveItemDetailText(item);

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
          {item.shop_bucket ? <span>• {item.shop_bucket}</span> : null}
          {item.source_book ? <span>• {item.source_book}</span> : null}
        </div>
        <div className="world-shop-pricing-meta">
          <span>Listed: {gpLabel(item.listed_price_gp)}</span>
          <span>Minimum: {gpLabel(item.minimum_price_gp)}</span>
          <span>Barter DC: {item.barter_dc}</span>
        </div>
        {item.price_source ? <div className="world-shop-pricing-meta"><span>Pricing Basis: {item.price_source}</span></div> : null}
        {detail.mode === 'structured_fallback' ? (
          <pre className="world-shop-item-description">{detail.text}</pre>
        ) : (
          <p className="world-shop-item-description">{detail.text}</p>
        )}
      </div>
    </div>
  );
}

export default function WorldShopsPanel({ showImportControls = false }) {
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
  const catalogById = useMemo(() => new Map(catalogItems.map(item => [item.id, item])), [catalogItems]);

  function buildRpcRows(rows = []) {
    return rows.map((row, index) => ({
      item_id: row.item_id,
      quantity: Number(row.quantity || 1),
      listed_price_gp: Number(row.listed_price_gp || 0),
      minimum_price_gp: Number(row.minimum_price_gp || 0),
      barter_dc: Number(row.barter_dc || 0),
      sort_order: index,
    }));
  }

  const loadCatalog = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('item_master')
      .select('id, external_key, source_slug, name, item_type, category, subcategory, rarity, description, base_price_gp, suggested_price_gp, price_source, source_type, source_book, rules_era, is_shop_eligible, shop_bucket, metadata_json')
      .eq('rules_era', '2014')
      .eq('is_shop_eligible', true)
      .order('name');
    if (loadError) throw loadError;
    const filtered = (data || []).filter(item => item?.metadata_json?.degraded_import !== true);
    setCatalogItems(filtered);
  }, []);

  const loadSavedShops = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc('dm_list_shops');
    if (loadError) throw loadError;
    setSavedShops(data || []);
  }, []);

  const loadShopInventory = useCallback(async shopId => {
    const { data, error: loadError } = await supabase.rpc('dm_get_shop_inventory', { p_shop_id: shopId });
    if (loadError) throw loadError;

    const normalized = (data || []).map(row => ({
      ...(catalogById.get(row.item_id) || {}),
      id: row.id,
      item_id: row.item_id,
      item_name: row.item_name,
      item_type: row.item_type,
      category: row.category,
      subcategory: row.subcategory || catalogById.get(row.item_id)?.subcategory || null,
      rarity: row.rarity,
      description: row.description,
      source_type: row.source_type,
      source_book: row.source_book,
      price_source: row.price_source,
      shop_bucket: row.shop_bucket,
      metadata_json: catalogById.get(row.item_id)?.metadata_json || row.metadata_json || null,
      requires_attunement: catalogById.get(row.item_id)?.requires_attunement ?? null,
      quantity: row.quantity,
      listed_price_gp: row.listed_price_gp,
      minimum_price_gp: row.minimum_price_gp,
      barter_dc: row.barter_dc,
    }));

    setGeneratedRows(normalized);
  }, [catalogById]);

  const refreshWorldShopData = useCallback(async () => {
    await Promise.all([loadCatalog(), loadSavedShops()]);
    if (selectedShopId) await loadShopInventory(selectedShopId);
  }, [loadCatalog, loadSavedShops, loadShopInventory, selectedShopId]);

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
      const payload = buildRpcRows(generatedRows);
      const { data: shopId, error: saveError } = await supabase.rpc('dm_save_shop', {
        p_shop_type: shopType,
        p_affluence_tier: affluenceTier,
        p_generation_seed: generationSeed,
        p_rows: payload,
      });

      if (saveError) throw saveError;

      await loadSavedShops();
      setSelectedShopId(shopId);
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
      const payload = buildRpcRows(rows);
      const { error: replaceError } = await supabase.rpc('dm_replace_shop_inventory', {
        p_shop_id: selectedShopId,
        p_shop_type: shopType,
        p_affluence_tier: affluenceTier,
        p_generation_seed: generationSeed,
        p_rows: payload,
      });
      if (replaceError) throw replaceError;

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
      {showImportControls ? <ItemImportPanel onImportComplete={refreshWorldShopData} /> : null}

      <div className="world-shops-controls">
        <div className="world-shops-control-group">
          <label>Shop Type</label>
          <select className="world-shops-select" value={shopType} onChange={event => setShopType(event.target.value)}>
            {SHOP_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="world-shops-control-group">
          <label>Affluence</label>
          <select className="world-shops-select" value={affluenceTier} onChange={event => setAffluenceTier(event.target.value)}>
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
