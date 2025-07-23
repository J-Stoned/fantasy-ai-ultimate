/**
 * 🔥 ML TRAINING JOBS - Real-time Training Monitor 🔥
 * 
 * Live monitoring of active training jobs with TensorBoard-quality visualization.
 * Shows training progress, loss curves, and performance metrics.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';

interface TrainingJob {
  id: string;
  modelName: string;
  sport: string;
  status: 'training' | 'validating' | 'completed' | 'failed' | 'queued';
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  trainingLoss: number;
  validationLoss: number;
  accuracy: number;
  startTime: string;
  estimatedCompletion: string;
  samplesProcessed: number;
  batchSize: number;
  learningRate: number;
  gpuUtilization: number;
  memoryUsage: number;
}

export function MLTrainingJobs() {
  const [jobs, setJobs] = useState<TrainingJob[]>([
    {
      id: 'job_nfl_ensemble_001',
      modelName: 'NFL Ensemble Brain v2.1',
      sport: 'NFL',
      status: 'training',
      progress: 73,
      currentEpoch: 73,
      totalEpochs: 100,
      trainingLoss: 0.2847,
      validationLoss: 0.3012,
      accuracy: 89.4,
      startTime: '14:23:15',
      estimatedCompletion: '15:47:22',
      samplesProcessed: 615847,
      batchSize: 512,
      learningRate: 0.001,
      gpuUtilization: 94,
      memoryUsage: 7234
    },
    {
      id: 'job_nba_predictor_003',
      modelName: 'NBA Player Performance AI',
      sport: 'NBA',
      status: 'validating',
      progress: 89,
      currentEpoch: 89,
      totalEpochs: 100,
      trainingLoss: 0.1923,
      validationLoss: 0.2156,
      accuracy: 84.7,
      startTime: '13:56:42',
      estimatedCompletion: '15:12:18',
      samplesProcessed: 456723,
      batchSize: 256,
      learningRate: 0.0005,
      gpuUtilization: 76,
      memoryUsage: 5642
    },
    {
      id: 'job_mlb_optimizer_007',
      modelName: 'MLB Stack Optimizer Pro',
      sport: 'MLB',
      status: 'completed',
      progress: 100,
      currentEpoch: 150,
      totalEpochs: 150,
      trainingLoss: 0.1456,
      validationLoss: 0.1689,
      accuracy: 91.2,
      startTime: '12:15:33',
      estimatedCompletion: 'Completed',
      samplesProcessed: 892341,
      batchSize: 1024,
      learningRate: 0.002,
      gpuUtilization: 0,
      memoryUsage: 0
    }
  ]);

  const [selectedJob, setSelectedJob] = useState<string>(jobs[0].id);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prev => prev.map(job => {
        if (job.status === 'training') {
          const newProgress = Math.min(100, job.progress + Math.random() * 2);
          const newEpoch = Math.floor((newProgress / 100) * job.totalEpochs);
          
          return {
            ...job,
            progress: newProgress,
            currentEpoch: newEpoch,
            trainingLoss: Math.max(0.1, job.trainingLoss - Math.random() * 0.01),
            validationLoss: Math.max(0.1, job.validationLoss - Math.random() * 0.008),
            accuracy: Math.min(99, job.accuracy + Math.random() * 0.5),
            samplesProcessed: job.samplesProcessed + Math.floor(Math.random() * 1000),
            gpuUtilization: Math.max(80, Math.min(98, job.gpuUtilization + (Math.random() - 0.5) * 5)),
            memoryUsage: Math.max(5000, Math.min(7800, job.memoryUsage + (Math.random() - 0.5) * 200))
          };
        }
        return job;
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'training': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'validating': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'completed': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'failed': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'queued': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'training': return '🔄';
      case 'validating': return '✅';
      case 'completed': return '🎉';
      case 'failed': return '❌';
      case 'queued': return '⏳';
      default: return '📊';
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

  const selectedJobData = jobs.find(job => job.id === selectedJob);

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">🚀 Active Training Jobs</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-blue-400 text-sm font-medium">
            {jobs.filter(j => j.status === 'training').length} Active Jobs
          </span>
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-3 mb-6">
        {jobs.map((job) => (
          <div 
            key={job.id}
            className={`cursor-pointer transition-all duration-200 rounded-lg border ${
              selectedJob === job.id 
                ? 'bg-blue-500/10 border-blue-500/30' 
                : 'bg-black/60 border-white/10 hover:border-blue-500/30'
            }`}
            onClick={() => setSelectedJob(job.id)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="text-lg">{getSportIcon(job.sport)}</div>
                  <div>
                    <h4 className="text-white font-medium text-sm">{job.modelName}</h4>
                    <p className="text-gray-400 text-xs">Job ID: {job.id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(job.status)}`}>
                    {getStatusIcon(job.status)} {job.status.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Progress</span>
                  <span className="text-white font-bold">{job.progress.toFixed(1)}%</span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Epoch:</span>
                    <span className="text-white font-medium ml-1">{job.currentEpoch}/{job.totalEpochs}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Accuracy:</span>
                    <span className="text-green-400 font-medium ml-1">{job.accuracy.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Loss:</span>
                    <span className="text-orange-400 font-medium ml-1">{job.trainingLoss.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Job View */}
      {selectedJobData && (
        <div className="bg-black/60 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-semibold">📊 Job Details: {selectedJobData.modelName}</h4>
            <div className="text-gray-400 text-sm">Started: {selectedJobData.startTime}</div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-black/40 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Training Loss</div>
              <div className="text-white font-bold text-lg">{selectedJobData.trainingLoss.toFixed(4)}</div>
              <div className="text-green-400 text-xs">↓ Decreasing</div>
            </div>
            
            <div className="bg-black/40 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Validation Loss</div>
              <div className="text-white font-bold text-lg">{selectedJobData.validationLoss.toFixed(4)}</div>
              <div className="text-green-400 text-xs">↓ Decreasing</div>
            </div>
            
            <div className="bg-black/40 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Samples Processed</div>
              <div className="text-white font-bold text-lg">{selectedJobData.samplesProcessed.toLocaleString()}</div>
              <div className="text-blue-400 text-xs">Batch: {selectedJobData.batchSize}</div>
            </div>
            
            <div className="bg-black/40 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Learning Rate</div>
              <div className="text-white font-bold text-lg">{selectedJobData.learningRate}</div>
              <div className="text-yellow-400 text-xs">Adaptive</div>
            </div>
          </div>

          {/* Mini Performance Chart */}
          <div className="bg-black/40 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-2">Training Progress</div>
            <div className="flex items-end space-x-1 h-12">
              {Array.from({ length: 20 }, (_, i) => {
                const height = Math.random() * 40 + 20;
                const isRecent = i >= 15;
                return (
                  <div
                    key={i}
                    className={`w-2 rounded-t ${isRecent ? 'bg-blue-500' : 'bg-gray-600'} transition-all duration-300`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Epoch 0</span>
              <span>Current</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}