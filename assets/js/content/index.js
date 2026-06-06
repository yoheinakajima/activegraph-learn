/* ============================================================================
   content/index.js — the tutorial registry. Available tutorials are imported
   as modules; "coming soon" placeholders are declared inline (empty parts).

   To add a tutorial: create content/tutorial-<name>.js exporting the same
   descriptor shape, import it here, and drop it into the TUTORIES array.
   ========================================================================== */
import loops from './tutorial-loops.js';
import research from './tutorial-research.js';

export const TUTORIALS = [
  loops,
  research,
  {
    id: 'operating-memory',
    title: 'Operating Memory',
    desc: 'Durable beliefs, evidence, and contradictions versus a summary of past chat. How the graph becomes long-running memory an agent reasons over — not just recalls.',
    difficulty: 'Intermediate', est: '~30 min', tags: ['memory', 'beliefs', 'lineage'], status: 'soon', parts: [],
  },
  {
    id: 'core-packs',
    title: 'Building & Composing Packs',
    desc: 'Bundle behaviors and object types into reusable packs. Load them, compose them, and ship a working agent instead of rewiring one each time.',
    difficulty: 'Intermediate', est: '~30 min', tags: ['packs', 'reuse', 'architecture'], status: 'soon', parts: [],
  },
  {
    id: 'diligence-pack',
    title: 'The Diligence Pack',
    desc: 'An end-to-end investment workflow on activegraph: tasks, memos, approvals, and a forkable decision you can re-run under different assumptions.',
    difficulty: 'Advanced', est: '~40 min', tags: ['diligence', 'approvals', 'fork/diff'], status: 'soon', parts: [],
  },
];

/* flatten a tutorial's parts into an ordered list of lessons */
export function flat(t) {
  const a = [];
  t.parts.forEach((p) => p.lessons.forEach((l) => a.push(l)));
  return a;
}

export function tutorialById(id) {
  return TUTORIALS.filter((t) => t.id === id)[0];
}
