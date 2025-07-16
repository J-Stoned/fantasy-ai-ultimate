#!/usr/bin/env tsx
/**
 * Test MLB API structure
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

async function testMLBAPI() {
  console.log(chalk.bold.red('⚾ Testing MLB API Structure\n'));
  
  // Get one MLB game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.mlb,sport_id.eq.MLB')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_mlb_')) {
    console.log('No valid MLB game found');
    return;
  }
  
  console.log('Testing game:', game.id);
  
  const gameId = game.external_id.replace('espn_mlb_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
  
  console.log('Fetching:', url);
  
  try {
    const response = await axios.get(url);
    
    console.log('\nAPI Response structure:');
    console.log('- Has boxscore:', !!response.data.boxscore);
    console.log('- Has players:', !!response.data.boxscore?.players);
    
    if (response.data.boxscore?.players?.[0]) {
      const teamData = response.data.boxscore.players[0];
      console.log('\nFirst team:');
      console.log('- Team name:', teamData.team?.displayName);
      console.log('- Statistics groups:', teamData.statistics?.length || 0);
      
      if (teamData.statistics) {
        console.log('\nStatistics categories:');
        teamData.statistics.forEach((stat: any, i: number) => {
          console.log(`  [${i}] ${stat.name} - ${stat.athletes?.length || 0} athletes`);
        });
        
        // Check first stat group (likely batters)
        if (teamData.statistics[0]?.athletes?.[0]) {
          const batter = teamData.statistics[0].athletes[0];
          console.log('\nFirst athlete (likely batter):');
          console.log('- Name:', batter.athlete?.displayName);
          console.log('- Stats array:', batter.stats);
          console.log('- Labels:', teamData.statistics[0].labels);
        }
        
        // Check second stat group (likely pitchers)
        if (teamData.statistics[1]?.athletes?.[0]) {
          const pitcher = teamData.statistics[1].athletes[0];
          console.log('\nFirst athlete in second group (likely pitcher):');
          console.log('- Name:', pitcher.athlete?.displayName);
          console.log('- Stats array:', pitcher.stats);
          console.log('- Labels:', teamData.statistics[1].labels);
        }
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testMLBAPI().catch(console.error);