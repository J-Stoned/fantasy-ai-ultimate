import { createClient } from '../../../../lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
            <h1 className="text-2xl font-bold text-white">Fantasy.AI Ultimate</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Welcome, {profile?.username || user.email}</span>
              <form action="/auth/signout" method="post">
                <button className="text-gray-300 hover:text-white transition-colors">
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              href="/import-league"
              className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
            >
              <h3 className="text-xl font-semibold text-white mb-2">Import League</h3>
              <p className="text-gray-200">One-click import from Yahoo, ESPN, DraftKings & more</p>
            </Link>
            
            <Link 
              href="/players"
              className="bg-gradient-to-r from-green-600 to-teal-600 p-6 rounded-xl hover:from-green-700 hover:to-teal-700 transition-all duration-200"
            >
              <h3 className="text-xl font-semibold text-white mb-2">Player Database</h3>
              <p className="text-gray-200">Browse EVERY player from EVERY league</p>
            </Link>
            
            <Link 
              href="/ai-assistant"
              className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-200"
            >
              <h3 className="text-xl font-semibold text-white mb-2">AI Assistant</h3>
              <p className="text-gray-200">"Hey Fantasy" - Your AI-powered helper</p>
            </Link>
          </div>
        </div>

        {/* User's Leagues */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
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
              <p className="text-gray-300 mb-4">You haven't imported any leagues yet.</p>
              <Link 
                href="/import-league"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Import Your First League
              </Link>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Total Leagues</h3>
            <p className="text-2xl font-bold text-white mt-1">{leagues?.length || 0}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Active Players</h3>
            <p className="text-2xl font-bold text-white mt-1">2.5M+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Data Points</h3>
            <p className="text-2xl font-bold text-white mt-1">10M+ Daily</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">AI Insights</h3>
            <p className="text-2xl font-bold text-white mt-1">24/7</p>
          </div>
        </div>
      </main>
    </div>
  )
}