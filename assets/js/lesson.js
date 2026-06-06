/* ============================================================================
   lesson.js — renders a single lesson: the progress sidebar, the lesson body
   (which may mount an interactive sim via its init()), and the prev/next
   pager. Tracks the current {tutorial, lessonId} for keyboard navigation.
   ========================================================================== */
import { esc } from './util.js';
import { isSeen, markSeen } from './store.js';
import { TUTORIALS, flat } from './content/index.js';

let CUR = null;
export function getCurrent() { return CUR; }

function buildSidebar(t, lid) {
  const lessons = flat(t);
  const total = lessons.length;
  const seen = lessons.filter((l) => isSeen(t.id, l.id)).length;
  const pct = Math.round((seen / total) * 100);
  let h = '<a class="sb-back" href="#/">← all tutorials</a>' +
    '<div class="sb-title">' + esc(t.title) + '</div>' +
    '<div class="sb-meta"><span>' + esc(t.difficulty) + '</span><span>' + esc(t.est) + '</span></div>' +
    '<div class="progress"><div class="bar"><div class="fill" style="width:' + pct + '%"></div></div><div class="lab">' + seen + ' / ' + total + ' complete</div></div>';
  t.parts.forEach((p, pi) => {
    h += '<div class="part"><div class="part-h' + (p.adv ? ' adv' : '') + '"><span class="ix">' + (pi < 9 ? '0' : '') + (pi + 1) + '</span>' + esc(p.title) + '</div>';
    p.lessons.forEach((l) => {
      const on = l.id === lid, sn = isSeen(t.id, l.id);
      h += '<div class="lnk' + (on ? ' active' : '') + (sn ? ' seen' : '') + '" data-lid="' + l.id + '"><span class="tick">✓</span><span>' + esc(l.title) + '</span></div>';
    });
    h += '</div>';
  });
  const sb = document.getElementById('sidebar');
  sb.innerHTML = h;
  sb.querySelectorAll('.lnk').forEach((el) => {
    el.onclick = () => { location.hash = '#/t/' + t.id + '/' + el.getAttribute('data-lid'); sb.classList.remove('open'); };
  });
}

function pagerCard(dir, l, tid) {
  if (!l) return '<div class="pg empty"></div>';
  return '<div class="pg ' + (dir === 'next' ? 'next' : '') + '" data-go="#/t/' + tid + '/' + l.id + '"><div class="dir">' + (dir === 'next' ? 'next →' : '← previous') + '</div><div class="t">' + esc(l.title) + '</div></div>';
}

export function renderLesson(t, lid) {
  const list = flat(t);
  let idx = list.findIndex((l) => l.id === lid);
  if (idx < 0) { idx = 0; lid = list[0].id; }
  const lesson = list[idx];

  buildSidebar(t, lid);
  const c = document.getElementById('content');
  c.innerHTML = '<div class="reveal">' + lesson.html() + '</div>';
  markSeen(t.id, lid);
  buildSidebar(t, lid); // refresh progress + ticks now that this one is seen

  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx < list.length - 1 ? list[idx + 1] : null;
  const pager = '<div class="pager">' + pagerCard('prev', prev, t.id) + pagerCard('next', next, t.id) + '</div>';

  // end of tutorial -> point at the next tutorial
  let nt = '';
  if (!next) {
    const ci = TUTORIALS.indexOf(t), n = TUTORIALS[ci + 1];
    if (n) {
      const go = n.status === 'available' ? '#/t/' + n.id : '#/';
      nt = '<div class="nexttut"><div class="e">' + (n.status === 'available' ? 'next tutorial' : 'coming soon') + '</div>' +
        '<div class="t">' + esc(n.title) + '</div><p style="margin:0;color:var(--dim);font-size:14px">' + esc(n.desc) + '</p>' +
        (n.status === 'available' ? '<a class="go" href="' + go + '">Start ' + esc(n.title) + ' →</a>' : '<a class="go" href="#/" style="color:var(--faint)">Back to all tutorials →</a>') + '</div>';
    }
  }
  c.innerHTML += nt + (next ? pager : '<div class="pager">' + pagerCard('prev', prev, t.id) + '<div class="pg empty"></div></div>');
  c.querySelectorAll('.pg[data-go]').forEach((el) => {
    el.onclick = () => { location.hash = el.getAttribute('data-go'); };
  });

  if (lesson.init) { try { lesson.init(); } catch (e) { console.error('init', lesson.id, e); } }

  document.getElementById('home').style.display = 'none';
  document.getElementById('shell').style.display = 'flex';
  window.scrollTo(0, 0);
  CUR = { t, lid };
}
