import { coerceParamValue } from './paramCoercion.js';

/**
 * Every parameter declared anywhere on the page (page-level plus every
 * block's block-level parameters), deduped by name for rendering one shared
 * input per name in the page's parameter form. Page-level wins on a name
 * collision; first-seen block wins among block-only definitions.
 */
export function allFormDefs(page) {
  const merged = new Map();
  for (const def of page.parameters ?? []) merged.set(def.name, def);
  for (const block of page.blocks) {
    for (const def of block.parameters ?? []) {
      if (!merged.has(def.name)) merged.set(def.name, def);
    }
  }
  return merged;
}

/** Resolves { values: Map<name, value>, errors: Map<name, message> } from URL params (p_<name>) and configured defaults. */
export function resolveParamValues(defs, searchParams) {
  const values = new Map();
  const errors = new Map();

  for (const [name, def] of defs) {
    const raw = searchParams.get(`p_${name}`);
    // A blank value falls back to the configured default only for optional
    // parameters (e.g. clearing a numeric filter box should reset it to its
    // default, not bind SQL NULL). A required parameter must never have a
    // user-submitted blank silently replaced by the default - that would let
    // a required field (e.g. a write action's confirm-form amount) bypass
    // validation entirely.
    const treatAsMissing = raw === null || (raw === '' && !def.required);
    const effectiveRaw = treatAsMissing ? def.default : raw;
    const coerced = coerceParamValue(def.type, effectiveRaw);

    if (coerced === undefined) {
      errors.set(name, def.type === 'integer' ? 'Must be a whole number.' : 'Must be a number.');
      continue;
    }
    if (def.required && (coerced === null || coerced === '')) {
      errors.set(name, 'This parameter is required.');
      continue;
    }
    values.set(name, coerced);
  }

  return { values, errors };
}

/**
 * True if a parameter this block's SQL actually references is missing or
 * invalid. A block that ignores a (possibly required) page-level parameter
 * is never blocked by it - only parameters it actually binds matter.
 */
export function blockIsBlockedByParams(referencedNames, errors) {
  for (const name of referencedNames) {
    if (errors.has(name)) return true;
  }
  return false;
}
