/* Squish Tycoon: a squishy factory idle/clicker game on the play-coin wallet (lucky.js).
   - 12 production lines, each a real squishy from the catalog (Commons up to a Mythic). Lines level up; every
     milestone level (10, 25, 50, 100…) doubles that line, and when every line passes 25/50/100 they all double.
   - Owning that squishy in your real collection gives its line +50%.
   - Upgrades shop, golden squishies that pop up to tap, tap combos, goals with rewards, earning while away,
     and Golden Squish restarts that make everything earn more forever. Loaded after lucky.js. */
'use strict';

const TY_COST0 = [15, 120, 1000, 8000, 65000, 550000, 4.5e6, 4e7, 3.5e8, 3e9, 2.6e10, 2.2e11];
const TY_RATE = [0.2, 1.2, 8, 50, 300, 2000, 13000, 90000, 6e5, 4e6, 2.8e7, 2e8];
const TY_GROW = 1.12;
const TY_MS = [10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];
const TY_ALL = [25, 50, 100, 200];
const TY_TIERS = [['C', 4, 'Common corner'], ['R', 3, 'Rare row'], ['E', 2, 'Epic hall'], ['L', 2, 'Legendary tower'], ['M', 1, 'Mythic vault']];
function tyLines() {
  if (tyLines.c) return tyLines.c;
  const pool = typeof SQUISHIES !== 'undefined' ? SQUISHIES.filter((s) => s.kind === 'squishy' && !s.season) : [];
  const out = [];
  for (const [r, n] of TY_TIERS) out.push(...pool.filter((s) => s.r === r).slice(0, n));
  return (tyLines.c = out.slice(0, 12).map((s, k) => ({ sid: s.id, name: s.name, r: s.r, k, cost0: TY_COST0[k], rate: TY_RATE[k] })));
}
const TY_GOLD_EVERY = [70, 150]; // seconds between golden squishies (halved with Squish sense)

/* ---------- State ---------- */
function tyState(pid) {
  const T = ((state.tycoon ||= {})[pid] ||= { lv: {}, up: {}, goals: {}, glove: 0, earned: 0, run: 0, pres: 0, taps: 0, goldN: 0, at: Date.now() });
  T.lv ||= {}; T.up ||= {}; T.goals ||= {};
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
  let m = (1 + 0.1 * (T.pres || 0)) * ((T.boost || 0) > Date.now() ? 2 : 1);
  for (const t of TY_ALL) if (lines.every((L) => tyLv(T, L) >= t)) m *= 2;
  const F = tyFrenzy(); if (F && F.k === 'prod') m *= F.m;
  return m;
}
function tyLineRate(pid, L, lvOverride) {
  const T = tyState(pid), lv = lvOverride ?? tyLv(T, L);
  if (!lv) return 0;
  return lv * L.rate * Math.pow(2, tyMsCount(lv)) * (tyOwned(pid, L) ? 1.5 : 1) * (T.up['s1' + L.sid] ? 3 : 1) * (T.up['s2' + L.sid] ? 3 : 1);
}
const tyCps = (pid) => tyLines().reduce((a, L) => a + tyLineRate(pid, L), 0) * tyGlobal(pid);
const tyTapBase = (pid) => { const T = tyState(pid); return Math.pow(2, T.glove || 0) * (1 + 0.1 * (T.pres || 0)) + tyCps(pid) * (0.02 + 0.02 * ((T.up.tap1 ? 1 : 0) + (T.up.tap2 ? 1 : 0))); };
const tyCombo = () => { const C = ui.tyCb; return C && Date.now() - C.at < 700 ? 1 + Math.min(C.n, 40) * 0.05 : 1; };
const tyTap = (pid) => tyTapBase(pid) * tyCombo() * (tyFrenzy()?.k === 'tap' ? 10 : 1);
const tyCostN = (L, lv, n) => L.cost0 * Math.pow(TY_GROW, lv) * (Math.pow(TY_GROW, n) - 1) / (TY_GROW - 1);
const tyMaxN = (L, lv, money) => Math.max(0, Math.floor(Math.log(money * (TY_GROW - 1) / (L.cost0 * Math.pow(TY_GROW, lv)) + 1) / Math.log(TY_GROW)));
const tyGloveCost = (n) => Math.ceil(100 * Math.pow(6, n));
const tyGolden = (pid) => Math.floor(Math.cbrt((tyState(pid).earned || 0) / 1e5));
const tyOfflineH = (pid) => { const T = tyState(pid); return T.up.night2 ? 24 : T.up.night1 ? 16 : 8; };
const tyUnlocked = (T, L) => L.k === 0 || tyLv(T, tyLines()[L.k - 1]) > 0 || tyLv(T, L) > 0;

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
  ['l3', 'Open 3 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 3], 'coins', 1000], ['l6', 'Open 6 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 6], 'boost', 15], ['l9', 'Open 9 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 9], 'boost', 30], ['l12', 'Open all 12 lines', (T) => [tyLines().filter((L) => tyLv(T, L)).length, 12], 'boost', 60],
  ['lv25', 'Get any line to level 25', (T) => [Math.max(0, ...tyLines().map((L) => tyLv(T, L))), 25], 'coins', 2000], ['lv100', 'Get any line to level 100', (T) => [Math.max(0, ...tyLines().map((L) => tyLv(T, L))), 100], 'boost', 30], ['all25', 'Every line to level 25', (T) => [Math.min(...tyLines().map((L) => tyLv(T, L))), 25], 'boost', 60],
  ['g1', 'Catch a golden squishy', (T) => [T.goldN || 0, 1], 'coins', 500], ['g10', 'Catch 10 golden squishies', (T) => [T.goldN || 0, 10], 'boost', 20], ['g50', 'Catch 50 golden squishies', (T) => [T.goldN || 0, 50], 'boost', 60],
  ['col1', 'Own a squishy that has a line here', (T, pid) => [tyLines().filter((L) => tyOwned(pid, L)).length, 1], 'coins', 1500], ['col4', 'Own 4 of the line squishies', (T, pid) => [tyLines().filter((L) => tyOwned(pid, L)).length, 4], 'boost', 30],
  ['up5', 'Buy 5 upgrades', (T) => [Object.keys(T.up).length, 5], 'coins', 8000], ['p1', 'Earn your first Golden Squish', (T) => [T.pres || 0, 1], 'boost', 60],
];
const tyGoalReward = (pid, kind, n) => (kind === 'boost' ? `🔥 2× for ${n} min` : `${COIN} ${fmtCoin(Math.max(n, tyCps(pid) * 60))}`);

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
  if (force) coinSaveSoon(true);
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
    if (ui.tyGold && now > ui.tyGold.until) { document.querySelector('.ty-goldsq')?.remove(); ui.tyGold = null; tyGoldNext(Y.pid); }
  }, 200);
}
function tyGoldNext(pid) { const T = tyState(pid), [a, b] = TY_GOLD_EVERY, k = T.up.sense ? 0.5 : 1; ui.tyNextGold = Date.now() + (a + Math.random() * (b - a)) * 1000 * k; }
function tyGoldSpawn(pid) {
  const lines = tyLines(), L = lines[Math.floor(Math.random() * Math.max(1, lines.filter((x) => tyLv(tyState(pid), x)).length || 1))] || lines[0];
  const el = document.createElement('button');
  el.className = 'ty-goldsq'; el.dataset.action = 'ty-gold'; el.setAttribute('aria-label', 'Golden squishy!');
  el.style.left = (10 + Math.random() * 70) + 'vw'; el.style.top = (22 + Math.random() * 55) + 'vh';
  el.innerHTML = typeof squishySVG === 'function' && L ? squishySVG(L.sid, { shiny: true }) : '🌟';
  document.body.appendChild(el);
  ui.tyGold = { until: Date.now() + 10000 };
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
  const T = tyState(me), open = tyLines().filter((L) => tyUnlocked(T, L));
  if (!open.length) return null;
  const L = open.reduce((a, b) => (tyLv(T, b) < tyLv(T, a) ? b : a), open[0]), lv = tyLv(T, L), target = tyNextMs(lv) || lv + 10;
  const n = Math.min(target - lv, tyMaxN(L, lv, tyMoney(me)));
  return { L, lv, target, n, cost: tyCostN(L, lv, Math.max(1, n)) };
}

/* ---------- Screen ---------- */
Object.assign(TITLES, { tycoon: 'Squish Tycoon' });
views.tycoon = () => {
  const me = actor(); if (!me) return needMe();
  tyStart(me);
  const T = tyState(me), cps = tyCps(me), money = tyMoney(me), tab = ui.tyTab || 'lines';
  const away = ui.tyAway && ui.tyAway.pid === me && Date.now() - ui.tyAway.t < 8000 ? ui.tyAway : null;
  const boost = (T.boost || 0) > Date.now() ? Math.ceil((T.boost - Date.now()) / 60000) : 0;
  const goalsReady = TY_GOALS.filter(([id, , f]) => !T.goals[id] && (() => { const [c, g] = f(T, me); return c >= g; })()).length;
  const ups = tyUpgrades(me).filter((u) => u.need && u.cost <= money).length;
  const hero = tyLines().filter((L) => tyLv(T, L)).at(-1) || tyLines()[0];
  return `<div class="ty-top">${coinChip(me)}<span class="ty-cps">⚡ ${fmtRate(cps)}/sec${T.pres ? `<br>🌟 ${T.pres} Golden (+${T.pres * 10}%)` : ''}${boost ? `<br>🔥 2× · ${boost}m` : ''}</span></div>
    ${coinDaily(me) ? `<button class="ty-daily" data-action="coin-daily">🎁 Collect your daily ${COIN} ${COIN_DAILY}</button>` : ''}
    ${away ? `<div class="ty-away">💤 You were away ${away.h}h — your factory made <b>${COIN} ${fmtCoin(away.n)}</b>!</div>` : ''}
    <div class="ty-tapzone"><div class="ty-frz"></div><button class="ty-tap" data-action="ty-tap" aria-label="Squish!">${hero && typeof squishySVG === 'function' ? squishySVG(hero.sid) : '🧸'}</button><div class="ty-floats"></div><div class="ty-combo"></div><small>Tap fast for a combo! +${fmtRate(tyTapBase(me))} a tap</small></div>
    ${tyFloor(me)}
    <div class="segmented ty-tabs">${[['lines', '🏭 Lines'], ['ups', `⬆️ Upgrades${ups ? ` <i>${ups}</i>` : ''}`], ['goals', `🎯 Goals${goalsReady ? ` <i>${goalsReady}</i>` : ''}`], ['gold', '🌟 Golden']].map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="ty-tab" data-k="${k}">${l}</button>`).join('')}</div>
    ${tab === 'lines' ? tyLinesView(me) : tab === 'ups' ? tyUpsView(me) : tab === 'goals' ? tyGoalsView(me) : tyGoldView(me)}`;
};
function tyLinesView(me) {
  const T = tyState(me), amt = ui.tyAmt || 1, money = tyMoney(me), lines = tyLines(), g = tyGlobal(me);
  const nextAll = TY_ALL.find((t) => !lines.every((L) => tyLv(T, L) >= t));
  let lastTier = '';
  const rows = lines.map((L) => {
    const lv = tyLv(T, L), open = tyUnlocked(T, L);
    const head = L.r !== lastTier ? `<div class="ty-tier">${TY_TIERS.find((t) => t[0] === L.r)[2]}</div>` : ''; lastTier = L.r;
    if (!open) return `${head}<div class="ty-line locked"><span class="ty-sq">❔</span><div class="grow"><b>???</b><small>Buy a ${esc(lines[L.k - 1].name)} level to unlock</small></div></div>`;
    const n = amt === 'max' ? Math.max(1, tyMaxN(L, lv, money)) : amt, cost = tyCostN(L, lv, n), next = tyNextMs(lv), prev = TY_MS[TY_MS.indexOf(next) - 1] || 0;
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
    ${nextAll ? `<p class="small muted ty-allnote">⭐ Get <b>every</b> line to level ${nextAll} and they all make ×2!</p>` : ''}
    <div class="ty-lines">${rows}</div>
    <div class="ty-glovecard">${(() => { const c = tyGloveCost(T.glove || 0); return `<span>🧤</span><div class="grow"><b>Super gloves · lv ${T.glove || 0}</b><small>Doubles every tap</small></div><button class="ty-buybtn" data-action="ty-glove" data-cost="${c}"><b>Upgrade</b><small>${COIN} ${fmtCoin(c)}</small></button>`; })()}</div>`;
}
function tyUpsView(me) {
  const list = tyUpgrades(me), money = tyMoney(me), T = tyState(me);
  const have = Object.keys(T.up).length;
  return `<p class="small muted" style="margin:6px 2px 10px">${have} upgrade${have === 1 ? '' : 's'} bought. New ones appear as your lines level up.</p>
    <div class="card flush">${list.slice(0, 14).map((u) => `<div class="row ty-up${u.need ? '' : ' locked'}"><div class="avatar">${u.sid && typeof squishySVG === 'function' ? `<span class="ty-upsq">${squishySVG(u.sid)}</span>` : u.e}</div><div class="grow"><div class="title">${esc(u.name)}</div><div class="sub">${esc(u.desc)}${u.need ? '' : ` · needs ${esc(u.needTxt)}`}</div></div>${u.need ? `<button class="ty-buybtn" data-action="ty-up" data-id="${u.id}" data-cost="${Math.ceil(u.cost)}"><b>Buy</b><small>${COIN} ${fmtCoin(u.cost)}</small></button>` : '<span class="ty-lock">🔒</span>'}</div>`).join('') || '<div class="empty small" style="padding:16px">You bought everything — for now! 🎉</div>'}</div>`;
}
function tyGoalsView(me) {
  const T = tyState(me);
  const rows = TY_GOALS.map(([id, text, f, kind, n]) => { const [c, g] = f(T, me); return { id, text, c, g, kind, n, done: !!T.goals[id], ready: !T.goals[id] && c >= g }; });
  const open = rows.filter((r) => !r.done).sort((a, b) => b.ready - a.ready || b.c / b.g - a.c / a.g);
  const done = rows.length - open.length;
  return `<p class="small muted" style="margin:6px 2px 10px">${done} of ${rows.length} goals done</p>
    <div class="card flush">${open.slice(0, 10).map((r) => `<div class="row ty-goal${r.ready ? ' ready' : ''}"><div class="grow"><div class="title">${esc(r.text)}</div><span class="ty-ms"><i style="width:${Math.min(100, Math.round((r.c / r.g) * 100))}%"></i><em>${fmtCoin(Math.min(r.c, r.g))} / ${fmtCoin(r.g)} · ${esc(tyGoalReward(me, r.kind, r.n))}</em></span></div>${r.ready ? `<button class="btn ty-claim" data-action="ty-claim" data-id="${r.id}">Claim!</button>` : ''}</div>`).join('')}</div>`;
}
function tyGoldView(me) {
  const T = tyState(me), gold = tyGolden(me), extra = gold - (T.pres || 0);
  const nextAt = Math.pow(gold + 1, 3) * 1e5;
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
    const lv = tyLv(T, L), amt = ui.tyAmt || 1, n = amt === 'max' ? Math.max(1, tyMaxN(L, lv, coinsOf(me))) : amt, cost = Math.ceil(tyCostN(L, lv, n));
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
    tyState(me).up[u.id] = 1; gBuzz(); toast(`⬆️ ${u.name}!`); render();
  },
  'ty-claim': (el) => {
    const me = actor(), T = tyState(me), G = TY_GOALS.find((x) => x[0] === el.dataset.id); if (!G || T.goals[G[0]]) return;
    const [c, g] = G[2](T, me); if (c < g) return;
    T.goals[G[0]] = Date.now();
    if (G[3] === 'boost') { T.boost = Math.max(T.boost || 0, Date.now()) + G[4] * 60000; toast(`🔥 2× earnings for ${G[4]} minutes!`); }
    else { const n = Math.floor(Math.max(G[4], tyCps(me) * 60)); addCoins(me, n); toast(`+${fmtCoin(n)} coins! ${COIN}`); }
    confetti(); coinSaveSoon(true); render();
  },
  'ty-gold': (el) => {
    const me = actor(), T = tyState(me); el.remove(); if (!ui.tyGold) return;
    ui.tyGold = null; tyGoldNext(me); T.goldN = (T.goldN || 0) + 1;
    const r = Math.random(), x = T.up.charm ? 2 : 1;
    if (r < 0.5) { const n = Math.floor(Math.max(50, Math.min(tyMoney(me) * 0.15 + 100, tyCps(me) * 900)) * x); addCoins(me, n); toast(`🌟 Lucky! +${fmtCoin(n)} coins`); }
    else if (r < 0.8) { ui.tyFrz = { k: 'prod', m: 7 * x, until: Date.now() + 30000 }; toast(`🔥 Frenzy! Everything ×${7 * x} for 30s`); }
    else { ui.tyFrz = { k: 'tap', until: Date.now() + 20000 * x }; toast('👆 Tap frenzy! Taps ×10 — go go go!'); }
    gBuzz(); confetti(); coinSaveSoon();
  },
  'ty-golden': () => {
    const me = actor(), T = tyState(me), g = tyGolden(me);
    if (g <= (T.pres || 0)) return;
    if (!confirm(`Restart your factory for ${g - (T.pres || 0)} Golden Squish? Lines, upgrades and coins start over — but everything earns +${g * 10}% forever.`)) return;
    tyFlush(); Object.assign(T, { pres: g, lv: {}, up: {}, glove: 0, run: 0 });
    state.coins[me] = COIN_START; ui.ty.pend = 0; coinSaveSoon(true); confetti(); if (typeof celebrate === 'function') celebrate('🌟 Golden Squish!', `Everything now earns +${g * 10}%`); render();
  },
});
KID_ROUTES.push('tycoon');
for (const a of ['ty-slow', 'ty-tab', 'ty-amt', 'ty-tap', 'ty-buy', 'ty-glove', 'ty-up', 'ty-claim', 'ty-gold', 'ty-golden']) KID_ACTIONS.add(a);
if (typeof HUB_OF !== 'undefined') HUB_OF.tycoon = 'play';
if (typeof PG_SCROLL !== 'undefined') PG_SCROLL.add('tycoon');
const _afterRenderTy = afterRender;
afterRender = function () {
  _afterRenderTy();
  if (currentRoute().name === 'tycoon') tyLoop();
  else { if (ui.ty) { tyFlush(true); ui.ty = null; clearInterval(tyTick); } document.querySelector('.ty-goldsq')?.remove(); ui.tyGold = null; }
};
document.addEventListener('visibilitychange', () => { if (document.hidden && ui.ty) tyFlush(true); });
