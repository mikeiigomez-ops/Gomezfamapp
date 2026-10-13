/* Sends the family's phone notifications. Run every ~30 minutes by .github/workflows/notify.yml.
   For each family in Firestore with push subscriptions: open the app headless (served from this checkout) with
   the family's synced data, in each person's time zone, ask notifyPlan() (notify.js) what's due, send it with
   Web Push, and remember what was sent (Firestore notifyLog/<familyId>) so nothing repeats.

   Secrets (GitHub → Settings → Secrets and variables → Actions):
     FIREBASE_SERVICE_ACCOUNT  the service-account JSON from Firebase (Project settings → Service accounts)
     VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  made in the app (Settings → Notifications → Set up)
   Local dry run (no Firebase, no sending): NOTIFY_DRY_STATE=state.json [NOTIFY_NOW=2026-10-13T20:35] node send.cjs */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../..');
const DRY = process.env.NOTIFY_DRY_STATE;
const DAY = 864e5;

function unpack(str) {
  str = String(str || '');
  return JSON.parse(str.startsWith('gz1:') ? zlib.gunzipSync(Buffer.from(str.slice(4), 'base64')).toString('utf8') : str);
}
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p));
    if (!f.startsWith(ROOT) || f.includes(`${path.sep}tools${path.sep}`) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
const hashKey = (s) => require('crypto').createHash('sha1').update(String(s)).digest('hex').slice(0, 16);

async function families() {
  if (DRY) { const j = JSON.parse(fs.readFileSync(DRY, 'utf8')); return [j.state ? { id: j.famId || 'dry', state: j.state, circles: j.circles || [], log: {} } : { id: 'dry', state: j, log: {} }]; }
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore(), out = [];
  const circlesAll = (await db.collection('circles').get().catch(() => ({ docs: [] }))).docs;
  for (const d of (await db.collection('families').get()).docs) {
    let state; try { state = unpack(d.data().data); } catch { console.log(`family ${d.id}: unreadable data, skipped`); continue; }
    if (!state?.notify?.subs?.length) continue;
    const logDoc = await db.collection('notifyLog').doc(d.id).get();
    // Friends circles this family is in (only names, chat and trades live there)
    const circles = [];
    for (const c of circlesAll) { try { const data = unpack(c.data().data); if (data?.fams?.[d.id]) circles.push({ id: c.id, data: { chat: (data.chat || []).slice(-80), trades: data.trades || [], people: data.people || {}, fams: Object.fromEntries(Object.entries(data.fams || {}).map(([k, v]) => [k, { name: v.name }])) } }); } catch { /* skip */ } }
    out.push({ id: d.id, state, circles, log: (logDoc.exists && logDoc.data().log) || {}, save: (log) => db.collection('notifyLog').doc(d.id).set({ log, updatedAt: admin.firestore.FieldValue.serverTimestamp() }) });
  }
  return out;
}

(async () => {
  if (!DRY) {
    for (const k of ['FIREBASE_SERVICE_ACCOUNT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) if (!process.env[k]) { console.log(`${k} isn't set: nothing to do`); return; }
  }
  const webpush = DRY ? null : require('web-push');
  if (webpush) webpush.setVapidDetails('mailto:notifications@gomezfam.invalid', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const { chromium } = require(process.env.PW || 'playwright');
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  let sent = 0;
  try {
    for (const fam of await families()) {
      const S = fam.state, log = fam.log, subs = (S.notify.subs || []).filter((s) => s.endpoint && !log['dead:' + hashKey(s.endpoint)]);
      if (!DRY && S.notify.vapid && S.notify.vapid !== process.env.VAPID_PUBLIC_KEY) { console.log(`family ${fam.id}: the app's push key doesn't match VAPID_PUBLIC_KEY; redo setup or update the secret`); continue; }
      // One headless page per time zone, so "8:30 pm" means each person's 8:30 pm
      const byTz = {};
      for (const s of subs) (byTz[s.tz || 'America/Detroit'] ||= new Set()).add(s.member);
      for (const [tz, members] of Object.entries(byTz)) {
        const ctx = await browser.newContext({ timezoneId: tz, serviceWorkers: 'block' });
        const page = await ctx.newPage();
        if (process.env.NOTIFY_NOW) await page.clock.setFixedTime(new Date(process.env.NOTIFY_NOW));
        page.on('pageerror', (e) => console.log(`[${fam.id}] page error: ${e.message}`));
        await page.addInitScript((s) => { localStorage.setItem('gomezfam:v1', JSON.stringify(s)); }, S);
        await page.goto(base + '#home');
        await page.waitForFunction(() => typeof window.notifyPlan === 'function', null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const msgs = await page.evaluate(([l, m, o]) => window.notifyPlan(l, m, o), [log, [...members], { circles: fam.circles || [], famId: fam.id }]);
        await ctx.close();
        for (const m of msgs) {
          const targets = subs.filter((s) => s.member === m.member && !(s.kid && ['weekly', 'monthly', 'alert'].includes(m.kind)));
          if (!targets.length) { Object.assign(log, m.mark); continue; }
          const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag });
          if (DRY) { console.log(JSON.stringify({ to: m.member, kind: m.kind, title: m.title, body: m.body, targets: targets.length })); Object.assign(log, m.mark); continue; }
          let ok = false;
          for (const s of targets) {
            try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 6 * 3600, urgency: m.kind === 'alert' ? 'high' : 'normal' }); ok = true; sent++; }
            catch (e) {
              if (e.statusCode === 404 || e.statusCode === 410) { log['dead:' + hashKey(s.endpoint)] = Date.now(); console.log(`[${fam.id}] a subscription expired; it will be skipped`); }
              else console.log(`[${fam.id}] push failed (${e.statusCode || e.message})`);
            }
          }
          if (ok || !targets.length) Object.assign(log, m.mark); // failed sends are retried next run
        }
      }
      // Forget what was sent more than 120 days ago
      for (const [k, v] of Object.entries(log)) if (typeof v === 'number' && !k.startsWith('chat:') && Date.now() - v > 120 * DAY) delete log[k];
      if (fam.save) await fam.save(log);
    }
  } finally { await browser.close(); srv.close(); }
  console.log(DRY ? 'dry run done' : `sent ${sent} notification(s)`);
})().catch((e) => { console.error(e); process.exit(1); });
