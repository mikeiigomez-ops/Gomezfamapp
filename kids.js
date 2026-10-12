/* Kids: Kid Mode, routines, allowance & piggy bank, wish lists, badges & levels, the parent Kids hub,
   and kid-device setup (accounts linked to a parent's email). Loaded after plus.js, before sync.js. */
'use strict';

Object.assign(TITLES, { kids: 'Kids', kid: 'Kid Mode', routines: 'Routines', piggy: 'Piggy Bank', wishes: 'Wish Lists', badges: 'Badges' });
const kids = () => state.members.filter((m) => m.kid);
const kidModeId = () => (state.settings.kidMode && state.members.some((m) => m.id === state.settings.kidMode) ? state.settings.kidMode : '');
const inKidMode = () => !!kidModeId();
const KID_PIN_KEY = 'gomezfam:kidpin';

/* =========================================================
   Levels & badges
   ========================================================= */
const LEVELS = [0, 15, 40, 80, 130, 200, 290, 400, 540, 720, 950];
function routineStars(id) {
  let n = 0;
  for (const r of state.routines) if (r.memberId === id) for (const d of Object.values(r.stars || {})) if (d) n++;
  return n;
}
function kidXP(id) { return pointsEarned(id) + routineStars(id) * 5 + Math.floor(Math.max(0, jarTotal(id, 'save')) / 2); }
function kidLevel(id) {
  const xp = kidXP(id);
  let lvl = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) lvl = i + 1;
  const cur = LEVELS[lvl - 1] ?? 0, next = LEVELS[lvl] ?? cur + 300;
  return { lvl, xp, pct: Math.min(1, (xp - cur) / (next - cur)), toNext: next - xp };
}
function choreCount(id) { let n = 0; for (const c of state.chores) for (const l of c.log || []) if (l.memberId === id) n++; return n; }
function badgesFor(id) {
  const streak = choreStreak(id), mm = typeof moneyMode === 'function' ? moneyMode(id) : 'jars';
  const saved = mm === 'jars' ? jarTotal(id, 'save') : jarTotal(id, 'save') + jarTotal(id, 'spend') + jarTotal(id, 'give');
  const morning = state.routines.filter((r) => r.memberId === id && r.part === 'morning').reduce((a, r) => a + Object.keys(r.done || {}).filter((d) => routineComplete(r, d)).length, 0);
  const lastWeek = weekStart(addDays(weekStart(today()), -1));
  const wk = {}; for (const c of state.chores) for (const l of c.log || []) if (l.memberId && l.date >= lastWeek && l.date < weekStart(today())) wk[l.memberId] = (wk[l.memberId] || 0) + (Number(c.points) || 1);
  const champ = Object.entries(wk).sort((a, b) => b[1] - a[1])[0]?.[0] === id;
  return [
    ['🧹', 'First chore', 'Finish a chore', choreCount(id) >= 1],
    ['🧺', 'Helping hand', 'Finish 10 chores', choreCount(id) >= 10],
    ['🦸', 'Super helper', 'Finish 50 chores', choreCount(id) >= 50],
    ['🔥', 'On fire', '3-day chore streak', streak >= 3],
    ['☄️', 'Unstoppable', '7-day chore streak', streak >= 7],
    ['⭐', 'Right on time', 'Finish a routine on time', routineStars(id) >= 1],
    ['🌅', 'Early bird', 'Finish 5 morning routines', morning >= 5],
    ['🐷', 'Saver', 'Save $10', saved >= 10],
    ['💰', 'Super saver', 'Save $50', saved >= 50],
    ['💝', 'Big heart', 'Put money in the Give jar', jarTotal(id, 'give') > 0],
    ['🎁', 'Wish maker', 'Add 3 wishes', state.wishes.filter((w) => w.memberId === id).length >= 3],
    ['🎟️', 'Treat yourself', 'Redeem a reward', (state.redemptions || []).some((r) => r.memberId === id && r.status === 'approved' && r.rewardId !== 'cash')],
    ['🏆', 'Champion', 'Most points last week', champ],
    ['💯', 'Century', 'Earn 100 points', pointsEarned(id) >= 100],
  ].filter(([e]) => !(mm === 'none' && ['🐷', '💰', '💝'].includes(e)) && !(mm === 'one' && e === '💝')).map(([emoji, name, how, got]) => ({ emoji, name, how, got }));
}
const LEVEL_SEEN_KEY = 'gomezfam:levels';
function checkLevelUp(id) {
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(LEVEL_SEEN_KEY)) || {}; } catch {}
  const { lvl } = kidLevel(id);
  if (seen[id] == null) { seen[id] = lvl; localStorage.setItem(LEVEL_SEEN_KEY, JSON.stringify(seen)); return; }
  if (lvl > seen[id]) {
    seen[id] = lvl; localStorage.setItem(LEVEL_SEEN_KEY, JSON.stringify(seen));
    setTimeout(() => { confetti(); celebrate(`🎉 Level ${lvl}!`, `${member(id).name} leveled up. Keep it going!`); }, 300);
  }
}
function celebrate(title, sub) {
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `<div class="celebrate-card"><div class="celebrate-title">${esc(title)}</div><div class="celebrate-sub">${esc(sub)}</div><button class="btn block" style="margin-top:16px">Yay!</button></div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

/* =========================================================
   Routines
   ========================================================= */
const ROUTINE_TEMPLATES = {
  morning: { name: 'Morning routine', emoji: '🌅', part: 'morning', by: '07:45', steps: ['🛏️ Make bed', '👕 Get dressed', '🥣 Eat breakfast', '🪥 Brush teeth', '🎒 Pack backpack'] },
  bedtime: { name: 'Bedtime routine', emoji: '🌙', part: 'evening', by: '20:30', steps: ['🛁 Bath or shower', '🦷 Brush teeth', '👕 Pajamas on', '📖 Read a book', '💤 Lights out'] },
  homework: { name: 'After school', emoji: '📚', part: 'afternoon', by: '17:00', steps: ['🍎 Snack', '📚 Homework', '📝 Reading log', '🎒 Pack bag for tomorrow'] },
};
const splitStep = (s) => { const m = String(s).match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u); return m ? { emoji: m[1], text: m[2] } : { emoji: '✅', text: s }; };
const routineDone = (r, d = today()) => (r.done || {})[d] || {};
const routineComplete = (r, d = today()) => r.steps.length > 0 && r.steps.every((s) => routineDone(r, d)[s.id]);
function routineCard(r, big) {
  const d = today(), done = routineDone(r, d), n = r.steps.filter((s) => done[s.id]).length;
  const complete = routineComplete(r, d);
  const star = (r.stars || {})[d];
  return `<div class="card routine${big ? ' big' : ''}${complete ? ' complete' : ''}">
    <div class="routine-head">
      <span class="routine-emoji">${esc(r.emoji || '✅')}</span>
      <div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div class="small muted">${complete ? (star ? '⭐ Done on time!' : '✅ All done!') : `${n} of ${r.steps.length}${r.by ? ` · done by ${fmtTime(r.by)}` : ''}`}</div></div>
      ${big ? '' : `<button class="mini-btn" data-action="routine-edit" data-id="${r.id}">Edit</button>`}
    </div>
    <div class="bar"><i style="width:${r.steps.length ? (n / r.steps.length) * 100 : 0}%"></i></div>
    <div class="routine-steps">${r.steps.map((s) => `<button class="rstep${done[s.id] ? ' on' : ''}" data-action="routine-step" data-r="${r.id}" data-s="${s.id}"><span class="rs-emoji">${esc(s.emoji)}</span><span class="rs-text">${esc(s.text)}</span><span class="check${done[s.id] ? ' on' : ''}">${ICON.check}</span></button>`).join('')}</div>
  </div>`;
}
views.routines = () => {
  const list = inKidMode() ? state.routines.filter((r) => r.memberId === kidModeId()) : state.routines;
  const by = {};
  for (const r of list) (by[r.memberId] ||= []).push(r);
  const order = { morning: 0, afternoon: 1, evening: 2 };
  return `${!inKidMode() ? '<p class="small muted" style="margin:0 4px 12px">Step-by-step checklists kids can do on their own. Finishing before the “done by” time earns a ⭐.</p>' : ''}
    ${Object.entries(by).map(([mid, rs]) => `${inKidMode() ? '' : `<div class="section-title">${esc(member(mid).emoji)} ${esc(member(mid).name)}</div>`}${rs.sort((a, b) => (order[a.part] ?? 1) - (order[b.part] ?? 1)).map((r) => routineCard(r, inKidMode())).join('')}`).join('')
    || `<div class="card empty"><span class="big">🌅</span>${inKidMode() ? 'No routines yet — ask a grown-up to make one!' : 'Make morning, bedtime and homework routines for the kids.'}</div>`}
    ${inKidMode() ? '' : `<button class="fab" data-action="routine-new" aria-label="New routine">${ICON.plus}</button>`}`;
};
function routineForm(r, preset) {
  const isNew = !r;
  const v0 = r ? { ...r, stepsText: r.steps.map((s) => `${s.emoji} ${s.text}`).join('\n') } : { memberId: kids()[0]?.id || state.members[0]?.id, emoji: '🌅', part: 'morning', by: '', template: '', ...preset };
  openSheet({
    title: isNew ? 'New routine' : 'Edit routine',
    values: v0,
    fields: [
      ...(isNew ? [{ name: 'template', label: 'Start from', type: 'select', options: [{ value: '', label: '✏️ Blank' }, ...Object.entries(ROUTINE_TEMPLATES).map(([k, t]) => ({ value: k, label: `${t.emoji} ${t.name}` }))] }] : []),
      { name: 'memberId', label: 'For', type: 'select', options: (kids().length ? kids() : state.members).map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` })) },
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🌅' }, { name: 'name', label: 'Name', placeholder: 'e.g. Morning routine' }] },
      { row: [
        { name: 'part', label: 'Time of day', type: 'select', options: [{ value: 'morning', label: '🌅 Morning' }, { value: 'afternoon', label: '☀️ Afternoon' }, { value: 'evening', label: '🌙 Evening' }] },
        { name: 'by', label: 'Done by (for a ⭐)', type: 'time' },
      ] },
      { name: 'stepsText', label: 'Steps (one per line, start with an emoji)', type: 'textarea', placeholder: '🛏️ Make bed\n🪥 Brush teeth' },
    ],
    onInput(form, e) {
      if (e.target.name !== 'template') return;
      const t = ROUTINE_TEMPLATES[e.target.value];
      if (!t) return;
      form.elements.name.value = t.name; form.elements.emoji.value = t.emoji; form.elements.part.value = t.part; form.elements.by.value = t.by;
      form.elements.stepsText.value = t.steps.join('\n');
    },
    onSave(v) {
      const lines = String(v.stepsText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (!lines.length) { toast('Add at least one step'); return false; }
      const old = r ? r.steps : [];
      const steps = lines.map((line) => { const st = splitStep(line); const same = old.find((o) => o.text === st.text); return { id: same?.id || uid(), ...st }; });
      const data = { memberId: v.memberId, emoji: v.emoji || '✅', name: v.name || 'Routine', part: v.part, by: v.by, steps };
      if (isNew) state.routines.push({ id: uid(), done: {}, stars: {}, ...data });
      else Object.assign(r, data);
    },
    onDelete: isNew ? null : () => withUndo(`${r.name} deleted`, () => { state.routines = state.routines.filter((x) => x.id !== r.id); }),
  });
}

/* =========================================================
   Piggy bank: Save / Spend / Give jars + weekly allowance
   ========================================================= */
const JARS = [['save', '🐷', 'Save'], ['spend', '🛍️', 'Spend'], ['give', '💝', 'Give']];
const piggyOf = (id) => (state.piggy[id] ||= { log: [], allowance: null, goal: null, lastPaid: '' });
const jarTotal = (id, jar) => Math.round(sum((state.piggy[id]?.log || []).filter((x) => x.jar === jar), (x) => x.amount) * 100) / 100; // 0.7 + 0.1 = 0.8, not 0.7999…
function payAllowances() {
  const t = today();
  let n = 0;
  for (const k of kids()) {
    const pg = state.piggy[k.id];
    const a = pg?.allowance;
    if (!a || !a.amount) { if (pg) pg.lastPaid = t; continue; } // paused: no back pay when it's turned on again
    if (!pg.lastPaid) { pg.lastPaid = t; continue; }
    for (let d = addDays(pg.lastPaid, 1); d <= t; d = addDays(d, 1)) {
      if (parse(d).getDay() !== Number(a.day)) continue;
      const cents = Math.round(a.amount * 100);
      const parts = JARS.map(([jar]) => [jar, Number(a.split?.[jar] ?? (jar === 'spend' ? 100 : 0))]).filter(([, pct]) => pct > 0);
      let given = 0;
      for (const [jar, pct] of parts) {
        const c = jar === parts.at(-1)[0] ? cents - given : Math.round((cents * pct) / 100); // last jar gets the leftover cent
        given += c;
        const amt = c / 100;
        const id = `alw-${k.id}-${d}-${jar}`; // predictable id: two synced phones can't pay twice
        if (amt > 0 && !pg.log.some((x) => x.id === id)) { pg.log.push({ id, date: d, jar, amount: amt, note: 'Weekly allowance' }); n++; }
      }
    }
    pg.lastPaid = t;
  }
  if (n) { save(); if (typeof activityResync === 'function') activityResync(); }
}
function jarSVG(fill, color) {
  const h = Math.round(64 * Math.min(1, Math.max(0.04, fill)));
  return `<svg class="jar" viewBox="0 0 60 80" aria-hidden="true"><rect x="16" y="2" width="28" height="9" rx="3" class="jar-lid"/><path d="M12 12h36c4 0 6 3 6 7v50c0 5-4 9-9 9H15c-5 0-9-4-9-9V19c0-4 2-7 6-7z" class="jar-glass"/>
    <clipPath id="jc${color}"><path d="M12 12h36c4 0 6 3 6 7v50c0 5-4 9-9 9H15c-5 0-9-4-9-9V19c0-4 2-7 6-7z"/></clipPath>
    <rect x="0" y="${78 - h}" width="60" height="${h}" fill="${color}" clip-path="url(#jc${color})" opacity=".85"/></svg>`;
}
function piggyCard(id, big) {
  const pg = piggyOf(id);
  const goal = pg.goal, saveAmt = jarTotal(id, 'save');
  const colors = { save: '#e85d8a', spend: '#3b82f6', give: '#22a06b' };
  const max = Math.max(goal?.amount || 0, ...JARS.map(([j]) => jarTotal(id, j)), 20);
  return `<div class="card piggy${big ? ' big' : ''}">
    <div class="jars">${JARS.map(([j, e, l]) => `<div class="jarbox">${jarSVG(jarTotal(id, j) / max, colors[j])}<b>${money(jarTotal(id, j))}</b><span>${e} ${l}</span></div>`).join('')}</div>
    ${goal ? `<div class="piggy-goal"><div class="kv"><span>🎯 ${esc(goal.name)}</span><b>${money(saveAmt)} / ${money(goal.amount)}</b></div><div class="bar"><i style="width:${Math.min(100, (saveAmt / goal.amount) * 100)}%;background:#e85d8a"></i></div>${saveAmt >= goal.amount ? '<div class="small" style="margin-top:6px">🎉 You saved enough!</div>' : `<div class="small muted" style="margin-top:6px">${money(goal.amount - saveAmt)} to go${pg.allowance?.amount ? ` · about ${Math.ceil((goal.amount - saveAmt) / Math.max(0.01, pg.allowance.amount * (pg.allowance.split?.save ?? 0) / 100))} weeks of saving` : ''}</div>`}</div>` : ''}
    ${pg.allowance?.amount ? `<div class="small muted" style="margin-top:8px">💵 ${money(pg.allowance.amount)} every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][pg.allowance.day]}</div>` : ''}
  </div>`;
}
views.piggy = (id) => {
  id = inKidMode() ? kidModeId() : (id || kids()[0]?.id);
  if (!id) return `<div class="card empty"><span class="big">🐷</span>Mark a family member as a kid (Settings → Family members) to give them a piggy bank.</div>`;
  const pg = piggyOf(id);
  const log = [...pg.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  return `${inKidMode() || kids().length < 2 ? '' : `<div class="segmented">${kids().map((k) => `<button class="${k.id === id ? 'active' : ''}" data-action="go" data-to="piggy/${k.id}">${esc(k.emoji)} ${esc(k.name)}</button>`).join('')}</div>`}
    ${piggyCard(id, true)}
    <div class="btn-row">
      ${inKidMode() ? `<button class="btn" data-action="piggy-goal" data-id="${id}">🎯 ${pg.goal ? 'Change my goal' : 'Set a savings goal'}</button>`
        : `<button class="btn" data-action="piggy-add" data-id="${id}">＋ Add money</button><button class="btn secondary" data-action="piggy-spend" data-id="${id}">− Spend</button>`}
    </div>
    ${inKidMode() ? '' : `<div class="btn-row" style="margin-top:0"><button class="btn secondary" data-action="piggy-allowance" data-id="${id}">💵 Allowance</button><button class="btn secondary" data-action="piggy-cashin" data-id="${id}">🏆 Cash in points</button><button class="btn secondary" data-action="piggy-goal" data-id="${id}">🎯 Goal</button></div>`}
    <div class="section-title">History</div>
    <div class="card flush">${log.map((x) => `<div class="row"><div class="avatar">${JARS.find((j) => j[0] === x.jar)?.[1] || '💵'}</div><div class="grow"><div class="title">${esc(x.note || (x.amount >= 0 ? 'Added' : 'Spent'))}</div><div class="sub">${fmtDate(x.date)} · ${esc(JARS.find((j) => j[0] === x.jar)?.[2] || '')} jar</div></div><span class="amount ${x.amount >= 0 ? 'income' : ''}">${x.amount >= 0 ? '+' : '−'}${money(Math.abs(x.amount))}</span></div>`).join('') || '<div class="empty small">No money yet.</div>'}</div>`;
};

/* =========================================================
   Wish lists
   ========================================================= */
views.wishes = () => {
  const ids = inKidMode() ? [kidModeId()] : kids().map((k) => k.id);
  return `${ids.map((id) => {
    const ws = state.wishes.filter((w) => w.memberId === id).sort((a, b) => (b.priority || 1) - (a.priority || 1));
    return `${inKidMode() ? '' : `<div class="section-title">${esc(member(id).emoji)} ${esc(member(id).name)}</div>`}
      <div class="wish-grid">${ws.map((w) => {
        const claimed = !inKidMode() && state.gifts.some((g) => g.wishId === w.id);
        return `<button class="wish" data-action="wish-open" data-id="${w.id}"><span class="w-e">${esc(w.emoji || '🎁')}</span><b>${esc(w.title)}</b>${w.price ? `<span class="w-p">${money(w.price, { maximumFractionDigits: 0 })}</span>` : ''}<span class="w-stars">${'💖'.repeat(w.priority || 1)}</span>${claimed ? '<span class="pill good">In gift plan</span>' : ''}</button>`;
      }).join('')}
      <button class="wish add" data-action="wish-new" data-m="${id}"><span class="w-e">＋</span><b>${inKidMode() ? 'Add a wish' : 'Add wish'}</b></button></div>`;
  }).join('') || `<div class="card empty"><span class="big">🎁</span>Mark family members as kids to give them wish lists.</div>`}
  ${inKidMode() ? '' : '<p class="small muted" style="margin:12px 4px">Kids add wishes in Kid Mode. Tap one to put it in your gift plan — they’ll never see what’s been bought.</p>'}`;
};
const WISH_EMOJI = ['🎮', '🧸', '📚', '🚲', '🎨', '⚽', '🎧', '👟', '🦄', '🧩', '🎤', '🛹'];
function wishForm(w, memberId) {
  const isNew = !w;
  openSheet({
    title: isNew ? 'Add a wish' : 'My wish',
    values: w || { memberId, emoji: '🎁', priority: 2 },
    fields: [
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🎁' }, { name: 'title', label: 'I wish for…', required: true, placeholder: 'e.g. LEGO set' }] },
      { type: 'html', html: `<div class="chips" style="margin-top:-6px">${WISH_EMOJI.map((e) => `<button type="button" class="chip" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { name: 'priority', label: 'How much do you want it?', type: 'select', options: [{ value: 1, label: '💖 It would be nice' }, { value: 2, label: '💖💖 I really want it' }, { value: 3, label: '💖💖💖 It’s my #1 wish!' }] },
      { row: [{ name: 'price', label: 'Price (if you know)', type: 'money', placeholder: '0' }, { name: 'link', label: 'Link', type: 'url', placeholder: 'https://…' }] },
    ],
    onSave(v) { v.priority = Number(v.priority) || 1; if (isNew) state.wishes.push({ id: uid(), added: today(), ...v, memberId }); else Object.assign(w, v); },
    onDelete: isNew ? null : () => withUndo('Wish removed', () => { state.wishes = state.wishes.filter((x) => x.id !== w.id); }),
  });
}
function wishToGift(w) {
  const m = member(w.memberId);
  let p = state.people.find((x) => norm(x.name) === norm(m.name));
  if (!p) { p = { id: uid(), name: m.name, emoji: m.emoji, relationship: 'Family' }; state.people.push(p); }
  if (state.gifts.some((g) => g.wishId === w.id)) { toast('Already in the gift plan'); return; }
  const next = nextBirthday(p);
  state.gifts.push({ id: uid(), personId: p.id, wishId: w.id, idea: w.title, price: w.price || null, link: w.link || '', status: 'idea', occasion: next && daysBetween(today(), next) < 75 ? 'Birthday' : 'Christmas', year: new Date().getFullYear() });
  save(); render(); toast(`🎁 Added to ${m.name}'s gift plan`);
}
const _giftsView = views.gifts;
views.gifts = () => {
  const html = _giftsView();
  const ws = state.wishes;
  if (!ws.length) return html;
  const block = `<div class="section-title">Kids' wish lists<button data-action="go" data-to="wishes">See all</button></div>
    <div class="card flush">${kids().filter((k) => ws.some((w) => w.memberId === k.id)).map((k) => {
      const mine = ws.filter((w) => w.memberId === k.id), inPlan = mine.filter((w) => state.gifts.some((g) => g.wishId === w.id)).length;
      return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="wishes">${avatar(k)}<div class="grow"><div class="title">${esc(k.name)}</div><div class="sub">${mine.length} wish${mine.length > 1 ? 'es' : ''} · ${inPlan} in gift plan</div></div>${ICON.chev}</button>`;
    }).join('')}</div>`;
  const i = html.indexOf('<div class="section-title">Family &amp; friends');
  return i < 0 ? html + block : html.slice(0, i) + block + html.slice(i);
};

/* =========================================================
   Badges view
   ========================================================= */
views.badges = (id) => {
  id = inKidMode() ? kidModeId() : (id || kids()[0]?.id);
  if (!id) return '<div class="card empty">No kids yet.</div>';
  const L = kidLevel(id), bs = badgesFor(id), got = bs.filter((b) => b.got).length;
  return `${inKidMode() || kids().length < 2 ? '' : `<div class="segmented">${kids().map((k) => `<button class="${k.id === id ? 'active' : ''}" data-action="go" data-to="badges/${k.id}">${esc(k.emoji)} ${esc(k.name)}</button>`).join('')}</div>`}
    <div class="card level-card"><div class="lvl-num">${L.lvl}</div><div style="flex:1"><b>Level ${L.lvl}</b><div class="bar"><i style="width:${L.pct * 100}%"></i></div><div class="small muted">${L.xp} XP · ${L.toNext} to level ${L.lvl + 1}</div></div></div>
    <div class="section-title">Badges · ${got} of ${bs.length}</div>
    <div class="badge-grid">${bs.map((b) => `<div class="badge${b.got ? ' got' : ''}"><span>${b.emoji}</span><b>${esc(b.name)}</b><small>${esc(b.how)}</small></div>`).join('')}</div>`;
};

/* =========================================================
   Kid Mode home
   ========================================================= */
function kidChoreRow(c) {
  const done = choreDone(c);
  return `<div class="row kid-chore${done ? ' done' : ''}"><button class="check${done ? ' on' : ''}" data-action="toggle-chore" data-id="${c.id}" aria-label="Done">${ICON.check}</button>
    <div class="grow"><div class="title">${esc(c.title)}</div><div class="sub">+${c.points || 1} point${(c.points || 1) > 1 ? 's' : ''}</div></div></div>`;
}
views.kid = () => {
  const id = kidModeId();
  if (!id) return '<div class="card empty">Kid Mode is off.</div>';
  const m = member(id), L = kidLevel(id);
  const myChores = state.chores.filter((c) => c.memberId === id || !c.memberId);
  const todo = myChores.filter((c) => !choreDone(c)), done = myChores.filter((c) => choreDone(c));
  const rs = state.routines.filter((r) => r.memberId === id);
  const evs = eventsOn(today()).filter((e) => e.kind === 'event' && (!e.who?.id || e.who.id === id) || e.kind === 'birthday' || e.kind === 'holiday');
  const poll = state.board.find((b) => b.type === 'poll' && !b.closed);
  const hr = new Date().getHours();
  const syncWait = typeof Sync !== 'undefined' && Sync.cfg?.kid && Sync.status !== 'synced' && Sync.status !== 'offline';
  checkLevelUp(id);
  return `
    ${syncWait ? `<div class="card install-tip"><b>⏳ Almost ready!</b><div class="small" style="margin-top:4px">${Sync.status === 'unverified' ? `Ask a grown-up to tap the approval link sent to their email (${esc(Sync.cfg.kid.email)}).` : 'Connecting to your family…'}</div>${Sync.status === 'unverified' ? '<button class="btn block" style="margin-top:10px" data-action="sync-verified">A grown-up approved it</button>' : ''}</div>` : ''}
    <section class="kid-hero" style="--c:${m.color}">
      <div class="kid-av">${esc(m.emoji)}</div>
      <div class="kid-hi">${hr < 12 ? 'Good morning' : hr < 17 ? 'Hi' : 'Good evening'}, ${esc(m.name)}! 👋</div>
      <button class="kid-level" data-action="go" data-to="badges"><span class="lvl">Level ${L.lvl}</span><span class="bar"><i style="width:${L.pct * 100}%"></i></span><span class="small">${L.toNext} XP to go</span></button>
      <div class="kid-stats">
        <button data-action="go" data-to="chores" data-ctab="rewards"><b>${pointsBalance(id)}</b><span>points</span></button>
        <button data-action="go" data-to="piggy"><b>${money(jarTotal(id, 'save') + jarTotal(id, 'spend') + jarTotal(id, 'give'), { maximumFractionDigits: 0 })}</b><span>in my piggy</span></button>
        <button data-action="go" data-to="badges"><b>${badgesFor(id).filter((b) => b.got).length}</b><span>badges</span></button>
      </div>
    </section>
    ${rs.length ? `<div class="section-title">My routines</div>${rs.map((r) => routineCard(r, true)).join('')}` : ''}
    <div class="section-title">My chores</div>
    <div class="card flush">${todo.map(kidChoreRow).join('') || (myChores.length ? '<div class="empty">🎉 All done! Nice work!</div>' : '<div class="empty">🧹 No chores yet — ask a grown-up to add some!</div>')}${done.map(kidChoreRow).join('')}</div>
    ${evs.length ? `<div class="section-title">Today</div><div class="card flush">${evs.map((e) => `<div class="row"><div class="time-col">${e.time ? fmtTime(e.time) : 'All day'}</div><div class="grow"><div class="title">${esc(e.title)}</div></div></div>`).join('')}</div>` : ''}
    ${poll && typeof pollCard === 'function' ? `<div class="section-title">Family vote</div>${pollCard(poll)}` : ''}
    <div class="kid-tiles">
      <button data-action="go" data-to="wishes"><span>🎁</span>My wishes</button>
      <button data-action="go" data-to="board"><span>📌</span>Fridge</button>
      <button data-action="go" data-to="packing"><span>🧳</span>Packing</button>
      <button data-action="go" data-to="badges"><span>🏅</span>Badges</button>
    </div>
    <button class="kid-exit" data-action="kid-exit">🔒 Grown-ups: exit Kid Mode</button>`;
};

/* =========================================================
   Parent Kids hub
   ========================================================= */
views.kids = () => {
  const ks = kids();
  if (!ks.length) {
    return `<div class="card empty"><span class="big">🧒</span>Which family members are kids?<div class="whoami-row" style="justify-content:center;margin-top:12px">${state.members.map((m) => `<button data-action="kid-flag" data-id="${m.id}">${avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}</div><div class="small muted" style="margin-top:8px">Tap each kid. You can change this later in Settings → Family members.</div></div>`;
  }
  return `${ks.map((k) => {
    const L = kidLevel(k.id);
    const rs = state.routines.filter((r) => r.memberId === k.id);
    const rDone = rs.filter((r) => routineComplete(r)).length;
    const acct = state.kidAccounts?.[k.id];
    return `<div class="card kid-card" style="--c:${k.color}">
      <div style="display:flex;gap:12px;align-items:center">
        <div class="kid-av sm">${esc(k.emoji)}</div>
        <div style="flex:1;min-width:0"><b style="font-size:18px">${esc(k.name)}</b><div class="small muted">Level ${L.lvl} · ${pointsBalance(k.id)} pts · ${money(jarTotal(k.id, 'save') + jarTotal(k.id, 'spend') + jarTotal(k.id, 'give'))}</div></div>
        ${acct ? '<span class="pill good">📱 Own device</span>' : ''}
      </div>
      <div class="kid-grid">
        <button data-action="go" data-to="routines"><span>🌅</span>Routines<small>${rs.length ? `${rDone}/${rs.length} today` : 'Set up'}</small></button>
        <button data-action="go" data-to="piggy/${k.id}"><span>🐷</span>Piggy bank<small>${state.piggy[k.id]?.allowance?.amount ? money(state.piggy[k.id].allowance.amount) + '/wk' : 'Allowance'}</small></button>
        <button data-action="go" data-to="wishes"><span>🎁</span>Wishes<small>${state.wishes.filter((w) => w.memberId === k.id).length}</small></button>
        <button data-action="go" data-to="badges/${k.id}"><span>🏅</span>Badges<small>${badgesFor(k.id).filter((b) => b.got).length}</small></button>
      </div>
      <div class="btn-row" style="margin:12px 0 0"><button class="btn secondary" data-action="kid-device" data-id="${k.id}">📱 ${acct ? 'Device setup code' : 'Set up their device'}</button><button class="btn secondary" data-action="kid-mode-on" data-id="${k.id}">🧒 Kid Mode here</button></div>
    </div>`;
  }).join('')}
  <p class="small muted" style="margin:6px 4px">Kid Mode shows a simple, safe version of the app — chores, routines, points, piggy bank and wishes. Leaving it needs a grown-up’s PIN.</p>`;
};

/* =========================================================
   Kid Mode: routing, tab bar, action allowlist, PIN exit
   ========================================================= */
const KID_ROUTES = ['kid', 'routines', 'chores', 'piggy', 'wishes', 'badges', 'board', 'packing', 'trip'];
const KID_ACTIONS = new Set(['go', 'back', 'toggle-chore', 'routine-step', 'wish-new', 'wish-open', 'piggy-goal', 'chore-tab', 'reward-redeem', 'sheet-cancel', 'sheet-save', 'sheet-delete', 'pick-emoji', 'kid-exit', 'kid-pin', 'note-new', 'note-del', 'react', 'vote', 'trip-toggle', 'sync-verified', 'whats-new-ok', 'story-next', 'story-prev', 'story-close']);
const _currentRoute = currentRoute;
currentRoute = function () {
  const r = _currentRoute();
  if (inKidMode() && !KID_ROUTES.includes(r.name)) return { name: 'kid' };
  return r;
};
let parentTabs = null;
function applyKidChrome() {
  const on = inKidMode();
  document.body.classList.toggle('kid-mode', on);
  const bar = $('.tabbar');
  if (!bar) return;
  if (on && !bar.dataset.kid) {
    parentTabs = bar.innerHTML;
    bar.dataset.kid = '1';
    bar.innerHTML = `<span class="tab-ink" aria-hidden="true"></span>
      ${[['kid', '🏠', 'Home'], ['chores', '🧹', 'Chores'], ['routines', '🌅', 'Routines'], ['piggy', '🐷', 'Piggy'], ['wishes', '🎁', 'Wishes']].map(([to, e, l]) => `<button data-action="go" data-to="${to}" data-tab="${to}"><span class="kt">${e}</span><span>${l}</span></button>`).join('')}`;
  } else if (!on && bar.dataset.kid) {
    bar.innerHTML = parentTabs;
    delete bar.dataset.kid;
  }
}
// Kid Mode: block anything not on the allowlist (edits, settings, money…)
document.addEventListener('click', (e) => {
  if (!inKidMode()) return;
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (KID_ACTIONS.has(a)) {
    if (a === 'go' && !KID_ROUTES.includes((el.dataset.to || '').split('/')[0])) { e.stopPropagation(); e.preventDefault(); toast('Ask a grown-up 🙂'); }
    return;
  }
  // In the wish list, a kid may open their own wishes
  e.stopPropagation(); e.preventDefault();
  toast('Ask a grown-up 🙂');
}, true);
// Kids' chores view
const _choresView2 = views.chores;
views.chores = () => {
  if (!inKidMode()) return _choresView2();
  const id = kidModeId();
  const tab = ui.choreTab || 'chores';
  const tabs = `<div class="segmented"><button class="${tab === 'chores' ? 'active' : ''}" data-action="chore-tab" data-tab="chores">My chores</button><button class="${tab === 'rewards' ? 'active' : ''}" data-action="chore-tab" data-tab="rewards">Rewards</button></div>`;
  if (tab === 'rewards') {
    return tabs + `<div class="card kid-points"><b>${pointsBalance(id)}</b><span>points to spend</span></div>
      <div class="reward-grid">${state.rewards.slice().sort((a, b) => a.cost - b.cost).map((r) => `<button class="reward${pointsBalance(id) >= r.cost ? '' : ' locked'}" data-action="reward-redeem" data-id="${r.id}"><span class="r-emoji">${esc(r.emoji || '🎁')}</span><b>${esc(r.name)}</b><span class="r-cost">${r.cost} pts</span></button>`).join('') || '<div class="card empty">No rewards yet.</div>'}</div>
      ${(state.redemptions || []).filter((r) => r.memberId === id && r.status === 'pending').map((r) => `<div class="card small">⏳ Waiting for a grown-up: ${esc(state.rewards.find((x) => x.id === r.rewardId)?.name || 'reward')}</div>`).join('')}`;
  }
  const mine = state.chores.filter((c) => c.memberId === id || !c.memberId);
  return tabs + `<div class="card flush">${mine.filter((c) => !choreDone(c)).map(kidChoreRow).join('') || (mine.length ? '<div class="empty">🎉 All done!</div>' : '<div class="empty">🧹 No chores yet — ask a grown-up to add some!</div>')}${mine.filter((c) => choreDone(c)).map(kidChoreRow).join('')}</div>`;
};

async function kidPinHash(pin) { return sha('kid:' + pin); }
function parentPinCheck(onOk) {
  const lock = lockCfg();
  const kidPin = localStorage.getItem(KID_PIN_KEY) || state.settings.kidPin || '';
  const hasKidPin = !!kidPin;
  if (!lock?.pin && !hasKidPin) {
    // A kid's own device never leaves Kid Mode without a grown-up PIN
    if (typeof Sync !== 'undefined' && Sync.cfg?.kid) { toast('Ask a grown-up 🙂 (they set the Kid Mode PIN in their app)'); return; }
    onOk(); return;
  }
  let buf = '';
  const el = document.createElement('div');
  el.className = 'lock';
  el.id = 'parentPin';
  el.innerHTML = `<div class="lock-inner"><div style="font-size:44px">🔒</div><div class="lock-title">Grown-ups only</div><div class="lock-sub">Enter the parent PIN</div>
    <div class="pin-dots">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="x" class="kp-icon">✕</button><button data-k="0">0</button><button data-k="del" class="kp-icon">⌫</button></div>
    ${lock?.cred ? '<button class="lock-faceid" data-k="face">Use Face ID</button>' : ''}</div>`;
  const done = () => el.remove();
  el.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (!k) return;
    e.stopPropagation();
    if (k === 'x') return done();
    if (k === 'face') {
      try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(lock.cred), transports: ['internal'] }], userVerification: 'required' } }); done(); onOk(); } catch {}
      return;
    }
    buf = k === 'del' ? buf.slice(0, -1) : (buf + k).slice(0, 4);
    el.querySelectorAll('.pin-dots i').forEach((d, i) => d.classList.toggle('on', i < buf.length));
    if (buf.length === 4) {
      const ok = (lock?.pin && (await sha(buf)) === lock.pin) || (hasKidPin && (await kidPinHash(buf)) === kidPin);
      if (ok) { done(); onOk(); } else { buf = ''; const dots = el.querySelector('.pin-dots'); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); setTimeout(() => el.querySelectorAll('.pin-dots i').forEach((d) => d.classList.remove('on')), 300); }
    }
  }, true);
  document.body.appendChild(el);
}
function enterKidMode(id) {
  const start = () => { if (!state.settings.kidPin && localStorage.getItem(KID_PIN_KEY)) state.settings.kidPin = localStorage.getItem(KID_PIN_KEY); if (!state.settings.kidMode) state.settings.meBeforeKid = state.settings.me || ''; state.settings.kidMode = id; state.settings.me = id; save(); applyKidChrome(); go('kid'); render(); toast(`🧒 Kid Mode on for ${member(id).name}`); };
  if (lockCfg()?.pin || localStorage.getItem(KID_PIN_KEY)) { start(); return; }
  openSheet({
    title: 'Parent PIN',
    saveLabel: 'Start Kid Mode',
    values: {},
    fields: [
      { type: 'html', html: '<p class="small muted" style="margin:0 4px 10px">Pick a 4-digit PIN a grown-up will use to leave Kid Mode. (If you turn on the Privacy lock, its PIN works too.)</p>' },
      { name: 'pin', label: 'Parent PIN', type: 'password', required: true },
    ],
    onSave(v) {
      if (!/^\d{4}$/.test(v.pin)) { toast('PIN must be 4 digits'); return false; }
      kidPinHash(v.pin).then((h) => { localStorage.setItem(KID_PIN_KEY, h); state.settings.kidPin = h; start(); });
    },
  });
}

/* =========================================================
   Kid accounts linked to a parent's email (device setup)
   ========================================================= */
const KID_PREFIX = 'GFKID1.';
function kidAlias(parentEmail, kidName) {
  const [local, domain] = String(parentEmail).toLowerCase().split('@');
  const slug = norm(kidName).replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'kid';
  return `${local.split('+')[0]}+${slug}@${domain}`;
}
const PLUS_OK = /@(gmail|googlemail|outlook|hotmail|live|msn|icloud|me|mac|fastmail|proton(mail)?|pm)\./i;
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
async function kidDeviceSheet(k) {
  if (typeof Sync === 'undefined' || !Sync.ref || Sync.status !== 'synced') {
    openSheet({ title: `${k.name}'s device`, saveLabel: 'OK', values: {}, fields: [{ type: 'html', html: `<p>Kid devices join through <b>Family sync</b>. Turn it on first in <b>Settings → Family sync</b>, then come back here.</p><p class="small muted">No sync? You can still use <b>Kid Mode</b> on this phone.</p>` }], onSave() {} });
    return;
  }
  if (!localStorage.getItem(KID_PIN_KEY) && !state.settings.kidPin && !lockCfg()?.pin) { toast('First pick a parent PIN: start Kid Mode once on this phone'); return; }
  const parent = Sync.user.email;
  let acct = state.kidAccounts[k.id];
  if (!acct) {
    const pw = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 56]).join('');
    acct = { email: kidAlias(parent, k.name), pw, parent, created: today() };
  }
  const plusOk = PLUS_OK.test(parent);
  openSheet({
    title: `📱 ${k.name}'s device`,
    saveLabel: 'Create code',
    values: { email: acct.email },
    fields: [
      { type: 'html', html: `<p class="small" style="margin:0 4px 10px">${k.name} gets their own login built from <b>your</b> email, so you approve it from your inbox and there’s nothing for them to remember.</p>${plusOk ? '' : `<p class="small" style="margin:0 4px 10px;color:var(--warn)">⚠️ “+” addresses work with Gmail, Outlook and iCloud. If your email doesn’t support them, change this to any email you can check.</p>`}` },
      { name: 'email', label: `${k.name}'s login email`, type: 'email', required: true },
    ],
    onSave(v) {
      acct.email = v.email.toLowerCase();
      state.kidAccounts[k.id] = acct;
      const { updateDoc, arrayUnion } = Sync.fb.fs;
      updateDoc(Sync.ref, { emails: arrayUnion(acct.email), kids: arrayUnion(acct.email) }).catch(syncError);
      setTimeout(() => showKidCode(k, acct));
    },
  });
}
function kidCode(k, acct) {
  return KID_PREFIX + b64url(JSON.stringify({ c: Sync.cfg.config, f: Sync.cfg.familyId, e: acct.email, p: acct.pw, m: k.id, n: k.name, h: localStorage.getItem(KID_PIN_KEY) || state.settings.kidPin || '' }));
}
async function showKidCode(k, acct) {
  const code = kidCode(k, acct);
  let qr = '';
  try { await loadScript('vendor/qrcode.min.js'); const q = qrcode(0, 'L'); q.addData(code); q.make(); qr = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); } catch { qr = ''; }
  openSheet({
    title: `📱 Set up ${k.name}'s device`,
    saveLabel: 'Done',
    values: {},
    fields: [{ type: 'html', html: `
      <ol class="small" style="margin:0 0 12px;padding-left:20px;line-height:1.7">
        <li>On ${esc(k.name)}'s iPhone or iPad, open <b>${esc(location.host + location.pathname)}</b> in Safari → Share → <b>Add to Home Screen</b>.</li>
        <li>Open the app → <b>Settings → Family sync → Kid's device</b> → scan this code.</li>
        <li>We'll email <b>${esc(acct.parent)}</b> — tap the approval link (it's for ${esc(acct.email)}).</li>
      </ol>
      <div class="qr-box">${qr || '<div class="small muted">QR unavailable — use “Copy code” instead.</div>'}</div>
      <div class="btn-row"><button type="button" class="btn secondary" data-action="kid-copy" data-code="${esc(code)}">Copy code</button><button type="button" class="btn secondary" data-action="kid-share" data-code="${esc(code)}" data-name="${esc(k.name)}">Send code</button></div>
      <p class="small muted" style="margin:6px 4px 0">The code signs in as ${esc(k.name)} — only share it with their device.</p>` }],
    onSave() {},
  });
}
function parseKidCode(text) {
  const m = String(text || '').match(/GFKID1\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { const o = JSON.parse(unb64url(m[1])); return o.c && o.f && o.e && o.p && o.m ? o : null; } catch { return null; }
}
function kidJoin(o) {
  if (hasOwnData() && !confirm(`Set this device up for ${o.n}? Its current data will be replaced with your family's.`)) return;
  Sync.cfg = { config: o.c, familyId: o.f, joining: true, kid: { email: o.e, pw: o.p } };
  saveCfg();
  if (o.h) { localStorage.setItem(KID_PIN_KEY, o.h); state.settings.kidPin = o.h; }
  writeJSON(BASE_KEY, null); Sync.base = null;
  state.settings.kidMode = o.m; state.settings.me = o.m;
  if (!state.members.some((x) => x.id === o.m)) state.members.push({ id: o.m, name: o.n, emoji: '🧒', color: COLORS[2], kid: true });
  save();
  applyKidChrome();
  if (Sync.fb) { location.reload(); return; }
  startSync();
  go('kid');
}
let scanStream = null;
async function kidScanSheet() {
  openSheet({
    title: "🧒 Kid's device",
    saveLabel: 'Use code',
    values: {},
    fields: [
      { type: 'html', html: `<p class="small muted" style="margin:0 4px 10px">Scan the code on a parent's phone (Kids → Set up their device), or paste it.</p><div class="scan-box"><video id="scanVideo" playsinline muted></video><button type="button" class="btn" id="scanStart" data-action="kid-scan-start">📷 Scan code</button></div>` },
      { name: 'code', label: 'Or paste the code', type: 'textarea', placeholder: 'GFKID1.…' },
    ],
    onSave(v) {
      const o = parseKidCode(v.code);
      if (!o) { toast('That isn’t a kid setup code'); return false; }
      stopScan(); setTimeout(() => kidJoin(o));
    },
  });
}
function stopScan() { scanStream?.getTracks().forEach((t) => t.stop()); scanStream = null; }
async function startScan() {
  try {
    await loadScript('vendor/jsQR.js');
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = $('#scanVideo'); video.srcObject = scanStream; await video.play();
    $('#scanStart').hidden = true; video.classList.add('on');
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (!scanStream || !$('#scanVideo')) return stopScan();
      if (video.readyState >= 2) {
        c.width = video.videoWidth; c.height = video.videoHeight; g.drawImage(video, 0, 0);
        const r = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        const o = r && parseKidCode(r.data);
        if (o) { stopScan(); closeSheet(); kidJoin(o); return; }
      }
      requestAnimationFrame(tick);
    };
    tick();
  } catch (e) { toast('Camera unavailable — paste the code instead'); stopScan(); }
}

/* =========================================================
   Actions & hooks
   ========================================================= */
const _toggleChore = actions['toggle-chore'], _rewardRedeem = actions['reward-redeem'];
Object.assign(actions, {
  // In Kid Mode, "Anyone" chores are credited to the kid without asking who did it.
  // A kid can only un-tick their own check-off (never a sibling's), and not once those points are spent.
  'toggle-chore': (el) => {
    const c = findIn(state.chores, el.dataset.id);
    if (!inKidMode()) return _toggleChore(el);
    const me = kidModeId(), t = today(), pts = Number(c.points) || 1;
    if (choreDone(c)) {
      const from = c.freq === 'daily' ? t : c.freq === 'weekly' ? weekStart(t) : '0000';
      const mine = (c.log || []).filter((l) => l.date >= from && l.memberId === me);
      if (!mine.length) { const by = (c.log || []).filter((l) => l.date >= from).at(-1)?.memberId; toast(`${by && state.members.some((m) => m.id === by) ? member(by).name : 'Someone'} already did this one 🙌`); return; }
      if (pointsBalance(me) - mine.length * pts < 0) { toast('Those points are already used for a reward — ask a grown-up'); return; }
      c.log = c.log.filter((l) => !(l.date >= from && l.memberId === me));
      save(); render(); return;
    }
    (c.log ||= []).push({ id: `cl-${t}-${me}`, date: t, memberId: me });
    toast(`⭐ +${pts} point${pts > 1 ? 's' : ''}!`);
    save(); render();
  },
  // In Kid Mode you can only spend your own points
  'reward-redeem': (el) => {
    if (!inKidMode()) return _rewardRedeem(el);
    const id = kidModeId(), r = findIn(state.rewards, el.dataset.id), bal = pointsBalance(id);
    if (!r) return;
    if (bal < r.cost) { toast(`${r.cost - bal} more points to go! 💪`); return; }
    if ((state.redemptions || []).some((x) => x.memberId === id && x.rewardId === r.id && x.status === 'pending')) { toast('Already asked — waiting for a grown-up'); return; }
    openSheet({ title: `${r.emoji || '🎁'} ${r.name}`, saveLabel: `Use ${r.cost} points`, values: {},
      fields: [{ type: 'html', html: `<p>You have <b>${bal}</b> points. After this you’ll have <b>${bal - r.cost}</b>.</p><p class="small muted">A grown-up will say OK.</p>` }],
      onSave() { (state.redemptions ||= []).push({ id: uid(), rewardId: r.id, memberId: id, cost: r.cost, at: Date.now(), status: 'pending' }); toast('🎟️ Asked! Waiting for a grown-up'); } });
  },
  'routine-new': () => routineForm(null),
  'routine-edit': (el) => routineForm(findIn(state.routines, el.dataset.id)),
  'routine-step': (el) => {
    const r = findIn(state.routines, el.dataset.r), d = today();
    r.done ||= {}; r.stars ||= {};
    const day = (r.done[d] ||= {});
    if (day[el.dataset.s]) delete day[el.dataset.s]; else day[el.dataset.s] = kidModeId() || meId() || true;
    if (routineComplete(r, d)) {
      const onTime = !r.by || new Date().toTimeString().slice(0, 5) <= r.by;
      if (onTime && !r.stars[d]) { r.stars[d] = true; setTimeout(confetti, 120); toast(`⭐ ${r.name} done on time!`); }
      else if (!onTime) toast(`✅ ${r.name} done!`);
    }
    save(); render();
  },
  'piggy-add': (el) => piggyMoney(el.dataset.id, 1),
  'piggy-spend': (el) => piggyMoney(el.dataset.id, -1),
  'piggy-allowance': (el) => {
    const pg = piggyOf(el.dataset.id), a = pg.allowance || { amount: 5, day: 6, split: { save: 50, spend: 40, give: 10 } };
    openSheet({
      title: `💵 ${member(el.dataset.id).name}'s allowance`,
      values: { amount: a.amount, day: a.day, save: a.split.save, spend: a.split.spend, give: a.split.give },
      fields: [
        { row: [{ name: 'amount', label: 'Every week', type: 'money', placeholder: '0 = none' }, { name: 'day', label: 'Paid on', type: 'select', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => ({ value: i, label: d })) }] },
        { type: 'html', html: '<p class="small muted" style="margin:0 4px 8px">Split between the jars (%):</p>' },
        { row: [{ name: 'save', label: '🐷 Save', type: 'number' }, { name: 'spend', label: '🛍️ Spend', type: 'number' }, { name: 'give', label: '💝 Give', type: 'number' }] },
      ],
      onSave(v) {
        const tot = (v.save || 0) + (v.spend || 0) + (v.give || 0);
        if (v.amount && tot !== 100) { toast(`The split adds up to ${tot}% — make it 100%`); return false; }
        const wasOn = !!pg.allowance?.amount;
        pg.allowance = v.amount ? { amount: v.amount, day: Number(v.day), split: { save: v.save || 0, spend: v.spend || 0, give: v.give || 0 } } : null;
        if (!pg.lastPaid || !wasOn) pg.lastPaid = addDays(today(), -1); // (re)starting: pay from today on, no back pay
        toast(v.amount ? `Allowance set — paid automatically every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(v.day)]}` : 'Allowance off');
      },
    });
  },
  'piggy-cashin': (el) => {
    const id = el.dataset.id, bal = pointsBalance(id);
    openSheet({
      title: '🏆 Cash in points',
      values: { pts: bal, rate: state.settings.pointValue ?? 0.1 },
      fields: [
        { row: [{ name: 'pts', label: `Points (has ${bal})`, type: 'number', required: true }, { name: 'rate', label: '$ per point', type: 'money' }] },
        { type: 'html', html: '<p class="small muted" style="margin:0 4px">The money goes into the Spend jar.</p>' },
      ],
      onSave(v) {
        const pts = Math.round(v.pts || 0);
        if (pts <= 0 || pts > bal) { toast(`Pick between 1 and ${bal} points`); return false; }
        state.settings.pointValue = v.rate || 0.1;
        const amt = Math.round(pts * (v.rate || 0.1) * 100) / 100;
        (state.redemptions ||= []).push({ id: uid(), rewardId: 'cash', memberId: id, cost: pts, at: Date.now(), status: 'approved' });
        piggyOf(id).log.push({ id: uid(), date: today(), jar: 'spend', amount: amt, note: `Cashed in ${pts} points` });
        toast(`💵 ${money(amt)} added to the Spend jar`);
      },
    });
  },
  'piggy-goal': (el) => {
    const id = inKidMode() ? kidModeId() : el.dataset.id, pg = piggyOf(id);
    openSheet({
      title: '🎯 Savings goal',
      values: pg.goal || {},
      fields: [{ name: 'name', label: 'Saving up for', required: true, placeholder: 'e.g. 🎮 Nintendo game' }, { name: 'amount', label: 'It costs', type: 'money', required: true }],
      onSave(v) { pg.goal = { name: v.name, amount: v.amount }; },
      onDelete: pg.goal ? () => { pg.goal = null; save(); render(); } : null,
      deleteLabel: 'Remove goal',
    });
  },
  'wish-new': (el) => wishForm(null, inKidMode() ? kidModeId() : el.dataset.m),
  'wish-open': (el) => {
    const w = findIn(state.wishes, el.dataset.id);
    if (inKidMode()) { wishForm(w); return; }
    openSheet({
      title: `${w.emoji || '🎁'} ${w.title}`,
      saveLabel: 'Add to gift plan',
      values: {},
      fields: [{ type: 'html', html: `<p>${esc(member(w.memberId).name)} ${'💖'.repeat(w.priority || 1)} wants this${w.price ? ` · about ${money(w.price)}` : ''}.</p>${w.link ? `<a class="btn secondary block" href="${esc(safeUrl(w.link))}" target="_blank" rel="noopener">🔗 Open link</a>` : ''}<p class="small muted">Adding it to the gift plan is hidden from ${esc(member(w.memberId).name)}.</p>` }],
      onSave() { setTimeout(() => wishToGift(w)); },
      onDelete: () => withUndo('Wish removed', () => { state.wishes = state.wishes.filter((x) => x.id !== w.id); }),
      deleteLabel: 'Remove wish',
    });
  },
  'kid-flag': (el) => { const m = findIn(state.members, el.dataset.id); m.kid = !m.kid; save(); render(); },
  'kid-mode-on': (el) => enterKidMode(el.dataset.id),
  'kid-exit': () => parentPinCheck(() => { state.settings.kidMode = ''; state.settings.me = state.settings.meBeforeKid ?? state.settings.me; delete state.settings.meBeforeKid; save(); applyKidChrome(); go('home'); render(); toast('👋 Kid Mode off'); }),
  'kid-device': (el) => kidDeviceSheet(findIn(state.members, el.dataset.id)),
  'kid-copy': (el) => navigator.clipboard?.writeText(el.dataset.code).then(() => toast('Code copied'), () => toast('Could not copy')),
  'kid-share': async (el) => { try { await navigator.share({ title: `${el.dataset.name}'s setup code`, text: el.dataset.code }); } catch (e) { if (e.name !== 'AbortError') toast('Could not share'); } },
  'kid-scan': () => kidScanSheet(),
  'kid-scan-start': () => startScan(),
});
function piggyMoney(id, sign) {
  openSheet({
    title: sign > 0 ? `＋ Add to ${member(id).name}'s piggy` : `− Spend from ${member(id).name}'s piggy`,
    values: { jar: sign > 0 ? 'save' : 'spend', date: today() },
    fields: [
      { row: [{ name: 'amount', label: 'Amount', type: 'money', required: true }, { name: 'jar', label: 'Jar', type: 'select', options: JARS.map(([v, e, l]) => ({ value: v, label: `${e} ${l}` })) }] },
      { name: 'note', label: 'What for?', placeholder: sign > 0 ? 'e.g. Birthday money from Grandma' : 'e.g. Toy at Target' },
    ],
    onSave(v) {
      if (sign < 0 && jarTotal(id, v.jar) < v.amount) { toast(`Only ${money(jarTotal(id, v.jar))} in that jar`); return false; }
      piggyOf(id).log.push({ id: uid(), date: v.date || today(), jar: v.jar, amount: Math.abs(v.amount) * sign, note: v.note });
    },
  });
}
// Close the camera if the sheet closes
const _closeSheet = closeSheet;
closeSheet = function () { stopScan(); _closeSheet(); };

const _afterRender3 = afterRender;
afterRender = function () { applyKidChrome(); _afterRender3(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') payAllowances(); });
payAllowances();
applyKidChrome();
