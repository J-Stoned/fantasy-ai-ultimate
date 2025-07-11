#!/usr/bin/env tsx
/**
 * Check MLB teams in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBTeams() {
  console.log(chalk.bold.blue('⚾ MLB TEAMS IN DATABASE\n'));
  
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, external_id, sport_id, abbreviation')
    .eq('sport_id', 'mlb')
    .order('name');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(chalk.green(`Total MLB teams: ${teams?.length || 0}\n`));
  
  if (teams && teams.length > 0) {
    console.log(chalk.yellow('All MLB teams:'));
    teams.forEach(team => {
      console.log(`ID: ${chalk.cyan(team.id.toString().padEnd(4))} | Name: ${chalk.white(team.name.padEnd(25))} | External ID: ${chalk.gray(team.external_id || 'NULL')} | Abbr: ${chalk.magenta(team.abbreviation || 'N/A')}`);
    });
    
    // Check for teams without external_id
    const teamsWithoutExternalId = teams.filter(t => !t.external_id);
    if (teamsWithoutExternalId.length > 0) {
      console.log(chalk.red(`\n⚠️  ${teamsWithoutExternalId.length} teams without external_id!`));
    }
    
    // Check external_id format
    const externalIdFormats = new Set<string>();
    teams.forEach(team => {
      if (team.external_id) {
        const prefix = team.external_id.split('_')[0];
        externalIdFormats.add(prefix);
      }
    });
    
    console.log(chalk.blue('\nExternal ID formats found:'));
    Array.from(externalIdFormats).forEach(format => {
      const count = teams.filter(t => t.external_id?.startsWith(format)).length;
      console.log(`  ${format}_* : ${count} teams`);
    });
  } else {
    console.log(chalk.red('No MLB teams found in database!'));
  }
}

checkMLBTeams();