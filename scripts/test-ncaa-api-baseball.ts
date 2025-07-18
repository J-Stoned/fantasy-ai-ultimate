import axios from 'axios';
import chalk from 'chalk';

const NCAA_API_BASE = 'https://ncaa-api.henrygd.me';

async function testNCAAAPIBaseball() {
  console.log(chalk.cyan('🔍 Testing NCAA-API Baseball Support\n'));
  console.log(chalk.yellow('API Base: ' + NCAA_API_BASE));
  console.log(chalk.yellow('Sport Code: MBA (Men\'s Baseball)\n'));

  // Test 1: Check if baseball scoreboard works
  console.log(chalk.blue('Test 1: Scoreboard Endpoint'));
  const testDate = '2024/05/15'; // Mid-May, should have games
  const scoreboardUrl = `${NCAA_API_BASE}/scoreboard/MBA/1/${testDate}`;
  
  try {
    console.log(chalk.gray(`Testing: ${scoreboardUrl}`));
    const response = await axios.get(scoreboardUrl, { timeout: 10000 });
    
    if (response.data) {
      console.log(chalk.green('✅ Scoreboard endpoint works!'));
      console.log(`Games found: ${response.data.games?.length || 0}`);
      
      if (response.data.games && response.data.games.length > 0) {
        const firstGame = response.data.games[0];
        console.log(chalk.gray('\nSample game:'));
        console.log(`  ${firstGame.teams[0].name} vs ${firstGame.teams[1].name}`);
        console.log(`  Game ID: ${firstGame.id}`);
        console.log(`  Status: ${firstGame.status}`);
        
        // Test 2: Try to get boxscore for this game
        if (firstGame.id) {
          console.log(chalk.blue('\nTest 2: Boxscore Endpoint'));
          const boxscoreUrl = `${NCAA_API_BASE}/game/${firstGame.id}/boxscore`;
          
          try {
            console.log(chalk.gray(`Testing: ${boxscoreUrl}`));
            const boxResponse = await axios.get(boxscoreUrl, { timeout: 10000 });
            
            if (boxResponse.data) {
              console.log(chalk.green('✅ Boxscore endpoint works!'));
              
              // Check what data is available
              const data = boxResponse.data;
              console.log(chalk.gray('\nBoxscore structure:'));
              console.log(`  Has teams: ${!!data.teams}`);
              console.log(`  Has players: ${!!data.players}`);
              console.log(`  Has stats: ${!!data.stats}`);
              
              // Try to find player stats
              if (data.players || data.teams) {
                console.log(chalk.green('\n🎯 Player data found! Checking structure...'));
                console.log(JSON.stringify(Object.keys(data), null, 2));
              }
            }
          } catch (error: any) {
            console.log(chalk.red(`❌ Boxscore error: ${error.message}`));
          }
        }
      } else {
        console.log(chalk.yellow('No games found for this date'));
      }
    }
  } catch (error: any) {
    console.log(chalk.red(`❌ Scoreboard error: ${error.message}`));
    if (error.response) {
      console.log(chalk.red(`Status: ${error.response.status}`));
      console.log(chalk.red(`Data: ${JSON.stringify(error.response.data)}`));
    }
  }

  // Test 3: Try different dates to find games
  console.log(chalk.blue('\nTest 3: Checking multiple dates'));
  const testDates = [
    '2024/03/15', // Early season
    '2024/04/20', // Mid-season
    '2024/05/25', // Late season
    '2024/06/10'  // Tournament time
  ];

  for (const date of testDates) {
    try {
      const url = `${NCAA_API_BASE}/scoreboard/MBA/1/${date}`;
      const response = await axios.get(url, { timeout: 5000 });
      const gameCount = response.data.games?.length || 0;
      console.log(`  ${date}: ${gameCount} games`);
    } catch (error) {
      console.log(`  ${date}: Error`);
    }
  }

  // Test 4: Check available endpoints
  console.log(chalk.blue('\nTest 4: Other Endpoints'));
  
  // Try stats endpoint
  try {
    const statsUrl = `${NCAA_API_BASE}/stats/MBA/1/team`;
    console.log(chalk.gray(`Testing team stats: ${statsUrl}`));
    const response = await axios.get(statsUrl, { timeout: 5000 });
    if (response.data) {
      console.log(chalk.green('✅ Team stats endpoint works!'));
    }
  } catch (error: any) {
    console.log(chalk.red(`❌ Team stats error: ${error.response?.status || error.message}`));
  }

  // Try rankings
  try {
    const rankingsUrl = `${NCAA_API_BASE}/rankings/MBA/1/2024`;
    console.log(chalk.gray(`Testing rankings: ${rankingsUrl}`));
    const response = await axios.get(rankingsUrl, { timeout: 5000 });
    if (response.data) {
      console.log(chalk.green('✅ Rankings endpoint works!'));
    }
  } catch (error: any) {
    console.log(chalk.red(`❌ Rankings error: ${error.response?.status || error.message}`));
  }
}

testNCAAAPIBaseball()
  .then(() => {
    console.log(chalk.cyan('\n✅ NCAA-API testing complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });