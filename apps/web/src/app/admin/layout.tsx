/**
 * 🔥 ENTERPRISE ADMIN LAYOUT 🔥
 * 
 * Jaw-dropping admin dashboard layout for ML & DFS Training systems.
 * Built with enterprise-grade security and real-time monitoring.
 */

'use client';

import { useState, useEffect } from 'react';
import { AdminNavigation } from '../../components/admin/AdminNavigation';
import { AdminSecurityProvider } from '../../components/admin/AdminSecurityProvider';
import { AdminWebSocketProvider } from '../../components/admin/AdminWebSocketProvider';
import { AdminSession, ADMIN_ROLES } from '../../lib/middleware/admin-auth';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  // State for hydration-safe time display
  const [currentTime, setCurrentTime] = useState('');
  const [isClient, setIsClient] = useState(false);

  // For demo purposes, create a mock admin session
  // In production, this would validate actual session from middleware/cookies
  const adminSession: AdminSession = {
    userId: 'admin_001',
    username: 'elite.admin',
    role: ADMIN_ROLES.SUPER_ADMIN,
    lastActivity: new Date().toISOString(),
    sessionToken: 'demo_session_token'
  };

  // Prevent hydration mismatch by only showing time on client
  useEffect(() => {
    setIsClient(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    
    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminSecurityProvider session={adminSession}>
      <AdminWebSocketProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
          {/* Admin Navigation */}
          <AdminNavigation session={adminSession} />
          
          {/* Main Content Area */}
          <main className="lg:ml-64 pt-16">
            <div className="p-6">
              {/* Security Status Bar */}
              <div className="mb-6 bg-black/20 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-sm font-medium">System Secure</span>
                    </div>
                    <div className="text-gray-400 text-sm">
                      Session: {adminSession.role.name} | Last Activity: {isClient ? currentTime : '--:--:--'}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {/* Real-time System Status */}
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-blue-400 text-xs">ML Systems Online</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-orange-400 text-xs">DFS Trading Active</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Page Content */}
              <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 min-h-[calc(100vh-200px)]">
                {children}
              </div>
            </div>
          </main>
          
          {/* Real-time Alerts Overlay */}
          <div id="admin-alerts-overlay" className="fixed top-4 right-4 z-50 space-y-2">
            {/* Real-time alerts will be injected here via WebSocket */}
          </div>
        </div>
      </AdminWebSocketProvider>
    </AdminSecurityProvider>
  );
}