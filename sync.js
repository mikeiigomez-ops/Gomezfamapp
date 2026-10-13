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
const LOCAL_ONLY = ['theme', 'accent', 'welcomeDismissed', 'whatsNewSeen', 'weather', 'me', 'homeLayout', 'kidMode', 'meBeforeKid', 'seen', 'wpos', 'syncRev']; // per-phone settings that never sync
// syncRev: the server revision this phone's saved state already includes. Saved inside the main state record, so it
// is always in step with it: if it disagrees with the saved base copy (a write failed), we merge without deletions.
const INVITE_PREFIX = 'GFAM1.';

const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const writeJSON = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const Sync = {
  cfg: readJSON(SYNC_KEY),
  base: readJSON(BASE_KEY),
  fb: null, user: null, ref: null, unsub: null,
  status: 'off', message: '', emails: [], lastSynced: 0,
  pending: null, pushing: false, dirty: false, pushTimer: null, sizeWarned: false,
  recover: false, retryN: 0, retryTimer: null, listenRetryN: 0, firstSnap: true,
};
const saveCfg = () => writeJSON(SYNC_KEY, Sync.cfg);
// persist=false: this phone's state couldn't be saved, so the saved base must not run ahead of it
const setBase = (data, rev, persist = true) => { Sync.base = { rev, data }; if (persist) writeJSON(BASE_KEY, Sync.base); };
const connected = () => Sync.status === 'synced' || Sync.status === 'offline';

/* ---------- Three-way merge ---------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const canon = (v) => JSON.stringify(v, (k, x) => (isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x)); // key order doesn't matter
const isIdList = (v) => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === 'string');

// merge3, plus Squishvale story progress kept whole: if one person plays on two devices at once,
// the further-along chapter/step wins as a unit (never a mix of both), and bubbles add up.
function mergeState(base, local, remote) { return dedupeGems(mergeWorld(base, local, remote)); }
// A one-time gem reward (keyed) earned on two phones before they synced counts once.
function dedupeGems(out) {
  const G = out && out.gems && out.gems.log;
  if (!Array.isArray(G)) return out;
  const seen = new Set(), log = G.filter((l) => { if (!isObj(l) || !l.key) return true; const k = l.who + '|' + l.key; if (seen.has(k)) return false; seen.add(k); return true; });
  return log.length === G.length ? out : { ...out, gems: { ...out.gems, log } };
}
function mergeWorld(base, local, remote) {
  const out = merge3(base, local, remote);
  const W = out && out.world, LW = local && local.world, RW_ = remote && remote.world, BW = (base && base.world) || {};
  if (!isObj(W) || !isObj(LW) || !isObj(RW_)) return out;
  for (const id of Object.keys(W)) {
    const l = LW[id], r = RW_[id], b = BW[id];
    if (!isObj(l) || !isObj(r) || same(l, r) || same(l, b) || same(r, b) || W[id] === l || W[id] === r) continue; // same(l, r): the server already has this phone's write
    const rank = (q) => (Number(q.ch) || 0) * 1000 + (Number(q.step) || 0);
    const win = rank(l) >= rank(r) ? l : r, m = W[id];
    for (const k of ['ch', 'step', 'cnt', 'items']) if (k in win) m[k] = JSON.parse(JSON.stringify(win[k]));
    if (Array.isArray(l.done) && Array.isArray(r.done)) m.done = [...new Set([...l.done, ...r.done])].sort((a, c) => a - c);
    if (isObj(b) && [l.bubbles, r.bubbles, b.bubbles].every((n) => typeof n === 'number') && l.bDay === r.bDay) {
      // +5 rewards both devices granted for the same thing (same chapter star, same new day) count once
      const bd = Array.isArray(b.done) ? b.done : [], twice = (Array.isArray(l.done) && Array.isArray(r.done) ? l.done.filter((c) => r.done.includes(c) && !bd.includes(c)).length : 0) + (l.bDay !== b.bDay ? 1 : 0);
      m.bubbles = Math.max(0, l.bubbles + r.bubbles - b.bubbles - 5 * twice);
    }
  }
  return out;
}
// No trustworthy base (lost, damaged, or out of step with the saved state): never treat a missing record as a
// deletion. Keys/records on either side are kept; where both have one, the server copy wins.
function mergeUnion(local, remote) {
  if (same(local, remote)) return remote;
  if (isIdList(local) && isIdList(remote)) {
    const L = new Map(local.map((x) => [x.id, x])), R = new Set(remote.map((x) => x.id));
    const out = remote.map((r) => (L.has(r.id) ? mergeUnion(L.get(r.id), r) : r));
    local.forEach((l) => { if (!R.has(l.id)) out.push(l); });
    return out;
  }
  if (isObj(local) && isObj(remote)) {
    const out = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) out[k] = !(k in remote) ? local[k] : !(k in local) ? remote[k] : mergeUnion(local[k], remote[k]);
    return out;
  }
  return remote;
}
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
  for (const a of Object.values(c.kidAccounts || {})) if (a && typeof a === 'object') delete a.pw; // kid passwords stay on this phone
  return c;
}
function adopt(data) {
  const keep = {};
  for (const k of LOCAL_ONLY) keep[k] = state.settings[k];
  const s = migrate(JSON.parse(JSON.stringify(data)));
  if (typeof stashKidPw === 'function') stashKidPw(s); // from an older phone: keep it here, never re-share it
  Object.assign(s.settings, keep);
  return s;
}
// true when saved. writeState (app.js) shows the storage-full banner when it isn't.
function persistLocal() { if (typeof writeState === 'function') return writeState(); try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; } catch { return false; } }
// Take on a merged copy (next = new state, or null when nothing changed here) that includes server revision rev.
// The base copy is only saved once the state that includes it is saved.
function commitMerged(next, baseData, rev) {
  if (next) state = next;
  state.settings.syncRev = rev;
  setBase(baseData, rev, persistLocal());
  if (next) { if (typeof activityResync === 'function') activityResync(); renderRemote(); }
}
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
  document.body.classList.toggle('sync-offline', status === 'offline');
  document.body.classList.toggle('sync-error', status === 'error');
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
  Sync.firstSnap = true;
  Sync.unsub = onSnapshot(Sync.ref, async (snap) => {
    Sync.listenRetryN = 0;
    if (!snap.exists()) return setStatus('error', 'That family wasn\'t found. Check the invite code.');
    const d = snap.data();
    Sync.emails = d.emails || [];
    // Kid logins made before kid roles existed: list them as kids (parent phones only)
    const kidEmails = Object.values(state.kidAccounts || {}).map((a) => String(a?.email || '').toLowerCase()).filter(Boolean);
    if (!Sync.cfg.kid && kidEmails.some((e) => !(d.kids || []).includes(e))) Sync.fb.fs.updateDoc(Sync.ref, { kids: Sync.fb.fs.arrayUnion(...kidEmails) }).catch(() => {});
    if (typeof liveFromDoc === 'function') liveFromDoc(d.live);
    // Our own write echoing back (or a live-spot update): nothing new to read
    const upToDate = () => !Sync.cfg.joining && !Sync.recover && Sync.base && (d.rev || 0) <= Sync.base.rev;
    if (upToDate()) { markSynced(); afterFirstSnap(); return; }
    let remote;
    try { remote = await unpackData(d.data); } catch { return setStatus('error', 'The shared data looks damaged.'); }
    const rev = d.rev || 0;
    if (upToDate()) { markSynced(); afterFirstSnap(); return; } // a newer copy landed while unpacking
    if (Sync.cfg.joining) {
      Sync.cfg.joining = false; Sync.recover = false;
      saveCfg();
      commitMerged(adopt(remote), remote, rev); applyTheme(); render();
      toast('Connected to the family ✓');
    } else if (Sync.recover) {
      // This phone's saved copy and its base disagree (or the base is gone): keep everything from both sides
      Sync.recover = false;
      const local = shared(state), merged = dedupeGems(mergeUnion(local, remote));
      commitMerged(same(merged, local) ? null : adopt(merged), remote, rev);
      if (!same(merged, remote)) schedulePush(300);
    } else {
      applyRemote(remote, rev);
    }
    markSynced();
    afterFirstSnap();
  }, (err) => { Sync.unsub = null; syncError(err, 'listen'); });
}
// Edits saved here but never sent (app closed within a second, or made offline): send them now.
function afterFirstSnap() { if (Sync.firstSnap) { Sync.firstSnap = false; checkUnpushed(); } }
function checkUnpushed() {
  if (!Sync.ref || !Sync.base || Sync.pushing || Sync.cfg?.joining || Sync.recover) return;
  if (Sync.dirty || canon(shared(state)) !== canon(Sync.base.data)) schedulePush(300);
}

// Redraw after another phone's change without wiping what you're typing in a field on screen
function renderRemote() {
  const ae = document.activeElement;
  const keep = ae && viewEl.contains(ae) && ae.name && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && !/^(checkbox|radio|file)$/.test(ae.type)
    ? { sel: (ae.form?.dataset.submit ? `[data-submit="${ae.form.dataset.submit}"] ` : '') + `[name="${ae.name}"]`, v: ae.value, s: ae.selectionStart, e: ae.selectionEnd } : null;
  render();
  if (!keep) return;
  const el = viewEl.querySelector(keep.sel);
  if (el && el !== document.activeElement) { el.value = keep.v; el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.e); } catch {} }
}
// Big families: the shared copy is gzip-compressed (about 7× smaller) so it stays under Firestore's 1 MB document limit.
// Small families stay plain JSON, readable by any version of the app.
const GZ = 'gz1:';
async function packData(obj) {
  const json = JSON.stringify(obj);
  if (json.length < 300000 || typeof CompressionStream === 'undefined') return json;
  const buf = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return GZ + btoa(bin);
}
async function unpackData(str) {
  if (!String(str).startsWith(GZ)) return JSON.parse(str);
  const bin = atob(str.slice(GZ.length)), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
function applyRemote(remote, rev) {
  if (Sync.base && rev <= Sync.base.rev) return; // our own write echoing back, or an older copy
  if (sheetIsOpen() || Sync.pushing) { Sync.pending = { remote, rev }; return; }
  Sync.pending = null;
  const local = shared(state);
  const merged = Sync.base ? mergeState(Sync.base.data, local, remote) : dedupeGems(mergeUnion(local, remote));
  const next = same(merged, local) ? null : adopt(merged); // may throw: then the baseline stays put
  commitMerged(next, remote, rev);
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
      const server = await unpackData(d.data);
      merged = mergeState(Sync.base.data, start, server);
      rev = d.rev || 0;
      if (same(merged, server)) return; // nothing new from this phone: skip the write
      rev += 1;
      const dataStr = await packData(merged);
      if (new Blob([dataStr]).size > 1000000) throw Object.assign(new Error('Family data is over Firebase’s 1 MB limit'), { code: 'too-big' });
      tx.update(Sync.ref, { data: dataStr, rev, updatedAt: serverTimestamp(), updatedBy: Sync.user.email });
    });
    // Fold in anything changed on this phone while the write was in flight.
    const now = shared(state);
    const next = mergeState(start, now, merged);
    commitMerged(same(next, now) ? null : adopt(next), merged, rev);
    if (!same(next, merged)) Sync.dirty = true;
    Sync.retryN = 0;
    markSynced();
    const size = JSON.stringify(merged).length;
    if (size > 800000 && !Sync.sizeWarned) { Sync.sizeWarned = true; toast('Shared data is getting large — consider clearing old transactions'); }
  } catch (e) {
    Sync.dirty = true;
    syncError(e, 'push');
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

// Brief server/network trouble: try again after 2s, 5s, 15s, then every minute
const TRANSIENT = ['aborted', 'deadline-exceeded', 'resource-exhausted', 'unavailable', 'internal'];
const BACKOFF = [2000, 5000, 15000, 60000];
const isTransient = (code) => TRANSIENT.some((t) => code === t || code.endsWith('/' + t));
function syncError(e, from) {
  console.error('sync', e);
  const code = e?.code || '';
  if (isTransient(code) || (!navigator.onLine && from)) {
    if (from === 'push') {
      clearTimeout(Sync.retryTimer);
      Sync.retryTimer = setTimeout(() => { Sync.dirty = true; push(); }, BACKOFF[Math.min(Sync.retryN++, BACKOFF.length - 1)]);
    } else if (from === 'listen') {
      clearTimeout(Sync.listenTimer);
      Sync.listenTimer = setTimeout(relisten, BACKOFF[Math.min(Sync.listenRetryN++, BACKOFF.length - 1)]);
    }
  }
  if (code.includes('permission-denied')) {
    stopListening();
    setStatus('denied');
  } else if (code === 'too-big') {
    Sync.tooBigAt = Date.now();
    setStatus('error', 'Shared data is too big to sync. Make a backup in Settings, then remove old history.');
  } else if (isTransient(code) || !navigator.onLine) {
    setStatus('offline', navigator.onLine ? 'Having trouble reaching the family copy — trying again…' : 'Offline — changes are saved on this phone and will sync later.');
  } else {
    setStatus('error', e?.message || 'Something went wrong with sync.');
  }
}

// Hooks called from app.js
function syncAfterSave() { if (Sync.ref && Sync.base && Date.now() - (Sync.tooBigAt || 0) > 60000) schedulePush(); } // don't re-merge every save while over the size limit
function syncAfterSheet() {
  if (Sync.pending) { const p = Sync.pending; applyRemote(p.remote, p.rev); }
  if (Sync.dirty) schedulePush(300);
}
// The listener stopped (error while offline / in the background): start it again
function relisten() {
  clearTimeout(Sync.listenTimer);
  if (Sync.unsub || !Sync.fb || !Sync.user?.emailVerified || !Sync.cfg?.familyId || Sync.status === 'denied') return;
  listen();
}
function wakeSync() {
  if (!Sync.unsub) return relisten();
  if (Sync.status === 'offline') setStatus('synced');
  checkUnpushed();
}
// Going to the background / closing: send waiting edits now instead of after the debounce
function flushPush() { if (Sync.pushTimer && Sync.dirty) { clearTimeout(Sync.pushTimer); Sync.pushTimer = null; push(); } }
window.addEventListener('online', wakeSync);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeSync(); else flushPush(); });
window.addEventListener('pagehide', flushPush);
window.addEventListener('unhandledrejection', (e) => console.error('unhandled rejection', e.reason));

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
      commitMerged(null, data, 1);
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
  // This phone's saved data couldn't be read: take the family copy instead of pushing an empty one
  if (typeof loadFailed !== 'undefined' && loadFailed && Sync.cfg?.familyId) { Sync.cfg.joining = true; saveCfg(); }
  // The saved base copy is missing/damaged or out of step with the saved state (a write failed, e.g. storage full):
  // merging against it would treat records as deleted, so do one merge that keeps everything instead
  else if (Sync.cfg?.familyId && !Sync.cfg.joining) {
    const b = Sync.base, sr = state.settings.syncRev;
    if (!b || !isObj(b.data) || typeof b.rev !== 'number' || (sr != null && sr !== b.rev)) { Sync.recover = true; if (b && !isObj(b.data)) Sync.base = null; }
  }
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
