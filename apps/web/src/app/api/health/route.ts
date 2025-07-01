import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Create a simple Supabase client without auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  stats?: {
    players: number
    teams: number
    games: number
    news: number
    total: number
  }
  version: string
}

async function getStats() {
  try {
    const [
      { count: playersCount },
      { count: teamsCount },
      { count: gamesCount },
      { count: newsCount }
    ] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('teams_master').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('news_articles').select('*', { count: 'exact', head: true })
    ])

    const players = playersCount || 0
    const teams = teamsCount || 0
    const games = gamesCount || 0
    const news = newsCount || 0

    return {
      players,
      teams,
      games,
      news,
      total: players + teams + games + news
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    return {
      players: 0,
      teams: 0,
      games: 0,
      news: 0,
      total: 0
    }
  }
}

export async function GET() {
  const stats = await getStats()
  
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stats,
    version: '1.0.0'
  }
  
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}

// Liveness check - simpler check to see if the service is alive
export async function HEAD() {
  return new Response(null, { status: 200 })
}