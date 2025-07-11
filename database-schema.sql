-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.aau_teams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  sport_id uuid,
  circuit text,
  home_city text,
  home_state text,
  founded_year integer,
  notable_alumni ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT aau_teams_pkey PRIMARY KEY (id),
  CONSTRAINT aau_teams_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.api_usage (
  id bigint NOT NULL DEFAULT nextval('api_usage_id_seq'::regclass),
  api_name character varying NOT NULL,
  date date NOT NULL,
  calls integer DEFAULT 0,
  daily_limit integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT api_usage_pkey PRIMARY KEY (id)
);
CREATE TABLE public.betting_lines (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  game_id uuid,
  sportsbook text NOT NULL,
  line_type text,
  home_line numeric,
  away_line numeric,
  over_under numeric,
  home_odds integer,
  away_odds integer,
  timestamp timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT betting_lines_pkey PRIMARY KEY (id)
);
CREATE TABLE public.betting_odds (
  id bigint NOT NULL DEFAULT nextval('betting_odds_id_seq'::regclass),
  sport_id character varying,
  home_team character varying,
  away_team character varying,
  game_time timestamp with time zone,
  bookmakers jsonb,
  external_id character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT betting_odds_pkey PRIMARY KEY (id)
);
CREATE TABLE public.breaking_news (
  id bigint NOT NULL DEFAULT nextval('breaking_news_id_seq'::regclass),
  headline character varying NOT NULL,
  content text,
  url character varying,
  source character varying,
  author character varying,
  published_at timestamp with time zone,
  urgency character varying,
  players_mentioned ARRAY,
  teams_mentioned ARRAY,
  sentiment character varying,
  engagement_score integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  external_id character varying NOT NULL UNIQUE,
  CONSTRAINT breaking_news_pkey PRIMARY KEY (id)
);
CREATE TABLE public.collection_state (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collector_name character varying NOT NULL UNIQUE,
  last_run timestamp with time zone DEFAULT now(),
  last_id character varying,
  last_timestamp timestamp with time zone,
  items_collected integer DEFAULT 0,
  total_items_collected bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collection_state_pkey PRIMARY KEY (id)
);
CREATE TABLE public.combine_results (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  event_name text,
  event_date date,
  forty_yard_dash numeric,
  vertical_jump numeric,
  broad_jump integer,
  bench_press_reps integer,
  three_cone_drill numeric,
  shuttle_run numeric,
  measurements jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT combine_results_pkey PRIMARY KEY (id)
);
CREATE TABLE public.conferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  level text,
  sport_id uuid,
  region text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conferences_pkey PRIMARY KEY (id),
  CONSTRAINT conferences_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.correlation_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  factor1 text NOT NULL,
  factor2 text NOT NULL,
  correlation double precision NOT NULL,
  confidence double precision NOT NULL,
  sample_size integer,
  insight text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT correlation_insights_pkey PRIMARY KEY (id)
);
CREATE TABLE public.development_programs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  organization text,
  program_type text,
  age_range_min integer,
  age_range_max integer,
  locations ARRAY,
  cost numeric,
  duration_weeks integer,
  skills_focus ARRAY,
  notable_alumni ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT development_programs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dfs_ownership_projections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  platform USER-DEFINED,
  contest_type text,
  projected_ownership numeric,
  actual_ownership numeric,
  game_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dfs_ownership_projections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dfs_salaries (
  id bigint NOT NULL DEFAULT nextval('dfs_salaries_id_seq'::regclass),
  player_name character varying NOT NULL,
  player_id character varying,
  team character varying,
  position character varying,
  draftkings_salary integer,
  fanduel_salary integer,
  yahoo_salary integer,
  week integer,
  season integer DEFAULT 2024,
  created_at timestamp with time zone DEFAULT now(),
  external_id character varying NOT NULL UNIQUE,
  CONSTRAINT dfs_salaries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.equipment_brands (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category ARRAY,
  website text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT equipment_brands_pkey PRIMARY KEY (id)
);
CREATE TABLE public.equipment_models (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  brand_id uuid,
  model_name text NOT NULL,
  category text NOT NULL,
  release_year integer,
  safety_rating numeric,
  features jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT equipment_models_pkey PRIMARY KEY (id),
  CONSTRAINT equipment_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.equipment_brands(id)
);
CREATE TABLE public.equipment_safety_tests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  equipment_id uuid,
  test_organization text,
  test_date date,
  test_type text,
  results jsonb,
  safety_score numeric,
  certification_status text,
  expiry_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT equipment_safety_tests_pkey PRIMARY KEY (id),
  CONSTRAINT equipment_safety_tests_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment_models(id)
);
CREATE TABLE public.fantasy_leagues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  platform USER-DEFINED NOT NULL,
  platform_league_id text NOT NULL,
  user_id uuid,
  name text NOT NULL,
  sport_id uuid,
  season integer,
  league_settings jsonb,
  scoring_settings jsonb,
  roster_settings jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fantasy_leagues_pkey PRIMARY KEY (id),
  CONSTRAINT fantasy_leagues_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fantasy_leagues_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.fantasy_projections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  game_id uuid,
  projection_source text,
  projected_points numeric,
  floor_points numeric,
  ceiling_points numeric,
  confidence_rating numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fantasy_projections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fantasy_rankings (
  id bigint NOT NULL DEFAULT nextval('fantasy_rankings_id_seq'::regclass),
  player_name character varying NOT NULL,
  player_id character varying,
  position character varying,
  team_id character varying,
  ownership_pct numeric,
  adp numeric,
  platform character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  external_id character varying NOT NULL UNIQUE,
  CONSTRAINT fantasy_rankings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fantasy_teams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  league_id uuid,
  user_id uuid,
  team_name text NOT NULL,
  platform_team_id text,
  roster jsonb,
  standings jsonb,
  stats jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fantasy_teams_pkey PRIMARY KEY (id),
  CONSTRAINT fantasy_teams_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.fantasy_leagues(id),
  CONSTRAINT fantasy_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.game_highlights (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  game_id uuid,
  player_id uuid,
  highlight_type text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  views integer,
  timestamp_in_game integer,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_highlights_pkey PRIMARY KEY (id)
);
CREATE TABLE public.game_officials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  game_id uuid,
  official_id uuid,
  position text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_officials_pkey PRIMARY KEY (id),
  CONSTRAINT game_officials_official_id_fkey FOREIGN KEY (official_id) REFERENCES public.officials(id)
);
CREATE TABLE public.games (
  id bigint NOT NULL DEFAULT nextval('games_id_seq'::regclass),
  home_team_id integer,
  away_team_id integer,
  sport_id text,
  start_time timestamp with time zone,
  venue text,
  home_score integer,
  away_score integer,
  status text,
  external_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  sport character varying,
  league character varying,
  CONSTRAINT games_pkey PRIMARY KEY (id),
  CONSTRAINT games_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id),
  CONSTRAINT games_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.high_school_leagues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  state text,
  classification text,
  member_schools ARRAY,
  sport_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT high_school_leagues_pkey PRIMARY KEY (id),
  CONSTRAINT high_school_leagues_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.import_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  platform USER-DEFINED NOT NULL,
  import_type text,
  status text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  records_imported integer,
  error_message text,
  metadata jsonb,
  CONSTRAINT import_history_pkey PRIMARY KEY (id),
  CONSTRAINT import_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.injuries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id integer,
  injury_type text,
  severity text,
  reported_date date,
  return_date date,
  status text,
  team_id integer,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT injuries_pkey PRIMARY KEY (id),
  CONSTRAINT injuries_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT injuries_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.injury_equipment_correlation (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  injury_type text,
  body_part text,
  equipment_category text,
  correlation_strength numeric,
  sample_size integer,
  study_source text,
  published_at date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT injury_equipment_correlation_pkey PRIMARY KEY (id)
);
CREATE TABLE public.international_competitions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  sport_id uuid,
  year integer,
  host_country text,
  participating_countries ARRAY,
  start_date date,
  end_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT international_competitions_pkey PRIMARY KEY (id),
  CONSTRAINT international_competitions_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.international_rosters (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  competition_id uuid,
  country text NOT NULL,
  player_id uuid,
  jersey_number text,
  position text,
  captain boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT international_rosters_pkey PRIMARY KEY (id),
  CONSTRAINT international_rosters_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.international_competitions(id)
);
CREATE TABLE public.league_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_id uuid,
  user_team_id uuid,
  joined_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT league_members_pkey PRIMARY KEY (id),
  CONSTRAINT league_members_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.user_leagues(id),
  CONSTRAINT league_members_user_team_id_fkey FOREIGN KEY (user_team_id) REFERENCES public.user_teams(id)
);
CREATE TABLE public.leagues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sport_id uuid,
  name text NOT NULL,
  abbreviation text,
  level USER-DEFINED NOT NULL,
  country text,
  founded_year integer,
  website text,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leagues_pkey PRIMARY KEY (id),
  CONSTRAINT leagues_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.marketing_campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_name text NOT NULL,
  sponsor_id uuid,
  featured_players ARRAY,
  campaign_type text,
  start_date date,
  end_date date,
  budget numeric,
  impressions integer,
  engagement_metrics jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matchup_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  opponent_team_id uuid,
  games_played integer,
  avg_fantasy_points numeric,
  best_performance jsonb,
  worst_performance jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT matchup_history_pkey PRIMARY KEY (id),
  CONSTRAINT matchup_history_opponent_team_id_fkey FOREIGN KEY (opponent_team_id) REFERENCES public.teams_master(id)
);
CREATE TABLE public.medical_providers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text,
  specialties ARRAY,
  city text,
  state text,
  team_affiliations ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT medical_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ml_predictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  model_name text NOT NULL,
  prediction_type text NOT NULL,
  prediction text NOT NULL,
  confidence double precision NOT NULL,
  features jsonb,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ml_predictions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.news_articles (
  id bigint NOT NULL DEFAULT nextval('news_articles_id_seq'::regclass),
  title text NOT NULL,
  content text,
  summary text,
  url text UNIQUE,
  source text,
  author text,
  sport_id text,
  team_ids ARRAY,
  player_ids ARRAY,
  tags ARRAY,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT news_articles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.nil_deals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  company_name text NOT NULL,
  deal_value numeric,
  start_date date,
  end_date date,
  deal_type text,
  social_requirements jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nil_deals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.officials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  sport_id uuid,
  years_experience integer,
  crew_chief boolean DEFAULT false,
  stats jsonb,
  tendencies jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT officials_pkey PRIMARY KEY (id),
  CONSTRAINT officials_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.platform_connections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  platform USER-DEFINED NOT NULL,
  platform_user_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  scopes text,
  lastWriteAT timestamp with time zone,
  CONSTRAINT platform_connections_pkey PRIMARY KEY (id),
  CONSTRAINT platform_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.player_aau_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  aau_team_id uuid,
  years_played ARRAY,
  jersey_number text,
  position text,
  achievements ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_aau_history_pkey PRIMARY KEY (id),
  CONSTRAINT player_aau_history_aau_team_id_fkey FOREIGN KEY (aau_team_id) REFERENCES public.aau_teams(id)
);
CREATE TABLE public.player_advanced_metrics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  season integer,
  metric_type text,
  value numeric,
  percentile integer,
  league_average numeric,
  calculated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_advanced_metrics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.player_contracts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  team_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_value numeric,
  guaranteed_money numeric,
  signing_bonus numeric,
  annual_salary numeric,
  incentives jsonb,
  contract_type text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_contracts_pkey PRIMARY KEY (id),
  CONSTRAINT player_contracts_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams_master(id)
);
CREATE TABLE public.player_development_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  program_id uuid,
  start_date date,
  end_date date,
  achievements ARRAY,
  coaches ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_development_history_pkey PRIMARY KEY (id),
  CONSTRAINT player_development_history_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.development_programs(id)
);
CREATE TABLE public.player_equipment (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  equipment_id uuid,
  start_date date,
  end_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_equipment_pkey PRIMARY KEY (id),
  CONSTRAINT player_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment_models(id)
);
CREATE TABLE public.player_game_logs (
  id integer NOT NULL DEFAULT nextval('player_game_logs_id_seq'::regclass),
  player_id integer,
  game_id integer,
  team_id integer,
  game_date date NOT NULL,
  opponent_id integer,
  is_home boolean,
  minutes_played integer,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  fantasy_points numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_game_logs_pkey PRIMARY KEY (id),
  CONSTRAINT player_game_logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_game_logs_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id),
  CONSTRAINT player_game_logs_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT player_game_logs_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.teams(id)
);
CREATE TABLE public.player_injuries (
  id integer NOT NULL DEFAULT nextval('player_injuries_id_seq'::regclass),
  player_id integer,
  injury_type text,
  body_part text,
  status text,
  return_date date,
  notes text,
  reported_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_injuries_pkey PRIMARY KEY (id),
  CONSTRAINT player_injuries_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.player_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  media_type text,
  title text,
  url text,
  thumbnail_url text,
  source text,
  published_at timestamp with time zone,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_media_pkey PRIMARY KEY (id)
);
CREATE TABLE public.player_medical_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  provider_id uuid,
  visit_date date,
  visit_type text,
  body_part text,
  treatment_type text,
  recovery_time_days integer,
  cleared_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_medical_history_pkey PRIMARY KEY (id),
  CONSTRAINT player_medical_history_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.medical_providers(id)
);
CREATE TABLE public.player_platform_mapping (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  platform USER-DEFINED NOT NULL,
  platform_player_id text NOT NULL,
  platform_data jsonb,
  confidence_score numeric,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_platform_mapping_pkey PRIMARY KEY (id)
);
CREATE TABLE public.player_projections (
  id bigint NOT NULL DEFAULT nextval('player_projections_id_seq'::regclass),
  player_name character varying NOT NULL,
  player_id character varying,
  team character varying,
  position character varying,
  week integer,
  season integer DEFAULT 2024,
  projected_points numeric,
  projected_points_ppr numeric,
  projected_passing_yards numeric,
  projected_passing_tds numeric,
  projected_rushing_yards numeric,
  projected_rushing_tds numeric,
  projected_receiving_yards numeric,
  projected_receiving_tds numeric,
  projected_receptions numeric,
  platform character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  external_id character varying NOT NULL UNIQUE,
  CONSTRAINT player_projections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.player_season_stats (
  id integer NOT NULL DEFAULT nextval('player_season_stats_id_seq'::regclass),
  player_id integer,
  season integer NOT NULL,
  season_type character varying DEFAULT 'regular'::character varying,
  team_id integer,
  games_played integer DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_season_stats_pkey PRIMARY KEY (id),
  CONSTRAINT player_season_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_season_stats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.player_stats (
  id integer NOT NULL DEFAULT nextval('player_stats_id_seq'::regclass),
  player_id integer,
  game_id integer,
  stat_type text,
  stat_value jsonb,
  fantasy_points numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_stats_pkey PRIMARY KEY (id),
  CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_stats_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);
CREATE TABLE public.player_training (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  facility_id uuid,
  trainer_name text,
  training_type text,
  start_date date,
  end_date date,
  focus_areas ARRAY,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_training_pkey PRIMARY KEY (id),
  CONSTRAINT player_training_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.training_facilities(id)
);
CREATE TABLE public.player_trends (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  metric_name text NOT NULL,
  time_period text,
  trend_value numeric,
  trend_direction text,
  confidence numeric,
  calculated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_trends_pkey PRIMARY KEY (id)
);
CREATE TABLE public.players (
  id bigint NOT NULL DEFAULT nextval('players_id_seq'::regclass),
  firstname text,
  lastname text,
  position ARRAY,
  team_id integer,
  jersey_number integer,
  heightinches integer,
  weightlbs integer,
  birthdate date,
  status text,
  sport_id text,
  external_id text UNIQUE,
  photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  team_abbreviation character varying,
  metadata jsonb DEFAULT '{}'::jsonb,
  search_vector tsvector,
  name character varying,
  team character varying,
  sport character varying,
  college character varying,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.prop_bets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  game_id uuid,
  player_id uuid,
  prop_type text NOT NULL,
  line numeric,
  over_odds integer,
  under_odds integer,
  sportsbook text,
  timestamp timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prop_bets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recruiting_profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  graduation_year integer,
  gpa numeric,
  sat_score integer,
  act_score integer,
  star_rating integer CHECK (star_rating >= 1 AND star_rating <= 5),
  national_rank integer,
  position_rank integer,
  state_rank integer,
  committed_school_id uuid,
  commitment_date date,
  other_offers ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recruiting_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT recruiting_profiles_committed_school_id_fkey FOREIGN KEY (committed_school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.schools (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text CHECK (type = ANY (ARRAY['high_school'::text, 'college'::text, 'university'::text])),
  city text,
  state text,
  country text,
  enrollment integer,
  athletics_website text,
  mascot text,
  colors ARRAY,
  conference_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schools_pkey PRIMARY KEY (id)
);
CREATE TABLE public.scouting_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  player_id uuid,
  scout_name text,
  organization text,
  report_date date,
  strengths ARRAY,
  weaknesses ARRAY,
  overall_grade text,
  position_grade text,
  athleticism_score integer,
  skill_scores jsonb,
  projection text,
  comparison_players ARRAY,
  detailed_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scouting_reports_pkey PRIMARY KEY (id)
);
CREATE TABLE public.social_media_accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  entity_type text,
  entity_id uuid,
  platform text,
  handle text,
  verified boolean DEFAULT false,
  followers_count integer,
  following_count integer,
  posts_count integer,
  engagement_rate numeric,
  last_updated timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_media_accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.social_media_posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  account_id uuid,
  post_id text,
  content text,
  post_type text,
  media_urls ARRAY,
  likes integer,
  comments integer,
  shares integer,
  sentiment_score numeric,
  posted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_media_posts_pkey PRIMARY KEY (id),
  CONSTRAINT social_media_posts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.social_media_accounts(id)
);
CREATE TABLE public.social_mentions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  platform text NOT NULL,
  post_id text,
  player_id uuid,
  content text,
  author text,
  posted_at timestamp with time zone,
  engagement_score integer,
  sentiment numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_mentions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.social_sentiment (
  id bigint NOT NULL DEFAULT nextval('social_sentiment_id_seq'::regclass),
  platform character varying NOT NULL,
  content text NOT NULL,
  author character varying,
  score integer DEFAULT 0,
  url character varying,
  sport_id character varying,
  mentions ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  external_id character varying NOT NULL UNIQUE,
  engagement_score integer DEFAULT 0,
  urgency character varying,
  sentiment character varying,
  CONSTRAINT social_sentiment_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sponsorship_deals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  entity_type text,
  entity_id uuid,
  sponsor_name text NOT NULL,
  deal_type text,
  start_date date,
  end_date date,
  total_value numeric,
  annual_value numeric,
  performance_bonuses jsonb,
  activation_requirements jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sponsorship_deals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  sport_type USER-DEFINED NOT NULL,
  description text,
  rules_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sports_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sync_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  entity_type text NOT NULL,
  entity_id uuid,
  sync_source text,
  sync_status text,
  last_sync_at timestamp with time zone DEFAULT now(),
  next_sync_at timestamp with time zone,
  sync_data jsonb,
  CONSTRAINT sync_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.team_chemistry_metrics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid,
  season integer,
  chemistry_score numeric,
  lineup_combinations jsonb,
  best_lineups jsonb,
  worst_lineups jsonb,
  calculated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_chemistry_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT team_chemistry_metrics_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams_master(id)
);
CREATE TABLE public.teams (
  id bigint NOT NULL DEFAULT nextval('teams_id_seq'::regclass),
  name text NOT NULL,
  city text,
  abbreviation text,
  sport_id text,
  league_id text,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  external_id text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  sport character varying,
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.teams_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  league_id uuid,
  name text NOT NULL,
  city text,
  abbreviation text,
  founded_year integer,
  home_venue text,
  logo_url text,
  primary_color text,
  secondary_color text,
  website text,
  social_media jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_master_pkey PRIMARY KEY (id),
  CONSTRAINT teams_master_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id)
);
CREATE TABLE public.training_facilities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text,
  city text,
  state text,
  features jsonb,
  notable_trainers ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_facilities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.trending_players (
  id bigint NOT NULL DEFAULT nextval('trending_players_id_seq'::regclass),
  player_name character varying NOT NULL,
  player_id character varying,
  trend_type character varying,
  platform character varying NOT NULL,
  ownership_change numeric,
  mentions_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  external_id character varying NOT NULL UNIQUE,
  CONSTRAINT trending_players_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_leagues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_name character varying NOT NULL,
  commissioner_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  CONSTRAINT user_leagues_pkey PRIMARY KEY (id),
  CONSTRAINT user_leagues_commissioner_id_fkey FOREIGN KEY (commissioner_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  favorite_teams ARRAY,
  favorite_players ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_roster (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_team_id uuid,
  player_id bigint,
  acquired_date timestamp with time zone DEFAULT now(),
  acquisition_type character varying,
  roster_position character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roster_pkey PRIMARY KEY (id),
  CONSTRAINT user_roster_user_team_id_fkey FOREIGN KEY (user_team_id) REFERENCES public.user_teams(id),
  CONSTRAINT user_roster_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.user_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  team_name character varying NOT NULL,
  league_type character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT user_teams_pkey PRIMARY KEY (id),
  CONSTRAINT user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_team_id uuid,
  transaction_type character varying NOT NULL,
  player_id bigint,
  transaction_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT user_transactions_user_team_id_fkey FOREIGN KEY (user_team_id) REFERENCES public.user_teams(id),
  CONSTRAINT user_transactions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  username character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  profile_data jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.venues (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city text,
  state text,
  country text,
  capacity integer,
  surface_type text,
  roof_type text,
  elevation_feet integer,
  year_built integer,
  coordinates jsonb,
  timezone text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT venues_pkey PRIMARY KEY (id)
);
CREATE TABLE public.video_content (
  id bigint NOT NULL DEFAULT nextval('video_content_id_seq'::regclass),
  title character varying NOT NULL,
  channel_name character varying,
  channel_id character varying,
  video_id character varying NOT NULL UNIQUE,
  description text,
  thumbnail_url character varying,
  duration integer,
  view_count integer,
  like_count integer,
  comment_count integer,
  published_at timestamp with time zone,
  players_mentioned ARRAY,
  teams_mentioned ARRAY,
  tags ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT video_content_pkey PRIMARY KEY (id)
);
CREATE TABLE public.weather_conditions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  game_id uuid,
  venue text,
  game_time timestamp with time zone,
  temperature_f integer,
  wind_mph integer,
  wind_direction text,
  precipitation_type text,
  precipitation_chance integer,
  humidity_percent integer,
  conditions text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weather_conditions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.weather_data (
  id integer NOT NULL DEFAULT nextval('weather_data_id_seq'::regclass),
  game_id integer,
  temperature integer,
  wind_speed integer,
  wind_direction text,
  precipitation numeric,
  humidity integer,
  conditions text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weather_data_pkey PRIMARY KEY (id),
  CONSTRAINT weather_data_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id)
);