/* Notifications: personal, bundled, and few.
   Three summaries you choose the time of (end of day, end of week, start of month) carry the routine stuff:
   bills due tomorrow, paydays and what to set aside, tomorrow's events. Only two things arrive on their own:
   budget alerts (one bundled message per run) and family messages / event reminders. Quiet hours hold alerts
   until morning.

   How it's delivered: each phone subscribes to Web Push (state.notify.subs, synced with the family). A
   scheduled GitHub Actions job (tools/notify/send.cjs) opens this app headless with the family's synced data,
   calls notifyPlan() below to decide what's due, and sends it. The decisions live here, so the preview in
   Settings is exactly what the server sends. Loaded after level.js. */
'use strict';

const NOTIFY_DEF = {
  daily: { on: true, time: '20:30' },
  weekly: { on: true, day: 0, time: '19:00' },
  monthly: { on: true, time: '09:00' },
  alerts: { on: true, near: true, over: true, big: 200, tight: true },
  family: { on: true, chat: true, events: true },
  quiet: { on: true, from: '21:30', to: '07:00' },
};
const notifyCfg = () => (state.notify ||= { subs: [], prefs: {} });
function notifyPrefs(mid) {
  const p = (state.notify?.prefs || {})[mid] || {}, out = {};
  for (const [k, v] of Object.entries(NOTIFY_DEF)) out[k] = { ...v, ...(p[k] || {}) };
  return out;
}
const npMin = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const npQuiet = (mins, q) => { const a = npMin(q.from), b = npMin(q.to); return a <= b ? mins >= a && mins < b : mins >= a || mins < b; };
const everydayBetween = (from, to) => sum(state.budget.transactions.filter((x) => x.type !== 'income' && !isBillOnly(x) && x.date >= from && x.date <= to), (x) => x.amount);

/* ---------- The three summaries ---------- */
function dailyDigest(mid) {
  const t = today(), tm = addDays(t, 1), kid = isKidMember(mid), lines = [];
  let title = 'Today';
  if (!kid) {
    const day = everydayBetween(t, t), P = catPace(monthKey(t));
    title = day ? `Today: ${moneyW(day)} spent` : 'Today: no spending 🎉';
    lines.push(`Month so far ${moneyW(P.total.spent)} · on pace for ~${moneyW(P.total.likely)}${P.total.limit ? ` (budget ${moneyW(P.total.limit)})` : ''}`);
    const over = P.cats.filter((x) => x.lim && x.spent > x.lim + 0.5).sort((a, b) => (b.spent - b.lim) - (a.spent - a.lim)).slice(0, 2);
    if (over.length) lines.push(`Over budget: ${over.map((x) => `${x.c.name} +${moneyW(x.spent - x.lim)}`).join(', ')}`);
    const tmr = recurringBetween(tm, tm).filter((x) => !isPaid(x.b, x.date));
    const bills = tmr.filter((x) => x.b.type !== 'income'), pay = tmr.filter((x) => x.b.type === 'income');
    if (bills.length || pay.length) lines.push('Tomorrow: ' + [...pay.map((x) => `💰 ${x.b.name} +${moneyW(x.amount)}`), ...bills.slice(0, 3).map((x) => `${x.b.name} ${moneyW(x.amount)}`), bills.length > 3 ? `+${bills.length - 3} more` : ''].filter(Boolean).join(' · '));
    if (pay.length && typeof crunches === 'function') {
      const cs = crunches().filter((c) => { const g = state.goals.find((x) => x.id === c.id); return !g || goalSaved(g) < g.target; });
      if (cs.length) lines.push(`Payday plan: set aside ${moneyW(sum(cs, (c) => c.per))} for 🛟 ${cs.map((c) => shortD(c.r.from)).join(', ')}`);
    }
  } else {
    const left = state.chores.filter((c) => c.memberId === mid && c.freq !== 'once' && !choreDone(c));
    title = left.length ? `${left.length} chore${left.length > 1 ? 's' : ''} left today` : 'All chores done today ⭐';
  }
  const evs = eventsOn(tm).filter((e) => e.kind === 'event' && (!e.whoIds?.length || e.whoIds.includes(mid) || !kid));
  if (evs.length) lines.push(`📅 Tomorrow: ${evs.slice(0, 2).map((e) => e.title + (e.time ? ' ' + fmtTime(e.time) : '')).join(', ')}${evs.length > 2 ? ` +${evs.length - 2}` : ''}`);
  return { title, body: lines.join('\n'), url: kid ? '#kid' : '#budget' };
}
function weeklyDigest() {
  const t = today(), from = addDays(t, -6), pf = addDays(t, -13), pt = addDays(t, -7);
  const week = everydayBetween(from, t), prev = everydayBetween(pf, pt);
  const byCat = {};
  for (const x of state.budget.transactions) if (x.type !== 'income' && !isBillOnly(x) && x.date >= from && x.date <= t) { const c = catOf(x.categoryId); const k = c ? c.name : 'Uncategorized'; byCat[k] = (byCat[k] || 0) + x.amount; }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const next = recurringBetween(addDays(t, 1), addDays(t, 7)).filter((x) => !isPaid(x.b, x.date));
  const nb = next.filter((x) => x.b.type !== 'income'), np = next.filter((x) => x.b.type === 'income');
  const lines = [];
  if (prev) lines.push(`${week > prev ? '▲' : '▼'} ${moneyW(Math.abs(week - prev))} vs last week`);
  if (top.length) lines.push(`Top: ${top.map(([k, v]) => `${k} ${moneyW(v)}`).join(', ')}`);
  if (nb.length || np.length) lines.push(`Next 7 days: ${nb.length ? `${nb.length} bill${nb.length > 1 ? 's' : ''} ${moneyW(sum(nb, (x) => x.amount))}` : 'no bills'}${np.length ? ` · payday ${np.map((x) => fmtDate(x.date, { weekday: 'short' })).join(' & ')}` : ''}`);
  return { title: `This week: ${moneyW(week)} everyday spending`, body: lines.join('\n'), url: '#budget' };
}
function monthlyDigest(ym) {
  const P = catPace(ym), s = budgetSummary(ym), out = s.spent + s.bills, net = s.income - out;
  const mName = parse(ym + '-01').toLocaleDateString(undefined, { month: 'long' });
  const lines = [`In ${moneyW(s.income)} · out ${moneyW(out)} · ${net >= 0 ? `saved ${moneyW(net)}` : `${moneyW(-net)} more out than in`}`];
  const T = P.total;
  if (T.usual !== null && Math.abs(T.spent - T.usual) >= 50) lines.push(`Everyday ${moneyW(Math.abs(T.spent - T.usual))} ${T.spent < T.usual ? 'less' : 'more'} than a usual month`);
  const over = P.cats.filter((x) => x.lim && x.spent > x.lim + 0.5).sort((a, b) => (b.spent - b.lim) - (a.spent - a.lim)).slice(0, 2);
  if (over.length) lines.push(`Over budget: ${over.map((x) => `${x.c.name} +${moneyW(x.spent - x.lim)}`).join(', ')}`);
  lines.push('Tap to review budgets for the new month');
  return { title: `${mName} wrap-up`, body: lines.join('\n'), url: '#budget' };
}

/* ---------- Things that can't wait (bundled per run) ---------- */
function alertDigest(mid, P, log) {
  const t = today(), ym = monthKey(t), now = Date.now(), items = [], mark = {};
  const C = catPace(ym), daysLeft = C.dim - C.day + 1;
  for (const x of C.cats) {
    if (!x.lim) continue;
    const kO = `over:${mid}:${x.key}:${ym}`, kN = `near:${mid}:${x.key}:${ym}`, f = x.spent / x.lim;
    if (P.alerts.over && x.spent > x.lim + 0.5) { if (!log[kO]) { items.push(`${x.c.emoji} ${x.c.name} is over budget by ${moneyW(x.spent - x.lim)}`); mark[kO] = now; mark[kN] = now; } }
    else if (P.alerts.near && f >= 0.8 && !log[kN]) { items.push(`${x.c.emoji} ${x.c.name} at ${Math.round(f * 100)}%: ${moneyW(x.lim - x.spent)} left for ${daysLeft} days`); mark[kN] = now; }
  }
  const big = Number(P.alerts.big) || 0;
  if (big) for (const x of state.budget.transactions) {
    const k = `big:${mid}:${x.id}`;
    if (x.type === 'income' || isBillOnly(x) || x.amount < big || x.date < addDays(t, -2) || log[k]) continue;
    items.push(`💳 ${money(x.amount)} at ${x.note || catOf(x.categoryId)?.name || 'a store'}`); mark[k] = now;
  }
  if (P.alerts.tight && typeof crunches === 'function') for (const c of crunches()) {
    const k = `tight:${mid}:${c.id}`;
    if (daysBetween(t, c.r.from) > 21 || log[k]) continue;
    items.push(`🛟 ${shortD(c.r.from)} paycheck will be tight: ${crunchWhy(c)}`); mark[k] = now;
  }
  if (!items.length) return null;
  return { kind: 'alert', title: items.length > 1 ? `Budget alerts (${items.length})` : 'Budget alert', body: items.join('\n'), url: '#budget', tag: 'alert', mark };
}
function familyDigest(mid, P, log) {
  const out = [], now = Date.now();
  if (P.family.chat) {
    const kc = `chat:${mid}`, since = log[kc] || now - 2 * 3600e3;
    const fresh = state.chat.filter((m) => m.at > since && m.who !== mid).sort((a, b) => a.at - b.at);
    if (fresh.length) {
      const last = fresh.at(-1), who = state.members.find((m) => m.id === last.who)?.name || 'Family';
      out.push({ kind: 'chat', title: fresh.length > 1 ? `💬 ${fresh.length} new messages` : `💬 ${who}`, body: (fresh.length > 1 ? `${who}: ` : '') + String(last.text || '').slice(0, 140), url: '#chat', tag: 'chat', mark: { [kc]: last.at } });
    }
  }
  if (P.family.events) {
    const d = new Date(now), mins = d.getHours() * 60 + d.getMinutes(), t = today(), kid = isKidMember(mid);
    for (const e of eventsOn(t)) {
      if (e.kind !== 'event' || !e.time || (kid && e.whoIds?.length && !e.whoIds.includes(mid))) continue;
      const k = `ev:${mid}:${e.id}:${t}`, start = npMin(e.time);
      if (start > mins && start - mins <= 60 && !log[k]) out.push({ kind: 'event', title: `📅 ${e.title} at ${fmtTime(e.time)}`, body: e.location ? `📍 ${e.location}` : 'In less than an hour', url: '#calendar', tag: 'ev-' + e.id, mark: { [k]: now } });
    }
  }
  return out;
}

/* What's due right now for these people. log = keys already sent (the server keeps it), so nothing repeats.
   opts.force: ignore times and the log (Settings preview). */
function notifyPlan(log = {}, members = [], opts = {}) {
  const now = new Date(), t = today(), mins = now.getHours() * 60 + now.getMinutes(), out = [];
  const due = (time) => opts.force || (mins >= npMin(time) && mins - npMin(time) < 180); // a late scheduler still delivers
  for (const mid of members) {
    if (!state.members.some((m) => m.id === mid)) continue;
    const P = notifyPrefs(mid), kid = isKidMember(mid);
    const add = (m, key) => { if (!m || (!opts.force && key && log[key])) return; out.push({ member: mid, ...m, key: key || Object.keys(m.mark || {})[0], mark: { ...(key ? { [key]: Date.now() } : {}), ...(m.mark || {}) } }); };
    try {
      if (P.daily.on && due(P.daily.time)) add({ kind: 'daily', tag: 'daily', ...dailyDigest(mid) }, `d:${mid}:${t}`);
      if (!kid && P.weekly.on && (opts.force || now.getDay() === Number(P.weekly.day)) && due(P.weekly.time)) add({ kind: 'weekly', tag: 'weekly', ...weeklyDigest() }, `w:${mid}:${t}`);
      if (!kid && P.monthly.on && (opts.force || t.slice(8) === '01') && due(P.monthly.time)) add({ kind: 'monthly', tag: 'monthly', ...monthlyDigest(addMonths(monthKey(t), -1)) }, `m:${mid}:${monthKey(t)}`);
      const quiet = P.quiet.on && npQuiet(mins, P.quiet) && !opts.force; // held, not lost: the next run after quiet hours sends it
      if (!quiet && !kid && P.alerts.on) add(alertDigest(mid, P, opts.force ? {} : log));
      if (!quiet && P.family.on) for (const m of familyDigest(mid, P, opts.force ? {} : log)) add(m);
    } catch (e) { if (typeof noteError === 'function') noteError('notify', e); }
  }
  return out;
}
window.notifyPlan = notifyPlan;

/* ---------- This phone's push subscription ---------- */
// b64u / unb64u come from plus.js (base64url helpers)
function deviceId() { let id = ''; try { id = localStorage.getItem('gomezfam:device') || ''; if (!id) { id = 'dev-' + uid(); localStorage.setItem('gomezfam:device', id); } } catch { id = 'dev-tmp'; } return id; }
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const mySub = () => (state.notify?.subs || []).find((s) => s.id === deviceId());
async function pushOn() {
  const me = actor();
  if (!me) { toast('Pick who uses this phone first (Settings)'); return; }
  if (!pushSupported()) { toast(/iPhone|iPad/.test(navigator.userAgent) && !isStandalone() ? 'On iPhone: Share → Add to Home Screen, then open it from there' : 'This browser can’t do notifications'); return; }
  const key = state.notify?.vapid;
  if (!key) { toast('Push isn’t set up for the family yet'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications are blocked: allow them in Settings for this app'); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && b64u(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== key) { await sub.unsubscribe(); sub = null; }
    sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
    const j = sub.toJSON(), cfg = notifyCfg();
    cfg.subs = (cfg.subs || []).filter((s) => s.id !== deviceId() && s.endpoint !== j.endpoint);
    cfg.subs.push({ id: deviceId(), member: me, kid: typeof inKidMode === 'function' && inKidMode(), endpoint: j.endpoint, keys: j.keys, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, device: /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer', added: today() });
    save(); render(); toast('Notifications on for this phone ✓');
  } catch (e) { toast('Couldn’t turn on notifications: ' + (e.message || e)); }
}
async function pushOff() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch { /* already gone */ }
  const cfg = notifyCfg(); cfg.subs = (cfg.subs || []).filter((s) => s.id !== deviceId());
  save(); render(); toast('Notifications off for this phone');
}
// The subscription follows "who uses this phone"
const _afterRenderNotify = afterRender;
afterRender = function () {
  _afterRenderNotify();
  const s = mySub(), me = actor();
  if (s && me && s.member !== me) { s.member = me; save(); }
};
// One-time family setup: a key pair for Web Push. The public half is shared with the family's phones;
// the private half is shown once to paste into GitHub (it's never saved in the app).
async function pushKeysSheet() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), priv = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d;
  const copy = (label, v) => `<div class="field"><label>${label}</label><div class="np-key"><code>${esc(v)}</code><button type="button" class="mini-btn" data-action="np-copy" data-v="${esc(v)}">Copy</button></div></div>`;
  openSheet({
    title: 'Set up phone notifications', saveLabel: 'I added them',
    fields: [{ type: 'html', html: `<p class="small muted" style="margin-top:0">Phone notifications are sent by a free scheduled job in your GitHub repository. It needs three secrets. Add each one in GitHub → your repo → <b>Settings → Secrets and variables → Actions → New repository secret</b>.</p>
      ${copy('1 · VAPID_PUBLIC_KEY', pub)}${copy('2 · VAPID_PRIVATE_KEY (shown only now)', priv)}
      ${(() => {
        // The family's Firebase project is already known from sync: link straight to its service-account page
        const pid = typeof Sync !== 'undefined' && Sync.cfg?.config?.projectId;
        const url = pid ? `https://console.firebase.google.com/project/${encodeURIComponent(pid)}/settings/serviceaccounts/adminsdk` : 'https://console.firebase.google.com/';
        return `<div class="field"><label>3 · FIREBASE_SERVICE_ACCOUNT</label><p class="small muted" style="margin:0 0 6px">${pid ? `Your family syncs through the Firebase project <b>${esc(pid)}</b>.` : 'This phone isn’t syncing yet, so the project isn’t known here; open setup on a phone that syncs.'} Sign in with the Google account that created it, tap <b>Generate new private key</b>, and paste the whole downloaded file as the secret's value. Then delete the file.</p><a class="btn secondary block" href="${esc(url)}" target="_blank" rel="noopener">Open ${pid ? esc(pid) : 'Firebase console'} → Service accounts</a></div>`;
      })()}
      <p class="small muted">Tap “I added them” to save the public key for the family. Then turn notifications on from each phone.</p>` }],
    onSave() { notifyCfg().vapid = pub; notifyCfg().keyAt = today(); toast('Saved. Now turn on notifications on each phone'); },
  });
}

/* ---------- Settings → Notifications ---------- */
views.notify = () => {
  const me = actor(), cfg = state.notify || {}, sub = mySub(), P = me ? notifyPrefs(me) : null, kid = me && isKidMember(me);
  const subs = (cfg.subs || []), who = (id) => state.members.find((m) => m.id === id)?.name || '?';
  const tog = (path, on, label, hint = '') => `<label class="toggle-row"><span>${label}${hint ? `<br><span class="small muted">${hint}</span>` : ''}</span><input type="checkbox" data-np="${path}" ${on ? 'checked' : ''}></label>`;
  const time = (path, v) => `<input type="time" class="np-time" data-np="${path}" value="${esc(v)}">`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const setup = !cfg.vapid
    ? `<div class="card"><h3>Set up once for the family</h3><p class="small muted" style="margin-top:0">Phone notifications need a one-time setup (about 5 minutes) on a computer or phone with your GitHub account.</p><button class="btn block" data-action="np-keys">Start setup</button></div>`
    : `<div class="card"><h3>This phone</h3>${sub
      ? `<div class="kv"><span>🔔 On for <b>${esc(who(sub.member))}</b></span><button class="mini-btn" data-action="np-off">Turn off</button></div>`
      : `<p class="small muted" style="margin-top:0">${pushSupported() ? 'Get your summaries and alerts here, even when the app is closed.' : /iPhone|iPad/.test(navigator.userAgent) ? 'On iPhone, notifications work from the Home Screen app: Share → <b>Add to Home Screen</b>, then open it from there.' : 'This browser can’t show notifications.'}</p>${pushSupported() ? '<button class="btn block" data-action="np-on">Turn on notifications</button>' : ''}`}
      ${subs.length ? `<div class="small muted" style="margin-top:8px">On for: ${subs.map((s) => `${esc(who(s.member))} (${esc(s.device || 'phone')})`).join(', ')}</div>` : ''}</div>`;
  if (!me) return setup + '<div class="card small muted">Pick who uses this phone in Settings to personalize notifications.</div>';
  return `${setup}
    <div class="section-title">Summaries <span class="np-note">bills, paydays and plans ride along</span></div>
    <div class="card np-card">
      ${tog('daily.on', P.daily.on, kid ? 'Evening check-in' : 'End of day', kid ? 'Chores left and tomorrow’s plans' : 'Today’s spending, what’s due tomorrow, payday plan')}${P.daily.on ? `<div class="np-sub">at ${time('daily.time', P.daily.time)}</div>` : ''}
      ${kid ? '' : `${tog('weekly.on', P.weekly.on, 'End of week', 'The week vs last week, top categories, next 7 days')}${P.weekly.on ? `<div class="np-sub"><select data-np="weekly.day">${days.map((d, i) => `<option value="${i}" ${+P.weekly.day === i ? 'selected' : ''}>${d}</option>`).join('')}</select> at ${time('weekly.time', P.weekly.time)}</div>` : ''}
      ${tog('monthly.on', P.monthly.on, 'Start of month', 'Last month’s wrap-up on the 1st')}${P.monthly.on ? `<div class="np-sub">on the 1st at ${time('monthly.time', P.monthly.time)}</div>` : ''}`}
      <button class="mini-btn" style="margin-top:8px" data-action="np-preview">Preview what I’d get</button>
    </div>
    ${kid ? '' : `<div class="section-title">Budget alerts <span class="np-note">bundled into one message</span></div>
    <div class="card np-card">
      ${tog('alerts.on', P.alerts.on, 'Budget alerts')}
      ${P.alerts.on ? `${tog('alerts.near', P.alerts.near, 'A category reaches 80%')}${tog('alerts.over', P.alerts.over, 'A category goes over budget')}${tog('alerts.tight', P.alerts.tight, 'A tight paycheck is coming', 'About 3 weeks ahead')}
      <div class="np-sub">Large charge over $<input type="number" inputmode="numeric" class="np-num" data-np="alerts.big" value="${esc(P.alerts.big)}"> <span class="small muted">(0 = off)</span></div>` : ''}
    </div>`}
    <div class="section-title">Family</div>
    <div class="card np-card">
      ${tog('family.on', P.family.on, 'Family')}${P.family.on ? `${tog('family.chat', P.family.chat, 'Chat messages', 'Several at once arrive as one')}${tog('family.events', P.family.events, 'Event reminders', '1 hour before timed events')}` : ''}
    </div>
    <div class="section-title">Quiet hours</div>
    <div class="card np-card">
      ${tog('quiet.on', P.quiet.on, 'Hold alerts and messages overnight', 'Summaries still come at the time you picked')}${P.quiet.on ? `<div class="np-sub">${time('quiet.from', P.quiet.from)} to ${time('quiet.to', P.quiet.to)}</div>` : ''}
    </div>
    ${cfg.vapid ? `<p class="small muted" style="text-align:center">Delivered by the family’s scheduled job, checked every ~30 minutes. <button class="link-inline" data-action="np-keys">Redo setup</button></p>` : ''}`;
};
document.addEventListener('change', (e) => {
  const el = e.target.closest?.('[data-np]'); if (!el) return;
  const me = actor(); if (!me) return;
  const [grp, key] = el.dataset.np.split('.'), cfg = notifyCfg();
  const p = ((cfg.prefs ||= {})[me] ||= {}), g = (p[grp] ||= {});
  g[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' || key === 'day' ? Number(el.value) || 0 : el.value;
  save(); render();
});
Object.assign(actions, {
  'np-on': () => pushOn(),
  'np-off': () => pushOff(),
  'np-keys': () => pushKeysSheet().catch((e) => toast('Couldn’t make keys: ' + e.message)),
  'np-copy': (el) => { navigator.clipboard?.writeText(el.dataset.v).then(() => toast('Copied'), () => toast('Select and copy it')); },
  'np-preview': () => {
    const me = actor(); const list = notifyPlan({}, [me], { force: true });
    openSheet({ title: 'Preview', saveLabel: 'Done', fields: [{ type: 'html', html: list.length ? list.map((m) => `<div class="np-prev"><div class="np-prev-k">${esc({ daily: 'End of day', weekly: 'End of week', monthly: 'Start of month', alert: 'Budget alert', chat: 'Chat', event: 'Event' }[m.kind] || m.kind)}</div><b>${esc(m.title)}</b><div>${esc(m.body).replace(/\n/g, '<br>')}</div></div>`).join('') : '<p class="muted">Nothing to send right now.</p>' }], onSave() {} });
  },
});
// Settings: a row into the Notifications screen
const _settingsNotify = views.settings;
views.settings = (p) => {
  const row = `<div class="card flush"><button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="notify"><div class="avatar">🔔</div><div class="grow"><div class="title">Notifications</div><div class="sub">${mySub() ? 'On for this phone' : 'Daily, weekly and monthly summaries · alerts'}</div></div>${ICON.chev}</button></div>`;
  const html = _settingsNotify(p), at = html.indexOf('<div class="section-title">Preferences</div>');
  return at >= 0 ? html.slice(0, at) + '<div class="section-title">Notifications</div>' + row + html.slice(at) : row + html;
};
if (typeof HUB !== 'undefined') { HUB.home.routes.push('notify'); HUB_OF.notify = 'home'; }
if (typeof TITLES !== 'undefined') TITLES.notify = 'Notifications';
