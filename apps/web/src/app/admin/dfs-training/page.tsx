/**
 * 🔥 DFS TRAINING DASHBOARD 🔥
 * 
 * Jaw-dropping DFS trading strategy administration with real-time analytics.
 * Enterprise-grade trading system control and performance monitoring.
 */

import { DFSTrainingOverview } from '../../../components/admin/dfs/DFSTrainingOverview';
import { DFSStrategyManager } from '../../../components/admin/dfs/DFSStrategyManager';
import { DFSPortfolioMonitoring } from '../../../components/admin/dfs/DFSPortfolioMonitoring';
import { DFSRiskMetrics } from '../../../components/admin/dfs/DFSRiskMetrics';
import { DFSPerformanceAnalytics } from '../../../components/admin/dfs/DFSPerformanceAnalytics';
import { DFSTradingControls } from '../../../components/admin/dfs/DFSTradingControls';
import { DFSLiveContests } from '../../../components/admin/dfs/DFSLiveContests';

export default function DFSTrainingDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            💰 DFS Trading Command Center
          </h1>
          <p className="text-gray-300">
            Real-time daily fantasy sports trading strategy monitoring and control
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-orange-500/20 text-orange-400 px-4 py-2 rounded-lg border border-orange-500/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Trading Active</span>
            </div>
          </div>
          
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
            📈 Deploy Strategy
          </button>
        </div>
      </div>

      {/* Trading Controls */}
      <DFSTradingControls />

      {/* Overview Metrics */}
      <DFSTrainingOverview />

      {/* Performance Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Portfolio Monitoring */}
        <DFSPortfolioMonitoring />
        
        {/* Risk Metrics */}
        <DFSRiskMetrics />
      </div>

      {/* Strategy Management */}
      <DFSStrategyManager />

      {/* Live Contests */}
      <DFSLiveContests />

      {/* Performance Analytics */}
      <DFSPerformanceAnalytics />

      {/* Real-time Trading Feed */}
      <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">📊 Real-time Trading Feed</h3>
          <div className="flex items-center space-x-2">
            <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs">
              Live
            </div>
            <button className="text-gray-400 hover:text-white transition-colors text-sm">
              ⏸️ Pause
            </button>
          </div>
        </div>
        
        <div className="bg-black/60 rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
          <div className="space-y-1">
            <div className="text-green-400">
              [15:30:22] 🎯 ENTRY: DraftKings NFL Millionaire $25 | Lineup: QB-Lamar, RB-CMC | Proj: 142.3pts
            </div>
            <div className="text-blue-400">
              [15:30:21] 📈 SIGNAL: Patriots DST upgrade (weather advantage) | Confidence: 87%
            </div>
            <div className="text-yellow-400">
              [15:30:20] ⚠️ RISK: High correlation detected in lineup_456 | Correlation: 0.73
            </div>
            <div className="text-emerald-400">
              [15:30:19] 💰 PAYOUT: Contest_789 finished 23rd/150,000 | Payout: $125 | ROI: 25%
            </div>
            <div className="text-purple-400">
              [15:30:18] 🔄 OPTIMIZE: Strategy NFL_GPP_V3 updated | Kelly: 0.08 | Max Exposure: 15%
            </div>
            <div className="text-orange-400">
              [15:30:17] 📊 OWNERSHIP: Travis Kelce ownership projected 23.5% (↑2.3%)
            </div>
            <div className="text-red-400">
              [15:30:16] 🚨 ALERT: Daily loss approaching limit | Current: -$847 | Limit: -$1000
            </div>
            <div className="text-cyan-400">
              [15:30:15] 🏈 NEWS: Christian McCaffrey questionable | Impact: High | Auto-pivot enabled
            </div>
            <div className="animate-pulse">▋</div>
          </div>
        </div>
      </div>

      {/* Strategy Backtesting Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">🧪 Strategy Backtesting</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">NFL_GPP_Contrarian_V2</h4>
                <p className="text-gray-400 text-sm">Tested on 2023-2024 season</p>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-semibold">+34.2% ROI</div>
                <div className="text-gray-400 text-sm">1,247 contests</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">NBA_Cash_Optimizer_V1</h4>
                <p className="text-gray-400 text-sm">Tested on last 90 days</p>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-semibold">+18.7% ROI</div>
                <div className="text-gray-400 text-sm">892 contests</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <h4 className="text-white font-medium">MLB_Stacks_Advanced_V3</h4>
                <p className="text-gray-400 text-sm">Testing in progress...</p>
              </div>
              <div className="text-right">
                <div className="text-yellow-400 font-semibold">+7.3% ROI</div>
                <div className="text-gray-400 text-sm">156 contests</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">🎯 Today's Performance</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-green-400">+$2,847</div>
              <div className="text-gray-400 text-sm">Net Profit</div>
            </div>
            
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">23.4%</div>
              <div className="text-gray-400 text-sm">ROI</div>
            </div>
            
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">147</div>
              <div className="text-gray-400 text-sm">Entries</div>
            </div>
            
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-orange-400">68.2%</div>
              <div className="text-gray-400 text-sm">Win Rate</div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-400 text-sm font-medium">On track for weekly profit target</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}