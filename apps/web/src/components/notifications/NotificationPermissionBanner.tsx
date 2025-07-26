'use client';

import { useState, useEffect } from 'react';
import { X, Bell, BellOff } from 'lucide-react';
import { fcmService, NotificationPermission } from '@/lib/services/notifications/fcm-service';
import { useUser } from '@supabase/auth-helpers-react';
import { logger } from '@/lib/logging/logger';

export function NotificationPermissionBanner() {
  const user = useUser();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check current permission status
    const checkPermission = async () => {
      const currentPermission = await fcmService.getPermissionStatus();
      setPermission(currentPermission);
      
      // Show banner if not yet asked
      if (currentPermission === 'default' && user) {
        setShowBanner(true);
      }
    };

    checkPermission();
  }, [user]);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const newPermission = await fcmService.requestPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        // Subscribe to default topics
        await fcmService.subscribeToTopic('general');
        await fcmService.subscribeToTopic('nfl_updates');
        
        logger.info('Notifications enabled successfully');
        setShowBanner(false);
      }
    } catch (error) {
      logger.error('Failed to enable notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Store dismissal in local storage
    localStorage.setItem('notification_banner_dismissed', 'true');
  };

  // Don't show if already dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('notification_banner_dismissed');
    if (dismissed === 'true') {
      setShowBanner(false);
    }
  }, []);

  if (!showBanner || permission === 'granted') {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-lg mb-6 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <Bell className="w-6 h-6 mt-1" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">
            Stay Updated with Real-Time Alerts
          </h3>
          <p className="text-white/90 mb-4">
            Get instant notifications for player injuries, lineup locks, trade updates, and more. 
            Never miss a critical fantasy decision again!
          </p>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleEnable}
              disabled={isLoading || permission === 'denied'}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                permission === 'denied'
                  ? 'bg-white/20 text-white/60 cursor-not-allowed'
                  : 'bg-white text-purple-600 hover:bg-white/90'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></span>
                  Enabling...
                </span>
              ) : permission === 'denied' ? (
                <span className="flex items-center">
                  <BellOff className="w-4 h-4 mr-2" />
                  Blocked by Browser
                </span>
              ) : (
                <span className="flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Enable Notifications
                </span>
              )}
            </button>
            
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg font-medium bg-white/20 hover:bg-white/30 transition-colors"
            >
              Maybe Later
            </button>
          </div>
          
          {permission === 'denied' && (
            <p className="text-sm text-white/80 mt-3">
              You've blocked notifications. To enable them, click the lock icon in your browser's address bar and allow notifications.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}