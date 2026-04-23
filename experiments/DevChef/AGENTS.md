# DevChef Repository Guidelines

## Shared Controls
- Use DevChef's shared Web Components from `core/components.js` for new tool and app-facing controls whenever a matching component exists.
- Prefer `tool-button`, `tool-input`, `tool-textarea`, `tool-select`, `tool-file-input`, `tool-status`, and `tool-container` over raw form controls in new DevChef UI.
- Listen to component events such as `tool-click` and use component methods such as `setLoading`, `setDisabled`, `getValue`, and `setValue` instead of reaching into component internals.
- Keep tool-specific CSS focused on layout and state presentation. Reuse `tools/shared-styles.css`, existing `app.css` variables, and the shared component variants before adding bespoke control styles.
- The Tool Health Dashboard in `core/tool-health.js` is app-facing diagnostics UI and should continue to use common/shared controls for actions and filters.

## Local Validation
- For UI changes, run `npm run test:unit` when dependencies are installed.
- For dashboard or navigation changes, smoke test through a local static server and verify the view opens in the browser.
