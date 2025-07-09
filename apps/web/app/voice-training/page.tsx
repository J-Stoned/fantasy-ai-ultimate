'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TrainingMetrics {
  model: {
    version: string
    accuracy: number
    totalCommands: number
    successfulCommands: number
    retrainingCycles: number
    lastTrainingTime: string
  }
  feedback: {
    totalFeedback: number
    positiveFeedback: number
    negativeFeedback: number
    successRate: number
    responseTime: number
  }
  intents: Array<{
    intent: string
    accuracy: number
    total: number
  }>
  commonFailures: Array<{
    pattern: string
    count: number
  }>
}

export default function VoiceTrainingDashboard() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadMetrics()
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/voice/feedback')
      const data = await response.json()
      
      if (data.success) {
        setMetrics(data.metrics)
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading training metrics...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">No metrics available</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🧠 Voice Training Dashboard
            </h1>
            <p className="text-gray-300">
              Real-time AI training powered by RTX 4060 GPU
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg ${
                autoRefresh 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl font-bold text-white mb-2">
              {metrics.model.accuracy.toFixed(1)}%
            </div>
            <div className="text-gray-300">Model Accuracy</div>
            <div className="text-sm text-green-400 mt-2">
              v{metrics.model.version}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl font-bold text-white mb-2">
              {metrics.model.totalCommands}
            </div>
            <div className="text-gray-300">Total Commands</div>
            <div className="text-sm text-blue-400 mt-2">
              {metrics.model.retrainingCycles} retraining cycles
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl font-bold text-white mb-2">
              {metrics.feedback.successRate.toFixed(1)}%
            </div>
            <div className="text-gray-300">Success Rate</div>
            <div className="text-sm text-gray-400 mt-2">
              👍 {metrics.feedback.positiveFeedback} / 👎 {metrics.feedback.negativeFeedback}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl font-bold text-white mb-2">
              {metrics.feedback.responseTime}ms
            </div>
            <div className="text-gray-300">Response Time</div>
            <div className="text-sm text-yellow-400 mt-2">
              GPU accelerated
            </div>
          </div>
        </div>

        {/* Intent Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Intent Recognition Performance
            </h2>
            <div className="space-y-3">
              {metrics.intents.slice(0, 10).map((intent) => (
                <div key={intent.intent} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-300">{intent.intent}</span>
                      <span className="text-white font-medium">
                        {intent.accuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          intent.accuracy > 80 
                            ? 'bg-green-500' 
                            : intent.accuracy > 60 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${intent.accuracy}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-gray-500 text-sm ml-4">
                    {intent.total} uses
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Common Failures to Learn From
            </h2>
            <div className="space-y-2">
              {metrics.commonFailures.map((failure, index) => (
                <div
                  key={index}
                  className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg"
                >
                  <div className="text-sm text-red-300">
                    "{failure.pattern.split(':')[1]}"
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Failed {failure.count} times - Intent: {failure.pattern.split(':')[0]}
                  </div>
                </div>
              ))}
              {metrics.commonFailures.length === 0 && (
                <div className="text-gray-400">No failures recorded yet! 🎉</div>
              )}
            </div>
          </div>
        </div>

        {/* Training Status */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Training Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-400 mb-1">Last Training</div>
              <div className="text-white">
                {new Date(metrics.model.lastTrainingTime).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Training Mode</div>
              <div className="text-green-400 font-medium">
                🟢 Continuous Learning Active
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Hardware</div>
              <div className="text-blue-400">
                RTX 4060 GPU + Ryzen 5 7600X
              </div>
            </div>
          </div>

          {/* Real-time training indicator */}
          <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-300">
                AI is learning from every command in real-time
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}