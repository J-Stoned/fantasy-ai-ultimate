#!/usr/bin/env tsx
/**
 * Fix sport field for NBA players
 * Changes sport='basketball' to sport='NBA'
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSportField() {
  console.log(chalk.bold.blue('\n🏀 FIXING NBA PLAYER SPORT FIELD\n'));
  
  // First, count how many need fixing
  const { count: beforeCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'basketball');
  
  console.log(chalk.yellow(`Found ${beforeCount} players with sport='basketball'\n`));
  
  // Update in batches to avoid timeout
  const batchSize = 50;
  let updated = 0;
  
  while (updated < beforeCount!) {
    // Get a batch of players to update
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .eq('sport', 'basketball')
      .limit(batchSize);
    
    if (!batch || batch.length === 0) break;
    
    const ids = batch.map(p => p.id);
    
    // Update this batch
    const { error } = await supabase
      .from('players')
      .update({ sport: 'NBA' })
      .in('id', ids);
    
    if (error) {
      console.error(chalk.red('Error updating batch:'), error);
      break;
    }
    
    updated += batch.length;
    console.log(chalk.green(`✅ Updated ${updated}/${beforeCount} players`));
  }
  
  // Verify the update
  const { count: afterCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
  
  console.log(chalk.green(`\n✅ Complete! Now have ${afterCount} players with sport='NBA'`));
  
  // Show sample of updated players
  const { data: sample } = await supabase
    .from('players')
    .select('name, sport, external_id')
    .eq('sport', 'NBA')
    .limit(5);
  
  console.log(chalk.gray('\nSample updated players:'));
  sample?.forEach(p => {
    console.log(`  ${p.name} | sport: ${p.sport} | external_id: ${p.external_id}`);
  });
}

fixSportField().catch(console.error);