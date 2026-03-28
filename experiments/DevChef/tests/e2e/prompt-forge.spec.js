import { test, expect } from '@playwright/test';

async function openPromptForge(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('promptForge_v12');
  });

  await page.goto('/');
  await page.waitForSelector('#tool-list', { timeout: 10000 });

  const searchBox = page.locator('#tool-search');
  await searchBox.fill('prompt forge');
  await page.waitForTimeout(300);

  const toolEntry = page.locator('#tool-list .tool-item:has-text("Prompt Forge")').first();
  await toolEntry.click();
  await page.waitForSelector('.pf-tool', { timeout: 10000 });
}

test.describe('Prompt Forge — Slots UI', () => {
  test.beforeEach(async ({ page }) => {
    await openPromptForge(page);
  });

  // ── Layout ──────────────────────────────────────────────────────────────────

  test('renders the four slots and action buttons', async ({ page }) => {
    await expect(page.locator('#pf-task')).toBeVisible();
    await expect(page.locator('#pf-role-slot')).toBeVisible();
    await expect(page.locator('#pf-context-slot')).toBeVisible();
    await expect(page.locator('#pf-format-slot')).toBeVisible();
    await expect(page.locator('#pf-copy-btn')).toBeVisible();
    await expect(page.locator('#pf-clear-btn')).toBeVisible();
    await expect(page.locator('#pf-save-btn')).toBeVisible();
  });

  test('role / context / format slot bodies are hidden by default', async ({ page }) => {
    await expect(page.locator('#pf-role-body')).toBeHidden();
    await expect(page.locator('#pf-context-body')).toBeHidden();
    await expect(page.locator('#pf-format-body')).toBeHidden();
  });

  test('summaries show default labels when slots are empty', async ({ page }) => {
    await expect(page.locator('#pf-role-summary')).toHaveText('None');
    await expect(page.locator('#pf-context-summary')).toHaveText('Empty');
    await expect(page.locator('#pf-format-summary')).toHaveText('Default');
  });

  // ── Slot expand / collapse ───────────────────────────────────────────────────

  test('clicking role slot toggle opens the body', async ({ page }) => {
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    await expect(page.locator('#pf-role-body')).toBeVisible();
    await expect(page.locator('#pf-role-slot')).toHaveClass(/open/);
  });

  test('clicking role slot toggle twice closes it again', async ({ page }) => {
    const toggle = page.locator('#pf-role-slot .pf-slot-toggle');
    await toggle.click();
    await expect(page.locator('#pf-role-body')).toBeVisible();
    await toggle.click();
    await expect(page.locator('#pf-role-body')).toBeHidden();
  });

  test('aria-expanded reflects open state', async ({ page }) => {
    const toggle = page.locator('#pf-role-slot .pf-slot-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('context slot opens and shows paste textarea', async ({ page }) => {
    await page.locator('#pf-context-slot .pf-slot-toggle').click();
    await expect(page.locator('#pf-context')).toBeVisible();
  });

  test('format slot opens and shows format pills', async ({ page }) => {
    await page.locator('#pf-format-slot .pf-slot-toggle').click();
    const pills = page.locator('#pf-format-pills .pf-pill');
    await expect(pills.first()).toBeVisible();
    expect(await pills.count()).toBeGreaterThan(3);
  });

  // ── Role pills ────────────────────────────────────────────────────────────

  test('role pills render with correct labels', async ({ page }) => {
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    const pills = page.locator('#pf-role-pills .pf-pill');
    expect(await pills.count()).toBeGreaterThan(3);
    await expect(pills.filter({ hasText: 'Senior Dev' })).toBeVisible();
    await expect(pills.filter({ hasText: 'Reviewer' })).toBeVisible();
    await expect(pills.filter({ hasText: 'Architect' })).toBeVisible();
  });

  test('selecting a role pill marks it active and updates summary', async ({ page }) => {
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    const pill = page.locator('#pf-role-pills .pf-pill').filter({ hasText: 'Senior Dev' });
    await pill.click();
    await expect(pill).toHaveClass(/active/);
    await expect(page.locator('#pf-role-summary')).toHaveText('Senior Dev');
    await expect(page.locator('#pf-role-slot')).toHaveClass(/filled/);
  });

  test('clicking the same active pill deselects it', async ({ page }) => {
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    const pill = page.locator('#pf-role-pills .pf-pill').filter({ hasText: 'Senior Dev' });
    await pill.click();
    await expect(pill).toHaveClass(/active/);
    await pill.click();
    await expect(pill).not.toHaveClass(/active/);
    await expect(page.locator('#pf-role-summary')).toHaveText('None');
  });

  test('only one role pill is active at a time', async ({ page }) => {
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    await page.locator('#pf-role-pills .pf-pill').filter({ hasText: 'Senior Dev' }).click();
    await page.locator('#pf-role-pills .pf-pill').filter({ hasText: 'Architect' }).click();

    const activePills = page.locator('#pf-role-pills .pf-pill.active');
    expect(await activePills.count()).toBe(1);
    await expect(activePills).toHaveText('Architect');
  });

  // ── Format pills ──────────────────────────────────────────────────────────

  test('selecting a format pill updates the summary', async ({ page }) => {
    await page.locator('#pf-format-slot .pf-slot-toggle').click();
    await page.locator('#pf-format-pills .pf-pill').filter({ hasText: 'Bullets' }).click();
    await expect(page.locator('#pf-format-summary')).toHaveText('Bullets');
    await expect(page.locator('#pf-format-slot')).toHaveClass(/filled/);
  });

  // ── Context ───────────────────────────────────────────────────────────────

  test('typing context updates the summary', async ({ page }) => {
    await page.locator('#pf-context-slot .pf-slot-toggle').click();
    await page.locator('#pf-context').fill('some context here');
    await expect(page.locator('#pf-context-summary')).toHaveText('some context here');
    await expect(page.locator('#pf-context-slot')).toHaveClass(/filled/);
  });

  // ── Char count ────────────────────────────────────────────────────────────

  test('char count updates when task is typed', async ({ page }) => {
    await page.locator('#pf-task').fill('Hello world');
    const count = page.locator('#pf-char-count');
    const text = await count.textContent();
    expect(parseInt(text)).toBeGreaterThan(0);
  });

  // ── Copy button ───────────────────────────────────────────────────────────

  test('copy button shows error toast when task is empty', async ({ page }) => {
    await page.locator('#pf-copy-btn').click();
    await expect(page.locator('#pf-toast')).toHaveClass(/visible/);
    await expect(page.locator('#pf-toast')).toContainText('required');
  });

  // ── Clear ─────────────────────────────────────────────────────────────────

  test('clear resets all slots', async ({ page }) => {
    await page.locator('#pf-task').fill('Test task');
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    await page.locator('#pf-role-pills .pf-pill').filter({ hasText: 'Senior Dev' }).click();

    await page.locator('#pf-clear-btn').click();

    await expect(page.locator('#pf-task')).toHaveValue('');
    await expect(page.locator('#pf-role-slot')).not.toHaveClass(/filled/);
    await expect(page.locator('#pf-role-pills .pf-pill.active')).toHaveCount(0);
  });

  // ── Save / load templates ─────────────────────────────────────────────────

  test('save template dialog appears on button click', async ({ page }) => {
    await page.locator('#pf-save-btn').click();
    await expect(page.locator('#pf-dialog-backdrop')).toBeVisible();
    await expect(page.locator('#pf-template-name-input')).toBeVisible();
  });

  test('cancel closes the save dialog', async ({ page }) => {
    await page.locator('#pf-save-btn').click();
    await page.locator('#pf-dialog-cancel').click();
    await expect(page.locator('#pf-dialog-backdrop')).toBeHidden();
  });

  test('save a template and see it in the strip', async ({ page }) => {
    await page.locator('#pf-task').fill('Review this code');
    await page.locator('#pf-save-btn').click();
    await page.locator('#pf-template-name-input').fill('Code Review');
    await page.locator('#pf-dialog-confirm').click();

    await expect(page.locator('#pf-dialog-backdrop')).toBeHidden();
    await expect(page.locator('#pf-templates-strip')).toContainText('Code Review');
  });

  test('loading a template restores slot values', async ({ page }) => {
    // Set up and save
    await page.locator('#pf-task').fill('Saved task text');
    await page.locator('#pf-role-slot .pf-slot-toggle').click();
    await page.locator('#pf-role-pills .pf-pill').filter({ hasText: 'Architect' }).click();
    await page.locator('#pf-save-btn').click();
    await page.locator('#pf-template-name-input').fill('Arch Template');
    await page.locator('#pf-dialog-confirm').click();

    // Clear then load
    await page.locator('#pf-clear-btn').click();
    await expect(page.locator('#pf-task')).toHaveValue('');

    await page.locator('#pf-templates-strip .pf-template-chip-name').filter({ hasText: 'Arch Template' }).click();
    await expect(page.locator('#pf-task')).toHaveValue('Saved task text');
    await expect(page.locator('#pf-role-pills .pf-pill.active')).toHaveText('Architect');
  });

  test('deleting a template removes it from the strip', async ({ page }) => {
    // Save first
    await page.locator('#pf-task').fill('x');
    await page.locator('#pf-save-btn').click();
    await page.locator('#pf-template-name-input').fill('To Delete');
    await page.locator('#pf-dialog-confirm').click();
    await expect(page.locator('#pf-templates-strip')).toContainText('To Delete');

    // Delete
    await page.locator('.pf-template-chip').filter({ hasText: 'To Delete' }).locator('.pf-template-chip-del').click();
    await expect(page.locator('#pf-templates-strip')).not.toContainText('To Delete');
  });

  test('Enter key in save dialog confirms save', async ({ page }) => {
    await page.locator('#pf-task').fill('x');
    await page.locator('#pf-save-btn').click();
    await page.locator('#pf-template-name-input').fill('Enter Key Test');
    await page.locator('#pf-template-name-input').press('Enter');
    await expect(page.locator('#pf-dialog-backdrop')).toBeHidden();
    await expect(page.locator('#pf-templates-strip')).toContainText('Enter Key Test');
  });
});
