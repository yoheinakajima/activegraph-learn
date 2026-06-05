/* ============================================================================
   store.js — durable key/value plus lesson-progress tracking.

   localStorage is used when available and falls back to an in-memory object
   (so the site still works inside sandboxed iframes that throw on access).
   ========================================================================== */

const store = (() => {
  const mem = {};
  const usable = (() => {
    try {
      const k = '__ag';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  return {
    get(k) {
      if (usable) { try { return localStorage.getItem(k); } catch (e) { /* fall through */ } }
      return mem[k] || null;
    },
    set(k, v) {
      if (usable) { try { localStorage.setItem(k, v); return; } catch (e) { /* fall through */ } }
      mem[k] = v;
    },
  };
})();

export default store;

/* ---- per-tutorial "seen lessons" set, persisted as JSON ------------------- */
const KEY = 'ag-seen';

function seenMap() {
  try { return JSON.parse(store.get(KEY) || '{}'); } catch (e) { return {}; }
}

export function isSeen(tid, lid) {
  const m = seenMap();
  return !!(m[tid] && m[tid].indexOf(lid) >= 0);
}

export function markSeen(tid, lid) {
  const m = seenMap();
  if (!m[tid]) m[tid] = [];
  if (m[tid].indexOf(lid) < 0) {
    m[tid].push(lid);
    store.set(KEY, JSON.stringify(m));
  }
}
