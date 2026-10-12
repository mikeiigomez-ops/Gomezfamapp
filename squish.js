/* Squishies 🧸: collect original kawaii squishies with Gems. Mystery boxes (odds shown, with a pity guarantee),
   a daily free box, a rotating shop where any squishy can be bought outright, a collection book with set bonuses,
   tap-to-squish, fusing spares into rarer ones, and trading inside the family (Friends Circles extend it).
   All art is drawn here as SVG. Loaded after gems.js. */
'use strict';

Object.assign(TITLES, { squishies: 'Squishies', squishy: 'Squishy' });

/* =========================================================
   Catalog
   ========================================================= */
const RARITY = {
  C: { name: 'Common', color: '#8a94a6', value: 1, price: 15 },
  R: { name: 'Rare', color: '#3b82f6', value: 3, price: 40 },
  E: { name: 'Epic', color: '#a855f7', value: 8, price: 100 },
  L: { name: 'Legendary', color: '#f59e0b', value: 20, price: 250 },
  M: { name: 'Mythic', color: '#ec4899', value: 50, price: 600 },
  U: { name: 'Ultimate', color: '#ffb800', value: 100, price: 0 },
};
const TIERS = ['C', 'R', 'E', 'L', 'M'];
const ALL_TIERS = [...TIERS, 'U'];
const EXTRA_ART = {}, ACCESSORIES = {}; // filled by collect.js
const SETS = { critters: ['🐾', 'Cozy Critters'], treats: ['🍰', 'Sweet Treats'], dream: ['🌈', 'Dreamland'] };
const SPECIES = {
  cat: 'critters', bunny: 'critters', bear: 'critters', frog: 'critters', penguin: 'critters', fox: 'critters',
  dumpling: 'treats', peach: 'treats', berry: 'treats', cupcake: 'treats', mochi: 'treats', mushroom: 'treats',
  cloud: 'dream', star: 'dream', axolotl: 'dream', unicorn: 'dream', dragon: 'dream', whale: 'dream',
};
// [id, species, name, body color, accent color, rarity, special fill]
const SQUISHIES = [
  ['cat1', 'cat', 'Kitty', '#f6b26b', '#ffe0bf', 'C'], ['cat2', 'cat', 'Lilac Kitty', '#c3a3ef', '#f0e4ff', 'R'], ['cat3', 'cat', 'Galaxy Kitty', '#3b2a6b', '#9a86f0', 'E', 'galaxy'],
  ['bun1', 'bunny', 'Bunbun', '#f4f1ee', '#ffc1d3', 'C'], ['bun2', 'bunny', 'Mint Bunbun', '#b9ecd6', '#fff5c9', 'R'], ['bun3', 'bunny', 'Holo Bunbun', '#e9d8ff', '#ffd6f3', 'E', 'holo'],
  ['bear1', 'bear', 'Teddy', '#c98e5a', '#f1d1b0', 'C'], ['bear2', 'bear', 'Blush Teddy', '#f7b7c8', '#ffe6ee', 'R'], ['bear3', 'bear', 'Honey Teddy', '#f7c548', '#fff0b8', 'E', 'gold'],
  ['frog1', 'frog', 'Froggy', '#8fd16a', '#d9f5c4', 'C'], ['frog2', 'frog', 'Blue Froggy', '#7cc6f0', '#d8f0ff', 'R'], ['frog3', 'frog', 'Rainbow Froggy', '#8fd16a', '#ffffff', 'E', 'rainbow'],
  ['peng1', 'penguin', 'Pip', '#2f3a56', '#ffffff', 'C'], ['peng2', 'penguin', 'Pink Pip', '#e985ad', '#fff2f7', 'R'], ['peng3', 'penguin', 'Ice Pip', '#9fd8f5', '#ffffff', 'E', 'holo'],
  ['fox1', 'fox', 'Foxy', '#f08a3c', '#fff4e8', 'C'], ['fox2', 'fox', 'Snow Foxy', '#eef3f8', '#ffffff', 'R'], ['fox3', 'fox', 'Fire Foxy', '#ff5a3c', '#ffd36b', 'L', 'fire'],
  ['dump1', 'dumpling', 'Dumpling', '#fbf3e4', '#e8d3b0', 'C'], ['dump2', 'dumpling', 'Matcha Dumpling', '#cfe8b4', '#9fc77d', 'R'], ['dump3', 'dumpling', 'Golden Dumpling', '#f7c948', '#d99a0b', 'M', 'gold'],
  ['peach1', 'peach', 'Peachy', '#ffb38a', '#7bc96f', 'C'], ['peach2', 'peach', 'Berry Peachy', '#ff8fb1', '#7bc96f', 'R'], ['peach3', 'peach', 'Sparkle Peachy', '#ffc8a8', '#7bc96f', 'E', 'holo'],
  ['berry1', 'berry', 'Berry', '#ff5c6c', '#5cbf5a', 'C'], ['berry2', 'berry', 'Cream Berry', '#ffd1dc', '#5cbf5a', 'R'], ['berry3', 'berry', 'Choco Berry', '#7a4a33', '#5cbf5a', 'E'],
  ['cup1', 'cupcake', 'Cupcake', '#ffc6dc', '#8fd3f4', 'C'], ['cup2', 'cupcake', 'Mint Cupcake', '#b9f0d8', '#f7a8c4', 'R'], ['cup3', 'cupcake', 'Party Cupcake', '#ffe066', '#c084fc', 'E', 'rainbow'],
  ['mochi1', 'mochi', 'Mochi', '#ffe3ec', '#ffb3c8', 'C'], ['mochi2', 'mochi', 'Ube Mochi', '#c9a7f0', '#e8d7ff', 'R'], ['mochi3', 'mochi', 'Cosmic Mochi', '#2b2560', '#ff9de2', 'L', 'galaxy'],
  ['mush1', 'mushroom', 'Mush', '#fff3e0', '#ef5350', 'C'], ['mush2', 'mushroom', 'Blue Mush', '#fff3e0', '#5c9cf0', 'R'], ['mush3', 'mushroom', 'Glow Mush', '#e8fff6', '#2ee6a6', 'E', 'glow'],
  ['cloud1', 'cloud', 'Cloudy', '#f4f8ff', '#cfe0ff', 'C'], ['cloud2', 'cloud', 'Sunset Cloudy', '#ffd2b8', '#ffb3c8', 'R'], ['cloud3', 'cloud', 'Storm Cloudy', '#7b86a8', '#ffe066', 'E'],
  ['star1', 'star', 'Twinkle', '#ffd84d', '#fff3b0', 'C'], ['star2', 'star', 'Pink Twinkle', '#ff9ccf', '#ffe1f0', 'R'], ['star3', 'star', 'Superstar', '#ffd84d', '#fff3b0', 'L', 'gold'],
  ['axo1', 'axolotl', 'Lolo', '#ffb6d1', '#ff6fa5', 'C'], ['axo2', 'axolotl', 'Lavender Lolo', '#cdb8ff', '#9a7cf0', 'R'], ['axo3', 'axolotl', 'Crystal Lolo', '#bff3ff', '#7ee0ff', 'L', 'holo'],
  ['uni1', 'unicorn', 'Sparkles', '#ffffff', '#ffb3d9', 'C'], ['uni2', 'unicorn', 'Moon Sparkles', '#dfe6ff', '#9db1ff', 'R'], ['uni3', 'unicorn', 'Rainbow Sparkles', '#ffffff', '#ffb3d9', 'M', 'rainbow'],
  ['drag1', 'dragon', 'Draggy', '#7bd389', '#ffe08a', 'C'], ['drag2', 'dragon', 'Ruby Draggy', '#ff7b8a', '#ffd0a8', 'R'], ['drag3', 'dragon', 'Galaxy Draggy', '#2b2560', '#ff9de2', 'M', 'galaxy'],
  ['whale1', 'whale', 'Bubbles', '#7fb8f5', '#e6f3ff', 'C'], ['whale2', 'whale', 'Pink Bubbles', '#ffadd2', '#fff0f7', 'R'], ['whale3', 'whale', 'Ocean Bubbles', '#2bb3c0', '#bff7f0', 'E', 'holo'],
].map(([id, sp, name, c1, c2, r, fx]) => ({ id, sp, name, c1, c2, r, fx: fx || '', set: SPECIES[sp], kind: 'squishy' }));
const SQ = Object.fromEntries(SQUISHIES.map((s) => [s.id, s]));

/* =========================================================
   Art: original kawaii squishies, drawn as SVG
   ========================================================= */
let svgSeq = 0;
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/* House "Clay" style: every part is lit from the top-left (a radial gradient from a lighter tint to a slightly
   darker shade), the body gets a colored rim, one shared light field + glossy highlight clipped to its outline,
   and a soft contact shadow. fx fills (galaxy, holo, gold …) are layered under the same light. */
const SQ_INK = '#3a2b3d', SQ_BLUSH = '#ff8fab', SQ_SHADE = '#2a1830';
const sqLum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b; };
const sqClayGrad = (id, c) => `<radialGradient id="${id}" cx=".32" cy=".26" r=".9"><stop offset="0" stop-color="${mixHex(c, '#ffffff', 0.42)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${mixHex(c, SQ_SHADE, 0.2)}"/></radialGradient>`;
const sqStops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
// 4-point twinkle centred on (x, y)
const sqSpark = (x, y, r, fill, cls = '') => `<path${cls ? ` class="${cls}"` : ''} d="M${x} ${y - r}Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z" fill="${fill}"/>`;
// A star with soft, rounded points (so it can be clipped and rimmed like any other body)
function sqStarPath(cx, cy, R, r, n = 5) {
  const v = [...Array(n * 2)].map((_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / n, d = i % 2 ? r : R; return [cx + d * Math.cos(a), cy + d * Math.sin(a)]; });
  const f = (x) => x.toFixed(1), lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return v.map((p, i) => { const t = i % 2 ? 0.2 : 0.3, A = lerp(p, v[(i + v.length - 1) % v.length], t), B = lerp(p, v[(i + 1) % v.length], t); return `${i ? 'L' : 'M'}${f(A[0])} ${f(A[1])}Q${f(p[0])} ${f(p[1])} ${f(B[0])} ${f(B[1])}`; }).join('') + 'Z';
}
const SQ_SHAPE_RE = /<(path|ellipse|circle|rect|polygon)\b[^>]*>/g;
// Copy of the filled shapes in `str` as bare geometry (for the rim and the light clip)
function sqBare(str, keep) {
  return (str.match(SQ_SHAPE_RE) || []).filter(keep).map((e) => {
    const sw = +(e.match(/stroke-width="([\d.]+)"/) || [])[1] || 0;
    return e.replace(/ (fill|stroke|stroke-width|opacity|stroke-linejoin|stroke-linecap|class)="[^"]*"/g, '').replace(/\/?>$/, sw ? ` stroke-width="${sw}"/>` : '/>');
  }).join('');
}
const SQ_FX_RIM = { galaxy: '#2a1f5c', gold: '#d0960f', rainbow: '#c39ae0', fire: '#d8452a' };

function squishySVG(sid, opts = {}) {
  const s = SQ[sid];
  if (!s) return '';
  if (s.kind === 'niddo' && typeof niddoSVG === 'function') return niddoSVG(s, opts);
  const g = 'sq' + (++svgSeq);
  const ink = SQ_INK, blush = SQ_BLUSH;
  const light = mixHex(s.c1, '#ffffff', 0.55), dark = mixHex(s.c1, '#000000', 0.12);
  const darkBody = s.fx === 'galaxy' || sqLum(s.c1) < 95;
  // Per-color clay gradients, made on demand: C('#ffad33') → url(#…)
  let cdefs = '', cn = 0;
  const cmap = {};
  const C = (c) => cmap[c] || (cdefs += sqClayGrad(`${g}c${cn}`, c), (cmap[c] = `url(#${g}c${cn++})`));
  const st = sqStops;
  const fills = {
    rainbow: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">${st([[0, '#ff9ab8'], [0.2, '#ffbe76'], [0.4, '#ffe873'], [0.6, '#8fe3a4'], [0.8, '#86c8ff'], [1, '#b99cff']])}</linearGradient>`,
    galaxy: `<radialGradient id="${g}" cx=".34" cy=".28" r=".85">${st([[0, mixHex(s.c1, '#9a86f0', 0.45)], [0.5, s.c1], [1, '#100a28']])}</radialGradient>`,
    gold: `<linearGradient id="${g}" x1="0" y1="0" x2=".8" y2="1">${st([[0, '#fff8cc'], [0.28, mixHex(s.c1, '#ffe27a', 0.4)], [0.5, '#eaa810'], [0.66, '#ffe58a'], [1, '#c07806']])}</linearGradient>`,
    holo: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">${st([[0, mixHex(s.c1, '#ffffff', 0.6)], [0.3, '#ffd9f3'], [0.52, '#d3f4ff'], [0.74, '#e4d9ff'], [1, s.c1]])}</linearGradient>`,
    fire: `<linearGradient id="${g}" x1=".2" y1="1" x2=".5" y2="0">${st([[0, '#e8261f'], [0.45, s.c1], [0.8, '#ffad33'], [1, '#ffe58a']])}</linearGradient>`,
    glow: `<radialGradient id="${g}" cx=".45" cy=".38" r=".75">${st([[0, '#ffffff'], [0.45, mixHex(s.c1, '#ffffff', 0.5)], [1, s.c1]])}</radialGradient>`,
    diamond: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">${st([[0, '#ffffff'], [0.24, '#c9f6ff'], [0.45, s.c1], [0.62, '#f0e6ff'], [0.82, '#9fdcff'], [1, '#e9fbff']])}</linearGradient>`,
  };
  const fxOn = !!fills[s.fx];
  const F = `url(#${g})`, A = s.c2, B = C(A);
  const rim = SQ_FX_RIM[s.fx] || (s.fx ? mixHex(s.c1, '#8a78c0', 0.35) : mixHex(s.c1, SQ_SHADE, sqLum(s.c1) > 225 ? 0.17 : 0.24));
  let back = '', body = '', front = '', fy = 64, art = {}, bb = null; // face y; bb = round body geometry
  const ear = (pts, fill) => `<path d="${pts}" fill="${fill}" stroke="${fill}" stroke-width="5" stroke-linejoin="round"/>`;
  const round = (rx = 36, ry = 32, cy = 60) => { bb = [50, cy, rx, ry]; return `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${F}"/>`; };
  const inner = mixHex(blush, '#ffffff', 0.25);
  switch (s.sp) {
    case 'cat': back = ear('M19 50 L23 17 L45 34Z', F) + ear('M81 50 L77 17 L55 34Z', F) + ear('M25 40 L26.5 25 L37 33Z', inner) + ear('M75 40 L73.5 25 L63 33Z', inner); body = round(37, 32, 61); front = `<path d="M17 66 L8 64 M17 70 L9 72 M83 66 L92 64 M83 70 L91 72" stroke="${mixHex(s.c1, SQ_SHADE, 0.35)}" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>`; break;
    case 'bunny': back = `<ellipse cx="36" cy="24" rx="9.5" ry="22" fill="${F}" transform="rotate(-12 36 24)"/><ellipse cx="64" cy="24" rx="9.5" ry="22" fill="${F}" transform="rotate(12 64 24)"/><ellipse cx="36" cy="27" rx="4.5" ry="14" fill="${B}" transform="rotate(-12 36 27)"/><ellipse cx="64" cy="27" rx="4.5" ry="14" fill="${B}" transform="rotate(12 64 27)"/>`; body = round(36, 31, 62); fy = 66; break;
    case 'bear': back = `<circle cx="24" cy="36" r="11.5" fill="${F}"/><circle cx="76" cy="36" r="11.5" fill="${F}"/><circle cx="24.5" cy="36.5" r="6" fill="${B}"/><circle cx="75.5" cy="36.5" r="6" fill="${B}"/>`; body = round(37, 32, 61); front = `<ellipse cx="50" cy="72" rx="11" ry="7.5" fill="${B}"/><ellipse cx="50" cy="69.5" rx="3.2" ry="2.3" fill="${ink}"/>`; art = { mouthY: 74.5 }; fy = 63; break;
    case 'frog': back = `<circle cx="31" cy="37" r="14" fill="${F}"/><circle cx="69" cy="37" r="14" fill="${F}"/>`; body = round(39, 30, 63); front = `<ellipse cx="50" cy="79" rx="19" ry="8" fill="${B}" opacity=".85"/>`; art = { eyesY: 37, ex: 19, mouthY: 64, eyeK: 1.05, gloss: [30, 48, 9, 5] }; break;
    case 'penguin': body = `<ellipse cx="50" cy="58" rx="33" ry="36" fill="${F}"/>`; bb = [50, 58, 33, 36]; back = `<ellipse cx="17" cy="64" rx="6" ry="13" fill="${F}" transform="rotate(18 17 64)"/><ellipse cx="83" cy="64" rx="6" ry="13" fill="${F}" transform="rotate(-18 83 64)"/>`; front = `<path d="M50 38 C66 38 73 52 73 66 C73 82 63 91 50 91 C37 91 27 82 27 66 C27 52 34 38 50 38Z" fill="${B}"/><ellipse cx="38" cy="93" rx="7.5" ry="3.8" fill="${C('#ffad33')}"/><ellipse cx="62" cy="93" rx="7.5" ry="3.8" fill="${C('#ffad33')}"/><path d="M45.5 66 Q50 63.5 54.5 66 Q50 71.5 45.5 66Z" fill="${C('#ffad33')}"/>`; art = { eyesY: 59, mouthY: 70, noMouth: true }; break;
    case 'fox': back = ear('M17 50 L20 13 L45 33Z', F) + ear('M83 50 L80 13 L55 33Z', F) + ear('M23 36 L23.5 21 L35 31Z', B) + ear('M77 36 L76.5 21 L65 31Z', B); body = round(37, 32, 61); front = `<path d="M15 64 Q30 82 50 79 Q70 82 85 64 Q80 92 50 92 Q20 92 15 64Z" fill="${B}"/><ellipse cx="50" cy="72" rx="3" ry="2.2" fill="${ink}"/>`; art = { mouthY: 76 }; break;
    case 'dumpling': body = `<path d="M11 71 Q11 40 50 33 Q89 40 89 71 Q89 89 50 89 Q11 89 11 71Z" fill="${F}"/>`; front = [36, 44, 50, 56, 64].map((x, i) => `<path d="M${x} 35 Q${x + (i - 2) * 2.2} 43 ${x + (i - 2) * 0.8} 50" stroke="${mixHex(A, SQ_SHADE, 0.15)}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`).join('') + `<circle cx="50" cy="33" r="3.2" fill="${B}"/>`; art = { gloss: [28, 52, 10, 5] }; fy = 70; break;
    case 'peach': back = `<path d="M50 31 Q58 13 76 18 Q66 33 50 31Z" fill="${B}"/><path d="M55 27 Q64 21 71 20" stroke="${mixHex(A, SQ_SHADE, 0.35)}" stroke-width="1.4" fill="none" opacity=".6"/>`; body = `<path d="M50 30 C17 25 7 62 21 79 C34 93 66 93 79 79 C93 62 83 25 50 30Z" fill="${F}"/>`; front = `<path d="M50 32 Q41 48 46 62" stroke="${mixHex(s.c1, SQ_SHADE, 0.3)}" stroke-width="2.2" fill="none" opacity=".35" stroke-linecap="round"/>`; art = { gloss: [30, 46, 9, 6] }; fy = 69; break;
    case 'berry': body = `<path d="M50 91 C25 83 11 62 14 46 C17 32 32 29 50 31 C68 29 83 32 86 46 C89 62 75 83 50 91Z" fill="${F}"/>`; back = ear('M28 35 L39 19 L50 29 L61 19 L72 35Z', B); front = [[27, 49], [73, 49], [35, 77], [65, 77], [50, 84], [23, 62], [77, 62]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.4" fill="#fff4b0" opacity=".9"/>`).join(''); art = { gloss: [30, 42, 8, 5] }; fy = 58; break;
    case 'cupcake': body = `<path d="M17 65 Q15 39 50 31 Q85 39 83 65 Q74 61 66 65 Q58 60 50 65 Q42 60 34 65 Q26 61 17 65Z" fill="${F}"/><path d="M23 63 L77 63 L70 93 L30 93Z" fill="${B}"/>`; front = [36, 44, 52, 60, 68].map((x) => `<path d="M${x} 66 L${(x - 1 + (x - 50) * 0.1).toFixed(1)} 91" stroke="#fff" stroke-width="1.8" opacity=".5" stroke-linecap="round"/>`).join('') + `<circle cx="50" cy="26" r="6.5" fill="${C('#ff4d6d')}"/><path d="M50 20 Q53 13 60 12" stroke="#5cbf5a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="48" cy="24" r="1.8" fill="#fff" opacity=".7"/>`; art = { eyesY: 48, ex: 11, mouthY: 55, gloss: [30, 44, 8, 4] }; break;
    case 'mochi': body = `<path d="M9 75 Q9 40 50 38 Q91 40 91 75 Q91 89 50 89 Q9 89 9 75Z" fill="${F}"/>`; front = `<ellipse cx="50" cy="44.5" rx="17" ry="3.5" fill="#ffffff" opacity=".35"/>`; art = { gloss: [26, 54, 11, 5.5], top: 40 }; fy = 70; break;
    case 'mushroom': body = `<path d="M30 52 L70 52 Q74 70 72 82 Q70 93 50 93 Q30 93 28 82 Q26 70 30 52Z" fill="${F}"/>`; front = `<path d="M8 57 Q8 15 50 15 Q92 15 92 57 Q90 62 80 59 Q66 54 50 54 Q34 54 20 59 Q10 62 8 57Z" fill="${B}"/><ellipse cx="30" cy="34" rx="6.5" ry="6" fill="#fff" opacity=".92"/><circle cx="57" cy="25" r="4.5" fill="#fff" opacity=".92"/><ellipse cx="73" cy="41" rx="5.5" ry="5" fill="#fff" opacity=".92"/><circle cx="46" cy="44" r="3" fill="#fff" opacity=".92"/><ellipse cx="26" cy="26" rx="6" ry="3" fill="#fff" opacity=".5" transform="rotate(-30 26 26)"/>`; art = { eyesY: 70, ex: 10, mouthY: 78, gloss: [37, 64, 4, 3] }; break;
    case 'cloud': body = `<g fill="${F}"><circle cx="29" cy="63" r="20"/><circle cx="52" cy="50" r="25"/><circle cx="73" cy="62" r="18"/><rect x="18" y="60" width="66" height="27" rx="13.5"/></g>`; art = { gloss: [42, 36, 9, 5] }; fy = 67; break;
    case 'star': body = `<path d="${sqStarPath(50, 57, 43, 21)}" fill="${F}"/>`; art = { gloss: [42, 34, 5, 7], ex: 10 }; fy = 61; break;
    case 'axolotl': back = [-1, 1].map((d) => [0, 1, 2].map((k) => `<ellipse cx="${50 + d * 40}" cy="${45 + k * 9}" rx="10" ry="4" fill="${B}" transform="rotate(${d * (k - 1) * 24} ${50 + d * 40} ${45 + k * 9})"/>`).join('')).join(''); body = round(35, 30, 61); art = { ex: 13 }; break;
    case 'unicorn': {
      const m = [A, mixHex(A, '#b9a3ff', 0.55), mixHex(A, '#9fe3ff', 0.55)];
      back = `<path d="M44 34 L50 3 L56 34Z" fill="${C('#ffd84d')}" stroke="${C('#ffd84d')}" stroke-width="2" stroke-linejoin="round"/><path d="M46.5 25 L53.5 22.5 M47.5 16 L52.5 14" stroke="#e8a900" stroke-width="1.8" stroke-linecap="round"/>` + ear('M23 42 L26 21 L39 33Z', F) + ear('M77 42 L74 21 L61 33Z', F) + ear('M27 36 L28 26 L34 32Z', inner) + ear('M73 36 L72 26 L66 32Z', inner);
      body = round(37, 32, 61);
      front = `<circle cx="40" cy="32" r="7" fill="${C(m[0])}"/><circle cx="31" cy="36" r="5.5" fill="${C(m[1])}"/><circle cx="72" cy="33" r="7.5" fill="${C(m[0])}"/><circle cx="82" cy="43" r="6.5" fill="${C(m[1])}"/><circle cx="86" cy="55" r="5.5" fill="${C(m[2])}"/><circle cx="85" cy="66" r="4.5" fill="${C(m[0])}"/>`;
      art = { gloss: [30, 46, 9, 5] }; break;
    }
    case 'dragon': back = `<path d="M20 55 Q1 35 5 21 Q15 33 21 30 Q22 38 29 41Z" fill="${B}" stroke="${B}" stroke-width="2" stroke-linejoin="round"/><path d="M80 55 Q99 35 95 21 Q85 33 79 30 Q78 38 71 41Z" fill="${B}" stroke="${B}" stroke-width="2" stroke-linejoin="round"/>` + ear('M33 35 L31 17 L43 30Z', B) + ear('M67 35 L69 17 L57 30Z', B) + `<path d="M43 30 L46 25 L50 29 L54 25 L57 30" fill="${B}"/>`; body = round(37, 32, 61); front = `<ellipse cx="50" cy="78" rx="15" ry="9" fill="${B}" opacity=".75"/><circle cx="46" cy="72" r="1.2" fill="${mixHex(s.c1, SQ_SHADE, 0.5)}"/><circle cx="54" cy="72" r="1.2" fill="${mixHex(s.c1, SQ_SHADE, 0.5)}"/>`; break;
    default: if (EXTRA_ART[s.sp]) { art = EXTRA_ART[s.sp]({ F, A, B, C, s, light, dark, round, ear, blush, ink, inner }); ({ back = '', body = '', front = '', fy = 64 } = art); } break;
    case 'whale': back = `<path d="M84 60 Q99 46 97 36 Q90 49 82 50 Q89 40 82 33 Q79 50 73 56Z" fill="${F}"/><path d="M44 22 Q42 13 36 10 M50 22 L50 8 M56 22 Q58 13 64 10" stroke="#8ec5ff" stroke-width="3.2" stroke-linecap="round" fill="none"/><circle cx="36" cy="9" r="2.4" fill="#bfe1ff"/><circle cx="64" cy="9" r="2.4" fill="#bfe1ff"/><circle cx="50" cy="6" r="2.6" fill="#bfe1ff"/>`; body = `<ellipse cx="46" cy="60" rx="40" ry="32" fill="${F}"/>`; bb = [46, 60, 40, 32]; front = `<path d="M8 66 Q46 93 84 66 Q78 91 46 92 Q12 91 8 66Z" fill="${B}"/><path d="M26 82 L28 88 M36 85 L37 91 M46 86 L46 92 M56 85 L55 91 M66 82 L64 88" stroke="#fff" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>`; art = { gloss: [26, 42, 10, 6] }; fy = 60; break;
  }
  const k = art.eyeK || 1;
  const ex = art.ex ?? 12.5;
  const eyesY = art.eyesY ?? fy - 2;
  const eyeL = 50 - ex, eyeR = 50 + ex;
  const mouthY = art.mouthY ?? eyesY + 7;
  const eyeInk = art.eyeInk || ink;
  const ringy = art.eyeRim || darkBody;
  const ring = ringy ? ` stroke="#fff" stroke-opacity=".7" stroke-width="1.1"` : '';
  const eye = (x) => `<ellipse cx="${x}" cy="${eyesY}" rx="${(4.3 * k).toFixed(2)}" ry="${(5.2 * k).toFixed(2)}" fill="${eyeInk}"${ring}/><circle cx="${(x + 1.5 * k).toFixed(2)}" cy="${(eyesY - 2 * k).toFixed(2)}" r="${(1.75 * k).toFixed(2)}" fill="#fff"/><circle cx="${(x - 1.4 * k).toFixed(2)}" cy="${(eyesY + 2.2 * k).toFixed(2)}" r="${(0.8 * k).toFixed(2)}" fill="#fff" opacity=".75"/>`;
  const joy = (x) => `<path d="M${x - 4.4} ${eyesY + 1.2} Q${x} ${eyesY - 5} ${x + 4.4} ${eyesY + 1.2}" stroke="${ringy ? '#fff' : eyeInk}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  const mouthC = darkBody ? '#ffffff' : ink;
  const face = `<ellipse cx="${eyeL - 6}" cy="${eyesY + 6}" rx="5.4" ry="3.1" fill="${blush}" opacity=".6"/><ellipse cx="${eyeR + 6}" cy="${eyesY + 6}" rx="5.4" ry="3.1" fill="${blush}" opacity=".6"/>`
    + `<g class="f-open">${eye(eyeL)}${eye(eyeR)}</g><g class="f-joy" display="none">${joy(eyeL)}${joy(eyeR)}</g>`
    + (art.noMouth ? '' : `<path d="M46 ${mouthY} Q48 ${mouthY + 3} 50 ${mouthY} Q52 ${mouthY + 3} 54 ${mouthY}" stroke="${mouthC}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);

  // Light: one shared light field + gloss, clipped to the body's outline
  const bodyShapes = sqBare(body, (e) => !/fill="none"/.test(e));
  const rimEls = bodyShapes + sqBare(back, (e) => e.includes(`fill="${F}"`));
  const gl = art.gloss || (bb ? [bb[0] - bb[2] * 0.46, bb[1] - bb[3] * 0.5, bb[2] * 0.3, bb[3] * 0.18] : [34, Math.max(30, fy - 20), 9, 5]);
  const r1 = (n) => +n.toFixed(1);
  const glossEl = `<ellipse cx="${r1(gl[0])}" cy="${r1(gl[1])}" rx="${r1(gl[2])}" ry="${r1(gl[3])}" fill="#fff" opacity="${fxOn && s.fx !== 'galaxy' ? 0.7 : 0.6}" transform="rotate(-28 ${r1(gl[0])} ${r1(gl[1])})"/><circle cx="${r1(gl[0] + gl[2] * 1.15)}" cy="${r1(gl[1] + gl[3] * 1.3)}" r="${r1(Math.max(1.4, gl[3] * 0.32))}" fill="#fff" opacity=".7"/>`;
  const shadeK = fxOn ? 1 : 0.7;
  const hash = [...s.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
  const prng = (i) => ((hash * (i + 3) * 7919) % 1000) / 1000;
  let fxIn = '', fxBack = '', ndef = '';
  if (s.fx === 'galaxy') {
    ndef = `<radialGradient id="${g}n">${st([[0, A, 0.55], [1, A, 0]])}</radialGradient>`;
    fxIn = `<ellipse cx="36" cy="72" rx="26" ry="13" fill="url(#${g}n)" transform="rotate(-20 36 72)"/><ellipse cx="68" cy="50" rx="20" ry="11" fill="url(#${g}n)" transform="rotate(25 68 50)" opacity=".7"/>`
      + [...Array(9)].map((_, i) => `<circle cx="${(18 + prng(i) * 64).toFixed(1)}" cy="${(36 + prng(i + 11) * 52).toFixed(1)}" r="${i % 3 ? 0.8 : 1.3}" fill="${i % 4 ? '#fff' : '#ffe58a'}" opacity=".9"/>`).join('') + sqSpark(70, 74, 3.2, '#fff');
  } else if (s.fx === 'holo') {
    fxIn = `<path d="M-4 84 L58 14 L72 14 L10 84Z" fill="#fff" opacity=".3"/><path d="M18 96 L80 26 L85 26 L23 96Z" fill="#fff" opacity=".35"/><path d="M40 98 L100 30 L100 44 L52 98Z" fill="#ffd1f0" opacity=".25"/>`;
  } else if (s.fx === 'gold') {
    fxIn = `<path d="M0 78 L56 18 L68 18 L12 78Z" fill="#fffbe0" opacity=".4"/><path d="M22 92 L84 26 L88 26 L26 92Z" fill="#fff" opacity=".5"/>`;
  } else if (s.fx === 'rainbow') {
    fxIn = `<path d="M-2 80 L58 16 L70 16 L10 80Z" fill="#fff" opacity=".25"/>`;
  } else if (s.fx === 'diamond') {
    fxIn = `<path d="M50 24 L74 50 L50 76 L26 50Z" fill="#fff" opacity=".22"/><path d="M50 24 L74 50 L50 50Z M26 50 L50 76 L50 50Z" fill="#fff" opacity=".22"/><path d="M14 40 L38 18 L44 18 L18 46Z" fill="#fff" opacity=".45"/>` + sqSpark(64, 66, 3.4, '#fff') + sqSpark(36, 76, 2.2, '#fff');
  } else if (s.fx === 'fire') {
    ndef = `<radialGradient id="${g}n">${st([[0, '#fff3a0', 0.85], [0.6, '#ffc94d', 0.35], [1, '#ffc94d', 0]])}</radialGradient>`;
    fxIn = `<ellipse cx="50" cy="88" rx="34" ry="20" fill="url(#${g}n)"/>`;
    fxBack = [[16, 46, 2.2], [84, 40, 1.8], [24, 22, 1.4], [78, 18, 2], [90, 62, 1.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${r > 1.6 ? '#ffb238' : '#ff6a2b'}" opacity=".85"/>`).join('');
  } else if (s.fx === 'glow') {
    ndef = `<radialGradient id="${g}n">${st([[0.5, s.c1, 0.6], [1, s.c1, 0]])}</radialGradient>`;
    fxBack = `<circle cx="50" cy="56" r="49" fill="url(#${g}n)"/>`;
  }
  const sheen = opts.shiny ? `<path d="M-6 70 L50 10 L62 10 L6 70Z" fill="#fff" opacity=".4"/><path d="M8 84 L66 22 L70 22 L12 84Z" fill="#fffbd6" opacity=".55"/>` : '';
  const lightDef = `<radialGradient id="${g}o" gradientUnits="userSpaceOnUse" cx="52" cy="60" r="46" fx="34" fy="38">${st([[0, '#fff', 0.3 * shadeK], [0.34, '#fff', 0], [0.7, SQ_SHADE, 0], [1, SQ_SHADE, 0.34 * shadeK]])}</radialGradient>`;
  const shadowDef = `<radialGradient id="${g}s">${st([[0, SQ_SHADE, 0.3], [1, SQ_SHADE, 0]])}</radialGradient>`;
  const auraC = sqLum(A) < 110 ? s.c1 : A;
  const aura = s.r === 'U' ? `<radialGradient id="${g}a">${st([[0.42, '#fff6b0', 0.95], [0.74, auraC, 0.45], [1, auraC, 0]])}</radialGradient>` : '';
  const acc = s.acc && ACCESSORIES[s.acc] ? ACCESSORIES[s.acc](art.top ?? 28, s, g, C) : '';
  const defs = `<defs>${aura}${fills[s.fx] || sqClayGrad(g, s.c1)}${lightDef}${shadowDef}${ndef}${cdefs}<clipPath id="${g}k">${bodyShapes}</clipPath></defs>`;
  const wrap = s.acc === 'mummy' ? acc : ''; // bandages wrap the body, so they sit under the light
  const lit = `<g clip-path="url(#${g}k)">${fxIn}${art.inner || ''}${wrap}<rect x="0" y="0" width="100" height="100" fill="url(#${g}o)"/>${sheen}${glossEl}</g>`;
  const rimEl = rimEls ? `<g fill="${rim}" stroke="${rim}" stroke-width="2.2" stroke-linejoin="round">${rimEls.replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${+w + 2.2}"`)}</g>` : '';

  const rare = ['L', 'M', 'U'].includes(s.r) || s.fx === 'gold' || opts.shiny;
  const sparkles = rare ? sqSpark(84, 22, 7, '#fff6c2', 'spk') + sqSpark(15, 32, 4.6, '#fff6c2', 'spk s2') + (opts.shiny ? sqSpark(86, 80, 3.6, '#ffffff', 'spk s2') : '') : '';
  const auraEl = aura ? `<circle class="aura" cx="50" cy="56" r="50" fill="url(#${g}a)"/>` : '';
  return `<svg class="sq-svg${opts.cls ? ' ' + opts.cls : ''}${opts.shiny ? ' is-shiny' : ''}" viewBox="0 0 100 100" role="img" aria-label="${esc(s.name)}">${defs}${auraEl}${fxBack}<ellipse cx="50" cy="94.5" rx="32" ry="5" fill="url(#${g}s)"/>${rimEl}${back}${body}${lit}${front}${art.over || ''}${face}${wrap ? '' : acc}${sparkles}</svg>`;
}
const rarityDots = (r) => `<span class="rdots" title="Trade value">${'◆'.repeat(Math.max(1, ALL_TIERS.indexOf(r) + 1))}</span>`;
const rarityPill = (r) => `<span class="rar rar-${r}">${RARITY[r].name}</span>`;

/* =========================================================
   Ownership, boxes, shop
   ========================================================= */
const myItems = (who) => state.squish.items.filter((i) => i.who === who);
const ownsSid = (who, sid) => state.squish.items.some((i) => i.who === who && i.sid === sid);
function lockedIds() {
  const ids = new Set();
  for (const t of state.squish.trades) if (['offered', 'accepted'].includes(t.status)) for (const id of [...t.give, ...t.get]) ids.add(id);
  if (typeof friendLockedIds === 'function') for (const id of friendLockedIds()) ids.add(id);
  return ids;
}
function giveSquishy(who, sid, from, extra = {}) {
  const isNew = !ownsSid(who, sid);
  const item = { id: uid(), who, sid, at: Date.now(), from, ...extra };
  state.squish.items.push(item);
  if (isNew) checkSetBonus(who, SQ[sid].set);
  return { item, isNew };
}
function checkSetBonus(who, set) {
  const all = SQUISHIES.filter((s) => s.set === set);
  if (all.length && !all.some((s) => s.r === 'U') && all.every((s) => ownsSid(who, s.id))) {
    if (gemLog(who, 100, `Completed ${SETS[set][1]}! 🏆`, 'bonus', 'set:' + set)) setTimeout(() => { confetti(); celebrate(`🏆 ${SETS[set][1]} complete!`, `+100 ${GEM} bonus for finishing the set`); }, 1600);
  }
}
const BOXES = {
  free: { name: 'Daily Free Box', emoji: '🎁', cost: 0, odds: { C: 70, R: 24, E: 5, L: 0.9, M: 0.1 }, pity: 0 },
  basic: { name: 'Mystery Box', emoji: '📦', cost: 25, odds: { C: 60, R: 27, E: 9.5, L: 3, M: 0.5 }, pity: 5, pityTier: 'R' },
  deluxe: { name: 'Deluxe Box', emoji: '💝', cost: 75, odds: { C: 0, R: 60, E: 28, L: 10, M: 2 }, pity: 8, pityTier: 'L' },
  dust: { name: 'Star Dust Box', emoji: '💫', cost: 0, odds: { C: 0, R: 70, E: 22, L: 7, M: 1 }, pity: 0, hidden: true, shiny: 0.03 },
  squish: { name: 'Mystery Box', emoji: '🤏', cost: 0, odds: { C: 60, R: 27, E: 9.5, L: 3, M: 0.5 }, pity: 0, hidden: true },
};
const pityOf = (who, box) => state.squish.pity[`${who}:${box}`] || 0;
function rollTier(box, who) {
  const b = BOXES[box];
  if (b.pity && pityOf(who, box) >= b.pity - 1) {
    // Guarantee: pick from the pity tier or better, using the box's odds among those tiers.
    const ok = TIERS.slice(TIERS.indexOf(b.pityTier));
    return pickWeighted(ok.map((t) => [t, b.odds[t]]));
  }
  return pickWeighted(TIERS.map((t) => [t, b.odds[t]]));
}
function pickWeighted(pairs) {
  const total = sum(pairs, ([, w]) => w);
  let x = Math.random() * total;
  for (const [k, w] of pairs) { if ((x -= w) < 0) return k; }
  return pairs.at(-1)[0];
}
// Which squishies a box (or the shop / fusing) can give. collect.js adds seasons, Niddos and Ultimates.
function boxPool(box) { return SQUISHIES.filter((s) => s.kind === 'squishy' && !s.season && s.r !== 'U'); }
function shopPool() { return boxPool('basic'); }
function pickFromPool(pool, tier) {
  for (let i = TIERS.indexOf(tier); i >= 0; i--) { const xs = pool.filter((s) => s.r === TIERS[i]); if (xs.length) return xs[Math.floor(Math.random() * xs.length)]; }
  return pool[Math.floor(Math.random() * pool.length)];
}
function openBox(box) {
  const who = actor();
  if (!who) { toast('Pick who you are first 👆'); return; }
  const b = BOXES[box];
  if (box === 'free') {
    if (state.squish.free[who] === today()) { toast('Come back tomorrow for another free box! 🌙'); return; }
    state.squish.free[who] = today();
  } else if (box === 'squish') {
    if (!(state.squish.sqBank?.[who] > 0)) { toast('Squish 100 times to earn a Mystery Box 🤏'); return; }
    state.squish.sqBank[who] -= 1;
  } else if (box === 'dust') {
    if ((state.squish.dust?.[who] || 0) < DUST_GOAL) { toast(`Collect ${DUST_GOAL} 💫 Star Dust first`); return; }
    state.squish.dust[who] -= DUST_GOAL;
  } else if (!spendGems(who, b.cost, `${b.name}`, 'squish')) return;
  const tier = rollTier(box, who);
  if (b.pity) { const k = `${who}:${box}`; state.squish.pity[k] = TIERS.indexOf(tier) >= TIERS.indexOf(b.pityTier) ? 0 : pityOf(who, box) + 1; }
  const s = pickFromPool(boxPool(box), tier);
  const shiny = Math.random() < (b.shiny ?? 0.02);
  const { item, isNew } = giveSquishy(who, s.id, box, shiny ? { shiny: true } : {});
  // Duplicates aren't wasted: they turn into Star Dust toward a free box.
  const dust = isNew ? 0 : DUST[s.r] || 1;
  if (dust) { state.squish.dust ||= {}; state.squish.dust[who] = (state.squish.dust[who] || 0) + dust; }
  if (shiny) logAct('✨', `found a SHINY ${s.name}!`, 'squishies');
  if (['L', 'M'].includes(tier)) logAct('🧸', `pulled a ${RARITY[tier].name} ${s.name}!`, 'squishies');
  save();
  boxReveal(b, item, isNew, { dust });
}
const DUST = { C: 1, R: 2, E: 4, L: 8, M: 15 }, DUST_GOAL = 10;
// Rotating shop: four squishies a day, so any squishy can be bought outright eventually.
function shopToday() {
  const n = Math.max(0, daysBetween('2026-01-01', today()));
  const all = shopPool();
  const pick = (tiers, k) => { const pool = all.filter((s) => tiers.includes(s.r)); return pool.length ? pool[(n * 7 + k * 13) % pool.length] : null; };
  const out = [pick(['C'], 1), pick(['C', 'R'], 5), pick(['R'], 2), pick(['E'], 3), pick(['E', 'L'], 6), pick(['L', 'M'], 4)].filter(Boolean);
  return [...new Map(out.map((s) => [s.id, s])).values()];
}

/* =========================================================
   Sound
   ========================================================= */
let actx = null;
function sqSound(kind) {
  if (state.settings.sound === false) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), gn = actx.createGain();
    o.type = 'sine';
    if (kind === 'squish') { o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.18); }
    else if (kind === 'goo') { o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(120, t + 0.3); }
    else if (kind === 'pop') { o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.12); }
    else { o.type = 'triangle'; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.1); o.frequency.setValueAtTime(1320, t + 0.2); }
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.25, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'win' ? 0.45 : kind === 'goo' ? 0.35 : 0.22));
    o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + 0.5);
  } catch { /* no audio */ }
}

/* =========================================================
   Box reveal overlay
   ========================================================= */
function boxReveal(b, item, isNew, extra = {}) {
  const s = SQ[item.sid];
  const el = document.createElement('div');
  el.className = 'box-reveal';
  el.innerHTML = `<div class="br-stage"><button class="br-box" aria-label="Open">${b.emoji}<small>Tap to open!</small></button></div>`;
  document.body.appendChild(el);
  sqSound('pop');
  const open = () => {
    const count = myItems(item.who).filter((i) => i.sid === s.id).length;
    el.classList.add('opened', 'r-' + s.r);
    if (item.shiny) el.classList.add('is-shiny');
    el.innerHTML = `<div class="br-rays"></div><div class="br-card">
      ${isNew ? '<span class="br-new">NEW!</span>' : ''}
      ${item.shiny ? '<div class="br-shiny">✨ SHINY! ✨</div>' : ''}
      <div class="br-sq">${squishySVG(s.id, { shiny: item.shiny })}</div>
      ${rarityPill(s.r)}
      <div class="br-name">${esc(s.name)}</div>
      <div class="small muted">${SETS[s.set] ? `${SETS[s.set][0]} ${SETS[s.set][1]}` : ''}${isNew ? '' : ` · you have ${count}`}</div>
      ${extra.dust ? `<div class="br-dust">💫 +${extra.dust} Star Dust <span>${Math.min(DUST_GOAL, state.squish.dust?.[item.who] || 0)}/${DUST_GOAL}</span>${(state.squish.dust?.[item.who] || 0) >= DUST_GOAL ? '<b>A free Dust Box is ready! 🎉</b>' : ''}</div>` : ''}
      <div class="btn-row" style="justify-content:center"><button class="btn" data-close>Yay!</button>${b.noAgain ? '' : '<button class="btn secondary" data-again>Open another</button>'}</div></div>`;
    sqSound(['L', 'M', 'U'].includes(s.r) || item.shiny ? 'win' : 'pop');
    if (['E', 'L', 'M', 'U'].includes(s.r) || item.shiny) setTimeout(confetti, 200);
    if (typeof isSimple === 'function' && isSimple(item.who) && readAloudOn(item.who)) speak(`You got ${s.name}! ${RARITY[s.r].name}!`);
    el.querySelector('[data-close]').onclick = () => { el.remove(); render(); };
    if (el.querySelector('[data-again]')) el.querySelector('[data-again]').onclick = () => { el.remove(); ui.sqTab = 'get'; render(); setTimeout(() => go('squishies')); };
  };
  let opening = false;
  el.querySelector('.br-stage').onclick = () => { if (opening) return; opening = true; el.querySelector('.br-box').classList.add('shake'); setTimeout(open, 650); };
}

/* =========================================================
   Views
   ========================================================= */
function sqTile(sid, extra = '', attrs = '', o = {}) {
  const s = SQ[sid];
  return `<button class="sq-tile r-${s.r}${o.shiny ? ' shiny' : ''}" ${attrs || `data-action="go" data-to="squishy/${sid}"`}>${squishySVG(sid, { shiny: o.shiny })}<span class="sq-name">${esc(s.name)}</span>${o.shiny ? '<i class="shiny-badge">✨</i>' : ''}${extra}</button>`;
}
function collectionGroups(who) {
  const by = {};
  for (const i of myItems(who)) (by[i.sid] ||= []).push(i);
  return Object.entries(by).sort(([a], [b]) => ALL_TIERS.indexOf(SQ[b].r) - ALL_TIERS.indexOf(SQ[a].r) || SQ[a].name.localeCompare(SQ[b].name));
}
function spares(who) {
  const locked = lockedIds(), out = { C: [], R: [], E: [], L: [], M: [] };
  for (const [sid, items] of collectionGroups(who)) { if (SQ[sid].r === 'U') continue; const free = items.filter((i) => !locked.has(i.id) && !i.fav && !i.shiny); for (const i of free.slice(items.length - free.length === 0 ? 1 : 0)) out[SQ[sid].r].push(i); }
  return out;
}
views.squishies = () => {
  const me = actor();
  if (!me) return needMe() || '<div class="card empty">Pick who you are first.</div>';
  gemWelcome(me);
  const tab = ui.sqTab || 'mine';
  const tabs = [['mine', '🧸', 'Mine'], ['boxes', '🎁', 'Boxes'], ['shop', '🛍️', 'Shop'], ['book', '📖', 'Book'], ...(typeof sqUnlocks === 'function' ? [['unlocks', '👑', 'Unlocks']] : []), ['trades', '🔁', 'Trades']];
  const head = `<div class="sq-head"><button class="gem-pill" data-action="go" data-to="gems">${GEM} <b>${gemBalance(me)}</b></button><span class="small muted">${new Set(myItems(me).map((i) => i.sid)).size}/${SQUISHIES.length} collected</span></div>
    <div class="sq-tabs">${tabs.map(([k, e, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="sq-tab" data-tab="${k}"><span>${e}</span>${l}${k === 'trades' && tradeInbox(me).length ? `<i class="tab-badge">${tradeInbox(me).length}</i>` : ''}${k === 'boxes' && state.squish.free[me] !== today() ? '<i class="tab-badge">1</i>' : ''}</button>`).join('')}</div>`;
  return head + ({ mine: sqMine, boxes: sqBoxes, shop: sqShop, book: sqBook, unlocks: typeof sqUnlocks === 'function' ? sqUnlocks : sqMine, trades: sqTrades }[tab] || sqMine)(me);
};
function sqMine(me) {
  const groups = collectionGroups(me);
  if (!groups.length) return `<div class="card empty"><span class="big">🧸</span>No squishies yet!<br><button class="btn" style="margin-top:12px" data-action="sq-tab" data-tab="boxes">🎁 Open your free box</button></div>`;
  const sp = spares(me);
  const fusable = TIERS.slice(0, -1).filter((t) => sp[t].length >= 3);
  return `${fusable.length ? `<button class="card fuse-cta" data-action="sq-fuse"><span>🔮</span><div><b>Fuse your spares!</b><small>3 spare ${fusable.map((t) => RARITY[t].name).join(' / ')} → 1 rarer squishy</small></div></button>` : ''}
    ${(() => {
      const f = ui.sqFilter || 'all';
      const has = (fn) => groups.some(([sid, items]) => fn(SQ[sid], items));
      const chips = [['all', 'All', true], ['squishy', '🧸 Squishies', true], ['niddo', '🫧 Niddos', has((x) => x.kind === 'niddo')], ['shiny', '✨ Shiny', has((x, items) => items.some((i) => i.shiny))], ['U', '👑 Ultimate', has((x) => x.r === 'U')]].filter(([, , ok]) => ok);
      const show = groups.filter(([sid, items]) => f === 'all' || (f === 'shiny' ? items.some((i) => i.shiny) : f === 'U' ? SQ[sid].r === 'U' : SQ[sid].kind === f));
      return `${chips.length > 2 ? `<div class="sq-filters">${chips.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-action="sq-filter" data-f="${k}">${l}</button>`).join('')}</div>` : ''}
        <div class="sq-grid">${show.map(([sid, items]) => sqTile(sid, `${items.length > 1 ? `<i class="sq-count">×${items.length}</i>` : ''}${items.some((i) => i.fav) ? '<i class="sq-fav">⭐</i>' : ''}`, '', { shiny: items.some((i) => i.shiny) })).join('') || '<div class="small muted">Nothing here yet</div>'}</div>`;
    })()}`;
}
const tradeable = (i) => SQ[i.sid] && SQ[i.sid].r !== 'U';
function sqBoxes(me) {
  const freeUsed = state.squish.free[me] === today();
  const odds = (b) => TIERS.filter((t) => b.odds[t]).map((t) => `<span class="rar rar-${t}">${RARITY[t].name} ${b.odds[t]}%</span>`).join('');
  return Object.entries(BOXES).map(([k, b]) => `<div class="card box-card box-${k}">
      <div class="box-emoji">${b.emoji}</div>
      <div class="grow"><b>${b.name}</b><div class="small muted">${k === 'free' ? (freeUsed ? 'Opened today — back tomorrow!' : 'One free box every day') : `${b.cost} ${GEM}`}${b.pity ? ` · ${RARITY[b.pityTier].name}+ guaranteed within ${b.pity} boxes (${b.pity - pityOf(me, k)} to go)` : ''}</div>
        <details class="odds"><summary>See the odds</summary><div class="odds-list">${odds(b)}</div></details></div>
      <button class="btn${k === 'free' && freeUsed ? ' secondary' : ''}" data-action="sq-open" data-box="${k}" ${k === 'free' && freeUsed ? 'disabled' : ''}>${k === 'free' ? 'Open' : `${GEM} ${b.cost}`}</button>
    </div>`).join('') + `<p class="small muted" style="margin:6px 4px">Boxes are a surprise! Want a certain squishy? Check the 🛍️ Shop — it changes every day.</p>`;
}
function sqShop(me) {
  return `<p class="small muted" style="margin:0 4px 10px">New squishies every day. Buy exactly the one you want.</p>
    <div class="sq-grid shop">${shopToday().map((s) => sqTile(s.id, `<span class="price">${GEM} ${RARITY[s.r].price}</span>${ownsSid(me, s.id) ? '<i class="sq-count">✓</i>' : ''}`, `data-action="sq-buy" data-sid="${s.id}"`)).join('')}</div>
    <div class="section-title">Prices</div><div class="card odds-list" style="padding:12px">${TIERS.map((t) => `<span class="rar rar-${t}">${RARITY[t].name} · ${RARITY[t].price} ${GEM}</span>`).join('')}</div>`;
}
function sqBook(me) {
  return Object.entries(SETS).map(([k, [e, name]]) => {
    const all = SQUISHIES.filter((s) => s.set === k), got = all.filter((s) => ownsSid(me, s.id)).length;
    return `<div class="section-title">${e} ${name}<span class="small" style="text-transform:none">${got}/${all.length}${got === all.length ? ' 🏆' : ' · +100 💎 when complete'}</span></div>
      <div class="sq-grid book">${all.map((s) => ownsSid(me, s.id) ? sqTile(s.id) : `<div class="sq-tile missing r-${s.r}">${squishySVG(s.id, { cls: 'shadow' })}<span class="sq-name">???</span></div>`).join('')}</div>`;
  }).join('');
}
views.squishy = (sid) => {
  const s = SQ[sid];
  if (!s) return '<div class="card empty">Squishy not found.</div>';
  const me = actor();
  const mine = me ? myItems(me).filter((i) => i.sid === sid) : [];
  const squishes = sum(mine, (i) => i.sq || 0);
  const shinyN = mine.filter((i) => i.shiny).length, niddo = s.kind === 'niddo', ult = s.r === 'U';
  const unlock = ult && typeof ultimateInfo === 'function' ? ultimateInfo(s) : null;
  return `<div class="sq-stage r-${s.r}${shinyN ? ' shiny' : ''}"><button class="sq-big${niddo ? ' nd-big' : ''}" ${niddo ? `data-nd="${sid}"` : `data-action="sq-squish" data-sid="${sid}"`} aria-label="${niddo ? 'Squeeze' : 'Squish'}">${squishySVG(sid, { shiny: shinyN > 0 })}</button>
      <div class="sq-title">${shinyN ? '✨ ' : ''}${esc(s.name)}</div>${rarityPill(s.r)}
      <div class="small muted" style="margin-top:6px">${SETS[s.set] ? `${SETS[s.set][0]} ${SETS[s.set][1]}` : ''}${ult ? '' : ` · ${rarityDots(s.r)}`}${s.blurb ? `<br>${esc(s.blurb)}` : ''}</div>
      ${mine.length ? `<div class="sq-squishes">${niddo ? 'Squeezed' : 'Squished'} <b class="sq-n">${squishes}</b> times · ${niddo ? 'press & hold to squeeze!' : 'tap to squish!'}</div>` : `<div class="sq-squishes">${unlock ? `🔒 ${esc(unlock.how)}` : 'You don’t have this one yet'}</div>`}
    </div>
    ${mine.length ? `<div class="btn-row"><button class="btn secondary" data-action="sq-fav" data-sid="${sid}">${mine.some((i) => i.fav) ? '⭐ Favorite' : '☆ Make favorite'}</button>${ult ? '' : `<button class="btn secondary" data-action="sq-trade-new" data-sid="${sid}">🔁 Trade</button>`}</div>
      <p class="small muted" style="text-align:center">${ult ? '👑 Earned — Ultimates can’t be traded or fused.' : `You have ${mine.length}${shinyN ? ` (${shinyN} ✨ shiny)` : ''}${mine.length > 1 ? ` — ${mine.length - 1} spare` : ''}. Favorites and shinies won’t be fused.`}</p>` : ult ? `<button class="btn block" data-action="sq-tab-go" data-tab="unlocks">👑 See how to unlock</button>` : `<button class="btn block" data-action="sq-tab-go" data-tab="shop">🛍️ Check the shop</button>`}`;
};

/* =========================================================
   Fusing
   ========================================================= */
function fuseSheet() {
  const me = actor(), sp = spares(me);
  const tiers = TIERS.slice(0, -1).filter((t) => sp[t].length >= 3);
  if (!tiers.length) { toast('You need 3 spares of the same rarity'); return; }
  openSheet({
    title: '🔮 Fuse squishies',
    saveLabel: 'Fuse!',
    values: { tier: tiers[0] },
    fields: [
      { name: 'tier', label: 'Fuse 3 spares of…', type: 'select', options: tiers.map((t) => ({ value: t, label: `${RARITY[t].name} (${sp[t].length} spare) → 1 ${RARITY[TIERS[TIERS.indexOf(t) + 1]].name}` })) },
      { type: 'html', html: '<p class="small muted" style="margin:0 4px">Spares are extra copies. You always keep at least one of each squishy, and your ⭐ favorites are never used.</p>' },
    ],
    onSave(v) {
      const used = sp[v.tier].slice(0, 3).map((i) => i.id);
      state.squish.items = state.squish.items.filter((i) => !used.includes(i.id));
      const next = TIERS[TIERS.indexOf(v.tier) + 1];
      const s = pickFromPool(boxPool('basic'), next);
      const { item, isNew } = giveSquishy(me, s.id, 'fuse');
      logAct('🔮', `fused 3 squishies into ${s.name}`, 'squishies');
      setTimeout(() => boxReveal({ emoji: '🔮' }, item, isNew), 50);
    },
  });
}

/* =========================================================
   Trading inside the family
   ========================================================= */
const tradeInbox = (me) => state.squish.trades.filter((t) => t.to === me && t.status === 'offered').concat(typeof friendTradeInbox === 'function' ? friendTradeInbox(me) : []);
const worth = (ids) => sum(ids, (id) => { const i = state.squish.items.find((x) => x.id === id); return i ? RARITY[SQ[i.sid].r].value * (i.shiny ? 2 : 1) : 0; });
function tradePicker(name, items, picked) {
  return `<div class="pick-grid">${items.filter(tradeable).map((i) => `<label class="pick r-${SQ[i.sid].r}${i.shiny ? ' shiny' : ''}"><input type="checkbox" name="${name}" value="${i.id}" ${picked.includes(i.id) ? 'checked' : ''}>${squishySVG(i.sid, { shiny: i.shiny })}<span>${i.shiny ? '✨ ' : ''}${esc(SQ[i.sid].name)}</span></label>`).join('') || '<div class="small muted">No squishies</div>'}</div>`;
}
function familyTradeSheet(preSid, preTo) {
  const me = actor();
  const others = state.members.filter((m) => m.id !== me && myItems(m.id).length);
  if (!others.length) { toast('Nobody else in the family has squishies yet'); return; }
  const to = preTo && others.some((m) => m.id === preTo) ? preTo : others[0].id;
  const locked = lockedIds();
  const mine = myItems(me).filter((i) => !locked.has(i.id));
  const pre = preSid ? mine.filter((i) => i.sid === preSid).slice(-1).map((i) => i.id) : [];
  openSheet({
    title: '🔁 Trade squishies',
    saveLabel: 'Send offer',
    values: { to },
    fields: [
      { name: 'to', label: 'Trade with', type: 'select', options: others.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` })) },
      { type: 'html', html: `<div class="small muted pick-label">I give</div>${tradePicker('give', mine, pre)}<div class="small muted pick-label">I want</div><div id="wantBox">${tradePicker('get', myItems(to).filter((i) => !locked.has(i.id)), [])}</div><div class="fair" id="fairMeter"></div>` },
    ],
    onInput(form, e) {
      if (e.target.name === 'to') $('#wantBox').innerHTML = tradePicker('get', myItems(e.target.value).filter((i) => !locked.has(i.id)), []);
      fairMeter(form);
    },
    onSave(v) {
      const f = $('#sheetForm');
      const give = [...f.querySelectorAll('[name="give"]:checked')].map((x) => x.value), get = [...f.querySelectorAll('[name="get"]:checked')].map((x) => x.value);
      if (!give.length && !get.length) { toast('Pick at least one squishy'); return false; }
      state.squish.trades.push({ id: uid(), at: Date.now(), from: me, to: v.to, give, get, status: 'offered' });
      logAct('🔁', `offered ${whoName(v.to)} a squishy trade`, 'squishies');
      toast(`🔁 Offer sent to ${whoName(v.to)}!`);
    },
  });
  setTimeout(() => fairMeter($('#sheetForm')));
}
function fairMeter(form) {
  const el = $('#fairMeter'); if (!el) return;
  const give = [...form.querySelectorAll('[name="give"]:checked')].map((x) => x.value), get = [...form.querySelectorAll('[name="get"]:checked')].map((x) => x.value);
  const a = worth(give), b = worth(get);
  el.innerHTML = !a && !b ? '' : `<div class="fair-bar"><i style="width:${(a / Math.max(1, a + b)) * 100}%"></i></div><div class="small">${a === b ? '⚖️ Fair trade!' : a > b ? `🎁 You’re giving more (${a} vs ${b})` : `🤔 You’re asking for more (${b} vs ${a})`}${!get.length && give.length ? ' — that’s a gift! 💝' : ''}</div>`;
}
function tradeCard(t) {
  const me = actor();
  const items = (ids) => ids.map((id) => state.squish.items.find((i) => i.id === id)).filter(Boolean);
  const row = (ids) => `<div class="trade-items">${items(ids).map((i) => `<span class="ti r-${SQ[i.sid].r}">${squishySVG(i.sid)}</span>`).join('') || '<span class="small muted">nothing</span>'}</div>`;
  const label = { offered: t.to === me ? 'wants to trade with you' : `offer to ${whoName(t.to)}`, done: 'traded ✓', declined: 'declined', cancelled: 'cancelled', failed: 'couldn’t finish' }[t.status] || t.status;
  return `<div class="card trade-card">
    <div class="small"><b>${esc(whoName(t.from))}</b> ${label} · ${timeAgo(t.at)}</div>
    <div class="trade-swap"><div><div class="small muted">${esc(whoName(t.from))} gives</div>${row(t.give)}</div><span class="swap-arrow">⇄</span><div><div class="small muted">${esc(whoName(t.to))} gives</div>${row(t.get)}</div></div>
    ${t.status === 'offered' && t.to === me ? `<div class="btn-row"><button class="btn secondary" data-action="sq-trade-no" data-id="${t.id}">No thanks</button><button class="btn" data-action="sq-trade-yes" data-id="${t.id}">✅ Accept</button></div>` : ''}
    ${t.status === 'offered' && t.from === me ? `<button class="mini-btn" data-action="sq-trade-cancel" data-id="${t.id}">Cancel offer</button>` : ''}
  </div>`;
}
function sqTrades(me) {
  const mine = state.squish.trades.filter((t) => t.from === me || t.to === me).sort((a, b) => (b.status === 'offered') - (a.status === 'offered') || b.at - a.at).slice(0, 20);
  return `<button class="btn block" data-action="sq-trade-new">🔁 New family trade</button>
    ${typeof friendTradesHTML === 'function' ? friendTradesHTML(me) : ''}
    ${mine.length ? `<div class="section-title">Family trades</div>${mine.map(tradeCard).join('')}` : '<p class="small muted" style="margin:10px 4px">Swap spares with your brother, sister or parents. Both of you have to say yes.</p>'}`;
}
function doFamilyTrade(t) {
  const find = (id) => state.squish.items.find((i) => i.id === id);
  const ok = t.give.every((id) => find(id)?.who === t.from) && t.get.every((id) => find(id)?.who === t.to);
  if (!ok) { t.status = 'failed'; toast('Some of those squishies aren’t there anymore'); return; }
  for (const id of t.give) { const i = find(id); i.who = t.to; delete i.fav; i.from = 'trade'; }
  for (const id of t.get) { const i = find(id); i.who = t.from; delete i.fav; i.from = 'trade'; }
  t.status = 'done'; t.doneAt = Date.now();
  for (const id of [...t.give, ...t.get]) { const i = find(id); if (i) checkSetBonus(i.who, SQ[i.sid].set); }
  logAct('🔁', `traded squishies with ${whoName(t.from === actor() ? t.to : t.from)}`, 'squishies');
  confetti();
}

/* =========================================================
   Kid home, More grid, inbox, actions
   ========================================================= */
const _kidViewS = views.kid;
views.kid = () => {
  const html = _kidViewS();
  const id = kidModeId();
  if (!id) return html;
  const n = new Set(myItems(id).map((i) => i.sid)).size, fav = myItems(id).find((i) => i.fav) || myItems(id).at(-1);
  const free = state.squish.free[id] !== today();
  const card = `<button class="card sq-banner" data-action="go" data-to="squishies"><div class="sqb-art">${fav ? squishySVG(fav.sid) : '<span style="font-size:48px">🎁</span>'}</div>
    <div class="grow"><b>My Squishies</b><div class="small">${n}/${SQUISHIES.length} collected</div><div class="sqb-gems">${GEM} ${gemBalance(id)} <small>game gems</small></div></div>${free ? '<span class="sqb-free">🎁 Free box!</span>' : ''}</button>`;
  const at = html.search(/<div class="section-title">(Family fun|Family)<\/div>/);
  return at < 0 ? html + card : html.slice(0, at) + card + html.slice(at);
};
const _moreGridS = moreGrid;
moreGrid = function () {
  const me = actor();
  const tile = (to, emoji, label, sub) => `<button class="card mini-tile" data-action="go" data-to="${to}"><div class="emoji">${emoji}</div><b>${label}</b><div class="small muted">${sub}</div></button>`;
  return `<div class="more-label">Play & collect</div><div class="grid3">
    ${tile('squishies', '🧸', 'Squishies', me ? `${new Set(myItems(me).map((i) => i.sid)).size}/${SQUISHIES.length}` : 'Collect')}
    ${tile('gems', GEM, 'Gems', me ? `${gemBalance(me)}` : 'Wallets')}
    ${typeof views.friends === 'function' ? tile('friends', '👯', 'Friends', 'Circle') : ''}
  </div>` + _moreGridS();
};
const _inboxItemsS = inboxItems;
inboxItems = function () {
  const items = _inboxItemsS(), me = actor();
  if (me) for (const t of state.squish.trades.filter((t) => t.to === me && t.status === 'offered')) items.unshift({ n: 1, icon: '🔁', title: `${whoName(t.from)} wants to trade squishies`, sub: 'Tap to see the offer', to: 'squishies', sqTab: 'trades' });
  if (me && state.squish.free[me] !== today()) items.push({ n: 0, icon: '🎁', title: 'Free squishy box', sub: 'Open one free box every day', to: 'squishies', nudge: true, sqTab: 'boxes' });
  return items;
};
KID_ROUTES.push('squishies', 'squishy');
for (const a of ['sq-filter', 'sq-tab', 'sq-tab-go', 'sq-open', 'sq-buy', 'sq-squish', 'sq-fav', 'sq-fuse', 'sq-trade-new', 'sq-trade-yes', 'sq-trade-no', 'sq-trade-cancel']) KID_ACTIONS.add(a);

let squishSaveT;
Object.assign(actions, {
  'sq-tab': (el) => { ui.sqTab = el.dataset.tab; render(); },
  'sq-filter': (el) => { ui.sqFilter = el.dataset.f; render(); },
  'sq-tab-go': (el) => { ui.sqTab = el.dataset.tab; go('squishies'); },
  'sq-open': (el) => openBox(el.dataset.box),
  'sq-buy': (el) => {
    const me = actor(), s = SQ[el.dataset.sid], price = RARITY[s.r].price;
    if (!me) { toast('Pick who you are first'); return; }
    openSheet({
      title: `Buy ${s.name}?`,
      saveLabel: `${GEM} ${price}`,
      values: {},
      fields: [{ type: 'html', html: `<div class="buy-preview r-${s.r}">${squishySVG(s.id)}<div>${rarityPill(s.r)}<div class="small muted" style="margin-top:6px">You have ${gemBalance(me)} ${GEM}${ownsSid(me, s.id) ? ' · you already own one' : ''}</div></div></div>` }],
      onSave() {
        if (!spendGems(me, price, `Bought ${s.name}`, 'squish')) return false;
        const { item, isNew } = giveSquishy(me, s.id, 'shop');
        const dust = isNew || s.r === 'U' ? 0 : DUST[s.r] || 1;
        if (dust) { state.squish.dust ||= {}; state.squish.dust[me] = (state.squish.dust[me] || 0) + dust; save(); }
        setTimeout(() => boxReveal({ emoji: '🛍️' }, item, isNew, { dust }), 60);
      },
    });
  },
  'sq-squish': (el) => {
    const me = actor(), sid = el.dataset.sid;
    el.classList.remove('squishing'); void el.offsetWidth; el.classList.add('squishing');
    sqSound('squish');
    haptic();
    const mine = me ? myItems(me).filter((i) => i.sid === sid) : [];
    if (!mine.length) return;
    mine[0].sq = (mine[0].sq || 0) + 1;
    const n = $('.sq-n'); if (n) n.textContent = sum(mine, (i) => i.sq || 0);
    if (typeof squishReward === 'function') squishReward(me, 1);
    clearTimeout(squishSaveT); squishSaveT = setTimeout(save, 800);
  },
  'sq-fav': (el) => { const me = actor(); const mine = myItems(me).filter((i) => i.sid === el.dataset.sid); const on = !mine.some((i) => i.fav); for (const i of mine) delete i.fav; if (on) mine[0].fav = true; save(); render(); },
  'sq-fuse': () => fuseSheet(),
  'sq-trade-new': (el) => familyTradeSheet(el.dataset.sid, el.dataset.to),
  'sq-trade-yes': (el) => { const t = findIn(state.squish.trades, el.dataset.id); if (t.status === 'offered' && t.to === actor()) { doFamilyTrade(t); save(); render(); } },
  'sq-trade-no': (el) => { const t = findIn(state.squish.trades, el.dataset.id); t.status = 'declined'; save(); render(); },
  'sq-trade-cancel': (el) => { const t = findIn(state.squish.trades, el.dataset.id); t.status = 'cancelled'; save(); render(); },
});
// Inbox rows can open a specific Squishies tab.
document.addEventListener('click', (e) => { const el = e.target.closest('[data-sq-tab]'); if (el) ui.sqTab = el.dataset.sqTab; }, true);
