#!/usr/bin/env tsx
/**
 * Investigate the ID swap issue in detail
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateSwap() {
  console.log(chalk.bold.red('\n🚨 INVESTIGATING ID SWAP ISSUE\n'));
  
  // Get a sample of swapped stats
  const { data: swappedStats } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id, stat_type, stat_value, created_at')
    .gte('game_id', 100000) // Game IDs should be much lower
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (!swappedStats || swappedStats.length === 0) {
    console.log('No swapped stats found');
    return;
  }
  
  console.log(chalk.yellow(`Found ${swappedStats.length} recent swapped stats:\n`));
  
  for (const stat of swappedStats.slice(0, 5)) {
    console.log(chalk.cyan(`\nStat ID: ${stat.id}`));
    console.log(`Created: ${stat.created_at}`);
    console.log(`Type: ${stat.stat_type}, Value: ${stat.stat_value}`);
    
    // Check what game_id actually is
    const { data: supposedGame } = await supabase
      .from('games')
      .select('id, external_id, sport_id')
      .eq('id', stat.game_id)
      .single();
      
    const { data: actualPlayer } = await supabase
      .from('players')
      .select('id, firstname, lastname, sport_id')
      .eq('id', stat.game_id)
      .single();
      
    // Check what player_id actually is  
    const { data: supposedPlayer } = await supabase
      .from('players')
      .select('id, firstname, lastname')
      .eq('id', stat.player_id)
      .single();
      
    const { data: actualGame } = await supabase
      .from('games')
      .select('id, external_id, sport_id, home_score, away_score')
      .eq('id', stat.player_id)
      .single();
      
    console.log(chalk.red('\n  🔄 SWAPPED IDs:'));
    
    if (actualPlayer) {
      console.log(chalk.red(`  game_id (${stat.game_id}) is actually player: ${actualPlayer.firstname} ${actualPlayer.lastname} (${actualPlayer.sport_id})`));
    } else if (supposedGame) {
      console.log(chalk.green(`  game_id (${stat.game_id}) is correctly a game: ${supposedGame.external_id}`));
    }
    
    if (actualGame) {
      console.log(chalk.red(`  player_id (${stat.player_id}) is actually game: ${actualGame.external_id} (${actualGame.sport_id}), Score: ${actualGame.home_score}-${actualGame.away_score}`));
    } else if (supposedPlayer) {
      console.log(chalk.green(`  player_id (${stat.player_id}) is correctly a player: ${supposedPlayer.firstname} ${supposedPlayer.lastname}`));
    }
  }
  
  // Check when this started happening
  console.log(chalk.yellow('\n\n📅 Timeline Analysis:'));
  
  const { data: firstSwapped } = await supabase
    .from('player_stats')
    .select('created_at')
    .gte('game_id', 100000)
    .order('created_at', { ascending: true })
    .limit(1);
    
  if (firstSwapped && firstSwapped.length > 0) {
    console.log(`First swapped stat created at: ${firstSwapped[0].created_at}`);
  }
  
  // Count by created date
  console.log(chalk.yellow('\n📊 Swapped stats by date:'));
  
  const { data: allSwapped } = await supabase
    .from('player_stats')
    .select('created_at')
    .gte('game_id', 100000)
    .order('created_at', { ascending: false })
    .limit(1000);
    
  if (allSwapped) {
    const byDate = allSwapped.reduce((acc: any, stat) => {
      const date = stat.created_at.split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 5)
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count} swapped stats`);
      });
  }
  
  // Find the pattern
  console.log(chalk.yellow('\n\n🔍 Looking for the pattern...'));
  
  // Sample some swapped stats to see if there's a consistent pattern
  const { data: pattern } = await supabase
    .from('player_stats')
    .select('game_id, player_id')
    .gte('game_id', 100000)
    .limit(20);
    
  if (pattern) {
    console.log('\nChecking if the swap is consistent...');
    let consistent = true;
    
    for (const stat of pattern) {
      const { data: isPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('id', stat.game_id)
        .single();
        
      const { data: isGame } = await supabase
        .from('games')
        .select('id')
        .eq('id', stat.player_id)
        .single();
        
      if (!isPlayer || !isGame) {
        consistent = false;
        break;
      }
    }
    
    if (consistent) {
      console.log(chalk.red('✓ The swap is consistent: game_id and player_id are reversed!'));
    } else {
      console.log(chalk.yellow('✗ The swap is not consistent across all records'));
    }
  }
}

investigateSwap().catch(console.error);