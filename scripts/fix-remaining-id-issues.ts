#!/usr/bin/env tsx
/**
 * Fix remaining ID standardization issues
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixRemainingMLBPlayers() {
  console.log(chalk.bold.yellow('\n🔧 Fixing remaining MLB Players...'));
  
  // First get the count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .like('external_id', 'mlb_%')
    .not('external_id', 'like', 'espn_%');
    
  console.log(`Found ${count} MLB players still to fix`);
    
  if (!count || count === 0) {
    return 0;
  }
  
  // Fetch ALL players with pagination
  const allPlayers = [];
  const pageSize = 1000;
  let offset = 0;
  
  while (offset < count) {
    const { data: batch } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'MLB')
      .like('external_id', 'mlb_%')
      .not('external_id', 'like', 'espn_%')
      .range(offset, offset + pageSize - 1);
      
    if (batch) {
      allPlayers.push(...batch);
    }
    offset += pageSize;
    console.log(`  Fetched ${Math.min(offset, count)}/${count} players...`);
  }
  
  const playersToFix = allPlayers;
  
  // Update in batches
  const batchSize = 500;
  let totalUpdated = 0;
  
  for (let i = 0; i < playersToFix.length; i += batchSize) {
    const batch = playersToFix.slice(i, i + batchSize);
    
    for (const player of batch) {
      const { error } = await supabase
        .from('players')
        .update({ external_id: `espn_${player.external_id}` })
        .eq('id', player.id);
        
      if (!error) totalUpdated++;
    }
    
    console.log(`  Progress: ${Math.min(i + batchSize, playersToFix.length)}/${playersToFix.length}`);
  }
  
  console.log(chalk.green(`✅ Fixed ${totalUpdated} MLB players`));
  return totalUpdated;
}

async function fixNBATeamsAgain() {
  console.log(chalk.bold.yellow('\n🔧 Fixing NBA Teams (round 2)...'));
  
  // Get ALL NBA teams with wrong format
  const { data: teamsToFix } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'NBA')
    .not('external_id', 'like', 'espn_%');
    
  if (!teamsToFix || teamsToFix.length === 0) {
    console.log('No NBA teams to fix');
    return 0;
  }
  
  let totalFixed = 0;
  
  for (const team of teamsToFix) {
    if (team.external_id) {
      let newId = team.external_id;
      
      // Handle different patterns
      if (team.external_id.startsWith('nba_')) {
        newId = `espn_${team.external_id}`;
      } else if (/^\d+$/.test(team.external_id)) {
        newId = `espn_nba_${team.external_id}`;
      }
      
      const { error } = await supabase
        .from('teams')
        .update({ external_id: newId })
        .eq('id', team.id);
        
      if (!error) {
        console.log(`  Fixed ${team.name}: ${team.external_id} → ${newId}`);
        totalFixed++;
      }
    }
  }
  
  console.log(chalk.green(`✅ Fixed ${totalFixed} NBA teams`));
  return totalFixed;
}

async function fixMLBTeamIssues() {
  console.log(chalk.bold.yellow('\n🔧 Fixing problematic MLB Teams...'));
  
  // First, fix the Bradley Braves issue (wrong sport classification)
  const { data: wrongSportTeams } = await supabase
    .from('teams')
    .select('id, external_id, name, sport')
    .eq('sport', 'MLB')
    .or('external_id.like.mens-college-basketball_%,external_id.like.espn_nfl_%');
    
  if (wrongSportTeams && wrongSportTeams.length > 0) {
    console.log('Found teams with wrong sport classification:');
    wrongSportTeams.forEach(t => console.log(`  ${t.name}: ${t.external_id} (marked as ${t.sport})`));
    
    // These should probably be deleted or reclassified
    console.log(chalk.yellow('  These appear to be in the wrong sport category'));
  }
  
  return 0;
}

async function finalVerification() {
  console.log(chalk.bold.cyan('\n🔍 Final Verification...'));
  
  const checks = [
    { table: 'players', sport: 'MLB', prefix: 'espn_mlb_' },
    { table: 'games', sport: 'NCAA_FB', prefix: 'espn_ncaaf_' },
    { table: 'teams', sport: 'NBA', prefix: 'espn_nba_' },
    { table: 'teams', sport: 'MLB', prefix: 'espn_mlb_' }
  ];
  
  for (const check of checks) {
    const { count } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })
      .eq('sport', check.sport)
      .not('external_id', 'like', `${check.prefix}%`);
      
    if (count === 0) {
      console.log(chalk.green(`  ✓ ${check.sport} ${check.table}: All compliant!`));
    } else {
      console.log(chalk.red(`  ✗ ${check.sport} ${check.table}: ${count} still non-compliant`));
    }
  }
}

async function fixAll() {
  console.log(chalk.bold.blue('🚀 FIXING REMAINING ID ISSUES\n'));
  
  await fixRemainingMLBPlayers();
  await fixNBATeamsAgain();
  await fixMLBTeamIssues();
  await finalVerification();
}

fixAll().catch(console.error);