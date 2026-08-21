import { html } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { sendHtml, sendJson } from './respond.js';
import { noStore } from './securityHeaders.js';
import { CsrfError } from './csrf.js';
import { RequestTooLargeError } from './body.js';
import { PathEscapeError } from '../config/paths.js';

/** An error deliberately raised by a handler with an intended HTTP status and a user-safe message. */
export class HttpError extends Error {
  constructor(status, message, { expose = true } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = expose;
  }
}

export function statusForError(err) {
  if (err instanceof HttpError) return err.status;
  if (err instanceof CsrfError) return 403;
  if (err instanceof RequestTooLargeError) return 413;
  if (err instanceof PathEscapeError) return 400;
  return 500;
}

function safeMessageForError(err, status) {
  if (err instanceof HttpError && err.expose) return err.message;
  if (err instanceof CsrfError) return 'Your session token is invalid or missing. Please reload the page and try again.';
  if (err instanceof RequestTooLargeError) return 'The request was too large.';
  if (err instanceof PathEscapeError) return 'The requested path is not allowed.';
  if (status === 404) return 'Not found.';
  if (status === 405) return 'Method not allowed.';
  return 'An unexpected error occurred. Please try again, and contact an administrator if the problem persists.';
}

/**
 * Central error handler. Logs full technical detail (redacted by the
 * logger) server-side, and renders only a safe, generic message to the
 * browser - never a stack trace, SQL text, or filesystem path - unless
 * `developmentMode` is enabled.
 */
export function handleError(err, req, res, { logger, requestId, developmentMode }) {
  const status = statusForError(err);
  const safeMessage = safeMessageForError(err, status);

  logger.error('request_failed', {
    requestId,
    method: req.method,
    url: req.url,
    status,
    errorName: err?.name,
    errorMessage: err?.message,
    stack: developmentMode ? err?.stack : undefined,
  });

  noStore(res);

  const wantsJson = (req.headers.accept ?? '').includes('application/json');
  if (wantsJson) {
    sendJson(res, status, {
      error: safeMessage,
      requestId,
      ...(developmentMode ? { detail: err?.message, stack: err?.stack } : {}),
    });
    return;
  }

  const body = pageShell({
    title: `Error ${status}`,
    bodyHtml: html`<div class="panel panel-error">
      <h1>${status} - ${safeMessage}</h1>
      <p class="correlation-id">Correlation ID: <code>${requestId}</code></p>
      ${developmentMode
        ? html`<pre class="dev-detail">${err?.stack ?? String(err)}</pre>`
        : ''}
    </div>`,
  });
  sendHtml(res, status, body);
}

export function sendNotFound(req, res, { requestId, developmentMode, logger }) {
  handleError(new HttpError(404, 'Not found.'), req, res, { logger, requestId, developmentMode });
}

export function sendMethodNotAllowed(req, res, allowedMethods, { requestId, developmentMode, logger }) {
  res.setHeader('Allow', allowedMethods.join(', '));
  handleError(new HttpError(405, 'Method not allowed.'), req, res, { logger, requestId, developmentMode });
}
