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

### 🧩 DevChef Reference Tools
- `tool-shell-demo.html` - Reference implementation for `core/tool-shell.js`

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

For new text-in/text-out tools, prefer the reusable shell in `core/tool-shell.js` before writing custom copy, clear, import/export, example, validation, and settings wiring. See `tool-shell-demo.html` for a complete reference.

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

Add your tool metadata to `tools/index.json`:

```json
[
  {
    "file": "my-awesome-tool.html",
    "id": "my-awesome-tool",
    "name": "My Awesome Tool",
    "category": "Developer Tools",
    "tags": ["api", "json"],
    "aliases": ["awesome helper", "api helper"],
    "examples": ["Format an API payload"],
    "maturity": "beta",
    "lastUpdated": "2026-04-23",
    "testCoverage": "manual-smoke"
  }
]
```

Legacy filename-only entries still load, but rich metadata is required for discoverability, search boosting, diagnostics, and generated docs. Run `npm run generate:tools-readme` after metadata changes.

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

### Examples And Presets

Use two levels of examples:

- `tools/index.json` `examples` should stay short and searchable, such as `"Format an API payload"` or `"Decode base64 payload"`.
- Tool runtime presets should use rich objects with realistic data:

```js
createToolShell(container, context, {
  examples: [
    {
      id: 'api-payload',
      label: 'API Payload',
      input: '{"status":"ok","items":[{"id":1}]}',
      settings: { indent: '2' },
      controls: { '#sort-keys': true }
    }
  ]
});
```

`core/tool-presets.js` normalizes example strings and rich preset objects. `core/tool-shell.js` applies runnable examples to input, output, settings, and selector-based controls.

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

<!-- devchef-tools:start -->
## Tool Metadata Index

Generated from `tools/index.json`. Run `npm run generate:tools-readme` after changing tool metadata.

| Tool | Category | Tags | Aliases | Maturity | Coverage | Last Updated | Examples |
|------|----------|------|---------|----------|----------|--------------|----------|
| KQL Builder | Azure | kql, azure, application-insights, query | kusto, kusto query, app insights query | stable | e2e | 2026-04-23 | Build Application Insights query<br>Format KQL pipeline |
| Timestamp Converter | Converters | time, date, unix, epoch, converter | unix time, epoch converter, timestamp | stable | manual-smoke | 2026-04-23 | Convert Unix timestamp<br>Use current time |
| JWT Decoder | Crypto | jwt, token, decode, security | json web token, bearer token, decode jwt | stable | manual-smoke | 2026-04-23 | Inspect JWT claims<br>Decode token header |
| CSV ⇄ JSON | Data | csv, json, convert, data | csv to json, json to csv, table converter | stable | manual-smoke | 2026-04-23 | Convert CSV rows to JSON<br>Export JSON as CSV |
| Data Pipeline Studio | Data | data, pipeline, workflow, transform | pipeline builder, data workflow, etl studio | beta | manual-smoke | 2026-04-23 | Build multi-step data pipeline<br>Chain transformations |
| JSON Formatter | Data | json, format, validate, data | pretty json, json validator, minify json | stable | manual-smoke | 2026-04-23 | Format JSON payload<br>Validate malformed JSON |
| Connection String | Database | database, connection-string, config, credentials | dsn builder, connection string, database url | beta | manual-smoke | 2026-04-23 | Build SQL Server connection string<br>Assemble Postgres URL |
| JSON Schema Loader | Database | json, schema, database, loader | schema loader, json schema, schema import | beta | manual-smoke | 2026-04-23 | Load JSON schema<br>Map schema fields |
| SQL Data Gen | Database | sql, data, generator, fixtures | seed data, insert generator, mock sql data | beta | manual-smoke | 2026-04-23 | Generate INSERT statements<br>Create test rows |
| SQL Emmet ULTIMATE | Database | sql, emmet, database, generation | sql emmet, query shorthand, sql generator | beta | manual-smoke | 2026-04-23 | Expand SQL shorthand<br>Generate query skeleton |
| SQL Formatter | Database | sql, database, format, query | format sql, sql beautifier, query formatter | stable | manual-smoke | 2026-04-23 | Format SELECT query<br>Normalize SQL indentation |
| SQL Join Helper | Database | sql, join, database, query | join builder, sql joins, join helper | beta | manual-smoke | 2026-04-23 | Build INNER JOIN<br>Explain join type |
| T-SQL Snippets | Database | tsql, sql-server, snippets, database | sql snippets, t-sql reference, sql server snippets | stable | manual-smoke | 2026-04-23 | Find T-SQL maintenance snippet<br>Copy query pattern |
| Table Schema | Database | schema, table, database, ddl | schema builder, table ddl, create table | beta | manual-smoke | 2026-04-23 | Generate table schema<br>Draft CREATE TABLE columns |
| Color Picker & Themes | Design | color, design, palette, theme | hex picker, rgb converter, theme colors | beta | manual-smoke | 2026-04-23 | Pick a color<br>Convert HEX to RGB |
| Quick Calc | Dev | calculator, math, quick, numbers | calc, calculator, quick math | beta | manual-smoke | 2026-04-23 | Evaluate expression<br>Calculate percentages |
| Config Manager | DevChef | devchef, settings, configuration, storage | settings manager, tool config | beta | manual-smoke | 2026-04-23 | Review enabled tools<br>Manage DevChef configuration |
| HTML Converter | DevChef | html, entities, escape, unescape | html entities, escape html, unescape html | stable | manual-smoke | 2026-04-23 | Encode HTML entities<br>Decode pasted markup |
| AI Prompt Builder | Developer Tools | ai, prompt, llm, template, chatgpt | prompt builder, llm prompt, chatgpt prompt | stable | e2e | 2026-04-23 | Build structured prompt<br>Save reusable prompt template |
| FIX Parser | Developer Tools | fix, parser, finance, protocol, trading | fix decoder, fix message, financial protocol | beta | manual-smoke | 2026-04-23 | Decode FIX message<br>Inspect trading session fields |
| HTTP Mock API | Developer Tools | http, api, mock, rest, testing | mock server, fake api, rest mock | beta | manual-smoke | 2026-04-23 | Mock JSON endpoint<br>Test API response shape |
| Prompt Forge | Developer Tools | ai, prompt, llm, advanced, examples | prompt engineering, prompt forge, few shot prompt | stable | e2e | 2026-04-23 | Compose prompt from slots<br>Manage prompt templates |
| Bimble Transforms | Development | transform, text, csv, template | bimble, row transform, bulk transform | beta | manual-smoke | 2026-04-23 | Transform rows with pattern<br>Generate SQL from CSV |
| Code Transformer | Development | code, transform, developer, refactor | code converter, case converter, code cleanup | beta | manual-smoke | 2026-04-23 | Transform code casing<br>Convert code snippets |
| cURL Builder | Development | http, curl, api, request | curl command, api request, http request builder | beta | manual-smoke | 2026-04-23 | Build POST request<br>Add headers to curl |
| Template Transform | Development | template, transform, markdown, generator | readme generator, template engine, text template | beta | manual-smoke | 2026-04-23 | Generate README<br>Render template with data |
| Base64 Encoder/Decoder | Encoding | encoding, base64, decode, encode | b64, base64 decode, base64 encode | stable | manual-smoke | 2026-04-23 | Decode base64 payload<br>Encode text for transport |
| URL Encoder/Decoder | Encoding | encoding, url, uri, percent-encoding | url decode, uri encode, percent encode | stable | manual-smoke | 2026-04-23 | Decode query string<br>Encode URL component |
| Hash Generator | Generators | hash, crypto, checksum, sha, md5 | sha256, md5, checksum | stable | manual-smoke | 2026-04-23 | Hash text with SHA-256<br>Compare checksums |
| UUID Generator | Generators | generator, uuid, guid, random | guid generator, uuid v4 | stable | manual-smoke | 2026-04-23 | Generate UUID batch<br>Copy GUIDs for fixtures |
| Diff Checker | Text | diff, compare, text, review | text compare, compare files, side by side diff | stable | manual-smoke | 2026-04-23 | Compare two snippets<br>Review text changes |
| Extractor V5 Ultimate | Text | extract, regex, text, scrape, validate | extractor, pattern extractor, text extraction | beta | manual-smoke | 2026-04-23 | Extract URLs and emails<br>Validate common patterns |
| Line Operations | Text | text, lines, sort, dedupe | line tools, sort lines, unique lines | stable | manual-smoke | 2026-04-23 | Sort lines<br>Remove duplicate lines |
| Regex Tester | Text | regex, text, match, validate | regexp, regular expression, pattern tester | stable | manual-smoke | 2026-04-23 | Test a regex<br>Extract matching groups |
| String Cleaner | Text | text, cleanup, normalize, whitespace | trim, dedupe spaces, clean text | stable | manual-smoke | 2026-04-23 | Trim pasted text<br>Normalize whitespace |
<!-- devchef-tools:end -->
