import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findNCAAHockeyWithStats() {
  console.log(chalk.cyan('🏒 Finding NCAA Hockey Games with Available Stats\n'));
  
  // Get more recent games or high-scoring games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NCAA_HKY')
    .or('home_score.gt.5,away_score.gt.5') // High scoring games might have stats
    .order('start_time', { ascending: false })
    .limit(20);
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No games found!'));
    return;
  }
  
  console.log(chalk.yellow(`Testing ${games.length} games...\n`));
  
  for (const game of games) {
    const gameId = game.external_id.replace('espn_ncaahockey_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
    
    try {
      console.log(chalk.gray(`Checking game ${gameId} (${game.home_score}-${game.away_score})...`));
      
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;
      
      // Check if boxscore is available
      let hasBoxscore = false;
      let hasPlayers = false;
      let athleteCount = 0;
      
      if (data.header?.competitions?.[0]) {
        hasBoxscore = data.header.competitions[0].boxscoreAvailable;
      }
      
      if (data.boxscore?.players) {
        hasPlayers = true;
        // Count actual athletes
        for (const team of data.boxscore.players) {
          for (const stat of team.statistics || []) {
            athleteCount += stat.athletes?.length || 0;
          }
        }
      }
      
      // Also check plays for player mentions
      let playsWithPlayers = 0;
      if (data.plays) {
        for (const period of data.plays) {
          for (const play of period.plays || []) {
            if (play.text && play.participants) {
              playsWithPlayers++;
            }
          }
        }
      }
      
      console.log(`  Boxscore available: ${hasBoxscore}`);
      console.log(`  Has players section: ${hasPlayers}`);
      console.log(`  Total athletes: ${athleteCount}`);
      console.log(`  Plays with participants: ${playsWithPlayers}`);
      
      if (athleteCount > 0) {
        console.log(chalk.green(`\n🎉 FOUND GAME WITH STATS! Game ID: ${gameId}`));
        
        // Save this response
        const fs = await import('fs');
        await fs.promises.writeFile(
          `ncaa-hockey-with-stats-${gameId}.json`,
          JSON.stringify(data, null, 2)
        );
        console.log(chalk.green(`✅ Response saved!`));
        return;
      }
      
      // Check if there's roster data in a different endpoint
      if (hasBoxscore && athleteCount === 0) {
        console.log(chalk.yellow('  Trying event endpoint...'));
        
        const eventUrl = `https://sports.core.api.espn.com/v2/sports/hockey/leagues/mens-college-hockey/events/${gameId}`;
        try {
          const eventResponse = await axios.get(eventUrl, { timeout: 3000 });
          if (eventResponse.data) {
            console.log(chalk.green('  ✅ Event endpoint works!'));
            if (eventResponse.data.competitors) {
              console.log(`  Competitors: ${eventResponse.data.competitors.length}`);
            }
          }
        } catch (e) {
          console.log(chalk.red('  ❌ Event endpoint failed'));
        }
        
        // Try competitions endpoint
        const compUrl = `https://sports.core.api.espn.com/v2/sports/hockey/leagues/mens-college-hockey/events/${gameId}/competitions/${gameId}/competitors`;
        try {
          const compResponse = await axios.get(compUrl, { timeout: 3000 });
          if (compResponse.data && compResponse.data.items) {
            console.log(chalk.green(`  ✅ Competitors endpoint works! Items: ${compResponse.data.items.length}`));
            
            // Check first competitor for roster link
            if (compResponse.data.items[0] && compResponse.data.items[0].$ref) {
              const firstCompUrl = compResponse.data.items[0].$ref;
              const firstComp = await axios.get(firstCompUrl);
              
              if (firstComp.data.roster && firstComp.data.roster.$ref) {
                console.log(chalk.green('  ✅ Found roster link!'));
                
                // Try to get the roster
                const rosterResponse = await axios.get(firstComp.data.roster.$ref);
                if (rosterResponse.data && rosterResponse.data.items) {
                  console.log(chalk.green(`  ✅ ROSTER FOUND! ${rosterResponse.data.items.length} players`));
                  
                  // Check if players have stats
                  if (rosterResponse.data.items[0] && rosterResponse.data.items[0].$ref) {
                    const playerUrl = rosterResponse.data.items[0].$ref;
                    console.log(chalk.gray(`  Checking player: ${playerUrl}`));
                  }
                }
              }
            }
          }
        } catch (e) {
          console.log(chalk.red('  ❌ Competitors endpoint failed'));
        }
      }
      
      console.log('');
      
    } catch (error: any) {
      console.log(chalk.red(`  Error: ${error.message}\n`));
    }
  }
  
  console.log(chalk.yellow('\n📊 Summary:'));
  console.log('No NCAA Hockey games found with actual player statistics in the boxscore.');
  console.log('The API structure exists but ESPN does not populate the data.');
}

findNCAAHockeyWithStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ Search complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });