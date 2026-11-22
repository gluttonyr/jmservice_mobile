// JM Services website, installed as an application (PWA).
// Kept minimal on purpose: the site always comes from the network, so a new deploy is seen at once
// (nothing of the app is kept here). Only without connection, a page « Pas de connexion » replaces
// the browser's error page. Requests to the API (another address) are never touched.
const OFFLINE_PAGE = `<!DOCTYPE html><html lang="fr" translate="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#060B1E">
<title>JM Services</title><style>
html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#060B1E;
color:#E8EDF7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
img{width:120px;height:120px;border-radius:28px;margin-bottom:22px}h1{font-size:20px;margin:0 0 8px}
p{color:#8D9AC0;font-size:14px;margin:0 0 24px;line-height:1.5}
button{background:linear-gradient(90deg,#FFD255,#FF9F1C);color:#1A1405;border:0;border-radius:14px;padding:14px 28px;
font-size:15px;font-weight:700}</style></head><body><div>
<img src="/icons/icon-192.png" alt=""><h1>Pas de connexion</h1>
<p>Vérifiez votre connexion Internet,<br>puis réessayez.</p>
<button onclick="location.reload()">Réessayer</button></div></body></html>`;

const CACHE = 'jm-offline-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/icons/icon-192.png')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
    return;
  }
  if (url.pathname === '/icons/icon-192.png') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
