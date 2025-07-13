import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugNBAAPI() {
  console.log('🔍 DEBUGGING NBA API STRUCTURE\n');
  
  // Get a sample NBA game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .not('home_score', 'is', null)
    .not('external_id', 'is', null)
    .limit(5);
  
  if (!games || games.length === 0) {
    console.error('No NBA games found');
    return;
  }
  
  console.log('Sample NBA games:');
  games.forEach(g => console.log(`  ${g.id}: ${g.external_id}`));
  
  // Try to fetch data for first game
  const game = games[0];
  const espnId = game.external_id.match(/(\d+)$/)?.[1];
  
  if (!espnId) {
    console.error('Could not extract ESPN ID from:', game.external_id);
    return;
  }
  
  console.log(`\nFetching data for ESPN ID: ${espnId}`);
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`;
  console.log(`URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('\n📊 API Response Structure:');
    console.log('Keys:', Object.keys(response.data));
    
    if (response.data.boxscore) {
      console.log('\nBoxscore keys:', Object.keys(response.data.boxscore));
      
      if (response.data.boxscore.players) {
        console.log(`\nPlayers array length: ${response.data.boxscore.players.length}`);
        
        const team = response.data.boxscore.players[0];
        console.log('\nFirst team structure:');
        console.log('  Keys:', Object.keys(team));
        console.log('  Team:', team.team?.displayName);
        
        if (team.statistics) {
          console.log('\n  Statistics array:');
          team.statistics.forEach((stat: any, i: number) => {
            console.log(`    [${i}]:`, {
              name: stat.name,
              type: stat.type,
              athletesCount: stat.athletes?.length || 0,
              labels: stat.labels?.slice(0, 5)
            });
          });
          
          // Find player stats
          const starters = team.statistics.find((s: any) => s.name === 'starters');
          const bench = team.statistics.find((s: any) => s.name === 'bench');
          
          console.log('\n  Starters found:', !!starters);
          console.log('  Bench found:', !!bench);
          
          // Check first player
          const firstStatGroup = team.statistics[0];
          if (firstStatGroup?.athletes?.[0]) {
            const player = firstStatGroup.athletes[0];
            console.log('\n  Sample player:');
            console.log('    Name:', player.athlete?.displayName);
            console.log('    ID:', player.athlete?.id);
            console.log('    Stats array length:', player.stats?.length);
            console.log('    Stats:', player.stats);
            
            // Check stat labels
            console.log('\n  Stat labels:', firstStatGroup.labels);
          }
        }
      }
    }
    
    // Check if game has been played
    console.log('\nGame status:', response.data.header?.competitions?.[0]?.status?.type?.completed);
    
  } catch (error: any) {
    console.error('\n❌ Error fetching NBA data:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugNBAAPI().catch(console.error);