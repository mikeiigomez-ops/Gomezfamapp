/* Screen-based layout (v14).
   Every screen fits the display — nothing scrolls. Long screens are split into pages you swipe or tap
   through (‹ 1 of 3 ›), Home / More / Kid home are tile launchers, games go full screen and size their
   board to the space left, and wide screens (iPad landscape) get a side rail and two pages side by side.
   The two deliberate exceptions are the chat history and the bottom-sheet forms, which scroll inside
   their own box. Loaded after polish.js. */
'use strict';

/* =========================================================
   Pager: split whatever doesn't fit into screens
   ========================================================= */
// Screens that manage their own space (they never get the page controls).
const PG_SKIP = new Set(['chat', 'fchat', 'room', 'word', 'memory', 'c4', 'trivia', 'wrapped', 'avatar']);
// Wide screens show two pages side by side, except these, which have their own wide layout.
const PG_NO_SPREAD = new Set(['home', 'kid', 'more', 'house', 'fhouse', 'town', 'squishy']);
// Things that can be split between pages (by their children) and things that never can.
const PG_SPLIT = '.card, .av-panel, .list, .sq-grid, .grid2, .grid3, .ult-list, .notes, .launch, .game-grid, .little-grid, .kid-tiles, .av-grid, .av-swatches, .h-grid, .kudos-list, .wd-family, .stack, .ledger, [data-split]';
const PG_NOSPLIT = 'svg, button, form, a, label, select, input, textarea, details, .hero, .segmented, .room, .room-stage, .dollhouse, .mem-board, .c4-board, .wd-board, .wd-kb, .cal-grid, .month-grid, .chart, .kid-hero, [data-nosplit]';
const PG_GAP = 28;
const pg = { page: {}, key: '' };

const pgWide = () => innerWidth >= 1000;
// Automated feature tests see whole screens; layout tests switch paging on with window.__pager = true.
const pgOn = () => !navigator.webdriver || window.__pager === true;
function pgSplittable(el) {
  if (el.children.length < 2 || el.matches(PG_NOSPLIT)) return false;
  if (el.matches(PG_SPLIT)) return true;
  const cs = getComputedStyle(el);
  // Plain wrappers (no box of their own) can be split safely.
  return cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' && cs.boxShadow === 'none'
    && !parseFloat(cs.borderTopWidth) && ['block', 'grid', 'flex'].includes(cs.display) && (cs.display !== 'flex' || cs.flexDirection === 'column' || cs.flexWrap === 'wrap');
}
// Leaf units in reading order, each with the wrappers it sits in.
function pgUnits(container, H, depth = 0, parents = [], out = []) {
  for (const el of container.children) {
    if (el.classList.contains('pg-mini')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.position === 'fixed' || cs.position === 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (!r.height) continue;
    if (r.height > H * 0.5 && depth < 4 && pgSplittable(el)) pgUnits(el, H, depth + 1, [...parents, el], out);
    else out.push({ el, parents, top: r.top - (parseFloat(cs.marginTop) || 0), bottom: r.bottom + (parseFloat(cs.marginBottom) || 0), title: el.matches('.section-title, .more-label, .av-label, h2, h3') });
  }
  return out;
}
// Greedy split into pages of height H; headings travel with what follows them.
function pgSplit(units, H) {
  const pages = [];
  let start = null;
  units.forEach((u, i) => {
    if (start == null || u.bottom - units[start].top > H) {
      let s = i;
      if (start != null && i > start && units[i - 1].title && i - 1 > start) s = i - 1;
      if (start != null && s === i - 1) pages[pages.length - 1].pop();
      pages.push([]);
      start = s;
      if (s === i - 1) pages[pages.length - 1].push(i - 1);
    }
    pages[pages.length - 1].push(i);
  });
  return pages;
}
function pgApply(container, units, pages, shown, spread) {
  const on = new Set();
  for (const p of shown) for (const i of pages[p] || []) on.add(i);
  const wraps = new Map();
  units.forEach((u, i) => {
    u.el.classList.toggle('pg-off', !on.has(i));
    u.el.classList.remove('pg-break');
    for (const w of u.parents) wraps.set(w, (wraps.get(w) || false) || on.has(i));
  });
  for (const [w, vis] of wraps) w.classList.toggle('pg-off', !vis);
  if (spread && shown.length > 1 && pages[shown[1]]?.length) units[pages[shown[1]][0]].el.classList.add('pg-break');
}
function pgReset(container) {
  container.classList.remove('pg-cols');
  for (const el of container.querySelectorAll('.pg-off, .pg-break')) el.classList.remove('pg-off', 'pg-break');
}

/* ---------- Whole-screen pages ---------- */
function paginate() {
  const r = currentRoute().name;
  const ctl = $('#pgCtl');
  const key = r + '/' + (currentRoute().param || '');
  // Opening a screen starts on its first page; redrawing the same screen keeps your place.
  if (pg.key !== key) { pg.key = key; for (const k of Object.keys(pg.page)) if (k === key || k.startsWith(key + ':')) delete pg.page[k]; }
  pgReset(viewEl);
  document.body.classList.remove('paged');
  ctl.hidden = true;
  if (!pgOn()) return;
  const regions = [...viewEl.querySelectorAll('[data-pages]')];
  regions.forEach(paginateRegion);
  if (PG_SKIP.has(r) || document.body.classList.contains('game-mode') || document.body.classList.contains('house-editing')) return;
  if (viewEl.scrollHeight <= viewEl.clientHeight + 2) return;
  document.body.classList.add('paged');
  const spread = pgWide() && !PG_NO_SPREAD.has(r);
  const cs = getComputedStyle(viewEl);
  const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
  const contentW = viewEl.clientWidth - padL - padR;
  // Measure in a single column as wide as one page.
  if (spread) viewEl.style.paddingRight = (padR + (contentW + PG_GAP) / 2) + 'px';
  // (A few px of slack covers a card's own padding when it continues onto the next page.)
  let H = viewEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(getComputedStyle(viewEl).paddingBottom) - 8;
  const units = pgUnits(viewEl, H);
  viewEl.style.paddingRight = '';
  if (!units.length) return;
  let pages, tries = 0;
  const per = spread ? 2 : 1;
  const want = pg.page[key] || 0;
  for (;;) {
    pages = pgSplit(units, H);
    const total = Math.ceil(pages.length / per);
    const n = Math.min(want, total - 1);
    pg.page[key] = n;
    const shown = per === 2 ? [n * 2, n * 2 + 1] : [n];
    if (spread) { viewEl.style.paddingRight = (padR + (contentW + PG_GAP) / 2) + 'px'; }
    pgApply(viewEl, units, pages, shown, false);
    // Check every page really fits; if margins/padding made one spill, shrink and try again.
    // (A single item taller than the screen can't be helped by smaller pages, so it's skipped.)
    let over = 0;
    for (let p = 0; p < pages.length; p++) {
      if (pages[p].length < 2) continue;
      pgApply(viewEl, units, pages, [p], false);
      over = Math.max(over, viewEl.scrollHeight - viewEl.clientHeight);
    }
    viewEl.style.paddingRight = '';
    if (over <= 1 || tries++ > 8 || H - over < 120) { pgApply(viewEl, units, pages, shown, spread); break; }
    H -= over + 4;
    // Re-measure: hidden units changed nothing about their own sizes, so the old numbers still hold.
  }
  if (spread) viewEl.classList.add('pg-cols');
  const total = Math.ceil(pages.length / per);
  if (total <= 1) { document.body.classList.toggle('paged', false); return; }
  const n = pg.page[key];
  ctl.hidden = false;
  ctl.innerHTML = `<button data-action="pg" data-d="-1" aria-label="Previous page" ${n === 0 ? 'disabled' : ''}>‹</button>
    <span class="pg-dots" aria-label="Page ${n + 1} of ${total}">${total <= 8 ? [...Array(total)].map((_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('') : `<b>${n + 1}</b> of ${total}`}</span>
    <button data-action="pg" data-d="1" aria-label="Next page" ${n === total - 1 ? 'disabled' : ''}>›</button>`;
  ctl.dataset.total = total;
}
function pgGo(d, anim = true) {
  const total = Number($('#pgCtl').dataset.total || 1);
  const n = Math.max(0, Math.min(total - 1, (pg.page[pg.key] || 0) + d));
  if (n === pg.page[pg.key]) { if (anim) bump(viewEl, d); return; }
  pg.page[pg.key] = n;
  paginate();
  if (anim) slideIn(viewEl, d);
}
function slideIn(el, d) {
  if (navigator.webdriver || reduceMotion()) return;
  el.classList.remove('pg-in-l', 'pg-in-r'); void el.offsetWidth;
  el.classList.add(d > 0 ? 'pg-in-r' : 'pg-in-l');
}
function bump(el, d) {
  if (navigator.webdriver || reduceMotion()) return;
  el.classList.remove('pg-bump-l', 'pg-bump-r'); void el.offsetWidth;
  el.classList.add(d > 0 ? 'pg-bump-r' : 'pg-bump-l');
}

/* ---------- Pages inside one box (avatar options, the decorating catalog) ---------- */
function paginateRegion(box) {
  const key = pg.key + ':' + box.dataset.pages;
  box.querySelector(':scope > .pg-mini')?.remove();
  pgReset(box);
  box.classList.remove('pg-region');
  if (box.scrollHeight <= box.clientHeight + 2) return;
  box.classList.add('pg-region');
  const cs = getComputedStyle(box);
  let H = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
  if (H < 80) { box.classList.remove('pg-region'); return; }
  const units = pgUnits(box, H);
  if (!units.length) return;
  let pages, tries = 0;
  const want = pg.page[key] || 0;
  for (;;) {
    pages = pgSplit(units, H);
    const n = Math.min(want, pages.length - 1);
    pg.page[key] = n;
    let over = 0;
    for (let p = 0; p < pages.length; p++) { if (pages[p].length < 2) continue; pgApply(box, units, pages, [p], false); over = Math.max(over, box.scrollHeight - box.clientHeight); }
    pgApply(box, units, pages, [n], false);
    if (over <= 1 || tries++ > 4 || H - over < 60) break;
    H -= over + 4;
  }
  if (pages.length <= 1) { box.classList.remove('pg-region'); return; }
  const n = pg.page[key];
  const mini = document.createElement('div');
  mini.className = 'pg-mini';
  mini.innerHTML = `<button data-action="pg-r" data-d="-1" aria-label="Previous" ${n === 0 ? 'disabled' : ''}>‹</button><span>${pages.length <= 8 ? pages.map((_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('') : `<b>${n + 1}</b>&nbsp;of ${pages.length}`}</span><button data-action="pg-r" data-d="1" aria-label="Next" ${n === pages.length - 1 ? 'disabled' : ''}>›</button>`;
  box.appendChild(mini);
  box.dataset.total = pages.length;
}
function pgRegionGo(box, d) {
  const key = pg.key + ':' + box.dataset.pages;
  const total = Number(box.dataset.total || 1);
  const n = Math.max(0, Math.min(total - 1, (pg.page[key] || 0) + d));
  if (n === (pg.page[key] || 0)) { bump(box, d); return; }
  pg.page[key] = n;
  paginateRegion(box);
  slideIn(box, d);
}

Object.assign(actions, {
  pg: (el) => pgGo(Number(el.dataset.d)),
  'pg-r': (el) => pgRegionGo(el.closest('[data-pages]'), Number(el.dataset.d)),
});
KID_ACTIONS.add('pg'); KID_ACTIONS.add('pg-r');

// The page controls live outside the view so they sit in the same place on every screen.
const pgCtl = document.createElement('nav');
pgCtl.id = 'pgCtl'; pgCtl.className = 'pg-ctl'; pgCtl.hidden = true; pgCtl.setAttribute('aria-label', 'Pages');
$('#app').appendChild(pgCtl);

/* ---------- Swipe left / right to turn pages ---------- */
(() => {
  let t = null;
  const scrollsSideways = (el, stop) => {
    for (; el && el !== stop; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  };
  document.addEventListener('touchstart', (e) => {
    t = null;
    if (e.touches.length !== 1 || !$('#sheet').hidden) return;
    const target = e.target;
    const box = target.closest('[data-pages].pg-region');
    if (!box && !document.body.classList.contains('paged')) return;
    if (!box && !viewEl.contains(target) && !pgCtl.contains(target)) return;
    if (target.closest('input, textarea, select, [data-nd], .room, .mem-board, .c4-board, .wd-kb, [data-noswipe]')) return;
    if (target.closest('.card.flush > .row') && target.closest('.card.flush > .row').querySelector(':scope > .check[data-action], :scope > .del-btn[data-action]')) return;
    if (scrollsSideways(target, box || viewEl)) return;
    t = { x: e.touches[0].clientX, y: e.touches[0].clientY, box, at: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!t) return;
    const c = e.changedTouches[0], dx = c.clientX - t.x, dy = c.clientY - t.y;
    const s = t; t = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.at > 800) return;
    if (s.box) pgRegionGo(s.box, dx < 0 ? 1 : -1); else pgGo(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
// Keyboard: arrow keys turn pages on iPad keyboards / computers.
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select') || !$('#sheet').hidden) return;
  if (e.key === 'ArrowRight' && document.body.classList.contains('paged')) pgGo(1);
  if (e.key === 'ArrowLeft' && document.body.classList.contains('paged')) pgGo(-1);
});

/* ---------- Re-fit when the screen changes ---------- */
let pgW = innerWidth, pgH = innerHeight, pgT;
const refit = () => { clearTimeout(pgT); pgT = setTimeout(() => { modeClasses(); paginate(); }, 120); };
window.addEventListener('resize', () => {
  const typing = document.activeElement?.matches?.('input, textarea, select');
  if (innerWidth !== pgW || (!typing && Math.abs(innerHeight - pgH) > 60)) { pgW = innerWidth; pgH = innerHeight; refit(); }
});
viewEl.addEventListener('toggle', refit, true);
document.fonts?.ready?.then(refit);
// Coming back to the app: make sure the screen is drawn (iOS sometimes shows a blank page until a scroll).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  requestAnimationFrame(() => { viewEl.style.transform = 'translateZ(0)'; requestAnimationFrame(() => { viewEl.style.transform = ''; refit(); }); });
});
window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });

/* =========================================================
   Screen modes
   ========================================================= */
function modeClasses() {
  const { name, param } = currentRoute();
  const b = document.body;
  let game = false;
  if (name === 'memory') game = !ui.mem?.done;
  else if (name === 'word') { const me = actor(); game = !!me && !wordOf(me)?.done; }
  else if (name === 'c4') game = !!state.games.find((g) => g.id === param);
  else if (name === 'trivia') game = !!(ui.triv && ui.triv.i < ui.triv.qs.length);
  b.classList.toggle('game-mode', game);
  b.dataset.route = name;
  b.classList.toggle('wide', pgWide());
}
const _afterRenderScreen = afterRender;
afterRender = function () {
  modeClasses();
  _afterRenderScreen();
  paginate();
  // Content that grows a moment later (images, fonts, live data) gets one more fit.
  clearTimeout(pg.late);
  pg.late = setTimeout(() => {
    const regionsOver = [...viewEl.querySelectorAll('[data-pages]')].some((b) => b.scrollHeight > b.clientHeight + 2);
    if (viewEl.scrollHeight > viewEl.clientHeight + 2 || regionsOver) paginate();
  }, 400);
};

/* =========================================================
   Launchers: Home, More and Kid home are screens of tiles
   ========================================================= */
const tileHTML = ({ to, e, label, sub, color, act = 'go', attrs = '', alert = false, badge = '' }) => `<button class="tile${alert ? ' alert' : ''}" data-action="${act}" ${to ? `data-to="${to}"` : ''} ${attrs} style="--t:${color}">
    ${badge ? `<span class="tile-badge">${badge}</span>` : ''}<span class="tile-e">${e}</span><b>${esc(label)}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;

/* ---------- Grown-up Home ---------- */
const _dashboardView = views.home;
views.today = () => _dashboardView();
Object.assign(TITLES, { today: 'My Day', more: 'More', home: 'Home' });
views.home = () => {
  const t = today(), me = actor();
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const evs = eventsOn(t).filter((e) => e.kind !== 'holiday');
  const sumry = budgetSummary(monthKey(t));
  const left = sumry.limit ? sumry.limit - sumry.spent : null;
  const dinner = state.meals[t]?.dinner;
  const choresDue = state.chores.filter((c) => !choreDone(c)).length;
  const billsDue = recurringBetween(t, addDays(t, 7), 'bill').filter(({ b, date }) => !isPaid(b, date)).length;
  const unread = state.chat.filter((m) => m.at > (seen().chat || 0) && m.who !== me).length;
  const turns = typeof myTurnGames === 'function' ? myTurnGames().length : 0;
  const listN = state.shop.list.filter((i) => !i.done).length;
  const next = evs[0];
  const name = me ? member(me).name : '';
  const facts = [
    next ? `📅 ${esc(next.title)}${next.time ? ` · ${fmtTime(next.time)}` : ''}` : '📅 Nothing on today',
    left != null ? `💳 ${money(left, { maximumFractionDigits: 0 })} left` : '',
    dinner ? `🍽️ ${esc(dinner)}` : '',
  ].filter(Boolean);
  const tiles = [
    { to: 'today', e: '☀️', label: 'My day', sub: evs.length ? `${evs.length} event${evs.length > 1 ? 's' : ''}` : 'Overview', color: '#f59e0b' },
    { to: 'chores', e: '🧹', label: 'Chores', sub: choresDue ? `${choresDue} to do` : 'All done ✓', color: '#3b82f6' },
    { to: 'meals', e: '🍽️', label: 'Meals', sub: dinner ? 'Planned' : 'Plan dinner', color: '#ef4444' },
    { to: 'budget', e: '🧾', label: 'Bills', sub: billsDue ? `${billsDue} due soon` : 'All paid', color: '#10b981', attrs: 'data-btab="bills"', alert: billsDue > 0 },
    { to: 'chat', e: '💬', label: 'Chat', sub: unread ? `${unread} new` : 'Family', color: '#8b5cf6', badge: unread || '' },
    { to: 'kids', e: '🧒', label: 'Kids', sub: kids().length ? `${kids().length} kid${kids().length > 1 ? 's' : ''}` : 'Set up', color: '#ec4899' },
    { to: 'play', e: '🎮', label: 'Play', sub: turns ? 'Your turn!' : 'Games & collecting', color: '#0ea5e9', badge: turns || '' },
    { to: 'shop', e: '🛒', label: 'Groceries', sub: listN ? `${listN} on list` : 'List', color: '#84cc16' },
    { to: 'more', e: '✨', label: 'More', sub: 'Everything else', color: '#64748b' },
  ];
  return `<section class="home-hi">
      <div class="hh-text"><div class="hh-greet">${greet}${name ? `, ${esc(name)}` : ''}</div>
      <div class="hh-date">${fmtDate(t, { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>
      <div class="hh-facts">${facts.map((f) => `<span>${f}</span>`).join('')}</div>
    </section>
    ${needMe()}
    ${typeof whatsNewCard === 'function' ? whatsNewCard() : ''}
    <div class="launch">${tiles.map(tileHTML).join('')}</div>`;
};

/* ---------- More: groups → one screen of tiles each ---------- */
const MORE_GROUPS = {
  'Together': ['💬', '#8b5cf6'], 'Play & collect': ['🎮', '#0ea5e9'], 'Family': ['👨‍👩‍👧', '#ec4899'],
  'Money': ['💰', '#10b981'], 'House': ['🏠', '#f59e0b'],
};
function moreGroups() {
  const tpl = document.createElement('template');
  tpl.innerHTML = typeof moreGrid === 'function' ? moreGrid() : '';
  const groups = [];
  let cur = null;
  for (const el of tpl.content.children) {
    if (el.classList.contains('more-label')) { cur = { label: el.textContent.trim(), tiles: [] }; groups.push(cur); }
    else if (cur) cur.tiles.push(...el.querySelectorAll('button'));
  }
  return groups;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
views.more = (g) => {
  const groups = moreGroups();
  const grp = g && groups.find((x) => slug(x.label) === g);
  if (grp) {
    const [, color] = MORE_GROUPS[grp.label] || ['', '#64748b'];
    return `<div class="launch">${grp.tiles.map((b) => {
      const sub = b.querySelector('.small')?.textContent || '';
      const attrs = [...b.attributes].filter((a) => a.name.startsWith('data-') && !['data-action', 'data-to'].includes(a.name)).map((a) => `${a.name}="${esc(a.value)}"`).join(' ');
      return tileHTML({ to: b.dataset.to, act: b.dataset.action || 'go', e: b.querySelector('.emoji')?.innerHTML || '•', label: b.querySelector('b')?.textContent || '', sub: esc(sub), color, attrs, alert: /overdue|due/.test(sub) && !/All/.test(sub) });
    }).join('')}</div>`;
  }
  return `<div class="launch">${groups.map((x) => {
    const [e, color] = MORE_GROUPS[x.label] || ['📁', '#64748b'];
    if (x.label === 'Play & collect') return tileHTML({ to: 'play', e, label: 'Play', sub: 'Games & collecting', color });
    return tileHTML({ to: 'more/' + slug(x.label), e, label: x.label, sub: `${x.tiles.length} things`, color });
  }).join('')}${tileHTML({ to: 'settings', e: '⚙️', label: 'Settings', sub: 'Family & app', color: '#64748b' })}</div>`;
};

/* ---------- Kid home (big kids) ---------- */
const _kidOld = views.kid;
views.kid = () => {
  const id = kidModeId();
  if (!id) return _kidOld();
  if (typeof isSimple === 'function' && isSimple(id)) return simpleLauncher(id);
  const m = member(id), L = kidLevel(id);
  checkLevelUp(id);
  const myChores = state.chores.filter((c) => c.memberId === id || !c.memberId);
  const todo = myChores.filter((c) => !choreDone(c)).length;
  const rs = state.routines.filter((r) => r.memberId === id);
  const rsLeft = rs.filter((r) => !routineComplete(r)).length;
  const evs = eventsOn(today()).filter((e) => e.kind === 'event' && (!e.who?.id || e.who.id === id) || e.kind === 'birthday');
  const unread = state.chat.filter((x) => x.at > (seen().chat || 0) && x.who !== id).length;
  const turns = typeof myTurnGames === 'function' ? myTurnGames().length : 0;
  const poll = state.board.find((b) => b.type === 'poll' && !b.closed && !b.votes?.[id]);
  const n = new Set(myItems(id).map((i) => i.sid)).size;
  const free = state.squish.free[id] !== today() || sqBankOf(id) > 0;
  const h = houseOf(id);
  const fr = typeof kidRule === 'function' && kidRule(id).on && typeof circle === 'function' && circle();
  const frNew = fr ? circle().chat.filter((x) => x.at > (seen().fchat || 0) && x.from !== pkey(id)).length + friendTradeInbox(id).length : 0;
  const syncWait = typeof Sync !== 'undefined' && Sync.cfg?.kid && Sync.status !== 'synced' && Sync.status !== 'offline';
  const rsvp = typeof rsvpUpcoming === 'function' ? rsvpUpcoming(10).filter(({ ev, d }) => !ev.rsvp?.[d]?.[id]).slice(0, 1) : [];
  const tiles = [
    { to: 'chores', e: '🧹', label: 'My chores', sub: todo ? `${todo} to do` : myChores.length ? 'All done! 🎉' : 'None yet', color: '#3b82f6', badge: todo || '' },
    rs.length ? { to: 'routines', e: '🌅', label: 'Routines', sub: rsLeft ? `${rsLeft} to finish` : 'Done ✓', color: '#f59e0b' } : null,
    { to: 'squishies', e: '🧸', label: 'Squishies', sub: free ? '🎁 Free box!' : `${n} collected`, color: '#ec4899', badge: free ? '!' : '' },
    { to: 'house', e: '🏡', label: 'Dream House', sub: h ? `${h.rooms.length} room${h.rooms.length > 1 ? 's' : ''}` : 'Move in!', color: '#8b5cf6' },
    { to: 'games', e: '🎮', label: 'Games', sub: turns ? 'Your turn!' : 'Play', color: '#0ea5e9', badge: turns || '' },
    { to: 'chat', e: '💬', label: 'Chat', sub: unread ? `${unread} new` : 'Family', color: '#10b981', badge: unread || '' },
    fr ? { to: 'friends', e: '👯', label: 'Friends', sub: frNew ? `${frNew} new` : 'Trade & chat', color: '#f43f5e', badge: frNew || '' } : null,
    { to: 'gems', e: GEM, label: 'Gems', sub: `${gemBalance(id)} game gems`, color: '#7c3aed' },
    { to: 'chores', e: '🏆', label: 'Rewards', sub: `${pointsBalance(id)} points`, color: '#eab308', attrs: 'data-ctab="rewards"' },
    moneyMode(id) !== 'none' ? { to: 'piggy', e: '🐷', label: 'Piggy bank', sub: money(jarTotal(id, 'save') + jarTotal(id, 'spend') + jarTotal(id, 'give'), { maximumFractionDigits: 0 }), color: '#e85d8a' } : null,
    { to: 'checkin', e: esc(checkinOf(id)?.mood || '😊'), label: 'Check-in', sub: checkinOf(id) ? 'Done ✓' : 'How are you?', color: '#f97316' },
    { act: 'kudos-new', e: '🙌', label: 'High-five', sub: 'Cheer someone', color: '#14b8a6' },
    { to: 'wishes', e: '🎁', label: 'My wishes', sub: `${state.wishes.filter((w) => w.memberId === id).length}`, color: '#a855f7' },
    { to: 'badges', e: '🏅', label: 'Badges', sub: `${badgesFor(id).filter((b) => b.got).length}`, color: '#22c55e' },
    { to: 'todos', e: '✅', label: 'To-dos', sub: 'Family list', color: '#06b6d4' },
    { to: 'challenges', e: '🏁', label: 'Challenges', sub: 'Team goals', color: '#f59e0b' },
    { to: 'board', e: '📌', label: 'Fridge', sub: poll ? 'Vote!' : 'Notes', color: '#ef4444', badge: poll ? '!' : '' },
    { to: 'packing', e: '🧳', label: 'Packing', sub: 'Trip lists', color: '#64748b' },
  ].filter(Boolean);
  return `${syncWait ? `<div class="card install-tip"><b>⏳ Almost ready!</b><div class="small" style="margin-top:4px">${Sync.status === 'unverified' ? `Ask a grown-up to tap the approval link sent to their email (${esc(Sync.cfg.kid.email)}).` : 'Connecting to your family…'}</div>${Sync.status === 'unverified' ? '<button class="btn block" style="margin-top:10px" data-action="sync-verified">A grown-up approved it</button>' : ''}</div>` : ''}
    <section class="kid-hi2" style="--c:${m.color}">
      <button class="kh-av" data-action="go" data-to="avatar">${typeof avatarSVG === 'function' ? avatarSVG(avatarOf(id), { head: true }) : esc(m.emoji)}</button>
      <div class="kh-main"><div class="kh-greet">Hi, ${esc(m.name)}! 👋</div>
        <button class="kh-level" data-action="go" data-to="badges"><span>Level ${L.lvl}</span><i><b style="width:${L.pct * 100}%"></b></i></button>
        ${evs.length ? `<div class="kh-today">📅 ${esc(evs[0].title)}${evs[0].time ? ` · ${fmtTime(evs[0].time)}` : ''}</div>` : ''}</div>
      <button class="kh-lock" data-action="kid-exit" aria-label="Grown-ups: exit Kid Mode">🔒</button>
    </section>
    ${rsvp.map(rsvpCard).join('')}
    <div class="launch">${tiles.map(tileHTML).join('')}</div>`;
};

/* ---------- Kid home (little kids, Simple mode) ---------- */
function simpleLauncher(id) {
  const m = member(id), stars = pointsBalance(id);
  const jobs = state.chores.filter((c) => c.memberId === id || !c.memberId);
  const left = jobs.filter((c) => !choreDone(c)).length;
  const rs = state.routines.filter((r) => r.memberId === id);
  const now = rs.find((r) => r.part === partOfDay()) || rs[0];
  const steps = now ? now.steps.filter((s) => routineDone(now)[s.id]).length : 0;
  const mm = moneyMode(id);
  const free = state.squish.free[id] !== today() || sqBankOf(id) > 0;
  const turns = typeof myTurnGames === 'function' ? myTurnGames().length : 0;
  const unread = state.chat.filter((x) => x.at > (seen().chat || 0) && x.who !== id).length;
  const syncWait = typeof Sync !== 'undefined' && Sync.cfg?.kid && Sync.status !== 'synced' && Sync.status !== 'offline';
  const tiles = [
    { to: 'chores', e: '🧹', label: 'My jobs', sub: left ? `${left} to do` : jobs.length ? 'All done! 🎉' : 'None yet', color: '#3b82f6', badge: left || '' },
    { to: 'routines', e: esc(now?.emoji || '🌅'), label: 'My routine', sub: now ? (routineComplete(now) ? 'Done! ⭐' : `${steps} of ${now.steps.length}`) : 'None yet', color: '#f59e0b' },
    { to: 'treats', e: '🎁', label: 'Treats', sub: `⭐ ${stars}`, color: '#ec4899' },
    { to: 'squishies', e: '🧸', label: 'Squishies', sub: free ? 'Free box!' : 'My collection', color: '#a855f7', badge: free ? '!' : '' },
    { to: 'house', e: '🏡', label: 'My house', sub: 'Decorate', color: '#8b5cf6' },
    { to: 'games', e: '🎮', label: 'Games', sub: turns ? 'Your turn!' : 'Play', color: '#0ea5e9' },
    { to: 'checkin', e: esc(checkinOf(id)?.mood || '😊'), label: 'My feeling', sub: checkinOf(id) ? 'Done ✓' : 'Tap me!', color: '#f97316' },
    { to: 'chat', e: '💬', label: 'Chat', sub: unread ? `${unread} new` : 'Say hi', color: '#10b981', badge: unread || '' },
    { act: 'kudos-new', e: '🙌', label: 'High-five', sub: 'Cheer someone', color: '#14b8a6' },
    { to: 'wishes', e: '💖', label: 'My wishes', sub: `${state.wishes.filter((w) => w.memberId === id).length}`, color: '#d946ef' },
    mm !== 'none' ? { to: 'piggy', e: '🐷', label: 'My piggy', sub: mm === 'one' ? (piggyTotal(id) || piggyOf(id).allowance ? money_(piggyTotal(id)) : 'Coming soon') : 'Jars', color: '#e85d8a' } : null,
    { to: 'badges', e: '🌟', label: 'Stickers', sub: `${badgesFor(id).filter((b) => b.got).length}`, color: '#22c55e' },
  ].filter(Boolean);
  return `${syncWait ? `<div class="card install-tip"><b>⏳ Almost ready!</b><div class="small" style="margin-top:4px">Ask a grown-up to check their email.</div>${Sync.status === 'unverified' ? '<button class="btn block" style="margin-top:10px" data-action="sync-verified">A grown-up did it</button>' : ''}</div>` : ''}
    <section class="kid-hi2 little" style="--c:${m.color}">
      <button class="kh-av" data-action="go" data-to="avatar">${typeof avatarSVG === 'function' ? avatarSVG(avatarOf(id), { head: true }) : esc(m.emoji)}</button>
      <div class="kh-main"><div class="kh-greet">Hi, ${esc(m.name)}! ${sayBtn(id, `Hi ${m.name}! You have ${stars} stars. Tap a picture to play.`)}</div>
        <button class="kh-stars" data-action="go" data-to="treats">⭐ <b>${stars}</b> stars</button></div>
      <button class="kh-lock" data-action="kid-exit" aria-label="Grown-ups">🔒</button>
    </section>
    <div class="launch big">${tiles.map(tileHTML).join('')}</div>`;
}

/* ---------- Play: every game and every collecting thing on one screen ---------- */
Object.assign(TITLES, { play: 'Play' });
views.play = () => {
  const me = actor();
  const turns = typeof myTurnGames === 'function' ? myTurnGames().length : 0;
  const liveC4 = me ? c4Games().filter((g) => !c4Status(g).over && (g.a === me || g.b === me)).length : 0;
  const wrec = me ? wordOf(me) : null;
  const triv = me ? triviaWaiting(me).length : 0;
  const h = me ? houseOf(me) : null;
  const n = me ? new Set(myItems(me).map((i) => i.sid)).size : 0;
  const free = me && (state.squish.free[me] !== today() || sqBankOf(me) > 0);
  const kid = kidModeId();
  const friendsOk = typeof views.friends === 'function' && (!kid || (typeof kidRule === 'function' && kidRule(kid).on));
  const tiles = [
    { to: 'word', e: '🔤', label: 'Family Word', sub: wrec?.done ? (wrec.won ? `Solved in ${wrec.g.length} ✓` : 'Done today') : 'Today’s puzzle', color: '#16a34a' },
    liveC4 ? { to: 'games', e: '🔴', label: 'Connect Four', sub: turns ? 'Your turn!' : `${liveC4} game${liveC4 > 1 ? 's' : ''} going`, color: '#dc2626', badge: turns || '' }
      : { act: 'c4-new', e: '🔴', label: 'Connect Four', sub: 'Challenge', color: '#dc2626' },
    { to: 'memory', e: '🃏', label: 'Memory', sub: 'Find the pairs', color: '#7c3aed' },
    { act: 'trivia-open', e: '🧠', label: 'Trivia', sub: triv ? `${triv} new!` : 'Family quiz', color: '#0284c7', badge: triv || '' },
    { to: 'squishies', e: '🧸', label: 'Squishies', sub: free ? '🎁 Free box!' : `${n} collected`, color: '#ec4899', badge: free ? '!' : '' },
    { to: 'house', e: '🏡', label: 'Dream House', sub: h ? `${h.rooms.length} room${h.rooms.length > 1 ? 's' : ''}` : 'Move in!', color: '#8b5cf6' },
    { to: 'avatar', e: '🧍', label: 'My avatar', sub: 'Dress up', color: '#f97316' },
    { to: 'town', e: '🏘️', label: 'Town', sub: 'Visit & vote', color: '#f59e0b' },
    { to: 'gems', e: GEM, label: 'Gems', sub: me ? `${gemBalance(me)} gems` : 'Wallets', color: '#7c3aed' },
    friendsOk ? { to: 'friends', e: '👯', label: 'Friends', sub: 'Trade & chat', color: '#f43f5e' } : null,
    { to: 'games', e: '🏆', label: 'Scores', sub: 'Champs', color: '#eab308' },
  ].filter(Boolean);
  return `${needMe()}<div class="launch">${tiles.map(tileHTML).join('')}</div>`;
};
KID_ROUTES.push('play');
