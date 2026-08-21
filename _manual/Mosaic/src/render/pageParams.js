import { html } from './escape.js';

export function paramInputControl(def, value) {
  const name = `p_${def.name}`;
  const attrs = html`name="${name}" id="param-${def.name}" ${def.required ? html`required` : ''}`;
  switch (def.type) {
    case 'hidden':
      return html`<input type="hidden" ${attrs} value="${value ?? ''}">`;
    case 'boolean': {
      const checked = value === 1 || value === '1' || value === true;
      return html`<input type="checkbox" ${attrs} value="1" ${checked ? html`checked` : ''}><input type="hidden" name="${name}" value="0">`;
    }
    case 'integer':
      return html`<input type="number" step="1" ${attrs} value="${value ?? ''}" placeholder="${def.placeholder ?? ''}">`;
    case 'decimal':
      return html`<input type="number" step="any" ${attrs} value="${value ?? ''}" placeholder="${def.placeholder ?? ''}">`;
    case 'date':
      return html`<input type="date" ${attrs} value="${value ?? ''}">`;
    case 'datetime':
      return html`<input type="text" placeholder="YYYY-MM-DD HH:MM:SS" ${attrs} value="${value ?? ''}">`;
    case 'select':
      return html`<select ${attrs}>
        ${!def.required ? html`<option value="">-</option>` : ''}
        ${(def.options ?? []).map((opt) => html`<option value="${opt.value}" ${String(value) === String(opt.value) ? html`selected` : ''}>${opt.label}</option>`)}
      </select>`;
    case 'multiline':
      return html`<textarea rows="2" ${attrs} placeholder="${def.placeholder ?? ''}">${value ?? ''}</textarea>`;
    default:
      return html`<input type="text" ${attrs} value="${value ?? ''}" placeholder="${def.placeholder ?? ''}">`;
  }
}

/** Renders the single shared parameter form for a page (page-level params plus every block-level param, deduped by name). */
export function renderPageParamsForm({ action, defs, values, errors }) {
  if (defs.size === 0) return html``;

  const visibleDefs = [...defs.values()].filter((d) => d.type !== 'hidden');
  const hiddenDefs = [...defs.values()].filter((d) => d.type === 'hidden');

  return html`<form method="get" action="${action}" class="panel">
    ${hiddenDefs.map((def) => paramInputControl(def, values.get(def.name)))}
    <div class="blocks">
      ${visibleDefs.map(
        (def) => html`<div class="field">
          <label for="param-${def.name}">${def.label}${def.required ? ' *' : ''}</label>
          ${paramInputControl(def, values.get(def.name))}
          ${def.helpText ? html`<p class="help-text">${def.helpText}</p>` : ''}
          ${errors.has(def.name) ? html`<p class="field-error">${errors.get(def.name)}</p>` : ''}
        </div>`,
      )}
    </div>
    <button type="submit" class="button-primary">Apply</button>
  </form>`;
}

/** Renders just the field list (no surrounding <form>) for a set of parameter definitions - reused by the write-action review page. */
export function renderParamFieldset(defs, values, errors) {
  const visibleDefs = [...defs.values()].filter((d) => d.type !== 'hidden');
  const hiddenDefs = [...defs.values()].filter((d) => d.type === 'hidden');
  return html`
    ${hiddenDefs.map((def) => paramInputControl(def, values.get(def.name)))}
    <div class="blocks">
      ${visibleDefs.map(
        (def) => html`<div class="field">
          <label for="param-${def.name}">${def.label}${def.required ? ' *' : ''}</label>
          ${paramInputControl(def, values.get(def.name))}
          ${def.helpText ? html`<p class="help-text">${def.helpText}</p>` : ''}
          ${errors.has(def.name) ? html`<p class="field-error">${errors.get(def.name)}</p>` : ''}
        </div>`,
      )}
    </div>
  `;
}
