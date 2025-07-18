import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testNCAAHockeyStats() {
  console.log(chalk.cyan('🏒 Testing NCAA Hockey Stats Availability\n'));
  
  // Get a sample NCAA Hockey game
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NCAA_HKY')
    .limit(5);
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No NCAA Hockey games found!'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${games.length} NCAA Hockey games to test\n`));
  
  for (const game of games) {
    console.log(chalk.blue(`\nTesting game: ${game.external_id}`));
    console.log(`Date: ${game.start_time}`);
    console.log(`Score: ${game.home_score} - ${game.away_score}`);
    
    const gameId = game.external_id.replace('espn_ncaa_hockey_', '');
    
    // Test 1: Summary endpoint (this is where NCAA Baseball stats were hiding!)
    console.log(chalk.yellow('\n1. Testing /summary endpoint...'));
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
    
    try {
      const response = await axios.get(summaryUrl, { timeout: 10000 });
      
      console.log(chalk.green('✅ Summary endpoint works!'));
      
      // Check for boxscore
      if (response.data.boxscore) {
        console.log(chalk.green('  ✅ Boxscore found!'));
        
        // Check for players
        if (response.data.boxscore.players) {
          console.log(chalk.green('  ✅ Players section found!'));
          
          // Analyze structure
          const teams = response.data.boxscore.players;
          console.log(`  Teams in boxscore: ${teams.length}`);
          
          if (teams.length > 0) {
            const firstTeam = teams[0];
            console.log(`  Team: ${firstTeam.team?.displayName || 'Unknown'}`);
            console.log(`  Statistics sections: ${firstTeam.statistics?.length || 0}`);
            
            if (firstTeam.statistics && firstTeam.statistics.length > 0) {
              for (const stat of firstTeam.statistics) {
                console.log(chalk.cyan(`\n  Stat Category: ${stat.name || stat.type || 'Unknown'}`));
                console.log(`  Athletes: ${stat.athletes?.length || 0}`);
                
                if (stat.athletes && stat.athletes.length > 0) {
                  const firstAthlete = stat.athletes[0];
                  console.log(chalk.green('\n  🎉 PLAYER STATS FOUND!'));
                  console.log(`  Player: ${firstAthlete.athlete?.displayName || 'Unknown'}`);
                  console.log(`  Stats array: ${JSON.stringify(firstAthlete.stats)}`);
                  console.log(`  Stats length: ${firstAthlete.stats?.length || 0}`);
                  
                  // Save full response for analysis
                  const fs = await import('fs');
                  await fs.promises.writeFile(
                    `ncaa-hockey-game-${gameId}.json`,
                    JSON.stringify(response.data, null, 2)
                  );
                  console.log(chalk.green(`\n  ✅ Full response saved to ncaa-hockey-game-${gameId}.json`));
                  
                  return; // Found stats, no need to test more games
                }
              }
            }
          }
        } else {
          console.log(chalk.yellow('  ⚠️  No players section in boxscore'));
        }
      } else {
        console.log(chalk.yellow('  ⚠️  No boxscore in response'));
      }
      
      // Check what IS in the response
      console.log(chalk.gray('\n  Response structure:'));
      console.log(`  - Has header: ${!!response.data.header}`);
      console.log(`  - Has plays: ${!!response.data.plays}`);
      console.log(`  - Has standings: ${!!response.data.standings}`);
      console.log(`  - Has gameInfo: ${!!response.data.gameInfo}`);
      console.log(`  - All keys: ${Object.keys(response.data).join(', ')}`);
      
    } catch (error: any) {
      console.log(chalk.red(`  ❌ Error: ${error.message}`));
    }
    
    // Test 2: Try different endpoints
    console.log(chalk.yellow('\n2. Testing other endpoints...'));
    
    // Try roster endpoint
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams/${game.home_team_id}/roster`;
    try {
      const response = await axios.get(rosterUrl, { timeout: 5000 });
      if (response.data) {
        console.log(chalk.green('  ✅ Roster endpoint works!'));
        console.log(`  Athletes: ${response.data.athletes?.length || 0}`);
      }
    } catch (error) {
      console.log(chalk.red('  ❌ Roster endpoint failed'));
    }
    
    // Try athletes endpoint
    console.log(chalk.gray('\n  (Would need athlete IDs to test individual stats)'));
  }
  
  console.log(chalk.yellow('\n📊 Summary:'));
  console.log('If no player stats were found, NCAA Hockey truly has no ESPN coverage.');
  console.log('Unlike NCAA Baseball, the limitation appears to be real.');
}

testNCAAHockeyStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ NCAA Hockey testing complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });