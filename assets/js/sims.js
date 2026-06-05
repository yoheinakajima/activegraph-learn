/* ============================================================================
   sims.js — interactive widgets for Tutorial 1 ("From LLM Loops to Living
   Graphs"), plus the shared log/JSON renderers reused by the research sims.

   Each runner takes a host element id, builds its own markup, wires its own
   buttons, and registers any intervals with the timer registry so the router
   can stop them on navigation.
   ========================================================================== */
import { esc, registerTimer, dropTimer } from './util.js';

/* ---- the canonical "Evaluate Acme" run, used by runSim() ------------------ */
const NODES = {
  n0: { x: 185, y: 32, t: 'goal · Acme', c: 'var(--graph)' },
  n1: { x: 78, y: 104, t: 'task · research', c: 'var(--behavior)' },
  n2: { x: 296, y: 104, t: 'task · memo', c: 'var(--behavior)' },
  n3: { x: 72, y: 190, t: 'claim · TAM $4B', c: 'var(--llm)' },
  n5: { x: 322, y: 192, t: 'evidence · Q3', c: 'var(--log)' },
  n4: { x: 206, y: 202, t: 'claim · risk', c: 'var(--llm)' },
};
const EDGES = {
  e1: { a: 'n2', b: 'n1', l: 'depends_on' },
  e2: { a: 'n3', b: 'n2', l: 'supports' },
  e3: { a: 'n5', b: 'n3', l: 'supports' },
  e4: { a: 'n4', b: 'n3', l: 'contradicts' },
};
const SCRIPT = [
  { ev: { ty: 'goal.created', pl: 'goal:"Evaluate Acme"', k: 'goal' },
    msg: { r: 'user', t: 'Evaluate Acme as an investment.' },
    g: { node: 'n0' }, cap: 'A goal enters from outside as one event. In the naive loop it is just the first string in <b>messages[]</b>.' },
  { ev: { ty: 'behavior.started', pl: 'planner', k: 'beh' },
    msg: { r: 'assistant', t: 'Plan: (1) research market (2) draft memo' },
    g: {}, cap: 'The <b>planner</b> behavior reacts to goal.created. No master loop called it — the event did.' },
  { ev: { ty: 'object.created', pl: 'task · research', k: '' },
    msg: null, g: { node: 'n1' }, cap: 'A task becomes a <b>typed object</b> in the graph — not a sentence to be re-parsed later.' },
  { ev: { ty: 'object.created', pl: 'task · memo  +depends_on', k: '' },
    msg: null, g: { node: 'n2', edge: 'e1' }, cap: 'A second task plus a <b>depends_on</b> edge. The dependency is data — queryable forever.' },
  { ev: { ty: 'llm.responded', pl: 'claim: TAM ~$4B', k: 'llm' },
    msg: { r: 'assistant', t: 'Market looks ~$4B TAM.' }, g: { node: 'n3', edge: 'e2' },
    cap: 'A model call is logged as a request/response <b>pair</b>. On replay it serves from cache — never re-charged.' },
  { ev: { ty: 'tool.responded', pl: 'q3_report.pdf', k: 'beh' },
    msg: { r: 'tool', t: 'fetched q3_report.pdf (12kb)' }, g: { node: 'n5', edge: 'e3' },
    cap: 'A <b>@tool</b> call fetches evidence. The side effect is captured as an event and an evidence object.' },
  { ev: { ty: 'object.created', pl: 'claim · incumbent risk', k: 'llm' },
    msg: { r: 'assistant', t: '…(earlier turns dropped to fit window)…', trunc: true }, g: { node: 'n4', edge: 'e4' },
    cap: 'The naive loop is now truncating early turns to fit the window — it is forgetting. The graph forgets nothing.' },
  { ev: { ty: 'patch.applied', pl: 'memo · status=done', k: 'beh' },
    msg: { r: 'assistant', t: 'Final memo drafted.' }, g: { pulse: 'n2', hl: 'e1' },
    cap: 'An <b>unblock</b> behavior living on the depends_on edge flips memo to done. Edge logic, fired by an event.' },
  { ev: { ty: 'runtime.idle', pl: 'no pending events', k: 'goal' },
    msg: { r: 'system', t: 'run complete' }, g: {}, cap: 'The run ends when nothing is pending. It is now fully replayable, forkable, and diffable.' },
];

function gsvg(s) {
  const ed = Object.keys(EDGES).map((id) => {
    if (!s.edges.has(id)) return '';
    const e = EDGES[id], a = NODES[e.a], b = NODES[e.b], on = s.hl === id ? ' on' : '';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return '<line class="gedge' + on + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>' +
      '<text class="gedge-lab" x="' + mx + '" y="' + (my - 3) + '" text-anchor="middle">' + e.l + '</text>';
  }).join('');
  const nd = Object.keys(NODES).map((id) => {
    if (!s.nodes.has(id)) return '';
    const o = NODES[id], pf = s.pulse === id ? ' filter:drop-shadow(0 0 7px ' + o.c + ');' : '';
    return '<g class="gnode" style="' + pf + '"><circle cx="' + o.x + '" cy="' + o.y + '" r="9" fill="' + o.c + '" fill-opacity="0.2" stroke="' + o.c + '" stroke-width="1.5"/>' +
      '<text x="' + o.x + '" y="' + (o.y + 20) + '" text-anchor="middle">' + esc(o.t) + '</text></g>';
  }).join('');
  return '<div class="gwrap"><svg class="graph" viewBox="0 0 394 252">' + ed + nd + '</svg></div>';
}

/* shared renderers — exported so the research sims can reuse them */
export function logHTML(s) {
  if (!s.events.length) return '<div style="color:var(--ghost);font-family:var(--mono);font-size:11.5px">— empty —</div>';
  return s.events.map((e) =>
    '<div class="evt ' + (e.k || '') + '"><span class="ty">' + esc(e.ty) + '</span><span class="pl">' + esc(e.pl) + '</span></div>'
  ).join('');
}

export function rawJSON(s) {
  const arr = s.events.map((e, i) => ({ id: 'e' + i, type: e.ty, payload: e.pl }));
  return JSON.stringify(arr, null, 2);
}

function msgsHTML(s) {
  if (!s.msgs.length) return '<div style="color:var(--ghost);font-family:var(--mono);font-size:11.5px">— empty —</div>';
  return s.msgs.map((m) => {
    const c = m.trunc ? 'msg trunc' : 'msg';
    return '<div class="' + c + '"><span class="r">' + esc(m.r) + '</span> ' + (m.trunc ? '<span class="warn">' + esc(m.t) + '</span>' : esc(m.t)) + '</div>';
  }).join('');
}

/* mode: 'log-graph' (event log | graph)  or  'naive-log' (messages[] | event log) */
export function runSim(hostId, mode) {
  const host = document.getElementById(hostId); if (!host) return;
  const s = { i: -1, events: [], msgs: [], nodes: new Set(), edges: new Set(), hl: null, pulse: null, timer: null, raw: false };
  const leftIsNaive = (mode === 'naive-log');
  const col1 = leftIsNaive
    ? '<div class="sim-col"><div class="col-h"><span class="d" style="background:var(--danger)"></span>naive · messages[]</div><div id="' + hostId + '_a"></div></div>'
    : '<div class="sim-col"><div class="col-h"><span class="d" style="background:var(--log)"></span>event log · source of truth</div><div id="' + hostId + '_a"></div></div>';
  const col2 = leftIsNaive
    ? '<div class="sim-col"><div class="col-h"><span class="d" style="background:var(--log)"></span>event log · source of truth</div><div id="' + hostId + '_b"></div></div>'
    : '<div class="sim-col"><div class="col-h"><span class="d" style="background:var(--graph)"></span>graph · projection of the log</div><div id="' + hostId + '_b"></div></div>';
  const raw = leftIsNaive ? '' : '<div class="rawtoggle" id="' + hostId + '_rt">▸ view raw event-log JSON</div><div class="rawbox" id="' + hostId + '_rb" style="display:none"><pre id="' + hostId + '_rj"></pre></div>';
  host.innerHTML =
    '<div class="sim"><div class="sim-bar"><span class="ttl">run · "Evaluate Acme"</span>' +
    '<span class="sp"></span>' +
    '<button class="btn gho" id="' + hostId + '_rs">Reset</button>' +
    '<button class="btn" id="' + hostId + '_pl">▶ Play</button>' +
    '<button class="btn pri" id="' + hostId + '_st">Step →</button></div>' +
    '<div class="sim-body">' + col1 + col2 + '</div>' +
    '<div class="step-cap" id="' + hostId + '_cap">Press <b style="color:var(--graph)">Step</b> to advance the run one event at a time.</div>' +
    raw + '</div>';

  function paint() {
    if (!document.getElementById(hostId + '_a')) return;
    document.getElementById(hostId + '_a').innerHTML = leftIsNaive ? msgsHTML(s) : logHTML(s);
    document.getElementById(hostId + '_b').innerHTML = leftIsNaive ? logHTML(s) : gsvg(s);
    if (!leftIsNaive) { const rj = document.getElementById(hostId + '_rj'); if (rj) rj.textContent = rawJSON(s); }
  }
  function step() {
    if (s.i >= SCRIPT.length - 1) return;
    s.i++; const d = SCRIPT[s.i]; s.pulse = null; s.hl = null;
    s.events.push(d.ev);
    if (d.msg) s.msgs.push(d.msg);
    if (d.g.node) s.nodes.add(d.g.node);
    if (d.g.edge) s.edges.add(d.g.edge);
    if (d.g.pulse) s.pulse = d.g.pulse;
    if (d.g.hl) s.hl = d.g.hl;
    document.getElementById(hostId + '_cap').innerHTML = d.cap;
    paint();
    if (s.i >= SCRIPT.length - 1) { document.getElementById(hostId + '_st').disabled = true; stop(); }
  }
  function play() {
    if (s.timer) { stop(); return; }
    document.getElementById(hostId + '_pl').textContent = '❚❚ Pause';
    s.timer = registerTimer(setInterval(() => {
      if (!document.getElementById(hostId + '_st')) { stop(); return; }
      if (s.i >= SCRIPT.length - 1) { stop(); return; }
      step();
    }, 1100));
  }
  function stop() {
    if (s.timer) { clearInterval(s.timer); dropTimer(s.timer); s.timer = null; }
    const p = document.getElementById(hostId + '_pl'); if (p) p.textContent = '▶ Play';
  }
  function reset() {
    stop(); s.i = -1; s.events = []; s.msgs = []; s.nodes = new Set(); s.edges = new Set(); s.hl = null; s.pulse = null;
    document.getElementById(hostId + '_st').disabled = false;
    document.getElementById(hostId + '_cap').innerHTML = 'Press <b style="color:var(--graph)">Step</b> to advance the run one event at a time.';
    paint();
  }
  document.getElementById(hostId + '_st').onclick = step;
  document.getElementById(hostId + '_pl').onclick = play;
  document.getElementById(hostId + '_rs').onclick = reset;
  if (!leftIsNaive) {
    document.getElementById(hostId + '_rt').onclick = function () {
      s.raw = !s.raw;
      const rb = document.getElementById(hostId + '_rb');
      rb.style.display = s.raw ? 'block' : 'none';
      this.textContent = (s.raw ? '▾' : '▸') + ' view raw event-log JSON';
    };
  }
  paint();
}

/* ---- behavior anatomy: tap each decorator argument to explain it ---------- */
export function runAnatomy(hostId) {
  const host = document.getElementById(hostId); if (!host) return;
  const parts = [
    { k: 'name', txt: 'name="contradiction_check"', exp: '<b>name</b> — a stable identifier for this behavior. It shows up in the trace (behavior.started / behavior.completed) so every action is attributable.' },
    { k: 'on', txt: 'on=["object.created"]', exp: '<b>on</b> — the event types this behavior subscribes to. It wakes only when one of these is appended to the log. Nothing polls; the log drives it.' },
    { k: 'where', txt: 'where={"object.type": "claim"}', exp: '<b>where</b> — a cheap filter. Of all object.created events, only react when the object is a claim. Keeps behaviors narrow and composable.' },
    { k: 'pattern', txt: 'pattern="(c:claim)-[:contradicts]->(o:claim)"', exp: '<b>pattern</b> — a graph query. The behavior fires only when this shape exists, and ctx.matches hands you the bound nodes. Logic keys off the world’s structure, not string parsing.' },
    { k: 'after', txt: 'activate_after=1', exp: '<b>activate_after</b> — debounce. Wait until at least N matches accumulate before firing, so you batch instead of thrashing on every single event.' },
  ];
  const deco = '@behavior(\n    ' + parts.map((p) => '<span class="arg" data-k="' + p.k + '">' + esc(p.txt) + '</span>').join(',\n    ') + '\n)';
  const body = '<span class="t-kw">def</span> <span class="t-def">contradiction_check</span>(event, graph, ctx):\n' +
    '    <span class="t-com"># ctx.matches holds the (c, o) pairs the pattern bound</span>\n' +
    '    <span class="t-kw">for</span> c, o <span class="t-kw">in</span> ctx.matches:\n' +
    '        graph.<span class="t-fn">add_object</span>(<span class="t-str">"flag"</span>, {<span class="t-str">"about"</span>: c.id})';
  host.innerHTML = '<div class="anat"><span class="t-dec">' + deco + '</span>\n' + body +
    '<div class="anat-exp" id="' + hostId + '_e">Tap any argument above to see what it controls. A behavior is fully declared by what it <i>listens to</i> and <i>matches on</i> — the body just reacts.</div></div>';
  const args = host.querySelectorAll('.arg');
  args.forEach((a) => {
    a.onclick = function () {
      args.forEach((x) => x.classList.remove('on'));
      a.classList.add('on');
      const p = parts.filter((z) => z.k === a.getAttribute('data-k'))[0];
      document.getElementById(hostId + '_e').innerHTML = p.exp;
    };
  });
}

/* ---- fork & diff: branch the Acme run at e4 and compare the two worlds ---- */
export function runFork(hostId) {
  const host = document.getElementById(hostId); if (!host) return;
  const labels = ['goal', 'plan', 'research', 'memo', 'TAM', '+evidence', 'risk'];
  const FORK = 4, st = { forked: false };
  function tl() {
    let h = '';
    for (let i = 0; i < labels.length; i++) {
      let cls = 'tev';
      if (i <= (st.forked ? FORK : labels.length - 1)) cls += ' done';
      if (st.forked && i === FORK) cls += ' fk';
      if (st.forked && i > FORK) cls = 'tev';
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
    const rows = [
      ['goal · Acme', '=', 'goal · Acme', 'same'],
      ['threshold = 0.5', 'threshold = 0.5', 'same'],
      ['claim · TAM $4B', 'claim · TAM $4B', 'same'],
      ['decision: PASS', 'decision: INVEST', 'diff'],
      ['risk weight ×1.0', 'risk weight ×0.6', 'diff'],
    ];
    let L = '<div class="diffcell"><h5 style="color:var(--log)">parent run</h5>';
    let R = '<div class="diffcell"><h5 style="color:var(--graph)">fork @ e4 · risk weight changed</h5>';
    rows.forEach((r) => {
      if (r.length === 3) { L += '<div class="dl same">' + esc(r[0]) + '</div>'; R += '<div class="dl same">' + esc(r[1]) + '</div>'; }
      else { L += '<div class="dl"><span class="b">' + esc(r[0]) + '</span></div>'; R += '<div class="dl"><span class="a">' + esc(r[2]) + '</span></div>'; }
    });
    return L + '</div>' + R + '</div>';
  }
  function render() {
    host.innerHTML = '<div class="sim"><div class="sim-bar"><span class="ttl">replay · fork · diff</span><span class="sp"></span>' +
      '<button class="btn gho" id="' + hostId + '_rs">Reset</button>' +
      '<button class="btn pri" id="' + hostId + '_fk">' + (st.forked ? '✓ forked @ e4' : 'Fork @ e4 →') + '</button></div>' +
      '<div class="forkviz"><div style="font-family:var(--mono);font-size:11px;color:var(--faint);margin-bottom:4px">one run · 7 events</div>' +
      '<div class="timeline">' + tl() + '</div>' +
      (st.forked
        ? '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-bottom:12px">Events <b style="color:var(--log)">e0–e4</b> replayed from cache — no LLM re-spend. Only the tail re-ran under a new risk weight.</div>' + '<div class="diffgrid">' + diff() + '</div>'
        : '<div style="font-family:var(--mono);font-size:11.5px;color:var(--dim)">The run is just its log. Fork it at event 4 to ask: <i>what if the risk weight were lower?</i> The shared prefix is reused; the rest re-derives.</div>') +
      '</div></div>';
    document.getElementById(hostId + '_fk').onclick = function () { if (st.forked) return; st.forked = true; render(); };
    document.getElementById(hostId + '_rs').onclick = function () { st.forked = false; render(); };
  }
  render();
}
