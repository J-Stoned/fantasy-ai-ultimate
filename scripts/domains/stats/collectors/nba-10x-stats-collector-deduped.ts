#!/usr/bin/env tsx
/**
 * 🏀 NBA 10X STATS COLLECTOR - DEDUPED
 * 
 * Fixed to handle duplicate stat groups and proper metadata queries
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

async function collectNBAStats() {
  console.log(chalk.bold.cyan('🏀 NBA 10X STATS COLLECTOR - DEDUPED\n'));
  
  // Load all players with pagination
  console.log(chalk.yellow('Loading NBA players...'));
  const playerMap = new Map<string, number>();
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NBA')
      .range(offset, offset + 999)
      .order('id');
      
    if (!data || data.length === 0) break;
    
    data.forEach(p => playerMap.set(p.external_id, p.id));
    offset += data.length;
    
    if (data.length < 1000) break;
  }
  
  console.log(chalk.green(`✅ Loaded ${playerMap.size} NBA players\n`));
  
  // Debug: Check what's in metadata
  console.log(chalk.yellow('Checking metadata format...'));
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('metadata')
    .limit(5);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.gray('Sample metadata:', JSON.stringify(sampleStats[0].metadata, null, 2)));
  }
  
  // Get games with stats - try both query formats
  console.log(chalk.yellow('Finding games with stats...'));
  const gamesWithStats = new Set<number>();
  offset = 0;
  
  // First try the correct PostgreSQL JSON syntax
  while (true) {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_id, metadata')
      .eq("metadata->>'sport'", 'NBA')
      .range(offset, offset + 999);
      
    if (error) {
      console.log(chalk.red('Error with JSON query:', error.message));
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(s => gamesWithStats.add(s.game_id));
    offset += data.length;
    
    if (data.length < 1000) break;
  }
  
  // If no results, try filtering in memory
  if (gamesWithStats.size === 0) {
    console.log(chalk.yellow('  Trying in-memory filter...'));
    offset = 0;
    
    while (true) {
      const { data } = await supabase
        .from('player_game_logs')
        .select('game_id, metadata')
        .range(offset, offset + 999);
        
      if (!data || data.length === 0) break;
      
      data.forEach(s => {
        if (s.metadata?.sport === 'NBA') {
          gamesWithStats.add(s.game_id);
        }
      });
      
      offset += data.length;
      if (data.length < 1000) break;
    }
  }
  
  console.log(chalk.gray(`  Games with stats: ${gamesWithStats.size}`));
  
  // Now get all games and filter
  const gamesWithoutStats = [];
  offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time')
      .eq('sport', 'NBA')
      .eq('status', 'Final')
      .gte('start_time', '2021-10-19')
      .lte('start_time', '2022-06-16')
      .range(offset, offset + 999)
      .order('id');
      
    if (!data || data.length === 0) break;
    
    // Filter out games that already have stats
    const newGames = data.filter(g => !gamesWithStats.has(g.id));
    gamesWithoutStats.push(...newGames);
    
    offset += data.length;
    if (data.length < 1000) break;
  }
  
  console.log(chalk.green(`✅ Found ${gamesWithoutStats.length} games without stats\n`));
  
  if (gamesWithoutStats.length === 0) {
    console.log(chalk.yellow('All games already have stats!'));
    return;
  }
  
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
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Speed: {speed}/sec',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(gamesWithoutStats.length, 0, { stats: 0, speed: 0 });
  
  const allStats = [];
  let gamesProcessed = 0;
  const startTime = Date.now();
  
  // Process games in batches
  for (let i = 0; i < gamesWithoutStats.length; i += BATCH_SIZE) {
    const batch = gamesWithoutStats.slice(i, i + BATCH_SIZE);
    const batchStats = [];
    
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
              // Track processed players for this game to avoid duplicates
              const processedPlayers = new Set<string>();
              
              for (const team of data.boxscore.players) {
                const espnTeamId = team.team.id;
                const teamId = teamMap.get(String(espnTeamId));
                
                if (!teamId) continue;
                
                const isHome = team.homeAway === 'home';
                const opponentId = isHome ? game.away_team_id : game.home_team_id;
                
                // Process only the first stat group OR combine all groups
                // For now, we'll process all but track duplicates
                for (const statGroup of team.statistics || []) {
                  for (const athlete of statGroup.athletes || []) {
                    if (!athlete.athlete?.id) continue;
                    
                    const playerId = `espn_nba_${athlete.athlete.id}`;
                    const dbPlayerId = playerMap.get(playerId);
                    if (!dbPlayerId) continue;
                    
                    // Skip if we've already processed this player for this game
                    const playerGameKey = `${dbPlayerId}_${game.id}`;
                    if (processedPlayers.has(playerGameKey)) continue;
                    processedPlayers.add(playerGameKey);
                    
                    const statValues = athlete.stats || [];
                    if (statValues.length < 14) continue; // NBA has 14 stats
                    
                    // Parse NBA stats with correct indices
                    // Format: MIN,FG,3PT,FT,OREB,DREB,REB,AST,STL,BLK,TO,PF,+/-,PTS
                    const stats: any = {
                      minutes_played: parseFloat(statValues[0]) || 0,
                      points: parseInt(statValues[13]) || 0,
                      rebounds: parseInt(statValues[6]) || 0,
                      assists: parseInt(statValues[7]) || 0,
                      steals: parseInt(statValues[8]) || 0,
                      blocks: parseInt(statValues[9]) || 0,
                      turnovers: parseInt(statValues[10]) || 0,
                      fouls: parseInt(statValues[11]) || 0,
                      offensive_rebounds: parseInt(statValues[4]) || 0,
                      defensive_rebounds: parseInt(statValues[5]) || 0
                    };
                    
                    // Parse made-attempted format (e.g., "2-3" -> made: 2, attempted: 3)
                    const fgParts = String(statValues[1]).split('-');
                    stats.field_goals_made = parseInt(fgParts[0]) || 0;
                    stats.field_goals_attempted = parseInt(fgParts[1]) || 0;
                    
                    const threeParts = String(statValues[2]).split('-');
                    stats.three_pointers_made = parseInt(threeParts[0]) || 0;
                    stats.three_pointers_attempted = parseInt(threeParts[1]) || 0;
                    
                    const ftParts = String(statValues[3]).split('-');
                    stats.free_throws_made = parseInt(ftParts[0]) || 0;
                    stats.free_throws_attempted = parseInt(ftParts[1]) || 0;
                    
                    stats.plus_minus = parseInt(statValues[12]) || 0;
                    
                    // Calculate fantasy points
                    const fantasyPoints = (stats.points || 0) + 
                                         (stats.rebounds || 0) * 1.2 + 
                                         (stats.assists || 0) * 1.5 + 
                                         (stats.steals || 0) * 3 + 
                                         (stats.blocks || 0) * 3 - 
                                         (stats.turnovers || 0);
                    
                    batchStats.push({
                      player_id: dbPlayerId,
                      game_id: game.id,
                      team_id: teamId,
                      opponent_id: opponentId,
                      game_date: new Date(game.start_time).toISOString().split('T')[0],
                      is_home: isHome,
                      stats: stats,
                      fantasy_points: fantasyPoints,
                      metadata: {
                        sport: 'NBA',
                        stat_group: statGroup.name?.toLowerCase() || 'players',
                        collection_source: 'nba-10x-stats-deduped'
                      }
                    });
                  }
                }
              }
            }
          } catch (error: any) {
            // Log errors for debugging
            if (error.response?.status !== 404) {
              console.error(chalk.red(`\nError for game ${game.external_id}:`), error.message);
            }
          }
          
          gamesProcessed++;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = Math.round(gamesProcessed / elapsed);
          
          progressBar.update(gamesProcessed, { 
            stats: allStats.length + batchStats.length,
            speed: speed
          });
        })
      )
    );
    
    allStats.push(...batchStats);
  }
  
  progressBar.stop();
  
  console.log(chalk.blue(`\n📊 Collected ${allStats.length} new stats`));
  
  // Insert stats in batches with duplicate handling
  if (allStats.length > 0) {
    console.log(chalk.yellow('\nInserting stats...'));
    
    let inserted = 0;
    let duplicates = 0;
    
    for (let i = 0; i < allStats.length; i += 1000) {
      const batch = allStats.slice(i, i + 1000);
      
      // Try to insert with upsert to handle duplicates
      const { error, data } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
        .select();
        
      if (error) {
        console.error(chalk.red('Insert error:'), error.message);
        
        // If upsert fails, try inserting one by one to identify issues
        for (const stat of batch) {
          const { error: singleError, data: singleData } = await supabase
            .from('player_game_logs')
            .insert(stat)
            .select();
            
          if (!singleError && singleData) {
            inserted++;
          } else if (singleError?.message.includes('duplicate')) {
            duplicates++;
          }
        }
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`\n✅ Inserted ${inserted} new NBA stats!`));
    if (duplicates > 0) {
      console.log(chalk.yellow(`⚠️  Skipped ${duplicates} duplicates`));
    }
  }
  
  // Final verification with proper queries
  let totalStats = 0;
  let nbaGameCount = 0;
  
  // Try the PostgreSQL JSON query first
  const { count: jsonCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq("metadata->>'sport'", 'NBA');
    
  if (jsonCount) {
    totalStats = jsonCount;
  } else {
    // Fallback to counting in memory
    let verifyOffset = 0;
    const nbaGameIds = new Set<number>();
    
    while (true) {
      const { data } = await supabase
        .from('player_game_logs')
        .select('game_id, metadata')
        .range(verifyOffset, verifyOffset + 999);
        
      if (!data || data.length === 0) break;
      
      data.forEach(s => {
        if (s.metadata?.sport === 'NBA') {
          totalStats++;
          nbaGameIds.add(s.game_id);
        }
      });
      
      verifyOffset += data.length;
      if (data.length < 1000) break;
    }
    
    nbaGameCount = nbaGameIds.size;
  }
  
  // If we got the count via JSON query, we need to count unique games separately
  if (jsonCount && nbaGameCount === 0) {
    const { data: nbaStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .eq("metadata->>'sport'", 'NBA')
      .limit(1000);
      
    if (nbaStats) {
      nbaGameCount = new Set(nbaStats.map(s => s.game_id)).size;
    }
  }
  
  console.log(chalk.bold.cyan('\n📊 FINAL NBA STATS:'));
  console.log(chalk.green(`  Total stats: ${totalStats.toLocaleString()}`));
  console.log(chalk.green(`  Games with stats: ${nbaGameCount}/1322`));
  console.log(chalk.green(`  Coverage: ${((nbaGameCount / 1322) * 100).toFixed(1)}%`));
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(chalk.yellow(`\n⚡ Completed in ${totalTime} seconds!`));
}

collectNBAStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });