// Network-first service worker: always tries for the latest version,
// falls back to the cached copy when offline.
const CACHE = 'gomezfam-v32';
const SHELL = ['./', './index.html', './styles.css', './theme.css', './screen.css', './ui.js', './app.js', './extras.js', './plus.js', './kids.js', './little.js', './family.js', './together.js', './games.js', './gems.js', './squish.js', './collect.js', './friends.js', './avatar.js', './house.js', './polish.js', './screen.js', './sync.js', './live.js', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  // Skip the browser's 10-minute HTTP cache so an update shows up on the next open.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
