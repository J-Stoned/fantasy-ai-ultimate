/**
 * 🔥 Firebase Cloud Messaging Service - Elite Push Notification System
 * 
 * Enterprise-grade push notification infrastructure with:
 * - Real-time lineup alerts
 * - DFS contest notifications
 * - Injury updates & breaking news
 * - Smart notification batching
 * - User preference management
 * - Analytics tracking
 * 
 * @version 2025.1.0
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getMessaging, 
  getToken, 
  onMessage, 
  Messaging,
  MessagePayload,
  deleteToken
} from 'firebase/messaging';
import { 
  getAnalytics, 
  Analytics, 
  logEvent 
} from 'firebase/analytics';
import { logger } from '../../logging/logger';
import { supabase } from '../../supabase/client';

// Notification Types
export enum NotificationType {
  LINEUP_ALERT = 'lineup_alert',
  PLAYER_NEWS = 'player_news',
  INJURY_UPDATE = 'injury_update',
  DFS_CONTEST = 'dfs_contest',
  TRADE_ACTIVITY = 'trade_activity',
  PRICE_CHANGE = 'price_change',
  GAME_START = 'game_start',
  RESULTS = 'results',
  SYSTEM = 'system'
}

// Notification Priority Levels
export enum NotificationPriority {
  CRITICAL = 'critical',  // Immediate delivery
  HIGH = 'high',         // Within 5 minutes
  NORMAL = 'normal',     // Within 30 minutes
  LOW = 'low'           // Batched delivery
}

// User Notification Preferences
export interface NotificationPreferences {
  userId: string;
  enabled: boolean;
  categories: {
    [key in NotificationType]: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  deliveryPreferences: {
    bundleNotifications: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };
}

// Notification Payload
export interface NotificationPayload {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
  timestamp: Date;
}

// Notification Action
export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// FCM Configuration
const FCM_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!
};

// Service Worker Registration
const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

/**
 * Elite Firebase Cloud Messaging Service
 */
export class FCMNotificationService {
  private static instance: FCMNotificationService;
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private analytics: Analytics | null = null;
  private token: string | null = null;
  private messageHandlers: Map<string, (payload: MessagePayload) => void> = new Map();
  private notificationQueue: NotificationPayload[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): FCMNotificationService {
    if (!FCMNotificationService.instance) {
      FCMNotificationService.instance = new FCMNotificationService();
    }
    return FCMNotificationService.instance;
  }

  /**
   * Initialize Firebase and request notification permission
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if running in browser
      if (typeof window === 'undefined') {
        logger.warn('FCM can only be initialized in browser environment');
        return false;
      }

      // Initialize Firebase app
      this.app = initializeApp(FCM_CONFIG);
      this.messaging = getMessaging(this.app);
      this.analytics = getAnalytics(this.app);

      // Register service worker
      await this.registerServiceWorker();

      // Request notification permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        logger.warn('Notification permission denied');
        return false;
      }

      // Get FCM token
      await this.retrieveToken();

      // Set up message listener
      this.setupMessageListener();

      // Log initialization
      logEvent(this.analytics, 'fcm_initialized', {
        token_retrieved: !!this.token,
        permission_granted: true
      });

      logger.info('FCM service initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize FCM:', error);
      return false;
    }
  }

  /**
   * Register Firebase service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
        logger.info('Service Worker registered:', registration);
      } catch (error) {
        logger.error('Service Worker registration failed:', error);
        throw error;
      }
    }
  }

  /**
   * Request notification permission
   */
  private async requestPermission(): Promise<NotificationPermission> {
    try {
      const permission = await Notification.requestPermission();
      
      // Track permission result
      if (this.analytics) {
        logEvent(this.analytics, 'notification_permission', {
          result: permission
        });
      }

      return permission;
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Retrieve FCM token
   */
  private async retrieveToken(): Promise<string | null> {
    if (!this.messaging) return null;

    try {
      const currentToken = await getToken(this.messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });

      if (currentToken) {
        this.token = currentToken;
        await this.saveTokenToDatabase(currentToken);
        logger.info('FCM token retrieved successfully');
        return currentToken;
      } else {
        logger.warn('No FCM token available');
        return null;
      }
    } catch (error) {
      logger.error('Error retrieving FCM token:', error);
      return null;
    }
  }

  /**
   * Save FCM token to database
   */
  private async saveTokenToDatabase(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('fcm_tokens')
        .upsert({
          user_id: user.id,
          token: token,
          device_info: this.getDeviceInfo(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,token'
        });

      if (error) throw error;

      logger.info('FCM token saved to database');
    } catch (error) {
      logger.error('Failed to save FCM token:', error);
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): Record<string, any> {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Set up foreground message listener
   */
  private setupMessageListener(): void {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      logger.info('Received foreground message:', payload);
      
      // Track message received
      if (this.analytics) {
        logEvent(this.analytics, 'notification_received', {
          message_id: payload.messageId,
          notification_type: payload.data?.type || 'unknown'
        });
      }

      // Process message based on type
      this.handleIncomingMessage(payload);

      // Execute registered handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          logger.error('Message handler error:', error);
        }
      });
    });
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(payload: MessagePayload): Promise<void> {
    const { notification, data } = payload;

    if (!notification) return;

    // Check user preferences
    const preferences = await this.getUserPreferences();
    if (!preferences?.enabled) return;

    // Check notification type preference
    const notificationType = data?.type as NotificationType;
    if (notificationType && !preferences.categories[notificationType]) {
      logger.info(`Notification type ${notificationType} disabled by user`);
      return;
    }

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      logger.info('Notification blocked due to quiet hours');
      return;
    }

    // Display notification
    await this.displayNotification({
      id: payload.messageId || Date.now().toString(),
      type: notificationType || NotificationType.SYSTEM,
      priority: data?.priority as NotificationPriority || NotificationPriority.NORMAL,
      title: notification.title || 'Fantasy AI Update',
      body: notification.body || '',
      data: data,
      icon: notification.icon,
      image: notification.image,
      timestamp: new Date()
    });
  }

  /**
   * Display notification to user
   */
  private async displayNotification(payload: NotificationPayload): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;

      const options: NotificationOptions = {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        image: payload.image,
        tag: payload.tag || payload.type,
        requireInteraction: payload.requireInteraction || false,
        data: payload.data,
        actions: payload.actions,
        vibrate: [200, 100, 200],
        timestamp: payload.timestamp.getTime()
      };

      await registration.showNotification(payload.title, options);

      // Track notification displayed
      if (this.analytics) {
        logEvent(this.analytics, 'notification_displayed', {
          notification_id: payload.id,
          notification_type: payload.type,
          priority: payload.priority
        });
      }
    } catch (error) {
      logger.error('Failed to display notification:', error);
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(): Promise<NotificationPreferences | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return data as NotificationPreferences;
    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      return null;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Send notification to specific user
   */
  async sendToUser(userId: string, notification: Omit<NotificationPayload, 'id' | 'timestamp'>): Promise<boolean> {
    try {
      // Get user's FCM tokens
      const { data: tokens, error } = await supabase
        .from('fcm_tokens')
        .select('token')
        .eq('user_id', userId);

      if (error) throw error;
      if (!tokens || tokens.length === 0) {
        logger.warn(`No FCM tokens found for user ${userId}`);
        return false;
      }

      // Send notification via API
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokens: tokens.map(t => t.token),
          notification: {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date()
          }
        })
      });

      if (!response.ok) throw new Error('Failed to send notification');

      // Track notification sent
      if (this.analytics) {
        logEvent(this.analytics, 'notification_sent', {
          user_id: userId,
          notification_type: notification.type,
          priority: notification.priority
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Send notification to topic subscribers
   */
  async sendToTopic(topic: string, notification: Omit<NotificationPayload, 'id' | 'timestamp'>): Promise<boolean> {
    try {
      const response = await fetch('/api/notifications/send-topic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic,
          notification: {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date()
          }
        })
      });

      if (!response.ok) throw new Error('Failed to send topic notification');

      return true;
    } catch (error) {
      logger.error('Failed to send topic notification:', error);
      return false;
    }
  }

  /**
   * Subscribe to topic
   */
  async subscribeToTopic(topic: string): Promise<boolean> {
    if (!this.token) {
      logger.warn('No FCM token available for topic subscription');
      return false;
    }

    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: this.token,
          topic
        })
      });

      if (!response.ok) throw new Error('Failed to subscribe to topic');

      logger.info(`Subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error('Failed to subscribe to topic:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribeFromTopic(topic: string): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: this.token,
          topic
        })
      });

      if (!response.ok) throw new Error('Failed to unsubscribe from topic');

      logger.info(`Unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe from topic:', error);
      return false;
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      logger.info('Notification preferences updated');
      return true;
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      return false;
    }
  }

  /**
   * Queue notification for batch sending
   */
  queueNotification(notification: NotificationPayload): void {
    if (notification.priority === NotificationPriority.CRITICAL) {
      // Send critical notifications immediately
      this.sendImmediately(notification);
      return;
    }

    this.notificationQueue.push(notification);

    // Set up batch timer if not already running
    if (!this.batchTimer) {
      const delay = this.getBatchDelay(notification.priority);
      this.batchTimer = setTimeout(() => this.processBatch(), delay);
    }
  }

  /**
   * Get batch delay based on priority
   */
  private getBatchDelay(priority: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.HIGH:
        return 5 * 60 * 1000; // 5 minutes
      case NotificationPriority.NORMAL:
        return 30 * 60 * 1000; // 30 minutes
      case NotificationPriority.LOW:
        return 60 * 60 * 1000; // 1 hour
      default:
        return 30 * 60 * 1000;
    }
  }

  /**
   * Process notification batch
   */
  private async processBatch(): Promise<void> {
    if (this.notificationQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    const batch = [...this.notificationQueue];
    this.notificationQueue = [];
    this.batchTimer = null;

    try {
      // Group notifications by user
      const userGroups = this.groupNotificationsByUser(batch);

      // Send bundled notifications
      for (const [userId, notifications] of userGroups.entries()) {
        await this.sendBundledNotification(userId, notifications);
      }
    } catch (error) {
      logger.error('Failed to process notification batch:', error);
    }
  }

  /**
   * Group notifications by user
   */
  private groupNotificationsByUser(notifications: NotificationPayload[]): Map<string, NotificationPayload[]> {
    const groups = new Map<string, NotificationPayload[]>();

    notifications.forEach(notification => {
      const userId = notification.data?.userId;
      if (!userId) return;

      if (!groups.has(userId)) {
        groups.set(userId, []);
      }
      groups.get(userId)!.push(notification);
    });

    return groups;
  }

  /**
   * Send bundled notification
   */
  private async sendBundledNotification(userId: string, notifications: NotificationPayload[]): Promise<void> {
    if (notifications.length === 1) {
      await this.sendToUser(userId, notifications[0]);
      return;
    }

    // Create summary notification
    const summary: Omit<NotificationPayload, 'id' | 'timestamp'> = {
      type: NotificationType.SYSTEM,
      priority: Math.max(...notifications.map(n => this.getPriorityValue(n.priority))) as any,
      title: `${notifications.length} new updates`,
      body: this.createSummaryBody(notifications),
      data: {
        userId,
        bundled: true,
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title
        }))
      }
    };

    await this.sendToUser(userId, summary);
  }

  /**
   * Get numeric priority value
   */
  private getPriorityValue(priority: NotificationPriority): number {
    const values = {
      [NotificationPriority.CRITICAL]: 4,
      [NotificationPriority.HIGH]: 3,
      [NotificationPriority.NORMAL]: 2,
      [NotificationPriority.LOW]: 1
    };
    return values[priority] || 2;
  }

  /**
   * Create summary body for bundled notifications
   */
  private createSummaryBody(notifications: NotificationPayload[]): string {
    const typeCount = notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationType, number>);

    const summaries = Object.entries(typeCount)
      .map(([type, count]) => {
        switch (type) {
          case NotificationType.LINEUP_ALERT:
            return `${count} lineup alert${count > 1 ? 's' : ''}`;
          case NotificationType.PLAYER_NEWS:
            return `${count} player update${count > 1 ? 's' : ''}`;
          case NotificationType.INJURY_UPDATE:
            return `${count} injury update${count > 1 ? 's' : ''}`;
          case NotificationType.DFS_CONTEST:
            return `${count} contest notification${count > 1 ? 's' : ''}`;
          default:
            return `${count} update${count > 1 ? 's' : ''}`;
        }
      });

    return summaries.join(', ');
  }

  /**
   * Send notification immediately
   */
  private async sendImmediately(notification: NotificationPayload): Promise<void> {
    const userId = notification.data?.userId;
    if (!userId) return;

    await this.sendToUser(userId, notification);
  }

  /**
   * Register message handler
   */
  registerMessageHandler(id: string, handler: (payload: MessagePayload) => void): void {
    this.messageHandlers.set(id, handler);
  }

  /**
   * Unregister message handler
   */
  unregisterMessageHandler(id: string): void {
    this.messageHandlers.delete(id);
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Delete FCM token
   */
  async deleteToken(): Promise<boolean> {
    if (!this.messaging || !this.token) return false;

    try {
      await deleteToken(this.messaging);
      
      // Remove from database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('fcm_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('token', this.token);
      }

      this.token = null;
      logger.info('FCM token deleted');
      return true;
    } catch (error) {
      logger.error('Failed to delete FCM token:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.messageHandlers.clear();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.notificationQueue = [];
  }
}

// Export singleton instance
export const fcmService = FCMNotificationService.getInstance();