#!/usr/bin/env tsx
/**
 * Test NCAA Football Players Collection
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPlayersResults() {
  console.log(chalk.bold.blue('🧪 TESTING NCAA FOOTBALL PLAYERS RESULTS\n'));
  
  // Count players
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'NCAA_FB');
  console.log(`✅ Total players: ${count}`);
  
  // Sample players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('sport_id', 'NCAA_FB')
    .limit(5);
  
  console.log('\n📊 Sample players:');
  players?.forEach((player, i) => {
    console.log(`${i + 1}. ${player.name} (${player.position?.join(', ')})`);
    console.log(`   Team: ${player.college}`);
    console.log(`   External ID: ${player.external_id}`);
    console.log(`   Height: ${player.heightinches}" | Weight: ${player.weightlbs}lbs`);
  });
  
  // Check for duplicates
  const { data: duplicates } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport_id', 'NCAA_FB');
  
  const externalIds = duplicates?.map(p => p.external_id) || [];
  const uniqueIds = [...new Set(externalIds)];
  
  console.log(`\n✅ Duplicate check: ${externalIds.length} total, ${uniqueIds.length} unique`);
  console.log(`   Duplicates: ${externalIds.length - uniqueIds.length}`);
  
  // Check teams coverage
  const { data: teamsWithPlayers } = await supabase
    .from('players')
    .select('team_id')
    .eq('sport_id', 'NCAA_FB');
  
  const uniqueTeams = [...new Set(teamsWithPlayers?.map(p => p.team_id))];
  
  console.log(`\n📊 Team coverage: ${uniqueTeams.length}/500 teams have players`);
  
  console.log(chalk.green('\n🎉 Players test complete!'));
}

testPlayersResults().catch(console.error);