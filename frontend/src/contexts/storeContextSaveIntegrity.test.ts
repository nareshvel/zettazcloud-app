import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A failed save must never look like a successful one.
 *
 * `updateStore` used to catch the API error, write the new values into local
 * state, and RETURN them as though the save had worked. The screen then showed
 * exactly what the user typed — store name, address, tax number — while the
 * database still held the old values. Nothing looked wrong until the next
 * reload, by which point the change had been "saved" days earlier and there was
 * no reason to doubt it.
 *
 * Optimistic local state is fine when the caller is TOLD the write failed and
 * can retry or roll back. Doing it silently converts a visible failure into a
 * wrong record, which is the worse of the two by a wide margin.
 */

const SRC = readFileSync(
  join(__dirname, 'StoreContext.tsx'), 'utf8',
);

const updateStoreBody = (() => {
  const start = SRC.indexOf('const updateStore');
  expect(start, 'updateStore not found').toBeGreaterThan(-1);
  const end = SRC.indexOf('const refreshStore', start);
  return SRC.slice(start, end === -1 ? SRC.length : end);
})();

/**
 * ONLY the inner catch — the one wrapping the API call.
 *
 * Slicing from `catch (updateError)` to the end of the function also swallows
 * the OUTER `catch (err)`, which has its own setError. A test scoped that
 * loosely passes even when the inner handler is gutted, which is exactly what
 * happened the first time this was written.
 */
const innerCatch = (() => {
  const start = updateStoreBody.indexOf('catch (updateError)');
  expect(start, 'inner catch not found').toBeGreaterThan(-1);
  const end = updateStoreBody.indexOf('} catch (err', start);
  expect(end, 'outer catch not found — cannot scope the inner one').toBeGreaterThan(start);
  return updateStoreBody.slice(start, end);
})();

describe('StoreContext.updateStore — failures propagate', () => {
  it('rethrows when the API call fails', () => {
    expect(innerCatch, 'the inner catch swallows the error').toMatch(/throw updateError/);
  });

  it('does not fabricate a saved store from local state', () => {
    /*
     * The exact shape of the bug: building `{ ...store, ...updatedStore }` in
     * the error path and returning it as the saved result.
     */
    expect(innerCatch, 'the error path invents a saved store').not.toMatch(/return\s+updatedLocalStore/);
    expect(innerCatch).not.toMatch(/setStore\(\{\s*\.\.\.store/);
  });

  it('records the error so the UI can surface it', () => {
    expect(innerCatch).toMatch(/setError/);
  });

  it('still returns the saved store on success', () => {
    // Guards the assertions above against being satisfied by a function that
    // simply never returns anything.
    expect(updateStoreBody).toMatch(/setStore\(updated\)/);
    expect(updateStoreBody).toMatch(/return updated;/);
  });
});
