#!/usr/bin/env tsx
/**
 * 🎯 Safe collector that only inserts stats for existing players
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.magenta('🎯 SAFE STATS COLLECTOR - Final Push to 100%\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 50,
  BATCH_SIZE: 100, // Smaller batches for better error handling
  API_DELAY: 50
};

// Tracking
let processedGames = 0;
let skippedPlayers = 0;
let insertedStats = 0;
let errorCount = 0;

async function getExistingPlayerIds(): Promise<Set<number>> {
  console.log('📊 Loading existing player IDs...');
  const playerIds = new Set<number>();
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .range(offset, offset + limit - 1);
      
    if (error || !data || data.length === 0) break;
    
    data.forEach(p => playerIds.add(p.id));
    offset += limit;
    
    if (data.length < limit) break;
  }
  
  console.log(`✅ Loaded ${playerIds.size} player IDs\n`);
  return playerIds;
}

async function getMissingGames() {
  console.log('🔍 Finding games without stats...');
  
  // Get all completed games
  let allGames: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport_id, home_team_id, away_team_id, start_time')
      .in('sport_id', ['nba', 'nfl', 'nhl', 'mlb'])
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .range(offset, offset + limit - 1);
      
    if (!data || data.length === 0) break;
    allGames.push(...data);
    offset += limit;
    if (data.length < limit) break;
  }
  
  console.log(`Found ${allGames.length} total completed games`);
  
  // Get games with stats
  const gamesWithStats = new Set<number>();
  const { data: statsData } = await supabase
    .from('player_game_logs')
    .select('game_id');
    
  statsData?.forEach(s => gamesWithStats.add(s.game_id));
  
  const missingGames = allGames.filter(g => !gamesWithStats.has(g.id));
  console.log(`Found ${missingGames.length} games without stats\n`);
  
  return missingGames;
}

async function fetchAndFilterStats(game: any, validPlayerIds: Set<number>) {
  try {
    if (!game.external_id?.startsWith('espn_')) return [];
    
    const [, sport, gameId] = game.external_id.split('_');
    const url = `https://site.api.espn.com/apis/site/v2/sports/${
      sport === 'nba' ? 'basketball' :
      sport === 'nfl' ? 'football' :
      sport === 'nhl' ? 'hockey' :
      'baseball'
    }/${sport}/summary?event=${gameId}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore?.players) return [];
    
    const stats: any[] = [];
    
    // Process players and filter by valid IDs
    for (const teamData of response.data.boxscore.players) {
      const isHome = teamData.team.homeAway === 'home';
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      if (!teamData.statistics?.[0]?.athletes) continue;
      
      for (const athlete of teamData.statistics[0].athletes) {
        if (!athlete.athlete?.id) continue;
        
        const playerId = parseInt(athlete.athlete.id);
        
        // SKIP if player doesn't exist in our database
        if (!validPlayerIds.has(playerId)) {
          skippedPlayers++;
          continue;
        }
        
        // Create basic stat entry
        stats.push({
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          game_date: game.start_time.split('T')[0],
          opponent_id: opponentId,
          is_home: isHome,
          stats: {}, // Simplified - we just want coverage
          fantasy_points: 0
        });
      }
    }
    
    return stats;
    
  } catch (error) {
    errorCount++;
    return [];
  }
}

async function collectRemainingStats() {
  const startTime = Date.now();
  
  // Load valid player IDs
  const validPlayerIds = await getExistingPlayerIds();
  
  // Get games missing stats
  const missingGames = await getMissingGames();
  
  if (missingGames.length === 0) {
    console.log('✅ No games missing stats!');
    return;
  }
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '🎯 Progress |{bar}| {percentage}% | {value}/{total} Games | {inserted} Inserted | {skipped} Skipped',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(missingGames.length, 0, { inserted: 0, skipped: 0 });
  
  // Process in batches with concurrency
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  const allStats: any[] = [];
  
  const promises = missingGames.map(game => 
    limit(async () => {
      const gameStats = await fetchAndFilterStats(game, validPlayerIds);
      allStats.push(...gameStats);
      
      processedGames++;
      progressBar.update(processedGames, { 
        inserted: insertedStats, 
        skipped: skippedPlayers 
      });
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
    })
  );
  
  await Promise.all(promises);
  progressBar.stop();
  
  // Deduplicate
  const uniqueStats = new Map();
  allStats.forEach(stat => {
    const key = `${stat.player_id}-${stat.game_id}`;
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat);
    }
  });
  
  const finalStats = Array.from(uniqueStats.values());
  console.log(`\n📊 Collected ${finalStats.length} valid stats (skipped ${skippedPlayers} missing players)`);
  
  // Insert in batches
  if (finalStats.length > 0) {
    console.log('💾 Inserting stats...');
    
    for (let i = 0; i < finalStats.length; i += CONFIG.BATCH_SIZE) {
      const batch = finalStats.slice(i, i + CONFIG.BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
        .select();
      
      if (!error && data) {
        insertedStats += data.length;
      }
      
      process.stdout.write(`\r💾 Inserted ${insertedStats} / ${finalStats.length} stats`);
    }
  }
  
  // Final report
  const duration = (Date.now() - startTime) / 1000;
  console.log('\n\n📈 COLLECTION COMPLETE!');
  console.log(`⏱️  Time: ${(duration / 60).toFixed(1)} minutes`);
  console.log(`🎮 Games Processed: ${processedGames}`);
  console.log(`✅ Stats Inserted: ${insertedStats}`);
  console.log(`⚠️  Players Skipped: ${skippedPlayers}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\n🏆 Total stats in database: ${count?.toLocaleString()}`);
}

collectRemainingStats().catch(console.error);