/* ============================================================================
   app.js — application entry point. Wires up the hash router, the glossary
   panel, tab switching, keyboard shortcuts, and the mobile sidebar toggle.

   Routes:
     #/                      -> home (tutorial cards)
     #/t/<tutorialId>        -> first lesson of that tutorial
     #/t/<tutorialId>/<id>   -> a specific lesson
   ========================================================================== */
import { clearTimers } from './util.js';
import { renderGlossary, openGloss, closeGloss } from './glossary.js';
import { tutorialById, flat } from './content/index.js';
import { renderHome } from './home.js';
import { renderLesson, getCurrent } from './lesson.js';

/* ---- router -------------------------------------------------------------- */
function route() {
  clearTimers(); // stop any sim animations from the previous route
  const h = location.hash.replace(/^#/, '');
  const parts = h.split('/').filter(Boolean); // '#/t/id/lid' -> ['t','id','lid']
  if (parts[0] !== 't') { renderHome(); return; }
  const t = tutorialById(parts[1]);
  if (!t || t.status !== 'available') { location.hash = '#/'; return; }
  if (!parts[2]) { location.hash = '#/t/' + t.id + '/' + flat(t)[0].id; return; }
  renderLesson(t, parts[2]);
}

/* ---- tab switching (event-delegated, since tabs are injected as HTML) ----- */
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.tab-btn');
  if (!b) return;
  const g = b.getAttribute('data-tg'), i = b.getAttribute('data-ti');
  document.querySelectorAll('.tab-btn[data-tg="' + g + '"]').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab-pane[data-pg="' + g + '"]').forEach((p) => p.classList.toggle('on', p.getAttribute('data-pi') === i));
});

/* ---- keyboard: G = glossary, Esc = close, arrows = prev/next lesson ------- */
document.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test((e.target.tagName || ''));
  if (e.key === 'g' && !typing) {
    document.getElementById('glossPanel').classList.contains('on') ? closeGloss() : openGloss();
  }
  if (e.key === 'Escape') closeGloss();
  const cur = getCurrent();
  if (cur && !typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const list = flat(cur.t);
    const idx = list.findIndex((l) => l.id === cur.lid);
    if (e.key === 'ArrowRight' && idx < list.length - 1) location.hash = '#/t/' + cur.t.id + '/' + list[idx + 1].id;
    if (e.key === 'ArrowLeft' && idx > 0) location.hash = '#/t/' + cur.t.id + '/' + list[idx - 1].id;
  }
});

/* ---- boot ---------------------------------------------------------------- */
renderGlossary();
document.getElementById('glossBtn').onclick = openGloss;
document.getElementById('glossScrim').onclick = closeGloss;
document.getElementById('menuBtn').onclick = () => {
  document.getElementById('sidebar').classList.toggle('open');
};
window.addEventListener('hashchange', route);
if (!location.hash) location.hash = '#/';
route();
