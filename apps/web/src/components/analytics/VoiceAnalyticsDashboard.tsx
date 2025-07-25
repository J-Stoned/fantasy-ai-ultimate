/**
 * 🎙️ VOICE ANALYTICS DASHBOARD - AI-POWERED DATA VISUALIZATION
 * 
 * This component provides a voice-controlled analytics dashboard that
 * generates charts and insights based on natural language queries.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, BarChart3, LineChart, PieChart, 
  TrendingUp, Users, DollarSign, Target, Sparkles,
  Volume2, VolumeX, Maximize2, Minimize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { DynamicChart } from './DynamicChart';
import { InsightPanel } from './InsightPanel';
import { MetricCards } from './MetricCards';
import { cn } from '@/lib/utils';
import { logger } from '../../lib/logging/logger';

interface VoiceAnalyticsDashboardProps {
  sport?: string;
  contestType?: 'GPP' | 'CASH' | 'H2H';
  className?: string;
}

interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | 'heatmap';
  data: any;
  title: string;
  description?: string;
  timeframe?: string;
}

interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  data?: any;
}

interface Metric {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
}

export function VoiceAnalyticsDashboard({
  sport = 'NFL',
  contestType = 'GPP',
  className
}: VoiceAnalyticsDashboardProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'insights' | 'metrics'>('chart');
  const [showMetrics, setShowMetrics] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  const [currentChart, setCurrentChart] = useState<ChartConfig | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const dashboardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Voice input hook
  const {
    startListening,
    stopListening,
    transcript,
    isProcessing: isVoiceProcessing,
    confidence
  } = useVoiceInput({
    onTranscript: handleVoiceTranscript,
    onError: (err) => setError(err)
  });
  
  // Handle voice transcript
  async function handleVoiceTranscript(text: string, isFinal: boolean) {
    if (isFinal && text.trim()) {
      setQuery(text);
      await processAnalyticsQuery(text);
      setIsListening(false);
    }
  }
  
  // Process analytics query
  async function processAnalyticsQuery(queryText: string) {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analytics/voice-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          context: { sport, contestType }
        })
      });
      
      if (!response.ok) throw new Error('Failed to process query');
      
      const data = await response.json();
      
      // Update chart
      if (data.chartConfig) {
        setCurrentChart(data.chartConfig);
      }
      
      // Update insights
      if (data.insights) {
        setInsights(data.insights);
      }
      
      // Update metrics
      if (data.metrics) {
        setMetrics(data.metrics);
      }
      
      // Play audio response if available
      if (data.audioUrl && audioEnabled && audioRef.current) {
        audioRef.current.src = data.audioUrl;
        audioRef.current.play();
      }
      
      // Animate entrance
      animateDataEntrance();
      
    } catch (err) {
      logger.error('Analytics query error:', { error: err });
      setError('Failed to generate analytics. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }
  
  // Animate data entrance
  function animateDataEntrance() {
    // Chart animation handled by component
    // Add any additional animations here
  }
  
  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
    }
  }, [isListening, startListening, stopListening]);
  
  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!dashboardRef.current) return;
    
    if (!isFullscreen) {
      dashboardRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);
  
  // Sample queries
  const sampleQueries = [
    "Show me scoring trends for the last 5 weeks",
    "Compare top 5 QBs by fantasy points",
    "What's the correlation between salary and points?",
    "Show ownership distribution for GPP contests",
    "Analyze weather impact on passing yards",
    "Display team stacking performance"
  ];
  
  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Initialize with default data
  useEffect(() => {
    // Load default metrics
    setMetrics([
      {
        id: 'avg-score',
        label: 'Avg Score',
        value: '142.5',
        change: 5.2,
        trend: 'up',
        icon: <TrendingUp className="w-5 h-5" />
      },
      {
        id: 'win-rate',
        label: 'Win Rate',
        value: '24.8%',
        change: 2.1,
        trend: 'up',
        icon: <Target className="w-5 h-5" />
      },
      {
        id: 'roi',
        label: 'ROI',
        value: '+18.5%',
        change: 3.7,
        trend: 'up',
        icon: <DollarSign className="w-5 h-5" />
      },
      {
        id: 'entries',
        label: 'Entries',
        value: '1,247',
        change: -1.2,
        trend: 'down',
        icon: <Users className="w-5 h-5" />
      }
    ]);
  }, []);
  
  return (
    <div 
      ref={dashboardRef}
      className={cn(
        "relative bg-black/90 backdrop-blur-xl rounded-2xl border border-purple-500/20 overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
        className
      )}
    >
      {/* Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10 pointer-events-none" />
      
      {/* Header */}
      <div className="relative z-10 p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Voice Analytics</h2>
              <p className="text-sm text-gray-400">
                Ask questions, get instant visualizations
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {audioEnabled ? (
                <Volume2 className="w-5 h-5 text-white" />
              ) : (
                <VolumeX className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-white" />
              ) : (
                <Maximize2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 p-4 md:p-6">
        {/* Mobile Tab Navigation */}
        {isMobile && (
          <div className="flex mb-4 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('chart')}
              className={cn(
                "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                activeTab === 'chart' 
                  ? "bg-purple-600 text-white" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              Chart
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={cn(
                "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                activeTab === 'insights' 
                  ? "bg-purple-600 text-white" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              Insights
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={cn(
                "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                activeTab === 'metrics' 
                  ? "bg-purple-600 text-white" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              Metrics
            </button>
          </div>
        )}
        
        {/* Metrics Row - Collapsible on Mobile */}
        {(!isMobile || activeTab === 'metrics') && (
          <div className={cn(
            "transition-all duration-300",
            isMobile ? "" : "mb-6"
          )}>
            {isMobile && (
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Key Metrics</h3>
                <Badge className="bg-purple-600/20 text-purple-400">
                  {metrics.length} metrics
                </Badge>
              </div>
            )}
            <div className={cn(
              isMobile ? "space-y-3" : ""
            )}>
              {isMobile ? (
                // Mobile: Vertical list with larger touch targets
                metrics.map((metric, index) => (
                  <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                          {metric.icon}
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">{metric.label}</p>
                          <p className="text-xl font-bold text-white">{metric.value}</p>
                        </div>
                      </div>
                      {metric.change !== undefined && (
                        <div className={cn(
                          "text-sm font-medium",
                          metric.change > 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                // Desktop: Grid cards
                <MetricCards metrics={metrics} />
              )}
            </div>
          </div>
        )}
        
        {/* Main Content - Desktop Grid / Mobile Tabs */}
        <div className={cn(
          isMobile ? "" : "grid grid-cols-1 lg:grid-cols-3 gap-6"
        )}>
          {/* Chart Area */}
          {(!isMobile || activeTab === 'chart') && (
            <div className={cn(
              isMobile ? "" : "lg:col-span-2"
            )}>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className={cn(
                  isMobile ? "p-4" : ""
                )}>
                  <CardTitle className={cn(
                    "text-white",
                    isMobile ? "text-lg" : "text-xl"
                  )}>
                    {currentChart ? currentChart.title : 'Analytics Visualization'}
                  </CardTitle>
                  {currentChart?.description && (
                    <p className={cn(
                      "text-gray-400 mt-1",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      {currentChart.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className={cn(
                  isMobile ? "p-4" : ""
                )}>
                  {currentChart ? (
                    <div className={cn(
                      isMobile ? "h-64" : "h-96"
                    )}>
                      <DynamicChart config={currentChart} />
                    </div>
                  ) : (
                    <div className={cn(
                      "flex items-center justify-center",
                      isMobile ? "h-64" : "h-96"
                    )}>
                      <div className="text-center">
                        <Sparkles className={cn(
                          "text-purple-400 mx-auto mb-4 opacity-50",
                          isMobile ? "w-12 h-12" : "w-16 h-16"
                        )} />
                        <p className={cn(
                          "text-gray-400",
                          isMobile ? "text-sm" : "text-base"
                        )}>
                          Ask a question to generate analytics
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Insights Panel */}
          {(!isMobile || activeTab === 'insights') && (
            <div className={cn(
              isMobile ? "" : "lg:col-span-1"
            )}>
              <InsightPanel 
                insights={insights}
                onInsightClick={(insight) => {
                  if (insight.data?.query) {
                    processAnalyticsQuery(insight.data.query);
                  }
                }}
                className={isMobile ? "h-[400px] overflow-y-auto" : ""}
              />
            </div>
          )}
        </div>
        )}
        
        {/* Voice Input Section - Fixed on Mobile */}
        <div className={cn(
          "mt-6",
          isMobile ? "fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-xl border-t border-white/10" : ""
        )}>
          <Card className={cn(
            "bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-purple-500/30",
            isMobile ? "border-0 bg-transparent" : ""
          )}>
            <CardContent className={cn(
              isMobile ? "p-0" : "p-6"
            )}>
              {/* Query Display - Compact on Mobile */}
              {query && !isMobile && (
                <div className="mb-4 p-3 bg-white/5 rounded-lg">
                  <p className="text-sm text-gray-400">Last query:</p>
                  <p className="text-white">{query}</p>
                </div>
              )}
              
              {/* Input Area */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder={isListening ? "Listening..." : "Ask about your data..."}
                  className="flex-1 px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      processAnalyticsQuery(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  disabled={isListening || isProcessing}
                />
                
                {/* Voice Button */}
                <motion.button
                  onClick={toggleListening}
                  disabled={isProcessing || isVoiceProcessing}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    isListening
                      ? "bg-red-600 hover:bg-red-700 animate-pulse"
                      : "bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
                    (isProcessing || isVoiceProcessing) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </motion.button>
              </div>
              
              {/* Sample Queries - Hidden on Mobile */}
              {!isMobile && (
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {sampleQueries.slice(0, 3).map((sample, index) => (
                      <button
                        key={index}
                        onClick={() => processAnalyticsQuery(sample)}
                        className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-gray-300 hover:text-white"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-600/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">Generating analytics...</p>
              <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" />
      
      {/* Mobile Bottom Padding */}
      {isMobile && <div className="h-32" />}
    </div>
  );
}

/**
 * 🎙️ VOICE ANALYTICS DASHBOARD FEATURES:
 * 
 * - Natural language chart generation
 * - Voice-controlled data exploration
 * - Dynamic chart types (line, bar, pie, scatter, etc.)
 * - AI-powered insights and recommendations
 * - Real-time metric tracking
 * - Sample query suggestions
 * - Fullscreen mode
 * - Audio responses
 * - Beautiful animations
 * 
 * The future of data visualization!
 */