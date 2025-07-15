# 🏆 FREE SPORTS API GUIDE

## 📊 Current API Options for Real Data Collection

### ✅ WORKING FREE APIs

#### 1. **MLB Stats API** (statsapi.mlb.com)
- **Status**: ✅ FULLY WORKING
- **Auth**: None required!
- **Limits**: Unlimited (be reasonable)
- **Data**: Games, scores, complete player stats
- **Scripts**: 
  - `collect-mlb-2024-games.ts` - Collect games
  - `collect-mlb-2024-stats.ts` - Collect player stats
- **Success**: 1,200 games + 10,379 stats collected!

#### 2. **ESPN API** (site.api.espn.com)
- **Status**: ⚠️ PARTIALLY WORKING
- **Auth**: None required
- **Limits**: Reasonable use
- **Data**: Games, scores, limited stats
- **Issues**: 
  - NBA: No detailed player stats in boxscores
  - NFL: Works for games and basic stats
- **Scripts**:
  - `collect-nba-espn.ts` - Games only
  - `collect-nfl-espn-2024.ts` - Games + basic stats

### 🔑 APIS REQUIRING FREE KEYS

#### 3. **The Odds API** (the-odds-api.com)
- **Status**: ✅ WORKING WITH KEY
- **Free Tier**: 500 requests/month
- **Sign Up**: https://the-odds-api.com
- **Data**: Games, scores, betting odds
- **Script**: `collect-nba-odds-api.ts`
- **Note**: Good for games/scores, no player stats

#### 4. **RapidAPI Sports** (rapidapi.com)
- **Status**: ✅ WORKING WITH KEY
- **Free Tiers Available**:
  - API-NBA: 100 requests/day
  - API-NFL: 100 requests/day
  - API-Football: 100 requests/day
- **Sign Up**: https://rapidapi.com
- **Scripts**: 
  - `collect-nba-rapidapi.ts`
  - Create similar for NFL
- **Data**: Games, complete player stats

#### 5. **BallDontLie** (balldontlie.io)
- **Status**: ❌ API CHANGED
- **Issue**: Now requires authentication
- **Previous**: Was completely free
- **Alternative**: Use RapidAPI NBA instead

### 🚀 RECOMMENDED APPROACH

1. **MLB Data**: ✅ Use MLB Stats API (no key needed!)
   ```bash
   npx tsx scripts/collect-mlb-2024-games.ts
   npx tsx scripts/collect-mlb-2024-stats.ts
   ```

2. **NBA Data**: 🔑 Get RapidAPI key
   ```bash
   # 1. Sign up at https://rapidapi.com
   # 2. Subscribe to API-NBA (free tier)
   # 3. Update key in script
   npx tsx scripts/collect-nba-rapidapi.ts
   ```

3. **NFL Data**: ✅ Use ESPN API
   ```bash
   npx tsx scripts/collect-nfl-espn-2024.ts
   ```

### 📈 CURRENT DATABASE STATUS

```sql
-- MLB: ✅ REAL DATA
SELECT COUNT(*) FROM games WHERE sport = 'MLB';       -- 1,791 games
SELECT COUNT(*) FROM mlb_stats;                       -- 124,518 stats
SELECT COUNT(*) FROM mlb_players;                     -- 1,283 players

-- NBA: ⚠️ GAMES ONLY (need stats)
SELECT COUNT(*) FROM games WHERE sport = 'NBA';       -- 6,519 games
SELECT COUNT(*) FROM player_stats WHERE sport = 'NBA'; -- 0 stats

-- NFL: ⚠️ LIMITED DATA
SELECT COUNT(*) FROM games WHERE sport = 'NFL';       -- 2,169 games
SELECT COUNT(*) FROM player_stats WHERE sport = 'NFL'; -- 0 stats
```

### 🎯 ACTION PLAN

1. **Immediate** (No API Key):
   - ✅ Continue collecting MLB data (working great!)
   - ✅ Collect NFL games via ESPN

2. **With Free API Keys**:
   - 🔑 RapidAPI: Best for NBA/NFL player stats
   - 🔑 The Odds API: Good for games + betting data

3. **Data Priority**:
   - MLB: ✅ Already collecting successfully
   - NBA: Need player stats (use RapidAPI)
   - NFL: Need player stats (use RapidAPI or ESPN)

### 💡 PRO TIPS

1. **Rate Limiting**: 
   - Always add delays between requests
   - Use concurrent limits (3-5 for free tiers)
   - Monitor API usage quotas

2. **Batch Processing**:
   - Insert 1000+ records at once
   - Use buffers to accumulate data
   - Flush periodically

3. **Error Handling**:
   - Retry failed requests
   - Skip and continue on errors
   - Log failed items for retry

4. **Free Tier Management**:
   - RapidAPI: 100/day = collect strategically
   - The Odds API: 500/month = ~16/day
   - Plan collection schedule

### 🔥 MEGA BATCH FORMULA

```typescript
const CONFIG = {
  CONCURRENT_OPS: CPU_CORES * 3,  // Max parallelism
  DB_INSERT_BATCH: 1000,           // Mega batches!
  API_RATE_LIMIT: 100,             // Respect limits
  BUFFER_FLUSH_SIZE: 5000          // Buffer size
};
```

### 📝 NEXT STEPS

1. Get free API keys from:
   - https://rapidapi.com (NBA/NFL stats)
   - https://the-odds-api.com (games/odds)

2. Update scripts with your keys

3. Run collectors:
   ```bash
   # MLB (no key needed!)
   npx tsx scripts/collect-mlb-2024-stats.ts
   
   # NBA (after getting RapidAPI key)
   npx tsx scripts/collect-nba-rapidapi.ts
   
   # NFL (works now!)
   npx tsx scripts/collect-nfl-espn-2024.ts
   ```

### 🏁 GOAL

Fill the database with REAL data:
- ✅ MLB: 2,000+ games, 150K+ stats
- 🎯 NBA: 1,000+ games, 100K+ stats  
- 🎯 NFL: 500+ games, 50K+ stats

**We have the infrastructure. We just need the API keys!**