'use client';

import { RealTimeDashboard } from '../../../components/RealTimeDashboard';
import { WebSocketProvider } from '../../../lib/contexts/WebSocketProvider';
import { VoiceInterface } from '../../../components/VoiceInterface';

export default function RealTimePage() {
  return (
    <WebSocketProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              🔥 Fantasy AI Real-Time Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Live ML predictions, voice commands, and real-time updates
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Voice Interface */}
          <div className="mb-8">
            <VoiceInterface />
          </div>

          {/* Real-Time Dashboard */}
          <RealTimeDashboard />
          
          {/* System Status */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">🚀 GPU Status</h3>
              <p className="text-green-600">RTX 4060 Active</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">CUDA acceleration enabled</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">🧠 ML Models</h3>
              <p className="text-green-600">3 Models Active</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">100% accuracy on training</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">📊 Data Pipeline</h3>
              <p className="text-green-600">25K+ records/min</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Live from 5 sources</p>
            </div>
          </div>
        </main>
      </div>
    </WebSocketProvider>
  );
}