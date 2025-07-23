/**
 * 🔥 ADMIN QUICK ACTIONS - One-Click Operations 🔥
 * 
 * Quick action buttons for common admin operations and system controls.
 */

'use client';

import { Card } from '../ui/card';
import { Button } from '../ui/button';

export function AdminQuickActions() {
  const quickActions = [
    {
      title: 'Launch ML Training',
      description: 'Start new model training',
      icon: '🚀',
      color: 'from-blue-600 to-cyan-600',
      action: () => console.log('🚀 Launching ML training...')
    },
    {
      title: 'Optimize GPU',
      description: 'RTX 4060 optimization',
      icon: '⚡',
      color: 'from-purple-600 to-pink-600',
      action: () => console.log('⚡ Optimizing GPU...')
    },
    {
      title: 'Deploy Models',
      description: 'Push to production',
      icon: '📦',
      color: 'from-green-600 to-emerald-600',
      action: () => console.log('📦 Deploying models...')
    },
    {
      title: 'System Health',
      description: 'Full system check',
      icon: '🔍',
      color: 'from-orange-600 to-red-600',
      action: () => console.log('🔍 Running system check...')
    }
  ];

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
      <h3 className="text-xl font-semibold text-white mb-4">⚡ Quick Actions</h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <Button
            key={index}
            onClick={action.action}
            className={`h-24 bg-gradient-to-r ${action.color} hover:scale-105 transition-all duration-200 flex flex-col items-center justify-center space-y-2`}
          >
            <span className="text-2xl">{action.icon}</span>
            <div className="text-center">
              <div className="text-sm font-semibold">{action.title}</div>
              <div className="text-xs opacity-80">{action.description}</div>
            </div>
          </Button>
        ))}
      </div>
    </Card>
  );
}