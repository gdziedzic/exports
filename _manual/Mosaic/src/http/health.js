import { sendJson } from './respond.js';
import { noStore } from './securityHeaders.js';

/** Always 200 once the process is running an event loop - no I/O, no database. */
export function handleLive(req, res) {
  noStore(res);
  sendJson(res, 200, { status: 'live' });
}

/**
 * 200 once configuration is validated and required internal initialization
 * has completed; 503 otherwise. Deliberately does not depend on any
 * external database being continuously reachable.
 */
export function makeReadyHandler(getReadyState) {
  return function handleReady(req, res) {
    noStore(res);
    const state = getReadyState();
    sendJson(res, state.ready ? 200 : 503, state);
  };
}
