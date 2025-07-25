/**
 * DFS Training Overview Component
 */

'use client';

export function DFSTrainingOverview() {
  return (
    <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <h2 className="text-xl font-semibold text-white mb-4">DFS Training Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Active Lineups</div>
          <div className="text-2xl font-bold text-white">1,247</div>
          <div className="text-xs text-green-400 mt-1">+15.3% vs yesterday</div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-white">68.2%</div>
          <div className="text-xs text-green-400 mt-1">+2.1% this week</div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">ROI</div>
          <div className="text-2xl font-bold text-white">142%</div>
          <div className="text-xs text-green-400 mt-1">+8.5% this month</div>
        </div>
      </div>
      
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Recent Training Sessions</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">NFL GPP Strategy</div>
              <div className="text-xs text-gray-400">Completed 10 mins ago</div>
            </div>
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Success</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">NBA Cash Game Optimizer</div>
              <div className="text-xs text-gray-400">Running...</div>
            </div>
            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">In Progress</span>
          </div>
        </div>
      </div>
    </div>
  );
}