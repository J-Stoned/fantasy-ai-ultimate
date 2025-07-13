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
const CONCURRENT_REQUESTS = Math.min(CPU_CORES * 3, 36);

console.log(`🏀 SMART NBA COLLECTOR - ${CPU_CORES} CORES = ${CONCURRENT_REQUESTS} CONCURRENT!`);

const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

function extractEspnId(externalId: string): string | null {
  const patterns = [/espn_nba_(\d+)$/, /nba_(\d+)$/, /^(\d+)$/];
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getOrCreatePlayer(espnId: string, name: string, teamId: number): Promise<number> {
  const standardizedId = `espn_nba_${espnId}`;
  
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
      sport: 'NBA',
      sport_id: 'nba',
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

async function scrapeNBAGame(game: any): Promise<number> {
  const espnId = extractEspnId(game.external_id);
  if (!espnId) return 0;
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`;
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
        
        const playersStats = team.statistics?.find((s: any) => s.name === 'starters' || s.name === 'bench');
        if (playersStats?.athletes) {
          for (const athlete of playersStats.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // NBA stats mapping
              const mappings = [
                { index: 0, type: 'minutes' },
                { index: 1, type: 'fieldGoals' },
                { index: 2, type: 'threePointers' },
                { index: 3, type: 'freeThrows' },
                { index: 4, type: 'offensiveRebounds' },
                { index: 5, type: 'defensiveRebounds' },
                { index: 6, type: 'rebounds' },
                { index: 7, type: 'assists' },
                { index: 8, type: 'steals' },
                { index: 9, type: 'blocks' },
                { index: 10, type: 'turnovers' },
                { index: 11, type: 'fouls' },
                { index: 12, type: 'plusMinus' },
                { index: 13, type: 'points' }
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

async function smartNBACollector() {
  console.log('\n🏀 SMART NBA COLLECTOR - TO 95%!');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting: ${startingStats?.toLocaleString()} stats`);
  
  // Find all NBA games needing stats
  console.log('\n📊 Finding NBA games that NEED stats...');
  const gamesNeedingStats: any[] = [];
  let offset = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id')
      .or('sport.eq.NBA,sport_id.eq.nba')
      .not('external_id', 'is', null)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .range(offset, offset + chunkSize - 1);
    
    if (!games || games.length === 0) break;
    
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
    console.log('🎉 All NBA games already have stats!');
    return;
  }
  
  console.log(`\n✨ Found ${gamesNeedingStats.length} NBA games needing stats\n`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  const promises = gamesNeedingStats.map((game) =>
    limit(async () => {
      const stats = await scrapeNBAGame(game);
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
  
  // Check coverage
  const { count: totalNBA } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport_id.eq.nba')
    .not('home_score', 'is', null);
  
  const { data: sample } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
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
  
  console.log('\n🏀 NBA COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${processedGames}/${gamesNeedingStats.length}`);
  console.log(`Success rate: ${(processedGames / gamesNeedingStats.length * 100).toFixed(1)}%`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Time: ${totalTime} seconds`);
  console.log(`Speed: ${(processedGames / parseFloat(totalTime)).toFixed(1)} games/second`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`NET GAIN: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
  console.log(`\n📊 NBA COVERAGE: ${finalCoverage.toFixed(1)}%`);
  
  if (finalCoverage >= 95) {
    console.log(`\n🎉🎉🎉 NBA 95%+ COVERAGE ACHIEVED! 🎉🎉🎉`);
  }
}

smartNBACollector().catch(console.error);