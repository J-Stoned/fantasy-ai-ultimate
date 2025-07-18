import axios from 'axios';
import chalk from 'chalk';

async function testSingleGameAPI() {
  // Test with a game that showed 67 stats in DB
  const gameId = '401289853';
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
  
  console.log(chalk.cyan('🔍 Testing ESPN API structure for game ' + gameId));
  console.log(chalk.gray(url + '\n'));
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    
    // Log the structure
    console.log(chalk.yellow('Response structure:'));
    console.log('- boxscore exists:', !!response.data.boxscore);
    console.log('- boxscore.players exists:', !!response.data.boxscore?.players);
    
    if (response.data.boxscore?.players) {
      console.log('- Number of teams:', response.data.boxscore.players.length);
      
      for (let i = 0; i < response.data.boxscore.players.length; i++) {
        const teamData = response.data.boxscore.players[i];
        console.log(chalk.green(`\nTeam ${i + 1}:`));
        console.log('  - team:', teamData.team?.displayName || 'No team info');
        console.log('  - statistics exists:', !!teamData.statistics);
        
        if (teamData.statistics) {
          console.log('  - statistics length:', teamData.statistics.length);
          
          for (let j = 0; j < teamData.statistics.length; j++) {
            const stat = teamData.statistics[j];
            console.log(chalk.blue(`\n  Category ${j + 1}:`));
            console.log('    - name:', stat.name || 'UNDEFINED');
            console.log('    - displayName:', stat.displayName || 'UNDEFINED');
            console.log('    - type:', stat.type || 'UNDEFINED');
            console.log('    - athletes count:', stat.athletes?.length || 0);
            
            // Show first athlete structure
            if (stat.athletes && stat.athletes.length > 0) {
              const firstAthlete = stat.athletes[0];
              console.log(chalk.gray('\n    First athlete structure:'));
              console.log('      - athlete.id:', firstAthlete.athlete?.id);
              console.log('      - athlete.name:', firstAthlete.athlete?.displayName);
              console.log('      - stats array:', firstAthlete.stats);
              console.log('      - stats length:', firstAthlete.stats?.length);
            }
          }
        }
      }
    }
    
    // Save full response for inspection
    const fs = await import('fs');
    await fs.promises.writeFile(
      'test-game-response.json', 
      JSON.stringify(response.data, null, 2)
    );
    console.log(chalk.green('\n✅ Full response saved to test-game-response.json'));
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}

testSingleGameAPI()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });