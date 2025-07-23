/**
 * 🔥 ML PERFORMANCE METRICS - Advanced Analytics Dashboard 🔥
 * 
 * TensorBoard-quality performance analytics with interactive charts,
 * cross-validation results, and hyperparameter optimization tracking.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';

interface PerformanceData {
  sport: string;
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  samples: number;
  lastUpdated: string;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

interface TrainingMetrics {
  epoch: number;
  trainingLoss: number;
  validationLoss: number;
  accuracy: number;
  learningRate: number;
}

export function MLPerformanceMetrics() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '6h' | '24h' | '7d'>('6h');
  const [selectedMetric, setSelectedMetric] = useState<'accuracy' | 'loss' | 'f1' | 'auc'>('accuracy');
  
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([
    {
      sport: 'NFL',
      model: 'Ultimate Ensemble Brain',
      accuracy: 96.97,
      precision: 94.2,
      recall: 91.8,
      f1Score: 93.0,
      auc: 0.978,
      samples: 842391,
      lastUpdated: '2 min ago',
      trend: 'up',
      confidence: 98.4
    },
    {
      sport: 'NBA',
      model: 'Player Performance AI',
      accuracy: 89.4,
      precision: 87.6,
      recall: 88.9,
      f1Score: 88.2,
      auc: 0.924,
      samples: 456723,
      lastUpdated: '5 min ago',
      trend: 'stable',
      confidence: 94.7
    },
    {
      sport: 'MLB',
      model: 'Stack Optimizer Pro',
      accuracy: 84.7,
      precision: 82.1,
      recall: 85.3,
      f1Score: 83.7,
      auc: 0.891,
      samples: 298435,
      lastUpdated: '3 min ago',
      trend: 'up',
      confidence: 91.2
    },
    {
      sport: 'NHL',
      model: 'Ice Analytics Engine',
      accuracy: 78.9,
      precision: 76.4,
      recall: 79.8,
      f1Score: 78.1,
      auc: 0.845,
      samples: 189267,
      lastUpdated: '7 min ago',
      trend: 'down',
      confidence: 87.6
    }
  ]);

  const [trainingHistory, setTrainingHistory] = useState<TrainingMetrics[]>(
    Array.from({ length: 50 }, (_, i) => ({
      epoch: i + 1,
      trainingLoss: Math.max(0.1, 2.0 - (i * 0.03) + Math.random() * 0.1),
      validationLoss: Math.max(0.1, 2.2 - (i * 0.032) + Math.random() * 0.12),
      accuracy: Math.min(99, 20 + (i * 1.5) + Math.random() * 2),
      learningRate: 0.001 * Math.pow(0.95, Math.floor(i / 10))
    }))
  );

  const [hyperparameterResults, setHyperparameterResults] = useState([
    { config: 'lr=0.001, batch=512', accuracy: 96.97, time: '2.3h', status: 'best' },
    { config: 'lr=0.005, batch=256', accuracy: 94.2, time: '1.8h', status: 'completed' },
    { config: 'lr=0.0005, batch=1024', accuracy: 95.8, time: '3.1h', status: 'completed' },
    { config: 'lr=0.002, batch=128', accuracy: 92.1, time: '4.2h', status: 'completed' },
    { config: 'lr=0.001, batch=256', accuracy: 93.7, time: '2.1h', status: 'running' }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPerformanceData(prev => prev.map(model => ({
        ...model,
        accuracy: Math.max(70, Math.min(99.9, model.accuracy + (Math.random() - 0.5) * 0.2)),
        precision: Math.max(70, Math.min(99, model.precision + (Math.random() - 0.5) * 0.3)),
        recall: Math.max(70, Math.min(99, model.recall + (Math.random() - 0.5) * 0.3)),
        f1Score: Math.max(70, Math.min(99, model.f1Score + (Math.random() - 0.5) * 0.25)),
        confidence: Math.max(80, Math.min(99.9, model.confidence + (Math.random() - 0.5) * 0.5))
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      case 'stable': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'NFL': return '🏈';
      case 'NBA': return '🏀';
      case 'MLB': return '⚾';
      case 'NHL': return '🏒';
      default: return '🏆';
    }
  };

  const getMetricValue = (data: PerformanceData, metric: string) => {
    switch (metric) {
      case 'accuracy': return data.accuracy.toFixed(2);
      case 'f1': return data.f1Score.toFixed(2);
      case 'auc': return data.auc.toFixed(3);
      default: return data.accuracy.toFixed(2);
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {performanceData.map((model, index) => (
          <Card key={index} className="bg-black/40 backdrop-blur-lg border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getSportIcon(model.sport)}</span>
                <div>
                  <div className="text-white font-medium text-sm">{model.sport}</div>
                  <div className="text-gray-400 text-xs">{model.model}</div>
                </div>
              </div>
              <div className={`flex items-center space-x-1 ${getTrendColor(model.trend)}`}>
                <span className="text-xs">{getTrendIcon(model.trend)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Accuracy</span>
                <span className="text-white font-bold">{model.accuracy.toFixed(2)}%</span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${model.accuracy}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">F1:</span>
                  <span className="text-white font-medium ml-1">{model.f1Score.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-gray-500">AUC:</span>
                  <span className="text-white font-medium ml-1">{model.auc.toFixed(3)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{model.samples.toLocaleString()} samples</span>
                  <span className="text-gray-500">{model.lastUpdated}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Training Progress Chart */}
      <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">📊 Training Progress Analytics</h3>
          <div className="flex items-center space-x-4">
            <select 
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="accuracy">Accuracy</option>
              <option value="loss">Loss</option>
              <option value="f1">F1 Score</option>
              <option value="auc">AUC</option>
            </select>
            
            <div className="flex items-center space-x-2">
              {(['1h', '6h', '24h', '7d'] as const).map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedTimeframe === timeframe
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-black/60 text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Training History Chart */}
        <div className="bg-black/60 border border-white/10 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium">Training Loss Curves</h4>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-1 bg-blue-500 rounded"></div>
                <span className="text-gray-400">Training Loss</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-1 bg-purple-500 rounded"></div>
                <span className="text-gray-400">Validation Loss</span>
              </div>
            </div>
          </div>
          
          <div className="relative h-40">
            <div className="absolute inset-0 flex items-end space-x-1">
              {trainingHistory.slice(-30).map((point, index) => (
                <div key={index} className="flex-1 flex flex-col justify-end space-y-1">
                  <div
                    className="bg-purple-500 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(2, (1 - point.validationLoss / 2) * 160)}px` }}
                  />
                  <div
                    className="bg-blue-500 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(2, (1 - point.trainingLoss / 2) * 160)}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Epoch {trainingHistory[trainingHistory.length - 30]?.epoch || 1}</span>
            <span>Current Epoch {trainingHistory[trainingHistory.length - 1]?.epoch || 50}</span>
          </div>
        </div>

        {/* Model Comparison Table */}
        <div className="bg-black/60 border border-white/10 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">🏆 Model Performance Comparison</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-gray-400 text-xs font-medium py-2">Model</th>
                  <th className="text-center text-gray-400 text-xs font-medium py-2">Accuracy</th>
                  <th className="text-center text-gray-400 text-xs font-medium py-2">Precision</th>
                  <th className="text-center text-gray-400 text-xs font-medium py-2">Recall</th>
                  <th className="text-center text-gray-400 text-xs font-medium py-2">F1 Score</th>
                  <th className="text-center text-gray-400 text-xs font-medium py-2">Confidence</th>
                  <th className="text-center text-gray-400 text-xs font-medium py-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((model, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        <span>{getSportIcon(model.sport)}</span>
                        <div>
                          <div className="text-white text-sm font-medium">{model.sport}</div>
                          <div className="text-gray-400 text-xs">{model.model}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="text-white font-bold">{model.accuracy.toFixed(2)}%</span>
                    </td>
                    <td className="text-center">
                      <span className="text-white">{model.precision.toFixed(1)}%</span>
                    </td>
                    <td className="text-center">
                      <span className="text-white">{model.recall.toFixed(1)}%</span>
                    </td>
                    <td className="text-center">
                      <span className="text-white">{model.f1Score.toFixed(1)}%</span>
                    </td>
                    <td className="text-center">
                      <span className="text-green-400 font-medium">{model.confidence.toFixed(1)}%</span>
                    </td>
                    <td className="text-center">
                      <span className={getTrendColor(model.trend)}>
                        {getTrendIcon(model.trend)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Hyperparameter Optimization */}
      <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">🎛️ Hyperparameter Optimization</h3>
          <div className="text-green-400 text-sm font-medium">5 experiments running</div>
        </div>

        <div className="space-y-3">
          {hyperparameterResults.map((result, index) => (
            <div key={index} className="bg-black/60 border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`px-2 py-1 rounded-md text-xs font-medium border ${
                    result.status === 'best' 
                      ? 'bg-gold-500/20 text-yellow-400 border-yellow-500/30' 
                      : result.status === 'running'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    {result.status === 'best' ? '🏆 BEST' : result.status === 'running' ? '🔄 RUNNING' : '✅ DONE'}
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{result.config}</div>
                    <div className="text-gray-400 text-xs">Training time: {result.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold text-lg">{result.accuracy.toFixed(2)}%</div>
                  <div className="text-gray-400 text-xs">Accuracy</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}