/* Runway Ready 👗 — a dress-up fashion show (inspired by dress-up games kids love; original name and art).
   A theme spins up, everyone gets a few minutes in the dressing room to style their own avatar (every item is
   free in here, plus runway extras: hats, wings, necklaces, props and auras) and pick a signature pose. Then each
   model walks the runway, robot judges react, and everyone gives 1–5 stars. Results are revealed 3rd → 1st with
   scorecards, and favourite looks can be saved to a Lookbook. Runs on the arcade engine (arcade.js): own phones,
   pass the phone, or solo. Loaded after ux3.js. */
'use strict';

/* ---------- Wardrobe ---------- */
const RW_FX = {
  head: { '': 'None', tophat: '🎩 Top hat', witch: '🧙 Witch hat', chef: '👨‍🍳 Chef hat', flowercrown: '🌼 Flower crown', party: '🥳 Party hat', sunhat: '👒 Sun hat', helmet: '🧑‍🚀 Space helmet' },
  back: { '': 'None', wings: '🧚 Fairy wings', angel: '😇 Angel wings', bat: '🦇 Bat wings', butterfly: '🦋 Butterfly wings', jetpack: '🚀 Jetpack' },
  neck: { '': 'None', pearls: '📿 Pearls', scarf: '🧣 Scarf', bowtie: '🎀 Bow tie', lei: '🌺 Flower lei', medal: '🥇 Gold medal', chain: '⛓️ Gold chain' },
  hand: { '': 'None', bag: '👜 Handbag', wand: '🪄 Wand', mic: '🎤 Mic', bouquet: '💐 Bouquet', umbrella: '☂️ Umbrella', ball: '⚽ Ball', pail: '🎃 Candy pail', lantern: '🏮 Lantern', whisk: '🥄 Whisk' },
  aura: { '': 'None', sparkle: '✨ Sparkles', hearts: '💖 Hearts', snow: '❄️ Snowflakes', stars: '⭐ Stars', bubbles: '🫧 Bubbles', leaves: '🍂 Leaves', notes: '🎵 Music', confetti: '🎉 Confetti' },
};
const RW_AURA = { sparkle: '✨', hearts: '💖', snow: '❄️', stars: '⭐', bubbles: '🫧', leaves: '🍂', notes: '🎵', confetti: '🎉' };
// Signature poses, struck at the end of the runway
const RW_POSES = { strut: ['😎', 'Power pose'], twirl: ['💫', 'Twirl'], hop: ['🐰', 'Bunny hop'], wave: ['👋', 'Wave'], peace: ['✌️', 'Peace out'], kiss: ['😘', 'Blow a kiss'], bow: ['🙇', 'Take a bow'] };
// The dressing room goes in 4 stages; each has at most 4 tabs, and colours sit right under the item they colour
const RW_STAGES = [
  ['👗', 'Outfit', [['top', 'Top'], ['bottom', 'Bottom'], ['shoes', 'Shoes'], ['graphic', 'Print']]],
  ['💇', 'Hair', [['hair', 'Style'], ['head', 'Hats'], ['acc', 'Accessories']]],
  ['✨', 'Extras', [['back', 'Wings'], ['neck', 'Neck'], ['hand', 'In hand'], ['aura', 'Aura']]],
  ['💃', 'Pose', [['pose', 'Pose'], ['eyes', 'Eyes'], ['mouth', 'Mouth'], ['book', 'Lookbook']]],
];
const RW_COLOR_OF = { top: 'topC', bottom: 'bottomC', shoes: 'shoesC', hair: 'hairC' };
const rwStageOf = (cat) => Math.max(0, RW_STAGES.findIndex((st) => st[2].some(([k]) => k === cat)));
const RW_HEADSHOT = new Set(['hair', 'hairC', 'head', 'acc', 'eyes', 'mouth']); // these preview as a close-up
const rwOpts = (cat) => {
  const lab = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  if (cat === 'hair') return lab(AV_HAIR); if (cat === 'top') return lab(AV_TOP); if (cat === 'graphic') return lab(AV_GRAPHIC);
  if (cat === 'bottom') return lab(AV_BOTTOM); if (cat === 'shoes') return lab(AV_SHOES); if (cat === 'acc') return lab(AV_ACC);
  if (RW_FX[cat]) return RW_FX[cat];
  return null;
};
// A friendly item name without its emoji ("🦇 Bat wings" → "bat wings")
const rwItemName = (k, v) => { if (k === 'hairC') return `${v} hair`; const l = String(rwOpts(k)?.[v] || v).replace(/^[^A-Za-z]+/, ''); return l.charAt(0).toLowerCase() + l.slice(1); };

/* ---------- Themes: what fits (judges score by these; the style meter and Ideas use them too) ---------- */
// colours are indexes into AV_CLOTH: 0 pink 1 orange 2 yellow 3 green 4 teal 5 blue 6 purple 7 white 8 black 9 magenta 10 sky 11 blush
const RW_THEMES = [
  ['beach', '🏖️', 'Beach Day', { top: ['tank', 'tee'], bottom: ['shorts'], shoes: ['sandals'], acc: ['sunglasses', 'flower'], head: ['sunhat'], colors: [2, 4, 10, 1] }],
  ['royal', '👑', 'Royal Ball', { top: ['gown', 'dress'], bottom: ['skirt'], acc: ['tiara', 'crown'], neck: ['pearls'], hand: ['wand'], aura: ['sparkle'], colors: [0, 6, 11, 7] }],
  ['hero', '🦸', 'Superhero', { top: ['cape', 'jacket'], bottom: ['leggings', 'pants'], shoes: ['boots'], acc: ['sunglasses'], aura: ['stars'], colors: [5, 9, 8] }],
  ['pajama', '😴', 'Pajama Party', { top: ['hoodie', 'sweater'], bottom: ['leggings', 'pants'], shoes: ['slippers'], acc: ['catears', 'bunnyears'], aura: ['hearts'], colors: [11, 10, 6] }],
  ['popstar', '🎤', 'Pop Star', { top: ['jacket', 'dress'], bottom: ['skirt', 'leggings'], shoes: ['boots'], acc: ['headphones', 'starclips', 'sunglasses'], hand: ['mic'], aura: ['notes', 'sparkle'], colors: [9, 6, 0] }],
  ['winter', '❄️', 'Winter Wonderland', { top: ['sweater', 'jacket', 'hoodie'], bottom: ['pants'], shoes: ['boots'], acc: ['beanie'], neck: ['scarf'], aura: ['snow'], colors: [7, 10, 5] }],
  ['sports', '⚽', 'Sports Day', { top: ['tee', 'tank'], bottom: ['shorts'], shoes: ['sneakers'], acc: ['cap', 'headphones'], hand: ['ball'], colors: [5, 3, 1] }],
  ['garden', '🌸', 'Garden Party', { top: ['dress'], bottom: ['skirt'], shoes: ['sandals'], head: ['flowercrown', 'sunhat'], hand: ['bouquet'], aura: ['hearts'], colors: [0, 3, 11] }],
  ['space', '🚀', 'Space Explorer', { top: ['jacket', 'overalls'], bottom: ['pants', 'leggings'], shoes: ['boots'], head: ['helmet'], back: ['jetpack'], hairC: ['galaxy', 'silver'], aura: ['stars'], colors: [6, 8, 7] }],
  ['rainbow', '🌈', 'Rainbow Everything', { hairC: ['rainbow'], graphic: ['rainbow'], aura: ['sparkle', 'confetti'], rainbow: true }],
  ['spooky', '🦇', 'Spooky Night', { top: ['cape', 'hoodie'], acc: ['catears'], head: ['witch'], back: ['bat'], aura: ['stars'], colors: [8, 6] }],
  ['fancy', '🍝', 'Fancy Dinner', { top: ['gown', 'dress', 'jacket'], shoes: ['boots'], head: ['tophat'], neck: ['pearls', 'bowtie'], hand: ['bag'], colors: [8, 7, 9] }],
  ['school', '🎒', 'Back to School', { top: ['tee', 'hoodie', 'overalls'], bottom: ['pants', 'skirt'], shoes: ['sneakers'], acc: ['glasses'], hand: ['bag'], colors: [5, 1, 3] }],
  ['rock', '🎸', 'Rock Concert', { top: ['jacket', 'tank'], bottom: ['pants'], shoes: ['boots'], acc: ['sunglasses'], hair: ['spiky'], neck: ['chain'], hand: ['mic'], colors: [8, 9] }],
  ['fairy', '🧚', 'Fairy Tale', { top: ['gown', 'dress'], acc: ['tiara', 'flower'], head: ['flowercrown'], back: ['wings', 'butterfly'], hand: ['wand'], aura: ['sparkle'], colors: [3, 11, 10] }],
  ['halloween', '🎃', 'Trick or Treat', { top: ['cape', 'hoodie'], head: ['witch'], back: ['bat'], hand: ['pail'], aura: ['leaves', 'stars'], colors: [1, 8, 6] }],
  ['chef', '👩‍🍳', 'Master Chef', { top: ['tee', 'jacket'], bottom: ['pants'], head: ['chef'], hand: ['whisk'], neck: ['scarf'], colors: [7, 8, 1] }],
  ['luau', '🌺', 'Island Luau', { top: ['tank', 'dress'], bottom: ['shorts', 'skirt'], shoes: ['sandals'], acc: ['flower'], neck: ['lei'], aura: ['bubbles'], colors: [3, 0, 1, 2] }],
  ['rainy', '🌧️', 'Rainy Day', { top: ['jacket', 'hoodie'], bottom: ['pants', 'leggings'], shoes: ['boots'], hand: ['umbrella'], aura: ['bubbles'], colors: [2, 5, 10] }],
  ['birthday', '🎂', 'Birthday Bash', { top: ['dress', 'tee'], graphic: ['star', 'heart'], head: ['party'], hand: ['bag'], aura: ['confetti'], colors: [0, 2, 4, 9] }],
  ['champion', '🏅', 'Gold Medal Champ', { top: ['tank', 'tee'], bottom: ['shorts', 'leggings'], shoes: ['sneakers'], neck: ['medal'], aura: ['stars'], colors: [2, 5, 0] }],
  ['premiere', '🎬', 'Movie Premiere', { top: ['gown', 'jacket'], acc: ['sunglasses'], neck: ['chain', 'pearls'], hand: ['bag'], aura: ['sparkle'], colors: [8, 7, 9] }],
  ['magic', '🔮', 'Magic School', { top: ['cape'], head: ['witch'], acc: ['glasses'], hand: ['wand'], aura: ['sparkle', 'stars'], colors: [6, 8, 9] }],
  ['camping', '🏕️', 'Camping Trip', { top: ['hoodie', 'overalls', 'jacket'], bottom: ['pants'], shoes: ['boots'], acc: ['beanie', 'cap'], hand: ['lantern'], aura: ['leaves'], colors: [3, 1, 8] }],
  ['disco', '🪩', 'Disco Night', { top: ['jacket', 'dress'], bottom: ['leggings', 'skirt'], shoes: ['boots'], acc: ['sunglasses', 'starclips'], hairC: ['pink', 'purple', 'rainbow'], aura: ['notes', 'sparkle'], colors: [6, 9, 2] }],
];
const rwTheme = (g) => RW_THEMES.find((t) => t[0] === g.theme) || RW_THEMES[0];
const RW_W = { top: 2, bottom: 1, shoes: 1, acc: 1.5, head: 1.5, hair: 0.5, hairC: 1, graphic: 1, back: 1.2, neck: 1, hand: 1.2, aura: 1 };
const rwVal = (look, k) => (RW_FX[k] ? look.fx?.[k] || '' : look[k]);
// How well a look fits the theme, 0..10
function rwFit(look, th) {
  const w = th[3]; let got = 0, max = 0;
  for (const [k, pts] of Object.entries(RW_W)) {
    if (!w[k]) continue; max += pts;
    if (w[k].includes(rwVal(look, k))) got += pts;
  }
  if (w.colors) { max += 1.5; got += 0.5 * ['topC', 'bottomC', 'shoesC'].filter((k) => w.colors.includes(Number(look[k]))).length; }
  if (w.rainbow) { max += 2; got += Math.min(2, (new Set([look.topC, look.bottomC, look.shoesC].map(Number)).size - 1)); }
  return max ? Math.round((got / max) * 100) / 10 : 5;
}
const rwVibe = (fit) => ['Hmm… 🤔', 'Hmm… 🤔', 'Getting there', 'On theme!', 'Slay! 🔥', 'Iconic 👑'][Math.round(fit / 2)]; // matches the hearts
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
    fx: { head: want('head', ['', '', '', '', 'party']), back: want('back', ['', '', '', 'wings']), neck: want('neck', ['', '', 'pearls', 'scarf']), hand: want('hand', ['', '', 'bag']), aura: want('aura', ['', '', 'sparkle']) },
    pose: pick(Object.keys(RW_POSES)),
  };
}
const RW_BOTS = [['stella', 'Stella', '💃'], ['max', 'Max', '🕺'], ['luna', 'Luna', '🌙'], ['kai', 'Kai', '⚡']];
// Looks arrive from other phones: keep only things the wardrobe knows, so nothing odd ends up in the drawing
function rwClean(L) {
  L = L && typeof L === 'object' ? L : {};
  const k = (v, o, d) => (typeof v === 'string' && Object.hasOwn(o, v) ? v : d);
  const n = (v, max, d = 0) => { const x = Math.floor(Number(v)); return x >= 0 && x < max ? x : d; };
  const fx = L.fx && typeof L.fx === 'object' ? L.fx : {};
  return {
    skin: n(L.skin, AV_SKIN.length), hair: k(L.hair, AV_HAIR, 'short'), hairC: k(L.hairC, AV_HAIRC, 'brown'), eyes: k(L.eyes, AV_EYES, 'round'), eyeC: n(L.eyeC, AV_EYEC.length),
    mouth: k(L.mouth, AV_MOUTH, 'smile'), blush: !!L.blush, freckles: !!L.freckles, facial: typeof AV_FACIAL !== 'undefined' ? k(L.facial, AV_FACIAL, 'none') : 'none',
    top: k(L.top, AV_TOP, 'tee'), topC: n(L.topC, AV_CLOTH.length), graphic: k(L.graphic, AV_GRAPHIC, 'none'), bottom: k(L.bottom, AV_BOTTOM, 'pants'), bottomC: n(L.bottomC, AV_CLOTH.length),
    shoes: k(L.shoes, AV_SHOES, 'sneakers'), shoesC: n(L.shoesC, AV_CLOTH.length), acc: k(L.acc, AV_ACC, 'none'),
    fx: Object.fromEntries(Object.keys(RW_FX).map((x) => [x, k(fx[x], RW_FX[x], '')])), pose: k(L.pose, RW_POSES, 'strut'),
  };
}

/* ---------- Drawing: the avatar plus runway extras ---------- */
function rwFxSVG(fx, layer) {
  if (!fx) return '';
  let s = '';
  if (layer === 'back') {
    if (fx.back === 'wings') s += '<g opacity=".8"><ellipse cx="30" cy="80" rx="15" ry="24" transform="rotate(-24 30 80)" fill="#c5f6fa" stroke="#fff" stroke-width="1.5"/><ellipse cx="70" cy="80" rx="15" ry="24" transform="rotate(24 70 80)" fill="#ffd6f5" stroke="#fff" stroke-width="1.5"/><ellipse cx="34" cy="100" rx="9" ry="13" transform="rotate(20 34 100)" fill="#e5dbff" stroke="#fff"/><ellipse cx="66" cy="100" rx="9" ry="13" transform="rotate(-20 66 100)" fill="#fff3bf" stroke="#fff"/></g>';
    if (fx.back === 'angel') s += '<g fill="#fff" stroke="#dee2e6" stroke-width="1.2"><path d="M40 78 C20 60 6 70 8 84 C12 98 26 100 40 92Z"/><path d="M60 78 C80 60 94 70 92 84 C88 98 74 100 60 92Z"/><path d="M14 84 q8 4 18 2 M12 90 q10 4 22 1 M86 84 q-8 4 -18 2 M88 90 q-10 4 -22 1" fill="none"/></g>';
    if (fx.back === 'bat') s += '<g fill="#5f3dc4" stroke="#3b2a6b" stroke-width="1.2"><path d="M40 80 L10 66 L14 78 L4 84 L16 88 L12 98 L40 90Z"/><path d="M60 80 L90 66 L86 78 L96 84 L84 88 L88 98 L60 90Z"/></g>';
    if (fx.back === 'butterfly') s += '<g stroke="#3b2a1a" stroke-width="1.3"><path d="M44 82 C30 58 6 62 10 80 C12 92 30 92 44 88Z" fill="#ff922b"/><path d="M56 82 C70 58 94 62 90 80 C88 92 70 92 56 88Z" fill="#ff922b"/><path d="M44 90 C30 92 18 104 26 110 C34 114 42 104 44 94Z" fill="#ffa94d"/><path d="M56 90 C70 92 82 104 74 110 C66 114 58 104 56 94Z" fill="#ffa94d"/></g><g fill="#fff" opacity=".85"><circle cx="17" cy="74" r="2.4"/><circle cx="83" cy="74" r="2.4"/><circle cx="24" cy="68" r="1.6"/><circle cx="76" cy="68" r="1.6"/></g>';
    if (fx.back === 'jetpack') s += '<g stroke="#495057" stroke-width="1.2"><rect x="22" y="72" width="14" height="32" rx="6" fill="#ced4da"/><rect x="64" y="72" width="14" height="32" rx="6" fill="#ced4da"/><rect x="24" y="78" width="10" height="4" rx="2" fill="#ff6b6b"/><rect x="66" y="78" width="10" height="4" rx="2" fill="#ff6b6b"/></g><g class="rw-flame"><path d="M24 105 Q29 124 34 105Z" fill="#ffa94d"/><path d="M66 105 Q71 124 76 105Z" fill="#ffa94d"/><path d="M26.5 105 Q29 116 31.5 105Z" fill="#ffe066"/><path d="M68.5 105 Q71 116 73.5 105Z" fill="#ffe066"/></g>';
    return s ? `<svg class="rw-fx back" viewBox="0 -12 100 158" aria-hidden="true">${s}</svg>` : '';
  }
  if (fx.neck === 'pearls') s += [...Array(9)].map((_, i) => { const t = i / 8, x = 40 + t * 20, y = 71 + Math.sin(t * Math.PI) * 6; return `<circle cx="${x}" cy="${y}" r="1.7" fill="#fff" stroke="#ced4da" stroke-width=".5"/>`; }).join('');
  if (fx.neck === 'scarf') s += '<path d="M38 69 Q50 76 62 69 L62 74 Q50 81 38 74Z" fill="#e03131" stroke="#a51111" stroke-width=".8"/><path d="M56 74 L60 92 L54 93 L52 76Z" fill="#e03131" stroke="#a51111" stroke-width=".8"/><path d="M41 71 l2 4 M46 73 l2 4 M52 73 l2 4" stroke="#fff" stroke-width="1"/>';
  if (fx.neck === 'bowtie') s += '<path d="M50 73 L42 69 L42 77Z M50 73 L58 69 L58 77Z" fill="#212529" stroke="#000" stroke-width=".6"/><circle cx="50" cy="73" r="2" fill="#495057"/>';
  if (fx.neck === 'lei') s += [...Array(9)].map((_, i) => { const t = i / 8, x = 37 + t * 26, y = 70 + Math.sin(t * Math.PI) * 9; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${['#ff6b9d', '#ffd43b', '#ff922b', '#da77f2'][i % 4]}" stroke="#fff" stroke-width=".6"/>`; }).join('');
  if (fx.neck === 'medal') s += '<path d="M42 69 L50 86 L58 69" fill="none" stroke="#4dabf7" stroke-width="3.2"/><circle cx="50" cy="90" r="5.5" fill="#fcc419" stroke="#e67700" stroke-width="1"/><path d="M50 87 l1 2 2.2.3 -1.6 1.5 .4 2.2 -2 -1 -2 1 .4 -2.2 -1.6 -1.5 2.2 -.3z" fill="#fff3bf"/>';
  if (fx.neck === 'chain') s += [...Array(11)].map((_, i) => { const t = i / 10, x = 39 + t * 22, y = 70 + Math.sin(t * Math.PI) * 10; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="1.6" ry="1.1" fill="none" stroke="#f59f00" stroke-width="1.1"/>`; }).join('') + '<circle cx="50" cy="82" r="2.6" fill="#ffd43b" stroke="#e67700" stroke-width=".7"/>';
  if (fx.hand === 'bag') s += '<path d="M76 98 Q80 92 84 98" fill="none" stroke="#7048e8" stroke-width="1.6"/><rect x="73" y="98" width="14" height="11" rx="2.5" fill="#9775fa" stroke="#5f3dc4"/><circle cx="80" cy="103" r="1.2" fill="#ffd43b"/>';
  if (fx.hand === 'wand') s += '<path d="M78 101 L88 82" stroke="#f8f9fa" stroke-width="2" stroke-linecap="round"/><path d="M88 74 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z" fill="#ffd43b" stroke="#f59f00" stroke-width=".7"/>';
  if (fx.hand === 'mic') s += '<path d="M78 101 L81 91" stroke="#343a40" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="88" r="3.6" fill="#adb5bd" stroke="#495057"/>';
  if (fx.hand === 'bouquet') s += '<path d="M78 102 L82 90 M78 102 L77 89 M78 102 L86 92" stroke="#2f9e44" stroke-width="1.3"/><circle cx="82" cy="88" r="3" fill="#ff8fab"/><circle cx="77" cy="87" r="3" fill="#ffd43b"/><circle cx="87" cy="91" r="3" fill="#da77f2"/><circle cx="82" cy="88" r="1" fill="#fff"/>';
  if (fx.hand === 'umbrella') s += '<path d="M79 102 L82 62" stroke="#495057" stroke-width="1.6"/><path d="M79 102 q-1 4 -4 3" fill="none" stroke="#495057" stroke-width="1.6"/><path d="M62 64 Q82 40 102 64 Q97 60 92 64 Q87 60 82 64 Q77 60 72 64 Q67 60 62 64Z" fill="#ffd43b" stroke="#f08c00" stroke-width="1"/>';
  if (fx.hand === 'ball') s += '<circle cx="84" cy="105" r="7" fill="#fff" stroke="#343a40" stroke-width="1"/><path d="M84 101.5 l3 2.2 -1.2 3.4 h-3.6 l-1.2 -3.4z" fill="#343a40"/>';
  if (fx.hand === 'pail') s += '<path d="M76 100 Q82 92 88 100" fill="none" stroke="#343a40" stroke-width="1.2"/><ellipse cx="82" cy="106" rx="8" ry="7" fill="#fd7e14" stroke="#d9480f"/><path d="M78 104 l2 2 2 -2 M84 104 l2 2 2 -2 M78 109 q4 3 8 0" fill="none" stroke="#3b2a1a" stroke-width="1.1"/>';
  if (fx.hand === 'lantern') s += '<path d="M78 101 L82 90" stroke="#495057" stroke-width="1.4"/><rect x="77" y="90" width="10" height="13" rx="2.5" fill="#ffe066" stroke="#e67700"/><circle cx="82" cy="96.5" r="7" fill="#ffe066" opacity=".35"/>';
  if (fx.hand === 'whisk') s += '<path d="M78 101 L84 92" stroke="#868e96" stroke-width="2.4" stroke-linecap="round"/><path d="M84 92 Q80 80 88 78 Q94 80 86 92 M84 92 Q86 78 92 82" fill="none" stroke="#adb5bd" stroke-width="1.1"/>';
  if (fx.head === 'tophat') s += '<ellipse cx="50" cy="13" rx="26" ry="4.5" fill="#212529"/><rect x="36" y="-12" width="28" height="25" rx="2" fill="#343a40" stroke="#212529"/><rect x="36" y="5" width="28" height="4" fill="#e64980"/>';
  if (fx.head === 'witch') s += '<ellipse cx="50" cy="13" rx="33" ry="5" fill="#5f3dc4" stroke="#3b2a6b"/><path d="M33 13 Q44 0 56 -14 Q57 -2 67 13Z" fill="#7048e8" stroke="#3b2a6b"/><path d="M35 9 Q50 5 65 9 L66 12 Q50 8 34 12Z" fill="#fcc419"/>';
  if (fx.head === 'chef') s += '<g fill="#fff" stroke="#dee2e6" stroke-width="1"><circle cx="38" cy="-1" r="10"/><circle cx="62" cy="-1" r="10"/><circle cx="50" cy="-6" r="11"/><rect x="31" y="2" width="38" height="13" rx="3"/></g>';
  if (fx.head === 'flowercrown') s += [...Array(7)].map((_, i) => { const t = i / 6, x = 27 + t * 46, y = 18 - Math.sin(t * Math.PI) * 8; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${['#ff8fab', '#ffd43b', '#b197fc', '#69db7c'][i % 4]}" stroke="#fff" stroke-width=".8"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="#fff"/>`; }).join('');
  if (fx.head === 'party') s += '<path d="M40 13 L52 -14 L62 13Z" fill="#4dabf7" stroke="#1971c2"/><path d="M44 5 L58 5 M47 -2 L56 -2" stroke="#ffd43b" stroke-width="2.4"/><circle cx="52" cy="-15" r="3.4" fill="#ff6b9d"/>';
  if (fx.head === 'sunhat') s += '<ellipse cx="50" cy="15" rx="38" ry="7" fill="#f5d491" stroke="#c9a227"/><path d="M29 15 Q31 -6 50 -6 Q69 -6 71 15Z" fill="#ffe8a3" stroke="#c9a227"/><path d="M30 10 Q50 6 70 10 L70.5 14 Q50 10 29.5 14Z" fill="#ff8fab"/>';
  if (fx.head === 'helmet') s += '<circle cx="50" cy="40" r="35" fill="#a5d8ff" fill-opacity=".22" stroke="#fff" stroke-width="2.4"/><path d="M28 22 Q36 12 48 10" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/><rect x="34" y="72" width="32" height="6" rx="3" fill="#ced4da" stroke="#868e96"/>';
  const auraE = RW_AURA[fx.aura];
  const aura = auraE ? `<div class="rw-aura">${[...Array(6)].map((_, i) => `<i style="--i:${i}">${auraE}</i>`).join('')}</div>` : '';
  return (s ? `<svg class="rw-fx front" viewBox="0 -12 100 158" aria-hidden="true">${s}</svg>` : '') + aura;
}
const rwModel = (look, cls = '') => `<div class="rw-model ${cls}">${rwFxSVG(look.fx, 'back')}${avatarSVG(look, { noShadow: true })}${rwFxSVG(look.fx, 'front')}</div>`;
// On the runway: walk in, then strike the signature pose
const rwPosed = (look, cls = '') => { const p = RW_POSES[look.pose] ? look.pose : 'strut'; return `<div class="rw-poser pose-${p}">${rwModel(look, cls)}<b class="rw-pose-e">${RW_POSES[p][0]}</b></div>`; };

/* ---------- Judges ---------- */
// A judge's one-liner about a look: what nailed the theme, and what would have made it better
function rwJudgeLine(look, th, seed) {
  const r = rwRand(seed), w = th[3], fit = rwFit(look, th), pick = (a) => a[Math.floor(r() * a.length)];
  const keys = Object.keys(RW_W).filter((k) => w[k]).sort((a, b) => RW_W[b] - RW_W[a]);
  const hits = keys.filter((k) => w[k].includes(rwVal(look, k)));
  const miss = keys.filter((k) => !w[k].includes(rwVal(look, k)));
  const hit = hits.length ? rwItemName(hits[0], rwVal(look, hits[0])) : '';
  const tip = miss.length ? rwItemName(miss[0], w[miss[0]][0]) : '';
  const T = th[2];
  if (fit >= 8) return pick([`The ${hit || 'colors'}? SO ${T}! 🔥`, `Iconic. That ${hit || 'look'} nails it 👑`, `Runway royalty — love the ${hit || 'whole look'} ✨`]);
  if (fit >= 5) return hit && tip ? pick([`Cute ${hit}! A ${tip} would make it pop 💡`, `The ${hit} works — add a ${tip} next time!`]) : `Nice look! Very ${T} 💅`;
  return tip ? pick([`Bold choice! For ${T}, try a ${tip} 💡`, `Fun look — but where’s the ${T} vibe? Maybe a ${tip}?`]) : 'Bold and fearless! 😎';
}

/* ---------- Game rules ---------- */
const RW_DRESS_MS = 180000, RW_REVEAL_MS = 2600;
const rwModels = (g) => [...g.p.filter((x) => !g.out?.[x] && g.looks[x]).map((x) => ({ id: x, name: playerName(x), e: playerEmoji(x), look: rwClean(g.looks[x]) })), ...g.npc.map((n) => ({ id: n.id, name: n.name, e: n.e, look: rwClean(n.look), bot: true }))];
const rwPhase = (g) => (g.p.some((x) => !g.out?.[x] && !g.looks[x]) ? 'dress' : g.p.some((x) => !g.out?.[x] && !g.votes[x]) ? 'vote' : 'done');
const rwBotStar = (n, m, th, g) => { const r = rwRand(g.id + n.id + m.id)(); return Math.max(1, Math.min(5, Math.round(1 + rwFit(m.look, th) / 2.5 + (r - 0.5) * 1.6))); };
// The judges for a model: every robot except the one walking
const rwJudges = (g, m) => { const th = rwTheme(g); return g.npc.filter((n) => n.id !== m.id).map((n) => ({ ...n, star: rwBotStar(n, m, th, g), line: rwJudgeLine(m.look, th, g.id + n.id + m.id) })); };
function rwResults(g) {
  const th = rwTheme(g), models = rwModels(g);
  const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  return models.map((m) => {
    const fam = [];
    for (const x of g.p) if (x !== m.id && g.votes[x]?.[m.id]) fam.push(g.votes[x][m.id]);
    const J = rwJudges(g, m), bots = J.map((j) => j.star);
    const best = J.slice().sort((a, b) => b.star - a.star)[0];
    return { ...m, avg: avg([...fam, ...bots]) || 0, fam: avg(fam), bots: avg(bots), fit: rwFit(m.look, th), quote: best ? [best.e, best.name, best.line] : null };
  }).sort((a, b) => b.avg - a.avg || b.fit - a.fit);
}
GX.runway = {
  name: 'Runway Ready', short: 'Runway Ready', sub: 'Dress to the theme', e: '👗', g1: '#db2777', g2: '#a855f7', tag: 'Dress up · walk · vote', max: 6, solo: true, bot: false, hidden: true,
  how: 'A theme spins up and everyone gets a few minutes in the dressing room — every item is free in here, plus hats, wings, props and a signature pose. Then each model walks the runway, the robot judges react, and everyone rates the looks 1–5 stars. Play with the family, or start it with nobody picked to play solo.',
  init(p) {
    const th = RW_THEMES[Math.floor(Math.random() * RW_THEMES.length)];
    const nBots = Math.max(2, 4 - p.length);
    const npc = shuffle(RW_BOTS.slice()).slice(0, nBots).map(([id, name, e]) => ({ id: 'npc-' + id, name, e, look: rwRobotLook(th, id + Date.now()) }));
    return { theme: th[0], looks: {}, votes: {}, out: {}, npc, until: Date.now() + RW_DRESS_MS + RW_REVEAL_MS };
  },
  need(g) { const ph = rwPhase(g); return ph === 'dress' ? g.p.filter((x) => !g.out?.[x] && !g.looks[x]) : ph === 'vote' ? g.p.filter((x) => !g.out?.[x] && !g.votes[x]) : []; },
  prompt(g, who) { const ph = rwPhase(g); return ph === 'dress' ? `💅 ${g.mode === 'remote' || g.p.length < 2 ? 'Dress to the theme!' : `${playerName(who)}, get dressed!`}` : `⭐ ${g.mode === 'remote' ? 'Rate the looks!' : `${playerName(who)}, rate the looks!`}`; },
  status(g) { if (rwPhase(g) !== 'done') return { over: false }; const R = rwResults(g); const top = R[0]; return { over: true, winner: top && g.p.includes(top.id) ? top.id : 'npc' }; },
  endText(g) { const R = rwResults(g), t = R[0]; return t ? `👑 ${t.e} ${t.name} wins the runway!` : 'Show’s over!'; },
  act(g, who, v) {
    if (v && typeof v === 'object' && v.look && rwPhase(g) === 'dress' && !g.looks[who]) { g.looks = { ...g.looks, [who]: rwClean(v.look) }; return; }
    if (v && typeof v === 'object' && v.votes && rwPhase(g) === 'vote' && !g.votes[who]) {
      const ok = {}; for (const m of rwModels(g)) if (m.id !== who) ok[m.id] = Math.max(1, Math.min(5, Math.round(Number(v.votes[m.id]) || 3)));
      g.votes = { ...g.votes, [who]: ok }; return;
    }
    return false;
  },
  view(g, who, st) {
    const ph = rwPhase(g), me = g.mode === 'remote' ? actor() : who;
    if (st.over) return rwPodium(g);
    if (ph === 'dress') {
      if (who) return rwDressing(g, who);
      const waiting = g.p.filter((x) => !g.out?.[x] && !g.looks[x]);
      const late = Date.now() > (g.until || 0) + 30000;
      return `<div class="rw-wait">${me && g.looks[me] ? rwModel(rwClean(g.looks[me]), 'small') : ''}<p><b>Looking good! 💅</b><br>Waiting for ${esc(waiting.map(playerName).join(', '))} to finish dressing…</p>${late ? `<button class="btn secondary" data-action="rw-skip" data-id="${g.id}">Start the runway without them</button>` : ''}</div>`;
    }
    if (who) return rwVoting(g, who);
    const waiting = g.p.filter((x) => !g.out?.[x] && !g.votes[x]);
    const late = Date.now() - (g.lastAt || g.at) > 45000; // give everyone a fair chance to vote first
    return `<div class="rw-wait"><p><b>Votes are in! ⭐</b><br>Waiting for ${esc(waiting.map(playerName).join(', '))} to rate the looks…</p>${late ? `<button class="btn secondary" data-action="rw-skip" data-id="${g.id}">Show results now</button>` : ''}</div>`;
  },
  bot: () => null,
};

/* ---------- Dressing room ---------- */
const rwStoreKey = (key) => 'gomezfam:rw:' + key;
function rwDraft(g, who) {
  const key = g.id + ':' + who;
  if (!ui.rw || ui.rw.key !== key) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(rwStoreKey(key)) || 'null'); } catch { /* private mode */ }
    const base = JSON.parse(JSON.stringify(typeof avatarOf === 'function' ? avatarOf(who) : {}));
    ui.rw = saved && saved.look ? { key, gid: g.id, who, cat: RW_STAGES.some((st) => st[2].some(([k]) => k === saved.cat)) ? saved.cat : 'top', look: rwClean(saved.look), start: saved.start, hist: [] }
      : { key, gid: g.id, who, cat: 'top', look: rwClean({ ...base, fx: {}, pose: 'strut' }), start: Date.now() + RW_REVEAL_MS, hist: [] };
  }
  return ui.rw;
}
// The outfit survives an app reload mid-round
const rwKeep = (D) => { try { localStorage.setItem(rwStoreKey(D.key), JSON.stringify({ look: D.look, start: D.start, cat: D.cat })); } catch { /* full or private */ } };
const rwDrop = (key) => { try { localStorage.removeItem(rwStoreKey(key)); } catch { /* ignore */ } };
const rwChange = (D, fn) => { D.hist = [...(D.hist || []).slice(-29), JSON.stringify(D.look)]; fn(D.look); D.posing = false; rwKeep(D); gBuzz(); render(); };
const rwEnd = (g, D) => (g.mode === 'remote' ? Math.max(g.until || 0, D.start + 60000) : D.start + RW_DRESS_MS);
const rwSwatch = (c) => (c === 'rainbow' ? 'conic-gradient(red,orange,yellow,green,blue,violet,red)' : c === 'galaxy' ? 'linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)' : c);
// One picker tile: a mini model wearing the option (a close-up for hair, hats and faces)
function rwTile(L, cat, k, v, label, on) {
  const look = k === 'fx' ? { ...L, fx: { ...L.fx, [cat]: v } } : { ...L, [k]: v };
  const art = cat === 'aura' ? `<span class="rw-big">${RW_AURA[v] || '🚫'}</span>` : `<div class="rw-thumb${RW_HEADSHOT.has(cat) ? ' headshot' : ''}">${rwModel(look, 'tile')}</div>`;
  return `<button class="rw-opt${on ? ' on' : ''}" data-action="rw-set" data-k="${k === 'fx' ? cat : k}" data-v="${esc(String(v))}">${art}<span>${esc(String(label).replace(/^[^A-Za-z0-9]+/, '') || label)}</span></button>`;
}
function rwDressing(g, who) {
  const th = rwTheme(g), D = rwDraft(g, who), L = D.look, cat = D.cat;
  if (Date.now() < D.start) return rwReveal(g, D);
  const left = Math.max(0, Math.ceil((rwEnd(g, D) - Date.now()) / 1000));
  const stage = rwStageOf(cat), last = stage === RW_STAGES.length - 1;
  let grid;
  if (cat === 'eyes') grid = Object.entries(AV_EYES).map(([v, x]) => rwTile(L, 'eyes', 'eyes', v, x[0], L.eyes === v)).join('');
  else if (cat === 'mouth') grid = Object.entries(AV_MOUTH).map(([v, x]) => rwTile(L, 'mouth', 'mouth', v, x, L.mouth === v)).join('') + rwTile(L, 'mouth', 'blush', L.blush ? '' : '1', L.blush ? 'No blush' : 'Blush', false);
  else if (cat === 'pose') grid = Object.entries(RW_POSES).map(([v, [e, l]]) => `<button class="rw-opt${L.pose === v ? ' on' : ''}" data-action="rw-set" data-k="pose" data-v="${v}"><span class="rw-big">${e}</span><span>${esc(l)}</span></button>`).join('');
  else if (cat === 'book') {
    const book = rwBook(who);
    grid = `<button class="rw-opt" data-action="rw-book" data-i="-1"><div class="rw-thumb">${rwModel(rwClean({ ...avatarOf(who), fx: {} }), 'tile')}</div><span>My avatar</span></button>`
      + book.map((b, i) => `<button class="rw-opt" data-action="rw-book" data-i="${i}"><div class="rw-thumb">${rwModel(rwClean(b.look), 'tile')}</div><span>${esc(RW_THEMES.find((t) => t[0] === b.theme)?.[1] || '👗')} ⭐${Number(b.avg || 0).toFixed(1)}</span></button>`).join('')
      + (book.length ? '' : '<p class="rw-empty">Save looks you love from the results — they show up here.</p>');
  } else grid = Object.entries(rwOpts(cat)).map(([v, label]) => rwTile(L, cat, RW_FX[cat] ? 'fx' : cat, v, label, (RW_FX[cat] ? L.fx[cat] || '' : L[cat]) === v)).join('');
  const ck = RW_COLOR_OF[cat];
  const colors = !ck ? '' : `<div class="rw-swrow" role="group" aria-label="Colour">${ck === 'hairC'
    ? Object.entries(AV_HAIRC).map(([k, [c]]) => `<button class="rw-sw${L.hairC === k ? ' on' : ''}" data-action="rw-set" data-k="hairC" data-v="${k}" style="--c:${rwSwatch(c)}" aria-label="${k} hair"></button>`).join('')
    : AV_CLOTH.map((c, i) => `<button class="rw-sw${Number(L[ck]) === i ? ' on' : ''}" data-action="rw-set" data-k="${ck}" data-v="${i}" style="--c:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>`;
  const ideas = Object.entries(th[3]).filter(([k]) => k !== 'colors' && k !== 'rainbow').slice(0, 4).map(([k, vs]) => rwItemName(k, vs[0])).filter(Boolean);
  const fit = rwFit(L, th), hearts = Math.round(fit / 2);
  return `<div class="rw-theme"><span>${th[1]}</span><b>${esc(th[2])}${g.mode !== 'remote' && g.p.length > 1 ? `<small>${esc(playerEmoji(who))} ${esc(playerName(who))} is dressing</small>` : ''}</b><i class="rw-timer${left <= 30 ? ' low' : ''}" data-rwend="${rwEnd(g, D)}">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</i>${ui.rwIdeas ? `<div class="rw-ideas">💡 ${esc(ideas.join(' · '))}</div>` : ''}</div>
    <div class="game-stage rw-stage"><div class="rw-room">${D.posing ? rwPosed(L, 'dressing') : rwModel(L, 'dressing')}
      <div class="rw-meter" aria-label="Theme vibe ${hearts} of 5"><span>${'💗'.repeat(hearts)}${'🤍'.repeat(5 - hearts)}</span><b>${rwVibe(fit)}</b></div></div></div>
    <div class="rw-steps" data-noswipe>${RW_STAGES.map(([e, l], i) => `<button class="${i === stage ? 'on' : i < stage ? 'done' : ''}" data-action="rw-stage" data-s="${i}" aria-label="Step ${i + 1}: ${l}"><span>${i < stage ? '✓' : e}</span><b>${l}</b></button>`).join('')}</div>
    <div class="rw-subs" data-noswipe>${RW_STAGES[stage][2].map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-action="rw-cat" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="rw-pick" data-noswipe>${colors}<div class="rw-grid">${grid}</div></div>
    <div class="rw-actions"><button class="btn secondary" data-action="rw-ideas" aria-label="Ideas">💡</button><button class="btn secondary" data-action="rw-undo" aria-label="Undo"${D.hist?.length ? '' : ' disabled'}>↩️</button><button class="btn secondary" data-action="rw-random" aria-label="Surprise me">🎲</button>${last
      ? `<button class="btn" data-action="rw-done" data-id="${g.id}">✨ Walk the runway</button>`
      : `<button class="btn" data-action="rw-stage" data-s="${stage + 1}">Next: ${RW_STAGES[stage + 1][0]} ${RW_STAGES[stage + 1][1]} ›</button>`}</div>`;
}
// The theme spins in like a slot machine before the clock starts
function rwReveal(g, D) {
  const th = rwTheme(g), r = rwRand(g.id + D.who);
  const strip = [...Array(9)].map(() => RW_THEMES[Math.floor(r() * RW_THEMES.length)]).concat([th]);
  const at = Math.min(1, (Date.now() - (D.start - RW_REVEAL_MS)) / RW_REVEAL_MS);
  return `<div class="rw-reveal" data-action="rw-go" style="--n:${strip.length};--t:-${Math.round(at * 2000)}ms"><small>Today’s theme is…</small>
    <div class="rw-slot"><div class="rw-strip">${strip.map((t) => `<div><span>${t[1]}</span>${esc(t[2])}</div>`).join('')}</div></div><p class="muted">Tap to start dressing</p></div>`;
}

/* ---------- Runway + voting ---------- */
function rwVoting(g, who) {
  const th = rwTheme(g), r = rwRand(g.id + who);
  const list = rwModels(g).map((m) => [r(), m]).sort((a, b) => a[0] - b[0]).map((x) => x[1]); // everyone walks, in a shuffled order — your own look too
  const rate = list.filter((m) => m.id !== who);
  const V = ui.rwv && ui.rwv.key === g.id + ':' + who ? ui.rwv : (ui.rwv = { key: g.id + ':' + who, i: 0, stars: {} });
  if (V.i >= list.length) {
    return `<div class="rw-wait"><p><b>All rated! 🎉</b></p><div class="rw-sum">${rate.map((m) => `<span>${esc(m.e)} ${esc(m.name)} <i>${'⭐'.repeat(V.stars[m.id] || 0)}</i></span>`).join('')}</div>
      <div class="btn-row"><button class="btn secondary" data-action="rw-back">↩️ Change</button><button class="btn" data-action="rw-send" data-id="${g.id}">Send my votes</button></div></div>`;
  }
  const m = list[V.i], mine = m.id === who, s = V.stars[m.id] || 0;
  const J = rwJudges(g, m), j = J[Math.floor(rwRand(g.id + m.id)() * J.length)];
  const bubble = j ? `<div class="rw-judge"><b>${esc(j.e)} ${esc(j.name)}</b> ${'⭐'.repeat(j.star)}<br>${esc(j.line)}</div>` : '';
  return `<div class="rw-theme small"><span>${th[1]}</span><b>${esc(th[2])}</b><i>${V.i + 1} / ${list.length}</i></div>
    <div class="game-stage rw-stage"><div class="rw-runway" data-k="${V.i}"><div class="rw-lights"></div><div class="rw-flash"></div>${rwPosed(m.look, 'walk')}${bubble}<div class="rw-name">${esc(m.e)} ${esc(m.name)}${mine ? ' <small>that’s you! 💅</small>' : m.bot ? ' <small>robot model</small>' : ''}</div></div></div>
    ${mine ? `<div class="rw-self"><button class="btn" data-action="rw-next">Next model ›</button></div>`
      : `<div class="rw-stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= s ? 'on' : ''}" data-action="rw-star" data-n="${n}" data-m="${m.id}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>`}
    ${V.i ? '<div style="text-align:center"><button class="link-inline" data-action="rw-back">‹ Back</button></div>' : ''}`;
}

/* ---------- Results ---------- */
const rwBook = (pid) => (state.lookbook?.[pid] || []).filter((b) => b && b.look);
// Best score a member has had in earlier shows
function rwBest(pid, skip) {
  let best = 0;
  for (const x of state.games || []) if (x.type === 'runway' && x.endAt && x.id !== skip && x.looks?.[pid]) { const r = rwResults(x).find((y) => y.id === pid); if (r && r.avg > best) best = r.avg; }
  return best;
}
function rwPodium(g) {
  const R = rwResults(g), th = rwTheme(g), me = actor();
  const pod = [R[1], R[0], R[2]].filter(Boolean);
  const mine = R.find((r) => r.id === me);
  const prev = mine ? rwBest(me, g.id) : 0;
  // 3rd → 2nd → 1st the first time anyone opens the results; instant after that
  const seen = (ui.rwSeen ||= {})[g.id] || (ui.rwSeen[g.id] = Date.now());
  const t = Date.now() - seen, reveal = t < 4000;
  const saved = (b, id) => rwBook(id).some((x) => x.gid === g.id);
  const card = (r, i) => `<div class="rw-card"><div class="rw-thumb headshot">${rwModel(r.look, 'tile')}</div><div class="grow"><b>#${i + 1} ${esc(r.e)} ${esc(r.name)}</b> <i>⭐ ${r.avg.toFixed(1)}</i>
      <small>${r.fam != null ? `👨‍👩‍👧 Family ⭐${r.fam.toFixed(1)} · ` : ''}🤖 Judges ⭐${(r.bots || 0).toFixed(1)} · 🎯 ${Math.round(r.fit * 10)}% on theme</small>
      ${r.quote ? `<q>${esc(r.quote[0])} ${esc(r.quote[1])}: ${esc(r.quote[2])}</q>` : ''}</div>
      ${!r.bot && isMember(r.id) ? `<button class="rw-save${saved(0, r.id) ? ' on' : ''}" data-action="rw-save" data-id="${g.id}" data-m="${r.id}" aria-label="Save to ${esc(r.name)}’s Lookbook">${saved(0, r.id) ? '💾✓' : '💾'}</button>` : ''}</div>`;
  return `<div class="rw-theme small"><span>${th[1]}</span><b>${esc(th[2])}</b><i>Results</i></div>
    <div class="rw-podium${reveal ? ' reveal' : ''}" style="--t0:-${t}ms">${reveal ? '<div class="rw-drum">🥁</div>' : ''}${pod.map((r) => { const k = R.indexOf(r); return `<div class="rw-pod p${k + 1}">${k === 0 ? '<span class="rw-crown">👑</span>' : ''}${rwPosed(r.look, 'pose')}<div class="rw-pbase"><b>${['🥇', '🥈', '🥉'][k]}</b><span>${esc(r.e)} ${esc(r.name)}</span><small>⭐ ${r.avg.toFixed(1)}</small></div></div>`; }).join('')}</div>
    ${mine ? `<p class="rw-mine">Your look: <b>⭐ ${mine.avg.toFixed(1)}</b> · #${R.indexOf(mine) + 1} of ${R.length} · ${Math.round(mine.fit * 10)}% on theme${prev && mine.avg > prev ? '<br><b class="rw-pb">🎉 New personal best!</b>' : ''}</p>` : ''}
    <div class="section-title">📋 Scorecards</div><div class="rw-cards">${R.map(card).join('')}</div>`;
}

/* ---------- Actions ---------- */
Object.assign(actions, {
  'rw-cat': (el) => { if (ui.rw) { ui.rw.cat = el.dataset.k; ui.rw.posing = false; rwKeep(ui.rw); render(); } },
  'rw-stage': (el) => { const D = ui.rw, st = RW_STAGES[Number(el.dataset.s)]; if (D && st) { D.cat = st[2][0][0]; D.posing = false; rwKeep(D); render(); } },
  'rw-set': (el) => {
    const D = ui.rw; if (!D) return;
    const k = el.dataset.k, v = el.dataset.v;
    rwChange(D, (L) => {
      if (RW_FX[k]) L.fx = { ...L.fx, [k]: v };
      else if (/C$/.test(k) && k !== 'hairC') L[k] = Number(v);
      else if (k === 'blush') L.blush = !!v;
      else L[k] = v;
    });
    if (k === 'pose') { D.posing = true; render(); } // show the pose off right away
  },
  'rw-undo': () => { const D = ui.rw; if (!D || !D.hist?.length) return; D.look = JSON.parse(D.hist.pop()); D.posing = false; rwKeep(D); render(); },
  'rw-book': (el) => {
    const D = ui.rw; if (!D) return;
    const i = Number(el.dataset.i), b = i < 0 ? { look: { ...avatarOf(D.who), fx: {}, pose: D.look.pose } } : rwBook(D.who)[i];
    if (b) { rwChange(D, (L) => Object.assign(L, rwClean(b.look))); toast(i < 0 ? '↩️ Back to your avatar' : '📖 Look loaded'); }
  },
  'rw-go': () => { const D = ui.rw; if (D && Date.now() < D.start) { D.start = Date.now(); rwKeep(D); render(); } },
  'rw-ideas': () => { ui.rwIdeas = !ui.rwIdeas; render(); },
  'rw-random': () => {
    const D = ui.rw; if (!D) return; const g = findIn(state.games, D.gid); if (!g) return;
    const R = rwRobotLook(rwTheme(g), Math.random());
    rwChange(D, (L) => Object.assign(L, { ...R, skin: L.skin, eyeC: L.eyeC, facial: L.facial }));
  },
  'rw-done': (el) => {
    const g = findIn(state.games, el.dataset.id), who = g && mpActor(g), D = ui.rw;
    if (!who || !D) return;
    if (mpDo(g, who, { look: JSON.parse(JSON.stringify(D.look)) })) { rwDrop(D.key); ui.rw = null; ui.rwIdeas = false; toast('💅 Look locked in!'); }
  },
  'rw-star': (el) => {
    const V = ui.rwv; if (!V) return;
    V.stars[el.dataset.m] = Number(el.dataset.n); gBuzz();
    document.querySelectorAll('.rw-stars button').forEach((b, i) => b.classList.toggle('on', i < Number(el.dataset.n)));
    clearTimeout(ui.rwT); const at = V.i; ui.rwT = setTimeout(() => { if (ui.rwv === V && V.i === at) { V.i++; render(); } }, 450);
  },
  'rw-next': () => { const V = ui.rwv; if (V) { V.i++; render(); } },
  'rw-back': () => { const V = ui.rwv; if (V && V.i > 0) { clearTimeout(ui.rwT); V.i--; render(); } },
  'rw-send': (el) => {
    const g = findIn(state.games, el.dataset.id), who = g && mpActor(g), V = ui.rwv;
    if (!who || !V) return;
    if (mpDo(g, who, { votes: { ...V.stars } })) { ui.rwv = null; if (rwPhase(g) === 'done') setTimeout(confetti, 300); }
  },
  'rw-save': (el) => {
    const g = findIn(state.games, el.dataset.id), pid = el.dataset.m; if (!g || !g.looks?.[pid]) return;
    const book = rwBook(pid);
    if (book.some((b) => b.gid === g.id)) { (state.lookbook ||= {})[pid] = book.filter((b) => b.gid !== g.id); toast('Removed from the Lookbook'); }
    else { const r = rwResults(g).find((x) => x.id === pid); (state.lookbook ||= {})[pid] = [{ gid: g.id, look: rwClean(g.looks[pid]), theme: g.theme, avg: r?.avg || 0, at: Date.now() }, ...book].slice(0, 12); toast(`📖 Saved to ${playerName(pid)}’s Lookbook`); }
    save(); render();
  },
  'rw-skip': (el) => {
    const g = findIn(state.games, el.dataset.id); if (!g) return;
    const ph = rwPhase(g);
    for (const x of g.p) if (!g.out?.[x] && (ph === 'dress' ? !g.looks[x] : !g.votes[x])) g.out = { ...(g.out || {}), [x]: true };
    g.lastAt = Date.now(); mpFinish(g); save(); render();
  },
});
for (const a of ['rw-cat', 'rw-stage', 'rw-set', 'rw-undo', 'rw-book', 'rw-go', 'rw-ideas', 'rw-random', 'rw-done', 'rw-star', 'rw-next', 'rw-back', 'rw-send', 'rw-save', 'rw-skip']) KID_ACTIONS.add(a);
if (typeof ARCADE !== 'undefined' && !ARCADE.includes('runway')) ARCADE.push('runway');

// Family records: runway champ + best look ever
if (typeof familyRecords === 'function') {
  const _recRw = familyRecords;
  familyRecords = function () {
    const h = _recRw();
    const games = (state.games || []).filter((x) => x.type === 'runway' && x.endAt);
    if (!games.length) return h;
    const wins = {}; let best = null;
    for (const x of games) {
      if (x.winner && isMember(x.winner)) wins[x.winner] = (wins[x.winner] || 0) + 1;
      for (const r of rwResults(x)) if (!r.bot && isMember(r.id) && (!best || r.avg > best.avg)) best = r;
    }
    const w = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
    const row = (e, l, id, v) => `<div class="row"><div class="avatar">${e}</div><div class="grow"><div class="title">${esc(l)}</div><div class="sub">${esc(playerEmoji(id))} ${esc(playerName(id))}</div></div><b>${esc(v)}</b></div>`;
    const add = (w ? row('👗', 'Runway champ', w[0], `${w[1]} win${w[1] > 1 ? 's' : ''}`) : '') + (best ? row('✨', 'Best runway look', best.id, `⭐ ${best.avg.toFixed(1)}`) : '');
    if (!add) return h;
    if (!h) return `<div class="section-title">🏅 Family records</div><div class="card flush records">${add}</div>`;
    const at = h.lastIndexOf('</div>');
    return h.slice(0, at) + add + h.slice(at);
  };
}

// Dressing room timer: tick the clock, and when time's up the look goes out as it is. Also ends the theme reveal.
let rwTick = 0, rwRevealT = 0;
const _afterRenderRw = afterRender;
afterRender = function () {
  _afterRenderRw();
  clearInterval(rwTick); clearTimeout(rwRevealT);
  if (document.querySelector('.rw-reveal') && ui.rw) { rwRevealT = setTimeout(render, Math.max(50, ui.rw.start - Date.now())); return; }
  const t = document.querySelector('[data-rwend]');
  if (!t) return;
  const end = Number(t.dataset.rwend);
  rwTick = setInterval(() => {
    const el = document.querySelector('[data-rwend]'); if (!el) { clearInterval(rwTick); return; }
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('low', left <= 30);
    if (left === 10) gBuzz();
    if (!left) { clearInterval(rwTick); const D = ui.rw, g = D && findIn(state.games, D.gid), who = g && mpActor(g); if (who) { mpDo(g, who, { look: JSON.parse(JSON.stringify(D.look)) }); rwDrop(D.key); ui.rw = null; toast('⏰ Time’s up — to the runway!'); } }
  }, 500);
};
