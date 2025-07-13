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
const CONCURRENT_REQUESTS = Math.min(CPU_CORES * 3, 36); // Max 36 concurrent

console.log(`🚀 MEGA SMART COLLECTOR - TO THE MOON!`);

const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000
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
  } catch (error) {
    return 0;
  }
}

async function megaSmartCollector() {
  console.log('\n🚀 MEGA SMART COLLECTOR - GET TO 95%!');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} stats`);
  console.log(`CPU Cores: ${CPU_CORES}`);
  console.log(`Concurrent: ${CONCURRENT_REQUESTS}\n`);
  
  // Get ALL MLB games - no limit!
  console.log('📊 Finding ALL games that NEED stats...');
  const gamesNeedingStats: any[] = [];
  let offset = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id')
      .or('sport.eq.MLB,sport_id.eq.mlb')
      .not('external_id', 'is', null)
      .not('home_score', 'is', null)
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
  
  console.log(`\n✨ MEGA FILTER RESULTS:`);
  console.log(`   Games NEEDING stats: ${gamesNeedingStats.length}`);
  console.log(`   Let's get them ALL!\n`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process ALL games that need stats
  const promises = gamesNeedingStats.map((game, index) =>
    limit(async () => {
      const stats = await scrapeMLBGame(game);
      if (stats > 0) {
        totalStats += stats;
        processedGames++;
        
        if (processedGames % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const gamesPerSecond = (processedGames / elapsed).toFixed(1);
          const eta = ((gamesNeedingStats.length - processedGames) / parseFloat(gamesPerSecond) / 60).toFixed(1);
          console.log(`Progress: ${processedGames}/${gamesNeedingStats.length} | ${totalStats} stats | ${gamesPerSecond} games/sec | ETA: ${eta} min`);
        }
      }
      return stats;
    })
  );
  
  await Promise.all(promises);
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  // Get final coverage
  const { count: totalMLB } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null);
  
  const { data: sample } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .limit(500);
  
  let finalCoverage = 0;
  if (sample) {
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', sample.map(g => g.id));
    
    const coverage = new Set(withStats?.map(s => s.game_id) || []).size;
    finalCoverage = (coverage / sample.length * 100);
  }
  
  console.log('\n⚾ MEGA COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}/${gamesNeedingStats.length}`);
  console.log(`Success rate: ${(processedGames / gamesNeedingStats.length * 100).toFixed(1)}%`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Time: ${totalTime} seconds (${(parseFloat(totalTime) / 60).toFixed(1)} minutes)`);
  console.log(`Speed: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`NET GAIN: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
  console.log(`\n📊 MLB COVERAGE: ${finalCoverage.toFixed(1)}%`);
  
  if (finalCoverage >= 95) {
    console.log(`\n🎉🎉🎉 WE DID IT! 95%+ COVERAGE ACHIEVED! 🎉🎉🎉`);
  } else {
    const gamesStillNeeded = Math.ceil((totalMLB || 0) * 0.95) - Math.round((totalMLB || 0) * (finalCoverage / 100));
    console.log(`   To 95%: ${gamesStillNeeded} more games needed`);
  }
}

megaSmartCollector().catch(console.error);