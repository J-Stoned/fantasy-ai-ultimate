#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSportsCounts() {
  console.log(chalk.cyan('Checking sports data...'));
  
  const sports = ['nfl', 'mlb', 'nba', 'nhl', 'football', 'baseball', 'basketball', 'college-football'];
  
  for (const sport of sports) {
    const { count: total } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
      
    const { count: withScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
      
    if (total && total > 0) {
      console.log(chalk.yellow(`${sport}: ${total} total, ${withScores} with scores (${((withScores||0)/total*100).toFixed(1)}%)`));
    }
  }
  
  const { count: allTotal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: allWithScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  console.log(chalk.green(`\nTOTAL: ${allTotal} games, ${allWithScores} with scores`));
}

checkSportsCounts().catch(console.error);