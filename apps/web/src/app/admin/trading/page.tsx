'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  Play,
  Pause,
  RefreshCw,
  Settings,
  BarChart3,
  Trophy,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  Shield,
  Brain
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../../../lib/logging/logger';

type TradingStrategy = 'aggressive' | 'balanced' | 'conservative';
type SessionStatus = 'idle' | 'active' | 'analyzing' | 'executing' | 'monitoring';

interface TradingSession {
  id: string;
  status: string;
  strategy: string;
  bankroll: number;
  allocatedBankroll: number;
  sport: string;
  contestTypes: string[];
  performance: {
    totalEntries: number;
    totalInvested: number;
    totalReturns: number;
    roi: number;
    winRate: number;
  };
}

interface Opportunity {
  contestId: string;
  contestName: string;
  entryFee: number;
  expectedROI: number;
  confidenceScore: number;
  overlay?: number;
  reason?: string;
}

export default function TradingDashboard() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [currentSession, setCurrentSession] = useState<TradingSession | null>(null);
  const [strategy, setStrategy] = useState<TradingStrategy>('balanced');
  const [bankroll, setBankroll] = useState(1000);
  const [sport, setSport] = useState('NFL');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Add log entry
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '📊';
    setLogs(prev => [`${timestamp} ${icon} ${message}`, ...prev].slice(0, 50));
  };

  // Start trading session
  const startTrading = async () => {
    try {
      setSessionStatus('active');
      addLog('Starting trading session...', 'info');

      const response = await fetch('/api/admin/trading/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          strategy,
          bankroll,
          sport,
          contestTypes: ['gpp', 'cash']
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentSession(data.session);
        setOpportunities(data.opportunities || []);
        toast.success('Trading session started!');
        addLog(`Session ${data.sessionId} started with ${strategy} strategy`, 'success');
        
        // Start monitoring
        setTimeout(() => monitorPositions(), 5000);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Start trading error:', { error: error });
      toast.error('Failed to start trading');
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setSessionStatus('idle');
    }
  };

  // Analyze opportunities
  const analyzeOpportunities = async () => {
    try {
      setSessionStatus('analyzing');
      addLog('Analyzing market opportunities...', 'info');

      const response = await fetch('/api/admin/trading/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          sport,
          contestTypes: ['gpp', 'cash']
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setOpportunities(data.opportunities || []);
        toast.success(`Found ${data.profitableContests} profitable contests!`);
        addLog(`Analysis complete: ${data.profitableContests} +EV contests found`, 'success');
        setSessionStatus('active');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Analysis error:', { error: error });
      toast.error('Analysis failed');
      addLog(`Analysis error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
      setSessionStatus('active');
    }
  };

  // Execute trades
  const executeTrades = async (selectedOpportunities: Opportunity[]) => {
    try {
      setSessionStatus('executing');
      addLog(`Executing ${selectedOpportunities.length} trades...`, 'info');

      // Convert opportunities to trades
      const trades = selectedOpportunities.map(opp => ({
        contestId: opp.contestId,
        entryFee: opp.entryFee,
        projectedROI: opp.expectedROI,
        lineup: {
          // In production, this would use the optimizer
          players: ['Player1', 'Player2', 'Player3']
        }
      }));

      const response = await fetch('/api/admin/trading/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          trades
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Executed ${data.executed} trades!`);
        addLog(`Trades executed: ${data.executed} successful, ${data.failed} failed`, 'success');
        addLog(`Total invested: $${data.totalInvested}`, 'info');
        setSessionStatus('monitoring');
        
        // Start monitoring
        setTimeout(() => monitorPositions(), 3000);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Execute trades error:', { error: error });
      toast.error('Trade execution failed');
      addLog(`Execution error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
      setSessionStatus('active');
    }
  };

  // Monitor positions
  const monitorPositions = async () => {
    try {
      const response = await fetch('/api/admin/trading/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'monitor' })
      });

      const data = await response.json();
      
      if (data.success) {
        setPerformance(data.performance);
        
        // Add alerts to logs
        data.alerts?.forEach((alert: any) => {
          addLog(alert.message, alert.type === 'success' ? 'success' : 'info');
        });
        
        // Continue monitoring if session is active
        if (sessionStatus === 'monitoring' || sessionStatus === 'active') {
          setTimeout(() => monitorPositions(), 10000); // Every 10 seconds
        }
      }
    } catch (error) {
      logger.error('Monitor error:', { error: error });
    }
  };

  // Stop trading
  const stopTrading = async () => {
    try {
      const response = await fetch('/api/admin/trading/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Trading session stopped');
        addLog('Trading session ended', 'success');
        if (data.finalPerformance) {
          addLog(`Final P&L: $${data.finalPerformance.netProfit} (${(data.finalPerformance.roi * 100).toFixed(1)}% ROI)`, 'success');
        }
        setSessionStatus('idle');
        setCurrentSession(null);
      }
    } catch (error) {
      logger.error('Stop trading error:', { error: error });
      toast.error('Failed to stop trading');
    }
  };

  const strategyConfig = {
    aggressive: {
      icon: <Zap className="w-5 h-5" />,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      description: '25% bankroll, high risk/reward'
    },
    balanced: {
      icon: <Brain className="w-5 h-5" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: '15% bankroll, moderate approach'
    },
    conservative: {
      icon: <Shield className="w-5 h-5" />,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: '8% bankroll, safety first'
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
            Trading Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Automated DFS Trading System</p>
        </div>
        
        <div className="flex gap-3">
          {sessionStatus === 'idle' ? (
            <button
              onClick={startTrading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Play className="w-5 h-5" />
              Start Trading
            </button>
          ) : (
            <button
              onClick={stopTrading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Pause className="w-5 h-5" />
              Stop Trading
            </button>
          )}
          
          <button
            onClick={analyzeOpportunities}
            disabled={sessionStatus !== 'active'}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5" />
            Analyze
          </button>
        </div>
      </div>

      {/* Trading Configuration */}
      {sessionStatus === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Strategy Selection */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Strategy</h3>
            <div className="space-y-3">
              {(['aggressive', 'balanced', 'conservative'] as TradingStrategy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className={`w-full p-3 rounded-lg border-2 transition-all ${
                    strategy === s ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${strategyConfig[s].bgColor} ${strategyConfig[s].color}`}>
                      {strategyConfig[s].icon}
                    </div>
                    <div className="text-left">
                      <div className="font-medium capitalize">{s}</div>
                      <div className="text-sm text-gray-600">{strategyConfig[s].description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bankroll Configuration */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Bankroll</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Total Bankroll</label>
                <input
                  type="number"
                  value={bankroll}
                  onChange={(e) => setBankroll(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Allocated</span>
                  <span className="font-medium">
                    ${(bankroll * (strategy === 'aggressive' ? 0.25 : strategy === 'balanced' ? 0.15 : 0.08)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Max Risk</span>
                  <span className="font-medium">
                    {strategy === 'aggressive' ? '25%' : strategy === 'balanced' ? '15%' : '8%'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sport Selection */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Sport</h3>
            <div className="space-y-2">
              {['NFL', 'NBA', 'MLB', 'NHL', 'PGA'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`w-full px-4 py-2 rounded-lg transition-all ${
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
        </div>
      )}

      {/* Performance Dashboard */}
      {(sessionStatus !== 'idle' || performance) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total P&L</p>
                <p className={`text-2xl font-bold ${
                  performance?.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${performance?.unrealizedPnL?.toFixed(2) || '0.00'}
                </p>
              </div>
              {performance?.unrealizedPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {((performance?.winRate || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <Trophy className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg ROI</p>
                <p className="text-2xl font-bold text-purple-600">
                  {((performance?.avgROI || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Contests</p>
                <p className="text-2xl font-bold text-gray-800">
                  {performance?.activeContests || 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-gray-500" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Opportunities & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trading Opportunities */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Opportunities</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              sessionStatus === 'analyzing' ? 'bg-blue-100 text-blue-700' :
              sessionStatus === 'executing' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {sessionStatus.toUpperCase()}
            </span>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {opportunities.length > 0 ? (
              opportunities.map((opp, idx) => (
                <motion.div
                  key={opp.contestId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{opp.contestName}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Entry: ${opp.entryFee} | ROI: {(opp.expectedROI * 100).toFixed(1)}%
                      </p>
                      {opp.overlay && (
                        <p className="text-sm text-green-600 mt-1">
                          {opp.overlay.toFixed(1)}% overlay
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        opp.confidenceScore > 0.8 ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {(opp.confidenceScore * 100).toFixed(0)}% confidence
                      </div>
                      {sessionStatus === 'active' && (
                        <button
                          onClick={() => executeTrades([opp])}
                          className="mt-2 px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-all"
                        >
                          Enter
                        </button>
                      )}
                    </div>
                  </div>
                  {opp.reason && (
                    <p className="text-xs text-gray-500 mt-2">{opp.reason}</p>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {sessionStatus === 'idle' ? 
                  'Start trading to see opportunities' : 
                  'No opportunities found yet'
                }
              </div>
            )}
          </div>
          
          {opportunities.length > 3 && sessionStatus === 'active' && (
            <button
              onClick={() => executeTrades(opportunities.slice(0, 5))}
              className="w-full mt-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all"
            >
              Execute Top 5 Trades
            </button>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Activity Log</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`py-1 ${
                    log.includes('❌') ? 'text-red-600' :
                    log.includes('✅') ? 'text-green-600' :
                    'text-gray-600'
                  }`}
                >
                  {log}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trading Status Indicator */}
      {sessionStatus !== 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-6 right-6 bg-white rounded-lg shadow-lg p-4 border border-gray-200"
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              sessionStatus === 'active' ? 'bg-green-500' :
              sessionStatus === 'analyzing' ? 'bg-blue-500' :
              sessionStatus === 'executing' ? 'bg-orange-500' :
              'bg-purple-500'
            }`} />
            <span className="text-sm font-medium">
              Trading {sessionStatus === 'monitoring' ? 'Active' : sessionStatus}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}