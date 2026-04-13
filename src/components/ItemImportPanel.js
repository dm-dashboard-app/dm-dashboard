import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { buildSrdImportRows, buildSrdRepairRows, loadCustomSeedRows } from '../utils/shopItemImport';

async function loadLiveDegradedRows() {
  const { data, error } = await supabase
    .from('item_master')
    .select('id, external_key, source_slug, name, slug, item_type, category, subcategory, rarity, requires_attunement, description, base_price_gp, suggested_price_gp, price_source, source_type, source_book, rules_era, is_shop_eligible, shop_bucket, metadata_json')
    .eq('rules_era', '2014')
    .eq('source_type', 'official_srd_2014')
    .eq('metadata_json->>degraded_import', 'true')
    .order('name');
  if (error) throw error;
  return data || [];
}

export default function ItemImportPanel({ onImportComplete = null }) {
  const [importingMode, setImportingMode] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [error, setError] = useState('');

  async function refreshLiveDegradedSummary(prefix) {
    const liveRows = await loadLiveDegradedRows();
    if (liveRows.length === 0) {
      return `${prefix} Live degraded SRD report: 0 quarantined rows.`;
    }

    const repairPreview = await buildSrdRepairRows(liveRows);
    const unresolvedCount = Number(repairPreview.skippedCount || 0);
    const coveredCount = Number(repairPreview.repairedCount || 0);
    return `${prefix} Live degraded SRD report: ${liveRows.length} quarantined row${liveRows.length === 1 ? '' : 's'} (${coveredCount} overlay-covered / ${unresolvedCount} unresolved).`;
  }

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

      const status = isSrdMode
        ? await refreshLiveDegradedSummary(baseStatus)
        : baseStatus;
      setImportStatus(status);
      if (onImportComplete) await onImportComplete();
    } catch (importError) {
      setError(importError.message || 'Item import failed.');
      setImportStatus('');
    } finally {
      setImportingMode('');
    }
  }

  async function runRepairDegradedRows() {
    const confirmMessage = 'Repair currently quarantined degraded SRD rows using the curated repo overlay now? Only rows with trustworthy repair data will be upgraded.';
    if (!window.confirm(confirmMessage)) return;

    setImportingMode('repair');
    setError('');
    setImportStatus('Preparing degraded-row repair pass…');

    try {
      const degradedRows = await loadLiveDegradedRows();
      const repairResult = await buildSrdRepairRows(degradedRows);
      const repairRows = repairResult.rows || [];

      if (repairRows.length > 0) {
        const { error: importError } = await supabase.rpc('dm_import_item_master_rows', {
          p_import_mode: 'srd_2014',
          p_rows: repairRows,
        });
        if (importError) throw importError;
      }

      const status = await refreshLiveDegradedSummary(
        `Degraded repair complete: ${repairRows.length} row${repairRows.length === 1 ? '' : 's'} upgraded.`,
      );
      setImportStatus(status);
      if (onImportComplete) await onImportComplete();
    } catch (repairError) {
      setError(repairError.message || 'Degraded row repair failed.');
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
        <button
          className="btn btn-ghost"
          onClick={runRepairDegradedRows}
          disabled={importingMode !== ''}
        >
          {importingMode === 'repair' ? 'Repairing…' : 'Repair Degraded SRD Rows'}
        </button>
      </div>
      <div className="world-shops-import-help">
        SRD refresh automatically updates the live degraded SRD report from current quarantined item_master rows. Custom seed import loads curated rows from the repo seed file.
      </div>
      {importStatus ? <div className="world-shops-import-status">{importStatus}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}
    </div>
  );
}
