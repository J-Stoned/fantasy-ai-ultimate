#!/usr/bin/env tsx
/**
 * Debug NBA API structure
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

async function debugAPI() {
  console.log(chalk.bold.red('🔍 DEBUGGING NBA API STRUCTURE\n'));
  
  // Get one game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nba_')) {
    console.log('No valid NBA game found');
    return;
  }
  
  console.log('Testing game:', game);
  
  const gameId = game.external_id.replace('espn_nba_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  console.log('Fetching:', url);
  
  try {
    const response = await axios.get(url);
    
    console.log('\nAPI Response structure:');
    console.log('- Status:', response.status);
    console.log('- Has boxscore:', !!response.data.boxscore);
    console.log('- Has teams:', !!response.data.boxscore?.teams);
    
    if (response.data.boxscore?.teams) {
      const team = response.data.boxscore.teams[0];
      console.log('\nFirst team structure:');
      console.log('- Team name:', team.team?.displayName);
      console.log('- Team ID:', team.team?.id);
      console.log('- Home/Away:', team.homeAway);
      console.log('- Has statistics:', !!team.statistics);
      
      if (team.statistics) {
        console.log('\nStatistics structure:');
        console.log('- Number of stat groups:', team.statistics.length);
        
        if (team.statistics[0]) {
          console.log('\nFirst stat group:');
          console.log('- Name:', team.statistics[0].name);
          console.log('- Has athletes:', !!team.statistics[0].athletes);
          console.log('- Number of athletes:', team.statistics[0].athletes?.length || 0);
          
          if (team.statistics[0].athletes?.[0]) {
            const athlete = team.statistics[0].athletes[0];
            console.log('\nFirst athlete:');
            console.log('- Name:', athlete.athlete?.displayName);
            console.log('- ID:', athlete.athlete?.id);
            console.log('- Has stats:', !!athlete.stats);
            console.log('- Stats length:', athlete.stats?.length || 0);
            
            if (athlete.stats) {
              console.log('- First 5 stats:', athlete.stats.slice(0, 5));
            }
          }
        }
      }
    }
    
    // Check if our team IDs match
    console.log('\nTeam ID matching:');
    console.log('- Game home_team_id:', game.home_team_id);
    console.log('- Game away_team_id:', game.away_team_id);
    console.log('- ESPN team IDs:', response.data.boxscore?.teams?.map((t: any) => t.team?.id));
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

debugAPI().catch(console.error);