// Service worker con caché de "app-shell".
// Objetivo: que la app abra rápido y siga abriendo aunque la red falle.
// NO cachea datos (Supabase) ni peticiones cross-origin: los datos siempre
// van por red para no servir información desactualizada.

const CACHE = 'gympwa-shell-v1';
const SHELL_URLS = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Solo gestionamos nuestro propio origen. Supabase y terceros van directos.
  if (url.origin !== self.location.origin) return;

  // Navegaciones (cargar la página): red primero, caché si no hay red.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match(req)))
    );
    return;
  }

  // Estáticos (JS/CSS/iconos/fuentes): caché inmediata + revalidación en 2º plano.
  const isStatic =
    url.pathname.startsWith('/_next/') ||
    /\.(?:js|css|svg|png|ico|webp|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fromNetwork = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || fromNetwork;
      })
    );
  }
});
