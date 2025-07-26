# Domain-Driven Design Structure for Scripts

## Proposed Structure

```
scripts/
├── domains/
│   ├── player/              # Player domain
│   │   ├── collectors/      # Player data collection
│   │   ├── analyzers/       # Player analysis scripts
│   │   └── migrations/      # Player data migrations
│   │
│   ├── game/                # Game domain
│   │   ├── collectors/      # Game data collection
│   │   ├── processors/      # Game data processing
│   │   └── analyzers/       # Game analysis
│   │
│   ├── stats/               # Statistics domain
│   │   ├── collectors/      # Stats collection by sport
│   │   ├── calculators/     # Fantasy point calculations
│   │   ├── analyzers/       # Statistical analysis
│   │   └── validators/      # Data validation
│   │
│   ├── fantasy/             # Fantasy sports domain
│   │   ├── scoring/         # Fantasy scoring engines
│   │   ├── optimization/    # Lineup optimization
│   │   ├── dfs/            # Daily fantasy specific
│   │   └── traditional/     # Season-long fantasy
│   │
│   ├── ml/                  # Machine Learning domain
│   │   ├── training/        # Model training scripts
│   │   ├── models/          # ML model definitions
│   │   ├── prediction/      # Prediction services
│   │   └── enrichment/      # Data enrichment
│   │
│   ├── betting/             # Sports betting domain
│   │   ├── lines/           # Betting lines collection
│   │   ├── props/           # Player props
│   │   └── analysis/        # Betting analysis
│   │
│   └── infrastructure/      # Infrastructure domain
│       ├── database/        # Database operations
│       ├── cache/           # Caching strategies
│       ├── auth/            # Authentication
│       └── deployment/      # Deployment scripts
│
├── shared/                  # Shared utilities
│   ├── adapters/           # Sport-specific adapters
│   ├── utils/              # Common utilities
│   ├── config/             # Configuration
│   └── types/              # TypeScript types
│
├── migrations/             # Database migrations
│   ├── schema/            # Schema migrations
│   ├── data/              # Data migrations
│   └── cleanup/           # Cleanup scripts
│
└── tools/                  # Development tools
    ├── diagnostics/        # Diagnostic scripts
    ├── testing/            # Test scripts
    └── monitoring/         # Monitoring scripts
```

## Migration Plan

1. **Phase 1**: Create directory structure
2. **Phase 2**: Move files to appropriate domains
3. **Phase 3**: Update imports and references
4. **Phase 4**: Remove duplicates and obsolete files
5. **Phase 5**: Create domain indexes

## Benefits

- **Clear Boundaries**: Each domain has clear responsibilities
- **Easy Navigation**: Find scripts by their business purpose
- **Reduced Duplication**: Centralized shared utilities
- **Better Maintenance**: Easier to update domain-specific logic
- **Team Scalability**: New developers can understand structure quickly