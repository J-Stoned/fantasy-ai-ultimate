'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface RealtimeContextType {
  connected: boolean;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  connected: false,
  reconnect: () => {},
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Simulate connection for now
    setConnected(true);
  }, []);

  const reconnect = () => {
    setConnected(false);
    setTimeout(() => setConnected(true), 1000);
  };

  return (
    <RealtimeContext.Provider value={{ connected, reconnect }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);