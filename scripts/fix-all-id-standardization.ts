#!/usr/bin/env tsx
/**
 * Fix all ID standardization issues across the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMLBPlayers() {
  console.log(chalk.bold.yellow('\n🔧 Fixing MLB Players...'));
  
  // First, let's check what we're dealing with
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .like('external_id', 'mlb_%')
    .limit(5);
    
  console.log('Sample MLB players to fix:');
  samplePlayers?.forEach(p => console.log(`  ${p.external_id} → espn_${p.external_id}`));
  
  // Get all MLB players that need fixing
  const { data: playersToFix } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .like('external_id', 'mlb_%');
    
  if (!playersToFix || playersToFix.length === 0) {
    console.log('No MLB players to fix');
    return 0;
  }
  
  // Update in batches
  const batchSize = 500;
  let totalUpdated = 0;
  
  for (let i = 0; i < playersToFix.length; i += batchSize) {
    const batch = playersToFix.slice(i, i + batchSize);
    
    // Update each player in the batch
    const promises = batch.map(player => 
      supabase
        .from('players')
        .update({ external_id: `espn_${player.external_id}` })
        .eq('id', player.id)
    );
    
    await Promise.all(promises);
    totalUpdated += batch.length;
    
    if (totalUpdated % 1000 === 0) {
      console.log(`  Progress: ${totalUpdated}/${playersToFix.length}`);
    }
  }
    
  console.log(chalk.green(`✅ Fixed ${totalUpdated} MLB players`));
  return totalUpdated;
}

async function fixNCAAFootballGames() {
  console.log(chalk.bold.yellow('\n🔧 Fixing NCAA Football Games...'));
  
  // Check sample
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'NCAA_FB')
    .not('external_id', 'like', 'espn_%')
    .limit(5);
    
  console.log('Sample NCAA_FB games to fix:');
  sampleGames?.forEach(g => console.log(`  ${g.external_id} → espn_ncaaf_${g.external_id}`));
  
  // Get all NCAA_FB games that need fixing
  const { data: gamesToFix } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'NCAA_FB')
    .not('external_id', 'like', 'espn_%');
    
  if (!gamesToFix || gamesToFix.length === 0) {
    console.log('No NCAA_FB games to fix');
    return 0;
  }
  
  // Update in batches
  const batchSize = 200;
  let totalUpdated = 0;
  
  for (let i = 0; i < gamesToFix.length; i += batchSize) {
    const batch = gamesToFix.slice(i, i + batchSize);
    
    const promises = batch.map(game => 
      supabase
        .from('games')
        .update({ external_id: `espn_ncaaf_${game.external_id}` })
        .eq('id', game.id)
    );
    
    await Promise.all(promises);
    totalUpdated += batch.length;
  }
    
  console.log(chalk.green(`✅ Fixed ${totalUpdated} NCAA Football games`));
  return totalUpdated;
}

async function fixNBATeams() {
  console.log(chalk.bold.yellow('\n🔧 Fixing NBA Teams...'));
  
  // Get teams with 'nba_' prefix
  const { data: teamsToFix } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NBA')
    .like('external_id', 'nba_%');
    
  if (!teamsToFix || teamsToFix.length === 0) {
    console.log('No NBA teams to fix');
    return 0;
  }
  
  // Update each team
  let totalUpdated = 0;
  for (const team of teamsToFix) {
    const { error } = await supabase
      .from('teams')
      .update({ external_id: `espn_${team.external_id}` })
      .eq('id', team.id);
      
    if (!error) totalUpdated++;
  }
    
  console.log(chalk.green(`✅ Fixed ${totalUpdated} NBA teams`));
  return totalUpdated;
}

async function fixMLBTeams() {
  console.log(chalk.bold.yellow('\n🔧 Fixing MLB Teams...'));
  
  // First get 'mlb_' prefix teams
  const { data: mlbPrefixed } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .like('external_id', 'mlb_%');
    
  let totalFixed = 0;
  
  // Fix mlb_ prefix teams
  if (mlbPrefixed && mlbPrefixed.length > 0) {
    for (const team of mlbPrefixed) {
      const { error } = await supabase
        .from('teams')
        .update({ external_id: `espn_${team.external_id}` })
        .eq('id', team.id);
        
      if (!error) totalFixed++;
    }
  }
    
  
  // Handle raw numeric IDs (like '71')
  const { data: rawIds } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'MLB')
    .not('external_id', 'like', 'espn_%')
    .not('external_id', 'like', 'mlb_%');
    
  if (rawIds && rawIds.length > 0) {
    console.log('Found teams with raw IDs:', rawIds.map(t => `${t.name}: ${t.external_id}`).join(', '));
    
    // Update raw IDs
    for (const team of rawIds) {
      if (team.external_id && /^\d+$/.test(team.external_id)) {
        const { error } = await supabase
          .from('teams')
          .update({ external_id: `espn_mlb_${team.external_id}` })
          .eq('id', team.id);
          
        if (!error) {
          totalFixed++;
        } else {
          console.error(`Error updating team ${team.name}:`, error);
        }
      }
    }
  }
  
  console.log(chalk.green(`✅ Fixed ${totalFixed} MLB teams`));
  return totalFixed;
}

async function fixAllIDStandardization() {
  console.log(chalk.bold.blue('🚀 FIXING ALL ID STANDARDIZATION ISSUES\n'));
  
  let totalFixed = 0;
  
  // Fix each category
  totalFixed += await fixMLBPlayers();
  totalFixed += await fixNCAAFootballGames();
  totalFixed += await fixNBATeams();
  totalFixed += await fixMLBTeams();
  
  console.log(chalk.bold.green(`\n✅ TOTAL RECORDS FIXED: ${totalFixed}`));
  
  // Verify the fixes
  console.log(chalk.bold.cyan('\n🔍 Verifying fixes...'));
  
  const verificationQueries = [
    { table: 'players', sport: 'MLB', expectedPrefix: 'espn_mlb_' },
    { table: 'games', sport: 'NCAA_FB', expectedPrefix: 'espn_ncaaf_' },
    { table: 'teams', sport: 'NBA', expectedPrefix: 'espn_nba_' },
    { table: 'teams', sport: 'MLB', expectedPrefix: 'espn_mlb_' }
  ];
  
  for (const check of verificationQueries) {
    const { count: nonCompliant } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true })
      .eq('sport', check.sport)
      .not('external_id', 'like', `${check.expectedPrefix}%`);
      
    if (nonCompliant === 0) {
      console.log(chalk.green(`  ✓ ${check.sport} ${check.table}: All compliant!`));
    } else {
      console.log(chalk.red(`  ✗ ${check.sport} ${check.table}: ${nonCompliant} still non-compliant`));
    }
  }
}

fixAllIDStandardization().catch(console.error);