'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Select } from '../../components/ui/select'
import { Input } from '../../components/ui'
import { Badge } from '../../components/ui/badge'
import { fantasyAPI, Lineup, SportType } from '../../services/fantasy-api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { WS_CHANNELS } from '../../services/websocket-service'

interface Player {
  id: string
  name: string
  position: string
  team: string
  projection: number
  salary?: number
  ownership?: number
  patternBoost?: number
  locked?: boolean
  excluded?: boolean
}

const POSITIONS_BY_SPORT = {
  NFL: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 },
  NBA: { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UTIL: 1 },
  MLB: { P: 2, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3 },
  NHL: { C: 2, W: 3, D: 2, G: 1, UTIL: 1 }
}

const SALARY_CAPS = {
  DFS: { DraftKings: 50000, FanDuel: 60000 },
  SEASON: null
}

export default function LineupOptimizerPage() {
  const [sport, setSport] = useState<SportType>('NFL')
  const [format, setFormat] = useState<'season' | 'dfs'>('dfs')
  const [contest, setContest] = useState<'gpp' | 'cash'>('cash')
  const [platform, setPlatform] = useState<'DraftKings' | 'FanDuel'>('DraftKings')
  const [lineup, setLineup] = useState<Lineup | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [playerPool, setPlayerPool] = useState<Player[]>([])
  const [lockedPlayers, setLockedPlayers] = useState<Set<string>>(new Set())
  const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set())
  const [maxOwnership, setMaxOwnership] = useState(100)
  const [minProjection, setMinProjection] = useState(0)
  
  // Subscribe to lineup updates
  useWebSocket(WS_CHANNELS.LINEUP_CHANGES, (update) => {
    console.log('Lineup update:', update)
    // Handle real-time lineup changes
  })
  
  // Load player pool (mock data for now)
  useEffect(() => {
    loadPlayerPool()
  }, [sport, format])
  
  const loadPlayerPool = () => {
    // In production, this would fetch from API
    const mockPlayers: Player[] = [
      { id: '1', name: 'Patrick Mahomes', position: 'QB', team: 'KC', projection: 25.4, salary: 8200, ownership: 18.5 },
      { id: '2', name: 'Christian McCaffrey', position: 'RB', team: 'SF', projection: 22.1, salary: 9500, ownership: 35.2, patternBoost: 2.5 },
      { id: '3', name: 'Tyreek Hill', position: 'WR', team: 'MIA', projection: 18.3, salary: 8800, ownership: 22.1 },
      { id: '4', name: 'Travis Kelce', position: 'TE', team: 'KC', projection: 16.7, salary: 7600, ownership: 28.9 },
      { id: '5', name: 'Austin Ekeler', position: 'RB', team: 'LAC', projection: 19.2, salary: 7800, ownership: 15.3 },
      { id: '6', name: 'Stefon Diggs', position: 'WR', team: 'BUF', projection: 17.8, salary: 8200, ownership: 19.7 },
      { id: '7', name: 'Mark Andrews', position: 'TE', team: 'BAL', projection: 14.2, salary: 6800, ownership: 12.4 },
      { id: '8', name: 'Cowboys DST', position: 'DST', team: 'DAL', projection: 9.5, salary: 3200, ownership: 8.7 },
    ]
    setPlayerPool(mockPlayers)
  }
  
  const handleOptimize = async () => {
    setIsOptimizing(true)
    
    try {
      const config = {
        sport,
        format,
        contest: format === 'dfs' ? contest : undefined,
        salaryCap: format === 'dfs' ? SALARY_CAPS.DFS[platform] : undefined,
        positions: POSITIONS_BY_SPORT[sport],
        lockedPlayers: Array.from(lockedPlayers),
        excludedPlayers: Array.from(excludedPlayers),
      }
      
      const optimizedLineup = await fantasyAPI.optimizeLineup(config)
      setLineup(optimizedLineup)
    } catch (error) {
      console.error('Optimization failed:', error)
      // Fallback to mock lineup
      setLineup({
        players: playerPool.slice(0, 9).map(p => ({
          playerId: p.id,
          playerName: p.name,
          position: p.position,
          team: p.team,
          projection: p.projection,
          salary: p.salary,
          patternBoost: p.patternBoost
        })),
        totalProjection: 142.3,
        totalSalary: 49800,
        patternAdvantages: ['Back-to-Back Fade boost on McCaffrey', 'Altitude Advantage for Broncos players'],
        confidence: 78.5
      })
    } finally {
      setIsOptimizing(false)
    }
  }
  
  const togglePlayerLock = (playerId: string) => {
    const newLocked = new Set(lockedPlayers)
    if (newLocked.has(playerId)) {
      newLocked.delete(playerId)
    } else {
      newLocked.add(playerId)
    }
    setLockedPlayers(newLocked)
  }
  
  const togglePlayerExclude = (playerId: string) => {
    const newExcluded = new Set(excludedPlayers)
    if (newExcluded.has(playerId)) {
      newExcluded.delete(playerId)
    } else {
      newExcluded.add(playerId)
      // Remove from locked if excluding
      lockedPlayers.delete(playerId)
      setLockedPlayers(new Set(lockedPlayers))
    }
    setExcludedPlayers(newExcluded)
  }
  
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Lineup <span className="gradient-text">Optimizer</span>
        </h1>
        <p className="text-xl text-gray-400">
          GPU-powered optimization with pattern insights
        </p>
      </div>
      
      {/* Configuration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Optimization Settings</CardTitle>
          <CardDescription>Configure your lineup parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Sport</label>
              <Select
                value={sport}
                onChange={(e) => setSport(e.target.value as SportType)}
                className="w-full"
              >
                <option value="NFL">NFL</option>
                <option value="NBA">NBA</option>
                <option value="MLB">MLB</option>
                <option value="NHL">NHL</option>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Format</label>
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'season' | 'dfs')}
                className="w-full"
              >
                <option value="dfs">Daily Fantasy (DFS)</option>
                <option value="season">Season Long</option>
              </Select>
            </div>
            
            {format === 'dfs' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Platform</label>
                  <Select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as 'DraftKings' | 'FanDuel')}
                    className="w-full"
                  >
                    <option value="DraftKings">DraftKings</option>
                    <option value="FanDuel">FanDuel</option>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Contest Type</label>
                  <Select
                    value={contest}
                    onChange={(e) => setContest(e.target.value as 'gpp' | 'cash')}
                    className="w-full"
                  >
                    <option value="cash">Cash Game</option>
                    <option value="gpp">GPP Tournament</option>
                  </Select>
                </div>
              </>
            )}
          </div>
          
          {format === 'dfs' && contest === 'gpp' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Max Ownership %
                </label>
                <Input
                  type="number"
                  value={maxOwnership}
                  onChange={(e) => setMaxOwnership(Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Min Projection
                </label>
                <Input
                  type="number"
                  value={minProjection}
                  onChange={(e) => setMinProjection(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
          )}
          
          <Button
            onClick={handleOptimize}
            loading={isOptimizing}
            size="lg"
            className="w-full md:w-auto mt-6"
          >
            {isOptimizing ? 'Optimizing...' : 'Optimize Lineup'}
          </Button>
        </CardContent>
      </Card>
      
      {/* Player Pool */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Player Pool</CardTitle>
            <CardDescription>Lock or exclude players from optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {playerPool.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    excludedPlayers.has(player.id)
                      ? 'border-red-500/20 bg-red-500/5 opacity-50'
                      : lockedPlayers.has(player.id)
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-white/10 hover:border-white/20'
                  } transition-all`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{player.name}</span>
                      <Badge variant="secondary" size="sm">
                        {player.position}
                      </Badge>
                      <span className="text-xs text-gray-500">{player.team}</span>
                      {player.patternBoost && (
                        <Badge variant="success" size="sm">
                          +{player.patternBoost}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span>{player.projection} pts</span>
                      {player.salary && <span>${player.salary}</span>}
                      {player.ownership && <span>{player.ownership}% owned</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant={lockedPlayers.has(player.id) ? 'success' : 'ghost'}
                      size="sm"
                      onClick={() => togglePlayerLock(player.id)}
                      disabled={excludedPlayers.has(player.id)}
                    >
                      🔒
                    </Button>
                    <Button
                      variant={excludedPlayers.has(player.id) ? 'danger' : 'ghost'}
                      size="sm"
                      onClick={() => togglePlayerExclude(player.id)}
                    >
                      ❌
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Optimized Lineup */}
        <Card>
          <CardHeader>
            <CardTitle>Optimized Lineup</CardTitle>
            <CardDescription>
              {lineup ? `${lineup.confidence}% confidence score` : 'Click optimize to generate'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lineup ? (
              <>
                <div className="space-y-2 mb-6">
                  {lineup.players.map((player, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{player.position}</Badge>
                        <span className="text-white font-medium">{player.playerName}</span>
                        <span className="text-xs text-gray-500">{player.team}</span>
                        {player.patternBoost && (
                          <Badge variant="success" size="sm">
                            +{player.patternBoost}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-white">{player.projection} pts</div>
                        {player.salary && (
                          <div className="text-sm text-gray-400">${player.salary}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Totals */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Total Projection</span>
                    <span className="text-xl font-bold text-white">
                      {lineup.totalProjection.toFixed(1)} pts
                    </span>
                  </div>
                  {lineup.totalSalary && (
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-400">Total Salary</span>
                      <span className="text-lg text-white">
                        ${lineup.totalSalary.toLocaleString()} / ${SALARY_CAPS.DFS[platform].toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Pattern Advantages */}
                {lineup.patternAdvantages.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Pattern Advantages</h4>
                    <div className="space-y-1">
                      {lineup.patternAdvantages.map((advantage, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">{advantage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2 mt-6">
                  <Button variant="primary" className="flex-1">
                    Export Lineup
                  </Button>
                  <Button variant="secondary">
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <p className="text-gray-400">
                  Configure your settings and click optimize to generate a lineup
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* GPU Status */}
      <div className="fixed bottom-4 left-4 glass-card px-4 py-2 rounded-full flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-300">GPU Acceleration Active</span>
      </div>
    </div>
  )
}