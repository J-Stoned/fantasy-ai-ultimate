# Scripts - Domain-Driven Design Structure

This directory contains all scripts organized using Domain-Driven Design (DDD) principles for better maintainability and discoverability.

## Directory Structure

### 🏢 Domains
Core business domains, each with clear responsibilities:

- **`domains/player/`** - Player data collection, analysis, and management
- **`domains/game/`** - Game data processing and analysis  
- **`domains/stats/`** - Statistics collection, calculation, and validation
- **`domains/fantasy/`** - Fantasy sports scoring and optimization
- **`domains/ml/`** - Machine learning models and predictions
- **`domains/betting/`** - Sports betting lines and props analysis
- **`domains/infrastructure/`** - Database, cache, auth, and deployment

### 🔧 Shared
Common utilities and configurations:

- **`shared/adapters/`** - Sport-specific data adapters
- **`shared/utils/`** - Common utility functions
- **`shared/config/`** - Configuration files
- **`shared/types/`** - TypeScript type definitions

### 📦 Migrations
Database and data migration scripts:

- **`migrations/schema/`** - Database schema migrations
- **`migrations/data/`** - Data migration scripts
- **`migrations/cleanup/`** - Data cleanup and deduplication

### 🛠️ Tools
Development and operational tools:

- **`tools/diagnostics/`** - System diagnostic scripts
- **`tools/testing/`** - Test scripts and utilities
- **`tools/monitoring/`** - Monitoring and alerting scripts

## Quick Start

### Finding Scripts

1. **By Domain**: Navigate to the relevant domain folder
2. **By Function**: Check the README.md in each domain
3. **By Technology**: Look in shared/ for adapters and utilities

### Running Scripts

```bash
# Example: Run a player collector
npm run script scripts/domains/player/collectors/collect-nfl-players.ts

# Example: Run ML training
npm run script scripts/domains/ml/training/train-nfl-model.ts

# Example: Run database migration
npm run script scripts/migrations/schema/create-ml-tables.ts
```

## Domain Guidelines

Each domain follows these principles:

1. **Single Responsibility**: Each domain handles one business area
2. **Clear Boundaries**: No cross-domain dependencies
3. **Shared Code**: Common utilities in shared/ folder
4. **Documentation**: Each domain has its own README.md

## Migration Status

✅ Phase 1: Directory structure created
🚧 Phase 2: File migration in progress
⏳ Phase 3: Import updates pending
⏳ Phase 4: Duplicate removal pending
⏳ Phase 5: Domain indexes pending

## Contributing

When adding new scripts:

1. Identify the correct domain
2. Place in appropriate subdirectory
3. Update domain README.md
4. Use shared utilities when possible
5. Follow existing naming conventions