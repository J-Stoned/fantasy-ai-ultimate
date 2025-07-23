/**
 * 🔥 ML MODEL REGISTRY - Enterprise Model Management 🔥
 * 
 * Professional model versioning, deployment tracking, and A/B testing
 * with enterprise-grade model lifecycle management.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';

interface ModelVersion {
  id: string;
  name: string;
  version: string;
  sport: string;
  status: 'production' | 'staging' | 'testing' | 'deprecated' | 'training';
  accuracy: number;
  deployedAt: string;
  trainingTime: string;
  modelSize: string;
  samples: number;
  framework: string;
  author: string;
  description: string;
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
  };
  deployment: {
    environment: string;
    instances: number;
    avgLatency: number;
    requestsPerSecond: number;
  };
}

export function MLModelRegistry() {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'production' | 'staging' | 'testing'>('all');
  const [selectedSport, setSelectedSport] = useState<'all' | 'NFL' | 'NBA' | 'MLB' | 'NHL'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [models, setModels] = useState<ModelVersion[]>([
    {
      id: 'model_nfl_ensemble_v2_1',
      name: 'Ultimate Ensemble Brain',
      version: 'v2.1.3',
      sport: 'NFL',
      status: 'production',
      accuracy: 96.97,
      deployedAt: '2025-01-20 14:23:15',
      trainingTime: '2.3 hours',
      modelSize: '342 MB',
      samples: 842391,
      framework: 'Custom TypeScript',
      author: 'AI Team',
      description: 'Advanced ensemble model combining median, XGBoost, and LSTM predictors',
      metrics: {
        precision: 94.2,
        recall: 91.8,
        f1Score: 93.0,
        auc: 0.978
      },
      deployment: {
        environment: 'Production',
        instances: 3,
        avgLatency: 87,
        requestsPerSecond: 1247
      }
    },
    {
      id: 'model_nba_predictor_v1_5',
      name: 'NBA Player Performance AI',
      version: 'v1.5.2',
      sport: 'NBA',
      status: 'production',
      accuracy: 89.4,
      deployedAt: '2025-01-19 11:45:22',
      trainingTime: '1.8 hours',
      modelSize: '187 MB',
      samples: 456723,
      framework: 'TensorFlow.js',
      author: 'ML Research',
      description: 'Neural network for NBA player performance prediction with temporal features',
      metrics: {
        precision: 87.6,
        recall: 88.9,
        f1Score: 88.2,
        auc: 0.924
      },
      deployment: {
        environment: 'Production',
        instances: 2,
        avgLatency: 112,
        requestsPerSecond: 892
      }
    },
    {
      id: 'model_mlb_optimizer_v3_0',
      name: 'MLB Stack Optimizer Pro',
      version: 'v3.0.1',
      sport: 'MLB',
      status: 'staging',
      accuracy: 84.7,
      deployedAt: '2025-01-21 09:12:33',
      trainingTime: '3.1 hours',
      modelSize: '456 MB',
      samples: 298435,
      framework: 'Custom Algorithm',
      author: 'Optimization Team',
      description: 'Advanced MLB lineup optimization with stack correlation analysis',
      metrics: {
        precision: 82.1,
        recall: 85.3,
        f1Score: 83.7,
        auc: 0.891
      },
      deployment: {
        environment: 'Staging',
        instances: 1,
        avgLatency: 156,
        requestsPerSecond: 234
      }
    },
    {
      id: 'model_nhl_analytics_v1_2',
      name: 'Ice Analytics Engine',
      version: 'v1.2.4',
      sport: 'NHL',
      status: 'testing',
      accuracy: 78.9,
      deployedAt: '2025-01-20 16:30:45',
      trainingTime: '4.2 hours',
      modelSize: '298 MB',
      samples: 189267,
      framework: 'PyTorch',
      author: 'Hockey Analytics',
      description: 'Specialized NHL prediction model with ice time and line matching features',
      metrics: {
        precision: 76.4,
        recall: 79.8,
        f1Score: 78.1,
        auc: 0.845
      },
      deployment: {
        environment: 'Testing',
        instances: 1,
        avgLatency: 203,
        requestsPerSecond: 67
      }
    },
    {
      id: 'model_gpu_optimizer_v2_0',
      name: 'GPU Optimizer Service',
      version: 'v2.0.0',
      sport: 'Multi',
      status: 'production',
      accuracy: 99.1,
      deployedAt: '2025-01-18 08:15:12',
      trainingTime: '0.8 hours',
      modelSize: '89 MB',
      samples: 672841,
      framework: 'CUDA/TensorFlow',
      author: 'GPU Team',
      description: 'RTX 4060 optimized lineup generation with sub-100ms performance',
      metrics: {
        precision: 98.7,
        recall: 99.2,
        f1Score: 98.9,
        auc: 0.995
      },
      deployment: {
        environment: 'Production',
        instances: 4,
        avgLatency: 67,
        requestsPerSecond: 2156
      }
    }
  ]);

  const filteredModels = models.filter(model => {
    const matchesFilter = selectedFilter === 'all' || model.status === selectedFilter;
    const matchesSport = selectedSport === 'all' || model.sport === selectedSport;
    const matchesSearch = searchQuery === '' || 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSport && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'production': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'staging': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'testing': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'deprecated': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'training': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'production': return '🚀';
      case 'staging': return '🔧';
      case 'testing': return '🧪';
      case 'deprecated': return '🗑️';
      case 'training': return '🔄';
      default: return '📊';
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case 'NFL': return '🏈';
      case 'NBA': return '🏀';
      case 'MLB': return '⚾';
      case 'NHL': return '🏒';
      case 'Multi': return '🏆';
      default: return '🎯';
    }
  };

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">🗃️ Model Registry</h3>
          <p className="text-gray-400 text-sm">Enterprise model lifecycle management</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-green-400 text-sm font-medium">
            {models.filter(m => m.status === 'production').length} Production Models
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <label className="text-gray-400 text-sm">Status:</label>
          <select 
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as any)}
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="testing">Testing</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-gray-400 text-sm">Sport:</label>
          <select 
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value as any)}
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">All Sports</option>
            <option value="NFL">🏈 NFL</option>
            <option value="NBA">🏀 NBA</option>
            <option value="MLB">⚾ MLB</option>
            <option value="NHL">🏒 NHL</option>
          </select>
        </div>

        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
          />
        </div>

        <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
          <span className="mr-2">📤</span>
          Deploy New Model
        </Button>
      </div>

      {/* Model Cards */}
      <div className="space-y-4">
        {filteredModels.map((model) => (
          <div key={model.id} className="bg-black/60 border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-4">
                <div className="text-2xl">{getSportIcon(model.sport)}</div>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-white font-semibold text-lg">{model.name}</h4>
                    <span className="text-gray-400 font-mono text-sm">{model.version}</span>
                    <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(model.status)}`}>
                      {getStatusIcon(model.status)} {model.status.toUpperCase()}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{model.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>By {model.author}</span>
                    <span>•</span>
                    <span>Deployed {model.deployedAt}</span>
                    <span>•</span>
                    <span>{model.framework}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" className="border-white/10 text-gray-400 hover:text-white">
                  📊 Metrics
                </Button>
                <Button size="sm" variant="outline" className="border-white/10 text-gray-400 hover:text-white">
                  🔧 Deploy
                </Button>
                <Button size="sm" variant="outline" className="border-white/10 text-gray-400 hover:text-white">
                  📋 Logs
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
              <div className="bg-black/40 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">Accuracy</div>
                <div className="text-white font-bold text-lg">{model.accuracy.toFixed(2)}%</div>
              </div>
              
              <div className="bg-black/40 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">F1 Score</div>
                <div className="text-white font-bold text-lg">{model.metrics.f1Score.toFixed(1)}</div>
              </div>
              
              <div className="bg-black/40 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">Model Size</div>
                <div className="text-white font-bold text-lg">{model.modelSize}</div>
              </div>
              
              <div className="bg-black/40 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">Samples</div>
                <div className="text-white font-bold text-lg">{(model.samples / 1000).toFixed(0)}K</div>
              </div>
              
              <div className="bg-black/40 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">Latency</div>
                <div className="text-white font-bold text-lg">{model.deployment.avgLatency}ms</div>
              </div>
              
              <div className="bg-black/40 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">RPS</div>
                <div className="text-white font-bold text-lg">{model.deployment.requestsPerSecond}</div>
              </div>
            </div>

            {/* Deployment Info */}
            <div className="bg-black/40 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-white font-medium text-sm">🚀 Deployment Status</h5>
                <div className="text-gray-400 text-xs">{model.deployment.environment}</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-400 text-xs mb-1">Active Instances</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-white font-bold">{model.deployment.instances}</div>
                    <div className="flex space-x-1">
                      {Array.from({ length: model.deployment.instances }, (_, i) => (
                        <div key={i} className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-xs mb-1">Performance</div>
                  <div className="text-white font-bold">
                    {model.deployment.avgLatency}ms avg • {model.deployment.requestsPerSecond} RPS
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-400 text-xs mb-1">Health</div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">🔍 No models found</div>
          <div className="text-gray-400 text-sm">Try adjusting your filters or search criteria</div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 bg-black/60 border border-white/10 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-white font-bold text-xl">{models.length}</div>
            <div className="text-gray-400 text-sm">Total Models</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-bold text-xl">
              {models.filter(m => m.status === 'production').length}
            </div>
            <div className="text-gray-400 text-sm">Production</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-xl">
              {models.reduce((acc, m) => acc + m.deployment.instances, 0)}
            </div>
            <div className="text-gray-400 text-sm">Active Instances</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-xl">
              {models.reduce((acc, m) => acc + m.deployment.requestsPerSecond, 0).toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm">Total RPS</div>
          </div>
        </div>
      </div>
    </Card>
  );
}