#!/usr/bin/env tsx
/**
 * 🏒 COLLECT NHL PLAYERS FROM GAME DATA
 * 
 * Extracts missing players directly from game summaries
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(100); // 100 concurrent requests

async function collectNHLPlayersFromGames() {
  console.log(chalk.bold.cyan('🏒 COLLECTING NHL PLAYERS FROM GAME DATA\n'));
  
  // Get all NHL games from 2021-22 season
  const allGames = [];
  let offset = 0;
  
  console.log(chalk.yellow('Loading NHL games...'));
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id')
      .eq('sport', 'NHL')
      .eq('status', 'Final')
      .gte('start_time', '2021-10-12')
      .lte('start_time', '2022-06-26')
      .range(offset, offset + 999)
      .order('id');
    
    if (!games || games.length === 0) break;
    
    allGames.push(...games);
    offset += games.length;
    
    if (games.length < 1000) break;
  }
  
  console.log(chalk.green(`Found ${allGames.length} NHL games\n`));
  
  // Get existing players
  const existingPlayers = new Map<string, boolean>();
  offset = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('external_id')
      .eq('sport', 'NHL')
      .range(offset, offset + 999);
    
    if (!players || players.length === 0) break;
    
    players.forEach(p => existingPlayers.set(p.external_id, true));
    offset += players.length;
    
    if (players.length < 1000) break;
  }
  
  console.log(chalk.gray(`${existingPlayers.size} NHL players already in database\n`));
  
  // Get teams for mapping
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NHL');
  
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Scanning games |{bar}| {percentage}% | {value}/{total} | Found: {players} new players',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  
  progressBar.start(allGames.length, 0, { players: 0 });
  
  const newPlayers = new Map<string, any>();
  let gamesProcessed = 0;
  
  // Process games in batches
  const batchSize = 100;
  for (let i = 0; i < allGames.length; i += batchSize) {
    const batch = allGames.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(game => 
        limit(async () => {
          try {
            const gameId = game.external_id.split('_').pop();
            const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
            
            const response = await axios.get(url, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            if (response.data.boxscore?.players) {
              for (const team of response.data.boxscore.players) {
                const teamId = teamMap.get(String(team.team.id));
                if (!teamId) continue;
                
                for (const statGroup of team.statistics || []) {
                  for (const athlete of statGroup.athletes || []) {
                    if (!athlete.athlete?.id) continue;
                    
                    const playerExternalId = `espn_nhl_${athlete.athlete.id}`;
                    
                    // Skip if already exists
                    if (existingPlayers.has(playerExternalId) || newPlayers.has(playerExternalId)) {
                      continue;
                    }
                    
                    newPlayers.set(playerExternalId, {
                      external_id: playerExternalId,
                      name: athlete.athlete.displayName || athlete.athlete.fullName || 'Unknown',
                      position: athlete.athlete.position?.abbreviation ? [athlete.athlete.position.abbreviation] : null,
                      team_id: teamId,
                      sport: 'NHL',
                      jersey_number: athlete.athlete.jersey || null,
                      metadata: {
                        espn_id: athlete.athlete.id,
                        headshot: athlete.athlete.headshot?.href || null,
                        collection_source: 'game_summaries'
                      }
                    });
                  }
                }
              }
            }
          } catch (error) {
            // Silently skip failed games
          }
          
          gamesProcessed++;
          progressBar.update(gamesProcessed, { players: newPlayers.size });
        })
      )
    );
  }
  
  progressBar.stop();
  
  const playersToInsert = Array.from(newPlayers.values());
  console.log(chalk.blue(`\nFound ${playersToInsert.length} new NHL players from game data`));
  
  // Insert new players
  if (playersToInsert.length > 0) {
    console.log(chalk.yellow('\nInserting new players...'));
    
    let inserted = 0;
    for (let i = 0; i < playersToInsert.length; i += 1000) {
      const batch = playersToInsert.slice(i, i + 1000);
      
      const { error, data } = await supabase
        .from('players')
        .insert(batch);
      
      if (error) {
        console.error(chalk.red('Insert error:'), error.message);
        // Try inserting one by one to find the problematic record
        console.log(chalk.yellow('Attempting individual inserts...'));
        
        for (const player of batch) {
          try {
            const { error: singleError, data: singleData } = await supabase
              .from('players')
              .insert([player]);
            
            if (!singleError && singleData) {
              inserted++;
            }
          } catch (e) {
            console.error(chalk.red(`Failed to insert player: ${player.name} (${player.external_id})`));
          }
        }
      } else {
        inserted += data?.length || batch.length;
      }
    }
    
    console.log(chalk.green(`\n✅ Inserted ${inserted} new NHL players!`));
  }
  
  // Final count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL');
  
  console.log(chalk.cyan(`\nTotal NHL players in database: ${count}`));
  
  // Show some examples of what we found
  if (playersToInsert.length > 0) {
    console.log(chalk.gray('\nExample players added:'));
    playersToInsert.slice(0, 5).forEach(p => {
      console.log(chalk.gray(`  ${p.name} (${p.external_id})`));
    });
  }
}

collectNHLPlayersFromGames()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });