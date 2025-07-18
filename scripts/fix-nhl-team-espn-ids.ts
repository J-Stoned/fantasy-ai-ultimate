#!/usr/bin/env tsx
/**
 * Fix NHL Team ESPN IDs
 * Updates all 32 NHL teams with proper espn_nhl_XXX format
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// NHL Team mappings from team names to ESPN IDs
const NHL_TEAM_ESPN_IDS: Record<string, string> = {
  // Atlantic Division
  'Florida Panthers': 'espn_nhl_13',
  'Tampa Bay Lightning': 'espn_nhl_14',
  'Toronto Maple Leafs': 'espn_nhl_10',
  'Boston Bruins': 'espn_nhl_1',
  'Buffalo Sabres': 'espn_nhl_2',
  'Detroit Red Wings': 'espn_nhl_17',
  'Montreal Canadiens': 'espn_nhl_8',
  'Ottawa Senators': 'espn_nhl_9',
  
  // Metropolitan Division
  'Carolina Hurricanes': 'espn_nhl_12',
  'New Jersey Devils': 'espn_nhl_7',
  'New York Rangers': 'espn_nhl_3',
  'Pittsburgh Penguins': 'espn_nhl_5',
  'Washington Capitals': 'espn_nhl_15',
  'Columbus Blue Jackets': 'espn_nhl_29',
  'New York Islanders': 'espn_nhl_19',
  'Philadelphia Flyers': 'espn_nhl_4',
  
  // Central Division
  'Colorado Avalanche': 'espn_nhl_21',
  'Dallas Stars': 'espn_nhl_25',
  'Minnesota Wild': 'espn_nhl_30',
  'Nashville Predators': 'espn_nhl_18',
  'St. Louis Blues': 'espn_nhl_16',
  'Winnipeg Jets': 'espn_nhl_52',
  'Arizona Coyotes': 'espn_nhl_53',
  'Utah Hockey Club': 'espn_nhl_59', // Relocated from Arizona
  'Chicago Blackhawks': 'espn_nhl_11',
  
  // Pacific Division
  'Vegas Golden Knights': 'espn_nhl_54',
  'Edmonton Oilers': 'espn_nhl_22',
  'Los Angeles Kings': 'espn_nhl_26',
  'Seattle Kraken': 'espn_nhl_55',
  'Calgary Flames': 'espn_nhl_20',
  'Vancouver Canucks': 'espn_nhl_23',
  'San Jose Sharks': 'espn_nhl_28',
  'Anaheim Ducks': 'espn_nhl_24'
};

async function fixNHLTeamIds() {
  console.log(chalk.blue('🏒 FIXING NHL TEAM ESPN IDS'));
  console.log(chalk.blue('========================\n'));

  // Get all NHL teams
  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .eq('sport', 'NHL')
    .order('name');

  if (error || !teams) {
    console.error(chalk.red('Error fetching teams:'), error);
    return;
  }

  console.log(chalk.yellow(`Found ${teams.length} NHL teams to update\n`));

  let updated = 0;
  let notFound = 0;

  for (const team of teams) {
    const espnId = NHL_TEAM_ESPN_IDS[team.name];
    
    if (!espnId) {
      console.log(chalk.red(`❌ No ESPN ID mapping for: ${team.name}`));
      notFound++;
      continue;
    }

    // Update the team
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        external_id: espnId
      })
      .eq('id', team.id);

    if (updateError) {
      console.error(chalk.red(`Error updating ${team.name}:`), updateError);
    } else {
      console.log(chalk.green(`✅ Updated ${team.name} → ${espnId}`));
      updated++;
    }
  }

  // Summary
  console.log(chalk.blue('\n========================'));
  console.log(chalk.blue('UPDATE COMPLETE'));
  console.log(chalk.blue('========================'));
  console.log(chalk.green(`✅ Successfully updated: ${updated} teams`));
  if (notFound > 0) {
    console.log(chalk.red(`❌ Not found in mapping: ${notFound} teams`));
  }

  // Verify the update
  const { data: verifyTeams, count } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .eq('sport', 'NHL')
    .not('external_id', 'is', null);

  console.log(chalk.cyan(`\nVerification: ${count} NHL teams now have ESPN IDs`));
}

fixNHLTeamIds().catch(console.error);