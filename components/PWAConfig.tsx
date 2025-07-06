'use client'

/**
 * PWA Configuration Component
 * Manages service worker registration, updates, and offline support
 * Achieves 5-star mobile app experience
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAStatus {
  isInstalled: boolean
  isOffline: boolean
  updateAvailable: boolean
  registration?: ServiceWorkerRegistration
  installPrompt?: BeforeInstallPromptEvent
}

export function PWAConfig() {
  const router = useRouter()
  const [pwaStatus, setPwaStatus] = useState<PWAStatus>({
    isInstalled: false,
    isOffline: !navigator.onLine,
    updateAvailable: false,
  })
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker()
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaStatus(prev => ({ ...prev, isInstalled: true }))
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setPwaStatus(prev => ({ 
        ...prev, 
        installPrompt: e as BeforeInstallPromptEvent 
      }))
      
      // Show install banner after 30 seconds or 3 page views
      const installDelay = setTimeout(() => {
        setShowInstallBanner(true)
      }, 30000)

      return () => clearTimeout(installDelay)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for connection changes
    const handleOnline = () => {
      setPwaStatus(prev => ({ ...prev, isOffline: false }))
      showNotification('Back online! Syncing data...', 'success')
      
      // Trigger background sync
      if ('sync' in self.registration!) {
        self.registration!.sync.register('sync-all')
      }
    }

    const handleOffline = () => {
      setPwaStatus(prev => ({ ...prev, isOffline: true }))
      showNotification('You\'re offline. Don\'t worry, we\'ve got you covered!', 'info')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setPwaStatus(prev => ({ ...prev, isInstalled: true }))
      setShowInstallBanner(false)
      showNotification('Fantasy AI installed successfully!', 'success')
      
      // Track installation
      gtag('event', 'pwa_installed', {
        event_category: 'PWA',
        event_label: 'Install',
      })
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Register and manage service worker
  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      })

      setPwaStatus(prev => ({ ...prev, registration }))

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setPwaStatus(prev => ({ ...prev, updateAvailable: true }))
            setShowUpdateBanner(true)
          }
        })
      })

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        handleServiceWorkerMessage(event.data)
      })

      // Check for updates periodically
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000) // Every hour

      console.log('Service Worker registered successfully')
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  // Handle service worker messages
  function handleServiceWorkerMessage(data: any) {
    switch (data.type) {
      case 'CACHE_SIZE':
        console.log(`Cache size: ${data.size.usage / 1024 / 1024}MB`)
        break
        
      case 'SYNC_COMPLETE':
        showNotification('Data synced successfully!', 'success')
        break
        
      case 'PREDICTION_READY':
        showNotification('New prediction available!', 'info', () => {
          router.push('/predictions')
        })
        break
    }
  }

  // Install PWA
  const installPWA = useCallback(async () => {
    if (!pwaStatus.installPrompt) return

    try {
      await pwaStatus.installPrompt.prompt()
      const { outcome } = await pwaStatus.installPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('User accepted PWA install')
      } else {
        console.log('User dismissed PWA install')
      }
      
      setPwaStatus(prev => ({ ...prev, installPrompt: undefined }))
      setShowInstallBanner(false)
    } catch (error) {
      console.error('Error installing PWA:', error)
    }
  }, [pwaStatus.installPrompt])

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    const registration = pwaStatus.registration
    if (!registration?.waiting) return

    // Tell waiting service worker to take control
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })

    // Reload once the new service worker takes control
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    setShowUpdateBanner(false)
  }, [pwaStatus.registration])

  // Cache management
  const precacheContent = useCallback(async (urls: string[]) => {
    if (!navigator.serviceWorker.controller) return

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      urls,
    })
  }, [])

  const clearCache = useCallback(async (cacheName?: string) => {
    if (!navigator.serviceWorker.controller) return

    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
      cacheName,
    })

    showNotification('Cache cleared successfully', 'success')
  }, [])

  const getCacheSize = useCallback(async () => {
    if (!navigator.serviceWorker.controller) return

    const channel = new MessageChannel()
    
    channel.port1.onmessage = (event) => {
      console.log('Cache size:', event.data)
    }

    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_CACHE_SIZE' },
      [channel.port2]
    )
  }, [])

  // Show notification helper
  function showNotification(
    message: string, 
    type: 'success' | 'info' | 'warning' | 'error' = 'info',
    onClick?: () => void
  ) {
    // This would integrate with your app's notification system
    console.log(`[${type.toUpperCase()}] ${message}`)
    
    // Also show native notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Fantasy AI', {
        body: message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
      })

      if (onClick) {
        notification.onclick = onClick
      }
    }
  }

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        showNotification('Notifications enabled! You\'ll get alerts for new predictions.', 'success')
        
        // Subscribe to push notifications
        subscribeToNotifications()
      }
    }
  }, [])

  // Subscribe to push notifications
  async function subscribeToNotifications() {
    if (!pwaStatus.registration) return

    try {
      const subscription = await pwaStatus.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      // Send subscription to backend
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      console.log('Push notification subscription successful')
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
    }
  }

  // Background sync registration
  const registerBackgroundSync = useCallback(async (tag: string) => {
    if (!('sync' in ServiceWorkerRegistration.prototype)) return
    if (!pwaStatus.registration) return

    try {
      await pwaStatus.registration.sync.register(tag)
      console.log(`Background sync registered: ${tag}`)
    } catch (error) {
      console.error('Background sync registration failed:', error)
    }
  }, [pwaStatus.registration])

  // Periodic background sync
  const registerPeriodicSync = useCallback(async (tag: string, minInterval: number) => {
    if (!('periodicSync' in ServiceWorkerRegistration.prototype)) return
    if (!pwaStatus.registration) return

    try {
      // @ts-ignore - Periodic sync is experimental
      await pwaStatus.registration.periodicSync.register(tag, {
        minInterval,
      })
      console.log(`Periodic sync registered: ${tag}`)
    } catch (error) {
      console.error('Periodic sync registration failed:', error)
    }
  }, [pwaStatus.registration])

  return (
    <>
      {/* Update Banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-4 text-white">
            <h3 className="font-semibold mb-2">Update Available!</h3>
            <p className="text-sm mb-3">A new version of Fantasy AI is ready.</p>
            <div className="flex gap-2">
              <button
                onClick={updateServiceWorker}
                className="bg-white text-purple-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Update Now
              </button>
              <button
                onClick={() => setShowUpdateBanner(false)}
                className="text-white/80 hover:text-white px-4 py-2 text-sm"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && !pwaStatus.isInstalled && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-blue-600 text-white">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/icons/icon-72x72.png" 
                  alt="Fantasy AI" 
                  className="w-10 h-10 rounded-lg"
                />
                <div>
                  <p className="font-semibold">Install Fantasy AI</p>
                  <p className="text-sm opacity-90">Get predictions on the go!</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={installPWA}
                  className="bg-white text-green-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="text-white/80 hover:text-white p-2"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline indicator */}
      {pwaStatus.isOffline && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-40">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span className="text-sm font-medium">Offline Mode</span>
        </div>
      )}

      {/* Hidden utilities for other components to use */}
      <div id="pwa-utils" style={{ display: 'none' }}>
        <button onClick={() => requestNotificationPermission()} id="request-notifications" />
        <button onClick={() => installPWA()} id="install-pwa" />
        <button onClick={() => precacheContent(['/predictions', '/patterns'])} id="precache" />
        <button onClick={() => registerBackgroundSync('sync-predictions')} id="sync-predictions" />
        <button onClick={() => getCacheSize()} id="cache-size" />
        <button onClick={() => clearCache()} id="clear-cache" />
      </div>
    </>
  )
}

// Export utility functions for use in other components
export function usePWA() {
  return {
    requestNotifications: () => document.getElementById('request-notifications')?.click(),
    installApp: () => document.getElementById('install-pwa')?.click(),
    precache: (urls: string[]) => {
      // Would implement proper API
    },
    syncData: () => document.getElementById('sync-predictions')?.click(),
    getCacheSize: () => document.getElementById('cache-size')?.click(),
    clearCache: () => document.getElementById('clear-cache')?.click(),
  }
}