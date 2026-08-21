import test from 'node:test';
import assert from 'node:assert/strict';
import { allFormDefs, resolveParamValues, blockIsBlockedByParams } from '../../src/pages/pageParams.js';

test('allFormDefs collects page-level params, page-level wins on name collision', () => {
  const page = {
    parameters: [{ name: 'Region', label: 'Page Region', type: 'text' }],
    blocks: [{ parameters: [{ name: 'Region', label: 'Block Region', type: 'text' }] }],
  };
  const defs = allFormDefs(page);
  assert.equal(defs.get('Region').label, 'Page Region');
});

test('allFormDefs includes block-only parameters not declared at the page level', () => {
  const page = {
    parameters: [],
    blocks: [{ parameters: [{ name: 'OnlyHere', label: 'X', type: 'text' }] }],
  };
  assert.ok(allFormDefs(page).has('OnlyHere'));
});

test('resolveParamValues reads p_<name> from the query string', () => {
  const defs = new Map([['MinPrice', { name: 'MinPrice', type: 'decimal' }]]);
  const { values, errors } = resolveParamValues(defs, new URLSearchParams('p_MinPrice=9.5'));
  assert.equal(values.get('MinPrice'), 9.5);
  assert.equal(errors.size, 0);
});

test('resolveParamValues falls back to the configured default when absent', () => {
  const defs = new Map([['MinPrice', { name: 'MinPrice', type: 'decimal', default: 3 }]]);
  const { values } = resolveParamValues(defs, new URLSearchParams(''));
  assert.equal(values.get('MinPrice'), 3);
});

test('resolveParamValues reports an error for a non-numeric value on an integer/decimal param', () => {
  const defs = new Map([['Qty', { name: 'Qty', type: 'integer' }]]);
  const { errors } = resolveParamValues(defs, new URLSearchParams('p_Qty=abc'));
  assert.ok(errors.has('Qty'));
});

test('resolveParamValues reports an error for a missing required parameter', () => {
  const defs = new Map([['Region', { name: 'Region', type: 'text', required: true }]]);
  const { errors } = resolveParamValues(defs, new URLSearchParams(''));
  assert.ok(errors.has('Region'));
});

test('resolveParamValues does not error for a missing optional parameter with no default', () => {
  const defs = new Map([['Region', { name: 'Region', type: 'text', required: false }]]);
  const { values, errors } = resolveParamValues(defs, new URLSearchParams(''));
  assert.equal(errors.size, 0);
  assert.equal(values.get('Region'), null);
});

test('resolveParamValues reports an error for an explicitly blank required parameter, even with a default', () => {
  // A required field with a default (e.g. a write-action's confirm-form
  // amount) must not let a user-submitted blank value silently fall back to
  // the default - that would defeat "required" entirely.
  const defs = new Map([['RestockAmount', { name: 'RestockAmount', type: 'integer', required: true, default: 20 }]]);
  const { values, errors } = resolveParamValues(defs, new URLSearchParams('p_RestockAmount='));
  assert.ok(errors.has('RestockAmount'));
  assert.equal(values.has('RestockAmount'), false);
});

test('resolveParamValues falls back to the default for an explicitly blank OPTIONAL parameter', () => {
  // Clearing an optional numeric filter box should reset it to its default
  // (e.g. MinPrice=0), not bind SQL NULL.
  const defs = new Map([['MinPrice', { name: 'MinPrice', type: 'decimal', required: false, default: 3 }]]);
  const { values, errors } = resolveParamValues(defs, new URLSearchParams('p_MinPrice='));
  assert.equal(errors.size, 0);
  assert.equal(values.get('MinPrice'), 3);
});

test('resolveParamValues uses the default for a required parameter that is absent (not blank)', () => {
  const defs = new Map([['RestockAmount', { name: 'RestockAmount', type: 'integer', required: true, default: 20 }]]);
  const { values, errors } = resolveParamValues(defs, new URLSearchParams(''));
  assert.equal(errors.size, 0);
  assert.equal(values.get('RestockAmount'), 20);
});

test('resolveParamValues coerces boolean checkbox-style values', () => {
  const defs = new Map([['Active', { name: 'Active', type: 'boolean' }]]);
  assert.equal(resolveParamValues(defs, new URLSearchParams('p_Active=1')).values.get('Active'), 1);
  assert.equal(resolveParamValues(defs, new URLSearchParams('p_Active=0')).values.get('Active'), 0);
});

test('blockIsBlockedByParams is true only when a referenced name has an error', () => {
  const errors = new Map([['Region', 'required']]);
  assert.equal(blockIsBlockedByParams(new Set(['Region']), errors), true);
  assert.equal(blockIsBlockedByParams(new Set(['OtherParam']), errors), false, 'a block ignoring the broken param is not blocked');
  assert.equal(blockIsBlockedByParams(new Set(), errors), false);
});
