/**
 * 🔮 ORACLE PAGE - FANTASY ORACLE MASTER AI
 * 
 * Dedicated page for the Fantasy Oracle with full-screen interface
 * and all AI specialist capabilities.
 */

'use client';

import React, { useState } from 'react';
import { OracleInterface } from '@/components/oracle/OracleInterface';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function OraclePage() {
  const [lineup, setLineup] = useState<any>(null);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-indigo-900">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('/oracle-pattern.svg')] opacity-5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-purple-600/20 rounded-full blur-3xl" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 border-b border-white/10"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600/20 rounded-xl">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Fantasy Oracle</h1>
                <p className="text-gray-400">Your AI-powered fantasy sports advisor</p>
              </div>
            </div>
            
            <nav className="flex items-center gap-4">
              <Link 
                href="/analytics"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Analytics
              </Link>
              <Link 
                href="/agents"
                className="text-gray-300 hover:text-white transition-colors"
              >
                AI Agents
              </Link>
              <Link 
                href="/dashboard"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </motion.div>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Oracle Interface - Full Width on Mobile, 2 cols on Desktop */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <OracleInterface 
                  sport="NFL"
                  contestType="GPP"
                  className="w-full"
                  onLineupGenerated={(lineup) => setLineup(lineup)}
                />
              </motion.div>
            </div>
            
            {/* Side Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Oracle Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prophecies Made</span>
                    <span className="text-white font-medium">1,247</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accuracy Rate</span>
                    <span className="text-green-400 font-medium">78.3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Sessions</span>
                    <span className="text-white font-medium">342</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Specialists Available</span>
                    <span className="text-white font-medium">8</span>
                  </div>
                </div>
              </motion.div>
              
              {/* Recent Lineup */}
              {lineup && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Generated Lineup</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Projected Points</span>
                      <span className="text-white font-medium">
                        {lineup.projectedPoints?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Salary Used</span>
                      <span className="text-white font-medium">
                        ${lineup.totalSalary?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/lineup-builder"
                    className="mt-4 w-full block text-center py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white font-medium"
                  >
                    View in Lineup Builder
                  </Link>
                </motion.div>
              )}
              
              {/* Features */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10"
              >
                <h3 className="text-lg font-semibold text-white mb-4">Oracle Features</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Voice-activated with "Hey Fantasy"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">8 specialized AI agents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Real-time prophecies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Lineup optimization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span className="text-gray-300">Player analysis</span>
                  </li>
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 🔮 ORACLE PAGE FEATURES:
 * 
 * - Full-screen Oracle interface
 * - Oracle statistics display
 * - Generated lineup preview
 * - Feature list
 * - Beautiful gradient background
 * - Navigation to other AI features
 * 
 * The home of the Fantasy Oracle!
 */