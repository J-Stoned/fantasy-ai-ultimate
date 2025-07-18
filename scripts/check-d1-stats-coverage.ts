import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkD1Coverage() {
  console.log(chalk.cyan('🎯 Checking D1 vs Non-D1 Stats Coverage\n'));
  
  // Get some sample games and check ESPN API for division info
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .eq('sport', 'NCAA_BASEBALL')
    .eq('status', 'completed')
    .gte('start_time', '2023-02-17')
    .lte('start_time', '2023-06-26')
    .limit(20);
    
  if (!games) return;
  
  let d1Games = 0;
  let nonD1Games = 0;
  let d1Stats = 0;
  let nonD1Stats = 0;
  
  for (const game of games) {
    const espnGameId = game.external_id.replace('espn_ncaa_baseball_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${espnGameId}`;
    
    try {
      const response = await axios.get(url, { timeout: 5000 });
      
      // Check if teams are D1
      let isD1 = false;
      if (response.data.header?.competitions?.[0]) {
        const competition = response.data.header.competitions[0];
        // Check for division indicators
        const notes = competition.notes?.map(n => n.headline).join(' ') || '';
        const conferenceInfo = competition.conferenceCompetition?.text || '';
        
        // D1 indicators
        if (notes.includes('Division I') || 
            conferenceInfo.includes('SEC') || 
            conferenceInfo.includes('ACC') ||
            conferenceInfo.includes('Big Ten') ||
            conferenceInfo.includes('Pac-12') ||
            conferenceInfo.includes('Big 12') ||
            conferenceInfo.includes('Big East')) {
          isD1 = true;
        }
      }
      
      // Count stats available
      let statsAvailable = 0;
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          for (const category of teamData.statistics || []) {
            statsAvailable += category.athletes?.length || 0;
          }
        }
      }
      
      // Get actual stats stored
      const { count: storedStats } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
        
      if (isD1) {
        d1Games++;
        d1Stats += storedStats || 0;
        console.log(chalk.green(`D1 Game: ${statsAvailable} available, ${storedStats} stored (${((storedStats || 0) / statsAvailable * 100).toFixed(0)}%)`));
      } else {
        nonD1Games++;
        nonD1Stats += storedStats || 0;
        console.log(chalk.yellow(`Non-D1 Game: ${statsAvailable} available, ${storedStats} stored`));
      }
      
    } catch (error) {
      console.log(chalk.gray(`Game ${espnGameId}: API error`));
    }
  }
  
  console.log(chalk.cyan('\n📊 Summary:'));
  console.log(`D1 Games checked: ${d1Games}`);
  console.log(`D1 Stats stored: ${d1Stats} (avg ${(d1Stats / d1Games).toFixed(1)} per game)`);
  console.log(`Non-D1 Games checked: ${nonD1Games}`);
  console.log(`Non-D1 Stats stored: ${nonD1Stats} (avg ${(nonD1Stats / nonD1Games).toFixed(1)} per game)`);
  
  // Check team divisions
  console.log(chalk.cyan('\n🏫 Checking Team Classifications...'));
  
  // Common D1 conferences
  const d1Conferences = ['SEC', 'ACC', 'Big Ten', 'Pac-12', 'Big 12', 'Big East', 'American', 'Conference USA', 'Sun Belt', 'MAC', 'Mountain West', 'WAC', 'Atlantic 10', 'Big West', 'Big South', 'CAA', 'Horizon', 'Ivy League', 'MAAC', 'MEAC', 'Missouri Valley', 'Northeast', 'Ohio Valley', 'Patriot', 'Southern', 'Southland', 'SWAC', 'Summit', 'WCC'];
  
  const { data: teams } = await supabase
    .from('teams')
    .select('name, metadata')
    .eq('sport', 'NCAA_BASEBALL')
    .limit(50);
    
  let d1Teams = 0;
  teams?.forEach(team => {
    const conference = team.metadata?.conference || '';
    if (d1Conferences.some(conf => conference.includes(conf))) {
      d1Teams++;
    }
  });
  
  console.log(`D1 Teams identified: ${d1Teams}/${teams?.length || 0}`);
}

checkD1Coverage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });