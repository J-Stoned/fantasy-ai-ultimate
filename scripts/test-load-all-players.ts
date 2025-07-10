#!/usr/bin/env tsx
/**
 * Test loading ALL players with proper pagination
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testLoadAllPlayers() {
  console.log(chalk.bold.cyan('\n🧪 TESTING PLAYER LOADING\n'));

  try {
    // First get total count
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.yellow(`Total players in database: ${count}`));

    // Load in batches of 1000 (Supabase limit)
    const pageSize = 1000;
    let offset = 0;
    let allPlayers: any[] = [];
    
    console.log('\nLoading players...');
    
    while (offset < (count || 0)) {
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name, sport')
        .range(offset, Math.min(offset + pageSize - 1, (count || 0) - 1))
        .order('id');
      
      if (error) {
        console.error('Error:', error);
        break;
      }
      
      if (players) {
        allPlayers = allPlayers.concat(players);
        offset += players.length;
        console.log(`  Loaded ${offset}/${count} players...`);
      } else {
        break;
      }
    }
    
    console.log(chalk.green(`\n✓ Successfully loaded ${allPlayers.length} players`));
    
    // Test cache building
    const playerCache = new Map<string, number>();
    
    allPlayers.forEach(p => {
      if (p.name) {
        playerCache.set(p.name.toLowerCase(), p.id);
        playerCache.set(p.name.replace(/[^a-zA-Z\s]/g, '').toLowerCase(), p.id);
      }
    });
    
    console.log(chalk.cyan(`Cache size: ${playerCache.size} name variations`));
    
    // Show sport breakdown
    const sportCounts: Record<string, number> = {};
    allPlayers.forEach(p => {
      const sport = p.sport || 'unknown';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    
    console.log(chalk.yellow('\nPlayers by sport:'));
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count}`);
    });

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

testLoadAllPlayers();