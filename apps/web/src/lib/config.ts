export const config = {
  redis: {
    host: process.env.REDIS_HOST || (process.env.NODE_ENV === 'production' ? undefined : 'localhost'),
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  jwt: {
    // SECURITY: JWT secret must be configured via environment variables
    secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT || '3001'),
    path: process.env.WEBSOCKET_PATH || '/ws',
  },
  queue: {
    defaultJobOptions: {
      removeOnComplete: {
        count: 100,
        age: 24 * 3600, // 24 hours
      },
      removeOnFail: {
        count: 50,
        age: 7 * 24 * 3600, // 7 days
      },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },
  oauth: {
    providers: {
      yahoo: {
        clientId: process.env.YAHOO_CLIENT_ID!,
        clientSecret: process.env.YAHOO_CLIENT_SECRET,
      },
      espn: {
        clientId: process.env.ESPN_CLIENT_ID!,
        clientSecret: process.env.ESPN_CLIENT_SECRET,
      },
      sleeper: {
        clientId: process.env.SLEEPER_CLIENT_ID!,
        clientSecret: process.env.SLEEPER_CLIENT_SECRET,
      },
    },
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:3000'),
    timeout: parseInt(process.env.API_TIMEOUT || '30000'),
  },
  features: {
    enableWebSocket: process.env.ENABLE_WEBSOCKET === 'true',
    enableQueue: process.env.ENABLE_QUEUE === 'true',
    enableOAuth: process.env.ENABLE_OAUTH === 'true',
  },
};