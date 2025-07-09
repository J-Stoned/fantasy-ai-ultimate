'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase/client-browser'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        
        if (error) throw error
        
        setMessage({ 
          type: 'success', 
          text: 'Check your email to confirm your account!' 
        })
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (error) throw error
        
        // Check if user has any leagues imported
        const { data: leagues } = await supabase
          .from('fantasy_leagues')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1)
        
        // If no leagues, redirect to onboarding
        if (!leagues || leagues.length === 0) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'An error occurred' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) throw error
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'An error occurred' 
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Fantasy.AI Ultimate</h1>
          <p className="text-gray-300">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'error' 
              ? 'bg-red-500/20 text-red-200 border border-red-500/30' 
              : 'bg-green-500/20 text-green-200 border border-green-500/30'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-300 mb-4">Or continue with</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleSocialLogin('google')}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Google
            </button>
            <button
              onClick={() => handleSocialLogin('github')}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              GitHub
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-purple-300 hover:text-purple-200 transition-colors duration-200"
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  )
}