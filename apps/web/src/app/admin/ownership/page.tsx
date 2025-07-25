'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Zap,
  Target,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  Filter,
  BarChart3,
  Layers,
  Shield,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../../../lib/logging/logger';

interface OwnershipProjection {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  salary: number;
  projectedPoints: number;
  projectedOwnership: number;
  leverageScore: number;
  chalkScore: number;
  contrarianScore: number;
  narrativeFactors: string[];
  confidence: number;
}

interface OwnershipStack {
  team: string;
  qb: {
    name: string;
    ownership: string;
    points: number;
  };
  receivers: Array<{
    name: string;
    position: string;
    ownership: string;
    leverageScore: string;
  }>;
  stackOwnership: string;
  stackLeverage: number;
}

export default function OwnershipDashboard() {
  const [loading, setLoading] = useState(false);
  const [sport, setSport] = useState('NFL');
  const [contestType, setContestType] = useState<'GPP' | 'CASH'>('GPP');
  const [activeTab, setActiveTab] = useState<'chalk' | 'leverage' | 'contrarian' | 'stacks'>('leverage');
  const [ownershipData, setOwnershipData] = useState<any>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [filterPosition, setFilterPosition] = useState('ALL');

  // Fetch ownership projections
  const fetchOwnership = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ownership/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'project',
          sport,
          contestType,
          gameDate: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setOwnershipData(data);
        toast.success('Ownership projections loaded!');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Error fetching ownership:', { error: error });
      toast.error('Failed to load ownership data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when sport/contest type changes
  useEffect(() => {
    fetchOwnership();
  }, [sport, contestType]);

  // Calculate leverage opportunities
  const calculateLeverage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ownership/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leverage',
          sport,
          contestType,
          gameDate: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Leverage analysis complete!');
        // Update leverage data
        if (ownershipData) {
          setOwnershipData({
            ...ownershipData,
            leverageAnalysis: data
          });
        }
      }
    } catch (error) {
      logger.error('Leverage calculation error:', { error: error });
      toast.error('Failed to calculate leverage');
    } finally {
      setLoading(false);
    }
  };

  // Toggle player selection
  const togglePlayer = (playerId: string) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayers(newSelection);
  };

  // Export selections
  const exportSelections = () => {
    if (selectedPlayers.size === 0) {
      toast.error('No players selected');
      return;
    }

    const selectedData = ownershipData?.projections
      ?.filter((p: OwnershipProjection) => selectedPlayers.has(p.playerId))
      || [];

    const csv = [
      ['Player', 'Position', 'Team', 'Salary', 'Projected Points', 'Ownership %', 'Leverage Score'],
      ...selectedData.map((p: OwnershipProjection) => [
        p.playerName,
        p.position,
        p.team,
        p.salary,
        p.projectedPoints.toFixed(1),
        (p.projectedOwnership * 100).toFixed(1),
        p.leverageScore.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ownership_${sport}_${contestType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Exported ownership data');
  };

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DST'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
            Ownership Engine V2
          </h1>
          <p className="text-gray-600 mt-1">Real-time ownership projections with leverage scoring</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={fetchOwnership}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={calculateLeverage}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <Zap className="w-5 h-5" />
            Calculate Leverage
          </button>
          
          <button
            onClick={exportSelections}
            disabled={selectedPlayers.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Export ({selectedPlayers.size})
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sport Selection */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Sport</label>
          <div className="grid grid-cols-5 gap-2">
            {['NFL', 'NBA', 'MLB', 'NHL', 'PGA'].map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  sport === s
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Contest Type */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Contest Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setContestType('GPP')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                contestType === 'GPP'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Trophy className="w-4 h-4 inline mr-1" />
              GPP
            </button>
            <button
              onClick={() => setContestType('CASH')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                contestType === 'CASH'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-1" />
              Cash
            </button>
          </div>
        </div>

        {/* Position Filter */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Position Filter</label>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      {ownershipData && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Players</p>
                <p className="text-2xl font-bold">{ownershipData.summary?.totalPlayers || 0}</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Ownership</p>
                <p className="text-2xl font-bold">
                  {ownershipData.summary?.avgOwnership?.toFixed(1) || 0}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Max Ownership</p>
                <p className="text-2xl font-bold text-red-600">
                  {ownershipData.summary?.maxOwnership?.toFixed(1) || 0}%
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chalk Plays</p>
                <p className="text-2xl font-bold text-orange-600">
                  {ownershipData.summary?.chalkPlays || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Leverage Plays</p>
                <p className="text-2xl font-bold text-green-600">
                  {ownershipData.summary?.leveragePlays || 0}
                </p>
              </div>
              <Zap className="w-8 h-8 text-green-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Contrarian</p>
                <p className="text-2xl font-bold text-purple-600">
                  {ownershipData.summary?.contrarianPlays || 0}
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-400" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'leverage', label: 'Leverage Plays', icon: Zap },
              { id: 'chalk', label: 'Chalk Report', icon: TrendingUp },
              { id: 'contrarian', label: 'Contrarian', icon: Target },
              { id: 'stacks', label: 'Stack Analysis', icon: Layers }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Leverage Plays */}
          {activeTab === 'leverage' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Top Leverage Opportunities</h3>
              <div className="space-y-2">
                {ownershipData?.topLeverage
                  ?.filter((p: any) => filterPosition === 'ALL' || p.position === filterPosition)
                  .map((player: any, idx: number) => (
                  <motion.div
                    key={player.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 border rounded-lg hover:border-purple-300 transition-all cursor-pointer ${
                      selectedPlayers.has(player.playerId) ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                    }`}
                    onClick={() => togglePlayer(player.playerId)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{player.playerName}</h4>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {player.position}
                          </span>
                          <span className="text-sm text-gray-600">{player.team}</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-gray-600">
                            ${player.salary.toLocaleString()}
                          </span>
                          <span className="text-blue-600">
                            {player.projectedPoints.toFixed(1)} pts
                          </span>
                          <span className="text-purple-600">
                            {(player.projectedOwnership * 100).toFixed(1)}% owned
                          </span>
                        </div>
                        {player.narrativeFactors?.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {player.narrativeFactors.map((factor: string) => (
                              <span key={factor} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                {factor}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {player.leverageScore.toFixed(2)}x
                        </div>
                        <div className="text-sm text-gray-600">Leverage</div>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className={`w-4 h-4 ${player.confidence > 0.8 ? 'text-yellow-500' : 'text-gray-300'}`} />
                          <span className="text-xs text-gray-600">
                            {(player.confidence * 100).toFixed(0)}% conf
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Chalk Report */}
          {activeTab === 'chalk' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Highest Projected Ownership</h3>
              <div className="space-y-2">
                {ownershipData?.topChalk
                  ?.filter((p: any) => filterPosition === 'ALL' || p.position === filterPosition)
                  .map((player: any, idx: number) => (
                  <motion.div
                    key={player.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-red-300 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{player.playerName}</h4>
                        <div className="flex gap-4 mt-1 text-sm text-gray-600">
                          <span>{player.position} - {player.team}</span>
                          <span>${player.salary.toLocaleString()}</span>
                          <span>{player.projectedPoints.toFixed(1)} pts</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">
                          {(player.projectedOwnership * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">Ownership</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Contrarian Plays */}
          {activeTab === 'contrarian' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Low Ownership Upside</h3>
              <div className="space-y-2">
                {ownershipData?.topContrarian
                  ?.filter((p: any) => filterPosition === 'ALL' || p.position === filterPosition)
                  .map((player: any, idx: number) => (
                  <motion.div
                    key={player.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{player.playerName}</h4>
                        <div className="flex gap-4 mt-1 text-sm text-gray-600">
                          <span>{player.position} - {player.team}</span>
                          <span>${player.salary.toLocaleString()}</span>
                          <span>{player.projectedPoints.toFixed(1)} pts</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">
                          {(player.projectedOwnership * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">Low Owned</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Stack Analysis */}
          {activeTab === 'stacks' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Correlated Stack Opportunities</h3>
              <div className="space-y-3">
                {ownershipData?.stacks?.map((stack: OwnershipStack, idx: number) => (
                  <motion.div
                    key={stack.team}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{stack.team} Stack</h4>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">QB</span>
                            <span className="font-medium">{stack.qb.name}</span>
                            <span className="text-sm text-gray-600">
                              {stack.qb.ownership} • {stack.qb.points.toFixed(1)} pts
                            </span>
                          </div>
                          {stack.receivers.map((receiver, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-2 ml-8">
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                {receiver.position}
                              </span>
                              <span className="font-medium">{receiver.name}</span>
                              <span className="text-sm text-gray-600">
                                {receiver.ownership} • {receiver.leverageScore}x leverage
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-purple-600">
                          {stack.stackLeverage.toFixed(2)}x
                        </div>
                        <div className="text-sm text-gray-600">Stack Leverage</div>
                        <div className="mt-2 text-sm text-gray-500">
                          Combined: {stack.stackOwnership}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Updates Indicator */}
      {ownershipData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-6 right-6 bg-white rounded-lg shadow-lg p-4 border border-gray-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">
              Live Ownership Data
            </span>
            <Eye className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Updated: {new Date(ownershipData.generatedAt).toLocaleTimeString()}
          </div>
        </motion.div>
      )}
    </div>
  );
}