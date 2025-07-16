#!/usr/bin/env tsx
/**
 * Test NFL API structure
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

async function testNFLAPI() {
  console.log(chalk.bold.red('🏈 Testing NFL API Structure\n'));
  
  // Get one NFL game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nfl,sport_id.eq.NFL')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nfl_')) {
    console.log('No valid NFL game found');
    return;
  }
  
  console.log('Testing game:', game.id);
  
  const gameId = game.external_id.replace('espn_nfl_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
  
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
        
        // Find passing stats
        const passingStats = teamData.statistics.find((s: any) => 
          s.name?.toLowerCase().includes('passing')
        );
        
        if (passingStats?.athletes?.[0]) {
          const qb = passingStats.athletes[0];
          console.log('\nFirst QB:');
          console.log('- Name:', qb.athlete?.displayName);
          console.log('- Stats array:', qb.stats);
          console.log('- Labels:', passingStats.labels);
        }
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testNFLAPI().catch(console.error);