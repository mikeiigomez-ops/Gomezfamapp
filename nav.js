/* Navigation v2: five places, every feature in exactly one of them.
   Home (today at a glance) · Plan (calendar, lists, meals, gifts…) · Money · Family · Play.
   A section of Plan, Money or Family is one tap from its siblings through the chip row under the top bar,
   so nothing hides behind More → group → tile any more. Tabs remember the section you last used.
   Loaded after world.js (every view is defined by now). */
'use strict';

const HUBS = [
  { id: 'home', label: 'Home', to: 'home', chips: [], routes: ['home', 'today', 'inbox', 'search', 'settings', 'activity', 'wrapped'] },
  { id: 'plan', label: 'Plan', to: 'calendar',
    chips: [['calendar', 'Calendar'], ['shop', 'Groceries'], ['meals', 'Meals'], ['todos', 'To-dos'], ['gifts', 'Gifts'], ['packing', 'Packing'], ['projects', 'Projects'], ['upkeep', 'Upkeep']],
    routes: ['person', 'project', 'recipe', 'trip', 'store'] },
  { id: 'money', label: 'Money', to: 'budget',
    chips: [['budget', 'Budget'], ['goals', 'Goals'], ['debts', 'Debt plan'], ['subs', 'Subscriptions']],
    routes: ['goal'] },
  { id: 'family', label: 'Family', to: 'chores',
    chips: [['chores', 'Chores'], ['kids', 'Kids'], ['chat', 'Chat'], ['board', 'Fridge'], ['checkin', 'Check-in'], ['kudos', 'High-fives'], ['challenges', 'Challenges'], ['binder', 'Binder']],
    routes: ['kid', 'routines', 'piggy', 'wishes', 'badges', 'treats'] },
  { id: 'play', label: 'Play', to: 'play', chips: [],
    routes: ['play', 'games', 'word', 'memory', 'c4', 'trivia', 'squishies', 'squishy', 'house', 'room', 'town', 'fhouse', 'avatar', 'gems', 'friends', 'friend', 'fchat', 'fcontrols', 'world'] },
];
const HUB = Object.fromEntries(HUBS.map((h) => [h.id, h]));
const HUB_OF = {};
for (const h of HUBS) for (const r of [...h.chips.map(([to]) => to), ...h.routes]) HUB_OF[r] ||= h.id;
const hubOf = (name) => HUB_OF[name] || 'home';
const isChip = (name) => HUBS.some((h) => h.chips.some(([to]) => to === name));
const navLast = {};

// Every section you can reach from a tab is a top-level screen: no back arrow there
TABS.length = 0;
TABS.push('home', 'play', ...HUBS.flatMap((h) => h.chips.map(([to]) => to)));

// "More" is gone: everything it held now lives in a tab. Old links land on Home.
views.more = () => { setTimeout(() => location.replace('#home'), 0); return ''; };
if (typeof HOME_SECTIONS !== 'undefined') { const i = HOME_SECTIONS.findIndex(([id]) => id === 'more'); if (i >= 0) HOME_SECTIONS.splice(i, 1); }

/* Small counts on chips, only for things that need you (never "3 chores", which is always true) */
const CHIP_BADGE = {
  chat: () => { const me = actor(); return state.chat.filter((m) => m.at > (seen().chat || 0) && m.who !== me).length; },
  budget: () => (typeof overdueBills === 'function' ? overdueBills(today()).length : 0),
  upkeep: () => state.maintenance.filter((u) => upkeepStatus(u).key === 'overdue').length,
  board: () => { const me = actor(); return me ? state.board.filter((b) => b.type === 'poll' && !b.closed && !b.votes?.[me]).length : 0; },
};
const subnavEl = $('#subnav');
function paintNav() {
  const { name } = currentRoute();
  const kid = typeof inKidMode === 'function' && inKidMode();
  const bar = $('.tabbar');
  const hid = hubOf(name), h = HUB[hid];
  if (!kid && bar && !bar.dataset.kid) {
    bar.querySelectorAll('[data-hub]').forEach((b) => { const on = b.dataset.hub === hid; b.classList.toggle('active', on); b.toggleAttribute('aria-current', on); });
    if (typeof moveTabInk === 'function') moveTabInk();
  }
  if (!kid && (isChip(name) || name === h.to)) navLast[hid] = location.hash.slice(1) || name;
  const show = !kid && isChip(name) && !document.body.classList.contains('game-mode');
  document.body.classList.toggle('has-subnav', show);
  subnavEl.hidden = !show;
  if (!show) return;
  $('#title').textContent = h.label;
  const html = h.chips.map(([to, label]) => {
    let n = 0;
    try { n = CHIP_BADGE[to]?.() || 0; } catch { n = 0; }
    return `<button class="chip${to === name ? ' on' : ''}" data-action="go" data-to="${to}"${to === name ? ' aria-current="page"' : ''}>${esc(label)}${n ? `<i>${n > 9 ? '9+' : n}</i>` : ''}</button>`;
  }).join('');
  if (subnavEl.dataset.html !== html) {
    const keep = subnavEl.dataset.hub === hid ? subnavEl.scrollLeft : 0;
    subnavEl.innerHTML = html; subnavEl.dataset.html = html; subnavEl.dataset.hub = hid;
    subnavEl.scrollLeft = keep;
  }
  // Keep the current section in view without jumping the row around
  const on = subnavEl.querySelector('.on');
  if (on && (on.offsetLeft < subnavEl.scrollLeft || on.offsetLeft + on.offsetWidth > subnavEl.scrollLeft + subnavEl.clientWidth)) {
    subnavEl.scrollTo({ left: on.offsetLeft - 16, behavior: navigator.webdriver ? 'auto' : 'smooth' });
  }
}
const _afterRenderNav = afterRender;
// Before the pager measures the screen: the chip row takes space from it
afterRender = function () { paintNav(); _afterRenderNav(); };

Object.assign(actions, {
  // A tab returns to the section you last used in it; from a detail screen it goes back to that section
  'hub': (el) => {
    const h = HUB[el.dataset.hub]; if (!h) return;
    const cur = currentRoute().name;
    if (hubOf(cur) === h.id && (cur === h.to || isChip(cur))) { viewEl.scrollTo({ top: 0 }); return; }
    go(navLast[h.id] || h.to);
  },
});

/* Inbox: the family feed and monthly recap live here now (they used to hide in More) */
const _inboxNav = views.inbox;
views.inbox = () => `${_inboxNav()}
  <div class="section-title">Family</div>
  <div class="card flush">
    <button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="activity"><div class="avatar">📰</div><div class="grow"><div class="title">Activity</div><div class="sub">Who did what</div></div>${ICON.chev}</button>
    <button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="wrapped"><div class="avatar">🎬</div><div class="grow"><div class="title">Wrapped</div><div class="sub">This month’s recap</div></div>${ICON.chev}</button>
  </div>`;

if (typeof module !== 'undefined') module.exports = { HUBS, hubOf };
