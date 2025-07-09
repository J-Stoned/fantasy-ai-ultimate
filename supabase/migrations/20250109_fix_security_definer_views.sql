-- Fix SECURITY DEFINER views by recreating them without SECURITY DEFINER
-- This addresses the security warnings about views with elevated permissions

-- Drop and recreate v_player_stats_simple without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_player_stats_simple CASCADE;
CREATE VIEW public.v_player_stats_simple AS
SELECT 
    p.id,
    p.name,
    p.position,
    p.team,
    ps.points,
    ps.rebounds,
    ps.assists,
    ps.steals,
    ps.blocks,
    ps.turnovers,
    ps.field_goals_made,
    ps.field_goals_attempted,
    ps.three_pointers_made,
    ps.three_pointers_attempted,
    ps.free_throws_made,
    ps.free_throws_attempted,
    ps.minutes,
    ps.game_date
FROM public.players p
LEFT JOIN public.player_stats ps ON p.id = ps.player_id;

-- Drop and recreate v_player_all_stats without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_player_all_stats CASCADE;
CREATE VIEW public.v_player_all_stats AS
SELECT 
    p.*,
    ps.*,
    pss.games_played,
    pss.season,
    pss.average_points,
    pss.average_rebounds,
    pss.average_assists
FROM public.players p
LEFT JOIN public.player_stats ps ON p.id = ps.player_id
LEFT JOIN public.player_season_stats pss ON p.id = pss.player_id;

-- Drop and recreate vw_social_sentiment_summary without SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_social_sentiment_summary CASCADE;
CREATE VIEW public.vw_social_sentiment_summary AS
SELECT 
    player_id,
    COUNT(*) as mention_count,
    AVG(sentiment_score) as avg_sentiment,
    MAX(created_at) as last_mention,
    COUNT(CASE WHEN sentiment_score > 0.5 THEN 1 END) as positive_mentions,
    COUNT(CASE WHEN sentiment_score < -0.5 THEN 1 END) as negative_mentions
FROM public.social_sentiment
GROUP BY player_id;

-- Drop and recreate vw_top_trending_players without SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_top_trending_players CASCADE;
CREATE VIEW public.vw_top_trending_players AS
SELECT 
    tp.player_id,
    p.name as player_name,
    p.position,
    p.team,
    tp.trend_score,
    tp.volume_change,
    tp.sentiment_change,
    tp.created_at
FROM public.trending_players tp
JOIN public.players p ON tp.player_id = p.id
ORDER BY tp.trend_score DESC
LIMIT 50;

-- Drop and recreate vw_current_week_projections without SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_current_week_projections CASCADE;
CREATE VIEW public.vw_current_week_projections AS
SELECT 
    pp.player_id,
    p.name as player_name,
    p.position,
    p.team,
    pp.projected_points,
    pp.confidence_score,
    pp.projection_date,
    pp.week,
    pp.season
FROM public.player_projections pp
JOIN public.players p ON pp.player_id = p.id
WHERE pp.projection_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY pp.projected_points DESC;

-- Drop and recreate vw_breaking_injuries without SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_breaking_injuries CASCADE;
CREATE VIEW public.vw_breaking_injuries AS
SELECT 
    pi.player_id,
    p.name as player_name,
    p.position,
    p.team,
    pi.injury_status,
    pi.injury_description,
    pi.return_date,
    pi.updated_at
FROM public.player_injuries pi
JOIN public.players p ON pi.player_id = p.id
WHERE pi.injury_status IN ('Out', 'Doubtful', 'Questionable')
  AND pi.updated_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY pi.updated_at DESC;

-- Grant SELECT permissions on views to authenticated users
GRANT SELECT ON public.v_player_stats_simple TO authenticated;
GRANT SELECT ON public.v_player_all_stats TO authenticated;
GRANT SELECT ON public.vw_social_sentiment_summary TO authenticated;
GRANT SELECT ON public.vw_top_trending_players TO authenticated;
GRANT SELECT ON public.vw_current_week_projections TO authenticated;
GRANT SELECT ON public.vw_breaking_injuries TO authenticated;

-- Grant SELECT permissions on views to anon users (for public API access)
GRANT SELECT ON public.v_player_stats_simple TO anon;
GRANT SELECT ON public.v_player_all_stats TO anon;
GRANT SELECT ON public.vw_social_sentiment_summary TO anon;
GRANT SELECT ON public.vw_top_trending_players TO anon;
GRANT SELECT ON public.vw_current_week_projections TO anon;
GRANT SELECT ON public.vw_breaking_injuries TO anon;