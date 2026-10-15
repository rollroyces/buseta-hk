// Bound-concurrency map helper. Used by:
//   - app.js's `prefetchRouteStops()` (Phase 12) to fan-out per-route
//     `/route-stop` fetches against the upstream KMB / CTB feeds without
//     hammering the API or running out of sockets.
//   - planner.js (inline copy; a future PR can swap it for this
//     exported version — kept local for now so planner.js stays a
//     standalone file that only depends on src/utils/geo + time).
//
// Pure data: no I/O. The worker is `async (item, index) => result`. The
// return shape is `{ ok: true, value } | { ok: false, error }` so a
// caller that wants to tolerate partial failure can filter on `.ok`
// without a try/catch at every call site.

/**
 * Run `worker` over every entry of `items` with at most `cap` workers
 * in flight at any time. The output array preserves input order; each
 * slot is `{ ok: true, value }` on success or `{ ok: false, error }`
 * if the worker rejected. Empty input returns an empty array.
 *
 * Mirrors the planner.js in-file `mapWithCap` (kept there as a private
 * copy — extracted here so the same logic is testable + reusable).
 *
 * @template T, R
 * @param {Array<T>} items - The items to process.
 * @param {number} cap - Maximum concurrent workers (clamped to [1, items.length]).
 * @param {(item: T, index: number) => Promise<R>} worker - The per-item worker.
 * @returns {Promise<Array<{ ok: true, value: R } | { ok: false, error: unknown }>>}
 */
export async function mapWithCap(items, cap, worker) {
  const out = new Array(items.length);
  if (items.length === 0) return out;
  const limit = Math.max(1, Math.min(cap, items.length));
  let cursor = 0;
  const inFlight = new Set();
  const pump = () => {
    while (inFlight.size < limit && cursor < items.length) {
      const i = cursor++;
      const p = (async () => {
        try {
          out[i] = { ok: true, value: await worker(items[i], i) };
        } catch (e) {
          out[i] = { ok: false, error: e };
        }
      })();
      inFlight.add(p);
      p.finally(() => inFlight.delete(p));
    }
  };
  pump();
  while (inFlight.size > 0 || cursor < items.length) {
    if (inFlight.size === 0) pump();
    await Promise.race([...inFlight]);
    pump();
  }
  return out;
}

// When loaded as a classic script (in index.html before app.js), attach
// the export to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    mapWithCap,
  });
}
