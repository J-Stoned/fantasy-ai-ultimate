'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const platforms = [
  {
    id: 'yahoo',
    name: 'Yahoo Fantasy',
    color: 'from-purple-600 to-purple-700',
    description: 'Import from Yahoo Fantasy Sports',
    supported: true,
  },
  {
    id: 'espn',
    name: 'ESPN Fantasy',
    color: 'from-red-600 to-red-700',
    description: 'Import from ESPN Fantasy',
    supported: true,
  },
  {
    id: 'sleeper',
    name: 'Sleeper',
    color: 'from-orange-600 to-orange-700',
    description: 'Import from Sleeper app',
    supported: true,
  },
  {
    id: 'draftkings',
    name: 'DraftKings',
    color: 'from-green-600 to-green-700',
    description: 'Import DFS and season-long leagues',
    supported: true,
  },
  {
    id: 'fanduel',
    name: 'FanDuel',
    color: 'from-blue-600 to-blue-700',
    description: 'Import FanDuel leagues',
    supported: true,
  },
  {
    id: 'cbs',
    name: 'CBS Sports',
    color: 'from-gray-600 to-gray-700',
    description: 'Import from CBS Fantasy',
    supported: true,
  },
]

export default function ImportLeaguePage() {
  const searchParams = useSearchParams()
  const platformParam = searchParams.get('platform')
  const isOnboarding = searchParams.get('onboarding') === 'true'
  const isConnected = searchParams.get('connected') === 'true'
  const errorParam = searchParams.get('error')
  const method = searchParams.get('method')
  const urlParam = searchParams.get('url')
  
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(platformParam)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [showPasteImport, setShowPasteImport] = useState(true)
  const [pasteUrl, setPasteUrl] = useState(urlParam || '')
  const router = useRouter()
  
  useEffect(() => {
    if (platformParam) {
      setSelectedPlatform(platformParam)
      setShowPasteImport(false)
    }
    
    // Auto-import if URL is provided
    if (urlParam) {
      setPasteUrl(urlParam)
      setTimeout(() => handlePasteImport(), 500)
    }
    
    // Handle OAuth callback
    if (isConnected && platformParam === 'yahoo') {
      // Automatically start Yahoo import
      performYahooImport()
    }
    
    // Handle errors
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        yahoo_auth_failed: 'Yahoo authorization was cancelled or failed',
        yahoo_connection_failed: 'Failed to connect to Yahoo. Please try again.',
        invalid_callback: 'Invalid authorization response from Yahoo'
      }
      setImportStatus({
        type: 'error',
        message: errorMessages[errorParam] || 'An error occurred during authorization'
      })
    }
  }, [platformParam, isConnected, errorParam])
  
  const performYahooImport = async () => {
    setIsImporting(true)
    try {
      const response = await fetch('/api/import/yahoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Token is already stored server-side
      })

      const result = await response.json()
      
      if (result.success) {
        setImportStatus({
          type: 'success',
          message: `Successfully imported ${result.leaguesImported} Yahoo leagues!`
        })
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        throw new Error(result.error || 'Import failed')
      }
    } catch (error: any) {
      setImportStatus({
        type: 'error',
        message: error.message || 'Failed to import Yahoo leagues'
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handlePasteImport = async () => {
    if (!pasteUrl.trim()) {
      setImportStatus({ type: 'error', message: 'Please paste a league URL' })
      return
    }

    setIsImporting(true)
    setImportStatus(null)

    try {
      const response = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pasteUrl.trim() }),
      })

      const result = await response.json()

      if (result.requiresAuth) {
        setImportStatus({ type: 'error', message: `Redirecting to ${result.platform} login...` })
        setTimeout(() => {
          window.location.href = result.authUrl
        }, 1000)
      } else if (result.success) {
        setImportStatus({
          type: 'success',
          message: result.message
        })
        setTimeout(() => router.push('/dashboard'), 1500)
      } else {
        setImportStatus({ type: 'error', message: result.message })
      }
    } catch (error: any) {
      setImportStatus({
        type: 'error',
        message: error.message || 'Failed to import league'
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleImport = async (platformId: string) => {
    setSelectedPlatform(platformId)
    setIsImporting(true)
    setImportStatus(null)

    try {
      // Handle different platform authentication methods
      if (platformId === 'yahoo') {
        // Yahoo uses OAuth - redirect to OAuth flow
        window.location.href = `/api/auth/yahoo?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
        return
      } else if (platformId === 'espn') {
        // ESPN uses cookie-based auth
        const espnS2 = prompt('Enter your ESPN espn_s2 cookie value:')
        if (!espnS2) {
          setIsImporting(false)
          return
        }
        
        const swid = prompt('Enter your ESPN SWID cookie value:')
        if (!swid) {
          setIsImporting(false)
          return
        }

        const response = await fetch('/api/import/espn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ espnS2, swid }),
        })

        const result = await response.json()
        
        if (result.success) {
          setImportStatus({
            type: 'success',
            message: `Successfully imported ${result.leaguesImported} ESPN leagues!`
          })
          setTimeout(() => router.push('/dashboard'), 2000)
        } else {
          throw new Error(result.error || 'Import failed')
        }
      } else if (platformId === 'sleeper') {
        // Sleeper uses username-based API
        const username = prompt('Enter your Sleeper username:')
        if (!username) {
          setIsImporting(false)
          return
        }

        const response = await fetch('/api/import/sleeper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        })

        const result = await response.json()
        
        if (result.success) {
          setImportStatus({
            type: 'success',
            message: `Successfully imported ${result.leaguesImported} leagues!`
          })
          setTimeout(() => router.push('/dashboard'), 2000)
        } else {
          throw new Error(result.error || 'Import failed')
        }
      } else {
        // Handle other platforms
        setImportStatus({
          type: 'error',
          message: 'This platform integration is coming soon!'
        })
      }
    } catch (error: any) {
      setImportStatus({
        type: 'error',
        message: error.message || 'Failed to import leagues'
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="glass-card rounded-none border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href={isOnboarding ? '/onboarding' : '/dashboard'} className="nav-link flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back {isOnboarding ? 'to Platform Selection' : 'to Dashboard'}
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Import Your <span className="gradient-text">Fantasy Leagues</span>
          </h1>
          <p className="text-xl text-gray-400">
            Paste any league URL or select your platform
          </p>
        </div>

        {importStatus && (
          <div className={`mb-8 p-4 rounded-lg text-center glass-card ${
            importStatus.type === 'error' 
              ? 'error-glow border-red-500/30' 
              : 'success-glow border-green-500/30'
          }`}>
            {importStatus.message}
          </div>
        )}

        {/* Paste URL Import - Primary Method */}
        {showPasteImport && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 animate-gradient" />
              
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-4">Quick Import</h2>
                <div className="space-y-4">
                  <input
                    type="url"
                    value={pasteUrl}
                    onChange={(e) => setPasteUrl(e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text')
                      if (text && text.startsWith('http')) {
                        setPasteUrl(text)
                        setTimeout(() => handlePasteImport(), 100)
                      }
                    }}
                    placeholder="Paste your league URL here..."
                    className="w-full px-6 py-4 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-lg 
                             placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                             transition-all duration-200"
                    disabled={isImporting}
                  />
                  
                  <button
                    onClick={handlePasteImport}
                    disabled={isImporting || !pasteUrl.trim()}
                    className="w-full px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700 
                             text-white font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                             transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isImporting ? 'Importing...' : 'Import League'}
                  </button>
                </div>
                
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowPasteImport(false)}
                    className="text-gray-400 hover:text-gray-300 text-sm"
                  >
                    or choose platform manually →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${showPasteImport ? 'opacity-50' : ''}`}>
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handleImport(platform.id)}
              disabled={!platform.supported || isImporting}
              className={`league-import-card relative overflow-hidden ${
                selectedPlatform === platform.id ? 'ring-2 ring-primary-500' : ''
              } ${
                platform.supported 
                  ? '' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${platform.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">{platform.name}</h3>
                <p className="text-gray-400">{platform.description}</p>
                {isImporting && selectedPlatform === platform.id && (
                  <div className="mt-4">
                    <div className="spinner w-8 h-8"></div>
                  </div>
                )}
                {selectedPlatform === platform.id && !isImporting && (
                  <div className="mt-4 text-primary-400 font-medium">
                    Click again to start import
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 glass-card p-8">
          <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-primary-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Choose Platform</h3>
              <p className="text-gray-300">Select your fantasy sports platform</p>
            </div>
            <div className="text-center">
              <div className="bg-primary-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Authorize Access</h3>
              <p className="text-gray-300">Securely connect your account</p>
            </div>
            <div className="text-center">
              <div className="bg-primary-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Import Complete</h3>
              <p className="text-gray-300">All your leagues, teams, and players imported</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-300">
            We collect and sync ALL data: rosters, scoring, standings, transactions, and more!
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Your data is encrypted and secure. We never share your information.
          </p>
        </div>

        {/* Platform-specific instructions */}
        <div className="mt-8 glass-card p-6">
          <h3 className="text-xl font-bold text-white mb-4">Platform Instructions</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-yellow-400">Sleeper</h4>
              <p className="text-gray-300">Simply enter your Sleeper username when prompted.</p>
            </div>
            <div>
              <h4 className="font-semibold text-red-400">ESPN</h4>
              <p className="text-gray-300">1. Log into ESPN Fantasy in your browser</p>
              <p className="text-gray-300">2. Open Developer Tools (F12)</p>
              <p className="text-gray-300">3. Go to Application > Cookies</p>
              <p className="text-gray-300">4. Find and copy 'espn_s2' and 'SWID' values</p>
            </div>
            <div>
              <h4 className="font-semibold text-purple-400">Yahoo</h4>
              <p className="text-gray-300">OAuth integration coming soon!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}