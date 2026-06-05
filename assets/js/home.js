/* ============================================================================
   home.js — the landing page: hero + tutorial cards. Cards route to a
   tutorial via the hash; "soon" cards are inert.
   ========================================================================== */
import { esc } from './util.js';
import { TUTORIALS, flat } from './content/index.js';

export function renderHome() {
  const hero = '<div class="home-hero">' +
    '<div class="eyebrow"><span class="sl">//</span> activegraph / learn</div>' +
    '<h1>From LLM loops<br>to <span class="hl">living graphs</span>.</h1>' +
    '<p class="lead">Interactive tutorials for activegraph — the persistent world for long-running agents. Start with the mental model, then build. Same model, tools, and prompts; durable, replayable state underneath.</p>' +
    '<div class="quotes">' +
    '<span class="qchip">Most agents are <b>a while-loop with amnesia</b>.</span>' +
    '<span class="qchip">The log is the source of truth; the graph is its <b>projection</b>.</span>' +
    '<span class="qchip">A behavior <b>reacts</b>. It does not decide.</span>' +
    '</div></div>';

  const cards = TUTORIALS.map((t, i) => {
    const avail = t.status === 'available';
    const tags = t.tags.map((x) => '<span class="tg">' + esc(x) + '</span>').join('');
    const lessons = avail ? flat(t).length : 0;
    const foot = avail
      ? '<span>' + lessons + ' lessons</span><span class="diff">' + esc(t.difficulty) + '</span><span class="start">Start →</span>'
      : '<span>' + esc(t.difficulty) + '</span><span class="start" style="color:var(--faint)">soon</span>';
    return '<div class="card' + (avail ? '' : ' soon') + '" data-tid="' + t.id + '" data-avail="' + avail + '">' +
      (avail ? '' : '<div class="ribbon">soon</div>') +
      '<div class="num">' + (i < 9 ? '0' : '') + (i + 1) + '</div>' +
      '<h3>' + esc(t.title) + '</h3><p>' + esc(t.desc) + '</p>' +
      '<div class="tags">' + tags + '</div>' +
      '<div class="foot">' + (avail ? '<span>' + t.est + '</span>' : '') + foot + '</div></div>';
  }).join('');

  const foot = '<div class="home-foot">' +
    '<a href="https://activegraph.ai" target="_blank" rel="noopener">activegraph.ai</a>' +
    '<a href="https://docs.activegraph.ai" target="_blank" rel="noopener">Docs</a>' +
    '<a href="https://arxiv.org/abs/2605.21997" target="_blank" rel="noopener">Paper</a>' +
    '<a href="https://github.com/yoheinakajima/activegraph" target="_blank" rel="noopener">GitHub</a>' +
    '<span style="margin-left:auto;color:var(--ghost)">© 2026 activegraph · Apache-2.0</span></div>';

  const home = document.getElementById('home');
  home.innerHTML = hero +
    '<div class="track-h"><span class="sl">//</span> tutorials</div>' +
    '<div class="cards">' + cards + '</div>' + foot;
  home.querySelectorAll('.card').forEach((c) => {
    if (c.getAttribute('data-avail') === 'true') {
      c.onclick = () => { location.hash = '#/t/' + c.getAttribute('data-tid'); };
    }
  });
  document.getElementById('home').style.display = 'block';
  document.getElementById('shell').style.display = 'none';
}
