/* Windsong Vale 🎵 — a family adventure drawn entirely in coloured letters (the Letter World engine).
   Overworld (village, meadow, lake, forest shrine, north cliff) + the Whispering Hollow dungeon and the Ember Golem.
   The Wind Flute plays three songs: Sun (day ↔ night), Doors (opens sealed stone doors), Rain (puts out fire).
   Shared family world: doors anyone opens stay open for everyone, notes you leave are read by the others, and you
   can see where everyone last stood. Progress lives in the family data (state.vale) and syncs when you go back to
   the app. All names, songs and art are original. Standalone page, loaded from the Play tab. */
'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('c');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.body.insertAdjacentHTML('beforeend', '<div class="err">This phone’s browser can’t draw Windsong Vale (it needs WebGL 2).<br><br><a href="./#play" style="color:#9fe">‹ Back to the app</a></div>'); return; }

  /* ================= Tiles ================= */
  const T = { VOID: 0, GRASS: 1, WATER: 2, SAND: 3, PATH: 4, TREE: 5, CLIFF: 6, ROCK: 7, HOUSE: 8, ROOF: 9, HDOOR: 10, FLOOR: 11, WALL: 12, DOOR: 13, SONGDOOR: 14, LOCKDOOR: 15, BOSSDOOR: 16, FIRE: 17, PLATE: 18, STAIRS: 19, SHRINE: 20, TABLET: 21, TORCH: 22, CAVE: 24, PILLAR: 25 };
  const SOLID = new Set([T.VOID, T.WATER, T.TREE, T.CLIFF, T.ROCK, T.HOUSE, T.ROOF, T.HDOOR, T.WALL, T.DOOR, T.SONGDOOR, T.LOCKDOOR, T.BOSSDOOR, T.FIRE, T.TABLET, T.TORCH, T.PILLAR]);
  const MW = 160, MH = 72;               // map texture: overworld at x 0..95, dungeon at x 100..
  const OW = 96, DX = 100, RW = 15, RH = 11;
  const map = new Uint8Array(MW * MH * 4);
  const hash = (x) => { x >>>= 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16; return x >>> 0; };
  const h01 = (x, y) => (hash((Math.imul((x + 32768) >>> 0, 1597334677) ^ hash((y + 32768) >>> 0)) >>> 0) & 0xffffff) / 16777216;
  const sstep = (t) => t * t * (3 - 2 * t);
  const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sstep(x - ix), fy = sstep(y - iy); const a = h01(ix, iy), b = h01(ix + 1, iy), c = h01(ix, iy + 1), d = h01(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const tget = (x, y) => (inMap(x, y) ? map[(y * MW + x) * 4] : T.VOID);
  const tvar = (x, y) => (inMap(x, y) ? map[(y * MW + x) * 4 + 1] : 0);
  function tset(x, y, t, v) { if (!inMap(x, y)) return; const i = (y * MW + x) * 4; map[i] = t; map[i + 1] = v ?? (h01(x, y) * 255) | 0; dirty = true; }
  let dirty = true;

  /* ---------- Overworld: Windsong Vale ---------- */
  const doorAt = {};   // "x,y" -> { flag, kind, open: tile }
  const spots = {};    // named places
  function buildOverworld() {
    for (let y = 0; y < MH; y++) for (let x = 0; x < OW; x++) tset(x, y, T.GRASS);
    // cliffs around the edge
    for (let y = 0; y < MH; y++) for (let x = 0; x < OW; x++) {
      const e = Math.min(x, y, OW - 1 - x, MH - 1 - y);
      if (e < 2 + vnoise(x * 0.18, y * 0.18) * 3.2) tset(x, y, T.CLIFF);
    }
    // the north cliff band with the sealed door
    for (let x = 34; x < 62; x++) { const top = 61 + Math.round(vnoise(x * 0.3, 7) * 2); for (let y = top; y < MH; y++) tset(x, y, T.CLIFF); }
    // lake + sand
    for (let y = 6; y < 40; y++) for (let x = 46; x < 90; x++) {
      const d = Math.hypot((x - 68) / 13, (y - 20) / 8.5) + (vnoise(x * 0.25, y * 0.25) - 0.5) * 0.35;
      if (d < 1) tset(x, y, T.WATER); else if (d < 1.16 && tget(x, y) === T.GRASS) tset(x, y, T.SAND);
    }
    // forest (east) with the shrine clearing
    for (let y = 40; y < 64; y++) for (let x = 56; x < 92; x++) {
      if (tget(x, y) !== T.GRASS) continue;
      if (Math.hypot(x - 76, y - 53) < 6) continue;
      if (vnoise(x * 0.35, y * 0.35) > 0.42 && h01(x, y) < 0.55) tset(x, y, T.TREE);
    }
    for (let y = 49; y <= 57; y++) for (let x = 72; x <= 80; x++) if (Math.hypot(x - 76, y - 53) < 3.6) tset(x, y, T.SHRINE);
    for (const [px, py] of [[73, 50], [79, 50], [73, 56], [79, 56]]) tset(px, py, T.PILLAR);
    tset(76, 55, T.TABLET, 1); spots.shrineTablet = [76, 55];
    // meadow trees and rocks
    for (let y = 4; y < 62; y++) for (let x = 4; x < 92; x++) {
      if (tget(x, y) !== T.GRASS) continue;
      const r = h01(x + 500, y + 500);
      if (r < 0.03) tset(x, y, T.TREE); else if (r < 0.038) tset(x, y, T.ROCK);
    }
    // village (west): plaza + three houses
    for (let y = 38; y < 62; y++) for (let x = 6; x < 34; x++) if (Math.hypot(x - 20, y - 49) < 7.5) tset(x, y, T.PATH);
    const house = (x0, y0) => { // 6 wide, 5 tall: walls (3 rows) + roof (2 rows); door bottom middle
      for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 6; x++) tset(x, y, y >= y0 + 3 ? T.ROOF : T.HOUSE);
      tset(x0 + 2, y0, T.HDOOR); tset(x0 + 3, y0, T.HDOOR);
      for (let x = x0 - 1; x <= x0 + 6; x++) for (let y = y0 - 2; y < y0; y++) if (tget(x, y) !== T.CLIFF) tset(x, y, T.PATH);
    };
    house(9, 52); house(23, 53); house(10, 40);
    spots.elder = [12.5, 49.6]; spots.kid = [26, 47.5]; spots.start = [17, 47];
    // paths
    const path = (pts, w = 1.2) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let k = 0; k <= n; k++) {
          const cx = ax + (bx - ax) * k / n, cy = ay + (by - ay) * k / n;
          for (let y = Math.floor(cy - w); y <= cy + w; y++) for (let x = Math.floor(cx - w); x <= cx + w; x++) {
            if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > w) continue;
            const t = tget(x, y);
            if ([T.GRASS, T.TREE, T.ROCK, T.SAND].includes(t)) tset(x, y, T.PATH);
          }
        }
      }
    };
    path([[26, 46], [38, 40], [44, 46], [48, 56], [48, 61]]);
    path([[38, 40], [52, 34], [58, 32]]);
    path([[44, 46], [58, 50], [70, 53]]);
    // sealed door + cave in the north cliff
    for (let y = 59; y < 66; y++) for (let x = 46; x <= 50; x++) if (tget(x, y) !== T.CLIFF && y >= 59) { /* keep */ }
    for (let y = 61; y < 66; y++) for (let x = 46; x <= 50; x++) tset(x, y, T.CLIFF);
    tset(48, 61, T.SONGDOOR); doorAt['48,61'] = { flag: 'songCliff', kind: 'song', open: T.PATH };
    tset(48, 62, T.CAVE); spots.cave = [48, 62]; spots.caveOut = [48.5, 59.6];
    for (let x = 46; x <= 50; x++) tset(x, 60, T.PATH);
    spots.fisher = [57, 31.3]; spots.sign = [31, 44];
    tset(31, 44, T.PATH);
  }

  /* ---------- Dungeon: the Whispering Hollow (rooms 15×11; row 0 of each string is the north wall) ---------- */
  const ROOMS = {
    A: [0, 0, [
      '#######P#######',
      '#.............#',
      '#.............#',
      '#..T.......T..#',
      '#.............#',
      '#.....b.......S',
      '#.............#',
      '#.........o...#',
      '#..T.......T..#',
      '#......^......#',
      '###############']],
    B: [1, 0, [
      '###############',
      '#.............#',
      '#..p...p...p..#',
      '#.............#',
      '#.............#',
      'D......3......#',
      '#.............#',
      '#..p.......p..#',
      '#.............#',
      '#.............#',
      '###############']],
    D: [0, 1, [
      '###############',
      '#.............#',
      '#..p.......p..#',
      '#....e...e....#',
      '#.............#',
      '#......1......L',
      '#.............#',
      '#....e...e....#',
      '#..p.......p..#',
      '#.............#',
      '#######D#######']],
    E: [1, 1, [
      '###############',
      '#.......F.....#',
      '#..t....F..2..#',
      '#.......F.....#',
      '#.......F.....#',
      'D.......F.....B',
      '#.......F.....#',
      '#.......F.....#',
      '#..p....F..p..#',
      '#.......F.....#',
      '###############']],
    F: [2, 1, [
      '###############',
      '#.............#',
      '#..T.......T..#',
      '#.............#',
      '#.............#',
      'D......X......#',
      '#.............#',
      '#.............#',
      '#..T.......T..#',
      '#.............#',
      '###############']],
  };
  const DOOR_FLAGS = { P: 'plateA', S: 'songA', L: 'lockDE', B: 'bossDoor' };
  const roomOf = (x, y) => { if (x < DX) return null; const cx = Math.floor((x - DX) / RW), cy = Math.floor(y / RH); return Object.keys(ROOMS).find((k) => ROOMS[k][0] === cx && ROOMS[k][1] === cy) || null; };
  const roomBox = (k) => { const [cx, cy] = ROOMS[k]; return { x0: DX + cx * RW, y0: cy * RH, x1: DX + cx * RW + RW, y1: cy * RH + RH }; };
  const dunStart = { blocks: [], pots: [], blobs: [], chests: {}, boss: null };
  function buildDungeon() {
    for (const [k, [cx, cy, rows]] of Object.entries(ROOMS)) {
      rows.forEach((row, r) => [...row].forEach((ch, c) => {
        const x = DX + cx * RW + c, y = cy * RH + (RH - 1 - r);
        let t = T.FLOOR;
        if (ch === '#') t = T.WALL; else if (ch === 'T') t = T.TORCH; else if (ch === 'F') t = T.FIRE; else if (ch === 'o') t = T.PLATE; else if (ch === '^') t = T.STAIRS;
        else if (ch === 't') t = T.TABLET; else if (ch === 'P') t = T.DOOR; else if (ch === 'S') t = T.SONGDOOR; else if (ch === 'L') t = T.LOCKDOOR; else if (ch === 'B') t = T.BOSSDOOR;
        tset(x, y, t, ch === 't' ? 2 : undefined);
        if (DOOR_FLAGS[ch]) doorAt[`${x},${y}`] = { flag: DOOR_FLAGS[ch], kind: { P: 'plate', S: 'song', L: 'lock', B: 'boss' }[ch], open: T.FLOOR };
        if (ch === 'b') dunStart.blocks.push([x, y]);
        if (ch === 'p') dunStart.pots.push([x, y]);
        if (ch === 'e') dunStart.blobs.push([x + 0.5, y + 0.2, k]);
        if ('123'.includes(ch)) dunStart.chests[ch] = [x + 0.5, y + 0.1, k];
        if (ch === 'X') dunStart.boss = [x + 0.5, y, k];
        if (ch === '^') { spots.dunStairs = [x, y]; spots.dunIn = [x + 0.5, y + 1.6]; }
        if (ch === 'o') spots.plate = [x, y];
        if (ch === 't') spots.rainTablet = [x, y];
      }));
    }
  }
  buildOverworld(); buildDungeon();

  /* ================= Family save (lives in the app's data; syncs when you go back) ================= */
  const LS = 'gomezfam:v1';
  const famLoad = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } };
  const FAM = famLoad();
  const members = Array.isArray(FAM.members) ? FAM.members : [];
  const me = FAM.settings?.me || members[0]?.id || 'guest';
  const meM = members.find((m) => m.id === me) || { id: me, name: 'Hero', emoji: '🙂' };
  const nameOf = (id) => members.find((m) => m.id === id)?.name || 'Someone';
  let V = FAM.vale && typeof FAM.vale === 'object' ? FAM.vale : {};
  V.world ||= {}; V.world.open ||= {}; V.heroes ||= {}; V.notes = Array.isArray(V.notes) ? V.notes : [];
  const fresh = () => ({ hearts: 6, max: 6, glints: 0, keys: 0, ember: false, flute: false, songs: [], chests: {}, boss: false, pell: false, talked: {}, pos: null, night: false, at: Date.now() });
  const H = Object.assign(fresh(), V.heroes[me] || {});
  H.chests ||= {}; H.songs = Array.isArray(H.songs) ? H.songs : []; H.talked ||= {};
  function save() {
    H.at = Date.now();
    H.pos = { x: +P.x.toFixed(2), y: +P.y.toFixed(2) };
    try {
      const S = famLoad();
      const SV = S.vale && typeof S.vale === 'object' ? S.vale : {};
      SV.world ||= {}; SV.world.open = { ...(SV.world.open || {}), ...V.world.open };
      SV.heroes = { ...(SV.heroes || {}), [me]: JSON.parse(JSON.stringify(H)) };
      const ids = new Set((SV.notes || []).map((n) => n.id));
      SV.notes = [...(SV.notes || []).filter((n) => !(n.by === me && !V.notes.some((m) => m.id === n.id))), ...V.notes.filter((n) => !ids.has(n.id))];
      S.vale = SV; V = SV;
      localStorage.setItem(LS, JSON.stringify(S));
    } catch (e) { console.warn('save failed', e); }
  }
  const isOpen = (flag) => !!V.world.open[flag];
  function openFlag(flag) {
    if (isOpen(flag)) return;
    V.world.open[flag] = { by: me, at: Date.now() };
    applyDoors(); sfx('door'); save();
  }
  function applyDoors() {
    for (const [k, d] of Object.entries(doorAt)) {
      const [x, y] = k.split(',').map(Number);
      if (isOpen(d.flag)) tset(x, y, d.open);
    }
    if (isOpen('flames')) for (let y = 0; y < MH; y++) for (let x = DX; x < MW; x++) if (tget(x, y) === T.FIRE) tset(x, y, T.FLOOR);
  }
  applyDoors();

  /* ================= Entities ================= */
  // kinds (shared with the shader): 1 you, 2 family ghost, 3 villager, 4 blob, 5 flit, 6 pot, 7 chest, 8 key, 9 heart, 10 glint,
  // 11 block, 12 golem, 13 fireball, 14 note, 15 sparkle, 16 bush, 17 heart container
  const K = { YOU: 1, GHOST: 2, NPC: 3, BLOB: 4, FLIT: 5, POT: 6, CHEST: 7, KEY: 8, HEART: 9, GLINT: 10, BLOCK: 11, GOLEM: 12, FIRE: 13, NOTE: 14, SPARK: 15, BUSH: 16, HCONT: 17 };
  let ents = [];
  const P = { k: K.YOU, x: 0, y: 0, dx: 0, dy: -1, walk: 0, move: 0, swing: 0, inv: 0, push: 0, room: null, hit: new Set() };
  const add = (e) => { ents.push(e); return e; };
  const npcs = [
    { k: K.NPC, x: spots.elder[0], y: spots.elder[1], c: 1, id: 'elder', name: 'Elder Mira' },
    { k: K.NPC, x: spots.kid[0], y: spots.kid[1], c: 2, id: 'kid', name: 'Tobi' },
    { k: K.NPC, x: spots.fisher[0], y: spots.fisher[1], c: 3, id: 'fisher', name: 'Pell the fisher' },
    { k: K.NOTE, x: spots.sign[0] + 0.5, y: spots.sign[1] + 0.1, id: 'sign', name: 'Signpost', sign: true },
  ];
  function spawnOverworld() {
    ents = ents.filter((e) => e.k === K.YOU || (e.k !== K.BLOB && e.k !== K.FLIT && e.k !== K.BUSH && e.k !== K.HEART && e.k !== K.GLINT && !e.over));
    for (const n of npcs) add({ ...n, over: true });
    // bushes along the paths and around the village
    let n = 0;
    for (let y = 4; y < 62 && n < 46; y++) for (let x = 4; x < 92 && n < 46; x++) {
      if (tget(x, y) !== T.GRASS || h01(x + 77, y + 33) > 0.035) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tget(x + a, y + b) === T.PATH);
      if (near || h01(x, y + 9) < 0.25) { add({ k: K.BUSH, x: x + 0.5, y: y + 0.15, over: true }); n++; }
    }
    // blobs in the meadow
    for (const [bx, by] of [[36, 30], [42, 22], [30, 24], [52, 44], [40, 50], [24, 30], [62, 44], [34, 14]]) if (tget(bx, by) === T.GRASS || tget(bx, by) === T.PATH) add({ k: K.BLOB, x: bx + 0.5, y: by + 0.3, hp: 2, home: [bx, by], t: Math.random() * 2, over: true });
  }
  function spawnDungeon() {
    ents = ents.filter((e) => !e.dun);
    for (const [x, y] of dunStart.blocks) add({ k: K.BLOCK, x: x + 0.5, y, tx: x, ty: y, dun: true });
    for (const [x, y] of dunStart.pots) add({ k: K.POT, x: x + 0.5, y: y + 0.1, dun: true });
    for (const [id, [x, y, room]] of Object.entries(dunStart.chests)) add({ k: K.CHEST, x, y, cid: 'c' + id, room, open: !!H.chests['c' + id], hidden: id === '1' && !H.chests.c1, dun: true });
    if (!H.chests.c1) for (const [x, y, room] of dunStart.blobs) add({ k: K.BLOB, x, y, hp: 2, room, t: Math.random() * 2, dun: true });
    if (!H.boss && dunStart.boss) { const [x, y] = dunStart.boss; add({ k: K.GOLEM, x, y, hp: 6, state: 'burn', t: 2, wetHits: 0, dun: true }); }
    if (H.boss && !H.chests.hc) add({ k: K.HCONT, x: dunStart.boss[0], y: dunStart.boss[1] + 1, dun: true });
    if (isOpen('plateA')) { const b = ents.find((e) => e.k === K.BLOCK); if (b && spots.plate) { b.tx = spots.plate[0]; b.ty = spots.plate[1]; b.x = b.tx + 0.5; b.y = b.ty; } }
  }
  function familyLayer() {
    ents = ents.filter((e) => e.k !== K.GHOST && !(e.k === K.NOTE && e.fam));
    for (const [id, h] of Object.entries(V.heroes || {})) {
      if (id === me || !h?.pos || Date.now() - (h.at || 0) > 14 * 86400000) continue;
      add({ k: K.GHOST, x: h.pos.x, y: h.pos.y, id, name: nameOf(id) });
    }
    for (const n of V.notes) if (n && Number.isFinite(n.x)) add({ k: K.NOTE, x: n.x, y: n.y, fam: true, note: n });
  }
  // where you begin
  if (H.pos && Number.isFinite(H.pos.x) && !SOLID.has(tget(Math.floor(H.pos.x), Math.floor(H.pos.y)))) { P.x = H.pos.x; P.y = H.pos.y; }
  else { P.x = spots.start[0]; P.y = spots.start[1]; }
  let night = H.night ? 1 : 0, nightTo = night;
  add(P); spawnOverworld(); spawnDungeon(); familyLayer();

  /* ================= Collision ================= */
  const blockAt = (x, y) => ents.find((e) => e.k === K.BLOCK && e.tx === x && e.ty === y);
  const solidTile = (x, y) => SOLID.has(tget(x, y)) || !!blockAt(x, y);
  const SOLID_ENTS = new Set([K.NPC, K.POT, K.CHEST, K.NOTE, K.BUSH]);
  function blocked(x, y, self) {
    const r = 0.26;
    for (const [ax, ay] of [[x - r, y], [x + r, y], [x - r, y + 0.35], [x + r, y + 0.35]]) if (solidTile(Math.floor(ax), Math.floor(ay))) return true;
    for (const e of ents) if (e !== self && SOLID_ENTS.has(e.k) && !e.hidden && Math.abs(e.x - x) < 0.6 && Math.abs(e.y - y) < 0.42) return true;
    return false;
  }

  /* ================= Songs ================= */
  const NOTES = { '▼': 523.25, '◀': 587.33, '●': 659.25, '▶': 783.99, '▲': 880 };
  const SONGS = {
    sun: { name: 'Song of Sun', notes: '●▲▲▶●▼', what: 'turns day into night, and night into day' },
    doors: { name: 'Song of Doors', notes: '◀▶◀●▲▲', what: 'opens sealed stone doors nearby' },
    rain: { name: 'Song of Rain', notes: '▼▼●◀▲●', what: 'calls the rain — it cools even the hottest flame' },
  };
  let played = '', rainT = 0;
  function playNote(n) {
    flute(NOTES[n]);
    played = (played + n).slice(-6);
    renderFlute();
    for (const [id, s] of Object.entries(SONGS)) {
      if (!H.songs.includes(id) || !played.endsWith(s.notes)) continue;
      played = '';
      setTimeout(() => { closeFlute(); songEffect(id); }, 450);
      return;
    }
  }
  function songEffect(id) {
    melody(SONGS[id].notes);
    add({ k: K.SPARK, x: P.x, y: P.y, t: 0, c: id === 'sun' ? 1 : id === 'doors' ? 2 : 3, life: 1.4 });
    if (id === 'sun') { nightTo = nightTo ? 0 : 1; H.night = !!nightTo; say(nightTo ? '🌙 The moon rises over the vale…' : '☀️ Morning light fills the vale.'); if (nightTo) spawnFlits(); save(); return; }
    if (id === 'doors') {
      for (const [k, d] of Object.entries(doorAt)) {
        if (d.kind !== 'song' || isOpen(d.flag)) continue;
        const [x, y] = k.split(',').map(Number);
        if (Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y) < 3.5) { openFlag(d.flag); say('🚪 The stone door rumbles open!'); return; }
      }
      say('The song echoes… but no door answers here.'); return;
    }
    if (id === 'rain') {
      rainT = 7;
      if (P.room === 'E' && !isOpen('flames')) { setTimeout(() => { V.world.open.flames = { by: me, at: Date.now() }; applyDoors(); sfx('door'); save(); say('🔥→💧 The rain puts out the wall of fire!'); }, 1400); return; }
      const g = ents.find((e) => e.k === K.GOLEM && e.hp > 0);
      if (g && P.room === 'F' && g.state === 'burn') { g.state = 'wet'; g.t = 6.5; g.wetHits = 0; say('💧 The golem’s fire sputters out — now strike!'); sfx('hiss'); return; }
      say('🌧️ Soft rain falls over you.');
    }
  }

  /* ================= Talking ================= */
  let dlg = null;
  function talk(name, lines, done) { dlg = { name, lines: lines.slice(), done }; renderDialog(); }
  function nextLine() { if (!dlg) return; dlg.lines.shift(); if (!dlg.lines.length) { const d = dlg.done; dlg = null; renderDialog(); d && d(); } else renderDialog(); }
  function learn(id) { if (!H.songs.includes(id)) { H.songs.push(id); sfx('fanfare'); save(); } }
  function interact(e) {
    if (e.k === K.NPC && e.id === 'elder') {
      if (!H.flute) return talk('Elder Mira', ['Ah — a new hero in Windsong Vale! Welcome.', 'Something is whispering under the north cliff… the Hollow has woken up.', 'Take this: my old Wind Flute. 🎵', 'Let me teach you the Song of Sun. It turns day into night, and night into day.', `🎵 You learned the Song of Sun!  ${SONGS.sun.notes}`, 'The sealed door in the cliff only answers the Song of Doors. It’s carved on the stone at the forest shrine (east)…', '…but that stone only shows its words under the moon.'], () => { H.flute = true; learn('sun'); renderHud(); });
      if (!H.songs.includes('doors')) return talk('Elder Mira', ['Under the moon, the shrine stone in the east forest will speak.', 'Play the Song of Sun to call the night! Tap 🎵 and play ' + SONGS.sun.notes + '.']);
      if (!H.boss) return talk('Elder Mira', ['The cliff door is north of the village, up the path.', 'In the Hollow, keep your sword ready — and your flute closer.']);
      return talk('Elder Mira', ['You quieted the Hollow! The whole vale is singing again. 🎶', 'Thank you, hero.']);
    }
    if (e.k === K.NPC && e.id === 'kid') return talk('Tobi', ['Blobs bounce right at you — hit them with your sword ⚔️!', 'Cut bushes for glints ◆ and hearts ♥.', 'Pell the fisher by the lake LOVES glints…']);
    if (e.k === K.NPC && e.id === 'fisher') {
      if (H.pell) return talk('Pell the fisher', ['Nice day for fishing. The lake remembers the sky, you know.', 'At night the moon dances on it.']);
      if (H.glints >= 25) return talk('Pell the fisher', ['Wow, 25 glints! Here — trade them for my Heart Charm.', '♥ Your hearts grew! You now have one more heart.'], () => { H.glints -= 25; H.max += 2; H.hearts = H.max; H.pell = true; sfx('fanfare'); save(); renderHud(); });
      return talk('Pell the fisher', ['Bring me 25 glints ◆ and I’ll give you something special.', `You have ${H.glints}.`]);
    }
    if (e.k === K.NOTE && e.sign) return talk('Signpost', ['↑ North: the cliff door', '→ East: the forest shrine', '↘ South-east: Lantern Lake', '← You’re in Willowby village']);
    if (e.k === K.NOTE && e.fam) {
      const n = e.note, mine = n.by === me;
      return talk(`Note from ${mine ? 'you' : nameOf(n.by)}`, [n.text], mine ? null : () => { if (!H.talked['n' + n.id]) { H.talked['n' + n.id] = 1; save(); } });
    }
    if (e.k === K.CHEST && !e.open && !e.hidden) {
      e.open = true; H.chests[e.cid] = Date.now();
      if (e.cid === 'c1') { H.keys++; talk('Chest', ['🗝️ You found a small key! It opens a locked door.']); }
      if (e.cid === 'c2') { H.ember = true; talk('Chest', ['🔥 The Ember Key! It opens the great door to the golem’s chamber.']); }
      if (e.cid === 'c3') { H.glints += 30; talk('Chest', ['◆ 30 glints!']); }
      sfx('fanfare'); save(); renderHud(); return;
    }
    if (e.k === K.HCONT) { ents = ents.filter((x) => x !== e); H.chests.hc = 1; H.max += 2; H.hearts = H.max; sfx('fanfare'); save(); renderHud(); return talk('Heart Container', ['♥ Your hearts grew!', 'The Hollow is quiet. The stairs lead back to the vale.']); }
    if (e.tablet === 1) {
      if (night < 0.5) return talk('Shrine stone', ['The stone is smooth and blank…', 'Maybe the moon can read it.']);
      return talk('Shrine stone', ['Moonlight fills the carvings:', `🎵 The Song of Doors!  ${SONGS.doors.notes}`, 'It opens sealed stone doors.'], () => learn('doors'));
    }
    if (e.tablet === 2) return talk('Old tablet', ['Words of the rainmakers:', `🎵 The Song of Rain!  ${SONGS.rain.notes}`, 'It can cool even the hottest flame.'], () => learn('rain'));
  }
  // the closest thing you could use right now
  function actionTarget() {
    const fx = P.x + P.dx * 0.8, fy = P.y + 0.3 + P.dy * 0.8;
    let best = null, bd = 1.3;
    for (const e of ents) {
      if (![K.NPC, K.NOTE, K.CHEST, K.HCONT].includes(e.k) || e.hidden || (e.k === K.CHEST && e.open)) continue;
      const d = Math.hypot(e.x - fx, e.y + 0.3 - fy); if (d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    for (const [nm, t] of [['shrineTablet', 1], ['rainTablet', 2]]) { const s = spots[nm]; if (s && Math.hypot(s[0] + 0.5 - fx, s[1] + 0.5 - fy) < 1.4) return { tablet: t }; }
    return null;
  }

  /* ================= Fighting + moving ================= */
  function hurt(n, from) {
    if (P.inv > 0) return;
    H.hearts = Math.max(0, H.hearts - n); P.inv = 1.1; sfx('hurt');
    $('hurt').style.opacity = 1; setTimeout(() => { $('hurt').style.opacity = 0; }, 220);
    if (from) { const a = Math.atan2(P.y - from.y, P.x - from.x); for (let k = 0; k < 6; k++) { const nx = P.x + Math.cos(a) * 0.12, ny = P.y + Math.sin(a) * 0.12; if (!blocked(nx, ny, P)) { P.x = nx; P.y = ny; } } }
    renderHud();
    if (!H.hearts) faint();
  }
  function faint() {
    talk('', ['You fainted… 💫', 'You wake up at the last safe place, hearts restored.'], () => { H.hearts = H.max; const inDun = P.x >= DX; [P.x, P.y] = inDun ? spots.dunIn : spots.start; if (inDun) spawnDungeon(); renderHud(); save(); });
  }
  function drop(x, y) { const r = Math.random(); if (r < 0.3) add({ k: K.HEART, x, y, t: 0 }); else if (r < 0.8) add({ k: K.GLINT, x, y, t: 0, n: r < 0.72 ? 1 : 5 }); }
  function swing() {
    if (P.swing > 0 || dlg || fluteOpen) return;
    P.swing = 0.26; P.hit = new Set(); sfx('swish');
  }
  function swordHits() {
    const cx = P.x, cy = P.y + 0.55, a0 = Math.atan2(P.dy, P.dx);
    for (const e of ents) {
      if (P.hit.has(e)) continue;
      const d = Math.hypot(e.x - cx, (e.y + (e.k === K.GOLEM ? 1.0 : 0.3)) - cy), reach = e.k === K.GOLEM ? 2.3 : 1.35;
      if (d > reach) continue;
      let da = Math.abs(((Math.atan2(e.y + 0.3 - cy, e.x - cx) - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d > 0.5 && da > 1.4) continue;
      P.hit.add(e);
      if (e.k === K.BLOB || e.k === K.FLIT) {
        e.hp--; e.flash = 0.2; sfx('hit');
        const a = Math.atan2(e.y - P.y, e.x - P.x); e.kx = Math.cos(a) * 6; e.ky = Math.sin(a) * 6;
        if (e.hp <= 0) { e.dead = true; add({ k: K.SPARK, x: e.x, y: e.y, t: 0, c: 4, life: 0.5 }); drop(e.x, e.y); }
      } else if (e.k === K.BUSH || e.k === K.POT) {
        e.dead = true; sfx('cut'); add({ k: K.SPARK, x: e.x, y: e.y, t: 0, c: e.k === K.BUSH ? 5 : 6, life: 0.4 }); drop(e.x, e.y);
      } else if (e.k === K.GOLEM && e.hp > 0) {
        if (e.state !== 'wet') { sfx('clank'); say('🔥 Too hot to touch! Cool it down first…'); continue; }
        e.hp--; e.wetHits++; e.flash = 0.25; sfx('hit');
        if (e.hp <= 0) bossDown(e);
        else if (e.wetHits >= 2) { e.state = 'burn'; e.t = 1.5; sfx('roar'); say('🔥 The golem blazes up again!'); }
      }
    }
    ents = ents.filter((e) => !e.dead);
  }
  function bossDown(g) {
    g.dead = true; sfx('roar'); setTimeout(() => sfx('fanfare'), 700);
    for (let i = 0; i < 6; i++) add({ k: K.SPARK, x: g.x + (Math.random() - 0.5) * 2, y: g.y + Math.random() * 2, t: -i * 0.15, c: 1, life: 1.2 });
    H.boss = Date.now(); save();
    add({ k: K.HCONT, x: g.x, y: g.y + 1, dun: true });
    const fb = roomBox('F'), sx = Math.floor((fb.x0 + fb.x1) / 2), sy = fb.y0 + 2; tset(sx, sy, T.STAIRS); spots.bossStairs = [sx, sy];
    talk('', ['💥 The Ember Golem crumbles into glowing letters!', 'The Whispering Hollow falls quiet…', '🏆 Your name joins the Hall of Heroes!']);
  }
  function spawnFlits() { for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; const x = P.x + Math.cos(a) * 9, y = P.y + Math.sin(a) * 9; if (x < OW && !SOLID.has(tget(Math.floor(x), Math.floor(y)))) add({ k: K.FLIT, x, y, hp: 1, t: Math.random() * 6, over: true }); } }

  function tryPush(dt) {
    const ax = Math.abs(P.dx) > Math.abs(P.dy) ? Math.sign(P.dx) : 0, ay = ax ? 0 : Math.sign(P.dy);
    const tx = Math.floor(P.x + ax * 0.55), ty = Math.floor(P.y + 0.15 + ay * 0.55), b = blockAt(tx, ty);
    if (!b) { P.push = 0; return; }
    P.push += dt;
    if (P.push < 0.35) return;
    P.push = 0;
    const nx = b.tx + ax, ny = b.ty + ay;
    if (solidTile(nx, ny) || ents.some((e) => e !== b && !e.hidden && [K.POT, K.CHEST].includes(e.k) && Math.floor(e.x) === nx && Math.floor(e.y) === ny)) { sfx('clank'); return; }
    b.tx = nx; b.ty = ny; b.slide = 0.25; sfx('push');
    if (tget(nx, ny) === T.PLATE) { setTimeout(() => { if (!isOpen('plateA')) { openFlag('plateA'); say('⚙️ Click! A door opens somewhere…'); } }, 260); }
  }
  function touchDoor() {
    const fx = Math.floor(P.x + P.dx * 0.5), fy = Math.floor(P.y + 0.2 + P.dy * 0.5), d = doorAt[`${fx},${fy}`];
    if (!d || isOpen(d.flag)) return;
    if (d.kind === 'lock') { if (H.keys > 0) { H.keys--; openFlag(d.flag); say('🗝️ Unlocked!'); renderHud(); } else hint('🔒 Locked. A small key would open it.'); }
    else if (d.kind === 'boss') { if (H.ember) { openFlag(d.flag); say('🔥 The Ember Key turns… the great door opens.'); } else hint('🔥 A great door with a flame-shaped lock.'); }
    else if (d.kind === 'song') hint('🗿 A sealed stone door. It seems to be waiting for a song…');
    else if (d.kind === 'plate') hint('⚙️ Iron bars. Something heavy on a switch might open them.');
  }
  let hintAt = 0;
  function hint(t) { if (Date.now() - hintAt > 2500) { hintAt = Date.now(); say(t); } }

  /* ================= Update ================= */
  const keys = new Set(), stick = { on: false, x: 0, y: 0, ox: 0, oy: 0, id: null };
  let saveT = 0, lastRoom = null;
  function update(dt) {
    night += (nightTo - night) * Math.min(1, dt * 1.6);
    if (rainT > 0) rainT -= dt;
    if (P.inv > 0) P.inv -= dt;
    // you
    let ix = stick.x, iy = stick.y;
    if (keys.has('arrowleft') || keys.has('a')) ix -= 1; if (keys.has('arrowright') || keys.has('d')) ix += 1;
    if (keys.has('arrowup') || keys.has('w')) iy += 1; if (keys.has('arrowdown') || keys.has('s')) iy -= 1;
    const m = Math.min(1, Math.hypot(ix, iy));
    if (m > 0.1 && !dlg && !fluteOpen && P.swing <= 0.12) {
      const a = Math.atan2(iy, ix), sp = 4.0 * m * dt;
      P.dx = Math.cos(a); P.dy = Math.sin(a);
      const nx = P.x + P.dx * sp, ny = P.y + P.dy * sp;
      let moved = false;
      if (!blocked(nx, P.y, P)) { P.x = nx; moved = true; }
      if (!blocked(P.x, ny, P)) { P.y = ny; moved = true; }
      if (!moved || Math.abs(P.dx) > 0.9 || Math.abs(P.dy) > 0.9) { tryPush(dt); touchDoor(); }
      P.walk += dt * 10 * m; P.move = Math.min(1, P.move + dt * 6);
    } else { P.move = Math.max(0, P.move - dt * 6); P.push = 0; }
    if (P.swing > 0) { P.swing -= dt; swordHits(); }
    // places
    const tx = Math.floor(P.x), ty = Math.floor(P.y + 0.2), here = tget(tx, ty);
    if (here === T.CAVE) { [P.x, P.y] = spots.dunIn; P.dy = 1; spawnDungeon(); say('🕯️ The Whispering Hollow'); save(); }
    if (here === T.STAIRS && P.x >= DX) { [P.x, P.y] = spots.caveOut; P.dy = -1; say('☀️ Back in Windsong Vale'); save(); }
    P.room = roomOf(P.x, P.y + 0.2);
    if (P.room !== lastRoom) {
      lastRoom = P.room;
      if (P.room === 'F' && !H.boss) say(H.songs.includes('rain') ? '🔥 The Ember Golem! Its flames are too hot — play the Song of Rain!' : '🔥 The Ember Golem! Its flames are too hot to touch…');
      if (P.room === 'E' && !isOpen('flames')) say('🔥 A wall of fire blocks the way…');
      const by = (f) => V.world.open[f] && V.world.open[f].by !== me ? nameOf(V.world.open[f].by) : null;
      if (P.room === 'A' && by('plateA')) say(`🚪 ${by('plateA')} already opened the north door for everyone!`);
    }
    // the blob room: when every blob is gone, the chest appears
    const c1 = ents.find((e) => e.k === K.CHEST && e.cid === 'c1');
    if (c1 && c1.hidden && !ents.some((e) => e.k === K.BLOB && e.room === 'D')) { c1.hidden = false; sfx('fanfare'); add({ k: K.SPARK, x: c1.x, y: c1.y, t: 0, c: 1, life: 1 }); say('✨ A chest appeared!'); }
    // everything else
    for (const e of ents) {
      if (e.flash > 0) e.flash -= dt;
      if (e.kx) { const nx = e.x + e.kx * dt, ny = e.y + e.ky * dt; if (!blocked(nx, ny, e)) { e.x = nx; e.y = ny; } e.kx *= 0.85; e.ky *= 0.85; if (Math.abs(e.kx) < 0.1) e.kx = e.ky = 0; }
      if (e.k === K.BLOB) {
        e.t += dt;
        const d = Math.hypot(P.x - e.x, P.y - e.y);
        const awake = e.room ? P.room === e.room : d < 7;
        if (awake && e.t > 0.9 && !dlg) { e.t = 0; const a = Math.atan2(P.y - e.y, P.x - e.x) + (Math.random() - 0.5) * 0.6; e.vx = Math.cos(a) * 2.6; e.vy = Math.sin(a) * 2.6; e.hop = 0.35; }
        if (e.hop > 0) { e.hop -= dt; const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; if (!blocked(nx, ny, e)) { e.x = nx; e.y = ny; } }
        if (d < 0.55) hurt(1, e);
      }
      if (e.k === K.FLIT) {
        e.t += dt; const d = Math.hypot(P.x - e.x, P.y - e.y);
        if (night < 0.5 && !e.dead) { e.y += dt * 4; if (e.y > P.y + 15) e.dead = true; continue; }
        if (d < 9) { const a = Math.atan2(P.y - e.y, P.x - e.x); e.x += (Math.cos(a) * 2.2 + Math.sin(e.t * 3) * 1.5) * dt; e.y += (Math.sin(a) * 2.2 + Math.cos(e.t * 2.5) * 1.5) * dt; }
        if (d < 0.6) hurt(1, e);
      }
      if (e.k === K.GOLEM && e.hp > 0) {
        e.t -= dt;
        if (P.room === 'F') {
          if (e.state === 'burn') {
            const a = Math.atan2(P.y - e.y, P.x - e.x), nx = e.x + Math.cos(a) * 0.9 * dt, ny = e.y + Math.sin(a) * 0.9 * dt;
            if (!blocked(nx, ny, e)) { e.x = nx; e.y = ny; }
            if (e.t <= 0 && !dlg) { e.t = 2.2; sfx('fire'); for (const s of [-0.35, 0, 0.35]) add({ k: K.FIRE, x: e.x, y: e.y + 1.2, vx: Math.cos(a + s) * 5, vy: Math.sin(a + s) * 5, life: 3 }); }
            if (Math.hypot(P.x - e.x, P.y - e.y) < 1.3) hurt(2, e);
          } else if (e.t <= 0) { e.state = 'burn'; e.t = 1.2; sfx('roar'); say('🔥 The golem blazes up again!'); }
        }
      }
      if (e.k === K.FIRE) {
        e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
        if (solidTile(Math.floor(e.x), Math.floor(e.y + 0.4)) || e.life < 0) e.dead = true;
        if (Math.hypot(P.x - e.x, P.y + 0.4 - (e.y + 0.4)) < 0.5) { hurt(1, e); e.dead = true; }
      }
      if (e.k === K.HEART || e.k === K.GLINT || e.k === K.KEY) {
        e.t += dt;
        if (Math.hypot(P.x - e.x, P.y - e.y) < 0.65) {
          e.dead = true; sfx('pick');
          if (e.k === K.HEART) H.hearts = Math.min(H.max, H.hearts + 2); else if (e.k === K.GLINT) H.glints += e.n || 1;
          renderHud();
        }
        if (e.t > 14) e.dead = true;
      }
      if (e.k === K.SPARK) { e.t += dt; if (e.t > e.life) e.dead = true; }
      if (e.k === K.BLOCK) { const tx2 = e.tx + 0.5, ty2 = e.ty; e.x += (tx2 - e.x) * Math.min(1, dt * 12); e.y += (ty2 - e.y) * Math.min(1, dt * 12); }
    }
    ents = ents.filter((e) => !e.dead);
    // at night, flits come out near the forest
    if (night > 0.5 && P.x < OW && Math.random() < dt * 0.15 && ents.filter((e) => e.k === K.FLIT).length < 4) spawnFlits();
    saveT += dt; if (saveT > 6) { saveT = 0; save(); }
    // action button label
    const t = actionTarget();
    const lab = !t ? '✋' : t.k === K.NPC ? '💬' : t.k === K.CHEST ? '🎁' : t.k === K.HCONT ? '♥' : '👀';
    if ($('bAct').textContent !== lab) $('bAct').textContent = lab;
  }

  /* ================= Renderer ================= */
  const ROWS = [
    ' .:-=+*#%@',          // 0 general
    " .,'/|\\\";:",        // 1 grass
    ' .,-~~=+*#',          // 2 water
    ' .:;oO&%@#',          // 3 leaves
    ' .:+#$&WM@',          // 4 stone
    ' .:|!lI|H#',          // 5 bark
    " .,:;'`.,:",          // 6 sand
    ' .:+oO0@#M',          // 7 people
    " .'`*+*x*.",          // 8 sparkle
    ' .-^^^AAMM',          // 9 roof
    " .,'^*^#@&",          // 10 fire
    ' .:=|][#H8',          // 11 wood / iron
    ' .,:;-_~=o',          // 12 dirt
    ' .oO0@@QQ8',          // 13 slime
  ];
  const GW = 48, GHh = 80;
  function atlas() {
    const c = document.createElement('canvas'); c.width = GW * 10; c.height = GHh * ROWS.length;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `bold ${GHh * 0.78}px ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace`;
    ROWS.forEach((row, r) => [...row].forEach((ch, k) => x.fillText(ch, k * GW + GW / 2, r * GHh + GHh * 0.54)));
    return c;
  }
  const MAXE = 56, MAXL = 12;
  const VS = `#version 300 es
  in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const SCENE = `#version 300 es
  precision highp float; precision highp int;
  uniform vec2 uRes, uCell, uCam; uniform float uScale, uTime, uNight, uDark, uRain;
  uniform sampler2D uMap; uniform ivec2 uMapSize;
  uniform vec4 uE[${MAXE}]; uniform vec4 uF[${MAXE}]; uniform int uNE;
  uniform vec3 uL[${MAXL}]; uniform int uNL;
  out vec4 o;
  uint hsh(uint x){ x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
  float h01(ivec2 p){ return float((hsh(uint(p.x + 32768) * 1597334677u ^ hsh(uint(p.y + 32768)))) & 0xffffffu) / 16777216.0; }
  float vn(vec2 p){ vec2 i = floor(p), f = p - i; f = f*f*(3.0-2.0*f); ivec2 q = ivec2(i);
    float a = h01(q), b = h01(q+ivec2(1,0)), c = h01(q+ivec2(0,1)), d = h01(q+ivec2(1,1));
    return a + (b-a)*f.x + (c-a)*f.y + (a-b-c+d)*f.x*f.y; }
  int tAt(ivec2 t){ if (t.x < 0 || t.y < 0 || t.x >= uMapSize.x || t.y >= uMapSize.y) return 0; return int(texelFetch(uMap, t, 0).r * 255.0 + 0.5); }
  float vAt(ivec2 t){ return texelFetch(uMap, t, 0).g; }
  float glyphOf(int row, float b){ return float(row*10 + int(clamp(b,0.0,0.999)*10.0)); }
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; return length(pa - ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0)); }
  float box(vec2 p, vec2 c, vec2 h, float r){ vec2 d = abs(p-c) - h + r; return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - r; }
  float heart(vec2 p){ p.x = abs(p.x); if (p.y + p.x > 1.0) return sqrt(dot(p-vec2(0.25,0.75),p-vec2(0.25,0.75))) - 0.3536;
    vec2 q = p - 0.5*max(p.x+p.y,0.0); return sqrt(min(dot(p-vec2(0.0,1.0),p-vec2(0.0,1.0)), dot(q,q))) * sign(p.x-p.y); }
  // A person made of letters. q relative to the feet, in tiles. scheme: 0 you, 1 elder, 2 kid, 3 fisher, 4 ghost
  vec4 person(vec2 q, float walk, float move, float face, int scheme, float swing, vec2 dir){
    float S = 0.62; vec2 r = q / S; r.x *= face;
    float sw = sin(walk)*0.28*move; r.y -= abs(cos(walk))*0.06*move;
    float head = length(r - vec2(0.0, 2.12)) - 0.34;
    float hair = length(r - vec2(-0.04, 2.25)) - 0.32;
    float body = box(r, vec2(0.0, 1.35), vec2(0.32, 0.44), 0.12);
    float legs = min(seg(r, vec2(-0.13,0.95), vec2(-0.13+sw,0.05)), seg(r, vec2(0.13,0.95), vec2(0.13-sw,0.05))) - 0.11;
    float arms = min(seg(r, vec2(-0.36,1.68), vec2(-0.42-sw*0.8,1.0)), seg(r, vec2(0.36,1.68), vec2(0.42+sw*0.8,1.0))) - 0.09;
    float scarf = box(r, vec2(0.0, 1.78), vec2(0.3, 0.07), 0.04);
    vec3 skin = vec3(1.0,0.82,0.66), shirt = vec3(0.25,0.85,0.75), pants = vec3(0.32,0.3,0.6), hc = vec3(0.4,0.25,0.15);
    if (scheme == 1) { shirt = vec3(0.6,0.4,0.9); hc = vec3(0.95); pants = vec3(0.45,0.3,0.7); }
    if (scheme == 2) { shirt = vec3(1.0,0.6,0.2); hc = vec3(0.2,0.12,0.08); }
    if (scheme == 3) { shirt = vec3(1.0,0.85,0.25); pants = vec3(0.3,0.4,0.55); hc = vec3(0.5,0.3,0.2); }
    float sh = 0.6 + 0.4*clamp(0.5 - r.x*0.9, 0.0, 1.0);
    vec4 res = vec4(-1.0);
    if (legs < 0.0) res = vec4(pants, 0.55*sh);
    if (body < 0.0) res = vec4(shirt, 0.62*sh + 0.25);
    if (scheme == 0 && scarf < 0.0) res = vec4(1.0,0.35,0.35, 0.8);
    if (arms < 0.0) res = vec4(skin, 0.6*sh);
    if (head < 0.0) res = (hair < 0.0 && r.y > 2.2) ? vec4(hc, 0.6*sh + 0.1) : vec4(skin, 0.72*sh + 0.15);
    // the sword while swinging
    if (swing > 0.0) {
      float a0 = atan(dir.y, dir.x) + (swing - 0.5) * 2.6;
      vec2 hand = vec2(0.0, 0.62), tip = hand + vec2(cos(a0), sin(a0)) * 1.05;
      if (seg(q, hand, tip) < 0.07) res = vec4(0.9,0.97,1.0, 0.95);
      if (length(q - hand - vec2(cos(a0), sin(a0))*0.75) < 0.55 && length(q - hand) > 0.55 && abs(atan(q.y-hand.y, q.x-hand.x) - a0) < 0.8) res = res.a < 0.0 ? vec4(0.7,0.95,1.0, 0.35) : res;
    }
    if (scheme == 4 && res.a >= 0.0) res = vec4(mix(res.rgb, vec3(0.6,0.75,1.0), 0.6), res.a*0.55);
    return res;
  }
  void main(){
    vec2 cell = floor(gl_FragCoord.xy);
    vec2 p = uCam + ((cell + 0.5) * uCell - uRes*0.5) * uScale;
    ivec2 gc = ivec2(floor(p / (uCell * uScale)));
    float t = uTime, n1 = h01(gc), n2 = h01(gc + ivec2(777, 31));
    ivec2 tl = ivec2(floor(p)); vec2 f = p - floor(p);
    int ty = tAt(tl);
    float day = 1.0 - uNight;
    // light
    vec3 amb = uDark > 0.5 ? vec3(0.55,0.56,0.7) : mix(vec3(0.5,0.62,0.95), vec3(1.0), day);
    float light = uDark > 0.5 ? 0.6 : mix(0.6, 1.0, day);
    for (int i = 0; i < ${MAXL}; i++) { if (i >= uNL) break; vec3 L = uL[i]; float d2 = dot(p - L.xy, p - L.xy); float k = abs(L.z) * exp(-d2 / (L.z > 0.0 ? 10.0 : 22.0)); light += k; amb += (L.z > 0.0 ? vec3(1.0,0.6,0.25) : vec3(1.0,0.85,0.55)) * k * 0.8; }
    float cloud = uDark > 0.5 ? 0.0 : smoothstep(0.45, 0.75, vn(p*0.05 + vec2(t*0.04, t*0.015))) * 0.3 * day;
    vec3 col; float bri; float glyph;
    bool water = ty == 2;
    // ---------- the ground ----------
    if (ty == 0) { col = vec3(0.0); bri = 0.0; glyph = 0.0; }
    else if (water) {
      float wave = 0.5 + 0.5*sin(p.x*3.4 + t*1.3 + sin(p.y*4.6 + t*0.7)*1.5) * sin(p.y*6.2 - t*1.1);
      col = vec3(0.2,0.45,0.85) * amb; bri = (0.3 + 0.42*wave + 0.2*day*smoothstep(0.5,0.8,vn(p*0.12 + vec2(t*0.05,-t*0.02)))) * light;
      glyph = glyphOf(2, bri);
      if (n1 > 0.993 && fract(t*0.7 + n2*7.0) < 0.3) { col = mix(vec3(1.0,0.95,0.75), vec3(0.85,0.92,1.0), uNight); bri = 0.85; glyph = 84.0; }
    } else if (ty == 3) { col = vec3(0.93,0.82,0.55)*amb; bri = (0.45 + 0.3*n1)*light*(1.0-cloud); glyph = glyphOf(6, n1*0.95+0.04); }
    else if (ty == 4 || ty == 24) {
      col = vec3(0.66,0.5,0.32)*amb; bri = (0.3 + 0.22*n1)*light*(1.0-cloud); glyph = n1 < 0.45 ? 0.0 : n1 < 0.8 ? 121.0 : n1 < 0.95 ? 122.0 : 123.0;
      if (ty == 24) { float d = length((f - vec2(0.5,0.45))/vec2(0.45,0.38)); if (d < 1.0) { col = vec3(0.1); bri = 0.08; glyph = 1.0; } }
    }
    else if (ty == 6 || ty == 12 || ty == 22) {
      bool face = tAt(tl - ivec2(0,1)) != ty && tAt(tl - ivec2(0,1)) != 22 && tAt(tl - ivec2(0,1)) != 6 && tAt(tl - ivec2(0,1)) != 12;
      vec3 c0 = ty == 6 ? vec3(0.62,0.58,0.5) : vec3(0.5,0.55,0.68);
      if (ty == 12 || ty == 22) { vec2 b = fract(p*vec2(2.0,3.0) + vec2(floor(p.y*3.0)*0.5, 0.0)); if (b.x < 0.12 || b.y < 0.15) c0 *= 0.45; }
      col = c0*amb; bri = (face ? 0.32 + 0.2*n1 : 0.5 + 0.35*n1) * light;
      glyph = face ? glyphOf(5, bri + 0.1) : glyphOf(4, bri);
      if (ty == 22) { float fl = length((f - vec2(0.5,0.62)) / vec2(0.22,0.3)); if (fl < 1.0) { col = mix(vec3(1.0,0.9,0.4), vec3(1.0,0.4,0.1), fl); bri = 0.95 - 0.3*fl + 0.1*sin(t*12.0+n1*6.0); glyph = glyphOf(10, bri); } }
    }
    else if (ty == 8 || ty == 10) {
      col = ty == 10 ? vec3(0.35,0.2,0.12) : vec3(0.78,0.58,0.36); col *= amb;
      bri = (ty == 10 ? 0.35 : 0.5 + 0.2*n1) * light; glyph = ty == 10 ? 118.0 : (fract(p.y*3.0) < 0.2 ? 126.0 : 4.0);
      if (ty == 8 && fract(p.y*3.0) < 0.2) bri *= 0.7;
    }
    else if (ty == 9) { float g = fract(p.y); col = mix(vec3(0.75,0.25,0.2), vec3(0.95,0.45,0.3), g)*amb; bri = (0.45 + 0.4*g + 0.1*n1)*light; glyph = glyphOf(9, bri); }
    else if (ty == 11 || ty == 18 || ty == 19 || ty == 13 || ty == 14 || ty == 15 || ty == 16 || ty == 21 && uDark > 0.5) {
      // dungeon floor slabs
      vec2 g = f; float edge = min(min(g.x, 1.0-g.x), min(g.y, 1.0-g.y));
      col = vec3(0.42,0.44,0.55)*amb; bri = (edge < 0.06 ? 0.16 : 0.36 + 0.26*n1)*light; glyph = edge < 0.06 ? 0.0 : glyphOf(6, n1);
      if (ty == 18) { float d = max(abs(g.x-0.5), abs(g.y-0.5)); if (d < 0.38) { col = vec3(0.6,0.65,0.7)*amb; bri = (d > 0.28 ? 0.7 : 0.4)*light; glyph = d > 0.28 ? 114.0 : glyphOf(0, bri); } }
      if (ty == 19) { col = vec3(0.3,0.28,0.25)*amb; bri = (0.15 + 0.5*g.y)*light; glyph = glyphOf(11, bri*0.6); }
      if (ty == 13) { col = vec3(0.55,0.58,0.65)*amb; bri = 0.6*light; glyph = fract(g.x*4.0) < 0.3 ? 114.0 : 0.0; }
      if (ty == 14) { float d = length(g - 0.5); col = mix(vec3(0.75,0.5,1.0), vec3(0.4,0.3,0.6), d*1.6) * (0.85 + 0.15*sin(t*3.0)); bri = (0.75 - d*0.6)*(0.8+0.2*sin(t*3.0)); glyph = glyphOf(4, bri); }
      if (ty == 15) { col = vec3(0.55,0.5,0.45)*amb; bri = 0.55*light; glyph = glyphOf(11, 0.65); if (length(g - 0.5) < 0.16) { col = vec3(1.0,0.82,0.3); bri = 0.9; glyph = 46.0; } }
      if (ty == 16) { col = vec3(0.75,0.2,0.15)*(0.85 + 0.15*sin(t*2.0)); bri = 0.7; glyph = glyphOf(11, 0.85); if (length(g - 0.5) < 0.2) { col = vec3(1.0,0.6,0.2); glyph = 104.0; } }
      if (ty == 21) { col = vec3(0.45,0.55,0.75)*amb; bri = 0.55*light + 0.3*(0.5+0.5*sin(t*2.0)); glyph = fract(g.y*4.0) < 0.5 ? 3.0 : 0.0; }
    }
    else if (ty == 17) { float fl = vn(vec2(p.x*3.0, p.y*3.0 - t*4.0)); col = mix(vec3(1.0,0.25,0.05), vec3(1.0,0.9,0.35), fl); bri = 0.55 + 0.45*fl; glyph = glyphOf(10, bri); }
    else if (ty == 20 || ty == 21 || ty == 25) {
      col = vec3(0.88,0.88,0.82)*amb; bri = (0.5 + 0.25*n1)*light; glyph = (fract(p.x*2.0) < 0.2 || fract(p.y*2.0) < 0.2) ? 5.0 : glyphOf(0, bri*0.6);
      if (ty == 21) { col = vec3(0.6,0.6,0.62)*amb; bri = 0.55*light; glyph = fract(f.y*4.0) < 0.5 ? 3.0 : 0.0;
        if (uNight > 0.5) { col = vec3(0.7,0.85,1.0); bri = 0.75 + 0.25*sin(t*2.0); glyph = fract(f.y*4.0) < 0.5 ? 85.0 : 81.0; } }
      if (ty == 25) { float d = length(f - vec2(0.5,0.45)); if (d < 0.42) { col = vec3(0.92,0.92,0.88)*amb; bri = (0.85 - d)*light; glyph = glyphOf(5, bri); } }
    }
    else {
      // grass (also under trees and rocks)
      float wind = sin(p.x*0.7 + t*1.6 + sin(p.y*0.5 + t*0.3)*2.0) + (n2 - 0.5)*1.2;
      float lush = vn(p*0.16 + vec2(40.0));
      col = mix(vec3(0.24,0.62,0.22), vec3(0.45,0.85,0.3), lush) * amb;
      bri = (0.46 + 0.42*n1 + 0.15*lush) * light * (1.0 - cloud);
      int k = n1 < 0.12 ? 0 : n1 < 0.22 ? 1 : n1 < 0.32 ? (n2 < 0.5 ? 2 : 3) : (wind < -0.35 ? 4 : wind > 0.35 ? 6 : 5);
      if (n1 > 0.93 && n2 > 0.55) k = 7;
      glyph = float(10 + k);
      if (h01(gc + ivec2(51, 9)) > 0.992) { col = n2 > 0.5 ? vec3(1.0,0.55,0.8) : vec3(1.0,0.9,0.4); bri = 0.85*light; glyph = 84.0; }
      if (ty == 7) { float d = length((f - vec2(0.5,0.42))/vec2(0.46,0.38)); if (d < 1.0) { vec3 nrm = normalize(vec3(f - vec2(0.5,0.42), 0.5)); float l = 0.4 + 0.6*max(0.0, dot(nrm, normalize(vec3(-0.5,0.6,0.7)))); col = vec3(0.62,0.6,0.58)*amb; bri = l*light; glyph = glyphOf(4, bri); } }
    }
    // ---------- things standing up: trees, people, critters (the one nearest the camera wins) ----------
    float bestY = 1e9; vec4 obj = vec4(-1.0); int row = 0; float shadow = 0.0;
    vec4 refl = vec4(-1.0);
    vec2 rp = p + vec2(sin(p.y*14.0 + t*2.2)*0.04, 0.0);
    for (int dx = -1; dx <= 1; dx++) for (int dy = -2; dy <= 0; dy++) {
      ivec2 c = tl + ivec2(dx, dy);
      if (tAt(c) != 5) continue;
      vec2 base = vec2(c) + vec2(0.5, 0.2);
      float R = 0.85 + 0.25*h01(c + ivec2(3, 3)), sway = sin(t*0.9 + base.x)*0.03;
      vec2 cc = base + vec2(sway, 0.95);
      vec2 lp = (p - cc) / R; lp.y *= 1.08; float d = length(lp);
      if (d < 1.0 && base.y < bestY) {
        vec3 nrm = normalize(vec3(lp, sqrt(max(0.0, 1.0 - d*d))));
        float leaf = vn(p*6.0 + vec2(t*0.6, 0.0)), l = 0.25 + 0.75*max(0.0, dot(nrm, normalize(vec3(-0.5, 0.6, 0.7))));
        float rim = smoothstep(0.75, 1.0, d);
        bestY = base.y; obj = vec4(mix(vec3(0.1,0.42,0.16), vec3(0.45,0.85,0.32), l)*amb*(1.0 - 0.35*rim), (0.22 + 0.62*l + 0.18*leaf + 0.12*(n1-0.5))*light*(1.0-0.4*rim)); row = 3;
      }
      if (abs(p.x - base.x) < 0.1 && p.y > base.y - 0.15 && p.y < base.y + 0.3 && base.y < bestY) { bestY = base.y; obj = vec4(vec3(0.55,0.36,0.2)*amb, (0.5 + 0.3*n1)*light); row = 5; }
      shadow = max(shadow, (1.0 - smoothstep(0.6, 1.0, length((p - base - vec2(0.45, -0.15)) / vec2(R*1.1, R*0.5)))) * 0.5 * day);
      if (water) { vec2 rl = (rp - (base - vec2(-sway, 0.95))) / R; rl.y *= 1.08; if (length(rl) < 1.0) refl = vec4(vec3(0.2,0.55,0.32), 0.6); }
    }
    for (int i = 0; i < ${MAXE}; i++) {
      if (i >= uNE) break;
      vec4 E = uE[i], F = uF[i];
      vec2 q = p - E.xy;
      if (abs(q.x) > 3.0 || q.y < -1.0 || q.y > 4.0) continue;
      int kd = int(E.z + 0.5);
      vec4 r = vec4(-1.0); int rr = 7; float sh = 0.0;
      if (kd == 1 || kd == 2 || kd == 3) {
        r = person(q, F.x, F.y, F.z, kd == 1 ? 0 : kd == 2 ? 4 : int(F.w), kd == 1 ? E.w : 0.0, vec2(F.w == 0.0 ? 1.0 : cos(F.w), F.w == 0.0 ? 0.0 : sin(F.w)));
        if (kd == 1) { r = person(q, F.x, F.y, F.z, 0, E.w, vec2(cos(F.w), sin(F.w))); if (r.a >= 0.0 && fract(t*12.0) < 0.5 && uF[i].x < -100.0) r.a = -1.0; }
        sh = 0.55;
        if (water && kd == 1) { vec4 m = person(vec2(rp.x - E.x, E.y - rp.y), F.x, F.y, F.z, 0, 0.0, vec2(1.0,0.0)); if (m.a >= 0.0) refl = vec4(m.rgb*0.7 + vec3(0.0,0.05,0.15), m.a*0.75); }
      } else if (kd == 4) { // blob
        float sq = 1.0 + 0.18*sin(t*8.0 + E.x*3.0);
        float d = length((q - vec2(0.0, 0.3*sq)) / vec2(0.42/sq, 0.32*sq));
        if (d < 1.0) { vec3 nrm = normalize(vec3((q - vec2(0.0,0.3))/0.4, sqrt(max(0.0,1.0-d*d)))); float l = 0.35 + 0.65*max(0.0, dot(nrm, normalize(vec3(-0.4,0.6,0.7)))); r = vec4(vec3(0.35,0.9,0.4), l*0.9); rr = 13;
          if (length(q - vec2(-0.13, 0.36*sq)) < 0.06 || length(q - vec2(0.13, 0.36*sq)) < 0.06) r = vec4(0.05,0.1,0.05, 0.05); }
        sh = 0.5;
      } else if (kd == 5) { // flit (bat)
        float fl = sin(t*16.0 + E.x)*0.25; vec2 b = q - vec2(0.0, 0.9);
        if (length(b) < 0.16) r = vec4(0.6,0.4,0.9, 0.7);
        else if (abs(b.x) < 0.55 && abs(b.y - fl*abs(b.x)*1.6) < 0.08) r = vec4(0.5,0.3,0.8, 0.55);
        rr = 0; sh = 0.25;
      } else if (kd == 6) { // pot
        float d = length((q - vec2(0.0, 0.32)) / vec2(0.32, 0.3));
        if (d < 1.0) { r = vec4(vec3(0.75,0.45,0.28), 0.4 + 0.5*(1.0-d)); rr = 0; if (q.y > 0.52) r = vec4(0.5,0.3,0.2, 0.3); }
        sh = 0.4;
      } else if (kd == 7) { // chest
        if (E.w < 0.5) { float d = box(q, vec2(0.0,0.32), vec2(0.42,0.28), 0.05); if (d < 0.0) { r = vec4(vec3(0.72,0.45,0.2), 0.6); rr = 11; if (abs(q.y - 0.38) < 0.05) r = vec4(1.0,0.82,0.3, 0.85); if (length(q - vec2(0.0,0.36)) < 0.08) r = vec4(1.0,0.9,0.4, 1.0); } }
        else { float d = box(q, vec2(0.0,0.22), vec2(0.42,0.18), 0.04), l = box(q, vec2(0.0,0.62), vec2(0.42,0.08), 0.03); if (d < 0.0) { r = vec4(0.6,0.38,0.18, 0.45); rr = 11; if (q.y > 0.3) r = vec4(0.15,0.1,0.06, 0.2); } if (l < 0.0) { r = vec4(0.72,0.45,0.2, 0.6); rr = 11; } }
        sh = 0.4;
      } else if (kd == 8 || kd == 9 || kd == 10 || kd == 17) { // pickups
        float bob = 0.08*sin(t*4.0 + E.x*5.0);
        if (kd == 9) { float d = heart((q - vec2(0.0, 0.15 + bob)) / 0.32); if (d < 0.0) r = vec4(1.0,0.25,0.35, 0.85); rr = 0; }
        if (kd == 17) { float d = heart((q - vec2(0.0, 0.3 + bob)) / 0.6); if (d < 0.0) r = vec4(1.0,0.3,0.4, 0.75 + 0.25*sin(t*4.0)); rr = 0; }
        if (kd == 10) { vec2 g = q - vec2(0.0, 0.35 + bob); if (abs(g.x)*1.4 + abs(g.y) < 0.22) r = vec4(mix(vec3(0.3,1.0,0.8), vec3(0.4,0.7,1.0), F.x > 1.0 ? 1.0 : 0.0), 0.8 + 0.2*sin(t*6.0)); rr = 8; }
        if (kd == 8) { vec2 g = q - vec2(0.0, 0.3 + bob); if (abs(length(g - vec2(0.0,0.2)) - 0.1) < 0.04 || (abs(g.x) < 0.04 && g.y < 0.12 && g.y > -0.2)) r = vec4(1.0,0.85,0.3, 0.9); rr = 0; }
        sh = 0.3;
      } else if (kd == 11) { // block
        float d = box(q, vec2(0.0,0.45), vec2(0.47,0.45), 0.05);
        if (d < 0.0) { float edge = -d; r = vec4(F.x > 0.5 ? vec3(0.55,0.85,0.6) : vec3(0.65,0.65,0.7), edge < 0.08 ? 0.35 : 0.55 + 0.2*n1); rr = 4; if (q.y > 0.75) r.a += 0.2; }
        sh = 0.5;
      } else if (kd == 12) { // ember golem
        bool burn = E.w < 0.5;
        float body = length((q - vec2(0.0, 1.05)) / vec2(1.05, 0.95)), head = length(q - vec2(0.0, 2.25)) - 0.5;
        float arms = min(seg(q, vec2(-0.95,1.5), vec2(-1.35,0.6)), seg(q, vec2(0.95,1.5), vec2(1.35,0.6))) - 0.25;
        if (body < 1.0 || head < 0.0 || arms < 0.0) {
          float l = 0.45 + 0.4*n1;
          r = burn ? vec4(mix(vec3(0.9,0.35,0.1), vec3(1.0,0.7,0.2), n1), l + 0.25) : vec4(vec3(0.45,0.48,0.55), l*0.8); rr = burn ? 4 : 4;
          if (length(q - vec2(-0.18, 2.3)) < 0.1 || length(q - vec2(0.18, 2.3)) < 0.1) r = burn ? vec4(1.0,1.0,0.5, 1.0) : vec4(0.4,0.8,1.0, 0.9);
        }
        if (burn && r.a < 0.0) { float aura = length((q - vec2(0.0, 1.3)) / vec2(1.5, 1.6)); float fl = vn(vec2(q.x*3.0, q.y*3.0 - t*5.0)); if (aura < 1.0 && fl > 0.45 + aura*0.3) { r = vec4(mix(vec3(1.0,0.3,0.05), vec3(1.0,0.85,0.3), fl), 0.5 + 0.5*fl); rr = 10; } }
        if (F.x > 0.0 && r.a >= 0.0) r = vec4(1.0, 1.0, 1.0, 1.0);
        sh = 0.6;
      } else if (kd == 13) { // fireball
        float d = length(q - vec2(0.0, 0.45)); float fl = 0.5 + 0.5*sin(t*20.0 + E.x*7.0);
        if (d < 0.26) { r = vec4(mix(vec3(1.0,0.4,0.05), vec3(1.0,0.95,0.5), 1.0 - d*3.0), 0.8 + 0.2*fl); rr = 10; }
      } else if (kd == 14) { // sign / family note
        if (box(q, vec2(0.0, 0.62), vec2(0.36, 0.22), 0.03) < 0.0) { r = F.x > 0.5 ? vec4(0.75,0.9,1.0, 0.65 + 0.2*sin(t*3.0)) : vec4(0.85,0.68,0.45, 0.6); rr = 11; if (fract(q.y*9.0) < 0.35 && abs(q.x) < 0.26) r.a *= 0.55; }
        else if (abs(q.x) < 0.05 && q.y < 0.42 && q.y > -0.05) { r = vec4(0.5,0.35,0.22, 0.45); rr = 5; }
        sh = 0.3;
      } else if (kd == 15) { // sparkle ring
        float rad = E.w * 1.8, d = abs(length(q - vec2(0.0, 0.6)) - rad);
        if (d < 0.1 && h01(gc + ivec2(int(t*20.0), 0)) > 0.35) { r = vec4(F.x == 1.0 ? vec3(1.0,0.9,0.4) : F.x == 2.0 ? vec3(0.8,0.6,1.0) : F.x == 3.0 ? vec3(0.5,0.8,1.0) : F.x == 5.0 ? vec3(0.4,0.9,0.4) : vec3(1.0), 0.9 - E.w*0.4); rr = 8; }
      } else if (kd == 16) { // bush
        float d = length((q - vec2(0.0, 0.34)) / vec2(0.44, 0.36));
        if (d < 1.0) { vec3 nrm = normalize(vec3((q - vec2(0.0,0.34))/0.4, sqrt(max(0.0,1.0-d*d)))); float l = 0.3 + 0.7*max(0.0, dot(nrm, normalize(vec3(-0.5,0.6,0.7)))); r = vec4(mix(vec3(0.12,0.4,0.15), vec3(0.4,0.75,0.3), l)*amb, (0.25 + 0.6*l + 0.15*n1)*light); rr = 3; }
        sh = 0.4;
      }
      if (sh > 0.0) shadow = max(shadow, (1.0 - smoothstep(0.5, 1.0, length(q / vec2(kd == 12 ? 1.4 : 0.5, kd == 12 ? 0.5 : 0.2)))) * sh);
      if (r.a >= 0.0 && E.y < bestY) { bestY = E.y; obj = r; row = rr; if (kd != 16) obj.rgb *= mix(vec3(1.0), amb, 0.35); }
    }
    if (obj.a >= 0.0) { col = obj.rgb; bri = obj.a * (row == 3 ? 1.0 : mix(1.0, light, 0.4)); glyph = glyphOf(row, obj.a); }
    else {
      bri *= 1.0 - shadow;
      if (water && refl.a >= 0.0) { col = mix(col, refl.rgb*amb, 0.75); bri = refl.a*light*(0.75 + 0.25*sin(p.y*18.0 + t*3.0)); glyph = glyphOf(2, bri + 0.15); }
    }
    // fireflies at night, outside
    if (uDark < 0.5 && uNight > 0.3 && obj.a < 0.0) {
      vec2 fp = p * 0.9; ivec2 fc = ivec2(floor(fp)); float fh = h01(fc + ivec2(9, 99));
      if (fh > 0.85) { vec2 fpos = vec2(fc) + 0.5 + 0.35*vec2(sin(t*0.5 + fh*30.0), cos(t*0.37 + fh*50.0)); float dd = length(fp - fpos), bl = 0.5 + 0.5*sin(t*(1.2 + fh*2.5) + fh*40.0);
        if (dd < 0.09 && bl > 0.35) { col = vec3(0.9,1.0,0.45); bri = 1.0; glyph = glyphOf(8, 0.45 + 0.4*bl); } }
    }
    // rain
    if (uRain > 0.0) { float rain = h01(ivec2(int(cell.x), int(floor((cell.y + t*38.0 + float(int(cell.x)%7)*3.0) / 3.0)))); if (rain > 1.0 - 0.06*uRain) { col = vec3(0.6,0.75,1.0); bri = 0.7; glyph = rain > 0.985 ? 15.0 : 13.0; } }
    o = vec4(clamp(col * (0.35 + 0.9*bri), 0.0, 1.0), glyph / 255.0);
  }`;
  const DRAW = `#version 300 es
  precision highp float;
  uniform sampler2D uScene, uAtlas; uniform vec2 uCell, uRes; uniform float uDark;
  out vec4 o;
  void main(){
    vec2 g = gl_FragCoord.xy / uCell; ivec2 cell = ivec2(floor(g)); vec2 l = fract(g);
    vec4 s = texelFetch(uScene, cell, 0);
    int id = int(s.a*255.0 + 0.5), row = id / 10, colm = id - row*10;
    float a = texture(uAtlas, (vec2(float(colm), float(row)) + vec2(l.x, 1.0 - l.y)) / vec2(10.0, ${ROWS.length}.0)).r;
    vec2 v = gl_FragCoord.xy / uRes - 0.5; float vig = 1.0 - dot(v, v) * (uDark > 0.5 ? 1.6 : 0.7);
    o = vec4((vec3(0.012,0.02,0.016) + s.rgb * (a*1.15 + 0.05)) * vig, 1.0);
  }`;
  function prog(fs) {
    const pr = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(pr, s);
    }
    gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const u = {}; const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(pr, nm.endsWith(']') ? nm : gl.getActiveUniform(pr, i).name); }
    return { p: pr, u };
  }
  let P1, P2;
  try { P1 = prog(SCENE); P2 = prog(DRAW); } catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div class="err">Windsong Vale couldn’t start on this phone.<br><small>${String(e.message).slice(0, 300).replace(/</g, '&lt;')}</small><br><br><a href="./#play" style="color:#9fe">‹ Back</a></div>`); return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const mkTex = () => { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); return tx; };
  const atlasTex = mkTex();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas()); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const mapTex = mkTex();
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const sceneTex = mkTex(), fbo = gl.createFramebuffer();
  let W = 0, Hh = 0, cols = 0, rows = 0, cell = [8, 13], dpr = 1;
  function resize() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.round(innerWidth * dpr); Hh = Math.round(innerHeight * dpr); canvas.width = W; canvas.height = Hh;
    cell = [Math.max(6, Math.round(2.6 * dpr)), Math.max(10, Math.round(4.3 * dpr))];
    cols = Math.ceil(W / cell[0]); rows = Math.ceil(Hh / cell[1]);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  addEventListener('resize', resize); resize();

  const cam = { x: P.x, y: P.y + 1 };
  const eBuf = new Float32Array(MAXE * 4), fBuf = new Float32Array(MAXE * 4), lBuf = new Float32Array(MAXL * 3);
  function draw(T0) {
    if (dirty) { gl.bindTexture(gl.TEXTURE_2D, mapTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, MW, MH, 0, gl.RGBA, gl.UNSIGNED_BYTE, map); dirty = false; }
    const scale = 15 / Math.min(W, Hh);
    const viewW = W * scale, viewH = Hh * scale;
    // camera: rooms in the Hollow, follow you outside
    const room = P.room && ROOMS[P.room];
    let tx, ty;
    if (room) { const b = roomBox(P.room); tx = (b.x0 + b.x1) / 2; ty = (b.y0 + b.y1) / 2; if (viewW < RW) tx = Math.min(b.x1 - viewW / 2, Math.max(b.x0 + viewW / 2, P.x)); if (viewH < RH) ty = Math.min(b.y1 - viewH / 2, Math.max(b.y0 + viewH / 2, P.y)); }
    else { tx = Math.min(OW - viewW / 2, Math.max(viewW / 2, P.x)); ty = Math.min(MH - viewH / 2, Math.max(viewH / 2, P.y + 1)); if (viewW > OW) tx = OW / 2; }
    const k = Math.min(1, 1 / 60 * 6);
    if (Math.hypot(tx - cam.x, ty - cam.y) > 12) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
    // entities near the camera, sorted so the nearest are kept
    const near = ents.filter((e) => !e.hidden && Math.abs(e.x - cam.x) < viewW / 2 + 3 && Math.abs(e.y - cam.y) < viewH / 2 + 4).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)).slice(0, MAXE);
    eBuf.fill(0); fBuf.fill(0);
    near.forEach((e, i) => {
      let w = 0, f0 = 0, f1 = 0, f2 = 1, f3 = 0, y = e.y;
      if (e.k === K.YOU) { w = P.swing > 0 ? 1 - P.swing / 0.26 : 0; f0 = P.inv > 0 ? -999 + P.walk : P.walk; f1 = P.move; f2 = P.dx < -0.2 ? -1 : 1; f3 = Math.atan2(P.dy, P.dx); if (P.inv > 0 && Math.floor(T0 * 12) % 2) f0 = -999; else f0 = P.walk; }
      else if (e.k === K.NPC) { f0 = 0; f1 = 0; f2 = P.x < e.x ? -1 : 1; f3 = e.c; }
      else if (e.k === K.GHOST) { f2 = 1; }
      else if (e.k === K.CHEST) w = e.open ? 1 : 0;
      else if (e.k === K.GOLEM) { w = e.state === 'wet' ? 1 : 0; f0 = e.flash > 0 ? 1 : 0; }
      else if (e.k === K.BLOCK) f0 = tget(e.tx, e.ty) === T.PLATE ? 1 : 0;
      else if (e.k === K.NOTE) f0 = e.fam && e.note.by !== me && !H.talked['n' + e.note.id] ? 1 : 0;
      else if (e.k === K.SPARK) { w = Math.max(0, e.t) / e.life; f0 = e.c; }
      else if (e.k === K.GLINT) f0 = e.n || 1;
      else if (e.k === K.BLOB && e.flash > 0) y = e.y + 0.05;
      eBuf.set([e.x, y, e.k, w], i * 4); fBuf.set([f0, f1, f2, f3], i * 4);
    });
    // lights: torches, fire, your lantern (at night or underground)
    const lights = [];
    const dark = P.x >= DX - 2;
    if (dark || night > 0.3) lights.push([P.x, P.y + 0.8, dark ? 0.9 : 0.55 * night]);
    for (let y = Math.floor(cam.y - viewH / 2 - 2); y < cam.y + viewH / 2 + 2 && lights.length < MAXL; y++) for (let x = Math.floor(cam.x - viewW / 2 - 2); x < cam.x + viewW / 2 + 2 && lights.length < MAXL; x++) {
      const t = tget(x, y);
      if (t === T.TORCH) lights.push([x + 0.5, y + 0.6, 0.75 + 0.1 * Math.sin(T0 * 9 + x)]);
      else if (t === T.FIRE && (x + y) % 3 === 0) lights.push([x + 0.5, y + 0.5, 0.5]);
    }
    for (const e of near) if ((e.k === K.GOLEM && e.state === 'burn') || e.k === K.FIRE) { if (lights.length < MAXL) lights.push([e.x, e.y + 1, e.k === K.GOLEM ? 1.0 : 0.6]); }
    lBuf.fill(0); lights.forEach((l, i) => lBuf.set([l[0], l[1], l[2]], i * 3));
    // pass 1
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, cols, rows); gl.useProgram(P1.p);
    const u = P1.u;
    gl.uniform2f(u.uRes, cols * cell[0], rows * cell[1]); gl.uniform2f(u.uCell, cell[0], cell[1]); gl.uniform2f(u.uCam, cam.x, cam.y);
    gl.uniform1f(u.uScale, scale); gl.uniform1f(u.uTime, T0); gl.uniform1f(u.uNight, dark ? 0 : night); gl.uniform1f(u.uDark, dark ? 1 : 0); gl.uniform1f(u.uRain, rainT > 0 ? Math.min(1, rainT / 2) : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mapTex); gl.uniform1i(u.uMap, 0); gl.uniform2i(u.uMapSize, MW, MH);
    gl.uniform4fv(u.uE, eBuf); gl.uniform4fv(u.uF, fBuf); gl.uniform1i(u.uNE, near.length);
    gl.uniform3fv(u.uL, lBuf); gl.uniform1i(u.uNL, lights.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // pass 2
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hh); gl.useProgram(P2.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.uniform1i(P2.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(P2.u.uAtlas, 1);
    gl.uniform2f(P2.u.uCell, cell[0], cell[1]); gl.uniform2f(P2.u.uRes, W, Hh); gl.uniform1f(P2.u.uDark, dark ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // name tags for family
    const tags = near.filter((e) => e.k === K.GHOST || e.k === K.NPC).slice(0, 8);
    const box = $('tags');
    box.innerHTML = tags.map((e) => { const sx = ((e.x - cam.x) / scale + (cols * cell[0]) / 2) / dpr, sy = (Hh - ((e.y + 1.85 - cam.y) / scale + (rows * cell[1]) / 2)) / dpr; return `<span class="${e.k === K.GHOST ? 'ghost' : ''}" style="left:${sx}px;top:${sy}px">${esc(e.k === K.GHOST ? '👻 ' + e.name : e.name)}</span>`; }).join('');
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ================= Sound ================= */
  let AC = null, muted = localStorage.getItem('vale-mute') === '1';
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { AC = null; } } return AC; };
  function tone(freq, dur = 0.2, type = 'square', vol = 0.06, when = 0, slide = 0) {
    const a = ac(); if (!a || muted) return;
    const t0 = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function flute(freq, when = 0, dur = 0.45) {
    const a = ac(); if (!a || muted) return;
    const t0 = a.currentTime + when, o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
    o.type = 'sine'; o.frequency.value = freq; lfo.frequency.value = 5.5; lg.gain.value = freq * 0.006; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.04); g.gain.setValueAtTime(0.14, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination); o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  }
  const melody = (notes) => [...notes].forEach((n, i) => flute(NOTES[n], 0.5 + i * 0.22, 0.32));
  function sfx(k) {
    if (k === 'swish') tone(900, 0.09, 'sawtooth', 0.025, 0, -600);
    if (k === 'hit') { tone(220, 0.08, 'square', 0.05); tone(160, 0.1, 'square', 0.04, 0.05); }
    if (k === 'cut') tone(500, 0.06, 'triangle', 0.04, 0, -300);
    if (k === 'hurt') tone(300, 0.25, 'sawtooth', 0.05, 0, -200);
    if (k === 'pick') { tone(988, 0.07, 'square', 0.035); tone(1319, 0.1, 'square', 0.035, 0.07); }
    if (k === 'door') tone(110, 0.5, 'triangle', 0.08, 0, -50);
    if (k === 'push') tone(90, 0.2, 'triangle', 0.06);
    if (k === 'clank') tone(1200, 0.06, 'square', 0.03);
    if (k === 'fire') tone(200, 0.3, 'sawtooth', 0.03, 0, 300);
    if (k === 'hiss') tone(3000, 0.6, 'sawtooth', 0.015, 0, -2500);
    if (k === 'roar') tone(140, 0.7, 'sawtooth', 0.07, 0, -80);
    if (k === 'fanfare') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.04, i * 0.11));
  }

  /* ================= HUD + controls ================= */
  function renderHud() {
    const full = Math.floor(H.hearts / 2), half = H.hearts % 2, empty = Math.floor((H.max - H.hearts) / 2);
    $('hp').textContent = '♥'.repeat(full) + (half ? '❥' : '') + '♡'.repeat(empty);
    $('gl').textContent = '◆ ' + H.glints;
    $('ky').textContent = (H.keys ? '🗝️' + H.keys : '') + (H.ember ? ' 🔥🗝️' : '');
    $('bFlute').hidden = !H.flute;
    $('bSound').textContent = muted ? '🔇' : '🔊';
  }
  let msgT = 0;
  function say(t) { const m = $('msg'); m.textContent = t; m.style.opacity = 1; clearTimeout(msgT); msgT = setTimeout(() => { m.style.opacity = 0; }, 3200); }
  function renderDialog() {
    document.querySelector('.dlg')?.remove();
    if (!dlg) return;
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `${dlg.name ? `<b>${esc(dlg.name)}</b>` : ''}${esc(dlg.lines[0])}${dlg.choices ? '' : '<i>tap ▸</i>'}`;
    if (dlg.choices) { const c = document.createElement('div'); c.className = 'choices'; dlg.choices.forEach(([lab, fn]) => { const b = document.createElement('button'); b.textContent = lab; b.onclick = (ev) => { ev.stopPropagation(); dlg = null; renderDialog(); fn(); }; c.appendChild(b); }); d.appendChild(c); }
    else d.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); nextLine(); });
    document.body.appendChild(d);
  }
  let fluteOpen = false;
  function openFlute() { if (!H.flute || dlg) return; fluteOpen = true; played = ''; renderFlute(); }
  function closeFlute() { fluteOpen = false; document.querySelector('.flute')?.remove(); }
  function renderFlute() {
    if (!fluteOpen) return;
    let el = document.querySelector('.flute');
    if (!el) {
      el = document.createElement('div'); el.className = 'flute';
      el.innerHTML = `<button class="x" aria-label="Put the flute away">✕</button><div class="played"></div><div class="notes">${Object.keys(NOTES).map((n) => `<button data-n="${n}" aria-label="Note ${n}">${n}</button>`).join('')}</div><div class="book"></div>`;
      el.querySelector('.x').addEventListener('click', closeFlute);
      el.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 150); playNote(b.dataset.n); }));
      el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      document.body.appendChild(el);
    }
    el.querySelector('.played').textContent = played || '·';
    el.querySelector('.book').innerHTML = H.songs.map((id) => `🎵 <b>${esc(SONGS[id].name)}</b> <span>${SONGS[id].notes}</span> — ${esc(SONGS[id].what)}`).join('<br>') || '';
  }
  const NOTE_TEXTS = ['Try the flute here! 🎵', 'Danger ahead! ⚠️', 'Secret nearby 👀', 'Push the block! 🧱', 'You can do it! 💪', 'Hearts here ♥', 'Go this way ➡️', 'I was here! 👋'];
  function leaveNote() {
    if (dlg || fluteOpen) return;
    dlg = { name: 'Leave a note for the family', lines: ['Pick a note to leave right here:'], choices: NOTE_TEXTS.map((tx) => [tx, () => {
      const mine = V.notes.filter((n) => n.by === me);
      if (mine.length >= 5) V.notes = V.notes.filter((n) => n.id !== mine[0].id);
      const n = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), by: me, x: +(P.x + P.dx * 0.9).toFixed(2), y: +(P.y + P.dy * 0.9).toFixed(2), text: tx, at: Date.now() };
      V.notes.push(n); familyLayer(); save(); say('📝 Note left for the family');
    }]).concat([['Cancel', () => {}]]) };
    renderDialog();
  }
  function act() {
    if (dlg) { if (!dlg.choices) nextLine(); return; }
    if (fluteOpen) return;
    const t = actionTarget(); if (t) interact(t); else swing();
  }
  $('bSword').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (dlg && !dlg.choices) nextLine(); else swing(); });
  $('bAct').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); act(); });
  $('bFlute').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); fluteOpen ? closeFlute() : openFlute(); });
  $('bNote').addEventListener('click', (e) => { e.stopPropagation(); leaveNote(); });
  $('bSound').addEventListener('click', (e) => { e.stopPropagation(); muted = !muted; try { localStorage.setItem('vale-mute', muted ? '1' : '0'); } catch { /* fine */ } renderHud(); });
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(); keys.add(k);
    if (k === ' ' || k === 'j') { e.preventDefault(); if (dlg && !dlg.choices) nextLine(); else swing(); }
    if (k === 'enter' || k === 'e' || k === 'k') act();
    if (k === 'f') fluteOpen ? closeFlute() : openFlute();
    if (fluteOpen && '12345'.includes(k)) playNote(Object.keys(NOTES)['12345'.indexOf(k)]);
    unlockAudio();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  const stickEl = $('stick'), knob = stickEl.firstElementChild;
  canvas.addEventListener('pointerdown', (e) => { unlockAudio(); if (dlg && !dlg.choices) { nextLine(); return; } stick.on = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knob.style.transform = ''; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!stick.on || e.pointerId !== stick.id) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const m = Math.hypot(dx, dy), k = m > 45 ? 45 / m : 1; dx *= k; dy *= k; stick.x = dx / 45; stick.y = -dy / 45; knob.style.transform = `translate(${dx}px,${dy}px)`; });
  const up = (e) => { if (e.pointerId !== stick.id) return; stick.on = false; stick.x = stick.y = 0; stickEl.style.display = 'none'; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  function unlockAudio() { const a = ac(); if (a && a.state === 'suspended') a.resume(); }
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  /* ================= Title screen with the Hall of Heroes ================= */
  function title() {
    const heroes = Object.entries(V.heroes || {}).filter(([id]) => members.some((m) => m.id === id));
    const row = ([id, h]) => `${esc(members.find((m) => m.id === id)?.emoji || '🙂')} <b>${esc(nameOf(id))}</b> — ${'♥'.repeat(Math.round((h.max || 6) / 2))} · ${(h.songs || []).length}/3 songs${h.boss ? ' · 🏆 beat the Ember Golem' : ''}`;
    const el = document.createElement('div'); el.className = 'title';
    el.innerHTML = `<div><h1>WINDSONG<br>VALE</h1><p>A family adventure in letters.<br>Doors anyone opens stay open for everyone.</p>
      <button class="go">${H.pos ? '▶ Continue' : '▶ Begin'} as ${esc(meM.name)}</button>
      ${heroes.length ? `<div class="hall"><b>🏰 Hall of Heroes</b><br>${heroes.map(row).join('<br>')}</div>` : ''}
      <p style="margin-top:16px;font-size:11.5px;opacity:.6">Drag to walk · ⚔️ sword · ✋ talk / open · 🎵 flute</p></div>`;
    el.querySelector('.go').addEventListener('click', () => { unlockAudio(); el.remove(); if (!H.flute) say('💬 Find Elder Mira in the village (she’s by the purple-roofed house)'); });
    document.body.appendChild(el);
  }

  /* ================= Loop ================= */
  renderHud(); title();
  const t0 = performance.now(); let last = t0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    draw((now - t0) / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // test hooks
  window.__vale = { P, H, V, ents: () => ents, T, K, tget, spots, doorAt, ROOMS, roomBox, SONGS, playNote, songEffect, interact, actionTarget, act, swing, save, isOpen, openFlute, closeFlute, get dlg() { return dlg; }, nextLine, set night(v) { night = nightTo = v; }, get night() { return night; }, leaveNote, update };
})();
