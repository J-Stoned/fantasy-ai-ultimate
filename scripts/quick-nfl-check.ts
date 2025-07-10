#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCheck() {
  // Get actual NFL player count
  const { count: nflPlayerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');

  console.log('Total NFL players:', nflPlayerCount);

  // Get actual NFL game count
  const { count: nflGameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  console.log('Total completed NFL games:', nflGameCount);
  
  // Get total logs
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log('Total player_game_logs:', totalLogs);

  // Check what the latest insert was
  const { data: latest } = await supabase
    .from('player_game_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nLatest inserts:');
  for (const log of latest || []) {
    const { data: player } = await supabase
      .from('players')
      .select('firstname, lastname, sport_id')
      .eq('id', log.player_id)
      .single();
    
    console.log(`  ${player?.firstname} ${player?.lastname} (${player?.sport_id}): ${log.created_at}`);
  }
  
  // Check if we have NFL logs from today
  const today = new Date().toISOString().split('T')[0];
  const { count: todayNFLLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);
    
  console.log(`\nLogs created today: ${todayNFLLogs}`);
}

quickCheck().catch(console.error);