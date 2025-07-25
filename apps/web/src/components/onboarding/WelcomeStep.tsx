'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { 
  TrendingUp, 
  Trophy, 
  Target, 
  BarChart3, 
  Sparkles,
  Zap,
  Shield,
  Brain
} from 'lucide-react'

interface WelcomeStepProps {
  data: any
  updateData: (updates: any) => void
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ data, updateData }) => {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Predictions',
      description: '96.97% NFL accuracy with ML models trained on 4.3M+ records',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: TrendingUp,
      title: 'DFS Trading Terminal',
      description: 'Bloomberg-quality interface with real-time optimization',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Trophy,
      title: 'Traditional Fantasy',
      description: 'Draft analysis, keeper decisions, and championship strategies',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      icon: Shield,
      title: 'Bankroll Management',
      description: 'Kelly Criterion, risk management, and portfolio optimization',
      gradient: 'from-green-500 to-emerald-500'
    }
  ]

  return (
    <div className="text-center space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-4"
      >
        <div className="relative inline-block">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full blur-xl opacity-30"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <Sparkles className="relative w-20 h-20 text-primary-400 mx-auto" />
        </div>
        
        <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-primary-200 to-purple-200 bg-clip-text text-transparent">
          Welcome to Fantasy AI
        </h1>
        
        <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          The most advanced fantasy sports platform with enterprise-grade AI, 
          professional trading tools, and championship-winning strategies.
        </p>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12"
      >
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card className="p-6 bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all duration-300 h-full">
                <div className="space-y-4">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-lg blur-xl opacity-20`} />
                    <div className={`relative w-12 h-12 bg-gradient-to-r ${feature.gradient} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Stats Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-12"
      >
        <Card className="p-8 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'ML Accuracy', value: '96.97%', icon: Target },
              { label: 'Training Records', value: '4.3M+', icon: BarChart3 },
              { label: 'Supported Sports', value: '4+', icon: Trophy },
              { label: 'Active Features', value: '50+', icon: Zap }
            ].map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                  className="text-center"
                >
                  <Icon className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-400">
                    {stat.label}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </Card>
      </motion.div>

      {/* Call to Action */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="text-center space-y-4 mt-12"
      >
        <h2 className="text-2xl font-semibold text-white">
          Let's personalize your experience
        </h2>
        <p className="text-gray-400">
          We'll set up your account in just a few steps to match your fantasy sports goals.
        </p>
      </motion.div>
    </div>
  )
}

export default WelcomeStep