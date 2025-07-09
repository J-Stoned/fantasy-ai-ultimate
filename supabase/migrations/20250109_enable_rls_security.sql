-- Enable Row Level Security (RLS) on all public tables
-- This migration addresses the security warnings from Supabase

-- Enable RLS on all tables
ALTER TABLE public.collection_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correlation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_sentiment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dfs_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaking_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betting_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Create basic read policies for public data (non-user specific tables)
-- These tables contain public sports data that should be readable by everyone

-- Public sports data tables (read-only for everyone)
CREATE POLICY "Public read access" ON public.games FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.player_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.player_injuries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.player_game_logs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.player_season_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.player_projections FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.injuries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.trending_players FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.social_sentiment FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.fantasy_rankings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.dfs_salaries FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.breaking_news FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.video_content FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.betting_odds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.weather_data FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.news_articles FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.ml_predictions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.correlation_insights FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.collection_state FOR SELECT USING (true);

-- User-specific tables (requires authentication)
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own teams" ON public.user_teams 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own roster" ON public.user_roster 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.user_transactions 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own leagues" ON public.user_leagues 
  FOR SELECT USING (auth.uid() = user_id);

-- League members can see other members in their leagues
CREATE POLICY "League members can view league data" ON public.league_members 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_leagues 
      WHERE user_leagues.league_id = league_members.league_id 
      AND user_leagues.user_id = auth.uid()
    )
  );

-- Service role bypass for all tables (allows backend operations)
-- This ensures our server-side operations continue to work
CREATE POLICY "Service role full access" ON public.collection_state FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.correlation_insights FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.ml_predictions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.trending_players FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.injuries FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.player_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.player_injuries FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.games FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.teams FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.player_game_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.player_season_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.social_sentiment FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.fantasy_rankings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.players FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.player_projections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.dfs_salaries FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.breaking_news FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.video_content FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.betting_odds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.user_teams FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.user_roster FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.user_transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.user_leagues FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.league_members FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.weather_data FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON public.news_articles FOR ALL USING (auth.role() = 'service_role');