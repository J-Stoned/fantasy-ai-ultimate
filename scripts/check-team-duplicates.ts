#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDuplicates() {
  console.log(chalk.bold.cyan('🔍 CHECKING TEAM DUPLICATES\n'));
  
  const sports = ['NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`\n${sport} TEAMS:`));
    console.log(chalk.gray('='.repeat(40)));
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport', sport)
      .order('name');
      
    const byName: Record<string, any[]> = {};
    teams?.forEach(t => {
      if (!byName[t.name]) byName[t.name] = [];
      byName[t.name].push(t);
    });
    
    let duplicateCount = 0;
    Object.entries(byName).forEach(([name, list]) => {
      if (list.length > 1) {
        duplicateCount++;
        console.log(chalk.red(`  ${name} (${list.length} records):`));
        list.forEach(t => {
          console.log(chalk.white(`    ID: ${t.id}, external: ${t.external_id || 'NULL'}`));
        });
      }
    });
    
    if (duplicateCount === 0) {
      console.log(chalk.green('  No duplicates found!'));
    }
    
    // Summary
    const withExternal = teams?.filter(t => t.external_id).length || 0;
    const withoutExternal = teams?.filter(t => !t.external_id).length || 0;
    
    console.log(chalk.cyan('\nSummary:'));
    console.log(chalk.white(`  Total: ${teams?.length || 0}`));
    console.log(chalk.white(`  With ESPN IDs: ${withExternal}`));
    console.log(chalk.white(`  Without ESPN IDs: ${withoutExternal}`));
  }
}

checkDuplicates().catch(console.error);