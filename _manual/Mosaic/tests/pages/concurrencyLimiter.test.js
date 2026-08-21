import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../../src/pages/concurrencyLimiter.js';

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test('never runs more than maxConcurrent functions at once', async () => {
  const limit = createLimiter(2);
  let active = 0;
  let maxActive = 0;
  const gates = Array.from({ length: 5 }, () => deferred());

  const tasks = gates.map((gate, i) =>
    limit(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate.promise;
      active--;
      return i;
    }),
  );

  // Let the first batch start.
  await new Promise((r) => setImmediate(r));
  assert.equal(active, 2, 'only 2 of 5 should have started');

  for (const gate of gates) gate.resolve();
  const results = await Promise.all(tasks);

  assert.equal(maxActive, 2);
  assert.deepEqual(results, [0, 1, 2, 3, 4]);
});

test('preserves each call\'s own result and does not mix them up', async () => {
  const limit = createLimiter(3);
  const results = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => limit(async () => n * 10)));
  assert.deepEqual(results, [10, 20, 30, 40, 50, 60]);
});

test('one rejected task does not block or break the others', async () => {
  const limit = createLimiter(2);
  const results = await Promise.allSettled([
    limit(async () => 'ok-1'),
    limit(async () => {
      throw new Error('boom');
    }),
    limit(async () => 'ok-2'),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[2].status, 'fulfilled');
});

test('with maxConcurrent 1, tasks run strictly one at a time in order', async () => {
  const limit = createLimiter(1);
  const order = [];
  await Promise.all(
    [1, 2, 3].map((n) =>
      limit(async () => {
        order.push(`start-${n}`);
        await new Promise((r) => setTimeout(r, 1));
        order.push(`end-${n}`);
      }),
    ),
  );
  assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
});
