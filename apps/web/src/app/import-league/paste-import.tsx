'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PasteImportPage() {
  const [url, setUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const router = useRouter()

  // Auto-detect platform as user types
  const handleUrlChange = (value: string) => {
    setUrl(value)
    
    // Simple platform detection for instant feedback
    if (value.includes('yahoo.com')) setDetectedPlatform('Yahoo Fantasy')
    else if (value.includes('espn.com')) setDetectedPlatform('ESPN Fantasy')
    else if (value.includes('sleeper')) setDetectedPlatform('Sleeper')
    else if (value.includes('cbs')) setDetectedPlatform('CBS Sports')
    else if (value.includes('draftkings')) setDetectedPlatform('DraftKings')
    else if (value.includes('fanduel')) setDetectedPlatform('FanDuel')
    else setDetectedPlatform(null)
  }

  const handleImport = async () => {
    if (!url.trim()) {
      setStatus({ type: 'error', message: 'Please paste a league URL' })
      return
    }

    setIsImporting(true)
    setStatus(null)

    try {
      const response = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const result = await response.json()

      if (result.requiresAuth) {
        // Redirect to auth flow
        setStatus({ type: 'info', message: `Redirecting to ${result.platform} login...` })
        setTimeout(() => {
          window.location.href = result.authUrl
        }, 1000)
      } else if (result.success) {
        setStatus({ type: 'success', message: result.message })
        setTimeout(() => router.push('/dashboard'), 1500)
      } else {
        setStatus({ type: 'error', message: result.message })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to import league. Please try again.' })
    } finally {
      setIsImporting(false)
    }
  }

  // Handle paste event for instant import
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText && pastedText.startsWith('http')) {
      setUrl(pastedText)
      handleUrlChange(pastedText)
      // Auto-submit if it's a valid URL
      setTimeout(() => handleImport(), 100)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Logo/Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4">
            <span className="gradient-text">Paste</span> Your League
          </h1>
          <p className="text-xl text-gray-400">
            Just paste any fantasy league URL and we'll handle the rest
          </p>
        </div>

        {/* Main Import Box */}
        <div className="glass-card p-8 relative overflow-hidden">
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 animate-gradient" />
          
          <div className="relative z-10">
            {/* URL Input */}
            <div className="space-y-4">
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onPaste={handlePaste}
                placeholder="Paste your league URL here..."
                className="w-full px-6 py-4 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-lg 
                         placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                         transition-all duration-200"
                disabled={isImporting}
                autoFocus
              />
              
              {detectedPlatform && (
                <div className="text-sm text-primary-400 animate-fade-in">
                  Detected: {detectedPlatform}
                </div>
              )}
            </div>

            {/* Import Button */}
            <button
              onClick={handleImport}
              disabled={isImporting || !url.trim()}
              className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700 
                       text-white font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                       transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isImporting ? (
                <span className="flex items-center justify-center">
                  <div className="spinner w-5 h-5 mr-3" />
                  Importing...
                </span>
              ) : (
                'Import League'
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {status && (
          <div className={`mt-6 p-4 rounded-lg text-center glass-card animate-fade-in ${
            status.type === 'error' ? 'error-glow border-red-500/30' : 
            status.type === 'success' ? 'success-glow border-green-500/30' :
            'border-blue-500/30'
          }`}>
            {status.message}
          </div>
        )}

        {/* Supported Platforms */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-4">Supports all major platforms:</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Yahoo', 'ESPN', 'Sleeper', 'CBS', 'DraftKings', 'FanDuel'].map((platform) => (
              <span key={platform} className="px-3 py-1 bg-gray-800/50 rounded-full text-sm text-gray-300">
                {platform}
              </span>
            ))}
          </div>
        </div>

        {/* Pro Tips */}
        <div className="mt-8 glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Pro Tips:</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• Works with any league URL from supported platforms</li>
            <li>• Automatically detects platform and sport</li>
            <li>• Imports all league data: rosters, scoring, transactions</li>
            <li>• One-time auth per platform, then instant imports</li>
          </ul>
        </div>

        {/* Or Divider */}
        <div className="mt-8 flex items-center">
          <div className="flex-1 border-t border-gray-700" />
          <span className="px-4 text-gray-400">or</span>
          <div className="flex-1 border-t border-gray-700" />
        </div>

        {/* Alternative Import Methods */}
        <div className="mt-6 text-center">
          <a href="/import-league?method=manual" className="text-primary-400 hover:text-primary-300">
            Choose platform manually →
          </a>
        </div>
      </div>
    </div>
  )
}