'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function DashboardDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <nav className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl md:text-2xl font-bold text-white">Fantasy.AI Ultimate</h1>
            <div className="flex items-center gap-4">
              <span className="text-green-400">Demo Mode</span>
              <Link href="/" className="text-gray-300 hover:text-white transition-colors">
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">Demo Dashboard</h2>
          
          {/* AI-Powered Features */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">🔥 AI-Powered Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                href="/oracle"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-yellow-500 text-black animate-pulse">AI</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🔮 Fantasy Oracle</h3>
                <p className="text-gray-200">Master AI advisor with voice control</p>
              </Link>
              
              <Link 
                href="/analytics"
                className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-500 text-black">VOICE</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🎙️ Voice Analytics</h3>
                <p className="text-gray-200">Natural language data visualization</p>
              </Link>
              
              <Link 
                href="/agents"
                className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-pink-500 text-black">9 AI</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🤖 AI Agents</h3>
                <p className="text-gray-200">9 specialized AI personalities</p>
              </Link>
              
              <Link 
                href="/admin"
                className="bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-xl hover:from-red-700 hover:to-orange-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-cyan-500 text-black">ML</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🧠 Admin Panel</h3>
                <p className="text-gray-200">96.97% NFL accuracy achieved!</p>
              </Link>
            </div>
          </div>

          {/* Other Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-xl opacity-75">
              <h3 className="text-xl font-semibold text-white mb-2">🎯 Lineup Builder</h3>
              <p className="text-gray-200">Coming Soon</p>
            </div>
            
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-xl opacity-75">
              <h3 className="text-xl font-semibold text-white mb-2">🚀 Advanced DFS</h3>
              <p className="text-gray-200">Coming Soon</p>
            </div>
            
            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 rounded-xl opacity-75">
              <h3 className="text-xl font-semibold text-white mb-2">👥 Player Database</h3>
              <p className="text-gray-200">85K+ players</p>
            </div>
            
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-xl opacity-75">
              <h3 className="text-xl font-semibold text-white mb-2">💱 Trade Analyzer</h3>
              <p className="text-gray-200">Coming Soon</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">ML Accuracy</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">96.97%</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Training Data</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">4.3M+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">AI Agents</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">9</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Voice Control</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">Active</p>
          </div>
        </div>
      </main>
    </div>
  );
}