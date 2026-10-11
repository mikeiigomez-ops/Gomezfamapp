/* Gems 💎: the play currency for Squishies (and later Runway & Dream House).
   Earned automatically from chores, on-time routines, bonus ⭐ from high-fives, Family Word wins and check-ins
   (with a daily cap), plus allowance → Gems exchanges a grown-up approves. Spent in the Squishy shop & boxes.
   Points/⭐ for real-world rewards are unchanged; Gems are separate so play never eats into treats. */
'use strict';

Object.assign(TITLES, { gems: 'Gems' });
const GEM = '💎';
const GEM_DEFAULTS = { perPoint: 2, routine: 3, word: 3, checkin: 1, kudos: 1, dailyCap: 40, streak: 1, sqEvery: 100, sqDaily: 3, welcome: 25, rate: 10, exchange: true, approve: true, maxExchange: 5 };
const gemsCfg = () => ({ ...GEM_DEFAULTS, ...(state.gems.cfg || {}) });
// Earning starts the first day Gems exist on this family's data (no surprise windfall for past chores).
const gemsStart = () => (state.gems.start ||= today());

function gemDayEarnings(id) {
  const cfg = gemsCfg(), start = gemsStart(), days = {};
  const add = (d, n, what) => { if (!d || d < start || !n) return; const x = (days[d] ||= { n: 0, items: [] }); x.n += n; x.items.push([what, n]); };
  for (const c of state.chores) for (const l of c.log || []) if (l.memberId === id) add(l.date, (Number(c.points) || 1) * cfg.perPoint, c.title);
  for (const r of state.routines) if (r.memberId === id) for (const [d, on] of Object.entries(r.stars || {})) if (on) add(d, cfg.routine, `${r.name} on time`);
  for (const k of state.kudos || []) if (k.to === id && k.stars) add(iso(new Date(k.at)), k.stars * cfg.kudos, `High-five from ${whoName(k.from)}`);
  for (const [d, xs] of Object.entries(state.wordle || {})) if (xs[id]?.won) add(d, cfg.word, 'Family Word solved');
  for (const [d, xs] of Object.entries(state.checkins || {})) if (xs[id]) add(d, cfg.checkin, 'Daily check-in');
  for (const x of Object.values(days)) x.capped = Math.min(x.n, cfg.dailyCap);
  // Chore streak bonus, on top of the daily max: day 2 of a streak = +2, day 3 = +3 … up to +5.
  if (cfg.streak) {
    const choreDays = [...new Set(state.chores.flatMap((c) => (c.log || []).filter((l) => l.memberId === id).map((l) => l.date)))].filter((d) => d && d >= start).sort();
    let run = 0, prev = '';
    for (const d of choreDays) {
      const y = parse(d); y.setDate(y.getDate() - 1);
      run = prev === iso(y) ? run + 1 : 1; prev = d;
      if (run >= 2) { const b = Math.min(5, run) * cfg.streak, x = days[d]; x.capped += b; x.items.push([`🔥 ${run}-day chore streak`, b]); }
    }
  }
  return days;
}
const gemsEarned = (id) => sum(Object.values(gemDayEarnings(id)), (x) => x.capped);
const gemsLogged = (id) => sum(state.gems.log.filter((l) => l.who === id), (l) => Number(l.n) || 0);
// The welcome bonus is granted the first time anyone looks at a balance, so every screen shows the same number.
const gemBalance = (id) => { if (!id) return 0; if (isMember(id) && gemsCfg().welcome && !state.gems.log.some((l) => l.key === 'welcome' && l.who === id)) { gemLog(id, gemsCfg().welcome, 'Welcome bonus 🎉', 'bonus', 'welcome'); save(); } return Math.max(0, gemsEarned(id) + gemsLogged(id)); };
const gemsToday = (id) => gemDayEarnings(id)[today()] || { n: 0, capped: 0, items: [] };
function gemLog(who, n, note, kind = 'misc', key = '') {
  if (key && state.gems.log.some((l) => l.key === key && l.who === who)) return false;
  state.gems.log.push({ id: uid(), who, n, note, kind, at: Date.now(), ...(key ? { key } : {}) });
  return true;
}
function spendGems(who, n, note, kind = 'spend') {
  if (gemBalance(who) < n) { toast(`You need ${n - gemBalance(who)} more ${GEM}`); return false; }
  gemLog(who, -n, note, kind);
  return true;
}
// Everyone gets a welcome bonus the first time they open their wallet.
function gemWelcome(id) { if (id && gemsCfg().welcome && gemLog(id, gemsCfg().welcome, 'Welcome bonus 🎉', 'bonus', 'welcome')) save(); }
const gemChip = (n, cls = '') => `<span class="gem-chip ${cls}">${GEM} ${Number(n).toLocaleString()}</span>`;

/* ---------- Allowance → Gems ---------- */
const canExchange = (id) => gemsCfg().exchange && (typeof moneyMode !== 'function' || moneyMode(id) !== 'none') && state.members.find((m) => m.id === id)?.kid;
const spendable = (id) => (typeof jarTotal === 'function' ? jarTotal(id, 'spend') : 0);
function exchangeSheet(id) {
  const cfg = gemsCfg(), have = spendable(id);
  if (have < 1) { toast(`No spending money in the piggy bank yet 🐷`); return; }
  const max = Math.min(cfg.maxExchange, Math.floor(have));
  openSheet({
    title: `🐷 → ${GEM} Trade money for Gems`,
    saveLabel: cfg.approve && kidHere() ? 'Ask a grown-up' : 'Trade',
    values: { dollars: String(Math.min(1, max)) },
    fields: [
      { type: 'html', html: `<div class="xchg"><div><b>$1</b><span>from your piggy</span></div><span class="xchg-arrow">→</span><div><b>${cfg.rate} ${GEM}</b><span>Gems</span></div></div><p class="small muted" style="margin:0 4px 10px">You have ${money(have)} to spend. Up to $${max} at a time.</p>` },
      { name: 'dollars', label: 'How many dollars?', type: 'select', options: [...Array(max)].map((_, i) => ({ value: String(i + 1), label: `$${i + 1} → ${(i + 1) * cfg.rate} ${GEM}` })) },
    ],
    onSave(v) {
      const dollars = Number(v.dollars);
      const req = { id: uid(), who: id, dollars, gems: dollars * cfg.rate, at: Date.now(), status: 'pending', by: actor() };
      if (cfg.approve && kidHere()) {
        state.gems.requests.push(req);
        logAct(GEM, `asked to trade $${dollars} for ${req.gems} Gems`, 'gems');
        toast('🙌 Asked! A grown-up will say OK soon');
      } else if (!approveExchange(req)) return false;
    },
  });
}
function approveExchange(req) {
  if (spendable(req.who) < req.dollars) { toast(`Only ${money(spendable(req.who))} in the piggy`); return false; }
  piggyOf(req.who).log.push({ id: uid(), date: today(), jar: 'spend', amount: -req.dollars, note: `Traded for ${req.gems} ${GEM}` });
  gemLog(req.who, req.gems, `Traded $${req.dollars} from the piggy`, 'exchange');
  req.status = 'approved'; req.doneAt = Date.now();
  if (!state.gems.requests.includes(req)) state.gems.requests.push(req);
  toast(`${GEM} +${req.gems} for ${whoName(req.who)}`);
  return true;
}

/* ---------- Views ---------- */
function gemsWallet(id, mine) {
  const m = member(id), cfg = gemsCfg(), td = gemsToday(id);
  const hist = [
    ...state.gems.log.filter((l) => l.who === id).map((l) => ({ at: l.at, n: l.n, note: l.note })),
    ...Object.entries(gemDayEarnings(id)).map(([d, x]) => ({ at: parse(d).getTime() + 43200000, n: x.capped, note: x.items.length === 1 ? x.items[0][0] : `${x.items.length} things earned${x.n > x.capped ? ' (daily max)' : ''}`, d })),
  ].sort((a, b) => b.at - a.at).slice(0, 25);
  const pend = state.gems.requests.filter((r) => r.who === id && r.status === 'pending');
  return `<section class="gem-hero" style="--c:${m.color}">
      <div class="gem-orb">${GEM}</div>
      <div class="gem-bal">${gemBalance(id).toLocaleString()}</div>
      <div class="gem-sub">${mine ? 'My Gems' : `${esc(m.name)}’s Gems`}</div>
      <div class="gem-today"><span>Today</span><div class="bar"><i style="width:${Math.min(100, (td.capped / cfg.dailyCap) * 100)}%"></i></div><span>${Math.min(td.capped, cfg.dailyCap)}/${cfg.dailyCap}</span></div>
      <div class="gem-actions">
        <button data-action="go" data-to="squishies"><span>🧸</span>Squishies</button>
        ${canExchange(id) && mine ? `<button data-action="gem-exchange" data-id="${id}"><span>🐷</span>Trade $</button>` : ''}
        ${!kidHere() ? `<button data-action="gem-give" data-id="${id}"><span>🎁</span>Give</button>` : ''}
      </div>
    </section>
    ${pend.map((r) => `<div class="card small">⏳ Waiting for a grown-up: $${r.dollars} → ${r.gems} ${GEM}</div>`).join('')}
    <div class="section-title">How to earn</div>
    <div class="card earn-list">
      <div><span>🧹</span>Each chore point<b>+${cfg.perPoint}</b></div>
      ${cfg.routine ? `<div><span>🌅</span>Routine done on time<b>+${cfg.routine}</b></div>` : ''}
      ${cfg.kudos ? `<div><span>🙌</span>Each bonus ⭐ in a high-five<b>+${cfg.kudos}</b></div>` : ''}
      ${cfg.word ? `<div><span>🔤</span>Solve the Family Word<b>+${cfg.word}</b></div>` : ''}
      ${cfg.checkin ? `<div><span>😊</span>Daily check-in<b>+${cfg.checkin}</b></div>` : ''}
      ${canExchange(id) ? `<div><span>🐷</span>$1 from the piggy bank<b>+${cfg.rate}</b></div>` : ''}
      <div class="small muted" style="padding-top:6px">Up to ${cfg.dailyCap} ${GEM} a day from chores & activities.</div>
    </div>
    <div class="section-title">History</div>
    <div class="card flush">${hist.map((h) => `<div class="row"><div class="avatar">${h.n >= 0 ? GEM : '🛍️'}</div><div class="grow"><div class="title">${esc(h.note)}</div><div class="sub">${h.d ? fmtDate(h.d, { weekday: 'short', month: 'short', day: 'numeric' }) : timeAgo(h.at)}</div></div><span class="amount ${h.n >= 0 ? 'income' : ''}">${h.n >= 0 ? '+' : '−'}${Math.abs(h.n)}</span></div>`).join('') || '<div class="empty small">Do a chore to earn your first Gems!</div>'}</div>`;
}
views.gems = (pid) => {
  const me = actor();
  const id = kidHere() ? kidModeId() : (pid && isMember(pid) ? pid : me || kids()[0]?.id || state.members[0]?.id);
  if (!id) return '<div class="card empty">Add family members first.</div>';
  gemWelcome(id);
  const pend = state.gems.requests.filter((r) => r.status === 'pending');
  return `${!kidHere() ? `<div class="segmented gem-who">${state.members.map((m) => `<button class="${m.id === id ? 'active' : ''}" data-action="go" data-to="gems/${m.id}">${esc(m.emoji)} ${gemBalance(m.id)}</button>`).join('')}</div>` : ''}
    ${!kidHere() && pend.length ? `<div class="section-title">Needs your OK</div><div class="card flush">${pend.map(exchangeRow).join('')}</div>` : ''}
    ${gemsWallet(id, id === me || kidHere())}
    ${!kidHere() ? `<button class="btn secondary block" style="margin-top:14px" data-action="gem-rules">⚙️ Gem rules</button>` : ''}`;
};
const exchangeRow = (r) => `<div class="row">${avatar(member(r.who), true)}<div class="grow"><div class="title">${esc(whoName(r.who))}: $${r.dollars} → ${r.gems} ${GEM}</div><div class="sub">From the piggy bank · ${timeAgo(r.at)}</div></div><button class="mini-btn" style="color:var(--bad)" data-action="gem-deny" data-id="${r.id}">No</button><button class="btn" style="padding:8px 14px" data-action="gem-approve" data-id="${r.id}">OK</button></div>`;

function gemRulesSheet() {
  const c = gemsCfg();
  openSheet({
    title: `⚙️ Gem rules`,
    values: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'boolean' ? v : String(v)])),
    fields: [
      { type: 'html', html: '<p class="small muted" style="margin:0 4px 10px">Gems are only for in-app play (Squishies and more). Chore points & ⭐ for real rewards don’t change.</p>' },
      { row: [{ name: 'perPoint', label: '💎 per chore point', type: 'number' }, { name: 'dailyCap', label: 'Daily max', type: 'number' }] },
      { row: [{ name: 'routine', label: 'On-time routine', type: 'number' }, { name: 'kudos', label: 'Per bonus ⭐', type: 'number' }] },
      { row: [{ name: 'word', label: 'Family Word win', type: 'number' }, { name: 'checkin', label: 'Check-in', type: 'number' }] },
      { name: 'streak', label: '🔥 Chore streak bonus (× day, max 5)', type: 'number', hint: '1 = day 2 of a streak earns +2, day 5+ earns +5. Not counted toward the daily max. 0 turns it off.' },
      { row: [{ name: 'sqEvery', label: '🤏 Squishes per free box', type: 'number' }, { name: 'sqDaily', label: 'Max boxes a day', type: 'number' }] },
      { name: 'exchange', label: '🐷 Kids can trade allowance for Gems', type: 'checkbox' },
      { row: [{ name: 'rate', label: '💎 per $1', type: 'number' }, { name: 'maxExchange', label: 'Max $ per trade', type: 'number' }] },
      { name: 'approve', label: 'A grown-up must OK each trade', type: 'checkbox', hint: 'Requests show in your 🔔 inbox' },
    ],
    onSave(v) {
      const n = (k) => Math.max(0, Number(v[k]) || 0);
      state.gems.cfg = { perPoint: n('perPoint'), dailyCap: n('dailyCap') || 1, routine: n('routine'), kudos: n('kudos'), word: n('word'), checkin: n('checkin'), streak: n('streak'), sqEvery: n('sqEvery'), sqDaily: n('sqDaily'), welcome: c.welcome, exchange: v.exchange, rate: n('rate') || 1, maxExchange: n('maxExchange') || 1, approve: v.approve };
      toast(`${GEM} Gem rules saved`);
    },
  });
}
function giveGemsSheet(id) {
  openSheet({
    title: `🎁 Gems for ${whoName(id)}`,
    saveLabel: 'Give',
    values: { n: '10', note: '' },
    fields: [
      { name: 'n', label: 'Gems (use − to take away)', type: 'number', required: true },
      { name: 'note', label: 'Why?', placeholder: 'e.g. Great report card! 📚' },
    ],
    onSave(v) {
      const n = Math.round(Number(v.n) || 0);
      if (!n) return false;
      gemLog(id, n, v.note || (n > 0 ? 'Gift from a grown-up' : 'Taken away by a grown-up'), 'grant');
      if (n > 0) logAct(GEM, `gave ${whoName(id)} ${n} Gems${v.note ? ` · ${v.note}` : ''}`, 'gems');
      toast(`${GEM} ${n > 0 ? '+' : ''}${n} for ${whoName(id)}`);
    },
  });
}

/* ---------- Wiring ---------- */
KID_ROUTES.push('gems');
for (const a of ['gem-exchange']) KID_ACTIONS.add(a);
Object.assign(actions, {
  'gem-exchange': (el) => exchangeSheet(kidHere() ? kidModeId() : el.dataset.id),
  'gem-approve': (el) => { const r = findIn(state.gems.requests, el.dataset.id); if (r.status === 'pending' && approveExchange(r)) { save(); render(); } },
  'gem-deny': (el) => { const r = findIn(state.gems.requests, el.dataset.id); r.status = 'denied'; save(); render(); },
  'gem-rules': () => gemRulesSheet(),
  'gem-give': (el) => giveGemsSheet(el.dataset.id),
});
const _inboxItemsG = inboxItems;
inboxItems = function () {
  const items = _inboxItemsG();
  if (isGrownUp()) for (const r of state.gems.requests.filter((r) => r.status === 'pending')) items.unshift({ n: 1, icon: '🐷', title: `${whoName(r.who)} wants to trade $${r.dollars} for ${r.gems} ${GEM}`, sub: 'Tap to OK it', to: 'gems' });
  return items;
};
