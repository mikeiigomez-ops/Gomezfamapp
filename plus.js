/* v5 features: profiles & activity feed, shopping together, cash-flow forecast, rewards store,
   plan-my-week, Family Wrapped, privacy lock, voice + Siri for Magic Add, and a customizable Home.
   Loaded after extras.js and before sync.js; uses the shared globals from app.js / extras.js / ui.js. */
'use strict';

Object.assign(TITLES, { activity: 'Family Activity', wrapped: 'Wrapped' });
const DEVICE_ID = (() => { try { let d = localStorage.getItem('gomezfam:device'); if (!d) { d = uid(); localStorage.setItem('gomezfam:device', d); } return d; } catch { return 'device'; } })();
const meId = () => (state.settings.me && state.members.some((m) => m.id === state.settings.me) ? state.settings.me : '');
const whoName = (id) => (id && state.members.some((m) => m.id === id) ? member(id).name : 'Someone');
function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = iso(new Date(ms));
  return d === addDays(today(), -1) ? 'Yesterday' : fmtDate(d, { month: 'short', day: 'numeric' });
}

/* =========================================================
   1 · Who's this phone + Family activity feed
   The feed is built by diffing the data each time this phone saves, so every way of changing
   things (forms, swipes, Magic Add, Store Mode…) is captured without touching each feature.
   ========================================================= */
function takeSnap() {
  const paid = new Set();
  for (const b of state.budget.bills) for (const [d, v] of Object.entries(b.paid || {})) if (v) paid.add(`${b.id}|${d}`);
  return {
    tx: new Set(state.budget.transactions.map((t) => t.id)),
    list: new Map(state.shop.list.map((i) => [i.id, i.done])),
    paid,
    chores: new Map(state.chores.map((c) => [c.id, (c.log || []).length])),
    events: new Set(state.events.map((e) => e.id)),
    contrib: new Set(state.goals.flatMap((g) => (g.contributions || []).map((c) => c.id))),
    steps: new Set(state.projects.flatMap((p) => p.steps.filter((s) => s.done).map((s) => s.id))),
    meals: new Map(Object.entries(state.meals).map(([d, m]) => [d, m.dinner || ''])),
    gifts: new Map(state.gifts.map((g) => [g.id, g.status])),
    upkeep: new Map(state.maintenance.map((u) => [u.id, u.lastDone || ''])),
    redeem: new Map((state.redemptions || []).map((r) => [r.id, r.status])),
    projects: new Map(state.projects.map((p) => [p.id, p.status])),
  };
}
let actSnap = takeSnap();
function activityResync() { actSnap = takeSnap(); }

function onLocalSave() {
  const prev = actSnap, now = takeSnap();
  actSnap = now;
  const out = [];
  const add = (icon, text, to = '') => out.push({ icon, text, to });
  for (const t of state.budget.transactions) if (!prev.tx.has(t.id) && !String(t.id).startsWith('auto-')) {
    add(t.type === 'income' ? '💰' : '💸', `${t.type === 'income' ? 'logged income' : 'spent'} ${money(t.amount)}${t.note ? ` · ${t.note}` : ''}`, 'budget');
  }
  const added = state.shop.list.filter((i) => !prev.list.has(i.id));
  if (added.length > 2) add('🛒', `added ${added.length} items to the list`, 'shop');
  else for (const i of added) add('🛒', `added ${i.name} to the list`, 'shop');
  const got = state.shop.list.filter((i) => i.done && prev.list.get(i.id) === false);
  if (got.length > 2) add('✅', `got ${got.length} items`, 'shop'); else for (const i of got) add('✅', `got ${i.name}`, 'shop');
  for (const b of state.budget.bills) for (const [d, v] of Object.entries(b.paid || {})) {
    if (v && !prev.paid.has(`${b.id}|${d}`) && !String(v).startsWith('auto-')) {
      add(b.type === 'income' ? '💰' : '💳', `${b.type === 'income' ? 'received' : 'paid'} ${b.name}`, 'budget');
    }
  }
  for (const c of state.chores) if ((c.log || []).length > (prev.chores.get(c.id) ?? (c.log || []).length)) add('🧹', `did “${c.title}”`, 'chores');
  for (const e of state.events) if (!prev.events.has(e.id)) add('📅', `added ${e.title} · ${fmtDate(e.date)}`, 'calendar');
  for (const g of state.goals) for (const c of g.contributions || []) if (!prev.contrib.has(c.id)) add(g.emoji || '🎯', `${c.amount >= 0 ? 'added' : 'took'} ${money(Math.abs(c.amount))} ${c.amount >= 0 ? 'to' : 'from'} ${g.name}`, `goal/${g.id}`);
  for (const p of state.projects) for (const s of p.steps) if (s.done && !prev.steps.has(s.id)) add(p.emoji || '🔨', `finished “${s.title}” · ${p.name}`, `project/${p.id}`);
  for (const p of state.projects) if (p.status === 'done' && prev.projects.get(p.id) && prev.projects.get(p.id) !== 'done') add('🎉', `completed ${p.name}`, `project/${p.id}`);
  for (const [d, m] of Object.entries(state.meals)) if (m.dinner && prev.meals.get(d) !== m.dinner) add('🍽️', `planned ${m.dinner} for ${fmtDate(d, { weekday: 'long' })}`, 'meals');
  for (const g of state.gifts) if (g.status !== 'idea' && prev.gifts.get(g.id) && prev.gifts.get(g.id) !== g.status) add('🎁', `${g.status} ${g.idea}`, `person/${g.personId}`);
  for (const u of state.maintenance) if (u.lastDone && u.lastDone !== prev.upkeep.get(u.id) && prev.upkeep.has(u.id)) add(u.emoji || '🔧', `did ${u.title}`, 'upkeep');
  for (const r of state.redemptions || []) {
    const was = prev.redeem.get(r.id), rw = state.rewards.find((x) => x.id === r.rewardId);
    if (!was) add('🎟️', `${whoName(r.memberId)} asked for ${rw?.name || 'a reward'}`, 'chores');
    else if (was !== r.status && r.status === 'approved') add('🏆', `approved ${rw?.name || 'a reward'} for ${whoName(r.memberId)}`, 'chores');
  }
  if (!out.length) return;
  const who = meId(), at = Date.now();
  state.activity = [...out.slice(0, 6).map((x) => ({ id: uid(), at, who, ...x })), ...(state.activity || [])].slice(0, 200);
}
// Automatic (autopay) changes shouldn't show up as someone's action.
const _autopay = autopayCatchUp;
autopayCatchUp = function () { const n = _autopay(); activityResync(); return n; };

function activityRow(a) {
  const m = a.who && state.members.some((x) => x.id === a.who) ? member(a.who) : null;
  return `<button class="row tap act-row" style="width:100%;text-align:left" ${a.to ? `data-action="go" data-to="${esc(a.to)}"` : ''}>
    <div class="act-av">${m ? avatar(m) : '<div class="avatar">👤</div>'}<span class="act-ic">${esc(a.icon)}</span></div>
    <div class="grow"><div class="act-text"><b>${esc(m ? m.name : 'Someone')}</b> ${esc(a.text)}</div><div class="sub">${timeAgo(a.at)}</div></div>
  </button>`;
}
views.activity = () => {
  const all = state.activity || [], shown = ui.actN || 60, list = all.slice(0, shown); // newest 60, more on request
  const byDay = {};
  for (const a of list) (byDay[iso(new Date(a.at))] ||= []).push(a);
  return `${!meId() && state.members.length > 1 ? whoAmICard() : ''}
    ${Object.entries(byDay).map(([d, xs]) => `<div class="section-title">${d === today() ? 'Today' : d === addDays(today(), -1) ? 'Yesterday' : fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    <div class="card flush">${xs.map(activityRow).join('')}</div>`).join('') || `<div class="card empty"><span class="big">📰</span>Everything the family does shows up here — groceries added, bills paid, chores done.</div>`}
    ${all.length > shown ? '<button class="btn secondary block" data-action="act-more">Show more</button>' : ''}`;
};
actions['act-more'] = () => { ui.actN = (ui.actN || 60) + 60; render(); };
function whoAmICard() {
  return `<div class="card whoami"><h3>👋 Who's using this phone?</h3>
    <div class="whoami-row">${state.members.map((m) => `<button data-action="set-me" data-id="${m.id}">${avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}</div>
    <div class="small muted">So the family feed shows who did what. Only asked once per phone.</div></div>`;
}
function homeActivity() {
  const list = (state.activity || []).filter((a) => Date.now() - a.at < 3 * 86400000).slice(0, 3);
  if (!list.length) return '';
  return `<div data-home="activity"><div class="section-title">Family activity<button data-action="go" data-to="activity">See all</button></div>
    <div class="card flush">${list.map(activityRow).join('')}</div></div>`;
}

/* =========================================================
   2 · Shopping together (live presence)
   ========================================================= */
const PRESENCE_TTL = 3 * 3600 * 1000;
function someoneShopping() {
  const s = state.shopping;
  return s && s.device !== DEVICE_ID && Date.now() - s.since < PRESENCE_TTL ? s : null;
}
function liveBanner() {
  const s = someoneShopping();
  if (!s) return '';
  const total = state.shop.list.length, got = state.shop.list.filter((i) => i.done).length;
  return `<button class="live-banner" data-action="go" data-to="shop"><span class="live-dot"></span>
    <span class="grow"><b>${esc(whoName(s.who))} is shopping now${s.store ? ` at ${esc(s.store)}` : ''}</b><small>${got} of ${total} in the cart · add items and they’ll see them instantly</small></span>${ICON.chev}</button>`;
}
function homeLive() {
  const parts = [];
  if (!meId() && state.members.length > 1) parts.push(whoAmICard());
  const lb = liveBanner();
  if (lb) parts.push(lb);
  const wr = wrappedBanner();
  return `${parts.length ? `<div data-home="live">${parts.join('')}</div>` : ''}${wr ? `<div data-home="wrapped">${wr}</div>` : ''}`;
}
const _shopView = views.shop;
views.shop = () => liveBanner() + _shopView();

let wasInStore = false;
function syncPresence() {
  const inStore = currentRoute().name === 'store';
  if (inStore && !wasInStore) {
    state.shopping = { who: meId(), device: DEVICE_ID, since: Date.now(), store: state.shopping?.device === DEVICE_ID ? state.shopping.store || '' : '' };
    save();
  } else if (!inStore && wasInStore && state.shopping?.device === DEVICE_ID) {
    state.shopping = null;
    save();
  }
  wasInStore = inStore;
}

/* =========================================================
   3 · Cash-flow forecast (30 days)
   ========================================================= */
function forecastSeries(days = 30) {
  const start = balanceNow();
  if (start == null) return null;
  const t = today();
  const dim = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
  const daily = { [monthKey(t)]: flexLeft(monthKey(t)) / (dim(monthKey(t)) - parse(t).getDate() + 1) };
  const pts = [];
  let bal = start - sum(overdueBills(t), (x) => x.amount); // overdue bills still have to go out
  for (let i = 0; i <= days; i++) {
    const d = addDays(t, i), ym = monthKey(d);
    for (const x of recurringBetween(d, d)) if (!isPaid(x.b, x.date)) bal += x.b.type === 'income' ? x.amount : -x.amount;
    bal -= (daily[ym] ??= flexLeft(ym) / dim(ym)); // everyday spending, not counting budget a bill already uses
    pts.push({ d, v: bal });
  }
  return pts;
}
function forecastCard() {
  const pts = forecastSeries();
  if (!pts) return `<div class="card"><h3>📈 30-day forecast</h3><p class="small muted" style="margin:0 0 10px">Enter your checking balance to see where it’s headed — paychecks in, bills and everyday spending out.</p><button class="btn secondary block" data-action="edit-balance">Enter balance</button></div>`;
  const W = 340, H = 150, top = 16, bottom = 22, plotH = H - top - bottom;
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals, 0), max = Math.max(...vals, state.settings.balance);
  const span = max - min || 1;
  const x = (i) => 6 + (i / (pts.length - 1)) * (W - 12);
  const y = (v) => top + plotH - ((v - min) / span) * plotH;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const lowI = vals.indexOf(Math.min(...vals));
  const sel = Math.min(pts.length - 1, Math.max(0, ui.fcSel ?? lowI));
  const zero = min < 0 ? `<line x1="6" x2="${W - 6}" y1="${y(0)}" y2="${y(0)}" class="chart-avg"/>` : '';
  const ticks = [0, 7, 14, 21, 30].map((i) => `<text x="${x(i)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === 30 ? 'end' : 'middle'}" class="chart-lbl">${i === 0 ? 'Today' : fmtDate(pts[i].d, { month: 'short', day: 'numeric' })}</text>`).join('');
  const hits = pts.map((p, i) => `<rect x="${x(i) - (W / pts.length) / 2}" y="0" width="${W / pts.length}" height="${H}" fill="transparent" data-action="fc-day" data-i="${i}"></rect>`).join('');
  const low = pts[lowI];
  return `<div class="card">
    <h3>📈 Next 30 days</h3>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div><div class="stat" style="font-size:24px;color:${pts[sel].v < 0 ? 'var(--bad)' : 'inherit'}">${money(pts[sel].v, { maximumFractionDigits: 0 })}</div><div class="small muted">projected ${sel === 0 ? 'tonight' : fmtDate(pts[sel].d, { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>
      <div class="small" style="text-align:right;color:${low.v < 0 ? 'var(--bad)' : low.v < 300 ? 'var(--warn)' : 'var(--muted)'}">Lowest: <b>${money(low.v, { maximumFractionDigits: 0 })}</b><br>${fmtDate(low.d, { month: 'short', day: 'numeric' })}</div>
    </div>
    <svg class="chart forecast" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projected balance for the next 30 days">
      <defs><linearGradient id="fcfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${zero}
      <path d="${line}L${x(pts.length - 1)},${top + plotH}L${x(0)},${top + plotH}Z" fill="url(#fcfill)"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" style="stroke:var(--accent)"/>
      <line x1="${x(sel)}" x2="${x(sel)}" y1="${top}" y2="${top + plotH}" class="chart-avg"/>
      <circle cx="${x(sel)}" cy="${y(pts[sel].v)}" r="5" fill="var(--accent)" style="stroke:var(--surface);stroke-width:2.5"/>
      ${ticks}${hits}
    </svg>
    <div class="small muted">Balance + paychecks − bills − your normal daily spending. Tap the chart to check a day.</div>
  </div>`;
}

/* =========================================================
   4 · Chore rewards store
   ========================================================= */
const STARTER_REWARDS = [['📱', '30 min screen time', 10], ['🍽️', 'Pick tonight’s dinner', 15], ['🌙', 'Stay up 30 min late', 20], ['🍦', 'Ice cream trip', 25], ['🎬', 'Choose movie night', 15], ['💵', '$5 allowance', 30]];
// One reward currency for the whole family: chore ⭐ stars (Gems 💎 are play money, the piggy bank is real money).
const starsTxt = (n) => `${n} star${n === 1 ? '' : 's'}`;
// A kid's tick that is waiting for a grown-up's OK earns nothing yet (points, gems, streaks, badges).
const logOk = (l) => !!l && l.status !== 'pending';
function pointsEarned(id) { let n = 0; for (const c of state.chores) for (const l of c.log || []) if (l.memberId === id && logOk(l)) n += Number(c.points) || 1; return n; }
function pointsSpent(id) { return sum((state.redemptions || []).filter((r) => r.memberId === id && r.status !== 'denied'), (r) => r.cost); }
const pointsBalance = (id) => pointsEarned(id) - pointsSpent(id);
// Rewards can be just for some kids (forIds) and cost a different amount per kid (costs[id]).
const rewardFor = (r, id) => !id || !Array.isArray(r.forIds) || !r.forIds.length || r.forIds.includes(id);
const rewardCost = (r, id) => Math.max(1, Math.round(Number(r.costs?.[id]) || Number(r.cost) || 1));
const rewardsFor = (id) => state.rewards.filter((r) => rewardFor(r, id)).sort((a, b) => rewardCost(a, id) - rewardCost(b, id));

/* ---------- Chore pictures ---------- */
const CHORE_EMOJI = [[/trash|garbage|recycl|\bbins?\b/, '🗑️'], [/\bdogs?\b|puppy/, '🐶'], [/\bcats?\b|litter|kitty/, '🐱'], [/fish/, '🐠'], [/dish|plate|table/, '🍽️'], [/\bbed\b/, '🛏️'], [/laundry|clothes|fold|hamper|sock/, '🧺'], [/room|toys?\b|tidy/, '🧸'], [/plant|garden|flower/, '🪴'], [/homework|reading|study|practice|piano/, '📚'], [/teeth|tooth|floss/, '🪥'], [/vacuum|sweep|mop|floor|dust/, '🧹'], [/\bcar\b/, '🚗'], [/bath|shower/, '🛁'], [/lawn|mow|leaves|rake|yard/, '🍂'], [/cook|dinner|lunch|breakfast|snack/, '🍳'], [/feed|pet\b/, '🥣'], [/shoe|backpack|coat/, '🎒']];
function choreEmojiFor(title) { const t = norm(title); for (const [re, e] of CHORE_EMOJI) if (re.test(t)) return e; return '🧹'; }
const choreEmoji = (c) => c.emoji || choreEmojiFor(c.title);
const CHORE_PICKS = ['🗑️', '🐶', '🍽️', '🛏️', '🧺', '🧸', '🪴', '📚', '🪥', '🧹', '🐱', '🚗', '🍳', '🛁', '🍂', '🎒'];
// This period's check-offs (today / this week / ever, by how often it repeats)
const choreFrom = (c, t = today()) => (c.freq === 'daily' ? t : c.freq === 'weekly' ? weekStart(t) : '0000');
const choreNow = (c) => (c.log || []).filter((l) => l.date >= choreFrom(c) && l.date <= today());

/* ---------- Starter chores by age ---------- */
const STARTER_CHORES = {
  '4-6': [['🧸', 'Pick up toys', 'daily', 1], ['🛏️', 'Make bed', 'daily', 1], ['🍽️', 'Clear your plate', 'daily', 1], ['🧺', 'Clothes in the hamper', 'daily', 1], ['🐶', 'Feed the pet', 'daily', 1], ['🪥', 'Brush teeth', 'daily', 1]],
  '7-10': [['🛏️', 'Make bed', 'daily', 1], ['🍽️', 'Set the table', 'daily', 1], ['🐶', 'Feed the dog', 'daily', 1], ['📚', 'Homework done', 'daily', 2], ['🧺', 'Fold laundry', 'weekly', 2], ['🪴', 'Water the plants', 'weekly', 2], ['🧸', 'Tidy your room', 'weekly', 2]],
  '11+': [['🗑️', 'Take out the trash', 'weekly', 3], ['🍽️', 'Load the dishwasher', 'daily', 2], ['🧺', 'Do your own laundry', 'weekly', 3], ['🧹', 'Vacuum the living room', 'weekly', 3], ['🐶', 'Walk the dog', 'daily', 2], ['🧸', 'Clean your room', 'weekly', 3], ['🍳', 'Help make dinner', 'weekly', 3]],
};
const AGE_BANDS = [['4-6', '🧒 Ages 4–6'], ['7-10', '👧 Ages 7–10'], ['11+', '🧑 Ages 11+']];
function starterChoresSheet(kidId) {
  const ks = typeof kids === 'function' && kids().length ? kids() : state.members;
  if (!ks.length) { toast('Add family members first (Settings)'); return; }
  const k0 = ks.find((k) => k.id === kidId) || ks[0];
  const band = k0.ageBand || (k0.simple ? '4-6' : '7-10');
  const list = (b) => STARTER_CHORES[b].map(([e, t, f, p], i) => `<label class="toggle-row starter-row"><span><span class="chore-pic sm">${e}</span> ${esc(t)} <small class="muted">${FREQ_LABEL[f]} · ⭐ ${p}</small></span><input type="checkbox" name="st_${i}" checked></label>`).join('');
  openSheet({
    title: '🧹 Starter chores',
    saveLabel: 'Add chores',
    values: { kid: k0.id, band },
    fields: [
      { row: [{ name: 'kid', label: 'For', type: 'select', options: ks.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` })) }, { name: 'band', label: 'Age', type: 'select', options: AGE_BANDS.map(([value, label]) => ({ value, label })) }] },
      { type: 'html', html: `<div id="starterList">${list(band)}</div><p class="small muted" style="margin:6px 4px 0">Untick any you don’t want. You can edit them later.</p>` },
    ],
    onInput(form, e) { if (e.target.name === 'band') $('#starterList').innerHTML = list(e.target.value); },
    onSave(v) {
      const form = $('#sheetForm'), have = new Set(state.chores.filter((c) => c.memberId === v.kid).map((c) => norm(c.title)));
      let n = 0;
      STARTER_CHORES[v.band].forEach(([emoji, title, freq, points], i) => {
        if (!form.elements['st_' + i]?.checked || have.has(norm(title))) return;
        state.chores.push({ id: uid(), title, emoji, memberId: v.kid, freq, points, log: [] }); n++;
      });
      const m = state.members.find((x) => x.id === v.kid); if (m) m.ageBand = v.band;
      toast(n ? `🧹 Added ${n} chore${n > 1 ? 's' : ''} for ${whoName(v.kid)}` : 'Nothing new to add');
    },
  });
}

/* ---------- Weekly goals (each kid against their own goal, not each other) ---------- */
function weekStars(id, from = weekStart(today())) {
  const to = addDays(from, 7);
  let n = 0;
  for (const c of state.chores) for (const l of c.log || []) if (l.memberId === id && logOk(l) && l.date >= from && l.date < to) n += Number(c.points) || 1;
  return n;
}
function weekGoal(id) {
  const m = state.members.find((x) => x.id === id);
  if (Number(m?.weeklyGoal) > 0) return Math.round(m.weeklyGoal);
  return Math.max(5, sum(state.chores.filter((c) => c.memberId === id && c.freq !== 'once'), (c) => (Number(c.points) || 1) * (c.freq === 'daily' ? 7 : 1)));
}
// Stars per finished week (oldest first), not counting this week
function weekHistory(id) {
  const wk = {}, cur = weekStart(today());
  for (const c of state.chores) for (const l of c.log || []) if (l.memberId === id && logOk(l) && l.date) { const w = weekStart(l.date); if (w < cur) wk[w] = (wk[w] || 0) + (Number(c.points) || 1); }
  return Object.entries(wk).sort((a, b) => a[0].localeCompare(b[0])).map(([, n]) => n);
}
const bestWeek = (id) => Math.max(0, ...weekHistory(id));
// "Champion": beat your own best week (this week counts as soon as it goes past it)
function beatOwnBest(id) {
  const h = [...weekHistory(id), weekStars(id)];
  let best = 0;
  for (let i = 0; i < h.length; i++) { if (i > 0 && best > 0 && h[i] > best) return true; best = Math.max(best, h[i]); }
  return false;
}
function goalsBoard() {
  const ks = typeof kids === 'function' ? kids() : [];
  if (!ks.length) return '';
  return `<div class="section-title">This week’s goals</div><div class="card flush">${ks.map((k) => {
    const got = weekStars(k.id), goal = weekGoal(k.id), best = bestWeek(k.id), st = typeof choreStreak === 'function' ? choreStreak(k.id) : 0;
    return `<div class="row goal-row">${avatar(k)}<div class="grow"><div class="title">${esc(k.name)} <span class="small muted">⭐ ${got} / ${goal}</span></div>
      <div class="bar"><i style="width:${Math.min(100, (got / goal) * 100)}%;background:${k.color}"></i></div>
      <div class="sub">${got >= goal ? '🎉 Goal reached!' : `${goal - got} to go`}${best ? ` · best week ⭐ ${best}` : ''}${st >= 2 ? ` · 🔥 ${st} days` : ''}</div></div>
      <button class="mini-btn" data-action="kid-settings" data-id="${k.id}">Goal</button></div>`;
  }).join('')}</div><p class="small muted" style="margin:6px 4px 0">Each kid works toward their own goal — no ranking against siblings. Set it in Kid settings.</p>`;
}

/* ---------- Parent chores screen: the list first, then the goals ---------- */
function choreRowP(c) {
  const isDone = choreDone(c), m = c.memberId ? member(c.memberId) : null, now = choreNow(c);
  const last = now.at(-1), by = isDone && last?.memberId && state.members.some((x) => x.id === last.memberId) ? member(last.memberId) : null;
  const wait = now.some((l) => l.status === 'pending');
  return `<div class="row chore-row${isDone ? ' done' : ''}">
    <button class="check${isDone ? ' on' : ''}" data-action="toggle-chore" data-id="${c.id}" aria-label="Done">${ICON.check}</button>
    <span class="chore-pic" aria-hidden="true">${esc(choreEmoji(c))}</span>
    <button class="grow" style="text-align:left" data-action="edit-chore" data-id="${c.id}">
      <div class="title">${esc(c.title)}</div>
      <div class="sub">${FREQ_LABEL[c.freq] || ''} · ⭐ ${c.points || 1}${wait ? ' · ⏳ needs your OK' : by ? ` · done by ${esc(by.name)}` : ''}</div>
    </button>
    ${by ? avatar(by, true) : m ? avatar(m, true) : '<span class="pill">Anyone</span>'}
  </div>`;
}
function choresParent() {
  const todo = state.chores.filter((c) => !choreDone(c)), done = state.chores.filter((c) => choreDone(c));
  return `${typeof approvalCard === 'function' ? approvalCard() : ''}
    <div class="section-title">To do${state.chores.length ? '<button data-action="chore-starters">+ Starter chores</button>' : ''}</div>
    <div class="card flush">${todo.map(choreRowP).join('') || (state.chores.length ? '<div class="empty"><span class="big">✨</span>All done! Nice work, team.</div>'
      : '<div class="empty"><span class="big">✨</span>Add chores and assign them to family members. Each one earns ⭐ stars.<br><button class="btn" style="margin-top:12px" data-action="chore-starters">Starter chores by age</button></div>')}</div>
    ${done.length ? `<div class="section-title">Done</div><div class="card flush">${done.map(choreRowP).join('')}</div>` : ''}
    ${goalsBoard()}
    <button class="fab" data-action="add-chore" aria-label="Add chore">${ICON.plus}</button>`;
}

function rewardsView() {
  const pending = (state.redemptions || []).filter((r) => r.status === 'pending');
  const recent = (state.redemptions || []).filter((r) => r.status !== 'pending').slice(-5).reverse();
  const ks = typeof kids === 'function' && kids().length ? kids() : state.members;
  const forTag = (r) => (Array.isArray(r.forIds) && r.forIds.length ? `<small class="r-for">${r.forIds.filter((id) => state.members.some((m) => m.id === id)).map((id) => esc(member(id).name)).join(' & ')} only</small>` : '');
  const costTxt = (r) => { const cs = [...new Set(ks.filter((k) => rewardFor(r, k.id)).map((k) => rewardCost(r, k.id)))].sort((a, b) => a - b); return cs.length > 1 ? `⭐ ${cs[0]}–${cs.at(-1)}` : `⭐ ${cs[0] ?? r.cost}`; };
  return `
    <div class="wallets">${ks.map((m) => `<div class="wallet" style="--c:${m.color}">${avatar(m)}<b>⭐ ${pointsBalance(m.id)}</b><span>${esc(m.name)}</span></div>`).join('')}</div>
    ${pending.length ? `<div class="section-title">Waiting for a grown-up</div><div class="card flush">${pending.map((r) => {
      const rw = state.rewards.find((x) => x.id === r.rewardId);
      return `<div class="row">${avatar(member(r.memberId), true)}<div class="grow"><div class="title">${esc(rw?.emoji || '🎟️')} ${esc(rw?.name || 'Reward')}</div><div class="sub">${esc(whoName(r.memberId))} · ⭐ ${r.cost}</div></div>
        <button class="mini-btn" style="color:var(--bad)" data-action="reward-deny" data-id="${r.id}">Deny</button><button class="btn" style="padding:8px 14px" data-action="reward-approve" data-id="${r.id}">Approve</button></div>`;
    }).join('')}</div>` : ''}
    <div class="section-title">Rewards<button data-action="reward-new">+ Reward</button></div>
    ${state.rewards.length ? `<div class="reward-grid">${state.rewards.slice().sort((a, b) => a.cost - b.cost).map((r) => `<button class="reward" data-action="reward-redeem" data-id="${r.id}">
      <span class="r-emoji">${esc(r.emoji || '🎁')}</span><b>${esc(r.name)}</b><span class="r-cost">${costTxt(r)}</span>${forTag(r)}</button>`).join('')}</div>`
      : `<div class="card empty"><span class="big">🏆</span>Turn chore stars into rewards the kids actually want.<br><button class="btn" style="margin-top:12px" data-action="reward-starters">Add starter rewards</button></div>`}
    ${recent.length ? `<div class="section-title">History</div><div class="card flush">${recent.map((r) => { const rw = state.rewards.find((x) => x.id === r.rewardId); return `<div class="row"><div class="grow"><div class="title">${esc(rw?.name || (r.rewardId === 'cash' ? 'Cashed in' : 'Reward'))}</div><div class="sub">${esc(whoName(r.memberId))} · ${timeAgo(r.at)}</div></div><span class="pill ${r.status === 'approved' ? 'good' : 'bad'}">${r.status === 'approved' ? `−${r.cost} ⭐` : 'Denied'}</span></div>`; }).join('')}</div>` : ''}
    ${state.rewards.length ? `<p class="small muted" style="margin:10px 4px">Tap a reward to redeem it (or edit it). Kids earn ⭐ stars from chores and high-fives.</p>` : ''}
  `;
}
const _choresView = views.chores;
views.chores = () => {
  const tab = ui.choreTab || 'chores';
  const tabs = `<div class="segmented"><button class="${tab === 'chores' ? 'active' : ''}" data-action="chore-tab" data-tab="chores">Chores</button><button class="${tab === 'rewards' ? 'active' : ''}" data-action="chore-tab" data-tab="rewards">Rewards</button></div>`;
  return tabs + (tab === 'rewards' ? rewardsView() : choresParent());
};
void _choresView;
function rewardForm(r) {
  const isNew = !r;
  const ks = typeof kids === 'function' ? kids() : [];
  const v0 = { ...(r || { emoji: '🎁', cost: 10 }) };
  for (const k of ks) { v0['for_' + k.id] = rewardFor(r || {}, k.id); v0['cost_' + k.id] = r?.costs?.[k.id] ?? ''; }
  openSheet({
    title: isNew ? 'New reward' : 'Edit reward',
    values: v0,
    fields: [
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🎁' }, { name: 'name', label: 'Reward', required: true, placeholder: 'e.g. Pizza party' }] },
      { name: 'cost', label: 'Cost (⭐ stars)', type: 'number', required: true },
      ...(ks.length > 1 ? [{ type: 'html', html: '<p class="small muted" style="margin:4px 4px 8px">Who can get it, and what it costs them (blank = the usual cost):</p>' },
        ...ks.map((k) => ({ row: [{ name: 'for_' + k.id, label: `${k.emoji} ${k.name}`, type: 'checkbox' }, { name: 'cost_' + k.id, label: `${k.name} pays ⭐`, type: 'number', placeholder: 'usual' }] }))] : []),
    ],
    onSave(v) {
      const out = { emoji: v.emoji, name: v.name, cost: Math.max(1, Math.round(v.cost)) };
      if (ks.length > 1) {
        const on = ks.filter((k) => v['for_' + k.id]).map((k) => k.id);
        if (!on.length) { toast('Pick at least one kid'); return false; }
        out.forIds = on.length === ks.length ? [] : on;
        out.costs = {};
        for (const k of ks) { const n = Math.round(Number(v['cost_' + k.id]) || 0); if (n > 0 && n !== out.cost) out.costs[k.id] = n; }
      }
      if (isNew) state.rewards.push({ id: uid(), ...out }); else Object.assign(r, out);
    },
    onDelete: isNew ? null : () => withUndo(`${r.name} deleted`, () => { state.rewards = state.rewards.filter((x) => x.id !== r.id); }),
  });
}

/* =========================================================
   5 · Plan my week
   ========================================================= */
const DEFAULT_DINNERS = ['Tacos', 'Spaghetti & meatballs', 'Chicken stir fry', 'Chili', 'Homemade pizza', 'Grilled chicken & veggies', 'Soup & grilled cheese', 'Breakfast for dinner', 'Burgers', 'Salmon & rice', 'Enchiladas', 'Sheet-pan sausage & potatoes', 'Fajitas', 'Mac & cheese bake', 'Leftovers night'];
function planCandidates(exclude) {
  const seen = new Set(exclude.map(norm));
  const pool = [];
  for (const r of state.recipes || []) if (!seen.has(norm(r.name))) { pool.push(r.name); if (r.favorite) pool.push(r.name); }
  for (const h of mealHistory()) if (!seen.has(norm(h.name))) pool.push(h.name);
  for (const d of DEFAULT_DINNERS) if (!seen.has(norm(d))) pool.push(d);
  // shuffle and de-duplicate (favorites appear twice, so they win more often)
  const out = [];
  for (const n of pool.sort(() => Math.random() - 0.5)) if (!out.some((o) => norm(o) === norm(n))) out.push(n);
  return out;
}
function ingredientsFor(name) {
  const r = (state.recipes || []).find((x) => norm(x.name) === norm(name));
  if (r) return splitList(r.ingredients).join(', ');
  return mealHistory().find((h) => norm(h.name) === norm(name))?.ingredients || '';
}
function planMyWeek() {
  const t = today(), ws = ui.mealsWeek;
  const nights = [...Array(7)].map((_, i) => addDays(ws, i)).filter((d) => d >= t && !state.meals[d]?.dinner);
  if (!nights.length) { toast('Every night this week is already planned 🎉'); return; }
  const recent = Object.entries(state.meals).filter(([d, m]) => m.dinner && d >= addDays(t, -14)).map(([, m]) => m.dinner);
  const picks = planCandidates(recent);
  const values = { shop: true };
  nights.forEach((d, i) => { values['n' + i] = picks[i % picks.length]; });
  openSheet({
    title: '✨ Plan my week',
    saveLabel: 'Plan',
    values,
    fields: [
      { type: 'html', html: `<p class="small muted" style="margin:0 4px 12px">Picked from your recipes, favorites and past dinners — nothing you’ve had in the last two weeks. Change anything you like.</p>` },
      ...nights.map((d, i) => ({ name: 'n' + i, label: fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' }), type: 'select', options: [...new Set([values['n' + i], ...picks.slice(0, 25)])].map((x) => ({ value: x, label: x })).concat([{ value: '', label: '— Leave open —' }]) })),
      { name: 'shop', label: 'Add the ingredients to the shopping list', type: 'checkbox' },
    ],
    onSave(v) {
      let n = 0, items = 0;
      nights.forEach((d, i) => {
        const name = v['n' + i];
        if (!name) return;
        const ing = ingredientsFor(name);
        const r = (state.recipes || []).find((x) => norm(x.name) === norm(name));
        state.meals[d] = { dinner: name, ingredients: ing, ...(r ? { recipeId: r.id } : {}) };
        n++;
        if (v.shop) items += splitList(ing).filter((x) => addToList(x, name, true)).length;
      });
      toast(`🍽️ Planned ${n} dinner${n === 1 ? '' : 's'}${items ? ` · ${items} items to the list` : ''}`);
    },
  });
}
const _mealsView = views.meals;
views.meals = () => {
  const html = _mealsView();
  if (ui.mealsTab === 'recipes') return html;
  const i = html.indexOf('<div class="card flush">');
  return i < 0 ? html : html.slice(0, i) + `<button class="plan-cta" data-action="plan-week"><span>✨</span><span class="grow"><b>Plan my week</b><small>Fill the open nights in one tap</small></span>${ICON.chev}</button>` + html.slice(i);
};

/* =========================================================
   6 · Family Wrapped (monthly story)
   ========================================================= */
function wrappedMonth() {
  const t = today();
  return parse(t).getDate() <= 7 ? addMonths(monthKey(t), -1) : monthKey(t);
}
function wrappedBanner() {
  const t = today();
  if (parse(t).getDate() > 7) return '';
  const ym = addMonths(monthKey(t), -1);
  if (!state.budget.transactions.some((x) => x.date.startsWith(ym))) return '';
  return `<button class="wrapped-banner" data-action="go" data-to="wrapped/${ym}"><span>🎬</span><span class="grow"><b>Your ${parse(ym + '-01').toLocaleDateString(undefined, { month: 'long' })} Wrapped is ready</b><small>A recap of the family’s month</small></span>${ICON.chev}</button>`;
}
function wrappedStats(ym) {
  const mName = parse(ym + '-01').toLocaleDateString(undefined, { month: 'long' });
  const tx = state.budget.transactions.filter((x) => x.date.startsWith(ym) && x.type !== 'income');
  const spent = sum(tx, (x) => x.amount), prev = spentIn(addMonths(ym, -1));
  const cats = state.budget.categories.map((c) => ({ c, v: spentIn(ym, c.id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const limit = sum(state.budget.categories, (c) => c.limit);
  const biggest = tx.slice().sort((a, b) => b.amount - a.amount)[0];
  const choreLogs = state.chores.flatMap((c) => (c.log || []).filter((l) => l.date.startsWith(ym)).map((l) => ({ ...l, pts: Number(c.points) || 1 })));
  const pts = {}; for (const l of choreLogs) if (l.memberId) pts[l.memberId] = (pts[l.memberId] || 0) + l.pts;
  const champ = Object.entries(pts).sort((a, b) => b[1] - a[1])[0];
  const meals = Object.entries(state.meals).filter(([d, m]) => d.startsWith(ym) && m.dinner).map(([, m]) => m.dinner);
  const mealCount = {}; for (const m of meals) mealCount[m] = (mealCount[m] || 0) + 1;
  const favMeal = Object.entries(mealCount).sort((a, b) => b[1] - a[1])[0];
  const saved = sum(state.goals.flatMap((g) => (g.contributions || []).filter((c) => c.date.startsWith(ym))), (c) => c.amount);
  let events = 0; const last = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
  for (let d = 1; d <= last; d++) events += eventsOn(`${ym}-${pad(d)}`).filter((e) => e.kind === 'event').length;
  const dow = [0, 0, 0, 0, 0, 0, 0]; for (const x of tx) dow[parse(x.date).getDay()] += x.amount;
  const busiest = dow.indexOf(Math.max(...dow));
  return { mName, spent, prev, cats, limit, biggest, choreCount: choreLogs.length, champ, meals, favMeal, saved, events, busiest, txCount: tx.length };
}
function wrappedSlides(ym) {
  const s = wrappedStats(ym);
  const slides = [];
  const fam = state.members.length > 1 ? 'The Gomez family' : 'You';
  slides.push({ bg: 1, html: `<div class="w-emoji">🎬</div><div class="w-kicker">${esc(s.mName)} ${ym.slice(0, 4)}</div><div class="w-big">Family<br>Wrapped</div><div class="w-sub">${esc(fam)}’s month, in ${'a few'} slides</div>` });
  if (s.spent) {
    const d = s.prev ? Math.round(((s.spent - s.prev) / s.prev) * 100) : null;
    slides.push({ bg: 2, html: `<div class="w-kicker">You spent</div><div class="w-big">${money(s.spent, { maximumFractionDigits: 0 })}</div><div class="w-sub">across ${s.txCount} purchases${d != null ? ` · ${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs last month` : ''}</div>` });
  }
  if (s.cats[0]) {
    slides.push({ bg: 3, html: `<div class="w-emoji">${esc(s.cats[0].c.emoji)}</div><div class="w-kicker">Top category</div><div class="w-big">${esc(s.cats[0].c.name)}</div><div class="w-sub">${money(s.cats[0].v, { maximumFractionDigits: 0 })} · ${Math.round((s.cats[0].v / s.spent) * 100)}% of spending</div>
      <div class="w-bars">${s.cats.slice(0, 4).map((x) => `<div><span>${esc(x.c.emoji)} ${esc(x.c.name)}</span><i style="width:${(x.v / s.cats[0].v) * 100}%"></i></div>`).join('')}</div>` });
  }
  if (s.limit && s.spent) {
    const under = s.limit - s.spent;
    slides.push({ bg: under >= 0 ? 4 : 5, html: `<div class="w-emoji">${under >= 0 ? '🙌' : '😬'}</div><div class="w-kicker">Budget</div><div class="w-big">${money(Math.abs(under), { maximumFractionDigits: 0 })}</div><div class="w-sub">${under >= 0 ? 'under budget. Nicely done!' : 'over budget. Next month’s a fresh start.'}</div>` });
  }
  if (s.biggest) slides.push({ bg: 6, html: `<div class="w-kicker">Biggest single purchase</div><div class="w-big">${money(s.biggest.amount, { maximumFractionDigits: 0 })}</div><div class="w-sub">${esc(s.biggest.note || category(s.biggest.categoryId).name)} · ${fmtDate(s.biggest.date, { month: 'short', day: 'numeric' })}</div><div class="w-small">Your big spending day was usually <b>${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.busiest]}</b>.</div>` });
  if (s.choreCount) slides.push({ bg: 7, html: `<div class="w-emoji">🧹</div><div class="w-kicker">Chores done</div><div class="w-big">${s.choreCount}</div>${s.champ ? `<div class="w-sub">🏆 MVP: <b>${esc(whoName(s.champ[0]))}</b> with ${s.champ[1]} points</div>` : ''}` });
  if (s.meals.length) slides.push({ bg: 8, html: `<div class="w-emoji">🍽️</div><div class="w-kicker">Dinners planned</div><div class="w-big">${s.meals.length}</div>${s.favMeal ? `<div class="w-sub">Family favorite: <b>${esc(s.favMeal[0])}</b>${s.favMeal[1] > 1 ? ` (${s.favMeal[1]}×)` : ''}</div>` : ''}` });
  if (s.saved > 0) slides.push({ bg: 4, html: `<div class="w-emoji">🎯</div><div class="w-kicker">Saved toward goals</div><div class="w-big">${money(s.saved, { maximumFractionDigits: 0 })}</div>` });
  if (s.events) slides.push({ bg: 2, html: `<div class="w-emoji">📅</div><div class="w-kicker">On the calendar</div><div class="w-big">${s.events}</div><div class="w-sub">events, games, appointments & date nights</div>` });
  slides.push({ bg: 1, html: `<div class="w-emoji">✨</div><div class="w-big" style="font-size:40px">Here’s to ${esc(parse(addMonths(ym, 1) + '-01').toLocaleDateString(undefined, { month: 'long' }))}</div><div class="w-sub">Made with love by your family app</div><button class="w-share" data-action="wrapped-share" data-ym="${ym}">📤 Share recap</button>` });
  return slides;
}
let storyTimer = null;
views.wrapped = (ym) => {
  ym = /^\d{4}-\d{2}$/.test(ym || '') ? ym : wrappedMonth();
  const slides = wrappedSlides(ym);
  const i = Math.min(ui.storyIdx || 0, slides.length - 1);
  return `<div class="story story-bg-${slides[i].bg}" data-ym="${ym}">
    <div class="story-bars">${slides.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</div>
    <button class="story-close" data-action="story-close" aria-label="Close">${ICON.x}</button>
    <div class="story-slide" key="${i}">${slides[i].html}</div>
    <button class="story-prev" data-action="story-prev" aria-label="Previous"></button>
    <button class="story-next" data-action="story-next" data-n="${slides.length}" aria-label="Next"></button>
  </div>`;
};
function storyTick() {
  clearTimeout(storyTimer);
  if (currentRoute().name !== 'wrapped') return;
  storyTimer = setTimeout(() => { const n = $('.story-next'); if (n && (ui.storyIdx || 0) < Number(n.dataset.n) - 1) { ui.storyIdx = (ui.storyIdx || 0) + 1; render(); } }, 6500);
}
async function shareWrapped(ym) {
  const s = wrappedStats(ym);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const a1 = cs.getPropertyValue('--al').trim() || '#c9583a', a2 = cs.getPropertyValue('--al2').trim() || '#e8954f';
  const grad = g.createLinearGradient(0, 0, 1080, 1920); grad.addColorStop(0, a1); grad.addColorStop(1, a2);
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(900, 220, 380, 0, 7); g.fill(); g.beginPath(); g.arc(120, 1750, 320, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'left';
  const font = (w, px) => `${w} ${px}px ui-rounded, -apple-system, system-ui, sans-serif`;
  g.font = font(700, 44); g.globalAlpha = .85; g.fillText(`${s.mName.toUpperCase()} ${ym.slice(0, 4)}`, 90, 220); g.globalAlpha = 1;
  g.font = font(900, 130); g.fillText('Family', 90, 370); g.fillText('Wrapped', 90, 510);
  const rows = [
    s.spent ? ['💸 Spent', money(s.spent, { maximumFractionDigits: 0 })] : null,
    s.cats[0] ? [`${s.cats[0].c.emoji} Top category`, s.cats[0].c.name] : null,
    s.limit && s.spent ? [s.limit >= s.spent ? '🙌 Under budget' : '😬 Over budget', money(Math.abs(s.limit - s.spent), { maximumFractionDigits: 0 })] : null,
    s.choreCount ? ['🧹 Chores done', String(s.choreCount)] : null,
    s.champ ? ['🏆 Chore MVP', whoName(s.champ[0])] : null,
    s.meals.length ? ['🍽️ Dinners planned', String(s.meals.length)] : null,
    s.saved > 0 ? ['🎯 Saved', money(s.saved, { maximumFractionDigits: 0 })] : null,
    s.events ? ['📅 Events', String(s.events)] : null,
  ].filter(Boolean).slice(0, 7);
  let y = 700;
  for (const [k, v] of rows) {
    g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.roundRect(70, y - 70, 940, 130, 36); g.fill();
    g.fillStyle = '#fff'; g.font = font(600, 46); g.textAlign = 'left'; g.fillText(k, 110, y + 12);
    g.font = font(850, 54); g.textAlign = 'right'; g.fillText(v, 970, y + 14); y += 160;
  }
  g.textAlign = 'center'; g.font = font(600, 38); g.globalAlpha = .85; g.fillText('🏠 Gomez Family', 540, 1830);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `family-wrapped-${ym}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Family Wrapped · ${s.mName}` }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
}

/* =========================================================
   7 · Privacy lock (Face ID passkey + PIN)
   This is a privacy screen for the phone, not encryption: it keeps casual eyes out.
   ========================================================= */
const LOCK_KEY = 'gomezfam:lock';
const lockCfg = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)); } catch { return null; } };
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function sha(text) { return b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gomezfam:' + text))); }
const passkeySupported = () => !!(window.PublicKeyCredential && navigator.credentials?.create);
let lockedAt = 0, hiddenAt = 0, pinBuf = '', pinFails = 0, pinBlockedUntil = 0;
function showLock() {
  const cfg = lockCfg();
  if (!cfg?.pin) return;
  let el = $('#lock');
  if (!el) { el = document.createElement('div'); el.id = 'lock'; el.className = 'lock'; document.body.appendChild(el); }
  pinBuf = '';
  el.innerHTML = `<div class="lock-inner">
    <img src="icons/icon-192.png" alt="" class="lock-icon">
    <div class="lock-title">Gomez Family</div>
    <div class="lock-sub">Enter your PIN${cfg.cred ? ' or use Face ID' : ''}</div>
    <div class="pin-dots">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-action="pin-key" data-k="${n}">${n}</button>`).join('')}
      ${cfg.cred ? `<button data-action="lock-faceid" aria-label="Use Face ID" class="kp-icon">🙂</button>` : '<span></span>'}
      <button data-action="pin-key" data-k="0">0</button><button data-action="pin-key" data-k="del" class="kp-icon" aria-label="Delete">⌫</button></div>
    ${cfg.cred ? `<button class="lock-faceid" data-action="lock-faceid">Unlock with Face ID</button>` : ''}
  </div>`;
  document.body.classList.add('locked');
  // The lock hides the app from screen readers and keyboards too, not just from eyes
  for (const id of ['app', 'sheet', 'sheetBackdrop', 'toast']) document.getElementById(id)?.setAttribute('inert', '');
  lockedAt = Date.now();
}
let pendingDeepLink = '';
function unlock() {
  $('#lock')?.remove(); document.body.classList.remove('locked'); pinBuf = ''; pinFails = 0;
  for (const id of ['app', 'sheet', 'sheetBackdrop', 'toast']) document.getElementById(id)?.removeAttribute('inert');
  if (pendingDeepLink) { history.replaceState(null, '', location.pathname + pendingDeepLink); pendingDeepLink = ''; handleDeepLink(); }
}
async function tryFaceId() {
  const cfg = lockCfg();
  if (!cfg?.cred) return;
  try {
    await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(cfg.cred), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
    unlock();
  } catch (e) { if (e.name !== 'NotAllowedError') toast('Face ID didn’t work — use your PIN'); }
}
async function pinKey(k) {
  if (Date.now() < pinBlockedUntil) { toast(`Too many tries — wait ${Math.ceil((pinBlockedUntil - Date.now()) / 1000)}s`); return; }
  pinBuf = k === 'del' ? pinBuf.slice(0, -1) : (pinBuf + k).slice(0, 4);
  document.querySelectorAll('.pin-dots i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
  if (pinBuf.length === 4) {
    const ok = (await sha(pinBuf)) === lockCfg()?.pin;
    if (ok) unlock();
    else {
      pinFails++; pinBuf = '';
      const dots = $('.pin-dots'); dots?.classList.remove('shake'); void dots?.offsetWidth; dots?.classList.add('shake');
      setTimeout(() => document.querySelectorAll('.pin-dots i').forEach((d) => d.classList.remove('on')), 300);
      if (pinFails >= 5) { pinBlockedUntil = Date.now() + 30000; pinFails = 0; }
    }
  }
}
document.addEventListener('visibilitychange', () => {
  const cfg = lockCfg();
  if (!cfg?.pin) return;
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt >= (cfg.after ?? 1) * 60000 && !$('#lock')) showLock();
});
function lockSettingsCard() {
  const cfg = lockCfg();
  return `<div class="section-title">Privacy lock</div><div class="card">
    ${cfg?.pin ? `<div class="kv"><span>🔒 Lock is on</span><span class="small muted">${cfg.cred ? 'Face ID + PIN' : 'PIN'}</span></div>
      <div class="field" style="margin-top:10px"><label for="lockAfter">Lock after leaving the app</label>
        <select id="lockAfter" data-change="lock-after">${[[0, 'Immediately'], [1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes']].map(([v, l]) => `<option value="${v}" ${(cfg.after ?? 1) == v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="btn-row" style="margin:0">${!cfg.cred && passkeySupported() ? '<button class="btn secondary" data-action="lock-add-faceid">Add Face ID</button>' : ''}<button class="btn danger" data-action="lock-off">Turn off</button></div>`
    : `<p class="small" style="margin:0 0 10px">Require Face ID or a 4-digit PIN to open the app on this phone. Keeps the budget and binder away from curious eyes.</p>
      <button class="btn block" data-action="lock-setup">Turn on lock</button>`}
  </div>`;
}
async function createPasskey() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'Gomez Family' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'gomez-family-' + DEVICE_ID.slice(0, 6), displayName: 'Gomez Family app' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    timeout: 60000,
  } });
  return b64u(cred.rawId);
}

/* =========================================================
   8 · Voice + spoken money for Magic Add
   ========================================================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const _parseMagic = parseMagic;
parseMagic = function (raw, kind) {
  let t = String(raw || '');
  t = t.replace(/(\d+(?:\.\d{1,2})?)\s*(dollars?|bucks)\b/gi, '$$$1');
  t = t.replace(/\$(\d+)\s+and\s+(\d{1,2})\s*cents?/gi, (m, a, b) => `$${a}.${b.padStart(2, '0')}`);
  return _parseMagic(t, kind);
};
let rec = null;
function toggleVoice() {
  const btn = $('#micBtn'), input = $('#sheetForm [name="q"]');
  if (!SR || !input) return;
  if (rec) { rec.stop(); return; }
  rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  btn?.classList.add('on');
  rec.onresult = (e) => {
    input.value = [...e.results].map((r) => r[0].transcript).join(' ');
    $('#magicPreview').innerHTML = magicPreview(parseMagic(input.value));
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed') toast('Allow microphone & speech recognition to use voice'); };
  rec.onend = () => { rec = null; $('#micBtn')?.classList.remove('on'); };
  rec.start();
}
const _openMagic = actions['magic-add'];
function openMagicWith(text) {
  _openMagic();
  const form = $('#sheetForm'), input = form?.querySelector('[name="q"]');
  if (!input) return;
  if (SR) {
    const wrap = document.createElement('div');
    wrap.className = 'mic-wrap';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    wrap.insertAdjacentHTML('beforeend', `<button type="button" id="micBtn" class="mic-btn" data-action="magic-voice" aria-label="Speak">🎙️</button>`);
    input.focus();
  }
  if (text) { input.value = text; $('#magicPreview').innerHTML = magicPreview(parseMagic(text)); }
}

/* =========================================================
   9 · Siri & Shortcuts deep links:  …/#add=<text>   (add &go to save without asking)
   ========================================================= */
function handleDeepLink() {
  const m = location.hash.match(/^#(go&)?add=([^&]*)(&go)?/);
  if (!m) return false;
  if ($('#lock')) { pendingDeepLink = location.hash; history.replaceState(null, '', location.pathname + '#home'); return true; } // finish after unlocking
  if (state.settings.kidMode && state.members.some((x) => x.id === state.settings.kidMode)) { history.replaceState(null, '', location.pathname + '#kid'); render(); return true; } // works even before kids.js loads
  let text; try { text = decodeURIComponent(m[2].replace(/\+/g, ' ')).trim(); } catch { text = m[2].replace(/\+/g, ' ').trim(); }
  history.replaceState(null, '', location.pathname + '#home');
  render();
  if (!text) { setTimeout(() => openMagicWith('')); return true; }
  if (m[1] || m[3]) {
    const r = parseMagic(text);
    if (r) { openMagicWith(text); setTimeout(() => submitSheet(), 50); return true; }
  }
  setTimeout(() => openMagicWith(text));
  return true;
}
function siriCard() {
  const base = location.origin + location.pathname;
  return `<div class="section-title">Siri & Shortcuts</div><div class="card small">
    <p style="margin:0 0 8px">Say <b>“Hey Siri, Gomez add”</b> and speak an expense, event or grocery item.</p>
    <ol style="margin:0 0 10px;padding-left:20px;line-height:1.7">
      <li>Open the <b>Shortcuts</b> app → <b>+</b> (new shortcut)</li>
      <li>Add <b>Ask for Input</b> → Text, prompt “What should I add?”</li>
      <li>Add <b>URL</b> → tap <b>Copy link</b> below, paste it, then add <b>Provided Input</b> at the end</li>
      <li>Add <b>Open URLs</b>. Name the shortcut <b>Gomez add</b></li>
    </ol>
    <div class="btn-row" style="margin:0"><button class="btn secondary" data-action="copy-siri" data-url="${esc(base)}#add=">Copy link (review first)</button><button class="btn secondary" data-action="copy-siri" data-url="${esc(base)}#go&add=">Copy link (add instantly)</button></div>
    <p class="muted" style="margin:10px 0 0">Shortcuts open the app in Safari, so sign in to <b>Family sync</b> in Safari once and everything lands in your shared data.</p>
  </div>`;
}

/* =========================================================
   10 · Customize Home
   ========================================================= */
const HOME_SECTIONS = [
  ['live', '👋 Live banners'], ['wrapped', '🎬 Monthly Wrapped'], ['quick', '✨ Magic Add & quick buttons'], ['insights', '💡 Heads-up cards'],
  ['countdowns', '⏳ Countdowns'], ['today', '📅 Today'], ['week', '🗓️ This week'], ['bills', '💳 Bills this week'], ['chores', '🧹 Chores to do'],
  ['birthdays', '🎂 Birthdays'], ['activity', '📰 Family activity'], ['upkeep', '🔧 Around the house'], ['projects', '🏡 Projects'], ['goals', '🎯 Savings goals'], ['more', '➕ More'],
];
function homeLayout() {
  const saved = Array.isArray(state.settings.homeLayout) ? state.settings.homeLayout.filter((x) => HOME_SECTIONS.some(([id]) => id === x.id)) : [];
  for (const [id] of HOME_SECTIONS) if (!saved.some((x) => x.id === id)) saved.push({ id, hidden: false });
  return saved;
}
const _homeView = views.home;
views.home = () => {
  const tpl = document.createElement('template');
  tpl.innerHTML = _homeView();
  const frag = tpl.content;
  const blocks = {};
  // (:scope doesn't match inside a template fragment, so walk the top-level children directly)
  for (const el of [...frag.children]) if (el.dataset.home) { blocks[el.dataset.home] = el; el.remove(); }
  const hero = [...frag.children].find((el) => el.classList.contains('hero'));
  const out = document.createDocumentFragment();
  for (const { id, hidden } of homeLayout()) if (blocks[id] && !hidden) out.appendChild(blocks[id]);
  if (hero) hero.after(out); else frag.prepend(out);
  return tpl.innerHTML + `<button class="customize-home" data-action="home-customize">⚙️ Customize Home</button>`;
};
let layoutDraft = null;
function layoutListHTML() {
  return layoutDraft.map((x, i) => {
    const label = HOME_SECTIONS.find(([id]) => id === x.id)[1];
    return `<div class="layout-row${x.hidden ? ' off' : ''}">
      <label class="layout-toggle"><input type="checkbox" data-action="home-toggle" data-i="${i}" ${x.hidden ? '' : 'checked'}><span>${esc(label)}</span></label>
      <button type="button" data-action="home-move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
      <button type="button" data-action="home-move" data-i="${i}" data-d="1" ${i === layoutDraft.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
    </div>`;
  }).join('');
}

/* =========================================================
   Settings additions, actions, hooks
   ========================================================= */
const _settingsView = views.settings;
views.settings = () => {
  const html = _settingsView();
  const me = state.members.length > 1 ? `<div class="section-title">This phone</div><div class="card">
    <div class="small muted" style="margin-bottom:8px">Who uses this phone? Used for the activity feed and your greeting.</div>
    <div class="whoami-row">${state.members.map((m) => `<button class="${meId() === m.id ? 'on' : ''}" data-action="set-me" data-id="${m.id}">${avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}</div>
    <button class="btn secondary block" style="margin-top:12px" data-action="home-customize">🧩 Customize Home</button></div>` : '';
  const i = html.indexOf('<div class="section-title">Preferences</div>');
  const extra = me + lockSettingsCard();
  const j = html.indexOf('<div class="section-title">Add to iPhone home screen</div>');
  let out = i < 0 ? html + extra : html.slice(0, i) + extra + html.slice(i);
  const k = out.indexOf('<div class="section-title">Add to iPhone home screen</div>');
  if (k >= 0) out = out.slice(0, k) + siriCard() + out.slice(k);
  void j;
  return out;
};

const _go = actions.go;
Object.assign(actions, {
  'go': (el) => { if (el.dataset.ctab) ui.choreTab = el.dataset.ctab; if (el.dataset.to?.startsWith('wrapped')) ui.storyIdx = 0; _go(el); },
  'set-me': (el) => { state.settings.me = el.dataset.id; save(); render(); toast(`👋 Hi ${member(el.dataset.id).name}!`); },
  'fc-day': (el) => { ui.fcSel = Number(el.dataset.i); render(); },
  'chore-tab': (el) => { ui.choreTab = el.dataset.tab; render(); },
  'reward-new': () => rewardForm(null),
  'reward-starters': () => { for (const [emoji, name, cost] of STARTER_REWARDS) state.rewards.push({ id: uid(), emoji, name, cost }); save(); render(); toast('Added 6 starter rewards — edit them anytime'); },
  'reward-redeem': (el) => {
    const r = findIn(state.rewards, el.dataset.id);
    const me = meId();
    const who = (state.members.some((m) => m.kid) ? state.members.filter((m) => m.kid) : state.members).filter((m) => rewardFor(r, m.id));
    const can = (id) => pointsBalance(id) >= rewardCost(r, id);
    openSheet({
      title: `${r.emoji || '🎁'} ${r.name}`,
      saveLabel: 'Redeem',
      values: { memberId: me && who.some((m) => m.id === me) && can(me) ? me : (who.find((m) => can(m.id))?.id || who[0]?.id) },
      fields: [
        ...(who.length ? [{ name: 'memberId', label: 'Who’s using it?', type: 'select', options: who.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name} — has ⭐ ${pointsBalance(m.id)}, costs ⭐ ${rewardCost(r, m.id)}` })) }] : []),
        { type: 'html', html: '<p class="small muted" style="margin:0 4px">A grown-up approves it on the Rewards tab.</p><div class="btn-row"><button type="button" class="btn secondary" data-action="reward-edit" data-id="' + r.id + '">Edit reward</button></div>' },
      ],
      onSave(v) {
        if (!v.memberId) return false;
        const cost = rewardCost(r, v.memberId);
        if (pointsBalance(v.memberId) < cost) { toast(`Not enough stars yet — ${cost - pointsBalance(v.memberId)} to go!`); return false; }
        (state.redemptions ||= []).push({ id: uid(), rewardId: r.id, memberId: v.memberId, cost, at: Date.now(), status: 'pending' });
        toast('🎟️ Request sent for approval');
      },
    });
  },
  'chore-starters': (el) => starterChoresSheet(el.dataset.id),
  'reward-edit': (el) => { closeSheet(); rewardForm(findIn(state.rewards, el.dataset.id)); },
  'reward-approve': (el) => { const r = findIn(state.redemptions, el.dataset.id); r.status = 'approved'; r.decided = Date.now(); save(); render(); confetti(); toast('🏆 Approved — enjoy!'); },
  'reward-deny': (el) => { const r = findIn(state.redemptions, el.dataset.id); r.status = 'denied'; r.decided = Date.now(); save(); render(); toast('Stars returned'); },
  'plan-week': planMyWeek,
  'story-next': (el) => { const n = Number(el.dataset.n); if ((ui.storyIdx || 0) >= n - 1) { actions['story-close'](); return; } ui.storyIdx = (ui.storyIdx || 0) + 1; render(); },
  'story-prev': () => { ui.storyIdx = Math.max(0, (ui.storyIdx || 0) - 1); render(); },
  'story-close': () => { clearTimeout(storyTimer); ui.storyIdx = 0; if (history.length > 1) history.back(); else go('home'); },
  'wrapped-share': (el) => shareWrapped(el.dataset.ym),
  'magic-add': () => openMagicWith(''),
  'magic-voice': toggleVoice,
  'copy-siri': (el) => navigator.clipboard?.writeText(el.dataset.url).then(() => toast('Link copied — paste it into Shortcuts'), () => toast(el.dataset.url)),
  'home-customize': () => {
    layoutDraft = homeLayout().map((x) => ({ ...x }));
    openSheet({
      title: 'Customize Home',
      saveLabel: 'Done',
      values: {},
      fields: [{ type: 'html', html: `<p class="small muted" style="margin:0 4px 10px">Show, hide and reorder what’s on your Home screen. Only changes this phone.</p><div id="layoutList" class="layout-list">${layoutListHTML()}</div><button type="button" class="mini-btn" data-action="home-reset">Reset to default</button>` }],
      onSave() { state.settings.homeLayout = layoutDraft; layoutDraft = null; },
    });
  },
  'home-move': (el) => {
    const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= layoutDraft.length) return;
    [layoutDraft[i], layoutDraft[j]] = [layoutDraft[j], layoutDraft[i]];
    $('#layoutList').innerHTML = layoutListHTML();
  },
  'home-reset': () => { layoutDraft = HOME_SECTIONS.map(([id]) => ({ id, hidden: false })); $('#layoutList').innerHTML = layoutListHTML(); },
  'lock-setup': () => openSheet({
    title: 'Privacy lock',
    saveLabel: 'Turn on',
    values: { faceid: passkeySupported() },
    fields: [
      { name: 'pin', label: 'Choose a 4-digit PIN', type: 'password', required: true },
      { name: 'pin2', label: 'Repeat PIN', type: 'password', required: true },
      ...(passkeySupported() ? [{ name: 'faceid', label: 'Also unlock with Face ID', type: 'checkbox', hint: 'Uses a passkey saved on this iPhone' }] : []),
    ],
    onSave(v) {
      if (!/^\d{4}$/.test(v.pin)) { toast('PIN must be 4 digits'); return false; }
      if (v.pin !== v.pin2) { toast('PINs don’t match'); return false; }
      const finish = async (cred) => {
        localStorage.setItem(LOCK_KEY, JSON.stringify({ pin: await sha(v.pin), cred: cred || null, after: 1 }));
        render(); toast(cred ? '🔒 Lock on — Face ID + PIN' : '🔒 Lock on');
      };
      // Start the passkey prompt inside the tap so iOS allows it.
      if (v.faceid) createPasskey().then(finish, () => { toast('Face ID wasn’t set up — PIN only for now'); finish(null); });
      else finish(null);
    },
  }),
  'lock-add-faceid': () => createPasskey().then((cred) => { const c = lockCfg(); c.cred = cred; localStorage.setItem(LOCK_KEY, JSON.stringify(c)); render(); toast('Face ID added'); }, () => toast('Face ID wasn’t set up')),
  'lock-off': () => { if (!confirm('Turn off the privacy lock on this phone?')) return; localStorage.removeItem(LOCK_KEY); render(); toast('Lock turned off'); },
  'lock-faceid': tryFaceId,
  'pin-key': (el) => pinKey(el.dataset.k),
});
// Keyboard input for the lock's PIN pad and toggles inside the layout sheet
document.addEventListener('keydown', (e) => { if ($('#lock') && /^[0-9]$|^Backspace$/.test(e.key)) pinKey(e.key === 'Backspace' ? 'del' : e.key); });
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.action === 'home-toggle' && layoutDraft) { layoutDraft[Number(el.dataset.i)].hidden = !el.checked; el.closest('.layout-row').classList.toggle('off', !el.checked); }
  if (el.dataset?.change === 'lock-after') { const c = lockCfg(); c.after = Number(el.value); localStorage.setItem(LOCK_KEY, JSON.stringify(c)); }
});

// Route-change hooks
const _afterRender2 = afterRender;
afterRender = function () {
  _afterRender2();
  const name = currentRoute().name;
  document.body.classList.toggle('wrapped-mode', name === 'wrapped');
  syncPresence();
  storyTick();
};

/* ---------- Month review (days 1–5): biggest over/under categories + subscriptions to check ---------- */
const reviewYm = (t = today()) => (parse(t).getDate() <= 5 ? addMonths(monthKey(t), -1) : null);
function monthReviewItems(ym) {
  const cats = state.budget.categories.filter((c) => c.limit).map((c) => { const spent = spentIn(ym, c.id), lim = catLimit(c, ym); return { c, spent, lim, diff: spent - lim }; })
    .filter((x) => Math.abs(x.diff) >= 1).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);
  const subs = typeof isSub === 'function' ? state.budget.bills.filter((b) => isSub(b) && !b.review) : [];
  return { cats, subs };
}
function monthReviewBody(ym) {
  const { cats, subs } = monthReviewItems(ym), done = (ui.reviewDone ||= {});
  const mName = parse(ym + '-01').toLocaleDateString(undefined, { month: 'long' });
  const catRows = cats.filter((x) => !done[x.c.id]).map((x) => {
    const over = x.diff > 0, to = over ? Math.ceil(x.spent / 10) * 10 : Math.max(10, Math.ceil(x.spent / 10) * 10);
    return `<div class="row"><div class="avatar">${esc(x.c.emoji)}</div><div class="grow"><div class="title">${esc(x.c.name)}</div>
      <div class="sub" style="color:${over ? 'var(--bad)' : 'var(--good)'}">${moneyW(Math.abs(x.diff))} ${over ? 'over' : 'under'} · ${moneyW(x.spent)} of ${moneyW(x.lim)}</div>
      <div class="btn-row" style="margin:6px 0 0"><button type="button" class="mini-btn" data-action="review-limit" data-id="${x.c.id}" data-v="${to}">${over ? 'Raise' : 'Lower'} limit to ${moneyW(to)}</button><button type="button" class="mini-btn" data-action="review-keep" data-id="${x.c.id}">Keep ${moneyW(x.c.limit)}</button></div></div></div>`;
  }).join('');
  const subRows = subs.map((b) => `<div class="row">${letterAvatar(b.name)}<div class="grow"><div class="title">${esc(b.name)}</div><div class="sub">${money(b.amount)} · ${moneyW(perMonth(b) * 12)}/yr</div></div>
    <button type="button" class="mini-btn" data-action="review-sub" data-id="${b.id}" data-v="keep">👍 Keep</button><button type="button" class="mini-btn" data-action="review-sub" data-id="${b.id}" data-v="cancel">✂️ Cancel</button></div>`).join('');
  return `${catRows ? `<div class="section-title" style="margin-top:0">${esc(mName)} budget</div><div class="card flush">${catRows}</div>` : `<p class="small muted">✅ Budget limits all set.</p>`}
    ${subRows ? `<div class="section-title">Subscriptions not reviewed</div><div class="card flush">${subRows}</div>` : ''}`;
}
function monthReviewSheet(ym) {
  ui.reviewDone = {};
  openSheet({
    title: `Review ${parse(ym + '-01').toLocaleDateString(undefined, { month: 'long' })}`, saveLabel: 'Done reviewing', values: {}, reviewYm: ym,
    fields: [{ type: 'html', html: `<div id="reviewBody">${monthReviewBody(ym)}</div>` }],
    onSave() { (state.budget.reviewed ||= {})[ym] = true; toast('Month reviewed ✓'); },
  });
}
const reviewRefresh = () => { const ym = sheetCfg?.reviewYm; if (ym) { save(); $('#reviewBody').innerHTML = monthReviewBody(ym); } };
Object.assign(actions, {
  'month-review': (el) => monthReviewSheet(el.dataset.ym),
  'review-limit': (el) => { const c = findIn(state.budget.categories, el.dataset.id); if (c) { c.limit = Number(el.dataset.v); ui.reviewDone[c.id] = 1; toast(`${c.name}: ${moneyW(c.limit)}/month`); } reviewRefresh(); },
  'review-keep': (el) => { ui.reviewDone[el.dataset.id] = 1; reviewRefresh(); },
  'review-sub': (el) => { const b = findIn(state.budget.bills, el.dataset.id); if (b) b.review = el.dataset.v; reviewRefresh(); },
});

// Heads-up when the forecast dips low.
const _homeInsights = homeInsights;
homeInsights = function () {
  let html = _homeInsights();
  const rym = reviewYm();
  if (rym && !state.budget.reviewed?.[rym] && state.budget.transactions.some((x) => x.date.startsWith(rym))) {
    const { cats, subs } = monthReviewItems(rym);
    if (cats.length || subs.length) {
      const c = `<button class="insight" data-action="month-review" data-ym="${rym}"><span class="ii">🗓️</span><b>Review ${esc(parse(rym + '-01').toLocaleDateString(undefined, { month: 'long' }))}</b><small>${[cats.length ? `${cats.length} budget${cats.length > 1 ? 's' : ''} to adjust` : '', subs.length ? `${subs.length} subscription${subs.length > 1 ? 's' : ''} to check` : ''].filter(Boolean).join(' · ')}</small></button>`;
      html = html ? html.replace('<div class="insights">', '<div class="insights">' + c) : `<div class="insights">${c}</div>`;
    }
  }
  const s = safeToSpend();
  if (s) {
    const c = `<button class="insight ${s.safe < 0 ? 'bad' : s.stale > 7 ? 'warn' : 'good'}" data-action="${s.stale > 7 ? 'edit-balance' : 'go'}" data-to="budget" data-btab="overview"><span class="ii">💳</span><b>${money(s.safe, { maximumFractionDigits: 0 })} safe to spend</b><small>${s.stale > 7 ? `Balance is ${s.stale} days old — tap to update` : `until payday ${dueLabel(s.pay.date)} · about ${money(Math.max(0, s.perDay), { maximumFractionDigits: 0 })}/day`}</small></button>`;
    html = html ? html.replace('<div class="insights">', '<div class="insights">' + c) : `<div class="insights">${c}</div>`;
  }
  const pts = forecastSeries();
  if (!pts) return html;
  const low = pts.reduce((a, b) => (b.v < a.v ? b : a));
  if (low.v >= 250) return html;
  const card = `<button class="insight ${low.v < 0 ? 'bad' : 'warn'}" data-action="go" data-to="budget" data-btab="bills"><span class="ii">📉</span><b>Balance may dip to ${money(low.v, { maximumFractionDigits: 0 })}</b><small>around ${fmtDate(low.d, { weekday: 'short', month: 'short', day: 'numeric' })} · see the forecast</small></button>`;
  return html ? html.replace('<div class="insights">', '<div class="insights">' + card) : `<div class="insights">${card}</div>`;
};

/* ---------- Boot ---------- */
// Siri/Shortcut links also arrive while the app is already open.
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#add=')) handleDeepLink(); });
if (lockCfg()?.pin) showLock();
handleDeepLink(); // sync.js draws the first screen
