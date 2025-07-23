/**
 * 🔥 ML TRAINING CONTROLS - Enterprise Command Center 🔥
 * 
 * Professional training job management with one-click deployment,
 * emergency stops, and intelligent resource allocation.
 */

'use client';

import { useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
  disabled?: boolean;
}

export function MLTrainingControls() {
  const [isTraining, setIsTraining] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [selectedModel, setSelectedModel] = useState('ultimate-ensemble');
  const [selectedSport, setSelectedSport] = useState('NFL');
  const [batchSize, setBatchSize] = useState(512);
  const [learningRate, setLearningRate] = useState(0.001);

  const handleStartTraining = () => {
    setIsTraining(true);
    console.log('🚀 Starting training job...');
    // Simulate training completion
    setTimeout(() => {
      setIsTraining(false);
    }, 10000);
  };

  const handleEmergencyStop = () => {
    setEmergencyStop(true);
    setIsTraining(false);
    console.log('🛑 Emergency stop activated!');
    setTimeout(() => {
      setEmergencyStop(false);
    }, 3000);
  };

  const quickActions: QuickAction[] = [
    {
      id: 'start-ensemble',
      title: 'Train Ultimate Ensemble',
      description: 'Start training the NFL Ultimate Ensemble Brain with latest data',
      icon: '🧠',
      color: 'from-purple-500 to-pink-500',
      action: handleStartTraining,
      disabled: isTraining
    },
    {
      id: 'optimize-gpu',
      title: 'GPU Optimization',
      description: 'Optimize RTX 4060 performance for current workload',
      icon: '⚡',
      color: 'from-blue-500 to-cyan-500',
      action: () => console.log('🎮 Optimizing GPU...'),
      disabled: false
    },
    {
      id: 'validate-models',
      title: 'Model Validation',
      description: 'Run comprehensive validation on all active models',
      icon: '✅',
      color: 'from-green-500 to-emerald-500',
      action: () => console.log('🔍 Validating models...'),
      disabled: false
    },
    {
      id: 'export-models',
      title: 'Export Models',
      description: 'Export trained models for production deployment',
      icon: '📦',
      color: 'from-orange-500 to-red-500',
      action: () => console.log('📦 Exporting models...'),
      disabled: false
    }
  ];

  return (
    <div className="space-y-6">
      {/* Emergency Controls */}
      <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">🚨 Emergency Controls</h3>
            <p className="text-gray-400 text-sm">Critical system controls and safety overrides</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`px-3 py-2 rounded-lg border ${
              isTraining 
                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isTraining ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-sm font-medium">
                  {isTraining ? 'TRAINING ACTIVE' : 'SYSTEM IDLE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={handleStartTraining}
            disabled={isTraining}
            className={`h-16 ${
              isTraining 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
            } text-white font-semibold transition-all duration-200`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">{isTraining ? '⏳' : '🚀'}</span>
              <div>
                <div className="text-sm">
                  {isTraining ? 'Training in Progress...' : 'Start Training'}
                </div>
                <div className="text-xs opacity-80">
                  {isTraining ? 'Please wait...' : 'Begin ML training job'}
                </div>
              </div>
            </div>
          </Button>

          <Button
            onClick={handleEmergencyStop}
            disabled={!isTraining || emergencyStop}
            className={`h-16 ${
              !isTraining || emergencyStop
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
            } text-white font-semibold transition-all duration-200`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">{emergencyStop ? '⏹️' : '🛑'}</span>
              <div>
                <div className="text-sm">
                  {emergencyStop ? 'Stopping...' : 'Emergency Stop'}
                </div>
                <div className="text-xs opacity-80">
                  {emergencyStop ? 'Shutting down...' : 'Immediate halt'}
                </div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => console.log('🔄 Restarting services...')}
            className="h-16 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold transition-all duration-200"
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">🔄</span>
              <div>
                <div className="text-sm">Restart Services</div>
                <div className="text-xs opacity-80">Full system restart</div>
              </div>
            </div>
          </Button>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">⚡ Quick Actions</h3>
          <div className="text-gray-400 text-sm">One-click operations</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              disabled={action.disabled}
              className={`relative p-4 rounded-lg border border-white/10 transition-all duration-200 group ${
                action.disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-10 rounded-lg ${
                !action.disabled && 'group-hover:opacity-20'
              } transition-opacity duration-200`}></div>
              
              <div className="relative">
                <div className="text-2xl mb-2">{action.icon}</div>
                <div className="text-white font-medium text-sm mb-1">{action.title}</div>
                <div className="text-gray-400 text-xs">{action.description}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Training Configuration */}
      <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">🎛️ Training Configuration</h3>
          <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
            Load Preset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Model Type</label>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500/50 focus:outline-none"
            >
              <option value="ultimate-ensemble">Ultimate Ensemble Brain</option>
              <option value="xgboost-ensemble">XGBoost Ensemble</option>
              <option value="lstm-temporal">LSTM Temporal</option>
              <option value="median-predictor">Elite Median Predictor</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Sport</label>
            <select 
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500/50 focus:outline-none"
            >
              <option value="NFL">🏈 NFL</option>
              <option value="NBA">🏀 NBA</option>
              <option value="MLB">⚾ MLB</option>
              <option value="NHL">🏒 NHL</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Batch Size</label>
            <select 
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500/50 focus:outline-none"
            >
              <option value={128}>128 (Fast)</option>
              <option value={256}>256 (Balanced)</option>
              <option value={512}>512 (Optimal)</option>
              <option value={1024}>1024 (Max Quality)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Learning Rate</label>
            <select 
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500/50 focus:outline-none"
            >
              <option value={0.0001}>0.0001 (Conservative)</option>
              <option value={0.0005}>0.0005 (Stable)</option>
              <option value={0.001}>0.001 (Optimal)</option>
              <option value={0.005}>0.005 (Aggressive)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-gray-400 text-sm">
            Estimated training time: ~2.5 hours | GPU Memory: ~6.8GB | Samples: 842K+
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
              Save Config
            </button>
            <button 
              onClick={handleStartTraining}
              disabled={isTraining}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTraining
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
              }`}
            >
              {isTraining ? '⏳ Training...' : '🚀 Start Advanced Training'}
            </button>
          </div>
        </div>
      </Card>

      {/* Resource Allocation */}
      <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">🎮 Resource Allocation</h3>
          <div className="text-green-400 text-sm font-medium">RTX 4060 Optimized</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/60 border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm font-medium mb-2">GPU Utilization Target</div>
            <div className="text-white text-2xl font-bold mb-2">85%</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="w-4/5 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Optimal for RTX 4060</div>
          </div>

          <div className="bg-black/60 border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm font-medium mb-2">VRAM Allocation</div>
            <div className="text-white text-2xl font-bold mb-2">6.8GB</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="w-5/6 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
            </div>
            <div className="text-xs text-gray-500 mt-2">83% of 8GB total</div>
          </div>

          <div className="bg-black/60 border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm font-medium mb-2">CUDA Cores Active</div>
            <div className="text-white text-2xl font-bold mb-2">2,847</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="w-11/12 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></div>
            </div>
            <div className="text-xs text-gray-500 mt-2">93% of 3,072 cores</div>
          </div>
        </div>
      </Card>
    </div>
  );
}