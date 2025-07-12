# 🔮 Spatial Analytics Integration Guide

## Current Status ✅
The spatial analytics infrastructure is BUILT and INTEGRATED into the fantasy app:
- Database schema ready (6 tables)
- Backend analytics engine functional
- API endpoints created
- Frontend UI integrated
- Navigation links added

## What Makes It Functional NOW 🚀

### 1. **In the Lineup Optimizer**
- Toggle to enable/disable spatial analytics
- Spatial weight slider (0-1) to control influence
- Player cards show spatial projection bonuses
- Click players for detailed spatial breakdown
- Team-level metrics (spacing, synergy, coverage)

### 2. **Dedicated Spatial Analytics Page**
- Player analysis with xG projections
- Movement pattern visualization
- Pitch control heat maps
- Game-level spatial analysis

### 3. **API Integration**
All endpoints return data (currently mock data):
- `/api/spatial/player-projection/[playerId]`
- `/api/spatial/pitch-control/[gameId]`
- `/api/spatial/movement-patterns/[playerId]`
- `/api/spatial/lineup-optimizer`

## To Get REAL Data Flowing 📊

### Step 1: Apply Database Migration
```bash
# Run the migration script
npx tsx scripts/apply-spatial-migration.ts

# OR manually in Supabase SQL Editor:
# Copy contents of: supabase/migrations/20250112_spatial_analytics_tables.sql
```

### Step 2: Populate Initial Data
```bash
# Run the data collector to seed mock data
npx tsx scripts/spatial-data-collector.ts

# This will populate:
# - player_tracking_data (movement positions)
# - basketball_shots (for xG calculations)
# - football_routes (route patterns)
```

### Step 3: Connect Real Data Sources

#### Option A: NBA Stats API (Free Tier)
```typescript
// Update spatial-data-collector.ts with your API keys:
const NBA_API_KEY = process.env.NBA_API_KEY
const endpoint = `https://api.sportsdata.io/v3/nba/stats/json/PlayerGameStatsByDate/${date}?key=${NBA_API_KEY}`
```

#### Option B: SportRadar API (Paid)
```typescript
const SPORTRADAR_KEY = process.env.SPORTRADAR_API_KEY
const endpoint = `https://api.sportradar.com/nba/trial/v8/en/games/${gameId}/pbp.json?api_key=${SPORTRADAR_KEY}`
```

#### Option C: Web Scraping (Free but Limited)
```typescript
// Use the existing mega-data-collector pattern
// Scrape from ESPN, NBA.com for basic shot location data
```

### Step 4: Train the xG Model
```bash
# After collecting shot data:
npx tsx scripts/train-xg-model.ts

# This will:
# - Load all shots from basketball_shots table
# - Train logistic regression model
# - Save coefficients for real-time calculations
```

### Step 5: Schedule Regular Updates
```typescript
// Add to your cron jobs or use Supabase Edge Functions:
export const collectSpatialData = async () => {
  const collector = new SpatialDataCollector()
  
  // Run every game day
  await collector.collectNBATracking(todaysGameId)
  await collector.collectNBAShotData()
  
  // Recalculate patterns weekly
  await movementAnalyzer.updateAllPlayerPatterns()
}
```

## Integration Points in the App 🔌

### 1. **Pre-Game Analysis**
- Show historical movement patterns
- Display matchup-specific xG trends
- Highlight spatial advantages/disadvantages

### 2. **Live Game Updates**
- Real-time pitch control visualization
- Live xG tracking for each shot
- Movement efficiency metrics

### 3. **Post-Game Analysis**
- Actual vs Expected performance
- Space creation leaders
- Synergy scores for lineup combinations

### 4. **Season-Long Value**
- Track xG over/underperformers
- Identify improving movement patterns
- Find undervalued spatial creators

## Quick Start Commands 🚀

```bash
# 1. Apply migration
npx tsx scripts/apply-spatial-migration.ts

# 2. Seed demo data
npx tsx scripts/spatial-data-collector.ts

# 3. Test the system
npx tsx scripts/test-spatial-analytics.ts

# 4. View in app
npm run dev
# Navigate to: http://localhost:3000/spatial-analytics
# Or use in: http://localhost:3000/lineup-optimizer (toggle spatial on)
```

## API Usage Examples 💻

### Get Player's Spatial Projection
```typescript
const projection = await fantasyAPI.getSpatialProjection('player123')
// Returns enhanced projection with spatial bonuses
```

### Get Game Pitch Control
```typescript
const pitchControl = await fantasyAPI.getPitchControl('game123', timestamp)
// Returns grid data for visualization
```

### Optimize with Spatial
```typescript
const lineup = await fantasyAPI.optimizeWithSpatial({
  sport: 'NBA',
  format: 'dfs',
  includeSpatial: true,
  spatialWeight: 0.3
})
// Returns lineup with spatial synergies considered
```

## Monetization Opportunities 💰

### 1. **Spatial Analytics Pro Tier ($19.99/mo)**
- Advanced movement pattern library
- Custom xG model training
- Historical pitch control data
- API access for spatial data

### 2. **Team Spatial Reports ($4.99 each)**
- Detailed spatial scouting reports
- Matchup-specific advantages
- Downloadable PDF reports

### 3. **Live Spatial Alerts ($9.99/mo)**
- Real-time notifications for spatial anomalies
- "Player entering hot zone" alerts
- xG threshold notifications

## Next Level Features 🎯

1. **AR Visualization**: Show pitch control in AR on phone
2. **ML Pattern Discovery**: Auto-discover new winning patterns
3. **Spatial Betting Lines**: Create props based on spatial metrics
4. **Team Chemistry Optimizer**: Find best spatial fit players

## The Reality Check ✅

**What Works NOW:**
- UI shows spatial data (with mock data)
- Toggle affects lineup calculations
- API endpoints respond
- Visualizations render

**What Needs Real Data:**
- Actual player tracking coordinates
- Real shot location data
- Historical movement patterns
- Live game feeds

But the ENTIRE INFRASTRUCTURE is ready. Just add data! 🔥