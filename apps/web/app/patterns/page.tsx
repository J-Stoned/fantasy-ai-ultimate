'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { PatternCard } from '../components/ui/pattern-card'
import { Button } from '../../components/ui'
import { Select } from '../components/ui/select'
import { Input } from '../../components/ui'
import { patternAPI, Pattern } from '../../services/pattern-api'
import { useWebSocket, useWebSocketStatus } from '../../hooks/useWebSocket'
import { WS_CHANNELS } from '../../services/websocket-service'

const sports = ['all', 'football', 'basketball', 'baseball', 'hockey']
const sortOptions = [
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'roi', label: 'ROI' },
  { value: 'occurrences', label: 'Occurrences' },
  { value: 'recent', label: 'Recently Triggered' },
]

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [filteredPatterns, setFilteredPatterns] = useState<Pattern[]>([])
  const [selectedSport, setSelectedSport] = useState('all')
  const [sortBy, setSortBy] = useState('accuracy')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const isWebSocketConnected = useWebSocketStatus()
  
  // Subscribe to real-time pattern alerts
  useWebSocket(WS_CHANNELS.PATTERN_ALERTS, (alert) => {
    console.log('New pattern alert:', alert)
    // You could show a toast notification here
  })
  
  // Load patterns from API
  useEffect(() => {
    loadPatterns()
    loadStats()
  }, [])
  
  const loadPatterns = async () => {
    setIsLoading(true)
    try {
      const data = await patternAPI.getPatterns()
      setPatterns(data)
    } catch (error) {
      console.error('Failed to load patterns:', error)
      // Fallback to mock data if API is not available
      setPatterns([
        {
          id: '1',
          name: 'Back-to-Back Fade',
          description: 'Teams on second game of back-to-back underperform',
          accuracy: 76.8,
          roi: 46.6,
          occurrences: 8234,
          sport: 'NBA' as any,
          conditions: {},
        },
        {
          id: '2',
          name: 'Embarrassment Revenge',
          description: 'Teams bounce back after 20+ point losses',
          accuracy: 74.4,
          roi: 41.9,
          occurrences: 5421,
          sport: 'NFL' as any,
          conditions: {},
        },
        {
          id: '3',
          name: 'Altitude Advantage',
          description: 'Home teams at high altitude dominate',
          accuracy: 68.3,
          roi: 36.3,
          occurrences: 3156,
          sport: 'NFL' as any,
          conditions: {},
        },
        {
          id: '4',
          name: 'Perfect Storm',
          description: 'Multiple factors align for upset potential',
          accuracy: 67.0,
          roi: 35.9,
          occurrences: 2847,
          sport: 'NFL' as any,
          conditions: {},
        },
        {
          id: '5',
          name: 'Division Dog Bite',
          description: 'Division underdogs cover at high rate',
          accuracy: 58.6,
          roi: 32.9,
          occurrences: 9876,
          sport: 'NFL' as any,
          conditions: {},
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }
  
  const loadStats = async () => {
    try {
      const data = await patternAPI.getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  // Filter and sort patterns
  useEffect(() => {
    let filtered = patterns

    // Filter by sport
    if (selectedSport !== 'all') {
      filtered = filtered.filter(p => 
        p.sport?.toLowerCase() === selectedSport || 
        p.sport === 'all'
      )
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort patterns
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'accuracy':
          return b.accuracy - a.accuracy
        case 'roi':
          return b.roi - a.roi
        case 'occurrences':
          return b.occurrences - a.occurrences
        case 'recent':
          return (b.lastTriggered ? new Date(b.lastTriggered).getTime() : 0) - 
                 (a.lastTriggered ? new Date(a.lastTriggered).getTime() : 0)
        default:
          return 0
      }
    })

    setFilteredPatterns(filtered)
  }, [patterns, selectedSport, sortBy, searchQuery])

  // Calculate totals
  const totalProfit = filteredPatterns.reduce((sum, p) => sum + (p.occurrences * p.roi * 10), 0)
  const avgAccuracy = filteredPatterns.reduce((sum, p) => sum + p.accuracy, 0) / filteredPatterns.length || 0
  const totalOccurrences = filteredPatterns.reduce((sum, p) => sum + p.occurrences, 0)

  const handlePatternClick = (pattern: Pattern) => {
    // Navigate to pattern detail page
    window.location.href = `/patterns/${pattern.id}`
  }

  const handleRefresh = async () => {
    await loadPatterns()
    await loadStats()
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Pattern Detection <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-xl text-gray-400">
              Real-time pattern analysis from {stats?.totalGamesAnalyzed?.toLocaleString() || '48,863'} games
            </p>
          </div>
          <Button
            onClick={() => window.location.href = '/patterns/analytics'}
            variant="outline"
            className="w-full md:w-auto"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Analytics
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold gradient-text">
              {filteredPatterns.length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Active Patterns</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-green-400">
              {avgAccuracy.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400 mt-1">Avg Accuracy</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-pattern-gold">
              ${(totalProfit / 1000000).toFixed(2)}M
            </div>
            <div className="text-sm text-gray-400 mt-1">Profit Potential</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-blue-400">
              {totalOccurrences.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Occurrences</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              className="flex-1"
            />
            
            <Select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="w-full md:w-48"
            >
              {sports.map(sport => (
                <option key={sport} value={sport}>
                  {sport.charAt(0).toUpperCase() + sport.slice(1)}
                </option>
              ))}
            </Select>
            
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full md:w-48"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </Select>
            
            <Button
              onClick={handleRefresh}
              loading={isLoading}
              variant="secondary"
              className="w-full md:w-auto"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pattern Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatterns.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={{
              ...pattern,
              confidence: pattern.accuracy > 70 ? 'high' : pattern.accuracy > 60 ? 'medium' : 'low',
              sport: pattern.sport?.toLowerCase() || 'all',
              lastTriggered: pattern.lastTriggered || new Date().toISOString(),
            }}
            onClick={() => handlePatternClick(pattern)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredPatterns.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-400 text-lg">No patterns found matching your criteria</p>
            <Button
              onClick={() => {
                setSearchQuery('')
                setSelectedSport('all')
              }}
              variant="ghost"
              className="mt-4"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Live Updates Indicator */}
      <div className="fixed bottom-4 right-4 flex items-center space-x-2 glass-card px-4 py-2 rounded-full">
        <div className={`w-2 h-2 ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'} rounded-full animate-pulse`}></div>
        <span className="text-sm text-gray-300">
          {isWebSocketConnected ? 'Live Updates' : 'Connecting...'}
        </span>
      </div>
    </div>
  )
}