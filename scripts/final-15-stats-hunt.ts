#!/usr/bin/env tsx
/**
 * 🎯 HUNT FOR THE FINAL 15 STATS PER GAME
 * 
 * Current: 63/78 (81%)
 * Missing: 15 stats per game = 3,855 total stats
 * 
 * LET'S GET TO 100%!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(12);

async function huntFinal15Stats() {
  console.log(chalk.bold.cyan('🎯 HUNTING FOR THE FINAL 15 STATS PER GAME!\n'));
  console.log(chalk.red('Current: 63/78 (Missing 15 per game = 3,855 total)\n'));

  // Get all 2021 games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  if (!games) return;

  // Sample 10 games to find patterns
  const sampleGames = games.slice(0, 10);
  
  const missingPatterns: Record<string, number> = {};
  const missingPlayerIds = new Set<string>();
  let totalMissing = 0;

  console.log(chalk.yellow('Analyzing 10 sample games...\n'));

  for (const game of sampleGames) {
    // Get current stats for this game
    const { count: currentCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id);

    // Get ESPN data
    const espnGameId = game.external_id?.split('_').pop();
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
    
    try {
      const response = await axios.get(url, { timeout: 10000 });
      const gameData = response.data;

      let expectedStats = 0;

      if (gameData.boxscore?.players) {
        for (const team of gameData.boxscore.players) {
          for (const statGroup of team.statistics || []) {
            expectedStats += statGroup.athletes?.length || 0;
            
            // Check each athlete
            for (const athlete of statGroup.athletes || []) {
              const playerId = `espn_nfl_${athlete.athlete?.id}`;
              
              // Track missing patterns
              if (!athlete.stats || athlete.stats.length === 0) {
                missingPatterns['empty_stats'] = (missingPatterns['empty_stats'] || 0) + 1;
              }
              
              // Check if this is a special teams or situational stat
              if (['kickReturns', 'puntReturns', 'kickoff'].includes(statGroup.name)) {
                missingPatterns['special_teams'] = (missingPatterns['special_teams'] || 0) + 1;
              }
              
              // Track potentially missing players
              missingPlayerIds.add(playerId);
            }
          }
        }
      }

      const missing = expectedStats - (currentCount || 0);
      totalMissing += missing;
      
      console.log(chalk.gray(`Game ${game.external_id}: ${currentCount}/${expectedStats} (missing ${missing})`));
    } catch (error) {
      console.error(chalk.red(`Error processing game: ${error}`));
    }
  }

  console.log(chalk.bold.yellow('\n📊 MISSING PATTERNS FOUND:'));
  Object.entries(missingPatterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count} occurrences`);
  });

  // Check which players we might be missing
  const { data: existingPlayers } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport', 'NFL');

  const existingSet = new Set(existingPlayers?.map(p => p.external_id) || []);
  const stillMissingPlayers = Array.from(missingPlayerIds).filter(id => !existingSet.has(id));

  console.log(chalk.red(`\n⚠️  Still missing ${stillMissingPlayers.length} players from sample games`));

  // SOLUTION STRATEGY
  console.log(chalk.bold.green('\n🚀 STRATEGY TO GET FINAL 15 STATS:\n'));
  
  console.log(chalk.cyan('1. ADD REMAINING PLAYERS:'));
  console.log(`   - ${stillMissingPlayers.length} players still missing`);
  
  console.log(chalk.cyan('\n2. CHECK STAT GROUP FILTERING:'));
  console.log('   - Ensure we\'re not filtering out valid stats');
  console.log('   - Check for stats with 0 values that might be skipped');
  
  console.log(chalk.cyan('\n3. SPECIAL TEAMS & SITUATIONAL STATS:'));
  console.log('   - Many games have 0 kick/punt returns but players are listed');
  console.log('   - We might be skipping these "0 stat" entries');
  
  console.log(chalk.cyan('\n4. DUPLICATE PLAYER ENTRIES:'));
  console.log('   - Players appearing in multiple positions (QB in passing AND rushing)');
  console.log('   - Make sure we count each appearance');

  // Average missing per game in sample
  const avgMissingInSample = totalMissing / sampleGames.length;
  console.log(chalk.bold.red(`\n📈 Sample shows ~${Math.round(avgMissingInSample)} missing stats per game`));
  
  if (Math.abs(avgMissingInSample - 15) < 3) {
    console.log(chalk.green('✅ This matches our overall missing count!'));
  }

  return { stillMissingPlayers, missingPatterns };
}

// Execute the hunt!
huntFinal15Stats().catch(console.error);