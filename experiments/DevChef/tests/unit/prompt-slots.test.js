import { describe, it, expect } from 'vitest';
import {
  ROLES,
  FORMATS,
  assemblePrompt,
  resolveRoleText,
  resolveFormatText,
  validateSlots,
  saveTemplate,
  loadTemplate,
  deleteTemplate,
  serializeTemplates,
  parseTemplates,
  slotSummary,
  presetLabel,
} from '../../core/prompt-slots.js';

// ─── assemblePrompt ───────────────────────────────────────────────────────────

describe('assemblePrompt', () => {
  it('returns empty string when called with no arguments', () => {
    expect(assemblePrompt()).toBe('');
  });

  it('returns empty string when all slots are empty strings', () => {
    expect(assemblePrompt({ task: '', role: '', context: '', format: '' })).toBe('');
  });

  it('returns just the task when only task is provided', () => {
    expect(assemblePrompt({ task: 'Fix the bug' })).toBe('Fix the bug');
  });

  it('prepends role before task', () => {
    const result = assemblePrompt({ task: 'Review this code', role: 'You are an expert.' });
    expect(result).toBe('You are an expert.\n\nReview this code');
  });

  it('appends context after task', () => {
    const result = assemblePrompt({ task: 'Summarize this', context: 'Some long text here' });
    expect(result).toBe('Summarize this\n\nContext:\nSome long text here');
  });

  it('appends format after context', () => {
    const result = assemblePrompt({
      task: 'List the issues',
      context: 'Here is the code',
      format: 'Use bullet points.',
    });
    expect(result).toBe(
      'List the issues\n\nContext:\nHere is the code\n\nOutput format: Use bullet points.'
    );
  });

  it('includes all four slots in correct order', () => {
    const result = assemblePrompt({
      role: 'You are a reviewer.',
      task: 'Review the PR',
      context: 'PR diff here',
      format: 'Use numbered list.',
    });
    const lines = result.split('\n\n');
    expect(lines[0]).toBe('You are a reviewer.');
    expect(lines[1]).toBe('Review the PR');
    expect(lines[2]).toBe('Context:\nPR diff here');
    expect(lines[3]).toBe('Output format: Use numbered list.');
  });

  it('trims whitespace from all slot values', () => {
    const result = assemblePrompt({
      task: '  Fix it  ',
      role: '  You are expert.  ',
      context: '  context  ',
      format: '  bullets  ',
    });
    expect(result).toBe(
      'You are expert.\n\nFix it\n\nContext:\ncontext\n\nOutput format: bullets'
    );
  });

  it('skips whitespace-only slots', () => {
    const result = assemblePrompt({ task: 'Do X', role: '   ', context: '\n\t', format: '' });
    expect(result).toBe('Do X');
  });

  it('handles multiline task text', () => {
    const task = 'Line 1\nLine 2\nLine 3';
    expect(assemblePrompt({ task })).toBe(task);
  });

  it('handles multiline context text', () => {
    const result = assemblePrompt({ task: 'T', context: 'line1\nline2' });
    expect(result).toBe('T\n\nContext:\nline1\nline2');
  });
});

// ─── resolveRoleText ─────────────────────────────────────────────────────────

describe('resolveRoleText', () => {
  it('returns preset text for a known ID', () => {
    const senior = ROLES.find(r => r.id === 'senior_dev');
    expect(resolveRoleText('senior_dev')).toBe(senior.text);
  });

  it('returns customText when presetId is null', () => {
    expect(resolveRoleText(null, 'My custom role')).toBe('My custom role');
  });

  it('returns customText when presetId is empty string', () => {
    expect(resolveRoleText('', 'fallback')).toBe('fallback');
  });

  it('returns customText when presetId is not found', () => {
    expect(resolveRoleText('nonexistent_id', 'fallback')).toBe('fallback');
  });

  it('trims custom text', () => {
    expect(resolveRoleText(null, '  trimmed  ')).toBe('trimmed');
  });

  it('works with a custom roles array', () => {
    const customRoles = [{ id: 'pirate', text: 'Arr, ye be a pirate.' }];
    expect(resolveRoleText('pirate', '', customRoles)).toBe('Arr, ye be a pirate.');
  });

  it('returns empty string when presetId is null and no customText given', () => {
    expect(resolveRoleText(null)).toBe('');
  });

  it('returns preset text ignoring customText when ID matches', () => {
    const senior = ROLES.find(r => r.id === 'senior_dev');
    expect(resolveRoleText('senior_dev', 'ignored custom')).toBe(senior.text);
  });
});

// ─── resolveFormatText ───────────────────────────────────────────────────────

describe('resolveFormatText', () => {
  it('returns preset text for a known format ID', () => {
    const bullets = FORMATS.find(f => f.id === 'bullets');
    expect(resolveFormatText('bullets')).toBe(bullets.text);
  });

  it('returns customText when presetId is null', () => {
    expect(resolveFormatText(null, 'Custom format')).toBe('Custom format');
  });

  it('returns customText when presetId is unknown', () => {
    expect(resolveFormatText('unknown_format', 'fallback')).toBe('fallback');
  });

  it('trims custom text', () => {
    expect(resolveFormatText(null, '  trimmed  ')).toBe('trimmed');
  });

  it('works with a custom formats array', () => {
    const customFormats = [{ id: 'haiku', text: 'Respond as a haiku.' }];
    expect(resolveFormatText('haiku', '', customFormats)).toBe('Respond as a haiku.');
  });

  it('returns empty string when both presetId and customText are absent', () => {
    expect(resolveFormatText(null)).toBe('');
  });
});

// ─── validateSlots ───────────────────────────────────────────────────────────

describe('validateSlots', () => {
  it('returns empty array for a valid task', () => {
    expect(validateSlots({ task: 'Write tests' })).toEqual([]);
  });

  it('returns error when task is empty string', () => {
    const errors = validateSlots({ task: '' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/task/i);
  });

  it('returns error when task is whitespace only', () => {
    expect(validateSlots({ task: '   ' })).toHaveLength(1);
  });

  it('returns error when called with no argument', () => {
    expect(validateSlots()).toHaveLength(1);
  });

  it('ignores other slots — only task is validated', () => {
    expect(validateSlots({ task: 'ok', role: '', context: '', format: '' })).toEqual([]);
  });
});

// ─── saveTemplate ────────────────────────────────────────────────────────────

describe('saveTemplate', () => {
  const slots = { task: 'Review code', rolePresetId: 'reviewer', contextText: '', formatPresetId: 'bullets', formatCustom: '' };

  it('adds a new template to an empty list', () => {
    const result = saveTemplate('My Template', slots);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Template');
    expect(result[0].slots).toEqual(slots);
  });

  it('stores a savedAt timestamp', () => {
    const before = Date.now();
    const result = saveTemplate('TS Test', slots);
    const after = Date.now();
    expect(result[0].savedAt).toBeGreaterThanOrEqual(before);
    expect(result[0].savedAt).toBeLessThanOrEqual(after);
  });

  it('appends to an existing list without mutating it', () => {
    const existing = [{ name: 'Old', slots: {}, savedAt: 0 }];
    const result = saveTemplate('New', slots, existing);
    expect(result).toHaveLength(2);
    expect(existing).toHaveLength(1); // original unchanged
  });

  it('replaces a template with the same name', () => {
    const first = saveTemplate('Dup', { task: 'first' });
    const second = saveTemplate('Dup', { task: 'second' }, first);
    expect(second).toHaveLength(1);
    expect(second[0].slots.task).toBe('second');
  });

  it('trims the template name', () => {
    const result = saveTemplate('  padded  ', slots);
    expect(result[0].name).toBe('padded');
  });

  it('throws when name is empty', () => {
    expect(() => saveTemplate('', slots)).toThrow();
  });

  it('throws when name is whitespace only', () => {
    expect(() => saveTemplate('   ', slots)).toThrow();
  });

  it('throws when name is null', () => {
    expect(() => saveTemplate(null, slots)).toThrow();
  });
});

// ─── loadTemplate ────────────────────────────────────────────────────────────

describe('loadTemplate', () => {
  const templates = [
    { name: 'Alpha', slots: { task: 'alpha task' }, savedAt: 1 },
    { name: 'Beta', slots: { task: 'beta task' }, savedAt: 2 },
  ];

  it('returns slots for a matching template name', () => {
    expect(loadTemplate('Alpha', templates)).toEqual({ task: 'alpha task' });
  });

  it('returns null for a non-existent name', () => {
    expect(loadTemplate('Gamma', templates)).toBeNull();
  });

  it('returns null on an empty list', () => {
    expect(loadTemplate('Alpha', [])).toBeNull();
  });

  it('is case-sensitive', () => {
    expect(loadTemplate('alpha', templates)).toBeNull();
    expect(loadTemplate('ALPHA', templates)).toBeNull();
  });
});

// ─── deleteTemplate ──────────────────────────────────────────────────────────

describe('deleteTemplate', () => {
  const templates = [
    { name: 'Alpha', slots: {}, savedAt: 1 },
    { name: 'Beta', slots: {}, savedAt: 2 },
    { name: 'Gamma', slots: {}, savedAt: 3 },
  ];

  it('removes the named template', () => {
    const result = deleteTemplate('Beta', templates);
    expect(result.map(t => t.name)).toEqual(['Alpha', 'Gamma']);
  });

  it('does not mutate the original array', () => {
    deleteTemplate('Alpha', templates);
    expect(templates).toHaveLength(3);
  });

  it('returns unchanged array when name not found', () => {
    const result = deleteTemplate('Nonexistent', templates);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when deleting the only item', () => {
    const single = [{ name: 'Solo', slots: {}, savedAt: 0 }];
    expect(deleteTemplate('Solo', single)).toEqual([]);
  });

  it('removes all entries if duplicates exist (edge case)', () => {
    const dups = [
      { name: 'Dup', slots: {}, savedAt: 1 },
      { name: 'Dup', slots: {}, savedAt: 2 },
    ];
    expect(deleteTemplate('Dup', dups)).toEqual([]);
  });
});

// ─── serializeTemplates / parseTemplates ─────────────────────────────────────

describe('serializeTemplates', () => {
  it('produces valid JSON with a version field', () => {
    const templates = [{ name: 'T1', slots: { task: 'x' }, savedAt: 0 }];
    const json = serializeTemplates(templates);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.templates).toEqual(templates);
  });

  it('handles an empty array', () => {
    const json = serializeTemplates([]);
    expect(JSON.parse(json).templates).toEqual([]);
  });
});

describe('parseTemplates', () => {
  it('parses a valid serialized payload', () => {
    const templates = [{ name: 'X', slots: { task: 'y' }, savedAt: 123 }];
    const json = serializeTemplates(templates);
    expect(parseTemplates(json)).toEqual(templates);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseTemplates('not json')).toThrow();
  });

  it('throws when templates field is missing', () => {
    expect(() => parseTemplates('{"version":1}')).toThrow(/missing/i);
  });

  it('throws when templates is not an array', () => {
    expect(() => parseTemplates('{"templates":{}}')).toThrow();
  });

  it('round-trips: serialize then parse returns identical data', () => {
    const original = [
      { name: 'RT', slots: { task: 'round trip', rolePresetId: 'senior_dev' }, savedAt: 999 },
    ];
    expect(parseTemplates(serializeTemplates(original))).toEqual(original);
  });
});

// ─── slotSummary ─────────────────────────────────────────────────────────────

describe('slotSummary', () => {
  it('returns emptyLabel when text is empty', () => {
    expect(slotSummary('', 'None')).toBe('None');
  });

  it('returns emptyLabel when text is whitespace only', () => {
    expect(slotSummary('   ', 'Empty')).toBe('Empty');
  });

  it('returns emptyLabel when text is null', () => {
    expect(slotSummary(null, 'N/A')).toBe('N/A');
  });

  it('returns full text when shorter than maxLen', () => {
    expect(slotSummary('short text', 'None', 60)).toBe('short text');
  });

  it('truncates text longer than maxLen with ellipsis', () => {
    const long = 'a'.repeat(100);
    const result = slotSummary(long, 'None', 60);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(61); // 60 chars + ellipsis
  });

  it('uses default maxLen of 60', () => {
    const exactly60 = 'x'.repeat(60);
    expect(slotSummary(exactly60, 'N')).toBe(exactly60);
    const exactly61 = 'x'.repeat(61);
    expect(slotSummary(exactly61, 'N').endsWith('…')).toBe(true);
  });

  it('trims the text before measuring', () => {
    expect(slotSummary('  hello  ', 'None')).toBe('hello');
  });
});

// ─── presetLabel ─────────────────────────────────────────────────────────────

describe('presetLabel', () => {
  it('returns the label for a known preset', () => {
    expect(presetLabel('senior_dev', ROLES)).toBe('Senior Dev');
  });

  it('returns fallback when id is null', () => {
    expect(presetLabel(null, ROLES, 'None')).toBe('None');
  });

  it('returns fallback when id is not found', () => {
    expect(presetLabel('ghost', ROLES, 'Unknown')).toBe('Unknown');
  });

  it('uses "None" as the default fallback', () => {
    expect(presetLabel(null, ROLES)).toBe('None');
  });

  it('works with the FORMATS array', () => {
    expect(presetLabel('bullets', FORMATS)).toBe('Bullets');
    expect(presetLabel('json', FORMATS)).toBe('JSON');
  });
});

// ─── ROLES / FORMATS data integrity ──────────────────────────────────────────

describe('ROLES data', () => {
  it('has unique IDs', () => {
    const ids = ROLES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has id, label, and text fields', () => {
    ROLES.forEach(r => {
      expect(typeof r.id).toBe('string');
      expect(typeof r.label).toBe('string');
      expect(typeof r.text).toBe('string');
      expect(r.id.length).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.text.length).toBeGreaterThan(0);
    });
  });
});

describe('FORMATS data', () => {
  it('has unique IDs', () => {
    const ids = FORMATS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has id, label, and text fields', () => {
    FORMATS.forEach(f => {
      expect(typeof f.id).toBe('string');
      expect(typeof f.label).toBe('string');
      expect(typeof f.text).toBe('string');
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.text.length).toBeGreaterThan(0);
    });
  });
});

// ─── Integration: full compose cycle ─────────────────────────────────────────

describe('full compose cycle', () => {
  it('resolves role + format then assembles a complete prompt', () => {
    const roleText = resolveRoleText('senior_dev');
    const formatText = resolveFormatText('steps');
    const prompt = assemblePrompt({
      role: roleText,
      task: 'Refactor the authentication module',
      context: 'Current code uses callbacks; target is async/await.',
      format: formatText,
    });

    expect(prompt).toContain('senior developer');
    expect(prompt).toContain('Refactor the authentication module');
    expect(prompt).toContain('Context:');
    expect(prompt).toContain('callbacks');
    expect(prompt).toContain('Output format:');
    expect(prompt).toContain('step');
  });

  it('save → load → assemble round-trip', () => {
    const slots = {
      task: 'Write unit tests',
      rolePresetId: 'senior_dev',
      roleCustom: '',
      contextText: 'The service is in src/auth.ts',
      formatPresetId: 'code',
      formatCustom: '',
    };

    let templates = saveTemplate('Auth Tests', slots);
    const loaded = loadTemplate('Auth Tests', templates);

    expect(loaded).toEqual(slots);

    const prompt = assemblePrompt({
      task: loaded.task,
      role: resolveRoleText(loaded.rolePresetId, loaded.roleCustom),
      context: loaded.contextText,
      format: resolveFormatText(loaded.formatPresetId, loaded.formatCustom),
    });

    expect(prompt).toContain('Write unit tests');
    expect(prompt).toContain('senior developer');
    expect(prompt).toContain('src/auth.ts');

    templates = deleteTemplate('Auth Tests', templates);
    expect(loadTemplate('Auth Tests', templates)).toBeNull();
  });

  it('serialize → parse → load cycle works end-to-end', () => {
    const slots = { task: 'Export test', rolePresetId: null, contextText: '', formatPresetId: 'prose', formatCustom: '' };
    const templates = saveTemplate('Export', slots);
    const json = serializeTemplates(templates);
    const restored = parseTemplates(json);
    expect(loadTemplate('Export', restored)).toEqual(slots);
  });
});
