-- 🔥 PERFORMANCE INDEXES PART 3: PLAYERS & TEAMS
-- Frequently joined tables

-- Players table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_external 
  ON players(external_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_team 
  ON players(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_sport_id 
  ON players(sport_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_name 
  ON players(firstname, lastname);

-- JSONB index for player metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_metadata_gin 
  ON players USING GIN (metadata);

-- Teams table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_external 
  ON teams(external_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_sport_id 
  ON teams(sport_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_abbreviation 
  ON teams(abbreviation);

-- Update statistics
ANALYZE players;
ANALYZE teams;

-- Check results
SELECT 
    tablename,
    COUNT(*) as index_count,
    SUM(pg_relation_size(indexrelid)) as total_size,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size_pretty
FROM pg_stat_user_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('players', 'teams')
GROUP BY tablename;