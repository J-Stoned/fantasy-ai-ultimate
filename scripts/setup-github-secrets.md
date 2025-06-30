# GitHub Secrets Setup Guide
## By Marcus "The Fixer" Rodriguez

This guide will help you properly set up GitHub Secrets for secure credential management.

## Required Secrets

### 1. Supabase (CRITICAL - ROTATE IMMEDIATELY)
```bash
SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...YOUR_NEW_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ...YOUR_NEW_SERVICE_KEY
DATABASE_URL=postgresql://postgres:[NEW_PASSWORD]@db.YOUR_NEW_PROJECT.supabase.co:5432/postgres
```

### 2. Redis (Production)
```bash
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379
# Recommended: Use Upstash or Redis Cloud
```

### 3. Sports APIs
```bash
BALLDONTLIE_API_KEY=GET_FROM_https://www.balldontlie.io
SPORTRADAR_API_KEY=GET_FROM_https://sportradar.com
ESPN_API_KEY=CONTACT_MARCUS_FOR_BETA_ACCESS
```

### 4. AI Services
```bash
OPENAI_API_KEY=sk-...YOUR_KEY
ELEVENLABS_API_KEY=YOUR_KEY
```

### 5. Monitoring
```bash
SENTRY_DSN=https://YOUR_KEY@sentry.io/YOUR_PROJECT
DATADOG_API_KEY=YOUR_KEY
```

### 6. Security
```bash
NEXTAUTH_SECRET=GENERATE_WITH_openssl rand -base64 32
CSRF_SECRET=GENERATE_WITH_openssl rand -base64 32
```

## Setting Secrets via GitHub CLI

```bash
# Install GitHub CLI
winget install GitHub.cli

# Login
gh auth login

# Set secrets
gh secret set SUPABASE_URL --body "YOUR_VALUE"
gh secret set SUPABASE_ANON_KEY --body "YOUR_VALUE"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "YOUR_VALUE"
gh secret set DATABASE_URL --body "YOUR_VALUE"
gh secret set REDIS_URL --body "YOUR_VALUE"
# ... repeat for all secrets
```

## Setting Secrets via GitHub UI

1. Go to Settings → Secrets → Actions
2. Click "New repository secret"
3. Add each secret with its name and value
4. Save

## Local Development

Create `.env.local` (NEVER COMMIT):
```bash
cp .env.secure.example .env.local
# Edit with your actual values
```

## Verification Script

Run this to verify your setup:
```bash
npm run verify:secrets
```

## Security Checklist

- [ ] Rotated all Supabase credentials
- [ ] Removed exposed file from git history
- [ ] Set up all GitHub Secrets
- [ ] Created local .env.local
- [ ] Verified .gitignore includes .env files
- [ ] Run security check script
- [ ] Enable secret scanning on GitHub

## CRITICAL REMINDER

The exposed password `IL36Z9I7tV2629Lr` must be:
1. Changed in Supabase immediately
2. Removed from git history using BFG
3. Never used again anywhere

## Emergency Contact

If credentials are compromised:
1. Rotate ALL secrets immediately
2. Check audit logs for unauthorized access
3. Contact: marcus@thefixer.dev