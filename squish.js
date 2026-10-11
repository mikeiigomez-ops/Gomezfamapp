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
function squishySVG(sid, opts = {}) {
  const s = SQ[sid];
  if (!s) return '';
  if (s.kind === 'niddo' && typeof niddoSVG === 'function') return niddoSVG(s, opts);
  const g = 'sq' + (++svgSeq);
  const ink = '#3a2b3d', blush = '#ff8fab';
  const light = mixHex(s.c1, '#ffffff', 0.55), dark = mixHex(s.c1, '#000000', 0.12);
  const fills = {
    rainbow: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a9e"/><stop offset=".25" stop-color="#fecf7a"/><stop offset=".5" stop-color="#a8e6a1"/><stop offset=".75" stop-color="#8ec5ff"/><stop offset="1" stop-color="#c7a4ff"/></linearGradient>`,
    galaxy: `<radialGradient id="${g}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${mixHex(s.c1, '#ffffff', 0.35)}"/><stop offset=".6" stop-color="${s.c1}"/><stop offset="1" stop-color="#140f33"/></radialGradient>`,
    gold: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="${s.c1}"/><stop offset="1" stop-color="#d4890b"/></linearGradient>`,
    holo: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".35" stop-color="#ffe3f6"/><stop offset=".65" stop-color="#d9f3ff"/><stop offset="1" stop-color="${s.c1}"/></linearGradient>`,
    fire: `<linearGradient id="${g}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d2e"/><stop offset=".6" stop-color="${s.c1}"/><stop offset="1" stop-color="#ffc94d"/></linearGradient>`,
    glow: `<radialGradient id="${g}" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${s.c1}"/></radialGradient>`,
    diamond: `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#c9f6ff"/><stop offset=".55" stop-color="${s.c1}"/><stop offset=".75" stop-color="#e8d9ff"/><stop offset="1" stop-color="#8fd8ff"/></linearGradient>`,
  };
  const aura = s.r === 'U' ? `<radialGradient id="${g}a"><stop offset=".45" stop-color="#fff6b0" stop-opacity=".95"/><stop offset=".75" stop-color="${s.c2}" stop-opacity=".45"/><stop offset="1" stop-color="${s.c2}" stop-opacity="0"/></radialGradient>` : '';
  const defs = `<defs>${aura}${fills[s.fx] || `<radialGradient id="${g}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${light}"/><stop offset=".7" stop-color="${s.c1}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`}</defs>`;
  const F = `url(#${g})`, A = s.c2;
  let back = '', body = '', front = '', fy = 62, art = {}; // face y
  const ear = (pts, fill) => `<path d="${pts}" fill="${fill}" stroke="${fill}" stroke-width="5" stroke-linejoin="round"/>`;
  const round = (rx = 36, ry = 32, cy = 60) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${F}"/>`;
  switch (s.sp) {
    case 'cat': back = ear('M20 46 L25 16 L44 34Z', F) + ear('M80 46 L75 16 L56 34Z', F) + ear('M25 38 L27 24 L36 33Z', blush) + ear('M75 38 L73 24 L64 33Z', blush); body = round(); break;
    case 'bunny': back = `<ellipse cx="36" cy="24" rx="9" ry="22" fill="${F}" transform="rotate(-12 36 24)"/><ellipse cx="64" cy="24" rx="9" ry="22" fill="${F}" transform="rotate(12 64 24)"/><ellipse cx="36" cy="26" rx="4" ry="14" fill="${A}" transform="rotate(-12 36 26)"/><ellipse cx="64" cy="26" rx="4" ry="14" fill="${A}" transform="rotate(12 64 26)"/>`; body = round(35, 31, 62); fy = 64; break;
    case 'bear': back = `<circle cx="24" cy="36" r="11" fill="${F}"/><circle cx="76" cy="36" r="11" fill="${F}"/><circle cx="24" cy="36" r="5.5" fill="${A}"/><circle cx="76" cy="36" r="5.5" fill="${A}"/>`; body = round(); front = `<ellipse cx="50" cy="70" rx="12" ry="8" fill="${A}"/>`; break;
    case 'frog': back = `<circle cx="32" cy="36" r="13" fill="${F}"/><circle cx="68" cy="36" r="13" fill="${F}"/>`; body = round(38, 30, 62); front = `<ellipse cx="50" cy="78" rx="18" ry="8" fill="${A}" opacity=".8"/>`; fy = 0; break;
    case 'penguin': body = `<ellipse cx="50" cy="58" rx="32" ry="36" fill="${F}"/>`; front = `<ellipse cx="50" cy="66" rx="22" ry="25" fill="${A}"/><ellipse cx="38" cy="93" rx="7" ry="3.5" fill="#ffad33"/><ellipse cx="62" cy="93" rx="7" ry="3.5" fill="#ffad33"/><path d="M47 66 L53 66 L50 70Z" fill="#ffad33"/>`; fy = 58; break;
    case 'fox': back = ear('M18 48 L20 12 L44 32Z', F) + ear('M82 48 L80 12 L56 32Z', F) + ear('M21 22 L20 13 L28 19Z', A) + ear('M79 22 L80 13 L72 19Z', A); body = round(); front = `<path d="M18 66 Q30 84 50 80 Q70 84 82 66 Q76 92 50 92 Q24 92 18 66Z" fill="${A}"/>`; break;
    case 'dumpling': body = `<path d="M12 70 Q12 40 50 34 Q88 40 88 70 Q88 88 50 88 Q12 88 12 70Z" fill="${F}"/>`; front = [38, 46, 54, 62].map((x, i) => `<path d="M${x} 36 Q${x + (i < 2 ? -3 : 3)} 44 ${x + (i < 2 ? -1 : 1)} 50" stroke="${A}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join(''); fy = 68; break;
    case 'peach': back = `<path d="M50 30 Q60 14 74 20 Q64 32 50 30Z" fill="${A}"/>`; body = `<path d="M50 30 C18 26 8 62 22 78 C34 92 66 92 78 78 C92 62 82 26 50 30Z" fill="${F}"/>`; front = `<path d="M50 32 Q42 48 46 62" stroke="${dark}" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>`; fy = 66; break;
    case 'berry': body = `<path d="M50 90 C26 82 12 62 15 46 C18 33 32 30 50 32 C68 30 82 33 85 46 C88 62 74 82 50 90Z" fill="${F}"/>`; back = ear('M30 34 L40 20 L50 30 L60 20 L70 34Z', A); front = [[28, 50], [72, 50], [36, 76], [64, 76], [50, 82], [24, 62], [76, 62]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.4" fill="#fff4b0"/>`).join(''); fy = 56; break;
    case 'cupcake': body = `<path d="M18 64 Q16 40 50 32 Q84 40 82 64Z" fill="${F}"/><path d="M24 62 L76 62 L69 92 L31 92Z" fill="${A}"/>`; front = [36, 44, 52, 60, 68].map((x) => `<path d="M${x} 64 L${x - 1 + (x - 50) * 0.1} 90" stroke="#fff" stroke-width="1.6" opacity=".55"/>`).join('') + `<circle cx="50" cy="28" r="6" fill="#ff4d6d"/><path d="M50 22 Q54 14 60 14" stroke="#5cbf5a" stroke-width="2" fill="none"/>`; fy = 50; break;
    case 'mochi': body = `<path d="M10 74 Q10 40 50 38 Q90 40 90 74 Q90 88 50 88 Q10 88 10 74Z" fill="${F}"/>`; front = `<ellipse cx="50" cy="44" rx="16" ry="4" fill="#ffffff" opacity=".45"/>`; fy = 66; break;
    case 'mushroom': body = `<rect x="28" y="48" width="44" height="44" rx="18" fill="${F}"/>`; back = ''; front = `<path d="M10 56 Q10 16 50 16 Q90 16 90 56 Q70 50 50 50 Q30 50 10 56Z" fill="${A}"/><circle cx="32" cy="32" r="6" fill="#fff" opacity=".9"/><circle cx="58" cy="26" r="4.5" fill="#fff" opacity=".9"/><circle cx="72" cy="40" r="5" fill="#fff" opacity=".9"/>`; fy = 70; break;
    case 'cloud': body = `<g fill="${F}"><circle cx="30" cy="62" r="20"/><circle cx="52" cy="50" r="25"/><circle cx="72" cy="62" r="18"/><rect x="22" y="60" width="58" height="26" rx="13"/></g>`; fy = 64; break;
    case 'star': { const pts = [...Array(10)].map((_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 19 : 40; return `${(50 + r * Math.cos(a)).toFixed(1)},${(56 + r * Math.sin(a)).toFixed(1)}`; }).join(' '); body = `<polygon points="${pts}" fill="${F}" stroke="${F}" stroke-width="9" stroke-linejoin="round"/>`; fy = 58; break; }
    case 'axolotl': back = [-1, 1].map((d) => [0, 1, 2].map((k) => `<ellipse cx="${50 + d * 40}" cy="${44 + k * 9}" rx="9" ry="3.6" fill="${A}" transform="rotate(${d * (k - 1) * 22} ${50 + d * 40} ${44 + k * 9})"/>`).join('')).join(''); body = round(34, 30, 60); break;
    case 'unicorn': back = `<path d="M44 32 L50 4 L56 32Z" fill="#ffd84d"/><path d="M46 24 L54 22 M47 16 L53 15" stroke="#e8a900" stroke-width="1.6"/>` + ear('M24 40 L28 22 L38 32Z', F) + ear('M76 40 L72 22 L62 32Z', F); body = round(); front = `<g fill="${A}"><circle cx="70" cy="34" r="7"/><circle cx="80" cy="44" r="6"/><circle cx="84" cy="56" r="5"/></g>`; break;
    case 'dragon': back = `<path d="M20 54 Q2 34 6 22 Q16 34 28 40Z" fill="${A}"/><path d="M80 54 Q98 34 94 22 Q84 34 72 40Z" fill="${A}"/>` + ear('M34 34 L32 18 L42 30Z', A) + ear('M66 34 L68 18 L58 30Z', A); body = round(); front = `<ellipse cx="50" cy="76" rx="14" ry="9" fill="${A}" opacity=".7"/>`; break;
    default: if (EXTRA_ART[s.sp]) { art = EXTRA_ART[s.sp]({ F, A, s, light, dark, round, ear, blush, ink }); ({ back = '', body = '', front = '', fy = 62 } = art); } break;
    case 'whale': back = `<path d="M84 60 Q98 46 96 38 Q90 50 82 50 Q88 40 82 34 Q80 50 74 56Z" fill="${F}"/><path d="M44 22 Q42 12 36 10 M50 22 L50 8 M56 22 Q58 12 64 10" stroke="#8ec5ff" stroke-width="3" stroke-linecap="round" fill="none"/>`; body = `<ellipse cx="46" cy="60" rx="40" ry="32" fill="${F}"/>`; front = `<path d="M10 66 Q46 92 84 66 Q78 90 46 92 Q14 90 10 66Z" fill="${A}"/>`; fy = 58; break;
  }
  const fx = fy || 36; // frog: eyes sit in the bumps
  const eyesY = art.eyesY ?? (s.sp === 'frog' ? 36 : fy - 2);
  const ex = art.ex ?? (s.sp === 'frog' ? 18 : 11);
  const eyeL = 50 - ex, eyeR = 50 + ex;
  const mouthY = art.mouthY ?? (s.sp === 'frog' ? 64 : fy + 6);
  const eyeInk = art.eyeInk || (s.fx === 'galaxy' ? '#ffffff' : ink);
  const face = `<g class="f-open"><ellipse cx="${eyeL}" cy="${eyesY}" rx="3.6" ry="4.4" fill="${eyeInk}"/><ellipse cx="${eyeR}" cy="${eyesY}" rx="3.6" ry="4.4" fill="${eyeInk}"/>${s.fx === 'galaxy' ? '' : `<circle cx="${eyeL + 1.2}" cy="${eyesY - 1.6}" r="1.3" fill="#fff"/><circle cx="${eyeR + 1.2}" cy="${eyesY - 1.6}" r="1.3" fill="#fff"/>`}</g>
    <g class="f-joy"><path d="M${eyeL - 4} ${eyesY + 1} Q${eyeL} ${eyesY - 5} ${eyeL + 4} ${eyesY + 1}" stroke="${eyeInk}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${eyeR - 4} ${eyesY + 1} Q${eyeR} ${eyesY - 5} ${eyeR + 4} ${eyesY + 1}" stroke="${eyeInk}" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>
    <ellipse cx="${eyeL - 7}" cy="${mouthY - 1}" rx="5" ry="3" fill="${blush}" opacity=".55"/><ellipse cx="${eyeR + 7}" cy="${mouthY - 1}" rx="5" ry="3" fill="${blush}" opacity=".55"/>
    ${art.noMouth ? '' : `<path d="M${50 - 4.5} ${mouthY} Q${50 - 2.2} ${mouthY + 3.4} 50 ${mouthY} Q${50 + 2.2} ${mouthY + 3.4} ${50 + 4.5} ${mouthY}" stroke="${eyeInk}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`}`;
  const sparkles = s.fx === 'galaxy' ? [[30, 50], [66, 44], [40, 78], [72, 72], [56, 60], [24, 68]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 0.9 : 1.4}" fill="#fff" opacity=".85"/>`).join('')
    : ['L', 'M', 'U'].includes(s.r) || s.fx === 'gold' || opts.shiny ? `<path class="spk" d="M82 18 L84 24 L90 26 L84 28 L82 34 L80 28 L74 26 L80 24Z" fill="#fff6c2"/><path class="spk s2" d="M16 26 L17.5 30 L21.5 31.5 L17.5 33 L16 37 L14.5 33 L10.5 31.5 L14.5 30Z" fill="#fff6c2"/>` : '';
  const shine = `<ellipse cx="34" cy="${Math.max(34, fy - 16)}" rx="9" ry="5" fill="#fff" opacity=".35" transform="rotate(-25 34 ${Math.max(34, fy - 16)})"/>`;
  void fx;
  const auraEl = aura ? `<circle class="aura" cx="50" cy="56" r="50" fill="url(#${g}a)"/>` : '';
  const acc = s.acc && ACCESSORIES[s.acc] ? ACCESSORIES[s.acc](art.top ?? 28, s, g) : '';
  return `<svg class="sq-svg${opts.cls ? ' ' + opts.cls : ''}${opts.shiny ? ' is-shiny' : ''}" viewBox="0 0 100 100" role="img" aria-label="${esc(s.name)}">${defs}${auraEl}<ellipse cx="50" cy="95" rx="30" ry="3.5" fill="#000" opacity=".1"/>${back}${body}${shine}${front}${art.over || ''}${face}${acc}${sparkles}</svg>`;
}
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
  } else if (!spendGems(who, b.cost, `${b.name}`, 'squish')) return;
  const tier = rollTier(box, who);
  if (b.pity) { const k = `${who}:${box}`; state.squish.pity[k] = TIERS.indexOf(tier) >= TIERS.indexOf(b.pityTier) ? 0 : pityOf(who, box) + 1; }
  const s = pickFromPool(boxPool(box), tier);
  const shiny = Math.random() < (b.shiny ?? 0.02);
  const { item, isNew } = giveSquishy(who, s.id, box, shiny ? { shiny: true } : {});
  if (shiny) logAct('✨', `found a SHINY ${s.name}!`, 'squishies');
  if (['L', 'M'].includes(tier)) logAct('🧸', `pulled a ${RARITY[tier].name} ${s.name}!`, 'squishies');
  save();
  boxReveal(b, item, isNew);
}
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
function boxReveal(b, item, isNew) {
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
      <div class="btn-row" style="justify-content:center"><button class="btn" data-close>Yay!</button>${b.noAgain ? '' : '<button class="btn secondary" data-again>Open another</button>'}</div></div>`;
    sqSound(['L', 'M', 'U'].includes(s.r) || item.shiny ? 'win' : 'pop');
    if (['E', 'L', 'M', 'U'].includes(s.r) || item.shiny) setTimeout(confetti, 200);
    if (typeof isSimple === 'function' && isSimple(item.who) && readAloudOn(item.who)) speak(`You got ${s.name}! ${RARITY[s.r].name}!`);
    el.querySelector('[data-close]').onclick = () => { el.remove(); render(); };
    if (el.querySelector('[data-again]')) el.querySelector('[data-again]').onclick = () => { el.remove(); render(); setTimeout(() => (ui.sqTab = 'boxes', go('squishies'))); };
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
      <div class="small muted" style="margin-top:6px">${SETS[s.set] ? `${SETS[s.set][0]} ${SETS[s.set][1]}` : ''}${ult ? '' : ` · worth ${RARITY[s.r].value} ⭐`}${s.blurb ? `<br>${esc(s.blurb)}` : ''}</div>
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
    <div class="grow"><b>My Squishies</b><div class="small">${n}/${SQUISHIES.length} collected</div><div class="sqb-gems">${GEM} ${gemBalance(id)}</div></div>${free ? '<span class="sqb-free">🎁 Free box!</span>' : ''}</button>`;
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
        setTimeout(() => boxReveal({ emoji: '🛍️' }, item, isNew), 60);
      },
    });
  },
  'sq-squish': (el) => {
    const me = actor(), sid = el.dataset.sid;
    el.classList.remove('squishing'); void el.offsetWidth; el.classList.add('squishing');
    sqSound('squish');
    if (navigator.vibrate) navigator.vibrate(12);
    const mine = me ? myItems(me).filter((i) => i.sid === sid) : [];
    if (!mine.length) return;
    mine[0].sq = (mine[0].sq || 0) + 1;
    const n = $('.sq-n'); if (n) n.textContent = sum(mine, (i) => i.sq || 0);
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
