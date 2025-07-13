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
const CONCURRENT_REQUESTS = CPU_CORES * 2;
const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

console.log(`🏒 NHL STATS COLLECTOR - ${CPU_CORES} CORES`);

function extractEspnId(externalId: string): string | null {
  const patterns = [/espn_nhl_(\d+)$/, /nhl_(\d+)$/, /^(\d+)$/];
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getOrCreatePlayer(espnId: string, name: string, teamId: number): Promise<number> {
  const standardizedId = `espn_nhl_${espnId}`;
  
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
      sport: 'NHL',
      sport_id: 'nhl',
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

async function scrapeNHLGame(game: any): Promise<number> {
  const espnId = extractEspnId(game.external_id);
  if (!espnId) return 0;
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${espnId}`;
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
        
        // NHL has skaters and goalies
        const skaters = team.statistics?.find((s: any) => s.type === 'skaters' || s.name === 'skaters');
        if (skaters?.athletes) {
          for (const athlete of skaters.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // NHL skater stat mappings
              const mappings = [
                { index: 0, type: 'goals' },      // G
                { index: 1, type: 'assists' },    // A
                { index: 2, type: 'points' },     // PTS
                { index: 3, type: 'plusMinus' },  // +/-
                { index: 4, type: 'penaltyMinutes' }, // PIM
                { index: 5, type: 'powerPlayGoals' }, // PPG
                { index: 6, type: 'shortHandedGoals' }, // SHG
                { index: 7, type: 'shots' },      // S
                { index: 8, type: 'faceoffWins' }, // FW
                { index: 9, type: 'faceoffLosses' }, // FL
                { index: 10, type: 'blockedShots' }, // BS
                { index: 11, type: 'hits' },      // HIT
                { index: 12, type: 'timeOnIce' }  // TOI
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
            } catch (e) {}
          }
        }
        
        // Goalies
        const goalies = team.statistics?.find((s: any) => s.type === 'goalies' || s.name === 'goalies');
        if (goalies?.athletes) {
          for (const athlete of goalies.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // NHL goalie stat mappings
              const goalieMappings = [
                { index: 0, type: 'saves' },        // SA
                { index: 1, type: 'shotsAgainst' }, // GA
                { index: 2, type: 'goalsAgainst' }, // SV
                { index: 3, type: 'timeOnIce' }     // TOI
              ];
              
              goalieMappings.forEach(({ index, type }) => {
                if (athlete.stats[index] && athlete.stats[index] !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: type,
                    stat_value: athlete.stats[index]
                  });
                }
              });
            } catch (e) {}
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

async function collectNHLStats() {
  console.log('\n🏒 NHL STATS COLLECTION STARTING!');
  console.log('='.repeat(60));
  
  // Find games needing stats
  const gamesNeedingStats: any[] = [];
  let offset = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id')
      .or('sport.eq.NHL,sport_id.eq.nhl')
      .not('external_id', 'is', null)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .range(offset, offset + chunkSize - 1);
    
    if (!games || games.length === 0) break;
    
    // Check which need stats
    const gameIds = games.map(g => g.id);
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', gameIds);
    
    const hasStatsSet = new Set(withStats?.map(s => s.game_id) || []);
    
    for (const game of games) {
      if (!hasStatsSet.has(game.id)) {
        gamesNeedingStats.push(game);
      }
    }
    
    console.log(`Scanned ${offset + games.length} games, found ${gamesNeedingStats.length} needing stats...`);
    
    offset += chunkSize;
    if (games.length < chunkSize) break;
  }
  
  console.log(`\nFound ${gamesNeedingStats.length} NHL games needing stats`);
  console.log(`Using ${CONCURRENT_REQUESTS} concurrent requests\n`);
  
  const startTime = Date.now();
  let totalStats = 0;
  let processedGames = 0;
  
  // Process all games
  const promises = gamesNeedingStats.map((game) =>
    limit(async () => {
      const stats = await scrapeNHLGame(game);
      if (stats > 0) {
        totalStats += stats;
        processedGames++;
        
        if (processedGames % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const gamesPerSecond = (processedGames / elapsed).toFixed(1);
          const eta = ((gamesNeedingStats.length - processedGames) / parseFloat(gamesPerSecond) / 60).toFixed(1);
          console.log(`Progress: ${processedGames}/${gamesNeedingStats.length} games | ${totalStats} stats | ${gamesPerSecond} g/s | ETA: ${eta} min`);
        }
      }
      return stats;
    })
  );
  
  await Promise.all(promises);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🏒 NHL COLLECTION COMPLETE!`);
  console.log('='.repeat(60));
  console.log(`Games processed: ${processedGames}/${gamesNeedingStats.length}`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Time: ${elapsed} seconds`);
  console.log(`Speed: ${(processedGames / parseFloat(elapsed)).toFixed(1)} games/second`);
}

collectNHLStats().catch(console.error);