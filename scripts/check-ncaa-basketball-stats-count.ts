#!/usr/bin/env tsx
/**
 * 🔍 CHECK NCAA BASKETBALL STATS COUNT
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAABasketballStats() {
  console.log(chalk.bold.blue('🏀 NCAA BASKETBALL STATS COUNT\n'));
  
  // Get all NCAA Basketball game IDs with pagination
  const allGameIds = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NCAA_BB')
      .range(from, from + batchSize - 1);
    
    if (!data || data.length === 0) break;
    
    allGameIds.push(...data.map(g => g.id));
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${allGameIds.length} NCAA Basketball games`);
  
  // Count stats for these games
  let totalStats = 0;
  let statsFrom = 0;
  
  while (true) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('id')
      .in('game_id', allGameIds)
      .range(statsFrom, statsFrom + 999);
    
    if (!data || data.length === 0) break;
    
    totalStats += data.length;
    statsFrom += 1000;
    
    if (data.length < 1000) break;
  }
  
  console.log(`Found ${totalStats} NCAA Basketball stats`);
  
  // Average stats per game
  const avgStatsPerGame = totalStats / allGameIds.length;
  console.log(`Average stats per game: ${avgStatsPerGame.toFixed(1)}`);
}

checkNCAABasketballStats().catch(console.error);