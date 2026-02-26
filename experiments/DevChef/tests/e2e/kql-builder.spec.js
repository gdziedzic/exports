import { test, expect } from '@playwright/test';

async function openKqlBuilder(page) {
  await page.goto('/');
  await page.waitForSelector('#tool-list', { timeout: 10000 });

  const searchBox = page.locator('#tool-search');
  await searchBox.fill('KQL Builder');
  await page.waitForTimeout(300);

  const toolEntry = page.locator('#tool-list .tool-item:has-text("KQL Builder")').first();
  await toolEntry.click();
  await page.waitForSelector('#query-editor', { timeout: 10000 });
}

function getEditor(page) {
  return page.locator('#query-editor');
}

test.describe('KQL Builder', () => {
  test.beforeEach(async ({ page }) => {
    await openKqlBuilder(page);
  });

  test('should load and display UI elements', async ({ page }) => {
    await expect(getEditor(page)).toBeVisible();

    // Snippet buttons rendered from SNIPPETS array
    const snippetBtns = page.locator('.snippet-btn');
    expect(await snippetBtns.count()).toBeGreaterThan(10);

    // Action buttons
    await expect(page.locator('#format-btn')).toBeVisible();
    await expect(page.locator('#validate-btn')).toBeVisible();
    await expect(page.locator('#copy-query-btn')).toBeVisible();
    await expect(page.locator('#export-btn')).toBeVisible();

    // Quick action chips
    const actionChips = page.locator('.action-chip');
    expect(await actionChips.count()).toBe(6);

    // Stats
    await expect(page.locator('#line-count')).toBeVisible();
    await expect(page.locator('#char-count')).toBeVisible();
    await expect(page.locator('#operator-count')).toBeVisible();

    // Table and time range selects
    await expect(page.locator('#table-select')).toBeVisible();
    await expect(page.locator('#timerange-select')).toBeVisible();
  });

  test('should populate table picker with Application Insights tables', async ({ page }) => {
    const tableSelect = page.locator('#table-select');
    const options = tableSelect.locator('option');

    const values = await options.evaluateAll(opts => opts.map(o => o.value));
    expect(values).toEqual([
      'requests',
      'dependencies',
      'exceptions',
      'traces',
      'customEvents',
      'pageViews',
      'availabilityResults',
      'performanceCounters',
    ]);

    // Default selected value is the first table
    await expect(tableSelect).toHaveValue('requests');
  });

  test('should render snippet categories from SNIPPETS data', async ({ page }) => {
    const categories = page.locator('.snippet-categories .category');
    expect(await categories.count()).toBeGreaterThanOrEqual(5);

    // Verify first category label
    const firstHeader = categories.first().locator('h4');
    await expect(firstHeader).toContainText('Date & Time');

    // Each category should have at least one snippet button
    for (let i = 0; i < await categories.count(); i++) {
      const btns = categories.nth(i).locator('.snippet-btn');
      expect(await btns.count()).toBeGreaterThan(0);
    }
  });

  test('should insert snippet into editor when snippet button is clicked', async ({ page }) => {
    const editor = getEditor(page);

    // Click the "Summarize Stats" snippet
    await page.locator('.snippet-btn[data-snippet="summarize"]').click();

    const value = await editor.inputValue();
    expect(value).toContain('summarize');
    expect(value).toContain('TotalCount=count()');
    expect(value).toContain('AvgDuration=avg(duration)');
  });

  test('should format a simple query correctly', async ({ page }) => {
    const editor = getEditor(page);

    await editor.fill('requests | where timestamp > ago(1h) | where resultCode >= 400 | take 100');
    await page.locator('#format-btn').click();

    const formatted = await editor.inputValue();
    const lines = formatted.split('\n');

    expect(lines[0]).toBe('requests');
    expect(lines[1]).toBe('| where timestamp > ago(1h)');
    expect(lines[2]).toBe('| where resultCode >= 400');
    expect(lines[3]).toBe('| take 100');
  });

  test('should preserve multi-line summarize indentation', async ({ page }) => {
    const editor = getEditor(page);

    await page.locator('.snippet-btn[data-snippet="summarize"]').click();
    await page.locator('#format-btn').click();
    const formatted = await editor.inputValue();

    expect(formatted).toContain('| summarize');
    expect(formatted).toContain('    TotalCount=count(),');
    expect(formatted).toContain('    AvgDuration=avg(duration),');
    expect(formatted).toContain('  by bin(timestamp, 5m)');
  });

  test('should preserve join subquery structure', async ({ page }) => {
    const editor = getEditor(page);

    await page.locator('.snippet-btn[data-snippet="trace-correlation"]').click();
    await page.locator('#format-btn').click();

    const formatted = await editor.inputValue();

    expect(formatted).toContain('| join kind=inner (');
    expect(formatted).toContain('    traces');
    expect(formatted).toContain(') on operation_Id');
  });

  test('should not break pipes inside string literals', async ({ page }) => {
    const editor = getEditor(page);

    const queryWithStringPipe = `traces
| where message contains "error | warning"
| take 10`;

    await editor.fill(queryWithStringPipe);
    await page.locator('#format-btn').click();

    const formatted = await editor.inputValue();
    expect(formatted).toContain('"error | warning"');
    const lines = formatted.split('\n');
    expect(lines.length).toBe(3);
  });

  test('should preserve comments', async ({ page }) => {
    const editor = getEditor(page);

    const queryWithComments = `traces
| where timestamp > ago(24h)
| where severityLevel >= 2 // Warning+
| take 100`;

    await editor.fill(queryWithComments);
    await page.locator('#format-btn').click();

    const formatted = await editor.inputValue();
    expect(formatted).toContain('// Warning+');
  });

  test('should format messy single-line query into proper structure', async ({ page }) => {
    const editor = getEditor(page);

    await editor.fill('requests | where timestamp > ago(1h) | where name == "GET /api" | summarize count() by resultCode | render timechart');

    await page.locator('#format-btn').click();

    const formatted = await editor.inputValue();
    const lines = formatted.split('\n');

    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]).toBe('requests');
    expect(lines.some(l => l.startsWith('| where'))).toBe(true);
    expect(lines.some(l => l.startsWith('| summarize'))).toBe(true);
    expect(lines.some(l => l.startsWith('| render'))).toBe(true);
  });

  test('should copy query to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const editor = getEditor(page);
    await editor.fill('requests | take 10');

    await page.locator('#copy-query-btn').click();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('requests');
  });

  test('should update ago() expressions when time range is changed', async ({ page }) => {
    const editor = getEditor(page);

    await page.locator('.snippet-btn[data-snippet="basic-filter"]').click();
    const original = await editor.inputValue();
    expect(original).toContain('ago(1h)');

    await page.locator('#timerange-select').selectOption('7d');

    const updated = await editor.inputValue();
    expect(updated).toContain('ago(7d)');
    expect(updated).not.toContain('ago(1h)');
  });

  test('should insert operator when quick action chip is clicked', async ({ page }) => {
    const editor = getEditor(page);

    await editor.fill('requests');
    await editor.click();
    await page.keyboard.press('End');

    await page.locator('.action-chip[data-action="where"]').click();

    const value = await editor.inputValue();
    expect(value).toContain('| where');
  });

  test('should update line, character, and operator counts', async ({ page }) => {
    const editor = getEditor(page);

    await editor.fill('requests\n| where timestamp > ago(1h)\n| summarize count()\n| take 10');

    await editor.dispatchEvent('input');
    await page.waitForTimeout(100);

    const lines = await page.locator('#line-count').textContent();
    const chars = await page.locator('#char-count').textContent();
    const ops = await page.locator('#operator-count').textContent();

    expect(parseInt(lines)).toBe(4);
    expect(parseInt(chars)).toBeGreaterThan(0);
    expect(parseInt(ops)).toBeGreaterThanOrEqual(3);
  });

  test('should preserve case() expression structure when formatting', async ({ page }) => {
    const editor = getEditor(page);

    await page.locator('.snippet-btn[data-snippet="trace-search"]').click();
    await page.locator('#format-btn').click();

    const formatted = await editor.inputValue();

    expect(formatted).toContain('case(');
    expect(formatted).toContain('"Verbose"');
    expect(formatted).toContain('"Critical"');
    expect(formatted).toContain('"Unknown"');
  });

  test('should substitute selected table into {{TABLE}} snippets', async ({ page }) => {
    const editor = getEditor(page);

    // Select "exceptions" table
    await page.locator('#table-select').selectOption('exceptions');

    // Load a snippet that uses {{TABLE}}
    await page.locator('.snippet-btn[data-snippet="basic-filter"]').click();

    const value = await editor.inputValue();
    expect(value).toContain('exceptions');
    expect(value).not.toContain('{{TABLE}}');
  });

  test('should swap table name in editor when table picker changes', async ({ page }) => {
    const editor = getEditor(page);

    // Load a snippet (default table is "requests")
    await page.locator('.snippet-btn[data-snippet="basic-filter"]').click();
    const before = await editor.inputValue();
    expect(before.split('\n')[0]).toBe('requests');

    // Change table to "traces"
    await page.locator('#table-select').selectOption('traces');

    const after = await editor.inputValue();
    expect(after.split('\n')[0]).toBe('traces');
    // Rest of query should be unchanged
    expect(after).toContain('| where timestamp > ago(1h)');
  });
});
