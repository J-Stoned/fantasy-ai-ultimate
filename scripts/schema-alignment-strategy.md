# Schema Alignment Strategy

## Current State Analysis

### What We Have:
1. **Database is using INTEGER primary keys** - Not UUIDs as the complex schema defines
2. **Simple schema is active** - The migrations from 20250102_create_missing_tables.sql
3. **Data collectors expect simple schema** - Text fields for team names, etc.
4. **8,858 player stats records** - Using stat_type/stat_value structure

### Key Issues:
1. **Primary Key Mismatch**: Complex schema uses UUIDs, current data uses integers
2. **Foreign Key Types**: All relationships are integer-based, not UUID
3. **Table Structure**: player_stats uses different structure than complex schema
4. **Missing Relations**: No proper links to sports, leagues, schools tables

## Decision: Adapt Complex Schema to Work with Current Data

Instead of trying to convert all integer IDs to UUIDs (which would break existing data), we'll:

### Option 1: Full Migration (Complex & Risky)
- Convert all integer IDs to UUIDs
- Update all foreign key relationships
- Risk: Breaking existing functionality
- Time: Several days

### Option 2: Hybrid Approach (Recommended) ✅
- Keep integer IDs where they exist
- Add UUID columns for new data
- Create mapping tables for external systems
- Use adapters to work with both schemas

### Option 3: Enhanced Simple Schema
- Keep the simple schema
- Add the missing complex features as extensions
- Maintain compatibility with collectors
- Gradually migrate to complex schema over time

## Recommended Approach: Enhanced Simple Schema

1. **Add complex schema features to existing tables**
   - Add external_id columns for API mappings
   - Add JSONB columns for flexible stats storage
   - Keep integer primary keys for compatibility

2. **Create new tables for complex features**
   - player_platform_mapping (for ESPN, BallDontLie IDs)
   - player_game_logs (detailed per-game stats)
   - Keep existing player_stats for backward compatibility

3. **Build adapters for data collection**
   - Map API data to appropriate tables
   - Handle both simple and complex queries
   - Gradual migration path