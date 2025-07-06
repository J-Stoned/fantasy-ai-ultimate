'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui'
import { useWebSocket, useWebSocketStatus } from '../../hooks/useWebSocket'
import { WS_CHANNELS } from '../../services/websocket-service'
import { patternAPI } from '../../services/pattern-api'

interface LiveEvent {
  id: string
  timestamp: string
  type: 'pattern_trigger' | 'bet_opportunity' | 'score_update' | 'injury_alert'
  title: string
  description: string
  severity: 'info' | 'warning' | 'success' | 'critical'
  data?: any
}

export default function LiveDashboard() {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const isConnected = useWebSocketStatus()
  const [stats, setStats] = useState({
    patternsToday: 0,
    profitToday: 0,
    activeGames: 0,
    totalUsers: 0,
  })
  const [opportunities, setOpportunities] = useState<any[]>([])
  
  // Subscribe to pattern alerts
  useWebSocket(WS_CHANNELS.PATTERN_ALERTS, (alert) => {
    const event: LiveEvent = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'pattern_trigger',
      title: `${alert.patternName} Triggered!`,
      description: `${alert.homeTeam} vs ${alert.awayTeam} - ${alert.confidence}% confidence`,
      severity: alert.confidence > 70 ? 'success' : 'info',
      data: alert
    }
    addEvent(event)
  })
  
  // Subscribe to game updates
  useWebSocket(WS_CHANNELS.GAME_UPDATES, (update) => {
    const event: LiveEvent = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'score_update',
      title: 'Score Update',
      description: `${update.homeTeam} ${update.homeScore} - ${update.awayScore} ${update.awayTeam}`,
      severity: 'info',
      data: update
    }
    addEvent(event)
  })
  
  // Load initial data
  useEffect(() => {
    loadStats()
    loadOpportunities()
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadStats()
      loadOpportunities()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const data = await patternAPI.getStats()
      setStats({
        patternsToday: data.patternOccurrences || 0,
        profitToday: data.profitPotential || 0,
        activeGames: 150, // This would come from a games API
        totalUsers: 10234, // This would come from a users API
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }
  
  const loadOpportunities = async () => {
    try {
      const data = await patternAPI.getOpportunities()
      setOpportunities(data.slice(0, 5)) // Show top 5
    } catch (error) {
      console.error('Failed to load opportunities:', error)
    }
  }

  const addEvent = (event: LiveEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 50)) // Keep last 50 events
  }

  const getEventIcon = (type: LiveEvent['type']) => {
    switch (type) {
      case 'pattern_trigger':
        return '🎯'
      case 'bet_opportunity':
        return '💰'
      case 'score_update':
        return '📊'
      case 'injury_alert':
        return '🚨'
      default:
        return '📌'
    }
  }

  const getSeverityColor = (severity: LiveEvent['severity']) => {
    switch (severity) {
      case 'success':
        return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    }
  }

  // Simulate some initial events if no WebSocket data yet
  useEffect(() => {
    if (events.length === 0) {
      // Simulate some events for demo purposes
      const mockEvents: LiveEvent[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          type: 'pattern_trigger',
          title: 'Back-to-Back Fade Triggered',
          description: 'Lakers @ Nuggets matches pattern criteria',
          severity: 'success',
          data: { accuracy: 76.8, roi: 46.6 }
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          type: 'bet_opportunity',
          title: 'High-Value Bet Detected',
          description: 'Celtics -3.5 shows 68% win probability',
          severity: 'info',
          data: { odds: -110, confidence: 68 }
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          type: 'injury_alert',
          title: 'Star Player Injury Update',
          description: 'LeBron James questionable for tonight',
          severity: 'warning',
          data: { player: 'LeBron James', status: 'Questionable' }
        },
      ]
      setEvents(mockEvents)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Live <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-xl text-gray-400">Real-time pattern detection and alerts</p>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card variant="gradient" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <CardContent className="p-6">
            <div className="text-3xl font-bold gradient-text">{stats.patternsToday}</div>
            <div className="text-sm text-gray-400 mt-1">Patterns Today</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-green-400">${stats.profitToday.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">Profit Today</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-blue-400">{stats.activeGames}</div>
            <div className="text-sm text-gray-400 mt-1">Active Games</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-purple-400">{stats.totalUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">Users Online</div>
          </CardContent>
        </Card>
      </div>

      {/* Live Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Live Feed</CardTitle>
          <CardDescription>Real-time events and alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Waiting for live events...</p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="glass-card p-4 hover:border-white/20 transition-all duration-200 animate-slide-up"
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getEventIcon(event.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-white">{event.title}</h4>
                          <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                          {event.data && (
                            <div className="flex items-center gap-4 mt-2">
                              {event.data.accuracy && (
                                <span className="text-xs text-gray-500">
                                  Accuracy: <span className="text-green-400">{event.data.accuracy}%</span>
                                </span>
                              )}
                              {event.data.roi && (
                                <span className="text-xs text-gray-500">
                                  ROI: <span className="text-pattern-gold">{event.data.roi}%</span>
                                </span>
                              )}
                              {event.data.confidence && (
                                <span className="text-xs text-gray-500">
                                  Confidence: <span className="text-blue-400">{event.data.confidence}%</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity.toUpperCase()}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="fixed bottom-4 left-4 flex flex-col space-y-2">
        <Button
          onClick={() => window.location.href = '/patterns'}
          variant="secondary"
          size="sm"
        >
          View Patterns
        </Button>
        <Button
          onClick={() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }))
            }
          }}
          variant="ghost"
          size="sm"
        >
          Test Connection
        </Button>
      </div>
    </div>
  )
}