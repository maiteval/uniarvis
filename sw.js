/* Service worker: permite instalar la app y usarla sin internet.
   Estrategia: red primero (siempre la última versión) y, si no hay conexión, lo guardado. */
const CACHE = 'entrenador-academico-v8';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/util.js', 'js/ics.js', 'js/crypto.js', 'js/state.js', 'js/institutions.js', 'js/institution-data.js', 'js/capacity.js', 'js/planner.js', 'js/wellbeing.js', 'js/arvis.js',
  'js/syllabus.js', 'js/tools.js', 'js/config.js', 'js/social-mock.js', 'js/social.js', 'js/metrics.js', 'js/actions.js', 'js/ayuda.js', 'js/help-ui.js', 'js/views.js', 'js/app.js',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/arvis/arvis-energia.svg', 'icons/arvis/arvis-normal.svg', 'icons/arvis/arvis-celebrando.svg',
  'icons/arvis/arvis-estudiando.svg', 'icons/arvis/arvis-preocupado.svg', 'icons/arvis/arvis-cansado.svg', 'icons/arvis/arvis-descansando.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
        return res;
      })
      .catch(() => caches.match(r).then(m => m || caches.match('index.html')))
  );
});
