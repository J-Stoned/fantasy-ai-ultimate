'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  DollarSign,
  TrendingUp,
  Shield,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Trophy
} from 'lucide-react'

interface RiskBudgetStepProps {
  data: any
  updateData: (updates: any) => void
}

const RiskBudgetStep: React.FC<RiskBudgetStepProps> = ({ data, updateData }) => {
  const [customBankroll, setCustomBankroll] = useState('')

  const bankrollOptions = [
    { value: 50, label: '$50', description: 'Small starter bankroll' },
    { value: 100, label: '$100', description: 'Recommended minimum' },
    { value: 250, label: '$250', description: 'Good starting amount' },
    { value: 500, label: '$500', description: 'Comfortable bankroll' },
    { value: 1000, label: '$1,000', description: 'Solid foundation' },
    { value: 0, label: 'Custom', description: 'Enter your amount' }
  ]

  const riskLevels = [
    {
      id: 'low',
      title: 'Conservative',
      description: 'Protect your bankroll with low-risk strategies',
      icon: Shield,
      color: 'from-green-500 to-emerald-500',
      features: [
        'Maximum 2% per contest',
        'Focus on cash games',
        'High floor players',
        'Steady growth approach'
      ],
      kellyMultiplier: 0.25
    },
    {
      id: 'medium',
      title: 'Balanced',
      description: 'Mix of safety and growth opportunities',
      icon: Target,
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Maximum 5% per contest',
        'Mix of cash and GPPs',
        'Balanced player selection',
        'Moderate growth targets'
      ],
      kellyMultiplier: 0.5
    },
    {
      id: 'high',
      title: 'Aggressive',
      description: 'Higher risk for maximum growth potential',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500',
      features: [
        'Maximum 10% per contest',
        'Tournament focused',
        'High upside plays',
        'Aggressive growth strategy'
      ],
      kellyMultiplier: 1.0
    }
  ]

  const contestTypes = [
    {
      id: 'head-to-head',
      name: 'Head-to-Head',
      description: '1-on-1 contests with 50% win rate',
      icon: Target,
      minBankroll: 20,
      recommended: true
    },
    {
      id: 'double-ups',
      name: 'Double-Ups',
      description: 'Finish in top half to double your money',
      icon: TrendingUp,
      minBankroll: 25,
      recommended: true
    },
    {
      id: '50-50s',
      name: '50/50s',
      description: 'Top 50% of field gets paid',
      icon: Shield,
      minBankroll: 30,
      recommended: true
    },
    {
      id: 'small-gpps',
      name: 'Small GPPs',
      description: 'Tournaments with smaller fields',
      icon: Trophy,
      minBankroll: 100,
      recommended: false
    },
    {
      id: 'large-gpps',
      name: 'Large GPPs',
      description: 'Big tournaments with massive payouts',
      icon: BarChart3,
      minBankroll: 200,
      recommended: false
    }
  ]

  const handleBankrollChange = (value: number) => {
    if (value === 0) {
      // Custom option selected
      updateData({ initialBankroll: 0 })
    } else {
      updateData({ initialBankroll: value })
      setCustomBankroll('')
    }
  }

  const handleCustomBankrollChange = (value: string) => {
    setCustomBankroll(value)
    const numValue = parseFloat(value) || 0
    updateData({ initialBankroll: numValue })
  }

  const toggleContestType = (contestId: string) => {
    const current = data.contestPreferences || []
    const updated = current.includes(contestId)
      ? current.filter((id: string) => id !== contestId)
      : [...current, contestId]
    
    updateData({ contestPreferences: updated })
  }

  const calculateRecommendedEntry = () => {
    const bankroll = data.initialBankroll || 100
    const riskLevel = data.riskTolerance || 'medium'
    const multipliers = { low: 0.02, medium: 0.05, high: 0.1 }
    return Math.round(bankroll * multipliers[riskLevel as keyof typeof multipliers])
  }

  const getAffordableContests = () => {
    const bankroll = data.initialBankroll || 100
    return contestTypes.filter(contest => bankroll >= contest.minBankroll)
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
          Bankroll & Risk Management
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Set up your budget and risk preferences for optimal bankroll management using Kelly Criterion principles.
        </p>
      </motion.div>

      {/* Bankroll Setup */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          Initial Bankroll
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {bankrollOptions.map((option, index) => {
            const isSelected = option.value === 0 
              ? data.initialBankroll > 0 && !bankrollOptions.some(opt => opt.value === data.initialBankroll && opt.value !== 0)
              : data.initialBankroll === option.value
            
            return (
              <motion.div
                key={option.value}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? 'bg-gray-800 border-primary-500' 
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                  }`}
                  onClick={() => handleBankrollChange(option.value)}
                >
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-white">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-400">
                      {option.description}
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-primary-400 mx-auto" />
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Custom Bankroll Input */}
        {(data.initialBankroll === 0 || (data.initialBankroll > 0 && !bankrollOptions.some(opt => opt.value === data.initialBankroll && opt.value !== 0))) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="max-w-md mx-auto"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Enter your bankroll amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={customBankroll}
                  onChange={(e) => handleCustomBankrollChange(e.target.value)}
                  className="pl-10"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Risk Tolerance */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          Risk Tolerance
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {riskLevels.map((level, index) => {
            const Icon = level.icon
            const isSelected = data.riskTolerance === level.id
            
            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card 
                  className={`p-6 cursor-pointer transition-all duration-300 h-full ${
                    isSelected 
                      ? 'bg-gray-800 border-primary-500 shadow-lg shadow-primary-500/20' 
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                  }`}
                  onClick={() => updateData({ riskTolerance: level.id })}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 bg-gradient-to-r ${level.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-primary-400" />
                      )}
                    </div>
                    
                    {/* Title */}
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {level.title}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {level.description}
                      </p>
                    </div>
                    
                    {/* Features */}
                    <div className="space-y-2">
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

      {/* Contest Preferences */}
      {data.initialBankroll > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Contest Preferences
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contestTypes.map((contest, index) => {
              const Icon = contest.icon
              const isSelected = data.contestPreferences?.includes(contest.id)
              const isAffordable = data.initialBankroll >= contest.minBankroll
              const isRecommended = contest.recommended && isAffordable
              
              return (
                <motion.div
                  key={contest.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card 
                    className={`p-4 cursor-pointer transition-all duration-300 relative ${
                      !isAffordable
                        ? 'bg-gray-900/30 border-gray-700 opacity-50 cursor-not-allowed'
                        : isSelected 
                        ? 'bg-gray-800 border-primary-500' 
                        : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                    }`}
                    onClick={() => isAffordable && toggleContestType(contest.id)}
                  >
                    {isRecommended && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Recommended
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className={`w-5 h-5 ${isAffordable ? 'text-primary-400' : 'text-gray-500'}`} />
                          <div>
                            <h4 className={`font-medium ${isAffordable ? 'text-white' : 'text-gray-500'}`}>
                              {contest.name}
                            </h4>
                            <p className={`text-xs ${isAffordable ? 'text-gray-400' : 'text-gray-600'}`}>
                              Min: ${contest.minBankroll}
                            </p>
                          </div>
                        </div>
                        {isSelected && isAffordable && (
                          <CheckCircle className="w-5 h-5 text-primary-400" />
                        )}
                        {!isAffordable && (
                          <AlertTriangle className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      
                      <p className={`text-sm ${isAffordable ? 'text-gray-400' : 'text-gray-600'}`}>
                        {contest.description}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendations Summary */}
      {data.initialBankroll > 0 && data.riskTolerance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/20">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-primary-400" />
                <span>Your Bankroll Strategy</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-400">
                    ${data.initialBankroll}
                  </div>
                  <div className="text-sm text-gray-400">
                    Starting Bankroll
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    ${calculateRecommendedEntry()}
                  </div>
                  <div className="text-sm text-gray-400">
                    Max Entry Fee
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {getAffordableContests().length}
                  </div>
                  <div className="text-sm text-gray-400">
                    Available Contests
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-gray-300 text-sm">
                  Based on Kelly Criterion and your {data.riskTolerance} risk tolerance, 
                  we recommend a maximum entry of ${calculateRecommendedEntry()} per contest.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default RiskBudgetStep