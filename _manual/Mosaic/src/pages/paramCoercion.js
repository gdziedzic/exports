/** Coerces a raw query-string value (or a configured default) to the JS value a page/block parameter should bind as. Returns undefined on an invalid numeric value, distinct from null (absent). */
export function coerceParamValue(type, raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  switch (type) {
    case 'integer': {
      const n = Number(raw);
      return Number.isInteger(n) ? n : undefined;
    }
    case 'decimal': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return ['1', 'true', 'on', 'yes'].includes(String(raw).toLowerCase()) ? 1 : 0;
    default:
      return raw;
  }
}
