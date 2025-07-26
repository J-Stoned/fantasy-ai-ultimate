/**
 * Firebase Cloud Messaging Service Worker
 * Handles background notifications for Fantasy AI Platform
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: 'AIzaSyA4lnRjUEDVhkGQ7yeg9GE0LBgBqDC2GsM',
  authDomain: 'fantasy-ai-ultimate.firebaseapp.com',
  projectId: 'fantasy-ai-ultimate',
  storageBucket: 'fantasy-ai-ultimate.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456789012345'
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);
  
  const { notification, data } = payload;
  
  // Extract notification data
  const notificationTitle = notification?.title || 'Fantasy AI Update';
  const notificationOptions = {
    body: notification?.body || 'You have a new update',
    icon: notification?.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data?.type || 'default',
    data: data,
    requireInteraction: data?.priority === 'critical',
    vibrate: [200, 100, 200],
    actions: []
  };

  // Add actions based on notification type
  if (data?.type === 'lineup_alert') {
    notificationOptions.actions = [
      { action: 'view', title: 'View Lineup' },
      { action: 'optimize', title: 'Optimize' }
    ];
  } else if (data?.type === 'trade_activity') {
    notificationOptions.actions = [
      { action: 'review', title: 'Review Trade' },
      { action: 'dismiss', title: 'Dismiss' }
    ];
  } else if (data?.type === 'injury_update') {
    notificationOptions.actions = [
      { action: 'replace', title: 'Find Replacement' },
      { action: 'details', title: 'View Details' }
    ];
  }

  // Handle high-priority notifications
  if (data?.priority === 'critical' || data?.priority === 'high') {
    notificationOptions.requireInteraction = true;
    notificationOptions.vibrate = [500, 200, 500];
  }

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  // Route based on notification type and action
  if (event.action === 'view' && data?.type === 'lineup_alert') {
    url = `/lineup/${data.leagueId}`;
  } else if (event.action === 'optimize') {
    url = `/dfs/optimizer`;
  } else if (event.action === 'review' && data?.type === 'trade_activity') {
    url = `/trades/${data.tradeId}`;
  } else if (event.action === 'replace' && data?.type === 'injury_update') {
    url = `/players/replacement/${data.playerId}`;
  } else if (event.action === 'details') {
    url = `/players/${data.playerId}`;
  } else if (data?.deepLink) {
    url = data.deepLink;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
  
  // Track dismissal
  const data = event.notification.data;
  if (data?.notificationId) {
    fetch('/api/notifications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: data.notificationId,
        action: 'dismissed',
        timestamp: new Date().toISOString()
      })
    }).catch(console.error);
  }
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle fetch events for offline support
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if available
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache static assets
          if (event.request.url.includes('/static/') || 
              event.request.url.includes('/icons/') ||
              event.request.url.includes('/images/')) {
            caches.open('fantasy-ai-v1').then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return response;
        });
      })
      .catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      })
  );
});