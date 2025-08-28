const CACHE_NAME = 'today-todo-v1';
const VERSION = '1.0.0'; // Add version for update detection
const urlsToCache = [
    '/',
    '/index.html?v=' + VERSION,
    '/styles.css?v=' + VERSION,
    '/app.js?v=' + VERSION,
    '/manifest.json?v=' + VERSION,
    '/icon-192x192.png',
    '/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
    );
});

// Fetch event - implement network-first strategy for better updates
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone the response before using it
                const responseClone = response.clone();
                
                // Update cache with fresh content
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseClone);
                    });
                
                return response;
            })
            .catch(() => {
                // If network fails, try to serve from cache
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // If not in cache, return a fallback
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        return new Response('Network error', { status: 503 });
                    });
            })
    );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Claim all clients immediately
            self.clients.claim()
        ])
    );
});

// Listen for messages from the main app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CHECK_UPDATE') {
        // Check if there's a new version available
        event.ports[0].postMessage({ type: 'UPDATE_AVAILABLE', version: VERSION });
    }
});