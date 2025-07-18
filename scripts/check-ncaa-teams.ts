#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAATeams() {
  // Count teams by sport
  const { data: counts } = await supabase
    .from('teams')
    .select('sport')
    .in('sport', ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL']);
    
  const sportCounts = counts?.reduce((acc: any, team: any) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {});
  
  console.log(chalk.cyan('\n📊 NCAA Team Counts:'));
  console.log(chalk.yellow('NCAA_FB:'), sportCounts?.NCAA_FB || 0);
  console.log(chalk.yellow('NCAA_BB:'), sportCounts?.NCAA_BB || 0);
  console.log(chalk.yellow('NCAA_BASEBALL:'), sportCounts?.NCAA_BASEBALL || 0);
  console.log(chalk.blue('Total:'), (sportCounts?.NCAA_FB || 0) + (sportCounts?.NCAA_BB || 0) + (sportCounts?.NCAA_BASEBALL || 0));
  
  // Show sample team IDs for each sport
  for (const sport of ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL']) {
    const { data: samples } = await supabase
      .from('teams')
      .select('external_id, name')
      .eq('sport', sport)
      .limit(3)
      .order('external_id');
      
    console.log(chalk.gray(`\nSample ${sport} teams:`));
    samples?.forEach(t => console.log(chalk.gray('  ', t.external_id, '-', t.name)));
  }
}

checkNCAATeams().catch(console.error);