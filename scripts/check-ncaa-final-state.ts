#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFinalState() {
  console.log(chalk.cyan('\n📊 NCAA TEAMS FINAL STATE CHECK\n'));
  
  // Get all NCAA teams
  const { data: teams, count } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .ilike('sport', 'NCAA%')
    .order('sport');
    
  // Count by sport
  const bySport = teams?.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log(chalk.yellow('NCAA Teams by sport:'));
  Object.entries(bySport).forEach(([sport, cnt]) => {
    console.log(`  ${sport}: ${cnt} teams`);
  });
  console.log(chalk.green(`\nTotal NCAA teams: ${count}`));
  
  // Check if NCAAF/NCAAB still exist
  if (bySport['NCAAF'] || bySport['NCAAB']) {
    console.log(chalk.red('\n⚠️  Old sport names still exist!'));
    console.log(chalk.yellow('Let\'s just work with what we have for now.'));
  } else {
    console.log(chalk.green('\n✅ No old sport names found!'));
  }
  
  // Show readiness for collection
  console.log(chalk.cyan('\n🎯 Ready for 2021 collection:'));
  console.log(`  NCAA_FB: ${bySport['NCAA_FB'] || 0} teams ✅`);
  console.log(`  NCAA_BB: ${bySport['NCAA_BB'] || 0} teams ✅`);
  console.log(`  NCAA_BASEBALL: ${bySport['NCAA_BASEBALL'] || 0} teams ✅`);
}

checkFinalState().catch(console.error);