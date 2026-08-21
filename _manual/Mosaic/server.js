import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadAppSettings, isLoopbackHost } from './src/config/appsettings.js';
import { loadSources } from './src/config/sources.js';
import { loadPages } from './src/config/pages.js';
import { loadTableActionsStore } from './src/config/tableActions.js';
import { CONTENT_DIR, contentPath } from './src/config/paths.js';
import { Router } from './src/http/router.js';
import { Logger } from './src/logging/logger.js';
import { handleLive, makeReadyHandler } from './src/http/health.js';
import { handleError, sendNotFound, sendMethodNotAllowed } from './src/http/errors.js';
import { applySecurityHeaders } from './src/http/securityHeaders.js';
import { serveStaticAsset } from './src/http/staticAssets.js';
import { renderHome } from './src/explorer/home.js';
import { handleSourceOverview } from './src/explorer/sourceOverview.js';
import { handleTableBrowse } from './src/explorer/tableBrowse.js';
import { handleRecordDetail } from './src/explorer/recordDetail.js';
import { handleNewRecordForm, handleCreateRecord, handleEditRecordForm, handleUpdateRecord } from './src/explorer/recordForm.js';
import { handleDeleteConfirm, handleDeleteRecord } from './src/explorer/recordDelete.js';
import { handleBulkDeleteReview, handleBulkDeleteExecute } from './src/explorer/bulkDelete.js';
import { handleGenerateInsert } from './src/explorer/generateInsert.js';
import {
  handleNewTableActionForm,
  handleCreateTableAction,
  handleTableActionReview,
  handleTableActionExecute,
  handleDeleteTableAction,
} from './src/explorer/tableActions.js';
import { handleFileBrowse } from './src/explorer/fileBrowse.js';
import { handleFileRecordDetail } from './src/explorer/fileRecordDetail.js';
import { handlePagesList } from './src/explorer/pagesList.js';
import { handlePageRender } from './src/explorer/pageRender.js';
import { handleActionReview, handleActionExecute } from './src/explorer/pageActions.js';
import { closeAllConnections as closeAllSqliteConnections } from './src/providers/sqlite/connections.js';
import { closeAllConnections as closeAllSqlServerConnections } from './src/providers/sqlserver/connections.js';

const SHUTDOWN_DEADLINE_MS = 10_000;

function startupBanner(settings) {
  console.log(`Mosaic listening on http://${settings.host}:${settings.port}`);
  console.log(`Content directory: ${CONTENT_DIR}`);
  console.log(`Development mode: ${settings.developmentMode}`);

  if (!isLoopbackHost(settings.host)) {
    console.warn('');
    console.warn('*'.repeat(72));
    console.warn('WARNING: Mosaic is bound to a non-loopback host and may be reachable');
    console.warn(`         from outside this machine (host: ${settings.host}).`);
    console.warn('         There is NO AUTHENTICATION. Only do this behind a firewall,');
    console.warn('         VPN, or an authenticated reverse proxy. See SECURITY.md.');
    console.warn('*'.repeat(72));
    console.warn('');
  }
}

export async function createApp({ appSettingsOptions = {}, sourcesOptions = {}, pagesOptions = {}, tableActionsOptions = {} } = {}) {
  const settings = loadAppSettings(appSettingsOptions);
  const sources = loadSources(sourcesOptions);
  const { pages, invalid: invalidPages } = loadPages(sources, pagesOptions);
  const tableActions = loadTableActionsStore(tableActionsOptions);

  const logger = new Logger({
    level: settings.logging.level,
    directory: contentPath(settings.logging.directory),
  });

  const publicDir = contentPath('public');
  const readyState = { ready: false, startedAt: new Date().toISOString() };

  const router = new Router();
  router.get('/health/live', handleLive);
  router.get('/health/ready', makeReadyHandler(() => readyState));

  router.get('/assets/:file', (req, res, params) => {
    serveStaticAsset(res, publicDir, params.file);
  });

  router.get('/', (req, res) => {
    renderHome(res, { sources, pageCount: pages.size });
  });

  router.get('/sources/:sourceId', handleSourceOverview);
  router.get('/sources/:sourceId/:schema/:table', handleTableBrowse);
  router.get('/sources/:sourceId/:schema/:table/new', handleNewRecordForm);
  router.post('/sources/:sourceId/:schema/:table/new', handleCreateRecord);
  router.get('/sources/:sourceId/:schema/:table/rows/:rowKey', handleRecordDetail);
  router.get('/sources/:sourceId/:schema/:table/rows/:rowKey/edit', handleEditRecordForm);
  router.post('/sources/:sourceId/:schema/:table/rows/:rowKey/edit', handleUpdateRecord);
  router.get('/sources/:sourceId/:schema/:table/rows/:rowKey/delete', handleDeleteConfirm);
  router.post('/sources/:sourceId/:schema/:table/rows/:rowKey/delete', handleDeleteRecord);
  router.post('/sources/:sourceId/:schema/:table/bulk-delete/review', handleBulkDeleteReview);
  router.post('/sources/:sourceId/:schema/:table/bulk-delete', handleBulkDeleteExecute);
  router.post('/sources/:sourceId/:schema/:table/generate-insert', handleGenerateInsert);
  router.get('/sources/:sourceId/:schema/:table/actions/new', handleNewTableActionForm);
  router.post('/sources/:sourceId/:schema/:table/actions', handleCreateTableAction);
  router.post('/sources/:sourceId/:schema/:table/actions/:actionId/review', handleTableActionReview);
  router.post('/sources/:sourceId/:schema/:table/actions/:actionId/execute', handleTableActionExecute);
  router.post('/sources/:sourceId/:schema/:table/actions/:actionId/delete', handleDeleteTableAction);

  router.get('/files/:sourceId', handleFileBrowse);
  router.get('/files/:sourceId/records/:recordIndex', handleFileRecordDetail);

  router.get('/pages', handlePagesList);
  router.get('/pages/:pageId', handlePageRender);
  router.get('/pages/:pageId/actions/:actionId', handleActionReview);
  router.post('/pages/:pageId/actions/:actionId', handleActionExecute);

  readyState.ready = true;

  let shuttingDown = false;
  const sockets = new Set();

  const server = http.createServer(async (req, res) => {
    const requestId = crypto.randomUUID();
    const startedAt = process.hrtime.bigint();

    if (shuttingDown) {
      res.setHeader('Connection', 'close');
    }

    res.setHeader('X-Request-Id', requestId);
    applySecurityHeaders(res);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info('request', {
        requestId,
        method: req.method,
        route: res.locals?.matchedPattern ?? req.url,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    } catch {
      res.statusCode = 400;
      res.end('Bad request');
      return;
    }

    try {
      const match = router.match(req.method, url.pathname);
      if (!match) {
        sendNotFound(req, res, { requestId, developmentMode: settings.developmentMode, logger });
        return;
      }
      if (match.methodNotAllowed) {
        sendMethodNotAllowed(req, res, match.allowedMethods, {
          requestId,
          developmentMode: settings.developmentMode,
          logger,
        });
        return;
      }
      res.locals = { matchedPattern: match.pattern };
      await match.handler(req, res, match.params, { settings, sources, pages, invalidPages, tableActions, logger, url, requestId });
    } catch (err) {
      handleError(err, req, res, { logger, requestId, developmentMode: settings.developmentMode });
    }
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    const closed = new Promise((resolve) => server.close(resolve));
    const deadline = new Promise((resolve) => setTimeout(resolve, SHUTDOWN_DEADLINE_MS));
    await Promise.race([closed, deadline]);

    for (const socket of sockets) socket.destroy();
    closeAllSqliteConnections();
    await closeAllSqlServerConnections();
    await logger.close();
  }

  return { server, settings, sources, pages, invalidPages, tableActions, logger, shutdown };
}

async function main() {
  let app;
  try {
    app = await createApp();
  } catch (err) {
    console.error('Failed to start Mosaic:');
    console.error(err.message ?? err);
    process.exitCode = 1;
    return;
  }

  const { server, settings, shutdown } = app;

  server.listen(settings.port, settings.host, () => {
    startupBanner(settings);
  });

  async function handleSignal(signal) {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await shutdown();
    process.exit(0);
  }

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
