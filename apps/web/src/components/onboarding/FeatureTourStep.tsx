'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { logger } from '../../lib/logging/logger';
import { 
  Brain,
  TrendingUp,
  Trophy,
  Shield,
  BarChart3,
  Target,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause
} from 'lucide-react'

interface FeatureTourStepProps {
  data: any
  updateData: (updates: any) => void
}

const FeatureTourStep: React.FC<FeatureTourStepProps> = ({ data, updateData }) => {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const features = [
    {
      id: 'ml-predictions',
      title: 'AI-Powered Predictions',
      subtitle: '96.97% NFL Accuracy',
      description: 'Our machine learning models analyze 4.3M+ training records to generate the most accurate player projections in the industry.',
      icon: Brain,
      gradient: 'from-purple-500 to-pink-500',
      image: '/features/ml-predictions.jpg',
      highlights: [
        'Real-time player projections updated every 15 minutes',
        'Weather, injury, and matchup factor integration',
        'Confidence intervals for risk assessment',
        'Historical accuracy tracking and model validation'
      ],
      demo: 'Watch how our AI processes thousands of data points to predict player performance'
    },
    {
      id: 'dfs-terminal',
      title: 'DFS Trading Terminal',
      subtitle: 'Bloomberg-Quality Interface',
      description: 'Professional-grade trading dashboard with real-time optimization, portfolio tracking, and advanced analytics.',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-cyan-500',
      image: '/features/dfs-terminal.jpg',
      highlights: [
        'Real-time lineup optimization across all major sites',
        'Portfolio allocation and risk management tools',
        'Live contest tracking with profit/loss analysis',
        'Advanced ownership and leverage calculations'
      ],
      demo: 'Experience the power of professional DFS trading tools'
    },
    {
      id: 'bankroll-management',
      title: 'Bankroll Management',
      subtitle: 'Kelly Criterion Optimization',
      description: 'Sophisticated bankroll management using mathematical principles to maximize long-term growth while minimizing risk.',
      icon: Shield,
      gradient: 'from-green-500 to-emerald-500',
      image: '/features/bankroll.jpg',
      highlights: [
        'Kelly Criterion sizing for optimal bet amounts',
        'Risk-adjusted portfolio allocation',
        'Drawdown protection and recovery strategies',
        'Performance tracking with detailed analytics'
      ],
      demo: 'See how mathematical bankroll management protects and grows your funds'
    },
    {
      id: 'traditional-fantasy',
      title: 'Traditional Fantasy Tools',
      subtitle: 'Championship Strategies',
      description: 'Complete suite of traditional fantasy tools including draft analysis, trade evaluation, and keeper recommendations.',
      icon: Trophy,
      gradient: 'from-yellow-500 to-orange-500',
      image: '/features/traditional.jpg',
      highlights: [
        'Live draft board with player rankings and analysis',
        'Trade analyzer with win-probability impacts',
        'Keeper value projections and recommendations',
        'Championship window optimization strategies'
      ],
      demo: 'Master traditional fantasy with championship-winning strategies'
    },
    {
      id: 'league-memory',
      title: 'League Memory AI',
      subtitle: 'Behavioral Analytics',
      description: 'Advanced AI that learns your league\'s patterns, tendencies, and behaviors to give you a competitive edge.',
      icon: Users,
      gradient: 'from-indigo-500 to-purple-500',
      image: '/features/league-memory.jpg',
      highlights: [
        'Manager behavior pattern recognition',
        'Trade tendency analysis and predictions',
        'Optimal draft strategies based on league history',
        'Psychological profiling for competitive advantage'
      ],
      demo: 'Discover how AI gives you the edge in competitive leagues'
    },
    {
      id: 'real-time-optimization',
      title: 'Real-Time Optimization',
      subtitle: 'Live Updates & Alerts',
      description: 'Continuous optimization with real-time updates for injuries, weather, line movements, and breaking news.',
      icon: Zap,
      gradient: 'from-red-500 to-pink-500',
      image: '/features/real-time.jpg',
      highlights: [
        'Instant lineup adjustments for breaking news',
        'Weather and game environment factor updates',
        'Line movement tracking and value identification',
        'Smart alerts for critical information changes'
      ],
      demo: 'Stay ahead with real-time information and automatic adjustments'
    }
  ]

  React.useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying, features.length])

  const nextFeature = () => {
    setCurrentFeature((prev) => (prev + 1) % features.length)
    setIsAutoPlaying(false)
  }

  const prevFeature = () => {
    setCurrentFeature((prev) => (prev - 1 + features.length) % features.length)
    setIsAutoPlaying(false)
  }

  const currentFeatureData = features[currentFeature]
  const Icon = currentFeatureData.icon

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
          Platform Features Tour
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Explore the powerful features that make Fantasy AI the most advanced fantasy sports platform.
        </p>
        
        {/* Auto-play controls */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="flex items-center space-x-2"
          >
            {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isAutoPlaying ? 'Pause Tour' : 'Resume Tour'}</span>
          </Button>
        </div>
      </motion.div>

      {/* Feature Navigation */}
      <div className="flex items-center justify-center space-x-2 overflow-x-auto pb-2">
        {features.map((feature, index) => {
          const FeatureIcon = feature.icon
          return (
            <button
              key={feature.id}
              onClick={() => {
                setCurrentFeature(index)
                setIsAutoPlaying(false)
              }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all duration-300 whitespace-nowrap ${
                index === currentFeature
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              <FeatureIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{feature.title}</span>
            </button>
          )
        })}
      </div>

      {/* Main Feature Display */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeature}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="p-8 bg-gradient-to-br from-gray-900/80 to-gray-900/40 border-gray-800">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Content */}
                <div className="space-y-6">
                  {/* Icon & Title */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 bg-gradient-to-r ${currentFeatureData.gradient} rounded-xl flex items-center justify-center`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-white">
                          {currentFeatureData.title}
                        </h2>
                        <p className={`text-lg bg-gradient-to-r ${currentFeatureData.gradient} bg-clip-text text-transparent font-medium`}>
                          {currentFeatureData.subtitle}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-gray-300 text-lg leading-relaxed">
                      {currentFeatureData.description}
                    </p>
                  </div>

                  {/* Key Highlights */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">
                      Key Features:
                    </h3>
                    <div className="space-y-2">
                      {currentFeatureData.highlights.map((highlight, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-start space-x-3"
                        >
                          <div className={`w-2 h-2 bg-gradient-to-r ${currentFeatureData.gradient} rounded-full mt-2 flex-shrink-0`} />
                          <span className="text-gray-300 text-sm leading-relaxed">
                            {highlight}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Demo Button */}
                  <Button 
                    className={`bg-gradient-to-r ${currentFeatureData.gradient} hover:opacity-90 text-white`}
                    onClick={() => {
                      // Could integrate with actual feature demos
                      logger.info('Demo for ${currentFeatureData.id}')
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {currentFeatureData.demo}
                  </Button>
                </div>

                {/* Visual Preview */}
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="relative"
                  >
                    {/* Placeholder for feature screenshot/animation */}
                    <div className={`aspect-video bg-gradient-to-br ${currentFeatureData.gradient} rounded-xl p-1`}>
                      <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <Icon className="w-20 h-20 text-gray-600 mx-auto" />
                          <div className="text-gray-400">
                            <div className="text-lg font-medium">Feature Preview</div>
                            <div className="text-sm">{currentFeatureData.title}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Decorative elements */}
                    <div className={`absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r ${currentFeatureData.gradient} rounded-full opacity-60 blur-sm`} />
                    <div className={`absolute -bottom-4 -left-4 w-12 h-12 bg-gradient-to-r ${currentFeatureData.gradient} rounded-full opacity-40 blur-md`} />
                  </motion.div>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevFeature}
            className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <Button
            variant="ghost"
            size="icon"
            onClick={nextFeature}
            className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-2">
        {features.map((_, index) => (
          <motion.div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentFeature 
                ? 'w-8 bg-primary-500' 
                : 'w-2 bg-gray-600'
            }`}
            onClick={() => {
              setCurrentFeature(index)
              setIsAutoPlaying(false)
            }}
          />
        ))}
      </div>

      {/* Platform-Specific Features */}
      {data.platform && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="p-6 bg-primary-500/10 border-primary-500/20">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold text-white">
                Your Platform Focus
              </h3>
              <p className="text-gray-300">
                {data.platform === 'dfs' && "You'll have access to our complete DFS trading suite with advanced portfolio management."}
                {data.platform === 'traditional' && "You'll get our full traditional fantasy toolkit with championship planning features."}
                {data.platform === 'both' && "You'll have access to all features across both DFS and traditional fantasy platforms."}
              </p>
              
              {data.selectedSports && data.selectedSports.length > 0 && (
                <div className="flex items-center justify-center space-x-2 mt-4">
                  <span className="text-sm text-gray-400">Optimized for:</span>
                  {data.selectedSports.map((sport: string) => (
                    <span key={sport} className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium">
                      {sport.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default FeatureTourStep