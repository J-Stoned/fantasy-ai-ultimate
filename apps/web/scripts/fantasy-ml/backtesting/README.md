# 🏆 Fantasy Sports Historical Backtesting System

## Overview

This comprehensive backtesting system provides institutional-quality evidence of our fantasy sports ML system's performance across 7 years of historical data (2018-2025) for all major DFS sports.

## Features

### 🔥 Historical Data Processing
- **Multi-Sport Support**: NFL, NBA, MLB, NHL
- **Date Range**: 2018-2025 (7 years of data)
- **Slate Processing**: Daily slates with games, players, injuries, weather, ownership
- **Data Enrichment**: Historical ownership projections, contest results, weather data

### 💰 Bankroll Simulation
- **Starting Capital**: $10,000 per sport
- **Kelly Criterion**: Optimal position sizing based on edge and confidence
- **Risk Management**: Maximum 20% daily exposure with circuit breakers
- **Contest Selection**: Balanced portfolio of Cash (40%), Single Entry (40%), GPP (20%)

### 🧠 Rolling Window Model Training
- **Training Windows**: 12-month rolling windows with 3-month forward testing
- **Feature Engineering**: 40+ sport-specific features including vegas data, trends, weather
- **Ensemble Models**: Neural networks, gradient boosting, random forests
- **GPU Optimization**: RTX 4060 accelerated training for fast processing

### 📊 Performance Analysis
- **Risk Metrics**: Sharpe ratio, Sortino ratio, Calmar ratio, max drawdown
- **Trading Metrics**: Win rate, profit factor, expectancy, contest-specific performance
- **Sport-Specific Analysis**: Seasonal patterns, day-of-week performance, slate analysis
- **Model Performance**: Prediction accuracy, ownership accuracy, value identification

## Usage

### Quick Start
```bash
# Run a quick backtest for NFL 2023-2025
npm run fantasy:backtest:quick

# Run full backtest for all sports 2018-2025
npm run fantasy:backtest:full

# Generate performance reports
npm run fantasy:backtest:analyze
```

### Custom Configuration
```typescript
const config: BacktestConfig = {
  sports: ['NFL', 'NBA', 'MLB', 'NHL'],
  startYear: 2018,
  endYear: 2025,
  startingBankroll: 10000,
  useKellyCriterion: true,
  maxDailyExposure: 0.2,
  trainModels: true,
  generateReports: true
};
```

## Architecture

### Directory Structure
```
backtesting/
├── processors/          # Historical data processing
├── simulation/         # Bankroll simulation engine
├── training/           # ML model training pipelines
├── analysis/           # Performance analysis tools
├── reports/            # Generated performance reports
└── schema/             # Database schema for results
```

### Key Components

1. **HistoricalDataProcessor**: Loads and enriches historical slate data
2. **BankrollSimulator**: Simulates daily contest entry with Kelly sizing
3. **RollingWindowTrainer**: Trains ML models with rolling windows
4. **PerformanceAnalyzer**: Generates comprehensive performance metrics

## Database Schema

The system uses PostgreSQL tables to store:
- Historical slates with enriched data
- Model training checkpoints
- Backtest results by contest
- Bankroll history tracking
- Performance metrics summaries

Run the schema creation:
```bash
psql -U postgres -d sports_betting_dev -f backtesting/schema/backtest-tables.sql
```

## Performance Metrics

### Expected Outputs
- **Total Return**: Dollar profit/loss over the period
- **ROI**: Return on investment percentage
- **Sharpe Ratio**: Risk-adjusted returns (target > 1.5)
- **Max Drawdown**: Largest peak-to-trough decline
- **Win Rate**: Percentage of profitable contests
- **Model Accuracy**: Prediction accuracy for player points

### Report Generation
Reports are generated in both Markdown and JSON formats:
- Individual sport reports with detailed metrics
- Combined portfolio analysis across all sports
- Model performance tracking over time
- Feature importance rankings

## Integration with Existing Systems

### GPU Optimizer
```typescript
// Uses existing GPU optimizer for lineup generation
const lineup = await this.gpuOptimizer.optimizeLineup({
  sport: slate.sport,
  players: slate.players,
  strategy: lineupType.type,
  constraints: this.getSportConstraints(slate.sport)
});
```

### ML Models
- Integrates with existing trained models
- Uses same feature engineering pipeline
- Leverages GPU acceleration for predictions

### Risk Management
- Tests existing circuit breakers
- Validates fraud detection systems
- Simulates real-world constraints

## Running a Complete Backtest

1. **Ensure Database Connection**
   ```bash
   npm run test:db
   ```

2. **Train Models (Optional)**
   ```bash
   npm run ml:train-all
   ```

3. **Run Backtest**
   ```bash
   npm run fantasy:backtest:full
   ```

4. **View Reports**
   Reports are saved to `backtesting/reports/[sport]/`

## Expected Results

Based on our ML models and optimization strategy:
- **Target Sharpe Ratio**: > 1.5
- **Expected Annual Return**: 15-25%
- **Max Drawdown**: < 20%
- **Win Rate**: 55-60% (cash games), 15-20% (GPPs)

## Next Steps

After successful backtesting:
1. Deploy live trading system with proven strategies
2. Implement real-time monitoring and alerts
3. Continue model refinement with new data
4. Scale position sizes based on confidence levels

---

*This backtesting system provides bulletproof evidence of our fantasy sports ML system's performance before live deployment.*