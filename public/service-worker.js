/**
 * Service Worker for Fantasy AI Ultimate
 * Provides offline support, caching, and background sync
 * Achieves 5-star PWA experience
 */

const CACHE_NAME = 'fantasy-ai-v1'
const DYNAMIC_CACHE = 'fantasy-ai-dynamic-v1'
const API_CACHE = 'fantasy-ai-api-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add your CSS/JS bundles here
]

// API endpoints to cache
const API_ROUTES = [
  '/api/v4/patterns',
  '/api/unified/patterns',
  '/api/v2/predictions',
  '/api/v2/stats',
]

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  CACHE_ONLY: 'cache-only',
  NETWORK_ONLY: 'network-only',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Skip waiting')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Cache install failed:', error)
      })
  )
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Claiming clients')
        return self.clients.claim()
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) {
    return
  }
  
  // Determine caching strategy
  const strategy = getCacheStrategy(url, request)
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirst(request))
      break
      
    case CACHE_STRATEGIES.NETWORK_FIRST:
      event.respondWith(networkFirst(request))
      break
      
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidate(request))
      break
      
    case CACHE_STRATEGIES.NETWORK_ONLY:
      event.respondWith(networkOnly(request))
      break
      
    case CACHE_STRATEGIES.CACHE_ONLY:
      event.respondWith(cacheOnly(request))
      break
      
    default:
      event.respondWith(networkFirst(request))
  }
})

// Message event - handle commands from app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'CACHE_URLS':
      cacheUrls(event.data.urls)
      break
      
    case 'CLEAR_CACHE':
      clearCache(event.data.cacheName)
      break
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size })
      })
      break
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)
  
  switch (event.tag) {
    case 'sync-predictions':
      event.waitUntil(syncPredictions())
      break
      
    case 'sync-bets':
      event.waitUntil(syncBets())
      break
      
    case 'sync-analytics':
      event.waitUntil(syncAnalytics())
      break
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'New prediction available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'view',
        title: 'View Prediction',
        icon: '/icons/checkmark.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/xmark.png',
      },
    ],
  }
  
  event.waitUntil(
    self.registration.showNotification('Fantasy AI Alert', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/predictions')
    )
  }
})

// Caching strategies implementation
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request)
    if (cached) {
      console.log('[SW] Cache hit:', request.url)
      return cached
    }
    
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.error('[SW] Cache first failed:', error)
    return caches.match('/offline.html')
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      const cache = await caches.open(
        request.url.includes('/api/') ? API_CACHE : DYNAMIC_CACHE
      )
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    const cached = await caches.match(request)
    
    if (cached) {
      return cached
    }
    
    if (request.destination === 'document') {
      return caches.match('/offline.html')
    }
    
    return new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(API_CACHE)
      cache.then(c => c.put(request, response.clone()))
    }
    return response
  })
  
  return cached || fetchPromise
}

async function networkOnly(request) {
  try {
    return await fetch(request)
  } catch (error) {
    return new Response('Network error', { status: 503 })
  }
}

async function cacheOnly(request) {
  const cached = await caches.match(request)
  return cached || new Response('Not in cache', { status: 404 })
}

// Helper functions
function getCacheStrategy(url, request) {
  // Static assets - cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
    return CACHE_STRATEGIES.CACHE_FIRST
  }
  
  // API calls - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Real-time data - network only
    if (url.pathname.includes('/live') || url.pathname.includes('/ws')) {
      return CACHE_STRATEGIES.NETWORK_ONLY
    }
    
    // Predictions - stale while revalidate
    if (url.pathname.includes('/predictions')) {
      return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE
    }
    
    return CACHE_STRATEGIES.NETWORK_FIRST
  }
  
  // HTML pages - network first
  if (request.destination === 'document') {
    return CACHE_STRATEGIES.NETWORK_FIRST
  }
  
  // Default
  return CACHE_STRATEGIES.NETWORK_FIRST
}

async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE)
  await cache.addAll(urls)
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName)
  } else {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
  }
}

async function getCacheSize() {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0 }
  }
  
  const estimate = await navigator.storage.estimate()
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
    percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0,
  }
}

// Background sync functions
async function syncPredictions() {
  try {
    // Get pending predictions from IndexedDB
    const pending = await getPendingItems('predictions')
    
    for (const item of pending) {
      await fetch('/api/v2/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      
      await removePendingItem('predictions', item.id)
    }
    
    console.log('[SW] Synced predictions:', pending.length)
  } catch (error) {
    console.error('[SW] Sync predictions failed:', error)
    throw error
  }
}

async function syncBets() {
  try {
    const pending = await getPendingItems('bets')
    
    for (const bet of pending) {
      await fetch('/api/v2/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bet),
      })
      
      await removePendingItem('bets', bet.id)
    }
    
    console.log('[SW] Synced bets:', pending.length)
  } catch (error) {
    console.error('[SW] Sync bets failed:', error)
    throw error
  }
}

async function syncAnalytics() {
  try {
    const events = await getPendingItems('analytics')
    
    if (events.length > 0) {
      await fetch('/api/v2/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      })
      
      await clearPendingItems('analytics')
    }
    
    console.log('[SW] Synced analytics:', events.length)
  } catch (error) {
    console.error('[SW] Sync analytics failed:', error)
  }
}

// IndexedDB helpers for offline data
async function getPendingItems(storeName) {
  // Implementation would use IndexedDB
  // Simplified for example
  return []
}

async function removePendingItem(storeName, id) {
  // Implementation would use IndexedDB
}

async function clearPendingItems(storeName) {
  // Implementation would use IndexedDB
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag)
  
  switch (event.tag) {
    case 'update-predictions':
      event.waitUntil(updatePredictionsCache())
      break
      
    case 'cleanup-cache':
      event.waitUntil(cleanupOldCache())
      break
  }
})

async function updatePredictionsCache() {
  try {
    const cache = await caches.open(API_CACHE)
    
    // Update key API endpoints
    const endpoints = [
      '/api/v4/patterns/today',
      '/api/v2/predictions/latest',
      '/api/v2/stats',
    ]
    
    await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint)
          if (response.ok) {
            await cache.put(endpoint, response)
          }
        } catch (error) {
          console.error(`[SW] Failed to update ${endpoint}:`, error)
        }
      })
    )
    
    console.log('[SW] Updated predictions cache')
  } catch (error) {
    console.error('[SW] Update cache failed:', error)
  }
}

async function cleanupOldCache() {
  const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
  const now = Date.now()
  
  const cacheNames = await caches.keys()
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()
    
    for (const request of requests) {
      const response = await cache.match(request)
      const dateHeader = response.headers.get('date')
      
      if (dateHeader) {
        const responseTime = new Date(dateHeader).getTime()
        if (now - responseTime > maxAge) {
          await cache.delete(request)
        }
      }
    }
  }
  
  console.log('[SW] Cleaned up old cache entries')
}

console.log('[SW] Service worker loaded')