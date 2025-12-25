# AI Prompt Builder - Testing Guide

## Overview

This document describes the testing approach for the AI Prompt Builder enhancements, including comprehensive tests for keyboard shortcuts, bulk operations, context menus, and inline previews.

## Test Suites

### 1. Browser-Based Test Suite (Recommended for Quick Testing)

**File:** `test-ai-prompt-builder.html`

**Usage:**
```bash
# Start local server
cd DevChef
python -m http.server 8000

# Open in browser
# Navigate to: http://localhost:8000/test-ai-prompt-builder.html
```

**Features:**
- Visual test results with pass/fail indicators
- Auto-runs on page load
- Tests run in an iframe to isolate tool environment
- Real-time summary statistics
- No external dependencies required

**Test Coverage:**
- ✅ Core functionality loading
- ✅ Component rendering and structure
- ✅ Quick actions toolbar
- ✅ Inline content previews
- ✅ Component toggling (header and checkbox)
- ✅ Bulk operations (Enable All, Disable All, Invert)
- ✅ Keyboard shortcuts (number keys, Ctrl shortcuts)
- ✅ Arrow key navigation
- ✅ Context menu (show, hide, actions)
- ✅ State preservation across updates

### 2. Playwright E2E Tests

**File:** `tests/e2e/ai-prompt-builder.spec.js`

**Prerequisites:**
```bash
npm install
npx playwright install chromium
```

**Usage:**
```bash
# Run all AI Prompt Builder tests
npx playwright test tests/e2e/ai-prompt-builder.spec.js

# Run with UI
npx playwright test tests/e2e/ai-prompt-builder.spec.js --ui

# Run specific test
npx playwright test tests/e2e/ai-prompt-builder.spec.js -g "should toggle component"

# Generate report
npx playwright test tests/e2e/ai-prompt-builder.spec.js --reporter=html
npx playwright show-report
```

**Test Coverage:**
- Core Functionality (4 tests)
- Component Toggling (2 tests)
- Bulk Operations (3 tests)
- Keyboard Shortcuts (5 tests)
- Context Menu (3 tests)
- Preview Generation (3 tests)
- Component Actions (3 tests)
- Error Handling (3 tests)

**Total: 26 test cases**

## Key Features Tested

### 1. **Click-Anywhere Toggle**
- Verify entire header is clickable
- Ensure checkbox toggle still works independently
- Test that action buttons don't trigger header toggle

### 2. **Keyboard Shortcuts**
- Number keys (1-9) toggle components
- Space toggles focused component
- Enter expands/collapses component
- Arrow keys navigate between components
- Delete key removes focused component
- Ctrl+A enables all components
- Ctrl+D disables all components
- Ctrl+I inverts selection
- Ctrl+Arrow moves components
- Escape closes context menu/expanded components

### 3. **Bulk Operations**
- Enable All button activates all components
- Disable All button deactivates all components
- Invert Selection flips all states

### 4. **Inline Previews**
- First 60 characters of content shown
- Truncated with ellipsis if longer
- Preview fades when component disabled
- Updates when content changes

### 5. **Context Menu**
- Shows on right-click
- Positioned correctly (stays in viewport)
- Hides on click outside
- Dynamic text based on component state
- All actions work correctly

### 6. **Visual Feedback**
- Smooth animations on state changes
- Focus indicators on keyboard navigation
- Hover effects on interactive elements
- Number badges for keyboard shortcuts

## Issues Fixed

### 1. **Memory Leak Prevention**
- Added cleanup for global event listeners
- Proper removal of `keydown` and `click` listeners on tool unload

### 2. **Context Menu Positioning**
- Implemented boundary checking
- Prevents menu from rendering off-screen
- Maintains 5px minimum distance from viewport edges

### 3. **ESC Key Handling**
- Closes context menu when open
- Collapses expanded components
- Clears focus state as fallback

### 4. **Input Protection**
- Keyboard shortcuts properly ignore when typing in inputs/textareas
- Prevents interference with content editing

## Running Tests Locally

### Quick Manual Testing

1. Start the development server:
   ```bash
   cd DevChef
   python -m http.server 8000
   ```

2. Open browser test page:
   ```
   http://localhost:8000/test-ai-prompt-builder.html
   ```

3. Watch tests run automatically or click "Run All Tests"

### Testing Specific Features

To test specific features manually:

1. **Keyboard Shortcuts:**
   - Press 1, 2, 3 to toggle first three components
   - Use arrow keys to navigate
   - Press Space to toggle focused component

2. **Bulk Operations:**
   - Click "✓ All" to enable everything
   - Click "✗ None" to disable everything
   - Click "⇄ Invert" to flip all states

3. **Context Menu:**
   - Right-click any component
   - Verify menu appears at cursor
   - Click outside to close

4. **Click-Anywhere Toggle:**
   - Click component header (not checkbox)
   - Verify component toggles

## Test Results Interpretation

### Browser Test Suite

**Pass (✅):** Test executed successfully without errors
**Fail (❌):** Test encountered an assertion failure (details shown)
**Skip (⚠️):** Test was skipped (reason provided)

**Summary Statistics:**
- **Total:** Number of tests executed
- **Passed:** Successful tests (should be 100%)
- **Failed:** Failed tests (should be 0)
- **Skipped:** Skipped tests

### Playwright Tests

**Expected Results:**
- All tests should pass (✓)
- No flaky tests
- Execution time < 2 minutes
- No JavaScript console errors

**Common Issues:**
- **Timeout errors:** Server not running or slow connection
- **Element not found:** Selector changed or tool not loaded
- **Assertion failures:** Functionality broken or test needs update

## Continuous Integration

The Playwright tests can be integrated into CI/CD:

```yaml
# .github/workflows/test-ai-prompt-builder.yml
name: Test AI Prompt Builder
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd DevChef && npm ci
      - run: npx playwright install chromium
      - run: python -m http.server 8000 &
      - run: npx playwright test tests/e2e/ai-prompt-builder.spec.js
```

## Adding New Tests

### Browser Test Suite

Add new test function in `test-ai-prompt-builder.html`:

```javascript
async function testNewFeature(runner) {
  await runner.runTest('Should do something new', async function() {
    // Test implementation
    this.assertExists(this.$('.new-element'), 'Element missing');
  });
}

// Add to runAllTests():
await testNewFeature(runner);
```

### Playwright Tests

Add new test in `tests/e2e/ai-prompt-builder.spec.js`:

```javascript
test('should do something new', async ({ page }) => {
  // Test implementation
  await page.click('#some-button');
  await expect(page.locator('.result')).toBeVisible();
});
```

## Performance Benchmarks

Expected performance metrics:

- **Tool load time:** < 500ms
- **Component render:** < 100ms
- **Keyboard response:** < 50ms
- **Bulk operations:** < 200ms for 10 components
- **Context menu show:** < 50ms

## Browser Compatibility

Tested and verified on:
- ✅ Chrome/Edge (Chromium-based)
- ✅ Firefox
- ✅ Safari (WebKit)

All modern evergreen browsers should work.

## Troubleshooting

### Tests Failing Locally

1. **Clear browser cache** and reload
2. **Check server is running** on correct port
3. **Verify tool loads** manually first
4. **Check console for errors** in browser DevTools

### Playwright Installation Issues

1. **Run:** `npx playwright install --force chromium`
2. **Check:** System dependencies installed
3. **Try:** Different browser: `--project=firefox`

### Performance Issues

1. **Reduce** number of components for testing
2. **Clear** localStorage: `localStorage.clear()`
3. **Restart** development server
4. **Check** for memory leaks in DevTools

## Future Enhancements

Potential test improvements:

1. **Visual regression testing** with screenshot comparison
2. **Accessibility testing** (ARIA labels, keyboard nav)
3. **Performance profiling** with lighthouse
4. **Cross-browser automated testing** in CI
5. **Integration tests** with other DevChef tools
6. **User interaction recordings** for bug reports

## Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Update this README** with new test coverage
3. **Run all tests** before committing
4. **Add test cases** for edge cases and error conditions
5. **Document** any new test utilities or helpers

## Contact

For test-related questions or issues, please file an issue in the repository.
