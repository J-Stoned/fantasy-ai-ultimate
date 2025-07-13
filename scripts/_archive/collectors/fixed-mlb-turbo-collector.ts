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
const CONCURRENT_REQUESTS = CPU_CORES * 3; // 36 concurrent requests!

console.log(`⚡ FIXED MLB TURBO COLLECTOR - ${CPU_CORES} CORES = ${CONCURRENT_REQUESTS} CONCURRENT!`);

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
        
        // Process batting stats - MLB uses 'type' not 'name'!
        const batting = team.statistics?.find((s: any) => s.type === 'batting');
        if (batting?.athletes) {
          // MLB batting labels: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG']
          for (const athlete of batting.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // Map based on actual MLB API positions
              const mappings = [
                { index: 1, type: 'atBats' },      // AB
                { index: 2, type: 'runs' },        // R
                { index: 3, type: 'hits' },        // H
                { index: 4, type: 'RBIs' },        // RBI
                { index: 5, type: 'homeRuns' },    // HR
                { index: 6, type: 'walks' },       // BB
                { index: 7, type: 'strikeouts' }   // K
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
          // MLB pitching labels: ['IP', 'H', 'R', 'ER', 'HR', 'BB', 'K', 'PC-ST', 'ERA', 'PC', 'ST', 'WHIP']
          for (const athlete of pitching.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              const pitchMappings = [
                { index: 0, type: 'inningsPitched' },    // IP
                { index: 3, type: 'earnedRuns' },        // ER
                { index: 6, type: 'strikeoutsPitching' } // K
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

async function fixedMLBTurboCollector() {
  console.log('\n⚾ FIXED MLB TURBO COLLECTOR - MAX CPU! ⚾');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} stats`);
  console.log(`CPU Cores: ${CPU_CORES}`);
  console.log(`Concurrent: ${CONCURRENT_REQUESTS}\n`);
  
  // Get MLB games - 2024 season priority
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .gte('start_time', '2024-01-01')
    .order('start_time', { ascending: false })
    .limit(2000); // SCALE TO THE MOON!
  
  if (!games || games.length === 0) {
    console.error('No games found');
    return;
  }
  
  console.log(`Processing ${games.length} MLB games...\n`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process with max concurrency
  const promises = games.map((game, index) =>
    limit(async () => {
      const stats = await scrapeMLBGame(game);
      if (stats > 0) {
        totalStats += stats;
        processedGames++;
        
        if (processedGames % 20 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const gamesPerSecond = (processedGames / elapsed).toFixed(1);
          console.log(`Progress: ${processedGames}/${games.length} | ${totalStats} stats | ${gamesPerSecond} games/sec`);
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
  
  console.log('\n⚾ MLB COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}/${games.length}`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Time: ${totalTime} seconds`);
  console.log(`Speed: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`NET GAIN: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
}

fixedMLBTurboCollector().catch(console.error);