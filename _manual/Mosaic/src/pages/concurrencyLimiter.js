/**
 * Small in-process concurrency limiter: at most `maxConcurrent` functions
 * passed to the returned `limit()` run at once; the rest queue in call
 * order. Created fresh per request so the bound is per-request, not global.
 */
export function createLimiter(maxConcurrent) {
  let active = 0;
  const queue = [];

  function runNext() {
    if (active >= maxConcurrent || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(
      (value) => {
        active--;
        resolve(value);
        runNext();
      },
      (err) => {
        active--;
        reject(err);
        runNext();
      },
    );
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
  };
}
