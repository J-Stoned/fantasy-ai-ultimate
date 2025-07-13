#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsStructure() {
  // Get column info
  const { data: sample } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);

  if (sample && sample.length > 0) {
    console.log('player_stats columns:', Object.keys(sample[0]));
    console.log('\nSample record:');
    console.log(sample[0]);
  } else {
    console.log('No records in player_stats table');
  }

  // Check player_game_logs too
  const { data: logSample } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);

  if (logSample && logSample.length > 0) {
    console.log('\nplayer_game_logs columns:', Object.keys(logSample[0]));
    console.log('\nSample record:');
    console.log(logSample[0]);
  }
}

checkStatsStructure().catch(console.error);