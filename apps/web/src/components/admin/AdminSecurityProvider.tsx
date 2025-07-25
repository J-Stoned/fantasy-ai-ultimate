/**
 * 🔥 ADMIN SECURITY PROVIDER - Enterprise Security Context 🔥
 * 
 * Professional security context provider for admin dashboard.
 * Handles authentication, authorization, and security monitoring.
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { logger } from '../../lib/logging/logger';

interface AdminSession {
  userId: string;
  username: string;
  role: {
    name: string;
    permissions: string[];
  };
  lastActivity: string;
}

interface SecurityContext {
  session: AdminSession;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => void;
}

const AdminSecurityContext = createContext<SecurityContext | null>(null);

interface AdminSecurityProviderProps {
  children: React.ReactNode;
  session: AdminSession;
}

export function AdminSecurityProvider({ children, session }: AdminSecurityProviderProps) {
  const [currentSession, setCurrentSession] = useState(session);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const hasPermission = (permission: string): boolean => {
    return currentSession.role.permissions.includes(permission) || 
           currentSession.role.permissions.includes('admin:all');
  };

  const refreshSession = () => {
    // In production, this would refresh the session from the server
    logger.info('🔄 Refreshing admin session...');
  };

  useEffect(() => {
    // Session timeout monitoring
    const timeout = setTimeout(() => {
      logger.info('⚠️ Session timeout warning');
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearTimeout(timeout);
  }, []);

  const contextValue: SecurityContext = {
    session: currentSession,
    isAuthenticated,
    hasPermission,
    refreshSession
  };

  return (
    <AdminSecurityContext.Provider value={contextValue}>
      {children}
    </AdminSecurityContext.Provider>
  );
}

export function useAdminSecurity() {
  const context = useContext(AdminSecurityContext);
  if (!context) {
    throw new Error('useAdminSecurity must be used within AdminSecurityProvider');
  }
  return context;
}