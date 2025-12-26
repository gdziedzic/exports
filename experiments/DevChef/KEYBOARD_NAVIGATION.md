# DevChef Keyboard Navigation

## Overview

DevChef includes comprehensive keyboard navigation for the tools panel, allowing you to browse and select tools without using a mouse.

## Features

### Navigation Controls

| Key | Action |
|-----|--------|
| **ArrowDown** | Move selection to next tool |
| **ArrowUp** | Move selection to previous tool |
| **Home** | Jump to first tool |
| **End** | Jump to last tool |
| **Enter** | Open the currently selected tool |
| **Escape** | Clear search and reset selection |
| **Ctrl+Shift+F** (or **Cmd+Shift+F**) | Focus the search box |

### Visual Feedback

When a tool is selected via keyboard:
- The tool item is highlighted with a blue accent background
- A 3px blue border appears on the left side
- A subtle shadow indicates focus
- The selected tool automatically scrolls into view

### How It Works

1. **Focus the search box**: Click in the search box or press `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac)

2. **Navigate tools**: Use `ArrowDown` and `ArrowUp` to move through the list
   - The selection wraps at the boundaries (pressing `ArrowUp` at the first tool deselects all)
   - The selection stops at the last tool when pressing `ArrowDown`

3. **Search while navigating**: Type to filter tools, then use arrow keys to navigate through filtered results
   - The selection resets when you change the search query
   - All keyboard shortcuts continue to work with filtered results

4. **Open a tool**: Press `Enter` to open the currently selected tool
   - If only one tool matches your search, pressing `Enter` opens it automatically
   - If no tool is selected, `Enter` opens the first matching tool (if only one exists)

5. **Quick navigation**:
   - Press `Home` to jump to the first tool
   - Press `End` to jump to the last tool

6. **Clear and reset**: Press `Escape` to clear the search box and reset selection

## Implementation Details

### Code Structure

The keyboard navigation is implemented in `/app.js`:
- **Function**: `setupToolSearch(context)` (line 499)
- **Helper**: `updateToolSelection(toolItems, selectedIndex)` (line 588)

### CSS Classes

The visual styling is defined in `/app.css`:
- **Class**: `.tool-item.keyboard-selected` (line 272)
- Applies blue accent background, left border, and shadow

### State Management

- Selection index is tracked in the `selectedToolIndex` variable
- Index ranges from `-1` (no selection) to `toolItems.length - 1`
- Selection resets to `-1` when:
  - Search query changes
  - `Escape` is pressed
  - User starts typing in the search box

## Testing

Comprehensive E2E tests are available in `/tests/e2e/keyboard-navigation.spec.js`:

### Test Coverage

1. **Basic Navigation**
   - Navigate down with ArrowDown
   - Navigate up with ArrowUp
   - Jump to first with Home
   - Jump to last with End

2. **Boundaries**
   - Cannot go beyond first tool
   - Cannot go beyond last tool

3. **Tool Opening**
   - Open tool with Enter
   - Open single matching tool automatically

4. **Search Integration**
   - Selection resets on search
   - Clear search with Escape
   - Navigate through filtered results

5. **Visual Feedback**
   - Scroll selected tool into view
   - Verify keyboard-selected class
   - Check visual styling

6. **Edge Cases**
   - Rapid keyboard navigation
   - Empty search results
   - Switching between mouse and keyboard

### Running Tests

```bash
# Install dependencies (first time only)
npm install
npm run test:install

# Run keyboard navigation tests
npm test tests/e2e/keyboard-navigation.spec.js

# Run in headed mode (see browser)
npm run test:headed tests/e2e/keyboard-navigation.spec.js

# Run with Playwright UI
npm run test:ui tests/e2e/keyboard-navigation.spec.js
```

## Accessibility

The keyboard navigation feature improves accessibility by:
- Allowing complete mouse-free operation
- Providing clear visual feedback for keyboard users
- Supporting standard navigation patterns (arrows, Home, End)
- Maintaining focus visibility with `keyboard-selected` class
- Scrolling selected items into view automatically

## Browser Compatibility

Keyboard navigation works in all modern browsers that support:
- ES6 event handling
- `KeyboardEvent.key` property
- `Element.scrollIntoView()` API
- CSS custom properties for theming

Tested in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

Potential improvements:
- Add Page Up/Page Down support for faster navigation
- Support type-ahead search (start typing to filter)
- Add visual indication of keyboard mode activation
- Support Tab/Shift+Tab for navigation
- Remember last selected tool across sessions
