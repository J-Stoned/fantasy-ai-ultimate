'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Badge } from '../../components/ui/badge'

// Mock pattern data
const getPatternById = (id: string) => {
  const patterns = {
    '1': {
      id: '1',
      name: 'Back-to-Back Fade',
      description: 'Teams on second game of back-to-back underperform',
      accuracy: 76.8,
      roi: 46.6,
      occurrences: 8234,
      confidence: 'high' as const,
      sport: 'basketball',
      lastTriggered: new Date().toISOString(),
      rules: [
        'Team playing 2nd game in 2 nights',
        'Opponent had at least 1 day rest',
        'Travel distance > 500 miles',
        'Game time before 8 PM local'
      ],
      recentGames: [
        { date: '2025-01-05', teams: 'LAL @ DEN', result: 'Win', profit: '+$125' },
        { date: '2025-01-04', teams: 'BOS @ MIA', result: 'Win', profit: '+$110' },
        { date: '2025-01-03', teams: 'GSW @ PHX', result: 'Loss', profit: '-$100' },
        { date: '2025-01-02', teams: 'MIL @ CHI', result: 'Win', profit: '+$105' },
        { date: '2025-01-01', teams: 'BKN @ TOR', result: 'Win', profit: '+$115' },
      ],
      statistics: {
        last30Days: { wins: 24, losses: 8, accuracy: 75.0 },
        last90Days: { wins: 68, losses: 22, accuracy: 75.6 },
        allTime: { wins: 6324, losses: 1910, accuracy: 76.8 },
      }
    }
  }
  return patterns[id] || patterns['1'] // Default to pattern 1 if not found
}

export default function PatternDetailPage() {
  const params = useParams()
  const patternId = params.id as string
  const [pattern, setPattern] = useState(getPatternById(patternId))
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'rules'>('overview')
  const [isFollowing, setIsFollowing] = useState(false)

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      case 'low':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Back Navigation */}
      <Link href="/patterns" className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Patterns
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{pattern.name}</h1>
            <p className="text-xl text-gray-400">{pattern.description}</p>
            <div className="flex items-center gap-4 mt-4">
              <Badge className={getConfidenceColor(pattern.confidence)}>
                {pattern.confidence.toUpperCase()} CONFIDENCE
              </Badge>
              <span className="text-gray-400">{pattern.sport.toUpperCase()}</span>
            </div>
          </div>
          <Button
            onClick={() => setIsFollowing(!isFollowing)}
            variant={isFollowing ? 'secondary' : 'default'}
          >
            {isFollowing ? 'Following' : 'Follow Pattern'}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-green-400">{pattern.accuracy}%</div>
            <div className="text-sm text-gray-400 mt-1">Win Rate</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-pattern-gold">{pattern.roi}%</div>
            <div className="text-sm text-gray-400 mt-1">ROI</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-blue-400">{pattern.occurrences.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">Total Triggers</div>
          </CardContent>
        </Card>
        
        <Card variant="gradient">
          <CardContent className="p-6">
            <div className="text-3xl font-bold text-purple-400">
              ${(pattern.occurrences * pattern.roi * 10).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Profit</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 p-1 glass-card rounded-lg inline-flex">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2 rounded-md transition-all ${
            activeTab === 'overview' 
              ? 'bg-primary-500 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-6 py-2 rounded-md transition-all ${
            activeTab === 'performance' 
              ? 'bg-primary-500 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Performance
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-6 py-2 rounded-md transition-all ${
            activeTab === 'rules' 
              ? 'bg-primary-500 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Rules & Logic
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Recent Games */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Games</CardTitle>
              <CardDescription>Last 5 pattern triggers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pattern.recentGames.map((game, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 glass-card rounded-lg">
                    <div>
                      <div className="font-medium text-white">{game.teams}</div>
                      <div className="text-sm text-gray-400">{game.date}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${game.result === 'Win' ? 'text-green-400' : 'text-red-400'}`}>
                        {game.result}
                      </div>
                      <div className={`text-sm ${game.profit.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {game.profit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle>Next Opportunities</CardTitle>
              <CardDescription>Games matching this pattern today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No games matching pattern criteria today</p>
                <p className="text-sm mt-2">Check back tomorrow for new opportunities</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Performance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Last 30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wins</span>
                    <span className="text-green-400 font-medium">{pattern.statistics.last30Days.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Losses</span>
                    <span className="text-red-400 font-medium">{pattern.statistics.last30Days.losses}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-400">Accuracy</span>
                    <span className="text-white font-medium">{pattern.statistics.last30Days.accuracy}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Last 90 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wins</span>
                    <span className="text-green-400 font-medium">{pattern.statistics.last90Days.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Losses</span>
                    <span className="text-red-400 font-medium">{pattern.statistics.last90Days.losses}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-400">Accuracy</span>
                    <span className="text-white font-medium">{pattern.statistics.last90Days.accuracy}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wins</span>
                    <span className="text-green-400 font-medium">{pattern.statistics.allTime.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Losses</span>
                    <span className="text-red-400 font-medium">{pattern.statistics.allTime.losses}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-400">Accuracy</span>
                    <span className="text-white font-medium">{pattern.statistics.allTime.accuracy}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Trend</CardTitle>
              <CardDescription>Pattern performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <p>Chart visualization coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pattern Rules</CardTitle>
              <CardDescription>All conditions must be met for pattern to trigger</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pattern.rules.map((rule, idx) => (
                  <div key={idx} className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-primary-400">{idx + 1}</span>
                    </div>
                    <p className="text-gray-300">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Implementation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">Data Sources</h4>
                  <ul className="list-disc list-inside text-gray-400 space-y-1">
                    <li>NBA schedule API for game timing</li>
                    <li>Team travel distance calculations</li>
                    <li>Historical performance database</li>
                    <li>Real-time injury reports</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Recommended Bet Size</h4>
                  <p className="text-gray-400">2-3% of bankroll per opportunity (Kelly Criterion adjusted)</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Best Markets</h4>
                  <p className="text-gray-400">Spread, Moneyline (underdog), Under totals</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}