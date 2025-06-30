import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { createClient as createRedisClient } from 'redis'

export const dynamic = 'force-dynamic'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    database: CheckResult
    redis: CheckResult
    memory: CheckResult
  }
  version: string
}

interface CheckResult {
  status: 'pass' | 'fail'
  responseTime?: number
  error?: string
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('players')
      .select('id')
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error
    }
    
    return {
      status: 'pass',
      responseTime: Date.now() - start
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now()
  
  // Skip Redis check if not configured
  if (!process.env.REDIS_URL) {
    return {
      status: 'pass',
      responseTime: 0
    }
  }
  
  let client
  try {
    client = createRedisClient({
      url: process.env.REDIS_URL
    })
    
    await client.connect()
    await client.ping()
    
    return {
      status: 'pass',
      responseTime: Date.now() - start
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    if (client) {
      await client.disconnect()
    }
  }
}

function checkMemory(): CheckResult {
  const usage = process.memoryUsage()
  const heapUsedMB = usage.heapUsed / 1024 / 1024
  const heapTotalMB = usage.heapTotal / 1024 / 1024
  const heapPercentage = (usage.heapUsed / usage.heapTotal) * 100
  
  // Warn if heap usage is above 85%
  if (heapPercentage > 85) {
    return {
      status: 'fail',
      error: `High memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${heapPercentage.toFixed(1)}%)`
    }
  }
  
  return {
    status: 'pass'
  }
}

export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemory()
  }
  
  const allHealthy = Object.values(checks).every(check => check.status === 'pass')
  const anyFailed = Object.values(checks).some(check => check.status === 'fail')
  
  const status: HealthStatus = {
    status: anyFailed ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.npm_package_version || '1.0.0'
  }
  
  return NextResponse.json(status, {
    status: status.status === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}

// Liveness check - simpler check to see if the service is alive
export async function HEAD() {
  return new Response(null, { status: 200 })
}