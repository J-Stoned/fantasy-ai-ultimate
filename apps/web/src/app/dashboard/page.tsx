import { createClient } from '../../lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MobileNav } from '../../components/layout/MobileNav'
import { Badge } from '../../components/ui/badge'
import { TopPlayersWidget } from '../../components/dashboard/TopPlayersWidget'
import { VoiceAssistantWrapper } from '../../components/dashboard/VoiceAssistantWrapper'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth')
  }

  // Fetch user's leagues
  const { data: leagues } = await supabase
    .from('fantasy_leagues')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  // Fetch user's profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <nav className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl md:text-2xl font-bold text-white">Fantasy.AI Ultimate</h1>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/live" className="text-green-400 hover:text-green-300 transition-colors flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                Live
              </Link>
              <Link href="/pricing" className="text-yellow-400 hover:text-yellow-300 transition-colors">
                ⚡ Upgrade
              </Link>
              <span className="text-gray-300">Welcome, {profile?.username || user.email}</span>
              <form action="/auth/signout" method="post">
                <button className="text-gray-300 hover:text-white transition-colors">
                  Sign Out
                </button>
              </form>
            </div>
            
            {/* Mobile Navigation */}
            <MobileNav user={user} profile={profile} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link 
              href="/lineup-builder"
              className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">🎯 Lineup Builder</h3>
              <p className="text-gray-200">Simple DFS lineup optimization</p>
            </Link>
            
            <Link 
              href="/dfs-optimizer"
              className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">🚀 Advanced DFS</h3>
              <p className="text-gray-200">Professional optimization tools</p>
            </Link>
            
            <Link 
              href="/players"
              className="bg-gradient-to-r from-green-600 to-teal-600 p-6 rounded-xl hover:from-green-700 hover:to-teal-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">👥 Player Database</h3>
              <p className="text-gray-200">1M+ stats from all leagues</p>
            </Link>
            
            <Link 
              href="/leagues"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">🏆 My Leagues</h3>
              <p className="text-gray-200">Manage all your fantasy teams</p>
            </Link>
            
            <Link 
              href="/trades"
              className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">💱 Trade Analyzer</h3>
              <p className="text-gray-200">AI-powered trade evaluation</p>
            </Link>
          </div>
          
          {/* AI-Powered Features Row */}
          <div className="mt-8 mb-4">
            <h3 className="text-2xl font-bold text-white mb-4">🔥 AI-Powered Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                href="/oracle"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-yellow-500 text-black animate-pulse">AI</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🔮 Fantasy Oracle</h3>
                <p className="text-gray-200">Master AI advisor with voice control</p>
              </Link>
              
              <Link 
                href="/analytics"
                className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-500 text-black">VOICE</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🎙️ Voice Analytics</h3>
                <p className="text-gray-200">Natural language data visualization</p>
              </Link>
              
              <Link 
                href="/agents"
                className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-pink-500 text-black">9 AI</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🤖 AI Agents</h3>
                <p className="text-gray-200">9 specialized AI personalities</p>
              </Link>
              
              <Link 
                href="/admin/ml-training"
                className="bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-xl hover:from-red-700 hover:to-orange-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-cyan-500 text-black">ML</Badge>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">🧠 ML Training</h3>
                <p className="text-gray-200">96.97% NFL accuracy achieved!</p>
              </Link>
            </div>
          </div>
          
          {/* Additional Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link 
              href="/waiver-wire"
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 p-6 rounded-xl hover:from-indigo-700 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">📈 Waiver Wire</h3>
              <p className="text-gray-200">Find breakout players early</p>
            </Link>
            
            <Link 
              href="/live"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
            >
              <div className="absolute top-2 right-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">📡 Live Dashboard</h3>
              <p className="text-gray-200">Real-time pattern alerts</p>
            </Link>
            
            <Link 
              href="/data-hub"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
            >
              <h3 className="text-xl font-semibold text-white mb-2">📊 Data Hub</h3>
              <p className="text-gray-200">Real-time sports data</p>
            </Link>
            
            <Link 
              href="/analytics"
              className="bg-gradient-to-r from-violet-600 to-purple-600 p-6 rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 relative overflow-hidden"
            >
              <div className="absolute top-2 right-2">
                <Badge className="bg-yellow-500 text-black">NEW</Badge>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">🎙️ Voice Analytics</h3>
              <p className="text-gray-200">AI-powered data visualization</p>
            </Link>
          </div>
        </div>

        {/* Two Column Layout for Leagues and Top Players */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User's Leagues - Takes 2 columns on large screens */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Your Leagues</h2>
          
          {leagues && leagues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <div 
                  key={league.id}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-white mb-2">{league.name}</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>Platform: {league.platform}</p>
                    <p>Season: {league.season}</p>
                  </div>
                  <Link 
                    href={`/league/${league.id}`}
                    className="mt-4 inline-block text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    View League →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-300 mb-4">No leagues found in your profile.</p>
              <Link 
                href="/dfs-optimizer"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Try DFS Optimizer
              </Link>
            </div>
          )}
          </div>
          
          {/* Top Players Widget - Takes 1 column on large screens */}
          <div className="lg:col-span-1">
            <TopPlayersWidget />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Total Leagues</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">{leagues?.length || 0}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Player Stats</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">519K+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Games Analyzed</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">48K+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Pattern Accuracy</h3>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">65.2%</p>
          </div>
        </div>

        {/* 🔥 ENTERPRISE VOICE ASSISTANT */}
        <VoiceAssistantWrapper 
          fantasyTeamId={leagues?.[0]?.id} 
          leagueId={leagues?.[0]?.id}
        />
      </main>
    </div>
  )
}