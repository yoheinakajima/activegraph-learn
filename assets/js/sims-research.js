/* ============================================================================
   sims-research.js — interactive widgets for Tutorial 2 ("The ReAct
   Deep-Research Agent"): the research run, the contradiction detector, the
   lineage walker, and the research fork/diff. Reuses logHTML/rawJSON from
   sims.js so the raw event-log view is identical across tutorials.
   ========================================================================== */
import { esc, registerTimer, dropTimer } from './util.js';
import { logHTML, rawJSON } from './sims.js';

/* ---- the "OSS AI adoption?" research run ---------------------------------- */
const RNODES = {
  q0: { x: 198, y: 24, t: 'Q · OSS adoption?', c: 'var(--graph)' },
  s1: { x: 96, y: 90, t: 'subq · adoption %', c: 'var(--behavior)' },
  src1: { x: 66, y: 162, t: 'src · vendor rpt', c: 'var(--log)' },
  src2: { x: 322, y: 150, t: 'src · analyst survey', c: 'var(--log)' },
  c1: { x: 150, y: 234, t: 'claim · ~80%', c: 'var(--llm)' },
  c2: { x: 322, y: 234, t: 'claim · ~55%', c: 'var(--llm)' },
};
const REDGES = {
  e1: { a: 's1', b: 'q0', l: 'refines' },
  e2: { a: 'c1', b: 'src1', l: 'sourced_from' },
  e3: { a: 'c2', b: 'src2', l: 'sourced_from' },
  e5: { a: 'c1', b: 's1', l: 'answers' },
  e4: { a: 'c1', b: 'c2', l: 'contradicts' },
};
const RSCRIPT = [
  { ev: { ty: 'goal.created', pl: 'goal:"Is OSS AI adoption accelerating?"', k: 'goal' },
    sc: { r: 'question', t: 'Is open-source AI adoption in enterprises accelerating?' },
    g: { node: 'q0' }, cap: 'The research question enters as one event. In ReAct it is just the first line of the scratchpad.' },
  { ev: { ty: 'object.created', pl: 'subquestion · adoption %', k: 'beh' },
    sc: { r: 'thought', t: 'I should break this into sub-questions: rate, trend, blockers.' },
    g: { node: 's1', edge: 'e1' }, cap: 'A <b>planner</b> behavior decomposes the question into typed subquestion objects — not prose in a buffer.' },
  { ev: { ty: 'tool.responded', pl: 'web_search → vendor report', k: 'beh' },
    sc: { r: 'action', t: 'search["enterprise OSS AI adoption 2026"]' },
    g: { node: 'src1' }, cap: 'A <b>@tool</b> web_search runs. The result is logged and the page becomes a <b>source</b> object — with its URL and trust score kept.' },
  { ev: { ty: 'tool.responded', pl: 'web_search → analyst survey', k: 'beh' },
    sc: { r: 'observation', t: 'Found: vendor report + an independent analyst survey.' },
    g: { node: 'src2' }, cap: 'A second source. Both are now first-class nodes, each with provenance — not summarized away into the scratchpad.' },
  { ev: { ty: 'llm.responded', pl: 'claim · ~80%  sourced_from vendor', k: 'llm' },
    sc: { r: 'thought', t: 'Vendor report claims ~80% adoption.' },
    g: { node: 'c1', edge: 'e2' }, cap: 'An <b>extractor</b> pulls a claim and links it to its source. Provenance is an <b>edge</b>, not a hope.' },
  { ev: { ty: 'llm.responded', pl: 'claim · ~55%  sourced_from survey', k: 'llm' },
    sc: { r: 'observation', t: '…(earliest turns truncated to fit window)… survey says ~55%.', trunc: true },
    g: { node: 'c2', edge: 'e3' }, cap: 'The ReAct scratchpad is already dropping early turns to fit the window. The graph keeps every claim and every link.' },
  { ev: { ty: 'contradiction.found', pl: '~80% contradicts ~55%', k: 'llm' },
    sc: { r: 'thought', t: '(the scratchpad has no slot for "these disagree" — it will just pick one)' },
    g: { edge: 'e4', hl: 'e4' }, cap: 'A <b>contradiction_check</b> behavior fires: same subquestion, conflicting values → a <b>contradicts</b> edge + a flag event.' },
  { ev: { ty: 'object.created', pl: 'report · cites both claims', k: 'beh' },
    sc: { r: 'final', t: 'Adoption is ~80%.' },
    g: { node: 's1', edge: 'e5', pulse: 'q0' }, cap: 'ReAct emits a confident single number and the disagreement vanishes. The synthesizer instead reports the conflict and cites both sources.' },
  { ev: { ty: 'runtime.idle', pl: 'all subquestions answered', k: 'goal' },
    sc: { r: 'final', t: 'done' }, g: {}, cap: 'The run ends when coverage is complete. The whole research process is now replayable, auditable, and forkable.' },
];

function rGraph(s) {
  const ed = Object.keys(REDGES).map((id) => {
    if (!s.edges.has(id)) return '';
    const e = REDGES[id], a = RNODES[e.a], b = RNODES[e.b];
    const contra = e.l === 'contradicts';
    const col = contra ? 'var(--danger)' : (s.hl === id ? 'var(--graph)' : 'var(--line-2)');
    const w = (s.hl === id) ? '2.4' : '1.5';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const glow = (s.hl === id && contra) ? ' filter:drop-shadow(0 0 5px var(--danger));' : '';
    return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + col + '" stroke-width="' + w + '" ' + (contra ? 'stroke-dasharray="4 3"' : '') + ' style="transition:.3s;' + glow + '"/>' +
      '<text class="gedge-lab" x="' + mx + '" y="' + (my - 3) + '" text-anchor="middle" fill="' + (contra ? 'var(--danger)' : 'var(--faint)') + '">' + e.l + '</text>';
  }).join('');
  const nd = Object.keys(RNODES).map((id) => {
    if (!s.nodes.has(id)) return '';
    const o = RNODES[id], pf = s.pulse === id ? ' filter:drop-shadow(0 0 7px ' + o.c + ');' : '';
    return '<g class="gnode" style="' + pf + '"><circle cx="' + o.x + '" cy="' + o.y + '" r="9" fill="' + o.c + '" fill-opacity="0.2" stroke="' + o.c + '" stroke-width="1.5"/>' +
      '<text x="' + o.x + '" y="' + (o.y + 20) + '" text-anchor="middle">' + esc(o.t) + '</text></g>';
  }).join('');
  return '<div class="gwrap"><svg class="graph" viewBox="0 0 400 268">' + ed + nd + '</svg></div>';
}

function rScratchHTML(s) {
  if (!s.scratch.length) return '<div style="color:var(--ghost);font-family:var(--mono);font-size:11.5px">— empty —</div>';
  return s.scratch.map((m) => {
    const rc = m.r === 'thought' ? 'var(--llm)' : m.r === 'action' ? 'var(--behavior)' : m.r === 'observation' ? 'var(--log)' : m.r === 'final' ? 'var(--graph)' : 'var(--faint)';
    return '<div class="' + (m.trunc ? 'msg trunc' : 'msg') + '"><span class="r" style="color:' + rc + '">' + esc(m.r) + '</span> ' + (m.trunc ? '<span class="warn">' + esc(m.t) + '</span>' : esc(m.t)) + '</div>';
  }).join('');
}

/* mode: 'react-graph' (scratchpad | graph)  or  'log-graph' (event log | graph) */
export function runRSim(hostId, mode) {
  const host = document.getElementById(hostId); if (!host) return;
  const s = { i: -1, events: [], scratch: [], nodes: new Set(), edges: new Set(), hl: null, pulse: null, timer: null, raw: false };
  const leftScratch = (mode === 'react-graph');
  const c1h = leftScratch ? '<span class="d" style="background:var(--danger)"></span>ReAct · scratchpad' : '<span class="d" style="background:var(--log)"></span>event log · source of truth';
  const col1 = '<div class="sim-col"><div class="col-h">' + c1h + '</div><div id="' + hostId + '_a"></div></div>';
  const col2 = '<div class="sim-col"><div class="col-h"><span class="d" style="background:var(--graph)"></span>research graph · projection</div><div id="' + hostId + '_b"></div></div>';
  host.innerHTML = '<div class="sim"><div class="sim-bar"><span class="ttl">research run · "OSS AI adoption?"</span><span class="sp"></span>' +
    '<button class="btn gho" id="' + hostId + '_rs">Reset</button>' +
    '<button class="btn" id="' + hostId + '_pl">▶ Play</button>' +
    '<button class="btn pri" id="' + hostId + '_st">Step →</button></div>' +
    '<div class="sim-body">' + col1 + col2 + '</div>' +
    '<div class="step-cap" id="' + hostId + '_cap">Press <b style="color:var(--graph)">Step</b> to run the research agent one event at a time.</div>' +
    '<div class="rawtoggle" id="' + hostId + '_rt">▸ view raw event-log JSON</div><div class="rawbox" id="' + hostId + '_rb" style="display:none"><pre id="' + hostId + '_rj"></pre></div></div>';

  function paint() {
    if (!document.getElementById(hostId + '_a')) return;
    document.getElementById(hostId + '_a').innerHTML = leftScratch ? rScratchHTML(s) : logHTML(s);
    document.getElementById(hostId + '_b').innerHTML = rGraph(s);
    const rj = document.getElementById(hostId + '_rj'); if (rj) rj.textContent = rawJSON(s);
  }
  function step() {
    if (s.i >= RSCRIPT.length - 1) return;
    s.i++; const d = RSCRIPT[s.i]; s.pulse = null; s.hl = null;
    s.events.push(d.ev); if (d.sc) s.scratch.push(d.sc);
    if (d.g.node) s.nodes.add(d.g.node); if (d.g.edge) s.edges.add(d.g.edge);
    if (d.g.pulse) s.pulse = d.g.pulse; if (d.g.hl) s.hl = d.g.hl;
    document.getElementById(hostId + '_cap').innerHTML = d.cap; paint();
    if (s.i >= RSCRIPT.length - 1) { document.getElementById(hostId + '_st').disabled = true; stop(); }
  }
  function play() {
    if (s.timer) { stop(); return; }
    document.getElementById(hostId + '_pl').textContent = '❚❚ Pause';
    s.timer = registerTimer(setInterval(() => {
      if (!document.getElementById(hostId + '_st')) { stop(); return; }
      if (s.i >= RSCRIPT.length - 1) { stop(); return; }
      step();
    }, 1150));
  }
  function stop() {
    if (s.timer) { clearInterval(s.timer); dropTimer(s.timer); s.timer = null; }
    const p = document.getElementById(hostId + '_pl'); if (p) p.textContent = '▶ Play';
  }
  function reset() {
    stop(); s.i = -1; s.events = []; s.scratch = []; s.nodes = new Set(); s.edges = new Set(); s.hl = null; s.pulse = null;
    document.getElementById(hostId + '_st').disabled = false;
    document.getElementById(hostId + '_cap').innerHTML = 'Press <b style="color:var(--graph)">Step</b> to run the research agent one event at a time.';
    paint();
  }
  document.getElementById(hostId + '_st').onclick = step;
  document.getElementById(hostId + '_pl').onclick = play;
  document.getElementById(hostId + '_rs').onclick = reset;
  document.getElementById(hostId + '_rt').onclick = function () {
    s.raw = !s.raw; const rb = document.getElementById(hostId + '_rb');
    rb.style.display = s.raw ? 'block' : 'none';
    this.textContent = (s.raw ? '▾' : '▸') + ' view raw event-log JSON';
  };
  paint();
}

/* ---- contradiction detector ---------------------------------------------- */
export function runContradiction(hostId) {
  const host = document.getElementById(hostId); if (!host) return;
  const st = { fired: false };
  function render() {
    host.innerHTML = '<div class="sim"><div class="sim-bar"><span class="ttl">behavior · contradiction_check</span><span class="sp"></span>' +
      '<button class="btn gho" id="' + hostId + '_rs">Reset</button>' +
      '<button class="btn pri" id="' + hostId + '_go"' + (st.fired ? ' disabled' : '') + '>' + (st.fired ? '✓ fired' : 'fire on new claim →') + '</button></div>' +
      '<div class="forkviz"><div class="diffgrid" style="grid-template-columns:1fr 1fr">' +
      '<div class="diffcell" style="border-color:rgba(157,176,255,.4)"><h5 style="color:var(--llm)">claim A</h5><div class="dl">value: <span class="a">~80%</span></div><div class="dl">about: OSS adoption</div><div class="dl b">sourced_from: vendor rpt (trust 0.4)</div></div>' +
      '<div class="diffcell" style="border-color:rgba(157,176,255,.4)"><h5 style="color:var(--llm)">claim B</h5><div class="dl">value: <span class="a">~55%</span></div><div class="dl">about: OSS adoption</div><div class="dl b">sourced_from: analyst survey (trust 0.8)</div></div>' +
      '</div>' +
      (st.fired
        ? '<div style="margin-top:14px"><div class="evt llm" style="border-color:rgba(255,133,133,.4)"><span class="ty" style="color:var(--danger)">relation.created</span><span class="pl">A —[contradicts]→ B</span></div>' +
          '<div class="evt" style="border-color:rgba(255,133,133,.4)"><span class="ty" style="color:var(--danger)">contradiction.found</span><span class="pl">subquestion "adoption %" has conflicting claims</span></div>' +
          '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-top:10px">The disagreement is now a <b style="color:var(--danger)">fact in the graph</b>. The synthesizer will report both and flag the conflict — instead of silently keeping one number.</div></div>'
        : '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-top:14px">Two claims answer the same subquestion with different values. In a ReAct scratchpad this is invisible — the model just picks one. Fire the behavior to see what activegraph does instead.</div>') +
      '</div></div>';
    document.getElementById(hostId + '_go').onclick = function () { st.fired = true; render(); };
    document.getElementById(hostId + '_rs').onclick = function () { st.fired = false; render(); };
  }
  render();
}

/* ---- provenance / lineage walker ----------------------------------------- */
export function runLineage(hostId) {
  const host = document.getElementById(hostId); if (!host) return;
  const CHAINS = {
    c1: [['report', 'final report · §adoption'], ['claim', '"~80% adoption"'], ['relation', 'sourced_from'], ['source', 'Vendor 2026 Report · trust 0.4'], ['event', 'tool.responded · web_search'], ['subquestion', '"current adoption rate"'], ['question', '"Is OSS AI adoption accelerating?"']],
    c2: [['report', 'final report · §adoption'], ['claim', '"~55% adoption"'], ['relation', 'sourced_from'], ['source', 'Analyst Survey · trust 0.8'], ['event', 'tool.responded · web_search'], ['subquestion', '"current adoption rate"'], ['question', '"Is OSS AI adoption accelerating?"']],
  };
  let sel = null;
  function chainHTML() {
    if (!sel) return '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);padding:6px 0">Tap a cited claim above. Every claim traces back through its source, the search that found it, and the subquestion it answers — to the original question. That is <b style="color:var(--graph)">lineage</b>, and it is just a walk over the log.</div>';
    const rows = CHAINS[sel];
    return rows.map((r, i) => {
      const col = r[0] === 'claim' ? 'var(--llm)' : r[0] === 'source' ? 'var(--log)' : r[0] === 'event' ? 'var(--behavior)' : r[0] === 'question' ? 'var(--graph)' : 'var(--dim)';
      return '<div class="dl" style="display:flex;gap:10px;align-items:center;padding:5px 0;opacity:0;animation:rv .3s ease forwards;animation-delay:' + (i * 0.06) + 's">' +
        '<span class="mono" style="font-size:10px;color:var(--faint);min-width:74px">' + esc(r[0]) + '</span>' +
        '<span style="color:var(--ghost)">' + (i === 0 ? '•' : '↑') + '</span>' +
        '<span class="mono" style="font-size:12px;color:' + col + '">' + esc(r[1]) + '</span></div>';
    }).join('');
  }
  function render() {
    host.innerHTML = '<div class="sim"><div class="sim-bar"><span class="ttl">lineage · "where did this come from?"</span></div>' +
      '<div class="forkviz"><div style="font-family:var(--mono);font-size:11px;color:var(--faint);margin-bottom:8px">final report cites:</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
      '<button class="btn' + (sel === 'c1' ? ' pri' : '') + '" id="' + hostId + '_c1">claim · ~80%</button>' +
      '<button class="btn' + (sel === 'c2' ? ' pri' : '') + '" id="' + hostId + '_c2">claim · ~55%</button></div>' +
      '<div id="' + hostId + '_ch">' + chainHTML() + '</div></div></div>';
    document.getElementById(hostId + '_c1').onclick = function () { sel = 'c1'; render(); };
    document.getElementById(hostId + '_c2').onclick = function () { sel = 'c2'; render(); };
  }
  render();
}

/* ---- research fork / diff ------------------------------------------------- */
export function runResearchFork(hostId) {
  const host = document.getElementById(hostId); if (!host) return;
  const labels = ['Q', 'subq', 'search', 'search', 'claim80', 'claim55', 'contradict', 'synth'];
  const FORK = 7, st = { forked: false };
  function tl() {
    let h = '';
    for (let i = 0; i < labels.length; i++) {
      let cls = 'tev';
      if (i <= (st.forked ? FORK : labels.length - 1)) cls += ' done';
      if (st.forked && i === FORK) cls += ' fk';
      h += '<div class="' + cls + '"><div class="c"></div><div class="lab">e' + i + '</div></div>';
      if (i < labels.length - 1) {
        let con = 'tconn';
        if (i < FORK) con += ' done';
        if (st.forked && i >= FORK) con += ' fork';
        h += '<div class="' + con + '"></div>';
      }
    }
    return h;
  }
  function diff() {
    const L = '<div class="diffcell"><h5 style="color:var(--log)">parent run · all sources</h5>' +
      '<div class="dl">source_trust ≥ <span class="b">0.0</span></div>' +
      '<div class="dl">sources used: <span class="b">2</span> (vendor + survey)</div>' +
      '<div class="dl">claims: ~80% &amp; ~55%</div>' +
      '<div class="dl"><span class="b">conclusion: disputed (~55–80%)</span></div></div>';
    const R = '<div class="diffcell"><h5 style="color:var(--graph)">fork @ e7 · trust ≥ 0.6</h5>' +
      '<div class="dl">source_trust ≥ <span class="a">0.6</span></div>' +
      '<div class="dl">sources used: <span class="a">1</span> (survey only)</div>' +
      '<div class="dl same">vendor rpt (0.4) dropped</div>' +
      '<div class="dl"><span class="a">conclusion: ~55%, not yet accelerating</span></div></div>';
    return L + R;
  }
  function render() {
    host.innerHTML = '<div class="sim"><div class="sim-bar"><span class="ttl">replay · fork · diff (research)</span><span class="sp"></span>' +
      '<button class="btn gho" id="' + hostId + '_rs">Reset</button>' +
      '<button class="btn pri" id="' + hostId + '_fk">' + (st.forked ? '✓ forked @ e7' : 'Fork @ synthesis →') + '</button></div>' +
      '<div class="forkviz"><div style="font-family:var(--mono);font-size:11px;color:var(--faint);margin-bottom:4px">one research run · 8 events</div>' +
      '<div class="timeline">' + tl() + '</div>' +
      (st.forked
        ? '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-bottom:12px">Events <b style="color:var(--log)">e0–e6</b> replay from cache — <b>the web searches and extractions are not re-run or re-charged</b>. Only the synthesis re-derives under a stricter trust policy.</div><div class="diffgrid">' + diff() + '</div>'
        : '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim)">The run is its log. Fork at synthesis and ask: <i>what if we only trusted independent sources?</i> Searches stay cached; only the conclusion re-derives.</div>') +
      '</div></div>';
    document.getElementById(hostId + '_fk').onclick = function () { if (st.forked) return; st.forked = true; render(); };
    document.getElementById(hostId + '_rs').onclick = function () { st.forked = false; render(); };
  }
  render();
}
