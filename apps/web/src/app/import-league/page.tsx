'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const router = useRouter()

  const handleImport = async (platformId: string) => {
    setSelectedPlatform(platformId)
    setIsImporting(true)
    setImportStatus(null)

    try {
      // Handle different platform authentication methods
      if (platformId === 'yahoo') {
        // Yahoo uses OAuth
        alert('Yahoo import requires OAuth setup. For MVP, please use ESPN or Sleeper.')
        setIsImporting(false)
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <nav className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-white">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Import Your Fantasy Leagues</h1>
          <p className="text-xl text-gray-300">
            One-click import from all major fantasy platforms
          </p>
        </div>

        {importStatus && (
          <div className={`mb-8 p-4 rounded-lg text-center ${
            importStatus.type === 'error' 
              ? 'bg-red-500/20 text-red-200 border border-red-500/30' 
              : 'bg-green-500/20 text-green-200 border border-green-500/30'
          }`}>
            {importStatus.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handleImport(platform.id)}
              disabled={!platform.supported || isImporting}
              className={`relative overflow-hidden rounded-xl p-6 text-left transition-all duration-200 ${
                platform.supported 
                  ? 'hover:scale-105 hover:shadow-2xl cursor-pointer' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${platform.color} opacity-90`} />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">{platform.name}</h3>
                <p className="text-gray-200">{platform.description}</p>
                {isImporting && selectedPlatform === platform.id && (
                  <div className="mt-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 bg-white/10 backdrop-blur-lg rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-purple-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Choose Platform</h3>
              <p className="text-gray-300">Select your fantasy sports platform</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Authorize Access</h3>
              <p className="text-gray-300">Securely connect your account</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
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
        <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-6">
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