/* Things to do + "Cut back → enjoy".
   Ideas come from three places: real upcoming events near home (Ticketmaster, through the family's relay,
   refreshed twice a day), a built-in list of Detroit-area favorites with typical family costs, and the
   family's own ideas. Costs are worked out for this family (grown-ups and kids). The Budget card finds the
   everyday categories running over, proposes realistic cut-backs, and lists what that money could pay for.
   All plain arithmetic. Loaded after notify.js. */
'use strict';

const FUN_CATS = [['all', 'All', '✨'], ['sports', 'Sports', '🏟️'], ['activity', 'Activities', '🎳'], ['dinner', 'Dinner', '🍽️'], ['movies', 'Movies', '🎬'], ['shows', 'Shows & music', '🎭'], ['outdoors', 'Outdoors', '🌳'], ['free', 'Free', '🆓']];
// Typical prices (estimates, per adult a / per kid k / flat f, in dollars); months = when it's on
const FUN_ANY = null, funM = (...m) => m;
const FUN_FAVES = [
  ['zoo', '🦁', 'Detroit Zoo', 'activity', 24, 20, 0, FUN_ANY, 'Royal Oak'],
  ['dia', '🎨', 'Detroit Institute of Arts', 'activity', 0, 0, 0, FUN_ANY, 'Free for Wayne County residents'],
  ['henryford', '🚂', 'The Henry Ford Museum', 'activity', 30, 23, 0, FUN_ANY, 'Dearborn'],
  ['village', '🏘️', 'Greenfield Village', 'activity', 35, 26, 0, funM(4, 5, 6, 7, 8, 9, 10, 12), 'Dearborn · Holiday Nights in December'],
  ['mischi', '🔬', 'Michigan Science Center', 'activity', 25, 20, 0, FUN_ANY, 'Detroit'],
  ['bowling', '🎳', 'Bowling night', 'activity', 15, 15, 0, FUN_ANY, 'Spins Bowl, Taylor'],
  ['trampoline', '🤸', 'Trampoline park', 'activity', 22, 22, 0, FUN_ANY, 'Sky Zone and similar'],
  ['escape', '🔐', 'Escape room', 'activity', 32, 32, 0, FUN_ANY, 'Best with kids 8+'],
  ['climb', '🧗', 'Indoor climbing', 'activity', 25, 20, 0, FUN_ANY, ''],
  ['arcade', '🕹️', 'Arcade night', 'activity', 0, 0, 60, FUN_ANY, "Dave & Buster's and similar"],
  ['pottery', '🖌️', 'Paint-your-own pottery', 'activity', 30, 25, 0, FUN_ANY, ''],
  ['topgolf', '⛳', 'Topgolf bay (1 hour)', 'sports', 0, 0, 60, FUN_ANY, 'Auburn Hills'],
  ['wings', '🏒', 'Red Wings game', 'sports', 45, 45, 0, funM(10, 11, 12, 1, 2, 3, 4), 'Little Caesars Arena · upper bowl'],
  ['pistons', '🏀', 'Pistons game', 'sports', 30, 30, 0, funM(10, 11, 12, 1, 2, 3, 4), 'Little Caesars Arena · upper bowl'],
  ['tigers', '⚾', 'Tigers game', 'sports', 25, 25, 0, funM(4, 5, 6, 7, 8, 9), 'Comerica Park'],
  ['lions', '🏈', 'Lions game', 'sports', 120, 120, 0, funM(9, 10, 11, 12, 1), 'Ford Field'],
  ['dcfc', '⚽', 'Detroit City FC match', 'sports', 25, 15, 0, funM(4, 5, 6, 7, 8, 9, 10), 'Keyworth Stadium, Hamtramck'],
  ['movie', '🎬', 'Movie night out', 'movies', 14, 11, 25, FUN_ANY, 'Cinemark Taylor · with snacks'],
  ['moviein', '🍿', 'Movie night in', 'movies', 0, 0, 15, FUN_ANY, 'Rent a new release + popcorn'],
  ['fox', '🎭', 'A show at the Fox or Fisher', 'shows', 60, 60, 0, FUN_ANY, 'Detroit'],
  ['buddys', '🍕', "Buddy's Pizza night", 'dinner', 0, 0, 55, FUN_ANY, 'Detroit-style pizza'],
  ['kura', '🍣', 'Kura Revolving Sushi', 'dinner', 28, 15, 0, FUN_ANY, 'The kids love the conveyor belt'],
  ['hibachi', '🔥', 'Hibachi dinner', 'dinner', 32, 20, 0, FUN_ANY, 'Dinner and a show'],
  ['mexicantown', '🌮', 'Mexicantown dinner', 'dinner', 18, 10, 0, FUN_ANY, 'Southwest Detroit'],
  ['coney', '🌭', 'Coney Island night', 'dinner', 12, 9, 0, FUN_ANY, 'Lafayette or American Coney'],
  ['brunch', '🥞', 'Family brunch', 'dinner', 20, 12, 0, FUN_ANY, ''],
  ['icecream', '🍦', 'Ice cream outing', 'dinner', 0, 0, 20, funM(4, 5, 6, 7, 8, 9, 10), ''],
  ['belleisle', '🏝️', 'Belle Isle day', 'outdoors', 0, 0, 15, FUN_ANY, 'Aquarium & conservatory are free · park pass'],
  ['riverwalk', '🌊', 'RiverWalk + Campus Martius', 'outdoors', 0, 0, 20, FUN_ANY, 'Free · snacks'],
  ['skate', '⛸️', 'Ice skating at Campus Martius', 'outdoors', 13, 13, 0, funM(11, 12, 1, 2), 'Plus skate rental'],
  ['lights', '🎄', 'Wayne County Lightfest drive', 'outdoors', 0, 0, 0, funM(11, 12), 'Hines Park · donation'],
  ['cidermill', '🍎', 'Cider mill & donuts', 'outdoors', 0, 0, 35, funM(9, 10, 11), 'Yates or Franklin'],
  ['pumpkin', '🎃', 'Pumpkin patch & corn maze', 'outdoors', 0, 0, 40, funM(9, 10), ''],
  ['metropark', '🏞️', 'Metropark day', 'outdoors', 0, 0, 10, funM(4, 5, 6, 7, 8, 9, 10), 'Lake Erie or Kensington · vehicle pass'],
  ['bike', '🚲', 'Bike the Rouge Gateway trail', 'outdoors', 0, 0, 0, funM(4, 5, 6, 7, 8, 9, 10), ''],
  ['picnic', '🧺', 'Park picnic', 'outdoors', 0, 0, 20, funM(5, 6, 7, 8, 9), ''],
  ['library', '📚', 'Library family event', 'activity', 0, 0, 0, FUN_ANY, 'Allen Park library calendar'],
].map(([id, e, n, cat, a, k, f, months, note]) => ({ id: 'fav-' + id, e, n, cat, a, k, f, months, note, src: 'fave' }));

const funFamily = () => { const ad = state.members.filter((m) => !m.kid).length || 1, ki = state.members.filter((m) => m.kid).length; return { ad, ki, n: ad + ki }; };
const PER_PERSON_GUESS = { sports: 40, music: 55, shows: 50, family: 25, activity: 25, movies: 12 };
// What it would cost this family
function funCost(x) {
  const F = funFamily();
  if (x.src === 'live') {
    const per = x.min || PER_PERSON_GUESS[x.cat] || 30;
    return { v: Math.round(per * F.n), est: !x.min, from: !!x.min };
  }
  return { v: Math.round((x.a || 0) * F.ad + (x.k || 0) * F.ki + (x.f || 0)), est: true };
}
const funCatOf = (x) => (x.cat === 'music' || x.cat === 'family' ? (x.cat === 'music' ? 'shows' : 'activity') : x.cat);
const funInSeason = (x, d = today()) => !x.months || x.months.includes(+d.slice(5, 7));

/* ---------- Live events (per phone, cached) ---------- */
const FUN_KEY = 'gomezfam:events';
function funLive() { try { return JSON.parse(localStorage.getItem(FUN_KEY) || 'null') || { events: [] }; } catch { return { events: [] }; } }
async function funRefresh(force) {
  const url = state.notify?.relay, cur = funLive();
  if (!url || typeof Sync === 'undefined' || !Sync.user) return;
  if (!force && cur.at && Date.now() - cur.at < 12 * 3600e3) return;
  if (ui.funLoading) return;
  ui.funLoading = true;
  try {
    const loc = state.fun?.loc || { lat: 42.2575, lng: -83.211, radius: 35 };
    const res = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + await Sync.user.getIdToken(), 'content-type': 'application/json' }, body: JSON.stringify({ op: 'events', ...loc }) });
    const j = await res.json();
    const data = { at: Date.now(), events: (j.events || []).map((e) => ({ ...e, src: 'live', e: { sports: '🏟️', music: '🎵', shows: '🎭', family: '🎪', movies: '🎬' }[e.cat] || '🎟️', n: e.name })), reason: j.reason || '' };
    try { localStorage.setItem(FUN_KEY, JSON.stringify(data)); } catch { /* full */ }
  } catch { /* offline: keep the last list */ }
  ui.funLoading = false;
  if (['fun', 'budget'].includes(currentRoute().name)) render();
}

/* ---------- Everything to pick from ---------- */
function funAll(opts = {}) {
  const t = today(), horizon = addDays(t, opts.days || 45);
  const live = funLive().events.filter((e) => e.date >= t && e.date <= horizon);
  const own = (state.fun?.ideas || []).map((x) => ({ ...x, src: 'own', months: null }));
  const faves = FUN_FAVES.filter((x) => funInSeason(x, t) && !(state.fun?.hidden || []).includes(x.id));
  return [...live, ...own, ...faves].map((x) => ({ ...x, cost: funCost(x), kind: funCatOf(x) }));
}
const funWhen = (x) => (x.date ? `${fmtDate(x.date, { weekday: 'short', month: 'short', day: 'numeric' })}${x.time ? ' · ' + fmtTime(x.time) : ''}` : x.months ? 'In season now' : 'Any time');
const funPrice = (x) => (x.cost.v === 0 ? 'Free' : `${x.cost.from ? 'from ' : ''}~${moneyW(x.cost.v)} for ${funFamily().n}`);

/* ---------- Budget: cut back → enjoy ---------- */
const CUTTABLE = ['dining', 'coffee', 'shopping', 'apps', 'other', 'personal', 'household'];
const CUT_UNIT = { dining: 'takeout orders', coffee: 'coffee runs', shopping: 'shopping trips', apps: 'subscriptions', other: 'purchases', personal: 'purchases', household: 'trips' };
function funPlan() {
  if (typeof catPace !== 'function' || typeof catByKey !== 'function') return null;
  const ym = monthKey(today()), P = catPace(ym);
  const cuts = [];
  for (const key of CUTTABLE) {
    const c = catByKey(key); if (!c) continue;
    const x = P.cats.find((y) => y.key === c.id); if (!x || !x.spent) continue;
    const target = x.lim || x.usual || 0, over = x.likely - target;
    let cut = over > 20 ? Math.min(over, x.likely * 0.35) : x.likely * 0.12; // over budget: trim the overage (max 35%); otherwise a gentle 12%
    cut = Math.floor(cut / 10) * 10;
    if (cut < 20) continue;
    const amts = state.budget.transactions.filter((t) => t.categoryId === c.id && t.type !== 'income' && t.date >= addMonths(ym, -3)).map((t) => t.amount);
    const typical = amts.length ? median(amts) : 0;
    cuts.push({ c, cut, over: over > 20, n: typical ? Math.max(1, Math.round(cut / typical)) : 0, unit: CUT_UNIT[key] });
  }
  cuts.sort((a, b) => (b.over - a.over) || b.cut - a.cut);
  const pick = cuts.slice(0, 2), freed = sum(pick, (x) => x.cut);
  const funCat = catByKey('fun'), fx = funCat && P.cats.find((y) => y.key === funCat.id);
  const funLeft = fx && fx.lim ? Math.max(0, Math.round(fx.lim - fx.spent)) : 0;
  const budget = freed + funLeft;
  if (!budget) return { pick, freed, funLeft, budget, ideas: [] };
  // Fits the money, happens before the month is out (or soon after), one per kind for variety, soonest first
  const end = addDays(dayInMonth(31, ym), 14), seen = new Set(), ideas = [];
  const all = funAll({ days: 45 }).filter((x) => x.cost.v <= budget && x.cost.v > 0 && (!x.date || x.date <= end))
    .sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date || '').localeCompare(b.date || '') || b.cost.v - a.cost.v);
  for (const x of all) { if (seen.has(x.kind)) continue; seen.add(x.kind); ideas.push(x); if (ideas.length >= 4) break; }
  return { pick, freed, funLeft, budget, ideas };
}
function funPlanCard() {
  const F = funPlan();
  if (!F || !F.budget || !F.ideas.length) return '';
  const cutTxt = F.pick.map((x) => `<b>${esc(x.c.emoji)} ${esc(x.c.name)} ${moneyW(x.cut)}</b>${x.n ? ` <span class="muted">(about ${x.n} fewer ${esc(x.unit)})</span>` : ''}`).join(' and ');
  const lead = F.freed
    ? `If you cut back <b>${moneyW(F.freed)}</b> this month: ${cutTxt}${F.funLeft ? `, plus the ${moneyW(F.funLeft)} left in Fun` : ''}, you could enjoy:`
    : `You have <b>${moneyW(F.funLeft)}</b> left in Fun this month. You could enjoy:`;
  return `<div class="section-title"><span>Cut back → enjoy</span><button data-action="go" data-to="fun">All ideas</button></div>
    <div class="card fun-card"><p class="fun-lead">${lead}</p>
      ${F.ideas.map((x) => funRow(x, true)).join('')}
      <p class="small muted" style="margin:8px 0 0">Costs are estimates for your family of ${funFamily().n}. Refreshes as your spending and upcoming events change.</p></div>`;
}
function funRow(x, compact) {
  const saved = (state.fun?.planned || []).includes(x.id);
  return `<div class="fun-row">
    <div class="fun-e">${esc(x.e || '✨')}</div>
    <div class="grow"><div class="title">${esc(x.n)}</div>
      <div class="sub">${esc(funWhen(x))}${x.venue ? ' · ' + esc(x.venue) : x.note && !compact ? ' · ' + esc(x.note) : ''}</div>
      <div class="sub"><b>${esc(funPrice(x))}</b>${x.cost.est && x.cost.v ? ' <span class="muted">est.</span>' : ''}${x.src === 'live' ? ' · <span class="fun-live">live event</span>' : x.src === 'own' ? ' · your idea' : ''}</div></div>
    <div class="fun-act"><button type="button" class="mini-btn" data-action="fun-plan" data-id="${esc(x.id)}">${saved ? '✓ Planned' : 'Plan it'}</button>${x.url ? `<a class="mini-btn" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">Tickets</a>` : x.src === 'fave' ? `<a class="mini-btn" href="https://www.google.com/search?q=${encodeURIComponent(x.n + ' ' + (x.note || 'Detroit'))}" target="_blank" rel="noopener">Info</a>` : ''}</div>
  </div>`;
}

/* ---------- Plan → Things to do ---------- */
TITLES.fun = 'Things to do';
views.fun = () => {
  funRefresh();
  const cat = ui.funCat || 'all', sort = ui.funSort || 'soon';
  let list = funAll({ days: 60 });
  if (cat === 'free') list = list.filter((x) => x.cost.v === 0);
  else if (cat !== 'all') list = list.filter((x) => x.kind === cat);
  if (ui.funFits) { const F = funPlan(); const cap = F ? F.budget : 0; list = list.filter((x) => x.cost.v <= cap); }
  list.sort(sort === 'cheap' ? (a, b) => a.cost.v - b.cost.v : (a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date || '').localeCompare(b.date || '') || a.cost.v - b.cost.v);
  const live = funLive(), F = funPlan();
  const liveNote = !state.notify?.relay ? 'Turn on the relay (Settings → Notifications) to see live events near you.'
    : live.reason === 'no-key' ? 'Live events need a free Ticketmaster key (see below).'
    : live.at ? `Live events updated ${timeAgo(live.at)}` : ui.funLoading ? 'Looking for events near you…' : '';
  return `${F && F.budget ? `<div class="card fun-budget"><div class="kv"><span>Room for fun this month</span><b style="color:var(--good)">${moneyW(F.budget)}</b></div><div class="small muted">${F.funLeft ? `${moneyW(F.funLeft)} left in Fun` : ''}${F.funLeft && F.freed ? ' + ' : ''}${F.freed ? `${moneyW(F.freed)} if you cut back ${F.pick.map((x) => x.c.name).join(' & ')}` : ''}</div>
      <label class="toggle-row" style="padding:6px 0 0"><span>Only show what fits</span><input type="checkbox" data-action="fun-fits" ${ui.funFits ? 'checked' : ''}></label></div>` : ''}
    <div class="chips fun-chips">${FUN_CATS.map(([k, l, e]) => `<button class="chip${cat === k ? ' on' : ''}" data-action="fun-cat" data-k="${k}">${e} ${l}</button>`).join('')}</div>
    <div class="fun-tools"><div class="segmented mini"><button class="${sort === 'soon' ? 'active' : ''}" data-action="fun-sort" data-k="soon">Soonest</button><button class="${sort === 'cheap' ? 'active' : ''}" data-action="fun-sort" data-k="cheap">Cheapest</button></div><button class="mini-btn" data-action="fun-add">+ Your idea</button></div>
    <div class="card flush fun-list">${list.length ? list.slice(0, 80).map((x) => funRow(x)).join('') : '<div class="empty small" style="padding:16px">Nothing here right now. Try another filter.</div>'}</div>
    <p class="small muted" style="text-align:center">${esc(liveNote)}${live.at ? ` · <button class="link-inline" data-action="fun-refresh">Refresh</button>` : ''}<br>Costs are typical estimates for your family of ${funFamily().n}; check before you go.</p>`;
};
Object.assign(actions, {
  'fun-cat': (el) => { ui.funCat = el.dataset.k; render(); },
  'fun-sort': (el) => { ui.funSort = el.dataset.k; render(); },
  'fun-fits': (el) => { ui.funFits = el.checked; render(); },
  'fun-refresh': () => funRefresh(true),
  'fun-add': () => openSheet({
    title: 'Your idea', saveLabel: 'Add',
    fields: [{ row: [{ name: 'e', label: 'Emoji', placeholder: '✨' }, { name: 'n', label: 'What', required: true, placeholder: 'e.g. Trampoline park' }] },
      { name: 'cat', label: 'Kind', type: 'select', options: FUN_CATS.slice(1, 7).map(([value, label]) => ({ value, label })) },
      { name: 'f', label: 'About how much for the family?', type: 'money', placeholder: '0' }],
    onSave(v) { ((state.fun ||= {}).ideas ||= []).push({ id: 'own-' + uid(), e: v.e || '✨', n: v.n, cat: v.cat, a: 0, k: 0, f: v.f || 0 }); toast('Idea added'); },
  }),
  'fun-plan': (el) => {
    const x = funAll({ days: 90 }).find((y) => y.id === el.dataset.id); if (!x) return;
    openSheet({
      title: `Plan: ${x.n}`, saveLabel: 'Add to calendar',
      values: { date: x.date || addDays(today(), (6 - parse(today()).getDay() + 7) % 7 || 7), time: x.time || '' },
      fields: [{ type: 'html', html: `<p class="small muted" style="margin-top:0">${esc(funPrice(x))}${x.cost.est ? ' (estimate)' : ''}. It goes on the family calendar, and the cost shows in the notes.</p>` },
        { row: [{ name: 'date', label: 'Day', type: 'date', required: true }, { name: 'time', label: 'Time', type: 'time' }] }],
      onSave(v) {
        state.events.push({ id: uid(), title: `${x.e || '✨'} ${x.n}`, date: v.date, time: v.time || '', repeat: 'none', memberId: '', notes: `About ${moneyW(x.cost.v)} for the family${x.url ? ' · ' + x.url : ''}`, location: x.venue || '' });
        ((state.fun ||= {}).planned ||= []).push(x.id);
        toast(`On the calendar for ${fmtDate(v.date, { weekday: 'short', month: 'short', day: 'numeric' })} 🎉`);
      },
    });
  },
});
// Plan tab: a "Things to do" chip next to Calendar
if (typeof HUB !== 'undefined') { const h = HUB.plan; if (!h.chips.some(([to]) => to === 'fun')) h.chips.splice(1, 0, ['fun', 'Things to do']); HUB_OF.fun = 'plan'; TABS.push('fun'); }
if (typeof PG_SCROLL !== 'undefined') PG_SCROLL.add('fun');
// Budget overview: the cut-back card sits after the everyday categories
const _budgetFun = views.budget;
views.budget = (p) => {
  const html = _budgetFun(p);
  if ((ui.budgetTab || 'overview') !== 'overview' || ui.budgetMonth && ui.budgetMonth !== monthKey(today())) return html;
  let card = ''; try { card = funPlanCard(); funRefresh(); } catch (e) { if (typeof noteError === 'function') noteError('fun', e); }
  if (!card) return html;
  const at = html.indexOf('<div class="section-title" style="margin-top:22px"><span>Bills & payments');
  return at >= 0 ? html.slice(0, at) + card + html.slice(at) : html.replace(/<button class="fab"/, (m) => card + m);
};
