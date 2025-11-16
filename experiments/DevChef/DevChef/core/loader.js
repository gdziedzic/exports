/**
 * DevChef Dynamic Tool Loader
 * Loads tools from /core/tools/ and /tools/ directories
 */

import { ToolRegistry } from './registry.js';

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
      console.error(`No manifest found in ${path}`);
      return;
    }
    const manifest = JSON.parse(manifestScript.textContent);

    // Extract template
    const template = doc.querySelector("template#tool-ui");
    if (!template) {
      console.error(`No template found in ${path}`);
      return;
    }
    const templateHtml = template.innerHTML;

    // Extract styles
    const styleTag = doc.querySelector("style");
    const style = styleTag ? styleTag.innerHTML : "";

    // Extract and load module
    const scriptTag = doc.querySelector('script[type="module"]');
    if (!scriptTag) {
      console.error(`No module script found in ${path}`);
      return;
    }

    // Create a blob URL for the module
    const blob = new Blob([scriptTag.textContent], { type: "text/javascript" });
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
