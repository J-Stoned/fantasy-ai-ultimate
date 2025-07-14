# 🎯 FANTASY AI API QUICK REFERENCE

## Import Everything You Need
```typescript
import { sportsData } from './lib/services/unified-sports-data';
```

## Most Common Operations

### 1. Get Today's Games with Patterns
```typescript
const games = await sportsData.getAllGamesToday();
for (const game of games) {
  const patterns = await sportsData.runPatternAnalysis(game.id);
  console.log(`${game.homeTeam} vs ${game.awayTeam}:`, patterns);
}
```

### 2. Check Player Performance
```typescript
const stats = await sportsData.getPlayerStatsByESPNId('espn_nba_3975');
const trends = await sportsData.getPlayerPerformanceTrends('espn_nba_3975', 10);
```

### 3. Get NBA Games & Stats
```typescript
const nbaGames = await sportsData.fetchNBAGamesToday();
const playerStats = await sportsData.fetchNBAPlayerStats(237); // LeBron
```

### 4. Direct Database Query
```typescript
const { data } = await sportsData.supabase
  .from('pattern_predictions')
  .select('*')
  .gte('confidence_score', 0.7)
  .order('expected_value', { ascending: false });
```

## Test Commands
```bash
# Test everything works
npx tsx scripts/test-unified-sports-data.ts

# Test direct APIs
npx tsx scripts/direct-api-access.ts
```

## Database Tables
- `games` - Game data (30K+ records)
- `player_stats` - Player statistics (258K+ records)  
- `pattern_predictions` - Pattern analysis results
- `ml_predictions` - ML model predictions
- `players` - Player info (846K+ records)
- `teams` - Team info (224 records)

## API Limits
- **BallDontLie**: 30 requests/minute
- **MLB API**: No official limit
- **Supabase**: 1000 requests/hour
- **PostgreSQL**: Connection pool limit 10

## Pattern Types
1. **Back-to-Back Fade** - 76.8% accuracy
2. **Embarrassment Revenge** - 74.4% accuracy  
3. **Altitude Advantage** - 68.3% accuracy
4. **Perfect Storm** - 67.0% accuracy
5. **Division Dog Bite** - 58.6% accuracy

## Quick Debug
```bash
# Check DB connection
npx tsx scripts/test-db-schema.ts

# Count records
npx tsx -e "
import { sportsData } from './lib/services/unified-sports-data';
const { count: games } = await sportsData.supabase.from('games').select('*', { count: 'exact', head: true });
const { count: stats } = await sportsData.supabase.from('player_stats').select('*', { count: 'exact', head: true });
console.log('Games:', games, 'Stats:', stats);
"
```