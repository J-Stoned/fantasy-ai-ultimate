#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize connections (from operational manual)
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

async function testMLBScraper() {
  console.log('🧪 Testing MLB scraper with 3 days of data...\n');
  
  // Test with just 3 days from 2024 season
  const testStartDate = '2024-04-01';
  const testEndDate = '2024-04-03';
  
  // Fetch games
  console.log(`Fetching games from ${testStartDate} to ${testEndDate}...`);
  const response = await mlbApi.get('/schedule', {
    params: {
      sportId: 1,
      startDate: testStartDate,
      endDate: testEndDate,
      hydrate: 'team,venue,linescore'
    }
  });
  
  let totalGames = 0;
  const gamesToInsert = [];
  
  if (response.data.dates) {
    response.data.dates.forEach((date: any) => {
      console.log(`\n📅 ${date.date}: ${date.games?.length || 0} games`);
      
      if (date.games) {
        date.games.forEach((game: any) => {
          totalGames++;
          
          // Show game info
          console.log(`  ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);
          console.log(`    Status: ${game.status.detailedState}`);
          console.log(`    Score: ${game.teams.away.score || 0} - ${game.teams.home.score || 0}`);
          console.log(`    Game ID: mlb_${game.gamePk}`);
          
          // Convert to database format
          const dbGame = {
            external_id: `mlb_${game.gamePk}`,
            sport: 'MLB',
            league: 'MLB',
            sport_id: 1,
            home_team_id: game.teams.home.team.id,
            away_team_id: game.teams.away.team.id,
            start_time: game.gameDate,
            venue: game.venue?.name || 'Unknown',
            home_score: game.teams.home.score || 0,
            away_score: game.teams.away.score || 0,
            status: game.status.statusCode === 'F' ? 'final' : game.status.detailedState.toLowerCase(),
            metadata: {
              mlb_game_pk: game.gamePk,
              home_team_name: game.teams.home.team.name,
              away_team_name: game.teams.away.team.name,
              game_type: game.gameType,
              season: game.season
            }
          };
          
          gamesToInsert.push(dbGame);
        });
      }
    });
  }
  
  console.log(`\n📊 Summary: Found ${totalGames} games`);
  
  // Test inserting one game
  if (gamesToInsert.length > 0) {
    console.log('\n🔄 Testing database insertion with first game...');
    const testGame = gamesToInsert[0];
    console.log('Game to insert:', JSON.stringify(testGame, null, 2));
    
    const { data, error } = await supabase
      .from('games')
      .upsert([testGame], {
        onConflict: 'external_id',
        ignoreDuplicates: false
      })
      .select();
      
    if (error) {
      console.error('❌ Error inserting game:', error);
    } else {
      console.log('✅ Successfully inserted/updated game!');
      console.log('Database response:', data);
    }
    
    // Test fetching player stats for one game
    const completedGames = gamesToInsert.filter(g => g.status === 'final');
    if (completedGames.length > 0) {
      console.log('\n🏃 Testing player stats fetch...');
      const testGamePk = completedGames[0].metadata.mlb_game_pk;
      
      try {
        const statsResponse = await mlbApi.get(`/game/${testGamePk}/boxscore`);
        console.log('✅ Successfully fetched boxscore data');
        
        // Check if we have player data
        const homePlayers = Object.keys(statsResponse.data.teams?.home?.players || {}).length;
        const awayPlayers = Object.keys(statsResponse.data.teams?.away?.players || {}).length;
        console.log(`Found ${homePlayers} home players, ${awayPlayers} away players`);
        
      } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
      }
    }
  }
  
  console.log('\n✅ Test complete! Ready to run full scraper.');
}

// Run the test
testMLBScraper().catch(console.error);