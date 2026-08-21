import { html } from './escape.js';

export function pageShell({ title, bodyHtml, activeNav = '' }) {
  return html`<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Mosaic</title>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/">Mosaic</a>
  <nav aria-label="Primary">
    <a href="/" ${activeNav === 'home' ? html`aria-current="page"` : ''}>Sources</a>
    <a href="/pages" ${activeNav === 'pages' ? html`aria-current="page"` : ''}>Pages</a>
  </nav>
</header>
<main id="main">${bodyHtml}</main>
<script src="/assets/app.js"></script>
</body>
</html>`;
}

export function errorPanel({ title, message, correlationId, retryHref }) {
  return html`<div class="panel panel-error" role="alert">
  <h3>${title}</h3>
  <p>${message}</p>
  ${correlationId ? html`<p class="correlation-id">Correlation ID: <code>${correlationId}</code></p>` : ''}
  ${retryHref ? html`<a class="button" href="${retryHref}">Retry</a>` : ''}
</div>`;
}
