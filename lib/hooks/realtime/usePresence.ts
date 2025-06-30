import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabase/client-browser';
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { useAuth } from '../useAuth';
import { defaultLogger } from '../../utils/logger';

interface UserPresence {
  user_id: string;
  username: string;
  avatar_url?: string;
  status: 'online' | 'away' | 'offline';
  last_seen: string;
  current_page?: string;
  fantasy_team_id?: string;
}

interface UsePresenceOptions {
  channelName: string;
  initialStatus?: 'online' | 'away';
}

export function usePresence({ 
  channelName, 
  initialStatus = 'online' 
}: UsePresenceOptions) {
  const { user } = useAuth();
  const [presenceState, setPresenceState] = useState<Record<string, UserPresence[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const setupPresence = async () => {
      // Get user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('user_id', user.id)
        .single();

      const userPresence: UserPresence = {
        user_id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
        avatar_url: profile?.avatar_url,
        status: initialStatus,
        last_seen: new Date().toISOString(),
        current_page: window.location.pathname,
      };

      // Create presence channel
      channelRef.current = supabase.channel(channelName, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Subscribe to presence updates
      channelRef.current
        .on('presence', { event: 'sync' }, () => {
          const state = channelRef.current?.presenceState();
          if (state) {
            setPresenceState(state);
            
            // Flatten all users into single array
            const allUsers = Object.values(state).flat() as UserPresence[];
            setOnlineUsers(allUsers);
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          defaultLogger.debug('User joined presence channel', { key, newPresences });
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          defaultLogger.debug('User left presence channel', { key, leftPresences });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Track initial presence
            await channelRef.current?.track(userPresence);
            defaultLogger.info('Presence tracking active', { channelName });

            // Update presence every 30 seconds
            trackIntervalRef.current = setInterval(async () => {
              await channelRef.current?.track({
                ...userPresence,
                last_seen: new Date().toISOString(),
                current_page: window.location.pathname,
              });
            }, 30000);
          }
        });
    };

    setupPresence();

    // Cleanup
    return () => {
      if (trackIntervalRef.current) {
        clearInterval(trackIntervalRef.current);
      }
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, channelName, initialStatus]);

  // Update user status
  const updateStatus = async (status: 'online' | 'away' | 'offline') => {
    if (!channelRef.current || !user) return;

    await channelRef.current.track({
      user_id: user.id,
      status,
      last_seen: new Date().toISOString(),
    });
  };

  // Track page navigation
  useEffect(() => {
    const handleRouteChange = () => {
      if (channelRef.current && user) {
        channelRef.current.track({
          current_page: window.location.pathname,
          last_seen: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, [user]);

  // Track user activity (away detection)
  useEffect(() => {
    let activityTimeout: NodeJS.Timeout;
    
    const resetActivity = () => {
      clearTimeout(activityTimeout);
      updateStatus('online');
      
      activityTimeout = setTimeout(() => {
        updateStatus('away');
      }, 5 * 60 * 1000); // 5 minutes
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetActivity));

    resetActivity();

    return () => {
      clearTimeout(activityTimeout);
      events.forEach(event => window.removeEventListener(event, resetActivity));
    };
  }, []);

  return {
    presenceState,
    onlineUsers,
    onlineCount: onlineUsers.length,
    updateStatus,
    isUserOnline: (userId: string) => 
      onlineUsers.some(u => u.user_id === userId && u.status === 'online'),
  };
}