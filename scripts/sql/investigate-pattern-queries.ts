import { query, queryMany, closePool } from '../utils/local-db-pool';

async function investigateDatabase() {
  console.log('🔍 Investigating Pattern Query Issues...\n');

  try {
    // 1. Check games table structure and sample data
    console.log('1. GAMES TABLE STRUCTURE:');
    const columnsResult = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'games'
      ORDER BY ordinal_position
    `);
    console.table(columnsResult.rows);

    // 2. Sample games data
    console.log('\n2. SAMPLE GAMES DATA:');
    const gamesResult = await query(`
      SELECT id, sport, start_time, status, home_team_id, away_team_id, home_score, away_score
      FROM games
      LIMIT 5
    `);
    console.table(gamesResult.rows);

    // 3. Check start_time data types and formats
    console.log('\n3. START_TIME DATA ANALYSIS:');
    const timeAnalysis = await query(`
      SELECT 
        pg_typeof(start_time) as data_type,
        COUNT(*) as count,
        MIN(start_time) as earliest,
        MAX(start_time) as latest,
        COUNT(CASE WHEN start_time IS NULL THEN 1 END) as null_count
      FROM games
      GROUP BY pg_typeof(start_time)
    `);
    console.table(timeAnalysis.rows);

    // 4. Check teams with high-altitude cities
    console.log('\n4. HIGH-ALTITUDE CITIES CHECK:');
    const citiesResult = await query(`
      SELECT id, name, city, sport
      FROM teams
      WHERE city IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
      OR city LIKE '%Denver%'
      OR city LIKE '%Salt Lake%'
      OR city LIKE '%Phoenix%'
      OR city LIKE '%Calgary%'
    `);
    console.table(citiesResult.rows);

    // 5. All unique cities in teams table
    console.log('\n5. ALL UNIQUE CITIES:');
    const allCities = await query(`
      SELECT DISTINCT city, COUNT(*) as team_count
      FROM teams
      WHERE city IS NOT NULL
      GROUP BY city
      ORDER BY city
      LIMIT 20
    `);
    console.table(allCities.rows);

    // 6. Check betting_lines structure
    console.log('\n6. BETTING_LINES TABLE STRUCTURE:');
    const bettingColumns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'betting_lines'
      ORDER BY ordinal_position
    `);
    console.table(bettingColumns.rows);

    // 7. Sample betting_lines data
    console.log('\n7. SAMPLE BETTING_LINES DATA:');
    const bettingResult = await query(`
      SELECT game_id, home_line, away_line, home_moneyline, away_moneyline, over_under
      FROM betting_lines
      LIMIT 5
    `);
    console.table(bettingResult.rows);

    // 8. Check for games with back-to-back scheduling
    console.log('\n8. BACK-TO-BACK GAMES CHECK:');
    const backToBackCheck = await query(`
      WITH team_games AS (
        SELECT 
          g.id,
          g.away_team_id,
          g.start_time,
          LAG(g.start_time) OVER (PARTITION BY g.away_team_id ORDER BY g.start_time) as prev_game_time
        FROM games g
        WHERE g.status = 'final'
      )
      SELECT COUNT(*) as potential_b2b_games
      FROM team_games
      WHERE prev_game_time IS NOT NULL
        AND EXTRACT(EPOCH FROM (start_time - prev_game_time)) < 108000  -- 30 hours in seconds
    `);
    console.log('Potential back-to-back games:', backToBackCheck.rows[0].potential_b2b_games);

    // 9. Check game status values
    console.log('\n9. GAME STATUS VALUES:');
    const statusValues = await query(`
      SELECT status, COUNT(*) as count
      FROM games
      GROUP BY status
      ORDER BY count DESC
    `);
    console.table(statusValues.rows);

    // 10. Check teams table league_id column
    console.log('\n10. TEAMS TABLE LEAGUE_ID CHECK:');
    const leagueCheck = await query(`
      SELECT 
        CASE 
          WHEN league_id IS NULL THEN 'NULL'
          ELSE 'NOT NULL'
        END as league_status,
        COUNT(*) as count
      FROM teams
      GROUP BY league_status
    `);
    console.table(leagueCheck.rows);

    // 11. Test a simplified altitude advantage query
    console.log('\n11. TESTING SIMPLIFIED ALTITUDE QUERY:');
    const altitudeTest = await query(`
      SELECT COUNT(*) as total_games_with_altitude_teams
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      WHERE ht.city IS NOT NULL
        AND g.status = 'final'
    `);
    console.log('Games with home team city data:', altitudeTest.rows[0].total_games_with_altitude_teams);

    // 12. Check data type compatibility for date calculations
    console.log('\n12. DATE CALCULATION TEST:');
    const dateCalcTest = await query(`
      SELECT 
        id,
        start_time,
        pg_typeof(start_time) as type,
        start_time::timestamp as as_timestamp
      FROM games
      WHERE start_time IS NOT NULL
      LIMIT 1
    `);
    console.table(dateCalcTest.rows);

  } catch (error) {
    console.error('Error investigating database:', error);
  } finally {
    await closePool();
  }
}

investigateDatabase().catch(console.error);