# 🚀 VERCEL DEPLOYMENT CHECKLIST

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. **Code Status** ✅
- [x] Ultimate Stats Service created
- [x] All API v3 endpoints created
- [x] Test suite prepared
- [x] Documentation complete

### 2. **Files Location** ✅
```
/apps/web/app/api/v3/ultimate-stats/
├── route.ts                    # Main endpoint
├── health/
│   └── route.ts               # Health check
├── players/
│   └── [id]/
│       └── route.ts           # Player stats
└── games/
    └── [id]/
        └── route.ts           # Game stats & refresh
```

### 3. **Required Environment Variables**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional but recommended
NODE_ENV=production
```

## 🛠️ DEPLOYMENT STEPS

### Step 1: Commit Changes
```bash
git add .
git commit -m "🚀 Add Ultimate Stats API v3 endpoints

- Complete real-time data pipeline
- 25+ advanced metrics per sport
- Redis caching with TTL strategy
- Comprehensive test suite
- Ready for production deployment"
```

### Step 2: Push to Repository
```bash
git push origin main
```

### Step 3: Vercel Setup
1. Go to https://vercel.com
2. Import your repository
3. Select `/apps/web` as the root directory
4. Framework preset: Next.js
5. Build command: `npm run build` (or leave as auto-detected)
6. Output directory: `.next` (or leave as auto-detected)

### Step 4: Environment Variables
Add all required environment variables in Vercel dashboard:
- Settings → Environment Variables
- Add each variable for Production environment

### Step 5: Deploy
- Click "Deploy"
- Wait for build to complete
- Note your deployment URL

## 🧪 POST-DEPLOYMENT TESTING

### 1. Quick Health Check
```bash
curl https://your-app.vercel.app/api/v3/ultimate-stats/health
```

### 2. Run Test Suite
Update the test script with your Vercel URL:
```bash
# In test-ultimate-stats-api.ts
const BASE_URL = 'https://your-app.vercel.app/api/v3/ultimate-stats';
```

Then run:
```bash
npx tsx scripts/test-ultimate-stats-api.ts
```

### 3. Test Each Endpoint
```bash
# Main endpoint
curl "https://your-app.vercel.app/api/v3/ultimate-stats?limit=5"

# Player stats
curl "https://your-app.vercel.app/api/v3/ultimate-stats/players/PLAYER_ID"

# Game stats
curl "https://your-app.vercel.app/api/v3/ultimate-stats/games/GAME_ID"
```

## 📊 EXPECTED RESULTS

### Success Indicators:
- ✅ Health endpoint returns `{"status": "healthy"}`
- ✅ Main endpoint returns data with proper structure
- ✅ Response times < 200ms (with caching)
- ✅ No CORS errors
- ✅ Proper error handling for invalid requests

### Performance Metrics:
- Cold start: < 3 seconds
- Cached response: < 50ms
- Database queries: < 100ms
- Redis operations: < 10ms

## 🚨 TROUBLESHOOTING

### Common Issues:

1. **Module not found errors**
   - Check import paths in route files
   - Ensure all dependencies are in package.json

2. **Database connection errors**
   - Verify environment variables
   - Check Supabase service role key

3. **Redis connection errors**
   - Verify Upstash credentials
   - Check Redis URL format

4. **Build failures**
   - Check TypeScript errors
   - Verify all imports resolve correctly

## 🎯 NEXT STEPS AFTER SUCCESSFUL DEPLOYMENT

1. **Update Scheduler**
   - Point to production URL
   - Deploy scheduler as a separate service

2. **Monitor Performance**
   - Set up Vercel Analytics
   - Configure alerts for errors

3. **Frontend Integration**
   - Update API calls to use production URL
   - Test WebSocket connections

4. **Documentation**
   - Update API docs with production URLs
   - Share with team

---

**Ready to Deploy!** 🚀

Once deployed, all Ultimate Stats API v3 endpoints will be live and ready for production use!