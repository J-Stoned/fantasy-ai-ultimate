import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'fantasy_ai_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function investigate2021NFLData() {
  console.log('🔍 Investigating 2021 NFL Data Status...\n');

  try {
    // 1. Check player_game_logs for 2021 NFL stats
    console.log('1. Checking player_game_logs for 2021 NFL stats:');
    const [statsCount] = await pool.query(`
      SELECT 
        COUNT(*) as total_stats,
        MIN(game_date) as earliest_date,
        MAX(game_date) as latest_date,
        COUNT(DISTINCT player_id) as unique_players,
        COUNT(DISTINCT game_id) as unique_games
      FROM player_game_logs
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
    `);
    console.log(statsCount[0]);

    // 2. Check monthly distribution of 2021 NFL stats
    console.log('\n2. Monthly distribution of 2021 NFL stats:');
    const [monthlyStats] = await pool.query(`
      SELECT 
        MONTH(game_date) as month,
        MONTHNAME(game_date) as month_name,
        COUNT(*) as stat_count,
        COUNT(DISTINCT game_id) as game_count,
        MIN(game_date) as first_game,
        MAX(game_date) as last_game
      FROM player_game_logs
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
      GROUP BY MONTH(game_date)
      ORDER BY MONTH(game_date)
    `);
    console.table(monthlyStats);

    // 3. Check games table for 2021 NFL games
    console.log('\n3. Checking games table for 2021 NFL games:');
    const [gamesCount] = await pool.query(`
      SELECT 
        COUNT(*) as total_games,
        MIN(game_date) as earliest_date,
        MAX(game_date) as latest_date
      FROM games
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
    `);
    console.log(gamesCount[0]);

    // 4. Monthly distribution of games
    console.log('\n4. Monthly distribution of 2021 NFL games:');
    const [monthlyGames] = await pool.query(`
      SELECT 
        MONTH(game_date) as month,
        MONTHNAME(game_date) as month_name,
        COUNT(*) as game_count,
        MIN(game_date) as first_game,
        MAX(game_date) as last_game
      FROM games
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
      GROUP BY MONTH(game_date)
      ORDER BY MONTH(game_date)
    `);
    console.table(monthlyGames);

    // 5. Check for any recent deletions or modifications
    console.log('\n5. Checking for recent modifications (last inserted games):');
    const [recentGames] = await pool.query(`
      SELECT 
        id,
        espn_id,
        game_date,
        home_team_id,
        away_team_id,
        created_at
      FROM games
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
      ORDER BY id DESC
      LIMIT 10
    `);
    console.table(recentGames);

    // 6. Check if there are stats without corresponding games
    console.log('\n6. Checking for orphaned stats (stats without games):');
    const [orphanedStats] = await pool.query(`
      SELECT 
        COUNT(*) as orphaned_count,
        MIN(pgl.game_date) as earliest_orphan,
        MAX(pgl.game_date) as latest_orphan
      FROM player_game_logs pgl
      LEFT JOIN games g ON pgl.game_id = g.id
      WHERE pgl.sport = 'NFL' 
      AND YEAR(pgl.game_date) = 2021
      AND g.id IS NULL
    `);
    console.log(orphanedStats[0]);

    // 7. Check betting lines for 2021 (might indicate full season was collected)
    console.log('\n7. Checking betting_lines for 2021 NFL games:');
    const [bettingLines] = await pool.query(`
      SELECT 
        COUNT(*) as total_lines,
        MIN(bl.created_at) as earliest_line,
        MAX(bl.created_at) as latest_line,
        MIN(g.game_date) as earliest_game,
        MAX(g.game_date) as latest_game
      FROM betting_lines bl
      JOIN games g ON bl.game_id = g.id
      WHERE g.sport = 'NFL' 
      AND YEAR(g.game_date) = 2021
    `);
    console.log(bettingLines[0]);

    // 8. Check weather data for 2021
    console.log('\n8. Checking weather_data for 2021 NFL games:');
    const [weatherData] = await pool.query(`
      SELECT 
        COUNT(*) as total_weather,
        MIN(wd.created_at) as earliest_weather,
        MAX(wd.created_at) as latest_weather,
        MIN(g.game_date) as earliest_game,
        MAX(g.game_date) as latest_game
      FROM weather_data wd
      JOIN games g ON wd.game_id = g.id
      WHERE g.sport = 'NFL' 
      AND YEAR(g.game_date) = 2021
    `);
    console.log(weatherData[0]);

    // 9. Sample of actual game dates to see the pattern
    console.log('\n9. Sample of 2021 NFL game dates:');
    const [sampleDates] = await pool.query(`
      SELECT DISTINCT
        game_date,
        COUNT(*) as games_on_date
      FROM games
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
      GROUP BY game_date
      ORDER BY game_date
      LIMIT 20
    `);
    console.table(sampleDates);

    // 10. Check total NFL games by year
    console.log('\n10. Total NFL games by year:');
    const [gamesByYear] = await pool.query(`
      SELECT 
        YEAR(game_date) as year,
        COUNT(*) as game_count,
        MIN(game_date) as first_game,
        MAX(game_date) as last_game
      FROM games
      WHERE sport = 'NFL'
      GROUP BY YEAR(game_date)
      ORDER BY YEAR(game_date)
    `);
    console.table(gamesByYear);

    // 11. Check ESPN ID patterns for 2021
    console.log('\n11. Checking ESPN ID patterns for 2021 NFL games:');
    const [espnIdPatterns] = await pool.query(`
      SELECT 
        SUBSTRING(espn_id, 1, 4) as year_prefix,
        COUNT(*) as count
      FROM games
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
      GROUP BY SUBSTRING(espn_id, 1, 4)
    `);
    console.table(espnIdPatterns);

    // 12. Check for duplicate game entries
    console.log('\n12. Checking for duplicate game entries in 2021:');
    const [duplicates] = await pool.query(`
      SELECT 
        game_date,
        home_team_id,
        away_team_id,
        COUNT(*) as duplicate_count
      FROM games
      WHERE sport = 'NFL' 
      AND YEAR(game_date) = 2021
      GROUP BY game_date, home_team_id, away_team_id
      HAVING COUNT(*) > 1
    `);
    console.table(duplicates);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

investigate2021NFLData();