/* Reward art in the clay style: kid badge medallions, mood faces, piggy jars, currencies. See art.js for the part format.
   Badges, moods, jars and currencies are NOT mapped by emoji (those emoji also appear as plain tiles);
   the views ask for them by id: <span class="art-slot" data-art-id="badge_saver">🐷</span>. */
'use strict';
(() => {
  // Rounded 5-point star path (outer radius R, inner radius r, tip rounding k)
  const star = (cx, cy, R, r, k = 0.18) => {
    const pt = (i, rad) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    const f = (n) => n.toFixed(1);
    let d = '';
    for (let i = 0; i < 10; i += 2) {
      const [tx, ty] = pt(i, R), [px, py] = pt(i - 1, r), [nx, ny] = pt(i + 1, r);
      const ax = tx + (px - tx) * k, ay = ty + (py - ty) * k, bx = tx + (nx - tx) * k, by = ty + (ny - ty) * k;
      d += `${i ? 'L' : 'M'}${f(ax)} ${f(ay)} Q${f(tx)} ${f(ty)} ${f(bx)} ${f(by)} L${f(nx)} ${f(ny)} `;
    }
    return d + 'Z';
  };
  // One medallion base for every badge: colored rim, light face, a soft inner ring
  const medal = (rim, motif) => [
    { c2: [64, 64, 54], c: rim, hl: [38, 34, 12, 6] },
    { c2: [64, 64, 43], c: artLight(rim, 0.8) },
    { c2: [64, 64, 48.5], line: 1, c: '#ffffff', w: 2.5, o: 0.5 },
    ...motif,
  ];
  // Squishy ball face for every mood
  const face = (col, feat) => [
    { e: [64, 68, 50, 45], c: col, hl: [40, 42, 13, 7] },
    { e: [36, 80, 8, 5], ink: 1, c: '#ff6f91', o: 0.35 },
    { e: [92, 80, 8, 5], ink: 1, c: '#ff6f91', o: 0.35 },
    ...feat,
  ];
  // Glass jar for every piggy jar: lid, glass, money inside, a label
  const GLASS = 'M40 36 H88 V44 Q102 48 102 64 V100 Q102 116 86 116 H42 Q26 116 26 100 V64 Q26 48 40 44Z';
  const jar = (fill, lid, label) => [
    { d: GLASS, c: '#dcefff', o: 0.95 },
    { d: 'M30 76 Q64 68 98 76 V100 Q98 112 86 112 H42 Q30 112 30 100Z', c: fill },
    ...lid,
    ...label,
    { d: 'M36 60 Q33 80 37 98', line: 1, c: '#ffffff', w: 5, o: 0.75 },
  ];

  Object.assign(ART, {
    /* ---- Badge medallions (kids.js badgesFor) ---- */
    badge_firstchore: medal('#5aa7ff', [
      { r: [61, 34, 7, 36, 3.5], c: '#c9844a', t: 'translate(2 -2) rotate(30 64 64)' },
      { d: 'M50 66 H78 Q84 66 86 76 L90 92 Q91 98 85 98 H43 Q37 98 38 92 L42 76 Q44 66 50 66Z', c: '#ffc845', t: 'translate(2 -2) rotate(30 64 64)', hl: [50, 76, 4, 7] },
      { r: [48, 61, 32, 9, 4.5], c: '#ef5a5a', t: 'translate(2 -2) rotate(30 64 64)' },
    ]),
    badge_helpinghand: medal('#2ec4b6', [
      { d: 'M42 62 Q42 32 64 32 Q86 32 86 62', line: 1, c: '#a8692f', w: 6 },
      { e: [56, 60, 14, 9], c: '#ff9cc5' },
      { e: [74, 58, 13, 9], c: '#5aa7ff' },
      { d: 'M36 60 H92 L86 92 Q85 98 78 98 H50 Q43 98 42 92Z', c: '#e0a05a', hl: [46, 68, 6, 3] },
      { d: 'M40 72 H88 M42 84 H86', line: 1, c: '#a8692f', w: 3, o: 0.55 },
    ]),
    badge_superhelper: medal('#4a6cf7', [
      { d: 'M44 40 Q64 34 84 40 L92 90 Q78 84 64 92 Q50 84 36 90Z', c: '#ef5a5a' },
      { d: 'M46 38 H82 V62 Q82 82 64 92 Q46 82 46 62Z', c: '#5aa7ff', hl: [54, 48, 5, 3] },
      { d: 'M68 46 L56 66 H66 L60 82 L74 60 H64Z', c: '#ffd23f' },
    ]),
    badge_onfire: medal('#ff8a3d', [
      { d: 'M64 26 Q72 42 82 50 Q94 62 90 78 Q86 98 64 98 Q42 98 38 78 Q35 62 46 52 Q48 64 56 64 Q52 44 64 26Z', c: '#ff6a3d', hl: [52, 72, 4, 8] },
      { d: 'M64 56 Q72 66 76 74 Q80 92 64 92 Q48 92 52 76 Q56 66 64 56Z', c: '#ffd23f' },
    ]),
    badge_unstoppable: medal('#6b6cff', [
      { d: 'M34 36 L62 58', line: 1, c: '#ffd23f', w: 9 },
      { d: 'M30 58 L58 70 M48 26 L68 50', line: 1, c: '#ffb347', w: 6 },
      { c2: [74, 72, 19], c: '#ff6a3d', hl: [67, 64, 6, 3.5] },
      { c2: [80, 78, 4], ink: 1, c: '#c4402a', o: 0.5 },
      { c2: [68, 68, 3], ink: 1, c: '#c4402a', o: 0.5 },
    ]),
    badge_rightontime: medal('#b98cff', [
      { d: star(64, 66, 32, 15), c: '#ffc845', hl: [54, 54, 6, 3.5] },
      { c2: [57, 68, 2.8], ink: 1 },
      { c2: [71, 68, 2.8], ink: 1 },
      { d: 'M59 75 Q64 80 69 75', line: 1, c: ART_INK, w: 2.6 },
    ]),
    badge_earlybird: medal('#3fb6ff', [
      { d: 'M64 30 V38 M38 44 L44 50 M90 44 L84 50 M28 66 H36 M92 66 H100', line: 1, c: '#ffb347', w: 5 },
      { c2: [64, 72, 22], c: '#ffc845', hl: [56, 62, 6, 3.5] },
      { d: 'M22 76 Q46 66 64 74 Q84 66 106 76 V92 Q86 106 64 106 Q42 106 22 92Z', c: '#4cc46a' },
    ]),
    badge_saver: medal('#f27fae', [
      { d: 'M40 50 Q36 30 54 38Z', c: '#f27fae' },
      { d: 'M88 50 Q92 30 74 38Z', c: '#f27fae' },
      { c2: [64, 68, 28], c: '#ff9cc5', hl: [52, 54, 7, 4] },
      { e: [64, 76, 12, 9], c: '#f27fae' },
      { d: 'M60 76 V77 M68 76 V77 M52 62 V63 M76 62 V63', line: 1, c: ART_INK, w: 4.5 },
    ]),
    badge_supersaver: medal('#4cc46a', [
      { d: 'M54 40 Q50 32 56 30 Q64 34 72 30 Q78 32 74 40Z', c: '#d9a35c' },
      { d: 'M54 42 Q32 60 36 82 Q40 98 64 98 Q88 98 92 82 Q96 60 74 42Z', c: '#e8b46a', hl: [48, 62, 5, 9] },
      { r: [52, 38, 24, 7, 3.5], c: '#ef5a5a' },
      { d: 'M71 62 Q64 57 58 61 Q54 66 64 70 Q74 74 70 79 Q64 84 56 78 M64 54 V86', line: 1, c: '#2f8f4e', w: 4.2 },
    ]),
    badge_bigheart: medal('#ffc845', [
      { d: 'M64 96 Q30 74 32 54 Q34 36 50 36 Q60 36 64 46 Q68 36 78 36 Q94 36 96 54 Q98 74 64 96Z', c: '#ff4d6d', hl: [46, 50, 7, 4] },
      { d: star(80, 40, 9, 4, 0.2), c: '#ffffff', flat: 1, o: 0.9 },
    ]),
    badge_wishmaker: medal('#ff6fa5', [
      { d: 'M64 42 Q52 26 44 32 Q40 40 64 42 Q88 40 84 32 Q76 26 64 42Z', c: '#ffc845' },
      { r: [38, 54, 52, 42, 8], c: '#5aa7ff', hl: [48, 64, 6, 4] },
      { r: [34, 42, 60, 16, 7], c: '#7db9ff' },
      { r: [58, 42, 12, 54, 2], c: '#ffc845' },
    ]),
    badge_treatyourself: medal('#ffb347', [
      { d: 'M32 48 H96 V58 Q88 64 96 70 V80 H32 V70 Q40 64 32 58Z', c: '#ff6fa5', t: 'rotate(-14 64 64)', hl: [42, 54, 6, 3] },
      { d: 'M76 50 V78', line: 1, c: '#ffffff', w: 2.5, o: 0.7, t: 'rotate(-14 64 64)' },
      { d: star(54, 64, 9, 4.2, 0.2), c: '#ffffff', flat: 1, t: 'rotate(-14 64 64)' },
    ]),
    badge_champion: medal('#ef5a5a', [
      { d: 'M44 42 Q28 42 32 56 Q36 66 50 68 M84 42 Q100 42 96 56 Q92 66 78 68', line: 1, c: '#e0a800', w: 5 },
      { d: 'M42 34 H86 V52 Q86 74 64 76 Q42 74 42 52Z', c: '#ffc845', hl: [52, 44, 5, 8] },
      { r: [58, 74, 12, 12, 2], c: '#e0a800' },
      { r: [46, 84, 36, 12, 5], c: '#a8692f' },
      { d: star(64, 52, 9, 4.2, 0.2), c: '#fff3c4', flat: 1 },
    ]),
    badge_century: medal('#9bd84a', [
      { d: 'M34 54 L42 48 V84', line: 1, c: '#ef4444', w: 7 },
      { e: [62, 66, 10, 17], line: 1, c: '#ef4444', w: 7 },
      { e: [88, 66, 10, 17], line: 1, c: '#ef4444', w: 7 },
      { d: 'M36 94 H94', line: 1, c: '#ef4444', w: 4.5 },
    ]),

    /* ---- Moods (together.js MOODS) ---- */
    mood_great: face('#ffc845', [
      { d: 'M42 62 Q48 54 54 62 M74 62 Q80 54 86 62', line: 1, c: ART_INK, w: 4.5 },
      { d: 'M44 74 H84 Q82 98 64 98 Q46 98 44 74Z', ink: 1 },
      { d: 'M54 90 Q64 84 74 90 Q70 96 64 96 Q58 96 54 90Z', ink: 1, c: '#ff6f91' },
    ]),
    mood_good: face('#ffb347', [
      { c2: [48, 62, 5], ink: 1 }, { c2: [80, 62, 5], ink: 1 },
      { d: 'M50 80 Q64 92 78 80', line: 1, c: ART_INK, w: 4.5 },
    ]),
    mood_okay: face('#7fd6a8', [
      { c2: [48, 62, 5], ink: 1 }, { c2: [80, 62, 5], ink: 1 },
      { d: 'M52 84 H76', line: 1, c: ART_INK, w: 4.5 },
    ]),
    mood_tired: face('#b98cff', [
      { d: 'M42 64 Q48 70 54 64 M74 64 Q80 70 86 64', line: 1, c: ART_INK, w: 4.5 },
      { e: [64, 86, 5, 6], ink: 1 },
      { d: 'M88 22 H100 L88 34 H100', line: 1, c: '#7a5cc8', w: 4 },
    ]),
    mood_meh: face('#5ac8d8', [
      { c2: [48, 62, 5], ink: 1 }, { c2: [80, 62, 5], ink: 1 },
      { d: 'M50 88 Q58 80 64 85 Q70 90 78 82', line: 1, c: ART_INK, w: 4.5 },
    ]),
    mood_sad: face('#5aa7ff', [
      { c2: [48, 62, 5], ink: 1 }, { c2: [80, 62, 5], ink: 1 },
      { d: 'M52 90 Q64 80 76 90', line: 1, c: ART_INK, w: 4.5 },
      { d: 'M44 70 Q38 80 41 84 Q44 88 47 84 Q50 80 44 70Z', c: '#bfe6ff' },
    ]),
    mood_grumpy: face('#ff6262', [
      { d: 'M40 52 L54 58 M88 52 L74 58', line: 1, c: ART_INK, w: 4.5 },
      { c2: [49, 66, 4.5], ink: 1 }, { c2: [79, 66, 4.5], ink: 1 },
      { d: 'M52 90 Q64 82 76 90', line: 1, c: ART_INK, w: 4.5 },
    ]),
    mood_sick: face('#a5d86a', [
      { d: 'M42 62 H54 M74 62 H86', line: 1, c: ART_INK, w: 4.5 },
      { d: 'M48 86 Q56 82 64 86 Q72 90 78 86', line: 1, c: ART_INK, w: 4 },
      { r: [74, 82, 30, 7, 3.5], c: '#f3f6ff', t: 'rotate(-20 74 85)' },
      { c2: [102, 76, 6], c: '#ef4444' },
    ]),

    /* ---- Piggy jars (kids.js JARS) ---- */
    jar_save: jar('#ffc845', [
      { r: [34, 20, 60, 18, 7], c: '#f27fae', hl: [44, 25, 7, 3] },
      { r: [54, 26, 20, 5, 2.5], ink: 1, c: '#7a3b5c' },
    ], [
      { c2: [64, 88, 13], c: '#ffffff' },
      { e: [64, 89, 8, 6], c: '#ff9cc5' },
    ]),
    jar_spend: jar('#9fd3ff', [
      { r: [34, 20, 60, 18, 7], c: '#5aa7ff', hl: [44, 25, 7, 3] },
      { d: 'M44 24 V34 M54 24 V34 M64 24 V34 M74 24 V34 M84 24 V34', line: 1, c: '#2f6fcc', w: 2.5, o: 0.5 },
    ], [
      { d: 'M58 84 Q58 72 64 72 Q70 72 70 84', line: 1, c: '#ffffff', w: 4 },
      { d: 'M50 82 H78 L80 104 Q80 106 78 106 H50 Q48 106 48 104Z', c: '#ff6fa5', hl: [56, 88, 4, 3] },
    ]),
    jar_give: jar('#9be3b0', [
      { r: [34, 20, 60, 18, 7], c: '#3fcf8e', hl: [44, 25, 7, 3] },
      { d: 'M64 22 Q50 8 46 16 Q46 24 64 22 Q82 24 82 16 Q78 8 64 22Z', c: '#ff6f91' },
    ], [
      { c2: [64, 90, 13], c: '#ffffff' },
      { d: 'M64 99 Q54 92 55 87 Q56 82 60 82 Q63 82 64 85 Q65 82 68 82 Q72 82 73 87 Q74 92 64 99Z', c: '#ff4d6d' },
    ]),

    /* ---- Currencies ---- */
    cur_star: [
      { d: star(64, 68, 52, 25), c: '#ffc845', hl: [48, 52, 10, 5] },
      { d: star(64, 68, 34, 16.5), c: '#ffe27a', o: 0.55 },
      { d: star(104, 22, 10, 4, 0.2), c: '#ffffff', flat: 1, o: 0.95 },
    ],
    cur_bubble: [
      { c2: [62, 66, 46], c: '#cfeaff', o: 0.75 },
      { c2: [62, 66, 44], line: 1, c: '#8fc8ff', w: 4, o: 0.8 },
      { d: 'M28 80 Q36 104 62 110 Q90 108 102 84', line: 1, c: '#ff9cc5', w: 5, o: 0.7 },
      { e: [44, 46, 13, 7], flat: 1, c: '#ffffff', o: 0.9, t: 'rotate(-35 44 46)' },
      { c2: [100, 26, 11], c: '#cfeaff', o: 0.8 },
      { c2: [97, 23, 3], flat: 1, c: '#ffffff' },
    ],
    cur_gem: [
      { d: 'M30 50 L46 30 H82 L98 50 L64 104Z', c: '#3fb6ff', hl: [46, 42, 7, 4] },
      { d: 'M30 50 H98 L82 30 H46Z', c: '#8fd8ff' },
      { d: 'M46 30 L55 50 L64 30 L73 50 L82 30 M30 50 L64 104 L98 50 M55 50 L64 104 L73 50', c: '#ffffff', line: 1, w: 2.5, o: 0.6 },
    ],
    cur_coin: [
      { c2: [64, 64, 48], c: '#f0b400' },
      { c2: [64, 64, 38], c: '#ffd23f', hl: [48, 46, 9, 5] },
      { d: star(64, 66, 22, 10.5), c: '#f0b400', hl: [58, 58, 4, 2.5] },
    ],
  });
  Object.assign(ART_EMOJI, {}); // reward art is placed by id (data-art-id), never swapped by emoji

  // Size the slots this file's views use (an art slot drops its font size to 0, so it needs a box)
  if (typeof document !== 'undefined' && !document.getElementById('art-rewards-css')) {
    const st = document.createElement('style');
    st.id = 'art-rewards-css';
    st.textContent = `.art-slot.has-art{display:inline-block;vertical-align:middle;width:28px;height:28px}
.badge .art-slot.has-art{width:52px;height:52px}
.sticker .art-slot.has-art{width:76px;height:76px}
.mood-grid .art-slot.has-art{width:44px;height:44px}
.ci-mood .art-slot.has-art{width:26px;height:26px}
.mw-row .art-slot.has-art{width:24px;height:24px}
.ms-mood.has-art{width:22px;height:22px}
.jarbox .art-slot.has-art{width:22px;height:22px;margin-right:2px}
.star-bank .art-slot.has-art{width:68px;height:68px}
.avatar .art-slot.has-art{width:30px;height:30px}
.kid-tiles .art-slot.has-art{width:34px;height:34px}
.art-slot.has-art .art-svg{width:100%;height:100%;stroke:none}`;
    (document.head || document.documentElement).appendChild(st);
  }
})();
