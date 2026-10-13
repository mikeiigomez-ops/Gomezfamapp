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
const tidyMerchant = (raw) => {
  let x = String(raw || '').replace(/\s+/g, ' ').trim();
  x = x.replace(/^(POS (DEBIT|CREDIT)|DEBIT CARD PURCHASE|RECURRING CARD PURCHASE|ORIG CO NAME:)\s*/i, '')
    .replace(/^PAYPAL PURCHASE\s+/i, '').replace(/^PAYPAL INST XFER\s*/i, 'PayPal ')
    .replace(/^\s*(TST|SQ|SP|PY|PP|DD|IC|CTLP|SQU|BT)\s*\*\s*/i, '')
    .replace(/\b(PPD|WEB|CCD|TEL|IAT)\s+ID:?\s*\S+/gi, ' ').replace(/transaction#:?\s*\S+/gi, ' ').replace(/\bCO ENTRY DESCR:.*$/i, ' ')
    .replace(/\+?\d[\d-]{8,}\d/g, ' ').replace(/\b\d{2}\/\d{2}\b/g, ' ').replace(/#\s*\d+/g, ' ').replace(/\b[A-Z]-?\d{3,}\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ').replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g, ' ').replace(/\b[\w.-]+\.(com|net|org)(\/\S*)?/gi, ' ').replace(/\b\d+_\w*/g, ' ').replace(/[*#_]+/g, ' ').replace(/\s+[A-Z]{2}\s*$/, '').replace(/[,\s.-]+$/, '').replace(/\s+/g, ' ').trim();
  // A web address that was the whole name ("APPLE.COM/BILL") becomes the brand
  const site = String(raw || '').match(/\b([a-z0-9-]{3,})\.(com|net|org)\b/i);
  if (site && (!x || /^(bill|billing|pmt|payment|purchase)$/i.test(x) || x.length < 3)) x = site[1].toUpperCase();
  if (!x) return 'Bank transaction';
  // SHOUTY BANK TEXT → Title Case (keeps short all-caps brands like VW, BP)
  x = x.replace(/\b[A-Z][A-Z'&-]{2,}\b/g, (w) => w[0] + w.slice(1).toLowerCase()); // SHOUTY BANK TEXT → Title Case (VW, BP stay)
  x = x.replace(/(?!^)\b(OF|THE|AND|AT|IN|ON|FOR|TO|BY)\b/gi, (w) => w.toLowerCase()).replace(/\b(\w{3,})( \1\b)+/gi, '$1'); // "Archdiocese of Detroit", not "…OF Detroit Detroit"
  return x.slice(0, 40);
};
const sfNote = (t) => tidyMerchant(t.payee || t.description || t.memo || 'Bank transaction');
const isCardAcct = (a) => /credit|card|amex|sapphire|freedom|slate|visa|mastercard|discover/i.test(`${a.name} ${a.org?.name || ''}`) || Number(a.balance) < 0;
const sfId = (a, t) => `sf-${String(a.id).replace(/[^\w-]/g, '').slice(-24)}-${String(t.id).replace(/[^\w-]/g, '').slice(-40)}`;
const BILL_WORDS_SKIP = /^(credit|card|bill|bills|insurance|payment|pmt|the|and|inc|llc|co|company|services?|monthly)$/;
const nameHit = (billName, note) => { const n = norm(note).replace(/[^a-z0-9 ]/g, ' '); return norm(billName).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !BILL_WORDS_SKIP.test(w)).some((w) => n.includes(w.slice(0, 6))); };

// Is this charge that bill? Name + roughly the amount, or the exact amount on a close day (small amounts need more proof,
// so a $10 parking charge is never mistaken for a $10 gym fee), or a big payment within a few dollars.
function billLike(name, amount, billAmount, days, text) {
  const diff = Math.abs(billAmount - amount), named = nameHit(name, text);
  return (named && diff <= billAmount * 0.25) || (diff < 0.01 && (amount >= 20 || Math.abs(days) <= 2)) || (!named && amount >= 50 && diff <= Math.max(1.5, billAmount * 0.03) && Math.abs(days) <= 4);
}
// Category for a bank charge: what you used for that merchant before, else a keyword hint, else Uncategorized
function bankCategory(note) {
  const n = norm(note), ids = new Set(state.budget.categories.map((c) => c.id));
  const past = state.budget.transactions.find((t) => t.type !== 'income' && ids.has(t.categoryId) && t.note && !t.fromBill && norm(t.note) === n);
  if (past) return past.categoryId;
  if (typeof CATEGORY_HINTS !== 'undefined') for (const [re, key] of CATEGORY_HINTS) if (re.test(n)) { const c = state.budget.categories.find((x) => norm(x.name).includes(key)); if (c) return c.id; }
  return '';
}
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
    if (opts.csv) { for (const x of a.transactions || []) if (x.posted || x.date) all.push({ a, x, id: x.csvId || sfId(a, x), amt: Number(x.amount), date: x.date || sfDate(x.posted), note: sfNote(x), raw: String(x.description || '') }); continue; }
    bank.accounts[a.id] = { name: String(a.name || 'Account').slice(0, 40), org: String(a.org?.name || a.org?.domain || '').slice(0, 40), card: isCardAcct(a), balance: Number(a.balance) || 0, avail: a['available-balance'] != null ? Number(a['available-balance']) : null, at: now, on: bank.accounts[a.id]?.on ?? picks[a.id] ?? true };
    if (!bank.accounts[a.id].on) continue;
    for (const x of a.transactions || []) if (!x.pending && x.posted) all.push({ a, x, id: x.csvId || sfId(a, x), amt: Number(x.amount), date: x.date || sfDate(x.posted), note: sfNote(x), raw: String(x.description || '') + ' ' + String(x.payee || '') });
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
      const occ = recurringBetween(addDays(out.date, -6), addDays(out.date, 6), 'bill').find((o) => !o.b.paid?.[o.date] && !claimed.has(billTxId(o.b, o.date)) && billLike(o.b.name, oa, o.amount, daysBetween(o.date, out.date), out.note + ' ' + out.raw));
      if (occ) { (occ.b.paid ||= {})[occ.date] = 'xfer'; claimed.add(billTxId(occ.b, occ.date)); res.bills++; }
      bank.used[r.id] = 'transfer'; bank.used[twin.id] = 'transfer'; done.add(r.id); done.add(twin.id); res.skipped++; continue;
    }
    // A payment received on a credit card account is just paying the card off
    if (!spend && !opts.csv && r.a && isCardAcct(r.a)) { bank.used[r.id] = 'card-payment'; res.skipped++; continue; }
    // An expected bill or paycheck: mark it paid/received (it's logged once, as the bill)
    const occ = recurringBetween(addDays(r.date, -6), addDays(r.date, 6), spend ? 'bill' : 'income')
      .filter((o) => !claimed.has(billTxId(o.b, o.date)) && billLike(o.b.name, amount, o.amount, daysBetween(o.date, r.date), r.note + ' ' + r.raw))
      .sort((p, q) => (nameHit(q.b.name, r.note + ' ' + r.raw) - nameHit(p.b.name, r.note + ' ' + r.raw)) || Math.abs(daysBetween(p.date, r.date)) - Math.abs(daysBetween(q.date, r.date)))[0];
    if (occ) {
      const txId = billTxId(occ.b, occ.date);
      if (!occ.b.paid?.[occ.date]) markBillPaid(occ.b, occ.date, true);
      const lt = txs.find((x) => x.id === txId);
      if (lt && Math.abs(lt.amount - amount) >= 0.01) { lt.amount = amount; (occ.b.amounts ||= {})[occ.date] = amount; }
      if (lt) lt.bankId = r.id;
      bank.used[r.id] = txId; claimed.add(txId); res.bills++; continue;
    }
    // Already logged by hand, or imported earlier from a bank CSV: link it instead of adding a copy
    const mine = txs.find((x) => ((!x.bankId && !x.fromBill) || (!opts.csv && String(x.bankId || '').startsWith('csv-'))) && (x.type === 'income') === !spend && Math.abs(Number(x.amount) - amount) < 0.01 && Math.abs(daysBetween(x.date, r.date)) <= 3);
    if (mine) { mine.bankId = r.id; bank.used[r.id] = mine.id; res.linked++; continue; }
    // A bill payment from before the bill was set up in the app: file it as that bill (not as everyday spending)
    const day = parse(r.date).getDate();
    const old = spend && state.budget.bills.find((b) => b.type !== 'income' && r.date < (b.since || '0') && (
      billLike(b.name, amount, b.amount, b.freq === 'monthly' ? day - (b.dueDay || parse(b.anchor).getDate()) : 99, r.note + ' ' + r.raw)));
    if (old) {
      txs.push({ id: r.id, created: now, type: 'expense', amount, note: old.name, categoryId: old.categoryId || '', date: r.date > t ? t : r.date, memberId: '', fromBill: true, billId: old.id, bank: opts.csv ? 'Chase CSV' : bank.accounts[r.a.id]?.org || '', bankId: r.id });
      haveIds.add(r.id); res.oldBills = (res.oldBills || 0) + 1; continue;
    }
    txs.push({ id: r.id, created: now, type: spend ? 'expense' : 'income', amount, note: r.note, categoryId: spend ? bankCategory(r.note) : '', date: r.date > t ? t : r.date, memberId: '', bank: opts.csv ? 'Chase CSV' : bank.accounts[r.a.id].org || bank.accounts[r.a.id].name, bankId: r.id });
    haveIds.add(r.id); res.added++;
  }
  // Forget old matches so the record stays small (transactions themselves keep their bankId)
  const cut = addDays(t, -75);
  for (const k of Object.keys(bank.used)) if ((bank.usedAt?.[k] || t) < cut) { delete bank.used[k]; delete bank.usedAt?.[k]; }
  bank.usedAt ||= {};
  for (const k of Object.keys(bank.used)) bank.usedAt[k] ||= t;
  // The checking balance keeps Safe to spend honest (set after importing so nothing is counted twice)
  const chk = bank.checking && bank.accounts[bank.checking] ? bank.checking : Object.keys(bank.accounts).find((id) => !bank.accounts[id].card && /check/i.test(bank.accounts[id].name)) || Object.keys(bank.accounts).find((id) => !bank.accounts[id].card);
  if (chk && opts.balance !== false && !opts.csv) {
    bank.checking = chk;
    Object.assign(state.settings, { balance: Math.round(bank.accounts[chk].balance * 100) / 100, balanceDate: t, balanceAt: Date.now() + 1, balanceSrc: 'bank' });
  }
  if (!opts.csv) { bank.last = now; bank.err = ''; }
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
    const start = bank.last && !bank.empty ? bank.last - 7 * 86400e3 : parse(monthKey(today()) + '-01').getTime();
    const data = await sfFetch(c, start);
    const res = bankImport(data);
    // Protocol 1 sends errors: [strings]; newer bridges send errlist: [{ msg }]
    const errs = [...(data.errors || []), ...(data.errlist || []).map((e) => e?.msg || e?.message || e)].map(String).filter(Boolean);
    bank.err = errs.join(' ').slice(0, 200);
    bank.empty = !res.accounts;
    if (typeof activityResync === 'function') activityResync(); // bank rows aren't family activity
    if (!res.accounts && !bank.err) bank.err = 'Waiting for your bank — SimpleFIN is still loading it (the first load can take a few hours).';
    save(); render();
    if (!res.accounts) { if (!quiet) toast('🏦 Connected — your bank’s accounts aren’t ready at SimpleFIN yet. The app will keep checking.'); return res; }
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
    <div class="grow" style="flex:1;min-width:0"><b>${ac.length ? `${esc([...new Set(ac.map((a) => a.org).filter(Boolean))].join(', ') || 'Bank')} · ${ac.length} account${ac.length === 1 ? '' : 's'}` : 'Bank connected · waiting for accounts'}</b>
    <div class="small muted">${bank?.last ? `Synced ${esc(timeAgo(bank.last))} from ${who}` : 'Not synced yet'}${bank?.err ? ` · <span style="color:${bank.empty ? 'var(--muted)' : 'var(--bad)'}">${esc(bank.err)}</span>` : ''}</div></div>
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
      sfClaim(v.token).then(() => { if (btn) { btn.disabled = false; btn.textContent = 'Connect'; } closeSheet(); toast('🏦 Connected — syncing…'); bankSync().then(() => bankManageSheet()); })
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

/* ---------- Chase "account activity" CSV: same matching as bank sync, pending rows skipped ---------- */
const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
function isBankActivityCsv(head) { const h = head.map(norm); return h.includes('posting date') && h.includes('description') && h.includes('amount') && h.includes('balance'); }
const CSV_XFER_TYPE = /^(acct_xfer)$/i, CSV_XFER_DESC = /\b(online transfer|robinhood|paypal transfer|real time transfer|transfer (to|from) (sav|chk))\b/i;
function chaseCsvData(rows, fileName = '') {
  const head = rows[0].map(norm), ix = (n) => head.indexOf(n);
  const D = ix('posting date'), S = ix('description'), A = ix('amount'), T = ix('type'), B = ix('balance');
  const last4 = (String(fileName).match(/(\d{4})_activity/i) || String(fileName).match(/chase\D*(\d{4})/i) || [])[1] || '';
  const out = { pending: 0, xfer: 0, from: '', to: '', bal: null, txs: [] };
  for (const r of rows.slice(1)) {
    const posted = csvDate(r[D]), amt = csvAmount(r[A]), desc = String(r[S] || '');
    if (!posted || amt == null || !amt) continue;
    if (!String(r[B] ?? '').trim()) { out.pending++; continue; } // pending: no running balance yet
    if (CSV_XFER_TYPE.test(String(r[T] || '').trim()) || CSV_XFER_DESC.test(desc)) { out.xfer++; continue; }
    // Card purchases carry the real purchase day ("… MI 09/26"); use it when it's within a week before posting
    let date = posted; const m = [...desc.matchAll(/\s(\d{2})\/(\d{2})(?=\s|$)/g)].at(-1);
    if (m) { let y = +posted.slice(0, 4); if (+m[1] > +posted.slice(5, 7)) y--; const c = `${y}-${m[1]}-${m[2]}`; if (csvDate(c) && c <= posted && daysBetween(c, posted) <= 7) date = c; }
    if (out.bal == null) out.bal = csvAmount(r[B]);
    out.txs.push({ csvId: 'csv-' + fnv(`${posted}|${amt}|${desc}|${r[B]}`), date, amount: amt, description: desc });
    if (!out.to || date > out.to) out.to = date;
    if (!out.from || date < out.from) out.from = date;
  }
  out.data = { errors: [], accounts: [{ id: 'csv-chase' + last4, name: `Chase${last4 ? ' …' + last4 : ''}`, org: { name: 'Chase' }, transactions: out.txs }] };
  return out;
}
function chaseCsvSheet(rows, fileName) {
  const c = chaseCsvData(rows, fileName);
  if (!c.txs.length) { toast('No posted transactions in that file'); return; }
  // Dry run on a copy so the preview shows exactly what Import will do
  const snap = JSON.stringify(state);
  let p; try { p = bankImport(c.data, { csv: true }); } finally { state = JSON.parse(snap); }
  const fmt = (d) => fmtDate(d, { month: 'short', day: 'numeric' });
  openSheet({
    title: '🏦 Import Chase activity', saveLabel: p.added + (p.oldBills || 0) ? 'Import' : 'Done',
    fields: [{ type: 'html', html: `<div class="small" style="line-height:1.7">
      <p class="muted" style="margin:0 0 8px">${c.txs.length} posted transactions · ${esc(fmt(c.from))} – ${esc(fmt(c.to))}</p>
      <div class="kv"><span>New transactions</span><b>${p.added}</b></div>
      ${p.bills ? `<div class="kv"><span>Bills marked paid</span><b>${p.bills}</b></div>` : ''}
      ${p.oldBills ? `<div class="kv"><span>Earlier bill payments (filed as bills)</span><b>${p.oldBills}</b></div>` : ''}
      ${p.linked ? `<div class="kv"><span>Already logged — matched, not doubled</span><b>${p.linked}</b></div>` : ''}
      ${c.xfer ? `<div class="kv"><span class="muted">Transfers between your accounts (skipped)</span><b>${c.xfer}</b></div>` : ''}
      ${c.pending ? `<div class="kv"><span class="muted">Pending (import again after they post)</span><b>${c.pending}</b></div>` : ''}
      <p class="muted" style="margin:8px 0 0">Categories are guessed from the merchant; fix one and later ones follow. Importing the same file again adds nothing twice.</p></div>` }],
    onSave() {
      if (!(p.added + (p.oldBills || 0) + p.bills + p.linked)) return;
      const r = bankImport(c.data, { csv: true });
      if (typeof activityResync === 'function') activityResync();
      ui.budgetTab = 'activity'; ui.budgetMonth = monthKey(c.to);
      toast(`🏦 Imported ${r.added}${r.bills ? ` · ${r.bills} bills paid` : ''}${r.oldBills ? ` · ${r.oldBills} past bills` : ''}`);
    },
  });
}
// The general CSV importer hands bank "activity" exports (Chase and look-alikes) to the matcher above
const _bankCsvSheet = bankCsvSheet;
bankCsvSheet = function (text, fileName) {
  const rows = parseCsv(String(text).replace(/^\uFEFF/, ''));
  if (rows.length > 1 && isBankActivityCsv(rows[0])) return chaseCsvSheet(rows, fileName);
  return _bankCsvSheet(text);
};

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
  if (c && navigator.onLine !== false && !navigator.webdriver && Date.now() - (bank?.last || 0) > (bank?.empty ? 20 * 60e3 : SF_EVERY)) bankSync({ quiet: true });
}
setTimeout(bankAuto, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(bankAuto, 2000); });

window.BankDebug = { bankImport, sfClaim, sfCfg, sfStore, bankSync, sfBusy, chaseCsvData, tidyMerchant };

// Earlier imports filled the family feed with "Someone spent …" rows: drop those once (no person, money text)
(function tidyBankActivity() {
  try {
    if (state.settings.bankFeedTidy) return;
    const isMem = (id) => state.members.some((m) => m.id === id);
    const before = (state.activity || []).length;
    state.activity = (state.activity || []).filter((a) => isMem(a.who) || !/^(spent|logged income|paid|received) /.test(a.text || ''));
    // …and re-tidy bank names imported before the name clean-up improved
    for (const x of state.budget.transactions) if (x.bankId && !x.fromBill && /(?!^)\b(OF|THE|AND|AT)\b|\b(\w{3,}) \2\b/i.test(x.note || '')) x.note = tidyMerchant(x.note);
    state.settings.bankFeedTidy = 1;
    void before; save();
  } catch { /* never block startup */ }
})();
