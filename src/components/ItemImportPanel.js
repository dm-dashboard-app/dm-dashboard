import React, { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { applySrdRepairsToImportRows, buildSrdImportRows, load5etoolsSourceSplitRows, loadCustomSeedRows } from '../utils/shopItemImport';

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
  const [degradedRows, setDegradedRows] = useState([]);
  const [loadingDegradedRows, setLoadingDegradedRows] = useState(false);
  const [degradedRowsError, setDegradedRowsError] = useState('');
  const [lastFetchFailures, setLastFetchFailures] = useState([]);

  const degradedSummary = useMemo(() => buildLiveDegradedSummary(degradedRows), [degradedRows]);
  const degradedRowsExportJson = useMemo(() => JSON.stringify(degradedRows, null, 2), [degradedRows]);

  async function refreshDegradedRows() {
    setLoadingDegradedRows(true);
    setDegradedRowsError('');
    try {
      const rows = await loadLiveDegradedRows();
      setDegradedRows(rows);
    } catch (refreshError) {
      setDegradedRowsError(refreshError.message || 'Failed to load live degraded SRD rows.');
    } finally {
      setLoadingDegradedRows(false);
    }
  }

  function downloadDegradedRowsJson() {
    const blob = new Blob([degradedRowsExportJson], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'degraded-srd-item-master-rows.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function copyDegradedRowsJson() {
    try {
      await navigator.clipboard.writeText(degradedRowsExportJson);
    } catch (_) {
      window.prompt('Copy degraded SRD rows JSON:', degradedRowsExportJson);
    }
  }

  async function runImport(mode) {
    const isSrdMode = mode === 'srd';
    const is5etoolsMode = mode === 'five_tools';
    const confirmMessage = isSrdMode
      ? 'Refresh the 2014 SRD catalog into item_master now? This may take a minute.'
      : (is5etoolsMode
        ? 'Import converted curated 5etools source-split rows into item_master now?'
        : 'Import curated custom seed rows from docs/data/shop_custom_items_seed_2014.json now?');
    if (!window.confirm(confirmMessage)) return;

    setImportingMode(mode);
    setError('');
    if (isSrdMode) setLastFetchFailures([]);
    setImportStatus(
      isSrdMode
        ? 'Preparing SRD 2014 import…'
        : (is5etoolsMode ? 'Preparing converted 5etools source-split import…' : 'Preparing custom seed import…'),
    );

    try {
      const srdResult = isSrdMode
        ? await buildSrdImportRows(message => setImportStatus(message))
        : null;
      const repairedSrdResult = isSrdMode
        ? await applySrdRepairsToImportRows(srdResult?.rows || [])
        : null;
      const rows = isSrdMode
        ? (repairedSrdResult?.rows || [])
        : (is5etoolsMode ? await load5etoolsSourceSplitRows() : await loadCustomSeedRows());

      const { data, error: importError } = await supabase.rpc('dm_import_item_master_rows', {
        p_import_mode: isSrdMode ? 'srd_2014' : 'custom_seed_2014',
        p_rows: rows,
      });
      if (importError) throw importError;

      const rpcResult = Array.isArray(data) ? (data[0] || {}) : (data || {});
      const importedCount = Number(rpcResult.imported_rows || 0);
      const eligibleCount = Number(rpcResult.shop_eligible_rows || 0);
      const repairStatus = isSrdMode
        ? ` Overlay repair applied ${Number(repairedSrdResult?.repairedCount || 0)} / ${Number(repairedSrdResult?.degradedCount || 0)} degraded row${Number(repairedSrdResult?.degradedCount || 0) === 1 ? '' : 's'} before import.`
        : '';
      const transientFailureCount = Number(srdResult?.fetchFailureCount || 0);
      const transientFailureStatus = isSrdMode
        ? ` Transient detail fetch failures this run: ${transientFailureCount}.`
        : '';
      const baseStatus = importedCount === 0
        ? (isSrdMode
          ? `SRD import ran, but no rows were loaded. Check RPC logs and source connectivity.${transientFailureStatus}`
          : (is5etoolsMode
            ? 'Converted 5etools import ran with 0 rows. Regenerate docs/data/shop_5etools_items_source_split_2014.json if needed.'
            : 'Custom seed import ran with 0 rows. Seed file is intentionally empty by default; add your own curated items when ready.'))
        : `${isSrdMode ? 'SRD 2014 import' : (is5etoolsMode ? 'Converted 5etools import' : 'Custom seed import')} complete: ${importedCount} rows loaded (${eligibleCount} shop-eligible).${repairStatus}${transientFailureStatus}`;

      if (isSrdMode) {
        setLastFetchFailures(srdResult?.fetchFailures || []);
        const nextDegradedRows = await loadLiveDegradedRows();
        setDegradedRows(nextDegradedRows);
        const summary = buildLiveDegradedSummary(nextDegradedRows);
        setImportStatus(
          `${baseStatus} Persisted unresolved DB rows: ${summary.count} quarantined row${summary.count === 1 ? '' : 's'} in current item_master (${summary.unresolvedCount} unresolved).`,
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
          onClick={() => runImport('five_tools')}
          disabled={importingMode !== ''}
        >
          {importingMode === 'five_tools' ? 'Importing 5etools…' : 'Import Curated 5etools Items'}
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
        SRD refresh imports catalog rows, converted 5etools import loads repo-generated app-shaped rows, then reports the live degraded/quarantined SRD row set from current item_master.
      </div>
      {importStatus ? <div className="world-shops-import-status">{importStatus}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}
      <div className="panel session-subpanel" style={{ marginTop: 10 }}>
        <div className="panel-title">Transient SRD Detail Fetch Failures (Last Refresh)</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          These failures happened during the most recent SRD refresh and were not persisted to item_master.
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {lastFetchFailures.length} transient fetch failure{lastFetchFailures.length === 1 ? '' : 's'}.
        </div>
        {lastFetchFailures.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lastFetchFailures.map((row, index) => (
              <div key={`${row.url || row.name || 'failure'}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-panel-2)', display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{row.name || row.index || 'Unnamed SRD item'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  kind: {row.kind || '—'} • index: {row.index || '—'} • url: {row.url || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  reason: {row.reason || 'Unknown detail fetch failure.'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 0 }}>
            No transient detail fetch failures recorded in this session yet.
          </div>
        )}
      </div>

      <div className="panel session-subpanel" style={{ marginTop: 10 }}>
        <div className="panel-title">Live Degraded SRD Rows</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Source-of-truth list from current item_master rows where metadata_json.degraded_import is true.
        </div>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={refreshDegradedRows} disabled={loadingDegradedRows}>
            {loadingDegradedRows ? 'Loading…' : 'View degraded SRD rows'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyDegradedRowsJson} disabled={degradedRows.length === 0}>
            Copy JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={downloadDegradedRowsJson} disabled={degradedRows.length === 0}>
            Export JSON
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {degradedSummary.count} degraded/quarantined row{degradedSummary.count === 1 ? '' : 's'} ({degradedSummary.unresolvedCount} unresolved).
        </div>
        {degradedRowsError ? <div className="world-shops-error">{degradedRowsError}</div> : null}
        {degradedRows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {degradedRows.map(row => (
              <div key={row.external_key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-panel-2)', display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.external_key}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{row.name || 'Unnamed row'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  source_slug: {row.source_slug || '—'} • item_type: {row.item_type || '—'} • category: {row.category || '—'} • subcategory: {row.subcategory || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  shop_bucket: {row.shop_bucket || '—'} • price_source: {row.price_source || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  degraded_reason: {row?.metadata_json?.degraded_reason || '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 0 }}>
            No live degraded SRD rows loaded yet. Use “View degraded SRD rows”.
          </div>
        )}
      </div>
    </div>
  );
}
