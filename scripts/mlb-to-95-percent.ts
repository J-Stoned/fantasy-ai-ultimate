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
const CONCURRENT_REQUESTS = 24; // Balanced for rate limits

console.log(`⚾ MLB TO 95% COVERAGE - FINAL PUSH!`);

const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

// Add delay to avoid rate limits
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    // Add small random delay to avoid patterns
    await delay(50 + Math.random() * 100);
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 7000
    });
    
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
      console.log('⏳ Rate limited, waiting...');
      await delay(2000);
    }
    return 0;
  }
}

async function mlbTo95Percent() {
  console.log('\n⚾ MLB TO 95% COVERAGE - SMART & STEADY!');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  // Get current coverage
  console.log('📊 Calculating current coverage...');
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null);
  
  const totalGames = allGames?.length || 0;
  
  // Check coverage in batches
  let currentCoveredGames = 0;
  for (let i = 0; i < totalGames; i += 100) {
    const batch = allGames!.slice(i, i + 100);
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch.map(g => g.id));
    
    const uniqueGames = new Set(withStats?.map(s => s.game_id) || []);
    currentCoveredGames += uniqueGames.size;
  }
  
  const currentCoverage = (currentCoveredGames / totalGames * 100);
  const targetGames = Math.ceil(totalGames * 0.95);
  const gamesNeeded = targetGames - currentCoveredGames;
  
  console.log(`\n📊 CURRENT STATUS:`);
  console.log(`   Total MLB games: ${totalGames}`);
  console.log(`   Games with stats: ${currentCoveredGames}`);
  console.log(`   Current coverage: ${currentCoverage.toFixed(1)}%`);
  console.log(`   Target (95%): ${targetGames} games`);
  console.log(`   Games needed: ${gamesNeeded}`);
  
  if (currentCoverage >= 95) {
    console.log('\n🎉 MLB ALREADY AT 95%+ COVERAGE!');
    return;
  }
  
  // Find games needing stats
  console.log('\n🔍 Finding games without stats...');
  const gamesNeedingStats: any[] = [];
  
  const { data: gamesData } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false });
  
  if (!gamesData) return;
  
  // Check in batches which games need stats
  for (let i = 0; i < gamesData.length; i += 100) {
    const batch = gamesData.slice(i, i + 100);
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch.map(g => g.id));
    
    const hasStatsSet = new Set(withStats?.map(s => s.game_id) || []);
    
    for (const game of batch) {
      if (!hasStatsSet.has(game.id)) {
        gamesNeedingStats.push(game);
        if (gamesNeedingStats.length >= gamesNeeded + 100) break; // Get a few extra
      }
    }
    
    if (gamesNeedingStats.length >= gamesNeeded + 100) break;
  }
  
  console.log(`Found ${gamesNeedingStats.length} games to process`);
  
  let totalStats = 0;
  let processedGames = 0;
  let rateLimited = 0;
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
          rateLimited++;
        }
        return stats;
      })
    );
    
    await Promise.all(promises);
    
    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const gamesPerSecond = (processedGames / elapsed).toFixed(1);
    const currentCov = ((currentCoveredGames + processedGames) / totalGames * 100).toFixed(1);
    
    console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${processedGames} games | ${totalStats} stats | ${gamesPerSecond} g/s | Coverage: ${currentCov}%`);
    
    // Check if we've reached 95%
    if (parseFloat(currentCov) >= 95) {
      console.log('\n🎉 REACHED 95% COVERAGE!');
      break;
    }
    
    // Delay between batches
    if (i + batchSize < gamesNeedingStats.length) {
      await delay(500);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n⚾ MLB COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Rate limits hit: ${rateLimited}`);
  console.log(`Time: ${totalTime} seconds`);
  console.log(`Speed: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`NET GAIN: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
  
  const finalCoverage = ((currentCoveredGames + processedGames) / totalGames * 100);
  console.log(`\n📊 FINAL MLB COVERAGE: ${finalCoverage.toFixed(1)}%`);
  
  if (finalCoverage >= 95) {
    console.log(`\n🎉🎉🎉 MLB 95%+ COVERAGE ACHIEVED! 🎉🎉🎉`);
  }
}

mlbTo95Percent().catch(console.error);