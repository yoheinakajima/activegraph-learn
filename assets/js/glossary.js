/* ============================================================================
   glossary.js — the slide-in vocabulary panel. The term list is the single
   source of truth for activegraph's core nouns; keep it in sync with the docs.
   ========================================================================== */
import { esc } from './util.js';

export const GLOSSARY = [
  ['Event', 'An immutable, append-only fact: something happened. Has a type, payload, actor, timestamp, and the event that caused it. Nothing in the system mutates state except by appending an event.'],
  ['Log', 'The ordered sequence of all events. The single source of truth. Everything else is derived from it, so it can be replayed, forked, and audited.'],
  ['Graph Projection', 'The live graph the agent reads — objects and relations — computed by folding the event log forward. The graph is a view of the log, never edited directly.'],
  ['Object', 'A typed node in the graph (a task, claim, company, decision). Created and changed only by emitting events; you never set its fields directly.'],
  ['Relation', 'A typed, directed edge between objects (depends_on, supports, contradicts, blocks). Edges carry meaning — and can carry behavior.'],
  ['Behavior', 'A reactive code unit that fires when matching events/objects appear and writes back to the graph. It reacts; it does not decide. The decorator declares what it listens to.'],
  ['Tool', 'A side-effecting call to the outside world (network, files). Isolated behind @tool so the deterministic core stays pure and replayable.'],
  ['Replay', 'Re-deriving any run by re-applying its event log. Same log in, same graph out — model/tool calls are served from cache.'],
  ['Fork', 'Branching a run at a historical event. The shared prefix replays from cache (no duplicate LLM spend); only the divergent tail re-runs.'],
  ['Diff', 'A structured comparison of two runs (or a run and its fork): which objects and relations changed, and why.'],
  ['Goal', 'The external input that starts work — pushed in as a goal.created event. Goals enter from outside; the system is otherwise event-driven.'],
  ['Lineage', 'The causal chain behind any object: the event that created it, the behavior that fired, the evidence and model call involved. Audit falls out of the architecture.'],
];

export function renderGlossary() {
  const items = GLOSSARY.map(
    (g) => '<div class="gterm"><dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd></div>'
  ).join('');
  document.getElementById('glossPanel').innerHTML =
    '<div class="gloss-h"><h3>Glossary</h3><span class="x" id="glossX">✕</span></div>' +
    '<div class="hint">The vocabulary is small but new. Press <b>G</b> anytime.</div>' + items;
  document.getElementById('glossX').onclick = closeGloss;
}

export function openGloss() {
  document.getElementById('glossPanel').classList.add('on');
  document.getElementById('glossScrim').classList.add('on');
}

export function closeGloss() {
  document.getElementById('glossPanel').classList.remove('on');
  document.getElementById('glossScrim').classList.remove('on');
}
