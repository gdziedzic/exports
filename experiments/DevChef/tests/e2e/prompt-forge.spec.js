import { test, expect } from '@playwright/test';

async function openPromptForge(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('promptForge_templates');
    localStorage.removeItem('promptForge_history');
    localStorage.removeItem('promptForge_lastState');
  });

  await page.goto('/');
  await page.waitForSelector('#tool-list', { timeout: 10000 });

  const searchBox = page.locator('#tool-search');
  await searchBox.fill('prompt forge');
  await page.waitForTimeout(300);

  const toolEntry = page.locator('#tool-list .tool-item:has-text("Prompt Forge")').first();
  await toolEntry.click();
  await page.waitForSelector('.prompt-forge-tool', { timeout: 10000 });
}

test.describe('Prompt Forge', () => {
  test.beforeEach(async ({ page }) => {
    await openPromptForge(page);
  });

  test('should render quick fire controls, recipe list, and output preview', async ({ page }) => {
    const quickFireButtons = page.locator('#quickFireGrid .forge-qf-btn');
    const recipeItems = page.locator('#recipeList .forge-recipe-item');

    expect(await quickFireButtons.count()).toBeGreaterThan(5);
    expect(await recipeItems.count()).toBeGreaterThan(5);

    await expect(page.locator('.forge-score-bar')).toBeVisible();
    await expect(page.locator('#outputPre')).toBeVisible();
    await expect(page.locator('#templateList')).toBeVisible();
  });

  test('should apply quick fire preset and surface guardrails in the prompt', async ({ page }) => {
    const patternSelect = page.locator('#patternSelect');
    await expect(patternSelect).toHaveValue('feature');

    await page.locator('[data-qf="debug"]').click();
    await expect(patternSelect).toHaveValue('debug');
    await expect(page.locator('[data-qf="debug"]')).toHaveClass(/active/);

    const output = page.locator('#outputPre');
    await expect(output).toContainText('GUARDRAILS');
    await expect(output).toContainText('QUALITY BOOSTERS');

    const securityChip = page.locator('#guardrailsGrid [data-guardrail="security"]');
    await expect(securityChip).not.toHaveClass(/active/);
    await securityChip.click();
    await expect(securityChip).toHaveClass(/active/);
    await expect(output).toContainText('Security focus');
  });

  test('should save templates and restore saved persona selections', async ({ page }) => {
    const templateName = `Prompt Forge Template ${Date.now()}`;
    const personaSelect = page.locator('#personaSelect');

    await personaSelect.selectOption('architect');
    await page.click('#newTemplateBtn');
    await page.waitForSelector('#saveModal.active', { timeout: 2000 });
    await page.fill('#templateNameInput', templateName);
    await page.click('#confirmSaveBtn');

    const templateEntry = page.locator(`#templateList .forge-history-item[data-template="${templateName}"]`);
    await expect(templateEntry).toBeVisible();

    await personaSelect.selectOption('strategy');
    await templateEntry.locator('.forge-history-name').click();
    await expect(personaSelect).toHaveValue('architect');
  });
});
