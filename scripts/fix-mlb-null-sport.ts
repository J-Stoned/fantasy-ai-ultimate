#!/usr/bin/env tsx
/**
 * 🔧 FIX MLB NULL SPORT FIELD
 * Update NULL sport to MLB for MLB games
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMLBNullSport() {
  console.log(chalk.bold.blue('⚾ FIXING MLB NULL SPORT FIELD\n'));
  
  // 1. First, let's identify MLB games by their external_id pattern
  console.log(chalk.yellow('1. Finding MLB games with NULL sport...'));
  
  const { data: mlbGames, count: totalCount } = await supabase
    .from('games')
    .select('id, external_id', { count: 'exact' })
    .is('sport', null)
    .ilike('external_id', 'espn_mlb_%');
  
  console.log(`Found ${totalCount} MLB games with NULL sport`);
  
  if (!mlbGames || mlbGames.length === 0) {
    console.log('No MLB games to fix!');
    return;
  }
  
  // 2. Show sample before update
  console.log(chalk.yellow('\n2. Sample games before update:'));
  
  const { data: sampleBefore } = await supabase
    .from('games')
    .select('id, sport, external_id, metadata')
    .is('sport', null)
    .ilike('external_id', 'espn_mlb_%')
    .limit(5);
  
  sampleBefore?.forEach((game, i) => {
    console.log(`${i + 1}. Game ${game.id} - Sport: ${game.sport || 'NULL'} - External: ${game.external_id}`);
    if (game.metadata?.home_team && game.metadata?.away_team) {
      console.log(`   ${game.metadata.away_team} @ ${game.metadata.home_team}`);
    }
  });
  
  // 3. Update all MLB games
  console.log(chalk.yellow('\n3. Updating MLB games...'));
  
  const { error: updateError, count: updatedCount } = await supabase
    .from('games')
    .update({ sport: 'MLB' })
    .is('sport', null)
    .ilike('external_id', 'espn_mlb_%');
  
  if (updateError) {
    console.error(chalk.red(`❌ Error updating games: ${updateError.message}`));
    return;
  }
  
  console.log(chalk.green(`✅ Updated ${updatedCount} games to sport = 'MLB'`));
  
  // 4. Also check for teams with null sport that might be MLB
  console.log(chalk.yellow('\n4. Checking for MLB teams with NULL sport...'));
  
  const { data: mlbTeams, count: teamsCount } = await supabase
    .from('teams')
    .select('id, name, external_id', { count: 'exact' })
    .is('sport', null)
    .or('external_id.ilike.espn_mlb_%,name.ilike.%yankees%,name.ilike.%red sox%,name.ilike.%dodgers%,name.ilike.%giants%,name.ilike.%cubs%,name.ilike.%cardinals%,name.ilike.%braves%,name.ilike.%astros%,name.ilike.%phillies%,name.ilike.%mets%');
  
  if (teamsCount && teamsCount > 0) {
    console.log(`Found ${teamsCount} potential MLB teams with NULL sport`);
    
    // Show sample
    mlbTeams?.slice(0, 5).forEach(team => {
      console.log(`  ${team.name} (External: ${team.external_id || 'none'})`);
    });
    
    // Update them
    const { error: teamUpdateError, count: teamUpdatedCount } = await supabase
      .from('teams')
      .update({ sport: 'MLB' })
      .is('sport', null)
      .or('external_id.ilike.espn_mlb_%,name.ilike.%yankees%,name.ilike.%red sox%,name.ilike.%dodgers%,name.ilike.%giants%,name.ilike.%cubs%,name.ilike.%cardinals%,name.ilike.%braves%,name.ilike.%astros%,name.ilike.%phillies%,name.ilike.%mets%');
    
    if (teamUpdateError) {
      console.error(chalk.red(`❌ Error updating teams: ${teamUpdateError.message}`));
    } else {
      console.log(chalk.green(`✅ Updated ${teamUpdatedCount} teams to sport = 'MLB'`));
    }
  }
  
  // 5. Verify the fix
  console.log(chalk.yellow('\n5. Verifying the fix...'));
  
  const { count: mlbGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
  
  console.log(chalk.green(`\n✅ Total MLB games after fix: ${mlbGamesCount?.toLocaleString()}`));
  
  // Show sample after update
  const { data: sampleAfter } = await supabase
    .from('games')
    .select('id, sport, external_id')
    .eq('sport', 'MLB')
    .limit(5);
  
  console.log('\nSample games after update:');
  sampleAfter?.forEach((game, i) => {
    console.log(`${i + 1}. Game ${game.id} - Sport: ${game.sport} - External: ${game.external_id}`);
  });
  
  // 6. Check remaining NULL sport games
  console.log(chalk.yellow('\n6. Checking remaining NULL sport games...'));
  
  const { count: remainingNullCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  console.log(`Remaining games with NULL sport: ${remainingNullCount?.toLocaleString()}`);
  
  if (remainingNullCount && remainingNullCount > 0) {
    const { data: remainingSample } = await supabase
      .from('games')
      .select('external_id')
      .is('sport', null)
      .limit(10);
    
    console.log('Sample of remaining NULL sport games:');
    remainingSample?.forEach(g => {
      console.log(`  External ID: ${g.external_id}`);
    });
  }
  
  // 7. Update stats count
  console.log(chalk.yellow('\n7. Checking MLB stats count...'));
  
  const { data: mlbGamesSample } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'MLB')
    .limit(50);
  
  if (mlbGamesSample && mlbGamesSample.length > 0) {
    let totalStats = 0;
    
    for (const game of mlbGamesSample) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      totalStats += count || 0;
    }
    
    const avgStatsPerGame = totalStats / mlbGamesSample.length;
    const estimatedTotalStats = Math.round(avgStatsPerGame * (mlbGamesCount || 0));
    
    console.log(`\n📊 MLB Stats Summary:`);
    console.log(`Average stats per game: ${avgStatsPerGame.toFixed(1)}`);
    console.log(`Estimated total MLB stats: ${estimatedTotalStats.toLocaleString()}`);
  }
  
  console.log(chalk.bold.green('\n⚾ MLB NULL SPORT FIX COMPLETE! ⚾'));
}

fixMLBNullSport().catch(console.error);