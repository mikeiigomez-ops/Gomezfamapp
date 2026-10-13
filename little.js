/* Simple mode for younger kids (about 4–8): stars instead of points, one piggy bank (or no money),
   one-step-at-a-time routines, read-aloud, big buttons, stickers instead of levels.
   Set per kid in Kids → Kid settings. Loaded after kids.js. */
'use strict';

Object.assign(TITLES, { treats: 'Treats' });
const isSimple = (id) => !!state.members.find((m) => m.id === id)?.simple;
const moneyMode = (id) => { const m = state.members.find((x) => x.id === id); return m?.money || (m?.simple ? 'one' : 'jars'); };
const simpleKid = () => { const id = kidModeId(); return id && isSimple(id) ? id : ''; };
const piggyTotal = (id) => Math.round((jarTotal(id, 'save') + jarTotal(id, 'spend') + jarTotal(id, 'give')) * 100) / 100;
const readAloudOn = (id) => state.members.find((m) => m.id === id)?.readAloud !== false;

/* ---------- Read aloud ---------- */
function speak(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/\p{Extended_Pictographic}/gu, '').trim());
  u.rate = 0.9; u.pitch = 1.1;
  speechSynthesis.speak(u);
}
const sayBtn = (id, text) => (readAloudOn(id) && window.speechSynthesis ? `<button class="say" data-action="say" data-text="${esc(text)}" aria-label="Read aloud">🔊</button>` : '');

/* ---------- Simple home ---------- */
function partOfDay() { const h = new Date().getHours(); return h < 11 ? 'morning' : h < 16 ? 'afternoon' : 'evening'; }
function simpleHome(id) {
  const m = member(id);
  const stars = pointsBalance(id);
  const jobs = state.chores.filter((c) => c.memberId === id || !c.memberId);
  const left = jobs.filter((c) => !choreDone(c)).length;
  const rs = state.routines.filter((r) => r.memberId === id);
  const now = rs.find((r) => r.part === partOfDay()) || rs[0];
  const steps = now ? now.steps.filter((s) => routineDone(now)[s.id]).length : 0;
  const money = moneyMode(id);
  const poll = state.board.find((b) => b.type === 'poll' && !b.closed);
  const syncWait = typeof Sync !== 'undefined' && Sync.cfg?.kid && Sync.status !== 'synced' && Sync.status !== 'offline';
  return `
    ${syncWait ? `<div class="card install-tip"><b>⏳ Almost ready!</b><div class="small" style="margin-top:4px">Ask a grown-up to check their email.</div>${Sync.status === 'unverified' ? '<button class="btn block" style="margin-top:10px" data-action="sync-verified">A grown-up did it</button>' : ''}</div>` : ''}
    <section class="kid-hero little" style="--c:${m.color}">
      <div class="kid-av">${esc(m.emoji)}</div>
      <div class="kid-hi">Hi, ${esc(m.name)}! ${sayBtn(id, `Hi ${m.name}! You have ${stars} stars.`)}</div>
      <button class="star-count" data-action="go" data-to="treats"><span>⭐</span><b>${stars}</b><small>stars</small></button>
    </section>
    <div class="little-grid">
      <button class="lt" data-action="go" data-to="chores" style="--t:#3b82f6"><span class="lt-e">🧹</span><b>My jobs</b><small>${left ? `${left} to do` : 'All done! 🎉'}</small></button>
      <button class="lt" data-action="go" data-to="routines" style="--t:#f59e0b"><span class="lt-e">${esc(now?.emoji || '🌅')}</span><b>My routine</b><small>${now ? (routineComplete(now) ? 'Done! ✅' : `${steps} of ${now.steps.length}`) : 'None yet'}</small></button>
      <button class="lt" data-action="go" data-to="treats" style="--t:#ec4899"><span class="lt-e">🎁</span><b>Treats</b><small>⭐ ${stars}</small></button>
      <button class="lt" data-action="go" data-to="wishes" style="--t:#8b5cf6"><span class="lt-e">💖</span><b>My wishes</b><small>${state.wishes.filter((w) => w.memberId === id).length}</small></button>
      ${money !== 'none' ? `<button class="lt" data-action="go" data-to="piggy" style="--t:#e85d8a"><span class="lt-e">🐷</span><b>My piggy</b><small>${money === 'one' ? (piggyTotal(id) || piggyOf(id).allowance ? money_(piggyTotal(id)) : 'Coming soon') : 'Jars'}</small></button>` : ''}
      <button class="lt" data-action="go" data-to="badges" style="--t:#10b981"><span class="lt-e">🌟</span><b>Stickers</b><small>${badgesFor(id).filter((b) => b.got).length}</small></button>
    </div>
    ${poll && typeof pollCard === 'function' ? `<div class="section-title">Vote!</div>${pollCard(poll)}` : ''}
    <button class="kid-exit" data-action="kid-exit">🔒 Grown-ups</button>`;
}
const money_ = (v) => money(v, { maximumFractionDigits: v % 1 ? 2 : 0 });

/* ---------- Simple jobs (chores) ---------- */
function simpleJobs(id) {
  const jobs = state.chores.filter((c) => c.memberId === id || !c.memberId);
  const todo = jobs.filter((c) => !choreDone(c)), done = kidChoreList(jobs.filter((c) => choreDone(c)));
  kidCheers(id);
  const tile = (c) => {
    const k = kidChoreState(c, id), stars = `<span class="job-stars">${'⭐'.repeat(Math.min(5, Number(c.points) || 1))}</span>`;
    if (k.done && !k.mine) { const by = k.by ? member(k.by) : null; return `<div class="job done other"><div class="job-main"><span class="chore-pic">${esc(choreEmoji(c))}</span><b>${esc(c.title)}<small class="job-by">${by ? `${esc(by.name)} did it 🙌` : 'Already done 🙌'}</small></b>${by ? avatar(by, true) : ''}</div></div>`; }
    return `<div class="job${k.done ? ' done' : ''}">
      <button class="job-main" data-action="toggle-chore" data-id="${c.id}"><span class="chore-pic">${esc(choreEmoji(c))}</span><b>${esc(c.title)}${k.wait ? '<small class="job-by"><span class="wait-chip">⏳ Waiting for OK</span></small>' : ''}</b>${k.wait ? '' : stars}<span class="check${k.done ? ' on' : ''}">${ICON.check}</span></button>
      ${sayBtn(id, c.title)}</div>`;
  };
  return `${todo.map(tile).join('') || '<div class="card empty"><span class="big">🎉</span>All your jobs are done!</div>'}
    ${done.length ? `<div class="section-title">Done</div>${done.map(tile).join('')}` : ''}`;
}

/* ---------- Simple treats (rewards) ---------- */
views.treats = () => {
  const id = kidModeId() || kids()[0]?.id;
  if (!id) return '';
  const stars = pointsBalance(id);
  const pending = (state.redemptions || []).filter((r) => r.memberId === id && r.status === 'pending');
  return `<div class="card star-bank"><span class="art-slot" data-art-id="cur_star">⭐</span><b>${stars}</b><small>stars to spend</small></div>
    ${pending.map((r) => `<div class="card little-wait">⏳ Waiting for Mom or Dad: <b>${esc(state.rewards.find((x) => x.id === r.rewardId)?.name || 'treat')}</b></div>`).join('')}
    ${rewardsFor(id).length ? `<div class="treat-grid">${rewardsFor(id).map((r) => {
      const cost = rewardCost(r, id), can = stars >= cost;
      return `<button class="treat${can ? ' can' : ''}" data-action="treat-ask" data-id="${r.id}">
        <span class="t-e">${esc(r.emoji || '🎁')}</span><b>${esc(r.name)}</b>
        <span class="t-cost">⭐ ${cost}</span>
        ${can ? '<span class="t-go">I want this!</span>' : `<span class="t-need"><i style="width:${Math.min(100, (stars / cost) * 100)}%"></i></span><small>${cost - stars} more ⭐</small>`}
      </button>`;
    }).join('')}</div>` : inKidMode() ? askTreatsCard(id) : '<div class="card empty">No treats yet.</div>'}`;
};

/* ---------- One-step-at-a-time routine ---------- */
function focusRoutine(r, id) {
  const done = routineDone(r);
  const next = r.steps.find((s) => !done[s.id]);
  const n = r.steps.filter((s) => done[s.id]).length;
  if (!next) {
    return `<div class="card focus done"><div class="focus-emoji">${(r.stars || {})[today()] ? '✅' : '🎉'}</div><div class="focus-text">You did it!</div><div class="small muted">${esc(r.name)} is all done${(r.stars || {})[today()] ? ' — <span class="ontime-chip">✅ On time!</span>' : ''}</div>
      <button class="mini-btn" data-action="routine-undo" data-r="${r.id}">Oops, undo</button></div>`;
  }
  return `<div class="card focus">
    <div class="focus-head"><span>${esc(r.emoji)} ${esc(r.name)}</span><span class="dots">${r.steps.map((s) => `<i class="${done[s.id] ? 'on' : s.id === next.id ? 'now' : ''}"></i>`).join('')}</span></div>
    <div class="focus-emoji">${esc(next.emoji)}</div>
    <div class="focus-text">${esc(next.text)} ${sayBtn(id, next.text)}</div>
    <button class="btn block focus-done" data-action="routine-step" data-r="${r.id}" data-s="${next.id}">Done! ✓</button>
    <div class="small muted" style="text-align:center;margin-top:8px">Step ${n + 1} of ${r.steps.length}${r.by ? ` · finish by ${fmtTime(r.by)} to be on time` : ''}</div>
  </div>`;
}

/* ---------- Simple piggy (one jar) ---------- */
function onePiggy(id, kid) {
  const pg = piggyOf(id), total = piggyTotal(id), goal = pg.goal;
  const max = Math.max(goal?.amount || 0, total, 10);
  return `<div class="card one-piggy">
    <div class="big-pig">${jarSVG(total / max, '#e85d8a')}</div>
    <div class="pig-total">${money_(total)}</div>
    <div class="small muted">${kid ? 'in my piggy bank' : 'in the piggy bank'}</div>
    ${goal ? `<div class="pig-goal"><span>${esc(goal.name)}</span><div class="bar"><i style="width:${Math.min(100, (total / goal.amount) * 100)}%;background:#e85d8a"></i></div><small>${total >= goal.amount ? '🎉 You have enough!' : `${money_(goal.amount - total)} more`}</small></div>` : ''}
  </div>`;
}

/* ---------- Simple stickers ---------- */
function stickerBook(id) {
  const bs = badgesFor(id), got = bs.filter((b) => b.got), next = bs.filter((b) => !b.got).slice(0, 3);
  return `<div class="sticker-grid">${got.map((b) => `<div class="sticker"><span class="art-slot" data-art-id="${b.art}">${b.emoji}</span><b>${esc(b.name)}</b></div>`).join('') || '<div class="card empty" style="grid-column:1/-1">Do jobs and routines to earn stickers! 🌟</div>'}</div>
    ${next.length ? `<div class="section-title">Next stickers</div><div class="sticker-grid">${next.map((b) => `<div class="sticker locked"><span class="art-slot" data-art-id="${b.art}" style="filter:grayscale(1);opacity:.45">${b.emoji}</span><b>${esc(b.how)}</b></div>`).join('')}</div>` : ''}`;
}

/* =========================================================
   Wire Simple mode into the kid views
   ========================================================= */
const _kidView = views.kid;
views.kid = () => { const id = simpleKid(); return id ? simpleHome(id) : _kidView(); };

const _choresKid = views.chores;
views.chores = () => (simpleKid() ? simpleJobs(simpleKid()) : _choresKid());

const _routinesKid = views.routines;
views.routines = () => {
  const id = simpleKid();
  if (!id) return _routinesKid();
  const rs = state.routines.filter((r) => r.memberId === id);
  if (!rs.length) return '<div class="card empty"><span class="big">🌅</span>No routine yet — ask a grown-up!</div>';
  const now = rs.find((r) => r.part === partOfDay()) || rs[0];
  const sel = rs.find((r) => r.id === ui.focusRoutine) || now;
  return `${rs.length > 1 ? `<div class="segmented">${rs.map((r) => `<button class="${r.id === sel.id ? 'active' : ''}" data-action="focus-routine" data-id="${r.id}">${esc(r.emoji)} ${esc(r.name.replace(/ routine$/i, ''))}</button>`).join('')}</div>` : ''}${focusRoutine(sel, id)}`;
};

const _piggyKid = views.piggy;
views.piggy = (pid) => {
  const id = inKidMode() ? kidModeId() : (pid || kids()[0]?.id);
  const mode = id ? moneyMode(id) : 'jars';
  if (!id || mode === 'jars') return _piggyKid(pid);
  if (mode === 'none') {
    return inKidMode() ? '<div class="card empty">🐷 No piggy bank yet!</div>'
      : `${kids().length > 1 ? `<div class="segmented">${kids().map((k) => `<button class="${k.id === id ? 'active' : ''}" data-action="go" data-to="piggy/${k.id}">${esc(k.emoji)} ${esc(k.name)}</button>`).join('')}</div>` : ''}<div class="card empty"><span class="big">🐷</span>Money is turned off for ${esc(member(id).name)}.<br><button class="btn" style="margin-top:12px" data-action="kid-settings" data-id="${id}">Kid settings</button></div>`;
  }
  const pg = piggyOf(id);
  const log = [...pg.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  return `${!inKidMode() && kids().length > 1 ? `<div class="segmented">${kids().map((k) => `<button class="${k.id === id ? 'active' : ''}" data-action="go" data-to="piggy/${k.id}">${esc(k.emoji)} ${esc(k.name)}</button>`).join('')}</div>` : ''}
    ${onePiggy(id, inKidMode())}
    ${inKidMode() ? '' : `<div class="btn-row"><button class="btn" data-action="piggy-add" data-id="${id}">＋ Add money</button><button class="btn secondary" data-action="piggy-spend" data-id="${id}">− Spend</button></div>
      <div class="btn-row" style="margin-top:0"><button class="btn secondary" data-action="piggy-allowance" data-id="${id}">💵 Allowance</button><button class="btn secondary" data-action="piggy-goal" data-id="${id}">🎯 Goal</button></div>
      <div class="section-title">History</div>
      <div class="card flush">${log.map((x) => `<div class="row"><div class="avatar">🐷</div><div class="grow"><div class="title">${esc(x.note || (x.amount >= 0 ? 'Added' : 'Spent'))}</div><div class="sub">${fmtDate(x.date)}</div></div><span class="amount ${x.amount >= 0 ? 'income' : ''}">${x.amount >= 0 ? '+' : '−'}${money(Math.abs(x.amount))}</span></div>`).join('') || '<div class="empty small">No money yet.</div>'}</div>`}`;
};

const _badgesKid = views.badges;
views.badges = (pid) => (simpleKid() ? stickerBook(simpleKid()) : _badgesKid(pid));

// Kid tab bar depends on the kid's settings (simple mode / money mode)
applyKidChrome = (() => {
  const base = applyKidChrome;
  return function () {
    base();
    const id = kidModeId(), bar = $('.tabbar');
    if (id && bar?.dataset.kid) {
      const want = isSimple(id) ? `s:${moneyMode(id)}` : `f:${moneyMode(id)}`;
      if (bar.dataset.kidLayout !== want) {
        const tabs = isSimple(id)
          ? [['kid', '🏠', 'Home'], ['chores', '🧹', 'Jobs'], ['routines', '🌅', 'Routine'], ['treats', '🎁', 'Treats'], ['wishes', '💖', 'Wishes']]
          : [['kid', '🏠', 'Home'], ['chores', '🧹', 'Chores'], ['play', '🎮', 'Play'], moneyMode(id) === 'none' ? ['treats', '🎁', 'Rewards'] : ['piggy', '🐷', 'Piggy'], ['wishes', '🎁', 'Wishes']];
        bar.innerHTML = `<span class="tab-ink" aria-hidden="true"></span>${tabs.map(([to, e, l]) => `<button data-action="go" data-to="${to}" data-tab="${to}"><span class="kt">${e}</span><span>${l}</span></button>`).join('')}`;
        bar.dataset.kidLayout = want;
      }
    } else if (bar) delete bar.dataset.kidLayout;
    document.body.classList.toggle('little-mode', !!simpleKid());
  };
})();

// Page titles match the simple tab names
const BASE_TITLES = { chores: TITLES.chores, routines: TITLES.routines, badges: TITLES.badges, wishes: TITLES.wishes, piggy: TITLES.piggy };
const SIMPLE_TITLES = { chores: 'My jobs', routines: 'My routine', badges: 'Stickers', wishes: 'My wishes', piggy: 'My piggy' };
const _routeForTitles = currentRoute;
currentRoute = function () { Object.assign(TITLES, simpleKid() ? SIMPLE_TITLES : BASE_TITLES); return _routeForTitles(); };

KID_ROUTES.push('treats');
for (const a of ['treat-ask', 'say', 'focus-routine', 'routine-undo']) KID_ACTIONS.add(a);

/* ---------- Wish form for little kids ---------- */
const _wishNew = actions['wish-new'];
const BIG_WISH_EMOJI = ['🧸', '🦄', '🎨', '📚', '🚲', '⚽', '🎮', '🪀', '🧩', '👗', '🐶', '🍦', '🎤', '🛼', '🎁', '🌈'];
function littleWishForm(id) {
  openSheet({
    title: '💖 I wish for…',
    saveLabel: 'Add',
    values: { emoji: '🎁' },
    fields: [
      { type: 'html', html: `<div class="emoji-pick">${BIG_WISH_EMOJI.map((e) => `<button type="button" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>` },
      { row: [{ name: 'emoji', label: 'Picture', placeholder: '🎁' }, { name: 'title', label: 'What is it?', required: true, placeholder: 'e.g. Unicorn' }] },
    ],
    onSave(v) { state.wishes.push({ id: uid(), added: today(), memberId: id, emoji: v.emoji || '🎁', title: v.title, priority: 2 }); setTimeout(confetti, 100); },
  });
}

/* ---------- Kid settings (parent) ---------- */
function kidSettingsSheet(id) {
  const m = member(id);
  openSheet({
    title: `⚙️ ${m.name}'s settings`,
    values: { simple: !!m.simple, money: moneyMode(id), readAloud: m.readAloud !== false, choreOk: m.choreOk || 'off', playLock: !!m.playLock, weeklyGoal: m.weeklyGoal || '' },
    fields: [
      { name: 'simple', label: 'Simple mode', type: 'checkbox', hint: 'For younger kids (about 4–8): big buttons, ⭐ stars, one step at a time, stickers' },
      { name: 'money', label: 'Money', type: 'select', options: [{ value: 'none', label: '🚫 No money — just stars & treats' }, { value: 'one', label: '🐷 One piggy bank' }, { value: 'jars', label: '🫙 Save / Spend / Give jars' }] },
      { name: 'readAloud', label: '🔊 Read-aloud buttons', type: 'checkbox', hint: 'Taps read jobs and routine steps out loud' },
      { name: 'choreOk', label: '✅ Chores need my OK', type: 'select', options: [{ value: 'off', label: 'Off — stars right away' }, { value: 'big', label: 'Big chores only (3+ ⭐)' }, { value: 'all', label: 'All chores' }] },
      { name: 'playLock', label: '🔒 Play unlocks after today’s jobs', type: 'checkbox', hint: 'Games, Squishies & the Dream House open once their own chores are done' },
      { name: 'weeklyGoal', label: '🎯 Weekly star goal', type: 'number', placeholder: `${weekGoal(id)} (from their chores)` },
    ],
    onSave(v) { Object.assign(m, { simple: v.simple, money: v.money, readAloud: v.readAloud, choreOk: v.choreOk, playLock: v.playLock, weeklyGoal: v.weeklyGoal > 0 ? Math.round(v.weeklyGoal) : null }); toast(`${m.name}'s settings saved`); },
  });
}

/* ---------- Actions ---------- */
const _allowance = actions['piggy-allowance'], _pAdd = actions['piggy-add'], _pSpend = actions['piggy-spend'];
Object.assign(actions, {
  'say': (el) => speak(el.dataset.text),
  'focus-routine': (el) => { ui.focusRoutine = el.dataset.id; render(); },
  'routine-undo': (el) => { const r = findIn(state.routines, el.dataset.r); delete (r.done || {})[today()]; delete (r.stars || {})[today()]; save(); render(); },
  'kid-settings': (el) => kidSettingsSheet(el.dataset.id),
  'wish-new': (el) => (simpleKid() ? littleWishForm(simpleKid()) : _wishNew(el)),
  'treat-ask': (el) => {
    const id = kidModeId(), r = findIn(state.rewards, el.dataset.id);
    if (!r || !rewardFor(r, id)) return;
    const stars = pointsBalance(id), cost = rewardCost(r, id);
    if (stars < cost) { toast(`You need ${cost - stars} more ⭐ — keep going!`); speak(`You need ${cost - stars} more stars. Keep going!`); return; }
    if ((state.redemptions || []).some((x) => x.memberId === id && x.rewardId === r.id && x.status === 'pending')) { toast('Already asked — waiting for Mom or Dad'); return; }
    (state.redemptions ||= []).push({ id: uid(), rewardId: r.id, memberId: id, cost, at: Date.now(), status: 'pending' });
    save(); render(); confetti();
    celebrate('🙌 Asked!', `Mom or Dad will say yes to “${r.name}” soon.`);
  },
  // One-jar / no-money kids: no jar choices
  'piggy-allowance': (el) => {
    const id = el.dataset.id;
    if (moneyMode(id) === 'jars') return _allowance(el);
    const pg = piggyOf(id), a = pg.allowance || { amount: 3, day: 6 };
    openSheet({
      title: `💵 ${member(id).name}'s allowance`,
      values: { amount: a.amount, day: a.day },
      fields: [{ row: [{ name: 'amount', label: 'Every week', type: 'money', placeholder: '0 = none' }, { name: 'day', label: 'Paid on', type: 'select', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => ({ value: i, label: d })) }] }],
      onSave(v) { const wasOn = !!pg.allowance?.amount; pg.allowance = v.amount ? { amount: v.amount, day: Number(v.day), split: { save: 0, spend: 100, give: 0 } } : null; if (!pg.lastPaid || !wasOn) pg.lastPaid = addDays(today(), -1); toast(v.amount ? 'Allowance set — goes into the piggy bank' : 'Allowance off'); },
    });
  },
  'piggy-add': (el) => (moneyMode(el.dataset.id) === 'jars' ? _pAdd(el) : onePiggyMoney(el.dataset.id, 1)),
  'piggy-spend': (el) => (moneyMode(el.dataset.id) === 'jars' ? _pSpend(el) : onePiggyMoney(el.dataset.id, -1)),
});
function onePiggyMoney(id, sign) {
  openSheet({
    title: sign > 0 ? `＋ Add to ${member(id).name}'s piggy` : `− Spend from ${member(id).name}'s piggy`,
    values: {},
    fields: [{ name: 'amount', label: 'Amount', type: 'money', required: true }, { name: 'note', label: 'What for?', placeholder: sign > 0 ? 'e.g. Tooth fairy 🦷' : 'e.g. Toy at Target' }],
    onSave(v) {
      if (sign < 0 && piggyTotal(id) < v.amount) { toast(`Only ${money(piggyTotal(id))} in the piggy`); return false; }
      piggyOf(id).log.push({ id: uid(), date: today(), jar: 'spend', amount: Math.abs(v.amount) * sign, note: v.note });
    },
  });
}

// Kids hub: a settings button + "Simple" tag on each kid card
const _kidsView = views.kids;
views.kids = () => _kidsView()
  .replace(/<button class="btn secondary" data-action="kid-mode-on" data-id="([^"]+)">/g, '<button class="btn secondary" data-action="kid-settings" data-id="$1">⚙️ Kid settings</button><button class="btn secondary" data-action="kid-mode-on" data-id="$1">')
  .replace(/(<div class="kid-av sm">[^<]*<\/div>\s*<div style="flex:1;min-width:0"><b style="font-size:18px">)([^<]*)<\/b>/g, (all, pre, name) => {
    const k = kids().find((x) => esc(x.name) === name);
    return `${pre}${name}</b>${k && k.simple ? ' <span class="pill accent">Simple</span>' : ''}`;
  });
// Pre-readers: hear the name of any tile, tab, sticker, treat or wish they tap
document.addEventListener('click', (e) => {
  const id = simpleKid();
  if (!id || !readAloudOn(id) || e.target.closest('.say')) return;
  const el = e.target.closest('.tile, .lt, .tabbar button, .sticker, .treat.can, .wish');
  const label = el && (el.querySelector('b') || el.querySelector('span:last-child'))?.textContent.trim();
  if (label) speak(label);
}, true);
