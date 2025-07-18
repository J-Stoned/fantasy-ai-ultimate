import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugSingleGame() {
  console.log(chalk.cyan('🔍 Debugging Single Game Stats\n'));
  
  // Get a high-scoring game (likely D1)
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NCAA_BASEBALL')
    .eq('status', 'completed')
    .gte('start_time', '2021-05-01')
    .lte('start_time', '2021-05-31')
    .gt('home_score', 10)
    .gt('away_score', 10)
    .limit(5);
    
  if (!games || games.length === 0) {
    console.log('No high-scoring games found');
    return;
  }
  
  for (const game of games) {
    console.log(chalk.yellow(`\nGame: ${game.external_id}`));
    console.log(`Date: ${game.start_time}`);
    console.log(`Score: ${game.home_score} - ${game.away_score}`);
    console.log(`Venue: ${game.venue}`);
    
    // Check stats in DB
    const { data: dbStats, count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact' })
      .eq('game_id', game.id);
      
    console.log(chalk.blue(`Stats in DB: ${count || 0}`));
    
    // Check ESPN API
    const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
    
    try {
      const response = await axios.get(url, { timeout: 5000 });
      
      // Check header for division info
      if (response.data.header?.competitions?.[0]) {
        const comp = response.data.header.competitions[0];
        console.log(chalk.gray(`Conference: ${comp.conferenceCompetition?.text || 'Unknown'}`));
        console.log(chalk.gray(`Notes: ${comp.notes?.map(n => n.headline).join(', ') || 'None'}`));
      }
      
      // Count available stats
      if (response.data.boxscore?.players) {
        console.log(chalk.green('\nStats available from ESPN:'));
        
        let totalBatters = 0;
        let totalPitchers = 0;
        let validBatters = 0;
        let validPitchers = 0;
        
        for (const teamData of response.data.boxscore.players) {
          console.log(chalk.yellow(`\nTeam: ${teamData.team?.displayName || 'Unknown'}`));
          
          for (const category of teamData.statistics || []) {
            const athletes = category.athletes || [];
            console.log(`  ${category.name}: ${athletes.length} players`);
            
            // Check how many have valid stats
            let validCount = 0;
            for (const athlete of athletes) {
              if (athlete.stats && Array.isArray(athlete.stats)) {
                const hasNonZero = athlete.stats.some(val => 
                  val && val !== '0' && val !== '0.0' && val !== '--'
                );
                if (hasNonZero) {
                  validCount++;
                  if (category.name === 'batting') validBatters++;
                  else if (category.name === 'pitching') validPitchers++;
                }
              }
            }
            
            console.log(chalk.gray(`    (${validCount} with actual stats)`));
            
            if (category.name === 'batting') totalBatters += athletes.length;
            else if (category.name === 'pitching') totalPitchers += athletes.length;
          }
        }
        
        console.log(chalk.cyan('\nSummary:'));
        console.log(`Total players listed: ${totalBatters + totalPitchers}`);
        console.log(`Players with valid stats: ${validBatters + validPitchers}`);
        console.log(`  Batters: ${validBatters}/${totalBatters}`);
        console.log(`  Pitchers: ${validPitchers}/${totalPitchers}`);
        
        if (count) {
          const captureRate = ((count / (validBatters + validPitchers)) * 100).toFixed(1);
          console.log(chalk.red(`\nCapture rate: ${captureRate}% (${count}/${validBatters + validPitchers})`));
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`Error: ${error}`));
    }
  }
}

debugSingleGame()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });