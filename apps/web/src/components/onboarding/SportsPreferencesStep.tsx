'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Trophy,
  Target,
  Users,
  TrendingUp,
  Star,
  CheckCircle,
  Plus,
  X
} from 'lucide-react'

interface SportsPreferencesStepProps {
  data: any
  updateData: (updates: any) => void
}

const SportsPreferencesStep: React.FC<SportsPreferencesStepProps> = ({ data, updateData }) => {
  const [selectedTeamsForSport, setSelectedTeamsForSport] = useState<string | null>(null)

  const sports = [
    {
      id: 'nfl',
      name: 'NFL',
      icon: '🏈',
      accuracy: '96.97%',
      records: '20K+',
      description: 'Our most accurate predictions with the largest dataset',
      gradient: 'from-green-500 to-emerald-500',
      teams: [
        'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
        'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
        'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
        'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
        'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
        'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
        'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
        'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
      ]
    },
    {
      id: 'nba',
      name: 'NBA',
      icon: '🏀',
      accuracy: '89.3%',
      records: '75K+',
      description: 'High-frequency data with detailed player analytics',
      gradient: 'from-orange-500 to-red-500',
      teams: [
        'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
        'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
        'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
        'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat',
        'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
        'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns',
        'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
        'Utah Jazz', 'Washington Wizards'
      ]
    },
    {
      id: 'mlb',
      name: 'MLB',
      icon: '⚾',
      accuracy: '85.1%',
      records: '150K+',
      description: 'Comprehensive baseball analytics with weather integration',
      gradient: 'from-blue-500 to-cyan-500',
      teams: [
        'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
        'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
        'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
        'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
        'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
        'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
        'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
        'Toronto Blue Jays', 'Washington Nationals'
      ]
    },
    {
      id: 'nhl',
      name: 'NHL',
      icon: '🏒',
      accuracy: '82.4%',
      records: '90K+',
      description: 'Hockey analytics with advanced goalie and line tracking',
      gradient: 'from-purple-500 to-pink-500',
      teams: [
        'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres',
        'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche',
        'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers',
        'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
        'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
        'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks',
        'Seattle Kraken', 'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs',
        'Vancouver Canucks', 'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets'
      ]
    }
  ]

  const playStyles = [
    {
      id: 'conservative',
      title: 'Conservative',
      description: 'Focus on consistent, low-risk plays',
      icon: Target,
      features: ['Cash game focused', 'High floor players', 'Safe projections']
    },
    {
      id: 'moderate',
      title: 'Balanced',
      description: 'Mix of safe and upside plays',
      icon: TrendingUp,
      features: ['Mixed contests', 'Balanced approach', 'Flexible strategy']
    },
    {
      id: 'aggressive',
      title: 'Aggressive',
      description: 'High-upside tournament plays',
      icon: Trophy,
      features: ['GPP focused', 'High ceiling players', 'Contrarian picks']
    }
  ]

  const playTypeOptions = [
    { id: 'cash-games', label: 'Cash Games', description: 'Head-to-head, 50/50s, double-ups' },
    { id: 'tournaments', label: 'Tournaments', description: 'GPPs, large field contests' },
    { id: 'mixed', label: 'Mixed', description: 'Both cash games and tournaments' }
  ]

  const toggleSport = (sportId: string) => {
    const currentSports = data.selectedSports || []
    const updatedSports = currentSports.includes(sportId)
      ? currentSports.filter((id: string) => id !== sportId)
      : [...currentSports, sportId]
    
    updateData({ selectedSports: updatedSports })
  }

  const toggleTeam = (sport: string, team: string) => {
    const currentTeams = data.favoriteTeams || {}
    const sportTeams = currentTeams[sport] || []
    const updatedTeams = sportTeams.includes(team)
      ? sportTeams.filter((t: string) => t !== team)
      : [...sportTeams, team]
    
    updateData({
      favoriteTeams: {
        ...currentTeams,
        [sport]: updatedTeams
      }
    })
  }

  const updatePlayerPreferences = (key: string, value: string) => {
    updateData({
      playerPreferences: {
        ...data.playerPreferences,
        [key]: value
      }
    })
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
          Sports & Preferences
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Select your sports and set up your playing preferences for optimal recommendations.
        </p>
      </motion.div>

      {/* Sports Selection */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          Choose Your Sports
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sports.map((sport, index) => {
            const isSelected = data.selectedSports?.includes(sport.id)
            
            return (
              <motion.div
                key={sport.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card 
                  className={`p-6 cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? 'bg-gray-800 border-primary-500 shadow-lg shadow-primary-500/20' 
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                  }`}
                  onClick={() => toggleSport(sport.id)}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{sport.icon}</div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">
                            {sport.name}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className={`bg-gradient-to-r ${sport.gradient} bg-clip-text text-transparent font-medium`}>
                              {sport.accuracy} accuracy
                            </span>
                            <span className="text-gray-400">
                              {sport.records} records
                            </span>
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-primary-400" />
                      )}
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-300 text-sm">
                      {sport.description}
                    </p>
                    
                    {/* Team Selection Button */}
                    {isSelected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTeamsForSport(sport.id)
                        }}
                        className="w-full"
                      >
                        Select Favorite Teams ({data.favoriteTeams?.[sport.id]?.length || 0})
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Player Preferences */}
      {data.selectedSports?.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Playing Style Preferences
          </h2>
          
          {/* Risk Tolerance */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Risk Tolerance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {playStyles.map((style, index) => {
                const Icon = style.icon
                const isSelected = data.playerPreferences?.riskTolerance === style.id
                
                return (
                  <motion.div
                    key={style.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card 
                      className={`p-4 cursor-pointer transition-all duration-300 ${
                        isSelected 
                          ? 'bg-gray-800 border-primary-500' 
                          : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                      }`}
                      onClick={() => updatePlayerPreferences('riskTolerance', style.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-primary-400' : 'text-gray-400'}`} />
                        <div>
                          <h4 className="font-medium text-white">{style.title}</h4>
                          <p className="text-sm text-gray-400">{style.description}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-primary-400 ml-auto" />
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Play Style */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Contest Type Preference</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {playTypeOptions.map((option, index) => {
                const isSelected = data.playerPreferences?.playStyle === option.id
                
                return (
                  <motion.div
                    key={option.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card 
                      className={`p-4 cursor-pointer transition-all duration-300 ${
                        isSelected 
                          ? 'bg-gray-800 border-primary-500' 
                          : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                      }`}
                      onClick={() => updatePlayerPreferences('playStyle', option.id)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-white">{option.label}</h4>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-primary-400" />
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{option.description}</p>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Team Selection Modal */}
      {selectedTeamsForSport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                Select {sports.find(s => s.id === selectedTeamsForSport)?.name} Teams
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedTeamsForSport(null)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sports.find(s => s.id === selectedTeamsForSport)?.teams.map((team) => {
                const isSelected = data.favoriteTeams?.[selectedTeamsForSport]?.includes(team)
                
                return (
                  <Button
                    key={team}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleTeam(selectedTeamsForSport, team)}
                    className="text-left justify-start h-auto p-3"
                  >
                    <span className="truncate">{team}</span>
                  </Button>
                )
              })}
            </div>
            
            <div className="flex justify-end mt-6">
              <Button onClick={() => setSelectedTeamsForSport(null)}>
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default SportsPreferencesStep