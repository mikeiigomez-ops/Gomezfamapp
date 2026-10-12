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
  state.world ||= {};
  const p = (state.world[me] ||= {});
  if (!p.ch) {
    const [sx, sy] = WREG[0].start;
    Object.assign(p, { x: sx, y: sy, d: 'down', ch: 1, step: 0, cnt: 0, flags: {}, items: {}, bubbles: 5, bDay: today(), visited: {}, done: [], guide: {}, sides: {}, intro: false });
  }
  p.flags ||= {}; p.items ||= {}; p.visited ||= {}; p.done ||= []; p.guide ||= {}; p.sides ||= {};
  if (p.bDay !== today()) { p.bubbles = (p.bubbles || 0) + 5; p.bDay = today(); }
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
function drawTile(g, t, x, y, s, R) {
  const P = R.pal, h = hash2(x, y), X = 0, Y = 0;
  // Soft, blotchy ground variation (by 3×3 patches, not per tile) so there's no checkerboard
  const patch = hash2(Math.floor((x + 1) / 3), Math.floor((y + 2) / 3));
  const ground = R.ground === 'SAND' || R.ground === 'SNOW' ? P.g1 : patch < 0.62 ? P.g1 : P.g2;
  const base = (c) => { g.fillStyle = c; g.fillRect(X, Y, s, s); };
  const dots = (c, n, r) => { g.fillStyle = c; for (let i = 0; i < n; i++) { const a = hash2(x * 13 + i, y * 7 - i), b = hash2(x * 5 - i, y * 11 + i); g.beginPath(); g.arc(X + a * s, Y + b * s, r * s, 0, 7); g.fill(); } };
  const tuft = (c) => { g.strokeStyle = c; g.lineWidth = s * 0.05; g.lineCap = 'round'; for (let i = 0; i < 2; i++) { const a = hash2(x * 3 + i, y * 9) * 0.8 + 0.1, b = hash2(x * 7, y * 3 + i) * 0.7 + 0.25; g.beginPath(); g.moveTo(X + a * s, Y + b * s); g.lineTo(X + a * s - s * 0.06, Y + b * s - s * 0.14); g.moveTo(X + a * s, Y + b * s); g.lineTo(X + a * s + s * 0.06, Y + b * s - s * 0.14); g.stroke(); } };
  if (t === T.WATER || t === T.VOID) {
    if (t === T.WATER) { base(P.water); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(X, Y + s * 0.7, s, s * 0.3); }
    else { const gr = g.createLinearGradient(0, Y, 0, Y + s); gr.addColorStop(0, '#b5dcfb'); gr.addColorStop(1, '#d9ecff'); g.fillStyle = gr; g.fillRect(X, Y, s, s); if (h < 0.25) { g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(X + s * 0.5, Y + s * 0.5, s * 0.35, s * 0.12, 0, 0, 7); g.fill(); } }
    return;
  }
  if (t === T.SAND) { base(P.g1 === '#f6e6b8' ? P.g1 : '#f6e6b8'); dots('rgba(180,140,80,.25)', 3, 0.025); return; }
  if (t === T.SNOW) { base(ground); dots('rgba(150,190,220,.35)', 2, 0.03); return; }
  if (t === T.ICE) { base('#bfe6ff'); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(X + s * 0.15, Y + s * (0.3 + h * 0.3)); g.lineTo(X + s * 0.45, Y + s * (0.1 + h * 0.3)); g.stroke(); g.strokeStyle = 'rgba(120,180,220,.35)'; g.strokeRect(X + 0.5, Y + 0.5, s - 1, s - 1); return; }
  if (t === T.CHECK) { base((x + y) % 2 ? '#fff4f8' : '#ffd6e7'); return; }
  if (t === T.PLANK || t === T.BRIDGE) {
    if (t === T.BRIDGE) base(P.water);
    g.fillStyle = '#c8955a'; g.fillRect(X + s * 0.08, Y, s * 0.84, s);
    g.strokeStyle = '#9c6b3a'; g.lineWidth = s * 0.04; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(X + s * 0.08, Y + (i * s) / 4); g.lineTo(X + s * 0.92, Y + (i * s) / 4); g.stroke(); }
    return;
  }
  if (t === T.CLOUD) { const gr = g.createLinearGradient(0, Y, 0, Y + s); gr.addColorStop(0, '#b5dcfb'); gr.addColorStop(1, '#d9ecff'); g.fillStyle = gr; g.fillRect(X, Y, s, s); return; }
  base(t === T.PATH ? (h < 0.5 ? P.path : P.path2) : ground);
  if (t === T.PATH) { dots('rgba(120,90,50,.18)', 2, 0.03); return; }
  if (R.ground === 'SAND' && t !== T.TALL) dots('rgba(180,140,80,.22)', 3, 0.025);
  else if (R.ground !== 'SNOW') tuft(R.key === 'hollow' ? 'rgba(255,255,255,.08)' : 'rgba(0,60,0,.12)');
  if (t === T.TALL) {
    g.fillStyle = P.tall;
    for (let i = 0; i < 3; i++) {
      const bx = X + s * (0.1 + i * 0.3), by = Y + s * (0.55 + (i % 2) * 0.35);
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + s * 0.08, by - s * 0.5, bx + s * 0.16, by - s * 0.55); g.quadraticCurveTo(bx + s * 0.12, by - s * 0.2, bx + s * 0.26, by); g.closePath(); g.fill();
    }
    g.fillStyle = P.tall2;
    for (let i = 0; i < 2; i++) { const bx = X + s * (0.22 + i * 0.4), by = Y + s * (0.98 - i * 0.4); g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + s * 0.05, by - s * 0.45, bx + s * 0.14, by - s * 0.5); g.quadraticCurveTo(bx + s * 0.1, by - s * 0.2, bx + s * 0.22, by); g.closePath(); g.fill(); }
    return;
  }
  if (t === T.FLOWER) { const cs = P.flower; for (let i = 0; i < 3; i++) { const a = hash2(x + i * 9, y), b = hash2(x, y + i * 5); g.fillStyle = cs[Math.floor(hash2(x * i + 1, y) * cs.length)]; g.beginPath(); g.arc(X + (0.15 + a * 0.7) * s, Y + (0.2 + b * 0.65) * s, s * 0.07, 0, 7); g.fill(); g.fillStyle = '#ffe066'; g.beginPath(); g.arc(X + (0.15 + a * 0.7) * s, Y + (0.2 + b * 0.65) * s, s * 0.025, 0, 7); g.fill(); } return; }
  if (t === T.TREE || t === T.PINE || t === T.PALM || t === T.DEAD) {
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(X + s * 0.5, Y + s * 0.88, s * 0.36, s * 0.1, 0, 0, 7); g.fill();
    if (t === T.PINE) { g.fillStyle = '#6b4a2b'; g.fillRect(X + s * 0.44, Y + s * 0.7, s * 0.12, s * 0.2); for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? P.leaf2 : P.leaf; g.beginPath(); g.moveTo(X + s * 0.5, Y + s * (0.02 + i * 0.2)); g.lineTo(X + s * (0.14 - i * 0.03), Y + s * (0.42 + i * 0.16)); g.lineTo(X + s * (0.86 + i * 0.03), Y + s * (0.42 + i * 0.16)); g.closePath(); g.fill(); } if (R.ground === 'SNOW') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(X + s * 0.5, Y + s * 0.02); g.lineTo(X + s * 0.38, Y + s * 0.2); g.lineTo(X + s * 0.62, Y + s * 0.2); g.fill(); } return; }
    if (t === T.PALM) { g.strokeStyle = '#a0703c'; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(X + s * 0.5, Y + s * 0.9); g.quadraticCurveTo(X + s * 0.42, Y + s * 0.5, X + s * 0.55, Y + s * 0.25); g.stroke(); g.fillStyle = P.leaf; for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) { g.beginPath(); g.ellipse(X + s * 0.55 + Math.cos(a) * s * 0.22, Y + s * 0.25 + Math.sin(a) * s * 0.12, s * 0.24, s * 0.07, a, 0, 7); g.fill(); } return; }
    if (t === T.DEAD) { g.strokeStyle = '#2a2238'; g.lineWidth = s * 0.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(X + s * 0.5, Y + s * 0.9); g.lineTo(X + s * 0.5, Y + s * 0.3); g.moveTo(X + s * 0.5, Y + s * 0.5); g.lineTo(X + s * 0.25, Y + s * 0.25); g.moveTo(X + s * 0.5, Y + s * 0.42); g.lineTo(X + s * 0.78, Y + s * 0.18); g.moveTo(X + s * 0.5, Y + s * 0.3); g.lineTo(X + s * 0.4, Y + s * 0.08); g.stroke(); return; }
    g.fillStyle = '#7a5230'; g.fillRect(X + s * 0.42, Y + s * 0.6, s * 0.16, s * 0.28);
    g.fillStyle = P.leaf; g.beginPath(); g.arc(X + s * 0.5, Y + s * 0.42, s * 0.36, 0, 7); g.fill();
    g.fillStyle = P.leaf2; g.beginPath(); g.arc(X + s * 0.4, Y + s * 0.34, s * 0.18, 0, 7); g.fill();
    if (R.key === 'woods' && h < 0.3) { g.fillStyle = '#ff6b9d'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(X + s * (0.3 + i * 0.18), Y + s * (0.45 - (i % 2) * 0.12), s * 0.04, 0, 7); g.fill(); } }
    return;
  }
  if (t === T.ROCK) { g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(X + s * 0.5, Y + s * 0.85, s * 0.36, s * 0.1, 0, 0, 7); g.fill(); g.fillStyle = R.key === 'frost' ? '#9aa9b8' : '#a3a3a3'; g.beginPath(); g.ellipse(X + s * 0.5, Y + s * 0.6, s * 0.38, s * 0.3, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(X + s * 0.4, Y + s * 0.5, s * 0.14, s * 0.08, -0.4, 0, 7); g.fill(); return; }
  if (t === T.FENCE) { g.fillStyle = R.key === 'hollow' ? '#2a2238' : '#c8955a'; g.fillRect(X + s * 0.42, Y + s * 0.25, s * 0.16, s * 0.65); g.fillRect(X, Y + s * 0.38, s, s * 0.1); g.fillRect(X, Y + s * 0.62, s, s * 0.1); return; }
  if (t === T.CROP) { g.fillStyle = '#b07a43'; g.fillRect(X, Y + s * 0.6, s, s * 0.4); for (let i = 0; i < 3; i++) { g.fillStyle = '#e8c35a'; g.beginPath(); g.ellipse(X + s * (0.2 + i * 0.3), Y + s * 0.4, s * 0.08, s * 0.28, 0, 0, 7); g.fill(); } return; }
  if (t === T.GRAVE) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X + s * 0.2, Y + s * 0.82, s * 0.6, s * 0.08); g.fillStyle = '#9aa0b0'; g.beginPath(); g.moveTo(X + s * 0.25, Y + s * 0.85); g.lineTo(X + s * 0.25, Y + s * 0.35); g.arc(X + s * 0.5, Y + s * 0.35, s * 0.25, Math.PI, 0); g.lineTo(X + s * 0.75, Y + s * 0.85); g.fill(); g.fillStyle = '#7a8090'; g.fillRect(X + s * 0.45, Y + s * 0.42, s * 0.1, s * 0.25); g.fillRect(X + s * 0.37, Y + s * 0.5, s * 0.26, s * 0.08); }
}
function chunk(cx, cy) {
  const key = cx + ',' + cy + ',' + WG.ts + ',' + WG.dpr;
  let c = WG.chunks.get(key);
  if (c) { WG.chunks.delete(key); WG.chunks.set(key, c); return c; }
  const s = WG.ts * WG.dpr, w = getWorld();
  c = document.createElement('canvas'); c.width = c.height = CH * s;
  const g = c.getContext('2d');
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const tx = cx * CH + x, ty = cy * CH + y;
    if (tx >= MW || ty >= MH) continue;
    const r = regionAt(tx, ty);
    g.save(); g.translate(x * s, y * s); drawTile(g, w.at(tx, ty), tx, ty, s, WREG[r] || WREG[0]); g.restore();
  }
  WG.chunks.set(key, c);
  if (WG.chunks.size > 12) { const k = WG.chunks.keys().next().value; const old = WG.chunks.get(k); old.width = old.height = 0; WG.chunks.delete(k); }
  return c;
}

const BLD = {
  lab: ['#e7f5ff', '#4dabf7'], hall: ['#fff3bf', '#e8590c'], mart: ['#e3fafc', '#22b8cf'], house: ['#fff0f6', '#e64980'], lighthouse: ['#fff', '#e03131'], bakery: ['#fff0f6', '#f783ac'],
  barn: ['#c92a2a', '#7a1f1f'], bigtent: ['#fff', '#e64980'], booth: ['#fff', '#ff6b6b'], observatory: ['#f1f3f5', '#5c7cfa'], manor: ['#5f3dc4', '#2b1b5a'], castle: ['#ced4da', '#495057'],
};
function drawBuilding(g, o, sx, sy, s) {
  const w = o.w * s, h = o.h * s, [wall, roof] = BLD[o.kind] || BLD.house, col = o.color || roof;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(sx + w / 2, sy + h, w * 0.52, s * 0.25, 0, 0, 7); g.fill();
  if (o.kind === 'ferris') {
    const cx = sx + w / 2, cy = sy + h * 0.45, r = Math.min(w, h) * 0.42, t = performance.now() / 4000;
    g.strokeStyle = '#868e96'; g.lineWidth = s * 0.15; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - r * 0.6, sy + h); g.moveTo(cx, cy); g.lineTo(cx + r * 0.6, sy + h); g.stroke();
    g.strokeStyle = '#f783ac'; g.lineWidth = s * 0.12; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    for (let i = 0; i < 8; i++) { const a = t + (i * Math.PI) / 4; g.strokeStyle = '#ffd43b'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); g.fillStyle = ['#4dabf7', '#ff6b6b', '#51cf66', '#845ef7'][i % 4]; g.fillRect(cx + Math.cos(a) * r - s * 0.25, cy + Math.sin(a) * r, s * 0.5, s * 0.4); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, s * 0.2, 0, 7); g.fill();
    return;
  }
  if (o.kind === 'bigtent' || o.kind === 'booth') {
    const stripes = o.kind === 'bigtent' ? 8 : 4;
    for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? '#fff' : col; g.beginPath(); g.moveTo(sx + (w * i) / stripes, sy + h); g.lineTo(sx + w / 2, sy + (o.kind === 'bigtent' ? 0 : h * 0.15)); g.lineTo(sx + (w * (i + 1)) / stripes, sy + h); g.fill(); }
    g.fillStyle = '#2b1b3d'; g.beginPath(); g.moveTo(sx + w / 2 - s * 0.5, sy + h); g.lineTo(sx + w / 2, sy + h - s * 1.2); g.lineTo(sx + w / 2 + s * 0.5, sy + h); g.fill();
    if (o.kind === 'bigtent') { g.fillStyle = '#ffd43b'; g.beginPath(); g.moveTo(sx + w / 2, sy - s * 0.5); g.lineTo(sx + w / 2 + s * 0.5, sy - s * 0.25); g.lineTo(sx + w / 2, sy); g.fill(); }
  } else if (o.kind === 'lighthouse') {
    const lit = WG.litLighthouse;
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(sx + w * 0.22, sy + h); g.lineTo(sx + w * 0.32, sy - s * 0.6); g.lineTo(sx + w * 0.68, sy - s * 0.6); g.lineTo(sx + w * 0.78, sy + h); g.fill();
    g.fillStyle = '#e03131'; for (let i = 0; i < 3; i++) g.fillRect(sx + w * 0.26, sy + (i * h) / 3 - s * 0.1, w * 0.48, s * 0.3);
    g.fillStyle = lit ? '#ffe066' : '#495057'; g.fillRect(sx + w * 0.35, sy - s * 1.1, w * 0.3, s * 0.5);
    g.fillStyle = '#e03131'; g.beginPath(); g.moveTo(sx + w * 0.3, sy - s * 1.1); g.lineTo(sx + w / 2, sy - s * 1.6); g.lineTo(sx + w * 0.7, sy - s * 1.1); g.fill();
    if (lit) { g.fillStyle = 'rgba(255,224,102,.25)'; g.beginPath(); g.moveTo(sx + w / 2, sy - s * 0.85); const a = performance.now() / 900; g.lineTo(sx + w / 2 + Math.cos(a) * s * 6, sy - s * 0.85 + Math.sin(a) * s * 2 - s); g.lineTo(sx + w / 2 + Math.cos(a + 0.25) * s * 6, sy - s * 0.85 + Math.sin(a + 0.25) * s * 2 + s); g.fill(); }
  } else if (o.kind === 'castle') {
    g.fillStyle = wall; g.fillRect(sx, sy + s, w, h - s);
    for (const tx of [0, w - s * 1.4]) { g.fillStyle = '#adb5bd'; g.fillRect(sx + tx, sy - s * 0.6, s * 1.4, h + s * 0.6); g.fillStyle = '#7048e8'; g.beginPath(); g.moveTo(sx + tx - s * 0.1, sy - s * 0.6); g.lineTo(sx + tx + s * 0.7, sy - s * 1.8); g.lineTo(sx + tx + s * 1.5, sy - s * 0.6); g.fill(); }
    g.fillStyle = '#adb5bd'; for (let i = 0; i < 4; i++) g.fillRect(sx + s * 1.6 + i * s * 0.8, sy + s * 0.5, s * 0.5, s * 0.5);
    g.fillStyle = '#ffd43b'; g.fillRect(sx + w / 2 - s * 0.05, sy - s * 1.2, s * 0.08, s * 1.4); g.fillStyle = '#c2a073'; g.beginPath(); g.arc(sx + w / 2 + s * 0.3, sy - s * 1, s * 0.3, 0, 7); g.fill();
    g.fillStyle = '#5c3a21'; g.beginPath(); g.moveTo(sx + w / 2 - s * 0.7, sy + h); g.lineTo(sx + w / 2 - s * 0.7, sy + h - s * 1.2); g.arc(sx + w / 2, sy + h - s * 1.2, s * 0.7, Math.PI, 0); g.lineTo(sx + w / 2 + s * 0.7, sy + h); g.fill();
    g.fillStyle = '#fff3bf'; for (const tx of [s * 0.45, w - s * 0.95]) g.fillRect(sx + tx, sy + s * 0.8, s * 0.5, s * 0.6);
  } else if (o.kind === 'observatory') {
    g.fillStyle = wall; g.fillRect(sx, sy + h * 0.4, w, h * 0.6);
    g.fillStyle = '#dee2e6'; g.beginPath(); g.arc(sx + w / 2, sy + h * 0.45, w * 0.42, Math.PI, 0); g.fill();
    g.fillStyle = '#5c7cfa'; g.save(); g.translate(sx + w / 2, sy + h * 0.2); g.rotate(-0.5); g.fillRect(-s * 0.2, -s * 1.1, s * 0.4, s * 1.4); g.restore();
    g.fillStyle = '#495057'; g.fillRect(sx + w / 2 - s * 0.45, sy + h - s * 1.1, s * 0.9, s * 1.1);
  } else {
    const roofH = o.kind === 'barn' ? h * 0.5 : h * 0.45;
    g.fillStyle = wall; g.fillRect(sx + s * 0.1, sy + roofH, w - s * 0.2, h - roofH);
    g.fillStyle = roof; g.beginPath();
    if (o.kind === 'barn') { g.moveTo(sx - s * 0.2, sy + roofH); g.lineTo(sx + s * 0.6, sy + s * 0.3); g.lineTo(sx + w / 2, sy - s * 0.3); g.lineTo(sx + w - s * 0.6, sy + s * 0.3); g.lineTo(sx + w + s * 0.2, sy + roofH); }
    else if (o.kind === 'manor') { g.moveTo(sx - s * 0.3, sy + roofH); g.lineTo(sx + w * 0.25, sy - s * 0.4); g.lineTo(sx + w * 0.5, sy + s * 0.2); g.lineTo(sx + w * 0.75, sy - s * 0.6); g.lineTo(sx + w + s * 0.3, sy + roofH); }
    else { g.moveTo(sx - s * 0.25, sy + roofH); g.lineTo(sx + w / 2, sy - s * 0.2); g.lineTo(sx + w + s * 0.25, sy + roofH); }
    g.fill();
    if (o.kind === 'barn') { g.strokeStyle = '#fff'; g.lineWidth = s * 0.12; g.strokeRect(sx + w / 2 - s * 1, sy + h - s * 1.8, s * 2, s * 1.8); g.beginPath(); g.moveTo(sx + w / 2 - s, sy + h - s * 1.8); g.lineTo(sx + w / 2 + s, sy + h); g.moveTo(sx + w / 2 + s, sy + h - s * 1.8); g.lineTo(sx + w / 2 - s, sy + h); g.stroke(); }
    else {
      g.fillStyle = o.kind === 'manor' ? '#1b1033' : '#8d5a33'; g.fillRect(sx + w / 2 - s * 0.38, sy + h - s * 1, s * 0.76, s * 1);
      g.fillStyle = o.kind === 'manor' ? '#ffd43b' : '#a5d8ff';
      for (const tx of [s * 0.5, w - s * 1.15]) { if (tx + s * 0.6 < w) { g.fillRect(sx + tx, sy + roofH + s * 0.35, s * 0.6, s * 0.5); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(sx + tx + s * 0.05, sy + roofH + s * 0.4, s * 0.2, s * 0.15); g.fillStyle = o.kind === 'manor' ? '#ffd43b' : '#a5d8ff'; } }
    }
    if (o.kind === 'lab') { g.fillStyle = '#adb5bd'; g.beginPath(); g.arc(sx + w - s * 0.9, sy + s * 0.1, s * 0.45, Math.PI * 0.9, Math.PI * 2.1); g.fill(); }
    if (o.kind === 'bakery') { g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(sx + w / 2, sy + roofH - s * 0.1, s * 0.35, 0, 7); g.fill(); g.fillStyle = '#ff8fab'; g.beginPath(); g.arc(sx + w / 2, sy + roofH - s * 0.25, s * 0.22, Math.PI, 0); g.fill(); }
  }
  if (o.label) { g.font = `800 ${Math.max(9, s * 0.32)}px system-ui`; g.textAlign = 'center'; const tw = g.measureText(o.label).width + s * 0.3; g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(sx + w / 2 - tw / 2, sy + h * 0.5 - s * 0.25, tw, s * 0.42); g.fillStyle = '#3a2b3d'; g.fillText(o.label, sx + w / 2, sy + h * 0.5 + s * 0.06); }
}
function drawBlocker(g, o, s, cam) {
  const xs = o.cells.map(([x]) => x), ys = o.cells.map(([, y]) => y);
  const sx = (Math.min(...xs) - cam.x) * s, sy = (Math.min(...ys) - cam.y) * s, w = (Math.max(...xs) - Math.min(...xs) + 1) * s, h = (Math.max(...ys) - Math.min(...ys) + 1) * s;
  const cx = sx + w / 2, cy = sy + h / 2, t = performance.now() / 1000;
  if (o.kind === 'puffball') { g.fillStyle = '#ffc9de'; g.beginPath(); g.ellipse(cx, cy + Math.sin(t * 2) * s * 0.05, Math.max(w, h) * 0.55, Math.min(w, h) * 0.7 + s * 0.4, 0, 0, 7); g.fill(); g.fillStyle = '#3a2b3d'; g.font = `${s * 0.6}px system-ui`; g.textAlign = 'center'; g.fillText('😴', cx, cy + s * 0.2); g.fillStyle = '#5c7cfa'; g.font = `800 ${s * 0.4}px system-ui`; g.fillText('z', cx + s * (0.9 + Math.sin(t) * 0.1), cy - s * (0.8 + (t % 1) * 0.4)); return; }
  if (o.kind === 'fog') { for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(sx + w * hash2(i, 3) + Math.sin(t + i) * s * 0.2, sy + h * hash2(i, 9), s * 0.8, 0, 7); g.fill(); } return; }
  const emoji = { log: '🪵', crumbs: '🍪', hay: '🌾', gate: '🚧', icewall: '🧊' }[o.kind] || '🚧';
  g.font = `${s * 0.9}px system-ui`; g.textAlign = 'center';
  for (const [x, y] of o.cells) g.fillText(emoji, (x - cam.x + 0.5) * s, (y - cam.y + 0.85) * s);
}

function resize() {
  const cv = WG.cv; if (!cv) return;
  const r = WG.layer.getBoundingClientRect();
  WG.dpr = Math.min(2, window.devicePixelRatio || 1);
  const want = Math.max(32, Math.min(58, Math.floor(Math.min(r.width / 11, r.height / 12))));
  if (want !== WG.ts) { WG.ts = want; for (const c of WG.chunks.values()) c.width = c.height = 0; WG.chunks.clear(); }
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
  g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, WG.vw, WG.vh);
  const x0 = Math.floor(cam.x / CH), y0 = Math.floor(cam.y / CH), x1 = Math.floor((cam.x + WG.vw / s) / CH), y1 = Math.floor((cam.y + WG.vh / s) / CH);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { if (cx * CH >= MW || cy * CH >= MH) continue; g.drawImage(chunk(cx, cy), (cx * CH - cam.x) * s, (cy * CH - cam.y) * s, CH * s, CH * s); }
  const now = performance.now() / 1000;
  // Water shimmer and cloud bridges
  const tx0 = Math.floor(cam.x), ty0 = Math.floor(cam.y), tx1 = Math.ceil(cam.x + WG.vw / s), ty1 = Math.ceil(cam.y + WG.vh / s);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const t = w.at(x, y);
    if (t === T.WATER) { const ph = (now * 0.8 + hash2(x, y) * 6) % 6; if (ph < 1.2) { g.strokeStyle = `rgba(255,255,255,${0.5 * Math.sin((ph / 1.2) * Math.PI)})`; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo((x - cam.x + 0.2) * s, (y - cam.y + 0.5) * s); g.quadraticCurveTo((x - cam.x + 0.5) * s, (y - cam.y + 0.38) * s, (x - cam.x + 0.8) * s, (y - cam.y + 0.5) * s); g.stroke(); } }
    else if (t === T.CLOUD) { const on = hasCloud(p); g.fillStyle = on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.28)'; const bx = (x - cam.x) * s, by = (y - cam.y) * s, bob = Math.sin(now * 1.5 + x) * s * 0.04; for (const [ox, oy, r] of [[0.3, 0.55, 0.3], [0.6, 0.45, 0.35], [0.8, 0.6, 0.25]]) { g.beginPath(); g.arc(bx + ox * s, by + oy * s + bob, r * s, 0, 7); g.fill(); } }
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
  const R = WREG[regionAt(Math.round(px), Math.round(py))] || WREG[0];
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
  for (const [mx, my, tg] of WG.marks) { g.fillStyle = tg ? '#ffd43b' : '#74c0fc'; g.beginPath(); g.arc(mx, my - s * 0.18, s * 0.32, 0, 7); g.fill(); g.strokeStyle = '#3a2b3d'; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#3a2b3d'; g.font = `900 ${s * 0.42}px system-ui`; g.textAlign = 'center'; g.fillText(tg ? '!' : '?', mx, my - s * 0.03); }
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
  g.fillStyle = '#ffd43b'; g.strokeStyle = '#3a2b3d'; g.lineWidth = 3; g.beginPath(); g.moveTo(24, 0); g.lineTo(-12, -18); g.lineTo(-4, 0); g.lineTo(-12, 18); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function drawPerson(g, a, x, y, d, s, cam, walking, name, emote, other) {
  const im = avImg(a); const H = s * 1.75, W = (H * 100) / 158, now = performance.now() / 1000;
  const bob = walking ? Math.abs(Math.sin(now * 12)) * s * 0.08 : Math.sin(now * 2) * s * 0.015;
  const X = (x - cam.x + 0.5) * s, Y = (y - cam.y + 1) * s - s * 0.08;
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(X, Y - s * 0.02, s * 0.32, s * 0.1, 0, 0, 7); g.fill();
  if (im) { g.save(); g.translate(X, Y - bob); if (d === 'left') g.scale(-1, 1); g.drawImage(im, -W / 2, -H, W, H); g.restore(); }
  // Standing in tall grass: the blades cover your feet
  const w = getWorld(), tx = Math.round(x), ty = Math.round(y);
  if (w.at(tx, ty) === T.TALL && !walking) { const R = WREG[regionAt(tx, ty)]; g.fillStyle = R.pal.tall; for (let i = 0; i < 4; i++) { const bx = X - s * 0.4 + i * s * 0.22; g.beginPath(); g.moveTo(bx, Y); g.quadraticCurveTo(bx + s * 0.06, Y - s * 0.35, bx + s * 0.12, Y - s * 0.42); g.quadraticCurveTo(bx + s * 0.1, Y - s * 0.15, bx + s * 0.2, Y); g.fill(); } }
  if (name) { g.font = `800 ${Math.max(10, s * 0.28)}px system-ui`; g.textAlign = 'center'; const tw = g.measureText(name).width + 10; g.fillStyle = other ? 'rgba(47,138,91,.92)' : 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect ? g.roundRect(X - tw / 2, Y - H - s * 0.42, tw, s * 0.36, 6) : g.rect(X - tw / 2, Y - H - s * 0.42, tw, s * 0.36); g.fill(); g.fillStyle = other ? '#fff' : '#3a2b3d'; g.fillText(name, X, Y - H - s * 0.15); }
  if (emote) { g.font = `${s * 0.7}px system-ui`; g.textAlign = 'center'; g.fillText(emote, X + s * 0.45, Y - H - (name ? s * 0.5 : 0) + Math.sin(now * 6) * 3); }
}
function drawSquishy(g, sid, X, Y, s, scale, now, shiny) {
  const im = sqImg(sid, shiny); const S = s * scale;
  const hop = Math.max(0, Math.sin(now * 4)) * s * 0.18;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(X + s / 2, Y + s * 0.92, S * 0.32, S * 0.08, 0, 0, 7); g.fill();
  if (im) g.drawImage(im, X + s / 2 - S / 2, Y + s * 0.95 - S - hop, S, S);
}
function drawObj(g, o, p, s, cam, now) {
  const X = (o.x - cam.x) * s, Y = (o.y - cam.y) * s;
  const st = curStep(p), target = st && (st.talk === o.id || st.special === o.id);
  if (o.type === 'npc') drawPerson(g, lookOf(o.look), o.x, o.y, o.dir || 'down', s, cam, false, '', '');
  else if (o.type === 'guardian') { const big = !chDone(p, o.c + 1) && !(p.flags['g:' + o.id]); drawSquishy(g, guardianSid(o), X, Y, s, big ? 1.9 : 1.15, now * (big ? 0.6 : 1), false); if (o.guardian.ghost) { g.globalAlpha = 0.25; g.fillStyle = '#fff'; g.beginPath(); g.arc(X + s / 2, Y + s * 0.3, s * 0.9, 0, 7); g.fill(); g.globalAlpha = 1; } }
  else if (o.type === 'special') drawSquishy(g, specialSid(o), X, Y, s, 0.9, now * 1.6, false);
  else if (o.type === 'bell') { g.fillStyle = '#868e96'; g.fillRect(X + s * 0.15, Y - s * 0.6, s * 0.1, s * 1.5); g.fillRect(X + s * 0.75, Y - s * 0.6, s * 0.1, s * 1.5); g.fillRect(X + s * 0.1, Y - s * 0.65, s * 0.8, s * 0.12); g.fillStyle = '#ffd43b'; g.beginPath(); g.moveTo(X + s * 0.3, Y + s * 0.3); g.quadraticCurveTo(X + s * 0.3, Y - s * 0.45, X + s * 0.5, Y - s * 0.45); g.quadraticCurveTo(X + s * 0.7, Y - s * 0.45, X + s * 0.7, Y + s * 0.3); g.fill(); }
  else if (o.type === 'stop') { g.fillStyle = '#8d5a33'; g.fillRect(X + s * 0.44, Y - s * 0.3, s * 0.12, s * 1.15); g.fillStyle = p.visited[o.c] ? '#ffd43b' : '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.18 : s * 0.4; g.lineTo(X + s / 2 + Math.cos(a) * r, Y - s * 0.3 + Math.sin(a) * r); } g.fill(); g.strokeStyle = '#e0a800'; g.lineWidth = 1.5; g.stroke(); }
  else if (o.type === 'item') {
    if (o.lantern) { const lit = p.flags['it:' + o.id]; g.fillStyle = '#2a2238'; g.fillRect(X + s * 0.45, Y - s * 0.5, s * 0.1, s * 1.35); g.fillStyle = lit ? '#ffd43b' : '#5c5470'; g.fillRect(X + s * 0.3, Y - s * 0.75, s * 0.4, s * 0.45); if (lit) { g.fillStyle = 'rgba(255,212,59,.4)'; g.beginPath(); g.arc(X + s / 2, Y - s * 0.52, s * 0.5 + Math.sin(now * 5) * 2, 0, 7); g.fill(); } }
    else if (o.group === 'escapee') drawSquishy(g, o._sid || (o._sid = (SQUISHIES.filter((x) => x.set === o.set && x.r === 'C')[hash2(o.x, o.y) * 3 | 0] || SQUISHIES[0]).id), X, Y, s, 0.85, now * 2 + o.x, false);
    else { const b = Math.sin(now * 3 + o.x) * s * 0.06; g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(X + s / 2, Y + s * 0.55, s * (0.32 + Math.sin(now * 4) * 0.04), 0, 7); g.fill(); g.font = `${s * 0.6}px system-ui`; g.textAlign = 'center'; g.fillText(o.icon || '✨', X + s / 2, Y + s * 0.75 + b); }
  }
  const sqp = o.side && p.sides[o.side.id], sideReady = o.side && (!sqp || (!sqp.done && (sqp.n || 0) >= o.side.n));
  if (target || (o.shop && false) || sideReady) { const bob = Math.sin(now * 5) * s * 0.08; g.font = `900 ${s * 0.55}px system-ui`; g.textAlign = 'center'; g.fillStyle = target ? '#ffd43b' : '#74c0fc'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; const ty = Y - s * (o.type === 'guardian' ? 1.6 : 1.25) + bob; WG.marks.push([X + s / 2, ty, target]); }
}

/* =========================================================
   5 · Movement & input
   ========================================================= */
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function tryStep(dir) {
  const p = wMe(); if (!p || WG.busy || WG.move) return false;
  WG.pos.d = dir;
  const [dx, dy] = DIRS[dir], nx = WG.pos.x + dx, ny = WG.pos.y + dy;
  if (blockedAt(nx, ny, p)) { bump(nx, ny, p); return false; }
  WG.move = { fx: WG.pos.x, fy: WG.pos.y, tx: nx, ty: ny, t: 0, dur: getWorld().at(nx, ny) === T.ICE ? 0.08 : 0.17, dir };
  WG.pos.x = nx; WG.pos.y = ny;
  return true;
}
function bump(x, y, p) {
  const o = getWorld().occ.get(x + ',' + y);
  if (Date.now() - (WG.bumpT || 0) < 600) return; // holding into a wall: react once, not every frame
  WG.bumpT = Date.now(); navigator.vibrate?.(10);
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
  if (typeof liveSend === 'function' && Date.now() - (WG.liveT || 0) > 500) { WG.liveT = Date.now(); liveSend(); } else if (typeof livePush === 'function') livePush();
  if (Date.now() - WG.saveT > 15000) { WG.saveT = Date.now(); savePos(); }
  // Wild encounters in tall grass
  if ((p.bubbles || 0) > 0 && w.at(x, y) === T.TALL && !WG.path.length && WG.steps - WG.lastEnc > 2 && Math.random() < 0.13) { WG.lastEnc = WG.steps; WG.hold = null; WG.path = []; setTimeout(() => encounter(wildSid(r), {}), 120); }
  else if ((p.bubbles || 0) > 0 && w.at(x, y) === T.TALL && WG.path.length && WG.steps - WG.lastEnc > 3 && Math.random() < 0.08) { WG.lastEnc = WG.steps; WG.path = []; WG.pendingTalk = null; setTimeout(() => encounter(wildSid(r), {}), 120); }
}
function savePos() { const p = wMe(); if (!p || !WG.pos) return; p.x = WG.pos.x; p.y = WG.pos.y; p.d = WG.pos.d; save(); }
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
  WG.hold = null; WG.path = [];
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
  if (!p.done.includes(ch)) p.done.push(ch);
  const gems = ch === 8 ? 100 : 25;
  gemLog(actor(), gems, `Squishvale: ${R.name} star ⭐`, 'bonus', 'world:ch' + ch);
  p.bubbles = (p.bubbles || 0) + 5;
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
      timer = setInterval(() => { k += 2; el.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(timer); full = true; } }, 24);
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
  WG.hold = null; WG.path = [];
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
function hudHTML() {
  return `<canvas class="wcv"></canvas>
    <div class="wh-top"><button class="wh-x" aria-label="Leave Squishvale">✕</button><div class="wh-goal"><span class="wh-arrow">⬆&#xFE0E;</span><span class="wh-goal-t"></span></div><button class="wh-menu" aria-label="Menu">☰</button></div>
    <div class="wh-sub"><span class="wh-region"></span><span class="wh-stars"></span><span class="wh-bub">🫧 <b>0</b></span></div>
    <div class="wh-pad"><button data-d="up">▲&#xFE0E;</button><button data-d="left">◀&#xFE0E;</button><button data-d="right">▶&#xFE0E;</button><button data-d="down">▼&#xFE0E;</button></div>
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
    for (const b of L.querySelectorAll('.wh-pad button')) {
      const d = b.dataset.d;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); WG.path = []; WG.pendingTalk = null; WG.hold = d; WG.holdAt = performance.now(); tryStep(d); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (WG.hold === d) WG.hold = null; });
    }
    window.addEventListener('resize', () => { if (WG.layer && !WG.layer.hidden) resize(); });
  }
  WG.layer = L; L.hidden = false;
  document.body.classList.add('world-mode');
  if (!me) { L.hidden = true; document.body.classList.remove('world-mode'); return; }
  const p = wMe();
  if (!WG.pos || WG.posFor !== me) {
    WG.posFor = me; WG.others = {};
    WG.pos = { x: p.x, y: p.y, fx: p.x, fy: p.y, d: p.d || 'down' };
    if (blockedAt(p.x, p.y, p)) { let f = null; for (let rr = 1; rr < 8 && !f; rr++) for (let dy = -rr; dy <= rr && !f; dy++) for (let dx = -rr; dx <= rr; dx++) if (!blockedAt(p.x + dx, p.y + dy, p)) { f = [p.x + dx, p.y + dy]; break; } const [sx, sy] = f || WREG[0].start; Object.assign(WG.pos, { x: sx, y: sy, fx: sx, fy: sy }); }
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
  cancelAnimationFrame(WG.raf); WG.raf = 0; WG.hold = null; WG.path = [];
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
document.addEventListener('keydown', (e) => {
  if (!WG.layer || WG.layer.hidden || e.target.closest?.('input, textarea')) return;
  const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
  if (k) { e.preventDefault(); if (e.repeat && WG.hold === k) return; WG.path = []; WG.hold = k; WG.holdAt = performance.now(); tryStep(k); }
  else if (e.key === ' ' || e.key === 'Enter') { if (e.repeat) return; if (e.target.closest?.('.wcard button, .wmenu button, .wgame button, .wenc button')) return; e.preventDefault(); const top = WG.layer.querySelector('.wdlg'); if (top) top.click(); else pressA(); }
  else if (e.key === 'm' && !WG.busy) openMenu();
});
document.addEventListener('keyup', (e) => { const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key]; if (k && WG.hold === k) WG.hold = null; });
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
window.WorldDebug = { WG, getWorld, wMe, iceSolve, teleport: (x, y) => teleport(x, y), interact, encounter, miniGame, objById, stepTarget, blockedAt, pathTo, regionAt, MW, MH, RW, RH, REG_POS, T, completeChapter };
