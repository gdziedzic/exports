# DevChef E2E Tests

This directory contains end-to-end (E2E) tests for DevChef using Playwright.

## Overview

The E2E tests verify that DevChef works correctly in real browsers by simulating user interactions and checking the application behaves as expected.

## Test Structure

```
tests/
└── e2e/
    └── devchef.spec.js    # Main E2E test suite
```

## Running Tests

### Prerequisites

```bash
# Install dependencies (first time only)
npm install

# Install Playwright browsers
npm run test:install
```

### Run Tests

```bash
# Run all tests in headless mode (default)
npm test

# Run tests with browser visible (useful for debugging)
npm run test:headed

# Open Playwright UI for interactive testing
npm run test:ui

# Run in debug mode (step through tests)
npm run test:debug

# Run specific test file
npx playwright test devchef.spec.js

# Run specific test by name
npx playwright test -g "should load the application"

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### View Results

```bash
# Open HTML test report
npm run test:report
```

## Test Coverage

### Core Functionality Tests

1. **Application Loading**
   - Verifies the app loads without errors
   - Checks main UI elements are present
   - Validates tool list is populated

2. **Tool Navigation**
   - Tests clicking tools in sidebar
   - Verifies tool switching works correctly
   - Checks workspace updates with tool content

3. **Theme Toggle**
   - Tests light/dark theme switching
   - Verifies theme persists across reloads
   - Checks theme preference is saved

4. **Command Palette**
   - Tests Ctrl+K keyboard shortcut
   - Verifies palette opens and closes
   - Checks Escape key closes palette

5. **Search Functionality**
   - Tests tool search in sidebar
   - Verifies filtering works correctly
   - Checks search results are relevant

6. **Keyboard Navigation**
   - Tests arrow key navigation
   - Verifies keyboard shortcuts work
   - Checks focus management

7. **State Persistence**
   - Tests settings persist across reloads
   - Verifies recent tools are remembered
   - Checks theme preference survives refresh

8. **Error Handling**
   - Monitors console errors
   - Verifies graceful error handling
   - Checks no critical failures occur

### Advanced Features Tests

1. **Search Box**
   - Validates search box is present and functional
   - Tests placeholder text

2. **Multiple Tool Interactions**
   - Tests switching between multiple tools
   - Verifies workspace remains stable

3. **Responsive Sidebar**
   - Checks sidebar visibility
   - Validates sidebar content loads

### Performance Tests

1. **Load Time**
   - Verifies app loads within 10 seconds
   - Checks tool list populates quickly

2. **Rapid Tool Switching**
   - Tests app handles fast tool switching
   - Verifies UI remains responsive

## Writing New Tests

### Test Template

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for element
    await page.waitForSelector('#element');

    // Perform action
    await page.click('#button');

    // Assert expectation
    await expect(page.locator('#result')).toBeVisible();
  });
});
```

### Best Practices

1. **Always wait for elements**: Use `waitForSelector` or `waitForTimeout` before interacting
2. **Use descriptive test names**: Clearly state what is being tested
3. **Keep tests isolated**: Each test should be independent
4. **Use appropriate timeouts**: Adjust timeouts for slow operations
5. **Test user flows**: Simulate real user interactions
6. **Check both positive and negative cases**: Test success and error scenarios

### Common Selectors

```javascript
// Main app elements
'#app'                    // Main app container
'#sidebar'                // Sidebar
'#main'                   // Main content area
'#workspace'              // Workspace where tools render

// Header elements
'#theme-toggle'           // Theme toggle button
'h1'                      // App title

// Tool list
'#tool-list'              // Tool list container
'.tool-item'              // Individual tool items
'#tool-search'            // Search input

// Recent tools
'#recent-tools'           // Recent tools section

// Command palette
'#command-palette'        // Command palette
'.command-palette'        // Alternative selector
```

### Debugging Tests

```bash
# Run with UI mode for visual debugging
npm run test:ui

# Run in headed mode to see browser
npm run test:headed

# Debug specific test
npx playwright test --debug -g "test name"

# Take screenshots on failure (automatic)
# Screenshots saved to test-results/

# View trace on failure
npm run test:report
```

## CI/CD Integration

Tests are configured to run in CI with the following settings:

- Retries: 2 (on CI only)
- Workers: 1 (on CI, parallel locally)
- Screenshots: On failure only
- Traces: On first retry

To run in CI mode:

```bash
CI=1 npm test
```

## Troubleshooting

### Port Already in Use

If port 8000 is already in use:

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill

# Or use a different port in playwright.config.js
```

### Tests Timeout

If tests timeout:

1. Increase timeout in test file: `test.setTimeout(60000)`
2. Check if app server is running
3. Verify no network issues

### Browser Installation Issues

```bash
# Reinstall browsers
npx playwright install --with-deps

# Install specific browser
npx playwright install chromium
```

### Tests Flaky

If tests are flaky:

1. Add explicit waits: `await page.waitForTimeout(500)`
2. Use better selectors: Prefer data-testid over classes
3. Check for race conditions
4. Increase timeouts for slow operations

## Contributing

When adding new features to DevChef:

1. Write E2E tests for new functionality
2. Update this README with new test coverage
3. Ensure all tests pass before submitting PR
4. Add tests to appropriate test suite

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
