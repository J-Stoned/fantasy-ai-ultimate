# ML Training Data Report

## Executive Summary

We have **1,144,750 total records** across all tables, but most ML-relevant tables are empty. The training scripts primarily use only 3 data sources: games, players, and news_articles.

## Detailed Record Counts

### 🏈 Core Game Data (929,809 records)
- **games**: 82,861 records ✅ (Good for training)
- **teams**: 224 records ⚠️ (Limited data)
- **players**: 846,724 records ✅ (Good for training)
- **player_stats**: 0 records ❌ (Empty - CRITICAL MISSING DATA)
- **team_stats**: 0 records ❌ (Empty - CRITICAL MISSING DATA)
- **game_stats**: 0 records ❌ (Empty)
- **game_events**: 0 records ❌ (Empty)

### 📰 Context Data (214,941 records)
- **news_articles**: 213,851 records ✅ (Good for training)
- **social_sentiment**: 1,087 records ⚠️ (Limited data)
- **betting_odds**: 3 records ❌ (Insufficient)
- **injuries**: 0 records ❌ (Empty - CRITICAL MISSING DATA)
- **weather_data**: 0 records ❌ (Empty - IMPORTANT MISSING DATA)
- **player_news**: 0 records ❌ (Empty)
- **team_news**: 0 records ❌ (Empty)
- **public_sentiment**: 0 records ❌ (Empty)

### 🤖 ML & Predictions (0 records)
- All ML tables are empty - this is expected as they store outputs

### Other Categories
- Voice, GPU, Real-time, and System tables: All empty (0 records)

## Current Training Data Usage

Based on analysis of training scripts:

### 1. **train-ml-models-gpu.ts**
- Uses: `games` (5,000 limit), `news_articles` (1,000 limit)
- Features extracted: 
  - Game scores, differentials, totals
  - Win/loss outcomes
  - Game timing (hour, day of week)
  - Basic sentiment from news titles

### 2. **continuous-learning-ai.ts**
- Uses: `games` only
- Saves predictions to: `ml_predictions`, `ml_models`

### 3. **train-production-models.ts**
- Uses: `games` (5,000 limit)
- Attempts to calculate team stats from historical games
- No player-level features due to missing `player_stats`

## Most Valuable Tables for Predictions

### Currently Available (Ranked by Value):
1. **games** (82,861 records) - Primary training source
2. **news_articles** (213,851 records) - Sentiment and context
3. **players** (846,724 records) - Player roster data only
4. **social_sentiment** (1,087 records) - Limited but useful
5. **teams** (224 records) - Basic team info

### Critical Missing Data:
1. **player_stats** - Individual player performance metrics
2. **injuries** - Injury reports affect game outcomes
3. **weather_data** - Weather impacts scoring
4. **team_stats** - Aggregated team performance
5. **betting_odds** - Market sentiment indicator

## Recommendations

### Immediate Actions:
1. **Fill player_stats table** - This is the most critical missing piece
2. **Populate injuries table** - Major impact on predictions
3. **Add weather_data** - Affects scoring in outdoor games
4. **Increase betting_odds** - Only 3 records is insufficient

### Data Collection Priority:
1. Player statistics (points, rebounds, assists, etc.)
2. Injury reports
3. Weather conditions for games
4. Team statistics aggregations
5. More betting odds data

### Model Improvements:
- Current models only use game-level features
- Adding player-level features could improve accuracy from ~66% to 80%+
- Weather and injuries could add another 5-10% accuracy

## Current Limitations

The ML models are severely limited by:
- No individual player performance data
- No injury information
- No weather data
- Minimal betting market data
- No team statistics beyond win/loss

This explains why current accuracy is capped around 66-67% despite having 82,861 games to train on.