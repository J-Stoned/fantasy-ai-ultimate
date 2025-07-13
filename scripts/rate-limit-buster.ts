import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CPU_CORES = os.cpus().length;
const CONCURRENT_REQUESTS = CPU_CORES; // Lower concurrency to avoid detection

console.log(`🚀 RATE LIMIT BUSTER - SMART COLLECTION!`);

const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

// User agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Add delay between requests
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff for retries
async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Add random delay to avoid patterns (100-500ms)
      await delay(100 + Math.random() * 400);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 10000
      });
      
      return response;
    } catch (error: any) {
      lastError = error;
      
      if (error.response?.status === 429) {
        // Rate limited - wait exponentially longer
        const waitTime = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.log(`⏳ Rate limited, waiting ${(waitTime/1000).toFixed(1)}s...`);
        await delay(waitTime);
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        // Connection issues - retry with delay
        await delay(500 + Math.random() * 500);
      } else {
        // Other error - fail fast
        throw error;
      }
    }
  }
  
  throw lastError;
}

function extractEspnId(externalId: string): string | null {
  const patterns = [/espn_mlb_(\d+)$/, /mlb_(\d+)$/, /^(\d+)$/];
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getOrCreatePlayer(espnId: string, name: string, teamId: number): Promise<number> {
  const standardizedId = `espn_mlb_${espnId}`;
  
  if (playerCache.has(standardizedId)) {
    return playerCache.get(standardizedId)!;
  }
  
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', standardizedId)
    .single();
  
  if (existing) {
    playerCache.set(standardizedId, existing.id);
    return existing.id;
  }
  
  const { data: newPlayer } = await supabase
    .from('players')
    .insert({
      external_id: standardizedId,
      name: name,
      firstname: name.split(' ')[0],
      lastname: name.split(' ').slice(1).join(' '),
      team_id: teamId,
      sport: 'MLB',
      sport_id: 'mlb',
      status: 'active'
    })
    .select('id')
    .single();
  
  if (newPlayer) {
    playerCache.set(standardizedId, newPlayer.id);
    return newPlayer.id;
  }
  
  throw new Error('Failed to create player');
}

async function scrapeMLBGame(game: any): Promise<number> {
  const espnId = extractEspnId(game.external_id);
  if (!espnId) return 0;
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`;
    const response = await fetchWithRetry(url);
    
    const stats: any[] = [];
    
    if (response.data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of response.data.boxscore.players) {
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        // Process batting stats
        const batting = team.statistics?.find((s: any) => s.type === 'batting');
        if (batting?.athletes) {
          for (const athlete of batting.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              const mappings = [
                { index: 1, type: 'atBats' },
                { index: 2, type: 'runs' },
                { index: 3, type: 'hits' },
                { index: 4, type: 'RBIs' },
                { index: 5, type: 'homeRuns' },
                { index: 6, type: 'walks' },
                { index: 7, type: 'strikeouts' }
              ];
              
              mappings.forEach(({ index, type }) => {
                if (athlete.stats[index] && athlete.stats[index] !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: type,
                    stat_value: athlete.stats[index]
                  });
                }
              });
            } catch (e) {
              // Skip player
            }
          }
        }
        
        // Process pitching stats
        const pitching = team.statistics?.find((s: any) => s.type === 'pitching');
        if (pitching?.athletes) {
          for (const athlete of pitching.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              const pitchMappings = [
                { index: 0, type: 'inningsPitched' },
                { index: 3, type: 'earnedRuns' },
                { index: 6, type: 'strikeoutsPitching' }
              ];
              
              pitchMappings.forEach(({ index, type }) => {
                if (athlete.stats[index] && athlete.stats[index] !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: type,
                    stat_value: athlete.stats[index]
                  });
                }
              });
            } catch (e) {
              // Skip player
            }
          }
        }
      }
    }
    
    if (stats.length > 0) {
      await supabase.from('player_stats').insert(stats);
      return stats.length;
    }
    
    return 0;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log(`🚫 Rate limited on game ${game.id}`);
    }
    return 0;
  }
}

async function rateLimitBuster() {
  console.log('\n🚀 RATE LIMIT BUSTER - SMART + STEALTH!');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} stats`);
  console.log(`CPU Cores: ${CPU_CORES}`);
  console.log(`Concurrent: ${CONCURRENT_REQUESTS} (reduced for stealth)\n`);
  
  // Get games that need stats
  console.log('📊 Finding games without stats...');
  const gamesNeedingStats: any[] = [];
  
  // Get all MLB games in smaller chunks
  let offset = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id')
      .or('sport.eq.MLB,sport_id.eq.mlb')
      .not('external_id', 'is', null)
      .not('home_score', 'is', null)
      .gte('start_time', '2024-01-01')
      .order('start_time', { ascending: false })
      .range(offset, offset + chunkSize - 1);
    
    if (!games || games.length === 0) break;
    
    // Check which need stats
    const gameIds = games.map(g => g.id);
    const { data: gamesWithStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', gameIds);
    
    const hasStatsSet = new Set(gamesWithStats?.map(s => s.game_id) || []);
    
    for (const game of games) {
      if (!hasStatsSet.has(game.id)) {
        gamesNeedingStats.push(game);
      }
    }
    
    console.log(`Scanned ${offset + games.length} games, found ${gamesNeedingStats.length} needing stats...`);
    
    if (games.length < chunkSize) break;
    offset += chunkSize;
  }
  
  if (gamesNeedingStats.length === 0) {
    console.log('🎉 All games already have stats!');
    return;
  }
  
  console.log(`\n📊 Found ${gamesNeedingStats.length} games needing stats`);
  console.log('🥷 Starting stealthy collection...\n');
  
  let totalStats = 0;
  let processedGames = 0;
  let rateLimitCount = 0;
  const startTime = Date.now();
  
  // Process in smaller batches with delays
  const batchSize = 50;
  for (let i = 0; i < gamesNeedingStats.length; i += batchSize) {
    const batch = gamesNeedingStats.slice(i, i + batchSize);
    
    const promises = batch.map((game) =>
      limit(async () => {
        const stats = await scrapeMLBGame(game);
        if (stats > 0) {
          totalStats += stats;
          processedGames++;
        } else if (stats === -1) {
          rateLimitCount++;
        }
        return stats;
      })
    );
    
    await Promise.all(promises);
    
    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const gamesPerSecond = (processedGames / elapsed).toFixed(1);
    const eta = ((gamesNeedingStats.length - (i + batch.length)) / parseFloat(gamesPerSecond) / 60).toFixed(1);
    
    console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${processedGames} games | ${totalStats} stats | ${gamesPerSecond} g/s | ETA: ${eta}m | RL: ${rateLimitCount}`);
    
    // Batch delay to avoid detection
    if (i + batchSize < gamesNeedingStats.length) {
      await delay(1000 + Math.random() * 2000); // 1-3 second delay between batches
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n⚾ COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}/${gamesNeedingStats.length}`);
  console.log(`Success rate: ${(processedGames / gamesNeedingStats.length * 100).toFixed(1)}%`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Rate limits hit: ${rateLimitCount}`);
  console.log(`Time: ${totalTime} seconds`);
  console.log(`Speed: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`NET GAIN: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
}

rateLimitBuster().catch(console.error);