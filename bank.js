/* Bank sync through SimpleFIN Bridge (read-only): new bank transactions and the checking balance flow into the budget.
   The SimpleFIN access key lives only on the phone that connected it (localStorage, never synced, never sent anywhere
   but SimpleFIN). Other phones see the results through family sync.
   Matching, so nothing counts twice:
   - a charge that matches an expected bill (amount within 3% or $1.50, ±6 days) marks that bill paid instead of adding a row
   - a paycheck that matches expected income marks it received
   - a charge you already logged by hand (same amount, ±3 days) is linked, not duplicated
   - a credit card payment / transfer between two connected accounts is skipped */
'use strict';

const SF_KEY = 'gomezfam:simplefin';
const SF_EVERY = 4 * 3600e3; // SimpleFIN asks apps not to poll more than a few times a day
const sfCfg = () => { try { const c = JSON.parse(localStorage.getItem(SF_KEY) || 'null'); return c && c.base && c.auth ? c : null; } catch { return null; } };
const sfStore = (c) => { try { if (c) localStorage.setItem(SF_KEY, JSON.stringify(c)); else localStorage.removeItem(SF_KEY); } catch { /* storage full: stay disconnected */ } };
const bankOf = () => (state.budget.bank ||= { accounts: {}, used: {}, last: 0 });
const sfBusy = { on: false, at: 0 };

// A setup token is base64 of a one-time claim URL; claiming it returns the access URL (https://user:pass@host/path)
async function sfClaim(token) {
  let claim;
  try { claim = atob(String(token).trim().replace(/\s+/g, '')); } catch { throw new Error('That doesn’t look like a SimpleFIN setup token.'); }
  if (!/^https:\/\/[^/]*simplefin\.org\//.test(claim)) throw new Error('That doesn’t look like a SimpleFIN setup token.');
  const r = await fetch(claim, { method: 'POST' });
  if (r.status === 403) throw new Error('This token was already used or has expired. Make a new one in SimpleFIN Bridge.');
  if (!r.ok) throw new Error(`SimpleFIN said ${r.status}. Try again in a minute.`);
  const u = new URL((await r.text()).trim());
  if (u.protocol !== 'https:' || !u.username) throw new Error('SimpleFIN sent back something unexpected.');
  const c = { base: u.origin + u.pathname.replace(/\/$/, ''), auth: btoa(decodeURIComponent(u.username) + ':' + decodeURIComponent(u.password)), at: Date.now() };
  sfStore(c);
  return c;
}

async function sfFetch(c, start) {
  // SimpleFIN can be slow (it may be talking to the bank); never wait forever — a phone that slept mid-request recovers
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 90e3);
  let r;
  try { r = await fetch(`${c.base}/accounts?start-date=${Math.floor(start / 1000)}`, { headers: { Authorization: 'Basic ' + c.auth }, signal: ctl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'SimpleFIN took too long to answer. Tap Sync now to try again.' : 'Couldn’t reach SimpleFIN. Check your connection and tap Sync now.'); }
  finally { clearTimeout(timer); }
  if (r.status === 403 || r.status === 401) throw Object.assign(new Error('SimpleFIN no longer accepts this phone’s key. Reconnect bank sync.'), { gone: true });
  if (r.status === 402) throw new Error('Your SimpleFIN subscription needs attention.');
  if (!r.ok) throw new Error(`SimpleFIN said ${r.status}.`);
  return r.json();
}

const sfDate = (sec) => { const d = new Date(sec * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const sfNote = (t) => String(t.payee || t.description || t.memo || 'Bank transaction')
  .replace(/^\s*(TST|SQ|SP|PY|PP|DD|IC|SQU|BT)\s*\*\s*/i, '').replace(/#\s*\d+/g, ' ').replace(/\b(POS|DEBIT|PURCHASE|CARD|ACH|PPD|WEB|ID:?)\b/gi, ' ').replace(/[#*]+/g, ' ').replace(/\b\d{5,}\b/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Bank transaction';
const isCardAcct = (a) => /credit|card|amex|sapphire|freedom|slate|visa|mastercard|discover/i.test(`${a.name} ${a.org?.name || ''}`) || Number(a.balance) < 0;
const sfId = (a, t) => `sf-${String(a.id).replace(/[^\w-]/g, '').slice(-24)}-${String(t.id).replace(/[^\w-]/g, '').slice(-40)}`;
const nameHit = (billName, note) => { const w = norm(billName).split(/\s+/).find((x) => x.length >= 3); return !!w && norm(note).includes(w); };

// Turn a SimpleFIN response into budget changes. Pure enough to test without the network (window.bankImport).
function bankImport(data, opts = {}) {
  const bank = bankOf(), now = Date.now(), t = today();
  const accts = (data.accounts || []).filter((a) => a && a.id);
  const picks = opts.picks || {};
  const txs = state.budget.transactions;
  const haveIds = new Set(txs.map((x) => x.id));
  const claimed = new Set([...Object.values(bank.used), ...txs.map((x) => x.bankId).filter(Boolean)]);
  const res = { added: 0, bills: 0, linked: 0, skipped: 0, accounts: accts.length };
  // Every posted transaction from the accounts we import
  const all = [];
  for (const a of accts) {
    bank.accounts[a.id] = { name: String(a.name || 'Account').slice(0, 40), org: String(a.org?.name || a.org?.domain || '').slice(0, 40), card: isCardAcct(a), balance: Number(a.balance) || 0, avail: a['available-balance'] != null ? Number(a['available-balance']) : null, at: now, on: bank.accounts[a.id]?.on ?? picks[a.id] ?? true };
    if (!bank.accounts[a.id].on) continue;
    for (const x of a.transactions || []) if (!x.pending && x.posted) all.push({ a, x, id: sfId(a, x), amt: Number(x.amount), date: sfDate(x.posted), note: sfNote(x) });
  }
  const done = new Set();
  for (const r of all) {
    if (haveIds.has(r.id) || bank.used[r.id] || !Number.isFinite(r.amt) || !r.amt) continue;
    const spend = r.amt < 0, amount = Math.round(Math.abs(r.amt) * 100) / 100;
    // Money moving between two connected accounts (card payment, transfer): skip both sides
    const twin = all.find((o) => o !== r && o.a.id !== r.a.id && !done.has(o.id) && Math.abs(Math.abs(o.amt) - amount) < 0.01 && Math.sign(o.amt) !== Math.sign(r.amt) && Math.abs(daysBetween(o.date, r.date)) <= 4);
    if (twin) {
      // Paying a connected card from checking: the purchases are already imported, so the card bill is just settled
      const out = spend ? r : twin, oa = Math.abs(out.amt);
      const occ = recurringBetween(addDays(out.date, -6), addDays(out.date, 6), 'bill').find((o) => !o.b.paid?.[o.date] && !claimed.has(billTxId(o.b, o.date)) && (Math.abs(o.amount - oa) <= Math.max(1.5, o.amount * 0.03) || nameHit(o.b.name, out.note)));
      if (occ) { (occ.b.paid ||= {})[occ.date] = 'xfer'; claimed.add(billTxId(occ.b, occ.date)); res.bills++; }
      bank.used[r.id] = 'transfer'; bank.used[twin.id] = 'transfer'; done.add(r.id); done.add(twin.id); res.skipped++; continue;
    }
    // A payment received on a credit card account is just paying the card off
    if (!spend && r.a && isCardAcct(r.a)) { bank.used[r.id] = 'card-payment'; res.skipped++; continue; }
    // An expected bill or paycheck: mark it paid/received (it's logged once, as the bill)
    const occ = recurringBetween(addDays(r.date, -6), addDays(r.date, 6), spend ? 'bill' : 'income')
      .filter((o) => !claimed.has(billTxId(o.b, o.date)) && (Math.abs(o.amount - amount) <= Math.max(1.5, o.amount * 0.03) || (nameHit(o.b.name, r.note) && Math.abs(o.amount - amount) <= o.amount * 0.25)))
      .sort((p, q) => (nameHit(q.b.name, r.note) - nameHit(p.b.name, r.note)) || Math.abs(daysBetween(p.date, r.date)) - Math.abs(daysBetween(q.date, r.date)))[0];
    if (occ) {
      const txId = billTxId(occ.b, occ.date);
      if (!occ.b.paid?.[occ.date]) markBillPaid(occ.b, occ.date, true);
      const lt = txs.find((x) => x.id === txId);
      if (lt && Math.abs(lt.amount - amount) >= 0.01) { lt.amount = amount; (occ.b.amounts ||= {})[occ.date] = amount; }
      if (lt) lt.bankId = r.id;
      bank.used[r.id] = txId; claimed.add(txId); res.bills++; continue;
    }
    // Already logged by hand (or from a CSV): link it instead of adding a copy
    const mine = txs.find((x) => !x.bankId && !x.fromBill && (x.type === 'income') === !spend && Math.abs(Number(x.amount) - amount) < 0.01 && Math.abs(daysBetween(x.date, r.date)) <= 3);
    if (mine) { mine.bankId = r.id; bank.used[r.id] = mine.id; res.linked++; continue; }
    txs.push({ id: r.id, created: now, type: spend ? 'expense' : 'income', amount, note: r.note, categoryId: spend ? categoryFor(r.note) : '', date: r.date > t ? t : r.date, memberId: '', bank: bank.accounts[r.a.id].org || bank.accounts[r.a.id].name, bankId: r.id });
    haveIds.add(r.id); res.added++;
  }
  // Forget old matches so the record stays small (transactions themselves keep their bankId)
  const cut = addDays(t, -75);
  for (const k of Object.keys(bank.used)) if ((bank.usedAt?.[k] || t) < cut) { delete bank.used[k]; delete bank.usedAt?.[k]; }
  bank.usedAt ||= {};
  for (const k of Object.keys(bank.used)) bank.usedAt[k] ||= t;
  // The checking balance keeps Safe to spend honest (set after importing so nothing is counted twice)
  const chk = bank.checking && bank.accounts[bank.checking] ? bank.checking : Object.keys(bank.accounts).find((id) => !bank.accounts[id].card && /check/i.test(bank.accounts[id].name)) || Object.keys(bank.accounts).find((id) => !bank.accounts[id].card);
  if (chk && opts.balance !== false) {
    bank.checking = chk;
    Object.assign(state.settings, { balance: Math.round(bank.accounts[chk].balance * 100) / 100, balanceDate: t, balanceAt: Date.now() + 1, balanceSrc: 'bank' });
  }
  bank.last = now; bank.err = '';
  return res;
}

async function bankSync({ quiet = false } = {}) {
  const c = sfCfg();
  if (sfBusy.on && Date.now() - sfBusy.at > 120e3) sfBusy.on = false; // a request lost while the phone slept
  if (!c || sfBusy.on || (typeof inKidMode === 'function' && inKidMode())) return null;
  sfBusy.on = true; sfBusy.at = Date.now(); render();
  const bank = bankOf();
  try {
    // First sync: this month so far; later: a week of overlap to catch late-posting charges
    const start = bank.last ? bank.last - 7 * 86400e3 : parse(monthKey(today()) + '-01').getTime();
    const data = await sfFetch(c, start);
    const res = bankImport(data);
    const errs = (data.errors || []).map(String).filter(Boolean);
    bank.err = errs.join(' ').slice(0, 200);
    save(); render();
    if (!quiet || res.added || res.bills) toast(`🏦 Bank synced · ${res.added} new${res.bills ? ` · ${res.bills} bill${res.bills > 1 ? 's' : ''} marked paid` : ''}${res.linked ? ` · ${res.linked} matched` : ''}`);
    return res;
  } catch (e) {
    bank.err = String(e.message || e).slice(0, 200);
    if (e.gone) sfStore(null);
    save(); render();
    if (!quiet) toast('🏦 ' + bank.err);
    return null;
  } finally { sfBusy.on = false; render(); }
}

/* ---------- UI ---------- */
function bankCard() {
  const bank = state.budget.bank, c = sfCfg();
  if (!c && !bank?.last) return `<button class="card bank-card" data-action="bank-open" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:26px">🏦</span><span><b>Connect your bank</b><br><span class="small muted">Chase and others via SimpleFIN — new charges and your balance, automatically</span></span></button>`;
  const ac = Object.values(bank?.accounts || {}).filter((a) => a.on);
  const who = c ? 'this phone' : 'another phone';
  return `<div class="card bank-card"><div style="display:flex;gap:12px;align-items:center"><span style="font-size:26px">🏦</span>
    <div class="grow" style="flex:1;min-width:0"><b>${esc([...new Set(ac.map((a) => a.org).filter(Boolean))].join(', ') || 'Bank')} · ${ac.length} account${ac.length === 1 ? '' : 's'}</b>
    <div class="small muted">${bank?.last ? `Synced ${esc(timeAgo(bank.last))} from ${who}` : 'Not synced yet'}${bank?.err ? ` · <span style="color:var(--bad)">${esc(bank.err)}</span>` : ''}</div></div>
    ${c ? `<button class="mini-btn" data-action="bank-sync"${sfBusy.on && Date.now() - sfBusy.at < 120e3 ? ' disabled' : ''}>${sfBusy.on && Date.now() - sfBusy.at < 120e3 ? 'Syncing…' : 'Sync now'}</button>` : ''}<button class="mini-btn" data-action="bank-open">${c ? 'Manage' : 'Connect here'}</button></div></div>`;
}

function bankConnectSheet() {
  openSheet({
    title: '🏦 Connect your bank',
    saveLabel: 'Connect',
    fields: [
      { type: 'html', html: `<ol class="small" style="margin:0 0 10px;padding-left:20px;line-height:1.6">
        <li>In <b>SimpleFIN Bridge</b>, connect Chase (and any other banks).</li>
        <li>Choose <b>New app connection</b> and copy the <b>setup token</b>.</li>
        <li>Paste it here. It works once and stays on <b>this phone only</b> — it’s never synced or shared.</li></ol>` },
      { name: 'token', label: 'SimpleFIN setup token', type: 'textarea', required: true, placeholder: 'aHR0cHM6Ly9iZXRh…' },
    ],
    onSave(v) {
      const btn = $('#sheetSave'); if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }
      sfClaim(v.token).then(() => { closeSheet(); toast('🏦 Connected — syncing…'); bankSync().then(() => bankManageSheet()); })
        .catch((e) => { toast(e.message || 'Could not connect'); if (btn) { btn.disabled = false; btn.textContent = 'Connect'; } });
      return false; // stay open until SimpleFIN answers
    },
  });
}

function bankManageSheet() {
  const bank = bankOf(), ids = Object.keys(bank.accounts);
  if (!ids.length) { toast('No accounts yet — tap Sync now'); return; }
  openSheet({
    title: '🏦 Bank sync',
    saveLabel: 'Save',
    values: Object.fromEntries([...ids.map((id, i) => [`a${i}`, bank.accounts[id].on !== false]), ['checking', bank.checking || '']]),
    fields: [
      { type: 'html', html: `<p class="small muted" style="margin:0 0 8px">Import transactions from:</p>` },
      ...ids.map((id, i) => ({ name: `a${i}`, type: 'checkbox', label: `${bank.accounts[id].org ? bank.accounts[id].org + ' · ' : ''}${bank.accounts[id].name} · ${money(bank.accounts[id].balance)}` })),
      { name: 'checking', label: 'Checking balance for Safe to spend', type: 'select', options: [{ value: '', label: 'Don’t use a bank balance' }, ...ids.filter((id) => !bank.accounts[id].card).map((id) => ({ value: id, label: `${bank.accounts[id].name} · ${money(bank.accounts[id].balance)}` }))] },
      { type: 'html', html: `<p class="small muted" style="margin:6px 0 0">Charges that match a bill mark it paid; ones you already logged are matched, not doubled. Card payments and transfers between connected accounts are skipped.</p>` },
    ],
    deleteLabel: 'Disconnect this phone',
    onDelete: () => { sfStore(null); toast('Bank sync disconnected on this phone'); },
    onSave(v) {
      ids.forEach((id, i) => { bank.accounts[id].on = !!v[`a${i}`]; });
      bank.checking = v.checking;
      if (v.checking) Object.assign(state.settings, { balance: Math.round(bank.accounts[v.checking].balance * 100) / 100, balanceDate: today(), balanceAt: Date.now(), balanceSrc: 'bank' });
      else if (state.settings.balanceSrc === 'bank') state.settings.balanceSrc = '';
    },
  });
}

Object.assign(actions, {
  'bank-open': () => (sfCfg() ? bankManageSheet() : bankConnectSheet()),
  'bank-sync': () => bankSync(),
});

// Show it where money is logged: the top of Budget → Activity
const _budgetViewBank = views.budget;
views.budget = (p) => {
  const html = _budgetViewBank(p);
  if ((ui.budgetTab || 'overview') !== 'activity' || (typeof inKidMode === 'function' && inKidMode())) return html;
  const i = [html.indexOf('<div class="section-title'), html.indexOf('<div class="card')].filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? -1;
  return i < 0 ? html + bankCard() : html.slice(0, i) + bankCard() + html.slice(i);
};

// Auto sync when the app opens (and comes back), at most every few hours, only on the phone holding the key
function bankAuto() {
  const c = sfCfg(), bank = state.budget.bank;
  if (c && navigator.onLine !== false && !navigator.webdriver && Date.now() - (bank?.last || 0) > SF_EVERY) bankSync({ quiet: true });
}
setTimeout(bankAuto, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(bankAuto, 2000); });

window.BankDebug = { bankImport, sfClaim, sfCfg, sfStore, bankSync, sfBusy };
