/* Game-feel pass for Squishies: three clear tabs (Collection · Get more · Unlocks), a big free-box button,
   Star Dust from duplicates, guarantees shown as dots, set progress, NEW badges, a "Next up" Ultimate,
   a shop countdown and an "Earn more 💎" shortcut back to chores. Loaded after house.js. */
'use strict';

const SQ_TABS = [['mine', '🧸', 'Collection'], ['get', '🎁', 'Get more'], ['unlocks', '👑', 'Unlocks']];
const SQ_TABS_SIMPLE = { mine: 'Mine', get: 'Get', unlocks: 'Goals' };
const simpleMe = () => { const id = actor(); return id && typeof isSimple === 'function' && isSimple(id) ? id : ''; };
const say = (id, text) => (id && typeof sayBtn === 'function' ? sayBtn(id, text) : '');
function sqNormTab() {
  const t = ui.sqTab || 'mine';
  if (t === 'boxes' || t === 'shop') ui.sqTab = 'get';
  else if (t === 'book' || t === 'trades') { ui.sqSub = t; ui.sqTab = 'mine'; }
  else if (!SQ_TABS.some(([k]) => k === t)) ui.sqTab = 'mine';
  return ui.sqTab;
}
const dustOf = (who) => state.squish.dust?.[who] || 0;
const sqNew = (i) => seen().sqSeen != null && i.at > seen().sqSeen;

views.squishies = () => {
  const me = actor();
  if (!me) return needMe() || '<div class="card empty">Pick who you are first.</div>';
  const tab = sqNormTab();
  const free = state.squish.free[me] !== today();
  const uniq = new Set(myItems(me).map((i) => i.sid)).size;
  const trades = tradeInbox(me).length;
  const dustReady = dustOf(me) >= DUST_GOAL;
  const little = simpleMe();
  return `<div class="sq-top">
      <button class="gem-pill big" data-action="go" data-to="gems">${GEM} <b>${gemBalance(me)}</b></button>
      ${say(little, free ? `You have ${gemBalance(me)} gems. Tap the big present to open your free box!` : `You have ${gemBalance(me)} gems. Gems are for squishies and your house. Do your jobs to earn more!`)}
      <button class="earn-btn" data-action="go" data-to="chores">＋ Earn more ${GEM}</button>
    </div>
    ${free ? `<button class="free-hero" data-action="sq-open" data-box="free"><span class="fh-gift">🎁</span><span class="fh-txt"><b>Open today’s free box!</b><small>A new surprise every day</small></span><span class="fh-go">Open</span></button>`
      : sqBankOf(me) ? `<button class="free-hero" data-action="sq-open" data-box="squish"><span class="fh-gift">🤏</span><span class="fh-txt"><b>You earned a Mystery Box!</b><small>From squishing ${sqCfg().every} times</small></span><span class="fh-go">Open</span></button>`
      : dustReady ? `<button class="free-hero dust" data-action="sq-open" data-box="dust"><span class="fh-gift">💫</span><span class="fh-txt"><b>Your Star Dust Box is ready!</b><small>Rare or better inside</small></span><span class="fh-go">Open</span></button>` : ''}
    <div class="sq-tabs3">${SQ_TABS.map(([k, e, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="sq-tab" data-tab="${k}"><span>${e}</span>${little ? SQ_TABS_SIMPLE[k] : l}${k === 'mine' && trades ? `<i class="tab-badge">${trades}</i>` : ''}${k === 'get' && (free || dustReady || sqBankOf(me)) ? '<i class="tab-badge">!</i>' : ''}</button>`).join('')}</div>
    ${tab === 'get' ? sqGetMore(me) : tab === 'unlocks' ? sqUnlocks(me) : sqCollection(me, uniq, trades)}`;
};

/* ---------- Collection: mine / book / trades ---------- */
function sqCollection(me, uniq, trades) {
  const sub = ui.sqSub || 'mine';
  const subs = [['mine', `🧸 Mine · ${uniq}`], ['book', '📖 Book'], ['trades', `🔁 Trades${trades ? ` (${trades})` : ''}`]];
  return `<div class="sq-sub">${subs.map(([k, l]) => `<button class="${sub === k ? 'on' : ''}" data-action="sq-sub" data-s="${k}">${l}</button>`).join('')}</div>
    ${sub === 'book' ? sqBook(me) : sub === 'trades' ? sqTrades(me) : sqMineV2(me)}`;
}
function setProgress(me) {
  const own = new Set(myItems(me).map((i) => i.sid));
  return Object.entries(SETS).filter(([k]) => k !== 'ult' && (!SEASONS[k] || inSeason(k))).map(([k, [e, name]]) => {
    const all = SQUISHIES.filter((s) => s.set === k && s.r !== 'U');
    const got = all.filter((s) => own.has(s.id)).length;
    return { k, e, name, got, n: all.length, left: all.length - got };
  }).filter((x) => x.got > 0 && x.left > 0).sort((a, b) => a.left - b.left).slice(0, 4);
}
function sqMineV2(me) {
  const groups = collectionGroups(me);
  if (!groups.length) return `<div class="card empty"><span class="big">🧸</span>Your squishies will live here!${state.squish.free[me] === today() ? `<br><button class="btn" style="margin-top:12px" data-action="sq-tab" data-tab="get">🎁 Get squishies</button>` : '<div class="small muted" style="margin-top:6px">Tap the big present above ☝️</div>'}</div>`;
  const f = ui.sqFilter || 'all';
  const has = (fn) => groups.some(([sid, items]) => fn(SQ[sid], items));
  const chips = [['all', 'All', true], ['squishy', '🧸 Squishies', true], ['niddo', '🫧 Niddos', has((x) => x.kind === 'niddo')], ['shiny', '✨ Shiny', has((x, items) => items.some((i) => i.shiny))], ['U', '👑 Ultimate', has((x) => x.r === 'U')]].filter(([, , ok]) => ok);
  const show = groups.filter(([sid, items]) => f === 'all' || (f === 'shiny' ? items.some((i) => i.shiny) : f === 'U' ? SQ[sid].r === 'U' : SQ[sid].kind === f))
    .sort(([a, ia], [b, ib]) => (ib.some(sqNew) ? 1 : 0) - (ia.some(sqNew) ? 1 : 0));
  const sets = setProgress(me);
  const sp = spares(me);
  const fusable = TIERS.slice(0, -1).filter((t) => sp[t].length >= 3);
  return `${sets.length ? `<div class="set-strip" data-keep="sets">${sets.map((x) => `<button class="set-card" data-action="sq-sub" data-s="book"><span class="sc-e">${x.e}</span><b>${esc(x.name)}</b><span class="sc-bar"><i style="width:${(x.got / x.n) * 100}%"></i></span><small>${x.left <= 3 ? `Just ${x.left} more for +100 ${GEM}!` : `${x.got}/${x.n}`}</small></button>`).join('')}</div>` : ''}
    ${fusable.length ? `<button class="card fuse-cta" data-action="sq-fuse"><span>🔮</span><div><b>Fuse your spares!</b><small>Swap 3 extras for 1 rarer squishy</small></div></button>` : ''}
    ${chips.length > 2 ? `<div class="sq-filters" data-keep="sqf">${chips.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-action="sq-filter" data-f="${k}">${l}</button>`).join('')}</div>` : ''}
    <div class="sq-grid">${show.map(([sid, items]) => sqTile(sid, `${items.length > 1 ? `<i class="sq-count">×${items.length}</i>` : ''}${items.some((i) => i.fav) ? '<i class="sq-fav">⭐</i>' : ''}${items.some(sqNew) ? '<i class="sq-new">NEW</i>' : ''}<i class="rar-gem rg-${SQ[sid].r}"></i>`, '', { shiny: items.some((i) => i.shiny) })).join('') || '<div class="small muted">Nothing here yet</div>'}</div>`;
}

/* ---------- Get more: boxes + shop ---------- */
function pityDots(b, me, k) {
  if (!b.pity) return '';
  const n = pityOf(me, k);
  return `<div class="pity"><span class="pity-dots">${[...Array(b.pity)].map((_, i) => `<i class="${i < n ? 'on' : ''}${i === b.pity - 1 ? ' last' : ''}"></i>`).join('')}</span>${simpleMe() ? '' : `<small>${RARITY[b.pityTier].name} or better by the ⭐ dot</small>`}</div>`;
}
function sqGetMore(me) {
  const freeUsed = state.squish.free[me] === today();
  const live = Object.entries(BOXES).filter(([k, b]) => !b.hidden && (!b.season || inSeason(b.season)));
  const season = Object.entries(SEASONS).find(([k]) => inSeason(k));
  const dust = dustOf(me);
  const card = ([k, b]) => {
    const isFree = k === 'free';
    const odds = TIERS.filter((t) => b.odds[t]).map((t) => `<span class="rar rar-${t}">${RARITY[t].name} ${b.odds[t]}%</span>`).join('');
    return `<div class="box2 box-${k}${isFree && freeUsed ? ' used' : ''}">
      <div class="b2-art">${b.emoji}</div>
      <div class="b2-info"><b>${b.name}</b>${b.season ? '<span class="pill accent">Limited</span>' : ''}${pityDots(b, me, k)}
        ${simpleMe() ? '<div hidden>' : '<details class="odds"><summary>Odds (for grown-ups)</summary>'}<div class="odds-list">${odds}<span class="rar" style="background:#f59f00">✨ Shiny ${Math.round((b.shiny ?? 0.02) * 100)}%</span></div>${simpleMe() ? '</div>' : '</details>'}</div>
      <button class="b2-buy${isFree ? ' free' : ''}" data-action="sq-open" data-box="${k}" ${isFree && freeUsed ? 'disabled' : ''}>${isFree ? (freeUsed ? 'Tomorrow' : 'Free!') : `${GEM} ${b.cost}`}</button>
    </div>`;
  };
  return `${season ? `<div class="season-banner s-${season[0]}"><span>${season[1].emoji}</span><div><b>${season[1].name} season!</b><small>Limited squishies — only for a little while</small></div></div>` : ''}
    <div class="dust-card"><span class="dc-ic">💫</span><div class="dc-main"><b>Star Dust</b><div class="dc-bar"><i style="width:${Math.min(100, (dust / DUST_GOAL) * 100)}%"></i></div><small>${simpleMe() ? `Extra squishies → 💫 → free box!` : `Doubles turn into Star Dust. ${DUST_GOAL} = a free Rare+ box!`}</small></div>${dust >= DUST_GOAL ? '<button class="b2-buy free" data-action="sq-open" data-box="dust">Open!</button>' : `<span class="dc-n">${dust}/${DUST_GOAL}</span>`}</div>
    <div class="box-list">${live.map(card).join('')}</div>
    <div class="section-title">🛍️ Today’s shop<span class="small" style="text-transform:none">New ones every day</span></div>
    <div class="sq-grid shop">${shopToday().map((s) => sqTile(s.id, `<span class="price">${GEM} ${RARITY[s.r].price}</span>${ownsSid(me, s.id) ? '<i class="have">✓ Have it</i>' : ''}<i class="rar-gem rg-${s.r}"></i>`, `data-action="sq-buy" data-sid="${s.id}"`)).join('')}</div>
    <p class="small muted" style="margin:10px 4px">👑 Ultimates can’t be bought — earn them in Unlocks!</p>`;
}
function untilMidnight() {
  const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const m = Math.max(0, Math.round((mid - now) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/* ---------- Unlocks: "Next up" first, sorted by how close ---------- */
const ULT_GO = { chores50: 'chores', chores150: 'chores', streak14: 'chores', routines20: 'routines', word7: 'word', kudos10: 'kudos', todos25: 'todos', trade1: 'squishies', squish1000: 'squishies', shiny5: 'squishies', unique50: 'squishies', allRegular: 'squishies', allNiddo: 'squishies', spookySet: 'squishies', winterSet: 'squishies' };
const ULT_DO = { chores50: 'Do a chore', chores150: 'Do a chore', streak14: 'Do a chore today', routines20: 'Do your routine', word7: 'Play Family Word', kudos10: 'Send a high-five', todos25: 'Finish a to-do', trade1: 'Make a trade', squish1000: 'Squish your squishies', shiny5: 'Open boxes', unique50: 'Open boxes', allRegular: 'Open boxes', allNiddo: 'Open Niddo Capsules', spookySet: 'Open Spooky Boxes', winterSet: 'Open Snow Globe Boxes' };
const _sqUnlocksOld = sqUnlocks;
sqUnlocks = function (me) {
  const ults = SQUISHIES.filter((s) => s.r === 'U');
  const rows = ults.map((s) => ({ s, info: ultimateInfo(s, me), own: ownsSid(me, s.id), season: s.unlock === 'spookySet' ? 'spooky' : s.unlock === 'winterSet' ? 'winter' : '' }));
  const open = rows.filter((x) => !x.own && (!x.season || inSeason(x.season))).sort((a, b) => b.info.pct - a.info.pct);
  const next = open[0];
  const got = rows.filter((x) => x.own).length;
  const card = (x) => `<button class="card ult-card${x.own ? ' got' : ''}" data-action="go" data-to="squishy/${x.s.id}">
      <div class="ult-art">${squishySVG(x.s.id, { cls: x.own ? '' : 'locked' })}${x.own ? '' : '<span class="ult-lock">🔒</span>'}</div>
      <div class="grow"><b>${esc(x.s.name)}</b><div class="small">${x.info.icon} ${esc(x.info.how)}${x.season && !inSeason(x.season) ? ` <span class="muted">(${SEASONS[x.season].emoji} in ${SEASONS[x.season].back})</span>` : ''}</div>
        ${x.own ? '<div class="ult-done">✓ Unlocked!</div>' : `<div class="ult-bar"><i style="width:${Math.round(x.info.pct * 100)}%"></i></div><div class="small muted">${x.info.cur.toLocaleString()} / ${x.info.goal.toLocaleString()}</div>`}</div></button>`;
  return `${next ? `<div class="next-up">
      <div class="nu-label">⭐ Next up</div>
      <div class="nu-art">${squishySVG(next.s.id, { cls: 'locked' })}</div>
      <b>${esc(next.s.name)}</b>
      <div class="nu-how">${next.info.icon} ${esc(next.info.how)} ${say(simpleMe(), `Next you can win ${next.s.name}. ${next.info.how}. You have ${next.info.cur} of ${next.info.goal}.`)}</div>
      <div class="nu-bar"><i style="width:${Math.max(4, Math.round(next.info.pct * 100))}%"></i><span>${next.info.cur.toLocaleString()} / ${next.info.goal.toLocaleString()}</span></div>
      <button class="nu-go" data-action="go" data-to="${ULT_GO[next.s.unlock] || 'squishies'}" ${ULT_GO[next.s.unlock] === 'squishies' ? 'data-sq-tab="get"' : ''}>${esc(ULT_DO[next.s.unlock] || 'Keep going')} →</button>
    </div>` : ''}
    <div class="section-title">👑 All Ultimates<span class="small" style="text-transform:none">${got}/${ults.length} earned</span></div>
    <div class="ult-list">${[...open.slice(next ? 1 : 0), ...rows.filter((x) => !x.own && x.season && !inSeason(x.season)), ...rows.filter((x) => x.own)].map(card).join('')}</div>`;
};
void _sqUnlocksOld;

/* ---------- Shop tiles show what you own; sub-tabs; seen markers ---------- */
Object.assign(actions, {
  'sq-sub': (el) => { ui.sqTab = 'mine'; ui.sqSub = el.dataset.s; render(); },
});
KID_ACTIONS.add('sq-sub');
const _afterRenderP = afterRender;
afterRender = function () {
  _afterRenderP();
  const r = currentRoute().name;
  // Remember when the collection was last looked at, so NEW badges clear next time.
  if (r === 'squishies' && seen().sqSeen == null) seen().sqSeen = Date.now();
  if (r === 'squishies' && (ui.sqTab || 'mine') === 'mine' && (ui.sqSub || 'mine') === 'mine') { clearTimeout(ui.sqSeenT); ui.sqSeenT = setTimeout(() => { seen().sqSeen = Date.now(); saveSeen(); }, 1500); }
};
// Inbox / other links that point at old tab names
document.addEventListener('click', (e) => { const el = e.target.closest('[data-sq-tab]'); if (el) { ui.sqTab = el.dataset.sqTab; sqNormTab(); } }, true);

/* ---------- Book: sets start folded so the page draws fast ---------- */
const BOOK_ORDER = ['critters', 'treats', 'dream', 'ocean', 'snack', 'farm', 'niddo', 'spooky', 'winter', 'ult'];
sqBook = function (me) {
  const shinySids = new Set(myItems(me).filter((i) => i.shiny).map((i) => i.sid));
  const sets = BOOK_ORDER.filter((k) => SETS[k]).map((k) => {
    const all = SQUISHIES.filter((s) => s.set === k);
    return { k, all, got: all.filter((s) => ownsSid(me, s.id)).length };
  });
  if (!ui.bookOpen) {
    // Open the set you're closest to finishing (but not already done) — that's the fun one to look at.
    const best = sets.filter((x) => x.got < x.all.length).sort((a, b) => b.got / b.all.length - a.got / a.all.length)[0] || sets[0];
    ui.bookOpen = { [best.k]: true };
  }
  return sets.map(({ k, all, got }) => {
    const [e, name] = SETS[k], season = SEASONS[k], open = !!ui.bookOpen[k];
    const note = k === 'ult' ? `${got}/${all.length}` : `${got}/${all.length}${got === all.length ? ' 🏆' : ''}${season ? (inSeason(k) ? ' · <b>now!</b>' : ` · back in ${season.back}`) : ''}`;
    const pct = Math.round((got / all.length) * 100);
    return `<button class="book-head${open ? ' open' : ''}" data-action="sq-book" data-k="${k}" aria-expanded="${open}">
        <span class="bh-e">${e}</span><span class="bh-name">${name}<i class="bh-bar"><b style="width:${pct}%"></b></i></span><span class="bh-n">${note}</span><span class="bh-chev">›</span></button>
      ${open ? `${k !== 'ult' && got < all.length ? '<div class="small muted bh-tip">Finish the set for +100 💎</div>' : k === 'ult' ? '<div class="small muted bh-tip">Earn these in 👑 Goals</div>' : ''}
      <div class="sq-grid book">${all.map((s) => ownsSid(me, s.id) ? sqTile(s.id, '', '', { shiny: shinySids.has(s.id) }) : `<button class="sq-tile missing r-${s.r}" data-action="go" data-to="squishy/${s.id}">${squishySVG(s.id, { cls: 'shadow' })}<span class="sq-name">${s.r === 'U' ? '🔒 ' + esc(s.name) : '???'}</span></button>`).join('')}</div>` : ''}`;
  }).join('') + `<p class="small muted" style="margin:10px 4px">✨ Shinies glow in your book. Every box has a small chance to be shiny!</p>`;
};
actions['sq-book'] = (el) => { ui.bookOpen ||= {}; ui.bookOpen[el.dataset.k] = !ui.bookOpen[el.dataset.k]; render(); };
KID_ACTIONS.add('sq-book');

/* ---------- Dream House: read-aloud for little ones ---------- */
const _houseViewP = views.house, _roomViewP = views.room;
views.house = (pid) => {
  const html = _houseViewP(pid), id = simpleMe();
  if (!id || (pid && pid !== id)) return html;
  return html.replace('<div class="house-actions">', `<div class="h-say">${say(id, 'This is your dream house! Tap a room to go inside. Tap you to change your clothes.')}</div><div class="house-actions">`);
};
views.room = (roomId) => {
  const html = _roomViewP(roomId), id = simpleMe();
  if (!id) return html;
  const text = ui.hEdit ? 'Pick something at the bottom to try it. Drag things to move them. Tap Done when you finish.' : 'Tap Decorate to add things. Tap the floor to walk.';
  return html.includes('class="hsel-bar') ? html.replace(/(<div class="hsel-bar[^"]*">)/, `$1${say(id, text)}`) : html.replace('<p class="room-hint">', `<p class="room-hint">${say(id, text)} `);
};

/* ---------- Squish rewards: every 100 squishes (parents can change it) = a free Mystery Box ---------- */
const sqCfg = () => { const c = gemsCfg(); return { every: Math.max(0, Number(c.sqEvery) || 0), daily: Math.max(0, Number(c.sqDaily) || 0) }; };
const sqBankOf = (who) => state.squish.sqBank?.[who] || 0;
const sqCountOf = (who) => state.squish.squished?.[who] || 0;
function squishCard(me) {
  const { every, daily } = sqCfg();
  if (!every || !me) return '';
  const bank = sqBankOf(me), cnt = sqCountOf(me) % every;
  return `<div class="dust-card sqr-card"><span class="dc-ic">🤏</span><div class="dc-main"><b>Squish rewards</b><div class="dc-bar"><i class="sqr-fill" style="width:${(cnt / every) * 100}%"></i></div>
    <small>${simpleMe() ? `Squish ${every} times → a free box!` : `Every ${every} squishes = a free Mystery Box${daily ? ` (up to ${daily} a day)` : ''}`}</small></div>
    ${bank ? `<button class="b2-buy free" data-action="sq-open" data-box="squish">Open${bank > 1 ? ` (${bank})` : '!'}</button>` : `<span class="dc-n sqr-n">${cnt}/${every}</span>`}</div>`;
}
function squishReward(who, n) {
  if (!who) return;
  const { every, daily } = sqCfg();
  state.squish.squished ||= {}; state.squish.sqBank ||= {}; state.squish.sqDay ||= {};
  const before = state.squish.squished[who] || 0, after = before + n;
  state.squish.squished[who] = after;
  if (every && Math.floor(after / every) > Math.floor(before / every)) {
    const day = state.squish.sqDay[who]?.d === today() ? state.squish.sqDay[who] : { d: today(), n: 0 };
    if (daily && day.n >= daily) {
      toast(`🤏 ${after.toLocaleString()} squishes! You got today's ${daily} free boxes — more tomorrow`);
    } else {
      day.n += 1;
      state.squish.sqDay[who] = day;
      state.squish.sqBank[who] = (state.squish.sqBank[who] || 0) + 1;
      sqSound('win');
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      toast(`🎉 ${every} squishes! You earned a free Mystery Box`);
      save(); render();
      return;
    }
  }
  if (every) {
    const cnt = after % every;
    for (const el of document.querySelectorAll('.sqr-fill')) el.style.width = (cnt / every) * 100 + '%';
    for (const el of document.querySelectorAll('.sqr-n')) el.textContent = `${cnt}/${every}`;
  }
}
const _sqGetMoreR = sqGetMore;
sqGetMore = function (me) {
  const html = _sqGetMoreR(me), card = squishCard(me);
  const i = html.indexOf('<div class="box-list">');
  return i < 0 ? card + html : html.slice(0, i) + card + html.slice(i);
};
// On a squishy's own page (where you squish), show the progress right under it.
const _squishyViewR = views.squishy;
views.squishy = (sid) => {
  const html = _squishyViewR(sid), card = squishCard(actor());
  const i = html.indexOf('<div class="btn-row">');
  return i < 0 || !card ? html : html.slice(0, i) + card + html.slice(i);
};
