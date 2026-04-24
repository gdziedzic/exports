/**
 * Tool Health Dashboard
 * Validates the user-tool registry and each HTML tool package.
 */

import { getLoadingErrors } from './loader.js';
import { ToolRegistry } from './registry.js';
import { getToolIndexFilename, normalizeToolIndexEntry, validateToolMetadataIndex } from './tool-metadata.js';
import { analyzeSharedControlUsage } from './components.js';

const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'category', 'description'];
const TOOL_INDEX_PATH = './tools/index.json';
const TOOL_BASE_PATH = './tools/';

/**
 * Run diagnostics for every entry in tools/index.json.
 * @returns {Promise<Object>} Diagnostic report
 */
export async function runToolHealthChecks() {
  const startedAt = new Date();
  const report = {
    startedAt,
    completedAt: null,
    indexPath: TOOL_INDEX_PATH,
    entries: [],
    totals: {
      files: 0,
      passed: 0,
      warnings: 0,
      failed: 0,
      checks: 0
    },
    indexErrors: []
  };

  const indexResult = await fetchToolIndex();
  if (!indexResult.ok) {
    report.indexErrors.push(indexResult.error);
    report.completedAt = new Date();
    return finalizeReport(report);
  }

  const files = indexResult.files;
  report.totals.files = files.length;

  const duplicateFiles = findDuplicates(files.map(getToolIndexFilename).filter(Boolean));
  const entries = await Promise.all(files.map((file, index) => {
    return validateToolEntry(file, index, duplicateFiles);
  }));
  const manifestsByFile = new Map(entries.map(entry => [entry.file, entry.manifest]).filter(([, manifest]) => manifest));
  const metadataValidation = validateToolMetadataIndex(files, {
    manifestsByFile,
    now: new Date()
  });
  applyMetadataValidation(entries, metadataValidation);

  const duplicateIds = findDuplicates(
    entries
      .map(entry => entry.manifest?.id)
      .filter(Boolean)
  );

  entries.forEach(entry => {
    const id = entry.manifest?.id;
    if (id && duplicateIds.has(id)) {
      entry.checks.push(failCheck('Unique id', `Manifest id "${id}" appears more than once in ${TOOL_INDEX_PATH}.`));
    } else if (id) {
      entry.checks.push(passCheck('Unique id', `Manifest id "${id}" is unique.`));
    }
  });

  report.entries = entries.map(summarizeEntry);
  report.completedAt = new Date();

  return finalizeReport(report);
}

/**
 * Render the diagnostics view into the main workspace.
 * @param {Object} context - Global app context
 * @returns {Promise<void>}
 */
export async function showToolHealthDashboard(context = {}) {
  const workspace = document.querySelector('#workspace');
  if (!workspace) return;

  workspace.innerHTML = `
    <section class="tool-health-dashboard">
      <div class="tool-health-header">
        <div>
          <h2>Tool Health Dashboard</h2>
          <p>Validating entries from <code>tools/index.json</code>.</p>
        </div>
        <tool-button id="tool-health-refresh" variant="secondary" label="Run Checks"></tool-button>
      </div>
      <div class="tool-health-content">
        <div class="tool-health-loading">Running diagnostics...</div>
      </div>
    </section>
  `;

  const refreshButton = workspace.querySelector('#tool-health-refresh');
  const content = workspace.querySelector('.tool-health-content');

  const render = async () => {
    refreshButton.setLoading?.(true);
    refreshButton.setDisabled?.(true);
    content.innerHTML = '<div class="tool-health-loading">Running diagnostics...</div>';

    try {
      const report = await runToolHealthChecks();
      content.innerHTML = renderReport(report);
      bindHealthFilters(content);

      if (context?.notify) {
        const message = report.totals.failed === 0
          ? `Tool health checks passed for ${report.totals.files} entries`
          : `Tool health found ${report.totals.failed} failing entries`;
        context.notify(message, report.totals.failed === 0 ? 'success' : 'warning');
      }
    } catch (error) {
      content.innerHTML = `
        <div class="tool-health-empty error">
          <h3>Diagnostics failed</h3>
          <p>${escapeHtml(error.message || String(error))}</p>
        </div>
      `;
    } finally {
      refreshButton.setLoading?.(false);
      refreshButton.setDisabled?.(false);
    }
  };

  refreshButton.addEventListener('tool-click', render);
  await render();
}

async function fetchToolIndex() {
  try {
    const response = await fetch(TOOL_INDEX_PATH, { cache: 'no-store' });
    if (!response.ok) {
      return {
        ok: false,
        error: `Unable to load ${TOOL_INDEX_PATH}: HTTP ${response.status}`
      };
    }

    const files = await response.json();
    if (!Array.isArray(files)) {
      return {
        ok: false,
        error: `${TOOL_INDEX_PATH} must contain an array of HTML filenames.`
      };
    }

    return { ok: true, files };
  } catch (error) {
    return {
      ok: false,
      error: `Unable to parse ${TOOL_INDEX_PATH}: ${error.message || String(error)}`
    };
  }
}

async function validateToolEntry(file, index, duplicateFiles) {
  const metadata = normalizeToolIndexEntry(file);
  const filename = getToolIndexFilename(file);
  const entry = {
    index,
    file: filename,
    path: `${TOOL_BASE_PATH}${filename}`,
    metadata,
    manifest: null,
    checks: []
  };

  if (!filename || !filename.endsWith('.html')) {
    entry.checks.push(failCheck('HTML file entry', 'Index entries must be .html filenames.'));
    return entry;
  }

  if (filename.includes('/') || filename.includes('\\')) {
    entry.checks.push(warnCheck('Flat file path', 'Tool entries should be filenames inside tools/.'));
  } else {
    entry.checks.push(passCheck('Flat file path', 'Entry points to a tools/ HTML file.'));
  }

  if (duplicateFiles.has(filename)) {
    entry.checks.push(failCheck('Unique index entry', `${filename} appears more than once in ${TOOL_INDEX_PATH}.`));
  } else {
    entry.checks.push(passCheck('Unique index entry', 'Index entry is unique.'));
  }

  validateRegistryMetadata(entry);

  let html = '';
  try {
    const response = await fetch(entry.path, { cache: 'no-store' });
    if (!response.ok) {
      entry.checks.push(failCheck('HTML file loads', `HTTP ${response.status} while fetching ${entry.path}.`));
      return entry;
    }

    html = await response.text();
    entry.checks.push(passCheck('HTML file loads', `${entry.path} fetched successfully.`));
  } catch (error) {
    entry.checks.push(failCheck('HTML file loads', error.message || String(error)));
    return entry;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const manifestScript = doc.querySelector('script[type="devchef-manifest"]');

  if (!manifestScript) {
    entry.checks.push(failCheck('Manifest present', 'Missing <script type="devchef-manifest">.'));
  } else {
    entry.checks.push(passCheck('Manifest present', 'Manifest script exists.'));
    try {
      entry.manifest = JSON.parse(manifestScript.textContent);
      entry.checks.push(passCheck('Manifest JSON', 'Manifest parses as JSON.'));
      validateManifestFields(entry);
    } catch (error) {
      entry.checks.push(failCheck('Manifest JSON', error.message || String(error)));
    }
  }

  const template = doc.querySelector('template#tool-ui');
  if (template) {
    entry.checks.push(passCheck('Template exists', 'Found template#tool-ui.'));
    validateSharedControls(entry, template);
  } else {
    entry.checks.push(failCheck('Template exists', 'Missing <template id="tool-ui">.'));
  }

  await validateModuleExport(entry, doc);
  validateLoaderStatus(entry);

  return entry;
}

function validateRegistryMetadata(entry) {
  if (!entry.metadata || Object.keys(entry.metadata).length <= 1) {
    entry.checks.push(warnCheck('Registry metadata', 'Index entry uses legacy filename-only metadata.'));
    return;
  }

  ['category', 'tags', 'aliases', 'examples', 'maturity', 'lastUpdated', 'testCoverage'].forEach(field => {
    const value = entry.metadata[field];
    const present = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (present) {
      entry.checks.push(passCheck(`Registry metadata: ${field}`, `${field} is present in tools/index.json.`));
    } else {
      entry.checks.push(warnCheck(`Registry metadata: ${field}`, `${field} is not set in tools/index.json.`));
    }
  });
}

function applyMetadataValidation(entries, validation) {
  entries.forEach(entry => {
    const issues = validation.issuesByFile?.[entry.file] || [];
    entry.metadataIssues = issues;

    if (issues.length === 0) {
      entry.checks.push(passCheck('Metadata quality gate', 'Registry metadata passes all quality checks.'));
      return;
    }

    issues.forEach(issue => {
      const checkName = `Metadata quality: ${issue.field}`;
      if (issue.severity === 'error') {
        entry.checks.push(failCheck(checkName, issue.message));
      } else {
        entry.checks.push(warnCheck(checkName, issue.message));
      }
    });
  });
}

function validateManifestFields(entry) {
  REQUIRED_MANIFEST_FIELDS.forEach(field => {
    const value = entry.manifest?.[field];
    if (typeof value === 'string' && value.trim()) {
      entry.checks.push(passCheck(`Manifest field: ${field}`, `${field} is present.`));
    } else {
      entry.checks.push(failCheck(`Manifest field: ${field}`, `${field} is required and must be a non-empty string.`));
    }
  });
}

async function validateModuleExport(entry, doc) {
  const scriptTag = doc.querySelector('script[type="module"]');
  if (!scriptTag) {
    entry.checks.push(failCheck('Module script', 'Missing <script type="module">.'));
    entry.checks.push(failCheck('DevChefTool export', 'Cannot verify export without a module script.'));
    return;
  }

  entry.checks.push(passCheck('Module script', 'Module script exists.'));

  let scriptContent = scriptTag.textContent || '';
  const scriptSrc = scriptTag.getAttribute('src');

  if (scriptSrc) {
    try {
      const scriptPath = new URL(scriptSrc, new URL(entry.path, window.location.href)).href;
      const response = await fetch(scriptPath, { cache: 'no-store' });
      if (!response.ok) {
        entry.checks.push(failCheck('Module source loads', `HTTP ${response.status} while fetching ${scriptSrc}.`));
        entry.checks.push(failCheck('DevChefTool export', 'Cannot verify export because the module source did not load.'));
        return;
      }

      scriptContent = await response.text();
      entry.checks.push(passCheck('Module source loads', `${scriptSrc} fetched successfully.`));
    } catch (error) {
      entry.checks.push(failCheck('Module source loads', error.message || String(error)));
      entry.checks.push(failCheck('DevChefTool export', 'Cannot verify export because the module source did not load.'));
      return;
    }
  }

  const loadedTool = entry.manifest?.id ? ToolRegistry.get(entry.manifest.id) : null;
  if (loadedTool?.module?.DevChefTool) {
    entry.checks.push(passCheck('DevChefTool export', 'Loaded module exports DevChefTool.'));
    return;
  }

  if (hasDevChefToolExport(scriptContent)) {
    entry.checks.push(passCheck('DevChefTool export', 'Module source declares a named DevChefTool export.'));
  } else {
    entry.checks.push(failCheck('DevChefTool export', 'Module must export DevChefTool.'));
  }
}

function validateLoaderStatus(entry) {
  const normalizedPath = normalizePath(entry.path);
  const matchingErrors = getLoadingErrors().filter(error => {
    return normalizePath(error.path || '') === normalizedPath;
  });

  if (matchingErrors.length === 0) {
    entry.checks.push(passCheck('No load errors', 'The app loader reported no errors for this entry.'));
    return;
  }

  matchingErrors.forEach(error => {
    entry.checks.push(failCheck('No load errors', error.error || 'Loader reported an error.'));
  });
}

function validateSharedControls(entry, template) {
  const usage = analyzeSharedControlUsage(template);
  const legacyTotal = Object.values(usage.legacy).reduce((sum, count) => sum + count, 0);
  const sharedTotal = Object.values(usage.shared).reduce((sum, count) => sum + count, 0);

  if (legacyTotal === 0) {
    entry.checks.push(passCheck(
      'Shared controls adoption',
      `Template uses shared controls directly (${sharedTotal} shared controls detected).`
    ));
    return;
  }

  const details = [
    usage.legacy.button ? `${usage.legacy.button} button` : '',
    usage.legacy.input ? `${usage.legacy.input} input` : '',
    usage.legacy.textarea ? `${usage.legacy.textarea} textarea` : '',
    usage.legacy.select ? `${usage.legacy.select} select` : ''
  ].filter(Boolean).join(', ');

  entry.checks.push(warnCheck(
    'Shared controls adoption',
    `Template still uses legacy controls (${details}). The runtime bridge upgrades these in-app, but source markup should migrate to shared controls.`
  ));
}

function hasDevChefToolExport(scriptContent) {
  return /\bexport\s+(const|let|var|function|class)\s+DevChefTool\b/.test(scriptContent) ||
    /\bexport\s*\{[^}]*\bDevChefTool\b[^}]*\}/s.test(scriptContent);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  values.forEach(value => {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  });

  return duplicates;
}

function summarizeEntry(entry) {
  const failed = entry.checks.filter(check => check.status === 'fail').length;
  const warnings = entry.checks.filter(check => check.status === 'warn').length;
  const passed = entry.checks.filter(check => check.status === 'pass').length;

  return {
    ...entry,
    status: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    counts: { failed, warnings, passed, total: entry.checks.length }
  };
}

function finalizeReport(report) {
  report.totals = report.entries.reduce((totals, entry) => {
    totals.files += 0;
    totals.checks += entry.counts.total;
    totals.passed += entry.status === 'pass' ? 1 : 0;
    totals.warnings += entry.status === 'warn' ? 1 : 0;
    totals.failed += entry.status === 'fail' ? 1 : 0;
    return totals;
  }, {
    files: report.totals.files,
    passed: 0,
    warnings: 0,
    failed: report.indexErrors.length > 0 ? 1 : 0,
    checks: 0
  });

  return report;
}

function renderReport(report) {
  if (report.indexErrors.length > 0) {
    return `
      <div class="tool-health-empty error">
        <h3>Index validation failed</h3>
        ${report.indexErrors.map(error => `<p>${escapeHtml(error)}</p>`).join('')}
      </div>
    `;
  }

  return `
    <div class="tool-health-summary">
      ${renderSummaryCard('Files', report.totals.files)}
      ${renderSummaryCard('Passing', report.totals.passed, 'pass')}
      ${renderSummaryCard('Warnings', report.totals.warnings, 'warn')}
      ${renderSummaryCard('Failing', report.totals.failed, 'fail')}
    </div>
    <div class="tool-health-toolbar">
      <div class="tool-health-filters" role="group" aria-label="Tool health filters">
        ${renderFilterButton('all', 'All', true)}
        ${renderFilterButton('fail', 'Failing')}
        ${renderFilterButton('warn', 'Warnings')}
        ${renderFilterButton('pass', 'Passing')}
      </div>
      <span>${report.totals.checks} checks completed at ${escapeHtml(report.completedAt.toLocaleTimeString())}</span>
    </div>
    <div class="tool-health-table">
      ${report.entries.map(renderEntry).join('')}
    </div>
  `;
}

function renderFilterButton(filter, label, active = false) {
  return `
    <tool-button
      class="${active ? 'active' : ''}"
      variant="secondary"
      label="${escapeHtml(label)}"
      data-health-filter="${escapeHtml(filter)}">
    </tool-button>
  `;
}

function renderSummaryCard(label, value, status = '') {
  return `
    <div class="tool-health-card ${status}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderEntry(entry) {
  const title = entry.manifest?.name || entry.file;
  const description = entry.manifest?.description || 'Manifest unavailable';
  const failedChecks = entry.checks.filter(check => check.status !== 'pass');
  const visibleChecks = failedChecks.length > 0 ? failedChecks : entry.checks.slice(0, 3);

  return `
    <article class="tool-health-entry ${entry.status}" data-health-status="${entry.status}">
      <div class="tool-health-entry-main">
        <span class="tool-health-status ${entry.status}">${statusLabel(entry.status)}</span>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(entry.file)} · ${escapeHtml(description)}</p>
        </div>
        <div class="tool-health-counts">
          <strong>${entry.counts.passed}/${entry.counts.total}</strong>
          <span>checks passed</span>
        </div>
      </div>
      <div class="tool-health-entry-actions">
        <tool-button
          variant="secondary"
          label="Metadata"
          data-metadata-toggle="${escapeHtml(entry.file)}">
        </tool-button>
      </div>
      ${renderMetadataPanel(entry)}
      <div class="tool-health-checks">
        ${visibleChecks.map(renderCheck).join('')}
      </div>
    </article>
  `;
}

function renderMetadataPanel(entry) {
  const rows = [
    ['ID', entry.metadata?.id, entry.manifest?.id],
    ['Name', entry.metadata?.name, entry.manifest?.name],
    ['Category', entry.metadata?.category, entry.manifest?.category],
    ['Tags', entry.metadata?.tags, entry.manifest?.tags || entry.manifest?.keywords],
    ['Aliases', entry.metadata?.aliases, entry.manifest?.aliases],
    ['Examples', entry.metadata?.examples, entry.manifest?.examples],
    ['Maturity', entry.metadata?.maturity, entry.manifest?.maturity],
    ['Last Updated', entry.metadata?.lastUpdated, entry.manifest?.lastUpdated],
    ['Coverage', entry.metadata?.testCoverage, entry.manifest?.testCoverage]
  ];
  const issues = entry.metadataIssues || [];

  return `
    <div class="tool-health-metadata-panel" data-metadata-panel="${escapeHtml(entry.file)}" hidden>
      <div class="tool-health-metadata-grid">
        <div class="tool-health-metadata-head">Field</div>
        <div class="tool-health-metadata-head">Registry</div>
        <div class="tool-health-metadata-head">Manifest</div>
        ${rows.map(([label, registry, manifest]) => `
          <div>${escapeHtml(label)}</div>
          <div>${formatMetadataValue(registry)}</div>
          <div>${formatMetadataValue(manifest)}</div>
        `).join('')}
      </div>
      <div class="tool-health-metadata-findings">
        <h4>Metadata Findings</h4>
        ${issues.length === 0
          ? '<p>No metadata quality issues.</p>'
          : issues.map(issue => `
            <div class="tool-health-metadata-finding ${issue.severity}">
              <strong>${escapeHtml(issue.field)}</strong>
              <span>${escapeHtml(issue.message)}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

function formatMetadataValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? escapeHtml(value.join(', ')) : '<span class="tool-health-muted">Not set</span>';
  }
  if (value == null || value === '') {
    return '<span class="tool-health-muted">Not set</span>';
  }
  return escapeHtml(value);
}

function renderCheck(check) {
  return `
    <div class="tool-health-check ${check.status}">
      <span>${statusIcon(check.status)}</span>
      <div>
        <strong>${escapeHtml(check.name)}</strong>
        <p>${escapeHtml(check.message)}</p>
      </div>
    </div>
  `;
}

function bindHealthFilters(content) {
  const buttons = content.querySelectorAll('[data-health-filter]');
  const entries = content.querySelectorAll('[data-health-status]');
  const metadataToggles = content.querySelectorAll('[data-metadata-toggle]');

  buttons.forEach(button => {
    button.addEventListener('tool-click', () => {
      const filter = button.dataset.healthFilter;
      buttons.forEach(item => item.classList.toggle('active', item === button));
      entries.forEach(entry => {
        entry.hidden = filter !== 'all' && entry.dataset.healthStatus !== filter;
      });
    });
  });

  metadataToggles.forEach(button => {
    button.addEventListener('tool-click', () => {
      const file = button.dataset.metadataToggle;
      const panel = content.querySelector(`[data-metadata-panel="${CSS.escape(file)}"]`);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.setLabel?.(panel.hidden ? 'Metadata' : 'Hide Metadata');
    });
  });
}

function passCheck(name, message) {
  return { status: 'pass', name, message };
}

function warnCheck(name, message) {
  return { status: 'warn', name, message };
}

function failCheck(name, message) {
  return { status: 'fail', name, message };
}

function statusLabel(status) {
  if (status === 'pass') return 'Pass';
  if (status === 'warn') return 'Warn';
  return 'Fail';
}

function statusIcon(status) {
  if (status === 'pass') return '✓';
  if (status === 'warn') return '!';
  return '×';
}

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}
