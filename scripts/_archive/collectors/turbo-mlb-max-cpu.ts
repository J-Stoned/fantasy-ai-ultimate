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

// Use MORE connections per CPU
const CPU_CORES = os.cpus().length;
const CONCURRENT_REQUESTS = CPU_CORES * 3; // 36 concurrent requests on 12 cores!

console.log(`🚀 TURBO MLB COLLECTOR - ${CPU_CORES} CORES = ${CONCURRENT_REQUESTS} CONCURRENT REQUESTS!`);

const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

function extractEspnId(externalId: string): string | null {
  const patterns = [
    /espn_mlb_(\d+)$/,
    /mlb_(\d+)$/,
    /^(\d+)$/
  ];
  
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
        const batting = team.statistics?.find((s: any) => s.name === 'batting');
        if (batting?.athletes) {
          for (const athlete of batting.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // MLB batting stats mapping
              const statMap = ['atBats', 'runs', 'hits', 'doubles', 'triples', 
                               'homeRuns', 'RBIs', 'walks', 'strikeouts', 'stolenBases'];
              
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
            } catch (e) {
              // Skip player
            }
          }
        }
        
        // Process pitching stats
        const pitching = team.statistics?.find((s: any) => s.name === 'pitching');
        if (pitching?.athletes) {
          for (const athlete of pitching.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // Just get key pitching stats
              if (athlete.stats[0]) { // IP
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: 'inningsPitched',
                  stat_value: athlete.stats[0]
                });
              }
              if (athlete.stats[3]) { // ER
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: 'earnedRuns',
                  stat_value: athlete.stats[3]
                });
              }
              if (athlete.stats[6]) { // K
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: 'strikeoutsPitching',
                  stat_value: athlete.stats[6]
                });
              }
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

async function turboMLBMaxCPU() {
  console.log('\n⚡ TURBO MLB COLLECTOR - MAX CPU EDITION ⚡');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} stats`);
  console.log(`CPU Cores: ${CPU_CORES}`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}\n`);
  
  // Get MLB games - focus on 2024 season first
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .gte('start_time', '2024-01-01')
    .order('start_time', { ascending: false })
    .limit(1000); // Process 1000 games
  
  if (!games) {
    console.error('No games found');
    return;
  }
  
  console.log(`Processing ${games.length} MLB games with ${CONCURRENT_REQUESTS} concurrent connections...\n`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process all games with massive concurrency
  const promises = games.map((game, index) =>
    limit(async () => {
      const stats = await scrapeMLBGame(game);
      if (stats > 0) {
        totalStats += stats;
        processedGames++;
        
        // Progress update every 50 games
        if (processedGames % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const gamesPerSecond = (processedGames / elapsed).toFixed(1);
          console.log(`Progress: ${processedGames}/${games.length} games | ${totalStats} stats | ${gamesPerSecond} games/sec`);
        }
      }
      return stats;
    })
  );
  
  // Wait for all to complete
  await Promise.all(promises);
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n🏆 TURBO COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}/${games.length}`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Time taken: ${totalTime} seconds`);
  console.log(`Average: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`Net gain: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats`);
}

// Check if p-limit is installed
async function main() {
  try {
    await import('p-limit');
  } catch (e) {
    console.log('Installing p-limit...');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync('npm install p-limit');
  }
  
  await turboMLBMaxCPU();
}

main().catch(console.error);