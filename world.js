/* Squishvale — a 2D open world to explore together and catch squishies in the wild.
   One shared map (8 regions, one per chapter) built from a fixed seed so every phone sees the same world.
   Canvas renderer with cached tile chunks; DOM overlays for dialogue, catching and mini-games.
   Progress lives in state.world[memberId]; live positions go through live.js. Loaded after live.js. */
'use strict';

/* =========================================================
   1 · World generation
   ========================================================= */
const RW = 36, RH = 28, MW = RW * 4, MH = RH * 2;
const REG_POS = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1]];
const T = { GRASS: 0, TALL: 1, PATH: 2, WATER: 3, TREE: 4, FLOWER: 5, ROCK: 6, SAND: 7, BRIDGE: 8, FENCE: 9, CROP: 10, SNOW: 11, ICE: 12, VOID: 13, CLOUD: 14, GRAVE: 15, DEAD: 16, PLANK: 17, PINE: 18, CHECK: 19, PALM: 20 };
const SOLID_T = new Set([T.WATER, T.TREE, T.ROCK, T.FENCE, T.CROP, T.VOID, T.GRAVE, T.DEAD, T.PINE, T.PALM]);
const wRand = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function gatesOf(c) {
  // Openings (in region-local coords) toward the previous and next chapter
  const out = [];
  for (const [o, dir] of [[c - 1, 'in'], [c + 1, 'out']]) {
    if (o < 0 || o > 7) continue;
    const [ax, ay] = REG_POS[c], [bx, by] = REG_POS[o];
    const side = bx > ax ? 'E' : bx < ax ? 'W' : by > ay ? 'S' : 'N';
    out.push({ side, dir, to: o });
  }
  return out;
}
function gateCells(side) {
  const mid = side === 'E' || side === 'W' ? 13 : 17;
  return [0, 1, 2].map((k) => (side === 'E' ? [RW - 1, mid + k] : side === 'W' ? [0, mid + k] : side === 'S' ? [mid + k, RH - 1] : [mid + k, 0]));
}
const gateInner = (side) => (side === 'E' ? [RW - 4, 14] : side === 'W' ? [3, 14] : side === 'S' ? [18, RH - 4] : [18, 3]);

function buildWorld() {
  const tiles = new Uint8Array(MW * MH);
  const objs = [];
  const at = (x, y) => tiles[y * MW + x];
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MW && y < MH) tiles[y * MW + x] = t; };
  WREG.forEach((R, c) => {
    const [cx, cy] = REG_POS[c], ox = cx * RW, oy = cy * RH;
    const rand = wRand(9001 + c * 7919);
    const G = T[R.ground];
    const W = T[R.wall];
    const res = new Uint8Array(RW * RH); // 1 = keep clear, 2 = path, 3 = solid (buildings etc.)
    const L = (x, y) => (x < 0 || y < 0 || x >= RW || y >= RH ? 3 : res[y * RW + x]);
    const mark = (x, y, v) => { if (x >= 0 && y >= 0 && x < RW && y < RH && res[y * RW + x] < v) res[y * RW + x] = v; };
    const put = (x, y, t) => set(ox + x, oy + y, t);
    const get = (x, y) => at(ox + x, oy + y);
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) put(x, y, G);
    // Border: a thick natural wall
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const d = Math.min(x, y, RW - 1 - x, RH - 1 - y);
      if (d === 0 || (d === 1 && rand() < 0.55)) put(x, y, W);
    }
    // The sea along the north shore
    if (R.sea) for (let x = 0; x < RW; x++) { const depth = 6 + Math.round(Math.sin(x * 0.45) * 0.8 + rand() * 0.6); for (let y = 0; y < depth; y++) put(x, y, T.WATER); }
    // Gates: open the wall where the road crosses
    const gates = gatesOf(c);
    for (const g of gates) for (const [gx, gy] of gateCells(g.side)) {
      const dx = g.side === 'E' ? -1 : g.side === 'W' ? 1 : 0, dy = g.side === 'S' ? -1 : g.side === 'N' ? 1 : 0;
      for (let k = 0; k < 4; k++) { put(gx + dx * k, gy + dy * k, T.PATH); mark(gx + dx * k, gy + dy * k, 2); }
    }
    // Landmarks
    for (const b of R.buildings || []) {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { put(x, y, G === T.SAND ? T.SAND : G); mark(x, y, 3); }
      for (let x = b.x - 1; x <= b.x + b.w; x++) mark(x, b.y + b.h, 1);
      objs.push({ type: 'bld', ...b, x: ox + b.x, y: oy + b.y, c, door: b.kind === 'ferris' ? null : [ox + b.x + Math.floor(b.w / 2), oy + b.y + b.h] });
    }
    if (R.sea) { // lighthouse island + bridge
      for (let y = 0; y <= 4; y++) for (let x = 23; x <= 29; x++) { put(x, y, T.SAND); mark(x, y, Math.max(L(x, y), 1)); }
      for (let y = 5; y <= 8; y++) for (const x of [26, 27]) { put(x, y, get(x, y) === T.WATER ? T.BRIDGE : T.PATH); mark(x, y, 2); }
    }
    for (const [px, py, pr] of R.ponds || []) for (let y = py - pr; y <= py + pr; y++) for (let x = px - pr - 1; x <= px + pr + 1; x++) {
      if (((x - px) / (pr + 1)) ** 2 + ((y - py) / pr) ** 2 <= 1 + rand() * 0.15) { put(x, y, T.WATER); mark(x, y, 3); }
    }
    for (const [fx, fy, fw, fh] of R.fields || []) for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) {
      const edge = x === fx || y === fy || x === fx + fw - 1 || y === fy + fh - 1;
      const gap = y === fy && (x === fx + Math.floor(fw / 2) || x === fx + Math.floor(fw / 2) - 1);
      put(x, y, gap ? T.PATH : edge ? T.FENCE : (y - fy) % 2 ? T.CROP : G); mark(x, y, edge && !gap ? 3 : 1);
    }
    if (R.graveyard) { const [gx, gy, gw, gh] = R.graveyard; for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
      const edge = x === gx || y === gy || x === gx + gw - 1 || y === gy + gh - 1, gap = y === gy && Math.abs(x - (gx + gw / 2)) < 1.5;
      put(x, y, gap ? T.PATH : edge ? T.FENCE : (y - gy) % 3 === 2 && (x - gx) % 2 === 0 ? T.GRAVE : G); mark(x, y, edge && !gap ? 3 : 1);
    } }
    if (R.hollow) { const [hx, hy, hr] = R.hollow; for (let y = hy - hr - 1; y <= hy + hr + 1; y++) for (let x = hx - hr - 1; x <= hx + hr + 1; x++) {
      const d = Math.hypot(x - hx, y - hy); if (d > hr + 1.2) continue;
      if (d > hr && !(x > hx && Math.abs(y - hy) <= 1)) { put(x, y, T.TREE); mark(x, y, 3); } else { put(x, y, T.FLOWER); mark(x, y, 1); }
    } }
    if (R.plaza) { const [hx, hy] = R.hub; for (let y = hy - R.plaza; y <= hy + R.plaza; y++) for (let x = hx - R.plaza - 3; x <= hx + R.plaza + 3; x++) if (L(x, y) < 3 && Math.abs(x - hx) / (R.plaza + 3) + Math.abs(y - hy) / R.plaza <= 1.25) { put(x, y, T.CHECK); mark(x, y, 2); } }
    if (R.chasm) { const [a, b] = R.chasm; for (let y = 1; y < RH - 1; y++) for (let x = a + (y % 5 === 0 ? 1 : 0); x <= b - (y % 7 === 0 ? 1 : 0); x++) { put(x, y, T.VOID); mark(x, y, 1); } }
    let iceInfo = null;
    if (R.ice) iceInfo = buildIce(R, put, mark, rand, ox, oy);
    for (const z of R.zones || []) objs.push({ type: 'zone', id: z.id, x: ox + z.x, y: oy + z.y, w: z.w, h: z.h, c });
    // Paths: gates → hub, then every door / person / item to the nearest path
    const solidFor = (x, y, opt) => { const v = L(x, y); if (v === 3) return true; const t = get(x, y); if (t === T.WATER || t === T.FENCE || t === T.GRAVE || t === T.CROP || t === T.ICE) return true; if (opt.noVoid && t === T.VOID) return true; return false; };
    const carve = (sx, sy, targetFn, opt = {}) => {
      const prev = new Int32Array(RW * RH).fill(-1), seen = new Uint8Array(RW * RH);
      const q = [sy * RW + sx]; seen[q[0]] = 1; let found = -1;
      for (let qi = 0; qi < q.length; qi++) {
        const cur = q[qi], x = cur % RW, y = (cur / RW) | 0;
        if (qi > 0 && targetFn(x, y)) { found = cur; break; }
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (hash2(x + c, y) > 0.5) dirs.reverse();
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 1 || ny < 1 || nx > RW - 2 || ny > RH - 2) { if (!(L(nx, ny) === 2)) continue; }
          const k = ny * RW + nx;
          if (seen[k] || solidFor(nx, ny, opt)) continue;
          seen[k] = 1; prev[k] = cur; q.push(k);
        }
      }
      if (found < 0) return;
      for (let k = found; k >= 0 && k !== sy * RW + sx; k = prev[k]) {
        const x = k % RW, y = (k / RW) | 0;
        const t = get(x, y);
        if (opt.trail) { if (L(x, y) < 1) { mark(x, y, 1); if (SOLID_T.has(t) || t === T.TALL) put(x, y, G); } continue; }
        put(x, y, t === T.VOID || t === T.CLOUD ? T.CLOUD : t === T.CHECK ? T.CHECK : t === T.BRIDGE ? T.BRIDGE : T.PATH); mark(x, y, 2);
      }
    };
    const [hx, hy] = R.hub;
    put(hx, hy, R.plaza ? T.CHECK : T.PATH); mark(hx, hy, 2);
    for (const g of gates) { const [ix, iy] = gateInner(g.side); carve(ix, iy, (x, y) => x === hx && y === hy, { noVoid: !(R.chasm && g.side === 'W') }); }
    if (R.chasm) { const [ix, iy] = gateInner('W'); carve(ix, iy, (x, y) => L(x, y) === 2 && x > R.chasm[1], {}); }
    if (iceInfo) { const [ax, ay] = [iceInfo.entry[0] + 1, iceInfo.entry[1]], [bx, by] = [iceInfo.exit[0] - 1, iceInfo.exit[1]]; put(ax, ay, T.PATH); mark(ax, ay, 2); put(bx, by, T.PATH); mark(bx, by, 2); carve(ax, ay, (x, y) => L(x, y) === 2 && !(x === ax && y === ay) && !(x === iceInfo.entry[0] && y === iceInfo.entry[1]), {}); carve(iceInfo.exit[0] - 1, iceInfo.exit[1], (x, y) => x === iceInfo.castleDoor[0] && y === iceInfo.castleDoor[1], {}); }
    const toPath = (x, y, opt) => { if (L(x, y) === 2) return; mark(x, y, 1); carve(x, y, (a, b) => L(a, b) === 2, opt); };
    for (const b of R.buildings || []) if (b.kind !== 'ferris') { const dx = b.x + Math.floor(b.w / 2), dy = b.y + b.h; mark(dx, dy, 1); put(dx, dy, R.plaza ? T.CHECK : T.PATH); toPath(dx, dy, { noVoid: true }); }
    const people = [...(R.npcs || []), ...(R.specials || [])];
    for (const n of people) { put(n.x, n.y, get(n.x, n.y) === T.VOID ? T.GRASS : get(n.x, n.y)); toPath(n.x, n.y, { noVoid: true, trail: true }); for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) mark(n.x + dx, n.y + dy, 1); }
    for (const it of R.items || []) toPath(it.x, it.y, { noVoid: true, trail: true });
    if (R.stop) { mark(R.stop[0], R.stop[1], 3); toPath(R.stop[0], R.stop[1] + 1, { noVoid: true, trail: true }); }
    for (const z of R.zones || []) for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) mark(x, y, 1);
    // Nature: tall grass meadows, trees, flowers, rocks
    const free = (x, y) => x > 1 && y > 1 && x < RW - 2 && y < RH - 2 && L(x, y) === 0 && get(x, y) === G;
    let tries = 0, placed = 0;
    while (placed < (R.grass || 5) && tries++ < 400) {
      const gx = 3 + Math.floor(rand() * (RW - 6)), gy = 3 + Math.floor(rand() * (RH - 6)), rx = 2 + Math.floor(rand() * 3), ry = 2 + Math.floor(rand() * 2);
      if (!free(gx, gy)) continue;
      let n = 0;
      for (let y = gy - ry; y <= gy + ry; y++) for (let x = gx - rx; x <= gx + rx; x++) if (((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 <= 1 + (hash2(x, y + c) - 0.5) * 0.5 && free(x, y)) { put(x, y, T.TALL); n++; }
      if (n > 4) placed++;
    }
    for (let k = 0; k < (R.trees || 6); k++) {
      const tx = 2 + Math.floor(rand() * (RW - 4)), ty = 2 + Math.floor(rand() * (RH - 4)), n = 2 + Math.floor(rand() * 5);
      for (let j = 0; j < n; j++) { const x = tx + Math.floor(rand() * 4) - 1, y = ty + Math.floor(rand() * 3) - 1; if (free(x, y)) put(x, y, W === T.ROCK ? T.TREE : W); }
    }
    for (let k = 0; k < (R.rocks || 2); k++) { const x = 2 + Math.floor(rand() * (RW - 4)), y = 2 + Math.floor(rand() * (RH - 4)); if (free(x, y)) put(x, y, T.ROCK); }
    for (let y = 2; y < RH - 2; y++) for (let x = 2; x < RW - 2; x++) if (free(x, y) && hash2(x * 3 + c, y * 7) < 0.06) put(x, y, T.FLOWER);
    // Objects: people, guardians, items, stop, blocker
    for (const n of R.npcs || []) objs.push({ type: n.guardian ? 'guardian' : n.bell ? 'bell' : 'npc', ...n, x: ox + n.x, y: oy + n.y, c });
    for (const s of R.specials || []) objs.push({ type: 'special', ...s, x: ox + s.x, y: oy + s.y, c });
    for (const it of R.items || []) objs.push({ type: 'item', ...it, x: ox + it.x, y: oy + it.y, c });
    if (R.stop) objs.push({ type: 'stop', id: 'stop' + c, x: ox + R.stop[0], y: oy + R.stop[1], c });
    const out = gates.find((g) => g.dir === 'out');
    if (out && R.blocker) { const cells = gateCells(out.side).map(([x, y]) => [ox + x + (out.side === 'E' ? -1 : out.side === 'W' ? 1 : 0), oy + y + (out.side === 'S' ? -1 : out.side === 'N' ? 1 : 0)]); objs.push({ type: 'blocker', kind: R.blocker, cells, x: cells[1][0], y: cells[1][1], c }); }
    if (iceInfo) Object.assign(R, { _ice: iceInfo });
  });
  const occ = new Map();
  for (const o of objs) {
    if (o.type === 'bld') { for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) occ.set(x + ',' + y, o); }
    else if (o.type === 'blocker') for (const [x, y] of o.cells) occ.set(x + ',' + y, o);
    else if (o.type !== 'item' && o.type !== 'zone') occ.set(o.x + ',' + o.y, o);
  }
  return { tiles, objs, occ, at: (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? T.TREE : tiles[y * MW + x]) };
}

// Slippy Slopes: an ice field you cross by sliding. Rocks are placed from the seed until the puzzle is solvable.
function buildIce(R, put, mark, rand, ox, oy) {
  const [ix, iy, iw, ih] = R.ice, ey = iy + Math.floor(ih / 2);
  const entry = [ix + iw, ey], exit = [ix - 1, ey];
  for (let y = iy - 1; y <= iy + ih; y++) for (let x = ix - 1; x <= ix + iw; x++) {
    const ring = x === ix - 1 || x === ix + iw || y === iy - 1 || y === iy + ih;
    if (ring) { if ((x === entry[0] && y === entry[1]) || (x === exit[0] && y === exit[1])) { put(x, y, T.SNOW); mark(x, y, 2); } else { put(x, y, T.PINE); mark(x, y, 3); } }
    else { put(x, y, T.ICE); mark(x, y, 3); }
  }
  // The only way to the castle is across the ice (no walking around it)
  for (let y = 1; y < 27; y++) if (y < iy - 1 || y > iy + ih) { put(ix - 1, y, T.PINE); mark(ix - 1, y, 3); }
  let rocks = [];
  for (let attempt = 0; attempt < 4000; attempt++) {
    rocks = [];
    for (let y = iy; y < iy + ih; y++) for (let x = ix; x < ix + iw; x++) if (rand() < 0.11) rocks.push([x, y]);
    const sol = iceSolve(R.ice, rocks, entry, exit);
    if (sol && sol.length >= 6 && iceSolve(R.ice, rocks, exit, entry)) break; // solvable both ways, so you can get back
  }
  for (const [x, y] of rocks) put(x, y, T.ROCK);
  const castle = (R.buildings || []).find((b) => b.kind === 'castle');
  return { entry, exit, rocks, castleDoor: [castle.x + Math.floor(castle.w / 2), castle.y + castle.h], g: { entry: [ox + entry[0], oy + entry[1]], exit: [ox + exit[0], oy + exit[1]] } };
}
function iceSolve([ix, iy, iw, ih], rocks, entry, exit) {
  const rock = new Set(rocks.map(([x, y]) => x + ',' + y));
  const inside = (x, y) => x >= ix && y >= iy && x < ix + iw && y < iy + ih;
  const open = (x, y) => (inside(x, y) && !rock.has(x + ',' + y)) || (x === entry[0] && y === entry[1]) || (x === exit[0] && y === exit[1]);
  const key = (x, y) => x + ',' + y, seen = new Map([[key(...entry), null]]), q = [entry];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === exit[0] && y === exit[1]) { const path = []; for (let k = key(x, y); seen.get(k); k = seen.get(k)) path.push(k); return path; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let cx = x, cy = y;
      while (open(cx + dx, cy + dy)) { cx += dx; cy += dy; if (!inside(cx, cy)) break; }
      if (cx === x && cy === y) continue;
      const k = key(cx, cy);
      if (!seen.has(k)) { seen.set(k, key(x, y)); q.push([cx, cy]); }
    }
  }
  return null;
}

/* =========================================================
   2 · Progress & rules
   ========================================================= */
const WG = { world: null, cv: null, ctx: null, layer: null, raf: 0, ts: 40, dpr: 1, chunks: new Map(), imgs: new Map(), lockN: 0,
  epoch: 0, marks: [], pos: null, move: null, path: [], hold: null, steps: 0, lastEnc: 0, roamers: [], others: {}, parts: [], saveT: 0, region: -1, emote: null, debug: { autoWin: false } };
// Busy = a story step is running or any overlay (dialogue, catch, game, card, menu) is open.
Object.defineProperty(WG, 'busy', { get: () => WG.lockN > 0 || !!WG.layer?.querySelector('.wdlg, .wenc, .wgame, .wcard, .wmenu') });
const wLock = () => { WG.lockN++; }, wUnlock = () => { WG.lockN = Math.max(0, WG.lockN - 1); };
const getWorld = () => (WG.world ||= buildWorld());
const regionAt = (x, y) => { const cx = Math.floor(x / RW), cy = Math.floor(y / RH); return REG_POS.findIndex(([a, b]) => a === cx && b === cy); };
function wMe() {
  const me = actor();
  if (!me) return null;
  if (!state.world || typeof state.world !== 'object' || Array.isArray(state.world)) state.world = {};
  let p = state.world[me]; if (!p || typeof p !== 'object' || Array.isArray(p)) p = state.world[me] = {};
  if (!p.ch) {
    const [sx, sy] = WREG[0].start;
    Object.assign(p, { x: sx, y: sy, d: 'down', ch: 1, step: 0, cnt: 0, flags: {}, items: {}, bubbles: 5, bDay: today(), visited: {}, done: [], guide: {}, sides: {}, intro: false });
  }
  // Repair old or damaged progress so the game can always continue
  for (const k of ['flags', 'items', 'visited', 'guide', 'sides']) if (!p[k] || typeof p[k] !== 'object') p[k] = {};
  if (!Array.isArray(p.done) || p.done.some((n) => typeof n !== 'number')) p.done = [...new Set(Object.values(p.done || {}).map(Number))].filter((n) => n >= 1 && n <= 8);
  if (typeof p.ch !== 'number' || !(p.ch >= 1 && p.ch <= 9)) p.ch = Math.min(9, Math.max(1, Math.floor(Number(p.ch)) || 1));
  if (typeof p.step !== 'number' || !(p.step >= 0)) p.step = Math.max(0, Math.floor(Number(p.step)) || 0);
  if (p.ch <= 8 && p.step >= STORY[p.ch].length) p.step = STORY[p.ch].length - 1; // story got shorter in an update: replay its last step
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= MW || p.y >= MH) [p.x, p.y] = WREG[0].start;
  if (typeof p.bubbles !== 'number' || !(p.bubbles >= 0)) p.bubbles = 5;
  if (p.bDay !== today()) { p.bubbles += 5; p.bDay = today(); if (WG.layer && !WG.layer.hidden) setTimeout(() => { updateHud(); floatText('+5 🫧'); save(); }); }
  return p;
}
const chDone = (p, ch) => (p.done || []).includes(ch) || p.ch > ch;
const curStep = (p) => (p.ch <= 8 ? STORY[p.ch][p.step] : null);
const hasCloud = (p) => p.flags.clouds || chDone(p, 6);
const objVisible = (o, p) => {
  if (o.when && !o.when(p)) return false;
  if (o.type === 'blocker') return !chDone(p, o.c + 1);
  if (o.type === 'item') {
    if (o.lantern) return true;
    const s = curStep(p);
    return !p.flags['it:' + o.id] && s && s.collect === o.group && p.ch === o.c + 1;
  }
  if (o.type === 'special') return true;
  return true;
};
function blockedAt(x, y, p) {
  const w = getWorld(), t = w.at(x, y);
  if (t === T.CLOUD) { if (!hasCloud(p)) return true; } else if (SOLID_T.has(t)) return true;
  const o = w.occ.get(x + ',' + y);
  if (o && objVisible(o, p)) return true;
  if (WG.roamers.some((r) => r.x === x && r.y === y && r.on)) return true;
  if (itemAt(x, y, p)?.group === 'escapee') return true;
  return false;
}
const itemAt = (x, y, p) => getWorld().objs.find((o) => o.type === 'item' && o.x === x && o.y === y && objVisible(o, p) && !(o.lantern && p.flags['it:' + o.id]));
const objById = (id) => getWorld().objs.find((o) => o.id === id);
const fill = (s, p) => String(s).replace(/\{you\}/g, member(actor())?.name || 'Ranger');

/* =========================================================
   3 · Images (avatars & squishies drawn from the app's own SVG art)
   ========================================================= */
function svgImg(key, make) {
  let im = WG.imgs.get(key);
  if (im) return im.complete && im.naturalWidth ? im : null;
  im = new Image();
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(make().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  WG.imgs.set(key, im);
  return null;
}
const lookOf = (k) => ({ ...NPC_BASE, ...(NPC_LOOK[k] || {}) });
const avImg = (a) => svgImg('a:' + JSON.stringify(a), () => avatarSVG(a, { noShadow: true }));
const sqImg = (sid, shiny) => (SQ[sid] ? svgImg('s:' + sid + (shiny ? '*' : ''), () => squishySVG(sid, { shiny })) : null);
function guardianSid(o) {
  if (o._sid) return o._sid;
  const g = o.guardian || {};
  const pool = SQUISHIES.filter((s) => s.r !== 'U' && (g.set ? s.set === g.set : s.kind === 'niddo') && (!g.sp || s.sp === g.sp));
  const rank = { M: 5, L: 4, E: 3, R: 2, C: 1 };
  pool.sort((a, b) => rank[b.r] - rank[a.r]);
  return (o._sid = (pool[0] || SQUISHIES[0]).id);
}
const specialSid = (o) => o._sid || (o._sid = (SQUISHIES.find((s) => s.sp === 'penguin' && s.r === 'C') || SQUISHIES[0]).id);

/* =========================================================
   4 · Rendering
   ========================================================= */
const CH = 16;
/* ---- Clay look kit (same idea as art.js: light from the top-left, soft gradients, glossy highlights,
   soft colored shadows, colored edges). Everything static is painted once into a cache:
   tiles into 16×16-tile chunks, buildings / blockers / props into per-size sprites. ---- */
const wcCache = new Map();
const wHex = (h) => { h = h.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
function wMix(a, b, t) {
  const k = a + b + t; let v = wcCache.get(k); if (v) return v;
  const A = wHex(a), B = wHex(b);
  v = '#' + A.map((x, i) => Math.max(0, Math.min(255, Math.round(x + (B[i] - x) * t))).toString(16).padStart(2, '0')).join('');
  if (wcCache.size > 3000) wcCache.clear();
  wcCache.set(k, v); return v;
}
const wLt = (c, t) => wMix(c, '#ffffff', t), wDk = (c, t) => wMix(c, '#2a1830', t);
const wRGBA = (c, a) => { const [r, g, b] = wHex(c); return `rgba(${r},${g},${b},${a})`; };
const SHADOW = '#2a1830';
function rr(g, x, y, w, h, r) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
  g.moveTo(x + a, y); g.lineTo(x + w - b, y); if (b) g.arcTo(x + w, y, x + w, y + b, b); else g.lineTo(x + w, y);
  g.lineTo(x + w, y + h - c); if (c) g.arcTo(x + w, y + h, x + w - c, y + h, c); else g.lineTo(x + w, y + h);
  g.lineTo(x + d, y + h); if (d) g.arcTo(x, y + h, x, y + h - d, d); else g.lineTo(x, y + h);
  g.lineTo(x, y + a); if (a) g.arcTo(x, y, x + a, y, a); else g.lineTo(x, y);
  g.closePath();
}
function roundPoly(g, pts, r) { // closed polygon with rounded corners (r: number or per-point list)
  const n = pts.length, R = (i) => (Array.isArray(r) ? r[i] : r);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]); g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = mid(p, q); g.arcTo(p[0], p[1], m[0], m[1], R(i)); }
  g.closePath();
}
function clayLin(g, x, y, w, h, c, a = 0.3, b = 0.22) { const gr = g.createLinearGradient(x, y, x + w * 0.45, y + h); gr.addColorStop(0, wLt(c, a)); gr.addColorStop(0.55, c); gr.addColorStop(1, wDk(c, b)); return gr; }
function clayRad(g, cx, cy, r, c, a = 0.4, b = 0.25) { const gr = g.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.04, cx, cy, r * 1.12); gr.addColorStop(0, wLt(c, a)); gr.addColorStop(0.55, c); gr.addColorStop(1, wDk(c, b)); return gr; }
function fillEdge(g, fill, edge, lw) { g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); } }
function gloss(g, cx, cy, rx, ry, a = 0.45, rot = -0.45) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 7); g.fill(); }
function softShadow(g, cx, cy, rx, ry, a = 0.24, col = SHADOW) {
  g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, wRGBA(col, a)); gr.addColorStop(0.6, wRGBA(col, a * 0.7)); gr.addColorStop(1, wRGBA(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
}
const ell = (g, cx, cy, rx, ry, rot = 0) => { g.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); };
// Fill a shape made of several overlapping parts with one colored outline around the whole (not every part)
function fillOutline(g, fill, edge, lw) { g.strokeStyle = edge; g.lineWidth = lw * 2; g.lineJoin = 'round'; g.stroke(); g.fillStyle = fill; g.fill(); }
const flatShadow = (g, cx, cy, rx, ry, a = 0.2) => { g.fillStyle = wRGBA(SHADOW, a); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); };

/* ---- Sprite cache: static art painted once per (key, tile size, dpr), cleared on resize ---- */
WG.spr = new Map();
function sprite(key, w, h, paint) { // w,h in CSS px; paint(g) draws in CSS px
  const k = key + '|' + WG.ts + '|' + WG.dpr;
  let c = WG.spr.get(k);
  if (c) { WG.spr.delete(k); WG.spr.set(k, c); return c; }
  c = document.createElement('canvas'); c.width = Math.ceil(w * WG.dpr); c.height = Math.ceil(h * WG.dpr);
  const g = c.getContext('2d'); g.scale(WG.dpr, WG.dpr); paint(g);
  WG.spr.set(k, c);
  if (WG.spr.size > 40) { const o = WG.spr.keys().next().value; WG.spr.get(o).width = 0; WG.spr.delete(o); }
  return c;
}
function clearSprites() { for (const c of WG.spr.values()) c.width = c.height = 0; WG.spr.clear(); }
// Draw a cached sprite: an area of tw×th tiles, padded by `pad` tiles on every side, at tile-space pixel x,y
function drawSpr(g, key, x, y, s, tw, th, pad, paint) { // pad: tiles, or [left, top, right, bottom]
  const [l, t, r, b] = Array.isArray(pad) ? pad : [pad, pad, pad, pad], W = (tw + l + r) * s, H = (th + t + b) * s;
  const c = sprite(key, W, H, (q) => { q.translate(l * s, t * s); paint(q, s); });
  g.drawImage(c, x - l * s, y - t * s, W, H);
}

/* ---- Tiles ---- */
const ROCK_C = { frost: '#a3b6cc', hollow: '#7f7598', peaks: '#b9bccb', shore: '#cbbba2' };
const groundCol = (R, x, y) => {
  // value noise on a 4-tile lattice (bilinear) + a little per-tile grain: soft, natural blotches with no checkerboard
  const gx = x / 4, gy = y / 4, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const v = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  return wMix(R.pal.g1, R.pal.g2, Math.min(1, Math.max(0, v * 1.15 - 0.1 + (hash2(x * 7, y * 3) - 0.5) * 0.25)));
};
const LO = { cv: null };
function loMap(n, colFn) { // (n×n) pixels, one per tile incl. a 1-tile margin; upscaled with smoothing = smooth color fields
  if (!LO.cv) { LO.cv = document.createElement('canvas'); LO.g = LO.cv.getContext('2d'); }
  if (LO.cv.width !== n) LO.cv.width = LO.cv.height = n;
  const im = LO.g.createImageData(n, n), D = im.data;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [r, gg, b] = wHex(colFn(i - 1, j - 1)); const k = (j * n + i) * 4; D[k] = r; D[k + 1] = gg; D[k + 2] = b; D[k + 3] = 255; }
  LO.g.putImageData(im, 0, 0);
  return LO.cv;
}
function drawLo(g, n, s, colFn, bb) { // bb: [x0, y0, x1, y1] tiles to cover (default: everything)
  const lo = loMap(n, colFn); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
  if (!bb) { g.drawImage(lo, -s, -s, n * s, n * s); return; }
  const a = Math.max(0, bb[0]), b = Math.max(0, bb[1]), c = Math.min(n, bb[2] + 3), d = Math.min(n, bb[3] + 3);
  g.drawImage(lo, a, b, c - a, d - b, (a - 1) * s, (b - 1) * s, (c - a) * s, (d - b) * s);
}
// A rounded "blob" for tile (x,y) of a set: sides facing outside the set are inset by pad, outer corners rounded
function blob(P, x, y, s, inSet, pad, r) {
  const n = inSet(x, y - 1), e = inSet(x + 1, y), so = inSet(x, y + 1), w = inSet(x - 1, y);
  const l = x * s + (w ? -0.5 : pad), t = y * s + (n ? -0.5 : pad), rg = (x + 1) * s - (e ? -0.5 : pad), b = (y + 1) * s - (so ? -0.5 : pad);
  const R = (A, B) => (!A && !B ? r : 0);
  rr(P, l, t, rg - l, b - t, [R(n, w), R(n, e), R(so, e), R(so, w)]);
}

function* paintChunk(g, X0, Y0, s, w) { // yields between layers so look-ahead chunks can be painted across frames
  const M = 2, N = CH + M * 2, tt = new Uint8Array(N * N), rg = new Int8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const tx = X0 + i - M, ty = Y0 + j - M; tt[j * N + i] = w.at(tx, ty); rg[j * N + i] = Math.max(0, regionAt(Math.min(MW - 1, Math.max(0, tx)), Math.min(MH - 1, Math.max(0, ty)))); }
  const tAt = (x, y) => tt[(y + M) * N + x + M];
  const RAt = (x, y) => WREG[rg[(y + M) * N + x + M]] || WREG[0];
  const inR = (x, y) => x >= -M && y >= -M && x < CH + M && y < CH + M;
  const tOf = (x, y) => (inR(x, y) ? tAt(x, y) : w.at(X0 + x, Y0 + y));
  // Is this tile part of the ice field (incl. the rocks lying on it)?
  const onIce = (x, y) => { const t = tOf(x, y); if (t === T.ICE) return true; if (t !== T.ROCK) return false; const R = inR(x, y) ? RAt(x, y) : null; if (!R || !R.ice) return false; const [ix, iy, iw, ih] = R.ice, [ox, oy] = REG_POS[7]; const lx = X0 + x - ox * RW, ly = Y0 + y - oy * RH; return lx >= ix && ly >= iy && lx < ix + iw && ly < iy + ih; };
  const each = (fn, m = 1) => { for (let y = -m; y < CH + m; y++) for (let x = -m; x < CH + m; x++) fn(x, y, tAt(x, y)); };

  // 0 · Ground: one smooth color field
  drawLo(g, CH + 2, s, (x, y) => groundCol(RAt(x, y), X0 + x, Y0 + y));
  yield;
  // 1 · Ground details (grass tufts, pebbles, sand ripples, snow drifts)
  each((x, y, t) => { if (x < 0 || y < 0 || x >= CH || y >= CH) return; if (t === T.GRASS || t === T.SAND || t === T.SNOW || t === T.FLOWER) groundDetail(g, x * s, y * s, s, X0 + x, Y0 + y, RAt(x, y)); }, 0);

  const isW = (x, y) => { const t = tOf(x, y); return t === T.WATER || t === T.BRIDGE; };
  const isV = (x, y) => { const t = tOf(x, y); return t === T.VOID || t === T.CLOUD; };
  const isP = (x, y) => { const t = tOf(x, y); return t === T.PATH || t === T.CHECK || t === T.BRIDGE || t === T.PLANK; };
  const isC = (x, y) => tOf(x, y) === T.CHECK;
  let bb = null;
  // Fill a layer in each region's own color (a chunk can straddle up to four regions); returns the regions found
  const byRegion = (sel, inSet, pad, r, whole, colFn) => {
    const regs = new Set(); each((x, y) => { if (sel(x, y)) regs.add(rg[(y + M) * N + x + M]); });
    if (regs.size === 1) { g.fillStyle = colFn((WREG[[...regs][0]] || WREG[0]).pal); g.fill(whole); return regs; }
    for (const ri of regs) { const Q = new Path2D(); each((x, y) => { if (sel(x, y) && rg[(y + M) * N + x + M] === ri) blob(Q, x, y, s, inSet, pad, r); }); g.fillStyle = colFn((WREG[ri] || WREG[0]).pal); g.fill(Q); }
    return regs;
  };
  const layer = (test, pad, r, inSet = test) => { const P = new Path2D(); let any = false; bb = [99, 99, -99, -99]; each((x, y) => { if (test(x, y)) { blob(P, x, y, s, inSet, pad, r); any = true; bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; } }); return any ? P : null; };
  const clipLo = (P, colFn) => { const box = bb.slice(); g.save(); g.clip(P); drawLo(g, CH + 2, s, colFn, box); g.restore(); };
  // 2 · Flat terrain with soft rounded edges. Tall-grass meadows first: a darker soft patch so each meadow reads as one area
  const isTall = (x, y) => tOf(x, y) === T.TALL;
  let P = layer(isTall, s * 0.06, s * 0.45);
  if (P) byRegion(isTall, isTall, s * 0.06, s * 0.45, P, (p) => wRGBA(wMix(p.tall, p.g2, 0.45), R_TALL_A(p)));
  // Water: a dark wet bank, white foam at the shore, then depth (light shallows → deep blue)
  P = layer(isW, -s * 0.06, s * 0.42);
  if (P) {
    g.fillStyle = wRGBA('#1d4f7a', 0.16); g.fill(P);
    g.fillStyle = '#effbff'; g.fill(layer(isW, s * 0.02, s * 0.38));
    const body = layer(isW, s * 0.12, s * 0.32);
    const depth = (x, y) => { if (!isW(x, y)) return 0; let d = 3; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!isW(x + dx, y + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)) - 1 + (Math.abs(dx) + Math.abs(dy) > 2 ? 0.5 : 0)); return Math.max(0, d); };
    clipLo(body, (x, y) => { const c = RAt(x, y).pal.water; return wMix(wLt(c, 0.32), wDk(c, 0.2), Math.min(1, depth(x, y) / 2.5)); });
    g.save(); g.clip(body);
    each((x, y) => { if (!isW(x, y)) return; const X = x * s, Y = y * s, h = hash2(X0 + x, Y0 + y);
      if (!isW(x, y - 1)) { const gr = g.createLinearGradient(0, Y, 0, Y + s * 0.4); gr.addColorStop(0, 'rgba(20,50,90,.28)'); gr.addColorStop(1, 'rgba(20,50,90,0)'); g.fillStyle = gr; g.fillRect(X - 1, Y, s + 2, s * 0.4); }
      if (h < 0.22) gloss(g, X + s * (0.3 + h), Y + s * (0.4 + h), s * 0.13, s * 0.035, 0.32, 0);
    });
    g.restore();
  }
  // Sky gaps (the Cloud Peaks chasm): soft sky with a clay cliff face on the top edge
  P = layer(isV, 0, s * 0.3);
  if (P) {
    { const vb = bb.slice(); g.fillStyle = 'rgba(70,90,70,.45)'; g.fill(layer(isV, -s * 0.08, s * 0.36)); bb = vb; }
    clipLo(P, (x, y) => wMix('#c4e3ff', '#7fbdf0', isV(x, y) ? 0.4 + hash2(X0 + x, Y0 + y) * 0.45 : 0));
    g.save(); g.clip(P);
    each((x, y) => { if (!isV(x, y)) return; const X = x * s, Y = y * s, R = RAt(x, y), h = hash2(X0 + x, Y0 + y + 5);
      if (!isV(x, y - 1)) { const c = wDk(R.pal.g2, 0.42), gr = g.createLinearGradient(0, Y, 0, Y + s * 0.42); gr.addColorStop(0, wLt(c, 0.12)); gr.addColorStop(1, wDk(c, 0.2)); g.fillStyle = gr; g.beginPath(); g.moveTo(X - 1, Y); g.lineTo(X + s + 1, Y); g.lineTo(X + s + 1, Y + s * 0.3); g.quadraticCurveTo(X + s * 0.75, Y + s * (0.44 + h * 0.1), X + s * 0.5, Y + s * 0.34); g.quadraticCurveTo(X + s * 0.25, Y + s * (0.42 - h * 0.08), X - 1, Y + s * 0.32); g.fill(); }
      else if (h < 0.3) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(X + s * (0.3 + h), Y + s * 0.6, s * 0.3, s * 0.08, 0, 0, 7); g.fill(); }
    });
    g.restore();
  }
  // Paths: a soft darker rim, then a smooth sandy color field, then pebbles
  const isPn = (x, y) => { const t = tOf(x, y); return t === T.PATH || t === T.PLANK; };
  P = layer(isPn, s * 0.03, s * 0.36, isP);
  if (P) {
    const pc = (x, y) => RAt(x, y).pal;
    const regs = byRegion(isPn, isP, s * 0.03, s * 0.36, P, (p) => wRGBA(wDk(p.path, 0.3), 0.55));
    const body = layer(isPn, s * 0.1, s * 0.32, isP);
    if (regs.size > 1) clipLo(body, (x, y) => { const p = pc(x, y); return wMix(p.path, p.path2, 0.35); });
    else { const p = (WREG[[...regs][0]] || WREG[0]).pal; g.fillStyle = wMix(p.path, p.path2, 0.35); g.fill(body); }
    each((x, y, t) => { if (t !== T.PATH || x < 0 || y < 0 || x >= CH || y >= CH) return; const p = pc(x, y), X = x * s, Y = y * s;
      for (let i = 0; i < 2; i++) { const a = hash2(X0 + x + i * 17, Y0 + y), b = hash2(X0 + x, Y0 + y + i * 29); if (a > 0.55) continue; const px = X + s * (0.2 + b * 0.6), py = Y + s * (0.2 + a * 1.1); g.fillStyle = wDk(p.path2, 0.12); g.beginPath(); g.ellipse(px, py + s * 0.015, s * 0.06, s * 0.04, 0, 0, 7); g.fill(); g.fillStyle = wLt(p.path, 0.35); g.beginPath(); g.ellipse(px - s * 0.01, py - s * 0.005, s * 0.045, s * 0.03, 0, 0, 7); g.fill(); }
    }, 0);
  }
  // Plaza: pillowy pink & white tiles in a rounded rim
  P = layer(isC, s * 0.05, s * 0.4);
  if (P) {
    g.fillStyle = '#f2a7c5'; g.fill(P);
    g.save(); g.clip(layer(isC, s * 0.12, s * 0.34));
    each((x, y) => { if (!isC(x, y)) return; const X = x * s, Y = y * s, c = (X0 + x + Y0 + y) % 2 ? '#fff6fa' : '#ffd2e5'; g.fillStyle = '#f6bdd4'; g.fillRect(X, Y, s, s); g.beginPath(); rr(g, X + s * 0.05, Y + s * 0.05, s * 0.9, s * 0.9, s * 0.16); g.fillStyle = clayLin(g, X, Y, s, s, c, 0.5, 0.08); g.fill(); });
    g.restore();
  }
  // Ice: glossy rounded field
  P = layer(onIce, s * 0.02, s * 0.3);
  if (P) {
    const ibb = bb.slice(); g.fillStyle = '#86c3ea'; g.fill(layer(onIce, -s * 0.04, s * 0.34)); bb = ibb;
    g.save(); g.clip(P);
    drawLo(g, CH + 2, s, (x, y) => (onIce(x, y) ? wMix('#d6f1ff', '#a9dcfa', hash2(X0 + x, Y0 + y)) : '#bfe6ff'), bb);
    each((x, y) => { if (!onIce(x, y)) return; const X = x * s, Y = y * s, h = hash2(X0 + x, Y0 + y);
      g.strokeStyle = 'rgba(110,170,215,.28)'; g.lineWidth = s * 0.025; g.beginPath(); rr(g, X + s * 0.03, Y + s * 0.03, s * 0.94, s * 0.94, s * 0.14); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(X + s * 0.18, Y + s * (0.42 + h * 0.2)); g.lineTo(X + s * 0.42, Y + s * (0.18 + h * 0.2)); if (h < 0.5) { g.moveTo(X + s * 0.5, Y + s * (0.5 + h * 0.3)); g.lineTo(X + s * 0.6, Y + s * (0.4 + h * 0.3)); } g.stroke();
    });
    g.restore();
  }
  yield;
  // 3 · Raised things, row by row (incl. a 1-tile margin so overhangs match across chunks)
  each((x, y, t) => { if (RAISED.has(t)) raisedTile(g, t, x * s, y * s, s, X0 + x, Y0 + y, RAt(x, y), (dx, dy) => tOf(x + dx, y + dy), onIce(x, y)); });
}
// Static props are painted once per (kind, region, variant) and stamped into chunks
const TILE_VAR = { [T.TALL]: 3, [T.FLOWER]: 4, [T.TREE]: 4, [T.PINE]: 1, [T.PALM]: 2, [T.DEAD]: 3, [T.ROCK]: 3, [T.GRAVE]: 2 };
const tvSeed = new Map();
function tileSpr(key, s, paint) {
  const k = key + '|' + s; let c = WG.tspr.get(k);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = Math.ceil(s * 2);
  paint(c.getContext('2d'));
  WG.tspr.set(k, c);
  if (WG.tspr.size > 90) { const o = WG.tspr.keys().next().value; WG.tspr.get(o).width = 0; WG.tspr.delete(o); }
  return c;
}
WG.tspr = new Map();
function raisedTile(g, t, X, Y, s, x, y, R, nb, iced) {
  const n = TILE_VAR[t];
  if (!n) return raised(g, t, X, Y, s, x, y, R, nb, iced);
  const pump = t === T.CROP ? (hash2(7, y) < 0.45 ? 1 : 0) : 0, v = t === T.CROP ? pump : Math.floor(hash2(x * 3 + 1, y * 5 + 2) * n) % n;
  const sk = n + ':' + v; let fk = tvSeed.get(sk);
  if (fk == null) { fk = 0; while (Math.floor(hash2(1000 + fk, 50) * n) !== v && fk < 500) fk++; tvSeed.set(sk, fk); }
  const c = tileSpr(t + ':' + R.key + ':' + v + ':' + (iced ? 1 : 0), s, (q) => raised(q, t, s * 0.5, s * 0.5, s, 1000 + fk, 50, R, nb, iced, pump));
  g.drawImage(c, X - s * 0.5, Y - s * 0.5);
}
const R_TALL_A = (p) => (p === WREG[6].pal ? 0.55 : 0.42);
const RAISED = new Set([T.TALL, T.FLOWER, T.TREE, T.PINE, T.PALM, T.DEAD, T.ROCK, T.FENCE, T.CROP, T.GRAVE, T.BRIDGE, T.PLANK]);

function groundDetail(g, X, Y, s, x, y, R) {
  const h = hash2(x, y), P = R.pal, base = P.g1;
  if (R.ground === 'SAND') {
    g.fillStyle = wDk(base, 0.14); for (let i = 0; i < 3; i++) { const a = hash2(x * 13 + i, y * 7 - i), b = hash2(x * 5 - i, y * 11 + i); g.beginPath(); g.arc(X + a * s, Y + b * s, s * 0.022, 0, 7); g.fill(); }
    if (h < 0.18) { g.strokeStyle = wLt(base, 0.45); g.lineWidth = s * 0.04; g.lineCap = 'round'; g.beginPath(); g.arc(X + s * 0.5, Y + s * 0.75, s * 0.22, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.strokeStyle = wDk(base, 0.1); g.beginPath(); g.arc(X + s * 0.5, Y + s * 0.8, s * 0.22, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    return;
  }
  if (R.ground === 'SNOW') {
    if (h < 0.22) { const k = 0.6 + hash2(x * 5, y) * 0.6, cx = X + s * (0.3 + hash2(x, y * 7) * 0.4); g.fillStyle = 'rgba(160,190,215,.35)'; g.beginPath(); g.ellipse(cx, Y + s * 0.62, s * 0.26 * k, s * 0.08 * k, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(cx - s * 0.03, Y + s * 0.585, s * 0.24 * k, s * 0.065 * k, 0, 0, 7); g.fill(); }
    if (h > 0.7) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X + s * hash2(x, y * 3), Y + s * hash2(x * 3, y), s * 0.03, 0, 7); g.fill(); }
    return;
  }
  const dark = R.key === 'hollow', tc = dark ? wLt(base, 0.16) : wDk(P.g2, 0.16), tip = dark ? wLt(base, 0.3) : wLt(P.g1, 0.25);
  if (h < 0.42) { // a small rounded tuft
    const cx = X + s * (0.2 + hash2(x * 3, y) * 0.6), cy = Y + s * (0.35 + hash2(x, y * 5) * 0.5);
    g.fillStyle = tc; g.beginPath();
    for (const [dx, hh, rot] of [[-0.07, 0.15, -0.35], [0, 0.2, 0], [0.07, 0.15, 0.35]]) ell(g, cx + dx * s, cy - hh * s * 0.5, s * 0.035, hh * s * 0.5, rot);
    g.fill(); g.fillStyle = tip; g.beginPath(); g.ellipse(cx - s * 0.008, cy - s * 0.15, s * 0.016, s * 0.04, 0, 0, 7); g.fill();
  } else if (h > 0.93) { // a pebble
    const cx = X + s * (0.3 + hash2(x, y * 2) * 0.4), cy = Y + s * 0.6;
    g.fillStyle = dark ? '#5d5277' : '#b9b3a8'; g.beginPath(); g.ellipse(cx, cy, s * 0.07, s * 0.05, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(cx - s * 0.02, cy - s * 0.015, s * 0.03, s * 0.015, -0.4, 0, 7); g.fill();
  } else if (h > 0.86 && !dark) { // a tiny daisy
    const cx = X + s * (0.25 + hash2(x * 9, y) * 0.5), cy = Y + s * (0.3 + hash2(x, y * 9) * 0.5);
    g.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; g.beginPath(); g.arc(cx + Math.cos(a) * s * 0.035, cy + Math.sin(a) * s * 0.035, s * 0.028, 0, 7); g.fill(); }
    g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(cx, cy, s * 0.022, 0, 7); g.fill();
  }
}

function raised(g, t, X, Y, s, x, y, R, nb, iced, pumpV) {
  const P = R.pal, h = hash2(x, y);
  if (t === T.TALL) {
    flatShadow(g, X + s * 0.5, Y + s * 0.94, s * 0.5, s * 0.1, 0.14);
    const clump = (cx, by, hh, c1, c2, k) => {
      const gr = g.createLinearGradient(0, by - hh * s, 0, by); gr.addColorStop(0, wLt(c2, 0.3)); gr.addColorStop(0.45, c2); gr.addColorStop(1, wDk(c1, 0.15));
      g.beginPath();
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.3 + (hash2(x * 7 + i + k, y * 3) - 0.5) * 0.16, H = hh * s * (i === 2 ? 1 : i % 2 ? 0.86 : 0.66); ell(g, cx + Math.sin(a) * H * 0.5, by - Math.cos(a) * H * 0.5, s * 0.08, H * 0.5, a); }
      g.fillStyle = gr; g.fill();
      gloss(g, cx - s * 0.03, by - hh * s * 0.68, s * 0.022, s * 0.08, 0.38, -0.1);
    };
    const j = (k) => (hash2(x * 11 + k, y * 13 - k) - 0.5) * 0.12;
    clump(X + s * (0.27 + j(1)), Y + s * 0.56, 0.58, P.tall, wDk(P.tall2, 0.1), 1);
    clump(X + s * (0.76 + j(2)), Y + s * 0.6, 0.56, P.tall, wDk(P.tall2, 0.1), 2);
    clump(X + s * (0.5 + j(3)), Y + s * 1.0, 0.62, P.tall, P.tall2, 3);
    return;
  }
  if (t === T.FLOWER) {
    const cs = P.flower;
    for (let i = 0; i < 3; i++) {
      const a = hash2(x + i * 9, y), b = hash2(x, y + i * 5), cx = X + (0.18 + a * 0.64) * s, cy = Y + (0.22 + b * 0.6) * s, c = cs[Math.floor(hash2(x * i + 1, y) * cs.length)];
      g.fillStyle = wDk(P.g2, 0.2); g.beginPath(); g.ellipse(cx + s * 0.06, cy + s * 0.09, s * 0.06, s * 0.025, -0.5, 0, 7); g.fill();
      g.fillStyle = clayRad(g, cx, cy, s * 0.1, c, 0.45, 0.2); g.beginPath();
      for (let k = 0; k < 5; k++) { const an = -Math.PI / 2 + (k * Math.PI * 2) / 5; g.moveTo(cx + Math.cos(an) * s * 0.05 + s * 0.04, cy + Math.sin(an) * s * 0.05); g.arc(cx + Math.cos(an) * s * 0.05, cy + Math.sin(an) * s * 0.05, s * 0.04, 0, 7); }
      g.fill(); g.fillStyle = '#ffcf33'; g.beginPath(); g.arc(cx, cy, s * 0.028, 0, 7); g.fill(); gloss(g, cx - s * 0.035, cy - s * 0.04, s * 0.018, s * 0.01, 0.7);
    }
    return;
  }
  if (t === T.TREE) {
    const sc = 0.92 + h * 0.14, cx = X + s * (0.5 + (hash2(x * 3, y) - 0.5) * 0.08), cy = Y + s * 0.4;
    softShadow(g, cx + s * 0.06, Y + s * 0.9, s * 0.44 * sc, s * 0.14, 0.3);
    g.beginPath(); rr(g, cx - s * 0.075, Y + s * 0.55, s * 0.15, s * 0.36, s * 0.06); fillEdge(g, clayLin(g, cx - s * 0.08, Y + s * 0.55, s * 0.16, s * 0.1, '#8f5d35', 0.25, 0.2), '#5e3a20', s * 0.025);
    g.beginPath();
    for (const [dx, dy, r] of [[0, -0.1, 0.33], [-0.19, 0.06, 0.25], [0.19, 0.06, 0.25], [0, 0.1, 0.28]]) { g.moveTo(cx + (dx + r) * s * sc, cy + dy * s * sc); g.arc(cx + dx * s * sc, cy + dy * s * sc, r * s * sc, 0, 7); }
    const gr = g.createRadialGradient(cx - s * 0.16, cy - s * 0.2, s * 0.02, cx, cy, s * 0.5 * sc); gr.addColorStop(0, wLt(P.leaf2, 0.35)); gr.addColorStop(0.4, P.leaf2); gr.addColorStop(0.78, P.leaf); gr.addColorStop(1, wDk(P.leaf, 0.3));
    fillOutline(g, gr, wDk(P.leaf, 0.38), s * 0.03);
    gloss(g, cx - s * 0.13 * sc, cy - s * 0.2 * sc, s * 0.12, s * 0.06, 0.38);
    if (R.key === 'woods' && h < 0.3) for (let i = 0; i < 3; i++) { const bx = cx + s * (-0.18 + i * 0.18), by = cy + s * (0.08 - (i % 2) * 0.16); g.fillStyle = clayRad(g, bx, by, s * 0.05, '#ff5c8d'); g.beginPath(); g.arc(bx, by, s * 0.045, 0, 7); g.fill(); gloss(g, bx - s * 0.015, by - s * 0.015, s * 0.014, s * 0.009, 0.8); }
    if (R.ground === 'SNOW') { g.fillStyle = '#fbfdff'; g.beginPath(); g.ellipse(cx - s * 0.04, cy - s * 0.3 * sc, s * 0.2, s * 0.08, -0.15, 0, 7); g.fill(); }
    return;
  }
  if (t === T.PINE) {
    const cx = X + s * 0.5, snow = R.ground === 'SNOW';
    softShadow(g, cx + s * 0.05, Y + s * 0.9, s * 0.38, s * 0.12, 0.3);
    g.beginPath(); rr(g, cx - s * 0.06, Y + s * 0.68, s * 0.12, s * 0.22, s * 0.04); fillEdge(g, '#7a4f2c', '#553419', s * 0.02);
    const gr = g.createLinearGradient(cx - s * 0.4, 0, cx + s * 0.4, 0); gr.addColorStop(0, wLt(P.leaf2, 0.22)); gr.addColorStop(0.45, P.leaf2); gr.addColorStop(1, wDk(P.leaf, 0.25));
    for (let i = 2; i >= 0; i--) {
      const top = Y + s * (-0.1 + i * 0.22), bot = top + s * 0.44, hw = s * (0.22 + i * 0.1);
      g.beginPath(); g.moveTo(cx - s * 0.05, top + s * 0.04); g.quadraticCurveTo(cx, top - s * 0.03, cx + s * 0.05, top + s * 0.04);
      g.lineTo(cx + hw, bot - s * 0.07); g.quadraticCurveTo(cx + hw + s * 0.03, bot, cx + hw - s * 0.07, bot);
      g.quadraticCurveTo(cx, bot + s * 0.06, cx - hw + s * 0.07, bot); g.quadraticCurveTo(cx - hw - s * 0.03, bot, cx - hw, bot - s * 0.07); g.closePath();
      fillEdge(g, gr, wDk(P.leaf, 0.4), s * 0.028);
      if (snow) { g.fillStyle = '#fbfdff'; g.beginPath(); g.moveTo(cx - hw * 0.55, top + s * (i ? 0.2 : 0.17)); g.quadraticCurveTo(cx, top - s * 0.02, cx + hw * 0.55, top + s * (i ? 0.2 : 0.17)); g.quadraticCurveTo(cx + hw * 0.25, top + s * 0.27, cx, top + s * 0.22); g.quadraticCurveTo(cx - hw * 0.25, top + s * 0.28, cx - hw * 0.55, top + s * (i ? 0.2 : 0.17)); g.fill(); }
    }
    gloss(g, cx - s * 0.1, Y + s * 0.2, s * 0.05, s * 0.1, 0.3, 0.5);
    return;
  }
  if (t === T.PALM) {
    const bx = X + s * 0.5, tx = X + s * (0.5 + (h - 0.5) * 0.2), ty = Y + s * 0.26;
    softShadow(g, bx + s * 0.12, Y + s * 0.9, s * 0.4, s * 0.12, 0.26);
    const tg = g.createLinearGradient(bx - s * 0.08, 0, bx + s * 0.08, 0); tg.addColorStop(0, '#d9a066'); tg.addColorStop(1, '#93603a');
    g.strokeStyle = '#7a4a28'; g.lineWidth = s * 0.17; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, Y + s * 0.88); g.quadraticCurveTo(bx - s * 0.1, Y + s * 0.5, tx, ty); g.stroke();
    g.strokeStyle = tg; g.lineWidth = s * 0.12; g.stroke();
    g.strokeStyle = 'rgba(122,74,40,.55)'; g.lineWidth = s * 0.025; for (let i = 1; i < 5; i++) { const k = i / 5, qx = (1 - k) * (1 - k) * bx + 2 * k * (1 - k) * (bx - s * 0.1) + k * k * tx, qy = (1 - k) * (1 - k) * (Y + s * 0.88) + 2 * k * (1 - k) * (Y + s * 0.5) + k * k * ty; g.beginPath(); g.moveTo(qx - s * 0.06, qy); g.quadraticCurveTo(qx, qy + s * 0.03, qx + s * 0.06, qy); g.stroke(); }
    const leaf = (a, len, c) => { g.save(); g.translate(tx, ty); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -s * 0.13, len, s * 0.06); g.quadraticCurveTo(len * 0.5, s * 0.02, 0, 0); g.fillStyle = clayLin(g, 0, -s * 0.13, len, s * 0.2, c, 0.3, 0.15); g.fill(); g.strokeStyle = wDk(P.leaf, 0.4); g.lineWidth = s * 0.022; g.stroke(); g.restore(); };
    for (const a of [-2.5, -0.6, 2.9]) leaf(a, s * 0.42, wDk(P.leaf, 0.1));
    for (const a of [-1.9, -1.2, 0.1, 3.6]) leaf(a, s * 0.4, P.leaf2);
    for (const [dx, dy] of [[-0.05, 0.05], [0.05, 0.06]]) { const cx = tx + dx * s, cy = ty + dy * s; g.fillStyle = clayRad(g, cx, cy, s * 0.06, '#8d5a33'); g.beginPath(); g.arc(cx, cy, s * 0.055, 0, 7); g.fill(); }
    return;
  }
  if (t === T.DEAD) {
    const cx = X + s * 0.5;
    softShadow(g, cx + s * 0.05, Y + s * 0.9, s * 0.34, s * 0.1, 0.4, '#0d0718');
    const br = () => { g.beginPath(); g.moveTo(cx, Y + s * 0.9); g.quadraticCurveTo(cx - s * 0.05, Y + s * 0.55, cx, Y + s * 0.2); g.moveTo(cx - s * 0.01, Y + s * 0.55); g.quadraticCurveTo(cx - s * 0.22, Y + s * 0.4, cx - s * 0.33, Y + s * 0.12); g.moveTo(cx - s * 0.2, Y + s * 0.36); g.lineTo(cx - s * 0.36, Y + s * 0.36); g.moveTo(cx, Y + s * 0.45); g.quadraticCurveTo(cx + s * 0.24, Y + s * 0.36, cx + s * 0.34, Y + s * 0.06); g.moveTo(cx + s * 0.22, Y + s * 0.3); g.lineTo(cx + s * 0.38, Y + s * 0.26); g.moveTo(cx, Y + s * 0.3); g.quadraticCurveTo(cx - s * 0.06, Y + s * 0.12, cx - s * 0.12, Y - s * 0.04); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    br(); g.strokeStyle = '#1e1630'; g.lineWidth = s * 0.17; g.stroke(); g.strokeStyle = '#43345f'; g.lineWidth = s * 0.115; g.stroke(); g.beginPath(); ell(g, cx, Y + s * 0.88, s * 0.13, s * 0.05); g.fillStyle = '#2a2040'; g.fill();
    g.save(); g.translate(-s * 0.025, -s * 0.01); br(); g.strokeStyle = 'rgba(150,125,200,.45)'; g.lineWidth = s * 0.03; g.stroke(); g.restore();
    if (h < 0.3) { g.fillStyle = '#140d22'; g.beginPath(); g.ellipse(cx, Y + s * 0.66, s * 0.045, s * 0.06, 0, 0, 7); g.fill(); g.fillStyle = '#ffe066'; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + d * s * 0.016, Y + s * 0.65, s * 0.011, 0, 7); g.fill(); } }
    return;
  }
  if (t === T.ROCK) {
    const col = ROCK_C[R.key] || '#aeacb6', cx = X + s * 0.5, cy = Y + s * 0.6, k = 0.9 + h * 0.18;
    softShadow(g, cx + s * 0.05, Y + s * 0.84, s * 0.4 * k, s * 0.12, iced ? 0.18 : 0.28, iced ? '#2a5a8a' : SHADOW);
    g.beginPath(); ell(g, cx, cy, s * 0.38 * k, s * 0.27 * k); ell(g, cx - s * 0.09, cy - s * 0.07, s * 0.24 * k, s * 0.22 * k); ell(g, cx + s * 0.13, cy - s * 0.04, s * 0.19 * k, s * 0.19 * k);
    fillOutline(g, clayRad(g, cx - s * 0.05, cy - s * 0.08, s * 0.42, col, 0.42, 0.28), wDk(col, 0.38), s * 0.028);
    gloss(g, cx - s * 0.14, cy - s * 0.17, s * 0.1, s * 0.05, 0.5);
    if (R.ground === 'SNOW') { g.fillStyle = '#fbfdff'; g.beginPath(); g.ellipse(cx - s * 0.06, cy - s * 0.24 * k, s * 0.17, s * 0.06, -0.1, 0, 7); g.fill(); }
    return;
  }
  if (t === T.FENCE) {
    const hol = R.key === 'hollow', wood = hol ? '#4d3f6b' : '#dba56c', edge = wDk(wood, 0.35), F = (dx, dy) => nb(dx, dy) === T.FENCE;
    const l = F(-1, 0), r = F(1, 0), u = F(0, -1), d = F(0, 1);
    if (!l && !r && (u || d)) { g.beginPath(); rr(g, X + s * 0.45, Y + (u ? -s * 0.1 : s * 0.3), s * 0.1, (d ? s * 1.1 : s * 0.7) - (u ? -s * 0.1 : s * 0.3), s * 0.04); fillEdge(g, clayLin(g, X + s * 0.45, Y, s * 0.1, s, wood), edge, s * 0.022); }
    else for (const ry of [0.38, 0.6]) { const x0 = l ? X - 1 : X + s * 0.4, x1 = r ? X + s + 1 : X + s * 0.6; g.beginPath(); rr(g, x0, Y + ry * s, x1 - x0, s * 0.1, s * 0.04); fillEdge(g, clayLin(g, x0, Y + ry * s, x1 - x0, s * 0.1, wood, 0.3, 0.15), edge, s * 0.022); }
    flatShadow(g, X + s * 0.53, Y + s * 0.88, s * 0.13, s * 0.04, 0.22);
    g.beginPath(); if (hol) { g.moveTo(X + s * 0.42, Y + s * 0.88); g.lineTo(X + s * 0.42, Y + s * 0.26); g.lineTo(X + s * 0.5, Y + s * 0.13); g.lineTo(X + s * 0.58, Y + s * 0.26); g.lineTo(X + s * 0.58, Y + s * 0.88); g.closePath(); } else rr(g, X + s * 0.415, Y + s * 0.2, s * 0.17, s * 0.68, [s * 0.08, s * 0.08, s * 0.03, s * 0.03]);
    fillEdge(g, clayLin(g, X + s * 0.41, Y + s * 0.2, s * 0.17, s * 0.6, wood, 0.32, 0.18), edge, s * 0.025);
    gloss(g, X + s * 0.465, Y + s * 0.32, s * 0.02, s * 0.06, 0.45, 0);
    return;
  }
  if (t === T.CROP) {
    const cl = nb(-1, 0) === T.CROP, cr = nb(1, 0) === T.CROP, l0 = cl ? X - 1 : X + s * 0.04, r0 = cr ? X + s + 1 : X + s * 0.96;
    g.beginPath(); rr(g, l0, Y + s * 0.52, r0 - l0, s * 0.4, [cl ? 0 : s * 0.16, cr ? 0 : s * 0.16, cr ? 0 : s * 0.16, cl ? 0 : s * 0.16]);
    const sg = g.createLinearGradient(0, Y + s * 0.52, 0, Y + s * 0.92); sg.addColorStop(0, '#b98252'); sg.addColorStop(1, '#8a5a35'); fillEdge(g, sg, '#744628', s * 0.022);
    g.fillStyle = 'rgba(255,230,190,.35)'; g.fillRect(l0 + (cl ? 0 : s * 0.1), Y + s * 0.57, r0 - l0 - (cl ? 0 : s * 0.1) - (cr ? 0 : s * 0.1), s * 0.03);
    const pump = pumpV != null ? !!pumpV : hash2(7, y) < 0.45;
    for (let i = 0; i < 3; i++) {
      const cx = X + s * (0.18 + i * 0.32), by = Y + s * 0.7;
      g.fillStyle = clayLin(g, cx - s * 0.15, by - s * 0.3, s * 0.3, s * 0.3, '#5cae4c', 0.3, 0.2);
      g.beginPath(); ell(g, cx - s * 0.09, by - s * 0.12, s * 0.1, s * 0.045, -0.6); ell(g, cx + s * 0.09, by - s * 0.14, s * 0.1, s * 0.045, 0.6); g.fill();
      if (pump) { g.fillStyle = clayRad(g, cx, by - s * 0.04, s * 0.13, '#ff922b'); g.beginPath(); g.ellipse(cx, by - s * 0.04, s * 0.13, s * 0.1, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(160,70,10,.45)'; g.lineWidth = s * 0.018; g.beginPath(); g.ellipse(cx, by - s * 0.04, s * 0.05, s * 0.1, 0, 0, 7); g.stroke(); g.fillStyle = '#5c7a2e'; g.fillRect(cx - s * 0.015, by - s * 0.18, s * 0.03, s * 0.06); gloss(g, cx - s * 0.06, by - s * 0.09, s * 0.03, s * 0.016, 0.6); }
      else { g.fillStyle = clayRad(g, cx, by - s * 0.24, s * 0.1, '#ffd43b'); g.beginPath(); g.ellipse(cx, by - s * 0.22, s * 0.06, s * 0.16, 0, 0, 7); g.fill(); g.fillStyle = '#6cbf55'; g.beginPath(); ell(g, cx - s * 0.05, by - s * 0.12, s * 0.03, s * 0.11, 0.35); ell(g, cx + s * 0.05, by - s * 0.12, s * 0.03, s * 0.11, -0.35); g.fill(); gloss(g, cx - s * 0.02, by - s * 0.3, s * 0.015, s * 0.04, 0.6, 0); }
    }
    return;
  }
  if (t === T.GRAVE) {
    const c = '#aaa5c4', cx = X + s * 0.5;
    softShadow(g, cx + s * 0.06, Y + s * 0.86, s * 0.34, s * 0.09, 0.4, '#0d0718');
    g.fillStyle = wLt(P.g1, 0.12); g.beginPath(); g.ellipse(cx, Y + s * 0.85, s * 0.3, s * 0.07, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(X + s * 0.25, Y + s * 0.85); g.lineTo(X + s * 0.25, Y + s * 0.42); g.arc(cx, Y + s * 0.42, s * 0.25, Math.PI, 0); g.lineTo(X + s * 0.75, Y + s * 0.85); g.closePath();
    fillEdge(g, clayLin(g, X + s * 0.25, Y + s * 0.17, s * 0.5, s * 0.68, c, 0.35, 0.3), wDk(c, 0.45), s * 0.028);
    g.strokeStyle = wDk(c, 0.35); g.lineWidth = s * 0.055; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, Y + s * 0.36); g.lineTo(cx, Y + s * 0.66); g.moveTo(cx - s * 0.1, Y + s * 0.46); g.lineTo(cx + s * 0.1, Y + s * 0.46); g.stroke();
    gloss(g, X + s * 0.36, Y + s * 0.3, s * 0.05, s * 0.025, 0.45);
    if (h < 0.3) { g.fillStyle = '#63e6be'; g.beginPath(); ell(g, X + s * 0.22, Y + s * 0.82, s * 0.04, s * 0.07, -0.3); ell(g, X + s * 0.78, Y + s * 0.83, s * 0.035, s * 0.06, 0.3); g.fill(); }
    return;
  }
  if (t === T.BRIDGE || t === T.PLANK) {
    const B = (dx) => { const q = nb(dx, 0); return q === T.BRIDGE || q === T.PLANK; };
    g.fillStyle = 'rgba(20,50,90,.22)'; g.fillRect(X + s * 0.06, Y + s * 0.06, s * 0.92, s);
    const pl = B(-1) ? X - 1 : X + s * 0.06, pr = B(1) ? X + s + 1 : X + s * 0.94;
    for (let i = 0; i < 4; i++) { const py = Y + i * s * 0.25 + s * 0.015; g.beginPath(); rr(g, pl, py, pr - pl, s * 0.22, s * 0.06); fillEdge(g, clayLin(g, X, py, s, s * 0.22, i % 2 ? '#c99158' : '#d49c62', 0.25, 0.15), '#8d5a33', s * 0.022); }
    for (const [dx, rx] of [[-1, 0.06], [1, 0.94]]) if (!B(dx)) {
      g.strokeStyle = '#8d5a33'; g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(X + rx * s, Y - s * 0.05); g.quadraticCurveTo(X + rx * s, Y + s * 0.5, X + rx * s, Y + s * 1.05); g.stroke();
      g.beginPath(); rr(g, X + rx * s - s * 0.06, Y + s * 0.25, s * 0.12, s * 0.4, s * 0.05); fillEdge(g, clayLin(g, X + rx * s - s * 0.06, Y + s * 0.25, s * 0.12, s * 0.4, '#a8713f'), '#6e4426', s * 0.02);
    }
  }
}

const chunkKey = (cx, cy) => cx + ',' + cy + ',' + WG.ts + ',' + WG.dpr;
function chunkStore(key, c) {
  WG.chunks.set(key, c);
  if (WG.chunks.size > 12) { const k = WG.chunks.keys().next().value; const old = WG.chunks.get(k); old.width = old.height = 0; WG.chunks.delete(k); }
}
function chunkStart(cx, cy) {
  const s = WG.ts * WG.dpr, c = document.createElement('canvas'); c.width = c.height = CH * s;
  return { key: chunkKey(cx, cy), c, gen: paintChunk(c.getContext('2d'), cx * CH, cy * CH, s, getWorld()) };
}
function chunk(cx, cy) {
  const key = chunkKey(cx, cy);
  let c = WG.chunks.get(key);
  if (c) { WG.chunks.delete(key); WG.chunks.set(key, c); return c; }
  let job = WG.pend && WG.pend.key === key ? WG.pend : chunkStart(cx, cy);
  if (job === WG.pend) WG.pend = null;
  while (!job.gen.next().done);
  chunkStore(key, job.c); WG.built = true;
  return job.c;
}
// Look-ahead: paint one layer of an upcoming chunk on a frame that didn't have to paint anything else
function chunkAhead(cx, cy) {
  if (WG.pend) { if (WG.pend.key.endsWith(',' + WG.ts + ',' + WG.dpr) && !WG.chunks.has(WG.pend.key)) { if (WG.pend.gen.next().done) { chunkStore(WG.pend.key, WG.pend.c); WG.pend = null; } return; } WG.pend.c.width = 0; WG.pend = null; }
  WG.pend = chunkStart(cx, cy); WG.pend.gen.next();
}

/* ---- Buildings ---- */
const BLD = {
  lab: ['#e3f2ff', '#4dabf7'], hall: ['#fff1c4', '#f76707'], mart: ['#e6fbfd', '#22b8cf'], house: ['#fff0f6', '#f06595'], lighthouse: ['#fff', '#e03131'], bakery: ['#fff3e6', '#f783ac'],
  barn: ['#d64545', '#8f2a2a'], bigtent: ['#fff', '#e64980'], booth: ['#fff', '#ff6b6b'], observatory: ['#f1f3f8', '#5c7cfa'], manor: ['#7454cf', '#3f2d7e'], castle: ['#d7dbe6', '#7048e8'],
};
const INK = '#3a2b3d';
function bldSign(g, cx, cy, text, s, accent) {
  g.font = `800 ${Math.max(10, s * 0.34)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(text).width + s * 0.5, th = Math.max(14, s * 0.5);
  softShadow(g, cx + s * 0.04, cy + th * 0.55, tw * 0.5, s * 0.08, 0.25);
  g.beginPath(); rr(g, cx - tw / 2, cy - th / 2, tw, th, th / 2); fillEdge(g, clayLin(g, cx - tw / 2, cy - th / 2, tw, th, '#fffaf2', 0.6, 0.08), wDk(accent, 0.15), Math.max(1.5, s * 0.05));
  gloss(g, cx - tw * 0.3, cy - th * 0.22, tw * 0.12, th * 0.1, 0.7, 0);
  g.fillStyle = INK; g.fillText(text, cx, cy + s * 0.02); g.textBaseline = 'alphabetic';
}
function bldWin(g, x, y, w, h, s, opt = {}) {
  const frame = opt.frame || '#ffffff', glass = opt.glass || '#9fd4ff', r = opt.round ? w / 2 : s * 0.1;
  g.beginPath(); opt.round ? g.arc(x + w / 2, y + h / 2, w / 2 + s * 0.06, 0, 7) : rr(g, x - s * 0.06, y - s * 0.06, w + s * 0.12, h + s * 0.12, r + s * 0.04); fillEdge(g, clayLin(g, x, y, w, h, frame, 0.3, 0.12), wDk(opt.wall || frame, 0.35), s * 0.03);
  g.beginPath(); opt.round ? g.arc(x + w / 2, y + h / 2, w / 2 - s * 0.02, 0, 7) : rr(g, x, y, w, h, r);
  if (opt.lit) { const gr = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w); gr.addColorStop(0, '#fff3a8'); gr.addColorStop(1, '#ffb829'); g.fillStyle = gr; } else g.fillStyle = clayLin(g, x, y, w, h, glass, 0.45, 0.25);
  g.fill();
  g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(x + w * 0.15, y + h); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x + w * 0.4, y + h); g.fill(); g.restore();
  if (opt.cross) { g.strokeStyle = wDk(frame, 0.12); g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke(); }
  if (opt.box) { g.beginPath(); rr(g, x - s * 0.08, y + h + s * 0.04, w + s * 0.16, s * 0.16, s * 0.06); fillEdge(g, clayLin(g, x, y + h, w, s * 0.16, opt.box), wDk(opt.box, 0.35), s * 0.02); for (let i = 0; i < 4; i++) { const fx = x + (i + 0.5) * (w / 4); g.fillStyle = ['#ff6b9d', '#ffd43b', '#ff8fab', '#b197fc'][i]; g.beginPath(); g.arc(fx, y + h + s * 0.03, s * 0.055, 0, 7); g.fill(); } }
}
function bldDoor(g, cx, by, w, h, s, c, opt = {}) {
  g.beginPath(); rr(g, cx - w / 2 - s * 0.14, by - s * 0.1, w + s * 0.28, s * 0.14, s * 0.06); fillEdge(g, '#d6d0c4', '#a39b8c', s * 0.02);
  g.beginPath(); g.moveTo(cx - w / 2, by - s * 0.08); g.lineTo(cx - w / 2, by - h + w / 2); g.arc(cx, by - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, by - s * 0.08); g.closePath();
  fillEdge(g, clayLin(g, cx - w / 2, by - h, w, h, c, 0.25, 0.25), wDk(c, 0.4), s * 0.035);
  g.strokeStyle = wRGBA(wDk(c, 0.3), 0.6); g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(cx, by - h + s * 0.12); g.lineTo(cx, by - s * 0.12); g.stroke();
  if (!opt.noKnob) { g.fillStyle = clayRad(g, cx + w * 0.3, by - h * 0.45, s * 0.05, '#ffd43b'); g.beginPath(); g.arc(cx + w * 0.3, by - h * 0.45, s * 0.05, 0, 7); g.fill(); }
}
function gableRoof(g, pts, roof, s) {
  g.beginPath(); roundPoly(g, pts, s * 0.16);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  fillEdge(g, clayLin(g, x0, y0, x1 - x0, y1 - y0, roof, 0.32, 0.25), wDk(roof, 0.38), s * 0.05);
  g.save(); g.clip();
  g.strokeStyle = wRGBA(wDk(roof, 0.25), 0.4); g.lineWidth = s * 0.04;
  for (let yy = y0 + s * 0.45; yy < y1 - s * 0.1; yy += s * 0.36) { g.beginPath(); for (let xx = x0 - ((yy / s) % 2 ? s * 0.2 : 0); xx < x1; xx += s * 0.4) { g.moveTo(xx, yy); g.arc(xx + s * 0.2, yy, s * 0.2, Math.PI, 0, true); } g.stroke(); }
  g.fillStyle = wRGBA(wDk(roof, 0.3), 0.55); g.fillRect(x0, y1 - s * 0.16, x1 - x0, s * 0.2);
  g.restore();
}
function paintBuilding(g, o, sx, sy, s) {
  const w = o.w * s, h = o.h * s, [wall, roof] = BLD[o.kind] || BLD.house, col = o.color || roof, cx = sx + w / 2;
  softShadow(g, cx + s * 0.25, sy + h - s * 0.02, w * 0.56, s * 0.42, 0.3);
  if (o.kind === 'ferris') {
    const hy = sy + h * 0.45;
    g.lineCap = 'round';
    for (const d of [-1, 1]) { g.strokeStyle = '#6b7584'; g.lineWidth = s * 0.2; g.beginPath(); g.moveTo(cx, hy); g.lineTo(cx + d * w * 0.26, sy + h - s * 0.1); g.stroke(); g.strokeStyle = '#a7b0bd'; g.lineWidth = s * 0.12; g.stroke(); }
    g.beginPath(); rr(g, cx - w * 0.36, sy + h - s * 0.3, w * 0.72, s * 0.3, s * 0.12); fillEdge(g, clayLin(g, cx - w * 0.36, sy + h - s * 0.3, w * 0.72, s * 0.3, '#f783ac'), wDk('#f783ac', 0.35), s * 0.03);
    return;
  }
  if (o.kind === 'bigtent' || o.kind === 'booth') {
    if (o.kind === 'bigtent') {
      const by = sy + h, sh = sy + h * 0.42;
      g.strokeStyle = '#8d5a33'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(cx, sy + s * 0.2); g.lineTo(cx, sy - s * 0.6); g.stroke();
      g.beginPath(); g.moveTo(cx, sy - s * 0.6); g.quadraticCurveTo(cx + s * 0.35, sy - s * 0.65, cx + s * 0.55, sy - s * 0.4); g.quadraticCurveTo(cx + s * 0.3, sy - s * 0.38, cx, sy - s * 0.25); g.closePath(); fillEdge(g, clayLin(g, cx, sy - s * 0.65, s * 0.55, s * 0.4, '#ffd43b'), '#d9a400', s * 0.02);
      const body = new Path2D(); body.moveTo(sx + s * 0.05, by - s * 0.1); body.lineTo(sx + s * 0.15, sh); body.quadraticCurveTo(sx + w * 0.3, sy + h * 0.2, cx, sy); body.quadraticCurveTo(sx + w * 0.7, sy + h * 0.2, sx + w - s * 0.15, sh); body.lineTo(sx + w - s * 0.05, by - s * 0.1); body.quadraticCurveTo(cx, by + s * 0.05, sx + s * 0.05, by - s * 0.1); body.closePath();
      g.save(); g.clip(body);
      const n = 10; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#fff8fb' : col; g.beginPath(); g.moveTo(cx, sy - s * 0.1); g.lineTo(sx + (w * i) / n - s * 0.1, by + s * 0.2); g.lineTo(sx + (w * (i + 1)) / n + s * 0.1, by + s * 0.2); g.fill(); }
      const sh2 = g.createLinearGradient(sx, sy, sx + w, sy + h); sh2.addColorStop(0, 'rgba(255,255,255,.35)'); sh2.addColorStop(0.5, 'rgba(255,255,255,0)'); sh2.addColorStop(1, wRGBA(SHADOW, 0.25)); g.fillStyle = sh2; g.fillRect(sx, sy, w, h);
      g.restore();
      g.strokeStyle = wDk(col, 0.35); g.lineWidth = s * 0.05; g.stroke(body);
      // scalloped valance
      g.beginPath(); for (let i = 0; i < 7; i++) { const vx = sx + s * 0.15 + ((w - s * 0.3) * (i + 0.5)) / 7; g.moveTo(vx + (w - s * 0.3) / 14, sh); g.arc(vx, sh, (w - s * 0.3) / 14, 0, Math.PI); }
      fillEdge(g, clayLin(g, sx, sh, w, s * 0.4, '#ffd43b', 0.3, 0.2), '#d9a400', s * 0.03);
      g.beginPath(); g.moveTo(cx - s * 0.75, by - s * 0.02); g.quadraticCurveTo(cx - s * 0.7, by - s * 1.45, cx, by - s * 1.5); g.quadraticCurveTo(cx + s * 0.7, by - s * 1.45, cx + s * 0.75, by - s * 0.02); g.closePath(); fillEdge(g, '#3b2350', '#24142f', s * 0.04);
      for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * s * 0.75, by - s * 0.02); g.quadraticCurveTo(cx + d * s * 0.7, by - s * 1.45, cx, by - s * 1.5); g.quadraticCurveTo(cx + d * s * 0.35, by - s * 0.9, cx + d * s * 0.42, by - s * 0.02); g.closePath(); fillEdge(g, clayLin(g, cx - s * 0.75, by - s * 1.5, s * 1.5, s * 1.5, col, 0.3, 0.2), wDk(col, 0.35), s * 0.03); }
      gloss(g, sx + w * 0.3, sy + h * 0.25, s * 0.35, s * 0.12, 0.35, -0.7);
    } else {
      const ty = sy + h * 0.1, ay = sy + h * 0.42;
      for (const px of [sx + s * 0.3, sx + w - s * 0.3]) { g.beginPath(); rr(g, px - s * 0.06, ty, s * 0.12, h * 0.6, s * 0.05); fillEdge(g, '#e9d8c4', '#a08a70', s * 0.02); }
      g.beginPath(); rr(g, sx + s * 0.15, sy + h * 0.55, w - s * 0.3, h * 0.45, s * 0.14); fillEdge(g, clayLin(g, sx, sy + h * 0.55, w, h * 0.45, '#fff8f0'), wDk(col, 0.3), s * 0.04);
      g.beginPath(); rr(g, sx + s * 0.15, sy + h * 0.55, w - s * 0.3, s * 0.18, [s * 0.14, s * 0.14, 0, 0]); fillEdge(g, clayLin(g, sx, sy + h * 0.55, w, s * 0.18, col, 0.3, 0.2), null);
      const aw = new Path2D(); aw.moveTo(sx, ay); aw.lineTo(sx + s * 0.25, ty); aw.lineTo(sx + w - s * 0.25, ty); aw.lineTo(sx + w, ay); const n = 6; for (let i = n - 1; i >= 0; i--) { const vx = sx + (w * (i + 0.5)) / n; aw.arc(vx, ay, w / n / 2, 0, Math.PI); } aw.closePath();
      g.save(); g.clip(aw); for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#fff8fb' : col; g.fillRect(sx + (w * i) / n, ty - s, w / n + 1, h); } const sh2 = g.createLinearGradient(sx, ty, sx + w * 0.4, ay + s * 0.3); sh2.addColorStop(0, 'rgba(255,255,255,.35)'); sh2.addColorStop(1, wRGBA(SHADOW, 0.2)); g.fillStyle = sh2; g.fillRect(sx, ty, w, h); g.restore();
      g.strokeStyle = wDk(col, 0.35); g.lineWidth = s * 0.045; g.stroke(aw);
      gloss(g, sx + w * 0.3, ty + s * 0.18, s * 0.3, s * 0.06, 0.4, -0.15);
      if (o.label) bldSign(g, cx, sy + h * 0.76, o.label, s, col);
      return;
    }
  } else if (o.kind === 'lighthouse') {
    const lit = WG.litLighthouse, top = sy - s * 0.6, bx0 = sx + w * 0.2, bx1 = sx + w * 0.8, tx0 = sx + w * 0.32, tx1 = sx + w * 0.68;
    const tower = new Path2D(); roundPoly(tower, [[bx0, sy + h], [tx0, top], [tx1, top], [bx1, sy + h]], [s * 0.12, s * 0.1, s * 0.1, s * 0.12]);
    g.fillStyle = clayLin(g, bx0, top, bx1 - bx0, sy + h - top, '#ffffff', 0, 0.16); g.fill(tower);
    g.save(); g.clip(tower); for (let i = 0; i < 3; i++) { const yy = top + s * 0.35 + i * ((sy + h - top) / 3); g.fillStyle = clayLin(g, bx0, yy, bx1 - bx0, s * 0.4, '#ef4444', 0.25, 0.2); g.fillRect(bx0, yy, bx1 - bx0, s * 0.42); } const sh2 = g.createLinearGradient(bx0, 0, bx1, 0); sh2.addColorStop(0, 'rgba(255,255,255,.3)'); sh2.addColorStop(0.45, 'rgba(255,255,255,0)'); sh2.addColorStop(1, wRGBA(SHADOW, 0.22)); g.fillStyle = sh2; g.fillRect(bx0, top, bx1 - bx0, sy + h - top); g.restore();
    g.strokeStyle = '#b8a9b8'; g.lineWidth = s * 0.04; g.stroke(tower);
    bldDoor(g, cx, sy + h, s * 0.55, s * 0.85, s, '#c25b3b');
    g.beginPath(); rr(g, sx + w * 0.26, top - s * 0.12, w * 0.48, s * 0.18, s * 0.08); fillEdge(g, clayLin(g, sx, top - s * 0.12, w, s * 0.18, '#c92a2a'), '#7a1f1f', s * 0.03);
    g.beginPath(); rr(g, sx + w * 0.35, top - s * 0.62, w * 0.3, s * 0.52, s * 0.08);
    if (lit) { const gr = g.createRadialGradient(cx, top - s * 0.36, 0, cx, top - s * 0.36, s * 0.5); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#ffc928'); fillEdge(g, gr, '#c99a00', s * 0.03); } else fillEdge(g, clayLin(g, sx + w * 0.35, top - s * 0.62, w * 0.3, s * 0.5, '#6f86a3', 0.35, 0.25), '#3e4d63', s * 0.03);
    g.strokeStyle = 'rgba(122,31,31,.7)'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(cx, top - s * 0.6); g.lineTo(cx, top - s * 0.12); g.stroke();
    g.beginPath(); g.moveTo(sx + w * 0.3, top - s * 0.6); g.quadraticCurveTo(cx, top - s * 1.25, sx + w * 0.7, top - s * 0.6); g.closePath(); fillEdge(g, clayRad(g, cx, top - s * 0.75, s * 0.5, '#e03131'), '#7a1f1f', s * 0.03);
    g.fillStyle = clayRad(g, cx, top - s * 0.98, s * 0.1, '#ffd43b'); g.beginPath(); g.arc(cx, top - s * 0.98, s * 0.09, 0, 7); g.fill();
    gloss(g, cx - w * 0.08, top - s * 0.78, s * 0.12, s * 0.05, 0.5);
    gloss(g, sx + w * 0.36, sy + h * 0.45, s * 0.05, h * 0.25, 0.3, 0.1);
  } else if (o.kind === 'castle') {
    const stone = wall, tw = s * 1.4;
    g.beginPath(); rr(g, sx + s * 0.3, sy + s * 0.5, w - s * 0.6, h - s * 0.5, [s * 0.1, s * 0.1, s * 0.16, s * 0.16]); fillEdge(g, clayLin(g, sx, sy + s * 0.5, w, h, stone, 0.3, 0.18), wDk(stone, 0.4), s * 0.045);
    for (let i = 0; i < 4; i++) { g.beginPath(); rr(g, sx + s * 1.55 + i * s * 0.78, sy + s * 0.12, s * 0.5, s * 0.5, s * 0.12); fillEdge(g, clayLin(g, 0, sy + s * 0.12, s * 0.5, s * 0.5, stone, 0.35, 0.15), wDk(stone, 0.4), s * 0.04); }
    g.strokeStyle = wRGBA(wDk(stone, 0.2), 0.35); g.lineWidth = s * 0.035; for (let i = 0; i < 9; i++) { const bx = sx + s * (1.6 + hash2(i, 1) * (o.w - 3.4)), by = sy + s * (1 + hash2(i, 2) * (o.h - 2.6)); g.beginPath(); rr(g, bx, by, s * 0.45, s * 0.22, s * 0.08); g.stroke(); }
    for (const tx of [sx, sx + w - tw]) {
      g.beginPath(); rr(g, tx, sy - s * 0.5, tw, h + s * 0.5, [s * 0.15, s * 0.15, s * 0.2, s * 0.2]); fillEdge(g, clayLin(g, tx, sy - s * 0.5, tw, h, wDk(stone, 0.06), 0.35, 0.2), wDk(stone, 0.42), s * 0.045);
      gloss(g, tx + s * 0.25, sy + s * 0.6, s * 0.06, s * 0.7, 0.3, 0);
      bldWin(g, tx + s * 0.45, sy + s * 0.75, s * 0.5, s * 0.65, s, { lit: true, frame: '#8d93a8', wall: stone });
      g.beginPath(); roundPoly(g, [[tx - s * 0.18, sy - s * 0.45], [tx + tw / 2, sy - s * 1.85], [tx + tw + s * 0.18, sy - s * 0.45]], [s * 0.12, s * 0.12, s * 0.12]); fillEdge(g, clayLin(g, tx, sy - s * 1.85, tw, s * 1.4, roof, 0.35, 0.25), wDk(roof, 0.4), s * 0.045);
      gloss(g, tx + tw * 0.33, sy - s * 0.95, s * 0.06, s * 0.28, 0.4, 0.5);
      g.fillStyle = clayRad(g, tx + tw / 2, sy - s * 1.9, s * 0.1, '#ffd43b'); g.beginPath(); g.arc(tx + tw / 2, sy - s * 1.9, s * 0.09, 0, 7); g.fill();
    }
    g.strokeStyle = '#c99a00'; g.lineWidth = s * 0.07; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, sy + s * 0.15); g.lineTo(cx, sy - s * 1.2); g.stroke();
    g.fillStyle = clayRad(g, cx + s * 0.32, sy - s * 0.95, s * 0.3, '#d9a066'); g.beginPath(); g.arc(cx + s * 0.32, sy - s * 0.95, s * 0.28, 0, 7); g.fill(); g.strokeStyle = '#9c6b3a'; g.lineWidth = s * 0.03; g.stroke();
    g.fillStyle = '#5c3a21'; for (const [dx, dy] of [[0.22, -1.05], [0.42, -0.95], [0.28, -0.82], [0.4, -1.1]]) { g.beginPath(); g.arc(cx + dx * s, sy + dy * s, s * 0.04, 0, 7); g.fill(); }
    bldWin(g, cx - s * 1.1, sy + s * 1.15, s * 0.45, s * 0.55, s, { lit: true, frame: '#8d93a8', wall: stone, cross: true });
    bldWin(g, cx + s * 0.65, sy + s * 1.15, s * 0.45, s * 0.55, s, { lit: true, frame: '#8d93a8', wall: stone, cross: true });
    bldDoor(g, cx, sy + h, s * 1.4, s * 1.75, s, '#7a4a2a');
    g.strokeStyle = 'rgba(60,30,15,.4)'; g.lineWidth = s * 0.03; for (const d of [-0.35, 0.35]) { g.beginPath(); g.moveTo(cx + d * s, sy + h - s * 1.5); g.lineTo(cx + d * s, sy + h - s * 0.12); g.stroke(); }
  } else if (o.kind === 'observatory') {
    g.beginPath(); rr(g, sx + s * 0.1, sy + h * 0.42, w - s * 0.2, h * 0.58, [s * 0.1, s * 0.1, s * 0.18, s * 0.18]); fillEdge(g, clayLin(g, sx, sy + h * 0.42, w, h * 0.58, wall, 0.4, 0.18), wDk(wall, 0.35), s * 0.045);
    g.save(); g.translate(cx + s * 0.1, sy + h * 0.22); g.rotate(-0.55); g.beginPath(); rr(g, -s * 0.22, -s * 1.25, s * 0.44, s * 1.45, s * 0.12); fillEdge(g, clayLin(g, -s * 0.22, -s * 1.25, s * 0.44, s * 1.4, '#5c7cfa', 0.35, 0.25), '#364fc7', s * 0.035); g.beginPath(); rr(g, -s * 0.27, -s * 1.3, s * 0.54, s * 0.22, s * 0.08); fillEdge(g, '#ffd43b', '#c99a00', s * 0.03); g.restore();
    g.beginPath(); g.moveTo(sx + w * 0.08, sy + h * 0.46); g.arc(cx, sy + h * 0.46, w * 0.42, Math.PI, 0); g.closePath(); fillEdge(g, clayRad(g, cx, sy + h * 0.3, w * 0.45, '#dfe4f0', 0.6, 0.25), '#8c94ad', s * 0.045);
    g.save(); g.clip(); g.fillStyle = '#4a5578'; g.translate(cx, sy + h * 0.46); g.rotate(0.5); g.fillRect(-s * 0.18, -w * 0.5, s * 0.36, w * 0.5); g.restore();
    gloss(g, cx - w * 0.2, sy + h * 0.2, s * 0.35, s * 0.12, 0.55, -0.6);
    g.beginPath(); rr(g, sx, sy + h * 0.42, w, s * 0.18, s * 0.08); fillEdge(g, clayLin(g, sx, sy + h * 0.42, w, s * 0.18, '#7b93fb'), '#4263eb', s * 0.03);
    bldWin(g, sx + s * 0.55, sy + h * 0.62, s * 0.55, s * 0.55, s, { round: true, wall });
    bldWin(g, sx + w - s * 1.1, sy + h * 0.62, s * 0.55, s * 0.55, s, { round: true, wall });
    bldDoor(g, cx, sy + h, s * 0.85, s * 1.05, s, '#5c7cfa');
  } else {
    const roofH = o.kind === 'barn' ? h * 0.5 : o.kind === 'mart' ? s * 1.05 : h * 0.45, wx0 = sx + s * 0.12, wx1 = sx + w - s * 0.12, wy0 = sy + roofH - s * 0.15;
    if (o.kind === 'house' || o.kind === 'hall') { const chx = sx + w * 0.72; g.beginPath(); rr(g, chx, sy + roofH * 0.05, s * 0.45, roofH * 0.7, [s * 0.08, s * 0.08, 0, 0]); fillEdge(g, clayLin(g, chx, sy, s * 0.45, roofH, '#c47a5a'), '#7a3f2a', s * 0.035); g.beginPath(); rr(g, chx - s * 0.06, sy + roofH * 0.05 - s * 0.05, s * 0.57, s * 0.16, s * 0.06); fillEdge(g, '#a85d42', '#6b3524', s * 0.03); }
    if (o.kind === 'lab') { const dx = sx + w - s * 1.2; g.beginPath(); g.moveTo(dx + s * 0.45, sy - s * 0.1); g.lineTo(dx + s * 0.45, sy - s * 0.65); g.strokeStyle = '#868e96'; g.lineWidth = s * 0.06; g.stroke(); g.fillStyle = clayRad(g, dx + s * 0.45, sy - s * 0.7, s * 0.09, '#ff6b6b'); g.beginPath(); g.arc(dx + s * 0.45, sy - s * 0.7, s * 0.09, 0, 7); g.fill(); }
    g.beginPath(); rr(g, wx0, wy0, wx1 - wx0, sy + h - wy0, [s * 0.1, s * 0.1, s * 0.18, s * 0.18]); fillEdge(g, clayLin(g, wx0, wy0, wx1 - wx0, sy + h - wy0, wall, 0.4, 0.16), wDk(wall, o.kind === 'manor' ? 0.45 : 0.32), s * 0.045);
    g.save(); g.clip(); const eg = g.createLinearGradient(0, wy0, 0, wy0 + s * 0.5); eg.addColorStop(0, wRGBA(wDk(wall, 0.5), 0.35)); eg.addColorStop(1, wRGBA(wDk(wall, 0.5), 0)); g.fillStyle = eg; g.fillRect(wx0, wy0, wx1 - wx0, s * 0.5); g.fillStyle = wRGBA(wDk(wall, 0.25), 0.35); g.fillRect(wx0, sy + h - s * 0.2, wx1 - wx0, s * 0.2); g.restore();
    if (o.kind === 'barn') {
      g.strokeStyle = '#fff6ee'; g.lineWidth = s * 0.1; g.beginPath(); rr(g, wx0 + s * 0.12, wy0 + s * 0.12, wx1 - wx0 - s * 0.24, sy + h - wy0 - s * 0.24, s * 0.1); g.stroke();
      const dw = s * 2, dh = s * 1.8, dx = cx - dw / 2, dy = sy + h - dh;
      g.beginPath(); rr(g, dx, dy, dw, dh, [s * 0.12, s * 0.12, 0, 0]); fillEdge(g, clayLin(g, dx, dy, dw, dh, wDk(wall, 0.18), 0.2, 0.2), '#fff6ee', s * 0.1);
      g.strokeStyle = '#fff6ee'; g.lineWidth = s * 0.09; g.lineCap = 'round'; g.beginPath(); g.moveTo(dx + s * 0.1, dy + s * 0.1); g.lineTo(dx + dw - s * 0.1, dy + dh - s * 0.05); g.moveTo(dx + dw - s * 0.1, dy + s * 0.1); g.lineTo(dx + s * 0.1, dy + dh - s * 0.05); g.moveTo(cx, dy); g.lineTo(cx, dy + dh); g.stroke();
    }
    // Roof
    if (o.kind === 'mart') {
      g.beginPath(); rr(g, sx - s * 0.12, sy + s * 0.15, w + s * 0.24, s * 0.62, s * 0.22); fillEdge(g, clayLin(g, sx, sy + s * 0.15, w, s * 0.62, roof, 0.35, 0.2), wDk(roof, 0.38), s * 0.05);
      gloss(g, sx + s * 0.6, sy + s * 0.3, s * 0.5, s * 0.07, 0.5, 0);
      for (const [bx, by, br] of [[0.25, -0.12, 0.26], [0.6, -0.3, 0.16], [0.8, -0.08, 0.2]]) { const X = sx + w * bx, Y = sy + by * s; const gr = g.createRadialGradient(X - br * s * 0.4, Y - br * s * 0.4, 0, X, Y, br * s); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.6, 'rgba(165,216,255,.55)'); gr.addColorStop(1, 'rgba(116,192,252,.8)'); g.fillStyle = gr; g.beginPath(); g.arc(X, Y, br * s, 0, 7); g.fill(); g.strokeStyle = 'rgba(77,171,247,.8)'; g.lineWidth = s * 0.025; g.stroke(); }
      const ay = sy + s * 0.77, ah = s * 0.45, n = Math.max(4, o.w * 2), aw = new Path2D(); aw.moveTo(sx, ay); aw.lineTo(sx + w, ay); aw.lineTo(sx + w, ay + ah * 0.6); for (let i = n - 1; i >= 0; i--) aw.arc(sx + (w * (i + 0.5)) / n, ay + ah * 0.6, w / n / 2, 0, Math.PI); aw.closePath();
      g.save(); g.clip(aw); for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#ffffff' : roof; g.fillRect(sx + (w * i) / n, ay, w / n + 1, ah * 2); } const sh2 = g.createLinearGradient(0, ay, 0, ay + ah); sh2.addColorStop(0, 'rgba(255,255,255,.2)'); sh2.addColorStop(1, wRGBA(SHADOW, 0.18)); g.fillStyle = sh2; g.fillRect(sx, ay, w, ah * 2); g.restore();
      g.strokeStyle = wDk(roof, 0.35); g.lineWidth = s * 0.04; g.stroke(aw);
    } else {
      let pts;
      if (o.kind === 'barn') pts = [[sx - s * 0.25, sy + roofH], [sx + s * 0.45, sy + s * 0.35], [cx, sy - s * 0.35], [sx + w - s * 0.45, sy + s * 0.35], [sx + w + s * 0.25, sy + roofH]];
      else if (o.kind === 'manor') pts = [[sx - s * 0.3, sy + roofH], [sx + w * 0.25, sy - s * 0.5], [sx + w * 0.5, sy + s * 0.25], [sx + w * 0.75, sy - s * 0.7], [sx + w + s * 0.3, sy + roofH]];
      else pts = [[sx - s * 0.3, sy + roofH], [cx, sy - s * 0.25], [sx + w + s * 0.3, sy + roofH]];
      gableRoof(g, pts, roof, s);
      const apex = pts[o.kind === 'barn' ? 2 : 1], l = pts[0];
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = s * 0.07; g.lineCap = 'round'; g.beginPath(); g.moveTo(apex[0] + (l[0] - apex[0]) * 0.12, apex[1] + (l[1] - apex[1]) * 0.12 + s * 0.12); g.lineTo(apex[0] + (l[0] - apex[0]) * 0.55, apex[1] + (l[1] - apex[1]) * 0.55 + s * 0.12); g.stroke();
      if (o.kind === 'barn') bldWin(g, cx - s * 0.35, sy + s * 0.55, s * 0.7, s * 0.7, s, { round: true, frame: '#fff6ee', glass: '#f2c94c', wall: roof });
      if (o.kind === 'hall') { const ky = sy + roofH * 0.55; g.beginPath(); g.arc(cx, ky, s * 0.36, 0, 7); fillEdge(g, clayRad(g, cx, ky, s * 0.36, '#fffdf5', 0.5, 0.1), wDk(roof, 0.4), s * 0.06); g.strokeStyle = INK; g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, ky); g.lineTo(cx, ky - s * 0.22); g.moveTo(cx, ky); g.lineTo(cx + s * 0.15, ky + s * 0.05); g.stroke(); g.strokeStyle = '#8d5a33'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(cx, sy - s * 0.25); g.lineTo(cx, sy - s * 0.95); g.stroke(); g.beginPath(); g.moveTo(cx, sy - s * 0.95); g.lineTo(cx + s * 0.5, sy - s * 0.8); g.lineTo(cx, sy - s * 0.62); g.closePath(); fillEdge(g, clayLin(g, cx, sy - s * 0.95, s * 0.5, s * 0.33, '#4dabf7'), '#1c7ed6', s * 0.02); }
      if (o.kind === 'house') { const hx = cx, hy = sy + roofH * 0.55, r = s * 0.15; g.beginPath(); g.moveTo(hx, hy + r * 1.3); g.bezierCurveTo(hx - r * 2.2, hy, hx - r * 0.9, hy - r * 1.4, hx, hy - r * 0.4); g.bezierCurveTo(hx + r * 0.9, hy - r * 1.4, hx + r * 2.2, hy, hx, hy + r * 1.3); fillEdge(g, clayRad(g, hx, hy, r * 1.4, '#ff8fab'), '#c2255c', s * 0.03); }
      if (o.kind === 'manor') { bldWin(g, sx + w * 0.75 - s * 0.25, sy + s * 0.15, s * 0.5, s * 0.5, s, { round: true, lit: true, frame: '#3b2a6b', wall: roof }); bldWin(g, sx + w * 0.25 - s * 0.2, sy + s * 0.35, s * 0.4, s * 0.4, s, { round: true, lit: true, frame: '#3b2a6b', wall: roof }); }
      if (o.kind === 'bakery') { const ky = sy - s * 0.55; g.beginPath(); g.moveTo(cx - s * 0.38, ky); g.lineTo(cx + s * 0.38, ky); g.lineTo(cx + s * 0.28, ky + s * 0.45); g.lineTo(cx - s * 0.28, ky + s * 0.45); g.closePath(); fillEdge(g, clayLin(g, cx - s * 0.38, ky, s * 0.76, s * 0.45, '#ff8fab'), '#c2255c', s * 0.03); g.strokeStyle = 'rgba(194,37,92,.45)'; g.lineWidth = s * 0.03; g.beginPath(); for (const d of [-0.15, 0, 0.15]) { g.moveTo(cx + d * s * 1.3, ky + s * 0.04); g.lineTo(cx + d * s, ky + s * 0.42); } g.stroke(); g.beginPath(); g.moveTo(cx - s * 0.42, ky + s * 0.02); g.quadraticCurveTo(cx - s * 0.45, ky - s * 0.3, cx - s * 0.15, ky - s * 0.32); g.quadraticCurveTo(cx, ky - s * 0.62, cx + s * 0.15, ky - s * 0.32); g.quadraticCurveTo(cx + s * 0.45, ky - s * 0.3, cx + s * 0.42, ky + s * 0.02); g.closePath(); fillEdge(g, clayRad(g, cx, ky - s * 0.2, s * 0.45, '#fff0f6', 0.5, 0.12), '#e8a0bf', s * 0.03); g.fillStyle = clayRad(g, cx, ky - s * 0.55, s * 0.11, '#ff3b5c'); g.beginPath(); g.arc(cx, ky - s * 0.55, s * 0.1, 0, 7); g.fill(); gloss(g, cx - s * 0.03, ky - s * 0.58, s * 0.03, s * 0.02, 0.8); for (let i = 0; i < 5; i++) { g.fillStyle = ['#ffd43b', '#4dabf7', '#51cf66', '#ff6b6b', '#b197fc'][i]; g.save(); g.translate(cx + (hash2(i, 4) - 0.5) * s * 0.6, ky - s * (0.1 + hash2(i, 8) * 0.25)); g.rotate(i); g.fillRect(-s * 0.03, -s * 0.01, s * 0.06, s * 0.02); g.restore(); } }
    }
    // Windows & door
    if (o.kind !== 'barn') {
      const mart = o.kind === 'mart', manor = o.kind === 'manor';
      const wy = mart ? sy + s * 1.45 : wy0 + Math.min(s * 0.5, (sy + h - wy0) * 0.28), ww = mart ? s * 0.8 : s * 0.6, wh = mart ? s * 0.65 : s * 0.55;
      for (const tx of [s * 0.45, w - s * 0.45 - ww]) if (tx + ww < w / 2 - s * 0.45 || tx > w / 2 + s * 0.45) bldWin(g, sx + tx, wy, ww, wh, s, { wall, lit: manor, frame: manor ? '#3b2a6b' : '#ffffff', cross: !mart, box: o.kind === 'house' || o.kind === 'bakery' ? '#9c6b3a' : null });
      bldDoor(g, cx, sy + h, s * 0.78, s * 1.02, s, manor ? '#2a1b4d' : o.kind === 'lab' ? '#4dabf7' : o.kind === 'mart' ? '#22b8cf' : '#a0673a');
    }
  }
  if (o.label) bldSign(g, cx, o.kind === 'mart' ? sy + s * 0.46 : sy + Math.max(s * 0.9, h * 0.45 - s * 0.05), o.label, s, col);
}
function drawBuilding(g, o, sx, sy, s) {
  const lit = o.kind === 'lighthouse' && WG.litLighthouse;
  drawSpr(g, 'b:' + o.kind + ':' + o.w + 'x' + o.h + ':' + (o.color || '') + ':' + (o.label || '') + (lit ? ':lit' : ''), sx, sy, s, o.w, o.h, [0.9, 2.2, 1, 0.8], (q, S) => paintBuilding(q, o, 0, 0, S));
  if (o.kind === 'ferris') {
    const w = o.w * s, h = o.h * s, cx = sx + w / 2, cy = sy + h * 0.45, r = Math.min(w, h) * 0.42, t = performance.now() / 4000;
    g.lineCap = 'round';
    g.strokeStyle = '#ffd43b'; g.lineWidth = s * 0.05; g.beginPath(); for (let i = 0; i < 8; i++) { const a = t + (i * Math.PI) / 4; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.stroke();
    g.strokeStyle = '#c2255c'; g.lineWidth = s * 0.17; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.strokeStyle = '#f783ac'; g.lineWidth = s * 0.11; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = s * 0.03; g.beginPath(); g.arc(cx, cy, r - s * 0.02, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = t + (i * Math.PI) / 4, gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r, c = ['#4dabf7', '#ff6b6b', '#51cf66', '#845ef7'][i % 4];
      g.drawImage(sprite('cab:' + c, s * 0.7, s * 0.7, (q) => { q.strokeStyle = '#868e96'; q.lineWidth = s * 0.04; q.beginPath(); q.moveTo(s * 0.35, 0); q.lineTo(s * 0.35, s * 0.15); q.stroke(); q.beginPath(); rr(q, s * 0.08, s * 0.12, s * 0.54, s * 0.46, [s * 0.1, s * 0.1, s * 0.2, s * 0.2]); fillEdge(q, clayLin(q, s * 0.08, s * 0.12, s * 0.54, s * 0.46, c), wDk(c, 0.4), s * 0.03); q.beginPath(); rr(q, s * 0.16, s * 0.2, s * 0.38, s * 0.16, s * 0.06); q.fillStyle = 'rgba(255,255,255,.75)'; q.fill(); }), gx - s * 0.35, gy - s * 0.02, s * 0.7, s * 0.7);
    }
    g.fillStyle = clayRad(g, cx, cy, s * 0.25, '#ffd43b'); g.beginPath(); g.arc(cx, cy, s * 0.22, 0, 7); g.fill(); g.strokeStyle = '#c99a00'; g.lineWidth = s * 0.03; g.stroke();
  }
  if (o.kind === 'lighthouse' && lit) { const w = o.w * s, bx = sx + w / 2, by = sy - s * 0.96, a = performance.now() / 900; const gr = g.createRadialGradient(bx, by, 0, bx, by, s * 6); gr.addColorStop(0, 'rgba(255,236,140,.45)'); gr.addColorStop(1, 'rgba(255,236,140,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * s * 6, by + Math.sin(a) * s * 2 - s); g.lineTo(bx + Math.cos(a + 0.25) * s * 6, by + Math.sin(a + 0.25) * s * 2 + s); g.fill(); }
}

/* ---- Blockers, props, items ---- */
function paintBlockCell(g, kind, s) {
  const cx = s * 0.5, cy = s * 0.55;
  softShadow(g, cx + s * 0.05, s * 0.88, s * 0.44, s * 0.12, 0.3);
  if (kind === 'log') {
    g.beginPath(); rr(g, s * 0.02, s * 0.32, s * 0.86, s * 0.5, s * 0.24); fillEdge(g, clayLin(g, 0, s * 0.32, s, s * 0.5, '#a0673a', 0.25, 0.25), '#5e3a20', s * 0.03);
    g.strokeStyle = 'rgba(70,40,20,.4)'; g.lineWidth = s * 0.025; g.lineCap = 'round'; for (const y of [0.45, 0.6, 0.7]) { g.beginPath(); g.moveTo(s * 0.12, y * s); g.lineTo(s * 0.6, y * s); g.stroke(); }
    g.beginPath(); g.ellipse(s * 0.78, s * 0.57, s * 0.16, s * 0.25, 0, 0, 7); fillEdge(g, clayRad(g, s * 0.78, s * 0.57, s * 0.25, '#e8c08a', 0.3, 0.15), '#8d5a33', s * 0.03);
    g.strokeStyle = 'rgba(141,90,51,.6)'; g.lineWidth = s * 0.02; for (const r of [0.06, 0.11]) { g.beginPath(); g.ellipse(s * 0.78, s * 0.57, r * s * 0.65, r * s, 0, 0, 7); g.stroke(); }
    g.fillStyle = '#6cbf55'; g.beginPath(); ell(g, s * 0.3, s * 0.32, s * 0.08, s * 0.04, -0.4); ell(g, s * 0.4, s * 0.3, s * 0.07, s * 0.035, 0.5); g.fill();
    gloss(g, s * 0.3, s * 0.4, s * 0.16, s * 0.03, 0.4, 0);
  } else if (kind === 'crumbs') {
    g.beginPath(); g.arc(cx, cy, s * 0.36, 0, 7); fillEdge(g, clayRad(g, cx, cy, s * 0.36, '#e0a96d'), '#9c6b3a', s * 0.035);
    g.fillStyle = '#5c3a21'; for (const [dx, dy] of [[-0.15, -0.1], [0.12, -0.15], [0.05, 0.08], [-0.12, 0.15], [0.2, 0.12]]) { g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, s * 0.05, s * 0.04, dx * 4, 0, 7); g.fill(); }
    gloss(g, cx - s * 0.14, cy - s * 0.18, s * 0.09, s * 0.04, 0.45);
    g.fillStyle = '#d9a066'; for (const [dx, dy] of [[0.4, 0.3], [-0.38, 0.28], [0.3, 0.36]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, s * 0.04, 0, 7); g.fill(); }
  } else if (kind === 'hay') {
    g.beginPath(); rr(g, s * 0.06, s * 0.22, s * 0.88, s * 0.62, s * 0.16); fillEdge(g, clayLin(g, 0, s * 0.22, s, s * 0.62, '#f2c94c', 0.35, 0.22), '#b8891a', s * 0.03);
    g.strokeStyle = 'rgba(184,137,26,.55)'; g.lineWidth = s * 0.02; g.lineCap = 'round'; for (let i = 0; i < 7; i++) { const y = s * (0.3 + i * 0.075); g.beginPath(); g.moveTo(s * (0.14 + hash2(i, 1) * 0.1), y); g.lineTo(s * (0.6 + hash2(i, 2) * 0.25), y); g.stroke(); }
    g.fillStyle = '#c0392b'; for (const x of [0.3, 0.68]) g.fillRect(x * s, s * 0.22, s * 0.05, s * 0.62);
    gloss(g, s * 0.25, s * 0.32, s * 0.14, s * 0.04, 0.45, 0);
  } else if (kind === 'gate') {
    for (const x of [0.12, 0.88]) { g.beginPath(); rr(g, x * s - s * 0.06, s * 0.3, s * 0.12, s * 0.55, s * 0.05); fillEdge(g, clayLin(g, x * s - s * 0.06, s * 0.3, s * 0.12, s * 0.55, '#adb5bd'), '#5c636a', s * 0.025); }
    const bar = new Path2D(); rr(bar, -s * 0.02, s * 0.38, s * 1.04, s * 0.22, s * 0.11);
    g.save(); g.clip(bar); for (let i = -1; i < 6; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff4d4d'; g.beginPath(); g.moveTo(i * s * 0.22, s * 0.6); g.lineTo(i * s * 0.22 + s * 0.22, s * 0.6); g.lineTo(i * s * 0.22 + s * 0.44, s * 0.38); g.lineTo(i * s * 0.22 + s * 0.22, s * 0.38); g.fill(); } const sh = g.createLinearGradient(0, s * 0.38, 0, s * 0.6); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, wRGBA(SHADOW, 0.25)); g.fillStyle = sh; g.fillRect(0, s * 0.38, s, s * 0.22); g.restore();
    g.strokeStyle = '#a61e1e'; g.lineWidth = s * 0.025; g.stroke(bar);
  } else if (kind === 'icewall') {
    g.beginPath(); rr(g, s * 0.06, s * 0.1, s * 0.88, s * 0.76, s * 0.16); fillEdge(g, clayLin(g, 0, s * 0.1, s, s * 0.76, '#bfe6ff', 0.55, 0.22), '#6aaedc', s * 0.035);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 0.22, s * 0.45); g.lineTo(s * 0.42, s * 0.22); g.moveTo(s * 0.26, s * 0.62); g.lineTo(s * 0.34, s * 0.52); g.stroke();
    g.strokeStyle = 'rgba(90,150,200,.45)'; g.lineWidth = s * 0.025; g.beginPath(); g.moveTo(s * 0.62, s * 0.15); g.lineTo(s * 0.55, s * 0.4); g.lineTo(s * 0.7, s * 0.55); g.stroke();
  }
}
const CLOUD_PUFFS = [[0.28, 0.58, 0.28], [0.55, 0.45, 0.34], [0.8, 0.6, 0.24], [0.52, 0.66, 0.26]];
const cloudSpr = (s) => sprite('cloud', s * 1.2, s * 1.1, (q) => {
  q.translate(s * 0.1, s * 0.05);
  q.fillStyle = 'rgba(80,130,190,.18)'; q.beginPath(); q.ellipse(s * 0.55, s * 0.92, s * 0.45, s * 0.1, 0, 0, 7); q.fill();
  const gr = q.createLinearGradient(0, s * 0.1, 0, s * 0.95); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f4f9ff'); gr.addColorStop(1, '#c9def5');
  q.beginPath(); for (const [x, y, r] of CLOUD_PUFFS) { q.moveTo(x * s + r * s, y * s); q.arc(x * s, y * s, r * s, 0, 7); } fillOutline(q, gr, 'rgba(150,185,225,.7)', s * 0.025);
  gloss(q, s * 0.45, s * 0.3, s * 0.14, s * 0.06, 0.8);
});
function drawBlocker(g, o, s, cam) {
  const xs = o.cells.map(([x]) => x), ys = o.cells.map(([, y]) => y);
  const sx = (Math.min(...xs) - cam.x) * s, sy = (Math.min(...ys) - cam.y) * s, w = (Math.max(...xs) - Math.min(...xs) + 1) * s, h = (Math.max(...ys) - Math.min(...ys) + 1) * s;
  const cx = sx + w / 2, cy = sy + h / 2, t = performance.now() / 1000;
  if (o.kind === 'puffball') {
    const tw = w / s, th = h / s, bob = Math.sin(t * 2) * s * 0.05;
    drawSpr(g, 'puff:' + tw + 'x' + th, sx, sy + bob, s, tw, th, [2.2, 1.6, 2.2, 1], (q, S) => {
      const W = tw * S, H = th * S, X = W / 2, Y = H / 2, RX = Math.max(W, H) * 0.55, RY = Math.min(W, H) * 0.7 + S * 0.4;
      softShadow(q, X + S * 0.1, H + S * 0.05, RX, S * 0.3, 0.3);
      q.beginPath(); ell(q, X, Y, RX, RY); for (const [dx, dy] of [[-0.6, -0.55], [0, -0.75], [0.6, -0.55], [-0.85, 0], [0.85, 0]]) { q.moveTo(X + dx * RX + RX * 0.35, Y + dy * RY); q.arc(X + dx * RX, Y + dy * RY, RX * 0.35, 0, 7); }
      fillOutline(q, clayRad(q, X, Y, Math.max(RX, RY), '#ffc2da', 0.5, 0.2), '#e88bb0', S * 0.05);
      gloss(q, X - RX * 0.45, Y - RY * 0.55, RX * 0.22, RY * 0.12, 0.6);
      q.strokeStyle = INK; q.lineWidth = S * 0.07; q.lineCap = 'round'; for (const d of [-1, 1]) { q.beginPath(); q.arc(X + d * S * 0.4, Y - S * 0.05, S * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); q.stroke(); }
      q.fillStyle = 'rgba(255,107,157,.45)'; for (const d of [-1, 1]) { q.beginPath(); q.ellipse(X + d * S * 0.72, Y + S * 0.15, S * 0.16, S * 0.09, 0, 0, 7); q.fill(); }
      q.fillStyle = '#c2255c'; q.beginPath(); q.ellipse(X, Y + S * 0.3, S * 0.08, S * 0.1, 0, 0, 7); q.fill();
    });
    g.fillStyle = '#5c7cfa'; g.font = `900 ${s * 0.42}px system-ui`; g.textAlign = 'center'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    const zy = cy - h * 0.5 - s * (0.5 + (t % 1) * 0.5); g.globalAlpha = 1 - (t % 1) * 0.6; g.strokeText('z', cx + s * (0.9 + Math.sin(t) * 0.1), zy); g.fillText('z', cx + s * (0.9 + Math.sin(t) * 0.1), zy); g.globalAlpha = 1;
    return;
  }
  if (o.kind === 'fog') { const c = cloudSpr(s); for (let i = 0; i < 7; i++) { g.globalAlpha = 0.85; g.drawImage(c, sx + w * hash2(i, 3) - s * 0.75 + Math.sin(t + i) * s * 0.2, sy + h * hash2(i, 9) - s * 0.6, s * 1.6, s * 1.45); } g.globalAlpha = 1; return; }
  for (const [x, y] of o.cells) drawSpr(g, 'blk:' + o.kind, (x - cam.x) * s, (y - cam.y) * s, s, 1, 1, 0.3, (q, S) => paintBlockCell(q, o.kind, S));
}


function resize() {
  const cv = WG.cv; if (!cv) return;
  const r = WG.layer.getBoundingClientRect();
  WG.dpr = Math.min(2, window.devicePixelRatio || 1);
  const want = Math.max(32, Math.min(58, Math.floor(Math.min(r.width / 11, r.height / 12))));
  if (want !== WG.ts) { WG.ts = want; for (const c of WG.chunks.values()) c.width = c.height = 0; WG.chunks.clear(); clearSprites(); for (const c of WG.tspr.values()) c.width = 0; WG.tspr.clear(); }
  cv.width = Math.round(r.width * WG.dpr); cv.height = Math.round(r.height * WG.dpr);
  cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  WG.vw = r.width; WG.vh = r.height;
  const sub = WG.layer.querySelector('.wh-sub'), pad = WG.layer.querySelector('.wh-pad');
  if (sub && pad) { WG.hudTop = sub.getBoundingClientRect().bottom - r.top + 10; WG.hudBot = pad.getBoundingClientRect().top - r.top - 10; }
}

function draw() {
  const g = WG.ctx, s = WG.ts, p = wMe(), w = getWorld();
  if (!g || !p || !WG.pos) return;
  g.setTransform(WG.dpr, 0, 0, WG.dpr, 0, 0);
  const px = WG.pos.fx, py = WG.pos.fy;
  const cam = { x: Math.max(0, Math.min(MW - WG.vw / s, px + 0.5 - WG.vw / s / 2)), y: Math.max(-90 / s, Math.min(MH - (WG.vh - 170) / s, py + 0.5 - WG.vh / s / 2)) };
  WG.cam = cam;
  WG.litLighthouse = chDone(p, 2) || (p.ch === 2 && p.step >= 4);
  const R = WREG[regionAt(Math.round(px), Math.round(py))] || WREG[0];
  g.fillStyle = wDk(R.pal.leaf, 0.35); g.fillRect(0, 0, WG.vw, WG.vh);
  const x0 = Math.floor(cam.x / CH), y0 = Math.floor(cam.y / CH), x1 = Math.floor((cam.x + WG.vw / s) / CH), y1 = Math.floor((cam.y + WG.vh / s) / CH);
  WG.built = false;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { if (cx * CH >= MW || cy * CH >= MH) continue; g.drawImage(chunk(cx, cy), (cx * CH - cam.x) * s, (cy * CH - cam.y) * s, CH * s, CH * s); }
  // Paint the next chunk you're about to walk into ahead of time (one per quiet frame, never more than the cache holds)
  if (!WG.built) {
    const m = 5, ax0 = Math.max(0, Math.floor((cam.x - m) / CH)), ay0 = Math.max(0, Math.floor((cam.y - m) / CH)), ax1 = Math.min(Math.ceil(MW / CH) - 1, Math.floor((cam.x + WG.vw / s + m) / CH)), ay1 = Math.min(Math.ceil(MH / CH) - 1, Math.floor((cam.y + WG.vh / s + m) / CH));
    if ((ax1 - ax0 + 1) * (ay1 - ay0 + 1) <= 12) outer: for (let cy = ay0; cy <= ay1; cy++) for (let cx = ax0; cx <= ax1; cx++) if (!WG.chunks.has(chunkKey(cx, cy))) { chunkAhead(cx, cy); break outer; }
  }
  const now = performance.now() / 1000;
  // Water shimmer and cloud bridges
  const tx0 = Math.floor(cam.x), ty0 = Math.floor(cam.y), tx1 = Math.ceil(cam.x + WG.vw / s), ty1 = Math.ceil(cam.y + WG.vh / s);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const t = w.at(x, y);
    if (t === T.WATER) { const ph = (now * 0.8 + hash2(x, y) * 6) % 6; if (ph < 1.2) { g.strokeStyle = `rgba(255,255,255,${0.5 * Math.sin((ph / 1.2) * Math.PI)})`; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo((x - cam.x + 0.2) * s, (y - cam.y + 0.5) * s); g.quadraticCurveTo((x - cam.x + 0.5) * s, (y - cam.y + 0.38) * s, (x - cam.x + 0.8) * s, (y - cam.y + 0.5) * s); g.stroke(); } }
    else if (t === T.CLOUD) { g.globalAlpha = hasCloud(p) ? 1 : 0.3; g.drawImage(cloudSpr(s), (x - cam.x - 0.15) * s, (y - cam.y - 0.1) * s + Math.sin(now * 1.5 + x) * s * 0.04, s * 1.32, s * 1.21); g.globalAlpha = 1; }
  }
  // Sprites, sorted by depth
  const sprites = [];
  const inView = (x, y, m = 3) => x > cam.x - m && x < cam.x + WG.vw / s + m && y > cam.y - m && y < cam.y + WG.vh / s + m;
  for (const o of w.objs) {
    if (!inView(o.x, o.y, 8) || !objVisible(o, p)) continue;
    if (o.type === 'zone') continue;
    if (o.type === 'bld') sprites.push({ y: o.y + o.h, f: () => drawBuilding(g, o, (o.x - cam.x) * s, (o.y - cam.y) * s, s) });
    else if (o.type === 'blocker') sprites.push({ y: o.y + 1, f: () => drawBlocker(g, o, s, cam) });
    else sprites.push({ y: o.y + 0.9, f: () => drawObj(g, o, p, s, cam, now) });
  }
  for (const r of WG.roamers) if (r.on && inView(r.fx, r.fy)) sprites.push({ y: r.fy + 0.9, f: () => drawSquishy(g, r.sid, (r.fx - cam.x) * s, (r.fy - cam.y) * s, s, 0.95, now + r.ph, r.shiny) });
  for (const [id, o] of Object.entries(WG.others)) if (inView(o.fx, o.fy)) sprites.push({ y: o.fy + 0.95, f: () => drawPerson(g, avatarOf(id), o.fx, o.fy, o.d, s, cam, o.walk, member(id)?.name, o.e && Date.now() - o.et < 3500 ? o.e : '', true) });
  sprites.push({ y: py + 0.95, f: () => drawPerson(g, avatarOf(actor()), px, py, WG.pos.d, s, cam, !!WG.move, '', WG.emote && Date.now() - WG.emote.at < 3500 ? WG.emote.e : '') });
  sprites.sort((a, b) => a.y - b.y).forEach((sp) => sp.f());
  // Particles: snow, fireflies, sparkles
  if (R.key === 'frost' || R.key === 'hollow' || R.key === 'peaks') {
    for (let i = 0; i < 40; i++) {
      const a = hash2(i, 7), b = hash2(i, 13), sp = 0.3 + hash2(i, 3) * 0.6;
      const X = ((a * WG.vw + now * 12 * sp * (R.key === 'hollow' ? Math.sin(i) : 0.4)) % WG.vw + WG.vw) % WG.vw, Y = R.key === 'hollow' ? (b * WG.vh + Math.sin(now * sp + i) * 20) : ((b * WG.vh + now * 30 * sp) % WG.vh);
      g.fillStyle = R.key === 'hollow' ? `rgba(180,255,170,${0.5 + 0.5 * Math.sin(now * 3 + i)})` : R.key === 'peaks' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.9)';
      g.beginPath(); g.arc(X, Y, R.key === 'hollow' ? 2 : 2.5 * sp, 0, 7); g.fill();
    }
  }
  // Spooky Hollow is dark until its lanterns are lit
  if (R.key === 'hollow') {
    const lit = (WREG[6].items || []).filter((it) => p.flags['it:' + it.id]).length;
    const sx = (px - cam.x + 0.5) * s, sy = (py - cam.y + 0.4) * s, rad = s * (3.4 + lit * 1.2) * (chDone(p, 7) ? 3 : 1);
    const gr = g.createRadialGradient(sx, sy, rad * 0.35, sx, sy, rad);
    gr.addColorStop(0, 'rgba(10,4,25,0)'); gr.addColorStop(1, `rgba(10,4,25,${chDone(p, 7) ? 0.35 : lit >= 4 ? 0.55 : 0.78})`);
    g.fillStyle = gr; g.fillRect(0, 0, WG.vw, WG.vh);
    for (const it of WREG[6].items) if (p.flags['it:' + it.id]) { const o = objById(it.id); const lx = (o.x - cam.x + 0.5) * s, ly = (o.y - cam.y + 0.3) * s; const lg = g.createRadialGradient(lx, ly, 0, lx, ly, s * 2.2); lg.addColorStop(0, 'rgba(255,214,102,.45)'); lg.addColorStop(1, 'rgba(255,214,102,0)'); g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, s * 2.2, 0, 7); g.fill(); }
  }
  // Unlit lanterns glow faintly while you're looking for them
  if (R.key === 'hollow' && curStep(p)?.collect === 'lantern') for (const it of WREG[6].items) if (!p.flags['it:' + it.id]) { const o = objById(it.id); if (!o) continue; const lx = (o.x - cam.x + 0.5) * s, ly = (o.y - cam.y - 0.5) * s, a = 0.35 + 0.25 * Math.sin(now * 3); const lg = g.createRadialGradient(lx, ly, 0, lx, ly, s * 1.4); lg.addColorStop(0, `rgba(165,216,255,${a})`); lg.addColorStop(1, 'rgba(165,216,255,0)'); g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, s * 1.4, 0, 7); g.fill(); }
  // Quest markers: drawn above the darkness so they can always be seen
  for (const [mx, my, tg] of WG.marks) {
    const c = tg ? '#ffd43b' : '#74c0fc', r = s * 0.32, y0 = my - s * 0.18;
    g.beginPath(); g.moveTo(mx - r * 0.35, y0 + r * 0.8); g.lineTo(mx, y0 + r * 1.35); g.lineTo(mx + r * 0.35, y0 + r * 0.8); g.closePath(); g.arc(mx, y0, r, 0, 7);
    fillEdge(g, clayRad(g, mx, y0, r, c, 0.5, 0.2), wDk(c, 0.45), 2.5); gloss(g, mx - r * 0.4, y0 - r * 0.45, r * 0.28, r * 0.13, 0.75);
    g.fillStyle = INK; g.font = `900 ${s * 0.42}px system-ui`; g.textAlign = 'center'; g.fillText(tg ? '!' : '?', mx, my - s * 0.03);
  }
  WG.marks = [];
  drawGuide(g, p, cam, s, now);
  // Floating text (+1, ! …)
  WG.parts = WG.parts.filter((pt) => now - pt.t < 1.2);
  for (const pt of WG.parts) { const k = (now - pt.t) / 1.2; g.globalAlpha = 1 - k; g.font = `900 ${s * 0.45}px system-ui`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; const X = (pt.x - cam.x + 0.5) * s, Y = (pt.y - cam.y - k) * s; g.strokeText(pt.text, X, Y); g.fillText(pt.text, X, Y); g.globalAlpha = 1; }
}
// Where to go next: a pulsing ring on screen, or an arrow at the screen edge pointing to it
function drawGuide(g, p, cam, s, now) {
  const t = stepTarget(p); if (!t || WG.busy) return;
  const cx = (t[0] - cam.x + 0.5) * s, cy = (t[1] - cam.y + 0.5) * s, m = 36, top = WG.hudTop || 120, bot = WG.hudBot || WG.vh - 200;
  if (cx > m && cx < WG.vw - m && cy > top && cy < bot) { if (Math.hypot(t[0] - WG.pos.fx, t[1] - WG.pos.fy) < 1.6) return; g.strokeStyle = 'rgba(255,212,59,.95)'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy + s * 0.32, s * (0.55 + 0.08 * Math.sin(now * 5)), s * (0.3 + 0.04 * Math.sin(now * 5)), 0, 0, 7); g.stroke(); return; }
  const px = (WG.pos.fx - cam.x + 0.5) * s, py = (WG.pos.fy - cam.y + 0.5) * s, a = Math.atan2(cy - py, cx - px), c = Math.cos(a), sn = Math.sin(a);
  const k = Math.min(Math.abs(c) > 1e-6 ? Math.abs(((c > 0 ? WG.vw - m : m) - px) / c) : 1e9, Math.abs(sn) > 1e-6 ? Math.abs(((sn > 0 ? bot : top) - py) / sn) : 1e9), bob = Math.sin(now * 6) * 6;
  if (!(k > 0 && k < 1e8)) return;
  g.save(); g.translate(px + c * (k - bob), py + sn * (k - bob)); g.rotate(a);
  g.fillStyle = clayLin(g, -12, -18, 36, 36, '#ffd43b', 0.45, 0.2); g.strokeStyle = '#b07d00'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); g.moveTo(24, 0); g.lineTo(-12, -18); g.lineTo(-4, 0); g.lineTo(-12, 18); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function drawPerson(g, a, x, y, d, s, cam, walking, name, emote, other) {
  const im = avImg(a); const H = s * 1.75, W = (H * 100) / 158, now = performance.now() / 1000;
  const bob = walking ? Math.abs(Math.sin(now * 12)) * s * 0.08 : Math.sin(now * 2) * s * 0.015;
  const X = (x - cam.x + 0.5) * s, Y = (y - cam.y + 1) * s - s * 0.08;
  flatShadow(g, X, Y - s * 0.02, s * 0.32, s * 0.1, 0.22);
  if (im) { g.save(); g.translate(X, Y - bob); if (d === 'left') g.scale(-1, 1); g.drawImage(im, -W / 2, -H, W, H); g.restore(); }
  // Standing in tall grass: the blades cover your feet
  const w = getWorld(), tx = Math.round(x), ty = Math.round(y);
  if (w.at(tx, ty) === T.TALL && !walking) { const R = WREG[regionAt(tx, ty)]; g.beginPath(); for (let i = 0; i < 5; i++) ell(g, X - s * 0.42 + i * s * 0.21, Y - s * 0.2, s * 0.09, s * 0.24, (i - 2) * 0.15); fillOutline(g, R.pal.tall2, wRGBA(R.pal.tall, 0.7), 1); }
  if (name) { g.font = `800 ${Math.max(10, s * 0.28)}px system-ui`; g.textAlign = 'center'; const tw = g.measureText(name).width + 10; g.fillStyle = other ? 'rgba(47,138,91,.92)' : 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect ? g.roundRect(X - tw / 2, Y - H - s * 0.42, tw, s * 0.36, 6) : g.rect(X - tw / 2, Y - H - s * 0.42, tw, s * 0.36); g.fill(); g.fillStyle = other ? '#fff' : '#3a2b3d'; g.fillText(name, X, Y - H - s * 0.15); }
  if (emote) { g.font = `${s * 0.7}px system-ui`; g.textAlign = 'center'; g.fillText(emote, X + s * 0.45, Y - H - (name ? s * 0.5 : 0) + Math.sin(now * 6) * 3); }
}
function drawSquishy(g, sid, X, Y, s, scale, now, shiny) {
  const im = sqImg(sid, shiny); const S = s * scale;
  const hop = Math.max(0, Math.sin(now * 4)) * s * 0.18;
  flatShadow(g, X + s / 2, Y + s * 0.92, S * 0.32, S * 0.08, 0.2);
  if (im) g.drawImage(im, X + s / 2 - S / 2, Y + s * 0.95 - S - hop, S, S);
}
function paintBell(q, S) {
  softShadow(q, S * 0.55, S * 0.92, S * 0.5, S * 0.12, 0.28);
  for (const px of [0.16, 0.84]) { q.beginPath(); rr(q, px * S - S * 0.06, -S * 0.58, S * 0.12, S * 1.48, S * 0.05); fillEdge(q, clayLin(q, px * S - S * 0.06, -S * 0.58, S * 0.12, S, '#a0673a'), '#5e3a20', S * 0.025); }
  q.beginPath(); roundPoly(q, [[-S * 0.08, -S * 0.52], [S * 0.5, -S * 0.9], [S * 1.08, -S * 0.52]], S * 0.08); fillEdge(q, clayLin(q, 0, -S * 0.9, S, S * 0.4, '#5c7cfa', 0.35, 0.2), '#364fc7', S * 0.03);
  q.strokeStyle = '#5e3a20'; q.lineWidth = S * 0.03; q.beginPath(); q.moveTo(S * 0.5, -S * 0.5); q.lineTo(S * 0.5, -S * 0.4); q.stroke();
  q.beginPath(); q.moveTo(S * 0.27, S * 0.26); q.quadraticCurveTo(S * 0.28, -S * 0.42, S * 0.5, -S * 0.42); q.quadraticCurveTo(S * 0.72, -S * 0.42, S * 0.73, S * 0.26); q.quadraticCurveTo(S * 0.82, S * 0.3, S * 0.8, S * 0.36); q.lineTo(S * 0.2, S * 0.36); q.quadraticCurveTo(S * 0.18, S * 0.3, S * 0.27, S * 0.26); q.closePath();
  fillEdge(q, clayRad(q, S * 0.5, -S * 0.05, S * 0.45, '#ffd43b', 0.5, 0.25), '#b07d00', S * 0.03);
  q.fillStyle = clayRad(q, S * 0.5, S * 0.42, S * 0.08, '#c99a00'); q.beginPath(); q.arc(S * 0.5, S * 0.42, S * 0.07, 0, 7); q.fill();
  gloss(q, S * 0.4, -S * 0.2, S * 0.05, S * 0.14, 0.6, 0.25);
}
function paintStop(q, S, on) {
  const c = on ? '#ffd43b' : '#f1efff', cy = -S * 0.3;
  softShadow(q, S * 0.56, S * 0.86, S * 0.26, S * 0.08, 0.3);
  q.beginPath(); rr(q, S * 0.44, cy, S * 0.12, S * 1.15, S * 0.05); fillEdge(q, clayLin(q, S * 0.44, cy, S * 0.12, S, '#a0673a'), '#5e3a20', S * 0.025);
  q.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? S * 0.19 : S * 0.42; q.lineTo(S / 2 + Math.cos(a) * r, cy + Math.sin(a) * r); } q.closePath();
  q.lineJoin = 'round'; q.strokeStyle = on ? '#d99a00' : '#a9a3d6'; q.lineWidth = S * 0.09; q.stroke();
  q.fillStyle = clayRad(q, S / 2, cy, S * 0.42, c, 0.55, 0.18); q.fill();
  gloss(q, S * 0.4, cy - S * 0.1, S * 0.07, S * 0.035, 0.75);
}
function paintLantern(q, S, lit) {
  softShadow(q, S * 0.55, S * 0.88, S * 0.22, S * 0.07, 0.4, '#0d0718');
  q.beginPath(); rr(q, S * 0.45, -S * 0.42, S * 0.1, S * 1.3, S * 0.04); fillEdge(q, clayLin(q, S * 0.45, -S * 0.42, S * 0.1, S, '#4d3f6b'), '#1e1630', S * 0.025);
  q.beginPath(); rr(q, S * 0.29, -S * 0.76, S * 0.42, S * 0.5, S * 0.12); fillEdge(q, '#2f2545', '#1a1229', S * 0.03);
  q.beginPath(); rr(q, S * 0.35, -S * 0.7, S * 0.3, S * 0.38, S * 0.08);
  if (lit) { const gr = q.createRadialGradient(S * 0.5, -S * 0.5, 0, S * 0.5, -S * 0.5, S * 0.25); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#ffb829'); q.fillStyle = gr; } else q.fillStyle = clayLin(q, S * 0.35, -S * 0.7, S * 0.3, S * 0.38, '#6c6488', 0.3, 0.2);
  q.fill(); gloss(q, S * 0.42, -S * 0.6, S * 0.03, S * 0.08, 0.55, 0.1);
  q.beginPath(); roundPoly(q, [[S * 0.24, -S * 0.74], [S * 0.5, -S * 0.95], [S * 0.76, -S * 0.74]], S * 0.05); fillEdge(q, clayLin(q, S * 0.24, -S * 0.95, S * 0.5, S * 0.2, '#4d3f6b'), '#1a1229', S * 0.025);
}
const ITEM_ART = {
  '🐚': (q, S) => {
    softShadow(q, S * 0.52, S * 0.82, S * 0.3, S * 0.07, 0.25);
    q.beginPath(); q.moveTo(S * 0.5, S * 0.8); q.lineTo(S * 0.2, S * 0.56); q.arc(S * 0.5, S * 0.52, S * 0.3, Math.PI * 1.05, Math.PI * 1.95); q.closePath();
    fillEdge(q, clayRad(q, S * 0.5, S * 0.45, S * 0.36, '#ffb3c7', 0.5, 0.2), '#d9638f', S * 0.03);
    q.strokeStyle = 'rgba(217,99,143,.55)'; q.lineWidth = S * 0.022; q.lineCap = 'round'; q.beginPath(); for (let i = 1; i < 6; i++) { const a = Math.PI * (1.05 + (i * 0.9) / 6); q.moveTo(S * 0.5, S * 0.76); q.lineTo(S * 0.5 + Math.cos(a) * S * 0.27, S * 0.52 + Math.sin(a) * S * 0.27); } q.stroke();
    q.beginPath(); rr(q, S * 0.41, S * 0.72, S * 0.18, S * 0.1, S * 0.04); fillEdge(q, '#ff8fab', '#d9638f', S * 0.02);
    gloss(q, S * 0.38, S * 0.36, S * 0.07, S * 0.035, 0.7);
  },
  '🫐': (q, S) => {
    softShadow(q, S * 0.52, S * 0.8, S * 0.3, S * 0.07, 0.25);
    q.fillStyle = '#51a84a'; q.beginPath(); q.ellipse(S * 0.62, S * 0.3, S * 0.14, S * 0.06, -0.6, 0, 7); q.fill();
    for (const [x, y, r] of [[0.36, 0.58, 0.16], [0.64, 0.6, 0.15], [0.5, 0.42, 0.16]]) { q.beginPath(); q.arc(x * S, y * S, r * S, 0, 7); fillEdge(q, clayRad(q, x * S, y * S, r * S, '#5c6ff0', 0.45, 0.25), '#3342a8', S * 0.022); q.fillStyle = '#2b2f80'; q.beginPath(); q.arc(x * S + r * S * 0.25, y * S - r * S * 0.2, r * S * 0.22, 0, 7); q.fill(); gloss(q, x * S - r * S * 0.35, y * S - r * S * 0.4, r * S * 0.28, r * S * 0.14, 0.7); }
  },
};
function drawObj(g, o, p, s, cam, now) {
  const X = (o.x - cam.x) * s, Y = (o.y - cam.y) * s;
  const st = curStep(p), target = st && (st.talk === o.id || st.special === o.id);
  if (o.type === 'npc') drawPerson(g, lookOf(o.look), o.x, o.y, o.dir || 'down', s, cam, false, '', '');
  else if (o.type === 'guardian') { const big = !chDone(p, o.c + 1) && !(p.flags['g:' + o.id]); drawSquishy(g, guardianSid(o), X, Y, s, big ? 1.9 : 1.15, now * (big ? 0.6 : 1), false); if (o.guardian.ghost) { g.globalAlpha = 0.25; g.fillStyle = '#fff'; g.beginPath(); g.arc(X + s / 2, Y + s * 0.3, s * 0.9, 0, 7); g.fill(); g.globalAlpha = 1; } }
  else if (o.type === 'special') drawSquishy(g, specialSid(o), X, Y, s, 0.9, now * 1.6, false);
  else if (o.type === 'bell') drawSpr(g, 'bell', X, Y, s, 1, 1, [0.3, 1, 0.3, 0.2], paintBell);
  else if (o.type === 'stop') drawSpr(g, 'stop:' + (p.visited[o.c] ? 1 : 0), X, Y, s, 1, 1, [0.2, 0.9, 0.2, 0.2], (q, S) => paintStop(q, S, !!p.visited[o.c]));
  else if (o.type === 'item') {
    if (o.lantern) { const lit = p.flags['it:' + o.id]; if (lit) { const lg = g.createRadialGradient(X + s / 2, Y - s * 0.52, 0, X + s / 2, Y - s * 0.52, s * 0.6 + Math.sin(now * 5) * 2); lg.addColorStop(0, 'rgba(255,212,59,.55)'); lg.addColorStop(1, 'rgba(255,212,59,0)'); g.fillStyle = lg; g.beginPath(); g.arc(X + s / 2, Y - s * 0.52, s * 0.62, 0, 7); g.fill(); } drawSpr(g, 'lan:' + (lit ? 1 : 0), X, Y, s, 1, 1, [0.2, 1, 0.2, 0.2], (q, S) => paintLantern(q, S, lit)); }
    else if (o.group === 'escapee') drawSquishy(g, o._sid || (o._sid = (SQUISHIES.filter((x) => x.set === o.set && x.r === 'C')[hash2(o.x, o.y) * 3 | 0] || SQUISHIES[0]).id), X, Y, s, 0.85, now * 2 + o.x, false);
    else {
      const b = Math.sin(now * 3 + o.x) * s * 0.06, gx = X + s / 2, gy = Y + s * 0.6, gr = s * (0.42 + Math.sin(now * 4) * 0.04);
      const lg = g.createRadialGradient(gx, gy, 0, gx, gy, gr); lg.addColorStop(0, 'rgba(255,255,255,.75)'); lg.addColorStop(0.6, 'rgba(255,250,220,.35)'); lg.addColorStop(1, 'rgba(255,250,220,0)'); g.fillStyle = lg; g.beginPath(); g.arc(gx, gy, gr, 0, 7); g.fill();
      if (ITEM_ART[o.icon]) drawSpr(g, 'it:' + o.icon, X, Y + b, s, 1, 1, 0.2, (q, S) => ITEM_ART[o.icon](q, S));
      else { g.font = `${s * 0.6}px system-ui`; g.textAlign = 'center'; g.fillStyle = INK; g.fillText(o.icon || '✨', X + s / 2, Y + s * 0.75 + b); }
    }
  }
  const sqp = o.side && p.sides[o.side.id], sideReady = o.side && (!sqp || (!sqp.done && (sqp.n || 0) >= o.side.n));
  if (target || (o.shop && false) || sideReady) { const bob = Math.sin(now * 5) * s * 0.08; g.font = `900 ${s * 0.55}px system-ui`; g.textAlign = 'center'; g.fillStyle = target ? '#ffd43b' : '#74c0fc'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; const ty = Y - s * (o.type === 'guardian' ? 1.6 : 1.25) + bob; WG.marks.push([X + s / 2, ty, target]); }
}

/* =========================================================
   5 · Movement & input
   ========================================================= */
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], upleft: [-1, -1], upright: [1, -1], downleft: [-1, 1], downright: [1, 1] };
const DIAG = { upleft: 1, upright: 1, downleft: 1, downright: 1 };
function tryStep(dir) {
  const p = wMe(); if (!p || WG.busy || WG.move) return false;
  if (DIAG[dir]) return tryDiagonal(dir, p);
  WG.pos.d = dir;
  const [dx, dy] = DIRS[dir], nx = WG.pos.x + dx, ny = WG.pos.y + dy;
  if (blockedAt(nx, ny, p)) { worldBump(nx, ny, p); return false; }
  WG.move = { fx: WG.pos.x, fy: WG.pos.y, tx: nx, ty: ny, t: 0, dur: getWorld().at(nx, ny) === T.ICE ? 0.08 : 0.17, dir };
  WG.pos.x = nx; WG.pos.y = ny;
  return true;
}
// Diagonal steps: never cut a corner past a wall, and never on ice (the Slippy Slopes stay a straight-line puzzle).
// When the diagonal is blocked, slide along whichever straight direction is open, like most top-down games.
function tryDiagonal(dir, p) {
  const [dx, dy] = DIRS[dir], x = WG.pos.x, y = WG.pos.y, w = getWorld();
  const h = dx > 0 ? 'right' : 'left', v = dy > 0 ? 'down' : 'up';
  const hOk = !blockedAt(x + dx, y, p), vOk = !blockedAt(x, y + dy, p);
  const icy = w.at(x, y) === T.ICE || w.at(x + dx, y + dy) === T.ICE || w.at(x + dx, y) === T.ICE || w.at(x, y + dy) === T.ICE;
  if (!icy && hOk && vOk && !blockedAt(x + dx, y + dy, p)) {
    WG.pos.d = h; // sprites face left/right
    WG.move = { fx: x, fy: y, tx: x + dx, ty: y + dy, t: 0, dur: 0.17 * 1.35, dir };
    WG.pos.x = x + dx; WG.pos.y = y + dy;
    return true;
  }
  // Prefer the axis the player is pushing harder on (last straight direction), then the other
  const first = WG.lastAxis === 'v' ? [v, h] : [h, v];
  for (const d of first) if (!blockedAt(x + DIRS[d][0], y + DIRS[d][1], p)) return tryStep(d);
  return tryStep(first[0]); // both blocked: bump the first one
}
function worldBump(x, y, p) {
  const o = getWorld().occ.get(x + ',' + y);
  if (Date.now() - (WG.bumpT || 0) < 600) return; // holding into a wall: react once, not every frame
  WG.bumpT = Date.now(); if (typeof haptic === "function") haptic();
  if (getWorld().at(x, y) === T.CLOUD && !hasCloud(p)) { toast('☁️ The cloud bridge blew away! Maybe someone can call it back…'); return; }
  if (o && o.type === 'blocker' && objVisible(o, p)) { toast(BLOCKER_TEXT[o.kind] || 'The way is blocked.'); return; }
  const r = WG.roamers.find((q) => q.on && q.x === x && q.y === y);
  if (r) { encounter(r.sid, { roamer: r, shiny: r.shiny }); return; }
  const it = itemAt(x, y, p);
  if (it && it.group === 'escapee') { interact(it); return; }
  if (o && objVisible(o, p) && o.type !== 'bld') interact(o);
}
function update(dt) {
  const p = wMe(); if (!p) return;
  // Others on the map glide toward their latest spot
  for (const o of Object.values(WG.others)) { const k = Math.min(1, dt * 8); const ox = o.fx, oy = o.fy; o.fx += (o.x - o.fx) * k; o.fy += (o.y - o.fy) * k; o.walk = Math.abs(o.fx - ox) + Math.abs(o.fy - oy) > 0.002; }
  // Roamers hop about in their meadows
  const now = performance.now();
  for (const r of WG.roamers) {
    if (!r.on) { if (now > r.back) spawnRoamer(r); continue; }
    r.fx += (r.x - r.fx) * Math.min(1, dt * 6); r.fy += (r.y - r.fy) * Math.min(1, dt * 6);
    if (now > r.next) { r.next = now + 900 + Math.random() * 1600; const [dx, dy] = Object.values(DIRS)[Math.floor(Math.random() * 4)]; const nx = r.x + dx, ny = r.y + dy; if (getWorld().at(nx, ny) === T.TALL && !(nx === WG.pos.x && ny === WG.pos.y) && !WG.roamers.some((q) => q !== r && q.x === nx && q.y === ny)) { r.x = nx; r.y = ny; } }
  }
  let carry = 0; // time left over from the last step, so held walking never pauses on a tile
  if (WG.move) {
    const m = WG.move; m.t += dt;
    const k = Math.min(1, m.t / m.dur);
    WG.pos.fx = m.fx + (m.tx - m.fx) * k; WG.pos.fy = m.fy + (m.ty - m.fy) * k;
    if (k < 1) return;
    WG.move = null; arrive(m.dir);
    carry = Math.min(0.05, m.t - m.dur);
    if (WG.move) { WG.move.t = carry; return; } // still sliding on ice
  }
  WG.pos.fx = WG.pos.x; WG.pos.fy = WG.pos.y;
  if (WG.busy) return;
  if (WG.path.length) { const d = WG.path.shift(); if (!tryStep(d)) { WG.path = []; WG.pendingTalk = null; } else WG.move.t = carry; return; }
  if (WG.pendingTalk) {
    const o = WG.pendingTalk; WG.pendingTalk = null;
    if (Math.abs(o.x - WG.pos.x) + Math.abs(o.y - WG.pos.y) > 1) return; // it moved
    faceTo(o.x, o.y);
    if (o.sid && o.on !== undefined) { if (o.on) encounter(o.sid, { roamer: o, shiny: o.shiny }); } else interact(o);
    return;
  }
  if (WG.queue) { const q = WG.queue; WG.queue = null; if (tryStep(q)) { WG.move.t = carry; return; } }
  if (WG.hold && performance.now() - (WG.holdAt || 0) > 230 && tryStep(WG.hold)) WG.move.t = carry; // a quick tap = one step
}
function faceTo(x, y) { const dx = x - WG.pos.x, dy = y - WG.pos.y; WG.pos.d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'; }
function arrive(dir) {
  const p = wMe(), w = getWorld(), x = WG.pos.x, y = WG.pos.y;
  WG.steps++;
  // Ice: keep sliding until something stops you
  if (w.at(x, y) === T.ICE) { const [dx, dy] = DIRS[dir]; if (!blockedAt(x + dx, y + dy, p)) { WG.path = []; tryStep(dir); return; } }
  const r = regionAt(x, y);
  if (r !== WG.region) enterRegion(r, p); else if (WREG[r]?.key === 'frost') updateHud();
  // Items you walk over
  const it = itemAt(x, y, p);
  if (it && it.group !== 'escapee') pickItem(it, p);
  for (const z of w.objs) if (z.type === 'zone' && x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) { const st = curStep(p); if (st && st.reach === z.id) advance(p); }
  if (typeof liveSend === 'function' && Date.now() - (WG.liveT || 0) > (typeof Live !== 'undefined' && Live.fallback ? 3000 : 1000)) { WG.liveT = Date.now(); clearTimeout(Live.timer); liveSend(); } else if (typeof livePush === 'function') livePush();
  if (Date.now() - WG.saveT > 3000) { WG.saveT = Date.now(); savePos(); }
  // Wild encounters in tall grass
  const canEnc = (p.bubbles || 0) > 0 || !!curStep(p)?.catch;
  if (canEnc && w.at(x, y) === T.TALL && !WG.path.length && WG.steps - WG.lastEnc > 2 && Math.random() < 0.13) { WG.lastEnc = WG.steps; WG.hold = null; WG.queue = null; WG.path = []; setTimeout(() => encounter(wildSid(r), {}), 120); }
  else if (canEnc && w.at(x, y) === T.TALL && WG.path.length && WG.steps - WG.lastEnc > 3 && Math.random() < 0.08) { WG.lastEnc = WG.steps; WG.path = []; WG.pendingTalk = null; setTimeout(() => encounter(wildSid(r), {}), 120); }
}
const WPOS_KEY = 'gomezfam:wpos';
try { const x = JSON.parse(localStorage.getItem(WPOS_KEY) || 'null'); if (x && typeof x === 'object' && !Array.isArray(x)) state.settings.wpos = { ...(state.settings.wpos && typeof state.settings.wpos === 'object' ? state.settings.wpos : {}), ...x }; } catch {}
const wposMap = () => { const w = state.settings.wpos; return w && typeof w === 'object' && !Array.isArray(w) ? w : (state.settings.wpos = {}); };
function savePos() {
  const me = actor(); if (!me || !WG.pos || WG.posFor !== me) return;
  // Where you're standing is kept per phone (settings.wpos never syncs), so walking never rewrites the family document.
  wposMap()[me] = { x: WG.pos.x, y: WG.pos.y, d: WG.pos.d };
  try { localStorage.setItem(WPOS_KEY, JSON.stringify(wposMap())); } catch {} // tiny key: walking never rewrites all the data
}
window.addEventListener('pagehide', () => { if (WG.layer && !WG.layer.hidden) savePos(); });
function enterRegion(r, p) {
  WG.region = r;
  if (r < 0) return;
  const R = WREG[r];
  if (!p.visited[r]) p.visited[r] = 1;
  WG.roamers = [];
  for (let i = 0; i < 4; i++) { const q = { region: r, on: false, back: 0 }; spawnRoamer(q); WG.roamers.push(q); }
  titleCard(R);
  updateHud();
}
function spawnRoamer(q) {
  const R = REG_POS[q.region]; if (!R) return;
  const w = getWorld(), ox = R[0] * RW, oy = R[1] * RH;
  for (let k = 0; k < 60; k++) {
    const x = ox + 2 + Math.floor(Math.random() * (RW - 4)), y = oy + 2 + Math.floor(Math.random() * (RH - 4));
    if (w.at(x, y) !== T.TALL || (WG.pos && Math.abs(x - WG.pos.x) + Math.abs(y - WG.pos.y) < 4)) continue;
    const sid = wildSid(q.region);
    Object.assign(q, { x, y, fx: x, fy: y, sid, on: true, next: performance.now() + 1000, ph: Math.random() * 6, shiny: Math.random() < 0.015 });
    return;
  }
  q.on = false; q.back = performance.now() + 30000;
}
function wildPool(r) {
  const R = WREG[r] || WREG[0];
  const sets = [...R.sets, ...(R.seasonSet && inSeason(R.seasonSet) ? [R.seasonSet] : [])];
  return SQUISHIES.filter((s) => s.r !== 'U' && (sets.includes(s.set) || (sets.includes('niddo') && s.kind === 'niddo')) && (!s.season || inSeason(s.season)));
}
function wildSid(r) {
  const pool = wildPool(r);
  const tier = pickWeighted([['C', 60], ['R', 28], ['E', 9], ['L', 2.6], ['M', 0.4]]);
  return pickFromPool(pool, tier).id;
}
function pathTo(tx, ty, near) {
  const p = wMe(), sx = WG.pos.x, sy = WG.pos.y;
  const key = (x, y) => x + ',' + y, prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
  const goal = (x, y) => (near ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
  let end = null;
  for (let i = 0; i < q.length && i < 6000; i++) {
    const [x, y] = q[i];
    if (goal(x, y)) { end = [x, y]; break; }
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || Math.abs(nx - sx) + Math.abs(ny - sy) > 40) continue;
      if (blockedAt(nx, ny, p) || getWorld().at(nx, ny) === T.ICE) continue;
      prev.set(k, [key(x, y), d]); q.push([nx, ny]);
    }
  }
  if (!end) return null;
  const out = [];
  for (let k = key(...end); prev.get(k); k = prev.get(k)[0]) out.unshift(prev.get(k)[1]);
  return out;
}
function onTap(e) {
  if (WG.busy || !WG.cam) return;
  const r = WG.cv.getBoundingClientRect(), s = WG.ts;
  const tx = Math.floor(WG.cam.x + (e.clientX - r.left) / s), ty = Math.floor(WG.cam.y + (e.clientY - r.top) / s);
  const p = wMe(), w = getWorld();
  let o = w.occ.get(tx + ',' + ty);
  if (!o || !objVisible(o, p) || o.type === 'bld') o = WG.roamers.find((q) => q.on && q.x === tx && q.y === ty) || itemAt(tx, ty, p) || (o && o.type === 'bld' ? null : o);
  if (o && o.type === 'bld') o = null;
  if (o && objVisible(o, p) && o.type !== 'zone') {
    if (Math.abs(o.x - WG.pos.x) + Math.abs(o.y - WG.pos.y) === 1) { faceTo(o.x, o.y); if (o.sid && o.on) encounter(o.sid, { roamer: o, shiny: o.shiny }); else interact(o); return; }
    const path = pathTo(o.x, o.y, true);
    if (path) { WG.path = path; WG.pendingTalk = o; }
    return;
  }
  const nope = () => WG.parts.push({ x: tx, y: ty + 0.6, text: '✖', t: performance.now() / 1000 });
  if (blockedAt(tx, ty, p)) { const b = w.occ.get(tx + ',' + ty); if (b && b.type === 'blocker' && objVisible(b, p)) toast(BLOCKER_TEXT[b.kind]); else nope(); return; }
  const path = pathTo(tx, ty, false);
  if (path) { WG.path = path; WG.pendingTalk = null; tapMark(tx, ty); } else nope();
}
function tapMark(x, y) { WG.parts.push({ x, y: y + 0.6, text: '•', t: performance.now() / 1000 }); }
function frontObj() {
  const p = wMe(), [dx, dy] = DIRS[WG.pos.d], x = WG.pos.x + dx, y = WG.pos.y + dy, w = getWorld();
  const o = w.occ.get(x + ',' + y);
  if (o && objVisible(o, p) && o.type !== 'bld') return o;
  const r = WG.roamers.find((q) => q.on && q.x === x && q.y === y); if (r) return r;
  const it = itemAt(x, y, p) || itemAt(WG.pos.x, WG.pos.y, p);
  if (it) return it;
  for (const [ddx, ddy] of Object.values(DIRS)) { const n = w.occ.get(WG.pos.x + ddx + ',' + (WG.pos.y + ddy)); if (n && objVisible(n, p) && n.type !== 'bld' && n.type !== 'blocker') { faceTo(n.x, n.y); return n; } }
  return null;
}
function pressA() {
  if (WG.busy) return;
  const o = frontObj();
  if (!o) { WG.parts.push({ x: WG.pos.x, y: WG.pos.y, text: '?', t: performance.now() / 1000 }); return; }
  if (o.sid && o.on !== undefined) encounter(o.sid, { roamer: o, shiny: o.shiny }); else interact(o);
}

/* =========================================================
   6 · Story runner
   ========================================================= */
async function interact(o) {
  const p = wMe(); if (!p || WG.busy) return;
  WG.hold = null; WG.queue = null; WG.path = [];
  const st = curStep(p);
  if (o.type === 'blocker') { toast(BLOCKER_TEXT[o.kind]); return; }
  if (o.type === 'stop') return travelMenu(o);
  if (o.type === 'item') {
    if (o.group === 'escapee') { const ep = WG.epoch; wLock(); try { const ok = await miniGame({ type: 'ring', title: 'Gently now!', sub: 'Pop the bubble when it’s green', need: 1, of: 3, zone: 0.34, speed: 1.6, art: squishySVG(o._sid) }); if (ok && WG.epoch === ep) pickItem(o, wMe()); } finally { if (WG.epoch === ep) wUnlock(); } return; }
    if (o.lantern) { if (p.flags['it:' + o.id]) return; if (st?.collect !== 'lantern') { toast('A cold, dark lantern post. 🏮'); return; } return pickItem(o, p); }
    return pickItem(o, p);
  }
  if (o.shop) return shopMenu(o);
  if (o.type === 'special') {
    if (st && st.special === o.id) return runStep(p, st, o);
    return;
  }
  if (st && st.talk === o.id && p.ch === o.c + 1) return runStep(p, st, o);
  // Side quests
  if (o.side) {
    const sq = o.side, have = p.sides[sq.id];
    if (!have) { await dialog(sq.ask.map((t) => [o.id, t])); wMe().sides[sq.id] = { n: 0 }; save(); updateHud(); return; }
    if (have.done) return dialog((sq.after || ['Thanks again, Ranger! 🤙']).map((t) => [o.id, t]));
    if (have.n >= sq.n) { have.done = true; reward(p, sq.give); save(); return dialog(sq.thanks.map((t) => [o.id, t])); }
    return dialog([[o.id, `${have.n} of ${sq.n} so far — keep going!`]]);
  }
  if (o.type === 'guardian' && !chDone(p, o.c + 1) && p.ch === o.c + 1 && !p.flags['g:' + o.id]) return dialog([[o.id, 'It looks at you warily… maybe someone in town knows how to help.']]);
  const idle = o.idle || NPC_IDLE[o.id]?.(p) || ['Hi there, Ranger! 👋'];
  return dialog(idle.map((t) => [o.id, t]));
}
async function runStep(p, st, o) {
  const ep = WG.epoch, live = () => ep === WG.epoch;
  wLock();
  let held = true;
  try {
    if (st.lines) await dialog(st.lines);
    if (!live()) return;
    if (st.game) {
      const ok = await miniGame({ ...st.game, art: o.type === 'guardian' ? squishySVG(guardianSid(o)) : o.type === 'special' ? squishySVG(specialSid(o)) : '', who: o.id });
      if (!live()) return;
      if (!ok) { if (st.lose) await dialog(st.lose); return; }
      if (st.win) await dialog(st.win);
      if (!live()) return;
      p = wMe(); if (!p || curStep(p) !== st) return; // state was replaced and the step already moved on
      if (st.joins) { const g = objById(st.joins); const sid = guardianSid(g); p.flags['g:' + g.id] = 1; const { isNew } = giveSquishy(actor(), sid, 'wild'); celebrateJoin(sid, isNew, g.name); }
    }
    p = wMe(); if (!p || curStep(p) !== st) return;
    if (st.set) p.flags[st.set] = 1;
    if (st.give) reward(p, st.give);
    wUnlock(); held = false; // chapter cards manage themselves
    await advance(p);
  } finally { if (held && live()) wUnlock(); }
}
function reward(p, give) {
  if (give.bubbles) { p.bubbles = (p.bubbles || 0) + give.bubbles; floatText(`+${give.bubbles} 🫧`); }
  if (give.gems) gemLog(actor(), give.gems, give.note || 'Squishvale reward', 'bonus', give.key || '');
  updateHud();
}
function advance(p) {
  p.step++; p.cnt = 0;
  if (p.step >= STORY[p.ch].length) return completeChapter(p);
  save(); updateHud();
  const st = curStep(p);
  if (st) { objectiveFlash(); sqSound('pop'); floatText('✔'); if (simpleNow() && typeof speak === 'function') setTimeout(() => { if (!WG.layer?.hidden && !WG.busy) speak(goalText(wMe() || p)); }, 900); }
}
async function completeChapter(p) {
  const ch = p.ch, R = WREG[ch - 1];
  if (!p.done.includes(ch)) { p.done.push(ch); p.bubbles = (p.bubbles || 0) + 5; }
  const gems = ch === 8 ? 100 : 25;
  gemLog(actor(), gems, `Squishvale: ${R.name} star ⭐`, 'bonus', 'world:ch' + ch);
  p.ch = ch + 1; p.step = 0; p.cnt = 0;
  save(); updateHud();
  if (typeof logAct === 'function') logAct('⭐', `won back the ${R.name} Squish Star in Squishvale!`, 'world');
  sqSound('win'); if (typeof confetti === 'function') confetti();
  await starCard(ch, gems);
  if (ch === 8) { await endingCard(); if (typeof checkUltimates === 'function') { ui.ultBusy = false; checkUltimates(actor()); } }
  else { const N = WREG[ch]; await chapterCard(N); }
}
function pickItem(it, p) {
  const st = curStep(p);
  if (!st || st.collect !== it.group) return;
  p.flags['it:' + it.id] = 1;
  p.items[it.group] = (p.items[it.group] || 0) + 1;
  sqSound('pop'); WG.parts.push({ x: it.x, y: it.y, text: it.lantern ? '🔥' : `${p.items[it.group]}/${st.n}`, t: performance.now() / 1000 });
  if (p.items[it.group] >= st.n) advance(p); else { save(); updateHud(); }
}
function onCatch(p, sid, r) {
  const st = curStep(p);
  if (st && st.catch) { p.cnt = (p.cnt || 0) + 1; if (p.cnt >= st.catch) advance(p); }
  for (const n of WREG.flatMap((R) => R.npcs || []).filter((x) => x.side)) {
    const q = p.sides[n.side.id];
    if (q && !q.done && SQ[sid].set === n.side.set) { q.n = (q.n || 0) + 1; if (q.n === n.side.n) setTimeout(() => toast(`🎉 Side quest done! Go tell ${n.name.split(' · ')[0]}.`), 1600); }
  }
  void r;
}

/* ---------- Targets for the objective arrow ---------- */
function stepTarget(p) {
  const st = curStep(p); if (!st) return null;
  const id = st.talk || st.special;
  if (id) { const o = getWorld().objs.find((x) => x.id === id && x.c === p.ch - 1) || objById(id); return o ? [o.x, o.y] : null; }
  if (st.collect) { const its = getWorld().objs.filter((o) => o.type === 'item' && o.group === st.collect && !p.flags['it:' + o.id]); its.sort((a, b) => Math.hypot(a.x - WG.pos.x, a.y - WG.pos.y) - Math.hypot(b.x - WG.pos.x, b.y - WG.pos.y)); return its[0] ? [its[0].x, its[0].y] : null; }
  if (st.reach) { const z = objById(st.reach); return z ? [z.x + 1, z.y + 1] : null; }
  if (st.catch) { const w = getWorld(); let best = null, bd = 1e9; for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) { const x = WG.pos.x + dx, y = WG.pos.y + dy; if (w.at(x, y) === T.TALL && Math.abs(dx) + Math.abs(dy) < bd) { bd = Math.abs(dx) + Math.abs(dy); best = [x, y]; } } return best; }
  return null;
}
function goalText(p) {
  const st = curStep(p);
  if (!st) {
    if (p.ch <= 8) return '';
    const pool = [...new Set(WREG.flatMap((R, r) => wildPool(r).filter((s) => s.r !== 'M').map((s) => s.id)))];
    const got = pool.filter((id) => ownsSid(actor(), id)).length;
    return got >= pool.length ? '🏆 Your Squishvale Guide is complete! Master Ranger!' : `🎉 All 8 stars home! Fill your Guide 📖 (${got}/${pool.length})`;
  }
  let t = fill(st.goal);
  if (st.collect) t += ` (${p.items[st.collect] || 0}/${st.n})`;
  if (st.catch) t += ` (${p.cnt || 0}/${st.catch})`;
  return t;
}

/* =========================================================
   7 · Overlays: dialogue, cards, encounters, mini-games, menus
   ========================================================= */
const wEl = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; WG.layer.appendChild(d); return d; };
const simpleNow = () => typeof isSimple === 'function' && actor() && isSimple(actor());
function portrait(id) {
  const o = objById(id) || getWorld().objs.find((x) => x.id === id);
  if (id === 'you') return avatarSVG(avatarOf(actor()), { head: true });
  if (!o) return '';
  if (o.type === 'guardian') return squishySVG(guardianSid(o));
  if (o.type === 'special') return squishySVG(specialSid(o));
  if (o.type === 'bell') return '<span style="font-size:40px">🔔</span>';
  return avatarSVG(lookOf(o.look), { head: true });
}
function dialog(lines) {
  return new Promise((resolve) => {
    let i = 0, timer = 0, full = false;
    const d = wEl('wdlg', `<div class="wd-por"></div><div class="wd-body"><b class="wd-name"></b><p class="wd-text"></p></div><button class="wd-say" aria-label="Read aloud" hidden>🔊</button><span class="wd-next">▼</span>`);
    const show = () => {
      const [who, raw] = lines[i]; const text = fill(raw);
      const o = objById(who);
      d.querySelector('.wd-por').innerHTML = portrait(who);
      d.querySelector('.wd-name').textContent = who === 'you' ? member(actor()).name : o?.name || '';
      const el = d.querySelector('.wd-text'); el.textContent = ''; full = false;
      let k = 0; clearInterval(timer);
      if (reduceMotion()) { el.textContent = text; full = true; } // Reduce Motion: the whole line at once
      else timer = setInterval(() => { k += 2; el.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(timer); full = true; } }, 24);
      const say = d.querySelector('.wd-say'); say.hidden = !simpleNow(); say.onclick = (e) => { e.stopPropagation(); speak(text); };
      if (simpleNow() && typeof readAloudOn === 'function' && readAloudOn(actor()) && i === 0) speak(text);
    };
    d.addEventListener('click', () => {
      const text = fill(lines[i][1]);
      if (!full) { clearInterval(timer); d.querySelector('.wd-text').textContent = text; full = true; return; }
      i++;
      if (i >= lines.length) { clearInterval(timer); d.remove(); resolve(); return; }
      show();
    });
    show();
  });
}
function cardOverlay(html, btn = 'Continue') {
  return new Promise((resolve) => {
    const d = wEl('wcard', `<div class="wc-in">${html}<button class="btn block wc-go">${btn}</button></div>`);
    d.querySelector('.wc-go').onclick = () => { d.remove(); resolve(); };
  });
}
function titleCard(R) {
  WG.layer.querySelector('.wtitle')?.remove();
  const t = wEl('wtitle', `<span>${R.emoji}</span><b>${esc(R.name)}</b><small>Chapter ${R.ch} · ${esc(R.title)}</small>`);
  setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2900);
}
const chapterCard = (R) => cardOverlay(`<div class="wc-art">${R.emoji}</div><div class="wc-kick">Chapter ${R.ch}</div><h2>${esc(R.title)}</h2><p>${R.ch === 1 ? `Your adventure starts in <b>${esc(R.name)}</b>!` : `The road to <b>${esc(R.name)}</b> is open!`}</p>`, 'Let’s go!');
const starCard = (ch, gems) => cardOverlay(`<div class="wc-art star">⭐</div><div class="wc-kick">Chapter ${ch} complete!</div><h2>${esc(WREG[ch - 1].name)} Star</h2><p>${ch} of 8 Squish Stars found</p><div class="wc-stars">${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => `<i class="${k <= ch ? 'on' : ''}">★</i>`).join('')}</div><p class="wc-rew">+${gems} ${GEM} · +5 🫧</p>`, 'Yay!');
function celebrateJoin(sid, isNew, nick) { sqSound('win'); setTimeout(() => toast(`💖 ${nick && nick !== SQ[sid].name ? nick + ' the ' + SQ[sid].name : SQ[sid].name} joined your collection!${isNew ? ' (New!)' : ''}`), 200); }
const endingCard = () => cardOverlay(`<div class="wc-art">🎉</div><div class="wc-kick">The End… for now!</div><h2>The Great Squish Festival</h2><p>All eight Squish Stars shine over Squishvale. The squishies are soft and happy, the Baron runs the best cookie stand in town, and you are a true <b>Squish Ranger</b>.</p><p class="wc-rew">👑 Star Ranger unlocked!</p><p class="small">Keep exploring, catch every squishy, and play together with your family!</p>`, 'Keep playing');
function floatText(text) { if (WG.pos) WG.parts.push({ x: WG.pos.x, y: WG.pos.y, text, t: performance.now() / 1000 }); }
async function introSlides() {
  for (const [i, s] of WORLD_INTRO.entries()) await cardOverlay(`<div class="wc-art">${s.art}</div><div class="wc-kick">${i === 0 ? WORLD_SUB : ''}</div><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>`, i === WORLD_INTRO.length - 1 ? 'Start my adventure!' : 'Next');
  await chapterCard(WREG[0]);
}
function objectiveFlash() { const el = WG.layer?.querySelector('.wh-goal'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }

/* ---------- Catching ---------- */
const RING = { C: [0.3, 1.6, 99], R: [0.26, 1.4, 4], E: [0.2, 1.3, 3], L: [0.16, 1.1, 3], M: [0.13, 1.0, 2] };
function teamNearby() { return Object.values(WG.others).some((o) => Math.abs(o.x - WG.pos.x) + Math.abs(o.y - WG.pos.y) <= 5); }
async function encounter(sid, opt = {}) {
  const p = wMe(); if (!p || WG.busy || !SQ[sid] || !WG.layer || WG.layer.hidden) return;
  WG.hold = null; WG.queue = null; WG.path = [];
  const s = SQ[sid], [zone0, speed0, flee] = RING[s.r] || RING.C;
  const team = teamNearby(), simple = simpleNow();
  const zone = Math.min(0.5, zone0 * (simple ? 1.4 : 1) * (team ? 1.25 : 1)), speed = speed0 * (simple ? 1.25 : 1);
  p.guide[sid] = Math.max(p.guide[sid] || 0, 1);
  const R = WREG[regionAt(WG.pos.x, WG.pos.y)] || WREG[0];
  const d = wEl('wenc', `<div class="we-bg we-${R.key}"></div>
    <div class="we-top"><b>A wild ${esc(s.name)}${opt.shiny ? ' ✨' : ''} appeared!</b>${rarityPill(s.r)}${team ? '<span class="we-team">🤝 Teamwork bonus!</span>' : ''}</div>
    <div class="we-stage"><svg class="we-ring" viewBox="-50 -50 100 100"><circle class="we-zone" r="${(0.45 * 46).toFixed(1)}" stroke-width="${(zone * 46).toFixed(1)}"/><circle class="we-cur" r="40"/></svg><div class="we-sq">${squishySVG(sid, { shiny: opt.shiny })}</div></div>
    <div class="we-msg">${simple ? 'Tap 🫧 when the ring is GREEN!' : 'Toss when the ring turns GREEN!'}</div>
    <div class="we-btns"><button class="we-throw">🫧 Toss <small>${p.bubbles || 0}</small></button><button class="we-run">🏃 Run</button></div>`);
  sqSound('pop');
  const cur = d.querySelector('.we-cur'), msg = d.querySelector('.we-msg'), sqEl = d.querySelector('.we-sq');
  let t0 = performance.now(), raf = 0, misses = 0, done = false, lock = false;
  const rad = () => { const ph = ((performance.now() - t0) / 1000 / speed) % 2; return ph < 1 ? 1 - ph * 0.85 : 0.15 + (ph - 1) * 0.85; };
  const inZone = (r) => Math.abs(r - 0.45) <= zone / 2;
  const tick = () => { if (!d.isConnected) return; const r = rad(); cur.setAttribute('r', (r * 46).toFixed(1)); cur.classList.toggle('in', inZone(r)); raf = requestAnimationFrame(tick); };
  tick();
  const finish = (caught) => new Promise((res) => {
    done = true; cancelAnimationFrame(raf);
    setTimeout(() => { d.remove(); res(caught); }, caught ? 1400 : 700);
  });
  return new Promise((resolve) => {
    d.querySelector('.we-run').onclick = async () => { if (done) return; msg.textContent = 'You got away safely.'; resolve(await finish(false)); };
    d.querySelector('.we-throw').onclick = async () => {
      if (done || lock) return;
      const p = wMe(); if (!p) return;
      if ((p.bubbles || 0) <= 0 && curStep(p)?.catch) { p.bubbles = 3; save(); updateHud(); d.querySelector('.we-throw small').textContent = 3; msg.textContent = 'Professor Mallow sent you 3 more bubbles! 🫧 Try again!'; return; }
      if ((p.bubbles || 0) <= 0) { msg.textContent = 'Out of bubbles! 🫧 Get more at a Bubble Shop — or tomorrow’s 5 free ones.'; return; }
      lock = true;
      p.bubbles--; d.querySelector('.we-throw small').textContent = p.bubbles;
      const hit = WG.debug.autoWin || inZone(rad());
      sqEl.classList.add(hit ? 'caught' : 'dodge');
      if (hit) {
        sqSound('win'); msg.innerHTML = `<b>Gotcha!</b> ${esc(s.name)} is in your bubble! 🫧`;
        const { isNew } = giveSquishy(actor(), sid, 'wild', opt.shiny ? { shiny: true } : {});
        const dust = isNew ? 0 : (typeof DUST !== 'undefined' ? DUST[s.r] || 1 : 0);
        if (dust) { state.squish.dust ||= {}; state.squish.dust[actor()] = (state.squish.dust[actor()] || 0) + dust; }
        p.guide[sid] = 2;
        if (isNew) msg.innerHTML += ' <span class="we-new">NEW!</span>'; else if (dust) msg.innerHTML += ` <small>+${dust} 💫</small>`;
        if (opt.roamer) { opt.roamer.on = false; opt.roamer.back = performance.now() + 25000; }
        onCatch(p, sid, R);
        if (['L', 'M'].includes(s.r) || opt.shiny) logAct('🫧', `caught a wild ${opt.shiny ? 'shiny ' : ''}${s.name} in Squishvale!`, 'world');
        save(); updateHud();
        resolve(await finish(true));
        return;
      }
      sqSound('goo'); misses++;
      if (misses >= flee) { msg.textContent = `${s.name} bounced away into the grass!`; if (opt.roamer) { opt.roamer.on = false; opt.roamer.back = performance.now() + 15000; } save(); resolve(await finish(false)); return; }
      msg.textContent = ['So close! Try again!', 'It wiggled free!', 'Almost! Watch the ring…'][(misses - 1) % 3];
      setTimeout(() => { sqEl.classList.remove('dodge'); lock = false; }, 600);
      save();
    };
  });
}

/* ---------- Mini-games ---------- */
function miniGame(cfg) {
  if (WG.debug.autoWin) return Promise.resolve(true);
  if (cfg.type === 'boss') return bossGame(cfg);
  return ({ ring: ringGame, simon: simonGame, rhythm: rhythmGame, quiz: quizGame, hide: hideGame }[cfg.type] || ringGame)(cfg);
}
function gameShell(cfg, body) {
  const d = wEl('wgame', `<div class="wg-in"><div class="wg-head"><b>${esc(cfg.title || '')}</b><small>${esc(cfg.sub || '')}</small></div><div class="wg-body">${body}</div><div class="wg-msg"></div></div>`);
  return { d, msg: (t) => { d.querySelector('.wg-msg').innerHTML = t; }, close: (ms = 900) => new Promise((r) => setTimeout(() => { d.remove(); r(); }, ms)) };
}
async function ringGame(cfg) {
  const simple = simpleNow(), zone = Math.min(0.5, (cfg.zone || 0.25) * (simple ? 1.4 : 1)), speed = (cfg.speed || 1.4) * (simple ? 1.25 : 1);
  const g = gameShell(cfg, `<div class="we-stage small"><svg class="we-ring" viewBox="-50 -50 100 100"><circle class="we-zone" r="20.7" stroke-width="${(zone * 46).toFixed(1)}"/><circle class="we-cur" r="40"/></svg><div class="we-sq">${cfg.art || '<span style="font-size:52px">🎯</span>'}</div></div>
    <div class="wg-score"></div><button class="btn block wg-act">🫧 Toss!</button>`);
  const cur = g.d.querySelector('.we-cur'), score = g.d.querySelector('.wg-score');
  let hits = 0, tries = 0, t0 = performance.now(), raf = 0, lock = false;
  const rad = () => { const ph = ((performance.now() - t0) / 1000 / speed) % 2; return ph < 1 ? 1 - ph * 0.85 : 0.15 + (ph - 1) * 0.85; };
  const tick = () => { if (!g.d.isConnected) return; const r = rad(); cur.setAttribute('r', (r * 46).toFixed(1)); cur.classList.toggle('in', Math.abs(r - 0.45) <= zone / 2); raf = requestAnimationFrame(tick); };
  const log = [], paint = () => { score.innerHTML = [...Array(cfg.of)].map((_, i) => `<i class="${i < tries ? (log[i] ? 'hit' : 'miss') : ''}"></i>`).join(''); };
  paint(); tick();
  return new Promise((resolve) => {
    g.d.querySelector('.wg-act').onclick = async () => {
      if (lock) return; lock = true;
      const hit = Math.abs(rad() - 0.45) <= zone / 2;
      log.push(hit); tries++; if (hit) hits++;
      sqSound(hit ? 'pop' : 'goo'); paint();
      g.msg(hit ? '<b>Nice!</b>' : 'Missed!');
      const win = hits >= cfg.need, lost = cfg.of - tries < cfg.need - hits;
      if (!g.d.isConnected) { resolve(false); return; }
      if (win || lost) { cancelAnimationFrame(raf); g.msg(win ? '<b>🎉 You did it!</b>' : '😅 Not this time…'); if (win) sqSound('win'); await g.close(1100); resolve(win); return; }
      setTimeout(() => { lock = false; }, 350);
    };
  });
}
async function simonGame(cfg) {
  const icons = cfg.icons || ['🔴', '🟡', '🟢', '🔵'], len = Math.max(3, (cfg.len || 5) - (simpleNow() ? 2 : 0));
  const g = gameShell(cfg, `<div class="wg-pads">${icons.map((ic, i) => `<button class="wg-pad p${i}" data-i="${i}">${ic}</button>`).join('')}</div><div class="wg-score"></div>`);
  const pads = [...g.d.querySelectorAll('.wg-pad')], seq = [...Array(len)].map(() => Math.floor(Math.random() * icons.length));
  const flash = (i, ms = 420) => new Promise((r) => { if (!g.d.isConnected) return r(); pads[i].classList.add('lit'); sqSound('pop'); setTimeout(() => { pads[i].classList.remove('lit'); setTimeout(r, 280); }, ms); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lives = 3;
  for (let round = 3; round <= len; round++) {
    g.d.querySelector('.wg-score').textContent = `Round ${round - 2} of ${len - 2} · ${'❤️'.repeat(lives)}`;
    g.msg('Watch…'); pads.forEach((b) => (b.disabled = true)); await sleep(500); if (!g.d.isConnected) return false;
    for (let k = 0; k < round; k++) await flash(seq[k], simpleNow() ? 560 : 420);
    g.msg('Your turn!'); pads.forEach((b) => (b.disabled = false));
    const ok = await new Promise((res) => {
      let k = 0;
      pads.forEach((b) => (b.onclick = () => { const i = Number(b.dataset.i); b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 180); if (i !== seq[k]) { sqSound('goo'); res(false); return; } sqSound('pop'); k++; if (k >= round) res(true); }));
    });
    if (!ok) { lives--; if (lives <= 0) { g.msg('😅 Oops! Let’s try again later.'); await g.close(1200); return false; } g.msg('Oops! Watch again…'); round--; await sleep(800); continue; }
    g.msg('<b>Yes!</b>'); await sleep(450);
  }
  g.msg('<b>🎉 Perfect!</b>'); sqSound('win'); await g.close(1100); return true;
}
async function rhythmGame(cfg) {
  const simple = simpleNow(), beats = cfg.beats || 8, gap = (60 / (cfg.bpm || 70)) * 1000 * (simple ? 1.25 : 1);
  const early = 250, late = simple ? 600 : 480; // kids tap a little after the beat — be generous there
  const g = gameShell(cfg, `<div class="wg-star">⭐</div><div class="wg-score"></div><button class="btn block wg-act">🎵 Tap!</button>`);
  const star = g.d.querySelector('.wg-star'), score = g.d.querySelector('.wg-score');
  const start = performance.now() + 2000, times = [...Array(beats)].map((_, i) => start + i * gap);
  const got = new Set(), rung = new Set(); let raf = 0, strays = 0;
  const tick = () => {
    if (!g.d.isConnected) return;
    const now = performance.now();
    star.classList.toggle('twinkle', times.some((t) => now >= t - 80 && now <= t + 320));
    const bi = times.findIndex((t, i) => !rung.has(i) && now >= t); if (bi >= 0) { rung.add(bi); sqSound('squish'); } // a beat you can hear
    score.innerHTML = times.map((t, i) => `<i class="${got.has(i) ? 'hit' : now > t + late ? 'miss' : ''}"></i>`).join('');
    raf = requestAnimationFrame(tick);
  };
  tick(); g.msg('Get ready… listen for the beat!'); setTimeout(() => { if (g.d.isConnected) g.msg('Tap when the star twinkles ✨'); }, 1500);
  g.d.querySelector('.wg-act').onclick = () => { const now = performance.now(); const i = times.findIndex((t, k) => !got.has(k) && now >= t - early && now <= t + late); if (i >= 0) { got.add(i); sqSound('pop'); } else { strays++; sqSound('goo'); } };
  await new Promise((r) => setTimeout(r, start - performance.now() + (beats - 1) * gap + late + 250));
  cancelAnimationFrame(raf);
  if (!g.d.isConnected) return false;
  const ok = got.size >= Math.ceil(beats * (simple ? 0.6 : 0.7)) && strays <= beats * 2; // mashing doesn't count
  g.msg(ok ? `<b>🎉 ${got.size} of ${beats}! Beautiful!</b>` : strays > beats * 2 ? '😅 Nice and steady — one tap per twinkle!' : `😅 ${got.size} of ${beats}. Almost!`); if (ok) sqSound('win');
  await g.close(1300); return ok;
}
async function quizGame(cfg) {
  const g = gameShell(cfg, `<div class="wg-q"></div><div class="wg-choices"></div><div class="wg-score"></div>`);
  let wrong = 0;
  for (const [i, q] of cfg.qs.entries()) {
    g.d.querySelector('.wg-score').textContent = `Question ${i + 1} of ${cfg.qs.length}`;
    g.d.querySelector('.wg-q').textContent = q.q;
    if (simpleNow() && typeof speak === 'function') speak(q.q);
    const choices = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);
    const box = g.d.querySelector('.wg-choices'); g.msg('');
    box.innerHTML = choices.map((c) => `<button class="wg-choice">${esc(c)}</button>`).join('');
    if (simpleNow() && typeof speak === 'function') setTimeout(() => { if (g.d.isConnected) speak(choices.join('… or… ')); }, 1200);
    await new Promise((res) => {
      box.querySelectorAll('.wg-choice').forEach((b) => (b.onclick = () => {
        if (b.textContent === q.a) { b.classList.add('right'); sqSound('pop'); g.msg('<b>Correct!</b>'); box.querySelectorAll('button').forEach((x) => (x.disabled = true)); setTimeout(res, 700); }
        else { b.classList.add('wrong'); b.disabled = true; wrong++; sqSound('goo'); g.msg('Not that one — try again!'); }
      }));
    });
  }
  const ok = true; // kind: you keep trying until you get each one
  g.msg(wrong ? `<b>🎉 All done!</b> (${wrong} tr${wrong === 1 ? 'y' : 'ies'} to get there)` : '<b>🎉 Perfect!</b>'); sqSound('win'); await g.close(1000); return ok;
}
async function hideGame(cfg) {
  const g = gameShell(cfg, `<div class="wg-graves">${[0, 1, 2, 3].map((i) => `<button class="wg-grave" data-i="${i}"><span class="wg-boo">👻</span><span class="wg-stone">🪦</span></button>`).join('')}</div><div class="wg-score"></div>`);
  const graves = [...g.d.querySelectorAll('.wg-grave')], sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let found = 0;
  await sleep(900);
  for (let round = 1; round <= cfg.rounds; round++) {
    if (!g.d.isConnected) return false;
    g.d.querySelector('.wg-score').textContent = `Round ${round} of ${cfg.rounds} · Found ${found}`;
    const at = Math.floor(Math.random() * 4);
    graves.forEach((b) => { b.disabled = true; b.classList.remove('show', 'peek'); });
    g.msg('Boo is hiding… watch closely!');
    graves[at].classList.add('peek'); await sleep(simpleNow() ? 1300 : 1000); graves[at].classList.remove('peek');
    for (let k = 0; k < (simpleNow() ? 2 : 4); k++) { const a = Math.floor(Math.random() * 4); graves[a].classList.add('wiggle'); await sleep(260); graves[a].classList.remove('wiggle'); }
    g.msg('Where is Boo? Tap a gravestone!'); graves.forEach((b) => (b.disabled = false));
    const pick = await new Promise((res) => graves.forEach((b) => (b.onclick = () => res(Number(b.dataset.i)))));
    graves[at].classList.add('show');
    if (pick === at) { found++; sqSound('pop'); g.msg('<b>Found you!</b> 👻'); } else { sqSound('goo'); g.msg('Hee hee! Not there!'); }
    await sleep(1000);
  }
  const ok = found >= cfg.need;
  g.msg(ok ? '<b>🎉 You found Boo!</b>' : '😅 Boo was too sneaky this time.'); if (ok) sqSound('win');
  await g.close(1100); return ok;
}
async function bossGame(cfg) {
  void cfg;
  // Trials already won stay won (a young player shouldn't redo all three after one slip)
  const mark = (n) => { const q = wMe(); if (q) { q.flags.boss = Math.max(q.flags.boss || 0, n); save(); } }, at = () => wMe()?.flags.boss || 0;
  if (at() < 1) { if (!(await simonGame({ title: 'Trial 1 · Cookie Memory', sub: 'Copy the Baron’s cookie pattern!', len: 5, icons: ['🍪', '🧁', '🍩', '🥐'] }))) return false; mark(1); }
  if (at() < 2) { if (!(await rhythmGame({ title: 'Trial 2 · Crunchy Rhythm', sub: 'Tap on every twinkle!', beats: 10, bpm: 84 }))) return false; mark(2); }
  return ringGame({ title: 'Trial 3 · The Big Toss', sub: 'Land 3 of 5 bubbles!', need: 3, of: 5, zone: 0.24, speed: 1.3, art: '<span style="font-size:56px">🍪</span>' });
}

/* ---------- Shop, travel, menu ---------- */
async function shopMenu(o) {
  const p = wMe();
  const d = wEl('wcard', `<div class="wc-in"><div class="wc-art">🫧</div><h2>Bubble Shop</h2><p>Squish Bubbles catch wild squishies. You have <b class="ws-b">${p.bubbles || 0}</b> 🫧 and <b class="ws-g">${gemBalance(actor())}</b> ${GEM}.</p>
    <button class="btn block ws-buy" data-n="5" data-c="10">5 bubbles · ${GEM} 10</button><button class="btn block secondary ws-buy" data-n="12" data-c="20">12 bubbles · ${GEM} 20</button><button class="btn block secondary wc-go">Bye!</button></div>`);
  void o;
  d.querySelectorAll('.ws-buy').forEach((b) => (b.onclick = () => {
    const p = wMe(); if (!p) return;
    if (!spendGems(actor(), Number(b.dataset.c), 'Squishvale bubbles', 'squish')) return;
    p.bubbles = (p.bubbles || 0) + Number(b.dataset.n); save(); sqSound('pop');
    d.querySelector('.ws-b').textContent = p.bubbles; d.querySelector('.ws-g').textContent = gemBalance(actor()); updateHud();
  }));
  d.querySelector('.wc-go').onclick = () => d.remove();
}
function travelMenu(o) {
  const p = wMe();
  if (o) { p.visited[o.c] = 1; save(); }
  const stops = WREG.map((R, c) => ({ R, c, ok: p.visited[c] }));
  const d = wEl('wcard', `<div class="wc-in"><div class="wc-art">⭐</div><h2>Squish Stops</h2><p>Hop to any town you’ve visited.</p><div class="wt-list">${stops.map(({ R, c, ok }) => `<button class="wt-stop" data-c="${c}" ${ok ? '' : 'disabled'}><span>${ok ? R.emoji : '🔒'}</span><b>${ok ? esc(R.name) : '???'}</b></button>`).join('')}</div><button class="btn block secondary wc-go">Close</button></div>`);
  d.querySelectorAll('.wt-stop').forEach((b) => (b.onclick = () => { const st = getWorld().objs.find((x) => x.type === 'stop' && x.c === Number(b.dataset.c)); d.remove(); teleport(st.x, st.y + 1); }));
  d.querySelector('.wc-go').onclick = () => d.remove();
}
function teleport(x, y) {
  const p = wMe();
  let best = [x, y];
  if (blockedAt(x, y, p)) for (let r = 1; r < 6 && blockedAt(...best, p); r++) for (const [dx, dy] of [[0, r], [r, 0], [-r, 0], [0, -r]]) if (!blockedAt(x + dx, y + dy, p)) { best = [x + dx, y + dy]; break; }
  WG.layer.classList.add('fade'); setTimeout(() => WG.layer.classList.remove('fade'), 450);
  Object.assign(WG.pos, { x: best[0], y: best[1], fx: best[0], fy: best[1] }); WG.move = null; WG.path = [];
  enterRegion(regionAt(best[0], best[1]), p); savePos();
  if (typeof livePush === 'function') livePush(true);
}
function sideQuestHTML(p) {
  const qs = WREG.flatMap((R) => (R.npcs || []).filter((n) => n.side && p.sides[n.side.id]).map((n) => ({ n, R, q: p.sides[n.side.id] })));
  if (!qs.length) return '';
  return '<p class="small muted" style="margin:14px 0 6px;font-weight:800">Side quests</p>' + qs.map(({ n, R, q }) => {
    const ready = !q.done && (q.n || 0) >= n.side.n, set = SETS[n.side.set] || ['', ''];
    return `<div class="wm-ch${q.done ? ' done' : ' now'}"><span>${q.done ? '✅' : ready ? '❗' : set[0]}</span><div><b>${esc(n.name)} · ${esc(R.name)}</b><small>${q.done ? 'Done — thanks, Ranger!' : ready ? `You did it! Go tell ${esc(n.name.split(' · ')[0])} 🎉` : `Catch ${n.side.n} ${esc(set[1])} (${q.n || 0}/${n.side.n})`}</small></div></div>`;
  }).join('');
}
function openMenu(tab = 'quests') {
  const p = wMe();
  const d = wEl('wmenu', `<div class="wm-in"><div class="wm-tabs">${[['quests', '📜', 'Story'], ['map', '🗺️', 'Map'], ['guide', '📖', 'Guide'], ['team', '👨‍👩‍👧', 'Team']].map(([k, e, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}"><span>${e}</span>${l}</button>`).join('')}</div><div class="wm-body"></div><button class="btn block wm-close">Back to the adventure</button></div>`);
  const body = d.querySelector('.wm-body');
  const show = (t) => {
    d.querySelectorAll('.wm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'quests') body.innerHTML = `<div class="wm-stars">${WREG.map((R) => `<i class="${chDone(p, R.ch) ? 'on' : ''}">★</i>`).join('')}</div>` + WREG.map((R) => {
      const done = chDone(p, R.ch), now = p.ch === R.ch;
      return `<div class="wm-ch${done ? ' done' : now ? ' now' : ' locked'}"><span>${done ? '⭐' : now ? R.emoji : '🔒'}</span><div><b>Chapter ${R.ch} · ${done || now ? esc(R.title) : '???'}</b><small>${done ? esc(STORY_RECAP[R.ch] || 'Star found!') : now ? esc(goalText(p)) : 'Not yet'}</small></div></div>`;
    }).join('') + sideQuestHTML(p);
    else if (t === 'map') {
      body.innerHTML = '<canvas class="wm-map"></canvas><p class="small muted">🩷 you · 🟢 family · 🟡 next goal · 🔒 not yet</p>';
      const c = body.querySelector('canvas'), k = 3, w = getWorld(); c.width = MW * k; c.height = MH * k; const g = c.getContext('2d');
      const col = { [T.WATER]: '#4fb3e8', [T.TREE]: '#2f7d3c', [T.PINE]: '#2f6f5f', [T.PALM]: '#4fae5a', [T.DEAD]: '#3d2f52', [T.PATH]: '#e8d6a8', [T.CHECK]: '#ffd6e7', [T.SAND]: '#f6e6b8', [T.SNOW]: '#eef6fb', [T.ICE]: '#bfe6ff', [T.VOID]: '#c9e4fb', [T.CLOUD]: '#ffffff', [T.ROCK]: '#a3a3a3', [T.TALL]: '#4f9e3a', [T.BRIDGE]: '#c8955a', [T.FENCE]: '#c8955a', [T.CROP]: '#e8c35a', [T.GRAVE]: '#9aa0b0' };
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const r = regionAt(x, y); const t = w.at(x, y); g.fillStyle = col[t] || WREG[r].pal.g1; g.fillRect(x * k, y * k, k, k); }
      WREG.forEach((R, r) => { if (!p.visited[r] && !chDone(p, R.ch) && p.ch !== R.ch) { g.fillStyle = 'rgba(30,30,40,.72)'; g.fillRect(REG_POS[r][0] * RW * k, REG_POS[r][1] * RH * k, RW * k, RH * k); g.font = `${RH * k * 0.3}px system-ui`; g.textAlign = 'center'; g.fillText('🔒', (REG_POS[r][0] + 0.5) * RW * k, (REG_POS[r][1] + 0.62) * RH * k); } });
      for (const o of Object.values(WG.others)) { g.fillStyle = '#2f8a5b'; g.beginPath(); g.arc(o.x * k, o.y * k, 5, 0, 7); g.fill(); }
      g.textAlign = 'center'; g.font = '22px system-ui';
      WREG.forEach((R, r) => { if (p.visited[r] || chDone(p, R.ch) || p.ch === R.ch) g.fillText(R.emoji, (REG_POS[r][0] + 0.5) * RW * k, (REG_POS[r][1] + 0.5) * RH * k + 8); });
      const tg = stepTarget(p); if (tg) { g.fillStyle = '#ffd43b'; g.strokeStyle = '#3a2b3d'; g.lineWidth = 2; g.beginPath(); g.arc(tg[0] * k, tg[1] * k, 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#3a2b3d'; g.font = '900 13px system-ui'; g.fillText('!', tg[0] * k, tg[1] * k + 5); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(WG.pos.x * k, WG.pos.y * k, 9, 0, 7); g.fill(); g.fillStyle = '#e64980'; g.beginPath(); g.arc(WG.pos.x * k, WG.pos.y * k, 6, 0, 7); g.fill();
    } else if (t === 'guide') body.innerHTML = WREG.map((R, r) => {
      const pool = wildPool(r).filter((s) => s.r !== 'M');
      const got = pool.filter((s) => ownsSid(actor(), s.id)).length;
      return `<div class="wm-guide"><b>${R.emoji} ${esc(R.name)} <small>${got}/${pool.length}</small></b><div class="wm-sqs">${pool.map((s) => `<span class="${ownsSid(actor(), s.id) ? 'got' : p.guide[s.id] ? 'seen' : ''}" title="${esc(s.name)}">${ownsSid(actor(), s.id) || p.guide[s.id] ? squishySVG(s.id, { cls: ownsSid(actor(), s.id) ? '' : 'shadow' }) : '❔'}</span>`).join('')}</div></div>`;
    }).join('');
    else body.innerHTML = state.members.map((m) => {
      const q = state.world?.[m.id], live = WG.others[m.id], me = m.id === actor();
      const ch = q?.ch ? Math.min(8, q.ch) : 0, stars = q?.done?.length || 0;
      return `<div class="wm-team">${avatarSVG(avatarOf(m.id), { head: true })}<div><b>${esc(m.name)}${me ? ' (you)' : ''}</b><small>${q?.ch ? `⭐ ${stars}/8 · Chapter ${ch}` : 'Hasn’t started yet'}${live ? ` · <span class="live-dot"></span> here now` : ''}</small></div>${live && !me ? `<button class="btn secondary wm-join" data-id="${m.id}">Go to</button>` : ''}</div>`;
    }).join('') + '<p class="small muted" style="margin-top:10px">Play at the same time to see each other on the map. Catching near family gives a 🤝 teamwork bonus!</p>';
    body.querySelectorAll('.wm-join').forEach((b) => (b.onclick = () => { const o = WG.others[b.dataset.id]; if (!o) { toast('They just left Squishvale.'); return; } const r = regionAt(Math.round(o.x), Math.round(o.y)); const R = WREG[r]; if (!R || !(p.visited[r] || chDone(p, R.ch) || p.ch >= R.ch)) { toast('You haven’t reached that part of Squishvale yet!'); return; } d.remove(); teleport(Math.round(o.x) + 1, Math.round(o.y)); }));
  };
  d.querySelectorAll('.wm-tabs button').forEach((b) => (b.onclick = () => show(b.dataset.t)));
  d.querySelector('.wm-close').onclick = () => d.remove();
  d.addEventListener('click', (e) => { if (e.target === d) d.remove(); });
  show(tab);
}

/* =========================================================
   8 · HUD, mount, loop
   ========================================================= */
function updateHud() {
  const p = wMe(), L = WG.layer; if (!p || !L) return;
  const goal = L.querySelector('.wh-goal-t'); if (goal) goal.textContent = goalText(p);
  const b = L.querySelector('.wh-bub b'); if (b) b.textContent = p.bubbles || 0;
  const r = WG.region >= 0 ? WREG[WG.region] : null; const rn = L.querySelector('.wh-region'); if (rn && r) rn.textContent = `${r.emoji} ${r.name}`;
  const st = L.querySelector('.wh-stars'); if (st) st.textContent = `⭐ ${p.done.length}/8`;
  const ice = L.querySelector('.wh-ice'); if (ice) ice.hidden = !(r && r.key === 'frost' && getWorld().at(WG.pos.x, WG.pos.y) === T.ICE || (r && r.key === 'frost' && WG.pos && WG.pos.x - REG_POS[7][0] * RW >= 8 && WG.pos.x - REG_POS[7][0] * RW <= 26 && WG.pos.y - REG_POS[7][1] * RH >= 6 && WG.pos.y - REG_POS[7][1] * RH <= 22));
}
function arrowUpdate() {
  const p = wMe(), el = WG.layer?.querySelector('.wh-arrow'); if (!el || !p) return;
  const t = stepTarget(p);
  if (!t) { el.hidden = true; return; }
  const dx = t[0] - WG.pos.fx, dy = t[1] - WG.pos.fy, dist = Math.hypot(dx, dy);
  el.hidden = dist < 2;
  el.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
}
// Thumb stick: press anywhere on it and drag. The way you push decides the direction; a quick flick = one step.
function stickInit(el) {
  const knob = el.querySelector('.wh-knob');
  let id = null, cx = 0, cy = 0, rad = 1, dir = null;
  const setKnob = (x, y) => { knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`; };
  const move = (e) => {
    const dx = e.clientX - cx, dy = e.clientY - cy, dist = Math.hypot(dx, dy), max = rad * 0.55, k = dist > max ? max / dist : 1;
    setKnob(dx * k, dy * k);
    let d = null;
    if (dist > rad * 0.2) {
      // 8 directions: each gets a 45° slice; stay in the current one until you're clearly past its edge (no flicker)
      const ang = Math.atan2(dy, dx), SECT = ['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];
      d = SECT[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
      if (dir && d !== dir) { const i = SECT.indexOf(dir), diff = Math.abs(((ang - i * Math.PI / 4) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (diff < Math.PI / 8 + 0.14) d = dir; }
      WG.lastAxis = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
    }
    el.classList.toggle('on', !!d);
    if (d === dir) return;
    const first = !dir; dir = d;
    if (!d) { WG.hold = null; return; }
    WG.path = []; WG.pendingTalk = null; WG.hold = d; WG.holdAt = first ? performance.now() : 0;
    if (!tryStep(d) && WG.move) WG.queue = d; // mid-step: take this step as soon as the current one ends
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null; dir = null; el.classList.remove('on', 'held'); knob.style.transition = 'transform .15s'; setKnob(0, 0);
    WG.hold = null;
  };
  el.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    e.preventDefault(); id = e.pointerId; el.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; rad = r.width / 2;
    knob.style.transition = 'none'; el.classList.add('held'); move(e);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
}
function hudHTML() {
  return `<canvas class="wcv"></canvas>
    <div class="wh-top"><button class="wh-x" aria-label="Leave Squishvale">✕</button><div class="wh-goal"><span class="wh-arrow">⬆&#xFE0E;</span><span class="wh-goal-t"></span></div><button class="wh-menu" aria-label="Menu">☰</button></div>
    <div class="wh-sub"><span class="wh-region"></span><span class="wh-stars"></span><span class="wh-bub">🫧 <b>0</b></span></div>
    <div class="wh-pad wh-stick" aria-label="Move: drag the stick"><i class="ws-hint up"></i><i class="ws-hint down"></i><i class="ws-hint left"></i><i class="ws-hint right"></i><div class="wh-knob"></div></div>
    <div class="wh-act"><button class="wh-emo" aria-label="Wave">👋</button><button class="wh-ice" aria-label="Restart the ice" hidden>↩️</button><button class="wh-a" aria-label="Talk / interact">A</button></div>`;
}
function mount() {
  const me = actor();
  let L = document.getElementById('worldLayer');
  if (!L) {
    L = document.createElement('div'); L.id = 'worldLayer'; L.innerHTML = hudHTML(); document.body.appendChild(L);
    WG.layer = L; WG.cv = L.querySelector('.wcv'); WG.ctx = WG.cv.getContext('2d');
    WG.cv.addEventListener('pointerdown', (e) => { if (e.target === WG.cv) onTap(e); });
    L.querySelector('.wh-x').onclick = () => { savePos(); if (history.length > 1) history.back(); else go('play'); };
    L.querySelector('.wh-menu').onclick = () => { if (!WG.busy) openMenu(); };
    L.querySelector('.wh-goal').onclick = () => { if (!WG.busy) openMenu('quests'); };
    L.querySelector('.wh-a').onclick = pressA;
    L.querySelector('.wh-emo').onclick = () => { const list = ['👋', '❤️', '😂', '🎉', '🫧']; const i = (list.indexOf(WG.emote?.e) + 1) % list.length; WG.emote = { e: Date.now() - (WG.emote?.at || 0) < 3500 ? list[i] : '👋', at: Date.now() }; if (typeof livePush === 'function') livePush(true); };
    L.querySelector('.wh-ice').onclick = () => { const ice = WREG[7]._ice; if (ice) teleport(ice.g.entry[0] + 1, ice.g.entry[1]); };
    stickInit(L.querySelector('.wh-stick'));
    window.addEventListener('resize', () => { if (WG.layer && !WG.layer.hidden) resize(); });
  }
  WG.layer = L; L.hidden = false;
  document.body.classList.add('world-mode');
  if (!me) { L.hidden = true; document.body.classList.remove('world-mode'); return; }
  const p = wMe();
  if (!WG.pos || WG.posFor !== me) {
    if (WG.pos && WG.posFor && isMember(WG.posFor)) wposMap()[WG.posFor] = { x: WG.pos.x, y: WG.pos.y, d: WG.pos.d }; // switched person: remember where the last one stood
    WG.posFor = me; WG.others = {}; WG.move = null; WG.path = []; WG.pendingTalk = null; WG.hold = null;
    const sp = wposMap()[me], ok = (v, max) => Number.isInteger(v) && v >= 0 && v < max, sx0 = ok(sp?.x, MW) && ok(sp?.y, MH) ? sp.x : p.x, sy0 = ok(sp?.x, MW) && ok(sp?.y, MH) ? sp.y : p.y;
    WG.pos = { x: sx0, y: sy0, fx: sx0, fy: sy0, d: sp?.d || p.d || 'down' };
    const bx = WG.pos.x, by = WG.pos.y;
    if (blockedAt(bx, by, p)) { let f = null; for (let rr = 1; rr < 8 && !f; rr++) for (let dy = -rr; dy <= rr && !f; dy++) for (let dx = -rr; dx <= rr; dx++) if (!blockedAt(bx + dx, by + dy, p)) { f = [bx + dx, by + dy]; break; } const [sx, sy] = f || WREG[0].start; Object.assign(WG.pos, { x: sx, y: sy, fx: sx, fy: sy }); }
    WG.region = -1; WG.roamers = [];
  }
  resize();
  if (WG.region < 0) enterRegion(regionAt(WG.pos.x, WG.pos.y), p);
  updateHud();
  if (!WG.raf) { let last = performance.now(); const loop = (t) => { WG.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; try { syncOthers(); update(dt); draw(); arrowUpdate(); if (t - (WG.readyT || 0) > 200) { WG.readyT = t; WG.layer.querySelector('.wh-a')?.classList.toggle('ready', !WG.busy && !WG.move && !!frontObj()); } } catch (e) { console.error(e); } }; WG.raf = requestAnimationFrame(loop); }
  if (!p.intro) { p.intro = true; save(); setTimeout(() => introSlides().then(() => { if (WG.region >= 0 && !WG.layer.hidden) titleCard(WREG[WG.region]); }), 300); }
}
function unmount() {
  if (!WG.layer || WG.layer.hidden) return;
  savePos();
  WG.layer.hidden = true; document.body.classList.remove('world-mode');
  cancelAnimationFrame(WG.raf); WG.raf = 0; WG.hold = null; WG.queue = null; WG.path = [];
  WG.layer.querySelectorAll('.wdlg, .wenc, .wgame, .wcard, .wmenu').forEach((x) => x.remove()); WG.lockN = 0; WG.epoch++;
}
function syncOthers() {
  if (typeof Live === 'undefined') return;
  const me = actor(), seen = {};
  for (const [id, v] of Object.entries(Live.all || {})) {
    if (id === me || !isMember(id) || !v || !v.w || Date.now() - (v.at || 0) > 90000) continue;
    seen[id] = 1;
    const o = (WG.others[id] ||= { fx: v.w.x, fy: v.w.y });
    Object.assign(o, { x: v.w.x, y: v.w.y, d: v.w.d, e: v.w.e, et: v.w.et });
  }
  for (const id of Object.keys(WG.others)) if (!seen[id]) delete WG.others[id];
}
// Where I am on the map, for live.js
function worldLive() {
  if (!WG.pos || !WG.layer || WG.layer.hidden) return null;
  return { x: WG.pos.x, y: WG.pos.y, d: WG.pos.d, ...(WG.emote && Date.now() - WG.emote.at < 3500 ? { e: WG.emote.e, et: WG.emote.at } : {}) };
}
// Two arrow keys at once walk diagonally
const WKEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
WG.keys = new Set();
function keyDir() {
  const K = WG.keys, v = K.has('up') && !K.has('down') ? 'up' : K.has('down') && !K.has('up') ? 'down' : '', h = K.has('left') && !K.has('right') ? 'left' : K.has('right') && !K.has('left') ? 'right' : '';
  return v && h ? v + h : v || h || null;
}
document.addEventListener('keydown', (e) => {
  if (!WG.layer || WG.layer.hidden || e.target.closest?.('input, textarea')) return;
  const k = WKEYS[e.key];
  if (k) { e.preventDefault(); if (e.repeat) return; WG.keys.add(k); WG.lastAxis = k === 'up' || k === 'down' ? 'v' : 'h'; const d = keyDir(); if (!d) return; WG.path = []; WG.hold = d; WG.holdAt = performance.now(); if (!tryStep(d) && WG.move) WG.queue = d; }
  else if (e.key === ' ' || e.key === 'Enter') { if (e.repeat) return; if (e.target.closest?.('.wcard button, .wmenu button, .wgame button, .wenc button')) return; e.preventDefault(); const top = WG.layer.querySelector('.wdlg'); if (top) top.click(); else pressA(); }
  else if (e.key === 'm' && !WG.busy) openMenu();
});
document.addEventListener('keyup', (e) => { const k = WKEYS[e.key]; if (!k) return; WG.keys.delete(k); WG.hold = WG.keys.size ? keyDir() : null; });
window.addEventListener('blur', () => { WG.keys.clear(); WG.hold = null; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && WG.layer && !WG.layer.hidden) savePos(); });

/* ---------- App wiring ---------- */
views.world = () => (actor() ? '' : needMe() || '<div class="card empty">Pick who you are first.</div>');
Object.assign(TITLES, { world: WORLD_TITLE });
KID_ROUTES.push('world');
const _afterRenderWorld = afterRender;
afterRender = function () {
  _afterRenderWorld();
  if (currentRoute().name === 'world' && actor()) mount(); else unmount();
};
// Entry tiles: Play screen and kid homes
const _playView = views.play;
views.play = () => _playView().replace('<div class="launch">', `<div class="launch"><button class="tile tile-world" data-action="go" data-to="world" style="--t:#22b8cf"><span class="tile-e">🗺️</span><b>Squishvale</b><small>${wStatus(actor())}</small></button>`);
const _kidWorld = views.kid;
views.kid = () => _kidWorld().replace('<div class="launch', `<div class="launch-pre"></div><div class="launch`).replace('<div class="launch-pre"></div><div class="launch big">', '<div class="launch big"><button class="tile" data-action="go" data-to="world" style="--t:#22b8cf"><span class="tile-e">🗺️</span><b>Adventure</b><small>Squishvale</small></button>').replace('<div class="launch-pre"></div><div class="launch">', `<div class="launch"><button class="tile" data-action="go" data-to="world" style="--t:#22b8cf"><span class="tile-e">🗺️</span><b>Squishvale</b><small>${wStatus(kidModeId())}</small></button>`);
function wStatus(id) { const q = id && state.world?.[id]; return q?.ch ? (q.ch > 8 ? '⭐ 8/8 · Free roam' : `⭐ ${q.done?.length || 0}/8 · Ch. ${q.ch}`) : 'New adventure!'; }
if (typeof PG_SKIP !== 'undefined') PG_SKIP.add('world');

// The Star Ranger: an Ultimate for finishing all 8 chapters
if (typeof ULTS !== 'undefined' && !SQ.u_ranger) {
  const s = { id: 'u_ranger', sp: 'star', name: 'Star Ranger', c1: '#ffd43b', c2: '#ff9de2', r: 'U', fx: 'rainbow', set: 'ult', kind: 'squishy', acc: 'crown', unlock: 'story8' };
  SQUISHIES.push(s); SQ.u_ranger = s;
  ULTS.story8 = { how: 'Win back all 8 Squish Stars in Squishvale', icon: '🗺️', prog: (id) => (state.world?.[id]?.done || []).length, goal: 8 };
  if (typeof ULT_GO !== 'undefined') { ULT_GO.story8 = 'world'; ULT_DO.story8 = 'Play Squishvale'; }
}

// Test hooks
window.WorldDebug = { WG, getWorld, wMe, iceSolve, teleport: (x, y) => teleport(x, y), interact, encounter, miniGame, objById, stepTarget, tryStep, blockedAt, pathTo, regionAt, MW, MH, RW, RH, REG_POS, T, completeChapter };
// sync.js drew the first screen before this file registered the world route: draw it again if we opened on #world.
if (currentRoute().name === 'world') render();
