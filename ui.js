/* Interaction layer: collapsing large titles, the sliding tab indicator, swipe-to-complete/delete
   on list rows, and drag-to-dismiss sheets. Loaded after app.js and uses its globals. */
'use strict';

/* ---------- Large title → compact title on scroll ---------- */
function updateScrolled() { document.body.classList.toggle('scrolled', window.scrollY > 24); }
window.addEventListener('scroll', updateScrolled, { passive: true });

/* ---------- Tab indicator ---------- */
function moveTabInk() {
  const ink = $('.tab-ink');
  const active = $('.tabbar button.active');
  if (!ink) return;
  if (!active) { ink.style.opacity = '0'; return; }
  ink.style.opacity = '1';
  ink.style.width = active.offsetWidth + 'px';
  ink.style.transform = `translateX(${active.offsetLeft}px)`;
}
window.addEventListener('resize', moveTabInk);

// Called by app.js after every render.
function afterRender() {
  moveTabInk();
  updateScrolled();
}

/* ---------- Swipe rows: right = the row's check action, left = its delete action ---------- */
let swipe = null;
const SWIPE_AT = 84;
document.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  const row = e.target.closest('.card.flush > .row');
  if (!row) return;
  const check = row.querySelector(':scope > .check[data-action]');
  const del = row.querySelector(':scope > .del-btn[data-action]');
  if (!check && !del) return;
  swipe = { row, card: row.parentElement, check, del, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, active: false };
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!swipe) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  if (!swipe.active) {
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
    if (Math.abs(dx) < 12) return;
    swipe.active = true;
    swipe.row.classList.add('swiping');
    swipe.card.style.setProperty('--swipe-y', swipe.row.offsetTop + 'px');
    swipe.card.style.setProperty('--swipe-h', swipe.row.offsetHeight + 'px');
  }
  let d = dx;
  if ((d > 0 && !swipe.check) || (d < 0 && !swipe.del)) d = 0;
  if (Math.abs(d) > SWIPE_AT) d = Math.sign(d) * (SWIPE_AT + (Math.abs(d) - SWIPE_AT) * 0.35); // rubber band
  swipe.dx = d;
  swipe.row.style.transform = `translateX(${d}px)`;
  if (d) swipe.card.dataset.swipe = d > 0 ? 'right' : 'left'; else delete swipe.card.dataset.swipe;
  if (Math.abs(d) >= SWIPE_AT) swipe.card.dataset.armed = ''; else delete swipe.card.dataset.armed;
}, { passive: true });

function endSwipe() {
  if (!swipe) return;
  const s = swipe;
  swipe = null;
  if (!s.active) return;
  s.row.classList.remove('swiping');
  const fire = Math.abs(s.dx) >= SWIPE_AT ? (s.dx > 0 ? s.check : s.del) : null;
  s.row.style.transform = '';
  setTimeout(() => { delete s.card.dataset.swipe; delete s.card.dataset.armed; }, 250);
  if (fire) setTimeout(() => fire.click(), 120);
}
document.addEventListener('touchend', endSwipe, { passive: true });
document.addEventListener('touchcancel', endSwipe, { passive: true });

/* ---------- Drag the sheet down to close ---------- */
(() => {
  const sheet = $('#sheet');
  let drag = null;
  sheet.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.sheet-grip, .sheet-head') || e.target.closest('button')) return;
    drag = { y: e.touches[0].clientY, dy: 0, t: Date.now() };
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (!drag) return;
    const dy = e.touches[0].clientY - drag.y;
    drag.dy = dy > 0 ? dy : dy / 4;
    sheet.style.transform = `translateY(${drag.dy}px)`;
  }, { passive: true });
  const end = () => {
    if (!drag) return;
    const fast = drag.dy > 40 && Date.now() - drag.t < 220;
    sheet.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)';
    if (drag.dy > 120 || fast) {
      sheet.style.transform = 'translateY(105%)';
      setTimeout(() => { closeSheet(); sheet.style.transform = ''; sheet.style.transition = ''; }, 260);
    } else {
      sheet.style.transform = '';
      setTimeout(() => { sheet.style.transition = ''; }, 300);
    }
    drag = null;
  };
  sheet.addEventListener('touchend', end, { passive: true });
  sheet.addEventListener('touchcancel', end, { passive: true });
})();

afterRender();
