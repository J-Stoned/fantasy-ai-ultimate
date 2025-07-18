#!/usr/bin/env tsx
/**
 * 🔥 COMPREHENSIVE MISSING PLAYERS COLLECTION
 * 
 * We're missing 35 stats per game because players like Ben Roethlisberger 
 * and Chase Claypool aren't in our database!
 * 
 * This script will:
 * - Analyze ALL 10 sample games 
 * - Extract ALL missing player IDs
 * - Batch add them to database with 12 parallel workers
 * - TARGET: Add 100+ missing players to get to 78 stats/game
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { InMemoryCache } from './utils/memory-cache';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(12); // 12 parallel workers (Ryzen optimization)

interface MissingPlayer {
  espnId: string;
  name: string;
  frequency: number;
  statGroups: Set<string>;
}

interface NewPlayer {
  external_id: string;
  name: string;
  firstname: string;
  lastname: string;
  position: string[];
  team_id: number;
  sport: string;
  metadata: any;
}

async function extractAllMissingPlayers() {
  console.log(chalk.bold.cyan('🔥 COMPREHENSIVE MISSING PLAYERS EXTRACTION\n'));
  
  // Get comprehensive game sample for analysis
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2023-01-01')
    .order('start_time')
    .limit(50); // Analyze 50 games to find ALL missing players
    
  if (!games) return [];
  
  // Initialize cache
  const cache = new InMemoryCache();
  await cache.initialize();
  
  console.log(chalk.yellow(`Analyzing ${games.length} games for missing players...\n`));
  
  const missingPlayerMap: Map<string, MissingPlayer> = new Map();
  
  for (const game of games) {
    const espnGameId = game.external_id?.split('_').pop();
    if (!espnGameId) continue;
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      const response = await axios.get(url, { timeout: 15000 });
      const gameData = response.data;
      
      if (!gameData.boxscore?.players) continue;
      
      for (const team of gameData.boxscore.players) {
        for (const statGroup of team.statistics || []) {
          for (const athlete of statGroup.athletes || []) {
            const playerId = athlete.athlete?.id;
            const playerName = athlete.athlete?.displayName;
            
            if (!playerId || !playerName) continue;
            
            // Check if player exists in cache
            const player = cache.getPlayerByExternalId(`espn_nfl_${playerId}`);
            
            if (!player) {
              const key = playerId;
              if (missingPlayerMap.has(key)) {
                const existing = missingPlayerMap.get(key)!;
                existing.frequency++;
                existing.statGroups.add(statGroup.name);
              } else {
                missingPlayerMap.set(key, {
                  espnId: playerId,
                  name: playerName,
                  frequency: 1,
                  statGroups: new Set([statGroup.name])
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`Skipped game ${game.id} due to error`));
      continue;
    }
  }
  
  return Array.from(missingPlayerMap.values())
    .sort((a, b) => b.frequency - a.frequency); // Sort by frequency
}

async function fetchPlayerDetails(espnId: string, cache: InMemoryCache): Promise<NewPlayer | null> {
  const endpoints = [
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${espnId}`,
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${espnId}`,
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2022/athletes/${espnId}`,
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2021/athletes/${espnId}`
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const playerData = response.data;
      
      let extractedData = null;
      if (playerData.displayName || playerData.name) {
        extractedData = playerData;
      } else if (playerData.athlete) {
        extractedData = playerData.athlete;
      }
      
      if (extractedData && (extractedData.displayName || extractedData.name)) {
        // Get team using cache
        let teamId = null;
        const teamData = extractedData.team;
        
        if (teamData?.id) {
          const dbTeam = cache.getTeamByExternalId(`espn_nfl_${teamData.id}`);
          teamId = dbTeam?.id;
        }
        
        // If no team found, get any NFL team
        if (!teamId) {
          const serialized = cache.serialize();
          const teams = new Map(serialized.teams);
          
          for (const [id, team] of teams) {
            if (team.sport === 'NFL') {
              teamId = id;
              break;
            }
          }
        }
        
        if (!teamId) continue;
        
        const fullName = extractedData.displayName || extractedData.name;
        const nameParts = fullName.split(' ');
        const firstname = nameParts[0] || 'Unknown';
        const lastname = nameParts.slice(1).join(' ') || 'Player';
        
        return {
          external_id: `espn_nfl_${espnId}`,
          name: fullName,
          firstname: firstname,
          lastname: lastname,
          position: [extractedData.position?.abbreviation || 'N/A'],
          team_id: teamId,
          sport: 'NFL',
          metadata: {
            height: extractedData.height,
            weight: extractedData.weight,
            age: extractedData.age,
            experience: extractedData.experience?.years,
            jersey: extractedData.jersey,
            headshot: extractedData.headshot?.href,
            college: extractedData.college?.name,
            collection_source: 'comprehensive-missing-player-fixer',
            espn_id: espnId,
            original_team_id: teamData?.id
          }
        };
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

async function comprehensiveMissingPlayersCollection() {
  console.log(chalk.bold.cyan('🔥 COMPREHENSIVE MISSING PLAYERS COLLECTION\n'));
  console.log(chalk.yellow('TARGET: Add 100+ missing players to reach 78 stats/game\n'));
  
  // Extract missing players
  const missingPlayers = await extractAllMissingPlayers();
  
  if (missingPlayers.length === 0) {
    console.log(chalk.green('✅ No missing players found!'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${missingPlayers.length} missing players to add\n`));
  
  // Show top missing players
  console.log(chalk.cyan('🎯 Top missing players by frequency:'));
  missingPlayers.slice(0, 15).forEach((player, i) => {
    const statGroupsStr = Array.from(player.statGroups).join(', ');
    console.log(chalk.white(`  ${i+1}. ${player.name} (seen ${player.frequency} times in ${statGroupsStr})`));
  });
  console.log('');
  
  // Initialize cache for API calls
  const cache = new InMemoryCache();
  await cache.initialize();
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} players | Found: {found}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(missingPlayers.length, 0, { found: 0 });
  
  let foundPlayers: NewPlayer[] = [];
  let processed = 0;
  
  // 12 parallel ESPN API calls
  const playerPromises = missingPlayers.map(player => 
    limit(async () => {
      const playerDetails = await fetchPlayerDetails(player.espnId, cache);
      
      if (playerDetails) {
        foundPlayers.push(playerDetails);
      }
      
      processed++;
      progressBar.update(processed, { found: foundPlayers.length });
    })
  );
  
  await Promise.all(playerPromises);
  progressBar.stop();
  
  console.log(chalk.blue(`\n📤 Mass inserting ${foundPlayers.length} players to database...`));
  
  // Single mass insert
  if (foundPlayers.length > 0) {
    const { error } = await supabase
      .from('players')
      .upsert(foundPlayers, { 
        onConflict: 'external_id',
        ignoreDuplicates: true 
      });
      
    if (error) {
      console.error(chalk.red('Error inserting players:', error));
    } else {
      console.log(chalk.green(`✅ Successfully added ${foundPlayers.length} players`));
    }
  }
  
  const successRate = Math.round((foundPlayers.length / missingPlayers.length) * 100);
  
  console.log(chalk.bold.green(`\n🔥 COMPREHENSIVE MISSING PLAYERS COMPLETE!`));
  console.log(chalk.white(`Players identified: ${missingPlayers.length}`));
  console.log(chalk.white(`Players found: ${foundPlayers.length}`));
  console.log(chalk.white(`Success rate: ${successRate}%`));
  
  if (foundPlayers.length >= 50) {
    console.log(chalk.bold.green('🚀 MAJOR PLAYER ADDITION: 50+ players added!'));
    console.log(chalk.green('This should significantly improve stats collection!'));
  }
  
  // Show sample of added players
  if (foundPlayers.length > 0) {
    console.log(chalk.cyan('\n🎯 Sample of key players added:'));
    foundPlayers.slice(0, 10).forEach(player => {
      console.log(chalk.white(`  ${player.name} (${player.position[0]}) - ${player.external_id}`));
    });
  }
}

if (require.main === module) {
  comprehensiveMissingPlayersCollection().catch(console.error);
}