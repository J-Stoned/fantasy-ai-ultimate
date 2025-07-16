#!/usr/bin/env tsx
/**
 * Test NBA fixed structure
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

async function testFixed() {
  console.log(chalk.bold.yellow('🔍 Testing NBA Fixed Structure\n'));
  
  // Get one game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nba_')) return;
  
  const gameId = game.external_id.replace('espn_nba_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  console.log('Testing game:', game.id);
  
  const response = await axios.get(url);
  
  if (response.data.boxscore?.players?.[0]) {
    const teamData = response.data.boxscore.players[0];
    console.log('Team:', teamData.team?.displayName);
    
    let found = false;
    if (teamData.statistics) {
      for (let i = 0; i < teamData.statistics.length; i++) {
        const statGroup = teamData.statistics[i];
        if (statGroup.athletes && statGroup.athletes.length > 0) {
          console.log(`\nFound athletes in statistics[${i}]:`, statGroup.name || 'unnamed');
          console.log('Athletes count:', statGroup.athletes.length);
          
          const athlete = statGroup.athletes[0];
          console.log('\nFirst athlete:');
          console.log('- Name:', athlete.athlete?.displayName);
          console.log('- Stats length:', athlete.stats?.length);
          
          if (athlete.stats?.length >= 16) {
            console.log('- Points:', athlete.stats[15]);
            console.log('- Rebounds:', athlete.stats[9]);
            console.log('- Assists:', athlete.stats[10]);
          }
          
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      console.log('\n❌ No athletes found in any statistics group!');
    }
  }
}

testFixed().catch(console.error);