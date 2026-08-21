// Provider-agnostic logical types (text, integer, decimal, boolean, date,
// time, datetime, binary) and the operator/coercion rules built on top of
// them. Each provider's own types.js maps its native column types onto this
// same set, so the explorer's filter/sort/form code never needs to know
// which SQL engine it's talking to.

export const OPERATORS_BY_LOGICAL_TYPE = {
  text: ['eq', 'ne', 'contains', 'startswith', 'endswith', 'isnull', 'isnotnull'],
  integer: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isnull', 'isnotnull'],
  decimal: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isnull', 'isnotnull'],
  date: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isnull', 'isnotnull'],
  time: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isnull', 'isnotnull'],
  datetime: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isnull', 'isnotnull'],
  boolean: ['true', 'false', 'isnull', 'isnotnull'],
  binary: ['isnull', 'isnotnull'],
};

/** Infers a logical type from an actual JS value, for contexts with no declared column type
 * (e.g. a configured-page block's arbitrary query result). Necessarily coarser than a real
 * declared-type classification - just enough to pick sane cell rendering and filter operators. */
export function inferValueLogicalType(value) {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'decimal';
  return 'text';
}

/** Coerces a raw HTML-form string to the JS value that should be bound for this logical type. */
export function coerceFormValue(logicalType, raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  switch (logicalType) {
    case 'integer': {
      const n = Number(raw);
      return Number.isInteger(n) ? n : null;
    }
    case 'decimal': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean':
      return ['1', 'true', 'on', 'yes'].includes(String(raw).toLowerCase()) ? 1 : 0;
    default:
      return raw;
  }
}
