# Sport-Specific Stats Analysis for Fantasy AI

## Overview
Based on the codebase analysis, here's how different sports store their stats in the `player_stats` table and the implications for ML modeling.

## 1. Data Storage Structure

### Current Schema
The `player_stats` table uses a flexible key-value structure:
- `stat_type`: The type of statistic (e.g., "points", "rebounds", "passing_yards")
- `stat_value`: The numeric value of the statistic
- `player_id`: Reference to the player
- `game_id`: Reference to the game
- `fantasy_points`: Calculated fantasy points (sport-specific)

### Stat Type Naming Conventions
From the diagnostic script analysis, common stat types include:
- **Basketball (NBA)**: points, rebounds, assists, steals, blocks, turnovers, minutes, fieldGoals, threePointers, freeThrows, plusMinus, fouls
- **Football (NFL)**: passing_yards, passing_touchdowns, rushing_yards, receiving_yards, receptions, interceptions, fumbles
- **Baseball (MLB)**: hits, runs, rbis, home_runs, batting_average, strikeouts, walks, stolen_bases, innings_pitched, earned_runs
- **Hockey (NHL)**: goals, assists, points, plusMinus, shots, saves, hits, faceoffWins, timeOnIce

## 2. Sport-Specific Fantasy Point Calculations

### NBA (Basketball)
**DraftKings Scoring:**
- Points: 1 point
- Rebounds: 1.25 points
- Assists: 1.5 points
- Steals: 2 points
- Blocks: 2 points
- Turnovers: -0.5 points
- 3-Pointers: 0.5 bonus points
- Double-Double: 1.5 bonus points
- Triple-Double: 3 bonus points

### NFL (Football)
**DraftKings PPR Scoring:**
- Passing Yards: 0.04 points per yard
- Passing TDs: 4 points
- Interceptions: -1 point
- Rushing Yards: 0.1 points per yard
- Rushing TDs: 6 points
- Receptions: 1 point (PPR)
- Receiving Yards: 0.1 points per yard
- Receiving TDs: 6 points
- Fumbles Lost: -1 point

### MLB (Baseball)
**DraftKings Scoring:**
**Hitters:**
- Single: 3 points
- Double: 5 points
- Triple: 8 points
- Home Run: 10 points
- RBI: 2 points
- Run: 2 points
- Walk: 2 points
- Stolen Base: 5 points
- Caught Stealing: -2 points

**Pitchers:**
- Win: 4 points
- Strikeout: 2 points
- Innings Pitched: 2.25 points
- Earned Run: -2 points
- Hit Allowed: -0.6 points

### NHL (Hockey)
**Standard Scoring:**
- Goals: 3 points
- Assists: 2 points
- Shots on Goal: 0.5 points
- Blocked Shots: 0.5 points
- Plus/Minus: +/- 1 point

## 3. Key Differences Between Sports

### Statistical Categories
1. **NBA**: Focuses on counting stats (points, rebounds, assists) and efficiency metrics
2. **NFL**: Position-specific stats (QB passing vs RB rushing vs WR receiving)
3. **MLB**: Split between batting and pitching statistics
4. **NHL**: Combination of offensive production and defensive metrics

### Game Frequency & Sample Size
- **NBA**: 82 games per season (high sample size)
- **NFL**: 17 games per season (low sample size, high variance)
- **MLB**: 162 games per season (very high sample size)
- **NHL**: 82 games per season (high sample size)

### Position Considerations
- **NBA**: 5 positions but increasingly positionless
- **NFL**: Highly specialized positions (QB, RB, WR, TE, K, DST)
- **MLB**: Batters vs Pitchers (completely different stat sets)
- **NHL**: Forwards, Defensemen, Goalies (different scoring systems)

## 4. ML Model Implications

### Need for Separate Models?
**YES - Separate models are recommended for each sport due to:**

1. **Different Feature Sets**: Each sport has unique statistics that don't translate
2. **Different Scoring Systems**: Fantasy point calculations vary significantly
3. **Different Game Dynamics**: Pace, scoring frequency, and variance differ
4. **Different Sample Sizes**: NFL's small sample vs MLB's large sample requires different approaches

### Recommended Architecture

```
Fantasy AI ML System
├── Sport-Specific Models
│   ├── NBA Model
│   │   ├── Player Performance Predictor
│   │   ├── Matchup Analyzer
│   │   └── Injury Impact Calculator
│   ├── NFL Model
│   │   ├── Position-Specific Predictors
│   │   ├── Weather Impact Model
│   │   └── Game Script Predictor
│   ├── MLB Model
│   │   ├── Batter vs Pitcher Matchup
│   │   ├── Park Factor Adjuster
│   │   └── Pitching Rotation Tracker
│   └── NHL Model
│       ├── Line Combination Analyzer
│       ├── Goalie Matchup Model
│       └── Power Play Predictor
└── Shared Components
    ├── Data Pipeline
    ├── Feature Engineering
    └── Model Evaluation
```

### Multi-Sport Super Model Approach
The codebase includes a "multi-sport super model" that:
- Uses sport-specific feature extraction
- Normalizes scores by average sport scoring
- Includes sport indicator features (one-hot encoding)
- Maintains separate team statistics per sport

## 5. Current Implementation Status

### Data Coverage (from analysis)
- **Total Stats Records**: 3.6M+
- **Player Game Logs**: 250K+ with complete stats
- **Games with Scores**: 48,863 across all sports
- **ESPN ID Standardization**: Complete with `espn_{sport}_{id}` format

### Existing ML Features
1. **Universal Features** (all sports):
   - Win rate differentials
   - Home/away performance
   - Recent form (last 5/10 games)
   - ELO ratings
   - Momentum calculations

2. **Sport-Specific Normalizations**:
   - Scoring normalized by sport average
   - Home advantage factors per sport
   - Position-specific handling for NFL

## 6. Recommendations

### Immediate Actions
1. **Create Sport-Specific Training Scripts**
   - Separate feature engineering per sport
   - Sport-specific validation metrics
   - Position-aware models for NFL/MLB

2. **Standardize Stat Types**
   - Map variations (e.g., "pts" → "points")
   - Create sport-specific stat validation
   - Add data quality checks per sport

3. **Implement Sport-Specific Features**
   - NBA: Pace factors, rest days
   - NFL: Weather data, divisional games
   - MLB: Pitcher handedness, park factors
   - NHL: Special teams performance

### Long-term Strategy
1. **Ensemble Approach**: Combine sport-specific models with meta-learner
2. **Cross-Sport Learning**: Transfer learning from high-sample sports (MLB/NBA) to low-sample (NFL)
3. **Real-time Adjustments**: Sport-specific in-game model updates
4. **DFS Optimization**: Platform-specific scoring (DraftKings vs FanDuel)

## Conclusion
The current system's flexible stat storage supports multi-sport data, but optimal ML performance requires sport-specific models due to fundamental differences in scoring, statistics, and game dynamics. The existing codebase provides a solid foundation with comprehensive data collection and standardized IDs, making it ready for sport-specific ML implementation.