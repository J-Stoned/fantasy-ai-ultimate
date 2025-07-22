# 🏆 Fantasy Sports ML System

Multi-sport machine learning system for fantasy sports predictions.

## 🚀 Quick Start

```bash
# 1. Test database connection
npm run fantasy:db

# 2. Create data views  
npx tsx create-sport-views.ts

# 3. Start Fantasy API
npm run fantasy:start-api

# 4. Run ML pipeline
npm run fantasy:pipeline

# 5. Train models
npx tsx training/sport-trainer-10x.ts
```

## 📊 Sports Coverage

- **NFL**: 25,095 players, 86.1% accuracy
- **NBA**: 702 players, R² = 0.548
- **MLB**: 3,362 players, 168K training samples
- **NHL**: 790 players, 57.4% accuracy
- **NCAA**: Basketball, Baseball, Football, Hockey

## 🏗️ Architecture

**📁 See [STRUCTURE.md](./STRUCTURE.md) for complete directory organization**

### Production Directories:
- `/config/` - Database and environment configuration
- `/models/` - ML models and predictors (10X enhanced)
- `/services/` - APIs and data services
- `/enrichment/` - ML feature enrichment (weather, refs, etc.)
- `/training/` - Model training pipelines
- `/scoring/` - Fantasy scoring engines (6 platforms)
- `/database/` - Database optimization tools

### Archived:
- `/archive/` - Old versions and test files (147 files archived)

## 🎯 Features

- **Player Predictions**: Projected points with floor/ceiling
- **Consistency Scoring**: 0-100% reliability rating
- **Trend Analysis**: UP/DOWN/STABLE performance tracking
- **Sport-Specific**: Handles DK/FD/Yahoo scoring systems
- **No TensorFlow**: Pure TypeScript for Windows compatibility

## 📈 Model Performance

 < /dev/null |  Sport | MAE    | Accuracy | R²    | Samples |
|-------|--------|----------|-------|---------|
| NFL   | 1.29   | 86.1%    | -0.05 | 13,229  |
| NBA   | 6.09   | 39.6%    | 0.548 | 9,752   |
| MLB   | 3.45   | 53.1%    | NaN   | 168,825 |
| NHL   | 3.34   | 57.4%    | 0.154 | 10,831  |

## 🔧 Database Views

- `v_nfl_player_stats`: NFL stats with fantasy calculations
- `v_nba_player_stats`: NBA/NCAA_BB with DraftKings scoring
- `v_mlb_player_stats`: Baseball stats (batting/pitching)
- `v_nhl_player_stats`: Hockey stats with DK scoring
- `v_ml_player_features`: Unified ML training features

## 💡 Usage Example

```typescript
import { createPredictor } from './models/multi-sport-predictor';

// Create sport-specific predictor
const nflPredictor = createPredictor('NFL');

// Get player prediction
const prediction = await nflPredictor.predictPlayer('player-id');
console.log(`Projected: ${prediction.projectedPoints} pts`);
console.log(`Floor/Ceiling: ${prediction.floor}-${prediction.ceiling}`);
console.log(`Recommendations: ${prediction.recommendations}`);

// Get top players by position
const topQBs = await nflPredictor.getTopPlayers('QB', 10);
```
