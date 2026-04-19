import React, { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { load5etoolsSourceSplitRows } from '../utils/shopItemImport';
import { build5etoolsReviewReport } from '../utils/fiveToolsReviewReport';

async function loadLiveImportedRows() {
  const { data, error } = await supabase
    .from('item_master')
    .select('external_key, source_type, source_book, source_slug, name, item_type, category, subcategory, is_shop_eligible, shop_bucket, price_source, base_price_gp, suggested_price_gp, metadata_json')
    .eq('rules_era', '2014')
    .eq('source_type', 'custom_homebrew_private_seed')
    .in('metadata_json->>source_layer', [
      '5etools_items_by_source_curated',
      '5etools_items_by_source_curated_generated_canonical_enhancements',
    ])
    .order('name');
  if (error) throw error;
  return data || [];
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
    || shopBucket === 'still_unpriced_but_priceable'
    || shopBucket === 'manual_only_forever'
  );
}

function buildImportSummary(rows = []) {
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
    p_import_mode: is5etoolsMode ? 'five_tools_2014' : (isSrdMode ? 'srd_2014' : 'custom_seed_2014'),
    p_rows: rows,
    p_import_meta: is5etoolsMode ? (importMeta || null) : null,
  };
}

export default function ItemImportPanel({ onImportComplete = null }) {
  const [importingMode, setImportingMode] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [error, setError] = useState('');
  const [importedRows, setImportedRows] = useState([]);
  const [loadingImportedRows, setLoadingImportedRows] = useState(false);
  const [importedRowsError, setImportedRowsError] = useState('');
  const [showImportedRowsList, setShowImportedRowsList] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  const importSummary = useMemo(() => buildImportSummary(importedRows), [importedRows]);
  const importReviewReport = useMemo(() => build5etoolsReviewReport(importedRows), [importedRows]);
  const importedRowsExportJson = useMemo(() => JSON.stringify(importedRows, null, 2), [importedRows]);
  const importReportExportJson = useMemo(() => JSON.stringify(importReviewReport, null, 2), [importReviewReport]);

  async function refreshImportedRows() {
    setLoadingImportedRows(true);
    setImportedRowsError('');
    try {
      const rows = await loadLiveImportedRows();
      setImportedRows(rows);
    } catch (refreshError) {
      setImportedRowsError(refreshError.message || 'Failed to load live imported item rows.');
    } finally {
      setLoadingImportedRows(false);
    }
  }

  function downloadImportedRowsJson() {
    const blob = new Blob([importedRowsExportJson], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'imported-item-master-rows.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function downloadImportReportJson() {
    const blob = new Blob([importReportExportJson], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'imported-item-review-report.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function copyImportedRowsJson() {
    try {
      await navigator.clipboard.writeText(importedRowsExportJson);
    } catch (_) {
      window.prompt('Copy imported item rows JSON:', importedRowsExportJson);
    }
  }

  async function copyImportReportJson() {
    try {
      await navigator.clipboard.writeText(importReportExportJson);
    } catch (_) {
      window.prompt('Copy imported item review report JSON:', importReportExportJson);
    }
  }

  async function runImport() {
    if (!window.confirm('Import converted curated item rows into item_master now?')) return;

    setImportingMode('five_tools');
    setError('');
    setImportStatus('Preparing converted item import...');

    try {
      const importBundle = await load5etoolsSourceSplitRows({ withMeta: true });
      const rows = importBundle?.rows || [];
      const importMeta = importBundle?.importMeta || null;

      const { data, error: importError } = await supabase.rpc(
        'dm_import_item_master_rows',
        buildItemImportRpcArgs({ is5etoolsMode: true, rows, importMeta }),
      );
      if (importError) throw importError;

      const rpcResult = Array.isArray(data) ? (data[0] || {}) : (data || {});
      const importedCount = Number(rpcResult.imported_rows || 0);
      const eligibleCount = Number(rpcResult.shop_eligible_rows || 0);
      const baseStatus = importedCount === 0
        ? 'Converted item import ran with 0 rows. Regenerate docs/data/shop_5etools_items_source_split_2014.json if needed.'
        : `Item import complete: ${importedCount} rows loaded (${eligibleCount} shop-eligible).`;
      setImportStatus(baseStatus);
      setShowReviewPanel(true);
      await refreshImportedRows();

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
          style={{ width: '100%' }}
          onClick={runImport}
          disabled={importingMode !== ''}
        >
          {importingMode === 'five_tools' ? 'Importing Items...' : 'Import Items'}
        </button>
        <button type="button" className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowReviewPanel((curr) => !curr)}>
          {showReviewPanel ? 'Hide Import Review' : 'Show Import Review'}
        </button>
      </div>
      {importStatus ? <div className="world-shops-import-status">{importStatus}</div> : null}
      {error ? <div className="world-shops-error">{error}</div> : null}

      {showReviewPanel ? (
        <div className="panel session-subpanel world-shops-import-review-panel" style={{ marginTop: 10 }}>
        <div className="panel-title">Live Imported Item Rows</div>
        <div className="world-shops-import-actions">
          <button type="button" className="btn btn-ghost" onClick={refreshImportedRows} disabled={loadingImportedRows}>
            {loadingImportedRows ? 'Loading...' : 'View imported rows'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyImportedRowsJson} disabled={importedRows.length === 0}>
            Copy Rows JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={downloadImportedRowsJson} disabled={importedRows.length === 0}>
            Export Rows JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyImportReportJson} disabled={importedRows.length === 0}>
            Copy Structured Report
          </button>
          <button type="button" className="btn btn-ghost" onClick={downloadImportReportJson} disabled={importedRows.length === 0}>
            Export Structured Report
          </button>
        </div>
        <div className="world-shops-import-stats-grid">
          <div className="world-shops-import-stat-card">
            <div className="world-shops-import-stat-label">Imported Rows</div>
            <div className="world-shops-import-stat-value">{importSummary.count}</div>
          </div>
          <div className="world-shops-import-stat-card">
            <div className="world-shops-import-stat-label">Shop Eligible</div>
            <div className="world-shops-import-stat-value">{importSummary.shopEligibleCount}</div>
          </div>
          <div className="world-shops-import-stat-card">
            <div className="world-shops-import-stat-label">Null Base Price</div>
            <div className="world-shops-import-stat-value">{importSummary.nullBasePriceCount}</div>
          </div>
          <div className="world-shops-import-stat-card">
            <div className="world-shops-import-stat-label">Weak Pricing</div>
            <div className="world-shops-import-stat-value">{importSummary.weakPricingCount}</div>
          </div>
        </div>
        <div className="world-shops-import-report-grid">
          <div className="world-shops-import-report-block">
            <div className="world-shops-import-report-title">Pricing Sources</div>
            <div className="world-shops-import-report-line">
            priced by source → direct: {importReviewReport.counts.direct_source_priced} • overlay: {importReviewReport.counts.overlay_priced} • fallback: {importReviewReport.counts.fallback_priced}
            </div>
          </div>
          <div className="world-shops-import-report-block">
            <div className="world-shops-import-report-title">Unresolved</div>
            <div className="world-shops-import-report-line">
            unresolved/unpriced: {importReviewReport.counts.unresolved_unpriced} • overlay-excluded: {importReviewReport.counts.overlay_excluded} • should-be-priced-not-matched: {importReviewReport.counts.should_be_priced_but_not_matched}
            </div>
          </div>
          <div className="world-shops-import-report-block">
            <div className="world-shops-import-report-title">Policy Buckets</div>
            <div className="world-shops-import-report-line">
            final policy buckets → manual_only_forever: {importReviewReport.counts.manual_only_forever} • curated_magic_nondefault: {importReviewReport.counts.curated_magic_nondefault} • curated_magic_shop_stock: {importReviewReport.counts.curated_magic_shop_stock} • still_unpriced_but_priceable: {importReviewReport.counts.still_unpriced_but_priceable}
            </div>
          </div>
          <div className="world-shops-import-report-block">
            <div className="world-shops-import-report-title">Shop Admission</div>
            <div className="world-shops-import-report-line">
            should-never-default-to-shop: {importReviewReport.counts.should_never_default_to_shop} • policy-demoted non-shop: {importReviewReport.counts.policy_demoted_non_shop} • shop-eligible: {importReviewReport.counts.shop_eligible} • non-shop: {importReviewReport.counts.non_shop}
            </div>
          </div>
          <div className="world-shops-import-report-block">
            <div className="world-shops-import-report-title">Mechanics Coverage</div>
            <div className="world-shops-import-report-line">
            mechanics → structured: {importReviewReport.counts.rows_with_structured_mechanics} • null: {importReviewReport.counts.rows_with_null_mechanics} • attunement=true: {importReviewReport.counts.rows_with_attunement_true} • phase1-compatible payload: {importReviewReport.counts.rows_with_phase1_compatible_payload}
            </div>
          </div>
        </div>

        <div className="world-shops-import-breakdown-grid">
          <div className="world-shops-import-breakdown-line">
            by item_type:{' '}
            {Object.entries(importSummary.byItemType).map(([key, count]) => `${key}: ${count}`).join(' • ') || '—'}
          </div>
          <div className="world-shops-import-breakdown-line">
            by mechanics_support:{' '}
            {Object.entries(importSummary.byMechanicsSupport).map(([key, count]) => `${key}: ${count}`).join(' • ') || '—'}
          </div>
          <div className="world-shops-import-breakdown-line">
            by shop_bucket:{' '}
            {Object.entries(importSummary.byShopBucket).map(([key, count]) => `${key}: ${count}`).join(' • ') || '—'}
          </div>
        </div>
        {importedRowsError ? <div className="world-shops-error">{importedRowsError}</div> : null}
        <div className="world-shops-import-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowImportedRowsList((curr) => !curr)}
            disabled={importedRows.length === 0}
          >
            {showImportedRowsList ? 'Hide Imported Rows List' : `Show Imported Rows List (${importedRows.length})`}
          </button>
        </div>
        {importedRows.length > 0 ? (
          <div style={{ display: showImportedRowsList ? 'flex' : 'none', flexDirection: 'column', gap: 8 }}>
            {importedRows.map(row => (
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
            No live imported rows loaded yet. Use “View imported rows”.
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}
