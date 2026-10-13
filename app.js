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
// Building an Intl formatter is the slow part (~0.4 ms each on a phone), so each one is made once and reused.
const _dtf = new Map();
const dtf = (opts) => { const k = JSON.stringify(opts); let f = _dtf.get(k); if (!f) _dtf.set(k, (f = new Intl.DateTimeFormat(undefined, opts))); return f; };
const fmtDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => dtf(opts).format(parse(s));
const fmtMonth = (ym) => dtf({ month: 'long', year: 'numeric' }).format(parse(ym + '-01'));
const fmtTime = (t) => {
  if (!t) return 'All day';
  const [h, m] = t.split(':').map(Number);
  return dtf({ hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m));
};
const relDays = (n) => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
const _nf = new Map();
const money = (n, opts = {}) => {
  try {
    const cur = state.settings.currency || 'USD', k = cur + JSON.stringify(opts);
    let f = _nf.get(k); if (!f) _nf.set(k, (f = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, ...opts })));
    return f.format(Math.round((Number(n) || 0) * 100) / 100 || 0); // never "-$0.00" from float dust
  } catch { return '$' + (n || 0).toFixed(2); }
};
// Money display rule: whole dollars for totals, budgets and summaries; cents only for single transactions and bill amounts.
const moneyFmt = (kind) => (kind === 'tx' || kind === 'bill' ? (n) => money(n) : (n) => money(n, { maximumFractionDigits: 0 }));
const moneyW = moneyFmt('total');
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
const AISLES = ['Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Pantry', 'Frozen', 'Snacks & Drinks', 'Household', 'Personal Care', 'Baby & Kids', 'Pets', 'Hardware', 'Other'];
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
    projects: [],
    goals: [],
    binder: [],
    maintenance: [],
    recipes: [],
    activity: [],
    rewards: [],
    redemptions: [],
    routines: [],
    piggy: {},
    wishes: [],
    board: [],
    trips: [],
    debts: [],
    kidAccounts: {},
    chat: [],
    kudos: [],
    checkins: {},
    todos: [],
    challenges: [],
    games: [],
    wordle: {},
    scores: [],
    trivia: [],
    gems: { cfg: {}, log: [], requests: [] },
    squish: { items: [], trades: [], pity: {}, free: {}, dust: {} },
    friends: { circleId: '', rules: {}, presets: null, muted: {} },
    houses: {},
    avatars: {},
    houseVotes: {},
    settings: { currency: 'USD', theme: 'auto', showHolidays: true, giftBudget: 0, welcomeDismissed: false },
  };
}

let loadFailed = false;
function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Could not load saved data', e);
    loadFailed = true;
    try { if (raw) localStorage.setItem(STORE_KEY + ':broken', raw); } catch {} // never lose the original
    return defaultState();
  }
}

// Fill in any keys added in later versions so older saves keep working.
function migrate(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('bad save');
  const d = defaultState();
  s.members ??= d.members;
  if (!Array.isArray(s.members)) s.members = d.members;
  for (const m of s.members) if (m && !/^#[0-9a-f]{3,8}$/i.test(m.color || '')) m.color = COLORS[0];
  s.budget ??= d.budget;
  s.budget.categories ??= d.budget.categories;
  s.budget.transactions ??= [];
  s.budget.bills ??= [];
  s.budget.bills = s.budget.bills.filter((b) => b && typeof b === 'object');
  for (const b of s.budget.bills) {
    b.type ||= 'bill';
    b.freq ||= 'monthly';
    b.group ??= '';
    b.dueDay ||= 1;
    b.anchor ||= dayInMonth(b.dueDay, monthKey(today()));
    b.paid ||= {};
    // v1 stored paid flags per month ("2026-10"); now they're per due date.
    for (const k of Object.keys(b.paid)) if (k.length === 7) { b.paid[dayInMonth(b.dueDay, k)] = b.paid[k]; delete b.paid[k]; }
  }
  s.shop ??= d.shop;
  s.shop.list ??= [];
  s.shop.staples ??= [];
  s.events ??= [];
  s.people ??= [];
  s.gifts ??= [];
  s.meals ??= {};
  s.chores ??= [];
  for (const c of s.chores) for (const l of c?.log || []) if (l && !l.id) l.id = `cl-${l.date}-${l.memberId || ''}`; // stable ids so two phones' check-offs merge
  s.projects ??= [];
  s.goals ??= [];
  s.binder ??= [];
  s.maintenance ??= [];
  s.recipes ??= [];
  s.activity ??= [];
  s.rewards ??= [];
  s.redemptions ??= [];
  s.routines ??= [];
  s.piggy ??= {};
  s.wishes ??= [];
  s.board ??= [];
  s.trips ??= [];
  s.debts ??= [];
  s.kidAccounts ??= {};
  s.chat ??= []; s.kudos ??= []; s.checkins ??= {}; s.todos ??= []; s.challenges ??= [];
  s.games ??= []; s.wordle ??= {}; s.scores ??= []; s.trivia ??= [];
  s.gems ??= {}; s.gems.cfg ??= {}; s.gems.log ??= []; s.gems.requests ??= [];
  s.squish ??= {}; s.squish.items ??= []; s.squish.trades ??= []; s.squish.pity ??= {}; s.squish.free ??= {}; s.squish.dust ??= {};
  s.houses ??= {}; s.houseVotes ??= {}; s.avatars ??= {};
  s.friends ??= {}; s.friends.circleId ??= ''; s.friends.rules ??= {}; s.friends.muted ??= {};
  s.projects = s.projects.filter((p) => p && typeof p === 'object');
  for (const pr of s.projects) { pr.items ??= []; pr.steps ??= []; }
  s.settings = { ...d.settings, ...(s.settings || {}) };
  s.version = 1;
  return s;
}

let state = load();
let saveTimer = null, storageFull = false;
function writeState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); if (storageFull) { storageFull = false; document.body.classList.remove('storage-full'); } return true; }
  catch (e) {
    try { localStorage.removeItem(STORE_KEY + ':broken'); localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; } catch {} // free the damaged-save copy, retry once
    storageFull = true; document.body.classList.add('storage-full');
    toast('⚠️ Phone storage is full — changes are NOT being saved. Settings → Back up now.');
    return false;
  }
}
function flushSave() {
  clearTimeout(saveTimer); saveTimer = null;
  try { if (typeof onLocalSave === 'function') onLocalSave(); } catch (e) { console.error(e); } // may add to the activity feed — saved just below
  writeState();
  if (typeof syncAfterSave === 'function') syncAfterSave();
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 120); }
window.addEventListener('pagehide', () => { if (saveTimer) flushSave(); else writeState(); });
// iOS often closes a home-screen app in the background without pagehide: write a pending save as soon as it's hidden
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) flushSave(); });

// Behave like an app, not a web page: iOS Safari ignores user-scalable=no, so block its pinch gestures directly
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
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
  if (ev.skip?.includes(s)) return false; // "this event only" edits/deletes
  switch (ev.repeat) {
    case 'daily': return true;
    case 'weekly': return daysBetween(ev.date, s) % 7 === 0;
    case 'biweekly': return daysBetween(ev.date, s) % 14 === 0;
    case 'monthly': { // the 31st lands on the last day of shorter months
      const d = parse(s), want = parse(ev.date).getDate(), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(want, last);
    }
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

// Calendar view respects the member filter; whole-family items (birthdays, bills, holidays) always show.
const calEventsOn = (s) => eventsOn(s).filter((e) => !ui.calWho || e.kind !== 'event' || !e.who?.id || (e.whoIds || [e.who.id]).includes(ui.calWho));
// Who an event is for: ev.memberId (first / only person) plus ev.memberIds when several were picked.
const eventWho = (ev) => (Array.isArray(ev.memberIds) && ev.memberIds.length ? ev.memberIds : ev.memberId ? [ev.memberId] : []).filter((id) => state.members.some((m) => m.id === id));
function eventsOn(s) {
  const out = [];
  for (const ev of state.events) {
    if (occursOn(ev, s)) {
      const ids = eventWho(ev);
      const m = ids.length > 1 ? { ...member(ids[0]), name: ids.map((id) => member(id).name).join(' & '), emoji: ids.map((id) => member(id).emoji).join('') } : member(ids[0] || ev.memberId);
      out.push({ kind: 'event', id: ev.id, date: s, title: ev.title, time: ev.time || '', end: ev.endTime || '', color: m.color, who: m, whoIds: ids, notes: ev.notes, location: ev.location, repeat: ev.repeat });
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
    if (b.showOnCalendar && billOn(b, s)) {
      const inc = b.type === 'income';
      out.push({ kind: 'bill', id: b.id, title: inc ? `💰 ${b.name} · +${money(amountFor(b, s))}` : `💳 ${b.name} · ${money(amountFor(b, s))}`, time: '', color: inc ? '#2f8a5b' : '#e0a800', who: EVERYONE });
    }
  }
  for (const pr of state.projects) {
    if (pr.dueDate === s && pr.status !== 'done') out.push({ kind: 'project', id: pr.id, title: `${pr.emoji || '🔨'} ${pr.name} due`, time: '', color: '#3b6fd8', who: EVERYONE });
  }
  if (typeof extraEventsOn === 'function') out.push(...extraEventsOn(s));
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

/* Recurring bills & income. Monthly items repeat on dueDay; weekly/biweekly/yearly repeat from anchor. */
const FREQ_STEP = { weekly: 7, biweekly: 14 };
const FREQ_NAMES = { monthly: 'Monthly', biweekly: 'Every 2 weeks', weekly: 'Weekly', yearly: 'Yearly' };
const BILL_GROUPS = ['Housing', 'Utilities', 'Auto', 'Insurance', 'Debt', 'Subscriptions', 'Health', 'Kids & School', 'Pets', 'Giving', 'Other'];
function dayInMonth(day, ym) {
  const last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  return `${ym}-${pad(Math.min(day, last))}`;
}
function billOccurrences(b, from, to) {
  const out = [];
  const freq = b.freq || 'monthly';
  if (freq === 'monthly') {
    for (let ym = monthKey(from); ym <= monthKey(to); ym = addMonths(ym, 1)) {
      const d = dayInMonth(b.dueDay || 1, ym);
      if (d >= from && d <= to) out.push(d);
    }
  } else if (FREQ_STEP[freq] && b.anchor) {
    const step = FREQ_STEP[freq];
    for (let d = addDays(b.anchor, Math.ceil(daysBetween(b.anchor, from) / step) * step); d <= to; d = addDays(d, step)) out.push(d);
  } else if (freq === 'yearly' && b.anchor) {
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
      const d = dayInMonth(+b.anchor.slice(8, 10), `${y}-${b.anchor.slice(5, 7)}`); // Feb 29 → Feb 28 in non-leap years
      if (d >= from && d <= to) out.push(d);
    }
  }
  return out;
}
const amountFor = (b, d) => b.amounts?.[d] ?? b.amount;
const billOn = (b, s) => billOccurrences(b, s, s).length > 0;
const isPaid = (b, d) => !!(b.paid && b.paid[d]);
const nextBillDate = (b, from = today()) => billOccurrences(b, from, addDays(from, 400))[0];
// Unpaid manual bills whose date has passed (since the bill was added, up to 60 days back).
function overdueBills(t = today()) {
  return recurringBetween(addDays(t, -60), addDays(t, -1), 'bill').filter(({ b, date }) => !b.autopay && !isPaid(b, date) && date >= (b.since || ''));
}
// Checking balance right now: the balance you entered plus what has moved since (paid/received recurring items and
// everyday transactions dated after it). Unpaid bills are left out — they're still owed (see overdueBills).
function balanceNow() {
  const bal = state.settings.balance;
  if (bal == null) return null;
  const t = today(), bd = state.settings.balanceDate || t, at = state.settings.balanceAt || 0;
  let v = Number(bal);
  if (bd < t) for (const x of recurringBetween(addDays(bd, 1), t)) if (isPaid(x.b, x.date)) v += x.b.type === 'income' ? x.amount : -x.amount;
  const billTx = new Set(state.budget.bills.flatMap((b) => Object.values(b.paid || {})));
  for (const x of state.budget.transactions) {
    if (billTx.has(x.id) || x.date > t) continue;
    if (x.date > bd || (x.date === bd && at && (x.created || 0) > at)) v += x.type === 'income' ? Number(x.amount) : -Number(x.amount);
  }
  return Math.round(v * 100) / 100;
}
// Category budget still free for everyday spending in a month, after the bills that count against it.
function flexLeft(ym) {
  const due = recurringBetween(ym + '-01', dayInMonth(31, ym), 'bill').filter((x) => x.b.categoryId && !isPaid(x.b, x.date));
  return sum(state.budget.categories, (c) => (c.limit ? Math.max(0, c.limit - spentIn(ym, c.id) - sum(due.filter((x) => x.b.categoryId === c.id), (x) => x.amount)) : 0));
}
// Unspent everyday budget pro-rated over the days from t up to (not including) end — same daily rate the forecast uses.
function flexUntil(end, t = today()) {
  const dim = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate(), rate = {};
  let v = 0;
  for (let d = t; d < end; d = addDays(d, 1)) { const ym = monthKey(d); v += (rate[ym] ??= flexLeft(ym) / (ym === monthKey(t) ? dim(ym) - parse(t).getDate() + 1 : dim(ym))); }
  return Math.round(v * 100) / 100;
}
// The one "coming up" window used everywhere: today through 6 days out.
const dueWindow = (t = today()) => [t, addDays(t, 6)];
// Unpaid bills that are overdue or due in the window (Home "Bills" tile, Bills this week).
function billsDueSoon(t = today()) { return [...overdueBills(t), ...recurringBetween(...dueWindow(t), 'bill').filter((x) => !isPaid(x.b, x.date))]; }
// Paid bills are logged as transactions (fromBill). Ones with no budget category count as spending in Trends/Activity
// but not against category limits.
const isBillOnly = (x) => !!x.fromBill && x.type !== 'income' && !state.budget.categories.some((c) => c.id === x.categoryId);
const billGroupOf = (x) => state.budget.bills.find((b) => b.id === x.billId)?.group || 'Bills';
const billTxId = (b, date) => `bill-${b.id}-${date}`;
// Category for a new expense: the last transaction with the same/similar description, else the keyword guess.
function categoryFor(note) {
  const n = norm(note);
  if (n.length < 2) return '';
  const ids = new Set(state.budget.categories.map((c) => c.id)), w = n.split(/\s+/)[0];
  const past = state.budget.transactions.filter((t) => t.type !== 'income' && t.note && ids.has(t.categoryId)).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const hit = past.find((t) => norm(t.note) === n) || past.find((t) => { const m = norm(t.note); return n.length >= 3 && (m.startsWith(n) || n.startsWith(m)); }) || (w.length >= 4 ? past.find((t) => norm(t.note).split(/\s+/)[0] === w) : null);
  if (hit) return hit.categoryId;
  return typeof guessCategory === 'function' ? guessCategory(note)?.id || '' : '';
}
// All occurrences in [from, to], optionally only 'bill' or 'income', sorted by date.
function recurringBetween(from, to, type) {
  const out = [];
  for (const b of state.budget.bills) {
    if (type && b.type !== type) continue;
    for (const date of billOccurrences(b, from, to)) out.push({ b, date, amount: amountFor(b, date) });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || y.b.amount - x.b.amount);
}
const perMonth = (b) => b.amount * ({ weekly: 52 / 12, biweekly: 26 / 12, yearly: 1 / 12 }[b.freq] || 1);
function scheduleLabel(b) {
  if (b.freq === 'biweekly') return `Every 2 weeks · ${fmtDate(b.anchor, { weekday: 'long' })}s`;
  if (b.freq === 'weekly') return `Weekly · ${fmtDate(b.anchor, { weekday: 'long' })}s`;
  if (b.freq === 'yearly') return `Yearly · ${fmtDate(b.anchor, { month: 'short', day: 'numeric' })}`;
  return `Monthly on the ${ordinal(b.dueDay || 1)}`;
}
const nameColor = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return COLORS[Math.abs(h) % COLORS.length]; };
const letterAvatar = (name) => `<div class="avatar" style="background:${nameColor(name)};color:#fff;font-weight:750;font-size:16px">${esc((String(name).match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase())}</div>`;
const dueLabel = (date) => { const n = daysBetween(today(), date); return n < 0 ? `${-n} day${n < -1 ? 's' : ''} ago` : n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`; };

// A category's budget for a month. With rollover on, last month's unspent money (or overspending) carries in.
function catLimit(c, ym) {
  const base = Number(c.limit) || 0, prev = addMonths(ym, -1);
  if (!c.rollover || !base || (c.rolloverFrom && prev < c.rolloverFrom)) return base;
  return Math.max(0, Math.round((2 * base - spentIn(prev, c.id)) * 100) / 100);
}
function budgetSummary(ym) {
  const tx = monthTx(ym);
  const spent = sum(tx.filter((t) => t.type !== 'income' && !isBillOnly(t)), (t) => t.amount); // vs. the category budget
  const bills = sum(tx.filter(isBillOnly), (t) => t.amount);
  const income = sum(tx.filter((t) => t.type === 'income'), (t) => t.amount);
  const limit = sum(state.budget.categories, (c) => catLimit(c, ym));
  const r = (n) => Math.round(n * 100) / 100; // no 0.1+0.2 drift ("-$0.00")
  return { tx, spent: r(spent), bills: r(bills), income: r(income), limit, left: r(limit - spent) };
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
  state.shop.list.unshift({ id: uid(), name: st ? st.name : name, qty, aisle: st ? st.aisle : guessAisle(name), done: false, added: today(), by: (typeof actor === 'function' && actor()) || '' });
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
  'Hardware': /\b(?:screw|nail|paint|primer|lumber|board|drywall|caulk|sandpaper|brush|roller|bolt|hinge|tile|grout|mulch|soil|plywood|stain|glue)/,
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
const TITLES = { home: 'Home', budget: 'Budget', shop: 'Shopping', calendar: 'Calendar', gifts: 'Gifts', person: 'Gifts', meals: 'Meal Plan', chores: 'Chores', projects: 'House Projects', project: 'Project', settings: 'Settings' };

const views = {};

/* ---------- Home ---------- */
views.home = () => {
  const t = today();
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
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

  // Unpaid bills from the last 3 days through the next 7, and the next payday
  const billsDue = billsDueSoon(t);
  const payday = recurringBetween(t, addDays(t, 60), 'income')[0];

  // Birthdays within 45 days
  const bdays = state.people
    .map((p) => ({ p, date: nextBirthday(p) }))
    .filter((x) => x.date && daysBetween(t, x.date) <= 45)
    .sort((a, b) => a.date.localeCompare(b.date));

  const frac = sumry.limit ? sumry.spent / sumry.limit : 0;

  return `
    ${homeHero({ t, greet, todays, sumry, frac, listCount, lowCount, dinner, choresDue, billsDue, payday })}
    ${typeof homeQuickAdd === 'function' ? `<div data-home="quick">${homeQuickAdd()}</div>` : ''}
    ${typeof homeInsights === 'function' ? `<div data-home="insights">${homeInsights()}</div>` : ''}
    ${typeof homeLive === 'function' ? homeLive() : ''}

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

    ${countdowns.length ? `<div data-home="countdowns"><div class="countdown">${countdowns.map((c) => {
      const n = daysBetween(t, c.date);
      return `<div class="card"><div class="days">${n === 0 ? '🎉' : n}</div><div class="small muted">${n === 0 ? 'Today!' : n === 1 ? 'day until' : 'days until'}</div><div class="small" style="font-weight:650;margin-top:2px">${esc(c.title)}</div></div>`;
    }).join('')}</div></div>` : ''}


    <div data-home="today"><div class="section-title">Today<button data-action="add-event" data-date="${t}">+ Event</button></div>
    <div class="card flush">
      ${todays.length ? todays.map((e) => eventRow(e)).join('') : `<div class="empty small">Nothing on the calendar today.</div>`}
      <button class="row tap" style="width:100%;text-align:left" data-action="edit-meal" data-date="${t}">
        <div class="avatar">🍽️</div>
        <div class="grow"><div class="title">${dinner ? esc(dinner) : 'What\'s for dinner?'}</div><div class="sub">${dinner ? 'Tonight\'s dinner' : 'Tap to plan tonight'}</div></div>${ICON.chev}
      </button>
    </div></div>

    ${typeof weekStrip === 'function' ? `<div data-home="week">${weekStrip()}</div>` : upcoming.length ? `
      <div class="section-title">Next 7 days<button data-action="go" data-to="calendar">Calendar</button></div>
      <div class="card flush">${upcoming.slice(0, 8).map((e) => eventRow(e, true)).join('')}</div>` : ''}

    ${billsDue.length || payday ? `<div data-home="bills">
      <div class="section-title">Bills this week<button data-action="go" data-to="budget" data-btab="bills">Recurring</button></div>
      <div class="card flush">
        ${payday ? `<div class="row"><div class="avatar" style="background:var(--good-soft)">💰</div><div class="grow"><div class="title">Payday ${dueLabel(payday.date)}</div><div class="sub">${esc(payday.b.name)} · ${fmtDate(payday.date)}</div></div><span class="amount income">+${money(payday.amount, { maximumFractionDigits: 0 })}</span></div>` : ''}
        ${billsDue.map(recurRow).join('')}
        ${billsDue.length ? `<div class="row"><div class="grow small muted">${billsDue.length} bill${billsDue.length > 1 ? 's' : ''} due</div><b>${money(sum(billsDue, (x) => x.amount))}</b></div>` : ''}
      </div></div>` : ''}

    ${choresDue.length ? `<div data-home="chores">
      <div class="section-title">Chores to do<button data-action="go" data-to="chores">All chores</button></div>
      <div class="card flush">${choresDue.slice(0, 4).map(choreRow).join('')}</div></div>` : ''}

    ${bdays.length ? `<div data-home="birthdays">
      <div class="section-title">Birthdays coming up<button data-action="go" data-to="gifts">Gifts</button></div>
      <div class="card flush">${bdays.map(({ p, date }) => {
        const gifts = state.gifts.filter((g) => g.personId === p.id && g.occasion === 'Birthday' && Number(g.year) === parse(date).getFullYear());
        const ready = gifts.some((g) => g.status !== 'idea');
        return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="person/${p.id}">
          <div class="avatar">${esc(p.emoji || '🎂')}</div>
          <div class="grow"><div class="title">${esc(p.name)}</div><div class="sub">${relDays(daysBetween(t, date))} · ${fmtDate(date, { month: 'short', day: 'numeric' })}</div></div>
          <span class="pill ${ready ? 'good' : gifts.length ? 'warn' : 'bad'}">${ready ? 'Gift ready' : gifts.length ? 'Ideas only' : 'No gift yet'}</span>
        </button>`;
      }).join('')}</div></div>` : ''}

    ${typeof homeActivity === 'function' ? homeActivity() : ''}
    ${typeof homeExtras === 'function' ? homeExtras() : ''}

    <div data-home="more"><div class="section-title">More</div>
    ${typeof moreGrid === 'function' ? moreGrid() : ''}</div>
  `;
};

function homeHero({ t, greet, todays, sumry, frac, listCount, lowCount, dinner, choresDue, billsDue, payday }) {
  const bits = [];
  const realEvents = todays.filter((e) => e.kind !== 'holiday');
  const holiday = todays.find((e) => e.kind === 'holiday');
  if (holiday) bits.push(holiday.title);
  const dueToday = billsDue.filter((x) => x.date <= t).length;
  if (dueToday) bits.push(`${dueToday} bill${dueToday > 1 ? 's' : ''} due`);
  if (choresDue.length) bits.push(`${choresDue.length} chore${choresDue.length > 1 ? 's' : ''} left`);
  if (payday && daysBetween(t, payday.date) <= 3) bits.push(`💰 payday ${dueLabel(payday.date)}`);
  const fam = state.members.slice(0, 5);
  return `<section class="hero">
    <div class="hero-top">
      <div class="hero-date">${fmtDate(t, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <button class="avatars" data-action="go" data-to="settings" aria-label="Family">${fam.map((m) => `<span style="--c:${m.color}">${esc(m.emoji)}</span>`).join('')}</button>
    </div>
    <div class="hero-greet">${greet}${state.settings.me && state.members.some((m) => m.id === state.settings.me) ? `, ${esc(member(state.settings.me).name)}` : state.members.length > 1 ? ',<br>Gomez family' : ''}</div>
    ${bits.length ? `<div class="hero-sub">${esc(bits.join(' · '))}</div>` : `<div class="hero-sub">${realEvents.length ? 'Here\'s your day' : 'A calm day ahead ✨'}</div>`}
    ${typeof heroWeather === 'function' ? heroWeather() : ''}
    <div class="hero-stats">
      <button class="hstat" data-action="go" data-to="calendar"><b data-count="${realEvents.length}">${realEvents.length}</b><span>${realEvents.length === 1 ? 'event today' : 'events today'}</span></button>
      <button class="hstat" data-action="go" data-to="budget"><b data-count="${Math.round(sumry.left)}" data-money>${money(sumry.left, { maximumFractionDigits: 0 })}</b><span>left in ${parse(t).toLocaleDateString(undefined, { month: 'short' })}</span>${sumry.limit ? `<div class="hbar"><i style="width:${Math.min(100, frac * 100)}%"></i></div>` : ''}</button>
      <button class="hstat" data-action="go" data-to="shop"><b data-count="${listCount}">${listCount}</b><span>${lowCount ? `to buy · ${lowCount} low` : 'to buy'}</span></button>
    </div>
    <button class="hero-dinner" data-action="edit-meal" data-date="${t}">
      <span style="font-size:22px">🍽️</span>
      <span class="grow"><small>Tonight's dinner</small>${dinner ? esc(dinner) : 'Tap to plan dinner'}</span>
      ${ICON.chev}
    </button>
  </section>`;
}

function eventRow(e, showDate) {
  if (e.kind === 'todo') return `<div class="row cal-todo${e.done ? ' done' : ''}"><div class="time-col">${showDate ? fmtDate(e.date, { weekday: 'short', day: 'numeric' }) : 'To-do'}</div>
    <button class="check${e.done ? ' on' : ''}" data-action="todo-toggle" data-id="${e.id}" aria-label="Done">${ICON.check}</button>
    <button class="grow" style="text-align:left" data-action="todo-edit" data-id="${e.id}"><div class="title">${esc(e.title)}</div><div class="sub">${[e.overdue ? 'Overdue' : '', e.who?.id ? `${esc(e.who.emoji)} ${esc(e.who.name)}` : ''].filter(Boolean).join(' · ') || 'To-do'}</div></button></div>`;
  const clickable = ['event', 'birthday', 'bill', 'project', 'upkeep', 'goal'].includes(e.kind);
  const action = e.kind === 'event' ? `data-action="edit-event" data-id="${e.id}"${e.date ? ` data-date="${e.date}"` : ''}`
    : e.kind === 'birthday' ? `data-action="go" data-to="person/${e.id}"`
    : e.kind === 'bill' ? `data-action="edit-bill" data-id="${e.id}"`
    : e.kind === 'project' ? `data-action="go" data-to="project/${e.id}"`
    : e.kind === 'upkeep' ? `data-action="upkeep-edit" data-id="${e.id}"`
    : e.kind === 'goal' ? `data-action="go" data-to="goal/${e.id}"` : '';
  const timeLabel = e.time ? fmtTime(e.time) : (e.kind === 'holiday' ? 'Holiday' : 'All day');
  return `<${clickable ? 'button' : 'div'} class="row${clickable ? ' tap' : ''}" style="width:100%;text-align:left" ${action}>
    <div class="time-col">${showDate ? fmtDate(e.date, { weekday: 'short', day: 'numeric' }) : timeLabel}</div>
    <div class="dot" style="background:${e.color}"></div>
    <div class="grow"><div class="title">${esc(e.title)}</div>
      <div class="sub">${[showDate ? timeLabel : '', e.who && e.who.id ? `${esc(e.who.emoji)} ${esc(e.who.name)}` : '', e.location ? `📍 ${esc(e.location)}` : ''].filter(Boolean).join(' · ')}</div>${typeof rsvpLine === 'function' ? rsvpLine(e) : ''}
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
    const mFrom = ym + '-01', mTo = dayInMonth(31, ym);
    const incM = sum(recurringBetween(mFrom, mTo, 'income'), (x) => x.amount);
    const billM = sum(recurringBetween(mFrom, mTo, 'bill'), (x) => x.amount);
    const flexB = sum(state.budget.categories, (c) => Math.max(0, (c.limit || 0) - sum(recurringBetween(mFrom, mTo, 'bill').filter((x) => x.b.categoryId === c.id), (x) => x.amount)));
    const leftover = incM - billM - flexB; // bills already inside a category budget aren't counted twice
    body = `
      ${ym === monthKey(today()) ? safeHero() : ''}
      ${state.budget.bills.length ? `<div class="card">
        <h3>${parse(mFrom).toLocaleDateString(undefined, { month: 'long' })} cash flow</h3>
        <div class="kv"><span class="muted">Expected income</span><b style="color:var(--good)">+${moneyW(incM)}</b></div>
        <div class="kv"><span class="muted">Recurring bills</span><b>−${moneyW(billM)}</b></div>
        <div class="kv"><span class="muted">Everyday spending budget</span><b>−${moneyW(flexB)}</b></div>
        <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>Unbudgeted this month</span><b style="color:${leftover < 0 ? 'var(--bad)' : 'var(--good)'}">${moneyW(leftover)}</b></div>
      </div>` : ''}
      <div class="card">
        <div class="ring-wrap">
          <div class="ring"><span class="ring-label">${s.limit ? Math.round((s.spent / s.limit) * 100) : 0}%<small>used</small></span><svg viewBox="0 0 96 96"><circle class="track" cx="48" cy="48" r="42"/><circle class="val ${levelCls(s.limit ? s.spent / s.limit : 0)}" cx="48" cy="48" r="42" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}" stroke-linecap="round"/></svg></div>
          <div class="grow" style="flex:1">
            <div class="kv"><span class="muted">Budget</span><b>${moneyW(s.limit)}</b></div>
            <div class="kv"><span class="muted">Spent</span><b>${moneyW(s.spent)}</b></div>
            <div class="kv"><span class="muted">Budget left</span><b style="color:${s.left < 0 ? 'var(--bad)' : 'var(--good)'}">${moneyW(s.left)}</b></div>
            ${s.income ? `<div class="kv"><span class="muted">Income</span><b>${moneyW(s.income)}</b></div>` : ''}
            ${ym === monthKey(today()) && s.limit && s.left > 0 ? `<div class="allowance">≈ <b>${money(s.left / (new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate() - parse(today()).getDate() + 1), { maximumFractionDigits: 0 })}/day</b> for the rest of the month</div>` : ''}
          </div>
        </div>
      </div>
      <div class="section-title">Categories<button data-action="add-category">+ Category</button></div>
      <div class="card">
        ${state.budget.categories.map((c) => {
          const spent = sum(s.tx.filter((t) => t.type !== 'income' && t.categoryId === c.id), (t) => t.amount);
          const lim = catLimit(c, ym), f = lim ? spent / lim : 0;
          return `<button class="cat-row" style="display:block;width:100%;text-align:left" data-action="edit-category" data-id="${c.id}">
            <div class="top"><span>${esc(c.emoji)} ${esc(c.name)}</span><span>${money(spent, { maximumFractionDigits: 0 })}${lim ? ` / ${money(lim, { maximumFractionDigits: 0 })}${lim !== c.limit ? ' ↻' : ''}` : ''}</span></div>
            ${lim ? `<div class="bar"><i class="${levelCls(f)}" style="width:${Math.min(100, f * 100)}%"></i></div>` : ''}
          </button>`;
        }).join('') || '<div class="empty small">No categories yet.</div>'}
        ${(() => { const ids = new Set(state.budget.categories.map((c) => c.id)); const other = sum(s.tx.filter((t) => t.type !== 'income' && !ids.has(t.categoryId) && !isBillOnly(t)), (t) => t.amount); return other ? `<button class="cat-row" style="display:block;width:100%;text-align:left" data-action="budget-tab" data-tab="activity"><div class="top"><span>📦 Uncategorized</span><span>${moneyW(other)}</span></div></button>` : ''; })()}
        ${s.bills ? `<button class="cat-row" style="display:block;width:100%;text-align:left" data-action="budget-tab" data-tab="bills"><div class="top"><span>🧾 Bills paid <span class="muted small">outside the budget</span></span><span>${moneyW(s.bills)}</span></div></button>` : ''}
      </div>`;
  } else if (tab === 'activity') {
    const byDate = {};
    for (const t of [...s.tx].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0))) (byDate[t.date] ||= []).push(t);
    body = Object.keys(byDate).length ? Object.entries(byDate).map(([d, list]) => `
      <div class="section-title"><span>${fmtDate(d)}</span><span class="small" style="text-transform:none">${moneyW(sum(list.filter((t) => t.type !== 'income'), (t) => t.amount))}</span></div>
      <div class="card flush">${list.map((t) => {
        const bo = isBillOnly(t), c = bo ? { emoji: '🧾', name: `Bills · ${billGroupOf(t)}` } : category(t.categoryId);
        const m = t.memberId ? member(t.memberId) : null;
        return `<button class="row tap" style="width:100%;text-align:left" data-action="edit-tx" data-id="${t.id}">
          <div class="avatar">${t.type === 'income' ? '💰' : esc(c.emoji)}</div>
          <div class="grow"><div class="title">${esc(t.note || (t.type === 'income' ? 'Income' : c.name))}</div><div class="sub">${t.type === 'income' ? 'Income' : esc(c.name)}${m ? ` · ${esc(m.emoji)} ${esc(m.name)}` : ''}</div></div>
          <span class="amount ${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span>
        </button>`;
      }).join('')}</div>`).join('')
      : `<div class="card empty"><span class="big">🧾</span>No spending logged for ${fmtMonth(ym)}.<br>Tap + to add an expense.</div>`;
    body += `<div class="btn-row">${s.tx.length ? `<button class="btn secondary" data-action="export-csv">⬇️ Export ${esc(parse(ym + '-01').toLocaleDateString(undefined, { month: 'short' }))}</button>` : ''}${state.budget.transactions.length ? `<button class="btn secondary" data-action="export-csv" data-all="1">⬇️ All time</button>` : ''}<button class="btn secondary" data-action="import-csv">⬆️ Import bank CSV</button></div>`;
  } else if (tab === 'trends') {
    body = trendsView(ym);
  } else {
    body = recurringView();
  }

  return `
    ${tab === 'bills' ? '' : `    <div class="month-nav">
      <button class="icon-btn" data-action="budget-month" data-n="-1" aria-label="Previous month" >${ICON.left}</button>
      <h2>${fmtMonth(ym)}</h2>
      <button class="icon-btn" data-action="budget-month" data-n="1" aria-label="Next month" >${ICON.right}</button>
    </div>`}
    <div class="segmented">
      ${[['overview', 'Overview'], ['activity', 'Activity'], ['trends', 'Trends'], ['bills', 'Recurring']].map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="budget-tab" data-tab="${k}">${l}</button>`).join('')}
    </div>
    ${body}
    ${tab === 'bills' ? '' : `<button class="fab" data-action="add-tx" aria-label="Add transaction">${ICON.plus}</button>`}
  `;
};
function recurRow({ b, date, amount }) {
  const paid = isPaid(b, date);
  const inc = b.type === 'income';
  const n = daysBetween(today(), date);
  const late = !paid && n < 0 && !b.autopay && !inc && date >= (b.since || '');
  return `<div class="row${paid ? ' done' : ''}">
    ${letterAvatar(b.name)}
    <button class="grow" style="text-align:left" data-action="edit-bill" data-id="${b.id}">
      <div class="title">${esc(b.name)}</div>
      <div class="sub"><span style="${late ? 'color:var(--bad);font-weight:600' : ''}">${late ? 'Overdue · ' : ''}${cap(dueLabel(date))}</span> · ${fmtDate(date, { month: 'short', day: 'numeric' })}${b.autopay ? ' · Autopay' : ''}</div>
    </button>
    <span class="amount${inc ? ' income' : ''}">${inc ? '+' : ''}${money(amount ?? b.amount)}${b.varies && !(b.amounts && date in b.amounts) ? '<span class="small muted" style="font-weight:500"> est.</span>' : ''}</span>
    <button class="check${paid ? ' on' : ''}" data-action="toggle-bill" data-id="${b.id}" data-date="${date}" aria-label="${inc ? 'Received' : 'Paid'}">${ICON.check}</button>
  </div>`;
}

// Which paycheck pays which bills: each pay period's income minus the unpaid bills due before the next payday.
function paycheckPlan(n = 3) {
  const t = today(), pays = [];
  for (const x of recurringBetween(t, addDays(t, 120), 'income')) {
    const last = pays.at(-1);
    if (last && last.date === x.date) last.amount += x.amount; else pays.push({ date: x.date, amount: x.amount });
  }
  return pays.slice(0, n).map((p, i) => {
    const end = pays[i + 1] ? addDays(pays[i + 1].date, -1) : addDays(p.date, 13);
    const bills = recurringBetween(p.date, end, 'bill').filter((x) => !isPaid(x.b, x.date));
    const out = sum(bills, (x) => x.amount);
    return { ...p, end, bills, out, left: p.amount - out };
  });
}
function paycheckPlanCard() {
  const plan = paycheckPlan();
  if (plan.length < 2) return '';
  return `<div class="card"><h3>💵 Paycheck plan</h3>
    ${plan.map((p) => `<div class="kv"><span class="muted">${fmtDate(p.date, { month: 'short', day: 'numeric' })} pay · ${p.bills.length} bill${p.bills.length === 1 ? '' : 's'} through ${fmtDate(p.end, { month: 'short', day: 'numeric' })}</span><b style="color:${p.left < 0 ? 'var(--bad)' : 'var(--good)'}">${money(p.left, { maximumFractionDigits: 0 })} left</b></div>
      <div class="bar" style="margin:2px 0 8px"><i class="${levelCls(p.amount ? p.out / p.amount : 1)}" style="width:${Math.min(100, p.amount ? (p.out / p.amount) * 100 : 100)}%"></i></div>`).join('')}
    <div class="small muted">${plan.some((p) => p.left < 0) ? '⚠️ A paycheck doesn’t cover the bills due before the next one — move a due date or hold money back from the paycheck before it.' : 'Each paycheck covers the bills due before the next one.'}</div></div>`;
}
// Safe to spend. Default ('month' setting, shown as "2 paychecks") plans two pay periods: from today until the day before
// the second upcoming payday, so a paycheck also covers the bills it really pays — including the ones due early next
// month (mortgage, car…) before the paycheck after it arrives:
//   balance + paychecks in the window − overdue/unpaid bills in the window − everyday budget for the window.
// 'pay' looks only until the next payday. In the 2-paycheck view we still check that first stretch: if the bills due
// before the next paycheck need more than you have, `tight` says how much to hold back until then.
function planEnd(t = today()) {
  const days = [...new Set(recurringBetween(addDays(t, 1), addDays(t, 75), 'income').map((x) => x.date))].sort();
  // Two pay periods ≈ a month for weekly/biweekly/semi-monthly pay; monthly pay keeps one period
  if (days[1] && daysBetween(t, days[1]) <= 35) return addDays(days[1], -1);
  if (days[0]) return addDays(days[0], -1);
  return dayInMonth(31, monthKey(t));
}
function safeToSpend(mode = state.settings.stsMode || 'month') {
  const bal = balanceNow(), t = today();
  const pay = recurringBetween(t, addDays(t, 60), 'income').find((x) => !isPaid(x.b, x.date));
  if (bal == null) return null;
  const overdue = overdueBills(t);
  const period = () => {
    if (!pay) return null;
    const bills = [...overdue, ...recurringBetween(t, addDays(pay.date, -1), 'bill').filter((x) => !isPaid(x.b, x.date))];
    const owed = Math.round(sum(bills, (x) => x.amount) * 100) / 100, flex = flexUntil(pay.date, t);
    return { safe: Math.round((bal - owed - flex) * 100) / 100, owed, flex, bills };
  };
  const base = { bal, overdue: overdue.length, pay, stale: daysBetween(state.settings.balanceDate || t, t) };
  if (mode === 'pay') {
    const p = period(); if (!p) return null;
    return { ...base, ...p, mode, inc: 0, incs: [], perDay: p.safe / Math.max(1, daysBetween(t, pay.date)) };
  }
  const end = planEnd(t);
  const incs = recurringBetween(t, end, 'income').filter((x) => !isPaid(x.b, x.date));
  const inc = Math.round(sum(incs, (x) => x.amount) * 100) / 100;
  const bills = [...overdue, ...recurringBetween(t, end, 'bill').filter((x) => !isPaid(x.b, x.date))];
  const owed = Math.round(sum(bills, (x) => x.amount) * 100) / 100, flex = flexUntil(addDays(end, 1), t);
  const safe = Math.round((bal + inc - owed - flex) * 100) / 100;
  const p = pay && pay.date <= end ? period() : null;
  const tight = p && p.safe < 0 ? { by: -p.safe, until: pay.date } : null;
  return { ...base, mode, safe, owed, flex, bills, inc, incs, end, tight, perDay: safe / Math.max(1, daysBetween(t, end) + 1) };
}
// Budget Overview hero: safe to spend with a tap-to-expand breakdown.
function safeHero() {
  const s = safeToSpend(), t = today(), month = (state.settings.stsMode || 'month') === 'month';
  if (!s) {
    return `<div class="card sts-hero"><div class="stat-label">Safe to spend</div><p class="small muted" style="margin:4px 0 10px">Enter your checking balance to see what’s safe to spend ${month ? 'across your next two paychecks' : 'until payday'}.</p><button class="btn secondary block" data-action="edit-balance">Enter checking balance</button></div>`;
  }
  const when = s.mode === 'month' ? `through ${fmtDate(s.end, { month: 'short', day: 'numeric' })}` : `until payday ${fmtDate(s.pay.date, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  const mode = (m, l) => `<button class="mini-btn${(state.settings.stsMode || 'month') === m ? ' on' : ''}" data-action="sts-mode" data-m="${m}" aria-pressed="${(state.settings.stsMode || 'month') === m}">${l}</button>`;
  return `<details class="card sts-hero"${ui.stsOpen ? ' open' : ''}>
    <summary data-action="sts-toggle"><div class="stat-label">Safe to spend${s.mode === 'month' ? ` · next ${s.incs.length > 1 ? s.incs.length : 2} paychecks` : ''}</div>
      <div class="stat" style="color:${s.safe < 0 ? 'var(--bad)' : 'var(--good)'}">${moneyW(s.safe)}</div>
      <div class="small muted">${esc(when)} · after bills and your everyday budget${s.safe > 0 ? ` · +${moneyW(s.perDay)}/day extra` : ''} · <span class="sts-more">${ui.stsOpen ? 'hide' : 'how?'}</span></div>
      ${s.tight ? `<div class="small" style="color:var(--bad);font-weight:650;margin-top:4px">⚠️ Tight until payday ${esc(fmtDate(s.tight.until, { weekday: 'short' }))}: bills due first need ${moneyW(s.tight.by)} more than you have</div>` : ''}</summary>
    <div class="kv"><span class="muted">Checking balance${(state.settings.balanceDate || t) < t ? ' (est. today)' : ''}</span><b>${moneyW(s.bal)}</b></div>
    ${s.mode === 'month' ? `<div class="kv"><span class="muted">Paychecks by ${esc(fmtDate(s.end, { month: 'short', day: 'numeric' }))} (${s.incs.length})</span><b style="color:var(--good)">+${moneyW(s.inc)}</b></div>` : ''}
    <div class="kv"><span class="muted">Bills ${s.mode === 'month' ? `due by ${esc(fmtDate(s.end, { month: 'short', day: 'numeric' }))}` : 'before payday'} (${s.bills.length}${s.overdue ? `, ${s.overdue} overdue` : ''})</span><b>−${moneyW(s.owed)}</b></div>
    <div class="kv"><span class="muted">Everyday budget set aside (groceries, gas…)</span><b>−${moneyW(s.flex)}</b></div>
    <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>Extra safe to spend</span><b>${moneyW(s.safe)}</b></div>
    <div class="btn-row" style="margin:8px 0 0;flex-wrap:wrap"><span class="small muted" style="align-self:center">Plan by</span>${mode('month', '2 paychecks')}${mode('pay', 'Next paycheck')}</div>
    <div class="btn-row" style="margin:6px 0 0"><button class="mini-btn" data-action="edit-balance">Update balance</button><span class="small muted" style="align-self:center">${state.settings.balanceSrc === 'bank' ? '🏦 From your bank · ' : ''}Updated ${relDays(-s.stale).toLowerCase()}</span></div>
  </details>`;
}
// Yearly bills: how much to set aside each month so they're not a surprise.
function sinkingCard() {
  const t = today();
  const ys = state.budget.bills.filter((b) => b.type !== 'income' && b.freq === 'yearly' && b.anchor).map((b) => {
    const d = nextBillDate(b), amt = amountFor(b, d), months = Math.max(1, Math.ceil(daysBetween(t, d) / 30.44));
    return { b, d, amt, perMo: amt / months };
  }).sort((x, y) => x.d.localeCompare(y.d));
  if (!ys.length) return '';
  return `<div class="card"><h3>🫙 Set aside for yearly bills</h3>
    ${ys.map((x) => `<div class="kv"><span class="muted">${esc(x.b.name)} · ${money(x.amt, { maximumFractionDigits: 0 })} on ${fmtDate(x.d, { month: 'short', day: 'numeric' })}</span><b>${money(x.perMo, { maximumFractionDigits: 0 })}/mo</b></div>`).join('')}
    <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>Set aside each month</span><b>${money(sum(ys, (x) => x.perMo), { maximumFractionDigits: 0 })}</b></div></div>`;
}
function recurringView() {
  const t = today();
  const sub = ui.recurTab || 'upcoming';
  const overdue = overdueBills(t), odKey = new Set(overdue.map((x) => x.b.id + x.date));
  const toggle = `<div class="segmented" style="max-width:260px;margin:0 auto 14px">
    <button class="${sub === 'upcoming' ? 'active' : ''}" data-action="recur-tab" data-tab="upcoming">Upcoming</button>
    <button class="${sub === 'all' ? 'active' : ''}" data-action="recur-tab" data-tab="all">All</button></div>`;
  const fab = `<button class="fab" data-action="add-bill" aria-label="Add">${ICON.plus}</button>`;
  if (!state.budget.bills.length) {
    return toggle + `<div class="card empty"><span class="big">🔁</span>Track bills, subscriptions and paychecks.<br>See what's coming up and what's safe to spend.
      <div class="btn-row" style="margin-bottom:0"><button class="btn" data-action="add-bill">Add one</button><button class="btn secondary" data-action="bulk-bills">Bulk add</button></div></div>` + fab;
  }

  if (sub === 'all') {
    const inc = state.budget.bills.filter((b) => b.type === 'income');
    const bills = state.budget.bills.filter((b) => b.type !== 'income');
    const incM = sum(inc, perMonth), billM = sum(bills, perMonth);
    const groups = {};
    for (const b of bills) (groups[b.group || 'Other'] ||= []).push(b);
    const order = Object.keys(groups).sort((a, b) => sum(groups[b], perMonth) - sum(groups[a], perMonth));
    const row = (b) => { const nx = nextBillDate(b); return `<button class="row tap" style="width:100%;text-align:left" data-action="edit-bill" data-id="${b.id}">
      ${letterAvatar(b.name)}
      <div class="grow"><div class="title">${esc(b.name)}</div><div class="sub">${scheduleLabel(b)}${nx ? ` · next ${fmtDate(nx, { month: 'short', day: 'numeric' })}` : ''}</div></div>
      <span class="amount${b.type === 'income' ? ' income' : ''}">${b.type === 'income' ? '+' : ''}${money(b.amount)}</span></button>`; };
    return toggle + `
      <div class="card">
        <h3>Average month</h3>
        <div class="kv"><span class="muted">Income</span><b style="color:var(--good)">+${moneyW(incM)}</b></div>
        <div class="kv"><span class="muted">Bills &amp; subscriptions</span><b>−${moneyW(billM)}</b></div>
        <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>Left after bills</span><b style="color:${incM - billM < 0 ? 'var(--bad)' : 'var(--good)'}">${moneyW(incM - billM)}</b></div>
        ${incM ? `<div class="bar"><i class="${levelCls(billM / incM)}" style="width:${Math.min(100, (billM / incM) * 100)}%"></i></div><div class="small muted" style="margin-top:6px">Bills use ${Math.round((billM / incM) * 100)}% of income</div>` : ''}
      </div>
      ${sinkingCard()}
      ${inc.length ? `<div class="section-title"><span>Income</span><span class="small" style="text-transform:none">+${money(incM, { maximumFractionDigits: 0 })}/mo</span></div><div class="card flush">${inc.map(row).join('')}</div>` : ''}
      ${order.map((g) => g === 'Subscriptions' && views.subs ? `<button class="row tap card" style="width:100%;text-align:left;margin-top:14px" data-action="go" data-to="subs">
          <div class="avatar">🔁</div><div class="grow"><div class="title">Subscriptions</div><div class="sub">${groups[g].length} · ${moneyW(sum(groups[g], perMonth))}/mo · review and cancel</div></div>${ICON.chev}</button>`
        : `<div class="section-title"><span>${esc(g)}</span><span class="small" style="text-transform:none">${moneyW(sum(groups[g], perMonth))}/mo</span></div>
        <div class="card flush">${groups[g].sort((a, b) => b.amount - a.amount).map(row).join('')}</div>`).join('')}
      <div class="btn-row"><button class="btn secondary" data-action="bulk-bills">📋 Bulk add</button></div>
    ` + fab;
  }

  // Upcoming
  const next7 = recurringBetween(...dueWindow(t));
  const charges = next7.filter((x) => x.b.type !== 'income');
  const ws = weekStart(t);
  const strip = [...Array(14)].map((_, i) => {
    const d = addDays(ws, i);
    const occ = recurringBetween(d, d);
    const nBills = occ.filter((x) => x.b.type !== 'income').length;
    const hasInc = occ.some((x) => x.b.type === 'income');
    const tag = occ.length ? 'button' : 'div';
    return `<${tag} class="wk-day${d === t ? ' today' : ''}${d < t ? ' past' : ''}"${occ.length ? ` data-action="recur-day" data-date="${d}" aria-label="${esc(fmtDate(d))}: ${occ.length} item${occ.length > 1 ? 's' : ''}"` : ''}>
      <span>${parse(d).getDate()}</span>${hasInc ? '<em>$</em>' : ''}
      <div class="dots">${'<i></i>'.repeat(Math.min(nBills, 3))}</div></${tag}>`;
  }).join('');

  const pay = recurringBetween(t, addDays(t, 60), 'income')[0];
  let payCard = '';
  if (pay) {
    const sts = safeToSpend('pay');
    const before = sts ? sts.bills : [...overdue, ...recurringBetween(t, addDays(pay.date, -1), 'bill').filter((x) => !isPaid(x.b, x.date))];
    const owed = sum(before, (x) => x.amount);
    const bal = sts?.bal;
    const safe = sts ? sts.safe : null;
    payCard = `<div class="card">
      <h3>Until payday</h3>
      <div class="kv"><span class="muted">💰 ${esc(pay.b.name)}</span><b style="color:var(--good)">${cap(dueLabel(pay.date))}</b></div>
      <div class="kv"><span class="muted">Bills due before then (${before.length}${overdue.length ? `, ${overdue.length} overdue` : ''})</span><b>${moneyW(owed)}</b></div>
      ${safe != null ? `
        <div class="kv"><span class="muted">Checking balance${(state.settings.balanceDate || t) < t ? ' (est. today)' : ''}</span><b>${moneyW(bal)}</b></div>
        <div class="kv"><span class="muted">Planned everyday spending</span><b>${moneyW(sts.flex)}</b></div>
        <div style="border-top:1px solid var(--line);margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:end">
          <div><div class="stat-label">Safe until payday</div><div class="stat" style="color:${safe < 0 ? 'var(--bad)' : 'var(--good)'}">${moneyW(safe)}</div>${(() => { const m = (state.settings.stsMode || 'month') === 'month' ? safeToSpend('month') : null; return m ? `<div class="small muted">Across 2 paychecks (to ${esc(fmtDate(m.end, { month: 'short', day: 'numeric' }))}): <b>${moneyW(m.safe)}</b></div>` : ''; })()}</div>
          <button class="mini-btn" data-action="edit-balance">Update balance</button>
        </div>
        <div class="small muted">Balance updated ${relDays(-daysBetween(state.settings.balanceDate || t, t)).toLowerCase()}</div>`
      : `<button class="btn secondary block" style="margin-top:10px" data-action="edit-balance">Enter checking balance to see safe-to-spend</button>`}
    </div>`;
  }

  const recent = recurringBetween(addDays(t, -7), addDays(t, -1)).filter((x) => !odKey.has(x.b.id + x.date));
  const soon = next7;
  const later = recurringBetween(addDays(dueWindow(t)[1], 1), addDays(t, 30));
  const section = (title, list) => list.length ? `<div class="section-title"><span>${title}</span><span class="small" style="text-transform:none">${moneyW(sum(list.filter((x) => x.b.type !== 'income'), (x) => x.amount))}</span></div><div class="card flush">${list.map(recurRow).join('')}</div>` : '';
  // Page 1 is for paying: a compact summary, then overdue / due rows with their check circles.
  return `
    <div class="card">
      <h3 style="display:flex;justify-content:space-between;align-items:center;margin-top:-4px">Coming up<button class="mini-btn" style="text-transform:none;letter-spacing:0" data-action="recur-tab" data-tab="all">All recurring ›</button></h3>
      <p style="margin:0 0 8px">${charges.length ? `<b>${charges.length}</b> charge${charges.length > 1 ? 's' : ''} · <b>${moneyW(sum(charges, (x) => x.amount))}</b> in the next 7 days` : 'No recurring charges in the next 7 days. 🎉'}</p>
      <div class="wk compact">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${strip}</div>
    </div>
    ${section('⚠️ Overdue', overdue)}
    ${section('Due next 7 days', soon)}
    ${payCard}
    ${paycheckPlanCard()}
    ${typeof forecastCard === 'function' ? forecastCard() : ''}
    ${section('Coming later', later)}
    ${section('Recent', recent)}
  ` + fab;
}

/* ---------- Spending trends ---------- */
const spentIn = (ym, catId) => sum(state.budget.transactions.filter((t) => t.type !== 'income' && t.date.startsWith(ym) && (catId === undefined || t.categoryId === catId)), (t) => t.amount);
// Rounded-top bar anchored to the baseline.
function barPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

// Month-end estimate: everyday spending so far at its daily pace, plus bills logged and bills still due this month.
function projectedSpend(ym, t = today()) {
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate(), day = parse(t).getDate();
  const tx = state.budget.transactions.filter((x) => x.type !== 'income' && x.date.startsWith(ym) && x.date <= t);
  const flex = sum(tx.filter((x) => !x.fromBill), (x) => x.amount), bills = sum(tx.filter((x) => x.fromBill), (x) => x.amount);
  const due = sum(recurringBetween(t, dayInMonth(31, ym), 'bill').filter((x) => !isPaid(x.b, x.date)), (x) => x.amount);
  return Math.round(flex + bills + (flex / day) * (dim - day) + due);
}
function trendsView(ym) {
  const months = [...Array(6)].map((_, i) => addMonths(ym, i - 5));
  const totals = months.map((m) => spentIn(m));
  const hasAny = totals.some((v) => v > 0);
  if (!hasAny) return `<div class="card empty"><span class="big">📊</span>Log some spending and your trends will show up here.</div>`;
  const sel = months.includes(ui.trendSel) ? ui.trendSel : ym;
  const selIdx = months.indexOf(sel);
  const prev = addMonths(sel, -1);
  const past = totals.slice(0, 5).filter((v) => v > 0);
  const avg = past.length ? sum(past, (v) => v) / past.length : 0;

  // Projected month-end for the current month (ghost bar)
  const t = today(), curI = months.indexOf(monthKey(t));
  const proj = curI >= 0 ? projectedSpend(months[curI], t) : 0;
  // Chart geometry (viewBox units)
  const W = 340, H = 170, top = 22, bottom = 26, left = 4, right = 4;
  const plotH = H - top - bottom, colW = (W - left - right) / 6, barW = Math.min(30, colW * 0.5);
  const max = niceMax(Math.max(...totals, avg, proj));
  const y = (v) => top + plotH - (v / max) * plotH;
  const bars = months.map((m, i) => {
    const v = totals[i];
    const x = left + colW * i + (colW - barW) / 2;
    const isSel = i === selIdx;
    return `<g>
      ${i === curI && proj > v ? `<path class="chart-ghost" d="${barPath(x, y(proj), barW, top + plotH - y(proj))}" fill="var(--accent)" fill-opacity=".12" stroke="var(--accent)" stroke-opacity=".55" stroke-dasharray="3 3"/>` : ''}
      <path d="${barPath(x, y(v), barW, top + plotH - y(v))}" fill="var(--accent)" opacity="${isSel ? 1 : 0.38}"/>
      ${isSel ? `<text x="${x + barW / 2}" y="${y(v) - 7}" text-anchor="middle" class="chart-val">${esc(money(v, { maximumFractionDigits: 0 }))}</text>` : ''}
      <text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" class="chart-lbl${isSel ? ' sel' : ''}">${parse(m + '-01').toLocaleDateString(undefined, { month: 'short' })}</text>
      <rect x="${left + colW * i}" y="0" width="${colW}" height="${H}" fill="transparent" data-action="trend-month" data-ym="${m}" style="cursor:pointer"><title>${fmtMonth(m)}: ${money(v)}</title></rect>
    </g>`;
  }).join('');
  const avgLine = avg ? `<line x1="${left}" x2="${W - right}" y1="${y(avg)}" y2="${y(avg)}" class="chart-avg"/>` : '';
  const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending per month, last 6 months">
    <line x1="${left}" x2="${W - right}" y1="${top + plotH}" y2="${top + plotH}" class="chart-base"/>
    ${avgLine}${bars}</svg>`;

  // Pace: this month so far vs the same point last month
  let pace = '';
  if (sel === monthKey(t)) {
    const day = parse(t).getDate();
    const lastSame = sum(state.budget.transactions.filter((x) => x.type !== 'income' && x.date.startsWith(prev) && parse(x.date).getDate() <= day), (x) => x.amount);
    const now = totals[selIdx];
    if (lastSame > 0) {
      const diff = now - lastSame;
      const pct = Math.round((Math.abs(diff) / lastSame) * 100);
      pace = `<div class="card"><div class="stat-label">Pace vs. last month</div>
        <div style="font-size:17px;font-weight:650;margin-top:2px">${diff > 0 ? '▲' : '▼'} ${money(Math.abs(diff), { maximumFractionDigits: 0 })} ${diff > 0 ? 'more' : 'less'} <span class="muted" style="font-weight:500">(${pct}%)</span></div>
        <div class="small muted">than by day ${day} of ${parse(prev + '-01').toLocaleDateString(undefined, { month: 'long' })} — ${diff > 0 ? 'spending is running ahead' : 'nice, you\'re spending less'}</div></div>`;
    }
  }

  // Where it went — for the current month, each row is compared with last month up to the same day.
  const isCur = sel === monthKey(t), cut = isCur ? parse(t).getDate() : 31;
  const prevLbl = parse(prev + '-01').toLocaleDateString(undefined, { month: 'short' }) + (isCur ? ` 1–${Math.min(cut, new Date(+prev.slice(0, 4), +prev.slice(5), 0).getDate())}` : '');
  const out = (m, f) => sum(state.budget.transactions.filter((x) => x.type !== 'income' && x.date.startsWith(m) && (m !== prev || parse(x.date).getDate() <= cut) && f(x)), (x) => x.amount);
  const known = (x) => state.budget.categories.some((k) => k.id === x.categoryId);
  const groups = [...new Set(state.budget.transactions.filter((x) => isBillOnly(x) && (x.date.startsWith(sel) || x.date.startsWith(prev))).map(billGroupOf))];
  const cats = [...state.budget.categories.map((c) => ({ c, f: (x) => x.categoryId === c.id })),
    { c: { emoji: '📦', name: 'Uncategorized' }, f: (x) => !known(x) && !isBillOnly(x) },
    ...groups.map((g) => ({ c: { emoji: '🧾', name: `Bills · ${g}` }, f: (x) => isBillOnly(x) && billGroupOf(x) === g }))]
    .map(({ c, f }) => ({ c, v: out(sel, f), pv: out(prev, f) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const selTotal = totals[selIdx] || 1;
  const topCat = cats[0] ? cats[0].v : 1;
  const where = cats.map(({ c, v, pv }) => {
    const d = v - pv;
    return `<div class="cat-row">
      <div class="top"><span>${esc(c.emoji)} ${esc(c.name)} <span class="muted small">${Math.round((v / selTotal) * 100)}%</span></span><span>${money(v, { maximumFractionDigits: 0 })}</span></div>
      <div class="bar"><i style="width:${(v / topCat) * 100}%;background:var(--accent)"></i></div>
      ${pv || v ? `<div class="small muted" style="margin-top:3px">${pv ? `${d >= 0 ? '▲' : '▼'} ${moneyW(Math.abs(d))} vs ${esc(prevLbl)}` : isCur ? `None by this day in ${esc(prevLbl.split(' ')[0])}` : `New this month`}</div>` : ''}
    </div>`;
  }).join('');

  const biggest = state.budget.transactions.filter((x) => x.type !== 'income' && x.date.startsWith(sel)).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const income = sum(state.budget.transactions.filter((x) => x.type === 'income' && x.date.startsWith(sel)), (x) => x.amount);

  return `
    <div class="card">
      <h3>Spending · last 6 months</h3>
      ${chart}
      <div class="small muted" style="text-align:center">${avg ? `<span class="avg-key"></span> Average ${esc(moneyW(avg))}/mo · ` : ''}${proj > (totals[curI] || 0) ? `<span class="ghost-key"></span> On pace for ${esc(moneyW(proj))} · ` : ''}Tap a month for details</div>
    </div>
    ${pace}
    ${income ? `<div class="card">
      <h3>${fmtMonth(sel)}</h3>
      <div class="kv"><span class="muted">Money in</span><b>${moneyW(income)}</b></div>
      <div class="kv"><span class="muted">Money out</span><b>${moneyW(totals[selIdx])}</b></div>
      ${(() => {
        // The current month isn't over: count the pay still coming and the projected spending, not just today's totals
        const cur = sel === monthKey(t), coming = cur ? sum(recurringBetween(t, dayInMonth(31, sel), 'income').filter((x) => !isPaid(x.b, x.date)), (x) => x.amount) : 0;
        if (cur && coming > 0) {
          const net = income + coming - Math.max(proj, totals[selIdx]);
          return `<div class="kv"><span class="muted">Pay still coming</span><b style="color:var(--good)">+${moneyW(coming)}</b></div>
            <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>${net >= 0 ? 'On track to save' : 'On track to overspend'}</span><b style="color:${net >= 0 ? 'var(--good)' : 'var(--bad)'}">${moneyW(Math.abs(net))}</b></div>
            <div class="small muted">By month end, at this month’s pace</div>`;
        }
        return `<div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>${income >= totals[selIdx] ? 'Saved' : 'Overspent'}</span><b>${moneyW(Math.abs(income - totals[selIdx]))} <span class="muted small" style="font-weight:500">(${Math.round((Math.abs(income - totals[selIdx]) / income) * 100)}% of income)</span></b></div>`;
      })()}
    </div>` : ''}
    <div class="section-title">Where it went · ${parse(sel + '-01').toLocaleDateString(undefined, { month: 'long' })}</div>
    <div class="card">${where || '<div class="empty small">No spending this month.</div>'}</div>
    ${biggest.length ? `<div class="section-title">Biggest expenses</div>
    <div class="card flush">${biggest.map((x) => `<button class="row tap" style="width:100%;text-align:left" data-action="edit-tx" data-id="${x.id}">
      <div class="avatar">${isBillOnly(x) ? '🧾' : esc(category(x.categoryId).emoji)}</div>
      <div class="grow"><div class="title">${esc(x.note || category(x.categoryId).name)}</div><div class="sub">${fmtDate(x.date)} · ${esc(isBillOnly(x) ? `Bills · ${billGroupOf(x)}` : category(x.categoryId).name)}</div></div>
      <span class="amount">${money(x.amount)}</span></button>`).join('')}</div>` : ''}
  `;
}

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
        <input type="text" name="newItem" aria-label="Add an item" placeholder="Add an item…" enterkeyhint="done" autocomplete="off" list="stapleNames">
        <button class="btn" type="submit" aria-label="Add">${ICON.plus}</button>
        ${open.length ? `<button type="button" class="btn secondary shop-go" data-action="go" data-to="store" aria-label="Start shopping (store mode)">🛍️ Shop</button>` : ''}
      </form>
      <datalist id="stapleNames">${state.shop.staples.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>

      ${open.length ? order.map((a) => `
        <div class="section-title">${esc(a)}</div>
        <div class="card flush">${groups[a].map(shopRow).join('')}</div>`).join('')
        : `<div class="card empty"><span class="big">🛒</span>The list is empty.<br>Add items above or from your staples.</div>`}

      ${suggestions.length ? `<div class="small muted" style="margin:10px 4px 6px">Running low — tap to add:</div>
        <div class="chips">${suggestions.map((s) => `<button class="chip" data-action="staple-to-list" data-id="${s.id}">+ ${esc(s.name)}</button>`).join('')}</div>` : ''}

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
  ${i.by && state.members.length > 1 && state.members.some((m) => m.id === i.by) ? `<span class="added-by" title="Added by ${esc(member(i.by).name)}" style="--c:${member(i.by).color}">${esc((member(i.by).name.match(/\p{L}|\d/u) || ['?'])[0].toUpperCase())}</span>` : ''}
  <button class="del-btn" data-action="del-item" data-id="${i.id}" aria-label="Remove">${ICON.x}</button>
</div>`;

/* ---------- Calendar ---------- */
views.calendar = () => {
  if (ui.calView === 'agenda' && typeof agendaView === 'function') return calendarTabs() + agendaView();
  const ym = ui.calMonth;
  const first = parse(ym + '-01');
  // On phones the month grid and the day's agenda don't both fit, so the grid folds to the selected week.
  const week = !calFullMonth();
  const start = week ? weekStart(ui.calSel) : addDays(iso(first), -((first.getDay() + 6) % 7)); // grid starts Monday
  const t = today();
  const cells = [];
  for (let i = 0; i < (week ? 7 : 42); i++) {
    const s = addDays(start, i);
    if (i === 35 && s.slice(0, 7) !== ym) break; // drop empty 6th row
    const evs = calEventsOn(s);
    cells.push(`<button class="cal-day${s.slice(0, 7) !== ym ? ' other' : ''}${s === t ? ' today' : ''}${s === ui.calSel ? ' sel' : ''}" data-action="cal-select" data-date="${s}">
      <span>${parse(s).getDate()}</span>
      <div class="dots">${evs.slice(0, 3).map((e) => `<i style="background:${e.color}"></i>`).join('')}</div>
    </button>`);
  }
  const sel = calEventsOn(ui.calSel);
  const unit = week ? 'week' : 'month';
  return `${typeof calendarTabs === 'function' ? calendarTabs() : ''}
    <div class="month-nav">
      <button class="icon-btn" data-action="${week ? 'cal-week' : 'cal-month'}" data-n="-1" aria-label="Previous ${unit}">${ICON.left}</button>
      <h2>${fmtMonth(week ? monthKey(ui.calSel) : ym)}</h2>
      <button class="icon-btn" data-action="${week ? 'cal-week' : 'cal-month'}" data-n="1" aria-label="Next ${unit}">${ICON.right}</button>
    </div>
    <div class="card cal${week ? ' cal-week' : ''}">
      <div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
      <button class="cal-fold" data-action="cal-full" aria-expanded="${!week}">${week ? 'Show whole month ▾' : 'Show one week ▴'}</button>
    </div>
    <div class="section-title cal-day-title">${ui.calSel === t ? 'Today' : fmtDate(ui.calSel, { weekday: 'long', month: 'long', day: 'numeric' })}
      ${ui.calSel !== t ? '<button data-action="cal-today">Today</button>' : ''}</div>
    <div class="card flush cal-agenda">${sel.length ? sel.map((e) => eventRow(e)).join('') : '<div class="empty small">Nothing planned. Tap + to add something.</div>'}</div>
    ${state.members.length > 1 ? `<div class="legend who-filter">
      <button class="${!ui.calWho ? 'on' : ''}" data-action="cal-who" data-id="">Everyone</button>
      ${state.members.map((m) => `<button class="${ui.calWho === m.id ? 'on' : ''}" data-action="cal-who" data-id="${m.id}" style="--c:${m.color}"><i class="dot" style="background:${m.color}"></i>${esc(m.name)}</button>`).join('')}</div>` : ''}
    <button class="fab" data-action="add-event" data-date="${ui.calSel}" aria-label="Add event">${ICON.plus}</button>
  `;
};
// Whole month only when there's room for it plus the day's agenda (or the family asked for it).
const calRoomy = () => (typeof pgWide === 'function' && pgWide()) || innerHeight >= 1000 || (typeof pgOn === 'function' && !pgOn());
const calFullMonth = () => ui.calFull ?? calRoomy();

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
  if (ui.mealsTab === 'recipes' && typeof recipesView === 'function') return mealsTabs() + recipesView();
  const t = today();
  // This week starts at tonight and runs 7 nights; the days already past fold into one small row.
  const cur = ui.mealsWeek === weekStart(t);
  const ws = cur ? t : ui.mealsWeek;
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const past = cur ? [...Array(daysBetween(weekStart(t), t))].map((_, i) => addDays(weekStart(t), i)) : [];
  const planned = days.filter((d) => state.meals[d]?.dinner).length;
  const ingredients = days.flatMap((d) => splitList(state.meals[d]?.ingredients));
  const dayRow = (d) => {
    const m = state.meals[d] || {};
    const n = splitList(m.ingredients).length;
    return `<button class="row tap meal-day${d === t ? ' today' : ''}" style="width:100%;text-align:left" data-action="edit-meal" data-date="${d}">
      <div class="day-label">${d === t ? 'Today' : fmtDate(d, { weekday: 'short' })} <span>${parse(d).getDate()}</span></div>
      <div class="grow"><div class="title" style="${m.dinner ? '' : 'color:var(--muted);font-weight:500'}">${m.dinner ? esc(m.dinner) : 'Plan dinner…'}</div></div>
      ${n ? `<span class="small muted">${n} item${n > 1 ? 's' : ''}</span>` : ''}${ICON.chev}
    </button>`;
  };
  return `${typeof mealsTabs === 'function' ? mealsTabs() : ''}
    <div class="month-nav">
      <button class="icon-btn" data-action="meals-week" data-n="-7" aria-label="Previous week">${ICON.left}</button>
      <h2>${fmtDate(ws, { month: 'short', day: 'numeric' })} – ${fmtDate(addDays(ws, 6), parse(ws).getMonth() === parse(addDays(ws, 6)).getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}${cur ? ' <span class="pill accent" style="vertical-align:middle">This week</span>' : ''}</h2>
      <button class="icon-btn" data-action="meals-week" data-n="7" aria-label="Next week">${ICON.right}</button>
    </div>
    <div class="card flush">
      ${past.length ? (ui.mealsEarlier ? past.map(dayRow).join('') : `<button class="row tap meal-earlier" style="width:100%;text-align:left" data-action="meals-earlier"><div class="grow small muted">Earlier this week · ${past.filter((d) => state.meals[d]?.dinner).length} of ${past.length} planned</div><span class="small muted">Show ▾</span></button>`) : ''}
      ${days.map(dayRow).join('')}
    </div>
    <div class="btn-row">
      ${ingredients.length ? `<button class="btn" data-action="week-to-list">🛒 Add week's ingredients to list</button>` : ''}
    </div>
    <p class="small muted" style="margin:0 4px">${planned}/7 dinners planned. Meals you've made before autocomplete with their ingredients.</p>
  `;
};
// The 7 nights the Meals screen shows (and Home counts): tonight onward for this week.
const mealNights = () => { const ws = ui.mealsWeek === weekStart(today()) ? today() : ui.mealsWeek; return [...Array(7)].map((_, i) => addDays(ws, i)); };
const splitList = (s) => String(s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
function mealHistory() {
  const byName = {};
  for (const [d, m] of Object.entries(state.meals)) {
    if (!m.dinner) continue;
    const k = norm(m.dinner);
    if (!byName[k] || d > byName[k].date) byName[k] = { name: m.dinner, ingredients: m.ingredients || '', date: d };
  }
  for (const r of state.recipes || []) {
    const k = norm(r.name);
    if (!byName[k]) byName[k] = { name: r.name, ingredients: splitList(r.ingredients).join(', '), date: '' };
  }
  return Object.values(byName);
}

/* ---------- Chores ---------- */
/* ---------- House projects ---------- */
const PROJECT_STATUS = ['idea', 'planned', 'active', 'done'];
const PROJECT_STATUS_LABEL = { idea: '💡 Idea', planned: '📋 Planned', active: '🔨 In progress', done: '✅ Done' };
const PROJECT_STATUS_CLS = { idea: '', planned: 'warn', active: 'accent', done: 'good' };
const PRIORITY_LABEL = { high: '🔴 High', med: '🟡 Medium', low: '⚪ Low' };
const PROJECT_EMOJI = ['🔨', '🎨', '🛁', '🍳', '🛋️', '🛏️', '🌱', '🧰', '🚪', '💡', '🪴', '🏡'];
const PROJECT_TEMPLATES = {
  paint: { name: 'Paint a room', emoji: '🎨', room: '',
    steps: [['Pick colors & get samples', 1], ['Move furniture & cover floors', 1], ['Patch holes & sand', 1.5], ['Tape trim & edges', 1], ['Prime', 2], ['Paint first coat', 3], ['Paint second coat', 3], ['Remove tape & clean up', 1]],
    items: [['Paint (gallon)', 2, 45], ['Primer (gallon)', 1, 30], ['Roller covers', 3, 6], ['Brushes', 2, 10], ["Painter's tape", 2, 7], ['Drop cloth', 2, 12], ['Spackle', 1, 8], ['Sandpaper', 1, 6]] },
  garden: { name: 'Raised garden bed', emoji: '🌱', room: 'Backyard',
    steps: [['Pick a spot & measure', 0.5], ['Buy materials', 1.5], ['Cut boards', 1], ['Assemble frame', 2], ['Level & place frame', 1], ['Fill with soil', 1.5], ['Plant', 1]],
    items: [['Cedar boards 2x8x8', 4, 28], ['Deck screws (box)', 1, 12], ['Landscape fabric', 1, 15], ['Garden soil (bag)', 10, 8], ['Compost (bag)', 4, 9], ['Plants / seeds', 1, 40]] },
  bath: { name: 'Bathroom refresh', emoji: '🛁', room: 'Bathroom',
    steps: [['Measure & plan', 1], ['Remove old fixtures', 2], ['Re-caulk tub & sink', 1.5], ['Paint', 4], ['Install mirror & lights', 2], ['Install towel bars & hardware', 1.5], ['Deep clean', 1]],
    items: [['Silicone caulk', 2, 9], ['Paint (gallon)', 1, 45], ['Mirror', 1, 120], ['Light fixture', 1, 90], ['Towel bar set', 1, 40], ['Shower curtain & rod', 1, 35]] },
  garage: { name: 'Garage clean-out', emoji: '🧰', room: 'Garage',
    steps: [['Sort: keep / donate / trash', 4], ['Haul donations', 1], ['Sweep & clean floor', 1.5], ['Install shelving', 3], ['Hang tools & label bins', 2]],
    items: [['Storage bins', 8, 12], ['Shelving unit', 2, 80], ['Wall hooks', 1, 25], ['Trash bags (box)', 1, 15], ['Labels', 1, 8]] },
};

const itemTotal = (i) => Math.round((Number(i.cost) || 0) * (i.qty === 0 || i.qty === '0' ? 0 : Number(i.qty) || 1) * 100) / 100;
function projectStats(pr) {
  const est = sum(pr.items, itemTotal);
  const spent = sum(pr.items.filter((i) => i.bought), itemTotal);
  const hours = sum(pr.steps, (t) => t.hours);
  const hoursDone = sum(pr.steps.filter((t) => t.done), (t) => t.hours);
  const stepsDone = pr.steps.filter((t) => t.done).length;
  const pct = pr.status === 'done' ? 1 : pr.steps.length ? stepsDone / pr.steps.length : pr.items.length ? pr.items.filter((i) => i.bought).length / pr.items.length : 0;
  return { est, spent, hours, hoursDone, stepsDone, pct, toBuy: pr.items.filter((i) => !i.bought).length };
}
const fmtHours = (h) => (h ? `${Math.round(h * 10) / 10} hr${h === 1 ? '' : 's'}` : '—');

views.projects = () => {
  const filter = ui.projFilter || 'open';
  const t = today();
  const prio = { high: 0, med: 1, low: 2 };
  const list = state.projects
    .filter((p) => (filter === 'done') === (p.status === 'done'))
    .sort((a, b) => filter === 'done'
      ? (b.doneDate || '').localeCompare(a.doneDate || '')
      : PROJECT_STATUS.indexOf(b.status) - PROJECT_STATUS.indexOf(a.status) || (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const open = state.projects.filter((p) => p.status !== 'done');
  const totals = open.reduce((acc, p) => { const st = projectStats(p); acc.est += st.est; acc.spent += st.spent; acc.hours += st.hours - st.hoursDone; return acc; }, { est: 0, spent: 0, hours: 0 });
  return `
    ${open.length ? `<div class="grid2">
      <div class="card"><div class="stat-label">Open projects cost</div><div class="stat">${money(totals.est, { maximumFractionDigits: 0 })}</div><div class="small muted">${money(totals.spent, { maximumFractionDigits: 0 })} spent so far</div></div>
      <div class="card"><div class="stat-label">Work left</div><div class="stat">${Math.round(totals.hours)} <span class="small muted" style="font-weight:500">hrs</span></div><div class="small muted">across ${open.length} project${open.length > 1 ? 's' : ''}</div></div>
    </div>` : ''}
    <div class="segmented">
      <button class="${filter === 'open' ? 'active' : ''}" data-action="proj-filter" data-f="open">Open (${open.length})</button>
      <button class="${filter === 'done' ? 'active' : ''}" data-action="proj-filter" data-f="done">Done (${state.projects.length - open.length})</button>
    </div>
    ${list.map((p) => {
      const st = projectStats(p);
      const due = p.dueDate && p.status !== 'done' ? daysBetween(t, p.dueDate) : null;
      return `<button class="card tile" data-action="go" data-to="project/${p.id}">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="avatar" style="width:44px;height:44px;flex-basis:44px;font-size:22px">${esc(p.emoji || '🔨')}</div>
          <div style="flex:1;min-width:0">
            <div class="title" style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
            <div class="small muted">${[esc(p.room), p.priority === 'high' && p.status !== 'done' ? '🔴 High priority' : '', due != null ? `<span style="${due < 0 ? 'color:var(--bad);font-weight:600' : ''}">${due < 0 ? 'Overdue' : 'Due ' + relDays(due).toLowerCase()}</span>` : '', p.status === 'done' && p.doneDate ? `Finished ${fmtDate(p.doneDate, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''].filter(Boolean).join(' · ')}</div>
          </div>
          <span class="pill ${PROJECT_STATUS_CLS[p.status]}">${PROJECT_STATUS_LABEL[p.status]}</span>
        </div>
        <div class="bar" style="margin-top:12px"><i style="width:${st.pct * 100}%"></i></div>
        <div class="small muted" style="display:flex;justify-content:space-between;margin-top:6px">
          <span>${p.steps.length ? `${st.stepsDone}/${p.steps.length} steps` : 'No steps yet'}${st.hours ? ` · ${fmtHours(st.hours - st.hoursDone)} left` : ''}</span>
          <span>${st.est ? `${money(st.spent, { maximumFractionDigits: 0 })} / ${money(st.est, { maximumFractionDigits: 0 })}` : ''}</span>
        </div>
      </button>`;
    }).join('') || `<div class="card empty"><span class="big">${filter === 'done' ? '🏆' : '🏡'}</span>${filter === 'done' ? 'Finished projects will show up here.' : 'Plan repairs, upgrades and DIY projects.<br>Track steps, materials, costs and time.'}</div>`}
    <button class="fab" data-action="add-project" aria-label="Add project">${ICON.plus}</button>
  `;
};

views.project = (id) => {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return `<div class="card empty">This project was deleted.</div>`;
  const st = projectStats(p);
  const tab = ui.projTab || 'steps';
  const t = today();
  const due = p.dueDate ? daysBetween(t, p.dueDate) : null;
  const who = p.memberId ? member(p.memberId) : null;
  const budget = Number(p.budget) || 0;
  const costBase = budget || st.est;

  let body;
  if (tab === 'steps') {
    body = `
      <form class="quick-add" data-submit="project-step" data-id="${p.id}">
        <input type="text" name="step" placeholder="Add a step… (e.g. Buy paint 1.5h)" enterkeyhint="done" autocomplete="off">
        <button class="btn" type="submit" aria-label="Add step">${ICON.plus}</button>
      </form>
      <div class="card flush">${p.steps.map((s, i) => `<div class="row${s.done ? ' done' : ''}">
        <button class="check${s.done ? ' on' : ''}" data-action="toggle-step" data-p="${p.id}" data-id="${s.id}" aria-label="Done">${ICON.check}</button>
        <button class="grow" style="text-align:left" data-action="edit-step" data-p="${p.id}" data-id="${s.id}">
          <div class="title">${i + 1}. ${esc(s.title)}</div>
          ${s.hours || s.memberId || s.notes ? `<div class="sub">${[s.hours ? `⏱ ${fmtHours(s.hours)}` : '', s.memberId ? `${esc(member(s.memberId).emoji)} ${esc(member(s.memberId).name)}` : '', s.notes ? esc(s.notes) : ''].filter(Boolean).join(' · ')}</div>` : ''}
        </button>
      </div>`).join('') || '<div class="empty small">Break the job into steps. Add time estimates to see how long it\'ll take.</div>'}</div>`;
  } else {
    const toBuy = p.items.filter((i) => !i.bought);
    body = `
      <form class="quick-add" data-submit="project-item" data-id="${p.id}">
        <input type="text" name="newMaterial" placeholder="Add material… (e.g. 2 x paint $45)" enterkeyhint="done" autocomplete="off">
        <button class="btn" type="submit" aria-label="Add material">${ICON.plus}</button>
      </form>
      <div class="card flush">${p.items.map((i) => `<div class="row${i.bought ? ' done' : ''}">
        <button class="check${i.bought ? ' on' : ''}" data-action="toggle-material" data-p="${p.id}" data-id="${i.id}" aria-label="Bought">${ICON.check}</button>
        <button class="grow" style="text-align:left" data-action="edit-material" data-p="${p.id}" data-id="${i.id}">
          <div class="title">${esc(i.name)}</div>
          <div class="sub">${[(Number(i.qty) || 1) > 1 ? `${i.qty} × ${money(i.cost || 0)}` : '', i.store, i.have ? 'Already have' : ''].filter(Boolean).map(esc).join(' · ') || (i.cost ? '' : 'Tap to add a price')}</div>
        </button>
        <span class="amount">${i.cost ? money(itemTotal(i)) : ''}</span>
        ${i.link ? `<a class="mini-btn" href="${esc(safeUrl(i.link))}" target="_blank" rel="noopener">Link</a>` : ''}
      </div>`).join('') || '<div class="empty small">List everything you need to buy. Prices add up to the project cost.</div>'}
      ${p.items.length ? `<div class="row" style="border-top:1px solid var(--line)"><div class="grow small muted">${toBuy.length} to buy · ${money(sum(toBuy, itemTotal))}</div><b>${money(st.est)}</b></div>` : ''}
      </div>
      ${toBuy.length ? `<button class="btn secondary block" data-action="materials-to-list" data-id="${p.id}">🛒 Add ${toBuy.length} item${toBuy.length > 1 ? 's' : ''} to shopping list</button>` : ''}
      <p class="small muted" style="margin:10px 4px">Check items off as you buy them.${p.categoryId ? ` Purchases are logged to your ${esc(category(p.categoryId).name)} budget.` : ' Turn on budget tracking in Edit to log purchases automatically.'}</p>`;
  }

  return `
    <div class="card">
      <div style="display:flex;gap:14px;align-items:center">
        <div class="avatar" style="width:56px;height:56px;flex-basis:56px;font-size:30px">${esc(p.emoji || '🔨')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:21px;font-weight:750;line-height:1.2">${esc(p.name)}</div>
          <div class="small muted">${[esc(p.room), who ? `${esc(who.emoji)} ${esc(who.name)}` : '', p.priority ? PRIORITY_LABEL[p.priority] : ''].filter(Boolean).join(' · ')}</div>
        </div>
        <button class="mini-btn" data-action="edit-project" data-id="${p.id}">Edit</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">
        <button class="pill ${PROJECT_STATUS_CLS[p.status]}" data-action="cycle-project" data-id="${p.id}">${PROJECT_STATUS_LABEL[p.status]}</button>
        ${p.startDate ? `<span class="pill">Start ${fmtDate(p.startDate, { month: 'short', day: 'numeric' })}</span>` : ''}
        ${p.dueDate ? `<span class="pill ${due < 0 && p.status !== 'done' ? 'bad' : ''}">Due ${fmtDate(p.dueDate, { month: 'short', day: 'numeric' })}${p.status !== 'done' ? ` · ${relDays(due).toLowerCase()}` : ''}</span>` : ''}
      </div>
      ${p.notes ? `<p class="small" style="margin:12px 0 0;white-space:pre-wrap">${esc(p.notes)}</p>` : ''}
    </div>

    <div class="grid2">
      <div class="card">
        <div class="stat-label">💵 Cost</div>
        <div class="stat">${money(st.est, { maximumFractionDigits: 0 })}</div>
        <div class="small muted">${money(st.spent, { maximumFractionDigits: 0 })} spent${budget ? ` · budget ${money(budget, { maximumFractionDigits: 0 })}` : ''}</div>
        ${costBase ? `<div class="bar"><i class="${budget ? levelCls(st.est / budget) : ''}" style="width:${Math.min(100, (st.spent / costBase) * 100)}%"></i></div>` : ''}
        ${budget && st.est > budget ? `<div class="small" style="color:var(--bad);margin-top:4px">${money(st.est - budget)} over budget</div>` : ''}
      </div>
      <div class="card">
        <div class="stat-label">⏱ Time</div>
        <div class="stat">${st.hours ? Math.round((st.hours - st.hoursDone) * 10) / 10 : '—'}<span class="small muted" style="font-weight:500">${st.hours ? ' hrs left' : ''}</span></div>
        <div class="small muted">${st.stepsDone}/${p.steps.length} steps · ${Math.round(st.pct * 100)}% done</div>
        <div class="bar"><i style="width:${st.pct * 100}%"></i></div>
      </div>
    </div>

    <div class="segmented">
      <button class="${tab === 'steps' ? 'active' : ''}" data-action="proj-tab" data-tab="steps">Steps (${p.steps.length})</button>
      <button class="${tab === 'items' ? 'active' : ''}" data-action="proj-tab" data-tab="items">Materials (${p.items.length})</button>
    </div>
    ${body}
  `;
};

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
    ${typeof choreExtras === 'function' ? choreExtras() : ''}
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
  ${typeof settingsHeader === 'function' ? settingsHeader() : ''}
  <div class="section-title">Family members<button data-action="add-member">+ Add</button></div>
  <div class="card flush">
    ${state.members.map((m) => `<button class="row tap" style="width:100%;text-align:left" data-action="edit-member" data-id="${m.id}">
      ${avatar(m)}<div class="grow"><div class="title">${esc(m.name)}</div></div><i class="dot" style="background:${m.color}"></i>${ICON.chev}
    </button>`).join('')}
  </div>

  ${typeof syncCardHTML === 'function' ? syncCardHTML() : ''}

  <div class="section-title">Preferences</div>
  <div class="card">
    <div class="field"><label for="setCurrency">Currency</label>
      <select id="setCurrency" data-change="setting" data-key="currency">
        ${['USD', 'MXN', 'CAD', 'EUR', 'GBP'].map((c) => `<option ${state.settings.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
    <div class="field"><label>Accent color</label>
      <div class="accent-picker">${Object.entries(ACCENTS).map(([k, [a, b]]) => `<button class="${(state.settings.accent || 'terracotta') === k ? 'on' : ''}" style="--sw1:${a};--sw2:${b}" data-action="set-accent" data-accent="${k}" aria-label="${k}"></button>`).join('')}</div></div>
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
// Recent problems (kept on this device only) so a screenshot of Settings can explain a glitch
const ERR_KEY = 'gomezfam:errors';
function noteError(where, e) {
  try {
    const list = JSON.parse(localStorage.getItem(ERR_KEY) || '[]').slice(-4);
    list.push({ at: Date.now(), where: String(where).slice(0, 40), msg: String(e?.message || e).slice(0, 160), line: String(e?.stack || '').split('\n')[1]?.trim().slice(0, 120) || '' });
    localStorage.setItem(ERR_KEY, JSON.stringify(list));
  } catch { /* storage full or blocked */ }
}
window.addEventListener('error', (e) => noteError('script', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => noteError('async', e.reason));
const viewEl = $('#view');
function currentRoute() {
  const [name, param] = (location.hash.slice(1) || 'home').split('/');
  return views[name] ? { name, param } : { name: 'home' };
}
let lastRouteKey = null;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function render() {
  const { name, param } = currentRoute();
  // Detail screens carry their own header card, so they skip the large title and show the item's name when scrolled.
  const detail = { person: () => person(param)?.name, project: () => state.projects.find((x) => x.id === param)?.name,
    goal: () => state.goals.find((x) => x.id === param)?.name, recipe: () => state.recipes.find((x) => x.id === param)?.name }[name];
  let title = TITLES[name], html;
  try {
    title = (detail && detail()) || TITLES[name];
    html = (name === 'home' || name === 'kid' || detail ? '' : `<h1 class="large-title">${esc(title)}</h1>`) + views[name](param);
  } catch (e) {
    // One broken screen never strands you: show a way out instead of freezing on the old screen
    console.error('render ' + name, e); noteError('screen ' + name, e);
    html = `<div class="card empty"><span class="big">😵</span>This screen hit a snag. Your data is safe.<div class="btn-row" style="justify-content:center"><button class="btn" data-action="go" data-to="${typeof inKidMode === 'function' && inKidMode() ? 'kid' : 'home'}">Back to Home</button></div></div>`;
  }
  const key = name + '/' + (param || '');
  const changed = lastRouteKey !== null && lastRouteKey !== key;
  lastRouteKey = key;
  const paint = () => {
    // Scrolling rows/grids marked data-keep remember where they were across re-renders.
    const kept = changed ? {} : Object.fromEntries([...viewEl.querySelectorAll('[data-keep]')].map((el) => [el.dataset.keep, [el.scrollLeft, el.scrollTop]]));
    viewEl.innerHTML = html;
    for (const el of viewEl.querySelectorAll('[data-keep]')) { const k = kept[el.dataset.keep]; if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; } }
    const tab = name === 'person' ? 'gifts' : name;
    $('#title').textContent = title;
    $('#backBtn').hidden = TABS.includes(name) || name === 'kid';
    document.querySelectorAll('.tabbar [data-tab]').forEach((b) => { b.classList.toggle('active', b.dataset.tab === tab); b.toggleAttribute('aria-current', b.dataset.tab === tab); });
    viewEl.querySelectorAll('.segmented button, .sq-tabs3 button').forEach((b) => b.setAttribute('aria-pressed', b.classList.contains('active')));
    if (ui.pop) {
      const sel = `[data-action="${ui.pop.a}"]${ui.pop.id ? `[data-id="${ui.pop.id}"]` : ''}${ui.pop.date ? `[data-date="${ui.pop.date}"]` : ''}`;
      viewEl.querySelector(sel)?.classList.add('pop');
      ui.pop = null;
    }
    if (typeof afterRender === 'function') { try { afterRender(); } catch (e) { console.error('afterRender', e); noteError('after ' + name, e); } }
    // Full-screen modes belong to one screen each. Whatever happened above, never leave one switched on elsewhere
    // (a stuck game/story mode would hide the top bar and tabs).
    try {
      const b = document.body;
      if (name !== 'world') { b.classList.remove('world-mode'); const L = document.getElementById('worldLayer'); if (L && !L.hidden) { if (typeof unmount === 'function') { try { unmount(); } catch { L.hidden = true; } } else L.hidden = true; } }
      if (name !== 'wrapped') b.classList.remove('wrapped-mode');
      if (name !== 'store') b.classList.remove('store-mode');
      if (name !== 'room') b.classList.remove('house-editing');
    } catch { /* never block a screen */ }
  };
  // Paint synchronously. (Safari's view transitions sometimes left the new screen undrawn until a scroll,
  // so screens now just fade in with a plain opacity animation.)
  paint();
  if (changed) {
    viewEl.scrollTop = 0;
    if (!navigator.webdriver && !reduceMotion()) { viewEl.classList.remove('enter'); void viewEl.offsetWidth; viewEl.classList.add('enter'); }
  }
}
function go(to) {
  if (location.hash.slice(1) === to) { render(); return; }
  location.hash = to;
}
window.addEventListener('hashchange', () => { if (!$('#sheet').hidden) closeSheet(); render(); });

const ACCENTS = {
  terracotta: ['#c9583a', '#e8954f'], ocean: ['#2563d6', '#19a3c9'], forest: ['#1f7a63', '#6aa84f'],
  plum: ['#7a45cf', '#c4549f'], rose: ['#cf3f6b', '#ee8a5c'], midnight: ['#33408f', '#6a54d8'],
};
function applyTheme() {
  document.documentElement.dataset.accent = ACCENTS[state.settings.accent] ? state.settings.accent : 'terracotta';
  const th = state.settings.theme;
  if (th === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = th;
}

/* =========================================================
   Toast with undo
   ========================================================= */
let toastTimer;
// Finance words a kid shouldn't see pop up while they're using the app.
const TOAST_MONEY = /\$|€|£|budget|bill|payment|paid|transaction|spent|income|deposit|refund|subscription/i;
function toast(msg, undo, opt = {}) {
  const b = document.body;
  // Games and the world own the screen: only toasts the game itself raises get through.
  if (!opt.game && (b.classList.contains('world-mode') || b.classList.contains('game-mode')) && !/\/(world|world-data|games|squish|gems|collect|house)\.js/.test(new Error().stack || '')) return;
  if (!opt.force && TOAST_MONEY.test(msg) && (b.classList.contains('kid-mode') || (typeof inKidMode === 'function' && inKidMode()) || (typeof actor === 'function' && actor() && member(actor())?.kid))) return;
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2200);
}
function withUndo(msg, mutate) {
  const before = JSON.parse(JSON.stringify(state));
  mutate();
  const after = JSON.parse(JSON.stringify(state));
  save(); render();
  // Undo only this change; keep anything that arrived from other phones since.
  toast(msg, () => { state = typeof mergeState === 'function' ? migrate(mergeState(after, before, JSON.parse(JSON.stringify(state)))) : before; save(); render(); });
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
      input = `<input id="${id}" name="${f.name}" type="text" inputmode="${f.signed ? 'text' : f.type === 'money' ? 'decimal' : 'numeric'}" value="${val === null ? '' : esc(val)}" placeholder="${esc(f.placeholder || '')}" ${req}>`;
      break;
    default:
      input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.list ? `list="${f.list}"` : ''} ${req} autocapitalize="${['url', 'email', 'password'].includes(f.type) ? 'off' : 'sentences'}"${f.type === 'email' ? ' autocomplete="email"' : f.type === 'password' ? ' autocomplete="current-password"' : ''}>`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
}
const flatFields = (fields) => fields.flatMap((f) => (f.row ? f.row : [f])).filter((f) => f.name);

function openSheet(cfg) {
  sheetCfg = cfg;
  const v = cfg.values || {};
  $('#sheetTitle').textContent = cfg.title;
  $('#sheetSave').textContent = cfg.saveLabel || 'Save'; $('#sheetSave').disabled = false; // a previous sheet may have left it busy
  const form = $('#sheetForm');
  form.innerHTML = cfg.fields.map((f) => fieldHTML(f, v)).join('')
    + (cfg.extra || '')
    + (cfg.onDelete ? `<button type="button" class="btn danger block" style="margin-top:8px" data-action="sheet-delete">${esc(cfg.deleteLabel || 'Delete')}</button>` : '');
  form.oninput = cfg.onInput ? (e) => cfg.onInput(form, e) : null;
  $('#sheetBackdrop').hidden = false;
  $('#sheet').hidden = false;
  form.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  // A real modal: focus moves in, the page behind is inert, and focus comes back on close
  cfg.returnTo = document.activeElement; $('#app').inert = true;
  setTimeout(() => { if (sheetCfg === cfg) (form.querySelector('input:not([type=hidden]),select,textarea') || $('#sheetSave'))?.focus({ preventScroll: true }); }, 50);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBackdrop').hidden = true;
  document.body.style.overflow = '';
  $('#app').inert = false;
  const back = sheetCfg?.returnTo; if (back && document.contains(back)) back.focus?.({ preventScroll: true }); else document.activeElement?.blur?.();
  sheetCfg = null;
  if (typeof syncAfterSheet === 'function') setTimeout(syncAfterSheet);
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
      let s = String(el.value).replace(/[^0-9.,\-]/g, '');
      s = /,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); // "12,50" → 12.50, "1,234.56" → 1234.56
      const n = parseFloat(s);
      out[f.name] = !Number.isFinite(n) ? null : f.type === 'money' ? Math.round(n * 100) / 100 : n;
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
  const me = state.members.some((m) => m.id === state.settings.me) ? state.settings.me : '';
  tx ||= { type: 'expense', date: today(), categoryId: state.budget.categories[0]?.id || '', memberId: me };
  const typ = tx.type === 'income' ? 'income' : 'expense';
  let catTouched = !isNew; // once you pick a category yourself, typing the description leaves it alone
  openSheet({
    title: isNew ? 'Add transaction' : 'Edit transaction',
    values: tx,
    fields: [
      { name: 'amount', label: 'Amount', type: 'money', required: true, placeholder: '0.00' },
      { name: 'type', type: 'html', html: `<div class="segmented tx-type"><input type="hidden" name="type" value="${typ}">${[['expense', '💸 Expense'], ['income', '💰 Income']].map(([k, l]) => `<button type="button" class="${typ === k ? 'active' : ''}" data-action="tx-type" data-v="${k}">${l}</button>`).join('')}</div>` },
      { name: 'note', label: 'Description', placeholder: 'e.g. Costco run' },
      { name: 'categoryId', label: 'Category', type: 'select', options: state.budget.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` })) },
      { row: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'memberId', label: 'Who', type: 'select', options: [{ value: '', label: '—' }, ...memberOptions(false)] },
      ] },
    ],
    onInput(form, e) {
      if (e.target.name === 'categoryId') catTouched = true;
      if (e.target.name !== 'note' || catTouched) return;
      const id = categoryFor(e.target.value);
      if (id && form.elements.categoryId) form.elements.categoryId.value = id;
    },
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
      { name: 'rollover', label: 'Roll over what’s left', type: 'checkbox', hint: 'Unspent money (or overspending) carries into next month' },
    ],
    onSave(v) {
      v.limit = v.limit || 0;
      if (v.rollover && !c?.rollover) v.rolloverFrom = monthKey(today()); // carry starts from this month's leftovers
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
    title: isNew ? 'New recurring item' : `Edit ${b.type === 'income' ? 'income' : 'bill'}`,
    values: b ? { ...b, next: nextBillDate(b) || b.anchor } : { type: 'bill', freq: 'monthly', next: today(), showOnCalendar: true, categoryId: '', group: '' },
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Mortgage, DTE Energy, Paycheck' },
      { row: [
        { name: 'type', label: 'Type', type: 'select', options: [{ value: 'bill', label: '💳 Bill' }, { value: 'income', label: '💰 Income' }] },
        { name: 'amount', label: 'Amount', type: 'money', required: true, placeholder: '0.00' },
      ] },
      { row: [
        { name: 'freq', label: 'Repeats', type: 'select', options: Object.entries(FREQ_NAMES).map(([value, label]) => ({ value, label })) },
        { name: 'next', label: 'Next date', type: 'date', required: true },
      ] },
      { name: 'group', label: 'Group', placeholder: 'e.g. Subscriptions', list: 'billGroups' },
      { type: 'html', html: `<datalist id="billGroups">${BILL_GROUPS.map((g) => `<option value="${g}">`).join('')}</datalist>` },
      { name: 'categoryId', label: 'Also count against budget category', type: 'select', options: [{ value: '', label: '— No, keep separate —' }, ...state.budget.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))] },
      { name: 'autopay', label: 'Automatic (autopay / direct deposit)', type: 'checkbox', hint: 'Marked paid automatically on its date' },
      { name: 'varies', label: 'Amount changes each time', type: 'checkbox', hint: 'Asks for the real amount when you mark it paid (e.g. electric bill)' },
      { name: 'showOnCalendar', label: 'Show on calendar', type: 'checkbox' },
    ],
    onSave(v) {
      const { next, ...rest } = v;
      rest.anchor = next;
      rest.dueDay = parse(next).getDate();
      if (isNew) state.budget.bills.push({ id: uid(), paid: {}, since: today(), ...rest });
      else {
        // Moving a due date: a new-schedule date that's already passed was settled by the old date in the same
        // period (paid → don't autopay/log it again; unpaid → it stays overdue).
        const win = [addDays(today(), -60), today()];
        const prev = billOccurrences(b, addDays(today(), -120), today()).map((d) => [d, b.paid?.[d]]);
        Object.assign(b, rest);
        b.paid ||= {};
        const samePeriod = (od, d) => (b.freq === 'monthly' ? monthKey(od) === monthKey(d) : Math.abs(daysBetween(od, d)) < (FREQ_STEP[b.freq] || 366));
        for (const d of billOccurrences(b, ...win)) {
          if (d in b.paid || prev.some(([od]) => od === d)) continue;
          if (prev.some(([od, p]) => p && samePeriod(od, d))) b.paid[d] = 'moved';
        }
      }
    },
    onDelete: isNew ? null : () => withUndo(`${b.name} deleted`, () => {
      state.budget.bills = state.budget.bills.filter((x) => x.id !== b.id);
    }),
  });
}

// "Name | amount | schedule | group" per line. "+4042" = income. Schedule: "15" (monthly on the 15th),
// or "biweekly 2026-10-22" / "weekly …" / "yearly …" / "monthly …" with the next date.
function parseBulkBills(text) {
  const out = [], bad = [];
  for (const line of String(text).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [name, amt = '', sched = '', group = ''] = line.split('|').map((x) => x.trim());
    const amount = parseFloat(amt.replace(/[^0-9.]/g, ''));
    const m = sched.toLowerCase().match(/^(monthly|weekly|biweekly|yearly)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2})$/);
    if (!name || !Number.isFinite(amount) || !m || (m[2].length <= 2 && m[1] && m[1] !== 'monthly')) { bad.push(line); continue; }
    const freq = m[1] || 'monthly';
    let anchor;
    if (m[2].length <= 2) {
      anchor = dayInMonth(+m[2], monthKey(today()));
      if (anchor < today()) anchor = dayInMonth(+m[2], addMonths(monthKey(today()), 1));
    } else anchor = m[2];
    out.push({ id: uid(), name, amount, type: amt.startsWith('+') ? 'income' : 'bill', freq, anchor, dueDay: m[2].length <= 2 ? +m[2] : parse(anchor).getDate(), group, categoryId: '', autopay: false, showOnCalendar: true, paid: {}, since: today() });
  }
  return { out, bad };
}
function bulkBillsForm() {
  openSheet({
    title: 'Bulk add',
    saveLabel: 'Add',
    values: {},
    fields: [
      { type: 'html', html: `<p class="small muted" style="margin:0 4px 10px">One per line: <b>Name | amount | schedule | group</b><br>
        Start the amount with <b>+</b> for income. Schedule is a day of the month (<b>15</b>) or a repeat plus the next date (<b>biweekly 2026-10-22</b>).<br>
        <span style="font-family:ui-monospace,monospace;font-size:12px">Netflix | 8.99 | 2 | Subscriptions<br>Paycheck | +2000 | biweekly 2026-10-23 | Income</span></p>` },
      { name: 'lines', label: 'Paste here', type: 'textarea' },
    ],
    onSave(v) {
      const { out, bad } = parseBulkBills(v.lines);
      const fresh = out.filter((n) => !state.budget.bills.some((b) => norm(b.name) === norm(n.name) && b.amount === n.amount));
      state.budget.bills.push(...fresh);
      ui.budgetTab = 'bills';
      toast(`Added ${fresh.length}${out.length - fresh.length ? ` · ${out.length - fresh.length} already there` : ''}${bad.length ? ` · ${bad.length} line${bad.length > 1 ? 's' : ''} not understood` : ''}`);
      if (!out.length && bad.length) return false;
    },
  });
}
function markBillPaid(b, date, auto) {
  const inc = b.type === 'income';
  const amount = amountFor(b, date);
  b.paid ||= {};
  // Every paid bill is logged (fromBill) so it counts as spending. A predictable id means two synced phones
  // marking the same bill never log it twice.
  const txId = billTxId(b, date);
  if (!state.budget.transactions.some((t) => t.id === txId)) {
    state.budget.transactions.push({ id: txId, created: Date.now(), type: inc ? 'income' : 'expense', amount, note: b.name, categoryId: inc ? '' : b.categoryId || '', date: date > today() ? today() : date, memberId: '', fromBill: true, billId: b.id });
  }
  b.paid[date] = txId;
  if (!auto) toast(inc ? `${b.name} received ✓` : `${b.name} marked paid ✓`);
}
const lastKnownAmount = (b) => { const ks = Object.keys(b.amounts || {}).sort(); return ks.length ? b.amounts[ks.at(-1)] : null; };
function toggleBill(b, date) {
  b.paid ||= {};
  if (b.paid[date]) {
    const txId = b.paid[date];
    state.budget.transactions = state.budget.transactions.filter((t) => t.id !== txId);
    // false (not deleted) so autopay doesn't re-mark something you deliberately unchecked
    b.paid[date] = false;
    save(); render();
    return;
  }
  if (b.varies) {
    const typical = lastKnownAmount(b) ?? b.amount;
    openSheet({
      title: b.name,
      saveLabel: b.type === 'income' ? 'Received' : 'Paid',
      values: { amount: b.amounts?.[date] ?? typical },
      fields: [
        { name: 'amount', label: `Amount for ${fmtDate(date, { month: 'long', day: 'numeric' })}`, type: 'money', required: true },
        { type: 'html', html: `<p class="small muted" style="margin:0 4px">Last time: ${money(typical)}. This updates your budget and cash flow with the real amount.</p>` },
      ],
      onSave(v) { (b.amounts ||= {})[date] = v.amount; markBillPaid(b, date); },
    });
    return;
  }
  markBillPaid(b, date);
  save(); render();
}

// Autopay / direct deposit: mark anything due (since the item was added, up to 45 days back) as paid.
function autopayCatchUp() {
  const t = today();
  let n = 0, mig = false;
  for (const b of state.budget.bills) {
    // Bills paid before they were logged as spending (paid = true): add their transaction once (same id on every phone).
    if (b.type !== 'income') for (const [d, v] of Object.entries(b.paid || {})) {
      if (v !== true || d < addDays(t, -186)) continue;
      const id = billTxId(b, d);
      if (!state.budget.transactions.some((x) => x.id === id)) { state.budget.transactions.push({ id, created: Date.now(), type: 'expense', amount: amountFor(b, d), note: b.name, categoryId: b.categoryId || '', date: d > t ? t : d, memberId: '', fromBill: true, billId: b.id }); }
      b.paid[d] = id; mig = true;
    }
    if (!b.autopay) continue;
    const from = [b.since || t, addDays(t, -45)].sort().at(-1);
    for (const d of billOccurrences(b, from, t)) {
      if (b.paid?.[d] === undefined) { markBillPaid(b, d, true); n++; }
    }
  }
  // A quiet activity entry (bell / inbox), not a startup toast.
  if (n) { if (typeof logAct === 'function') logAct('🤖', `logged ${n} automatic payment${n > 1 ? 's' : ''}`, 'budget'); save(); }
  else if (mig) save();
  return n;
}

// Tap a dotted day in the Recurring strip: that day's bills with paid toggles.
function recurDaySheet(d) {
  openSheet({
    title: fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }), saveLabel: 'Done', recurDay: d, values: {},
    fields: [{ type: 'html', html: `<div class="card flush" id="recurDayList" style="margin:0">${recurringBetween(d, d).map(recurRow).join('')}</div>` }],
    onSave() {},
  });
}

/* ---------- Import bank CSV ---------- */
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
function csvDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/))) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${pad(+m[1])}-${pad(+m[2])}`; }
  return null;
}
// "-12.50", "(12.50)", "$1,234.56", "12.50-" → signed number
function csvAmount(s) {
  const t = String(s || '').trim().replace(/[$€£\s]/g, '');
  if (!/\d/.test(t) || csvDate(t)) return null;
  const n = parseFloat(t.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? (/^\(.*\)$|^-|-$/.test(t) ? -n : n) : null;
}
function guessCsvCols(head, body) {
  const h = head.map(norm), find = (re) => h.findIndex((x) => re.test(x)), n = Math.max(head.length, body[0]?.length || 0);
  const first = (test) => [...Array(n).keys()].find((i) => body.slice(0, 5).every((r) => test(r[i]))) ?? -1;
  let date = find(/date|posted/), amount = find(/amount|debit|withdrawal/), desc = find(/desc|memo|payee|merchant|details|name|narrative/);
  if (date < 0) date = first((c) => !!csvDate(c));
  if (amount < 0) amount = first((c) => csvAmount(c) != null);
  if (desc < 0) desc = [...Array(n).keys()].filter((i) => i !== date && i !== amount).sort((a, b) => sum(body.slice(0, 5), (r) => (r[b] || '').length) - sum(body.slice(0, 5), (r) => (r[a] || '').length))[0] ?? 0;
  return { date: Math.max(0, date), amount: Math.max(0, amount), desc };
}
// Rows → new transactions. Skips rows already logged (same date + amount + description); categories guessed like the add form.
function bankCsvPlan(rows, map) {
  const key = (date, amount, note) => `${date}|${Number(amount).toFixed(2)}|${norm(note)}`;
  const have = new Set(state.budget.transactions.map((t) => key(t.date, t.amount, t.note)));
  const add = []; let dupes = 0, bad = 0;
  for (const r of rows) {
    const date = csvDate(r[map.date]), a = csvAmount(r[map.amount]), note = String(r[map.desc] ?? '').trim().replace(/\s+/g, ' ');
    if (!date || !a) { bad++; continue; }
    const spend = map.sign === 'pos' ? a > 0 : a < 0, amount = Math.round(Math.abs(a) * 100) / 100;
    if (have.has(key(date, amount, note))) { dupes++; continue; }
    add.push({ id: uid(), created: Date.now(), type: spend ? 'expense' : 'income', amount, note, categoryId: spend ? categoryFor(note) : '', date, memberId: '', imported: true });
  }
  return { add, dupes, bad };
}
function pickBankCsv() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
  inp.onchange = async () => { const f = inp.files[0]; if (f) bankCsvSheet(await f.text(), f.name); };
  inp.click();
}
function bankCsvSheet(text) {
  const rows = parseCsv(String(text).replace(/^\uFEFF/, ''));
  if (!rows.length) { toast('That file looks empty'); return; }
  const head = !rows[0].some((c) => csvDate(c) || csvAmount(c) != null), body = head ? rows.slice(1) : rows;
  const g = guessCsvCols(head ? rows[0] : [], body);
  const opts = (head ? rows[0] : body[0]).map((c, i) => ({ value: String(i), label: head ? c.trim() || `Column ${i + 1}` : `Column ${i + 1} · ${c.trim().slice(0, 18)}` }));
  const neg = body.filter((r) => (csvAmount(r[g.amount]) ?? 0) < 0).length;
  const read = (v) => ({ date: +v.date, amount: +v.amount, desc: +v.desc, sign: v.sign });
  const preview = (map) => { const p = bankCsvPlan(body, map); return `<b>${p.add.length}</b> new transaction${p.add.length === 1 ? '' : 's'} to add${p.dupes ? ` · ${p.dupes} already logged (skipped)` : ''}${p.bad ? ` · ${p.bad} row${p.bad > 1 ? 's' : ''} without a date or amount` : ''}`; };
  const values = { date: String(g.date), amount: String(g.amount), desc: String(g.desc), sign: neg > body.length / 2 ? 'neg' : 'pos' };
  openSheet({
    title: 'Import bank CSV', saveLabel: 'Import', values,
    fields: [
      { type: 'html', html: `<p class="small muted" style="margin:0 4px 10px">${body.length} row${body.length === 1 ? '' : 's'} found. Check which column is which — categories are guessed from the description.</p>` },
      { row: [{ name: 'date', label: 'Date', type: 'select', options: opts }, { name: 'amount', label: 'Amount', type: 'select', options: opts }] },
      { name: 'desc', label: 'Description', type: 'select', options: opts },
      { name: 'sign', label: 'Spending shows as', type: 'select', options: [{ value: 'neg', label: 'Negative amounts (−12.50)' }, { value: 'pos', label: 'Positive amounts (12.50)' }] },
      { type: 'html', html: `<div class="allowance" id="csvPreview">${preview(read(values))}</div>` },
    ],
    onInput(form) { const v = {}; for (const k of ['date', 'amount', 'desc', 'sign']) v[k] = form.elements[k].value; $('#csvPreview').innerHTML = preview(read(v)); },
    onSave(v) {
      const p = bankCsvPlan(body, read(v));
      if (!p.add.length) { toast(p.dupes ? 'Everything in that file is already logged' : 'Nothing to import'); return false; }
      state.budget.transactions.push(...p.add);
      ui.budgetTab = 'activity'; ui.budgetMonth = monthKey(p.add.map((x) => x.date).sort().at(-1));
      toast(`Imported ${p.add.length}${p.dupes ? ` · ${p.dupes} duplicate${p.dupes > 1 ? 's' : ''} skipped` : ''}`);
    },
  });
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

// Recurring events opened from one day ask what the change covers: that day, that day onward, or the whole series.
const EV_SCOPE = { one: 'This event', following: 'This and following', all: 'All events' };
function eventForm(ev, date, occ) {
  const isNew = !ev;
  const series = !isNew && ev.repeat && ev.repeat !== 'none' && occ && occursOn(ev, occ);
  const who = isNew ? [] : eventWho(ev);
  const more = !isNew && (ev.location || ev.countdown || ev.askRsvp || ev.notes);
  const hideUntil = (r) => (!r || r === 'none' ? ' hidden' : '');
  openSheet({
    title: isNew ? 'New event' : series ? `Edit ${fmtDate(occ, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Edit event',
    values: ev ? { ...ev, ...(series ? { date: occ, scope: 'one' } : {}) } : { date: date || today(), repeat: 'none', memberId: '' },
    fields: [
      ...(series ? [{ name: 'scope', label: 'Change', type: 'select', options: Object.entries(EV_SCOPE).map(([value, label]) => ({ value, label })) }] : []),
      { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Soccer practice' },
      { row: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'repeat', label: 'Repeats', type: 'select', options: [
          { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Every week' },
          { value: 'biweekly', label: 'Every 2 weeks' }, { value: 'monthly', label: 'Every month' }, { value: 'yearly', label: 'Every year' }] },
      ] },
      { type: 'html', html: `<div class="ev-until"${hideUntil(ev?.repeat)}>` },
      { name: 'until', label: 'Repeat until (optional)', type: 'date' },
      { type: 'html', html: '</div>' },
      { row: [
        { name: 'time', label: 'Start (blank = all day)', type: 'time' },
        { name: 'endTime', label: 'End', type: 'time' },
      ] },
      ...(state.members.length ? [{ type: 'html', html: `<div class="field"><label>Who</label><div class="chips who-chips" role="group" aria-label="Who">
        <label class="chip${who.length ? '' : ' on'}"><input type="checkbox" data-who="" ${who.length ? '' : 'checked'}>👨‍👩‍👧‍👦 Everyone</label>
        ${state.members.map((m) => `<label class="chip${who.includes(m.id) ? ' on' : ''}" style="--c:${m.color}"><input type="checkbox" data-who="${m.id}" ${who.includes(m.id) ? 'checked' : ''}>${esc(m.emoji)} ${esc(m.name)}</label>`).join('')}</div></div>` }] : []),
      { type: 'html', html: `<details class="more-opts"${more ? ' open' : ''}><summary>More options <span class="small muted">location, countdown, RSVP, notes</span></summary>` },
      { name: 'location', label: 'Location', placeholder: 'Optional' },
      { name: 'countdown', label: 'Show countdown on Home', type: 'checkbox', hint: 'Great for trips, parties & big days' },
      { name: 'askRsvp', label: '🙋 Ask who’s in (RSVP)', type: 'checkbox', hint: 'Everyone answers Going / Maybe / Can’t from their phone' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { type: 'html', html: '</details>' },
    ],
    onInput(form, e) {
      if (e.target.name === 'repeat') form.querySelector('.ev-until').hidden = e.target.value === 'none';
      const w = e.target.dataset?.who;
      if (w == null) return;
      const boxes = [...form.querySelectorAll('[data-who]')];
      if (w === '' || !boxes.some((b) => b.dataset.who && b.checked)) boxes.forEach((b) => { b.checked = !b.dataset.who; });
      else boxes[0].checked = false;
      boxes.forEach((b) => b.parentElement.classList.toggle('on', b.checked));
    },
    onSave(v) {
      if (v.repeat === 'none') v.until = '';
      if (v.until && v.until < v.date) { toast('“Repeat until” is before the start date'); return false; }
      if (v.time && v.endTime && v.endTime <= v.time) { toast('The end time is before the start'); return false; }
      const picked = [...$('#sheetForm').querySelectorAll('[data-who]:checked')].map((b) => b.dataset.who).filter(Boolean);
      if ($('#sheetForm [data-who]')) { v.memberId = picked[0] || ''; v.memberIds = picked.length > 1 ? picked : null; }
      const scope = v.scope; delete v.scope;
      if (isNew) state.events.push(clean({ id: uid(), ...v }));
      else if (series && scope === 'one') {
        // Split this day off as its own one-time event.
        (ev.skip ||= []).push(occ);
        state.events.push(clean({ ...ev, ...v, id: uid(), repeat: 'none', until: '', skip: null, rsvp: ev.rsvp?.[occ] ? { [v.date]: ev.rsvp[occ] } : null }));
      } else if (series && scope === 'following' && occ > ev.date) {
        // End the old series the day before; the rest becomes a new series.
        const rest = clean({ ...ev, ...v, id: uid(), skip: (ev.skip || []).filter((d) => d > occ) });
        ev.until = addDays(occ, -1);
        state.events.push(rest);
      } else {
        // The whole series: moving this day's date moves the series start by the same amount.
        if (series && v.date !== occ) v.date = addDays(ev.date, daysBetween(occ, v.date));
        else if (series) v.date = ev.date;
        Object.assign(ev, v);
        clean(ev);
      }
      ui.calSel = v.date; ui.calMonth = monthKey(v.date);
    },
    onDelete: isNew ? null : () => {
      const scope = series ? $('#sheetForm [name="scope"]')?.value : 'all';
      if (scope === 'one') withUndo(`${ev.title} · ${fmtDate(occ)} removed`, () => { (ev.skip ||= []).push(occ); });
      else if (scope === 'following' && occ > ev.date) withUndo(`${ev.title} removed from ${fmtDate(occ)} on`, () => { ev.until = addDays(occ, -1); });
      else withUndo(`${ev.title} deleted`, () => { state.events = state.events.filter((x) => x.id !== ev.id); });
    },
  });
  function clean(o) { for (const k of ['memberIds', 'skip', 'rsvp']) if (o[k] == null || (Array.isArray(o[k]) && !o[k].length)) delete o[k]; return o; }
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
      // Picking a saved recipe / past meal: its ingredients probably need buying, so tick it by default.
      if (h && splitList(h.ingredients).length && !m.dinner) form.elements.addToList.checked = true;
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

function projectForm(p) {
  const isNew = !p;
  openSheet({
    title: isNew ? 'New project' : 'Edit project',
    values: p || { status: 'planned', priority: 'med', emoji: '🔨', template: '' },
    fields: [
      ...(isNew ? [{ name: 'template', label: 'Start from', type: 'select', options: [{ value: '', label: '✏️ Blank project' }, ...Object.entries(PROJECT_TEMPLATES).map(([k, tp]) => ({ value: k, label: `${tp.emoji} ${tp.name} (template)` }))] }] : []),
      { row: [
        { name: 'emoji', label: 'Emoji', placeholder: '🔨' },
        { name: 'name', label: 'Project', placeholder: isNew ? 'e.g. Fix fence gate' : '' },
      ] },
      { type: 'html', html: `<div class="chips" style="margin-top:-6px">${PROJECT_EMOJI.map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { row: [
        { name: 'room', label: 'Room / area', placeholder: 'e.g. Kitchen' },
        { name: 'memberId', label: 'Lead', type: 'select', options: [{ value: '', label: '— Anyone —' }, ...memberOptions(false)] },
      ] },
      { row: [
        { name: 'status', label: 'Status', type: 'select', options: PROJECT_STATUS.map((k) => ({ value: k, label: PROJECT_STATUS_LABEL[k] })) },
        { name: 'priority', label: 'Priority', type: 'select', options: Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label })) },
      ] },
      { row: [
        { name: 'startDate', label: 'Start', type: 'date' },
        { name: 'dueDate', label: 'Finish by', type: 'date' },
      ] },
      { name: 'budget', label: 'Budget (optional)', type: 'money', placeholder: 'How much you want to spend' },
      { name: 'categoryId', label: 'Log purchases to budget category', type: 'select', options: [{ value: '', label: "— Don't log —" }, ...state.budget.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))] },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Measurements, paint colors, contractor info, ideas…' },
    ],
    onSave(v) {
      const { template, ...rest } = v;
      if (isNew) {
        const tp = PROJECT_TEMPLATES[template];
        if (!rest.name && !tp) { toast('Give the project a name'); return false; }
        const np = { id: uid(), created: today(), items: [], steps: [], ...rest };
        if (tp) {
          np.name ||= tp.name;
          if (!rest.emoji || rest.emoji === '🔨') np.emoji = tp.emoji;
          np.room ||= tp.room;
          np.steps = tp.steps.map(([title, hours]) => ({ id: uid(), title, hours, done: false }));
          np.items = tp.items.map(([name, qty, cost]) => ({ id: uid(), name, qty, cost, bought: false }));
        }
        if (np.status === 'done') np.doneDate = today();
        state.projects.push(np);
        setTimeout(() => go('project/' + np.id));
      } else {
        if (!rest.name) { toast('Give the project a name'); return false; }
        if (rest.status === 'done' && p.status !== 'done') rest.doneDate = today();
        Object.assign(p, rest);
      }
    },
    onDelete: isNew ? null : () => {
      withUndo(`${p.name} deleted`, () => { state.projects = state.projects.filter((x) => x.id !== p.id); });
      go('projects');
    },
  });
}

function stepForm(p, s) {
  openSheet({
    title: 'Edit step',
    values: s,
    fields: [
      { name: 'title', label: 'Step', required: true },
      { row: [
        { name: 'hours', label: 'Time (hours)', type: 'money', placeholder: 'e.g. 1.5' },
        { name: 'memberId', label: 'Who', type: 'select', options: [{ value: '', label: '— Anyone —' }, ...memberOptions(false)] },
      ] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave(v) { Object.assign(s, v); },
    onDelete: () => withUndo('Step deleted', () => { p.steps = p.steps.filter((x) => x.id !== s.id); }),
  });
}

function materialForm(p, i) {
  openSheet({
    title: 'Edit material',
    values: i,
    fields: [
      { name: 'name', label: 'Item', required: true },
      { row: [
        { name: 'qty', label: 'Quantity', type: 'money', placeholder: '1' },
        { name: 'cost', label: 'Price each', type: 'money', placeholder: '0.00' },
      ] },
      { row: [
        { name: 'store', label: 'Store', placeholder: 'e.g. Home Depot' },
        { name: 'link', label: 'Link', type: 'url', placeholder: 'https://…' },
      ] },
      { name: 'have', label: 'Already have it (no need to buy)', type: 'checkbox' },
    ],
    onSave(v) {
      v.qty = v.qty || 1;
      Object.assign(i, v);
      if (v.have && !i.bought) { i.bought = true; i.cost = i.cost || 0; }
      // Keep the budget entry in step with the new price/qty (or drop it if you already had it)
      const tx = i.txId && state.budget.transactions.find((t) => t.id === i.txId);
      if (tx && (i.have || !itemTotal(i))) { state.budget.transactions = state.budget.transactions.filter((t) => t !== tx); delete i.txId; }
      else if (tx) { tx.amount = itemTotal(i); tx.note = `${i.name} (${p.name})`; }
    },
    onDelete: () => withUndo(`${i.name} removed`, () => {
      if (i.txId) state.budget.transactions = state.budget.transactions.filter((t) => t.id !== i.txId);
      p.items = p.items.filter((x) => x.id !== i.id);
    }),
  });
}

function toggleMaterial(p, i) {
  i.bought = !i.bought;
  if (i.txId) { state.budget.transactions = state.budget.transactions.filter((t) => t.id !== i.txId); delete i.txId; }
  if (i.bought && p.categoryId && itemTotal(i) && !i.have) {
    i.txId = uid();
    state.budget.transactions.push({ id: i.txId, created: Date.now(), type: 'expense', amount: itemTotal(i), note: `${i.name} (${p.name})`, categoryId: p.categoryId, date: today(), memberId: '' });
    toast(`Logged ${money(itemTotal(i))} to ${category(p.categoryId).name}`);
  }
  save(); render();
}

function choreForm(c) {
  const isNew = !c;
  openSheet({
    title: isNew ? 'New chore' : 'Edit chore',
    values: c || { freq: 'weekly', points: 1, memberId: '', emoji: '' },
    fields: [
      { row: [{ name: 'emoji', label: 'Picture', placeholder: typeof choreEmojiFor === 'function' ? choreEmojiFor(c?.title || '') : '🧹' }, { name: 'title', label: 'Chore', required: true, placeholder: 'e.g. Take out the trash' }] },
      ...(typeof CHORE_PICKS !== 'undefined' ? [{ type: 'html', html: `<div class="chips" style="margin-top:-6px">${CHORE_PICKS.map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` }] : []),
      { name: 'memberId', label: 'Assigned to', type: 'select', options: [{ value: '', label: '🙋 Anyone' }, ...memberOptions(false)] },
      { row: [
        { name: 'freq', label: 'How often', type: 'select', options: Object.entries(FREQ_LABEL).map(([value, label]) => ({ value, label })) },
        { name: 'points', label: 'Stars ⭐', type: 'number' },
      ] },
    ],
    onInput(form, e) { if (e.target.name === 'title' && typeof choreEmojiFor === 'function') form.elements.emoji.placeholder = choreEmojiFor(e.target.value); },
    onSave(v) {
      v.points = Math.max(1, Math.round(v.points || 1));
      if (!v.emoji && typeof choreEmojiFor === 'function') v.emoji = choreEmojiFor(v.title); // trash → 🗑️, dog → 🐶 …
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
    c.log.push({ id: `cl-${t}-${memberId || ''}`, date: t, memberId });
    const m = memberId ? member(memberId) : null;
    toast(`${m ? m.name + ' earned' : 'Earned'} ${c.points || 1} star${(c.points || 1) > 1 ? 's' : ''} ⭐`);
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
      { name: 'kid', label: 'This is a kid', type: 'checkbox', hint: 'Gets Kid Mode, routines, an allowance & a wish list' },
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
  'go': (el) => { if (el.dataset.btab) ui.budgetTab = el.dataset.btab; if (el.dataset.mtab) ui.mealsTab = el.dataset.mtab; go(el.dataset.to); },
  'back': () => { if (history.length > 1) history.back(); else go('home'); },
  'sheet-cancel': closeSheet,
  'sheet-save': submitSheet,
  'sheet-delete': () => { const cfg = sheetCfg; closeSheet(); cfg.onDelete(); },
  'pick-emoji': (el) => { $('#sheetForm').elements.emoji.value = el.dataset.emoji; },
  'set-accent': (el) => { state.settings.accent = el.dataset.accent; save(); applyTheme(); render(); },
  'dismiss-welcome': () => { state.settings.welcomeDismissed = true; save(); render(); },

  // Budget
  'budget-month': (el) => { ui.budgetMonth = addMonths(ui.budgetMonth, +el.dataset.n); render(); },
  'budget-tab': (el) => { ui.budgetTab = el.dataset.tab; render(); },
  'export-csv': (el) => {
    const ym = ui.budgetMonth, all = !!el?.dataset?.all;
    const cell = (v) => { const s = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; }; // no spreadsheet formula injection
    const rows = [['Date', 'Type', 'Amount', 'Category', 'Description', 'Who'], ...(all ? [...state.budget.transactions] : monthTx(ym)).sort((a, b) => a.date.localeCompare(b.date)).map((t) => [t.date, t.type, ((t.type === 'income' ? 1 : -1) * t.amount).toFixed(2), t.type === 'income' ? 'Income' : isBillOnly(t) ? `Bills · ${billGroupOf(t)}` : category(t.categoryId).name, t.note || '', t.memberId ? member(t.memberId).name : ''])];
    const csv = '\ufeff' + rows.map((r, i) => r.map((v, j) => (i && j === 2 ? v : cell(v))).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `gomez-budget-${all ? 'all' : ym}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'trend-month': (el) => { ui.trendSel = el.dataset.ym; render(); },
  'add-tx': () => txForm(null),
  'edit-tx': (el) => txForm(findIn(state.budget.transactions, el.dataset.id)),
  'add-category': () => categoryForm(null),
  'edit-category': (el) => categoryForm(findIn(state.budget.categories, el.dataset.id)),
  'add-bill': () => billForm(null),
  'edit-bill': (el) => billForm(findIn(state.budget.bills, el.dataset.id)),
  'toggle-bill': (el) => { const day = sheetCfg?.recurDay; toggleBill(findIn(state.budget.bills, el.dataset.id), el.dataset.date); if (day && sheetCfg?.recurDay === day) $('#recurDayList').innerHTML = recurringBetween(day, day).map(recurRow).join(''); },
  'recur-tab': (el) => { ui.recurTab = el.dataset.tab; render(); },
  'recur-day': (el) => recurDaySheet(el.dataset.date),
  'sts-toggle': () => { ui.stsOpen = !ui.stsOpen; render(); },
  'sts-mode': (el, e) => { e?.stopPropagation?.(); state.settings.stsMode = el.dataset.m; save(); render(); },
  'tx-type': (el) => { const f = el.closest('.tx-type'); f.querySelector('input').value = el.dataset.v; f.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === el)); },
  'import-csv': () => pickBankCsv(),
  'bulk-bills': () => bulkBillsForm(),
  'edit-balance': () => openSheet({
    title: 'Checking balance',
    values: { balance: state.settings.balance },
    fields: [
      { name: 'balance', label: 'Current balance', type: 'money', placeholder: '0.00' },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">Used to work out what\'s safe to spend before your next paycheck. Leave blank to hide.</p>' },
    ],
    onSave(v) { state.settings.balance = v.balance; state.settings.balanceDate = today(); state.settings.balanceAt = Date.now(); state.settings.balanceSrc = ''; },
  }),

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
  // Picking a day shows its agenda right here: on small screens the month folds to that week so it fits on this page.
  'cal-select': (el) => { ui.calSel = el.dataset.date; if (monthKey(ui.calSel) !== ui.calMonth) ui.calMonth = monthKey(ui.calSel); if (!calRoomy()) ui.calFull = false; render(); },
  'cal-week': (el) => { ui.calSel = addDays(ui.calSel, 7 * el.dataset.n); ui.calMonth = monthKey(ui.calSel); render(); },
  'cal-full': () => { ui.calFull = !calFullMonth(); render(); },
  'cal-who': (el) => { ui.calWho = el.dataset.id; render(); },
  'cal-today': () => { ui.calSel = today(); ui.calMonth = monthKey(today()); render(); },
  'add-event': (el) => eventForm(null, el.dataset.date),
  'edit-event': (el) => eventForm(findIn(state.events, el.dataset.id), null, el.dataset.date),

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
    if (f.elements.addToList && splitList(h.ingredients).length) f.elements.addToList.checked = true;
  },
  'meals-earlier': () => { ui.mealsEarlier = true; render(); },
  'week-to-list': () => {
    const items = mealNights().flatMap((d) => splitList(state.meals[d]?.ingredients));
    const n = items.filter((x) => addToList(x, '', true)).length;
    toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to the list 🛒` : 'Everything is already on the list');
    save();
  },

  // Projects
  'add-project': () => projectForm(null),
  'edit-project': (el) => projectForm(findIn(state.projects, el.dataset.id)),
  'proj-filter': (el) => { ui.projFilter = el.dataset.f; render(); },
  'proj-tab': (el) => { ui.projTab = el.dataset.tab; render(); },
  'cycle-project': (el) => {
    const p = findIn(state.projects, el.dataset.id);
    p.status = PROJECT_STATUS[(PROJECT_STATUS.indexOf(p.status) + 1) % PROJECT_STATUS.length];
    if (p.status === 'done') { p.doneDate = today(); toast(`🎉 ${p.name} is done!`); } else delete p.doneDate;
    save(); render();
  },
  'toggle-step': (el) => {
    const p = findIn(state.projects, el.dataset.p);
    const s = findIn(p.steps, el.dataset.id);
    s.done = !s.done;
    if (s.done && p.status !== 'done' && p.status !== 'active') p.status = 'active';
    if (s.done && p.steps.every((x) => x.done) && p.status !== 'done') toast('All steps done! Tap the status to mark the project ✅ Done');
    save(); render();
  },
  'edit-step': (el) => { const p = findIn(state.projects, el.dataset.p); stepForm(p, findIn(p.steps, el.dataset.id)); },
  'toggle-material': (el) => { const p = findIn(state.projects, el.dataset.p); toggleMaterial(p, findIn(p.items, el.dataset.id)); },
  'edit-material': (el) => { const p = findIn(state.projects, el.dataset.p); materialForm(p, findIn(p.items, el.dataset.id)); },
  'materials-to-list': (el) => {
    const p = findIn(state.projects, el.dataset.id);
    const n = p.items.filter((i) => !i.bought).filter((i) => addToList(i.name, [(Number(i.qty) || 1) > 1 ? `x${i.qty}` : '', p.name].filter(Boolean).join(' · '), true)).length;
    toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to the shopping list 🛒` : 'Already on the list');
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
    const synced = typeof Sync !== 'undefined' && Sync.cfg;
    if (!confirm(`Erase ALL family data on this ${synced ? 'phone? Sync will be turned off on this phone first, so the family\'s shared data is NOT affected.' : 'device? This cannot be undone. (Make a backup first!)'}`)) return;
    if (synced) {
      Sync.ref = null; stopListening(); // stop pushing to the family before erasing
      localStorage.removeItem('gomezfam:sync'); localStorage.removeItem('gomezfam:base'); localStorage.removeItem('gomezfam:seen'); localStorage.removeItem('gomezfam:wpos');
      state = defaultState(); // pagehide re-saves `state`, so reset it too
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      location.reload();
      return;
    }
    localStorage.removeItem('gomezfam:seen'); localStorage.removeItem('gomezfam:wpos');
    state = defaultState(); save(); applyTheme(); go('home'); toast('All data erased');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  if (/^(toggle-|upkeep-done)/.test(el.dataset.action)) ui.pop = { a: el.dataset.action, id: el.dataset.id, date: el.dataset.date };
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.submit === 'project-step') {
    const p = findIn(state.projects, form.dataset.id);
    let title = form.elements.step.value.trim();
    if (!title) return;
    let hours = null;
    const m = title.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)$/i); // "Prime walls 2h"
    if (m) { title = m[1]; hours = +m[2]; }
    p.steps.push({ id: uid(), title, hours, done: false });
    save(); render(); $('[data-submit="project-step"] input')?.focus();
    return;
  }
  if (form.dataset.submit === 'project-item') {
    const p = findIn(state.projects, form.dataset.id);
    let name = form.elements.newMaterial.value.trim();
    if (!name) return;
    let qty = 1, cost = null;
    const price = name.match(/^(.*?)\s*\$\s*(\d+(?:\.\d+)?)\s*(?:ea|each)?$/i); // "... $45"
    if (price) { name = price[1]; cost = +price[2]; }
    const q = name.match(/^(\d+(?:\.\d+)?)\s*[x×]\s+(.+)$/i) || name.match(/^(\d+(?:\.\d+)?)\s+(.+)$/); // "2 x paint" / "2 paint"
    if (q) { qty = +q[1]; name = q[2]; }
    p.items.push({ id: uid(), name, qty, cost, bought: false });
    save(); render(); $('[data-submit="project-item"] input')?.focus();
    return;
  }
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
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.version || !Array.isArray(data.members)) throw new Error('Not a backup file');
      if (!confirm(typeof Sync !== 'undefined' && Sync.ref ? 'Replace the WHOLE FAMILY’s shared data (every phone) with this backup?' : 'Replace everything on this device with this backup?')) return;
      // Keep what was here, so a wrong file can be undone (also left in storage under gomezfam:pre-import)
      const before = JSON.stringify(state);
      try { localStorage.setItem('gomezfam:pre-import', before); } catch {}
      const swap = (s) => { const syncRev = state.settings.syncRev; state = migrate(s); if (syncRev != null) state.settings.syncRev = syncRev; save(); applyTheme(); render(); }; // syncRev belongs to this phone, not the file
      swap(data);
      toast('Backup restored ✓', () => { swap(JSON.parse(before)); toast('Restore undone'); });
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
autopayCatchUp();
// sync.js (the last feature script) draws the first screen; this is only a fallback.
document.addEventListener('DOMContentLoaded', () => { if (lastRouteKey === null) render(); });

// Refresh "today" if the app is left open past midnight / resumed from background.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && autopayCatchUp()) render();
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    ui.calSel = lastDay; ui.calMonth = monthKey(lastDay); ui.budgetMonth = monthKey(lastDay); ui.mealsWeek = weekStart(lastDay);
    render();
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Always check for a new version. A new version waits (so old and new files never mix in one session) until you tap
  // "Reload", or the app goes to the background, then it takes over and the app reloads once.
  const hadController = !!navigator.serviceWorker.controller;
  let waiting = null;
  const apply = () => waiting?.postMessage('skip-waiting');
  const offer = (w) => {
    if (!w || !navigator.serviceWorker.controller) return;
    waiting = w;
    if ($('#swUpdate')) return;
    const el = document.createElement('div');
    el.id = 'swUpdate'; el.className = 'sw-update'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 84px);z-index:9999;display:flex;gap:10px;align-items:center;padding:8px 8px 8px 14px;border-radius:999px;background:var(--text,#222);color:var(--bg,#fff);font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    el.innerHTML = '<span>Update ready</span><button type="button" class="mini-btn" style="background:var(--accent,#c65d3b);color:#fff;border-radius:999px;padding:6px 12px">Reload</button>';
    el.querySelector('button').onclick = apply;
    document.body.appendChild(el);
  };
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  // Backgrounded with an update waiting: take it now, unseen
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') apply(); });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}
