import { describe, expect, it } from 'vitest';
import {
  createExampleId,
  hasRunnableExampleData,
  mergeToolExamples,
  normalizeToolExample,
  normalizeToolExamples
} from '../../core/tool-presets.js';

describe('tool preset normalization', () => {
  it('normalizes registry example strings into metadata-only examples', () => {
    expect(normalizeToolExample('Format an API payload', 0)).toEqual({
      id: 'format-an-api-payload',
      label: 'Format an API payload',
      description: '',
      input: '',
      output: undefined,
      settings: {},
      controls: {},
      metadataOnly: true
    });
  });

  it('normalizes rich examples with runnable data', () => {
    const example = normalizeToolExample({
      id: 'api-json',
      label: 'API JSON',
      description: 'A nested API response.',
      value: '{"ok":true}',
      output: '{\n  "ok": true\n}',
      settings: { indent: '2' },
      controls: { '#sort-keys': true }
    });

    expect(example).toMatchObject({
      id: 'api-json',
      label: 'API JSON',
      description: 'A nested API response.',
      input: '{"ok":true}',
      output: '{\n  "ok": true\n}',
      settings: { indent: '2' },
      controls: { '#sort-keys': true },
      metadataOnly: false
    });
  });

  it('deduplicates generated ids when labels repeat', () => {
    expect(normalizeToolExamples(['Basic', 'Basic']).map(example => example.id)).toEqual([
      'basic',
      'basic-2'
    ]);
  });

  it('merges example arrays without replacing earlier ids', () => {
    const merged = mergeToolExamples(
      [{ id: 'basic', label: 'Basic', input: 'one' }],
      [{ id: 'basic', label: 'Duplicate', input: 'two' }, { id: 'advanced', label: 'Advanced' }]
    );

    expect(merged.map(example => example.id)).toEqual(['basic', 'advanced']);
    expect(merged[0].input).toBe('one');
  });

  it('detects runnable data separately from catalog-only examples', () => {
    expect(hasRunnableExampleData({ label: 'Search hint' })).toBe(false);
    expect(hasRunnableExampleData({ input: 'abc' })).toBe(true);
    expect(hasRunnableExampleData({ settings: { mode: 'decode' } })).toBe(true);
  });

  it('creates stable fallback ids', () => {
    expect(createExampleId('JSON: nested API payload')).toBe('json-nested-api-payload');
    expect(createExampleId('', 2)).toBe('example-3');
  });
});
