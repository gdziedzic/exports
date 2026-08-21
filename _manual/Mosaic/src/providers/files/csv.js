import fs from 'node:fs';
import { assertFileSizeWithinLimit } from './limits.js';

/**
 * Hand-rolled RFC 4180 streaming CSV parser (no String.split()). Handles
 * quoted fields, doubled-quote escaping, embedded delimiters, and embedded
 * (CRLF/LF) newlines inside quoted fields. Bare-CR-only line endings (legacy
 * Mac OS 9) are not treated as row terminators - CRLF and LF are.
 */
class CsvParser {
  constructor({ delimiter, quote, hasHeader, maxRecordCount }) {
    this.delimiter = delimiter;
    this.quote = quote;
    this.hasHeader = hasHeader;
    this.maxRecordCount = maxRecordCount;

    this.field = '';
    this.row = [];
    this.columns = null;
    this.records = [];
    this.inQuotes = false;
    this.atFieldStart = true;
    this.sawQuoteInQuotes = false;
    this.lineNumber = 1;
    this.recordCount = 0;
    this.truncated = false;
    this.warnings = [];
  }

  endField() {
    this.row.push(this.field);
    this.field = '';
    this.atFieldStart = true;
  }

  endRow() {
    this.endField();
    if (this.row.length === 1 && this.row[0] === '') {
      this.row = []; // skip a fully blank line
      return;
    }
    if (this.columns === null) {
      if (this.hasHeader) {
        this.columns = this.row;
        this.row = [];
        return;
      }
      this.columns = this.row.map((_, i) => `column_${i + 1}`);
    }
    const obj = {};
    this.columns.forEach((col, i) => {
      obj[col] = this.row[i] ?? null;
    });
    this.records.push(obj);
    this.recordCount++;
    this.row = [];
    if (this.recordCount >= this.maxRecordCount) this.truncated = true;
  }

  processChar(ch) {
    if (this.sawQuoteInQuotes) {
      this.sawQuoteInQuotes = false;
      if (ch === this.quote) {
        this.field += this.quote;
        return;
      }
      this.inQuotes = false;
      // fall through - `ch` is processed as the first character after the closing quote
    }

    if (this.inQuotes) {
      if (ch === this.quote) {
        this.sawQuoteInQuotes = true;
        return;
      }
      if (ch === '\n') this.lineNumber++;
      this.field += ch;
      return;
    }

    if (ch === this.quote && this.atFieldStart) {
      this.inQuotes = true;
      this.atFieldStart = false;
      return;
    }

    if (ch === this.delimiter) {
      this.endField();
      return;
    }

    if (ch === '\n') {
      this.lineNumber++;
      if (this.field.endsWith('\r')) this.field = this.field.slice(0, -1);
      this.endRow();
      return;
    }

    this.field += ch;
    this.atFieldStart = false;
  }

  processChunk(chunk) {
    for (let i = 0; i < chunk.length; i++) {
      this.processChar(chunk[i]);
      if (this.truncated) return;
    }
  }

  finish() {
    if (this.inQuotes) {
      this.warnings.push({ line: this.lineNumber, message: 'Unterminated quoted field - the trailing record was dropped.' });
      return;
    }
    if (this.field !== '' || this.row.length > 0) {
      this.endRow();
    }
  }
}

export async function parseCsvFile(filePath, { delimiter = ',', quote = '"', hasHeader = true, maxFileSizeBytes, maxRecordCount }) {
  assertFileSizeWithinLimit(filePath, maxFileSizeBytes);

  const parser = new CsvParser({ delimiter, quote, hasHeader, maxRecordCount });

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    stream.on('data', (chunk) => {
      parser.processChunk(chunk);
      if (parser.truncated) stream.destroy();
    });
    stream.on('close', resolve);
    stream.on('error', reject);
    stream.on('end', () => {
      parser.finish();
    });
  });

  const columns = parser.columns ?? [];
  return { columns, records: parser.records, truncated: parser.truncated, warnings: parser.warnings };
}
