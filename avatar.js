/* Avatars 🧍: a customizable chibi character for each family member — skin, eyes, mouth, hair style & color,
   outfit, shoes and accessories (some cost 💎, a few are earned). Drawn as layered SVG so it can walk, wave and
   blink inside the Dream House, stand in Gomez Town and visit friends. Loaded after friends.js, before house.js. */
'use strict';

Object.assign(TITLES, { avatar: 'My Avatar' });

const AV_SKIN = ['#ffe0c7', '#f7cfae', '#efb88e', '#d9965f', '#b97543', '#8d5a33', '#6b4226', '#4a2c19'];
const AV_HAIRC = { black: ['#2b2b2b', 0], dark: ['#4a2c1a', 0], brown: ['#7a4a2a', 0], auburn: ['#9c3f1e', 0], blonde: ['#f2c94c', 0], ginger: ['#e8742b', 0], silver: ['#cfd6de', 20], pink: ['#ff8fc0', 25], purple: ['#9d7bea', 25], blue: ['#5aa9f8', 25], mint: ['#5fd3b0', 25], rainbow: ['rainbow', 80], galaxy: ['galaxy', 80] };
const AV_EYEC = ['#3a2b3d', '#5b3a1e', '#2f6fb5', '#2b8a3e', '#7048e8', '#c2255c'];
const AV_CLOTH = ['#ff6b9d', '#ff922b', '#ffd43b', '#51cf66', '#22b8cf', '#4dabf7', '#845ef7', '#f8f9fa', '#343a40', '#e64980', '#a5d8ff', '#ffc9de'];
const AV_HAIR = { short: 'Short', bob: 'Bob', long: 'Long', ponytail: 'Ponytail', pigtails: 'Pigtails', buns: 'Space buns', curly: 'Curly puff', spiky: 'Spiky', braid: 'Braid', buzz: 'Buzz' };
const AV_EYES = { round: ['Round', 0], happy: ['Happy', 0], wink: ['Wink', 0], lashes: ['Lashes', 0], sleepy: ['Sleepy', 0], sparkle: ['Sparkle', 30], star: ['Starry', 40] };
const AV_MOUTH = { smile: 'Smile', grin: 'Grin', open: 'Wow', cat: 'Kitty', tongue: 'Silly', smirk: 'Smirk' };
const AV_TOP = { tee: ['T-shirt', 0], tank: ['Tank top', 0], hoodie: ['Hoodie', 0], sweater: ['Striped sweater', 0], jacket: ['Jacket', 20], dress: ['Dress', 0], overalls: ['Overalls', 0], gown: ['Princess gown', 80], cape: ['Hero cape', 60] };
const AV_GRAPHIC = { none: ['None', 0], heart: ['💖 Heart', 0], star: ['⭐ Star', 0], bolt: ['⚡ Bolt', 15], rainbow: ['🌈 Rainbow', 30], squish: ['🧸 Squishy', 40] };
const AV_BOTTOM = { pants: 'Pants', shorts: 'Shorts', skirt: 'Skirt', leggings: 'Leggings' };
const AV_SHOES = { sneakers: ['Sneakers', 0], boots: ['Boots', 15], sandals: ['Sandals', 0], slippers: ['Bunny slippers', 40] };
const AV_ACC = {
  none: ['None', 0], glasses: ['Glasses', 0], sunglasses: ['Sunglasses', 15], bow: ['Bow', 0], flower: ['Flower', 0], cap: ['Cap', 0], beanie: ['Beanie', 0],
  headphones: ['Headphones', 25], starclips: ['Star clips', 40], catears: ['Cat ears', 50], bunnyears: ['Bunny ears', 50], tiara: ['Tiara', 100],
  crown: ['Royal crown', 0, 'ultimate'], halo: ['Halo', 0, 'u_angel'],
};

function defaultAvatar(mid) {
  const i = Math.max(0, state.members.findIndex((m) => m.id === mid));
  const r = rnd(hashStr(mid || 'x'));
  return { skin: Math.floor(r() * 5), hair: ['bob', 'short', 'ponytail', 'curly', 'long', 'spiky'][i % 6], hairC: ['dark', 'brown', 'black', 'blonde'][i % 4], eyes: 'round', eyeC: 0, mouth: 'smile', blush: true, freckles: false, top: ['tee', 'hoodie', 'dress', 'overalls'][i % 4], topC: [0, 5, 6, 3, 1][i % 5], graphic: ['heart', 'star', 'none'][i % 3], bottom: 'pants', bottomC: 5, shoes: 'sneakers', shoesC: 7, acc: 'none', own: {} };
}
const avatarOf = (mid) => ({ ...defaultAvatar(mid), ...(state.avatars?.[mid] || {}) });

/* =========================================================
   Drawing
   ========================================================= */
function avatarSVG(a, opts = {}) {
  const g = 'av' + (++svgSeq);
  const skin = AV_SKIN[a.skin] || AV_SKIN[1], skinD = mixHex(skin, '#000000', 0.12);
  const hc = AV_HAIRC[a.hairC]?.[0] || '#4a2c1a';
  const H = hc === 'rainbow' || hc === 'galaxy' ? `url(#${g}h)` : hc, HD = hc.startsWith('#') ? mixHex(hc, '#000000', 0.18) : '#00000033';
  const top = AV_CLOTH[a.topC] ?? AV_CLOTH[0], topD = mixHex(top, '#000000', 0.15), bot = AV_CLOTH[a.bottomC] ?? AV_CLOTH[5], shoe = AV_CLOTH[a.shoesC] ?? AV_CLOTH[7];
  const eyeC = AV_EYEC[a.eyeC] || AV_EYEC[0], ink = '#3a2b3d';
  const hairDefs = hc === 'rainbow' ? `<linearGradient id="${g}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fab"/><stop offset=".3" stop-color="#ffd43b"/><stop offset=".55" stop-color="#69db7c"/><stop offset=".8" stop-color="#4dabf7"/><stop offset="1" stop-color="#b197fc"/></linearGradient>`
    : hc === 'galaxy' ? `<radialGradient id="${g}h" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#9d7bea"/><stop offset=".6" stop-color="#3b2a6b"/><stop offset="1" stop-color="#140f33"/></radialGradient>` : '';
  // --- hair (back) ---
  const hairBack = {
    short: '', buzz: '', spiky: '',
    bob: `<path d="M18 44 Q16 10 50 10 Q84 10 82 44 L82 66 Q74 72 66 66 L34 66 Q26 72 18 66Z" fill="${H}"/>`,
    long: `<path d="M17 44 Q15 9 50 9 Q85 9 83 44 L86 104 Q70 112 50 106 Q30 112 14 104Z" fill="${H}"/>`,
    ponytail: `<path d="M70 26 Q100 34 92 70 Q88 92 76 98 Q84 74 76 52Z" fill="${H}"/><circle cx="74" cy="28" r="5" fill="${top}"/>`,
    pigtails: `<ellipse cx="16" cy="58" rx="8" ry="17" fill="${H}" transform="rotate(12 16 58)"/><ellipse cx="84" cy="58" rx="8" ry="17" fill="${H}" transform="rotate(-12 84 58)"/><circle cx="20" cy="42" r="3.5" fill="${top}"/><circle cx="80" cy="42" r="3.5" fill="${top}"/>`,
    buns: `<circle cx="27" cy="16" r="11" fill="${H}"/><circle cx="73" cy="16" r="11" fill="${H}"/>`,
    curly: [...Array(11)].map((_, i) => { const t = Math.PI * (0.95 + i * 0.11); return `<circle cx="${(50 + 31 * Math.cos(t)).toFixed(1)}" cy="${(40 + 30 * Math.sin(t)).toFixed(1)}" r="11" fill="${H}"/>`; }).join('') + `<circle cx="21" cy="52" r="9" fill="${H}"/><circle cx="79" cy="52" r="9" fill="${H}"/>`,
    braid: `<g fill="${H}">${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${78 + (k % 2 ? 2 : -1)}" cy="${56 + k * 10}" rx="6.5" ry="6"/>`).join('')}</g><circle cx="78" cy="106" r="3.5" fill="${top}"/>`,
  }[a.hair] || '';
  // --- hair (front) ---
  const hairFront = {
    short: `<path d="M22 42 Q20 12 50 12 Q80 12 78 42 Q72 26 58 24 Q50 30 40 24 Q28 28 22 42Z" fill="${H}"/>`,
    bob: `<path d="M22 40 Q24 14 50 14 Q76 14 78 40 Q68 30 60 34 Q54 26 46 33 Q36 27 22 40Z" fill="${H}"/>`,
    long: `<path d="M22 44 Q22 13 50 13 Q78 13 78 44 Q66 24 44 26 Q32 30 22 44Z" fill="${H}"/>`,
    ponytail: `<path d="M22 40 Q22 13 50 13 Q78 13 78 40 Q70 24 50 24 Q32 24 22 40Z" fill="${H}"/>`,
    pigtails: `<path d="M22 40 Q24 13 50 13 Q76 13 78 40 Q68 30 60 33 Q54 25 46 33 Q36 28 22 40Z" fill="${H}"/>`,
    buns: `<path d="M22 40 Q22 15 50 15 Q78 15 78 40 Q66 28 50 30 Q34 28 22 40Z" fill="${H}"/>`,
    curly: `<g fill="${H}">${[26, 36, 46, 56, 66, 74].map((x, i) => `<circle cx="${x}" cy="${22 + (i % 2) * 4}" r="8"/>`).join('')}</g>`,
    spiky: `<path d="M22 42 L20 22 L30 28 L30 12 L40 22 L46 8 L54 20 L62 8 L66 22 L76 14 L74 28 L82 26 L78 42 Q66 28 50 28 Q34 28 22 42Z" fill="${H}"/>`,
    braid: `<path d="M22 42 Q20 12 50 12 Q80 12 80 44 Q70 24 54 24 Q36 24 22 42Z" fill="${H}"/>`,
    buzz: `<path d="M23 40 Q22 14 50 14 Q78 14 77 40 Q70 22 50 22 Q30 22 23 40Z" fill="${H}" opacity=".55"/>`,
  }[a.hair] || '';
  // --- face ---
  const ey = 46, ex = 11;
  const eye = (x, kind) => {
    if (kind === 'happy') return `<path d="M${x - 4.5} ${ey + 1} Q${x} ${ey - 5} ${x + 4.5} ${ey + 1}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    if (kind === 'sleepy') return `<path d="M${x - 4.5} ${ey} Q${x} ${ey + 3.5} ${x + 4.5} ${ey}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    if (kind === 'sparkle') return `<ellipse cx="${x}" cy="${ey}" rx="5" ry="6" fill="${eyeC}"/><ellipse cx="${x}" cy="${ey + 1}" rx="2.6" ry="3.2" fill="${ink}"/><circle cx="${x + 1.8}" cy="${ey - 2.4}" r="1.9" fill="#fff"/><circle cx="${x - 1.8}" cy="${ey + 2.6}" r="1" fill="#fff"/>`;
    if (kind === 'star') return `<path d="M${x} ${ey - 6} l1.8 4 4.2.4 -3.2 2.8 1 4.2 -3.8 -2.3 -3.8 2.3 1 -4.2 -3.2 -2.8 4.2 -.4Z" fill="${eyeC}"/>`;
    return `<ellipse cx="${x}" cy="${ey}" rx="3.8" ry="4.6" fill="${eyeC === AV_EYEC[0] ? ink : eyeC}"/><ellipse cx="${x}" cy="${ey + .6}" rx="2" ry="2.6" fill="${ink}"/><circle cx="${x + 1.3}" cy="${ey - 1.7}" r="1.4" fill="#fff"/>`;
  };
  const lashes = (x) => `<path d="M${x - 4} ${ey - 3} l-2.5 -2.5 M${x} ${ey - 4.6} l0 -3 M${x + 4} ${ey - 3} l2.5 -2.5" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>`;
  let eyes;
  if (a.eyes === 'wink') eyes = eye(50 - ex, 'round') + eye(50 + ex, 'happy');
  else eyes = eye(50 - ex, a.eyes) + eye(50 + ex, a.eyes) + (a.eyes === 'lashes' ? lashes(50 - ex) + lashes(50 + ex) : '');
  const my = 57;
  const mouth = {
    smile: `<path d="M44 ${my} Q50 ${my + 6} 56 ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    grin: `<path d="M42 ${my - 1} Q50 ${my + 10} 58 ${my - 1}Z" fill="#7a2e3b"/><path d="M43.5 ${my - .5} L56.5 ${my - .5} L55 ${my + 2} L45 ${my + 2}Z" fill="#fff"/>`,
    open: `<ellipse cx="50" cy="${my + 1}" rx="4" ry="4.6" fill="#7a2e3b"/><ellipse cx="50" cy="${my + 3}" rx="2.6" ry="1.6" fill="#ff8fab"/>`,
    cat: `<path d="M43 ${my} Q46.5 ${my + 4} 50 ${my} Q53.5 ${my + 4} 57 ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    tongue: `<path d="M44 ${my} Q50 ${my + 6} 56 ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M48 ${my + 2.6} Q50 ${my + 8} 53 ${my + 2.4}Z" fill="#ff6b8a"/>`,
    smirk: `<path d="M45 ${my + 1} Q52 ${my + 4} 57 ${my - 2}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  }[a.mouth] || '';
  const cheeks = (a.blush !== false ? `<ellipse cx="33" cy="54" rx="5" ry="3" fill="#ff8fab" opacity=".5"/><ellipse cx="67" cy="54" rx="5" ry="3" fill="#ff8fab" opacity=".5"/>` : '')
    + (a.freckles ? [[34, 51], [37, 53], [31, 53], [66, 51], [63, 53], [69, 53]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="${skinD}"/>`).join('') : '');
  // --- body & clothes ---
  const dressy = a.top === 'dress' || a.top === 'gown';
  const sleeve = a.top === 'tank' ? skin : top;
  const legC = dressy || a.bottom === 'skirt' ? skin : bot;
  const legs = ['l', 'r'].map((side) => {
    const x = side === 'l' ? 38 : 52;
    const shorts = a.bottom === 'shorts' && !dressy ? `<rect x="${x}" y="104" width="10" height="12" rx="3" fill="${bot}"/>` : '';
    const shoeEl = {
      boots: `<path d="M${x - 2} 126 h14 v10 q0 4 -4 4 h-12 q-4 0 -4 -3 q0 -3 4 -3 h2Z" fill="${shoe}"/>`,
      sandals: `<ellipse cx="${x + 4}" cy="139" rx="8" ry="3.6" fill="${shoe}"/><path d="M${x} 136 l4 3 l4 -3" stroke="${shoe}" stroke-width="2" fill="none"/>`,
      slippers: `<ellipse cx="${x + 4}" cy="138" rx="9" ry="5.5" fill="#fff"/><ellipse cx="${x + 1}" cy="131" rx="2" ry="5" fill="#fff"/><ellipse cx="${x + 7}" cy="131" rx="2" ry="5" fill="#fff"/><circle cx="${x + 4}" cy="137" r="1.2" fill="#ff8fab"/>`,
    }[a.shoes] || `<path d="M${x - 3} 134 q0 -4 5 -4 h6 q5 0 6 4 v3 q0 2 -2 2 h-13 q-2 0 -2 -2Z" fill="${shoe}"/><path d="M${x - 2} 137 h15" stroke="#fff" stroke-width="1.6"/>`;
    return `<g class="leg leg-${side}"><rect x="${x}" y="102" width="10" height="${a.shoes === 'boots' ? 26 : 32}" rx="5" fill="${a.bottom === 'shorts' && !dressy ? skin : legC}"/>${shorts}${shoeEl}</g>`;
  }).join('');
  const torso = `<path d="M30 80 Q30 71 39 70 L61 70 Q70 71 70 80 L70 108 L30 108Z" fill="${top}"/>`;
  const graphic = { heart: `<path d="M50 96 C42 90 41 85 44 83 C47 81 49 83 50 85 C51 83 53 81 56 83 C59 85 58 90 50 96Z" fill="#fff" opacity=".9"/>`, star: `<path d="M50 80 l2.6 5.4 5.9.8 -4.3 4.1 1 5.9 -5.2 -2.8 -5.2 2.8 1 -5.9 -4.3 -4.1 5.9 -.8Z" fill="#ffd43b"/>`, bolt: `<path d="M52 79 L44 91 L50 91 L47 100 L57 87 L51 87 L54 79Z" fill="#ffd43b"/>`, rainbow: `<path d="M40 94 a10 10 0 0 1 20 0" stroke="#ff6b6b" stroke-width="2.6" fill="none"/><path d="M42.6 94 a7.4 7.4 0 0 1 14.8 0" stroke="#ffd43b" stroke-width="2.6" fill="none"/><path d="M45.2 94 a4.8 4.8 0 0 1 9.6 0" stroke="#4dabf7" stroke-width="2.6" fill="none"/>`, squish: `<circle cx="50" cy="89" r="7" fill="#ffc9de"/><circle cx="47.5" cy="88" r="1" fill="${ink}"/><circle cx="52.5" cy="88" r="1" fill="${ink}"/><path d="M48.5 91 q1.5 1.4 3 0" stroke="${ink}" stroke-width=".9" fill="none"/>` }[a.graphic] || '';
  const outfit = {
    tee: torso + graphic,
    tank: `<path d="M36 80 Q36 71 41 70 L59 70 Q64 71 64 80 L68 108 L32 108Z" fill="${top}"/>` + graphic,
    hoodie: `<ellipse cx="50" cy="72" rx="15" ry="6" fill="${topD}"/>` + torso + `<rect x="40" y="96" width="20" height="9" rx="3" fill="${topD}"/><path d="M46 74 v10 M54 74 v10" stroke="#fff" stroke-width="1.4"/>` + graphic,
    sweater: torso + [80, 88, 96, 104].map((y) => `<rect x="30" y="${y}" width="40" height="3.4" fill="#fff" opacity=".55"/>`).join(''),
    jacket: torso + `<path d="M50 70 L46 108 M50 70 L54 108" stroke="${topD}" stroke-width="2.2"/><path d="M39 70 L46 80 L50 72 L54 80 L61 70" fill="#fff" opacity=".9"/><circle cx="47" cy="92" r="1.2" fill="${topD}"/>`,
    dress: `<path d="M33 80 Q33 71 40 70 L60 70 Q67 71 67 80 L70 98 L30 98Z" fill="${top}"/><path d="M31 96 L20 124 Q50 132 80 124 L69 96Z" fill="${top}"/><path d="M22 120 Q50 128 78 120" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>` + graphic,
    gown: `<path d="M34 80 Q34 71 40 70 L60 70 Q66 71 66 80 L68 96 L32 96Z" fill="${top}"/><path d="M32 94 L12 132 Q50 142 88 132 L68 94Z" fill="${top}"/><path d="M32 94 L24 130 M50 96 L50 136 M68 94 L76 130" stroke="#fff" stroke-width="1.4" opacity=".45"/><path d="M34 82 Q50 90 66 82" stroke="#ffd43b" stroke-width="2.4" fill="none"/>${[[24, 120], [44, 126], [62, 118], [76, 128], [36, 108]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff"/>`).join('')}`,
    overalls: torso + `<rect x="36" y="84" width="28" height="24" rx="3" fill="${bot}"/><path d="M38 84 L38 70 M62 84 L62 70" stroke="${bot}" stroke-width="4"/><circle cx="39" cy="86" r="1.6" fill="#ffd43b"/><circle cx="61" cy="86" r="1.6" fill="#ffd43b"/><rect x="44" y="90" width="12" height="7" rx="2" fill="${mixHex(bot, '#000000', 0.15)}"/>`,
    cape: torso + graphic,
  }[a.top] || torso;
  const capeBack = a.top === 'cape' ? `<path d="M34 72 L18 128 Q50 136 82 128 L66 72Z" fill="#e63946"/>` : '';
  const skirt = a.bottom === 'skirt' && !dressy ? `<path d="M30 104 L24 122 Q50 128 76 122 L70 104Z" fill="${bot}"/>` : '';
  const pantsTop = !dressy && a.bottom !== 'skirt' && a.top !== 'overalls' ? `<rect x="30" y="102" width="40" height="8" rx="3" fill="${bot}"/>` : '';
  const arm = (side) => {
    const sx = side === 'l' ? 33 : 67, hx = side === 'l' ? 22 : 78;
    return `<g class="arm arm-${side}"><path d="M${sx} 76 L${hx} 100" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>${a.top === 'tank' ? '' : `<path d="M${sx} 76 L${side === 'l' ? sx - (a.top === 'tee' || dressy ? 5 : 10) : sx + (a.top === 'tee' || dressy ? 5 : 10)} ${a.top === 'tee' || dressy ? 85 : 96}" stroke="${sleeve}" stroke-width="9.5" stroke-linecap="round"/>`}<circle cx="${hx}" cy="101" r="4.6" fill="${skin}"/></g>`;
  };
  // --- accessories ---
  const acc = {
    glasses: `<g fill="none" stroke="#343a40" stroke-width="1.8"><circle cx="39" cy="46" r="6.5"/><circle cx="61" cy="46" r="6.5"/><path d="M45.5 46 h9"/></g>`,
    sunglasses: `<rect x="31" y="41" width="15" height="10" rx="4" fill="#212529"/><rect x="54" y="41" width="15" height="10" rx="4" fill="#212529"/><path d="M46 45 h8" stroke="#212529" stroke-width="2"/><path d="M34 44 l4 0" stroke="#fff" stroke-width="1.4" opacity=".6"/>`,
    bow: `<path d="M68 16 L58 9 L58 23Z M68 16 L78 9 L78 23Z" fill="#ff6b9d"/><circle cx="68" cy="16" r="3.4" fill="#e64980"/>`,
    flower: `<g transform="translate(73 24)">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-5" rx="3.4" ry="5" fill="#fff" transform="rotate(${r})"/>`).join('')}<circle r="3" fill="#ffd43b"/></g>`,
    cap: `<path d="M22 32 Q22 10 50 10 Q78 10 78 32Z" fill="${top}"/><path d="M50 30 Q82 28 92 34 Q80 38 50 34Z" fill="${topD}"/><circle cx="50" cy="11" r="2.4" fill="${topD}"/>`,
    beanie: `<path d="M21 34 Q21 8 50 8 Q79 8 79 34Z" fill="${top}"/><rect x="19" y="28" width="62" height="9" rx="4.5" fill="${topD}"/><circle cx="50" cy="6" r="5" fill="#fff"/>`,
    headphones: `<path d="M20 44 Q20 10 50 10 Q80 10 80 44" stroke="#495057" stroke-width="4" fill="none"/><rect x="14" y="38" width="10" height="16" rx="4" fill="${top}"/><rect x="76" y="38" width="10" height="16" rx="4" fill="${top}"/>`,
    starclips: `<path d="M30 22 l1.8 3.6 4 .5 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.5Z M70 22 l1.8 3.6 4 .5 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.5Z" fill="#ffd43b"/>`,
    catears: `<path d="M24 26 L26 4 L42 18Z M76 26 L74 4 L58 18Z" fill="${H}"/><path d="M28 20 L29 10 L37 17Z M72 20 L71 10 L63 17Z" fill="#ff8fab"/>`,
    bunnyears: `<ellipse cx="38" cy="0" rx="6" ry="16" fill="#fff" transform="rotate(-10 38 0)"/><ellipse cx="62" cy="0" rx="6" ry="16" fill="#fff" transform="rotate(10 62 0)"/><ellipse cx="38" cy="2" rx="2.8" ry="10" fill="#ffc9de" transform="rotate(-10 38 2)"/><ellipse cx="62" cy="2" rx="2.8" ry="10" fill="#ffc9de" transform="rotate(10 62 2)"/>`,
    tiara: `<path d="M32 16 L36 6 L42 13 L50 2 L58 13 L64 6 L68 16 Q50 12 32 16Z" fill="#e9ecef" stroke="#adb5bd" stroke-width="1"/><circle cx="50" cy="9" r="2.4" fill="#ff6b9d"/><circle cx="38" cy="12" r="1.4" fill="#4dabf7"/><circle cx="62" cy="12" r="1.4" fill="#4dabf7"/>`,
    crown: `<path d="M33 16 L35 0 L43 8 L50 -4 L57 8 L65 0 L67 16Z" fill="#ffd23f" stroke="#e0a800" stroke-width="1.4" stroke-linejoin="round"/><circle cx="50" cy="8" r="2.6" fill="#ff4d8d"/>`,
    halo: `<ellipse cx="50" cy="0" rx="17" ry="4.6" fill="none" stroke="#ffd23f" stroke-width="3.4"/>`,
  }[a.acc] || '';
  const accBehind = a.acc === 'headphones' ? '' : '';
  const shadow = opts.noShadow ? '' : `<ellipse cx="50" cy="141" rx="22" ry="4" fill="#000" opacity=".14"/>`;
  return `<svg class="av-svg${opts.cls ? ' ' + opts.cls : ''}" viewBox="${opts.head ? '12 -8 76 76' : '0 -12 100 158'}" role="img" aria-label="Avatar"><defs>${hairDefs}</defs>
    ${shadow}<g class="av-body">${capeBack}${hairBack}${a.acc === 'bunnyears' || a.acc === 'halo' ? acc : ''}${legs}${skirt}${pantsTop}<g class="arm-back">${arm('l')}</g>${outfit}<rect x="45" y="64" width="10" height="9" fill="${skin}"/>${arm('r')}
    <g class="av-head"><circle cx="23" cy="47" r="5" fill="${skin}"/><circle cx="77" cy="47" r="5" fill="${skin}"/><circle cx="50" cy="42" r="27" fill="${skin}"/>${cheeks}<g class="av-eyes">${eyes}</g>${mouth}${hairFront}${a.acc === 'bunnyears' || a.acc === 'halo' ? '' : acc}${accBehind}</g></g></svg>`;
}

/* =========================================================
   Editor
   ========================================================= */
const ownsUltimate = (mid) => typeof SQUISHIES !== 'undefined' && SQUISHIES.some((s) => s.r === 'U' && ownsSid(mid, s.id));
function avItemLock(mid, kind, key) {
  const table = { hairC: AV_HAIRC, eyes: AV_EYES, top: AV_TOP, graphic: AV_GRAPHIC, shoes: AV_SHOES, acc: AV_ACC }[kind];
  const entry = table?.[key];
  if (!entry) return null;
  const price = Array.isArray(entry) ? entry[1] || 0 : 0, earn = Array.isArray(entry) ? entry[2] : null;
  const own = avatarOf(mid).own || {};
  if (earn) {
    const ok = earn === 'ultimate' ? ownsUltimate(mid) : ownsSid(mid, earn);
    return ok ? null : { earn: earn === 'ultimate' ? 'Unlock any 👑 Ultimate' : `Unlock ${SQ[earn]?.name || 'it'} in 👑 Unlocks` };
  }
  return price && !own[`${kind}:${key}`] ? { price } : null;
}
const AV_TABS = [['face', '😊', 'Face'], ['hair', '💇', 'Hair'], ['outfit', '👕', 'Outfit'], ['shoes', '👟', 'Shoes'], ['extras', '🎀', 'Extras']];
views.avatar = (pid) => {
  const me = actor();
  const mid = pid && isMember(pid) && (pid === me || isGrownUp()) ? pid : me;
  if (!mid) return needMe() || '<div class="card empty">Pick who you are first.</div>';
  const a = avatarOf(mid), tab = ui.avTab || 'face';
  const opt = (kind, key, label, preview = 'head') => {
    const lock = avItemLock(mid, kind, key);
    const on = a[kind] === key;
    return `<button class="av-opt${on ? ' on' : ''}${lock ? ' locked' : ''}" data-action="av-set" data-k="${kind}" data-v="${key}" data-id="${mid}">${avatarSVG({ ...a, [kind]: key }, { head: preview === 'head', noShadow: true })}<span>${esc(label)}</span>${lock ? `<small>${lock.price ? `${GEM} ${lock.price}` : '🔒'}</small>` : ''}</button>`;
  };
  const swatches = (kind, list, cls = '') => `<div class="av-swatches">${list.map(([key, color, lockKind]) => { const lock = lockKind ? avItemLock(mid, lockKind, key) : null; return `<button class="av-sw${a[kind] === key ? ' on' : ''}${cls}" data-action="av-set" data-k="${kind}" data-v="${key}" data-id="${mid}" style="background:${color}" aria-label="${esc(String(key))}">${lock ? `<i>${lock.price ? GEM : '🔒'}</i>` : ''}</button>`; }).join('')}</div>`;
  const hairSw = Object.entries(AV_HAIRC).map(([k, [c]]) => [k, c === 'rainbow' ? 'linear-gradient(135deg,#ff8fab,#ffd43b,#69db7c,#4dabf7,#b197fc)' : c === 'galaxy' ? 'radial-gradient(circle at 30% 30%,#9d7bea,#140f33)' : c, 'hairC']);
  const body = {
    face: `<div class="av-label">Skin</div>${swatches('skin', AV_SKIN.map((c, i) => [i, c]))}
      <div class="av-label">Eyes</div><div class="av-grid">${Object.entries(AV_EYES).map(([k, [l]]) => opt('eyes', k, l)).join('')}</div>
      <div class="av-label">Eye color</div>${swatches('eyeC', AV_EYEC.map((c, i) => [i, c]))}
      <div class="av-label">Mouth</div><div class="av-grid">${Object.entries(AV_MOUTH).map(([k, l]) => opt('mouth', k, l)).join('')}</div>
      <div class="av-toggles"><button class="${a.blush !== false ? 'on' : ''}" data-action="av-toggle" data-k="blush" data-id="${mid}">🌸 Blush</button><button class="${a.freckles ? 'on' : ''}" data-action="av-toggle" data-k="freckles" data-id="${mid}">✨ Freckles</button></div>`,
    hair: `<div class="av-label">Color</div>${swatches('hairC', hairSw)}<div class="av-label">Style</div><div class="av-grid">${Object.entries(AV_HAIR).map(([k, l]) => opt('hair', k, l)).join('')}</div>`,
    outfit: `<div class="av-label">Top</div><div class="av-grid">${Object.entries(AV_TOP).map(([k, [l]]) => opt('top', k, l, 'body')).join('')}</div>
      <div class="av-label">Color</div>${swatches('topC', AV_CLOTH.map((c, i) => [i, c]))}
      <div class="av-label">Shirt picture</div><div class="av-grid">${Object.entries(AV_GRAPHIC).map(([k, [l]]) => opt('graphic', k, l, 'body')).join('')}</div>
      <div class="av-label">Bottoms</div><div class="av-grid">${Object.entries(AV_BOTTOM).map(([k, l]) => opt('bottom', k, l, 'body')).join('')}</div>
      <div class="av-label">Bottoms color</div>${swatches('bottomC', AV_CLOTH.map((c, i) => [i, c]))}`,
    shoes: `<div class="av-grid">${Object.entries(AV_SHOES).map(([k, [l]]) => opt('shoes', k, l, 'body')).join('')}</div><div class="av-label">Color</div>${swatches('shoesC', AV_CLOTH.map((c, i) => [i, c]))}`,
    extras: `<div class="av-grid">${Object.entries(AV_ACC).map(([k, [l]]) => opt('acc', k, l)).join('')}</div>`,
  }[tab];
  return `<div class="av-layout"><div class="av-stage" style="--c:${member(mid).color}">
      <div class="av-big">${avatarSVG(a, { cls: 'idle' })}</div>
      <div class="av-name">${esc(member(mid).name)}</div>
      <div class="av-stage-btns"><button data-action="av-random" data-id="${mid}">🎲 Surprise me</button><span class="gem-pill">${GEM} <b>${gemBalance(mid)}</b></span><button class="av-done" data-action="go" data-to="house${mid !== me ? '/' + mid : ''}">✓ Done</button></div>
    </div>
    <div class="av-side"><div class="av-tabs">${AV_TABS.map(([k, e, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="av-tab" data-tab="${k}"><span>${e}</span>${l}</button>`).join('')}</div>
    <div class="card av-panel" data-pages="av-${tab}">${body}</div></div></div>`;
};
function setAvatar(mid, patch) {
  state.avatars[mid] = { ...avatarOf(mid), ...patch };
  save();
}
KID_ROUTES.push('avatar');
for (const a of ['av-set', 'av-tab', 'av-toggle', 'av-random']) KID_ACTIONS.add(a);
Object.assign(actions, {
  'av-tab': (el) => { ui.avTab = el.dataset.tab; render(); },
  'av-toggle': (el) => { const a = avatarOf(el.dataset.id); setAvatar(el.dataset.id, { [el.dataset.k]: el.dataset.k === 'blush' ? a.blush === false : !a.freckles }); render(); },
  'av-set': (el) => {
    const mid = el.dataset.id, kind = el.dataset.k;
    const v = ['skin', 'eyeC', 'topC', 'bottomC', 'shoesC'].includes(kind) ? Number(el.dataset.v) : el.dataset.v;
    const lock = avItemLock(mid, kind, v);
    if (lock?.earn) { toast(`🔒 ${lock.earn}`); return; }
    if (lock?.price) {
      const label = ({ hairC: 'hair color', eyes: 'eyes', top: 'top', graphic: 'shirt picture', shoes: 'shoes', acc: 'accessory' })[kind];
      openSheet({
        title: `Unlock this ${label}?`, saveLabel: `${GEM} ${lock.price}`, values: {},
        fields: [{ type: 'html', html: `<div class="av-buy">${avatarSVG({ ...avatarOf(mid), [kind]: v })}</div><p class="small muted" style="text-align:center">Yours to keep forever. You have ${gemBalance(mid)} ${GEM}.</p>` }],
        onSave() {
          if (!spendGems(mid, lock.price, `Avatar ${label}`, 'avatar')) return false;
          const a = avatarOf(mid);
          setAvatar(mid, { [kind]: v, own: { ...(a.own || {}), [`${kind}:${v}`]: true } });
          setTimeout(confetti, 100);
        },
      });
      return;
    }
    setAvatar(mid, { [kind]: v });
    ui.pop = null;
    render();
    $('.av-big')?.classList.add('bounce');
  },
  'av-random': (el) => {
    const mid = el.dataset.id, a = avatarOf(mid), pick = (o) => { const ks = Object.keys(o).filter((k) => !avItemLock(mid, o === AV_HAIRC ? 'hairC' : o === AV_EYES ? 'eyes' : o === AV_TOP ? 'top' : o === AV_GRAPHIC ? 'graphic' : o === AV_SHOES ? 'shoes' : o === AV_ACC ? 'acc' : 'x', k)); return ks[Math.floor(Math.random() * ks.length)]; };
    const n = (len) => Math.floor(Math.random() * len);
    setAvatar(mid, { hair: pick(AV_HAIR), hairC: pick(AV_HAIRC), eyes: pick(AV_EYES), eyeC: n(AV_EYEC.length), mouth: pick(AV_MOUTH), top: pick(AV_TOP), topC: n(AV_CLOTH.length), graphic: pick(AV_GRAPHIC), bottom: pick(AV_BOTTOM), bottomC: n(AV_CLOTH.length), shoes: pick(AV_SHOES), shoesC: n(AV_CLOTH.length), acc: Math.random() < 0.5 ? 'none' : pick(AV_ACC), skin: a.skin });
    render();
    $('.av-big')?.classList.add('bounce');
  },
});
// Friends see each other's avatars
if (typeof myShow === 'function') {
  const _myShowA = myShow;
  myShow = function (mid) { const sh = _myShowA(mid); const { own, ...av } = avatarOf(mid); void own; return { ...sh, av }; };
}
const _friendViewA = views.friend;
views.friend = (param) => {
  const html = _friendViewA(param), k = decodeURIComponent(param || '');
  const av = typeof circle === 'function' ? circle()?.shows[k]?.av : null;
  return av ? html.replace(/<div class="fh-av">[^<]*<\/div>/, `<div class="fh-av av-hero">${avatarSVG(av, { head: true, noShadow: true })}</div>`) : html;
};
