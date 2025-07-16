#!/usr/bin/env tsx
/**
 * 🔍 CHECK ACTUAL STATS
 * Direct database query to check stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkActualStats() {
  console.log(chalk.bold.blue('🔍 CHECK ACTUAL STATS\n'));
  
  // Direct count of all stats
  const { count: totalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total stats in database: ${totalCount}`);
  
  // Count by sport
  const { data: games } = await supabase
    .from('games')
    .select('id, sport')
    .in('sport', ['NCAA_BB', 'NCAA_FB']);
  
  const ncaaBBGames = games?.filter(g => g.sport === 'NCAA_BB').map(g => g.id) || [];
  const ncaaFBGames = games?.filter(g => g.sport === 'NCAA_FB').map(g => g.id) || [];
  
  // Sample first 100 game IDs to check
  const sampleBBGames = ncaaBBGames.slice(0, 100);
  
  const { count: bbCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', sampleBBGames);
  
  console.log(`\nNCAA Basketball stats (first 100 games): ${bbCount}`);
  
  // Check a specific game
  if (ncaaBBGames.length > 0) {
    const { data: gameStats } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id')
      .eq('game_id', ncaaBBGames[0])
      .limit(5);
    
    console.log(`\nSample stats for game ${ncaaBBGames[0]}:`, gameStats?.length || 0);
  }
}

checkActualStats().catch(console.error);