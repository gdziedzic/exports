import fs from 'node:fs';
import path from 'node:path';

const LEVELS = ['error', 'warn', 'info', 'debug'];

const REDACT_KEY_PATTERN = /password|secret|token|connectionstring|authorization|cookie|apikey/i;
const REDACTED = '[REDACTED]';

function redact(value, depth = 0) {
  if (depth > 6) return '[REDACTED:depth-limit]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = REDACT_KEY_PATTERN.test(key) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Structured newline-delimited-JSON logger. Rotates the log file daily (a
 * simple, documented time-based policy); external tools (e.g. a scheduled
 * cleanup task) are expected to manage long-term retention on Windows, per
 * the README. Every log call redacts keys that look secret-shaped by name.
 */
export class Logger {
  constructor({ level = 'info', directory = null, console: useConsole = true } = {}) {
    if (!LEVELS.includes(level)) {
      throw new Error(`Unknown log level: ${level}`);
    }
    this.level = level;
    this.directory = directory;
    this.useConsole = useConsole;
    this.stream = null;
    this.currentDate = null;
    if (directory) {
      fs.mkdirSync(directory, { recursive: true });
      this._openStreamForToday();
    }
  }

  _openStreamForToday() {
    const datestamp = new Date().toISOString().slice(0, 10);
    this.currentDate = datestamp;
    const filePath = path.join(this.directory, `mosaic-${datestamp}.ndjson`);
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  _rotateIfNeeded() {
    const datestamp = new Date().toISOString().slice(0, 10);
    if (datestamp !== this.currentDate) {
      this.stream.end();
      this._openStreamForToday();
    }
  }

  log(level, message, meta = {}) {
    if (!LEVELS.includes(level)) level = 'info';
    if (LEVELS.indexOf(level) > LEVELS.indexOf(this.level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...redact(meta),
    };
    const line = JSON.stringify(entry);

    if (this.stream) {
      this._rotateIfNeeded();
      this.stream.write(line + '\n');
    }
    if (this.useConsole) {
      // eslint-disable-next-line no-console
      (level === 'error' ? console.error : console.log)(line);
    }
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  close() {
    return new Promise((resolve) => {
      if (this.stream) {
        this.stream.end(resolve);
      } else {
        resolve();
      }
    });
  }
}

export function createNullLogger() {
  return new Logger({ level: 'error', directory: null, console: false });
}
