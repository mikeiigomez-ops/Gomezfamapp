// Network-first service worker: always tries for the latest version, falls back to the cached copy when offline.
// Each version's cache is filled in one go at install and never mixed with another version's files. A new version
// waits until the app says "Reload" (or every window is closed), so one session never runs old and new scripts together.
const CACHE = 'gomezfam-v97';
const SHELL = ['./', './index.html', './styles.css', './theme.css', './screen.css', './ui.js', './art.js', './art-icons.js', './art-house.js', './art-rewards.js', './app.js', './extras.js', './plus.js', './kids.js', './little.js', './family.js', './together.js', './games.js', './gems.js', './squish.js', './collect.js', './friends.js', './avatar.js', './house.js', './polish.js', './screen.js', './sync.js', './live.js', './world-data.js', './world.js', './nav.js', './bank.js', './cats.js', './periods.js', './level.js', './notify.js', './world.css', './motion.css', './motion.js', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './vendor/qrcode.min.js', './vendor/jsQR.js'];

self.addEventListener('install', (e) => {
  // Skip the browser's 10-minute HTTP cache so an update shows up on the next open.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const SHELL_URLS = new Set(SHELL.map((u) => new URL(u, self.location).href));
const fromCache = new Set(); // windows that opened from the cache: their scripts come from the same cached version
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === 'navigate', shell = SHELL_URLS.has(req.url.split('#')[0]);
  const cached = () => caches.open(CACHE).then((c) => c.match(req)).then((hit) => hit || (nav ? caches.open(CACHE).then((c) => c.match('./index.html')) : undefined));
  if (!nav && shell && fromCache.has(e.clientId)) { e.respondWith(cached().then((hit) => hit || fetch(req))); return; }
  // Shell files stay as installed (one consistent set for offline use); other files refresh the cache as they load
  const net = fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok && !shell) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; });
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (r, cache) => { if (!done && r) { done = true; if (cache && nav && e.resultingClientId) fromCache.add(e.resultingClientId); resolve(r); } };
    // A slow network never strands you: after 4s open from the cache and keep refreshing in the background
    const timer = setTimeout(() => cached().then((r) => finish(r, true)), nav ? 4000 : 8000);
    net.then((r) => { clearTimeout(timer); finish(r); })
      .catch(() => { clearTimeout(timer); cached().then((hit) => { if (!done) { done = true; if (nav && hit && e.resultingClientId) fromCache.add(e.resultingClientId); resolve(hit || Response.error()); } }); });
  }));
  e.waitUntil(net.catch(() => {}));
});

// Phone notifications (sent by the family's scheduled job, tools/notify/send.cjs)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Gomez Family Hub', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' },
    icon: './icons/icon-192.png', badge: './icons/icon-192.png',
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => x.url.startsWith(self.registration.scope)) || ws[0];
    if (w) return w.focus().then((f) => (f && f.navigate ? f.navigate(url) : f)).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
