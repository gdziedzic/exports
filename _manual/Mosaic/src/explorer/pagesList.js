import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { sendHtml } from '../http/respond.js';

export function handlePagesList(req, res, params, { pages, invalidPages }) {
  const body = html`
    <h1>Configured pages</h1>
    ${pages.size === 0
      ? html`<p class="help-text">No configured pages found under pages/.</p>`
      : html`<ul>
          ${[...pages.values()].map(
            (page) => html`<li><a href="${buildPath('pages', page.id)}">${page.title}</a>${page.description ? ` - ${page.description}` : ''}</li>`,
          )}
        </ul>`}
    ${invalidPages.size > 0
      ? html`<h2>Unavailable pages</h2>
        <ul>
          ${[...invalidPages.entries()].map(([id, diag]) => html`<li><strong>${id}</strong>: ${diag.reason}</li>`)}
        </ul>`
      : ''}
    <details class="panel">
      <summary>How do I add or fix a page?</summary>
      <p class="help-text">
        Each page is a directory under <code>pages/&lt;page-id&gt;/</code>: a <code>page.json</code> plus
        one <code>.sql</code> file per query block (and per write action). See
        <code>schemas/EXAMPLES.md</code> for an annotated walkthrough and
        <code>pages/operations-overview/</code> in this repo for a complete worked example. A page listed
        above as unavailable has a specific diagnostic next to it - fix the referenced field in its
        <code>page.json</code> or <code>.sql</code> file and reload.
      </p>
    </details>
  `;
  sendHtml(res, 200, pageShell({ title: 'Pages', bodyHtml: body, activeNav: 'pages' }));
}
