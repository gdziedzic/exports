import { test, expect } from '@playwright/test';

async function openAIPromptBuilder(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('aiPromptBuilder_v12');
  });

  await page.goto('/');
  await page.waitForSelector('#tool-list', { timeout: 10000 });

  const searchBox = page.locator('#tool-search');
  await searchBox.fill('ai prompt');
  await page.waitForTimeout(300);

  const toolEntry = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
  await toolEntry.click();
  await page.waitForSelector('.apb-tool', { timeout: 10000 });
}

test.describe('AI Prompt Builder — Slots UI', () => {
  test.beforeEach(async ({ page }) => {
    await openAIPromptBuilder(page);
  });

  // ── Layout ──────────────────────────────────────────────────────────────────

  test('renders the four slots and action buttons', async ({ page }) => {
    await expect(page.locator('#apb-task')).toBeVisible();
    await expect(page.locator('#apb-role-slot')).toBeVisible();
    await expect(page.locator('#apb-context-slot')).toBeVisible();
    await expect(page.locator('#apb-format-slot')).toBeVisible();
    await expect(page.locator('#apb-copy-btn')).toBeVisible();
    await expect(page.locator('#apb-clear-btn')).toBeVisible();
    await expect(page.locator('#apb-save-btn')).toBeVisible();
  });

  test('collapsible slot bodies are hidden on load', async ({ page }) => {
    await expect(page.locator('#apb-role-body')).toBeHidden();
    await expect(page.locator('#apb-context-body')).toBeHidden();
    await expect(page.locator('#apb-format-body')).toBeHidden();
  });

  test('default summaries are shown when slots are empty', async ({ page }) => {
    await expect(page.locator('#apb-role-summary')).toHaveText('None');
    await expect(page.locator('#apb-context-summary')).toHaveText('Empty');
    await expect(page.locator('#apb-format-summary')).toHaveText('Default');
  });

  // ── Slot expand / collapse ───────────────────────────────────────────────────

  test('clicking role slot opens and closes it', async ({ page }) => {
    const toggle = page.locator('#apb-role-slot .apb-slot-toggle');
    await toggle.click();
    await expect(page.locator('#apb-role-body')).toBeVisible();
    await expect(page.locator('#apb-role-slot')).toHaveClass(/open/);
    await toggle.click();
    await expect(page.locator('#apb-role-body')).toBeHidden();
  });

  test('aria-expanded updates on toggle', async ({ page }) => {
    const toggle = page.locator('#apb-role-slot .apb-slot-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('format slot shows pills when opened', async ({ page }) => {
    await page.locator('#apb-format-slot .apb-slot-toggle').click();
    const pills = page.locator('#apb-format-pills .apb-pill');
    expect(await pills.count()).toBeGreaterThan(3);
  });

  // ── Role pills ────────────────────────────────────────────────────────────

  test('role pills include general-purpose options', async ({ page }) => {
    await page.locator('#apb-role-slot .apb-slot-toggle').click();
    const pills = page.locator('#apb-role-pills .apb-pill');
    expect(await pills.count()).toBeGreaterThan(3);
    // Shared ROLES array includes these
    await expect(pills.filter({ hasText: 'Senior Dev' })).toBeVisible();
    await expect(pills.filter({ hasText: 'Analyst' })).toBeVisible();
    await expect(pills.filter({ hasText: 'Teacher' })).toBeVisible();
  });

  test('selecting a role pill marks it active and updates summary', async ({ page }) => {
    await page.locator('#apb-role-slot .apb-slot-toggle').click();
    const pill = page.locator('#apb-role-pills .apb-pill').filter({ hasText: 'Analyst' });
    await pill.click();
    await expect(pill).toHaveClass(/active/);
    await expect(page.locator('#apb-role-summary')).toHaveText('Analyst');
    await expect(page.locator('#apb-role-slot')).toHaveClass(/filled/);
  });

  test('only one role pill active at a time', async ({ page }) => {
    await page.locator('#apb-role-slot .apb-slot-toggle').click();
    await page.locator('#apb-role-pills .apb-pill').filter({ hasText: 'Analyst' }).click();
    await page.locator('#apb-role-pills .apb-pill').filter({ hasText: 'Teacher' }).click();

    const activePills = page.locator('#apb-role-pills .apb-pill.active');
    expect(await activePills.count()).toBe(1);
    await expect(activePills).toHaveText('Teacher');
  });

  test('deselecting active role pill resets summary', async ({ page }) => {
    await page.locator('#apb-role-slot .apb-slot-toggle').click();
    const pill = page.locator('#apb-role-pills .apb-pill').filter({ hasText: 'Analyst' });
    await pill.click();
    await pill.click();
    await expect(page.locator('#apb-role-summary')).toHaveText('None');
  });

  // ── Custom role text ──────────────────────────────────────────────────────

  test('typing custom role clears any active preset pill', async ({ page }) => {
    await page.locator('#apb-role-slot .apb-slot-toggle').click();
    await page.locator('#apb-role-pills .apb-pill').filter({ hasText: 'Senior Dev' }).click();
    await expect(page.locator('#apb-role-pills .apb-pill.active')).toHaveCount(1);

    await page.locator('#apb-role-custom').fill('You are a pirate captain.');
    await expect(page.locator('#apb-role-pills .apb-pill.active')).toHaveCount(0);
  });

  // ── Format pills ──────────────────────────────────────────────────────────

  test('selecting format updates the summary', async ({ page }) => {
    await page.locator('#apb-format-slot .apb-slot-toggle').click();
    await page.locator('#apb-format-pills .apb-pill').filter({ hasText: 'Steps' }).click();
    await expect(page.locator('#apb-format-summary')).toHaveText('Steps');
  });

  // ── Context ───────────────────────────────────────────────────────────────

  test('typing context shows summary and marks slot filled', async ({ page }) => {
    await page.locator('#apb-context-slot .apb-slot-toggle').click();
    await page.locator('#apb-context').fill('relevant context data');
    await expect(page.locator('#apb-context-summary')).toHaveText('relevant context data');
    await expect(page.locator('#apb-context-slot')).toHaveClass(/filled/);
  });

  // ── Char count ────────────────────────────────────────────────────────────

  test('char count reflects assembled prompt length', async ({ page }) => {
    await page.locator('#apb-task').fill('Write a summary');
    const countText = await page.locator('#apb-char-count').textContent();
    expect(parseInt(countText)).toBeGreaterThan(0);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  test('copy with empty task shows error toast', async ({ page }) => {
    await page.locator('#apb-copy-btn').click();
    await expect(page.locator('#apb-toast')).toHaveClass(/visible/);
    await expect(page.locator('#apb-toast')).toContainText('required');
  });

  // ── Clear ─────────────────────────────────────────────────────────────────

  test('clear resets task, role, context, and format', async ({ page }) => {
    await page.locator('#apb-task').fill('Some task');
    await page.locator('#apb-role-slot .apb-slot-toggle').click();
    await page.locator('#apb-role-pills .apb-pill').filter({ hasText: 'Analyst' }).click();
    await page.locator('#apb-context-slot .apb-slot-toggle').click();
    await page.locator('#apb-context').fill('Some context');

    await page.locator('#apb-clear-btn').click();

    await expect(page.locator('#apb-task')).toHaveValue('');
    await expect(page.locator('#apb-role-pills .apb-pill.active')).toHaveCount(0);
    await expect(page.locator('#apb-context')).toHaveValue('');
  });

  // ── Templates ─────────────────────────────────────────────────────────────

  test('save template dialog opens on button click', async ({ page }) => {
    await page.locator('#apb-save-btn').click();
    await expect(page.locator('#apb-dialog-backdrop')).toBeVisible();
  });

  test('backdrop click closes save dialog', async ({ page }) => {
    await page.locator('#apb-save-btn').click();
    await page.locator('#apb-dialog-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#apb-dialog-backdrop')).toBeHidden();
  });

  test('saving a template adds it to the strip', async ({ page }) => {
    await page.locator('#apb-task').fill('Write tests');
    await page.locator('#apb-save-btn').click();
    await page.locator('#apb-template-name-input').fill('Test Writer');
    await page.locator('#apb-dialog-confirm').click();

    await expect(page.locator('#apb-templates-strip')).toContainText('Test Writer');
  });

  test('loading a saved template restores all slots', async ({ page }) => {
    // Save
    await page.locator('#apb-task').fill('Analyze the dataset');
    await page.locator('#apb-format-slot .apb-slot-toggle').click();
    await page.locator('#apb-format-pills .apb-pill').filter({ hasText: 'Table' }).click();
    await page.locator('#apb-save-btn').click();
    await page.locator('#apb-template-name-input').fill('Data Analysis');
    await page.locator('#apb-dialog-confirm').click();

    // Clear then load
    await page.locator('#apb-clear-btn').click();
    await page.locator('#apb-templates-strip .apb-template-chip-name').filter({ hasText: 'Data Analysis' }).click();

    await expect(page.locator('#apb-task')).toHaveValue('Analyze the dataset');
    await expect(page.locator('#apb-format-pills .apb-pill.active')).toHaveText('Table');
  });

  test('deleting a template removes it from the strip', async ({ page }) => {
    await page.locator('#apb-task').fill('x');
    await page.locator('#apb-save-btn').click();
    await page.locator('#apb-template-name-input').fill('Deletable');
    await page.locator('#apb-dialog-confirm').click();
    await expect(page.locator('#apb-templates-strip')).toContainText('Deletable');

    await page.locator('.apb-template-chip').filter({ hasText: 'Deletable' }).locator('.apb-template-chip-del').click();
    await expect(page.locator('#apb-templates-strip')).not.toContainText('Deletable');
  });

  test('Escape key closes the save dialog', async ({ page }) => {
    await page.locator('#apb-save-btn').click();
    await page.locator('#apb-template-name-input').press('Escape');
    await expect(page.locator('#apb-dialog-backdrop')).toBeHidden();
  });

  test('saving a template with the same name replaces it', async ({ page }) => {
    const saveTpl = async name => {
      await page.locator('#apb-save-btn').click();
      await page.locator('#apb-template-name-input').fill(name);
      await page.locator('#apb-dialog-confirm').click();
    };

    await page.locator('#apb-task').fill('version 1');
    await saveTpl('Dup');
    await page.locator('#apb-task').fill('version 2');
    await saveTpl('Dup');

    // Should still be just one chip named "Dup"
    expect(await page.locator('.apb-template-chip').filter({ hasText: 'Dup' }).count()).toBe(1);
  });
});
