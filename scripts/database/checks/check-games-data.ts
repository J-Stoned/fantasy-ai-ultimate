#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGames() {
  console.log(chalk.cyan('Checking games data...'));
  
  // Sample games
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, status, start_time')
    .order('id', { ascending: false })
    .limit(10);
  
  console.log('\nSample games:');
  console.table(sampleGames);
  
  // Count games with external_id
  const { count: withExternal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
  
  // Count total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nGames with external_id: ${withExternal}/${totalGames} (${((withExternal || 0) / (totalGames || 1) * 100).toFixed(1)}%)`);
  
  // Check games by sport
  const { data: sportCounts } = await supabase
    .from('games')
    .select('sport_id')
    .not('sport_id', 'is', null);
  
  const sportMap = new Map();
  sportCounts?.forEach(game => {
    sportMap.set(game.sport_id, (sportMap.get(game.sport_id) || 0) + 1);
  });
  
  console.log('\nGames by sport:');
  sportMap.forEach((count, sport) => {
    console.log(`  ${sport}: ${count}`);
  });
}

checkGames().catch(console.error);