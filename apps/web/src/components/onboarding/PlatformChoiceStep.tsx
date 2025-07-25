'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  Trophy, 
  Target,
  Users,
  BarChart3,
  Zap,
  Star,
  CheckCircle
} from 'lucide-react'

interface PlatformChoiceStepProps {
  data: any
  updateData: (updates: any) => void
}

const PlatformChoiceStep: React.FC<PlatformChoiceStepProps> = ({ data, updateData }) => {
  const platforms = [
    {
      id: 'dfs',
      title: 'DFS Trading',
      subtitle: 'Daily Fantasy Sports',
      description: 'Professional trading terminal with real-time optimization, bankroll management, and AI-powered projections.',
      features: [
        'Bloomberg-quality trading interface',
        'Real-time lineup optimization',
        'Kelly Criterion bankroll management',
        'Ownership leverage analysis',
        'Live portfolio tracking'
      ],
      icon: TrendingUp,
      gradient: 'from-blue-500 to-cyan-500',
      best: 'Best for active traders'
    },
    {
      id: 'traditional',
      title: 'Traditional Fantasy',
      subtitle: 'Season-Long Leagues',
      description: 'Draft analysis, trade recommendations, keeper decisions, and championship window planning.',
      features: [
        'Draft board with live analysis',
        'Trade impact calculator',
        'Keeper value projections',
        'Championship window optimizer',
        'League memory insights'
      ],
      icon: Trophy,
      gradient: 'from-yellow-500 to-orange-500',
      best: 'Best for season-long strategy'
    },
    {
      id: 'both',
      title: 'Complete Platform',
      subtitle: 'DFS + Traditional',
      description: 'Full access to both DFS trading tools and traditional fantasy features for maximum flexibility.',
      features: [
        'All DFS trading features',
        'All traditional fantasy tools',
        'Cross-platform insights',
        'Unified player database',
        'Advanced portfolio management'
      ],
      icon: Target,
      gradient: 'from-purple-500 to-pink-500',
      best: 'Best value - everything included',
      popular: true
    }
  ]

  const experienceLevels = [
    {
      id: 'beginner',
      title: 'Beginner',
      description: 'New to fantasy sports or looking to learn advanced strategies',
      icon: Users,
      features: ['Guided tutorials', 'Basic strategies', 'Simple interface']
    },
    {
      id: 'intermediate',
      title: 'Intermediate',
      description: 'Some fantasy experience, ready for advanced tools',
      icon: BarChart3,
      features: ['Advanced analytics', 'Strategy guides', 'Moderate complexity']
    },
    {
      id: 'expert',
      title: 'Expert',
      description: 'Experienced player seeking professional-grade tools',
      icon: Zap,
      features: ['Full feature access', 'Advanced algorithms', 'Professional tools']
    }
  ]

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
          Choose Your Fantasy Platform
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Select the platform that matches your fantasy sports goals and playing style.
        </p>
      </motion.div>

      {/* Platform Selection */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white text-center">
          Platform Type
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {platforms.map((platform, index) => {
            const Icon = platform.icon
            const isSelected = data.platform === platform.id
            
            return (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="relative"
              >
                {platform.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>Most Popular</span>
                    </div>
                  </div>
                )}
                
                <Card 
                  className={`p-6 cursor-pointer transition-all duration-300 h-full ${
                    isSelected 
                      ? 'bg-gray-800 border-primary-500 shadow-lg shadow-primary-500/20' 
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                  }`}
                  onClick={() => updateData({ platform: platform.id })}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 bg-gradient-to-r ${platform.gradient} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-primary-400" />
                      )}
                    </div>
                    
                    {/* Title */}
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {platform.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {platform.subtitle}
                      </p>
                      <p className={`text-xs font-medium bg-gradient-to-r ${platform.gradient} bg-clip-text text-transparent mt-1`}>
                        {platform.best}
                      </p>
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {platform.description}
                    </p>
                    
                    {/* Features */}
                    <div className="space-y-2">
                      {platform.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-gray-400">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Experience Level */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white text-center">
          Experience Level
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {experienceLevels.map((level, index) => {
            const Icon = level.icon
            const isSelected = data.experienceLevel === level.id
            
            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card 
                  className={`p-6 cursor-pointer transition-all duration-300 h-full ${
                    isSelected 
                      ? 'bg-gray-800 border-primary-500 shadow-lg shadow-primary-500/20' 
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                  }`}
                  onClick={() => updateData({ experienceLevel: level.id })}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary-400" />
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-primary-400" />
                      )}
                    </div>
                    
                    {/* Title */}
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {level.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed mt-1">
                        {level.description}
                      </p>
                    </div>
                    
                    {/* Features */}
                    <div className="space-y-1">
                      {level.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center space-x-2 text-sm">
                          <div className="w-1 h-1 bg-primary-400 rounded-full" />
                          <span className="text-gray-400">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PlatformChoiceStep