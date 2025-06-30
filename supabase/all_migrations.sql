-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "vector"; -- For AI embeddings

-- Create enum types
CREATE TYPE sport_type AS ENUM (
  'football', 'basketball', 'baseball', 'hockey', 'soccer', 
  'golf', 'tennis', 'racing', 'mma', 'boxing', 'olympics',
  'cricket', 'rugby', 'volleyball', 'track_field', 'other'
);

CREATE TYPE league_level AS ENUM (
  'professional', 'college', 'high_school', 'youth', 
  'minor_league', 'international', 'olympic'
);

CREATE TYPE platform_type AS ENUM (
  'yahoo', 'espn', 'draftkings', 'fanduel', 'sleeper', 
  'cbs', 'nfl', 'custom'
);

CREATE TYPE injury_status AS ENUM (
  'healthy', 'questionable', 'doubtful', 'out', 'ir', 'day_to_day'
);

-- Core User Tables
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  favorite_teams TEXT[],
  favorite_players UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sports Hierarchy Tables
CREATE TABLE sports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sport_type sport_type NOT NULL,
  description TEXT,
  rules_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_id UUID REFERENCES sports(id),
  name TEXT NOT NULL,
  abbreviation TEXT,
  level league_level NOT NULL,
  country TEXT,
  founded_year INTEGER,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id),
  name TEXT NOT NULL,
  city TEXT,
  abbreviation TEXT,
  founded_year INTEGER,
  home_venue TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  website TEXT,
  social_media JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Educational Institution Tables
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('high_school', 'college', 'university')),
  city TEXT,
  state TEXT,
  country TEXT,
  enrollment INTEGER,
  athletics_website TEXT,
  mascot TEXT,
  colors TEXT[],
  conference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  level TEXT,
  sport_id UUID REFERENCES sports(id),
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMPREHENSIVE PLAYER DATABASE - EVERY PLAYER FROM EVERY LEAGUE
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  nickname TEXT,
  date_of_birth DATE,
  place_of_birth TEXT,
  nationality TEXT[],
  
  -- Physical Attributes
  height_inches INTEGER,
  weight_lbs INTEGER,
  wingspan_inches INTEGER,
  hand_size_inches DECIMAL(4,2),
  
  -- Career Information
  sport_id UUID REFERENCES sports(id),
  "position" TEXT[],
  jersey_number TEXT,
  years_pro INTEGER,
  draft_year INTEGER,
  draft_round INTEGER,
  draft_pick INTEGER,
  draft_team_id UUID REFERENCES teams_master(id),
  
  -- Current Status
  current_team_id UUID REFERENCES teams_master(id),
  current_league_id UUID REFERENCES leagues(id),
  school_id UUID REFERENCES schools(id),
  status TEXT, -- active, retired, free_agent, etc.
  
  -- Media and Social
  headshot_url TEXT,
  action_photo_url TEXT,
  social_media JSONB,
  
  -- Search and Matching
  search_vector tsvector,
  alternate_names TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_player_info UNIQUE (first_name, last_name, date_of_birth)
);

-- Create indexes for player search
CREATE INDEX idx_players_full_name ON players USING GIN (search_vector);
CREATE INDEX idx_players_sport ON players(sport_id);
CREATE INDEX idx_players_team ON players(current_team_id);
CREATE INDEX idx_players_league ON players(current_league_id);

-- Player Statistics Tables
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  season_type TEXT, -- regular, playoffs, preseason
  team_id UUID REFERENCES teams_master(id),
  league_id UUID REFERENCES leagues(id),
  games_played INTEGER DEFAULT 0,
  stats JSONB NOT NULL, -- Flexible schema for different sports
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_season_stats UNIQUE (player_id, season, season_type, team_id)
);

CREATE TABLE player_game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID,
  game_date DATE NOT NULL,
  opponent_id UUID REFERENCES teams_master(id),
  is_home BOOLEAN,
  stats JSONB NOT NULL, -- Game-specific stats
  fantasy_points DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Health and Equipment
CREATE TABLE player_injuries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  injury_date DATE NOT NULL,
  injury_type TEXT NOT NULL,
  body_part TEXT,
  severity INTEGER CHECK (severity BETWEEN 1 AND 10),
  status injury_status,
  expected_return DATE,
  actual_return DATE,
  games_missed INTEGER,
  description TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT[],
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES equipment_brands(id),
  model_name TEXT NOT NULL,
  category TEXT NOT NULL,
  release_year INTEGER,
  safety_rating DECIMAL(3,2),
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment_models(id),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial and Contract Data
CREATE TABLE player_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams_master(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_value DECIMAL(15,2),
  guaranteed_money DECIMAL(15,2),
  signing_bonus DECIMAL(15,2),
  annual_salary DECIMAL(12,2),
  incentives JSONB,
  contract_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nil_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  deal_value DECIMAL(12,2),
  start_date DATE,
  end_date DATE,
  deal_type TEXT,
  social_requirements JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fantasy Platform Integration
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_platform UNIQUE (user_id, platform)
);

CREATE TABLE fantasy_leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform platform_type NOT NULL,
  platform_league_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  sport_id UUID REFERENCES sports(id),
  season INTEGER,
  league_settings JSONB,
  scoring_settings JSONB,
  roster_settings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fantasy_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  team_name TEXT NOT NULL,
  platform_team_id TEXT,
  roster JSONB,
  standings JSONB,
  stats JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Mapping for Cross-Platform
CREATE TABLE player_platform_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_player_id TEXT NOT NULL,
  platform_data JSONB,
  confidence_score DECIMAL(3,2),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_platform_player UNIQUE (platform, platform_player_id)
);

-- Import and Sync History
CREATE TABLE import_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  platform platform_type NOT NULL,
  import_type TEXT,
  status TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_imported INTEGER,
  error_message TEXT,
  metadata JSONB
);

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  sync_source TEXT,
  sync_status TEXT,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  next_sync_at TIMESTAMPTZ,
  sync_data JSONB
);

-- Advanced Analytics Tables
CREATE TABLE player_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  time_period TEXT,
  trend_value DECIMAL(10,4),
  trend_direction TEXT,
  confidence DECIMAL(3,2),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matchup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  opponent_team_id UUID REFERENCES teams_master(id),
  games_played INTEGER,
  avg_fantasy_points DECIMAL(8,2),
  best_performance JSONB,
  worst_performance JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE weather_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID,
  venue TEXT,
  game_time TIMESTAMPTZ,
  temperature_f INTEGER,
  wind_mph INTEGER,
  wind_direction TEXT,
  precipitation_type TEXT,
  precipitation_chance INTEGER,
  humidity_percent INTEGER,
  conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- News and Social Media
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  source TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  url TEXT UNIQUE,
  players_mentioned UUID[],
  teams_mentioned UUID[],
  sentiment_score DECIMAL(3,2),
  categories TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  post_id TEXT,
  player_id UUID REFERENCES players(id),
  content TEXT,
  author TEXT,
  posted_at TIMESTAMPTZ,
  engagement_score INTEGER,
  sentiment DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Youth and Recruiting
CREATE TABLE recruiting_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  graduation_year INTEGER,
  gpa DECIMAL(3,2),
  sat_score INTEGER,
  act_score INTEGER,
  star_rating INTEGER CHECK (star_rating BETWEEN 1 AND 5),
  national_rank INTEGER,
  position_rank INTEGER,
  state_rank INTEGER,
  committed_school_id UUID REFERENCES schools(id),
  commitment_date DATE,
  other_offers UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE combine_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  event_name TEXT,
  event_date DATE,
  forty_yard_dash DECIMAL(4,2),
  vertical_jump DECIMAL(4,1),
  broad_jump INTEGER,
  bench_press_reps INTEGER,
  three_cone_drill DECIMAL(4,2),
  shuttle_run DECIMAL(4,2),
  measurements JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_teams_master_updated_at BEFORE UPDATE ON teams_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create full-text search function for players
CREATE OR REPLACE FUNCTION update_player_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.nickname, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.alternate_names, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_search_vector_trigger
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_player_search_vector();

-- Row Level Security Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only see their own fantasy data
CREATE POLICY "Users can view own leagues" ON fantasy_leagues
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own leagues" ON fantasy_leagues
  FOR ALL USING (auth.uid() = user_id);

-- Public data (players, teams, etc.) is viewable by all authenticated users
CREATE POLICY "Public player data" ON players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public team data" ON teams_master
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public league data" ON leagues
  FOR SELECT TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX idx_player_stats_player_season ON player_stats(player_id, season);
CREATE INDEX idx_player_game_logs_player_date ON player_game_logs(player_id, game_date);
CREATE INDEX idx_player_injuries_player ON player_injuries(player_id);
CREATE INDEX idx_player_injuries_date ON player_injuries(injury_date);
CREATE INDEX idx_fantasy_teams_league ON fantasy_teams(league_id);
CREATE INDEX idx_fantasy_teams_user ON fantasy_teams(user_id);
CREATE INDEX idx_news_articles_published ON news_articles(published_at);
CREATE INDEX idx_social_mentions_player ON social_mentions(player_id);-- Additional comprehensive data collection tables

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
  "position" TEXT,
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
  "position" TEXT,
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
  "position" TEXT,
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
  published_at DATE,
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
  FOR SELECT TO authenticated USING (true);-- Performance Indexes for Fantasy AI Ultimate
-- Optimized for Small Supabase instance

-- ===== PLAYERS TABLE INDEXES =====
-- Most critical table - will have millions of records

-- Composite index for common player queries
CREATE INDEX idx_players_sport_league_status ON players(sport_id, current_league_id, status);

-- Partial index for active players only (90% of queries)
CREATE INDEX idx_players_active ON players(sport_id, current_league_id) 
WHERE status = 'active';

-- Index for name searches (case-insensitive)
CREATE INDEX idx_players_name_lower ON players(LOWER(full_name));

-- GIN index for full text search
CREATE INDEX idx_players_search ON players USING gin(to_tsvector('english', 
  COALESCE(full_name, '') || ' ' || 
  COALESCE(nickname, '') || ' ' || 
  COALESCE(first_name, '') || ' ' || 
  COALESCE(last_name, '')
));

-- ===== PLAYER STATS INDEXES =====
-- Second most queried table

-- Composite index for stat lookups
CREATE INDEX idx_player_stats_lookup ON player_stats(player_id, season DESC, season_type);

-- Index for current season stats
CREATE INDEX idx_player_stats_current ON player_stats(player_id, season, season_type);

-- GIN index for JSON stats queries
CREATE INDEX idx_player_stats_json ON player_stats USING gin(stats);

-- ===== PLAYER GAME LOGS INDEXES =====
-- For recent game queries

CREATE INDEX idx_game_logs_player_date ON player_game_logs(player_id, game_date DESC);

-- ===== FANTASY PLATFORM INDEXES =====

-- Platform mapping for cross-platform lookups
CREATE INDEX idx_platform_mapping ON player_platform_mapping(player_id, platform);
CREATE INDEX idx_platform_external ON player_platform_mapping(platform, platform_player_id);

-- Fantasy leagues and teams
CREATE INDEX idx_fantasy_leagues_active ON fantasy_leagues(platform, user_id) 
WHERE is_active = true;
CREATE INDEX idx_fantasy_teams_lookup ON fantasy_teams(league_id, user_id);

-- ===== INJURY AND NEWS INDEXES =====

CREATE INDEX idx_injuries_active ON player_injuries(player_id, status);

-- GIN index for searching players mentioned in news articles
CREATE INDEX idx_news_players ON news_articles USING gin(players_mentioned);
CREATE INDEX idx_news_recent ON news_articles(published_at DESC);

-- ===== TEAM AND LEAGUE INDEXES =====

CREATE INDEX idx_teams_league ON teams_master(league_id);
CREATE INDEX idx_teams_name ON teams_master(LOWER(name), LOWER(city));

-- ===== USER ACTIVITY INDEXES =====

CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(LOWER(username));

-- ===== MATERIALIZED VIEWS FOR EXPENSIVE QUERIES =====

-- Player season stats summary (refresh daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_current_season_stats AS
SELECT 
  p.id,
  p.full_name,
  p.current_team_id,
  p.sport_id,
  ps.season,
  ps.games_played,
  ps.stats,
  (ps.stats->>'fantasy_points_total')::numeric
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
WHERE ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.season_type = 'regular'
  AND p.status = 'active';

CREATE INDEX idx_mv_player_stats_id ON mv_player_current_season_stats(id);
CREATE INDEX idx_mv_player_stats_team ON mv_player_current_season_stats(current_team_id);

-- Top performers by position (refresh hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_performers_by_position AS
SELECT 
  p.id,
  p.full_name,
  p."position",
  p.sport_id,
  p.current_team_id,
  (ps.stats->>'fantasy_points_total')::numeric,
  ROW_NUMBER() OVER (PARTITION BY p.sport_id, p.position ORDER BY (ps.stats->>'fantasy_points_total')::numeric DESC) as rank
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
WHERE ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.season_type = 'regular'
  AND p.status = 'active'
  AND ps.games_played > 0;

CREATE INDEX idx_mv_top_performers ON mv_top_performers_by_position(sport_id, position, rank);

-- ===== DATABASE FUNCTIONS FOR COMPLEX QUERIES =====

-- Function to get player with all related data
CREATE OR REPLACE FUNCTION get_player_full_data(player_uuid UUID)
RETURNS TABLE (
  player JSONB,
  current_stats JSONB,
  recent_games JSONB,
  injury_status JSONB,
  fantasy_info JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(p.*) as player,
    to_jsonb(ps.*) as current_stats,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'date', pgl.game_date,
        'opponent', pgl.opponent_id,
        'stats', pgl.stats
      )) FILTER (WHERE pgl.game_date IS NOT NULL),
      '[]'::jsonb
    ) as recent_games,
    to_jsonb(pi.*) as injury_status,
    jsonb_build_object(
      'platforms', COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'platform', ppm.platform,
          'external_id', ppm.platform_player_id
        )) FILTER (WHERE ppm.platform IS NOT NULL),
        '[]'::jsonb
      )
    ) as fantasy_info
  FROM players p
  LEFT JOIN player_stats ps ON p.id = ps.player_id 
    AND ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
    AND ps.season_type = 'regular'
  LEFT JOIN player_game_logs pgl ON p.id = pgl.player_id 
    AND pgl.game_date > CURRENT_DATE - INTERVAL '10 days'
  LEFT JOIN player_injuries pi ON p.id = pi.player_id 
    AND pi.status != 'healthy'
  LEFT JOIN player_platform_mapping ppm ON p.id = ppm.player_id
  WHERE p.id = player_uuid
  GROUP BY p.id, ps.player_id, ps.season, ps.season_type, pi.id;
END;
$$ LANGUAGE plpgsql;

-- Function for fuzzy player search
CREATE OR REPLACE FUNCTION search_players_fuzzy(
  search_term TEXT,
  sport_filter UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  nickname TEXT,
  team_name TEXT,
  "position" TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.nickname,
    t.name as team_name,
    p."position"[1],
    similarity(p.full_name, search_term) as similarity_score
  FROM players p
  LEFT JOIN teams_master t ON p.current_team_id = t.id
  WHERE 
    (sport_filter IS NULL OR p.sport_id = sport_filter)
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.nickname ILIKE '%' || search_term || '%'
      OR similarity(p.full_name, search_term) > 0.3
    )
    AND p.status = 'active'
  ORDER BY 
    CASE 
      WHEN p.full_name ILIKE search_term || '%' THEN 1
      WHEN p.full_name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    similarity(p.full_name, search_term) DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ===== QUERY PERFORMANCE SETTINGS =====

-- Analyze tables after index creation
ANALYZE players;
ANALYZE player_stats;
ANALYZE player_game_logs;
ANALYZE fantasy_leagues;
ANALYZE fantasy_teams;