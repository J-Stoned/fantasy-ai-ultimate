import axios from 'axios';
import chalk from 'chalk';

async function testMiLBAlternatives() {
  console.log(chalk.cyan('🔍 Testing Alternative MiLB Data Sources\n'));
  
  // Test 1: MiLB.com API endpoints
  console.log(chalk.yellow('1. Testing MiLB.com API endpoints...'));
  try {
    // Try MiLB's own API
    const milbResponse = await axios.get('https://statsapi.milb.com/api/v1/game/745474/boxscore', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log(chalk.green('✅ MiLB Stats API exists!'));
    console.log('Response keys:', Object.keys(milbResponse.data));
  } catch (error: any) {
    console.log(chalk.red('❌ MiLB Stats API failed:', error.message));
  }
  
  // Test 2: Check a specific MiLB game page
  console.log(chalk.yellow('\n2. Testing MiLB.com game data...'));
  try {
    const gamePageResponse = await axios.get('https://www.milb.com/gameday/745474', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const hasStats = gamePageResponse.data.includes('boxscore') || gamePageResponse.data.includes('playerStats');
    console.log(chalk.green(`✅ MiLB.com game page ${hasStats ? 'has' : 'might have'} stats data`));
  } catch (error: any) {
    console.log(chalk.red('❌ MiLB.com access failed:', error.message));
  }
  
  // Test 3: Baseball Reference
  console.log(chalk.yellow('\n3. Testing Baseball-Reference.com...'));
  try {
    const brResponse = await axios.get('https://www.baseball-reference.com/register/team.cgi?id=de5bda37', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log(chalk.green('✅ Baseball-Reference accessible'));
    const hasMinorLeague = brResponse.data.includes('Minor League');
    console.log(`Minor League data: ${hasMinorLeague ? 'Found' : 'Not found'}`);
  } catch (error: any) {
    console.log(chalk.red('❌ Baseball-Reference failed:', error.message));
  }
  
  // Test 4: Check if we're missing an obvious endpoint
  console.log(chalk.yellow('\n4. Testing alternate MLB API endpoints...'));
  const testEndpoints = [
    'https://statsapi.mlb.com/api/v1.1/game/745474/boxscore',
    'https://statsapi.mlb.com/api/v1/game/745474/linescore',
    'https://statsapi.mlb.com/api/v1/game/745474/playByPlay',
    'https://statsapi.mlb.com/api/v1/game/745474/feed/live'
  ];
  
  for (const endpoint of testEndpoints) {
    try {
      const response = await axios.get(endpoint);
      if (response.data) {
        console.log(chalk.green(`✅ ${endpoint.split('/').pop()} endpoint works!`));
        
        // Check for player stats
        const dataStr = JSON.stringify(response.data);
        if (dataStr.includes('batting') || dataStr.includes('pitching')) {
          console.log(chalk.cyan('   → Contains player stats!'));
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ ${endpoint.split('/').pop()} failed`));
    }
  }
  
  // Test 5: Check game with known stats
  console.log(chalk.yellow('\n5. Checking games we know have stats...'));
  const { default: supabase } = await import('../lib/supabase.js');
  
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(5);
    
  if (gamesWithStats && gamesWithStats.length > 0) {
    const { data: game } = await supabase
      .from('games')
      .select('external_id')
      .eq('id', gamesWithStats[0].game_id)
      .single();
      
    if (game) {
      const gameId = game.external_id.replace('mlb_milb_', '');
      console.log(chalk.green(`Game ${gameId} has stats in our DB`));
      
      // Check if more data is available
      try {
        const fullResponse = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/feed/live`);
        const liveData = fullResponse.data;
        
        if (liveData.liveData?.boxscore) {
          const teams = liveData.liveData.boxscore.teams;
          let totalPlayers = 0;
          
          ['away', 'home'].forEach(side => {
            totalPlayers += Object.keys(teams[side].players || {}).length;
          });
          
          console.log(chalk.cyan(`   → Live feed has ${totalPlayers} players with stats!`));
        }
      } catch (error) {
        console.log(chalk.red('   → Live feed failed'));
      }
    }
  }
}

testMiLBAlternatives().catch(console.error);