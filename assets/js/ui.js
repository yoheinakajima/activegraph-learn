/* ============================================================================
   ui.js — pure HTML-string builders used by lesson content. None of these
   touch the DOM; they return markup that renderLesson() injects. Interactive
   widgets live in sims.js / sims-research.js instead.
   ========================================================================== */
import { esc, uid, hlLine } from './util.js';

/* a syntax-highlighted code block with a faux editor chrome
   o = { fn, badge:'run'|'con', raw, mark:[lineNumbers] } */
export function code(o) {
  const lines = o.raw.replace(/^\n/, '').replace(/\n$/, '').split('\n');
  const mark = o.mark || [];
  const body = lines.map((l, ix) => {
    const m = mark.indexOf(ix + 1) >= 0 ? ' mk' : '';
    return '<span class="ln' + m + '">' + (hlLine(l) || ' ') + '</span>';
  }).join('\n');
  const b = o.badge === 'run' ? '<span class="badge run">runnable</span>'
    : o.badge === 'con' ? '<span class="badge con">conceptual</span>' : '';
  return '<div class="code"><div class="code-top"><span class="dots"><i></i><i></i><i></i></span>' +
    '<span class="fn">' + esc(o.fn || '') + '</span>' + b + '</div><pre>' + body + '</pre></div>';
}

/* a colored callout box: kind = 'key' | 'warn' | 'stop' */
export function note(kind, label, html) {
  return '<div class="note ' + kind + '"><span class="ic">' + label + '</span><div>' + html + '</div></div>';
}

/* a tab group: items = [{label, html}, ...] */
export function tabs(items) {
  const g = 'tab' + uid();
  const row = items.map((it, i) =>
    '<button class="tab-btn' + (i === 0 ? ' on' : '') + '" data-tg="' + g + '" data-ti="' + i + '">' + esc(it.label) + '</button>'
  ).join('');
  const panes = items.map((it, i) =>
    '<div class="tab-pane' + (i === 0 ? ' on' : '') + '" data-pg="' + g + '" data-pi="' + i + '">' + it.html + '</div>'
  ).join('');
  return '<div class="tabs"><div class="tab-row">' + row + '</div>' + panes + '</div>';
}

/* a "naive -> activegraph" mapping table: rows = [[from, to], ...] */
export function maptable(rows) {
  const head = '<div class="maprow head"><div class="hd">The naive agent</div><div class="arr"></div><div class="hd">becomes, in activegraph</div></div>';
  const body = rows.map((r) =>
    '<div class="maprow"><div class="from">' + esc(r[0]) + '</div><div class="arr">→</div><div class="to">' + esc(r[1]) + '</div></div>'
  ).join('');
  return '<div class="maptable">' + head + body + '</div>';
}

/* the static architecture diagram (goal -> log -> graph -> behaviors -> events) */
export function archDiagram() {
  return '<div class="arch"><div class="archflow">' +
    '<div class="archbox"><span class="n">push</span><span class="t">Goal</span></div>' +
    '<div class="archarrow">→</div>' +
    '<div class="archbox log"><span class="n">append-only</span><span class="t">Event Log</span></div>' +
    '<div class="archarrow">→</div>' +
    '<div class="archbox graph"><span class="n">deterministic fold</span><span class="t">Graph Projection</span></div>' +
    '<div class="archarrow">→</div>' +
    '<div class="archbox beh"><span class="n">react to changes</span><span class="t">Behaviors</span></div>' +
    '<div class="archarrow">→</div>' +
    '<div class="archbox"><span class="n">write back</span><span class="t">New Events</span></div>' +
    '</div><div class="archloop">↻ &nbsp;the new events re-enter the log — and the same log powers&nbsp; replay · fork · diff · lineage / audit</div></div>';
}
