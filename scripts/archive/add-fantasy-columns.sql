-- 🔥 ADD FANTASY-SPECIFIC COLUMNS TO SUPERCHARGE THE DATABASE! 🔥
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. ENHANCE PLAYERS TABLE
-- ========================================
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS fantasy_points_2023 DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS fantasy_points_2024 DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS adp DECIMAL(5,2) DEFAULT 999,
ADD COLUMN IF NOT EXISTS fantasy_ownership DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bye_week INTEGER,
ADD COLUMN IF NOT EXISTS injury_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS projected_points_week DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS salary_dk INTEGER,
ADD COLUMN IF NOT EXISTS salary_fd INTEGER,
ADD COLUMN IF NOT EXISTS consistency_rating DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS upside_rating DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS floor_projection DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS ceiling_projection DECIMAL(6,2);

-- Create index for faster fantasy queries
CREATE INDEX IF NOT EXISTS idx_players_fantasy ON players(fantasy_ownership, adp, status);
CREATE INDEX IF NOT EXISTS idx_players_position_adp ON players(position, adp);

-- ========================================
-- 2. ENHANCE GAMES TABLE
-- ========================================
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS season INTEGER,
ADD COLUMN IF NOT EXISTS week INTEGER,
ADD COLUMN IF NOT EXISTS weather_conditions VARCHAR(50),
ADD COLUMN IF NOT EXISTS betting_total DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS betting_line DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS primetime BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS division_game BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS playoff_game BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS game_script_notes TEXT,
ADD COLUMN IF NOT EXISTS pace_factor DECIMAL(4,2);

-- Create composite index for week/season queries
CREATE INDEX IF NOT EXISTS idx_games_season_week ON games(season, week, sport_id);

-- ========================================
-- 3. ENHANCE PLAYER_STATS TABLE
-- ========================================
ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS fantasy_points DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS fantasy_points_ppr DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS fantasy_points_half_ppr DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS passing_yards INTEGER,
ADD COLUMN IF NOT EXISTS passing_tds INTEGER,
ADD COLUMN IF NOT EXISTS interceptions INTEGER,
ADD COLUMN IF NOT EXISTS passing_attempts INTEGER,
ADD COLUMN IF NOT EXISTS completions INTEGER,
ADD COLUMN IF NOT EXISTS rushing_yards INTEGER,
ADD COLUMN IF NOT EXISTS rushing_tds INTEGER,
ADD COLUMN IF NOT EXISTS rushing_attempts INTEGER,
ADD COLUMN IF NOT EXISTS receiving_yards INTEGER,
ADD COLUMN IF NOT EXISTS receiving_tds INTEGER,
ADD COLUMN IF NOT EXISTS receptions INTEGER,
ADD COLUMN IF NOT EXISTS targets INTEGER,
ADD COLUMN IF NOT EXISTS snap_count INTEGER,
ADD COLUMN IF NOT EXISTS snap_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS red_zone_touches INTEGER,
ADD COLUMN IF NOT EXISTS red_zone_targets INTEGER,
ADD COLUMN IF NOT EXISTS two_point_conversions INTEGER;

-- Create index for fantasy point queries
CREATE INDEX IF NOT EXISTS idx_stats_fantasy_points ON player_stats(player_id, season, week, fantasy_points);

-- ========================================
-- 4. ENHANCE NEWS_ARTICLES TABLE
-- ========================================
ALTER TABLE news_articles 
ADD COLUMN IF NOT EXISTS fantasy_relevance DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS player_ids INTEGER[],
ADD COLUMN IF NOT EXISTS team_ids INTEGER[],
ADD COLUMN IF NOT EXISTS injury_report BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trade_rumor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lineup_news BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS beat_writer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_source BOOLEAN DEFAULT FALSE;

-- ========================================
-- 5. CREATE NEW FANTASY PROJECTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS fantasy_projections (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    projection_source VARCHAR(50) DEFAULT 'system',
    projected_points DECIMAL(6,2),
    floor DECIMAL(6,2),
    ceiling DECIMAL(6,2),
    confidence_score DECIMAL(3,2),
    -- Detailed projections
    proj_passing_yards INTEGER,
    proj_passing_tds DECIMAL(3,1),
    proj_rushing_yards INTEGER,
    proj_rushing_tds DECIMAL(3,1),
    proj_receiving_yards INTEGER,
    proj_receiving_tds DECIMAL(3,1),
    proj_receptions DECIMAL(4,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, season, week, projection_source)
);

-- ========================================
-- 6. CREATE PLAYER RANKINGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS player_rankings (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    ranking_type VARCHAR(50) DEFAULT 'overall', -- overall, positional, dynasty
    rank INTEGER,
    position_rank INTEGER,
    tier INTEGER,
    expert_consensus_rank DECIMAL(5,1),
    std_deviation DECIMAL(4,2),
    rising BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, season, week, ranking_type)
);

-- ========================================
-- 7. CREATE DFS SALARIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS dfs_salaries (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    game_id INTEGER REFERENCES games(id),
    platform VARCHAR(20), -- 'dk', 'fd', 'yahoo'
    salary INTEGER,
    projected_ownership DECIMAL(5,2),
    value_rating DECIMAL(4,2),
    gpp_score DECIMAL(4,2),
    cash_score DECIMAL(4,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, game_id, platform)
);

-- ========================================
-- 8. CREATE WEATHER CONDITIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS weather_conditions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    temperature INTEGER,
    wind_speed INTEGER,
    precipitation_chance INTEGER,
    humidity INTEGER,
    dome BOOLEAN DEFAULT FALSE,
    weather_summary VARCHAR(100),
    fantasy_impact_score DECIMAL(3,2), -- 0-1, how much it affects fantasy
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id)
);

-- ========================================
-- 9. CREATE BETTING LINES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS betting_lines (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    sportsbook VARCHAR(50) DEFAULT 'consensus',
    spread_home DECIMAL(4,1),
    spread_away DECIMAL(4,1),
    total_points DECIMAL(5,1),
    home_ml INTEGER,
    away_ml INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 10. CREATE PLAYER OWNERSHIP TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS player_ownership (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    platform VARCHAR(50) DEFAULT 'yahoo',
    ownership_percentage DECIMAL(5,2),
    start_percentage DECIMAL(5,2),
    roster_percentage DECIMAL(5,2),
    add_percentage DECIMAL(5,2),
    drop_percentage DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, season, week, platform)
);

-- ========================================
-- ADD HELPFUL VIEWS
-- ========================================

-- Fantasy relevant players view
CREATE OR REPLACE VIEW fantasy_players AS
SELECT 
    p.*,
    ps.fantasy_points as recent_points,
    pr.rank as consensus_rank,
    pr.position_rank,
    po.ownership_percentage
FROM players p
LEFT JOIN LATERAL (
    SELECT fantasy_points 
    FROM player_stats 
    WHERE player_id = p.id 
    ORDER BY season DESC, week DESC 
    LIMIT 1
) ps ON true
LEFT JOIN LATERAL (
    SELECT rank, position_rank 
    FROM player_rankings 
    WHERE player_id = p.id 
    ORDER BY season DESC, week DESC 
    LIMIT 1
) pr ON true
LEFT JOIN LATERAL (
    SELECT ownership_percentage 
    FROM player_ownership 
    WHERE player_id = p.id 
    ORDER BY season DESC, week DESC 
    LIMIT 1
) po ON true
WHERE p.status = 'active';

-- Weekly matchups view
CREATE OR REPLACE VIEW weekly_matchups AS
SELECT 
    g.*,
    ht.name as home_team_name,
    at.name as away_team_name,
    wc.weather_summary,
    wc.fantasy_impact_score,
    bl.spread_home,
    bl.total_points
FROM games g
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at ON g.away_team_id = at.id
LEFT JOIN weather_conditions wc ON g.id = wc.game_id
LEFT JOIN betting_lines bl ON g.id = bl.game_id
WHERE g.status = 'scheduled';

-- ========================================
-- TRIGGERS FOR AUTO-UPDATING
-- ========================================

-- Auto-calculate fantasy points on stat insert
CREATE OR REPLACE FUNCTION calculate_fantasy_points()
RETURNS TRIGGER AS $$
BEGIN
    -- Standard scoring
    NEW.fantasy_points = COALESCE(
        (NEW.passing_yards * 0.04) +
        (NEW.passing_tds * 4) +
        (NEW.interceptions * -2) +
        (NEW.rushing_yards * 0.1) +
        (NEW.rushing_tds * 6) +
        (NEW.receiving_yards * 0.1) +
        (NEW.receiving_tds * 6) +
        (NEW.two_point_conversions * 2),
        0
    );
    
    -- PPR scoring
    NEW.fantasy_points_ppr = NEW.fantasy_points + COALESCE(NEW.receptions * 1, 0);
    
    -- Half PPR
    NEW.fantasy_points_half_ppr = NEW.fantasy_points + COALESCE(NEW.receptions * 0.5, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_fantasy_points_trigger
BEFORE INSERT OR UPDATE ON player_stats
FOR EACH ROW
EXECUTE FUNCTION calculate_fantasy_points();

-- ========================================
-- SEED SOME INITIAL DATA
-- ========================================

-- Add bye weeks for NFL teams (2024 season)
UPDATE players SET bye_week = CASE 
    WHEN team_id IN (1, 2) THEN 11  -- ARI, ATL
    WHEN team_id IN (3, 4) THEN 13  -- BAL, BUF
    WHEN team_id IN (5, 6) THEN 7   -- CAR, CHI
    WHEN team_id IN (7, 8) THEN 12  -- CIN, CLE
    WHEN team_id IN (9, 10) THEN 7  -- DAL, DEN
    WHEN team_id IN (11, 12) THEN 9 -- DET, GB
    WHEN team_id IN (13, 14) THEN 14 -- HOU, IND
    WHEN team_id IN (15, 16) THEN 12 -- JAX, KC
    WHEN team_id IN (17, 18) THEN 5  -- LAC, LAR
    WHEN team_id IN (19, 20) THEN 10 -- LV, MIA
    WHEN team_id IN (21, 22) THEN 6  -- MIN, NE
    WHEN team_id IN (23, 24) THEN 12 -- NO, NYG
    WHEN team_id IN (25, 26) THEN 12 -- NYJ, PHI
    WHEN team_id IN (27, 28) THEN 9  -- PIT, SEA
    WHEN team_id IN (29, 30) THEN 9  -- SF, TB
    WHEN team_id IN (31, 32) THEN 5  -- TEN, WAS
    ELSE NULL
END
WHERE sport_id = 'nfl';

-- Update some top players with realistic ADP
UPDATE players SET adp = 1.2 WHERE lastname = 'McCaffrey' AND firstname = 'Christian';
UPDATE players SET adp = 2.5 WHERE lastname = 'Jefferson' AND firstname = 'Justin';
UPDATE players SET adp = 3.1 WHERE lastname = 'Chase' AND firstname = 'Ja''Marr';
UPDATE players SET adp = 4.8 WHERE lastname = 'Ekeler' AND firstname = 'Austin';
UPDATE players SET adp = 5.3 WHERE lastname = 'Diggs' AND firstname = 'Stefon';

COMMENT ON TABLE fantasy_projections IS 'Weekly fantasy point projections for all players';
COMMENT ON TABLE player_rankings IS 'Expert consensus rankings and tiers';
COMMENT ON TABLE dfs_salaries IS 'Daily Fantasy Sports salary data';
COMMENT ON TABLE weather_conditions IS 'Game weather data and fantasy impact';
COMMENT ON TABLE betting_lines IS 'Betting spreads and totals for game context';
COMMENT ON TABLE player_ownership IS 'Platform ownership percentages for strategy';

-- ========================================
-- GRANT PERMISSIONS (if using RLS)
-- ========================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🔥 FANTASY COLUMNS ADDED SUCCESSFULLY! Your database is now a FANTASY POWERHOUSE! 🔥';
END $$;