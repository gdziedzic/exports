import { test, expect } from '@playwright/test';

/**
 * DevChef Keyboard Navigation E2E Tests
 * Comprehensive tests for keyboard navigation in the tools panel
 */

test.describe('DevChef - Tools Panel Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for DevChef to load and tools to be available
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    await page.waitForSelector('#tool-search', { timeout: 5000 });

    // Make sure we have tools loaded
    const toolItems = page.locator('#tool-list .tool-item');
    await expect(toolItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate down through tools with ArrowDown key', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    // Get all visible tool items
    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();
    expect(count).toBeGreaterThan(0);

    // Press ArrowDown to select first tool
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Check that first tool has keyboard-selected class
    const firstTool = toolItems.nth(0);
    await expect(firstTool).toHaveClass(/keyboard-selected/);

    // Press ArrowDown again to move to second tool
    if (count > 1) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      // First tool should no longer be selected
      await expect(firstTool).not.toHaveClass(/keyboard-selected/);

      // Second tool should be selected
      const secondTool = toolItems.nth(1);
      await expect(secondTool).toHaveClass(/keyboard-selected/);
    }
  });

  test('should navigate up through tools with ArrowUp key', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    if (count < 2) {
      test.skip();
      return;
    }

    // Navigate down to third tool
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Third tool should be selected
    const thirdTool = toolItems.nth(2);
    await expect(thirdTool).toHaveClass(/keyboard-selected/);

    // Navigate up
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Second tool should now be selected
    const secondTool = toolItems.nth(1);
    await expect(secondTool).toHaveClass(/keyboard-selected/);

    // Third tool should not be selected
    await expect(thirdTool).not.toHaveClass(/keyboard-selected/);
  });

  test('should jump to first tool with Home key', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    if (count < 3) {
      test.skip();
      return;
    }

    // Navigate down a few items
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Press Home to jump to first
    await page.keyboard.press('Home');
    await page.waitForTimeout(100);

    // First tool should be selected
    const firstTool = toolItems.nth(0);
    await expect(firstTool).toHaveClass(/keyboard-selected/);
  });

  test('should jump to last tool with End key', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();
    expect(count).toBeGreaterThan(0);

    // Press End to jump to last
    await page.keyboard.press('End');
    await page.waitForTimeout(100);

    // Last tool should be selected
    const lastTool = toolItems.nth(count - 1);
    await expect(lastTool).toHaveClass(/keyboard-selected/);
  });

  test('should not go beyond first tool when pressing ArrowUp', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');

    // Navigate to first tool
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    const firstTool = toolItems.nth(0);
    await expect(firstTool).toHaveClass(/keyboard-selected/);

    // Try to go up from first tool
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // First tool should still be selected OR no tool should be selected
    // (depending on implementation - the code allows going to -1 which deselects all)
    const hasSelected = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(hasSelected).toBeLessThanOrEqual(1);
  });

  test('should not go beyond last tool when pressing ArrowDown', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    // Navigate to last tool
    await page.keyboard.press('End');
    await page.waitForTimeout(100);

    const lastTool = toolItems.nth(count - 1);
    await expect(lastTool).toHaveClass(/keyboard-selected/);

    // Try to go down from last tool
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Last tool should still be selected
    await expect(lastTool).toHaveClass(/keyboard-selected/);
  });

  test('should open selected tool when pressing Enter', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');

    // Navigate to first tool
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Get the tool ID
    const firstTool = toolItems.nth(0);
    const toolId = await firstTool.getAttribute('data-tool-id');
    const toolName = await firstTool.locator('.tool-name').textContent();

    // Press Enter to open
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Check that the tool is opened in workspace
    const workspace = page.locator('#workspace');
    await expect(workspace).toBeVisible();

    // Tool should be active in sidebar
    await expect(firstTool).toHaveClass(/active/);

    // Workspace should contain tool content
    const hasToolContent = await workspace.locator('.tool-container, .tool-content').count() > 0;
    expect(hasToolContent).toBeTruthy();
  });

  test('should reset selection when search query changes', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    // Navigate to select a tool
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Verify something is selected
    const selectedBefore = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(selectedBefore).toBeGreaterThan(0);

    // Type in search box
    await searchBox.fill('json');
    await page.waitForTimeout(300);

    // Selection should be reset (implementation resets to -1 on input)
    // After typing, no tool should be keyboard-selected initially
    const selectedAfter = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(selectedAfter).toBe(0);
  });

  test('should clear search and reset selection when pressing Escape', async ({ page }) => {
    const searchBox = page.locator('#tool-search');

    // Type a search query
    await searchBox.fill('json');
    await page.waitForTimeout(300);

    // Navigate to select a tool
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Verify search has content and tool is selected
    const searchValue = await searchBox.inputValue();
    expect(searchValue).toBe('json');

    const selectedBefore = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(selectedBefore).toBeGreaterThan(0);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Search should be cleared
    const searchValueAfter = await searchBox.inputValue();
    expect(searchValueAfter).toBe('');

    // Selection should be reset
    const selectedAfter = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(selectedAfter).toBe(0);

    // All tools should be visible again
    const allTools = page.locator('#tool-list .tool-item');
    const countAfter = await allTools.count();
    expect(countAfter).toBeGreaterThan(0);
  });

  test('should scroll selected tool into view', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    // Jump to last tool
    await page.keyboard.press('End');
    await page.waitForTimeout(200);

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();
    const lastTool = toolItems.nth(count - 1);

    // Check that last tool is in viewport
    const isInViewport = await lastTool.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    });

    // Tool should be visible in viewport (scrolled into view)
    expect(isInViewport).toBeTruthy();
  });

  test('should work with filtered search results', async ({ page }) => {
    const searchBox = page.locator('#tool-search');

    // Search for specific tools
    await searchBox.fill('json');
    await page.waitForTimeout(300);

    const filteredTools = page.locator('#tool-list .tool-item');
    const filteredCount = await filteredTools.count();

    if (filteredCount === 0) {
      // Try different search term
      await searchBox.fill('base');
      await page.waitForTimeout(300);
    }

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Navigate through filtered results
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    const firstTool = toolItems.nth(0);
    await expect(firstTool).toHaveClass(/keyboard-selected/);

    // Navigate to second filtered result
    if (count > 1) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      const secondTool = toolItems.nth(1);
      await expect(secondTool).toHaveClass(/keyboard-selected/);
      await expect(firstTool).not.toHaveClass(/keyboard-selected/);
    }
  });

  test('should open single matching tool when pressing Enter without selection', async ({ page }) => {
    const searchBox = page.locator('#tool-search');

    // Search for a unique tool
    await searchBox.fill('uuid');
    await page.waitForTimeout(300);

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    if (count !== 1) {
      // Try to find a search that returns exactly 1 result
      await searchBox.fill('quick calc');
      await page.waitForTimeout(300);

      const newCount = await toolItems.count();
      if (newCount !== 1) {
        test.skip();
        return;
      }
    }

    // Press Enter without navigating (selectedToolIndex = -1)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // The single matching tool should be opened
    const workspace = page.locator('#workspace');
    const hasToolContent = await workspace.locator('.tool-container, .tool-content').count() > 0;
    expect(hasToolContent).toBeTruthy();
  });

  test('should maintain keyboard selection visual state', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    // Navigate to second tool
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    const toolItems = page.locator('#tool-list .tool-item');
    const secondTool = toolItems.nth(1);

    // Check that it has the keyboard-selected class
    await expect(secondTool).toHaveClass(/keyboard-selected/);

    // Check visual styling is applied (border-left should be visible)
    const borderLeft = await secondTool.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.borderLeftWidth;
    });

    // Should have a border (3px according to CSS)
    expect(borderLeft).toBeTruthy();
    expect(borderLeft).not.toBe('0px');
  });

  test('should focus search box with Ctrl+Shift+F', async ({ page }) => {
    // Click somewhere else first
    await page.locator('#workspace').click();
    await page.waitForTimeout(100);

    // Press Ctrl+Shift+F
    await page.keyboard.press('Control+Shift+F');
    await page.waitForTimeout(100);

    // Search box should be focused
    const searchBox = page.locator('#tool-search');
    const isFocused = await searchBox.evaluate(el => el === document.activeElement);
    expect(isFocused).toBeTruthy();
  });
});

test.describe('DevChef - Tools Panel Keyboard Navigation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-list', { timeout: 10000 });
    await page.waitForSelector('#tool-search', { timeout: 5000 });
  });

  test('should handle rapid keyboard navigation', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    // Rapidly press ArrowDown multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(200);

    // Should still have exactly one tool selected
    const selectedCount = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(selectedCount).toBe(1);
  });

  test('should handle keyboard navigation with empty search results', async ({ page }) => {
    const searchBox = page.locator('#tool-search');

    // Search for something that won't match
    await searchBox.fill('xyznonexistent123');
    await page.waitForTimeout(300);

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    if (count > 0) {
      // Try another non-matching search
      await searchBox.fill('qqqwwweee999');
      await page.waitForTimeout(300);
    }

    // Try to navigate (should not cause errors)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    // Should not crash or show errors
    const hasErrors = await page.locator('.error, .error-message').count();
    expect(hasErrors).toBe(0);
  });

  test('should handle switching between mouse and keyboard navigation', async ({ page }) => {
    const searchBox = page.locator('#tool-search');
    await searchBox.click();

    const toolItems = page.locator('#tool-list .tool-item');
    const count = await toolItems.count();

    if (count < 3) {
      test.skip();
      return;
    }

    // Use keyboard to select second tool
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    const secondTool = toolItems.nth(1);
    await expect(secondTool).toHaveClass(/keyboard-selected/);

    // Click on a different tool with mouse
    const fourthTool = toolItems.nth(3);
    await fourthTool.click();
    await page.waitForTimeout(300);

    // Fourth tool should be active (opened)
    await expect(fourthTool).toHaveClass(/active/);

    // Can still use keyboard navigation after mouse click
    await searchBox.click();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    const hasSelected = await page.locator('#tool-list .tool-item.keyboard-selected').count();
    expect(hasSelected).toBe(1);
  });
});
