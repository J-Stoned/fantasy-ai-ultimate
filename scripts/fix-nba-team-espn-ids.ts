#!/usr/bin/env tsx
/**
 * 🔧 FIX NBA TEAM ESPN IDS
 * 
 * Updates all NBA teams with proper ESPN external_id mappings
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN Team ID mappings
const ESPN_TEAM_MAPPINGS = [
  { name: 'Atlanta Hawks', espnId: '1', abbreviation: 'ATL' },
  { name: 'Boston Celtics', espnId: '2', abbreviation: 'BOS' },
  { name: 'Brooklyn Nets', espnId: '17', abbreviation: 'BKN' },
  { name: 'Charlotte Hornets', espnId: '30', abbreviation: 'CHA' },
  { name: 'Chicago Bulls', espnId: '4', abbreviation: 'CHI' },
  { name: 'Cleveland Cavaliers', espnId: '5', abbreviation: 'CLE' },
  { name: 'Dallas Mavericks', espnId: '6', abbreviation: 'DAL' },
  { name: 'Denver Nuggets', espnId: '7', abbreviation: 'DEN' },
  { name: 'Detroit Pistons', espnId: '8', abbreviation: 'DET' },
  { name: 'Golden State Warriors', espnId: '9', abbreviation: 'GSW' },
  { name: 'Houston Rockets', espnId: '10', abbreviation: 'HOU' },
  { name: 'Indiana Pacers', espnId: '11', abbreviation: 'IND' },
  { name: 'Los Angeles Clippers', espnId: '12', abbreviation: 'LAC' },
  { name: 'Los Angeles Lakers', espnId: '13', abbreviation: 'LAL' },
  { name: 'Memphis Grizzlies', espnId: '29', abbreviation: 'MEM' },
  { name: 'Miami Heat', espnId: '14', abbreviation: 'MIA' },
  { name: 'Milwaukee Bucks', espnId: '15', abbreviation: 'MIL' },
  { name: 'Minnesota Timberwolves', espnId: '16', abbreviation: 'MIN' },
  { name: 'New Orleans Pelicans', espnId: '3', abbreviation: 'NOP' },
  { name: 'New York Knicks', espnId: '18', abbreviation: 'NYK' },
  { name: 'Oklahoma City Thunder', espnId: '25', abbreviation: 'OKC' },
  { name: 'Orlando Magic', espnId: '19', abbreviation: 'ORL' },
  { name: 'Philadelphia 76ers', espnId: '20', abbreviation: 'PHI' },
  { name: 'Phoenix Suns', espnId: '21', abbreviation: 'PHX' },
  { name: 'Portland Trail Blazers', espnId: '22', abbreviation: 'POR' },
  { name: 'Sacramento Kings', espnId: '23', abbreviation: 'SAC' },
  { name: 'San Antonio Spurs', espnId: '24', abbreviation: 'SAS' },
  { name: 'Toronto Raptors', espnId: '28', abbreviation: 'TOR' },
  { name: 'Utah Jazz', espnId: '26', abbreviation: 'UTA' },
  { name: 'Washington Wizards', espnId: '27', abbreviation: 'WAS' }
];

async function fixNBATeamIds() {
  console.log(chalk.bold.blue('\n🔧 Fixing NBA Team ESPN IDs\n'));
  
  let updated = 0;
  let errors = 0;
  
  for (const mapping of ESPN_TEAM_MAPPINGS) {
    try {
      // Find team by name
      const { data: team, error: fetchError } = await supabase
        .from('teams')
        .select('id, name, external_id')
        .eq('name', mapping.name)
        .eq('sport', 'NBA')
        .single();
      
      if (fetchError) {
        console.error(chalk.red(`❌ Error finding ${mapping.name}:`), fetchError.message);
        errors++;
        continue;
      }
      
      if (!team) {
        console.log(chalk.yellow(`⚠️  ${mapping.name} not found`));
        continue;
      }
      
      // Update with ESPN external_id
      const externalId = `espn_nba_${mapping.espnId}`;
      
      if (team.external_id === externalId) {
        console.log(chalk.gray(`✓ ${mapping.name} already has correct ESPN ID`));
        continue;
      }
      
      const { error: updateError } = await supabase
        .from('teams')
        .update({ 
          external_id: externalId,
          abbreviation: mapping.abbreviation
        })
        .eq('id', team.id);
      
      if (updateError) {
        console.error(chalk.red(`❌ Error updating ${mapping.name}:`), updateError.message);
        errors++;
      } else {
        console.log(chalk.green(`✅ Updated ${mapping.name} with ESPN ID: ${mapping.espnId}`));
        updated++;
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Unexpected error:`), error);
      errors++;
    }
  }
  
  console.log(chalk.cyan('\n📊 Summary:'));
  console.log(chalk.white(`   Teams updated: ${updated}`));
  console.log(chalk.white(`   Errors: ${errors}`));
  
  // Verify the updates
  const { data: verifyTeams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NBA')
    .order('name');
  
  console.log(chalk.yellow('\n📋 Current NBA Teams:'));
  console.table(verifyTeams?.map(t => ({
    ID: t.id,
    Name: t.name,
    Abbr: t.abbreviation,
    'ESPN ID': t.external_id
  })));
}

// Run the fix
fixNBATeamIds().catch(console.error);