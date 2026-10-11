/* Game-feel pass for Squishies: three clear tabs (Collection · Get more · Unlocks), a big free-box button,
   Star Dust from duplicates, guarantees shown as dots, set progress, NEW badges, a "Next up" Ultimate,
   a shop countdown and an "Earn more 💎" shortcut back to chores. Loaded after house.js. */
'use strict';

const SQ_TABS = [['mine', '🧸', 'Collection'], ['get', '🎁', 'Get more'], ['unlocks', '👑', 'Unlocks']];
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
  return `<div class="sq-top">
      <button class="gem-pill big" data-action="go" data-to="gems">${GEM} <b>${gemBalance(me)}</b></button>
      <button class="earn-btn" data-action="go" data-to="chores">＋ Earn more ${GEM}</button>
    </div>
    ${free ? `<button class="free-hero" data-action="sq-open" data-box="free"><span class="fh-gift">🎁</span><span class="fh-txt"><b>Open today’s free box!</b><small>A new surprise every day</small></span><span class="fh-go">Open</span></button>`
      : dustReady ? `<button class="free-hero dust" data-action="sq-open" data-box="dust"><span class="fh-gift">💫</span><span class="fh-txt"><b>Your Star Dust Box is ready!</b><small>Rare or better inside</small></span><span class="fh-go">Open</span></button>` : ''}
    <div class="sq-tabs3">${SQ_TABS.map(([k, e, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="sq-tab" data-tab="${k}"><span>${e}</span>${l}${k === 'mine' && trades ? `<i class="tab-badge">${trades}</i>` : ''}${k === 'get' && (free || dustReady) ? '<i class="tab-badge">!</i>' : ''}</button>`).join('')}</div>
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
  if (!groups.length) return `<div class="card empty"><span class="big">🧸</span>No squishies yet!<br><button class="btn" style="margin-top:12px" data-action="sq-open" data-box="free">🎁 Open your free box</button></div>`;
  const f = ui.sqFilter || 'all';
  const has = (fn) => groups.some(([sid, items]) => fn(SQ[sid], items));
  const chips = [['all', 'All', true], ['squishy', '🧸 Squishies', true], ['niddo', '🫧 Niddos', has((x) => x.kind === 'niddo')], ['shiny', '✨ Shiny', has((x, items) => items.some((i) => i.shiny))], ['U', '👑 Ultimate', has((x) => x.r === 'U')]].filter(([, , ok]) => ok);
  const show = groups.filter(([sid, items]) => f === 'all' || (f === 'shiny' ? items.some((i) => i.shiny) : f === 'U' ? SQ[sid].r === 'U' : SQ[sid].kind === f))
    .sort(([a, ia], [b, ib]) => (ib.some(sqNew) ? 1 : 0) - (ia.some(sqNew) ? 1 : 0));
  const sets = setProgress(me);
  const sp = spares(me);
  const fusable = TIERS.slice(0, -1).filter((t) => sp[t].length >= 3);
  return `${sets.length ? `<div class="set-strip">${sets.map((x) => `<button class="set-card" data-action="sq-sub" data-s="book"><span class="sc-e">${x.e}</span><b>${esc(x.name)}</b><span class="sc-bar"><i style="width:${(x.got / x.n) * 100}%"></i></span><small>${x.left <= 3 ? `Just ${x.left} more for +100 ${GEM}!` : `${x.got}/${x.n}`}</small></button>`).join('')}</div>` : ''}
    ${fusable.length ? `<button class="card fuse-cta" data-action="sq-fuse"><span>🔮</span><div><b>Fuse your spares!</b><small>Swap 3 extras for 1 rarer squishy</small></div></button>` : ''}
    ${chips.length > 2 ? `<div class="sq-filters">${chips.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-action="sq-filter" data-f="${k}">${l}</button>`).join('')}</div>` : ''}
    <div class="sq-grid">${show.map(([sid, items]) => sqTile(sid, `${items.length > 1 ? `<i class="sq-count">×${items.length}</i>` : ''}${items.some((i) => i.fav) ? '<i class="sq-fav">⭐</i>' : ''}${items.some(sqNew) ? '<i class="sq-new">NEW</i>' : ''}<i class="rar-gem rg-${SQ[sid].r}"></i>`, '', { shiny: items.some((i) => i.shiny) })).join('') || '<div class="small muted">Nothing here yet</div>'}</div>`;
}

/* ---------- Get more: boxes + shop ---------- */
function pityDots(b, me, k) {
  if (!b.pity) return '';
  const n = pityOf(me, k);
  return `<div class="pity"><span class="pity-dots">${[...Array(b.pity)].map((_, i) => `<i class="${i < n ? 'on' : ''}${i === b.pity - 1 ? ' last' : ''}"></i>`).join('')}</span><small>${RARITY[b.pityTier].name} or better by the ⭐ dot</small></div>`;
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
        <details class="odds"><summary>Odds (for grown-ups)</summary><div class="odds-list">${odds}<span class="rar" style="background:#f59f00">✨ Shiny ${Math.round((b.shiny ?? 0.02) * 100)}%</span></div></details></div>
      <button class="b2-buy${isFree ? ' free' : ''}" data-action="sq-open" data-box="${k}" ${isFree && freeUsed ? 'disabled' : ''}>${isFree ? (freeUsed ? 'Tomorrow' : 'Free!') : `${GEM} ${b.cost}`}</button>
    </div>`;
  };
  return `${season ? `<div class="season-banner s-${season[0]}"><span>${season[1].emoji}</span><div><b>${season[1].name} season!</b><small>Limited squishies — only for a little while</small></div></div>` : ''}
    <div class="dust-card"><span class="dc-ic">💫</span><div class="dc-main"><b>Star Dust</b><div class="dc-bar"><i style="width:${Math.min(100, (dust / DUST_GOAL) * 100)}%"></i></div><small>Doubles turn into Star Dust. ${DUST_GOAL} = a free Rare+ box!</small></div>${dust >= DUST_GOAL ? '<button class="b2-buy free" data-action="sq-open" data-box="dust">Open!</button>' : `<span class="dc-n">${dust}/${DUST_GOAL}</span>`}</div>
    <div class="box-list">${live.map(card).join('')}</div>
    <div class="section-title">🛍️ Today’s shop<span class="small shop-timer" style="text-transform:none">New in ${untilMidnight()}</span></div>
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
      <div class="nu-how">${next.info.icon} ${esc(next.info.how)}</div>
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
  if (r === 'squishies' && (ui.sqTab || 'mine') === 'mine' && (ui.sqSub || 'mine') === 'mine') { clearTimeout(ui.sqSeenT); ui.sqSeenT = setTimeout(() => { seen().sqSeen = Date.now(); try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }, 1500); }
};
// Inbox / other links that point at old tab names
document.addEventListener('click', (e) => { const el = e.target.closest('[data-sq-tab]'); if (el) { ui.sqTab = el.dataset.sqTab; sqNormTab(); } }, true);
