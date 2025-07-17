#!/usr/bin/env tsx
/**
 * Fix sport field in all player_game_logs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixStatsSportField() {
  console.log(chalk.bold.blue('FIXING SPORT FIELD IN PLAYER_GAME_LOGS\n'));
  
  // First, let's understand the data structure
  console.log(chalk.yellow('Analyzing stats structure...'));
  
  // Get total count
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total stats to fix: ${totalStats?.toLocaleString()}`);
  
  // The approach: player_game_logs → player → sport
  console.log(chalk.yellow('\nApproach: Using player_id to get sport from players table'));
  
  // Get sports distribution
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  
  for (const sport of sports) {
    console.log(chalk.cyan(`\nProcessing ${sport}...`));
    
    // First, get all player IDs for this sport
    const { data: players } = await supabase
      .from('players')
      .select('id')
      .eq('sport', sport);
      
    if (!players || players.length === 0) {
      console.log(`  No players found for ${sport}`);
      continue;
    }
    
    console.log(`  Found ${players.length} players`);
    const playerIds = players.map(p => p.id);
    
    // Update stats in batches
    const batchSize = 500;
    let updated = 0;
    
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batch = playerIds.slice(i, i + batchSize);
      
      const { count: updateCount } = await supabase
        .from('player_game_logs')
        .update({ sport: sport })
        .in('player_id', batch)
        .is('sport', null);
        
      updated += updateCount || 0;
      
      if (i % 2000 === 0 && i > 0) {
        console.log(`    Progress: ${i}/${playerIds.length} players processed (${updated.toLocaleString()} stats updated)`);
      }
    }
    
    console.log(chalk.green(`  ✅ Updated ${updated.toLocaleString()} stats for ${sport}`));
  }
  
  // Final verification
  console.log(chalk.yellow('\n\nFinal verification...'));
  
  const { count: remaining } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
    
  const { count: populated } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('sport', 'is', null);
    
  console.log(`\nStats with NULL sport: ${remaining?.toLocaleString() || 0}`);
  console.log(`Stats with sport populated: ${populated?.toLocaleString() || 0}`);
  
  if (remaining === 0) {
    console.log(chalk.bold.green('\n✅ All stats now have sport field populated!'));
  } else {
    console.log(chalk.yellow(`\n⚠️  ${remaining} stats still have NULL sport`));
    
    // Check why
    const { data: sample } = await supabase
      .from('player_game_logs')
      .select('id, player_id')
      .is('sport', null)
      .limit(5);
      
    if (sample && sample.length > 0) {
      console.log('\nSample stats with NULL sport:');
      for (const stat of sample) {
        const { data: player } = await supabase
          .from('players')
          .select('name, sport')
          .eq('id', stat.player_id)
          .single();
          
        console.log(`  Stat ${stat.id}: Player ${player?.name || 'Unknown'} (${player?.sport || 'NULL sport'})`);
      }
    }
  }
}

fixStatsSportField().catch(console.error);