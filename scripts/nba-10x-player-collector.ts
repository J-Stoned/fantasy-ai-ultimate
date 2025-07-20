#!/usr/bin/env tsx
/**
 * 🏀 NBA 10X PLAYER COLLECTOR
 * 
 * Collects all missing NBA players from game boxscores
 * Optimized for Ryzen 5 7600X + 32GB RAM
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

// 🔥 10X PERFORMANCE SETTINGS
const HTTP_LIMIT = pLimit(500); // 500 concurrent requests!
const BATCH_SIZE = 200; // Process 200 games at once

async function collectNBAPlayers() {
  console.log(chalk.bold.cyan('🏀 NBA 10X PLAYER COLLECTOR\n'));
  
  // Load existing players with pagination
  console.log(chalk.yellow('Loading existing NBA players...'));
  const existingPlayers = new Set<string>();
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('external_id')
      .eq('sport', 'NBA')
      .range(offset, offset + 999)
      .order('id');
      
    if (!data || data.length === 0) break;
    
    data.forEach(p => existingPlayers.add(p.external_id));
    offset += data.length;
    
    if (data.length < 1000) break;
  }
  
  console.log(chalk.green(`✅ Loaded ${existingPlayers.size} existing NBA players\n`));
  
  // Get all NBA games from 2021-22 season
  console.log(chalk.yellow('Loading NBA games...'));
  const allGames = [];
  offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id')
      .eq('sport', 'NBA')
      .eq('status', 'Final')
      .gte('start_time', '2021-10-19')
      .lte('start_time', '2022-06-16')
      .range(offset, offset + 999)
      .order('id');
      
    if (!data || data.length === 0) break;
    
    allGames.push(...data);
    offset += data.length;
    
    if (data.length < 1000) break;
  }
  
  console.log(chalk.green(`✅ Found ${allGames.length} NBA games\n`));
  
  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NBA');
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | New players: {players}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(allGames.length, 0, { players: 0 });
  
  const newPlayers = new Map<string, any>();
  let gamesProcessed = 0;
  
  // Process games in batches
  for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
    const batch = allGames.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(game => 
        HTTP_LIMIT(async () => {
          try {
            const gameId = game.external_id.split('_').pop();
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
            
            const response = await axios.get(url, {
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            const data = response.data;
            
            if (data.boxscore?.players) {
              for (const team of data.boxscore.players) {
                const espnTeamId = team.team.id;
                const teamId = teamMap.get(String(espnTeamId));
                
                if (!teamId) continue;
                
                // Process all stat groups (starters, bench, etc.)
                for (const statGroup of team.statistics || []) {
                  for (const athlete of statGroup.athletes || []) {
                    if (!athlete.athlete?.id) continue;
                    
                    const playerExternalId = `espn_nba_${athlete.athlete.id}`;
                    
                    // Skip if already exists
                    if (existingPlayers.has(playerExternalId) || newPlayers.has(playerExternalId)) {
                      continue;
                    }
                    
                    // Extract jersey number from display name if available
                    const displayName = athlete.athlete.displayName || '';
                    const jerseyMatch = displayName.match(/^#(\d+)/);
                    const jerseyNumber = jerseyMatch ? jerseyMatch[1] : 
                                       athlete.athlete.jersey || null;
                    
                    newPlayers.set(playerExternalId, {
                      external_id: playerExternalId,
                      name: athlete.athlete.shortName || athlete.athlete.displayName || 'Unknown',
                      position: athlete.athlete.position?.abbreviation ? [athlete.athlete.position.abbreviation] : null,
                      team_id: teamId,
                      sport: 'NBA',
                      jersey_number: jerseyNumber,
                      metadata: {
                        espn_id: athlete.athlete.id,
                        headshot: athlete.athlete.headshot?.href || null,
                        collection_source: 'nba-10x-collector'
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
  console.log(chalk.blue(`\n📊 Found ${playersToInsert.length} new NBA players`));
  
  // Insert new players in batches
  if (playersToInsert.length > 0) {
    console.log(chalk.yellow('\nInserting new players...'));
    
    let inserted = 0;
    for (let i = 0; i < playersToInsert.length; i += 1000) {
      const batch = playersToInsert.slice(i, i + 1000);
      
      const { error, data } = await supabase
        .from('players')
        .insert(batch)
        .select();
        
      if (error) {
        console.error(chalk.red('Insert error:'), error.message);
      } else {
        inserted += data?.length || batch.length;
      }
    }
    
    console.log(chalk.green(`\n✅ Inserted ${inserted} new NBA players!`));
  } else {
    console.log(chalk.yellow('\nNo new players to insert'));
  }
  
  // Final count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
  
  console.log(chalk.cyan(`\n📊 Total NBA players in database: ${count}`));
  
  // Show performance stats
  console.log(chalk.bold.yellow('\n⚡ PERFORMANCE STATS:'));
  console.log(chalk.gray(`  Games processed: ${allGames.length}`));
  console.log(chalk.gray(`  New players found: ${playersToInsert.length}`));
  console.log(chalk.gray(`  HTTP concurrency: 500 requests`));
  console.log(chalk.gray(`  Batch size: ${BATCH_SIZE} games`));
}

collectNBAPlayers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });