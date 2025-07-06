/**
 * 🚀 PRODUCTION DEPLOYMENT CONFIGURATION
 * 
 * Dr. Lucey's Pattern Empire - Ready for the real world!
 */

export const PRODUCTION_CONFIG = {
  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://api.pattern-empire.com',
    version: 'v1',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      premium: 1000 // premium users get 1000 requests
    }
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    poolSize: 20,
    ssl: true,
    statementTimeout: 30000 // 30 seconds
  },

  // Pattern System Settings
  patterns: {
    scanInterval: 30000, // 30 seconds
    maxConcurrentScans: 10,
    confidenceThreshold: 0.65,
    minROI: 0.1, // 10% minimum ROI to trigger alert
    enableQuantumPatterns: true,
    enableRevolutionaryPatterns: true
  },

  // Betting Configuration
  betting: {
    mode: process.env.BETTING_MODE || 'PAPER_TRADING',
    maxBetSizePercent: 0.1, // Max 10% of bankroll per bet
    kellyFraction: 0.25, // Use 25% Kelly for safety
    minimumBankroll: 1000,
    apis: {
      draftkings: {
        enabled: false,
        apiKey: process.env.DRAFTKINGS_API_KEY,
        endpoint: 'https://api.draftkings.com/v1'
      },
      fanduel: {
        enabled: false,
        apiKey: process.env.FANDUEL_API_KEY,
        endpoint: 'https://api.fanduel.com/v1'
      },
      pinnacle: {
        enabled: false,
        apiKey: process.env.PINNACLE_API_KEY,
        endpoint: 'https://api.pinnacle.com/v1'
      }
    }
  },

  // External Data Sources
  dataSources: {
    weather: {
      provider: 'openweathermap',
      apiKey: process.env.WEATHER_API_KEY,
      updateInterval: 3600000 // 1 hour
    },
    lunar: {
      provider: 'astronomyapi',
      apiKey: process.env.LUNAR_API_KEY,
      updateInterval: 86400000 // 24 hours
    },
    geomagnetic: {
      provider: 'noaa',
      endpoint: 'https://services.swpc.noaa.gov/json/planetary_k_index.json',
      updateInterval: 3600000 // 1 hour
    },
    social: {
      twitter: {
        apiKey: process.env.TWITTER_API_KEY,
        trackHashtags: ['#NBA', '#NFL', '#NHL', '#MLB']
      },
      instagram: {
        apiKey: process.env.INSTAGRAM_API_KEY,
        trackAccounts: [] // Add player accounts
      }
    }
  },

  // Monitoring & Alerts
  monitoring: {
    slack: {
      enabled: true,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channels: {
        alerts: '#pattern-alerts',
        critical: '#critical-patterns',
        performance: '#roi-tracking'
      }
    },
    email: {
      enabled: false,
      smtp: {
        host: process.env.SMTP_HOST,
        port: 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      alerts: ['admin@pattern-empire.com']
    },
    metrics: {
      provider: 'datadog',
      apiKey: process.env.DATADOG_API_KEY,
      tags: ['pattern-empire', 'production']
    }
  },

  // Security
  security: {
    apiKeys: {
      enabled: true,
      headerName: 'X-API-Key',
      encryption: 'AES-256-GCM'
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://pattern-empire.com'],
      credentials: true
    },
    rateLimit: {
      enabled: true,
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      }
    }
  },

  // Deployment
  deployment: {
    provider: process.env.DEPLOY_PROVIDER || 'vercel', // vercel, aws, gcp
    region: process.env.DEPLOY_REGION || 'us-east-1',
    scaling: {
      minInstances: 2,
      maxInstances: 10,
      targetCPU: 70
    }
  },

  // Feature Flags
  features: {
    lunarPatterns: true,
    geomagneticPatterns: true,
    socialMediaPatterns: true,
    quantumPatterns: true,
    autoBetting: false, // Start with manual approval
    publicAPI: false, // Start private
    webhooks: true
  }
};

// Environment validation
export function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate betting mode
  if (process.env.BETTING_MODE === 'REAL_MONEY') {
    console.warn('⚠️  REAL MONEY MODE ENABLED - Ensure all safety checks are in place!');
  }
}

// Export for use in other files
export default PRODUCTION_CONFIG;