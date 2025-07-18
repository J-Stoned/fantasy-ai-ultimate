#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X PERFORMANCE - USE ALL RESOURCES!
const CPU_CORES = os.cpus().length;
const BATCH_SIZE = 200; // Much larger batches
const dbLimit = pLimit(Math.floor(CPU_CORES / 2)); // Use half cores for parallel DB ops

console.log(chalk.cyan('🚀 TURBO DELETE - 10X MODE'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores`));
console.log(chalk.gray(`   Batch Size: ${BATCH_SIZE} teams per batch`));

async function turboDelete() {
  const startTime = Date.now();
  
  // Get all duplicate team IDs
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .in('sport', ['NCAAF', 'NCAAB']);
    
  if (!teams || teams.length === 0) {
    console.log('No duplicates found');
    return;
  }
  
  console.log(chalk.yellow(`\nFound ${teams.length} teams to delete`));
  console.log(chalk.green('Launching parallel deletion...'));
  
  // Create batches
  const batches = [];
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    batches.push(teams.slice(i, i + BATCH_SIZE));
  }
  
  console.log(chalk.gray(`Created ${batches.length} batches\n`));
  
  // Delete batches in parallel
  let completed = 0;
  let deleted = 0;
  
  const deletePromises = batches.map((batch, index) => 
    dbLimit(async () => {
      const ids = batch.map(t => t.id);
      
      try {
        const { error, count } = await supabase
          .from('teams')
          .delete()
          .in('id', ids)
          .select('*', { count: 'exact', head: true });
          
        if (!error) {
          deleted += count || batch.length;
          completed++;
          
          const progress = Math.round((completed / batches.length) * 100);
          process.stdout.write(`\r${chalk.green('Progress:')} ${progress}% | ${chalk.yellow('Deleted:')} ${deleted} teams | ${chalk.gray('Batch:')} ${completed}/${batches.length}`);
        } else {
          console.error(chalk.red(`\nBatch ${index + 1} error:`), error.message);
        }
      } catch (e) {
        console.error(chalk.red(`\nBatch ${index + 1} exception:`), e);
      }
    })
  );
  
  await Promise.all(deletePromises);
  
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log(chalk.green(`\n\n✅ DELETION COMPLETE!`));
  console.log(chalk.yellow(`   Deleted: ${deleted} teams`));
  console.log(chalk.gray(`   Time: ${elapsed.toFixed(1)}s`));
  console.log(chalk.gray(`   Speed: ${Math.round(deleted / elapsed)} teams/sec`));
  
  // Verify final state
  const { data: remaining } = await supabase
    .from('teams')
    .select('sport')
    .ilike('sport', 'NCAA%');
    
  const counts = remaining?.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log(chalk.cyan('\nFinal NCAA teams:'));
  Object.entries(counts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} teams`);
  });
}

turboDelete().catch(console.error);