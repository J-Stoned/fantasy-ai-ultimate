'use client';

import { PatternDashboard } from '../../../../lib/components/PatternDashboard';
import { VoiceInterface } from '../../../../lib/components/VoiceInterface';
import { PatternStream } from '../../../../lib/components/PatternStream';
import { useState } from 'react';

export default function PatternsPage() {
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            📊 Fantasy AI Pattern Analytics
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            65.2% accuracy pattern engine with real-time voice integration
          </p>
          
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setShowVoicePanel(!showVoicePanel)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                showVoicePanel
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {showVoicePanel ? '🎤 Hide Voice Panel' : '🎤 Show Voice Panel'}
            </button>
            
            <a
              href="/voice-assistant"
              className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              🗣️ Full Voice Assistant
            </a>
          </div>
        </div>

        {/* Voice Panel */}
        {showVoicePanel && (
          <div className="mb-8">
            <VoiceInterface />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pattern Dashboard - Takes 2 columns */}
          <div className="lg:col-span-2">
            <PatternDashboard showVoiceIntegration={true} />
          </div>
          
          {/* Live Pattern Stream - Takes 1 column */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sticky top-8">
              <PatternStream 
                maxAlerts={5} 
                autoSpeak={false}
                onAlertClick={(alert) => {
                  console.log('Alert clicked:', alert);
                  // Could open voice panel with alert context
                }}
              />
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="font-semibold mb-1">Pattern Engine</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Unified betting + fantasy analysis
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-2">📈</div>
            <h3 className="font-semibold mb-1">Live Performance</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time accuracy tracking
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-2">🎤</div>
            <h3 className="font-semibold mb-1">Voice Commands</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              "Hey Fantasy" activation
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Multi-Format</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fantasy, DFS, betting output
            </p>
          </div>
        </div>

        {/* API Information */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">🔌 API Integration</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Pattern API Endpoints</h3>
              <div className="space-y-2 text-sm font-mono bg-gray-100 dark:bg-gray-700 p-4 rounded">
                <div>POST /api/patterns (format: fantasy)</div>
                <div>POST /api/patterns (format: betting)</div>
                <div>POST /api/patterns (format: daily_fantasy)</div>
                <div>POST /api/patterns (format: voice)</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">Voice Commands</h3>
              <div className="space-y-2 text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded">
                <div>"Hey Fantasy, show me sleeper picks"</div>
                <div>"Hey Fantasy, daily fantasy lineup"</div>
                <div>"Hey Fantasy, give me hot takes"</div>
                <div>"Hey Fantasy, pattern analysis for Chiefs"</div>
                <div>"Hey Fantasy, value plays this week"</div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
              🚀 Getting Started
            </h4>
            <ol className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
              <li>1. Start the pattern API: <code>npx tsx scripts/unified-fantasy-pattern-api.ts</code></li>
              <li>2. Enable voice commands or use the dashboard above</li>
              <li>3. Get real-time fantasy insights with 65.2% accuracy</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}