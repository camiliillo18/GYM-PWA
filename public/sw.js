// Service worker mínimo — habilita el criterio de "installable".
// No cachea nada: la app depende de Supabase (requiere red).
// (No incluye fetch handler: Chrome ya no lo exige y un handler vacío
//  añade overhead en cada navegación.)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
