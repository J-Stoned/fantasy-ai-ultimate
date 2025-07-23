'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradingDashboard } from './TradingDashboard';
import { PortfolioVisualizer } from './PortfolioVisualizer';
import { Portfolio3DVisualizer } from './Portfolio3DVisualizer';
import { ContestBrowser } from './ContestBrowser';
import { 
  BarChart3,
  PieChart,
  Activity,
  Trophy,
  Layers,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const DFSDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('trading');

  const tabConfig = [
    { value: 'trading', label: 'Trading View', icon: TrendingUp },
    { value: 'portfolio', label: 'Portfolio', icon: PieChart },
    { value: '3d', label: '3D Analysis', icon: Layers },
    { value: 'contests', label: 'Contests', icon: Trophy },
    { value: 'analytics', label: 'Analytics', icon: BarChart3 },
    { value: 'live', label: 'Live Track', icon: Activity }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-[2000px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 lg:p-6 border-b border-gray-800"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                DFS Trading Dashboard
              </h1>
              <p className="text-gray-400 mt-1">Professional-grade fantasy sports trading platform</p>
            </div>
            
            {/* Quick Stats for Desktop */}
            <div className="hidden lg:flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">$15,842</div>
                <div className="text-xs text-gray-400">Portfolio Value</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">68.5%</div>
                <div className="text-xs text-gray-400">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">1.85</div>
                <div className="text-xs text-gray-400">Sharpe Ratio</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="p-4 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab Navigation */}
            <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-2 bg-gray-900 p-1 h-auto">
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "flex flex-col lg:flex-row items-center gap-1 lg:gap-2 py-2 lg:py-1.5",
                      "data-[state=active]:bg-blue-500 data-[state=active]:text-white",
                      "transition-all duration-200"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs lg:text-sm">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Tab Contents */}
            <div className="mt-6">
              <TabsContent value="trading" className="m-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <TradingDashboard />
                </motion.div>
              </TabsContent>

              <TabsContent value="portfolio" className="m-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <PortfolioVisualizer />
                </motion.div>
              </TabsContent>

              <TabsContent value="3d" className="m-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Portfolio3DVisualizer />
                </motion.div>
              </TabsContent>

              <TabsContent value="contests" className="m-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <ContestBrowser />
                </motion.div>
              </TabsContent>

              <TabsContent value="analytics" className="m-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg border border-gray-800"
                >
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <h3 className="text-xl font-bold mb-2">Advanced Analytics</h3>
                    <p className="text-gray-400">Coming soon - ML-powered insights and predictions</p>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="live" className="m-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg border border-gray-800"
                >
                  <div className="text-center">
                    <Activity className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <h3 className="text-xl font-bold mb-2">Live Contest Tracking</h3>
                    <p className="text-gray-400">Real-time contest monitoring and alerts</p>
                  </div>
                </motion.div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Mobile Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4"
        >
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-lg font-bold text-green-500">$15.8K</div>
              <div className="text-xs text-gray-400">Portfolio</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500">68.5%</div>
              <div className="text-xs text-gray-400">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-500">1.85</div>
              <div className="text-xs text-gray-400">Sharpe</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-500">+28%</div>
              <div className="text-xs text-gray-400">Today</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DFSDashboard;