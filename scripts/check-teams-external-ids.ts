#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTeams() {
  console.log(chalk.bold.cyan('🔍 CHECKING TEAMS WITHOUT EXTERNAL IDS\n'));
  
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .is('external_id', null);
    
  if (teams && teams.length > 0) {
    console.log(chalk.yellow(`Found ${teams.length} teams without external_id:\n`));
    
    const bySport: Record<string, any[]> = {};
    teams.forEach(team => {
      if (!bySport[team.sport]) bySport[team.sport] = [];
      bySport[team.sport].push(team);
    });
    
    Object.entries(bySport).forEach(([sport, teams]) => {
      console.log(chalk.cyan(`${sport} (${teams.length} teams):`));
      teams.forEach(team => {
        console.log(chalk.white(`  - ${team.name} (id: ${team.id})`));
      });
      console.log();
    });
  } else {
    console.log(chalk.green('✅ All teams have external IDs!'));
  }
  
  // Also check for teams WITH external IDs
  const { data: teamsWithIds } = await supabase
    .from('teams')
    .select('sport, count', { count: 'exact' })
    .not('external_id', 'is', null);
    
  console.log(chalk.cyan('\nTeams WITH external IDs:'));
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
    
  console.log(chalk.white(`Total: ${count} teams`));
}

checkTeams().catch(console.error);