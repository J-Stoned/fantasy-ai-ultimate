/**
 * 🔥 useNotifications Hook - Elite Notification Management
 * 
 * React hook for managing push notifications with:
 * - Auto-initialization
 * - Permission handling
 * - Topic management
 * - Real-time updates
 * - Preference persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { MessagePayload } from 'firebase/messaging';
import { 
  fcmService, 
  NotificationType, 
  NotificationPriority,
  NotificationPreferences,
  NotificationPayload
} from '../lib/services/notifications/fcm-service';
import { useToast } from './useToast';
import { logger } from '../lib/logging/logger';

// Hook state interface
interface NotificationState {
  isInitialized: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
  preferences: NotificationPreferences | null;
  subscriptions: {
    sports: string[];
    teams: string[];
    players: string[];
    contests: string[];
    alerts: string[];
    dfs: string[];
  };
  isLoading: boolean;
  error: Error | null;
}

// Hook return interface
interface UseNotificationsReturn extends NotificationState {
  // Actions
  requestPermission: () => Promise<boolean>;
  subscribeToTopic: (topic: string) => Promise<boolean>;
  unsubscribeFromTopic: (topic: string) => Promise<boolean>;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  
  // Player/Team subscriptions
  subscribeToPlayer: (playerId: string, playerName: string) => Promise<boolean>;
  unsubscribeFromPlayer: (playerId: string) => Promise<boolean>;
  subscribeToTeam: (teamId: string, teamName: string) => Promise<boolean>;
  unsubscribeFromTeam: (teamId: string) => Promise<boolean>;
  
  // Sport subscriptions
  subscribeToSport: (sport: 'nfl' | 'nba' | 'mlb' | 'nhl') => Promise<boolean>;
  unsubscribeFromSport: (sport: 'nfl' | 'nba' | 'mlb' | 'nhl') => Promise<boolean>;
  
  // Alert subscriptions
  subscribeToAlerts: (type: 'injuries' | 'news' | 'lineups' | 'weather') => Promise<boolean>;
  unsubscribeFromAlerts: (type: 'injuries' | 'news' | 'lineups' | 'weather') => Promise<boolean>;
}

/**
 * Elite notification management hook
 */
export function useNotifications(): UseNotificationsReturn {
  const supabase = useSupabaseClient();
  const user = useUser();
  const { toast } = useToast();
  
  // State
  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    isSupported: false,
    permission: 'default',
    token: null,
    preferences: null,
    subscriptions: {
      sports: [],
      teams: [],
      players: [],
      contests: [],
      alerts: [],
      dfs: []
    },
    isLoading: true,
    error: null
  });

  /**
   * Initialize FCM service
   */
  const initializeService = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check if notifications are supported
      const isSupported = 'Notification' in window && 
                         'serviceWorker' in navigator && 
                         'PushManager' in window;

      if (!isSupported) {
        setState(prev => ({ 
          ...prev, 
          isSupported: false, 
          isLoading: false 
        }));
        return;
      }

      // Initialize FCM
      const initialized = await fcmService.initialize();
      
      if (initialized) {
        const token = fcmService.getToken();
        const permission = Notification.permission;
        
        // Load user preferences
        if (user) {
          const [prefs, subs] = await Promise.all([
            loadUserPreferences(user.id),
            loadUserSubscriptions(user.id)
          ]);
          
          setState(prev => ({
            ...prev,
            isInitialized: true,
            isSupported: true,
            permission,
            token,
            preferences: prefs,
            subscriptions: subs,
            isLoading: false
          }));
        } else {
          setState(prev => ({
            ...prev,
            isInitialized: true,
            isSupported: true,
            permission,
            token,
            isLoading: false
          }));
        }

        // Register message handler
        fcmService.registerMessageHandler('app', handleIncomingMessage);
      } else {
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isSupported: true,
          permission: Notification.permission,
          isLoading: false
        }));
      }
    } catch (error) {
      logger.error('Failed to initialize notifications:', error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        isLoading: false
      }));
    }
  }, [user]);

  /**
   * Load user preferences
   */
  const loadUserPreferences = async (userId: string): Promise<NotificationPreferences | null> => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Create default preferences if not found
        if (error.code === 'PGRST116') {
          return createDefaultPreferences(userId);
        }
        throw error;
      }

      return data as NotificationPreferences;
    } catch (error) {
      logger.error('Failed to load preferences:', error);
      return null;
    }
  };

  /**
   * Create default preferences
   */
  const createDefaultPreferences = async (userId: string): Promise<NotificationPreferences> => {
    const defaults: NotificationPreferences = {
      userId,
      enabled: true,
      categories: {
        [NotificationType.LINEUP_ALERT]: true,
        [NotificationType.PLAYER_NEWS]: true,
        [NotificationType.INJURY_UPDATE]: true,
        [NotificationType.DFS_CONTEST]: true,
        [NotificationType.TRADE_ACTIVITY]: true,
        [NotificationType.PRICE_CHANGE]: true,
        [NotificationType.GAME_START]: true,
        [NotificationType.RESULTS]: true,
        [NotificationType.SYSTEM]: true
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      deliveryPreferences: {
        bundleNotifications: false,
        soundEnabled: true,
        vibrationEnabled: true
      }
    };

    await fcmService.updatePreferences(defaults);
    return defaults;
  };

  /**
   * Load user subscriptions
   */
  const loadUserSubscriptions = async (userId: string) => {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load subscriptions');

      const data = await response.json();
      return data.subscriptions;
    } catch (error) {
      logger.error('Failed to load subscriptions:', error);
      return {
        sports: [],
        teams: [],
        players: [],
        contests: [],
        alerts: [],
        dfs: []
      };
    }
  };

  /**
   * Handle incoming messages
   */
  const handleIncomingMessage = useCallback((payload: MessagePayload) => {
    const { notification, data } = payload;
    
    if (!notification) return;

    // Show toast notification
    toast({
      title: notification.title || 'Update',
      description: notification.body || '',
      variant: data?.priority === 'critical' ? 'destructive' : 'default',
      duration: data?.priority === 'critical' ? 10000 : 5000,
      action: data?.deepLink ? {
        label: 'View',
        onClick: () => window.location.href = data.deepLink
      } : undefined
    });

    // Play sound for critical notifications
    if (data?.priority === 'critical' && state.preferences?.deliveryPreferences.soundEnabled) {
      playNotificationSound();
    }
  }, [toast, state.preferences]);

  /**
   * Play notification sound
   */
  const playNotificationSound = () => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(e => logger.error('Failed to play sound:', e));
  };

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Re-initialize to get token
        await initializeService();
        
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications',
          variant: 'success'
        });
        
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          permission,
          isLoading: false 
        }));
        
        toast({
          title: 'Notifications Blocked',
          description: 'You can enable notifications in your browser settings',
          variant: 'warning'
        });
        
        return false;
      }
    } catch (error) {
      logger.error('Failed to request permission:', error);
      setState(prev => ({ 
        ...prev, 
        error: error as Error,
        isLoading: false 
      }));
      return false;
    }
  }, [initializeService, toast]);

  /**
   * Subscribe to topic
   */
  const subscribeToTopic = useCallback(async (topic: string): Promise<boolean> => {
    try {
      const success = await fcmService.subscribeToTopic(topic);
      
      if (success) {
        // Reload subscriptions
        if (user) {
          const subs = await loadUserSubscriptions(user.id);
          setState(prev => ({ ...prev, subscriptions: subs }));
        }
        
        toast({
          title: 'Subscribed',
          description: `You will receive updates for ${topic}`,
          variant: 'success'
        });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to subscribe to topic:', error);
      toast({
        title: 'Subscription Failed',
        description: 'Please try again later',
        variant: 'error'
      });
      return false;
    }
  }, [user, toast]);

  /**
   * Unsubscribe from topic
   */
  const unsubscribeFromTopic = useCallback(async (topic: string): Promise<boolean> => {
    try {
      const success = await fcmService.unsubscribeFromTopic(topic);
      
      if (success) {
        // Reload subscriptions
        if (user) {
          const subs = await loadUserSubscriptions(user.id);
          setState(prev => ({ ...prev, subscriptions: subs }));
        }
        
        toast({
          title: 'Unsubscribed',
          description: `You will no longer receive updates for ${topic}`,
          variant: 'default'
        });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to unsubscribe from topic:', error);
      return false;
    }
  }, [user, toast]);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(async (
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> => {
    try {
      const success = await fcmService.updatePreferences(preferences);
      
      if (success && user) {
        const prefs = await loadUserPreferences(user.id);
        setState(prev => ({ ...prev, preferences: prefs }));
        
        toast({
          title: 'Preferences Updated',
          description: 'Your notification settings have been saved',
          variant: 'success'
        });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      toast({
        title: 'Update Failed',
        description: 'Please try again later',
        variant: 'error'
      });
      return false;
    }
  }, [user, toast]);

  /**
   * Subscribe to player
   */
  const subscribeToPlayer = useCallback(async (
    playerId: string, 
    playerName: string
  ): Promise<boolean> => {
    const topic = `player_${playerId}`;
    const success = await subscribeToTopic(topic);
    
    if (success) {
      // Track player subscription
      try {
        await supabase
          .from('player_subscriptions')
          .upsert({
            user_id: user?.id,
            player_id: playerId,
            player_name: playerName,
            subscribed_at: new Date().toISOString()
          });
      } catch (error) {
        logger.error('Failed to track player subscription:', error);
      }
    }
    
    return success;
  }, [subscribeToTopic, supabase, user]);

  /**
   * Unsubscribe from player
   */
  const unsubscribeFromPlayer = useCallback(async (playerId: string): Promise<boolean> => {
    const topic = `player_${playerId}`;
    const success = await unsubscribeFromTopic(topic);
    
    if (success && user) {
      // Remove player subscription
      try {
        await supabase
          .from('player_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('player_id', playerId);
      } catch (error) {
        logger.error('Failed to remove player subscription:', error);
      }
    }
    
    return success;
  }, [unsubscribeFromTopic, supabase, user]);

  /**
   * Subscribe to team
   */
  const subscribeToTeam = useCallback(async (
    teamId: string, 
    teamName: string
  ): Promise<boolean> => {
    const topic = `team_${teamId}`;
    const success = await subscribeToTopic(topic);
    
    if (success) {
      // Track team subscription
      try {
        await supabase
          .from('team_subscriptions')
          .upsert({
            user_id: user?.id,
            team_id: teamId,
            team_name: teamName,
            subscribed_at: new Date().toISOString()
          });
      } catch (error) {
        logger.error('Failed to track team subscription:', error);
      }
    }
    
    return success;
  }, [subscribeToTopic, supabase, user]);

  /**
   * Unsubscribe from team
   */
  const unsubscribeFromTeam = useCallback(async (teamId: string): Promise<boolean> => {
    const topic = `team_${teamId}`;
    return unsubscribeFromTopic(topic);
  }, [unsubscribeFromTopic]);

  /**
   * Subscribe to sport
   */
  const subscribeToSport = useCallback(async (
    sport: 'nfl' | 'nba' | 'mlb' | 'nhl'
  ): Promise<boolean> => {
    const topic = `sport_${sport}`;
    return subscribeToTopic(topic);
  }, [subscribeToTopic]);

  /**
   * Unsubscribe from sport
   */
  const unsubscribeFromSport = useCallback(async (
    sport: 'nfl' | 'nba' | 'mlb' | 'nhl'
  ): Promise<boolean> => {
    const topic = `sport_${sport}`;
    return unsubscribeFromTopic(topic);
  }, [unsubscribeFromTopic]);

  /**
   * Subscribe to alerts
   */
  const subscribeToAlerts = useCallback(async (
    type: 'injuries' | 'news' | 'lineups' | 'weather'
  ): Promise<boolean> => {
    const topic = `alerts_${type}`;
    return subscribeToTopic(topic);
  }, [subscribeToTopic]);

  /**
   * Unsubscribe from alerts
   */
  const unsubscribeFromAlerts = useCallback(async (
    type: 'injuries' | 'news' | 'lineups' | 'weather'
  ): Promise<boolean> => {
    const topic = `alerts_${type}`;
    return unsubscribeFromTopic(topic);
  }, [unsubscribeFromTopic]);

  /**
   * Send test notification
   */
  const sendTestNotification = useCallback(async () => {
    if (!user) return;

    try {
      await fcmService.sendToUser(user.id, {
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.NORMAL,
        title: 'Test Notification',
        body: 'This is a test notification from Fantasy AI Ultimate!',
        data: {
          test: true,
          timestamp: Date.now()
        }
      });

      toast({
        title: 'Test Sent',
        description: 'Check your notifications!',
        variant: 'success'
      });
    } catch (error) {
      logger.error('Failed to send test notification:', error);
      toast({
        title: 'Test Failed',
        description: 'Could not send test notification',
        variant: 'error'
      });
    }
  }, [user, toast]);

  // Initialize on mount
  useEffect(() => {
    initializeService();
    
    return () => {
      fcmService.unregisterMessageHandler('app');
    };
  }, [initializeService]);

  // Re-initialize when user changes
  useEffect(() => {
    if (user) {
      initializeService();
    }
  }, [user, initializeService]);

  return {
    ...state,
    requestPermission,
    subscribeToTopic,
    unsubscribeFromTopic,
    updatePreferences,
    sendTestNotification,
    subscribeToPlayer,
    unsubscribeFromPlayer,
    subscribeToTeam,
    unsubscribeFromTeam,
    subscribeToSport,
    unsubscribeFromSport,
    subscribeToAlerts,
    unsubscribeFromAlerts
  };
}