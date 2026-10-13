/* Pets: every kid hatches and raises their own little creature. Its tummy, fun, cleanliness and energy
   drop as real time passes (slower while it sleeps at night), it poops, it can get sick if it's ignored for a
   long time — but it never dies: it just gets sad and asks for help, and medicine always fixes it.
   Good care grows it from baby to grown-up. Grown-ups can check on (and help with) every kid's pet.
   Loaded after arcade.js. */
'use strict';

const PET_KINDS = {
  mochi: { name: 'Mochi', c1: '#ff9ec7', c2: '#ff6fa8', egg: '#ffd1e3', blurb: 'A squishy, giggly blob' },
  ember: { name: 'Ember', c1: '#ffb36b', c2: '#ff7a3d', egg: '#ffe0b8', blurb: 'A tiny friendly dragon' },
  puff: { name: 'Puff', c1: '#9fd3ff', c2: '#5aa9f0', egg: '#d6ecff', blurb: 'A fluffy cloud bunny' },
  sprout: { name: 'Sprout', c1: '#a6e38f', c2: '#5fbf4a', egg: '#dcf5d0', blurb: 'A cheerful leaf buddy' },
};
const PET_STAGES = [['baby', 'Baby', 0, 0], ['child', 'Kid', 1, 40], ['teen', 'Big kid', 3, 150], ['adult', 'Grown-up', 7, 350]]; // [id, label, days old, xp]
// Change per hour while awake / asleep
const PET_RATE = { awake: { food: -7, fun: -6, clean: -2.5, energy: -5 }, sleep: { food: -1.5, fun: -.5, clean: -.5, energy: 20 } };
const PET_STEP = 10 * 60000;
const petNight = (ts) => { const h = new Date(ts).getHours(); return h >= 21 || h < 7; };
const petAsleep = (p, ts = Date.now()) => petNight(ts) || ts < (p.nap || 0);
const petOf = (kid) => (state.pets || {})[kid] || null;
const clamp100 = (v) => Math.max(0, Math.min(100, v));

// Bring a pet's numbers up to now (10-minute steps; at most two weeks back)
function petNow(p, now = Date.now()) {
  if (!p || !p.born) return p;
  const q = JSON.parse(JSON.stringify(p));
  let ts = Math.max(q.t || now, now - 14 * 86400000);
  while (ts + PET_STEP <= now) {
    const asleep = petAsleep(q, ts), R = asleep ? PET_RATE.sleep : PET_RATE.awake, h = PET_STEP / 3600000;
    for (const k of Object.keys(R)) q.s[k] = clamp100(q.s[k] + R[k] * h * (k === 'fun' && q.sick ? 2 : 1));
    if (q.poop) q.s.clean = clamp100(q.s.clean - 3 * q.poop * h);
    if (!asleep) {
      q.pend = (q.pend || []).map((x) => x + PET_STEP);
      const due = q.pend.filter((x) => x >= 2 * 3600000).length;
      if (due) { q.poop = Math.min(4, (q.poop || 0) + due); q.pend = q.pend.filter((x) => x < 2 * 3600000); }
    }
    const bad = Math.min(q.s.food, q.s.fun, q.s.clean) < 10 || (q.poop || 0) >= 3;
    q.bad = bad ? (q.bad || 0) + h : Math.max(0, (q.bad || 0) - h);
    if (q.bad >= 6) q.sick = true;
    ts += PET_STEP;
  }
  q.t = ts;
  return q;
}
const petAge = (p) => (Date.now() - p.born) / 86400000;
const petStage = (p) => { let s = PET_STAGES[0]; for (const x of PET_STAGES) if (petAge(p) >= x[2] && (p.xp || 0) >= x[3]) s = x; return s; };
function petMood(p) {
  if (!p.born) return 'egg';
  if (p.sick) return 'sick';
  if (petAsleep(p)) return 'sleep';
  const v = Object.values(p.s), lo = Math.min(...v);
  if (lo < 25) return 'sad';
  return v.reduce((a, b) => a + b, 0) / v.length > 70 ? 'happy' : 'ok';
}
function petNeed(p) {
  if (!p || !p.born) return '';
  if (p.sick) return 'I don’t feel good 🤒';
  if (petAsleep(p)) return petNight(Date.now()) ? 'Zzz… sleeping till 7am' : 'Zzz… taking a nap';
  if (p.s.food < 30) return 'I’m hungry! 🍎';
  if ((p.poop || 0) >= 1 && p.s.clean < 60) return 'Eww… bath time? 🛁';
  if (p.s.clean < 30) return 'I’m all muddy! 🛁';
  if (p.s.fun < 30) return 'Play with me! 🎾';
  if (p.s.energy < 25) return 'So sleepy… 😴';
  return ['I love you! 💖', 'Today is a good day ☀️', 'Hehe! 😊', 'You’re the best!', 'Boop! 👉'][Math.floor(Date.now() / 600000) % 5];
}
const petNeedy = (p) => !!p && p.born && (p.sick || (!petAsleep(p) && (p.s.food < 30 || p.s.fun < 30 || p.s.clean < 30 || (p.poop || 0) >= 2)));

/* ---------- Art: one SVG, shaped by kind, stage and mood ---------- */
function petSVG(p, opts = {}) {
  const K = PET_KINDS[p.kind] || PET_KINDS.mochi;
  if (!p.born) {
    const cr = Math.min(3, Math.floor((p.taps || 0) / 4));
    return `<svg viewBox="0 0 100 100" class="pet-svg egg${opts.wobble ? ' wobble' : ''}"><ellipse cx="50" cy="90" rx="22" ry="4" fill="rgba(0,0,0,.12)"/><path d="M50 18c16 0 26 24 26 42s-11 28-26 28-26-10-26-28 10-42 26-42z" fill="${K.egg}" stroke="${K.c2}" stroke-width="2"/><circle cx="40" cy="48" r="5" fill="${K.c1}"/><circle cx="60" cy="62" r="6" fill="${K.c1}"/><circle cx="46" cy="74" r="3.5" fill="${K.c1}"/>${cr ? `<path d="M30 50l7 5 5-6 6 7 5-5 6 6 7-4" fill="none" stroke="#7c5a3a" stroke-width="1.6" opacity="${.35 + cr * .2}"/>` : ''}${cr > 1 ? '<path d="M38 66l5 4 4-5 5 4" fill="none" stroke="#7c5a3a" stroke-width="1.4"/>' : ''}</svg>`;
  }
  const st = petStage(p)[0], mood = opts.mood || petMood(p), sc = { baby: .72, child: .84, teen: .94, adult: 1 }[st];
  const sick = mood === 'sick', c1 = sick ? '#c7e3a1' : K.c1, c2 = sick ? '#9cc46e' : K.c2;
  const W = 34 * sc, H = 30 * sc + (st === 'teen' || st === 'adult' ? 4 : 0), cy = 92 - H;
  // features per kind
  let extra = '';
  if (p.kind === 'puff') extra = `<ellipse cx="${50 - W * .45}" cy="${cy - H * .55}" rx="${5 * sc}" ry="${16 * sc}" fill="${c1}" stroke="${c2}" stroke-width="1.5" transform="rotate(-12 ${50 - W * .45} ${cy - H * .55})"/><ellipse cx="${50 + W * .45}" cy="${cy - H * .55}" rx="${5 * sc}" ry="${16 * sc}" fill="${c1}" stroke="${c2}" stroke-width="1.5" transform="rotate(12 ${50 + W * .45} ${cy - H * .55})"/>`;
  if (p.kind === 'ember') extra = `<path d="M${50 - W * .5} ${cy - H * .55}l-4 -12 9 7z M${50 + W * .5} ${cy - H * .55}l4 -12 -9 7z" fill="${c2}"/><path d="M${50 + W * .95} ${cy + H * .1}q14 -6 10 -18 q-2 9 -10 10z" fill="${c2}"/>${st !== 'baby' ? `<path d="M${50 - W * .95} ${cy}q-12 -10 -6 -18 q3 10 8 12z" fill="${c1}" stroke="${c2}" stroke-width="1"/>` : ''}`;
  if (p.kind === 'sprout') extra = `<path d="M50 ${cy - H * .95}q-2 -10 6 -14" stroke="#3f8f2f" stroke-width="2" fill="none"/><path d="M55 ${cy - H * .95 - 13}q12 -6 16 4 q-10 4 -16 -4z" fill="#5fbf4a"/>${st !== 'baby' ? `<path d="M52 ${cy - H * .95 - 6}q-12 -6 -15 3 q9 3 15 -3z" fill="#7fd36a"/>` : ''}`;
  if (p.kind === 'mochi') extra = `<circle cx="${50 - W * .55}" cy="${cy - H * .6}" r="${4 * sc}" fill="${c2}"/><circle cx="${50 + W * .55}" cy="${cy - H * .6}" r="${4 * sc}" fill="${c2}"/>`;
  const ey = cy - H * .15, ex = W * .38, ew = 4.2 * sc;
  const eyes = mood === 'sleep' ? `<path d="M${50 - ex - ew} ${ey}q${ew} 3 ${ew * 2} 0M${50 + ex - ew} ${ey}q${ew} 3 ${ew * 2} 0" stroke="#3b2a2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    : mood === 'happy' ? `<path d="M${50 - ex - ew} ${ey + 1}q${ew} -5 ${ew * 2} 0M${50 + ex - ew} ${ey + 1}q${ew} -5 ${ew * 2} 0" stroke="#3b2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : sick ? `<path d="M${50 - ex - 3} ${ey - 3}l6 6m0 -6l-6 6M${50 + ex - 3} ${ey - 3}l6 6m0 -6l-6 6" stroke="#3b2a2a" stroke-width="1.7" stroke-linecap="round"/>`
    : `<circle cx="${50 - ex}" cy="${ey}" r="${ew * .75}" fill="#3b2a2a"/><circle cx="${50 + ex}" cy="${ey}" r="${ew * .75}" fill="#3b2a2a"/><circle cx="${50 - ex + 1}" cy="${ey - 1.2}" r="1.1" fill="#fff"/><circle cx="${50 + ex + 1}" cy="${ey - 1.2}" r="1.1" fill="#fff"/>${mood === 'sad' ? `<path d="M${50 - ex - 5} ${ey - 7}l7 2M${50 + ex + 5} ${ey - 7}l-7 2" stroke="#3b2a2a" stroke-width="1.4" stroke-linecap="round"/><path d="M${50 + ex + 2} ${ey + 4}q2 4 0 6q-2 -2 0 -6z" fill="#6cc4ff"/>` : ''}`;
  const my = ey + 8 * sc;
  const mouth = opts.eating ? `<ellipse cx="50" cy="${my + 1}" rx="${4 * sc}" ry="${3.5 * sc}" fill="#7a2e3a"/>`
    : mood === 'happy' ? `<path d="M${50 - 5 * sc} ${my}q${5 * sc} ${6 * sc} ${10 * sc} 0z" fill="#7a2e3a"/>`
    : mood === 'sad' || sick ? `<path d="M${50 - 4 * sc} ${my + 3}q${4 * sc} -4 ${8 * sc} 0" stroke="#3b2a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    : mood === 'sleep' ? `<circle cx="50" cy="${my + 1}" r="${1.6 * sc}" fill="#7a2e3a"/>` : `<path d="M${50 - 3.5 * sc} ${my}q${3.5 * sc} 3 ${7 * sc} 0" stroke="#3b2a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const cheeks = mood !== 'sick' ? `<ellipse cx="${50 - ex - 4}" cy="${ey + 6}" rx="3.2" ry="2" fill="#ff7b9c" opacity=".45"/><ellipse cx="${50 + ex + 4}" cy="${ey + 6}" rx="3.2" ry="2" fill="#ff7b9c" opacity=".45"/>` : '';
  const crown = st === 'adult' ? `<path d="M${50 - 9} ${cy - H * .98}l3 -9 4 5 2 -7 2 7 4 -5 3 9z" fill="#facc15" stroke="#d97706" stroke-width="1"/>` : '';
  const feet = `<ellipse cx="${50 - W * .5}" cy="91" rx="${5.5 * sc}" ry="3.2" fill="${c2}"/><ellipse cx="${50 + W * .5}" cy="91" rx="${5.5 * sc}" ry="3.2" fill="${c2}"/>`;
  const zz = mood === 'sleep' ? '<text x="70" y="30" class="pet-z" font-size="10">z</text><text x="77" y="20" class="pet-z z2" font-size="13">Z</text>' : '';
  const sickB = sick ? '<text x="70" y="34" font-size="12">🤒</text>' : '';
  return `<svg viewBox="0 0 100 100" class="pet-svg ${mood}${opts.eating ? ' eat' : ''}"><ellipse cx="50" cy="94" rx="${W * .8}" ry="2.6" fill="rgba(0,0,0,.1)"/><g class="pet-body">${extra}${feet}<path d="M${50 - W} 78 C${50 - W} ${cy - H * .3} ${50 - W * .6} ${cy - H} 50 ${cy - H} S${50 + W} ${cy - H * .3} ${50 + W} 78 C${50 + W} 89 ${50 + W * .55} 92 50 92 S${50 - W} 89 ${50 - W} 78 Z" fill="${c1}" stroke="${c2}" stroke-width="2"/><ellipse cx="50" cy="${88 - H * .14}" rx="${W * .5}" ry="${H * .2}" fill="#fff" opacity=".35"/>${eyes}${cheeks}${mouth}${crown}</g>${zz}${sickB}</svg>`;
}

/* ---------- Saving: settle to now, change, save ---------- */
function petEdit(kid, fn) {
  const pets = (state.pets ||= {});
  const p = petNow(pets[kid]);
  const r = fn(p);
  if (r === false) return false;
  p.t = Date.now();
  pets[kid] = p;
  save();
  return true;
}
const petXP = (p, needed) => { if (!needed) return; const d = today(); if (p.xpDay !== d) { p.xpDay = d; p.xpToday = 0; } if (p.xpToday >= 60) return; p.xp = (p.xp || 0) + 5; p.xpToday += 5; };

/* ---------- Screens ---------- */
Object.assign(TITLES, { pet: 'My pet', pets: 'Pets' });
const petKid = (param) => param || kidModeId() || (isKidMember(actor()) ? actor() : '') || '';
views.pets = () => {
  const ks = state.members.filter((m) => m.kid);
  if (!ks.length) return '<div class="card empty">Pets belong to kids — add a kid in Family first.</div>';
  return `<div class="pet-list">${ks.map((m) => {
    const p = petNow(petOf(m.id));
    return `<button class="card pet-card" data-action="go" data-to="pet/${m.id}"><div class="pet-mini">${p ? petSVG(p) : '<span style="font-size:40px">🥚</span>'}</div><div class="grow"><b>${p ? esc(p.name || PET_KINDS[p.kind].name) : 'No pet yet'}</b><div class="small muted">${esc(m.emoji)} ${esc(m.name)}’s${p && p.born ? ` · ${petStage(p)[1]}` : ''}</div>${p && p.born ? `<div class="small${petNeedy(p) ? ' pet-alert' : ''}">${esc(petNeed(p))}</div>` : `<div class="small muted">${p ? 'Egg waiting to hatch' : 'Tap to pick an egg'}</div>`}</div>${ICON.chev}</button>`;
  }).join('')}</div>`;
};
views.pet = (param) => {
  const kid = petKid(param);
  if (!kid) return views.pets();
  const m = member(kid), raw = petOf(kid);
  if (!raw) { // pick an egg
    return `<div class="pet-pick"><p style="text-align:center;margin:0 0 12px"><b>${esc(m.name)}, pick your egg!</b><br><span class="small muted">Each one hatches a different friend.</span></p>
      <div class="pet-eggs">${Object.entries(PET_KINDS).map(([k, K]) => `<button class="pet-egg" data-action="pet-egg" data-kid="${kid}" data-k="${k}">${petSVG({ kind: k })}<b>${esc(K.name)}</b><small>${esc(K.blurb)}</small></button>`).join('')}</div></div>`;
  }
  const p = petNow(raw), K = PET_KINDS[p.kind];
  if (!p.born) {
    return `<div class="pet-room day"><div class="pet-stage" data-action="pet-warm" data-kid="${kid}">${petSVG(p, { wobble: ui.petWobble })}</div></div>
      <p style="text-align:center"><b>Tap the egg to keep it warm!</b><br><span class="small muted">${Math.max(0, 12 - (p.taps || 0))} more taps to hatch</span></p>`;
  }
  const mood = petMood(p), asleep = petAsleep(p), night = petNight(Date.now()), act = ui.petAct && ui.petAct.kid === kid && Date.now() - ui.petAct.t < 1600 ? ui.petAct.a : '';
  const bar = (k, e, label) => `<div class="pet-bar" title="${label}"><span>${e}</span><i style="--v:${Math.round(p.s[k])}%;--c:${p.s[k] < 30 ? '#ef4444' : p.s[k] < 60 ? '#f59e0b' : '#22c55e'}"></i></div>`;
  const st = petStage(p), next = PET_STAGES[PET_STAGES.indexOf(st) + 1];
  if (ui.petGame && ui.petGame.kid === kid) return petGameView(p, kid);
  const btn = (a, e, label, dis) => `<button class="pet-btn" data-action="pet-${a}" data-kid="${kid}" ${dis ? 'disabled' : ''}><span>${e}</span>${label}</button>`;
  return `<div class="pet-head"><b>${esc(p.name)}</b> <span class="small muted">${esc(K.name)} · ${st[1]} · ${Math.floor(petAge(p))} day${Math.floor(petAge(p)) === 1 ? '' : 's'} old</span></div>
    <div class="pet-bars">${bar('food', '🍎', 'Tummy')}${bar('fun', '🎾', 'Fun')}${bar('clean', '🛁', 'Clean')}${bar('energy', '⚡', 'Energy')}</div>
    <div class="game-stage pet-stagewrap"><div class="pet-room ${night ? 'night' : 'day'}${asleep ? ' dark' : ''}">
      <div class="pet-bubble">${esc(act === 'feed' ? 'Yum yum! 😋' : act === 'treat' ? 'A treat!! 🍪' : act === 'full' ? 'I’m full! 🙅' : act === 'bath' ? 'So fresh! ✨' : act === 'med' ? 'I feel better! 💪' : act === 'love' ? '💖💖💖' : act === 'tummy' ? 'Too many treats… 🤢' : petNeed(p))}</div>
      <div class="pet-stage${act === 'love' ? ' loved' : ''}" data-action="pet-love" data-kid="${kid}">${petSVG(p, { eating: act === 'feed' || act === 'treat' })}${act === 'love' ? '<span class="pet-hearts">💖</span>' : ''}</div>
      <div class="pet-poops">${'<span>💩</span>'.repeat(p.poop || 0)}</div>
    </div></div>
    <div class="pet-actions">
      ${btn('feed', '🍎', 'Meal', asleep)}${btn('treat', '🍪', 'Treat', asleep)}${btn('play', '🎾', 'Play', asleep || p.sick)}${btn('bath', '🛁', 'Bath', asleep)}
      ${p.sick ? btn('med', '💊', 'Medicine') : night ? btn('noop', '🌙', 'Night', true) : asleep ? btn('wake', '☀️', 'Wake up') : btn('nap', '😴', 'Nap')}
    </div>
    ${next ? `<p class="small muted pet-grow">Grows into a ${next[1]} ${Math.floor(petAge(p)) < next[2] ? `in ${Math.ceil(next[2] - petAge(p))} day${Math.ceil(next[2] - petAge(p)) === 1 ? '' : 's'}` : 'soon'} with good care · ⭐ ${p.xp || 0}/${next[3]}</p>` : `<p class="small muted pet-grow">All grown up! 👑 ⭐ ${p.xp || 0}</p>`}`;
};
// Play: "Which way will I look?" — five rounds
function petGameView(p, kid) {
  const G = ui.petGame, done = G.round >= 5;
  const dir = G.last ? G.last.dir : '';
  return `<div class="pet-head"><b>Which way will ${esc(p.name)} look?</b><div class="small muted">Round ${Math.min(5, G.round + 1)} of 5 · ⭐ ${G.score}</div></div>
    <div class="game-stage pet-stagewrap"><div class="pet-room day"><div class="pet-stage look-${dir}">${petSVG(p, { mood: G.last ? (G.last.win ? 'happy' : 'ok') : 'ok' })}</div>
      ${G.last ? `<div class="pet-bubble">${G.last.win ? 'You got it! 🎉' : 'Hehe, nope! 🙃'}</div>` : ''}</div></div>
    ${done ? `<div class="btn-row"><button class="btn" data-action="pet-gamedone" data-kid="${kid}">${G.score >= 3 ? 'Yay! 🎉' : 'Fun! 😊'} Done</button></div>`
      : `<div class="pet-actions two"><button class="pet-btn big" data-action="pet-guess" data-kid="${kid}" data-d="left"><span>👈</span>Left</button><button class="pet-btn big" data-action="pet-guess" data-kid="${kid}" data-d="right"><span>👉</span>Right</button></div>`}`;
}
const petFlash = (kid, a) => { ui.petAct = { kid, a, t: Date.now() }; gBuzz(); render(); setTimeout(() => { if (ui.petAct && Date.now() - ui.petAct.t >= 1500 && currentRoute().name === 'pet') { ui.petAct = null; render(); } }, 1650); };

Object.assign(actions, {
  'pet-egg': (el) => {
    const kid = el.dataset.kid, k = el.dataset.k, K = PET_KINDS[k];
    openSheet({
      title: `Name your ${K.name}`, saveLabel: 'Hatch it! 🥚', values: { name: K.name },
      fields: [{ type: 'html', html: `<div style="width:110px;margin:0 auto">${petSVG({ kind: k })}</div>` }, { name: 'name', label: 'Name', required: true, placeholder: K.name }],
      onSave(v) { (state.pets ||= {})[kid] = { kind: k, name: String(v.name).trim().slice(0, 16) || K.name, taps: 0, egg: Date.now() }; },
    });
  },
  'pet-warm': (el) => {
    const kid = el.dataset.kid, p = state.pets[kid];
    if (!p || p.born) return;
    p.taps = (p.taps || 0) + 1; gBuzz();
    if (p.taps >= 12) {
      Object.assign(p, { born: Date.now(), t: Date.now(), s: { food: 70, fun: 80, clean: 100, energy: 90 }, xp: 0, poop: 0, pend: [] });
      setTimeout(confetti, 200); toast(`${p.name} hatched! 🐣`);
      logAct('🐣', `hatched a pet: ${p.name}`, 'pets');
    }
    ui.petWobble = true; save(); render(); setTimeout(() => { ui.petWobble = false; }, 400);
  },
  'pet-feed': (el) => petEdit(el.dataset.kid, (p) => {
    if (p.s.food > 90) { setTimeout(() => petFlash(el.dataset.kid, 'full')); return false; }
    petXP(p, p.s.food < 80); p.s.food = clamp100(p.s.food + 35); (p.pend ||= []).push(0); setTimeout(() => petFlash(el.dataset.kid, 'feed'));
  }),
  'pet-treat': (el) => petEdit(el.dataset.kid, (p) => {
    p.treats = (p.treats || []).filter((x) => Date.now() - x < 6 * 3600000);
    if (p.s.food > 95) { setTimeout(() => petFlash(el.dataset.kid, 'full')); return false; }
    p.treats.push(Date.now());
    if (p.treats.length > 3) { p.s.fun = clamp100(p.s.fun - 10); setTimeout(() => petFlash(el.dataset.kid, 'tummy')); return; }
    petXP(p, p.s.fun < 80); p.s.food = clamp100(p.s.food + 12); p.s.fun = clamp100(p.s.fun + 15); setTimeout(() => petFlash(el.dataset.kid, 'treat'));
  }),
  'pet-bath': (el) => petEdit(el.dataset.kid, (p) => { petXP(p, p.s.clean < 80 || p.poop); p.s.clean = 100; p.poop = 0; setTimeout(() => petFlash(el.dataset.kid, 'bath')); }),
  'pet-med': (el) => petEdit(el.dataset.kid, (p) => { petXP(p, true); p.sick = false; p.bad = 0; p.s.food = Math.max(p.s.food, 30); p.s.clean = Math.max(p.s.clean, 30); p.s.fun = Math.max(p.s.fun, 30); setTimeout(() => petFlash(el.dataset.kid, 'med')); }),
  'pet-nap': (el) => petEdit(el.dataset.kid, (p) => { petXP(p, p.s.energy < 50); p.nap = Date.now() + 3600000; setTimeout(render); }),
  'pet-wake': (el) => petEdit(el.dataset.kid, (p) => { p.nap = 0; setTimeout(render); }),
  'pet-noop': () => {},
  'pet-love': (el) => {
    const kid = el.dataset.kid, p = petNow(petOf(kid));
    if (!p || !p.born || petAsleep(p)) return;
    if (Date.now() - (ui.petLoveAt || 0) > 20000) { ui.petLoveAt = Date.now(); petEdit(kid, (q) => { q.s.fun = clamp100(q.s.fun + 3); }); }
    petFlash(kid, 'love');
  },
  'pet-play': (el) => { ui.petGame = { kid: el.dataset.kid, round: 0, score: 0, last: null }; render(); },
  'pet-guess': (el) => {
    const G = ui.petGame; if (!G || G.round >= 5) return;
    const dir = Math.random() < .5 ? 'left' : 'right', win = dir === el.dataset.d;
    G.round++; if (win) G.score++; G.last = { dir, win }; gBuzz(); render();
  },
  'pet-gamedone': (el) => {
    const G = ui.petGame, kid = el.dataset.kid;
    ui.petGame = null;
    petEdit(kid, (p) => { petXP(p, p.s.fun < 80); p.s.fun = clamp100(p.s.fun + (G.score >= 3 ? 35 : 20)); p.s.energy = clamp100(p.s.energy - 8); });
    if (G.score === 5) setTimeout(confetti, 150);
    petFlash(kid, 'love');
  },
});
KID_ROUTES.push('pet');
for (const a of ['pet-egg', 'pet-warm', 'pet-feed', 'pet-treat', 'pet-bath', 'pet-med', 'pet-nap', 'pet-wake', 'pet-noop', 'pet-love', 'pet-play', 'pet-guess', 'pet-gamedone']) KID_ACTIONS.add(a);
if (typeof PG_SKIP !== 'undefined') PG_SKIP.add('pet');
if (typeof HUB_OF !== 'undefined') { HUB_OF.pet = 'play'; HUB_OF.pets = 'play'; }
// Leaving the pet screen ends a half-played game
const _afterRenderPet = afterRender;
afterRender = function () { _afterRenderPet(); if (currentRoute().name !== 'pet' && ui.petGame) ui.petGame = null; };
const _modePet = modeClasses;
modeClasses = function () { _modePet(); if (currentRoute().name === 'pet') document.body.classList.add('game-mode'); };

// Launcher tiles: the kid's own pet on their home screen; grown-ups see "Pets" on Play
function petTile(kid) {
  const p = petNow(petOf(kid));
  return { to: 'pet', e: p && p.born ? `<span class="tile-pet">${petSVG(p)}</span>` : '🥚', label: p ? p.name : 'My pet', sub: !p ? 'Pick an egg!' : !p.born ? 'Hatch me!' : petNeedy(p) ? 'Needs you!' : 'Happy 😊', color: (PET_KINDS[p?.kind] || PET_KINDS.mochi).c2, badge: !p || !p.born || petNeedy(p) ? '!' : '' };
}
function petsTile() {
  const ks = state.members.filter((m) => m.kid), needy = ks.filter((m) => petNeedy(petNow(petOf(m.id)))).length;
  return ks.length ? { to: 'pets', e: '🐣', label: 'Pets', sub: needy ? `${needy} need${needy > 1 ? '' : 's'} care` : 'Check in', color: '#f472b6', badge: needy || '' } : null;
}

// A nudge on the kid's phone when the pet needs them (at most every 4 hours, never at night or in quiet hours)
if (typeof window.notifyPlan === 'function') {
  const _planPet = window.notifyPlan;
  window.notifyPlan = notifyPlan = function (log = {}, members = [], opts = {}) {
    const out = _planPet(log, members, opts);
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes(), block = `${today()}:${Math.floor(now.getHours() / 4)}`;
    for (const mid of members) {
      if (!isKidMember(mid)) continue;
      const p = petNow(petOf(mid));
      if (!petNeedy(p) || petNight(Date.now())) continue;
      const P = notifyPrefs(mid);
      if (!P.family.on || (P.quiet.on && npQuiet(mins, P.quiet) && !opts.force)) continue;
      const key = `pet:${mid}:${block}`;
      if (!opts.force && log[key]) continue;
      out.push({ member: mid, kind: 'pet', tag: 'pet', title: `🐾 ${p.name} needs you!`, body: petNeed(p), url: '#pet', key, mark: { [key]: Date.now() } });
    }
    return out;
  };
}
// Big-kid home: the pet sits right before Squishvale (little kids get it in their own launcher)
const _kidPet = views.kid;
views.kid = () => {
  const html = _kidPet(), id = kidModeId();
  if (!id || html.includes('data-to="pet"')) return html;
  const t = tileHTML(typeof lockTile === 'function' ? lockTile(petTile(id), id) : petTile(id));
  const at = html.search(/<button class="tile[^"]*" data-action="[^"]*" data-to="world"/);
  return at >= 0 ? html.slice(0, at) + t + html.slice(at) : html.replace(/<div class="launch( big)?">/, (m) => m + t);
};
