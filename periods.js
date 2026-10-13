/* Trends: pay period (or week) view.
   Each bar is one paycheck-to-paycheck stretch (or Mon–Sun week): bills at the bottom, everyday spending on
   top, money in as a dashed tick and what was left underneath. A bill paid well before or after its due date
   is striped, and "As scheduled" moves it back to the period it was due in, so a period that only felt tight
   because the mortgage went out early reads that way. Loaded after cats.js. */
'use strict';

const PER_N = 8;
const OFF_DAYS = 3; // paid this many days or more from the due date = off schedule
// The main paycheck: the biggest recurring income
const payBill = () => state.budget.bills.filter((b) => b.type === 'income').sort((a, b) => perMonth(b) - perMonth(a))[0] || null;
function periodRanges(unit) {
  const t = today();
  if (unit === 'pay') {
    const b = payBill();
    if (b) {
      // Paydays: the paycheck deposits that actually landed (they move), plus scheduled ones with no deposit yet
      const big = Math.max(50, perMonth(b) / (b.freq === 'weekly' ? 4.3 : b.freq === 'biweekly' ? 2.17 : 1) * 0.6);
      const dep = [...new Set(state.budget.transactions.filter((x) => x.type === 'income' && x.amount >= big && x.date <= t).map((x) => x.date))].sort();
      const sch = billOccurrences(b, addDays(t, -420), addDays(t, 62));
      const near = (d) => dep.some((x) => Math.abs(daysBetween(x, d)) <= 3);
      const first = dep[0] || sch[0];
      const last = dep.at(-1) || '';
      const days = [...new Set([...dep, ...sch.filter((d) => d <= t && d >= first && d > last && !near(d))])].sort(); // the schedule only fills in after the last real deposit
      const next = sch.find((d) => d > t && !dep.some((x) => x > t));
      if (days.length >= 2 && next) {
        const starts = days.slice(-PER_N);
        return starts.map((from, i) => ({ from, to: addDays(i < starts.length - 1 ? starts[i + 1] : next, -1) }));
      }
    }
  }
  const mon = addDays(t, -((parse(t).getDay() + 6) % 7));
  return [...Array(PER_N)].map((_, i) => { const from = addDays(mon, -7 * (PER_N - 1 - i)); return { from, to: addDays(from, 6) }; });
}
// Which bill a payment was for: its link, else a bill with (almost) the same amount and the same category
// or a shared name word ("Newrez-Shellpoint Web Pmts" $1,184.75 is the $1,185 mortgage)
const nameWords = (s) => new Set(norm(s).split(/[^a-z]+/).filter((w) => w.length > 3));
function billFor(t) {
  if (t.billId) return state.budget.bills.find((x) => x.id === t.billId) || null;
  const a = Number(t.amount) || 0, w = nameWords(t.note);
  return state.budget.bills.find((b) => b.type !== 'income' && Math.abs(b.amount - a) <= Math.max(2, b.amount * 0.03)
    && (((b.categoryId || (typeof billCatKey === 'function' && catByKey(billCatKey(b))?.id)) === t.categoryId && t.categoryId) || [...nameWords(b.name)].some((x) => w.has(x)))) || null;
}
// When a bill payment was due: the occurrence it was marked paid for, else the nearest scheduled date
function billDue(t) {
  const b = billFor(t);
  if (!b) return null;
  const key = b.paid && Object.keys(b.paid).find((k) => b.paid[k] === t.id);
  if (key) return { b, due: key };
  const ds = billOccurrences(b, addDays(t.date, -20), addDays(t.date, 20));
  if (!ds.length) return { b, due: t.date };
  return { b, due: ds.sort((x, y) => Math.abs(daysBetween(x, t.date)) - Math.abs(daysBetween(y, t.date)))[0] };
}
function periodData(unit, sched) {
  const R = periodRanges(unit), t = today();
  const idx = (d) => R.findIndex((r) => d >= r.from && d <= r.to);
  const P = R.map((r) => ({ ...r, inc: 0, bills: 0, off: 0, every: 0, due: 0, offList: [], movedOut: 0, movedIn: 0 }));
  const lo = addDays(R[0].from, -40), hi = addDays(R.at(-1).to, 40);
  for (const x of state.budget.transactions) {
    if (x.date < lo || x.date > hi) continue;
    const amt = Number(x.amount) || 0;
    if (x.type === 'income') { const i = idx(x.date); if (i >= 0) P[i].inc += amt; continue; }
    if (!isBillOnly(x)) { const i = idx(x.date); if (i >= 0) P[i].every += amt; continue; }
    const d = billDue(x), off = d && Math.abs(daysBetween(d.due, x.date)) >= OFF_DAYS;
    const iPaid = idx(x.date), iDue = d ? idx(d.due) : iPaid;
    const i = sched && d ? iDue : iPaid;
    if (off) {
      const rec = { name: d.b.name, amount: amt, paid: x.date, due: d.due, days: daysBetween(x.date, d.due) };
      if (iPaid >= 0) P[iPaid].offList.push(rec);
      if (iPaid !== iDue) { if (iPaid >= 0) P[iPaid].movedOut += amt; if (iDue >= 0) P[iDue].movedIn += amt; }
    }
    if (i < 0) continue;
    if (off) P[i].off += amt; else P[i].bills += amt;
  }
  // The current period: bills still due before it ends, and the paycheck(s) still coming
  const cur = idx(t);
  if (cur >= 0) {
    P[cur].due = sum(recurringBetween(addDays(t, 1), P[cur].to, 'bill').filter((x) => !isPaid(x.b, x.date)), (x) => x.amount);
    P[cur].incComing = sum(recurringBetween(t, P[cur].to, 'income').filter((x) => !isPaid(x.b, x.date)), (x) => x.amount);
  }
  for (const p of P) { p.out = p.bills + p.off + p.every; p.net = p.inc - p.out; }
  return { P, cur, unit: unit === 'pay' && payBill() && R[0] && daysBetween(R[0].from, R[0].to) !== 6 ? 'pay' : 'week' };
}
const shortD = (d) => fmtDate(d, { month: 'short', day: 'numeric' });

function periodCard() {
  const unit = ui.perUnit || 'pay', sched = !!ui.perSched;
  const { P, cur, unit: real } = periodData(unit, sched);
  if (!P.some((p) => p.out || p.inc)) return '';
  const sel = Math.min(P.length - 1, ui.perSel ?? (cur >= 0 ? cur : P.length - 1));
  const W = 340, H = 196, top = 22, bottom = 40, left = 4, right = 4;
  const plotH = H - top - bottom, colW = (W - left - right) / P.length, barW = Math.min(24, colW * 0.56);
  const max = niceMax(Math.max(...P.map((p) => Math.max(p.out + p.due, p.inc + (p.incComing || 0))), 1));
  const y = (v) => top + plotH - (v / max) * plotH, h = (v) => (v / max) * plotH;
  const lbl = (p) => shortD(p.from);
  const bars = P.map((p, i) => {
    const x = left + colW * i + (colW - barW) / 2, isSel = i === sel, op = isSel ? 1 : 0.6;
    let base = top + plotH;
    const seg = (v, cls, extra = '') => { if (v <= 0) return ''; const hh = Math.max(1.5, h(v)); base -= hh; return `<rect x="${x}" y="${base}" width="${barW}" height="${hh - (base > top ? 1 : 0)}" rx="2" class="${cls}" opacity="${op}" ${extra}/>`; };
    const s = seg(p.bills, 'per-bill') + seg(p.off, 'per-off') + seg(p.every, 'per-every') + seg(p.due, 'per-due');
    const inc = p.inc + (i === cur ? p.incComing || 0 : 0);
    const net = i === cur ? null : p.net;
    return `<g>${s}
      ${inc ? `<line x1="${x - 5}" x2="${x + barW + 5}" y1="${y(inc)}" y2="${y(inc)}" class="chart-inc"/>` : ''}
      ${p.offList.length ? `<text x="${x + barW / 2}" y="${Math.min(y(p.out + p.due), inc ? y(inc) : H) - 5}" text-anchor="middle" class="per-flag">⇄</text>` : ''}
      <text x="${x + barW / 2}" y="${H - 22}" text-anchor="middle" class="chart-lbl${isSel ? ' sel' : ''}">${esc(lbl(p))}</text>
      ${net !== null && (p.inc || p.out) ? `<text x="${x + barW / 2}" y="${H - 7}" text-anchor="middle" class="per-net ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${esc(compactMoney(Math.abs(net)))}</text>` : i === cur ? `<text x="${x + barW / 2}" y="${H - 7}" text-anchor="middle" class="per-net">now</text>` : ''}
      <rect x="${left + colW * i}" y="0" width="${colW}" height="${H}" fill="transparent" data-action="per-sel" data-i="${i}" style="cursor:pointer"><title>${shortD(p.from)}–${shortD(p.to)}: in ${money(p.inc, { maximumFractionDigits: 0 })}, bills ${money(p.bills + p.off, { maximumFractionDigits: 0 })}, everyday ${money(p.every, { maximumFractionDigits: 0 })}</title></rect>
    </g>`;
  }).join('');
  const chart = `<svg class="chart per-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Money in and out per ${real === 'pay' ? 'pay period' : 'week'}">
    <defs><pattern id="perStripe" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="per-bill-bg"/><line x1="0" y1="0" x2="0" y2="5" class="per-stripe"/></pattern></defs>
    <line x1="${left}" x2="${W - right}" y1="${top + plotH}" y2="${top + plotH}" class="chart-base"/>${bars}</svg>`;

  // The selected period, in words
  const p = P[sel], isCur = sel === cur;
  const other = periodData(unit, !sched).P[sel];
  const early = p.offList.filter((o) => o.days > 0), late = p.offList.filter((o) => o.days < 0);
  const offRows = p.offList.map((o) => `<div class="per-off"><span>${esc(o.name)} · ${moneyW(o.amount)}</span><span class="muted">paid ${esc(shortD(o.paid))}, due ${esc(shortD(o.due))} · <b>${Math.abs(o.days)} days ${o.days > 0 ? 'early' : 'late'}</b></span></div>`).join('');
  const why = !sched && p.movedOut >= 1 && !isCur
    ? `<div class="per-why">This ${real === 'pay' ? 'pay period' : 'week'} carried <b>${moneyW(p.movedOut)}</b> of bills from other periods (${early.length ? 'paid early' : ''}${early.length && late.length ? ' / ' : ''}${late.length ? 'paid late' : ''}). As scheduled, it would have ${other.net >= 0 ? 'left' : 'been short'} <b>${moneyW(Math.abs(other.net))}</b> instead of ${p.net >= 0 ? 'leaving' : 'being short'} ${moneyW(Math.abs(p.net))}.</div>`
    : sched && p.movedIn >= 1 ? `<div class="per-why">Includes <b>${moneyW(p.movedIn)}</b> of bills that were due here but paid in another period.</div>` : '';
  const detail = `<div class="per-detail">
      <div class="per-range">${esc(shortD(p.from))} – ${esc(shortD(p.to))}${isCur ? ' · so far' : ''}</div>
      <div class="kv"><span class="muted">Money in</span><b style="color:var(--good)">+${moneyW(p.inc)}</b></div>
      ${isCur && p.incComing ? `<div class="kv"><span class="muted">Pay still coming</span><b style="color:var(--good)">+${moneyW(p.incComing)}</b></div>` : ''}
      <div class="kv"><span class="muted"><i class="lg-sw per-bill"></i>Bills${sched ? ' due' : ' paid'}</span><b>−${moneyW(p.bills + p.off)}</b></div>
      <div class="kv"><span class="muted"><i class="lg-sw per-every"></i>Everyday</span><b>−${moneyW(p.every)}</b></div>
      ${isCur && p.due ? `<div class="kv"><span class="muted"><i class="lg-sw per-due"></i>Bills still due</span><b>−${moneyW(p.due)}</b></div>` : ''}
      ${(() => { const n = isCur ? p.inc + (p.incComing || 0) - p.out - p.due : p.net; return `<div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>${isCur ? (n >= 0 ? 'Left by payday' : 'Short by payday') : n >= 0 ? 'Left over' : 'Short'}</span><b style="color:${n < 0 ? 'var(--bad)' : 'var(--good)'}">${moneyW(Math.abs(n))}</b></div>`; })()}
      ${why}
      ${offRows ? `<div class="sq-gl" style="margin-top:10px">Paid off schedule</div>${offRows}` : ''}
    </div>`;
  const seg = (k, opts, cur) => `<div class="segmented mini">${opts.map(([v, l]) => `<button class="${cur === v ? 'active' : ''}" data-action="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="card per-card">
    <h3>${real === 'pay' ? 'By pay period' : 'By week'}</h3>
    <div class="per-ctl">${seg('per-unit', [['pay', 'Pay periods'], ['week', 'Weeks']], unit === 'pay' && real === 'pay' ? 'pay' : 'week')}${seg('per-sched', [['0', 'As paid'], ['1', 'As due']], sched ? '1' : '0')}</div>
    ${chart}
    <div class="chart-legend"><span><i class="lg-sw per-bill"></i>Bills</span><span><i class="lg-sw per-bill striped"></i>Paid early/late</span><span><i class="lg-sw per-every"></i>Everyday</span>${cur >= 0 && P[cur].due ? '<span><i class="lg-sw per-due"></i>Still due</span>' : ''}<span><i class="lg-line inc"></i>Money in</span></div>
    ${detail}
  </div>`;
}
// $1.2k / $850 for the small labels under the bars
const compactMoney = (n) => (n >= 1000 ? '$' + (Math.round(n / 100) / 10).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : '$' + Math.round(n));

Object.assign(actions, {
  'per-sel': (el) => { ui.perSel = +el.dataset.i; render(); },
  'per-unit': (el) => { ui.perUnit = el.dataset.v; ui.perSel = undefined; render(); },
  'per-sched': (el) => { ui.perSched = el.dataset.v === '1'; render(); },
});
