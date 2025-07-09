import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Simple database connectivity check
    const [playerCount, gameCount] = await Promise.all([
      prisma.player.count(),
      prisma.game.count()
    ])
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      stats: {
        players: playerCount,
        games: gameCount
      },
      version: '1.0.0'
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error: any) {
    console.error('Health check error:', error)
    
    // Check if it's a timeout (database paused)
    const isPaused = error.message?.includes('timeout') || error.code === 'P1001';
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: isPaused ? 'Database is paused - please unpause in Supabase dashboard' : 'Database connection failed',
      details: isPaused ? 'Visit https://supabase.com/dashboard to unpause your database' : error.message
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } finally {
    await prisma.$disconnect()
  }
}

// Liveness check - simpler check to see if the service is alive
export async function HEAD() {
  return new Response(null, { status: 200 })
}