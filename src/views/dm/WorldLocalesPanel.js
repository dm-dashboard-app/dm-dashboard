import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { generateShopRows } from '../../utils/shopGenerator';
import { inventoryDmAssignGeneratedShopItem } from '../../inventory/inventoryClient';
import { resolveItemDetailText } from '../../utils/itemDetailText';

const LOCALE_TYPES = ['City', 'Town', 'Village', 'District', 'Outpost', 'Port', 'Stronghold', 'Hamlet'];
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

function CollapsibleSection({ title, value }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return (
    <div className="world-card">
      <button type="button" className="world-collapsible-toggle" onClick={() => setOpen((v) => !v)}>
        <strong>{title}</strong>
        <span>{open ? 'Hide' : 'Open'}</span>
      </button>
      {open ? <div className="world-card-body" style={{ whiteSpace: 'pre-wrap' }}>{value}</div> : null}
    </div>
  );
}

function LocaleEditor({ locale, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: locale?.name || '',
    locale_type: locale?.locale_type || 'Town',
    short_description: locale?.short_description || '',
    politics_leadership: locale?.politics_leadership || '',
    purpose: locale?.purpose || '',
    settlement_structure: locale?.settlement_structure || '',
    notable_features: locale?.notable_features || '',
    hidden_or_underbelly_notes: locale?.hidden_or_underbelly_notes || '',
    free_notes: locale?.free_notes || '',
  });

  return (
    <div className="world-sheet-backdrop" onClick={onCancel}>
      <div className="world-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="world-sheet-head">
          <strong>{locale?.id ? 'Edit Locale' : 'New Locale'}</strong>
          <button className="btn btn-ghost" onClick={onCancel}>Close</button>
        </div>
        <div className="world-form-grid">
          <input className="form-input" placeholder="Locale name" value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} />
          <select className="form-input" value={form.locale_type} onChange={(event) => setForm((v) => ({ ...v, locale_type: event.target.value }))}>
            {LOCALE_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <textarea className="form-input" rows={2} placeholder="Short descriptor" value={form.short_description} onChange={(event) => setForm((v) => ({ ...v, short_description: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Politics & leadership" value={form.politics_leadership} onChange={(event) => setForm((v) => ({ ...v, politics_leadership: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Purpose" value={form.purpose} onChange={(event) => setForm((v) => ({ ...v, purpose: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Structure / shape" value={form.settlement_structure} onChange={(event) => setForm((v) => ({ ...v, settlement_structure: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Notable features" value={form.notable_features} onChange={(event) => setForm((v) => ({ ...v, notable_features: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Hidden / underbelly" value={form.hidden_or_underbelly_notes} onChange={(event) => setForm((v) => ({ ...v, hidden_or_underbelly_notes: event.target.value }))} />
          <textarea className="form-input" rows={4} placeholder="Free notes" value={form.free_notes} onChange={(event) => setForm((v) => ({ ...v, free_notes: event.target.value }))} />
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save Locale</button>
        </div>
      </div>
    </div>
  );
}

function DistrictEditor({ district, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: district?.name || '',
    short_description: district?.short_description || '',
    atmosphere_or_identity: district?.atmosphere_or_identity || '',
    notable_locations: district?.notable_locations || '',
    free_notes: district?.free_notes || '',
  });

  return (
    <div className="world-sheet-backdrop" onClick={onCancel}>
      <div className="world-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="world-sheet-head">
          <strong>{district?.id ? 'Edit District' : 'New District'}</strong>
          <button className="btn btn-ghost" onClick={onCancel}>Close</button>
        </div>
        <div className="world-form-grid">
          <input className="form-input" placeholder="District name" value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} />
          <textarea className="form-input" rows={2} placeholder="Short descriptor" value={form.short_description} onChange={(event) => setForm((v) => ({ ...v, short_description: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Atmosphere / identity" value={form.atmosphere_or_identity} onChange={(event) => setForm((v) => ({ ...v, atmosphere_or_identity: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Notable locations" value={form.notable_locations} onChange={(event) => setForm((v) => ({ ...v, notable_locations: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Free notes" value={form.free_notes} onChange={(event) => setForm((v) => ({ ...v, free_notes: event.target.value }))} />
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save District</button>
        </div>
      </div>
    </div>
  );
}

function LocaleShopEditor({ shop, districts = [], onSave, onCancel }) {
  const [form, setForm] = useState({
    shop_name: shop?.shop_name || '',
    shop_type: shop?.shop_type || 'general_store',
    affluence_tier: shop?.affluence_tier || 'modest',
    district_id: shop?.district_id || '',
    proprietor_name: shop?.proprietor_name || '',
    proprietor_race: shop?.proprietor_race || '',
    proprietor_description: shop?.proprietor_description || '',
    exterior_description: shop?.exterior_description || '',
    interior_description: shop?.interior_description || '',
    shop_notes: shop?.shop_notes || '',
  });

  return (
    <div className="world-sheet-backdrop" onClick={onCancel}>
      <div className="world-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="world-sheet-head">
          <strong>{shop?.id ? 'Edit Locale Shop' : 'New Locale Shop'}</strong>
          <button className="btn btn-ghost" onClick={onCancel}>Close</button>
        </div>
        <div className="world-form-grid">
          <input className="form-input" placeholder="Shop name" value={form.shop_name} onChange={(event) => setForm((v) => ({ ...v, shop_name: event.target.value }))} />
          <select className="form-input" value={form.shop_type} onChange={(event) => setForm((v) => ({ ...v, shop_type: event.target.value }))}>
            {SHOP_TYPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
          <select className="form-input" value={form.affluence_tier} onChange={(event) => setForm((v) => ({ ...v, affluence_tier: event.target.value }))}>
            {AFFLUENCE_TIERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
          <select className="form-input" value={form.district_id} onChange={(event) => setForm((v) => ({ ...v, district_id: event.target.value }))}>
            <option value="">No district link</option>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
          <input className="form-input" placeholder="Proprietor name" value={form.proprietor_name} onChange={(event) => setForm((v) => ({ ...v, proprietor_name: event.target.value }))} />
          <input className="form-input" placeholder="Proprietor race/species" value={form.proprietor_race} onChange={(event) => setForm((v) => ({ ...v, proprietor_race: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Proprietor description" value={form.proprietor_description} onChange={(event) => setForm((v) => ({ ...v, proprietor_description: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Exterior description" value={form.exterior_description} onChange={(event) => setForm((v) => ({ ...v, exterior_description: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Interior description" value={form.interior_description} onChange={(event) => setForm((v) => ({ ...v, interior_description: event.target.value }))} />
          <textarea className="form-input" rows={3} placeholder="Shop notes" value={form.shop_notes} onChange={(event) => setForm((v) => ({ ...v, shop_notes: event.target.value }))} />
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.shop_name.trim()}>Save Shop</button>
        </div>
      </div>
    </div>
  );
}

function LocaleShopItemModal({ item, onClose }) {
  if (!item) return null;
  const detail = resolveItemDetailText(item);
  return (
    <div className="world-sheet-backdrop" onClick={onClose}>
      <div className="world-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="world-sheet-head">
          <strong>{item.item_name}</strong>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="world-inline-meta">
          <span>{item.item_type || 'Unknown Type'}</span>
          {item.category ? <span>• {item.category}</span> : null}
          {item.rarity ? <span>• {item.rarity}</span> : null}
          <span>• Qty {item.quantity}</span>
        </div>
        <div className="world-inline-meta">
          <span>Listed {gpLabel(item.listed_price_gp)}</span>
          <span>Minimum {gpLabel(item.minimum_price_gp)}</span>
          <span>DC {item.barter_dc}</span>
        </div>
        {detail.mode === 'structured_fallback' ? <pre className="world-card-body">{detail.text}</pre> : <div className="world-card-body" style={{ whiteSpace: 'pre-wrap' }}>{detail.text}</div>}
      </div>
    </div>
  );
}

export default function WorldLocalesPanel({ playerStates = [] }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [locales, setLocales] = useState([]);
  const [selectedLocaleId, setSelectedLocaleId] = useState(null);
  const [selectedLocaleTab, setSelectedLocaleTab] = useState('overview');
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [selectedShopTab, setSelectedShopTab] = useState('details');
  const [localeDetail, setLocaleDetail] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [shops, setShops] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [spellItems, setSpellItems] = useState([]);

  const [editingLocale, setEditingLocale] = useState(null);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [editingShop, setEditingShop] = useState(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingInventoryNotes, setEditingInventoryNotes] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  const selectedShop = useMemo(() => shops.find((shop) => shop.id === selectedShopId) || null, [shops, selectedShopId]);

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
    const [{ data: items, error: itemError }, { data: spells, error: spellError }] = await Promise.all([
      supabase
        .from('item_master')
        .select('id, source_slug, name, item_type, category, subcategory, rarity, description, base_price_gp, suggested_price_gp, price_source, source_type, source_book, rules_era, is_shop_eligible, shop_bucket, metadata_json')
        .eq('rules_era', '2014')
        .eq('is_shop_eligible', true)
        .order('name'),
      supabase.from('spells').select('id, name, level, is_cantrip, school, casting_time').order('level').order('name'),
    ]);
    if (itemError) throw itemError;
    if (spellError) throw spellError;
    setCatalogItems((items || []).filter((item) => item?.metadata_json?.degraded_import !== true));
    setSpellItems(spells || []);
  }, []);

  const loadLocales = useCallback(async () => {
    const { data, error: localesError } = await supabase.rpc('dm_world_get_locales_overview');
    if (localesError) throw localesError;
    const rows = data || [];
    setLocales(rows);
    return rows;
  }, []);

  const loadLocaleDetail = useCallback(async (localeId) => {
    const [{ data: detailRows, error: detailError }, { data: districtRows, error: districtError }, { data: shopRows, error: shopError }] = await Promise.all([
      supabase.rpc('dm_world_get_locale_detail', { p_locale_id: localeId }),
      supabase.rpc('dm_world_get_locale_districts', { p_locale_id: localeId }),
      supabase.rpc('dm_world_get_locale_shops', { p_locale_id: localeId }),
    ]);
    if (detailError) throw detailError;
    if (districtError) throw districtError;
    if (shopError) throw shopError;

    setLocaleDetail(detailRows?.[0] || null);
    setDistricts(districtRows || []);
    setShops(shopRows || []);

    const nextShopId = selectedShopId && (shopRows || []).some((shop) => shop.id === selectedShopId)
      ? selectedShopId
      : (shopRows?.[0]?.id || null);
    setSelectedShopId(nextShopId);

    if (nextShopId) {
      const { data: stockRows, error: stockError } = await supabase.rpc('dm_world_get_locale_shop_inventory', { p_shop_id: nextShopId });
      if (stockError) throw stockError;
      setInventoryRows(stockRows || []);
      const shopRow = (shopRows || []).find((row) => row.id === nextShopId);
      setEditingInventoryNotes(shopRow?.inventory_notes || '');
    } else {
      setInventoryRows([]);
      setEditingInventoryNotes('');
    }
  }, [selectedShopId]);

  const refreshAll = useCallback(async (preferredLocaleId = null) => {
    setError('');
    const rows = await loadLocales();
    const activeLocaleId = preferredLocaleId || selectedLocaleId || rows?.[0]?.id || null;
    setSelectedLocaleId(activeLocaleId);
    if (activeLocaleId) await loadLocaleDetail(activeLocaleId);
  }, [loadLocales, loadLocaleDetail, selectedLocaleId]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        await Promise.all([loadCatalog(), refreshAll()]);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Failed to load locales.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [loadCatalog, refreshAll]);

  async function saveLocale(form) {
    setStatus('');
    setError('');
    try {
      const { data, error: saveError } = await supabase.rpc('dm_world_upsert_locale', {
        p_locale_id: editingLocale?.id || null,
        p_name: form.name,
        p_locale_type: form.locale_type,
        p_short_description: form.short_description,
        p_politics_leadership: form.politics_leadership,
        p_purpose: form.purpose,
        p_settlement_structure: form.settlement_structure,
        p_notable_features: form.notable_features,
        p_hidden_or_underbelly_notes: form.hidden_or_underbelly_notes,
        p_free_notes: form.free_notes,
        p_notes: localeDetail?.notes || '',
      });
      if (saveError) throw saveError;
      setEditingLocale(null);
      setStatus('Locale saved.');
      await refreshAll(data);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save locale.');
    }
  }

  async function saveDistrict(form) {
    try {
      const { error: saveError } = await supabase.rpc('dm_world_upsert_district', {
        p_district_id: editingDistrict?.id || null,
        p_locale_id: selectedLocaleId,
        p_name: form.name,
        p_short_description: form.short_description,
        p_atmosphere_or_identity: form.atmosphere_or_identity,
        p_notable_locations: form.notable_locations,
        p_free_notes: form.free_notes,
      });
      if (saveError) throw saveError;
      setEditingDistrict(null);
      setStatus('District saved.');
      await loadLocaleDetail(selectedLocaleId);
      await loadLocales();
    } catch (saveError) {
      setError(saveError.message || 'Failed to save district.');
    }
  }

  async function saveShop(form) {
    try {
      const { data, error: saveError } = await supabase.rpc('dm_world_upsert_locale_shop', {
        p_shop_id: editingShop?.id || null,
        p_locale_id: selectedLocaleId,
        p_district_id: form.district_id || null,
        p_shop_name: form.shop_name,
        p_shop_type: form.shop_type,
        p_affluence_tier: form.affluence_tier,
        p_proprietor_name: form.proprietor_name,
        p_proprietor_race: form.proprietor_race,
        p_proprietor_description: form.proprietor_description,
        p_exterior_description: form.exterior_description,
        p_interior_description: form.interior_description,
        p_shop_notes: form.shop_notes,
      });
      if (saveError) throw saveError;
      setEditingShop(null);
      setSelectedShopId(data);
      setStatus('Shop saved.');
      await loadLocaleDetail(selectedLocaleId);
      await loadLocales();
    } catch (saveError) {
      setError(saveError.message || 'Failed to save locale shop.');
    }
  }

  async function saveLocaleNotes() {
    try {
      const { error: saveError } = await supabase.rpc('dm_world_set_locale_notes', {
        p_locale_id: selectedLocaleId,
        p_notes: editingNotes,
      });
      if (saveError) throw saveError;
      setStatus('Locale notes saved.');
      await loadLocaleDetail(selectedLocaleId);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save locale notes.');
    }
  }

  async function saveShopInventoryNotes() {
    if (!selectedShopId) return;
    try {
      const { error: saveError } = await supabase.rpc('dm_world_set_locale_shop_inventory_notes', {
        p_shop_id: selectedShopId,
        p_inventory_notes: editingInventoryNotes,
      });
      if (saveError) throw saveError;
      setStatus('Inventory notes saved.');
      await loadLocaleDetail(selectedLocaleId);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save inventory notes.');
    }
  }

  async function handleGenerateInventory(regenerate = false) {
    if (!selectedShop) return;
    if (!regenerate && inventoryRows.length > 0) return;
    try {
      const generatedRows = generateShopRows(catalogItems, {
        shopType: selectedShop.shop_type,
        affluence: selectedShop.affluence_tier,
        spells: spellItems,
      });

      const payload = generatedRows.map((row, index) => ({
        item_id: row.item_master_id || row.id || null,
        item_name: row.item_name || row.name,
        item_type: row.item_type || null,
        category: row.category || null,
        subcategory: row.subcategory || null,
        rarity: row.rarity || null,
        description: row.description || null,
        source_type: row.source_type || null,
        source_book: row.source_book || null,
        price_source: row.price_source || null,
        shop_bucket: row.shop_bucket || null,
        metadata_json: row.metadata_json || null,
        quantity: Number(row.quantity || 1),
        listed_price_gp: Number(row.listed_price_gp || 0),
        minimum_price_gp: Number(row.minimum_price_gp || 0),
        barter_dc: Number(row.barter_dc || 0),
        sort_order: index,
      }));

      const { error: saveError } = await supabase.rpc('dm_world_replace_locale_shop_inventory', {
        p_shop_id: selectedShop.id,
        p_generation_seed: crypto.randomUUID(),
        p_rows: payload,
      });
      if (saveError) throw saveError;
      setStatus(regenerate ? 'Inventory regenerated.' : 'Inventory generated and saved.');
      await loadLocaleDetail(selectedLocaleId);
    } catch (saveError) {
      setError(saveError.message || 'Failed to generate inventory.');
    }
  }

  async function assignItemToFirstPlayer(row) {
    const receiverProfileId = players[0]?.id;
    if (!receiverProfileId || !row?.item_id) return;
    try {
      await inventoryDmAssignGeneratedShopItem({
        receiverProfileId,
        itemMasterId: row.item_id,
        quantity: 1,
        listedPriceGp: Number(row.listed_price_gp) || 0,
        minimumPriceGp: Number(row.minimum_price_gp) || 0,
        priceMode: 'listed',
        sourceContext: 'Locale shop inventory assignment',
      });
      setStatus(`Assigned ${row.item_name} to ${players[0]?.name}.`);
    } catch (assignError) {
      setError(assignError.message || 'Assignment failed.');
    }
  }

  useEffect(() => {
    setEditingNotes(localeDetail?.notes || '');
  }, [localeDetail?.id, localeDetail?.notes]);

  useEffect(() => {
    const activeShop = shops.find((entry) => entry.id === selectedShopId) || null;
    setEditingInventoryNotes(activeShop?.inventory_notes || '');
  }, [selectedShopId, shops]);

  if (loading) return <div className="empty-state">Loading locales…</div>;

  return (
    <div className="world-shops-shell">
      <div className="world-mobile-stack">
        {selectedLocaleId ? <button className="btn btn-ghost" onClick={() => { setSelectedLocaleId(null); setSelectedShopId(null); }}>← Back to Locales</button> : null}
        {!selectedLocaleId ? <button className="btn btn-primary" onClick={() => setEditingLocale({})}>New Locale</button> : null}
      </div>

      {status ? <div className="world-shops-import-status">{status}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}

      {!selectedLocaleId ? (
        <div className="world-card-grid">
          {locales.map((locale) => (
            <button key={locale.id} type="button" className="world-card world-card-button" onClick={() => { setSelectedLocaleId(locale.id); setSelectedLocaleTab('overview'); }}>
              <div className="world-card-head"><strong>{locale.name}</strong><span>{locale.locale_type}</span></div>
              <div className="world-card-body">{locale.short_description || 'No summary yet.'}</div>
              <div className="world-chip-row">
                <span className="world-chip">Districts {locale.districts_count || 0}</span>
                <span className="world-chip">Shops {locale.shops_count || 0}</span>
                <span className="world-chip">Notes {locale.notes_count || 0}</span>
              </div>
            </button>
          ))}
          {locales.length === 0 ? <div className="empty-state">No locales yet. Create your first world locale.</div> : null}
        </div>
      ) : (
        <>
          <div className="world-card">
            <div className="world-card-head">
              <strong>{localeDetail?.name || 'Locale'}</strong>
              <span>{localeDetail?.locale_type || 'Type'}</span>
            </div>
            <div className="world-card-body">{localeDetail?.short_description || 'No short description saved.'}</div>
            <div className="world-mobile-stack" style={{ marginTop: 6 }}>
              <button className="btn btn-ghost" onClick={() => setEditingLocale(localeDetail)}>Edit Locale</button>
            </div>
          </div>

          <div className="world-tabs-row">
            <button className="btn btn-ghost" data-active={selectedLocaleTab === 'overview'} onClick={() => setSelectedLocaleTab('overview')}>Overview</button>
            <button className="btn btn-ghost" data-active={selectedLocaleTab === 'districts'} onClick={() => setSelectedLocaleTab('districts')}>Districts</button>
            <button className="btn btn-ghost" data-active={selectedLocaleTab === 'shops'} onClick={() => setSelectedLocaleTab('shops')}>Shops</button>
            <button className="btn btn-ghost" data-active={selectedLocaleTab === 'notes'} onClick={() => setSelectedLocaleTab('notes')}>Notes</button>
          </div>

          {selectedLocaleTab === 'overview' ? (
            <div className="world-card-grid">
              <CollapsibleSection title="Politics & Leadership" value={localeDetail?.politics_leadership} />
              <CollapsibleSection title="Purpose" value={localeDetail?.purpose} />
              <CollapsibleSection title="Structure / Shape" value={localeDetail?.settlement_structure} />
              <CollapsibleSection title="Notable Features" value={localeDetail?.notable_features} />
              <CollapsibleSection title="Hidden / Underbelly" value={localeDetail?.hidden_or_underbelly_notes} />
              <CollapsibleSection title="Free Notes" value={localeDetail?.free_notes} />
            </div>
          ) : null}

          {selectedLocaleTab === 'districts' ? (
            <>
              <button className="btn btn-primary" onClick={() => setEditingDistrict({})}>New District</button>
              <div className="world-card-grid">
                {districts.map((district) => (
                  <button type="button" key={district.id} className="world-card world-card-button" onClick={() => setEditingDistrict(district)}>
                    <div className="world-card-head"><strong>{district.name}</strong></div>
                    <div className="world-card-body">{district.short_description || district.atmosphere_or_identity || 'No summary yet.'}</div>
                    {district.notable_locations ? <div className="world-card-body">Notable: {district.notable_locations.slice(0, 120)}</div> : null}
                  </button>
                ))}
                {districts.length === 0 ? <div className="empty-state">No districts yet.</div> : null}
              </div>
            </>
          ) : null}

          {selectedLocaleTab === 'shops' ? (
            <>
              {!selectedShopId ? <button className="btn btn-primary" onClick={() => setEditingShop({})}>New Shop</button> : null}
              {selectedShopId ? (
                <>
                  <button className="btn btn-ghost" onClick={() => setSelectedShopId(null)}>← Back to locale shops</button>
                  <div className="world-tabs-row">
                    <button className="btn btn-ghost" data-active={selectedShopTab === 'details'} onClick={() => setSelectedShopTab('details')}>Details</button>
                    <button className="btn btn-ghost" data-active={selectedShopTab === 'inventory'} onClick={() => setSelectedShopTab('inventory')}>Inventory</button>
                    <button className="btn btn-ghost" data-active={selectedShopTab === 'notes'} onClick={() => setSelectedShopTab('notes')}>Notes</button>
                  </div>

                  {selectedShopTab === 'details' ? (
                    <div className="world-card-grid">
                      <div className="world-card">
                        <div className="world-card-head"><strong>{selectedShop.shop_name}</strong><span>{selectedShop.shop_type.replace('_', ' ')}</span></div>
                        <div className="world-card-body">Affluence: {selectedShop.affluence_tier.replace('_', ' ')}</div>
                        {selectedShop.district_name ? <div className="world-card-body">District: {selectedShop.district_name}</div> : null}
                        {selectedShop.proprietor_name ? <div className="world-card-body">Proprietor: {selectedShop.proprietor_name}{selectedShop.proprietor_race ? ` (${selectedShop.proprietor_race})` : ''}</div> : null}
                        <button className="btn btn-ghost" onClick={() => setEditingShop(selectedShop)}>Edit Details</button>
                      </div>
                      <CollapsibleSection title="Proprietor Description" value={selectedShop.proprietor_description} />
                      <CollapsibleSection title="Exterior" value={selectedShop.exterior_description} />
                      <CollapsibleSection title="Interior" value={selectedShop.interior_description} />
                      <CollapsibleSection title="Shop Notes" value={selectedShop.shop_notes} />
                    </div>
                  ) : null}

                  {selectedShopTab === 'inventory' ? (
                    <>
                      <div className="world-mobile-stack">
                        <button className="btn btn-primary" onClick={() => handleGenerateInventory(false)} disabled={inventoryRows.length > 0}>Generate Stock</button>
                        <button className="btn btn-ghost" onClick={() => handleGenerateInventory(true)}>Regenerate Stock</button>
                      </div>
                      {inventoryRows.length === 0 ? <div className="empty-state">No stock yet. Generate inventory for this locale shop.</div> : null}
                      <div className="world-stock-list">
                        {inventoryRows.map((row) => (
                          <button type="button" key={row.id} className="world-stock-row" onClick={() => setSelectedInventoryItem(row)}>
                            <span className="item-name">{row.item_name}</span>
                            <span>{row.quantity}</span>
                            <span>{gpLabel(row.listed_price_gp)}</span>
                            <span>{gpLabel(row.minimum_price_gp)}</span>
                            <span>{row.barter_dc}</span>
                          </button>
                        ))}
                      </div>
                      {inventoryRows.length > 0 && players.length > 0 ? (
                        <button className="btn btn-ghost" onClick={() => assignItemToFirstPlayer(inventoryRows[0])}>Quick Assign First Item to {players[0].name}</button>
                      ) : null}
                    </>
                  ) : null}

                  {selectedShopTab === 'notes' ? (
                    <div className="world-card">
                      <textarea className="form-input" rows={8} value={editingInventoryNotes} onChange={(event) => setEditingInventoryNotes(event.target.value)} placeholder="DM inventory notes" />
                      <button className="btn btn-primary" onClick={saveShopInventoryNotes}>Save Notes</button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => setEditingShop({})}>New Shop</button>
                  <div className="world-card-grid">
                    {shops.map((shop) => (
                      <button key={shop.id} type="button" className="world-card world-card-button" onClick={() => { setSelectedShopId(shop.id); setSelectedShopTab('details'); }}>
                        <div className="world-card-head"><strong>{shop.shop_name}</strong><span>{shop.shop_type.replace('_', ' ')}</span></div>
                        <div className="world-chip-row">
                          <span className="world-chip">{shop.affluence_tier.replace('_', ' ')}</span>
                          <span className="world-chip">Stock {shop.inventory_count || 0}</span>
                          {shop.district_name ? <span className="world-chip">{shop.district_name}</span> : null}
                        </div>
                      </button>
                    ))}
                    {shops.length === 0 ? <div className="empty-state">No locale shops yet.</div> : null}
                  </div>
                </>
              )}
            </>
          ) : null}

          {selectedLocaleTab === 'notes' ? (
            <div className="world-card">
              <textarea className="form-input" rows={8} placeholder="General locale notes" value={editingNotes} onChange={(event) => setEditingNotes(event.target.value)} />
              <button className="btn btn-primary" onClick={saveLocaleNotes}>Save Notes</button>
            </div>
          ) : null}
        </>
      )}

      {editingLocale ? <LocaleEditor locale={editingLocale.id ? editingLocale : null} onCancel={() => setEditingLocale(null)} onSave={saveLocale} /> : null}
      {editingDistrict ? <DistrictEditor district={editingDistrict.id ? editingDistrict : null} onCancel={() => setEditingDistrict(null)} onSave={saveDistrict} /> : null}
      {editingShop ? <LocaleShopEditor shop={editingShop.id ? editingShop : null} districts={districts} onCancel={() => setEditingShop(null)} onSave={saveShop} /> : null}
      <LocaleShopItemModal item={selectedInventoryItem} onClose={() => setSelectedInventoryItem(null)} />
    </div>
  );
}
