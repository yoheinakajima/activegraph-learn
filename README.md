# activegraph / learn

The interactive learning site for [**activegraph**](https://github.com/yoheinakajima/activegraph) —
the event-sourced reactive graph runtime for long-running, auditable agents.

It is the third surface in the activegraph family:

| Site | Purpose |
| --- | --- |
| [activegraph.ai](https://activegraph.ai) | Marketing / the pitch |
| [docs.activegraph.ai](https://docs.activegraph.ai) | Reference — concepts, API, CLI, cookbook |
| **learn.activegraph.ai** (this repo) | **Teaching** — hands-on, interactive tutorials |

Where the docs are a *reference you look things up in*, `learn` is a *path you walk
through*. Each tutorial takes an agent pattern you already know (the LLM `while`
loop, a ReAct research agent) and refactors it into activegraph one substitution at
a time, with **interactive simulations** you can step through inline — an event log
filling up, a graph projecting from it, a run being forked and diffed.

---

## Why it's built this way

This is a **static, zero-build, zero-dependency single-page app**. That's a
deliberate choice:

- **It deploys anywhere.** GitHub Pages, Netlify, S3, a USB stick — it's just files.
- **It can't rot.** No npm tree to keep patched, no framework major-version to chase.
  In five years `index.html` still opens.
- **It's hackable.** Adding a tutorial is writing one plain JavaScript file. No build
  step, no bundler config, no transpile.

The original draft was a single 1,500-line HTML file with all CSS, JS, and content
inlined. This repo keeps the exact same runtime behavior and visual design, but
splits it into small, single-responsibility [ES modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
so that content, UI primitives, interactive widgets, and app plumbing are each
editable in isolation — and so a new tutorial never requires touching the engine.

---

## Architecture

The app is a hash-routed SPA. There is no server and no API — every "page" is
rendered client-side from JavaScript data into one of three top-level containers
defined in `index.html` (`#home`, `#shell`, the glossary panel).

```
Route                       Renders
  #/                    →   home.js          (tutorial cards)
  #/t/<tutorial>        →   redirect to first lesson
  #/t/<tutorial>/<id>   →   lesson.js        (sidebar + lesson body + pager)
```

### Data flow

```
                    content/index.js  ── the registry: which tutorials exist
                          │
        ┌─────────────────┴──────────────────┐
   tutorial-loops.js                  tutorial-research.js     ← CONTENT
   (lessons: title + html() + init?)  (lessons …)
        │                                    │
        │ each lesson's html() is built from │
        ▼                                    ▼
      ui.js  ── code() · note() · tabs() · maptable() · archDiagram()   ← PRESENTATION
        │
      sims.js / sims-research.js  ── runSim() · runFork() · runLineage() …  ← INTERACTIVE WIDGETS
        │
      util.js  ── esc() · hlLine() (syntax highlighter) · timer registry     ← PRIMITIVES

      app.js   ── router · keyboard · glossary · tab delegation  ← APP SHELL
      lesson.js / home.js ── view renderers
      store.js ── progress persistence (localStorage + in-memory fallback)
      glossary.js ── the slide-in vocabulary panel
```

A **lesson** is just an object:

```js
const A0 = {
  id: 'orientation',                 // stable URL slug
  title: 'Most agents are a while-loop with amnesia',
  init() { runSim('sim_hero', 'log-graph'); },   // optional: mount an interactive widget
  html() { return '<h1 class="lh">…</h1>' + code({…}) + note('key', …); },
};
```

`html()` returns a markup string (built with the helpers in `ui.js`); `init()` runs
*after* that markup is in the DOM and is where interactive widgets attach themselves
to placeholder `<div id="…">`s.

A **tutorial** groups lessons into parts and carries the card metadata:

```js
export default {
  id: 'llm-loops-to-living-graphs',
  title: 'From LLM Loops to Living Graphs',
  desc: '…', difficulty: '…', est: '~45 min', tags: ['…'],
  status: 'available',             // or 'soon' for a placeholder card
  parts: [
    { title: 'Core model · the refactor', adv: false, lessons: [A0, A1, …] },
    { title: 'Advanced payoff',           adv: true,  lessons: [B1, B2, …] },
  ],
};
```

### File map

```
.
├── index.html                       # shell: topbar, containers, font + CSS links, module entry
├── .nojekyll                        # tell GitHub Pages to serve files as-is
├── assets/
│   ├── css/
│   │   └── styles.css               # all styles (design tokens in :root)
│   └── js/
│       ├── app.js                   # entry point: router, keybindings, glossary/tab wiring
│       ├── util.js                  # esc, syntax highlighter, uid, timer registry
│       ├── store.js                 # localStorage shim + lesson-progress tracking
│       ├── glossary.js              # glossary data + slide-in panel
│       ├── ui.js                    # HTML-string builders (code/note/tabs/maptable/arch)
│       ├── sims.js                  # interactive widgets for Tutorial 1 (+ shared renderers)
│       ├── sims-research.js         # interactive widgets for Tutorial 2
│       ├── home.js                  # landing page (hero + cards)
│       ├── lesson.js                # sidebar + lesson body + pager
│       └── content/
│           ├── index.js             # the tutorial registry  ← add new tutorials here
│           ├── tutorial-loops.js    # Tutorial 1: From LLM Loops to Living Graphs
│           └── tutorial-research.js # Tutorial 2: The ReAct Deep-Research Agent
├── LICENSE
└── README.md
```

### Conventions worth knowing

- **No innerHTML from untrusted input.** Everything rendered is authored in this
  repo; `esc()` is still used on dynamic text out of habit and to keep it safe if
  content ever becomes data-driven.
- **Timers are registered.** Any `setInterval` in a sim goes through
  `registerTimer()` so the router can `clearTimers()` on navigation — no animations
  leak across pages.
- **Progress is best-effort.** `store.js` uses `localStorage` when available and a
  module-level object otherwise, so the site works inside sandboxed iframes.
- **The glossary is the vocabulary contract.** Keep `glossary.js` aligned with
  activegraph's core nouns as the framework evolves.

---

## Running locally

ES modules are fetched over HTTP, so you can't just double-click `index.html`
(`file://` blocks module loading). Serve the folder with any static server:

```bash
# Python (already on most machines)
python3 -m http.server 8000

# …or Node
npx serve .

# then open http://localhost:8000
```

There is no build step and nothing to install.

---

## Deploying to GitHub Pages

The site is plain static files at the repo root, so Pages needs no configuration
beyond being switched on.

### Option A — deploy from a branch (simplest)

1. Push this repo to GitHub.
2. **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select branch `main` (or your default) and folder **`/ (root)`**. Save.
5. Wait ~1 minute; your site is live at
   `https://<user>.github.io/<repo>/`.

The `.nojekyll` file is already included so GitHub serves `assets/` verbatim
instead of running it through Jekyll.

### Option B — deploy with GitHub Actions

If you prefer the Actions-based flow, set **Source** to **GitHub Actions** and add
`.github/workflows/pages.yml`:

```yaml
name: Deploy Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .                 # upload the repo root as-is
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Pointing `learn.activegraph.ai` at it

1. In your DNS, add a `CNAME` record for `learn` → `<user>.github.io`.
2. In **Settings → Pages → Custom domain**, enter `learn.activegraph.ai` and save.
   GitHub will write a `CNAME` file to the repo and provision HTTPS.

> **Note on paths:** all asset references in `index.html` and all `import`
> statements are **relative** (`assets/js/app.js`, `./util.js`), so the site works
> whether it's served from a custom domain root (`learn.activegraph.ai/`) or a
> project subpath (`<user>.github.io/<repo>/`). No base-href juggling required.

---

## Adding content

### A new lesson

Open the relevant `content/tutorial-*.js`, add a lesson object, and list it in the
tutorial's `parts`:

```js
const A6 = {
  id: 'my-new-lesson',
  title: 'My new lesson',
  html() {
    return '<div class="eyebrow"><span class="sl">//</span> section</div>' +
      '<h1 class="lh">Headline</h1>' +
      '<p class="lead">…</p>' +
      code({ fn: 'example.py', badge: 'run', raw: 'print("hello")' }) +
      note('key', 'takeaway', 'The one thing to remember.');
  },
};
// …then add A6 to a part's `lessons: [...]` array.
```

Available building blocks from `ui.js`:

| Helper | Renders |
| --- | --- |
| `code({fn, badge, raw, mark})` | a syntax-highlighted code block (`badge`: `'run'`/`'con'`; `mark`: `[lineNos]`) |
| `note(kind, label, html)` | a callout (`kind`: `'key'`/`'warn'`/`'stop'`) |
| `tabs([{label, html}, …])` | a tab group |
| `maptable([[from, to], …])` | a "naive → activegraph" comparison table |
| `archDiagram()` | the goal → log → graph → behaviors → events diagram |

For an interactive widget, render a placeholder `<div id="my_sim"></div>` in `html()`
and mount it in `init()` (see `sims.js` for the existing runners).

### A new tutorial

1. Create `content/tutorial-<name>.js` with `export default { id, title, desc,
   difficulty, est, tags, status: 'available', parts: [...] }`.
2. Import it in `content/index.js` and add it to the `TUTORIALS` array.

A tutorial with `status: 'soon'` and `parts: []` renders an inert "coming soon" card
— three are already stubbed (Operating Memory, Packs, the Diligence Pack).

---

## A note on the code samples

The Python snippets in the tutorials are **teaching pseudocode** — faithful to
activegraph's model and API shape, tuned for clarity rather than copy-paste. The
event-type names (`goal.created`, `object.created`, `llm.responded`,
`tool.responded`, `behavior.failed`, `runtime.idle`, …) match the runtime's emitted
types. For exact, runnable APIs always defer to
[docs.activegraph.ai](https://docs.activegraph.ai) and the
[`examples/`](https://github.com/yoheinakajima/activegraph/tree/main/examples)
directory in the main repo.

---

## License

Apache-2.0 — see [LICENSE](LICENSE).
