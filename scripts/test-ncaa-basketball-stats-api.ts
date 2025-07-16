#!/usr/bin/env tsx
/**
 * 🔍 TEST NCAA BASKETBALL STATS API
 * Debug why we're getting 0 stats
 */

import axios from 'axios';
import chalk from 'chalk';

async function testNCAABasketballStatsAPI() {
  console.log(chalk.bold.blue('🔍 TEST NCAA BASKETBALL STATS API\n'));
  
  // Test with a recent game ID
  const testGameIds = [
    '401693339', // Recent game
    '401693340',
    '401693341'
  ];
  
  for (const gameId of testGameIds) {
    console.log(chalk.yellow(`\n📊 Testing game ID: ${gameId}`));
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`;
      console.log(`URL: ${url}`);
      
      const response = await axios.get(url);
      
      console.log('Response keys:', Object.keys(response.data));
      
      if (response.data.boxscore) {
        console.log('✅ Boxscore exists');
        console.log('Boxscore keys:', Object.keys(response.data.boxscore));
        
        if (response.data.boxscore.players) {
          console.log('✅ Players data exists');
          console.log('Number of teams:', response.data.boxscore.players.length);
          
          // Check first team's data
          if (response.data.boxscore.players[0]) {
            console.log('\nFirst team structure:');
            console.log('Keys:', Object.keys(response.data.boxscore.players[0]));
            
            if (response.data.boxscore.players[0].statistics) {
              console.log('Statistics length:', response.data.boxscore.players[0].statistics.length);
              
              // Check first player
              if (response.data.boxscore.players[0].statistics[0]) {
                console.log('\nFirst player structure:');
                console.log(JSON.stringify(response.data.boxscore.players[0].statistics[0], null, 2));
              }
            }
          }
        } else {
          console.log('❌ No players data in boxscore');
        }
      } else {
        console.log('❌ No boxscore in response');
      }
      
      // Check game status
      if (response.data.header) {
        console.log('\nGame status:', response.data.header.competitions?.[0]?.status?.type?.name);
      }
      
    } catch (error) {
      console.error(`❌ Error for game ${gameId}:`, error.message);
    }
  }
  
  // Test with an actual espn_ncaabb_ prefixed ID from our database
  console.log(chalk.yellow('\n📊 Testing with database game IDs:'));
  
  // Import supabase to get real game IDs
  const { createClient } = await import('@supabase/supabase-js');
  const dotenv = await import('dotenv');
  dotenv.config();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get a few completed games
  const { data: games } = await supabase
    .from('games')
    .select('external_id, status, metadata')
    .eq('sport', 'NCAA_BB')
    .in('status', ['STATUS_FINAL', 'Final'])
    .limit(3);
  
  console.log('\nDatabase games found:', games?.length || 0);
  
  if (games && games.length > 0) {
    for (const game of games) {
      console.log(`\n📊 Testing database game: ${game.external_id}`);
      console.log('Status:', game.status);
      console.log('Teams:', game.metadata?.home_team, 'vs', game.metadata?.away_team);
      
      // Extract ESPN ID
      const espnId = game.external_id.replace('espn_ncaabb_', '');
      console.log('ESPN ID:', espnId);
      
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${espnId}`;
        const response = await axios.get(url);
        
        if (response.data.boxscore?.players) {
          console.log('✅ Stats available for this game');
          
          let totalPlayers = 0;
          response.data.boxscore.players.forEach((team, index) => {
            if (team.statistics) {
              totalPlayers += team.statistics.length;
            }
          });
          console.log(`Total players with stats: ${totalPlayers}`);
        } else {
          console.log('❌ No stats available for this game');
        }
      } catch (error) {
        console.error('API Error:', error.message);
      }
    }
  }
}

testNCAABasketballStatsAPI().catch(console.error);