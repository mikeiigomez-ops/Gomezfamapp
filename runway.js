/* Runway Ready 👗 — a dress-up fashion show (inspired by dress-up games kids love; original name and art).
   Everyone gets the same theme, has a few minutes in the dressing room to style their own avatar (every item is
   free in here, plus runway extras: wings, necklaces, scarves, bags, wands, a mic and sparkle auras), then each
   model walks the runway and everyone else gives 1–5 stars. Robot models join so there's always a show, and
   they judge by the theme. Runs on the arcade engine (arcade.js): own phones, pass the phone, or solo.
   Loaded after ux3.js. */
'use strict';

/* ---------- Wardrobe ---------- */
const RW_FX = {
  back: { '': 'None', wings: '🧚 Fairy wings', angel: '😇 Angel wings', bat: '🦇 Bat wings' },
  neck: { '': 'None', pearls: '📿 Pearls', scarf: '🧣 Scarf', bowtie: '🎀 Bow tie' },
  hand: { '': 'None', bag: '👜 Handbag', wand: '🪄 Wand', mic: '🎤 Mic', bouquet: '💐 Bouquet' },
  aura: { '': 'None', sparkle: '✨ Sparkles', hearts: '💖 Hearts', snow: '❄️ Snowflakes', stars: '⭐ Stars' },
};
const RW_CATS = [
  ['hair', '💇', 'Hair'], ['hairC', '🎨', 'Hair color'], ['top', '👚', 'Top'], ['topC', '🌈', 'Top color'], ['graphic', '💖', 'Print'],
  ['bottom', '👖', 'Bottom'], ['bottomC', '🎨', 'Bottom color'], ['shoes', '👟', 'Shoes'], ['shoesC', '🎨', 'Shoe color'],
  ['acc', '🎀', 'Accessory'], ['back', '🧚', 'Wings'], ['neck', '📿', 'Neck'], ['hand', '👜', 'In hand'], ['aura', '✨', 'Aura'], ['face', '😊', 'Face'],
];
const rwOpts = (cat) => {
  const lab = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  if (cat === 'hair') return lab(AV_HAIR); if (cat === 'top') return lab(AV_TOP); if (cat === 'graphic') return lab(AV_GRAPHIC);
  if (cat === 'bottom') return lab(AV_BOTTOM); if (cat === 'shoes') return lab(AV_SHOES); if (cat === 'acc') return lab(AV_ACC);
  if (RW_FX[cat]) return RW_FX[cat];
  return null;
};

/* ---------- Themes: what fits (robots judge by these; players see a few "ideas") ---------- */
// colours are indexes into AV_CLOTH: 0 pink 1 orange 2 yellow 3 green 4 teal 5 blue 6 purple 7 white 8 black 9 magenta 10 sky 11 blush
const RW_THEMES = [
  ['beach', '🏖️', 'Beach Day', { top: ['tank', 'tee'], bottom: ['shorts'], shoes: ['sandals'], acc: ['sunglasses', 'flower'], colors: [2, 4, 10, 1] }],
  ['royal', '👑', 'Royal Ball', { top: ['gown', 'dress'], bottom: ['skirt'], acc: ['tiara', 'crown'], neck: ['pearls'], hand: ['wand'], aura: ['sparkle'], colors: [0, 6, 11, 7] }],
  ['hero', '🦸', 'Superhero', { top: ['cape', 'jacket'], bottom: ['leggings', 'pants'], shoes: ['boots'], acc: ['sunglasses'], aura: ['stars'], colors: [5, 9, 8] }],
  ['pajama', '😴', 'Pajama Party', { top: ['hoodie', 'sweater'], bottom: ['leggings', 'pants'], shoes: ['slippers'], acc: ['catears', 'bunnyears'], aura: ['hearts'], colors: [11, 10, 6] }],
  ['popstar', '🎤', 'Pop Star', { top: ['jacket', 'dress'], bottom: ['skirt', 'leggings'], shoes: ['boots'], acc: ['headphones', 'starclips', 'sunglasses'], hand: ['mic'], aura: ['sparkle', 'stars'], colors: [9, 6, 0] }],
  ['winter', '❄️', 'Winter Wonderland', { top: ['sweater', 'jacket', 'hoodie'], bottom: ['pants'], shoes: ['boots'], acc: ['beanie'], neck: ['scarf'], aura: ['snow'], colors: [7, 10, 5] }],
  ['sports', '⚽', 'Sports Day', { top: ['tee', 'tank'], bottom: ['shorts'], shoes: ['sneakers'], acc: ['cap', 'headphones'], colors: [5, 3, 1] }],
  ['garden', '🌸', 'Garden Party', { top: ['dress'], bottom: ['skirt'], shoes: ['sandals'], acc: ['flower', 'bow'], hand: ['bouquet'], aura: ['hearts'], colors: [0, 3, 11] }],
  ['space', '🚀', 'Space Explorer', { top: ['jacket', 'overalls'], bottom: ['pants', 'leggings'], shoes: ['boots'], acc: ['headphones', 'starclips'], hairC: ['galaxy', 'silver'], aura: ['stars'], colors: [6, 8, 7] }],
  ['rainbow', '🌈', 'Rainbow Everything', { hairC: ['rainbow'], graphic: ['rainbow'], aura: ['sparkle'], rainbow: true }],
  ['spooky', '🦇', 'Spooky Night', { top: ['cape', 'hoodie'], acc: ['catears'], back: ['bat'], aura: ['stars'], colors: [8, 6] }],
  ['fancy', '🍝', 'Fancy Dinner', { top: ['gown', 'dress', 'jacket'], shoes: ['boots'], neck: ['pearls', 'bowtie'], hand: ['bag'], colors: [8, 7, 9] }],
  ['school', '🎒', 'Back to School', { top: ['tee', 'hoodie', 'overalls'], bottom: ['pants', 'skirt'], shoes: ['sneakers'], acc: ['glasses'], hand: ['bag'], colors: [5, 1, 3] }],
  ['rock', '🎸', 'Rock Concert', { top: ['jacket', 'tank'], bottom: ['pants'], shoes: ['boots'], acc: ['sunglasses'], hair: ['spiky'], hand: ['mic'], colors: [8, 9] }],
  ['fairy', '🧚', 'Fairy Tale', { top: ['gown', 'dress'], acc: ['tiara', 'flower'], back: ['wings'], hand: ['wand'], aura: ['sparkle'], colors: [3, 11, 10] }],
];
const rwTheme = (g) => RW_THEMES.find((t) => t[0] === g.theme) || RW_THEMES[0];
const RW_W = { top: 2, bottom: 1, shoes: 1, acc: 1.5, hair: 0.5, hairC: 1, graphic: 1, back: 1.2, neck: 1, hand: 1.2, aura: 1 };
// How well a look fits the theme, 0..10
function rwFit(look, th) {
  const w = th[3]; let got = 0, max = 0;
  for (const [k, pts] of Object.entries(RW_W)) {
    if (!w[k]) continue; max += pts;
    const v = RW_FX[k] ? look.fx?.[k] || '' : look[k];
    if (w[k].includes(v)) got += pts;
  }
  if (w.colors) { max += 1.5; got += 0.5 * ['topC', 'bottomC', 'shoesC'].filter((k) => w.colors.includes(Number(look[k]))).length; }
  if (w.rainbow) { max += 2; got += Math.min(2, (new Set([look.topC, look.bottomC, look.shoesC].map(Number)).size - 1)); }
  return max ? Math.round((got / max) * 100) / 10 : 5;
}
const rwRand = (seed) => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
function rwRobotLook(th, seed) {
  const r = rwRand(seed), w = th[3], pick = (arr) => arr[Math.floor(r() * arr.length)];
  const want = (k, all) => (w[k] && r() < 0.78 ? pick(w[k]) : pick(all));
  const col = () => (w.colors && r() < 0.7 ? pick(w.colors) : Math.floor(r() * AV_CLOTH.length));
  return {
    skin: Math.floor(r() * AV_SKIN.length), hair: want('hair', Object.keys(AV_HAIR)), hairC: want('hairC', ['black', 'dark', 'brown', 'blonde', 'pink', 'purple', 'blue', 'auburn']),
    eyes: pick(['round', 'lashes', 'happy', 'sparkle']), eyeC: Math.floor(r() * AV_EYEC.length), mouth: pick(['smile', 'grin', 'smirk']), blush: r() < 0.6, freckles: r() < 0.2, facial: 'none',
    top: want('top', Object.keys(AV_TOP)), topC: col(), graphic: want('graphic', ['none', 'heart', 'star']), bottom: want('bottom', Object.keys(AV_BOTTOM)), bottomC: col(),
    shoes: want('shoes', Object.keys(AV_SHOES)), shoesC: col(), acc: want('acc', Object.keys(AV_ACC).filter((k) => k !== 'crown' && k !== 'halo')),
    fx: { back: want('back', ['', '', '', 'wings']), neck: want('neck', ['', '', 'pearls', 'scarf']), hand: want('hand', ['', '', 'bag']), aura: want('aura', ['', '', 'sparkle']) },
  };
}
const RW_BOTS = [['stella', 'Stella', '💃'], ['max', 'Max', '🕺'], ['luna', 'Luna', '🌙'], ['kai', 'Kai', '⚡']];

/* ---------- Drawing: the avatar plus runway extras ---------- */
function rwFxSVG(fx, layer) {
  if (!fx) return '';
  let s = '';
  if (layer === 'back') {
    if (fx.back === 'wings') s += '<g opacity=".8"><ellipse cx="30" cy="80" rx="15" ry="24" transform="rotate(-24 30 80)" fill="#c5f6fa" stroke="#fff" stroke-width="1.5"/><ellipse cx="70" cy="80" rx="15" ry="24" transform="rotate(24 70 80)" fill="#ffd6f5" stroke="#fff" stroke-width="1.5"/><ellipse cx="34" cy="100" rx="9" ry="13" transform="rotate(20 34 100)" fill="#e5dbff" stroke="#fff"/><ellipse cx="66" cy="100" rx="9" ry="13" transform="rotate(-20 66 100)" fill="#fff3bf" stroke="#fff"/></g>';
    if (fx.back === 'angel') s += '<g fill="#fff" stroke="#dee2e6" stroke-width="1.2"><path d="M40 78 C20 60 6 70 8 84 C12 98 26 100 40 92Z"/><path d="M60 78 C80 60 94 70 92 84 C88 98 74 100 60 92Z"/><path d="M14 84 q8 4 18 2 M12 90 q10 4 22 1 M86 84 q-8 4 -18 2 M88 90 q-10 4 -22 1" fill="none"/></g>';
    if (fx.back === 'bat') s += '<g fill="#5f3dc4" stroke="#3b2a6b" stroke-width="1.2"><path d="M40 80 L10 66 L14 78 L4 84 L16 88 L12 98 L40 90Z"/><path d="M60 80 L90 66 L86 78 L96 84 L84 88 L88 98 L60 90Z"/></g>';
    return s ? `<svg class="rw-fx back" viewBox="0 -12 100 158" aria-hidden="true">${s}</svg>` : '';
  }
  if (fx.neck === 'pearls') s += [...Array(9)].map((_, i) => { const t = i / 8, x = 40 + t * 20, y = 71 + Math.sin(t * Math.PI) * 6; return `<circle cx="${x}" cy="${y}" r="1.7" fill="#fff" stroke="#ced4da" stroke-width=".5"/>`; }).join('');
  if (fx.neck === 'scarf') s += '<path d="M38 69 Q50 76 62 69 L62 74 Q50 81 38 74Z" fill="#e03131" stroke="#a51111" stroke-width=".8"/><path d="M56 74 L60 92 L54 93 L52 76Z" fill="#e03131" stroke="#a51111" stroke-width=".8"/><path d="M41 71 l2 4 M46 73 l2 4 M52 73 l2 4" stroke="#fff" stroke-width="1"/>';
  if (fx.neck === 'bowtie') s += '<path d="M50 73 L42 69 L42 77Z M50 73 L58 69 L58 77Z" fill="#212529" stroke="#000" stroke-width=".6"/><circle cx="50" cy="73" r="2" fill="#495057"/>';
  if (fx.hand === 'bag') s += '<path d="M76 98 Q80 92 84 98" fill="none" stroke="#7048e8" stroke-width="1.6"/><rect x="73" y="98" width="14" height="11" rx="2.5" fill="#9775fa" stroke="#5f3dc4"/><circle cx="80" cy="103" r="1.2" fill="#ffd43b"/>';
  if (fx.hand === 'wand') s += '<path d="M78 101 L88 82" stroke="#f8f9fa" stroke-width="2" stroke-linecap="round"/><path d="M88 74 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z" fill="#ffd43b" stroke="#f59f00" stroke-width=".7"/>';
  if (fx.hand === 'mic') s += '<path d="M78 101 L81 91" stroke="#343a40" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="88" r="3.6" fill="#adb5bd" stroke="#495057"/>';
  if (fx.hand === 'bouquet') s += '<path d="M78 102 L82 90 M78 102 L77 89 M78 102 L86 92" stroke="#2f9e44" stroke-width="1.3"/><circle cx="82" cy="88" r="3" fill="#ff8fab"/><circle cx="77" cy="87" r="3" fill="#ffd43b"/><circle cx="87" cy="91" r="3" fill="#da77f2"/><circle cx="82" cy="88" r="1" fill="#fff"/>';
  const auraE = { sparkle: '✨', hearts: '💖', snow: '❄️', stars: '⭐' }[fx.aura];
  const aura = auraE ? `<div class="rw-aura">${[...Array(6)].map((_, i) => `<i style="--i:${i}">${auraE}</i>`).join('')}</div>` : '';
  return (s ? `<svg class="rw-fx front" viewBox="0 -12 100 158" aria-hidden="true">${s}</svg>` : '') + aura;
}
const rwModel = (look, cls = '') => `<div class="rw-model ${cls}">${rwFxSVG(look.fx, 'back')}${avatarSVG(look, { noShadow: true })}${rwFxSVG(look.fx, 'front')}</div>`;

/* ---------- Game rules ---------- */
const RW_DRESS_MS = 180000;
const rwModels = (g) => [...g.p.filter((x) => !g.out?.[x] && g.looks[x]).map((x) => ({ id: x, name: playerName(x), e: playerEmoji(x), look: g.looks[x] })), ...g.npc.map((n) => ({ id: n.id, name: n.name, e: n.e, look: n.look, bot: true }))];
const rwPhase = (g) => (g.p.some((x) => !g.out?.[x] && !g.looks[x]) ? 'dress' : g.p.some((x) => !g.out?.[x] && !g.votes[x]) ? 'vote' : 'done');
const rwBotStar = (n, m, th, g) => { const r = rwRand(g.id + n.id + m.id)(); return Math.max(1, Math.min(5, Math.round(1 + rwFit(m.look, th) / 2.5 + (r - 0.5) * 1.6))); };
function rwResults(g) {
  const th = rwTheme(g), models = rwModels(g);
  return models.map((m) => {
    const stars = [];
    for (const x of g.p) if (x !== m.id && g.votes[x]?.[m.id]) stars.push(g.votes[x][m.id]);
    for (const n of g.npc) if (n.id !== m.id) stars.push(rwBotStar(n, m, th, g));
    const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0;
    return { ...m, avg: Math.round(avg * 10) / 10, n: stars.length, fit: rwFit(m.look, th) };
  }).sort((a, b) => b.avg - a.avg || b.fit - a.fit);
}
GX.runway = {
  name: 'Runway Ready', short: 'Runway Ready', sub: 'Dress to the theme', e: '👗', g1: '#db2777', g2: '#a855f7', tag: 'Dress up · walk · vote', max: 6, solo: true, bot: false, hidden: true,
  how: 'Everyone gets the same theme and a few minutes in the dressing room. Then each model walks the runway and everyone rates the looks 1–5 stars. Robot models join the show — play with the family, or start it with nobody picked to play solo.',
  init(p) {
    const th = RW_THEMES[Math.floor(Math.random() * RW_THEMES.length)];
    const nBots = Math.max(2, 4 - p.length);
    const npc = shuffle(RW_BOTS.slice()).slice(0, nBots).map(([id, name, e]) => ({ id: 'npc-' + id, name, e, look: rwRobotLook(th, id + Date.now()) }));
    return { theme: th[0], looks: {}, votes: {}, out: {}, npc, until: Date.now() + RW_DRESS_MS };
  },
  need(g) { const ph = rwPhase(g); return ph === 'dress' ? g.p.filter((x) => !g.out?.[x] && !g.looks[x]) : ph === 'vote' ? g.p.filter((x) => !g.out?.[x] && !g.votes[x]) : []; },
  prompt(g, who) { const ph = rwPhase(g), th = rwTheme(g); return ph === 'dress' ? `💅 ${g.mode === 'remote' || g.p.length < 2 ? 'Dress to the theme!' : `${playerName(who)}, get dressed!`}` : `⭐ ${g.mode === 'remote' ? 'Rate the looks!' : `${playerName(who)}, rate the looks!`}`; },
  status(g) { if (rwPhase(g) !== 'done') return { over: false }; const R = rwResults(g); const top = R[0]; return { over: true, winner: top && g.p.includes(top.id) ? top.id : 'npc' }; },
  endText(g) { const R = rwResults(g), t = R[0]; return t ? `👑 ${t.e} ${t.name} wins the runway!` : 'Show’s over!'; },
  act(g, who, v) {
    if (v && typeof v === 'object' && v.look && rwPhase(g) === 'dress' && !g.looks[who]) { g.looks = { ...g.looks, [who]: v.look }; return; }
    if (v && typeof v === 'object' && v.votes && rwPhase(g) === 'vote' && !g.votes[who]) {
      const ok = {}; for (const m of rwModels(g)) if (m.id !== who) ok[m.id] = Math.max(1, Math.min(5, Math.round(Number(v.votes[m.id]) || 3)));
      g.votes = { ...g.votes, [who]: ok }; return;
    }
    return false;
  },
  view(g, who, st) {
    const ph = rwPhase(g), th = rwTheme(g), me = g.mode === 'remote' ? actor() : who;
    if (st.over) return rwPodium(g);
    if (ph === 'dress') {
      if (who) return rwDressing(g, who);
      const waiting = g.p.filter((x) => !g.out?.[x] && !g.looks[x]);
      const late = Date.now() > (g.until || 0) + 30000;
      return `<div class="rw-wait">${me && g.looks[me] ? rwModel(g.looks[me], 'small') : ''}<p><b>Looking good! 💅</b><br>Waiting for ${esc(waiting.map(playerName).join(', '))} to finish dressing…</p>${late ? `<button class="btn secondary" data-action="rw-skip" data-id="${g.id}">Start the runway without them</button>` : ''}</div>`;
    }
    if (who) return rwVoting(g, who);
    const waiting = g.p.filter((x) => !g.out?.[x] && !g.votes[x]);
    return `<div class="rw-wait"><p><b>Votes are in! ⭐</b><br>Waiting for ${esc(waiting.map(playerName).join(', '))} to rate the looks…</p><button class="btn secondary" data-action="rw-skip" data-id="${g.id}">Show results now</button></div>`;
  },
  bot: () => null,
};

/* ---------- Dressing room ---------- */
function rwDraft(g, who) {
  const key = g.id + ':' + who;
  if (!ui.rw || ui.rw.key !== key) {
    const base = JSON.parse(JSON.stringify(typeof avatarOf === 'function' ? avatarOf(who) : {}));
    ui.rw = { key, gid: g.id, who, cat: 'top', look: { ...base, fx: { back: '', neck: '', hand: '', aura: '' } }, start: Date.now() };
  }
  return ui.rw;
}
const rwEnd = (g, D) => (g.mode === 'remote' ? Math.max(g.until || 0, D.start + 60000) : D.start + RW_DRESS_MS);
function rwDressing(g, who) {
  const th = rwTheme(g), D = rwDraft(g, who), L = D.look, cat = D.cat;
  const left = Math.max(0, Math.ceil((rwEnd(g, D) - Date.now()) / 1000));
  const opts = rwOpts(cat);
  const cur = RW_FX[cat] ? L.fx[cat] || '' : L[cat];
  let grid;
  if (cat === 'hairC') grid = Object.entries(AV_HAIRC).map(([k, [c]]) => `<button class="rw-sw${L.hairC === k ? ' on' : ''}" data-action="rw-set" data-k="hairC" data-v="${k}" style="--c:${c === 'rainbow' ? 'conic-gradient(red,orange,yellow,green,blue,violet,red)' : c === 'galaxy' ? 'linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)' : c}" aria-label="${k}"></button>`).join('');
  else if (/C$/.test(cat)) grid = AV_CLOTH.map((c, i) => `<button class="rw-sw${Number(L[cat]) === i ? ' on' : ''}" data-action="rw-set" data-k="${cat}" data-v="${i}" style="--c:${c}" aria-label="Colour ${i + 1}"></button>`).join('');
  else if (cat === 'face') grid = [['eyes', AV_EYES], ['mouth', AV_MOUTH]].map(([k, o]) => Object.entries(o).map(([v, x]) => `<button class="rw-opt${L[k] === v ? ' on' : ''}" data-action="rw-set" data-k="${k}" data-v="${v}">${esc(Array.isArray(x) ? x[0] : x)}</button>`).join('')).join('') + `<button class="rw-opt${L.blush ? ' on' : ''}" data-action="rw-set" data-k="blush" data-v="${L.blush ? '' : '1'}">Blush</button>`;
  else grid = Object.entries(opts).map(([v, label]) => `<button class="rw-opt${cur === v ? ' on' : ''}" data-action="rw-set" data-k="${cat}" data-v="${v}">${esc(label)}</button>`).join('');
  const ideas = Object.entries(th[3]).filter(([k]) => k !== 'colors' && k !== 'rainbow').slice(0, 4).map(([k, vs]) => { const o = rwOpts(k); return o ? o[vs[0]] : k === 'hairC' ? `${vs[0]} hair` : ''; }).filter(Boolean);
  return `<div class="rw-theme"><span>${th[1]}</span><b>${esc(th[2])}</b><i class="rw-timer${left <= 30 ? ' low' : ''}" data-rwend="${rwEnd(g, D)}">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</i></div>
    <div class="game-stage rw-stage"><div class="rw-room">${rwModel(L, 'dressing')}${ui.rwIdeas ? `<div class="rw-ideas">💡 ${esc(ideas.join(' · '))}</div>` : ''}</div></div>
    <div class="rw-cats" data-noswipe>${RW_CATS.map(([k, e, l]) => `<button class="${cat === k ? 'on' : ''}" data-action="rw-cat" data-k="${k}"><span>${e}</span>${l}</button>`).join('')}</div>
    <div class="rw-grid${/C$/.test(cat) ? ' swatches' : ''}">${grid}</div>
    <div class="rw-actions"><button class="btn secondary" data-action="rw-ideas">💡 Ideas</button><button class="btn secondary" data-action="rw-random">🎲</button><button class="btn" data-action="rw-done" data-id="${g.id}">✨ Walk the runway</button></div>`;
}

/* ---------- Runway + voting ---------- */
function rwVoting(g, who) {
  const list = rwModels(g).filter((m) => m.id !== who), th = rwTheme(g);
  const V = ui.rwv && ui.rwv.key === g.id + ':' + who ? ui.rwv : (ui.rwv = { key: g.id + ':' + who, i: 0, stars: {} });
  if (V.i >= list.length) {
    return `<div class="rw-wait"><p><b>All rated! 🎉</b></p><div class="rw-sum">${list.map((m) => `<span>${esc(m.e)} ${esc(m.name)} ${'⭐'.repeat(V.stars[m.id] || 0)}</span>`).join('')}</div>
      <div class="btn-row"><button class="btn secondary" data-action="rw-back">↩️ Change</button><button class="btn" data-action="rw-send" data-id="${g.id}">Send my votes</button></div></div>`;
  }
  const m = list[V.i], s = V.stars[m.id] || 0;
  return `<div class="rw-theme small"><span>${th[1]}</span><b>${esc(th[2])}</b><i>${V.i + 1} / ${list.length}</i></div>
    <div class="game-stage rw-stage"><div class="rw-runway" data-k="${V.i}"><div class="rw-lights"></div>${rwModel(m.look, 'walk')}<div class="rw-name">${esc(m.e)} ${esc(m.name)}${m.bot ? ' <small>robot model</small>' : ''}</div></div></div>
    <div class="rw-stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= s ? 'on' : ''}" data-action="rw-star" data-n="${n}" data-m="${m.id}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
    ${V.i ? '<div style="text-align:center"><button class="link-inline" data-action="rw-back">‹ Back</button></div>' : ''}`;
}
function rwPodium(g) {
  const R = rwResults(g), th = rwTheme(g), me = actor();
  const pod = [R[1], R[0], R[2]].filter(Boolean);
  const mine = R.find((r) => r.id === me);
  return `<div class="rw-theme small"><span>${th[1]}</span><b>${esc(th[2])}</b><i>Results</i></div>
    <div class="rw-podium">${pod.map((r) => { const k = R.indexOf(r); return `<div class="rw-pod p${k + 1}">${rwModel(r.look, 'pose')}<div class="rw-pbase"><b>${['🥇', '🥈', '🥉'][k]}</b><span>${esc(r.e)} ${esc(r.name)}</span><small>⭐ ${r.avg.toFixed(1)}</small></div></div>`; }).join('')}</div>
    ${mine ? `<p class="rw-mine">Your look: <b>⭐ ${mine.avg.toFixed(1)}</b> · #${R.indexOf(mine) + 1} of ${R.length} · theme match ${Math.round(mine.fit * 10)}%</p>` : ''}
    <div class="rw-gallery">${R.slice(3).map((r, i) => `<div>${rwModel(r.look, 'mini')}<b>#${i + 4} ${esc(r.name)}</b><small>⭐ ${r.avg.toFixed(1)}</small></div>`).join('')}</div>`;
}

/* ---------- Actions ---------- */
Object.assign(actions, {
  'rw-cat': (el) => { if (ui.rw) { ui.rw.cat = el.dataset.k; render(); } },
  'rw-set': (el) => {
    const D = ui.rw; if (!D) return;
    const k = el.dataset.k, v = el.dataset.v;
    if (RW_FX[k]) D.look.fx = { ...D.look.fx, [k]: v };
    else if (/C$/.test(k) && k !== 'hairC') D.look[k] = Number(v);
    else if (k === 'blush') D.look.blush = !!v;
    else D.look[k] = v;
    gBuzz(); render();
  },
  'rw-ideas': () => { ui.rwIdeas = !ui.rwIdeas; render(); },
  'rw-random': () => { const D = ui.rw; if (!D) return; const g = findIn(state.games, D.gid); const L = rwRobotLook(rwTheme(g), Math.random()); D.look = { ...D.look, ...L, skin: D.look.skin, eyeC: D.look.eyeC, facial: D.look.facial }; gBuzz(); render(); },
  'rw-done': (el) => {
    const g = findIn(state.games, el.dataset.id), who = g && mpActor(g), D = ui.rw;
    if (!who || !D) return;
    if (mpDo(g, who, { look: JSON.parse(JSON.stringify(D.look)) })) { ui.rw = null; ui.rwIdeas = false; toast('💅 Look locked in!'); }
  },
  'rw-star': (el) => {
    const V = ui.rwv; if (!V) return;
    V.stars[el.dataset.m] = Number(el.dataset.n); gBuzz();
    document.querySelectorAll('.rw-stars button').forEach((b, i) => b.classList.toggle('on', i < Number(el.dataset.n)));
    clearTimeout(ui.rwT); ui.rwT = setTimeout(() => { V.i++; render(); }, 450);
  },
  'rw-back': () => { const V = ui.rwv; if (V && V.i > 0) { V.i--; render(); } },
  'rw-send': (el) => {
    const g = findIn(state.games, el.dataset.id), who = g && mpActor(g), V = ui.rwv;
    if (!who || !V) return;
    if (mpDo(g, who, { votes: { ...V.stars } })) { ui.rwv = null; if (rwPhase(g) === 'done') setTimeout(confetti, 300); }
  },
  'rw-skip': (el) => {
    const g = findIn(state.games, el.dataset.id); if (!g) return;
    const ph = rwPhase(g);
    for (const x of g.p) if (!g.out?.[x] && (ph === 'dress' ? !g.looks[x] : !g.votes[x])) g.out = { ...(g.out || {}), [x]: true };
    g.lastAt = Date.now(); mpFinish(g); save(); render();
  },
});
for (const a of ['rw-cat', 'rw-set', 'rw-ideas', 'rw-random', 'rw-done', 'rw-star', 'rw-back', 'rw-send', 'rw-skip']) KID_ACTIONS.add(a);
if (typeof ARCADE !== 'undefined' && !ARCADE.includes('runway')) ARCADE.push('runway');
// Dressing room timer: tick the clock, and when time's up the look goes out as it is
let rwTick = 0;
const _afterRenderRw = afterRender;
afterRender = function () {
  _afterRenderRw();
  clearInterval(rwTick);
  const t = document.querySelector('[data-rwend]');
  if (!t) return;
  const end = Number(t.dataset.rwend);
  rwTick = setInterval(() => {
    const el = document.querySelector('[data-rwend]'); if (!el) { clearInterval(rwTick); return; }
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('low', left <= 30);
    if (!left) { clearInterval(rwTick); const D = ui.rw, g = D && findIn(state.games, D.gid), who = g && mpActor(g); if (who) { mpDo(g, who, { look: JSON.parse(JSON.stringify(D.look)) }); ui.rw = null; toast('⏰ Time’s up — to the runway!'); } }
  }, 500);
};
