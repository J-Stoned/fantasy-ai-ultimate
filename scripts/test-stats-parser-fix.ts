#!/usr/bin/env tsx
/**
 * Test the fixed stats parser
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

async function testParser() {
  // Get a sample game
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NBA')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
  
  if (!game) {
    console.error('No game found');
    return;
  }
  
  console.log(chalk.bold.blue('\n🧪 TESTING FIXED STATS PARSER\n'));
  console.log(chalk.yellow(`Game: ${game.external_id}`));
  
  // Fetch boxscore
  const gameId = game.external_id.replace('espn_nba_', '');
  const url = `${ESPN_BASE}/summary?event=${gameId}`;
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const boxscore = response.data;
  
  // Test parsing
  if (boxscore.boxscore?.players?.[0]?.statistics?.[0]?.athletes?.[0]) {
    const firstPlayer = boxscore.boxscore.players[0].statistics[0].athletes[0];
    const stats = firstPlayer.stats;
    
    console.log(chalk.cyan('\nFirst player:'), firstPlayer.athlete.displayName);
    console.log(chalk.cyan('Raw stats:'), stats);
    
    // Parse using our fixed logic
    const minutesPlayed = parseInt(stats[0]) || 0;
    const [fgMade, fgAttempted] = (stats[1] || "0-0").split('-').map(Number);
    const [fg3Made, fg3Attempted] = (stats[2] || "0-0").split('-').map(Number);
    const [ftMade, ftAttempted] = (stats[3] || "0-0").split('-').map(Number);
    
    console.log(chalk.green('\nParsed stats:'));
    console.log(`  Minutes: ${minutesPlayed}`);
    console.log(`  FG: ${fgMade}/${fgAttempted}`);
    console.log(`  3PT: ${fg3Made}/${fg3Attempted}`);
    console.log(`  FT: ${ftMade}/${ftAttempted}`);
    console.log(`  REB: ${stats[6]}`);
    console.log(`  AST: ${stats[7]}`);
    console.log(`  PTS: ${stats[13]}`);
    
    console.log(chalk.green('\n✅ Parser looks good!'));
  }
}

testParser().catch(console.error);