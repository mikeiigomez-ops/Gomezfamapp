/* Squish Tycoon: a squishy factory idle/clicker game on the play-coin wallet (lucky.js).
   - 12 production lines, each a real squishy from the catalog (Commons up to a Mythic). Lines level up; every
     milestone level (10, 25, 50, 100…) doubles that line, and when every line passes 25/50/100 they all double.
   - Owning that squishy in your real collection gives its line +50%.
   - Upgrades shop, golden squishies that pop up to tap, tap combos, goals with rewards, earning while away,
     and Golden Squish restarts that make everything earn more forever.
   - Long game: Factory Rank (one per ×10 coins ever) pays Stars for the Star Lab (permanent upgrades, incl. an
     auto-buying manager), 4 more wings of 12 lines open at higher ranks, daily orders, rainbow squishies and
     goals that keep going in tiers. Loaded after lucky.js. */
'use strict';

const TY_COST0 = [15, 120, 1000, 8000, 65000, 550000, 4.5e6, 4e7, 3.5e8, 3e9, 2.6e10, 2.2e11];
const TY_RATE = [0.2, 1.2, 8, 50, 300, 2000, 13000, 90000, 6e5, 4e6, 2.8e7, 2e8];
const TY_GROW = 1.12;
const TY_MS = [10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000];
const TY_ALL = [25, 50, 100, 200, 300, 500];
const TY_TIERS = [['C', 4, 'Common corner'], ['R', 3, 'Rare row'], ['E', 2, 'Epic hall'], ['L', 2, 'Legendary tower'], ['M', 1, 'Mythic vault'], ['U', 0, 'Ultimate vault']];
// Factory wings: each opens at a Factory Rank (and stays open through Golden Squish restarts) with 12 new lines
const TY_WINGS = [
  { id: 'main', e: '🏭', name: 'Squish Factory', rank: 0 },
  { id: 'candy', e: '🍬', name: 'Candy Wing', rank: 20, cost: 1e21, pay: 2e8 },
  { id: 'ocean', e: '🌊', name: 'Ocean Wing', rank: 30, cost: 1e31, pay: 1e11 },
  { id: 'volcano', e: '🌋', name: 'Volcano Wing', rank: 41, cost: 1e42, pay: 5e13 },
  { id: 'space', e: '🚀', name: 'Space Station', rank: 53, cost: 1e54, pay: 2e16 },
];
function tyLines() {
  if (tyLines.c) return tyLines.c;
  const all = typeof SQUISHIES !== 'undefined' ? SQUISHIES.filter((s) => s.kind === 'squishy') : [];
  const reg = all.filter((s) => !s.season && s.r !== 'U');
  const out = [];
  for (const [r, n] of TY_TIERS) out.push(...reg.filter((s) => s.r === r).slice(0, n));
  const main = out.slice(0, 12).map((s, k) => ({ sid: s.id, name: s.name, r: s.r, k, w: 0, i: k, cost0: TY_COST0[k], rate: TY_RATE[k] }));
  // the wings draw from everything not used yet: regular squishies first, then seasonal, with an Ultimate or Mythic at the top
  const used = new Set(main.map((L) => L.sid));
  const pool = [...reg, ...all.filter((s) => s.season && s.r !== 'U'), ...all.filter((s) => s.r === 'U')].filter((s) => !used.has(s.id));
  const take = (pred) => { const i = pool.findIndex(pred); return i < 0 ? null : pool.splice(i, 1)[0]; };
  const lines = [...main];
  TY_WINGS.slice(1).forEach((W, wi) => {
    const picks = [];
    for (const [r, n] of [['C', 3], ['R', 3], ['E', 3], ['L', 2]]) for (let j = 0; j < n; j++) picks.push(take((s) => s.r === r) || take(() => true));
    picks.push(take((s) => s.r === (wi % 2 ? 'U' : 'M')) || take((s) => s.r === 'U' || s.r === 'M') || take(() => true));
    picks.filter(Boolean).forEach((s, i) => { const cost0 = W.cost * Math.pow(12, i); lines.push({ sid: s.id, name: s.name, r: s.r, k: lines.length, w: wi + 1, i, cost0, rate: cost0 / (W.pay * Math.pow(2, i)) }); });
  });
  return (tyLines.c = lines);
}
const tyWingLines = (w) => tyLines().filter((L) => L.w === w);
const TY_GOLD_EVERY = [70, 150]; // seconds between golden squishies (halved with Squish sense)

/* ---------- Factory Rank + Stars + Star Lab (all kept through Golden Squish restarts) ---------- */
// One rank for every ×10 coins earned ever: rank 1 at 1K, rank 10 at 1T…
const tyRankOf = (earned) => (earned < 1e3 ? 0 : Math.floor(Math.log10(earned) + 1e-9) - 2);
const tyRank = (T) => tyRankOf(T.earned || 0);
const tyRankAt = (n) => Math.pow(10, n + 2);
const TY_TITLES = ['Newbie', 'Intern', 'Helper', 'Stitcher', 'Packer', 'Line lead', 'Shift boss', 'Supervisor', 'Manager', 'Plant boss', 'Director', 'Big cheese', 'Squish VIP', 'Tycoon', 'Mega tycoon', 'Mogul', 'Super mogul', 'Legend', 'Icon', 'Squish royalty', 'Squish emperor', 'Cosmic tycoon'];
// Ranks 1–10 each get a title; after that every title has 4 steps (Tycoon I…IV), ending in Cosmic tycoon 1, 2, 3…
const tyTitle = (n) => { if (n <= 10) return TY_TITLES[n]; const i = 10 + Math.floor((n - 11) / 4); return i < TY_TITLES.length - 2 ? `${TY_TITLES[i + 1]} ${['I', 'II', 'III', 'IV'][(n - 11) % 4]}` : `Cosmic tycoon ${n - 10 - (TY_TITLES.length - 12) * 4}`; };
const tyStarsEarned = (T) => { const r = tyRank(T); return r + Math.floor(r / 5) * 2 + (T.starX || 0); }; // +1 a rank, +2 more every 5th rank, plus bonus stars
const tyStars = (T) => Math.max(0, tyStarsEarned(T) - (T.starUsed || 0));
const tyWingOpen = (T, w) => w === 0 || tyRank(T) >= TY_WINGS[w].rank;
const TY_LAB = [
  ['overtime', '🏭', 'Overtime', 'Every line +25% per level', 50, 1],
  ['grip', '🧤', 'Iron grip', 'Taps ×2 per level', 10, 1],
  ['manager', '🤖', 'Squish manager', 'Buys your best line for you while you play — faster each level', 3, 3],
  ['gtouch', '🌟', 'Golden touch', 'Each Golden Squish gives +2% more per level', 25, 2],
  ['luck', '🍀', 'Lucky streak', 'Golden squishies stay longer; rainbow ones show up more', 3, 2],
  ['shift', '⏰', 'Long shifts', 'Earn 8 more hours while you’re away', 3, 2],
  ['bulk', '📦', 'Bulk deals', 'Lines cost 10% less per level', 5, 3],
  ['head', '🚀', 'Head start', 'Start every Golden restart with ×1000 more coins per level', 3, 2],
];
const tyLab = (T, id) => (T.lab || {})[id] || 0;
const tyLabCost = (base, lv) => base * (lv + 1);
const TY_MGR = [0, 20000, 8000, 3000]; // ms between manager buys
const tyBulk = (T) => Math.pow(0.9, tyLab(T, 'bulk'));

/* ---------- State ---------- */
function tyState(pid) {
  const T = ((state.tycoon ||= {})[pid] ||= { lv: {}, up: {}, goals: {}, glove: 0, earned: 0, run: 0, pres: 0, taps: 0, goldN: 0, at: Date.now() });
  T.lv ||= {}; T.up ||= {}; T.goals ||= {}; T.lab ||= {};
  if (T.b) { // the first version had buildings: carry them over as line levels
    const old = ['helper', 'stitch', 'press', 'truck', 'castle', 'moon', 'portal'];
    tyLines().forEach((L, k) => { if (old[k] && T.b[old[k]]) T.lv[L.sid] = (T.lv[L.sid] || 0) + T.b[old[k]]; });
    delete T.b;
  }
  return T;
}
const tyLv = (T, L) => T.lv[L.sid] || 0;
const tyMsCount = (lv) => TY_MS.filter((m) => lv >= m).length;
const tyNextMs = (lv) => TY_MS.find((m) => lv < m) || null;
const tyOwned = (pid, L) => typeof ownsSid === 'function' && ownsSid(pid, L.sid);
const tyFrenzy = () => (ui.tyFrz && ui.tyFrz.until > Date.now() ? ui.tyFrz : null);
function tyGlobal(pid) {
  const T = tyState(pid), lines = tyLines();
  let m = (1 + (0.1 + 0.02 * tyLab(T, 'gtouch')) * (T.pres || 0)) * ((T.boost || 0) > Date.now() ? 2 : 1) * (1 + 0.25 * tyLab(T, 'overtime'));
  // every line in a wing past 25 / 50 / 100… doubles everything
  for (let w = 0; w < TY_WINGS.length; w++) { if (!tyWingOpen(T, w)) continue; const WL = lines.filter((L) => L.w === w); for (const t of TY_ALL) if (WL.every((L) => tyLv(T, L) >= t)) m *= 2; }
  const F = tyFrenzy(); if (F && F.k === 'prod') m *= F.m;
  return m;
}
function tyLineRate(pid, L, lvOverride) {
  const T = tyState(pid), lv = lvOverride ?? tyLv(T, L);
  if (!lv) return 0;
  return lv * L.rate * Math.pow(2, tyMsCount(lv)) * (tyOwned(pid, L) ? 1.5 : 1) * (T.up['s1' + L.sid] ? 3 : 1) * (T.up['s2' + L.sid] ? 3 : 1);
}
const tyCps = (pid) => tyLines().reduce((a, L) => a + tyLineRate(pid, L), 0) * tyGlobal(pid);
const tyTapBase = (pid) => { const T = tyState(pid); return Math.pow(2, (T.glove || 0) + tyLab(T, 'grip')) * (1 + 0.1 * (T.pres || 0)) + tyCps(pid) * (0.02 + 0.02 * ((T.up.tap1 ? 1 : 0) + (T.up.tap2 ? 1 : 0))); };
const tyCombo = () => { const C = ui.tyCb; return C && Date.now() - C.at < 700 ? 1 + Math.min(C.n, 40) * 0.05 : 1; };
const tyTap = (pid) => tyTapBase(pid) * tyCombo() * (tyFrenzy()?.k === 'tap' ? 10 : 1);
const tyCostN = (L, lv, n, f = 1) => f * L.cost0 * Math.pow(TY_GROW, lv) * (Math.pow(TY_GROW, n) - 1) / (TY_GROW - 1);
const tyMaxN = (L, lv, money, f = 1) => Math.max(0, Math.floor(Math.log((money / f) * (TY_GROW - 1) / (L.cost0 * Math.pow(TY_GROW, lv)) + 1) / Math.log(TY_GROW)));
const tyGloveCost = (n) => Math.ceil(100 * Math.pow(6, n));
// Golden Squish: cube root of coins ever earned — and past 100K Golden it grows much slower, so restarts stay meaningful without running away
const tyGoldenOf = (earned) => { const e = (earned || 0) / 1e5; return Math.floor(e <= 1e15 ? Math.cbrt(e) : 1e5 * Math.pow(e / 1e15, 1 / 9)); };
const tyGolden = (pid) => tyGoldenOf(tyState(pid).earned);
const tyGoldenAt = (g) => (g <= 1e5 ? Math.pow(g, 3) * 1e5 : 1e20 * Math.pow(g / 1e5, 9)); // coins ever needed for g Golden
const tyOfflineH = (pid) => { const T = tyState(pid); return (T.up.night2 ? 24 : T.up.night1 ? 16 : 8) + 8 * tyLab(T, 'shift'); };
const tyUnlocked = (T, L) => tyLv(T, L) > 0 || (tyWingOpen(T, L.w) && (L.i === 0 || tyLv(T, tyLines()[L.k - 1]) > 0));

/* ---------- Upgrades ---------- */
function tyUpgrades(pid) {
  const T = tyState(pid), list = [];
  for (const L of tyLines()) {
    if (!tyUnlocked(T, L)) continue;
    list.push({ id: 's1' + L.sid, sid: L.sid, name: `Extra stuffing: ${L.name}`, desc: `${L.name} line makes ×3`, cost: L.cost0 * 150, need: tyLv(T, L) >= 10, needTxt: `${L.name} level 10` });
    list.push({ id: 's2' + L.sid, sid: L.sid, name: `Golden stitching: ${L.name}`, desc: `${L.name} line makes ×3 more`, cost: L.cost0 * 2e5, need: tyLv(T, L) >= 75, needTxt: `${L.name} level 75` });
  }
  list.push({ id: 'tap1', e: '👆', name: 'Power tap', desc: 'Each tap also adds 2% of your /sec', cost: 5000, need: true });
  list.push({ id: 'tap2', e: '👆', name: 'Mega tap', desc: 'Each tap adds another 2% of your /sec', cost: 5e6, need: !!T.up.tap1, needTxt: 'Power tap' });
  list.push({ id: 'sense', e: '✨', name: 'Squish sense', desc: 'Golden squishies show up twice as often', cost: 25000, need: true });
  list.push({ id: 'charm', e: '🍀', name: 'Lucky charm', desc: 'Golden squishy prizes ×2', cost: 2.5e6, need: !!T.up.sense, needTxt: 'Squish sense' });
  list.push({ id: 'night1', e: '🌙', name: 'Night shift', desc: 'Earn up to 16 hours while you’re away', cost: 1e5, need: true });
  list.push({ id: 'night2', e: '🌙', name: 'All-day crew', desc: 'Earn up to 24 hours while you’re away', cost: 5e7, need: !!T.up.night1, needTxt: 'Night shift' });
  return list.filter((u) => !T.up[u.id]).sort((a, b) => a.cost - b.cost);
}

/* ---------- Goals ---------- */
const TY_GOALS = [
  ['tap100', 'Tap 100 times', (T) => [T.taps || 0, 100], 'coins', 300], ['tap1k', 'Tap 1,000 times', (T) => [T.taps || 0, 1000], 'boost', 15], ['tap10k', 'Tap 10,000 times', (T) => [T.taps || 0, 10000], 'boost', 60],
  ['e1k', 'Earn 1,000 coins', (T) => [T.earned || 0, 1e3], 'coins', 200], ['e100k', 'Earn 100K coins', (T) => [T.earned || 0, 1e5], 'coins', 5000], ['e10m', 'Earn 10M coins', (T) => [T.earned || 0, 1e7], 'boost', 30], ['e1b', 'Earn 1B coins', (T) => [T.earned || 0, 1e9], 'boost', 60], ['e1t', 'Earn 1T coins', (T) => [T.earned || 0, 1e12], 'boost', 120],
  ['l3', 'Open 3 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 3], 'coins', 1000], ['l6', 'Open 6 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 6], 'boost', 15], ['l9', 'Open 9 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 9], 'boost', 30], ['l12', 'Open all 12 factory lines', (T) => [tyWingLines(0).filter((L) => tyLv(T, L)).length, 12], 'boost', 60],
  ['lv25', 'Get any line to level 25', (T) => [Math.max(0, ...tyLines().map((L) => tyLv(T, L))), 25], 'coins', 2000], ['lv100', 'Get any line to level 100', (T) => [Math.max(0, ...tyLines().map((L) => tyLv(T, L))), 100], 'boost', 30], ['all25', 'Every factory line to level 25', (T) => [Math.min(...tyWingLines(0).map((L) => tyLv(T, L))), 25], 'boost', 60],
  ['g1', 'Catch a golden squishy', (T) => [T.goldN || 0, 1], 'coins', 500], ['g10', 'Catch 10 golden squishies', (T) => [T.goldN || 0, 10], 'boost', 20], ['g50', 'Catch 50 golden squishies', (T) => [T.goldN || 0, 50], 'boost', 60],
  ['col1', 'Own a squishy that has a line here', (T, pid) => [tyLines().filter((L) => tyOwned(pid, L)).length, 1], 'coins', 1500], ['col4', 'Own 4 of the line squishies', (T, pid) => [tyLines().filter((L) => tyOwned(pid, L)).length, 4], 'boost', 30],
  ['up5', 'Buy 5 upgrades', (T) => [Object.keys(T.up).length, 5], 'coins', 8000], ['p1', 'Earn your first Golden Squish', (T) => [T.pres || 0, 1], 'boost', 60],
];
// Endless goals: after the first set, every kind keeps going in tiers that pay Stars
function tyGoalList() {
  if (tyGoalList.c) return tyGoalList.c;
  const G = TY_GOALS.slice(), cnt = (n) => fmtCoin(n);
  for (let i = 0; i < 10; i++) { const v = 25000 * Math.pow(4, i); G.push([`tapx${i}`, `Tap ${cnt(v)} times`, (T) => [T.taps || 0, v], 'star', 1]); }
  for (let i = 0; i < 18; i++) { const v = Math.pow(10, 15 + 3 * i); G.push([`ex${i}`, `Earn ${cnt(v)} coins`, (T) => [T.earned || 0, v], 'star', 1 + Math.floor(i / 4)]); }
  [100, 250, 500, 1000, 2000, 4000].forEach((v, i) => G.push([`gx${i}`, `Catch ${cnt(v)} golden squishies`, (T) => [T.goldN || 0, v], 'star', 1]));
  [3, 10, 25, 60, 150, 400, 1000].forEach((v, i) => G.push([`px${i}`, `Have ${cnt(v)} Golden Squish`, (T) => [T.pres || 0, v], 'star', 2]));
  [1, 5, 20, 50].forEach((v, i) => G.push([`rb${i}`, `Catch ${v} rainbow squish${v > 1 ? 'ies' : 'y'}`, (T) => [T.rainN || 0, v], 'star', 1]));
  [1, 7, 30, 100].forEach((v, i) => G.push([`dd${i}`, `Finish all 3 daily orders ${v === 1 ? 'once' : `${v} times`}`, (T) => [T.dailyN || 0, v], 'star', 2]));
  [5, 15, 30, 50].forEach((v, i) => G.push([`lab${i}`, `Buy ${v} Star Lab levels`, (T) => [Object.values(T.lab || {}).reduce((a, b) => a + b, 0), v], 'boost', 60]));
  TY_WINGS.slice(1).forEach((W, i) => {
    const w = i + 1;
    G.push([`w${w}`, `Open the ${W.name} (Factory Rank ${W.rank})`, (T) => [tyRank(T), W.rank], 'boost', 120]);
    for (const t of [25, 100, 300]) G.push([`w${w}a${t}`, `Every ${W.name} line to level ${t}`, (T) => [Math.min(...tyWingLines(w).map((L) => tyLv(T, L))), t], 'star', t >= 100 ? 2 : 1]);
  });
  for (const t of [100, 300, 500]) G.push([`all${t}`, `Every factory line to level ${t}`, (T) => [Math.min(...tyWingLines(0).map((L) => tyLv(T, L))), t], 'star', 1]);
  for (const t of [500, 1000, 2000, 3000]) G.push([`top${t}`, `Get any line to level ${t}`, (T) => [Math.max(0, ...tyLines().map((L) => tyLv(T, L))), t], 'star', 1]);
  return (tyGoalList.c = G);
}
const tyGoalReward = (pid, kind, n) => (kind === 'boost' ? `🔥 2× for ${n} min` : kind === 'star' ? `⭐ ${n} Star${n > 1 ? 's' : ''}` : `${COIN} ${fmtCoin(Math.max(n, tyCps(pid) * 60))}`);

/* ---------- Daily orders: 3 small jobs a day for Stars ---------- */
const tySeed = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296); };
function tyDaily(pid) {
  const T = tyState(pid), d = today();
  if (T.daily && T.daily.day === d) return T.daily;
  const r = tySeed(pid + d), open = tyLines().filter((L) => tyLv(T, L));
  const L = open.length ? open[Math.floor(r() * open.length)] : tyLines()[0];
  const kinds = ['lv', 'tap', 'gold', 'earn', 'ups'].sort(() => r() - 0.5).slice(0, 3);
  const make = (k) => k === 'lv' ? { k, sid: L.sid, need: 10 + 5 * Math.floor(r() * 3), base: tyLv(T, L) }
    : k === 'tap' ? { k, need: 200 + 100 * Math.floor(r() * 4), base: T.taps || 0 }
    : k === 'gold' ? { k, need: 2 + Math.floor(r() * 2), base: T.goldN || 0 }
    : k === 'earn' ? { k, need: Math.max(5000, Math.round(tyCps(pid) * 1800)), base: T.earned || 0 }
    : { k, need: 2, base: T.upN || 0 };
  T.daily = { day: d, list: kinds.map(make), got: {} };
  return T.daily;
}
function tyOrder(T, o) {
  const L = o.sid && tyLines().find((x) => x.sid === o.sid);
  const c = o.k === 'lv' ? tyLv(T, L) - o.base : o.k === 'tap' ? (T.taps || 0) - o.base : o.k === 'gold' ? (T.goldN || 0) - o.base : o.k === 'earn' ? (T.earned || 0) - o.base : (T.upN || 0) - o.base;
  const text = o.k === 'lv' ? `Level up ${L?.name || 'a line'} ${o.need} times` : o.k === 'tap' ? `Tap ${o.need} times` : o.k === 'gold' ? `Catch ${o.need} golden squishies` : o.k === 'earn' ? `Earn ${fmtCoin(o.need)} coins` : `Buy ${o.need} upgrades`;
  return { text, c: Math.max(0, Math.min(c, o.need)), g: o.need, ready: c >= o.need };
}

/* ---------- Live counter (kept in memory; coins written to the family file every few seconds) ---------- */
function tyStart(pid) {
  if (ui.ty && ui.ty.pid === pid) return;
  tyFlush();
  const T = tyState(pid), away = Math.min(tyOfflineH(pid) * 3600, Math.max(0, (Date.now() - (T.at || Date.now())) / 1000));
  const off = Math.floor(tyCps(pid) * away);
  ui.ty = { pid, pend: 0, last: Date.now() };
  ui.tyNextGold = Date.now() + 20000;
  if (off > 0) { addCoins(pid, off); T.earned = (T.earned || 0) + off; T.run = (T.run || 0) + off; ui.tyAway = { pid, n: off, t: Date.now(), h: Math.round(away / 360) / 10 }; }
  T.at = Date.now();
}
function tyFlush(force) {
  const Y = ui.ty; if (!Y) return;
  const n = Math.floor(Y.pend), T = tyState(Y.pid);
  if (n > 0) { Y.pend -= n; addCoins(Y.pid, n); T.earned = (T.earned || 0) + n; T.run = (T.run || 0) + n; }
  T.at = Date.now();
  tyRankCheck(T);
  if (force) coinSaveSoon(true);
}
// Rank ups: a Star each (+2 more every 5th), and new wings open
function tyRankCheck(T) {
  const r = tyRank(T), was = T.rankSeen ?? null;
  if (was === null) { T.rankSeen = r; if (r >= 3) setTimeout(() => toast(`🏅 You’re Factory Rank ${r}! ⭐ ${tyStars(T)} Stars to spend in the Star Lab`), 600); return; }
  if (r <= was) return;
  T.rankSeen = r;
  const wing = TY_WINGS.find((W) => W.rank > was && W.rank <= r);
  if (wing && typeof celebrate === 'function') celebrate(`${wing.e} ${wing.name} is open!`, '12 new squishy lines to build');
  else toast(`🏅 Rank up! ${tyTitle(r)} · +${r % 5 ? 1 : 3} ⭐`);
}
const tyMoney = (pid) => coinsOf(pid) + (ui.ty?.pid === pid ? Math.floor(ui.ty.pend) : 0);
let tyTick = 0;
function tyLoop() {
  clearInterval(tyTick);
  tyTick = setInterval(() => {
    const Y = ui.ty; if (!Y || currentRoute().name !== 'tycoon') { clearInterval(tyTick); return; }
    const now = Date.now(); Y.pend += tyCps(Y.pid) * (now - Y.last) / 1000; Y.last = now;
    if (Y.pend >= 1 && now - (Y.flushAt || now) > 10000) { Y.flushAt = now; tyFlush(); }
    Y.flushAt ||= now;
    const money = tyMoney(Y.pid);
    document.querySelectorAll(`[data-coins="${Y.pid}"]`).forEach((el) => { el.textContent = fmtCoin(money); });
    document.querySelectorAll('[data-cost]').forEach((el) => { el.classList.toggle('cant', money < Number(el.dataset.cost)); });
    const cb = document.querySelector('.ty-combo'); if (cb) { const c = tyCombo(); cb.textContent = c > 1.05 ? `Combo ×${c.toFixed(1)}` : ''; cb.classList.toggle('on', c > 1.05); }
    const fz = document.querySelector('.ty-frz'); if (fz) { const F = tyFrenzy(); fz.textContent = F ? (F.k === 'tap' ? `👆 Tap frenzy ×10 · ${Math.ceil((F.until - now) / 1000)}s` : `🔥 Frenzy ×${F.m} · ${Math.ceil((F.until - now) / 1000)}s`) : ''; fz.classList.toggle('on', !!F); }
    // golden squishy
    if (!ui.tyGold && now > (ui.tyNextGold || 0)) tyGoldSpawn(Y.pid);
    tyManager(Y, now);
    if (ui.tyGold && now > ui.tyGold.until) { document.querySelector('.ty-goldsq')?.remove(); ui.tyGold = null; tyGoldNext(Y.pid); }
  }, 200);
}
function tyGoldNext(pid) { const T = tyState(pid), [a, b] = TY_GOLD_EVERY, k = T.up.sense ? 0.5 : 1; ui.tyNextGold = Date.now() + (a + Math.random() * (b - a)) * 1000 * k; }
function tyGoldSpawn(pid) {
  const T = tyState(pid), open = tyLines().filter((x) => tyLv(T, x)), L = open[Math.floor(Math.random() * open.length)] || tyLines()[0];
  const rainbow = Math.random() < 0.06 + 0.04 * tyLab(T, 'luck');
  const el = document.createElement('button');
  el.className = 'ty-goldsq' + (rainbow ? ' rainbow' : ''); el.dataset.action = 'ty-gold'; el.setAttribute('aria-label', rainbow ? 'Rainbow squishy!' : 'Golden squishy!');
  el.style.left = (10 + Math.random() * 70) + 'vw'; el.style.top = (22 + Math.random() * 55) + 'vh';
  el.innerHTML = typeof squishySVG === 'function' && L ? squishySVG(L.sid, { shiny: true }) : '🌟';
  document.body.appendChild(el);
  ui.tyGold = { until: Date.now() + 10000 + 4000 * tyLab(T, 'luck'), rainbow };
}
// The single level that adds the most per coin — what the Squish manager buys
function tyBest(pid) {
  const T = tyState(pid), f = tyBulk(T);
  let best = null;
  for (const L of tyLines()) {
    if (!tyUnlocked(T, L)) continue;
    const lv = tyLv(T, L), cost = tyCostN(L, lv, 1, f), gain = tyLineRate(pid, L, lv + 1) - tyLineRate(pid, L, lv);
    const v = gain / cost;
    if (!best || v > best.v) best = { L, lv, cost, v };
  }
  return best;
}
function tyManager(Y, now) {
  const T = tyState(Y.pid), gap = TY_MGR[tyLab(T, 'manager')];
  if (!gap || now - (Y.mgrAt || 0) < gap || now - (ui.tyCb?.at || 0) < 1500) return;
  Y.mgrAt = now;
  const B = tyBest(Y.pid); if (!B || tyMoney(Y.pid) < B.cost) return;
  tyFlush(); if (coinsOf(Y.pid) < B.cost) return;
  addCoins(Y.pid, -Math.ceil(B.cost)); T.lv[B.L.sid] = B.lv + 1; T.mgrN = (T.mgrN || 0) + 1;
  if (tyMsCount(B.lv + 1) > tyMsCount(B.lv)) toast(`🤖 ${B.L.name} hit level ${B.lv + 1} — ×2!`);
  render();
}

/* ---------- Factory floor: the line squishies walk the belt carrying coins ---------- */
function tyFloor(me) {
  const T = tyState(me), open = tyLines().filter((L) => tyLv(T, L));
  if (!open.length) return `<div class="ty-floor empty"><span>Buy your first line and your squishies get to work! 🏭</span></div>`;
  const walkers = [];
  for (const L of open) { const n = Math.min(3, 1 + Math.floor(Math.log10(tyLv(T, L)))); for (let i = 0; i < n; i++) walkers.push(L); }
  const list = walkers.slice(-14), fast = !!tyFrenzy();
  return `<div class="ty-floor${fast ? ' fast' : ''}" aria-hidden="true"><div class="ty-belt"></div>${list.map((L, i) => {
    const dur = 9 + ((i * 7) % 6) + L.k * 0.4, delay = -((i * 2.3) % dur);
    return `<span class="ty-walker" style="--d:${dur}s;--dl:${delay.toFixed(1)}s;--s:${0.75 + (L.k / 11) * 0.35}">${typeof squishySVG === 'function' ? squishySVG(L.sid) : '🧸'}<i>${COIN}</i></span>`;
  }).join('')}<div class="ty-machine">🏭</div></div>`;
}
// The open line with the lowest level, and how far your coins take it toward its next milestone
function tySlowest(me) {
  const T = tyState(me), f = tyBulk(T), open = tyWingLines(tyWingView(me)).filter((L) => tyUnlocked(T, L));
  if (!open.length) return null;
  const L = open.reduce((a, b) => (tyLv(T, b) < tyLv(T, a) ? b : a), open[0]), lv = tyLv(T, L), target = tyNextMs(lv) || lv + 10;
  const n = Math.min(target - lv, tyMaxN(L, lv, tyMoney(me), f));
  return { L, lv, target, n, cost: tyCostN(L, lv, Math.max(1, n), f) };
}

/* ---------- Screen ---------- */
Object.assign(TITLES, { tycoon: 'Squish Tycoon' });
// Which wing the Lines tab shows: your pick, else the newest wing you've started
const tyWingView = (me) => { const T = tyState(me); const w = ui.tyWing; if (w != null && tyWingOpen(T, w)) return w; let best = 0; TY_WINGS.forEach((W, i) => { if (tyWingOpen(T, i) && tyWingLines(i).some((L) => tyLv(T, L))) best = i; }); return best; };
views.tycoon = () => {
  const me = actor(); if (!me) return needMe();
  tyStart(me);
  const T = tyState(me), cps = tyCps(me), money = tyMoney(me), tab = ui.tyTab || 'lines';
  const away = ui.tyAway && ui.tyAway.pid === me && Date.now() - ui.tyAway.t < 8000 ? ui.tyAway : null;
  const boost = (T.boost || 0) > Date.now() ? Math.ceil((T.boost - Date.now()) / 60000) : 0;
  const goalsReady = tyGoalList().filter(([id, , f]) => !T.goals[id] && (() => { const [c, g] = f(T, me); return c >= g; })()).length;
  const cap = (n) => (n > 9 ? '9+' : n);
  const D = tyDaily(me), ordersReady = D.list.filter((o, i) => !D.got[i] && tyOrder(T, o).ready).length + (D.list.every((o, i) => D.got[i]) && !D.got.all ? 1 : 0);
  const ups = tyUpgrades(me).filter((u) => u.need && u.cost <= money).length;
  const stars = tyStars(T), labReady = TY_LAB.some(([id, , , , max, base]) => tyLab(T, id) < max && stars >= tyLabCost(base, tyLab(T, id)));
  const hero = tyLines().filter((L) => tyLv(T, L)).at(-1) || tyLines()[0];
  const rank = tyRank(T), pct = rank ? Math.min(100, Math.round((Math.log10(Math.max(1, T.earned || 0)) - (rank + 2)) * 100)) : Math.round(((T.earned || 0) / 1e3) * 100);
  return `<div class="ty-top">${coinChip(me)}<span class="ty-cps">⚡ ${fmtRate(cps)}/sec${T.pres ? `<br>🌟 ${T.pres} Golden (+${Math.round(T.pres * (10 + 2 * tyLab(T, 'gtouch')))}%)` : ''}${boost ? `<br>🔥 2× · ${boost}m` : ''}</span></div>
    <button class="ty-rank" data-action="ty-tab" data-k="lab"><span class="ty-rk">🏅 ${rank}</span><span class="grow"><b>${esc(tyTitle(rank))}</b><span class="ty-ms"><i style="width:${pct}%"></i><em>Rank ${rank + 1} at ${fmtCoin(tyRankAt(rank + 1))} earned</em></span></span><span class="ty-stars">⭐ ${stars}</span></button>
    ${coinDaily(me) ? `<button class="ty-daily" data-action="coin-daily">🎁 Collect your daily ${COIN} ${COIN_DAILY}</button>` : ''}
    ${away ? `<div class="ty-away">💤 You were away ${away.h}h — your factory made <b>${COIN} ${fmtCoin(away.n)}</b>!</div>` : ''}
    <div class="ty-tapzone"><div class="ty-frz"></div><button class="ty-tap" data-action="ty-tap" aria-label="Squish!">${hero && typeof squishySVG === 'function' ? squishySVG(hero.sid) : '🧸'}</button><div class="ty-floats"></div><div class="ty-combo"></div><small>Tap fast for a combo! +${fmtRate(tyTapBase(me))} a tap${tyLab(T, 'manager') ? ' · 🤖 manager on' : ''}</small></div>
    ${tyFloor(me)}
    <div class="segmented ty-tabs">${[['lines', '🏭 Lines'], ['ups', `⬆️ Ups${ups ? ` <i>${cap(ups)}</i>` : ''}`], ['goals', `🎯 Goals${goalsReady + ordersReady ? ` <i>${cap(goalsReady + ordersReady)}</i>` : ''}`], ['lab', `🧪 Lab${labReady ? ' <i>⭐</i>' : ''}`], ['gold', '🌟 Gold']].map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="ty-tab" data-k="${k}">${l}</button>`).join('')}</div>
    ${tab === 'lines' ? tyLinesView(me) : tab === 'ups' ? tyUpsView(me) : tab === 'goals' ? tyGoalsView(me) : tab === 'lab' ? tyLabView(me) : tyGoldView(me)}`;
};
function tyWingBar(me) {
  const T = tyState(me), cur = tyWingView(me), next = TY_WINGS.findIndex((W, i) => !tyWingOpen(T, i));
  const shown = TY_WINGS.map((W, i) => [W, i]).filter(([, i]) => tyWingOpen(T, i) || i === next);
  if (shown.length < 2) return '';
  return `<div class="ty-wings" data-noswipe>${shown.map(([W, i]) => tyWingOpen(T, i)
    ? `<button class="${i === cur ? 'on' : ''}" data-action="ty-wing" data-w="${i}"><span>${W.e}</span>${esc(W.name)}</button>`
    : `<button class="locked" data-action="ty-wing" data-w="${i}"><span>🔒</span>${esc(W.name)}<small>Rank ${W.rank}</small></button>`).join('')}</div>`;
}
function tyLinesView(me) {
  const T = tyState(me), amt = ui.tyAmt || 1, money = tyMoney(me), w = tyWingView(me), lines = tyWingLines(w), g = tyGlobal(me), f = tyBulk(T), W = TY_WINGS[w];
  const nextAll = TY_ALL.find((t) => !lines.every((L) => tyLv(T, L) >= t));
  const nw = TY_WINGS.findIndex((x, i) => !tyWingOpen(T, i)), NW = TY_WINGS[nw];
  let lastTier = '';
  const rows = lines.map((L) => {
    const lv = tyLv(T, L), open = tyUnlocked(T, L);
    const head = L.r !== lastTier ? `<div class="ty-tier">${TY_TIERS.find((t) => t[0] === L.r)[2]}</div>` : ''; lastTier = L.r;
    if (!open) return `${head}<div class="ty-line locked"><span class="ty-sq">❔</span><div class="grow"><b>???</b><small>Buy a ${esc(tyLines()[L.k - 1].name)} level to unlock</small></div></div>`;
    const n = amt === 'max' ? Math.max(1, tyMaxN(L, lv, money, f)) : amt, cost = tyCostN(L, lv, n, f), next = tyNextMs(lv), prev = TY_MS[TY_MS.indexOf(next) - 1] || 0;
    const rate = tyLineRate(me, L) * g, gain = (tyLineRate(me, L, lv + n) - tyLineRate(me, L)) * g;
    return `${head}<div class="ty-line rar-b-${L.r}">
      <span class="ty-sq">${typeof squishySVG === 'function' ? squishySVG(L.sid) : '🧸'}<i>Lv ${lv}</i></span>
      <div class="grow"><b>${esc(L.name)} ${typeof rarityPill === 'function' ? rarityPill(L.r) : ''}</b>
        <small>${lv ? `${fmtRate(rate)}/sec` : 'Not started'}${tyOwned(me, L) ? ' · 📚 +50% (in your collection)' : ''}${T.up['s1' + L.sid] ? ' · 🧵×3' : ''}${T.up['s2' + L.sid] ? ' · ✨×3' : ''}</small>
        ${next ? `<span class="ty-ms"><i style="width:${Math.round(((lv - prev) / (next - prev)) * 100)}%"></i><em>Lv ${next} → ×2</em></span>` : '<span class="ty-ms max"><em>All milestones! 👑</em></span>'}</div>
      <button class="ty-buybtn${money < cost ? ' cant' : ''}" data-action="ty-buy" data-sid="${L.sid}" data-cost="${Math.ceil(cost)}"><b>+${n}</b><small>${COIN} ${fmtCoin(cost)}</small><small class="ty-gain">+${fmtRate(gain)}/s</small></button>
    </div>`;
  }).join('');
  const slow = tySlowest(me);
  return `${slow ? `<button class="ty-slow${slow.n ? '' : ' cant'}" data-action="ty-slow" data-cost="${Math.ceil(slow.cost)}"><span>🐢</span><span class="grow"><b>Boost the slowest line</b><small>${esc(slow.L.name)} Lv ${slow.lv} → ${slow.lv + Math.max(1, slow.n)}${slow.lv + slow.n >= slow.target ? ` · hits ×2 at ${slow.target}!` : ''}</small></span><em>${COIN} ${fmtCoin(slow.cost)}</em></button>` : ''}
    <div class="ty-amt">Buy ${[1, 10, 25, 'max'].map((a) => `<button class="${amt === a ? 'on' : ''}" data-action="ty-amt" data-a="${a}">${a === 'max' ? 'Max' : '×' + a}</button>`).join('')}</div>
    ${tyWingBar(me)}
    ${nextAll ? `<p class="small muted ty-allnote">⭐ Get <b>every</b> ${w ? esc(W.name) + ' ' : ''}line to level ${nextAll} and everything makes ×2!</p>` : ''}
    <div class="ty-lines">${rows}</div>
    ${NW && w === nw - 1 ? `<div class="ty-nextwing"><span>${NW.e}</span><div class="grow"><b>${esc(NW.name)} · 12 new lines</b><small>Opens at Factory Rank ${NW.rank} — you’re Rank ${tyRank(T)}. Earn ${COIN} ${fmtCoin(tyRankAt(NW.rank))} in total.</small></div><span>🔒</span></div>` : ''}
    <div class="ty-glovecard">${(() => { const c = tyGloveCost(T.glove || 0); return `<span>🧤</span><div class="grow"><b>Super gloves · lv ${T.glove || 0}</b><small>Doubles every tap</small></div><button class="ty-buybtn" data-action="ty-glove" data-cost="${c}"><b>Upgrade</b><small>${COIN} ${fmtCoin(c)}</small></button>`; })()}</div>`;
}
function tyUpsView(me) {
  const list = tyUpgrades(me), money = tyMoney(me), T = tyState(me);
  const have = Object.keys(T.up).length;
  return `<p class="small muted" style="margin:6px 2px 10px">${have} upgrade${have === 1 ? '' : 's'} bought. New ones appear as your lines level up.</p>
    <div class="card flush">${list.slice(0, 14).map((u) => `<div class="row ty-up${u.need ? '' : ' locked'}"><div class="avatar">${u.sid && typeof squishySVG === 'function' ? `<span class="ty-upsq">${squishySVG(u.sid)}</span>` : u.e}</div><div class="grow"><div class="title">${esc(u.name)}</div><div class="sub">${esc(u.desc)}${u.need ? '' : ` · needs ${esc(u.needTxt)}`}</div></div>${u.need ? `<button class="ty-buybtn" data-action="ty-up" data-id="${u.id}" data-cost="${Math.ceil(u.cost)}"><b>Buy</b><small>${COIN} ${fmtCoin(u.cost)}</small></button>` : '<span class="ty-lock">🔒</span>'}</div>`).join('') || '<div class="empty small" style="padding:16px">You bought everything — for now! 🎉</div>'}</div>`;
}
function tyGoalsView(me) {
  const T = tyState(me), D = tyDaily(me);
  const orders = D.list.map((o, i) => ({ i, ...tyOrder(T, o), got: !!D.got[i] }));
  const allGot = orders.every((o) => o.got);
  const daily = `<div class="ty-orders"><div class="ty-oh"><b>📋 Today’s orders</b><small>⭐ 1 each · ⭐ 2 more for all three · new ones tomorrow</small></div>
    ${orders.map((o) => `<div class="row ty-goal${o.ready && !o.got ? ' ready' : ''}${o.got ? ' got' : ''}"><div class="grow"><div class="title">${o.got ? '✅ ' : ''}${esc(o.text)}</div><span class="ty-ms"><i style="width:${Math.round((o.c / o.g) * 100)}%"></i><em>${fmtCoin(o.c)} / ${fmtCoin(o.g)}</em></span></div>${o.ready && !o.got ? `<button class="btn ty-claim" data-action="ty-dclaim" data-i="${o.i}">⭐ Claim</button>` : ''}</div>`).join('')}
    ${allGot ? (D.got.all ? '<div class="ty-alldone">🎉 All done for today — +2 ⭐ collected</div>' : '<button class="btn ty-claim ty-allbtn" data-action="ty-dclaim" data-i="all">🎉 All three done — claim ⭐ 2</button>') : ''}</div>`;
  const rows = tyGoalList().map(([id, text, f, kind, n]) => { const [c, g] = f(T, me); return { id, text, c, g, kind, n, done: !!T.goals[id], ready: !T.goals[id] && c >= g }; });
  const open = rows.filter((r) => !r.done).sort((a, b) => b.ready - a.ready || b.c / b.g - a.c / a.g);
  const done = rows.length - open.length;
  return `${daily}<p class="small muted" style="margin:12px 2px 10px">${done} of ${rows.length} goals done — closest ones first</p>
    <div class="card flush">${open.slice(0, 10).map((r) => `<div class="row ty-goal${r.ready ? ' ready' : ''}"><div class="grow"><div class="title">${esc(r.text)}</div><span class="ty-ms"><i style="width:${Math.min(100, Math.round((r.c / r.g) * 100))}%"></i><em>${fmtCoin(Math.min(r.c, r.g))} / ${fmtCoin(r.g)} · ${esc(tyGoalReward(me, r.kind, r.n))}</em></span></div>${r.ready ? `<button class="btn ty-claim" data-action="ty-claim" data-id="${r.id}">Claim!</button>` : ''}</div>`).join('')}</div>`;
}
function tyLabView(me) {
  const T = tyState(me), stars = tyStars(T), rank = tyRank(T);
  return `<div class="card ty-labhead"><span>⭐</span><div class="grow"><b>${stars} Star${stars === 1 ? '' : 's'} to spend</b><small>Get Stars from Factory Ranks (+1 each, +3 every 5th), daily orders, goals and rainbow squishies. Lab upgrades stay forever — even through Golden restarts.</small></div></div>
    <div class="card flush">${TY_LAB.map(([id, e, name, desc, max, base]) => {
      const lv = tyLab(T, id), cost = tyLabCost(base, lv), maxed = lv >= max;
      return `<div class="row ty-lab"><div class="avatar">${e}</div><div class="grow"><div class="title">${esc(name)} <small>${lv}/${max}</small></div><div class="sub">${esc(desc)}</div>${max > 10 ? `<span class="ty-ms ty-labbar"><i style="width:${Math.round((lv / max) * 100)}%"></i></span>` : `<span class="ty-pips">${[...Array(max)].map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`}</div>${maxed ? '<span class="ty-lock">👑</span>' : `<button class="ty-buybtn${stars < cost ? ' cant' : ''}" data-action="ty-lab" data-id="${id}"><b>Level ${lv + 1}</b><small>⭐ ${cost}</small></button>`}</div>`;
    }).join('')}</div>
    <div class="section-title">🗺️ Factory wings</div><div class="card flush">${TY_WINGS.map((W, i) => `<div class="row"><div class="avatar">${W.e}</div><div class="grow"><div class="title">${esc(W.name)}</div><div class="sub">${tyWingOpen(T, i) ? `Open · ${tyWingLines(i).filter((L) => tyLv(T, L)).length}/12 lines running` : `Opens at Rank ${W.rank} (${fmtCoin(tyRankAt(W.rank))} earned)`}</div></div><b>${tyWingOpen(T, i) ? '✅' : '🔒'}</b></div>`).join('')}</div>
    <p class="small muted" style="margin:8px 2px">You’re Rank ${rank}: ${esc(tyTitle(rank))}.</p>`;
}
function tyGoldView(me) {
  const T = tyState(me), gold = tyGolden(me), extra = gold - (T.pres || 0);
  const nextAt = tyGoldenAt(gold + 1);
  const board = state.members.map((m) => [m, state.tycoon?.[m.id]?.earned || 0, state.tycoon?.[m.id]?.pres || 0]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  return `<div class="card ty-gold"><b>🌟 Golden Squish</b><div class="small" style="margin-top:4px">You have <b>${T.pres || 0}</b> (each one: everything +10% forever).<br>
      ${extra > 0 ? `Restart now to earn <b>${extra} more</b> → +${(gold) * 10}% total. Your lines, upgrades and coins start over; goals and Golden Squish stay.` : `Earn ${COIN} ${fmtCoin(nextAt)} in total for the next one (so far ${fmtCoin(T.earned || 0)}).`}</div>
      ${extra > 0 ? `<button class="btn" data-action="ty-golden" style="margin-top:10px">🌟 Restart for +${extra} Golden Squish</button>` : ''}</div>
    <div class="section-title">🏆 Family factory board</div><div class="card flush">${board.length ? board.map(([m, e, p], i) => `<div class="row"><div class="avatar">${esc(m.emoji)}</div><div class="grow"><div class="title">${['🥇', '🥈', '🥉'][i] || ''} ${esc(m.name)}</div><div class="sub">${p ? `🌟 ${p} Golden` : 'No Golden Squish yet'}</div></div><b>${COIN} ${fmtCoin(e)}</b></div>`).join('') : '<div class="empty small" style="padding:14px">Nobody’s built a factory yet.</div>'}</div>
    <div class="section-title">📊 Your factory</div><div class="card ty-stats"><span>Taps <b>${fmtCoin(T.taps || 0)}</b></span><span>Golden caught <b>${T.goldN || 0}</b></span><span>Earned this run <b>${fmtCoin(T.run || 0)}</b></span><span>Earned ever <b>${fmtCoin(T.earned || 0)}</b></span><span>Away cap <b>${tyOfflineH(me)}h</b></span></div>`;
}

/* ---------- Actions ---------- */
Object.assign(actions, {
  'ty-tab': (el) => { ui.tyTab = el.dataset.k; render(); },
  'ty-wing': (el) => { const me = actor(), w = Number(el.dataset.w), W = TY_WINGS[w]; if (!W) return; if (!tyWingOpen(tyState(me), w)) { toast(`🔒 ${W.name} opens at Factory Rank ${W.rank}`); return; } ui.tyWing = w; render(); },
  'ty-lab': (el) => {
    const me = actor(), T = tyState(me), L = TY_LAB.find((x) => x[0] === el.dataset.id); if (!L) return;
    const lv = tyLab(T, L[0]), cost = tyLabCost(L[5], lv);
    if (lv >= L[4]) return; if (tyStars(T) < cost) { toast('Not enough Stars yet ⭐'); return; }
    T.lab = { ...T.lab, [L[0]]: lv + 1 }; T.starUsed = (T.starUsed || 0) + cost; gBuzz(); toast(`🧪 ${L[2]} level ${lv + 1}!`); coinSaveSoon(true); render();
  },
  'ty-dclaim': (el) => {
    const me = actor(), T = tyState(me), D = tyDaily(me), i = el.dataset.i;
    if (i === 'all') { if (D.got.all || !D.list.every((o, k) => D.got[k])) return; D.got = { ...D.got, all: 1 }; T.starX = (T.starX || 0) + 2; T.dailyN = (T.dailyN || 0) + 1; toast('🎉 All orders done! +2 ⭐'); }
    else { const o = D.list[i]; if (!o || D.got[i] || !tyOrder(T, o).ready) return; D.got = { ...D.got, [i]: 1 }; T.starX = (T.starX || 0) + 1; toast('📋 Order done! +1 ⭐'); }
    confetti(); coinSaveSoon(true); render();
  },
  'ty-amt': (el) => { ui.tyAmt = el.dataset.a === 'max' ? 'max' : Number(el.dataset.a); render(); },
  'ty-tap': (el) => {
    const Y = ui.ty; if (!Y) return;
    const now = Date.now(), C = (ui.tyCb ||= { n: 0, at: 0 });
    C.n = now - C.at < 700 ? C.n + 1 : 1; C.at = now;
    const v = tyTap(Y.pid); Y.pend += v; tyState(Y.pid).taps = (tyState(Y.pid).taps || 0) + 1; gBuzz();
    const box = document.querySelector('.ty-floats');
    if (box) { const f = document.createElement('span'); f.textContent = '+' + fmtRate(v); f.style.left = (25 + Math.random() * 50) + '%'; box.appendChild(f); setTimeout(() => f.remove(), 900); }
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    document.querySelectorAll(`[data-coins="${Y.pid}"]`).forEach((x) => { x.textContent = fmtCoin(tyMoney(Y.pid)); });
  },
  'ty-buy': (el) => {
    const me = actor(); tyFlush(); const T = tyState(me), L = tyLines().find((x) => x.sid === el.dataset.sid); if (!L) return;
    if (!tyUnlocked(T, L)) return;
    const f = tyBulk(T), lv = tyLv(T, L), amt = ui.tyAmt || 1, n = amt === 'max' ? Math.max(1, tyMaxN(L, lv, coinsOf(me), f)) : amt, cost = Math.ceil(tyCostN(L, lv, n, f));
    if (!spendCoins(me, cost)) return;
    const before = tyMsCount(lv);
    T.lv[L.sid] = lv + n; gBuzz();
    if (tyMsCount(lv + n) > before) toast(`⭐ ${L.name} hit level ${TY_MS[tyMsCount(lv + n) - 1]} — ×2!`);
    if (!lv) toast(`🏭 ${L.name} line is open!`);
    render();
  },
  'ty-slow': () => {
    const me = actor(); tyFlush(); const S = tySlowest(me);
    if (!S || !S.n) { toast(`Not enough coins yet ${COIN}`); return; }
    if (!spendCoins(me, Math.ceil(S.cost))) return;
    const T = tyState(me), before = tyMsCount(S.lv);
    T.lv[S.L.sid] = S.lv + S.n; gBuzz();
    toast(tyMsCount(S.lv + S.n) > before ? `⭐ ${S.L.name} hit level ${S.lv + S.n} — ×2!` : `🐢 ${S.L.name} +${S.n} levels`);
    render();
  },
  'ty-glove': () => { const me = actor(); tyFlush(); const T = tyState(me), c = tyGloveCost(T.glove || 0); if (!spendCoins(me, c)) return; T.glove = (T.glove || 0) + 1; gBuzz(); render(); },
  'ty-up': (el) => {
    const me = actor(); tyFlush(); const u = tyUpgrades(me).find((x) => x.id === el.dataset.id); if (!u || !u.need) return;
    if (!spendCoins(me, Math.ceil(u.cost))) return;
    tyState(me).up[u.id] = 1; tyState(me).upN = (tyState(me).upN || 0) + 1; gBuzz(); toast(`⬆️ ${u.name}!`); render();
  },
  'ty-claim': (el) => {
    const me = actor(), T = tyState(me), G = tyGoalList().find((x) => x[0] === el.dataset.id); if (!G || T.goals[G[0]]) return;
    const [c, g] = G[2](T, me); if (c < g) return;
    T.goals[G[0]] = Date.now();
    if (G[3] === 'star') { T.starX = (T.starX || 0) + G[4]; toast(`⭐ +${G[4]} Star${G[4] > 1 ? 's' : ''}!`); }
    else if (G[3] === 'boost') { T.boost = Math.max(T.boost || 0, Date.now()) + G[4] * 60000; toast(`🔥 2× earnings for ${G[4]} minutes!`); }
    else { const n = Math.floor(Math.max(G[4], tyCps(me) * 60)); addCoins(me, n); toast(`+${fmtCoin(n)} coins! ${COIN}`); }
    confetti(); coinSaveSoon(true); render();
  },
  'ty-gold': (el) => {
    const me = actor(), T = tyState(me); el.remove(); if (!ui.tyGold) return;
    const rainbow = ui.tyGold.rainbow;
    ui.tyGold = null; tyGoldNext(me); T.goldN = (T.goldN || 0) + 1;
    const r = Math.random(), x = T.up.charm ? 2 : 1;
    if (rainbow) { T.rainN = (T.rainN || 0) + 1; T.starX = (T.starX || 0) + 1; ui.tyFrz = { k: 'prod', m: 20 * x, until: Date.now() + 30000 }; toast(`🌈 Rainbow squishy! +1 ⭐ and everything ×${20 * x} for 30s`); }
    else if (r < 0.5) { const n = Math.floor(Math.max(50, Math.min(tyMoney(me) * 0.15 + 100, tyCps(me) * 900)) * x); addCoins(me, n); toast(`🌟 Lucky! +${fmtCoin(n)} coins`); }
    else if (r < 0.8) { ui.tyFrz = { k: 'prod', m: 7 * x, until: Date.now() + 30000 }; toast(`🔥 Frenzy! Everything ×${7 * x} for 30s`); }
    else { ui.tyFrz = { k: 'tap', until: Date.now() + 20000 * x }; toast('👆 Tap frenzy! Taps ×10 — go go go!'); }
    gBuzz(); confetti(); coinSaveSoon();
  },
  'ty-golden': () => {
    const me = actor(), T = tyState(me), g = tyGolden(me);
    if (g <= (T.pres || 0)) return;
    if (!confirm(`Restart your factory for ${g - (T.pres || 0)} Golden Squish? Lines, upgrades and coins start over — but everything earns +${g * 10}% forever.`)) return;
    tyFlush(); Object.assign(T, { pres: g, lv: {}, up: {}, glove: 0, run: 0 });
    if (T.daily) T.daily.list = T.daily.list.map((o) => (o.k === 'lv' ? { ...o, base: 0 } : o)); // level orders count from the fresh start
    state.coins[me] = COIN_START * Math.pow(1000, tyLab(T, 'head')); ui.ty.pend = 0; coinSaveSoon(true); confetti(); if (typeof celebrate === 'function') celebrate('🌟 Golden Squish!', `Everything now earns +${g * 10}%`); render();
  },
});
KID_ROUTES.push('tycoon');
for (const a of ['ty-wing', 'ty-lab', 'ty-dclaim', 'ty-slow', 'ty-tab', 'ty-amt', 'ty-tap', 'ty-buy', 'ty-glove', 'ty-up', 'ty-claim', 'ty-gold', 'ty-golden']) KID_ACTIONS.add(a);
if (typeof HUB_OF !== 'undefined') HUB_OF.tycoon = 'play';
if (typeof PG_SCROLL !== 'undefined') PG_SCROLL.add('tycoon');
const _afterRenderTy = afterRender;
afterRender = function () {
  _afterRenderTy();
  if (currentRoute().name === 'tycoon') tyLoop();
  else { if (ui.ty) { tyFlush(true); ui.ty = null; clearInterval(tyTick); } document.querySelector('.ty-goldsq')?.remove(); ui.tyGold = null; }
};
document.addEventListener('visibilitychange', () => { if (document.hidden && ui.ty) tyFlush(true); });
