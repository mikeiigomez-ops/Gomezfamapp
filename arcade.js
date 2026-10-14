/* Arcade: five more family games you play from your own phones (or pass the phone, or vs. the robot):
   Dots & Boxes, Sea Hunt, Doodle Guess, Five Dice and Checkers. One small engine runs them all: a game is a
   record in state.games (so it syncs like Connect Four), each game type says who it's waiting on, what a
   move does and who won, and the engine handles turns, the robot, pass-the-phone screens, rewards and the
   "your turn" notifications. Loaded after games.js and notify.js. */
'use strict';

const GX = {};
const MP_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const mpGames = () => state.games.filter((g) => GX[g.type]);
const mpRand = (n) => Math.floor(Math.random() * n);
const mpPick = (a) => a[mpRand(a.length)];
const mpHuman = (id) => id !== BOT;
const mpStatus = (g) => GX[g.type].status(g);
const mpNeed = (g) => (mpStatus(g).over ? [] : GX[g.type].need(g));
// Who's playing on this phone right now (null = nobody here can move)
function mpActor(g) {
  const need = mpNeed(g).filter(mpHuman);
  if (!need.length) return null;
  if (g.mode === 'remote') { const me = actor(); return need.includes(me) ? me : null; }
  return need[0];
}
const mpColor = (g, pid) => MP_COLORS[Math.max(0, g.p.indexOf(pid)) % MP_COLORS.length];
const mpScoreOf = (g, pid) => (GX[g.type].scores ? GX[g.type].scores(g)[pid] || 0 : null);

/* ---------- Engine ---------- */
function mpNew(type, players, mode, opts = {}) {
  const X = GX[type];
  const g = { id: uid(), type, p: players, mode, host: actor(), at: Date.now(), ...X.init(players, opts) };
  state.games = state.games.filter((x) => !x.endAt || Date.now() - x.endAt < 14 * 86400000);
  state.games.push(g);
  save();
  go('mp/' + g.id);
  mpBotSoon(g);
}
// Apply a move for `who`, then finish / hand to the robot
function mpDo(g, who, data) {
  if (!g || mpStatus(g).over) return false;
  if (!mpNeed(g).includes(who)) return false;
  if (GX[g.type].act(g, who, data) === false) return false;
  g.last = who; g.lastAt = Date.now();
  gBuzz();
  mpFinish(g);
  save(); render();
  mpBotSoon(g);
  return true;
}
function mpFinish(g) {
  const st = mpStatus(g);
  if (!st.over || g.endAt) return;
  g.endAt = Date.now();
  g.winner = st.winner || 'draw';
  const X = GX[g.type];
  if (g.winner !== 'draw' && g.p.includes(g.winner)) {
    logAct(X.e, `${g.winner === actor() ? 'won' : 'played'} ${X.name}${g.winner === actor() ? '' : ` — ${playerName(g.winner)} won`}`, 'games');
    if (g.winner !== BOT && (g.mode !== 'remote' || g.winner === actor())) setTimeout(confetti, 400);
    if (isMember(g.winner)) g.gem = gameGem(g.winner, `${X.name} win ${X.e}`);
  }
}
// The robot moves on the phone that just played (or any player's phone if that one went quiet)
let mpBotT = 0;
function mpBotSoon(g) {
  clearTimeout(mpBotT);
  if (!g || !mpNeed(g).includes(BOT)) return;
  const mine = g.mode !== 'remote' || g.last === actor() || (!g.last && g.host === actor()) || Date.now() - (g.lastAt || g.at) > 20000;
  if (!mine || !g.p.includes(BOT)) return;
  mpBotT = setTimeout(() => {
    const gg = state.games.find((x) => x.id === g.id);
    if (!gg || !mpNeed(gg).includes(BOT)) return;
    const data = GX[gg.type].bot(gg);
    if (data == null || GX[gg.type].act(gg, BOT, data) === false) return;
    gg.last = actor() || gg.last; gg.lastAt = Date.now(); // the phone that ran the robot is "last", so it keeps running it
    mpFinish(gg);
    save();
    if (currentRoute().name === 'mp' || currentRoute().name === 'games') render();
    mpBotSoon(gg);
  }, GX[g.type].botDelay || 700);
}
const mpMine = () => { const me = actor(); return me ? mpGames().filter((g) => g.mode === 'remote' && mpNeed(g).includes(me)) : []; };
const _myTurnC4 = myTurnGames;
myTurnGames = function () { return [..._myTurnC4(), ...mpMine()]; };

/* ---------- Screen ---------- */
Object.defineProperty(TITLES, 'mp', { configurable: true, enumerable: true, get() { const id = currentRoute().param, g = state.games.find((x) => x.id === id); return (g && GX[g.type]?.name) || 'Game'; } });
views.mp = (id) => {
  const g = state.games.find((x) => x.id === id);
  if (!g || !GX[g.type]) return '<div class="card empty">This game was deleted.<br><button class="btn" style="margin-top:12px" data-action="go" data-to="games">Back to games</button></div>';
  const X = GX[g.type], st = mpStatus(g), need = mpNeed(g), who = mpActor(g), me = actor();
  // Pass the phone: when the next player changes on a shared phone and the game has secrets, cover the screen
  if (g.mode !== 'remote' && X.hidden && !(X.open && X.open(g)) && who && g.p.filter(mpHuman).length > 1 && (ui.mpPass?.[g.id] !== who)) {
    return `<div class="mp-pass"><div class="mp-pass-e">${esc(playerEmoji(who))}</div><h2>Pass to ${esc(playerName(who))}</h2><p class="muted">No peeking, everyone else 🙈</p><button class="btn" data-action="mp-ready" data-id="${g.id}" data-who="${esc(who)}">I’m ${esc(playerName(who))} — show me</button></div>`;
  }
  if (X.tv && (ui.mpTv === g.id || (g.mode === 'remote' && !g.p.includes(actor())))) return X.tv(g, st);
  const scores = X.scores ? X.scores(g) : null;
  const chips = g.p.map((pid) => `<div class="mp-chip${g.p.length > 3 ? ' small' : ''}${need.includes(pid) ? ' turn' : ''}${st.over && g.winner === pid ? ' won' : ''}" style="--c:${mpColor(g, pid)}"><span>${esc(playerEmoji(pid))}</span><b>${esc(playerName(pid))}</b>${scores ? `<i>${scores[pid] || 0}</i>` : ''}</div>`).join('');
  const waiting = need.filter((p) => p !== who);
  const status = st.over ? (X.endText ? X.endText(g) : g.winner === 'draw' ? '🤝 It’s a tie!' : `🏆 ${playerEmoji(g.winner)} ${playerName(g.winner)} wins!`)
    : who ? (X.prompt ? X.prompt(g, who) : g.mode === 'remote' ? '👉 Your turn!' : `${playerEmoji(who)} ${playerName(who)}’s turn`)
    : need.includes(BOT) ? '🤖 Robot is thinking…' : `⏳ Waiting for ${waiting.map(playerName).join(', ')}…`;
  return `<div class="mp-chips">${chips}</div>
    <div class="c4-status mp-status${st.over ? ' over' : ''}">${esc(status)}</div>${st.over && g.gem && (g.gem > 0 || g.winner === me) ? gameGemNote(g.gem, g.gem > 0 ? g.winner : '') : ''}
    ${X.view(g, who, st)}
    ${g.mode === 'remote' && !st.over && !who && !need.includes(BOT) ? `<p class="small muted" style="text-align:center;margin:8px 0">You’ll get a 🔔 when it’s your turn.</p>` : ''}
    <div class="btn-row mp-btns">${st.over ? `<button class="btn" data-action="mp-rematch" data-id="${g.id}">🔁 Play again</button>` : ''}<button class="btn secondary" data-action="mp-del" data-id="${g.id}">${st.over ? 'Remove' : 'Quit game'}</button></div>`;
};
// Game Center tiles + the list of games going
const ARCADE = ['dots', 'sea', 'doodle', 'dice', 'checkers'];
function arcadeTiles() {
  const me = actor();
  return ARCADE.map((t) => {
    const X = GX[t], mine = mpGames().filter((g) => g.type === t && !mpStatus(g).over && (!me || g.p.includes(me)));
    const turn = mine.filter((g) => g.mode === 'remote' && mpNeed(g).includes(me)).length;
    return `<button class="game-tile" data-action="mp-new" data-t="${t}" style="--g1:${X.g1};--g2:${X.g2}"><span class="gt-e">${X.e}</span><b>${esc(X.name)}</b><small>${turn ? `Your turn in ${turn}!` : mine.length ? `${mine.length} going · new game` : esc(X.tag)}</small></button>`;
  }).join('');
}
function mpCard(g) {
  const X = GX[g.type], st = mpStatus(g), me = actor(), need = mpNeed(g);
  const others = g.p.filter((p) => p !== me);
  const sub = st.over ? (X.endText ? X.endText(g) : g.winner === 'draw' ? 'Tie' : `${playerName(g.winner)} won 🏆`) : g.mode === 'remote' ? (need.includes(me) ? '👉 Your turn!' : `Waiting for ${need.map(playerName).join(', ')}…`) : g.p.includes(BOT) ? 'vs the robot' : 'Pass-and-play';
  return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="mp/${g.id}"><div class="avatar">${X.e}</div><div class="grow"><div class="title">${esc(X.name)} · vs ${esc(others.map((p) => `${playerEmoji(p)} ${playerName(p)}`).join(', '))}</div><div class="sub">${esc(sub)}</div></div>${!st.over && g.mode === 'remote' && need.includes(me) ? '<span class="dot-new"></span>' : ICON.chev}</button>`;
}
function arcadeList() {
  const me = actor();
  const going = mpGames().filter((g) => !mpStatus(g).over && (!me || g.p.includes(me) || g.mode !== 'remote')).sort((a, b) => (mpNeed(b).includes(me) ? 1 : 0) - (mpNeed(a).includes(me) ? 1 : 0) || (b.lastAt || b.at) - (a.lastAt || a.at));
  return going.length ? `<div class="section-title">Games going</div><div class="card flush">${going.slice(0, 8).map(mpCard).join('')}</div>` : '';
}
// New game: who's playing
function mpNewSheet(type) {
  const X = GX[type], me = actor();
  if (!me && state.members.length > 1) { toast('Pick who you are first'); return; }
  const synced = typeof Sync !== 'undefined' && !!Sync.ref;
  const online = (id) => typeof Live !== 'undefined' && Live.all?.[id] && Date.now() - (Live.all[id].at || 0) < 90000;
  const others = state.members.filter((m) => m.id !== me);
  const where = (m) => (synced ? (online(m.id) ? '<i class="live-dot"></i> Online now · their phone' : 'On their own phone') : 'Take turns on this phone');
  let html;
  if (X.max === 2) {
    html = `${X.bot ? `<button type="button" class="c4q-btn bot" data-action="mp-quick" data-t="${type}" data-opp="${BOT}"><span>🤖</span><b>Robot</b><small>${esc(X.botNote || 'Play the computer')}</small></button>` : ''}
      <button type="button" class="c4q-btn" data-action="mp-quick" data-t="${type}" data-opp="${P2}"><span>📱</span><b>Pass the phone</b><small>Two players, one phone</small></button>
      ${others.map((m) => `<button type="button" class="c4q-btn" data-action="mp-quick" data-t="${type}" data-opp="${m.id}" style="--c:${m.color || '#dc2626'}"><span>${esc(m.emoji)}</span><b>${esc(m.name)}</b><small>${where(m)}</small></button>`).join('')}`;
  } else {
    ui.mpSel = new Set(ui.mpSel?.type === type ? ui.mpSel : []); ui.mpSel.type = type;
    html = `<p class="small muted" style="margin:0 0 4px">Who’s playing with you? (up to ${X.max - 1})</p>
      <div class="mp-who">${X.bot ? `<button type="button" class="mp-pickb${ui.mpSel.has(BOT) ? ' on' : ''}" data-action="mp-sel" data-id="${BOT}"><span>🤖</span>Robot</button>` : ''}${others.map((m) => `<button type="button" class="mp-pickb${ui.mpSel.has(m.id) ? ' on' : ''}" data-action="mp-sel" data-id="${m.id}"><span>${esc(m.emoji)}</span>${esc(m.name)}</button>`).join('')}</div>
      ${synced ? `<button type="button" class="c4q-btn" data-action="mp-start" data-t="${type}" data-mode="remote"><span>📲</span><b>Everyone on their own phone</b><small>Take turns from anywhere</small></button>` : ''}
      <button type="button" class="c4q-btn" data-action="mp-start" data-t="${type}" data-mode="local"><span>🔄</span><b>Pass this phone</b><small>Sitting together</small></button>`;
  }
  openSheet({ title: `${X.e} ${X.name}`, saveLabel: 'Cancel', fields: [{ type: 'html', html: `<p class="small muted" style="margin:0 0 10px">${esc(X.how)}</p><div class="c4q">${html}</div>` }], onSave() {} });
}

/* =========================================================
   1. Dots & Boxes — draw a line; finish a box to keep it and go again
   ========================================================= */
const DB_N = 5, DB_H = (DB_N + 1) * DB_N, DB_E = DB_H * 2;
const dbBoxEdges = (r, c) => [r * DB_N + c, (r + 1) * DB_N + c, DB_H + r * (DB_N + 1) + c, DB_H + r * (DB_N + 1) + c + 1];
function dbBoxesOf(e) { // boxes next to an edge
  if (e < DB_H) { const r = Math.floor(e / DB_N), c = e % DB_N; return [[r - 1, c], [r, c]].filter(([y]) => y >= 0 && y < DB_N); }
  const k = e - DB_H, r = Math.floor(k / (DB_N + 1)), c = k % (DB_N + 1); return [[r, c - 1], [r, c]].filter(([, x]) => x >= 0 && x < DB_N);
}
function dbPlay(g) {
  const drawn = new Map(), owner = {}; let ti = 0;
  for (const e of g.moves) {
    drawn.set(e, ti);
    let got = 0;
    for (const [r, c] of dbBoxesOf(e)) if (dbBoxEdges(r, c).every((x) => drawn.has(x))) { owner[r * DB_N + c] = ti; got++; }
    if (!got) ti = (ti + 1) % g.p.length;
  }
  return { drawn, owner, ti };
}
GX.dots = {
  short: 'Dots & Boxes', sub: '2–4 players', name: 'Dots & Boxes', e: '🟦', g1: '#2563eb', g2: '#7c3aed', tag: '2–4 players', max: 4, bot: true, botNote: 'Grabs boxes, avoids giving them away',
  how: 'Take turns drawing a line between two dots. Close a box to claim it and go again. Most boxes wins!',
  init: () => ({ moves: [] }),
  need: (g) => [g.p[dbPlay(g).ti]],
  scores: (g) => { const s = Object.fromEntries(g.p.map((p) => [p, 0])); for (const o of Object.values(dbPlay(g).owner)) s[g.p[o]]++; return s; },
  status(g) {
    if (g.moves.length < DB_E) return { over: false };
    const s = this.scores(g), top = Math.max(...Object.values(s)), w = g.p.filter((p) => s[p] === top);
    return { over: true, winner: w.length === 1 ? w[0] : 'draw' };
  },
  act(g, who, e) { e = Number(e); if (!(e >= 0 && e < DB_E) || g.moves.includes(e)) return false; g.moves = [...g.moves, e]; },
  bot(g) {
    const { drawn } = dbPlay(g), free = [...Array(DB_E).keys()].filter((e) => !drawn.has(e));
    const sides = (r, c) => dbBoxEdges(r, c).filter((x) => drawn.has(x)).length;
    const take = free.filter((e) => dbBoxesOf(e).some(([r, c]) => sides(r, c) === 3));
    if (take.length) return mpPick(take);
    const safe = free.filter((e) => dbBoxesOf(e).every(([r, c]) => sides(r, c) < 2));
    if (safe.length) return mpPick(safe);
    const cost = (e) => dbBoxesOf(e).filter(([r, c]) => sides(r, c) === 2).length;
    const best = Math.min(...free.map(cost));
    return mpPick(free.filter((e) => cost(e) === best));
  },
  view(g, who) {
    const { drawn, owner } = dbPlay(g), S = 100 / (DB_N + .4), O = S * .2, P = (i) => O + i * S, last = g.moves.at(-1);
    let svg = '';
    for (const [k, o] of Object.entries(owner)) { const r = Math.floor(k / DB_N), c = k % DB_N; svg += `<rect x="${P(c) + 1}" y="${P(r) + 1}" width="${S - 2}" height="${S - 2}" rx="3" fill="${mpColor(g, g.p[o])}" opacity=".85"/><text x="${P(c) + S / 2}" y="${P(r) + S / 2 + 4}" text-anchor="middle" font-size="${S * .45}">${esc(playerEmoji(g.p[o]))}</text>`; }
    for (let e = 0; e < DB_E; e++) {
      let x1, y1, x2, y2;
      if (e < DB_H) { const r = Math.floor(e / DB_N), c = e % DB_N; [x1, y1, x2, y2] = [P(c), P(r), P(c + 1), P(r)]; } else { const k = e - DB_H, r = Math.floor(k / (DB_N + 1)), c = k % (DB_N + 1); [x1, y1, x2, y2] = [P(c), P(r), P(c), P(r + 1)]; }
      const d = drawn.get(e);
      svg += d != null ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${mpColor(g, g.p[d])}" stroke-width="2.4" stroke-linecap="round"${e === last ? ' class="db-last"' : ''}/>`
        : `<line class="db-free" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="1.1" stroke-dasharray="1.5 2.5"/>${who ? `<line class="db-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${S * .55}" data-action="mp-act" data-id="${g.id}" data-v="${e}"/>` : ''}`;
    }
    for (let r = 0; r <= DB_N; r++) for (let c = 0; c <= DB_N; c++) svg += `<circle cx="${P(c)}" cy="${P(r)}" r="1.9" class="db-dot"/>`;
    return `<div class="game-stage"><svg class="db-board${who ? ' live' : ''}" viewBox="0 0 100 100" data-noswipe>${svg}</svg></div>`;
  },
};

/* =========================================================
   2. Sea Hunt — hide your boats, take turns calling shots
   ========================================================= */
const SH_N = 8, SH_SHIPS = [4, 3, 3, 2];
function shFleet() {
  for (;;) {
    const used = new Set(), ships = [];
    let ok = true;
    for (const len of SH_SHIPS) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const h = Math.random() < .5, r = mpRand(h ? SH_N : SH_N - len + 1), c = mpRand(h ? SH_N - len + 1 : SH_N);
        const cells = [...Array(len).keys()].map((k) => (h ? r * SH_N + c + k : (r + k) * SH_N + c));
        // no touching boats (easier to read on a small screen)
        const near = cells.flatMap((i) => [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => { const y = Math.floor(i / SH_N) + dr, x = (i % SH_N) + dc; return y >= 0 && y < SH_N && x >= 0 && x < SH_N ? y * SH_N + x : -1; })));
        if (near.some((i) => used.has(i))) continue;
        cells.forEach((i) => used.add(i)); ships.push(cells); placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}
// Shots alternate: shot k is by player k % 2, at the other player's waters
const shShotsBy = (g, k) => g.shots.filter((_, i) => i % 2 === k);
function shSunk(ships, shots) { const s = new Set(shots); return ships.filter((cells) => cells.every((i) => s.has(i))); }
GX.sea = {
  short: 'Sea Hunt', sub: 'Find the boats', name: 'Sea Hunt', e: '🚢', g1: '#0369a1', g2: '#0891b2', tag: 'Find the hidden boats', max: 2, bot: true, hidden: true, botNote: 'Hunts like a pro',
  how: `Hide your ${SH_SHIPS.length} boats, then take turns calling a square in each other’s sea. Sink every boat to win!`,
  init: (p) => ({ fleet: Object.fromEntries(p.map((x) => [x, shFleet()])), ready: Object.fromEntries(p.filter((x) => x === BOT).map((x) => [x, true])), shots: [] }),
  need(g) { const notReady = g.p.filter((x) => !g.ready[x]); return notReady.length ? notReady : [g.p[g.shots.length % 2]]; },
  prompt(g, who) { return g.p.some((x) => !g.ready[x]) ? 'Hide your boats ⚓' : g.mode === 'remote' ? '👉 Your shot!' : `${playerEmoji(who)} ${playerName(who)}’s shot`; },
  scores: (g) => Object.fromEntries(g.p.map((x, k) => [x, shSunk(g.fleet[g.p[1 - k]], shShotsBy(g, k)).length])),
  status(g) {
    for (let k = 0; k < 2; k++) if (shSunk(g.fleet[g.p[1 - k]], shShotsBy(g, k)).length === SH_SHIPS.length) return { over: true, winner: g.p[k] };
    return { over: false };
  },
  act(g, who, v) {
    if (v === 'shuffle') { if (g.ready[who]) return false; g.fleet[who] = shFleet(); return; }
    if (v === 'ready') { g.ready[who] = true; return; }
    const i = Number(v), k = g.p.indexOf(who);
    if (g.p.some((x) => !g.ready[x]) || !(i >= 0 && i < SH_N * SH_N) || shShotsBy(g, k).includes(i)) return false;
    g.shots = [...g.shots, i];
    const ships = g.fleet[g.p[1 - k]], hit = ships.some((c) => c.includes(i));
    const sunkNow = hit && ships.find((c) => c.includes(i) && c.every((j) => j === i || shShotsBy(g, k).includes(j)));
    const by = who === BOT ? '🤖 ' : g.mode === 'local' ? `${playerName(who)}: ` : '';
    ui.shMsg = { id: g.id, t: Date.now(), text: by + (sunkNow ? `💥 Sunk a ${sunkNow.length}-boat!` : hit ? '🔥 Hit!' : '💦 Miss') };
  },
  bot(g) {
    if (!g.ready[BOT]) return 'ready';
    const k = g.p.indexOf(BOT), mine = shShotsBy(g, k), ships = g.fleet[g.p[1 - k]], shot = new Set(mine);
    const hits = mine.filter((i) => ships.some((c) => c.includes(i)));
    const sunk = new Set(shSunk(ships, mine).flat());
    const open = hits.filter((i) => !sunk.has(i));
    const nb = (i) => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => { const r = Math.floor(i / SH_N) + dr, c = (i % SH_N) + dc; return r >= 0 && r < SH_N && c >= 0 && c < SH_N ? r * SH_N + c : -1; }).filter((j) => j >= 0 && !shot.has(j));
    if (open.length) {
      if (open.length > 1) { // keep going along the line
        const row = open.every((i) => Math.floor(i / SH_N) === Math.floor(open[0] / SH_N));
        const line = open.flatMap(nb).filter((j) => (row ? Math.floor(j / SH_N) === Math.floor(open[0] / SH_N) : j % SH_N === open[0] % SH_N));
        if (line.length) return mpPick(line);
      }
      const n = open.flatMap(nb); if (n.length) return mpPick(n);
    }
    // don't fire next to a sunk boat (boats never touch); prefer a checkerboard
    const nearSunk = new Set([...sunk].flatMap((i) => [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => i + dr * SH_N + dc))));
    const free = [...Array(SH_N * SH_N).keys()].filter((i) => !shot.has(i) && !nearSunk.has(i));
    const even = free.filter((i) => (Math.floor(i / SH_N) + i) % 2 === 0);
    return mpPick(even.length ? even : free.length ? free : [...Array(SH_N * SH_N).keys()].filter((i) => !shot.has(i)));
  },
  view(g, who) {
    const me = g.mode === 'remote' ? actor() : who || g.p.find(mpHuman);
    const k = Math.max(0, g.p.indexOf(me)), opp = g.p[1 - k];
    const setup = g.p.some((x) => !g.ready[x]);
    const grid = (ships, shots, show, live, cls) => {
      const s = new Set(shots), sunk = new Set(shSunk(ships, shots).flat()), boat = new Set(ships.flat());
      return `<div class="sh-grid ${cls}" data-noswipe>${[...Array(SH_N * SH_N).keys()].map((i) => {
        const hit = s.has(i) && boat.has(i), miss = s.has(i) && !boat.has(i);
        const c = `sh-c${show && boat.has(i) ? ' boat' : ''}${hit ? ' hit' : ''}${miss ? ' miss' : ''}${sunk.has(i) ? ' sunk' : ''}${shots.at(-1) === i ? ' last' : ''}`;
        return live && !s.has(i) ? `<button class="${c}" data-action="mp-act" data-id="${g.id}" data-v="${i}" aria-label="Fire at ${String.fromCharCode(65 + Math.floor(i / SH_N))}${(i % SH_N) + 1}"></button>` : `<span class="${c}">${hit ? (sunk.has(i) ? '💥' : '🔥') : miss ? '•' : ''}</span>`;
      }).join('')}</div>`;
    };
    if (setup) {
      const done = g.ready[me];
      return `<div class="game-stage sh-stage">${grid(g.fleet[me], [], true, false, 'big')}</div>
        ${done ? `<p class="small muted" style="text-align:center">Your boats are hidden. Waiting for ${esc(playerName(opp))}…</p>` : who ? `<div class="btn-row"><button class="btn secondary" data-action="mp-act" data-id="${g.id}" data-v="shuffle">🔀 Move my boats</button><button class="btn" data-action="mp-act" data-id="${g.id}" data-v="ready">⚓ Hide them</button></div>` : ''}`;
    }
    const msg = ui.shMsg && ui.shMsg.id === g.id && Date.now() - ui.shMsg.t < 4000 ? `<div class="sh-msg">${esc(ui.shMsg.text)}</div>` : '';
    const left = (ships, shots) => SH_SHIPS.length - shSunk(ships, shots).length;
    return `<div class="game-stage sh-stage">${msg}${grid(g.fleet[opp], shShotsBy(g, k), !!mpStatus(g).over, !!who, 'big')}</div>
      <div class="sh-foot">${grid(g.fleet[me], shShotsBy(g, 1 - k), true, false, 'mini')}<div class="small"><b>${esc(playerName(opp))}’s sea</b> (top): ${left(g.fleet[opp], shShotsBy(g, k))} boats left<br><b>Your boats</b>: ${left(g.fleet[me], shShotsBy(g, 1 - k))} afloat<br><span class="muted">🔥 hit · 💥 sunk · • miss</span></div></div>`;
  },
};

/* =========================================================
   3. Doodle Guess — one draws, everyone guesses
   ========================================================= */
const DOODLE_WORDS = [['cat', '🐱'], ['dog', '🐶'], ['fish', '🐟'], ['house', '🏠'], ['tree', '🌳'], ['sun', '☀️'], ['moon', '🌙'], ['star', '⭐'], ['car', '🚗'], ['boat', '⛵'], ['rocket', '🚀'], ['pizza', '🍕'], ['ice cream', '🍦'], ['cake', '🎂'], ['apple', '🍎'], ['banana', '🍌'], ['flower', '🌸'], ['snowman', '⛄'], ['rainbow', '🌈'], ['umbrella', '☂️'], ['ghost', '👻'], ['robot', '🤖'], ['dragon', '🐉'], ['unicorn', '🦄'], ['spider', '🕷️'], ['snake', '🐍'], ['turtle', '🐢'], ['owl', '🦉'], ['penguin', '🐧'], ['elephant', '🐘'], ['giraffe', '🦒'], ['shark', '🦈'], ['octopus', '🐙'], ['bicycle', '🚲'], ['train', '🚂'], ['airplane', '✈️'], ['castle', '🏰'], ['crown', '👑'], ['guitar', '🎸'], ['drum', '🥁'], ['soccer ball', '⚽'], ['football', '🏈'], ['hot dog', '🌭'], ['taco', '🌮'], ['donut', '🍩'], ['cookie', '🍪'], ['glasses', '👓'], ['shoe', '👟'], ['hat', '🎩'], ['key', '🔑'], ['clock', '⏰'], ['phone', '📱'], ['book', '📖'], ['pencil', '✏️'], ['balloon', '🎈'], ['kite', '🪁'], ['tent', '⛺'], ['volcano', '🌋'], ['cloud', '☁️'], ['lightning', '⚡'], ['heart', '❤️'], ['butterfly', '🦋'], ['bee', '🐝'], ['bunny', '🐰'], ['frog', '🐸'], ['pumpkin', '🎃'], ['tooth', '🦷'], ['bed', '🛏️'], ['chair', '🪑'], ['ladder', '🪜'], ['anchor', '⚓'], ['sword', '🗡️'], ['bridge', '🌉'], ['island', '🏝️'], ['dinosaur', '🦕'], ['whale', '🐳'], ['crab', '🦀'], ['carrot', '🥕'], ['popcorn', '🍿'], ['gift', '🎁']];
const dwEmoji = (w) => (DOODLE_WORDS.find(([x]) => x === w) || [])[1] || '';
const DOODLE_INK = ['#1f2937', '#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#a855f7'];
function dgRound(by) { const o = new Set(); while (o.size < 3) o.add(mpPick(DOODLE_WORDS)[0]); return { id: uid(), by, opts: [...o], word: '', strokes: [], guesses: {} }; }
const dgGuessers = (g, R) => g.p.filter((x) => x !== R.by);
const dgDone = (R, pid) => { const gs = R.guesses[pid] || []; return gs.includes(R.word) || gs.length >= 2; };
const dgRoundOver = (g, R) => !!R.word && dgGuessers(g, R).every((x) => dgDone(R, x));
const dgCur = (g) => g.rounds.find((R) => !dgRoundOver(g, R));
GX.doodle = {
  short: 'Doodle', sub: 'Draw & guess', name: 'Doodle Guess', e: '🎨', g1: '#db2777', g2: '#f97316', tag: 'Draw it, guess it', max: 6, min: 2, bot: false, hidden: true,
  how: 'Take turns drawing a secret word. Everyone else gets two guesses. Right on the first try = 2 points, second = 1, and the artist gets a point for each person who got it.',
  init: (p) => ({ rounds: [...Array(p.length < 3 ? 4 : p.length)].map((_, k) => dgRound(p[k % p.length])) }),
  need(g) { const R = dgCur(g); return !R ? [] : !R.word ? [R.by] : dgGuessers(g, R).filter((x) => !dgDone(R, x)); },
  prompt(g, who) { const R = dgCur(g); return !R.word ? `✏️ ${g.mode === 'remote' ? 'Your turn to draw!' : `${playerName(who)}, draw!`}` : `🤔 ${g.mode === 'remote' ? 'What is it?' : `${playerName(who)}, what is it?`}`; },
  scores(g) {
    const s = Object.fromEntries(g.p.map((x) => [x, 0]));
    for (const R of g.rounds) if (R.word) for (const x of dgGuessers(g, R)) { const k = (R.guesses[x] || []).indexOf(R.word); if (k >= 0) { s[x] += 2 - k; s[R.by]++; } }
    return s;
  },
  status(g) {
    if (dgCur(g)) return { over: false };
    const s = this.scores(g), top = Math.max(...Object.values(s)), w = g.p.filter((x) => s[x] === top);
    return { over: true, winner: w.length === 1 ? w[0] : 'draw' };
  },
  act(g, who, v) {
    const R = dgCur(g);
    if (v && typeof v === 'object' && v.draw) {
      if (R.by !== who || R.word || !R.opts.includes(v.word) || !v.strokes.length) return false;
      const others = shuffle(DOODLE_WORDS.map(([w]) => w).filter((w) => w !== v.word)).slice(0, 5);
      Object.assign(R, { word: v.word, strokes: v.strokes, choices: shuffle([v.word, ...others]) });
      return;
    }
    if (!R.word || R.by === who || dgDone(R, who) || !R.choices.includes(v) || (R.guesses[who] || []).includes(v)) return false;
    R.guesses = { ...R.guesses, [who]: [...(R.guesses[who] || []), v] };
  },
  view(g, who, st) {
    const R = dgCur(g) || g.rounds.at(-1), n = g.rounds.indexOf(R) + 1, me = g.mode === 'remote' ? actor() : who;
    const head = `<div class="small muted dg-round">Round ${n} of ${g.rounds.length} · ${esc(playerEmoji(R.by))} ${esc(playerName(R.by))} ${R.word ? 'drew' : 'is drawing'}</div>`;
    if (st.over) {
      return `<div class="dg-gallery">${g.rounds.map((x, k) => `<div class="dg-card"><canvas class="dg-canvas" data-doodle="${g.id}" data-r="${k}" width="300" height="300"></canvas><b>${dwEmoji(x.word)} ${esc(x.word)}</b><small>by ${esc(playerName(x.by))}</small></div>`).join('')}</div>`;
    }
    // Drawing
    if (!R.word && who === R.by) {
      const d = ui.doodle && ui.doodle.gid === g.id && ui.doodle.rid === R.id ? ui.doodle : null;
      if (!d || !d.word) return `${head}<p style="text-align:center;margin:6px 0 10px"><b>Pick what to draw</b> <span class="small muted">(keep it secret!)</span></p><div class="dg-picks">${R.opts.map((w) => `<button class="dg-pick" data-action="dg-word" data-id="${g.id}" data-w="${esc(w)}"><span>${dwEmoji(w)}</span>${esc(w)}</button>`).join('')}</div>`;
      return `${head}<div class="dg-word">Draw: <b>${dwEmoji(d.word)} ${esc(d.word)}</b></div>
        <div class="game-stage dg-stage"><canvas class="dg-canvas live" data-doodle="${g.id}" data-draw="1" width="600" height="600" data-noswipe></canvas></div>
        <div class="dg-tools">${DOODLE_INK.map((c) => `<button class="dg-ink${d.ink === c ? ' on' : ''}" style="--c:${c}" data-action="dg-ink" data-c="${c}" aria-label="Colour"></button>`).join('')}<button class="dg-tool${d.w === 14 ? ' on' : ''}" data-action="dg-size">${d.w === 14 ? '⬤' : '•'}</button><button class="dg-tool" data-action="dg-undo" aria-label="Undo">↩️</button><button class="btn dg-send" data-action="dg-send" data-id="${g.id}" ${d.strokes.length ? '' : 'disabled'}>Send ✓</button></div>`;
    }
    if (!R.word) return `${head}<div class="game-stage dg-stage"><div class="dg-wait">✏️<br>${esc(playerName(R.by))} is drawing…</div></div>`;
    const mine = R.guesses[me] || [], done = me && me !== R.by && dgDone(R, me);
    const canvas = `<div class="game-stage dg-stage"><canvas class="dg-canvas" data-doodle="${g.id}" data-r="${g.rounds.indexOf(R)}" width="600" height="600"></canvas></div>`;
    if (who && who !== R.by) {
      return `${head}${canvas}<div class="dg-choices">${R.choices.map((w) => `<button class="dg-choice${mine.includes(w) ? ' wrong' : ''}" data-action="mp-act" data-id="${g.id}" data-v="${esc(w)}" ${mine.includes(w) ? 'disabled' : ''}>${dwEmoji(w)} ${esc(w)}</button>`).join('')}</div>${mine.length ? '<p class="small" style="text-align:center;margin:6px 0 0">Not quite — one more try!</p>' : ''}`;
    }
    const got = dgGuessers(g, R).map((x) => `${playerEmoji(x)} ${(R.guesses[x] || []).includes(R.word) ? '✅' : dgDone(R, x) ? '❌' : '…'}`).join('  ');
    return `${head}${canvas}<p style="text-align:center;margin:6px 0 0">${me === R.by || done ? `It was <b>${dwEmoji(R.word)} ${esc(R.word)}</b>${done ? (mine.includes(R.word) ? ' — you got it! 🎉' : '') : ''} · ` : ''}${esc(got)}</p>`;
  },
};
// Strokes: "colour|width|xxyy…" with x, y in 0..999 as two base-36 digits each
const dgEnc = (n) => Math.max(0, Math.min(1295, Math.round(n))).toString(36).padStart(2, '0');
function dgPaint(cv, strokes, upto = Infinity) {
  const c = cv.getContext('2d'), W = cv.width;
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, W); c.lineCap = 'round'; c.lineJoin = 'round';
  let n = 0;
  for (const s of strokes) {
    const [col, w, pts] = s.split('|');
    c.strokeStyle = col; c.lineWidth = Number(w) * W / 600;
    c.beginPath();
    for (let i = 0; i + 4 <= pts.length && n < upto; i += 4, n++) {
      const x = parseInt(pts.slice(i, i + 2), 36) * W / 1000, y = parseInt(pts.slice(i + 2, i + 4), 36) * W / 1000;
      if (i === 0) { c.moveTo(x, y); c.lineTo(x + .01, y); } else c.lineTo(x, y);
    }
    c.stroke();
  }
  return n;
}
function dgWire() {
  for (const cv of document.querySelectorAll('canvas[data-doodle]')) {
    const g = state.games.find((x) => x.id === cv.dataset.doodle); if (!g) continue;
    if (!cv.dataset.draw) {
      const R = g.rounds[Number(cv.dataset.r)], strokes = R?.strokes || [];
      const total = strokes.reduce((a, s) => a + (s.split('|')[2].length / 4), 0), key = g.id + R?.id;
      if (cv.width > 300 && ui.dgShown !== key && !matchMedia('(prefers-reduced-motion: reduce)').matches) { // replay it being drawn
        ui.dgShown = key; let k = 0; const step = Math.max(4, total / 60);
        const tick = () => { k += step; dgPaint(cv, strokes, k); if (k < total && cv.isConnected) requestAnimationFrame(tick); };
        tick();
      } else dgPaint(cv, strokes);
      continue;
    }
    const d = ui.doodle; dgPaint(cv, d.strokes);
    const pt = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * 1000, (e.clientY - b.top) / b.height * 1000]; };
    let cur = null, lx = 0, ly = 0;
    const used = () => d.strokes.reduce((a, s) => a + (s.split('|')[2].length / 4), 0);
    cv.onpointerdown = (e) => {
      if (used() > 2400) { toast('That’s plenty of ink — send it!'); return; }
      cv.setPointerCapture(e.pointerId); e.preventDefault();
      [lx, ly] = pt(e); cur = `${d.ink}|${d.w}|${dgEnc(lx)}${dgEnc(ly)}`; d.strokes.push(cur);
      dgPaint(cv, d.strokes);
    };
    cv.onpointermove = (e) => {
      if (!cur) return;
      const [x, y] = pt(e);
      if (Math.hypot(x - lx, y - ly) < 7) return;
      lx = x; ly = y; cur += dgEnc(x) + dgEnc(y); d.strokes[d.strokes.length - 1] = cur;
      dgPaint(cv, d.strokes);
    };
    cv.onpointerup = cv.onpointercancel = () => { if (!cur) return; cur = null; document.querySelector('[data-action="dg-send"]')?.removeAttribute('disabled'); };
  }
}

/* =========================================================
   4. Five Dice — roll up to 3 times, fill your score sheet
   ========================================================= */
const FD_CATS = [['1', 'Ones', '⚀'], ['2', 'Twos', '⚁'], ['3', 'Threes', '⚂'], ['4', 'Fours', '⚃'], ['5', 'Fives', '⚄'], ['6', 'Sixes', '⚅'], ['3k', '3 of a kind'], ['4k', '4 of a kind'], ['fh', 'Full house'], ['ss', 'Small straight'], ['ls', 'Big straight'], ['5k', 'Five dice! 🎉'], ['ch', 'Chance']];
const FD_UPPER = ['1', '2', '3', '4', '5', '6'];
const FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function fdScore(cat, d) {
  const cnt = [0, 0, 0, 0, 0, 0, 0]; d.forEach((x) => cnt[x]++);
  const tot = d.reduce((a, b) => a + b, 0), mx = Math.max(...cnt), has = (s) => s.every((x) => cnt[x]);
  switch (cat) {
    case '3k': return mx >= 3 ? tot : 0;
    case '4k': return mx >= 4 ? tot : 0;
    case 'fh': return (cnt.includes(3) && cnt.includes(2)) || mx === 5 ? 25 : 0;
    case 'ss': return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case 'ls': return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case '5k': return mx === 5 ? 50 : 0;
    case 'ch': return tot;
    default: return cnt[Number(cat)] * Number(cat);
  }
}
const fdUpper = (card) => FD_UPPER.reduce((a, k) => a + (card[k] || 0), 0);
const fdTotal = (card) => Object.values(card).reduce((a, b) => a + b, 0) + (fdUpper(card) >= 63 ? 35 : 0);
const fdFilled = (g) => g.p.reduce((a, x) => a + Object.keys(g.cards[x] || {}).length, 0);
const fdTurn = (g) => g.p[fdFilled(g) % g.p.length];
GX.dice = {
  short: 'Five Dice', sub: 'Roll & score', name: 'Five Dice', e: '🎲', g1: '#16a34a', g2: '#0d9488', tag: '1–6 players', max: 6, bot: true, botDelay: 650, botNote: 'Plays the odds',
  how: 'On your turn roll five dice up to three times — tap dice to keep them between rolls — then score them in one empty box. Top section 63+ earns a 35 bonus. Highest total wins!',
  init: (p) => ({ cards: Object.fromEntries(p.map((x) => [x, {}])), cur: null }),
  need: (g) => [fdTurn(g)],
  prompt(g, who) { const c = g.cur && g.cur.who === who ? g.cur : null; const r = c ? 3 - c.rolls : 3; return `${g.mode === 'remote' ? '👉 Your turn' : `${playerEmoji(who)} ${playerName(who)}`} · ${r ? `${r} roll${r > 1 ? 's' : ''} left` : 'pick a box'}`; },
  scores: (g) => Object.fromEntries(g.p.map((x) => [x, fdTotal(g.cards[x] || {})])),
  status(g) {
    if (fdFilled(g) < FD_CATS.length * g.p.length) return { over: false };
    const s = this.scores(g), top = Math.max(...Object.values(s)), w = g.p.filter((x) => s[x] === top);
    return { over: true, winner: w.length === 1 ? w[0] : 'draw' };
  },
  act(g, who, v) {
    let c = g.cur && g.cur.who === who ? g.cur : null;
    if (v === 'roll') {
      if (c && c.rolls >= 3) return false;
      if (!c) c = { who, dice: [1, 1, 1, 1, 1], held: [0, 0, 0, 0, 0], rolls: 0 };
      g.cur = { ...c, dice: c.dice.map((x, i) => (c.held[i] && c.rolls ? x : 1 + mpRand(6))), rolls: c.rolls + 1 };
      ui.fdRolled = Date.now();
      return;
    }
    if (typeof v === 'string' && v.startsWith('hold:')) { if (!c || !c.rolls || c.rolls >= 3) return false; const i = Number(v.slice(5)); g.cur = { ...c, held: c.held.map((h, k) => (k === i ? 1 - h : h)) }; return; }
    if (typeof v === 'string' && v.startsWith('score:')) {
      const cat = v.slice(6), card = g.cards[who] || {};
      if (!c || !c.rolls || cat in card || !FD_CATS.some(([k]) => k === cat)) return false;
      g.cards = { ...g.cards, [who]: { ...card, [cat]: fdScore(cat, c.dice) } };
      g.cur = null;
      ui.fdLast = { g: g.id, who, cat, pts: fdScore(cat, c.dice), t: Date.now() };
      setTimeout(() => { if (currentRoute().param === g.id) render(); }, 4100);
      return;
    }
    return false;
  },
  bot(g) {
    const c = g.cur && g.cur.who === BOT ? g.cur : null, card = g.cards[BOT] || {};
    if (!c || !c.rolls) return 'roll';
    const open = FD_CATS.map(([k]) => k).filter((k) => !(k in card));
    const val = (k) => { const s = fdScore(k, c.dice); return k === 'ch' ? s * .55 : FD_UPPER.includes(k) ? s * 1.5 : k === '3k' || k === '4k' ? s * .9 : s; };
    const best = open.reduce((a, k) => (val(k) > val(a) ? k : a), open[0]);
    const great = ['5k', 'ls', 'fh'].includes(best) && fdScore(best, c.dice) > 0;
    if (c.rolls < 3 && !great) {
      // which dice to keep: a straight run if close, else the most common value
      const cnt = [0, 0, 0, 0, 0, 0, 0]; c.dice.forEach((x) => cnt[x]++);
      let want;
      const runs = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]].map((s) => s.filter((x) => cnt[x]));
      const run = runs.reduce((a, s) => (s.length > a.length ? s : a), []);
      if (run.length >= 3 && (!('ls' in card) || !('ss' in card)) && Math.max(...cnt) < 3) { const keep = new Set(run); want = c.dice.map((x) => (keep.has(x) ? (keep.delete(x), 1) : 0)); }
      else { const top = cnt.indexOf(Math.max(...cnt.slice(1)), 1); want = c.dice.map((x) => (x === top ? 1 : 0)); }
      const i = want.findIndex((h, k) => h !== c.held[k]);
      return i >= 0 ? 'hold:' + i : 'roll';
    }
    if (val(best) > 0) return 'score:' + best;
    const scratch = ['1', '5k', '2', '4k', 'ls', '3', 'ss', 'fh', '3k', '4', '5', '6', 'ch'].find((k) => open.includes(k));
    return 'score:' + scratch;
  },
  view(g, who) {
    const t = fdTurn(g), c = g.cur && g.cur.who === t ? g.cur : null, live = !!who && who === t;
    const rolled = Date.now() - (ui.fdRolled || 0) < 600;
    const L = ui.fdLast && ui.fdLast.g === g.id && Date.now() - ui.fdLast.t < 4000 ? ui.fdLast : null;
    const lastNote = L ? `<div class="fd-last">${esc(playerEmoji(L.who))} ${esc(playerName(L.who))} scored <b>${L.pts}</b> in ${esc(FD_CATS.find(([k]) => k === L.cat)[1])}${L.pts ? '' : ' (scratched)'} · ${esc(playerName(t))}’s turn</div>` : '';
    const dice = (c ? c.dice : [1, 2, 3, 4, 5]).map((x, i) => {
      const held = c && c.held[i] && c.rolls;
      const can = live && c && c.rolls && c.rolls < 3;
      return `<button class="fd-die${held ? ' held' : ''}${c ? '' : ' idle'}${rolled && !held ? ' roll' : ''}" ${can ? `data-action="mp-act" data-id="${g.id}" data-v="hold:${i}"` : 'disabled'} aria-label="Die ${x}${held ? ', kept' : ''}">${pipFace(x)}</button>`;
    }).join('');
    const cols = g.p.length > 3 ? ' tight' : '';
    const rows = FD_CATS.map(([k, label, f], ri) => {
      const cells = g.p.map((pid) => {
        const card = g.cards[pid] || {};
        if (k in card) return `<td class="${pid === t ? 'cur' : ''}">${card[k]}</td>`;
        if (live && pid === who && c && c.rolls) { const s = fdScore(k, c.dice); return `<td class="cur"><button class="fd-pick${s ? '' : ' zero'}" data-action="mp-act" data-id="${g.id}" data-v="score:${k}">${s}</button></td>`; }
        return `<td class="${pid === t ? 'cur' : ''}"></td>`;
      }).join('');
      return `${ri === 6 ? `<tr class="fd-sub"><th>Bonus <small>(63+ on top)</small></th>${g.p.map((pid) => `<td>${fdUpper(g.cards[pid] || {}) >= 63 ? 35 : `<small>${fdUpper(g.cards[pid] || {})}/63</small>`}</td>`).join('')}</tr>` : ''}<tr><th>${f ? `<span class="fd-f">${f}</span> ` : ''}${esc(label)}</th>${cells}</tr>`;
    }).join('');
    return `${lastNote}<div class="fd-dice" data-noswipe>${dice}</div>
      ${live ? (c && c.rolls >= 3 ? `<div class="fd-pickhint">👇 Out of rolls — tap a <b>highlighted box</b> to score your turn</div>`
        : `<div class="fd-roll"><button class="btn" data-action="mp-act" data-id="${g.id}" data-v="roll">🎲 ${c && c.rolls ? `Roll again (${3 - c.rolls} left)` : 'Roll'}</button>${c && c.rolls ? '<span class="small muted">Tap dice to keep them · or tap a highlighted box to score now</span>' : ''}</div>`) : ''}
      <div class="game-stage fd-stage"><table class="fd-sheet${cols}"><thead><tr><th></th>${g.p.map((pid) => `<th class="${pid === t ? 'cur' : ''}" style="--c:${mpColor(g, pid)}">${esc(playerEmoji(pid))}</th>`).join('')}</tr></thead><tbody>${rows}<tr class="fd-tot"><th>Total</th>${g.p.map((pid) => `<td>${fdTotal(g.cards[pid] || {})}</td>`).join('')}</tr></tbody></table></div>`;
  },
};
// Dice faces drawn with dots (no font needed)
function pipFace(n) {
  const P = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n] || [];
  return `<span class="pips">${[...Array(9).keys()].map((i) => `<i${P.includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;
}

/* =========================================================
   5. Checkers — jumps are a must, reach the far side to be crowned
   ========================================================= */
const CK = 8;
const ckDark = (i) => (Math.floor(i / CK) + (i % CK)) % 2 === 1;
function ckStart() { const b = Array(64).fill(null); for (let i = 0; i < 64; i++) if (ckDark(i)) { const r = Math.floor(i / CK); if (r < 3) b[i] = { o: 1, k: 0 }; else if (r > 4) b[i] = { o: 0, k: 0 }; } return b; }
const ckDirs = (pc) => (pc.k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : pc.o === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const ckAt = (r, c) => (r >= 0 && r < CK && c >= 0 && c < CK ? r * CK + c : -1);
const ckCrownRow = (o) => (o === 0 ? 0 : CK - 1);
function ckJumps(b, from, pc, taken) {
  const out = [], r = Math.floor(from / CK), c = from % CK;
  for (const [dr, dc] of ckDirs(pc)) {
    const mid = ckAt(r + dr, c + dc), to = ckAt(r + 2 * dr, c + 2 * dc);
    if (mid < 0 || to < 0 || b[to] || !b[mid] || b[mid].o === pc.o || taken.includes(mid)) continue;
    const crowned = !pc.k && Math.floor(to / CK) === ckCrownRow(pc.o);
    const nb = b.slice(); nb[to] = pc; nb[from] = null;
    const more = crowned ? [] : ckJumps(nb, to, pc, [...taken, mid]);
    if (more.length) for (const m of more) out.push([to, ...m]); else out.push([to]);
  }
  return out;
}
function ckLegal(b, o) {
  const jumps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    const pc = b[i]; if (!pc || pc.o !== o) continue;
    for (const j of ckJumps(b, i, pc, [])) jumps.push([i, ...j]);
    const r = Math.floor(i / CK), c = i % CK;
    for (const [dr, dc] of ckDirs(pc)) { const to = ckAt(r + dr, c + dc); if (to >= 0 && !b[to]) steps.push([i, to]); }
  }
  return jumps.length ? jumps : steps;
}
function ckApply(b, path) {
  const nb = b.slice(), pc = { ...nb[path[0]] };
  let caps = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], z = path[k];
    if (Math.abs(Math.floor(z / CK) - Math.floor(a / CK)) === 2) { nb[(a + z) / 2] = null; caps++; }
  }
  nb[path[0]] = null;
  if (Math.floor(path.at(-1) / CK) === ckCrownRow(pc.o)) pc.k = 1;
  nb[path.at(-1)] = pc;
  return { b: nb, caps };
}
function ckBoard(g) { let b = ckStart(), quiet = 0; for (const m of g.moves) { const r = ckApply(b, m); b = r.b; quiet = r.caps ? 0 : quiet + 1; } return { b, quiet }; }
GX.checkers = {
  short: 'Checkers', sub: 'The classic', name: 'Checkers', e: '⚫', g1: '#7f1d1d', g2: '#b45309', tag: 'The classic', max: 2, bot: true, botNote: 'Likes a good jump',
  how: 'Move diagonally forward one square. Jump over a piece to capture it — if you can jump, you must. Reach the far side to become a king 👑 that moves both ways.',
  init: () => ({ moves: [] }),
  need: (g) => [g.p[g.moves.length % 2]],
  scores: (g) => { const { b } = ckBoard(g); return Object.fromEntries(g.p.map((x, k) => [x, 12 - b.filter((pc) => pc && pc.o !== k).length])); },
  status(g) {
    const { b, quiet } = ckBoard(g), o = g.moves.length % 2;
    if (!ckLegal(b, o).length) return { over: true, winner: g.p[1 - o] };
    if (quiet >= 80) return { over: true, winner: 'draw' };
    return { over: false };
  },
  act(g, who, v) {
    const path = String(v).split('-').map(Number), { b } = ckBoard(g), o = g.p.indexOf(who);
    if (o !== g.moves.length % 2 || !ckLegal(b, o).some((m) => m.join('-') === path.join('-'))) return false;
    g.moves = [...g.moves, path];
    ui.ck = null;
  },
  bot(g) {
    const { b } = ckBoard(g), o = g.moves.length % 2, legal = ckLegal(b, o);
    const rate = (m) => {
      const { b: nb, caps } = ckApply(b, m), to = m.at(-1);
      let s = caps * 10 + Math.random() * 2;
      if (!b[m[0]].k && nb[to].k) s += 6;
      if (ckLegal(nb, 1 - o).some((x) => x.length > 1 && x.some((sq, k) => k && Math.abs(Math.floor(sq / CK) - Math.floor(x[k - 1] / CK)) === 2 && (sq + x[k - 1]) / 2 === to))) s -= 9; // walks into a jump
      if (!b[m[0]].k) s += (o === 0 ? Math.floor(m[0] / CK) - Math.floor(to / CK) : Math.floor(to / CK) - Math.floor(m[0] / CK)) * .3;
      if (to % CK === 0 || to % CK === CK - 1) s += .8; // edges are safe
      return s;
    };
    return legal.reduce((a, m) => (rate(m) > rate(a) ? m : a), legal[0]).join('-');
  },
  view(g, who) {
    const { b } = ckBoard(g), o = g.moves.length % 2, me = g.mode === 'remote' ? actor() : who;
    const flip = g.p.indexOf(me) === 1 || (g.mode !== 'remote' && who && g.p.indexOf(who) === 1 && g.p.every(mpHuman));
    const legal = who ? ckLegal(b, o) : [], sel = ui.ck && ui.ck.gid === g.id ? ui.ck.path : [];
    const nexts = new Set(sel.length ? legal.filter((m) => sel.every((x, k) => m[k] === x) && m.length > sel.length).map((m) => m[sel.length]) : []);
    const movable = new Set(legal.map((m) => m[0]));
    const last = g.moves.at(-1) || [];
    const order = [...Array(64).keys()]; if (flip) order.reverse();
    const cells = order.map((i) => {
      const pc = b[i], dark = ckDark(i);
      const cls = `ck-sq${dark ? ' dark' : ''}${last.includes(i) ? ' last' : ''}${sel.includes(i) ? ' sel' : ''}${nexts.has(i) ? ' next' : ''}${!sel.length && movable.has(i) ? ' can' : ''}`;
      const piece = pc ? `<span class="ck-pc p${pc.o}${pc.k ? ' king' : ''}" style="--c:${mpColor(g, g.p[pc.o])}">${pc.k ? '👑' : ''}</span>` : '';
      const tap = who && dark && (nexts.has(i) || movable.has(i) || sel[0] === i);
      return tap ? `<button class="${cls}" data-action="ck-tap" data-id="${g.id}" data-i="${i}">${piece}</button>` : `<span class="${cls}">${piece}</span>`;
    }).join('');
    const must = !!who && !!legal.length && Math.abs(Math.floor(legal[0][1] / CK) - Math.floor(legal[0][0] / CK)) === 2;
    return `<div class="game-stage"><div class="ck-board" data-noswipe>${cells}</div></div>${who && must ? '<p class="small" style="text-align:center;margin:6px 0 0">You have a jump — you must take it!</p>' : ''}`;
  },
};

/* ---------- Wiring ---------- */
Object.assign(actions, {
  'mp-new': (el) => mpNewSheet(el.dataset.t),
  'mp-quick': (el) => {
    const t = el.dataset.t, opp = el.dataset.opp, synced = typeof Sync !== 'undefined' && !!Sync.ref;
    closeSheet();
    setTimeout(() => mpNew(t, [actor() || state.members[0]?.id, opp], opp === BOT ? 'bot' : opp === P2 || !synced ? 'local' : 'remote'));
  },
  'mp-sel': (el) => { const s = ui.mpSel; s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.size < GX[s.type].max - 1 && s.add(el.dataset.id); el.classList.toggle('on', s.has(el.dataset.id)); },
  'mp-start': (el) => {
    const t = el.dataset.t, X = GX[t], s = [...(ui.mpSel || [])];
    const humans = s.filter(mpHuman);
    if (!X.bot && humans.length < 1) { toast('Pick at least one more player'); return; }
    if (X.min && s.length + 1 < X.min) { toast(`${X.name} needs at least ${X.min} players`); return; }
    if (!s.length && t !== 'dice') { toast('Pick who’s playing'); return; }
    closeSheet();
    ui.mpSel = null;
    setTimeout(() => mpNew(t, [actor() || state.members[0]?.id, ...s], humans.length ? (el.dataset.mode === 'remote' ? 'remote' : 'local') : 'bot'));
  },
  'mp-act': (el) => { const g = findIn(state.games, el.dataset.id); const who = g && mpActor(g); if (who) mpDo(g, who, el.dataset.v); },
  'mp-ready': (el) => { (ui.mpPass ||= {})[el.dataset.id] = el.dataset.who; render(); },
  'mp-rematch': (el) => {
    const g = findIn(state.games, el.dataset.id);
    const p = g.p.length === 2 && g.p.every((x) => x !== BOT && x !== P2) ? [g.p[1], g.p[0]] : g.p; // the other player goes first next time
    mpNew(g.type, p, g.mode);
  },
  'mp-del': (el) => { state.games = state.games.filter((x) => x.id !== el.dataset.id); save(); go('games'); },
  'dg-word': (el) => { ui.doodle = { gid: el.dataset.id, rid: dgCur(findIn(state.games, el.dataset.id)).id, word: el.dataset.w, strokes: [], ink: DOODLE_INK[0], w: 7 }; render(); },
  'dg-ink': (el) => { ui.doodle.ink = el.dataset.c; render(); },
  'dg-size': () => { ui.doodle.w = ui.doodle.w === 14 ? 7 : 14; render(); },
  'dg-undo': () => { ui.doodle.strokes.pop(); render(); },
  'dg-send': (el) => {
    const g = findIn(state.games, el.dataset.id), d = ui.doodle, who = mpActor(g);
    if (!d || !d.strokes.length || !who) return;
    if (mpDo(g, who, { draw: true, word: d.word, strokes: d.strokes.slice() })) { ui.doodle = null; toast('Sent! 🎨'); render(); }
  },
  'ck-tap': (el) => {
    const g = findIn(state.games, el.dataset.id), i = Number(el.dataset.i), who = mpActor(g);
    if (!who) return;
    const { b } = ckBoard(g), legal = ckLegal(b, g.moves.length % 2);
    let path = ui.ck && ui.ck.gid === g.id ? ui.ck.path : [];
    if (path.length && path[0] === i && path.length === 1) { ui.ck = null; render(); return; } // tap again: put it down
    const ext = [...path, i];
    if (path.length && legal.some((m) => ext.every((x, k) => m[k] === x))) path = ext;
    else if (legal.some((m) => m[0] === i)) path = [i];
    else return;
    const done = legal.find((m) => m.join('-') === path.join('-'));
    if (done && !legal.some((m) => m.length > path.length && path.every((x, k) => m[k] === x))) { ui.ck = null; mpDo(g, who, done.join('-')); return; }
    ui.ck = { gid: g.id, path }; gBuzz(); render();
  },
});
KID_ROUTES.push('mp');
for (const a of ['mp-new', 'mp-quick', 'mp-sel', 'mp-start', 'mp-act', 'mp-ready', 'mp-rematch', 'mp-del', 'dg-word', 'dg-ink', 'dg-size', 'dg-undo', 'dg-send', 'ck-tap']) KID_ACTIONS.add(a);
if (typeof PG_SKIP !== 'undefined') PG_SKIP.add('mp');
if (typeof HUB_OF !== 'undefined') HUB_OF.mp = 'play';

// Full-screen game mode while a game is on; the robot and drawings come alive after each render
const _modeArcade = modeClasses;
modeClasses = function () {
  _modeArcade();
  const { name, param } = currentRoute();
  if (name === 'mp') { const g = state.games.find((x) => x.id === param); document.body.classList.toggle('game-mode', !!g && !!GX[g.type] && !(g.type === 'doodle' && mpStatus(g).over)); } // stays full-screen after the end, like Connect Four (the doodle gallery scrolls)
};
const _afterRenderArcade = afterRender;
afterRender = function () {
  _afterRenderArcade();
  const { name, param } = currentRoute();
  if (name !== 'mp') return;
  const g = state.games.find((x) => x.id === param);
  if (!g || !GX[g.type]) return;
  if (g.type === 'doodle') dgWire();
  if (g.type === 'sea' && ui.shMsg) { const t = ui.shMsg.t; setTimeout(() => { if (ui.shMsg && ui.shMsg.t === t && currentRoute().name === 'mp') { ui.shMsg = null; render(); } }, 2600); }
  if (mpNeed(g).includes(BOT)) mpBotSoon(g);
};

// Notifications: a new game is an invite, a move that hands someone their turn tells them, the end tells everyone
const _familyEventsArcade = familyEvents;
familyEvents = function (before, after, me) {
  const ev = _familyEventsArcade(before, after, me), me_ = np.name(me);
  const bg = new Map((before.games || []).map((g) => [g.id, g]));
  for (const g of after.games || []) {
    if (!GX[g.type] || g.mode !== 'remote' || !g.p.includes(me)) continue;
    const old = bg.get(g.id), X = GX[g.type], others = g.p.filter((x) => x !== me && isMember(x));
    if (old && same(old, g)) continue;
    let st, need, was;
    try { st = X.status(g); need = st.over ? [] : X.need(g); was = old ? (X.status(old).over ? [] : X.need(old)) : []; } catch { continue; }
    if (st.over) {
      if (old && !X.status(old).over) ev.push({ pref: 'games', to: others, title: X.endText ? `${X.e} ${X.endText(g)}` : g.winner === 'draw' ? `🤝 ${X.name} ended in a tie` : `🏁 ${playerName(g.winner)} won ${X.name}`, body: 'Play again?', url: '#mp/' + g.id, tag: 'mp-' + g.id });
      continue;
    }
    const to = !old ? others : need.filter((x) => x !== me && isMember(x) && !was.includes(x)); // a new game invites everyone
    if (!to.length) continue;
    const R = g.type === 'doodle' ? dgCur(g) : null;
    const title = !old ? `${X.e} ${me_} invited you to ${X.name}` : R && R.word && R.by === me ? `🎨 ${me_} drew something — guess it!` : R && !R.word ? `✏️ Your turn to draw in Doodle Guess` : `${X.e} Your turn in ${X.name}`;
    ev.push({ pref: 'games', to, title, body: !old ? 'Tap to play' : `vs ${me_}`, url: '#mp/' + g.id, tag: 'mp-' + g.id });
  }
  return ev;
};
// Play tab tiles
function arcadeLaunch() {
  const me = actor();
  return ARCADE.map((t) => {
    const X = GX[t], turn = me ? mpGames().filter((g) => g.type === t && g.mode === 'remote' && mpNeed(g).includes(me)).length : 0;
    return { act: 'mp-new', attrs: `data-t="${t}"`, e: X.e, art: 'g_' + t, label: X.short || X.name, sub: turn ? 'Your turn!' : esc(X.sub || X.tag), color: X.g1, badge: turn || '' };
  });
}
