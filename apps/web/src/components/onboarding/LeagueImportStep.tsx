'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trophy,
  ExternalLink,
  Download,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  DollarSign,
  Settings,
  Crown,
  Zap,
  Plus,
  ArrowRight,
  Globe,
  Lock,
  RefreshCw
} from 'lucide-react'

interface LeagueImportStepProps {
  data: any
  updateData: (updates: any) => void
}

const LeagueImportStep: React.FC<LeagueImportStepProps> = ({ data, updateData }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [loginCredentials, setLoginCredentials] = useState({ username: '', password: '' })
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'connecting' | 'importing' | 'success' | 'error'>('idle')
  const [skipImport, setSkipImport] = useState(false)

  const platforms = [
    {
      id: 'espn',
      name: 'ESPN Fantasy',
      description: 'Import leagues from ESPN Fantasy Sports',
      icon: '📺',
      color: 'from-red-500 to-yellow-500',
      features: ['Draft history', 'League settings', 'Team rosters', 'Scoring rules'],
      supported: true,
      loginRequired: true
    },
    {
      id: 'yahoo',
      name: 'Yahoo Fantasy',
      description: 'Import leagues from Yahoo Fantasy Sports',
      icon: '🟣',
      color: 'from-purple-500 to-pink-500',
      features: ['League data', 'Transaction history', 'Player notes', 'Custom settings'],
      supported: true,
      loginRequired: true
    },
    {
      id: 'sleeper',
      name: 'Sleeper',
      description: 'Import leagues from Sleeper Fantasy',
      icon: '💤',
      color: 'from-blue-500 to-cyan-500',
      features: ['Dynasty values', 'Trade history', 'Chat data', 'Draft picks'],
      supported: true,
      loginRequired: false
    },
    {
      id: 'cbs',
      name: 'CBS Sports',
      description: 'Import leagues from CBS Sports Fantasy',
      icon: '📊',
      color: 'from-green-500 to-emerald-500',
      features: ['League standings', 'Waiver data', 'Lineup history', 'Commissioner tools'],
      supported: true,
      loginRequired: true
    },
    {
      id: 'nfl',
      name: 'NFL Fantasy',
      description: 'Import leagues from NFL.com Fantasy',
      icon: '🏈',
      color: 'from-blue-600 to-red-600',
      features: ['Official NFL data', 'Video highlights', 'Expert rankings', 'News integration'],
      supported: false,
      loginRequired: true
    },
    {
      id: 'fleaflicker',
      name: 'Fleaflicker',
      description: 'Import leagues from Fleaflicker Fantasy',
      icon: '⚡',
      color: 'from-orange-500 to-red-500',
      features: ['Advanced scoring', 'Custom rules', 'Detailed stats', 'Commissioner controls'],
      supported: false,
      loginRequired: true
    }
  ]

  const mockImportedLeagues = [
    {
      id: 'league1',
      name: 'Friends & Family 2024',
      platform: 'espn',
      sport: 'NFL',
      teams: 12,
      type: 'Redraft',
      buyIn: 50,
      status: 'Active',
      position: '3rd Place',
      record: '8-6'
    },
    {
      id: 'league2',
      name: 'Dynasty Dominators',
      platform: 'sleeper',
      sport: 'NFL',
      teams: 10,
      type: 'Dynasty',
      buyIn: 100,
      status: 'Active',
      position: '1st Place',
      record: '11-3'
    },
    {
      id: 'league3',
      name: 'Work League Championship',
      platform: 'yahoo',
      sport: 'NBA',
      teams: 8,
      type: 'Redraft',
      buyIn: 25,
      status: 'Completed',
      position: 'Champion',
      record: '16-4'
    }
  ]

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId)
    setImportStatus('idle')
  }

  const handleImport = async () => {
    if (!selectedPlatform) return

    setIsImporting(true)
    setImportStatus('connecting')

    // Simulate API call to import leagues
    try {
      // Step 1: Connecting
      await new Promise(resolve => setTimeout(resolve, 2000))
      setImportStatus('importing')
      
      // Step 2: Importing data
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Update data with imported leagues
      updateData({ 
        importedLeagues: mockImportedLeagues,
        importPlatform: selectedPlatform
      })
      
      setImportStatus('success')
    } catch (error) {
      setImportStatus('error')
    } finally {
      setIsImporting(false)
    }
  }

  const handleSkip = () => {
    setSkipImport(true)
    updateData({ 
      importedLeagues: [],
      importPlatform: null,
      skippedImport: true
    })
  }

  const getStatusIcon = () => {
    switch (importStatus) {
      case 'connecting':
        return <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
      case 'importing':
        return <Download className="w-5 h-5 text-yellow-400" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      default:
        return null
    }
  }

  const getStatusMessage = () => {
    switch (importStatus) {
      case 'connecting':
        return 'Connecting to platform...'
      case 'importing':
        return 'Importing league data...'
      case 'success':
        return `Successfully imported ${mockImportedLeagues.length} leagues!`
      case 'error':
        return 'Import failed. Please try again.'
      default:
        return ''
    }
  }

  if (importStatus === 'success' || data.importedLeagues?.length > 0) {
    return (
      <div className="space-y-8">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">
            Leagues Imported Successfully!
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            We've imported your existing leagues and will use this data to provide better recommendations.
          </p>
        </motion.div>

        {/* Imported Leagues */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-2xl font-semibold text-white text-center">
            Your Imported Leagues
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(data.importedLeagues || mockImportedLeagues).map((league, index) => (
              <motion.div
                key={league.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card className="p-6 bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all duration-300">
                  <div className="space-y-4">
                    {/* League Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white text-lg">
                          {league.name}
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                          <span>{league.platform.toUpperCase()}</span>
                          <span>•</span>
                          <span>{league.sport}</span>
                          <span>•</span>
                          <span>{league.teams} teams</span>
                        </div>
                      </div>
                      {league.position === 'Champion' || league.position === '1st Place' ? (
                        <Crown className="w-6 h-6 text-yellow-400" />
                      ) : (
                        <Trophy className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    {/* League Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Type</div>
                        <div className="text-white font-medium">{league.type}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Buy-in</div>
                        <div className="text-white font-medium">${league.buyIn}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Position</div>
                        <div className={`font-medium ${
                          league.position === 'Champion' || league.position === '1st Place' 
                            ? 'text-yellow-400' 
                            : 'text-white'
                        }`}>
                          {league.position}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Record</div>
                        <div className="text-white font-medium">{league.record}</div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex justify-between items-center">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        league.status === 'Active' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {league.status}
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs">
                        View Details
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="p-6 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/30">
            <div className="flex items-center space-x-4">
              <Zap className="w-8 h-8 text-primary-400" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Enhanced Recommendations Ready
                </h3>
                <p className="text-gray-300 text-sm">
                  Based on your league history, we'll provide personalized draft strategies, 
                  trade recommendations, and lineup optimizations tailored to your playing style.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (skipImport || data.skippedImport) {
    return (
      <div className="space-y-8">
        {/* Skip Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-white">
            No Problem!
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            You can always import your leagues later from the settings page. 
            We'll still provide great recommendations based on your preferences.
          </p>
        </motion.div>

        {/* Alternative Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            {
              icon: Trophy,
              title: 'Fresh Start',
              description: 'Build new strategies with our AI recommendations',
              color: 'from-yellow-500 to-orange-500'
            },
            {
              icon: Users,
              title: 'Community Insights',
              description: 'Learn from millions of fantasy players worldwide',
              color: 'from-blue-500 to-cyan-500'
            },
            {    
              icon: Zap,
              title: 'Import Later',
              description: 'Add your leagues anytime from the settings menu',
              color: 'from-purple-500 to-pink-500'
            }
          ].map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="p-6 bg-gray-900/50 border-gray-800 h-full">
                  <div className="space-y-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${benefit.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {benefit.title}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    )
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
          Import Your Existing Leagues
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Connect your fantasy accounts to get personalized recommendations based on your league history and playing style.
        </p>
      </motion.div>

      {/* Platform Selection */}
      {!selectedPlatform && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white text-center">
            Choose Your Platform
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card 
                  className={`p-6 cursor-pointer transition-all duration-300 relative ${
                    platform.supported 
                      ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700' 
                      : 'bg-gray-900/30 border-gray-800/50 opacity-60'
                  }`}
                  onClick={() => platform.supported && handlePlatformSelect(platform.id)}
                >
                  {!platform.supported && (
                    <div className="absolute top-4 right-4">
                      <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                        Coming Soon
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {/* Platform Header */}
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 bg-gradient-to-r ${platform.color} rounded-lg flex items-center justify-center text-2xl`}>
                        {platform.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {platform.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {platform.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Features */}
                    <div className="space-y-2">
                      {platform.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-gray-400">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Login Required Badge */}
                    {platform.loginRequired && platform.supported && (
                      <div className="flex items-center space-x-2 text-xs">
                        <Lock className="w-3 h-3 text-blue-400" />
                        <span className="text-blue-400">Login required</span>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Skip Option */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center"
          >
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-gray-400 hover:text-white"
            >
              Skip for now - I'll import later
            </Button>
          </motion.div>
        </div>
      )}

      {/* Login Form */}
      {selectedPlatform && importStatus === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md mx-auto"
        >
          <Card className="p-6 bg-gray-900/50 border-gray-800">
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Connect to {platforms.find(p => p.id === selectedPlatform)?.name}
                </h3>
                <p className="text-sm text-gray-400">
                  We'll securely connect to import your league data
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username or Email
                  </label>
                  <Input
                    type="text"
                    value={loginCredentials.username}
                    onChange={(e) => setLoginCredentials(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                    icon={<Users className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={loginCredentials.password}
                    onChange={(e) => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter your password"
                    icon={<Lock className="w-4 h-4" />}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleImport}
                  disabled={!loginCredentials.username || !loginCredentials.password || isImporting}
                  className="w-full"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import Leagues
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setSelectedPlatform(null)}
                  className="w-full"
                >
                  Choose Different Platform
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                <Lock className="w-3 h-3 inline mr-1" />
                Your credentials are encrypted and never stored
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Import Status */}
      {importStatus !== 'idle' && importStatus !== 'success' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Card className="p-8 bg-gray-900/50 border-gray-800 max-w-md mx-auto">
            <div className="space-y-4">
              <div className="flex justify-center">
                {getStatusIcon()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {getStatusMessage()}
                </h3>
                <p className="text-sm text-gray-400">
                  This may take a few moments...
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default LeagueImportStep