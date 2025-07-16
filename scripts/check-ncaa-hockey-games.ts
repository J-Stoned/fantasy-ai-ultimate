#!/usr/bin/env tsx
/**
 * Check NCAA Hockey games in database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: games } = await supabase
    .from('games')
    .select('metadata')
    .eq('sport', 'NCAA_HKY')
    .limit(5);
  
  console.log('Sample games:');
  games?.forEach(g => {
    console.log(`${g.metadata.away_team} @ ${g.metadata.home_team}`);
  });
  
  // Check date range
  const { data: dates } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'NCAA_HKY')
    .order('start_time', { ascending: false })
    .limit(1);
  
  const { data: firstDate } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'NCAA_HKY')
    .order('start_time', { ascending: true })
    .limit(1);
  
  console.log(`\nDate range: ${firstDate?.[0]?.start_time} to ${dates?.[0]?.start_time}`);
  
  // Count by month
  const { data: allGames } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'NCAA_HKY');
  
  const monthCounts: Record<string, number> = {};
  allGames?.forEach(game => {
    const month = new Date(game.start_time).toISOString().substring(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  
  console.log('\nGames by month:');
  Object.entries(monthCounts).sort().forEach(([month, count]) => {
    console.log(`  ${month}: ${count} games`);
  });
}

check().catch(console.error);