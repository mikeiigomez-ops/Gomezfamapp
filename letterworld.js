/* Letter World 🔤 — a small open-world demo drawn entirely with coloured letters.
   Pass 1 works out, for every character cell on screen, what's there in the world (grass, water, sand, a tree,
   you) and how lit it is, and picks a character: grass is / | \ leaning in the wind, water is ~ - =, leaves are
   & % @, bark is | !. Pass 2 draws that character from a font texture in that colour. Water mirrors the trees
   and you with a ripple. The world is generated from noise, so it goes on forever. Standalone page. */
'use strict';
(() => {
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.body.insertAdjacentHTML('beforeend', '<div class="err">This phone’s browser can’t draw Letter World (it needs WebGL 2).<br><br><a href="./#play" style="color:#9fe">‹ Back to the app</a></div>'); return; }

  /* ---------- The world (the same maths runs here for walking and in the shader for drawing) ---------- */
  const WL = 0.4; // water level
  const hash = (x) => { x >>>= 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16; return x >>> 0; };
  const h01 = (x, y) => (hash((Math.imul((x + 32768) >>> 0, 1597334677) ^ hash((y + 32768) >>> 0)) >>> 0) & 0xffffff) / 16777216;
  const sstep = (t) => t * t * (3 - 2 * t);
  const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sstep(x - ix), fy = sstep(y - iy); const a = h01(ix, iy), b = h01(ix + 1, iy), c = h01(ix, iy + 1), d = h01(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  const height = (x, y) => 0.62 * vnoise(x * 0.045, y * 0.045) + 0.28 * vnoise(x * 0.11 + 17.3, y * 0.11 + 4.1) + 0.1 * vnoise(x * 0.31 + 5.7, y * 0.31 + 9.2);
  const TREE_GRID = 5;
  function treeAt(cx, cy) {
    if (h01(cx + 1000, cy) >= 0.42) return null;
    const bx = (cx + 0.2 + 0.6 * h01(cx + 2000, cy)) * TREE_GRID, by = (cy + 0.2 + 0.6 * h01(cx, cy + 2000)) * TREE_GRID;
    if (height(bx, by) < WL + 0.06) return null;
    const R = 1.5 + h01(cx + 3000, cy + 3000);
    return { bx, by, R, H: 2.3 + R * 0.65 };
  }
  function blocked(x, y) {
    if (height(x, y) < WL + 0.005) return true;
    const cx = Math.floor(x / TREE_GRID), cy = Math.floor(y / TREE_GRID);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const t = treeAt(cx + dx, cy + dy); if (t && Math.hypot(x - t.bx, (y - t.by) * 1.6) < 0.45) return true; }
    return false;
  }
  // Start on the grass by a lake
  function spawn() {
    for (let r = 0; r < 400; r += 2) for (let a = 0; a < 6.28; a += 0.4) {
      const x = Math.cos(a) * r, y = Math.sin(a) * r, h = height(x, y);
      if (h > WL + 0.035 && h < WL + 0.06 && !blocked(x, y) && height(x, y - 1.6) < WL - 0.01 && height(x, y - 6) < WL - 0.03) return [x, y];
    }
    return [0, 0];
  }

  /* ---------- Characters: 9 rows of 10, picked by material and brightness ---------- */
  const ROWS = [
    ' .:-=+*#%@', // 0 general
    " .,'/|\\\";:", // 1 grass (picked by wind, not brightness)
    ' .,-~~=+*#', // 2 water
    ' .:;oO&%@#', // 3 leaves
    ' .:+#$&WM@', // 4 stone
    ' .:|!lI|H#', // 5 bark
    " .,:;'`.,:", // 6 sand
    ' .:+oO0@#M', // 7 you
    " .'`*+*x*.", // 8 sparkles and flowers
  ];
  const GW = 48, GH = 80;
  function atlas() {
    const c = document.createElement('canvas'); c.width = GW * 10; c.height = GH * ROWS.length;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `bold ${GH * 0.78}px ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace`;
    ROWS.forEach((row, r) => [...row].forEach((ch, k) => x.fillText(ch, k * GW + GW / 2, r * GH + GH * 0.54)));
    return c;
  }

  /* ---------- Shaders ---------- */
  const VS = `#version 300 es
  in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const SCENE = `#version 300 es
  precision highp float; precision highp int;
  uniform vec2 uRes, uCell, uCam, uPlayer; uniform float uScale, uTime, uNight, uWalk, uMove, uFace;
  out vec4 o;
  const float WL = ${WL.toFixed(3)};
  uint hsh(uint x){ x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
  float h01(ivec2 p){ return float((hsh(uint(p.x + 32768) * 1597334677u ^ hsh(uint(p.y + 32768)))) & 0xffffffu) / 16777216.0; }
  float vn(vec2 p){ vec2 i = floor(p), f = p - i; f = f*f*(3.0-2.0*f); ivec2 q = ivec2(i);
    float a = h01(q), b = h01(q+ivec2(1,0)), c = h01(q+ivec2(0,1)), d = h01(q+ivec2(1,1));
    return a + (b-a)*f.x + (c-a)*f.y + (a-b-c+d)*f.x*f.y; }
  float height(vec2 p){ return 0.62*vn(p*0.045) + 0.28*vn(p*0.11 + vec2(17.3,4.1)) + 0.1*vn(p*0.31 + vec2(5.7,9.2)); }
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; return length(pa - ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0)); }
  float box(vec2 p, vec2 c, vec2 h, float r){ vec2 d = abs(p-c) - h + r; return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - r; }
  float glyphOf(int row, float b){ return float(row*10 + int(clamp(b,0.0,0.999)*10.0)); }
  // You, made of letters. q is relative to your feet. Returns colour+brightness in rgb/a, or a<0 for nothing.
  vec4 you(vec2 q){
    q.x *= uFace;
    float sw = sin(uWalk)*0.28*uMove, bob = abs(cos(uWalk))*0.06*uMove;
    q.y -= bob;
    float head = length(q - vec2(0.0, 2.12)) - 0.33;
    float hair = length(q - vec2(-0.03, 2.24)) - 0.31;
    float body = box(q, vec2(0.0, 1.35), vec2(0.3, 0.42), 0.12);
    float legs = min(seg(q, vec2(-0.13,0.95), vec2(-0.13+sw,0.05)), seg(q, vec2(0.13,0.95), vec2(0.13-sw,0.05))) - 0.11;
    float arms = min(seg(q, vec2(-0.36,1.68), vec2(-0.42-sw*0.8,1.0)), seg(q, vec2(0.36,1.68), vec2(0.42+sw*0.8,1.0))) - 0.09;
    float sh = 0.55 + 0.45*clamp(0.5 - q.x*0.9, 0.0, 1.0);
    if (head < 0.0) { if (hair < 0.0 && q.y > 2.18) return vec4(vec3(0.35,0.22,0.15), 0.55*sh); return vec4(vec3(1.0,0.82,0.68), 0.75*sh + 0.15); }
    if (arms < 0.0) return vec4(vec3(1.0,0.82,0.68), 0.6*sh);
    if (body < 0.0) return vec4(vec3(0.35,0.95,1.0), 0.65*sh + 0.25);
    if (legs < 0.0) return vec4(vec3(0.3,0.36,0.75), 0.6*sh);
    return vec4(-1.0);
  }
  void main(){
    vec2 cell = floor(gl_FragCoord.xy);
    vec2 px = (cell + 0.5) * uCell;
    vec2 p = uCam + (px - uRes*0.5) * uScale;
    ivec2 gc = ivec2(floor(p / (uCell * uScale))); // a stable id for this character's spot on the ground
    float t = uTime, n1 = h01(gc), n2 = h01(gc + ivec2(777, 31));
    float day = 1.0 - uNight;
    float lantern = uNight * 0.55 * exp(-dot(p - uPlayer - vec2(0.0,1.0), p - uPlayer - vec2(0.0,1.0)) / 18.0);
    vec3 amb = mix(vec3(0.55,0.68,1.0), vec3(1.0), day) + vec3(1.0,0.75,0.4)*lantern;
    float light = mix(0.62, 1.0, day) + lantern;
    float cloud = smoothstep(0.45, 0.75, vn(p*0.035 + vec2(t*0.04, t*0.015))) * 0.35 * day;
    float h = height(p);
    vec3 col; float bri; float glyph;
    bool water = h < WL;
    // ---- ground ----
    if (water) {
      float depth = clamp((WL - h) * 9.0, 0.0, 1.0);
      float wave = 0.5 + 0.5*sin(p.x*1.7 + t*1.3 + sin(p.y*2.3 + t*0.7)*1.5) * sin(p.y*3.1 - t*1.1);
      col = mix(vec3(0.25,0.55,0.85), vec3(0.08,0.2,0.55), depth) * amb;
      bri = (0.3 + 0.42*wave*(1.0 - depth*0.4) + 0.22*day*smoothstep(0.5, 0.8, vn(p*0.06 + vec2(t*0.05, -t*0.02)))) * light; // + clouds reflected
      glyph = glyphOf(2, bri);
      // sun / moon glints on the ripples
      if (n1 > 0.993 && fract(t*0.7 + n2*7.0) < 0.3) { col = mix(vec3(1.0,0.95,0.75), vec3(0.85,0.92,1.0), uNight); bri = 0.85; glyph = 84.0; }
    } else if (h < WL + 0.03) {
      col = vec3(0.93,0.82,0.55) * amb; bri = (0.45 + 0.3*n1) * light * (1.0 - cloud);
      glyph = glyphOf(6, n1*0.95 + 0.04);
    } else {
      float wind = sin(p.x*0.35 + t*1.6 + sin(p.y*0.25 + t*0.3)*2.0) + (n2 - 0.5)*1.2;
      float lush = vn(p*0.08 + vec2(40.0));
      col = mix(vec3(0.24,0.62,0.22), vec3(0.45,0.85,0.3), lush) * amb;
      col = mix(col, vec3(0.62,0.72,0.28)*amb, smoothstep(WL+0.03, WL+0.1, h) * 0.0 + smoothstep(0.62, 0.8, h)*0.5);
      bri = (0.46 + 0.42*n1 + 0.15*lush) * light * (1.0 - cloud);
      int k = n1 < 0.12 ? 0 : n1 < 0.22 ? 1 : n1 < 0.32 ? (n2 < 0.5 ? 2 : 3) : (wind < -0.35 ? 4 : wind > 0.35 ? 6 : 5);
      if (n1 > 0.93 && n2 > 0.55) k = 7;
      glyph = float(10 + k);
      // flowers
      if (h01(gc + ivec2(51, 9)) > 0.992) { col = n2 > 0.5 ? vec3(1.0,0.55,0.8) : vec3(1.0,0.9,0.4); bri = 0.85*light; glyph = 84.0; }
    }
    // ---- trees, you, shadows and reflections (nearest to the camera wins) ----
    float bestY = 1e9; vec4 obj = vec4(-1.0); int objRow = 0; float shadow = 0.0;
    vec2 rp = p + vec2(sin(p.y*7.0 + t*2.2)*0.09, 0.0); // rippled point for reflections
    vec4 refl = vec4(-1.0); float reflY = 1e9;
    ivec2 tc = ivec2(floor(p / 5.0));
    for (int dx = -1; dx <= 1; dx++) for (int dy = -2; dy <= 2; dy++) {
      ivec2 c = tc + ivec2(dx, dy);
      if (h01(c + ivec2(1000, 0)) >= 0.42) continue;
      vec2 b = (vec2(c) + 0.2 + 0.6*vec2(h01(c + ivec2(2000, 0)), h01(c + ivec2(0, 2000)))) * 5.0;
      if (height(b) < WL + 0.06) continue;
      float R = 1.5 + h01(c + ivec2(3000, 3000)), H = 2.3 + R*0.65;
      float sway = sin(t*0.9 + b.x)*0.08;
      // canopy
      vec2 cc = b + vec2(sway, H);
      vec2 lp = (p - cc) / R; lp.y *= 1.08;
      float d = length(lp);
      if (d < 1.0 && b.y < bestY) {
        vec3 nrm = normalize(vec3(lp, sqrt(max(0.0, 1.0 - d*d))));
        float leaf = vn(p*3.0 + vec2(t*0.6, 0.0));
        float l = 0.25 + 0.75*max(0.0, dot(nrm, normalize(vec3(-0.5, 0.6, 0.7))));
        float rim = smoothstep(0.75, 1.0, d);
        bestY = b.y; obj = vec4(mix(vec3(0.1,0.42,0.16), vec3(0.45,0.85,0.32), l)*amb*(1.0 - 0.35*rim), (0.22 + 0.62*l + 0.18*leaf + 0.12*(n1 - 0.5)) * light * (1.0 - 0.4*rim)); objRow = 3;
      }
      // trunk
      if (abs(p.x - b.x) < 0.22 && p.y > b.y && p.y < b.y + H - R*0.7 && b.y < bestY) { bestY = b.y; obj = vec4(vec3(0.55,0.36,0.2)*amb, (0.5 + 0.3*n1)*light); objRow = 5; }
      // shadow on the ground
      vec2 sp = (p - (b + vec2(0.9, -0.2))) / vec2(R*1.15, R*0.55);
      shadow = max(shadow, (1.0 - smoothstep(0.6, 1.0, length(sp))) * 0.55 * day);
      // reflection in the water: the canopy mirrored below the trunk
      if (water) {
        vec2 rc = b - vec2(-sway, H);
        vec2 rl = (rp - rc) / R; rl.y *= 1.08;
        if (length(rl) < 1.0 && -b.y < reflY) { reflY = -b.y; refl = vec4(vec3(0.2,0.55,0.32), 0.62); }
        if (abs(rp.x - b.x) < 0.2 && rp.y < b.y && rp.y > b.y - (H - R*0.7) && -b.y < reflY) { reflY = -b.y; refl = vec4(vec3(0.4,0.3,0.2), 0.45); }
      }
    }
    // you
    vec2 q = p - uPlayer;
    vec4 me = you(q);
    if (me.a >= 0.0 && uPlayer.y < bestY) { bestY = uPlayer.y; obj = vec4(me.rgb * mix(vec3(1.0), vec3(0.75,0.82,1.0), uNight), me.a * mix(1.0, 0.85, uNight)); objRow = 7; }
    shadow = max(shadow, (1.0 - smoothstep(0.5, 1.0, length(q / vec2(0.55, 0.22)))) * 0.6);
    if (water) { vec4 mr = you(vec2(rp.x - uPlayer.x, uPlayer.y - rp.y)); if (mr.a >= 0.0) refl = vec4(mr.rgb*0.7 + vec3(0.0,0.05,0.15), mr.a*0.75); }
    if (obj.a >= 0.0) { col = obj.rgb; bri = obj.a; glyph = glyphOf(objRow, bri); }
    else {
      if (!water) bri *= 1.0 - shadow;
      if (water && refl.a >= 0.0) { col = mix(col, refl.rgb*amb, 0.75); bri = refl.a * light * (0.75 + 0.25*sin(p.y*9.0 + t*3.0)); glyph = glyphOf(2, bri + 0.15); }
    }
    // fireflies at night, drifting pollen by day
    vec2 fp = p * 0.5;
    ivec2 fc = ivec2(floor(fp));
    float fh = h01(fc + ivec2(9, 99));
    if (fh > 0.8 && obj.a < 0.0) {
      vec2 fpos = vec2(fc) + 0.5 + 0.35*vec2(sin(t*0.5 + fh*30.0), cos(t*0.37 + fh*50.0));
      float dd = length(fp - fpos);
      float blink = 0.5 + 0.5*sin(t*(1.2 + fh*2.5) + fh*40.0);
      if (uNight > 0.3 && dd < 0.07 && blink > 0.35) { col = vec3(0.9,1.0,0.45); bri = 1.0; glyph = glyphOf(8, 0.45 + 0.4*blink); }
      else if (uNight > 0.3 && dd < 0.16 && blink > 0.55 && !water) { bri = min(1.0, bri + 0.35*blink); col = mix(col, vec3(0.9,1.0,0.5), 0.5); }
      else if (uNight < 0.3 && fh > 0.95 && dd < 0.05) { col = vec3(1.0); bri = 0.7; glyph = 81.0; }
    }
    o = vec4(clamp(col * (0.35 + 0.9*bri), 0.0, 1.0), glyph / 255.0);
  }`;
  const DRAW = `#version 300 es
  precision highp float;
  uniform sampler2D uScene, uAtlas; uniform vec2 uCell; uniform float uNight;
  out vec4 o;
  void main(){
    vec2 g = gl_FragCoord.xy / uCell;
    ivec2 cell = ivec2(floor(g)); vec2 l = fract(g);
    vec4 s = texelFetch(uScene, cell, 0);
    int id = int(s.a*255.0 + 0.5), row = id / 10, colm = id - row*10;
    vec2 uv = (vec2(float(colm), float(row)) + vec2(l.x, 1.0 - l.y)) / vec2(10.0, ${ROWS.length}.0);
    float a = texture(uAtlas, uv).r;
    vec3 bg = mix(vec3(0.012,0.02,0.016), vec3(0.008,0.01,0.03), uNight);
    o = vec4(bg + s.rgb * (a*1.15 + 0.05), 1.0);
  }`;
  function prog(fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  let P1, P2;
  try { P1 = prog(SCENE); P2 = prog(DRAW); } catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div class="err">Letter World couldn’t start on this phone.<br><small>${String(e.message).slice(0, 200).replace(/</g, '&lt;')}</small></div>`); return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas());
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const sceneTex = gl.createTexture(), fbo = gl.createFramebuffer();

  /* ---------- Screen size + detail ---------- */
  const DETAIL = { HD: [2.6, 4.3], MED: [3.4, 5.6], LOW: [4.6, 7.4] };
  let detail = localStorage.getItem('lw-detail') || 'HD';
  let W = 0, H = 0, cols = 0, rows = 0, cell = [8, 13], dpr = 1;
  function resize() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.round(innerWidth * dpr); H = Math.round(innerHeight * dpr);
    canvas.width = W; canvas.height = H;
    const [cw, ch] = DETAIL[detail] || DETAIL.HD;
    cell = [Math.max(6, Math.round(cw * dpr)), Math.max(10, Math.round(ch * dpr))];
    cols = Math.ceil(W / cell[0]); rows = Math.ceil(H / cell[1]);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    document.getElementById('detail').textContent = detail;
  }
  addEventListener('resize', resize); resize();

  /* ---------- You + camera ---------- */
  const [sx, sy] = spawn();
  const me = { x: sx, y: sy, face: 1, walk: 0, move: 0 };
  const cam = { x: sx, y: sy + 1.2 };
  let night = 0, nightTo = 0;
  const keys = new Set(), stick = { on: false, x: 0, y: 0, ox: 0, oy: 0 };
  addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  const stickEl = document.getElementById('stick'), knob = stickEl.firstElementChild;
  canvas.addEventListener('pointerdown', (e) => { stick.on = true; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knob.style.transform = ''; canvas.setPointerCapture(e.pointerId); hideTitle(); });
  canvas.addEventListener('pointermove', (e) => { if (!stick.on) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const m = Math.hypot(dx, dy), k = m > 45 ? 45 / m : 1; dx *= k; dy *= k; stick.x = dx / 45; stick.y = -dy / 45; knob.style.transform = `translate(${dx}px,${dy}px)`; });
  const up = () => { stick.on = false; stick.x = stick.y = 0; stickEl.style.display = 'none'; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  document.getElementById('night').addEventListener('click', () => { nightTo = nightTo ? 0 : 1; document.getElementById('night').textContent = nightTo ? '☀️' : '🌙'; });
  document.getElementById('detail').addEventListener('click', () => { const k = Object.keys(DETAIL); detail = k[(k.indexOf(detail) + 1) % k.length]; try { localStorage.setItem('lw-detail', detail); } catch { /* private mode */ } resize(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // no pinch zoom
  let titleT = setTimeout(hideTitle, 6000);
  function hideTitle() { clearTimeout(titleT); document.getElementById('title').style.opacity = 0; }
  // The name over your head: your avatar's name from the app when there is one
  try { const S = JSON.parse(localStorage.getItem('gomezfam:v1') || '{}'); const id = S.settings?.me; const m = (S.members || []).find((x) => x.id === id); if (m?.name) document.getElementById('tag').textContent = m.name; } catch { /* no app data */ }
  const tag = document.getElementById('tag');

  /* ---------- Loop ---------- */
  const t0 = performance.now(); let last = t0;
  window.__lw = { me, cam, setNight: (v) => { night = nightTo = v; }, height, blocked, WL }; // for tests
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let ix = stick.x, iy = stick.y;
    if (keys.has('arrowleft') || keys.has('a')) ix -= 1; if (keys.has('arrowright') || keys.has('d')) ix += 1;
    if (keys.has('arrowup') || keys.has('w')) iy += 1; if (keys.has('arrowdown') || keys.has('s')) iy -= 1;
    const m = Math.min(1, Math.hypot(ix, iy));
    if (m > 0.08) {
      const sp = 4.2 * m * dt, a = Math.atan2(iy, ix), vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      if (!blocked(me.x + vx, me.y)) me.x += vx;
      if (!blocked(me.x, me.y + vy)) me.y += vy;
      if (Math.abs(vx) > 0.001) me.face = vx < 0 ? -1 : 1;
      me.walk += dt * 9 * m; me.move = Math.min(1, me.move + dt * 6);
      hideTitle();
    } else { me.move = Math.max(0, me.move - dt * 6); }
    cam.x += (me.x - cam.x) * Math.min(1, dt * 4); cam.y += (me.y + 1.2 - cam.y) * Math.min(1, dt * 4);
    night += (nightTo - night) * Math.min(1, dt * 1.5);
    const scale = 15 / Math.min(W, H) * (detail === 'LOW' ? 0.85 : 1);
    // pass 1: what is in each cell
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, cols, rows);
    gl.useProgram(P1.p);
    const u = P1.u, T = (now - t0) / 1000;
    gl.uniform2f(u.uRes, cols * cell[0], rows * cell[1]); gl.uniform2f(u.uCell, cell[0], cell[1]);
    gl.uniform2f(u.uCam, cam.x, cam.y); gl.uniform2f(u.uPlayer, me.x, me.y);
    gl.uniform1f(u.uScale, scale); gl.uniform1f(u.uTime, T); gl.uniform1f(u.uNight, night);
    gl.uniform1f(u.uWalk, me.walk); gl.uniform1f(u.uMove, me.move); gl.uniform1f(u.uFace, me.face);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // pass 2: draw the letters
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(P2.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.uniform1i(P2.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(P2.u.uAtlas, 1);
    gl.uniform2f(P2.u.uCell, cell[0], cell[1]); gl.uniform1f(P2.u.uNight, night);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // name tag above your head
    const hx = (me.x - cam.x) / scale + (cols * cell[0]) / 2, hy = (me.y + 2.7 - cam.y) / scale + (rows * cell[1]) / 2;
    tag.style.left = hx / dpr + 'px'; tag.style.top = (H - hy) / dpr + 'px';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
