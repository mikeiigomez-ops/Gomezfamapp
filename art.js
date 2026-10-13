/* Gomez art kit: the app's own illustrations, drawn in one "clay" style.
   Every piece is a list of shapes with a base color; the style (soft 3D light from the top-left, a glossy
   highlight, a soft shadow) is applied here, so everything matches and the look can change in one place.
   Art data lives in art-icons.js, art-house.js … and registers into ART (by id) and ART_EMOJI (emoji → id),
   so any tile, sticker or furniture piece that still shows that emoji gets the drawing instead. */
'use strict';

const ART = {};        // id → parts
const ART_EMOJI = {};  // emoji → id
const ART_INK = '#3a2b3d';
const artHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const artToHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const artMix = (a, b, t) => artToHex(artHex(a).map((v, i) => v + (artHex(b)[i] - v) * t));
const artLight = (c, t) => artMix(c, '#ffffff', t);
const artDark = (c, t) => artMix(c, '#2a1830', t);

/* Part shapes: { d } path · { e:[cx,cy,rx,ry] } ellipse · { r:[x,y,w,h,rx] } rect · { c2:[cx,cy,r] } circle
   Options: c color · line (stroke only, w width) · ink (flat detail: eyes, mouths, holes) · hl:[cx,cy,rx,ry] gloss
   · flat (solid fill, no shading) · t transform · o opacity */
function artShape(p, attrs) {
  const tr = p.t ? ` transform="${p.t}"` : '';
  if (p.d) return `<path d="${p.d}"${tr} ${attrs}/>`;
  if (p.e) return `<ellipse cx="${p.e[0]}" cy="${p.e[1]}" rx="${p.e[2]}" ry="${p.e[3]}"${tr} ${attrs}/>`;
  if (p.r) return `<rect x="${p.r[0]}" y="${p.r[1]}" width="${p.r[2]}" height="${p.r[3]}" rx="${p.r[4] || 0}"${tr} ${attrs}/>`;
  if (p.c2) return `<circle cx="${p.c2[0]}" cy="${p.c2[1]}" r="${p.c2[2]}"${tr} ${attrs}/>`;
  return '';
}
function artClay(id, parts, opts = {}) {
  const k = 'ar-' + id.replace(/[^\w-]/g, '_') + (opts.shadow === false ? '-n' : '');
  let defs = '', body = '';
  parts.forEach((p, i) => {
    const o = p.o != null ? ` opacity="${p.o}"` : '';
    if (p.line) { body += artShape(p, `fill="none" stroke="${p.c}" stroke-width="${p.w || 5}" stroke-linecap="round" stroke-linejoin="round"${o}`); return; }
    if (p.ink || p.flat) { body += artShape(p, `fill="${p.c || ART_INK}"${o}`); return; }
    const g = `${k}${i}`;
    defs += `<radialGradient id="${g}" cx=".32" cy=".26" r=".9"><stop offset="0" stop-color="${artLight(p.c, .38)}"/><stop offset=".55" stop-color="${p.c}"/><stop offset="1" stop-color="${artDark(p.c, .22)}"/></radialGradient>`;
    body += artShape(p, `fill="url(#${g})"${o}`);
    if (p.hl) body += `<ellipse cx="${p.hl[0]}" cy="${p.hl[1]}" rx="${p.hl[2]}" ry="${p.hl[3]}" fill="#fff" opacity=".55" transform="rotate(-25 ${p.hl[0]} ${p.hl[1]})${p.t ? ' ' + p.t : ''}"/>`;
  });
  if (opts.shadow !== false) defs += `<filter id="${k}s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#3a2b3d" flood-opacity=".22"/></filter>`;
  return `<svg class="art-svg" style="stroke:none" viewBox="0 0 128 128" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs><g${opts.shadow !== false ? ` filter="url(#${k}s)"` : ''}>${body}</g></svg>`;
}
const artCache = new Map();
let artInst = 0;
function artSVG(id, opts = {}) {
  if (!ART[id]) return '';
  const key = id + (opts.shadow === false ? '|n' : '');
  let s = artCache.get(key);
  if (!s) { s = artClay(id, ART[id], opts); artCache.set(key, s); }
  // Each copy gets its own gradient ids: a copy on a hidden page would otherwise blank out the others
  return s.replace(/ar-/g, `a${++artInst}-`);
}
const artForEmoji = (e) => ART_EMOJI[String(e || '').trim()] || ART_EMOJI[String(e || '').trim().replace(/️/g, '')] || '';

/* Grown-up screens use clean line icons instead (body.pro: not Kid Mode, not the Play section). One stroke style,
   tinted by the tile's colour, so parent screens read calm and professional; kids keep the clay art. */
const PRO = {
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  list: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.4l1.4 1.4 2.4-2.6M3.8 11.9l1.4 1.4 2.4-2.6M3.8 17.4l1.4 1.4 2.4-2.6"/>',
  meal: '<path d="M7 3v8M5 3v4.5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17.5 21V3c-2.2 1.4-3.5 4-3.5 7.5V13h3.5"/>',
  cart: '<path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  receipt: '<path d="M6 3.5h12V21l-2.4-1.4L13.2 21l-2.4-1.4L8.4 21 6 19.6z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4.5 19.5l1.3-4.2A7.5 7.5 0 1 1 20 11.5z"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 12.4l2.7 2.7L16.2 9.6"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.3 14.4A4.5 4.5 0 0 1 21 18.8"/>',
  pin: '<path d="M9 3.5h6l-1 5.2 3 2.8v2H7v-2l3-2.8z"/><path d="M12 13.5V21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  home: '<path d="M3.5 10.5L12 4l8.5 6.5"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>',
  tool: '<path d="M14.7 5.3a4.5 4.5 0 0 0-4 6.3l-6.2 6.2a2 2 0 0 0 2.8 2.8l6.2-6.2a4.5 4.5 0 0 0 6.3-4l-2.6 1-2.3-2.3z"/>',
  book: '<path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z"/><path d="M5 20a2 2 0 0 0 2 1h12v-3"/>',
  news: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7 8.5h10M7 12h10M7 15.5h6"/>',
  film: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7.5 6l2 4M12.5 6l2 4M17.5 6l2 4"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.5 5 7 4.6 7 6.8 7 8 9 8 12 8zm0 0c1.5-3 5-3.4 5-1.2C17 8 15 8 12 8z"/>',
  bag: '<rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M9 7V5h6v2M8.5 7v13M15.5 7v13"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M5 4.5L3 6.5M19 4.5l2 2"/>',
  cake: '<path d="M4 20.5h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 15.5c2 1.5 4 1.5 5.5 0 1.5 1.5 3.5 1.5 5 0 1.5 1.5 3.5 1.5 5.5 0"/><path d="M12 11.5V8M12 4.5v.6"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 3 5-6"/>',
  down: '<path d="M4 4v16h16"/><path d="M7.5 8l3.5 4 3-3 5 6"/>',
  game: '<path d="M7.5 8h9a4 4 0 0 1 3.9 4.8l-.6 2.9a2.3 2.3 0 0 1-4 1L14.6 15H9.4l-1.2 1.7a2.3 2.3 0 0 1-4-1l-.6-2.9A4 4 0 0 1 7.5 8z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.2 4.2 0 0 0 7 0M9 9.8h.01M15 9.8h.01"/>',
  flag: '<path d="M5.5 21V4M5.5 4h11l-2 4 2 4h-11"/>',
  spark: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  car: '<path d="M5 16v-4l1.8-4.5A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.5L19 12v4"/><path d="M3.5 12h17v5h-17z"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  note: '<path d="M5 3.5h10l4 4v13H5z"/><path d="M15 3.5v4h4M8 12h8M8 16h5"/>',
  bank: '<path d="M3.5 9.5L12 4l8.5 5.5z"/><path d="M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3.5 20.5h17"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 12.5-3.5L20 7v4l1 1.5V15h-2l-1.5 2.5V20h-3v-1.5h-4V20h-3v-2.5A6 6 0 0 1 5 11z"/><path d="M15.5 10.5h.01"/>',
  routine: '<path d="M4 18h16"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 4v3M4.9 8.9l2 1.5M19.1 8.9l-2 1.5"/>',
};
const PRO_EMOJI = {
  '📅': 'calendar', '🗓️': 'calendar', '🗓': 'calendar', '🧹': 'list', '🍽️': 'meal', '🍽': 'meal', '🛒': 'cart', '🧾': 'receipt', '💬': 'chat', '✅': 'check', '☑️': 'check',
  '🧒': 'people', '👨‍👩‍👧': 'people', '👨‍👩‍👧‍👦': 'people', '👯': 'people', '📌': 'pin', '☀️': 'sun', '☀': 'sun', '💳': 'card', '💰': 'cash', '💵': 'cash', '💸': 'cash',
  '🎯': 'target', '🔁': 'repeat', '🏡': 'home', '🏠': 'home', '🔧': 'tool', '📒': 'book', '📰': 'news', '🎬': 'film', '🎁': 'gift', '🧳': 'bag', '🔔': 'bell', '⏰': 'clock',
  '🎂': 'cake', '💡': 'bulb', '📈': 'chart', '📉': 'down', '🎮': 'game', '🏆': 'trophy', '🙌': 'heart', '😊': 'smile', '🏁': 'flag', '✨': 'spark', '🚗': 'car', '⛽': 'car',
  '📝': 'note', '🏦': 'bank', '🐷': 'piggy', '🌅': 'routine', '🎉': 'spark', '⚠️': 'bell', '👋': 'smile',
};
const proIcon = (name) => (PRO[name] ? `<svg class="pro-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PRO[name]}</svg>` : '');
const PRO_SLOTS = '.tile-e, .lt-e, .mini-tile .emoji, .row > .avatar, .insight .ii, .card.empty > .big, .art-slot';
function proSwap(root) {
  if (typeof document === 'undefined' || !root?.querySelectorAll) return;
  const els = root.matches?.(PRO_SLOTS) ? [root, ...root.querySelectorAll(PRO_SLOTS)] : root.querySelectorAll(PRO_SLOTS);
  for (const el of els) {
    if (el.dataset.pro === '1' || el.querySelector('img, svg:not(.art-svg)')) continue;
    const name = PRO_EMOJI[String(el.textContent || '').trim()] || PRO_EMOJI[String(el.textContent || '').trim().replace(/️/g, '')];
    if (!name) continue;
    el.innerHTML = proIcon(name); el.dataset.pro = '1'; el.classList.add('has-line');
  }
}
const isPro = () => typeof document !== 'undefined' && document.body.classList.contains('pro');

/* Swap emoji for drawings wherever the app shows an emoji as artwork. */
// (List icons too: mini tiles, row avatars and the big emoji on empty states, when a drawing exists for them.)
const ART_SLOTS = '.tile-e, .lt-e, .toy-chip, .art-slot, .kt, .mini-tile .emoji, .row > .avatar, .empty .big';
function artSwap(root) {
  if (typeof document === 'undefined' || !root?.querySelectorAll) return;
  const els = root.matches?.(ART_SLOTS) ? [root, ...root.querySelectorAll(ART_SLOTS)] : root.querySelectorAll(ART_SLOTS);
  for (const el of els) {
    if (el.dataset.art === '1') continue;
    const id = el.dataset.artId || artForEmoji(el.textContent);
    if (!id || !ART[id]) continue;
    el.innerHTML = artSVG(id); el.dataset.art = '1'; el.classList.add('has-art');
  }
}
if (typeof document !== 'undefined') {
  const artObs = new MutationObserver((list) => { const pro = isPro(); for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) (pro ? proSwap : artSwap)(n); });
  const start = () => { (isPro() ? proSwap : artSwap)(document.body); artObs.observe(document.body, { childList: true, subtree: true }); };
  // Wait for every art-*.js file to register before the first pass
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
if (typeof module !== 'undefined') module.exports = { ART, ART_EMOJI, artSVG, artClay, artLight, artDark, artMix, ART_INK };
