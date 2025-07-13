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
const CONCURRENT_REQUESTS = Math.min(CPU_CORES * 2, 24); // Limit to avoid rate limits

console.log(`🧠 SMART MLB COLLECTOR - ${CPU_CORES} CORES = ${CONCURRENT_REQUESTS} CONCURRENT!`);

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

async function smartMLBCollector() {
  console.log('\n🧠 SMART MLB COLLECTOR - SKIP EXISTING! 🧠');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} stats`);
  console.log(`CPU Cores: ${CPU_CORES}`);
  console.log(`Concurrent: ${CONCURRENT_REQUESTS}\n`);
  
  // Step 1: Get ALL MLB games
  console.log('📊 Finding games that NEED stats...');
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .gte('start_time', '2024-01-01')
    .order('start_time', { ascending: false })
    .limit(5000);
  
  if (!allGames || allGames.length === 0) {
    console.error('No games found');
    return;
  }
  
  console.log(`Found ${allGames.length} MLB games total`);
  
  // Step 2: Check which games already have stats IN BATCHES
  const gamesNeedingStats: any[] = [];
  const batchSize = 100;
  
  for (let i = 0; i < allGames.length; i += batchSize) {
    const batch = allGames.slice(i, i + batchSize);
    const gameIds = batch.map(g => g.id);
    
    // Get games that have stats
    const { data: gamesWithStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', gameIds);
    
    const hasStatsSet = new Set(gamesWithStats?.map(s => s.game_id) || []);
    
    // Add games WITHOUT stats to our list
    for (const game of batch) {
      if (!hasStatsSet.has(game.id)) {
        gamesNeedingStats.push(game);
      }
    }
    
    if ((i + batchSize) % 500 === 0) {
      console.log(`Checked ${i + batchSize}/${allGames.length} games...`);
    }
  }
  
  console.log(`\n✨ SMART FILTER RESULTS:`);
  console.log(`   Games already with stats: ${allGames.length - gamesNeedingStats.length}`);
  console.log(`   Games NEEDING stats: ${gamesNeedingStats.length}`);
  console.log(`   Efficiency gain: ${((allGames.length - gamesNeedingStats.length) / allGames.length * 100).toFixed(1)}% fewer API calls!\n`);
  
  if (gamesNeedingStats.length === 0) {
    console.log('🎉 All games already have stats!');
    return;
  }
  
  console.log(`Processing ${gamesNeedingStats.length} games that NEED stats...\n`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process only games that need stats
  const promises = gamesNeedingStats.map((game, index) =>
    limit(async () => {
      const stats = await scrapeMLBGame(game);
      if (stats > 0) {
        totalStats += stats;
        processedGames++;
        
        if (processedGames % 10 === 0) {
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
  
  console.log('\n⚾ SMART MLB COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}/${gamesNeedingStats.length}`);
  console.log(`Success rate: ${(processedGames / gamesNeedingStats.length * 100).toFixed(1)}%`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Time: ${totalTime} seconds`);
  console.log(`Speed: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`NET GAIN: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
  
  // Quick coverage check
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
    .limit(200);
  
  if (sample) {
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', sample.map(g => g.id));
    
    const coverage = new Set(withStats?.map(s => s.game_id) || []).size;
    const percent = (coverage / sample.length * 100).toFixed(1);
    
    console.log(`\n📊 MLB COVERAGE UPDATE:`);
    console.log(`   Coverage: ${percent}% (estimated)`);
    console.log(`   To 95%: ${Math.max(0, Math.ceil((totalMLB || 0) * 0.95) - Math.round((totalMLB || 0) * (coverage / sample.length)))} games needed`);
  }
}

smartMLBCollector().catch(console.error);