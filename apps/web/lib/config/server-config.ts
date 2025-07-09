import 'server-only' // This ensures the file is never imported client-side

// Validate environment variables on startup
const requiredEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
] as const

const optionalEnvVars = [
  'REDIS_URL',
  'BALLDONTLIE_API_KEY',
  'MYSPORTSFEEDS_API_KEY',
  'SPORTRADAR_API_KEY',
  'YAHOO_CLIENT_ID',
  'YAHOO_CLIENT_SECRET',
  'ESPN_API_KEY',
  'SLEEPER_API_KEY',
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'WEATHER_API_KEY',
  'NEWS_API_KEY',
  'SPORTS_WEBHOOK_SECRET',
] as const

// Type-safe environment variable access
type RequiredEnvVar = typeof requiredEnvVars[number]
type OptionalEnvVar = typeof optionalEnvVars[number]

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}

// Server-only configuration with type safety
export const serverConfig = {
  // Database
  database: {
    url: process.env.DATABASE_URL!,
    supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },

  // Caching
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Sports Data APIs
  sportsData: {
    ballDontLie: process.env.BALLDONTLIE_API_KEY,
    mySportsFeeds: process.env.MYSPORTSFEEDS_API_KEY,
    sportRadar: process.env.SPORTRADAR_API_KEY,
  },

  // Fantasy Platform OAuth
  fantasyPlatforms: {
    yahoo: {
      clientId: process.env.YAHOO_CLIENT_ID,
      clientSecret: process.env.YAHOO_CLIENT_SECRET,
    },
    espn: {
      apiKey: process.env.ESPN_API_KEY,
    },
    sleeper: {
      apiKey: process.env.SLEEPER_API_KEY,
    },
  },

  // AI Services
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
    },
  },

  // External Services
  external: {
    weather: {
      apiKey: process.env.WEATHER_API_KEY,
    },
    news: {
      apiKey: process.env.NEWS_API_KEY,
    },
  },

  // Webhooks
  webhooks: {
    sportsDataSecret: process.env.SPORTS_WEBHOOK_SECRET || generateSecureSecret(),
  },

  // Feature flags based on API availability
  features: {
    sportsDataEnabled: Boolean(
      process.env.BALLDONTLIE_API_KEY || 
      process.env.MYSPORTSFEEDS_API_KEY || 
      process.env.SPORTRADAR_API_KEY
    ),
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
    voiceEnabled: Boolean(process.env.ELEVENLABS_API_KEY),
    weatherEnabled: Boolean(process.env.WEATHER_API_KEY),
    newsEnabled: Boolean(process.env.NEWS_API_KEY),
  },
} as const

// Helper function to check if a service is configured
export function isServiceConfigured(service: keyof typeof serverConfig.features): boolean {
  return serverConfig.features[service as keyof typeof serverConfig.features] || false
}

// Helper to get API key with fallback
export function getApiKey(
  service: 'ballDontLie' | 'mySportsFeeds' | 'sportRadar' | 'openai' | 'elevenlabs' | 'weather' | 'news'
): string | undefined {
  switch (service) {
    case 'ballDontLie':
    case 'mySportsFeeds':
    case 'sportRadar':
      return serverConfig.sportsData[service]
    case 'openai':
    case 'elevenlabs':
      return serverConfig.ai[service].apiKey
    case 'weather':
    case 'news':
      return serverConfig.external[service].apiKey
  }
}

// Generate secure webhook secret if not provided
function generateSecureSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SPORTS_WEBHOOK_SECRET must be set in production')
  }
  // Only use generated secret in development
  return 'dev-' + Math.random().toString(36).substring(2, 15)
}

// Export type for use in other files
export type ServerConfig = typeof serverConfig