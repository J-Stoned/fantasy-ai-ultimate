#!/usr/bin/env tsx
/**
 * Fix missing external_id values for MLB teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN MLB Team IDs (from their API)
const MLB_ESPN_TEAM_IDS: Record<string, string> = {
  'Arizona Diamondbacks': '29',
  'Atlanta Braves': '15',
  'Baltimore Orioles': '1',
  'Boston Red Sox': '2',  // This is the missing one!
  'Chicago Cubs': '16',
  'Chicago White Sox': '4',
  'Cincinnati Reds': '17',
  'Cleveland Guardians': '5',
  'Colorado Rockies': '27',
  'Detroit Tigers': '6',
  'Houston Astros': '18',
  'Kansas City Royals': '7',
  'Los Angeles Angels': '3',
  'Los Angeles Dodgers': '19',
  'Miami Marlins': '28',
  'Milwaukee Brewers': '8',
  'Minnesota Twins': '9',
  'New York Mets': '21',
  'New York Yankees': '10',  // This is the missing one!
  'Oakland Athletics': '11',
  'Philadelphia Phillies': '22',
  'Pittsburgh Pirates': '23',
  'San Diego Padres': '25',
  'San Francisco Giants': '26',
  'Seattle Mariners': '12',
  'St. Louis Cardinals': '24',
  'Tampa Bay Rays': '30',
  'Texas Rangers': '13',
  'Toronto Blue Jays': '14',
  'Washington Nationals': '20'
};

async function fixMLBTeamExternalIds() {
  console.log(chalk.bold.blue('🔧 FIXING MLB TEAM EXTERNAL IDS\n'));
  
  // Get all MLB teams
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport_id', 'mlb')
    .order('name');
    
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(`Found ${teams?.length || 0} MLB teams\n`);
  
  const updates = [];
  
  teams?.forEach(team => {
    const espnId = MLB_ESPN_TEAM_IDS[team.name];
    const expectedExternalId = espnId ? `mlb_${espnId}` : null;
    
    if (!team.external_id && expectedExternalId) {
      updates.push({
        team,
        newExternalId: expectedExternalId
      });
      console.log(chalk.yellow(`Missing external_id for ${team.name} (ID: ${team.id})`));
      console.log(chalk.green(`  → Will set to: ${expectedExternalId}\n`));
    } else if (team.external_id && expectedExternalId && team.external_id !== expectedExternalId) {
      console.log(chalk.red(`Mismatch for ${team.name}:`));
      console.log(`  Current: ${team.external_id}`);
      console.log(`  Expected: ${expectedExternalId}\n`);
    }
  });
  
  if (updates.length === 0) {
    console.log(chalk.green('✅ All teams have correct external_id values!'));
    return;
  }
  
  console.log(chalk.cyan(`\nUpdating ${updates.length} teams...\n`));
  
  for (const update of updates) {
    const { error } = await supabase
      .from('teams')
      .update({ external_id: update.newExternalId })
      .eq('id', update.team.id);
      
    if (error) {
      console.error(chalk.red(`Failed to update ${update.team.name}:`, error));
    } else {
      console.log(chalk.green(`✅ Updated ${update.team.name} with external_id: ${update.newExternalId}`));
    }
  }
  
  // Also check if LA Dodgers has the wrong external_id
  const { data: dodgers } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('name', 'Los Angeles Dodgers')
    .single();
    
  if (dodgers && dodgers.external_id === 'mlb_119') {
    console.log(chalk.yellow('\n⚠️  LA Dodgers has wrong external_id (mlb_119 should be mlb_19)'));
    const { error } = await supabase
      .from('teams')
      .update({ external_id: 'mlb_19' })
      .eq('id', dodgers.id);
      
    if (!error) {
      console.log(chalk.green('✅ Fixed LA Dodgers external_id'));
    }
  }
  
  console.log(chalk.bold.green('\n✅ Done!'));
}

fixMLBTeamExternalIds();