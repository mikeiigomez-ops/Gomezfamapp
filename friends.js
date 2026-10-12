/* Friends Circles 👯: connect with friend families. Each circle is its own shared record (circles/{id}) holding ONLY
   names/emoji, squishy showcases, friend chat and trades — family data (budget, calendar…) never leaves the family.
   Parents control everything per kid: on/off, chat (off / preset messages / free text with a safety filter),
   trading (off / needs my OK / free), reactions, quiet hours, daily limits and what's shared. Loaded after squish.js. */
'use strict';

Object.assign(TITLES, { friends: 'Friends', fchat: 'Friends Chat', friend: 'Friend', fcontrols: 'Parent Controls' });
const CIRCLE_KEY = 'gomezfam:circle', PENDING_CIRCLE_KEY = 'gomezfam:pendingCircle';
const DEFAULT_PRESETS = ['Hi! 👋', 'Want to trade? 🔁', 'Nice collection! 😍', 'I love your squishy! 🧸', 'Good game! 🎮', 'Thank you! 💖', 'See you at school! 🏫', 'LOL 😂', 'Yes! 👍', 'No thanks 🙂', 'BRB 🏃', 'Bye! 👋'];
const STICKERS = ['👋', '😍', '🧸', '💖', '😂', '🎉', '🔥', '🌈', '⭐', '🦄', '😎', '🥳'];
const RULE_DEFAULTS = { on: false, chat: 'preset', trade: 'approve', hearts: true, quiet: true, quietFrom: '20:00', quietTo: '07:00', msgs: 20, trades: 3, show: true };
const CIRCLE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyId} {
      function signedIn() { return request.auth != null && request.auth.token.email_verified; }
      function isMember() { return signedIn() && request.auth.token.email in resource.data.emails; }
      // Kid logins (listed in "kids") can sync app data but never change who has access or delete the family
      function isKid() { return request.auth.token.email in resource.data.get('kids', []); }
      allow read: if isMember();
      allow update: if isMember() && (!isKid()
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['data', 'rev', 'updatedAt', 'updatedBy', 'live']));
      allow delete: if isMember() && !isKid();
      allow create: if signedIn() && request.auth.token.email in request.resource.data.emails;
    }
    // Live visits: each person's spot in Dream House or Squishvale, readable by the family
    match /families/{familyId}/live/{memberId} {
      allow read, write: if request.auth != null
        && request.auth.token.email_verified
        && request.auth.token.email in get(/databases/$(database)/documents/families/$(familyId)).data.emails;
    }
    match /circles/{circleId} {
      allow read, update: if request.auth != null
        && request.auth.token.email_verified
        && request.auth.token.email in resource.data.emails;
      allow create: if request.auth != null
        && request.auth.token.email_verified
        && request.auth.token.email in request.resource.data.emails;
    }
  }
}`;

/* =========================================================
   Identity & rules
   ========================================================= */
const famId = () => (typeof Sync !== 'undefined' && Sync.cfg?.familyId) || '';
const pkey = (mid = actor()) => (famId() && mid ? `${famId()}:${mid}` : '');
const famOf = (k) => String(k).split(':')[0];
const midOf = (k) => String(k).split(':')[1];
const isMine = (k) => famOf(k) === famId();
const syncReady = () => typeof Sync !== 'undefined' && !!Sync.ref && ['synced', 'offline'].includes(Sync.status);
const kidRule = (mid) => ({ ...RULE_DEFAULTS, ...(state.friends.rules[mid] || {}) });
const presets = () => (Array.isArray(state.friends.presets) && state.friends.presets.length ? state.friends.presets : DEFAULT_PRESETS);
const isKidId = (mid) => !!state.members.find((m) => m.id === mid)?.kid;
function inQuiet(r) {
  if (!r.quiet) return false;
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return r.quietFrom > r.quietTo ? hm >= r.quietFrom || hm < r.quietTo : hm >= r.quietFrom && hm < r.quietTo;
}
// What the person using this phone may do with friends right now: '' = yes, otherwise the reason.
function friendBlock(kind, mid = actor()) {
  if (!mid) return 'Pick who you are first';
  if (!isKidId(mid)) return '';
  const r = kidRule(mid), d = circle();
  if (!r.on) return 'Friends are turned off — ask a grown-up';
  if (inQuiet(r)) return `😴 Friends time is over until ${fmtTime(r.quietTo)}`;
  const mine = pkey(mid), dayStart = parse(today()).getTime();
  if (kind === 'chat') {
    if (r.chat === 'off') return 'Chat is turned off — ask a grown-up';
    if (d && d.chat.filter((m) => m.from === mine && m.at >= dayStart).length >= r.msgs) return `That’s ${r.msgs} messages today — more tomorrow! 🌙`;
  }
  if (kind === 'trade') {
    if (r.trade === 'off') return 'Trading is turned off — ask a grown-up';
    if (d && d.trades.filter((t) => t.from === mine && t.at >= dayStart).length >= r.trades) return `That’s ${r.trades} trades today — more tomorrow! 🌙`;
  }
  if (kind === 'heart' && !r.hearts) return 'Reactions are turned off';
  return '';
}
// Free-text safety filter for kids: no links, emails, phone numbers, addresses or unkind words.
const BAD_WORDS = /\b(stupid|idiot|dumb|hate|shut ?up|loser|ugly|kill|die|suck|crap|damn|hell|wtf|stfu)\b/i;
function unsafeText(t) {
  if (/(https?:\/\/|www\.|\.(com|net|org|gg|io|ly|app)\b)/i.test(t)) return 'no links';
  if (/[\w.+-]+@[\w-]+\.\w+/.test(t)) return 'no email addresses';
  if ((t.match(/\d/g) || []).length >= 7) return 'no phone numbers';
  if (/\b\d{2,6}\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|way)\b/i.test(t)) return 'no addresses';
  if (/\b(snap(chat)?|insta(gram)?|tiktok|discord|whatsapp|roblox user(name)?)\b/i.test(t)) return 'no usernames from other apps';
  if (/\bdot ?(com|net|org)\b/i.test(t)) return 'no links';
  if ((t.match(/\d/g) || []).length + (t.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi) || []).length >= 7) return 'no phone numbers';
  if (/\b(snap|sc|ig|tik ?tok|whats ?app|roblox|fortnite|minecraft|you ?tube|kik|telegram|facetime|messenger|xbox|psn|gamertag|user ?name|add me)\b/i.test(t)) return 'no usernames from other apps';
  if (/\b(where do you live|what school|your address|home alone|send (me )?(a )?(pic|photo|selfie)|keep (it|this) (a )?secret|don.?t tell)\b/i.test(t)) return 'let’s keep personal stuff private';
  if (BAD_WORDS.test(t)) return 'let’s keep it kind';
  return '';
}

/* =========================================================
   Circle storage + sync (a second shared record, merged the same way as the family data)
   ========================================================= */
const Circle = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CIRCLE_KEY) || '{}'); } catch {}
  return { id: saved.id || '', local: saved.local || null, base: saved.base || null, ref: null, unsub: null, pushing: false, dirty: false, pending: null, timer: null, status: 'off', err: '' };
})();
const clone = (x) => JSON.parse(JSON.stringify(x));
const circle = () => (Circle.id && Circle.id === state.friends.circleId ? Circle.local : null);
function persistCircle() { try { localStorage.setItem(CIRCLE_KEY, JSON.stringify({ id: Circle.id, local: Circle.local, base: Circle.base })); } catch {} }
// Circle data is written by other families: treat it as untrusted and clean it where it enters the app.
const SAFE_KEY = /^[A-Za-z0-9_-]{1,40}(:[A-Za-z0-9_-]{1,40})?$/, SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/, RX_OK = ['❤️', '😂', '👍', '😮', '🎉'];
const clampN = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
function normCircle(d) {
  for (const k of ['fams', 'people', 'shows', 'invites']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {};
  for (const k of ['chat', 'trades']) if (!Array.isArray(d[k])) d[k] = [];
  for (const o of [d.fams, d.people, d.shows]) for (const k of Object.keys(o)) if (!SAFE_KEY.test(k) || !o[k] || typeof o[k] !== 'object') delete o[k];
  for (const p of Object.values(d.people)) { if (!SAFE_COLOR.test(p.color || '')) p.color = '#999999'; p.name = String(p.name || '').slice(0, 30); p.emoji = String(p.emoji || '🙂').slice(0, 8); }
  for (const x of Object.values(d.fams)) { x.name = String(x.name || '').slice(0, 40); x.emoji = String(x.emoji || '🏡').slice(0, 8); }
  d.chat = d.chat.filter((m) => m && SAFE_KEY.test(String(m.id)) && SAFE_KEY.test(String(m.from)) && typeof m.text === 'string');
  for (const m of d.chat) { m.text = m.text.slice(0, 500); m.at = clampN(m.at, 0, 9e15, 0); if (m.rx && typeof m.rx === 'object') { for (const e of Object.keys(m.rx)) if (!RX_OK.includes(e)) delete m.rx[e]; } else delete m.rx; }
  d.trades = d.trades.filter((t) => t && SAFE_KEY.test(String(t.id)) && SAFE_KEY.test(String(t.from)) && SAFE_KEY.test(String(t.to)) && Array.isArray(t.give) && Array.isArray(t.get));
  for (const t of d.trades) t.at = clampN(t.at, 0, 9e15, 0);
  for (const s of Object.values(d.shows)) {
    const h = s.house; if (!h || typeof h !== 'object') { delete s.house; continue; }
    if (!SAFE_COLOR.test(h.roof || '')) h.roof = '#e8590c';
    if (!SAFE_COLOR.test(h.siding || '')) h.siding = '#fff3bf';
    h.rooms = (Array.isArray(h.rooms) ? h.rooms : []).slice(0, 8).filter((r) => r && typeof r === 'object');
    for (const r of h.rooms) r.i = (Array.isArray(r.i) ? r.i : []).slice(0, 200).filter(Array.isArray).map(([f, x, y, sc, fl, sid]) => [String(f), clampN(x, 0, 100, 50), clampN(y, 0, 100, 50), clampN(sc, 0.3, 3, 1), fl ? 1 : 0, ...(sid ? [String(sid)] : [])]);
  }
  return d;
}
function circleEmails(d) {
  const set = new Set();
  for (const f of Object.values(d.fams || {})) for (const e of f.emails || []) set.add(String(e).toLowerCase());
  for (const e of Object.keys(d.invites || {})) set.add(e.toLowerCase());
  return [...set];
}
function stopCircle() { if (Circle.unsub) { Circle.unsub(); Circle.unsub = null; } Circle.ref = null; }
function resetCircle() { stopCircle(); Object.assign(Circle, { id: '', local: null, base: null, status: 'off', err: '' }); persistCircle(); }
function ensureCircle() {
  const id = state.friends.circleId;
  if (!id) { if (Circle.id) resetCircle(); return; }
  if (!syncReady() || Sync.status === 'offline') return;
  if (Circle.unsub && Circle.id === id) return;
  if (Circle.id === id && ['denied', 'missing'].includes(Circle.status) && Date.now() - (Circle.failedAt || 0) < 20000) return;
  if (Circle.id !== id) { stopCircle(); Object.assign(Circle, { id, local: null, base: null }); }
  const { doc, onSnapshot } = Sync.fb.fs;
  Circle.ref = doc(Sync.fb.db, 'circles', id);
  Circle.status = 'connecting';
  Circle.unsub = onSnapshot(Circle.ref, (snap) => {
    if (!snap.exists()) { Circle.status = 'missing'; Circle.failedAt = Date.now(); circleChanged(); return; }
    const d = snap.data();
    let remote;
    try { remote = normCircle(JSON.parse(d.data)); } catch { Circle.status = 'error'; return; }
    const rev = d.rev || 0;
    if (!Circle.base || !Circle.local) { Circle.local = remote; Circle.base = { rev, data: clone(remote) }; persistCircle(); }
    else applyCircleRemote(remote, rev);
    Circle.status = 'ok';
    afterCircleSync();
  }, (err) => {
    console.error('circle', err);
    stopCircle();
    Circle.failedAt = Date.now();
    Circle.status = String(err?.code || '').includes('permission') ? 'denied' : 'error';
    Circle.err = err?.message || '';
    circleChanged();
  });
}
function applyCircleRemote(remote, rev) {
  if (Circle.base && rev <= Circle.base.rev) return;
  if (Circle.pushing) { Circle.pending = { remote, rev }; return; }
  Circle.pending = null;
  const merged = normCircle(merge3(Circle.base.data, Circle.local, remote));
  Circle.base = { rev, data: clone(remote) };
  const changed = !same(merged, Circle.local);
  Circle.local = clone(merged);
  persistCircle();
  if (!same(merged, remote)) circlePush();
  if (changed) circleChanged();
}
function circlePush(delay = 600) {
  if (!Circle.ref || !Circle.base) return;
  Circle.dirty = true;
  clearTimeout(Circle.timer);
  Circle.timer = setTimeout(circlePushNow, delay);
}
async function circlePushNow() {
  if (!Circle.ref || !Circle.base || !Circle.dirty || Circle.pushing) return;
  Circle.pushing = true; Circle.dirty = false;
  const start = JSON.parse(JSON.stringify(Circle.local));
  const { runTransaction, serverTimestamp } = Sync.fb.fs;
  try {
    let merged, rev;
    await runTransaction(Sync.fb.db, async (tx) => {
      const snap = await tx.get(Circle.ref);
      if (!snap.exists()) throw Object.assign(new Error('missing'), { code: 'not-found' });
      const d = snap.data();
      merged = normCircle(merge3(Circle.base.data, start, normCircle(JSON.parse(d.data))));
      rev = (d.rev || 0) + 1;
      tx.update(Circle.ref, { data: JSON.stringify(merged), rev, emails: circleEmails(merged), updatedAt: serverTimestamp(), updatedBy: Sync.user.email });
    });
    Circle.base = { rev, data: clone(merged) };
    const next = normCircle(merge3(start, Circle.local, merged));
    const changed = !same(next, Circle.local);
    Circle.local = clone(next);
    if (!same(next, merged)) Circle.dirty = true;
    persistCircle();
    if (changed) circleChanged();
  } catch (e) {
    console.error('circle push', e);
    Circle.dirty = true;
    if (String(e?.code || '').includes('permission')) { Circle.status = 'denied'; circleChanged(); }
  } finally {
    Circle.pushing = false;
    if (Circle.pending) { const p = Circle.pending; applyCircleRemote(p.remote, p.rev); }
    if (Circle.dirty && Circle.status === 'ok') circlePush(1500);
  }
}
function circleEdit(fn) {
  const d = circle();
  if (!d) return false;
  fn(d);
  persistCircle();
  circlePush();
  return true;
}
let circleRenderPending = false;
function circleChanged() {
  if (!$('#sheet').hidden) { circleRenderPending = true; return; }
  const r = currentRoute().name;
  if (['friends', 'fchat', 'friend', 'fcontrols', 'inbox', 'home', 'kid', 'squishies'].includes(r)) render();
  else updateBell?.();
}

/* =========================================================
   Publishing this family's profile (people, emails, showcases) into the circle
   ========================================================= */
function myFamEmails() {
  const kidEmails = Object.entries(state.kidAccounts || {}).map(([mid, a]) => [mid, String(a.email || '').toLowerCase()]);
  const off = new Set(kidEmails.filter(([mid]) => !kidRule(mid).on).map(([, e]) => e));
  const list = (Sync.emails || []).map((e) => String(e).toLowerCase());
  if (Sync.user?.email) list.push(Sync.user.email.toLowerCase());
  return [...new Set(list)].filter((e) => !off.has(e)).sort();
}
function myShow(mid) {
  const items = state.squish.items.filter((i) => i.who === mid);
  const r = isKidId(mid) ? kidRule(mid) : { show: true };
  return { n: new Set(items.map((i) => i.sid)).size, total: items.length, fav: items.filter((i) => i.fav).map((i) => i.sid).slice(0, 6), items: r.show ? items.filter((i) => SQ[i.sid]?.r !== 'U').map((i) => (i.shiny ? [i.id, i.sid, 1] : [i.id, i.sid])) : [] };
}
function publishFamily() {
  const d = circle(), f = famId();
  if (!d || !f || Circle.status !== 'ok') return;
  const fam = { name: state.friends.famName || 'Our family', emoji: state.friends.famEmoji || '🏡', emails: myFamEmails(), at: d.fams[f]?.at || Date.now() };
  const people = {}, shows = {};
  for (const m of state.members) {
    const kid = !!m.kid;
    if (kid && !kidRule(m.id).on) continue;
    const r = kidRule(m.id);
    people[`${f}:${m.id}`] = { name: m.name, emoji: m.emoji, color: m.color, kid, chat: kid ? r.chat : 'free', trade: kid ? r.trade : 'on' };
    const sh = myShow(m.id);
    shows[`${f}:${m.id}`] = { ...sh, likes: d.shows[`${f}:${m.id}`]?.likes || {} };
  }
  const curPeople = Object.fromEntries(Object.entries(d.people).filter(([k]) => famOf(k) === f));
  const curShows = Object.fromEntries(Object.entries(d.shows).filter(([k]) => famOf(k) === f));
  const famSame = same({ ...d.fams[f], at: 0 }, { ...fam, at: 0 });
  if (famSame && same(curPeople, people) && same(curShows, shows)) return;
  circleEdit((c) => {
    c.fams[f] = fam;
    for (const k of Object.keys(c.people)) if (famOf(k) === f && !people[k]) delete c.people[k];
    for (const k of Object.keys(c.shows)) if (famOf(k) === f && !shows[k]) delete c.shows[k];
    Object.assign(c.people, people); Object.assign(c.shows, shows);
    for (const e of fam.emails) if (c.invites[e]) c.invites[e].joined = true;
  });
}
let publishT;
const schedulePublish = () => { clearTimeout(publishT); publishT = setTimeout(publishFamily, 800); };
function afterCircleSync() {
  const d = circle();
  if (!d) return;
  if (!d.fams[famId()] && !state.friends.joinAsked) state.friends.joinAsked = true;
  publishFamily();
  settleFriendTrades();
  circleChanged();
}

/* =========================================================
   Create / invite / join / leave
   ========================================================= */
async function createCircle(v) {
  const f = famId();
  state.friends.famName = v.famName; state.friends.famEmoji = v.famEmoji || '🏡';
  const id = randomId();
  const data = normCircle({ v: 1, name: v.name, owner: f, created: Date.now() });
  data.fams[f] = { name: v.famName, emoji: v.famEmoji || '🏡', emails: myFamEmails(), at: Date.now() };
  const { doc, setDoc, serverTimestamp } = Sync.fb.fs;
  try {
    await setDoc(doc(Sync.fb.db, 'circles', id), { data: JSON.stringify(data), rev: 1, emails: circleEmails(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (e) {
    console.error(e);
    if (String(e?.code || '').includes('permission')) { ui.showRules = true; toast('Update your Firebase rules first (see below)'); render(); }
    else toast('Could not create the circle — check your connection');
    return;
  }
  Object.assign(Circle, { id, local: data, base: { rev: 1, data: clone(data) }, status: 'ok' });
  persistCircle();
  state.friends.circleId = id;
  save();
  ensureCircle();
  toast('👯 Friends Circle created!');
  render();
}
function circleSetupSheet() {
  openSheet({
    title: '👯 Start a Friends Circle',
    saveLabel: 'Create',
    values: { name: 'Our Friends', famName: state.friends.famName || `The ${(Sync.user?.email || '').split('@')[0].replace(/[^a-z]/gi, ' ').trim().split(' ')[0] || 'Our'} Family`, famEmoji: state.friends.famEmoji || '🏡' },
    fields: [
      { name: 'name', label: 'Circle name', required: true, placeholder: 'e.g. Gomez + Rivera crew' },
      { row: [{ name: 'famEmoji', label: 'Emoji', placeholder: '🏡' }, { name: 'famName', label: 'Your family’s name (what friends see)', required: true, placeholder: 'The Gomez Family' }] },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">Friends only see first names, emoji and squishy collections. Your budget, calendar and everything else stay private.</p>' },
    ],
    onSave(v) { setTimeout(() => createCircle(v)); },
  });
}
const circleInviteLink = (email) => `${location.origin}${location.pathname}#join-circle=${b64url(JSON.stringify({ c: Sync.cfg.config, k: Circle.id, n: circle()?.name || '', f: state.friends.famName || '', e: email }))}`;
function inviteSheet() {
  openSheet({
    title: '➕ Invite a friend family',
    saveLabel: 'Create invite',
    values: {},
    fields: [
      { name: 'email', label: 'Their parent’s email', type: 'email', required: true, placeholder: 'friend@example.com' },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">Only this email can open the invite. They’ll set up their own family in the app (2 minutes), then join your circle. They can add their partner and kids after.</p>' },
    ],
    onSave(v) {
      const email = v.email.trim().toLowerCase();
      circleEdit((d) => { d.invites[email] = { by: famId(), at: Date.now() }; });
      setTimeout(() => showInvite(email), 50);
    },
  });
}
function showInvite(email) {
  const link = circleInviteLink(email);
  const fam = state.friends.famName || 'our family';
  const text = `You're invited to ${fam}'s Friends Circle on our family app! 👯 Open this on your iPhone: ${link}`;
  openSheet({
    title: '📨 Send the invite',
    saveLabel: 'Done',
    values: {},
    fields: [{ type: 'html', html: `<p class="small" style="margin:0 4px 10px">Send this link to <b>${esc(email)}</b>. They should sign up with that same email.</p>
      <textarea class="invite-box" readonly rows="4">${esc(text)}</textarea>
      <div class="btn-row"><button type="button" class="btn" data-share-invite="${esc(text)}">📤 Share</button><button type="button" class="btn secondary" data-copy-invite="${esc(text)}">📋 Copy</button></div>` }],
    onSave() {},
  });
}
document.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-share-invite]'), c = e.target.closest('[data-copy-invite]'), r = e.target.closest('[data-copy-rules]');
  try {
    if (s) { if (navigator.share) await navigator.share({ text: s.dataset.shareInvite }); else { await navigator.clipboard.writeText(s.dataset.shareInvite); toast('Copied!'); } }
    if (c) { await navigator.clipboard.writeText(c.dataset.copyInvite); toast('Copied!'); }
    if (r) { await navigator.clipboard.writeText(CIRCLE_RULES); toast('Rules copied — paste them in Firebase'); }
  } catch { /* cancelled */ }
});
// Invite links: #join-circle=<code>
function readPendingCircle() { try { return JSON.parse(localStorage.getItem(PENDING_CIRCLE_KEY) || 'null'); } catch { return null; } }
function catchInvite() {
  if (typeof unb64url !== 'function') return false; // sync.js not loaded yet; the load handler retries
  const m = location.hash.match(/^#join-circle=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  try {
    const o = JSON.parse(unb64url(m[1]));
    if (o.k && o.c) localStorage.setItem(PENDING_CIRCLE_KEY, JSON.stringify(o));
  } catch { toast('That invite link looks broken'); }
  history.replaceState(null, '', location.pathname + '#friends');
  render();
  return true;
}
window.addEventListener('hashchange', catchInvite);
function joinSheet(p) {
  openSheet({
    title: `👯 Join ${p.n || 'the Friends Circle'}`,
    saveLabel: 'Join',
    values: { famName: state.friends.famName || '', famEmoji: state.friends.famEmoji || '🏡' },
    fields: [
      { row: [{ name: 'famEmoji', label: 'Emoji', placeholder: '🏡' }, { name: 'famName', label: 'Your family’s name (what friends see)', required: true, placeholder: 'The Rivera Family' }] },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">Friends only see first names, emoji and squishy collections. Next, choose which kids can join in Parent Controls.</p>' },
    ],
    onSave(v) {
      state.friends.famName = v.famName; state.friends.famEmoji = v.famEmoji || '🏡';
      state.friends.circleId = p.k;
      localStorage.removeItem(PENDING_CIRCLE_KEY);
      Object.assign(Circle, { id: '', local: null, base: null });
      setTimeout(() => { ensureCircle(); toast(`👯 Joined ${p.n || 'the circle'}!`); });
    },
  });
}
function leaveCircle() {
  if (!confirm('Leave this Friends Circle? Your family’s profiles and collections will be removed from it.')) return;
  const f = famId();
  circleEdit((d) => {
    delete d.fams[f];
    for (const k of Object.keys(d.people)) if (famOf(k) === f) delete d.people[k];
    for (const k of Object.keys(d.shows)) if (famOf(k) === f) delete d.shows[k];
    for (const t of d.trades) if ((famOf(t.from) === f || famOf(t.to) === f) && ['offered', 'accepted'].includes(t.status)) t.status = 'cancelled';
  });
  setTimeout(() => { state.friends.circleId = ''; save(); resetCircle(); render(); }, 1500);
}
function removeFamily(f) {
  const d = circle();
  if (!d || !confirm(`Remove ${d.fams[f]?.name || 'this family'} from the circle?`)) return;
  circleEdit((c) => {
    const emails = c.fams[f]?.emails || [];
    delete c.fams[f];
    for (const e of emails) delete c.invites[e];
    for (const k of Object.keys(c.people)) if (famOf(k) === f) delete c.people[k];
    for (const k of Object.keys(c.shows)) if (famOf(k) === f) delete c.shows[k];
    for (const t of c.trades) if ((famOf(t.from) === f || famOf(t.to) === f) && ['offered', 'accepted'].includes(t.status)) t.status = 'cancelled';
  });
  render();
}

/* =========================================================
   Chat
   ========================================================= */
const personOf = (k) => circle()?.people[k] || null;
const pName = (k) => personOf(k)?.name || 'Someone';
const famName = (f) => circle()?.fams[f]?.name || 'Friend family';
const famEmoji = (f) => circle()?.fams[f]?.emoji || '🏡';
const mutedHere = (k) => !!state.friends.muted[k] || !!state.friends.muted[famOf(k)];
function friendSend(text, kind = 'text') {
  const me = actor(), why = friendBlock('chat', me);
  if (why) { toast(why); return false; }
  const t = String(text).trim().slice(0, 300);
  if (!t) return false;
  if (kind === 'text' && isKidId(me)) {
    const r = kidRule(me);
    if (r.chat === 'preset') { toast('Pick a message below 👇'); return false; }
    const bad = unsafeText(t);
    if (bad) { toast(`Let’s keep it safe & friendly — ${bad} 🙂`); return false; }
  }
  if (!circleEdit((d) => { d.chat.push({ id: uid(), at: Date.now(), from: pkey(me), text: t, kind, rx: {} }); if (d.chat.length > 300) d.chat = d.chat.slice(-300); })) return false;
  seen().fchat = Date.now();
  render();
  scrollChat();
  return true;
}
views.fchat = () => {
  const d = circle();
  if (!d) return views.friends();
  const me = pkey();
  let lastDay = '', last = '';
  const msgs = [...d.chat].filter((m) => !mutedHere(m.from)).sort((a, b) => a.at - b.at).slice(-150);
  const out = msgs.map((x) => {
    const day = iso(new Date(x.at));
    let sep = '';
    if (day !== lastDay) { sep = `<div class="chat-day">${day === today() ? 'Today' : day === addDays(today(), -1) ? 'Yesterday' : fmtDate(day, { weekday: 'long', month: 'short', day: 'numeric' })}</div>`; lastDay = day; last = ''; }
    const p = personOf(x.from) || { name: 'Someone', emoji: '👤', color: '#999' };
    const mine = x.from === me, cont = last === x.from;
    const hide = !mine && isKidId(actor()) && !['preset', 'sticker'].includes(x.kind) && !!unsafeText(x.text); // shield kids from unsafe incoming messages too
    last = x.from;
    const big = x.kind === 'sticker' || bigEmoji(x.text);
    const rx = Object.entries(x.rx || {}).filter(([, w]) => Object.keys(w).length);
    const canDel = !kidHere() && (isMine(x.from) || mine);
    return `${sep}<div class="msg${mine ? ' mine' : ''}${cont ? ' cont' : ''}" style="--c:${esc(p.color)}">
      ${mine ? '' : `<div class="msg-av">${cont ? '' : esc(p.emoji)}</div>`}
      <div class="msg-body">${mine || cont ? '' : `<div class="msg-name">${esc(p.name)} <span class="fam-tag">${esc(famEmoji(famOf(x.from)))} ${esc(famName(famOf(x.from)))}</span></div>`}
        <button class="bubble${big ? ' big' : ''}${x.kind === 'preset' ? ' preset' : ''}" data-action="fmsg-tap" data-id="${esc(x.id)}">${hide ? '🛡️ <i>Hidden to keep you safe — show a grown-up</i>' : esc(x.text)}<span class="msg-time">${new Date(x.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></button>
        ${rx.length ? `<div class="msg-rx">${rx.map(([e, w]) => `<button class="${w[me] ? 'on' : ''}" data-action="fmsg-react" data-id="${esc(x.id)}" data-e="${esc(e)}">${esc(e)}${Object.keys(w).length > 1 ? Object.keys(w).length : ''}</button>`).join('')}</div>` : ''}
        ${ui.fmsgPick === x.id ? `<div class="rx-pick">${['❤️', '😂', '👍', '😮', '🎉'].map((e) => `<button data-action="fmsg-react" data-id="${esc(x.id)}" data-e="${esc(e)}">${esc(e)}</button>`).join('')}${canDel ? `<button class="rx-del" data-action="fmsg-del" data-id="${x.id}" aria-label="Delete">🗑️</button>` : ''}${!kidHere() && !isMine(x.from) ? `<button class="rx-del" data-action="fmute" data-k="${x.from}" aria-label="Mute">🔇</button>` : ''}</div>` : ''}
      </div></div>`;
  }).join('');
  const why = friendBlock('chat');
  return `${why && isKidId(actor()) ? `<div class="card install-tip small">${esc(why)}</div>` : ''}
    <div class="chat">${out || `<div class="card empty"><span class="big">👯</span>Say hi to your friends!</div>`}</div>`;
};
// The family chat's composer doubles as the friends composer (preset tray for kids on "preset messages").
chatBar.insertAdjacentHTML('afterbegin', '<div class="preset-row"></div>');
const presetRow = chatBar.querySelector('.preset-row');
presetRow.addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  e.preventDefault();
  friendSend(b.dataset.preset, b.dataset.kind || 'preset');
});
document.addEventListener('submit', (e) => {
  if (e.target !== chatBar || currentRoute().name !== 'fchat') return;
  e.preventDefault(); e.stopPropagation();
  if (friendSend(chatInput.value)) { chatInput.value = ''; chatInput.focus(); }
}, true);
function configureComposer(name) {
  if (name !== 'fchat') { chatBar.dataset.mode = ''; chatInput.placeholder = 'Message the family…'; return; }
  const me = actor(), r = isKidId(me) ? kidRule(me) : { chat: 'free' };
  const blocked = friendBlock('chat', me);
  chatBar.hidden = !circle() || (!!blocked && r.chat === 'off') || !r.on && isKidId(me);
  chatBar.dataset.mode = r.chat === 'preset' ? 'preset' : 'free';
  chatInput.placeholder = 'Message your friends…';
  presetRow.innerHTML = r.chat === 'preset' ? `<div class="sticker-row">${STICKERS.map((s) => `<button type="button" data-preset="${s}" data-kind="sticker">${s}</button>`).join('')}</div><div class="phrase-row">${presets().map((p) => `<button type="button" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : '';
}

/* =========================================================
   Cross-family trades
   ========================================================= */
function friendLockedIds() {
  const d = circle(), ids = [];
  if (!d) return ids;
  for (const t of d.trades) if (['offered', 'accepted'].includes(t.status)) for (const [iid] of [...t.give, ...t.get]) ids.push(iid);
  return ids;
}
function friendTradeInbox(mid) {
  const d = circle(), me = pkey(mid);
  if (!d || !me) return [];
  return d.trades.filter((t) => t.to === me && t.status === 'offered' && t.ok?.[famOf(t.from)] && !mutedHere(t.from));
}
function friendTradeSheet(toKey) {
  const me = actor(), why = friendBlock('trade', me);
  if (why) { toast(why); return; }
  const d = circle(), them = d?.people[toKey];
  if (!them) return;
  if (them.trade === 'off') { toast(`${them.name} can’t trade right now`); return; }
  const locked = lockedIds();
  const mine = myItems(me).filter((i) => !locked.has(i.id));
  const lockedThem = new Set(friendLockedIds());
  const theirs = (d.shows[toKey]?.items || []).filter(([iid]) => !lockedThem.has(iid)).map(([id, sid, sh]) => ({ id, sid, shiny: !!sh }));
  openSheet({
    title: `🔁 Trade with ${them.name}`,
    saveLabel: 'Send offer',
    values: {},
    fields: [{ type: 'html', html: `<div class="small muted pick-label">I give</div>${tradePicker('give', mine, [])}<div class="small muted pick-label">I want from ${esc(them.name)}</div>${tradePicker('get', theirs, [])}<div class="fair" id="fairMeter"></div>` }],
    onInput(form) {
      const el = $('#fairMeter'); if (!el) return;
      const val = (name, list) => sum([...form.querySelectorAll(`[name="${name}"]:checked`)], (x) => RARITY[SQ[list.find((i) => i.id === x.value)?.sid]?.r]?.value || 0);
      const a = val('give', mine), b = val('get', theirs);
      el.innerHTML = !a && !b ? '' : `<div class="fair-bar"><i style="width:${(a / Math.max(1, a + b)) * 100}%"></i></div><div class="small">${a === b ? '⚖️ Fair trade!' : a > b ? `🎁 You’re giving more (${a} vs ${b})` : `🤔 You’re asking for more (${b} vs ${a})`}</div>`;
    },
    onSave() {
      const f = $('#sheetForm');
      const give = [...f.querySelectorAll('[name="give"]:checked')].map((x) => { const i = mine.find((y) => y.id === x.value); return i.shiny ? [i.id, i.sid, 1] : [i.id, i.sid]; });
      const get = [...f.querySelectorAll('[name="get"]:checked')].map((x) => { const i = theirs.find((y) => y.id === x.value); return i.shiny ? [i.id, i.sid, 1] : [i.id, i.sid]; });
      if (!give.length && !get.length) { toast('Pick at least one squishy'); return false; }
      const myFam = famId(), needMine = isKidId(me) && kidRule(me).trade === 'approve';
      circleEdit((c) => c.trades.push({ id: uid(), at: Date.now(), from: pkey(me), to: toKey, give, get, status: 'offered', need: { [myFam]: needMine }, ok: { [myFam]: !needMine }, applied: {} }));
      logAct('🔁', `offered ${them.name} a squishy trade`, 'friends');
      toast(needMine ? '🙌 Sent to a grown-up to OK first' : `🔁 Offer sent to ${them.name}!`);
    },
  });
}
function friendTradeCard(t) {
  const me = pkey(), myFam = famId();
  const row = (list) => `<div class="trade-items">${list.map(([, sid, sh]) => SQ[sid] ? `<span class="ti r-${SQ[sid].r}${sh ? ' shiny' : ''}">${squishySVG(sid, { shiny: !!sh })}</span>` : '').join('') || '<span class="small muted">nothing</span>'}</div>`;
  const waitingFam = Object.keys(t.need || {}).filter((f) => t.need[f] && !t.ok?.[f]);
  const status = t.status === 'offered' ? (t.ok?.[famOf(t.from)] ? (t.to === me ? 'wants to trade with you' : `waiting for ${pName(t.to)}`) : 'waiting for a grown-up’s OK')
    : t.status === 'accepted' ? (waitingFam.length ? `accepted · waiting for ${waitingFam.map(famName).join(' & ')} grown-up OK` : 'finishing…')
    : { done: 'traded ✓', declined: 'declined', cancelled: 'cancelled' }[t.status] || t.status;
  const parentHere = !kidHere() && actor() && !isKidId(actor());
  const myApproval = parentHere && t.need?.[myFam] && !t.ok?.[myFam] && ['offered', 'accepted'].includes(t.status) && (famOf(t.from) === myFam || famOf(t.to) === myFam);
  return `<div class="card trade-card friend-trade">
    <div class="small"><b>${esc(pName(t.from))}</b> <span class="fam-tag">${esc(famName(famOf(t.from)))}</span> ${esc(status)} · ${timeAgo(t.at)}</div>
    <div class="trade-swap"><div><div class="small muted">${esc(pName(t.from))} gives</div>${row(t.give)}</div><span class="swap-arrow">⇄</span><div><div class="small muted">${esc(pName(t.to))} gives</div>${row(t.get)}</div></div>
    ${t.status === 'offered' && t.to === me && t.ok?.[famOf(t.from)] ? `<div class="btn-row"><button class="btn secondary" data-action="ft-no" data-id="${esc(t.id)}">No thanks</button><button class="btn" data-action="ft-yes" data-id="${esc(t.id)}">✅ Accept</button></div>` : ''}
    ${myApproval ? `<div class="btn-row"><button class="btn secondary" data-action="ft-deny" data-id="${esc(t.id)}">🚫 Don’t allow</button><button class="btn" data-action="ft-ok" data-id="${esc(t.id)}">👍 Allow trade</button></div>` : ''}
    ${['offered', 'accepted'].includes(t.status) && t.from === me ? `<button class="mini-btn" data-action="ft-cancel" data-id="${esc(t.id)}">Cancel offer</button>` : ''}
  </div>`;
}
function friendTradesHTML(mid) {
  const d = circle(), me = pkey(mid);
  if (!d || !me) return '';
  const list = d.trades.filter((t) => (t.from === me || t.to === me) && (t.status !== 'offered' || t.from === me || t.ok?.[famOf(t.from)])).sort((a, b) => b.at - a.at).slice(0, 12);
  return list.length ? `<div class="section-title">Friend trades</div>${list.map(friendTradeCard).join('')}` : '';
}
// Any phone can finish a trade once everyone said yes; each family then moves its own squishies.
function settleFriendTrades() {
  const d = circle(), f = famId();
  if (!d || !f) return;
  let edit = false;
  for (const t of d.trades) if (t.status === 'accepted' && Object.keys(t.need || {}).every((k) => !t.need[k] || t.ok?.[k])) { t.status = 'done'; t.doneAt = Date.now(); edit = true; }
  const applied = (state.squish.ftApplied ||= {});
  let local = false;
  for (const t of d.trades) {
    if (t.status !== 'done' || applied[t.id] || t.applied?.[f]) continue;
    const giver = famOf(t.from) === f ? t.from : famOf(t.to) === f ? t.to : null;
    if (!giver) continue;
    const mid = midOf(giver), out = giver === t.from ? t.give : t.get, inn = giver === t.from ? t.get : t.give;
    const outIds = new Set(out.map(([iid]) => iid));
    state.squish.items = state.squish.items.filter((i) => !outIds.has(i.id));
    const other = giver === t.from ? t.to : t.from;
    for (const [, sid, sh] of inn) if (SQ[sid]) { const isNew = !ownsSid(mid, sid); state.squish.items.push({ id: uid(), who: mid, sid, at: Date.now(), from: 'friend', fromName: pName(other), ...(sh ? { shiny: true } : {}) }); if (isNew) checkSetBonus(mid, SQ[sid].set); }
    applied[t.id] = true; (t.applied ||= {})[f] = true; edit = true; local = true;
    state.activity = [{ id: uid(), at: Date.now(), who: mid, icon: '🔁', text: `traded squishies with ${pName(other)} (${famName(famOf(other))})`, to: 'squishies' }, ...(state.activity || [])].slice(0, 200);
    if (mid === actor()) setTimeout(() => { confetti(); celebrate('🔁 Trade done!', inn.length ? `You got ${inn.map(([, sid]) => SQ[sid]?.name).filter(Boolean).join(', ')}!` : 'Your gift was delivered 💝'); }, 300);
  }
  if (edit) { persistCircle(); circlePush(); }
  if (local) save();
}

/* =========================================================
   Views
   ========================================================= */
function friendsSetupCard() {
  const p = readPendingCircle();
  if (p) {
    const sameProject = !Sync.cfg?.config || Sync.cfg.config.projectId === p.c.projectId;
    if (!sameProject) return `<div class="card install-tip"><b>⚠️ Different app setup</b><div class="small">This invite is for another family-sync setup. Ask ${esc(p.f || 'them')} to invite you again, or contact them for help.</div></div>`;
    if (!Sync.cfg?.config) return `<div class="card invite-card"><div class="big">💌</div><h3>${esc(p.f || 'A family')} invited you to ${esc(p.n || 'their Friends Circle')}!</h3><p class="small">First, set up your family on this app (about 2 minutes). Sign up with <b>${esc(p.e || 'the invited email')}</b>.</p><button class="btn block" data-action="fr-invite-setup">Set up our family</button></div>`;
    if (!syncReady()) return `<div class="card invite-card"><div class="big">💌</div><h3>Almost there!</h3><p class="small">Finish <b>Settings → Family sync</b>: create your account with <b>${esc(p.e || 'the invited email')}</b>, confirm the email, then tap <b>Start sharing</b>. Then come back here.</p><button class="btn block" data-action="go" data-to="settings">Open Settings</button></div>`;
    return `<div class="card invite-card"><div class="big">💌</div><h3>${esc(p.f || 'A family')} invited you to ${esc(p.n || 'their Friends Circle')}!</h3><button class="btn block" data-action="fr-join">👯 Join the circle</button><button class="mini-btn" style="margin-top:8px" data-action="fr-invite-forget">Not now</button></div>`;
  }
  if (!syncReady()) return `<div class="card empty"><span class="big">👯</span>Friends Circles connect your family with friend families.<div class="small muted" style="margin-top:8px">${kidHere() ? 'Ask a grown-up to set it up.' : 'First turn on <b>Settings → Family sync</b>.'}</div>${kidHere() ? '' : '<button class="btn" style="margin-top:12px" data-action="go" data-to="settings">Family sync</button>'}</div>`;
  if (!state.friends.circleId) return kidHere() ? '<div class="card empty"><span class="big">👯</span>No friends here yet — ask a grown-up!</div>'
    : `<div class="card empty"><span class="big">👯</span><b>Start a Friends Circle</b><div class="small muted" style="margin:6px 0 12px">Invite friend families so the kids can trade squishies, chat safely and cheer each other on — with your rules.</div><button class="btn" data-action="fr-create">Start a circle</button></div>${rulesHelp()}`;
  if (Circle.status === 'denied') return `<div class="card install-tip"><b>🔒 Can’t open the circle</b><div class="small">${kidHere() ? 'Ask a grown-up to turn on Friends for you.' : 'Your email isn’t on this circle (or the Firebase rules need updating).'}</div></div>${kidHere() ? '' : rulesHelp(true)}`;
  if (!circle()) return `<div class="card empty">⏳ Connecting to your Friends Circle…</div>`;
  return '';
}
function rulesHelp(open) {
  return `<details class="card rules-help" ${open || ui.showRules ? 'open' : ''}><summary>🔧 One-time Firebase step for friends</summary>
    <p class="small">Friends Circles need one more rule. In Firebase: <b>Firestore Database → Rules</b>, replace everything with this, then <b>Publish</b>.</p>
    <pre class="rules-pre">${esc(CIRCLE_RULES)}</pre><button class="btn secondary block" data-copy-rules="1">📋 Copy rules</button></details>`;
}
function personTile(k) {
  const p = personOf(k), sh = circle().shows[k] || {};
  const fav = sh.fav?.[0];
  return `<button class="friend-tile" data-action="go" data-to="friend/${encodeURIComponent(k)}" style="--c:${esc(p.color)}">
    <div class="ft-art">${fav && SQ[fav] ? squishySVG(fav) : `<span class="ft-emoji">${esc(p.emoji)}</span>`}</div>
    <b>${esc(p.emoji)} ${esc(p.name)}</b><small>${sh.n || 0} squishies</small></button>`;
}
views.friends = () => {
  const setup = friendsSetupCard();
  if (setup) return setup;
  const d = circle(), f = famId(), me = actor();
  const myKey = pkey(me);
  if (isKidId(me) && !kidRule(me).on) return `<div class="card empty"><span class="big">👯</span>Friends are turned off for you right now.<div class="small muted" style="margin-top:6px">Ask a grown-up to turn them on.</div></div>`;
  const fams = Object.entries(d.fams).sort(([a], [b]) => (a === f ? -1 : b === f ? 1 : 0));
  const others = Object.keys(d.people).filter((k) => !isMine(k) && !mutedHere(k));
  const kidsFirst = others.sort((a, b) => (d.people[b].kid ? 1 : 0) - (d.people[a].kid ? 1 : 0) || d.people[a].name.localeCompare(d.people[b].name));
  const unread = d.chat.filter((m) => m.at > (seen().fchat || 0) && m.from !== myKey && !mutedHere(m.from)).length;
  const last = [...d.chat].filter((m) => !mutedHere(m.from)).sort((a, b) => b.at - a.at)[0];
  const lb = Object.entries(d.shows).filter(([k]) => d.people[k] && !mutedHere(k)).sort(([, a], [, b]) => (b.n || 0) - (a.n || 0)).slice(0, 5);
  const myTrades = friendTradeInbox(me);
  const approvals = !kidHere() && !isKidId(me) ? d.trades.filter((t) => t.need?.[f] && !t.ok?.[f] && ['offered', 'accepted'].includes(t.status)) : [];
  const why = friendBlock('chat');
  return `<div class="circle-head card"><div class="ch-name">${esc(d.name || 'Friends Circle')}</div>
      <div class="fam-chips">${fams.map(([id, x]) => `<span class="fam-chip${id === f ? ' me' : ''}">${esc(x.emoji)} ${esc(x.name)}</span>`).join('')}${Object.entries(d.invites).filter(([, x]) => !x.joined).map(([e]) => `<span class="fam-chip pending">💌 ${esc(e.split('@')[0])}…</span>`).join('')}</div>
      ${!kidHere() && !isKidId(me) ? `<div class="btn-row" style="margin-bottom:0"><button class="btn secondary" data-action="fr-invite">➕ Invite</button><button class="btn secondary" data-action="go" data-to="fcontrols">🛡️ Controls</button></div>` : ''}</div>
    ${isKidId(me) && why && !why.startsWith('Chat') ? `<div class="card install-tip small">${esc(why)}</div>` : ''}
    ${approvals.length ? `<div class="section-title">Needs your OK</div>${approvals.map(friendTradeCard).join('')}` : ''}
    ${myTrades.length ? `<div class="section-title">Trade offers for you</div>${myTrades.map(friendTradeCard).join('')}` : ''}
    <button class="card row tap fchat-row" style="width:100%;text-align:left" data-action="go" data-to="fchat"><div class="avatar">💬</div><div class="grow"><div class="title">Friends chat${unread ? ` <span class="pill accent">${unread} new</span>` : ''}</div><div class="sub">${last ? `${esc(pName(last.from))}: ${esc(last.text)}` : 'Say hi to everyone 👋'}</div></div>${ICON.chev}</button>
    <div class="section-title">Friends</div>
    ${kidsFirst.length ? `<div class="friend-grid">${kidsFirst.map(personTile).join('')}</div>` : `<div class="card empty small">No friends here yet${!kidHere() ? ' — tap ➕ Invite to add a family' : ''}.</div>`}
    ${lb.length > 1 ? `<div class="section-title">🏆 Top collectors</div><div class="card flush">${lb.map(([k, s], i) => `<div class="row"><div class="avatar">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="grow"><div class="title">${esc(d.people[k].emoji)} ${esc(d.people[k].name)}${k === myKey ? ' (you)' : ''}</div><div class="sub">${esc(famName(famOf(k)))}</div></div><b>${s.n}</b><span class="small muted">/${SQUISHIES.length}</span></div>`).join('')}</div>` : ''}`;
};
views.friend = (param) => {
  const k = decodeURIComponent(param || ''), d = circle();
  const p = d?.people[k];
  if (!p) return '<div class="card empty">This friend isn’t in the circle anymore.</div>';
  const sh = d.shows[k] || {}, me = pkey();
  const likes = Object.keys(sh.likes || {});
  const by = {};
  for (const [, sid] of sh.items || []) by[sid] = (by[sid] || 0) + 1;
  const canTrade = !isMine(k) && p.trade !== 'off' && !friendBlock('trade');
  return `<section class="friend-hero" style="--c:${esc(p.color)}"><div class="fh-av">${esc(p.emoji)}</div><div class="fh-name">${esc(p.name)}</div><div class="small">${esc(famEmoji(famOf(k)))} ${esc(famName(famOf(k)))}</div>
      <div class="fh-stats"><span><b>${sh.n || 0}</b>squishies</span><span><b>${likes.length}</b>likes</span></div></section>
    <div class="btn-row">${!isMine(k) ? `<button class="btn secondary${likes.includes(me) ? ' liked' : ''}" data-action="fr-like" data-k="${esc(k)}">${likes.includes(me) ? '💖 Liked' : '🤍 Like'}</button>` : ''}${canTrade ? `<button class="btn" data-action="fr-trade" data-k="${esc(k)}">🔁 Trade</button>` : ''}</div>
    ${sh.fav?.length ? `<div class="section-title">⭐ Favorites</div><div class="sq-grid">${sh.fav.filter((s) => SQ[s]).map((s) => sqTile(s, '', 'data-action="noop"')).join('')}</div>` : ''}
    <div class="section-title">Collection</div>
    ${Object.keys(by).length ? `<div class="sq-grid">${Object.entries(by).sort(([a], [b]) => ALL_TIERS.indexOf(SQ[b]?.r) - ALL_TIERS.indexOf(SQ[a]?.r)).filter(([s]) => SQ[s]).map(([s, n]) => sqTile(s, n > 1 ? `<i class="sq-count">×${n}</i>` : '', 'data-action="noop"')).join('')}</div>` : '<div class="card empty small">Their collection is private or empty.</div>'}`;
};
views.fcontrols = () => {
  if (kidHere()) return '<div class="card empty">Ask a grown-up 🙂</div>';
  const d = circle(), f = famId();
  const ks = kids();
  const label = { off: 'Off', preset: 'Preset messages', free: 'Free text (filtered)', approve: 'Needs my OK', on: 'Allowed' };
  const recent = d ? [...d.chat.filter((m) => isMine(m.from) && isKidId(midOf(m.from))).map((m) => ({ at: m.at, who: midOf(m.from), text: `💬 “${m.text}”` })),
    ...d.trades.filter((t) => isMine(t.from) || isMine(t.to)).map((t) => ({ at: t.at, who: midOf(isMine(t.from) ? t.from : t.to), text: `🔁 Trade with ${pName(isMine(t.from) ? t.to : t.from)} · ${t.status}` }))].sort((a, b) => b.at - a.at).slice(0, 15) : [];
  return `<p class="small muted" style="margin:0 4px 12px">Your rules apply to your kids on every phone and kid device. Grown-ups can always chat and trade.</p>
    ${ks.map((k) => { const r = kidRule(k.id); return `<div class="card ctrl-card" style="--c:${k.color}">
      <div class="ctrl-head">${avatar(k)}<div class="grow"><b>${esc(k.name)}</b><div class="small muted">${r.on ? '👯 In the circle' : '🚫 Friends off'}</div></div><button class="btn${r.on ? ' secondary' : ''}" data-action="fr-rules" data-id="${k.id}">${r.on ? 'Edit' : 'Turn on'}</button></div>
      ${r.on ? `<div class="ctrl-list"><span>💬 Chat: <b>${label[r.chat]}</b></span><span>🔁 Trading: <b>${label[r.trade]}</b></span><span>❤️ Reactions: <b>${r.hearts ? 'On' : 'Off'}</b></span><span>😴 Quiet hours: <b>${r.quiet ? `${fmtTime(r.quietFrom)}–${fmtTime(r.quietTo)}` : 'Off'}</b></span><span>📊 Limits: <b>${r.msgs} msgs · ${r.trades} trades / day</b></span><span>🧸 Collection: <b>${r.show ? 'Visible' : 'Hidden'}</b></span></div>` : ''}
    </div>`; }).join('') || '<div class="card empty small">Mark family members as kids in Settings to set their rules.</div>'}
    <button class="btn secondary block" data-action="fr-presets">✏️ Edit preset messages (${presets().length})</button>
    ${Object.keys(state.friends.muted).length ? `<div class="section-title">Muted</div><div class="card flush">${Object.keys(state.friends.muted).map((k) => `<div class="row"><div class="grow"><div class="title">${esc(k.includes(':') ? pName(k) : famName(k))}</div></div><button class="mini-btn" data-action="fr-unmute" data-k="${esc(k)}">Unmute</button></div>`).join('')}</div>` : ''}
    ${recent.length ? `<div class="section-title">Kids’ recent activity</div><div class="card flush">${recent.map((x) => `<div class="row">${avatar(member(x.who), true)}<div class="grow"><div class="title" style="white-space:normal">${esc(x.text)}</div><div class="sub">${esc(whoName(x.who))} · ${timeAgo(x.at)}</div></div></div>`).join('')}</div>` : ''}
    ${d ? `<div class="section-title">Families</div><div class="card flush">${Object.entries(d.fams).map(([id, x]) => `<div class="row"><div class="avatar">${esc(x.emoji)}</div><div class="grow"><div class="title">${esc(x.name)}${id === f ? ' (you)' : ''}${id === d.owner ? ' · 👑' : ''}</div></div>${id !== f ? `<button class="mini-btn" data-action="fr-mute-fam" data-k="${id}">${state.friends.muted[id] ? 'Unmute' : 'Mute'}</button>${d.owner === f ? `<button class="mini-btn" style="color:var(--bad)" data-action="fr-remove" data-k="${id}">Remove</button>` : ''}` : ''}</div>`).join('')}</div>
      <div class="btn-row"><button class="btn secondary" data-action="fr-family-name">✏️ Our family name</button><button class="btn danger" data-action="fr-leave">Leave circle</button></div>` : ''}
    ${rulesHelp()}`;
};
function rulesSheet(mid) {
  const k = member(mid), r = kidRule(mid);
  openSheet({
    title: `🛡️ ${k.name}’s friend rules`,
    values: { ...r, msgs: String(r.msgs), trades: String(r.trades) },
    fields: [
      { name: 'on', label: `👯 ${k.name} can use Friends`, type: 'checkbox', hint: 'Joins your circle with first name, emoji and collection' },
      { name: 'chat', label: '💬 Chat', type: 'select', options: [{ value: 'off', label: '🚫 Off' }, { value: 'preset', label: '💬 Preset messages & stickers only' }, { value: 'free', label: '⌨️ Free text (no links, numbers or unkind words)' }] },
      { name: 'trade', label: '🔁 Trading squishies', type: 'select', options: [{ value: 'off', label: '🚫 Off' }, { value: 'approve', label: '👍 Each trade needs my OK' }, { value: 'on', label: '✅ Allowed' }] },
      { name: 'hearts', label: '❤️ Likes & reactions', type: 'checkbox' },
      { name: 'show', label: '🧸 Friends can see their collection', type: 'checkbox' },
      { name: 'quiet', label: '😴 Quiet hours (no friend chat or trades)', type: 'checkbox' },
      { row: [{ name: 'quietFrom', label: 'From', type: 'time' }, { name: 'quietTo', label: 'Until', type: 'time' }] },
      { row: [{ name: 'msgs', label: 'Messages / day', type: 'number' }, { name: 'trades', label: 'Trades / day', type: 'number' }] },
    ],
    onSave(v) {
      state.friends.rules[mid] = { on: v.on, chat: v.chat, trade: v.trade, hearts: v.hearts, show: v.show, quiet: v.quiet, quietFrom: v.quietFrom || '20:00', quietTo: v.quietTo || '07:00', msgs: Math.max(0, Number(v.msgs) || 0), trades: Math.max(0, Number(v.trades) || 0) };
      toast(`🛡️ ${k.name}’s rules saved`);
      // The kid's device login must be on the circle's access list to see it.
      setTimeout(schedulePublish, 200);
    },
  });
}
function presetsSheet() {
  openSheet({
    title: '✏️ Preset messages',
    values: { list: presets().join('\n') },
    fields: [
      { name: 'list', label: 'One message per line', type: 'textarea' },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">Kids on “Preset messages” can only send these (and emoji stickers).</p>' },
    ],
    onSave(v) {
      const list = String(v.list || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 30);
      state.friends.presets = list.length ? list : null;
      toast('Preset messages saved');
    },
  });
}

/* =========================================================
   Wiring
   ========================================================= */
KID_ROUTES.push('friends', 'fchat', 'friend');
for (const a of ['fmsg-tap', 'fmsg-react', 'fr-like', 'fr-trade', 'ft-yes', 'ft-no', 'ft-cancel', 'noop']) KID_ACTIONS.add(a);
Object.assign(actions, {
  'noop': () => {},
  'fr-create': () => circleSetupSheet(),
  'fr-invite': () => inviteSheet(),
  'fr-invite-setup': () => {
    const p = readPendingCircle(); if (!p) return;
    if (!confirm(`Heads up: this keeps ALL of your family’s synced data (budget, binder, calendar…) in ${p.f || 'the inviting family'}’s Firebase project “${p.c?.projectId || ''}”. Whoever owns that project can see it. Only continue if you fully trust them.`)) return;
    Sync.cfg = { ...(Sync.cfg || {}), config: p.c }; saveCfg(); startSync();
    toast(`Now create your account with ${p.e || 'your email'}`);
    go('settings');
  },
  'fr-join': () => { const p = readPendingCircle(); if (p) joinSheet(p); },
  'fr-invite-forget': () => { localStorage.removeItem(PENDING_CIRCLE_KEY); render(); },
  'fr-rules': (el) => rulesSheet(el.dataset.id),
  'fr-presets': () => presetsSheet(),
  'fr-leave': () => leaveCircle(),
  'fr-remove': (el) => removeFamily(el.dataset.k),
  'fr-family-name': () => openSheet({
    title: 'Our family name', values: { famName: state.friends.famName || '', famEmoji: state.friends.famEmoji || '🏡' },
    fields: [{ row: [{ name: 'famEmoji', label: 'Emoji' }, { name: 'famName', label: 'Name friends see', required: true }] }],
    onSave(v) { state.friends.famName = v.famName; state.friends.famEmoji = v.famEmoji || '🏡'; setTimeout(schedulePublish, 200); },
  }),
  'fr-mute-fam': (el) => { const k = el.dataset.k; if (state.friends.muted[k]) delete state.friends.muted[k]; else state.friends.muted[k] = true; save(); render(); },
  'fr-unmute': (el) => { delete state.friends.muted[el.dataset.k]; save(); render(); },
  'fmute': (el) => { state.friends.muted[el.dataset.k] = true; ui.fmsgPick = null; save(); render(); toast(`🔇 Muted ${pName(el.dataset.k)} for your family`); },
  'fmsg-tap': (el) => { ui.fmsgPick = ui.fmsgPick === el.dataset.id ? null : el.dataset.id; render(); },
  'fmsg-react': (el) => {
    const why = friendBlock('heart'); if (why) { toast(why); return; }
    const me = pkey();
    circleEdit((d) => { const m = d.chat.find((x) => x.id === el.dataset.id); if (!m) return; const r = ((m.rx ||= {})[el.dataset.e] ||= {}); if (r[me]) delete r[me]; else r[me] = true; });
    ui.fmsgPick = null; render();
  },
  'fmsg-del': (el) => { circleEdit((d) => { d.chat = d.chat.filter((x) => x.id !== el.dataset.id); }); ui.fmsgPick = null; render(); },
  'fr-like': (el) => {
    const why = friendBlock('heart'); if (why) { toast(why); return; }
    const me = pkey(), k = el.dataset.k;
    circleEdit((d) => { const s = (d.shows[k] ||= {}); const l = (s.likes ||= {}); if (l[me]) delete l[me]; else l[me] = true; });
    render();
  },
  'fr-trade': (el) => friendTradeSheet(el.dataset.k),
  'ft-yes': (el) => {
    const me = actor(), why = friendBlock('trade', me);
    if (why) { toast(why); return; }
    const myFam = famId(), need = isKidId(me) && kidRule(me).trade === 'approve';
    const d = circle(), t = d?.trades.find((x) => x.id === el.dataset.id);
    if (!t || t.status !== 'offered') return;
    const mine = new Set(myItems(me).map((i) => i.id));
    if (!t.get.every(([iid]) => mine.has(iid))) { circleEdit((c) => { const x = c.trades.find((y) => y.id === t.id); x.status = 'cancelled'; }); toast('You don’t have those squishies anymore'); render(); return; }
    circleEdit((c) => { const x = c.trades.find((y) => y.id === t.id); x.status = 'accepted'; (x.need ||= {})[myFam] = need; (x.ok ||= {})[myFam] = !need; });
    settleFriendTrades();
    toast(need ? '🙌 Accepted! Waiting for a grown-up’s OK' : '✅ Accepted!');
    render();
  },
  'ft-no': (el) => { circleEdit((c) => { const x = c.trades.find((y) => y.id === el.dataset.id); if (x) x.status = 'declined'; }); render(); },
  'ft-cancel': (el) => { circleEdit((c) => { const x = c.trades.find((y) => y.id === el.dataset.id); if (x) x.status = 'cancelled'; }); render(); },
  'ft-ok': (el) => { const f = famId(); circleEdit((c) => { const x = c.trades.find((y) => y.id === el.dataset.id); if (x) (x.ok ||= {})[f] = true; }); settleFriendTrades(); toast('👍 Allowed'); render(); },
  'ft-deny': (el) => { circleEdit((c) => { const x = c.trades.find((y) => y.id === el.dataset.id); if (x) { x.status = 'declined'; x.deniedBy = famId(); } }); toast('Trade not allowed'); render(); },
});

const _inboxItemsF = inboxItems;
inboxItems = function () {
  const items = _inboxItemsF(), me = actor(), d = circle();
  if (!d || !me) return items;
  const myKey = pkey(me), f = famId();
  const unread = d.chat.filter((m) => m.at > (seen().fchat || 0) && m.from !== myKey && !mutedHere(m.from));
  if (unread.length && !(isKidId(me) && !kidRule(me).on)) items.unshift({ n: unread.length, icon: '👯', title: `${unread.length} new in Friends chat`, sub: `${pName(unread.at(-1).from)}: ${isKidId(me) && unsafeText(unread.at(-1).text) ? '🛡️ hidden' : unread.at(-1).text}`, to: 'fchat' });
  for (const t of friendTradeInbox(me)) items.unshift({ n: 1, icon: '🔁', title: `${pName(t.from)} wants to trade squishies`, sub: famName(famOf(t.from)), to: 'friends' });
  if (!kidHere() && !isKidId(me)) for (const t of d.trades.filter((t) => t.need?.[f] && !t.ok?.[f] && ['offered', 'accepted'].includes(t.status))) items.unshift({ n: 1, icon: '🛡️', title: `OK a squishy trade? ${pName(isMine(t.from) ? t.from : t.to)} ⇄ ${pName(isMine(t.from) ? t.to : t.from)}`, sub: 'Tap to allow or not', to: 'friends' });
  return items;
};
const _onLocalSaveF = onLocalSave;
onLocalSave = function () { _onLocalSaveF(); if (circle()) schedulePublish(); };
const _afterRenderF = afterRender;
afterRender = function () {
  _afterRenderF();
  const name = currentRoute().name;
  if (name === 'fchat') {
    chatBar.hidden = false;
    document.body.classList.add('chat-mode');
    seen().fchat = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
    if (!ui.fchatRoute) scrollChat();
  }
  ui.fchatRoute = name === 'fchat';
  configureComposer(name);
  ensureCircle();
  if (circleRenderPending && $('#sheet').hidden) { circleRenderPending = false; setTimeout(render); }
};
// Keep the circle connection in step with family sync (it can come online after the first render).
setInterval(() => { if (state.friends.circleId && !Circle.unsub && syncReady()) ensureCircle(); }, 2000);
// Wait until every script (sync.js decodes the link) has loaded
if (location.hash.startsWith('#join-circle=')) { if (document.readyState === 'complete') setTimeout(catchInvite); else window.addEventListener('load', () => setTimeout(catchInvite)); }

// Kid home: a Friends tile when they're allowed.
const _kidViewF = views.kid;
views.kid = () => {
  const html = _kidViewF(), id = kidModeId();
  if (!id || !kidRule(id).on || !circle()) return html;
  const unread = circle().chat.filter((m) => m.at > (seen().fchat || 0) && m.from !== pkey(id)).length;
  const offers = friendTradeInbox(id).length;
  const card = `<button class="card row tap friends-banner" style="width:100%;text-align:left" data-action="go" data-to="friends"><div class="avatar">👯</div><div class="grow"><div class="title">My Friends</div><div class="sub">${offers ? `🔁 ${offers} trade offer${offers > 1 ? 's' : ''}!` : unread ? `💬 ${unread} new message${unread > 1 ? 's' : ''}` : 'Trade & chat with friends'}</div></div>${ICON.chev}</button>`;
  const i = html.indexOf('<button class="card sq-banner"');
  return i < 0 ? html + card : html.slice(0, i) + card + html.slice(i);
};
