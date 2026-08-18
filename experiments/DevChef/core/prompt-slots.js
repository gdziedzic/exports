/**
 * prompt-slots.js
 * Pure functions for the Slots prompt builder.
 * No DOM dependencies — fully testable in Node.js / Vitest.
 */

export const ROLES = [
  {
    id: 'senior_dev',
    label: 'Senior Dev',
    text: 'You are a senior developer with 15+ years of experience. Write clean, maintainable code and catch edge cases.',
  },
  {
    id: 'reviewer',
    label: 'Reviewer',
    text: 'You are a meticulous code reviewer. Spot bugs, security issues, and performance problems. Suggest concrete fixes.',
  },
  {
    id: 'architect',
    label: 'Architect',
    text: 'You are a solution architect. Map constraints, dependencies, and risk surfaces before proposing solutions.',
  },
  {
    id: 'tech_writer',
    label: 'Tech Writer',
    text: 'You are a technical writer. Create clear, structured documentation targeted at developers.',
  },
  {
    id: 'devops',
    label: 'DevOps',
    text: 'You are a DevOps engineer focused on CI/CD, infrastructure as code, and operational reliability.',
  },
  {
    id: 'security',
    label: 'Security',
    text: 'You are a security engineer. Focus on threat modeling, vulnerability identification, and least-privilege design.',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    text: 'You are a strategic analyst. Identify patterns, surface insights, and make evidence-based recommendations.',
  },
  {
    id: 'qa_lead',
    label: 'QA Lead',
    text: 'You are a QA lead. Design thorough test coverage, identify edge cases, and explain likely regression paths.',
  },
  {
    id: 'product_manager',
    label: 'Product Manager',
    text: 'You are a product manager. Balance user outcomes, constraints, and execution tradeoffs in your recommendations.',
  },
  {
    id: 'prompt_engineer',
    label: 'Prompt Engineer',
    text: 'You are a prompt engineer. Optimize instructions for reliability, clarity, controllability, and evaluation quality.',
  },
  {
    id: 'data_analyst',
    label: 'Data Analyst',
    text: 'You are a data analyst. Structure messy inputs, identify patterns, and present conclusions with explicit assumptions.',
  },
  {
    id: 'researcher',
    label: 'Researcher',
    text: 'You are a careful researcher. Synthesize source material, highlight uncertainty, and separate facts from inference.',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    text: 'You are an expert teacher who explains complex topics clearly using examples and analogies.',
  },
];

export const FORMATS = [
  { id: 'bullets', label: 'Bullets', text: 'Respond with dense bullet points using bold labels.' },
  { id: 'steps', label: 'Steps', text: 'Respond with a numbered, step-by-step plan.' },
  { id: 'checklist', label: 'Checklist', text: 'Respond with a concise checklist grouped by priority.' },
  { id: 'table', label: 'Table', text: 'Respond with a markdown comparison table.' },
  { id: 'code', label: 'Code', text: 'Respond with working code and inline comments.' },
  { id: 'spec', label: 'Spec', text: 'Respond as a short implementation spec with sections for scope, approach, and risks.' },
  { id: 'playbook', label: 'Playbook', text: 'Respond as an actionable playbook with phases, commands, and validation steps.' },
  { id: 'prose', label: 'Prose', text: 'Respond in flowing prose without bullet points.' },
  { id: 'summary', label: 'Summary', text: 'Respond with a concise executive summary.' },
  { id: 'json', label: 'JSON', text: 'Respond with structured JSON output.' },
  { id: 'prompt', label: 'Prompt', text: 'Respond with a reusable prompt template that is ready to paste into another AI tool.' },
];

/**
 * Assemble a prompt string from slot values.
 *
 * @param {object} slots
 * @param {string} [slots.task='']    Required. What you need the AI to do.
 * @param {string} [slots.role='']    Optional. Role instruction (already resolved text).
 * @param {string} [slots.context=''] Optional. Context / input data.
 * @param {string} [slots.format='']  Optional. Output format instruction (already resolved text).
 * @returns {string}
 */
export function assemblePrompt({ task = '', role = '', context = '', format = '' } = {}) {
  const parts = [];
  if (role.trim()) parts.push(role.trim());
  if (task.trim()) parts.push(task.trim());
  if (context.trim()) parts.push(`Context:\n${context.trim()}`);
  if (format.trim()) parts.push(`Output format: ${format.trim()}`);
  return parts.join('\n\n');
}

/**
 * Resolve role text: return the preset's text if the ID matches, else the custom text.
 *
 * @param {string|null} presetId
 * @param {string} [customText='']
 * @param {Array} [roles=ROLES]
 * @returns {string}
 */
export function resolveRoleText(presetId, customText = '', roles = ROLES) {
  if (!presetId) return customText.trim();
  const preset = roles.find(r => r.id === presetId);
  return preset ? preset.text : customText.trim();
}

/**
 * Resolve format text: return the preset's text if the ID matches, else the custom text.
 *
 * @param {string|null} presetId
 * @param {string} [customText='']
 * @param {Array} [formats=FORMATS]
 * @returns {string}
 */
export function resolveFormatText(presetId, customText = '', formats = FORMATS) {
  if (!presetId) return customText.trim();
  const preset = formats.find(f => f.id === presetId);
  return preset ? preset.text : customText.trim();
}

/**
 * Validate slot values. Returns an array of error message strings (empty = valid).
 *
 * @param {object} slots
 * @param {string} [slots.task='']
 * @returns {string[]}
 */
export function validateSlots({ task = '' } = {}) {
  const errors = [];
  if (!task.trim()) errors.push('Task is required.');
  return errors;
}

/**
 * Save a template. Pure — returns a new array, never mutates the input.
 * If a template with the same name already exists it is replaced.
 *
 * @param {string} name
 * @param {object} slots  Raw slot state to persist.
 * @param {Array}  [templates=[]]
 * @returns {Array}
 */
export function saveTemplate(name, slots, templates = []) {
  if (!name?.trim()) throw new Error('Template name is required.');
  const trimmedName = name.trim();
  const filtered = templates.filter(t => t.name !== trimmedName);
  return [...filtered, { name: trimmedName, slots, savedAt: Date.now() }];
}

/**
 * Load a template by name. Returns the saved slots object, or null if not found.
 *
 * @param {string} name
 * @param {Array}  [templates=[]]
 * @returns {object|null}
 */
export function loadTemplate(name, templates = []) {
  return templates.find(t => t.name === name)?.slots ?? null;
}

/**
 * Delete a template by name. Pure — returns a new array.
 *
 * @param {string} name
 * @param {Array}  [templates=[]]
 * @returns {Array}
 */
export function deleteTemplate(name, templates = []) {
  return templates.filter(t => t.name !== name);
}

/**
 * Serialize templates to a JSON string suitable for file export.
 *
 * @param {Array} templates
 * @returns {string}
 */
export function serializeTemplates(templates) {
  return JSON.stringify({ version: 1, templates }, null, 2);
}

/**
 * Parse templates from a JSON string (from an import file). Throws on invalid input.
 *
 * @param {string} json
 * @returns {Array}
 */
export function parseTemplates(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON.');
  }
  if (!Array.isArray(parsed?.templates)) throw new Error('Invalid template format: missing "templates" array.');
  return parsed.templates;
}

/**
 * Return a one-line summary string suitable for a collapsed slot header.
 *
 * @param {string} text       Full text value of the slot.
 * @param {string} emptyLabel Label to return when text is empty.
 * @param {number} [maxLen=60]
 * @returns {string}
 */
export function slotSummary(text, emptyLabel, maxLen = 60) {
  if (!text?.trim()) return emptyLabel;
  const trimmed = text.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

/**
 * Return the label for a preset by ID, or a fallback string.
 *
 * @param {string|null} id
 * @param {Array} presets   Array of { id, label } objects.
 * @param {string} fallback
 * @returns {string}
 */
export function presetLabel(id, presets, fallback = 'None') {
  if (!id) return fallback;
  return presets.find(p => p.id === id)?.label ?? fallback;
}
