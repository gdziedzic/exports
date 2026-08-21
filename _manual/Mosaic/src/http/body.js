export class RequestTooLargeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RequestTooLargeError';
  }
}

/**
 * Reads the full request body into a Buffer, rejecting before buffering an
 * oversized body. Checks the declared Content-Length up front, and also
 * enforces the limit while streaming (covers chunked-encoding requests that
 * omit or lie about Content-Length).
 */
export function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      req.destroy();
      reject(new RequestTooLargeError(`Content-Length ${declaredLength} exceeds limit of ${maxBytes} bytes`));
      return;
    }

    const chunks = [];
    let total = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        req.destroy();
        reject(new RequestTooLargeError(`Request body exceeds limit of ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

export async function parseFormBody(req, maxBytes) {
  const buffer = await readRequestBody(req, maxBytes);
  const text = buffer.toString('utf8');
  return new URLSearchParams(text);
}
