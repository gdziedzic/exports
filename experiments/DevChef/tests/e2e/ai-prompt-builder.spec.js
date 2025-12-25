import { test, expect } from '@playwright/test';

/**
 * AI Prompt Builder E2E Tests
 * Tests for the enhanced UX features including keyboard shortcuts,
 * bulk operations, context menu, and inline previews
 */

test.describe('AI Prompt Builder - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for DevChef to load
    await page.waitForSelector('#tool-list', { timeout: 10000 });

    // Search for and open AI Prompt Builder
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);

    // Click the AI Prompt Builder tool
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();

    // Wait for tool to load
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should load AI Prompt Builder successfully', async ({ page }) => {
    // Check main elements are visible
    await expect(page.locator('.components-panel')).toBeVisible();
    await expect(page.locator('.preview-panel')).toBeVisible();
    await expect(page.locator('#components-list')).toBeVisible();
    await expect(page.locator('#final-prompt')).toBeVisible();
  });

  test('should display quick actions toolbar', async ({ page }) => {
    // Check quick actions toolbar exists
    await expect(page.locator('.quick-actions-toolbar')).toBeVisible();
    await expect(page.locator('#enable-all-btn')).toBeVisible();
    await expect(page.locator('#disable-all-btn')).toBeVisible();
    await expect(page.locator('#invert-selection-btn')).toBeVisible();
  });

  test('should render components with numbered badges', async ({ page }) => {
    // Check that components are rendered
    const components = page.locator('.component-item');
    const count = await components.count();
    expect(count).toBeGreaterThan(0);

    // Check first 9 components have number badges
    const maxToCheck = Math.min(count, 9);
    for (let i = 0; i < maxToCheck; i++) {
      const componentNumber = components.nth(i).locator('.component-number');
      await expect(componentNumber).toBeVisible();
      const numberText = await componentNumber.textContent();
      expect(numberText).toBe((i + 1).toString());
    }
  });

  test('should display inline content preview', async ({ page }) => {
    // Check that components with content show preview
    const componentPreviews = page.locator('.component-preview');
    const previewCount = await componentPreviews.count();

    // At least some components should have previews
    expect(previewCount).toBeGreaterThan(0);

    // Preview should be truncated (contains ...)
    if (previewCount > 0) {
      const firstPreview = await componentPreviews.first().textContent();
      expect(firstPreview.length).toBeLessThan(100);
    }
  });
});

test.describe('AI Prompt Builder - Component Toggling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should toggle component by clicking header', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Get initial state
    const initialActive = await firstComponent.evaluate(el => el.classList.contains('active'));

    // Click the header (not the checkbox directly)
    await firstComponent.locator('.component-header').click();
    await page.waitForTimeout(100);

    // Check state changed
    const newActive = await firstComponent.evaluate(el => el.classList.contains('active'));
    expect(newActive).toBe(!initialActive);
  });

  test('should toggle component by clicking checkbox', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();
    const checkbox = firstComponent.locator('.component-toggle');

    // Get initial state
    const initialChecked = await checkbox.evaluate(el => el.classList.contains('checked'));

    // Click checkbox
    await checkbox.click();
    await page.waitForTimeout(100);

    // Check state changed
    const newChecked = await checkbox.evaluate(el => el.classList.contains('checked'));
    expect(newChecked).toBe(!initialChecked);
  });
});

test.describe('AI Prompt Builder - Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should enable all components', async ({ page }) => {
    // Click disable all first to ensure we have disabled components
    await page.click('#disable-all-btn');
    await page.waitForTimeout(200);

    // Now enable all
    await page.click('#enable-all-btn');
    await page.waitForTimeout(200);

    // Check all components are active
    const components = page.locator('.component-item');
    const count = await components.count();

    for (let i = 0; i < count; i++) {
      const isActive = await components.nth(i).evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
    }
  });

  test('should disable all components', async ({ page }) => {
    // Click disable all
    await page.click('#disable-all-btn');
    await page.waitForTimeout(200);

    // Check all components are inactive
    const components = page.locator('.component-item');
    const count = await components.count();

    for (let i = 0; i < count; i++) {
      const isActive = await components.nth(i).evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(false);
    }
  });

  test('should invert component selection', async ({ page }) => {
    // Get initial states
    const components = page.locator('.component-item');
    const count = await components.count();
    const initialStates = [];

    for (let i = 0; i < count; i++) {
      const isActive = await components.nth(i).evaluate(el => el.classList.contains('active'));
      initialStates.push(isActive);
    }

    // Click invert
    await page.click('#invert-selection-btn');
    await page.waitForTimeout(200);

    // Check all states are inverted
    for (let i = 0; i < count; i++) {
      const isActive = await components.nth(i).evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(!initialStates[i]);
    }
  });
});

test.describe('AI Prompt Builder - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should toggle component with number keys', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Get initial state
    const initialActive = await firstComponent.evaluate(el => el.classList.contains('active'));

    // Press '1' key
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    // Check state changed
    const newActive = await firstComponent.evaluate(el => el.classList.contains('active'));
    expect(newActive).toBe(!initialActive);
  });

  test('should enable all with Ctrl+A', async ({ page }) => {
    // Disable all first
    await page.click('#disable-all-btn');
    await page.waitForTimeout(200);

    // Press Ctrl+A
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    // Check all components are active
    const activeComponents = page.locator('.component-item.active');
    const count = await activeComponents.count();
    const totalComponents = await page.locator('.component-item').count();

    expect(count).toBe(totalComponents);
  });

  test('should disable all with Ctrl+D', async ({ page }) => {
    // Enable all first
    await page.click('#enable-all-btn');
    await page.waitForTimeout(200);

    // Press Ctrl+D
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(200);

    // Check all components are inactive
    const activeComponents = page.locator('.component-item.active');
    const count = await activeComponents.count();

    expect(count).toBe(0);
  });

  test('should invert selection with Ctrl+I', async ({ page }) => {
    // Get initial count of active components
    const initialActive = await page.locator('.component-item.active').count();
    const total = await page.locator('.component-item').count();

    // Press Ctrl+I
    await page.keyboard.press('Control+i');
    await page.waitForTimeout(200);

    // Check inverted
    const newActive = await page.locator('.component-item.active').count();
    expect(newActive).toBe(total - initialActive);
  });

  test('should navigate components with arrow keys', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Click first component to focus
    await firstComponent.click();
    await page.waitForTimeout(100);

    // Press down arrow
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Check second component has focus class
    const focusedComponents = page.locator('.component-item.focused');
    const count = await focusedComponents.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('AI Prompt Builder - Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should show context menu on right-click', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Right-click the component
    await firstComponent.click({ button: 'right' });
    await page.waitForTimeout(100);

    // Check context menu is visible
    const contextMenu = page.locator('#context-menu');
    await expect(contextMenu).toHaveClass(/show/);
  });

  test('should hide context menu on click outside', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Right-click to show menu
    await firstComponent.click({ button: 'right' });
    await page.waitForTimeout(100);

    // Click outside
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(100);

    // Check context menu is hidden
    const contextMenu = page.locator('#context-menu');
    await expect(contextMenu).not.toHaveClass(/show/);
  });

  test('should toggle component from context menu', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Get initial state
    const initialActive = await firstComponent.evaluate(el => el.classList.contains('active'));

    // Right-click to show menu
    await firstComponent.click({ button: 'right' });
    await page.waitForTimeout(100);

    // Click toggle option
    const toggleOption = page.locator('[data-action="ctx-toggle"]');
    await toggleOption.click();
    await page.waitForTimeout(200);

    // Check state changed
    const newActive = await firstComponent.evaluate(el => el.classList.contains('active'));
    expect(newActive).toBe(!initialActive);
  });
});

test.describe('AI Prompt Builder - Preview Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should update final prompt when toggling components', async ({ page }) => {
    const finalPrompt = page.locator('#final-prompt');

    // Get initial content
    const initialContent = await finalPrompt.inputValue();

    // Toggle a component
    await page.keyboard.press('1');
    await page.waitForTimeout(300);

    // Check prompt changed
    const newContent = await finalPrompt.inputValue();
    expect(newContent).not.toBe(initialContent);
  });

  test('should update character count', async ({ page }) => {
    const charCount = page.locator('#char-count');
    await expect(charCount).toBeVisible();

    const text = await charCount.textContent();
    expect(text).toMatch(/\d+ characters/);
  });

  test('should update word count', async ({ page }) => {
    const wordCount = page.locator('#word-count');
    await expect(wordCount).toBeVisible();

    const text = await wordCount.textContent();
    expect(text).toMatch(/\d+ words/);
  });
});

test.describe('AI Prompt Builder - Component Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should expand component on edit button click', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();

    // Hover to show actions
    await firstComponent.hover();
    await page.waitForTimeout(100);

    // Click edit button
    const editBtn = firstComponent.locator('[data-action="edit"]');
    await editBtn.click();
    await page.waitForTimeout(100);

    // Check component is expanded
    const isExpanded = await firstComponent.evaluate(el => el.classList.contains('expanded'));
    expect(isExpanded).toBe(true);
  });

  test('should show component actions on hover', async ({ page }) => {
    const firstComponent = page.locator('.component-item').first();
    const actions = firstComponent.locator('.component-actions');

    // Hover over component
    await firstComponent.hover();
    await page.waitForTimeout(200);

    // Check actions are visible
    const opacity = await actions.evaluate(el => {
      return window.getComputedStyle(el).opacity;
    });

    // Opacity should be greater than 0 (visible)
    expect(parseFloat(opacity)).toBeGreaterThan(0);
  });

  test('should copy prompt to clipboard', async ({ page }) => {
    // Click copy button
    await page.click('#copy-prompt-btn');
    await page.waitForTimeout(200);

    // Check status message appears
    const statusMessage = page.locator('#status-message');
    await expect(statusMessage).toHaveClass(/show/);
  });
});

test.describe('AI Prompt Builder - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('ai prompt');
    await page.waitForTimeout(300);
    const promptBuilderTool = page.locator('#tool-list .tool-item:has-text("AI Prompt Builder")').first();
    await promptBuilderTool.click();
    await page.waitForSelector('#components-list', { timeout: 5000 });
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const jsErrors = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    // Perform various actions
    await page.click('#enable-all-btn');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.click('#invert-selection-btn');
    await page.waitForTimeout(100);

    // Should have no critical errors
    const criticalErrors = jsErrors.filter(e =>
      e.includes('undefined') ||
      e.includes('null') ||
      e.includes('Cannot read')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should handle rapid keyboard input', async ({ page }) => {
    // Rapidly press number keys
    for (let i = 1; i <= 5; i++) {
      await page.keyboard.press(i.toString());
      await page.waitForTimeout(50);
    }

    // App should still be responsive
    await expect(page.locator('#components-list')).toBeVisible();
    await expect(page.locator('#final-prompt')).toBeVisible();
  });

  test('should handle rapid button clicks', async ({ page }) => {
    // Rapidly click bulk operation buttons
    for (let i = 0; i < 5; i++) {
      await page.click('#enable-all-btn');
      await page.waitForTimeout(50);
      await page.click('#disable-all-btn');
      await page.waitForTimeout(50);
    }

    // App should still be responsive
    await expect(page.locator('#components-list')).toBeVisible();
  });
});
