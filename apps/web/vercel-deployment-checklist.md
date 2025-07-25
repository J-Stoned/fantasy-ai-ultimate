# 🚀 VERCEL DEPLOYMENT CHECKLIST

## Pre-Deployment Requirements

### 1. **Environment Variables Setup**
```bash
# Required Production Environment Variables
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-super-secure-jwt-secret-32-chars-min
ENCRYPTION_KEY=your-encryption-key-32-chars-min
SESSION_SECRET=your-session-secret-32-chars-min

# External API Keys (Move to server-side only)
ELEVENLABS_API_KEY=your-elevenlabs-key
OPENAI_API_KEY=your-openai-key
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
YAHOO_CLIENT_SECRET=your-yahoo-oauth-secret

# Database & Cache
REDIS_URL=redis://your-redis-instance
POSTGRES_URL=postgresql://your-postgres-instance

# Monitoring & Logging
LOG_AGGREGATION_ENDPOINT=https://your-logging-service
LOG_SERVICE_TOKEN=your-logging-token
```

### 2. **Vercel Configuration**
```json
// vercel.json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["iad1", "sfo1", "lhr1"],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "pages/api/**/*.ts": {
      "maxDuration": 30
    },
    "pages/api/ml/**/*.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-domain.vercel.app"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/health",
      "destination": "/api/health"
    }
  ]
}
```

### 3. **Database Migration Strategy**
```typescript
// scripts/vercel-db-setup.ts
export const setupProductionDatabase = async () => {
  // 1. Create production database schema
  // 2. Run migrations
  // 3. Seed essential data
  // 4. Set up connection pooling
  // 5. Configure backup strategy
};
```

## Deployment Steps

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
vercel login
```

### Step 2: Configure Project
```bash
cd apps/web
vercel init
# Follow prompts to connect GitHub repo
```

### Step 3: Set Environment Variables
```bash
# Set all production environment variables
vercel env add JWT_SECRET production
vercel env add DATABASE_URL production
vercel env add ENCRYPTION_KEY production
# ... etc for all required vars
```

### Step 4: Deploy
```bash
# Preview deployment
vercel --prod=false

# Production deployment
vercel --prod
```

## Post-Deployment Validation

### 1. **Health Checks**
- [ ] `/api/health` returns 200
- [ ] Database connection successful
- [ ] Redis connection successful
- [ ] All environment variables loaded

### 2. **Performance Validation**
- [ ] Page load times < 3s
- [ ] API response times < 500ms
- [ ] ML inference < 2s
- [ ] WebSocket connections working

### 3. **Security Validation**
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] No sensitive data in logs
- [ ] Authentication working

### 4. **Feature Testing**
- [ ] User registration/login
- [ ] Player data loading
- [ ] DFS optimization
- [ ] ML predictions
- [ ] Voice interface

## Monitoring Setup

### 1. **Vercel Analytics**
```bash
npm install @vercel/analytics
```

### 2. **Custom Monitoring**
```typescript
// Add to _app.tsx
import { Analytics } from '@vercel/analytics/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
```

### 3. **Error Tracking**
- Set up Sentry or LogRocket integration
- Configure error alerting
- Set up performance monitoring

## Domain & SSL

### 1. **Custom Domain**
```bash
vercel domains add yourdomain.com
vercel domains add www.yourdomain.com
```

### 2. **SSL Certificate**
- Automatically handled by Vercel
- Free SSL with Let's Encrypt
- Auto-renewal

## Scaling Configuration

### 1. **Function Regions**
```json
{
  "functions": {
    "pages/api/ml/**/*.ts": {
      "regions": ["iad1", "sfo1"]
    }
  }
}
```

### 2. **Edge Functions**
```typescript
// For global low-latency endpoints
export const config = {
  runtime: 'edge',
};
```

## Backup Strategy

### 1. **Database Backups**
- Daily automated backups
- Point-in-time recovery
- Cross-region replication

### 2. **Code Backups**
- GitHub repository
- Vercel deployment history
- Environment variable backups

## Cost Optimization

### 1. **Function Optimization**
- Optimize cold start times
- Minimize bundle sizes
- Use edge functions for static content

### 2. **Monitoring Usage**
- Track function execution time
- Monitor bandwidth usage
- Optimize image delivery

## Security Hardening

### 1. **Environment Security**
- Use Vercel environment variables (encrypted)
- Never commit secrets to git
- Rotate secrets regularly

### 2. **Access Control**
- Limit Vercel team access
- Use GitHub protected branches
- Enable 2FA on all accounts

## Success Metrics

### Performance Targets
- [ ] 95%+ uptime
- [ ] <100ms edge response time
- [ ] <500ms API response time
- [ ] <2s page load time

### Security Targets
- [ ] A+ SSL rating
- [ ] No security vulnerabilities
- [ ] 100% HTTPS traffic
- [ ] Secure headers implemented

### Cost Targets
- [ ] <$50/month for first 1000 users
- [ ] <$500/month for 10,000 users
- [ ] Predictable scaling costs