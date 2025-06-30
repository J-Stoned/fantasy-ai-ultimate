-- Additional comprehensive data collection tables

-- Game and Venue Data
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_id UUID REFERENCES sports(id),
  league_id UUID REFERENCES leagues(id),
  home_team_id UUID REFERENCES teams_master(id),
  away_team_id UUID REFERENCES teams_master(id),
  game_date TIMESTAMPTZ NOT NULL,
  venue_id UUID,
  attendance INTEGER,
  broadcast_info JSONB,
  officials JSONB,
  final_score_home INTEGER,
  final_score_away INTEGER,
  overtime_periods INTEGER,
  game_status TEXT,
  weather_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  capacity INTEGER,
  surface_type TEXT,
  roof_type TEXT,
  elevation_feet INTEGER,
  year_built INTEGER,
  coordinates JSONB,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referee and Official Data
CREATE TABLE officials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  sport_id UUID REFERENCES sports(id),
  years_experience INTEGER,
  crew_chief BOOLEAN DEFAULT false,
  stats JSONB,
  tendencies JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_officials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  official_id UUID REFERENCES officials(id),
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Betting and Odds Data
CREATE TABLE betting_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  sportsbook TEXT NOT NULL,
  line_type TEXT, -- spread, moneyline, total
  home_line DECIMAL(8,2),
  away_line DECIMAL(8,2),
  over_under DECIMAL(8,2),
  home_odds INTEGER,
  away_odds INTEGER,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prop_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  player_id UUID REFERENCES players(id),
  prop_type TEXT NOT NULL,
  line DECIMAL(8,2),
  over_odds INTEGER,
  under_odds INTEGER,
  sportsbook TEXT,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media and Content
CREATE TABLE game_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  player_id UUID REFERENCES players(id),
  highlight_type TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  views INTEGER,
  timestamp_in_game INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  media_type TEXT, -- interview, highlight, photo, etc.
  title TEXT,
  url TEXT,
  thumbnail_url TEXT,
  source TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training and Development
CREATE TABLE training_facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT, -- team, private, college, etc.
  city TEXT,
  state TEXT,
  features JSONB,
  notable_trainers TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_training (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  facility_id UUID REFERENCES training_facilities(id),
  trainer_name TEXT,
  training_type TEXT,
  start_date DATE,
  end_date DATE,
  focus_areas TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scouting Reports
CREATE TABLE scouting_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  scout_name TEXT,
  organization TEXT,
  report_date DATE,
  strengths TEXT[],
  weaknesses TEXT[],
  overall_grade TEXT,
  position_grade TEXT,
  athleticism_score INTEGER,
  skill_scores JSONB,
  projection TEXT,
  comparison_players TEXT[],
  detailed_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- College and High School Specific
CREATE TABLE high_school_leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  state TEXT,
  classification TEXT,
  member_schools UUID[],
  sport_id UUID REFERENCES sports(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE aau_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sport_id UUID REFERENCES sports(id),
  circuit TEXT,
  home_city TEXT,
  home_state TEXT,
  founded_year INTEGER,
  notable_alumni TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_aau_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  aau_team_id UUID REFERENCES aau_teams(id),
  years_played INTEGER[],
  jersey_number TEXT,
  position TEXT,
  achievements TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- International Competition
CREATE TABLE international_competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sport_id UUID REFERENCES sports(id),
  year INTEGER,
  host_country TEXT,
  participating_countries TEXT[],
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE international_rosters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES international_competitions(id),
  country TEXT NOT NULL,
  player_id UUID REFERENCES players(id),
  jersey_number TEXT,
  position TEXT,
  captain BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advanced Metrics and Analytics
CREATE TABLE player_advanced_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  season INTEGER,
  metric_type TEXT,
  value DECIMAL(10,4),
  percentile INTEGER,
  league_average DECIMAL(10,4),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_chemistry_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams_master(id),
  season INTEGER,
  chemistry_score DECIMAL(5,2),
  lineup_combinations JSONB,
  best_lineups JSONB,
  worst_lineups JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fantasy-specific Analytics
CREATE TABLE fantasy_projections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  game_id UUID REFERENCES games(id),
  projection_source TEXT,
  projected_points DECIMAL(8,2),
  floor_points DECIMAL(8,2),
  ceiling_points DECIMAL(8,2),
  confidence_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dfs_ownership_projections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  platform platform_type,
  contest_type TEXT,
  projected_ownership DECIMAL(5,2),
  actual_ownership DECIMAL(5,2),
  game_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Media Analytics
CREATE TABLE social_media_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT, -- player, team, league
  entity_id UUID,
  platform TEXT,
  handle TEXT,
  verified BOOLEAN DEFAULT false,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count INTEGER,
  engagement_rate DECIMAL(5,2),
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES social_media_accounts(id),
  post_id TEXT,
  content TEXT,
  post_type TEXT,
  media_urls TEXT[],
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  sentiment_score DECIMAL(3,2),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment Safety and Performance
CREATE TABLE equipment_safety_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID REFERENCES equipment_models(id),
  test_organization TEXT,
  test_date DATE,
  test_type TEXT,
  results JSONB,
  safety_score DECIMAL(5,2),
  certification_status TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE injury_equipment_correlation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  injury_type TEXT,
  body_part TEXT,
  equipment_category TEXT,
  correlation_strength DECIMAL(3,2),
  sample_size INTEGER,
  study_source TEXT,
  published_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Youth Development Programs
CREATE TABLE development_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization TEXT,
  program_type TEXT,
  age_range_min INTEGER,
  age_range_max INTEGER,
  locations TEXT[],
  cost DECIMAL(10,2),
  duration_weeks INTEGER,
  skills_focus TEXT[],
  notable_alumni UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_development_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  program_id UUID REFERENCES development_programs(id),
  start_date DATE,
  end_date DATE,
  achievements TEXT[],
  coaches TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical and Health Partners
CREATE TABLE medical_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT, -- hospital, clinic, specialist
  specialties TEXT[],
  city TEXT,
  state TEXT,
  team_affiliations UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_medical_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  provider_id UUID REFERENCES medical_providers(id),
  visit_date DATE,
  visit_type TEXT,
  body_part TEXT,
  treatment_type TEXT,
  recovery_time_days INTEGER,
  cleared_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sponsorship and Marketing
CREATE TABLE sponsorship_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT, -- player, team, league
  entity_id UUID,
  sponsor_name TEXT NOT NULL,
  deal_type TEXT,
  start_date DATE,
  end_date DATE,
  total_value DECIMAL(15,2),
  annual_value DECIMAL(12,2),
  performance_bonuses JSONB,
  activation_requirements JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name TEXT NOT NULL,
  sponsor_id UUID,
  featured_players UUID[],
  campaign_type TEXT,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  impressions INTEGER,
  engagement_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for all new tables
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_teams ON games(home_team_id, away_team_id);
CREATE INDEX idx_betting_lines_game ON betting_lines(game_id);
CREATE INDEX idx_prop_bets_player ON prop_bets(player_id);
CREATE INDEX idx_scouting_reports_player ON scouting_reports(player_id);
CREATE INDEX idx_social_media_posts_account ON social_media_posts(account_id);
CREATE INDEX idx_social_media_posts_date ON social_media_posts(posted_at);
CREATE INDEX idx_fantasy_projections_player_game ON fantasy_projections(player_id, game_id);
CREATE INDEX idx_player_advanced_metrics_player ON player_advanced_metrics(player_id, season);

-- Add RLS policies for new tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public game data" ON games
  FOR SELECT TO authenticated USING (true);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public venue data" ON venues
  FOR SELECT TO authenticated USING (true);

ALTER TABLE scouting_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public scouting data" ON scouting_reports
  FOR SELECT TO authenticated USING (true);

ALTER TABLE fantasy_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public projection data" ON fantasy_projections
  FOR SELECT TO authenticated USING (true);