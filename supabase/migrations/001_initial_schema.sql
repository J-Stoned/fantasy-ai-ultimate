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
  position TEXT[],
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
CREATE INDEX idx_social_mentions_player ON social_mentions(player_id);