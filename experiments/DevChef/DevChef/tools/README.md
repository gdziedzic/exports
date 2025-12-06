# DevChef Tools

This directory contains all the self-contained developer tools available in DevChef.

## 📁 Directory Structure

```
tools/
├── index.json                    # Tool registry (required)
├── base64-tool.html             # Example: Base64 encoder/decoder
├── sql-emmet-ultimate.html      # Example: SQL generator
├── extractor-v5.html            # Example: Pattern extractor
└── ... (38 total tools)
```

## 🎯 What Are DevChef Tools?

DevChef tools are **self-contained HTML files** that provide specific developer utilities. Each tool is:

- **Self-contained**: Single HTML file with embedded CSS and JavaScript
- **No dependencies**: Works standalone or within DevChef
- **Modular**: Can be added/removed independently
- **Offline-first**: No external API calls required

## 📋 Tool Categories

Tools are organized into categories:

### 🔤 Text & Encoding
- `string-cleaner.html` - Clean and format strings
- `base64-tool.html` - Base64 encoding/decoding
- `url-encoder.html` - URL encoding/decoding
- `uuid-generator.html` - UUID/GUID generation
- `hash-generator.html` - Generate MD5, SHA hashes

### 📊 Data Formats
- `json-formatter.html` - Format and validate JSON
- `csv-json-converter.html` - Convert CSV ↔ JSON
- `html-converter.html` - HTML encoding/decoding
- `xml-formatter.html` - XML formatting

### 🛠️ Developer Tools
- `regex-tester.html` - Test regular expressions
- `timestamp-converter.html` - Unix timestamp converter
- `color-picker.html` - Color picker and converter
- `lorem-ipsum.html` - Lorem ipsum generator
- `jwt-decoder.html` - JWT token decoder
- `diff-checker.html` - Text diff comparison
- `curl-builder.html` - Build cURL commands
- `http-mock-api.html` - Mock HTTP API server

### 💾 Database & SQL
- `sql-formatter.html` - Format SQL queries
- `sql-emmet-ultimate.html` - **⚡ ULTIMATE SQL generator**
- `sql-emmet-v5.html` - Schema-aware SQL generator
- `sql-data-generator.html` - Generate test data
- `connection-string-builder.html` - Build connection strings
- `tsql-snippets.html` - T-SQL code snippets
- `sql-join-helper.html` - SQL JOIN visualizer
- `table-schema-generator.html` - Generate table schemas
- `kql-builder.html` - KQL query builder

### 🔬 Advanced Tools
- `extractor-v5.html` - **⚡ Pattern extraction with tests**
- `code-transformer.html` - Transform code between formats
- `data-pipeline-studio.html` - Build data pipelines
- `template-transform.html` - Template transformations
- `line-operations.html` - Multi-line text operations
- `quick-calc.html` - Quick calculator
- `fix-parser.html` - FIX protocol parser

## 🏗️ Tool Structure

Every DevChef tool follows this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tool Name</title>
</head>
<body>

<!-- DevChef Manifest (Required) -->
<script type="devchef-manifest">
{
  "id": "tool-id",
  "name": "Tool Name",
  "category": "Category Name",
  "description": "What the tool does",
  "version": "1.0.0",
  "keywords": ["keyword1", "keyword2"]
}
</script>

<!-- Tool UI Template (Required) -->
<template id="tool-ui">
  <div class="tool-container">
    <!-- Your tool's HTML here -->
  </div>
</template>

<!-- Tool Styles (Optional but recommended) -->
<style>
  /* Your tool's CSS here */
</style>

<!-- Standalone Styles (For standalone mode) -->
<style id="standalone-styles">
  /* Styles when tool runs outside DevChef */
</style>

<!-- Tool Module Logic (Required) -->
<script type="module">
export const DevChefTool = {
  container: null,
  context: null,

  init(container, context) {
    this.container = container;
    this.context = context;
    // Initialize your tool
  },

  cleanup() {
    // Clean up when tool is unloaded
  }
};

// Standalone mode
if (typeof window !== 'undefined' && !window.DevChef) {
  document.addEventListener('DOMContentLoaded', () => {
    // Standalone initialization
  });
}
</script>

</body>
</html>
```

## 📝 Manifest Fields

The `devchef-manifest` script tag must include:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ Yes | Unique identifier (lowercase, dashes) |
| `name` | ✅ Yes | Display name |
| `category` | ✅ Yes | Category for organization |
| `description` | ✅ Yes | Brief description |
| `version` | ❌ No | Version string (e.g., "1.0.0") |
| `keywords` | ❌ No | Array of search keywords |

### Categories
- Text & Encoding
- Data Formats
- Developer Tools
- Database
- SQL/Database
- Advanced
- Custom category name

## 🔧 DevChefTool API

### Required Methods

```javascript
// Initialize the tool
init(container, context) {
  // container: DOM element where tool is mounted
  // context: Object with DevChef APIs
}

// Clean up when tool is unloaded
cleanup() {
  // Remove event listeners, timers, etc.
}
```

### Context API

The `context` object provides:

```javascript
context = {
  // Get/Set input/output values
  getInput() { },
  setInput(value) { },
  getOutput() { },
  setOutput(value) { },

  // Storage
  storage: {
    get(key) { },
    set(key, value) { },
    remove(key) { }
  },

  // Notifications
  notify(message, type) { },

  // State management
  state: { },

  // Tool ID
  toolId: 'your-tool-id'
}
```

## ➕ Adding a New Tool

### Step 1: Create Tool File

Create a new HTML file in the `tools/` directory:

```bash
tools/my-awesome-tool.html
```

### Step 2: Add Tool Structure

Use the template above and implement your tool logic.

### Step 3: Register in Index

Add your tool filename to `tools/index.json`:

```json
[
  "existing-tool.html",
  "another-tool.html",
  "my-awesome-tool.html"
]
```

### Step 4: Test

1. Reload DevChef (Ctrl+R or Cmd+R)
2. Open Command Palette (Ctrl+K or Cmd+K)
3. Search for your tool name
4. Test functionality

## 🎨 Styling Guidelines

### Use CSS Variables

DevChef provides CSS variables for theming:

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #2c3e50;
  --text-secondary: #7f8c8d;
  --accent: #3498db;
  --border-color: #d0d0d0;
  --font-mono: 'Monaco', 'Menlo', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Responsive Design

Tools should work on different screen sizes:

```css
@media (max-width: 768px) {
  .tool-container {
    padding: 12px;
  }
}
```

## 💡 Best Practices

### ✅ DO

- Keep tools self-contained (no external dependencies)
- Use semantic HTML
- Provide clear labels and placeholders
- Handle errors gracefully
- Include keyboard shortcuts
- Support both light and dark themes
- Add helpful tooltips
- Validate user input
- Provide example data
- Clean up in `cleanup()` method

### ❌ DON'T

- Don't use external CDN resources
- Don't require internet connection
- Don't use global variables (except `DevChefTool`)
- Don't modify DevChef's global state
- Don't use `alert()` (use `context.notify()`)
- Don't leave console.log in production
- Don't hard-code colors (use CSS variables)

## 🔥 Featured Tools

### ⚡ SQL Emmet ULTIMATE
**File**: `sql-emmet-ultimate.html`

The ultimate SQL generator with:
- Full schema context (no table selection)
- Natural language mode
- Visual query builder
- Smart shortcuts
- Real-time SQL generation
- Performance analysis
- Template library

**Example commands**:
```
users.id,email,name[active=1]^created desc#10
users>orders>products
users|country,count(*)^count desc
```

### ⚡ Extractor V5
**File**: `extractor-v5.html`

Pattern extraction tool with:
- 60+ regex patterns
- Test suite with 14 tests
- Test data library
- Pattern search
- Scrollable results
- Analytics

## 🧪 Testing Your Tool

### Standalone Mode

Open your tool directly in a browser:

```bash
# Start a local server
python -m http.server 8000

# Open in browser
http://localhost:8000/tools/my-tool.html
```

### Within DevChef

1. Start DevChef server
2. Open DevChef in browser
3. Use Command Palette to open your tool
4. Test all functionality

### Test Checklist

- [ ] Tool loads without errors
- [ ] All buttons/inputs work
- [ ] Keyboard shortcuts work
- [ ] Copy/paste works
- [ ] Error handling works
- [ ] Standalone mode works
- [ ] Responsive on mobile
- [ ] Dark mode supported
- [ ] Cleanup properly on unload

## 📚 Examples to Learn From

### Simple Tools
- `base64-tool.html` - Simple encoder/decoder
- `uuid-generator.html` - Simple generator
- `color-picker.html` - Interactive picker

### Medium Complexity
- `regex-tester.html` - Multiple features
- `json-formatter.html` - Validation + formatting
- `diff-checker.html` - Side-by-side comparison

### Advanced Tools
- `sql-emmet-ultimate.html` - Multiple modes, complex logic
- `extractor-v5.html` - Test suite, analytics
- `data-pipeline-studio.html` - Visual editor

## 🚀 Performance Tips

1. **Lazy Load**: Don't initialize heavy features until needed
2. **Debounce**: Debounce input handlers for real-time updates
3. **Cleanup**: Always remove event listeners in `cleanup()`
4. **Minimize DOM**: Use efficient DOM manipulation
5. **Cache**: Cache expensive computations

## 🐛 Debugging

### Enable Debug Mode

```javascript
init(container, context) {
  this.debug = true; // Enable debug logging
  if (this.debug) console.log('Tool initialized');
}
```

### Common Issues

**Tool not showing in DevChef**:
- Check `index.json` includes your filename
- Check manifest JSON is valid
- Check tool ID is unique

**Styles not working**:
- Check CSS variables are defined
- Check specificity of selectors
- Check standalone-styles for standalone mode

**Tool not cleaning up**:
- Implement `cleanup()` method
- Remove all event listeners
- Clear all timers/intervals

## 📖 Additional Resources

- **Main README**: `../README.md` - DevChef overview
- **Core README**: `../core/README.md` - Core architecture
- **CLAUDE.md**: `../CLAUDE.md` - AI assistant guidelines

## 🤝 Contributing

When adding new tools:

1. Follow the structure template
2. Add to `index.json`
3. Test thoroughly
4. Use semantic naming
5. Document complex logic
6. Include examples

## 📄 License

Same as DevChef main project.

---

**Happy Tool Building!** 🎉

For questions or issues, refer to the main DevChef documentation.
