# DevChef Testing Guide

This document provides a comprehensive guide to testing DevChef, including both unit/integration tests and end-to-end (E2E) tests.

## Quick Start

### Running Unit Tests

```bash
# From DevChef directory
node test.js                    # V2-V5 tests
node test-comprehensive.js      # V3.1-V5 tests
node test-v6.js                 # V6 tests
```

### Running E2E Tests

```bash
# First time setup
npm install                     # Install Playwright
npm run test:install            # Install browsers (Chromium, Firefox, WebKit)

# Run tests
npm test                        # Run all E2E tests (headless)
npm run test:headed             # Run with browser visible
npm run test:ui                 # Interactive test UI
npm run test:debug              # Debug mode

# View results
npm run test:report             # Open HTML report
```

## Test Types

### 1. Unit & Integration Tests (Node.js)

**Location:** Root directory
- `test.js` - V2-V5 tests (28 tests)
- `test-comprehensive.js` - V3.1-V5 tests (35 tests)
- `test-v6.js` - V6 tests (34 tests)

**What they test:**
- Core modules (UI Engine, State Manager, Tool Orchestrator, Error Boundary)
- Module integration
- State management
- Tool lifecycle
- Error handling

**Coverage:** 97 total tests, 100% module coverage

### 2. E2E Tests (Playwright)

**Location:** `tests/e2e/`
- `devchef.spec.js` - Main E2E test suite

**What they test:**
- Real browser functionality
- User interactions
- Keyboard shortcuts
- UI responsiveness
- Cross-browser compatibility
- Performance

**Coverage:** 18 tests across 3 test suites
- Core Functionality (10 tests)
- Advanced Features (4 tests)
- Performance (2 tests)

## E2E Test Details

### Test Suites

#### 1. Core Functionality
- ✅ Application loads successfully
- ✅ Tools display in sidebar
- ✅ Theme toggle (light/dark)
- ✅ Command palette (Ctrl+K)
- ✅ Tool search
- ✅ Tool opening on click
- ✅ Keyboard navigation
- ✅ Theme persistence
- ✅ Error handling
- ✅ Recent tools section

#### 2. Advanced Features
- ✅ Search functionality
- ✅ Multiple tool interactions
- ✅ Responsive sidebar
- ✅ JavaScript error monitoring

#### 3. Performance
- ✅ Load time (<10 seconds)
- ✅ Rapid tool switching

### Browsers Tested

- **Chromium** (Chrome, Edge)
- **Firefox**
- **WebKit** (Safari)

## Writing New Tests

### Unit Tests

Add to existing test files or create new ones:

```javascript
runner.test('Feature description', () => {
  // Setup
  const feature = new Feature();

  // Test
  const result = feature.doSomething();

  // Assert
  assertEquals(result, expectedValue);
});
```

### E2E Tests

Add to `tests/e2e/devchef.spec.js`:

```javascript
test('should perform action', async ({ page }) => {
  // Navigate
  await page.goto('/');

  // Wait for element
  await page.waitForSelector('#element');

  // Interact
  await page.click('#button');

  // Assert
  await expect(page.locator('#result')).toBeVisible();
});
```

## Test Commands Reference

### Unit Tests

```bash
# Run specific test file
node test.js
node test-comprehensive.js
node test-v6.js

# Run all unit tests
node test.js && node test-comprehensive.js && node test-v6.js
```

### E2E Tests

```bash
# Basic commands
npm test                        # Run all tests
npm run test:headed             # Show browser
npm run test:ui                 # Interactive UI
npm run test:debug              # Debug mode

# Advanced commands
npx playwright test devchef.spec.js              # Specific file
npx playwright test -g "should load"             # Specific test
npx playwright test --project=chromium           # Specific browser
npx playwright test --headed --project=firefox   # Firefox with UI

# Reporting
npm run test:report             # Open HTML report
npx playwright show-report      # Same as above
```

## Debugging E2E Tests

### Visual Debugging

```bash
# See the browser while tests run
npm run test:headed

# Interactive mode - pause and inspect
npm run test:ui

# Step through tests
npm run test:debug
```

### Screenshots & Traces

Playwright automatically captures:
- **Screenshots** on test failure
- **Traces** on first retry
- **Videos** (if configured)

Location: `test-results/` directory

### Common Issues

#### Port 8000 in use

```bash
# Find and kill process
lsof -ti:8000 | xargs kill
```

#### Tests timing out

1. Increase timeout in test:
   ```javascript
   test.setTimeout(60000);
   ```

2. Check app is running:
   ```bash
   python3 -m http.server 8000
   ```

#### Browser not installed

```bash
npm run test:install
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: |
          cd DevChef
          npm ci
      - name: Install Playwright Browsers
        run: |
          cd DevChef
          npx playwright install --with-deps
      - name: Run Playwright tests
        run: |
          cd DevChef
          npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: DevChef/playwright-report/
          retention-days: 30
```

## Test Coverage Summary

### Unit Tests (97 tests)

| Module | Tests | Coverage |
|--------|-------|----------|
| UI Engine | 12 | 100% |
| State Manager | 15 | 100% |
| Tool Orchestrator | 14 | 100% |
| Error Boundary | 13 | 100% |
| Integration | 3 | 100% |
| Other Modules | 40 | 100% |

### E2E Tests (18 tests)

| Category | Tests | Browsers |
|----------|-------|----------|
| Core Functionality | 10 | 3 |
| Advanced Features | 4 | 3 |
| Performance | 2 | 3 |
| **Total** | **16** | **Chromium, Firefox, WebKit** |

## Best Practices

### Unit Tests
1. Test one thing per test
2. Use descriptive test names
3. Keep tests isolated
4. Mock external dependencies
5. Assert both positive and negative cases

### E2E Tests
1. Always wait for elements before interacting
2. Use meaningful selectors (prefer IDs or data-testid)
3. Test real user workflows
4. Keep tests maintainable
5. Use page objects for complex interactions
6. Test critical paths first
7. Don't test implementation details

## Performance Expectations

### Unit Tests
- Should complete in <5 seconds total
- Individual tests <100ms

### E2E Tests
- Full suite: <2 minutes (3 browsers)
- Single browser: <1 minute
- Individual test: <10 seconds

## Continuous Testing

### Watch Mode (Unit Tests)

```bash
# Watch files and re-run on change
nodemon --watch core --watch tools --exec "node test-v6.js"
```

### Watch Mode (E2E Tests)

```bash
# Use Playwright UI for continuous testing
npm run test:ui
```

## Resources

### Playwright
- [Documentation](https://playwright.dev)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)

### DevChef Testing
- Main README: [../README.md](../README.md)
- E2E Test README: [tests/README.md](tests/README.md)
- Test Files: [tests/e2e/](tests/e2e/)

## Troubleshooting

### All tests failing

1. Check app is running: `python3 -m http.server 8000`
2. Verify tests syntax: `node -c tests/e2e/devchef.spec.js`
3. Check browser installation: `npx playwright install`

### Flaky tests

1. Add explicit waits
2. Increase timeouts
3. Check for race conditions
4. Use stable selectors

### Slow tests

1. Run single browser: `--project=chromium`
2. Run in parallel: `--workers=3`
3. Disable traces: `trace: 'off'` in config

## Contributing

When adding new features:

1. ✅ Write unit tests for new modules
2. ✅ Write E2E tests for user-facing features
3. ✅ Run all tests before committing
4. ✅ Update test documentation
5. ✅ Ensure >90% coverage for new code

---

**Questions?** Open an issue or check the [main README](README.md).
