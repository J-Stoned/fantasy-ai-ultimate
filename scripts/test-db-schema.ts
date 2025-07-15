#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

async function checkSchema() {
  const supabase = createClient(
    'https://pvekvqiqrrpugfmpgaup.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || ''
  );

  // Get games table schema
  const { data: gamesData, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .limit(1);

  if (gamesData && gamesData.length > 0) {
    console.log('✅ Games table columns:', Object.keys(gamesData[0]));
  } else {
    console.log('❌ No games found or error:', gamesError);
  }

  // Get player_stats schema
  const { data: statsData, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);

  if (statsData && statsData.length > 0) {
    console.log('✅ Player_stats columns:', Object.keys(statsData[0]));
  }

  // Test count query
  const { count, error: countError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Total games in database:', count);
}

checkSchema();