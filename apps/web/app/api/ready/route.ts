import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Readiness check - indicates if the service is ready to handle requests
export async function GET() {
  // Check if all required environment variables are present
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    return NextResponse.json({
      ready: false,
      message: 'Missing required environment variables',
      missing: missingVars
    }, { status: 503 })
  }
  
  return NextResponse.json({
    ready: true,
    message: 'Service is ready',
    timestamp: new Date().toISOString()
  })
}