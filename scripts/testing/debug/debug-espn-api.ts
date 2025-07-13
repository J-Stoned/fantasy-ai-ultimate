#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';

async function debugESPN() {
  // Test ESPN API directly
  const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401766128';
  const res = await axios.get(url);

  // Check boxscore structure
  console.log(chalk.cyan('ESPN API Response Structure:'));
  
  const boxscore = res.data.boxscore;
  console.log('Has boxscore?', !!boxscore);
  console.log('Has players?', !!boxscore?.players);
  console.log('Number of teams:', boxscore?.players?.length);
  
  const firstTeam = boxscore?.players?.[0];
  console.log('\nFirst team:', firstTeam?.team?.displayName);
  console.log('Has statistics?', !!firstTeam?.statistics);
  console.log('Statistics length:', firstTeam?.statistics?.length);
  
  if (firstTeam?.statistics?.[0]) {
    const stat = firstTeam.statistics[0];
    console.log('\nFirst statistic type:', stat.name);
    console.log('Has athletes?', !!stat.athletes);
    console.log('Number of athletes:', stat.athletes?.length);
    
    if (stat.athletes?.[0]) {
      const athlete = stat.athletes[0];
      console.log('\nFirst athlete:', athlete.athlete?.displayName);
      console.log('Has stats?', !!athlete.stats);
      console.log('Stats array:', athlete.stats);
      console.log('Stats length:', athlete.stats?.length);
      
      // Map stats indices
      if (athlete.stats?.length >= 14) {
        console.log(chalk.green('\nStats mapping:'));
        console.log('Minutes [0]:', athlete.stats[0]);
        console.log('FG [1]:', athlete.stats[1]);
        console.log('3PT [2]:', athlete.stats[2]);
        console.log('FT [3]:', athlete.stats[3]);
        console.log('OREB [4]:', athlete.stats[4]);
        console.log('DREB [5]:', athlete.stats[5]);
        console.log('REB [6]:', athlete.stats[6]);
        console.log('AST [7]:', athlete.stats[7]);
        console.log('STL [8]:', athlete.stats[8]);
        console.log('BLK [9]:', athlete.stats[9]);
        console.log('TO [10]:', athlete.stats[10]);
        console.log('PF [11]:', athlete.stats[11]);
        console.log('+/- [12]:', athlete.stats[12]);
        console.log('PTS [13]:', athlete.stats[13]);
      }
    }
  }
}

debugESPN().catch(console.error);