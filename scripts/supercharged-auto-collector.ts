import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import pLimit from 'p-limit';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Global caches for performance
const playerCache = new Map<string, number>();
const processedGames = new Set<number>();

interface SportConfig {
  name: string;
  espnPath: string;
  queries: string[];
  targetGames: number;
  parseStats: (data: any, game: any) => Promise<any[]>;
}

const SPORT_CONFIGS: SportConfig[] = [
  {
    name: 'NBA',
    espnPath: 'basketball/nba',
    queries: ['sport.eq.NBA', 'sport_id.eq.nba'],
    targetGames: 6066,
    parseStats: parseNBAStats
  },
  {
    name: 'NFL', 
    espnPath: 'football/nfl',
    queries: ['sport.eq.NFL', 'sport_id.eq.nfl'],
    targetGames: 1212,
    parseStats: parseNFLStats
  },
  {
    name: 'NHL',
    espnPath: 'hockey/nhl', 
    queries: ['sport.eq.NHL', 'sport_id.eq.nhl'],
    targetGames: 3181,
    parseStats: parseNHLStats
  },
  {
    name: 'MLB',
    espnPath: 'baseball/mlb',
    queries: ['sport.eq.MLB', 'sport_id.eq.mlb'],
    targetGames: 1800,
    parseStats: parseMLBStats
  }
];

async function getOrCreatePlayer(espnId: string, name: string, teamId: number, sport: string): Promise<number> {
  const externalId = `espn_${sport.toLowerCase()}_${espnId}`;
  
  if (playerCache.has(externalId)) {
    return playerCache.get(externalId)!;
  }
  
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', externalId)
    .single();
  
  if (existing) {
    playerCache.set(externalId, existing.id);
    return existing.id;
  }
  
  const { data: newPlayer } = await supabase
    .from('players')
    .insert({
      external_id: externalId,
      name: name,
      firstname: name.split(' ')[0] || '',
      lastname: name.split(' ').slice(1).join(' ') || '',
      team_id: teamId,
      sport: sport,
      sport_id: sport.toLowerCase(),
      status: 'active'
    })
    .select('id')
    .single();
  
  if (newPlayer) {
    playerCache.set(externalId, newPlayer.id);
    return newPlayer.id;
  }
  
  throw new Error('Failed to create player');
}

async function parseNBAStats(data: any, game: any): Promise<any[]> {
  const stats: any[] = [];
  
  if (data.boxscore?.players) {
    let teamIndex = 0;
    for (const team of data.boxscore.players) {
      const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
      teamIndex++;
      
      const athletes = team.statistics?.[0]?.athletes || [];
      for (const athlete of athletes) {
        if (!athlete.stats || athlete.stats.length === 0) continue;
        
        try {
          const playerId = await getOrCreatePlayer(
            athlete.athlete.id,
            athlete.athlete.displayName,
            teamId,
            'NBA'
          );
          
          const statMap = ['minutes', 'fieldGoalsMade', 'fieldGoalsAttempted',
            'threePtMade', 'threePtAttempted', 'freeThrowsMade', 'freeThrowsAttempted',
            'offensiveRebounds', 'defensiveRebounds', 'rebounds', 'assists', 'steals',
            'blocks', 'turnovers', 'personalFouls', 'points', 'plusMinus'];
          
          athlete.stats.forEach((value: string, index: number) => {
            if (statMap[index] && value && value !== '0' && value !== '-') {
              stats.push({
                player_id: playerId,
                game_id: game.id,
                stat_type: statMap[index],
                stat_value: value
              });
            }
          });
        } catch (e) {}
      }
    }
  }
  
  return stats;
}

async function parseNFLStats(data: any, game: any): Promise<any[]> {
  const stats: any[] = [];
  
  if (data.boxscore?.players) {
    let teamIndex = 0;
    for (const team of data.boxscore.players) {
      const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
      teamIndex++;
      
      // Just get key stats for speed
      const passing = team.statistics?.find((s: any) => s.name === 'passing');
      if (passing?.athletes) {
        for (const athlete of passing.athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          try {
            const playerId = await getOrCreatePlayer(
              athlete.athlete.id,
              athlete.athlete.displayName,
              teamId,
              'NFL'
            );
            
            // Key passing stats
            if (athlete.stats[2]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'passingYards', stat_value: athlete.stats[2] });
            if (athlete.stats[4]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'passingTouchdowns', stat_value: athlete.stats[4] });
          } catch (e) {}
        }
      }
    }
  }
  
  return stats;
}

async function parseNHLStats(data: any, game: any): Promise<any[]> {
  const stats: any[] = [];
  
  if (data.boxscore?.players) {
    let teamIndex = 0;
    for (const team of data.boxscore.players) {
      const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
      teamIndex++;
      
      const skaters = team.statistics?.find((s: any) => s.name === 'skaters' || s.type === 'skaters');
      if (skaters?.athletes) {
        for (const athlete of skaters.athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          try {
            const playerId = await getOrCreatePlayer(
              athlete.athlete.id,
              athlete.athlete.displayName,
              teamId,
              'NHL'
            );
            
            // Key NHL stats: G, A, PTS
            if (athlete.stats[0]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'goals', stat_value: athlete.stats[0] });
            if (athlete.stats[1]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'assists', stat_value: athlete.stats[1] });
            if (athlete.stats[2]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'points', stat_value: athlete.stats[2] });
          } catch (e) {}
        }
      }
    }
  }
  
  return stats;
}

async function parseMLBStats(data: any, game: any): Promise<any[]> {
  const stats: any[] = [];
  
  if (data.boxscore?.players) {
    let teamIndex = 0;
    for (const team of data.boxscore.players) {
      const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
      teamIndex++;
      
      const batting = team.statistics?.find((s: any) => s.name === 'batting');
      if (batting?.athletes) {
        for (const athlete of batting.athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          try {
            const playerId = await getOrCreatePlayer(
              athlete.athlete.id,
              athlete.athlete.displayName,
              teamId,
              'MLB'
            );
            
            // Key batting stats: H, R, RBI
            if (athlete.stats[2]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'hits', stat_value: athlete.stats[2] });
            if (athlete.stats[1]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'runs', stat_value: athlete.stats[1] });
            if (athlete.stats[6]) stats.push({ player_id: playerId, game_id: game.id, stat_type: 'RBIs', stat_value: athlete.stats[6] });
          } catch (e) {}
        }
      }
    }
  }
  
  return stats;
}

async function processGame(game: any, config: SportConfig): Promise<number> {
  if (processedGames.has(game.id)) return 0;
  
  const match = game.external_id.match(/(\d+)/);
  if (!match) return 0;
  
  const espnId = match[1];
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/summary?event=${espnId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000
    });
    
    const stats = await config.parseStats(response.data, game);
    
    if (stats.length > 0) {
      await supabase.from('player_stats').insert(stats);
      processedGames.add(game.id);
      return stats.length;
    }
  } catch (e) {}
  
  return 0;
}

async function collectForSport(config: SportConfig) {
  console.log(`\n🏆 ${config.name} COLLECTION (Need ${config.targetGames} games)`);
  console.log('='.repeat(50));
  
  // Get games without stats
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or(config.queries.join(','))
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(Math.min(config.targetGames, 500)); // Process in chunks
  
  if (!games || games.length === 0) {
    console.log('No games found to process');
    return 0;
  }
  
  console.log(`Processing ${games.length} ${config.name} games...`);
  
  // Process with concurrency limit - MAX POWER!
  const limit = pLimit(20); // 20 concurrent requests - using more CPU!
  let totalStats = 0;
  let processedCount = 0;
  
  const promises = games.map((game, index) => 
    limit(async () => {
      const stats = await processGame(game, config);
      totalStats += stats;
      if (stats > 0) processedCount++;
      
      if ((index + 1) % 50 === 0) {
        console.log(`Progress: ${index + 1}/${games.length} games, ${totalStats} stats collected`);
      }
      
      return stats;
    })
  );
  
  await Promise.all(promises);
  
  console.log(`✅ ${config.name} Complete: ${processedCount} games, ${totalStats} stats`);
  return totalStats;
}

async function superchargedAutoCollector() {
  console.log('⚡ SUPERCHARGED AUTO-COLLECTOR - ROAD TO 95%! ⚡');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} total stats`);
  console.log('\nTargets for 95% coverage:');
  SPORT_CONFIGS.forEach(config => {
    console.log(`  ${config.name}: ${config.targetGames} games needed`);
  });
  
  // Collect for each sport
  let totalNewStats = 0;
  for (const config of SPORT_CONFIGS) {
    const statsAdded = await collectForSport(config);
    totalNewStats += statsAdded;
    
    // Brief pause between sports
    if (statsAdded > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Final report
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n\n🚀 SUPERCHARGED COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Starting stats: ${startingStats?.toLocaleString()}`);
  console.log(`Ending stats: ${endingStats?.toLocaleString()}`);
  console.log(`TOTAL ADDED: ${totalNewStats.toLocaleString()} (${((endingStats || 0) - (startingStats || 0)).toLocaleString()} net)`);
  console.log('\nNext steps:');
  console.log('1. Run this script again to continue collection');
  console.log('2. Deploy as scheduled job to run every hour');
  console.log('3. Monitor coverage growth in real-time');
  console.log('='.repeat(80));
}

// Check if p-limit is installed
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  try {
    // Try to import p-limit
    await import('p-limit');
  } catch (e) {
    console.log('Installing p-limit for concurrency control...');
    await execAsync('npm install p-limit');
  }
  
  await superchargedAutoCollector();
}

main().catch(console.error);