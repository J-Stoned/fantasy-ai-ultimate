'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Sparkles,
  TrendingUp,
  Trophy,
  Target,
  BarChart3,
  Shield,
  DollarSign,
  Users,
  Star,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Heart,
} from 'lucide-react'

// Step Components
import WelcomeStep from '@/components/onboarding/WelcomeStep'
import PlatformChoiceStep from '@/components/onboarding/PlatformChoiceStep'
import SportsPreferencesStep from '@/components/onboarding/SportsPreferencesStep'
import PlayerFollowingStep from '@/components/onboarding/PlayerFollowingStep'
import RiskBudgetStep from '@/components/onboarding/RiskBudgetStep'
import LeagueImportStep from '@/components/onboarding/LeagueImportStep'
import FeatureTourStep from '@/components/onboarding/FeatureTourStep'
import AccountSetupStep from '@/components/onboarding/AccountSetupStep'
import { logger } from '../../lib/logging/logger';

interface OnboardingData {
  // Platform Choice
  platform: 'dfs' | 'traditional' | 'both' | null
  experienceLevel: 'beginner' | 'intermediate' | 'expert' | null
  
  // Sports Preferences
  selectedSports: string[]
  favoriteTeams: { [sport: string]: string[] }
  playerPreferences: {
    riskTolerance: 'conservative' | 'moderate' | 'aggressive'
    playStyle: 'cash-games' | 'tournaments' | 'mixed'
  }
  
  // Player Following
  followingPlayers: string[]
  
  // Risk & Budget
  initialBankroll: number
  riskTolerance: 'low' | 'medium' | 'high'
  contestPreferences: string[]
  maxSingleEntry: number
  
  // League Import
  importedLeagues: any[]
  importPlatform: string | null
  skippedImport: boolean
  
  // Account Setup
  profile: {
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
    autoOptimize: boolean
    dataSharing: boolean
  }
}

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'platform', title: 'Platform Choice', icon: Target },
  { id: 'sports', title: 'Sports & Teams', icon: Trophy },
  { id: 'players', title: 'Follow Players', icon: Heart },
  { id: 'budget', title: 'Risk & Budget', icon: DollarSign },
  { id: 'import', title: 'Import Leagues', icon: Download },
  { id: 'tour', title: 'Feature Tour', icon: BarChart3 },
  { id: 'account', title: 'Account Setup', icon: Shield },
]

const OnboardingPage = () => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    platform: null,
    experienceLevel: null,
    selectedSports: [],
    favoriteTeams: {},
    playerPreferences: {
      riskTolerance: 'moderate',
      playStyle: 'mixed'
    },
    followingPlayers: [],
    initialBankroll: 100,
    riskTolerance: 'medium',
    contestPreferences: [],
    maxSingleEntry: 20,
    importedLeagues: [],
    importPlatform: null,
    skippedImport: false,
    profile: {
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      autoOptimize: true,
      dataSharing: false
    }
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [startTime] = useState(Date.now())
  const [stepHistory, setStepHistory] = useState<string[]>([])

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setStepHistory(prev => [...prev, STEPS[currentStep].id])
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Welcome
        return true
      case 1: // Platform Choice
        return data.platform !== null && data.experienceLevel !== null
      case 2: // Sports Preferences
        return data.selectedSports.length > 0
      case 3: // Player Following
        return true // Optional step
      case 4: // Risk & Budget
        return data.initialBankroll > 0 && data.contestPreferences.length > 0
      case 5: // League Import
        return true // Optional step
      case 6: // Feature Tour
        return true
      case 7: // Account Setup
        return true
      default:
        return false
    }
  }

  const completeOnboarding = async () => {
    setIsLoading(true)
    try {
      // Save user preferences first
      await fetch('/api/onboarding/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sports: data.selectedSports,
          favoriteTeams: data.favoriteTeams,
          followingPlayers: data.followingPlayers,
          platform: data.platform,
          experienceLevel: data.experienceLevel,
          riskTolerance: data.riskTolerance,
          playerPreferences: data.playerPreferences,
          notifications: data.profile.notifications,
          autoOptimize: data.profile.autoOptimize,
          importedLeagues: data.importedLeagues,
          importPlatform: data.importPlatform,
        }),
      })

      // Complete onboarding with full data
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          completionTime: Date.now() - startTime,
          stepsCompleted: STEPS.length,
          userJourney: stepHistory
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to complete onboarding')
      }

      const result = await response.json()
      toast.success(result.message)
      
      // Redirect based on platform choice
      switch (data.platform) {
        case 'dfs':
          router.push('/dfs')
          break
        case 'traditional':
          router.push('/dashboard')
          break
        case 'both':
          router.push('/dashboard')
          break
        default:
          router.push('/dashboard')
      }
    } catch (error) {
      logger.error('Onboarding error:', { error: error })
      toast.error('Failed to complete onboarding. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep data={data} updateData={updateData} />
      case 1:
        return <PlatformChoiceStep data={data} updateData={updateData} />
      case 2:
        return <SportsPreferencesStep data={data} updateData={updateData} />
      case 3:
        return <PlayerFollowingStep data={data} updateData={updateData} />
      case 4:
        return <RiskBudgetStep data={data} updateData={updateData} />
      case 5:
        return <LeagueImportStep data={data} updateData={updateData} />
      case 6:
        return <FeatureTourStep data={data} updateData={updateData} />
      case 7:
        return <AccountSetupStep data={data} updateData={updateData} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-8 h-8 text-primary-400" />
                <span className="text-xl font-bold text-white">Fantasy AI</span>
              </div>
              <div className="text-sm text-gray-400">
                Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {Math.round(progress)}% Complete
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-center mt-6 space-x-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isComplete = index < currentStep
              const isCurrent = index === currentStep
              
              return (
                <motion.div
                  key={step.id}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                    isComplete
                      ? 'bg-green-500/20 text-green-400'
                      : isCurrent
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {isComplete ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={completeOnboarding}
              loading={isLoading}
              className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700"
            >
              <Sparkles className="w-4 h-4" />
              <span>Complete Setup</span>
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!validateCurrentStep()}
              className="flex items-center space-x-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  )
}

export default OnboardingPage