/* Games: a family Game Center with Connect Four (take turns from your own phones, pass-and-play or vs. the robot),
   Family Word (one shared daily puzzle), Memory Match and "How well do you know us?" trivia. Loaded after together.js. */
'use strict';

Object.assign(TITLES, { games: 'Games', c4: 'Connect Four', word: 'Family Word', memory: 'Memory Match', trivia: 'Family Trivia' });
const BOT = 'bot';
const playerName = (id) => (id === BOT ? 'Robot' : whoName(id));
const playerEmoji = (id) => (id === BOT ? '🤖' : isMember(id) ? member(id).emoji : '👤');
const thisMonth = (at) => monthKey(iso(new Date(at))) === monthKey(today());

/* =========================================================
   Connect Four
   ========================================================= */
const C4_ROWS = 6, C4_COLS = 7;
function c4Grid(moves) {
  const g = [...Array(C4_COLS)].map(() => []);
  moves.forEach((c, i) => g[c].push(i % 2));
  return g; // g[col][row from bottom] = 0 (red) | 1 (yellow)
}
function c4Winner(g) {
  const at = (c, r) => (c >= 0 && c < C4_COLS && r >= 0 && r < C4_ROWS ? g[c][r] : undefined);
  for (let c = 0; c < C4_COLS; c++) for (let r = 0; r < C4_ROWS; r++) {
    const p = at(c, r);
    if (p === undefined) continue;
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const line = [0, 1, 2, 3].map((k) => [c + dc * k, r + dr * k]);
      if (line.every(([x, y]) => at(x, y) === p)) return { p, line };
    }
  }
  return null;
}
const c4Turn = (g) => (g.moves.length % 2 ? g.b : g.a);
function c4Status(g) {
  const w = c4Winner(c4Grid(g.moves));
  if (w) return { over: true, winner: w.p ? g.b : g.a, line: w.line };
  if (g.moves.length >= C4_ROWS * C4_COLS) return { over: true, draw: true };
  return { over: false, turn: c4Turn(g) };
}
const c4Games = () => state.games.filter((g) => g.type === 'c4');
function myTurnGames() {
  const me = actor();
  if (!me) return [];
  return c4Games().filter((g) => g.mode === 'remote' && !c4Status(g).over && c4Turn(g) === me);
}
function c4CanMove(g) {
  const st = c4Status(g);
  if (st.over) return false;
  if (g.mode === 'local') return true;
  if (g.mode === 'bot') return st.turn !== BOT;
  return st.turn === actor();
}
function botMove(g) {
  const legal = [3, 2, 4, 1, 5, 0, 6].filter((c) => c4Grid(g.moves)[c].length < C4_ROWS);
  const wins = (moves) => !!c4Winner(c4Grid(moves));
  for (const c of legal) if (wins([...g.moves, c])) return c; // win now
  // block: would the opponent win by playing here?
  for (const c of legal) { const m = [...g.moves]; const grid = c4Grid(m); grid[c].push(g.moves.length % 2 ? 0 : 1); if (c4Winner(grid)) return c; }
  // avoid giving the opponent a winning reply
  const safe = legal.filter((c) => { const m = [...g.moves, c]; return !legal.some((d) => c4Grid(m)[d].length < C4_ROWS && wins([...m, d])); });
  const pool = safe.length ? safe : legal;
  return Math.random() < 0.7 ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
}
function c4Card(g) {
  const st = c4Status(g), me = actor();
  const vs = g.a === me ? g.b : g.b === me ? g.a : null;
  const label = vs ? `vs ${playerEmoji(vs)} ${playerName(vs)}` : `${playerEmoji(g.a)} ${playerName(g.a)} vs ${playerEmoji(g.b)} ${playerName(g.b)}`;
  const sub = st.over ? (st.draw ? 'Draw' : `${playerName(st.winner)} won 🏆`) : g.mode === 'remote' ? (st.turn === me ? '🔴 Your turn!' : `Waiting for ${playerName(st.turn)}…`) : g.mode === 'bot' ? 'vs the robot' : 'Pass-and-play';
  return `<button class="row tap" style="width:100%;text-align:left" data-action="go" data-to="c4/${g.id}"><div class="avatar">🔴</div><div class="grow"><div class="title">${esc(label)}</div><div class="sub">${esc(sub)} · ${g.moves.length} moves</div></div>${!st.over && g.mode === 'remote' && st.turn === me ? '<span class="dot-new"></span>' : ICON.chev}</button>`;
}
views.c4 = (id) => {
  const g = state.games.find((x) => x.id === id);
  if (!g) return '<div class="card empty">This game was deleted.<br><button class="btn" style="margin-top:12px" data-action="go" data-to="games">Back to games</button></div>';
  const st = c4Status(g), grid = c4Grid(g.moves), me = actor();
  const can = c4CanMove(g);
  const lastCol = g.moves.at(-1), lastRow = lastCol != null ? grid[lastCol].length - 1 : -1;
  const winSet = new Set((st.line || []).map(([c, r]) => `${c},${r}`));
  const status = st.over ? (st.draw ? '🤝 It’s a draw!' : `🏆 ${playerEmoji(st.winner)} ${playerName(st.winner)} wins!`)
    : g.mode === 'remote' ? (st.turn === me ? '👉 Your turn!' : `⏳ Waiting for ${playerName(st.turn)}…`)
    : `${playerEmoji(st.turn)} ${playerName(st.turn)}’s turn`;
  const player = (pid, cls) => `<div class="c4-player ${cls}${!st.over && st.turn === pid ? ' turn' : ''}"><span class="disc ${cls}"></span><b>${esc(playerEmoji(pid))} ${esc(playerName(pid))}</b></div>`;
  return `<div class="c4-players">${player(g.a, 'red')}<span class="small muted">vs</span>${player(g.b, 'yellow')}</div>
    <div class="c4-status${st.over ? ' over' : ''}">${esc(status)}</div>
    <div class="game-stage"><div class="c4-board${can ? ' live' : ''}">${[...Array(C4_COLS)].map((_, c) => `<button class="c4-col" data-action="c4-drop" data-id="${g.id}" data-c="${c}" ${can && grid[c].length < C4_ROWS ? '' : 'disabled'} aria-label="Column ${c + 1}">
      ${[...Array(C4_ROWS)].map((_, k) => { const r = C4_ROWS - 1 - k; const p = grid[c][r]; return `<span class="c4-cell">${p !== undefined ? `<span class="disc ${p ? 'yellow' : 'red'}${c === lastCol && r === lastRow ? ' drop' : ''}${winSet.has(`${c},${r}`) ? ' win' : ''}" style="--fall:${k + 1}"></span>` : ''}</span>`; }).join('')}
    </button>`).join('')}</div></div>
    ${g.mode === 'remote' && !st.over ? `<p class="small muted" style="text-align:center;margin:10px 0">${st.turn === me ? 'Tap a column to drop your piece.' : `${playerName(st.turn)} plays on their phone — you’ll get a 🔔 when it’s your turn.`}</p>` : ''}
    <div class="btn-row">${st.over ? `<button class="btn" data-action="c4-rematch" data-id="${g.id}">🔁 Rematch</button>` : g.mode !== 'remote' && g.moves.length ? `<button class="btn secondary" data-action="c4-undo" data-id="${g.id}">↩️ Undo</button>` : ''}<button class="btn secondary" data-action="c4-del" data-id="${g.id}">${st.over ? 'Remove' : 'Quit game'}</button></div>`;
};
function c4New(opp, mode) {
  const me = actor();
  const g = { id: uid(), type: 'c4', a: me, b: opp, mode, moves: [], at: Date.now() };
  state.games.push(g);
  save();
  go('c4/' + g.id);
}
function c4NewSheet() {
  const me = actor();
  const others = state.members.filter((m) => m.id !== me);
  if (!me && state.members.length > 1) { toast('Pick who you are first'); return; }
  openSheet({
    title: '🔴 New Connect Four',
    saveLabel: 'Play',
    values: { opp: BOT, mode: 'remote' },
    fields: [
      { name: 'opp', label: 'Play against', type: 'select', options: [{ value: BOT, label: '🤖 The robot' }, ...others.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` }))] },
      { name: 'mode', label: 'How?', type: 'select', options: [{ value: 'remote', label: '📱 Each on our own phone — take turns' }, { value: 'local', label: '🤝 Pass this phone back and forth' }], hint: 'Own-phone games need family sync turned on' },
    ],
    onSave(v) { setTimeout(() => c4New(v.opp, v.opp === BOT ? 'bot' : v.mode)); },
  });
}
function c4Finish(g) {
  const st = c4Status(g);
  if (!st.over || g.endAt) return;
  g.endAt = Date.now();
  g.winner = st.draw ? 'draw' : st.winner;
  if (!st.draw) {
    const loser = st.winner === g.a ? g.b : g.a;
    logAct('🔴', `${st.winner === actor() ? 'won' : 'played'} Connect Four ${st.winner === actor() ? `vs ${playerName(loser)}` : `— ${playerName(st.winner)} won`}`, 'games');
    if (st.winner !== BOT) setTimeout(() => { confetti(); }, 500);
  }
}

/* =========================================================
   Family Word (daily puzzle — the same word for everyone)
   ========================================================= */
const WORDS5 = ('APPLE BEACH BREAD CANDY CHAIR CLOUD DANCE DREAM EARTH FAIRY FEAST FIELD FLAME FRUIT GHOST GIANT GRAPE GRASS HAPPY HEART HONEY HORSE HOUSE JELLY JUICE LEMON LIGHT LUCKY MAGIC MANGO MONEY MOUSE MUSIC NIGHT OCEAN OTTER PAINT PARTY PEACH PIANO PIZZA PLANT PLATE QUEEN QUIET RIVER ROBOT SALAD SHARK SHEEP SHELL SMILE SNACK SNAIL SNAKE SPACE SPOON STORM SUNNY SWEET TABLE TIGER TOAST TRAIN TRUCK WATER WHALE WORLD ZEBRA BEARD BLAZE BRAVE BRUSH CAMEL CHALK CHEER CHESS CLOCK COAST CRANE CROWN DAISY DRUMS EAGLE FROST GLOBE GUEST HIPPO IGLOO JOKER KOALA LLAMA LEMUR MAPLE MOOSE NURSE OASIS ONION PANDA PEARL PENNY PUPPY RADIO RAVEN SAUCE SCARF SKATE SLIDE SLOTH SPICE SQUID STAMP STARS STICK STONE SUGAR SWING TEETH THUMB TOWEL TOWER TULIP UNCLE VOICE WAGON WHEEL WITCH YACHT BACON BAGEL BERRY BLOCK BOARD BUNNY CABIN CAKES CAMPS CARDS CHIPS CHOIR COCOA COMET CORAL CREEK CRUMB CURLY DIARY DINER DOUGH EMBER FENCE FLOOR FLUTE FOCUS FUDGE GAMES GLASS GLOVE GRAIN GRILL HATCH HIKER HOTEL JEANS KAYAK KNIFE LADLE LASER LATTE LEAFY LEASH LOGIC MARCH MEDAL MELON MOTOR MUDDY NACHO NOODLE NORTH OLIVE ORBIT PATIO PEDAL PILOT PLAZA POLAR PRIZE PUZZLE QUILT RAINY RANCH RELAY ROAST ROVER RULER SAUNA SCOUT SEEDS SHINY SHORE SKIES SLEEP SNOWY SOLAR SPARK SPRAY STEAM STOVE SUSHI SYRUP TACOS TEMPO THYME TOAST TRAIL TREAT TWIRL UNITY VIDEO VIOLA WALTZ WINGS YOUTH ZESTY').split(' ').filter((w) => w.length === 5);
const WORDS4 = [['FROG', '🐸'], ['BEAR', '🐻'], ['CAKE', '🎂'], ['STAR', '⭐'], ['FISH', '🐟'], ['MOON', '🌙'], ['BIRD', '🐦'], ['TREE', '🌳'], ['BOOK', '📖'], ['BALL', '⚽'], ['DUCK', '🦆'], ['LION', '🦁'], ['RAIN', '🌧️'], ['SHIP', '🚢'], ['CORN', '🌽'], ['KITE', '🪁'], ['BOAT', '⛵'], ['MILK', '🥛'], ['SNOW', '❄️'], ['DOOR', '🚪'], ['GIFT', '🎁'], ['HAND', '✋'], ['LAMB', '🐑'], ['NEST', '🪺'], ['PEAR', '🍐'], ['ROSE', '🌹'], ['SOCK', '🧦'], ['WOLF', '🐺'], ['BELL', '🔔'], ['CRAB', '🦀'], ['DRUM', '🥁'], ['FIRE', '🔥'], ['GOAT', '🐐'], ['HAT', ''], ['LEAF', '🍃'], ['MOUSE', ''], ['PLAY', '🎈'], ['SEAL', '🦭'], ['SWIM', '🏊'], ['TOYS', '🧸'], ['WAVE', '🌊'], ['BIKE', '🚲'], ['CAR', ''], ['COOK', '🧑‍🍳'], ['DOGS', '🐶'], ['EGGS', '🥚'], ['FARM', '🚜'], ['GOLD', '🥇'], ['KING', '🤴'], ['LAKE', '🏞️'], ['MASK', '🎭'], ['PARK', '🛝'], ['POOL', '🏊'], ['RING', '💍'], ['SOAP', '🧼'], ['SUNS', '☀️'], ['TENT', '⛺'], ['TOES', '🦶'], ['WORM', '🪱'], ['ZOOS', '🦓'], ['SAND', '🏖️'], ['SHOE', '👟'], ['COAT', '🧥'], ['BATH', '🛁'], ['BONE', '🦴'], ['CAVE', '🕳️'], ['DEER', '🦌'], ['HIVE', '🐝'], ['LIME', '🍋'], ['NOSE', '👃'], ['OWLS', '🦉'], ['PIGS', '🐷'], ['ROCK', '🪨'], ['SEED', '🌱'], ['TACO', '🌮'], ['VASE', '🏺'], ['YARN', '🧶']].filter(([w, e]) => w.length === 4 && e);
const WORD_EPOCH = '2026-01-01';
function dailyWord(len, d = today()) {
  const n = Math.max(0, daysBetween(WORD_EPOCH, d));
  if (len === 4) { const [w, hint] = WORDS4[(n * 17 + 5) % WORDS4.length]; return { w, hint }; }
  return { w: WORDS5[(n * 31 + 7) % WORDS5.length] };
}
const wordLen = (id) => (typeof isSimple === 'function' && id && isSimple(id) ? 4 : 5);
const wordOf = (id, d = today()) => state.wordle[d]?.[id];
const wordPlayed = (id, d = today()) => !!wordOf(id, d)?.done;
function scoreGuess(guess, word) {
  const res = Array(word.length).fill('x'), left = {};
  for (let i = 0; i < word.length; i++) { if (guess[i] === word[i]) res[i] = 'g'; else left[word[i]] = (left[word[i]] || 0) + 1; }
  for (let i = 0; i < word.length; i++) if (res[i] !== 'g' && left[guess[i]]) { res[i] = 'y'; left[guess[i]]--; }
  return res;
}
const WORD_SQ = { g: '🟩', y: '🟨', x: '⬜' };
function wordStreak(id) {
  let n = 0, d = today();
  if (!wordOf(id, d)?.won) d = addDays(d, -1);
  while (wordOf(id, d)?.won) { n++; d = addDays(d, -1); }
  return n;
}
function miniGrid(rec, word) {
  return `<div class="mini-grid">${rec.g.map((g) => `<div>${scoreGuess(g, word).map((r) => `<i class="${r}"></i>`).join('')}</div>`).join('')}</div>`;
}
views.word = () => {
  const me = actor();
  if (!me) return needMe() || '<div class="card empty">Pick who you are first.</div>';
  const len = wordLen(me), { w, hint } = dailyWord(len);
  const rec = wordOf(me) || { g: [], len };
  const cur = (ui.wordCur || '').slice(0, len);
  const rows = 6;
  const keyState = {};
  const rank = { g: 3, y: 2, x: 1 };
  for (const g of rec.g) scoreGuess(g, w).forEach((r, i) => { if ((rank[r] || 0) > (rank[keyState[g[i]]] || 0)) keyState[g[i]] = r; });
  const board = [...Array(rows)].map((_, i) => {
    const g = rec.g[i];
    if (g) { const sc = scoreGuess(g, w); return `<div class="wd-row done">${[...g].map((ch, j) => `<span class="wd-tile ${sc[j]}" style="--d:${j}">${ch}</span>`).join('')}</div>`; }
    if (i === rec.g.length && !rec.done) return `<div class="wd-row cur${ui.wordShake ? ' shake' : ''}">${[...Array(len)].map((_, j) => `<span class="wd-tile${cur[j] ? ' typed' : ''}">${cur[j] || ''}</span>`).join('')}</div>`;
    return `<div class="wd-row">${[...Array(len)].map(() => '<span class="wd-tile"></span>').join('')}</div>`;
  }).join('');
  ui.wordShake = false;
  const keys = ['QWERTYUIOP', 'ASDFGHJKL', '⏎ZXCVBNM⌫'];
  const kb = rec.done ? '' : `<div class="wd-kb">${keys.map((row) => `<div>${[...row].map((k) => `<button class="${k === '⏎' || k === '⌫' ? 'wide ' : ''}${keyState[k] || ''}" data-action="word-key" data-k="${k}" aria-label="${k === '⏎' ? 'Enter' : k === '⌫' ? 'Delete' : k}">${k === '⏎' ? 'ENTER' : k}</button>`).join('')}</div>`).join('')}</div>`;
  const family = state.members.filter((m) => m.id !== me && wordOf(m.id)?.g?.length);
  return `<div class="wd-head"><span>${fmtDate(today(), { weekday: 'long', month: 'short', day: 'numeric' })} · ${len} letters</span><span>🔥 ${wordStreak(me)} day streak</span></div>
    ${len === 4 && hint ? `<div class="wd-hint">${ui.wordHint ? `Hint: <span class="big-hint">${hint}</span>` : '<button class="mini-btn" data-action="word-hint">💡 Show a hint</button>'}</div>` : ''}
    <div class="game-stage"><div class="wd-board" style="--len:${len}">${board}</div></div>
    ${rec.done ? `<div class="card wd-result">${rec.won ? `<div class="wd-big">🎉 ${['Genius!', 'Amazing!', 'Great!', 'Nice!', 'Phew!', 'Just made it!'][rec.g.length - 1]}</div><div>Solved in ${rec.g.length}/6</div>` : `<div class="wd-big">So close!</div><div>The word was <b>${w}</b></div>`}
      <div class="btn-row"><button class="btn" data-action="word-share">📤 Share</button><button class="btn secondary" data-action="go" data-to="games">More games</button></div>
      <div class="small muted">New word tomorrow!</div></div>` : ''}
    ${kb}
    ${family.length ? `<div class="section-title game-extra">Family today</div><div class="card wd-family game-extra">${family.map((m) => { const r = wordOf(m.id); const fw = dailyWord(r.len || wordLen(m.id)).w; return `<div class="wf">${avatar(m, true)}<div><b>${esc(m.name)}</b> <span class="small muted">${r.done ? (r.won ? `${r.g.length}/6` : 'X/6') : 'playing…'} · 🔥${wordStreak(m.id)}</span>${miniGrid(r, fw)}</div></div>`; }).join('')}</div>` : ''}`;
};
function wordKey(k) {
  const me = actor(); if (!me) return;
  const len = wordLen(me), { w } = dailyWord(len);
  const day = (state.wordle[today()] ||= {});
  const rec = day[me] || { g: [], len };
  if (rec.done) return;
  let cur = ui.wordCur || '';
  if (k === '⌫') cur = cur.slice(0, -1);
  else if (k === '⏎') {
    if (cur.length < len) { ui.wordShake = true; toast('Not enough letters'); render(); return; }
    rec.g = [...rec.g, cur];
    if (cur === w) { rec.done = true; rec.won = true; }
    else if (rec.g.length >= 6) { rec.done = true; rec.won = false; }
    day[me] = rec;
    cur = '';
    if (rec.done) {
      logAct('🔤', rec.won ? `solved the Family Word in ${rec.g.length}` : 'played the Family Word', 'word');
      if (rec.won) setTimeout(confetti, 700);
      if (rec.won && typeof isSimple === 'function' && isSimple(me) && readAloudOn(me)) speak(`You got it! The word was ${w}.`);
    }
    save();
  } else if (/^[A-Z]$/.test(k) && cur.length < len) cur += k;
  ui.wordCur = cur;
  render();
}
document.addEventListener('keydown', (e) => {
  if (currentRoute().name !== 'word' || !$('#sheet').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches?.('input, textarea')) return;
  const k = e.key === 'Enter' ? '⏎' : e.key === 'Backspace' ? '⌫' : e.key.length === 1 ? e.key.toUpperCase() : '';
  if (k && (/^[A-Z]$/.test(k) || k === '⏎' || k === '⌫')) { e.preventDefault(); wordKey(k); }
});

/* =========================================================
   Memory Match
   ========================================================= */
const MEM_SETS = ['🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮', '🍎🍌🍇🍓🍉🍒🍑🍍🥝🥕🌽🍩', '🚗🚕🚌🚓🚑🚒🚜🚲🛵🚀🚁⛵'];
const MEM_LEVELS = { easy: [6, 'Easy', 3], normal: [8, 'Normal', 4], hard: [10, 'Hard', 4] };
function memStart(level) {
  const [pairs] = MEM_LEVELS[level];
  const set = [...MEM_SETS[Math.floor(Math.random() * MEM_SETS.length)]].filter((c) => /\p{Extended_Pictographic}/u.test(c));
  const pick = set.sort(() => Math.random() - 0.5).slice(0, pairs);
  const cards = [...pick, ...pick].sort(() => Math.random() - 0.5);
  ui.mem = { level, cards, up: [], matched: [], moves: 0, start: 0, done: false, lock: false };
}
function memBest(level) {
  const best = {};
  for (const s of state.scores.filter((s) => s.game === 'memory' && s.level === level)) {
    const b = best[s.who];
    if (!b || s.moves < b.moves || (s.moves === b.moves && s.secs < b.secs)) best[s.who] = s;
  }
  return Object.values(best).sort((a, b) => a.moves - b.moves || a.secs - b.secs);
}
views.memory = () => {
  const me = actor();
  const defLevel = typeof isSimple === 'function' && me && isSimple(me) ? 'easy' : 'normal';
  if (!ui.mem) memStart(defLevel);
  const m = ui.mem, [, , cols] = MEM_LEVELS[m.level];
  const board = `<div class="mem-board" style="--cols:${cols};--rows:${m.cards.length / cols}">${m.cards.map((c, i) => `<button class="mem-card${m.up.includes(i) || m.matched.includes(i) ? ' up' : ''}${m.matched.includes(i) ? ' got' : ''}" data-action="mem-flip" data-i="${i}" aria-label="Card"><span class="mem-back">❓</span><span class="mem-front">${c}</span></button>`).join('')}</div>`;
  const secs = m.done ? m.secs : 0;
  const best = memBest(m.level).slice(0, 5);
  return `<div class="segmented">${Object.entries(MEM_LEVELS).map(([k, [, l]]) => `<button class="${m.level === k ? 'active' : ''}" data-action="mem-level" data-l="${k}">${l}</button>`).join('')}</div>
    <div class="mem-stats"><span>🃏 <b class="mem-moves">${m.moves}</b> moves</span><span>✅ <b class="mem-pairs">${m.matched.length / 2}</b>/${m.cards.length / 2}</span></div>
    <div class="game-stage">${board}
    ${m.done ? `<div class="game-over"><div class="card wd-result"><div class="wd-big">🎉 You matched them all!</div><div>${m.moves} moves · ${secs}s</div><div class="btn-row"><button class="btn" data-action="mem-level" data-l="${m.level}">Play again</button></div>
    ${best.length ? `<div class="go-best"><b>Family best · ${MEM_LEVELS[m.level][1]}</b>${best.slice(0, 3).map((s, i) => `<div>${['🥇', '🥈', '🥉'][i]} ${esc(playerEmoji(s.who))} ${esc(playerName(s.who))} · <b>${s.moves}</b> moves</div>`).join('')}</div>` : ''}</div></div>` : ''}</div>
    ${!m.done && best.length ? `<div class="section-title game-extra">Family best · ${MEM_LEVELS[m.level][1]}</div><div class="card flush game-extra">${best.map((s, i) => `<div class="row"><div class="avatar">${['🥇', '🥈', '🥉', '4', '5'][i]}</div><div class="grow"><div class="title">${esc(playerEmoji(s.who))} ${esc(playerName(s.who))}</div><div class="sub">${timeAgo(s.at)}</div></div><span class="small"><b>${s.moves}</b> moves · ${s.secs}s</span></div>`).join('')}</div>` : ''}`;
};
function memFlip(i) {
  const m = ui.mem;
  if (!m || m.lock || m.done || m.up.includes(i) || m.matched.includes(i)) return;
  if (!m.start) m.start = Date.now();
  m.up.push(i);
  const btn = (k) => viewEl.querySelector(`.mem-card[data-i="${k}"]`);
  btn(i)?.classList.add('up');
  if (m.up.length < 2) return;
  m.moves++;
  const mv = viewEl.querySelector('.mem-moves'); if (mv) mv.textContent = m.moves;
  const [a, b] = m.up;
  if (m.cards[a] === m.cards[b]) {
    m.matched.push(a, b); m.up = [];
    setTimeout(() => { btn(a)?.classList.add('got'); btn(b)?.classList.add('got'); }, 250);
    const pr = viewEl.querySelector('.mem-pairs'); if (pr) pr.textContent = m.matched.length / 2;
    if (m.matched.length === m.cards.length) {
      m.done = true; m.secs = Math.round((Date.now() - m.start) / 1000);
      const me = actor();
      if (me) {
        const prev = memBest(m.level).find((s) => s.who === me);
        state.scores.push({ id: uid(), game: 'memory', level: m.level, who: me, moves: m.moves, secs: m.secs, at: Date.now() });
        state.scores = state.scores.slice(-300);
        if (!prev || m.moves < prev.moves) logAct('🃏', `got a new Memory Match best: ${m.moves} moves (${MEM_LEVELS[m.level][1]})`, 'memory');
        save();
      }
      setTimeout(() => { confetti(); render(); }, 450);
    }
  } else {
    m.lock = true;
    setTimeout(() => { btn(a)?.classList.remove('up'); btn(b)?.classList.remove('up'); m.up = []; m.lock = false; }, 850);
  }
}

/* =========================================================
   "How well do you know us?" trivia
   ========================================================= */
const TRIVIA_PROMPTS = ['What’s my favorite food?', 'What’s my favorite color?', 'Where’s my dream vacation?', 'What’s my favorite animal?', 'What’s my favorite movie?', 'What’s my favorite dessert?', 'What am I most scared of?', 'What’s my favorite song?', 'What would I do with a million dollars?', 'What’s my favorite thing to do on a weekend?', 'What did I want to be when I grew up?', 'What’s my favorite holiday?'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
const triviaWaiting = (me) => state.trivia.filter((q) => q.about !== me && !(me in (q.answers || {})));
function autoQuestions(me) {
  const qs = [];
  const others = state.members.filter((m) => m.id !== me);
  const fillers = ['A pony', 'A spaceship', 'A drum set', 'A trampoline', 'A robot dog', 'A hot tub'];
  for (const m of others) {
    const ws = state.wishes.filter((w) => w.memberId === m.id && !w.got);
    if (!ws.length) continue;
    const w = ws[Math.floor(Math.random() * ws.length)];
    const wrong = shuffle([...state.wishes.filter((x) => x.memberId !== m.id).map((x) => x.title), ...fillers].filter((t) => norm(t) !== norm(w.title))).slice(0, 3);
    qs.push({ q: `Which one is on ${m.name}’s wish list?`, a: w.title, wrong, about: m.id });
  }
  for (const p of state.people.filter((p) => p.birthday)) {
    const mo = parse(p.birthday).getMonth();
    qs.push({ q: `What month is ${p.name}’s birthday?`, a: MONTH_NAMES[mo], wrong: shuffle(MONTH_NAMES.filter((_, i) => i !== mo)).slice(0, 3) });
  }
  const wk = weekStart(today());
  const counts = state.members.map((m) => [m, sum(state.chores, (c) => (c.log || []).filter((l) => l.memberId === m.id && l.date >= wk).length)]).sort((a, b) => b[1] - a[1]);
  if (counts.length > 1 && counts[0][1] > 0 && counts[0][1] > counts[1][1]) qs.push({ q: 'Who has done the most chores this week?', a: counts[0][0].name, wrong: counts.slice(1, 4).map(([m]) => m.name) });
  const dinners = Object.entries(state.meals).filter(([d, m]) => d >= today() && d <= addDays(today(), 6) && m.dinner);
  if (dinners.length) {
    const [d, m] = dinners[0];
    const wrong = shuffle([...new Set([...Object.values(state.meals).map((x) => x.dinner).filter((x) => x && x !== m.dinner), 'Spaghetti', 'Tacos', 'Pancakes', 'Sushi'])]).filter((x) => x !== m.dinner).slice(0, 3);
    qs.push({ q: `What’s for dinner ${d === today() ? 'tonight' : fmtDate(d, { weekday: 'long' })}?`, a: m.dinner, wrong });
  }
  const next = state.events.map((e) => ({ e, d: nextOccurrence(e) })).filter((x) => x.d && x.d > today()).sort((a, b) => a.d.localeCompare(b.d));
  if (next.length >= 3) {
    const { e, d } = next[0];
    qs.push({ q: `What’s happening ${fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}?`, a: e.title, wrong: [...new Set(next.slice(1).map((x) => x.e.title).filter((t) => t !== e.title))].slice(0, 3) });
  }
  return shuffle(qs.filter((q) => q.wrong.length >= 2));
}
function triviaStart() {
  const me = actor();
  const custom = shuffle(triviaWaiting(me)).slice(0, 5).map((q) => ({ q: q.q, a: q.a, wrong: q.wrong, about: q.about, cid: q.id }));
  const qs = [...custom, ...autoQuestions(me)].slice(0, 5).map((q) => ({ ...q, choices: shuffle([q.a, ...q.wrong.slice(0, 3)]) }));
  ui.triv = { qs, i: 0, score: 0, picked: null };
}
views.trivia = () => {
  const me = actor();
  if (!me) return needMe() || '<div class="card empty">Pick who you are first.</div>';
  const t = ui.triv;
  const mine = state.trivia.filter((q) => q.about === me);
  const lb = state.members.map((m) => [m, sum(state.scores.filter((s) => s.game === 'trivia' && s.who === m.id && thisMonth(s.at)), (s) => s.score)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  if (t && t.i < t.qs.length) {
    const q = t.qs[t.i];
    const about = q.about && isMember(q.about) ? member(q.about) : null;
    return `<div class="trv-progress">${t.qs.map((_, k) => `<i class="${k < t.i ? 'done' : k === t.i ? 'now' : ''}"></i>`).join('')}</div>
      <div class="card trv-q">${about ? `<div class="trv-about">${avatar(about, true)} About ${esc(about.name)}</div>` : '<div class="trv-about">🏠 About our family</div>'}<h2>${esc(q.q)}</h2></div>
      <div class="trv-choices">${q.choices.map((c, k) => { const st = t.picked == null ? '' : c === q.a ? ' right' : c === t.picked ? ' wrong' : ' dim'; return `<button class="trv-choice${st}" data-action="trivia-pick" data-k="${k}" ${t.picked != null ? 'disabled' : ''}>${esc(c)}</button>`; }).join('')}</div>
      ${t.picked != null ? `<div class="trv-verdict">${t.picked === q.a ? '🎉 Correct!' : `😅 It’s <b>${esc(q.a)}</b>`}</div><button class="btn block" data-action="trivia-next">${t.i === t.qs.length - 1 ? 'See my score' : 'Next question →'}</button>` : ''}`;
  }
  return `${t && t.qs.length ? `<div class="card wd-result"><div class="wd-big">${t.score === t.qs.length ? '🧠 Perfect!' : t.score >= t.qs.length / 2 ? '🎉 Nice!' : '🙂 Good try!'}</div><div>You got ${t.score} of ${t.qs.length}</div></div>` : ''}
    <button class="card trv-hero" data-action="trivia-play"><span>🧠</span><b>${t ? 'Play again' : 'Play a round'}</b><small>${triviaWaiting(me).length ? `${triviaWaiting(me).length} new question${triviaWaiting(me).length > 1 ? 's' : ''} from the family` : '5 questions about the family'}</small></button>
    <button class="btn secondary block" data-action="trivia-new">✏️ Write a question about me</button>
    ${lb.length ? `<div class="section-title">Who knows us best · this month</div><div class="card flush">${lb.map(([m, n], i) => `<div class="row"><div class="avatar">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="grow"><div class="title">${esc(m.emoji)} ${esc(m.name)}</div></div><b>${n}</b></div>`).join('')}</div>` : ''}
    ${mine.length ? `<div class="section-title">My questions</div><div class="card flush">${mine.map((q) => { const ans = Object.entries(q.answers || {}).filter(([id]) => isMember(id)); return `<div class="row"><div class="grow"><div class="title">${esc(q.q)}</div><div class="sub">Answer: ${esc(q.a)}${ans.length ? ' · ' + ans.map(([id, a]) => `${esc(member(id).emoji)}${a === q.a ? '✅' : '❌'}`).join(' ') : ' · nobody yet'}</div></div><button class="del-btn" data-action="trivia-del" data-id="${q.id}" aria-label="Delete">${ICON.x}</button></div>`; }).join('')}</div>` : ''}`;
};
function triviaForm() {
  const me = actor();
  if (!me) { toast('Pick who you are first'); return; }
  const used = new Set(state.trivia.filter((q) => q.about === me).map((q) => q.q));
  openSheet({
    title: '✏️ A question about me',
    saveLabel: 'Add',
    values: { prompt: TRIVIA_PROMPTS.find((p) => !used.has(p)) || '' },
    fields: [
      { name: 'prompt', label: 'Question', type: 'select', options: [...TRIVIA_PROMPTS.map((p) => ({ value: p, label: p })), { value: '', label: '✏️ Write my own…' }] },
      { name: 'custom', label: 'Your own question', placeholder: 'e.g. What’s my secret talent?' },
      { name: 'a', label: '✅ The right answer', required: true, placeholder: 'e.g. Pizza' },
      { name: 'w1', label: '❌ Wrong answer 1', required: true, placeholder: 'e.g. Tacos' },
      { row: [{ name: 'w2', label: '❌ Wrong 2', placeholder: 'e.g. Sushi' }, { name: 'w3', label: '❌ Wrong 3', placeholder: 'e.g. Burgers' }] },
    ],
    onSave(v) {
      const q = (v.prompt || v.custom || '').trim();
      if (!q) { toast('Add a question'); return false; }
      const wrong = [v.w1, v.w2, v.w3].map((x) => (x || '').trim()).filter((x) => x && norm(x) !== norm(v.a));
      if (!wrong.length) { toast('Add at least one wrong answer'); return false; }
      state.trivia.push({ id: uid(), at: Date.now(), about: me, by: me, q, a: v.a.trim(), wrong, answers: {} });
      logAct('🧠', 'added a trivia question — how well do you know them?', 'trivia');
      toast('🧠 Added! The family will see it in their inbox');
    },
  });
}

/* =========================================================
   Game Center
   ========================================================= */
views.games = () => {
  const me = actor();
  const active = c4Games().filter((g) => !c4Status(g).over).sort((a, b) => (myTurnGames().includes(b) ? 1 : 0) - (myTurnGames().includes(a) ? 1 : 0) || b.at - a.at);
  const done = c4Games().filter((g) => c4Status(g).over).sort((a, b) => (b.endAt || b.at) - (a.endAt || a.at)).slice(0, 3);
  const wrec = me ? wordOf(me) : null;
  const wordToday = state.members.filter((m) => wordOf(m.id)?.done);
  // Monthly champs: Connect Four wins ×3, Family Word solves ×(7 − guesses), trivia answers right
  const pts = Object.fromEntries(state.members.map((m) => [m.id, 0]));
  for (const g of c4Games()) if (g.winner && pts[g.winner] != null && thisMonth(g.endAt || g.at)) pts[g.winner] += 3;
  for (const [d, xs] of Object.entries(state.wordle)) if (d.slice(0, 7) === monthKey(today())) for (const [id, r] of Object.entries(xs)) if (r.won && pts[id] != null) pts[id] += 7 - r.g.length;
  for (const s of state.scores) if (s.game === 'trivia' && pts[s.who] != null && thisMonth(s.at)) pts[s.who] += s.score;
  const champs = state.members.filter((m) => pts[m.id]).sort((a, b) => pts[b.id] - pts[a.id]);
  return `${needMe()}
    ${champs.length ? `<div class="card champs"><div class="stat-label">🏆 This month’s champs</div><div class="podium">${champs.slice(0, 3).map((m, i) => `<div class="pod p${i + 1}" style="--c:${m.color}"><span class="pod-av">${esc(m.emoji)}</span><b>${esc(m.name)}</b><span class="pod-bar">${['🥇', '🥈', '🥉'][i]}<small>${pts[m.id]} pts</small></span></div>`).join('')}</div></div>` : ''}
    <div class="game-grid">
      <button class="game-tile" data-action="go" data-to="word" style="--g1:#16a34a;--g2:#65a30d"><span class="gt-e">🔤</span><b>Family Word</b><small>${wrec?.done ? (wrec.won ? `Solved in ${wrec.g.length} ✓` : 'Done for today') : 'Today’s puzzle'}${wordToday.length ? ` · ${wordToday.length} played` : ''}</small></button>
      <button class="game-tile" data-action="c4-new" style="--g1:#dc2626;--g2:#f59e0b"><span class="gt-e">🔴</span><b>Connect Four</b><small>${myTurnGames().length ? `Your turn in ${myTurnGames().length}!` : 'Challenge someone'}</small></button>
      <button class="game-tile" data-action="go" data-to="memory" style="--g1:#7c3aed;--g2:#db2777"><span class="gt-e">🃏</span><b>Memory Match</b><small>Find the pairs</small></button>
      <button class="game-tile" data-action="trivia-open" style="--g1:#0284c7;--g2:#06b6d4"><span class="gt-e">🧠</span><b>Family Trivia</b><small>${me && triviaWaiting(me).length ? `${triviaWaiting(me).length} new!` : 'How well do you know us?'}</small></button>
    </div>
    ${active.length ? `<div class="section-title">Connect Four games</div><div class="card flush">${active.map(c4Card).join('')}</div>` : ''}
    ${done.length ? `<div class="section-title">Recent results</div><div class="card flush">${done.map(c4Card).join('')}</div>` : ''}`;
};

/* =========================================================
   Wiring: kid mode, actions, migrations
   ========================================================= */
KID_ROUTES.push('games', 'c4', 'word', 'memory', 'trivia');
for (const a of ['c4-new', 'c4-drop', 'c4-rematch', 'c4-undo', 'c4-del', 'word-key', 'word-share', 'word-hint', 'mem-flip', 'mem-level', 'trivia-open', 'trivia-play', 'trivia-pick', 'trivia-next', 'trivia-new', 'trivia-del']) KID_ACTIONS.add(a);

Object.assign(actions, {
  'c4-new': () => c4NewSheet(),
  'c4-drop': (el) => {
    const g = findIn(state.games, el.dataset.id), c = Number(el.dataset.c);
    if (!c4CanMove(g) || c4Grid(g.moves)[c].length >= C4_ROWS) return;
    g.moves = [...g.moves, c];
    c4Finish(g);
    save(); render();
    if (g.mode === 'bot' && !c4Status(g).over) {
      setTimeout(() => {
        const gg = state.games.find((x) => x.id === g.id);
        if (!gg || c4Status(gg).over || c4Turn(gg) !== BOT) return;
        gg.moves = [...gg.moves, botMove(gg)];
        c4Finish(gg);
        save(); if (currentRoute().name === 'c4') render();
      }, 650);
    }
  },
  'c4-undo': (el) => {
    const g = findIn(state.games, el.dataset.id);
    if (g.mode === 'remote' || !g.moves.length || c4Status(g).over && g.mode !== 'local') return;
    g.moves = g.moves.slice(0, g.mode === 'bot' && g.moves.length >= 2 ? -2 : -1);
    delete g.endAt; delete g.winner;
    save(); render();
  },
  'c4-rematch': (el) => {
    const g = findIn(state.games, el.dataset.id);
    const ng = { id: uid(), type: 'c4', a: g.b === BOT ? g.a : g.b, b: g.b === BOT ? BOT : g.a, mode: g.mode, moves: [], at: Date.now() };
    state.games.push(ng);
    state.games = state.games.filter((x) => x.type !== 'c4' || !x.endAt || Date.now() - x.endAt < 14 * 86400000 || x.id === ng.id);
    save(); go('c4/' + ng.id);
  },
  'c4-del': (el) => { state.games = state.games.filter((x) => x.id !== el.dataset.id); save(); go('games'); },
  'word-key': (el) => wordKey(el.dataset.k),
  'word-hint': () => { ui.wordHint = true; render(); },
  'word-share': async () => {
    const me = actor(), rec = wordOf(me), { w } = dailyWord(rec.len || wordLen(me));
    const text = `Gomez Family Word · ${fmtDate(today(), { month: 'short', day: 'numeric' })} · ${rec.won ? rec.g.length : 'X'}/6\n${rec.g.map((g) => scoreGuess(g, w).map((r) => WORD_SQ[r]).join('')).join('\n')}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Copied — paste it in the chat!'); } }
    catch { /* cancelled */ }
  },
  'mem-flip': (el) => memFlip(Number(el.dataset.i)),
  'mem-level': (el) => { memStart(el.dataset.l); render(); },
  'trivia-open': () => { ui.triv = null; go('trivia'); },
  'trivia-play': () => {
    triviaStart();
    if (!ui.triv.qs.length) { ui.triv = null; toast('No questions yet — write one about yourself!'); render(); return; }
    render();
  },
  'trivia-pick': (el) => {
    const t = ui.triv, q = t.qs[t.i];
    t.picked = q.choices[Number(el.dataset.k)];
    if (t.picked === q.a) { t.score++; }
    if (q.cid) { const tq = state.trivia.find((x) => x.id === q.cid); if (tq && actor()) { (tq.answers ||= {})[actor()] = t.picked; save(); } }
    render();
  },
  'trivia-next': () => {
    const t = ui.triv;
    t.i++; t.picked = null;
    if (t.i >= t.qs.length && actor()) {
      state.scores.push({ id: uid(), game: 'trivia', who: actor(), score: t.score, of: t.qs.length, at: Date.now() });
      state.scores = state.scores.slice(-300);
      logAct('🧠', `scored ${t.score}/${t.qs.length} in Family Trivia`, 'trivia');
      save();
      if (t.score === t.qs.length) setTimeout(confetti, 150);
    }
    render();
  },
  'trivia-new': () => triviaForm(),
  'trivia-del': (el) => withUndo('Question removed', () => { state.trivia = state.trivia.filter((x) => x.id !== el.dataset.id); }),
});

// Opening Connect Four from the inbox or a notification while the robot "thinks" etc. is handled above;
// leaving Memory Match resets the board so a new round starts fresh next time.
const _afterRenderG = afterRender;
afterRender = function () {
  _afterRenderG();
  const name = currentRoute().name;
  if (name !== 'memory' && ui.mem?.done) ui.mem = null;
  if (name !== 'word') { ui.wordCur = ''; ui.wordHint = false; }
};
