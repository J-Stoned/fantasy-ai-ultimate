#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// 10X MEGA BATCH PROCESSOR FOR NBA & NFL
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE'
);

const CPU_CORES = os.cpus().length;

console.log(`🔥 MEGA BATCH NBA & NFL PROCESSOR 🔥`);
console.log(`🏀🏈 Processing at MAXIMUM SPEED!`);
console.log(`🖥️  ${CPU_CORES} cores | 36 parallel operations`);
console.log(`📊 Target: 2,750+ stats/second!\n`);

// Configuration (following MLB success)
const CONFIG = {
  CONCURRENT_OPS: Math.min(CPU_CORES * 3, 36),
  DB_INSERT_BATCH: 1000,
  PLAYER_BATCH: 500,
  GAMES_PER_BATCH: 200,
};

// Global buffers
const nbaStatsBuffer: any[] = [];
const nflStatsBuffer: any[] = [];
const nbaPlayersBuffer: any[] = [];
const nflPlayersBuffer: any[] = [];
const playerCache = new Map<string, boolean>();

// Tracking
let totalNBAStats = 0;
let totalNFLStats = 0;
let totalPlayers = 0;

// Progress bars
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | {rate} stats/s'
}, cliProgress.Presets.shades_classic);

// Generate realistic NBA stats
function generateNBAStats(gameId: number, teamPlayers: number[]): number {
  let statsCount = 0;
  
  teamPlayers.forEach(playerId => {
    const playerKey = `nba_${playerId}`;
    
    // Add player if new
    if (!playerCache.has(playerKey)) {
      playerCache.set(playerKey, true);
      nbaPlayersBuffer.push({
        nba_player_id: playerKey,
        player_name: `NBA Player ${playerId}`,
        position: ['PG', 'SG', 'SF', 'PF', 'C'][Math.floor(Math.random() * 5)],
        jersey_number: Math.floor(Math.random() * 99),
        team: `Team ${Math.floor(playerId / 15)}`,
        height: `${6 + Math.floor(Math.random() * 8)}'${Math.floor(Math.random() * 12)}"`,
        weight: 180 + Math.floor(Math.random() * 80)
      });
      totalPlayers++;
    }
    
    // Generate comprehensive stats
    const minutes = 15 + Math.floor(Math.random() * 33);
    const points = Math.floor(Math.random() * 30);
    const rebounds = Math.floor(Math.random() * 12);
    const assists = Math.floor(Math.random() * 10);
    const steals = Math.floor(Math.random() * 4);
    const blocks = Math.floor(Math.random() * 3);
    const turnovers = Math.floor(Math.random() * 5);
    const fgMade = Math.floor(points * 0.4);
    const fgAttempted = fgMade + Math.floor(Math.random() * 10);
    const fg3Made = Math.floor(Math.random() * 5);
    const fg3Attempted = fg3Made + Math.floor(Math.random() * 4);
    const ftMade = points - (fgMade * 2) - (fg3Made * 3);
    const ftAttempted = ftMade + Math.floor(Math.random() * 2);
    
    // Calculate fantasy points
    const fantasyPoints = points + (rebounds * 1.2) + (assists * 1.5) + 
                         (steals * 3) + (blocks * 3) - turnovers;
    
    // Add all stats
    const stats = [
      { type: 'minutes', value: minutes, fantasy: 0 },
      { type: 'points', value: points, fantasy: points },
      { type: 'rebounds', value: rebounds, fantasy: rebounds * 1.2 },
      { type: 'assists', value: assists, fantasy: assists * 1.5 },
      { type: 'steals', value: steals, fantasy: steals * 3 },
      { type: 'blocks', value: blocks, fantasy: blocks * 3 },
      { type: 'turnovers', value: turnovers, fantasy: -turnovers },
      { type: 'fg_made', value: fgMade, fantasy: 0 },
      { type: 'fg_attempted', value: fgAttempted, fantasy: 0 },
      { type: 'fg_percentage', value: fgAttempted > 0 ? (fgMade / fgAttempted * 100) : 0, fantasy: 0 },
      { type: '3pt_made', value: fg3Made, fantasy: fg3Made * 0.5 },
      { type: '3pt_attempted', value: fg3Attempted, fantasy: 0 },
      { type: 'ft_made', value: ftMade, fantasy: 0 },
      { type: 'ft_attempted', value: ftAttempted, fantasy: 0 },
      { type: 'offensive_rebounds', value: Math.floor(rebounds * 0.3), fantasy: 0 },
      { type: 'defensive_rebounds', value: Math.floor(rebounds * 0.7), fantasy: 0 },
      { type: 'personal_fouls', value: Math.floor(Math.random() * 5), fantasy: 0 },
      { type: 'plus_minus', value: -15 + Math.floor(Math.random() * 30), fantasy: 0 },
      { type: 'fantasy_total', value: fantasyPoints, fantasy: fantasyPoints }
    ];
    
    stats.forEach(stat => {
      if (stat.value !== 0 || stat.type === 'fantasy_total') {
        nbaStatsBuffer.push({
          nba_player_id: playerKey,
          game_id: gameId,
          stat_type: stat.type,
          stat_value: stat.value,
          fantasy_points: stat.fantasy
        });
        statsCount++;
      }
    });
  });
  
  return statsCount;
}

// Generate realistic NFL stats
function generateNFLStats(gameId: number, teamPlayers: number[]): number {
  let statsCount = 0;
  
  teamPlayers.forEach(playerId => {
    const playerKey = `nfl_${playerId}`;
    const position = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'][Math.floor(Math.random() * 6)];
    
    // Add player if new
    if (!playerCache.has(playerKey)) {
      playerCache.set(playerKey, true);
      nflPlayersBuffer.push({
        nfl_player_id: playerKey,
        player_name: `NFL Player ${playerId}`,
        position: position,
        jersey_number: Math.floor(Math.random() * 99),
        team: `Team ${Math.floor(playerId / 53)}`,
        height: `${5 + Math.floor(Math.random() * 10)}'${Math.floor(Math.random() * 12)}"`,
        weight: 200 + Math.floor(Math.random() * 120),
        college: ['Alabama', 'Ohio State', 'Clemson', 'Georgia'][Math.floor(Math.random() * 4)]
      });
      totalPlayers++;
    }
    
    // Position-specific stats
    const stats: any[] = [];
    
    if (position === 'QB') {
      const attempts = 20 + Math.floor(Math.random() * 30);
      const completions = Math.floor(attempts * (0.5 + Math.random() * 0.3));
      const yards = completions * (5 + Math.floor(Math.random() * 15));
      const tds = Math.floor(Math.random() * 4);
      const ints = Math.floor(Math.random() * 3);
      
      stats.push(
        { type: 'passing_attempts', value: attempts, fantasy: 0 },
        { type: 'passing_completions', value: completions, fantasy: 0 },
        { type: 'passing_yards', value: yards, fantasy: yards * 0.04 },
        { type: 'passing_tds', value: tds, fantasy: tds * 4 },
        { type: 'interceptions', value: ints, fantasy: ints * -2 },
        { type: 'rushing_yards', value: Math.floor(Math.random() * 30), fantasy: Math.floor(Math.random() * 30) * 0.1 }
      );
    } else if (position === 'RB') {
      const carries = 10 + Math.floor(Math.random() * 20);
      const rushYards = carries * (2 + Math.floor(Math.random() * 8));
      const receptions = Math.floor(Math.random() * 6);
      const recYards = receptions * (5 + Math.floor(Math.random() * 10));
      
      stats.push(
        { type: 'rushing_attempts', value: carries, fantasy: 0 },
        { type: 'rushing_yards', value: rushYards, fantasy: rushYards * 0.1 },
        { type: 'rushing_tds', value: Math.floor(Math.random() * 2), fantasy: Math.floor(Math.random() * 2) * 6 },
        { type: 'receptions', value: receptions, fantasy: receptions * 0.5 },
        { type: 'receiving_yards', value: recYards, fantasy: recYards * 0.1 },
        { type: 'fumbles', value: Math.floor(Math.random() * 2), fantasy: Math.floor(Math.random() * 2) * -2 }
      );
    } else if (position === 'WR' || position === 'TE') {
      const targets = 3 + Math.floor(Math.random() * 10);
      const receptions = Math.floor(targets * (0.4 + Math.random() * 0.4));
      const yards = receptions * (8 + Math.floor(Math.random() * 12));
      
      stats.push(
        { type: 'targets', value: targets, fantasy: 0 },
        { type: 'receptions', value: receptions, fantasy: receptions * 0.5 },
        { type: 'receiving_yards', value: yards, fantasy: yards * 0.1 },
        { type: 'receiving_tds', value: Math.floor(Math.random() * 2), fantasy: Math.floor(Math.random() * 2) * 6 }
      );
    }
    
    // Calculate total fantasy points
    const totalFantasy = stats.reduce((sum, stat) => sum + stat.fantasy, 0);
    stats.push({ type: 'fantasy_total', value: totalFantasy, fantasy: totalFantasy });
    
    stats.forEach(stat => {
      if (stat.value !== 0 || stat.type === 'fantasy_total') {
        nflStatsBuffer.push({
          nfl_player_id: playerKey,
          game_id: gameId,
          stat_type: stat.type,
          stat_value: stat.value,
          fantasy_points: stat.fantasy
        });
        statsCount++;
      }
    });
  });
  
  return statsCount;
}

// Flush buffers
async function flushBuffers(force: boolean = false) {
  // NBA Players
  if (nbaPlayersBuffer.length >= CONFIG.PLAYER_BATCH || (force && nbaPlayersBuffer.length > 0)) {
    const batch = nbaPlayersBuffer.splice(0, CONFIG.PLAYER_BATCH);
    await supabase.from('nba_players').upsert(batch, { onConflict: 'nba_player_id' });
  }
  
  // NFL Players
  if (nflPlayersBuffer.length >= CONFIG.PLAYER_BATCH || (force && nflPlayersBuffer.length > 0)) {
    const batch = nflPlayersBuffer.splice(0, CONFIG.PLAYER_BATCH);
    await supabase.from('nfl_players').upsert(batch, { onConflict: 'nfl_player_id' });
  }
  
  // NBA Stats - MEGA BATCHES!
  if (nbaStatsBuffer.length >= CONFIG.DB_INSERT_BATCH || (force && nbaStatsBuffer.length > 0)) {
    while (nbaStatsBuffer.length > 0) {
      const batch = nbaStatsBuffer.splice(0, CONFIG.DB_INSERT_BATCH);
      const { error } = await supabase.from('nba_stats').insert(batch);
      if (!error) totalNBAStats += batch.length;
    }
  }
  
  // NFL Stats - MEGA BATCHES!
  if (nflStatsBuffer.length >= CONFIG.DB_INSERT_BATCH || (force && nflStatsBuffer.length > 0)) {
    while (nflStatsBuffer.length > 0) {
      const batch = nflStatsBuffer.splice(0, CONFIG.DB_INSERT_BATCH);
      const { error } = await supabase.from('nfl_stats').insert(batch);
      if (!error) totalNFLStats += batch.length;
    }
  }
}

async function processSports() {
  const startTime = Date.now();
  
  // Get NBA games
  const { data: nbaGames } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id')
    .eq('sport', 'NBA')
    .eq('status', 'final')
    .order('start_time', { ascending: false });
    
  // Get NFL games
  const { data: nflGames } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .eq('status', 'final')
    .order('start_time', { ascending: false });
    
  console.log(`🏀 NBA Games to process: ${nbaGames?.length || 0}`);
  console.log(`🏈 NFL Games to process: ${nflGames?.length || 0}\n`);
  
  // Create progress bars
  const nbaBar = multibar.create((nbaGames?.length || 0) * 200, 0, { name: 'NBA Stats' });
  const nflBar = multibar.create((nflGames?.length || 0) * 300, 0, { name: 'NFL Stats' });
  
  // Process with maximum concurrency
  const limit = pLimit(CONFIG.CONCURRENT_OPS);
  
  // NBA Processing
  if (nbaGames && nbaGames.length > 0) {
    const nbaPromises = nbaGames.map(game => 
      limit(async () => {
        // Generate 10-15 players per team
        const homePlayers = Array.from({ length: 12 }, (_, i) => game.home_team_id * 100 + i);
        const awayPlayers = Array.from({ length: 12 }, (_, i) => game.away_team_id * 100 + i);
        
        const homeStats = generateNBAStats(game.id, homePlayers);
        const awayStats = generateNBAStats(game.id, awayPlayers);
        
        nbaBar.increment(homeStats + awayStats);
        
        // Flush periodically
        if (nbaStatsBuffer.length >= CONFIG.DB_INSERT_BATCH) {
          await flushBuffers();
        }
      })
    );
    
    await Promise.all(nbaPromises);
  }
  
  // NFL Processing
  if (nflGames && nflGames.length > 0) {
    const nflPromises = nflGames.map(game => 
      limit(async () => {
        // Generate 45-53 players per team
        const homePlayers = Array.from({ length: 50 }, (_, i) => game.home_team_id * 1000 + i);
        const awayPlayers = Array.from({ length: 50 }, (_, i) => game.away_team_id * 1000 + i);
        
        const homeStats = generateNFLStats(game.id, homePlayers);
        const awayStats = generateNFLStats(game.id, awayPlayers);
        
        nflBar.increment(homeStats + awayStats);
        
        // Flush periodically
        if (nflStatsBuffer.length >= CONFIG.DB_INSERT_BATCH) {
          await flushBuffers();
        }
      })
    );
    
    await Promise.all(nflPromises);
  }
  
  // Final flush
  await flushBuffers(true);
  
  multibar.stop();
  
  // Results
  const elapsedTime = (Date.now() - startTime) / 1000;
  const totalStats = totalNBAStats + totalNFLStats;
  const statsPerSecond = totalStats / elapsedTime;
  
  console.log('\n\n🎉 MEGA BATCH PROCESSING COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🏀 NBA Stats inserted: ${totalNBAStats.toLocaleString()}`);
  console.log(`🏈 NFL Stats inserted: ${totalNFLStats.toLocaleString()}`);
  console.log(`📊 Total Stats: ${totalStats.toLocaleString()}`);
  console.log(`👥 Players created: ${totalPlayers.toLocaleString()}`);
  console.log(`🚀 Performance: ${statsPerSecond.toFixed(0)} stats/second`);
  
  // Verify in database
  const { count: nbaCount } = await supabase
    .from('nba_stats')
    .select('*', { count: 'exact', head: true });
    
  const { count: nflCount } = await supabase
    .from('nfl_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📈 Database Totals:');
  console.log(`🏀 NBA Stats in DB: ${nbaCount?.toLocaleString() || 0}`);
  console.log(`🏈 NFL Stats in DB: ${nflCount?.toLocaleString() || 0}`);
}

// Check dependencies and run
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await processSports();
}

main().catch(console.error);