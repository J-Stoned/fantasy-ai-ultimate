'use client';

import { useState } from 'react';
import { unifiedAPIService } from '@/lib/services/api/unified-api-service';
import { geminiService } from '@/lib/services/ai/gemini-service';
import { Loader2, Play, Sparkles, Youtube, Brain, Image } from 'lucide-react';
import { logger } from '@/lib/logging/logger';

export function APIQuickStart() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeDemo, setActiveDemo] = useState<string>('');

  const runDemo = async (demoType: string) => {
    setLoading(true);
    setActiveDemo(demoType);
    setResult(null);

    try {
      switch (demoType) {
        case 'player-intelligence':
          // Get comprehensive player intelligence
          const playerData = await unifiedAPIService.getPlayerIntelligence(
            'player-123',
            'Patrick Mahomes'
          );
          setResult({
            type: 'Player Intelligence',
            data: playerData
          });
          break;

        case 'lineup-optimization':
          // Optimize a fantasy lineup
          const lineup = await unifiedAPIService.optimizeLineup(
            [
              { id: 'p1', name: 'Patrick Mahomes', position: 'QB', salary: 8500, projectedPoints: 25 },
              { id: 'p2', name: 'Christian McCaffrey', position: 'RB', salary: 9000, projectedPoints: 22 },
              { id: 'p3', name: 'Justin Jefferson', position: 'WR', salary: 8800, projectedPoints: 20 },
              { id: 'p4', name: 'Tyreek Hill', position: 'WR', salary: 8200, projectedPoints: 19 },
              { id: 'p5', name: 'Travis Kelce', position: 'TE', salary: 7500, projectedPoints: 17 },
            ],
            {
              salaryCap: 50000,
              positions: {
                QB: { min: 1, max: 1 },
                RB: { min: 1, max: 3 },
                WR: { min: 2, max: 4 },
                TE: { min: 1, max: 2 }
              }
            }
          );
          setResult({
            type: 'Lineup Optimization',
            data: lineup
          });
          break;

        case 'gemini-chat':
          // Chat with Gemini AI
          const { response } = await geminiService.chat(
            'demo-user',
            'Who should I start at QB this week? Mahomes or Josh Allen?'
          );
          setResult({
            type: 'Gemini AI Chat',
            data: { response }
          });
          break;

        case 'youtube-analysis':
          // Analyze YouTube videos
          const videos = await unifiedAPIService.youtubeService.getPlayerVideos('Patrick Mahomes');
          setResult({
            type: 'YouTube Video Analysis',
            data: videos
          });
          break;

        case 'cdn-optimization':
          // Demo CDN image optimization
          const originalUrl = '/images/sample-player.jpg';
          const optimized = unifiedAPIService.cdnService.getOptimizedImageUrl(originalUrl, {
            width: 300,
            height: 400,
            format: 'webp',
            quality: 85
          });
          setResult({
            type: 'CDN Image Optimization',
            data: {
              original: originalUrl,
              optimized,
              savings: 'Estimated 60-80% file size reduction'
            }
          });
          break;

        default:
          throw new Error('Unknown demo type');
      }
    } catch (error) {
      logger.error('Demo error:', error);
      setResult({
        type: 'Error',
        error: error instanceof Error ? error.message : 'Demo failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const demos = [
    {
      id: 'player-intelligence',
      title: 'Player Intelligence',
      description: 'Get AI-powered insights, YouTube videos, and performance data',
      icon: Brain,
      color: 'from-purple-600 to-indigo-600'
    },
    {
      id: 'lineup-optimization',
      title: 'Lineup Optimization',
      description: 'Optimize DFS lineups with AI and real-time data',
      icon: Sparkles,
      color: 'from-green-600 to-emerald-600'
    },
    {
      id: 'gemini-chat',
      title: 'Gemini AI Chat',
      description: 'Natural language fantasy advice and analysis',
      icon: Brain,
      color: 'from-blue-600 to-cyan-600'
    },
    {
      id: 'youtube-analysis',
      title: 'YouTube Analysis',
      description: 'Find and analyze player highlight videos',
      icon: Youtube,
      color: 'from-red-600 to-pink-600'
    },
    {
      id: 'cdn-optimization',
      title: 'CDN Optimization',
      description: 'Optimize images with Cloudflare CDN',
      icon: Image,
      color: 'from-orange-600 to-yellow-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          🚀 API Quick Start Demos
        </h2>
        <p className="text-gray-300">
          Try these live examples to see the unified API in action
        </p>
      </div>

      {/* Demo Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {demos.map((demo) => {
          const Icon = demo.icon;
          return (
            <button
              key={demo.id}
              onClick={() => runDemo(demo.id)}
              disabled={loading}
              className={`relative overflow-hidden rounded-xl p-6 text-left transition-all transform hover:scale-105 ${
                loading && activeDemo === demo.id
                  ? 'opacity-75 cursor-not-allowed'
                  : 'hover:shadow-xl'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${demo.color} opacity-90`} />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-8 h-8 text-white" />
                  {loading && activeDemo === demo.id ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 text-white" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-1">
                  {demo.title}
                </h3>
                <p className="text-sm text-white/80">
                  {demo.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Results Display */}
      {result && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            {result.type} Result
          </h3>
          
          {result.error ? (
            <div className="text-red-400">
              Error: {result.error}
            </div>
          ) : (
            <pre className="bg-black/50 rounded-lg p-4 overflow-x-auto text-sm text-gray-300">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Code Example */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">
          📝 Quick Integration Example
        </h3>
        
        <pre className="bg-black/50 rounded-lg p-4 overflow-x-auto text-sm">
          <code className="language-typescript">{`import { unifiedAPIService } from '@/lib/services/api/unified-api-service';
import { geminiService } from '@/lib/services/ai/gemini-service';

// Get player intelligence with all data sources
const playerData = await unifiedAPIService.getPlayerIntelligence(
  'player-id',
  'Player Name'
);

// Chat with Gemini AI
const { response } = await geminiService.chat(
  userId,
  'Who should I start this week?',
  sessionId
);

// Optimize images through CDN
const optimizedUrl = unifiedAPIService.cdnService.getOptimizedImageUrl(
  originalUrl,
  { width: 300, format: 'webp' }
);`}</code>
        </pre>
      </div>
    </div>
  );
}