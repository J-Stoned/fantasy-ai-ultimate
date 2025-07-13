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
const CONCURRENT_REQUESTS = 20; // Balanced for rate limits

console.log(`🚀 ULTIMATE 95% COLLECTOR - ALL SPORTS!`);

const limit = pLimit(CONCURRENT_REQUESTS);
const playerCache = new Map<string, number>();

// Sport configurations
const SPORT_CONFIGS = {
  MLB: {
    url: (id: string) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${id}`,
    statMappings: {
      batting: [
        { index: 1, type: 'atBats' },
        { index: 2, type: 'runs' },
        { index: 3, type: 'hits' },
        { index: 4, type: 'RBIs' },
        { index: 5, type: 'homeRuns' },
        { index: 6, type: 'walks' },
        { index: 7, type: 'strikeouts' }
      ],
      pitching: [
        { index: 0, type: 'inningsPitched' },
        { index: 3, type: 'earnedRuns' },
        { index: 6, type: 'strikeoutsPitching' }
      ]
    }
  },
  NBA: {
    url: (id: string) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`,
    statMappings: {
      players: [
        { index: 0, type: 'minutes' },
        { index: 1, type: 'fieldGoals' },
        { index: 2, type: 'threePointers' },
        { index: 3, type: 'freeThrows' },
        { index: 6, type: 'rebounds' },
        { index: 7, type: 'assists' },
        { index: 8, type: 'steals' },
        { index: 9, type: 'blocks' },
        { index: 10, type: 'turnovers' },
        { index: 13, type: 'points' }
      ]
    }
  },
  NFL: {
    url: (id: string) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`,
    statMappings: {
      passing: [
        { index: 0, type: 'completions' },
        { index: 1, type: 'passingYards' },
        { index: 2, type: 'passingTDs' },
        { index: 3, type: 'interceptions' }
      ],
      rushing: [
        { index: 0, type: 'rushingAttempts' },
        { index: 1, type: 'rushingYards' },
        { index: 3, type: 'rushingTDs' }
      ],
      receiving: [
        { index: 0, type: 'receptions' },
        { index: 1, type: 'receivingYards' },
        { index: 3, type: 'receivingTDs' }
      ]
    }
  },
  NHL: {
    url: (id: string) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${id}`,
    statMappings: {
      skaters: [
        { index: 0, type: 'goals' },
        { index: 1, type: 'assists' },
        { index: 2, type: 'points' },
        { index: 3, type: 'plusMinus' },
        { index: 7, type: 'shots' }
      ],
      goalies: [
        { index: 0, type: 'saves' },
        { index: 1, type: 'shotsAgainst' },
        { index: 2, type: 'goalsAgainst' }
      ]
    }
  }
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractEspnId(externalId: string): string | null {
  const patterns = [/espn_\w+_(\d+)$/, /\w+_(\d+)$/, /^(\d+)$/];
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getOrCreatePlayer(espnId: string, name: string, teamId: number, sport: string): Promise<number> {
  const standardizedId = `espn_${sport.toLowerCase()}_${espnId}`;
  
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
      sport: sport,
      sport_id: sport.toLowerCase(),
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

async function scrapeGame(game: any, sport: string): Promise<number> {
  const espnId = extractEspnId(game.external_id);
  if (!espnId) return 0;
  
  const config = SPORT_CONFIGS[sport as keyof typeof SPORT_CONFIGS];
  if (!config) return 0;
  
  try {
    await delay(50 + Math.random() * 100);
    
    const response = await axios.get(config.url(espnId), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 7000
    });
    
    const stats: any[] = [];
    
    if (response.data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of response.data.boxscore.players) {
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        // Process based on sport
        if (sport === 'MLB') {
          // Batting stats
          const batting = team.statistics?.find((s: any) => s.type === 'batting');
          if (batting?.athletes) {
            for (const athlete of batting.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                config.statMappings.batting.forEach(({ index, type }) => {
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
          
          // Pitching stats
          const pitching = team.statistics?.find((s: any) => s.type === 'pitching');
          if (pitching?.athletes) {
            for (const athlete of pitching.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                config.statMappings.pitching.forEach(({ index, type }) => {
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
        } else if (sport === 'NBA') {
          // NBA stats
          const playerStats = team.statistics?.find((s: any) => s.name === 'starters' || s.name === 'bench');
          if (!playerStats) continue;
          
          for (const statGroup of team.statistics) {
            if (statGroup.athletes) {
              for (const athlete of statGroup.athletes) {
                if (!athlete.stats || athlete.stats.length === 0) continue;
                try {
                  const playerId = await getOrCreatePlayer(
                    athlete.athlete.id,
                    athlete.athlete.displayName,
                    teamId,
                    sport
                  );
                  
                  config.statMappings.players.forEach(({ index, type }) => {
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
        } else if (sport === 'NFL') {
          // NFL stats - multiple categories
          for (const statGroup of team.statistics || []) {
            if (statGroup.name === 'passing' && config.statMappings.passing) {
              for (const athlete of statGroup.athletes || []) {
                if (!athlete.stats || athlete.stats.length === 0) continue;
                try {
                  const playerId = await getOrCreatePlayer(
                    athlete.athlete.id,
                    athlete.athlete.displayName,
                    teamId,
                    sport
                  );
                  
                  config.statMappings.passing.forEach(({ index, type }) => {
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
            } else if (statGroup.name === 'rushing' && config.statMappings.rushing) {
              for (const athlete of statGroup.athletes || []) {
                if (!athlete.stats || athlete.stats.length === 0) continue;
                try {
                  const playerId = await getOrCreatePlayer(
                    athlete.athlete.id,
                    athlete.athlete.displayName,
                    teamId,
                    sport
                  );
                  
                  config.statMappings.rushing.forEach(({ index, type }) => {
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
            } else if (statGroup.name === 'receiving' && config.statMappings.receiving) {
              for (const athlete of statGroup.athletes || []) {
                if (!athlete.stats || athlete.stats.length === 0) continue;
                try {
                  const playerId = await getOrCreatePlayer(
                    athlete.athlete.id,
                    athlete.athlete.displayName,
                    teamId,
                    sport
                  );
                  
                  config.statMappings.receiving.forEach(({ index, type }) => {
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
        } else if (sport === 'NHL') {
          // NHL stats
          const skaters = team.statistics?.find((s: any) => s.type === 'skaters' || s.name === 'skaters');
          if (skaters?.athletes) {
            for (const athlete of skaters.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                config.statMappings.skaters.forEach(({ index, type }) => {
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
          
          const goalies = team.statistics?.find((s: any) => s.type === 'goalies' || s.name === 'goalies');
          if (goalies?.athletes) {
            for (const athlete of goalies.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                config.statMappings.goalies.forEach(({ index, type }) => {
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

async function collectSportTo95(sport: string) {
  console.log(`\n🏆 COLLECTING ${sport} TO 95%`);
  console.log('='.repeat(60));
  
  // Get current coverage
  const allGameIds: number[] = [];
  let offset = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
      .not('home_score', 'is', null)
      .range(offset, offset + chunkSize - 1);
    
    if (!games || games.length === 0) break;
    allGameIds.push(...games.map(g => g.id));
    
    if (games.length < chunkSize) break;
    offset += chunkSize;
  }
  
  const totalGames = allGameIds.length;
  console.log(`Total ${sport} games: ${totalGames}`);
  
  // Check current coverage
  let currentCoveredGames = 0;
  for (let i = 0; i < totalGames; i += 100) {
    const batch = allGameIds.slice(i, i + 100);
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch);
    
    const uniqueGames = new Set(withStats?.map(s => s.game_id) || []);
    currentCoveredGames += uniqueGames.size;
  }
  
  const currentCoverage = (currentCoveredGames / totalGames * 100);
  const targetGames = Math.ceil(totalGames * 0.95);
  const gamesNeeded = targetGames - currentCoveredGames;
  
  console.log(`Current coverage: ${currentCoverage.toFixed(1)}%`);
  console.log(`Games needed for 95%: ${gamesNeeded}`);
  
  if (currentCoverage >= 95) {
    console.log(`✅ ${sport} ALREADY AT 95%+ COVERAGE!`);
    return;
  }
  
  // Find games needing stats
  const gamesNeedingStats: any[] = [];
  const { data: gamesData } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false });
  
  if (!gamesData) return;
  
  // Check which need stats
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
        if (gamesNeedingStats.length >= gamesNeeded + 50) break;
      }
    }
    
    if (gamesNeedingStats.length >= gamesNeeded + 50) break;
  }
  
  console.log(`Processing ${gamesNeedingStats.length} games...\n`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process in batches
  const batchSize = 50;
  for (let i = 0; i < gamesNeedingStats.length; i += batchSize) {
    const batch = gamesNeedingStats.slice(i, i + batchSize);
    
    const promises = batch.map((game) =>
      limit(async () => {
        const stats = await scrapeGame(game, sport);
        if (stats > 0) {
          totalStats += stats;
          processedGames++;
        }
        return stats;
      })
    );
    
    await Promise.all(promises);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const gamesPerSecond = (processedGames / elapsed).toFixed(1);
    const currentCov = ((currentCoveredGames + processedGames) / totalGames * 100).toFixed(1);
    
    console.log(`Progress: ${processedGames} games | ${totalStats} stats | ${gamesPerSecond} g/s | Coverage: ${currentCov}%`);
    
    if (parseFloat(currentCov) >= 95) {
      console.log(`\n🎉 ${sport} REACHED 95% COVERAGE!`);
      break;
    }
    
    await delay(300);
  }
  
  const finalCoverage = ((currentCoveredGames + processedGames) / totalGames * 100);
  console.log(`\nFinal ${sport} coverage: ${finalCoverage.toFixed(1)}%`);
}

async function ultimate95Collector() {
  console.log('🚀 ULTIMATE 95% COLLECTOR - ALL SPORTS TO 95%!');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting total stats: ${startingStats?.toLocaleString()}\n`);
  
  // Process each sport
  const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
  for (const sport of sports) {
    await collectSportTo95(sport);
  }
  
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n🏆 ULTIMATE COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Starting stats: ${startingStats?.toLocaleString()}`);
  console.log(`Ending stats: ${endingStats?.toLocaleString()}`);
  console.log(`TOTAL ADDED: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
  
  // Final coverage check
  await delay(1000);
  console.log('\n📊 FINAL COVERAGE CHECK:');
  for (const sport of sports) {
    const { data: allGames } = await supabase
      .from('games')
      .select('id')
      .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
      .not('home_score', 'is', null);
    
    const totalGames = allGames?.length || 0;
    let coveredGames = 0;
    
    for (let i = 0; i < totalGames; i += 100) {
      const batch = allGames!.slice(i, i + 100);
      const { data: withStats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch.map(g => g.id));
      
      const uniqueGames = new Set(withStats?.map(s => s.game_id) || []);
      coveredGames += uniqueGames.size;
    }
    
    const coverage = (coveredGames / totalGames * 100);
    console.log(`${sport}: ${coverage.toFixed(1)}% coverage ${coverage >= 95 ? '✅' : ''}`);
  }
}

ultimate95Collector().catch(console.error);