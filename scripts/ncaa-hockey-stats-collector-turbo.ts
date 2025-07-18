import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 TURBO SETTINGS - Ryzen 5 7600X + 32GB RAM
const HTTP_CONCURRENCY = 48;
const DB_WRITE_CONCURRENCY = 12;
const BATCH_SIZE = 2000;
const DB_QUERY_LIMIT = 1000; // DOUBLED for maximum performance!

const httpLimit = pLimit(HTTP_CONCURRENCY);
const dbLimit = pLimit(DB_WRITE_CONCURRENCY);

// In-memory caches
const playerCache = new Map<string, any>();
const statsBuffer: any[] = [];

interface NCAAHockeyStats {
  game_id: number;
  player_id: number;
  team_id: number;
  opponent_id: number;
  game_date: string;
  is_home: boolean;
  
  // Forward/Defense stats
  goals?: number;
  assists?: number;
  points?: number;
  plus_minus?: number;
  shots?: number;
  shots_missed?: number;
  blocked_shots?: number;
  hits?: number;
  takeaways?: number;
  giveaways?: number;
  faceoffs_won?: number;
  faceoffs_lost?: number;
  faceoff_pct?: number;
  powerplay_goals?: number;
  powerplay_assists?: number;
  shorthanded_goals?: number;
  penalty_minutes?: number;
  time_on_ice?: string;
  powerplay_time?: string;
  shorthanded_time?: string;
  even_time?: string;
  shifts?: number;
  
  // Goalie stats
  goals_against?: number;
  saves?: number;
  shots_against?: number;
  save_percentage?: number;
  shutout?: boolean;
  wins?: number;
  losses?: number;
  minutes_played?: string;
}

async function getOrCreatePlayer(athleteData: any, teamId: number): Promise<number> {
  const espnId = `espn_ncaahockey_${athleteData.id}`;
  
  // Check cache first
  if (playerCache.has(espnId)) {
    return playerCache.get(espnId);
  }
  
  // Check database
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', espnId)
    .single();
    
  if (existing) {
    playerCache.set(espnId, existing.id);
    return existing.id;
  }
  
  // Create new player
  const { data: newPlayer, error } = await supabase
    .from('players')
    .insert({
      external_id: espnId,
      name: athleteData.displayName || athleteData.lastName || 'Unknown',
      team_id: teamId,
      position: athleteData.position?.displayName || athleteData.position?.abbreviation || 'Unknown',
      jersey_number: athleteData.jersey || null,
      sport: 'NCAA_HKY',
      is_active: true
    })
    .select('id')
    .single();
    
  if (error) {
    console.error(chalk.red(`Error creating player ${athleteData.displayName}:`, error));
    throw error;
  }
  
  playerCache.set(espnId, newPlayer.id);
  return newPlayer.id;
}

function parseTimeOnIce(timeStr: string): string | null {
  if (!timeStr || timeStr === '0:00') return null;
  return timeStr;
}

function parseStatValue(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

async function collectGameStats(game: any): Promise<NCAAHockeyStats[]> {
  const gameId = game.external_id.replace('espn_ncaahockey_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    
    if (!data.boxscore?.players) {
      return [];
    }
    
    const stats: NCAAHockeyStats[] = [];
    
    // Process each team
    for (const teamData of data.boxscore.players) {
      const teamId = parseInt(teamData.team.id);
      const isHome = teamId === game.home_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      // Process each stat category (forwards, defenses, goalies)
      for (const statCategory of teamData.statistics || []) {
        const statLabels = statCategory.labels || [];
        
        // Map labels to indices
        const labelMap: Record<string, number> = {};
        statLabels.forEach((label: string, idx: number) => {
          labelMap[label] = idx;
        });
        
        // Process each athlete
        for (const athleteData of statCategory.athletes || []) {
          if (!athleteData.athlete || !athleteData.stats) continue;
          
          const playerId = await getOrCreatePlayer(athleteData.athlete, teamId);
          const playerStats = athleteData.stats;
          
          // Determine if this is a goalie based on stats
          const isGoalie = statCategory.name === 'goalies' || 
                          labelMap['GA'] !== undefined;
          
          const stat: NCAAHockeyStats = {
            game_id: game.id,
            player_id: playerId,
            team_id: teamId,
            opponent_id: opponentId,
            game_date: game.start_time,
            is_home: isHome
          };
          
          if (isGoalie) {
            // Goalie stats
            stat.goals_against = parseStatValue(playerStats[labelMap['GA']]);
            stat.saves = parseStatValue(playerStats[labelMap['SV']]);
            stat.shots_against = parseStatValue(playerStats[labelMap['SA']]);
            stat.save_percentage = parseStatValue(playerStats[labelMap['SV%']]);
            stat.minutes_played = parseTimeOnIce(playerStats[labelMap['TOI']]);
            stat.penalty_minutes = parseStatValue(playerStats[labelMap['PIM']]);
            
            // Determine win/loss
            if (stat.minutes_played && parseFloat(stat.minutes_played) > 0) {
              const teamScore = isHome ? game.home_score : game.away_score;
              const oppScore = isHome ? game.away_score : game.home_score;
              if (teamScore > oppScore) {
                stat.wins = 1;
                stat.losses = 0;
              } else {
                stat.wins = 0;
                stat.losses = 1;
              }
              stat.shutout = stat.goals_against === 0;
            }
          } else {
            // Skater stats
            stat.goals = parseStatValue(playerStats[labelMap['G']]);
            stat.assists = parseStatValue(playerStats[labelMap['A']]);
            stat.points = (stat.goals || 0) + (stat.assists || 0);
            stat.plus_minus = parseStatValue(playerStats[labelMap['+/-']]);
            stat.shots = parseStatValue(playerStats[labelMap['S']]);
            stat.shots_missed = parseStatValue(playerStats[labelMap['SM']]);
            stat.blocked_shots = parseStatValue(playerStats[labelMap['BS']]);
            stat.hits = parseStatValue(playerStats[labelMap['HT']]);
            stat.takeaways = parseStatValue(playerStats[labelMap['TK']]);
            stat.giveaways = parseStatValue(playerStats[labelMap['GV']]);
            stat.faceoffs_won = parseStatValue(playerStats[labelMap['FW']]);
            stat.faceoffs_lost = parseStatValue(playerStats[labelMap['FL']]);
            stat.faceoff_pct = parseStatValue(playerStats[labelMap['FO%']]);
            stat.penalty_minutes = parseStatValue(playerStats[labelMap['PIM']]);
            stat.time_on_ice = parseTimeOnIce(playerStats[labelMap['TOI']]);
            stat.powerplay_time = parseTimeOnIce(playerStats[labelMap['PPTOI']]);
            stat.shorthanded_time = parseTimeOnIce(playerStats[labelMap['SHTOI']]);
            stat.even_time = parseTimeOnIce(playerStats[labelMap['ESTOI']]);
            stat.shifts = parseStatValue(playerStats[labelMap['SHFT']]);
            
            // Check for PP/SH goals in other fields
            if (labelMap['PPG'] !== undefined) {
              stat.powerplay_goals = parseStatValue(playerStats[labelMap['PPG']]);
            }
            if (labelMap['SHG'] !== undefined) {
              stat.shorthanded_goals = parseStatValue(playerStats[labelMap['SHG']]);
            }
          }
          
          stats.push(stat);
        }
      }
    }
    
    return stats;
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(chalk.red(`Error collecting stats for game ${gameId}:`, error.message));
    }
    return [];
  }
}

async function flushStatsBuffer() {
  if (statsBuffer.length === 0) return;
  
  const toInsert = [...statsBuffer];
  statsBuffer.length = 0;
  
  console.log(chalk.blue(`\n💾 Flushing ${toInsert.length} stats to database...`));
  
  try {
    const { error } = await supabase
      .from('player_game_logs')
      .insert(toInsert);
      
    if (error) {
      console.error(chalk.red('Database insert error:'), error);
      throw error;
    }
    
    console.log(chalk.green(`✅ Successfully inserted ${toInsert.length} stats`));
  } catch (error) {
    console.error(chalk.red('Failed to flush stats buffer:'), error);
    throw error;
  }
}

async function collectNCAAHockeyStats() {
  console.log(chalk.cyan('🏒 NCAA Hockey Stats Collection - TURBO MODE\n'));
  console.log(chalk.yellow(`⚡ CPU: Ryzen 5 7600X | RAM: 32GB`));
  console.log(chalk.yellow(`⚡ HTTP: ${HTTP_CONCURRENCY} threads | DB: ${DB_WRITE_CONCURRENCY} threads\n`));
  
  const startTime = Date.now();
  let totalStats = 0;
  let gamesProcessed = 0;
  
  // Get total count
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
    
  console.log(chalk.yellow(`Total NCAA Hockey games: ${totalGames}\n`));
  
  // Process in batches
  let offset = 0;
  
  while (offset < totalGames!) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_HKY')
      .order('start_time', { ascending: false })
      .range(offset, offset + DB_QUERY_LIMIT - 1);
      
    if (!games || games.length === 0) break;
    
    console.log(chalk.gray(`\nProcessing batch: ${offset}-${offset + games.length} of ${totalGames}`));
    
    // Process games concurrently
    const batchPromises = games.map(game =>
      httpLimit(async () => {
        const stats = await collectGameStats(game);
        
        if (stats.length > 0) {
          // Add to buffer
          statsBuffer.push(...stats);
          totalStats += stats.length;
          gamesProcessed++;
          
          console.log(chalk.green(
            `✅ Game ${game.external_id}: ${stats.length} player stats`
          ));
          
          // Flush buffer if it's getting large
          if (statsBuffer.length >= BATCH_SIZE) {
            await dbLimit(() => flushStatsBuffer());
          }
        }
        
        // Progress update
        if (gamesProcessed % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = gamesProcessed / elapsed;
          const statsRate = totalStats / elapsed;
          console.log(chalk.blue(
            `\n📊 Progress: ${gamesProcessed} games | ${totalStats} stats | ` +
            `${rate.toFixed(1)} games/sec | ${statsRate.toFixed(0)} stats/sec`
          ));
        }
      })
    );
    
    await Promise.all(batchPromises);
    
    // Move to next batch
    offset += DB_QUERY_LIMIT;
  }
  
  // Final flush
  if (statsBuffer.length > 0) {
    await flushStatsBuffer();
  }
  
  // Final report
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(chalk.cyan('\n\n🏆 COLLECTION COMPLETE!'));
  console.log(chalk.green(`✅ Games processed: ${gamesProcessed}`));
  console.log(chalk.green(`✅ Total stats collected: ${totalStats}`));
  console.log(chalk.green(`✅ Players cached: ${playerCache.size}`));
  console.log(chalk.yellow(`⚡ Performance: ${(totalStats / totalTime).toFixed(0)} stats/sec`));
  console.log(chalk.yellow(`⏱️  Total time: ${Math.ceil(totalTime / 60)} minutes`));
  console.log(chalk.blue(`📊 Average stats per game: ${(totalStats / gamesProcessed).toFixed(1)}`));
  
  // Memory usage
  console.log(chalk.gray(`\n💾 Memory used: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`));
}

collectNCAAHockeyStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ NCAA Hockey stats collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });