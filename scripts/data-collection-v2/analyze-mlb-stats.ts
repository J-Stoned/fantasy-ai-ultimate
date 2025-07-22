#!/usr/bin/env tsx
import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';

async function analyzeMLBStats() {
  console.log(chalk.cyan.bold('\n⚾ MLB STATS ANALYSIS\n'));
  
  try {
    // Basic calculations
    const games = 12567;
    const stats = 134641;
    const statsPerGame = stats / games;
    const playersPerTeam = statsPerGame / 2; // 2 teams per game
    
    console.log(chalk.yellow('Expected vs Actual:'));
    console.log(`  Total MLB games: ${games.toLocaleString()}`);
    console.log(`  Total MLB stats: ${stats.toLocaleString()}`);
    console.log(`  Stats per game: ${statsPerGame.toFixed(1)}`);
    console.log(`  Players per team: ${playersPerTeam.toFixed(1)}`);
    
    // Expected: ~25 players per team (9 starters + bench + pitchers)
    const expectedPlayersPerTeam = 25;
    const expectedStatsPerGame = expectedPlayersPerTeam * 2;
    const expectedTotalStats = games * expectedStatsPerGame;
    
    console.log(chalk.cyan('\nExpected Stats:'));
    console.log(`  Players per team: ~${expectedPlayersPerTeam}`);
    console.log(`  Stats per game: ~${expectedStatsPerGame}`);
    console.log(`  Expected total: ~${expectedTotalStats.toLocaleString()}`);
    console.log(`  Coverage: ${(stats / expectedTotalStats * 100).toFixed(1)}%`);
    
    // Check actual data
    const analysis = await pgPool.query(`
      WITH game_stats AS (
        SELECT 
          g.id,
          g.game_date,
          COUNT(DISTINCT pgs.player_id) as players_in_game,
          COUNT(pgs.id) as stats_in_game
        FROM games_master g
        LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
        WHERE g.sport = 'MLB'
        GROUP BY g.id, g.game_date
      )
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN stats_in_game > 0 THEN 1 END) as games_with_stats,
        AVG(players_in_game) as avg_players_per_game,
        MIN(players_in_game) as min_players,
        MAX(players_in_game) as max_players,
        AVG(stats_in_game) as avg_stats_per_game
      FROM game_stats
    `);
    
    const result = analysis.rows[0];
    console.log(chalk.green('\nActual MLB Stats Distribution:'));
    console.log(`  Games with stats: ${result.games_with_stats}/${result.total_games}`);
    console.log(`  Avg players per game: ${parseFloat(result.avg_players_per_game).toFixed(1)}`);
    console.log(`  Min players in a game: ${result.min_players}`);
    console.log(`  Max players in a game: ${result.max_players}`);
    
    // Sample some games to see the pattern
    const sampleGames = await pgPool.query(`
      SELECT 
        g.id,
        g.game_date,
        g.home_team_id,
        g.away_team_id,
        COUNT(pgs.id) as player_stats
      FROM games_master g
      LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
      WHERE g.sport = 'MLB'
      GROUP BY g.id
      ORDER BY g.game_date DESC
      LIMIT 10
    `);
    
    console.log(chalk.yellow('\nSample of recent MLB games:'));
    sampleGames.rows.forEach(game => {
      const date = new Date(game.game_date).toLocaleDateString();
      console.log(`  Game ${game.id} (${date}): ${game.player_stats} player stats`);
    });
    
    // Check which games are missing stats
    const missingStats = await pgPool.query(`
      SELECT COUNT(*) as games_without_stats
      FROM games_master g
      WHERE g.sport = 'MLB'
      AND NOT EXISTS (
        SELECT 1 FROM player_game_stats pgs WHERE pgs.game_id = g.id
      )
    `);
    
    console.log(chalk.red(`\nGames missing stats: ${missingStats.rows[0].games_without_stats}`));
    
    // Conclusion
    console.log(chalk.cyan.bold('\n📊 CONCLUSION:'));
    if (playersPerTeam < 15) {
      console.log(chalk.red('❌ MLB stats collection appears INCOMPLETE'));
      console.log(chalk.red(`   Only ${playersPerTeam.toFixed(1)} players per team (expected ~25)`));
      console.log(chalk.red(`   Missing ~${(expectedTotalStats - stats).toLocaleString()} stats`));
      console.log(chalk.yellow('\n   Need to re-run MLB stats collector!'));
    } else {
      console.log(chalk.green('✅ MLB stats collection appears complete'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

analyzeMLBStats();