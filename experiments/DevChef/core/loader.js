/**
 * DevChef Dynamic Tool Loader
 * Loads tools from /core/tools/ and /tools/ directories
 */

import { ToolRegistry } from './registry.js';


/**
 * Rewrite relative import specifiers inside inline tool modules so they can be
 * resolved from the blob URL we generate for dynamic imports.
 *
 * When we load HTML files and evaluate their <script type="module"> blocks via
 * Blob URLs, any relative specifiers (e.g. "../core/tool-utils.js") would break
 * because the blob URL doesn't have a hierarchical base. We rewrite those
 * specifiers to absolute URLs using the tool file path so the browser can load
 * the dependencies correctly.
 *
 * @param {string} scriptContent - Module source code to rewrite
 * @param {string} toolPath - Original path of the HTML file being processed
 * @returns {string} Updated module source code
 */
function rewriteModuleImports(scriptContent, toolPath) {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return scriptContent;
  }

  let rewritten = scriptContent;

  try {
    const baseUrl = new URL(toolPath, window.location.href);

    const resolveSpecifier = (specifier) => {
      if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
        return specifier;
      }

      try {
        return new URL(specifier, baseUrl).href;
      } catch (error) {
        console.warn(`Failed to resolve specifier ${specifier} for ${toolPath}:`, error);
        return specifier;
      }
    };

    rewritten = rewritten
      .replace(/from\s+(['"])(\.{1,2}\/[^'")]+)\1/g, (match, quote, specifier) => {
        return match.replace(specifier, resolveSpecifier(specifier));
      })
      .replace(/import\s+(['"])(\.{1,2}\/[^'")]+)\1/g, (match, quote, specifier) => {
        return match.replace(specifier, resolveSpecifier(specifier));
      })
      .replace(/import\s*\(\s*(['"])(\.{1,2}\/[^'")]+)\1\s*\)/g, (match, quote, specifier) => {
        const resolved = resolveSpecifier(specifier);
        return `import(${quote}${resolved}${quote})`;
      });
  } catch (error) {
    console.warn(`Failed to rewrite module imports for ${toolPath}:`, error);
  }

  return rewritten;
}

// Track loading errors
const loadingErrors = [];

/**
 * Get all loading errors
 * @returns {Array} Array of error objects
 */
export function getLoadingErrors() {
  return loadingErrors;
}

/**
 * Load a single tool from an HTML file
 * @param {string} path - Path to the tool HTML file
 * @returns {Promise<void>}
 */
async function loadTool(path) {
  try {
    const html = await fetch(path).then(r => {
      if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
      return r.text();
    });

    const doc = new DOMParser().parseFromString(html, "text/html");

    // Extract manifest
    const manifestScript = doc.querySelector('script[type="devchef-manifest"]');
    if (!manifestScript) {
      const error = `No manifest found in ${path}`;
      console.error(error);
      loadingErrors.push({ path, error });
      return;
    }
    const manifest = JSON.parse(manifestScript.textContent);

    // Extract template
    const template = doc.querySelector("template#tool-ui");
    if (!template) {
      const error = `No template found in ${path}`;
      console.error(error);
      loadingErrors.push({ path, error, toolName: manifest.name });
      return;
    }
    const templateHtml = template.innerHTML;

    // Extract styles (inline and external)
    let style = "";

    // Get inline styles
    const styleTag = doc.querySelector("style");
    if (styleTag) {
      style += styleTag.innerHTML;
    }

    // Get external stylesheets
    const linkTags = doc.querySelectorAll('link[rel="stylesheet"]');
    const basePath = path.substring(0, path.lastIndexOf('/') + 1);

    for (const link of linkTags) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          const cssPath = basePath + href;
          const cssContent = await fetch(cssPath).then(r => {
            if (!r.ok) throw new Error(`Failed to load CSS ${cssPath}: ${r.status}`);
            return r.text();
          });
          style += '\n' + cssContent;
        } catch (cssError) {
          console.warn(`Failed to load external CSS from ${href}:`, cssError);
        }
      }
    }

    // Extract and load module (inline or external)
    const scriptTag = doc.querySelector('script[type="module"]');
    if (!scriptTag) {
      const error = `No module script found in ${path}`;
      console.error(error);
      loadingErrors.push({ path, error, toolName: manifest.name });
      return;
    }

    let scriptContent;

    // Check if script has src attribute (external file)
    const scriptSrc = scriptTag.getAttribute('src');
    if (scriptSrc) {
      try {
        const jsPath = basePath + scriptSrc;
        scriptContent = await fetch(jsPath).then(r => {
          if (!r.ok) throw new Error(`Failed to load JS ${jsPath}: ${r.status}`);
          return r.text();
        });
      } catch (jsError) {
        const error = `Failed to load external JS from ${scriptSrc}: ${jsError.message}`;
        console.error(error);
        loadingErrors.push({ path, error, toolName: manifest.name });
        return;
      }
    } else {
      // Use inline script content
      scriptContent = scriptTag.textContent;
    }

    // Rewrite relative imports so dependencies resolve from blob URLs
    const rewrittenScript = rewriteModuleImports(scriptContent, path);

    // Create a blob URL for the module
    const blob = new Blob([rewrittenScript], { type: "text/javascript" });
    const moduleUrl = URL.createObjectURL(blob);
    const module = await import(moduleUrl);

    // Clean up blob URL
    URL.revokeObjectURL(moduleUrl);

    // Register the tool
    ToolRegistry.register({
      manifest,
      templateHtml,
      style,
      module
    });

    console.log(`✓ Loaded tool: ${manifest.name} (${manifest.id})`);
  } catch (error) {
    console.error(`Failed to load tool from ${path}:`, error);
    loadingErrors.push({
      path,
      error: error.message || String(error),
      stack: error.stack
    });
  }
}

/**
 * Load tools from a directory using its index.json
 * @param {string} dir - Directory path
 * @returns {Promise<void>}
 */
async function loadToolsFromDirectory(dir) {
  try {
    const indexPath = `${dir}/index.json`;
    const response = await fetch(indexPath);

    if (!response.ok) {
      console.warn(`No index.json found at ${indexPath}`);
      return;
    }

    const toolFiles = await response.json();

    if (!Array.isArray(toolFiles)) {
      console.error(`Invalid index.json format at ${indexPath}`);
      return;
    }

    // Load all tools from this directory
    const loadPromises = toolFiles.map(file => loadTool(`${dir}/${file}`));
    await Promise.all(loadPromises);

  } catch (error) {
    console.error(`Failed to load tools from ${dir}:`, error);
  }
}

/**
 * Initialize and load all tools
 * @returns {Promise<void>}
 */
export async function initializeTools() {
  console.log("🔧 Initializing DevChef tools...");

  // Load built-in tools from /core/tools/
  await loadToolsFromDirectory('./core/tools');

  // Load user tools from /tools/
  await loadToolsFromDirectory('./tools');

  const loadedCount = ToolRegistry.all().length;
  console.log(`✓ Loaded ${loadedCount} tool(s)`);

  return loadedCount;
}

/**
 * Reload a specific tool (useful for development)
 * @param {string} path - Path to tool file
 * @returns {Promise<void>}
 */
export async function reloadTool(path) {
  await loadTool(path);
}
