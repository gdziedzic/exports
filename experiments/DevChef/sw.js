/**
 * DevChef V7 - Service Worker
 * Full offline PWA support with intelligent caching & performance optimization
 */

const CACHE_VERSION = 'devchef-v7.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const TOOLS_CACHE = `${CACHE_VERSION}-tools`;

// Files to cache immediately on install
const STATIC_FILES = [
  '/',
  '/index.html',
  '/app.js',
  '/app.css',
  '/core/registry.js',
  '/core/loader.js',
  '/core/state.js',
  '/core/ui.js',
  '/core/console.js',
  '/core/storage.js',
  '/core/search.js',
  '/core/notifications.js',
  '/core/clipboard.js',
  '/core/pipeline.js',
  '/core/snippets.js',
  '/core/workspace.js',
  '/core/analytics.js',
  '/core/quickactions.js',
  '/core/errorhandler.js',
  '/core/backup.js',
  '/core/onboarding.js',
  '/core/validator.js',
  '/core/performance.js',
  '/tools/index.json'
];

// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_TOOLS_CACHE_SIZE = 100;

/**
 * Install event - cache static files
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Remove old caches that don't match current version
              return cacheName.startsWith('devchef-') &&
                     !cacheName.startsWith(CACHE_VERSION);
            })
            .map((cacheName) => {
              console.log(`Service Worker: Deleting old cache ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - serve from cache with network fallback
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Different strategies for different resource types
  if (isToolFile(url)) {
    event.respondWith(cacheFirstStrategy(request, TOOLS_CACHE));
  } else if (isStaticFile(url)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

/**
 * Cache-first strategy (good for static assets)
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to network
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());

      // Limit cache size
      limitCacheSize(cacheName, getMaxCacheSize(cacheName));
    }

    return networkResponse;
  } catch (error) {
    // Return offline page or error
    console.error('Cache-first strategy failed:', error);
    return new Response('Offline - resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Network-first strategy (good for dynamic content)
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());

      // Limit cache size
      limitCacheSize(cacheName, MAX_DYNAMIC_CACHE_SIZE);
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return error
    return new Response('Offline - resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Check if URL is a tool file
 */
function isToolFile(url) {
  return url.pathname.startsWith('/tools/') && url.pathname.endsWith('.html');
}

/**
 * Check if URL is a static file
 */
function isStaticFile(url) {
  return url.pathname.startsWith('/core/') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname === '/' ||
         url.pathname === '/index.html';
}

/**
 * Get max cache size for cache name
 */
function getMaxCacheSize(cacheName) {
  if (cacheName.includes('tools')) {
    return MAX_TOOLS_CACHE_SIZE;
  } else if (cacheName.includes('dynamic')) {
    return MAX_DYNAMIC_CACHE_SIZE;
  }
  return Infinity; // Static cache is unlimited
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    // Remove oldest entries (first in, first out)
    const toDelete = keys.length - maxSize;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

/**
 * Message handler for communication with main app
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ size });
      });
      break;

    case 'PREFETCH_TOOLS':
      prefetchTools(data.tools).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((cacheName) => caches.delete(cacheName))
  );
  console.log('All caches cleared');
}

/**
 * Get total cache size
 */
async function getCacheSize() {
  if ('estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage,
      quota: estimate.quota,
      percentage: (estimate.usage / estimate.quota) * 100
    };
  }
  return null;
}

/**
 * Prefetch tool files
 */
async function prefetchTools(tools) {
  const cache = await caches.open(TOOLS_CACHE);
  const urls = tools.map((tool) => `/tools/${tool}`);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`Failed to prefetch ${url}:`, error);
      }
    })
  );

  console.log(`Prefetched ${urls.length} tools`);
}

/**
 * Background sync for analytics data
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

/**
 * Sync analytics data when online
 */
async function syncAnalytics() {
  // Placeholder for analytics sync
  // Would send buffered analytics data to server when online
  console.log('Syncing analytics data...');
}

/**
 * Push notification handler (for future features)
 */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'DevChef notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DevChef', options)
  );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

console.log('Service Worker script loaded');
