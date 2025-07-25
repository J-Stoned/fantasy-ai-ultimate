'use client';

import { Suspense } from 'react';
import { UnifiedDashboard } from '../../components/leagues/UnifiedDashboard';
import { motion } from 'framer-motion';

// Loading component for better UX
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-48 mb-2"></div>
            <div className="h-4 bg-white/5 rounded w-32"></div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg border-white/20 rounded-lg p-4">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 rounded"></div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg border-white/20 rounded-lg p-4">
              <div className="animate-pulse">
                <div className="h-64 bg-white/5 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaguesPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <UnifiedDashboard />
      </Suspense>
    </motion.div>
  );
}