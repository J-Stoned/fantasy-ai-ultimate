# 🎯 ML Enhancement Plan: Real Player Stats Integration

## Executive Summary
We've successfully implemented multi-sport data collection (NFL/NBA/MLB) and now need to use this data to improve ML predictions from current 51-56% accuracy to 60-65%.

## Current State (2025-07-03)

### ✅ What's Working
- Universal sports collector for NFL/NBA/MLB
- Enhanced schema with player_game_logs table
- 82,861 games in database
- Basic ML models with 51-56% accuracy

### ❌ What's Missing
- Player game logs are empty (only 1 test record)
- ML models use only 11 team-level features
- Training uses only 1,000 games (not 82,861)
- No player-level features in predictions

## Implementation Plan

### Phase 1: Populate Historical Player Data (CURRENT)
1. **Create Backfill Script**
   ```typescript
   // scripts/backfill-player-game-logs.ts
   - Query all completed games from last 2 seasons
   - For each game, fetch ESPN box scores
   - Extract player stats and store in player_game_logs
   - Track progress and handle rate limits
   ```

2. **Stats to Extract**
   - **NFL**: passing_yards, passing_tds, rushing_yards, receptions, fantasy_points
   - **NBA**: points, rebounds, assists, steals, blocks, minutes, plus_minus
   - **MLB**: batting_avg, home_runs, rbi, era, strikeouts, whip

### Phase 2: Enhanced Feature Engineering
1. **Player Features (New)**
   - Top 5 players' average fantasy points (last 3 games)
   - Star player availability (injury status)
   - Player momentum (performance vs season average)
   - Head-to-head player matchup history

2. **Team Features (Enhanced)**
   - Current 11 features PLUS:
   - Team injury report impact score
   - Weather-adjusted performance
   - Days of rest differential
   - Historical matchup data

3. **Game Context Features**
   - Time of season (early/mid/late)
   - Division/conference game flag
   - Prime time game indicator
   - Playoff implications score

### Phase 3: Advanced ML Models
1. **Update train-production-models.ts**
   ```typescript
   // Use ALL 82,861 games
   const games = await getGamesWithPlayerStats();
   
   // Expand to 30+ features
   const features = [
     ...teamFeatures,      // 11 existing
     ...playerFeatures,    // 10 new
     ...contextFeatures,   // 5 new
     ...injuryFeatures,    // 3 new
     ...weatherFeatures    // 2 new
   ];
   ```

2. **Implement Ensemble Model**
   - Neural Network: Complex pattern recognition
   - XGBoost: Feature interactions
   - Random Forest: Robustness
   - Weighted voting: Combine predictions

### Phase 4: Continuous Learning
1. **Prediction Tracking**
   - Store all predictions with confidence
   - Compare to actual outcomes
   - Calculate accuracy by sport/team/context

2. **Auto-Retraining**
   - Weekly model updates
   - Feature importance analysis
   - Dynamic weight adjustment

## Expected Accuracy Improvements

| Stage | Features | Accuracy | Notes |
|-------|----------|----------|-------|
| Current | 11 team stats | 51-56% | Limited by aggregated data |
| + Player Stats | 25 features | 58-62% | Individual performance matters |
| + Ensemble | 30+ features | 60-65% | Multiple models capture different patterns |
| + Betting Data | 35 features | 65-70% | Vegas has insider information |

## Technical Architecture

```
Data Collection Pipeline:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Universal       │────▶│ Schema Adapter   │────▶│ PostgreSQL      │
│ Sports Collector│     │ (handles formats)│     │ (stores all)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
ML Training Pipeline:                              ┌─────────────────┐
┌─────────────────┐     ┌──────────────────┐     │ Feature         │
│ Backfill Script │────▶│ Player Game Logs │────▶│ Engineering     │
│ (historical)    │     │ (detailed stats) │     │ (30+ features)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ Ensemble Models │
                                                  │ (NN+XGB+RF)     │
                                                  └─────────────────┘
```

## Implementation Timeline

### Week 1 (Current)
- [x] Create universal sports collector
- [x] Update schema for player stats
- [ ] Backfill 2 seasons of player data
- [ ] Test data quality and completeness

### Week 2
- [ ] Update feature engineering pipeline
- [ ] Modify training scripts for player stats
- [ ] Train initial models with new features
- [ ] Measure accuracy improvements

### Week 3
- [ ] Implement ensemble approach
- [ ] Set up continuous learning
- [ ] Deploy to production
- [ ] Monitor real-time performance

## Key Files to Modify

1. `/scripts/backfill-player-game-logs.ts` (CREATE)
2. `/scripts/train-production-models.ts` (UPDATE)
3. `/lib/ml/feature-engineering.ts` (CREATE)
4. `/scripts/production-continuous-learning.ts` (UPDATE)
5. `/lib/ml/ensemble-predictor.ts` (CREATE)

## Success Metrics

1. **Data Quality**
   - 90%+ games have player stats
   - Less than 5% missing data
   - Consistent across all sports

2. **Model Performance**
   - 60%+ accuracy on test set
   - Consistent across sports
   - Better than baseline (home team wins)

3. **Production Readiness**
   - <100ms prediction latency
   - Auto-retraining works
   - Monitoring in place

## Current TODO List
1. ⏳ Create historical data backfill script for player game logs
2. ⏹️ Enhance stat extraction for NFL/NBA/MLB player stats
3. ⏹️ Update train-production-models.ts to use player features
4. ⏹️ Expand feature engineering to 30+ features
5. ⏹️ Create ensemble model (NN + XGBoost + RF)
6. ⏹️ Implement continuous learning pipeline
7. ⏹️ Set up weekly model retraining

---
**Last Updated**: 2025-07-03
**Status**: Phase 1 - Backfilling Historical Data