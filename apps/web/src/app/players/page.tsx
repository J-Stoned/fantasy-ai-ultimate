'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase/client-browser'

type Player = {
  id: string
  firstName: string
  lastName: string
  position: string[]
  currentTeam?: { name: string }
  currentLeague?: { name: string }
  jerseyNumber?: string
  status?: string
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSport, setSelectedSport] = useState('all')
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)

  useEffect(() => {
    loadPlayers()
  }, [searchTerm, selectedSport, selectedLevel, page])

  const loadPlayers = async () => {
    setIsLoading(true)
    
    let query = supabase
      .from('players')
      .select(`
        id,
        firstName,
        lastName,
        position,
        jerseyNumber,
        status,
        currentTeam:teams_master!current_team_id(name),
        currentLeague:leagues!current_league_id(name)
      `)
      .range(page * 50, (page + 1) * 50 - 1)

    if (searchTerm) {
      // Sanitize search term to prevent SQL injection
      const sanitizedSearchTerm = searchTerm.replace(/[%_]/g, '\\$&').trim()
      if (sanitizedSearchTerm) {
        query = query.or(`firstName.ilike.%${sanitizedSearchTerm}%,lastName.ilike.%${sanitizedSearchTerm}%`)
      }
    }

    const { data, error } = await query

    if (!error && data) {
      setPlayers(data as any)
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <nav className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-white">
              ← Player Database
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Universal Player Database</h1>
          <p className="text-xl text-gray-300">
            Browse EVERY player from EVERY league - Professional, College, High School & More
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search players by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Sports</option>
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="baseball">Baseball</option>
              <option value="hockey">Hockey</option>
              <option value="soccer">Soccer</option>
            </select>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Levels</option>
              <option value="professional">Professional</option>
              <option value="college">College</option>
              <option value="high_school">High School</option>
              <option value="youth">Youth</option>
            </select>
          </div>
        </div>

        {/* Player Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Total Players</h3>
            <p className="text-2xl font-bold text-white mt-1">2.5M+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Active Players</h3>
            <p className="text-2xl font-bold text-white mt-1">450K+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Leagues Covered</h3>
            <p className="text-2xl font-bold text-white mt-1">1,200+</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300">Daily Updates</h3>
            <p className="text-2xl font-bold text-white mt-1">10M+</p>
          </div>
        </div>

        {/* Player List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="text-gray-300 mt-4">Loading players...</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      League
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {players.map((player) => (
                    <tr key={player.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          href={`/player/${player.id}`}
                          className="text-white hover:text-purple-300 transition-colors"
                        >
                          {player.firstName} {player.lastName}
                          {player.jerseyNumber && (
                            <span className="text-gray-400 ml-2">#{player.jerseyNumber}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {player.position?.join(', ') || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {player.currentTeam?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                        {player.currentLeague?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          player.status === 'active' 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {player.status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-6 py-4 bg-white/5 flex justify-between items-center">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-300">Page {page + 1}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}