import { useEffect, useRef } from 'react';
import { supabase } from '../../supabase/client-browser';
import { RealtimeChannel } from '@supabase/supabase-js';
import { defaultLogger } from '../../utils/logger';

interface UseRealtimeSubscriptionOptions {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: any) => void;
}

export function useRealtimeSubscription({
  table,
  filter,
  event = '*',
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Create channel name
    const channelName = `realtime:${table}:${filter || 'all'}`;

    // Set up the subscription
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter,
        },
        (payload) => {
          defaultLogger.debug(`Realtime ${payload.eventType} on ${table}`, { payload });

          // Call appropriate handler
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload);
              break;
            case 'UPDATE':
              onUpdate?.(payload);
              break;
            case 'DELETE':
              onDelete?.(payload);
              break;
          }

          // Always call onChange if provided
          onChange?.(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          defaultLogger.info(`Subscribed to realtime changes`, { table });
        } else if (status === 'CHANNEL_ERROR') {
          defaultLogger.error(`Error subscribing to realtime changes`, { table });
        }
      });

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        defaultLogger.debug(`Unsubscribing from realtime channel`, { table });
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, filter, event, onInsert, onUpdate, onDelete, onChange]);

  return channelRef.current;
}