'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight } from 'lucide-react'
import { logger } from '../../lib/logging/logger';

const TestOnboardingPage = () => {
  const router = useRouter()

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding')
      const data = await response.json()
      
      logger.info('Onboarding status:', { data: data })
      alert(`Onboarding Status: ${data.status}`)
    } catch (error) {
      logger.error('Error checking onboarding:', { error: error })
      alert('Error checking onboarding status')
    }
  }

  const checkUserPreferences = async () => {
    try {
      const response = await fetch('/api/user/preferences')
      const data = await response.json()
      
      logger.info('User preferences:', { data: data })
      alert(`User Preferences loaded: ${JSON.stringify(data.data, null, 2)}`)
    } catch (error) {
      logger.error('Error checking preferences:', { error: error })
      alert('Error checking user preferences')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Sparkles className="w-8 h-8 text-primary-400" />
            <h1 className="text-3xl font-bold text-white">Onboarding Test</h1>
          </div>
          <p className="text-gray-300">
            Test the comprehensive onboarding flow and API endpoints
          </p>
        </div>

        {/* Actions */}
        <Card className="p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white">Test Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => router.push('/onboarding')}
              className="flex items-center justify-center space-x-2 h-12"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              onClick={checkOnboardingStatus}
              className="h-12"
            >
              Check Onboarding Status
            </Button>
            
            <Button
              variant="outline"
              onClick={checkUserPreferences}
              className="h-12"
            >
              Check User Preferences
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard')}
              className="h-12"
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>

        {/* Features Overview */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Onboarding Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h3 className="font-medium text-green-400">✅ Completed Features</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Multi-step wizard with animations</li>
                <li>• Platform choice (DFS/Traditional/Both)</li>
                <li>• Experience level selection</li>
                <li>• Sports & team preferences</li>
                <li>• Risk & bankroll management</li>
                <li>• Interactive feature tour</li>
                <li>• Notification preferences</li>
                <li>• Account setup completion</li>
                <li>• API routes for data persistence</li>
                <li>• Progress tracking & validation</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-blue-400">🔧 Technical Features</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Framer Motion animations</li>
                <li>• Step validation & progress</li>
                <li>• Responsive design</li>
                <li>• Beautiful gradients & effects</li>
                <li>• Cookie-based state persistence</li>
                <li>• Error handling & recovery</li>
                <li>• TypeScript support</li>
                <li>• Tailwind CSS styling</li>
                <li>• Toast notifications</li>
                <li>• Mobile-friendly interface</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* API Endpoints */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">API Endpoints</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">POST</span>
              <code className="text-gray-300">/api/onboarding</code>
              <span className="text-gray-400">- Save onboarding data</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">GET</span>
              <code className="text-gray-300">/api/onboarding</code>
              <span className="text-gray-400">- Check completion status</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">POST</span>
              <code className="text-gray-300">/api/user/preferences</code>
              <span className="text-gray-400">- Save user preferences</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">GET</span>
              <code className="text-gray-300">/api/user/preferences</code>
              <span className="text-gray-400">- Get user preferences</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">PATCH</span>
              <code className="text-gray-300">/api/user/preferences</code>
              <span className="text-gray-400">- Update preferences</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default TestOnboardingPage