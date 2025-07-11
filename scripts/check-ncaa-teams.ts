#!/usr/bin/env tsx
/**
 * Check NCAA teams in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAATeams() {
  console.log(chalk.bold.blue('🏀 NCAA TEAMS IN DATABASE\n'));
  
  // Check teams with ncaab sport_id
  const { data: ncaaTeams, error: error1 } = await supabase
    .from('teams')
    .select('id, name, external_id, sport_id, abbreviation')
    .eq('sport_id', 'ncaab')
    .order('name');
    
  if (error1) {
    console.error('Error:', error1);
    return;
  }
  
  console.log(chalk.green(`Total NCAA teams with sport_id='ncaab': ${ncaaTeams?.length || 0}\n`));
  
  // Also check for teams that might have NCAA in external_id
  const { data: teamsWithNCAAExternal, error: error2 } = await supabase
    .from('teams')
    .select('id, name, external_id, sport_id')
    .or('external_id.ilike.%ncaa%,external_id.ilike.%ncaab%')
    .order('name');
    
  console.log(chalk.yellow(`Teams with NCAA in external_id: ${teamsWithNCAAExternal?.length || 0}\n`));
  
  // Check external_id patterns
  if (ncaaTeams && ncaaTeams.length > 0) {
    console.log(chalk.cyan('Sample NCAA teams:'));
    ncaaTeams.slice(0, 10).forEach(team => {
      console.log(`ID: ${chalk.cyan(team.id.toString().padEnd(8))} | Name: ${chalk.white(team.name.padEnd(30))} | External ID: ${chalk.gray(team.external_id || 'NULL')}`);
    });
    
    // Check external_id format
    const externalIdFormats = new Map<string, number>();
    ncaaTeams.forEach(team => {
      if (team.external_id) {
        // Check if it's just a number or has a prefix
        if (/^\d+$/.test(team.external_id)) {
          externalIdFormats.set('numeric_only', (externalIdFormats.get('numeric_only') || 0) + 1);
        } else {
          const prefix = team.external_id.split('_')[0];
          externalIdFormats.set(prefix, (externalIdFormats.get(prefix) || 0) + 1);
        }
      } else {
        externalIdFormats.set('null', (externalIdFormats.get('null') || 0) + 1);
      }
    });
    
    console.log(chalk.blue('\nExternal ID formats found:'));
    Array.from(externalIdFormats.entries()).forEach(([format, count]) => {
      console.log(`  ${format}: ${count} teams`);
    });
    
    // Check for duplicate external IDs
    const externalIdCounts = new Map<string, number>();
    ncaaTeams.forEach(team => {
      if (team.external_id) {
        externalIdCounts.set(team.external_id, (externalIdCounts.get(team.external_id) || 0) + 1);
      }
    });
    
    const duplicates = Array.from(externalIdCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(chalk.red('\n⚠️  Duplicate external_ids found:'));
      duplicates.forEach(([id, count]) => {
        console.log(`  ${id}: ${count} teams`);
      });
    }
  } else {
    console.log(chalk.red('No NCAA teams found with sport_id="ncaab"!'));
  }
  
  // Let's also check what sport_id values exist
  const { data: sportIds } = await supabase
    .from('teams')
    .select('sport_id')
    .not('sport_id', 'is', null);
    
  const uniqueSportIds = new Set(sportIds?.map(t => t.sport_id));
  console.log(chalk.magenta('\nAll sport_id values in teams table:'));
  Array.from(uniqueSportIds).sort().forEach(id => {
    console.log(`  - ${id}`);
  });
}

checkNCAATeams();