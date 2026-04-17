import React, { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { applySrdRepairsToImportRows, buildSrdImportRows, load5etoolsSourceSplitRows, loadCustomSeedRows } from '../utils/shopItemImport';
import { build5etoolsReviewReport } from '../utils/fiveToolsReviewReport';

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

async function loadLive5etoolsImportedRows() {
  const { data, error } = await supabase
    .from('item_master')
    .select('external_key, source_type, source_book, source_slug, name, item_type, category, subcategory, is_shop_eligible, shop_bucket, price_source, base_price_gp, suggested_price_gp, metadata_json')
    .eq('rules_era', '2014')
    .eq('source_type', 'custom_homebrew_private_seed')
    .eq('metadata_json->>source_layer', '5etools_items_by_source_curated')
    .ilike('external_key', '5etools_items_by_source_curated:%')
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

function incrementCount(counter, key) {
  const normalized = String(key || 'unknown').trim() || 'unknown';
  return {
    ...counter,
    [normalized]: Number(counter[normalized] || 0) + 1,
  };
}

function isWeakPricingRow(row = {}) {
  const shopBucket = String(row?.shop_bucket || '').toLowerCase();
  const priceSource = String(row?.price_source || '').toLowerCase();
  return (
    row?.base_price_gp == null
    || row?.suggested_price_gp == null
    || !priceSource
    || shopBucket === 'unpriced'
    || shopBucket === 'manual_magic_review'
  );
}

function build5etoolsImportSummary(rows = []) {
  return rows.reduce((summary, row) => ({
    count: summary.count + 1,
    shopEligibleCount: summary.shopEligibleCount + (row?.is_shop_eligible ? 1 : 0),
    nullBasePriceCount: summary.nullBasePriceCount + (row?.base_price_gp == null ? 1 : 0),
    nullSuggestedPriceCount: summary.nullSuggestedPriceCount + (row?.suggested_price_gp == null ? 1 : 0),
    weakPricingCount: summary.weakPricingCount + (isWeakPricingRow(row) ? 1 : 0),
    byItemType: incrementCount(summary.byItemType, row?.item_type),
    byMechanicsSupport: incrementCount(summary.byMechanicsSupport, row?.metadata_json?.mechanics_support),
    byShopBucket: incrementCount(summary.byShopBucket, row?.shop_bucket),
  }), {
    count: 0,
    shopEligibleCount: 0,
    nullBasePriceCount: 0,
    nullSuggestedPriceCount: 0,
    weakPricingCount: 0,
    byItemType: {},
    byMechanicsSupport: {},
    byShopBucket: {},
  });
}

export function buildItemImportRpcArgs({ isSrdMode = false, is5etoolsMode = false, rows = [], importMeta = null } = {}) {
  return {
    p_import_mode: isSrdMode ? 'srd_2014' : (is5etoolsMode ? 'five_tools_2014' : 'custom_seed_2014'),
    p_rows: rows,
    p_import_meta: is5etoolsMode ? (importMeta || null) : null,
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
  const [fiveToolsRows, setFiveToolsRows] = useState([]);
  const [loadingFiveToolsRows, setLoadingFiveToolsRows] = useState(false);
  const [fiveToolsRowsError, setFiveToolsRowsError] = useState('');

  const degradedSummary = useMemo(() => buildLiveDegradedSummary(degradedRows), [degradedRows]);
  const degradedRowsExportJson = useMemo(() => JSON.stringify(degradedRows, null, 2), [degradedRows]);
  const fiveToolsSummary = useMemo(() => build5etoolsImportSummary(fiveToolsRows), [fiveToolsRows]);
  const fiveToolsReviewReport = useMemo(() => build5etoolsReviewReport(fiveToolsRows), [fiveToolsRows]);
  const fiveToolsRowsExportJson = useMemo(() => JSON.stringify(fiveToolsRows, null, 2), [fiveToolsRows]);
  const fiveToolsReportExportJson = useMemo(() => JSON.stringify(fiveToolsReviewReport, null, 2), [fiveToolsReviewReport]);

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

  async function refresh5etoolsRows() {
    setLoadingFiveToolsRows(true);
    setFiveToolsRowsError('');
    try {
      const rows = await loadLive5etoolsImportedRows();
      setFiveToolsRows(rows);
    } catch (refreshError) {
      setFiveToolsRowsError(refreshError.message || 'Failed to load live imported 5etools rows.');
    } finally {
      setLoadingFiveToolsRows(false);
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

  function download5etoolsRowsJson() {
    const blob = new Blob([fiveToolsRowsExportJson], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'imported-5etools-item-master-rows.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function download5etoolsReportJson() {
    const blob = new Blob([fiveToolsReportExportJson], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'imported-5etools-review-report.json';
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

  async function copy5etoolsRowsJson() {
    try {
      await navigator.clipboard.writeText(fiveToolsRowsExportJson);
    } catch (_) {
      window.prompt('Copy imported 5etools rows JSON:', fiveToolsRowsExportJson);
    }
  }

  async function copy5etoolsReportJson() {
    try {
      await navigator.clipboard.writeText(fiveToolsReportExportJson);
    } catch (_) {
      window.prompt('Copy imported 5etools review report JSON:', fiveToolsReportExportJson);
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
      const fiveToolsImportBundle = is5etoolsMode
        ? await load5etoolsSourceSplitRows({ withMeta: true })
        : null;
      const rows = isSrdMode
        ? (repairedSrdResult?.rows || [])
        : (is5etoolsMode ? (fiveToolsImportBundle?.rows || []) : await loadCustomSeedRows());
      const importMeta = is5etoolsMode ? (fiveToolsImportBundle?.importMeta || null) : null;

      const { data, error: importError } = await supabase.rpc(
        'dm_import_item_master_rows',
        buildItemImportRpcArgs({ isSrdMode, is5etoolsMode, rows, importMeta }),
      );
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
        <div className="panel-title">Live Imported 5etools Rows</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Source-of-truth list from current item_master rows imported via the curated 5etools lane (source_layer 5etools_items_by_source_curated).
        </div>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={refresh5etoolsRows} disabled={loadingFiveToolsRows}>
            {loadingFiveToolsRows ? 'Loading…' : 'View imported 5etools rows'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copy5etoolsRowsJson} disabled={fiveToolsRows.length === 0}>
            Copy Rows JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={download5etoolsRowsJson} disabled={fiveToolsRows.length === 0}>
            Export Rows JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={copy5etoolsReportJson} disabled={fiveToolsRows.length === 0}>
            Copy Structured Report
          </button>
          <button type="button" className="btn btn-ghost" onClick={download5etoolsReportJson} disabled={fiveToolsRows.length === 0}>
            Export Structured Report
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, display: 'grid', gap: 4 }}>
          <div>{fiveToolsSummary.count} imported row{fiveToolsSummary.count === 1 ? '' : 's'} total.</div>
          <div>{fiveToolsSummary.shopEligibleCount} shop-eligible.</div>
          <div>{fiveToolsSummary.nullBasePriceCount} with null base_price_gp • {fiveToolsSummary.nullSuggestedPriceCount} with null suggested_price_gp.</div>
          <div>{fiveToolsSummary.weakPricingCount} flagged as weak pricing.</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, display: 'grid', gap: 4 }}>
          <div>structured report slices (for ChatGPT follow-up):</div>
          <div>
            priced by source → direct: {fiveToolsReviewReport.counts.direct_source_priced} • overlay: {fiveToolsReviewReport.counts.overlay_priced} • fallback: {fiveToolsReviewReport.counts.fallback_priced}
          </div>
          <div>
            unresolved/unpriced: {fiveToolsReviewReport.counts.unresolved_unpriced} • overlay-excluded: {fiveToolsReviewReport.counts.overlay_excluded} • should-be-priced-not-matched: {fiveToolsReviewReport.counts.should_be_priced_but_not_matched}
          </div>
          <div>
            should-never-default-to-shop: {fiveToolsReviewReport.counts.should_never_default_to_shop} • policy-demoted non-shop: {fiveToolsReviewReport.counts.policy_demoted_non_shop} • shop-eligible: {fiveToolsReviewReport.counts.shop_eligible} • non-shop: {fiveToolsReviewReport.counts.non_shop}
          </div>
          <div>
            mechanics → structured: {fiveToolsReviewReport.counts.rows_with_structured_mechanics} • null: {fiveToolsReviewReport.counts.rows_with_null_mechanics} • attunement=true: {fiveToolsReviewReport.counts.rows_with_attunement_true} • phase1-compatible payload: {fiveToolsReviewReport.counts.rows_with_phase1_compatible_payload}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'grid', gap: 4 }}>
          <div>
            by item_type:{' '}
            {Object.entries(fiveToolsSummary.byItemType).map(([key, count]) => `${key}: ${count}`).join(' • ') || '—'}
          </div>
          <div>
            by mechanics_support:{' '}
            {Object.entries(fiveToolsSummary.byMechanicsSupport).map(([key, count]) => `${key}: ${count}`).join(' • ') || '—'}
          </div>
          <div>
            by shop_bucket:{' '}
            {Object.entries(fiveToolsSummary.byShopBucket).map(([key, count]) => `${key}: ${count}`).join(' • ') || '—'}
          </div>
        </div>
        {fiveToolsRowsError ? <div className="world-shops-error">{fiveToolsRowsError}</div> : null}
        {fiveToolsRows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fiveToolsRows.map(row => (
              <div key={row.external_key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-panel-2)', display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.external_key}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{row.name || 'Unnamed row'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  item_type: {row.item_type || '—'} • category: {row.category || '—'} • subcategory: {row.subcategory || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  shop_eligible: {row.is_shop_eligible ? 'true' : 'false'} • shop_bucket: {row.shop_bucket || '—'} • mechanics_support: {row?.metadata_json?.mechanics_support || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  base_price_gp: {row.base_price_gp ?? '—'} • suggested_price_gp: {row.suggested_price_gp ?? '—'} • price_source: {row.price_source || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  source_type: {row.source_type || '—'} • source_book: {row.source_book || '—'} • source_slug: {row.source_slug || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  source_key: {row?.metadata_json?.source_key || '—'} • source_filename: {row?.metadata_json?.source_filename || '—'} • source_page: {row?.metadata_json?.source_page ?? '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 0 }}>
            No live imported 5etools rows loaded yet. Use “View imported 5etools rows”.
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
