import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugStatsIssue() {
  console.log(chalk.cyan('🔍 Debugging NCAA Baseball Stats Issue\n'));
  
  // 1. Get a sample game with stats
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .in('game_id', 
      await supabase
        .from('games')
        .select('id')
        .eq('sport', 'NCAA_BASEBALL')
        .eq('status', 'completed')
        .limit(100)
        .then(res => res.data?.map(g => g.id) || [])
    )
    .limit(10);
    
  if (!gamesWithStats || gamesWithStats.length === 0) {
    console.log(chalk.red('No games with stats found!'));
    return;
  }
  
  const gameId = gamesWithStats[0].game_id;
  
  // 2. Get game details
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
    
  console.log(chalk.yellow(`Sample Game: ${game.external_id}`));
  console.log(`Date: ${game.start_time}`);
  console.log(`Score: ${game.home_score} - ${game.away_score}\n`);
  
  // 3. Count stats for this game
  const { data: gameStats, count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .eq('game_id', gameId);
    
  console.log(chalk.blue(`Stats in database for this game: ${count}`));
  
  // 4. Check ESPN API for this game
  const espnGameId = game.external_id.replace('espn_ncaa_baseball_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${espnGameId}`;
  
  console.log(chalk.gray(`\nChecking ESPN API: ${url}\n`));
  
  try {
    const response = await axios.get(url);
    
    if (response.data.boxscore?.players) {
      let totalBatters = 0;
      let totalPitchers = 0;
      
      for (const teamData of response.data.boxscore.players) {
        console.log(chalk.yellow(`Team: ${teamData.team?.displayName || 'Unknown'}`));
        
        for (const category of teamData.statistics || []) {
          const athleteCount = category.athletes?.length || 0;
          console.log(`  ${category.name}: ${athleteCount} players`);
          
          if (category.name === 'batting') totalBatters += athleteCount;
          if (category.name === 'pitching') totalPitchers += athleteCount;
          
          // Show first few players
          if (athleteCount > 0 && category.athletes) {
            for (let i = 0; i < Math.min(3, athleteCount); i++) {
              const athlete = category.athletes[i];
              console.log(chalk.gray(`    - ${athlete.athlete?.displayName}: ${athlete.stats?.join(', ')}`));
            }
            if (athleteCount > 3) {
              console.log(chalk.gray(`    ... and ${athleteCount - 3} more`));
            }
          }
        }
        console.log('');
      }
      
      console.log(chalk.green(`Total from ESPN API:`));
      console.log(`  Batters: ${totalBatters}`);
      console.log(`  Pitchers: ${totalPitchers}`);
      console.log(`  Total: ${totalBatters + totalPitchers} stats available`);
      
      console.log(chalk.red(`\n⚠️  ISSUE: We stored ${count} but ESPN has ${totalBatters + totalPitchers}!`));
      console.log(chalk.red(`Missing: ${(totalBatters + totalPitchers) - (count || 0)} stats (${(((count || 0) / (totalBatters + totalPitchers)) * 100).toFixed(1)}% capture rate)`));
      
    } else {
      console.log(chalk.red('No boxscore data found in ESPN response'));
    }
    
  } catch (error) {
    console.log(chalk.red(`Error fetching from ESPN: ${error}`));
  }
  
  // 5. Check our stat parsing
  if (gameStats && gameStats.length > 0) {
    console.log(chalk.blue('\nSample stored stats:'));
    gameStats.slice(0, 3).forEach(stat => {
      console.log(`Player ID: ${stat.player_id}, Type: ${stat.stat_type}`);
      console.log(`Stats: ${JSON.stringify(stat.stat_value)}`);
      console.log('---');
    });
  }
  
  // 6. Check for common issues
  console.log(chalk.cyan('\n🔍 Checking for common issues...'));
  
  // Check for failed player lookups
  const { count: playersWithoutIds } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL')
    .is('id', null);
    
  console.log(`Players without IDs: ${playersWithoutIds || 0}`);
  
  // Check stat distribution
  const { data: statDist } = await supabase
    .rpc('get_ncaa_baseball_stat_distribution', {});
    
  console.log('\nPossible issues:');
  console.log('1. Stats with empty/invalid values being filtered out');
  console.log('2. Player ID mapping failures');
  console.log('3. Parsing errors for certain stat formats');
  console.log('4. Database insert failures not being reported');
}

debugStatsIssue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });