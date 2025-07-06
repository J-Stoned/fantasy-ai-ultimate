'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Badge } from '../../components/ui/badge'
import { Select } from '../../components/ui/select'
import { Input } from '../../components/ui'
import { fantasyAPI, WaiverTarget } from '../../services/fantasy-api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { WS_CHANNELS } from '../../services/websocket-service'

interface WaiverPlayer extends WaiverTarget {
  recentNews?: string
  injuryStatus?: string
  nextOpponent?: string
  trendingDirection?: 'up' | 'down' | 'breakout'
}

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DST']
const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority Score' },
  { value: 'projection', label: 'Projected Points' },
  { value: 'patterns', label: 'Pattern Opportunities' },
  { value: 'availability', label: 'Availability %' },
  { value: 'trending', label: 'Trending' },
]

export default function WaiverWirePage() {
  const [waiverTargets, setWaiverTargets] = useState<WaiverPlayer[]>([])
  const [filteredTargets, setFilteredTargets] = useState<WaiverPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLeague, setSelectedLeague] = useState('league1')
  const [selectedPosition, setSelectedPosition] = useState('All')
  const [sortBy, setSortBy] = useState('priority')
  const [searchQuery, setSearchQuery] = useState('')
  const [budget, setBudget] = useState(100)
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  
  // Subscribe to player news for waiver alerts
  useWebSocket(WS_CHANNELS.PLAYER_NEWS, (news) => {
    console.log('Player news update:', news)
    // Update waiver targets based on news
  })
  
  useEffect(() => {
    loadWaiverTargets()
  }, [selectedLeague])
  
  const loadWaiverTargets = async () => {
    setIsLoading(true)
    try {
      const positions = selectedPosition === 'All' ? undefined : [selectedPosition]
      const targets = await fantasyAPI.getWaiverTargets(selectedLeague, positions, 20)
      
      // Enhance with additional data (would come from API in production)
      const enhanced = targets.map(target => ({
        ...target,
        recentNews: getRandomNews(target.playerName),
        injuryStatus: Math.random() > 0.8 ? 'Q' : undefined,
        nextOpponent: getRandomOpponent(),
        trendingDirection: getTrendingDirection(target.priority),
      })) as WaiverPlayer[]
      
      setWaiverTargets(enhanced)
    } catch (error) {
      console.error('Failed to load waiver targets:', error)
      // Use mock data
      setWaiverTargets(getMockTargets())
    } finally {
      setIsLoading(false)
    }
  }
  
  // Filter and sort targets
  useEffect(() => {
    let filtered = waiverTargets
    
    // Filter by position
    if (selectedPosition !== 'All') {
      filtered = filtered.filter(t => t.position === selectedPosition)
    }
    
    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.team.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.priority - a.priority
        case 'projection':
          return b.projectedPoints - a.projectedPoints
        case 'patterns':
          return b.patternOpportunities.length - a.patternOpportunities.length
        case 'availability':
          return a.availabilityPercentage - b.availabilityPercentage
        case 'trending':
          return getTrendingScore(b) - getTrendingScore(a)
        default:
          return 0
      }
    })
    
    setFilteredTargets(filtered)
  }, [waiverTargets, selectedPosition, sortBy, searchQuery])
  
  const getTrendingScore = (player: WaiverPlayer) => {
    switch (player.trendingDirection) {
      case 'breakout': return 3
      case 'up': return 2
      case 'down': return 1
      default: return 0
    }
  }
  
  const handleSelectPlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayers)
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId)
    } else {
      newSelected.add(playerId)
    }
    setSelectedPlayers(newSelected)
  }
  
  const calculateTotalBid = () => {
    return selectedPlayers.size * 10 // Simple calculation
  }
  
  const getTrendingIcon = (direction?: string) => {
    switch (direction) {
      case 'breakout': return '🚀'
      case 'up': return '📈'
      case 'down': return '📉'
      default: return ''
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Waiver Wire <span className="gradient-text">Assistant</span>
        </h1>
        <p className="text-xl text-gray-400">
          Pattern-based breakout predictions and priority rankings
        </p>
      </div>
      
      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
            >
              <option value="league1">Dynasty Warriors (12-team)</option>
              <option value="league2">The League (10-team)</option>
              <option value="league3">Redraft Legends (14-team)</option>
            </Select>
            
            <Select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
            >
              {POSITIONS.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </Select>
            
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  Sort by {opt.label}
                </option>
              ))}
            </Select>
            
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold gradient-text">
              {filteredTargets.filter(t => t.trendingDirection === 'breakout').length}
            </div>
            <div className="text-sm text-gray-400">Breakout Alerts</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">
              {filteredTargets.filter(t => t.patternOpportunities.length >= 2).length}
            </div>
            <div className="text-sm text-gray-400">Pattern Matches</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">
              ${budget - calculateTotalBid()}
            </div>
            <div className="text-sm text-gray-400">FAAB Remaining</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-400">
              {selectedPlayers.size}
            </div>
            <div className="text-sm text-gray-400">Selected</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Waiver Targets */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-gray-400">Loading waiver recommendations...</p>
            </CardContent>
          </Card>
        ) : filteredTargets.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-400">No waiver targets found</p>
            </CardContent>
          </Card>
        ) : (
          filteredTargets.map((target) => (
            <Card
              key={target.playerId}
              className={`transition-all ${
                selectedPlayers.has(target.playerId) 
                  ? 'ring-2 ring-primary-500' 
                  : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Player Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">
                        {target.playerName}
                      </h3>
                      <Badge variant="secondary">{target.position}</Badge>
                      <Badge variant="ghost" size="sm">{target.team}</Badge>
                      {target.injuryStatus && (
                        <Badge variant="warning" size="sm">{target.injuryStatus}</Badge>
                      )}
                      {target.trendingDirection && (
                        <span className="text-xl">
                          {getTrendingIcon(target.trendingDirection)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-3">{target.reasoning}</p>
                    
                    {/* Pattern Opportunities */}
                    {target.patternOpportunities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {target.patternOpportunities.map((pattern, idx) => (
                          <Badge key={idx} variant="success" size="sm">
                            🎯 {pattern}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Recent News */}
                    {target.recentNews && (
                      <p className="text-xs text-gray-500 italic">
                        📰 {target.recentNews}
                      </p>
                    )}
                  </div>
                  
                  {/* Stats */}
                  <div className="flex flex-col md:items-end gap-2">
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {target.projectedPoints.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-400">Proj Pts</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-medium text-green-400">
                          {target.availabilityPercentage}%
                        </div>
                        <div className="text-xs text-gray-400">Available</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-medium text-pattern-gold">
                          #{target.priority}
                        </div>
                        <div className="text-xs text-gray-400">Priority</div>
                      </div>
                    </div>
                    
                    <Button
                      variant={selectedPlayers.has(target.playerId) ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleSelectPlayer(target.playerId)}
                    >
                      {selectedPlayers.has(target.playerId) ? 'Selected' : 'Add to Claims'}
                    </Button>
                  </div>
                </div>
                
                {/* Next Matchup */}
                {target.nextOpponent && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <span className="text-sm text-gray-400">
                      Next: vs {target.nextOpponent}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Actions */}
      {selectedPlayers.size > 0 && (
        <div className="fixed bottom-4 right-4 glass-card p-4 rounded-lg shadow-2xl">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-gray-400">Selected Players</div>
              <div className="text-xl font-bold text-white">{selectedPlayers.size}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Total FAAB</div>
              <div className="text-xl font-bold text-green-400">${calculateTotalBid()}</div>
            </div>
            <Button variant="primary">
              Submit Claims
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Mock data generators
function getMockTargets(): WaiverPlayer[] {
  return [
    {
      playerId: '1',
      playerName: 'Puka Nacua',
      team: 'LAR',
      position: 'WR',
      availabilityPercentage: 45,
      projectedPoints: 14.5,
      patternOpportunities: ['Division Dog Bite', 'Primetime Under'],
      priority: 1,
      reasoning: 'Elite target share with Kupp injured. Pattern boost in divisional game.',
      recentNews: 'Led team in targets last week with 12',
      trendingDirection: 'breakout',
    },
    {
      playerId: '2',
      playerName: 'Jerome Ford',
      team: 'CLE',
      position: 'RB',
      availabilityPercentage: 68,
      projectedPoints: 12.3,
      patternOpportunities: ['Back-to-Back Fade'],
      priority: 2,
      reasoning: 'Starting RB with Chubb out. Facing tired defense on B2B.',
      recentNews: 'Named starter for Week 8',
      trendingDirection: 'up',
    },
    {
      playerId: '3',
      playerName: 'Sam Howell',
      team: 'WAS',
      position: 'QB',
      availabilityPercentage: 92,
      projectedPoints: 18.7,
      patternOpportunities: ['Embarrassment Revenge'],
      priority: 3,
      reasoning: 'Bounce-back spot after 30-point loss. High passing volume.',
      injuryStatus: 'Q',
      trendingDirection: 'up',
    },
  ]
}

function getRandomNews(playerName: string): string {
  const news = [
    'Coach confirms increased role moving forward',
    'Led team in snaps last week',
    'Expected to see more targets with injuries ahead',
    'Breakout performance in practice this week',
    'Offensive coordinator hints at expanded usage',
  ]
  return news[Math.floor(Math.random() * news.length)]
}

function getRandomOpponent(): string {
  const teams = ['KC', 'BUF', 'SF', 'PHI', 'DAL', 'MIA', 'BAL', 'CIN']
  return teams[Math.floor(Math.random() * teams.length)]
}

function getTrendingDirection(priority: number): 'up' | 'down' | 'breakout' | undefined {
  if (priority === 1) return 'breakout'
  if (priority <= 3) return 'up'
  if (priority > 15) return 'down'
  return undefined
}