#!/usr/bin/env tsx
/**
 * Fix NCAA team external_id values to match expected format
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNCAATeamExternalIds() {
  console.log(chalk.bold.blue('🏀 FIXING NCAA TEAM EXTERNAL IDS\n'));
  
  // Get all NCAA teams
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, external_id, sport_id')
    .eq('sport_id', 'ncaab')
    .order('name');
    
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(`Found ${teams?.length || 0} NCAA teams\n`);
  
  const updates = [];
  let nullCount = 0;
  let nbaCount = 0;
  
  teams?.forEach(team => {
    if (!team.external_id) {
      nullCount++;
    } else if (team.external_id.startsWith('nba_')) {
      nbaCount++;
      // These teams have wrong NBA external IDs - we'll need to find their correct NCAA IDs
      console.log(chalk.red(`${team.name} has NBA external_id: ${team.external_id}`));
    }
  });
  
  console.log(chalk.yellow(`\nSummary:`));
  console.log(`- ${nullCount} teams with NULL external_id`);
  console.log(`- ${nbaCount} teams with NBA external_id (wrong!)`);
  
  // For teams with NBA external_ids, we need to clear them since they're wrong
  if (nbaCount > 0) {
    console.log(chalk.cyan('\nClearing incorrect NBA external_ids from NCAA teams...'));
    
    const { error: clearError } = await supabase
      .from('teams')
      .update({ external_id: null })
      .eq('sport_id', 'ncaab')
      .like('external_id', 'nba_%');
      
    if (clearError) {
      console.error(chalk.red('Error clearing NBA IDs:', clearError));
    } else {
      console.log(chalk.green('✅ Cleared incorrect NBA external_ids'));
    }
  }
  
  // Now let's check games to see what external_id format they expect
  console.log(chalk.cyan('\nChecking NCAA game external_ids to understand format...'));
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('external_id, home_team_id, away_team_id')
    .eq('sport_id', 'ncaab')
    .limit(10);
    
  if (sampleGames && sampleGames.length > 0) {
    console.log(chalk.yellow('\nSample NCAA game external_ids:'));
    sampleGames.forEach(game => {
      console.log(`  Game: ${game.external_id}`);
    });
  }
  
  // Let's also check if there are any teams with just numeric external_ids
  const { data: teamsWithNumericIds } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .not('external_id', 'is', null)
    .not('sport_id', 'is', null);
    
  const ncaaNumericTeams = teamsWithNumericIds?.filter(t => /^\d+$/.test(t.external_id || ''));
  
  if (ncaaNumericTeams && ncaaNumericTeams.length > 0) {
    console.log(chalk.cyan(`\nFound ${ncaaNumericTeams.length} teams with numeric-only external_ids:`));
    ncaaNumericTeams.slice(0, 5).forEach(team => {
      console.log(`  ${team.name}: ${team.external_id}`);
    });
  }
  
  console.log(chalk.yellow('\n📝 Note: NCAA teams appear to use numeric external_ids without prefixes.'));
  console.log('The add-ncaa-teams.ts script expects to match teams by these numeric IDs.');
  console.log('To fix missing teams, we need to fetch their ESPN IDs and update the database.\n');
}

fixNCAATeamExternalIds();