/* ============================================================================
   tutorial-loops.js — Tutorial 1: "From LLM Loops to Living Graphs".

   Each lesson is { id, title, html() -> string, init?() }. The optional init()
   runs after the lesson HTML is injected, to mount any interactive sim. The
   exported default is the tutorial descriptor consumed by content/index.js.
   ========================================================================== */
import { code, note, tabs, maptable, archDiagram } from '../ui.js';
import { runSim, runAnatomy, runFork } from '../sims.js';

/* ---------- PART A · the core refactor ------------------------------------ */
const A0 = {
  id: 'orientation',
  title: 'Most agents are a while-loop with amnesia',
  init() { runSim('sim_hero', 'log-graph'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> orientation</div>' +
      '<h1 class="lh">Most agents are a while-loop with amnesia.</h1>' +
      '<p class="lead">The dominant way to build an agent is a loop: call the model, parse the reply, run a tool, append to a list of messages, repeat. It works — until the run matters <em class="term">after</em> it finishes. Then you discover the state was never really there.</p>' +
      code({ fn: 'naive_agent.py', badge: 'con', raw:
'messages = [system_prompt]\n' +
'while not done:\n' +
'    reply  = llm(messages)            # think\n' +
'    action = parse(reply)             # hope the parse holds\n' +
'    result = run_tool(action)         # side effect, gone after this turn\n' +
'    messages.append(reply)\n' +
'    messages.append(result)           # "state" = a growing list of strings\n' +
'    if too_long(messages):\n' +
'        messages = truncate(messages) # <- the amnesia', mark: [8] }) +
      '<p>The control flow lives in Python. The "state" is an ever-growing transcript that you eventually have to truncate. When the run ends there is no durable record of <strong>what the system believed, why, or where any conclusion came from</strong>. You cannot replay it, fork it, or diff two versions of it.</p>' +
      '<div class="pull">World-state, not control-flow. The log is the source of truth; the graph is its projection.</div>' +
      '<p>activegraph keeps the same model, tools, and prompts — and moves the state somewhere durable. Below is one run shown two ways at once: the <strong style="color:var(--log)">append-only event log</strong> on the left, and the <strong style="color:var(--graph)">graph it projects into</strong> on the right. Step through it.</p>' +
      '<div id="sim_hero"></div>' +
      note('key', 'model', "The graph isn't a database you write to. It's a <strong>deterministic fold of the log</strong> — replay the same events and you get the same graph, every time. That single property is where replay, fork, diff, and lineage all come from.") +
      '<p>Over the next four short steps we’ll take the naive loop above and refactor it into that architecture — one substitution at a time, same agent, same task.</p>';
  },
};

const A1 = {
  id: 'sub-log',
  title: '1 · messages[] → an event log',
  init() { runSim('sim_naivelog', 'naive-log'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> substitution 1 of 4</div>' +
      '<h1 class="lh">Replace <span class="mono" style="font-size:.8em">messages[]</span> with an append-only log.</h1>' +
      '<p class="lead">First move: stop treating history as a list of chat strings you mutate and truncate. Treat every meaningful thing that happens as an <em class="term">event</em> appended to a log that is never edited.</p>' +
      code({ fn: 'event.py', badge: 'con', raw:
'# every state change is one immutable event\n' +
'{\n' +
'  "id":        "e7",\n' +
'  "type":      "object.created",\n' +
'  "payload":   {"object": {"type": "claim", "text": "TAM ~$4B"}},\n' +
'  "actor":     "behavior:market_research",\n' +
'  "caused_by": "e6",          # the event that triggered this one\n' +
'  "ts":        "2026-06-03T17:04:55Z"\n' +
'}' }) +
      '<p>An event carries its <strong>type</strong>, its <strong>payload</strong>, who did it (<strong>actor</strong>), and what caused it (<strong>caused_by</strong>). That <code class="mono">caused_by</code> link is what turns a flat log into a causal chain — the backbone of lineage later.</p>' +
      '<p>Here is the same run from the previous page, but now contrasting the naive transcript with the log. Watch what happens around step 7.</p>' +
      '<div id="sim_naivelog"></div>' +
      note('warn', 'watch', "The naive side eventually <strong>drops earlier turns</strong> to fit the context window — the agent literally forgets what it concluded. The log only ever grows. Nothing is lost, because nothing is overwritten.") +
      '<p>That’s the whole first substitution. We haven’t changed the model or the tools — only where truth lives. Everything else in this tutorial is derived from this one decision.</p>';
  },
};

const A2 = {
  id: 'sub-graph',
  title: '2 · parsed text → a typed graph',
  init() { runSim('sim_proj', 'log-graph'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> substitution 2 of 4</div>' +
      '<h1 class="lh">Replace parsed strings with a typed graph.</h1>' +
      '<p class="lead">A log is auditable but hard to reason over directly. So we <em class="term">project</em> it into a live graph: typed <em class="term">objects</em> (nodes) connected by typed <em class="term">relations</em> (edges). The agent reads the graph; it never edits it.</p>' +
      code({ fn: 'projection.py', badge: 'con', raw:
'# you never set fields directly — you emit events, the graph folds them\n' +
'research = graph.add_object("task",  {"title": "Research", "status": "open"})\n' +
'memo     = graph.add_object("task",  {"title": "Draft memo", "status": "blocked"})\n' +
'graph.add_relation(research.id, memo.id, "depends_on")\n' +
'\n' +
'# reads are queries over the projected world\n' +
'open_tasks = graph.objects(type="task", where={"status": "open"})\n' +
'blockers   = graph.relations(type="depends_on", target=memo.id)' }) +
      '<p>An edge is not just a pointer. A <code class="mono">depends_on</code>, <code class="mono">supports</code>, or <code class="mono">contradicts</code> relation is a <strong>typed fact about the world</strong> — and, as we’ll see, it can carry behavior. The graph holds beliefs, evidence, decisions, and their dependencies, not a sequence of steps.</p>' +
      '<div id="sim_proj"></div>' +
      '<p>The right pane is never written to directly. Each node and edge appears because an event was appended on the left and the projection folded it in. Open the raw JSON under the sim — that array <em>is</em> the agent’s memory.</p>' +
      note('key', 'why it matters', "Because the graph is a pure function of the log, two people who replay the same log see the same graph. State becomes <strong>inspectable infrastructure</strong> instead of a private variable inside a loop.");
  },
};

const A3 = {
  id: 'sub-behaviors',
  title: '3 · the master loop → behaviors',
  init() { runAnatomy('anat1'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> substitution 3 of 4</div>' +
      '<h1 class="lh">Replace the master loop with behaviors.</h1>' +
      '<p class="lead">Now delete the <code class="mono">while</code> loop. Instead of one orchestrator deciding what runs next, small reactive units called <em class="term">behaviors</em> subscribe to events and write back to the graph. The loop becomes event propagation.</p>' +
      '<div class="pull">A behavior reacts. It does not decide.</div>' +
      code({ fn: 'behaviors.py', badge: 'run', raw:
'@behavior(name="planner", on=["goal.created"])\n' +
'def planner(event, graph, ctx):\n' +
'    research = graph.add_object("task", {"title": "Research", "status": "open"})\n' +
'    memo     = graph.add_object("task", {"title": "Draft memo", "status": "blocked"})\n' +
'    graph.add_relation(research.id, memo.id, "depends_on")\n' +
'\n' +
'# the differentiated primitive: logic lives ON the edge, where the meaning is\n' +
'@relation_behavior(name="unblock", relation_type="depends_on", on=["task.completed"])\n' +
'def unblock(relation, event, graph, ctx):\n' +
'    if event.payload["task_id"] == relation.source:\n' +
'        graph.patch_object(relation.target, {"status": "open"})' }) +
      '<p>The <code class="mono">planner</code> fires when a goal arrives. The <code class="mono">unblock</code> behavior lives on the <code class="mono">depends_on</code> edge itself — when the source task completes, it unblocks the target. Coordination happens through shared state, not a brittle chain of direct calls. That edge-resident logic is the primitive a plain loop can’t give you.</p>' +
      '<h3 class="lh">Anatomy of a behavior</h3>' +
      '<p>A behavior is fully declared by <em>what it listens to</em> and <em>what it matches</em>. Tap each argument:</p>' +
      '<div id="anat1"></div>' +
      tabs([
        { label: 'the old way', html: code({ fn: 'orchestrator.py', badge: 'con', raw:
'while not done:\n' +
'    state = decide_next(state)   # one brain holds everything\n' +
'    if state.needs_research:\n' +
'        state = research(state)\n' +
'    elif state.needs_memo:\n' +
'        state = write_memo(state)\n' +
'    # add a step? touch this loop. order is hardcoded here.' }) },
        { label: 'with behaviors', html: code({ fn: 'reactive.py', badge: 'con', raw:
'# no central brain. each unit minds its own trigger.\n' +
'@behavior(on=["goal.created"])      # -> creates tasks\n' +
'@behavior(on=["task.created"])      # -> researches\n' +
'@behavior(on=["research.done"])     # -> drafts memo\n' +
'# add a step? add a behavior. nothing else changes.' }) },
      ]) +
      note('key', 'the shift', "In the loop, <strong>you</strong> sequence the work. With behaviors, the <strong>event log</strong> is the sequence and the graph is the state. Adding capability means adding a subscriber, not editing a growing master function.");
  },
};

const A4 = {
  id: 'sub-replay',
  title: '4 · persist & replay',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> substitution 4 of 4</div>' +
      '<h1 class="lh">Persist the log. Replay the run.</h1>' +
      '<p class="lead">The payoff of the first three substitutions: because the run <em>is</em> its log, persisting that log makes the entire run reproducible. Same events in, same graph out.</p>' +
      code({ fn: 'replay.py', badge: 'con', raw:
'rt = Runtime(graph, budget={"max_events": 200, "max_seconds": 60},\n' +
'             persist_to="acme.db")\n' +
'rt.run_goal("Evaluate Acme")\n' +
'rt.print_trace()                 # every mutation, in causal order\n' +
'\n' +
'# later, on another machine, from nothing but the log:\n' +
'rt2 = Runtime.load("acme.db", run_id=rt.run_id)\n' +
'rt2.run_until_idle()             # re-derives the identical graph' }) +
      '<p>Replay is not a feature bolted on top — it falls out of the architecture. There is no separate "save state" step that can drift from reality, because the state was always just the fold of the events.</p>' +
      note('warn', 'the determinism contract', "Replay only holds if behavior bodies are pure. Keep <code class=\"mono\">random()</code>, <code class=\"mono\">datetime.now()</code>, and raw network calls <strong>out</strong> of behaviors — reach the outside world through <code class=\"mono\">@tool</code> and the model through <code class=\"mono\">@llm_behavior</code>, both of which are logged and cached. Then the same log always rebuilds the same world.") +
      '<p>That same persisted log is what makes <strong>fork</strong> and <strong>diff</strong> possible — covered in the advanced track. First, let’s consolidate the core model.</p>';
  },
};

const A5 = {
  id: 'core-recap',
  title: 'The core model, and when to use it',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> core recap</div>' +
      '<h1 class="lh">You now have the whole core model.</h1>' +
      '<p class="lead">Four substitutions turned a while-loop with amnesia into a persistent, inspectable world. Here is the architecture in one picture:</p>' +
      archDiagram() +
      '<p>And here is the full refactor, side by side — every piece of the naive agent and what it became:</p>' +
      maptable([
        ['messages = [ ... ]', 'an append-only event log'],
        ['parse(reply) -> dict', 'typed objects + typed relations'],
        ['while not done:', 'behaviors that react to events'],
        ['truncate(messages)', 'nothing dropped — replay the log'],
        ['try / except around calls', 'behavior.failed events (a fact, not a crash)'],
        ['print() for debugging', 'a queryable trace + end-to-end lineage'],
        ['re-run from scratch', 'replay / fork / diff any run'],
      ]) +
      '<h2 class="lh">When <em>not</em> to use activegraph</h2>' +
      '<p>This architecture earns its keep when runs are long-lived and consequential. If they aren’t, the loop is fine. Reach for activegraph <strong>only</strong> when several of these are true:</p>' +
      '<p style="margin-bottom:8px">It’s probably overkill for:</p>' +
      '<div class="maptable"><div class="maprow"><div class="from" style="background:none">one-shot scripts &amp; simple chatbots</div><div class="arr" style="color:var(--ghost)">·</div><div class="to" style="background:none;color:var(--dim)">no run to revisit</div></div>' +
      '<div class="maprow"><div class="from" style="background:none">stateless tool wrappers</div><div class="arr" style="color:var(--ghost)">·</div><div class="to" style="background:none;color:var(--dim)">nothing accumulates</div></div>' +
      '<div class="maprow"><div class="from" style="background:none">small linear workflows</div><div class="arr" style="color:var(--ghost)">·</div><div class="to" style="background:none;color:var(--dim)">replay/fork/audit don’t pay off</div></div></div>' +
      '<div class="pull">Use activegraph when the run matters after it finishes.</div>' +
      '<h2 class="lh">How this differs from workflow graphs</h2>' +
      '<p>If you’ve used LangGraph or similar DAG runners, the word "graph" can mislead. The difference is what the nodes and edges <em>mean</em>:</p>' +
      maptable([
        ['workflow graph: node = a step', 'activegraph: node = a fact / entity'],
        ['workflow graph: edge = "go next"', 'activegraph: edge = a relationship in the world'],
        ['the graph is the control flow', 'the graph is the state; events are the flow'],
        ['nodes are boxes you route through', 'behaviors sit beside the graph and react'],
      ]) +
      note('key', 'one line', "A workflow graph encodes <strong>what should happen next</strong>. An active graph encodes <strong>what is true so far</strong>. Bring your workflow if you have one — activegraph is the world it acts on, not a replacement for it.") +
      '<p>That’s the core. The advanced track shows what the substrate unlocks: replayable model/tool calls, failure-as-events, and forking a run to ask "what if?"</p>';
  },
};

/* ---------- PART B · the advanced payoff ---------------------------------- */
const B1 = {
  id: 'llm-tools',
  title: 'Replayable model & tool calls',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> advanced · payoff</div>' +
      '<h1 class="lh">Make every model and tool call replayable.</h1>' +
      '<p class="lead">A behavior that calls a model or hits the network would break determinism — unless those calls are themselves events. Two specialized behaviors handle that: <code class="mono">@llm_behavior</code> and <code class="mono">@tool</code>.</p>' +
      code({ fn: 'examples/babyagi.py', badge: 'run', raw:
'@llm_behavior(name="executor", on=["object.created"],\n' +
'              where={"object.type": "task"}, output_schema=TaskResult)\n' +
'def executor(event, graph, ctx, llm_output: TaskResult):\n' +
'    task = event.payload["object"]\n' +
'    graph.patch_object(task["id"], {"status": "completed"})\n' +
'    graph.emit("task.executed", {"task_id": task["id"],\n' +
'                                 "result": llm_output.result})' }) +
      '<p>The runtime makes the model call, validates it against <code class="mono">output_schema</code>, logs the request/response as a pair, and hands your function the typed result. The request is keyed by a hash of its prompt — so on replay (or in a fork that shares the prefix) the same call returns from cache and is <strong>never re-charged</strong>.</p>' +
      '<h3 class="lh">Tools: side effects, isolated</h3>' +
      code({ fn: 'tools.py', badge: 'con', raw:
'@tool(name="fetch_report")\n' +
'def fetch_report(url: str) -> dict:\n' +
'    # the ONE place a raw network call is allowed\n' +
'    return {"bytes": http_get(url)}\n' +
'\n' +
'# behaviors stay pure; they request the tool, the runtime logs the result' }) +
      note('key', 'scoped views & cost', "You can hand a behavior a <strong>scoped view</strong> of the graph (<code class=\"mono\">view={\"around\": event.payload.object.id, \"depth\": 1}</code>) so the model only sees the neighborhood it needs. Smaller prompts, lower cost, and the slice is recorded in the trace.");
  },
};

const B2 = {
  id: 'failure',
  title: 'Failure as events',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> advanced · resilience</div>' +
      '<h1 class="lh">A failure is a fact, not a crash.</h1>' +
      '<p class="lead">In a loop, an exception unwinds the stack and the run dies. In activegraph, a failing behavior emits a <code class="mono">behavior.failed</code> event with a reason code — the log records it, the run continues, and other behaviors can react to it.</p>' +
      tabs([
        { label: 'loop: exception', html: code({ fn: 'fragile.py', badge: 'con', raw:
'try:\n' +
'    result = run_tool(action)\n' +
'except TimeoutError:\n' +
'    # now what? retry here? bubble up? the whole run is at risk,\n' +
'    # and the failure leaves no durable trace once handled.\n' +
'    raise' }) },
        { label: 'activegraph: event', html: code({ fn: 'durable.py', badge: 'con', raw:
'# the runtime catches it FOR you and appends:\n' +
'{\n' +
'  "type": "behavior.failed",\n' +
'  "payload": {"behavior": "fetch_report",\n' +
'              "reason": "tool.timeout"},\n' +
'  "caused_by": "e6"\n' +
'}\n' +
'# the run keeps going. the failure is now queryable history.' }) },
      ]) +
      '<p>Because the failure is just another event, recovery is just another behavior:</p>' +
      code({ fn: 'retry.py', badge: 'con', raw:
'@behavior(name="retry", on=["behavior.failed"],\n' +
'          where={"reason": "tool.timeout"})\n' +
'def retry(event, graph, ctx):\n' +
'    if event.payload.get("attempt", 0) < 3:\n' +
'        graph.emit("retry.requested", {"target": event.payload["behavior"]})' }) +
      note('key', 'what you get', "Every failure mode is in the trace with a reason code, so you can replay a run and see exactly where and why it degraded — and forking lets you test a fix against the <strong>same</strong> failure conditions.");
  },
};

const B3 = {
  id: 'fork-diff',
  title: 'Fork & diff a run',
  init() { runFork('fork1'); },
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> advanced · the headline</div>' +
      '<h1 class="lh">Fork a run. Diff what changed.</h1>' +
      '<p class="lead">This is the move a loop simply cannot make. Because a run is its log, you can branch it at any historical event, change one thing, and re-derive only the tail — then compare the two worlds.</p>' +
      code({ fn: 'fork.py', badge: 'run', raw:
'rt.run_goal("Evaluate Acme")\n' +
'\n' +
'# branch at event 4. the shared prefix replays from cache —\n' +
'# forks don\'t re-pay for LLM calls already made.\n' +
'fork = rt.fork(at_event=4)\n' +
'fork.set("risk_weight", 0.6)        # the one thing we change\n' +
'fork.run_until_idle()' }) +
      '<p>Drive it yourself. Fork the run at event 4 and watch the prefix get reused while the tail re-derives under a new setting — then read the diff:</p>' +
      '<div id="fork1"></div>' +
      '<p>From the CLI the same comparison is <code class="mono">activegraph diff acme.db --run-a parent --run-b fork</code>, which reports exactly which objects and relations diverged.</p>' +
      note('key', 'why this is the headline', "“What if we changed the threshold, the prompt, the model, or the approval rule?” becomes a cheap, side-effect-free experiment instead of a full re-run. The original is never destroyed — both worlds persist, fully explained.");
  },
};

const B4 = {
  id: 'approvals-packs',
  title: 'Approvals, packs & the CLI',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> advanced · operating</div>' +
      '<h1 class="lh">Human gates, reusable packs, external inspection.</h1>' +
      '<p class="lead">Three things you get once state is an event log, in brief.</p>' +
      '<h3 class="lh">Approvals are events too</h3>' +
      '<p>A behavior can <code class="mono">propose</code> an action that waits for sign-off. The proposal and the grant are both events (<code class="mono">approval.proposed</code> → <code class="mono">approval.granted</code>), so a human-in-the-loop gate is fully recorded in the same trace as everything else — who approved what, and when.</p>' +
      '<h3 class="lh">Packs bundle behaviors</h3>' +
      '<p>A <em class="term">pack</em> is a reusable set of behaviors + object types for a domain. Loading one emits a <code class="mono">pack.loaded</code> event; the bundled Diligence pack, for instance, ships the behaviors for an investment workflow. Packs are how you reuse a working agent instead of rebuilding the wiring.</p>' +
      '<h3 class="lh">The log is inspectable from outside</h3>' +
      code({ fn: 'cli.sh', badge: 'run', raw:
'activegraph quickstart            # deterministic demo, no API key needed\n' +
'activegraph inspect acme.db       # walk the event log of a saved run\n' +
'activegraph diff acme.db \\\n' +
'    --run-a parent --run-b fork   # structured diff of two runs' }) +
      note('key', 'the through-line', "Approvals, packs, and CLI inspection aren’t separate subsystems. They’re all just <strong>reading and writing the same log</strong> — which is why they compose cleanly.");
  },
};

const B5 = {
  id: 'capstone',
  title: 'Capstone · BabyAGI as an active graph',
  html() {
    return '' +
      '<div class="eyebrow"><span class="sl">//</span> capstone</div>' +
      '<h1 class="lh">Put it together: BabyAGI, rewritten.</h1>' +
      '<p class="lead">The original BabyAGI (Nakajima, 2023) was a while-true loop with three steps and state in a global list. Here it is as three behaviors over a shared graph. The loop <em>is</em> event propagation; the graph <em>is</em> the state.</p>' +
      code({ fn: 'examples/babyagi.py', badge: 'run', raw:
'@behavior(name="initializer", on=["goal.created"])\n' +
'def initializer(event, graph, ctx):\n' +
'    goal = event.payload["goal"]\n' +
'    graph.add_object("task", {"title": f"Plan first step toward: {goal}",\n' +
'                              "status": "pending"})\n' +
'\n' +
'@llm_behavior(name="executor", on=["object.created"],\n' +
'              where={"object.type": "task"}, output_schema=TaskResult)\n' +
'def executor(event, graph, ctx, llm_output: TaskResult):\n' +
'    task = event.payload["object"]\n' +
'    graph.patch_object(task["id"], {"status": "completed"})\n' +
'    graph.emit("task.executed", {"task_id": task["id"],\n' +
'                                 "result": llm_output.result})\n' +
'\n' +
'@llm_behavior(name="task_creator", on=["task.executed"],\n' +
'              output_schema=NewTasks)\n' +
'def task_creator(event, graph, ctx, llm_output: NewTasks):\n' +
'    for title in llm_output.tasks:\n' +
'        graph.add_object("task", {"title": title, "status": "pending"})' }) +
      '<p>Three behaviors. The graph queues itself; the event log is the order; an empty follow-up list terminates the loop. Clone and run it:</p>' +
      code({ fn: 'run.sh', badge: 'run', raw:
'git clone https://github.com/yoheinakajima/activegraph\n' +
'cd activegraph && pip install -e .\n' +
'export ANTHROPIC_API_KEY=...\n' +
'python examples/babyagi.py "Plan a 3-day intro to Rust"' }) +
      '<h2 class="lh">What you built</h2>' +
      maptable([
        ['a transcript you truncate', 'a log you replay'],
        ['state inside a loop', 'a graph anyone can inspect'],
        ['one orchestrator', 'behaviors that react'],
        ['a crash on error', 'a behavior.failed fact'],
        ['one disposable run', 'fork + diff any run'],
      ]) +
      note('key', 'the claim, restated', "The event log should not be a debugging artifact. It should be the substrate the agent is built from — and replay, fork, diff, and lineage fall out of that, not from an audit layer bolted on top. That’s <strong>The Log is the Agent</strong>.") +
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
  id: 'llm-loops-to-living-graphs',
  title: 'From LLM Loops to Living Graphs',
  desc: 'Take the familiar LLM agent loop, see exactly why it breaks, then refactor it into activegraph one substitution at a time. The core mental model, end to end.',
  difficulty: 'Beginner → Intermediate',
  est: '~45 min',
  tags: ['mental model', 'refactor', 'start here'],
  status: 'available',
  parts: [
    { title: 'Core model · the refactor', adv: false, lessons: [A0, A1, A2, A3, A4, A5] },
    { title: 'Advanced payoff', adv: true, lessons: [B1, B2, B3, B4, B5] },
  ],
};
