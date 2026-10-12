/* Squishvale: The Lost Squish Stars — story, regions, characters.
   Data only; world.js is the engine. Region coordinates are tiles inside a 36×28 region. */
'use strict';

const WORLD_TITLE = 'Squishvale';
const WORLD_SUB = 'The Lost Squish Stars';

/* ---------- Story premise (shown as the opening) ---------- */
const WORLD_INTRO = [
  { art: '⭐', title: 'Squishvale', text: 'In the land of Squishvale, eight shining Squish Stars keep every squishy soft, bouncy and happy.' },
  { art: '🍪', title: 'Baron Von Crumb', text: 'But grumpy Baron Von Crumb thinks squishies should be CRUNCHY, like his cookies. He sent his goofy Crumb Crew to snatch all eight stars!' },
  { art: '🌿', title: 'Squishies on the loose', text: 'Without the stars, the squishies got scared and ran off to hide in the wild grass. And the Great Squish Festival is only days away…' },
  { art: '🫧', title: 'A new Squish Ranger', text: 'Professor Mallow needs a brave Squish Ranger to catch squishies, help every town, and win back all eight stars. That’s you!' },
];

/* ---------- Characters ---------- */
const NPC_BASE = { skin: 2, hair: 'short', hairC: 'brown', eyes: 'round', eyeC: 0, mouth: 'smile', blush: true, freckles: false, top: 'tee', topC: 5, graphic: 'none', bottom: 'pants', bottomC: 8, shoes: 'sneakers', shoesC: 7, acc: 'none', facial: 'none', own: {} };
const NPC_LOOK = {
  mallow: { skin: 1, hair: 'curly', hairC: 'silver', top: 'jacket', topC: 7, acc: 'glasses', facial: 'mustache', mouth: 'grin' },
  puddle: { skin: 3, hair: 'short', hairC: 'silver', top: 'jacket', topC: 8, facial: 'mustache', acc: 'cap', mouth: 'smile' },
  tilly: { skin: 4, hair: 'pigtails', hairC: 'black', top: 'overalls', topC: 2, bottomC: 5, acc: 'bow', eyes: 'happy' },
  nibs: { skin: 2, hair: 'spiky', hairC: 'ginger', top: 'hoodie', topC: 1, graphic: 'bolt', acc: 'cap', mouth: 'smirk', freckles: true },
  nobs: { skin: 5, hair: 'buzz', hairC: 'dark', top: 'hoodie', topC: 9, graphic: 'bolt', acc: 'sunglasses', mouth: 'grin' },
  shop: { skin: 2, hair: 'bob', hairC: 'blue', top: 'tee', topC: 4, graphic: 'star', acc: 'headphones' },
  coral: { skin: 3, hair: 'short', hairC: 'silver', top: 'sweater', topC: 5, facial: 'beard', acc: 'cap', mouth: 'grin' },
  shelly: { skin: 1, hair: 'pigtails', hairC: 'blonde', top: 'tank', topC: 0, bottom: 'shorts', bottomC: 4, shoes: 'sandals', acc: 'flower' },
  kai: { skin: 5, hair: 'curly', hairC: 'dark', top: 'tank', topC: 4, bottom: 'shorts', bottomC: 2, shoes: 'sandals', acc: 'sunglasses' },
  bun: { skin: 1, hair: 'buns', hairC: 'auburn', top: 'overalls', topC: 0, bottomC: 11, eyes: 'lashes', acc: 'flower' },
  moss: { skin: 4, hair: 'short', hairC: 'brown', top: 'hoodie', topC: 3, acc: 'beanie', facial: 'stubble' },
  fern: { skin: 2, hair: 'braid', hairC: 'auburn', top: 'overalls', topC: 7, bottomC: 5, acc: 'cap', freckles: true },
  hay: { skin: 3, hair: 'buzz', hairC: 'silver', top: 'sweater', topC: 2, facial: 'beard', acc: 'glasses' },
  ruby: { skin: 5, hair: 'long', hairC: 'auburn', top: 'jacket', topC: 9, eyes: 'lashes', acc: 'tiara', own: { 'acc:tiara': 1 } },
  gus: { skin: 2, hair: 'spiky', hairC: 'blonde', top: 'tee', topC: 1, graphic: 'star', acc: 'cap' },
  mimi: { skin: 6, hair: 'ponytail', hairC: 'pink', top: 'tee', topC: 10, graphic: 'heart', acc: 'bow' },
  quizzy: { skin: 1, hair: 'curly', hairC: 'purple', top: 'sweater', topC: 6, acc: 'glasses', mouth: 'open' },
  rocky: { skin: 4, hair: 'short', hairC: 'black', top: 'jacket', topC: 3, acc: 'beanie', facial: 'stubble' },
  owl: { skin: 2, hair: 'buzz', hairC: 'silver', top: 'sweater', topC: 8, facial: 'beard', acc: 'glasses', eyes: 'sleepy' },
  skye: { skin: 1, hair: 'curly', hairC: 'mint', top: 'dress', topC: 10, eyes: 'lashes', acc: 'starclips' },
  mira: { skin: 3, hair: 'long', hairC: 'black', top: 'hoodie', topC: 6, eyes: 'lashes', acc: 'none' },
  grim: { skin: 1, hair: 'buzz', hairC: 'dark', top: 'jacket', topC: 8, facial: 'goatee', acc: 'beanie', mouth: 'grin' },
  penny: { skin: 2, hair: 'bob', hairC: 'black', top: 'sweater', topC: 4, acc: 'beanie', eyes: 'happy' },
  yuki: { skin: 0, hair: 'curly', hairC: 'silver', top: 'hoodie', topC: 7, facial: 'beard', mouth: 'open' },
  baron: { skin: 1, hair: 'short', hairC: 'black', top: 'cape', topC: 8, facial: 'mustache', acc: 'cap', mouth: 'smirk', eyes: 'sleepy' },
};

/* ---------- Regions (one per chapter), laid out 4 × 2:  1 2 3 4 / 8 7 6 5 ---------- */
const WREG = [
  { key: 'meadow', ch: 1, name: 'Mallow Meadow', town: 'Puffington', title: 'A Ranger Is Born', emoji: '🌼',
    ground: 'GRASS', wall: 'TREE', sets: ['critters'], hub: [18, 14], start: [13, 11], blocker: 'puffball',
    pal: { g1: '#8fd16a', g2: '#7fc45c', tall: '#3f9a3a', tall2: '#5cb84a', path: '#ead9ab', path2: '#dcc795', leaf: '#3f9b4a', leaf2: '#5cbf5c', water: '#4fb3e8', flower: ['#ff8fab', '#ffd43b', '#ffffff', '#b197fc'] },
    buildings: [{ kind: 'lab', x: 8, y: 5, w: 6, h: 4, label: 'LAB' }, { kind: 'hall', x: 21, y: 5, w: 5, h: 4, label: 'TOWN HALL' }, { kind: 'mart', x: 25, y: 18, w: 4, h: 3, label: 'BUBBLES' }, { kind: 'house', x: 3, y: 13, w: 4, h: 3 }],
    ponds: [[8, 21, 3]], grass: 7, trees: 9, rocks: 3,
    npcs: [
      { id: 'mallow', look: 'mallow', x: 12, y: 10, name: 'Professor Mallow' },
      { id: 'puddle', look: 'puddle', x: 24, y: 10, name: 'Mayor Puddle' },
      { id: 'tilly', look: 'tilly', x: 16, y: 18, name: 'Tilly', side: { id: 'tilly', ask: ['Psst! Squishies hide in the tall, dark grass 🌿 Walk through it and one might pop out!', 'Can you catch 3 Cozy Critters 🐾 for me? I’ll give you 5 bubbles!'], set: 'critters', n: 3, give: { bubbles: 5 }, thanks: ['So fluffy! Here, 5 bubbles. Thank you, Ranger! 🫧'], after: ['Psst! Squishies hide in the tall, dark grass 🌿'] } },
      { id: 'nibs', look: 'nibs', x: 30, y: 8, name: 'Nibs', crumb: true, when: (p) => p.ch === 1 && p.step <= 5 },
      { id: 'shop1', look: 'shop', x: 29, y: 21, name: 'Bubble Shop', shop: true },
    ],
    specials: [{ id: 'pip', kind: 'pip', x: 12, y: 24, set: 'critters', name: 'Pip', when: (p) => p.ch === 1 && p.step === 3 }],
    stop: [17, 12],
  },
  { key: 'shore', ch: 2, name: 'Sprinkle Shore', town: 'Sprinkle Harbor', title: 'Lights Out at Sprinkle Shore', emoji: '🌊',
    ground: 'SAND', wall: 'PALM', sets: ['ocean'], hub: [18, 15], blocker: 'log', sea: true,
    pal: { g1: '#f6e6b8', g2: '#efdca8', tall: '#9fbf4a', tall2: '#c0d65e', path: '#e2c88d', path2: '#d4b878', leaf: '#4fae5a', leaf2: '#7bd36f', water: '#3fa9e6', flower: ['#ff8fab', '#ffffff', '#ffd43b'] },
    buildings: [{ kind: 'lighthouse', x: 25, y: 0, w: 3, h: 3 }, { kind: 'mart', x: 4, y: 20, w: 4, h: 3, label: 'BUBBLES' }, { kind: 'house', x: 11, y: 9, w: 4, h: 3 }],
    grass: 5, trees: 3, rocks: 4,
    npcs: [
      { id: 'coral', look: 'coral', x: 28, y: 9, name: 'Captain Coral' },
      { id: 'shelly', look: 'shelly', x: 10, y: 16, name: 'Sandy', idle: ['Jellies love music! When they’re upset, copy their wave song and they calm right down 🎵'] },
      { id: 'kai', look: 'kai', x: 21, y: 12, name: 'Kai', side: { id: 'kai', ask: ['Yo Ranger! Catch 3 ocean squishies and I’ll hook you up with 5 bubbles 🤙'], set: 'ocean', n: 3, give: { bubbles: 5 }, thanks: ['Gnarly catches! Here, 5 bubbles. Ride on! 🌊'] } },
      { id: 'shop2', look: 'shop', x: 9, y: 22, name: 'Bubble Shop', shop: true },
      { id: 'jelly', guardian: { set: 'ocean', sp: 'jelly' }, x: 26, y: 4, name: 'Tidal Jelly', idle: ['The Tidal Jelly bobs happily and glows soft blue 💙'] },
    ],
    items: [{ id: 'shell1', group: 'shell', x: 6, y: 11, icon: '🐚' }, { id: 'shell2', group: 'shell', x: 15, y: 23, icon: '🐚' }, { id: 'shell3', group: 'shell', x: 32, y: 21, icon: '🐚' }],
    stop: [17, 13],
  },
  { key: 'woods', ch: 3, name: 'Sugarplum Woods', town: 'Sugarplum Bakery', title: 'Sweet Trouble in Sugarplum Woods', emoji: '🍰',
    ground: 'GRASS', wall: 'TREE', sets: ['treats'], hub: [18, 14], blocker: 'crumbs',
    pal: { g1: '#6dbb5a', g2: '#62ae50', tall: '#2f7d33', tall2: '#479a3f', path: '#d9c08f', path2: '#c9ad78', leaf: '#2f7d3c', leaf2: '#4a9b48', water: '#4fb3e8', flower: ['#ff8fab', '#ff6b6b', '#ffffff', '#f783ac'] },
    buildings: [{ kind: 'bakery', x: 14, y: 4, w: 5, h: 4, label: 'BAKERY' }],
    grass: 7, trees: 22, rocks: 2, hollow: [6, 21, 3],
    npcs: [
      { id: 'bun', look: 'bun', x: 19, y: 9, name: 'Baker Bun' },
      { id: 'moss', look: 'moss', x: 25, y: 20, name: 'Ranger Moss' },
      { id: 'snorebear', guardian: { set: 'critters', sp: 'bear' }, x: 6, y: 21, name: 'Snorebear', idle: ['Zzz… zzz… Snorebear is fast asleep, hugging a cookie 😴'] },
    ],
    items: [{ id: 'berry1', group: 'berry', x: 4, y: 7, icon: '🫐' }, { id: 'berry2', group: 'berry', x: 11, y: 15, icon: '🫐' }, { id: 'berry3', group: 'berry', x: 23, y: 5, icon: '🫐' }, { id: 'berry4', group: 'berry', x: 31, y: 9, icon: '🫐' }, { id: 'berry5', group: 'berry', x: 29, y: 24, icon: '🫐' }],
    stop: [18, 12],
  },
  { key: 'farm', ch: 4, name: 'Barnaby Farm', town: 'Barnaby Farm', title: 'Barnyard Breakout', emoji: '🐮',
    ground: 'GRASS', wall: 'TREE', sets: ['farm'], hub: [18, 13], blocker: 'hay',
    pal: { g1: '#9bd46a', g2: '#8cc85c', tall: '#5a9e34', tall2: '#78b84a', path: '#e3cc98', path2: '#d2b97f', leaf: '#47a04f', leaf2: '#6cc062', water: '#4fb3e8', flower: ['#ffd43b', '#ffffff', '#ff8fab'] },
    buildings: [{ kind: 'barn', x: 24, y: 3, w: 6, h: 5, label: '' }, { kind: 'house', x: 8, y: 4, w: 5, h: 4 }, { kind: 'mart', x: 3, y: 9, w: 4, h: 3, label: 'BUBBLES' }],
    fields: [[5, 15, 9, 8], [22, 16, 9, 8]], grass: 5, trees: 6, rocks: 2,
    npcs: [
      { id: 'fern', look: 'fern', x: 12, y: 10, name: 'Farmer Fern' },
      { id: 'hay', look: 'hay', x: 21, y: 12, name: 'Grandpa Hay' },
      { id: 'bigmoo', guardian: { set: 'farm', sp: 'cow' }, x: 27, y: 9, name: 'Big Moo', idle: ['Big Moo is dancing a happy hoof-stomp 🐮💃'] },
      { id: 'shop4', look: 'shop', x: 7, y: 12, name: 'Bubble Shop', shop: true },
    ],
    items: [
      { id: 'esc1', group: 'escapee', x: 3, y: 14, set: 'farm' }, { id: 'esc2', group: 'escapee', x: 17, y: 21, set: 'farm' }, { id: 'esc3', group: 'escapee', x: 32, y: 11, set: 'farm' },
      { id: 'esc4', group: 'escapee', x: 19, y: 25, set: 'farm' }, { id: 'esc5', group: 'escapee', x: 9, y: 25, set: 'farm' },
    ],
    stop: [18, 11],
  },
  { key: 'carnival', ch: 5, name: 'Snack Shack Boardwalk', town: 'The Boardwalk', title: 'Carnival of Crumbs', emoji: '🎡',
    ground: 'GRASS', wall: 'TREE', sets: ['snack'], hub: [18, 14], blocker: 'gate', plaza: 7,
    pal: { g1: '#a8e07a', g2: '#98d26a', tall: '#e64980', tall2: '#f783ac', path: '#ffe3ef', path2: '#ffffff', leaf: '#43a65a', leaf2: '#69c46e', water: '#4fb3e8', flower: ['#ffd43b', '#4dabf7', '#ff6b6b', '#b197fc'] },
    buildings: [{ kind: 'bigtent', x: 6, y: 2, w: 7, h: 5, label: '' }, { kind: 'ferris', x: 26, y: 2, w: 6, h: 7 }, { kind: 'booth', x: 3, y: 8, w: 4, h: 3, label: 'TOSS', color: '#ff6b6b' },
      { kind: 'booth', x: 3, y: 19, w: 4, h: 3, label: 'MEMO', color: '#4dabf7' }, { kind: 'booth', x: 27, y: 18, w: 4, h: 3, label: 'QUIZ', color: '#845ef7' }, { kind: 'mart', x: 21, y: 21, w: 4, h: 3, label: 'BUBBLES' }],
    grass: 4, trees: 4, rocks: 1,
    npcs: [
      { id: 'ruby', look: 'ruby', x: 10, y: 8, name: 'Ringmaster Ruby' },
      { id: 'gus', look: 'gus', x: 7, y: 11, name: 'Gus · Ring Toss', side: { id: 'gus', ask: ['Psst, Ranger! Catch 3 Snack Shack squishies 🍦 and I’ll give you 8 bubbles!'], set: 'snack', n: 3, give: { bubbles: 8 }, thanks: ['A snack-tastic catch! Here are 8 bubbles 🎯'], after: ['Step right up, step right up!'] } },
      { id: 'mimi', look: 'mimi', x: 7, y: 22, name: 'Mimi · Memory Booth' },
      { id: 'quizzy', look: 'quizzy', x: 31, y: 22, name: 'Quizzy · Squish Quiz' },
      { id: 'nibs5', look: 'nibs', x: 27, y: 10, name: 'Nibs', crumb: true, when: (p) => p.ch === 5 && p.step >= 4 },
      { id: 'nobs5', look: 'nobs', x: 29, y: 10, name: 'Nobs', crumb: true, when: (p) => p.ch === 5 && p.step >= 4 },
      { id: 'shop5', look: 'shop', x: 26, y: 24, name: 'Bubble Shop', shop: true },
    ],
    stop: [15, 12],
  },
  { key: 'peaks', ch: 6, name: 'Cloud Peaks', town: 'Skyview', title: 'Above the Clouds', emoji: '☁️',
    ground: 'GRASS', wall: 'ROCK', sets: ['dream'], hub: [24, 14], blocker: 'fog', chasm: [13, 17],
    pal: { g1: '#cdebc4', g2: '#bfe2b6', tall: '#8fc7e8', tall2: '#b6dcf2', path: '#f1e7d0', path2: '#e2d6b8', leaf: '#6fbf8a', leaf2: '#97d8a8', water: '#7cc6f0', flower: ['#ffffff', '#ffc9de', '#d0bfff'] },
    buildings: [{ kind: 'observatory', x: 24, y: 2, w: 5, h: 4, label: '' }],
    grass: 6, trees: 4, rocks: 7,
    npcs: [
      { id: 'rocky', look: 'rocky', x: 29, y: 15, name: 'Climber Rocky' },
      { id: 'owl', look: 'owl', x: 27, y: 7, name: 'Sage Owlbert' },
      { id: 'bell', bell: true, x: 20, y: 12, name: 'Cloud Bell' },
      { id: 'wisp', guardian: { set: 'dream', sp: 'star' }, x: 8, y: 8, name: 'Star Wisp', idle: ['The Star Wisp twinkles and zips in happy circles ✨'] },
      { id: 'skye', look: 'skye', x: 6, y: 16, name: 'Skye', side: { id: 'skye', ask: ['Have you seen the Dreamland squishies 🌈 up here? Catch 3 and I’ll share my bubbles!'], set: 'dream', n: 3, give: { bubbles: 10 }, thanks: ['They’re so dreamy! Here, 10 bubbles ✨'], after: ['The clouds remember you now. Walk across anytime! ☁️'] } },
    ],
    stop: [23, 17],
  },
  { key: 'hollow', ch: 7, name: 'Spooky Hollow', town: 'Lantern Lane', title: 'Lanterns of Spooky Hollow', emoji: '🏮',
    ground: 'GRASS', wall: 'DEAD', sets: ['niddo'], seasonSet: 'spooky', hub: [16, 14], blocker: 'icewall', dark: true,
    pal: { g1: '#4b3d66', g2: '#433759', tall: '#7b5ea8', tall2: '#9479c2', path: '#8a7a9e', path2: '#7a6a8e', leaf: '#3d2f52', leaf2: '#5a4775', water: '#3b5bdb', flower: ['#b197fc', '#63e6be', '#ffd43b'] },
    buildings: [{ kind: 'manor', x: 13, y: 3, w: 7, h: 5, label: '' }],
    graveyard: [22, 16, 10, 9], grass: 6, trees: 8, rocks: 2,
    npcs: [
      { id: 'mira', look: 'mira', x: 18, y: 9, name: 'Mira' },
      { id: 'grim', look: 'grim', x: 21, y: 14, name: 'Gravedigger Grim' },
      { id: 'boo', guardian: { set: 'spooky', sp: 'ghost', ghost: true }, x: 27, y: 17, name: 'Boo', idle: ['Boo giggles: “Wanna play again sometime?” 👻'] },
    ],
    items: [{ id: 'lan1', group: 'lantern', x: 5, y: 6, lantern: true }, { id: 'lan2', group: 'lantern', x: 30, y: 6, lantern: true }, { id: 'lan3', group: 'lantern', x: 5, y: 22, lantern: true }, { id: 'lan4', group: 'lantern', x: 15, y: 24, lantern: true }],
    stop: [12, 14],
  },
  { key: 'frost', ch: 8, name: 'Frostfall Summit', town: 'Crumble Castle', title: 'Crumble Castle', emoji: '🏰',
    ground: 'SNOW', wall: 'PINE', sets: ['dream', 'ocean'], seasonSet: 'winter', hub: [30, 14], blocker: null, ice: [9, 7, 17, 15],
    pal: { g1: '#eef6fb', g2: '#e3eef6', tall: '#a9d3ea', tall2: '#c8e4f3', path: '#d8e6ef', path2: '#c9d9e4', leaf: '#2f6f5f', leaf2: '#3f8a74', water: '#74c0fc', flower: ['#a5d8ff', '#ffffff', '#d0bfff'] },
    buildings: [{ kind: 'castle', x: 1, y: 8, w: 6, h: 6, label: '' }, { kind: 'mart', x: 28, y: 19, w: 4, h: 3, label: 'BUBBLES' }],
    grass: 4, trees: 6, rocks: 3,
    npcs: [
      { id: 'penny', look: 'penny', x: 30, y: 12, name: 'Penny' },
      { id: 'yuki', look: 'yuki', x: 7, y: 16, name: 'Yeti Yuki' },
      { id: 'baron', look: 'baron', x: 4, y: 15, name: 'Baron Von Crumb', crumb: true },
      { id: 'mallow8', look: 'mallow', x: 6, y: 17, name: 'Professor Mallow', when: (p) => p.ch > 8 || (p.ch === 8 && p.step >= 4) },
      { id: 'shop8', look: 'shop', x: 33, y: 22, name: 'Bubble Shop', shop: true },
    ],
    zones: [{ id: 'castleGate', x: 5, y: 13, w: 3, h: 3 }],
    stop: [31, 16],
  },
];

/* ---------- Story: steps per chapter ----------
   talk: npc id · catch: n wild catches · collect: item group · special: object id (walk into it)
   reach: zone id · game: mini-game config · give: rewards · set: flag */
const Q = (q, a, ...wrong) => ({ q, a, wrong });
const STORY = {
  1: [
    { goal: 'Talk to Professor Mallow at the Lab', talk: 'mallow', give: { bubbles: 10 }, lines: [
      ['mallow', 'Oh! You must be {you}! Welcome to Puffington — I’m Professor Mallow.'],
      ['mallow', 'Terrible news: all eight Squish Stars have vanished! Without them the squishies got scared and ran off into the wild grass.'],
      ['mallow', 'The Great Squish Festival is coming and we need a Squish Ranger… and I think that’s YOU!'],
      ['mallow', 'Take these Squish Bubbles 🫧. Walk through tall grass — when a squishy pops out, toss a bubble at just the right moment!']] },
    { goal: 'Catch a wild squishy in the tall grass 🌿', catch: 1 },
    { goal: 'Show Professor Mallow your catch', talk: 'mallow', lines: [
      ['mallow', 'You did it! What a natural!'],
      ['mallow', 'Oh dear… my penguin Pip got so scared he waddled off. He loves the flowers south of the pond. Could you find him?']] },
    { goal: 'Find Pip south of the pond 🐧', special: 'pip', game: { type: 'ring', title: 'Pip is wiggly!', sub: 'Toss when the ring is green!', need: 1, of: 3, zone: 0.34, speed: 1.6 }, lose: [['pip', 'Pip wiggles out of the bubble! Try again — gently! 🐧']], win: [['pip', 'Pip snuggles into your bubble and peeps happily! 🐧💕']] },
    { goal: 'Bring Pip back to Professor Mallow', talk: 'mallow', lines: [
      ['mallow', 'Pip! You found him! Thank you, {you}!'],
      ['mallow', 'But look — cookie crumbs everywhere. Only the Crumb Crew leaves crumbs like that…'],
      ['mallow', 'I bet that rascal Nibs is up to no good by the big oaks to the east.']] },
    { goal: 'Stop Nibs of the Crumb Crew', talk: 'nibs', game: { type: 'ring', title: 'Bubble Showdown', sub: 'Pop 2 of 3 bubbles!', need: 2, of: 3, zone: 0.3, speed: 1.5 }, lines: [
      ['nibs', 'Heh heh! I’m Nibs of the Crumb Crew! The Baron says squishies should be CRUNCHY!'],
      ['nibs', 'This shiny Meadow Star is mine now. Want it? Beat me at a Bubble Showdown!']],
      win: [['nibs', 'Aww, CRUMBS! Fine, take your star…'], ['nibs', 'Heh — the Crew hid the other seven all over Squishvale! Good luck finding ’em!']], lose: [['nibs', 'Ha! Too slow! Come back and try again, Ranger!']] },
    { goal: 'Bring the Meadow Star to Mayor Puddle', talk: 'puddle', lines: [
      ['puddle', 'The Meadow Star! Puffington is saved!'],
      ['puddle', 'By the power of… well, me — I name you an official Squish Ranger! 🎖️'],
      ['puddle', 'And listen — the Sleepy Puffball on the east road woke up from all the cheering. The way to Sprinkle Shore is open!']] },
  ],
  2: [
    { goal: 'Talk to Captain Coral by the lighthouse', talk: 'coral', lines: [
      ['coral', 'Ahoy, Ranger! The lighthouse went dark last night — the boats can’t find the harbor!'],
      ['coral', 'That rascal Nobs from the Crumb Crew locked the door and tossed the three Shell Keys all over the beach.'],
      ['coral', 'Find all three Shell Keys and bring ’em here!']] },
    { goal: 'Find the Shell Keys 🐚', collect: 'shell', n: 3 },
    { goal: 'Bring the Shell Keys to Captain Coral', talk: 'coral', lines: [
      ['coral', 'All three! Let’s open ’er up…'],
      ['coral', 'Uh-oh. Something big and wobbly is blocking the door. It’s the Tidal Jelly — and it’s all tangled up and upset!']] },
    { goal: 'Calm the Tidal Jelly with its wave song', talk: 'jelly', game: { type: 'simon', title: 'Wave Song', sub: 'Copy the jelly’s song!', len: 5, icons: ['🐚', '🌊', '⭐', '🐠'] }, lines: [
      ['jelly', '~ blub blub ~ The Tidal Jelly flashes colors at you… it’s singing! Copy its song!']],
      win: [['jelly', 'The Tidal Jelly glows a happy blue and floats aside… It was guarding the Shore Star all along! 💙']], joins: 'jelly', lose: [['jelly', 'The jelly wobbles… listen closely and try again!']] },
    { goal: 'Tell Captain Coral the good news', talk: 'coral', lines: [
      ['coral', 'Look at ’er shine! The boats are sailing home!'],
      ['coral', 'Here’s the Shore Star, Ranger. And Kai rolled the driftwood log off the trail to Sugarplum Woods!']] },
  ],
  3: [
    { goal: 'Visit Baker Bun’s bakery', talk: 'bun', lines: [
      ['bun', 'Oh sprinkles, a Ranger! The Crumb Crew gobbled every ingredient in my bakery!'],
      ['bun', 'I promised the Festival a giant sugarplum cake… I need 5 Sugarberries from the bushes around the woods.']] },
    { goal: 'Pick Sugarberries 🫐', collect: 'berry', n: 5 },
    { goal: 'Bring the berries to Baker Bun', talk: 'bun', lines: [
      ['bun', 'Perfect! Mmm, smell that!'],
      ['bun', 'Now, the Woods Star… Old Snorebear grabbed it to use as a pillow. But the Crumb Crew’s racket woke him up and he’s SO grumpy.'],
      ['bun', 'Ranger Moss knows how to calm him. Find Moss in the east woods!']] },
    { goal: 'Ask Ranger Moss about Snorebear', talk: 'moss', lines: [
      ['moss', 'Snorebear? He only falls back asleep to the Lullaby of the Woods.'],
      ['moss', 'Tap along when the stars twinkle — nice and steady. His hollow is in the southwest woods.']] },
    { goal: 'Sing Snorebear to sleep', talk: 'snorebear', game: { type: 'rhythm', title: 'Lullaby of the Woods', sub: 'Tap when the star twinkles!', beats: 8, bpm: 70 }, lines: [
      ['snorebear', 'GRRRUMBLE… Snorebear is wide awake and very grumpy. Time for the lullaby…']],
      win: [['snorebear', 'Snorebear yawns… rolls over… and the Woods Star tumbles out from under his head. Zzz… 😴']], joins: 'snorebear', lose: [['snorebear', 'Snorebear is still grumbling. Try the lullaby again, nice and steady!']] },
    { goal: 'Bring the Woods Star to Baker Bun', talk: 'bun', lines: [
      ['bun', 'You did it! Here — a slice of sugarplum cake and the Woods Star!'],
      ['bun', 'The cake smelled SO good the Crumb Crew ate their own cookie wall to get a piece. The road to Barnaby Farm is clear!']] },
  ],
  4: [
    { goal: 'Talk to Farmer Fern', talk: 'fern', lines: [
      ['fern', 'Howdy, Ranger! Nibs snuck in last night and opened every pen. Five of my farm squishies are loose!'],
      ['fern', 'They’re hiding all over the farm. Round ’em up — gently!']] },
    { goal: 'Round up the runaway farm squishies', collect: 'escapee', n: 5 },
    { goal: 'Tell Farmer Fern they’re safe', talk: 'fern', lines: [
      ['fern', 'All five, safe and sound! You’re a natural farmhand.'],
      ['fern', 'But Big Moo is hogging the Farm Star in the barn and won’t budge. Grandpa Hay knows her favorite song.']] },
    { goal: 'Ask Grandpa Hay about Big Moo', talk: 'hay', lines: [
      ['hay', 'Big Moo? She loves the Moo-sic Box! Copy the tune and she’ll dance right outta that barn.']] },
    { goal: 'Play the Moo-sic Box for Big Moo', talk: 'bigmoo', game: { type: 'simon', title: 'Moo-sic Box', sub: 'Copy the barnyard tune!', len: 6, icons: ['🐮', '🐷', '🐔', '🐑'] }, lines: [
      ['bigmoo', 'MOOO. Big Moo is sitting right on top of the Farm Star. She looks bored…']],
      win: [['bigmoo', 'Big Moo does a happy hoof-stomp dance and drops the Farm Star! 🐮💃']], joins: 'bigmoo', lose: [['bigmoo', 'Moo? That wasn’t quite the tune. Try again!']] },
    { goal: 'Bring the Farm Star to Farmer Fern', talk: 'fern', lines: [
      ['fern', 'Yee-haw! The Farm Star!'],
      ['fern', 'Grandpa Hay moved the hay bales off the south road. The Snack Shack Boardwalk is that way!']] },
  ],
  5: [
    { goal: 'Meet Ringmaster Ruby at the big tent', talk: 'ruby', lines: [
      ['ruby', 'Welcome to the Snack Shack Boardwalk! …Or what’s left of it. The Crumb twins rigged every booth!'],
      ['ruby', 'The Boardwalk Star is our grand prize. Win my three booths and it’s yours!']] },
    { goal: 'Win the Ring Toss booth', talk: 'gus', game: { type: 'ring', title: 'Ring Toss', sub: 'Land 3 of 5!', need: 3, of: 5, zone: 0.28, speed: 1.4 }, lines: [['gus', 'Step right up! Land 3 rings out of 5 and you win!']], win: [['gus', 'WINNER! You’ve got the touch!']], lose: [['gus', 'So close! Have another go!']] },
    { goal: 'Win the Memory booth', talk: 'mimi', game: { type: 'simon', title: 'Snack Memory', sub: 'Remember the snacks!', len: 5, icons: ['🍦', '🍩', '🧋', '🍪'] }, lines: [['mimi', 'Watch the snacks light up, then tap them in the same order!']], win: [['mimi', 'Wow, what a memory!']], lose: [['mimi', 'Oops! Try again!']] },
    { goal: 'Win the Squish Quiz booth', talk: 'quizzy', game: { type: 'quiz', title: 'Squish Quiz', qs: [
      Q('What do Rangers toss to catch wild squishies?', 'Squish Bubbles', 'Cookies', 'Socks'),
      Q('Who runs the lab in Puffington?', 'Professor Mallow', 'Captain Coral', 'Baker Bun'),
      Q('What did Baker Bun need from the woods?', 'Sugarberries', 'Snowballs', 'Seashells')] }, lines: [['quizzy', 'Ding ding! Three questions, Ranger. Ready?']], win: [['quizzy', 'Perfect score! You really know your Squishvale!']], lose: [['quizzy', 'Not quite! Want to try again?']] },
    { goal: 'Claim the prize from Ringmaster Ruby', talk: 'ruby', lines: [
      ['ruby', 'Three for three! Here’s your grand prize, the Boardw—'],
      ['nobs5', 'GRAND PRIZE IS OURS! To the Ferris wheel, Nibs!'],
      ['ruby', 'Those crumb-snatchers! After them, Ranger!']] },
    { goal: 'Catch the Crumb twins at the Ferris wheel', talk: 'nobs5', game: { type: 'quiz', title: 'Crumb Quiz', qs: [
      Q('What’s the Crumb Crew’s favorite food?', 'Cookies', 'Broccoli', 'Soup'),
      Q('How many Squish Stars are there?', 'Eight', 'Three', 'A hundred'),
      Q('What lights up Sprinkle Shore at night?', 'The lighthouse', 'A giant squishy', 'Fireflies'),
      Q('Who did you sing a lullaby to?', 'Snorebear', 'Big Moo', 'Pip')] }, lines: [
      ['nobs5', 'You’ll never beat the brains of the Crumb Crew! Answer our SUPER hard quiz!'], ['nibs5', 'Yeah! Super duper hard!']],
      win: [['nibs5', 'Okay, okay, you win! Here’s the star!'], ['nobs5', 'The Baron is gonna be SO crumbly about this. His castle is way up at Frostfall Summit…']], lose: [['nobs5', 'HA! Wrong! Come back when you’re smarter!']] },
    { goal: 'Return the Boardwalk Star to Ruby', talk: 'ruby', lines: [
      ['ruby', 'You got it back! You’re the star of the show, Ranger! ⭐'],
      ['ruby', 'I’ve unlocked the west gate. Cloud Peaks is up that way!']] },
  ],
  6: [
    { goal: 'Talk to Climber Rocky', talk: 'rocky', lines: [
      ['rocky', 'Whoa, careful! The cloud bridge across the Sky Gap blew away in the storm.'],
      ['rocky', 'Only Sage Owlbert can call it back with the Cloud Bell. His observatory is up the north trail.']] },
    { goal: 'Visit Sage Owlbert’s observatory', talk: 'owl', game: { type: 'quiz', title: 'Owlbert’s Riddles', qs: [
      Q('I have keys but can’t open locks. What am I?', 'A piano', 'A door', 'A squishy'),
      Q('What gets wetter the more it dries?', 'A towel', 'A cloud', 'A fish'),
      Q('What has a face and two hands but no arms or legs?', 'A clock', 'A snowman', 'A star')] }, lines: [
      ['owl', 'Hoo-hoo! A Ranger! The Cloud Bell answers only to a clever mind.'], ['owl', 'Solve my three riddles!']],
      win: [['owl', 'Hoo! Splendid! Ring the Cloud Bell at the edge of the Sky Gap.']], lose: [['owl', 'Hmm, hoo. Think again, young Ranger!']] },
    { goal: 'Ring the Cloud Bell at the Sky Gap 🔔', talk: 'bell', set: 'clouds', lines: [['bell', 'DONG… DONG… Fluffy clouds drift in and puff up into a bridge across the gap! ☁️']] },
    { goal: 'Catch the Star Wisp across the clouds', talk: 'wisp', game: { type: 'ring', title: 'Catch the Star Wisp!', sub: 'It’s super fast — 2 of 5!', need: 2, of: 5, zone: 0.22, speed: 1.2 }, lines: [['wisp', 'A Star Wisp is zooming around the Peaks Star — way too fast to see! Quick, a bubble!']],
      win: [['wisp', 'Got it! The Star Wisp twinkles hello and hands you the Peaks Star ✨']], joins: 'wisp', lose: [['wisp', 'Zip! It got away. Try again!']] },
    { goal: 'Say hi to Skye by the west trail', talk: 'skye', lines: [
      ['skye', 'You crossed the Sky Gap! That was amazing!'],
      ['skye', 'Look — the fog toward Spooky Hollow is lifting. Be brave, Ranger!']] },
  ],
  7: [
    { goal: 'Find Mira the lantern keeper', talk: 'mira', lines: [
      ['mira', 'Shh… who’s there? Oh, a Ranger! Thank goodness.'],
      ['mira', 'The Crumb Crew blew out all four Hollow lanterns. It’s so dark the squishies are afraid to come out.'],
      ['mira', 'Can you light them again? Look for the four cold lantern posts around the edges of the Hollow — walk up to one to light it.']] },
    { goal: 'Light the Hollow lanterns 🏮', collect: 'lantern', n: 4 },
    { goal: 'Tell Mira the lanterns are lit', talk: 'mira', lines: [
      ['mira', 'Light! Beautiful light!'],
      ['mira', 'Now, the Hollow Star… Boo has it. Boo loves hide-and-seek and only gives treasure to friends who find them.'],
      ['mira', 'Gravedigger Grim knows all of Boo’s hiding spots.']] },
    { goal: 'Ask Gravedigger Grim about Boo', talk: 'grim', lines: [
      ['grim', 'Hee hee! Boo always hides behind my gravestones. Watch closely… then point!']] },
    { goal: 'Play hide-and-seek with Boo 👻', talk: 'boo', game: { type: 'hide', title: 'Hide & Seek', sub: 'Find Boo 2 out of 3 times!', rounds: 3, need: 2 }, lines: [['boo', 'Boo! Hee hee! Find me and I’ll give you something shiny!']],
      win: [['boo', '“You found me!” Boo giggles and gives you the Hollow Star 👻⭐']], joins: 'boo', lose: [['boo', 'Hee hee, you can’t find me! Play again?']] },
    { goal: 'Bring the Hollow Star to Mira', talk: 'mira', lines: [
      ['mira', 'The Hollow Star! The squishies are coming out to play again!'],
      ['mira', 'And look — the ice wall to Frostfall Summit is melting in the lantern light. The Baron’s castle is near…']] },
  ],
  8: [
    { goal: 'Talk to Penny at the foot of the summit', talk: 'penny', lines: [
      ['penny', 'Brrr! Hi, Ranger! Crumble Castle is past the Slippy Slopes.'],
      ['penny', 'On ice you slide until you bump into something, so plan your path! If you get stuck, tap ↩️ to start over.']] },
    { goal: 'Cross the Slippy Slopes ⛸️', reach: 'castleGate' },
    { goal: 'Talk to Yeti Yuki at the castle', talk: 'yuki', give: { bubbles: 5 }, lines: [
      ['yuki', 'RAWR! …Oh, sorry. That’s just how yetis say hello.'],
      ['yuki', 'The Baron is guarding the castle door with the very last star. Here — warm cocoa and 5 bubbles. For courage!']] },
    { goal: 'Face Baron Von Crumb', talk: 'baron', game: { type: 'boss', title: 'The Baron’s Three Trials' }, lines: [
      ['baron', 'So! The little Ranger came all this way. Squishies should be CRUNCHY, like my perfect cookies!'],
      ['baron', 'Nobody ever comes to my cookie parties. Everyone’s too busy squishing!'],
      ['baron', 'Beat my three trials — Memory, Rhythm and the Big Toss — and maybe… just maybe… I’ll listen.']],
      win: [['baron', '…You’re really good. And you were kind to everyone the whole way here.'], ['baron', 'I guess I just wanted someone to share cookies with. Here — the Summit Star, the very last one. I’m sorry.']], lose: [['baron', 'Mwa-ha-ha! Not good enough! …Try again? (You keep the trials you already won.)']] },
    { goal: 'Celebrate with Professor Mallow', talk: 'mallow8', lines: [
      ['mallow8', '{you}! You did it! All eight Squish Stars are home and every squishy is soft and happy again!'],
      ['mallow8', 'And Baron — the Festival needs a cookie stand. Will you come?'],
      ['baron', '…Really? I’ll bring my BEST batch!'],
      ['mallow8', 'Then let the Great Squish Festival BEGIN! 🎉']] },
  ],
};

// What each townsperson says once their part is done, or before it starts. (p = the player's progress)
const atStep = (p, ch, ...steps) => p.ch === ch && (!steps.length || steps.includes(p.step));
const NPC_IDLE = {
  mallow: (p) => p.ch > 8 ? ['{you}, our Star Ranger! 🌟 Have you filled your Squishvale Guide yet? Tap ☰ then 📖 Guide!']
    : atStep(p, 1, 3) ? ['Pip loves the flowers south of the pond. Please find him! 🐧']
    : atStep(p, 1, 5) ? ['Nibs is by the big oaks to the east. You can do it! 🫧']
    : p.ch === 1 ? ['Remember: toss the bubble when the ring turns green! 🫧'] : ['How’s the Squish Star hunt going, {you}? You’re doing amazing!'],
  puddle: (p) => atStep(p, 1, 0) ? ['Ahem! The Mayor is very busy being worried. Talk to Professor Mallow!']
    : p.ch === 1 ? ['Ahem! Any luck with that missing Meadow Star? Puffington is counting on you!']
    : p.ch > 8 ? ['Three cheers for our Star Ranger! Hip hip… SQUISH! 🎖️'] : ['Puffington will never forget you, Ranger! 🎖️'],
  coral: (p) => atStep(p, 2, 1) ? ['Three Shell Keys, scattered all over the beach. Keep looking! 🐚']
    : atStep(p, 2, 3) ? ['That jelly’s all in a tangle. Sandy knows all about jellies — ask her!']
    : p.ch > 8 ? ['The lighthouse has never shone brighter. Ahoy, Star Ranger! ⚓'] : ['Steady as she goes, Ranger! ⚓'],
  bun: (p) => atStep(p, 3, 1) ? ['I need 5 Sugarberries. Look for the bushes all around the woods! 🫐']
    : atStep(p, 3, 3) ? ['Ranger Moss is in the east woods. He knows how to calm Snorebear!']
    : atStep(p, 3, 4) ? ['Snorebear’s hollow is in the southwest woods. Sing softly! 😴']
    : p.ch > 8 ? ['I baked a giant cake for the Festival! The Baron helped with the sprinkles 🍰'] : ['Fresh sugarplum cake, still warm! 🍰'],
  moss: (p) => atStep(p, 3, 4) ? ['Nice and steady, like a heartbeat. His hollow is in the southwest woods 🎵'] : ['Shh… listen to the woods. Squishies love the quiet spots.'],
  fern: (p) => atStep(p, 4, 1) ? ['Five runaways are hiding all over the farm. Walk up to one and pop a bubble — gently! 🐷']
    : atStep(p, 4, 3) ? ['Grandpa Hay knows Big Moo’s favorite song. Go ask him! 🎵']
    : atStep(p, 4, 4) ? ['Big Moo is by the barn door. Play her that tune!'] : ['The pens are shut tight now. Thanks, partner! 🤠'],
  hay: (p) => atStep(p, 4, 0, 1, 2) ? ['Hee hee! Those runaway squishies sure are fast. Help Farmer Fern round ’em up!']
    : atStep(p, 4, 4) ? ['Copy the Moo-sic Box tune and Big Moo will dance right out of that barn! 🐮'] : ['Big Moo’s been dancing all week. Hee hee!'],
  ruby: (p) => atStep(p, 5, 1, 2, 3) ? ['Win all three booths — Ring Toss, then Memory, then the Squish Quiz! 🎪']
    : atStep(p, 5, 4) ? ['Those crumb-snatchers ran to the Ferris wheel! After them!']
    : p.ch > 8 ? ['Tonight’s show: the Great Squish Festival parade! Front-row seat for you ⭐'] : ['The show must go on! 🎪'],
  gus: () => ['Step right up, step right up!'],
  mimi: (p) => atStep(p, 5, 0, 1) ? ['My booth opens after you win Gus’s Ring Toss! 🎯'] : ['Memory is like a muscle — keep it squishy!'],
  quizzy: (p) => atStep(p, 5, 0, 1, 2) ? ['Quiz time comes last! Win the Ring Toss and Memory booths first 🧠'] : ['Did you know squishies hum when they’re happy?'],
  rocky: (p) => atStep(p, 6, 1) ? ['Sage Owlbert’s observatory is up the north trail!'] : ['The view from up here is the best in Squishvale! 🏔️'],
  owl: (p) => atStep(p, 6, 2) ? ['Hoo! Ring the Cloud Bell at the edge of the Sky Gap.'] : ['Hoo-hoo. A clever mind is a squishy mind.'],
  skye: () => ['The clouds remember you now. Walk across anytime! ☁️'],
  mira: (p) => atStep(p, 7, 1) ? ['Look for the four cold lantern posts around the edges of the Hollow. Walk up to one to light it! 🏮']
    : atStep(p, 7, 3) ? ['Gravedigger Grim knows all of Boo’s hiding spots. He’s near the graveyard!']
    : atStep(p, 7, 4) ? ['Boo is hiding in the graveyard. Watch closely! 👻'] : ['The lanterns will glow forever now. Thank you 🏮'],
  grim: (p) => atStep(p, 7, 0, 1, 2) ? ['Hee hee! It’s too dark for visitors. Help Mira light the lanterns!']
    : atStep(p, 7, 4) ? ['Boo hides behind my gravestones. Watch closely… then point!'] : ['Spooky? Nah. Cozy! Hee hee.'],
  penny: (p) => atStep(p, 8, 1) ? ['On ice you slide until you bump into something. Tap ↩️ to start over! ⛸️'] : ['Wheee! I love sliding! ⛸️'],
  yuki: (p) => atStep(p, 8, 0, 1) ? ['RAWR! …Oh, sorry. That’s just how yetis say hello.']
    : atStep(p, 8, 3) ? ['The Baron is right by the castle door. Be brave! RAWR!'] : ['Want more cocoa? RAWR! (That means yes.)'],
  baron: (p) => p.ch > 8 || atStep(p, 8, 4) ? ['Cookie? They’re… a little squishy now. And I love them! 🍪'] : ['Hmph! Who goes there?'],
  mallow8: () => ['The Festival is the best ever! 🎉'],
  bell: (p) => atStep(p, 6, 0, 1) ? ['A big golden bell. It won’t ring… maybe Sage Owlbert knows how. 🔔'] : ['A big golden bell. It rings with a soft DONG… 🔔'],
  nibs: () => ['Heh heh! Can’t catch me!'],
  nibs5: (p) => atStep(p, 5, 4) ? ['Don’t look at me! Nobs has the star — he’s the brains. Heh.'] : ['Aww, crumbs. The Baron’s gonna be SO crumbly…'],
  nobs5: (p) => atStep(p, 5, 4) ? ['The Crumb Crew rules!'] : ['Fine, fine. Enjoy your shiny star…'],
};
// One line per finished chapter, for the ☰ Story tab
const STORY_RECAP = {
  1: 'Rescued Pip and beat Nibs in a Bubble Showdown.',
  2: 'Found 3 Shell Keys and sang with the Tidal Jelly.',
  3: 'Picked Sugarberries and sang Snorebear to sleep.',
  4: 'Rounded up 5 runaways and danced with Big Moo.',
  5: 'Won every booth and out-quizzed the Crumb twins.',
  6: 'Solved Owlbert’s riddles and caught the Star Wisp.',
  7: 'Lit 4 lanterns and found Boo at hide-and-seek.',
  8: 'Faced the Baron — and made a new friend.',
};
const BLOCKER_TEXT = {
  puffball: 'A giant Sleepy Puffball is snoring on the road. 😴 Help Puffington first!',
  log: 'A huge driftwood log blocks the trail. Help Captain Coral first!',
  crumbs: 'A wall of giant cookies blocks the way! The Crumb Crew built it… Help Baker Bun first!',
  hay: 'Stacks of hay bales block the south road. Help Farmer Fern first!',
  gate: 'The carnival gate is locked tight. Win back the Boardwalk Star first!',
  fog: 'Thick fog hides the trail. Something on Cloud Peaks needs your help first.',
  icewall: 'A wall of ice blocks the path west. Bring light back to the Hollow first!',
};
