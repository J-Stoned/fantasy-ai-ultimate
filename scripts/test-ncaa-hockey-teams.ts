#!/usr/bin/env tsx
/**
 * Test NCAA Hockey teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data: teams } = await supabase
    .from('teams')
    .select('name, metadata')
    .eq('sport', 'NCAA_HKY')
    .order('name');
  
  // Count by conference
  const conferences: Record<string, number> = {};
  teams?.forEach(team => {
    const conf = team.metadata?.conference || 'Unknown';
    conferences[conf] = (conferences[conf] || 0) + 1;
  });
  
  console.log(chalk.bold.blue('NCAA Hockey Teams by Conference:'));
  Object.entries(conferences).sort((a, b) => b[1] - a[1]).forEach(([conf, count]) => {
    console.log(`  ${conf}: ${count} teams`);
  });
  
  console.log(chalk.green(`\nTotal: ${teams?.length} teams`));
  
  // Show some Division III teams if any
  const d3Teams = teams?.filter(t => t.metadata?.division === 'Division III');
  if (d3Teams && d3Teams.length > 0) {
    console.log(chalk.yellow(`\nDivision III teams: ${d3Teams.length}`));
  } else {
    console.log(chalk.yellow('\nNo Division III teams found - all appear to be Division I'));
  }
}

test().catch(console.error);