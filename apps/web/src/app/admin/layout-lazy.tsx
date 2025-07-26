/**
 * 🚀 Lazy-loaded Admin Layout
 * Code-split version with dynamic imports for performance
 */

'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AdminSession, ADMIN_ROLES } from '../../lib/middleware/admin-auth';

// Lazy load heavy components
const AdminNavigation = dynamic(
  () => import('../../components/admin/AdminNavigation').then(mod => ({ default: mod.AdminNavigation })),
  { 
    loading: () => <AdminNavigationSkeleton />,
    ssr: false 
  }
);

const AdminSecurityProvider = dynamic(
  () => import('../../components/admin/AdminSecurityProvider').then(mod => ({ default: mod.AdminSecurityProvider })),
  { ssr: false }
);

const AdminWebSocketProvider = dynamic(
  () => import('../../components/admin/AdminWebSocketProvider').then(mod => ({ default: mod.AdminWebSocketProvider })),
  { ssr: false }
);

// Loading skeletons
function AdminNavigationSkeleton() {
  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-black/50 backdrop-blur-lg animate-pulse">
      <div className="h-16 bg-white/5"></div>
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 bg-white/5 rounded"></div>
        ))}
      </div>
    </div>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [isClient, setIsClient] = useState(false);

  const adminSession: AdminSession = {
    userId: 'admin_001',
    username: 'elite.admin',
    role: ADMIN_ROLES.SUPER_ADMIN,
    lastActivity: new Date().toISOString(),
    sessionToken: 'demo_session_token'
  };

  useEffect(() => {
    setIsClient(true);
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Suspense fallback={<AdminLayoutSkeleton />}>
      <AdminSecurityProvider session={adminSession}>
        <AdminWebSocketProvider>
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
            <AdminNavigation session={adminSession} />
            
            <main className="lg:ml-64 pt-16">
              <div className="p-6">
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
                
                <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 min-h-[calc(100vh-200px)]">
                  <Suspense fallback={<ContentSkeleton />}>
                    {children}
                  </Suspense>
                </div>
              </div>
            </main>
            
            <div id="admin-alerts-overlay" className="fixed top-4 right-4 z-50 space-y-2">
              {/* Real-time alerts */}
            </div>
          </div>
        </AdminWebSocketProvider>
      </AdminSecurityProvider>
    </Suspense>
  );
}

function AdminLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      <div className="animate-pulse">
        <div className="h-16 bg-white/5"></div>
        <div className="p-6">
          <div className="h-20 bg-white/5 rounded-xl mb-6"></div>
          <div className="h-96 bg-white/5 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 bg-white/10 rounded w-1/3 mb-8"></div>
      <div className="space-y-4">
        <div className="h-32 bg-white/10 rounded"></div>
        <div className="h-32 bg-white/10 rounded"></div>
        <div className="h-32 bg-white/10 rounded"></div>
      </div>
    </div>
  );
}