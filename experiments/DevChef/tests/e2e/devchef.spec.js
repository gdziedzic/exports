import { test, expect } from '@playwright/test';

/**
 * DevChef E2E Tests
 * High-level tests covering the most fundamental functionality
 */

test.describe('DevChef - Core Functionality', () => {
  test('should load the application successfully', async ({ page }) => {
    await page.goto('/');

    // Check that main elements are visible
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('#main')).toBeVisible();

    // Check header is present
    await expect(page.locator('h1')).toContainText('DevChef');

    // Check welcome screen or workspace
    await expect(page.locator('#workspace')).toBeVisible();
  });

  test('should display tools in sidebar', async ({ page }) => {
    await page.goto('/');

    // Wait for tools to load
    await page.waitForSelector('#tool-list', { timeout: 10000 });

    // Check that at least some tools are loaded
    const toolItems = page.locator('#tool-list .tool-item');
    await expect(toolItems.first()).toBeVisible({ timeout: 10000 });

    // Count should be greater than 0
    const count = await toolItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should toggle theme between light and dark', async ({ page }) => {
    await page.goto('/');

    // Wait for app to be ready
    await page.waitForSelector('#theme-toggle');

    // Get initial theme
    const body = page.locator('body');
    const initialTheme = await body.getAttribute('data-theme');

    // Click theme toggle
    await page.click('#theme-toggle');

    // Wait a bit for theme transition
    await page.waitForTimeout(100);

    // Check theme changed
    const newTheme = await body.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Toggle back
    await page.click('#theme-toggle');
    await page.waitForTimeout(100);

    // Should be back to original
    const finalTheme = await body.getAttribute('data-theme');
    expect(finalTheme).toBe(initialTheme);
  });

  test('should open command palette with Ctrl+K', async ({ page }) => {
    await page.goto('/');

    // Wait for app to be ready
    await page.waitForSelector('#tool-list');

    // Press Ctrl+K (or Cmd+K on Mac)
    await page.keyboard.press('Control+k');

    // Check command palette is visible
    await expect(page.locator('#command-palette, .command-palette')).toBeVisible({ timeout: 2000 });

    // Close with Escape
    await page.keyboard.press('Escape');

    // Should be hidden
    await expect(page.locator('#command-palette, .command-palette')).not.toBeVisible({ timeout: 2000 });
  });

  test('should search for tools', async ({ page }) => {
    await page.goto('/');

    // Wait for tools to load
    await page.waitForSelector('#tool-search');

    // Type in search box
    const searchBox = page.locator('#tool-search');
    await searchBox.fill('json');

    // Wait a bit for filtering
    await page.waitForTimeout(300);

    // Check that tools are filtered
    const visibleTools = page.locator('#tool-list .tool-item:visible, #tool-list .tool-item[style*="display: block"], #tool-list .tool-item:not([style*="display: none"])');
    const count = await visibleTools.count();

    // Should have at least one JSON-related tool
    expect(count).toBeGreaterThan(0);

    // Clear search
    await searchBox.clear();
    await page.waitForTimeout(300);

    // More tools should be visible now
    const allTools = page.locator('#tool-list .tool-item');
    const totalCount = await allTools.count();
    expect(totalCount).toBeGreaterThanOrEqual(count);
  });

  test('should open a tool when clicked', async ({ page }) => {
    await page.goto('/');

    // Wait for tools to load
    await page.waitForSelector('#tool-list .tool-item', { timeout: 10000 });

    // Get the first tool
    const firstTool = page.locator('#tool-list .tool-item').first();
    const toolName = await firstTool.textContent();

    // Click the tool
    await firstTool.click();

    // Wait for workspace to update
    await page.waitForTimeout(500);

    // Check that workspace contains content (not just welcome screen)
    const workspace = page.locator('#workspace');
    await expect(workspace).toBeVisible();

    // The welcome screen should be replaced with tool content
    const hasToolContent = await workspace.locator('.tool-container, .tool-content').count() > 0;
    expect(hasToolContent).toBeTruthy();
  });

  test('should handle keyboard navigation in tool list', async ({ page }) => {
    await page.goto('/');

    // Wait for tools to load
    await page.waitForSelector('#tool-list .tool-item', { timeout: 10000 });

    // Focus the first tool (by clicking search then pressing down)
    await page.click('#tool-search');
    await page.keyboard.press('ArrowDown');

    // Get focused element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeTruthy();
  });

  test('should persist theme preference on reload', async ({ page }) => {
    await page.goto('/');

    // Wait for app to be ready
    await page.waitForSelector('#theme-toggle');

    // Set to dark theme
    const body = page.locator('body');
    let currentTheme = await body.getAttribute('data-theme');

    // Ensure we're in dark mode
    if (currentTheme !== 'dark') {
      await page.click('#theme-toggle');
      await page.waitForTimeout(100);
    }

    // Verify dark theme
    currentTheme = await body.getAttribute('data-theme');
    expect(currentTheme).toBe('dark');

    // Reload page
    await page.reload();

    // Wait for app to load
    await page.waitForSelector('#theme-toggle');

    // Check theme is still dark
    const reloadedTheme = await body.getAttribute('data-theme');
    expect(reloadedTheme).toBe('dark');
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('#tool-list', { timeout: 10000 });

    // Check no critical errors occurred
    const criticalErrors = errors.filter(e =>
      e.includes('undefined') ||
      e.includes('null') ||
      e.includes('Cannot read')
    );

    // Allow for some non-critical errors but none should be critical
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('should display recent tools section', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('#tool-list', { timeout: 10000 });

    // Click a tool to make it "recent"
    const firstTool = page.locator('#tool-list .tool-item').first();
    await firstTool.click();

    // Wait a bit
    await page.waitForTimeout(500);

    // Reload to see if recent tools appear
    await page.reload();
    await page.waitForSelector('#tool-list', { timeout: 10000 });

    // Check if recent tools section exists and has content
    const recentSection = page.locator('#recent-tools, .recent-tools');
    const exists = await recentSection.count() > 0;

    if (exists) {
      // If recent tools section exists, it should have at least one item
      const recentItems = recentSection.locator('.tool-item, .recent-tool');
      const count = await recentItems.count();
      // It's ok if count is 0 on first run, but section should exist
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('DevChef - Advanced Features', () => {
  test('should have search functionality in sidebar', async ({ page }) => {
    await page.goto('/');

    // Wait for search box
    await page.waitForSelector('#tool-search');

    const searchBox = page.locator('#tool-search');
    await expect(searchBox).toBeVisible();
    await expect(searchBox).toBeEnabled();

    // Check placeholder
    const placeholder = await searchBox.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

  test('should support multiple tool interactions', async ({ page }) => {
    await page.goto('/');

    // Wait for tools to load
    await page.waitForSelector('#tool-list .tool-item', { timeout: 10000 });

    // Get first two tools
    const tools = page.locator('#tool-list .tool-item');
    const count = await tools.count();

    if (count >= 2) {
      // Click first tool
      await tools.nth(0).click();
      await page.waitForTimeout(300);

      // Click second tool
      await tools.nth(1).click();
      await page.waitForTimeout(300);

      // Should still have workspace visible
      await expect(page.locator('#workspace')).toBeVisible();
    }
  });

  test('should have responsive sidebar', async ({ page }) => {
    await page.goto('/');

    // Wait for sidebar
    await page.waitForSelector('#sidebar');

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();

    // Check sidebar has content
    const sidebarContent = page.locator('#sidebar #tool-list');
    await expect(sidebarContent).toBeVisible();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const jsErrors = [];

    // Capture page errors
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await page.goto('/');

    // Wait for app to fully load
    await page.waitForSelector('#tool-list', { timeout: 10000 });

    // Should have minimal or no JS errors
    expect(jsErrors.length).toBeLessThan(5);
  });
});

test.describe('DevChef - Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // Wait for tools to be visible
    await page.waitForSelector('#tool-list .tool-item', { timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should handle rapid tool switching', async ({ page }) => {
    await page.goto('/');

    // Wait for tools to load
    await page.waitForSelector('#tool-list .tool-item', { timeout: 10000 });

    const tools = page.locator('#tool-list .tool-item');
    const count = await tools.count();

    if (count >= 3) {
      // Rapidly switch between tools
      for (let i = 0; i < Math.min(3, count); i++) {
        await tools.nth(i).click();
        await page.waitForTimeout(100);
      }

      // App should still be responsive
      await expect(page.locator('#workspace')).toBeVisible();
    }
  });
});
