import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateStatsCoverageReport() {
  console.log(chalk.bold.blue('\n📊 PLAYER STATS COVERAGE - COMPREHENSIVE REPORT\n'));
  console.log(chalk.gray('Generated on: ' + new Date().toISOString()));
  console.log(chalk.gray('=' .repeat(70) + '\n'));

  // 1. Overall Statistics
  console.log(chalk.bold.yellow('1. OVERALL STATISTICS'));
  
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  const { data: allPlayerIds } = await supabase
    .from('player_stats')
    .select('player_id');
  
  const uniquePlayers = new Set(allPlayerIds?.map(p => p.player_id) || []);
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);

  console.log(`   Total stats records: ${chalk.cyan(totalStats?.toLocaleString() || '0')}`);
  console.log(`   Unique players with stats: ${chalk.cyan(uniquePlayers.size.toString())} out of ${chalk.cyan(totalPlayers?.toLocaleString() || '0')}`);
  console.log(`   Player coverage: ${chalk.cyan((uniquePlayers.size / (totalPlayers || 1) * 100).toFixed(2) + '%')}`);

  // 2. Recent Activity
  console.log(chalk.bold.yellow('\n2. RECENT ACTIVITY (Last 24 Hours)'));
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo);

  console.log(`   Stats inserted: ${chalk.cyan(recentStats?.toLocaleString() || '0')}`);

  // 3. Players with Stats
  console.log(chalk.bold.yellow('\n3. PLAYERS WITH STATS'));
  
  // Get all unique players and their details
  const playerArray = Array.from(uniquePlayers);
  const { data: playerDetails } = await supabase
    .from('players')
    .select('id, firstname, lastname, sport_id')
    .in('id', playerArray);

  if (playerDetails) {
    console.log(`\n   ${chalk.underline('ID')}    ${chalk.underline('Name')}                    ${chalk.underline('Sport')}   ${chalk.underline('Stats Count')}`);
    
    for (const player of playerDetails) {
      const statsCount = allPlayerIds?.filter(p => p.player_id === player.id).length || 0;
      const name = `${player.firstname} ${player.lastname}`.padEnd(24);
      const id = player.id.toString().padEnd(5);
      const sport = (player.sport_id || 'unknown').padEnd(7);
      console.log(`   ${id} ${name} ${sport} ${chalk.cyan(statsCount.toLocaleString())}`);
    }
  }

  // 4. Game Coverage by Sport
  console.log(chalk.bold.yellow('\n4. GAME COVERAGE BY SPORT'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  for (const sport of sports) {
    const { count: sportGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('home_score', 'is', null);

    const { data: sportGamesSample } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .limit(1000);

    let gamesWithStats = 0;
    if (sportGamesSample && sportGamesSample.length > 0) {
      const gameIds = sportGamesSample.map(g => g.id);
      const { data: gamesCheck } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', gameIds);
      
      if (gamesCheck) {
        gamesWithStats = new Set(gamesCheck.map(g => g.game_id)).size;
      }
    }

    const coverage = sportGames ? (gamesWithStats / Math.min(sportGamesSample?.length || 0, sportGames) * 100).toFixed(1) : '0';
    console.log(`\n   ${chalk.bold(sport)}:`);
    console.log(`     Total games: ${chalk.cyan(sportGames?.toLocaleString() || '0')}`);
    console.log(`     Games with stats (sample): ${chalk.cyan(gamesWithStats.toString())} / ${sportGamesSample?.length || 0}`);
    console.log(`     Estimated coverage: ${chalk.cyan(coverage + '%')}`);
  }

  // 5. Issues and Recommendations
  console.log(chalk.bold.yellow('\n5. ISSUES IDENTIFIED'));
  
  console.log(chalk.red('\n   ⚠️  CRITICAL ISSUES:'));
  console.log(`   - Only ${chalk.red(uniquePlayers.size.toString())} players have stats out of ${totalPlayers?.toLocaleString()} total`);
  console.log(`   - Player coverage is ${chalk.red((uniquePlayers.size / (totalPlayers || 1) * 100).toFixed(2) + '%')}`);
  console.log(`   - The ultimate-stats-collector-v2 ran but only collected stats for ${chalk.red('3-4 players')}`);
  
  console.log(chalk.yellow('\n   📋 PROBABLE CAUSE:'));
  console.log('   - The collector might be hitting rate limits or API restrictions');
  console.log('   - The collector might be filtering to only specific players');
  console.log('   - There might be an error in the player selection logic');

  console.log(chalk.green('\n   ✅ RECOMMENDATIONS:'));
  console.log('   1. Check the ultimate-stats-collector-v2 logs for errors');
  console.log('   2. Verify the ESPN API is returning player data correctly');
  console.log('   3. Run the collector for a single game with debug logging');
  console.log('   4. Check if there are rate limiting issues with the ESPN API');
  console.log('   5. Verify the player matching logic between ESPN and our database');

  console.log(chalk.gray('\n' + '=' .repeat(70) + '\n'));
}

generateStatsCoverageReport().catch(console.error);