const CACHE_NAME = 'itinerancia-v7';

const ARXIUS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './dades.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/logo-ceinr.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARXIUS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((resp) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resp.clone());
          return resp;
        });
      }).catch(() => cached);
    })
  );
});
