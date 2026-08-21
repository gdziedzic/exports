import { noStore } from '../http/securityHeaders.js';

/** RFC 4180 field quoting for a single CSV output value. */
function csvField(value) {
  if (value === null || value === undefined) return '';
  let text;
  if (value instanceof Uint8Array) {
    text = `0x${[...value].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  } else {
    text = String(value);
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function jsonSafeValue(value) {
  if (value instanceof Uint8Array) {
    return `0x${[...value].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
  return value;
}

class ExportLimitExceededError extends Error {}

/**
 * Writes one chunk to the response, honoring backpressure (awaiting
 * 'drain' when the socket's internal buffer is full) so a slow client
 * can't force the server to buffer an entire export in memory, and
 * enforcing the configured byte cap across the whole stream.
 */
function writeChunk(res, chunk, byteCounter, maxBytes) {
  byteCounter.total += Buffer.byteLength(chunk);
  if (byteCounter.total > maxBytes) {
    return Promise.reject(new ExportLimitExceededError(`Export exceeded configured limit of ${maxBytes} bytes`));
  }
  const canWriteMore = res.write(chunk);
  if (canWriteMore) return Promise.resolve();
  return new Promise((resolve, reject) => {
    function cleanup() {
      res.off('drain', onDrain);
      res.off('close', onClose);
      res.off('error', onError);
    }
    function onDrain() {
      cleanup();
      resolve();
    }
    function onClose() {
      cleanup();
      reject(new Error('Response closed before the write buffer drained'));
    }
    function onError(err) {
      cleanup();
      reject(err);
    }
    res.on('drain', onDrain);
    res.on('close', onClose);
    res.on('error', onError);
  });
}

/**
 * Streams a CSV/JSON export row-by-row with backpressure, bounded by
 * settings.exportLimits.maxRows (fetched once, up front) and
 * settings.exportLimits.maxBytes (enforced while writing). If the byte cap
 * is hit mid-stream, or the client disconnects, the connection is aborted
 * rather than silently emitting a truncated-but-well-formed-looking file.
 */
export async function exportRows(res, { format, filenameBase, settings, fetchRows, logger, requestId }) {
  const { maxRows, maxBytes } = settings.exportLimits;
  const { rows } = await fetchRows(0, maxRows);
  const safeName = String(filenameBase).replace(/[^a-zA-Z0-9_-]/g, '_');

  noStore(res);
  res.statusCode = 200;
  const byteCounter = { total: 0 };

  try {
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`);
      await writeChunk(res, '[', byteCounter, maxBytes);
      for (let i = 0; i < rows.length; i++) {
        const safeRow = {};
        for (const [key, value] of Object.entries(rows[i])) safeRow[key] = jsonSafeValue(value);
        await writeChunk(res, (i > 0 ? ',' : '') + JSON.stringify(safeRow), byteCounter, maxBytes);
      }
      await writeChunk(res, ']', byteCounter, maxBytes);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    await writeChunk(res, columns.map(csvField).join(',') + '\r\n', byteCounter, maxBytes);
    for (const row of rows) {
      await writeChunk(res, columns.map((c) => csvField(row[c])).join(',') + '\r\n', byteCounter, maxBytes);
    }
    res.end();
  } catch (err) {
    if (err instanceof ExportLimitExceededError) {
      logger?.warn?.('export_truncated', { requestId, filenameBase: safeName, format, maxBytes });
    } else {
      logger?.info?.('export_aborted', { requestId, filenameBase: safeName, format, errorMessage: err.message });
    }
    res.destroy();
  }
}
