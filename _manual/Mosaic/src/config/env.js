// Shared helpers for applying MOSAIC_* environment-variable overrides onto a
// parsed config object. Each override descriptor names an env var, a dotted
// path into the settings object, and a parser that turns the raw string into
// the right type (or throws a descriptive error).

export function setPath(obj, pathSegments, value) {
  let cursor = obj;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const key = pathSegments[i];
    if (!isPlainObjectLike(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[pathSegments[pathSegments.length - 1]] = value;
}

function isPlainObjectLike(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseBoolean(envVar, raw) {
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`Environment variable ${envVar}=${raw} is not a valid boolean`);
}

export function parseInteger(envVar, raw) {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Environment variable ${envVar}=${raw} is not a valid integer`);
  }
  return value;
}

export function parseString(_envVar, raw) {
  return raw;
}

/**
 * Applies every matching MOSAIC_* env var in `env` onto `settings` in place,
 * per the `overrides` descriptor list: [{ envVar, path, parse }].
 * Throws on the first malformed value so config errors fail fast.
 */
export function applyEnvOverrides(settings, overrides, env = process.env) {
  for (const override of overrides) {
    const raw = env[override.envVar];
    if (raw === undefined || raw === '') continue;
    const value = override.parse(override.envVar, raw);
    setPath(settings, override.path, value);
  }
  return settings;
}
