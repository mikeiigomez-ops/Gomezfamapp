/* The big collection: 3 more squishy sets, seasonal sets (🎃 Spooky, ❄️ Winter), 25 Niddos (squeezy stress balls
   with press-and-hold), ✨ shiny variants, and 👑 Ultimates you can only earn — by doing chores, routines,
   being kind and collecting. All art is original and drawn here as SVG. Loaded after squish.js. */
'use strict';

/* =========================================================
   Sets, seasons, rarity
   ========================================================= */
Object.assign(SETS, {
  ocean: ['🌊', 'Ocean Pals'], snack: ['🍦', 'Snack Shack'], farm: ['🐮', 'Farm & Forest'],
  niddo: ['🫧', 'Niddos'], spooky: ['🎃', 'Spooky'], winter: ['❄️', 'Winter Wonderland'], ult: ['👑', 'Ultimates'],
});
const SEASONS = { spooky: { name: 'Spooky', emoji: '🎃', from: '10-01', to: '11-07', back: 'October' }, winter: { name: 'Winter', emoji: '❄️', from: '12-01', to: '01-10', back: 'December' } };
function inSeason(key, d = today()) {
  const x = SEASONS[key];
  if (!x) return true;
  const md = d.slice(5);
  return x.from <= x.to ? md >= x.from && md <= x.to : md >= x.from || md <= x.to;
}
const isDark = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b < 110; };
const rnd = (seed) => { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; };
const hashStr = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;

/* =========================================================
   Catalog
   ========================================================= */
// [id, species, name, body, accent, rarity, fx, extra]
const MORE = [
  // 🌊 Ocean Pals
  ['octo1', 'octopus', 'Octo', '#ff8fab', '#ffd1dc', 'C'], ['octo2', 'octopus', 'Lilac Octo', '#c3a3ef', '#ece1ff', 'R'], ['octo3', 'octopus', 'Galaxy Octo', '#2b2560', '#ff9de2', 'M', 'galaxy'],
  ['jelly1', 'jelly', 'Jelly', '#a5d8ff', '#d0bfff', 'C'], ['jelly2', 'jelly', 'Pink Jelly', '#ffc9de', '#ff8fab', 'R'], ['jelly3', 'jelly', 'Glow Jelly', '#b2f2bb', '#63e6be', 'E', 'glow'],
  ['seal1', 'seal', 'Sealy', '#ced4da', '#868e96', 'C'], ['seal2', 'seal', 'Blush Sealy', '#ffdeeb', '#faa2c1', 'R'], ['seal3', 'seal', 'Snow Sealy', '#f1f3f5', '#dee2e6', 'E', 'holo'],
  ['turt1', 'turtle', 'Shelly', '#8ce99a', '#2f9e44', 'C'], ['turt2', 'turtle', 'Sunny Shelly', '#ffe066', '#f08c00', 'R'], ['turt3', 'turtle', 'Golden Shelly', '#ffd43b', '#e8590c', 'L', 'gold'],
  ['crab1', 'crab', 'Pinchy', '#ff6b6b', '#c92a2a', 'C'], ['crab2', 'crab', 'Peach Pinchy', '#ffc078', '#e8590c', 'R'], ['crab3', 'crab', 'Ruby Pinchy', '#e03131', '#ffd43b', 'E', 'fire'],
  ['shark1', 'shark', 'Chomp', '#74c0fc', '#e7f5ff', 'C'], ['shark2', 'shark', 'Pink Chomp', '#faa2c1', '#fff0f6', 'R'], ['shark3', 'shark', 'Mega Chomp', '#5c7cfa', '#e5dbff', 'L', 'holo'],
  // 🍦 Snack Shack
  ['donut1', 'donut', 'Sprinkles', '#ff8fab', '#e0a96d', 'C'], ['donut2', 'donut', 'Choco Sprinkles', '#7a4a33', '#e0a96d', 'R'], ['donut3', 'donut', 'Diamond Donut', '#c9f6ff', '#e0a96d', 'M', 'diamond'],
  ['boba1', 'boba', 'Boba', '#e9c9a8', '#5c3d2e', 'C'], ['boba2', 'boba', 'Taro Boba', '#d0bfff', '#5c3d2e', 'R'], ['boba3', 'boba', 'Starry Boba', '#2b2560', '#ffd43b', 'L', 'galaxy'],
  ['ice1', 'icecream', 'Scoopy', '#ffdeeb', '#e8b06a', 'C'], ['ice2', 'icecream', 'Mint Chip Scoopy', '#b2f2bb', '#e8b06a', 'R'], ['ice3', 'icecream', 'Rainbow Scoopy', '#ffffff', '#e8b06a', 'E', 'rainbow'],
  ['sushi1', 'sushi', 'Sushi', '#ff8a65', '#2d3b2d', 'C'], ['sushi2', 'sushi', 'Tamago', '#ffe066', '#2d3b2d', 'R'], ['sushi3', 'sushi', 'Golden Sushi', '#ffd43b', '#2d3b2d', 'E', 'gold'],
  ['cookie1', 'cookie', 'Cookie', '#e0a96d', '#5c3d2e', 'C'], ['cookie2', 'cookie', 'Sugar Cookie', '#ffe3ec', '#ff8fab', 'R'], ['cookie3', 'cookie', 'Galaxy Cookie', '#3b2a6b', '#ffd43b', 'E', 'galaxy'],
  ['avo1', 'avocado', 'Avo', '#c0eb75', '#2b8a3e', 'C'], ['avo2', 'avocado', 'Ripe Avo', '#d8f5a2', '#5c3d2e', 'R'], ['avo3', 'avocado', 'Holo Avo', '#e9fac8', '#2b8a3e', 'E', 'holo'],
  // 🐮 Farm & Forest
  ['pig1', 'pig', 'Piggy', '#ffc9d6', '#ff8fab', 'C'], ['pig2', 'pig', 'Lilac Piggy', '#e5dbff', '#b197fc', 'R'], ['pig3', 'pig', 'Golden Piggy', '#ffd43b', '#f08c00', 'L', 'gold'],
  ['chick1', 'chick', 'Peep', '#ffe066', '#ffd43b', 'C'], ['chick2', 'chick', 'Mint Peep', '#b2f2bb', '#8ce99a', 'R'], ['chick3', 'chick', 'Rainbow Peep', '#ffffff', '#ffffff', 'E', 'rainbow'],
  ['sheep1', 'sheep', 'Woolly', '#f8f9fa', '#495057', 'C'], ['sheep2', 'sheep', 'Pink Woolly', '#ffdeeb', '#862e9c', 'R'], ['sheep3', 'sheep', 'Cloud Woolly', '#e7f5ff', '#748ffc', 'E', 'holo'],
  ['cow1', 'cow', 'Moo', '#ffffff', '#343a40', 'C'], ['cow2', 'cow', 'Strawberry Moo', '#ffdeeb', '#e64980', 'R'], ['cow3', 'cow', 'Moon Moo', '#2b2560', '#ffd43b', 'L', 'galaxy'],
  ['bee1', 'bee', 'Buzzy', '#ffd43b', '#343a40', 'C'], ['bee2', 'bee', 'Pastel Buzzy', '#fff3bf', '#b197fc', 'R'], ['bee3', 'bee', 'Honey Buzzy', '#fab005', '#5c3d2e', 'E', 'gold'],
  ['panda1', 'panda', 'Bao', '#ffffff', '#2b2b2b', 'C'], ['panda2', 'panda', 'Pink Bao', '#ffe3ec', '#2b2b2b', 'R'], ['panda3', 'panda', 'Rainbow Bao', '#ffffff', '#2b2b2b', 'M', 'rainbow'],
  // 🎃 Spooky (October → Nov 7)
  ['ghost1', 'ghost', 'Boo', '#f8f9fa', '#e9ecef', 'C', '', { season: 'spooky' }], ['ghost2', 'ghost', 'Pink Boo', '#ffdeeb', '#faa2c1', 'R', '', { season: 'spooky' }], ['ghost3', 'ghost', 'Glow Boo', '#d3f9d8', '#69db7c', 'E', 'glow', { season: 'spooky' }],
  ['pump1', 'pumpkin', 'Pumpkin', '#ff922b', '#2b8a3e', 'C', '', { season: 'spooky' }], ['pump2', 'pumpkin', 'Ghost Pumpkin', '#f1f3f5', '#2b8a3e', 'R', '', { season: 'spooky' }], ['pump3', 'pumpkin', 'Jack', '#ff6b00', '#2b8a3e', 'L', 'fire', { season: 'spooky' }],
  ['bat1', 'bat', 'Batty', '#5f3dc4', '#3b2a6b', 'C', '', { season: 'spooky' }], ['bat2', 'bat', 'Pink Batty', '#f783ac', '#c2255c', 'R', '', { season: 'spooky' }], ['bat3', 'bat', 'Vampire Batty', '#2b2b3a', '#e03131', 'E', '', { season: 'spooky' }],
  ['candy1', 'candy', 'Candy', '#ff8787', '#ffd43b', 'C', '', { season: 'spooky' }], ['candy2', 'candy', 'Sour Candy', '#8ce99a', '#ffe066', 'R', '', { season: 'spooky' }], ['candy3', 'candy', 'Rainbow Candy', '#ffffff', '#c084fc', 'E', 'rainbow', { season: 'spooky' }],
  ['witch1', 'cat', 'Witch Kitty', '#868e96', '#dee2e6', 'C', '', { season: 'spooky', acc: 'witch' }], ['witch2', 'frog', 'Witch Froggy', '#8fd16a', '#d9f5c4', 'R', '', { season: 'spooky', acc: 'witch' }], ['witch3', 'axolotl', 'Witch Lolo', '#3b2a6b', '#9a86f0', 'E', 'galaxy', { season: 'spooky', acc: 'witch' }],
  ['mummy1', 'bear', 'Mummy Teddy', '#e9d8b4', '#f1e3c8', 'C', '', { season: 'spooky', acc: 'mummy' }], ['mummy2', 'bunny', 'Mummy Bunbun', '#f1e3c8', '#ffc1d3', 'R', '', { season: 'spooky', acc: 'mummy' }], ['mummy3', 'mochi', 'Mummy Mochi', '#8ce99a', '#69db7c', 'E', '', { season: 'spooky', acc: 'mummy' }],
  // ❄️ Winter (Dec → Jan 10)
  ['snowm1', 'snowman', 'Frosty', '#f8f9fa', '#e63946', 'C', '', { season: 'winter' }], ['snowm2', 'snowman', 'Blue Frosty', '#d0ebff', '#4dabf7', 'R', '', { season: 'winter' }], ['snowm3', 'snowman', 'Crystal Frosty', '#e3fafc', '#99e9f2', 'E', 'holo', { season: 'winter' }],
  ['ginger1', 'ginger', 'Ginger', '#c47b3c', '#ff6b6b', 'C', '', { season: 'winter' }], ['ginger2', 'ginger', 'Pink Ginger', '#f4a7b9', '#ffffff', 'R', '', { season: 'winter' }], ['ginger3', 'ginger', 'Golden Ginger', '#ffd43b', '#ff6b6b', 'L', 'gold', { season: 'winter' }],
  ['mug1', 'mug', 'Cocoa', '#ff6b6b', '#e03131', 'C', '', { season: 'winter' }], ['mug2', 'mug', 'Mint Cocoa', '#8ce99a', '#2b8a3e', 'R', '', { season: 'winter' }], ['mug3', 'mug', 'Starry Cocoa', '#2b2560', '#ffd43b', 'E', 'galaxy', { season: 'winter' }],
  ['flake1', 'flake', 'Flurry', '#a5d8ff', '#ffffff', 'C', '', { season: 'winter' }], ['flake2', 'flake', 'Pink Flurry', '#ffc9de', '#ffffff', 'R', '', { season: 'winter' }], ['flake3', 'flake', 'Diamond Flurry', '#e3fafc', '#ffffff', 'M', 'diamond', { season: 'winter' }],
  ['santa1', 'penguin', 'Santa Pip', '#2f3a56', '#ffffff', 'C', '', { season: 'winter', acc: 'santa' }], ['santa2', 'bear', 'Santa Teddy', '#c98e5a', '#f1d1b0', 'R', '', { season: 'winter', acc: 'santa' }], ['santa3', 'mochi', 'Santa Mochi', '#ffe3ec', '#ffb3c8', 'E', 'holo', { season: 'winter', acc: 'santa' }],
  ['deer1', 'bear', 'Rudy', '#a0703c', '#f1d1b0', 'C', '', { season: 'winter', acc: 'antlers' }], ['deer2', 'bear', 'Snowy Rudy', '#f1f3f5', '#ffc9d6', 'R', '', { season: 'winter', acc: 'antlers' }], ['deer3', 'bear', 'Starlight Rudy', '#ffd43b', '#fff3bf', 'E', 'gold', { season: 'winter', acc: 'antlers' }],
  // 🫧 Niddos (squeezy stress balls) — sp = shape, fx = texture
  ['nd1', 'ball', 'Lemon Gloop', '#ffe066', '#fff6c2', 'C', '', { kind: 'niddo', face: true }], ['nd2', 'ball', 'Berry Gloop', '#ff6b9d', '#ffd1e1', 'C', '', { kind: 'niddo' }],
  ['nd3', 'ball', 'Mint Gloop', '#63e6be', '#e2fff4', 'C', '', { kind: 'niddo' }], ['nd4', 'ball', 'Sky Gloop', '#74c0fc', '#e3f2ff', 'C', '', { kind: 'niddo', face: true }],
  ['nd5', 'cube', 'Squeeze Cube', '#b197fc', '#efe8ff', 'C', '', { kind: 'niddo', face: true }], ['nd6', 'cube', 'Ice Cube', '#a5e8ff', '#ffffff', 'R', 'snow', { kind: 'niddo' }],
  ['nd7', 'drop', 'Goo Drop', '#69db7c', '#d3f9d8', 'C', '', { kind: 'niddo', face: true }], ['nd8', 'drop', 'Slime Drop', '#a9e34b', '#ffffff', 'R', 'glitter', { kind: 'niddo' }],
  ['nd9', 'ball', 'Glitter Gloop', '#f783ac', '#ffe066', 'R', 'glitter', { kind: 'niddo' }], ['nd10', 'ball', 'Swirl Gloop', '#ffa8a8', '#91a7ff', 'R', 'marble', { kind: 'niddo' }],
  ['nd11', 'ball', 'Crunchy Beads', '#ffd8a8', '#ff8787', 'R', 'beads', { kind: 'niddo' }], ['nd12', 'egg', 'Dino Egg', '#c0eb75', '#5c940d', 'R', 'spots', { kind: 'niddo' }],
  ['nd13', 'heart', 'Heart Gloop', '#ff8fab', '#ffc2d4', 'R', '', { kind: 'niddo', face: true }], ['nd14', 'teenie', 'Teenie Trio', '#ffd43b', '#63e6be', 'R', '', { kind: 'niddo', face: true }],
  ['nd15', 'ball', 'Fuzzy Gloop', '#e599f7', '#f8d9ff', 'E', 'fuzz', { kind: 'niddo', face: true }], ['nd16', 'ball', 'Mood Gloop', '#4dabf7', '#f06595', 'E', 'mood', { kind: 'niddo', blurb: 'Changes color when you squeeze it!' }],
  ['nd17', 'ball', 'Glow Gloop', '#b2f2bb', '#ffffff', 'E', 'glow', { kind: 'niddo' }], ['nd18', 'ball', 'Snow Globe', '#d0ebff', '#ffffff', 'E', 'snow', { kind: 'niddo' }],
  ['nd19', 'cube', 'Marble Cube', '#fff3bf', '#e599f7', 'E', 'marble', { kind: 'niddo' }], ['nd20', 'heart', 'Glitter Heart', '#ff6b9d', '#fff3bf', 'E', 'glitter', { kind: 'niddo' }],
  ['nd21', 'ball', 'Fishbowl Gloop', '#99e9f2', '#ff922b', 'L', 'fish', { kind: 'niddo' }], ['nd22', 'ball', 'Galaxy Gloop', '#3b2a6b', '#ff9de2', 'L', 'galaxy', { kind: 'niddo' }],
  ['nd23', 'drop', 'Rainbow Drop', '#ffffff', '#ffffff', 'L', 'rainbow', { kind: 'niddo' }], ['nd24', 'ball', 'Golden Gloop', '#ffd43b', '#f08c00', 'M', 'gold', { kind: 'niddo', face: true }],
  // 👑 Ultimates — earned, never bought
  ['u_hero', 'penguin', 'Hero Pip', '#364fc7', '#ffd43b', 'U', '', { acc: 'mask', unlock: 'chores50' }],
  ['u_champ', 'bear', 'Champion Teddy', '#ffd43b', '#ff922b', 'U', 'gold', { acc: 'crown', unlock: 'chores150' }],
  ['u_streak', 'star', 'Streak Star', '#ffd43b', '#ffe066', 'U', 'gold', { acc: 'crown', unlock: 'streak14' }],
  ['u_sun', 'dragon', 'Sunrise Draggy', '#ff922b', '#ffd43b', 'U', 'fire', { acc: 'halo', unlock: 'routines20' }],
  ['u_wiz', 'cat', 'Wizard Kitty', '#3b5bdb', '#ffd43b', 'U', 'galaxy', { acc: 'wizard', unlock: 'word7' }],
  ['u_angel', 'axolotl', 'Angel Lolo', '#fff0f6', '#ffd43b', 'U', 'holo', { acc: 'halo', unlock: 'kudos10' }],
  ['u_friend', 'bunny', 'Friendship Bunbun', '#ffdeeb', '#ff8fab', 'U', 'holo', { acc: 'bow', unlock: 'trade1' }],
  ['u_queen', 'bee', 'Queen Buzzy', '#ffd43b', '#343a40', 'U', 'gold', { acc: 'crown', unlock: 'todos25' }],
  ['u_squish', 'mochi', 'Squishmaster Mochi', '#ffffff', '#ff9de2', 'U', 'rainbow', { acc: 'crown', unlock: 'squish1000' }],
  ['u_prism', 'cloud', 'Prism Cloudy', '#ffffff', '#c084fc', 'U', 'rainbow', { acc: 'halo', unlock: 'shiny5' }],
  ['u_cosmic', 'whale', 'Cosmic Bubbles', '#2b2560', '#ff9de2', 'U', 'galaxy', { acc: 'crown', unlock: 'unique50' }],
  ['u_crown', 'unicorn', 'Crown Sparkles', '#ffffff', '#ffd43b', 'U', 'rainbow', { acc: 'crown', unlock: 'allRegular' }],
  ['u_gloop', 'ball', 'Cosmic Gloop', '#2b2560', '#ffd23f', 'U', 'galaxy', { kind: 'niddo', face: true, unlock: 'allNiddo' }],
  ['u_pking', 'pumpkin', 'Pumpkin King', '#ff6b00', '#ffd43b', 'U', 'fire', { acc: 'crown', unlock: 'spookySet' }],
  ['u_frost', 'flake', 'Frost Queen', '#e3fafc', '#a5d8ff', 'U', 'diamond', { acc: 'crown', unlock: 'winterSet' }],
];
const SPECIES_SET = { octopus: 'ocean', jelly: 'ocean', seal: 'ocean', turtle: 'ocean', crab: 'ocean', shark: 'ocean', donut: 'snack', boba: 'snack', icecream: 'snack', sushi: 'snack', cookie: 'snack', avocado: 'snack', pig: 'farm', chick: 'farm', sheep: 'farm', cow: 'farm', bee: 'farm', panda: 'farm' };
for (const [id, sp, name, c1, c2, r, fx, extra = {}] of MORE) {
  const kind = extra.kind || 'squishy';
  const set = r === 'U' ? 'ult' : kind === 'niddo' ? 'niddo' : extra.season || SPECIES_SET[sp] || SPECIES[sp] || 'dream';
  const s = { id, sp, name, c1, c2, r, fx: fx || '', set, kind, ...extra };
  SQUISHIES.push(s);
  SQ[id] = s;
}

/* =========================================================
   New species art (same 100×100 kawaii style)
   ========================================================= */
const stripesIn = (ys, h, fill, rx = 36, ry = 32, cy = 60, op = 1) => ys.map((y) => { const k = 1 - ((y - cy) / ry) ** 2; if (k <= 0) return ''; const hw = rx * Math.sqrt(k) - 1; return `<rect x="${(50 - hw).toFixed(1)}" y="${y - h / 2}" width="${(hw * 2).toFixed(1)}" height="${h}" rx="${h / 2}" fill="${fill}" opacity="${op}"/>`; }).join('');
Object.assign(EXTRA_ART, {
  octopus: ({ F, A }) => ({ back: [22, 36, 50, 64, 78].map((x) => `<ellipse cx="${x}" cy="80" rx="8" ry="13" fill="${F}"/><circle cx="${x}" cy="86" r="2" fill="${A}"/>`).join(''), body: `<ellipse cx="50" cy="50" rx="33" ry="30" fill="${F}"/>`, fy: 52, top: 20 }),
  jelly: ({ F, A }) => ({ back: [30, 42, 58, 70].map((x, i) => `<path d="M${x} 56 q${i % 2 ? -5 : 5} 9 0 17 q${i % 2 ? 5 : -5} 9 0 17" stroke="${A}" stroke-width="4" fill="none" stroke-linecap="round"/>`).join(''), body: `<path d="M14 58 Q14 18 50 18 Q86 18 86 58 Q68 52 50 58 Q32 52 14 58Z" fill="${F}"/>`, fy: 44, top: 18 }),
  seal: ({ F, A, ink }) => ({ body: `<ellipse cx="50" cy="62" rx="40" ry="28" fill="${F}"/>`, front: `<ellipse cx="20" cy="84" rx="11" ry="5" fill="${A}" transform="rotate(-20 20 84)"/><ellipse cx="80" cy="84" rx="11" ry="5" fill="${A}" transform="rotate(20 80 84)"/>`, over: `<ellipse cx="50" cy="63" rx="3" ry="2.2" fill="${ink}"/><path d="M38 64 L26 62 M38 67 L27 68 M62 64 L74 62 M62 67 L73 68" stroke="${ink}" stroke-width="1" opacity=".45"/>`, fy: 58, mouthY: 67, top: 34 }),
  turtle: ({ F, A }) => { const d = mixHex(A, '#000000', 0.2); return { back: `<path d="M14 68 Q14 22 50 22 Q86 22 86 68Z" fill="${A}"/><path d="M50 28 L60 40 L54 54 L46 54 L40 40Z M28 46 L40 40 M72 46 L60 40 M30 64 L46 54 M70 64 L54 54" stroke="${d}" stroke-width="2.4" fill="none" stroke-linejoin="round"/><ellipse cx="24" cy="88" rx="8" ry="5" fill="${F}"/><ellipse cx="76" cy="88" rx="8" ry="5" fill="${F}"/>`, body: `<ellipse cx="50" cy="72" rx="24" ry="19" fill="${F}"/>`, fy: 72, ex: 9, top: 22 }; },
  crab: ({ F, A }) => ({ back: `<path d="M22 58 L14 44 M78 58 L86 44" stroke="${F}" stroke-width="6" stroke-linecap="round"/><ellipse cx="10" cy="36" rx="6" ry="11" fill="${F}" transform="rotate(-25 10 36)"/><ellipse cx="19" cy="33" rx="6" ry="11" fill="${F}" transform="rotate(20 19 33)"/><ellipse cx="90" cy="36" rx="6" ry="11" fill="${F}" transform="rotate(25 90 36)"/><ellipse cx="81" cy="33" rx="6" ry="11" fill="${F}" transform="rotate(-20 81 33)"/><path d="M24 76 L12 84 M28 82 L18 92 M76 76 L88 84 M72 82 L82 92" stroke="${A}" stroke-width="4" stroke-linecap="round"/>`, body: `<ellipse cx="50" cy="64" rx="34" ry="25" fill="${F}"/>`, fy: 62, top: 40 }),
  shark: ({ F, A, ink }) => ({ back: `<path d="M40 34 L56 6 L66 36Z" fill="${F}"/><path d="M82 60 L98 46 L96 78Z" fill="${F}"/>`, body: `<ellipse cx="50" cy="60" rx="38" ry="31" fill="${F}"/>`, front: `<path d="M16 66 Q50 96 84 66 Q78 92 50 93 Q22 92 16 66Z" fill="${A}"/>`, over: `<path d="M22 54 q3 4 0 8 M26 52 q3 4 0 8" stroke="${ink}" stroke-width="1.4" fill="none" opacity=".35"/>`, fy: 56, top: 30 }),
  donut: ({ F, A, s }) => { const r = rnd(hashStr(s.id)); const cols = ['#ff6b9d', '#5cc8ff', '#ffd84d', '#7ee081', '#c084fc', '#ffffff']; const spr = [...Array(14)].map((_, i) => { const a = (i / 14) * Math.PI * 2 - 0.3; if (Math.sin(a) > 0.55) return ''; const rr = 22 + r() * 6; return `<rect x="${(50 + rr * Math.cos(a) - 3).toFixed(1)}" y="${(54 + rr * Math.sin(a) - 1).toFixed(1)}" width="6" height="2.4" rx="1.2" fill="${cols[i % cols.length]}" transform="rotate(${Math.round(r() * 180)} ${(50 + rr * Math.cos(a)).toFixed(1)} ${(54 + rr * Math.sin(a)).toFixed(1)})"/>`; }).join(''); return { body: `<path fill-rule="evenodd" d="M50 16 a38 38 0 1 0 .01 0Z M50 45 a9 9 0 1 0 .01 0Z" fill="${A}"/><path fill-rule="evenodd" d="M50 21 a33 33 0 1 0 .01 0Z M50 43 a11 11 0 1 0 .01 0Z" fill="${F}"/>`, front: spr, eyesY: 70, ex: 10, mouthY: 77, top: 18 }; },
  boba: ({ F }) => ({ back: `<rect x="56" y="4" width="7" height="36" rx="3.5" fill="#ff7aa8" transform="rotate(12 59 22)"/>`, body: `<path d="M22 30 L78 30 L71 92 Q50 96 29 92Z" fill="${F}"/>`, front: `<ellipse cx="50" cy="30" rx="30" ry="7" fill="#ffffff" opacity=".75"/>${[[36, 84], [46, 86], [56, 86], [65, 83], [41, 78], [52, 79], [61, 77]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#3b2416"/><circle cx="${x - 1.2}" cy="${y - 1.4}" r="1" fill="#fff" opacity=".6"/>`).join('')}`, fy: 54, top: 24 }),
  icecream: ({ F, s }) => ({ back: `<path d="M30 56 L70 56 L50 97Z" fill="#e8b06a"/><path d="M36 60 L56 88 M46 58 L62 78 M64 60 L44 88 M54 58 L38 78" stroke="#c98a3c" stroke-width="1.6"/>`, body: `<circle cx="50" cy="44" r="27" fill="${F}"/><ellipse cx="30" cy="62" rx="7" ry="6" fill="${F}"/><ellipse cx="66" cy="63" rx="6" ry="7" fill="${F}"/>`, front: s.id === 'ice2' ? [[34, 36], [62, 30], [58, 54], [40, 56], [70, 46]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.6" fill="#4a2c1a"/>`).join('') : `<circle cx="50" cy="15" r="5" fill="#ff4d6d"/>`, fy: 46, top: 18 }),
  sushi: ({ F }) => ({ body: `<rect x="14" y="46" width="72" height="42" rx="18" fill="#fffaf1"/>`, front: `<rect x="10" y="30" width="80" height="24" rx="12" fill="${F}"/><path d="M24 36 L32 48 M40 34 L48 48 M56 34 L64 48 M72 36 L78 46" stroke="#fff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/><rect x="18" y="30" width="9" height="56" rx="3" fill="#2d3b2d"/>`, eyesY: 68, mouthY: 75, top: 30 }),
  cookie: ({ F, A }) => ({ body: `<circle cx="50" cy="58" r="36" fill="${F}"/>`, front: [[30, 44], [66, 40], [74, 66], [28, 74], [52, 32], [40, 84], [64, 82]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="3" fill="${A}"/>`).join(''), fy: 60 }),
  avocado: ({ F, A }) => ({ body: `<path d="M50 12 C26 12 16 44 16 62 C16 84 32 94 50 94 C68 94 84 84 84 62 C84 44 74 12 50 12Z" fill="${A}"/><path d="M50 18 C31 18 22 46 22 63 C22 81 35 88 50 88 C65 88 78 81 78 63 C78 46 69 18 50 18Z" fill="${F}"/>`, front: `<circle cx="50" cy="70" r="13" fill="#9a6b3f"/><circle cx="46" cy="66" r="3.5" fill="#fff" opacity=".3"/>`, eyesY: 44, ex: 10, mouthY: 51, top: 14 }),
  pig: ({ F, A, ear, ink }) => ({ back: ear('M24 36 L26 18 L40 30Z', F) + ear('M76 36 L74 18 L60 30Z', F), body: `<ellipse cx="50" cy="60" rx="36" ry="32" fill="${F}"/>`, over: `<ellipse cx="50" cy="66" rx="11" ry="7.5" fill="${A}"/><ellipse cx="46" cy="66" rx="2" ry="2.8" fill="${ink}" opacity=".6"/><ellipse cx="54" cy="66" rx="2" ry="2.8" fill="${ink}" opacity=".6"/>`, eyesY: 52, mouthY: 64, noMouth: true }),
  chick: ({ F, A }) => ({ back: `<path d="M44 30 Q44 14 50 24 Q54 12 58 28Z" fill="${F}"/>`, body: `<ellipse cx="50" cy="60" rx="34" ry="32" fill="${F}"/>`, front: `<ellipse cx="17" cy="64" rx="6" ry="11" fill="${A}" transform="rotate(20 17 64)"/><ellipse cx="83" cy="64" rx="6" ry="11" fill="${A}" transform="rotate(-20 83 64)"/><path d="M44 61 L56 61 L50 69Z" fill="#ff9f1c"/><path d="M40 92 l-3 4 M40 92 l0 5 M40 92 l3 4 M60 92 l-3 4 M60 92 l0 5 M60 92 l3 4" stroke="#ff9f1c" stroke-width="2" stroke-linecap="round"/>`, eyesY: 53, mouthY: 62, noMouth: true }),
  sheep: ({ F, A }) => ({ back: [...Array(11)].map((_, i) => { const a = (i / 11) * Math.PI * 2; return `<circle cx="${(50 + 30 * Math.cos(a)).toFixed(1)}" cy="${(58 + 28 * Math.sin(a)).toFixed(1)}" r="13" fill="${F}"/>`; }).join('') + `<ellipse cx="28" cy="54" rx="9" ry="5" fill="${A}" transform="rotate(-25 28 54)"/><ellipse cx="72" cy="54" rx="9" ry="5" fill="${A}" transform="rotate(25 72 54)"/>`, body: `<circle cx="50" cy="58" r="30" fill="${F}"/>`, front: `<ellipse cx="50" cy="63" rx="17" ry="16" fill="${mixHex(A, '#ffffff', 0.75)}"/>`, eyesY: 60, ex: 7, mouthY: 68, top: 24 }),
  cow: ({ F, A, ear }) => ({ back: ear('M30 32 L26 16 L38 26Z', '#f3e6c4') + ear('M70 32 L74 16 L62 26Z', '#f3e6c4') + `<ellipse cx="16" cy="46" rx="11" ry="6" fill="${F}" transform="rotate(-20 16 46)"/><ellipse cx="84" cy="46" rx="11" ry="6" fill="${F}" transform="rotate(20 84 46)"/>`, body: `<ellipse cx="50" cy="60" rx="36" ry="32" fill="${F}"/>`, front: `<ellipse cx="30" cy="44" rx="8" ry="6" fill="${A}"/><ellipse cx="74" cy="74" rx="9" ry="7" fill="${A}"/><ellipse cx="66" cy="36" rx="5" ry="4" fill="${A}"/>`, over: `<ellipse cx="50" cy="72" rx="16" ry="10" fill="#ffc2d1"/><ellipse cx="45" cy="72" rx="2" ry="2.6" fill="#c2255c" opacity=".6"/><ellipse cx="55" cy="72" rx="2" ry="2.6" fill="#c2255c" opacity=".6"/>`, eyesY: 56, mouthY: 66, noMouth: true }),
  bee: ({ F, A }) => ({ back: `<ellipse cx="32" cy="26" rx="11" ry="16" fill="#e8f6ff" opacity=".9" transform="rotate(-30 32 26)"/><ellipse cx="68" cy="26" rx="11" ry="16" fill="#e8f6ff" opacity=".9" transform="rotate(30 68 26)"/><path d="M42 30 Q38 18 32 14 M58 30 Q62 18 68 14" stroke="${A}" stroke-width="2" fill="none"/><circle cx="32" cy="14" r="3" fill="${A}"/><circle cx="68" cy="14" r="3" fill="${A}"/>`, body: `<ellipse cx="50" cy="60" rx="36" ry="32" fill="${F}"/>`, front: stripesIn([74, 85], 7, A), fy: 56 }),
  panda: ({ F }) => ({ back: `<circle cx="25" cy="34" r="11" fill="#2b2b2b"/><circle cx="75" cy="34" r="11" fill="#2b2b2b"/>`, body: `<ellipse cx="50" cy="60" rx="36" ry="32" fill="${F}"/>`, over: `<ellipse cx="39" cy="57" rx="8" ry="10" fill="#2b2b2b" transform="rotate(25 39 57)"/><ellipse cx="61" cy="57" rx="8" ry="10" fill="#2b2b2b" transform="rotate(-25 61 57)"/><ellipse cx="50" cy="64" rx="3.2" ry="2.3" fill="#2b2b2b"/>`, eyesY: 56, mouthY: 68, eyeInk: '#ffffff' }),
  ghost: ({ F }) => ({ body: `<path d="M18 58 Q18 16 50 16 Q82 16 82 58 L82 88 Q76 81 70 88 Q64 95 58 88 Q52 81 46 88 Q40 95 34 88 Q28 81 18 88Z" fill="${F}"/>`, front: `<ellipse cx="16" cy="62" rx="6" ry="9" fill="${F}" transform="rotate(30 16 62)"/><ellipse cx="84" cy="62" rx="6" ry="9" fill="${F}" transform="rotate(-30 84 62)"/>`, eyesY: 46, mouthY: 55, top: 16 }),
  pumpkin: ({ F, A, dark }) => ({ back: `<path d="M47 34 Q46 22 54 16 L57 20 Q51 25 53 34Z" fill="${A}"/><path d="M54 24 Q64 16 70 22 Q62 28 54 26Z" fill="${A}"/>`, body: `<g fill="${F}"><ellipse cx="32" cy="62" rx="22" ry="28"/><ellipse cx="68" cy="62" rx="22" ry="28"/><ellipse cx="50" cy="62" rx="25" ry="30"/></g>`, over: `<path d="M38 36 Q32 62 38 90 M62 36 Q68 62 62 90" stroke="${dark}" stroke-width="2" fill="none" opacity=".35"/>`, fy: 64, top: 34 }),
  bat: ({ F, A, ear, s }) => ({ back: `<path d="M22 54 Q4 44 2 26 Q12 34 18 30 Q20 40 30 42Z" fill="${A}"/><path d="M78 54 Q96 44 98 26 Q88 34 82 30 Q80 40 70 42Z" fill="${A}"/>` + ear('M30 36 L32 16 L44 30Z', F) + ear('M70 36 L68 16 L56 30Z', F), body: `<ellipse cx="50" cy="60" rx="32" ry="30" fill="${F}"/>`, over: `<path d="M45 67 l1.6 4 l1.6 -4Z M51.8 67 l1.6 4 l1.6 -4Z" fill="#fff"/>`, eyeInk: isDark(s.c1) ? '#ffffff' : undefined, fy: 60 }),
  candy: ({ F, A }) => ({ back: `<path d="M24 58 L4 42 L9 58 L4 74Z" fill="${A}"/><path d="M76 58 L96 42 L91 58 L96 74Z" fill="${A}"/>`, body: `<ellipse cx="50" cy="58" rx="30" ry="25" fill="${F}"/>`, front: `<path d="M30 42 Q36 58 30 74 M70 42 Q64 58 70 74" stroke="#ffffff" stroke-width="3" fill="none" opacity=".45"/>`, fy: 58, top: 34 }),
  snowman: ({ F, A }) => ({ back: `<path d="M28 66 L10 54 M72 66 L90 54 M14 57 L10 50 M86 57 L90 50" stroke="#8a5a34" stroke-width="3" stroke-linecap="round"/>`, body: `<circle cx="50" cy="73" r="24" fill="${F}"/><circle cx="50" cy="38" r="20" fill="${F}"/>`, front: `<path d="M30 54 Q50 64 70 54 L70 60 Q50 70 30 60Z" fill="${A}"/><rect x="60" y="58" width="7" height="16" rx="3" fill="${A}" transform="rotate(-10 63 66)"/><circle cx="50" cy="72" r="2.4" fill="#343a40"/><circle cx="50" cy="82" r="2.4" fill="#343a40"/>`, over: `<path d="M50 41 L62 44 L50 46Z" fill="#ff8c2b"/>`, eyesY: 34, ex: 7, mouthY: 49, top: 19 }),
  ginger: ({ F, A }) => ({ body: `<circle cx="50" cy="30" r="17" fill="${F}"/><path d="M32 46 Q50 40 68 46 L84 52 Q91 58 82 63 L70 58 L72 80 L80 89 Q79 97 70 95 L56 84 L44 84 L30 95 Q21 97 20 89 L28 80 L30 58 L18 63 Q9 58 16 52Z" fill="${F}"/>`, front: `<path d="M74 52 l3 3 l3 -3 l3 3 M20 52 l3 3 l3 -3 l3 3 M27 88 l3 -3 l3 3 M67 88 l3 -3 l3 3" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="50" cy="56" r="3" fill="${A}"/><circle cx="50" cy="67" r="3" fill="${A}"/>`, eyesY: 28, ex: 6, mouthY: 35, top: 13 }),
  mug: ({ F, A }) => ({ back: `<path d="M76 50 Q92 50 92 64 Q92 78 76 76" stroke="${A}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M40 26 q-4 -6 0 -12 M52 24 q-4 -6 0 -12 M64 26 q-4 -6 0 -12" stroke="#ced4da" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`, body: `<rect x="22" y="36" width="56" height="56" rx="16" fill="${F}"/>`, front: `<ellipse cx="50" cy="38" rx="25" ry="6" fill="#7a4a33"/><rect x="38" y="32" width="9" height="7" rx="2.5" fill="#fff"/><rect x="51" y="33" width="9" height="7" rx="2.5" fill="#fff" transform="rotate(14 55 36)"/>`, eyesY: 62, mouthY: 69, top: 32 }),
  flake: ({ F }) => ({ back: [0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a} 50 56)"><path d="M50 56 L50 12 M50 24 L42 16 M50 24 L58 16 M50 36 L44 30 M50 36 L56 30" stroke="${F}" stroke-width="6" stroke-linecap="round" fill="none"/></g>`).join(''), body: `<circle cx="50" cy="56" r="22" fill="${F}"/>`, eyesY: 54, ex: 8, mouthY: 61, top: 34 }),
});
Object.assign(ACCESSORIES, {
  crown: (t) => `<path d="M34 ${t + 3} L35 ${t - 12} L43 ${t - 4} L50 ${t - 16} L57 ${t - 4} L65 ${t - 12} L66 ${t + 3}Z" fill="#ffd23f" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="${t - 2}" r="2.6" fill="#ff4d8d"/><circle cx="41" cy="${t}" r="1.8" fill="#4dabf7"/><circle cx="59" cy="${t}" r="1.8" fill="#4dabf7"/>`,
  witch: (t) => `<path d="M34 ${t + 1} Q46 ${t - 18} 56 ${t - 34} Q60 ${t - 14} 66 ${t + 1}Z" fill="#5b3592"/><rect x="38" y="${t - 6}" width="25" height="5" rx="2" fill="#ffd43b"/><ellipse cx="50" cy="${t + 2}" rx="27" ry="5" fill="#4b2a7b"/>`,
  santa: (t) => `<path d="M34 ${t + 2} Q44 ${t - 26} 70 ${t - 14} Q62 ${t - 6} 66 ${t + 2}Z" fill="#e63946"/><rect x="31" y="${t - 3}" width="38" height="8" rx="4" fill="#ffffff"/><circle cx="72" cy="${t - 14}" r="5" fill="#ffffff"/>`,
  wizard: (t) => `<path d="M34 ${t + 2} L50 ${t - 34} L66 ${t + 2}Z" fill="#3b5bdb"/><path d="M47 ${t - 16} l1.5 3 l3 .5 l-2.2 2 l.6 3 l-2.9 -1.5 l-2.9 1.5 l.6 -3 l-2.2 -2 l3 -.5Z" fill="#ffd43b"/><circle cx="58" cy="${t - 6}" r="1.6" fill="#ffd43b"/><ellipse cx="50" cy="${t + 3}" rx="26" ry="5" fill="#364fc7"/>`,
  halo: (t) => `<ellipse cx="50" cy="${t - 11}" rx="16" ry="4.5" fill="none" stroke="#ffd23f" stroke-width="3.5"/>`,
  bow: (t) => `<path d="M66 ${t + 4} L56 ${t - 5} L56 ${t + 12}Z M66 ${t + 4} L76 ${t - 5} L76 ${t + 12}Z" fill="#ff6b9d"/><circle cx="66" cy="${t + 4}" r="3.4" fill="#e64980"/>`,
  antlers: (t) => `<path d="M38 ${t + 3} L32 ${t - 14} M34 ${t - 7} L25 ${t - 11} M33 ${t - 12} L36 ${t - 20} M62 ${t + 3} L68 ${t - 14} M66 ${t - 7} L75 ${t - 11} M67 ${t - 12} L64 ${t - 20}" stroke="#8a5a34" stroke-width="3.5" stroke-linecap="round" fill="none"/>`,
  mummy: () => stripesIn([40, 47, 76, 84], 5.5, '#fffbe9', 36, 32, 60, 0.92),
  mask: (t, s) => { const y = s.sp === 'penguin' ? 56 : 58; return `<path fill-rule="evenodd" d="M28 ${y - 6} Q50 ${y - 12} 72 ${y - 6} Q74 ${y + 6} 64 ${y + 7} Q56 ${y + 7} 50 ${y + 2} Q44 ${y + 7} 36 ${y + 7} Q26 ${y + 6} 28 ${y - 6}Z M39 ${y} a4.5 5.5 0 1 0 .01 0Z M61 ${y} a4.5 5.5 0 1 0 .01 0Z" fill="#e63946"/><path d="M72 ${y - 5} L84 ${y - 10} L82 ${y}Z" fill="#e63946"/>`; },
});

/* =========================================================
   Niddos: squeezy stress balls
   ========================================================= */
function niddoSVG(s, opts = {}) {
  const g = 'nd' + (++svgSeq);
  const c1 = s.c1, c2 = s.c2, r = rnd(hashStr(s.id));
  const edge = mixHex(c1, '#000000', 0.28);
  const shapes = {
    ball: '<circle cx="50" cy="56" r="37"/>',
    cube: '<rect x="15" y="21" width="70" height="70" rx="20"/>',
    drop: '<path d="M50 12 C66 34 86 46 86 64 C86 82 70 93 50 93 C30 93 14 82 14 64 C14 46 34 34 50 12Z"/>',
    egg: '<ellipse cx="50" cy="56" rx="31" ry="38"/>',
    heart: '<path d="M50 91 C20 71 9 55 11 40 C13 26 25 20 36 22 C44 24 48 30 50 34 C52 30 56 24 64 22 C75 20 87 26 89 40 C91 55 80 71 50 91Z"/>',
    teenie: '<circle cx="30" cy="66" r="20"/><circle cx="70" cy="66" r="20"/><circle cx="50" cy="36" r="20"/>',
  };
  const shape = shapes[s.sp] || shapes.ball;
  const fill = {
    rainbow: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a9e"/><stop offset=".25" stop-color="#fecf7a"/><stop offset=".5" stop-color="#a8e6a1"/><stop offset=".75" stop-color="#8ec5ff"/><stop offset="1" stop-color="#c7a4ff"/></linearGradient>`,
    gold: `<radialGradient id="${g}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff6c2"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="#c77800"/></radialGradient>`,
    galaxy: `<radialGradient id="${g}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${mixHex(c1, '#ffffff', 0.35)}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="#120c2e"/></radialGradient>`,
  }[s.fx] || `<radialGradient id="${g}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${mixHex(c1, '#ffffff', 0.62)}" stop-opacity=".97"/><stop offset=".62" stop-color="${c1}" stop-opacity=".9"/><stop offset="1" stop-color="${mixHex(c1, '#000000', 0.18)}" stop-opacity=".96"/></radialGradient>`;
  const dots = (n, rmin, rmax, colors, op = 1) => [...Array(n)].map(() => `<circle cx="${(12 + r() * 76).toFixed(1)}" cy="${(18 + r() * 76).toFixed(1)}" r="${(rmin + r() * (rmax - rmin)).toFixed(1)}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${op}"/>`).join('');
  const tex = {
    glitter: dots(34, 0.6, 1.6, [c2, '#ffffff', '#fff3a6']),
    marble: [30, 52, 74].map((y, i) => `<path d="M6 ${y} C28 ${y - 22} 48 ${y + 20} 94 ${y - 10 + i * 4}" stroke="${c2}" stroke-width="${6 - i}" fill="none" opacity=".6" stroke-linecap="round"/>`).join(''),
    beads: dots(40, 2.4, 3.6, [c2, mixHex(c2, '#ffffff', 0.4), '#ffffff'], 0.85),
    spots: dots(9, 3, 6, [c2], 0.75),
    snow: dots(30, 0.7, 1.8, ['#ffffff']) + `<ellipse cx="50" cy="92" rx="40" ry="10" fill="#ffffff" opacity=".85"/>`,
    galaxy: dots(22, 0.5, 1.4, ['#ffffff', '#ffe066', c2]),
    fish: `<g transform="translate(46 58)"><ellipse rx="9" ry="6" fill="${c2}"/><path d="M8 0 L16 -6 L16 6Z" fill="${c2}"/><circle cx="-4" cy="-1.5" r="1.4" fill="#222"/></g><circle cx="34" cy="44" r="2.4" fill="#fff" opacity=".7"/><circle cx="38" cy="36" r="1.6" fill="#fff" opacity=".7"/>` + `<path d="M14 82 Q30 76 46 82 T86 80 L86 96 L14 96Z" fill="#69db7c" opacity=".5"/>`,
  }[s.fx] || '';
  const fuzz = s.fx === 'fuzz' ? [...Array(48)].map((_, i) => { const a = (i / 48) * Math.PI * 2; return `<path d="M${(50 + 35 * Math.cos(a)).toFixed(1)} ${(56 + 35 * Math.sin(a)).toFixed(1)} L${(50 + 41 * Math.cos(a + 0.05)).toFixed(1)} ${(56 + 41 * Math.sin(a + 0.05)).toFixed(1)}" stroke="${c1}" stroke-width="2.6" stroke-linecap="round"/>`; }).join('') : '';
  const cx = s.sp === 'teenie' ? [30, 70, 50] : [50];
  const fyBase = { cube: 58, drop: 66, egg: 58, heart: 52, teenie: 0 }[s.sp] ?? 58;
  const face = (x, y, k = 1) => `<g class="f-open"><circle cx="${x - 8 * k}" cy="${y}" r="${2.6 * k}" fill="#3a2b3d"/><circle cx="${x + 8 * k}" cy="${y}" r="${2.6 * k}" fill="#3a2b3d"/></g><g class="f-joy"><path d="M${x - 11 * k} ${y + 1} Q${x - 8 * k} ${y - 3} ${x - 5 * k} ${y + 1} M${x + 5 * k} ${y + 1} Q${x + 8 * k} ${y - 3} ${x + 11 * k} ${y + 1}" stroke="#3a2b3d" stroke-width="2" fill="none" stroke-linecap="round"/></g><ellipse cx="${x - 13 * k}" cy="${y + 5 * k}" rx="${4 * k}" ry="${2.4 * k}" fill="#ff8fab" opacity=".55"/><ellipse cx="${x + 13 * k}" cy="${y + 5 * k}" rx="${4 * k}" ry="${2.4 * k}" fill="#ff8fab" opacity=".55"/><path d="M${x - 3.5 * k} ${y + 5 * k} Q${x - 1.7 * k} ${y + 7.8 * k} ${x} ${y + 5 * k} Q${x + 1.7 * k} ${y + 7.8 * k} ${x + 3.5 * k} ${y + 5 * k}" stroke="#3a2b3d" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const faces = !s.face ? '' : s.sp === 'teenie' ? face(30, 66, 0.55) + face(70, 66, 0.55) + face(50, 36, 0.55) : face(50, fyBase);
  const teenieFill = s.sp === 'teenie' ? `<circle cx="70" cy="66" r="20" fill="${c2}" opacity=".85"/><circle cx="50" cy="36" r="20" fill="#ff8fab" opacity=".85"/>` : '';
  const shines = cx.map((x, i) => { const y = s.sp === 'teenie' ? [60, 60, 30][i] : { cube: 34, drop: 44, heart: 34, egg: 34 }[s.sp] ?? 36; const k = s.sp === 'teenie' ? 0.55 : 1; return `<ellipse cx="${x - 13 * k}" cy="${y}" rx="${10 * k}" ry="${6 * k}" fill="#fff" opacity=".55" transform="rotate(-30 ${x - 13 * k} ${y})"/><circle cx="${x + 14 * k}" cy="${y + 34 * k}" r="${2.4 * k}" fill="#fff" opacity=".5"/>`; }).join('');
  const aura = s.r === 'U' ? `<radialGradient id="${g}a"><stop offset=".45" stop-color="#fff6b0" stop-opacity=".95"/><stop offset=".75" stop-color="${c2}" stop-opacity=".45"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>` : '';
  const sparkle = ['L', 'M', 'U'].includes(s.r) || opts.shiny ? `<path class="spk" d="M84 16 L86 22 L92 24 L86 26 L84 32 L82 26 L76 24 L82 22Z" fill="#fff6c2"/><path class="spk s2" d="M14 30 L15.5 34 L19.5 35.5 L15.5 37 L14 41 L12.5 37 L8.5 35.5 L12.5 34Z" fill="#fff6c2"/>` : '';
  const glow = s.fx === 'glow' ? ` style="filter:drop-shadow(0 0 7px ${c1}) drop-shadow(0 0 2px #fff)"` : '';
  return `<svg class="sq-svg niddo${s.fx === 'mood' ? ' mood' : ''}${opts.cls ? ' ' + opts.cls : ''}${opts.shiny ? ' is-shiny' : ''}" viewBox="0 0 100 100" role="img" aria-label="${esc(s.name)}"${glow}><defs>${aura}${fill}<clipPath id="${g}c">${shape}</clipPath></defs>
    ${aura ? `<circle class="aura" cx="50" cy="56" r="50" fill="url(#${g}a)"/>` : ''}<ellipse cx="50" cy="96" rx="30" ry="3.2" fill="#000" opacity=".1"/>${fuzz}
    <g fill="url(#${g})">${shape}</g>${teenieFill}<g clip-path="url(#${g}c)">${tex}</g>
    <g fill="none" stroke="${edge}" stroke-width="1.4" opacity=".3">${shape}</g>${shines}${faces}${sparkle}</svg>`;
}

/* =========================================================
   Boxes, pools, seasons
   ========================================================= */
Object.assign(BOXES, {
  niddo: { name: 'Niddo Capsule', emoji: '🫧', cost: 30, odds: { C: 58, R: 28, E: 10, L: 3.5, M: 0.5 }, pity: 5, pityTier: 'R', shiny: 0.02 },
  spooky: { name: 'Spooky Box', emoji: '🎃', cost: 40, odds: { C: 55, R: 30, E: 11, L: 3.6, M: 0.4 }, pity: 6, pityTier: 'E', season: 'spooky', shiny: 0.03 },
  winter: { name: 'Snow Globe Box', emoji: '❄️', cost: 40, odds: { C: 55, R: 30, E: 11, L: 3.5, M: 0.5 }, pity: 6, pityTier: 'E', season: 'winter', shiny: 0.03 },
});
BOXES.free.shiny = 0.01; BOXES.deluxe.shiny = 0.05;
const isRegular = (s) => s.kind === 'squishy' && !s.season && s.r !== 'U';
boxPool = function (box) {
  const b = BOXES[box] || {};
  if (b.season) return SQUISHIES.filter((s) => s.season === b.season && s.r !== 'U');
  if (box === 'niddo') return SQUISHIES.filter((s) => s.kind === 'niddo' && s.r !== 'U');
  return SQUISHIES.filter((s) => s.kind === 'squishy' && s.r !== 'U' && (!s.season || inSeason(s.season)));
};
shopPool = function () { return SQUISHIES.filter((s) => s.r !== 'U' && (!s.season || inSeason(s.season))); };
sqBoxes = function (me) {
  const freeUsed = state.squish.free[me] === today();
  const odds = (b) => TIERS.filter((t) => b.odds[t]).map((t) => `<span class="rar rar-${t}">${RARITY[t].name} ${b.odds[t]}%</span>`).join('');
  const live = Object.entries(BOXES).filter(([, b]) => !b.season || inSeason(b.season));
  const season = Object.entries(SEASONS).find(([k]) => inSeason(k));
  const until = season ? (() => { const y = Number(today().slice(0, 4)) + (season[1].to < season[1].from && today().slice(5) >= season[1].from ? 1 : 0); return fmtDate(`${y}-${season[1].to}`, { month: 'short', day: 'numeric' }); })() : '';
  return `${season ? `<div class="season-banner s-${season[0]}"><span>${season[1].emoji}</span><div><b>${season[1].name} season is here!</b><small>Limited-time squishies until ${until}</small></div></div>` : ''}
    ${live.map(([k, b]) => `<div class="card box-card box-${k}">
      <div class="box-emoji">${b.emoji}</div>
      <div class="grow"><b>${b.name}</b>${b.season ? ' <span class="pill accent">Limited</span>' : ''}<div class="small muted">${k === 'free' ? (freeUsed ? 'Opened today — back tomorrow!' : 'One free box every day') : `${b.cost} ${GEM}`}${b.pity ? ` · ${RARITY[b.pityTier].name}+ within ${b.pity} (${b.pity - pityOf(me, k)} to go)` : ''} · ✨ ${Math.round((b.shiny || 0.02) * 100)}% shiny</div>
        <details class="odds"><summary>See the odds</summary><div class="odds-list">${odds(b)}</div></details></div>
      <button class="btn${k === 'free' && freeUsed ? ' secondary' : ''}" data-action="sq-open" data-box="${k}" ${k === 'free' && freeUsed ? 'disabled' : ''}>${k === 'free' ? 'Open' : `${GEM} ${b.cost}`}</button>
    </div>`).join('')}
    <p class="small muted" style="margin:6px 4px">Boxes are a surprise! Want a certain one? The 🛍️ Shop changes every day. 👑 Ultimates can’t be bought — earn them in Unlocks.</p>`;
};

/* =========================================================
   👑 Ultimates: earned by doing real things
   ========================================================= */
const ownedSids = (id) => new Set(myItems(id).map((i) => i.sid));
const countOwned = (id, filter) => { const own = ownedSids(id); return SQUISHIES.filter(filter).filter((s) => own.has(s.id)).length; };
const ULTS = {
  chores50: { how: 'Do 50 chores', icon: '🧹', prog: (id) => sum(state.chores, (c) => (c.log || []).filter((l) => l.memberId === id).length), goal: 50 },
  chores150: { how: 'Do 150 chores', icon: '🏆', prog: (id) => sum(state.chores, (c) => (c.log || []).filter((l) => l.memberId === id).length), goal: 150 },
  streak14: { how: 'Do chores 14 days in a row', icon: '🔥', prog: (id) => (typeof choreStreak === 'function' ? choreStreak(id) : 0), goal: 14 },
  routines20: { how: 'Finish 20 routines on time', icon: '🌅', prog: (id) => sum(state.routines.filter((r) => r.memberId === id), (r) => Object.values(r.stars || {}).filter(Boolean).length), goal: 20 },
  word7: { how: 'Solve the Family Word 7 days in a row', icon: '🔤', prog: (id) => (typeof wordStreak === 'function' ? wordStreak(id) : 0), goal: 7 },
  kudos10: { how: 'Send 10 high-fives', icon: '🙌', prog: (id) => (state.kudos || []).filter((k) => k.from === id).length, goal: 10 },
  trade1: { how: 'Make your first trade', icon: '🔁', prog: (id) => state.squish.trades.filter((t) => t.status === 'done' && (t.from === id || t.to === id)).length + myItems(id).filter((i) => i.from === 'friend').length, goal: 1 },
  todos25: { how: 'Finish 25 family to-dos', icon: '✅', prog: (id) => (state.todos || []).filter((t) => t.done && t.doneBy === id).length, goal: 25 },
  squish1000: { how: 'Squish or squeeze 1,000 times', icon: '🤏', prog: (id) => sum(myItems(id), (i) => i.sq || 0), goal: 1000 },
  shiny5: { how: 'Find 5 shinies', icon: '✨', prog: (id) => myItems(id).filter((i) => i.shiny).length, goal: 5 },
  unique50: { how: 'Collect 50 different squishies & Niddos', icon: '📖', prog: (id) => countOwned(id, (s) => s.r !== 'U'), goal: 50 },
  allRegular: { how: 'Collect every regular squishy', icon: '🧸', prog: (id) => countOwned(id, isRegular), goal: SQUISHIES.filter(isRegular).length },
  allNiddo: { how: 'Collect every Niddo', icon: '🫧', prog: (id) => countOwned(id, (s) => s.kind === 'niddo' && s.r !== 'U'), goal: SQUISHIES.filter((s) => s.kind === 'niddo' && s.r !== 'U').length },
  spookySet: { how: 'Complete the 🎃 Spooky set', icon: '🎃', prog: (id) => countOwned(id, (s) => s.season === 'spooky' && s.r !== 'U'), goal: SQUISHIES.filter((s) => s.season === 'spooky' && s.r !== 'U').length },
  winterSet: { how: 'Complete the ❄️ Winter set', icon: '❄️', prog: (id) => countOwned(id, (s) => s.season === 'winter' && s.r !== 'U'), goal: SQUISHIES.filter((s) => s.season === 'winter' && s.r !== 'U').length },
};
function ultimateInfo(s, id = actor()) {
  const u = ULTS[s.unlock];
  if (!u) return null;
  const cur = id ? Math.min(u.goal, u.prog(id)) : 0;
  return { ...u, cur, pct: cur / u.goal };
}
function checkUltimates(id) {
  if (!id || ui.ultBusy) return;
  for (const s of SQUISHIES.filter((x) => x.r === 'U' && x.unlock)) {
    if (ownsSid(id, s.id)) continue;
    const u = ULTS[s.unlock];
    if (u.prog(id) < u.goal) continue;
    const { item } = giveSquishy(id, s.id, 'unlock');
    state.activity = [{ id: uid(), at: Date.now(), who: id, icon: '👑', text: `unlocked the Ultimate ${s.name}!`, to: 'squishies' }, ...(state.activity || [])].slice(0, 200);
    save();
    if (id === actor() && $('#sheet').hidden && !$('.box-reveal')) {
      ui.ultBusy = true;
      setTimeout(() => { boxReveal({ emoji: '👑', noAgain: true }, item, true); setTimeout(() => { $('.box-reveal .br-stage')?.click(); ui.ultBusy = false; }, 400); }, 500);
    }
    return;
  }
}
function sqUnlocks(me) {
  const ults = SQUISHIES.filter((s) => s.r === 'U');
  const got = ults.filter((s) => ownsSid(me, s.id)).length;
  return `<div class="card ult-hero"><div class="ult-crown">👑</div><b>Ultimates</b><div class="small">You can’t buy these — you earn them! ${got}/${ults.length} unlocked</div></div>
    <div class="ult-list">${ults.map((s) => {
      const info = ultimateInfo(s, me), own = ownsSid(me, s.id);
      const seasonal = s.unlock === 'spookySet' ? 'spooky' : s.unlock === 'winterSet' ? 'winter' : '';
      return `<button class="card ult-card${own ? ' got' : ''}" data-action="go" data-to="squishy/${s.id}">
        <div class="ult-art">${squishySVG(s.id, { cls: own ? '' : 'locked' })}${own ? '' : '<span class="ult-lock">🔒</span>'}</div>
        <div class="grow"><b>${esc(s.name)}</b><div class="small">${info.icon} ${esc(info.how)}${seasonal && !inSeason(seasonal) ? ` <span class="muted">(${SEASONS[seasonal].emoji} in ${SEASONS[seasonal].back})</span>` : ''}</div>
          ${own ? '<div class="ult-done">✓ Unlocked!</div>' : `<div class="ult-bar"><i style="width:${Math.round(info.pct * 100)}%"></i></div><div class="small muted">${info.cur.toLocaleString()} / ${info.goal.toLocaleString()}</div>`}</div>
      </button>`;
    }).join('')}</div>`;
}

/* =========================================================
   Collection book with seasons, Niddos, Ultimates, shinies
   ========================================================= */
sqBook = function (me) {
  const shinySids = new Set(myItems(me).filter((i) => i.shiny).map((i) => i.sid));
  const order = ['critters', 'treats', 'dream', 'ocean', 'snack', 'farm', 'niddo', 'spooky', 'winter', 'ult'];
  return order.filter((k) => SETS[k]).map((k) => {
    const [e, name] = SETS[k];
    const all = SQUISHIES.filter((s) => s.set === k), got = all.filter((s) => ownsSid(me, s.id)).length;
    const season = SEASONS[k];
    const note = k === 'ult' ? `${got}/${all.length} · earn them in 👑 Unlocks` : `${got}/${all.length}${got === all.length ? ' 🏆' : ' · +100 💎 when complete'}${season ? (inSeason(k) ? ' · <b>available now!</b>' : ` · back in ${season.back}`) : ''}`;
    return `<div class="section-title">${e} ${name}<span class="small" style="text-transform:none">${note}</span></div>
      <div class="sq-grid book">${all.map((s) => ownsSid(me, s.id) ? sqTile(s.id, shinySids.has(s.id) ? '' : '', '', { shiny: shinySids.has(s.id) }) : `<button class="sq-tile missing r-${s.r}" data-action="go" data-to="squishy/${s.id}">${squishySVG(s.id, { cls: 'shadow' })}<span class="sq-name">${s.r === 'U' ? '🔒 ' + esc(s.name) : '???'}</span></button>`).join('')}</div>`;
  }).join('') + `<p class="small muted" style="margin:10px 4px">✨ Shinies glow in your book. Every box has a small chance to be shiny!</p>`;
};

/* =========================================================
   Niddo press-and-hold squeeze
   ========================================================= */
let ndHold = null;
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-nd]');
  if (!b) return;
  e.preventDefault();
  b.classList.remove('bounce');
  b.classList.add('squeezing');
  sqSound('goo');
  if (navigator.vibrate) navigator.vibrate(20);
  ndHold = { b, sid: b.dataset.nd, t: Date.now() };
});
function ndRelease() {
  if (!ndHold) return;
  const { b, sid, t } = ndHold;
  ndHold = null;
  b.classList.remove('squeezing');
  void b.offsetWidth;
  b.classList.add('bounce');
  sqSound('squish');
  const me = actor(), mine = me ? myItems(me).filter((i) => i.sid === sid) : [];
  if (!mine.length) return;
  const add = Date.now() - t > 1500 ? 2 : 1;
  mine[0].sq = (mine[0].sq || 0) + add;
  const n = $('.sq-n'); if (n) n.textContent = sum(mine, (i) => i.sq || 0);
  if (typeof squishReward === 'function') squishReward(me, add);
  clearTimeout(squishSaveT); squishSaveT = setTimeout(save, 800);
}
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, ndRelease);
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-nd]')) e.preventDefault(); });

/* =========================================================
   Hooks
   ========================================================= */
const _afterRenderC = afterRender;
afterRender = function () { _afterRenderC(); const id = actor(); if (id) checkUltimates(id); };
