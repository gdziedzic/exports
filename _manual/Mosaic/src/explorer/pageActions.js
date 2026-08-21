import fs from 'node:fs';
import path from 'node:path';
import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs } from '../render/breadcrumbs.js';
import { renderParamFieldset } from '../render/pageParams.js';
import { sendHtml } from '../http/respond.js';
import { noStore } from '../http/securityHeaders.js';
import { redirect } from '../http/redirect.js';
import { HttpError } from '../http/errors.js';
import { ensureCsrfToken, verifyCsrf, CSRF_FIELD_NAME } from '../http/csrf.js';
import { parseFormBody } from '../http/body.js';
import { findSqlSource, getSqlAdapter } from './sqlSourceContext.js';
import { allFormDefs, resolveParamValues } from '../pages/pageParams.js';
import { executeWriteAction } from '../pages/blockExecutor.js';
import { friendlySqliteError } from '../providers/sqlite/errors.js';
import { friendlySqlServerError } from '../providers/sqlserver/errors.js';

function friendlyDbError(adapter, err) {
  return adapter.provider === 'sqlite' ? friendlySqliteError(err) : friendlySqlServerError(err);
}

function findPage(pages, invalidPages, pageId) {
  if (pages.has(pageId)) return pages.get(pageId);
  if (invalidPages.has(pageId)) {
    throw new HttpError(503, 'This page is misconfigured and unavailable.');
  }
  throw new HttpError(404, 'Page not found.');
}

function findAction(page, actionId) {
  for (const block of page.blocks) {
    const action = (block.writeActions ?? []).find((a) => a.id === actionId);
    if (action) return { block, action };
  }
  throw new HttpError(404, 'Action not found.');
}

function requireWritableSource(sources, block) {
  const source = findSqlSource(sources, block.sourceId);
  if (!source.allowWrites) throw new HttpError(403, 'This source does not permit writes.');
  return source;
}

function actionParamDefs(action) {
  return new Map((action.parameters ?? []).map((d) => [d.name, d]));
}

function readActionSql(page, action) {
  return fs.readFileSync(path.resolve(page.dir, action.query), 'utf8');
}

function renderReviewPage(res, { status = 200, page, block, action, pageParamDefs, pageValues, actionDefs, actionValues, errors, csrfToken }) {
  const formAction = `${buildPath('pages', page.id, 'actions', action.id)}`;
  const body = html`
    ${breadcrumbs([{ label: 'Sources', href: '/' }, { label: 'Pages', href: '/pages' }, { label: page.title, href: buildPath('pages', page.id) }, { label: action.label }])}
    <h1>${action.label}</h1>
    ${action.destructive ? html`<div class="panel panel-error">This action cannot be undone.</div>` : ''}
    ${errors.has('_form') ? html`<div class="panel panel-error" role="alert">${errors.get('_form')}</div>` : ''}
    <form method="post" action="${formAction}" class="stack">
      <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
      ${[...pageParamDefs.keys()].map((name) => html`<input type="hidden" name="p_${name}" value="${pageValues.get(name) ?? ''}">`)}
      ${renderParamFieldset(actionDefs, actionValues, errors)}
      <button type="submit" class="${action.destructive ? 'button-danger' : 'button-primary'}">${action.destructive || action.confirm ? 'Confirm' : action.label}</button>
      <a class="button" href="${buildPath('pages', page.id)}">Cancel</a>
    </form>
  `;
  noStore(res);
  sendHtml(res, status, pageShell({ title: action.label, bodyHtml: body, activeNav: 'pages' }));
}

export async function handleActionReview(req, res, params, { sources, pages, invalidPages, url }) {
  const page = findPage(pages, invalidPages, params.pageId);
  const { block, action } = findAction(page, params.actionId);
  requireWritableSource(sources, block);

  const pageParamDefs = allFormDefs(page);
  const { values: pageValues } = resolveParamValues(pageParamDefs, url.searchParams);
  const actionDefs = actionParamDefs(action);
  const { values: actionValues } = resolveParamValues(actionDefs, url.searchParams);

  const csrfToken = ensureCsrfToken(req, res);
  renderReviewPage(res, { page, block, action, pageParamDefs, pageValues, actionDefs, actionValues, errors: new Map(), csrfToken });
}

export async function handleActionExecute(req, res, params, { sources, pages, invalidPages, settings, logger, requestId }) {
  const page = findPage(pages, invalidPages, params.pageId);
  const { block, action } = findAction(page, params.actionId);
  const source = requireWritableSource(sources, block);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const pageParamDefs = allFormDefs(page);
  const { values: pageValues } = resolveParamValues(pageParamDefs, body);
  const actionDefs = actionParamDefs(action);
  const { values: actionValues, errors } = resolveParamValues(actionDefs, body);

  if (errors.size > 0) {
    const csrfToken = ensureCsrfToken(req, res);
    renderReviewPage(res, { status: 400, page, block, action, pageParamDefs, pageValues, actionDefs, actionValues, errors, csrfToken });
    return;
  }

  const paramValues = new Map([...pageValues, ...actionValues]);
  const adapter = getSqlAdapter(source, settings);
  const sql = readActionSql(page, action);

  try {
    await executeWriteAction({ adapter, sql, paramValues });
  } catch (err) {
    logger.error('page_action_failed', {
      requestId,
      pageId: page.id,
      blockId: block.id,
      actionId: action.id,
      sourceId: source.id,
      errorMessage: err.message,
    });
    const csrfToken = ensureCsrfToken(req, res);
    renderReviewPage(res, {
      status: 409,
      page,
      block,
      action,
      pageParamDefs,
      pageValues,
      actionDefs,
      actionValues,
      errors: new Map([['_form', friendlyDbError(adapter, err)]]),
      csrfToken,
    });
    return;
  }

  logger.info('page_action_succeeded', { requestId, pageId: page.id, blockId: block.id, actionId: action.id, sourceId: source.id });

  // A full page reload re-runs every block, which trivially satisfies
  // "rerun the owning block and any allowlisted refresh blocks" - it's a
  // safe superset of a partial refresh.
  const redirectParams = new URLSearchParams();
  for (const [name, value] of pageValues) {
    if (value !== null && value !== undefined) redirectParams.set(`p_${name}`, String(value));
  }
  redirectParams.set('flash', 'action-success');
  redirect(res, `${buildPath('pages', page.id)}?${redirectParams.toString()}`);
}
