#!/usr/bin/env tsx
/**
 * Debug NBA external ID mismatch
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugExternalIds() {
  console.log(chalk.bold.red('🔍 DEBUGGING NBA EXTERNAL ID MISMATCH\n'));
  
  // Get sample NBA players from our DB
  const { data: ourPlayers } = await supabase
    .from('players')
    .select('name, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .not('external_id', 'is', null)
    .limit(10);
    
  console.log('Sample of our NBA players:');
  ourPlayers?.forEach(p => console.log(`  ${p.name}: ${p.external_id}`));
  
  // Get a sample game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (game && game.external_id?.startsWith('espn_nba_')) {
    const gameId = game.external_id.replace('espn_nba_', '');
    console.log(`\nFetching game ${gameId}...`);
    
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`
    );
    
    if (response.data.boxscore?.teams?.[0]?.statistics?.[0]?.athletes) {
      const athletes = response.data.boxscore.teams[0].statistics[0].athletes.slice(0, 5);
      
      console.log('\nFirst 5 ESPN players:');
      athletes.forEach((a: any) => {
        const expectedKey = `espn_nba_${a.athlete.id}`;
        console.log(`  ${a.athlete.displayName}: ESPN ID ${a.athlete.id} → Expected key: ${expectedKey}`);
      });
      
      console.log('\n❌ PROBLEM: Our players have numeric external_ids, but we need espn_nba_ prefix!');
      console.log('🎯 SOLUTION: We need to update our player external_ids to match ESPN format');
    }
  }
}

debugExternalIds().catch(console.error);