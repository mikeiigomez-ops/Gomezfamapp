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

/* Swap emoji for drawings wherever the app shows an emoji as artwork. */
const ART_SLOTS = '.tile-e, .lt-e, .toy-chip, .art-slot, .kt';
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
  const artObs = new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) artSwap(n); });
  const start = () => { artSwap(document.body); artObs.observe(document.body, { childList: true, subtree: true }); };
  // Wait for every art-*.js file to register before the first pass
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
if (typeof module !== 'undefined') module.exports = { ART, ART_EMOJI, artSVG, artClay, artLight, artDark, artMix, ART_INK };
