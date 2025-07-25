'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Star,
  Search,
  TrendingUp,
  Trophy,
  Target,
  Users,
  CheckCircle,
  X,
  Filter,
  Crown,
  Zap
} from 'lucide-react'

interface PlayerFollowingStepProps {
  data: any
  updateData: (updates: any) => void
}

const PlayerFollowingStep: React.FC<PlayerFollowingStepProps> = ({ data, updateData }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSport, setSelectedSport] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)

  // Top players data by sport
  const topPlayers = {
    nfl: [
      { id: 'mahomes', name: 'Patrick Mahomes', position: 'QB', team: 'KC', rating: 98, tier: 'elite', salary: 9500 },
      { id: 'allen', name: 'Josh Allen', position: 'QB', team: 'BUF', rating: 96, tier: 'elite', salary: 9200 },
      { id: 'lamar', name: 'Lamar Jackson', position: 'QB', team: 'BAL', rating: 94, tier: 'elite', salary: 8800 },
      { id: 'cmc', name: 'Christian McCaffrey', position: 'RB', team: 'SF', rating: 96, tier: 'elite', salary: 9800 },
      { id: 'saquon', name: 'Saquon Barkley', position: 'RB', team: 'PHI', rating: 93, tier: 'elite', salary: 8600 },
      { id: 'henry', name: 'Derrick Henry', position: 'RB', team: 'BAL', rating: 91, tier: 'elite', salary: 8200 },
      { id: 'jefferson', name: 'Justin Jefferson', position: 'WR', team: 'MIN', rating: 97, tier: 'elite', salary: 9600 },
      { id: 'hill', name: 'Tyreek Hill', position: 'WR', team: 'MIA', rating: 95, tier: 'elite', salary: 9000 },
      { id: 'adams', name: 'Davante Adams', position: 'WR', team: 'LV', rating: 93, tier: 'elite', salary: 8400 },
      { id: 'kelce', name: 'Travis Kelce', position: 'TE', team: 'KC', rating: 96, tier: 'elite', salary: 8800 },
      { id: 'andrews', name: 'Mark Andrews', position: 'TE', team: 'BAL', rating: 89, tier: 'top', salary: 7200 },
      { id: 'kittle', name: 'George Kittle', position: 'TE', team: 'SF', rating: 88, tier: 'top', salary: 6800 }
    ],
    nba: [
      { id: 'luka', name: 'Luka Dončić', position: 'PG', team: 'DAL', rating: 97, tier: 'elite', salary: 11500 },
      { id: 'jokic', name: 'Nikola Jokić', position: 'C', team: 'DEN', rating: 98, tier: 'elite', salary: 12000 },
      { id: 'giannis', name: 'Giannis Antetokounmpo', position: 'PF', team: 'MIL', rating: 96, tier: 'elite', salary: 11800 },
      { id: 'tatum', name: 'Jayson Tatum', position: 'SF', team: 'BOS', rating: 94, tier: 'elite', salary: 10800 },
      { id: 'curry', name: 'Stephen Curry', position: 'PG', team: 'GSW', rating: 93, tier: 'elite', salary: 10200 },
      { id: 'edwards', name: 'Anthony Edwards', position: 'SG', team: 'MIN', rating: 91, tier: 'top', salary: 9800 },
      { id: 'fox', name: "De'Aaron Fox", position: 'PG', team: 'SAC', rating: 89, tier: 'top', salary: 9200 },
      { id: 'sga', name: 'Shai Gilgeous-Alexander', position: 'PG', team: 'OKC', rating: 92, tier: 'elite', salary: 10000 }
    ],
    mlb: [
      { id: 'ohtani', name: 'Shohei Ohtani', position: 'DH/P', team: 'LAD', rating: 99, tier: 'elite', salary: 6500 },
      { id: 'judge', name: 'Aaron Judge', position: 'OF', team: 'NYY', rating: 95, tier: 'elite', salary: 6000 },
      { id: 'betts', name: 'Mookie Betts', position: 'OF', team: 'LAD', rating: 94, tier: 'elite', salary: 5800 },
      { id: 'tatis', name: 'Fernando Tatis Jr.', position: 'OF', team: 'SD', rating: 93, tier: 'elite', salary: 5600 },
      { id: 'soto', name: 'Juan Soto', position: 'OF', team: 'NYY', rating: 96, tier: 'elite', salary: 5900 },
      { id: 'acuna', name: 'Ronald Acuña Jr.', position: 'OF', team: 'ATL', rating: 94, tier: 'elite', salary: 5700 },
      { id: 'freeman', name: 'Freddie Freeman', position: '1B', team: 'LAD', rating: 90, tier: 'top', salary: 5200 },
      { id: 'devers', name: 'Rafael Devers', position: '3B', team: 'BOS', rating: 89, tier: 'top', salary: 5000 }
    ],
    nhl: [
      { id: 'mcdavid', name: 'Connor McDavid', position: 'C', team: 'EDM', rating: 99, tier: 'elite', salary: 9500 },
      { id: 'pastrnak', name: 'David Pastrňák', position: 'RW', team: 'BOS', rating: 95, tier: 'elite', salary: 8800 },
      { id: 'draisaitl', name: 'Leon Draisaitl', position: 'C', team: 'EDM', rating: 94, tier: 'elite', salary: 8600 },
      { id: 'mackinnon', name: 'Nathan MacKinnon', position: 'C', team: 'COL', rating: 96, tier: 'elite', salary: 8900 },
      { id: 'kucherov', name: 'Nikita Kucherov', position: 'RW', team: 'TB', rating: 93, tier: 'elite', salary: 8400 },
      { id: 'makar', name: 'Cale Makar', position: 'D', team: 'COL', rating: 94, tier: 'elite', salary: 8000 },
      { id: 'shesterkin', name: 'Igor Shesterkin', position: 'G', team: 'NYR', rating: 92, tier: 'elite', salary: 8200 },
      { id: 'hellebuyck', name: 'Connor Hellebuyck', position: 'G', team: 'WPG', rating: 90, tier: 'top', salary: 7800 }
    ]
  }

  // Get positions for selected sport
  const getPositionsForSport = (sport: string) => {
    switch (sport) {
      case 'nfl': return ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
      case 'nba': return ['PG', 'SG', 'SF', 'PF', 'C']
      case 'mlb': return ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'P']
      case 'nhl': return ['C', 'LW', 'RW', 'D', 'G']
      default: return []
    }
  }

  // Filter players based on search and filters
  const filteredPlayers = useMemo(() => {
    let players = []
    
    if (selectedSport && topPlayers[selectedSport as keyof typeof topPlayers]) {
      players = topPlayers[selectedSport as keyof typeof topPlayers]
    } else {
      // Show players from all selected sports
      players = data.selectedSports?.flatMap((sport: string) => 
        topPlayers[sport as keyof typeof topPlayers] || []
      ) || []
    }

    if (searchTerm) {
      players = players.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedPosition) {
      players = players.filter(player => player.position === selectedPosition)
    }

    return players
  }, [selectedSport, searchTerm, selectedPosition, data.selectedSports])

  const togglePlayer = (playerId: string) => {
    const currentFollowing = data.followingPlayers || []
    const updatedFollowing = currentFollowing.includes(playerId)
      ? currentFollowing.filter((id: string) => id !== playerId)
      : [...currentFollowing, playerId]
    
    updateData({ followingPlayers: updatedFollowing })
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'elite': return 'from-yellow-500 to-orange-500'
      case 'top': return 'from-blue-500 to-cyan-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'elite': return Crown
      case 'top': return Star
      default: return Target
    }
  }

  const getFollowingByPosition = () => {
    const following = data.followingPlayers || []
    const positions: { [key: string]: number } = {}
    
    following.forEach((playerId: string) => {
      const allPlayers = Object.values(topPlayers).flat()
      const player = allPlayers.find(p => p.id === playerId)
      if (player) {
        positions[player.position] = (positions[player.position] || 0) + 1
      }
    })
    
    return positions
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold text-white">
          Follow Your Favorite Players
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Get personalized alerts, projections, and insights for the players you care about most.
        </p>
      </motion.div>

      {/* Following Summary */}
      {data.followingPlayers?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="p-6 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Following {data.followingPlayers.length} Players
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(getFollowingByPosition()).map(([position, count]) => (
                    <div key={position} className="flex items-center space-x-1 text-sm">
                      <span className="text-primary-400 font-medium">{count}</span>
                      <span className="text-gray-300">{position}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Users className="w-8 h-8 text-primary-400" />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search players or teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              rightElement={
                searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm('')}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )
              }
            />
          </div>

          {/* Sport Filter */}
          <div className="flex gap-2">
            {['All', ...(data.selectedSports || [])].map(sport => (
              <Button
                key={sport}
                variant={selectedSport === (sport === 'All' ? null : sport) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSport(sport === 'All' ? null : sport)}
                className="text-xs"
              >
                {sport === 'All' ? 'All Sports' : sport.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Position Filter */}
        {selectedSport && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedPosition === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPosition(null)}
              className="text-xs"
            >
              All Positions
            </Button>
            {getPositionsForSport(selectedSport).map(position => (
              <Button
                key={position}
                variant={selectedPosition === position ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPosition(position)}
                className="text-xs"
              >
                {position}
              </Button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlayers.map((player, index) => {
          const isFollowing = data.followingPlayers?.includes(player.id)
          const TierIcon = getTierIcon(player.tier)
          
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card 
                className={`p-4 cursor-pointer transition-all duration-300 ${
                  isFollowing 
                    ? 'bg-gray-800 border-primary-500 shadow-lg shadow-primary-500/20' 
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                }`}
                onClick={() => togglePlayer(player.id)}
              >
                <div className="space-y-3">
                  {/* Player Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${getTierColor(player.tier)} rounded-lg flex items-center justify-center`}>
                        <TierIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">
                          {player.name}
                        </h3>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="text-gray-400">{player.position}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">{player.team}</span>
                        </div>
                      </div>
                    </div>
                    {isFollowing && (
                      <CheckCircle className="w-5 h-5 text-primary-400" />
                    )}
                  </div>

                  {/* Player Stats */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-gray-300">Rating: {player.rating}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-gray-300">${player.salary}</span>
                    </div>
                  </div>

                  {/* Tier Badge */}
                  <div className="flex justify-between items-center">
                    <div className={`px-2 py-1 bg-gradient-to-r ${getTierColor(player.tier)} bg-clip-text text-transparent text-xs font-medium`}>
                      {player.tier.toUpperCase()} TIER
                    </div>
                    {isFollowing && (
                      <div className="text-xs text-primary-400 font-medium">
                        Following
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* No Results */}
      {filteredPlayers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            No players found
          </h3>
          <p className="text-gray-500">
            Try adjusting your search or filters
          </p>
        </motion.div>
      )}

      {/* Quick Add Suggestions */}
      {data.followingPlayers?.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Star className="w-5 h-5 mr-2 text-yellow-400" />
              Quick Start: Follow Elite Players
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Get started by following some of the highest-rated players in your sports:
            </p>
            <div className="flex flex-wrap gap-2">
              {data.selectedSports?.slice(0, 2).flatMap((sport: string) =>
                (topPlayers[sport as keyof typeof topPlayers] || [])
                  .filter(p => p.tier === 'elite')
                  .slice(0, 3)
                  .map(player => (
                    <Button
                      key={player.id}
                      variant="outline"
                      size="sm"
                      onClick={() => togglePlayer(player.id)}
                      className="text-xs"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      {player.name}
                    </Button>
                  ))
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default PlayerFollowingStep