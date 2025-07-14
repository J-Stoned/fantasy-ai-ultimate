# 🚀 FANTASY AI OPERATIONAL MANUAL - DIRECT API ACCESS

## Overview
This manual provides comprehensive instructions for accessing all your configured services directly in your codebase, replacing the need for MCP servers when using Cursor or other non-Claude-Desktop environments.

## Table of Contents
1. [Available Services](#available-services)
2. [Quick Start](#quick-start)
3. [Service-by-Service Guide](#service-by-service-guide)
4. [Unified Sports Data Service](#unified-sports-data-service)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [API Keys & Credentials](#api-keys--credentials)

---

## Available Services

Your system has access to the following services:

| Service | Purpose | Status |
|---------|---------|--------|
| **Supabase** | Primary database (games, players, stats) | ✅ Working |
| **PostgreSQL** | Direct database queries | ✅ Working |
| **BallDontLie API** | NBA game and player data | ✅ Working |
| **MLB Stats API** | MLB game and player data | ✅ Working |
| **Redis** | Caching (optional) | 🔧 Ready when needed |
| **OpenAI** | AI capabilities | 🔧 Ready when needed |
| **ElevenLabs** | Text-to-speech | 🔧 Ready when needed |

---

## Quick Start

### 1. Test All Services
```bash
# Test direct API access to all services
npx tsx scripts/direct-api-access.ts

# Test unified sports data service
npx tsx scripts/test-unified-sports-data.ts
```

### 2. Import in Your Code
```typescript
// Option 1: Import unified service (recommended)
import { sportsData } from './lib/services/unified-sports-data';

// Option 2: Import individual APIs
import { supabase, ballDontLieApi, mlbApi } from './scripts/direct-api-access';
```

---

## Service-by-Service Guide

### 1. Supabase Database

**Connection:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'YOUR_SUPABASE_KEY'
);
```

**Common Queries:**
```typescript
// Get recent games
const { data: games } = await supabase
  .from('games')
  .select('*')
  .order('start_time', { ascending: false })
  .limit(10);

// Get player stats
const { data: stats } = await supabase
  .from('player_stats')
  .select('*')
  .eq('player_id', 'player123')
  .order('created_at', { ascending: false });

// Get pattern predictions
const { data: patterns } = await supabase
  .from('pattern_predictions')
  .select('*')
  .gte('confidence_score', 0.7);
```

**Available Tables:**
- `games` - 30,003 records
- `player_stats` - 258,662 records
- `players` - 846,724 records
- `teams` - 224 records
- `pattern_predictions` - Pattern analysis results
- `ml_predictions` - ML model predictions
- `player_injuries` - Injury data
- `weather_data` - Weather conditions

### 2. BallDontLie NBA API

**Setup:**
```typescript
const ballDontLieApi = axios.create({
  baseURL: 'https://api.balldontlie.io/v1',
  headers: {
    'Authorization': '59de4292-dfc4-4a8a-b337-1e804f4109c6'
  }
});
```

**Available Endpoints:**
```typescript
// Get games
const games = await ballDontLieApi.get('/games', {
  params: {
    start_date: '2025-01-14',
    end_date: '2025-01-14',
    per_page: 100
  }
});

// Get player stats
const stats = await ballDontLieApi.get('/stats', {
  params: {
    player_ids: [237], // LeBron James
    seasons: [2024],
    per_page: 100
  }
});

// Get players
const players = await ballDontLieApi.get('/players', {
  params: {
    search: 'lebron',
    per_page: 20
  }
});

// Get teams
const teams = await ballDontLieApi.get('/teams');
```

### 3. MLB Stats API

**Setup:**
```typescript
const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});
```

**Available Endpoints:**
```typescript
// Get schedule
const schedule = await mlbApi.get('/schedule', {
  params: {
    sportId: 1,
    startDate: '2024-10-01',
    endDate: '2024-10-07'
  }
});

// Get player stats
const playerStats = await mlbApi.get(`/people/${playerId}/stats`, {
  params: {
    stats: 'season',
    season: 2024
  }
});

// Get teams
const teams = await mlbApi.get('/teams', {
  params: {
    sportId: 1
  }
});

// Get standings
const standings = await mlbApi.get('/standings', {
  params: {
    leagueId: '103,104', // AL and NL
    season: 2024
  }
});
```

### 4. Direct PostgreSQL

**Setup:**
```typescript
import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: 'postgresql://postgres:PASSWORD@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
```

**Advanced Queries:**
```typescript
// Pattern analysis with performance
const patterns = await pgPool.query(`
  SELECT 
    pp.pattern_name,
    COUNT(*) as occurrences,
    AVG(pp.confidence_score) as avg_confidence,
    SUM(CASE WHEN g.home_score > g.away_score AND pp.prediction = 'home' THEN 1
             WHEN g.away_score > g.home_score AND pp.prediction = 'away' THEN 1
             ELSE 0 END)::float / COUNT(*) as accuracy
  FROM pattern_predictions pp
  JOIN games g ON pp.game_id = g.id
  WHERE g.status = 'final'
  GROUP BY pp.pattern_name
  ORDER BY accuracy DESC
`);

// Player performance trends
const trends = await pgPool.query(`
  WITH player_games AS (
    SELECT 
      ps.*,
      g.start_time,
      ROW_NUMBER() OVER (PARTITION BY ps.player_id ORDER BY g.start_time DESC) as game_num
    FROM player_stats ps
    JOIN games g ON ps.game_id = g.id
    WHERE ps.player_id = $1
  )
  SELECT 
    *,
    AVG(stat_value) OVER (ORDER BY start_time ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) as last_5_avg
  FROM player_games
  WHERE game_num <= 20
`, [playerId]);
```

---

## Unified Sports Data Service

The unified service (`lib/services/unified-sports-data.ts`) combines all APIs into a single interface:

### Key Methods

```typescript
import { sportsData } from './lib/services/unified-sports-data';

// Database Operations
await sportsData.getRecentGames('NBA', 10);
await sportsData.getPlayerStatsByESPNId('espn_nba_3975');
await sportsData.runPatternAnalysis(gameId);

// Live API Data
await sportsData.fetchNBAGamesToday();
await sportsData.fetchMLBGamesToday();
await sportsData.getAllGamesToday(); // Combines all sports

// Advanced Analytics
await sportsData.getPlayerPerformanceTrends(espnId, 10);
await sportsData.getTeamMatchupHistory(team1, team2);

// Data Sync
await sportsData.syncGamesToDatabase(games);
```

### Usage Example
```typescript
// Get all games today and analyze patterns
const todaysGames = await sportsData.getAllGamesToday();
console.log(`Found ${todaysGames.length} games today`);

// Sync to database
const syncResults = await sportsData.syncGamesToDatabase(todaysGames);

// Run pattern analysis on each game
for (const game of todaysGames) {
  const patterns = await sportsData.runPatternAnalysis(game.id);
  if (patterns.length > 0) {
    console.log(`Game ${game.id}: ${patterns.length} patterns detected`);
  }
}
```

---

## Common Operations

### 1. Get Today's Betting Opportunities
```typescript
async function getTodaysBets() {
  // Get all games
  const games = await sportsData.getAllGamesToday();
  
  // Check patterns for each
  const opportunities = [];
  for (const game of games) {
    const patterns = await sportsData.runPatternAnalysis(game.id);
    const highConfidence = patterns.filter(p => p.confidence_score > 0.7);
    
    if (highConfidence.length > 0) {
      opportunities.push({
        game,
        patterns: highConfidence,
        bestBet: highConfidence[0]
      });
    }
  }
  
  return opportunities;
}
```

### 2. Track Player Performance
```typescript
async function trackPlayer(espnId: string) {
  // Get recent stats
  const stats = await sportsData.getPlayerStatsByESPNId(espnId);
  
  // Get performance trends
  const trends = await sportsData.getPlayerPerformanceTrends(espnId, 10);
  
  // Calculate averages
  const last5Games = trends.slice(0, 5);
  const avgPoints = last5Games.reduce((sum, g) => sum + g.points, 0) / 5;
  
  return {
    recentStats: stats[0],
    last5Average: avgPoints,
    trend: trends[0].points > avgPoints ? 'improving' : 'declining'
  };
}
```

### 3. Pattern Detection
```typescript
async function detectPatterns() {
  // Get recent games
  const games = await sportsData.getRecentGames(undefined, 100);
  
  // Run pattern detection
  const allPatterns = [];
  for (const game of games) {
    const patterns = await sportsData.runPatternAnalysis(game.id);
    allPatterns.push(...patterns);
  }
  
  // Group by pattern type
  const patternStats = {};
  allPatterns.forEach(p => {
    if (!patternStats[p.pattern_name]) {
      patternStats[p.pattern_name] = {
        count: 0,
        totalConfidence: 0,
        wins: 0
      };
    }
    patternStats[p.pattern_name].count++;
    patternStats[p.pattern_name].totalConfidence += p.confidence_score;
    if (p.result === 'win') patternStats[p.pattern_name].wins++;
  });
  
  return patternStats;
}
```

---

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```
   Error: connect ENETUNREACH
   ```
   **Solution:** Add SSL configuration:
   ```typescript
   ssl: { rejectUnauthorized: false }
   ```

2. **Column Does Not Exist**
   ```
   Error: column games.game_date does not exist
   ```
   **Solution:** Use correct column names:
   - `start_time` instead of `game_date`
   - `home_team_id` instead of `home_team`
   - Check schema with test-db-schema.ts

3. **API Rate Limiting**
   - BallDontLie: 30 requests/minute
   - MLB API: No official limit but be respectful
   - Solution: Implement caching and request throttling

4. **Missing Data**
   - Always check if data exists before using
   - Use optional chaining: `data?.length`
   - Provide fallback values

### Debug Commands

```bash
# Check database schema
npx tsx scripts/test-db-schema.ts

# Test individual API
npx tsx -e "import { ballDontLieApi } from './scripts/direct-api-access'; console.log(await ballDontLieApi.get('/teams'));"

# Check table counts
npx tsx -e "import { supabase } from './scripts/direct-api-access'; const { count } = await supabase.from('games').select('*', { count: 'exact', head: true }); console.log('Games:', count);"
```

---

## API Keys & Credentials

### Current Active Keys
```typescript
// Supabase
const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbG...'; // Service role key

// Sports APIs
const BALLDONTLIE_API_KEY = '59de4292-dfc4-4a8a-b337-1e804f4109c6';
// MLB API - No key required

// Database
const POSTGRES_URL = 'postgresql://postgres:PASSWORD@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres';

// AI Services (when needed)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
```

### Security Notes
1. Never commit API keys to git
2. Use environment variables in production
3. Rotate keys regularly
4. Use read-only keys when possible

---

## Next Steps

1. **Set up caching** with Redis for API responses
2. **Create scheduled jobs** to sync data automatically
3. **Build real-time websocket** connections for live updates
4. **Implement betting APIs** (DraftKings, FanDuel) when ready
5. **Add monitoring** for API usage and errors

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the test scripts in `/scripts`
3. Check API documentation:
   - [BallDontLie Docs](https://docs.balldontlie.io)
   - [MLB Stats API Docs](https://statsapi.mlb.com/docs/)
   - [Supabase Docs](https://supabase.com/docs)

---

**Last Updated:** January 14, 2025
**System Version:** Fantasy AI Pattern Empire v2.0