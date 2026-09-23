// Service Worker opcional para FinanzaPro AI.
// El archivo FinanzaProAI_PWA.html ya intenta registrar un service worker
// "al vuelo" (vía Blob) como mejor esfuerzo, pero algunos navegadores no
// permiten registrar service workers desde una blob: URL.
//
// Si quieres garantizar instalación completa en Android/Chrome y caché
// offline real, sube este archivo "sw.js" en la MISMA carpeta que
// FinanzaProAI_PWA.html (o renómbralo/sírvelo como index.html) en tu
// hosting con HTTPS. No requiere ningún cambio adicional: el navegador
// lo detectará solo si registras esta ruta en tu propio código, o puedes
// reemplazar el bloque "Service Worker" del <head> del HTML por:
//   navigator.serviceWorker.register('/sw.js')

const CACHE_NAME = "finanzapro-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
