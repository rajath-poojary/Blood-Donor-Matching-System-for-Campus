const CACHE_NAME = 'bloodmatch-shell-v17';
const SHELL_FILES = [
    './',
    './index.html',
    './css/index.css',
    './css/animations.css',
    './css/login.css',
    './css/mission-control.css',
    './js/store.js',
    './js/qr-card.js',
    './js/app.js',
    './js/login.js'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const requestUrl = new URL(request.url);
    if (request.method !== 'GET' || requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) return;
    event.respondWith(
        fetch(request).then(response => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            return response;
        }).catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') return caches.match('./index.html');
            return Response.error();
        })
    );
});
