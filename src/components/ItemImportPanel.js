import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { buildSrdImportRows, loadCustomSeedRows } from '../utils/shopItemImport';

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

function buildLiveDegradedSummary(rows = []) {
  const unresolved = rows.filter(row => !row?.metadata_json?.repaired_from_overlay).length;
  return {
    count: rows.length,
    unresolvedCount: unresolved,
  };
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
        const degradedRows = await loadLiveDegradedRows();
        const summary = buildLiveDegradedSummary(degradedRows);
        setImportStatus(
          `${baseStatus} Live degraded SRD report: ${summary.count} quarantined row${summary.count === 1 ? '' : 's'} in current item_master (${summary.unresolvedCount} unresolved).`,
        );
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
        SRD refresh imports catalog rows, then reports the live degraded/quarantined SRD row set from current item_master.
      </div>
      {importStatus ? <div className="world-shops-import-status">{importStatus}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}
    </div>
  );
}
