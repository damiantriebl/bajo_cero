// Service worker de Bajo Cero.
// - Archivos estáticos (_next/static, íconos, logo): caché primero (tienen hash o no cambian).
// - Páginas y datos: siempre a la red; Next (experimental.useOffline) reintenta al volver la señal.
const CACHE = "bajocero-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const esEstatico =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.webp";
  if (!esEstatico) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardado = await cache.match(req);
      if (guardado) return guardado;
      const resp = await fetch(req);
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    }),
  );
});
