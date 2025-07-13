import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerStatsCoverage() {
  console.log(chalk.bold.blue('\n📊 PLAYER STATS COVERAGE ANALYSIS (FIXED)\n'));
  
  // Total records in player_stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('📈 PLAYER STATS TABLE:'));
  console.log(chalk.white(`   Total records: ${totalStats?.toLocaleString() || 0}`));
  
  // Get unique player IDs - properly
  console.log(chalk.gray('   Fetching unique players (this may take a moment)...'));
  
  // Use a different approach - get distinct player_ids
  const { data: allPlayerStats, error } = await supabase
    .from('player_stats')
    .select('player_id');

  if (error) {
    console.error('Error fetching player stats:', error);
    return;
  }

  const uniquePlayerIds = new Set(allPlayerStats?.map(p => p.player_id).filter(id => id !== null) || []);
  console.log(chalk.white(`   Unique players with stats: ${uniquePlayerIds.size.toLocaleString()}`));
  
  // Total players in database
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.white(`   Total players in database: ${totalPlayers?.toLocaleString() || 0}`));
  
  const coverage = totalPlayers ? (uniquePlayerIds.size / totalPlayers * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   Coverage: ${coverage}%\n`));
  
  // Breakdown by stat type (using correct column name)
  console.log(chalk.yellow('🏆 STATS BY TYPE:'));
  
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_type')
    .limit(10000); // Sample for performance
  
  if (statTypes) {
    const typeCount: { [key: string]: number } = {};
    statTypes.forEach(stat => {
      if (stat.stat_type) {
        typeCount[stat.stat_type] = (typeCount[stat.stat_type] || 0) + 1;
      }
    });
    
    Object.entries(typeCount)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(chalk.white(`   ${type}: ${count.toLocaleString()}`));
      });
  }
  
  // Check game coverage
  console.log(chalk.yellow('\n📅 GAME COVERAGE:'));
  
  const { data: gameStats } = await supabase
    .from('player_stats')
    .select('game_id');
  
  const uniqueGameIds = new Set(gameStats?.map(g => g.game_id).filter(id => id !== null) || []);
  console.log(chalk.white(`   Games with player stats: ${uniqueGameIds.size.toLocaleString()}`));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`   Total completed games: ${totalGames?.toLocaleString() || 0}`));
  
  const gameCoverage = totalGames ? (uniqueGameIds.size / totalGames * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   Game coverage: ${gameCoverage}%`));
  
  // Check by sport - join with games to get sport
  console.log(chalk.yellow('\n🏈 COVERAGE BY SPORT:'));
  
  for (const sport of ['NFL', 'NBA', 'MLB', 'NHL']) {
    // Get games for this sport
    const { data: sportGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .limit(500);
    
    if (sportGames && sportGames.length > 0) {
      const gameIds = sportGames.map(g => g.id);
      
      // Count stats for these games
      const { count: statsCount } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .in('game_id', gameIds);
      
      // Count unique games with stats
      const { data: gamesWithStats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', gameIds);
      
      const uniqueGamesWithStats = new Set(gamesWithStats?.map(g => g.game_id) || []);
      
      console.log(chalk.white(`   ${sport}:`));
      console.log(chalk.gray(`     - Total stats: ${statsCount?.toLocaleString() || 0}`));
      console.log(chalk.gray(`     - Games checked: ${sportGames.length}`));
      console.log(chalk.gray(`     - Games with stats: ${uniqueGamesWithStats.size}`));
    }
  }
  
  // Sample of players with most stats
  console.log(chalk.yellow('\n🌟 TOP 10 PLAYERS BY STAT COUNT:'));
  
  // Count stats per player
  const playerStatCounts: { [key: number]: number } = {};
  if (allPlayerStats) {
    allPlayerStats.forEach(stat => {
      if (stat.player_id) {
        playerStatCounts[stat.player_id] = (playerStatCounts[stat.player_id] || 0) + 1;
      }
    });
  }
  
  const topPlayerIds = Object.entries(playerStatCounts)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 10)
    .map(([id, count]) => ({ id: parseInt(id), count }));
  
  // Get player details
  const { data: playerDetails } = await supabase
    .from('players')
    .select('id, firstname, lastname, sport_id')
    .in('id', topPlayerIds.map(p => p.id));
  
  if (playerDetails) {
    topPlayerIds.forEach(({ id, count }) => {
      const player = playerDetails.find(p => p.id === id);
      if (player) {
        console.log(chalk.white(`   ${player.firstname} ${player.lastname} (${player.sport_id || 'unknown'}): ${count.toLocaleString()} stats`));
      }
    });
  }
  
  console.log(chalk.bold.yellow('\n📊 SUMMARY:'));
  console.log(chalk.white(`Total stats: ${totalStats?.toLocaleString() || 0}`));
  console.log(chalk.white(`Unique players: ${uniquePlayerIds.size.toLocaleString()}`));
  console.log(chalk.white(`Player coverage: ${coverage}%`));
  console.log(chalk.white(`Game coverage: ${gameCoverage}%\n`));
  
  if (parseFloat(gameCoverage) > 20) {
    console.log(chalk.bold.green('✅ GOOD NEWS: Significant game coverage found!'));
    console.log(chalk.white('The ultimate-stats-collector-v2 appears to have worked.\n'));
  } else {
    console.log(chalk.bold.red('⚠️  CRITICAL: Low game coverage!'));
    console.log(chalk.white('Need to run stats collection for more games.\n'));
  }
}

checkPlayerStatsCoverage().catch(console.error);