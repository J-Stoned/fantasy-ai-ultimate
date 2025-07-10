#!/usr/bin/env tsx
/**
 * Test the fixed getAllPlayers method
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testGetAllPlayers() {
  console.log(chalk.cyan('Testing fixed getAllPlayers method...\n'));
  
  // First get the total count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
  
  if (!count) {
    console.log(chalk.yellow('No players found'));
    return [];
  }
  
  console.log(chalk.yellow(`Found ${count} total players, loading in batches...`));
  
  // Paginate through all players
  const allPlayers: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  const startTime = Date.now();
  
  while (offset < count) {
    const { data, error } = await supabase
      .from('players')
      .select('id, external_id')
      .not('external_id', 'is', null)
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      throw new Error(`Failed to fetch players at offset ${offset}: ${error.message}`);
    }
    
    if (!data || data.length === 0) break;
    
    allPlayers.push(...data);
    offset += pageSize;
    
    // Show progress
    if (offset % 5000 === 0 || offset >= count) {
      console.log(chalk.gray(`  Loaded ${Math.min(offset, count)} / ${count} players...`));
    }
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log(chalk.green(`\n✓ Successfully loaded ${allPlayers.length} players in ${elapsed.toFixed(1)}s`));
  
  // Create a map like the collector does
  const playerMap = new Map(allPlayers.map(p => [p.external_id, p.id]));
  console.log(chalk.green(`✓ Created player map with ${playerMap.size} entries`));
  
  // Show some sample entries
  console.log(chalk.cyan('\nSample player mappings:'));
  const samples = Array.from(playerMap.entries()).slice(0, 5);
  samples.forEach(([external_id, id]) => {
    console.log(`  ${external_id} → ${id}`);
  });
}

testGetAllPlayers().catch(console.error);