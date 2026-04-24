// Service worker mínimo — habilita el criterio de "installable" de Chrome/Edge.
// No cachea nada: la app depende de Supabase (requiere red).

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler vacío → Chrome lo exige para considerar la app instalable.
self.addEventListener('fetch', () => {});
