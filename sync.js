/* Family sync (optional). Shares one copy of the family's data between phones through Firebase.
   Loaded after app.js and uses its globals (state, render, save, openSheet, actions, ...).

   How it works: the whole app state lives in one Firestore document, families/{familyId}, as a JSON
   string plus a revision number and the list of emails allowed to open it. Each phone remembers the
   last server copy it merged ("base"). When either side changes, we do a three-way merge of
   base / this phone / server, so edits made on two phones at once are combined instead of overwritten. */
'use strict';

const SYNC_KEY = 'gomezfam:sync'; // { config, familyId, joining }
const BASE_KEY = 'gomezfam:base'; // { rev, data } — last server copy merged into this phone
const FIREBASE_URL = 'https://www.gstatic.com/firebasejs/10.14.1/';
const LOCAL_ONLY = ['theme', 'accent', 'welcomeDismissed', 'whatsNewSeen', 'weather', 'me', 'homeLayout', 'kidMode', 'meBeforeKid']; // per-phone settings that never sync
const INVITE_PREFIX = 'GFAM1.';

const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const writeJSON = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const Sync = {
  cfg: readJSON(SYNC_KEY),
  base: readJSON(BASE_KEY),
  fb: null, user: null, ref: null, unsub: null,
  status: 'off', message: '', emails: [], lastSynced: 0,
  pending: null, pushing: false, dirty: false, pushTimer: null, sizeWarned: false,
};
const saveCfg = () => writeJSON(SYNC_KEY, Sync.cfg);
const setBase = (data, rev) => { Sync.base = { rev, data }; writeJSON(BASE_KEY, Sync.base); };
const connected = () => Sync.status === 'synced' || Sync.status === 'offline';

/* ---------- Three-way merge ---------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isIdList = (v) => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === 'string');

function merge3(base, local, remote) {
  if (same(local, base)) return remote; // only the server changed (or nothing did)
  if (same(remote, base)) return local; // only this phone changed
  if (isIdList(local) && isIdList(remote) && (base === undefined || isIdList(base))) return mergeList(base || [], local, remote);
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const inL = k in local, inR = k in remote, inB = k in b;
      if (inL && inR) out[k] = merge3(b[k], local[k], remote[k]);
      else if (inL && !inB) out[k] = local[k]; // added here
      else if (inR && !inB) out[k] = remote[k]; // added there
      else if (inL) { if (!same(local[k], b[k])) out[k] = local[k]; } // deleted there; keep only if edited here
      else if (!same(remote[k], b[k])) out[k] = remote[k]; // deleted here; keep only if edited there
    }
    return out;
  }
  return local; // both phones changed the same simple value: this phone wins
}

// Lists of {id, ...} records (transactions, events, shopping items...): merge record by record.
function mergeList(base, local, remote) {
  const B = new Map(base.map((x) => [x.id, x]));
  const L = new Map(local.map((x) => [x.id, x]));
  const R = new Set(remote.map((x) => x.id));
  const out = [];
  for (const r of remote) {
    const l = L.get(r.id), b = B.get(r.id);
    if (l) out.push(b ? merge3(b, l, r) : l);
    else if (!b || !same(r, b)) out.push(r); // added there, or deleted here but edited there
  }
  local.forEach((l, i) => {
    if (R.has(l.id)) return;
    const b = B.get(l.id);
    if (b && same(l, b)) return; // deleted there, untouched here
    if (i === 0) out.unshift(l); else out.push(l); // added here
  });
  return out;
}

function shared(s) {
  const c = JSON.parse(JSON.stringify(s));
  for (const k of LOCAL_ONLY) delete c.settings[k];
  return c;
}
function adopt(data) {
  const keep = {};
  for (const k of LOCAL_ONLY) keep[k] = state.settings[k];
  const s = migrate(JSON.parse(JSON.stringify(data)));
  Object.assign(s.settings, keep);
  return s;
}
function persistLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
const sheetIsOpen = () => !document.getElementById('sheet').hidden;

/* ---------- Firebase plumbing ---------- */
async function loadFirebase(config) {
  const [appMod, au, fs] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => import(FIREBASE_URL + f)));
  const app = appMod.initializeApp(config);
  return { auth: au.getAuth(app), db: fs.getFirestore(app), au, fs };
}

function setStatus(status, message = '') {
  Sync.status = status;
  Sync.message = message;
  if (['settings', 'kid'].includes(currentRoute().name)) render();
}

async function startSync() {
  if (!Sync.cfg?.config || Sync.fb) return;
  setStatus('connecting');
  try {
    Sync.fb = await loadFirebase(Sync.cfg.config);
  } catch (e) {
    console.error(e);
    setStatus('error', navigator.onLine ? 'Could not start sync. Check the Firebase settings you pasted.' : 'You\'re offline. Sync will start when you\'re back online.');
    if (!navigator.onLine) window.addEventListener('online', startSync, { once: true });
    return;
  }
  Sync.fb.au.onAuthStateChanged(Sync.fb.auth, (u) => { Sync.user = u; onAuth(); });
}

function onAuth() {
  stopListening();
  const u = Sync.user;
  if (!u) return Sync.cfg.kid ? kidAuth() : setStatus('signed-out');
  if (!u.emailVerified) return setStatus('unverified');
  if (!Sync.cfg.familyId) return setStatus('no-family');
  listen();
}

// Kid devices sign in with the login a parent created (parent+kid@…); the approval email goes to the parent.
async function kidAuth() {
  const { au, auth } = Sync.fb;
  const { email, pw } = Sync.cfg.kid;
  setStatus('connecting');
  try {
    await au.signInWithEmailAndPassword(auth, email, pw);
  } catch (e) {
    if (['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(e.code)) {
      try {
        const cred = await au.createUserWithEmailAndPassword(auth, email, pw);
        await au.sendEmailVerification(cred.user);
      } catch (e2) {
        setStatus('error', e2.code === 'auth/email-already-in-use' ? 'This kid already has a login with a different code. On the parent phone: Kids → Device setup code, and scan that one.' : authMsg(e2));
      }
    } else setStatus('error', authMsg(e));
  }
}

function stopListening() { if (Sync.unsub) { Sync.unsub(); Sync.unsub = null; } }

function listen() {
  const { doc, onSnapshot } = Sync.fb.fs;
  Sync.ref = doc(Sync.fb.db, 'families', Sync.cfg.familyId);
  setStatus('connecting');
  Sync.unsub = onSnapshot(Sync.ref, (snap) => {
    if (!snap.exists()) return setStatus('error', 'That family wasn\'t found. Check the invite code.');
    const d = snap.data();
    Sync.emails = d.emails || [];
    let remote;
    try { remote = JSON.parse(d.data); } catch { return setStatus('error', 'The shared data looks damaged.'); }
    const rev = d.rev || 0;
    if (Sync.cfg.joining) {
      state = adopt(remote);
      setBase(remote, rev);
      Sync.cfg.joining = false;
      saveCfg(); persistLocal(); applyTheme(); if (typeof activityResync === 'function') activityResync(); render();
      toast('Connected to the family ✓');
    } else {
      applyRemote(remote, rev);
    }
    markSynced();
  }, (err) => syncError(err));
}

function applyRemote(remote, rev) {
  if (Sync.base && rev <= Sync.base.rev) return; // our own write echoing back, or an older copy
  if (sheetIsOpen() || Sync.pushing) { Sync.pending = { remote, rev }; return; }
  Sync.pending = null;
  const local = shared(state);
  const merged = Sync.base ? merge3(Sync.base.data, local, remote) : remote;
  setBase(remote, rev);
  if (!same(merged, local)) { state = adopt(merged); persistLocal(); if (typeof activityResync === 'function') activityResync(); render(); }
  if (!same(merged, remote)) schedulePush();
}

function schedulePush(delay = 900) {
  if (!Sync.ref || !Sync.base) return;
  Sync.dirty = true;
  clearTimeout(Sync.pushTimer);
  Sync.pushTimer = setTimeout(push, delay);
}

async function push() {
  if (!Sync.ref || !Sync.base || !Sync.dirty) return;
  if (sheetIsOpen() || Sync.pushing) return; // retried when the sheet closes / push ends
  Sync.pushing = true;
  Sync.dirty = false;
  const start = shared(state);
  const { runTransaction, serverTimestamp } = Sync.fb.fs;
  try {
    let merged, rev;
    await runTransaction(Sync.fb.db, async (tx) => {
      const snap = await tx.get(Sync.ref);
      if (!snap.exists()) throw Object.assign(new Error('missing'), { code: 'not-found' });
      const d = snap.data();
      merged = merge3(Sync.base.data, start, JSON.parse(d.data));
      rev = (d.rev || 0) + 1;
      tx.update(Sync.ref, { data: JSON.stringify(merged), rev, updatedAt: serverTimestamp(), updatedBy: Sync.user.email });
    });
    setBase(merged, rev);
    // Fold in anything changed on this phone while the write was in flight.
    const now = shared(state);
    const next = merge3(start, now, merged);
    if (!same(next, now)) { state = adopt(next); persistLocal(); if (typeof activityResync === 'function') activityResync(); render(); }
    if (!same(next, merged)) Sync.dirty = true;
    markSynced();
    const size = JSON.stringify(merged).length;
    if (size > 800000 && !Sync.sizeWarned) { Sync.sizeWarned = true; toast('Shared data is getting large — consider clearing old transactions'); }
  } catch (e) {
    Sync.dirty = true;
    syncError(e);
  } finally {
    Sync.pushing = false;
    if (Sync.pending) { const p = Sync.pending; applyRemote(p.remote, p.rev); }
    if (Sync.dirty && Sync.status === 'synced') schedulePush(2000);
  }
}

function markSynced() {
  Sync.lastSynced = Date.now();
  if (Sync.status !== 'synced') setStatus('synced');
  else if (['settings', 'kid'].includes(currentRoute().name)) render();
}

function syncError(e) {
  console.error('sync', e);
  const code = e?.code || '';
  if (code.includes('permission-denied')) {
    stopListening();
    setStatus('denied');
  } else if (code.includes('unavailable') || !navigator.onLine) {
    setStatus('offline', 'Offline — changes are saved on this phone and will sync later.');
  } else {
    setStatus('error', e?.message || 'Something went wrong with sync.');
  }
}

// Hooks called from app.js
function syncAfterSave() { if (Sync.ref && Sync.base) schedulePush(); }
function syncAfterSheet() {
  if (Sync.pending) { const p = Sync.pending; applyRemote(p.remote, p.rev); }
  if (Sync.dirty) schedulePush(300);
}
window.addEventListener('online', () => { if (Sync.status === 'offline') { Sync.status = 'synced'; } if (Sync.dirty) schedulePush(300); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Sync.dirty) schedulePush(300); });

/* ---------- Setup helpers ---------- */
function parseFirebaseConfig(text) {
  const t = String(text || '').trim();
  let cfg = null;
  try { cfg = JSON.parse(t); } catch {
    cfg = {};
    for (const m of t.matchAll(/(\w+)\s*:\s*["']([^"']+)["']/g)) cfg[m[1]] = m[2];
  }
  return cfg && cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null;
}
const b64url = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function inviteCode() { return INVITE_PREFIX + b64url(JSON.stringify({ c: Sync.cfg.config, f: Sync.cfg.familyId })); }
function parseInvite(text) {
  const m = String(text || '').match(/GFAM1\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { const o = JSON.parse(unb64url(m[1])); return o.c && o.f ? o : null; } catch { return null; }
}
function randomId(n = 20) {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => a[x % a.length]).join('');
}
const hasOwnData = () => state.budget.transactions.length || state.budget.bills.length || state.events.length || state.people.length || state.shop.list.length || state.chores.length;

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'That email already has an account — tap Sign in instead.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email — tap Create account.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'That email address doesn\'t look right.',
  'auth/network-request-failed': 'No internet connection.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/operation-not-allowed': 'Email/Password sign-in isn\'t turned on in Firebase yet (Authentication → Sign-in method).',
};
const authMsg = (e) => AUTH_ERRORS[e?.code] || e?.message || 'Something went wrong.';

function authSheet(mode) {
  openSheet({
    title: mode === 'signup' ? 'Create account' : 'Sign in',
    saveLabel: mode === 'signup' ? 'Create' : 'Sign in',
    values: { email: Sync.user?.email || '' },
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
      { name: 'password', label: mode === 'signup' ? 'Choose a password (6+ characters)' : 'Password', type: 'password', required: true },
      ...(mode === 'signup' ? [{ type: 'html', html: '<p class="small muted" style="margin:0 4px">Use the email that was given access. We\'ll send a link to confirm it\'s you.</p>' }] : []),
    ],
    onSave(v) {
      const { au, auth } = Sync.fb;
      const email = v.email.toLowerCase();
      (async () => {
        try {
          if (mode === 'signup') {
            const cred = await au.createUserWithEmailAndPassword(auth, email, v.password);
            await au.sendEmailVerification(cred.user);
            toast('Check your email for a confirmation link');
          } else {
            await au.signInWithEmailAndPassword(auth, email, v.password);
          }
          closeSheet();
        } catch (e) { toast(authMsg(e)); }
      })();
      return false;
    },
  });
}

/* ---------- Settings card ---------- */
function syncCardHTML() {
  const s = Sync.status;
  const email = Sync.user?.email || '';
  let body;
  if (!Sync.cfg?.config) {
    body = `<p class="small" style="margin:0 0 10px">Share one copy of the budget, lists, calendar and everything else between your phones. Changes show up on every phone within seconds.</p>
      <div class="btn-row" style="margin:0">
        <button class="btn" data-action="sync-setup">Set up</button>
        <button class="btn secondary" data-action="sync-join">Join with invite</button>
      </div>
      <button class="btn secondary block" style="margin-top:8px" data-action="kid-scan">🧒 This is a kid's device</button>`;
  } else if (s === 'connecting' || s === 'off') {
    body = `<p class="small muted" style="margin:0">Connecting…</p>`;
  } else if (s === 'signed-out') {
    body = `<p class="small" style="margin:0 0 10px">Sign in to sync this phone with your family.</p>
      <div class="btn-row" style="margin:0"><button class="btn" data-action="sync-signin">Sign in</button><button class="btn secondary" data-action="sync-signup">Create account</button></div>
      <button class="mini-btn" style="margin-top:6px" data-action="sync-forgot">Forgot password?</button>`;
  } else if (s === 'unverified' && Sync.cfg.kid) {
    body = `<p class="small" style="margin:0 0 10px">📧 Waiting for a parent to approve this device. They got an email for <b>${esc(Sync.cfg.kid.email)}</b> — tap the link in it.</p>
      <button class="btn block" data-action="sync-verified">It's approved</button>`;
  } else if (s === 'unverified') {
    body = `<p class="small" style="margin:0 0 10px">📧 We sent a confirmation link to <b>${esc(email)}</b>. Tap it, then come back here. (Check spam too.)</p>
      <div class="btn-row" style="margin:0"><button class="btn" data-action="sync-verified">I've confirmed</button><button class="btn secondary" data-action="sync-resend">Resend</button></div>
      <button class="mini-btn" style="margin-top:6px" data-action="sync-signout">Use a different email</button>`;
  } else if (s === 'no-family') {
    body = `<p class="small" style="margin:0 0 10px">Signed in as <b>${esc(email)}</b>. Is this the first phone, or are you joining someone?</p>
      <div class="btn-row" style="margin:0"><button class="btn" data-action="sync-create">Start sharing this phone's data</button></div>
      <div class="btn-row" style="margin:0"><button class="btn secondary" data-action="sync-join">Join with invite</button></div>`;
  } else if (s === 'denied') {
    body = `<p class="small" style="margin:0 0 10px">🔒 <b>${esc(email)}</b> doesn't have access yet. Ask whoever set up sync to add this email under <b>Settings → Family sync → Who has access</b>, then tap Try again.</p>
      <div class="btn-row" style="margin:0"><button class="btn" data-action="sync-retry">Try again</button><button class="btn secondary" data-action="sync-signout">Sign out</button></div>`;
  } else if (s === 'error') {
    body = `<p class="small" style="margin:0 0 10px;color:var(--bad)">${esc(Sync.message)}</p>
      <div class="btn-row" style="margin:0"><button class="btn" data-action="sync-retry">Try again</button><button class="btn danger" data-action="sync-off">Turn off sync</button></div>`;
  } else {
    const ago = Math.round((Date.now() - Sync.lastSynced) / 60000);
    body = `<div class="kv"><span>${s === 'offline' ? '⏸️ Offline' : '✅ Synced'}</span><span class="small muted">${s === 'offline' ? 'will sync when online' : ago < 1 ? 'just now' : `${ago} min ago`}</span></div>
      <div class="small muted" style="margin-bottom:10px">Signed in as ${esc(email)}</div>
      <h3 style="margin-top:6px">Who has access</h3>
      <div class="card flush" style="box-shadow:none;border:1px solid var(--line);margin-bottom:10px">
        ${Sync.emails.map((e) => `<div class="row"><div class="grow"><div class="title" style="font-weight:500">${esc(e)}</div></div>${e === email ? '<span class="pill">You</span>' : `<button class="del-btn" data-action="sync-remove-email" data-email="${esc(e)}" aria-label="Remove">${ICON.x}</button>`}</div>`).join('')}
      </div>
      <div class="btn-row" style="margin:0">
        <button class="btn" data-action="sync-add-email">+ Add person</button>
        <button class="btn secondary" data-action="sync-invite">📤 Send invite</button>
      </div>
      <div class="btn-row" style="margin:6px 0 0"><button class="mini-btn" data-action="sync-signout">Sign out</button><button class="mini-btn" style="color:var(--bad)" data-action="sync-off">Turn off sync on this phone</button></div>`;
  }
  return `<div class="section-title">Family sync</div><div class="card">${body}</div>`;
}

/* ---------- Actions ---------- */
Object.assign(actions, {
  'sync-setup': () => openSheet({
    title: 'Connect Firebase',
    saveLabel: 'Connect',
    values: {},
    fields: [
      { type: 'html', html: `<p class="small muted" style="margin:0 4px 10px">Paste the <b>firebaseConfig</b> from your Firebase project (Project settings → Your apps). It looks like <span style="font-family:ui-monospace,monospace">apiKey: "…", authDomain: "…", projectId: "…"</span></p>` },
      { name: 'config', label: 'Firebase config', type: 'textarea', required: true },
    ],
    onSave(v) {
      const config = parseFirebaseConfig(v.config);
      if (!config) { toast('That doesn\'t look like a Firebase config — it needs apiKey, projectId and appId'); return false; }
      Sync.cfg = { config };
      saveCfg();
      setTimeout(startSync);
    },
  }),
  'sync-join': (el, e, prefill) => openSheet({
    title: 'Join your family',
    saveLabel: 'Join',
    values: { invite: prefill || '' },
    fields: [
      { type: 'html', html: '<p class="small muted" style="margin:0 4px 10px">Paste the whole invite message you were sent. It contains a code starting with <b>GFAM1.</b></p>' },
      { name: 'invite', label: 'Invite', type: 'textarea', required: true },
    ],
    onSave(v) {
      const inv = parseInvite(v.invite);
      if (!inv) { toast('Couldn\'t find an invite code in that text'); return false; }
      if (hasOwnData() && !confirm('Joining replaces the data on this phone with your family\'s shared data. Continue?')) return false;
      const sameProject = Sync.cfg?.config?.projectId === inv.c.projectId;
      Sync.cfg = { config: inv.c, familyId: inv.f, joining: true };
      saveCfg();
      writeJSON(BASE_KEY, null); Sync.base = null;
      if (Sync.fb && !sameProject) { location.reload(); return; }
      setTimeout(() => (Sync.fb ? onAuth() : startSync()));
    },
  }),
  'sync-signin': () => authSheet('signin'),
  'sync-signup': () => authSheet('signup'),
  'sync-forgot': () => openSheet({
    title: 'Reset password',
    saveLabel: 'Send',
    values: {},
    fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
    onSave(v) {
      Sync.fb.au.sendPasswordResetEmail(Sync.fb.auth, v.email.toLowerCase())
        .then(() => toast('Reset link sent — check your email')).catch((e) => toast(authMsg(e)));
    },
  }),
  'sync-verified': async () => {
    try {
      await Sync.user.reload();
      Sync.user = Sync.fb.auth.currentUser;
      if (!Sync.user?.emailVerified) { toast('Not confirmed yet — tap the link in the email first'); return; }
      await Sync.user.getIdToken(true);
      onAuth();
    } catch (e) { toast(authMsg(e)); }
  },
  'sync-resend': () => Sync.fb.au.sendEmailVerification(Sync.user).then(() => toast('Sent again')).catch((e) => toast(authMsg(e))),
  'sync-signout': () => { stopListening(); Sync.fb.au.signOut(Sync.fb.auth); },
  'sync-retry': () => { if (!Sync.fb) startSync(); else onAuth(); },
  'sync-create': async () => {
    const { doc, setDoc, serverTimestamp } = Sync.fb.fs;
    const familyId = randomId();
    const data = shared(state);
    const email = Sync.user.email.toLowerCase();
    try {
      await setDoc(doc(Sync.fb.db, 'families', familyId), { data: JSON.stringify(data), rev: 1, emails: [email], createdBy: email, updatedBy: email, updatedAt: serverTimestamp() });
      Sync.cfg.familyId = familyId;
      saveCfg();
      setBase(data, 1);
      listen();
      toast('Sync is on ✓ Now add your family under Who has access');
    } catch (e) { syncError(e); }
  },
  'sync-add-email': () => openSheet({
    title: 'Give access',
    saveLabel: 'Add',
    values: {},
    fields: [
      { name: 'email', label: 'Their email', type: 'email', required: true, placeholder: 'name@example.com' },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">They\'ll create an account with this exact email, then join with your invite.</p>' },
    ],
    onSave(v) {
      const { updateDoc, arrayUnion } = Sync.fb.fs;
      updateDoc(Sync.ref, { emails: arrayUnion(v.email.toLowerCase()) })
        .then(() => toast(`${v.email} can now join — send them the invite`)).catch(syncError);
    },
  }),
  'sync-remove-email': (el) => {
    const e = el.dataset.email;
    if (!confirm(`Remove ${e}'s access? Their phone keeps what it has but stops syncing.`)) return;
    const { updateDoc, arrayRemove } = Sync.fb.fs;
    updateDoc(Sync.ref, { emails: arrayRemove(e) }).catch(syncError);
  },
  'sync-invite': async () => {
    const url = location.origin + location.pathname;
    const text = `Join our family app! 🏠\n\n1. Open ${url} in Safari, tap Share → Add to Home Screen.\n2. Open the app from your Home Screen → ⚙️ Settings → Family sync → Join with invite, and paste this whole message.\n3. Tap Create account and use the email I added for you.\n\nInvite code: ${inviteCode()}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Join our family app', text });
      else { await navigator.clipboard.writeText(text); toast('Invite copied — paste it in a text'); }
    } catch (e) { if (e.name !== 'AbortError') toast('Could not share'); }
  },
  'sync-off': () => {
    if (!confirm('Turn off sync on this phone? Your data stays on this phone but stops updating from the family.')) return;
    stopListening();
    Sync.fb?.au.signOut(Sync.fb.auth).catch(() => {});
    writeJSON(SYNC_KEY, null); writeJSON(BASE_KEY, null);
    setTimeout(() => location.reload(), 300);
  },
});

/* ---------- Boot ---------- */
(function bootSync() {
  // Opened from an invite link (…/#join=GFAM1.xxxx): go straight to the join sheet.
  const m = location.hash.match(/^#join=(.+)$/);
  if (m) {
    history.replaceState(null, '', location.pathname + '#settings');
    render();
    setTimeout(() => actions['sync-join'](null, null, decodeURIComponent(m[1])));
  }
  else render(); // app.js drew the first screen before this file loaded
  if (Sync.cfg?.config) startSync();
})();
