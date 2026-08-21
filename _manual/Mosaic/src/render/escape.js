// Central, mandatory context-aware escaping. Nothing in this application
// should ever concatenate an unescaped value into HTML - every render
// function is built on top of the `html` tagged template below, which
// escapes every interpolated value unless it was produced by `raw()` or is
// itself the result of a nested `html` call.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// HTML text and double-quoted HTML attribute values share the same unsafe
// character set (& < > " '), so the same escaping function is safe for both
// contexts. Exposed separately so call sites can document intent.
export const escapeAttr = escapeHtml;

// Escapes a single path segment for safe inclusion in an href/src built by
// string concatenation (prefer buildPath/toQueryString below when possible).
export function escapeUrlComponent(value) {
  return encodeURIComponent(String(value));
}

export function buildPath(...segments) {
  return '/' + segments.map((s) => escapeUrlComponent(s)).join('/');
}

export function toQueryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, String(v));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// Builds a "\uXXXX" escape sequence without ever typing a literal backslash
// escape in this source file, to keep the codepoints it targets unambiguous.
function unicodeEscape(codePoint) {
  const backslash = String.fromCharCode(92);
  return backslash + 'u' + codePoint.toString(16).padStart(4, '0');
}

const JSON_HTML_UNSAFE_CODEPOINTS = new Map([
  ['<'.codePointAt(0), unicodeEscape('<'.codePointAt(0))],
  ['>'.codePointAt(0), unicodeEscape('>'.codePointAt(0))],
  ['&'.codePointAt(0), unicodeEscape('&'.codePointAt(0))],
  [0x2028, unicodeEscape(0x2028)],
  [0x2029, unicodeEscape(0x2029)],
]);

/**
 * Safely embeds a JSON-serializable value inside an HTML document (e.g. a
 * `<script type="application/json">` block read by progressive-enhancement
 * JS). Escapes characters that could break out of the surrounding HTML/script
 * context (< > & and the U+2028/U+2029 line/paragraph separators, which are
 * valid in JSON strings but illegal unescaped in JS/HTML text). Prefer
 * passing data via data-* attributes instead - this exists only for cases
 * where that is impractical.
 */
export function jsonForHtml(value) {
  const json = JSON.stringify(value);
  let out = '';
  for (const ch of json) {
    const replacement = JSON_HTML_UNSAFE_CODEPOINTS.get(ch.codePointAt(0));
    out += replacement ?? ch;
  }
  return out;
}

const SAFE_MARKER = Symbol('SafeHtml');

class SafeHtml {
  constructor(value) {
    this.value = value;
    this[SAFE_MARKER] = true;
  }

  toString() {
    return this.value;
  }
}

/** Wraps a string as pre-escaped/trusted HTML. Use sparingly, never on user or database content. */
export function raw(value) {
  return new SafeHtml(String(value));
}

function isSafeHtml(value) {
  return value instanceof SafeHtml;
}

function renderValue(value) {
  if (value === null || value === undefined || value === false) return '';
  if (isSafeHtml(value)) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/**
 * Tagged template for building HTML. Every interpolated value is escaped
 * unless it is a nested `html` result or `raw()`-wrapped string. Arrays are
 * flattened and each element escaped independently.
 *
 *   html`<p>${userSuppliedText}</p>`               // escaped
 *   html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>` // composes safely
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += renderValue(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

export { isSafeHtml };
