#!/usr/bin/env tsx
/**
 * 🏟️ SIMPLE VENUE & OFFICIALS COLLECTOR
 * Just get the data in there!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(chalk.cyan.bold('🏟️ SIMPLE VENUE DATA INSERTION\n'));
  
  // Insert some venues
  const venues = [
    { name: 'Arrowhead Stadium', capacity: 76416 },
    { name: 'Lambeau Field', capacity: 81441 },
    { name: 'AT&T Stadium', capacity: 80000 },
    { name: 'MetLife Stadium', capacity: 82500 },
    { name: 'Soldier Field', capacity: 61500 },
    { name: 'Mile High Stadium', capacity: 76125 },
    { name: 'Lumen Field', capacity: 68740 },
    { name: 'SoFi Stadium', capacity: 70240 },
    { name: 'Allegiant Stadium', capacity: 65000 },
    { name: 'Hard Rock Stadium', capacity: 65326 }
  ];
  
  let added = 0;
  for (const venue of venues) {
    const { error } = await supabase.from('venues').insert({
      name: venue.name,
      capacity: venue.capacity,
      created_at: new Date().toISOString()
    });
    
    if (!error) {
      added++;
      console.log(chalk.green(`✅ Added ${venue.name}`));
    } else {
      console.log(chalk.red(`❌ ${venue.name}: ${error.message}`));
    }
  }
  
  console.log(chalk.green(`\n✅ Added ${added} venues!\n`));
  
  // Insert some officials
  const refs = [
    { name: 'Carl Cheffers', role: 'Referee', sport_id: 'nfl' },
    { name: 'Clete Blakeman', role: 'Referee', sport_id: 'nfl' },
    { name: 'Brad Allen', role: 'Referee', sport_id: 'nfl' },
    { name: 'Ron Torbert', role: 'Referee', sport_id: 'nfl' },
    { name: 'Shawn Hochuli', role: 'Referee', sport_id: 'nfl' }
  ];
  
  added = 0;
  for (const ref of refs) {
    const { error } = await supabase.from('officials').insert({
      name: ref.name,
      role: ref.role,
      sport_id: ref.sport_id,
      created_at: new Date().toISOString()
    });
    
    if (!error) {
      added++;
      console.log(chalk.green(`✅ Added ${ref.name}`));
    } else {
      console.log(chalk.red(`❌ ${ref.name}: ${error.message}`));
    }
  }
  
  console.log(chalk.green(`\n✅ Added ${added} officials!\n`));
}

main().catch(console.error);