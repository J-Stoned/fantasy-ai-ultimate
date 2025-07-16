#!/usr/bin/env tsx
/**
 * 🔍 DEBUG BASKETBALL STATS STRUCTURE
 * Understand the actual stats structure
 */

import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugBasketballStatsStructure() {
  console.log(chalk.bold.blue('🔍 DEBUG BASKETBALL STATS STRUCTURE\n'));
  
  // Get a completed game
  const { data: games } = await supabase
    .from('games')
    .select('external_id, status, metadata')
    .eq('sport', 'NCAA_BB')
    .in('status', ['STATUS_FINAL', 'Final'])
    .limit(1);
  
  if (!games || games.length === 0) {
    console.log('No completed games found');
    return;
  }
  
  const game = games[0];
  const espnId = game.external_id.replace('espn_ncaabb_', '');
  
  console.log(`Testing game: ${game.metadata?.home_team} vs ${game.metadata?.away_team}`);
  console.log(`ESPN ID: ${espnId}`);
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${espnId}`;
    const response = await axios.get(url);
    
    console.log('\n📊 FULL STATS STRUCTURE:');
    console.log(JSON.stringify(response.data.boxscore, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugBasketballStatsStructure().catch(console.error);