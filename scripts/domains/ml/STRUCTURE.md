# Fantasy ML Directory Structure

## Production Directories

### `/config/`
Database and environment configuration
- `database.ts` - PostgreSQL and Supabase connection management

### `/models/`
ML models and predictors
- `index.ts` - Main model exports
- `multi-sport-predictor-10x.ts` - 10X enhanced multi-sport predictor
- `player-performance-predictor.ts` - Core player prediction engine
- `dfs-lineup-optimizer.ts` - DFS lineup optimization
- `prop-bet-analyzer.ts` - Player prop analysis
- `contest-selection-ai.ts` - Contest selection intelligence
- `multi-entry-optimizer.ts` - Multi-entry strategy optimization
- `ownership-projection-engine.ts` - Ownership projection system
- `/core/` - Base model implementations
- `/elite/` - Advanced ML models (LSTM, XGBoost, etc.)

### `/services/`
API and data services
- `fantasy-api-service.ts` - Main Fantasy API
- `dfs-data-collector.ts` - DFS data collection
- `injury-monitoring-system.ts` - Real-time injury tracking
- `live-weather-integration.ts` - Weather data service
- `realtime-lineup-scraper.ts` - Live lineup scraping
- `subscription-service.ts` - User subscription management
- `youtube-podcast-intelligence.ts` - Content analysis
- `quantile_regression_service.py` - Python ML service

### `/enrichment/`
ML enrichment data collectors
- `weather-data-collector.ts` - Weather impact analysis
- `referee-analytics-system.ts` - Referee/umpire tendencies
- `situational-performance-engine.ts` - Situational stats
- `mlb-umpire-integration.ts` - MLB umpire data

### `/scoring/`
Fantasy scoring engines
- `dfs-scoring-rules.ts` - Platform scoring rules
- `universal-fantasy-scoring-engine.ts` - Multi-platform scoring
- `ultra-bulk-fantasy-calculator.ts` - Bulk calculation engine
- `chunked-fantasy-calculator.ts` - Memory-efficient calculator
- Various optimization scripts

### `/training/`
Model training scripts
- `sport-trainer-10x.ts` - Main training pipeline
- `universal-median-trainer.ts` - Median-based training
- `xgboost-historical-trainer.ts` - XGBoost training
- Sport-specific trainers (NBA, NFL, etc.)
- `/data/` - Training data files

### `/database/`
Database maintenance and optimization
- `10x-fast-duplicate-remover.ts` - Duplicate removal
- `10x-index-creator.ts` - Index optimization
- `10x-position-standardizer.ts` - Position normalization
- Various data quality scripts

### `/utils/`
Utility functions and helpers

## Main Entry Points

- `start-fantasy-api.ts` - Start the Fantasy API server
- `run-ml-pipeline.ts` - Run complete ML pipeline
- `deploy-mvp.ts` - Deploy MVP version
- `create-sport-views.ts` - Create database views
- `ultimate-db-cleanup.ts` - Database maintenance

## Archive Directory

`/archive/` contains old versions, test files, and deprecated scripts. These are kept for reference but are not part of the active codebase.

## Data Flow

1. **Collection**: Services collect raw data
2. **Enrichment**: Enrichment modules add ML features
3. **Training**: Training scripts build models
4. **Prediction**: Models generate predictions
5. **Optimization**: DFS optimizer creates lineups
6. **API**: Fantasy API serves predictions

## Quick Start

```bash
# Start API
npm run fantasy:start-api

# Run ML pipeline
npm run fantasy:pipeline

# Train models
npm run fantasy:train
```