# DevChef Component Library Documentation

**Version:** 1.0.0
**Author:** DevChef Team
**Last Updated:** 2025-12-29

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Component Reference](#component-reference)
   - [ToolButton](#toolbutton)
   - [ToolTextarea](#tooltextarea)
   - [ToolInput](#toolinput)
   - [ToolSelect](#toolselect)
   - [ToolFileInput](#toolfileinput)
   - [ToolStatus](#toolstatus)
   - [ToolContainer](#toolcontainer)
4. [Migration Guide](#migration-guide)
5. [Best Practices](#best-practices)
6. [Examples](#examples)
7. [Tool Shell Helpers](#tool-shell-helpers)

---

## Overview

The DevChef Component Library is a collection of 7 reusable Web Components designed to eliminate UI duplication across DevChef tools, enforce design consistency, and accelerate tool development by **50%**.

### Key Benefits

- **🚀 50% Faster Development** - Reusable components reduce boilerplate code
- **📉 Code Reduction** - Average 25-35% reduction in tool code
- **🎨 Design Consistency** - Unified look and feel across all tools
- **♻️ Eliminates Duplication** - Removes ~130KB of duplicated CSS across 33+ tools
- **🔧 Easy Maintenance** - Update components once, affects all tools
- **📱 Responsive** - All components are mobile-friendly
- **🌗 Theme Support** - Light/dark theme support built-in

### Impact Metrics

| Metric | Value |
|--------|-------|
| **Tools Migrated** | 5 (base64, json-formatter, hash-generator, csv-json-converter, diff-checker) |
| **Avg. Code Reduction** | 27% per tool |
| **CSS Duplication Removed** | ~130KB (4,356 lines across 33 tools) |
| **Components Available** | 7 |
| **Build Size Impact** | -20% average (components + shared styles vs. duplicated CSS) |

---

## Getting Started

### Prerequisites

The component library requires:
- ES6 module support
- Web Components API (Custom Elements v1)
- Modern browser (Chrome 67+, Firefox 63+, Safari 12.1+, Edge 79+)

### Installation

The component library is automatically integrated into DevChef. No additional installation is required.

### Using Components in Tools

1. **Import shared styles** (automatically loaded in DevChef)
2. **Use component tags** in your tool's HTML template
3. **Access component API** via JavaScript

**Example:**

```html
<!-- In your tool's template -->
<template id="tool-ui">
  <div class="tool-container">
    <tool-textarea
      id="input"
      placeholder="Enter text..."
      monospace
      rows="8">
    </tool-textarea>

    <tool-button
      id="copy-btn"
      variant="primary"
      label="Copy">
    </tool-button>

    <tool-status id="status"></tool-status>
  </div>
</template>

<script type="module">
export const DevChefTool = {
  init(container, context) {
    const inputEl = container.querySelector("#input");
    const copyBtn = container.querySelector("#copy-btn");
    const statusEl = container.querySelector("#status");

    copyBtn.addEventListener("tool-click", () => {
      const value = inputEl.getValue();
      // ... copy logic
      statusEl.show("✓ Copied!", "success", 2000);
    });
  }
};
</script>
```

---

## Component Reference

### ToolButton

Smart button component with built-in states and variants.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | string | `"primary"` | Button style: `primary`, `secondary`, `danger` |
| `label` | string | `"Button"` | Button text label |
| `disabled` | boolean | `false` | Disabled state |
| `loading` | boolean | `false` | Loading state with spinner |
| `icon` | string | `""` | Optional icon (emoji or text) |

#### Events

- **`tool-click`** - Emitted when button is clicked (doesn't fire when disabled/loading)

#### Methods

- **`setLoading(isLoading: boolean)`** - Set loading state
- **`setDisabled(isDisabled: boolean)`** - Set disabled state
- **`setLabel(label: string)`** - Update button label

#### Example

```html
<!-- Markup -->
<tool-button
  id="my-btn"
  variant="primary"
  label="Click Me"
  icon="📋">
</tool-button>

<!-- JavaScript -->
<script>
const btn = document.querySelector("#my-btn");

// Listen for clicks
btn.addEventListener("tool-click", () => {
  btn.setLoading(true);

  // Do async work...
  setTimeout(() => {
    btn.setLoading(false);
    btn.setLabel("✓ Done!");
  }, 2000);
});
</script>
```

---

### ToolTextarea

Enhanced textarea with auto-resize and monospace options.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `placeholder` | string | `""` | Placeholder text |
| `rows` | number | `8` | Initial number of rows |
| `monospace` | boolean | `false` | Use monospace font |
| `readonly` | boolean | `false` | Read-only state |
| `autoresize` | boolean | `false` | Auto-resize to fit content |
| `value` | string | `""` | Initial value |

#### Events

- **`input`** - Emitted when content changes (detail: `{value}`)
- **`change`** - Emitted when content changes and loses focus (detail: `{value}`)

#### Methods

- **`getValue(): string`** - Get current value
- **`setValue(value: string)`** - Set value
- **`clear()`** - Clear content
- **`focus()`** - Focus the textarea

#### Example

```html
<!-- Markup -->
<tool-textarea
  id="code-input"
  placeholder="Enter code..."
  monospace
  autoresize
  rows="5">
</tool-textarea>

<!-- JavaScript -->
<script>
const textarea = document.querySelector("#code-input");

// Listen for input
textarea.addEventListener("input", (e) => {
  console.log("Value changed:", e.detail.value);
});

// Get/set value
const value = textarea.getValue();
textarea.setValue("New content");
</script>
```

---

### ToolInput

Enhanced text input with validation support.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `placeholder` | string | `""` | Placeholder text |
| `type` | string | `"text"` | Input type (text, number, email, url, etc.) |
| `value` | string | `""` | Initial value |
| `readonly` | boolean | `false` | Read-only state |
| `pattern` | string | `""` | Validation pattern (regex) |

#### Events

- **`input`** - Emitted when content changes (detail: `{value}`)
- **`change`** - Emitted when content changes and loses focus (detail: `{value}`)

#### Methods

- **`getValue(): string`** - Get current value
- **`setValue(value: string)`** - Set value
- **`clear()`** - Clear content
- **`focus()`** - Focus the input
- **`isValid(): boolean`** - Check if input passes validation

#### Example

```html
<!-- Markup -->
<tool-input
  id="email-input"
  type="email"
  placeholder="email@example.com">
</tool-input>

<!-- JavaScript -->
<script>
const input = document.querySelector("#email-input");

input.addEventListener("change", () => {
  if (input.isValid()) {
    console.log("Valid email:", input.getValue());
  } else {
    console.log("Invalid email!");
  }
});
</script>
```

---

### ToolSelect

Enhanced select dropdown.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `options` | string (JSON) | `[]` | Array of `{value, label}` objects |
| `value` | string | `""` | Selected value |
| `placeholder` | string | `""` | Placeholder option (disabled) |

#### Events

- **`change`** - Emitted when selection changes (detail: `{value}`)

#### Methods

- **`getValue(): string`** - Get selected value
- **`setValue(value: string)`** - Set selected value
- **`setOptions(options: Array)`** - Update options

#### Example

```html
<!-- Markup -->
<tool-select
  id="size-select"
  options='[{"value":"sm","label":"Small"},{"value":"md","label":"Medium"},{"value":"lg","label":"Large"}]'
  value="md">
</tool-select>

<!-- JavaScript -->
<script>
const select = document.querySelector("#size-select");

select.addEventListener("change", (e) => {
  console.log("Selected:", e.detail.value);
});

// Dynamically update options
select.setOptions([
  {value: "xs", label: "Extra Small"},
  {value: "sm", label: "Small"},
  {value: "md", label: "Medium"},
  {value: "lg", label: "Large"},
  {value: "xl", label: "Extra Large"}
]);
</script>
```

---

### ToolFileInput

File input with drag-drop support.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `accept` | string | `""` | Accepted file types (e.g., ".json,.csv") |
| `multiple` | boolean | `false` | Allow multiple files |
| `label` | string | `"Choose File"` | Button label |

#### Events

- **`file-loaded`** - Emitted when file(s) are loaded (detail: `{files, contents}`)

#### Example

```html
<!-- Markup -->
<tool-file-input
  id="json-loader"
  accept=".json"
  label="Load JSON">
</tool-file-input>

<!-- JavaScript -->
<script>
const fileInput = document.querySelector("#json-loader");

fileInput.addEventListener("file-loaded", (e) => {
  const { files, contents } = e.detail;

  contents.forEach(({file, content}) => {
    console.log(`Loaded ${file.name}:`, content);
  });
});
</script>
```

---

### ToolStatus

Status/notification display with auto-dismiss.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `message` | string | `""` | Status message |
| `type` | string | `"info"` | Status type: `success`, `error`, `warning`, `info` |
| `duration` | number | `0` | Auto-dismiss duration in ms (0 = no auto-dismiss) |

#### Methods

- **`show(message: string, type: string, duration: number)`** - Show status
- **`hide()`** - Hide status

#### Example

```html
<!-- Markup -->
<tool-status id="status"></tool-status>

<!-- JavaScript -->
<script>
const status = document.querySelector("#status");

// Show success message for 3 seconds
status.show("✓ Operation successful!", "success", 3000);

// Show error message (no auto-dismiss)
status.show("✗ An error occurred", "error");

// Hide manually
setTimeout(() => {
  status.hide();
}, 5000);
</script>
```

---

### ToolContainer

Layout container with responsive layouts.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `layout` | string | `"single"` | Layout type: `single`, `split`, `grid` |

#### Slots

- **`header`** - Header content
- **`main`** - Main content (default slot)
- **`footer`** - Footer content

#### Example

```html
<tool-container layout="split">
  <div slot="header">
    <h2>My Tool</h2>
  </div>

  <div slot="main">
    <!-- Main content -->
  </div>

  <div slot="footer">
    <!-- Footer content -->
  </div>
</tool-container>
```

---

## Migration Guide

### Step 1: Remove Standalone Styles

**Before:**
```html
<style id="standalone-styles">
  /* 132 lines of duplicated CSS */
</style>
```

**After:**
```html
<!-- Remove the entire standalone-styles block -->
<!-- Styles are now provided by tools/shared-styles.css -->
```

### Step 2: Replace Raw HTML with Components

**Before:**
```html
<textarea id="input" placeholder="Enter text..."></textarea>
<button id="copy-btn">Copy</button>
<div id="status"></div>
```

**After:**
```html
<tool-textarea id="input" placeholder="Enter text..." monospace rows="8"></tool-textarea>
<tool-button id="copy-btn" variant="primary" label="Copy"></tool-button>
<tool-status id="status"></tool-status>
```

### Step 3: Update JavaScript Event Listeners

**Before:**
```javascript
const copyBtn = container.querySelector("#copy-btn");
copyBtn.addEventListener("click", () => {
  // ...
});
```

**After:**
```javascript
const copyBtn = container.querySelector("#copy-btn");
copyBtn.addEventListener("tool-click", () => {
  // ...
});
```

### Step 4: Use Component Methods

**Before:**
```javascript
const textarea = container.querySelector("#input");
const value = textarea.value;
textarea.value = "new value";
```

**After:**
```javascript
const textarea = container.querySelector("#input");
const value = textarea.getValue();
textarea.setValue("new value");
```

### Expected Results

- **25-35% code reduction** per tool
- **Removal of 132-line CSS block** (standalone-styles)
- **Consistent UI** across all tools
- **Easier maintenance** through centralized components

---

## Best Practices

### 1. Always Use Component Methods

✅ **Good:**
```javascript
const value = textarea.getValue();
textarea.setValue("new value");
```

❌ **Bad:**
```javascript
const value = textarea.querySelector('textarea').value;
textarea.querySelector('textarea').value = "new value";
```

### 2. Handle Events Properly

✅ **Good:**
```javascript
button.addEventListener("tool-click", () => {
  // Handle click
});
```

❌ **Bad:**
```javascript
button.querySelector('button').addEventListener("click", () => {
  // Fragile, bypasses component logic
});
```

### 3. Leverage Auto-Dismiss for Transient Messages

```javascript
// Success/info messages - auto-dismiss
status.show("✓ Saved!", "success", 2000);

// Errors - require manual dismiss or longer duration
status.show("✗ Failed to save", "error", 5000);
```

### 4. Use Appropriate Button Variants

- **`primary`** - Main action (submit, save, apply)
- **`secondary`** - Secondary actions (copy, clear, cancel)
- **`danger`** - Destructive actions (delete, reset)

### 5. Keep Tool-Specific Styles Minimal

Only add custom CSS for tool-specific layouts and designs. Use shared CSS variables for colors and spacing.

```css
/* ✅ Good - tool-specific layout */
.my-custom-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--spacing-md); /* Use CSS variable */
}

/* ❌ Bad - duplicating shared styles */
.my-custom-grid {
  background: #f5f5f5; /* Use var(--bg-secondary) instead */
  padding: 16px; /* Use var(--spacing-md) instead */
}
```

---

## Examples

### Example 1: Simple Text Transformer

```html
<template id="tool-ui">
  <div class="tool-container">
    <div class="tool-header">
      <h2 class="tool-title">Text Transformer</h2>
      <p class="tool-description">Transform text to uppercase or lowercase</p>
    </div>

    <div class="tool-section">
      <label class="section-label">Input</label>
      <tool-textarea id="input" placeholder="Enter text..." rows="5"></tool-textarea>
    </div>

    <div class="tool-section">
      <tool-button id="uppercase-btn" variant="primary" label="UPPERCASE"></tool-button>
      <tool-button id="lowercase-btn" variant="secondary" label="lowercase"></tool-button>
    </div>

    <div class="tool-section">
      <tool-status id="status"></tool-status>
    </div>

    <div class="tool-section">
      <label class="section-label">Output</label>
      <tool-textarea id="output" readonly rows="5"></tool-textarea>
    </div>
  </div>
</template>

<script type="module">
export const DevChefTool = {
  init(container, context) {
    const inputEl = container.querySelector("#input");
    const outputEl = container.querySelector("#output");
    const statusEl = container.querySelector("#status");
    const uppercaseBtn = container.querySelector("#uppercase-btn");
    const lowercaseBtn = container.querySelector("#lowercase-btn");

    uppercaseBtn.addEventListener("tool-click", () => {
      const value = inputEl.getValue();
      outputEl.setValue(value.toUpperCase());
      statusEl.show("✓ Converted to uppercase", "success", 2000);
    });

    lowercaseBtn.addEventListener("tool-click", () => {
      const value = inputEl.getValue();
      outputEl.setValue(value.toLowerCase());
      statusEl.show("✓ Converted to lowercase", "success", 2000);
    });
  }
};
</script>
```

### Example 2: Form with Validation

```html
<template id="tool-ui">
  <div class="tool-container">
    <div class="tool-section">
      <label class="section-label">Email</label>
      <tool-input id="email" type="email" placeholder="email@example.com"></tool-input>
    </div>

    <div class="tool-section">
      <label class="section-label">Age</label>
      <tool-select
        id="age"
        options='[{"value":"18-25","label":"18-25"},{"value":"26-35","label":"26-35"},{"value":"36+","label":"36+"}]'
        placeholder="Select age range...">
      </tool-select>
    </div>

    <div class="tool-section">
      <tool-button id="submit-btn" variant="primary" label="Submit"></tool-button>
      <tool-status id="status"></tool-status>
    </div>
  </div>
</template>

<script type="module">
export const DevChefTool = {
  init(container, context) {
    const emailEl = container.querySelector("#email");
    const ageEl = container.querySelector("#age");
    const submitBtn = container.querySelector("#submit-btn");
    const statusEl = container.querySelector("#status");

    submitBtn.addEventListener("tool-click", () => {
      if (!emailEl.isValid()) {
        statusEl.show("✗ Invalid email address", "error", 3000);
        return;
      }

      const age = ageEl.getValue();
      if (!age) {
        statusEl.show("✗ Please select an age range", "error", 3000);
        return;
      }

      statusEl.show("✓ Form submitted!", "success", 2000);
    });
  }
};
</script>
```

---

## Tool Shell Helpers

`core/tool-shell.js` provides optional helpers for tools that follow the common text input, actions, status, and output pattern. It does not replace the Web Components. It wires them together so new tools do not need to repeat copy, clear, import, export, examples, validation, and persisted settings code.

### Standard Markup

Use the default IDs when possible:

| Purpose | Default selector |
|---------|------------------|
| Input panel | `#input` |
| Output panel | `#output` |
| Status | `#status` |
| Process action | `#process-btn` |
| Copy action | `#copy-btn` |
| Clear action | `#clear-btn` |
| Reset action | `#reset-btn` |
| File import | `#import-file` |
| Export action | `#export-btn` |
| Examples | `[data-example-id]` |

### Minimal Tool

```html
<template id="tool-ui">
  <div class="tool-container tool-shell">
    <div class="tool-section">
      <label class="section-label">Input</label>
      <tool-textarea id="input" rows="8" monospace></tool-textarea>
    </div>

    <div class="tool-section tool-shell-actions">
      <div class="tool-shell-action-row">
        <tool-button id="process-btn" variant="primary" label="Format"></tool-button>
        <tool-button id="copy-btn" variant="secondary" label="Copy Result"></tool-button>
        <tool-button id="clear-btn" variant="secondary" label="Clear"></tool-button>
      </div>
    </div>

    <div class="tool-section">
      <tool-status id="status"></tool-status>
    </div>

    <div class="tool-section">
      <label class="section-label">Output</label>
      <tool-textarea id="output" rows="8" monospace readonly></tool-textarea>
    </div>
  </div>
</template>

<script type="module">
import { createToolShell } from '../core/tool-shell.js';

export const DevChefTool = {
  init(container, context) {
    this.shell = createToolShell(container, context, {
      validate(input) {
        return input.trim() ? true : 'Enter input before processing.';
      },
      process(input) {
        return input.trim();
      }
    });
  },
  cleanup() {
    this.shell?.cleanup();
  }
};
</script>
```

### Generated Template

For straightforward tools, `createToolShellTemplate()` can generate the repeated markup:

```js
import { createToolShell, createToolShellTemplate } from '../core/tool-shell.js';

const template = document.querySelector('#tool-ui');
template.innerHTML = createToolShellTemplate({
  title: 'Line Sorter',
  description: 'Sort text lines.',
  inputPlaceholder: 'Paste lines...',
  examples: [{ id: 'names', label: 'Names', input: 'Zoe\nAda' }],
  includeImport: true
});
```

### Persisted Settings

Pass settings descriptors and a `toolId` or `persistKey`. The shell reads values during initialization and saves them on each setting change.

```js
this.shell = createToolShell(container, context, {
  toolId: 'line-sorter',
  settings: [
    { key: 'caseSensitive', selector: '#case-sensitive', defaultValue: false },
    { key: 'sortOrder', selector: '#sort-order', defaultValue: 'asc' }
  ],
  process(input, shell) {
    const settings = shell.readSettingsFromControls();
    return sortLines(input, settings);
  }
});
```

### Validation Results

`validate(input, shell)` may return:

- `true`, `null`, or `undefined` for valid input.
- `false` for a generic error.
- A string for one validation message.
- An array of strings for multiple messages.
- `{ valid, message, messages, type }` for custom status behavior.

### Examples, Presets, Import, And Export

Example buttons should have `data-example-id` values that match `options.examples` or `options.presets`. File import uses `tool-file-input` and loads the first file into the input. Export writes the current output using `downloadAsFile()` from `core/tool-utils.js`.

`core/tool-presets.js` normalizes examples so tools can accept either catalog-only strings or runnable objects:

- `"Format an API payload"` creates a searchable/catalog example label.
- `{ id, label, input }` loads sample input.
- `{ id, label, input, output }` loads sample input and expected output.
- `{ id, label, input, settings }` also applies shell settings by descriptor key.
- `{ id, label, controls }` applies arbitrary controls by selector, such as `{ "#sort-keys": true }`.

```js
createToolShell(container, context, {
  examples: [
    'Format an API payload',
    {
      id: 'basic',
      label: 'Basic',
      input: 'hello',
      output: 'HELLO'
    },
    {
      id: 'sorted-json',
      label: 'Sorted JSON',
      input: '{"z":1,"a":2}',
      settings: { indent: '2' },
      controls: { '#sort-keys': true }
    }
  ],
  exportFilename: 'result.txt',
  exportMimeType: 'text/plain'
});
```

Catalog-only examples are useful in `tools/index.json` for search and generated docs. Runnable examples are best placed in the tool module or template so they can include realistic sample input, output, and settings.

---

## FAQ

**Q: Do I need to import components in every tool?**
A: No, components are automatically registered when DevChef loads. Just use the component tags in your HTML.

**Q: Can I style components?**
A: Components inherit from `tools/shared-styles.css` and respect CSS custom properties. You can customize by using CSS variables or adding tool-specific styles that target the component containers.

**Q: What browsers are supported?**
A: Modern browsers with Web Components support: Chrome 67+, Firefox 63+, Safari 12.1+, Edge 79+.

**Q: Can I create custom components?**
A: Yes! Extend `DevChefComponent` base class from `core/components.js` and register your component using `customElements.define()`.

**Q: How do I test components?**
A: Open `tools/component-demo.html` in your browser to see all components in action with interactive tests.

---

## Additional Resources

- **Component Demo:** [tools/component-demo.html](../tools/component-demo.html)
- **Template Tool:** [tools/_template.html](../tools/_template.html)
- **Tool Shell Demo:** [tools/tool-shell-demo.html](../tools/tool-shell-demo.html)
- **Shared Styles:** [tools/shared-styles.css](../tools/shared-styles.css)
- **Component Source:** [core/components.js](../core/components.js)
- **Tool Shell Source:** [core/tool-shell.js](../core/tool-shell.js)

---

**Last Updated:** 2026-04-23
**Questions?** Check the component demo or review migrated tools for examples.
