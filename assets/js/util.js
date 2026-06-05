/* ============================================================================
   util.js — shared helpers: HTML escaping, a syntax highlighter for the
   pseudo-Python code blocks, a unique-id counter, and a registry of running
   timers so the router can stop every animation when it changes route.
   ========================================================================== */

/* monotonically increasing id, used to namespace tab groups etc. */
let _uid = 0;
export function uid() { return _uid++; }

/* escape text for safe insertion into innerHTML */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---- timer registry -------------------------------------------------------
   Simulations use setInterval for "play" animations. The router calls
   clearTimers() on every navigation so nothing keeps ticking off-screen. */
let TIMERS = [];
export function registerTimer(id) { TIMERS.push(id); return id; }
export function dropTimer(id) { TIMERS = TIMERS.filter((x) => x !== id); }
export function clearTimers() {
  TIMERS.forEach((id) => clearInterval(id));
  TIMERS = [];
}

/* ---- tiny Python-ish syntax highlighter ----------------------------------- */
const KW = new Set([
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not',
  'and', 'or', 'import', 'from', 'as', 'with', 'try', 'except', 'finally',
  'raise', 'pass', 'None', 'True', 'False', 'lambda', 'yield', 'await', 'async',
  'is', 'del', 'global', 'nonlocal', 'assert', 'break', 'continue', 'match', 'case',
]);

export function hlLine(line) {
  let out = '', i = 0;
  const n = line.length;
  while (i < n) {
    const ch = line[i];
    if (ch === '#') { out += '<span class="t-com">' + esc(line.slice(i)) + '</span>'; break; }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
      out += '<span class="t-str">' + esc(line.slice(i, Math.min(j + 1, n))) + '</span>';
      i = j + 1; continue;
    }
    if (ch === '@') {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(line[j])) j++;
      out += '<span class="t-dec">' + esc(line.slice(i, j)) + '</span>';
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j), before = line.slice(0, i);
      if (/(def|class)\s+$/.test(before)) out += '<span class="t-def">' + esc(w) + '</span>';
      else if (KW.has(w)) out += '<span class="t-kw">' + esc(w) + '</span>';
      else if (w === 'self' || w === 'cls') out += '<span class="t-self">' + esc(w) + '</span>';
      else if (j < n && line[j] === '(') out += '<span class="t-fn">' + esc(w) + '</span>';
      else out += esc(w);
      i = j; continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9._]/.test(line[j])) j++;
      out += '<span class="t-num">' + esc(line.slice(i, j)) + '</span>';
      i = j; continue;
    }
    out += esc(ch); i++;
  }
  return out;
}
