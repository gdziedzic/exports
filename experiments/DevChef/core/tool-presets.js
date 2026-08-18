/**
 * DevChef Tool Presets
 *
 * Normalizes example/preset definitions so registry metadata, generated shell
 * templates, and tool runtime code can use the same shape.
 */

/**
 * Normalize a single example or preset.
 *
 * Supported input:
 * - "Format an API payload"
 * - { id, label, description, input, output, settings, controls }
 *
 * @param {string|Object} example
 * @param {number} index
 * @returns {Object|null}
 */
export function normalizeToolExample(example, index = 0) {
  if (typeof example === 'string') {
    const label = example.trim();
    if (!label) return null;

    return {
      id: createExampleId(label, index),
      label,
      description: '',
      input: '',
      output: undefined,
      settings: {},
      controls: {},
      metadataOnly: true
    };
  }

  if (!example || typeof example !== 'object') {
    return null;
  }

  const label = String(example.label || example.name || example.title || example.id || `Example ${index + 1}`).trim();
  if (!label) return null;

  const id = String(example.id || createExampleId(label, index)).trim();

  return {
    ...example,
    id,
    label,
    description: String(example.description || '').trim(),
    input: normalizeExampleInput(example),
    output: example.output,
    settings: normalizeObject(example.settings),
    controls: normalizeObject(example.controls),
    metadataOnly: Boolean(example.metadataOnly)
  };
}

/**
 * Normalize an array of examples/presets.
 * @param {Array} examples
 * @returns {Array<Object>}
 */
export function normalizeToolExamples(examples = []) {
  if (!Array.isArray(examples)) return [];

  const usedIds = new Map();
  return examples
    .map((example, index) => normalizeToolExample(example, index))
    .filter(Boolean)
    .map(example => {
      const count = usedIds.get(example.id) || 0;
      usedIds.set(example.id, count + 1);
      return count === 0
        ? example
        : { ...example, id: `${example.id}-${count + 1}` };
    });
}

/**
 * Merge many example arrays and de-duplicate by id.
 * Later arrays can add examples, but do not replace earlier ids.
 * @param  {...Array} sources
 * @returns {Array<Object>}
 */
export function mergeToolExamples(...sources) {
  const merged = [];
  const seen = new Set();

  sources.flatMap(source => normalizeToolExamples(source)).forEach(example => {
    if (seen.has(example.id)) return;
    seen.add(example.id);
    merged.push(example);
  });

  return merged;
}

/**
 * Return true when an example has runnable data, not only display metadata.
 * @param {Object} example
 * @returns {boolean}
 */
export function hasRunnableExampleData(example = {}) {
  return Boolean(
    example.input ||
    example.output !== undefined ||
    Object.keys(normalizeObject(example.settings)).length ||
    Object.keys(normalizeObject(example.controls)).length
  );
}

export function createExampleId(label, index = 0) {
  const slug = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `example-${index + 1}`;
}

function normalizeExampleInput(example) {
  if (example.input !== undefined) return String(example.input);
  if (example.value !== undefined) return String(example.value);
  if (example.sample !== undefined) return String(example.sample);
  return '';
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}
