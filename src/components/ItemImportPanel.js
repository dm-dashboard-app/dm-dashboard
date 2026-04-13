import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { buildSrdImportRows, loadCustomSeedRows } from '../utils/shopItemImport';

const DEGRADED_REPORT_SETTING_KEY = 'shop_srd_degraded_report_2014';

async function loadLiveDegradedRows() {
  const { data, error } = await supabase
    .from('item_master')
    .select('external_key, source_slug, name, item_type, category, subcategory, is_shop_eligible, shop_bucket, price_source, metadata_json')
    .eq('rules_era', '2014')
    .eq('source_type', 'official_srd_2014')
    .eq('metadata_json->>degraded_import', 'true')
    .order('name');
  if (error) throw error;
  return data || [];
}

function buildDurableDegradedReport(rows = []) {
  const items = rows.map(row => ({
    external_key: row.external_key || null,
    source_slug: row.source_slug || null,
    name: row.name || null,
    item_type: row.item_type || null,
    category: row.category || null,
    subcategory: row.subcategory || null,
    shop_bucket: row.shop_bucket || null,
    is_shop_eligible: !!row.is_shop_eligible,
    price_source: row.price_source || null,
    degraded_reason: row?.metadata_json?.degraded_reason || null,
  }));

  return {
    version: '2026-04-13',
    generated_at: new Date().toISOString(),
    source: 'item_master degraded/quarantined SRD rows',
    item_count: items.length,
    items,
  };
}

async function writeDurableReport(report) {
  const attempts = [
    { payload: { key: DEGRADED_REPORT_SETTING_KEY, value_json: report }, onConflict: 'key' },
    { payload: { key: DEGRADED_REPORT_SETTING_KEY, value: report }, onConflict: 'key' },
    { payload: { setting_key: DEGRADED_REPORT_SETTING_KEY, setting_value_json: report }, onConflict: 'setting_key' },
    { payload: { setting_key: DEGRADED_REPORT_SETTING_KEY, setting_value: report }, onConflict: 'setting_key' },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { error } = await supabase.from('app_settings').upsert(attempt.payload, { onConflict: attempt.onConflict });
    if (!error) return;
    lastError = error;
  }

  throw lastError || new Error('Unable to persist degraded report in app_settings.');
}

async function regenerateDurableDegradedReport() {
  const liveRows = await loadLiveDegradedRows();
  const report = buildDurableDegradedReport(liveRows);
  await writeDurableReport(report);
  return report;
}

export default function ItemImportPanel({ onImportComplete = null }) {
  const [importingMode, setImportingMode] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [error, setError] = useState('');

  async function runImport(mode) {
    const isSrdMode = mode === 'srd';
    const confirmMessage = isSrdMode
      ? 'Refresh the 2014 SRD catalog into item_master now? This may take a minute.'
      : 'Import curated custom seed rows from docs/data/shop_custom_items_seed_2014.json now?';
    if (!window.confirm(confirmMessage)) return;

    setImportingMode(mode);
    setError('');
    setImportStatus(isSrdMode ? 'Preparing SRD 2014 import…' : 'Preparing custom seed import…');

    try {
      const srdResult = isSrdMode
        ? await buildSrdImportRows(message => setImportStatus(message))
        : null;
      const rows = isSrdMode ? (srdResult?.rows || []) : await loadCustomSeedRows();

      const { data, error: importError } = await supabase.rpc('dm_import_item_master_rows', {
        p_import_mode: isSrdMode ? 'srd_2014' : 'custom_seed_2014',
        p_rows: rows,
      });
      if (importError) throw importError;

      const rpcResult = Array.isArray(data) ? (data[0] || {}) : (data || {});
      const importedCount = Number(rpcResult.imported_rows || 0);
      const eligibleCount = Number(rpcResult.shop_eligible_rows || 0);
      const baseStatus = importedCount === 0
        ? (isSrdMode
          ? 'SRD import ran, but no rows were loaded. Check RPC logs and source connectivity.'
          : 'Custom seed import ran with 0 rows. Seed file is intentionally empty by default; add your own curated items when ready.')
        : `${isSrdMode ? 'SRD 2014 import' : 'Custom seed import'} complete: ${importedCount} rows loaded (${eligibleCount} shop-eligible).`;

      if (isSrdMode) {
        const report = await regenerateDurableDegradedReport();
        setImportStatus(`${baseStatus} Durable degraded report updated: ${report.item_count} quarantined row${report.item_count === 1 ? '' : 's'} (stored in app_settings as ${DEGRADED_REPORT_SETTING_KEY}).`);
      } else {
        setImportStatus(baseStatus);
      }

      if (onImportComplete) await onImportComplete();
    } catch (importError) {
      setError(importError.message || 'Item import failed.');
      setImportStatus('');
    } finally {
      setImportingMode('');
    }
  }

  return (
    <div className="world-shops-import-panel">
      <div className="world-shops-panel-title">Catalog Import / Refresh</div>
      <div className="world-shops-import-row">
        <button
          className="btn btn-primary"
          onClick={() => runImport('srd')}
          disabled={importingMode !== ''}
        >
          {importingMode === 'srd' ? 'Refreshing SRD…' : 'Refresh 2014 SRD Catalog'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => runImport('custom')}
          disabled={importingMode !== ''}
        >
          {importingMode === 'custom' ? 'Importing Seed…' : 'Import Custom Seed'}
        </button>
      </div>
      <div className="world-shops-import-help">
        SRD refresh imports catalog rows, then writes a durable degraded-row report from current quarantined SRD rows into app_settings.
      </div>
      {importStatus ? <div className="world-shops-import-status">{importStatus}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}
    </div>
  );
}
