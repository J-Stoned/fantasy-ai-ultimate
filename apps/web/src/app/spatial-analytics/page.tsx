'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Select } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { HeatMap } from '../../components/spatial/HeatMap'
import { PitchControl } from '../../components/spatial/PitchControl'
import { fantasyAPI, SpatialProjection, PitchControlData, MovementPattern } from '../../services/fantasy-api'

export default function SpatialAnalyticsPage() {
  const [selectedSport, setSelectedSport] = useState<'basketball' | 'soccer' | 'football'>('basketball')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [spatialProjection, setSpatialProjection] = useState<SpatialProjection | null>(null)
  const [pitchControlData, setPitchControlData] = useState<PitchControlData | null>(null)
  const [movementPatterns, setMovementPatterns] = useState<MovementPattern[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'player' | 'game' | 'patterns'>('player')

  // Mock player data for demonstration
  const mockPlayers = [
    { id: 'player1', name: 'LeBron James', team: 'LAL' },
    { id: 'player2', name: 'Stephen Curry', team: 'GSW' },
    { id: 'player3', name: 'Giannis Antetokounmpo', team: 'MIL' },
    { id: 'player4', name: 'Kevin Durant', team: 'PHX' },
    { id: 'player5', name: 'Nikola Jokic', team: 'DEN' }
  ]

  const mockGames = [
    { id: 'game1', matchup: 'LAL @ GSW', date: '2025-01-12' },
    { id: 'game2', matchup: 'MIL @ BOS', date: '2025-01-12' },
    { id: 'game3', matchup: 'DEN @ PHX', date: '2025-01-12' }
  ]

  useEffect(() => {
    if (selectedPlayer && viewMode === 'player') {
      loadPlayerSpatialData()
    } else if (selectedGame && viewMode === 'game') {
      loadGameSpatialData()
    }
  }, [selectedPlayer, selectedGame, viewMode])

  const loadPlayerSpatialData = async () => {
    setIsLoading(true)
    try {
      const [projection, patterns] = await Promise.all([
        fantasyAPI.getSpatialProjection(selectedPlayer),
        fantasyAPI.getMovementPatterns(selectedPlayer)
      ])
      setSpatialProjection(projection)
      setMovementPatterns(patterns)
    } catch (error) {
      console.error('Error loading player spatial data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadGameSpatialData = async () => {
    setIsLoading(true)
    try {
      const pitchControl = await fantasyAPI.getPitchControl(selectedGame)
      setPitchControlData(pitchControl)
    } catch (error) {
      console.error('Error loading game spatial data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Spatial <span className="gradient-text">Analytics</span>
        </h1>
        <p className="text-xl text-gray-400">
          Dr. Aris Thorne's Advanced Methodologies in Action
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Analytics Configuration</CardTitle>
          <CardDescription>Select sport and analysis type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Sport</label>
              <Select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value as any)}
                className="w-full"
              >
                <option value="basketball">Basketball</option>
                <option value="soccer">Soccer</option>
                <option value="football">Football</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">View Mode</label>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="w-full"
              >
                <option value="player">Player Analysis</option>
                <option value="game">Game Analysis</option>
                <option value="patterns">Pattern Library</option>
              </Select>
            </div>

            {viewMode === 'player' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Player</label>
                <Select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="w-full"
                >
                  <option value="">Select a player</option>
                  {mockPlayers.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.team})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {viewMode === 'game' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Game</label>
                <Select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="w-full"
                >
                  <option value="">Select a game</option>
                  {mockGames.map(game => (
                    <option key={game.id} value={game.id}>
                      {game.matchup} - {game.date}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Player Analysis View */}
      {viewMode === 'player' && selectedPlayer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Spatial Projection Card */}
          <Card>
            <CardHeader>
              <CardTitle>Spatial Projection Analysis</CardTitle>
              <CardDescription>
                Enhanced fantasy projection using spatial analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : spatialProjection ? (
                <>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {spatialProjection.playerName}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-800 rounded-lg">
                        <div className="text-2xl font-bold text-white">
                          {spatialProjection.traditionalProjection.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-400">Traditional Projection</div>
                      </div>
                      <div className="p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-400">
                          {spatialProjection.spatialProjection.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-400">Spatial Projection</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <h4 className="text-sm font-medium text-gray-400">Spatial Components</h4>
                    {Object.entries(spatialProjection.spatialComponents).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-sm font-medium text-white">
                          +{value.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {spatialProjection.keyAdvantages.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Key Advantages</h4>
                      <div className="space-y-2">
                        {spatialProjection.keyAdvantages.map((adv, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span className="text-sm text-gray-300">{adv}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {spatialProjection.recommendedStacks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Recommended Stacks</h4>
                      <div className="space-y-2">
                        {spatialProjection.recommendedStacks.map((stack, idx) => (
                          <div key={idx} className="p-3 bg-purple-900/20 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-white">
                                {stack.partnerName}
                              </span>
                              <Badge className="bg-purple-600 text-white">
                                +{stack.stackBonus.toFixed(1)}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{stack.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  Select a player to view spatial projection
                </div>
              )}
            </CardContent>
          </Card>

          {/* Movement Patterns Card */}
          <Card>
            <CardHeader>
              <CardTitle>Movement Patterns</CardTitle>
              <CardDescription>
                Identified patterns and tendencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movementPatterns.length > 0 ? (
                <div className="space-y-4">
                  {movementPatterns.map((pattern, idx) => (
                    <div key={idx} className="p-4 border border-white/10 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-white font-medium capitalize">
                          {pattern.patternType.replace('_', ' ')}
                        </h4>
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            {pattern.frequency} times
                          </Badge>
                          <Badge variant="success">
                            {(pattern.successRate * 100).toFixed(0)}% success
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Avg space created: {pattern.avgSpaceCreated.toFixed(1)}m
                      </div>
                      {pattern.preferredZones.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500">Preferred zones:</div>
                          <div className="flex gap-2 mt-1">
                            {pattern.preferredZones.map((zone, zIdx) => (
                              <span key={zIdx} className="text-xs bg-gray-800 px-2 py-1 rounded">
                                ({zone.x.toFixed(0)}, {zone.y.toFixed(0)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  {isLoading ? 'Loading patterns...' : 'No patterns available'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Analysis View */}
      {viewMode === 'game' && selectedGame && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pitch Control Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Pitch Control Visualization</CardTitle>
              <CardDescription>
                Real-time space ownership analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pitchControlData ? (
                <PitchControl
                  data={pitchControlData.grid}
                  sport={selectedSport}
                  width={600}
                  height={400}
                />
              ) : (
                <div className="text-center py-16 text-gray-400">
                  {isLoading ? 'Loading pitch control data...' : 'Select a game to visualize'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Control Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Team Control Metrics</CardTitle>
              <CardDescription>
                Space control statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pitchControlData ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-blue-900/20 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {(pitchControlData.teamControl.home * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-400">Home Control</div>
                    </div>
                    <div className="p-4 bg-red-900/20 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {(pitchControlData.teamControl.away * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-400">Away Control</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">High Value Areas</h4>
                    <div className="space-y-2">
                      {pitchControlData.highValueAreas.map((area, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-gray-800 rounded">
                          <span className="text-sm text-gray-300">
                            Zone ({area.x}, {area.y})
                          </span>
                          <span className="text-sm font-medium text-white">
                            {(area.control * 100).toFixed(0)}% control
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  {isLoading ? 'Loading metrics...' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pattern Library View */}
      {viewMode === 'patterns' && (
        <Card>
          <CardHeader>
            <CardTitle>Movement Pattern Library</CardTitle>
            <CardDescription>
              Comprehensive catalog of identified patterns across all players
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <h3 className="text-xl font-semibold text-white mb-4">Pattern Library Coming Soon</h3>
              <p>This section will showcase all discovered movement patterns,</p>
              <p>their effectiveness ratings, and strategic applications.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}