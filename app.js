/* Gomez Family hub — a single-file, no-build PWA. All data lives in localStorage on this device. */
'use strict';

/* =========================================================
   Helpers
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const weekStart = (s) => addDays(s, -((parse(s).getDay() + 6) % 7)); // Monday
const monthKey = (s) => s.slice(0, 7);
const addMonths = (ym, n) => { const d = parse(ym + '-01'); d.setMonth(d.getMonth() + n); return iso(d).slice(0, 7); };
const fmtDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parse(s).toLocaleDateString(undefined, opts);
const fmtMonth = (ym) => parse(ym + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const fmtTime = (t) => {
  if (!t) return 'All day';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
const relDays = (n) => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
const money = (n, opts = {}) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency || 'USD', ...opts }).format(n || 0);
  } catch { return '$' + (n || 0).toFixed(2); }
};
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const norm = (s) => String(s || '').trim().toLowerCase();

const ICON = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" style="width:18px;height:18px;color:var(--muted)"><path d="M9 18l6-6-6-6"/></svg>',
};

/* =========================================================
   State & persistence
   ========================================================= */
const STORE_KEY = 'gomezfam:v1';
const COLORS = ['#c8573d', '#2f8a5b', '#3b6fd8', '#9b51e0', '#e0a800', '#d6457e', '#1aa3a3', '#6b7280'];
const AISLES = ['Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Pantry', 'Frozen', 'Snacks & Drinks', 'Household', 'Personal Care', 'Baby & Kids', 'Pets', 'Other'];
const OCCASIONS = ['Birthday', 'Christmas', 'Anniversary', "Valentine's Day", "Mother's Day", "Father's Day", 'Graduation', 'Wedding', 'Baby Shower', 'Just Because', 'Other'];
const GIFT_STATUS = ['idea', 'bought', 'wrapped', 'given'];
const GIFT_STATUS_CLS = { idea: '', bought: 'warn', wrapped: 'accent', given: 'good' };
const STAPLE_STATUS = ['ok', 'low', 'out'];
const STAPLE_LABEL = { ok: 'Stocked', low: 'Running low', out: 'Out' };
const STAPLE_CLS = { ok: 'good', low: 'warn', out: 'bad' };

function defaultState() {
  const cat = (emoji, name, limit) => ({ id: uid(), emoji, name, limit });
  const staple = (name, aisle, kind = 'grocery') => ({ id: uid(), name, aisle, kind, status: 'ok', price: null, store: '', lastBought: '' });
  return {
    version: 1,
    members: [{ id: uid(), name: 'Me', emoji: '😀', color: COLORS[0] }],
    budget: {
      categories: [
        cat('🛒', 'Groceries', 800), cat('🍔', 'Dining Out', 250), cat('⛽', 'Gas & Transport', 250),
        cat('💡', 'Utilities', 300), cat('🧻', 'Household', 150), cat('🧸', 'Kids', 200),
        cat('🎬', 'Fun', 150), cat('🎁', 'Gifts', 100), cat('🩺', 'Health', 100), cat('📦', 'Other', 150),
      ],
      transactions: [],
      bills: [],
    },
    shop: {
      list: [],
      staples: [
        staple('Milk', 'Dairy & Eggs'), staple('Eggs', 'Dairy & Eggs'), staple('Bread', 'Bakery'),
        staple('Bananas', 'Produce'), staple('Coffee', 'Pantry'), staple('Rice', 'Pantry'),
        staple('Paper towels', 'Household', 'household'), staple('Toilet paper', 'Household', 'household'),
        staple('Dish soap', 'Household', 'household'), staple('Laundry detergent', 'Household', 'household'),
        staple('Trash bags', 'Household', 'household'), staple('Toothpaste', 'Personal Care', 'household'),
      ],
    },
    events: [],
    people: [],
    gifts: [],
    meals: {},
    chores: [],
    settings: { currency: 'USD', theme: 'auto', showHolidays: true, giftBudget: 0, welcomeDismissed: false },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Could not load saved data', e);
    return defaultState();
  }
}

// Fill in any keys added in later versions so older saves keep working.
function migrate(s) {
  const d = defaultState();
  s.members ??= d.members;
  s.budget ??= d.budget;
  s.budget.categories ??= d.budget.categories;
  s.budget.transactions ??= [];
  s.budget.bills ??= [];
  s.shop ??= d.shop;
  s.shop.list ??= [];
  s.shop.staples ??= [];
  s.events ??= [];
  s.people ??= [];
  s.gifts ??= [];
  s.meals ??= {};
  s.chores ??= [];
  s.settings = { ...d.settings, ...(s.settings || {}) };
  s.version = 1;
  return s;
}

let state = load();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ Could not save — storage may be full'); }
  }, 120);
}
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); localStorage.setItem(STORE_KEY, JSON.stringify(state)); });

// Ask the browser not to evict our data.
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

/* UI-only state (not saved) */
const ui = {
  budgetMonth: monthKey(today()),
  budgetTab: 'overview',
  shopTab: 'list',
  calMonth: monthKey(today()),
  calSel: today(),
  mealsWeek: weekStart(today()),
};

/* =========================================================
   Lookups
   ========================================================= */
const EVERYONE = { id: '', name: 'Everyone', emoji: '👨‍👩‍👧‍👦', color: 'var(--accent)' };
const member = (id) => state.members.find((m) => m.id === id) || EVERYONE;
const category = (id) => state.budget.categories.find((c) => c.id === id) || { emoji: '📦', name: 'Uncategorized', limit: 0 };
const person = (id) => state.people.find((p) => p.id === id);
const memberOptions = (withEveryone = true) => [
  ...(withEveryone ? [{ value: '', label: '👨‍👩‍👧‍👦 Everyone' }] : []),
  ...state.members.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` })),
];
const avatar = (m, sm) => `<div class="avatar${sm ? ' sm' : ''}" style="background:color-mix(in srgb, ${m.color} 22%, transparent)">${esc(m.emoji)}</div>`;

/* =========================================================
   Calendar logic: recurring events, birthdays, holidays
   ========================================================= */
function occursOn(ev, s) {
  if (!ev.date || s < ev.date) return false;
  if (ev.until && s > ev.until) return false;
  switch (ev.repeat) {
    case 'daily': return true;
    case 'weekly': return daysBetween(ev.date, s) % 7 === 0;
    case 'biweekly': return daysBetween(ev.date, s) % 14 === 0;
    case 'monthly': return parse(s).getDate() === parse(ev.date).getDate();
    case 'yearly': return s.slice(5) === ev.date.slice(5);
    default: return s === ev.date;
  }
}

const nthWeekday = (y, m, wd, n) => { // n = -1 for last
  if (n > 0) { const d = new Date(y, m, 1); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + (n - 1) * 7); return iso(d); }
  const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7)); return iso(d);
};
const easter = (y) => { // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(y, month - 1, day));
};
const holidayCache = {};
function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const h = {
    [`${y}-01-01`]: "🎉 New Year's Day",
    [`${y}-02-14`]: "💘 Valentine's Day",
    [easter(y)]: '🐣 Easter',
    [nthWeekday(y, 4, 0, 2)]: "💐 Mother's Day",
    [nthWeekday(y, 4, 1, -1)]: '🇺🇸 Memorial Day',
    [nthWeekday(y, 5, 0, 3)]: "👔 Father's Day",
    [`${y}-07-04`]: '🎆 Independence Day',
    [nthWeekday(y, 8, 1, 1)]: '🛠️ Labor Day',
    [`${y}-10-31`]: '🎃 Halloween',
    [nthWeekday(y, 10, 4, 4)]: '🦃 Thanksgiving',
    [`${y}-12-24`]: '🎄 Christmas Eve',
    [`${y}-12-25`]: '🎄 Christmas',
    [`${y}-12-31`]: "🥂 New Year's Eve",
  };
  return (holidayCache[y] = h);
}

function eventsOn(s) {
  const out = [];
  for (const ev of state.events) {
    if (occursOn(ev, s)) {
      const m = member(ev.memberId);
      out.push({ kind: 'event', id: ev.id, title: ev.title, time: ev.time || '', end: ev.endTime || '', color: m.color, who: m, notes: ev.notes, location: ev.location });
    }
  }
  for (const p of state.people) {
    if (p.birthday && p.birthday.slice(5) === s.slice(5) && s >= p.birthday) {
      const age = parse(s).getFullYear() - parse(p.birthday).getFullYear();
      const showAge = p.birthday.slice(0, 4) !== '1900';
      out.push({ kind: 'birthday', id: p.id, title: `🎂 ${p.name}'s birthday${showAge && age > 0 ? ` (${age})` : ''}`, time: '', color: '#d6457e', who: EVERYONE });
    }
  }
  for (const b of state.budget.bills) {
    if (b.showOnCalendar && b.dueDay && billDueDate(b, monthKey(s)) === s) {
      out.push({ kind: 'bill', id: b.id, title: `💳 ${b.name} due · ${money(b.amount)}`, time: '', color: '#e0a800', who: EVERYONE });
    }
  }
  if (state.settings.showHolidays) {
    const h = holidays(parse(s).getFullYear())[s];
    if (h) out.push({ kind: 'holiday', id: '', title: h, time: '', color: '#6b7280', who: EVERYONE });
  }
  return out.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function nextOccurrence(ev, from = today(), horizon = 400) {
  for (let i = 0; i <= horizon; i++) { const s = addDays(from, i); if (occursOn(ev, s)) return s; }
  return null;
}
function nextBirthday(p, from = today()) {
  if (!p.birthday) return null;
  const y = parse(from).getFullYear();
  let s = `${y}-${p.birthday.slice(5)}`;
  if (s < from) s = `${y + 1}-${p.birthday.slice(5)}`;
  return s;
}

/* =========================================================
   Budget logic
   ========================================================= */
const monthTx = (ym) => state.budget.transactions.filter((t) => t.date.startsWith(ym));
const billDueDate = (b, ym) => {
  const last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  return `${ym}-${pad(Math.min(b.dueDay, last))}`;
};
const billPaid = (b, ym) => !!(b.paid && b.paid[ym]);

function budgetSummary(ym) {
  const tx = monthTx(ym);
  const spent = sum(tx.filter((t) => t.type !== 'income'), (t) => t.amount);
  const income = sum(tx.filter((t) => t.type === 'income'), (t) => t.amount);
  const limit = sum(state.budget.categories, (c) => c.limit);
  return { tx, spent, income, limit, left: limit - spent };
}
const levelCls = (frac) => (frac >= 1 ? 'bad' : frac >= 0.85 ? 'warn' : '');

/* =========================================================
   Shopping logic
   ========================================================= */
function stapleByName(name) { return state.shop.staples.find((s) => norm(s.name) === norm(name)); }
function addToList(name, qty = '', silent = false) {
  name = String(name || '').trim();
  if (!name) return false;
  const existing = state.shop.list.find((i) => !i.done && norm(i.name) === norm(name));
  if (existing) { if (!silent) toast(`${name} is already on the list`); return false; }
  const st = stapleByName(name);
  state.shop.list.unshift({ id: uid(), name: st ? st.name : name, qty, aisle: st ? st.aisle : guessAisle(name), done: false, added: today() });
  return true;
}
const AISLE_HINTS = {
  'Produce': /\b(?:apple|banana|lettuce|tomato|onion|potato|avocado|lime|lemon|berr|grape|carrot|pepper|cilantro|spinach|fruit|veg|garlic|celery|cucumber|orange|salad|jalape)/,
  'Dairy & Eggs': /\b(?:milk|egg|cheese|yogurt|butter|cream|queso)/,
  'Meat & Seafood': /\b(?:chicken|beef|pork|steak|turkey|bacon|sausage|fish|salmon|shrimp|ground|ham|carne)/,
  'Bakery': /\b(?:bread|bagel|tortilla|bun|roll|muffin|cake)/,
  'Frozen': /\b(?:frozen|ice cream|pizza)/,
  'Snacks & Drinks': /\b(?:chip|cookie|cracker|soda|juice|water|snack|candy|beer|wine)/,
  'Household': /\b(?:paper|towel|toilet|soap|detergent|trash|bag|foil|wrap|clean|bleach|sponge|battery|bulb)/,
  'Personal Care': /\b(?:shampoo|toothpaste|toothbrush|deodorant|lotion|razor|floss|tylenol|medicine|vitamin)/,
  'Baby & Kids': /\b(?:diaper|wipe|formula|baby)/,
  'Pets': /\b(?:dog|cat|pet|litter)/,
  'Pantry': /\b(?:rice|bean|pasta|flour|sugar|oil|sauce|cereal|coffee|tea|spice|salt|can|soup|peanut)/,
};
function guessAisle(name) {
  const n = norm(name);
  for (const [aisle, re] of Object.entries(AISLE_HINTS)) if (re.test(n)) return aisle;
  return 'Other';
}

/* =========================================================
   Chores logic
   ========================================================= */
function choreDone(c, s = today()) {
  const log = c.log || [];
  if (c.freq === 'daily') return log.some((l) => l.date === s);
  if (c.freq === 'weekly') return log.some((l) => l.date >= weekStart(s) && l.date <= s);
  return log.length > 0;
}
function weekPoints(from = weekStart(today())) {
  const pts = {};
  for (const c of state.chores) for (const l of c.log || []) {
    if (l.date >= from && l.memberId) pts[l.memberId] = (pts[l.memberId] || 0) + (Number(c.points) || 1);
  }
  return pts;
}

/* =========================================================
   Views
   ========================================================= */
const TABS = ['home', 'budget', 'shop', 'calendar', 'gifts'];
const TITLES = { home: 'Home', budget: 'Budget', shop: 'Shopping', calendar: 'Calendar', gifts: 'Gifts', person: 'Gifts', meals: 'Meal Plan', chores: 'Chores', settings: 'Settings' };

const views = {};

/* ---------- Home ---------- */
views.home = () => {
  const t = today();
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning ☀️' : hr < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
  const todays = eventsOn(t);
  const sumry = budgetSummary(monthKey(t));
  const listCount = state.shop.list.filter((i) => !i.done).length;
  const lowCount = state.shop.staples.filter((s) => s.status !== 'ok').length;
  const dinner = state.meals[t]?.dinner;
  const choresDue = state.chores.filter((c) => !choreDone(c));
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  // Countdowns: flagged events + next 3 birthdays within 60 days
  const countdowns = state.events
    .filter((e) => e.countdown)
    .map((e) => ({ title: e.title, date: nextOccurrence(e) }))
    .filter((c) => c.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Upcoming week
  const upcoming = [];
  for (let i = 1; i <= 7; i++) {
    const s = addDays(t, i);
    for (const e of eventsOn(s)) upcoming.push({ ...e, date: s });
  }

  // Bills due within 7 days & unpaid
  const ym = monthKey(t);
  const billsDue = state.budget.bills
    .map((b) => ({ b, due: billDueDate(b, ym) }))
    .filter(({ b, due }) => !billPaid(b, ym) && daysBetween(t, due) <= 7)
    .sort((a, b) => a.due.localeCompare(b.due));

  // Birthdays within 45 days
  const bdays = state.people
    .map((p) => ({ p, date: nextBirthday(p) }))
    .filter((x) => x.date && daysBetween(t, x.date) <= 45)
    .sort((a, b) => a.date.localeCompare(b.date));

  const frac = sumry.limit ? sumry.spent / sumry.limit : 0;

  return `
    <p class="hello">${greet} · ${fmtDate(t, { weekday: 'long', month: 'long', day: 'numeric' })}</p>

    ${!state.settings.welcomeDismissed && state.members.length < 2 ? `
      <div class="card install-tip">
        <h3>👋 Welcome to your family hub</h3>
        <p class="small" style="margin:4px 0 10px">Start by adding your family in <b>Settings</b> so you can assign events and chores.
        ${!standalone ? ' To put this on your iPhone home screen: open in <b>Safari</b>, tap <b>Share</b> → <b>Add to Home Screen</b>.' : ''}</p>
        <div class="btn-row" style="margin:0">
          <button class="btn" data-action="go" data-to="settings">Add family</button>
          <button class="btn secondary" data-action="dismiss-welcome">Got it</button>
        </div>
      </div>` : ''}

    ${countdowns.length ? `<div class="countdown">${countdowns.map((c) => {
      const n = daysBetween(t, c.date);
      return `<div class="card"><div class="days">${n === 0 ? '🎉' : n}</div><div class="small muted">${n === 0 ? 'Today!' : n === 1 ? 'day until' : 'days until'}</div><div class="small" style="font-weight:650;margin-top:2px">${esc(c.title)}</div></div>`;
    }).join('')}</div>` : ''}

    <div class="grid2">
      <button class="card tile" data-action="go" data-to="budget">
        <div class="stat-label">Left this month</div>
        <div class="stat" style="color:${sumry.left < 0 ? 'var(--bad)' : 'inherit'}">${money(sumry.left, { maximumFractionDigits: 0 })}</div>
        <div class="bar"><i class="${levelCls(frac)}" style="width:${Math.min(100, frac * 100)}%"></i></div>
      </button>
      <button class="card tile" data-action="go" data-to="shop">
        <div class="stat-label">Shopping list</div>
        <div class="stat">${listCount} <span class="small muted" style="font-weight:500">items</span></div>
        <div class="small ${lowCount ? '' : 'muted'}" style="${lowCount ? 'color:var(--warn);font-weight:600' : ''}">${lowCount ? `${lowCount} staple${lowCount > 1 ? 's' : ''} running low` : 'Staples stocked ✓'}</div>
      </button>
    </div>

    <div class="section-title">Today<button data-action="add-event" data-date="${t}">+ Event</button></div>
    <div class="card flush">
      ${todays.length ? todays.map(eventRow).join('') : `<div class="empty small">Nothing on the calendar today.</div>`}
      <button class="row tap" style="width:100%;text-align:left" data-action="edit-meal" data-date="${t}">
        <div class="avatar">🍽️</div>
        <div class="grow"><div class="title">${dinner ? esc(dinner) : 'What\'s for dinner?'}</div><div class="sub">${dinner ? 'Tonight\'s dinner' : 'Tap to plan tonight'}</div></div>${ICON.chev}
      </button>
    </div>

    ${billsDue.length ? `
      <div class="section-title">Bills due soon<button data-action="go" data-to="budget" data-btab="bills">All bills</button></div>
      <div class="card flush">${billsDue.map(({ b, due }) => {
        const n = daysBetween(t, due);
        return `<div class="row"><div class="avatar">💳</div><div class="grow"><div class="title">${esc(b.name)}</div><div class="sub" style="${n < 0 ? 'color:var(--bad)' : ''}">${n < 0 ? 'Overdue · ' : ''}${relDays(n)} · ${fmtDate(due)}</div></div><span class="amount">${money(b.amount)}</span><button class="mini-btn" data-action="pay-bill" data-id="${b.id}">Paid</button></div>`;
      }).join('')}</div>` : ''}

    ${choresDue.length ? `
      <div class="section-title">Chores to do<button data-action="go" data-to="chores">All chores</button></div>
      <div class="card flush">${choresDue.slice(0, 4).map(choreRow).join('')}</div>` : ''}

    ${bdays.length ? `
      <div class="section-title">Birthdays coming up<button data-action="go" data-to="gifts">Gifts</button></div>
      <div class="card flush">${bdays.map(({ p, date }) => {
        const gifts = state.gifts.filter((g) => g.personId === p.id && g.occasion === 'Birthday' && Number(g.year) === parse(date).getFullYear());
        const ready = gifts.some((g) => g.status !== 'idea');
        return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="person/${p.id}">
          <div class="avatar">${esc(p.emoji || '🎂')}</div>
          <div class="grow"><div class="title">${esc(p.name)}</div><div class="sub">${relDays(daysBetween(t, date))} · ${fmtDate(date, { month: 'short', day: 'numeric' })}</div></div>
          <span class="pill ${ready ? 'good' : gifts.length ? 'warn' : 'bad'}">${ready ? 'Gift ready' : gifts.length ? 'Ideas only' : 'No gift yet'}</span>
        </button>`;
      }).join('')}</div>` : ''}

    ${upcoming.length ? `
      <div class="section-title">Next 7 days<button data-action="go" data-to="calendar">Calendar</button></div>
      <div class="card flush">${upcoming.slice(0, 8).map((e) => eventRow(e, true)).join('')}</div>` : ''}

    <div class="section-title">More</div>
    <div class="grid2">
      <button class="card tile" data-action="go" data-to="meals"><div class="emoji">🍽️</div><b>Meal plan</b><div class="small muted">Plan the week's dinners</div></button>
      <button class="card tile" data-action="go" data-to="chores"><div class="emoji">🧹</div><b>Chores</b><div class="small muted">${choresDue.length ? `${choresDue.length} to do` : 'All caught up'}</div></button>
    </div>
  `;
};

function eventRow(e, showDate) {
  const clickable = e.kind === 'event' || e.kind === 'birthday' || e.kind === 'bill';
  const action = e.kind === 'event' ? `data-action="edit-event" data-id="${e.id}"`
    : e.kind === 'birthday' ? `data-action="go" data-to="person/${e.id}"`
    : e.kind === 'bill' ? `data-action="edit-bill" data-id="${e.id}"` : '';
  const timeLabel = e.time ? fmtTime(e.time) : (e.kind === 'holiday' ? 'Holiday' : 'All day');
  return `<${clickable ? 'button' : 'div'} class="row${clickable ? ' tap' : ''}" style="width:100%;text-align:left" ${action}>
    <div class="time-col">${showDate ? fmtDate(e.date, { weekday: 'short', day: 'numeric' }) : timeLabel}</div>
    <div class="dot" style="background:${e.color}"></div>
    <div class="grow"><div class="title">${esc(e.title)}</div>
      <div class="sub">${[showDate ? timeLabel : '', e.who && e.who.id ? `${esc(e.who.emoji)} ${esc(e.who.name)}` : '', e.location ? `📍 ${esc(e.location)}` : ''].filter(Boolean).join(' · ')}</div>
    </div>
  </${clickable ? 'button' : 'div'}>`;
}

/* ---------- Budget ---------- */
views.budget = () => {
  const ym = ui.budgetMonth;
  const s = budgetSummary(ym);
  const C = 2 * Math.PI * 42;
  const frac = s.limit ? Math.min(1, s.spent / s.limit) : 0;
  const tab = ui.budgetTab;

  let body = '';
  if (tab === 'overview') {
    body = `
      <div class="card">
        <div class="ring-wrap">
          <div class="ring"><svg viewBox="0 0 96 96"><circle class="track" cx="48" cy="48" r="42"/><circle class="val ${levelCls(s.limit ? s.spent / s.limit : 0)}" cx="48" cy="48" r="42" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}" stroke-linecap="round"/></svg></div>
          <div class="grow" style="flex:1">
            <div class="kv"><span class="muted">Budget</span><b>${money(s.limit)}</b></div>
            <div class="kv"><span class="muted">Spent</span><b>${money(s.spent)}</b></div>
            <div class="kv"><span class="muted">Left</span><b style="color:${s.left < 0 ? 'var(--bad)' : 'var(--good)'}">${money(s.left)}</b></div>
            ${s.income ? `<div class="kv"><span class="muted">Income</span><b>${money(s.income)}</b></div>` : ''}
          </div>
        </div>
      </div>
      <div class="section-title">Categories<button data-action="add-category">+ Category</button></div>
      <div class="card">
        ${state.budget.categories.map((c) => {
          const spent = sum(s.tx.filter((t) => t.type !== 'income' && t.categoryId === c.id), (t) => t.amount);
          const f = c.limit ? spent / c.limit : 0;
          return `<button class="cat-row" style="display:block;width:100%;text-align:left" data-action="edit-category" data-id="${c.id}">
            <div class="top"><span>${esc(c.emoji)} ${esc(c.name)}</span><span>${money(spent, { maximumFractionDigits: 0 })}${c.limit ? ` / ${money(c.limit, { maximumFractionDigits: 0 })}` : ''}</span></div>
            ${c.limit ? `<div class="bar"><i class="${levelCls(f)}" style="width:${Math.min(100, f * 100)}%"></i></div>` : ''}
          </button>`;
        }).join('') || '<div class="empty small">No categories yet.</div>'}
      </div>`;
  } else if (tab === 'activity') {
    const byDate = {};
    for (const t of [...s.tx].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0))) (byDate[t.date] ||= []).push(t);
    body = Object.keys(byDate).length ? Object.entries(byDate).map(([d, list]) => `
      <div class="section-title"><span>${fmtDate(d)}</span><span class="small" style="text-transform:none">${money(sum(list.filter((t) => t.type !== 'income'), (t) => t.amount))}</span></div>
      <div class="card flush">${list.map((t) => {
        const c = category(t.categoryId);
        const m = t.memberId ? member(t.memberId) : null;
        return `<button class="row tap" style="width:100%;text-align:left" data-action="edit-tx" data-id="${t.id}">
          <div class="avatar">${t.type === 'income' ? '💰' : esc(c.emoji)}</div>
          <div class="grow"><div class="title">${esc(t.note || (t.type === 'income' ? 'Income' : c.name))}</div><div class="sub">${t.type === 'income' ? 'Income' : esc(c.name)}${m ? ` · ${esc(m.emoji)} ${esc(m.name)}` : ''}</div></div>
          <span class="amount ${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span>
        </button>`;
      }).join('')}</div>`).join('')
      : `<div class="card empty"><span class="big">🧾</span>No spending logged for ${fmtMonth(ym)}.<br>Tap + to add an expense.</div>`;
  } else {
    const bills = [...state.budget.bills].sort((a, b) => a.dueDay - b.dueDay);
    const total = sum(bills, (b) => b.amount);
    const paid = sum(bills.filter((b) => billPaid(b, ym)), (b) => b.amount);
    body = `
      <div class="card">
        <div class="kv"><span class="muted">Monthly bills</span><b>${money(total)}</b></div>
        <div class="kv"><span class="muted">Paid in ${parse(ym + '-01').toLocaleDateString(undefined, { month: 'long' })}</span><b style="color:var(--good)">${money(paid)}</b></div>
        <div class="kv"><span class="muted">Still to pay</span><b>${money(total - paid)}</b></div>
        <div class="bar"><i style="width:${total ? (paid / total) * 100 : 0}%"></i></div>
      </div>
      <div class="card flush">
        ${bills.map((b) => {
          const isPaid = billPaid(b, ym);
          const due = billDueDate(b, ym);
          const n = daysBetween(today(), due);
          return `<div class="row${isPaid ? ' done' : ''}">
            <button class="check${isPaid ? ' on' : ''}" data-action="toggle-bill" data-id="${b.id}" aria-label="Mark paid">${ICON.check}</button>
            <button class="grow" style="text-align:left" data-action="edit-bill" data-id="${b.id}">
              <div class="title">${esc(b.name)}</div>
              <div class="sub">Due the ${ordinal(b.dueDay)}${!isPaid && monthKey(today()) === ym ? ` · <span style="color:${n < 0 ? 'var(--bad)' : n <= 3 ? 'var(--warn)' : 'inherit'}">${relDays(n)}</span>` : ''}${b.autopay ? ' · Autopay' : ''}</div>
            </button>
            <span class="amount">${money(b.amount)}</span>
          </div>`;
        }).join('') || `<div class="empty"><span class="big">💳</span>Add rent, utilities, phone, subscriptions…<br>Check them off each month as you pay.</div>`}
      </div>`;
  }

  return `
    <div class="month-nav">
      <button class="icon-btn" data-action="budget-month" data-n="-1" aria-label="Previous month">${ICON.left}</button>
      <h2>${fmtMonth(ym)}</h2>
      <button class="icon-btn" data-action="budget-month" data-n="1" aria-label="Next month">${ICON.right}</button>
    </div>
    <div class="segmented">
      ${[['overview', 'Overview'], ['activity', 'Activity'], ['bills', 'Bills']].map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="budget-tab" data-tab="${k}">${l}</button>`).join('')}
    </div>
    ${body}
    <button class="fab" data-action="${tab === 'bills' ? 'add-bill' : 'add-tx'}" aria-label="Add">${ICON.plus}</button>
  `;
};
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

/* ---------- Shopping ---------- */
views.shop = () => {
  const tab = ui.shopTab;
  let body = '';
  if (tab === 'list') {
    const open = state.shop.list.filter((i) => !i.done);
    const done = state.shop.list.filter((i) => i.done);
    const onList = new Set(open.map((i) => norm(i.name)));
    const suggestions = state.shop.staples.filter((s) => s.status !== 'ok' && !onList.has(norm(s.name)));
    const groups = {};
    for (const i of open) (groups[i.aisle || 'Other'] ||= []).push(i);
    const order = Object.keys(groups).sort((a, b) => AISLES.indexOf(a) - AISLES.indexOf(b));
    const est = sum(open, (i) => stapleByName(i.name)?.price);

    body = `
      <form class="quick-add" data-submit="shop-add">
        <input type="text" name="newItem" placeholder="Add an item… (e.g. 2 lb chicken)" enterkeyhint="done" autocomplete="off" list="stapleNames">
        <button class="btn" type="submit" aria-label="Add">${ICON.plus}</button>
      </form>
      <datalist id="stapleNames">${state.shop.staples.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>

      ${suggestions.length ? `<div class="small muted" style="margin:0 4px 6px">Running low — tap to add:</div>
        <div class="chips">${suggestions.map((s) => `<button class="chip" data-action="staple-to-list" data-id="${s.id}">+ ${esc(s.name)}</button>`).join('')}</div>` : ''}

      ${open.length ? order.map((a) => `
        <div class="section-title">${esc(a)}</div>
        <div class="card flush">${groups[a].map(shopRow).join('')}</div>`).join('')
        : `<div class="card empty"><span class="big">🛒</span>The list is empty.<br>Add items above or from your staples.</div>`}

      ${open.length ? `<div class="btn-row">
        <button class="btn secondary" data-action="share-list">📤 Share list</button>
        ${est ? `<div class="btn secondary" style="pointer-events:none">≈ ${money(est)}</div>` : ''}
      </div>` : ''}

      ${done.length ? `
        <div class="section-title">In the cart (${done.length})<button data-action="clear-done">Clear &amp; restock</button></div>
        <div class="card flush">${done.map(shopRow).join('')}</div>` : ''}
    `;
  } else {
    const kinds = [['grocery', '🥑 Groceries'], ['household', '🧻 Household']];
    const needCount = state.shop.staples.filter((s) => s.status !== 'ok').length;
    body = `
      <p class="small muted" style="margin:0 4px 12px">The things your family always buys. Tap the status to mark something low or out, then add it to the list in one tap.</p>
      ${needCount ? `<button class="btn block" style="margin-bottom:12px" data-action="add-low-to-list">Add ${needCount} low/out item${needCount > 1 ? 's' : ''} to list</button>` : ''}
      ${kinds.map(([k, label]) => {
        const items = state.shop.staples.filter((s) => (s.kind || 'grocery') === k).sort((a, b) => STAPLE_STATUS.indexOf(b.status) - STAPLE_STATUS.indexOf(a.status) || a.name.localeCompare(b.name));
        return `<div class="section-title">${label}</div>
          <div class="card flush">${items.map((s) => {
            const since = s.lastBought ? daysBetween(s.lastBought, today()) : null;
            const sub = [s.aisle, s.store, s.price ? money(s.price) : '', since != null ? `bought ${relDays(-since).toLowerCase()}` : ''].filter(Boolean).join(' · ');
            return `<div class="row">
              <button class="grow" style="text-align:left" data-action="edit-staple" data-id="${s.id}"><div class="title">${esc(s.name)}</div><div class="sub">${esc(sub)}</div></button>
              <button class="pill ${STAPLE_CLS[s.status]}" data-action="cycle-staple" data-id="${s.id}">${STAPLE_LABEL[s.status]}</button>
              <button class="mini-btn" data-action="staple-to-list" data-id="${s.id}" aria-label="Add to list">+ List</button>
            </div>`;
          }).join('') || '<div class="empty small">None yet — tap + to add.</div>'}</div>`;
      }).join('')}
      <button class="fab" data-action="add-staple" aria-label="Add staple">${ICON.plus}</button>
    `;
  }
  return `
    <div class="segmented">
      <button class="${tab === 'list' ? 'active' : ''}" data-action="shop-tab" data-tab="list">Shopping list</button>
      <button class="${tab === 'staples' ? 'active' : ''}" data-action="shop-tab" data-tab="staples">Staples</button>
    </div>
    ${body}
  `;
};
const shopRow = (i) => `<div class="row${i.done ? ' done' : ''}">
  <button class="check${i.done ? ' on' : ''}" data-action="toggle-item" data-id="${i.id}" aria-label="Got it">${ICON.check}</button>
  <button class="grow" style="text-align:left" data-action="edit-item" data-id="${i.id}"><div class="title">${esc(i.name)}</div>${i.qty ? `<div class="sub">${esc(i.qty)}</div>` : ''}</button>
  <button class="del-btn" data-action="del-item" data-id="${i.id}" aria-label="Remove">${ICON.x}</button>
</div>`;

/* ---------- Calendar ---------- */
views.calendar = () => {
  const ym = ui.calMonth;
  const first = parse(ym + '-01');
  const start = addDays(iso(first), -((first.getDay() + 6) % 7)); // grid starts Monday
  const t = today();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const s = addDays(start, i);
    if (i === 35 && s.slice(0, 7) !== ym) break; // drop empty 6th row
    const evs = eventsOn(s);
    cells.push(`<button class="cal-day${s.slice(0, 7) !== ym ? ' other' : ''}${s === t ? ' today' : ''}${s === ui.calSel ? ' sel' : ''}" data-action="cal-select" data-date="${s}">
      <span>${parse(s).getDate()}</span>
      <div class="dots">${evs.slice(0, 3).map((e) => `<i style="background:${e.color}"></i>`).join('')}</div>
    </button>`);
  }
  const sel = eventsOn(ui.calSel);
  return `
    <div class="month-nav">
      <button class="icon-btn" data-action="cal-month" data-n="-1" aria-label="Previous month">${ICON.left}</button>
      <h2>${fmtMonth(ym)}</h2>
      <button class="icon-btn" data-action="cal-month" data-n="1" aria-label="Next month">${ICON.right}</button>
    </div>
    <div class="card cal">
      <div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
    </div>
    ${state.members.length > 1 ? `<div class="legend">${state.members.map((m) => `<span><i class="dot" style="background:${m.color}"></i>${esc(m.name)}</span>`).join('')}</div>` : ''}
    <div class="section-title">${ui.calSel === t ? 'Today' : fmtDate(ui.calSel, { weekday: 'long', month: 'long', day: 'numeric' })}
      ${ui.calSel !== t ? '<button data-action="cal-today">Today</button>' : ''}</div>
    <div class="card flush">${sel.length ? sel.map((e) => eventRow(e)).join('') : '<div class="empty small">No events. Tap + to add one.</div>'}</div>
    <button class="fab" data-action="add-event" data-date="${ui.calSel}" aria-label="Add event">${ICON.plus}</button>
  `;
};

/* ---------- Gifts ---------- */
views.gifts = () => {
  const t = today();
  const y = parse(t).getFullYear();
  const yearGifts = state.gifts.filter((g) => Number(g.year) === y);
  const spent = sum(yearGifts.filter((g) => g.status !== 'idea'), (g) => g.price);
  const planned = sum(yearGifts, (g) => g.price);
  const budget = Number(state.settings.giftBudget) || 0;
  const xmas = daysBetween(t, `${t > `${y}-12-25` ? y + 1 : y}-12-25`);
  const people = state.people
    .map((p) => ({ p, next: nextBirthday(p) }))
    .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999') || a.p.name.localeCompare(b.p.name));

  return `
    <div class="grid2">
      <button class="card tile" data-action="edit-gift-budget">
        <div class="stat-label">${y} gifts bought</div>
        <div class="stat">${money(spent, { maximumFractionDigits: 0 })}</div>
        <div class="small muted">${budget ? `of ${money(budget, { maximumFractionDigits: 0 })} budget` : `${money(planned, { maximumFractionDigits: 0 })} planned · set budget`}</div>
        ${budget ? `<div class="bar"><i class="${levelCls(spent / budget)}" style="width:${Math.min(100, (spent / budget) * 100)}%"></i></div>` : ''}
      </button>
      <div class="card">
        <div class="stat-label">Christmas</div>
        <div class="stat">🎄 ${xmas}</div>
        <div class="small muted">days to go</div>
      </div>
    </div>

    <div class="section-title">Family &amp; friends<button data-action="add-person">+ Person</button></div>
    <div class="card flush">
      ${people.map(({ p, next }) => {
        const gifts = state.gifts.filter((g) => g.personId === p.id && Number(g.year) === y);
        const ideas = gifts.filter((g) => g.status === 'idea').length;
        const got = gifts.length - ideas;
        const n = next ? daysBetween(t, next) : null;
        return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="person/${p.id}">
          <div class="avatar">${esc(p.emoji || '🙂')}</div>
          <div class="grow"><div class="title">${esc(p.name)}</div>
            <div class="sub">${[p.relationship, n != null ? `🎂 ${relDays(n)}` : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
          ${got ? `<span class="pill good">${got} 🎁</span>` : ''}${ideas ? `<span class="pill">${ideas} 💡</span>` : ''}
          ${ICON.chev}
        </button>`;
      }).join('') || `<div class="empty"><span class="big">🎁</span>Add the people you buy for.<br>Track birthdays, sizes, wish lists and gift ideas.</div>`}
    </div>
    <button class="fab" data-action="add-person" aria-label="Add person">${ICON.plus}</button>
  `;
};

views.person = (id) => {
  const p = person(id);
  if (!p) return `<div class="card empty">This person was removed.</div>`;
  const t = today();
  const next = nextBirthday(p);
  const turning = next && p.birthday.slice(0, 4) !== '1900' ? parse(next).getFullYear() - parse(p.birthday).getFullYear() : null;
  const gifts = state.gifts.filter((g) => g.personId === id).sort((a, b) => (b.year - a.year) || GIFT_STATUS.indexOf(a.status) - GIFT_STATUS.indexOf(b.status));
  const byYear = {};
  for (const g of gifts) (byYear[g.year] ||= []).push(g);
  return `
    <div class="card" style="display:flex;gap:14px;align-items:center">
      <div class="avatar" style="width:60px;height:60px;flex-basis:60px;font-size:32px">${esc(p.emoji || '🙂')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:22px;font-weight:750">${esc(p.name)}</div>
        <div class="small muted">${[p.relationship, next ? `🎂 ${fmtDate(next, { month: 'long', day: 'numeric' })} (${relDays(daysBetween(t, next))})${turning ? ` · turning ${turning}` : ''}` : ''].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
      <button class="mini-btn" data-action="edit-person" data-id="${p.id}">Edit</button>
    </div>
    ${p.likes || p.sizes || p.notes ? `<div class="card">
      ${p.likes ? `<h3>Likes &amp; wish list</h3><p style="margin:0 0 10px;white-space:pre-wrap">${esc(p.likes)}</p>` : ''}
      ${p.sizes ? `<h3>Sizes</h3><p style="margin:0 0 10px;white-space:pre-wrap">${esc(p.sizes)}</p>` : ''}
      ${p.notes ? `<h3>Notes</h3><p style="margin:0;white-space:pre-wrap">${esc(p.notes)}</p>` : ''}
    </div>` : ''}
    <div class="section-title">Gifts<button data-action="add-gift" data-person="${p.id}">+ Gift</button></div>
    ${Object.keys(byYear).sort((a, b) => b - a).map((yr) => `
      <div class="small muted" style="margin:10px 4px 6px;font-weight:700">${yr} · ${money(sum(byYear[yr], (g) => g.price))}</div>
      <div class="card flush">${byYear[yr].map((g) => `<div class="row">
        <button class="grow" style="text-align:left" data-action="edit-gift" data-id="${g.id}">
          <div class="title">${esc(g.idea)}</div>
          <div class="sub">${[g.occasion, g.price ? money(g.price) : '', g.store].filter(Boolean).map(esc).join(' · ')}</div>
        </button>
        ${g.link ? `<a class="mini-btn" href="${esc(safeUrl(g.link))}" target="_blank" rel="noopener">Link</a>` : ''}
        <button class="pill ${GIFT_STATUS_CLS[g.status]}" data-action="cycle-gift" data-id="${g.id}">${cap(g.status)}</button>
      </div>`).join('')}</div>`).join('') || `<div class="card empty"><span class="big">💡</span>No gift ideas yet.<br>Jot them down whenever inspiration strikes.</div>`}
    <button class="fab" data-action="add-gift" data-person="${p.id}" aria-label="Add gift">${ICON.plus}</button>
  `;
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u);

/* ---------- Meals ---------- */
views.meals = () => {
  const ws = ui.mealsWeek;
  const t = today();
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const planned = days.filter((d) => state.meals[d]?.dinner).length;
  const ingredients = days.flatMap((d) => splitList(state.meals[d]?.ingredients));
  return `
    <div class="month-nav">
      <button class="icon-btn" data-action="meals-week" data-n="-7" aria-label="Previous week">${ICON.left}</button>
      <h2>${ws === weekStart(t) ? 'This week' : `Week of ${fmtDate(ws, { month: 'short', day: 'numeric' })}`}</h2>
      <button class="icon-btn" data-action="meals-week" data-n="7" aria-label="Next week">${ICON.right}</button>
    </div>
    <div class="card flush">
      ${days.map((d) => {
        const m = state.meals[d] || {};
        return `<button class="row tap meal-day${d === t ? ' today' : ''}" style="width:100%;text-align:left" data-action="edit-meal" data-date="${d}">
          <div class="day-label">${fmtDate(d, { weekday: 'short' })}<br><span style="font-size:17px;color:var(--text)">${parse(d).getDate()}</span></div>
          <div class="grow">
            <div class="title" style="${m.dinner ? '' : 'color:var(--muted);font-weight:500'}">${m.dinner ? esc(m.dinner) : 'Plan dinner…'}</div>
            ${m.ingredients ? `<div class="sub">${esc(splitList(m.ingredients).join(', '))}</div>` : m.notes ? `<div class="sub">${esc(m.notes)}</div>` : ''}
          </div>${ICON.chev}
        </button>`;
      }).join('')}
    </div>
    <div class="btn-row">
      ${ingredients.length ? `<button class="btn" data-action="week-to-list">🛒 Add week's ingredients to list</button>` : ''}
    </div>
    <p class="small muted" style="margin:0 4px">${planned}/7 dinners planned. Meals you've made before autocomplete with their ingredients.</p>
  `;
};
const splitList = (s) => String(s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
function mealHistory() {
  const byName = {};
  for (const [d, m] of Object.entries(state.meals)) {
    if (!m.dinner) continue;
    const k = norm(m.dinner);
    if (!byName[k] || d > byName[k].date) byName[k] = { name: m.dinner, ingredients: m.ingredients || '', date: d };
  }
  return Object.values(byName);
}

/* ---------- Chores ---------- */
views.chores = () => {
  const pts = weekPoints();
  const todo = state.chores.filter((c) => !choreDone(c));
  const done = state.chores.filter((c) => choreDone(c));
  const ranked = [...state.members].sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
  const top = ranked[0] && pts[ranked[0].id] ? ranked[0].id : null;
  return `
    ${state.members.length ? `<div class="card">
      <h3>This week's points</h3>
      <div class="leader">${ranked.map((m) => `<div class="who">${avatar(m)}<div class="pts">${pts[m.id] || 0}${m.id === top ? ' 👑' : ''}</div><div class="small muted">${esc(m.name)}</div></div>`).join('')}</div>
    </div>` : ''}
    <div class="section-title">To do</div>
    <div class="card flush">${todo.map(choreRow).join('') || `<div class="empty"><span class="big">✨</span>${state.chores.length ? 'All done! Nice work, team.' : 'Add chores and assign them to family members. Each one earns points.'}</div>`}</div>
    ${done.length ? `<div class="section-title">Done</div><div class="card flush">${done.map(choreRow).join('')}</div>` : ''}
    <button class="fab" data-action="add-chore" aria-label="Add chore">${ICON.plus}</button>
  `;
};
const FREQ_LABEL = { daily: 'Daily', weekly: 'Weekly', once: 'One-time' };
function choreRow(c) {
  const isDone = choreDone(c);
  const m = c.memberId ? member(c.memberId) : null;
  const last = (c.log || []).at(-1);
  const by = isDone && last?.memberId ? member(last.memberId) : null;
  return `<div class="row${isDone ? ' done' : ''}">
    <button class="check${isDone ? ' on' : ''}" data-action="toggle-chore" data-id="${c.id}" aria-label="Done">${ICON.check}</button>
    <button class="grow" style="text-align:left" data-action="edit-chore" data-id="${c.id}">
      <div class="title">${esc(c.title)}</div>
      <div class="sub">${FREQ_LABEL[c.freq] || ''} · ${c.points || 1} pt${(c.points || 1) > 1 ? 's' : ''}${by ? ` · done by ${esc(by.name)}` : ''}</div>
    </button>
    ${m ? avatar(m, true) : '<span class="pill">Anyone</span>'}
  </div>`;
}

/* ---------- Settings ---------- */
views.settings = () => `
  <div class="section-title">Family members<button data-action="add-member">+ Add</button></div>
  <div class="card flush">
    ${state.members.map((m) => `<button class="row tap" style="width:100%;text-align:left" data-action="edit-member" data-id="${m.id}">
      ${avatar(m)}<div class="grow"><div class="title">${esc(m.name)}</div></div><i class="dot" style="background:${m.color}"></i>${ICON.chev}
    </button>`).join('')}
  </div>

  <div class="section-title">Preferences</div>
  <div class="card">
    <div class="field"><label for="setCurrency">Currency</label>
      <select id="setCurrency" data-change="setting" data-key="currency">
        ${['USD', 'MXN', 'CAD', 'EUR', 'GBP'].map((c) => `<option ${state.settings.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
    <div class="field"><label for="setTheme">Appearance</label>
      <select id="setTheme" data-change="setting" data-key="theme">
        ${[['auto', 'Match iPhone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${state.settings.theme === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></div>
    <label class="toggle-row" style="padding-bottom:0"><span>Show holidays on calendar</span>
      <input type="checkbox" data-change="setting" data-key="showHolidays" ${state.settings.showHolidays ? 'checked' : ''}></label>
  </div>

  <div class="section-title">Backup &amp; sharing</div>
  <div class="card">
    <p class="small muted" style="margin:0 0 10px">Everything is saved privately on this device. Back up regularly, or send a backup to another family member's phone and import it there.</p>
    <div class="btn-row" style="margin:0">
      <button class="btn" data-action="export">⬇️ Back up</button>
      <button class="btn secondary" data-action="import">⬆️ Restore</button>
    </div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
  </div>

  <div class="section-title">Add to iPhone home screen</div>
  <div class="card small">
    <ol style="margin:0;padding-left:20px;line-height:1.7">
      <li>Open this page in <b>Safari</b></li>
      <li>Tap the <b>Share</b> button (square with arrow)</li>
      <li>Scroll down and tap <b>Add to Home Screen</b></li>
      <li>Tap <b>Add</b> — it opens full-screen like a real app and works offline</li>
    </ol>
  </div>

  <div class="btn-row"><button class="btn danger block" data-action="reset">Erase all data</button></div>
  <p class="small muted" style="text-align:center">Gomez Family Hub · made with ❤️</p>
`;

/* =========================================================
   Router / render
   ========================================================= */
const viewEl = $('#view');
function currentRoute() {
  const [name, param] = (location.hash.slice(1) || 'home').split('/');
  return views[name] ? { name, param } : { name: 'home' };
}
function render() {
  const { name, param } = currentRoute();
  viewEl.innerHTML = views[name](param);
  const tab = name === 'person' ? 'gifts' : name;
  $('#title').textContent = name === 'person' ? 'Gift Planner' : TITLES[name];
  $('#backBtn').hidden = TABS.includes(name);
  document.querySelectorAll('.tabbar [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}
function go(to) {
  if (location.hash.slice(1) === to) { render(); return; }
  location.hash = to;
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function applyTheme() {
  const th = state.settings.theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
}

/* =========================================================
   Toast with undo
   ========================================================= */
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2200);
}
function withUndo(msg, mutate) {
  const snap = JSON.stringify(state);
  mutate();
  save(); render();
  toast(msg, () => { state = JSON.parse(snap); save(); render(); });
}

/* =========================================================
   Bottom-sheet forms
   ========================================================= */
let sheetCfg = null;
function fieldHTML(f, v) {
  if (f.row) return `<div class="field-row">${f.row.map((x) => fieldHTML(x, v)).join('')}</div>`;
  if (f.type === 'html') return f.html;
  const val = v[f.name] ?? f.default ?? '';
  const id = 'f_' + f.name;
  const req = f.required ? 'required' : '';
  let input;
  switch (f.type) {
    case 'select':
      input = `<select id="${id}" name="${f.name}">${f.options.map((o) => {
        const ov = typeof o === 'string' ? o : o.value; const ol = typeof o === 'string' ? o : o.label;
        return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`;
      }).join('')}</select>`;
      break;
    case 'textarea':
      input = `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
      break;
    case 'checkbox':
      return `<label class="toggle-row"><span>${esc(f.label)}${f.hint ? `<br><span class="small muted">${esc(f.hint)}</span>` : ''}</span><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''}></label>`;
    case 'color':
      input = `<div class="swatches">${COLORS.map((c) => `<label><input type="radio" name="${f.name}" value="${c}" ${c === val ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>`;
      break;
    case 'money':
    case 'number':
      input = `<input id="${id}" name="${f.name}" type="text" inputmode="${f.type === 'money' ? 'decimal' : 'numeric'}" value="${val === null ? '' : esc(val)}" placeholder="${esc(f.placeholder || '')}" ${req}>`;
      break;
    default:
      input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.list ? `list="${f.list}"` : ''} ${req} autocapitalize="${f.type === 'url' ? 'off' : 'sentences'}">`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
}
const flatFields = (fields) => fields.flatMap((f) => (f.row ? f.row : [f])).filter((f) => f.name);

function openSheet(cfg) {
  sheetCfg = cfg;
  const v = cfg.values || {};
  $('#sheetTitle').textContent = cfg.title;
  $('#sheetSave').textContent = cfg.saveLabel || 'Save';
  const form = $('#sheetForm');
  form.innerHTML = cfg.fields.map((f) => fieldHTML(f, v)).join('')
    + (cfg.extra || '')
    + (cfg.onDelete ? `<button type="button" class="btn danger block" style="margin-top:8px" data-action="sheet-delete">${esc(cfg.deleteLabel || 'Delete')}</button>` : '');
  form.oninput = cfg.onInput ? (e) => cfg.onInput(form, e) : null;
  $('#sheetBackdrop').hidden = false;
  $('#sheet').hidden = false;
  form.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBackdrop').hidden = true;
  document.body.style.overflow = '';
  document.activeElement?.blur?.();
  sheetCfg = null;
}
function submitSheet() {
  if (!sheetCfg) return;
  const form = $('#sheetForm');
  const out = {};
  for (const f of flatFields(sheetCfg.fields)) {
    const el = form.elements[f.name];
    if (!el) continue;
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'money' || f.type === 'number') {
      const n = parseFloat(String(el.value).replace(/[^0-9.\-]/g, ''));
      out[f.name] = Number.isFinite(n) ? n : null;
    } else out[f.name] = (el.value ?? '').trim();
    if (f.required && (out[f.name] === '' || out[f.name] === null)) {
      toast(`${f.label} is required`);
      el.focus?.();
      return;
    }
  }
  const cfg = sheetCfg;
  if (cfg.onSave(out) === false) return;
  closeSheet();
  save(); render();
}
$('#sheetForm').addEventListener('submit', (e) => { e.preventDefault(); submitSheet(); });
$('#sheetBackdrop').addEventListener('click', closeSheet);

/* =========================================================
   Forms for each entity
   ========================================================= */
function txForm(tx) {
  const isNew = !tx;
  tx ||= { type: 'expense', date: today(), categoryId: state.budget.categories[0]?.id || '' };
  openSheet({
    title: isNew ? 'Add transaction' : 'Edit transaction',
    values: tx,
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: [{ value: 'expense', label: '💸 Expense' }, { value: 'income', label: '💰 Income' }] },
      { name: 'amount', label: 'Amount', type: 'money', required: true, placeholder: '0.00' },
      { name: 'note', label: 'Description', placeholder: 'e.g. Costco run' },
      { name: 'categoryId', label: 'Category', type: 'select', options: state.budget.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })) },
      { row: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'memberId', label: 'Who', type: 'select', options: [{ value: '', label: '—' }, ...memberOptions(false)] },
      ] },
    ],
    onSave(v) {
      if (isNew) { state.budget.transactions.push({ id: uid(), created: Date.now(), ...v }); ui.budgetMonth = monthKey(v.date); }
      else Object.assign(tx, v);
      toast(isNew ? 'Added' : 'Saved');
    },
    onDelete: isNew ? null : () => withUndo('Transaction deleted', () => {
      state.budget.transactions = state.budget.transactions.filter((t) => t.id !== tx.id);
      for (const b of state.budget.bills) for (const k in b.paid || {}) if (b.paid[k] === tx.id) delete b.paid[k];
    }),
  });
}

function categoryForm(c) {
  const isNew = !c;
  openSheet({
    title: isNew ? 'New category' : 'Edit category',
    values: c || { emoji: '📦' },
    fields: [
      { row: [
        { name: 'emoji', label: 'Emoji', placeholder: '📦' },
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Pets' },
      ] },
      { name: 'limit', label: 'Monthly budget', type: 'money', placeholder: '0 = no limit' },
    ],
    onSave(v) {
      v.limit = v.limit || 0;
      if (isNew) state.budget.categories.push({ id: uid(), ...v });
      else Object.assign(c, v);
    },
    onDelete: isNew ? null : () => withUndo(`${c.name} deleted`, () => {
      state.budget.categories = state.budget.categories.filter((x) => x.id !== c.id);
    }),
  });
}

function billForm(b) {
  const isNew = !b;
  openSheet({
    title: isNew ? 'New bill' : 'Edit bill',
    values: b || { dueDay: 1, categoryId: state.budget.categories.find((c) => c.name === 'Utilities')?.id || '', showOnCalendar: true },
    fields: [
      { name: 'name', label: 'Bill', required: true, placeholder: 'e.g. Rent, Electric, Netflix' },
      { row: [
        { name: 'amount', label: 'Amount', type: 'money', required: true, placeholder: '0.00' },
        { name: 'dueDay', label: 'Due day of month', type: 'number', required: true, placeholder: '1–31' },
      ] },
      { name: 'categoryId', label: 'Count it under', type: 'select', options: [{ value: '', label: '— Don\'t track in budget —' }, ...state.budget.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))] },
      { name: 'autopay', label: 'On autopay', type: 'checkbox' },
      { name: 'showOnCalendar', label: 'Show due date on calendar', type: 'checkbox' },
    ],
    onSave(v) {
      v.dueDay = Math.max(1, Math.min(31, Math.round(v.dueDay || 1)));
      if (isNew) state.budget.bills.push({ id: uid(), paid: {}, ...v });
      else Object.assign(b, v);
    },
    onDelete: isNew ? null : () => withUndo(`${b.name} deleted`, () => {
      state.budget.bills = state.budget.bills.filter((x) => x.id !== b.id);
    }),
  });
}
function toggleBill(b, ym) {
  b.paid ||= {};
  if (b.paid[ym]) {
    const txId = b.paid[ym];
    state.budget.transactions = state.budget.transactions.filter((t) => t.id !== txId);
    delete b.paid[ym];
  } else {
    let txId = true;
    if (b.categoryId) {
      txId = uid();
      const date = ym === monthKey(today()) ? today() : billDueDate(b, ym);
      state.budget.transactions.push({ id: txId, created: Date.now(), type: 'expense', amount: b.amount, note: b.name, categoryId: b.categoryId, date, memberId: '' });
    }
    b.paid[ym] = txId;
    toast(`${b.name} marked paid ✓`);
  }
  save(); render();
}

function stapleForm(s) {
  const isNew = !s;
  openSheet({
    title: isNew ? 'New staple' : 'Edit staple',
    values: s || { kind: ui.shopKind || 'grocery', aisle: 'Pantry', status: 'ok' },
    fields: [
      { name: 'name', label: 'Item', required: true, placeholder: 'e.g. Tortillas' },
      { row: [
        { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'grocery', label: '🥑 Grocery' }, { value: 'household', label: '🧻 Household' }] },
        { name: 'aisle', label: 'Aisle', type: 'select', options: AISLES },
      ] },
      { row: [
        { name: 'store', label: 'Usual store', placeholder: 'e.g. Costco' },
        { name: 'price', label: 'Usual price', type: 'money', placeholder: '0.00' },
      ] },
      { name: 'status', label: 'Status', type: 'select', options: STAPLE_STATUS.map((k) => ({ value: k, label: STAPLE_LABEL[k] })) },
    ],
    onSave(v) {
      if (isNew) state.shop.staples.push({ id: uid(), lastBought: '', ...v });
      else Object.assign(s, v);
    },
    onDelete: isNew ? null : () => withUndo(`${s.name} removed`, () => {
      state.shop.staples = state.shop.staples.filter((x) => x.id !== s.id);
    }),
  });
}

function itemForm(i) {
  openSheet({
    title: 'Edit item',
    values: i,
    fields: [
      { name: 'name', label: 'Item', required: true },
      { row: [
        { name: 'qty', label: 'Quantity / note', placeholder: 'e.g. 2 lb, the big one' },
        { name: 'aisle', label: 'Aisle', type: 'select', options: AISLES },
      ] },
      { name: 'makeStaple', label: 'Save as a staple', type: 'checkbox', hint: 'Something we buy regularly', default: !!stapleByName(i.name) },
    ],
    onSave(v) {
      const { makeStaple, ...rest } = v;
      Object.assign(i, rest);
      if (makeStaple && !stapleByName(i.name)) {
        state.shop.staples.push({ id: uid(), name: i.name, aisle: i.aisle, kind: ['Household', 'Personal Care', 'Pets', 'Baby & Kids'].includes(i.aisle) ? 'household' : 'grocery', status: 'out', price: null, store: '', lastBought: '' });
        toast(`${i.name} added to staples`);
      }
    },
    onDelete: () => withUndo(`${i.name} removed`, () => { state.shop.list = state.shop.list.filter((x) => x.id !== i.id); }),
    deleteLabel: 'Remove from list',
  });
}

function eventForm(ev, date) {
  const isNew = !ev;
  openSheet({
    title: isNew ? 'New event' : 'Edit event',
    values: ev || { date: date || today(), repeat: 'none', memberId: '' },
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Soccer practice' },
      { row: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'memberId', label: 'Who', type: 'select', options: memberOptions() },
      ] },
      { row: [
        { name: 'time', label: 'Start (blank = all day)', type: 'time' },
        { name: 'endTime', label: 'End', type: 'time' },
      ] },
      { name: 'location', label: 'Location', placeholder: 'Optional' },
      { name: 'repeat', label: 'Repeats', type: 'select', options: [
        { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Every week' },
        { value: 'biweekly', label: 'Every 2 weeks' }, { value: 'monthly', label: 'Every month' }, { value: 'yearly', label: 'Every year' }] },
      { name: 'until', label: 'Repeat until (optional)', type: 'date' },
      { name: 'countdown', label: 'Show countdown on Home', type: 'checkbox', hint: 'Great for trips, parties & big days' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave(v) {
      if (isNew) state.events.push({ id: uid(), ...v });
      else Object.assign(ev, v);
      ui.calSel = v.date; ui.calMonth = monthKey(v.date);
    },
    onDelete: isNew ? null : () => withUndo(`${ev.title} deleted`, () => { state.events = state.events.filter((x) => x.id !== ev.id); }),
  });
}

const PERSON_EMOJI = ['👵', '👴', '👩', '👨', '👧', '👦', '👶', '🧑', '💑', '🐶', '🐱', '⭐'];
function personForm(p) {
  const isNew = !p;
  openSheet({
    title: isNew ? 'Add person' : 'Edit person',
    values: p || { emoji: '🙂' },
    fields: [
      { row: [
        { name: 'emoji', label: 'Emoji', placeholder: '🙂' },
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Grandma Rosa' },
      ] },
      { type: 'html', html: `<div class="chips" style="margin-top:-6px">${PERSON_EMOJI.map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { row: [
        { name: 'relationship', label: 'Relationship', placeholder: 'e.g. Aunt, Friend' },
        { name: 'birthday', label: 'Birthday', type: 'date' },
      ] },
      { name: 'likes', label: 'Likes & wish list', type: 'textarea', placeholder: 'Favorite colors, hobbies, things they mentioned wanting…' },
      { name: 'sizes', label: 'Sizes', type: 'textarea', placeholder: 'Shirt M, shoe 8, ring 6…' },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Allergies, address, anything else' },
    ],
    onSave(v) {
      if (isNew) { const np = { id: uid(), ...v }; state.people.push(np); setTimeout(() => go('person/' + np.id)); }
      else Object.assign(p, v);
    },
    onDelete: isNew ? null : () => {
      withUndo(`${p.name} removed`, () => {
        state.people = state.people.filter((x) => x.id !== p.id);
        state.gifts = state.gifts.filter((g) => g.personId !== p.id);
      });
      go('gifts');
    },
  });
}

function giftForm(g, personId) {
  const isNew = !g;
  const p = person(g?.personId || personId);
  const next = p && nextBirthday(p);
  openSheet({
    title: isNew ? `Gift for ${p?.name || ''}` : 'Edit gift',
    values: g || { personId, status: 'idea', occasion: next && daysBetween(today(), next) < 60 ? 'Birthday' : 'Christmas', year: new Date().getFullYear() },
    fields: [
      { name: 'idea', label: 'Gift', required: true, placeholder: 'e.g. Cozy blanket' },
      { row: [
        { name: 'occasion', label: 'Occasion', type: 'select', options: OCCASIONS },
        { name: 'year', label: 'Year', type: 'number' },
      ] },
      { row: [
        { name: 'price', label: 'Price', type: 'money', placeholder: '0.00' },
        { name: 'status', label: 'Status', type: 'select', options: GIFT_STATUS.map((s) => ({ value: s, label: cap(s) })) },
      ] },
      { row: [
        { name: 'store', label: 'Store', placeholder: 'e.g. Target' },
        { name: 'link', label: 'Link', type: 'url', placeholder: 'https://…' },
      ] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave(v) {
      v.year = v.year || new Date().getFullYear();
      if (isNew) state.gifts.push({ id: uid(), personId, ...v });
      else Object.assign(g, v);
    },
    onDelete: isNew ? null : () => withUndo('Gift deleted', () => { state.gifts = state.gifts.filter((x) => x.id !== g.id); }),
  });
}

function mealForm(date) {
  const m = state.meals[date] || {};
  const hist = mealHistory();
  openSheet({
    title: fmtDate(date, { weekday: 'long', month: 'short', day: 'numeric' }),
    values: { ...m, addToList: false },
    fields: [
      { name: 'dinner', label: 'Dinner', placeholder: 'e.g. Tacos', list: 'mealNames' },
      { type: 'html', html: `<datalist id="mealNames">${hist.map((h) => `<option value="${esc(h.name)}">`).join('')}</datalist>
        ${hist.length ? `<div class="chips" style="margin-top:-6px"><button type="button" class="chip" data-action="meal-random">🎲 Surprise me</button></div>` : ''}` },
      { name: 'ingredients', label: 'Ingredients to buy', type: 'textarea', placeholder: 'Comma or line separated: tortillas, ground beef, cheese…' },
      { name: 'notes', label: 'Notes', placeholder: 'e.g. Leftovers for lunch' },
      { name: 'addToList', label: 'Add ingredients to shopping list', type: 'checkbox' },
    ],
    onInput(form, e) {
      if (e.target.name !== 'dinner') return;
      const h = hist.find((x) => norm(x.name) === norm(e.target.value));
      if (h && !form.elements.ingredients.value.trim()) form.elements.ingredients.value = h.ingredients;
    },
    onSave(v) {
      const { addToList: add, ...meal } = v;
      if (!meal.dinner && !meal.ingredients && !meal.notes) delete state.meals[date];
      else state.meals[date] = meal;
      if (add) {
        const n = splitList(meal.ingredients).filter((x) => addToList(x, '', true)).length;
        toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to the list 🛒` : 'Already on the list');
      }
    },
    onDelete: m.dinner ? () => withUndo('Meal cleared', () => { delete state.meals[date]; }) : null,
    deleteLabel: 'Clear this day',
  });
}

function choreForm(c) {
  const isNew = !c;
  openSheet({
    title: isNew ? 'New chore' : 'Edit chore',
    values: c || { freq: 'weekly', points: 1, memberId: '' },
    fields: [
      { name: 'title', label: 'Chore', required: true, placeholder: 'e.g. Take out the trash' },
      { name: 'memberId', label: 'Assigned to', type: 'select', options: [{ value: '', label: '🙋 Anyone' }, ...memberOptions(false)] },
      { row: [
        { name: 'freq', label: 'How often', type: 'select', options: Object.entries(FREQ_LABEL).map(([value, label]) => ({ value, label })) },
        { name: 'points', label: 'Points', type: 'number' },
      ] },
    ],
    onSave(v) {
      v.points = Math.max(1, Math.round(v.points || 1));
      if (isNew) state.chores.push({ id: uid(), log: [], ...v });
      else Object.assign(c, v);
    },
    onDelete: isNew ? null : () => withUndo(`${c.title} deleted`, () => { state.chores = state.chores.filter((x) => x.id !== c.id); }),
  });
}
function toggleChore(c) {
  const t = today();
  c.log ||= [];
  if (choreDone(c)) {
    const from = c.freq === 'daily' ? t : c.freq === 'weekly' ? weekStart(t) : '0000';
    c.log = c.log.filter((l) => l.date < from);
    save(); render();
    return;
  }
  const finish = (memberId) => {
    c.log.push({ date: t, memberId });
    const m = memberId ? member(memberId) : null;
    toast(`${m ? m.name + ' earned' : 'Earned'} ${c.points || 1} point${(c.points || 1) > 1 ? 's' : ''} ⭐`);
    save(); render();
  };
  if (c.memberId || state.members.length < 2) return finish(c.memberId || state.members[0]?.id || '');
  openSheet({
    title: 'Who did it?',
    saveLabel: 'Done',
    values: { memberId: state.members[0].id },
    fields: [{ name: 'memberId', label: c.title, type: 'select', options: memberOptions(false) }],
    onSave(v) { finish(v.memberId); },
  });
}

function memberForm(m) {
  const isNew = !m;
  openSheet({
    title: isNew ? 'Add family member' : 'Edit family member',
    values: m || { emoji: '🙂', color: COLORS[state.members.length % COLORS.length] },
    fields: [
      { row: [
        { name: 'emoji', label: 'Emoji', placeholder: '🙂' },
        { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Mom' },
      ] },
      { type: 'html', html: `<div class="chips" style="margin-top:-6px">${['👩', '👨', '👧', '👦', '👶', '👵', '👴', '🐶', '🐱'].map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { name: 'color', label: 'Calendar color', type: 'color' },
    ],
    onSave(v) {
      if (isNew) state.members.push({ id: uid(), ...v });
      else Object.assign(m, v);
    },
    onDelete: isNew || state.members.length < 2 ? null : () => withUndo(`${m.name} removed`, () => {
      state.members = state.members.filter((x) => x.id !== m.id);
    }),
  });
}

/* =========================================================
   Actions (event delegation)
   ========================================================= */
const findIn = (arr, id) => arr.find((x) => x.id === id);
const actions = {
  'go': (el) => { if (el.dataset.btab) ui.budgetTab = el.dataset.btab; go(el.dataset.to); },
  'back': () => { if (history.length > 1) history.back(); else go('home'); },
  'sheet-cancel': closeSheet,
  'sheet-save': submitSheet,
  'sheet-delete': () => { const cfg = sheetCfg; closeSheet(); cfg.onDelete(); },
  'pick-emoji': (el) => { $('#sheetForm').elements.emoji.value = el.dataset.emoji; },
  'dismiss-welcome': () => { state.settings.welcomeDismissed = true; save(); render(); },

  // Budget
  'budget-month': (el) => { ui.budgetMonth = addMonths(ui.budgetMonth, +el.dataset.n); render(); },
  'budget-tab': (el) => { ui.budgetTab = el.dataset.tab; render(); },
  'add-tx': () => txForm(null),
  'edit-tx': (el) => txForm(findIn(state.budget.transactions, el.dataset.id)),
  'add-category': () => categoryForm(null),
  'edit-category': (el) => categoryForm(findIn(state.budget.categories, el.dataset.id)),
  'add-bill': () => billForm(null),
  'edit-bill': (el) => billForm(findIn(state.budget.bills, el.dataset.id)),
  'toggle-bill': (el) => toggleBill(findIn(state.budget.bills, el.dataset.id), ui.budgetMonth),
  'pay-bill': (el) => toggleBill(findIn(state.budget.bills, el.dataset.id), monthKey(today())),

  // Shopping
  'shop-tab': (el) => { ui.shopTab = el.dataset.tab; render(); },
  'toggle-item': (el) => { const i = findIn(state.shop.list, el.dataset.id); i.done = !i.done; save(); render(); },
  'edit-item': (el) => itemForm(findIn(state.shop.list, el.dataset.id)),
  'del-item': (el) => { const i = findIn(state.shop.list, el.dataset.id); withUndo(`${i.name} removed`, () => { state.shop.list = state.shop.list.filter((x) => x.id !== i.id); }); },
  'clear-done': () => {
    const done = state.shop.list.filter((i) => i.done);
    withUndo(`Cleared ${done.length} item${done.length > 1 ? 's' : ''} · staples restocked`, () => {
      for (const i of done) { const s = stapleByName(i.name); if (s) { s.status = 'ok'; s.lastBought = today(); } }
      state.shop.list = state.shop.list.filter((i) => !i.done);
    });
  },
  'staple-to-list': (el) => {
    const s = findIn(state.shop.staples, el.dataset.id);
    if (s.status === 'ok') s.status = 'low';
    if (addToList(s.name)) toast(`${s.name} added to the list`);
    save(); render();
  },
  'add-low-to-list': () => {
    const n = state.shop.staples.filter((s) => s.status !== 'ok').filter((s) => addToList(s.name, '', true)).length;
    toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to the list` : 'Already on the list');
    save(); render();
  },
  'cycle-staple': (el) => {
    const s = findIn(state.shop.staples, el.dataset.id);
    s.status = STAPLE_STATUS[(STAPLE_STATUS.indexOf(s.status) + 1) % STAPLE_STATUS.length];
    if (s.status === 'ok') s.lastBought = today();
    save(); render();
  },
  'add-staple': () => stapleForm(null),
  'edit-staple': (el) => stapleForm(findIn(state.shop.staples, el.dataset.id)),
  'share-list': async () => {
    const open = state.shop.list.filter((i) => !i.done);
    const groups = {};
    for (const i of open) (groups[i.aisle || 'Other'] ||= []).push(i);
    const text = '🛒 Shopping list\n' + Object.keys(groups).sort((a, b) => AISLES.indexOf(a) - AISLES.indexOf(b))
      .map((a) => `\n${a}\n` + groups[a].map((i) => `☐ ${i.name}${i.qty ? ` (${i.qty})` : ''}`).join('\n')).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Shopping list', text });
      else { await navigator.clipboard.writeText(text); toast('List copied to clipboard'); }
    } catch (e) { if (e.name !== 'AbortError') toast('Could not share'); }
  },

  // Calendar
  'cal-month': (el) => { ui.calMonth = addMonths(ui.calMonth, +el.dataset.n); ui.calSel = ui.calMonth === monthKey(today()) ? today() : ui.calMonth + '-01'; render(); },
  'cal-select': (el) => { ui.calSel = el.dataset.date; if (monthKey(ui.calSel) !== ui.calMonth) ui.calMonth = monthKey(ui.calSel); render(); },
  'cal-today': () => { ui.calSel = today(); ui.calMonth = monthKey(today()); render(); },
  'add-event': (el) => eventForm(null, el.dataset.date),
  'edit-event': (el) => eventForm(findIn(state.events, el.dataset.id)),

  // Gifts
  'add-person': () => personForm(null),
  'edit-person': (el) => personForm(person(el.dataset.id)),
  'add-gift': (el) => giftForm(null, el.dataset.person),
  'edit-gift': (el) => giftForm(findIn(state.gifts, el.dataset.id)),
  'cycle-gift': (el) => {
    const g = findIn(state.gifts, el.dataset.id);
    g.status = GIFT_STATUS[(GIFT_STATUS.indexOf(g.status) + 1) % GIFT_STATUS.length];
    save(); render();
  },
  'edit-gift-budget': () => openSheet({
    title: 'Yearly gift budget',
    values: { giftBudget: state.settings.giftBudget || null },
    fields: [{ name: 'giftBudget', label: `How much for gifts in ${new Date().getFullYear()}?`, type: 'money', placeholder: '0 = no budget' }],
    onSave(v) { state.settings.giftBudget = v.giftBudget || 0; },
  }),

  // Meals
  'meals-week': (el) => { ui.mealsWeek = addDays(ui.mealsWeek, +el.dataset.n); render(); },
  'edit-meal': (el) => mealForm(el.dataset.date),
  'meal-random': () => {
    const hist = mealHistory();
    const h = hist[Math.floor(Math.random() * hist.length)];
    const f = $('#sheetForm');
    f.elements.dinner.value = h.name;
    f.elements.ingredients.value = h.ingredients;
  },
  'week-to-list': () => {
    const items = [...Array(7)].flatMap((_, i) => splitList(state.meals[addDays(ui.mealsWeek, i)]?.ingredients));
    const n = items.filter((x) => addToList(x, '', true)).length;
    toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to the list 🛒` : 'Everything is already on the list');
    save();
  },

  // Chores
  'add-chore': () => choreForm(null),
  'edit-chore': (el) => choreForm(findIn(state.chores, el.dataset.id)),
  'toggle-chore': (el) => toggleChore(findIn(state.chores, el.dataset.id)),

  // Settings
  'add-member': () => memberForm(null),
  'edit-member': (el) => memberForm(findIn(state.members, el.dataset.id)),
  'export': async () => {
    const name = `gomez-family-backup-${today()}.json`;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Gomez Family backup' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'import': () => $('#importFile').click(),
  'reset': () => {
    if (!confirm('Erase ALL family data on this device? This cannot be undone. (Make a backup first!)')) return;
    state = defaultState(); save(); applyTheme(); go('home'); toast('All data erased');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.submit === 'shop-add') {
    const raw = form.elements.newItem.value.trim();
    if (!raw) return;
    // "2 lb chicken" -> qty "2 lb", name "chicken"; "milk x2" -> qty "x2"
    let name = raw, qty = '';
    const m1 = raw.match(/^(\d+(?:\.\d+)?\s*(?:lbs?|oz|kg|g|pk|packs?|bags?|boxes|box|cans?|dozen|gal(?:lons?)?|bottles?|ct)?)\s+(.+)$/i);
    const m2 = raw.match(/^(.+?)\s+x\s?(\d+)$/i);
    if (m1) { qty = m1[1]; name = m1[2]; } else if (m2) { name = m2[1]; qty = 'x' + m2[2]; }
    if (addToList(name, qty)) { save(); render(); $('[data-submit="shop-add"] input')?.focus(); }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'importFile' && el.files?.[0]) {
    el.files[0].text().then((txt) => {
      const data = JSON.parse(txt);
      if (!data || typeof data !== 'object' || !data.version) throw new Error('Not a backup file');
      if (!confirm('Replace everything on this device with this backup?')) return;
      state = migrate(data); save(); applyTheme(); render(); toast('Backup restored ✓');
    }).catch(() => toast('That file is not a valid backup')).finally(() => { el.value = ''; });
    return;
  }
  if (el.dataset.change === 'setting') {
    state.settings[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value;
    save(); applyTheme(); render();
  }
});

/* =========================================================
   Boot
   ========================================================= */
applyTheme();
render();

// Refresh "today" if the app is left open past midnight / resumed from background.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    ui.calSel = lastDay; ui.calMonth = monthKey(lastDay); ui.budgetMonth = monthKey(lastDay); ui.mealsWeek = weekStart(lastDay);
    render();
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
