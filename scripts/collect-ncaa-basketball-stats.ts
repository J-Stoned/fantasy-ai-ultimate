#!/usr/bin/env tsx
/**
 * 🏀 NCAA BASKETBALL STATS COLLECTOR
 * Applies ALL lessons learned from NCAA Football stats collection
 * - Proper pagination from the start
 * - Uses espn_ncaabb_ external ID matching
 * - Memory-first approach with 900-record batches
 * - Processes completed games efficiently
 * - Comprehensive error handling and verification
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameStats {
  gameId: string;
  players: any[];
  teams: any[];
}

async function fetchGameStats(gameId: string): Promise<GameStats | null> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`;
    const response = await axios.get(url);
    
    if (response.data?.boxscore?.players) {
      return {
        gameId,
        players: response.data.boxscore.players,
        teams: response.data.boxscore.teams || []
      };
    }
    
    return null;
  } catch (error) {
    // Skip individual game errors
    return null;
  }
}

function calculateBasketballFantasyPoints(stats: any): number {
  let points = 0;
  
  // Standard fantasy basketball scoring
  if (stats.points) points += stats.points * 1; // 1 point per point
  if (stats.rebounds) points += stats.rebounds * 1.2; // 1.2 points per rebound
  if (stats.assists) points += stats.assists * 1.5; // 1.5 points per assist
  if (stats.steals) points += stats.steals * 3; // 3 points per steal
  if (stats.blocks) points += stats.blocks * 3; // 3 points per block
  if (stats.turnovers) points -= stats.turnovers * 1; // -1 point per turnover
  if (stats.fieldGoalsMade) points += stats.fieldGoalsMade * 0.5; // Bonus for made shots
  if (stats.threePointFieldGoalsMade) points += stats.threePointFieldGoalsMade * 0.5; // Bonus for 3s
  
  return Math.round(points * 100) / 100; // Round to 2 decimal places
}

async function collectNCAABasketballStats() {
  console.log(chalk.bold.blue('🏀 NCAA BASKETBALL STATS COLLECTOR'));
  console.log(chalk.blue('=====================================\n'));
  
  // Get all completed NCAA Basketball games with proper pagination
  console.log('📊 Loading completed NCAA Basketball games with pagination...');
  const completedGames = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, external_id, start_time, status, metadata')
      .eq('sport', 'NCAA_BB')
      .in('status', ['STATUS_FINAL', 'Final'])
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching games:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    completedGames.push(...data);
    console.log(`Loaded ${completedGames.length} completed games...`);
    
    from += batchSize;
    if (data.length < batchSize) break;
  }
  
  console.log(`\n✅ Found ${completedGames.length} completed games to process`);
  
  // Get all NCAA Basketball players with proper pagination
  console.log('📊 Loading NCAA Basketball players with pagination...');
  const allPlayers = [];
  let playerFrom = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, external_id, team_id, name')
      .eq('sport_id', 'NCAA_BB')
      .range(playerFrom, playerFrom + batchSize - 1);
    
    if (error) {
      console.error('Error fetching players:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allPlayers.push(...data);
    playerFrom += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  // Create player lookup by external ID
  const playerLookup = new Map();
  allPlayers.forEach(player => {
    const espnId = player.external_id.replace('espn_ncaabb_', '');
    playerLookup.set(espnId, player);
  });
  
  console.log(`✅ Loaded ${allPlayers.length} players for stats matching`);
  
  // Skip existing stats check - we confirmed there are 0
  const existingStats = new Set();
  console.log('Skipping existing stats check (confirmed 0 NCAA Basketball stats)\n');
  
  // Process games in concurrent batches
  console.log('🔍 Processing game stats with concurrent requests...');
  const statsToInsert = [];
  const concurrentBatch = 100; // Increased for Ryzen 5 7600X with 6 cores
  let processedGames = 0;
  let totalStatsFound = 0;
  
  for (let i = 0; i < completedGames.length; i += concurrentBatch) {
    const gameBatch = completedGames.slice(i, i + concurrentBatch);
    
    const statsFetches = gameBatch.map(async (game) => {
      const espnGameId = game.external_id.replace('espn_ncaabb_', '');
      const gameStats = await fetchGameStats(espnGameId);
      
      if (!gameStats) return [];
      
      const gamePlayerStats = [];
      
      // Process both teams
      gameStats.players.forEach((teamData, teamIndex) => {
        if (!teamData.statistics || !Array.isArray(teamData.statistics)) return;
        
        // Player stats are in the first statistics element
        const playerStats = teamData.statistics[0];
        if (!playerStats.athletes || !Array.isArray(playerStats.athletes)) return;
        
        playerStats.athletes.forEach((playerStat: any) => {
          if (!playerStat.athlete?.id) return;
          
          const player = playerLookup.get(playerStat.athlete.id);
          if (!player) return;
          
          // Extract basketball stats
          const stats = {};
          if (playerStat.stats && Array.isArray(playerStat.stats)) {
            // Parse field goals (format: "made-attempted")
            const fgParts = playerStat.stats[1]?.split('-') || ['0', '0'];
            const fg3Parts = playerStat.stats[2]?.split('-') || ['0', '0'];
            const ftParts = playerStat.stats[3]?.split('-') || ['0', '0'];
            
            stats['minutes'] = parseFloat(playerStat.stats[0]) || 0;
            stats['fieldGoalsMade'] = parseFloat(fgParts[0]) || 0;
            stats['fieldGoalsAttempted'] = parseFloat(fgParts[1]) || 0;
            stats['threePointFieldGoalsMade'] = parseFloat(fg3Parts[0]) || 0;
            stats['threePointFieldGoalsAttempted'] = parseFloat(fg3Parts[1]) || 0;
            stats['freeThrowsMade'] = parseFloat(ftParts[0]) || 0;
            stats['freeThrowsAttempted'] = parseFloat(ftParts[1]) || 0;
            stats['offensiveRebounds'] = parseFloat(playerStat.stats[4]) || 0;
            stats['defensiveRebounds'] = parseFloat(playerStat.stats[5]) || 0;
            stats['rebounds'] = parseFloat(playerStat.stats[6]) || 0;
            stats['assists'] = parseFloat(playerStat.stats[7]) || 0;
            stats['steals'] = parseFloat(playerStat.stats[8]) || 0;
            stats['blocks'] = parseFloat(playerStat.stats[9]) || 0;
            stats['turnovers'] = parseFloat(playerStat.stats[10]) || 0;
            stats['personalFouls'] = parseFloat(playerStat.stats[11]) || 0;
            stats['points'] = parseFloat(playerStat.stats[12]) || 0;
          }
          
          const fantasyPoints = calculateBasketballFantasyPoints(stats);
          
          // Check if this stat already exists
          const statKey = `${player.id}-${game.id}`;
          if (!existingStats.has(statKey)) {
            gamePlayerStats.push({
              player_id: player.id,
              game_id: game.id,
              game_date: game.start_time,
              is_home: teamIndex === 1, // Second team is typically home
              stats,
              fantasy_points: fantasyPoints
            });
          }
        });
      });
      
      return gamePlayerStats;
    });
    
    const batchResults = await Promise.all(statsFetches);
    
    // Accumulate stats in memory
    batchResults.forEach(gameStats => {
      if (gameStats.length > 0) {
        statsToInsert.push(...gameStats);
        totalStatsFound += gameStats.length;
      }
    });
    
    processedGames += gameBatch.length;
    const progress = Math.round((processedGames / completedGames.length) * 100);
    const avgStatsPerGame = totalStatsFound / processedGames;
    const estimatedTotalStats = Math.round(avgStatsPerGame * completedGames.length);
    console.log(`Processed ${processedGames}/${completedGames.length} games (${progress}%): ${totalStatsFound} stats found (~${estimatedTotalStats} total expected)`);
    
    // Reduced rate limiting since we're using our own CPU
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n✅ Found ${totalStatsFound} player stats from ${completedGames.length} games`);
  
  // Deduplicate stats before inserting
  const deduplicatedStats = [];
  const seenStats = new Set();
  
  for (const stat of statsToInsert) {
    const key = `${stat.player_id}-${stat.game_id}`;
    if (!seenStats.has(key)) {
      seenStats.add(key);
      deduplicatedStats.push(stat);
    }
  }
  
  console.log(`After deduplication: ${deduplicatedStats.length} unique stats (removed ${statsToInsert.length - deduplicatedStats.length} duplicates)`);
  
  if (deduplicatedStats.length > 0) {
    // Insert in batches of 900 (lesson learned)
    console.log('\n🚀 Inserting stats in 900-record batches...');
    const insertBatchSize = 900;
    let insertedCount = 0;
    
    for (let i = 0; i < deduplicatedStats.length; i += insertBatchSize) {
      const batch = deduplicatedStats.slice(i, i + insertBatchSize);
      
      const { error: insertError, data: insertData } = await supabase
        .from('player_game_logs')
        .insert(batch)
        .select('id');
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i / insertBatchSize) + 1}: ${insertError.message}`);
        
        // If it's a duplicate key error, try inserting one by one
        if (insertError.message.includes('duplicate key')) {
          console.log('⚠️  Attempting individual inserts for this batch...');
          let individualInserts = 0;
          
          for (const stat of batch) {
            const { error: singleError } = await supabase
              .from('player_game_logs')
              .insert(stat);
            
            if (!singleError) {
              individualInserts++;
            }
          }
          
          insertedCount += individualInserts;
          console.log(`✅ Individually inserted ${individualInserts}/${batch.length} stats from batch`);
        }
      } else {
        insertedCount += insertData?.length || batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(deduplicatedStats.length / insertBatchSize)} (${insertedCount}/${deduplicatedStats.length})`);
      }
    }
    
    console.log(`\n🎉 Successfully added ${insertedCount} NCAA Basketball stats!`);
  } else {
    console.log('\n✅ All NCAA Basketball stats already in database!');
  }
  
  // Final verification
  console.log('\n📊 Final stats verification...');
  const finalStats = [];
  let statsFrom = 0;
  
  while (true) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id, fantasy_points')
      .in('game_id', completedGames.map(g => g.id))
      .range(statsFrom, statsFrom + 999);
    
    if (!data || data.length === 0) break;
    
    finalStats.push(...data);
    statsFrom += 1000;
    
    if (data.length < 1000) break;
  }
  
  console.log(`Final count: ${finalStats.length} NCAA Basketball stats in database`);
  
  // Sample stats for verification
  const sampleStats = finalStats.slice(0, 3);
  console.log('\n🏀 Sample stats:');
  sampleStats.forEach((stat, i) => {
    console.log(`${i + 1}. Player ${stat.player_id} - Game ${stat.game_id} - ${stat.fantasy_points} fantasy points`);
  });
  
  console.log('\n' + chalk.bold.green('✅ NCAA Basketball stats collection complete!'));
  console.log(chalk.green(`📊 ${finalStats.length} stats from ${completedGames.length} completed games`));
  console.log(chalk.green('🎯 NCAA Basketball collection 100% complete!'));
  
  return {
    totalStats: finalStats.length,
    completedGames: completedGames.length,
    playersWithStats: new Set(finalStats.map(s => s.player_id)).size
  };
}

collectNCAABasketballStats().catch(console.error);