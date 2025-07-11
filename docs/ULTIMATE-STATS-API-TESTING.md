# 🧪 ULTIMATE STATS API V3 - TESTING GUIDE

## 📋 OVERVIEW
This guide covers testing all Ultimate Stats API v3 endpoints to ensure they're working correctly.

## 🏥 HEALTH CHECK
```bash
curl http://localhost:3000/api/v3/ultimate-stats/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-11T...",
  "checks": {
    "api": "healthy",
    "database": "healthy", 
    "redis": "healthy",
    "metrics_coverage": "35706 logs with metrics"
  },
  "endpoints": [...]
}
```

## 📊 MAIN ENDPOINT TESTS

### 1. Get All Ultimate Stats
```bash
# Basic query
curl "http://localhost:3000/api/v3/ultimate-stats?limit=5"

# Filter by sport
curl "http://localhost:3000/api/v3/ultimate-stats?sport=NBA&limit=10"

# Get live games only
curl "http://localhost:3000/api/v3/ultimate-stats?live=true"

# Filter by specific metrics
curl "http://localhost:3000/api/v3/ultimate-stats?metrics=fantasy_points_estimate,true_shooting_pct&limit=5"

# Pagination
curl "http://localhost:3000/api/v3/ultimate-stats?limit=10&offset=20"

# Date range filter
curl "http://localhost:3000/api/v3/ultimate-stats?date_from=2024-01-01&date_to=2024-12-31&limit=5"

# Team filter
curl "http://localhost:3000/api/v3/ultimate-stats?team=LAL&limit=10"
```

### 2. Calculate Stats On-Demand (POST)
```bash
# Calculate for a specific game
curl -X POST http://localhost:3000/api/v3/ultimate-stats \
  -H "Content-Type: application/json" \
  -d '{"game_id": "YOUR_GAME_ID"}'

# Calculate for specific players
curl -X POST http://localhost:3000/api/v3/ultimate-stats \
  -H "Content-Type: application/json" \
  -d '{"player_ids": ["PLAYER_ID_1", "PLAYER_ID_2"]}'

# Force recalculation
curl -X POST http://localhost:3000/api/v3/ultimate-stats \
  -H "Content-Type: application/json" \
  -d '{"game_id": "YOUR_GAME_ID", "force": true}'
```

## 👤 PLAYER ENDPOINT TESTS

### 1. Get Player Stats
```bash
# Basic player stats
curl "http://localhost:3000/api/v3/ultimate-stats/players/PLAYER_ID"

# Last N games
curl "http://localhost:3000/api/v3/ultimate-stats/players/PLAYER_ID?last_n_games=10"

# Season stats
curl "http://localhost:3000/api/v3/ultimate-stats/players/PLAYER_ID?season=2024"

# Home/Away splits
curl "http://localhost:3000/api/v3/ultimate-stats/players/PLAYER_ID?home_away=home"

# Against specific team
curl "http://localhost:3000/api/v3/ultimate-stats/players/PLAYER_ID?vs_team=BOS"

# Date range
curl "http://localhost:3000/api/v3/ultimate-stats/players/PLAYER_ID?date_from=2024-01-01&date_to=2024-03-31"
```

## 🏀 GAME ENDPOINT TESTS

### 1. Get Game Stats
```bash
# All players in game
curl "http://localhost:3000/api/v3/ultimate-stats/games/GAME_ID"

# Home team only
curl "http://localhost:3000/api/v3/ultimate-stats/games/GAME_ID?team=home"

# Away team only
curl "http://localhost:3000/api/v3/ultimate-stats/games/GAME_ID?team=away"

# Filter by position
curl "http://localhost:3000/api/v3/ultimate-stats/games/GAME_ID?position=PG"

# Minimum minutes filter
curl "http://localhost:3000/api/v3/ultimate-stats/games/GAME_ID?min_minutes=20"
```

### 2. Refresh Game Stats (POST)
```bash
curl -X POST "http://localhost:3000/api/v3/ultimate-stats/games/GAME_ID/refresh"
```

## 🔧 AUTOMATED TESTING

### Quick Test Script
```bash
# Run the quick test
npx tsx scripts/quick-test-api.ts
```

### Comprehensive Test Suite
```bash
# Run full test suite
npx tsx scripts/test-ultimate-stats-api.ts
```

### Shell Script Test
```bash
# Run shell-based tests
./test-api-endpoints.sh
```

## 📈 EXPECTED METRICS

When testing, you should see these advanced metrics in responses:

### NBA Metrics:
- `true_shooting_pct`: True shooting percentage
- `effective_fg_pct`: Effective field goal percentage
- `usage_rate`: Usage rate
- `game_score`: Hollinger's game score
- `fantasy_points_estimate`: Estimated fantasy points

### NFL Metrics:
- `passer_rating`: QB passer rating
- `yards_per_attempt`: Passing yards per attempt
- `yards_from_scrimmage`: Total yards (rushing + receiving)
- `touches`: Total touches (carries + receptions)
- `fantasy_points_estimate`: PPR fantasy points

### NHL Metrics:
- `points_per_60`: Points per 60 minutes
- `shots_per_game`: Average shots per game
- `plus_minus_per_game`: Plus/minus per game
- `fantasy_points_estimate`: Fantasy points

### MLB Metrics:
- `batting_average`: Batting average
- `on_base_pct`: On-base percentage
- `slugging_pct`: Slugging percentage
- `ops`: On-base plus slugging
- `whip`: Walks + hits per inning pitched
- `fantasy_points_estimate`: Fantasy points

## 🚨 COMMON ISSUES

### 1. Server Not Running
```bash
# Start the Next.js server
npm run dev
```

### 2. Database Connection Issues
Check your `.env` file has correct Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### 3. Redis Connection Issues
Check your `.env` file has correct Redis credentials:
```
UPSTASH_REDIS_REST_URL=your_url
UPSTASH_REDIS_REST_TOKEN=your_token
```

### 4. No Data Returned
- Ensure you've run the backfill scripts
- Check that `computed_metrics` are populated
- Verify the database has data for your filters

## ✅ SUCCESS CRITERIA

All endpoints should:
1. Return 200 status for valid requests
2. Return appropriate error codes (400, 404, 500)
3. Include proper response structure with `data` and `meta`
4. Response times < 500ms for most queries
5. Cache behavior working (faster on repeated requests)
6. WebSocket broadcasting updates for live games

## 🎯 NEXT STEPS

After testing:
1. Monitor the scheduler: `npx tsx scripts/ultimate-stats-scheduler.ts`
2. Check WebSocket updates: `npx tsx scripts/test-websocket-integration.ts`
3. View real-time dashboard: `npx tsx scripts/realtime-dashboard.ts`
4. Build frontend components to consume the API