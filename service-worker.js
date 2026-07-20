const CACHE_NAME = 'itinerancia-v18';

const ARXIUS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './dades.js',
  './mapa.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/logo-ceinr.svg',
  './images/mapa-cavallera.jpg'
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

// ---- Background Sync (Android/Chrome) ----
// Quan el sistema detecta que hi ha connexió i tenim una petició de sync
// pendent, avisem totes les finestres de l'app (obertes o en segon pla)
// perquè pugin els registres pendents. Si no n'hi ha cap oberta, el propi
// fet d'obrir l'app ja dispararà la sincronització.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-registres') {
    event.waitUntil(avisarClients());
  }
});

// Periodic Background Sync (si el navegador el concedeix)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-registres-periodic') {
    event.waitUntil(avisarClients());
  }
});

function avisarClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ tipus: 'sync-pendents' });
      });
    });
}
