#!/usr/bin/env tsx
/**
 * Test NCAA Football Games Results
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testGamesResults() {
  console.log(chalk.bold.blue('🧪 TESTING NCAA FOOTBALL GAMES RESULTS\n'));
  
  // Count games
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_FB');
  console.log(`✅ Total games: ${count}`);
  
  // Count completed games
  const { count: completedCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_FB')
    .eq('status', 'STATUS_FINAL')
    .not('home_score', 'is', null);
  console.log(`✅ Completed games: ${completedCount}`);
  
  // Sample games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NCAA_FB')
    .eq('status', 'STATUS_FINAL')
    .not('home_score', 'is', null)
    .limit(3);
  
  console.log('\n📊 Sample completed games:');
  games?.forEach((game, i) => {
    console.log(`${i + 1}. ${game.metadata.away_team} @ ${game.metadata.home_team}`);
    console.log(`   Score: ${game.away_score} - ${game.home_score}`);
    console.log(`   Date: ${game.start_time}`);
    console.log(`   Venue: ${game.venue}`);
  });
  
  console.log(chalk.green('\n🎉 Games results test complete!'));
}

testGamesResults().catch(console.error);