const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres'
});

async function investigateDatabase() {
  console.log('🔍 Investigating Pattern Query Issues...\n');

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!\n');

    // 1. Check games table structure and sample data
    console.log('1. GAMES TABLE STRUCTURE:');
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'games'
      ORDER BY ordinal_position
    `);
    console.table(columnsResult.rows);

    // 2. Sample games data
    console.log('\n2. SAMPLE GAMES DATA:');
    const gamesResult = await client.query(`
      SELECT id, sport, start_time, status, home_team_id, away_team_id, home_score, away_score
      FROM games
      LIMIT 5
    `);
    console.table(gamesResult.rows);

    // 3. Check start_time data types and formats
    console.log('\n3. START_TIME DATA ANALYSIS:');
    const timeAnalysis = await client.query(`
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
    const citiesResult = await client.query(`
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
    console.log('\n5. ALL UNIQUE CITIES (first 30):');
    const allCities = await client.query(`
      SELECT DISTINCT city, COUNT(*) as team_count
      FROM teams
      WHERE city IS NOT NULL
      GROUP BY city
      ORDER BY city
      LIMIT 30
    `);
    console.table(allCities.rows);

    // 6. Check betting_lines structure
    console.log('\n6. BETTING_LINES TABLE STRUCTURE:');
    const bettingColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'betting_lines'
      ORDER BY ordinal_position
    `);
    console.table(bettingColumns.rows);

    // 7. Sample betting_lines data
    console.log('\n7. SAMPLE BETTING_LINES DATA:');
    const bettingResult = await client.query(`
      SELECT game_id, home_line, away_line, home_moneyline, away_moneyline, over_under
      FROM betting_lines
      LIMIT 5
    `);
    console.table(bettingResult.rows);

    // 8. Check for games with back-to-back scheduling
    console.log('\n8. BACK-TO-BACK GAMES CHECK:');
    const backToBackCheck = await client.query(`
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
    const statusValues = await client.query(`
      SELECT status, COUNT(*) as count
      FROM games
      GROUP BY status
      ORDER BY count DESC
    `);
    console.table(statusValues.rows);

    // 10. Check teams table league_id column
    console.log('\n10. TEAMS TABLE LEAGUE_ID CHECK:');
    const leagueCheck = await client.query(`
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
    const altitudeTest = await client.query(`
      SELECT COUNT(*) as total_games_with_altitude_teams
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      WHERE ht.city IS NOT NULL
        AND g.status = 'final'
    `);
    console.log('Games with home team city data:', altitudeTest.rows[0].total_games_with_altitude_teams);

    // 12. Check data type compatibility for date calculations
    console.log('\n12. DATE CALCULATION TEST:');
    const dateCalcTest = await client.query(`
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

    // 13. Check betting_lines foreign key relationships
    console.log('\n13. BETTING_LINES FOREIGN KEY CHECK:');
    const bettingFKCheck = await client.query(`
      SELECT 
        COUNT(DISTINCT bl.game_id) as betting_games,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT bl.game_id) FILTER (WHERE g.id IS NULL) as orphaned_betting_lines
      FROM betting_lines bl
      LEFT JOIN games g ON bl.game_id = g.id
    `);
    console.table(bettingFKCheck.rows);

    // 14. Test actual pattern queries with row counts
    console.log('\n14. TESTING ACTUAL PATTERN QUERIES:');
    
    // Back-to-back fade test
    const b2bTest = await client.query(`
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
      SELECT COUNT(*) as back_to_back_count
      FROM team_games tg
      LEFT JOIN betting_lines bl ON bl.game_id = tg.id
      WHERE DATE_PART('hour', (tg.start_time::timestamp - tg.prev_game_time::timestamp)) < 30
        AND tg.prev_game_time IS NOT NULL
    `);
    console.log('Back-to-back games found:', b2bTest.rows[0].back_to_back_count);

    // Altitude advantage test
    const altAdvTest = await client.query(`
      SELECT COUNT(*) as altitude_games
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      LEFT JOIN betting_lines bl ON bl.game_id = g.id
      WHERE ht.city IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
        AND at.city NOT IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary')
        AND g.status = 'final'
    `);
    console.log('Altitude advantage games found:', altAdvTest.rows[0].altitude_games);

    // 15. Check if there are any NULL status values
    console.log('\n15. NULL STATUS CHECK:');
    const nullStatusCheck = await client.query(`
      SELECT COUNT(*) as null_status_count
      FROM games
      WHERE status IS NULL
    `);
    console.log('Games with NULL status:', nullStatusCheck.rows[0].null_status_count);

    // 16. Check if cities match exactly (case sensitivity)
    console.log('\n16. CITY NAME VARIATIONS:');
    const cityVariations = await client.query(`
      SELECT city, COUNT(*) as count
      FROM teams
      WHERE LOWER(city) IN ('denver', 'salt lake city', 'phoenix', 'calgary')
      GROUP BY city
      ORDER BY city
    `);
    console.table(cityVariations.rows);

  } catch (error) {
    console.error('Error investigating database:', error);
  } finally {
    await client.end();
    console.log('\n✅ Investigation complete!');
  }
}

investigateDatabase().catch(console.error);