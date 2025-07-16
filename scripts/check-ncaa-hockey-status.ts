#!/usr/bin/env tsx
/**
 * 🏒 CHECK NCAA HOCKEY STATUS
 * Check if we have any NCAA Hockey data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAHockeyStatus() {
  console.log(chalk.bold.blue('🏒 CHECKING NCAA HOCKEY STATUS\n'));
  
  // 1. Check for NCAA Hockey games
  console.log(chalk.yellow('1. Checking for NCAA Hockey games...'));
  
  // Try different sport codes that might be used
  const possibleCodes = ['NCAA_HKY', 'NCAA_HOCKEY', 'NCAAH', 'NCAA_ICE', 'COLLEGE_HOCKEY'];
  
  for (const code of possibleCodes) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', code);
    
    if (count && count > 0) {
      console.log(chalk.green(`✅ Found ${count} games with sport = '${code}'`));
    }
  }
  
  // Check by external_id pattern
  const { count: ncaaHockeyByExternal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('external_id.ilike.%ncaa%hockey%,external_id.ilike.%college%hockey%,external_id.ilike.%ncaah%');
  
  if (ncaaHockeyByExternal && ncaaHockeyByExternal > 0) {
    console.log(chalk.yellow(`Found ${ncaaHockeyByExternal} games that might be NCAA Hockey by external_id`));
    
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id, sport, external_id')
      .or('external_id.ilike.%ncaa%hockey%,external_id.ilike.%college%hockey%,external_id.ilike.%ncaah%')
      .limit(5);
    
    console.log('Sample games:');
    sampleGames?.forEach(game => {
      console.log(`  ${game.external_id} (sport: ${game.sport})`);
    });
  }
  
  // 2. Check for NCAA Hockey teams
  console.log(chalk.yellow('\n2. Checking for NCAA Hockey teams...'));
  
  for (const code of possibleCodes) {
    const { count } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', code);
    
    if (count && count > 0) {
      console.log(chalk.green(`✅ Found ${count} teams with sport = '${code}'`));
    }
  }
  
  // Check by team names
  const { data: collegeHockeyTeams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .or('name.ilike.%university%,name.ilike.%college%,name.ilike.%state%')
    .eq('sport', 'NHL')
    .limit(10);
  
  if (collegeHockeyTeams && collegeHockeyTeams.length > 0) {
    console.log(chalk.yellow('\nFound NHL teams that might be colleges:'));
    collegeHockeyTeams.forEach(team => {
      console.log(`  ${team.name} (${team.sport})`);
    });
  }
  
  // 3. Check for NCAA Hockey players
  console.log(chalk.yellow('\n3. Checking for NCAA Hockey players...'));
  
  for (const code of possibleCodes) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', code);
    
    if (count && count > 0) {
      console.log(chalk.green(`✅ Found ${count} players with sport = '${code}'`));
    }
  }
  
  // 4. Summary
  console.log(chalk.bold.yellow('\n📊 NCAA HOCKEY SUMMARY:'));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal games in database: ${totalGames?.toLocaleString()}`);
  console.log(`Total teams in database: ${totalTeams?.toLocaleString()}`);
  
  // List all unique sports
  console.log(chalk.yellow('\n📊 All sports in database:'));
  
  const { data: sports } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null);
  
  if (sports) {
    const uniqueSports = [...new Set(sports.map(s => s.sport))];
    uniqueSports.sort().forEach(sport => {
      console.log(`  - ${sport}`);
    });
  }
  
  console.log(chalk.bold.red('\n❌ NCAA HOCKEY NOT FOUND IN DATABASE'));
  console.log(chalk.yellow('We need to collect NCAA Hockey data from scratch!'));
}

checkNCAAHockeyStatus().catch(console.error);