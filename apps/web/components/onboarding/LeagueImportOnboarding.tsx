'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const platforms = [
  {
    id: 'yahoo',
    name: 'Yahoo Fantasy',
    description: 'Import from Yahoo Fantasy Sports',
    color: 'from-purple-600 to-purple-700',
    icon: '🟣',
    authType: 'oauth',
  },
  {
    id: 'espn',
    name: 'ESPN Fantasy',
    description: 'Import from ESPN Fantasy',
    color: 'from-red-600 to-red-700',
    icon: '🔴',
    authType: 'cookie',
  },
  {
    id: 'sleeper',
    name: 'Sleeper',
    description: 'Import from Sleeper App',
    color: 'from-blue-600 to-blue-700',
    icon: '🔵',
    authType: 'username',
  },
  {
    id: 'cbs',
    name: 'CBS Fantasy',
    description: 'Import from CBS Sports',
    color: 'from-green-600 to-green-700',
    icon: '🟢',
    authType: 'api',
  },
  {
    id: 'draftkings',
    name: 'DraftKings',
    description: 'Import DFS lineups',
    color: 'from-gray-600 to-gray-700',
    icon: '⚫',
    authType: 'oauth',
  },
  {
    id: 'fanduel',
    name: 'FanDuel',
    description: 'Import FanDuel entries',
    color: 'from-blue-800 to-blue-900',
    icon: '🔷',
    authType: 'oauth',
  },
]

interface LeagueImportOnboardingProps {
  onComplete?: () => void
  skipUrl?: string
}

export function LeagueImportOnboarding({ onComplete, skipUrl = '/dashboard' }: LeagueImportOnboardingProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId)
  }

  const handleImport = async () => {
    if (!selectedPlatform) return
    
    setImporting(true)
    // Redirect to the import page with the selected platform
    window.location.href = `/import-league?platform=${selectedPlatform}&onboarding=true`
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
              1
            </div>
            <div className="w-16 h-1 bg-primary-500"></div>
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-medium">
              2
            </div>
            <div className="w-16 h-1 bg-gray-700"></div>
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-medium">
              3
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to <span className="gradient-text">Fantasy AI</span>
          </h1>
          <p className="text-xl text-gray-400">
            Let's import your fantasy leagues to unlock AI-powered insights
          </p>
        </div>

        {/* Platform Selection */}
        <div className="glass-card p-8 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Select Your Fantasy Platform
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handlePlatformSelect(platform.id)}
                className={`league-import-card relative overflow-hidden ${
                  selectedPlatform === platform.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${platform.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="text-3xl mb-3">{platform.icon}</div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {platform.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {platform.description}
                  </p>
                  
                  {/* Auth type badge */}
                  <div className="mt-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                      {platform.authType === 'oauth' && '🔐 OAuth'}
                      {platform.authType === 'cookie' && '🍪 Cookie'}
                      {platform.authType === 'username' && '👤 Username'}
                      {platform.authType === 'api' && '🔑 API Key'}
                    </span>
                  </div>
                </div>

                {/* Selected indicator */}
                {selectedPlatform === platform.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Import button */}
          <div className="mt-8 flex items-center justify-between">
            <Link href={skipUrl} className="text-gray-400 hover:text-white transition-colors">
              Skip for now
            </Link>
            
            <button
              onClick={handleImport}
              disabled={!selectedPlatform || importing}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {importing ? (
                <>
                  <div className="spinner w-5 h-5 mr-2"></div>
                  Redirecting...
                </>
              ) : (
                <>
                  Continue to Import
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Benefits */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Why Import Your Leagues?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start">
              <div className="text-2xl mr-3">🎯</div>
              <div>
                <h4 className="font-medium text-white mb-1">Pattern Detection</h4>
                <p className="text-sm text-gray-400">
                  65.2% accuracy patterns discovered from 48K+ games
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="text-2xl mr-3">💰</div>
              <div>
                <h4 className="font-medium text-white mb-1">Profit Insights</h4>
                <p className="text-sm text-gray-400">
                  $1.15M profit potential identified in betting patterns
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="text-2xl mr-3">🤖</div>
              <div>
                <h4 className="font-medium text-white mb-1">AI Assistant</h4>
                <p className="text-sm text-gray-400">
                  24/7 personalized advice for your specific leagues
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}