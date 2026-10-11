/* Live visits: see each other walk around Dream House rooms in real time.
   Each person's spot is a tiny document, families/{familyId}/live/{memberId} = { room, x, y, at }, so a
   step is one small write and never touches the family data. Phones only listen while someone is on a
   house screen. If the Firebase rules haven't been updated for these documents yet, the spot is kept in a
   `live` field on the family document instead (works right away, just heavier). Loaded after sync.js. */
'use strict';

const LIVE_TTL = 90 * 1000;       // a spot older than this means they left
const LIVE_BEAT = 25 * 1000;      // re-send while sitting still
const LIVE_ROUTES = ['house', 'room', 'town', 'world'];
const Live = { all: {}, sent: '', timer: null, beat: null, unsub: null, fallback: false, stopT: null, seenHere: {} };

const liveOn = () => typeof Sync !== 'undefined' && !!Sync.ref && !!Sync.fb && Sync.cfg?.familyId && (Sync.status === 'synced' || Sync.status === 'offline');
const liveFresh = (v) => v && v.room && Date.now() - (v.at || 0) < LIVE_TTL;

/* ---------- Where am I? ---------- */
function liveMine() {
  const me = actor(), { name, param } = currentRoute();
  if (me && name === 'world' && document.visibilityState === 'visible' && typeof worldLive === 'function') { const w = worldLive(); if (w) return { room: '', w, at: Date.now() }; }
  if (!me || name !== 'room' || document.visibilityState !== 'visible') return { room: '', at: Date.now() };
  const found = findRoom(param);
  if (!found || ui.hEdit === found.r.id) return { room: '', at: Date.now() };
  const pos = canEdit(found.mid) ? (found.r.av || { x: 72, y: 95 }) : (ui.hVis?.[param] || { x: 24, y: 97 });
  return { room: param, house: found.mid, x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, at: Date.now() };
}

/* ---------- Send ---------- */
function livePush(force = false) {
  clearTimeout(Live.timer);
  Live.timer = setTimeout(() => liveSend(force), 250);
}
async function liveSend(force) {
  if (!liveOn()) return;
  const me = actor();
  if (!me) return;
  const rec = liveMine();
  const key = JSON.stringify({ ...rec, at: 0 });
  if (!force && key === Live.sent) return;
  if (!rec.room && !rec.w && !Live.sent) return; // never been anywhere: nothing to clear
  Live.sent = rec.room || rec.w ? key : '';
  const fs = Sync.fb.fs;
  try {
    if (!Live.fallback) await fs.setDoc(fs.doc(Sync.fb.db, 'families', Sync.cfg.familyId, 'live', me), rec);
    else await fs.updateDoc(Sync.ref, { ['live.' + me]: rec });
  } catch (e) {
    if (!Live.fallback && /permission/i.test(e.code || e.message || '')) { Live.fallback = true; liveListen(true); liveSend(true); }
  }
}
function liveBeat() {
  clearInterval(Live.beat);
  Live.beat = setInterval(() => { if (['room', 'world'].includes(currentRoute().name)) liveSend(true); }, LIVE_BEAT);
}

/* ---------- Receive ---------- */
function liveListen(restart = false) {
  if (!liveOn()) return;
  if (Live.unsub && !restart) return;
  if (Live.unsub) { Live.unsub(); Live.unsub = null; }
  if (Live.fallback) return; // the family document's own listener feeds liveFromDoc()
  const fs = Sync.fb.fs;
  try {
    Live.unsub = fs.onSnapshot(fs.collection(Sync.fb.db, 'families', Sync.cfg.familyId, 'live'), (qs) => {
      const all = {};
      qs.forEach((d) => { all[d.id] = d.data(); });
      liveIn(all);
    }, (err) => {
      if (/permission/i.test(err?.code || err?.message || '')) { Live.fallback = true; Live.unsub = null; liveSend(true); }
    });
  } catch { Live.fallback = true; }
}
function liveStop() {
  clearTimeout(Live.stopT);
  Live.stopT = setTimeout(() => { if (!LIVE_ROUTES.includes(currentRoute().name) && Live.unsub) { Live.unsub(); Live.unsub = null; } }, 5000);
}
// Called by sync.js with the family document's `live` field (used when on the fallback).
function liveFromDoc(live) { if (Live.fallback) liveIn(live || {}); }

function liveIn(all) {
  const before = Live.all;
  Live.all = all || {};
  const me = actor();
  // A friendly hello when someone walks into your house
  const mine = me && houseOf(me);
  if (mine) {
    for (const [id, v] of Object.entries(Live.all)) {
      if (id === me || !liveFresh(v) || v.house !== me || !isMember(id)) continue;
      const was = before[id];
      if (!liveFresh(was) || was.house !== me) {
        const r = mine.rooms.find((x) => x.id === v.room);
        if (Date.now() - (Live.seenHere[id] || 0) > 5 * 60 * 1000) toast(`👋 ${member(id).name} is visiting your ${r ? r.name.toLowerCase() : 'house'}!`);
        Live.seenHere[id] = Date.now();
      }
    }
  }
  liveRefresh();
}

/* ---------- Show it ---------- */
// Other people standing in a room right now (not me), as { memberId: { x, y } }.
function liveInRoom(roomId) {
  const me = actor(), out = {};
  for (const [id, v] of Object.entries(Live.all)) if (id !== me && isMember(id) && liveFresh(v) && v.room === roomId) out[id] = v;
  return out;
}
function liveInHouse(mid) {
  const me = actor(), out = [];
  for (const [id, v] of Object.entries(Live.all)) if (id !== me && isMember(id) && liveFresh(v) && v.house === mid) out.push([id, v]);
  return out;
}
function liveWalk(el, tx, ty) {
  const fx = parseFloat(el.style.left), fy = parseFloat(el.style.top);
  if (Math.abs(fx - tx) < 0.5 && Math.abs(fy - ty) < 0.5) return;
  const secs = Math.min(2.2, Math.max(0.35, Math.hypot(tx - fx, (ty - fy) * 1.5) / 32));
  el.style.transition = `left ${secs}s linear, top ${secs}s linear`;
  el.classList.toggle('face-left', tx < fx);
  el.classList.add('walking');
  el.style.left = tx + '%'; el.style.top = ty + '%';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('walking'); el.style.zIndex = 2000 + Math.round(ty * 5); }, secs * 1000);
}
function liveRefresh() {
  const { name, param } = currentRoute();
  if (name === 'house' || name === 'town') {
    // Only redraw when someone arrives, leaves or changes rooms (not on every step).
    const sig = Object.entries(Live.all).filter(([, v]) => liveFresh(v)).map(([id, v]) => id + v.room).sort().join();
    if (sig !== Live.sig && !document.querySelector('#sheet:not([hidden])')) { Live.sig = sig; render(); }
    return;
  }
  if (name !== 'room' || ui.hEdit) return;
  const found = findRoom(param);
  if (!found) return;
  const roomEl = document.querySelector(`.room:not(.mini)[data-room="${param}"]`);
  if (!roomEl) return;
  const here = liveInRoom(param);
  let rebuild = false;
  for (const [id, v] of Object.entries(here)) {
    const el = roomEl.querySelector(`.hav[data-av="${id === found.mid ? 'own' : 'live-' + id}"]`);
    if (el) liveWalk(el, v.x, v.y); else rebuild = true;
  }
  for (const el of roomEl.querySelectorAll('.hav[data-av^="live-"]')) if (!here[el.dataset.av.slice(5)]) rebuild = true;
  if (rebuild && !document.querySelector('#sheet:not([hidden])')) render();
}

/* ---------- Hooks ---------- */
const _afterRenderLive = afterRender;
afterRender = function () {
  _afterRenderLive();
  const r = currentRoute().name;
  if (LIVE_ROUTES.includes(r)) { liveListen(); liveBeat(); } else { liveStop(); clearInterval(Live.beat); }
  livePush();
};
// Walking (a tap on the floor) — house.js has already moved you; send the new spot.
document.addEventListener('click', (e) => { if (e.target.closest('.room:not(.mini):not(.editing)')) livePush(); });
document.addEventListener('visibilitychange', () => liveSend(true));
window.addEventListener('pagehide', () => liveSend(true));

// House page: who's over right now
const _houseViewLive = views.house;
views.house = (pid) => {
  const html = _houseViewLive(pid);
  const me = actor(), mid = pid && isMember(pid) ? pid : me;
  const h = mid && houseOf(mid);
  const here = h ? liveInHouse(mid) : [];
  if (!here.length) return html;
  const chips = here.map(([id, v]) => {
    const r = h.rooms.find((x) => x.id === v.room);
    return `<button class="live-chip" data-action="go" data-to="room/${v.room}"><span class="live-dot"></span>${esc(member(id).name)}${r ? ` · ${esc(r.name)}` : ''}</button>`;
  }).join('');
  const block = `<div class="live-here"><span class="small muted">Here now</span>${chips}</div>`;
  const i = html.indexOf('<div class="house-stats2">');
  return i < 0 ? html + block : html.slice(0, i) + block + html.slice(i);
};
