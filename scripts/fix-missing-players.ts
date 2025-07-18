#!/usr/bin/env tsx
/**
 * ⚡ FIX MISSING NFL PLAYERS
 * 
 * Batch add the 87 missing NFL players identified by turbo debugger
 * - 12 parallel ESPN API calls (Ryzen optimization)
 * - Mass insert to database with proper team mapping
 * - Expected: Add ~100 missing players in under 3 minutes
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

const limit = pLimit(12); // 12 concurrent requests (Ryzen 5 7600X optimization)

interface MissingPlayer {
  espnId: string;
  name: string;
  frequency: number; // How many times we saw them missing
}

interface NewPlayer {
  external_id: string;
  name: string;
  position: string;
  team_id: number;
  sport: string;
  metadata: any;
}

async function extractMissingPlayers(): Promise<MissingPlayer[]> {
  console.log(chalk.cyan('🔍 Re-running turbo debugger to extract missing players...'));
  
  // Get a fresh list of missing players by running a quick debug
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2023-01-01')
    .limit(20); // Just 20 games to get missing player list
    
  if (!sampleGames) return [];
  
  const missingPlayerMap: Map<string, MissingPlayer> = new Map();
  
  console.log(chalk.gray(`Analyzing ${sampleGames.length} games for missing players...`));
  
  for (const game of sampleGames) {
    const espnGameId = game.external_id?.split('_').pop();
    if (!espnGameId) continue;
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      const response = await axios.get(url, { timeout: 10000 });
      const gameData = response.data;
      
      if (!gameData.boxscore?.players) continue;
      
      for (const team of gameData.boxscore.players) {
        for (const statGroup of team.statistics || []) {
          for (const athlete of statGroup.athletes || []) {
            const playerId = athlete.athlete?.id;
            const playerName = athlete.athlete?.displayName;
            
            if (!playerId || !playerName) continue;
            
            // Check if player exists in database
            const { data: existingPlayer } = await supabase
              .from('players')
              .select('id')
              .eq('external_id', `espn_nfl_${playerId}`)
              .single();
              
            if (!existingPlayer) {
              const key = `espn_nfl_${playerId}`;
              if (missingPlayerMap.has(key)) {
                missingPlayerMap.get(key)!.frequency++;
              } else {
                missingPlayerMap.set(key, {
                  espnId: playerId,
                  name: playerName,
                  frequency: 1
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip errored games
      continue;
    }
  }
  
  return Array.from(missingPlayerMap.values())
    .sort((a, b) => b.frequency - a.frequency); // Sort by frequency
}

async function fetchPlayerDetails(espnId: string): Promise<NewPlayer | null> {
  try {
    // Try multiple ESPN API endpoints for player details
    const urls = [
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${espnId}`,
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${espnId}`
    ];
    
    for (const url of urls) {
      try {
        const response = await axios.get(url, { timeout: 5000 });
        const playerData = response.data;
        
        if (playerData.displayName || playerData.name) {
          // Get team information
          let teamId = null;
          const teamData = playerData.team;
          
          if (teamData?.id) {
            // Look up team in our database
            const { data: dbTeam } = await supabase
              .from('teams')
              .select('id')
              .eq('external_id', `espn_nfl_${teamData.id}`)
              .single();
              
            teamId = dbTeam?.id;
          }
          
          // If no team found, use a default team (free agent)
          if (!teamId) {
            // Get any NFL team as default
            const { data: defaultTeam } = await supabase
              .from('teams')
              .select('id')
              .eq('sport', 'NFL')
              .limit(1)
              .single();
              
            teamId = defaultTeam?.id;
          }
          
          if (!teamId) {
            console.log(chalk.yellow(`  No team found for ${playerData.displayName || playerData.name}`));
            return null;
          }
          
          return {
            external_id: `espn_nfl_${espnId}`,
            name: playerData.displayName || playerData.name || `Player ${espnId}`,
            position: playerData.position?.abbreviation || 'N/A',
            team_id: teamId,
            sport: 'NFL',
            metadata: {
              height: playerData.height,
              weight: playerData.weight,
              age: playerData.age,
              experience: playerData.experience?.years,
              jersey: playerData.jersey,
              headshot: playerData.headshot?.href,
              college: playerData.college?.name,
              collection_source: 'missing-player-fixer',
              espn_id: espnId
            }
          };
        }
      } catch (error) {
        // Try next URL
        continue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function fixMissingPlayers() {
  console.log(chalk.bold.cyan('⚡ FIXING MISSING NFL PLAYERS\n'));
  
  // Step 1: Extract missing players
  const missingPlayers = await extractMissingPlayers();
  
  if (missingPlayers.length === 0) {
    console.log(chalk.green('✅ No missing players found!'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${missingPlayers.length} missing players to add\n`));
  
  // Show top missing players
  console.log(chalk.cyan('Top missing players by frequency:'));
  missingPlayers.slice(0, 10).forEach((player, i) => {
    console.log(chalk.white(`  ${i+1}. ${player.name} (seen ${player.frequency} times)`));
  });
  console.log('');
  
  // Step 2: Fetch player details in parallel
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} players | Found: {found}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(missingPlayers.length, 0, { found: 0 });
  
  let foundPlayers: NewPlayer[] = [];
  let processed = 0;
  
  const playerPromises = missingPlayers.map(player => 
    limit(async () => {
      const playerDetails = await fetchPlayerDetails(player.espnId);
      
      if (playerDetails) {
        foundPlayers.push(playerDetails);
      }
      
      processed++;
      progressBar.update(processed, { found: foundPlayers.length });
    })
  );
  
  await Promise.all(playerPromises);
  progressBar.stop();
  
  console.log(chalk.blue(`\n📤 Adding ${foundPlayers.length} players to database...`));
  
  // Step 3: Batch insert to database
  if (foundPlayers.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < foundPlayers.length; i += batchSize) {
      const batch = foundPlayers.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('players')
        .upsert(batch, { 
          onConflict: 'external_id',
          ignoreDuplicates: true 
        });
        
      if (error) {
        console.error(chalk.red('Error inserting batch:', error));
      } else {
        console.log(chalk.green(`  ✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(foundPlayers.length/batchSize)}`));
      }
    }
  }
  
  console.log(chalk.bold.green(`\n✅ MISSING PLAYERS FIX COMPLETE!`));
  console.log(chalk.white(`Missing players identified: ${missingPlayers.length}`));
  console.log(chalk.white(`Player details found: ${foundPlayers.length}`));
  console.log(chalk.white(`Success rate: ${Math.round(foundPlayers.length/missingPlayers.length*100)}%`));
}

if (require.main === module) {
  fixMissingPlayers().catch(console.error);
}