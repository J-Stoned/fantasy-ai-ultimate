/**
 * 📊 ANALYTICS PAGE - VOICE-CONTROLLED DATA VISUALIZATION
 * 
 * This page provides the voice-controlled analytics dashboard
 * with AI-powered insights and real-time data visualization.
 */

'use client';

import React from 'react';
import { VoiceAnalyticsDashboard } from '@/components/analytics/VoiceAnalyticsDashboard';
import { OracleInterface } from '@/components/oracle/OracleInterface';
import { motion } from 'framer-motion';
import { logger } from '../../lib/logging/logger';

export default function AnalyticsPage() {
  const [selectedChart, setSelectedChart] = React.useState<any>(null);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-3xl" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 border-b border-white/10"
        >
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-2">
              Voice Analytics Dashboard
            </h1>
            <p className="text-gray-400">
              Ask questions about your data and get instant visualizations
            </p>
          </div>
        </motion.div>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <VoiceAnalyticsDashboard 
              sport="NFL"
              contestType="GPP"
              className="w-full"
            />
          </motion.div>
        </div>
        
        {/* Oracle Assistant */}
        <div className="fixed bottom-6 right-6 z-50">
          <OracleInterface 
            sport="NFL"
            contestType="GPP"
            onChartRequested={(config) => {
              // Handle chart requests from Oracle
              logger.info('Chart requested:', { data: config });
              setSelectedChart(config);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 📊 ANALYTICS PAGE FEATURES:
 * 
 * - Full-page voice analytics dashboard
 * - Oracle assistant integration
 * - Beautiful gradient backgrounds
 * - Grid pattern effects
 * - Smooth animations
 * - Chart request handling
 * 
 * The ultimate data visualization experience!
 */