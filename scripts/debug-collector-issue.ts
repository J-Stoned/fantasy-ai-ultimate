#!/usr/bin/env tsx
/**
 * Debug why the collector isn't saving stats
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';
import { playerMatcher } from './gpu-stats-collector/player-matcher';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugCollectorIssue() {
  console.log(chalk.bold.cyan('\n🔍 DEBUGGING COLLECTOR ISSUE\n'));
  
  // Get a game that was "successful" in the batch
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .limit(5);
  
  if (!games || games.length === 0) {
    console.error('No games found');
    return;
  }
  
  const game = games[0];
  console.log(chalk.yellow('Testing game:'), game.external_id);
  
  // Extract ESPN ID
  const match = game.external_id.match(/(\d+)$/);
  const espnId = match ? match[1] : null;
  
  if (!espnId) {
    console.error('Could not extract ESPN ID');
    return;
  }
  
  // Fetch from ESPN
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`;
  console.log(chalk.cyan('Fetching:'), url);
  
  try {
    const response = await axios.get(url);
    console.log(chalk.green('✓ API response received'));
    
    // Parse
    const parsed = SportParsers.parseNFLGame(response.data);
    console.log(chalk.green(`✓ Parsed ${parsed.length} players`));
    
    if (parsed.length === 0) {
      console.log(chalk.red('No players parsed - checking boxscore structure...'));
      console.log('Boxscore exists:', !!response.data.boxscore);
      console.log('Players array:', response.data.boxscore?.players?.length || 0);
      if (response.data.boxscore?.players?.[0]) {
        console.log('First team stats:', response.data.boxscore.players[0].statistics?.length || 0);
      }
      return;
    }
    
    // Test player matching for first 3 players
    console.log(chalk.cyan('\nTesting player matching...'));
    const statsToInsert: any[] = [];
    
    for (const playerData of parsed.slice(0, 3)) {
      console.log(chalk.gray(`Testing: ${playerData.playerName}`));
      
      try {
        const playerId = await playerMatcher.ensurePlayer({
          name: playerData.playerName,
          sport: 'nfl',
          espnId: playerData.playerId
        });
        
        console.log(chalk.green(`  ✓ Got player ID: ${playerId}`));
        
        // Create stats
        Object.entries(playerData.stats).forEach(([statName, statValue]) => {
          if (statValue !== null && statValue !== undefined && statValue !== 0) {
            statsToInsert.push({
              player_id: playerId,
              game_id: game.id,
              stat_type: statName,
              stat_value: String(statValue)
            });
          }
        });
        
      } catch (error) {
        console.error(chalk.red(`  ❌ Error: ${error}`));
      }
    }
    
    console.log(chalk.cyan(`\nCreated ${statsToInsert.length} stats to insert`));
    
    if (statsToInsert.length > 0) {
      console.log(chalk.gray('Sample stats:'));
      statsToInsert.slice(0, 3).forEach(s => {
        console.log(chalk.gray(`  Player ${s.player_id}: ${s.stat_type} = ${s.stat_value}`));
      });
      
      // Try inserting
      console.log(chalk.cyan('\nTesting database insert...'));
      const { error } = await supabase
        .from('player_stats')
        .insert(statsToInsert.slice(0, 3)); // Just first 3
        
      if (error) {
        console.error(chalk.red('Insert error:'), error);
      } else {
        console.log(chalk.green('✓ Insert successful!'));
      }
    }
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}

debugCollectorIssue().catch(console.error);