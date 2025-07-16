#!/usr/bin/env tsx
/**
 * Test NHL API structure
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

async function testNHLAPI() {
  console.log(chalk.bold.blue('🏒 Testing NHL API Structure\n'));
  
  // Get one NHL game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nhl,sport_id.eq.NHL')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nhl_')) {
    console.log('No valid NHL game found');
    return;
  }
  
  console.log('Testing game:', game.id);
  
  const gameId = game.external_id.replace('espn_nhl_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
  
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
        
        // Find skater stats
        const skaterStats = teamData.statistics.find((s: any) => 
          s.name?.toLowerCase().includes('skater')
        );
        
        if (skaterStats?.athletes?.[0]) {
          const player = skaterStats.athletes[0];
          console.log('\nFirst skater:');
          console.log('- Name:', player.athlete?.displayName);
          console.log('- Stats array:', player.stats);
          console.log('- Labels:', skaterStats.labels);
        }
        
        // Find goalie stats
        const goalieStats = teamData.statistics.find((s: any) => 
          s.name?.toLowerCase().includes('goaltending')
        );
        
        if (goalieStats?.athletes?.[0]) {
          const goalie = goalieStats.athletes[0];
          console.log('\nFirst goalie:');
          console.log('- Name:', goalie.athlete?.displayName);
          console.log('- Stats array:', goalie.stats);
          console.log('- Labels:', goalieStats.labels);
        }
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testNHLAPI().catch(console.error);