# 🔄 Universal Game ID System Migration Plan

## Overview
Implement a vendor-agnostic universal game ID system to support multiple data sources (ESPN, DraftKings, FanDuel, SportRadar, etc.)

## Universal ID Format
**Format**: `{sport}_{YYYYMMDD}_{HHMM}_{home_abbr}_{away_abbr}`  
**Example**: `nfl_20240915_1300_dal_nyg`

## Current State Analysis
- **16,435 games** with external IDs in inconsistent formats
- **4,582 games** with `espn_` prefix
- **11,000+ games** with numeric-only IDs
- **193 games** with `mlb_` prefix
- Various other formats (`nhl_`, `nba_`, etc.)

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Create External ID Mapping Table
```sql
CREATE TABLE game_external_ids (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,  -- 'espn', 'draftkings', 'fanduel', etc.
  external_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, source),
  INDEX idx_external_id (source, external_id)
);
```

#### 1.2 Add Universal ID to Games Table
```sql
ALTER TABLE games ADD COLUMN universal_id VARCHAR(255);
CREATE UNIQUE INDEX idx_games_universal_id ON games(universal_id);
```

### Phase 2: ID Generation Logic

#### 2.1 Universal ID Generation Rules
1. **Sport**: Lowercase sport code (nfl, nba, mlb, nhl, ncaaf, ncaab)
2. **Date**: YYYYMMDD format from start_time
3. **Time**: HHMM in local venue time (or UTC if unavailable)
4. **Teams**: 3-letter abbreviations (lowercase)
5. **Conflicts**: Add sequence suffix (_01, _02) for same-day games

#### 2.2 Edge Case Handling
- Missing abbreviations → Use `t{team_id}` format
- Missing time → Use "0000"
- Null sport → Use "unk"
- Doubleheaders → Add sequence number

### Phase 3: Migration Script Components

#### 3.1 Team Abbreviation Mapping
```typescript
interface TeamAbbreviation {
  team_id: number
  abbreviation: string
  sport: string
}

// Get or generate abbreviation
function getTeamAbbreviation(teamId: number): string {
  // Lookup from teams table
  // Fallback to t{teamId} format
}
```

#### 3.2 Universal ID Generator
```typescript
function generateUniversalGameId(game: {
  sport: string
  start_time: string
  home_team_id: number
  away_team_id: number
}): string {
  const sport = (game.sport || 'unk').toLowerCase()
  const date = formatDate(game.start_time) // YYYYMMDD
  const time = formatTime(game.start_time) // HHMM
  const home = getTeamAbbreviation(game.home_team_id)
  const away = getTeamAbbreviation(game.away_team_id)
  
  return `${sport}_${date}_${time}_${home}_${away}`
}
```

#### 3.3 External ID Parser
```typescript
function parseExternalIdSource(externalId: string): {
  source: string
  cleanId: string
} {
  if (externalId.startsWith('espn_')) {
    return { source: 'espn', cleanId: externalId.replace('espn_', '') }
  }
  if (externalId.startsWith('mlb_')) {
    return { source: 'espn', cleanId: externalId }
  }
  if (/^\d+$/.test(externalId)) {
    return { source: 'espn', cleanId: externalId }
  }
  // Add more patterns as needed
  return { source: 'unknown', cleanId: externalId }
}
```

### Phase 4: Migration Execution

#### 4.1 Step-by-Step Process
1. **Backup current data**
2. **Generate universal IDs** for all games
3. **Handle conflicts** (add sequence numbers)
4. **Migrate external IDs** to mapping table
5. **Update collection scripts**
6. **Verify data integrity**
7. **Deploy changes**

#### 4.2 Rollback Strategy
- Keep external_id column temporarily
- Create backup of games table
- Test with subset first
- Full rollback script ready

### Phase 5: Update Collection Scripts

#### 5.1 New Collection Pattern
```typescript
// When collecting new game
const universalId = generateUniversalGameId(gameData)
const game = await upsertGame({ ...gameData, universal_id: universalId })

// Store external mapping
await createExternalIdMapping({
  game_id: game.id,
  source: 'espn',
  external_id: espnGameId
})
```

#### 5.2 Updated Lookup Pattern
```typescript
// Find game by external ID
async function findGameByExternalId(source: string, externalId: string) {
  const mapping = await db.game_external_ids.findOne({
    source,
    external_id: externalId
  })
  
  return mapping ? await db.games.findById(mapping.game_id) : null
}
```

### Phase 6: API Helper Functions

```typescript
// Core helper functions to implement
interface GameIdHelpers {
  generateUniversalId(game: GameData): string
  findByExternalId(source: string, id: string): Promise<Game>
  findByUniversalId(id: string): Promise<Game>
  addExternalId(gameId: number, source: string, externalId: string): Promise<void>
  getExternalIds(gameId: number): Promise<ExternalIdMapping[]>
}
```

## Benefits

### Immediate Benefits
✅ Consistent ID format across entire system  
✅ Fix MLB/NBA collection issues  
✅ Cleaner, more maintainable code  
✅ Better debugging and logging  

### Future Benefits
✅ Easy integration of new data sources  
✅ No vendor lock-in  
✅ Support for multiple IDs per game  
✅ Better data reconciliation  
✅ Foundation for odds/betting data  

## Success Metrics
- All 82,861 games have universal IDs
- All 16,435 external IDs migrated to mapping table
- Collection scripts working with new system
- Zero data loss during migration
- Improved collection success rate

## Timeline
1. **Day 1**: Create migration scripts and test locally
2. **Day 2**: Run migration on subset (1000 games)
3. **Day 3**: Full migration and verification
4. **Day 4**: Update all collection scripts
5. **Day 5**: Deploy and monitor

## Risk Mitigation
- Full database backup before migration
- Staged rollout (test → subset → full)
- Keep old external_id column for 30 days
- Comprehensive logging and monitoring
- Rollback scripts prepared

---

**Status**: Ready for implementation  
**Priority**: High - Blocking data collection  
**Impact**: Affects all data collection and future integrations