/**
 * 🔥 ENTERPRISE ADMIN DASHBOARD 🔥
 * 
 * Main admin dashboard with real-time metrics overview.
 * Gateway to ML Training & DFS Training administration.
 */

import { AdminDashboardOverview } from '../../components/admin/AdminDashboardOverview';
import { AdminMetricsGrid } from '../../components/admin/AdminMetricsGrid';
import { AdminQuickActions } from '../../components/admin/AdminQuickActions';
import { AdminSystemHealth } from '../../components/admin/AdminSystemHealth';
import { AdminSecuritySummary } from '../../components/admin/AdminSecuritySummary';

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🚀 Enterprise Admin Command Center
          </h1>
          <p className="text-gray-300">
            Real-time monitoring and control for ML Training & DFS Trading systems
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-lg border border-green-500/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">All Systems Operational</span>
            </div>
          </div>
          
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
            🔄 Refresh All
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <AdminQuickActions />

      {/* Overview Dashboard */}
      <AdminDashboardOverview />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* System Health */}
        <div className="xl:col-span-2">
          <AdminSystemHealth />
        </div>
        
        {/* Security Summary */}
        <div>
          <AdminSecuritySummary />
        </div>
      </div>

      {/* Real-time Metrics */}
      <AdminMetricsGrid />

      {/* Footer Info */}
      <div className="text-center text-gray-400 text-sm pt-8 border-t border-white/10">
        <p>Fantasy.AI Enterprise Admin System | Real-time ML & DFS Trading Management</p>
        <p className="mt-1">Build {process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev'} | Last Updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}