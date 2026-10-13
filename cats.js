/* Categories v2: a full, grouped category set, a merchant library that files bank charges on its own when
   it's sure, and a one-merchant-at-a-time sort queue for the rest.
   Groups: Everyday (the budget, pace and safe-to-spend) · Home & bills · Debt & payments · Giving.
   Only Everyday categories count as everyday spending; the others show in "Bills & payments" and in
   money-out totals. Loaded after bank.js. */
'use strict';

const CAT_GROUPS = [['everyday', 'Everyday'], ['home', 'Home & bills'], ['debt', 'Debt & payments'], ['giving', 'Giving']];
const TAXV = 1;
// key, emoji, name, group, other names an existing category may have
const TAXONOMY = [
  ['groceries', '🛒', 'Groceries', 'everyday', ['grocery', 'food']],
  ['dining', '🍔', 'Dining Out', 'everyday', ['dining', 'restaurants', 'dining & drinks', 'eating out']],
  ['coffee', '☕', 'Coffee', 'everyday', ['coffee shops']],
  ['shopping', '🛍️', 'Shopping', 'everyday', ['amazon', 'target']],
  ['household', '🧻', 'Household', 'everyday', ['home & garden', 'home']],
  ['auto', '⛽', 'Gas & Transport', 'everyday', ['gas', 'transport', 'auto & transport', 'transportation', 'car']],
  ['personal', '💈', 'Personal Care', 'everyday', []],
  ['health', '🩺', 'Health', 'everyday', ['medical', 'health & wellness', 'health & fitness']],
  ['kids', '🧸', 'Kids', 'everyday', ['children', 'family care']],
  ['pets', '🐾', 'Pets', 'everyday', []],
  ['fun', '🎬', 'Fun', 'everyday', ['entertainment', 'entertainment & rec.', 'entertainment & rec']],
  ['gifts', '🎁', 'Gifts', 'everyday', []],
  ['travel', '✈️', 'Travel', 'everyday', ['travel & vacation', 'vacation']],
  ['education', '🎓', 'Education', 'everyday', ['school']],
  ['apps', '📱', 'Apps & Subscriptions', 'everyday', ['software & tech', 'apple subscriptions', 'subscriptions', 'apps']],
  ['other', '📦', 'Other', 'everyday', ['misc', 'miscellaneous']],
  ['housing', '🏠', 'Housing', 'home', ['mortgage', 'rent']],
  ['utilities', '💡', 'Utilities', 'home', ['bills & utilities']],
  ['insurance', '🛡️', 'Insurance', 'home', []],
  ['taxes', '🧾', 'Taxes & Fees', 'home', ['taxes', 'fees']],
  ['loans', '🏦', 'Loan Payments', 'debt', ['loan payment', 'loans', 'debt']],
  ['cards', '💳', 'Credit Card Payments', 'debt', ['credit card payment', 'credit cards']],
  ['sent', '💸', 'Money Sent', 'debt', ['transfers', 'money to family']],
  ['cash', '💵', 'Cash & Checks', 'debt', ['cash', 'checks']],
  ['giving', '⛪', 'Church & Charity', 'giving', ['charitable donations', 'giving', 'charity', 'church', 'donations']],
];
const catOf = (id) => state.budget.categories.find((c) => c.id === id) || null;
function catByKey(key) {
  const cats = state.budget.categories, t = TAXONOMY.find((x) => x[0] === key);
  return cats.find((c) => c.key === key) || (t && cats.find((c) => !c.key && [t[2], ...t[4]].some((n) => norm(n) === norm(c.name)))) || null;
}

/* ---------- Merchant names → one key, so "Brightmoor Christia Novi" and "Brightmoor Christian" are one merchant ---------- */
const US_STATES = new Set('al ak az ar ca co ct de fl ga hi ia id il in ks ky la ma md me mi mn mo ms mt nc nd ne nh nj nm nv ny oh ok or pa ri sc sd tn tx ut va vt wa wi wv wy dc'.split(' '));
const KEY_SKIP = new Set(['the', 'of', 'and', 'pos', 'debit', 'purchase', 'ach', 'web', 'tel', 'ppd', 'recurring', 'payment']);
function merchantKey(note) {
  const words = norm(note).replace(/[^a-z0-9&' ]+/g, ' ').split(/\s+/).filter((w) => w && !/^\d+$/.test(w) && !KEY_SKIP.has(w));
  const out = [];
  for (const w of words) { if (out.length && US_STATES.has(w)) break; out.push(w.slice(0, 8)); if (out.length === 2) break; }
  return out.join(' ') || norm(note) || '(no description)';
}

/* ---------- Merchant library: [category key, pattern, sure]. First match wins, so the order matters
   (insurance before gas: "Prog Marathon Ins Prem" is Progressive, not a Marathon station). ---------- */
const MERCHANT_RULES = [
  ['cards', /\b(american express|amex)\b.*\b(pmt|payment|epay|autopay)\b|\bamex epayment|\b(chase|capital one|discover|citi|barclays?|synchrony|credit one|merrick|wells fargo|bank of america|us bank)\b.*\b(card|crd|cc)\b.*\b(pmt|payment|epay|autopay)\b|\b(capital one|discover|barclays|synchrony|citi card|credit one)\b.*\b(pmt|payment|epay|autopay)\b|\bapple ?card\b|\bcard (pmt|payment)\b|\bcredit (crd|card) (epay|pmt|autopay)\b/],
  ['loans', /\b(vw credit|volkswagen credit|toyota (fin|motor credit)|honda fin|ally (auto|bank)|gm financial|ford credit|nissan motor acc|hyundai (motor fin|capital)|kia (motors )?fin|santander consumer|westlake|carvana|credit acceptance|navient|nelnet|mohela|sallie mae|aidvantage|edfinancial|sofi|upstart|lending ?club|prosper|best egg|avant|oportun|beyond finance|freedom debt|national debt relief|affirm|klarna|afterpay|sezzle|paypal inst xfer)\b|\bloan (pmt|payment)\b/],
  ['sent', /\b(apple cash|zelle|venmo|cash app|square cash)\b/],
  ['cash', /\bcheck #? ?\d+|\b(atm (withdrawal|w\/d|wd)|cash withdrawal|withdrawal)\b/],
  ['housing', /\b(mortgage|mtg pmt|shellpoint|rocket mortgage|mr\.? cooper|loancare|newrez|pennymac|freedom mortgage|rent payment|apartments?|property management|propertymaint|property maint|hoa)\b/],
  ['insurance', /\b(progressive|prog \w+ ins|geico|state farm|allstate|liberty mutual|nationwide|farmers ins|usaa|lemonade|esurance|travelers|insurance|ins prem)\b/],
  ['utilities', /\b(dte|consumers energy|comcast|xfinity|spectrum|at&t|verizon|t-mobile|tmobile|cricket wireless|metro ?pcs|boost mobile|mint mobile|wow internet|city util|water (dept|bill)|waste management|republic services|semco|duke energy|cove security|covesmart|ring\.com|simplisafe|vivint)\b|\bcityof|\bcity of .*\b(uti|util\w*|water)\b/],
  ['taxes', /\b(state of \w+|dept of|department of|corporations? div)\b/, false],
  ['taxes', /\b(irs|us treasury|tax (pmt|payment)|sec of state|secretary of state|dmv|overdraft|nsf fee|service fee|monthly fee|maintenance fee|late fee|interest charge|atm fee)\b/],
  ['giving', /\b(church|parish|ministr\w*|diocese|archdiocese|catholic|chapel|tithe|tithely|pushpay|givelify|salvation army|red cross|united way|st jude|unicef|charity|donation)\b/],
  ['giving', /\b(christia\w*|baptist|lutheran|methodist|presbyterian|fellowship|temple|mosque|synagogue)\b/, false],
  ['giving', /^(nbs )?(st|saint)\.? [a-z]+( [a-z]+)?$/, false], // "St Frances Cabrini" is usually a parish, but ask
  ['auto', /\b(shell|speedway|marathon|bp|sunoco|mobil|exxon|chevron|citgo|valero|circle k|quiktrip|wawa|sheetz|casey'?s|gas station|fuel|costco gas|meijer gas|parking|parkmobile|toll|lyft|autozone|o'?reilly auto|advance auto|napa auto|jiffy lube|valvoline|discount tire|belle tire|firestone|goodyear|car ?wash|mister car|auto repair|collision|midas|meineke|pep boys)\b|\buber\b(?! ?eats)/],
  ['groceries', /\b(kroger|meijer|aldi|costco|sam'?s club|whole foods|wholefds|trader joe'?s?|safeway|publix|h-e-b|heb|hy-vee|food 4 less|save a lot|fresh thyme|busch'?s|plum market|instacart|randazzo|holiday market|gordon food|hiller'?s|spartan|family fare|wegmans|giant eagle|food lion|sprouts|grocery|supermarket|fresh market|winco|h mart|patel brothers)\b/],
  ['coffee', /\b(starbucks|dunkin|tim hortons|biggby|caribou|peet'?s|dutch bros|scooter'?s|coffee|espresso|cafe)\b/],
  ['dining', /\b(mcdonald'?s?|burger king|wendy'?s|taco bell|chipotle|chick-?fil-?a|subway|panera|domino'?s|pizza hut|little caesars|jimmy john'?s|five guys|culver'?s|wingstop|buffalo wild|olive garden|applebee'?s|red robin|ihop|denny'?s|kfc|popeyes|arby'?s|sonic|qdoba|panda express|noodles|jersey mike'?s|firehouse subs|potbelly|shake shack|white castle|cracker barrel|texas roadhouse|outback|red lobster|chili'?s|bob evans|steak n shake|dairy queen|baskin|cold stone|krispy kreme|doordash|uber ?eats|grubhub|postmates|restaurant|grill|pizza|pizzeria|sushi|taqueria|tacos?|bbq|diner|bistro|burgers?|wings|coney|bakery|donuts?|ice cream|kitchen|sush\w*|mariachi|cantina|burritos?|brewing|brewery|brew co|bar & grill|pub)\b|eatery\b/],
  ['dining', /\b(liquor|wine|spirits|beer)\b/, false],
  ['apps', /\b(apple\.com\/bill|itunes|app store|apple services|google play|spotify|netflix|hulu|disney ?plus|youtube|hbo|paramount|peacock|audible|kindle|microsoft|adobe|dropbox|icloud|openai|chatgpt|patreon|prime video|amazon prime|kindle unlimited)\b|^apple$/],
  ['household', /\b(home depot|lowe'?s|menards|ace hardware|true value|harbor freight|container store|lumber|hardware|garden center|nursery|lawn)\b/],
  ['personal', /\b(hair\w*|great clips|sport clips|supercuts|salon|barber|ulta|sephora|nails?|spa|massage|beauty|cosmetics)\b/],
  ['health', /\b(cvs|walgreens|rite aid|pharmacy|dental|dentist|orthodont\w*|doctor|physician|clinic|hospital|urgent care|optometr\w*|eye care|labcorp|quest diag\w*|medical|pediatric\w*|chiropract\w*|planet fitness|la fitness|anytime fitness|ymca|gym|fitness)\b/],
  ['kids', /\b(children'?s place|carter'?s|oshkosh|toys ?r ?us|chuck e|daycare|child ?care|kindercare|kumon|tutor\w*|build-a-bear|summer camp)\b/],
  ['pets', /\b(petco|petsmart|chewy|pet supplies|veterinar\w*|animal hospital|banfield|barkbox)\b/],
  ['gifts', /\b(flowers?|florist|hallmark|greeting cards?|ellacard|1-800-flowers|edible arrangements)\b/],
  ['fun', /\b(bowl|links)\b/, false],
  ['fun', /\b(amc|regal|cinemark|cinema|theatre|theater|ticketmaster|stubhub|eventbrite|steam|playstation|xbox|nintendo|golf|bowling|topgolf|dave & buster'?s|parks? ?& ?re\w*|ski|lift tickets?|mountain resort|museum|zoo|aquarium|arcade|skating|trampoline|sky zone|cedar point|six flags|concert)\b/],
  ['travel', /\b(delta air|southwest|united air|american air|spirit air|frontier air|jetblue|alaska air|airlines?|hotel|marriott|hilton|hyatt|holiday inn|hampton inn|airbnb|vrbo|expedia|booking\.com|priceline|hertz|enterprise rent|avis)\b/],
  ['shopping', /\b(amazon|amzn|target|walmart|wal-mart|best buy|homegoods|home goods|tj ?maxx|marshalls|ross|kohl'?s|old ?navy|dsw|journeys|value city|value world|goodwill|plato'?s closet|lego|claire'?s|gap|macy'?s|nordstrom|jcpenney|etsy|ebay|temu|shein|dollar tree|dollar general|family dollar|five below|hobby ?lobby|michaels|joann|burlington|wayfair|bath & body|victoria'?s secret|nike|foot locker|dick'?s sporting|academy sports|staples|office depot|ikea|bed bath)\b/],
  ['shopping', /^sp /, false], // Shopify stores
  ['education', /\b(tuition|university|college|school|scholastic|coursera|udemy)\b/],
];
// { key, sure } for a description, or null
function merchantRule(note) {
  const n = norm(note);
  for (const [key, re, sure = true] of MERCHANT_RULES) if (re.test(n)) return { key, sure };
  return null;
}
const ruleCat = (note, sureOnly = true) => { const r = merchantRule(note); return r && (r.sure || !sureOnly) ? catByKey(r.key)?.id || '' : ''; };

// Bank imports: the category you gave this merchant before, else the library when it's sure, else nothing
bankCategory = function (note) {
  const k = merchantKey(note);
  const past = state.budget.transactions.find((t) => t.type !== 'income' && catOf(t.categoryId) && t.note && !t.billId && merchantKey(t.note) === k);
  return past ? past.categoryId : ruleCat(note);
};
// A hint for the sort queue (never applied on its own)
function suggestCat(note) {
  return ruleCat(note, false) || (typeof CATEGORY_HINTS !== 'undefined' ? (() => { const n = norm(note); for (const [re, key] of CATEGORY_HINTS) if (re.test(n)) { const c = state.budget.categories.find((x) => norm(x.name).includes(key)); if (c) return c.id; } return ''; })() : '');
}

/* ---------- One-time set-up: add the missing categories, group the existing ones, file bills and
   charges the library is sure about. Safe to run on every phone (same ids, same answers). ---------- */
const BILL_GROUP_CAT = { housing: 'housing', utilities: 'utilities', insurance: 'insurance', giving: 'giving', taxes: 'taxes' };
function billCatKey(b) {
  const g = norm(b.group), r = merchantRule(b.name);
  if (r && r.sure && ['cards', 'loans', 'housing', 'utilities', 'insurance', 'giving', 'taxes', 'sent'].includes(r.key)) return r.key;
  if (g === 'debt' || g === 'auto') return /card|amex|american express|discover|capital one|citi/i.test(b.name) ? 'cards' : 'loans';
  return BILL_GROUP_CAT[g] || '';
}
function ensureTaxonomy() {
  const B = state.budget;
  if (B.taxV === TAXV && TAXONOMY.every(([k]) => catByKey(k))) return 0;
  let changed = 0;
  for (const [key, emoji, name, group] of TAXONOMY) {
    const c = catByKey(key);
    if (c) { if (!c.key) { c.key = key; changed++; } if (!c.group) { c.group = group; changed++; } }
    else { B.categories.push({ id: 'cat-' + key, key, emoji, name, limit: 0, group }); changed++; }
  }
  if (B.taxV !== TAXV) {
    B.taxV = TAXV; changed++;
    // Bills go to the category their group implies (Mortgage → Housing, car loan → Loan Payments…)
    for (const b of B.bills) {
      if (b.type === 'income' || catOf(b.categoryId)) continue;
      const c = catByKey(billCatKey(b)); if (!c) continue;
      b.categoryId = c.id;
      for (const t of B.transactions) if (t.billId === b.id && !catOf(t.categoryId)) t.categoryId = c.id;
    }
    // Charges: uncategorized ones the library is sure about, plus ones the old keyword guess filed
    // differently (Amazon/Target used to land in Household)
    const hint = (note) => (typeof CATEGORY_HINTS !== 'undefined' ? (() => { const n = norm(note); for (const [re, key] of CATEGORY_HINTS) if (re.test(n)) return B.categories.find((x) => norm(x.name).includes(key))?.id || ''; return ''; })() : '');
    let filed = 0;
    for (const t of B.transactions) {
      if (t.type === 'income' || t.billId || !t.note) continue;
      const to = ruleCat(t.note); if (!to || to === t.categoryId) continue;
      const auto = !catOf(t.categoryId) || (t.bankId && t.categoryId === hint(t.note));
      if (!auto) continue;
      t.categoryId = to; if (t.outside) { delete t.outside; delete t.fromBill; }
      filed++;
    }
    if (filed) setTimeout(() => toast(`Sorted ${filed} charge${filed > 1 ? 's' : ''} into categories`), 600);
  }
  return changed;
}
const _afterRenderCats = afterRender;
afterRender = function () { try { if (ensureTaxonomy()) { save(); setTimeout(render); return; } } catch (e) { if (typeof noteError === 'function') noteError('categories', e); } _afterRenderCats(); };

/* ---------- Uncategorized merchants (biggest first), merged by merchantKey ---------- */
function uncategorizedMerchants() {
  const by = new Map();
  for (const t of state.budget.transactions) {
    if (t.type === 'income' || catOf(t.categoryId) || t.fromBill) continue;
    const k = merchantKey(t.note || '');
    let m = by.get(k);
    if (!m) by.set(k, (m = { key: k, names: {}, n: 0, total: 0, last: '', tx: [] }));
    m.n++; m.total += Number(t.amount) || 0; if (t.date > m.last) m.last = t.date;
    m.names[t.note || '(no description)'] = (m.names[t.note || '(no description)'] || 0) + 1;
    m.tx.push(t);
  }
  return [...by.values()].map((m) => {
    m.note = Object.entries(m.names).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    m.tx.sort((a, b) => b.date.localeCompare(a.date));
    m.suggest = suggestCat(m.note);
    return m;
  }).sort((a, b) => b.total - a.total);
}

/* ---------- Sort queue: one merchant at a time, tap a category, next ---------- */
function sortQueueBody() {
  const q = ui.sortQ;
  const m = q.list[q.i];
  if (!m) {
    const left = uncategorizedMerchants().length;
    return `<div class="sq-done"><div class="sq-big">✅</div><b>${q.done.length ? `Sorted ${q.done.length} merchant${q.done.length > 1 ? 's' : ''}` : 'Nothing sorted'}</b>
      <p class="small muted">${left ? `${left} still unsorted (skipped ones come back next time).` : 'Everything has a category.'}</p>
      ${q.done.length ? '<button type="button" class="mini-btn" data-action="sortq-undo">Undo last</button>' : ''}</div>`;
  }
  const sug = catOf(m.suggest);
  const chip = (c) => `<button type="button" class="sq-chip${c.id === m.suggest ? ' sugg' : ''}" data-action="sortq-pick" data-id="${esc(c.id)}">${esc(c.emoji)} ${esc(c.name)}</button>`;
  const groups = CAT_GROUPS.map(([g, label]) => {
    const cs = state.budget.categories.filter((c) => (c.group || 'everyday') === g);
    return cs.length ? `<div class="sq-group"><div class="sq-gl">${esc(label)}</div><div class="sq-chips">${cs.map(chip).join('')}</div></div>` : '';
  }).join('');
  return `<div class="sq-top"><span class="small muted">${q.i + 1} of ${q.list.length}</span><span class="sq-prog"><i style="width:${((q.i) / q.list.length) * 100}%"></i></span></div>
    <div class="card sq-card">
      <div class="sq-name">${esc(m.note)}</div>
      <div class="small muted">${m.n} charge${m.n > 1 ? 's' : ''} · ${moneyW(m.total)} total · last ${esc(fmtDate(m.last, { month: 'short', day: 'numeric' }))}</div>
      <div class="sq-tx">${m.tx.slice(0, 3).map((t) => `<div><span>${esc(fmtDate(t.date, { month: 'short', day: 'numeric' }))}</span><span class="grow">${esc(t.note || '')}</span><b>${money(t.amount)}</b></div>`).join('')}${m.n > 3 ? `<div class="muted">+ ${m.n - 3} more</div>` : ''}</div>
      ${sug ? `<button type="button" class="btn block sq-use" data-action="sortq-pick" data-id="${esc(sug.id)}">Use suggestion: ${esc(sug.emoji)} ${esc(sug.name)}</button>` : ''}
    </div>
    ${groups}
    <div class="btn-row" style="margin-top:10px">${q.done.length ? '<button type="button" class="mini-btn" data-action="sortq-undo">↶ Undo</button>' : ''}<button type="button" class="mini-btn" data-action="sortq-skip">Skip for now</button></div>`;
}
function sortMerchantsSheet() {
  const list = uncategorizedMerchants();
  if (!list.length) { toast('Everything has a category ✓'); return; }
  ui.sortQ = { list, i: 0, done: [] };
  openSheet({
    title: 'Sort merchants', saveLabel: 'Done', sortQueue: true,
    fields: [{ type: 'html', html: `<p class="small muted" style="margin-top:0">Pick a category once per merchant. Every charge from it moves now, and new ones from the bank follow.</p><div id="sortQ">${sortQueueBody()}</div>` }],
    onSave() {},
  });
}
const sortQRefresh = () => { const el = $('#sortQ'); if (el) el.innerHTML = sortQueueBody(); save(); render(); };
Object.assign(actions, {
  'sort-merchants': () => sortMerchantsSheet(),
  'sortq-pick': (el) => {
    const q = ui.sortQ, m = q?.list[q.i], c = catOf(el.dataset.id); if (!m || !c) return;
    const moved = [];
    for (const t of state.budget.transactions) {
      if (t.type === 'income' || catOf(t.categoryId) || t.fromBill || merchantKey(t.note || '') !== m.key) continue;
      moved.push([t, t.categoryId]); t.categoryId = c.id;
    }
    q.done.push({ i: q.i, moved }); q.i++;
    sortQRefresh();
  },
  'sortq-skip': () => { const q = ui.sortQ; if (q) { q.i++; sortQRefresh(); } },
  'sortq-undo': () => {
    const q = ui.sortQ, last = q?.done.pop(); if (!last) return;
    for (const [t, was] of last.moved) t.categoryId = was;
    q.i = last.i; sortQRefresh();
  },
});

/* ---------- Budget overview: the money that isn't everyday spending, by category ---------- */
function outsideEverydayCard(ym) {
  const tx = monthTx(ym).filter((t) => t.type !== 'income');
  const rows = [];
  for (const [g, label] of CAT_GROUPS.slice(1)) {
    const cs = state.budget.categories.filter((c) => c.group === g).map((c) => ({ c, v: sum(tx.filter((t) => t.categoryId === c.id), (t) => t.amount) })).filter((x) => x.v > 0);
    if (cs.length) rows.push(`<div class="sq-gl" style="margin-top:${rows.length ? 10 : 0}px">${esc(label)}</div>` + cs.map((x) => `<button class="cat-row" style="display:block;width:100%;text-align:left" data-action="edit-category" data-id="${x.c.id}"><div class="top"><span>${esc(x.c.emoji)} ${esc(x.c.name)}</span><span>${moneyW(x.v)}</span></div></button>`).join(''));
  }
  const loose = sum(tx.filter((t) => isBillOnly(t) && !catOf(t.categoryId)), (t) => t.amount);
  if (loose) rows.push(`<button class="cat-row" style="display:block;width:100%;text-align:left" data-action="budget-tab" data-tab="bills"><div class="top"><span>🧾 Other bills</span><span>${moneyW(loose)}</span></div></button>`);
  if (!rows.length) return '';
  const total = sum(tx.filter(isBillOnly), (t) => t.amount);
  return `<div class="section-title"><span>Bills & payments</span><span class="small" style="text-transform:none">${moneyW(total)} · not everyday</span></div><div class="card">${rows.join('')}</div>`;
}

if (typeof module !== 'undefined') module.exports = { merchantKey, merchantRule };
