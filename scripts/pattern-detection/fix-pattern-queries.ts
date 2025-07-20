// Fixed pattern queries for your actual schema
export const FIXED_PATTERN_QUERIES = {
  backToBackFade: `
    WITH team_games AS (
      SELECT 
        g.id,
        g.away_team_id,
        g.home_team_id,
        g.start_time,
        g.sport,
        LAG(g.start_time) OVER (PARTITION BY g.away_team_id ORDER BY g.start_time) as prev_game_time
      FROM games g
      WHERE g.status = 'final'
    )
    SELECT 
      tg.*,
      bl.away_line as away_spread,
      bl.away_moneyline,
      bl.over_under as total_over_under
    FROM team_games tg
    LEFT JOIN betting_lines bl ON bl.game_id = tg.id
    WHERE DATE_PART('hour', (tg.start_time::timestamp - tg.prev_game_time::timestamp)) < 30
      AND tg.prev_game_time IS NOT NULL
  `,
  
  revengeGame: `
    WITH matchups AS (
      SELECT 
        g1.id,
        g1.home_team_id,
        g1.away_team_id,
        g1.start_time,
        g1.sport,
        g1.home_score,
        g1.away_score,
        g2.id as prev_game_id,
        g2.home_score as prev_home_score,
        g2.away_score as prev_away_score
      FROM games g1
      JOIN games g2 ON 
        ((g1.home_team_id = g2.away_team_id AND g1.away_team_id = g2.home_team_id) OR
         (g1.home_team_id = g2.home_team_id AND g1.away_team_id = g2.away_team_id))
        AND g2.start_time < g1.start_time
        AND g2.status = 'final'
      WHERE g1.status = 'final'
    )
    SELECT DISTINCT ON (id) 
      m.*,
      bl.home_line as home_spread,
      bl.home_moneyline,
      bl.away_line as away_spread,
      bl.away_moneyline
    FROM matchups m
    LEFT JOIN betting_lines bl ON bl.game_id = m.id
    WHERE ABS(m.prev_home_score - m.prev_away_score) > 20
    ORDER BY m.id, m.prev_game_id DESC
  `,
  
  perfectStorm: `
    WITH recent_performance AS (
      SELECT 
        t.id as team_id,
        AVG(CASE 
          WHEN g.home_team_id = t.id THEN g.home_score
          ELSE g.away_score
        END) as avg_score_last_5
      FROM teams t
      JOIN games g ON t.id IN (g.home_team_id, g.away_team_id)
      WHERE g.status = 'final'
        AND g.start_time::timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY t.id
    )
    SELECT 
      g.*,
      bl.home_line as home_spread,
      bl.away_line as away_spread,
      rp_home.avg_score_last_5 as home_avg_score,
      rp_away.avg_score_last_5 as away_avg_score
    FROM games g
    JOIN recent_performance rp_home ON rp_home.team_id = g.home_team_id
    JOIN recent_performance rp_away ON rp_away.team_id = g.away_team_id
    LEFT JOIN betting_lines bl ON bl.game_id = g.id
    WHERE ABS(bl.home_line) > 7
  `,
  
  divisionDogBite: `
    WITH division_games AS (
      SELECT 
        g.*,
        CASE 
          WHEN t1.league_id = t2.league_id THEN TRUE
          ELSE FALSE
        END as is_division_game
      FROM games g
      JOIN teams t1 ON g.home_team_id = t1.id
      JOIN teams t2 ON g.away_team_id = t2.id
      WHERE g.status = 'final'
    )
    SELECT 
      dg.*,
      bl.away_line as away_spread,
      bl.home_line as home_spread
    FROM division_games dg
    LEFT JOIN betting_lines bl ON bl.game_id = dg.id
    WHERE dg.is_division_game = TRUE
      AND bl.away_line > 3
  `,
  
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
    LEFT JOIN betting_lines bl ON bl.game_id = g.id
    WHERE ht.city IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
      AND at.city NOT IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
      AND g.status = 'final'
  `
};