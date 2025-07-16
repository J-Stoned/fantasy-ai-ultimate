#!/usr/bin/env tsx
/**
 * 🔧 FIX NCAA BASKETBALL PLAYERS SPORT FIELD
 * Update NULL sport to NCAA_BB for NCAA Basketball players
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNCAABasketballPlayersSport() {
  console.log(chalk.bold.blue('🔧 FIXING NCAA BASKETBALL PLAYERS SPORT FIELD\n'));
  
  // 1. First, let's identify NCAA Basketball players by their external_id pattern
  console.log(chalk.yellow('1. Finding NCAA Basketball players with NULL sport...'));
  
  const { data: ncaaBBPlayers, count: totalCount } = await supabase
    .from('players')
    .select('id', { count: 'exact' })
    .is('sport', null)
    .ilike('external_id', 'espn_ncaabb_%');
  
  console.log(`Found ${totalCount} NCAA Basketball players with NULL sport`);
  
  if (!ncaaBBPlayers || ncaaBBPlayers.length === 0) {
    console.log('No NCAA Basketball players to fix!');
    return;
  }
  
  // 2. Show sample before update
  console.log(chalk.yellow('\n2. Sample players before update:'));
  
  const { data: sampleBefore } = await supabase
    .from('players')
    .select('id, name, sport, external_id')
    .is('sport', null)
    .ilike('external_id', 'espn_ncaabb_%')
    .limit(5);
  
  sampleBefore?.forEach((player, i) => {
    console.log(`${i + 1}. ${player.name} - Sport: ${player.sport || 'NULL'} - External: ${player.external_id}`);
  });
  
  // 3. Update all NCAA Basketball players
  console.log(chalk.yellow('\n3. Updating NCAA Basketball players...'));
  
  const { error: updateError, count: updatedCount } = await supabase
    .from('players')
    .update({ sport: 'NCAA_BB' })
    .is('sport', null)
    .ilike('external_id', 'espn_ncaabb_%');
  
  if (updateError) {
    console.error(chalk.red(`❌ Error updating players: ${updateError.message}`));
    return;
  }
  
  console.log(chalk.green(`✅ Updated ${updatedCount} players to sport = 'NCAA_BB'`));
  
  // 4. Also check for players on NCAA_BB teams with NULL sport
  console.log(chalk.yellow('\n4. Checking for players on NCAA_BB teams with NULL sport...'));
  
  // Get NCAA_BB team IDs
  const { data: ncaaBBTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NCAA_BB');
  
  if (ncaaBBTeams && ncaaBBTeams.length > 0) {
    const teamIds = ncaaBBTeams.map(t => t.id);
    
    const { count: teamPlayersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .is('sport', null)
      .in('team_id', teamIds);
    
    if (teamPlayersCount && teamPlayersCount > 0) {
      console.log(`Found ${teamPlayersCount} more players on NCAA_BB teams with NULL sport`);
      
      // Update them too
      const { error: teamUpdateError, count: teamUpdatedCount } = await supabase
        .from('players')
        .update({ sport: 'NCAA_BB' })
        .is('sport', null)
        .in('team_id', teamIds);
      
      if (teamUpdateError) {
        console.error(chalk.red(`❌ Error updating team players: ${teamUpdateError.message}`));
      } else {
        console.log(chalk.green(`✅ Updated ${teamUpdatedCount} more players based on team association`));
      }
    }
  }
  
  // 5. Verify the fix
  console.log(chalk.yellow('\n5. Verifying the fix...'));
  
  const { count: ncaaBBCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  
  console.log(chalk.green(`\n✅ Total NCAA_BB players after fix: ${ncaaBBCount?.toLocaleString()}`));
  
  // Show sample after update
  const { data: sampleAfter } = await supabase
    .from('players')
    .select('id, name, sport, external_id')
    .eq('sport', 'NCAA_BB')
    .limit(5);
  
  console.log('\nSample players after update:');
  sampleAfter?.forEach((player, i) => {
    console.log(`${i + 1}. ${player.name} - Sport: ${player.sport} - External: ${player.external_id}`);
  });
  
  // 6. Check remaining NULL sport players
  console.log(chalk.yellow('\n6. Checking remaining NULL sport players...'));
  
  const { count: remainingNullCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  console.log(`Remaining players with NULL sport: ${remainingNullCount?.toLocaleString()}`);
  
  if (remainingNullCount && remainingNullCount > 0) {
    const { data: remainingSample } = await supabase
      .from('players')
      .select('external_id')
      .is('sport', null)
      .not('external_id', 'is', null)
      .limit(10);
    
    console.log('Sample of remaining NULL sport players:');
    remainingSample?.forEach(p => {
      console.log(`  External ID: ${p.external_id}`);
    });
  }
}

fixNCAABasketballPlayersSport().catch(console.error);