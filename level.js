/* Level your paychecks: which bill due dates to ask to move so every paycheck carries a fair share.
   Pure arithmetic, no guessing: for the next ~6 months of pay periods it adds up the money coming in, the
   bills due and the everyday budget (spread by day) and gets what each paycheck has left. Then it tries every
   due day (1–28) for each monthly bill of $50+ and keeps the moves that best even those numbers out
   (a shortfall counts triple). Bills you mark "Can't move" stay put. Loaded after periods.js. */
'use strict';

const LV_N = 13;          // pay periods looked at (~6 months biweekly)
const LV_MIN = 50;        // bills smaller than this aren't worth a phone call
const LV_MAX_MOVES = 3;

function levelPeriods() {
  const pay = payBill();
  if (!pay || !['biweekly', 'weekly', 'semimonthly'].includes(pay.freq)) return null;
  const t = today();
  const ds = billOccurrences(pay, addDays(t, -20), addDays(t, 16 * (LV_N + 2)));
  const s0 = ds.filter((d) => d <= t).pop() || ds[0];
  const n = pay.freq === 'semimonthly' ? 12 : pay.freq === 'weekly' ? 26 : LV_N; // about 6 months
  const starts = ds.filter((d) => d >= s0).slice(0, n + 1);
  if (starts.length < 4) return null;
  return starts.slice(0, -1).map((from, i) => ({ from, to: addDays(starts[i + 1], -1) }));
}
// A monthly bill's amounts per period if it were due on `day`
function lvVec(b, day, R) {
  const c = { ...b, dueDay: day, freq: 'monthly' };
  return R.map((r) => sum(billOccurrences(c, r.from, r.to), (d) => amountFor(b, d)));
}
const lvScore = (nets) => {
  const m = sum(nets, (x) => x) / nets.length;
  return sum(nets, (x) => (x - m) ** 2) + 3 * sum(nets, (x) => (x < 0 ? x * x : 0));
};
function levelPlan() {
  const R = levelPeriods();
  if (!R) return null;
  const bills = state.budget.bills.filter((b) => b.type !== 'income');
  const flexDay = sum(everydayCats(), (c) => Number(c.limit) || 0) * 12 / 365;
  const inc = R.map((r) => sum(recurringBetween(r.from, r.to, 'income'), (x) => x.amount));
  const flex = R.map((r) => flexDay * (daysBetween(r.from, r.to) + 1));
  const billV = R.map((r) => sum(recurringBetween(r.from, r.to, 'bill'), (x) => x.amount));
  const netOf = (bv) => R.map((_, i) => inc[i] - flex[i] - bv[i]);
  const before = netOf(billV);
  // Candidates: monthly, big enough, not marked as fixed
  // A bill whose date you changed in the last ~4 months isn't suggested again (you just negotiated it)
  const recent = (b) => b.movedOn && daysBetween(b.movedOn, today()) < 120;
  const movable = bills.filter((b) => (b.freq || 'monthly') === 'monthly' && b.amount >= LV_MIN && !b.fixedDue && !recent(b));
  const cur = billV.slice(), moves = [], used = new Set();
  for (let k = 0; k < LV_MAX_MOVES; k++) {
    const base = lvScore(netOf(cur));
    let best = null;
    for (const b of movable) {
      if (used.has(b.id)) continue;
      const from = b.dueDay || 1, vFrom = lvVec(b, from, R);
      for (let day = 1; day <= 28; day++) {
        if (day === from) continue;
        const vTo = lvVec(b, day, R), next = cur.map((x, i) => x - vFrom[i] + vTo[i]);
        const dist = Math.min(Math.abs(day - from), 28 - Math.abs(day - from)); // gentle preference for small moves
        const sc = lvScore(netOf(next)) * (1 + dist * 0.002);
        if (!best || sc < best.sc) best = { b, from, day, sc, next };
      }
    }
    // Keep a move only if it clearly helps: lifts the tightest paycheck $100+ or narrows the gap $200+
    if (!best) break;
    const nb = netOf(cur), na = netOf(best.next);
    const minBefore = Math.min(...nb), minAfter = Math.min(...na);
    const gapBefore = Math.max(...nb) - minBefore, gapAfter = Math.max(...na) - minAfter;
    if (!(minAfter - minBefore >= 100 || gapBefore - gapAfter >= 200)) break;
    moves.push({ b: best.b, from: best.from, to: best.day, minBefore, minAfter, gapBefore, gapAfter });
    used.add(best.b.id);
    best.next.forEach((x, i) => (cur[i] = x));
  }
  const after = netOf(cur);
  // Bills buffer: the same amount from every paycheck, and what the buffer needs to start with
  const perPay = sum(billV, (x) => x) / R.length;
  let run = 0, need = 0;
  for (const v of billV) { run += perPay - v; need = Math.max(need, -run); }
  const avgNet = sum(before, (x) => x) / R.length;
  return { R, before, after, moves, perPay, buffer: need, avgNet };
}

function levelCard() {
  const L = levelPlan();
  if (!L) return '';
  const { R, before, after, moves } = L;
  const lo = Math.min(...before), hi = Math.max(...before), loA = Math.min(...after), hiA = Math.max(...after);
  const ord = (n) => ordinal(n);
  // Before/after per paycheck: thin paired bars around a zero line
  const W = 340, H = 118, top = 8, plotH = H - top - 20, colW = W / R.length, bw = Math.min(9, colW * 0.32);
  const all = [...before, ...(moves.length ? after : [])], pos = Math.max(0, ...all), negv = Math.max(0, ...all.map((v) => -v));
  const span = Math.max(1, pos + negv), mid = top + (pos / span) * plotH; // zero line sits where the data needs it
  const hh = (v) => (Math.abs(v) / span) * plotH;
  const bar = (v, x, cls) => `<rect x="${x}" y="${v >= 0 ? mid - hh(v) : mid}" width="${bw}" height="${Math.max(1, hh(v))}" rx="2" class="${cls} ${v < 0 ? 'neg' : ''}"/>`;
  const chart = `<svg class="chart lv-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="What each paycheck has left, now and after the suggested moves">
    <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="chart-base"/>
    ${R.map((r, i) => { const x = colW * i + colW / 2; return `${bar(before[i], x - bw - 1, 'lv-before')}${moves.length ? bar(after[i], x + 1, 'lv-after') : ''}<title>${shortD(r.from)}: ${money(before[i], { maximumFractionDigits: 0 })} now${moves.length ? `, ${money(after[i], { maximumFractionDigits: 0 })} after` : ''}</title>`; }).join('')}
    ${R.map((r, i) => (i % 2 === 0 ? `<text x="${colW * i + colW / 2}" y="${H - 3}" text-anchor="middle" class="chart-lbl">${esc(shortD(r.from))}</text>` : '')).join('')}
  </svg>`;
  const sign = (v) => (v < 0 ? '−' : '+') + moneyW(Math.abs(v));
  const rows = moves.map((mv, i) => `<div class="lv-move">
      <div class="lv-n">${i + 1}</div>
      <div class="grow">
        <div class="title">Ask to move <b>${esc(mv.b.name)}</b> (${moneyW(mv.b.amount)}) from the ${ord(mv.from)} to the <b>${ord(mv.to)}</b></div>
        <div class="sub">Tightest paycheck ${sign(mv.minBefore)} → <b>${sign(mv.minAfter)}</b> · gap between paychecks ${moneyW(mv.gapBefore)} → <b>${moneyW(mv.gapAfter)}</b></div>
        <div class="btn-row" style="margin:6px 0 0"><button type="button" class="mini-btn" data-action="lv-moved" data-id="${mv.b.id}" data-day="${mv.to}">✓ It’s moved</button><button type="button" class="mini-btn" data-action="lv-fixed" data-id="${mv.b.id}">Can’t move</button></div>
      </div></div>`).join('');
  const short = L.avgNet < 0;
  const over = typeof catPace === 'function' ? catPace(monthKey(today())).cats.filter((x) => x.lim && x.usual !== null && x.usual > x.lim + 25).sort((a, b) => (b.usual - b.lim) - (a.usual - a.lim)).slice(0, 2) : [];
  return `<div class="card lv-card">
    <h3>Level your paychecks</h3>
    <p class="small muted" style="margin:0 0 6px">What each paycheck has left after its bills and the everyday budget, for the next ${R.length} paychecks.</p>
    ${payBasis()}
    <div class="lv-range">Now: <b>${sign(lo)}</b> to <b>${sign(hi)}</b>${moves.length ? ` · after the moves: <b>${sign(loA)}</b> to <b>${sign(hiA)}</b>` : ''}</div>
    ${chart}
    <div class="chart-legend"><span><i class="lg-sw lv-before"></i>Now</span>${moves.length ? '<span><i class="lg-sw lv-after"></i>After the moves</span>' : ''}</div>
    ${rows ? `<div class="sq-gl" style="margin-top:10px">Due dates to ask about</div>${rows}` : `<p class="small muted">${hi - lo < 300 ? '✅ Your bills are already spread evenly across paychecks.' : 'No single due-date change helps much; the buffer below evens it out instead.'}</p>`}
    ${crunchHtml()}
    <div class="sq-gl" style="margin-top:12px">Or keep a bills buffer</div>
    <div class="lv-tip">Set aside <b>${moneyW(Math.ceil(L.perPay / 10) * 10)}</b> from every paycheck for bills and pay them from that pot. Start it with <b>${moneyW(Math.ceil(L.buffer / 50) * 50)}</b> so the heaviest stretch is covered; after that every paycheck looks the same.</div>
    ${short ? `<div class="lv-tip bad">Even spread perfectly, each paycheck comes up about <b>${moneyW(-L.avgNet)}</b> short of bills plus the everyday budget, so moving dates can’t fix it on its own.${over.length ? ` Biggest gaps: ${over.map((x) => `${esc(x.c.name)} (usual ~${moneyW(x.usual)} vs ${moneyW(x.lim)} budget)`).join(', ')}.` : ''}</div>` : ''}
  </div>`;
}

Object.assign(actions, {
  'lv-moved': (el) => {
    const b = findIn(state.budget.bills, el.dataset.id); if (!b) return;
    const day = +el.dataset.day, next = billOccurrences({ ...b, dueDay: day }, today(), addDays(today(), 40))[0];
    b.dueDay = day; if (next) b.anchor = next; b.movedOn = today();
    save(); render(); toast(`${b.name} now due on the ${ordinal(day)}`);
  },
  'lv-fixed': (el) => { const b = findIn(state.budget.bills, el.dataset.id); if (b) { b.fixedDue = true; save(); render(); toast(`${b.name} stays put`); } },
});

/* ---------- Tight paychecks ahead: predict them, explain them, save for them ----------
   A paycheck is "tight" when what it has left is well below a typical paycheck (or below zero). The cause is
   whatever lands there more than usual: an every-2-weeks bill drafting twice, a yearly bill, bills bunching up.
   For each one the app creates a 🛟 cushion savings goal (same id on every phone, so no duplicates), keeps its
   amount current while nothing is saved yet, removes it if the prediction goes away, and never brings back
   one you deleted. */
function crunches() {
  const L = levelPlan();
  if (!L) return [];
  const { R, before } = L, t = today();
  const semi = payBill()?.freq === 'semimonthly';
  const bills = state.budget.bills.filter((b) => b.type !== 'income');
  const counts = bills.map((b) => R.map((r) => billOccurrences(b, r.from, r.to).length));
  const out = [];
  R.forEach((r, i) => {
    if (i === 0 || r.from <= t) return; // the current paycheck is already here
    // Twice-a-month pay: the 10th and the 25th carry different bills, so compare with the same half of other months
    const peers = semi ? before.filter((_, j) => j % 2 === i % 2) : before, typ = median(peers);
    const gap = typ - before[i];
    if (!(gap >= Math.max(200, Math.abs(typ) * 0.25) || before[i] < 0)) return;
    const causes = [];
    bills.forEach((b, k) => {
      // Monthly bills alternate between paychecks by design; only a second draft in one paycheck is unusual
      const usual = (b.freq || 'monthly') === 'monthly' || b.freq === 'semimonthly' ? Math.max(1, median(counts[k])) : median(counts[k]), extra = counts[k][i] - usual;
      if (extra > 0 && b.amount >= 25) causes.push({ b, extra, amount: Math.round(extra * b.amount), dates: billOccurrences(b, r.from, r.to) });
    });
    causes.sort((a, c) => c.amount - a.amount);
    // Only bill-driven squeezes (or an actual shortfall): a few extra days of groceries isn't worth a goal
    if (!causes.length && before[i] >= 0) return;
    const target = Math.ceil(Math.max(gap, -before[i]) / 10) * 10;
    const before_ = R.filter((x, j) => j < i).length; // paychecks you get before it (this one included)
    out.push({ id: 'cushion-' + r.from, r, i, net: before[i], typical: typ, target, causes, payN: before_, per: Math.ceil(target / Math.max(1, before_) / 5) * 5 });
  });
  return out;
}
const crunchWhy = (c) => (c.causes.length ? c.causes.slice(0, 2).map((x) => x.extra >= 1 && ['biweekly', 'weekly'].includes(x.b.freq) ? `${x.b.name} drafts ${x.dates.length}× (${x.dates.map((d) => shortD(d)).join(' & ')})` : x.b.freq === 'yearly' ? `${x.b.name} (yearly, ${shortD(x.dates[0])})` : `${x.b.name} lands here too`).join('; ') : 'several bills land in the same paycheck');
function syncCushions() {
  const B = state.budget, made = (B.cushions ||= {});
  const list = crunches(), ids = new Set(list.map((c) => c.id));
  let changed = 0;
  for (const c of list) {
    const g = state.goals.find((x) => x.id === c.id);
    const name = `${shortD(c.r.from)} paycheck cushion`, why = crunchWhy(c);
    if (!g) {
      if (made[c.id]) continue; // you deleted it: don't bring it back
      state.goals.push({ id: c.id, created: today(), contributions: [], emoji: '🛟', name, target: c.target, deadline: c.r.from, auto: true, why });
      made[c.id] = today(); changed++;
      setTimeout(() => toast(`🛟 Added a goal: ${moneyW(c.target)} for the ${shortD(c.r.from)} paycheck`), 700);
    } else if (g.auto && !goalSaved(g) && (g.target !== c.target || g.why !== why)) { g.target = c.target; g.why = why; changed++; }
  }
  // A prediction that went away (you moved a bill, the schedule changed): drop its goal if nothing was saved
  const before = state.goals.length;
  state.goals = state.goals.filter((g) => !(g.auto && g.id.startsWith('cushion-') && !ids.has(g.id) && !goalSaved(g) && g.deadline > today()));
  if (state.goals.length !== before) changed++;
  return changed;
}
let cushionAt = 0, cushionSig = '';
const _afterRenderCushion = afterRender;
afterRender = function () {
  _afterRenderCushion();
  try {
    if (typeof inKidMode === 'function' && inKidMode()) return;
    const sig = today() + JSON.stringify(state.budget.bills).length + ':' + state.goals.length + ':' + sum(state.budget.categories, (c) => Number(c.limit) || 0);
    if (sig === cushionSig && Date.now() - cushionAt < 60000) return;
    cushionSig = sig; cushionAt = Date.now();
    if (syncCushions()) { save(); setTimeout(render); }
  } catch (e) { if (typeof noteError === 'function') noteError('cushions', e); }
};
// On the Trends leveller: what's coming and the plan for each
function crunchHtml() {
  const list = crunches();
  if (!list.length) return '';
  return `<div class="sq-gl" style="margin-top:12px">Tight paychecks ahead</div>${list.map((c) => {
    const g = state.goals.find((x) => x.id === c.id), saved = g ? goalSaved(g) : 0;
    const bw = c.causes.find((x) => ['biweekly', 'weekly'].includes(x.b.freq));
    const pay = payBill(), semi = pay?.freq === 'semimonthly' ? semiDays(pay) : null;
    return `<div class="lv-crunch">
      <div class="title">🛟 <b>${esc(shortD(c.r.from))} paycheck</b> · about <b>${moneyW(c.target)}</b> tighter than usual</div>
      <div class="sub">${esc(crunchWhy(c))}. Left after bills: ${c.net < 0 ? '−' : '+'}${moneyW(Math.abs(c.net))} vs a typical ${moneyW(c.typical)}.</div>
      <div class="sub"><b>Plan:</b> set aside ${moneyW(c.per)} from each of the next ${c.payN} paycheck${c.payN > 1 ? 's' : ''}.${bw && semi ? ` Or ask ${esc(bw.b.name)} to draft twice a month (the ${ordinal(Math.min(28, semi[0] + 1))} & ${ordinal(Math.min(28, semi[1] + 1))}, about ${moneyW(perMonth(bw.b) / 2)} each) so it never doubles up.` : ''}</div>
      ${g ? `<button type="button" class="mini-btn" style="margin-top:6px" data-action="go" data-to="goal/${esc(g.id)}">Goal: ${moneyW(saved)} of ${moneyW(g.target)} saved ›</button>` : '<div class="sub muted">Goal removed — it won’t be added again.</div>'}
    </div>`; }).join('')}`;
}
// Home: a heads-up for the next tight paycheck within ~6 weeks that isn't covered yet
const _homeInsightsCushion = homeInsights;
homeInsights = function () {
  let html = _homeInsightsCushion();
  try {
    const c = crunches().find((x) => daysBetween(today(), x.r.from) <= 45);
    const g = c && state.goals.find((x) => x.id === c.id);
    if (c && (!g || goalSaved(g) < g.target)) {
      const left = g ? g.target - goalSaved(g) : c.target;
      const card = `<button class="insight warn" data-action="go" data-to="${g ? 'goal/' + g.id : 'budget'}" data-btab="trends"><span class="ii">🛟</span><b>${esc(shortD(c.r.from))} paycheck will be tight</b><small>${esc(crunchWhy(c))} · ${moneyW(left)} to set aside</small></button>`;
      html = html ? html.replace('<div class="insights">', '<div class="insights">' + card) : `<div class="insights">${card}</div>`;
    }
  } catch { /* never break Home */ }
  return html;
};
