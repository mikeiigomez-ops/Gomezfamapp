/* Dream House 🏡: everyone gets a dollhouse. Decorate rooms by dragging furniture, pets and squishies around,
   buy wallpapers, floors and new rooms with Gems, switch on night mode, then visit each other in Gomez Town —
   leave ❤️ and sticky notes and vote for 👑 House of the Week. Friend families' houses appear on Friends Lane.
   Loaded after friends.js. */
'use strict';

Object.assign(TITLES, { house: 'Dream House', room: 'Room', town: 'Gomez Town', fhouse: 'Friend’s House' });

/* =========================================================
   Catalog
   ========================================================= */
const H_CATS = [['furniture', '🛋️', 'Furniture'], ['decor', '🪴', 'Decor'], ['fun', '🎮', 'Fun'], ['pets', '🐶', 'Pets'], ['outdoor', '🌳', 'Outdoor'], ['food', '🧁', 'Treats'], ['earned', '🏆', 'Earned'], ['squish', '🧸', 'Squishies'], ['walls', '🎨', 'Walls'], ['floors', '🟫', 'Floors']];
// id: [emoji, name, category, price, size (in % of room width), place, extra]
const FURN_LIST = [
  ['bed', '🛏️', 'Bed', 'furniture', 40, 26], ['sofa', '🛋️', 'Sofa', 'furniture', 50, 26], ['chair', '🪑', 'Chair', 'furniture', 15, 13], ['cabinet', '🗄️', 'Cabinet', 'furniture', 25, 15],
  ['door', '🚪', 'Door', 'furniture', 30, 24], ['tub', '🛁', 'Bathtub', 'furniture', 60, 22], ['shower', '🚿', 'Shower', 'furniture', 35, 14, 'wall'], ['toilet', '🚽', 'Toilet', 'furniture', 25, 13],
  ['window', '', 'Window', 'furniture', 25, 22, 'wall', { svg: 'window' }], ['rug', '', 'Rug', 'furniture', 20, 34, 'floor', { svg: 'rug', layer: 0 }], ['shelf', '', 'Shelf', 'furniture', 15, 24, 'wall', { svg: 'shelf' }],
  ['mirror', '🪞', 'Mirror', 'furniture', 20, 13, 'wall'],
  ['painting', '🖼️', 'Painting', 'decor', 20, 14, 'wall'], ['clock', '🕰️', 'Clock', 'decor', 15, 10], ['plant', '🪴', 'Plant', 'decor', 10, 12], ['cactus', '🌵', 'Cactus', 'decor', 10, 11],
  ['tulips', '🌷', 'Tulips', 'decor', 8, 9], ['sunflower', '🌻', 'Sunflower', 'decor', 10, 10], ['bouquet', '💐', 'Bouquet', 'decor', 15, 10], ['candle', '🕯️', 'Candle', 'decor', 8, 8, 'any', { glow: 1 }],
  ['lantern', '🏮', 'Lantern', 'decor', 18, 10, 'any', { glow: 1 }], ['bulb', '💡', 'Ceiling light', 'decor', 12, 9, 'wall', { glow: 1 }], ['disco', '🪩', 'Disco ball', 'decor', 60, 13, 'wall', { glow: 1 }],
  ['balloons', '🎈', 'Balloons', 'decor', 10, 14], ['bow', '🎀', 'Bow', 'decor', 8, 9, 'wall'], ['star', '⭐', 'Star', 'decor', 10, 9, 'wall', { glow: 1 }], ['moon', '🌙', 'Moon', 'decor', 15, 10, 'wall', { glow: 1 }],
  ['planet', '🪐', 'Planet', 'decor', 30, 12, 'wall'], ['heart', '💖', 'Heart', 'decor', 8, 9, 'wall'], ['teddy', '🧸', 'Teddy', 'decor', 15, 11], ['doll', '🪆', 'Doll', 'decor', 20, 10],
  ['books', '📚', 'Books', 'decor', 12, 10], ['basket', '🧺', 'Basket', 'decor', 10, 10], ['vase', '🏺', 'Vase', 'decor', 15, 11], ['rainbow', '🌈', 'Rainbow', 'decor', 40, 26, 'wall'],
  ['tv', '📺', 'TV', 'fun', 60, 16], ['console', '🎮', 'Game console', 'fun', 50, 9], ['computer', '🖥️', 'Computer', 'fun', 70, 14], ['piano', '🎹', 'Piano', 'fun', 90, 20],
  ['guitar', '🎸', 'Guitar', 'fun', 45, 15], ['drums', '🥁', 'Drums', 'fun', 60, 14], ['mic', '🎤', 'Microphone', 'fun', 30, 11], ['art', '🎨', 'Art set', 'fun', 25, 12],
  ['telescope', '🔭', 'Telescope', 'fun', 55, 15], ['puzzle', '🧩', 'Puzzle', 'fun', 10, 8], ['kite', '🪁', 'Kite', 'fun', 15, 14, 'wall'], ['circus', '🎪', 'Play tent', 'fun', 80, 30],
  ['soccer', '⚽', 'Soccer ball', 'fun', 10, 8], ['hoop', '🏀', 'Basketball', 'fun', 25, 9], ['skate', '🛹', 'Skateboard', 'fun', 20, 11], ['bike', '🚲', 'Bike', 'fun', 40, 18], ['robot', '🤖', 'Robot', 'fun', 45, 13], ['dice', '🎲', 'Dice', 'fun', 8, 7],
  ['puppy', '🐕', 'Puppy', 'pets', 80, 15, 'floor', { pet: 1 }], ['kitten', '🐈', 'Kitten', 'pets', 80, 14, 'floor', { pet: 1 }], ['bunnypet', '🐇', 'Bunny', 'pets', 70, 13, 'floor', { pet: 1 }],
  ['hamster', '🐹', 'Hamster', 'pets', 50, 9, 'floor', { pet: 1 }], ['fish', '🐠', 'Fish', 'pets', 40, 10, 'any', { pet: 1 }], ['parrot', '🦜', 'Parrot', 'pets', 70, 12, 'any', { pet: 1 }],
  ['turtle', '🐢', 'Turtle', 'pets', 60, 11, 'floor', { pet: 1 }], ['hedgehog', '🦔', 'Hedgehog', 'pets', 70, 11, 'floor', { pet: 1 }], ['penguinpet', '🐧', 'Penguin', 'pets', 90, 13, 'floor', { pet: 1 }],
  ['foxpet', '🦊', 'Fox', 'pets', 90, 13, 'floor', { pet: 1 }], ['unicornpet', '🦄', 'Unicorn', 'pets', 300, 18, 'floor', { pet: 1 }], ['dragonpet', '🐉', 'Dragon', 'pets', 450, 22, 'floor', { pet: 1 }],
  ['tree', '🌳', 'Tree', 'outdoor', 30, 34], ['pine', '🌲', 'Pine tree', 'outdoor', 30, 34], ['palm', '🌴', 'Palm tree', 'outdoor', 40, 36], ['flowers', '🌼', 'Flowers', 'outdoor', 8, 9],
  ['shroom', '🍄', 'Mushroom', 'outdoor', 10, 10], ['rock', '🪨', 'Rock', 'outdoor', 5, 12], ['campfire', '🔥', 'Campfire', 'outdoor', 25, 12, 'floor', { glow: 1 }], ['tent', '⛺', 'Tent', 'outdoor', 50, 30],
  ['slide', '🛝', 'Slide', 'outdoor', 80, 30], ['carousel', '🎠', 'Carousel', 'outdoor', 150, 30], ['fountain', '⛲', 'Fountain', 'outdoor', 120, 30], ['flamingo', '🦩', 'Flamingo', 'outdoor', 20, 18],
  ['snowman', '⛄', 'Snowman', 'outdoor', 30, 20], ['sun', '☀️', 'Sun', 'outdoor', 15, 14, 'wall', { glow: 1 }], ['cloud', '☁️', 'Cloud', 'outdoor', 12, 14, 'wall'],
  ['cake', '🎂', 'Cake', 'food', 12, 11], ['cupcake', '🧁', 'Cupcake', 'food', 8, 8], ['donut', '🍩', 'Donut', 'food', 6, 7], ['popcorn', '🍿', 'Popcorn', 'food', 6, 8],
  ['pizza', '🍕', 'Pizza', 'food', 10, 8], ['icecream', '🍦', 'Ice cream', 'food', 8, 9], ['lolly', '🍭', 'Lollipop', 'food', 6, 9], ['teapot', '🫖', 'Teapot', 'food', 12, 9],
  ['trophy', '🏆', 'Gold Trophy', 'earned', 0, 13, 'any', { unlock: 'chores50' }], ['medal', '🏅', 'Routine Medal', 'earned', 0, 10, 'wall', { unlock: 'routines20' }],
  ['crownd', '👑', 'Royal Crown', 'earned', 0, 11, 'any', { unlock: 'todos25' }], ['gemstone', '💎', 'Giant Gem', 'earned', 0, 12, 'any', { unlock: 'unique50', glow: 1 }],
  ['glowstar', '🌟', 'Streak Star', 'earned', 0, 12, 'wall', { unlock: 'streak14', glow: 1 }], ['heartbox', '💝', 'Kindness Gift', 'earned', 0, 11, 'any', { unlock: 'kudos10' }],
];
const FURN = Object.fromEntries(FURN_LIST.map(([id, e, name, cat, price, z, place = 'floor', extra = {}]) => [id, { id, e, name, cat, price, z, place, ...extra }]));
const WALLS = {
  cream: ['Cream', 0, '#fbf3e4'], blush: ['Blush', 0, '#ffe3ec'], mint: ['Mint', 0, '#e6fcf5'], sky: ['Sky', 0, '#e7f5ff'],
  stripes: ['Candy stripes', 30, 'repeating-linear-gradient(90deg,#ffd6e5 0 5cqw,#fff0f6 5cqw 10cqw)'],
  dots: ['Polka dots', 30, 'radial-gradient(circle,#ffb3cf 0 .9cqw,transparent 1cqw) 0 0/6cqw 6cqw,#fff0f6'],
  lilac: ['Lilac checks', 30, 'conic-gradient(#efe6ff 25%,#e1d4ff 0 50%,#efe6ff 0 75%,#e1d4ff 0) 0 0/8cqw 8cqw'],
  wood: ['Wood panels', 40, 'repeating-linear-gradient(90deg,#d9b38c 0 9cqw,#c99f76 9cqw 9.5cqw)'],
  tiles: ['Bath tiles', 30, 'linear-gradient(#fff .35cqw,transparent .35cqw) 0 0/7cqw 7cqw,linear-gradient(90deg,#fff .35cqw,transparent .35cqw) 0 0/7cqw 7cqw,#a5d8ff'],
  clouds: ['Clouds', 40, 'radial-gradient(ellipse 9cqw 4cqw at 20% 30%,#fff 60%,transparent 62%),radial-gradient(ellipse 12cqw 5cqw at 70% 22%,#fff 60%,transparent 62%),radial-gradient(ellipse 8cqw 3.5cqw at 50% 60%,#fff 60%,transparent 62%),linear-gradient(#8ec5ff,#d0ebff)'],
  stars: ['Starry night', 45, 'radial-gradient(circle,#fff 0 .35cqw,transparent .45cqw) 0 0/7cqw 7cqw,radial-gradient(circle,#ffe066 0 .5cqw,transparent .6cqw) 3.5cqw 3.5cqw/7cqw 7cqw,#2b2560'],
  rainbowp: ['Rainbow', 80, 'linear-gradient(#ffd6d6,#ffe8cc,#fff3bf,#d3f9d8,#d0ebff,#e5dbff)'],
  galaxy: ['Galaxy', 100, 'radial-gradient(circle,#fff 0 .3cqw,transparent .4cqw) 0 0/5cqw 5cqw,radial-gradient(circle at 30% 30%,#7048e8,transparent 60%),radial-gradient(circle at 80% 70%,#e64980,transparent 55%),#1a1240'],
  hearts: ['Sweethearts', 45, 'radial-gradient(circle at 35% 40%,#ff8fab 0 .9cqw,transparent 1cqw) 0 0/7cqw 7cqw,radial-gradient(circle at 65% 40%,#ff8fab 0 .9cqw,transparent 1cqw) 0 0/7cqw 7cqw,#fff0f6'],
};
const FLOORS = {
  wood: ['Wood', 0, 'repeating-linear-gradient(90deg,#c8956a 0 11cqw,#b98558 11cqw 11.4cqw),#c8956a'],
  light: ['Light wood', 0, 'repeating-linear-gradient(90deg,#ead2b4 0 11cqw,#dcbf9c 11cqw 11.4cqw),#ead2b4'],
  pinkc: ['Pink carpet', 25, 'radial-gradient(circle,#ffb3cf 0 .3cqw,transparent .4cqw) 0 0/2cqw 2cqw,#ffc9de'],
  bluec: ['Blue carpet', 25, 'radial-gradient(circle,#91c9f7 0 .3cqw,transparent .4cqw) 0 0/2cqw 2cqw,#a5d8ff'],
  checker: ['Checkerboard', 35, 'conic-gradient(#fff 25%,#495057 0 50%,#fff 0 75%,#495057 0) 0 0/9cqw 9cqw'],
  tile: ['White tiles', 30, 'linear-gradient(#dee2e6 .3cqw,transparent .3cqw) 0 0/9cqw 9cqw,linear-gradient(90deg,#dee2e6 .3cqw,transparent .3cqw) 0 0/9cqw 9cqw,#f8f9fa'],
  grass: ['Grass', 30, 'radial-gradient(circle,#40c057 0 .5cqw,transparent .6cqw) 0 0/4cqw 3cqw,linear-gradient(#8ce99a,#51cf66)'],
  sand: ['Beach sand', 30, 'radial-gradient(circle,#f2c94c 0 .3cqw,transparent .4cqw) 0 0/3cqw 3cqw,#ffe8a1'],
  marble: ['Marble', 60, 'linear-gradient(135deg,transparent 46%,#dee2e6 48%,transparent 50%) 0 0/16cqw 16cqw,linear-gradient(135deg,#f8f9fa,#e9ecef)'],
  rainbowc: ['Rainbow carpet', 80, 'linear-gradient(90deg,#ffc9c9,#ffe8cc,#fff3bf,#d3f9d8,#d0ebff,#e5dbff)'],
  cloudf: ['Cloud floor', 90, 'radial-gradient(ellipse 10cqw 3cqw at 30% 50%,#fff 60%,transparent 62%) 0 0/30cqw 12cqw,#d0ebff'],
};
const ROOM_TYPES = {
  bedroom: ['🛏️', 'Bedroom', 0, 'blush', 'wood'], living: ['🛋️', 'Living room', 100, 'cream', 'light'], kitchen: ['🍳', 'Kitchen', 100, 'mint', 'checker'],
  bath: ['🛁', 'Bathroom', 100, 'tiles', 'tile'], game: ['🎮', 'Game room', 150, 'stars', 'bluec'], yard: ['🌳', 'Backyard', 150, 'clouds', 'grass'],
  studio: ['🎨', 'Art studio', 150, 'lilac', 'light'], hideout: ['🌌', 'Secret hideout', 250, 'galaxy', 'pinkc'],
};
const MAX_ROOMS = 6;
const ROOFS = ['#e8590c', '#e64980', '#7048e8', '#1c7ed6', '#2b8a3e', '#f59f00', '#495057', '#c2255c'];
const SIDINGS = ['#fff4e6', '#fff0f6', '#f3f0ff', '#e7f5ff', '#ebfbee', '#fff9db', '#f1f3f5', '#ffe3e3'];
const NOTE_PRESETS = ['Love your room! 😍', 'So cozy! 🛋️', 'Cool pets! 🐶', 'Best house ever! 👑', 'Can I visit again? 🏠', 'Your colors are so pretty! 🌈'];

/* =========================================================
   Houses: data helpers
   ========================================================= */
const houseOf = (mid) => state.houses[mid] || null;
function ensureHouse(mid) {
  if (state.houses[mid]) return state.houses[mid];
  const m = member(mid), roomId = uid();
  const h = {
    name: `${m.name}’s House`, roof: ROOFS[state.members.findIndex((x) => x.id === mid) % ROOFS.length], siding: SIDINGS[state.members.findIndex((x) => x.id === mid) % SIDINGS.length],
    rooms: [{ id: roomId, type: 'bedroom', name: 'Bedroom', wall: 'blush', floor: 'wood', night: false, items: [
      { id: uid(), f: 'window', x: 30, y: 46 }, { id: uid(), f: 'rug', x: 50, y: 84 }, { id: uid(), f: 'bed', x: 66, y: 86 },
      { id: uid(), f: 'plant', x: 14, y: 90 }, { id: uid(), f: 'lantern', x: 88, y: 80 },
    ] }],
    inv: {}, walls: {}, floors: {}, likes: {}, notes: [], at: Date.now(),
  };
  state.houses[mid] = h;
  return h;
}
const findRoom = (roomId) => { for (const [mid, h] of Object.entries(state.houses)) { const r = h.rooms.find((x) => x.id === roomId); if (r) return { mid, h, r }; } return null; };
const canEdit = (mid) => mid && mid === actor();
const isUnlocked = (f, mid) => !f.unlock || (typeof ULTS !== 'undefined' && ULTS[f.unlock] && ULTS[f.unlock].prog(mid) >= ULTS[f.unlock].goal);
const placedCount = (h, fid) => sum(h.rooms, (r) => r.items.filter((i) => i.f === fid).length);
const owned = (h, fid) => (h.inv[fid] || 0) + placedCount(h, fid);

/* =========================================================
   Rendering rooms (container-query units: the same markup scales from thumbnail to full screen)
   ========================================================= */
const FURN_SVG = {
  window: () => `<svg viewBox="0 0 100 100" class="h-svg"><rect x="8" y="6" width="84" height="84" rx="8" fill="#fff"/><g class="day"><rect x="14" y="12" width="72" height="72" rx="4" fill="#a5d8ff"/><circle cx="68" cy="30" r="9" fill="#ffd43b"/><ellipse cx="34" cy="60" rx="14" ry="6" fill="#fff"/></g><g class="night-sky"><rect x="14" y="12" width="72" height="72" rx="4" fill="#1a1a4e"/><path d="M66 22 a12 12 0 1 0 10 18 a10 10 0 1 1 -10 -18Z" fill="#ffe066"/><circle cx="30" cy="30" r="1.6" fill="#fff"/><circle cx="44" cy="58" r="1.2" fill="#fff"/><circle cx="24" cy="70" r="1.4" fill="#fff"/></g><path d="M50 12 V84 M14 48 H86" stroke="#fff" stroke-width="4"/><path d="M6 4 Q20 50 12 94 L2 94 L2 4Z M94 4 Q80 50 88 94 L98 94 L98 4Z" fill="#ff8fab"/><rect x="0" y="0" width="100" height="7" rx="3" fill="#c2255c"/></svg>`,
  rug: () => `<svg viewBox="0 0 100 40" class="h-svg"><ellipse cx="50" cy="20" rx="49" ry="19" fill="#ff8fab"/><ellipse cx="50" cy="20" rx="40" ry="14" fill="#ffd6e5"/><ellipse cx="50" cy="20" rx="28" ry="9" fill="#ff8fab"/><ellipse cx="50" cy="20" rx="16" ry="5" fill="#fff0f6"/></svg>`,
  shelf: () => `<svg viewBox="0 0 100 30" class="h-svg"><rect x="2" y="18" width="96" height="7" rx="3" fill="#b98558"/><path d="M14 25 L18 30 M86 25 L82 30" stroke="#8a5a34" stroke-width="4"/><rect x="12" y="4" width="6" height="14" fill="#4dabf7"/><rect x="19" y="2" width="6" height="16" fill="#ff6b6b"/><rect x="26" y="6" width="5" height="12" fill="#ffd43b"/><circle cx="72" cy="11" r="7" fill="#69db7c"/></svg>`,
};
// Clay drawings (art-house.js) replace the emoji when they exist: furn_<id> (+ _night when lit), hcat_<cat>, room_<type>.
// Wide flat pieces (rug, shelf) are cropped so they keep the long, low box their old SVGs had.
const FURN_CROP = { rug: '0 36 128 56', shelf: '0 26 128 70' };
function furnArt(id, night) {
  if (typeof artSVG !== 'function') return '';
  const k = 'furn_' + id, lit = night && ART[k + '_night'], s = lit ? artSVG(k + '_night', { shadow: false }) : artSVG(k);
  return s && FURN_CROP[id] ? s.replace('class="art-svg"', 'class="art-svg art-wide"').replace('viewBox="0 0 128 128"', `viewBox="${FURN_CROP[id]}"`) : s;
}
const artOr = (id, e) => (typeof artSVG === 'function' && artSVG(id)) || e;
const roomIcon = (type) => artOr('room_' + type, ROOM_TYPES[type]?.[0] || '🏠');
const safeCol = (c, d) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : d);
function itemHTML(it, room, opts = {}) {
  let f = FURN[it.f], content, z, layer, cls = '';
  if (it.f === 'sq') {
    if (!SQ[it.sid]) return '';
    content = squishySVG(it.sid); z = 12 * (SQ[it.sid].kind === 'niddo' ? 0.85 : 1); layer = 2; cls = ' sqd';
  } else {
    if (!f) return '';
    const art = furnArt(f.id, opts.night ?? room?.night);
    content = art || (f.svg ? FURN_SVG[f.svg]() : esc(f.e));
    z = f.z; layer = f.layer ?? (f.place === 'wall' ? 1 : 2);
    if (f.svg) cls += ' svgi'; else if (art) cls += ' arti';
    if (f.pet) cls += ' pet';
    if (f.glow) cls += ' glowy';
    if (f.layer === 0) cls += ' flat';
  }
  const zi = layer * 1000 + Math.round(it.y * 5) + (it.zb ? 500 : 0);
  const wander = f?.pet ? `;--wd:${7 + (hashStr(it.id) % 6)}s;--wdl:-${(hashStr(it.id) % 5) / 2}s` : '';
  return `<div class="hi${cls}${opts.sel === it.id ? ' sel' : ''}${opts.newId === it.id ? ' dropin' : ''}" data-hi="${it.id}" style="left:${Number(it.x) || 0}%;top:${Number(it.y) || 0}%;--z:${z};--s:${Number(it.s) || 1};--fx:${it.flip ? -1 : 1};z-index:${zi}${wander}"><span class="hii">${content}</span></div>`;
}
function roomHTML(r, opts = {}) {
  const wall = WALLS[opts.wall || r.wall] || WALLS.cream, floor = FLOORS[opts.floor || r.floor] || FLOORS.wood;
  const night = opts.night ?? r.night;
  const avs = (opts.avatars || []).map((v) => `<div class="hav${v.me ? ' me' : ''}" data-av="${v.key}" style="left:${v.x}%;top:${v.y}%;z-index:${2000 + Math.round(v.y * 5)}"><div class="hav-in">${avatarSVG(v.a)}</div>${opts.mini ? '' : `<span class="hav-name">${esc(v.name)}</span>`}</div>`).join('');
  return `<div class="room${night ? ' night' : ''}${opts.edit ? ' editing' : ''}${opts.mini ? ' mini' : ''}" ${opts.attrs || ''} data-room="${r.id}">
    <div class="rm-back" style="background:${wall[2]}"></div>
    <div class="rm-side rm-left" style="background:linear-gradient(90deg,rgba(0,0,0,.2),rgba(0,0,0,.06)),${wall[2]}"></div>
    <div class="rm-side rm-right" style="background:linear-gradient(270deg,rgba(0,0,0,.2),rgba(0,0,0,.06)),${wall[2]}"></div>
    <div class="rm-ceil"></div>
    <div class="rm-floor"><div class="rm-floor-in" style="background:${floor[2]}"></div></div>
    <div class="rm-trim"></div><div class="rm-light"></div>
    ${r.items.map((it) => itemHTML(it, r, { ...opts, night })).join('')}${opts.ghost ? itemHTML({ ...opts.ghost, id: 'try' }, r, { ...opts, night, sel: 'try' }).replace('class="hi', 'class="hi ghost') : ''}${avs}
    ${night ? '<div class="room-dark"></div>' : ''}<div class="rm-vignette"></div>
  </div>`;
}
function houseExterior(h, o = {}) {
  const roofD = mixHex(h.roof, '#000000', 0.18), sideD = mixHex(h.siding, '#000000', 0.1), win = o.night ? '#ffe066' : '#bfe3ff';
  return `<svg class="hx" viewBox="0 0 120 112">
    <rect x="80" y="14" width="11" height="24" rx="2" fill="${roofD}"/>${o.smoke ? '<g class="smoke"><circle cx="85" cy="9" r="4" fill="#fff" opacity=".7"/><circle cx="89" cy="2" r="3" fill="#fff" opacity=".5"/></g>' : ''}
    <path d="M4 54 L60 12 L116 54 Z" fill="${safeCol(h.roof, '#e8590c')}"/><path d="M14 48 L106 48 M24 40 L96 40 M35 32 L85 32 M46 24 L74 24" stroke="${roofD}" stroke-width="1.6" opacity=".55"/>
    <circle cx="60" cy="36" r="6" fill="${win}" stroke="#fff" stroke-width="2"/>
    <rect x="16" y="52" width="88" height="54" rx="3" fill="${safeCol(h.siding, '#fff3bf')}"/><path d="M16 64 H104 M16 76 H104 M16 88 H104" stroke="${sideD}" stroke-width="1" opacity=".6"/>
    <rect x="12" y="50" width="96" height="5" rx="2.5" fill="${roofD}"/>
    <rect x="51" y="74" width="18" height="32" rx="9" fill="${roofD}"/><circle cx="65" cy="91" r="1.7" fill="#ffd43b"/>
    ${[22, 80].map((x) => `<rect x="${x}" y="62" width="18" height="16" rx="3" fill="${win}" stroke="#fff" stroke-width="2"/><path d="M${x + 9} 62 V78 M${x} 70 H${x + 18}" stroke="#fff" stroke-width="1.4"/><rect x="${x - 2}" y="78" width="22" height="5" rx="2" fill="#8a5a34"/><circle cx="${x + 3}" cy="77" r="2.4" fill="#ff6b9d"/><circle cx="${x + 9}" cy="76.5" r="2.4" fill="#ffd43b"/><circle cx="${x + 15}" cy="77" r="2.4" fill="#ff8787"/>`).join('')}
    <ellipse cx="14" cy="104" rx="10" ry="7" fill="#51cf66"/><ellipse cx="106" cy="104" rx="10" ry="7" fill="#40c057"/>
    ${o.crown ? '<text x="60" y="11" font-size="15" text-anchor="middle">👑</text>' : ''}</svg>`;
}

/* =========================================================
   Views
   ========================================================= */
function dollhouse(h, mid, visitor, o = {}) {
  const av = o.avatar ? `<div class="dh-avatar" data-action="${o.avatarAction || 'av-wave'}" data-to="${o.avatarTo || ''}">${avatarSVG(o.avatar, { cls: 'idle' })}${o.bubble ? `<span class="av-bubble">${esc(o.bubble)}</span>` : ''}</div>` : '';
  return `<div class="dollhouse" style="--roof:${safeCol(h.roof, '#e8590c')};--siding:${safeCol(h.siding, '#fff3bf')}">
    <div class="dh-chimney"><span class="dh-smoke"></span><span class="dh-smoke s2"></span></div>
    <div class="dh-roof"><span class="dh-sign">${esc(h.name)}</span></div>
    <div class="dh-body">${h.rooms.map((r) => `<button class="dh-room" ${o.roomAction ? o.roomAction(r) : `data-action="go" data-to="room/${r.id}"`}>${roomHTML(r, { mini: true, avatars: o.roomAvatars ? o.roomAvatars(r) : [] })}<span class="dh-label">${roomIcon(r.type)} ${esc(r.name)}</span></button>`).join('')}
      ${!visitor && h.rooms.length < MAX_ROOMS ? `<button class="dh-add" data-action="h-add-room"><span>＋</span>Add a room</button>` : ''}</div>
    <div class="dh-ground"><span class="dh-bush"></span><span class="dh-path"></span><span class="dh-bush r"></span></div>
    ${av}
  </div>`;
}
views.house = (pid) => {
  const me = actor();
  const mid = pid && isMember(pid) ? pid : me;
  if (!mid) return needMe() || '<div class="card empty">Pick who you are first.</div>';
  const own = mid === me;
  const h = own ? ensureHouse(mid) : houseOf(mid);
  if (!h) return `<div class="card empty"><span class="big">🏡</span>${esc(member(mid).name)} hasn’t moved in yet!</div>`;
  if (own && !state.houses[mid].saved) { state.houses[mid].saved = 1; save(); }
  const likes = Object.keys(h.likes || {}).filter(isMember);
  const wk = weekStart(today()), myVote = state.houseVotes[wk]?.[me];
  const notes = [...(h.notes || [])].sort((a, b) => b.at - a.at).slice(0, 8);
  const things = sum(h.rooms, (r) => r.items.length);
  const night = new Date().getHours() >= 19 || new Date().getHours() < 6;
  return `<div class="house-scene${night ? ' night' : ''}">
      <div class="hs-sky"><span class="hs-cloud"></span><span class="hs-cloud c2"></span>${night ? '<span class="hs-moon">🌙</span>' : '<span class="hs-sun"></span>'}</div>
      ${dollhouse(h, mid, !own, { avatar: avatarOf(mid), avatarAction: own ? 'go' : 'av-wave', avatarTo: own ? 'avatar' : '', bubble: own && !state.avatars?.[mid] ? 'Tap me to dress up!' : '', })}
    </div>
    ${own ? `<div class="house-actions"><button data-action="go" data-to="avatar"><span>🧍</span>My avatar</button><button data-action="h-style"><span>🎨</span>House style</button><button data-action="go" data-to="town"><span>🏘️</span>Town</button><button data-action="go" data-to="gems"><span>${GEM}</span>${gemBalance(mid)}</button></div>`
      : `<div class="btn-row"><button class="btn secondary${likes.includes(me) ? ' liked' : ''}" data-action="h-like" data-id="${mid}">${likes.includes(me) ? '💖 Liked' : '🤍 Like'}</button><button class="btn secondary" data-action="h-note" data-id="${mid}">📝 Note</button><button class="btn${myVote === mid ? ' secondary' : ''}" data-action="h-vote" data-id="${mid}">${myVote === mid ? '👑 Voted!' : '👑 Vote'}</button></div>`}
    <div class="house-stats2"><span>🚪 ${h.rooms.length} room${h.rooms.length > 1 ? 's' : ''}</span><span>🪑 ${things} things</span><span>❤️ ${likes.length}</span>${houseOfWeek().winner === mid ? '<span class="how-badge">👑 Top house</span>' : ''}</div>
    ${likes.length ? `<div class="liked-by small muted">Liked by ${likes.map((id) => `${esc(member(id).emoji)} ${esc(member(id).name)}`).join(', ')}</div>` : ''}
    ${notes.length ? `<div class="section-title">Notes on the door</div><div class="notes">${notes.map((n) => `<div class="note" style="--nc:${['#fff3b0', '#ffd6e0', '#d6ecff', '#d9f5dd'][hashStr(n.id) % 4]}"><div class="note-text">${esc(n.text)}</div><div class="note-foot"><span>${esc(whoName(n.from))} · ${timeAgo(n.at)}</span>${own || n.from === me ? `<button class="note-x" data-action="h-note-del" data-h="${mid}" data-id="${n.id}" aria-label="Remove">✕</button>` : ''}</div></div>`).join('')}</div>` : ''}`;
};
views.room = (roomId) => {
  const found = findRoom(roomId);
  if (!found) return '<div class="card empty">This room is gone.<br><button class="btn" style="margin-top:10px" data-action="go" data-to="house">My house</button></div>';
  const { mid, h, r } = found;
  const me = actor(), owner = canEdit(mid);
  const edit = owner && ui.hEdit === r.id;
  const sel = edit ? r.items.find((i) => i.id === ui.hSel) : null;
  const selName = sel ? (sel.f === 'sq' ? SQ[sel.sid]?.name : FURN[sel.f]?.name) : '';
  const night = ui.hPeek?.[r.id] ?? r.night;
  // Live visitors (live.js): the owner walks where they really are, and anyone else in the room shows up too.
  const live = !edit && typeof liveInRoom === 'function' ? liveInRoom(r.id) : {};
  const ownAt = !owner && live[mid] ? live[mid] : r.av;
  const avatars = edit ? [] : [{ key: owner ? 'me' : 'own', me: owner, a: avatarOf(mid), x: ownAt?.x ?? 72, y: ownAt?.y ?? 95, name: member(mid).name }];
  if (!owner && me) { const v = ui.hVis?.[r.id] || { x: 24, y: 97 }; avatars.push({ key: 'me', me: true, a: avatarOf(me), x: v.x, y: v.y, name: member(me).name }); }
  for (const [id, v] of Object.entries(live)) if (id !== mid && id !== me) avatars.push({ key: 'live-' + id, me: false, a: avatarOf(id), x: v.x, y: v.y, name: member(id).name });
  const undoN = (ui.hUndo?.[r.id] || []).length;
  const tr = edit && ui.hTry?.room === r.id ? ui.hTry : null;
  const trySurf = edit && ui.hTrySurf?.room === r.id ? ui.hTrySurf : null;
  const opts = { edit, sel: tr ? 'try' : ui.hSel, night, avatars, newId: ui.hNew, ghost: tr ? { f: tr.f, x: tr.x, y: tr.y } : null, wall: trySurf?.kind === 'walls' ? trySurf.id : null, floor: trySurf?.kind === 'floors' ? trySurf.id : null };
  const tryName = tr ? FURN[tr.f].name : trySurf ? (trySurf.kind === 'walls' ? WALLS : FLOORS)[trySurf.id][0] : '';
  const tryPrice = tr ? FURN[tr.f].price : trySurf ? (trySurf.kind === 'walls' ? WALLS : FLOORS)[trySurf.id][1] : 0;
  const bar = tr || trySurf
    ? `<div class="hsel-bar try"><span class="try-label">Try it: <b>${esc(tryName)}</b></span><button class="try-no" data-action="h-try-cancel" aria-label="No thanks">✕</button><button class="try-yes" data-action="h-try-keep">Keep it · ${GEM} ${tryPrice}</button></div>`
    : `<div class="hsel-bar${sel ? '' : ' empty'}">${sel ? `<b>${esc(selName)}</b><button data-action="h-flip" aria-label="Flip">↔️</button><button data-action="h-size" data-d="-1" aria-label="Smaller">➖</button><button data-action="h-size" data-d="1" aria-label="Bigger">➕</button><button data-action="h-front" aria-label="Bring forward">⬆️</button><button data-action="h-store" aria-label="Put away">📦</button>` : `<span class="small muted">Tap an item below to try it</span>`}<button class="undo" data-action="h-undo" ${undoN ? '' : 'disabled'} aria-label="Undo">↩️</button><button class="done" data-action="h-edit" data-id="">Done</button></div>`;
  return `${edit ? '' : `<div class="room-tabs" data-keep="rtabs">${h.rooms.map((x) => `<button class="${x.id === r.id ? 'on' : ''}" data-action="go" data-to="room/${x.id}"><span>${roomIcon(x.type)}</span>${esc(x.name)}</button>`).join('')}${owner && h.rooms.length < MAX_ROOMS ? '<button class="add" data-action="h-add-room">＋</button>' : ''}</div>`}
    <div class="room-stage${edit ? ' editing' : ''}">
      ${roomHTML(r, opts)}
      <button class="rs-btn rs-home" data-action="go" data-to="house/${mid}" aria-label="Whole house">🏡</button>
      <button class="rs-btn rs-night" data-action="h-night" data-id="${r.id}" aria-label="Day / night">${night ? '☀️' : '🌙'}</button>
      ${edit && !seen().hTip ? `<div class="h-tip">✨ Drag things to move them. Tap one to flip, resize or put it away! <button data-action="h-tip-ok">Got it</button></div>` : ''}
    </div>
    ${!owner ? `<p class="room-hint">Visiting ${esc(member(mid).name)}’s ${esc(r.name.toLowerCase())} · tap the floor to walk around!</p>`
    : edit ? `<div class="h-drawer">${bar}${shopTray(mid, h, r)}</div><div class="h-drawer-space"></div>`
    : `<div class="room-actions"><button class="btn" data-action="h-edit" data-id="${r.id}">✏️ Decorate</button><button class="btn secondary" data-action="go" data-to="avatar">🧍 My avatar</button></div>
      <p class="room-hint">Tap the floor to walk · tap your avatar to wave 👋</p>`}`;
};
function shopTray(mid, h, r) {
  const cat = ui.hCat || 'furniture';
  const chips = `<div class="h-cats" data-keep="hcats">${H_CATS.map(([k, e, l]) => `<button class="${cat === k ? 'on' : ''}" data-action="h-cat" data-c="${k}"><span>${artOr('hcat_' + k, e)}</span>${l}</button>`).join('')}</div>`;
  let grid;
  if (cat === 'walls' || cat === 'floors') {
    const src = cat === 'walls' ? WALLS : FLOORS, have = cat === 'walls' ? h.walls : h.floors, cur = cat === 'walls' ? r.wall : r.floor;
    grid = Object.entries(src).map(([k, [name, price, css]]) => `<button class="h-swatch${cur === k ? ' on' : ''}" data-action="h-surface" data-kind="${cat}" data-id="${k}"><i style="background:${css}"></i><span>${esc(name)}</span><small>${!price || have[k] ? (cur === k ? '✓ On' : 'Owned') : `${GEM} ${price}`}</small></button>`).join('');
  } else if (cat === 'squish') {
    const mine = [...new Set(myItems(mid).map((i) => i.sid))];
    grid = mine.map((sid) => `<button class="h-card" data-action="h-place-sq" data-sid="${sid}"><span class="h-ic">${squishySVG(sid)}</span><span>${esc(SQ[sid].name)}</span><small>Display</small></button>`).join('') || '<div class="small muted" style="padding:10px">Collect squishies to show them off here!</div>';
  } else {
    grid = Object.values(FURN).filter((f) => f.cat === cat).map((f) => {
      const inv = h.inv[f.id] || 0, locked = f.unlock && !isUnlocked(f, mid);
      return `<button class="h-card${locked ? ' locked' : ''}" data-action="h-pick" data-f="${f.id}"><span class="h-ic">${furnArt(f.id) || (f.svg ? FURN_SVG[f.svg]() : f.e)}</span><span>${esc(f.name)}</span><small>${locked ? '🔒 Earn it' : inv ? `×${inv} to place` : f.price ? `${GEM} ${f.price}` : 'Free'}</small></button>`;
    }).join('');
  }
  return `<div class="h-tray">${chips}<div class="h-grid" data-pages="hgrid-${cat}">${grid}</div></div>`;
}
// Gomez Town + House of the Week
function houseOfWeek() {
  const tally = (wk) => { const c = {}; for (const [voter, owner] of Object.entries(state.houseVotes[wk] || {})) if (isMember(owner) && voter !== owner) c[owner] = (c[owner] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
  const last = tally(addDays(weekStart(today()), -7)), now = tally(weekStart(today()));
  return { winner: last[0]?.[0] || '', winVotes: last[0]?.[1] || 0, leader: now[0]?.[0] || '', leadVotes: now[0]?.[1] || 0 };
}
function awardHouseOfWeek() {
  const { winner } = houseOfWeek();
  if (winner && gemLog(winner, 30, '👑 House of the Week!', 'bonus', 'how:' + addDays(weekStart(today()), -7))) save();
}
views.town = () => {
  awardHouseOfWeek();
  const me = actor(), how = houseOfWeek();
  const homes = state.members.filter((m) => houseOf(m.id) || m.id === me);
  const d = typeof circle === 'function' ? circle() : null;
  const friendHomes = d ? Object.entries(d.shows).filter(([k, s]) => s.house && d.people[k] && !isMine(k) && !mutedHere(k)) : [];
  const night = new Date().getHours() >= 19 || new Date().getHours() < 6;
  const trees = ['🌳', '🌲', '🌷', '🌳', '🌻'];
  const street = (list) => `<div class="street${night ? ' night' : ''}">${night ? '<span class="town-moon">🌙</span>' : '<span class="town-sun">☀️</span>'}<span class="hs-cloud"></span><span class="hs-cloud c2"></span><div class="street-row">${list.map((x, i) => x + `<span class="town-tree">${trees[i % trees.length]}</span>`).join('')}</div><div class="road"></div></div>`;
  return `${how.winner || how.leader ? `<div class="card how-card"><span class="how-crown">👑</span><div><b>House of the Week</b><div class="small">${how.winner ? `Last week: <b>${esc(member(how.winner).name)}</b> won ${GEM} 30!` : ''}${how.leader ? ` ${how.winner ? '·' : ''} Leading now: <b>${esc(member(how.leader).name)}</b> (${how.leadVotes} vote${how.leadVotes > 1 ? 's' : ''})` : ''}</div></div></div>` : `<div class="card how-card"><span class="how-crown">👑</span><div><b>House of the Week</b><div class="small">Visit a house and tap 👑 Vote. The winner gets ${GEM} 30 every Monday!</div></div></div>`}
    <div class="section-title">🏘️ Gomez Town</div>
    ${street(homes.map((m) => { const h = houseOf(m.id) || { roof: ROOFS[0], siding: SIDINGS[0], name: `${m.name}’s House` }; return `<button class="town-house" data-action="go" data-to="house/${m.id}"><span class="th-art">${houseExterior(h, { crown: how.winner === m.id, night, smoke: true })}<span class="th-av">${avatarSVG(avatarOf(m.id))}</span></span><b>${esc(m.emoji)} ${esc(m.name)}</b><small>❤️ ${Object.keys(h.likes || {}).length}${m.id === me ? ' · you' : ''}</small></button>`; }))}
    ${friendHomes.length ? `<div class="section-title">👯 Friends Lane</div>${street(friendHomes.map(([k, s]) => `<button class="town-house" data-action="go" data-to="fhouse/${encodeURIComponent(k)}"><span class="th-art">${houseExterior({ roof: s.house.roof, siding: s.house.siding }, { night, smoke: true })}${s.av ? `<span class="th-av">${avatarSVG(s.av)}</span>` : ''}</span><b>${esc(d.people[k].emoji)} ${esc(d.people[k].name)}</b><small>${esc(famName(famOf(k)))} · ❤️ ${Object.keys(s.hlikes || {}).length}</small></button>`))}` : ''}
    ${me ? `<button class="btn block" data-action="go" data-to="house">🏡 Go home</button>` : ''}`;
};
// Friends' houses (read-only, from the Friends Circle)
views.fhouse = (param) => {
  const k = decodeURIComponent(param || ''), d = typeof circle === 'function' ? circle() : null;
  const p = d?.people[k], sh = d?.shows[k];
  if (!p || !sh?.house) return '<div class="card empty">This house isn’t open for visits.</div>';
  const hx = sh.house, me = pkey();
  const h = { name: hx.name, roof: hx.roof, siding: hx.siding, rooms: hx.rooms.map((r, i) => ({ id: `f${i}`, type: r.t, name: ROOM_TYPES[r.t]?.[1] || 'Room', wall: r.w, floor: r.f, night: !!r.n, items: r.i.map(([f, x, y, s, fl, sid], j) => ({ id: `f${i}_${j}`, f, x, y, s, flip: !!fl, sid })) })) };
  const likes = Object.keys(sh.hlikes || {});
  const open = ui.fRoom != null ? h.rooms[ui.fRoom] : null;
  const fav = sh.av ? [{ key: 'own', a: sh.av, x: 72, y: 95, name: p.name }] : [];
  return `${open ? `<div class="room-head"><button class="mini-btn" data-action="fh-room" data-i="">🏡 ${esc(h.name)}</button><span class="room-title">${esc(open.name)}</span><span></span></div><div class="room-wrap">${roomHTML(open, { avatars: [...fav, ...(actor() ? [{ key: 'me', me: true, a: avatarOf(actor()), x: ui.hVis?.[open.id]?.x ?? 24, y: ui.hVis?.[open.id]?.y ?? 97, name: member(actor()).name }] : [])] })}</div>`
    : `<div class="house-scene"><div class="hs-sky"><span class="hs-cloud"></span><span class="hs-sun"></span></div>${dollhouse(h, '', true, { avatar: sh.av, roomAction: (r) => `data-action="fh-room" data-i="${h.rooms.indexOf(r)}"` })}</div>`}
    <div class="house-meta"><span>❤️ ${likes.length}</span><span class="small muted">${esc(famName(famOf(k)))}</span></div>
    <div class="btn-row"><button class="btn secondary${likes.includes(me) ? ' liked' : ''}" data-action="fh-like" data-k="${esc(k)}">${likes.includes(me) ? '💖 Liked' : '🤍 Like'}</button><button class="btn secondary" data-action="go" data-to="fchat">💬 Say something</button></div>`;
};

/* =========================================================
   Sheets
   ========================================================= */
function addRoomSheet() {
  const mid = actor(), h = ensureHouse(mid);
  if (h.rooms.length >= MAX_ROOMS) { toast('Your house is full! 🏠'); return; }
  openSheet({
    title: '➕ Add a room',
    saveLabel: 'Build it!',
    values: { type: 'living' },
    fields: [
      { name: 'type', label: 'Which room?', type: 'select', options: Object.entries(ROOM_TYPES).filter(([k]) => k !== 'bedroom' || h.rooms.every((r) => r.type !== 'bedroom')).map(([k, [e, n, p]]) => ({ value: k, label: `${e} ${n} — ${p ? `${p} 💎` : 'free'}` })) },
      { type: 'html', html: `<p class="small muted" style="margin:0 4px">You have ${gemBalance(mid)} ${GEM}. Up to ${MAX_ROOMS} rooms.</p>` },
    ],
    onSave(v) {
      const [e, name, price, wall, floor] = ROOM_TYPES[v.type];
      if (price && !spendGems(mid, price, `New ${name}`, 'house')) return false;
      const r = { id: uid(), type: v.type, name, wall, floor, night: false, items: v.type === 'yard' ? [{ id: uid(), f: 'tree', x: 20, y: 92 }, { id: uid(), f: 'flowers', x: 70, y: 90 }, { id: uid(), f: 'sun', x: 82, y: 22 }] : [{ id: uid(), f: 'window', x: 50, y: 44 }] };
      h.walls[wall] = true; h.floors[floor] = true;
      h.rooms.push(r);
      logAct(e, `built a ${name.toLowerCase()} in their Dream House`, 'house/' + mid);
      setTimeout(() => { confetti(); go('room/' + r.id); });
    },
  });
}
function houseStyleSheet() {
  const mid = actor(), h = ensureHouse(mid);
  openSheet({
    title: '🎨 House style',
    values: { name: h.name },
    fields: [
      { name: 'name', label: 'House name', required: true, placeholder: 'e.g. Layla’s Castle' },
      { type: 'html', html: `<div class="small muted pick-label">Roof</div><div class="swatches">${ROOFS.map((c) => `<label><input type="radio" name="roof" value="${c}" ${h.roof === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div><div class="small muted pick-label">Walls</div><div class="swatches">${SIDINGS.map((c) => `<label><input type="radio" name="siding" value="${c}" ${h.siding === c ? 'checked' : ''}><span style="background:${c};box-shadow:inset 0 0 0 1px #0002"></span></label>`).join('')}</div>` },
    ],
    onSave(v) { const f = $('#sheetForm'); h.name = v.name; h.roof = f.elements.roof?.value || h.roof; h.siding = f.elements.siding?.value || h.siding; },
  });
}
function roomSheet(r) {
  const found = findRoom(r.id);
  openSheet({
    title: `⚙️ ${r.name}`,
    values: { name: r.name },
    fields: [{ name: 'name', label: 'Room name', required: true }],
    onSave(v) { r.name = v.name; },
    onDelete: found.h.rooms.length > 1 ? () => { if (!confirm(`Remove the ${r.name}? Everything in it goes back to your storage.`)) return; for (const it of r.items) if (it.f !== 'sq') found.h.inv[it.f] = (found.h.inv[it.f] || 0) + 1; found.h.rooms = found.h.rooms.filter((x) => x.id !== r.id); save(); go('house'); } : null,
    deleteLabel: 'Remove room',
  });
}
function noteSheet(mid) {
  const me = actor();
  const free = !isKidId(me) || (typeof kidRule === 'function' && kidRule(me).chat === 'free');
  openSheet({
    title: `📝 Note for ${member(mid).name}`,
    saveLabel: 'Stick it!',
    values: { text: NOTE_PRESETS[0] },
    fields: [
      { type: 'html', html: `<div class="chips">${NOTE_PRESETS.map((t) => `<button type="button" class="chip" data-kudos-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>` },
      { name: 'text', label: 'Note', required: true, ...(free ? {} : { hint: 'Pick a note above' }) },
    ],
    onSave(v) {
      const text = String(v.text).trim().slice(0, 140);
      if (!text) return false;
      const h = houseOf(mid);
      (h.notes ||= []).push({ id: uid(), from: me, text, at: Date.now() });
      if (h.notes.length > 30) h.notes = h.notes.slice(-30);
      logAct('📝', `left a note on ${whoName(mid)}’s house`, 'house/' + mid);
      toast('📝 Stuck on their house!');
    },
  });
  setTimeout(() => { const t = $('#sheetForm [name="text"]'); if (t && !free) t.readOnly = true; });
}
// Undo while decorating (per room, this visit only)
function pushUndo(r) {
  const st = ((ui.hUndo ||= {})[r.id] ||= []);
  st.push(JSON.stringify({ items: r.items, wall: r.wall, floor: r.floor }));
  if (st.length > 30) st.shift();
}
function placeItem(r, f, extra = {}) {
  const wall = f && f.place === 'wall';
  const it = { id: uid(), f: f ? f.id : 'sq', x: 30 + Math.round(Math.random() * 40), y: wall ? 40 + Math.round(Math.random() * 10) : f && f.layer === 0 ? 84 : 84 + Math.round(Math.random() * 10), ...extra };
  r.items.push(it);
  ui.hSel = it.id; ui.hNew = it.id;
  if (typeof sqSound === 'function') sqSound('pop');
  return it;
}

/* =========================================================
   Drag to move (edit mode)
   ========================================================= */
let hDrag = null;
// Where an item may go: wall things stay on the back wall, floor things on the floor (anchor = bottom center).
function snapBox(it) {
  const f = FURN[it.f];
  if (!f || it.f === 'sq') return [8, 92, 70, 100];
  if (f.layer === 0) return [16, 84, 70, 96];
  if (f.place === 'wall') return [16, 84, 18, 60];
  if (f.place === 'floor') return [8, 92, 70, 100];
  return [8, 92, 18, 100];
}
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.room.editing .hi');
  if (!el) return;
  const roomEl = el.closest('.room'), rect = roomEl.getBoundingClientRect();
  const found = findRoom(roomEl.dataset.room); if (!found) return;
  const it = el.dataset.hi === 'try' ? ui.hTry : found.r.items.find((x) => x.id === el.dataset.hi); if (!it) return;
  e.preventDefault();
  hDrag = { el, it, r: found.r, snap: JSON.stringify({ items: found.r.items, wall: found.r.wall, floor: found.r.floor }), rect, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, moved: false };
  roomEl.querySelectorAll('.hi.sel').forEach((x) => x.classList.remove('sel'));
  if (!seen().hTip) { seen().hTip = 1; document.querySelector('.h-tip')?.remove(); }
  el.classList.add('sel', 'dragging');
});
document.addEventListener('pointermove', (e) => {
  if (!hDrag) return;
  const { el, it, rect, sx, sy, ox, oy } = hDrag;
  const dx = ((e.clientX - sx) / rect.width) * 100, dy = ((e.clientY - sy) / rect.height) * 100;
  if (Math.abs(dx) + Math.abs(dy) > 1) hDrag.moved = true;
  const [x0, x1, y0, y1] = snapBox(it);
  const x = Math.max(x0, Math.min(x1, ox + dx)), y = Math.max(y0, Math.min(y1, oy + dy));
  el.style.left = x + '%'; el.style.top = y + '%';
  hDrag.x = x; hDrag.y = y;
});
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => {
  if (!hDrag) return;
  const { el, it, moved, x, y, r, snap } = hDrag;
  hDrag = null;
  el.classList.remove('dragging');
  ui.hSel = it.id;
  if (it === ui.hTry) { if (moved && x != null) { it.x = x; it.y = y; } render(); return; }
  if (moved && x != null) { const st = ((ui.hUndo ||= {})[r.id] ||= []); st.push(snap); it.x = Math.round(x * 10) / 10; it.y = Math.round(y * 10) / 10; save(); }
  render();
});
// Walk: tap the floor and your avatar walks there. Tap an avatar and it waves.
const AV_LINES = ['Hi! 👋', 'Welcome to my room! 💖', 'Wanna see my pets? 🐶', 'I love it here! 🏡', 'Squish! 🧸', 'Yay! 🎉', 'Let’s decorate! ✨'];
function avWave(el, line) {
  if (!el) return;
  el.classList.remove('waving'); void el.offsetWidth; el.classList.add('waving');
  el.querySelector('.av-bubble')?.remove();
  const b = document.createElement('span'); b.className = 'av-bubble'; b.textContent = line || AV_LINES[Math.floor(Math.random() * AV_LINES.length)];
  el.appendChild(b); setTimeout(() => b.remove(), 2200);
  if (typeof sqSound === 'function') sqSound('pop');
}
document.addEventListener('click', (e) => {
  const av = e.target.closest('.room:not(.mini) .hav');
  if (av) { avWave(av); return; }
  const roomEl = e.target.closest('.room:not(.editing):not(.mini)');
  if (!roomEl || e.target.closest('.hi')) return;
  const rect = roomEl.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100, y = ((e.clientY - rect.top) / rect.height) * 100;
  if (y < 66) return; // only on the floor
  const me = roomEl.querySelector('.hav.me');
  if (!me) return;
  const tx = Math.max(8, Math.min(92, x)), ty = Math.max(70, Math.min(99, y));
  const fx = parseFloat(me.style.left), fy = parseFloat(me.style.top);
  const secs = Math.min(2.2, Math.max(0.35, Math.hypot(tx - fx, (ty - fy) * 1.5) / 32));
  me.style.transition = `left ${secs}s linear, top ${secs}s linear`;
  me.classList.toggle('face-left', tx < fx);
  me.classList.add('walking');
  me.style.left = tx + '%'; me.style.top = ty + '%';
  clearTimeout(me._t);
  me._t = setTimeout(() => { me.classList.remove('walking'); me.style.zIndex = 2000 + Math.round(ty * 5); }, secs * 1000);
  const found = findRoom(roomEl.dataset.room);
  if (found && canEdit(found.mid)) { found.r.av = { x: Math.round(tx), y: Math.round(ty) }; clearTimeout(avSaveT); avSaveT = setTimeout(save, 600); }
  else ((ui.hVis ||= {})[roomEl.dataset.room] = { x: tx, y: ty });
});
let avSaveT;
// Tap pets / things when not decorating
document.addEventListener('click', (e) => {
  const el = e.target.closest('.room:not(.editing):not(.mini) .hi');
  if (!el) return;
  el.classList.remove('boing'); void el.offsetWidth; el.classList.add('boing');
  if (el.classList.contains('pet')) {
    const heart = document.createElement('span'); heart.className = 'pet-heart'; heart.textContent = '💕';
    el.appendChild(heart); setTimeout(() => heart.remove(), 900);
    if (typeof sqSound === 'function') sqSound('pop');
  }
});

/* =========================================================
   Friends: publish the house with the showcase
   ========================================================= */
if (typeof myShow === 'function') {
  const _myShowH = myShow;
  myShow = function (mid) {
    const sh = _myShowH(mid), h = houseOf(mid);
    const r = isKidId(mid) ? kidRule(mid) : { show: true };
    if (h && r.show) sh.house = { name: h.name, roof: h.roof, siding: h.siding, rooms: h.rooms.map((x) => ({ t: x.type, w: x.wall, f: x.floor, n: x.night ? 1 : 0, i: x.items.map((it) => [it.f, it.x, it.y, it.s || 1, it.flip ? 1 : 0, ...(it.sid ? [it.sid] : [])]) })) };
    return sh;
  };
}
if (typeof publishFamily === 'function') {
  // Keep the friends' "likes" on a house when this family republishes its showcase.
  const _pub = publishFamily;
  publishFamily = function () {
    const d = circle();
    const keep = d ? Object.fromEntries(Object.entries(d.shows).filter(([k]) => isMine(k)).map(([k, s]) => [k, s.hlikes])) : {};
    const _myShowP = myShow;
    myShow = (mid) => ({ ..._myShowP(mid), hlikes: keep[pkey(mid)] || {} });
    try { _pub(); } finally { myShow = _myShowP; }
  };
}
const _friendViewH = views.friend;
views.friend = (param) => {
  const html = _friendViewH(param), k = decodeURIComponent(param || '');
  const sh = typeof circle === 'function' ? circle()?.shows[k] : null;
  if (!sh?.house) return html;
  return html.replace('<div class="section-title">', `<button class="card row tap" style="width:100%;text-align:left;margin-top:12px" data-action="go" data-to="fhouse/${encodeURIComponent(k)}"><div class="avatar">🏡</div><div class="grow"><div class="title">Visit ${esc(sh.house.name)}</div><div class="sub">${sh.house.rooms.length} room${sh.house.rooms.length > 1 ? 's' : ''}</div></div>${ICON.chev}</button><div class="section-title">`);
};

/* =========================================================
   Wiring
   ========================================================= */
KID_ROUTES.push('house', 'room', 'town', 'fhouse');
for (const a of ['h-try-cancel', 'h-try-keep', 'h-undo', 'h-tip-ok', 'av-wave', 'h-add-room', 'h-style', 'h-like', 'h-note', 'h-note-del', 'h-vote', 'h-night', 'h-edit', 'h-room-edit', 'h-cat', 'h-pick', 'h-place-sq', 'h-surface', 'h-flip', 'h-size', 'h-front', 'h-store', 'fh-room', 'fh-like']) KID_ACTIONS.add(a);
const curRoom = () => { const r = currentRoute(); return r.name === 'room' ? findRoom(r.param) : null; };
const selItem = () => { const f = curRoom(); return f ? f.r.items.find((i) => i.id === ui.hSel) : null; };
Object.assign(actions, {
  'h-add-room': () => addRoomSheet(),
  'h-style': () => houseStyleSheet(),
  'h-room-edit': (el) => { const f = findRoom(el.dataset.id); if (f) roomSheet(f.r); },
  'h-edit': (el) => { ui.hEdit = el.dataset.id || null; ui.hSel = null; ui.hTry = null; ui.hTrySurf = null; render(); viewEl.scrollTop = 0; },
  'h-cat': (el) => { ui.hCat = el.dataset.c; render(); },
  'h-night': (el) => { const f = findRoom(el.dataset.id); if (!f) return; if (canEdit(f.mid)) { f.r.night = !f.r.night; save(); } else { ui.hPeek ||= {}; ui.hPeek[f.r.id] = !(ui.hPeek[f.r.id] ?? f.r.night); } render(); },
  'h-pick': (el) => {
    const found = curRoom(); if (!found || !canEdit(found.mid)) return;
    const f = FURN[el.dataset.f], h = found.h;
    if (f.unlock && !isUnlocked(f, found.mid)) { toast(`🔒 ${ULTS[f.unlock]?.how || 'Keep going'} to earn this!`); return; }
    if (h.inv[f.id] > 0) { pushUndo(found.r); h.inv[f.id]--; placeItem(found.r, f); save(); render(); return; }
    if (!f.price) { pushUndo(found.r); placeItem(found.r, f); save(); render(); return; }
    // Try before you buy: a see-through preview you can drag around, then Keep it or ✕.
    const wall = f.place === 'wall';
    ui.hTrySurf = null;
    ui.hTry = { room: found.r.id, f: f.id, x: 50, y: wall ? 42 : f.layer === 0 ? 84 : 90 };
    if (typeof sqSound === 'function') sqSound('pop');
    render();
    return;
    openSheet({
      title: `Buy ${f.name}?`, saveLabel: `${GEM} ${f.price}`, values: {},
      fields: [{ type: 'html', html: `<div class="buy-preview">${furnArt(f.id) ? `<div style="width:96px">${furnArt(f.id)}</div>` : `<span style="font-size:64px">${f.svg ? '' : f.e}</span>${f.svg ? `<div style="width:110px">${FURN_SVG[f.svg]()}</div>` : ''}`}<div><b>${esc(f.name)}</b><div class="small muted">You have ${gemBalance(found.mid)} ${GEM}${owned(h, f.id) ? ` · you own ${owned(h, f.id)}` : ''}</div></div></div>` }],
      onSave() {
        if (!spendGems(found.mid, f.price, `Bought a ${f.name} for my house`, 'house')) return false;
        pushUndo(found.r);
        placeItem(found.r, f);
        if (f.price >= 150) logAct('🏡', `got a ${f.name} for their Dream House!`, 'house/' + found.mid);
      },
    });
  },
  'h-place-sq': (el) => {
    const found = curRoom(); if (!found || !canEdit(found.mid)) return;
    const n = myItems(found.mid).filter((i) => i.sid === el.dataset.sid).length;
    const shown = sum(found.h.rooms, (r) => r.items.filter((i) => i.f === 'sq' && i.sid === el.dataset.sid).length);
    if (shown >= n) { toast('That squishy is already on display'); return; }
    pushUndo(found.r); placeItem(found.r, null, { sid: el.dataset.sid }); save(); render();
  },
  'h-surface': (el) => {
    const found = curRoom(); if (!found || !canEdit(found.mid)) return;
    const walls = el.dataset.kind === 'walls', src = walls ? WALLS : FLOORS, have = walls ? found.h.walls : found.h.floors, id = el.dataset.id;
    const [name, price] = src[id];
    const apply = () => { pushUndo(found.r); if (walls) found.r.wall = id; else found.r.floor = id; have[id] = true; };
    if (!price || have[id]) { ui.hTrySurf = null; apply(); save(); render(); return; }
    ui.hTry = null;
    ui.hTrySurf = { room: found.r.id, kind: el.dataset.kind, id };
    render();
    return;
    openSheet({ title: `${name} ${walls ? 'wallpaper' : 'floor'}?`, saveLabel: `${GEM} ${price}`, values: {}, fields: [{ type: 'html', html: `<div class="h-preview" style="background:${src[id][2]}"></div><p class="small muted">Once you buy it, you can use it in every room.</p>` }],
      onSave() { if (!spendGems(found.mid, price, `${name} ${walls ? 'wallpaper' : 'floor'}`, 'house')) return false; apply(); } });
  },
  'h-flip': () => { const it = selItem(); if (it) { pushUndo(curRoom().r); it.flip = !it.flip; save(); render(); } },
  'h-size': (el) => { const it = selItem(); if (it) { pushUndo(curRoom().r); it.s = Math.max(0.5, Math.min(2.2, Math.round(((it.s || 1) + Number(el.dataset.d) * 0.15) * 100) / 100)); save(); render(); } },
  'h-front': () => { const f = curRoom(), it = selItem(); if (f && it) { pushUndo(f.r); for (const x of f.r.items) delete x.zb; it.zb = 1; save(); render(); toast('⬆️ In front'); } },
  'h-store': () => { const f = curRoom(), it = selItem(); if (!f || !it) return; pushUndo(f.r); f.r.items = f.r.items.filter((x) => x !== it); if (it.f !== 'sq') f.h.inv[it.f] = (f.h.inv[it.f] || 0) + 1; ui.hSel = null; save(); render(); toast('📦 Put away — find it in the shop tray'); },
  'h-try-cancel': () => { ui.hTry = null; ui.hTrySurf = null; render(); },
  'h-try-keep': () => {
    const found = curRoom(); if (!found) return;
    const mid = found.mid;
    if (ui.hTry) {
      const t = ui.hTry, f = FURN[t.f];
      if (!spendGems(mid, f.price, `Bought a ${f.name} for my house`, 'house')) return;
      pushUndo(found.r);
      const it = { id: uid(), f: f.id, x: t.x, y: t.y };
      found.r.items.push(it); ui.hSel = it.id; ui.hNew = it.id; ui.hTry = null;
      if (f.price >= 150) logAct('🏡', `got a ${f.name} for their Dream House!`, 'house/' + mid);
    } else if (ui.hTrySurf) {
      const t = ui.hTrySurf, walls = t.kind === 'walls', src = walls ? WALLS : FLOORS, [name, price] = src[t.id];
      if (!spendGems(mid, price, `${name} ${walls ? 'wallpaper' : 'floor'}`, 'house')) return;
      pushUndo(found.r);
      if (walls) { found.r.wall = t.id; found.h.walls[t.id] = true; } else { found.r.floor = t.id; found.h.floors[t.id] = true; }
      ui.hTrySurf = null;
    }
    if (typeof sqSound === 'function') sqSound('win');
    confetti(); save(); render();
  },
  'h-undo': () => {
    const f = curRoom(); if (!f) return;
    const st = ui.hUndo?.[f.r.id]; if (!st?.length) return;
    const prev = JSON.parse(st.pop());
    // Give back anything that the undone step had taken out of (or put into) storage.
    const count = (items) => { const c = {}; for (const i of items) if (i.f !== 'sq') c[i.f] = (c[i.f] || 0) + 1; return c; };
    const now = count(f.r.items), was = count(prev.items);
    for (const k of new Set([...Object.keys(now), ...Object.keys(was)])) { const d = (now[k] || 0) - (was[k] || 0); if (d) f.h.inv[k] = Math.max(0, (f.h.inv[k] || 0) + d); }
    Object.assign(f.r, prev); ui.hSel = null; save(); render(); toast('↩️ Undone');
  },
  'h-tip-ok': () => { seen().hTip = 1; save(); render(); },
  'av-wave': (el) => avWave(el.closest('.dh-avatar') || el),
  'h-like': (el) => { const h = houseOf(el.dataset.id), me = actor(); if (!h || !me) return; h.likes ||= {}; if (h.likes[me]) delete h.likes[me]; else { h.likes[me] = true; logAct('❤️', `liked ${whoName(el.dataset.id)}’s house`, 'house/' + el.dataset.id); } save(); render(); },
  'h-note': (el) => noteSheet(el.dataset.id),
  'h-note-del': (el) => { const h = houseOf(el.dataset.h); h.notes = (h.notes || []).filter((n) => n.id !== el.dataset.id); save(); render(); },
  'h-vote': (el) => {
    const me = actor(), mid = el.dataset.id; if (!me) { toast('Pick who you are first'); return; }
    if (me === mid) { toast('You can’t vote for your own house 😉'); return; }
    const v = (state.houseVotes[weekStart(today())] ||= {});
    v[me] = mid; save(); render(); toast(`👑 You voted for ${whoName(mid)}’s house!`);
  },
  'fh-room': (el) => { ui.fRoom = el.dataset.i === '' ? null : Number(el.dataset.i); render(); },
  'fh-like': (el) => {
    const why = typeof friendBlock === 'function' ? friendBlock('heart') : ''; if (why) { toast(why); return; }
    const me = pkey(), k = el.dataset.k;
    circleEdit((d) => { const s = (d.shows[k] ||= {}); const l = (s.hlikes ||= {}); if (l[me]) delete l[me]; else l[me] = true; });
    render();
  },
});
// Inbox: notes left on my house
const _inboxItemsH = inboxItems;
inboxItems = function () {
  const items = _inboxItemsH(), me = actor(), h = me && houseOf(me);
  if (h) { const fresh = (h.notes || []).filter((n) => n.from !== me && n.at > (seen().houseNotes || 0)); if (fresh.length) items.unshift({ n: fresh.length, icon: '📝', title: `${whoName(fresh.at(-1).from)} left a note on your house`, sub: fresh.at(-1).text, to: 'house' }); }
  return items;
};
const _afterRenderH = afterRender;
afterRender = function () {
  _afterRenderH();
  const r = currentRoute();
  if (r.name === 'house' && (!r.param || r.param === actor())) { seen().houseNotes = Date.now(); saveSeen(); }
  if (r.name !== 'room') { ui.hEdit = null; ui.hSel = null; ui.hUndo = {}; ui.hTry = null; ui.hTrySurf = null; }
  document.body.classList.toggle('house-editing', r.name === 'room' && !!ui.hEdit);
  if (ui.hNew) setTimeout(() => { ui.hNew = null; }, 700);
  if (r.name !== 'fhouse') ui.fRoom = null;
  document.body.classList.toggle('route-room', ['room', 'fhouse', 'house', 'squishies'].includes(r.name));
};
// More grid + kid home entry points
const _moreGridH = moreGrid;
moreGrid = function () {
  const me = actor();
  return _moreGridH().replace('<div class="more-label">Play & collect</div><div class="grid3">', `<div class="more-label">Play & collect</div><div class="grid3">
    <button class="card mini-tile" data-action="go" data-to="house"><div class="emoji">🏡</div><b>Dream House</b><div class="small muted">${me && houseOf(me) ? `${houseOf(me).rooms.length} room${houseOf(me).rooms.length > 1 ? 's' : ''}` : 'Move in!'}</div></button>
    <button class="card mini-tile" data-action="go" data-to="town"><div class="emoji">🏘️</div><b>Town</b><div class="small muted">Visit & vote</div></button>`);
};
const _kidViewH = views.kid;
views.kid = () => {
  const html = _kidViewH(), id = kidModeId();
  if (!id) return html;
  const h = houseOf(id);
  const card = `<button class="card house-banner" data-action="go" data-to="house"><div class="hb-art">${houseExterior(h || { roof: ROOFS[1], siding: SIDINGS[1] })}<span class="hb-av">${avatarSVG(avatarOf(id))}</span></div><div class="grow"><b>My Dream House</b><div class="small">${h ? `${h.rooms.length} room${h.rooms.length > 1 ? 's' : ''} · ❤️ ${Object.keys(h.likes || {}).length}` : 'Move in & decorate!'}</div></div>${ICON.chev}</button>`;
  const i = html.indexOf('<button class="card sq-banner"');
  return i < 0 ? html + card : html.slice(0, i) + card + html.slice(i);
};
