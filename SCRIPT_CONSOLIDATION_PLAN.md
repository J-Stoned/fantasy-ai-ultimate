# Script Consolidation Plan: 714 → 80 Scripts

## Executive Summary
This plan outlines the consolidation of 714 scripts down to approximately 80 well-organized production scripts, achieving a 90% reduction in code maintenance overhead.

## Current State Analysis

### Redundancy Patterns Identified:
- **31 NBA collector variations** performing essentially the same task
- **66 coverage checking scripts** with "truth", "reality", "actual" variations
- **50+ speed-prefixed scripts** (turbo-, smart-, mega-, ultra-, ultimate-)
- **32 versioned scripts** (v2, v3, v4 variations)
- **40+ database check scripts** with overlapping functionality
- **50+ ML training scripts** with minor variations
- **30+ data loading scripts** doing similar operations

## Phase 1: Immediate Actions (Week 1)

### 1.1 New Directory Structure
```
scripts/
├── production/          # Only production-ready scripts
│   ├── collectors/      # Data collection (5 files)
│   ├── analysis/        # Coverage & analytics (4 files)
│   ├── ml/             # ML training & prediction (6 files)
│   ├── pattern/        # Pattern detection (6 files)
│   ├── api/            # API services (5 files)
│   ├── monitoring/     # Dashboards & monitoring (4 files)
│   └── database/       # DB operations (6 files)
├── utilities/          # Shared utilities (5 files)
├── testing/            # Test scripts (4 files)
├── experimental/       # Active development (keep minimal)
└── _archive/           # All deprecated scripts
```

### 1.2 Consolidation Targets

#### Data Collectors (150+ → 5)
**Create:** `universal-sports-collector.ts`
- Combines best features from:
  - `turbo-nba-collector.ts` (parallelization techniques)
  - `smart-mlb-collector.ts` (deduplication logic)
  - `mega-data-collector-v3.ts` (memory management)
  - `gpu-stats-collector/master-collector.ts` (GPU acceleration)

**Delete:** All sport-specific variants, speed-prefixed versions

#### Coverage Analyzers (66 → 4)
**Create:** `coverage-analyzer.ts`
- Parameterized for:
  - Sport type (NBA, NFL, MLB, NHL)
  - Coverage metric (stats, games, players)
  - Output format (console, json, csv)
  - Time range

**Delete:** All "truth", "reality", "actual", "fast", "accurate" variations

#### ML Training (50+ → 6)
**Keep only:**
- `production-ensemble-trainer.ts` (main production trainer)
- `gpu-accelerated-trainer.ts` (GPU-optimized training)
- `continuous-learning-service.ts` (auto-retraining)
- `pattern-trainer.ts` (pattern-specific training)
- `model-evaluator.ts` (performance testing)
- `feature-engineer.ts` (feature extraction)

**Archive:** All experimental trainers, numbered versions

## Phase 2: Script Migration (Week 1-2)

### 2.1 Production Scripts to Keep

#### Collectors (5 files):
1. `universal-sports-collector.ts` - Unified collector for all sports
2. `pattern-data-collector.ts` - Pattern-specific data collection
3. `real-time-collector.ts` - WebSocket integration
4. `backfill-orchestrator.ts` - Historical data collection
5. `espn-api-collector.ts` - Standardized ESPN interface

#### Analysis (4 files):
1. `coverage-analyzer.ts` - Comprehensive coverage analysis
2. `data-quality-validator.ts` - Data integrity checks
3. `stats-gap-analyzer.ts` - Identify missing data
4. `performance-analyzer.ts` - System performance metrics

#### ML/Pattern (6 files):
1. `production-ensemble-trainer.ts` - Main model training
2. `pattern-discovery-service.ts` - New pattern detection
3. `unified-pattern-api.ts` - Pattern API service
4. `lucey-compression-engine.ts` - Data compression
5. `continuous-learning-service.ts` - Auto-retraining
6. `prediction-service.ts` - Generate predictions

#### Production Services (5 files):
1. `master-control.ts` - System orchestration
2. `websocket-server.ts` - Real-time updates
3. `api-gateway.ts` - Unified API endpoint
4. `monitoring-dashboard.ts` - System monitoring
5. `betting-connector.ts` - Betting API integration

#### Database Operations (6 files):
1. `migration-runner.ts` - Schema migrations
2. `backup-restore.ts` - Backup operations
3. `schema-validator.ts` - Schema validation
4. `cleanup-utility.ts` - Data cleanup
5. `espn-id-standardizer.ts` - ID standardization
6. `connection-pool-manager.ts` - DB connections

### 2.2 Scripts to Archive (634 scripts)

#### Immediate Archive List:
- **All NBA-specific collectors** (31 files)
  - collect-nba-stats.ts
  - smart-nba-collector.ts
  - turbo-nba-collector.ts
  - ultra-fast-nba-collector.ts
  - surgical-nba-collector.ts
  - etc.

- **All coverage variations** (66 files)
  - check-true-coverage.ts
  - real-nba-coverage-truth.ts
  - nba-coverage-reality-check.ts
  - fast-nba-coverage.ts
  - accurate-nba-coverage.ts
  - etc.

- **All speed-prefixed scripts** (50+ files)
  - turbo-* scripts
  - smart-* scripts
  - mega-* scripts
  - ultra-* scripts
  - ultimate-* scripts

- **All versioned scripts except latest** (32 files)
  - *-v2.ts, *-v3.ts (keep only v4 or latest)

## Phase 3: Implementation Steps

### Week 1: Setup & Core Consolidation
Day 1-2:
- [x] Create new directory structure
- [ ] Build universal-sports-collector.ts
- [ ] Create coverage-analyzer.ts
- [ ] Set up _archive directory

Day 3-4:
- [ ] Consolidate ML training scripts
- [ ] Merge pattern detection variations
- [ ] Create unified debugging tool

Day 5:
- [ ] Move test scripts to testing/
- [ ] Archive obvious duplicates
- [ ] Initial testing of consolidated scripts

### Week 2: Production Migration
Day 1-2:
- [ ] Update all imports and references
- [ ] Modify master-control.ts for new structure
- [ ] Update API endpoints

Day 3-4:
- [ ] Comprehensive testing of all workflows
- [ ] Performance benchmarking
- [ ] Fix any broken dependencies

Day 5:
- [ ] Create migration documentation
- [ ] Final cleanup and archival
- [ ] Deploy to production

## Phase 4: Validation & Documentation

### Validation Checklist:
- [ ] All production workflows functional
- [ ] No data collection gaps
- [ ] Pattern detection APIs working
- [ ] ML training pipeline intact
- [ ] WebSocket connections stable
- [ ] Database operations normal
- [ ] Performance maintained or improved

### Documentation Updates:
1. Update CLAUDE.md with new script locations
2. Create comprehensive SCRIPT_GUIDE.md
3. Update README.md with new structure
4. Document consolidation mapping (old → new)
5. Create troubleshooting guide

## Expected Outcomes

### Before:
- 714 scripts (chaotic, redundant, unmaintainable)
- Difficult to find the right script
- Multiple versions of same functionality
- High maintenance overhead
- Confusion about production vs experimental

### After:
- ~80 scripts (organized, purposeful, production-ready)
- Clear directory structure
- Single source of truth for each function
- 90% reduction in maintenance
- Easy onboarding for new developers

### Benefits:
1. **Maintainability:** 90% fewer files to maintain
2. **Performance:** Eliminated duplicate processes
3. **Clarity:** Clear production vs development separation
4. **Efficiency:** Faster debugging and troubleshooting
5. **Scalability:** Easier to add new features
6. **Documentation:** Self-documenting structure

## Risk Mitigation

1. **Archival Strategy:**
   - Keep _archive/ folder for 30 days
   - Document which archived scripts map to new ones
   - Maintain git history for recovery

2. **Testing Protocol:**
   - Test all critical paths before removing scripts
   - Run parallel testing (old vs new)
   - Monitor production metrics

3. **Rollback Plan:**
   - Version control allows full rollback
   - Keep experimental/ for active development
   - Staged migration approach

## Success Metrics

- Script count: 714 → 80 (88.8% reduction)
- Directory depth: Organized into logical categories
- Duplicate functionality: 0 (from ~500+)
- Production readiness: 100% of kept scripts
- Documentation coverage: 100% of production scripts

## Timeline Summary

**Week 1:** Core consolidation and directory setup
**Week 2:** Production migration and testing
**Week 3:** Documentation and final cleanup
**Week 4:** Monitor and optimize

## Next Steps

1. Begin with universal-sports-collector.ts implementation
2. Set up automated tests for consolidated scripts
3. Create migration scripts for database references
4. Schedule team review of consolidation plan
5. Plan phased production deployment

---

**Status:** Ready for implementation
**Estimated completion:** 2 weeks
**Risk level:** Low (with proper testing)
**Business impact:** High positive (improved maintainability)