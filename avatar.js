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
const AV_FACIAL = { none: 'None', stubble: 'Stubble', mustache: 'Mustache', goatee: 'Goatee', beard: 'Beard' };
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
// Starter looks: one tap sets hair, clothes and face; everything stays mix-and-match afterwards.
const AV_LOOKS = {
  boy: { hair: 'short', top: 'tee', graphic: 'star', topC: 5, bottom: 'pants', bottomC: 8, eyes: 'round', blush: true, facial: 'none', acc: 'none' },
  girl: { hair: 'ponytail', top: 'tee', graphic: 'heart', topC: 0, bottom: 'leggings', bottomC: 6, eyes: 'lashes', blush: true, facial: 'none', acc: 'bow' },
  man: { hair: 'short', top: 'hoodie', graphic: 'none', topC: 5, bottom: 'pants', bottomC: 8, eyes: 'round', blush: false, facial: 'stubble', acc: 'none' },
  woman: { hair: 'long', top: 'sweater', graphic: 'none', topC: 9, bottom: 'pants', bottomC: 8, eyes: 'lashes', blush: true, facial: 'none', acc: 'none' },
};
const isKidMember = (mid) => !!state.members.find((m) => m.id === mid)?.kid || (typeof kids === 'function' && kids().some((k) => k.id === mid));
function lookFromEmoji(mid) {
  const e = state.members.find((m) => m.id === mid)?.emoji || '';
  const male = /👨|👦|🧔|👴|🤴|♂/u.test(e), female = /👩|👧|👵|👸|♀/u.test(e);
  if (!male && !female) return null;
  return male ? (/👦/u.test(e) || isKidMember(mid) ? 'boy' : 'man') : (/👧/u.test(e) || isKidMember(mid) ? 'girl' : 'woman');
}
const avatarOf = (mid) => {
  const look = lookFromEmoji(mid);
  return { ...defaultAvatar(mid), ...(look ? { ...AV_LOOKS[look], look } : {}), ...(state.avatars?.[mid] || {}) };
};

/* =========================================================
   Drawing
   ========================================================= */
/* House "Clay" style (same as the squishies): every part is lit from the top-left by its own radial gradient
   (lighter tint → color → slightly darker shade), edged with a darker rim of its own color (never black),
   with glossy white highlights and a soft contact shadow. Everything is inline (gradients get per-render ids),
   so a copy also works as a data-URL image in the Squishvale world. */
const AV_SHADE = '#2a1830', AV_INK = '#3a2b3d', AV_BLUSH = '#ff8fab';
const avLum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b; };
const avRim = (c) => mixHex(c, AV_SHADE, avLum(c) > 225 ? 0.22 : 0.3);
// A rounded "sausage" from (x1,y1) to (x2,y2) with radius r: arms and sleeves
function avCap(x1, y1, x2, y2, r) {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = (-(y2 - y1) / L) * r, ny = ((x2 - x1) / L) * r, f = (n) => +n.toFixed(2);
  return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
}
function avatarSVG(a, opts = {}) {
  const g = 'av' + (++svgSeq);
  let defs = '', gn = 0;
  const gm = {};
  // Clay gradient per color, made on demand: C('#ff6b9d') → url(#…)
  const C = (c) => gm[c] || (defs += `<radialGradient id="${g}c${gn}" cx=".32" cy=".26" r=".9"><stop offset="0" stop-color="${mixHex(c, '#ffffff', 0.42)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${mixHex(c, AV_SHADE, 0.2)}"/></radialGradient>`, (gm[c] = `url(#${g}c${gn++})`));
  // Fill + colored rim (stroke width, round joins and stroke-under-fill are inherited from the root <g>)
  const P = (c, w) => `fill="${C(c)}" stroke="${avRim(c)}"${w ? ` stroke-width="${w}"` : ''}`;
  // Several shapes that read as one piece (arm + hand): one shared rim behind, no seams between them
  const U = (c, shapes, w = 2.2) => `<g fill="${avRim(c)}" stroke="${avRim(c)}" stroke-width="${w}">${shapes}</g><g fill="${C(c)}" stroke="none">${shapes}</g>`;
  const ink = AV_INK, W = '#ffffff', yel = '#ffd43b';
  const gloss = (x, y, rx, ry, o = 0.55, rot = -28) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${W}" opacity="${o}" transform="rotate(${rot} ${x} ${y})"/>`;
  const line = (d, c, w = 1, o = 0.5) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${o}"/>`;

  const skin = AV_SKIN[a.skin] || AV_SKIN[1], skinR = avRim(skin), skinD = mixHex(skin, AV_SHADE, 0.22);
  const hc = AV_HAIRC[a.hairC]?.[0] || '#4a2c1a', special = hc === 'rainbow' || hc === 'galaxy';
  const hBase = special ? (hc === 'rainbow' ? '#b197fc' : '#3b2a6b') : hc;
  const hRim = special ? (hc === 'rainbow' ? '#8a6fd0' : '#1c1440') : avRim(hc);
  const HF = special ? `fill="url(#${g}h)" stroke="${hRim}"` : P(hc);
  const hBack = special ? hBase : mixHex(hc, AV_SHADE, 0.14);
  const HB = special ? `fill="url(#${g}h)" stroke="${hRim}"` : P(hBack);
  const hStrand = special ? '#ffffff' : avRim(hc), hShine = avLum(hBase) > 200 ? 0.7 : 0.5;
  if (hc === 'rainbow') defs += `<linearGradient id="${g}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3c6"/><stop offset=".28" stop-color="#ffe066"/><stop offset=".52" stop-color="#8ce99a"/><stop offset=".76" stop-color="#74c0fc"/><stop offset="1" stop-color="#b197fc"/></linearGradient>`;
  if (hc === 'galaxy') defs += `<radialGradient id="${g}h" cx=".3" cy=".22" r="1"><stop offset="0" stop-color="#b9a2f5"/><stop offset=".45" stop-color="#5a3f9e"/><stop offset="1" stop-color="#140f33"/></radialGradient>`;
  const galaxyDots = (pts) => (hc === 'galaxy' ? pts.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? W : '#ffe58a'}" opacity=".85"/>`).join('') : '');
  const top = AV_CLOTH[a.topC] ?? AV_CLOTH[0], topD = mixHex(top, AV_SHADE, 0.16), topR = avRim(top);
  const bot = AV_CLOTH[a.bottomC] ?? AV_CLOTH[5], botR = avRim(bot), shoe = AV_CLOTH[a.shoesC] ?? AV_CLOTH[7];
  const eyeC = AV_EYEC[a.eyeC] || AV_EYEC[0];
  const tie = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" ${P(top, 1)}/><circle cx="${x - r * 0.35}" cy="${y - r * 0.38}" r="${(r * 0.3).toFixed(2)}" fill="${W}" opacity=".6"/>`;
  const shine = (d, w = 2.4) => line(d, W, w, hShine);
  const strands = (d) => line(d, hStrand, 1.1, special ? 0.35 : 0.55);

  // --- hair (back): in shadow behind the head, so a touch darker ---
  const hairBack = {
    short: '', buzz: '', spiky: '',
    bob: `<path d="M17 44 Q15 9 50 9 Q85 9 83 44 L83 63 Q83 71 74 70 Q68 69 66 66 L34 66 Q32 69 26 70 Q17 71 17 63Z" ${HB}/>` + strands('M21 50 Q20 60 23 67 M79 50 Q80 60 77 67'),
    long: `<path d="M16 44 Q14 8 50 8 Q86 8 84 44 L86 98 Q87 106 80 106 Q74 110 68 105 Q60 109 50 105 Q40 109 32 105 Q26 110 20 106 Q13 106 14 98Z" ${HB}/>` + strands('M20 52 Q17 76 21 100 M80 52 Q83 76 79 100 M26 70 Q24 86 27 102 M74 70 Q76 86 73 102') + galaxyDots([[22, 80, 0.9], [78, 72, 1.1], [24, 96, 0.7], [76, 92, 0.8]]),
    ponytail: `<path d="M70 25 Q101 32 93 70 Q89 93 76 99 Q84 75 75 52Z" ${HB}/>` + strands('M80 34 Q90 52 84 82') + shine('M77 30 Q86 33 89 44', 2) + tie(74, 28, 5),
    pigtails: `<ellipse cx="16" cy="58" rx="8.5" ry="17" ${HB} transform="rotate(12 16 58)"/><ellipse cx="84" cy="58" rx="8.5" ry="17" ${HB} transform="rotate(-12 84 58)"/>` + strands('M15 48 Q12 60 15 72 M85 48 Q88 60 85 72') + shine('M14 47 Q12 53 12.5 58', 1.8) + tie(20, 42, 3.8) + tie(80, 42, 3.8),
    buns: `<circle cx="27" cy="16" r="11" ${HB}/><circle cx="73" cy="16" r="11" ${HB}/>` + strands('M21 13 Q27 9 33 13 M67 13 Q73 9 79 13') + shine('M20 15 Q21 9 26 7.5', 1.8) + shine('M66 15 Q67 9 72 7.5', 1.8),
    curly: [...Array(11)].map((_, i) => { const t = Math.PI * (0.95 + i * 0.11); return `<circle cx="${(50 + 31 * Math.cos(t)).toFixed(1)}" cy="${(40 + 30 * Math.sin(t)).toFixed(1)}" r="11" ${HB}/>`; }).join('') + `<circle cx="21" cy="52" r="9" ${HB}/><circle cx="79" cy="52" r="9" ${HB}/>`
      + [...Array(11)].map((_, i) => { const t = Math.PI * (0.95 + i * 0.11); const x = 50 + 31 * Math.cos(t), y = 40 + 30 * Math.sin(t); return gloss((x - 3.5).toFixed(1), (y - 4).toFixed(1), 3, 1.6, 0.35); }).join(''),
    braid: `<g ${HB}>${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${78 + (k % 2 ? 2 : -1)}" cy="${56 + k * 10}" rx="6.8" ry="6.2"/>`).join('')}</g>` + [0, 1, 2, 3, 4].map((k) => strands(`M${73 + (k % 2 ? 2 : -1)} ${58 + k * 10} Q${78 + (k % 2 ? 2 : -1)} ${55 + k * 10} ${83 + (k % 2 ? 2 : -1)} ${51 + k * 10}`) + gloss(75.5 + (k % 2 ? 2 : -1), 53.5 + k * 10, 2, 1.1, 0.4)).join('') + tie(78, 106, 3.6),
  }[a.hair] || '';
  // --- hair (front): bangs with flowing strands and a glossy band of light, both kept inside the hair ---
  const curls = [26, 36, 46, 56, 66, 74].map((x, i) => `<circle cx="${x}" cy="${22 + (i % 2) * 4}" r="8"/>`).join('');
  const front = {
    short: ['M22 42 Q20 12 50 12 Q80 12 78 42 Q72 26 58 24 Q50 30 40 24 Q28 28 22 42Z', 'M48 13 Q42 18 40 24 M52 13 Q57 18 58 24 M40 15 Q30 22 24 38 M60 15 Q71 22 76 37', 'M28 29 Q33 19 43 16.2 M46.5 15.4 L50 15.2'],
    bob: ['M22 40 Q24 14 50 14 Q76 14 78 40 Q68 30 60 34 Q54 26 46 33 Q36 27 22 40Z', 'M47 15 Q44 22 46 33 M53 15 Q58 24 60 34 M40 16 Q30 24 25 36 M60 16 Q70 23 75 35', 'M28 29 Q33 20 43 17 M46.5 16.3 L50 16.1'],
    long: ['M22 44 Q22 13 50 13 Q78 13 78 44 Q66 24 44 26 Q32 30 22 44Z', 'M54 14 Q46 18 44 26 M44 15 Q32 22 26 38 M60 15 Q72 24 76 38', 'M28 30 Q33 20 43 16.8 M46.5 16 L50 15.8'],
    ponytail: ['M22 40 Q22 13 50 13 Q78 13 78 40 Q70 24 50 24 Q32 24 22 40Z', 'M30 32 Q40 22 50 14 M70 32 Q60 22 50 14 M40 25 Q46 18 50 14 M60 25 Q54 18 50 14', 'M27 29 Q32 19 43 16 M46.5 15.2 L50 15'],
    pigtails: ['M22 40 Q24 13 50 13 Q76 13 78 40 Q68 30 60 33 Q54 25 46 33 Q36 28 22 40Z', 'M50 14 L50 30 M48 15 Q38 20 30 34 M52 15 Q62 20 70 34', 'M28 29 Q33 19 43 16.2 M46 15.4 L48.5 15.2'],
    buns: ['M22 40 Q22 15 50 15 Q78 15 78 40 Q66 28 50 30 Q34 28 22 40Z', 'M50 16 L50 30 M48 17 Q36 22 28 36 M52 17 Q64 22 72 36', 'M28 30 Q33 21 43 18.2 M46 17.4 L48.5 17.2'],
    curly: [curls, '', ''],
    spiky: ['M22 42 L20 22 L30 28 L30 12 L40 22 L46 8 L54 20 L62 8 L66 22 L76 14 L74 28 L82 26 L78 42 Q66 28 50 28 Q34 28 22 42Z', 'M31 15 L34 30 M46 10 L47 27 M61 10 L58 27 M75 16 L69 31 M22 24 L28 34', 'M31.5 17 L33 25 M46.5 12 L47.2 19 M61 12 L59.8 18'],
    braid: ['M22 42 Q20 12 50 12 Q80 12 80 44 Q70 24 54 24 Q36 24 22 42Z', 'M52 13 Q53 18 54 24 M50 14 Q36 18 26 36 M56 14 Q70 18 77 36', 'M28 29 Q33 19 43 15.8 M46.5 15 L50 14.8'],
    buzz: ['M23 40 Q22 14 50 14 Q78 14 77 40 Q70 22 50 22 Q30 22 23 40Z', '', 'M30 27 Q35 19.5 44 17'],
  }[a.hair];
  let hairFront = '';
  if (front) {
    const [shp, st, sh] = front, el = shp.startsWith('<') ? shp : `<path d="${shp}"/>`;
    defs += `<clipPath id="${g}k">${el}</clipPath>`;
    const curlGloss = a.hair === 'curly' ? [26, 36, 46, 56, 66, 74].map((x, i) => gloss(x - 2.4, 19 + (i % 2) * 4, 2.6, 1.4, hShine * 0.85)).join('') : '';
    hairFront = `<g ${HF}${a.hair === 'buzz' ? ' opacity=".6"' : ''}>${el}</g><g clip-path="url(#${g}k)">${st ? strands(st) : ''}${sh ? shine(sh, a.hair === 'buzz' ? 1.8 : 2.4) : ''}${curlGloss}</g>`;
  }
  const hairDots = special && hairFront ? galaxyDots([[34, 20, 1.1], [62, 18, 0.9], [70, 27, 0.7], [44, 23, 0.6], [55, 16, 0.7]]) : '';
  // --- face: big glossy chibi eyes, pink blush ---
  const ey = 46.5, ex = 11.5;
  const iris = eyeC === AV_EYEC[0] ? ink : eyeC;
  const shines = (x, k = 1) => `<circle cx="${(x + 1.5 * k).toFixed(2)}" cy="${(ey - 2 * k).toFixed(2)}" r="${(1.75 * k).toFixed(2)}" fill="${W}"/><circle cx="${(x - 1.4 * k).toFixed(2)}" cy="${(ey + 2.2 * k).toFixed(2)}" r="${(0.8 * k).toFixed(2)}" fill="${W}" opacity=".8"/>`;
  const arc = (d) => `<path d="${d}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const eye = (x, kind) => {
    if (kind === 'happy') return arc(`M${x - 4.5} ${ey + 1} Q${x} ${ey - 5} ${x + 4.5} ${ey + 1}`);
    if (kind === 'sleepy') return arc(`M${x - 4.5} ${ey} Q${x} ${ey + 3.5} ${x + 4.5} ${ey}`) + line(`M${x - 3} ${ey + 3.6} Q${x} ${ey + 4.8} ${x + 3} ${ey + 3.6}`, ink, 1, 0.35);
    if (kind === 'sparkle') return `<ellipse cx="${x}" cy="${ey}" rx="5" ry="6" fill="${iris}"/><ellipse cx="${x}" cy="${ey + 2.6}" rx="3.2" ry="2" fill="${mixHex(iris, W, 0.45)}" opacity=".7"/><ellipse cx="${x}" cy="${ey + 0.8}" rx="2.4" ry="3" fill="${ink}"/><path d="M${x + 1.8} ${ey - 5} l.7 1.9 1.9 .7 -1.9 .7 -.7 1.9 -.7 -1.9 -1.9 -.7 1.9 -.7Z" fill="${W}"/><circle cx="${x - 1.8}" cy="${ey + 2.8}" r="1" fill="${W}"/>`;
    if (kind === 'star') return `<path d="M${x} ${ey - 6} l1.8 4 4.2.4 -3.2 2.8 1 4.2 -3.8 -2.3 -3.8 2.3 1 -4.2 -3.2 -2.8 4.2 -.4Z" fill="${iris === ink ? '#ffc53d' : iris}" stroke="${avRim(iris === ink ? '#ffc53d' : iris)}" stroke-width="1"/><circle cx="${x - 0.9}" cy="${ey - 1.6}" r="1.1" fill="${W}" opacity=".9"/>`;
    const lower = iris === ink ? '' : `<ellipse cx="${x}" cy="${ey + 2.5}" rx="2.8" ry="1.8" fill="${mixHex(iris, W, 0.4)}" opacity=".75"/><ellipse cx="${x}" cy="${ey + 0.4}" rx="2.2" ry="2.8" fill="${ink}"/>`;
    return `<ellipse cx="${x}" cy="${ey}" rx="4.2" ry="5.2" fill="${iris}"/>${lower}${shines(x)}`;
  };
  const lashes = (x, d) => line(`M${x + d * 3.4} ${ey - 3.8} l${d * 2.4} -2 M${x + d * 4.3} ${ey - 1.6} l${d * 2.7} -.8`, ink, 1.5, 1);
  let eyes;
  if (a.eyes === 'wink') eyes = eye(50 - ex, 'round') + eye(50 + ex, 'happy');
  else eyes = eye(50 - ex, a.eyes) + eye(50 + ex, a.eyes) + (a.eyes === 'lashes' ? lashes(50 - ex, -1) + lashes(50 + ex, 1) : '');
  const my = 57;
  const mouthIn = '#8a3048', tongue = '#ff7a98';
  const mouth = {
    smile: `<path d="M45.5 ${my} Q50 ${my + 4.6} 54.5 ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    grin: `<path d="M42.5 ${my - 1} Q50 ${my - 2} 57.5 ${my - 1} Q56 ${my + 8} 50 ${my + 8} Q44 ${my + 8} 42.5 ${my - 1}Z" fill="${mouthIn}" stroke="${mixHex(mouthIn, AV_SHADE, 0.3)}" stroke-width="1"/><path d="M44 ${my - 0.6} Q50 ${my - 1.4} 56 ${my - 0.6} L55.2 ${my + 1.8} Q50 ${my + 2.4} 44.8 ${my + 1.8}Z" fill="${W}"/><ellipse cx="50" cy="${my + 6}" rx="3.6" ry="1.7" fill="${tongue}"/>`,
    open: `<ellipse cx="50" cy="${my + 1.2}" rx="3.8" ry="4.6" fill="${mouthIn}" stroke="${mixHex(mouthIn, AV_SHADE, 0.3)}" stroke-width="1"/><ellipse cx="50" cy="${my + 3.4}" rx="2.5" ry="1.5" fill="${tongue}"/>`,
    cat: `<path d="M43.5 ${my - 0.5} Q46.7 ${my + 3.6} 50 ${my - 0.3} Q53.3 ${my + 3.6} 56.5 ${my - 0.5}" stroke="${ink}" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    tongue: `<path d="M48 ${my + 2} Q48 ${my + 7.6} 50.6 ${my + 7.4} Q53.2 ${my + 7.2} 53.2 ${my + 2}Z" fill="${tongue}" stroke="${mixHex(tongue, AV_SHADE, 0.3)}" stroke-width=".9"/><path d="M45 ${my} Q50 ${my + 4.6} 55 ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    smirk: `<path d="M45 ${my + 1} Q51.5 ${my + 4} 56.5 ${my - 1.6}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  }[a.mouth] || '';
  const facial = {
    stubble: `<path d="M27 50 Q29 70 50 70 Q71 70 73 50 Q68 63 50 63 Q32 63 27 50Z" fill="${hBase}" opacity=".26"/><path d="M41 54.5 Q50 51.5 59 54.5 Q50 53.5 41 54.5Z" fill="${hBase}" opacity=".32"/>`,
    goatee: `<path d="M44 61 Q50 74 56 61 Q50 64.5 44 61Z" ${HF}/>`,
    beard: `<path d="M23.5 44 Q22.5 76 50 76 Q77.5 76 76.5 44 L72 45 Q71 61 61 62 Q57 59.5 50 60 Q43 59.5 39 62 Q29 61 28 45Z" ${HF}/>` + strands('M30 56 Q33 66 40 70 M70 56 Q67 66 60 70 M50 66 L50 73') + gloss(31, 60, 2.4, 1.3, 0.35, 50),
  }[a.facial] || '';
  const stache = ['mustache', 'goatee', 'beard'].includes(a.facial) ? `<path d="M40.5 55.5 Q44 51 50 53.6 Q56 51 59.5 55.5 Q55 57.6 50 55.8 Q45 57.6 40.5 55.5Z" ${HF}/>` + gloss(44, 53.6, 1.8, 0.8, 0.45, -10) : '';
  const cheeks = (a.blush !== false ? `<ellipse cx="32.5" cy="${ey + 7.2}" rx="5.4" ry="3.1" fill="${AV_BLUSH}" opacity=".55"/><ellipse cx="67.5" cy="${ey + 7.2}" rx="5.4" ry="3.1" fill="${AV_BLUSH}" opacity=".55"/>` : '')
    + (a.freckles ? [[33, 51.5], [36.5, 53.5], [30, 53.8], [67, 51.5], [63.5, 53.5], [70, 53.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".95" fill="${skinD}" opacity=".85"/>`).join('') : '');
  // --- body & clothes (a head-only render is cropped above the shoulders, so skip them) ---
  let bodyEls = '';
  if (!opts.head) {
    const dressy = a.top === 'dress' || a.top === 'gown';
    const legC = dressy || a.bottom === 'skirt' || (a.bottom === 'shorts' && !dressy) ? skin : bot;
    const slim = a.bottom === 'leggings' && !dressy;
    const legs = ['l', 'r'].map((side) => {
      const x = side === 'l' ? 38 : 52, cx = x + 5;
      const shorts = a.bottom === 'shorts' && !dressy ? `<path d="M${x - 0.5} 103 h11 v11 q0 2.5 -2.5 2.5 h-6 q-2.5 0 -2.5 -2.5Z" ${P(bot)}/>${line(`M${x + 1.5} 113.5 h7`, botR, 1, 0.5)}` : '';
      const cuff = legC === bot && !slim && a.shoes !== 'boots' ? line(`M${x + 1} 126 q4 1.4 8 0`, botR, 1, 0.55) : '';
      const shoeEl = {
        boots: `<path d="M${x - 1} 122 h12 v14 q0 4 -4 4 h-13 q-4 0 -4 -3.4 q0 -3.6 5 -3.6 h4Z" ${P(shoe)}/><rect x="${x - 1.5}" y="120.5" width="13" height="4.4" rx="2.2" ${P(mixHex(shoe, AV_SHADE, 0.12), 1)}/>${gloss(x + 2, 127, 1.6, 3.2, 0.45, 8)}`,
        sandals: `<ellipse cx="${cx}" cy="139" rx="8.2" ry="3.4" ${P(shoe)}/><path d="M${x + 0.5} 134.5 Q${cx} 139 ${x + 9.5} 134.5" stroke="${shoe}" stroke-width="2.4" fill="none" stroke-linecap="round"/>${line(`M${x + 0.5} 134.5 Q${cx} 139 ${x + 9.5} 134.5`, avRim(shoe), 0.8, 0.6)}`,
        slippers: `<ellipse cx="${x + 1.8}" cy="130.5" rx="2.2" ry="5.2" ${P(W, 1)} transform="rotate(-10 ${x + 1.8} 130.5)"/><ellipse cx="${x + 7.6}" cy="130.5" rx="2.2" ry="5.2" ${P(W, 1)} transform="rotate(10 ${x + 7.6} 130.5)"/><ellipse cx="${x + 1.8}" cy="131" rx="1" ry="3.2" fill="#ffc9de" transform="rotate(-10 ${x + 1.8} 131)"/><ellipse cx="${x + 7.6}" cy="131" rx="1" ry="3.2" fill="#ffc9de" transform="rotate(10 ${x + 7.6} 131)"/><ellipse cx="${cx}" cy="137.5" rx="9.2" ry="5.6" ${P(W)}/><circle cx="${cx - 2.4}" cy="136.4" r=".9" fill="${ink}"/><circle cx="${cx + 2.4}" cy="136.4" r=".9" fill="${ink}"/><ellipse cx="${cx}" cy="138.2" rx="1.2" ry=".9" fill="${AV_BLUSH}"/>`,
      }[a.shoes] || `<path d="M${x - 3} 134.5 q0 -4.5 5 -4.5 h6 q5.5 0 6.5 4.5 v2.6 q0 2.4 -2.4 2.4 h-12.7 q-2.4 0 -2.4 -2.4Z" ${P(shoe)}/><path d="M${x - 2.6} 137.4 h15.8" stroke="${shoe === W ? '#dfe3ea' : W}" stroke-width="1.8" stroke-linecap="round"/>${line(`M${x + 2.5} 131.6 l2 1.6 M${x + 5} 131.2 l2 1.6`, avRim(shoe), 0.9, 0.7)}${gloss(x + 0.8, 132.6, 1.8, 0.9, 0.6, -15)}`;
      const legEl = `<rect x="${slim ? x + 0.6 : x}" y="102" width="${slim ? 8.8 : 10}" height="${a.shoes === 'boots' ? 24 : 32}" rx="${slim ? 4.4 : 5}" ${P(legC, 1.2)}/>`;
      return `<g class="leg leg-${side}">${legEl}${cuff}${shorts}${shoeEl}</g>`;
    }).join('');
    const torsoD = 'M30.5 81 Q30.5 71 40 70 L60 70 Q69.5 71 69.5 81 L70 104 Q70 109 65 109 L35 109 Q30 109 30 104Z';
    const torso = `<path d="${torsoD}" ${P(top)}/>` + gloss(36.5, 77.5, 3.6, 2, 0.4);
    const folds = line('M34 100 q3 -2.4 6 -.6 M60 101 q3 -2 6 .4 M44 106 q3 1.2 6 0', topR, 1, 0.45);
    const neckline = `<path d="M43 70.2 Q50 76 57 70.2" fill="${skin}" stroke="${topR}" stroke-width="1.2" opacity=".95"/>`;
    const graphic = {
      heart: `<path d="M50 96 C42 90 41 85 44 83 C47 81 49 83 50 85 C51 83 53 81 56 83 C59 85 58 90 50 96Z" fill="${W}" opacity=".92"/>${gloss(45.4, 84.4, 1.4, 0.8, 0.9)}`,
      star: `<path d="M50 80 l2.6 5.4 5.9.8 -4.3 4.1 1 5.9 -5.2 -2.8 -5.2 2.8 1 -5.9 -4.3 -4.1 5.9 -.8Z" ${P(yel, 1)}/>`,
      bolt: `<path d="M52 79 L44 91 L50 91 L47 100 L57 87 L51 87 L54 79Z" ${P(yel, 1)}/>`,
      rainbow: `<path d="M40 94 a10 10 0 0 1 20 0" stroke="#ff6b6b" stroke-width="2.6" fill="none"/><path d="M42.6 94 a7.4 7.4 0 0 1 14.8 0" stroke="${yel}" stroke-width="2.6" fill="none"/><path d="M45.2 94 a4.8 4.8 0 0 1 9.6 0" stroke="#4dabf7" stroke-width="2.6" fill="none"/><ellipse cx="40.5" cy="95" rx="3" ry="1.8" fill="${W}"/><ellipse cx="59.5" cy="95" rx="3" ry="1.8" fill="${W}"/>`,
      squish: `<circle cx="50" cy="89" r="7" ${P('#ffc9de', 1)}/><circle cx="47.5" cy="88.3" r="1.1" fill="${ink}"/><circle cx="52.5" cy="88.3" r="1.1" fill="${ink}"/><circle cx="47.9" cy="87.9" r=".4" fill="${W}"/><circle cx="52.9" cy="87.9" r=".4" fill="${W}"/><ellipse cx="45.6" cy="90.6" rx="1.4" ry=".8" fill="${AV_BLUSH}" opacity=".7"/><ellipse cx="54.4" cy="90.6" rx="1.4" ry=".8" fill="${AV_BLUSH}" opacity=".7"/><path d="M48.6 91 q1.4 1.3 2.8 0" stroke="${ink}" stroke-width=".9" fill="none" stroke-linecap="round"/>${gloss(46.5, 85.2, 1.8, 1, 0.6)}`,
    }[a.graphic] || '';
    const outfit = {
      tee: torso + neckline + folds + graphic,
      tank: `<path d="M36 81 Q36 71 41 70 L59 70 Q64 71 64 81 L68 104 Q68.5 109 63.5 109 L36.5 109 Q31.5 109 32 104Z" ${P(top)}/>` + gloss(39.5, 78, 2.4, 1.6, 0.4) + `<path d="M43.5 70.2 Q50 78 56.5 70.2" fill="${skin}" stroke="${topR}" stroke-width="1.2"/>` + folds + graphic,
      hoodie: `<ellipse cx="50" cy="72" rx="15.5" ry="6.2" ${P(topD)}/>` + torso + `<path d="M42 71 Q50 77 58 71" fill="none" stroke="${topR}" stroke-width="1.2" opacity=".7"/><path d="M40 96 h20 v6 q0 3 -3 3 h-14 q-3 0 -3 -3Z" ${P(topD, 1)}/>${line('M41 99 h18', topR, 0.8, 0.4)}<path d="M46 74 v10 M54 74 v10" stroke="${W}" stroke-width="1.4" stroke-linecap="round"/><circle cx="46" cy="84.6" r="1.2" fill="${W}"/><circle cx="54" cy="84.6" r="1.2" fill="${W}"/>${line('M31 105.5 h38', topR, 1, 0.45)}` + graphic,
      sweater: torso + [80, 88, 96].map((y) => `<rect x="30.6" y="${y}" width="38.8" height="3.4" fill="${W}" opacity=".55"/>`).join('') + `<rect x="31" y="103.6" width="38" height="3.4" rx="1.4" fill="${W}" opacity=".55"/>` + neckline + line('M43.5 72 Q50 77.2 56.5 72', topR, 1.6, 0.4),
      jacket: torso + `<path d="M39.5 70.4 L46.5 81 L50 72.5 L53.5 81 L60.5 70.4 Q50 74 39.5 70.4Z" fill="${W}" stroke="#dfe3ea" stroke-width="1"/><path d="M50 72.5 L50 108.5" stroke="${topR}" stroke-width="1.6"/><path d="M40 70.6 L46.5 81 L44 88 M60 70.6 L53.5 81 L56 88" stroke="${topR}" stroke-width="1.3" fill="none" stroke-linejoin="round" opacity=".8"/><circle cx="47" cy="92" r="1.3" ${P(topD, 0.6)}/><circle cx="47" cy="100" r="1.3" ${P(topD, 0.6)}/>` + folds,
      dress: `<path d="M33 81 Q33 71 40 70 L60 70 Q67 71 67 81 L69 98 L31 98Z" ${P(top)}/>` + gloss(38, 77.5, 3.2, 1.8, 0.4) + `<path d="M31.5 95 L20 123 Q50 132 80 123 L68.5 95Z" ${P(top)}/>` + line('M38 101 L33 124 M50 100 L50 127 M62 101 L67 124', topR, 1.1, 0.4) + `<path d="M21.5 120 Q50 128.5 78.5 120" stroke="${W}" stroke-width="2" fill="none" opacity=".75" stroke-linecap="round"/><rect x="31" y="93.5" width="38" height="4.5" rx="2.25" ${P(topD, 0.8)}/>` + gloss(28, 108, 2, 5, 0.35, 22) + neckline + graphic,
      gown: `<path d="M34 81 Q34 71 40 70 L60 70 Q66 71 66 81 L68 96 L32 96Z" ${P(top)}/>` + gloss(39, 77.5, 3, 1.7, 0.45) + `<path d="M32 94 L12 131 Q50 142 88 131 L68 94Z" ${P(top)}/>` + line('M33 96 Q28 112 23 131 M50 97 L50 136 M67 96 Q72 112 77 131 M42 97 Q40 116 37 134 M58 97 Q60 116 63 134', topR, 1.1, 0.35) + `<path d="M14 128 Q50 139.5 86 128" stroke="${W}" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/><path d="M34 82 Q50 90 66 82" stroke="${yel}" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="50" cy="86" r="2" ${P('#ff6b9d', 0.8)}/>${[[24, 120], [44, 126], [62, 118], [76, 128], [36, 108], [56, 108]].map(([x, y]) => `<path d="M${x} ${y - 2} l.6 1.4 1.4 .6 -1.4 .6 -.6 1.4 -.6 -1.4 -1.4 -.6 1.4 -.6Z" fill="${W}" opacity=".9"/>`).join('')}` + gloss(22, 112, 2.2, 6, 0.35, 28) + neckline,
      overalls: torso + neckline + `<path d="M36 84 h28 v21 q0 4 -4 4 h-20 q-4 0 -4 -4Z" ${P(bot)}/><path d="M38.5 84.5 L38.5 70.5 M61.5 84.5 L61.5 70.5" stroke="${bot}" stroke-width="4" stroke-linecap="round"/>${line('M37.3 84 L37.3 71 M60.3 84 L60.3 71', W, 0.8, 0.3)}<circle cx="39" cy="86.4" r="1.8" ${P(yel, 0.6)}/><circle cx="61" cy="86.4" r="1.8" ${P(yel, 0.6)}/><rect x="44" y="90" width="12" height="7" rx="2" ${P(mixHex(bot, AV_SHADE, 0.12), 0.8)}/>${line('M40 105 q4 1.4 8 0 M52 105 q4 1.4 8 0', botR, 1, 0.45)}`,
      cape: torso + neckline + folds + graphic + `<circle cx="38.6" cy="73.5" r="2.4" ${P(yel, 0.8)}/><circle cx="61.4" cy="73.5" r="2.4" ${P(yel, 0.8)}/>`,
    }[a.top] || torso;
    const capeC = '#e63946';
    const capeBack = a.top === 'cape' ? `<path d="M34 72 L17 127 Q50 137 83 127 L66 72Z" ${P(capeC)}/>${line('M40 80 L30 128 M60 80 L70 128 M50 80 L50 132', avRim(capeC), 1.1, 0.45)}` : '';
    const skirt = a.bottom === 'skirt' && !dressy ? `<path d="M30.5 103 L24 121 Q50 128 76 121 L69.5 103Z" ${P(bot)}/>${line('M38 105 L34 123 M50 105 L50 125 M62 105 L66 123', botR, 1, 0.4)}<path d="M25.5 119 Q50 126 74.5 119" stroke="${W}" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>` : '';
    const pantsTop = !dressy && a.bottom !== 'skirt' && a.top !== 'overalls' ? `<rect x="30" y="102" width="40" height="8" rx="3" ${P(bot)}/>${line('M50 106 v4', botR, 1, 0.5)}` : '';
    const longSleeve = !(a.top === 'tee' || dressy || a.top === 'tank' || a.top === 'cape');
    const arm = (side) => {
      const d = side === 'l' ? -1 : 1, sx = 50 + d * 17, hx = 50 + d * 28;
      const skinArm = U(skin, `<path d="${avCap(sx, 76, hx, 99.5, 4.1)}"/><circle cx="${hx}" cy="101" r="4.7"/>`);
      const ex2 = sx + d * (longSleeve ? 10 : 5), ey2 = longSleeve ? 96 : 85;
      const sleeve = a.top === 'tank' ? '' : `<path d="${avCap(sx, 76, ex2, ey2, longSleeve ? 4.9 : 5.2)}" ${P(top, 1.2)}/>` + (longSleeve ? `<ellipse cx="${ex2}" cy="${ey2 + 1}" rx="4.4" ry="2.4" ${P(topD, 0.8)} transform="rotate(${d * -23} ${ex2} ${ey2 + 1})"/>` : line(`M${ex2 - 3.6} ${ey2 + 1.6} Q${ex2} ${ey2 + 3.6} ${ex2 + 3.6} ${ey2 + 1.6}`, topR, 1, 0.5));
      // Pivot at the shoulder whatever the arm's outline (waves rotate around it)
      return `<g class="arm arm-${side}" style="transform-box:view-box;transform-origin:${sx}px 76px">${skinArm}${sleeve}${gloss(hx - 1.6, 99.2, 1.4, 0.9, 0.5)}</g>`;
    };
    const neck = `<rect x="45" y="63" width="10" height="10" fill="${skin}"/><ellipse cx="50" cy="69.6" rx="7.4" ry="2.6" fill="${AV_SHADE}" opacity=".16"/>`;
    bodyEls = { capeBack, legs, skirt, pantsTop, armL: arm('l'), outfit, neck, armR: arm('r') };
  }
  // --- accessories ---
  const gold = '#ffd23f', pink = '#ff6b9d';
  const star5 = (x, y, s = 1) => `M${x} ${y - 4 * s} l${1.8 * s} ${3.6 * s} ${4 * s} ${0.5 * s} ${-2.9 * s} ${2.8 * s} ${0.7 * s} ${4 * s} ${-3.6 * s} ${-1.9 * s} ${-3.6 * s} ${1.9 * s} ${0.7 * s} ${-4 * s} ${-2.9 * s} ${-2.8 * s} ${4 * s} ${-0.5 * s}Z`;
  const acc = {
    glasses: `<g fill="${W}" fill-opacity=".18" stroke="#4a3b55" stroke-width="1.9"><circle cx="38.5" cy="46.5" r="6.6"/><circle cx="61.5" cy="46.5" r="6.6"/></g><path d="M45.1 46 Q50 44 54.9 46 M31.9 45.5 L24 44 M68.1 45.5 L76 44" stroke="#4a3b55" stroke-width="1.8" fill="none" stroke-linecap="round"/>${line('M34.5 43.2 q1.6 -1.6 3.6 -1.8 M57.5 43.2 q1.6 -1.6 3.6 -1.8', W, 1.2, 0.8)}`,
    sunglasses: `<rect x="30.5" y="41" width="16" height="10.5" rx="4.6" ${P('#2b2236', 1)}/><rect x="53.5" y="41" width="16" height="10.5" rx="4.6" ${P('#2b2236', 1)}/><path d="M46.5 45 Q50 43.6 53.5 45 M30.5 44 L24 43 M69.5 44 L76 43" stroke="#2b2236" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M33.5 47 l5 -4.5 M56.5 47 l5 -4.5" stroke="${W}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`,
    bow: `<path d="M68 16 L57.5 8.5 Q55 16 57.5 23.5Z" ${P(pink)}/><path d="M68 16 L78.5 8.5 Q81 16 78.5 23.5Z" ${P(pink)}/><circle cx="68" cy="16" r="3.4" ${P('#e64980', 1)}/>${gloss(59.6, 12.5, 1.6, 0.9, 0.6)}${gloss(74.5, 12, 1.6, 0.9, 0.5, 28)}`,
    flower: `<g transform="translate(73 24)">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-5" rx="3.6" ry="5" ${P(W, 1)} transform="rotate(${r})"/>`).join('')}<circle r="3.1" ${P(yel, 0.9)}/><circle cx="-1" cy="-1" r=".9" fill="${W}" opacity=".7"/></g>`,
    cap: `<path d="M22 32 Q22 10 50 10 Q78 10 78 32Z" ${P(top)}/><path d="M50 30 Q82 28 92 34 Q80 38.5 50 34Z" ${P(topD)}/>${line('M50 11 Q46 20 46 31 M36 14 Q32 22 31 31', topR, 1, 0.45)}<circle cx="50" cy="11" r="2.4" ${P(topD, 0.8)}/>${gloss(32, 20, 4, 2, 0.45)}`,
    beanie: `<path d="M21 34 Q21 8 50 8 Q79 8 79 34Z" ${P(top)}/>${line('M35 12 Q32 22 32 30 M50 9 L50 30 M65 12 Q68 22 68 30', topR, 1, 0.4)}<rect x="19" y="28" width="62" height="9" rx="4.5" ${P(topD)}/>${line('M25 30.5 v4 M31 30.5 v4 M37 30.5 v4 M43 30.5 v4 M49 30.5 v4 M55 30.5 v4 M61 30.5 v4 M67 30.5 v4 M73 30.5 v4', avRim(topD), 0.9, 0.45)}<circle cx="50" cy="6" r="5" ${P(W, 1.1)}/>${gloss(31, 18, 4, 2, 0.45)}`,
    headphones: `<path d="M20 44 Q20 10 50 10 Q80 10 80 44" stroke="#5c5470" stroke-width="4.2" fill="none" stroke-linecap="round"/>${line('M24 30 Q30 15 46 13', W, 1.2, 0.45)}<rect x="13.5" y="37.5" width="11" height="17" rx="4.5" ${P(top)}/><rect x="75.5" y="37.5" width="11" height="17" rx="4.5" ${P(top)}/>${gloss(16.5, 41.5, 1.4, 2.6, 0.55, 10)}${gloss(78.5, 41.5, 1.4, 2.6, 0.45, 10)}`,
    starclips: `<path d="${star5(30, 26)}" ${P(yel, 1)}/><path d="${star5(70, 26)}" ${P(yel, 1)}/><circle cx="29" cy="24.5" r=".9" fill="${W}" opacity=".8"/><circle cx="69" cy="24.5" r=".9" fill="${W}" opacity=".8"/>`,
    catears: `<path d="M24 26 L26 4 L42 18Z M76 26 L74 4 L58 18Z" ${HF}/><path d="M28 20 L29 10 L37 17Z M72 20 L71 10 L63 17Z" fill="${AV_BLUSH}"/>`,
    bunnyears: `<ellipse cx="38" cy="0" rx="6" ry="16" ${P(W)} transform="rotate(-10 38 0)"/><ellipse cx="62" cy="0" rx="6" ry="16" ${P(W)} transform="rotate(10 62 0)"/><ellipse cx="38.3" cy="2" rx="2.8" ry="10" fill="#ffc9de" transform="rotate(-10 38.3 2)"/><ellipse cx="62.3" cy="2" rx="2.8" ry="10" fill="#ffc9de" transform="rotate(10 62.3 2)"/>`,
    tiara: `<path d="M32 16 L36 6 L42 13 L50 2 L58 13 L64 6 L68 16 Q50 12 32 16Z" ${P('#e3e8f0', 1.1)}/><circle cx="50" cy="9" r="2.6" ${P(pink, 0.8)}/><circle cx="38" cy="12" r="1.5" ${P('#4dabf7', 0.6)}/><circle cx="62" cy="12" r="1.5" ${P('#4dabf7', 0.6)}/><circle cx="49.2" cy="8.2" r=".8" fill="${W}"/>`,
    crown: `<path d="M33 16 L35 0 L43 8 L50 -4 L57 8 L65 0 L67 16Z" ${P(gold)}/><path d="M33.5 13 Q50 11 66.5 13" stroke="${avRim(gold)}" stroke-width="1" fill="none" opacity=".6"/><circle cx="50" cy="8" r="2.6" ${P('#ff4d8d', 0.8)}/><circle cx="49.2" cy="7.2" r=".8" fill="${W}"/><circle cx="35" cy="0" r="1.6" ${P(gold, 0.6)}/><circle cx="50" cy="-4" r="1.6" ${P(gold, 0.6)}/><circle cx="65" cy="0" r="1.6" ${P(gold, 0.6)}/>${gloss(38.5, 8, 1.2, 3, 0.6, 10)}`,
    halo: `<ellipse cx="50" cy="0" rx="17" ry="4.6" fill="none" stroke="${avRim(gold)}" stroke-width="4.6"/><ellipse cx="50" cy="0" rx="17" ry="4.6" fill="none" stroke="${gold}" stroke-width="3"/><path d="M37 -2.2 Q43 -4.2 50 -4.4" stroke="${W}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8"/>`,
  }[a.acc] || '';
  const behind = a.acc === 'bunnyears' || a.acc === 'halo';
  defs += `<radialGradient id="${g}s"><stop offset="0" stop-color="${AV_SHADE}" stop-opacity=".3"/><stop offset="1" stop-color="${AV_SHADE}" stop-opacity="0"/></radialGradient>`;
  const shadow = opts.noShadow ? '' : `<ellipse cx="50" cy="140.5" rx="24" ry="4.6" fill="url(#${g}s)"/>`;
  const headD = 'M50 15 C67 15 77.6 27 77.6 43 C77.6 59 66 69 50 69 C34 69 22.4 59 22.4 43 C22.4 27 33 15 50 15Z';
  const ears = [23, 77].map((x) => `<circle cx="${x}" cy="47" r="5" ${P(skin, 1.1)}/>` + line(`M${x + (x < 50 ? -1.4 : 1.4)} 44.6 q${x < 50 ? 1.8 : -1.8} 2.4 0 4.8`, skinR, 1.1, 0.5)).join('');
  const head = `<path d="${headD}" ${P(skin, 1.3)}/>` + gloss(29.5, 52, 2.4, 1.4, 0.4, -40);
  return `<svg class="av-svg${opts.cls ? ' ' + opts.cls : ''}" viewBox="${opts.head ? '12 -8 76 76' : '0 -12 100 158'}" role="img" aria-label="Avatar"><defs>${defs}</defs>
    ${shadow}<g class="av-body" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke">${bodyEls.capeBack || ''}${hairBack}${behind ? acc : ''}${bodyEls ? `${bodyEls.legs}${bodyEls.skirt}${bodyEls.pantsTop}<g class="arm-back">${bodyEls.armL}</g>${bodyEls.outfit}${bodyEls.neck}${bodyEls.armR}` : ''}
    <g class="av-head">${ears}${head}${cheeks}<g class="av-eyes">${eyes}</g>${facial}${mouth}${stache}${hairFront}${hairDots}${behind ? '' : acc}</g></g></svg>`;
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
    face: `<div class="av-label">Start with a look</div><div class="av-looks">${(isKidMember(mid) ? [['boy', '👦', 'Boy'], ['girl', '👧', 'Girl']] : [['man', '👨', 'Man'], ['woman', '👩', 'Woman']]).map(([k, e, l]) => `<button class="${a.look === k ? 'on' : ''}" data-action="av-look" data-look="${k}" data-id="${mid}"><span>${e}</span>${l}</button>`).join('')}</div>
      <div class="av-label">Skin</div>${swatches('skin', AV_SKIN.map((c, i) => [i, c]))}
      <div class="av-label">Eyes</div><div class="av-grid">${Object.entries(AV_EYES).map(([k, [l]]) => opt('eyes', k, l)).join('')}</div>
      <div class="av-label">Eye color</div>${swatches('eyeC', AV_EYEC.map((c, i) => [i, c]))}
      <div class="av-label">Mouth</div><div class="av-grid">${Object.entries(AV_MOUTH).map(([k, l]) => opt('mouth', k, l)).join('')}</div>
      <div class="av-toggles"><button class="${a.blush !== false ? 'on' : ''}" data-action="av-toggle" data-k="blush" data-id="${mid}">🌸 Blush</button><button class="${a.freckles ? 'on' : ''}" data-action="av-toggle" data-k="freckles" data-id="${mid}">✨ Freckles</button></div>`,
    hair: `<div class="av-label">Color</div>${swatches('hairC', hairSw)}<div class="av-label">Style</div><div class="av-grid">${Object.entries(AV_HAIR).map(([k, l]) => opt('hair', k, l)).join('')}</div>
      <div class="av-label">Facial hair</div><div class="av-grid">${Object.entries(AV_FACIAL).map(([k, l]) => opt('facial', k, l)).join('')}</div>`,
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
for (const a of ['av-set', 'av-tab', 'av-toggle', 'av-random', 'av-look']) KID_ACTIONS.add(a);
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
  'av-look': (el) => {
    const mid = el.dataset.id, look = el.dataset.look, a = avatarOf(mid);
    const p = { ...AV_LOOKS[look] };
    if (p.acc !== 'none' && avItemLock(mid, 'acc', p.acc)) p.acc = 'none';
    setAvatar(mid, { ...p, look, skin: a.skin, hairC: a.hairC, eyeC: a.eyeC });
    render();
    $('.av-big')?.classList.add('bounce');
  },
  'av-random': (el) => {
    const mid = el.dataset.id, a = avatarOf(mid), pick = (o, kind = 'x') => { const ks = Object.keys(o).filter((k) => !avItemLock(mid, kind, k)); return ks[Math.floor(Math.random() * ks.length)]; };
    const n = (len) => Math.floor(Math.random() * len);
    const masc = a.look === 'boy' || a.look === 'man';
    const only = (o, drop) => Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k)));
    const hairs = masc ? only(AV_HAIR, ['long', 'pigtails', 'buns', 'braid', 'ponytail', 'bob']) : AV_HAIR;
    const tops = masc ? only(AV_TOP, ['dress', 'gown']) : AV_TOP;
    const bottoms = masc ? only(AV_BOTTOM, ['skirt', 'leggings']) : AV_BOTTOM;
    const accs = masc ? only(AV_ACC, ['bow', 'flower', 'tiara', 'starclips', 'bunnyears']) : AV_ACC;
    const eyesList = masc ? only(AV_EYES, ['lashes']) : AV_EYES;
    setAvatar(mid, { hair: pick(hairs), hairC: pick(AV_HAIRC, 'hairC'), eyes: pick(eyesList, 'eyes'), eyeC: n(AV_EYEC.length), mouth: pick(AV_MOUTH), top: pick(tops, 'top'), topC: n(AV_CLOTH.length), graphic: pick(AV_GRAPHIC, 'graphic'), bottom: pick(bottoms), bottomC: n(AV_CLOTH.length), shoes: pick(AV_SHOES, 'shoes'), shoesC: n(AV_CLOTH.length), acc: Math.random() < 0.5 ? 'none' : pick(accs, 'acc'), facial: a.look === 'man' ? pick(AV_FACIAL) : 'none', skin: a.skin });
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
