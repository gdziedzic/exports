import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { sendHtml } from '../http/respond.js';

function providerBadge(provider) {
  return html`<span class="badge">${provider}</span>`;
}

export function renderHome(res, { sources, pageCount }) {
  const sqlSources = sources.filter((s) => s.provider === 'sqlserver' || s.provider === 'sqlite');
  const fileSources = sources.filter((s) => !sqlSources.includes(s));

  const body = html`
    <h1>Sources</h1>
    <p class="help-text">One workspace for all your data sources. No authentication is configured - this instance is intended for a trusted private network only.</p>
    <details class="panel">
      <summary>How do I add a source?</summary>
      <p class="help-text">
        Sources are declared in <code>sources.json</code> at the project root (one entry per database or
        file feed), with server-wide settings in <code>appsettings.json</code>. See
        <code>schemas/EXAMPLES.md</code> for annotated examples and <code>schemas/sources.schema.json</code>
        / <code>schemas/appsettings.schema.json</code> for the full field reference. Both files are
        validated at startup - an invalid one prevents Mosaic from starting, with a clear list of issues.
      </p>
    </details>

    <h2>Databases</h2>
    ${sqlSources.length === 0
      ? html`<p class="help-text">No SQL sources configured in sources.json.</p>`
      : html`<ul>
          ${sqlSources.map(
            (s) => html`<li>
              <a href="${buildPath('sources', s.id)}">${s.name}</a>
              ${providerBadge(s.provider)}
              ${s.allowWrites ? html`<span class="badge">writable</span>` : html`<span class="badge">read-only</span>`}
            </li>`,
          )}
        </ul>`}

    <h2>Files</h2>
    ${fileSources.length === 0
      ? html`<p class="help-text">No file sources configured in sources.json.</p>`
      : html`<ul>
          ${fileSources.map(
            (s) => html`<li>
              <a href="${buildPath('files', s.id)}">${s.name}</a>
              ${providerBadge(s.provider)}
              <span class="badge">read-only</span>
            </li>`,
          )}
        </ul>`}

    <h2>Configured pages</h2>
    <p class="help-text">
      ${pageCount === 0
        ? 'No configured pages found under pages/.'
        : html`<a href="/pages">${pageCount} configured page${pageCount === 1 ? '' : 's'}</a>`}
    </p>
    <details class="panel">
      <summary>How do I add a page?</summary>
      <p class="help-text">
        Configured pages live under <code>pages/&lt;page-id&gt;/</code>: a <code>page.json</code> plus one
        <code>.sql</code> file per query block (and per write action). See
        <code>schemas/EXAMPLES.md</code> for an annotated walkthrough and
        <code>pages/operations-overview/</code> in this repo for a complete worked example. An invalid
        page is isolated - it's marked unavailable on <a href="/pages">/pages</a> rather than blocking
        the rest of the app.
      </p>
    </details>
  `;

  sendHtml(res, 200, pageShell({ title: 'Sources', bodyHtml: body, activeNav: 'home' }));
}
