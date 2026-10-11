/* Together: family chat with reactions & @mentions, high-fives (with bonus ⭐ for kids), daily check-ins,
   shared to-dos you can claim, event RSVPs, family challenges and the 🔔 inbox. Loaded after family.js. */
'use strict';

Object.assign(TITLES, { chat: 'Family Chat', kudos: 'High-fives', checkin: 'Check-in', todos: 'To-dos', challenges: 'Challenges', inbox: 'Inbox' });

const kidHere = () => typeof inKidMode === 'function' && inKidMode();
const isGrownUp = () => !kidHere() && !(actor() && member(actor()).kid);
const seen = () => (state.settings.seen ||= {});
const memberIds = () => state.members.map((m) => m.id);
const isMember = (id) => state.members.some((m) => m.id === id);
function logAct(icon, text, to = '') {
  state.activity = [{ id: uid(), at: Date.now(), who: actor(), icon, text, to }, ...(state.activity || [])].slice(0, 200);
}
const avatarsOf = (ids) => ids.filter(isMember).map((id) => `<span class="mini-av" style="--c:${member(id).color}" title="${esc(member(id).name)}">${esc(member(id).emoji)}</span>`).join('');
function needMe() {
  if (actor() || state.members.length < 2) return '';
  return whoAmICard();
}

/* =========================================================
   1 · Family chat
   ========================================================= */
const CHAT_RX = ['❤️', '😂', '👍', '😮', '🙌', '😢'];
function mentionsIn(text) { return state.members.filter((m) => new RegExp(`@${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)).map((m) => m.id); }
function chatText(text) {
  let h = esc(text);
  for (const m of state.members) {
    const n = esc(m.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(`@${n}\\b`, 'gi'), `<b class="mention${m.id === actor() ? ' me' : ''}">@${esc(m.name)}</b>`);
  }
  return h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
const bigEmoji = (t) => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u.test(t) && !/^[\d#*\s]+$/.test(t);
function chatTimeline() {
  const items = [
    ...state.chat.map((m) => ({ ...m, kind: 'msg' })),
    ...state.kudos.filter((k) => Date.now() - k.at < 30 * 86400000).map((k) => ({ ...k, kind: 'kudos' })),
  ].sort((a, b) => a.at - b.at);
  return items.slice(-150);
}
function rxChips(item, action) {
  const rx = item.rx || {};
  const on = Object.entries(rx).filter(([, who]) => Object.keys(who).length);
  if (!on.length) return '';
  return `<div class="msg-rx">${on.map(([e, who]) => `<button class="${who[actor() || 'anon'] ? 'on' : ''}" data-action="${action}" data-id="${item.id}" data-e="${e}">${e}${Object.keys(who).length > 1 ? Object.keys(who).length : ''}</button>`).join('')}</div>`;
}
views.chat = () => {
  const me = actor();
  const items = chatTimeline();
  let lastDay = '', lastWho = '', lastAt = 0;
  const out = items.map((x) => {
    const day = iso(new Date(x.at));
    let sep = '';
    if (day !== lastDay) { sep = `<div class="chat-day">${day === today() ? 'Today' : day === addDays(today(), -1) ? 'Yesterday' : fmtDate(day, { weekday: 'long', month: 'short', day: 'numeric' })}</div>`; lastDay = day; lastWho = ''; }
    if (x.kind === 'kudos') { lastWho = ''; return sep + kudosBubble(x); }
    const mine = x.who === me && me;
    const cont = x.who === lastWho && x.at - lastAt < 5 * 60000;
    lastWho = x.who; lastAt = x.at;
    const m = isMember(x.who) ? member(x.who) : { emoji: '👤', name: 'Someone', color: '#888' };
    const pick = ui.msgPick === x.id;
    const big = bigEmoji(x.text);
    return `${sep}<div class="msg${mine ? ' mine' : ''}${cont ? ' cont' : ''}${mentionsIn(x.text).includes(me) && !mine ? ' at-me' : ''}" style="--c:${m.color}">
      ${mine ? '' : `<div class="msg-av">${cont ? '' : esc(m.emoji)}</div>`}
      <div class="msg-body">
        ${mine || cont ? '' : `<div class="msg-name">${esc(m.name)}</div>`}
        <button class="bubble${big ? ' big' : ''}" data-action="msg-tap" data-id="${x.id}">${chatText(x.text)}<span class="msg-time">${new Date(x.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></button>
        ${rxChips(x, 'msg-react')}
        ${pick ? `<div class="rx-pick">${CHAT_RX.map((e) => `<button data-action="msg-react" data-id="${x.id}" data-e="${e}">${e}</button>`).join('')}${mine || isGrownUp() ? `<button class="rx-del" data-action="msg-del" data-id="${x.id}" aria-label="Delete">🗑️</button>` : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `${needMe()}<div class="chat">${out || `<div class="card empty"><span class="big">💬</span>The family group chat. Say hi! 👋<div class="small muted" style="margin-top:6px">Type <b>@</b> to mention someone · tap a message to react</div></div>`}</div>`;
};
function kudosBubble(k) {
  const f = isMember(k.from) ? member(k.from) : null, t = isMember(k.to) ? member(k.to) : null;
  return `<div class="kudos-bubble" style="--c:${t ? t.color : 'var(--accent)'}">
    <div class="kb-emoji">${esc(k.emoji || '🙌')}</div>
    <div class="grow"><b>${esc(f ? f.name : 'Someone')} → ${esc(t ? t.name : 'Someone')}</b><div>${esc(k.text || 'High-five!')}</div>${k.stars ? `<span class="pill accent">+${k.stars} ⭐</span>` : ''}</div>
    ${rxChips(k, 'kudos-react')}
  </div>`;
}

// The composer lives outside #view so incoming messages can re-render the chat without closing the keyboard.
const chatBar = document.createElement('form');
chatBar.id = 'chatBar';
chatBar.hidden = true;
chatBar.innerHTML = `<div class="mention-row" hidden></div><div class="chat-compose"><input id="chatInput" type="text" placeholder="Message the family…" autocomplete="off" enterkeyhint="send" aria-label="Message"><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>`;
document.body.appendChild(chatBar);
const chatInput = chatBar.querySelector('#chatInput');
function mentionRow() {
  const row = chatBar.querySelector('.mention-row');
  const m = chatInput.value.slice(0, chatInput.selectionStart ?? chatInput.value.length).match(/@(\S*)$/);
  const opts = m ? state.members.filter((x) => norm(x.name).startsWith(norm(m[1])) && x.id !== actor()) : [];
  row.hidden = !opts.length;
  row.innerHTML = opts.map((x) => `<button type="button" data-mention="${esc(x.name)}">${esc(x.emoji)} ${esc(x.name)}</button>`).join('');
}
chatInput.addEventListener('input', () => { ui.chatDraft = chatInput.value; mentionRow(); });
chatBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mention]');
  if (!b) return;
  const pos = chatInput.selectionStart ?? chatInput.value.length;
  const before = chatInput.value.slice(0, pos).replace(/@(\S*)$/, `@${b.dataset.mention} `);
  chatInput.value = before + chatInput.value.slice(pos);
  ui.chatDraft = chatInput.value;
  chatInput.focus();
  chatInput.setSelectionRange(before.length, before.length);
  mentionRow();
});
chatBar.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  if (!actor() && state.members.length > 1) { toast('Pick who you are first 👆'); return; }
  state.chat.push({ id: uid(), at: Date.now(), who: actor(), text: text.slice(0, 1000), rx: {} });
  if (state.chat.length > 400) state.chat = state.chat.slice(-400);
  chatInput.value = ''; ui.chatDraft = '';
  mentionRow();
  seen().chat = Date.now();
  save(); render();
  chatInput.focus();
  scrollChat();
});
function scrollChat() { requestAnimationFrame(() => { viewEl.scrollTop = viewEl.scrollHeight; }); }
// Keep the composer above the iPhone keyboard.
if (window.visualViewport) {
  const place = () => {
    const kb = Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop);
    chatBar.style.setProperty('--kb', kb + 'px');
    document.body.classList.toggle('kb-open', kb > 80 && !chatBar.hidden);
  };
  visualViewport.addEventListener('resize', place);
  visualViewport.addEventListener('scroll', place);
}

/* =========================================================
   2 · High-fives & kudos
   ========================================================= */
const KUDOS_EMOJI = ['🙌', '⭐', '💪', '❤️', '🏆', '🌈', '🔥', '🤗'];
const KUDOS_TEXT = ['Great job!', 'Thank you!', 'Proud of you!', 'You’re the best!', 'So helpful today!', 'Love you!'];
function kudosForm(to, text) {
  const me = actor();
  const others = state.members.filter((m) => m.id !== me);
  if (!others.length) { toast('Add family members first (Settings)'); return; }
  const canStars = isGrownUp();
  openSheet({
    title: '🙌 Send a high-five',
    saveLabel: 'Send',
    values: { to: to || others[0].id, text: text || '', stars: '0' },
    fields: [
      { name: 'to', label: 'To', type: 'select', options: others.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` })) },
      { type: 'html', html: `<div class="swatches kudos-sw">${KUDOS_EMOJI.map((e, i) => `<label><input type="radio" name="kemoji" value="${e}" ${i === 0 ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>` },
      { name: 'text', label: 'Message', placeholder: 'Great job!' },
      { type: 'html', html: `<div class="chips" style="margin:-6px 0 10px">${KUDOS_TEXT.map((t) => `<button type="button" class="chip" data-kudos-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>` },
      ...(canStars ? [{ name: 'stars', label: 'Bonus ⭐ for a kid', type: 'select', options: [['0', 'No bonus'], ['1', '+1 ⭐'], ['2', '+2 ⭐'], ['3', '+3 ⭐'], ['5', '+5 ⭐'], ['10', '+10 ⭐']].map(([value, label]) => ({ value, label })), hint: 'Stars add to their points for rewards' }] : []),
    ],
    onSave(v) {
      if (!me && state.members.length > 1) { toast('Pick who you are first (Settings → This phone)'); return false; }
      const emoji = $('#sheetForm').elements.kemoji?.value || '🙌';
      const stars = canStars && member(v.to).kid ? Number(v.stars) || 0 : 0;
      state.kudos.push({ id: uid(), at: Date.now(), from: me, to: v.to, emoji, text: v.text || 'High-five!', stars, rx: {} });
      logAct(emoji, `high-fived ${whoName(v.to)}${stars ? ` (+${stars} ⭐)` : ''}`, 'kudos');
      setTimeout(confetti, 120);
      toast(`${emoji} Sent to ${whoName(v.to)}!`);
    },
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kudos-text]');
  if (!b) return;
  const f = $('#sheetForm').elements.text;
  if (f) f.value = b.dataset.kudosText;
});
views.kudos = () => {
  const me = actor();
  const month = monthKey(today());
  const thisMonth = state.kudos.filter((k) => monthKey(iso(new Date(k.at))) === month);
  const got = Object.fromEntries(state.members.map((m) => [m.id, thisMonth.filter((k) => k.to === m.id).length]));
  const list = [...state.kudos].sort((a, b) => b.at - a.at).slice(0, 60);
  return `${needMe()}
    <button class="card kudos-hero" data-action="kudos-new"><span class="kh-hand">🙌</span><b>Send a high-five</b><span class="small muted">Cheer someone on${isGrownUp() ? ' · add bonus ⭐ for kids' : ''}</span></button>
    <div class="section-title">This month</div>
    <div class="wallets">${state.members.map((m) => `<button class="wallet" style="--c:${m.color}" data-action="kudos-new" data-to="${m.id}" ${m.id === me ? 'disabled' : ''}>${avatar(m)}<b>${got[m.id]}</b><span>${esc(m.name)}</span></button>`).join('')}</div>
    <div class="section-title">Recent</div>
    ${list.map(kudosBubble).join('') || '<div class="card empty small">No high-fives yet — be the first! 🙌</div>'}`;
};
// Bonus stars count toward a kid's points (rewards store, treats, levels).
const _pointsEarnedT = pointsEarned;
pointsEarned = function (id) { return _pointsEarnedT(id) + sum(state.kudos.filter((k) => k.to === id), (k) => Number(k.stars) || 0); };

/* =========================================================
   3 · Daily check-in
   ========================================================= */
const MOODS = [['😄', 'Great'], ['🙂', 'Good'], ['😐', 'Okay'], ['😴', 'Tired'], ['😕', 'Meh'], ['😢', 'Sad'], ['😡', 'Grumpy'], ['🤒', 'Sick']];
const checkinOf = (id, d = today()) => state.checkins[d]?.[id];
function moodStrip(d = today()) {
  return `<div class="mood-strip">${state.members.map((m) => { const c = checkinOf(m.id, d); return `<div class="ms${c ? '' : ' off'}" style="--c:${m.color}"><span class="ms-av">${esc(m.emoji)}</span><span class="ms-mood">${c ? esc(c.mood) : '·'}</span></div>`; }).join('')}</div>`;
}
views.checkin = () => {
  const me = actor();
  const mine = me ? checkinOf(me) : null;
  const simple = typeof isSimple === 'function' && me && isSimple(me);
  const day = state.checkins[today()] || {};
  const week = [...Array(7)].map((_, i) => addDays(today(), i - 6));
  return `${needMe()}
    ${me ? `<div class="card checkin-card">
      <h3>${mine ? 'Today you’re feeling' : 'How are you feeling today?'} ${simple && typeof sayBtn === 'function' ? sayBtn(me, 'How are you feeling today?') : ''}</h3>
      <div class="mood-grid">${MOODS.map(([e, l]) => `<button class="${mine?.mood === e ? 'on' : ''}" data-action="checkin-mood" data-m="${e}"><span>${e}</span><small>${l}</small></button>`).join('')}</div>
      ${mine && !simple ? `<form class="quick-add" data-submit="checkin-note" style="margin-top:12px"><input type="text" name="gratitude" placeholder="🙏 One good thing about today…" value="${esc(mine.note || '')}" autocomplete="off"><button class="btn" type="submit">Save</button></form>` : ''}
    </div>` : ''}
    <div class="section-title">The family today</div>
    <div class="card flush">${state.members.map((m) => {
      const c = day[m.id];
      const hearts = Object.keys(c?.hearts || {});
      return `<div class="row checkin-row${c ? '' : ' off'}">${avatar(m)}<div class="grow"><div class="title">${esc(m.name)} ${c ? `<span class="ci-mood">${esc(c.mood)}</span>` : ''}</div><div class="sub" style="white-space:normal">${c ? (c.note ? `🙏 ${esc(c.note)}` : esc(MOODS.find(([e]) => e === c.mood)?.[1] || '')) : 'Hasn’t checked in yet'}</div></div>
        ${c && m.id !== me ? `<button class="heart-btn${hearts.includes(me || 'anon') ? ' on' : ''}" data-action="checkin-heart" data-id="${m.id}">❤️${hearts.length ? `<span>${hearts.length}</span>` : ''}</button>` : hearts.length ? `<span class="small">❤️ ${hearts.length}</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="section-title">This week</div>
    <div class="card mood-week">
      <div class="mw-row mw-head"><span></span>${week.map((d) => `<span>${parse(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>`).join('')}</div>
      ${state.members.map((m) => `<div class="mw-row"><span>${esc(m.emoji)}</span>${week.map((d) => `<span>${esc(checkinOf(m.id, d)?.mood || '·')}</span>`).join('')}</div>`).join('')}
    </div>`;
};
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-submit="checkin-note"]');
  if (!f) return;
  e.preventDefault();
  const c = checkinOf(actor());
  if (!c) return;
  c.note = f.elements.gratitude.value.trim();
  save(); render(); toast('🙏 Saved');
});

/* =========================================================
   4 · Shared to-dos ("I'll do it!")
   ========================================================= */
function todoRow(t) {
  const me = actor();
  const claim = t.claimedBy && isMember(t.claimedBy) ? member(t.claimedBy) : null;
  const canDel = !kidHere() || t.by === me;
  return `<div class="row todo${t.done ? ' done' : ''}">
    <button class="check${t.done ? ' on' : ''}" data-action="todo-toggle" data-id="${t.id}" aria-label="Done">${ICON.check}</button>
    <div class="grow"><div class="title">${esc(t.text)}</div><div class="sub">${t.done ? `✅ ${esc(whoName(t.doneBy))} · ${timeAgo(t.doneAt)}` : [t.for && isMember(t.for) ? `for ${esc(member(t.for).name)}` : '', t.due ? `due ${fmtDate(t.due, { weekday: 'short', month: 'short', day: 'numeric' })}` : '', `added by ${esc(whoName(t.by))}`].filter(Boolean).join(' · ')}</div></div>
    ${t.done ? '' : claim ? `<button class="claim on${t.claimedBy === me ? ' mine' : ''}" data-action="todo-claim" data-id="${t.id}" style="--c:${claim.color}">${esc(claim.emoji)} ${t.claimedBy === me ? 'You’re on it' : `${esc(claim.name)}’s on it`}</button>` : `<button class="claim" data-action="todo-claim" data-id="${t.id}">🙋 I’ll do it!</button>`}
    ${canDel ? `<button class="del-btn" data-action="todo-del" data-id="${t.id}" aria-label="Delete">${ICON.x}</button>` : ''}
  </div>`;
}
views.todos = () => {
  const open = state.todos.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.at - b.at);
  const done = state.todos.filter((t) => t.done && Date.now() - (t.doneAt || 0) < 7 * 86400000).sort((a, b) => b.doneAt - a.doneAt);
  const free = open.filter((t) => !t.claimedBy).length;
  return `${needMe()}
    <form class="quick-add card" data-submit="todo-add" style="padding:8px"><input type="text" name="todoText" placeholder="Add a to-do for the family…" autocomplete="off"><button class="btn" type="submit" aria-label="Add">${ICON.plus}</button></form>
    ${free ? `<p class="small muted" style="margin:0 4px 10px">🙋 ${free} up for grabs — tap <b>I’ll do it!</b> so everyone knows you’ve got it.</p>` : ''}
    <div class="card flush">${open.map(todoRow).join('') || '<div class="empty">🎉 Nothing to do! Add something above.</div>'}</div>
    ${done.length ? `<div class="section-title">Done this week</div><div class="card flush">${done.map(todoRow).join('')}</div>` : ''}
    ${kidHere() ? '' : `<button class="fab" data-action="todo-new" aria-label="New to-do">${ICON.plus}</button>`}`;
};
function todoForm(t) {
  const isNew = !t;
  openSheet({
    title: isNew ? 'New to-do' : 'Edit to-do',
    values: t || { for: '' },
    fields: [
      { name: 'text', label: 'To-do', required: true, placeholder: 'e.g. Return library books' },
      { row: [{ name: 'for', label: 'For', type: 'select', options: [{ value: '', label: '🙋 Anyone' }, ...state.members.map((m) => ({ value: m.id, label: `${m.emoji} ${m.name}` }))] }, { name: 'due', label: 'Due', type: 'date' }] },
    ],
    onSave(v) {
      if (isNew) state.todos.push({ id: uid(), at: Date.now(), by: actor(), text: v.text, for: v.for, due: v.due, claimedBy: v.for || '', done: false });
      else Object.assign(t, { text: v.text, for: v.for, due: v.due });
    },
    onDelete: isNew ? null : () => withUndo('To-do deleted', () => { state.todos = state.todos.filter((x) => x.id !== t.id); }),
  });
}
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-submit="todo-add"]');
  if (!f) return;
  e.preventDefault();
  const text = f.elements.todoText.value.trim();
  if (!text) return;
  state.todos.push({ id: uid(), at: Date.now(), by: actor(), text, for: '', due: '', claimedBy: '', done: false });
  save(); render();
  $('[data-submit="todo-add"] input')?.focus();
});

/* =========================================================
   5 · Event RSVPs ("Who's in?")
   ========================================================= */
const RSVP = { yes: ['✅', 'Going'], maybe: ['🤔', 'Maybe'], no: ['❌', 'Can’t'] };
function rsvpUpcoming(days = 21) {
  const out = [], seenIds = new Set();
  for (let i = 0; i <= days; i++) {
    const d = addDays(today(), i);
    for (const ev of state.events) if (ev.askRsvp && !seenIds.has(ev.id) && occursOn(ev, d)) { seenIds.add(ev.id); out.push({ ev, d }); }
  }
  return out;
}
function rsvpCard({ ev, d }) {
  const me = actor();
  const r = ev.rsvp?.[d] || {};
  const mine = me ? r[me] : '';
  const days = daysBetween(today(), d);
  return `<div class="card rsvp-card">
    <div class="rsvp-head"><div class="rsvp-date"><b>${parse(d).getDate()}</b><span>${parse(d).toLocaleDateString(undefined, { month: 'short' })}</span></div>
      <div class="grow"><div class="title">${esc(ev.title)}</div><div class="sub">${days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'long' })}${ev.time ? ` · ${fmtTime(ev.time)}` : ''}${ev.location ? ` · 📍 ${esc(ev.location)}` : ''}</div></div></div>
    <div class="rsvp-who">${Object.entries(RSVP).map(([k, [e]]) => { const ids = Object.keys(r).filter((id) => r[id] === k && isMember(id)); return ids.length ? `<span>${e} ${avatarsOf(ids)}</span>` : ''; }).join('')}${state.members.filter((m) => !r[m.id]).length ? `<span class="muted">⏳ ${avatarsOf(state.members.filter((m) => !r[m.id]).map((m) => m.id))}</span>` : ''}</div>
    ${me ? `<div class="rsvp-btns">${Object.entries(RSVP).map(([k, [e, l]]) => `<button class="${mine === k ? 'on ' + k : ''}" data-action="rsvp" data-id="${ev.id}" data-d="${d}" data-v="${k}">${e} ${l}</button>`).join('')}</div>` : ''}
  </div>`;
}
// A compact who's-in line under events in lists (Home, Calendar, Agenda).
function rsvpLine(e) {
  if (e.kind !== 'event') return '';
  const ev = state.events.find((x) => x.id === e.id);
  if (!ev?.askRsvp) return '';
  const d = e.date || (currentRoute().name === 'calendar' ? ui.calSel : today());
  const r = ev.rsvp?.[d] || {};
  const yes = Object.keys(r).filter((id) => r[id] === 'yes' && isMember(id)), maybe = Object.keys(r).filter((id) => r[id] === 'maybe' && isMember(id));
  const waiting = state.members.filter((m) => !r[m.id]).length;
  return `<div class="rsvp-mini">${yes.length ? `✅ ${avatarsOf(yes)}` : ''}${maybe.length ? ` 🤔 ${avatarsOf(maybe)}` : ''}${waiting ? ` <span class="muted">· ${waiting} not answered</span>` : ''}</div>`;
}

/* =========================================================
   6 · Family challenges
   ========================================================= */
const CHALLENGE_KINDS = { chores: '🧹 Chores done (counts automatically)', todos: '✅ To-dos finished (automatic)', checkins: '😊 Daily check-ins (automatic)', word: '🔤 Family Word solves (automatic)', manual: '➕ We tap +1 ourselves' };
const CHALLENGE_TEMPLATES = [
  { emoji: '🧹', title: '100 chores together', kind: 'chores', goal: 100, days: 30, reward: '🍕 Pizza & movie night' },
  { emoji: '📚', title: 'Read 30 books', kind: 'manual', goal: 30, days: 60, unit: 'books', reward: '📖 Bookstore trip' },
  { emoji: '🚶', title: '20 family walks', kind: 'manual', goal: 20, days: 30, unit: 'walks', reward: '🍦 Ice cream outing' },
  { emoji: '😊', title: 'Everyone checks in for a week', kind: 'checkins', goal: 0, days: 7, reward: '🎲 Game night' },
  { emoji: '✅', title: 'Clear 25 to-dos', kind: 'todos', goal: 25, days: 30, reward: '🌮 Taco Tuesday out' },
];
function challengeCounts(c) {
  const by = Object.fromEntries(memberIds().map((id) => [id, 0]));
  const inRange = (d) => d >= c.start && d <= c.end;
  const bump = (id, n = 1) => { if (id in by) by[id] += n; };
  if (c.kind === 'chores') for (const ch of state.chores) for (const l of ch.log || []) { if (inRange(l.date)) bump(l.memberId); }
  if (c.kind === 'todos') for (const t of state.todos) if (t.done && inRange(iso(new Date(t.doneAt)))) bump(t.doneBy);
  if (c.kind === 'checkins') for (const [d, xs] of Object.entries(state.checkins)) if (inRange(d)) for (const id of Object.keys(xs)) bump(id);
  if (c.kind === 'word') for (const [d, xs] of Object.entries(state.wordle || {})) if (inRange(d)) for (const [id, w] of Object.entries(xs)) if (w.won) bump(id);
  if (c.kind === 'manual') for (const l of c.log || []) bump(l.who, Number(l.n) || 1);
  return by;
}
const challengeGoal = (c) => (c.kind === 'checkins' && !c.goal ? state.members.length * (daysBetween(c.start, c.end) + 1) : Number(c.goal) || 1);
function challengeCard(c, compact) {
  const by = challengeCounts(c), total = sum(Object.values(by), (n) => n), goal = challengeGoal(c);
  const pct = Math.min(1, total / goal), left = daysBetween(today(), c.end);
  const done = total >= goal;
  return `<div class="card challenge${done ? ' won' : ''}">
    <div class="ch-head"><span class="ch-emoji">${esc(c.emoji || '🏆')}</span><div class="grow"><b>${esc(c.title)}</b><div class="small muted">${done ? '🎉 Done! ' : left >= 0 ? `${left} day${left === 1 ? '' : 's'} left · ` : 'Ended · '}${total} / ${goal}${c.unit ? ' ' + esc(c.unit) : ''}</div></div>
      ${!compact && isGrownUp() ? `<button class="mini-btn" data-action="challenge-edit" data-id="${c.id}">Edit</button>` : ''}</div>
    <div class="ch-bar">${state.members.map((m) => by[m.id] ? `<i style="width:${Math.min(100, (by[m.id] / goal) * 100)}%;background:${m.color}" title="${esc(m.name)}"></i>` : '').join('')}</div>
    ${compact ? '' : `<div class="ch-legend">${state.members.filter((m) => by[m.id]).sort((a, b) => by[b.id] - by[a.id]).map((m) => `<span><i style="background:${m.color}"></i>${esc(m.emoji)} ${by[m.id]}</span>`).join('') || '<span class="muted small">No progress yet — let’s go!</span>'}</div>`}
    ${c.reward ? `<div class="ch-reward">🎁 ${esc(c.reward)}</div>` : ''}
    ${!compact && c.kind === 'manual' && !done && left >= 0 ? `<button class="btn block ch-plus" data-action="challenge-plus" data-id="${c.id}">＋1 ${esc(c.unit ? c.unit.replace(/s$/, '') : '')} for me</button>` : ''}
  </div>`;
}
const activeChallenges = () => state.challenges.filter((c) => c.end >= today() || (Date.now() - (c.doneAt || 0) < 3 * 86400000 && c.doneAt));
views.challenges = () => {
  const active = activeChallenges(), past = state.challenges.filter((c) => !active.includes(c));
  return `${active.map((c) => challengeCard(c)).join('') || `<div class="card empty"><span class="big">🏆</span>Team up on a goal — everyone’s progress adds up toward a family reward.</div>`}
    ${isGrownUp() ? `<div class="section-title">Start a challenge</div><div class="card flush">${CHALLENGE_TEMPLATES.map((t, i) => `<button class="row tap" style="width:100%;text-align:left" data-action="challenge-new" data-t="${i}"><div class="avatar">${t.emoji}</div><div class="grow"><div class="title">${esc(t.title)}</div><div class="sub">${t.days} days · ${esc(t.reward)}</div></div>${ICON.chev}</button>`).join('')}
      <button class="row tap" style="width:100%;text-align:left" data-action="challenge-new"><div class="avatar">✏️</div><div class="grow"><div class="title">Make your own</div></div>${ICON.chev}</button></div>` : ''}
    ${past.length ? `<div class="section-title">Past challenges</div>${past.slice(-5).reverse().map((c) => challengeCard(c, true)).join('')}` : ''}`;
};
function challengeForm(c, tpl) {
  const isNew = !c;
  const t = tpl || {};
  openSheet({
    title: isNew ? '🏆 New challenge' : 'Edit challenge',
    values: c || { emoji: t.emoji || '🏆', title: t.title || '', kind: t.kind || 'manual', goal: t.goal ?? 10, unit: t.unit || '', start: today(), end: addDays(today(), (t.days || 30) - 1), reward: t.reward || '' },
    fields: [
      { row: [{ name: 'emoji', label: 'Emoji', placeholder: '🏆' }, { name: 'title', label: 'Challenge', required: true, placeholder: 'e.g. 20 family walks' }] },
      { name: 'kind', label: 'What counts?', type: 'select', options: Object.entries(CHALLENGE_KINDS).map(([value, label]) => ({ value, label })) },
      { row: [{ name: 'goal', label: 'Goal (0 = everyone, every day)', type: 'number' }, { name: 'unit', label: 'Unit', placeholder: 'e.g. walks' }] },
      { row: [{ name: 'start', label: 'Starts', type: 'date', required: true }, { name: 'end', label: 'Ends', type: 'date', required: true }] },
      { name: 'reward', label: 'Team reward', placeholder: 'e.g. 🍕 Pizza night' },
    ],
    onSave(v) {
      if (v.end < v.start) { toast('End date is before the start'); return false; }
      if (isNew) { state.challenges.push({ id: uid(), log: [], ...v, goal: Number(v.goal) || 0 }); logAct(v.emoji || '🏆', `started the “${v.title}” challenge`, 'challenges'); }
      else Object.assign(c, v, { goal: Number(v.goal) || 0 });
    },
    onDelete: isNew ? null : () => withUndo('Challenge deleted', () => { state.challenges = state.challenges.filter((x) => x.id !== c.id); }),
  });
}
// Celebrate a finished challenge once on each phone (it can be finished from any phone).
function checkChallenges() {
  const s = seen(); s.ch ||= [];
  for (const c of state.challenges) {
    const by = challengeCounts(c);
    if (sum(Object.values(by), (n) => n) >= challengeGoal(c) && !s.ch.includes(c.id)) {
      s.ch.push(c.id);
      if (!c.doneAt) { c.doneAt = Date.now(); save(); }
      if (Date.now() - c.doneAt < 3 * 86400000) setTimeout(() => { confetti(); celebrate(`🏆 ${c.title}: done!`, c.reward ? `You did it together! Reward: ${c.reward}` : 'You did it together!'); }, 250);
    }
  }
}

/* =========================================================
   7 · Inbox & the 🔔 bell
   ========================================================= */
function inboxItems() {
  const me = actor(), s = seen(), items = [];
  if (!me) return items;
  const unread = state.chat.filter((m) => m.at > (s.chat || 0) && m.who !== me);
  const atMe = unread.filter((m) => mentionsIn(m.text).includes(me));
  for (const m of atMe.slice(-3)) items.push({ n: 1, icon: '💬', title: `${whoName(m.who)} mentioned you`, sub: m.text, to: 'chat' });
  if (unread.length > atMe.length) items.push({ n: unread.length - atMe.length, icon: '💬', title: `${unread.length - atMe.length} new message${unread.length - atMe.length > 1 ? 's' : ''}`, sub: `${whoName(unread.at(-1).who)}: ${unread.at(-1).text}`, to: 'chat' });
  for (const k of state.kudos.filter((k) => k.to === me && Date.now() - k.at < 2 * 86400000)) items.push({ n: k.at > (s.kudosInbox || 0) ? 1 : 0, icon: k.emoji || '🙌', title: `${whoName(k.from)} high-fived you${k.stars ? ` · +${k.stars} ⭐` : ''}`, sub: k.text, to: 'kudos' });
  if (typeof myTurnGames === 'function') for (const g of myTurnGames()) items.push({ n: 1, icon: '🔴', title: `Your turn · Connect Four`, sub: `vs ${whoName(g.a === me ? g.b : g.a)}`, to: `c4/${g.id}` });
  for (const x of rsvpUpcoming(14).filter(({ ev, d }) => !ev.rsvp?.[d]?.[me])) items.push({ n: 1, icon: '🙋', title: `Who’s in? ${x.ev.title}`, sub: fmtDate(x.d, { weekday: 'long', month: 'short', day: 'numeric' }), rsvp: x });
  for (const t of state.todos.filter((t) => !t.done && t.for === me)) items.push({ n: 1, icon: '✅', title: t.text, sub: `To-do from ${whoName(t.by)}`, to: 'todos' });
  if (typeof triviaWaiting === 'function') { const n = triviaWaiting(me).length; if (n) items.push({ n: 1, icon: '🧠', title: `${n} new trivia question${n > 1 ? 's' : ''} about the family`, sub: 'How well do you know us?', to: 'trivia' }); }
  if (isGrownUp()) for (const r of (state.redemptions || []).filter((r) => r.status === 'pending')) items.push({ n: 1, icon: '🎟️', title: `${whoName(r.memberId)} wants ${state.rewards.find((x) => x.id === r.rewardId)?.name || 'a reward'}`, sub: `${r.cost} points · tap to approve`, to: 'chores', ctab: 'rewards' });
  // Gentle daily nudges (not counted on the badge)
  if (!checkinOf(me)) items.push({ n: 0, icon: '😊', title: 'Daily check-in', sub: 'How are you feeling today?', to: 'checkin', nudge: true });
  if (typeof wordPlayed === 'function' && !wordPlayed(me)) items.push({ n: 0, icon: '🔤', title: 'Today’s Family Word', sub: 'Same puzzle for everyone — can you get it?', to: 'word', nudge: true });
  return items;
}
const inboxCount = () => sum(inboxItems(), (x) => x.n);
views.inbox = () => {
  const me = actor();
  if (!me) return needMe() || '<div class="card empty">Pick who you are in Settings.</div>';
  const items = inboxItems();
  const act = items.filter((x) => !x.nudge), nudges = items.filter((x) => x.nudge);
  const wins = (state.activity || []).filter((a) => a.who && a.who !== me && isMember(a.who) && Date.now() - a.at < 86400000 && /did|finished|completed|solved|won|checked/.test(a.text)).slice(0, 4);
  const row = (x) => x.rsvp ? rsvpCard(x.rsvp) : `<button class="row tap inbox-row${x.n ? ' new' : ''}" style="width:100%;text-align:left" data-action="go" data-to="${esc(x.to)}" ${x.ctab ? `data-ctab="${x.ctab}"` : ''} ${x.sqTab ? `data-sq-tab="${x.sqTab}"` : ''}><div class="avatar">${esc(x.icon)}</div><div class="grow"><div class="title">${esc(x.title)}</div><div class="sub">${esc(x.sub || '')}</div></div>${x.n ? '<span class="dot-new"></span>' : ICON.chev}</button>`;
  const rsvps = act.filter((x) => x.rsvp), rest = act.filter((x) => !x.rsvp);
  return `${rest.length ? `<div class="card flush">${rest.map(row).join('')}</div>` : ''}
    ${rsvps.map(row).join('')}
    ${!act.length ? `<div class="card empty"><span class="big">🔔</span>You’re all caught up!</div>` : ''}
    ${nudges.length ? `<div class="section-title">For today</div><div class="card flush">${nudges.map(row).join('')}</div>` : ''}
    ${wins.length ? `<div class="section-title">Cheer them on</div><div class="card flush">${wins.map((a) => `<div class="row">${avatar(member(a.who))}<div class="grow"><div class="act-text"><b>${esc(whoName(a.who))}</b> ${esc(a.text)}</div><div class="sub">${timeAgo(a.at)}</div></div><button class="claim" data-action="kudos-new" data-to="${a.who}" data-text="Nice job! ${esc(a.icon)}">🙌</button></div>`).join('')}</div>` : ''}`;
};
function updateBell() {
  const dot = $('.bell-dot');
  if (!dot) return;
  const n = inboxCount();
  dot.hidden = !n;
  dot.textContent = n > 9 ? '9+' : String(n);
}
// Pop-up when a high-five arrives for whoever is using this phone.
function checkKudos() {
  const me = actor(), s = seen();
  if (!me) return;
  if (s.kudos == null) { s.kudos = Date.now(); return; }
  const fresh = state.kudos.filter((k) => k.to === me && k.at > s.kudos && k.from !== me).sort((a, b) => a.at - b.at);
  if (!fresh.length) return;
  s.kudos = Math.max(...fresh.map((k) => k.at));
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  const k = fresh.at(-1);
  const stars = sum(fresh, (x) => Number(x.stars) || 0);
  setTimeout(() => {
    confetti();
    celebrate(`${k.emoji || '🙌'} ${whoName(k.from)} high-fived you!`, `${k.text || 'High-five!'}${stars ? ` · +${stars} ⭐` : ''}${fresh.length > 1 ? ` (and ${fresh.length - 1} more)` : ''}`);
    if (typeof isSimple === 'function' && isSimple(me) && typeof readAloudOn === 'function' && readAloudOn(me)) speak(`${whoName(k.from)} sent you a high five! ${k.text || ''}`);
  }, 350);
}

/* =========================================================
   Home + kid home + More grid
   ========================================================= */
function togetherHomeBlock() {
  const me = actor();
  const parts = [];
  const unread = state.chat.filter((m) => m.at > (seen().chat || 0) && m.who !== me);
  const last = [...state.chat].sort((a, b) => b.at - a.at)[0];
  parts.push(`<div class="card together-card">
    <button class="tg-mood" data-action="go" data-to="checkin">${moodStrip()}<span class="tg-cta">${me && !checkinOf(me) ? 'How are you today? →' : 'Family moods →'}</span></button>
    ${last ? `<button class="row tap tg-chat" style="width:100%;text-align:left" data-action="go" data-to="chat"><div class="avatar">${esc(isMember(last.who) ? member(last.who).emoji : '💬')}</div><div class="grow"><div class="title">${esc(whoName(last.who))}${unread.length ? ` <span class="pill accent">${unread.length} new</span>` : ''}</div><div class="sub">${esc(last.text)}</div></div>${ICON.chev}</button>` : `<button class="row tap tg-chat" style="width:100%;text-align:left" data-action="go" data-to="chat"><div class="avatar">💬</div><div class="grow"><div class="title">Family chat</div><div class="sub">Say hi to everyone 👋</div></div>${ICON.chev}</button>`}
    <div class="tg-actions"><button data-action="kudos-new">🙌 High-five</button><button data-action="go" data-to="todos">✅ To-dos${state.todos.filter((t) => !t.done).length ? ` · ${state.todos.filter((t) => !t.done).length}` : ''}</button><button data-action="go" data-to="games">🎮 Games</button></div>
  </div>`);
  const rs = rsvpUpcoming(14).filter(({ ev, d }) => me && !ev.rsvp?.[d]?.[me]).slice(0, 2);
  parts.push(...rs.map(rsvpCard));
  if (typeof myTurnGames === 'function') for (const g of myTurnGames().slice(0, 2)) parts.push(`<button class="card row tap your-turn" style="width:100%;text-align:left" data-action="go" data-to="c4/${g.id}"><div class="avatar">🔴</div><div class="grow"><div class="title">Your turn!</div><div class="sub">Connect Four vs ${esc(whoName(g.a === me ? g.b : g.a))}</div></div>${ICON.chev}</button>`);
  const ch = activeChallenges().filter((c) => c.end >= today())[0];
  if (ch) parts.push(`<button class="tile-btn" data-action="go" data-to="challenges" style="display:block;width:100%;text-align:left;padding:0;background:none;border:0">${challengeCard(ch, true)}</button>`);
  return `<div data-home="together"><div class="section-title">Together<button data-action="go" data-to="inbox">Inbox${inboxCount() ? ` · ${inboxCount()}` : ''}</button></div>${parts.join('')}</div>`;
}
const _homeActivityT = homeActivity;
homeActivity = function () { return togetherHomeBlock() + _homeActivityT(); };
HOME_SECTIONS.splice(HOME_SECTIONS.findIndex(([id]) => id === 'quick') + 1, 0, ['together', '💬 Together']);
// Families with a saved Home layout get the new block near the top instead of at the very bottom.
const _homeLayoutT = homeLayout;
homeLayout = function () {
  const saved = Array.isArray(state.settings.homeLayout) ? state.settings.homeLayout : [];
  const out = _homeLayoutT();
  if (saved.length && !saved.some((x) => x.id === 'together')) {
    const i = out.findIndex((x) => x.id === 'together');
    const [t] = out.splice(i, 1);
    out.splice(Math.max(0, out.findIndex((x) => x.id === 'quick') + 1), 0, t);
  }
  return out;
};

const _kidViewT = views.kid;
views.kid = () => {
  const id = kidModeId();
  const html = _kidViewT();
  if (!id) return html;
  const simple = typeof isSimple === 'function' && isSimple(id);
  const turns = typeof myTurnGames === 'function' ? myTurnGames() : [];
  const unread = state.chat.filter((m) => m.at > (seen().chat || 0) && m.who !== id).length;
  const rs = rsvpUpcoming(10).filter(({ ev, d }) => !ev.rsvp?.[d]?.[id]).slice(0, 1);
  const tiles = simple
    ? `<div class="section-title">Family fun</div><div class="little-grid">
        <button class="lt" data-action="go" data-to="checkin" style="--t:#f59e0b"><span class="lt-e">${esc(checkinOf(id)?.mood || '😊')}</span><b>My feeling</b><small>${checkinOf(id) ? 'Done ✓' : 'Tap me!'}</small></button>
        <button class="lt" data-action="go" data-to="games" style="--t:#3b82f6"><span class="lt-e">🎮</span><b>Games</b><small>${turns.length ? 'Your turn!' : 'Play'}</small></button>
        <button class="lt" data-action="go" data-to="chat" style="--t:#10b981"><span class="lt-e">💬</span><b>Chat</b><small>${unread ? `${unread} new` : 'Say hi'}</small></button>
        <button class="lt" data-action="kudos-new" style="--t:#ec4899"><span class="lt-e">🙌</span><b>High-five</b><small>Cheer someone</small></button>
      </div>`
    : `<div class="section-title">Family</div><div class="kid-tiles six">
        <button data-action="go" data-to="chat"><span>💬</span>Chat${unread ? ` (${unread})` : ''}</button>
        <button data-action="go" data-to="games"><span>🎮</span>${turns.length ? 'Your turn!' : 'Games'}</button>
        <button data-action="go" data-to="checkin"><span>${esc(checkinOf(id)?.mood || '😊')}</span>Check-in</button>
        <button data-action="kudos-new"><span>🙌</span>High-five</button>
        <button data-action="go" data-to="todos"><span>✅</span>To-dos</button>
        <button data-action="go" data-to="challenges"><span>🏆</span>Challenges</button>
      </div>`;
  const extra = rs.map(rsvpCard).join('') + tiles;
  const i = html.lastIndexOf('<button class="kid-exit"');
  return i < 0 ? html + extra : html.slice(0, i) + extra + html.slice(i);
};
KID_ROUTES.push('chat', 'kudos', 'checkin', 'todos', 'challenges', 'inbox');
for (const a of ['msg-tap', 'msg-react', 'msg-del', 'kudos-new', 'kudos-react', 'checkin-mood', 'checkin-heart', 'todo-toggle', 'todo-claim', 'todo-del', 'rsvp', 'challenge-plus', 'set-me']) KID_ACTIONS.add(a);

const _moreGridT = moreGrid;
moreGrid = function () {
  const tile = (to, emoji, label, sub, act = 'go') => `<button class="card mini-tile" data-action="${act}" data-to="${to}"><div class="emoji">${emoji}</div><b>${label}</b><div class="small muted">${sub}</div></button>`;
  const me = actor();
  const unread = state.chat.filter((m) => m.at > (seen().chat || 0) && m.who !== me).length;
  const openTodos = state.todos.filter((t) => !t.done).length;
  const turns = typeof myTurnGames === 'function' ? myTurnGames().length : 0;
  return `<div class="more-label">Together</div>
    <div class="grid3">
      ${tile('chat', '💬', 'Chat', unread ? `${unread} new` : 'Family group')}
      ${tile('games', '🎮', 'Games', turns ? 'Your turn!' : 'Play together')}
      ${tile('kudos', '🙌', 'High-fives', 'Cheer someone')}
      ${tile('checkin', '😊', 'Check-in', me && checkinOf(me) ? `Feeling ${checkinOf(me).mood}` : 'How’s everyone?')}
      ${tile('todos', '✅', 'To-dos', openTodos ? `${openTodos} open` : 'Shared list')}
      ${tile('challenges', '🏆', 'Challenges', activeChallenges().length ? `${activeChallenges().length} active` : 'Team goals')}
    </div>` + _moreGridT();
};

/* =========================================================
   Actions & hooks
   ========================================================= */
Object.assign(actions, {
  'msg-tap': (el) => { ui.msgPick = ui.msgPick === el.dataset.id ? null : el.dataset.id; render(); },
  'msg-react': (el) => {
    const m = state.chat.find((x) => x.id === el.dataset.id); if (!m) return;
    const me = actor() || 'anon', rx = (m.rx ||= {}), r = (rx[el.dataset.e] ||= {});
    if (r[me]) delete r[me]; else r[me] = true;
    ui.msgPick = null; save(); render();
  },
  'msg-del': (el) => { ui.msgPick = null; withUndo('Message deleted', () => { state.chat = state.chat.filter((x) => x.id !== el.dataset.id); }); },
  'kudos-new': (el) => kudosForm(el.dataset.to, el.dataset.text),
  'kudos-react': (el) => {
    const k = findIn(state.kudos, el.dataset.id); const me = actor() || 'anon';
    const r = ((k.rx ||= {})[el.dataset.e] ||= {});
    if (r[me]) delete r[me]; else r[me] = true;
    save(); render();
  },
  'checkin-mood': (el) => {
    const me = actor();
    if (!me) { toast('Pick who you are first 👆'); return; }
    const day = (state.checkins[today()] ||= {});
    const first = !day[me];
    day[me] = { ...(day[me] || {}), mood: el.dataset.m, at: Date.now() };
    if (first) logAct(el.dataset.m, `checked in feeling ${MOODS.find(([e]) => e === el.dataset.m)?.[1].toLowerCase() || el.dataset.m}`, 'checkin');
    if (typeof isSimple === 'function' && isSimple(me) && readAloudOn(me)) speak(`You feel ${MOODS.find(([e]) => e === el.dataset.m)?.[1]}. Thanks for telling us!`);
    save(); render();
  },
  'checkin-heart': (el) => {
    const c = checkinOf(el.dataset.id); if (!c) return;
    const me = actor() || 'anon', h = (c.hearts ||= {});
    if (h[me]) delete h[me]; else h[me] = true;
    save(); render();
  },
  'todo-new': () => todoForm(null),
  'todo-toggle': (el) => {
    const t = findIn(state.todos, el.dataset.id);
    t.done = !t.done;
    if (t.done) { t.doneBy = actor() || t.claimedBy; t.doneAt = Date.now(); logAct('✅', `finished “${t.text}”`, 'todos'); ui.pop = { a: 'todo-toggle', id: t.id }; }
    save(); render();
  },
  'todo-claim': (el) => {
    const me = actor();
    if (!me) { toast('Pick who you are first (Settings → This phone)'); return; }
    const t = findIn(state.todos, el.dataset.id);
    if (t.claimedBy && t.claimedBy !== me && !confirm(`${whoName(t.claimedBy)} already has this. Take it over?`)) return;
    t.claimedBy = t.claimedBy === me ? '' : me;
    if (t.claimedBy) { logAct('🙋', `will do “${t.text}”`, 'todos'); toast('🙋 You’ve got it!'); }
    save(); render();
  },
  'todo-del': (el) => withUndo('To-do deleted', () => { state.todos = state.todos.filter((x) => x.id !== el.dataset.id); }),
  'rsvp': (el) => {
    const me = actor();
    if (!me) { toast('Pick who you are first'); return; }
    const ev = findIn(state.events, el.dataset.id), d = el.dataset.d;
    const r = ((ev.rsvp ||= {})[d] ||= {});
    const was = r[me];
    if (was === el.dataset.v) delete r[me]; else r[me] = el.dataset.v;
    if (r[me] && !was) logAct(RSVP[r[me]][0], `${r[me] === 'yes' ? 'is going to' : r[me] === 'maybe' ? 'might go to' : 'can’t make'} ${ev.title}`, 'calendar');
    save(); render();
  },
  'challenge-new': (el) => challengeForm(null, el.dataset.t != null ? CHALLENGE_TEMPLATES[Number(el.dataset.t)] : null),
  'challenge-edit': (el) => challengeForm(findIn(state.challenges, el.dataset.id)),
  'challenge-plus': (el) => {
    const me = actor();
    if (!me) { toast('Pick who you are first'); return; }
    const c = findIn(state.challenges, el.dataset.id);
    (c.log ||= []).push({ id: uid(), who: me, n: 1, at: Date.now() });
    ui.pop = { a: 'challenge-plus', id: c.id };
    save(); render(); toast(`${c.emoji || '🏆'} +1!`);
  },
});

const _afterRenderT = afterRender;
afterRender = function () {
  _afterRenderT();
  const name = currentRoute().name;
  const inChat = name === 'chat';
  chatBar.hidden = !inChat;
  document.body.classList.toggle('chat-mode', inChat);
  if (inChat) {
    seen().chat = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
    if (chatInput.value !== (ui.chatDraft || '') && document.activeElement !== chatInput) chatInput.value = ui.chatDraft || '';
    if (!ui.chatRoute) ui.chatStick = undefined;
    if (ui.chatStick !== false) scrollChat();
  }
  ui.chatRoute = inChat;
  if (name === 'inbox' || name === 'kudos') { seen().kudosInbox = Date.now(); }
  checkKudos();
  checkChallenges();
  updateBell();
};
// Stay pinned to the newest message unless the user scrolled up to read history.
viewEl.addEventListener('scroll', () => { if (currentRoute().name === 'chat') ui.chatStick = viewEl.scrollTop + viewEl.clientHeight >= viewEl.scrollHeight - 120 ? undefined : false; }, { passive: true });

// Calendar: "Who's in?" cards for the selected day.
const _calendarT = views.calendar;
views.calendar = (p) => {
  const html = _calendarT(p);
  const cards = state.events.filter((ev) => ev.askRsvp && occursOn(ev, ui.calSel)).map((ev) => rsvpCard({ ev, d: ui.calSel })).join('');
  return cards ? html + `<div class="section-title">Who’s in?</div>${cards}` : html;
};
