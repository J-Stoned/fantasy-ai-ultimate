#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 20000
});

console.log(`⚾ COLLECTING REAL MLB DATA FOR UNPROCESSED GAMES`);
console.log(`📊 This time we'll get ACTUAL stats!\n`);

const CONFIG = {
  CONCURRENT_API_CALLS: 6,
  DB_INSERT_BATCH: 500,
  GAMES_TO_PROCESS: 50, // Process 50 games as demo
  API_DELAY_MS: 250,
};

// Tracking
let gamesProcessed = 0;
let statsInserted = 0;
let playersAdded = 0;
let errors = 0;

const progressBar = new cliProgress.SingleBar({
  format: '⚾ Progress |{bar}| {percentage}% | {value}/{total} Games | {stats} Stats',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

async function processGame(gameId: number, gamePk: number): Promise<number> {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const boxscore = response.data;
    
    if (!boxscore.teams) return 0;
    
    const playersData: any[] = [];
    const statsData: any[] = [];
    
    // Process both teams
    ['home', 'away'].forEach(teamType => {
      const team = boxscore.teams[teamType];
      if (!team?.players) return;
      
      const teamName = team.team?.name || teamType;
      
      Object.values(team.players).forEach((player: any) => {
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Player data
        playersData.push({
          mlb_player_id: mlbPlayerId,
          player_name: player.person.fullName,
          position: player.position?.abbreviation,
          jersey_number: parseInt(player.jerseyNumber) || null,
          current_team: teamName,
          bat_side: player.batSide?.code,
          pitch_hand: player.pitchHand?.code
        });
        
        // Batting stats - only if player batted
        if (player.stats?.batting && player.stats.batting.atBats >= 0) {
          const b = player.stats.batting;
          
          // Always include at bats
          statsData.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'at_bats',
            stat_value: b.atBats || 0,
            fantasy_points: 0
          });
          
          // Other batting stats
          if (b.hits > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'hits', stat_value: b.hits, fantasy_points: b.hits * 3 });
          if (b.doubles > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'doubles', stat_value: b.doubles, fantasy_points: b.doubles * 2 });
          if (b.triples > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'triples', stat_value: b.triples, fantasy_points: b.triples * 3 });
          if (b.homeRuns > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'home_runs', stat_value: b.homeRuns, fantasy_points: b.homeRuns * 10 });
          if (b.rbi > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'rbi', stat_value: b.rbi, fantasy_points: b.rbi * 2 });
          if (b.runs > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'runs', stat_value: b.runs, fantasy_points: b.runs * 2 });
          if (b.baseOnBalls > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'walks', stat_value: b.baseOnBalls, fantasy_points: b.baseOnBalls });
          if (b.strikeOuts > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'strikeouts', stat_value: b.strikeOuts, fantasy_points: -b.strikeOuts });
          if (b.stolenBases > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'stolen_bases', stat_value: b.stolenBases, fantasy_points: b.stolenBases * 5 });
        }
        
        // Pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const p = player.stats.pitching;
          const ip = parseFloat(p.inningsPitched || '0');
          
          statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'innings_pitched', stat_value: ip, fantasy_points: ip * 3 });
          if (p.strikeOuts > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'strikeouts_p', stat_value: p.strikeOuts, fantasy_points: p.strikeOuts * 2 });
          if (p.earnedRuns > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'earned_runs', stat_value: p.earnedRuns, fantasy_points: -p.earnedRuns * 2 });
          if (p.hits > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'hits_allowed', stat_value: p.hits, fantasy_points: -p.hits * 0.5 });
          if (p.baseOnBalls > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'walks_allowed', stat_value: p.baseOnBalls, fantasy_points: -p.baseOnBalls });
          if (p.wins > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'wins', stat_value: 1, fantasy_points: 10 });
          if (p.saves > 0) statsData.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'saves', stat_value: 1, fantasy_points: 10 });
        }
      });
    });
    
    // Insert players
    if (playersData.length > 0) {
      const { error } = await supabase
        .from('mlb_players')
        .upsert(playersData, { onConflict: 'mlb_player_id' });
        
      if (!error) playersAdded += playersData.length;
    }
    
    // Insert stats
    let inserted = 0;
    if (statsData.length > 0) {
      // Insert in batches
      for (let i = 0; i < statsData.length; i += CONFIG.DB_INSERT_BATCH) {
        const batch = statsData.slice(i, i + CONFIG.DB_INSERT_BATCH);
        
        const { data, error } = await supabase
          .from('mlb_stats')
          .insert(batch)
          .select();
          
        if (data) {
          inserted += data.length;
          statsInserted += data.length;
        } else if (error) {
          console.error(`\nError inserting batch:`, error.message);
        }
      }
    }
    
    return inserted;
    
  } catch (error: any) {
    errors++;
    return 0;
  }
}

async function collectUnprocessedGames() {
  const startTime = Date.now();
  
  // Get unprocessed games
  const { data: withStats } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const processedIds = new Set(withStats?.map(s => s.game_id) || []);
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false });
    
  const unprocessed = allGames?.filter(g => !processedIds.has(g.id)) || [];
  
  console.log(`📊 Found ${unprocessed.length} unprocessed games`);
  console.log(`🎯 Will process ${Math.min(CONFIG.GAMES_TO_PROCESS, unprocessed.length)} games\n`);
  
  const gamesToProcess = unprocessed.slice(0, CONFIG.GAMES_TO_PROCESS);
  
  progressBar.start(gamesToProcess.length, 0, { stats: 0 });
  
  // Process with limited concurrency
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      const gamePk = parseInt(game.external_id.replace('mlb_', ''));
      const stats = await processGame(game.id, gamePk);
      
      if (stats > 0) {
        gamesProcessed++;
      }
      
      progressBar.update(gamesProcessed, { stats: statsInserted });
      
      // Rate limit
      await new Promise(r => setTimeout(r, CONFIG.API_DELAY_MS));
    })
  );
  
  await Promise.all(promises);
  
  progressBar.stop();
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ REAL DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${gamesProcessed}`);
  console.log(`📊 Stats inserted: ${statsInserted}`);
  console.log(`👥 Players: ${playersAdded}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`⚡ Rate: ${(statsInserted / elapsedTime).toFixed(0)} stats/second`);
  
  // Verify
  const { count } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\n📈 Total MLB stats in database: ${count?.toLocaleString()}`);
  
  if (count && count > 114139) {
    console.log('🎉 NEW REAL DATA ADDED SUCCESSFULLY!');
    const newStats = count - 114139;
    console.log(`📊 Added ${newStats.toLocaleString()} new stats!`);
  }
}

// Run
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectUnprocessedGames();
}

main().catch(console.error);