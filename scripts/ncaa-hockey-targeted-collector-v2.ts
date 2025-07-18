import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 TURBO SETTINGS
const HTTP_CONCURRENCY = 48;
const httpLimit = pLimit(HTTP_CONCURRENCY);

// In-memory caches
const playerCache = new Map<string, any>();
const teamCache = new Map<number, boolean>();
const statsBuffer: any[] = [];

async function checkTeamExists(teamId: number): Promise<boolean> {
  if (teamCache.has(teamId)) {
    return teamCache.get(teamId)!;
  }
  
  const { data } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .single();
    
  const exists = !!data;
  teamCache.set(teamId, exists);
  return exists;
}

async function getOrCreatePlayer(athleteData: any, teamId: number): Promise<number | null> {
  const espnId = `espn_ncaahockey_${athleteData.id}`;
  
  // Check cache first
  if (playerCache.has(espnId)) {
    return playerCache.get(espnId);
  }
  
  // Check if team exists
  const teamExists = await checkTeamExists(teamId);
  if (!teamExists) {
    console.log(chalk.yellow(`Skipping player ${athleteData.displayName} - team ${teamId} not found`));
    return null;
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
      position: [athleteData.position?.abbreviation || athleteData.position?.displayName || 'F'],
      jersey_number: athleteData.jersey || null,
      sport: 'NCAA_HKY'
    })
    .select('id')
    .single();
    
  if (error) {
    console.error(chalk.red(`Error creating player ${athleteData.displayName}:`, error.message));
    return null;
  }
  
  playerCache.set(espnId, newPlayer.id);
  return newPlayer.id;
}

function parseTimeOnIce(timeStr: string): number | null {
  if (!timeStr || timeStr === '0:00') return null;
  
  // Convert MM:SS to total minutes, rounded to nearest integer
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]);
    const seconds = parseInt(parts[1]);
    const totalMinutes = minutes + (seconds / 60);
    return Math.round(totalMinutes); // Round to nearest integer
  }
  
  return null;
}

function parseStatValue(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

async function collectGameStats(game: any): Promise<any[]> {
  const gameId = game.external_id.replace('espn_ncaahockey_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    
    if (!data.boxscore?.players) {
      return [];
    }
    
    const stats: any[] = [];
    
    // Process each team
    for (const teamData of data.boxscore.players) {
      const teamId = parseInt(teamData.team.id);
      
      // Check if both teams exist
      const teamExists = await checkTeamExists(teamId);
      if (!teamExists) {
        console.log(chalk.yellow(`Skipping team ${teamId} - not in database`));
        continue;
      }
      
      const isHome = teamId === game.home_team;
      const opponentId = isHome ? game.away_team : game.home_team;
      
      // Check opponent exists
      const opponentExists = await checkTeamExists(opponentId);
      if (!opponentExists) {
        console.log(chalk.yellow(`Skipping - opponent ${opponentId} not in database`));
        continue;
      }
      
      // Process each stat category
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
          if (!playerId) continue; // Skip if player couldn't be created
          
          const playerStats = athleteData.stats;
          
          // Determine if this is a goalie
          const isGoalie = statCategory.name === 'goalies' || labelMap['GA'] !== undefined;
          
          const gameDate = new Date(game.date);
          const dateStr = `${gameDate.getFullYear()}-${String(gameDate.getMonth() + 1).padStart(2, '0')}-${String(gameDate.getDate()).padStart(2, '0')}`;
          
          const statEntry: any = {
            game_id: game.game_id,
            player_id: playerId,
            team_id: teamId,
            opponent_id: opponentId,
            game_date: dateStr,
            is_home: isHome,
            stats: {} // Stats go in JSON object
          };
          
          if (isGoalie) {
            // Goalie stats
            statEntry.minutes_played = parseTimeOnIce(playerStats[labelMap['TOI']]);
            statEntry.stats = {
              goals_against: parseStatValue(playerStats[labelMap['GA']]) || 0,
              saves: parseStatValue(playerStats[labelMap['SV']]) || 0,
              shots_against: parseStatValue(playerStats[labelMap['SA']]) || 0,
              save_percentage: parseStatValue(playerStats[labelMap['SV%']]) || 0,
              penalty_minutes: parseStatValue(playerStats[labelMap['PIM']]) || 0,
              time_on_ice: playerStats[labelMap['TOI']] || '0:00'
            };
            
            // Determine win/loss from score
            const [homeScore, awayScore] = game.score.split('-').map(Number);
            if (statEntry.minutes_played && statEntry.minutes_played > 0) {
              const teamScore = isHome ? homeScore : awayScore;
              const oppScore = isHome ? awayScore : homeScore;
              if (teamScore > oppScore) {
                statEntry.stats.wins = 1;
                statEntry.stats.losses = 0;
              } else {
                statEntry.stats.wins = 0;
                statEntry.stats.losses = 1;
              }
              statEntry.stats.shutout = statEntry.stats.goals_against === 0 ? 1 : 0;
            }
          } else {
            // Skater stats
            const goals = parseStatValue(playerStats[labelMap['G']]) || 0;
            const assists = parseStatValue(playerStats[labelMap['A']]) || 0;
            
            statEntry.stats = {
              goals: goals,
              assists: assists,
              points: goals + assists,
              plus_minus: parseStatValue(playerStats[labelMap['+/-']]) || 0,
              shots: parseStatValue(playerStats[labelMap['S']]) || 0,
              shots_missed: parseStatValue(playerStats[labelMap['SM']]) || 0,
              blocked_shots: parseStatValue(playerStats[labelMap['BS']]) || 0,
              hits: parseStatValue(playerStats[labelMap['HT']]) || 0,
              takeaways: parseStatValue(playerStats[labelMap['TK']]) || 0,
              giveaways: parseStatValue(playerStats[labelMap['GV']]) || 0,
              faceoffs_won: parseStatValue(playerStats[labelMap['FW']]) || 0,
              faceoffs_lost: parseStatValue(playerStats[labelMap['FL']]) || 0,
              faceoff_pct: parseStatValue(playerStats[labelMap['FO%']]) || 0,
              penalty_minutes: parseStatValue(playerStats[labelMap['PIM']]) || 0,
              shifts: parseStatValue(playerStats[labelMap['SHFT']]) || 0
            };
            
            // Time on ice
            const toi = parseTimeOnIce(playerStats[labelMap['TOI']]);
            if (toi !== null) {
              statEntry.minutes_played = toi;
              // Store original time strings in stats
              statEntry.stats.time_on_ice = playerStats[labelMap['TOI']] || '0:00';
              statEntry.stats.powerplay_time = playerStats[labelMap['PPTOI']] || '0:00';
              statEntry.stats.shorthanded_time = playerStats[labelMap['SHTOI']] || '0:00';
              statEntry.stats.even_time = playerStats[labelMap['ESTOI']] || '0:00';
            }
          }
          
          stats.push(statEntry);
        }
      }
    }
    
    return stats;
  } catch (error: any) {
    console.error(chalk.red(`Error collecting stats for game ${gameId}:`, error.message));
    return [];
  }
}

async function collectTargetedNCAAHockeyStats() {
  console.log(chalk.cyan('🏒 NCAA Hockey Targeted Stats Collection V2\n'));
  console.log(chalk.yellow('⚡ Collecting stats with team validation\n'));
  
  const startTime = Date.now();
  
  // Load the games with stats
  const gamesData = JSON.parse(
    await fs.promises.readFile('ncaa-hockey-games-with-stats-full.json', 'utf-8')
  );
  
  const gamesWithStats = gamesData.games;
  console.log(chalk.yellow(`Found ${gamesWithStats.length} games with stats\n`));
  
  let totalStats = 0;
  let gamesProcessed = 0;
  let gamesSkipped = 0;
  
  // Process all games concurrently
  const promises = gamesWithStats.map((game: any) =>
    httpLimit(async () => {
      const stats = await collectGameStats(game);
      
      if (stats.length > 0) {
        statsBuffer.push(...stats);
        totalStats += stats.length;
        gamesProcessed++;
        
        console.log(chalk.green(
          `✅ Game ${game.external_id}: ${stats.length} player stats (Total: ${totalStats})`
        ));
      } else {
        gamesSkipped++;
        console.log(chalk.yellow(`⚠️  Game ${game.external_id}: Skipped (missing teams)`));
      }
    })
  );
  
  await Promise.all(promises);
  
  // Insert all stats at once
  if (statsBuffer.length > 0) {
    console.log(chalk.blue(`\n💾 Inserting ${statsBuffer.length} stats to database...`));
    
    const { error } = await supabase
      .from('player_game_logs')
      .insert(statsBuffer);
      
    if (error) {
      console.error(chalk.red('Database insert error:'), error);
      throw error;
    }
    
    console.log(chalk.green(`✅ Successfully inserted ${statsBuffer.length} stats`));
  }
  
  // Final report
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(chalk.cyan('\n\n🏆 COLLECTION COMPLETE!'));
  console.log(chalk.green(`✅ Games processed: ${gamesProcessed}`));
  console.log(chalk.yellow(`⚠️  Games skipped: ${gamesSkipped}`));
  console.log(chalk.green(`✅ Total stats collected: ${totalStats}`));
  console.log(chalk.green(`✅ Players created/cached: ${playerCache.size}`));
  console.log(chalk.green(`✅ Teams checked: ${teamCache.size}`));
  console.log(chalk.yellow(`⚡ Performance: ${(totalStats / totalTime).toFixed(0)} stats/sec`));
  console.log(chalk.yellow(`⏱️  Total time: ${totalTime.toFixed(1)} seconds`));
  
  if (gamesProcessed > 0) {
    console.log(chalk.blue(`📊 Average stats per game: ${(totalStats / gamesProcessed).toFixed(1)}`));
  }
}

collectTargetedNCAAHockeyStats()
  .then(() => {
    console.log(chalk.cyan('\n✅ NCAA Hockey collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });