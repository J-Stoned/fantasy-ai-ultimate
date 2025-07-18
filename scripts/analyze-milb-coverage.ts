import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import axios from 'axios';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const httpLimit = pLimit(10);

async function analyzeMiLBCoverage() {
  console.log(chalk.cyan('🔍 Analyzing MiLB Stats Coverage\n'));
  
  // Get sample of games
  const { data: games } = await supabase
    .from('games')
    .select('external_id, start_time, league')
    .eq('sport', 'MILB')
    .gte('start_time', '2024-06-01')
    .lte('start_time', '2024-07-31')
    .limit(100);
    
  if (!games || games.length === 0) {
    console.log('No games found');
    return;
  }
  
  console.log(chalk.yellow(`Analyzing ${games.length} games...\n`));
  
  let gamesWithStats = 0;
  let totalPlayerStats = 0;
  let totalBattingStats = 0;
  let totalPitchingStats = 0;
  const statCounts: any = {};
  
  const promises = games.map(game => 
    httpLimit(async () => {
      try {
        const gameId = game.external_id.replace('mlb_milb_', '');
        const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`);
        const boxscore = response.data;
        
        let gameHasStats = false;
        let gameBatters = 0;
        let gamePitchers = 0;
        
        for (const side of ['away', 'home']) {
          const players = boxscore.teams[side].players;
          
          for (const playerId in players) {
            const player = players[playerId];
            
            if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
              gameBatters++;
              totalBattingStats++;
              gameHasStats = true;
              
              // Count available stats
              for (const stat in player.stats.batting) {
                statCounts[`batting.${stat}`] = (statCounts[`batting.${stat}`] || 0) + 1;
              }
            }
            
            if (player.stats?.pitching && player.stats.pitching.inningsPitched) {
              gamePitchers++;
              totalPitchingStats++;
              gameHasStats = true;
              
              // Count available stats
              for (const stat in player.stats.pitching) {
                statCounts[`pitching.${stat}`] = (statCounts[`pitching.${stat}`] || 0) + 1;
              }
            }
          }
        }
        
        if (gameHasStats) {
          gamesWithStats++;
          totalPlayerStats += gameBatters + gamePitchers;
        }
        
      } catch (error) {
        // Game not found or error
      }
    })
  );
  
  await Promise.all(promises);
  
  console.log(chalk.green('📊 Coverage Summary:'));
  console.log(`Games analyzed: ${games.length}`);
  console.log(`Games with stats: ${gamesWithStats} (${Math.round(gamesWithStats/games.length*100)}%)`);
  console.log(`Total player stats: ${totalPlayerStats}`);
  console.log(`  - Batting: ${totalBattingStats}`);
  console.log(`  - Pitching: ${totalPitchingStats}`);
  console.log(`Average stats per game: ${Math.round(totalPlayerStats/gamesWithStats) || 0}`);
  
  // Show top stats collected
  console.log(chalk.yellow('\n📈 Most common stats:'));
  const sortedStats = Object.entries(statCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 20);
    
  sortedStats.forEach(([stat, count]) => {
    console.log(`  ${stat}: ${count}`);
  });
  
  // Estimate total stats if all games had coverage
  const estimatedTotalStats = Math.round((totalPlayerStats / gamesWithStats) * 3133);
  console.log(chalk.cyan(`\n💡 Estimated total stats if all games had data: ${estimatedTotalStats.toLocaleString()}`));
}

analyzeMiLBCoverage().catch(console.error);