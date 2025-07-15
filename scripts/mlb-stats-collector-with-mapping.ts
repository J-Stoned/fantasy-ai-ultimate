#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

// MLB player ID offset - we'll use IDs starting from 5000000 for MLB players
// This keeps us well within the integer range (max ~2.1 billion)
const MLB_PLAYER_ID_OFFSET = 5000000;

// Cache for player mappings
const playerIdMap = new Map<string, number>();
let nextPlayerId = MLB_PLAYER_ID_OFFSET;

// Get or create numeric ID for MLB player
async function getNumericPlayerId(mlbPlayerId: string, playerName?: string): Promise<number> {
  // Check cache first
  if (playerIdMap.has(mlbPlayerId)) {
    return playerIdMap.get(mlbPlayerId)!;
  }
  
  // Check if player exists in players table
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', mlbPlayerId)
    .single();
    
  if (existingPlayer) {
    playerIdMap.set(mlbPlayerId, existingPlayer.id);
    return existingPlayer.id;
  }
  
  // Create new player with next available ID
  const numericId = nextPlayerId++;
  
  // Insert into players table
  const { data: newPlayer, error } = await supabase
    .from('players')
    .insert({
      id: numericId,
      name: playerName || `MLB Player ${mlbPlayerId}`,
      external_id: mlbPlayerId,
      sport: 'MLB',
      metadata: {
        mlb_player_id: mlbPlayerId,
        original_id: mlbPlayerId
      }
    })
    .select()
    .single();
    
  if (error) {
    console.error(`Failed to create player mapping for ${mlbPlayerId}:`, error.message);
    // Still cache it to avoid repeated attempts
  }
  
  playerIdMap.set(mlbPlayerId, numericId);
  return numericId;
}

// Helper to calculate fantasy points
function calculateBattingFantasyPoints(stats: any): number {
  let points = 0;
  points += (stats.hits || 0) * 3;
  points += (stats.doubles || 0) * 2;
  points += (stats.triples || 0) * 3;
  points += (stats.homeRuns || 0) * 10;
  points += (stats.rbi || 0) * 2;
  points += (stats.runs || 0) * 2;
  points += (stats.baseOnBalls || 0) * 1;
  points += (stats.stolenBases || 0) * 5;
  points -= (stats.strikeOuts || 0) * 1;
  return points;
}

function calculatePitchingFantasyPoints(stats: any): number {
  let points = 0;
  const innings = parseFloat(stats.inningsPitched || '0');
  points += innings * 3;
  points += (stats.strikeOuts || 0) * 2;
  points += (stats.wins || 0) * 10;
  points += (stats.saves || 0) * 10;
  points -= (stats.earnedRuns || 0) * 2;
  points -= (stats.hits || 0) * 0.5;
  points -= (stats.baseOnBalls || 0) * 1;
  return points;
}

async function collectStatsForGame(gameId: number, gamePk: number) {
  try {
    console.log(`📊 Collecting stats for game ${gameId} (MLB: ${gamePk})`);
    
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const statsToInsert = [];
    
    // Process all players and create mappings
    const allPlayers = [];
    
    if (response.data.teams?.home?.players) {
      allPlayers.push(...Object.values(response.data.teams.home.players));
    }
    if (response.data.teams?.away?.players) {
      allPlayers.push(...Object.values(response.data.teams.away.players));
    }
    
    console.log(`  Found ${allPlayers.length} total players`);
    
    // Process each player
    for (const player of allPlayers as any[]) {
      const mlbPlayerId = `mlb_${player.person.id}`;
      const numericPlayerId = await getNumericPlayerId(mlbPlayerId, player.person.fullName);
      
      // Batting stats
      if (player.stats?.batting && player.stats.batting.atBats > 0) {
        const batting = player.stats.batting;
        
        statsToInsert.push({
          player_id: numericPlayerId,
          game_id: gameId,
          stat_type: 'batting_avg',
          stat_value: batting.avg || '0',
          fantasy_points: calculateBattingFantasyPoints(batting)
        });
        
        if (batting.hits > 0) {
          statsToInsert.push({
            player_id: numericPlayerId,
            game_id: gameId,
            stat_type: 'hits',
            stat_value: batting.hits.toString(),
            fantasy_points: batting.hits * 3
          });
        }
        
        if (batting.homeRuns > 0) {
          statsToInsert.push({
            player_id: numericPlayerId,
            game_id: gameId,
            stat_type: 'home_runs',
            stat_value: batting.homeRuns.toString(),
            fantasy_points: batting.homeRuns * 10
          });
        }
      }
      
      // Pitching stats
      if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
        const pitching = player.stats.pitching;
        
        statsToInsert.push({
          player_id: numericPlayerId,
          game_id: gameId,
          stat_type: 'era',
          stat_value: pitching.era || '0',
          fantasy_points: calculatePitchingFantasyPoints(pitching)
        });
        
        if (pitching.strikeOuts > 0) {
          statsToInsert.push({
            player_id: numericPlayerId,
            game_id: gameId,
            stat_type: 'strikeouts_p',
            stat_value: pitching.strikeOuts.toString(),
            fantasy_points: pitching.strikeOuts * 2
          });
        }
      }
    }
    
    console.log(`  Generated ${statsToInsert.length} stats to insert`);
    
    // Insert stats in batches
    if (statsToInsert.length > 0) {
      const batchSize = 50;
      let inserted = 0;
      
      for (let i = 0; i < statsToInsert.length; i += batchSize) {
        const batch = statsToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('player_stats')
          .insert(batch);
          
        if (error) {
          console.error(`  ❌ Error inserting batch: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      }
      
      console.log(`  ✅ Successfully inserted ${inserted}/${statsToInsert.length} stats`);
      return inserted;
    }
    
    return 0;
    
  } catch (error: any) {
    console.error(`  ❌ Error collecting stats: ${error.message}`);
    return 0;
  }
}

async function collectMLBStats() {
  console.log('🏃 MLB Stats Collector with Player ID Mapping\n');
  
  // Initialize the next player ID from database
  const { data: maxPlayer } = await supabase
    .from('players')
    .select('id')
    .gte('id', MLB_PLAYER_ID_OFFSET)
    .order('id', { ascending: false })
    .limit(1);
    
  if (maxPlayer && maxPlayer.length > 0) {
    nextPlayerId = maxPlayer[0].id + 1;
    console.log(`Starting player IDs from: ${nextPlayerId}`);
  } else {
    console.log(`Starting player IDs from: ${MLB_PLAYER_ID_OFFSET}`);
  }
  
  // Get recent MLB games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(20);
    
  if (!games || games.length === 0) {
    console.log('No MLB games found');
    return;
  }
  
  console.log(`Found ${games.length} MLB games to process\n`);
  
  // Process first 5 games as a test
  let totalStatsInserted = 0;
  for (let i = 0; i < Math.min(games.length, 5); i++) {
    const game = games[i];
    const gamePk = parseInt(game.external_id.replace('mlb_', ''));
    
    const statsInserted = await collectStatsForGame(game.id, gamePk);
    totalStatsInserted += statsInserted;
    
    // Be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Collection complete!`);
  console.log(`Total stats inserted: ${totalStatsInserted}`);
  console.log(`Total players mapped: ${playerIdMap.size}`);
  
  // Verify
  const { count: mlbStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gte('player_id', MLB_PLAYER_ID_OFFSET);
    
  const { count: mlbPlayersCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
    
  console.log(`\n📊 Final counts:`);
  console.log(`MLB players in database: ${mlbPlayersCount}`);
  console.log(`MLB stats in database: ${mlbStatsCount}`);
}

// Run the collector
collectMLBStats().catch(console.error);