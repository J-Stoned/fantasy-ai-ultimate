#!/usr/bin/env tsx
/**
 * Test specific NFL games that failed to process
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testFailedNFLGames() {
  console.log(chalk.bold.cyan('\n🧪 TESTING FAILED NFL GAMES\n'));

  try {
    // Get sample unprocessed games
    const testGameIds = [3183744, 3183743, 3183742, 3183741, 3183740];
    
    for (const gameId of testGameIds) {
      console.log(chalk.yellow(`\nTesting game ID: ${gameId}`));
      
      // Get game details
      const { data: game, error } = await supabase
        .from('games')
        .select('id, external_id, sport_id, start_time, home_score, away_score')
        .eq('id', gameId)
        .single();
      
      if (error || !game) {
        console.log(chalk.red(`  ❌ Game not found: ${error?.message}`));
        continue;
      }
      
      console.log(`  External ID: ${game.external_id}`);
      console.log(`  Date: ${game.start_time}`);
      console.log(`  Score: ${game.home_score} - ${game.away_score}`);
      
      // Test ESPN API call
      if (game.external_id) {
        const espnId = game.external_id.replace(/^(?:espn_)?(?:nfl_)?/, '');
        console.log(`  ESPN ID: ${espnId}`);
        
        try {
          const response = await axios.get(
            `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
            {
              params: { event: espnId },
              timeout: 10000
            }
          );
          
          console.log(chalk.green(`  ✅ ESPN API: ${response.status}`));
          
          // Check if boxscore data exists
          const boxscore = response.data.boxscore;
          if (boxscore && boxscore.players) {
            const teamCount = boxscore.players.length;
            let totalPlayers = 0;
            
            boxscore.players.forEach((team: any) => {
              team.statistics?.forEach((category: any) => {
                totalPlayers += category.athletes?.length || 0;
              });
            });
            
            console.log(`  Teams: ${teamCount}, Players: ${totalPlayers}`);
            
            if (totalPlayers === 0) {
              console.log(chalk.red(`  ❌ No player data in ESPN response`));
            } else {
              console.log(chalk.green(`  ✅ ESPN has player data`));
            }
          } else {
            console.log(chalk.red(`  ❌ No boxscore in ESPN response`));
          }
          
        } catch (apiError: any) {
          console.log(chalk.red(`  ❌ ESPN API Error: ${apiError.response?.status || apiError.message}`));
        }
      } else {
        console.log(chalk.red(`  ❌ No external_id`));
      }
      
      // Check if this game actually has stats
      const { count: statsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
      
      console.log(`  Current stats: ${statsCount || 0} game logs`);
    }
    
    console.log(chalk.bold.cyan('\n🔍 INVESTIGATION SUMMARY:'));
    console.log('Testing specific games to understand why 989 processed but only 175 got stats');

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

testFailedNFLGames();