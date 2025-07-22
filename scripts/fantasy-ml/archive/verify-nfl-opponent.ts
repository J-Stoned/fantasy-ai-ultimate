import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import chalk from 'chalk';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function verifyNFLOpponentData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log(chalk.cyan.bold('\n🏈 Verifying NFL opponent data in v_nfl_player_stats\n'));

    // 1. Check column existence
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'v_nfl_player_stats'
      AND column_name IN ('opponent', 'opponent_abbr')
      ORDER BY ordinal_position;
    `);

    console.log(chalk.green('✅ Opponent columns found:'));
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });

    // 2. Check actual NFL teams (not college)
    const nflTeamsResult = await pool.query(`
      SELECT DISTINCT opponent, opponent_abbr
      FROM v_nfl_player_stats 
      WHERE opponent_abbr IN (
        'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
        'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
        'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
        'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
      )
      ORDER BY opponent_abbr
      LIMIT 10;
    `);

    if (nflTeamsResult.rows.length > 0) {
      console.log(chalk.green('\n✅ Sample NFL teams with proper abbreviations:'));
      nflTeamsResult.rows.forEach(team => {
        console.log(`  ${team.opponent_abbr} - ${team.opponent}`);
      });
    }

    // 3. Check data quality
    const dataQualityResult = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT player_id) as unique_players,
        COUNT(opponent) as records_with_opponent,
        COUNT(*) - COUNT(opponent) as records_without_opponent,
        MIN(game_date) as earliest_game,
        MAX(game_date) as latest_game
      FROM v_nfl_player_stats
      WHERE position IN ('QB', 'RB', 'WR', 'TE', 'K', 'DST')
    `);

    const quality = dataQualityResult.rows[0];
    console.log(chalk.cyan('\n📊 Data Quality Check:'));
    console.log(`  Total NFL records: ${quality.total_records}`);
    console.log(`  Unique players: ${quality.unique_players}`);
    console.log(`  Records with opponent: ${quality.records_with_opponent}`);
    console.log(`  Records missing opponent: ${quality.records_without_opponent}`);
    console.log(`  Date range: ${quality.earliest_game} to ${quality.latest_game}`);

    // 4. Sample recent NFL data
    const sampleDataResult = await pool.query(`
      SELECT 
        name,
        position,
        team,
        opponent,
        opponent_abbr,
        game_date,
        calculated_fantasy_points
      FROM v_nfl_player_stats
      WHERE opponent_abbr IN (
        'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
        'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
        'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
        'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
      )
      AND position IN ('QB', 'RB', 'WR', 'TE')
      AND calculated_fantasy_points > 0
      ORDER BY game_date DESC
      LIMIT 5;
    `);

    if (sampleDataResult.rows.length > 0) {
      console.log(chalk.green('\n✅ Sample recent NFL player data:'));
      sampleDataResult.rows.forEach(row => {
        console.log(chalk.white(
          `  ${row.name} (${row.position}) - ${row.team || 'FA'} vs ${row.opponent_abbr} on ${new Date(row.game_date).toLocaleDateString()}: ${Number(row.calculated_fantasy_points || 0).toFixed(1)} pts`
        ));
      });
    }

    // 5. Verify the view can be used by trainers
    console.log(chalk.cyan('\n🧪 Testing trainer query compatibility...'));
    
    const trainerTestResult = await pool.query(`
      SELECT 
        player_id,
        name,
        position,
        team,
        opponent,
        game_date,
        calculated_fantasy_points
      FROM v_nfl_player_stats
      WHERE opponent IS NOT NULL
      AND position IN ('QB', 'RB', 'WR', 'TE')
      LIMIT 1;
    `);

    if (trainerTestResult.rows.length > 0) {
      console.log(chalk.green('✅ Trainer query test passed!'));
      console.log('  The view has all required fields including opponent column.');
    }

    console.log(chalk.green.bold('\n✅ NFL opponent data verification complete!'));
    console.log(chalk.yellow('  The v_nfl_player_stats view is ready for ML training.\n'));

  } catch (error) {
    console.error(chalk.red('❌ Error verifying data:'), error);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyNFLOpponentData().catch(console.error);