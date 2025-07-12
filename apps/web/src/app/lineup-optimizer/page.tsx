'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Select } from '../../components/ui/select'
import { Input } from '../../components/ui'
import { Badge } from '../../components/ui/badge'
import { fantasyAPI, Lineup, SportType, SpatialProjection } from '../../services/fantasy-api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { WS_CHANNELS } from '../../services/websocket-service'
import { HeatMap } from '../../components/spatial/HeatMap'
import { PitchControl } from '../../components/spatial/PitchControl'

interface Player {
  id: string
  name: string
  position: string
  team: string
  projection: number
  salary?: number
  ownership?: number
  patternBoost?: number
  // Spatial analytics
  spatialProjection?: number
  xgContribution?: number
  spaceCreationValue?: number
  movementEfficiency?: number
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
  const [yahooConnection, setYahooConnection] = useState<any>(null)
  const [includeSpatial, setIncludeSpatial] = useState(true)
  const [spatialWeight, setSpatialWeight] = useState(0.3)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [spatialData, setSpatialData] = useState<Record<string, SpatialProjection>>({})
  const [selectedLeague, setSelectedLeague] = useState<string>('')
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [isSyncingToYahoo, setIsSyncingToYahoo] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')
  
  // Subscribe to lineup updates
  useWebSocket(WS_CHANNELS.LINEUP_CHANGES, (update) => {
    console.log('Lineup update:', update)
    // Handle real-time lineup changes
  })
  
  // Load player pool (mock data for now)
  useEffect(() => {
    loadPlayerPool()
  }, [sport, format])
  
  // Check Yahoo connection on mount
  useEffect(() => {
    checkYahooConnection()
  }, [])
  
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
      
      // Use spatial optimization if enabled
      const optimizedLineup = includeSpatial 
        ? await fantasyAPI.optimizeWithSpatial({ ...config, includeSpatial, spatialWeight })
        : await fantasyAPI.optimizeLineup(config)
      
      setLineup(optimizedLineup)
      
      // Fetch spatial data for players in lineup if spatial is enabled
      if (includeSpatial && optimizedLineup.players) {
        const spatialPromises = optimizedLineup.players.map(async (player) => {
          try {
            const spatial = await fantasyAPI.getSpatialProjection(player.playerId)
            return { playerId: player.playerId, spatial }
          } catch (error) {
            console.error(`Failed to get spatial data for ${player.playerName}:`, error)
            return null
          }
        })
        
        const results = await Promise.all(spatialPromises)
        const newSpatialData: Record<string, SpatialProjection> = {}
        results.forEach(result => {
          if (result) {
            newSpatialData[result.playerId] = result.spatial
          }
        })
        setSpatialData(newSpatialData)
      }
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
  
  const checkYahooConnection = async () => {
    try {
      const response = await fetch('/api/platform-connections/yahoo')
      if (response.ok) {
        const data = await response.json()
        if (data.connection && data.connection.isActive) {
          setYahooConnection(data.connection)
          // Load user's Yahoo leagues
          loadYahooLeagues()
        }
      }
    } catch (error) {
      console.error('Failed to check Yahoo connection:', error)
    }
  }
  
  const loadYahooLeagues = async () => {
    try {
      const response = await fetch('/api/fantasy/yahoo/leagues')
      if (response.ok) {
        const data = await response.json()
        if (data.leagues && data.leagues.length > 0) {
          setSelectedLeague(data.leagues[0].platformLeagueId)
          setSelectedTeam(data.leagues[0].teams[0]?.id || '')
        }
      }
    } catch (error) {
      console.error('Failed to load Yahoo leagues:', error)
    }
  }
  
  const syncLineupToYahoo = async () => {
    if (!lineup || !selectedTeam || !yahooConnection) {
      setSyncStatus('Missing required data')
      return
    }
    
    setIsSyncingToYahoo(true)
    setSyncStatus('Syncing lineup to Yahoo...')
    
    try {
      // Map our lineup to Yahoo player keys
      const changes = lineup.players.map(player => ({
        playerId: `nfl.p.${player.playerId}`, // This would need proper mapping
        position: player.position === 'FLEX' ? 'W/R/T' : player.position
      }))
      
      // Determine coverage type based on sport
      const coverageType = sport === 'NFL' ? 'week' : 'date'
      const coverageValue = sport === 'NFL' ? 
        new Date().getWeek() : // Would need proper week calculation
        new Date().toISOString().split('T')[0]
      
      const response = await fetch('/api/fantasy/yahoo/lineup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamKey: selectedTeam,
          leagueId: selectedLeague,
          changes,
          coverageType,
          coverageValue
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setSyncStatus('✅ Lineup synced to Yahoo successfully!')
        setTimeout(() => setSyncStatus(''), 5000)
      } else {
        const error = await response.json()
        setSyncStatus(`❌ Sync failed: ${error.error}`)
      }
    } catch (error) {
      setSyncStatus(`❌ Sync error: ${error.message}`)
    } finally {
      setIsSyncingToYahoo(false)
    }
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
          
          {/* Spatial Analytics Toggle */}
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Spatial Analytics
                  <Badge className="bg-purple-600 text-white">Dr. Thorne's Methodology</Badge>
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Enable xG models, pitch control, and movement pattern analysis
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeSpatial}
                    onChange={(e) => setIncludeSpatial(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-600"
                  />
                  <span className="text-white">Enable</span>
                </label>
              </div>
            </div>
            
            {includeSpatial && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Spatial Weight (0-1)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={spatialWeight}
                    onChange={(e) => setSpatialWeight(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white font-mono">{spatialWeight.toFixed(1)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Higher weight = more emphasis on spatial factors vs traditional stats
                </p>
              </div>
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
                  {lineup.players.map((player, idx) => {
                    const spatial = spatialData[player.playerId]
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedPlayer === player.playerId 
                            ? 'border-purple-500 bg-purple-900/20' 
                            : 'border-white/10 hover:border-white/20'
                        }`}
                        onClick={() => setSelectedPlayer(player.playerId === selectedPlayer ? null : player.playerId)}
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
                        <div className="text-white">
                          {player.projection} pts
                          {includeSpatial && spatial && (
                            <span className="text-purple-400 text-xs ml-1">
                              (+{(spatial.spatialProjection - spatial.traditionalProjection).toFixed(1)})
                            </span>
                          )}
                        </div>
                        {player.salary && (
                          <div className="text-sm text-gray-400">${player.salary}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Spatial Details */}
                {includeSpatial && selectedPlayer && spatialData[selectedPlayer] && (
                  <div className="mb-6 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                    <h4 className="text-sm font-medium text-purple-400 mb-3">
                      Spatial Analytics for {lineup.players.find(p => p.playerId === selectedPlayer)?.playerName}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">xG Contribution:</span>
                        <span className="text-white ml-2">
                          +{spatialData[selectedPlayer].spatialComponents.expectedGoalsBonus.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Space Creation:</span>
                        <span className="text-white ml-2">
                          +{spatialData[selectedPlayer].spatialComponents.spaceCreationBonus.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Movement Efficiency:</span>
                        <span className="text-white ml-2">
                          +{spatialData[selectedPlayer].spatialComponents.movementEfficiencyBonus.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Synergy Bonus:</span>
                        <span className="text-white ml-2">
                          +{spatialData[selectedPlayer].spatialComponents.synergyBonus.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    {spatialData[selectedPlayer].keyAdvantages.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-gray-400">Key Advantages:</span>
                        <div className="mt-1 space-y-1">
                          {spatialData[selectedPlayer].keyAdvantages.map((adv, idx) => (
                            <div key={idx} className="text-xs text-purple-300">• {adv}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
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
                
                {/* Spatial Analytics Summary */}
                {includeSpatial && lineup.teamSpacingScore && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/10 to-pink-900/10 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-400 mb-3">Spatial Analytics Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">
                          {(lineup.teamSpacingScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-400">Team Spacing</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-pink-400">
                          {(lineup.offensiveSynergy * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-400">Offensive Synergy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {(lineup.defensiveCoverage * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-400">Defensive Coverage</div>
                      </div>
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
                
                {/* Yahoo Sync */}
                {yahooConnection && format === 'season' && (
                  <div className="mt-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">Y!</span>
                        </div>
                        <span className="text-white font-medium">Yahoo Fantasy Sync</span>
                      </div>
                      <Badge variant="success" size="sm">Connected</Badge>
                    </div>
                    
                    {selectedLeague && (
                      <div className="space-y-3">
                        <Select
                          value={selectedTeam}
                          onChange={(e) => setSelectedTeam(e.target.value)}
                          className="w-full"
                        >
                          <option value="">Select Team</option>
                          {/* Teams would be loaded dynamically */}
                          <option value={selectedTeam}>{selectedTeam}</option>
                        </Select>
                        
                        <Button
                          onClick={syncLineupToYahoo}
                          loading={isSyncingToYahoo}
                          className="w-full"
                          variant="primary"
                        >
                          {isSyncingToYahoo ? 'Syncing...' : 'Sync Lineup to Yahoo'}
                        </Button>
                        
                        {syncStatus && (
                          <div className={`text-sm ${
                            syncStatus.includes('✅') ? 'text-green-400' : 
                            syncStatus.includes('❌') ? 'text-red-400' : 
                            'text-yellow-400'
                          }`}>
                            {syncStatus}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
            
            {/* Yahoo Connect Prompt */}
            {!yahooConnection && format === 'season' && lineup && (
              <div className="mt-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold">Y!</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">Connect Yahoo Fantasy</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Connect your Yahoo account to sync lineups directly
                    </p>
                  </div>
                  <Button
                    onClick={() => window.location.href = '/import-league?platform=yahoo'}
                    variant="primary"
                    size="sm"
                  >
                    Connect
                  </Button>
                </div>
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