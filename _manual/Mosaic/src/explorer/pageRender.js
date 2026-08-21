import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs } from '../render/breadcrumbs.js';
import { renderPageParamsForm } from '../render/pageParams.js';
import { renderBlock } from '../render/pageBlocks.js';
import { sendHtml } from '../http/respond.js';
import { HttpError } from '../http/errors.js';
import { findSqlSource, getSqlAdapter } from './sqlSourceContext.js';
import { allFormDefs, resolveParamValues, blockIsBlockedByParams } from '../pages/pageParams.js';
import { executeBlock, executeTableBlock, describeTableBlockColumns } from '../pages/blockExecutor.js';
import { parseBlockBrowseParams } from '../pages/blockBrowseParams.js';
import { createLimiter } from '../pages/concurrencyLimiter.js';
import { referencedParamNames } from '../config/pages.js';
import { exportRows } from './export.js';

function findPage(pages, invalidPages, pageId) {
  if (pages.has(pageId)) return pages.get(pageId);
  if (invalidPages.has(pageId)) {
    const diag = invalidPages.get(pageId);
    const detail = diag.issues?.map((i) => `${i.path}: ${i.message}`).join('; ');
    throw new HttpError(503, `This page is misconfigured and unavailable: ${diag.reason}${detail ? ` (${detail})` : ''}`);
  }
  throw new HttpError(404, 'Page not found.');
}

function readBlockSql(page, block) {
  return fs.readFileSync(path.resolve(page.dir, block.query), 'utf8');
}

function blockPageState(url, blockId, defaultPageSize) {
  const page = Number(url.searchParams.get(`b_${blockId}_page`));
  const pageSizeRaw = Number(url.searchParams.get(`b_${blockId}_pageSize`));
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : defaultPageSize,
  };
}

export async function handlePageRender(req, res, params, { sources, pages, invalidPages, settings, url, logger, requestId }) {
  const page = findPage(pages, invalidPages, params.pageId);
  const defs = allFormDefs(page);
  const paramValues = resolveParamValues(defs, url.searchParams);

  // A single block can request its own export instead of a full page render.
  const exportBlockId = [...url.searchParams.keys()].find((k) => k.endsWith('_export') && k.startsWith('b_'));
  if (exportBlockId) {
    const blockId = exportBlockId.slice(2, -'_export'.length);
    const format = url.searchParams.get(exportBlockId);
    const block = page.blocks.find((b) => b.id === blockId);
    if (block && (format === 'csv' || format === 'json') && ((format === 'csv' && block.allowCsvExport) || (format === 'json' && block.allowJsonExport))) {
      const source = findSqlSource(sources, block.sourceId);
      const adapter = getSqlAdapter(source, settings);
      const sql = readBlockSql(page, block);
      await exportRows(res, {
        format,
        filenameBase: `${page.id}-${block.id}`,
        settings,
        logger,
        requestId,
        fetchRows: async () => {
          // Exports are only offered for "table" blocks (see config/pages.js) - reuse
          // whatever sort/filter the block currently has active on the page.
          const columns = await describeTableBlockColumns({
            adapter, pageId: page.id, block, sql, paramValues: paramValues.values, ttlMs: settings.metadataCacheTtlMs,
          });
          const { sort, filters } = parseBlockBrowseParams(url, block.id, columns);
          const result = await executeTableBlock({
            adapter, block, sql, paramValues: paramValues.values, page: 1, pageSize: settings.exportLimits.maxRows, sort, filters,
          });
          return { rows: result.rows };
        },
      });
      return;
    }
  }

  // Read-only blocks execute concurrently, bounded per-request so one page
  // load can't fan out unbounded work across sources.
  const limit = createLimiter(Math.max(1, settings.maxConcurrentQueriesPerRequest));

  async function runOneBlock(block) {
    const sql = readBlockSql(page, block);
    const referenced = referencedParamNames(sql);

    if (blockIsBlockedByParams(referenced, paramValues.errors)) {
      return { block, status: { state: 'blocked' } };
    }

    try {
      const source = findSqlSource(sources, block.sourceId);
      const adapter = getSqlAdapter(source, settings);
      const { page: blockPage, pageSize } = blockPageState(url, block.id, block.pageSize ?? settings.pageSize.default);

      let result;
      if (block.presentation === 'table') {
        const columns = await describeTableBlockColumns({
          adapter, pageId: page.id, block, sql, paramValues: paramValues.values, ttlMs: settings.metadataCacheTtlMs,
        });
        const { sort, filters } = parseBlockBrowseParams(url, block.id, columns);
        result = await executeTableBlock({ adapter, block, sql, paramValues: paramValues.values, page: blockPage, pageSize, sort, filters });
        result.columns = columns;
        result.sort = sort;
        result.filters = filters;
      } else {
        result = await executeBlock({ adapter, block, sql, paramValues: paramValues.values, pageSize });
      }

      return { block, status: { state: 'ok', result } };
    } catch (err) {
      const correlationId = crypto.randomUUID();
      logger.error('page_block_failed', {
        requestId,
        pageId: page.id,
        blockId: block.id,
        sourceId: block.sourceId,
        correlationId,
        errorMessage: err.message,
      });
      return { block, status: { state: 'error', message: 'This result could not be loaded.', correlationId } };
    }
  }

  const blockStatuses = await Promise.all(page.blocks.map((block) => limit(() => runOneBlock(block))));

  const flash = { 'action-success': 'Action completed.' }[url.searchParams.get('flash')];

  const body = html`
    ${breadcrumbs([{ label: 'Sources', href: '/' }, { label: 'Pages', href: '/pages' }, { label: page.title }])}
    <h1>${page.title}</h1>
    ${page.description ? html`<p class="help-text">${page.description}</p>` : ''}
    <details class="panel">
      <summary>About this page</summary>
      <p class="help-text">
        Defined by <code>pages/${page.id}/page.json</code> (plus its <code>.sql</code> query files) - edit
        those to change this page; see <code>schemas/EXAMPLES.md</code> for the format. Table blocks below
        support sorting (click a column header) and filtering (the "Filters" panel) automatically.
      </p>
    </details>
    ${flash ? html`<div class="panel panel-success">${flash}</div>` : ''}
    ${renderPageParamsForm({ action: buildPath('pages', page.id), defs, values: paramValues.values, errors: paramValues.errors })}
    <div class="blocks">
      ${blockStatuses.map(({ block, status }) => renderBlock({ pageId: page.id, page, block, url, status }))}
    </div>
  `;

  sendHtml(res, 200, pageShell({ title: page.title, bodyHtml: body, activeNav: 'pages' }));
}
