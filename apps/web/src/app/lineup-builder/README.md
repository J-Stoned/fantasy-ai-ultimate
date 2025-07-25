# 🎯 Lineup Builder

A user-friendly DFS lineup builder that simplifies the complex optimization features for regular users while maintaining powerful functionality.

## Features

### 🚀 One-Click Optimization
- **"Optimize For Me!" Button**: Instant lineup optimization with smart defaults
- **Contest Type Selection**: GPP, Cash Games, and Tournaments
- **Risk Level Control**: Conservative, Balanced, or Aggressive strategies
- **Real-time Progress**: Live optimization updates with streaming responses

### 🎨 Beautiful Interface
- **Visual Salary Cap Tracking**: Progress bar with remaining budget display
- **Player Cards**: Rich player information with projections and ownership
- **Drag & Drop**: Reorder lineup players easily
- **Responsive Design**: Works perfectly on mobile and desktop

### 🔍 Smart Player Pool
- **Advanced Filtering**: Search by name, position, team, salary, ownership
- **Real-time Data**: Live projections and ownership updates
- **Value Ratings**: Points per $1000 salary calculations
- **Injury Status**: Clear injury indicators and risk assessments

### ⚡ Stack Building
- **QB-WR Stacks**: Automatic correlation detection
- **RB-DST Stacks**: Positive game script opportunities
- **Game Stacks**: High-scoring game identification
- **Custom Stacks**: Flexible stacking recommendations

### 📊 Analytics & Insights
- **Leverage Scores**: Find low-owned, high-upside plays
- **Chalk Analysis**: Identify over-owned players to fade
- **Ownership Projections**: Make informed contrarian decisions
- **Value Analysis**: Maximize points per dollar spent

### 💾 Export & Integration
- **CSV Export**: Compatible with DraftKings and FanDuel mass entry
- **Multiple Lineups**: Generate and manage multiple optimized lineups
- **Platform Specific**: Tailored for each DFS platform's scoring
- **Contest Ready**: Lineup validation and optimization

## API Endpoints

### `/api/lineup-builder/players`
- **Method**: GET
- **Parameters**: `sport`, `platform`
- **Returns**: Enhanced player pool with projections, ownership, and value metrics

### `/api/lineup-builder/optimize`
- **Method**: POST
- **Body**: Settings, locked players, current lineup
- **Returns**: Streaming optimization progress and results

### `/api/lineup-builder/stacks`
- **Method**: POST
- **Body**: Sport, stack type, current lineup
- **Returns**: Correlated player recommendations

## Supported Sports & Platforms

### Sports
- 🏈 **NFL**: 9-player lineups with FLEX positions
- 🏀 **NBA**: 8-player lineups with utility spots
- ⚾ **MLB**: Pitcher and hitter combinations
- 🏒 **NHL**: Center, wing, defense, goalie setups

### Platforms
- **DraftKings**: $50K salary cap, specific scoring rules
- **FanDuel**: $60K salary cap, simplified positions

## Technology Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **UI Components**: Radix UI primitives with custom styling
- **Animations**: Framer Motion for smooth interactions
- **Charts**: Recharts for analytics visualization
- **Optimization**: Custom knapsack algorithm with correlation scoring
- **Real-time**: Server-sent events for live progress updates

## User Experience

### For Beginners
- **Simplified Interface**: Hide complex settings by default
- **Smart Defaults**: Automatically configure based on contest type
- **Guided Experience**: Clear instructions and helpful tooltips
- **Error Prevention**: Salary cap validation and lineup requirements

### For Experts
- **Advanced Mode**: Access to detailed optimization parameters
- **Player Locking**: Lock specific players for targeted builds
- **Multiple Strategies**: Conservative, balanced, and aggressive approaches
- **Stack Analysis**: Deep correlation and narrative factor analysis

## Performance

- **Fast Loading**: Sub-2 second initial page load
- **Real-time Updates**: <100ms optimization progress updates
- **Efficient Algorithms**: Optimized knapsack solver with correlation bonuses
- **Responsive UI**: Smooth interactions on all device sizes

## Future Enhancements

- **Machine Learning**: Player projection improvements
- **Live Scoring**: Real-time contest tracking
- **Social Features**: Share lineups and strategies
- **Advanced Analytics**: Deeper statistical analysis
- **Mobile App**: Native iOS/Android applications