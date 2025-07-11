#!/usr/bin/env tsx
/**
 * Verify all teams have proper external_ids
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyTeamExternalIds() {
  console.log(chalk.bold.blue('🏆 VERIFYING TEAM EXTERNAL IDS\n'));
  
  const sports = ['mlb', 'nba', 'nfl', 'nhl', 'ncaab', 'ncaaf'];
  
  for (const sport of sports) {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport_id', sport)
      .order('name');
      
    if (error) {
      console.error(`Error fetching ${sport} teams:`, error);
      continue;
    }
    
    const total = teams?.length || 0;
    const withExternalId = teams?.filter(t => t.external_id).length || 0;
    const withoutExternalId = teams?.filter(t => !t.external_id).length || 0;
    
    // Check external_id patterns
    const patterns = new Map<string, number>();
    teams?.forEach(team => {
      if (team.external_id) {
        if (/^\d+$/.test(team.external_id)) {
          patterns.set('numeric', (patterns.get('numeric') || 0) + 1);
        } else if (team.external_id.includes('_')) {
          const prefix = team.external_id.split('_')[0];
          patterns.set(prefix, (patterns.get(prefix) || 0) + 1);
        } else {
          patterns.set('other', (patterns.get('other') || 0) + 1);
        }
      }
    });
    
    console.log(chalk.cyan(`${sport.toUpperCase()}:`));
    console.log(`  Total teams: ${total}`);
    console.log(`  With external_id: ${chalk.green(withExternalId)}`);
    console.log(`  Without external_id: ${withoutExternalId > 0 ? chalk.red(withoutExternalId) : chalk.green(0)}`);
    
    if (patterns.size > 0) {
      console.log(`  Patterns:`);
      Array.from(patterns.entries()).forEach(([pattern, count]) => {
        console.log(`    - ${pattern}: ${count}`);
      });
    }
    
    if (withoutExternalId > 0) {
      console.log(chalk.yellow(`  Missing:`));
      teams?.filter(t => !t.external_id).slice(0, 3).forEach(team => {
        console.log(`    - ${team.name} (ID: ${team.id})`);
      });
      if (withoutExternalId > 3) {
        console.log(`    ... and ${withoutExternalId - 3} more`);
      }
    }
    
    console.log();
  }
  
  // Overall summary
  const { data: allTeams } = await supabase
    .from('teams')
    .select('external_id')
    .not('sport_id', 'is', null);
    
  const totalTeams = allTeams?.length || 0;
  const teamsWithExternalId = allTeams?.filter(t => t.external_id).length || 0;
  const completionRate = totalTeams > 0 ? ((teamsWithExternalId / totalTeams) * 100).toFixed(1) : 0;
  
  console.log(chalk.bold.cyan('OVERALL SUMMARY:'));
  console.log(`Total teams: ${totalTeams}`);
  console.log(`With external_id: ${teamsWithExternalId}`);
  console.log(`Completion rate: ${completionRate}%`);
  
  if (completionRate === '100.0') {
    console.log(chalk.bold.green('\n✅ ALL TEAMS HAVE EXTERNAL IDS!'));
  } else {
    console.log(chalk.yellow(`\n⚠️  ${totalTeams - teamsWithExternalId} teams still need external_ids`));
  }
}

verifyTeamExternalIds();