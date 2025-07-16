#!/usr/bin/env tsx
/**
 * 🔍 DEBUG STATS CHECK
 * Debug the exact query used in the stats collector
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugStatsCheck() {
  console.log(chalk.bold.blue('🔍 DEBUG STATS CHECK\n'));
  
  // Get NCAA Basketball games exactly like the collector does
  const completedGames = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, external_id, start_time, status, metadata')
      .eq('sport', 'NCAA_BB')
      .in('status', ['STATUS_FINAL', 'Final'])
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching games:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    completedGames.push(...data);
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${completedGames.length} completed NCAA Basketball games`);
  
  // Check stats exactly like the collector
  const existingStats = new Set();
  
  const gameIdChunks = [];
  const chunkSize = 500;
  for (let i = 0; i < completedGames.length; i += chunkSize) {
    gameIdChunks.push(completedGames.slice(i, i + chunkSize).map(g => g.id));
  }
  
  console.log(`\nChecking stats in ${gameIdChunks.length} chunks...`);
  
  for (let i = 0; i < gameIdChunks.length; i++) {
    const chunk = gameIdChunks[i];
    console.log(`\nChunk ${i + 1}: Checking ${chunk.length} game IDs`);
    console.log(`First 3 IDs:`, chunk.slice(0, 3));
    
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id')
      .in('game_id', chunk);
    
    if (error) {
      console.error('Error:', error);
    } else if (data) {
      console.log(`Found ${data.length} stats in this chunk`);
      data.forEach(stat => {
        existingStats.add(`${stat.player_id}-${stat.game_id}`);
      });
    }
  }
  
  console.log(`\nTotal existing stats found: ${existingStats.size}`);
}

debugStatsCheck().catch(console.error);