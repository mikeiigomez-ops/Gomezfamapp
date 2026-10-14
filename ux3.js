/* UX pass 3 — ten improvements from a full review of every screen.
   1 First-run "Who are you?" welcome (once per phone) instead of a picker card on every screen
   2 Home "Up next": your next few things across calendar, chores, bills, games and pets
   3 Badges on the bottom tabs, so you can see where something is waiting
   4 Friendlier empty states with a clear first step (chat, fridge, binder, high-fives)
   5 Calendar: an empty day shows what's coming up next instead of a blank card
   6 Search: quick jumps, example searches and your recent searches before you type
   7 Settings scrolls, with jump chips to each section, instead of six flip pages
   8 Kids page: the per-kid buttons are a tidy row of icon buttons
   9 (CSS) Readability: stronger secondary text, no labels below 11px
   10 Scores: family records (best word streak, most wins, Tycoon, Charades, Quiz) on the Games page
   Loaded last. */
'use strict';

/* ---------- 1 · Welcome: who's using this phone ---------- */
const WELCOME_SKIP = 'gomezfam:welcome-skip';
const welcomeOn = () => !navigator.webdriver || window.__welcome === true;
function welcomeShow() {
  const need = welcomeOn() && !actor() && state.members.length > 1 && !(typeof inKidMode === 'function' && inKidMode());
  let el = document.querySelector('.welcome-who');
  let skipped = false; try { skipped = sessionStorage.getItem(WELCOME_SKIP) === '1'; } catch { /* private mode */ }
  if (!need || skipped) { el?.remove(); return; }
  if (el) return;
  el = document.createElement('div');
  el.className = 'welcome-who'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Who is using this phone?');
  el.innerHTML = `<div class="ww-card"><div class="ww-wave">👋</div><h2>Who’s using this ${matchMedia('(min-width: 1000px)').matches ? 'device' : 'phone'}?</h2>
    <p class="muted">Tap your face. The app remembers it on this ${matchMedia('(min-width: 1000px)').matches ? 'device' : 'phone'}, so “your turn”, your chores and the family feed are about you.</p>
    <div class="ww-grid">${state.members.map((m) => `<button data-action="set-me" data-id="${m.id}" style="--c:${m.color || '#8b5cf6'}">${typeof avatar === 'function' ? avatar(m) : esc(m.emoji)}<b>${esc(m.name)}</b>${m.kid ? '<small>Kid</small>' : ''}</button>`).join('')}</div>
    <button class="ww-skip" data-action="welcome-skip">Not now</button></div>`;
  document.body.appendChild(el);
}
actions['welcome-skip'] = () => { try { sessionStorage.setItem(WELCOME_SKIP, '1'); } catch { /* ignore */ } document.querySelector('.welcome-who')?.remove(); render(); };
// The in-page reminder becomes one slim line instead of a big card
const _whoAmICardUx = whoAmICard;
whoAmICard = function () {
  return `<div class="card whoami slim"><span>👋 Who are you?</span><div class="whoami-row">${state.members.map((m) => `<button data-action="set-me" data-id="${m.id}" aria-label="${esc(m.name)}">${typeof avatar === 'function' ? avatar(m) : esc(m.emoji)}<span>${esc(m.name)}</span></button>`).join('')}</div></div>`;
};

/* ---------- 2 · Home: Up next ---------- */
const fmtT = (t) => (t && typeof fmtTime === 'function' ? fmtTime(t) : '');
function upNextItems(me) {
  const t = today(), now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const kid = typeof isKidMember === 'function' && isKidMember(me);
  const out = [];
  // events today (still to come) and tomorrow
  for (const [d, label] of [[t, 'Today'], [addDays(t, 1), 'Tomorrow']]) {
    for (const e of eventsOn(d)) {
      if (e.kind === 'bill') continue;
      if (d === t && e.time && e.time < hm) continue;
      const mine = !e.whoIds?.length || e.whoIds.includes(me) || e.kind === 'birthday';
      out.push({ k: (d === t ? 0 : 50) + (e.time ? Number(e.time.replace(':', '')) / 10000 : 0.5), e: e.kind === 'birthday' ? '🎂' : '📅', title: e.title, sub: `${label}${e.time ? ' · ' + fmtT(e.time) : ''}${!mine || !e.who?.name ? '' : e.who.id === me ? '' : ' · ' + e.who.name}`, to: 'calendar', soft: !mine });
    }
  }
  // your chores still open today
  if (typeof choreDone === 'function') {
    const mine = state.chores.filter((c) => (c.memberId === me || !c.memberId) && !choreDone(c));
    if (mine.length) out.push({ k: 1, e: '🧹', title: mine.length === 1 ? mine[0].title : `${mine.length} chores to do`, sub: mine.length === 1 ? 'Your chore today' : mine.slice(0, 2).map((c) => c.title).join(', ') + (mine.length > 2 ? '…' : ''), to: kid ? 'chores' : 'chores' });
  }
  // bills due soon (grown-ups)
  if (!kid && typeof billsDueSoon === 'function') {
    const due = billsDueSoon(t);
    if (due.length) {
      const over = due.filter((x) => x.date < t).length;
      out.push({ k: over ? 0.2 : 60, e: '💳', title: over ? `${over} bill${over > 1 ? 's' : ''} overdue` : `${due.length} bill${due.length > 1 ? 's' : ''} due this week`, sub: due.slice(0, 2).map((x) => `${x.b.name} ${money(x.amount)}`).join(' · '), to: 'budget', hot: !!over });
    }
  }
  // games waiting on you
  if (typeof myTurnGames === 'function') {
    const g = myTurnGames();
    if (g.length) out.push({ k: 2, e: '🎮', title: g.length === 1 ? 'Your turn in a game' : `Your turn in ${g.length} games`, sub: 'Tap to jump in', to: typeof views.mygames === 'function' ? 'mygames' : 'games', hot: true });
  }
  // pets that need someone
  if (typeof petNeedy === 'function') {
    const ks = kid ? [me] : state.members.filter((m) => m.kid).map((m) => m.id);
    for (const k of ks) { const p = petNow(petOf(k)); if (petNeedy(p)) out.push({ k: 3, e: '🐾', title: `${p.name} needs ${kid ? 'you' : member(k).name}`, sub: petNeed(p), to: kid ? 'pet' : 'pet/' + k }); }
  }
  return out.sort((a, b) => a.k - b.k).slice(0, 5);
}
function upNextCard(me) {
  if (!me) return '';
  const items = upNextItems(me);
  if (!items.length) return `<div class="card upnext calm"><span>🌤️</span><div><b>You’re all caught up</b><small>Nothing waiting on you right now.</small></div></div>`;
  return `<div class="section-title">Up next</div><div class="card flush upnext">${items.map((x) => `<button class="row tap${x.hot ? ' hot' : ''}${x.soft ? ' soft' : ''}" data-action="go" data-to="${x.to}"><div class="avatar">${x.e}</div><div class="grow"><div class="title">${esc(x.title)}</div><div class="sub">${esc(x.sub)}</div></div>${typeof ICON !== 'undefined' ? ICON.chev : '›'}</button>`).join('')}</div>`;
}
const _homeUx = views.home;
views.home = (p) => {
  const html = _homeUx(p);
  const me = actor();
  if (!me || html.includes('class="card upnext') || typeof inKidMode === 'function' && inKidMode()) return html;
  const card = upNextCard(me);
  const at = html.search(/<button class="magic-bar[^"]*"[^>]*>/);
  if (at < 0) return html + card;
  const end = html.indexOf('</button>', at) + 9;
  return html.slice(0, end) + card + html.slice(end);
};

/* ---------- 3 · Tab badges ---------- */
function tabCounts() {
  const me = actor(), n = (f) => { try { return f() || 0; } catch { return 0; } };
  const B = typeof CHIP_BADGE !== 'undefined' ? CHIP_BADGE : {};
  const pets = n(() => state.members.filter((m) => m.kid && (!me || isKidMember(me) ? m.id === me : true)).filter((m) => petNeedy(petNow(petOf(m.id)))).length);
  return {
    plan: n(B.upkeep),
    money: n(B.budget),
    family: n(B.chat) + n(B.board),
    play: n(() => myTurnGames().length) + pets,
  };
}
function paintTabBadges() {
  const bar = document.querySelector('.tabbar');
  if (!bar || bar.dataset.kid || (typeof inKidMode === 'function' && inKidMode())) return;
  const c = tabCounts();
  bar.querySelectorAll('[data-hub]').forEach((b) => {
    const v = c[b.dataset.hub] || 0;
    let i = b.querySelector('.tab-badge');
    if (!v) { i?.remove(); return; }
    if (!i) { i = document.createElement('i'); i.className = 'tab-badge'; b.appendChild(i); }
    i.textContent = v > 9 ? '9+' : v;
    b.setAttribute('aria-label', `${b.textContent.replace(/\d+\+?$/, '').trim()}, ${v} waiting`);
  });
}

/* ---------- 4 · Empty states ---------- */
const emptyArt = (e, title, sub, btn) => `<div class="card empty nice"><span class="big">${e}</span><b>${title}</b><div class="small muted">${sub}</div>${btn || ''}</div>`;
const EMPTY_SWAPS = [
  ['chat', '<div class="card empty"><span class="big">💬</span>The family group chat. Say hi! 👋<div class="small muted" style="margin-top:6px">Type <b>@</b> to mention someone · tap a message to react</div></div>', () => emptyArt('💬', 'Say hi to the family', 'Messages here go to everyone. Type @ to mention someone; tap a message to react.')],
  ['binder', '<div class="card empty"><span class="big">📒</span>Your family binder is empty.<br>Add doctors, insurance, Wi-Fi, emergency contacts and more.</div>', () => emptyArt('📒', 'Your family binder', 'Everything a babysitter (or you, in a pinch) needs: doctors, insurance, Wi-Fi, emergency contacts. Start with a quick add below.')],
  ['kudos', '<div class="card empty small">No high-fives yet — be the first! 🙌</div>', () => emptyArt('🙌', 'No high-fives yet', 'Cheer someone on for something they did today.', '<button class="btn" data-action="kudos-new" style="margin-top:10px">Send the first one</button>')],
];
for (const [route, find, make] of EMPTY_SWAPS) {
  const v = views[route]; if (typeof v !== 'function') continue;
  views[route] = (p) => { const h = v(p); return typeof find === 'string' ? (h.includes(find) ? h.replace(find, () => make()) : h) : h.replace(find, () => make()); };
}

/* ---------- 5 · Calendar: next up on an empty day ---------- */
const _calUx = views.calendar;
views.calendar = (p) => {
  const h = _calUx(p), blank = '<div class="empty small">Nothing planned. Tap + to add something.</div>';
  if (!h.includes(blank)) return h;
  const from = ui.calSel || today(), next = [];
  for (let i = 1; i <= 30 && next.length < 2; i++) { const d = addDays(from, i); for (const e of eventsOn(d)) { if (e.kind !== 'bill') next.push({ d, e }); if (next.length >= 2) break; } }
  const chips = next.slice(0, 2).map(({ d, e }) => `<button class="cn-chip" data-action="cal-select" data-date="${d}"><i style="background:${e.color || 'var(--accent)'}"></i>${fmtDate(d, { weekday: 'short', day: 'numeric' })} · ${esc(e.title)}</button>`).join('');
  return h.replace(blank, `<div class="empty small cal-free"><span>${from === today() ? '☀️ Nothing planned today.' : '🗓️ Nothing planned this day.'} <button class="link-inline" data-action="add-event" data-date="${from}">Add something</button></span>${chips ? `<span class="cn-next">Next: ${chips}</span>` : ''}</div>`);
};

/* ---------- 6 · Search: before you type ---------- */
const SEARCH_KEY = 'gomezfam:recent-search';
const recentSearches = () => { try { return JSON.parse(localStorage.getItem(SEARCH_KEY) || '[]'); } catch { return []; } };
let searchSaveT = 0;
const _searchResultsUx = searchResults;
searchResults = function (q) {
  const n = String(q || '').trim();
  if (n.length < 2) {
    const rec = recentSearches();
    const jumps = [['calendar', '📅', 'Calendar'], ['shop', '🛒', 'Groceries'], ['budget', '💳', 'Budget'], ['chores', '🧹', 'Chores'], ['meals', '🍽️', 'Meals'], ['binder', '📒', 'Binder'], ['gifts', '🎁', 'Gifts'], ['play', '🎮', 'Play']];
    return `${rec.length ? `<div class="section-title">Recent</div><div class="chips search-chips">${rec.map((r) => `<button class="chip" data-action="search-try" data-q="${esc(r)}">🕘 ${esc(r)}</button>`).join('')}</div>` : ''}
      <div class="section-title">Try</div><div class="chips search-chips">${['Costco', 'dentist', 'birthday', 'Netflix', 'pizza'].map((r) => `<button class="chip" data-action="search-try" data-q="${r}">${r}</button>`).join('')}</div>
      <div class="section-title">Jump to</div><div class="search-jumps">${jumps.map(([to, e, l]) => `<button data-action="go" data-to="${to}"><span>${e}</span>${l}</button>`).join('')}</div>`;
  }
  const html = _searchResultsUx(q);
  clearTimeout(searchSaveT);
  if (n.length >= 3 && !/No results|Nothing found/i.test(html)) searchSaveT = setTimeout(() => { try { const r = [n, ...recentSearches().filter((x) => x.toLowerCase() !== n.toLowerCase())].slice(0, 6); localStorage.setItem(SEARCH_KEY, JSON.stringify(r)); } catch { /* full */ } }, 1500);
  return html;
};
actions['search-try'] = (el) => {
  ui.searchQ = el.dataset.q;
  const i = document.getElementById('searchInput'); if (i) i.value = el.dataset.q;
  const r = document.getElementById('searchResults'); if (r) r.innerHTML = searchResults(el.dataset.q); else render();
};

/* ---------- 7 · Settings scrolls, with jump chips ---------- */
if (typeof PG_SCROLL !== 'undefined') PG_SCROLL.add('settings');
const _settingsUx = views.settings;
views.settings = (p) => {
  const h = _settingsUx(p);
  if (p) return h;
  const secs = [];
  const out = h.replace(/<div class="section-title"([^>]*)>([\s\S]*?)<\/div>/g, (m, attrs, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').replace(/\+ ?Add.*$/, '').trim();
    if (!label || attrs.includes('id=')) return m;
    const id = 'set-' + secs.length; secs.push([id, label.length > 22 ? label.slice(0, 20) + '…' : label]);
    return `<div class="section-title"${attrs} id="${id}">${inner}</div>`;
  });
  if (secs.length < 3) return h;
  return `<div class="set-jump">${secs.map(([id, l]) => `<button class="chip" data-action="set-jump" data-id="${id}">${esc(l)}</button>`).join('')}</div>${out}`;
};
actions['set-jump'] = (el) => document.getElementById(el.dataset.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

/* ---------- 8 · Kids page buttons ---------- */
const _kidsUx = views.kids;
views.kids = (p) => _kidsUx(p)
  .replace(/<div class="btn-row" style="margin:12px 0 0">(<button class="btn secondary" data-action="kid-device")/g, '<div class="btn-row kid-acts" style="margin:12px 0 0">$1')
  .replace(/>📱 (Device setup code|Set up their device)</g, (m, t) => `><span>📱</span>${t === 'Device setup code' ? 'Device code' : 'Set up device'}<`)
  .replace(/>⚙️ Kid settings</g, '><span>⚙️</span>Settings<')
  .replace(/>🧒 Kid Mode here</g, '><span>🧒</span>Kid Mode<');

/* ---------- 10 · Scores: family records ---------- */
function familyRecords() {
  const name = (id) => (state.members.find((m) => m.id === id)?.name) || '';
  const em = (id) => (state.members.find((m) => m.id === id)?.emoji) || '';
  const rows = [];
  // Family Word: longest streak
  if (typeof wordStreak === 'function') { const b = state.members.map((m) => [m.id, wordStreak(m.id)]).sort((a, c) => c[1] - a[1])[0]; if (b && b[1] > 0) rows.push(['🔤', 'Family Word streak', b[0], `${b[1]} day${b[1] > 1 ? 's' : ''}`]); }
  // Most game wins ever
  const wins = {}; for (const g of state.games || []) if (g.winner && name(g.winner)) wins[g.winner] = (wins[g.winner] || 0) + 1;
  const w = Object.entries(wins).sort((a, c) => c[1] - a[1])[0]; if (w) rows.push(['🏆', 'Most game wins', w[0], `${w[1]} win${w[1] > 1 ? 's' : ''}`]);
  // Connect Four
  const c4 = {}; for (const g of (state.games || []).filter((x) => x.type === 'c4')) if (g.winner && name(g.winner)) c4[g.winner] = (c4[g.winner] || 0) + 1;
  const c = Object.entries(c4).sort((a, d) => d[1] - a[1])[0]; if (c) rows.push(['🔴', 'Connect Four champ', c[0], `${c[1]} win${c[1] > 1 ? 's' : ''}`]);
  // Squish Tycoon
  const ty = Object.entries(state.tycoon || {}).filter(([id, T]) => name(id) && T.earned).sort((a, d) => d[1].earned - a[1].earned)[0];
  if (ty) rows.push(['🏭', 'Squish Tycoon', ty[0], `${typeof fmtCoin === 'function' ? fmtCoin(ty[1].earned) : Math.round(ty[1].earned)} coins`]);
  // Charades / Trivia best rounds
  for (const [game, e, label, unit] of [['charades', '🤳', 'Charades best round', 'words'], ['trivia', '🧠', 'Trivia best', 'right']]) {
    const s = (state.scores || []).filter((x) => x.game === game && name(x.who)).sort((a, d) => d.score - a.score)[0];
    if (s) rows.push([e, label, s.who, `${s.score} ${unit}`]);
  }
  // Quiz Show high score
  if (typeof GX !== 'undefined' && GX.quiz) {
    let best = null; for (const g of (state.games || []).filter((x) => x.type === 'quiz' && x.endAt)) { const sc = GX.quiz.scores(g); for (const [id, v] of Object.entries(sc)) if (name(id) && (!best || v > best[1])) best = [id, v]; }
    if (best && best[1]) rows.push(['🎤', 'Quiz Show high score', best[0], best[1].toLocaleString()]);
  }
  if (!rows.length) return '';
  return `<div class="section-title">🏅 Family records</div><div class="card flush records">${rows.map(([e, l, id, v]) => `<div class="row"><div class="avatar">${e}</div><div class="grow"><div class="title">${esc(l)}</div><div class="sub">${esc(em(id))} ${esc(name(id))}</div></div><b>${esc(v)}</b></div>`).join('')}</div>`;
}
const _gamesUx = views.games;
views.games = (p) => {
  const h = _gamesUx(p), rec = familyRecords();
  if (!rec) return h;
  const at = h.indexOf('<div class="game-grid">');
  return at >= 0 ? h.slice(0, at) + rec + h.slice(at) : h + rec;
};
Object.assign(TITLES, { games: 'Scores & games' });

/* ---------- Wiring ---------- */
KID_ACTIONS.add('welcome-skip'); KID_ACTIONS.add('search-try');
const _afterRenderUx = afterRender;
afterRender = function () {
  _afterRenderUx();
  welcomeShow();
  paintTabBadges();
};
