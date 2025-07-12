#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';

async function debugNFL() {
  // Get an NFL game that needs stats
  const { data: games } = await enhancedDb.getClient()
    .from('games')
    .select('id, external_id, sport, start_time')
    .eq('sport', 'NFL')
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5);

  console.log(chalk.bold.yellow('NFL Games found:'));
  games?.forEach(g => {
    console.log(`- ${g.id}: ${g.external_id} (${new Date(g.start_time).toLocaleDateString()})`);
  });

  if (games && games.length > 0) {
    const game = games[0];
    const espnGameId = game.external_id.replace('espn_', '').replace(/^nfl_/, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
    
    console.log(chalk.cyan('\nTesting NFL API:'));
    console.log('URL:', url);
    
    try {
      const response = await axios.get(url, { validateStatus: () => true });
      console.log('Status:', response.status);
      
      if (response.status === 200) {
        console.log('Has boxscore:', !!response.data.boxscore);
        console.log('Teams:', response.data.boxscore?.players?.length);
        
        if (response.data.boxscore?.players?.[0]) {
          const team = response.data.boxscore.players[0];
          console.log('\nTeam:', team.team.displayName);
          console.log('Statistics:', team.statistics?.length);
          
          if (team.statistics?.[0]) {
            console.log('Stat categories:', team.statistics[0].name);
            console.log('Athletes:', team.statistics[0].athletes?.length);
            
            if (team.statistics[0].athletes?.[0]) {
              const player = team.statistics[0].athletes[0];
              console.log('\nSample player:', player.athlete.displayName);
              console.log('Position:', player.athlete.position?.abbreviation);
              console.log('Stats:', player.stats);
            }
          }
        }
      } else {
        console.log(chalk.red('Error response:'), response.data);
      }
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
    }
  }
}

debugNFL().catch(console.error);