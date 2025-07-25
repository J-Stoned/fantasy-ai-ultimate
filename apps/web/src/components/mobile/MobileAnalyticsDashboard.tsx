/**
 * 📱 MOBILE ANALYTICS DASHBOARD - COMPLETE MOBILE EXPERIENCE
 * 
 * This component provides a full-featured mobile analytics dashboard
 * with voice control, AI agents, and responsive data visualization.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, Brain, Mic, TrendingUp, Users,
  Sparkles, ChevronRight, Home, Settings
} from 'lucide-react';
import { VoiceAnalyticsDashboard } from '@/components/analytics/VoiceAnalyticsDashboard';
import { MobileAgentInterface } from '@/components/agents/MobileAgentInterface';
import { OracleInterface } from '@/components/oracle/OracleInterface';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { logger } from '../../lib/logging/logger';

// Agent data
const agents = [
  {
    id: 'fantasy-oracle',
    name: 'Fantasy Oracle',
    emoji: '🔮',
    personality: 'All-knowing, balanced, concise, professional',
    strategy: 'Synthesizes insights from all specialists for optimal decisions',
    specialties: ['Master Synthesis', 'Balanced Analysis', 'Prophecies'],
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-indigo-600'
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    emoji: '🤓',
    personality: 'Analytical, precise, evidence-driven',
    strategy: 'Deep statistical analysis and machine learning insights',
    specialties: ['Statistical Analysis', 'ML Predictions', 'Historical Trends'],
    color: 'text-blue-400',
    gradient: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'vegas-sharp',
    name: 'Vegas Sharp',
    emoji: '🎰',
    personality: 'Street-smart, probability-focused, value-seeking',
    strategy: 'Exploits market inefficiencies and betting line movements',
    specialties: ['Betting Lines', 'Ownership Projections', 'Game Theory'],
    color: 'text-red-400',
    gradient: 'from-red-600 to-orange-600'
  },
  {
    id: 'contrarian',
    name: 'Contrarian',
    emoji: '😈',
    personality: 'Bold, unconventional, tournament-winning mindset',
    strategy: 'Finds low-owned gems and tournament leverage spots',
    specialties: ['Low Ownership', 'Tournament Strategy', 'Leverage Spots'],
    color: 'text-amber-400',
    gradient: 'from-amber-600 to-yellow-600'
  },
  {
    id: 'optimizer',
    name: 'Optimizer',
    emoji: '🤖',
    personality: 'Efficient, systematic, process-oriented',
    strategy: 'Maximizes value through algorithmic lineup construction',
    specialties: ['Lineup Building', 'Salary Management', 'Stacking'],
    color: 'text-green-400',
    gradient: 'from-green-600 to-emerald-600'
  },
  {
    id: 'floor-general',
    name: 'Floor General',
    emoji: '🛡️',
    personality: 'Conservative, reliable, consistency-focused',
    strategy: 'Emphasizes safe floor plays for cash game success',
    specialties: ['Cash Games', 'Safe Floors', 'Consistency'],
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-pink-600'
  },
  {
    id: 'narrative-master',
    name: 'Narrative Master',
    emoji: '📖',
    personality: 'Storyteller, psychology expert, narrative builder',
    strategy: 'Identifies emotional edges and revenge game narratives',
    specialties: ['Narratives', 'Revenge Games', 'Motivation'],
    color: 'text-pink-400',
    gradient: 'from-pink-600 to-rose-600'
  },
  {
    id: 'weather-hawk',
    name: 'Weather Hawk',
    emoji: '🌦️',
    personality: 'Environmental specialist, condition analyzer',
    strategy: 'Weather and environmental impact on game outcomes',
    specialties: ['Weather Impact', 'Wind Analysis', 'Field Conditions'],
    color: 'text-sky-400',
    gradient: 'from-sky-600 to-blue-600'
  },
  {
    id: 'chaos-agent',
    name: 'Chaos Agent',
    emoji: '🎲',
    personality: 'Unpredictable, variance-embracing, boom/bust lover',
    strategy: 'Maximum variance plays for tournament upside',
    specialties: ['Boom/Bust', 'Long Shots', 'Volatility'],
    color: 'text-red-500',
    gradient: 'from-red-700 to-red-900'
  }
];

interface MobileAnalyticsDashboardProps {
  sport?: string;
  contestType?: 'GPP' | 'CASH' | 'H2H';
  user?: any;
  className?: string;
}

export function MobileAnalyticsDashboard({
  sport = 'NFL',
  contestType = 'GPP',
  user,
  className
}: MobileAnalyticsDashboardProps) {
  const [activeView, setActiveView] = useState<'home' | 'analytics' | 'agents' | 'oracle'>('home');
  const [showAgents, setShowAgents] = useState(false);
  const [notifications, setNotifications] = useState(3);
  
  // Quick stats
  const stats = {
    winRate: '24.8%',
    roi: '+18.5%',
    avgScore: '142.5',
    rank: '1,247'
  };
  
  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900",
      className
    )}>
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Fantasy.AI</h1>
                <p className="text-xs text-gray-400">Mobile Analytics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30">
                {sport}
              </Badge>
              <div className="relative">
                <Settings className="w-5 h-5 text-gray-400" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <AnimatePresence mode="wait">
        {activeView === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-4 pb-24"
          >
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-gray-400">Win Rate</p>
                </div>
                <p className="text-2xl font-bold text-white">{stats.winRate}</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-gray-400">ROI</p>
                </div>
                <p className="text-2xl font-bold text-white">{stats.roi}</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Avg Score</p>
                </div>
                <p className="text-2xl font-bold text-white">{stats.avgScore}</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-gray-400">Rank</p>
                </div>
                <p className="text-2xl font-bold text-white">#{stats.rank}</p>
              </motion.div>
            </div>
            
            {/* Quick Actions */}
            <div className="space-y-3">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setActiveView('analytics')}
                className="w-full p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 text-white" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Voice Analytics</p>
                      <p className="text-xs text-gray-200">Ask questions, get charts</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </motion.button>
              
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                onClick={() => setActiveView('oracle')}
                className="w-full p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔮</span>
                    <div className="text-left">
                      <p className="font-semibold text-white">Fantasy Oracle</p>
                      <p className="text-xs text-gray-200">Master AI advisor</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </motion.button>
              
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setShowAgents(true)}
                className="w-full p-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="w-6 h-6 text-white" />
                    <div className="text-left">
                      <p className="font-semibold text-white">AI Agents</p>
                      <p className="text-xs text-gray-200">9 specialized advisors</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </motion.button>
            </div>
            
            {/* Recent Activity */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h3>
              <div className="space-y-2">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      <p className="text-sm text-white">Won GPP Contest</p>
                    </div>
                    <p className="text-xs text-gray-400">2h ago</p>
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                      <p className="text-sm text-white">Analytics Query</p>
                    </div>
                    <p className="text-xs text-gray-400">5h ago</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {activeView === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-[calc(100vh-64px)]"
          >
            <VoiceAnalyticsDashboard 
              sport={sport}
              contestType={contestType}
              className="h-full"
            />
          </motion.div>
        )}
        
        {activeView === 'oracle' && (
          <motion.div
            key="oracle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 pb-24"
          >
            <OracleInterface 
              sport={sport}
              contestType={contestType}
              className="w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 z-50">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => setActiveView('home')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              activeView === 'home' 
                ? "text-purple-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </button>
          
          <button
            onClick={() => setActiveView('analytics')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              activeView === 'analytics' 
                ? "text-purple-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs">Analytics</span>
          </button>
          
          <button
            onClick={() => setActiveView('oracle')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all relative",
              activeView === 'oracle' 
                ? "text-purple-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            <span className="text-xl">🔮</span>
            <span className="text-xs">Oracle</span>
            <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs px-1 py-0">
              AI
            </Badge>
          </button>
          
          <button
            onClick={() => setShowAgents(true)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              showAgents 
                ? "text-purple-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            <Brain className="w-5 h-5" />
            <span className="text-xs">Agents</span>
          </button>
          
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-gray-400 hover:text-white"
          >
            <Mic className="w-5 h-5" />
            <span className="text-xs">Voice</span>
          </Link>
        </div>
      </div>
      
      {/* Mobile Agent Interface */}
      {showAgents && (
        <MobileAgentInterface 
          agents={agents}
          onQuerySubmit={(query, agentId) => {
            logger.info('Agent query:', { data: query, agentId });
            // Handle agent queries
          }}
          className="z-50"
        />
      )}
    </div>
  );
}

/**
 * 📱 MOBILE ANALYTICS DASHBOARD FEATURES:
 * 
 * - Complete mobile experience
 * - Bottom navigation bar
 * - Quick stats overview
 * - Voice analytics integration
 * - Fantasy Oracle access
 * - AI Agent interface
 * - Recent activity feed
 * - Smooth transitions
 * - One-handed operation
 * - Responsive design
 * 
 * The ultimate mobile fantasy sports platform!
 */