import axios from 'axios';
import chalk from 'chalk';

async function testNCAAHockeyAPIPaths() {
  console.log(chalk.cyan('🏒 Testing NCAA Hockey API Paths\n'));
  
  // Test game ID
  const gameId = '401599049';
  
  // Try different sport paths
  const sportPaths = [
    'hockey/mens-college-hockey',
    'hockey/college-hockey', 
    'hockey/ncaa',
    'hockey/men',
    'hockey',
    'college-hockey',
    'icehockey/mens-college-hockey',
    'ice-hockey/college'
  ];
  
  console.log(chalk.yellow(`Testing game ID: ${gameId}\n`));
  
  for (const sportPath of sportPaths) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${gameId}`;
    
    try {
      console.log(chalk.gray(`Testing: ${sportPath}...`));
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.status === 200) {
        console.log(chalk.green(`✅ SUCCESS with path: ${sportPath}`));
        console.log(chalk.green(`   Full URL: ${url}`));
        
        // Check what's in the response
        const data = response.data;
        console.log(chalk.cyan('\n   Response analysis:'));
        console.log(`   - Has boxscore: ${!!data.boxscore}`);
        console.log(`   - Has plays: ${!!data.plays}`);
        console.log(`   - Has header: ${!!data.header}`);
        
        if (data.boxscore) {
          console.log(`   - Has players: ${!!data.boxscore.players}`);
          console.log(`   - Has teams: ${!!data.boxscore.teams}`);
          
          if (data.boxscore.players) {
            console.log(chalk.green('\n   🎉 BOXSCORE WITH PLAYERS FOUND!'));
            const teams = data.boxscore.players;
            console.log(`   - Number of teams: ${teams.length}`);
            
            if (teams.length > 0) {
              const firstTeam = teams[0];
              console.log(`   - Team name: ${firstTeam.team?.displayName || 'Unknown'}`);
              console.log(`   - Statistics sections: ${firstTeam.statistics?.length || 0}`);
              
              if (firstTeam.statistics && firstTeam.statistics.length > 0) {
                for (const stat of firstTeam.statistics) {
                  console.log(`\n   - Stat type: ${stat.type || stat.name || 'Unknown'}`);
                  console.log(`   - Number of athletes: ${stat.athletes?.length || 0}`);
                  
                  if (stat.athletes && stat.athletes.length > 0) {
                    const athlete = stat.athletes[0];
                    console.log(chalk.green(`\n   🏒 PLAYER FOUND: ${athlete.athlete?.displayName}`));
                    console.log(`   - Stats array: ${JSON.stringify(athlete.stats)}`);
                  }
                }
              }
            }
          }
        }
        
        // Save the successful response
        const fs = await import('fs');
        await fs.promises.writeFile(
          'ncaa-hockey-successful-response.json',
          JSON.stringify(response.data, null, 2)
        );
        console.log(chalk.green('\n   ✅ Response saved to ncaa-hockey-successful-response.json'));
        
        return; // Found working path, stop testing
      }
    } catch (error: any) {
      if (error.response?.status !== 400 && error.response?.status !== 404) {
        console.log(chalk.red(`   ❌ Error ${error.response?.status}: ${error.message}`));
      } else {
        console.log(chalk.gray(`   ❌ ${error.response?.status}`));
      }
    }
  }
  
  console.log(chalk.red('\n❌ No working API path found for NCAA Hockey'));
  
  // Try the scoreboard endpoint
  console.log(chalk.yellow('\nTrying scoreboard endpoint...'));
  const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard`;
  
  try {
    const response = await axios.get(scoreboardUrl, { timeout: 5000 });
    if (response.status === 200) {
      console.log(chalk.green('✅ Scoreboard endpoint works!'));
      console.log(`   Games found: ${response.data.events?.length || 0}`);
    }
  } catch (error: any) {
    console.log(chalk.red(`❌ Scoreboard error: ${error.message}`));
  }
}

testNCAAHockeyAPIPaths()
  .then(() => {
    console.log(chalk.cyan('\n✅ API path testing complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });