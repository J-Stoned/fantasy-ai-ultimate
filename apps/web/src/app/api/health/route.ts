import { NextResponse } from 'next/server'
import { database } from '@/lib/services/database'
import { cache } from '@/lib/services/cache'
import { logger } from '../../../lib/logging/logger';

export const dynamic = 'force-dynamic'

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
  services: any[]
  database: any
  cache: any
  version: string
}

async function getStats() {
  try {
    // Use cache for health check stats (1 minute TTL)
    const stats = await cache.getOrSet('health:stats', async () => {
      // Use production database pool for optimized queries
      const [
        playersResult,
        teamsResult,
        gamesResult,
        newsResult
      ] = await Promise.all([
        database.query('SELECT COUNT(*) as count FROM players', [], 'read'),
        database.query('SELECT COUNT(*) as count FROM teams_master', [], 'read'),
        database.query('SELECT COUNT(*) as count FROM games', [], 'read'),
        database.query('SELECT COUNT(*) as count FROM news_articles', [], 'read')
      ])

      const players = parseInt(playersResult[0]?.count || '0')
      const teams = parseInt(teamsResult[0]?.count || '0')
      const games = parseInt(gamesResult[0]?.count || '0')
      const news = parseInt(newsResult[0]?.count || '0')

      return {
        players,
        teams,
        games,
        news,
        total: players + teams + games + news
      }
    }, { ttl: 60 }) // Cache for 1 minute

    return stats
  } catch (error) {
    logger.error('Error fetching stats:', { error: error })
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
  // Simple health check without ML services
  const stats = await getStats()
  
  // Check database and cache health
  let dbHealthy = false
  let cacheHealthy = false
  
  try {
    await database.query('SELECT 1', [], 'read')
    dbHealthy = true
  } catch (error) {
    logger.error('Database health check failed:', { error: error })
  }
  
  try {
    await cache.ping()
    cacheHealthy = true
  } catch (error) {
    logger.error('Cache health check failed:', { error: error })
  }
  
  // Determine overall health status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  if (!dbHealthy || !cacheHealthy) {
    overallStatus = 'unhealthy'
  } else if (!dbHealthy && !cacheHealthy) {
    overallStatus = 'degraded'
  }
  
  const status: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stats,
    services: [
      { name: 'web', status: 'ok' },
      { name: 'database', status: dbHealthy ? 'ok' : 'error' },
      { name: 'cache', status: cacheHealthy ? 'ok' : 'error' }
    ],
    database: dbHealthy,
    cache: {
      connected: cacheHealthy,
      stats: cache.getStats()
    },
    version: '2.0.0' // Upgraded with production infrastructure!
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