/* Savings goals, family binder, home upkeep, search and Home extras.
   Loaded after app.js and uses its globals (state, views, actions, openSheet, ...). */
'use strict';

const addMonthsTo = (s, n) => {
  const d = parse(s), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return iso(d);
};

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const bits = ['🎉', '✨', '💰', '🎊', '⭐'];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('span');
    s.textContent = bits[i % bits.length];
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 0.6 + 's';
    s.style.animationDuration = 1.8 + Math.random() * 1.2 + 's';
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}

/* =========================================================
   Savings goals
   ========================================================= */
const GOAL_EMOJI = ['🏖️', '🛟', '🚗', '🏠', '🎓', '💍', '🎄', '✈️', '🛋️', '👶', '🐶', '💻'];
const goalSaved = (g) => sum(g.contributions || [], (c) => c.amount);
function goalPlan(g) {
  const saved = goalSaved(g), target = Number(g.target) || 0;
  const left = Math.max(0, target - saved);
  const pct = target ? Math.min(1, saved / target) : 0;
  let perMonth = null, months = null;
  if (g.deadline && left > 0) {
    months = Math.max(1, Math.ceil(daysBetween(today(), g.deadline) / 30.44));
    perMonth = left / months;
  }
  return { saved, target, left, pct, perMonth, months };
}
function ring(pct, size = 64, stroke = 7, cls = '') {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return `<svg class="goal-ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="track"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="val" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

views.goals = () => {
  const goals = [...state.goals].sort((a, b) => (goalPlan(a).pct >= 1) - (goalPlan(b).pct >= 1) || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const total = sum(state.goals, goalSaved);
  return `
    ${goals.length ? `<div class="card" style="text-align:center"><div class="stat-label">Saved across all goals</div><div class="stat" style="font-size:32px">${money(total, { maximumFractionDigits: 0 })}</div></div>` : ''}
    ${goals.map((g) => {
      const pl = goalPlan(g);
      const done = pl.pct >= 1;
      return `<div class="card">
        <button class="tile" style="display:flex;gap:14px;align-items:center" data-action="go" data-to="goal/${g.id}">
          <div class="ring-box">${ring(pl.pct, 64, 7, done ? 'done' : '')}<span>${esc(g.emoji || '🎯')}</span></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:17px">${esc(g.name)}</div>
            <div class="small"><b>${money(pl.saved, { maximumFractionDigits: 0 })}</b> <span class="muted">of ${money(pl.target, { maximumFractionDigits: 0 })} · ${Math.round(pl.pct * 100)}%</span></div>
            <div class="small muted">${done ? '🎉 Goal reached!' : pl.perMonth != null ? `Save ${money(pl.perMonth, { maximumFractionDigits: 0 })}/mo to finish by ${fmtDate(g.deadline, { month: 'short', year: 'numeric' })}` : `${money(pl.left, { maximumFractionDigits: 0 })} to go`}</div>
          </div>
        </button>
        ${done ? '' : `<button class="btn secondary block" style="margin-top:12px" data-action="goal-add" data-id="${g.id}">＋ Add money</button>`}
      </div>`;
    }).join('') || `<div class="card empty"><span class="big">🎯</span>Save up for the things that matter — a vacation, an emergency fund, a new car.<br>Track every deposit and see exactly how much to set aside each month.</div>`}
    <button class="fab" data-action="goal-new" aria-label="New goal">${ICON.plus}</button>
  `;
};

views.goal = (id) => {
  const g = state.goals.find((x) => x.id === id);
  if (!g) return '<div class="card empty">This goal was deleted.</div>';
  const pl = goalPlan(g);
  const list = [...(g.contributions || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  return `
    <div class="card" style="text-align:center">
      <div class="ring-box big">${ring(pl.pct, 150, 12, pl.pct >= 1 ? 'done' : '')}<span>${esc(g.emoji || '🎯')}<b>${Math.round(pl.pct * 100)}%</b></span></div>
      <div style="font-size:22px;font-weight:750;margin-top:6px">${esc(g.name)}</div>
      <div class="muted">${money(pl.saved)} of ${money(pl.target)}</div>
      ${g.deadline ? `<div class="small muted" style="margin-top:4px">Target date ${fmtDate(g.deadline, { month: 'long', day: 'numeric', year: 'numeric' })}</div>` : ''}
    </div>
    ${pl.pct < 1 ? `<div class="grid2">
      <div class="card"><div class="stat-label">Still to save</div><div class="stat">${money(pl.left, { maximumFractionDigits: 0 })}</div></div>
      <div class="card"><div class="stat-label">${pl.perMonth != null ? 'Per month' : 'Set a date'}</div><div class="stat">${pl.perMonth != null ? money(pl.perMonth, { maximumFractionDigits: 0 }) : '—'}</div><div class="small muted">${pl.months != null ? `for ${pl.months} month${pl.months > 1 ? 's' : ''}` : 'to get a monthly plan'}</div></div>
    </div>` : ''}
    <div class="btn-row">
      <button class="btn" data-action="goal-add" data-id="${g.id}">＋ Add money</button>
      <button class="btn secondary" data-action="goal-withdraw" data-id="${g.id}">− Take out</button>
    </div>
    <div class="section-title">History<button data-action="goal-edit" data-id="${g.id}">Edit goal</button></div>
    <div class="card flush">${list.map((c) => {
      const m = c.memberId ? member(c.memberId) : null;
      return `<button class="row tap" style="width:100%;text-align:left" data-action="goal-entry" data-g="${g.id}" data-id="${c.id}">
        <div class="grow"><div class="title">${esc(c.note || (c.amount >= 0 ? 'Deposit' : 'Withdrawal'))}</div><div class="sub">${fmtDate(c.date)}${m ? ` · ${esc(m.emoji)} ${esc(m.name)}` : ''}</div></div>
        <span class="amount ${c.amount >= 0 ? 'income' : ''}">${c.amount >= 0 ? '+' : '−'}${money(Math.abs(c.amount))}</span></button>`;
    }).join('') || '<div class="empty small">No deposits yet.</div>'}</div>
  `;
};

function goalForm(g) {
  const isNew = !g;
  openSheet({
    title: isNew ? 'New savings goal' : 'Edit goal',
    values: g ? { ...g, starting: null } : { emoji: '🏖️' },
    fields: [
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🎯' }, { name: 'name', label: 'Saving for', required: true, placeholder: 'e.g. Disney trip' }] },
      { type: 'html', html: `<div class="chips" style="margin-top:-6px">${GOAL_EMOJI.map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { row: [{ name: 'target', label: 'Goal amount', type: 'money', required: true, placeholder: '0.00' }, { name: 'deadline', label: 'By (optional)', type: 'date' }] },
      ...(isNew ? [{ name: 'starting', label: 'Already saved (optional)', type: 'money', placeholder: '0.00' }] : []),
    ],
    onSave(v) {
      const { starting, ...rest } = v;
      if (isNew) {
        const ng = { id: uid(), created: today(), contributions: [], ...rest };
        if (starting) ng.contributions.push({ id: uid(), date: today(), amount: starting, note: 'Starting balance', created: Date.now() });
        state.goals.push(ng);
        setTimeout(() => go('goal/' + ng.id));
      } else Object.assign(g, rest);
    },
    onDelete: isNew ? null : () => { withUndo(`${g.name} deleted`, () => { state.goals = state.goals.filter((x) => x.id !== g.id); }); go('goals'); },
  });
}
function goalMoneyForm(g, sign) {
  const before = goalPlan(g).pct;
  openSheet({
    title: sign > 0 ? `Add to ${g.name}` : `Take out of ${g.name}`,
    saveLabel: sign > 0 ? 'Add' : 'Take out',
    values: { date: today(), memberId: '' },
    fields: [
      { name: 'amount', label: 'Amount', type: 'money', required: true, placeholder: '0.00' },
      { name: 'note', label: 'Note', placeholder: sign > 0 ? 'e.g. Tax refund' : 'e.g. Paid for hotel' },
      { row: [{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'memberId', label: 'Who', type: 'select', options: [{ value: '', label: '—' }, ...memberOptions(false)] }] },
    ],
    onSave(v) {
      (g.contributions ||= []).push({ id: uid(), created: Date.now(), ...v, amount: Math.abs(v.amount) * sign });
      const after = goalPlan(g).pct;
      if (before < 1 && after >= 1) { setTimeout(confetti, 150); toast(`🎉 You reached your ${g.name} goal!`); }
      else if (sign > 0) toast(`${money(Math.abs(v.amount))} added · ${Math.round(after * 100)}% there`);
    },
  });
}

/* =========================================================
   Family binder
   ========================================================= */
const BINDER_SECTIONS = [
  ['emergency', '🚨', 'Emergency'], ['medical', '🩺', 'Medical'], ['home', '🏠', 'Home & Services'], ['auto', '🚗', 'Auto'],
  ['insurance', '🛡️', 'Insurance'], ['school', '🏫', 'School & Kids'], ['accounts', '📶', 'Wi-Fi & Codes'], ['other', '📝', 'Other'],
];
const BINDER_STARTERS = [
  { section: 'emergency', title: 'Poison Control', phone: '1-800-222-1222', details: 'Free, confidential, 24/7.' },
  { section: 'emergency', title: 'Emergency contact', details: 'Name:\nRelationship:' },
  { section: 'medical', title: 'Pediatrician', details: 'Doctor:\nOffice:\nAddress:' },
  { section: 'medical', title: 'Family doctor', details: 'Doctor:\nAddress:' },
  { section: 'medical', title: 'Dentist', details: '' },
  { section: 'home', title: 'Plumber', details: '' },
  { section: 'home', title: 'Electrician', details: '' },
  { section: 'home', title: 'Vet', details: 'Pet:\nClinic:' },
  { section: 'insurance', title: 'Car insurance', details: 'Company:\nPolicy #:\nRoadside assistance:' },
  { section: 'insurance', title: 'Home insurance', details: 'Company:\nPolicy #:' },
  { section: 'insurance', title: 'Health insurance', details: 'Plan:\nMember ID:\nGroup #:' },
  { section: 'school', title: 'School office', details: 'Teacher:\nPickup time:' },
  { section: 'accounts', title: 'Home Wi-Fi', details: 'Network:\nPassword:', secret: true },
  { section: 'accounts', title: 'Garage / door code', details: 'Code:', secret: true },
];
const telHref = (p) => 'tel:' + String(p).replace(/[^0-9+]/g, '');

views.binder = () => {
  const reveal = (ui.reveal ||= new Set());
  const bySec = {};
  for (const e of state.binder) (bySec[e.section] ||= []).push(e);
  const used = new Set(state.binder.map((e) => norm(e.title)));
  const starters = BINDER_STARTERS.filter((s) => !used.has(norm(s.title)));
  return `
    <p class="small muted" style="margin:0 4px 12px">Everything the family (or a babysitter) might need in a pinch. Mark something <b>private</b> to hide it until tapped.</p>
    ${BINDER_SECTIONS.filter(([k]) => bySec[k]).map(([k, emoji, label]) => `
      <div class="section-title">${emoji} ${label}</div>
      ${bySec[k].sort((a, b) => a.title.localeCompare(b.title)).map((e) => {
        const hidden = e.secret && !reveal.has(e.id);
        return `<div class="card binder-card">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;font-weight:700">${esc(e.title)}${e.secret ? ' <span class="pill">🔒 Private</span>' : ''}</div>
            <button class="mini-btn" data-action="binder-edit" data-id="${e.id}">Edit</button>
          </div>
          ${e.details ? (hidden
            ? `<button class="binder-hidden" data-action="binder-reveal" data-id="${e.id}">•••••••• Tap to show</button>`
            : `<div class="binder-details" ${e.secret ? `data-action="binder-reveal" data-id="${e.id}"` : ''}>${esc(e.details)}</div>`) : ''}
          ${e.phone || e.details ? `<div class="btn-row" style="margin:10px 0 0">
            ${e.phone ? `<a class="btn" style="flex:2;white-space:nowrap" href="${esc(telHref(e.phone))}">📞 ${esc(e.phone)}</a>` : ''}
            ${e.details && !hidden ? `<button class="btn secondary" data-action="binder-copy" data-id="${e.id}">Copy</button>` : ''}
          </div>` : ''}
        </div>`;
      }).join('')}`).join('') || `<div class="card empty"><span class="big">📒</span>Your family binder is empty.<br>Add doctors, insurance, Wi-Fi, emergency contacts and more.</div>`}
    ${starters.length ? `<div class="section-title">Quick add</div>
      <div class="chips">${starters.map((s) => `<button class="chip" data-action="binder-starter" data-title="${esc(s.title)}">+ ${esc(s.title)}</button>`).join('')}</div>` : ''}
    <button class="fab" data-action="binder-new" aria-label="Add">${ICON.plus}</button>
  `;
};

function binderForm(e, preset) {
  const isNew = !e;
  openSheet({
    title: isNew ? 'Add to binder' : 'Edit',
    values: e || { section: 'other', ...preset },
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Pediatrician' },
      { row: [
        { name: 'section', label: 'Section', type: 'select', options: BINDER_SECTIONS.map(([value, emoji, label]) => ({ value, label: `${emoji} ${label}` })) },
        { name: 'phone', label: 'Phone', type: 'tel', placeholder: 'Optional' },
      ] },
      { name: 'details', label: 'Details', type: 'textarea', placeholder: 'Names, addresses, account or policy numbers, hours…' },
      { name: 'secret', label: 'Private', type: 'checkbox', hint: 'Hide the details until tapped (passwords, codes)' },
    ],
    onSave(v) {
      v.updated = today();
      if (isNew) state.binder.push({ id: uid(), ...v });
      else Object.assign(e, v);
    },
    onDelete: isNew ? null : () => withUndo(`${e.title} deleted`, () => { state.binder = state.binder.filter((x) => x.id !== e.id); }),
  });
}

/* =========================================================
   Home upkeep (recurring maintenance)
   ========================================================= */
const UPKEEP_COMMON = [
  ['🌬️', 'Replace furnace / AC filter', 3], ['🔋', 'Test smoke & CO detectors', 6], ['🪫', 'Replace smoke detector batteries', 12],
  ['🍂', 'Clean gutters', 6], ['❄️', 'Service furnace / AC', 12], ['🚿', 'Flush water heater', 12], ['👕', 'Clean dryer vent', 12],
  ['💧', 'Replace fridge water filter', 6], ['🧊', 'Vacuum fridge coils', 12], ['🧯', 'Check fire extinguishers', 12],
  ['🌀', 'Reverse ceiling fans', 6], ['🧽', 'Clean dishwasher filter', 1], ['🚰', 'Clean range hood filter', 3], ['🪟', 'Check window & door seals', 12],
  ['🌱', 'Winterize outdoor faucets', 12], ['🚗', 'Rotate tires', 6],
];
const upkeepNext = (u) => (u.lastDone ? addMonthsTo(u.lastDone, Number(u.months) || 12) : null);
function upkeepStatus(u) {
  const next = upkeepNext(u);
  if (!next) return { next, n: null, key: 'new' };
  const n = daysBetween(today(), next);
  return { next, n, key: n < 0 ? 'overdue' : n <= 14 ? 'soon' : 'ok' };
}
const everyLabel = (m) => (m == 1 ? 'Monthly' : m == 12 ? 'Yearly' : m == 6 ? 'Every 6 months' : `Every ${m} months`);

function upkeepRow(u) {
  const st = upkeepStatus(u);
  const due = st.key === 'new' ? 'Tap ✓ the next time you do it'
    : st.key === 'overdue' ? `<span style="color:var(--bad);font-weight:600">Overdue · was due ${fmtDate(st.next, { month: 'short', day: 'numeric' })}</span>`
    : `Due ${relDays(st.n).toLowerCase()} · ${fmtDate(st.next, { month: 'short', day: 'numeric' })}`;
  return `<div class="row">
    <div class="avatar">${esc(u.emoji || '🔧')}</div>
    <button class="grow" style="text-align:left" data-action="upkeep-edit" data-id="${u.id}">
      <div class="title">${esc(u.title)}</div>
      <div class="sub">${everyLabel(u.months)}${u.lastDone ? ` · last ${fmtDate(u.lastDone, { month: 'short', day: 'numeric' })}` : ''}</div>
      <div class="sub">${due}</div>
    </button>
    <button class="check" data-action="upkeep-done" data-id="${u.id}" aria-label="Done today">${ICON.check}</button>
  </div>`;
}

views.upkeep = () => {
  const groups = { overdue: [], soon: [], new: [], ok: [] };
  for (const u of state.maintenance) groups[upkeepStatus(u).key].push(u);
  groups.ok.sort((a, b) => upkeepNext(a).localeCompare(upkeepNext(b)));
  groups.soon.sort((a, b) => upkeepNext(a).localeCompare(upkeepNext(b)));
  const sec = (title, list) => list.length ? `<div class="section-title">${title}</div><div class="card flush">${list.map(upkeepRow).join('')}</div>` : '';
  return `
    <p class="small muted" style="margin:0 4px 12px">Recurring jobs that keep the house running. Tap ✓ when it's done and the next due date is set for you.</p>
    ${state.maintenance.length ? '' : `<div class="card empty"><span class="big">🔧</span>Never forget a furnace filter again.<br><button class="btn" style="margin-top:12px" data-action="upkeep-common">Pick from common tasks</button></div>`}
    ${sec('⚠️ Needs attention', groups.overdue)}
    ${sec('Coming up', groups.soon)}
    ${sec('Not tracked yet', groups.new)}
    ${sec('All good', groups.ok)}
    ${state.maintenance.length ? `<div class="btn-row"><button class="btn secondary" data-action="upkeep-common">＋ Add common tasks</button></div>` : ''}
    <button class="fab" data-action="upkeep-new" aria-label="Add">${ICON.plus}</button>
  `;
};

function upkeepForm(u) {
  const isNew = !u;
  openSheet({
    title: isNew ? 'New upkeep task' : 'Edit task',
    values: u || { emoji: '🔧', months: 6 },
    fields: [
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🔧' }, { name: 'title', label: 'Task', required: true, placeholder: 'e.g. Clean gutters' }] },
      { row: [
        { name: 'months', label: 'Every (months)', type: 'number', required: true },
        { name: 'lastDone', label: 'Last done', type: 'date' },
      ] },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Filter size, where to buy, who to call…' },
    ],
    onSave(v) {
      v.months = Math.max(1, Math.round(v.months || 1));
      if (isNew) state.maintenance.push({ id: uid(), log: [], ...v });
      else Object.assign(u, v);
    },
    onDelete: isNew ? null : () => withUndo(`${u.title} deleted`, () => { state.maintenance = state.maintenance.filter((x) => x.id !== u.id); }),
  });
}

/* =========================================================
   Search
   ========================================================= */
views.search = () => `
  <div class="quick-add" style="margin-bottom:6px">
    <input type="search" id="searchInput" data-input="search" placeholder="Search everything…" value="${esc(ui.searchQ || '')}" autocomplete="off" enterkeyhint="search">
  </div>
  <div id="searchResults">${searchResults(ui.searchQ || '')}</div>
`;

function searchResults(q) {
  q = norm(q);
  if (q.length < 2) return `<p class="small muted" style="margin:10px 4px">Search expenses, events, shopping, gifts, projects, bills, meals, the binder and more.</p>`;
  const has = (...xs) => xs.some((x) => x != null && norm(x).includes(q));
  const groups = [];
  const add = (title, rows) => { if (rows.length) groups.push([title, rows]); };
  const row = (attrs, emoji, title, sub, right = '') => `<button class="row tap" style="width:100%;text-align:left" ${attrs}><div class="avatar">${emoji}</div><div class="grow"><div class="title">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>${right}</button>`;

  add('Spending', state.budget.transactions.filter((t) => has(t.note, category(t.categoryId).name, String(t.amount)))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
    .map((t) => row(`data-action="edit-tx" data-id="${t.id}"`, t.type === 'income' ? '💰' : esc(category(t.categoryId).emoji), t.note || category(t.categoryId).name, `${fmtDate(t.date, { month: 'short', day: 'numeric', year: 'numeric' })} · ${category(t.categoryId).name}`, `<span class="amount">${money(t.amount)}</span>`)));
  add('Recurring', state.budget.bills.filter((b) => has(b.name, b.group)).map((b) => row(`data-action="edit-bill" data-id="${b.id}"`, b.type === 'income' ? '💰' : '💳', b.name, scheduleLabel(b), `<span class="amount">${money(b.amount)}</span>`)));
  add('Calendar', state.events.filter((e) => has(e.title, e.location, e.notes)).slice(0, 8).map((e) => row(`data-action="edit-event" data-id="${e.id}"`, '📅', e.title, `${fmtDate(e.date, { month: 'short', day: 'numeric', year: 'numeric' })}${e.repeat && e.repeat !== 'none' ? ' · repeats' : ''}`)));
  add('Shopping', [
    ...state.shop.list.filter((i) => has(i.name, i.qty)).map((i) => row(`data-action="edit-item" data-id="${i.id}"`, i.done ? '✅' : '🛒', i.name, `On the list${i.qty ? ' · ' + i.qty : ''}`)),
    ...state.shop.staples.filter((s) => has(s.name, s.store)).map((s) => row(`data-action="edit-staple" data-id="${s.id}"`, '📦', s.name, `Staple · ${STAPLE_LABEL[s.status]}`)),
  ].slice(0, 8));
  add('People & gifts', [
    ...state.people.filter((p) => has(p.name, p.relationship, p.likes, p.notes, p.sizes)).map((p) => row(`data-action="go" data-to="person/${p.id}"`, esc(p.emoji || '🙂'), p.name, p.relationship || 'Gift list')),
    ...state.gifts.filter((g) => has(g.idea, g.store, g.notes)).map((g) => row(`data-action="edit-gift" data-id="${g.id}"`, '🎁', g.idea, `For ${person(g.personId)?.name || '—'} · ${g.occasion}`)),
  ].slice(0, 8));
  add('Projects', state.projects.filter((p) => has(p.name, p.room, p.notes, ...p.steps.map((s) => s.title), ...p.items.map((i) => i.name)))
    .map((p) => row(`data-action="go" data-to="project/${p.id}"`, esc(p.emoji || '🔨'), p.name, PROJECT_STATUS_LABEL[p.status])));
  add('Meals', Object.entries(state.meals).filter(([, m]) => has(m.dinner, m.ingredients, m.notes)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
    .map(([d, m]) => row(`data-action="edit-meal" data-date="${d}"`, '🍽️', m.dinner || 'Meal', fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' }))));
  add('Chores & upkeep', [
    ...state.chores.filter((c) => has(c.title)).map((c) => row(`data-action="edit-chore" data-id="${c.id}"`, '🧹', c.title, FREQ_LABEL[c.freq] || '')),
    ...state.maintenance.filter((u) => has(u.title, u.notes)).map((u) => row(`data-action="upkeep-edit" data-id="${u.id}"`, esc(u.emoji || '🔧'), u.title, everyLabel(u.months))),
  ]);
  add('Recipes', state.recipes.filter((r) => has(r.name, r.tags, r.ingredients)).map((r) => row(`data-action="go" data-to="recipe/${r.id}"`, esc(r.emoji || '📖'), r.name, `${splitList(r.ingredients).length} ingredients${r.tags ? ' · ' + r.tags : ''}`)));
  add('Goals', state.goals.filter((g) => has(g.name)).map((g) => row(`data-action="go" data-to="goal/${g.id}"`, esc(g.emoji || '🎯'), g.name, `${Math.round(goalPlan(g).pct * 100)}% saved`)));
  add('Binder', state.binder.filter((e) => has(e.title, e.phone, e.secret ? '' : e.details)).map((e) => row(`data-action="go" data-to="binder"`, (BINDER_SECTIONS.find((s) => s[0] === e.section) || [])[1] || '📝', e.title, e.phone || (e.secret ? 'Private' : (e.details || '').split('\n')[0]))));

  if (!groups.length) return `<div class="card empty"><span class="big">🔎</span>Nothing found for “${esc(q)}”.</div>`;
  return groups.map(([title, rows]) => `<div class="section-title">${title}</div><div class="card flush">${rows.join('')}</div>`).join('');
}

document.addEventListener('input', (e) => {
  if (e.target.matches?.('[data-input="search"]')) {
    ui.searchQ = e.target.value;
    $('#searchResults').innerHTML = searchResults(ui.searchQ);
  }
});

/* =========================================================
   Calendar, Home and navigation hooks
   ========================================================= */
function extraEventsOn(s) {
  const out = [];
  for (const u of state.maintenance) {
    if (upkeepNext(u) === s) out.push({ kind: 'upkeep', id: u.id, title: `${u.emoji || '🔧'} ${u.title}`, time: '', color: '#1aa3a3', who: EVERYONE });
  }
  for (const g of state.goals) {
    if (g.deadline === s && goalPlan(g).pct < 1) out.push({ kind: 'goal', id: g.id, title: `${g.emoji || '🎯'} ${g.name} goal date`, time: '', color: '#9b51e0', who: EVERYONE });
  }
  return out;
}

const WHATS_NEW = 'v2';
function whatsNewCard() {
  if (state.settings.whatsNewSeen === WHATS_NEW) return '';
  const item = (to, emoji, title, text, extra = '') => `<button class="row tap" style="width:100%;text-align:left;padding:10px 0" data-action="go" data-to="${to}" ${extra}><div class="avatar">${emoji}</div><div class="grow"><div class="title">${title}</div><div class="sub" style="white-space:normal">${text}</div></div>${ICON.chev}</button>`;
  return `<div class="card install-tip">
    <h3>✨ New in the app</h3>
    ${item('budget', '📊', 'Spending trends', 'Budget → Trends: 6-month chart & where it went', 'data-btab="trends"')}
    ${item('budget', '🤖', 'Smarter bills', 'Autopay logs itself; electric-style bills ask for the real amount', 'data-btab="bills"')}
    ${item('goals', '🎯', 'Savings goals', 'Save for trips, emergencies, anything')}
    ${item('upkeep', '🔧', 'Home upkeep', 'Filter changes, smoke detectors, gutters — reminded on time')}
    ${item('binder', '📒', 'Family binder', 'Doctors, insurance, Wi-Fi, emergency numbers')}
    ${item('meals', '📖', 'Recipe box', 'Save recipes, plan them, shop the ingredients', 'data-mtab="recipes"')}
    <div class="small muted" style="margin:6px 0 10px">Plus 🔎 search (top right) and quick-add buttons below.</div>
    <button class="btn secondary block" data-action="whats-new-ok">Got it</button>
  </div>`;
}

function homeQuickAdd() {
  return `${whatsNewCard()}<div class="quick-row">
    <button class="chip" data-action="add-tx"><span class="qi">💸</span>Expense</button>
    <button class="chip" data-action="quick-grocery"><span class="qi">🛒</span>Grocery</button>
    <button class="chip" data-action="add-event" data-date="${today()}"><span class="qi">📅</span>Event</button>
    <button class="chip" data-action="add-chore"><span class="qi">🧹</span>Chore</button>
  </div>`;
}

function homeExtras() {
  const t = today();
  const upkeep = state.maintenance.filter((u) => { const st = upkeepStatus(u); return st.key === 'overdue' || (st.key === 'soon' && st.n <= 7); });
  const active = state.projects.filter((p) => p.status === 'active');
  let html = '';
  if (upkeep.length) html += `<div class="section-title">Around the house<button data-action="go" data-to="upkeep">Upkeep</button></div><div class="card flush">${upkeep.map(upkeepRow).join('')}</div>`;
  if (active.length) html += `<div class="section-title">Projects in progress<button data-action="go" data-to="projects">All</button></div><div class="card flush">${active.map((p) => {
    const st = projectStats(p);
    return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="project/${p.id}"><div class="avatar">${esc(p.emoji || '🔨')}</div><div class="grow"><div class="title">${esc(p.name)}</div><div class="bar" style="margin-top:4px"><i style="width:${st.pct * 100}%"></i></div></div><span class="small muted">${Math.round(st.pct * 100)}%</span></button>`;
  }).join('')}</div>`;
  const goals = state.goals.filter((g) => goalPlan(g).pct < 1);
  if (goals.length) html += `<div class="section-title">Savings goals<button data-action="go" data-to="goals">All</button></div><div class="card flush">${goals.slice(0, 3).map((g) => {
    const pl = goalPlan(g);
    return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="goal/${g.id}"><div class="avatar">${esc(g.emoji || '🎯')}</div><div class="grow"><div class="title">${esc(g.name)}</div><div class="bar" style="margin-top:4px"><i style="width:${pl.pct * 100}%;background:var(--accent)"></i></div></div><span class="small muted">${money(pl.saved, { maximumFractionDigits: 0 })}</span></button>`;
  }).join('')}</div>`;
  void t;
  return html;
}

function moreGrid() {
  const choresDue = state.chores.filter((c) => !choreDone(c)).length;
  const openProjects = state.projects.filter((p) => p.status !== 'done').length;
  const upkeepDue = state.maintenance.filter((u) => upkeepStatus(u).key === 'overdue').length;
  const tile = (to, emoji, label, sub, alert) => `<button class="card mini-tile" data-action="go" data-to="${to}"><div class="emoji">${emoji}</div><b>${label}</b><div class="small ${alert ? '' : 'muted'}" style="${alert ? 'color:var(--bad);font-weight:600' : ''}">${sub}</div></button>`;
  return `<div class="grid3">
    ${tile('meals', '🍽️', 'Meals', 'Weekly plan')}
    ${tile('chores', '🧹', 'Chores', choresDue ? `${choresDue} to do` : 'All done')}
    ${tile('projects', '🏡', 'Projects', openProjects ? `${openProjects} open` : 'Plan one')}
    ${tile('goals', '🎯', 'Goals', state.goals.length ? `${money(sum(state.goals, goalSaved), { maximumFractionDigits: 0 })} saved` : 'Start saving')}
    ${tile('upkeep', '🔧', 'Upkeep', upkeepDue ? `${upkeepDue} overdue` : 'House care', upkeepDue)}
    ${tile('binder', '📒', 'Binder', 'Info & contacts')}
  </div>`;
}

Object.assign(TITLES, { goals: 'Savings Goals', goal: 'Savings Goal', binder: 'Family Binder', upkeep: 'Home Upkeep', search: 'Search' });

/* =========================================================
   Actions
   ========================================================= */
Object.assign(actions, {
  'goal-new': () => goalForm(null),
  'goal-edit': (el) => goalForm(findIn(state.goals, el.dataset.id)),
  'goal-add': (el) => goalMoneyForm(findIn(state.goals, el.dataset.id), 1),
  'goal-withdraw': (el) => goalMoneyForm(findIn(state.goals, el.dataset.id), -1),
  'goal-entry': (el) => {
    const g = findIn(state.goals, el.dataset.g);
    const c = findIn(g.contributions, el.dataset.id);
    openSheet({
      title: c.amount >= 0 ? 'Deposit' : 'Withdrawal',
      values: { ...c, amount: Math.abs(c.amount) },
      fields: [
        { name: 'amount', label: 'Amount', type: 'money', required: true },
        { name: 'note', label: 'Note' },
        { name: 'date', label: 'Date', type: 'date', required: true },
      ],
      onSave(v) { Object.assign(c, v, { amount: Math.abs(v.amount) * (c.amount >= 0 ? 1 : -1) }); },
      onDelete: () => withUndo('Entry deleted', () => { g.contributions = g.contributions.filter((x) => x.id !== c.id); }),
    });
  },

  'binder-new': () => binderForm(null),
  'binder-edit': (el) => binderForm(findIn(state.binder, el.dataset.id)),
  'binder-starter': (el) => { const s = BINDER_STARTERS.find((x) => x.title === el.dataset.title); binderForm(null, { ...s }); },
  'binder-reveal': (el) => { const r = (ui.reveal ||= new Set()); r.has(el.dataset.id) ? r.delete(el.dataset.id) : r.add(el.dataset.id); render(); },
  'binder-copy': (el) => {
    const e = findIn(state.binder, el.dataset.id);
    navigator.clipboard?.writeText([e.title, e.phone, e.details].filter(Boolean).join('\n')).then(() => toast('Copied'), () => toast('Could not copy'));
  },

  'upkeep-new': () => upkeepForm(null),
  'upkeep-edit': (el) => upkeepForm(findIn(state.maintenance, el.dataset.id)),
  'upkeep-done': (el) => {
    const u = findIn(state.maintenance, el.dataset.id);
    const t = today();
    (u.log ||= []).push(t);
    u.lastDone = t;
    save(); render();
    toast(`✓ ${u.title} · next due ${fmtDate(upkeepNext(u), { month: 'short', day: 'numeric', year: 'numeric' })}`);
  },
  'upkeep-common': () => {
    const have = new Set(state.maintenance.map((u) => norm(u.title)));
    const options = UPKEEP_COMMON.filter(([, title]) => !have.has(norm(title)));
    if (!options.length) { toast('You already have all the common tasks'); return; }
    openSheet({
      title: 'Common tasks',
      saveLabel: 'Add',
      values: {},
      fields: options.map(([emoji, title, months], i) => ({ name: 'u' + i, label: `${emoji} ${title}`, type: 'checkbox', hint: everyLabel(months) })),
      onSave(v) {
        let n = 0;
        options.forEach(([emoji, title, months], i) => { if (v['u' + i]) { state.maintenance.push({ id: uid(), emoji, title, months, lastDone: '', log: [] }); n++; } });
        if (!n) { toast('Tick the tasks you want to track'); return false; }
        toast(`Added ${n} task${n > 1 ? 's' : ''} — tap ✓ next time you do each one`);
      },
    });
  },

  'open-search': () => {
    if (location.hash !== '#search') history.pushState(null, '', '#search');
    render();
    window.scrollTo(0, 0);
    const input = $('#searchInput');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  },
  'quick-grocery': () => openSheet({
    title: 'Add to shopping list',
    saveLabel: 'Add',
    values: {},
    fields: [{ name: 'name', label: 'Item', required: true, placeholder: 'e.g. Milk', list: 'qgStaples' }, { type: 'html', html: `<datalist id="qgStaples">${state.shop.staples.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>` }],
    onSave(v) { if (addToList(v.name)) toast(`${v.name} added to the list 🛒`); },
  }),
});

/* =========================================================
   Recipe box
   ========================================================= */
const RECIPE_EMOJI = ['🌮', '🍝', '🍗', '🥩', '🍲', '🥗', '🍕', '🍔', '🐟', '🍳', '🥞', '🍰'];
TITLES.recipe = 'Recipe';

function mealsTabs() {
  const tab = ui.mealsTab || 'week';
  return `<div class="segmented">
    <button class="${tab === 'week' ? 'active' : ''}" data-action="meals-tab" data-tab="week">This week</button>
    <button class="${tab === 'recipes' ? 'active' : ''}" data-action="meals-tab" data-tab="recipes">Recipes (${state.recipes.length})</button>
  </div>`;
}

function recipesView() {
  const list = [...state.recipes].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name));
  const fromMeals = mealHistory().filter((h) => h.date && !state.recipes.some((r) => norm(r.name) === norm(h.name)));
  return `
    <div class="card flush">${list.map((r) => `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="recipe/${r.id}">
      <div class="avatar">${esc(r.emoji || '📖')}</div>
      <div class="grow"><div class="title">${r.favorite ? '⭐ ' : ''}${esc(r.name)}</div>
        <div class="sub">${[`${splitList(r.ingredients).length} ingredients`, r.minutes ? `${r.minutes} min` : '', r.tags].filter(Boolean).map(esc).join(' · ')}</div></div>${ICON.chev}
    </button>`).join('') || `<div class="empty"><span class="big">📖</span>Save the family favorites here.<br>Plan them for a night and send the ingredients to the shopping list in one tap.</div>`}</div>
    ${fromMeals.length ? `<button class="btn secondary block" data-action="recipes-import">📥 Save ${fromMeals.length} meal${fromMeals.length > 1 ? 's' : ''} from your plan as recipes</button>` : ''}
    <button class="fab" data-action="recipe-new" aria-label="Add recipe">${ICON.plus}</button>
  `;
}

views.recipe = (id) => {
  const r = state.recipes.find((x) => x.id === id);
  if (!r) return '<div class="card empty">This recipe was deleted.</div>';
  const ings = splitList(r.ingredients);
  const steps = String(r.steps || '').split('\n').map((x) => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  const planned = Object.entries(state.meals).filter(([d, m]) => d >= today() && (m.recipeId === r.id || norm(m.dinner) === norm(r.name))).map(([d]) => d).sort();
  return `
    <div class="card">
      <div style="display:flex;gap:14px;align-items:center">
        <div class="avatar" style="width:56px;height:56px;flex-basis:56px;font-size:30px">${esc(r.emoji || '📖')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:21px;font-weight:750;line-height:1.2">${esc(r.name)}</div>
          <div class="small muted">${[r.minutes ? `⏱ ${r.minutes} min` : '', r.servings ? `🍽 Serves ${r.servings}` : '', r.tags].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <button class="mini-btn" data-action="recipe-fav" data-id="${r.id}" aria-label="Favorite" style="font-size:22px">${r.favorite ? '⭐' : '☆'}</button>
      </div>
      ${planned.length ? `<div class="small" style="margin-top:10px">📅 Planned for ${planned.map((d) => fmtDate(d)).join(', ')}</div>` : ''}
    </div>
    <div class="btn-row">
      <button class="btn" data-action="recipe-plan" data-id="${r.id}">📅 Plan it</button>
      <button class="btn secondary" data-action="recipe-shop" data-id="${r.id}">🛒 Shop it</button>
    </div>
    <div class="section-title">Ingredients</div>
    <div class="card">${ings.length ? `<ul class="recipe-list">${ings.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<div class="small muted">No ingredients yet.</div>'}</div>
    ${steps.length ? `<div class="section-title">Steps</div><div class="card"><ol class="recipe-list steps">${steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
    ${r.link ? `<a class="btn secondary block" style="margin-bottom:12px" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">🔗 Open original recipe</a>` : ''}
    ${r.notes ? `<div class="card small" style="white-space:pre-wrap">${esc(r.notes)}</div>` : ''}
    <button class="btn secondary block" data-action="recipe-edit" data-id="${r.id}">Edit recipe</button>
  `;
};

function recipeForm(r) {
  const isNew = !r;
  openSheet({
    title: isNew ? 'New recipe' : 'Edit recipe',
    values: r || { emoji: '🍲' },
    fields: [
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🍲' }, { name: 'name', label: 'Recipe', required: true, placeholder: "e.g. Abuela's tamales" }] },
      { type: 'html', html: `<div class="chips" style="margin-top:-6px">${RECIPE_EMOJI.map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { row: [{ name: 'minutes', label: 'Time (min)', type: 'number', placeholder: '30' }, { name: 'servings', label: 'Serves', type: 'number', placeholder: '4' }] },
      { name: 'ingredients', label: 'Ingredients (one per line)', type: 'textarea', placeholder: '1 lb ground beef\nTaco shells\nShredded cheese' },
      { name: 'steps', label: 'Steps (one per line)', type: 'textarea', placeholder: 'Brown the beef\nAdd seasoning…' },
      { row: [{ name: 'tags', label: 'Tags', placeholder: 'e.g. Quick, Kids love it' }, { name: 'link', label: 'Link', type: 'url', placeholder: 'https://…' }] },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Tweaks, sides, who likes it…' },
      { name: 'favorite', label: '⭐ Family favorite', type: 'checkbox' },
    ],
    onSave(v) {
      if (isNew) { const nr = { id: uid(), ...v }; state.recipes.push(nr); setTimeout(() => go('recipe/' + nr.id)); }
      else Object.assign(r, v);
    },
    onDelete: isNew ? null : () => { withUndo(`${r.name} deleted`, () => { state.recipes = state.recipes.filter((x) => x.id !== r.id); }); ui.mealsTab = 'recipes'; go('meals'); },
  });
}

Object.assign(actions, {
  'whats-new-ok': () => { state.settings.whatsNewSeen = WHATS_NEW; save(); render(); },
  'meals-tab': (el) => { ui.mealsTab = el.dataset.tab; render(); },
  'recipe-new': () => recipeForm(null),
  'recipe-edit': (el) => recipeForm(findIn(state.recipes, el.dataset.id)),
  'recipe-fav': (el) => { const r = findIn(state.recipes, el.dataset.id); r.favorite = !r.favorite; save(); render(); },
  'recipe-shop': (el) => {
    const r = findIn(state.recipes, el.dataset.id);
    const n = splitList(r.ingredients).filter((x) => addToList(x, r.name, true)).length;
    toast(n ? `Added ${n} item${n > 1 ? 's' : ''} to the list 🛒` : 'Everything is already on the list');
    save();
  },
  'recipe-plan': (el) => {
    const r = findIn(state.recipes, el.dataset.id);
    const t = today();
    const free = [...Array(14)].map((_, i) => addDays(t, i)).find((d) => !state.meals[d]?.dinner) || t;
    openSheet({
      title: `Plan ${r.name}`,
      saveLabel: 'Plan',
      values: { date: free, shop: true },
      fields: [
        { name: 'date', label: 'Which night?', type: 'date', required: true },
        { name: 'shop', label: 'Add ingredients to shopping list', type: 'checkbox' },
      ],
      onSave(v) {
        const prev = state.meals[v.date]?.dinner;
        state.meals[v.date] = { ...(state.meals[v.date] || {}), dinner: r.name, ingredients: splitList(r.ingredients).join(', '), recipeId: r.id };
        const n = v.shop ? splitList(r.ingredients).filter((x) => addToList(x, r.name, true)).length : 0;
        toast(`${r.name} on ${fmtDate(v.date, { weekday: 'long' })}${prev && norm(prev) !== norm(r.name) ? ` (replaced ${prev})` : ''}${n ? ` · ${n} items to the list` : ''}`);
      },
    });
  },
  'recipes-import': () => {
    const fromMeals = mealHistory().filter((h) => h.date && !state.recipes.some((r) => norm(r.name) === norm(h.name)));
    for (const h of fromMeals) state.recipes.push({ id: uid(), emoji: '🍲', name: h.name, ingredients: splitList(h.ingredients).join('\n') });
    save(); render();
    toast(`Saved ${fromMeals.length} recipe${fromMeals.length > 1 ? 's' : ''} — tap one to add steps`);
  },
});
