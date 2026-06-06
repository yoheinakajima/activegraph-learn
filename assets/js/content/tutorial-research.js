/* ============================================================================
   tutorial-research.js — Tutorial 2: "The ReAct Deep-Research Agent".
   Builds a research agent on activegraph and shows the payoff: provenance,
   surfaced contradictions, and a forkable conclusion.
   ========================================================================== */
import { code, note, tabs, maptable } from '../ui.js';
import { runRSim, runContradiction, runLineage, runResearchFork } from '../sims-research.js';

const R0 = {
  id: 'research-orientation',
  title: 'The research agent that forgets its sources',
  init() { runRSim('rsim_hero', 'react-graph'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> orientation</div>' +
      '<h1 class="lh">Every deep-research agent is a scratchpad that forgets its sources.</h1>' +
      '<p class="lead">The canonical research agent is a <em class="term">ReAct</em> loop: reason, act (search / read), observe, append to a scratchpad, repeat until done. Everyone has built one. It demos beautifully — and then fails in exactly the ways research can’t tolerate.</p>' +
      code({ fn: 'react_research.py', badge: 'con', raw:
'scratchpad = question\n' +
'while not done:\n' +
'    thought = llm(scratchpad)                 # Reason\n' +
'    action  = parse(thought)                  # search(q) | read(url) | finish(a)\n' +
'    obs     = run_action(action)              # Act: hit the web\n' +
'    scratchpad += thought + action + obs      # Observe -> grow the buffer\n' +
'    if too_long(scratchpad):\n' +
'        scratchpad = summarize(scratchpad)    # <- sources dissolve into prose here', mark: [8] }) +
      '<p>Four failures are baked in, and they’re the ones that matter most for research:</p>' +
      maptable([
        ['summarize(scratchpad)', 'lost provenance — which page said this?'],
        ['model picks one number', 'swallowed contradictions between sources'],
        ['re-run = re-search', 're-paid web calls on every iteration'],
        ['context window fills up', 'scratchpad amnesia caps how deep you can go'],
      ]) +
      '<div class="pull">Research is a web of claims, sources, and contradictions. So model it as one.</div>' +
      '<p>Below is the same research run two ways: the <strong style="color:var(--danger)">ReAct scratchpad</strong> on the left, and the <strong style="color:var(--graph)">research graph</strong> activegraph projects on the right. Step through and watch step 6–7.</p>' +
      '<div id="rsim_hero"></div>' +
      note('warn', 'the tell', "Around step 6 the scratchpad truncates an early turn, and at step 7–8 it silently resolves a source disagreement into one confident number. The graph keeps both claims, both sources, and a <strong>contradicts</strong> edge between them.") +
      '<p>Over the next steps we’ll build this research agent in activegraph — decompose, search, extract, cross-examine, fill gaps, synthesize — and then collect the payoff: full provenance, surfaced contradictions, and a forkable conclusion.</p>';
  },
};

const R1 = {
  id: 'research-domain',
  title: 'Model the research world',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 1 · the schema</div>' +
      '<h1 class="lh">First, model the world — not the loop.</h1>' +
      '<p class="lead">A ReAct agent has no schema; everything is text in a buffer. The first activegraph move is to name the <em>things</em> in research and how they relate. The rest of the tutorial is just behaviors that read and write this shape.</p>' +
      '<h3 class="lh">Objects (typed nodes)</h3>' +
      maptable([
        ['a line of the question', 'question  — the goal'],
        ['"let me look into X"', 'subquestion  — a decomposed thread'],
        ['a URL in the scratchpad', 'source  — url, title, trust score'],
        ['a sentence of findings', 'claim  — a value + the text asserting it'],
        ['the final answer', 'report  — markdown + a citation list'],
      ]) +
      '<h3 class="lh">Relations (typed edges)</h3>' +
      '<p>The edges are where research actually lives — and they carry meaning a buffer can’t:</p>' +
      code({ fn: 'schema.py', badge: 'con', raw:
'subquestion  --refines-->     question      # decomposition\n' +
'claim        --sourced_from--> source        # PROVENANCE (the key edge)\n' +
'claim        --answers-->     subquestion    # coverage\n' +
'claim        --supports-->    claim          # corroboration\n' +
'claim        --contradicts--> claim          # disagreement, made explicit' }) +
      note('key', 'why start here', "In a workflow graph, nodes are steps. Here, nodes are <strong>facts</strong> and edges are <strong>relationships in the world</strong>. “Where did this claim come from?” and “which sources disagree?” become one-line graph queries — because you modeled them as edges instead of leaving them implicit in prose.") +
      '<p>With the world named, every step from here is a small behavior: it reacts to an event, reads a slice of this graph, and writes new objects or relations back.</p>';
  },
};

const R2 = {
  id: 'research-decompose',
  title: '2 · Decompose the question',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 2 · planner</div>' +
      '<h1 class="lh">Decompose with a behavior, not a prompt.</h1>' +
      '<p class="lead">A ReAct agent decomposes implicitly, inside one long prompt. Here a <code class="mono">planner</code> behavior fires on the goal and writes explicit subquestion objects — each one a thread the rest of the system can track to completion.</p>' +
      code({ fn: 'planner.py', badge: 'run', raw:
'@behavior(name="planner", on=["goal.created"])\n' +
'def planner(event, graph, ctx):\n' +
'    q = graph.add_object("question", {"text": event.payload["goal"]})\n' +
'    for sub in ["current adoption rate", "trend direction", "main blockers"]:\n' +
'        s = graph.add_object("subquestion", {"text": sub, "status": "open"})\n' +
'        graph.add_relation(s.id, q.id, "refines")' }) +
      '<p>Three open subquestions now sit in the graph, each linked to the question by a <code class="mono">refines</code> edge. Nothing searches yet — but the moment a subquestion exists, the next behavior wakes up. That hand-off happens through the graph, not a function call.</p>' +
      note('key', 'status is data', "Each subquestion carries <code class=\"mono\">status: open</code>. Later, a gap-detector flips it to <code class=\"mono\">answered</code> when it has support. The loop’s termination condition becomes a <strong>graph query</strong> (“any open subquestions left?”), not a counter you hope is right.");
  },
};

const R3 = {
  id: 'research-search',
  title: '3 · Search as a replayable tool',
  init() { runRSim('rsim_search', 'log-graph'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 3 · searcher + @tool</div>' +
      '<h1 class="lh">Web search, captured as an event.</h1>' +
      '<p class="lead">Search is the one place a research agent touches the messy outside world. Isolate it behind <code class="mono">@tool</code> so the deterministic core stays pure — and so the result is logged and <strong>cached</strong>.</p>' +
      code({ fn: 'tools.py', badge: 'con', raw:
'@tool(name="web_search")\n' +
'def web_search(query: str) -> list[dict]:\n' +
'    return search_api(query)        # the only network call in the system\n' +
'\n' +
'@tool(name="fetch")\n' +
'def fetch(url: str) -> str:\n' +
'    return http_get(url)' }) +
      '<p>A <code class="mono">searcher</code> behavior fires on each new subquestion, calls the tool, and turns every hit into a <code class="mono">source</code> object — keeping its URL and a trust score instead of pasting text into a buffer:</p>' +
      code({ fn: 'searcher.py', badge: 'con', raw:
'@behavior(name="searcher", on=["object.created"],\n' +
'          where={"object.type": "subquestion"})\n' +
'def searcher(event, graph, ctx):\n' +
'    sub  = event.payload["object"]\n' +
'    hits = ctx.call("web_search", query=sub["text"])   # logged + cached\n' +
'    for h in hits[:3]:\n' +
'        src = graph.add_object("source", {"url": h["url"], "title": h["title"],\n' +
'                                          "trust": h["trust"]})\n' +
'        graph.emit("source.fetched", {"source": src})' }) +
      '<p>Here is the same run, now showing the <strong style="color:var(--log)">event log</strong> beside the graph. Each search is a <code class="mono">tool.responded</code> event; open the raw JSON to see it.</p>' +
      '<div id="rsim_search"></div>' +
      note('key', 'the cache is the point', "The tool result is keyed by a hash of its arguments. Replay a run, or fork it, and identical searches return from cache — <strong>you never pay for the same web call twice</strong>. For a 40-source research run, that is the difference between iterating freely and burning your budget on re-runs.");
  },
};

const R4 = {
  id: 'research-extract',
  title: '4 · Extract claims with provenance',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 4 · extractor</div>' +
      '<h1 class="lh">Turn pages into claims — each wired to its source.</h1>' +
      '<p class="lead">This is where the scratchpad agent loses the plot: it reads a page and writes a paragraph, and the link from sentence to source evaporates. The <code class="mono">extractor</code> instead creates <code class="mono">claim</code> objects and a <code class="mono">sourced_from</code> edge to the exact page.</p>' +
      code({ fn: 'extractor.py', badge: 'run', raw:
'@llm_behavior(name="extractor", on=["source.fetched"], output_schema=Claims)\n' +
'def extractor(event, graph, ctx, llm_output: Claims):\n' +
'    src = event.payload["source"]\n' +
'    for c in llm_output.claims:\n' +
'        claim = graph.add_object("claim", {"text": c.text, "value": c.value,\n' +
'                                           "about": c.entity})\n' +
'        graph.add_relation(claim.id, src["id"], "sourced_from")   # provenance = an edge\n' +
'        graph.add_relation(claim.id, c.subquestion_id, "answers")' }) +
      '<p>The model call runs through <code class="mono">@llm_behavior</code>, so it’s validated against <code class="mono">output_schema</code>, logged, and cached like any tool. What lands in the graph is structured: a claim, its value, what it’s <em>about</em>, the source it came from, and the subquestion it answers.</p>' +
      '<div class="pull">Provenance isn’t metadata you bolt on. It’s an edge you create the moment the claim exists.</div>' +
      note('key', 'scoped views keep it cheap', "You can hand the extractor a <strong>scoped view</strong> of just the source it’s reading (<code class=\"mono\">view={\"object\": event.payload.source.id}</code>) instead of the whole growing transcript. Smaller prompts, lower cost, and the exact slice the model saw is recorded in the trace.");
  },
};

const R5 = {
  id: 'research-contradict',
  title: '5 · Cross-examine the sources',
  init() { runContradiction('contra1'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 5 · the differentiator</div>' +
      '<h1 class="lh">Make disagreement a fact, not a coin flip.</h1>' +
      '<p class="lead">Real research sources contradict each other. A ReAct scratchpad has no way to represent “these two facts conflict,” so the model quietly picks one and moves on. activegraph fires a behavior that records the conflict as an edge.</p>' +
      code({ fn: 'contradiction.py', badge: 'run', raw:
'@behavior(name="contradiction_check", on=["object.created"],\n' +
'          where={"object.type": "claim"},\n' +
'          pattern="(a:claim)-[:answers]->(s)<-[:answers]-(b:claim)")\n' +
'def contradiction_check(event, graph, ctx):\n' +
'    for a, s, b in ctx.matches:            # claims answering the same subquestion\n' +
'        if a["value"] != b["value"]:\n' +
'            graph.add_relation(a.id, b.id, "contradicts")\n' +
'            graph.emit("contradiction.found", {"a": a.id, "b": b.id, "subq": s.id})' }) +
      '<p>The <code class="mono">pattern</code> does the work: it fires only when two claims answer the same subquestion, and hands you the bound pair. Try it — two conflicting claims are in the graph; fire the behavior:</p>' +
      '<div id="contra1"></div>' +
      note('key', 'why this is the headline for research', "A research report that hides disagreement is worse than useless. Because the contradiction is now an <strong>object in the graph</strong>, the synthesizer can surface it (“sources disagree: 55–80%”) and you can <strong>fork</strong> the run to weight the sources differently. The scratchpad agent can do neither.");
  },
};

const R6 = {
  id: 'research-gaps',
  title: '6 · Close the gaps (the emergent loop)',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 6 · gap_detector</div>' +
      '<h1 class="lh">The loop isn’t written. It emerges.</h1>' +
      '<p class="lead">A ReAct agent loops on a hardcoded <code class="mono">while not done</code> with a step cap. Here, a <code class="mono">gap_detector</code> behavior keeps research going until every subquestion has support — and stops when the graph says coverage is complete.</p>' +
      code({ fn: 'gap_detector.py', badge: 'run', raw:
'@behavior(name="gap_detector", on=["object.created", "contradiction.found"])\n' +
'def gap_detector(event, graph, ctx):\n' +
'    for s in graph.objects(type="subquestion", where={"status": "open"}):\n' +
'        support = graph.relations(type="answers", target=s.id)\n' +
'        if not support:\n' +
'            graph.add_object("subquestion", {"text": s["text"], "status": "open"})  # search again\n' +
'        elif len(support) >= 2:\n' +
'            graph.patch_object(s.id, {"status": "answered"})' }) +
      tabs([
        { label: 'ReAct: a fixed loop', html: code({ fn: 'fixed.py', badge: 'con', raw:
'for step in range(MAX_STEPS):       # hope MAX_STEPS is enough\n' +
'    ...\n' +
'    if model_says_done:\n' +
'        break                       # the MODEL decides it is done\n' +
'# under-research if capped early; over-spend if capped late' }) },
        { label: 'activegraph: coverage-driven', html: code({ fn: 'emergent.py', badge: 'con', raw:
'# no loop counter. termination is a property of the graph:\n' +
'open_subqs = graph.objects(type="subquestion", where={"status": "open"})\n' +
'#   any open  -> a searcher is still firing\n' +
'#   none open -> run goes idle, synthesizer fires\n' +
'# the STATE decides done, and you can audit why.' }) },
      ]) +
      note('key', 'coordination through state', "No behavior calls another. The gap-detector emits subquestions; the searcher reacts to subquestions; the extractor reacts to sources; the gap-detector reacts to claims. The research expands and contracts on its own, and the event log records exactly why it kept going.");
  },
};

const R7 = {
  id: 'research-synthesize',
  title: '7 · Synthesize with citations',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> step 7 · synthesizer</div>' +
      '<h1 class="lh">Write the report from the graph — citations included.</h1>' +
      '<p class="lead">When no subquestions remain open, the run goes idle and the <code class="mono">synthesizer</code> fires. It reads the <em>claim graph</em> — not a transcript — so every sentence it writes can carry the source it came from.</p>' +
      code({ fn: 'synthesizer.py', badge: 'run', raw:
'@llm_behavior(name="synthesizer", on=["runtime.idle"], output_schema=Report)\n' +
'def synthesizer(event, graph, ctx, llm_output: Report):\n' +
'    # ctx hands the model a view of claims + their sources + contradictions\n' +
'    claims      = graph.objects(type="claim")\n' +
'    conflicts   = graph.relations(type="contradicts")\n' +
'    report = graph.add_object("report", {"markdown": llm_output.markdown})\n' +
'    for cite in llm_output.citations:           # each line keeps its lineage\n' +
'        graph.add_relation(report.id, cite.claim_id, "cites")' }) +
      '<p>Because the synthesizer sees the <code class="mono">contradicts</code> edges, it can’t pretend the sources agree. A faithful report reads: <em>“Adoption estimates range from ~55% (independent survey) to ~80% (vendor report); the figures conflict and the vendor source is lower-trust.”</em> Every clause is backed by a <code class="mono">cites</code> edge to a claim, which is backed by a <code class="mono">sourced_from</code> edge to a page.</p>' +
      note('key', 'contrast', "The ReAct synthesis was one sentence: “Adoption is ~80%.” Confident, unsourced, and wrong about the uncertainty. Same model, same searches — the difference is entirely in <strong>what state the synthesizer got to read</strong>.");
  },
};

const R8 = {
  id: 'research-provenance',
  title: 'Payoff · Provenance & audit',
  init() { runLineage('lin1'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> payoff · audit</div>' +
      '<h1 class="lh">"Where did this come from?" is now a graph walk.</h1>' +
      '<p class="lead">This is the question research agents are asked the moment anyone trusts the output — and the question a scratchpad agent cannot answer. In activegraph, every claim’s lineage is an explicit path through the log.</p>' +
      '<p>Tap a cited claim in the report and walk it back to its origin:</p>' +
      '<div id="lin1"></div>' +
      '<p>The chain is real, not reconstructed after the fact. Each step is an edge or a <code class="mono">caused_by</code> link that already exists in the graph: the report <code class="mono">cites</code> a claim, the claim is <code class="mono">sourced_from</code> a page, the page was created by a <code class="mono">tool.responded</code> event, which was <code class="mono">caused_by</code> the subquestion that triggered the search.</p>' +
      note('key', 'audit falls out', "You didn’t build an audit log. You built the agent on a log, and audit is what that log <em>is</em>. The same property lets you spot that a headline number rests on a single low-trust source — which is exactly what the next step lets you act on.");
  },
};

const R9 = {
  id: 'research-fork',
  title: 'Payoff · Fork the research',
  init() { runResearchFork('rfork1'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> payoff · the move a loop can’t make</div>' +
      '<h1 class="lh">Fork the conclusion. Don’t re-pay for the search.</h1>' +
      '<p class="lead">You’ve finished a research run and a reviewer asks: “what if we only trusted independent sources?” In a ReAct agent that means re-running everything — every search, every extraction, every token. Here it’s a fork.</p>' +
      code({ fn: 'fork_research.py', badge: 'run', raw:
'rt.run_goal("Is OSS AI adoption accelerating?")\n' +
'\n' +
'# branch at synthesis. e0..e6 (searches + extractions) replay from cache.\n' +
'fork = rt.fork(at_event=7)\n' +
'fork.set("source_trust_min", 0.6)     # drop the low-trust vendor report\n' +
'fork.run_until_idle()                 # only the synthesis re-derives\n' +
'\n' +
'rt.diff(fork)                         # what changed, and why' }) +
      '<p>Run it. Fork at synthesis, raise the trust threshold, and read the diff:</p>' +
      '<div id="rfork1"></div>' +
      '<p>The expensive prefix — the web searches and claim extractions — is reused from cache. Only the synthesis re-runs, under a stricter policy, and the conclusion changes in a way you can show your reviewer side by side. Both runs persist, both fully sourced.</p>' +
      note('key', 'what this unlocks', "“What if we used a better model / excluded this source / weighted recent pages higher?” becomes a cheap experiment instead of a full re-run. Research stops being a one-shot artifact and becomes something you can <strong>interrogate and revise</strong> — which is what research is supposed to be.");
  },
};

const R10 = {
  id: 'research-capstone',
  title: 'Capstone · The whole agent',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> capstone</div>' +
      '<h1 class="lh">The deep-research agent, in seven behaviors.</h1>' +
      '<p class="lead">No master loop. Seven small behaviors over a shared graph, wired entirely by events. Each one you already built:</p>' +
      code({ fn: 'deep_research.py', badge: 'run', raw:
'planner            on goal.created         -> question + subquestions\n' +
'searcher           on subquestion.created  -> @tool web_search -> sources\n' +
'extractor          on source.fetched       -> claims + sourced_from edges\n' +
'contradiction_check on claim.created        -> contradicts edges + flags\n' +
'gap_detector       on claim/contradiction   -> more subquestions, or "answered"\n' +
'synthesizer        on runtime.idle          -> cited report\n' +
'# tools: web_search, fetch  (logged, cached, replayable)' }) +
      '<p>Clone the repo and run a research agent end to end:</p>' +
      code({ fn: 'run.sh', badge: 'run', raw:
'git clone https://github.com/yoheinakajima/activegraph\n' +
'cd activegraph && pip install -e .\n' +
'export ANTHROPIC_API_KEY=...\n' +
'python examples/deep_research.py "Is open-source AI adoption accelerating?"\n' +
'\n' +
'activegraph inspect research.db      # walk every source, claim, contradiction\n' +
'activegraph diff research.db --run-a parent --run-b fork' }) +
      '<h2 class="lh">ReAct → activegraph, end to end</h2>' +
      maptable([
        ['scratchpad string', 'a research graph: questions, sources, claims'],
        ['summarized-away sources', 'claim --sourced_from--> source (provenance)'],
        ['model silently picks a number', 'contradicts edge + a surfaced conflict'],
        ['while not done / step cap', 'coverage-driven termination'],
        ['re-run = re-search', 'cached tools; fork without re-paying'],
        ['"trust me" output', 'tap any claim, walk it to the page'],
      ]) +
      '<h2 class="lh">When the loop is still fine</h2>' +
      '<p>If your “research” is a single search and a one-paragraph answer, a ReAct loop is the right amount of machinery. Reach for activegraph when the research is <strong>multi-source, contested, long-running, or has to be defended later</strong> — when someone will ask where a number came from, or what changes if you exclude a source.</p>' +
      '<div class="pull">Use activegraph when the research has to survive scrutiny after it finishes.</div>' +
      note('key', 'the same claim, restated', "Same model, same web search, same prompts. The only thing that changed is that the run’s state became an event-sourced graph instead of a buffer — and provenance, contradiction-handling, replay, and fork all fell out of that one decision.") +
      '<p style="margin-top:22px">Go deeper:</p>' +
      '<div class="home-foot" style="margin-top:10px;border:none;padding:0">' +
      '<a href="https://docs.activegraph.ai" target="_blank" rel="noopener">Docs →</a>' +
      '<a href="https://github.com/yoheinakajima/activegraph" target="_blank" rel="noopener">GitHub →</a>' +
      '<a href="https://arxiv.org/abs/2605.21997" target="_blank" rel="noopener">The Log is the Agent (paper) →</a>' +
      '<a href="https://pypi.org/project/activegraph/" target="_blank" rel="noopener">PyPI →</a>' +
      '</div>';
  },
};

export default {
  id: 'react-deep-research',
  title: 'The ReAct Deep-Research Agent',
  desc: 'Build the research agent everyone has built — reason, search, observe — then watch it change on activegraph: full provenance, surfaced contradictions, and a forkable conclusion.',
  difficulty: 'Intermediate',
  est: '~50 min',
  tags: ['research', 'web search', 'provenance'],
  status: 'available',
  parts: [
    { title: 'The familiar agent, and where it breaks', adv: false, lessons: [R0, R1] },
    { title: 'Build it, behavior by behavior', adv: false, lessons: [R2, R3, R4, R5, R6, R7] },
    { title: 'Why it was worth it', adv: true, lessons: [R8, R9, R10] },
  ],
};
