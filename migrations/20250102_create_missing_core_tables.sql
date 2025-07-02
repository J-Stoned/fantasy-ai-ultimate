-- MISSING CORE TABLES FOR FANTASY AI
-- These tables are referenced in the code but were missing from the database

-- User lineups table
CREATE TABLE IF NOT EXISTS lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id UUID REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  week INT NOT NULL,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  salary_used INT DEFAULT 0,
  projected_points DECIMAL(10,2) DEFAULT 0,
  actual_points DECIMAL(10,2),
  rank INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, league_id, week, name)
);

-- Lineup players junction table
CREATE TABLE IF NOT EXISTS lineup_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id UUID NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES players(id),
  position VARCHAR(10) NOT NULL,
  salary INT NOT NULL,
  projected_points DECIMAL(10,2) DEFAULT 0,
  actual_points DECIMAL(10,2),
  is_captain BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lineup_id, position, player_id)
);

-- User roster players (season-long)
CREATE TABLE IF NOT EXISTS roster_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES players(id),
  acquisition_type VARCHAR(50) NOT NULL, -- 'draft', 'waiver', 'trade'
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dropped_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, player_id, acquisition_date)
);

-- Weekly matchups
CREATE TABLE IF NOT EXISTS matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  week INT NOT NULL,
  home_team_id UUID NOT NULL REFERENCES fantasy_teams(id),
  away_team_id UUID NOT NULL REFERENCES fantasy_teams(id),
  home_score DECIMAL(10,2) DEFAULT 0,
  away_score DECIMAL(10,2) DEFAULT 0,
  winner_team_id UUID REFERENCES fantasy_teams(id),
  is_playoff BOOLEAN DEFAULT false,
  is_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, week, home_team_id, away_team_id),
  CHECK (home_team_id != away_team_id)
);

-- User actions tracking
CREATE TABLE IF NOT EXISTS user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'add_player', 'drop_player', 'trade', 'set_lineup', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'player', 'lineup', 'team', etc.
  entity_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lineups_user_week ON lineups(user_id, week);
CREATE INDEX idx_lineups_league_week ON lineups(league_id, week);
CREATE INDEX idx_lineup_players_lineup ON lineup_players(lineup_id);
CREATE INDEX idx_lineup_players_player ON lineup_players(player_id);
CREATE INDEX idx_roster_players_team ON roster_players(team_id);
CREATE INDEX idx_roster_players_player ON roster_players(player_id);
CREATE INDEX idx_roster_players_active ON roster_players(is_active) WHERE is_active = true;
CREATE INDEX idx_matchups_league_week ON matchups(league_id, week);
CREATE INDEX idx_matchups_teams ON matchups(home_team_id, away_team_id);
CREATE INDEX idx_user_actions_user_type ON user_actions(user_id, action_type);
CREATE INDEX idx_user_actions_created ON user_actions(created_at DESC);

-- RLS Policies
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;

-- Lineups policies
CREATE POLICY "Users can view their own lineups" ON lineups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lineups" ON lineups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lineups" ON lineups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lineups" ON lineups
  FOR DELETE USING (auth.uid() = user_id);

-- Lineup players policies (inherit from lineup)
CREATE POLICY "Users can manage lineup players" ON lineup_players
  FOR ALL USING (
    lineup_id IN (
      SELECT id FROM lineups WHERE user_id = auth.uid()
    )
  );

-- Roster players policies
CREATE POLICY "Users can view their team rosters" ON roster_players
  FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (
      SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team rosters" ON roster_players
  FOR ALL USING (
    team_id IN (
      SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
  );

-- Matchups policies (league members can view)
CREATE POLICY "League members can view matchups" ON matchups
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM fantasy_teams WHERE user_id = auth.uid()
    )
  );

-- User actions policies
CREATE POLICY "Users can view their own actions" ON user_actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own actions" ON user_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_lineups_updated_at BEFORE UPDATE ON lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roster_players_updated_at BEFORE UPDATE ON roster_players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matchups_updated_at BEFORE UPDATE ON matchups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate lineup salary
CREATE OR REPLACE FUNCTION calculate_lineup_salary(lineup_id UUID)
RETURNS INT AS $$
DECLARE
  total_salary INT;
BEGIN
  SELECT COALESCE(SUM(salary), 0) INTO total_salary
  FROM lineup_players
  WHERE lineup_players.lineup_id = calculate_lineup_salary.lineup_id;
  
  RETURN total_salary;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate lineup points
CREATE OR REPLACE FUNCTION calculate_lineup_points(lineup_id UUID, use_actual BOOLEAN DEFAULT false)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_points DECIMAL(10,2);
BEGIN
  IF use_actual THEN
    SELECT COALESCE(SUM(actual_points), 0) INTO total_points
    FROM lineup_players
    WHERE lineup_players.lineup_id = calculate_lineup_points.lineup_id;
  ELSE
    SELECT COALESCE(SUM(projected_points), 0) INTO total_points
    FROM lineup_players
    WHERE lineup_players.lineup_id = calculate_lineup_points.lineup_id;
  END IF;
  
  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update lineup totals
CREATE OR REPLACE FUNCTION update_lineup_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lineups
  SET 
    salary_used = calculate_lineup_salary(NEW.lineup_id),
    projected_points = calculate_lineup_points(NEW.lineup_id, false)
  WHERE id = NEW.lineup_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lineup_totals_on_player_change
AFTER INSERT OR UPDATE OR DELETE ON lineup_players
FOR EACH ROW EXECUTE FUNCTION update_lineup_totals();