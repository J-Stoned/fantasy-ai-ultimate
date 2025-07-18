import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMiLBLiveFeed() {
  console.log(chalk.cyan('🔍 Checking MiLB Live Feed for Hidden Stats\n'));
  
  // Get some MiLB games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_score, away_score')
    .eq('sport', 'MILB')
    .gt('home_score', 0)  // Completed games
    .limit(10);
    
  if (!games || games.length === 0) {
    console.log('No MiLB games found');
    return;
  }
  
  let gamesWithHiddenStats = 0;
  let totalHiddenStats = 0;
  
  for (const game of games) {
    const gameId = game.external_id.replace('mlb_milb_', '');
    
    try {
      // Try the live feed endpoint
      const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/feed/live`, {
        timeout: 5000
      });
      
      const liveData = response.data.liveData;
      
      if (liveData?.boxscore?.teams) {
        const teams = liveData.boxscore.teams;
        let gameStats = 0;
        
        ['away', 'home'].forEach(side => {
          const players = teams[side]?.players || {};
          
          Object.values(players).forEach((player: any) => {
            if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
              gameStats++;
            }
            if (player.stats?.pitching && Object.keys(player.stats.pitching).length > 0) {
              gameStats++;
            }
          });
        });
        
        if (gameStats > 0) {
          gamesWithHiddenStats++;
          totalHiddenStats += gameStats;
          console.log(chalk.green(`✅ Game ${gameId}: ${gameStats} player stats found in /feed/live!`));
          
          // Check if we already have these stats
          const { count: existingStats } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id);
            
          if (existingStats === 0) {
            console.log(chalk.yellow(`   → NEW STATS DISCOVERED! Not in database!`));
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.log(chalk.red(`Game ${gameId}: Error - ${error.message}`));
      }
    }
  }
  
  console.log(chalk.cyan(`\n📊 RESULTS:`));
  console.log(`Games checked: ${games.length}`);
  console.log(`Games with hidden stats: ${gamesWithHiddenStats}`);
  console.log(`Total hidden stats found: ${totalHiddenStats}`);
  
  if (gamesWithHiddenStats > 0) {
    const percentage = Math.round(gamesWithHiddenStats / games.length * 100);
    console.log(chalk.green(`\n🎯 ${percentage}% of games have stats in /feed/live endpoint!`));
    console.log(chalk.yellow('We should collect these immediately!'));
  }
}

checkMiLBLiveFeed().catch(console.error);