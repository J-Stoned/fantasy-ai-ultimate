#!/usr/bin/env tsx
/**
 * Test one of the remaining unprocessed games
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

async function testRemainingGame() {
  console.log(chalk.bold.cyan('\n🧪 TESTING REMAINING GAME\n'));

  try {
    const gameId = 3184098; // From the unprocessed list
    
    // Get game details
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (error || !game) {
      console.log(chalk.red(`Game not found: ${error?.message}`));
      return;
    }
    
    console.log('Game details:');
    console.log(`  ID: ${game.id}`);
    console.log(`  External ID: ${game.external_id}`);
    console.log(`  Date: ${game.start_time}`);
    console.log(`  Sport: ${game.sport_id}`);
    console.log(`  Score: ${game.home_score} - ${game.away_score}`);
    
    // Check if it meets our filtering criteria
    const isCompleted = game.home_score !== null && game.away_score !== null;
    const isNonZero = game.home_score !== 0 && game.away_score !== 0;
    const is2024Plus = new Date(game.start_time) >= new Date('2024-01-01');
    const isPast = new Date(game.start_time) <= new Date();
    
    console.log('\nFiltering check:');
    console.log(`  Has scores: ${isCompleted}`);
    console.log(`  Non-zero scores: ${isNonZero}`);
    console.log(`  2024+: ${is2024Plus}`);
    console.log(`  In past: ${isPast}`);
    console.log(`  Should be processed: ${isCompleted && isNonZero && is2024Plus && isPast}`);
    
    // Test ESPN API
    if (game.external_id) {
      const espnId = game.external_id.replace(/^(?:espn_)?(?:nfl_|nba_|mlb_|nhl_)/, '');
      console.log(`\nESPN test:`);
      console.log(`  Original: ${game.external_id}`);
      console.log(`  Extracted: ${espnId}`);
      
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
          {
            params: { event: espnId },
            timeout: 10000
          }
        );
        
        console.log(chalk.green(`  ✅ ESPN API: ${response.status}`));
        
        const boxscore = response.data.boxscore;
        if (boxscore && boxscore.players) {
          let totalPlayers = 0;
          boxscore.players.forEach((team: any) => {
            team.statistics?.forEach((category: any) => {
              totalPlayers += category.athletes?.length || 0;
            });
          });
          
          console.log(`  Players available: ${totalPlayers}`);
          
          if (totalPlayers > 0) {
            console.log(chalk.green(`  ✅ ESPN has data - game should work!`));
          } else {
            console.log(chalk.red(`  ❌ No player data in ESPN`));
          }
        } else {
          console.log(chalk.red(`  ❌ No boxscore in ESPN response`));
        }
        
      } catch (apiError: any) {
        console.log(chalk.red(`  ❌ ESPN API Error: ${apiError.response?.status || apiError.message}`));
      }
    }
    
    // Check if it's already processed
    const { count: logsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);
    
    console.log(`\nCurrent stats: ${logsCount || 0} game logs`);

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

testRemainingGame();