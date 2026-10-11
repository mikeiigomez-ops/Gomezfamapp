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

const WHATS_NEW = 'v3';
function whatsNewCard() {
  if (state.settings.whatsNewSeen === WHATS_NEW) return '';
  const item = (attrs, emoji, title, text) => `<button class="row tap" style="width:100%;text-align:left;padding:10px 0;background:none" ${attrs}><div class="avatar">${emoji}</div><div class="grow"><div class="title">${title}</div><div class="sub" style="white-space:normal">${text}</div></div>${ICON.chev}</button>`;
  return `<div class="card install-tip">
    <h3>✨ The app got a makeover</h3>
    ${item('data-action="magic-add"', '✨', 'Magic Add', 'Type “$40 Costco” or “Dentist Fri 3pm” — it figures out the rest')}
    ${item('data-action="go" data-to="shop"', '🛍️', 'Store Mode', 'Big one-handed checklist, screen stays on, logs the receipt')}
    ${item('data-action="go" data-to="settings"', '🎨', 'Pick your color', 'Six accent themes in Settings — each phone can choose its own')}
    <div class="small muted" style="margin:8px 0 10px">Tip: swipe a list row <b>right</b> to check it off, <b>left</b> to delete. Drag any sheet down to close it.</div>
    <button class="btn secondary block" data-action="whats-new-ok">Got it</button>
  </div>`;
}

function homeQuickAdd() {
  return `${whatsNewCard()}<button class="magic-bar" data-action="magic-add"><span class="spark">✨</span><span class="grow">Add anything… <span class="muted">“$40 Costco”, “Dentist Fri 3pm”</span></span></button>
  <div class="quick-row">
    <button class="chip" data-action="add-tx"><span class="qi">💸</span>Expense</button>
    <button class="chip" data-action="quick-grocery"><span class="qi">🛒</span>Grocery</button>
    <button class="chip" data-action="add-event" data-date="${today()}"><span class="qi">📅</span>Event</button>
    <button class="chip" data-action="add-chore"><span class="qi">🧹</span>Chore</button>
  </div>${homeInsights()}`;
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

/* =========================================================
   ✨ Magic Add — type in plain English, we figure out what it is
   ========================================================= */
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CATEGORY_HINTS = [
  [/\b(costco|kroger|aldi|meijer|walmart|grocer|groceries|trader joe|whole foods|sam'?s|food)\b/, 'grocer'],
  [/\b(gas|shell|bp|speedway|fuel|uber|lyft|parking|toll|car wash)\b/, 'gas'],
  [/\b(restaurant|pizza|coffee|starbucks|chipotle|mcdonald|taco|dinner out|lunch|breakfast|takeout|doordash|ubereats|burger|sushi)\b/, 'dining'],
  [/\b(target|amazon|home depot|lowe'?s|household|cleaning|ikea)\b/, 'household'],
  [/\b(kid|school|daycare|soccer|toys?|diapers?)\b/, 'kids'],
  [/\b(movie|netflix|concert|zoo|game|fun|bowling)\b/, 'fun'],
  [/\b(doctor|pharmacy|cvs|walgreens|dentist|copay|health|medicine)\b/, 'health'],
  [/\b(electric|water|internet|phone bill|utility|utilities|dte|consumers)\b/, 'utilit'],
  [/\b(gift|present|birthday)\b/, 'gift'],
];
function guessCategory(text) {
  const n = norm(text);
  for (const [re, key] of CATEGORY_HINTS) {
    if (re.test(n)) { const c = state.budget.categories.find((c) => norm(c.name).includes(key)); if (c) return c; }
  }
  return state.budget.categories.find((c) => norm(c.name) === 'other') || state.budget.categories[0];
}

function parseWhen(text) {
  let t = ' ' + text + ' ', date = null, time = '';
  const base = today();
  const take = (re, fn) => { const m = t.match(re); if (m) { const r = fn(m); if (r !== false) t = t.replace(m[0], ' '); } };
  take(/\s(?:on\s)?(today|tonight)\s/i, (m) => { date = base; if (/tonight/i.test(m[1])) time = time || '19:00'; });
  take(/\s(?:on\s)?tomorrow\s/i, () => { date = addDays(base, 1); });
  take(/\s(?:on\s|this\s|next\s)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\s/i, (m) => {
    const wd = WEEKDAYS.findIndex((d) => d.startsWith(m[1].toLowerCase().slice(0, 3)));
    let d = (wd - parse(base).getDay() + 7) % 7; if (d === 0) d = 7;
    if (/next/i.test(m[0]) && d < 7) d += 7;
    date = addDays(base, d);
  });
  take(/\s(?:on\s)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/, (m) => {
    let y = m[3] ? +m[3] : parse(base).getFullYear(); if (y < 100) y += 2000;
    date = iso(new Date(y, +m[1] - 1, +m[2])); if (!m[3] && date < base) date = iso(new Date(y + 1, +m[1] - 1, +m[2]));
  });
  take(/\s(?:on\s)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s(\d{1,2})(?:st|nd|rd|th)?\s/i, (m) => {
    const y = parse(base).getFullYear(); const mo = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
    date = iso(new Date(y, mo, +m[2])); if (date < base) date = iso(new Date(y + 1, mo, +m[2]));
  });
  take(/\s(?:at\s|@\s?)?(\d{1,2})(?::(\d{2}))?\s?(am|pm|a|p)\s/i, (m) => {
    let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12;
    time = `${pad(h)}:${m[2] || '00'}`;
  });
  take(/\sat\s(\d{1,2}):(\d{2})\s/i, (m) => { time = `${pad(+m[1])}:${m[2]}`; });
  if (time && !date) date = base;
  return { date, time, rest: t.replace(/\s+/g, ' ').trim() };
}

function parseMagic(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const low = norm(text);
  // Chore
  let m = text.match(/^chore[:\s]+(.+)$/i);
  if (m) return { kind: 'chore', title: m[1].trim(), label: '🧹 New chore', detail: m[1].trim() };
  // Money: "$45 costco", "costco 45.20", "paid 30 for pizza", "income 500 side job"
  m = text.match(/\$\s?(\d+(?:[.,]\d{1,2})?)/) || text.match(/(?:^|\s)(\d+\.\d{2})(?:\s|$)/) || (/^(spent|paid|income|got paid|earned)\b/i.test(text) && text.match(/(?:^|\s)(\d+(?:\.\d{1,2})?)(?:\s|$)/));
  if (m) {
    const amount = parseFloat(m[1].replace(',', '.'));
    const income = /\b(income|paycheck|got paid|earned|refund|deposit|sold)\b/i.test(text);
    let note = text.replace(m[0], ' ').replace(/^\s*(spent|paid|income|got paid|earned)\b/i, ' ').replace(/\b(for|on|at)\s*$/i, '').replace(/^\s*(for|on|at)\b/i, '').replace(/\s+/g, ' ').trim();
    const when = parseWhen(note);
    note = when.rest.replace(/^(for|on|at)\s+/i, '');
    const cat = income ? null : guessCategory(note || text);
    const date = when.date && when.date <= today() ? when.date : (when.date === addDays(today(), -1) ? when.date : today());
    const yest = /\byesterday\b/i.test(text);
    return { kind: 'tx', type: income ? 'income' : 'expense', amount, note: cap(note.replace(/\byesterday\b/i, '').trim()), categoryId: cat?.id || '', date: yest ? addDays(today(), -1) : date,
      label: income ? `💰 Income · ${money(amount)}` : `💸 Expense · ${money(amount)}`, detail: [cap(note.replace(/\byesterday\b/i, '').trim()), cat ? `${cat.emoji} ${cat.name}` : '', yest ? 'Yesterday' : ''].filter(Boolean).join(' · ') };
  }
  // Event: has a date or time
  const when = parseWhen(text);
  if (when.date && when.rest) {
    return { kind: 'event', title: cap(when.rest.replace(/^(add|schedule|remind me( to)?)\s+/i, '')), date: when.date, time: when.time,
      label: '📅 Calendar event', detail: `${fmtDate(when.date, { weekday: 'long', month: 'short', day: 'numeric' })}${when.time ? ' · ' + fmtTime(when.time) : ''}` };
  }
  // Shopping: "buy …", "need …", "get …", or a comma list
  m = text.match(/^(buy|need|get|pick up|grab|add)\s+(.+)$/i);
  const listText = m ? m[2] : (text.includes(',') ? text : null);
  if (listText) {
    const items = listText.split(/,|\band\b/).map((x) => x.trim()).filter(Boolean);
    return { kind: 'shop', items, label: `🛒 Shopping list · ${items.length} item${items.length > 1 ? 's' : ''}`, detail: items.join(', ') };
  }
  // A single word or two that matches a staple → shopping
  if (low.split(' ').length <= 3) return { kind: 'shop', items: [text], label: '🛒 Shopping list', detail: text };
  return { kind: 'event', title: cap(text), date: today(), time: '', label: '📅 Calendar event (today)', detail: 'Add a day or time to schedule it, e.g. “Friday 3pm”' };
}

function magicPreview(r) {
  if (!r) return `<div class="magic-hint">
      <div><b>Try:</b></div>
      <button type="button" class="chip" data-action="magic-example">$42 Costco</button>
      <button type="button" class="chip" data-action="magic-example">Dentist Friday 3pm</button>
      <button type="button" class="chip" data-action="magic-example">milk, eggs, bread</button>
      <button type="button" class="chip" data-action="magic-example">chore: take out trash</button>
      <button type="button" class="chip" data-action="magic-example">paid 18.50 for pizza yesterday</button>
    </div>`;
  return `<div class="magic-card"><div class="magic-label">${esc(r.label)}</div>${r.detail ? `<div class="magic-detail">${esc(r.detail)}</div>` : ''}<div class="small muted" style="margin-top:6px">Tap <b>Add</b> to save — you can edit it anytime.</div></div>`;
}

function openMagic() {
  openSheet({
    title: '✨ Magic Add',
    saveLabel: 'Add',
    values: {},
    fields: [
      { name: 'q', label: 'What do you want to add?', placeholder: 'Type anything…' },
      { type: 'html', html: `<div id="magicPreview">${magicPreview(null)}</div>` },
    ],
    onInput(form, e) { if (e.target.name === 'q') $('#magicPreview').innerHTML = magicPreview(parseMagic(e.target.value)); },
    onSave(v) {
      const r = parseMagic(v.q);
      if (!r) { toast('Type something to add'); return false; }
      if (r.kind === 'tx') {
        state.budget.transactions.push({ id: uid(), created: Date.now(), type: r.type, amount: r.amount, note: r.note, categoryId: r.categoryId, date: r.date, memberId: '' });
        toast(`${r.type === 'income' ? '💰' : '💸'} ${money(r.amount)} logged${r.categoryId ? ' to ' + category(r.categoryId).name : ''}`);
      } else if (r.kind === 'event') {
        state.events.push({ id: uid(), title: r.title, date: r.date, time: r.time, repeat: 'none', memberId: '' });
        toast(`📅 ${r.title} · ${fmtDate(r.date)}`);
      } else if (r.kind === 'shop') {
        const n = r.items.filter((x) => addToList(x, '', true)).length;
        toast(n ? `🛒 Added ${n} to the list` : 'Already on the list');
      } else if (r.kind === 'chore') {
        state.chores.push({ id: uid(), title: cap(r.title), memberId: '', freq: 'once', points: 1, log: [] });
        toast(`🧹 Chore added: ${cap(r.title)}`);
      }
    },
  });
  // Focus synchronously inside the tap so iOS opens the keyboard.
  $('#sheetForm [name="q"]')?.focus();
}

Object.assign(actions, {
  'magic-add': openMagic,
  'magic-example': (el) => {
    const input = $('#sheetForm [name="q"]');
    input.value = el.textContent;
    $('#magicPreview').innerHTML = magicPreview(parseMagic(input.value));
    input.focus();
  },
});

/* =========================================================
   🛍️ Store mode — big, one-handed checklist for the actual trip
   ========================================================= */
TITLES.store = 'Store Mode';
let wakeLock = null;
async function setWakeLock(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && currentRoute().name === 'store') setWakeLock(true); });

views.store = () => {
  const items = state.shop.list;
  const open = items.filter((i) => !i.done), done = items.filter((i) => i.done);
  const total = items.length;
  const pct = total ? done.length / total : 0;
  const groups = {};
  for (const i of open) (groups[i.aisle || 'Other'] ||= []).push(i);
  const order = Object.keys(groups).sort((a, b) => AISLES.indexOf(a) - AISLES.indexOf(b));
  const est = sum(open, (i) => stapleByName(i.name)?.price);
  const row = (i) => `<button class="store-row${i.done ? ' got' : ''}" data-action="toggle-item" data-id="${i.id}">
      <span class="check${i.done ? ' on' : ''}">${ICON.check}</span>
      <span class="grow"><b>${esc(i.name)}</b>${i.qty ? `<small>${esc(i.qty)}</small>` : ''}</span>
    </button>`;
  return `
    <div class="store-progress card">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div class="stat">${done.length}<span class="muted" style="font-size:18px;font-weight:600"> / ${total}</span></div>
        <div class="small muted">${open.length ? `${open.length} to go${est ? ` · ≈ ${money(est, { maximumFractionDigits: 0 })}` : ''}` : 'Everything’s in the cart 🎉'}</div>
      </div>
      <div class="bar" style="height:10px;margin-top:10px"><i style="width:${pct * 100}%"></i></div>
      <div class="small muted" style="margin-top:8px">🔆 Screen stays on while you shop</div>
    </div>
    ${order.map((a) => `<div class="section-title">${esc(a)}</div><div class="store-list">${groups[a].map(row).join('')}</div>`).join('')}
    ${!total ? `<div class="card empty"><span class="big">🛒</span>Your list is empty.</div>` : ''}
    ${done.length ? `<div class="section-title">In the cart</div><div class="store-list">${done.map(row).join('')}</div>` : ''}
    ${total ? `<div class="store-finish"><button class="btn block" data-action="store-finish">${open.length ? 'Finish trip' : '✓ Finish trip'}</button></div>` : ''}
  `;
};

Object.assign(actions, {
  'store-finish': () => {
    const got = state.shop.list.filter((i) => i.done);
    const est = sum(got, (i) => stapleByName(i.name)?.price);
    const groceries = state.budget.categories.find((c) => norm(c.name).includes('grocer'));
    openSheet({
      title: 'Finish trip',
      saveLabel: 'Done',
      values: { amount: est ? Math.round(est * 100) / 100 : null, store: '', clear: true },
      fields: [
        { name: 'amount', label: 'Receipt total (optional)', type: 'money', placeholder: 'Logs it to your budget' },
        { name: 'store', label: 'Store', placeholder: 'e.g. Costco' },
        { name: 'clear', label: `Clear the ${got.length} item${got.length === 1 ? '' : 's'} in the cart`, type: 'checkbox', hint: 'Staples are marked stocked' },
      ],
      onSave(v) {
        if (v.amount) state.budget.transactions.push({ id: uid(), created: Date.now(), type: 'expense', amount: v.amount, note: v.store || 'Grocery trip', categoryId: groceries?.id || '', date: today(), memberId: '' });
        if (v.clear) {
          for (const i of got) { const s = stapleByName(i.name); if (s) { s.status = 'ok'; s.lastBought = today(); } }
          state.shop.list = state.shop.list.filter((i) => !i.done);
        }
        toast(v.amount ? `🛍️ Trip logged · ${money(v.amount)}` : '🛍️ Trip done');
        setWakeLock(false);
        setTimeout(() => go('shop'));
      },
    });
  },
});

// Store mode hides the tab bar and keeps the screen awake.
const _afterRenderBase = afterRender;
afterRender = function () {
  _afterRenderBase();
  const inStore = currentRoute().name === 'store';
  document.body.classList.toggle('store-mode', inStore);
  setWakeLock(inStore);
};

/* =========================================================
   🌤️ Weather (Open-Meteo, free, no key). Opt-in; location stays on this phone.
   ========================================================= */
const WX_KEY = 'gomezfam:wx';
const WX_TTL = 30 * 60 * 1000;
function wxIcon(code, night) {
  if (code === 0) return night ? '🌙' : '☀️';
  if (code <= 2) return night ? '☁️' : '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}
function wxLabel(code) {
  return code === 0 ? 'Clear' : code <= 2 ? 'Partly cloudy' : code === 3 ? 'Cloudy' : code <= 48 ? 'Foggy' : code <= 57 ? 'Drizzle' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : code <= 86 ? 'Snow showers' : 'Storms';
}
const wxCache = () => { try { return JSON.parse(localStorage.getItem(WX_KEY)); } catch { return null; } };
let wxLoading = false;
async function loadWeather(force) {
  const loc = state.settings.weather;
  if (!loc || wxLoading) return;
  const c = wxCache();
  if (!force && c && Date.now() - c.t < WX_TTL && c.lat === loc.lat && c.lon === loc.lon) return;
  wxLoading = true;
  try {
    const unit = loc.unit === 'C' ? 'celsius' : 'fahrenheit';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${unit}&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather ' + res.status);
    const data = await res.json();
    localStorage.setItem(WX_KEY, JSON.stringify({ t: Date.now(), lat: loc.lat, lon: loc.lon, data }));
    if (currentRoute().name === 'home') render();
  } catch (e) { console.warn('weather', e); }
  finally { wxLoading = false; }
}
function wxForDay(d) {
  const c = wxCache();
  if (!c || !state.settings.weather) return null;
  const i = (c.data.daily?.time || []).indexOf(d);
  if (i < 0) return null;
  const dl = c.data.daily;
  return { code: dl.weather_code[i], hi: Math.round(dl.temperature_2m_max[i]), lo: Math.round(dl.temperature_2m_min[i]), rain: dl.precipitation_probability_max?.[i] };
}
function heroWeather() {
  if (!state.settings.weather) return navigator.geolocation ? `<button class="hero-wx-add" data-action="wx-enable">＋ Add local weather</button>` : '';
  loadWeather();
  const c = wxCache();
  if (!c?.data?.current) return `<div class="hero-wx">Loading weather…</div>`;
  const cur = c.data.current, d = wxForDay(today());
  const u = state.settings.weather.unit === 'C' ? '°' : '°';
  return `<button class="hero-wx" data-action="wx-settings">
    <span class="wx-now">${wxIcon(cur.weather_code, cur.is_day === 0)} ${Math.round(cur.temperature_2m)}${u}</span>
    <span>${wxLabel(cur.weather_code)}${d ? ` · H ${d.hi}${u} L ${d.lo}${u}` : ''}${d && d.rain >= 20 ? ` · ☔ ${d.rain}%` : ''}</span>
  </button>`;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadWeather(); });

/* =========================================================
   This week strip (Home)
   ========================================================= */
function weekStrip() {
  const t = today();
  const days = [...Array(7)].map((_, i) => addDays(t, i));
  return `<div class="section-title">This week<button data-action="go" data-to="calendar">Calendar</button></div>
  <div class="week-strip">${days.map((d) => {
    const evs = eventsOn(d).filter((e) => e.kind !== 'holiday' && e.kind !== 'bill');
    const bills = recurringBetween(d, d, 'bill').filter((x) => !isPaid(x.b, x.date));
    const pay = recurringBetween(d, d, 'income').length;
    const hol = eventsOn(d).find((e) => e.kind === 'holiday');
    const dinner = state.meals[d]?.dinner;
    const w = wxForDay(d);
    return `<button class="wday${d === t ? ' today' : ''}" data-action="week-day" data-date="${d}">
      <div class="wday-top"><span>${d === t ? 'Today' : fmtDate(d, { weekday: 'short' })}</span><b>${parse(d).getDate()}</b></div>
      ${w ? `<div class="wday-wx">${wxIcon(w.code)} ${w.hi}°</div>` : ''}
      <div class="wday-items">
        ${evs.slice(0, 2).map((e) => `<div class="wev" style="--c:${e.color}">${esc(e.title.replace(/^[\p{Extended_Pictographic}️‍]+\s*/u, ''))}</div>`).join('')}
        ${evs.length > 2 ? `<div class="small muted">+${evs.length - 2} more</div>` : ''}
        ${!evs.length && hol ? `<div class="small muted">${esc(hol.title)}</div>` : ''}
      </div>
      <div class="wday-foot">${dinner ? `<span title="${esc(dinner)}">🍽️</span>` : ''}${bills.length ? `<span>💳${bills.length > 1 ? bills.length : ''}</span>` : ''}${pay ? '<span>💰</span>' : ''}</div>
    </button>`;
  }).join('')}</div>`;
}

/* =========================================================
   Calendar: Month / Agenda
   ========================================================= */
function calendarTabs() {
  const v = ui.calView || 'month';
  return `<div class="segmented"><button class="${v === 'month' ? 'active' : ''}" data-action="cal-view" data-v="month">Month</button><button class="${v === 'agenda' ? 'active' : ''}" data-action="cal-view" data-v="agenda">Agenda</button></div>`;
}
function agendaView() {
  const t = today();
  const out = [];
  for (let i = 0; i < 60; i++) {
    const d = addDays(t, i);
    const evs = eventsOn(d);
    const w = wxForDay(d);
    if (!evs.length && i > 0) continue;
    out.push(`<div class="agenda-day${d === t ? ' today' : ''}">
      <div class="agenda-date"><b>${parse(d).getDate()}</b><span>${d === t ? 'Today' : i === 1 ? 'Tmrw' : fmtDate(d, { weekday: 'short' })}</span>${w ? `<small>${wxIcon(w.code)} ${w.hi}°</small>` : ''}</div>
      <div class="card flush" style="flex:1;min-width:0;margin:0">${evs.length ? evs.map((e) => eventRow(e)).join('') : '<div class="empty small" style="padding:16px">Nothing today</div>'}</div>
    </div>`);
    if (parse(d).getDate() === new Date(parse(d).getFullYear(), parse(d).getMonth() + 1, 0).getDate() && i < 59) out.push(`<div class="agenda-month">${fmtMonth(monthKey(addDays(d, 1)))}</div>`);
  }
  return `<div class="agenda">${out.join('')}</div><button class="fab" data-action="add-event" data-date="${t}" aria-label="Add event">${ICON.plus}</button>`;
}

/* =========================================================
   Chores: streaks & last week's champion
   ========================================================= */
function choreStreak(memberId) {
  const days = new Set();
  for (const c of state.chores) for (const l of c.log || []) if (l.memberId === memberId) days.add(l.date);
  let d = days.has(today()) ? today() : addDays(today(), -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function choreExtras() {
  if (!state.members.length || !state.chores.length) return '';
  const lastWeek = weekStart(addDays(weekStart(today()), -1));
  const pts = {};
  for (const c of state.chores) for (const l of c.log || []) if (l.memberId && l.date >= lastWeek && l.date < weekStart(today())) pts[l.memberId] = (pts[l.memberId] || 0) + (Number(c.points) || 1);
  const champ = Object.entries(pts).sort((a, b) => b[1] - a[1])[0];
  const streaks = state.members.map((m) => ({ m, n: choreStreak(m.id) })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n);
  if (!champ && !streaks.length) return '';
  return `<div class="grid2">
    ${champ ? `<div class="card champ"><div class="stat-label">🏆 Last week's champ</div><div style="display:flex;align-items:center;gap:8px;margin-top:6px">${avatar(member(champ[0]), true)}<b>${esc(member(champ[0]).name)}</b></div><div class="small muted">${champ[1]} points</div></div>` : ''}
    ${streaks.length ? `<div class="card"><div class="stat-label">🔥 Streaks</div>${streaks.slice(0, 3).map((x) => `<div class="small" style="margin-top:6px">${esc(x.m.emoji)} <b>${esc(x.m.name)}</b> · ${x.n} days</div>`).join('')}</div>` : ''}
  </div>`;
}

/* =========================================================
   Settings header
   ========================================================= */
function settingsHeader() {
  const synced = typeof Sync !== 'undefined' && (Sync.status === 'synced' || Sync.status === 'offline');
  return `<div class="card settings-head">
    <div class="avatars big">${state.members.slice(0, 6).map((m) => `<span style="--c:${m.color}">${esc(m.emoji)}</span>`).join('')}</div>
    <div style="font:800 22px/1.2 var(--font-display);margin-top:10px">${state.members.length > 1 ? 'Gomez Family' : 'Your family'}</div>
    <div class="small muted">${state.members.length} member${state.members.length === 1 ? '' : 's'} · ${synced ? '☁️ Synced across phones' : '📱 On this phone'}</div>
  </div>`;
}

Object.assign(actions, {
  'wx-enable': () => {
    if (!navigator.geolocation) { toast('Location isn’t available on this device'); return; }
    toast('Allow location to show local weather');
    navigator.geolocation.getCurrentPosition((pos) => {
      state.settings.weather = { lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100, unit: state.settings.currency === 'USD' ? 'F' : 'C' };
      save(); loadWeather(true); render();
    }, () => toast('Location was not allowed — you can enable it in iPhone Settings → Safari'), { timeout: 15000, maximumAge: 3600000 });
  },
  'wx-settings': () => openSheet({
    title: 'Weather',
    values: { unit: state.settings.weather?.unit || 'F' },
    fields: [
      { name: 'unit', label: 'Units', type: 'select', options: [{ value: 'F', label: '°F Fahrenheit' }, { value: 'C', label: '°C Celsius' }] },
      { type: 'html', html: '<div class="btn-row"><button type="button" class="btn secondary" data-action="wx-relocate">📍 Update location</button></div><p class="small muted" style="margin:0 4px">Your location stays on this phone and is only used to look up the forecast.</p>' },
    ],
    onSave(v) { state.settings.weather.unit = v.unit; loadWeather(true); },
    onDelete: () => { delete state.settings.weather; localStorage.removeItem(WX_KEY); save(); render(); },
    deleteLabel: 'Turn off weather',
  }),
  'wx-relocate': () => { closeSheet(); actions['wx-enable'](); },
  'week-day': (el) => { ui.calSel = el.dataset.date; ui.calMonth = monthKey(el.dataset.date); ui.calView = 'month'; go('calendar'); },
  'cal-view': (el) => { ui.calView = el.dataset.v; render(); },
});

/* =========================================================
   💡 Heads-up: smart nudges on Home
   ========================================================= */
function homeInsights() {
  const t = today(), ym = monthKey(t);
  const daysInMonth = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
  const day = parse(t).getDate(), left = daysInMonth - day + 1;
  const out = [];
  // Budget pace
  const sm = budgetSummary(ym);
  if (sm.limit) {
    const expected = sm.limit * (day / daysInMonth);
    if (sm.left <= 0) out.push({ p: 0, tone: 'bad', icon: '🚨', title: `Over budget by ${money(-sm.left, { maximumFractionDigits: 0 })}`, sub: `${left} days left in ${fmtDate(t, { month: 'long' })}`, act: 'data-action="go" data-to="budget"' });
    else out.push({ p: sm.spent > expected * 1.1 ? 1 : 5, tone: sm.spent > expected * 1.1 ? 'warn' : 'good', icon: sm.spent > expected * 1.1 ? '🐢' : '✅', title: `${money(sm.left / left, { maximumFractionDigits: 0 })}/day to stay on budget`, sub: sm.spent > expected * 1.1 ? `Spending is ${Math.round((sm.spent / expected - 1) * 100)}% ahead of pace` : 'You’re on track this month', act: 'data-action="go" data-to="budget" data-btab="trends"' });
  }
  // Categories running hot
  for (const c of state.budget.categories) {
    if (!c.limit) continue;
    const spent = spentIn(ym, c.id), f = spent / c.limit;
    if (f >= 1) out.push({ p: 1, tone: 'bad', icon: c.emoji, title: `${c.name} is over by ${money(spent - c.limit, { maximumFractionDigits: 0 })}`, sub: `${money(spent, { maximumFractionDigits: 0 })} of ${money(c.limit, { maximumFractionDigits: 0 })}`, act: 'data-action="go" data-to="budget" data-btab="trends"' });
    else if (f >= 0.85 && left > 3) out.push({ p: 2, tone: 'warn', icon: c.emoji, title: `${c.name}: ${Math.round(f * 100)}% used`, sub: `${money(c.limit - spent, { maximumFractionDigits: 0 })} left for ${left} days`, act: 'data-action="go" data-to="budget" data-btab="trends"' });
  }
  // Birthdays without a gift
  for (const p of state.people) {
    const nb = nextBirthday(p);
    if (!nb) continue;
    const n = daysBetween(t, nb);
    if (n > 21) continue;
    const has = state.gifts.some((g) => g.personId === p.id && Number(g.year) === parse(nb).getFullYear() && g.status !== 'idea');
    if (!has) out.push({ p: n <= 7 ? 1 : 3, tone: n <= 7 ? 'warn' : '', icon: '🎂', title: `${p.name}'s birthday ${relDays(n).toLowerCase()}`, sub: 'No gift bought yet', act: `data-action="go" data-to="person/${p.id}"` });
  }
  // Staples that are out
  const outOf = state.shop.staples.filter((s) => s.status === 'out' && !state.shop.list.some((i) => !i.done && norm(i.name) === norm(s.name)));
  if (outOf.length) out.push({ p: 3, tone: '', icon: '🥚', title: `Out of ${outOf.slice(0, 2).map((s) => s.name.toLowerCase()).join(' & ')}${outOf.length > 2 ? ` +${outOf.length - 2}` : ''}`, sub: 'Tap to add to the list', act: 'data-action="add-low-to-list"' });
  // Goal behind
  for (const g of state.goals) {
    const pl = goalPlan(g);
    if (pl.pct < 1 && pl.perMonth && pl.months <= 2) out.push({ p: 3, tone: '', icon: g.emoji || '🎯', title: `${g.name}: ${money(pl.left, { maximumFractionDigits: 0 })} to go`, sub: `${pl.months} month${pl.months > 1 ? 's' : ''} left · ${money(pl.perMonth, { maximumFractionDigits: 0 })}/mo`, act: `data-action="go" data-to="goal/${g.id}"` });
  }
  if (!out.length) return '';
  out.sort((a, b) => a.p - b.p);
  return `<div class="insights">${out.slice(0, 6).map((x) => `<button class="insight ${x.tone}" ${x.act}><span class="ii">${esc(x.icon)}</span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></button>`).join('')}</div>`;
}
