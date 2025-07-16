#!/usr/bin/env tsx
/**
 * Debug stats collection issue
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

async function debugGame() {
  // Get a sample game
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NBA')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
  
  console.log(chalk.bold.blue('\n🔍 DEBUG STATS COLLECTION\n'));
  console.log(chalk.yellow('Sample game:'));
  console.log(`  ID: ${game?.id}`);
  console.log(`  External ID: ${game?.external_id}`);
  console.log(`  Date: ${game?.start_time}`);
  console.log(`  Home: Team ${game?.home_team_id} (${game?.home_score})`);
  console.log(`  Away: Team ${game?.away_team_id} (${game?.away_score})`);
  
  // Try to fetch boxscore
  if (game?.external_id) {
    const gameId = game.external_id.replace('espn_nba_', '');
    const url = `${ESPN_BASE}/summary?event=${gameId}`;
    
    console.log(chalk.yellow(`\nFetching boxscore from: ${url}`));
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log(chalk.green('✅ Successfully fetched boxscore'));
      
      // Check structure
      if (response.data.boxscore) {
        console.log(chalk.cyan('\nBoxscore structure:'));
        console.log(`  Teams: ${response.data.boxscore.teams?.length || 0}`);
        
        response.data.boxscore.teams?.forEach((team: any, idx: number) => {
          console.log(`\n  Team ${idx + 1} (${team.homeAway}):`);
          console.log(`    Statistics groups: ${team.statistics?.length || 0}`);
          
          team.statistics?.forEach((stat: any) => {
            if (stat.type === 'athletes') {
              console.log(`    Athletes: ${stat.athletes?.length || 0} players`);
              
              // Show first player
              if (stat.athletes?.[0]) {
                const player = stat.athletes[0];
                console.log(chalk.yellow('\n    Sample player:'));
                console.log(`      Name: ${player.athlete?.displayName}`);
                console.log(`      ID: ${player.athlete?.id}`);
                console.log(`      Stats: ${player.stats?.length || 0} values`);
                console.log(`      Did not play: ${player.didNotPlay || false}`);
                if (player.stats) {
                  console.log(`      First few stats: ${player.stats.slice(0, 5).join(', ')}`);
                }
              }
            }
          });
        });
      } else {
        console.log(chalk.red('❌ No boxscore in response'));
        console.log('Response keys:', Object.keys(response.data));
      }
      
    } catch (error: any) {
      console.error(chalk.red('❌ Error fetching boxscore:'), error.message);
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Status Text: ${error.response.statusText}`);
      }
    }
  }
  
  // Check our players
  console.log(chalk.yellow('\n📊 Player check:'));
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport.eq.nba,sport.eq.basketball');
  
  console.log(`  Total NBA players in DB: ${totalPlayers}`);
  
  // Check a specific player
  const { data: samplePlayer } = await supabase
    .from('players')
    .select('*')
    .or('sport.eq.NBA,sport.eq.nba')
    .limit(1)
    .single();
  
  if (samplePlayer) {
    console.log(chalk.cyan('\n  Sample player from DB:'));
    console.log(`    ID: ${samplePlayer.id}`);
    console.log(`    Name: ${samplePlayer.name}`);
    console.log(`    External ID: ${samplePlayer.external_id}`);
    console.log(`    Team ID: ${samplePlayer.team_id}`);
    console.log(`    Sport: ${samplePlayer.sport}`);
  }
}

debugGame().catch(console.error);