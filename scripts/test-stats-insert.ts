#!/usr/bin/env tsx
/**
 * 🔍 TEST STATS INSERT
 * Test inserting a single stat
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testStatsInsert() {
  console.log(chalk.bold.blue('🔍 TEST STATS INSERT\n'));
  
  // Get one game and one player
  const { data: games } = await supabase
    .from('games')
    .select('id, start_time')
    .eq('sport', 'NCAA_BB')
    .limit(1);
  
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'NCAA_BB')
    .limit(1);
  
  if (!games?.[0] || !players?.[0]) {
    console.log('No game or player found');
    return;
  }
  
  const testStat = {
    player_id: players[0].id,
    game_id: games[0].id,
    game_date: games[0].start_time,
    is_home: true,
    stats: {
      points: 10,
      rebounds: 5,
      assists: 3
    },
    fantasy_points: 25.5
  };
  
  console.log('Inserting test stat:', testStat);
  
  const { data, error } = await supabase
    .from('player_game_logs')
    .insert(testStat)
    .select();
  
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Success:', data);
  }
  
  // Check if it was inserted
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', players[0].id)
    .eq('game_id', games[0].id);
  
  console.log(`\nVerification: Found ${count} stats for this player/game`);
}

testStatsInsert().catch(console.error);