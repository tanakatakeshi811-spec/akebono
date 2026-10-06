/* あけぼの service worker：アプリ本体をキャッシュしてオフラインで起動できるようにする */
const VERSION = 'akebono-v1.0.0';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const FONT_CACHE = 'akebono-fonts';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      // ネット優先（3秒で諦めてキャッシュ）→ 更新がすぐ反映される
      e.respondWith((async () => {
        const cache = await caches.open(VERSION);
        try {
          const net = await Promise.race([fetch(req), new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 3000))]);
          if (net && net.ok) cache.put('./index.html', net.clone());
          return net;
        } catch (err) {
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      })());
      return;
    }
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // 天気API などはそのままネットへ
});
