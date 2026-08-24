/**
 * Service Worker — Gestión Biomédica
 *
 * Hace dos cosas:
 *
 *   1. Permite que el navegador ofrezca "instalar" la aplicación. Sin un
 *      service worker con manejador de fetch, Android no muestra el
 *      botón de instalación por más completo que esté el manifest.
 *
 *   2. Guarda la aplicación en el teléfono para que abra sin conexión.
 *      Los registros ya viven en IndexedDB; esto guarda el programa que
 *      los muestra.
 *
 * Estrategia por tipo de petición:
 *
 *   /api/*            No se toca. Nunca. Una respuesta vieja del caché
 *                     le haría creer a la aplicación que un registro se
 *                     guardó cuando no fue así.
 *   Navegación (/)    Primero la red, el caché de respaldo. Así, con
 *                     señal, siempre se abre la última versión; y sin
 *                     señal, se abre la última que se vio.
 *   /assets/*         Primero el caché. Vite les pone un hash en el
 *                     nombre, así que un archivo dado nunca cambia de
 *                     contenido: si está guardado, sirve.
 *   Lo demás          Se sirve del caché y se refresca por detrás.
 */

const VERSION = 'v3';
const CACHE = `biomedica-${VERSION}`;

// El mínimo para que la aplicación abra sin conexión. Los archivos de
// /assets/ no se listan aquí a proposito: sus nombres cambian en cada
// compilación, y se van guardando solos en el primer uso.
const BASE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Uno por uno y tolerando fallos: con cache.addAll, un solo archivo
      // que no responda tumba la instalación entera del service worker.
      Promise.all(
        BASE.map((url) => cache.add(url).catch(() => undefined))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Se borra TODO lo que no sea el caché de esta versión, no solo lo
      // que empiece por "biomedica-": los teléfonos que ya abrieron la
      // aplicación tienen el caché viejo con otro nombre
      // ("clinica-biomedica-v2"), y si no se limpia queda ocupando
      // espacio para siempre.
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre !== CACHE)
            .map((nombre) => caches.delete(nombre))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Guarda una respuesta en el caché sin bloquear la que ya va en camino. */
function guardar(peticion, respuesta) {
  if (!respuesta || !respuesta.ok) return respuesta;

  const copia = respuesta.clone();
  caches.open(CACHE).then((cache) => cache.put(peticion, copia)).catch(() => {});

  return respuesta;
}

self.addEventListener('fetch', (event) => {
  const peticion = event.request;

  if (peticion.method !== 'GET') return;

  let url;
  try {
    url = new URL(peticion.url);
  } catch {
    return;
  }

  // La API queda por fuera del service worker, completa.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // --- Navegación: primero la red ---------------------------------------
  // Importa que sea así y no al revés. El index.html apunta a archivos con
  // hash en el nombre; si se sirviera una copia vieja del caché después de
  // un despliegue, pediría archivos que ya no existen y la pantalla
  // quedaría en blanco.
  if (peticion.mode === 'navigate') {
    event.respondWith(
      fetch(peticion)
        .then((respuesta) => guardar(peticion, respuesta))
        .catch(async () => {
          const cache = await caches.open(CACHE);

          return (
            (await cache.match(peticion)) ||
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            new Response(
              '<!doctype html><meta charset="utf-8"><title>Sin conexión</title>' +
                '<body style="font-family:system-ui;padding:2rem;text-align:center">' +
                '<h1>Sin conexión</h1><p>Abra la aplicación una vez con señal ' +
                'para poder usarla después sin ella.</p></body>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        })
    );

    return;
  }

  // --- Archivos con hash: primero el caché -------------------------------
  const esArchivoConHash =
    url.origin === self.location.origin && url.pathname.startsWith('/assets/');

  if (esArchivoConHash) {
    event.respondWith(
      caches.match(peticion).then(
        (guardada) =>
          guardada ||
          fetch(peticion).then((respuesta) => guardar(peticion, respuesta))
      )
    );

    return;
  }

  // --- Lo demás: caché primero, refresco por detrás ----------------------
  // Iconos, manifest, tipografías de Google. Si hay copia, se entrega ya y
  // se actualiza en silencio para la proxima vez.
  event.respondWith(
    caches.match(peticion).then((guardada) => {
      const desdeRed = fetch(peticion)
        .then((respuesta) => guardar(peticion, respuesta))
        .catch(() => guardada);

      return guardada || desdeRed;
    })
  );
});
