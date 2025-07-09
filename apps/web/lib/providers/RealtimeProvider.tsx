'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/client-browser';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  activeChannels: Map<string, RealtimeChannel>;
  subscribeToTable: (table: string, callback: (payload: any) => void) => () => void;
  broadcastMessage: (channel: string, event: string, payload: any) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeContextType['connectionStatus']>('connecting');
  const [activeChannels] = useState(new Map<string, RealtimeChannel>());

  useEffect(() => {
    // Monitor connection status
    const checkConnection = async () => {
      try {
        // Test connection with a simple query
        const { error } = await supabase.from('sports').select('count').limit(1);
        
        if (!error) {
          setIsConnected(true);
          setConnectionStatus('connected');
        } else {
          setIsConnected(false);
          setConnectionStatus('error');
        }
      } catch (err) {
        setIsConnected(false);
        setConnectionStatus('error');
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to a table for realtime updates
  const subscribeToTable = (table: string, callback: (payload: any) => void) => {
    const channelName = `table-${table}`;
    
    // Check if channel already exists
    if (activeChannels.has(channelName)) {
      const existingChannel = activeChannels.get(channelName)!;
      existingChannel.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table 
      }, callback);
      
      return () => {
        existingChannel.unsubscribe();
      };
    }

    // Create new channel
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table 
      }, callback)
      .subscribe((status) => {
        // Realtime subscription to table: status
      });

    activeChannels.set(channelName, channel);

    // Return cleanup function
    return () => {
      supabase.removeChannel(channel);
      activeChannels.delete(channelName);
    };
  };

  // Broadcast a message to a channel
  const broadcastMessage = async (channelName: string, event: string, payload: any) => {
    let channel = activeChannels.get(channelName);
    
    if (!channel) {
      channel = supabase.channel(channelName);
      activeChannels.set(channelName, channel);
      await channel.subscribe();
    }

    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  };

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        connectionStatus,
        activeChannels,
        subscribeToTable,
        broadcastMessage,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}