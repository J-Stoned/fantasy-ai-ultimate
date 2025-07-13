#!/usr/bin/env tsx
/**
 * Find the actual swapped stats based on ID ranges
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findSwappedStats() {
  console.log(chalk.bold.red('\n🚨 FINDING ACTUAL SWAPPED STATS\n'));
  
  // Based on the earlier finding: 109,329 stats where game_id is in player ID range
  // Player ID range starts at 24, so let's look for game_ids >= 24 and < typical game range
  
  // First, let's understand the typical game_id range
  const { data: gameStats } = await supabase
    .from('games')
    .select('id')
    .order('id')
    .limit(100);
    
  const gameIds = gameStats?.map(g => g.id) || [];
  console.log(chalk.yellow(`Sample game IDs: ${gameIds.slice(0, 10).join(', ')}`));
  
  // Now look for stats where game_id is too low (in player range)
  const { data: swappedStats, count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .gte('game_id', 24)
    .lt('game_id', 1000) // Games typically have much higher IDs
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log(chalk.red(`\nFound ${count} stats with game_id < 1000 (likely player IDs)\n`));
  
  if (swappedStats && swappedStats.length > 0) {
    for (const stat of swappedStats.slice(0, 5)) {
      console.log(chalk.cyan(`\nStat ID: ${stat.id}`));
      console.log(`Created: ${stat.created_at}`);
      console.log(`Stat: ${stat.stat_type} = ${stat.stat_value}`);
      console.log(`game_id: ${stat.game_id}, player_id: ${stat.player_id}`);
      
      // Check what these IDs actually are
      const { data: gameAsPlayer } = await supabase
        .from('players')
        .select('id, firstname, lastname, sport_id')
        .eq('id', stat.game_id)
        .single();
        
      const { data: playerAsGame } = await supabase
        .from('games')
        .select('id, external_id, sport_id, home_score, away_score')
        .eq('id', stat.player_id)
        .single();
        
      if (gameAsPlayer && playerAsGame) {
        console.log(chalk.red('\n  🔄 CONFIRMED SWAP:'));
        console.log(chalk.red(`  game_id (${stat.game_id}) = Player: ${gameAsPlayer.firstname} ${gameAsPlayer.lastname} (${gameAsPlayer.sport_id})`));
        console.log(chalk.red(`  player_id (${stat.player_id}) = Game: ${playerAsGame.external_id}, Score: ${playerAsGame.home_score}-${playerAsGame.away_score}`));
      }
    }
  }
  
  // Let's also check for any stats where player_id is in game range
  console.log(chalk.yellow('\n\n🔍 Checking reverse case (player_id in game range)...'));
  
  const { data: reverseSwapped, count: reverseCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .gte('player_id', 3000000) // Games are in millions range
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log(chalk.red(`\nFound ${reverseCount} stats with player_id > 3M (likely game IDs)\n`));
  
  if (reverseSwapped && reverseSwapped.length > 0) {
    for (const stat of reverseSwapped.slice(0, 3)) {
      const { data: playerIdAsGame } = await supabase
        .from('games')
        .select('external_id, sport_id')
        .eq('id', stat.player_id)
        .single();
        
      if (playerIdAsGame) {
        console.log(chalk.red(`\nFound stat where player_id (${stat.player_id}) is actually game: ${playerIdAsGame.external_id}`));
      }
    }
  }
  
  // Find which collector script created these
  console.log(chalk.yellow('\n\n📅 When were these swapped stats created?'));
  
  const { data: timeline } = await supabase
    .from('player_stats')
    .select('created_at')
    .gte('game_id', 24)
    .lt('game_id', 1000)
    .order('created_at')
    .limit(1);
    
  if (timeline && timeline.length > 0) {
    console.log(`First swapped stat: ${timeline[0].created_at}`);
  }
  
  const { data: recentTimeline } = await supabase
    .from('player_stats')
    .select('created_at')
    .gte('game_id', 24)
    .lt('game_id', 1000)
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (recentTimeline && recentTimeline.length > 0) {
    console.log(`Most recent swapped stat: ${recentTimeline[0].created_at}`);
  }
}

findSwappedStats().catch(console.error);