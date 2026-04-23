# DevChef Repository Guidelines

## Shared Tool UI Status
- Shared UI infrastructure already exists, but adoption is mixed across older tools. Treat new work as an opportunity to consolidate toward the shared patterns instead of adding another bespoke control style.
- `core/components.js` provides the current Web Components: `tool-button`, `tool-textarea`, `tool-input`, `tool-select`, `tool-file-input`, `tool-status`, and `tool-container`.
- `tools/shared-styles.css` provides the common tool layout, theme variables, form styling, status styles, and shell helper classes such as `tool-shell`, `tool-shell-grid`, `tool-shell-action-row`, `tool-shell-settings`, and `tool-shell-validation`.
- `core/tool-utils.js` provides shared behavior for common tool actions including clipboard copy, status/error display, file download, debouncing/throttling, persisted tool state, validation helpers, escaping, and sorting.
- `core/tool-shell.js` is an optional higher-level helper for simple input/output/action tools. It can generate a standard shell template and wire common actions such as process, copy, clear, reset, import, export, examples, validation, and persisted settings.
- `core/tool-presets.js` normalizes tool examples and presets. Use catalog-only strings for search/docs examples, and rich objects with `input`, `output`, `settings`, or `controls` for runnable presets.
- `tools/_template.html`, `tools/component-demo.html`, and `docs/components.md` are the best references before creating or refactoring a tool UI.

## Shared Controls
- Use DevChef's shared Web Components from `core/components.js` for new tool and app-facing controls whenever a matching component exists.
- Prefer `tool-button`, `tool-input`, `tool-textarea`, `tool-select`, `tool-file-input`, `tool-status`, and `tool-container` over raw form controls in new DevChef UI.
- Listen to component events such as `tool-click` and use component methods such as `setLoading`, `setDisabled`, `getValue`, `setValue`, `show`, and `hide` instead of reaching into component internals.
- For simple text-in/text-out tools, consider `createToolShellTemplate()` and `createToolShell()` from `core/tool-shell.js` before hand-wiring repeated copy/clear/export/status behavior.
- When adding examples, prefer runnable presets for common workflows: sample JSON, SQL, JWTs, regexes, KQL queries, connection strings, and expected output where useful.
- Keep tool-specific CSS focused on layout and state presentation. Reuse `tools/shared-styles.css`, existing `app.css` variables, and the shared component variants before adding bespoke control styles.
- When touching an older tool that uses raw controls or duplicate helpers, migrate only the controls needed for the change unless the user explicitly asks for a broader refactor.
- The Tool Health Dashboard in `core/tool-health.js` is app-facing diagnostics UI and should continue to use common/shared controls for actions and filters.

## Tool Metadata
- `tools/index.json` is currently the canonical discovery registry and supports rich metadata objects; legacy filename strings still load for backwards compatibility.
- Each tool's embedded `script[type="devchef-manifest"]` is the source of truth for `id`, `name`, `category`, `description`, `version`, and `keywords`.
- Keep the filename in `tools/index.json` and the embedded manifest in sync when adding, renaming, or removing a tool.
- Rich registry entries, generated tool docs, and metadata fields such as aliases, examples, maturity, last updated, or test coverage are wired into search, diagnostics, and `npm run generate:tools-readme`.

## Local Validation
- For UI changes, run `npm run test:unit` when dependencies are installed.
- For dashboard or navigation changes, smoke test through a local static server and verify the view opens in the browser.
