'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Input } from '../../components/ui'
import { Badge } from '../../components/ui/badge'
import { Select } from '../../components/ui/select'
import { fantasyAPI, TradeAnalysis } from '../../services/fantasy-api'

interface Player {
  id: string
  name: string
  position: string
  team: string
  value: number
  projection: number
  trending: 'up' | 'down' | 'stable'
}

const mockPlayers: Player[] = [
  { id: '1', name: 'Christian McCaffrey', position: 'RB', team: 'SF', value: 95, projection: 20.5, trending: 'stable' },
  { id: '2', name: 'Tyreek Hill', position: 'WR', team: 'MIA', value: 88, projection: 17.8, trending: 'up' },
  { id: '3', name: 'Justin Jefferson', position: 'WR', team: 'MIN', value: 92, projection: 18.9, trending: 'up' },
  { id: '4', name: 'Austin Ekeler', position: 'RB', team: 'LAC', value: 82, projection: 18.2, trending: 'down' },
  { id: '5', name: 'Travis Kelce', position: 'TE', team: 'KC', value: 85, projection: 15.7, trending: 'stable' },
  { id: '6', name: 'Stefon Diggs', position: 'WR', team: 'BUF', value: 84, projection: 16.9, trending: 'stable' },
  { id: '7', name: 'Davante Adams', position: 'WR', team: 'LV', value: 86, projection: 17.3, trending: 'down' },
  { id: '8', name: 'Derrick Henry', position: 'RB', team: 'TEN', value: 78, projection: 16.4, trending: 'down' },
]

export default function TradeAnalyzerPage() {
  const [givePlayers, setGivePlayers] = useState<Player[]>([])
  const [receivePlayers, setReceivePlayers] = useState<Player[]>([])
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [searchGive, setSearchGive] = useState('')
  const [searchReceive, setSearchReceive] = useState('')
  const [selectedLeague, setSelectedLeague] = useState('league1')
  const voiceButtonRef = useRef<HTMLButtonElement>(null)
  
  const handleAddPlayer = (player: Player, side: 'give' | 'receive') => {
    if (side === 'give') {
      setGivePlayers([...givePlayers, player])
      setSearchGive('')
    } else {
      setReceivePlayers([...receivePlayers, player])
      setSearchReceive('')
    }
  }
  
  const handleRemovePlayer = (playerId: string, side: 'give' | 'receive') => {
    if (side === 'give') {
      setGivePlayers(givePlayers.filter(p => p.id !== playerId))
    } else {
      setReceivePlayers(receivePlayers.filter(p => p.id !== playerId))
    }
  }
  
  const handleAnalyzeTrade = async () => {
    if (givePlayers.length === 0 || receivePlayers.length === 0) return
    
    setIsAnalyzing(true)
    
    try {
      const result = await fantasyAPI.analyzeTrade({
        give: givePlayers.map(p => p.id),
        receive: receivePlayers.map(p => p.id),
        leagueId: selectedLeague,
        scoringSystem: 'PPR'
      })
      setAnalysis(result)
    } catch (error) {
      console.error('Trade analysis failed:', error)
      // Mock analysis for demo
      setAnalysis({
        recommendation: 'reject',
        marketValueDiff: -8.5,
        projectionDiff: -2.3,
        scheduleAnalysis: {
          give: 72,
          receive: 68
        },
        patternImpact: {
          give: [{ player: givePlayers[0].name, patterns: ['Back-to-Back Fade'] }],
          receive: [{ player: receivePlayers[0].name, patterns: ['Altitude Advantage', 'Division Dog Bite'] }]
        },
        counterOffer: {
          give: [givePlayers[0].id],
          receive: [receivePlayers[0].id, '9'],
          reasoning: 'Add a WR2 to balance the trade value'
        },
        confidence: 78,
        reasoning: 'You\'re giving up too much value. McCaffrey is elite and the return doesn\'t match his production.'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  const handleVoiceCommand = async () => {
    if (!isListening) {
      setIsListening(true)
      
      try {
        // Check if browser supports speech recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        
        if (!SpeechRecognition) {
          alert('Speech recognition not supported in your browser')
          setIsListening(false)
          return
        }
        
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'
        
        recognition.onresult = async (event: any) => {
          const command = event.results[0][0].transcript
          console.log('Voice command:', command)
          
          // Process voice command
          const result = await fantasyAPI.processVoiceCommand(command, {
            type: 'trade',
            players: mockPlayers
          })
          
          // Handle result based on command type
          if (result.type === 'trade_analysis') {
            // Example: "Should I trade McCaffrey for Hill and Ekeler?"
            // Parse and populate the trade
          }
          
          setIsListening(false)
        }
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }
        
        recognition.start()
      } catch (error) {
        console.error('Voice command error:', error)
        setIsListening(false)
      }
    }
  }
  
  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'accept': return 'text-green-400 bg-green-500/10'
      case 'reject': return 'text-red-400 bg-red-500/10'
      case 'counter': return 'text-yellow-400 bg-yellow-500/10'
      default: return 'text-gray-400 bg-gray-500/10'
    }
  }
  
  const filteredGivePlayers = mockPlayers.filter(p => 
    p.name.toLowerCase().includes(searchGive.toLowerCase()) &&
    !givePlayers.some(gp => gp.id === p.id) &&
    !receivePlayers.some(rp => rp.id === p.id)
  )
  
  const filteredReceivePlayers = mockPlayers.filter(p => 
    p.name.toLowerCase().includes(searchReceive.toLowerCase()) &&
    !givePlayers.some(gp => gp.id === p.id) &&
    !receivePlayers.some(rp => rp.id === p.id)
  )
  
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Trade <span className="gradient-text">Analyzer</span>
            </h1>
            <p className="text-xl text-gray-400">
              AI-powered trade analysis with pattern insights
            </p>
          </div>
          
          {/* Voice Command Button */}
          <Button
            ref={voiceButtonRef}
            onClick={handleVoiceCommand}
            variant={isListening ? 'danger' : 'secondary'}
            size="lg"
            className="w-full md:w-auto"
          >
            <span className="mr-2">{isListening ? '🔴' : '🎤'}</span>
            {isListening ? 'Listening...' : 'Voice Command'}
          </Button>
        </div>
      </div>
      
      {/* League Selection */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-400">League:</label>
            <Select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="flex-1 md:w-64"
            >
              <option value="league1">Dynasty Warriors (12-team PPR)</option>
              <option value="league2">The League (10-team Standard)</option>
              <option value="league3">Redraft Legends (14-team Half-PPR)</option>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Trade Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Give Side */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-400">You Give</CardTitle>
            <CardDescription>Select players you\'re offering</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-4">
              <Input
                placeholder="Search players to give..."
                value={searchGive}
                onChange={(e) => setSearchGive(e.target.value)}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              
              {/* Search Results */}
              {searchGive && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {filteredGivePlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddPlayer(player, 'give')}
                      className="w-full text-left p-2 rounded hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="text-white">{player.name}</span>
                        <Badge variant="secondary" size="sm" className="ml-2">
                          {player.position}
                        </Badge>
                        <span className="text-xs text-gray-500 ml-1">{player.team}</span>
                      </div>
                      <span className="text-sm text-gray-400">{player.projection} pts</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selected Players */}
            <div className="space-y-2">
              {givePlayers.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{player.name}</span>
                    <Badge variant="secondary" size="sm">{player.position}</Badge>
                    <span className="text-xs text-gray-500">{player.team}</span>
                  </div>
                  <button
                    onClick={() => handleRemovePlayer(player.id, 'give')}
                    className="text-gray-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              {givePlayers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No players selected
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Receive Side */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-400">You Receive</CardTitle>
            <CardDescription>Select players you\'re getting</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-4">
              <Input
                placeholder="Search players to receive..."
                value={searchReceive}
                onChange={(e) => setSearchReceive(e.target.value)}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              
              {/* Search Results */}
              {searchReceive && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {filteredReceivePlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddPlayer(player, 'receive')}
                      className="w-full text-left p-2 rounded hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="text-white">{player.name}</span>
                        <Badge variant="secondary" size="sm" className="ml-2">
                          {player.position}
                        </Badge>
                        <span className="text-xs text-gray-500 ml-1">{player.team}</span>
                      </div>
                      <span className="text-sm text-gray-400">{player.projection} pts</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selected Players */}
            <div className="space-y-2">
              {receivePlayers.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{player.name}</span>
                    <Badge variant="secondary" size="sm">{player.position}</Badge>
                    <span className="text-xs text-gray-500">{player.team}</span>
                  </div>
                  <button
                    onClick={() => handleRemovePlayer(player.id, 'receive')}
                    className="text-gray-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              {receivePlayers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No players selected
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Analyze Button */}
      <div className="text-center mb-8">
        <Button
          onClick={handleAnalyzeTrade}
          loading={isAnalyzing}
          size="lg"
          disabled={givePlayers.length === 0 || receivePlayers.length === 0}
        >
          {isAnalyzing ? 'Analyzing Trade...' : 'Analyze Trade'}
        </Button>
      </div>
      
      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Analysis</CardTitle>
            <CardDescription>AI-powered recommendation with pattern insights</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Recommendation */}
            <div className={`p-4 rounded-lg ${getRecommendationColor(analysis.recommendation)} mb-6`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold uppercase">{analysis.recommendation}</h3>
                <Badge variant="secondary">{analysis.confidence}% Confidence</Badge>
              </div>
              <p className="text-sm opacity-90">{analysis.reasoning}</p>
            </div>
            
            {/* Value Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Market Value</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-300">You Give</span>
                    <span className="text-white font-medium">
                      {givePlayers.reduce((sum, p) => sum + p.value, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">You Receive</span>
                    <span className="text-white font-medium">
                      {receivePlayers.reduce((sum, p) => sum + p.value, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-gray-300">Difference</span>
                    <span className={`font-medium ${analysis.marketValueDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {analysis.marketValueDiff > 0 ? '+' : ''}{analysis.marketValueDiff}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Weekly Projections</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-300">You Give</span>
                    <span className="text-white font-medium">
                      {givePlayers.reduce((sum, p) => sum + p.projection, 0).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">You Receive</span>
                    <span className="text-white font-medium">
                      {receivePlayers.reduce((sum, p) => sum + p.projection, 0).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-gray-300">Difference</span>
                    <span className={`font-medium ${analysis.projectionDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {analysis.projectionDiff > 0 ? '+' : ''}{analysis.projectionDiff.toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Pattern Impact */}
            {(analysis.patternImpact.give.length > 0 || analysis.patternImpact.receive.length > 0) && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Pattern Analysis</h4>
                <div className="space-y-2">
                  {analysis.patternImpact.give.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-red-400">-</span>
                      <span className="text-gray-300">
                        {item.player} affected by: {item.patterns.join(', ')}
                      </span>
                    </div>
                  ))}
                  {analysis.patternImpact.receive.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-green-400">+</span>
                      <span className="text-gray-300">
                        {item.player} benefits from: {item.patterns.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Counter Offer */}
            {analysis.counterOffer && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <h4 className="text-yellow-400 font-medium mb-2">Suggested Counter Offer</h4>
                <p className="text-sm text-gray-300 mb-2">{analysis.counterOffer.reasoning}</p>
                <Button variant="secondary" size="sm">
                  View Counter Offer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Voice Command Examples */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Voice Command Examples</CardTitle>
          <CardDescription>Try saying these commands</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-green-400">🎤</span>
              <span className="text-gray-300">"Should I trade McCaffrey for Hill and Ekeler?"</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400">🎤</span>
              <span className="text-gray-300">"What's the value of Justin Jefferson?"</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400">🎤</span>
              <span className="text-gray-300">"Who should I target for Travis Kelce?"</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400">🎤</span>
              <span className="text-gray-300">"Is this a fair trade?"</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}