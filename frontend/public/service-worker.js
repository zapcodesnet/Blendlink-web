const CACHE_NAME = 'blendlink-admin-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, then cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push notification event - Enhanced for admin notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'Blendlink Admin',
    body: 'You have a new notification',
    icon: '/logo192.png',
    badge: '/favicon.ico',
    tag: 'admin-notification',
    url: '/admin'
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || payload.notification_type || data.tag,
        url: payload.url || payload.data?.url || data.url,
        priority: payload.priority || 'normal',
        notification_type: payload.notification_type,
        notification_id: payload.notification_id
      };
    } catch (e) {
      console.error('[SW] Failed to parse push data:', e);
    }
  }

  // Notification options based on type
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    renotify: true,
    requireInteraction: data.priority === 'critical' || data.priority === 'high',
    vibrate: getVibrationPattern(data.priority),
    data: {
      url: data.url,
      notification_id: data.notification_id,
      notification_type: data.notification_type,
      timestamp: Date.now()
    },
    actions: getNotificationActions(data.notification_type)
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Get vibration pattern based on priority
function getVibrationPattern(priority) {
  switch (priority) {
    case 'critical':
      return [200, 100, 200, 100, 200]; // Urgent pattern
    case 'high':
      return [200, 100, 200]; // Alert pattern
    case 'normal':
      return [100, 50, 100]; // Standard pattern
    default:
      return [100]; // Gentle vibration
  }
}

// Get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'new_kyc_request':
      return [
        { action: 'review', title: '📋 Review KYC' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    case 'new_withdrawal':
    case 'new_withdrawal_request':
      return [
        { action: 'review', title: '💰 Review' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    case 'security_alert':
    case 'suspicious_activity':
    case 'brute_force_detected':
      return [
        { action: 'investigate', title: '🔍 Investigate' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    case 'admin_login':
      return [
        { action: 'view', title: '👁️ View' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    default:
      return [
        { action: 'open', title: '📂 Open' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
  }
}

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  
  const data = event.notification.data || {};
  let targetUrl = data.url || '/admin';
  
  // Handle different actions
  switch (event.action) {
    case 'review':
      if (data.notification_type?.includes('kyc')) {
        targetUrl = '/admin/withdrawals?tab=kyc';
      } else if (data.notification_type?.includes('withdrawal')) {
        targetUrl = '/admin/withdrawals?tab=pending';
      }
      break;
    case 'investigate':
      targetUrl = '/admin/security';
      break;
    case 'view':
      targetUrl = '/admin/audit';
      break;
    case 'dismiss':
      // Just close the notification, mark as read
      markNotificationAsRead(data.notification_id);
      return;
    default:
      // Open the default URL
      break;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  const data = event.notification.data || {};
  if (data.notification_id) {
    markNotificationAsRead(data.notification_id);
  }
});

// Mark notification as read (send to server)
async function markNotificationAsRead(notificationId) {
  if (!notificationId) return;
  
  try {
    const token = await getStoredToken();
    if (!token) return;
    
    // We can't directly call the API from service worker without the token
    // Instead, we'll message the client to do it
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'MARK_NOTIFICATION_READ',
        notification_id: notificationId
      });
    });
  } catch (e) {
    console.error('[SW] Failed to mark notification as read:', e);
  }
}

// Get stored token from IndexedDB (service workers can't access localStorage)
async function getStoredToken() {
  // Service workers need to communicate with the main thread for token
  return null;
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data.type);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
