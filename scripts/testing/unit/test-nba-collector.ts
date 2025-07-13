import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to fetch from ESPN API
async function fetchESPNData(url: string) {
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching from ESPN:', error);
    return null;
  }
}

async function testNBACollection() {
  console.log('🏀 Testing NBA Collection from ESPN API...\n');
  
  // 1. First, let's check if we can get NBA teams from ESPN
  console.log('1. Fetching NBA teams from ESPN:');
  const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
  const teamsData = await fetchESPNData(teamsUrl);
  
  if (teamsData && teamsData.sports && teamsData.sports[0]) {
    const teams = teamsData.sports[0].leagues[0].teams;
    console.log(`Found ${teams.length} NBA teams from ESPN`);
    console.log('Sample teams:', teams.slice(0, 5).map((t: any) => `${t.team.displayName} (${t.team.abbreviation})`).join(', '));
  }
  
  // 2. Get a recent NBA game to test player collection
  console.log('\n2. Finding a recent NBA game for testing:');
  const { data: recentGame, error: gameError } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .eq('sport', 'NBA')
    .order('start_time', { ascending: false })
    .limit(1)
    .single();
    
  if (gameError || !recentGame) {
    console.error('Error finding recent NBA game:', gameError);
    return;
  }
  
  console.log(`Using game: ${recentGame.external_id}`);
  
  // 3. Extract ESPN game ID from external_id
  // The external_id format might be different - let's check
  console.log(`Full external_id: ${recentGame.external_id}`);
  
  // Try different parsing methods
  let espnGameId = recentGame.external_id;
  
  // If it starts with 'espn_nba_', remove that prefix
  if (espnGameId.startsWith('espn_nba_')) {
    espnGameId = espnGameId.replace('espn_nba_', '');
  }
  
  // If it's still prefixed with 'espn_', try removing that too
  if (espnGameId.startsWith('espn_')) {
    espnGameId = espnGameId.replace('espn_', '');
  }
  
  // Extract just the numeric part if needed
  const numericMatch = espnGameId.match(/\d+/);
  if (numericMatch) {
    espnGameId = numericMatch[0];
  }
  
  console.log(`Parsed ESPN Game ID: ${espnGameId}`);
  
  // 4. Try to fetch game data from ESPN
  console.log('\n3. Fetching game data from ESPN:');
  const gameUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`;
  const gameData = await fetchESPNData(gameUrl);
  
  if (!gameData) {
    console.error('Failed to fetch game data');
    return;
  }
  
  console.log('Game fetched successfully!');
  if (gameData.header) {
    console.log(`  ${gameData.header.competitions[0].competitors[0].team.displayName} vs ${gameData.header.competitions[0].competitors[1].team.displayName}`);
  }
  
  // 5. Check for boxscore data (player stats)
  console.log('\n4. Checking for player stats in boxscore:');
  if (gameData.boxscore && gameData.boxscore.players) {
    const playerGroups = gameData.boxscore.players;
    console.log(`Found ${playerGroups.length} team boxscores`);
    
    for (const teamPlayers of playerGroups) {
      console.log(`\n${teamPlayers.team.displayName} roster:`);
      const stats = teamPlayers.statistics[0]; // Usually the main stats category
      
      if (stats && stats.athletes) {
        console.log(`  ${stats.athletes.length} players with stats`);
        
        // Show first 3 players as sample
        stats.athletes.slice(0, 3).forEach((player: any) => {
          console.log(`    - ${player.athlete.displayName} (ID: ${player.athlete.id})`);
          if (player.stats && player.stats.length > 0) {
            console.log(`      Stats available: ${player.stats.join(', ')}`);
          }
        });
      }
    }
  } else {
    console.log('No boxscore data found for this game');
  }
  
  // 6. Try the roster endpoint for a team
  console.log('\n5. Testing roster endpoint for a team:');
  const lakersUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/13/roster'; // 13 is Lakers
  const rosterData = await fetchESPNData(lakersUrl);
  
  if (rosterData && rosterData.athletes) {
    console.log(`Lakers roster: ${rosterData.athletes.length} players`);
    console.log('Sample players:', rosterData.athletes.slice(0, 5).map((p: any) => p.fullName).join(', '));
  }
  
  process.exit(0);
}

testNBACollection();