/* Family: fridge board & polls, trip packing lists, debt payoff planner, subscription audit,
   bill price-change tracking, the grouped More grid and new Home blocks. Loaded after kids.js. */
'use strict';

Object.assign(TITLES, { board: 'Fridge Board', packing: 'Packing Lists', trip: 'Packing', debts: 'Debt Payoff', subs: 'Subscriptions' });

/* =========================================================
   Fridge board: notes with reactions + family polls
   ========================================================= */
const NOTE_COLORS = { yellow: '#fff3b0', pink: '#ffd6e0', blue: '#d6ecff', green: '#d9f5dd', purple: '#e9dcff' };
const REACTIONS = ['❤️', '😂', '👍', '🎉', '😮'];
const actor = () => (typeof kidModeId === 'function' && kidModeId()) || meId() || '';
function reactBar(item) {
  const me = actor() || 'anon';
  const rx = item.reactions || {};
  return `<div class="reacts">${REACTIONS.map((e) => {
    const who = Object.keys(rx[e] || {});
    return `<button class="react${who.includes(me) ? ' on' : ''}" data-action="react" data-id="${item.id}" data-e="${e}">${e}${who.length ? `<span>${who.length}</span>` : ''}</button>`;
  }).join('')}</div>`;
}
function noteCard(n) {
  const m = n.who ? member(n.who) : null;
  return `<div class="note" style="--nc:${NOTE_COLORS[n.color] || NOTE_COLORS.yellow}">
    ${n.pinned ? '<span class="pin">📌</span>' : ''}
    <div class="note-text">${esc(n.text)}</div>
    <div class="note-foot"><span>${m ? `${esc(m.emoji)} ${esc(m.name)}` : '👤'} · ${timeAgo(n.at)}</span>${(typeof inKidMode === 'function' && inKidMode() && n.who !== actor()) ? '' : `<button class="note-x" data-action="note-del" data-id="${n.id}" aria-label="Remove">✕</button>`}</div>
    ${reactBar(n)}
  </div>`;
}
function pollCard(p) {
  const votes = p.votes || {};
  const total = Object.keys(votes).length;
  const mine = votes[actor() || 'anon'];
  const lead = Math.max(0, ...p.options.map((o) => Object.values(votes).filter((v) => v === o.id).length));
  return `<div class="card poll">
    <div class="poll-q">🗳️ ${esc(p.text)}</div>
    ${p.options.map((o) => {
      const n = Object.values(votes).filter((v) => v === o.id).length;
      const pct = total ? Math.round((n / total) * 100) : 0;
      const voters = Object.entries(votes).filter(([, v]) => v === o.id).map(([k]) => (state.members.some((m) => m.id === k) ? member(k).emoji : '👤')).join('');
      return `<button class="poll-opt${mine === o.id ? ' mine' : ''}${p.closed && n === lead && n ? ' win' : ''}" data-action="vote" data-id="${p.id}" data-o="${o.id}" ${p.closed ? 'disabled' : ''}>
        <i style="width:${pct}%"></i><span class="po-t">${esc(o.text)}</span><span class="po-v">${voters} ${total ? pct + '%' : ''}</span></button>`;
    }).join('')}
    <div class="small muted" style="display:flex;justify-content:space-between;margin-top:6px"><span>${total} vote${total === 1 ? '' : 's'}${p.closed ? ' · closed' : ''}</span>${(typeof inKidMode === 'function' && inKidMode()) ? '' : `<span><button class="mini-btn" data-action="poll-close" data-id="${p.id}">${p.closed ? 'Reopen' : 'Close'}</button><button class="mini-btn" style="color:var(--bad)" data-action="note-del" data-id="${p.id}">Delete</button></span>`}</div>
  </div>`;
}
views.board = () => {
  const items = [...state.board].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);
  const polls = items.filter((x) => x.type === 'poll'), notes = items.filter((x) => x.type !== 'poll');
  return `
    <div class="btn-row" style="margin-top:0"><button class="btn" data-action="note-new">📝 Note</button>${typeof inKidMode === 'function' && inKidMode() ? '' : '<button class="btn secondary" data-action="poll-new">🗳️ Poll</button>'}</div>
    ${polls.map(pollCard).join('')}
    ${notes.length ? `<div class="notes">${notes.map(noteCard).join('')}</div>` : (polls.length ? '' : `<div class="card empty"><span class="big">📌</span>The family fridge. Leave notes, reminders and little love letters — or start a vote.</div>`)}
  `;
};
function boardHomeBlock() {
  const poll = state.board.find((b) => b.type === 'poll' && !b.closed);
  const notes = state.board.filter((b) => b.type !== 'poll').sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at).slice(0, 2);
  if (!poll && !notes.length) return '';
  return `<div data-home="board"><div class="section-title">Fridge board<button data-action="go" data-to="board">Open</button></div>
    ${poll ? pollCard(poll) : ''}${notes.length ? `<div class="notes">${notes.map(noteCard).join('')}</div>` : ''}</div>`;
}

/* =========================================================
   Packing lists
   ========================================================= */
const PACK_TEMPLATES = {
  beach: { name: 'Beach trip', emoji: '🏖️', shared: ['Sunscreen', 'Beach towels', 'Beach bag', 'Snacks & water', 'Umbrella', 'Phone chargers'], each: ['Swimsuit', 'Flip-flops', 'Sunglasses', 'Hat', 'Pajamas', 'Toothbrush', '3 outfits'] },
  disney: { name: 'Disney trip', emoji: '🏰', shared: ['Park tickets / app', 'Portable battery', 'Ponchos', 'Sunscreen', 'Refillable water bottles', 'Snacks', 'Autograph book', 'Stroller'], each: ['Comfy walking shoes', 'Mickey ears', 'Pajamas', 'Toothbrush', 'Outfit per day', 'Light jacket'] },
  camping: { name: 'Camping', emoji: '🏕️', shared: ['Tent', 'Sleeping pads', 'Lantern', 'Cooler', 'Camp stove & fuel', 'Matches / lighter', 'First-aid kit', 'Bug spray', 'Marshmallows'], each: ['Sleeping bag', 'Flashlight', 'Warm layer', 'Rain jacket', 'Hiking shoes', 'Toothbrush'] },
  grandma: { name: "Grandma's house", emoji: '👵', shared: ['Gift for Grandma', 'Chargers', 'Snacks for the drive'], each: ['Pajamas', 'Toothbrush', 'Outfits', 'Favorite toy / book'] },
  winter: { name: 'Winter getaway', emoji: '⛄', shared: ['Hand warmers', 'Lip balm', 'Chargers', 'Snacks'], each: ['Winter coat', 'Gloves', 'Hat', 'Snow boots', 'Thermal layers', 'Pajamas', 'Toothbrush'] },
};
function tripStats(t) { const n = t.items.length, d = t.items.filter((i) => i.done).length; return { n, d, pct: n ? d / n : 0 }; }
views.packing = () => {
  const kidId = typeof kidModeId === 'function' ? kidModeId() : '';
  const trips = [...state.trips].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  return `${trips.map((t) => {
    const items = kidId ? t.items.filter((i) => !i.memberId || i.memberId === kidId) : t.items;
    const d = items.filter((i) => i.done).length;
    const days = t.date ? daysBetween(today(), t.date) : null;
    return `<button class="card tile trip-card" data-action="go" data-to="trip/${t.id}">
      <div style="display:flex;gap:12px;align-items:center"><span class="trip-emoji">${esc(t.emoji || '🧳')}</span>
        <div style="flex:1;min-width:0"><b style="font-size:17px">${esc(t.name)}</b><div class="small muted">${days != null ? (days > 0 ? `in ${days} day${days > 1 ? 's' : ''}` : days === 0 ? 'Today!' : 'Done') + ' · ' : ''}${d}/${items.length} packed</div></div>
        <div class="ring-box">${ring(items.length ? d / items.length : 0, 48, 5, d === items.length && items.length ? 'done' : '')}<span style="font-size:12px;font-weight:800">${items.length ? Math.round((d / items.length) * 100) : 0}%</span></div></div>
    </button>`;
  }).join('') || `<div class="card empty"><span class="big">🧳</span>${kidId ? 'No trips yet!' : 'Make a packing list for your next trip — with a list for every person.'}</div>`}
  ${kidId ? '' : `<button class="fab" data-action="trip-new" aria-label="New trip">${ICON.plus}</button>`}`;
};
views.trip = (id) => {
  const t = state.trips.find((x) => x.id === id);
  if (!t) return '<div class="card empty">This trip was deleted.</div>';
  const kidId = typeof kidModeId === 'function' ? kidModeId() : '';
  const groups = [['', '🧺 Shared'], ...t.people.map((pid) => [pid, `${member(pid).emoji} ${member(pid).name}`])].filter(([pid]) => !kidId || !pid || pid === kidId);
  const st = tripStats(t);
  const days = t.date ? daysBetween(today(), t.date) : null;
  return `<div class="card trip-head"><span class="trip-emoji big">${esc(t.emoji || '🧳')}</span><div style="flex:1"><div style="font:800 22px/1.15 var(--font-display)">${esc(t.name)}</div><div class="small muted">${t.date ? `${fmtDate(t.date, { weekday: 'short', month: 'short', day: 'numeric' })}${days > 0 ? ` · in ${days} days` : ''}` : ''}</div><div class="bar"><i style="width:${st.pct * 100}%"></i></div><div class="small muted">${st.d} of ${st.n} packed</div></div>${kidId ? '' : `<button class="mini-btn" data-action="trip-edit" data-id="${t.id}">Edit</button>`}</div>
    ${groups.map(([pid, label]) => {
      const items = t.items.filter((i) => (i.memberId || '') === pid);
      return `<div class="section-title">${esc(label)}<span class="small" style="text-transform:none">${items.filter((i) => i.done).length}/${items.length}</span></div>
        <div class="card flush">${items.map((i) => `<div class="row${i.done ? ' done' : ''}"><button class="check${i.done ? ' on' : ''}" data-action="trip-toggle" data-t="${t.id}" data-id="${i.id}" aria-label="Packed">${ICON.check}</button><div class="grow"><div class="title">${esc(i.text)}</div></div>${kidId ? '' : `<button class="del-btn" data-action="trip-del-item" data-t="${t.id}" data-id="${i.id}" aria-label="Remove">${ICON.x}</button>`}</div>`).join('') || '<div class="empty small">Nothing yet</div>'}
        ${kidId ? '' : `<form class="quick-add trip-add" data-submit="trip-item" data-t="${t.id}" data-m="${pid}"><input type="text" name="tripItem" placeholder="Add for ${esc(label.replace(/^\S+\s/, ''))}…" autocomplete="off"><button class="btn" type="submit" aria-label="Add">${ICON.plus}</button></form>`}
        </div>`;
    }).join('')}`;
};
function tripForm(t) {
  const isNew = !t;
  openSheet({
    title: isNew ? 'New packing list' : 'Edit trip',
    values: t ? { ...t, ...Object.fromEntries(state.members.map((m) => ['p_' + m.id, t.people.includes(m.id)])) } : { emoji: '🧳', template: '', ...Object.fromEntries(state.members.map((m) => ['p_' + m.id, true])) },
    fields: [
      ...(isNew ? [{ name: 'template', label: 'Trip type', type: 'select', options: [{ value: '', label: '✏️ Blank list' }, ...Object.entries(PACK_TEMPLATES).map(([k, x]) => ({ value: k, label: `${x.emoji} ${x.name}` }))] }] : []),
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🧳' }, { name: 'name', label: 'Trip', placeholder: 'e.g. Disney trip' }] },
      { name: 'date', label: 'Leaving on', type: 'date' },
      { type: 'html', html: '<div class="small muted" style="margin:0 4px 6px;font-weight:650">Who’s going?</div>' },
      ...state.members.map((m) => ({ name: 'p_' + m.id, label: `${m.emoji} ${m.name}`, type: 'checkbox' })),
    ],
    onInput(form, e) {
      if (e.target.name !== 'template') return;
      const x = PACK_TEMPLATES[e.target.value]; if (!x) return;
      if (!form.elements.name.value) form.elements.name.value = x.name;
      form.elements.emoji.value = x.emoji;
      const ev = state.events.filter((ev) => ev.countdown && norm(ev.title).includes(e.target.value === 'disney' ? 'disney' : norm(x.name).split(' ')[0]));
      if (ev[0] && !form.elements.date.value) form.elements.date.value = nextOccurrence(ev[0]) || '';
    },
    onSave(v) {
      const people = state.members.filter((m) => v['p_' + m.id]).map((m) => m.id);
      if (isNew) {
        const x = PACK_TEMPLATES[v.template];
        const nt = { id: uid(), name: v.name || x?.name || 'Trip', emoji: v.emoji || x?.emoji || '🧳', date: v.date, people, items: [] };
        if (x) {
          for (const s of x.shared) nt.items.push({ id: uid(), text: s, memberId: '', done: false });
          for (const pid of people) for (const s of x.each) nt.items.push({ id: uid(), text: s, memberId: pid, done: false });
        }
        state.trips.push(nt);
        setTimeout(() => go('trip/' + nt.id));
      } else Object.assign(t, { name: v.name, emoji: v.emoji, date: v.date, people });
    },
    onDelete: isNew ? null : () => { withUndo(`${t.name} deleted`, () => { state.trips = state.trips.filter((x) => x.id !== t.id); }); go('packing'); },
  });
}
function tripsHomeBlock() {
  const soon = state.trips.filter((t) => t.date && daysBetween(today(), t.date) >= 0 && daysBetween(today(), t.date) <= 21 && tripStats(t).pct < 1);
  if (!soon.length) return '';
  return `<div data-home="trips"><div class="section-title">Packing<button data-action="go" data-to="packing">All trips</button></div><div class="card flush">${soon.map((t) => { const s = tripStats(t); return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="trip/${t.id}"><div class="avatar">${esc(t.emoji)}</div><div class="grow"><div class="title">${esc(t.name)} · in ${daysBetween(today(), t.date)} days</div><div class="bar" style="margin-top:4px"><i style="width:${s.pct * 100}%"></i></div></div><span class="small muted">${s.d}/${s.n}</span></button>`; }).join('')}</div></div>`;
}

/* =========================================================
   Debt payoff planner (snowball vs avalanche)
   ========================================================= */
function simulateDebts(debts, extra, strategy) {
  let ds = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, bal: Number(d.balance), paidOff: null, interest: 0 }));
  if (!ds.length) return null;
  const order = () => ds.filter((d) => d.bal > 0.005).sort(strategy === 'avalanche' ? (a, b) => (b.apr - a.apr) || (a.bal - b.bal) : (a, b) => (a.bal - b.bal) || (b.apr - a.apr));
  let month = 0, totalInterest = 0;
  const series = [sum(ds, (d) => d.bal)];
  while (ds.some((d) => d.bal > 0.005) && month < 600) {
    month++;
    let pool = Number(extra) || 0;
    for (const d of ds) {
      if (d.bal <= 0.005) { pool += Number(d.min) || 0; continue; } // freed-up minimums roll over
      const i = d.bal * (Number(d.apr) || 0) / 1200;
      d.bal += i; d.interest += i; totalInterest += i;
      const pay = Math.min(d.bal, Number(d.min) || 0);
      d.bal -= pay;
      if (d.bal <= 0.005 && !d.paidOff) { d.paidOff = month; pool += (Number(d.min) || 0) - pay; } // unused part of the last minimum rolls over now
    }
    for (const d of order()) {
      if (pool <= 0) break;
      const pay = Math.min(d.bal, pool);
      d.bal -= pay; pool -= pay;
      if (d.bal <= 0.005 && !d.paidOff) d.paidOff = month;
    }
    series.push(Math.max(0, sum(ds, (d) => d.bal)));
  }
  return { months: month, interest: totalInterest, debts: ds, series, stuck: month >= 600 };
}
const monthsLabel = (n) => n >= 12 ? `${Math.floor(n / 12)} yr${n >= 24 ? 's' : ''}${n % 12 ? ` ${n % 12} mo` : ''}` : `${n} mo`;
views.debts = () => {
  const debts = state.debts;
  const extra = Number(state.settings.debtExtra ?? 100), strat = state.settings.debtStrategy || 'avalanche';
  const importable = state.budget.bills.filter((b) => (b.group === 'Debt' || /credit|card|loan|finance|amex|chase|discover|capital one|credit union/i.test(b.name)) && b.type !== 'income' && !debts.some((d) => d.billId === b.id));
  if (!debts.length) {
    return `<div class="card empty"><span class="big">💳</span>See your debt-free date and how much interest you can save.</div>
      ${importable.length ? `<button class="btn block" data-action="debt-import">Import ${importable.length} debt${importable.length > 1 ? 's' : ''} from your bills</button>` : ''}
      <button class="fab" data-action="debt-new" aria-label="Add debt">${ICON.plus}</button>`;
  }
  const missing = debts.filter((d) => !d.balance || d.apr == null || d.apr === '');
  const a = simulateDebts(debts, extra, 'avalanche'), sb = simulateDebts(debts, extra, 'snowball'), base = simulateDebts(debts, 0, strat);
  const cur = strat === 'avalanche' ? a : sb;
  const totalBal = sum(debts, (d) => d.balance), totalMin = sum(debts, (d) => d.min);
  const free = cur && !cur.stuck ? addMonths(monthKey(today()), cur.months) : null;
  // chart
  let chart = '';
  if (cur && !cur.stuck) {
    const W = 340, H = 140, top = 12, bottom = 22, plotH = H - top - bottom, pts = cur.series, max = pts[0] || 1;
    const x = (i) => 6 + (i / Math.max(1, pts.length - 1)) * (W - 12), y = (v) => top + plotH - (v / max) * plotH;
    const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const yrs = Math.ceil(pts.length / 12);
    const ticks = [...Array(Math.min(yrs, 6) + 1)].map((_, k) => Math.round((k * (pts.length - 1)) / Math.min(yrs, 6))).map((i, k, arr) => `<text x="${x(i)}" y="${H - 5}" text-anchor="${k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle'}" class="chart-lbl">${parse(addMonths(monthKey(today()), i) + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</text>`).join('');
    chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Total debt over time"><defs><linearGradient id="dbf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path d="${line}L${x(pts.length - 1)},${top + plotH}L${x(0)},${top + plotH}Z" fill="url(#dbf)"/><path d="${line}" fill="none" style="stroke:var(--accent)" stroke-width="2.2"/>${ticks}</svg>`;
  }
  return `
    ${missing.length ? `<div class="card install-tip small">✏️ Add the balance and interest rate (APR) for <b>${missing.map((d) => esc(d.name)).join(', ')}</b> — tap a debt below.</div>` : ''}
    <div class="card debt-hero">
      <div class="stat-label">Debt-free</div>
      <div class="stat" style="font-size:30px">${free ? parse(free + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : cur?.stuck ? 'Never 😟' : '—'}</div>
      <div class="small muted">${cur && !cur.stuck ? `in ${monthsLabel(cur.months)} · ${money(cur.interest, { maximumFractionDigits: 0 })} interest` : 'Minimums don’t cover the interest — add more per month'}</div>
      ${chart}
      <div class="field" style="margin:10px 0 0"><label for="debtExtra">Extra per month: <b>${money(extra, { maximumFractionDigits: 0 })}</b></label>
        <input type="range" id="debtExtra" min="0" max="2000" step="25" value="${extra}" data-change="debt-extra" class="slider"></div>
      ${base && cur && !base.stuck && !cur.stuck && extra > 0 ? `<div class="allowance">💡 Paying ${money(extra, { maximumFractionDigits: 0 })} extra saves <b>${money(base.interest - cur.interest, { maximumFractionDigits: 0 })}</b> in interest and gets you out <b>${monthsLabel(base.months - cur.months)}</b> sooner.</div>` : ''}
    </div>
    <div class="segmented"><button class="${strat === 'avalanche' ? 'active' : ''}" data-action="debt-strat" data-s="avalanche">🏔️ Avalanche</button><button class="${strat === 'snowball' ? 'active' : ''}" data-action="debt-strat" data-s="snowball">⛄ Snowball</button></div>
    ${a && sb && !a.stuck && !sb.stuck ? `<p class="small muted" style="margin:-6px 4px 12px">${strat === 'avalanche' ? 'Highest interest first — saves the most money' : 'Smallest balance first — quick wins keep you motivated'}. ${Math.abs(sb.interest - a.interest) < 1 ? 'Both cost the same here.' : `Avalanche saves ${money(sb.interest - a.interest, { maximumFractionDigits: 0 })} vs snowball.`}</p>` : ''}
    <div class="section-title">Payoff order<span class="small" style="text-transform:none">${money(totalBal, { maximumFractionDigits: 0 })} · ${money(totalMin, { maximumFractionDigits: 0 })}/mo min</span></div>
    <div class="card flush">${(cur ? [...[...cur.debts].sort((x, y) => (x.paidOff || 999) - (y.paidOff || 999)), ...debts.filter((d) => !(d.balance > 0))] : debts).map((d, i) => `<button class="row tap" style="width:100%;text-align:left" data-action="debt-edit" data-id="${d.id}">
      <div class="avatar" style="font-weight:800">${i + 1}</div>
      <div class="grow"><div class="title">${esc(d.name)}</div><div class="sub">${money(d.balance || 0, { maximumFractionDigits: 0 })} · ${d.apr ?? '?'}% APR · ${money(d.min || 0, { maximumFractionDigits: 0 })}/mo</div></div>
      <span class="small" style="text-align:right">${d.paidOff ? `Paid off<br><b>${parse(addMonths(monthKey(today()), d.paidOff) + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</b>` : ''}</span></button>`).join('')}</div>
    ${importable.length ? `<button class="btn secondary block" data-action="debt-import">Import ${importable.length} more from bills</button>` : ''}
    <button class="fab" data-action="debt-new" aria-label="Add debt">${ICON.plus}</button>`;
};
function debtForm(d) {
  const isNew = !d;
  openSheet({
    title: isNew ? 'Add a debt' : d.name,
    values: d || {},
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Chase Visa' },
      { row: [{ name: 'balance', label: 'Balance owed', type: 'money', required: true }, { name: 'apr', label: 'Interest rate (APR %)', type: 'money', placeholder: 'e.g. 24.99' }] },
      { name: 'min', label: 'Minimum payment / month', type: 'money', required: true },
    ],
    onSave(v) { if (isNew) state.debts.push({ id: uid(), ...v }); else Object.assign(d, v); },
    onDelete: isNew ? null : () => withUndo(`${d.name} removed`, () => { state.debts = state.debts.filter((x) => x.id !== d.id); }),
  });
}

/* =========================================================
   Subscription audit + bill price-change tracking
   ========================================================= */
const SUB_RE = /netflix|hulu|disney|spotify|\bapple (one|music|tv|arcade)|youtube|\bprime\b|\bmax\b|hbo|paramount|peacock|openai|chatgpt|cricut|rocket money|planet fitness|\bgym\b|xbox|playstation|nintendo|audible|kindle|icloud|google (one|play|storage)|\bring\b|\bcove\b|adobe|microsoft|dropbox|duolingo|\bcalm\b|headspace|sirius|patreon|hiya/i;
const STREAMING_RE = /netflix|hulu|disney|youtube|\bmax\b|hbo|paramount|peacock|apple tv|prime video|spotify|sirius/i;
const isSub = (b) => b.type !== 'income' && (b.group === 'Subscriptions' || SUB_RE.test(b.name)) && !/mortgage|insurance|energy|electric|water|loan|credit|finance|card|discover|visa|mastercard|amex|bank/i.test(b.name);
views.subs = () => {
  const subs = state.budget.bills.filter(isSub).sort((a, b) => perMonth(b) - perMonth(a));
  if (!subs.length) return `<div class="card empty"><span class="big">🔁</span>No subscriptions yet. Add them under Budget → Recurring (group “Subscriptions”).</div>`;
  const mo = sum(subs, perMonth), flagged = subs.filter((b) => b.review === 'cancel');
  const streaming = subs.filter((b) => STREAMING_RE.test(b.name));
  const hikes = subs.filter((b) => (b.priceHistory || []).length);
  return `
    <div class="card sub-hero">
      <div class="grid2" style="margin:0"><div><div class="stat-label">Per month</div><div class="stat">${money(mo)}</div></div><div><div class="stat-label">Per year</div><div class="stat">${money(mo * 12, { maximumFractionDigits: 0 })}</div></div></div>
      ${flagged.length ? `<div class="allowance" style="margin-top:12px">✂️ Cancelling ${flagged.length} flagged would save <b>${money(sum(flagged, perMonth) * 12, { maximumFractionDigits: 0 })}/year</b></div>` : ''}
    </div>
    ${streaming.length >= 2 ? `<div class="insight warn" style="max-width:none;margin-bottom:12px"><span class="ii">📺</span><b>${streaming.length} streaming services · ${money(sum(streaming, perMonth))}/mo</b><small>${streaming.map((b) => b.name).join(', ')} — rotate them?</small></div>` : ''}
    ${hikes.map((b) => { const h = b.priceHistory.at(-1), up = h.to > h.from, diff = Math.abs(h.to - h.from), yr = perMonth({ freq: b.freq, amount: diff }) * 12; return `<div class="insight ${up ? 'bad' : 'good'}" style="max-width:none;margin-bottom:12px"><span class="ii">${up ? '📈' : '📉'}</span><b>${esc(b.name)} went ${up ? 'up' : 'down'} ${money(diff)}</b><small>${money(h.from)} → ${money(h.to)} on ${fmtDate(h.date, { month: 'short', day: 'numeric' })} · ${money(yr)}/yr ${up ? 'more' : 'saved'}</small></div>`; }).join('')}
    <div class="section-title">All subscriptions</div>
    <div class="card flush">${subs.map((b) => `<div class="row">
      ${letterAvatar(b.name)}
      <button class="grow" style="text-align:left" data-action="edit-bill" data-id="${b.id}"><div class="title">${esc(b.name)}</div><div class="sub">${money(b.amount)} ${b.freq === 'monthly' ? '/mo' : FREQ_NAMES[b.freq].toLowerCase()} · ${money(perMonth(b) * 12, { maximumFractionDigits: 0 })}/yr${b.since ? ` · since ${fmtDate(b.since, { month: 'short', year: 'numeric' })}` : ''}</div></button>
      <button class="pill ${b.review === 'cancel' ? 'bad' : b.review === 'keep' ? 'good' : ''}" data-action="sub-review" data-id="${b.id}">${b.review === 'cancel' ? '✂️ Cancel' : b.review === 'keep' ? '👍 Keep' : 'Review'}</button>
    </div>`).join('')}</div>
    <p class="small muted" style="margin:10px 4px">Tap <b>Review</b> to mark each one Keep or Cancel. Price changes are tracked automatically when you edit an amount.</p>`;
};
// Track price changes on recurring items whenever this phone saves.
let billAmounts = new Map(state.budget.bills.map((b) => [b.id, b.amount]));
const _onLocalSave = onLocalSave;
onLocalSave = function () {
  let changed = false;
  for (const b of state.budget.bills) {
    const was = billAmounts.get(b.id);
    if (was != null && was !== b.amount && !b.varies) { (b.priceHistory ||= []).push({ date: today(), from: was, to: b.amount }); changed = true; }
  }
  billAmounts = new Map(state.budget.bills.map((b) => [b.id, b.amount]));
  if (changed) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
  _onLocalSave();
};
const _activityResync = activityResync;
activityResync = function () { billAmounts = new Map(state.budget.bills.map((b) => [b.id, b.amount])); _activityResync(); };

/* =========================================================
   Grouped More grid, Home blocks, actions
   ========================================================= */
moreGrid = function () {
  const tile = (to, emoji, label, sub, extra = '') => `<button class="card mini-tile" data-action="go" data-to="${to}" ${extra}><div class="emoji">${emoji}</div><b>${label}</b><div class="small muted">${sub}</div></button>`;
  const choresDue = state.chores.filter((c) => !choreDone(c)).length;
  const upkeepDue = state.maintenance.filter((u) => upkeepStatus(u).key === 'overdue').length;
  const subs = state.budget.bills.filter(isSub);
  return `
    <div class="more-label">Family</div>
    <div class="grid3">
      ${tile('kids', '🧒', 'Kids', kids().length ? `${kids().length} kid${kids().length > 1 ? 's' : ''}` : 'Set up')}
      ${tile('chores', '🧹', 'Chores', choresDue ? `${choresDue} to do` : 'All done')}
      ${tile('routines', '🌅', 'Routines', `${state.routines.length || 'None'}`)}
      ${tile('meals', '🍽️', 'Meals', 'Weekly plan')}
      ${tile('board', '📌', 'Fridge', state.board.length ? `${state.board.length} posts` : 'Notes & polls')}
      ${tile('packing', '🧳', 'Packing', state.trips.length ? `${state.trips.length} trip${state.trips.length > 1 ? 's' : ''}` : 'Trip lists')}
      ${tile('activity', '📰', 'Activity', 'Who did what')}
      ${tile('wrapped', '🎬', 'Wrapped', 'Monthly recap')}
      ${tile('chores', '🏆', 'Rewards', 'Points store', 'data-ctab="rewards"')}
    </div>
    <div class="more-label">Money</div>
    <div class="grid3">
      ${tile('goals', '🎯', 'Goals', state.goals.length ? `${money(sum(state.goals, goalSaved), { maximumFractionDigits: 0 })}` : 'Start saving')}
      ${tile('debts', '💳', 'Debt plan', state.debts.length ? `${money(sum(state.debts, (d) => d.balance), { maximumFractionDigits: 0 })}` : 'Payoff date')}
      ${tile('subs', '🔁', 'Subscriptions', subs.length ? `${money(sum(subs, perMonth), { maximumFractionDigits: 0 })}/mo` : 'Audit')}
    </div>
    <div class="more-label">House</div>
    <div class="grid3">
      ${tile('projects', '🏡', 'Projects', `${state.projects.filter((p) => p.status !== 'done').length || 'Plan one'}`)}
      ${tile('upkeep', '🔧', 'Upkeep', upkeepDue ? `${upkeepDue} overdue` : 'House care')}
      ${tile('binder', '📒', 'Binder', 'Info & contacts')}
    </div>`;
};
const _homeActivity = homeActivity;
homeActivity = function () { return boardHomeBlock() + tripsHomeBlock() + _homeActivity(); };
HOME_SECTIONS.splice(HOME_SECTIONS.findIndex(([id]) => id === 'countdowns'), 0, ['board', '📌 Fridge board']);
HOME_SECTIONS.splice(HOME_SECTIONS.findIndex(([id]) => id === 'activity'), 0, ['trips', '🧳 Packing']);

Object.assign(actions, {
  'note-new': () => openSheet({
    title: '📝 New note',
    saveLabel: 'Post',
    values: { color: 'yellow' },
    fields: [
      { name: 'text', label: 'Note', type: 'textarea', required: true, placeholder: 'e.g. Picture day Friday! 📸' },
      { type: 'html', html: `<div class="swatches note-sw">${Object.entries(NOTE_COLORS).map(([k, c]) => `<label><input type="radio" name="color" value="${k}" ${k === 'yellow' ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>` },
      ...(typeof inKidMode === 'function' && inKidMode() ? [] : [{ name: 'pinned', label: '📌 Pin to the top', type: 'checkbox' }]),
    ],
    onSave(v) { const color = $('#sheetForm').elements.color?.value || 'yellow'; state.board.push({ id: uid(), type: 'note', at: Date.now(), who: actor(), text: v.text, color, pinned: !!v.pinned, reactions: {} }); },
  }),
  'poll-new': () => openSheet({
    title: '🗳️ New poll',
    saveLabel: 'Post',
    values: {},
    fields: [
      { name: 'q', label: 'Question', required: true, placeholder: 'e.g. Pizza or tacos tonight?' },
      { name: 'opts', label: 'Choices (one per line)', type: 'textarea', required: true, placeholder: '🍕 Pizza\n🌮 Tacos' },
    ],
    onSave(v) {
      const opts = String(v.opts).split('\n').map((x) => x.trim()).filter(Boolean);
      if (opts.length < 2) { toast('Add at least two choices'); return false; }
      state.board.push({ id: uid(), type: 'poll', at: Date.now(), who: actor(), text: v.q, options: opts.map((t) => ({ id: uid(), text: t })), votes: {}, reactions: {} });
    },
  }),
  'vote': (el) => {
    const p = findIn(state.board, el.dataset.id); const me = actor() || 'anon';
    p.votes ||= {};
    if (p.votes[me] === el.dataset.o) delete p.votes[me]; else p.votes[me] = el.dataset.o;
    save(); render();
  },
  'react': (el) => {
    const n = findIn(state.board, el.dataset.id); const me = actor() || 'anon'; const e = el.dataset.e;
    n.reactions ||= {}; const r = (n.reactions[e] ||= {});
    if (r[me]) delete r[me]; else r[me] = true;
    save(); render();
  },
  'note-del': (el) => withUndo('Removed from the fridge', () => { state.board = state.board.filter((x) => x.id !== el.dataset.id); }),
  'poll-close': (el) => { const p = findIn(state.board, el.dataset.id); p.closed = !p.closed; save(); render(); },
  'trip-new': () => tripForm(null),
  'trip-edit': (el) => tripForm(findIn(state.trips, el.dataset.id)),
  'trip-toggle': (el) => {
    const t = findIn(state.trips, el.dataset.t), i = findIn(t.items, el.dataset.id);
    i.done = !i.done;
    if (tripStats(t).pct === 1) { setTimeout(confetti, 100); toast(`🧳 ${t.name}: all packed!`); }
    save(); render();
  },
  'trip-del-item': (el) => { const t = findIn(state.trips, el.dataset.t); t.items = t.items.filter((x) => x.id !== el.dataset.id); save(); render(); },
  'debt-new': () => debtForm(null),
  'debt-edit': (el) => debtForm(findIn(state.debts, el.dataset.id)),
  'debt-strat': (el) => { state.settings.debtStrategy = el.dataset.s; save(); render(); },
  'debt-import': () => {
    const importable = state.budget.bills.filter((b) => (b.group === 'Debt' || /credit|card|loan|finance|amex|chase|discover|capital one|credit union/i.test(b.name)) && b.type !== 'income' && !state.debts.some((d) => d.billId === b.id));
    for (const b of importable) state.debts.push({ id: uid(), billId: b.id, name: b.name, balance: null, apr: null, min: Math.round(perMonth(b) * 100) / 100 });
    save(); render(); toast(`Imported ${importable.length} — now add each balance & APR`);
  },
  'sub-review': (el) => { const b = findIn(state.budget.bills, el.dataset.id); b.review = !b.review ? 'keep' : b.review === 'keep' ? 'cancel' : ''; save(); render(); },
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit="trip-item"]');
  if (!form) return;
  e.preventDefault();
  const text = form.elements.tripItem.value.trim();
  if (!text) return;
  const t = findIn(state.trips, form.dataset.t);
  t.items.push({ id: uid(), text, memberId: form.dataset.m || '', done: false });
  save(); render();
});
// Slider: update the label while dragging, recalculate when released.
document.addEventListener('input', (e) => {
  if (e.target.id === 'debtExtra') { const l = e.target.closest('.field')?.querySelector('label b'); if (l) l.textContent = money(Number(e.target.value), { maximumFractionDigits: 0 }); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'debtExtra') { state.settings.debtExtra = Number(e.target.value); save(); render(); }
});
