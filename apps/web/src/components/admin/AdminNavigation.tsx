/**
 * 🔥 ADMIN NAVIGATION - Enterprise Command Center Navigation 🔥
 * 
 * Professional admin navigation with real-time status indicators,
 * security controls, and ML/DFS system monitoring.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface AdminSession {
  userId: string;
  username: string;
  role: {
    name: string;
    permissions: string[];
  };
  lastActivity: string;
}

interface AdminNavigationProps {
  session: AdminSession;
}

export function AdminNavigation({ session }: AdminNavigationProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigationItems = [
    {
      title: 'Dashboard',
      href: '/admin',
      icon: '🏠',
      description: 'System overview',
      status: 'active'
    },
    {
      title: 'ML Training',
      href: '/admin/ml-training',
      icon: '🧠',
      description: 'Elite model training',
      status: 'active',
      highlight: true, // Highlight the new feature!
      badge: 'NEW'
    },
    {
      title: 'DFS Trading',
      href: '/admin/dfs-training',
      icon: '💰',
      description: 'Portfolio optimization',
      status: 'active'
    },
    {
      title: 'GPU Monitor',
      href: '/admin/gpu-monitor',
      icon: '🎮',
      description: 'RTX 4060 telemetry',
      status: 'beta'
    },
    {
      title: 'Analytics',
      href: '/admin/analytics',
      icon: '📊',
      description: 'Performance metrics',
      status: 'active'
    },
    {
      title: 'Security',
      href: '/admin/security',
      icon: '🛡️',
      description: 'System security',
      status: 'active'
    },
    {
      title: 'Settings',
      href: '/admin/settings',
      icon: '⚙️',
      description: 'System configuration',
      status: 'active'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'beta': return 'bg-yellow-500';
      case 'maintenance': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className={`fixed left-0 top-0 h-full bg-black/40 backdrop-blur-lg border-r border-white/10 transition-all duration-300 z-40 ${
        isCollapsed ? 'w-16' : 'w-64'
      } hidden lg:block`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            {!isCollapsed && (
              <div>
                <h1 className="text-white font-bold text-xl">⚡ Admin Center</h1>
                <p className="text-gray-400 text-sm">Elite ML & DFS Control</p>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              {isCollapsed ? '→' : '←'}
            </button>
          </div>

          {/* User Info */}
          {!isCollapsed && (
            <div className="mb-8 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {session.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-white font-medium text-sm">{session.username}</div>
                  <div className="text-gray-400 text-xs">{session.role.name}</div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative group flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                } ${item.highlight ? 'ring-2 ring-purple-500/50 ring-offset-2 ring-offset-black/40' : ''}`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-lg">{item.icon}</span>
                  {!isCollapsed && (
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`}></div>

                {/* Badge */}
                {item.badge && !isCollapsed && (
                  <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded border border-purple-500/30">
                    {item.badge}
                  </div>
                )}

                {/* Highlight Glow Effect */}
                {item.highlight && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg animate-pulse"></div>
                )}
              </Link>
            ))}
          </div>

          {/* System Status */}
          {!isCollapsed && (
            <div className="mt-8 p-4 bg-black/60 rounded-lg border border-white/10">
              <div className="text-white font-medium text-sm mb-3">🚀 System Status</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">ML Training</span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-400">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">GPU Utilization</span>
                  <span className="text-white font-medium">87%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">DFS Trading</span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-orange-400">Running</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          {!isCollapsed && (
            <div className="mt-8">
              <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                <span className="text-lg">🚪</span>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Navigation Header */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 bg-black/40 backdrop-blur-lg border-b border-white/10 z-50">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-white font-bold text-lg">⚡ Admin Center</h1>
          </div>
          <button className="text-gray-400 hover:text-white p-2">
            <span className="text-xl">☰</span>
          </button>
        </div>
      </nav>
    </>
  );
}