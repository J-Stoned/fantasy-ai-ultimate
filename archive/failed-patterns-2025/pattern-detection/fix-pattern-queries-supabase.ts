/**
 * Fixed Pattern Queries for Supabase
 * 
 * These queries are adapted to work with the actual Supabase schema
 */

export const SUPABASE_PATTERN_QUERIES = {
  altitudeAdvantage: `
    SELECT 
      g.*,
      ht.city as home_city,
      at.city as away_city,
      bl.away_line as away_spread,
      bl.home_line as home_spread,
      bl.over_under
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    WHERE ht.city IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
      AND at.city NOT IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
      AND (g.status = 'completed' OR g.status = 'STATUS_FINAL')
      AND bl.away_line IS NOT NULL
    ORDER BY g.start_time DESC
  `,

  backToBackFade: `
    WITH game_schedule AS (
      SELECT 
        g.*,
        LAG(g.start_time) OVER (PARTITION BY g.away_team_id ORDER BY g.start_time) as prev_game_time
      FROM games g
      WHERE (g.status = 'completed' OR g.status = 'STATUS_FINAL')
    )
    SELECT 
      gs.*,
      ht.city as home_city,
      at.city as away_city,
      bl.away_line as away_spread,
      bl.home_line as home_spread,
      bl.over_under,
      EXTRACT(EPOCH FROM (gs.start_time - gs.prev_game_time))/3600 as hours_between_games
    FROM game_schedule gs
    JOIN teams ht ON gs.home_team_id = ht.id
    JOIN teams at ON gs.away_team_id = at.id
    LEFT JOIN betting_lines bl ON gs.id = bl.game_id
    WHERE gs.prev_game_time IS NOT NULL
      AND gs.start_time - gs.prev_game_time < INTERVAL '24 hours'
      AND bl.away_line IS NOT NULL
    ORDER BY gs.start_time DESC
  `,

  embarrassmentRevenge: `
    WITH blowout_losses AS (
      SELECT 
        g.id,
        g.away_team_id as losing_team_id,
        g.home_team_id as winning_team_id,
        g.start_time,
        (g.home_score - g.away_score) as loss_margin
      FROM games g
      WHERE (g.status = 'completed' OR g.status = 'STATUS_FINAL')
        AND g.home_score - g.away_score >= 20
      
      UNION ALL
      
      SELECT 
        g.id,
        g.home_team_id as losing_team_id,
        g.away_team_id as winning_team_id,
        g.start_time,
        (g.away_score - g.home_score) as loss_margin
      FROM games g
      WHERE (g.status = 'completed' OR g.status = 'STATUS_FINAL')
        AND g.away_score - g.home_score >= 20
    )
    SELECT 
      g.*,
      ht.city as home_city,
      at.city as away_city,
      bl.away_line as away_spread,
      bl.home_line as home_spread,
      bl.over_under,
      blow.loss_margin as previous_loss_margin,
      blow.start_time as blowout_date
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    JOIN blowout_losses blow ON 
      ((g.home_team_id = blow.losing_team_id AND g.away_team_id = blow.winning_team_id) OR
       (g.away_team_id = blow.losing_team_id AND g.home_team_id = blow.winning_team_id))
      AND g.start_time > blow.start_time
      AND g.start_time - blow.start_time < INTERVAL '30 days'
    WHERE bl.away_line IS NOT NULL
    ORDER BY g.start_time DESC
  `,

  divisionDogBite: `
    WITH team_divisions AS (
      SELECT DISTINCT
        t1.id as team1_id,
        t2.id as team2_id,
        t1.sport
      FROM teams t1
      JOIN teams t2 ON t1.sport = t2.sport 
      WHERE t1.id != t2.id
        AND t1.metadata->>'division' = t2.metadata->>'division'
        AND t1.metadata->>'division' IS NOT NULL
    )
    SELECT 
      g.*,
      ht.city as home_city,
      at.city as away_city,
      bl.away_line as away_spread,
      bl.home_line as home_spread,
      bl.over_under
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    JOIN team_divisions td ON 
      (td.team1_id = g.home_team_id AND td.team2_id = g.away_team_id) OR
      (td.team1_id = g.away_team_id AND td.team2_id = g.home_team_id)
    WHERE bl.home_line > 7
      AND bl.away_line IS NOT NULL
      AND (g.status = 'completed' OR g.status = 'STATUS_FINAL' OR g.status = 'scheduled')
    ORDER BY g.start_time DESC
  `,

  perfectStorm: `
    WITH ranked_games AS (
      SELECT 
        g.*,
        ROW_NUMBER() OVER (PARTITION BY g.home_team_id ORDER BY g.start_time DESC) as home_game_num
      FROM games g
      WHERE (g.status = 'completed' OR g.status = 'STATUS_FINAL')
    ),
    team_recent_form AS (
      SELECT 
        team_id,
        COUNT(CASE WHEN won THEN 1 END) as recent_wins,
        COUNT(*) as recent_games
      FROM (
        SELECT home_team_id as team_id, home_score > away_score as won
        FROM games 
        WHERE (status = 'completed' OR status = 'STATUS_FINAL')
          AND start_time > CURRENT_DATE - INTERVAL '14 days'
        UNION ALL
        SELECT away_team_id as team_id, away_score > home_score as won
        FROM games 
        WHERE (status = 'completed' OR status = 'STATUS_FINAL')
          AND start_time > CURRENT_DATE - INTERVAL '14 days'
      ) recent
      GROUP BY team_id
    )
    SELECT 
      g.*,
      ht.city as home_city,
      at.city as away_city,
      bl.away_line as away_spread,
      bl.home_line as home_spread,
      bl.over_under,
      hf.recent_wins as home_recent_wins,
      hf.recent_games as home_recent_games,
      af.recent_wins as away_recent_wins,
      af.recent_games as away_recent_games
    FROM ranked_games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    LEFT JOIN team_recent_form hf ON hf.team_id = g.home_team_id
    LEFT JOIN team_recent_form af ON af.team_id = g.away_team_id
    WHERE g.home_game_num = 1
      AND hf.recent_games >= 3
      AND af.recent_games >= 3
      AND hf.recent_wins::float / NULLIF(hf.recent_games, 0) < 0.4
      AND af.recent_wins::float / NULLIF(af.recent_games, 0) > 0.6
      AND bl.away_line IS NOT NULL
    ORDER BY g.start_time DESC
  `
};

// Export the correct queries based on environment
export const FIXED_PATTERN_QUERIES = SUPABASE_PATTERN_QUERIES;