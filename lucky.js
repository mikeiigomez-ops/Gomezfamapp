/* Coin Arcade: play-money games. Coins are pretend money earned and spent only here — they can't be bought
   and never turn into Gems or allowance. Squish Tycoon (tap + idle clicker), Coin Pusher, Squish Slots and
   Treasure Chests share one coin wallet per person. Loaded after party.js. */
'use strict';

/* ---------- Coins ---------- */
const COIN = '🪙', COIN_START = 200, COIN_DAILY = 100;
const coinsOf = (pid) => Math.floor(state.coins?.[pid] ?? COIN_START);
function addCoins(pid, n) { if (!pid) return; (state.coins ||= {})[pid] = Math.max(0, (state.coins[pid] ?? COIN_START) + n); coinSaveSoon(); }
function spendCoins(pid, n) { if (coinsOf(pid) < n) { toast(`Not enough coins ${COIN}`); return false; } addCoins(pid, -n); return true; }
let coinSaveT = 0;
function coinSaveSoon(now) { clearTimeout(coinSaveT); if (now) { save(); return; } coinSaveT = setTimeout(save, 4000); }
function fmtCoin(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString();
  const u = [[1e21, 'Sx'], [1e18, 'Qi'], [1e15, 'Qa'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([v]) => n >= v);
  return (n / u[0]).toFixed(n / u[0] < 100 ? 1 : 0).replace(/\.0$/, '') + u[1];
}
const fmtRate = (n) => (n < 10 ? (Math.round(n * 10) / 10).toString() : fmtCoin(n));
const coinDaily = (pid) => (state.coinDay || {})[pid] !== today();
const coinChip = (pid) => `<button class="coin-chip" data-action="go" data-to="${typeof LUCKY_HIDDEN !== 'undefined' && LUCKY_HIDDEN.has('lucky') ? 'tycoon' : 'lucky'}"><span>${COIN}</span><b data-coins="${pid}">${fmtCoin(coinsOf(pid) + (ui.ty?.pid === pid ? Math.floor(ui.ty.pend) : 0))}</b></button>`;

/* ---------- Hub ---------- */
const LUCKY_HIDDEN = new Set(['lucky', 'pusher', 'slots', 'chests']); // parked for now; their screens open Squish Tycoon
const LUCKY_GAMES = [
  ['tycoon', '🏭', 'Squish Tycoon', 'Tap, build, get rich', '#f59e0b', '#ef4444'],
  ['pusher', '🪙', 'Coin Pusher', 'Push coins over the edge', '#0ea5e9', '#6366f1'],
  ['slots', '🎰', 'Squish Slots', 'Spin for the jackpot', '#db2777', '#7c3aed'],
  ['chests', '🧰', 'Treasure Chests', 'What’s inside?', '#b45309', '#f59e0b'],
];
Object.assign(TITLES, { lucky: 'Coin Arcade', tycoon: 'Squish Tycoon', pusher: 'Coin Pusher', slots: 'Squish Slots', chests: 'Treasure Chests' });
views.lucky = () => {
  const me = actor();
  if (!me) return needMe();
  const rich = state.members.map((m) => [m, coinsOf(m.id)]).sort((a, b) => b[1] - a[1]);
  return `<div class="coin-hero"><div class="ch-left"><small>Your coins</small><b>${COIN} ${fmtCoin(coinsOf(me))}</b><span>Play money — just for fun</span></div>
      ${coinDaily(me) ? `<button class="btn coin-daily" data-action="coin-daily">🎁 Daily +${COIN_DAILY}</button>` : '<span class="coin-done">✓ Daily coins<br>collected</span>'}</div>
    <div class="game-grid play-grid">${luckyTiles(me).map((t) => `<button class="game-tile" data-action="go" data-to="${t.to}" style="--g1:${t.g1};--g2:${t.g2}"><span class="gt-e">${t.e}</span><b>${esc(t.label)}</b><small>${t.sub}</small></button>`).join('')}</div>
    <div class="section-title">💰 Family coin board</div><div class="card flush">${rich.map(([m, c], i) => `<div class="row"><div class="avatar">${esc(m.emoji)}</div><div class="grow"><div class="title">${esc(m.name)}</div></div><b>${['🥇', '🥈', '🥉'][i] || ''} ${COIN} ${fmtCoin(c)}</b></div>`).join('')}</div>
    <p class="small muted" style="text-align:center">Coins can’t be bought and never turn into Gems or allowance.</p>`;
};
function luckyTiles(me) {
  return LUCKY_GAMES.filter(([to]) => !LUCKY_HIDDEN.has(to)).map(([to, e, label, sub, g1, g2]) => ({ to, e, label, sub: to === 'tycoon' && me && tyCps(me) ? `${fmtRate(tyCps(me))} coins/sec` : sub, g1, g2 }));
}
for (const r of ['lucky', 'pusher', 'slots', 'chests']) { const v = views[r]; views[r] = (p) => (LUCKY_HIDDEN.has(r) ? views.tycoon(p) : v(p)); }

// Squish Tycoon lives in tycoon.js

/* =========================================================
   Coin Pusher
   ========================================================= */
const CP = { W: 100, H: 132, R: 5.6, MOUTH: [14, 86] };
const cpState = (pid) => ((state.pusher ||= {})[pid] ||= { c: cpFresh(), won: 0 });
function cpFresh() { const c = []; for (let i = 0; i < 46; i++) c.push([8 + Math.random() * 84, 50 + Math.random() * 74, Math.random() < 0.08 ? 1 : 0]); return c; }
let cpRAF = 0, cpLast = 0;
const CP_VAL = [1, 5, 25]; // coin, gold coin, prize squish
views.pusher = () => {
  const me = actor(); if (!me) return needMe();
  const S = cpState(me);
  return `<div class="ty-top">${coinChip(me)}<span class="ty-cps">Won so far: ${COIN} ${fmtCoin(S.won || 0)}</span></div>
    <div class="game-stage cp-stage"><canvas class="cp-canvas" width="400" height="528" data-noswipe></canvas></div>
    <p class="small muted" style="text-align:center;margin:6px 0 0">Tap the top of the tray to drop a coin (${COIN} 1). Coins pushed off the front are yours — side gutters keep them! ⭐ = 5 · 🧸 = 25</p>`;
};
function cpRun() {
  cancelAnimationFrame(cpRAF);
  const cv = document.querySelector('.cp-canvas'); if (!cv) return;
  if (ui.cp) cpSave(); // a redraw keeps the coins where they were
  const me = actor(), S = cpState(me), ctx = cv.getContext('2d'), sc = cv.width / CP.W;
  cpLast = performance.now();
  const coins = S.c.map(([x, y, t]) => ({ x, y, t }));
  ui.cp = { coins, me };
  cv.onpointerdown = (e) => {
    const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * CP.W, y = (e.clientY - b.top) / b.height * CP.H;
    if (y > 40) { toast('Tap near the top to drop'); return; }
    if (coins.length > 95 || !spendCoins(me, 1)) return;
    const r = Math.random(), t = r < 1 / 60 ? 2 : r < 1 / 12 ? 1 : 0;
    coins.push({ x: Math.max(CP.R, Math.min(CP.W - CP.R, x)), y: cpPush(performance.now()) + CP.R + 1, t, fresh: 1 });
    gBuzz();
  };
  const frame = (now) => {
    if (!cv.isConnected) { cpSave(); return; }
    const py = cpPush(now), R = CP.R, D = R * 2;
    for (const c of coins) if (c.y < py + R) c.y = py + R; // the pusher shoves the front row
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < coins.length; i++) for (let j = i + 1; j < coins.length; j++) {
        const a = coins[i], b = coins[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= D * D || d2 === 0) continue;
        const d = Math.sqrt(d2), o = (D - d) / 2, nx = dx / d, ny = dy / d;
        // push mostly away from the pusher, so the pile creeps forward
        const wa = a.y < b.y ? 0.25 : 0.75, wb = 1 - wa;
        a.x -= nx * o * 2 * wa; a.y -= ny * o * 2 * wa; b.x += nx * o * 2 * wb; b.y += ny * o * 2 * wb;
      }
      for (const c of coins) { c.x = Math.max(R, Math.min(CP.W - R, c.x)); if (c.y < py + R) c.y = py + R; }
    }
    // over the edge
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.y > CP.H + R * 0.2) {
        coins.splice(i, 1);
        if (c.x > CP.MOUTH[0] && c.x < CP.MOUTH[1]) { const v = CP_VAL[c.t]; addCoins(me, v); S.won = (S.won || 0) + v; cpFloat(c.x, v); document.querySelectorAll(`[data-coins="${me}"]`).forEach((el) => { el.textContent = fmtCoin(coinsOf(me)); }); }
      }
    }
    // draw
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, CP.H); g.addColorStop(0, '#1e3a8a'); g.addColorStop(1, '#3b82f6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CP.W, CP.H);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, CP.H - 3, CP.MOUTH[0], 3); ctx.fillRect(CP.MOUTH[1], CP.H - 3, CP.W - CP.MOUTH[1], 3);
    ctx.fillStyle = '#facc15'; ctx.fillRect(CP.MOUTH[0], CP.H - 2, CP.MOUTH[1] - CP.MOUTH[0], 2);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, CP.W, 40);
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 0, CP.W, py); ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, py - 2.5, CP.W, 2.5);
    for (const c of coins) {
      ctx.beginPath(); ctx.arc(c.x, c.y + .8, R, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7); ctx.fillStyle = c.t === 2 ? '#f472b6' : c.t === 1 ? '#fde047' : '#fbbf24'; ctx.fill();
      ctx.lineWidth = .8; ctx.strokeStyle = c.t === 2 ? '#be185d' : '#b45309'; ctx.stroke();
      if (c.t) { ctx.fillStyle = c.t === 2 ? '#fff' : '#b45309'; ctx.font = `${R * 1.1}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.t === 2 ? '🧸' : '★', c.x, c.y + .3); }
    }
    for (const f of ui.cpFloats || []) { const a = (now - f.t) / 900; if (a > 1) continue; ctx.globalAlpha = 1 - a; ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`+${f.v}`, f.x, CP.H - 8 - a * 14); ctx.globalAlpha = 1; }
    if (now - cpLast > 12000) { cpLast = now; cpSave(); }
    cpRAF = requestAnimationFrame(frame);
  };
  cpRAF = requestAnimationFrame(frame);
}
const cpPush = (now) => 18 + 12 * (0.5 + 0.5 * Math.sin(now / 900));
function cpFloat(x, v) { (ui.cpFloats ||= []).push({ x, v, t: performance.now() }); ui.cpFloats = ui.cpFloats.slice(-8); gBuzz(); }
function cpSave() { const P = ui.cp; if (!P) return; const S = cpState(P.me); S.c = P.coins.map((c) => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.t]); if (S.c.length < 20) S.c.push(...cpFresh().slice(0, 20)); coinSaveSoon(true); }

/* =========================================================
   Squish Slots
   ========================================================= */
// [symbol, weight, pays for three]; two matching on the first two reels pays 2×; three 🌈 wins the family jackpot
const SL = [['🍓', 8, 10], ['🍋', 7, 14], ['🔔', 6, 20], ['⭐', 5, 30], ['🧸', 4, 60], ['💎', 2, 200], ['🌈', 1, 0]];
const SL_BETS = [1, 5, 10, 25], JACK_MIN = 500;
const slPick = () => { let r = Math.random() * SL.reduce((a, s) => a + s[1], 0); for (const s of SL) { r -= s[1]; if (r < 0) return s[0]; } return SL[0][0]; };
const jackpot = () => Math.floor(state.jackpot ?? JACK_MIN);
function slPay(reels, bet) {
  const [a, b, c] = reels;
  if (a === b && b === c) { if (a === '🌈') return { jack: true, win: jackpot() }; return { win: bet * SL.find((s) => s[0] === a)[2], three: true }; }
  if (a === b) return { win: bet * 2 };
  return { win: 0 };
}
views.slots = () => {
  const me = actor(); if (!me) return needMe();
  const S = ui.sl ||= { bet: 5, reels: ['🍓', '⭐', '🧸'], spinning: false, last: null };
  const strip = (k) => `<div class="sl-reel${S.spinning && !(S.stopped || []).includes(k) ? ' spin' : ''}"><div class="sl-strip">${S.spinning && !(S.stopped || []).includes(k) ? SL.concat(SL).map((s) => `<span>${s[0]}</span>`).join('') : `<span>${S.reels[k]}</span>`}</div></div>`;
  const L = S.last;
  return `<div class="ty-top">${coinChip(me)}<span class="ty-cps">🌈 Jackpot ${COIN} ${fmtCoin(jackpot())}</span></div>
    <div class="sl-machine${L && L.win && !S.spinning ? (L.jack ? ' jack' : ' won') : ''}"><div class="sl-jack">🌈🌈🌈 JACKPOT ${COIN} ${fmtCoin(jackpot())}</div><div class="sl-reels">${[0, 1, 2].map(strip).join('')}</div>
      <div class="sl-msg">${S.spinning ? 'Good luck! 🍀' : L ? (L.jack ? `🌈 JACKPOT! +${fmtCoin(L.win)}` : L.win ? `${L.three ? '🎉 Three of a kind!' : '✨ A pair!'} +${fmtCoin(L.win)}` : 'So close! Spin again?') : 'Pick a bet and spin!'}</div></div>
    <div class="sl-bets">${SL_BETS.map((b) => `<button class="sl-bet${S.bet === b ? ' on' : ''}" data-action="sl-bet" data-b="${b}">${COIN} ${b}</button>`).join('')}</div>
    <button class="btn sl-spin" data-action="sl-spin" ${S.spinning ? 'disabled' : ''}>🎰 SPIN · ${COIN} ${S.bet}</button>
    <div class="sl-table">${SL.map(([s, , p]) => `<span>${s}${s}${s} <b>${p ? `×${p}` : 'JACKPOT'}</b></span>`).join('')}<span>Pair on reels 1–2 <b>×2</b></span></div>`;
};

/* =========================================================
   Treasure Chests
   ========================================================= */
const CHESTS = [
  ['wood', 'Wooden chest', 50, '#b45309', [[20, 90]], 0.1, 10, 0.03, { C: 100 }],
  ['silver', 'Silver chest', 200, '#94a3b8', [[80, 350]], 0.15, 30, 0.1, { R: 70, E: 25, L: 5 }],
  ['gold', 'Gold chest', 750, '#eab308', [[300, 1300]], 0.25, 60, 0.3, { E: 60, L: 30, M: 10 }],
]; // [id, name, price, colour, coin range, boost chance, boost minutes, squishy chance, rarity odds]
function chestOpen(me, id) {
  const [, name, price, , [[lo, hi]], bc, bm, sc, odds] = CHESTS.find((c) => c[0] === id);
  if (!spendCoins(me, price)) return null;
  const loot = [];
  const coins = Math.round(lo + Math.pow(Math.random(), 1.6) * (hi - lo)); // mostly lower, sometimes big
  addCoins(me, coins); loot.push({ k: 'coins', n: coins });
  if (Math.random() < bc) { const T = tyState(me); T.boost = Math.max(T.boost || 0, Date.now()) + bm * 60000; loot.push({ k: 'boost', n: bm }); }
  if (Math.random() < sc && typeof giveSquishy === 'function' && typeof boxPool === 'function') {
    let r = Math.random() * 100, tier = 'C'; for (const [t, p] of Object.entries(odds)) { r -= p; if (r < 0) { tier = t; break; } }
    const pool = boxPool({}).filter((s) => s.r === tier);
    if (pool.length) { const s = mpPick(pool), g = giveSquishy(me, s.id, 'chest'); loot.push({ k: 'squish', sid: s.id, isNew: g.isNew }); }
  }
  (state.chestLog ||= []).push({ who: me, id, at: Date.now(), coins });
  state.chestLog = state.chestLog.slice(-50);
  coinSaveSoon(true);
  return { name, loot };
}
views.chests = () => {
  const me = actor(); if (!me) return needMe();
  const R = ui.chest && ui.chest.me === me ? ui.chest : null;
  if (R && R.phase === 'open') {
    return `<div class="chest-open"><div class="chest-big shake" style="--c:${CHESTS.find((c) => c[0] === R.id)[3]}">🧰</div><p class="muted">Opening…</p></div>`;
  }
  if (R && R.phase === 'loot') {
    return `<div class="chest-loot"><div class="cl-title">${esc(R.res.name)}</div>${R.res.loot.map((l) => l.k === 'coins' ? `<div class="cl-item"><span>${COIN}</span><b>+${fmtCoin(l.n)} coins</b></div>`
      : l.k === 'boost' ? `<div class="cl-item"><span>🔥</span><b>2× Tycoon boost · ${l.n} min</b></div>`
      : `<div class="cl-item sq"><span class="cl-sq">${squishySVG(l.sid)}</span><b>${esc(SQ[l.sid].name)}${l.isNew ? ' · NEW!' : ''}</b><small>${RARITY[SQ[l.sid].r].name} squishy for your collection</small></div>`).join('')}
      <div class="btn-row"><button class="btn" data-action="chest-again">Open another</button><button class="btn secondary" data-action="go" data-to="squishies">My squishies</button></div></div>`;
  }
  return `<div class="ty-top">${coinChip(me)}</div>
    <div class="chest-list">${CHESTS.map(([id, name, price, c, [[lo, hi]], bc, bm, sc]) => `<button class="chest-card" data-action="chest-open" data-id="${id}" style="--c:${c}" ${coinsOf(me) < price ? 'data-cant="1"' : ''}><span class="chest-e">🧰</span><span class="chest-txt"><b>${name}</b><small>${COIN} ${lo}–${fmtCoin(hi)} · ${Math.round(bc * 100)}% Tycoon boost · ${Math.round(sc * 100)}% squishy</small></span><span class="chest-price">${COIN} ${fmtCoin(price)}</span></button>`).join('')}</div>
    <p class="small muted" style="text-align:center">Squishies from chests go straight into your collection.</p>`;
};

/* ---------- Actions + wiring ---------- */
Object.assign(actions, {
  'coin-daily': () => { const me = actor(); if (!me || !coinDaily(me)) return; (state.coinDay ||= {})[me] = today(); addCoins(me, COIN_DAILY); coinSaveSoon(true); confetti(); toast(`+${COIN_DAILY} coins! ${COIN}`); render(); },
  'sl-bet': (el) => { if (ui.sl.spinning) return; ui.sl.bet = Number(el.dataset.b); render(); },
  'sl-spin': () => {
    const me = actor(), S = ui.sl; if (!me || S.spinning) return;
    if (!spendCoins(me, S.bet)) return;
    state.jackpot = jackpot() + Math.max(1, Math.round(S.bet * 0.1));
    const out = [slPick(), slPick(), slPick()];
    Object.assign(S, { spinning: true, stopped: [], last: null }); render();
    [0, 1, 2].forEach((k) => setTimeout(() => {
      if (ui.sl !== S) return;
      S.reels[k] = out[k]; S.stopped.push(k); gBuzz();
      if (k < 2) { render(); return; }
      const res = slPay(out, S.bet);
      if (res.win) { addCoins(me, res.win); if (res.jack) { state.jackpot = JACK_MIN; logAct('🌈', `hit the Squish Slots jackpot: ${fmtCoin(res.win)} coins!`, 'games'); } }
      S.last = res; S.spinning = false; coinSaveSoon(true); render();
      if (res.three || res.jack) setTimeout(confetti, 100);
    }, 650 + k * 380));
  },
  'chest-open': (el) => {
    const me = actor(), id = el.dataset.id;
    if (coinsOf(me) < CHESTS.find((c) => c[0] === id)[2]) { toast(`Not enough coins ${COIN}`); return; }
    ui.chest = { me, id, phase: 'open' }; render();
    setTimeout(() => { const res = chestOpen(me, id); if (!res) { ui.chest = null; render(); return; } ui.chest = { me, id, phase: 'loot', res }; render(); if (res.loot.some((l) => l.k === 'squish')) setTimeout(confetti, 100); }, 1100);
  },
  'chest-again': () => { ui.chest = null; render(); },
});
for (const r of ['lucky', 'tycoon', 'pusher', 'slots', 'chests']) { KID_ROUTES.push(r); if (typeof HUB_OF !== 'undefined') HUB_OF[r] = 'play'; }
for (const a of ['coin-daily', 'sl-bet', 'sl-spin', 'chest-open', 'chest-again']) KID_ACTIONS.add(a);
if (typeof PG_SCROLL !== 'undefined') { PG_SCROLL.add('lucky'); PG_SCROLL.add('chests'); PG_SCROLL.add('slots'); }
if (typeof PG_SKIP !== 'undefined') PG_SKIP.add('pusher');
const _afterRenderLucky = afterRender;
afterRender = function () {
  _afterRenderLucky();
  const name = currentRoute().name;
  if (name === 'pusher') cpRun(); else if (ui.cp) { cpSave(); ui.cp = null; cancelAnimationFrame(cpRAF); }
  if (name !== 'chests' && ui.chest?.phase === 'loot') ui.chest = null;
};
const _modeLucky = modeClasses;
modeClasses = function () { _modeLucky(); if (currentRoute().name === 'pusher') document.body.classList.add('game-mode'); };
// Leaving the app: save the live counters
document.addEventListener('visibilitychange', () => { if (document.hidden && ui.cp) cpSave(); });
