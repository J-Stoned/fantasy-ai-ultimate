# Advanced Trading Terminal Refactoring Plan

## Current Issues (1618 lines)
- Single massive component handling multiple responsibilities
- Mixed business logic and presentation
- Multiple domains in one file (metrics, contests, positions, risk)
- Hard to test and maintain

## Proposed Structure

### 1. Split by Domain

#### Types & Interfaces
```
types/
├── trading-metrics.ts      # RealTimeMetrics interface
├── contest-intelligence.ts # ContestIntelligence interface
├── trade-position.ts       # LiveTradePosition interface
├── lineup.ts              # TradeLineupPlayer interface
├── ownership.ts           # AdvancedOwnership interface
└── risk.ts                # RiskAlert interface
```

#### Hooks
```
hooks/
├── useRealTimeMetrics.ts   # Real-time metrics state & logic
├── useContestData.ts       # Contest intelligence logic
├── useLivePositions.ts     # Live position tracking
├── useRiskManagement.ts    # Risk alert management
└── useTradeSimulation.ts   # Trade simulation logic
```

#### Components
```
components/
├── TradingTerminal.tsx     # Main container (100-150 lines)
├── metrics/
│   ├── MetricsOverview.tsx     # Top metrics cards
│   ├── PerformanceChart.tsx    # Performance visualization
│   └── RiskIndicators.tsx      # Risk metrics display
├── contests/
│   ├── ContestIntelligence.tsx # Contest analysis view
│   ├── ContestRecommendations.tsx
│   └── ContestFilters.tsx
├── positions/
│   ├── LivePositionsTable.tsx  # Active positions
│   ├── PositionDetails.tsx     # Individual position
│   └── PositionChart.tsx       # Position visualization
├── portfolio/
│   ├── PortfolioAllocation.tsx # Portfolio breakdown
│   ├── PortfolioChart.tsx      # Allocation charts
│   └── PortfolioOptimizer.tsx  # Optimization controls
└── risk/
    ├── RiskDashboard.tsx       # Risk overview
    ├── RiskAlerts.tsx          # Alert management
    └── RiskMetrics.tsx         # Risk calculations
```

#### Services
```
services/
├── trading-metrics.service.ts  # Metrics calculations
├── contest-analysis.service.ts # Contest intelligence
├── risk-management.service.ts  # Risk calculations
└── portfolio.service.ts        # Portfolio optimization
```

### 2. Component Breakdown

#### Main Component (TradingTerminal.tsx)
```typescript
// ~150 lines - orchestrates sub-components
export function TradingTerminal() {
  const { metrics } = useRealTimeMetrics();
  const { contests } = useContestData();
  const { positions } = useLivePositions();
  const { alerts } = useRiskManagement();
  
  return (
    <div className="trading-terminal">
      <MetricsOverview metrics={metrics} />
      <Tabs defaultValue="contests">
        <TabsList>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>
        <TabsContent value="contests">
          <ContestIntelligence contests={contests} />
        </TabsContent>
        {/* Other tabs */}
      </Tabs>
    </div>
  );
}
```

### 3. Benefits of Refactoring

1. **Single Responsibility**: Each component has one clear purpose
2. **Testability**: Can unit test individual components
3. **Reusability**: Components can be used elsewhere
4. **Maintainability**: Easier to find and fix issues
5. **Performance**: Better code splitting and lazy loading
6. **Type Safety**: Centralized types improve consistency

### 4. Implementation Steps

1. Extract all interfaces to separate type files
2. Create custom hooks for business logic
3. Extract chart components
4. Extract table components
5. Extract card/metric components
6. Create service layer for calculations
7. Wire everything together in main component
8. Add unit tests for each component