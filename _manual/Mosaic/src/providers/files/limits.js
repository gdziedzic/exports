import fs from 'node:fs';

export class FileTooLargeError extends Error {
  constructor(filePath, sizeBytes, maxBytes) {
    super(`File exceeds the configured size limit (${sizeBytes} > ${maxBytes} bytes): ${filePath}`);
    this.name = 'FileTooLargeError';
  }
}

/** Throws before opening a file that already exceeds the configured size limit. */
export function assertFileSizeWithinLimit(filePath, maxFileSizeBytes) {
  const stat = fs.statSync(filePath);
  if (stat.size > maxFileSizeBytes) {
    throw new FileTooLargeError(filePath, stat.size, maxFileSizeBytes);
  }
  return stat;
}
