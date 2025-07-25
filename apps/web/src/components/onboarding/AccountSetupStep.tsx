'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Bell,
  Smartphone,
  Mail,
  MessageSquare,
  Zap,
  Shield,
  Share2,
  CheckCircle,
  Settings,
  User,
  Sparkles
} from 'lucide-react'

interface AccountSetupStepProps {
  data: any
  updateData: (updates: any) => void
}

const AccountSetupStep: React.FC<AccountSetupStepProps> = ({ data, updateData }) => {
  const updateNotificationPreference = (type: string, value: boolean) => {
    updateData({
      profile: {
        ...data.profile,
        notifications: {
          ...data.profile.notifications,
          [type]: value
        }
      }
    })
  }

  const updateProfileSetting = (key: string, value: boolean) => {
    updateData({
      profile: {
        ...data.profile,
        [key]: value
      }
    })
  }

  const notificationTypes = [
    {
      id: 'email',
      title: 'Email Notifications',
      description: 'Lineup recommendations, breaking news, and performance reports',
      icon: Mail,
      color: 'from-blue-500 to-cyan-500',
      examples: [
        'Daily lineup recommendations',
        'Breaking injury news',
        'Weekly performance reports',
        'New feature announcements'
      ]
    },
    {
      id: 'push',
      title: 'Push Notifications',
      description: 'Real-time alerts for critical updates and opportunities',
      icon: Bell,
      color: 'from-green-500 to-emerald-500',
      examples: [
        'Last-minute lineup changes',
        'Weather alerts affecting games',
        'High-value player opportunities',
        'Contest entry deadlines'
      ]
    },
    {
      id: 'sms',
      title: 'SMS Alerts',
      description: 'Critical alerts for time-sensitive information',
      icon: MessageSquare,
      color: 'from-orange-500 to-red-500',
      examples: [
        'Player ruled out last minute',
        'Extreme weather conditions',
        'Line movement opportunities',
        'Contest lock alerts'
      ]
    }
  ]

  const advancedSettings = [
    {
      id: 'autoOptimize',
      title: 'Auto-Optimization',
      description: 'Automatically update lineups based on breaking news and player updates',
      icon: Zap,
      color: 'from-purple-500 to-pink-500',
      benefits: [
        'Never miss injury updates',
        'Automatic weather adjustments',
        'Real-time ownership optimization',
        'Smart stack recommendations'
      ]
    },
    {
      id: 'dataSharing',
      title: 'Anonymous Data Sharing',
      description: 'Help improve our models by sharing anonymized usage data',
      icon: Share2,
      color: 'from-indigo-500 to-blue-500',
      benefits: [
        'Improve prediction accuracy',
        'Better contest recommendations',
        'Enhanced feature development',
        'Community insights'
      ]
    }
  ]

  const getSummaryData = () => {
    const summary = {
      platform: data.platform || 'both',
      experience: data.experienceLevel || 'intermediate',
      sports: data.selectedSports?.length || 0,
      bankroll: data.initialBankroll || 100,
      risk: data.riskTolerance || 'medium',
      contests: data.contestPreferences?.length || 0
    }
    
    return summary
  }

  const summary = getSummaryData()

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-4"
      >
        <div className="relative inline-block">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full blur-xl opacity-30"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <Sparkles className="relative w-16 h-16 text-primary-400 mx-auto" />
        </div>
        
        <h1 className="text-4xl font-bold text-white">
          Complete Your Setup
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Configure your notification preferences and account settings to get the most out of Fantasy AI.
        </p>
      </motion.div>

      {/* Setup Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Card className="p-6 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/20">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <Settings className="w-5 h-5 text-primary-400" />
              <span>Your Configuration</span>
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-lg font-bold text-white capitalize">
                  {summary.platform === 'both' ? 'Complete Platform' : summary.platform}
                </div>
                <div className="text-sm text-gray-400">Platform Choice</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-primary-400 capitalize">
                  {summary.experience}
                </div>
                <div className="text-sm text-gray-400">Experience Level</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">
                  {summary.sports} Sports
                </div>
                <div className="text-sm text-gray-400">Selected Sports</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400">
                  ${summary.bankroll}
                </div>
                <div className="text-sm text-gray-400">Starting Bankroll</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-orange-400 capitalize">
                  {summary.risk} Risk
                </div>
                <div className="text-sm text-gray-400">Risk Tolerance</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400">
                  {summary.contests} Types
                </div>
                <div className="text-sm text-gray-400">Contest Preferences</div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Notification Preferences */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          Notification Preferences
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {notificationTypes.map((notification, index) => {
            const Icon = notification.icon
            const isEnabled = data.profile?.notifications?.[notification.id]
            
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card className="p-6 h-full">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 bg-gradient-to-r ${notification.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <Button
                        variant={isEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateNotificationPreference(notification.id, !isEnabled)}
                        className="flex items-center space-x-2"
                      >
                        {isEnabled ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Enabled</span>
                          </>
                        ) : (
                          <span>Enable</span>
                        )}
                      </Button>
                    </div>
                    
                    {/* Content */}
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {notification.title}
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">
                        {notification.description}
                      </p>
                    </div>
                    
                    {/* Examples */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300">Examples:</h4>
                      <div className="space-y-1">
                        {notification.examples.map((example, exampleIndex) => (
                          <div key={exampleIndex} className="flex items-center space-x-2 text-xs">
                            <div className="w-1 h-1 bg-primary-400 rounded-full" />
                            <span className="text-gray-400">{example}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">
          Advanced Features
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {advancedSettings.map((setting, index) => {
            const Icon = setting.icon
            const isEnabled = data.profile?.[setting.id]
            
            return (
              <motion.div
                key={setting.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Card className="p-6 h-full">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-r ${setting.color} rounded-lg flex items-center justify-center`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {setting.title}
                          </h3>
                        </div>
                      </div>
                      <Button
                        variant={isEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateProfileSetting(setting.id, !isEnabled)}
                        className="flex items-center space-x-2"
                      >
                        {isEnabled ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>On</span>
                          </>
                        ) : (
                          <span>Off</span>
                        )}
                      </Button>
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-400 text-sm">
                      {setting.description}
                    </p>
                    
                    {/* Benefits */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300">Benefits:</h4>
                      <div className="space-y-1">
                        {setting.benefits.map((benefit, benefitIndex) => (
                          <div key={benefitIndex} className="flex items-center space-x-2 text-xs">
                            <div className="w-1 h-1 bg-green-400 rounded-full" />
                            <span className="text-gray-400">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Final Call to Action */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="text-center space-y-6"
      >
        <Card className="p-8 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border-gray-800">
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white">
                You're All Set! 🚀
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Your Fantasy AI account is configured and ready to help you dominate your leagues. 
                Let's start building winning lineups and championship strategies.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white">Profile Complete</h3>
                <p className="text-sm text-gray-400">All preferences configured</p>
              </div>
              
              <div className="space-y-2">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white">AI Activated</h3>
                <p className="text-sm text-gray-400">ML models ready to work</p>
              </div>
              
              <div className="space-y-2">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white">Ready to Win</h3>
                <p className="text-sm text-gray-400">Your competitive edge awaits</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

export default AccountSetupStep