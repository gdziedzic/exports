# DevChef

An offline-first micro-tool engine for developers. DevChef provides a collection of essential developer utilities that work entirely offline in your browser.

## Features

- **Offline-First**: All tools work completely offline with no external dependencies
- **Modular Architecture**: Tools are loaded dynamically from HTML files
- **Command Palette**: Quick tool switching with `Ctrl+K` (or `Cmd+K` on Mac)
- **Theme Support**: Toggle between light and dark themes
- **Debug Console**: Built-in console for troubleshooting with `Ctrl+\`` (or `Cmd+\``)
- **Extensible**: Easy to add custom tools

## Available Tools

DevChef includes 28+ built-in tools organized by category:

### Text & Encoding
- **String Cleaner**: Clean and transform text strings
- **Base64 Tool**: Encode/decode Base64
- **URL Encoder**: Encode/decode URLs
- **Hash Generator**: Generate MD5, SHA-1, SHA-256, and other hashes
- **Lorem Ipsum**: Generate placeholder text

### Data Formats
- **JSON Formatter**: Format and validate JSON
- **CSV/JSON Converter**: Convert between CSV and JSON formats
- **HTML Converter**: Convert HTML entities and tags
- **Diff Checker**: Compare text differences

### Developer Tools
- **UUID Generator**: Generate UUIDs (v1, v4)
- **Timestamp Converter**: Convert between Unix timestamps and dates
- **Regex Tester**: Test and debug regular expressions
- **JWT Decoder**: Decode and inspect JWT tokens
- **Color Picker**: Pick and convert colors between formats

### SQL & Database
- **SQL Formatter**: Format SQL queries
- **SQL Data Generator**: Generate test data for SQL
- **Table Schema Generator**: Generate table schemas
- **SQL Join Helper**: Help construct SQL joins
- **T-SQL Snippets**: Useful T-SQL code snippets
- **Connection String Builder**: Build database connection strings

### Advanced Tools
- **Config Manager**: Manage configuration files
- **Cron Builder**: Build and validate cron expressions
- **Template Transform**: Transform text with templates
- **Bimble Transforms**: Advanced text transformations
- **Code Transformer**: Transform code patterns
- **Data Pipeline Studio**: Build data transformation pipelines
- **KQL Builder**: Build Kusto Query Language (KQL) queries for Azure
- **cURL Builder**: Build cURL commands for HTTP requests

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (optional but recommended)

### Installation

1. Clone or download this repository:
   ```bash
   git clone <repository-url>
   cd DevChef
   ```

2. Serve the files using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Using Node.js http-server
   npx http-server

   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to `http://localhost:8000`

### Direct File Access

Some browsers allow opening `index.html` directly, but using a local web server is recommended to avoid CORS issues.

## How to Use

1. **Select a Tool**: Click on any tool in the sidebar or press `Ctrl+K` to open the command palette
2. **Use the Tool**: Each tool has its own interface with inputs and controls
3. **Toggle Theme**: Click the theme button in the header to switch between light and dark modes
4. **Keyboard Shortcuts**:
   - `Ctrl+K` (or `Cmd+K`): Open command palette
   - `Ctrl+\`` (or `Cmd+\``): Toggle debug console

## Architecture

DevChef uses a modular architecture with the following components:

### Core Modules

- **app.js**: Main application entry point
- **core/registry.js**: Tool registry for managing loaded tools
- **core/loader.js**: Dynamic tool loader from HTML files
- **core/state.js**: Application state management
- **core/ui.js**: UI rendering and interactions
- **core/console.js**: Debug console implementation

### Tool Structure

Each tool is a self-contained HTML file with:

1. **Manifest**: JSON metadata (id, name, description, category, keywords)
2. **Template**: HTML structure for the tool's UI
3. **Styles**: CSS specific to the tool
4. **Module**: JavaScript module with tool logic

## Adding New Tools

To create a new tool:

1. Create a new HTML file in the `tools/` directory (e.g., `my-tool.html`)

2. Follow this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Tool</title>
</head>
<body>

<!-- Manifest -->
<script type="devchef-manifest">
{
  "id": "my-tool",
  "name": "My Tool",
  "description": "Description of what my tool does",
  "category": "Category Name",
  "keywords": ["keyword1", "keyword2"]
}
</script>

<!-- UI Template -->
<template id="tool-ui">
  <div class="tool-container">
    <h2>My Tool</h2>
    <div class="tool-content">
      <!-- Your tool's UI here -->
    </div>
  </div>
</template>

<!-- Styles -->
<style>
  /* Tool-specific styles */
</style>

<!-- Module -->
<script type="module">
  export function init(context) {
    // Initialize your tool
    console.log('My tool initialized');
  }

  export function cleanup(context) {
    // Clean up when switching tools
  }
</script>

</body>
</html>
```

3. Add your tool filename to `tools/index.json`:

```json
["string-cleaner.html", "my-tool.html", ...]
```

4. Reload DevChef and your tool will appear in the sidebar

## Project Structure

```
DevChef/
├── index.html          # Main entry point
├── app.js              # Application initialization
├── app.css             # Global styles
├── core/               # Core framework
│   ├── registry.js     # Tool registry
│   ├── loader.js       # Tool loader
│   ├── state.js        # State management
│   ├── ui.js           # UI rendering
│   ├── console.js      # Debug console
│   └── tools/          # Core tools
│       ├── index.json  # Core tools index
│       └── ...
└── tools/              # User/additional tools
    ├── index.json      # Tools index
    ├── base64-tool.html
    ├── json-formatter.html
    └── ...
```

## Browser Compatibility

DevChef works in all modern browsers that support:
- ES6 Modules
- Fetch API
- DOMParser
- CSS Custom Properties

Tested in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Add your tool or enhancement
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]

## Acknowledgments

Built with vanilla JavaScript, HTML, and CSS - no frameworks required!
