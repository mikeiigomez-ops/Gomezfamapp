/* Motion layer (loaded last): directional screen changes, page turns that don't repeat, animated sheet close,
   a springy celebrate with a confetti burst, and haptics on iPhone. Wraps the app's own functions. */
'use strict';
(() => {
  const RM = () => navigator.webdriver || reduceMotion();
  // (2) pager classes no longer stick around (they re-slid every later re-render)
  const flash = (el, cls, ms) => { el.classList.remove(...cls); void el.offsetWidth; return (c) => { el.classList.add(c); clearTimeout(el._mT); el._mT = setTimeout(() => el.classList.remove(...cls), ms); }; };
  window.slideIn = (el, d) => { if (RM()) return; flash(el, ['pg-in-l', 'pg-in-r'], 380)(d > 0 ? 'pg-in-r' : 'pg-in-l'); };
  window.bump = (el, d) => { if (RM()) return; flash(el, ['pg-bump-l', 'pg-bump-r'], 320)(d > 0 ? 'pg-bump-r' : 'pg-bump-l'); };
  // (1) route enter: direction by depth, class removed once done
  const r0 = render; let prev = lastRouteKey;
  window.render = function () {
    r0.apply(this, arguments);
    const key = lastRouteKey; if (key === prev) return;
    const dep = (k) => (k && k.split('/')[1] ? 1 : 0); const dir = dep(key) > dep(prev) ? 'enter-push' : dep(key) < dep(prev) ? 'enter-back' : 'enter';
    prev = key;
    viewEl.classList.remove('enter', 'enter-push', 'enter-back');
    if (RM()) return;
    void viewEl.offsetWidth; viewEl.classList.add(dir);
    clearTimeout(viewEl._eT); viewEl._eT = setTimeout(() => viewEl.classList.remove('enter', 'enter-push', 'enter-back'), 450);
  };
  // (3) animated sheet close
  const c0 = closeSheet, o0 = openSheet; let closeT;
  window.openSheet = function (cfg) { clearTimeout(closeT); $('#sheet').classList.remove('closing'); $('#sheetBackdrop').classList.remove('closing'); return o0.call(this, cfg); };
  window.closeSheet = function () {
    const sh = $('#sheet'), bd = $('#sheetBackdrop');
    if (RM() || sh.hidden || sh.style.transform) return c0.call(this); // drag-dismiss already slid it out
    const cfg = sheetCfg; sheetCfg = null; $('#app').inert = false; // stop double-submits immediately
    sh.classList.add('closing'); bd.classList.add('closing');
    clearTimeout(closeT); closeT = setTimeout(() => { sh.classList.remove('closing'); bd.classList.remove('closing'); sheetCfg = cfg; c0(); }, 170);
  };
  // (6) celebrate with exit, confetti burst
  window.celebrate = function (title, sub) {
    const el = document.createElement('div'); el.className = 'celebrate';
    el.innerHTML = `<div class="celebrate-card"><div class="celebrate-title">${esc(title)}</div><div class="celebrate-sub">${esc(sub)}</div><button class="btn block" style="margin-top:16px">Yay!</button></div>`;
    el.addEventListener('click', () => { if (RM()) return el.remove(); el.classList.add('closing'); setTimeout(() => el.remove(), 170); }, { once: true });
    document.body.appendChild(el);
    haptic();
  };
  window.confetti = function (x = 50, y = 45) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const bits = ['🎉', '✨', '💰', '🎊', '⭐'];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('span'); s.className = 'burst'; s.textContent = bits[i % bits.length];
      const a = (i / 28) * Math.PI * 2 + Math.random() * .4, r = 90 + Math.random() * 110;
      s.style.cssText = `--x:${x}%;--y:${y}%;--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 60}px;--r:${(Math.random() - .5) * 540}deg;--d:${1.2 + Math.random() * .6}s;animation-delay:${Math.random() * .08}s`;
      box.appendChild(s);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2200);
  };
  // (11) iOS 18+ haptic: clicking a <label> for an <input type=checkbox switch> fires the Taptic engine
  let hl; window.haptic = function () {
    if (navigator.vibrate) return navigator.vibrate(12);
    if (!hl) { hl = document.createElement('label'); hl.ariaHidden = 'true'; hl.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
      hl.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(hl); }
    hl.click();
  };
})();
