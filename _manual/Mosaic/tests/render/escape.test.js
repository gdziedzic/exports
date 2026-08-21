import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  escapeUrlComponent,
  buildPath,
  toQueryString,
  jsonForHtml,
  html,
  raw,
} from '../../src/render/escape.js';

test('escapeHtml escapes all five HTML-unsafe characters', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>&'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;');
});

test('escapeHtml coerces non-strings', () => {
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml(null), 'null');
});

test('html tagged template escapes interpolated user content by default', () => {
  const userInput = '<img src=x onerror=alert(1)>';
  const out = html`<p>${userInput}</p>`.toString();
  assert.equal(out, '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
});

test('html composes nested html`` fragments without double-escaping', () => {
  const item = html`<li>${'a & b'}</li>`;
  const list = html`<ul>${item}</ul>`.toString();
  assert.equal(list, '<ul><li>a &amp; b</li></ul>');
});

test('html flattens and escapes arrays element-wise', () => {
  const out = html`<ul>${['<a>', '<b>'].map((x) => html`<li>${x}</li>`)}</ul>`.toString();
  assert.equal(out, '<ul><li>&lt;a&gt;</li><li>&lt;b&gt;</li></ul>');
});

test('html renders null/undefined/false as empty string', () => {
  assert.equal(html`<p>${null}${undefined}${false}</p>`.toString(), '<p></p>');
});

test('raw() bypasses escaping - only ever use on trusted, non-user content', () => {
  const out = html`<div>${raw('<b>trusted</b>')}</div>`.toString();
  assert.equal(out, '<div><b>trusted</b></div>');
});

test('escapeUrlComponent encodes special characters', () => {
  assert.equal(escapeUrlComponent('a/b?c=d'), 'a%2Fb%3Fc%3Dd');
});

test('buildPath encodes each segment independently', () => {
  assert.equal(buildPath('sources', 'my source', 'dbo/Orders'), '/sources/my%20source/dbo%2FOrders');
});

test('toQueryString builds a query string, omitting null/undefined and repeating arrays', () => {
  assert.equal(toQueryString({ page: 2, q: null, tags: ['a', 'b'] }), '?page=2&tags=a&tags=b');
  assert.equal(toQueryString({}), '');
});

test('jsonForHtml escapes </script>-breaking sequences', () => {
  const original = { a: '</script><script>alert(1)</script>' };
  const out = jsonForHtml(original);
  assert.ok(!out.includes('</script>'));
  const restored = out.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&');
  assert.deepEqual(JSON.parse(restored), original);
});

test('jsonForHtml escapes U+2028/U+2029 line and paragraph separators', () => {
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  const original = { b: 'x' + lineSeparator + 'y' + paragraphSeparator + 'z' };

  const out = jsonForHtml(original);

  assert.ok(!out.includes(lineSeparator));
  assert.ok(!out.includes(paragraphSeparator));

  const restored = out.replace(/\\u2028/g, lineSeparator).replace(/\\u2029/g, paragraphSeparator);
  assert.deepEqual(JSON.parse(restored), original);
});
