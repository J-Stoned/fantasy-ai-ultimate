#!/usr/bin/env tsx
/**
 * 🏀🏒 NBA & NHL 2021-22 SEQUENTIAL COLLECTOR
 * 
 * Proper order: Teams → Games → Players → Stats
 * Optimized for Ryzen 5 7600X + 32GB RAM
 */

import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting
const limit = pLimit(50); // 50 concurrent requests

// Status mapping
const STATUS_MAP: Record<string, string> = {
  'STATUS_FINAL': 'Final',
  'Final': 'Final',
  'completed': 'Final',
  'final': 'Final',
  'STATUS_SCHEDULED': 'scheduled',
  'Scheduled': 'scheduled',
  'scheduled': 'scheduled',
  'STATUS_POSTPONED': 'STATUS_POSTPONED',
  'STATUS_CANCELED': 'STATUS_CANCELED'
};

function normalizeStatus(espnStatus: string | undefined, homeScore?: number, awayScore?: number): string {
  if ((homeScore !== undefined && homeScore > 0) || (awayScore !== undefined && awayScore > 0)) {
    return 'Final';
  }
  
  if (espnStatus) {
    return STATUS_MAP[espnStatus] || espnStatus;
  }
  
  return 'scheduled';
}

// Step 1: Collect Teams
async function collectTeams(sport: 'NBA' | 'NHL') {
  console.log(chalk.cyan(`\n📋 COLLECTING ${sport} TEAMS...`));
  
  const teams = [];
  const espnSport = sport === 'NBA' ? 'basketball/nba' : 'hockey/nhl';
  
  try {
    // Get all teams from ESPN
    const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams`;
    const response = await axios.get(url);
    
    if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
      const espnTeams = response.data.sports[0].leagues[0].teams;
      
      for (const team of espnTeams) {
        teams.push({
          external_id: `espn_${sport.toLowerCase()}_${team.team.id}`,
          name: team.team.displayName,
          abbreviation: team.team.abbreviation,
          sport: sport,
          metadata: {
            location: team.team.location,
            color: team.team.color,
            logo: team.team.logos?.[0]?.href,
            conference: team.team.groups?.id,
            division: team.team.groups?.parent?.id
          }
        });
      }
    }
    
    console.log(chalk.blue(`  Found ${teams.length} ${sport} teams`));
    
    // Insert teams
    if (teams.length > 0) {
      const { data, error } = await supabase
        .from('teams')
        .upsert(teams, { onConflict: 'external_id' })
        .select();
      
      if (error) {
        console.error(chalk.red('Error inserting teams:'), error);
      } else {
        console.log(chalk.green(`  ✅ Inserted/Updated ${data?.length || 0} teams`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`Error collecting ${sport} teams:`), error);
  }
  
  return teams.length;
}

// Step 2: Collect Games
async function collectGames(sport: 'NBA' | 'NHL', startDate: string, endDate: string) {
  console.log(chalk.cyan(`\n📅 COLLECTING ${sport} GAMES...`));
  console.log(chalk.gray(`  Date range: ${startDate} to ${endDate}`));
  
  // First, load teams into memory
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', sport);
  
  const teamMap = new Map<string, number>();
  teams?.forEach(team => {
    teamMap.set(team.external_id, team.id);
  });
  
  console.log(chalk.blue(`  Loaded ${teamMap.size} teams into cache`));
  
  const games = [];
  const dates = [];
  
  // Generate all dates
  const currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);
  
  while (currentDate <= endDateObj) {
    dates.push(currentDate.toISOString().slice(0, 10).replace(/-/g, ''));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(chalk.yellow(`  Processing ${dates.length} days...`));
  
  // Process in batches of 50 days
  const batchSize = 50;
  let processedDays = 0;
  
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    
    const batchGames = await Promise.all(
      batch.map(dateStr => 
        limit(async () => {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.toLowerCase() === 'nba' ? 'basketball/nba' : 'hockey/nhl'}/scoreboard?dates=${dateStr}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            const dayGames = [];
            
            if (response.data.events) {
              for (const event of response.data.events) {
                if (event.competitions?.[0]) {
                  const competition = event.competitions[0];
                  const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
                  const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
                  
                  if (homeTeam && awayTeam) {
                    const homeTeamId = teamMap.get(`espn_${sport.toLowerCase()}_${homeTeam.team.id}`);
                    const awayTeamId = teamMap.get(`espn_${sport.toLowerCase()}_${awayTeam.team.id}`);
                    
                    if (homeTeamId && awayTeamId) {
                      dayGames.push({
                        external_id: `espn_${sport.toLowerCase()}_${event.id}`,
                        sport: sport,
                        start_time: event.date,
                        status: normalizeStatus(
                          event.status?.type?.name,
                          parseInt(homeTeam.score) || 0,
                          parseInt(awayTeam.score) || 0
                        ),
                        home_team_id: homeTeamId,
                        away_team_id: awayTeamId,
                        home_score: parseInt(homeTeam.score) || 0,
                        away_score: parseInt(awayTeam.score) || 0,
                        metadata: {
                          venue: competition.venue?.fullName,
                          attendance: competition.attendance,
                          broadcast: competition.broadcasts?.[0]?.names?.[0],
                          season_type: event.season?.type === 2 ? 'regular' : 'playoffs'
                        }
                      });
                    }
                  }
                }
              }
            }
            
            return dayGames;
          } catch (error: any) {
            console.error(chalk.red(`Error on ${dateStr}:`), error.message);
            return [];
          }
        })
      )
    );
    
    games.push(...batchGames.flat());
    processedDays += batch.length;
    
    console.log(chalk.gray(`    Processed ${processedDays}/${dates.length} days (${games.length} games found)`));
  }
  
  // Remove duplicates
  const uniqueGames = Array.from(
    new Map(games.map(game => [game.external_id, game])).values()
  );
  
  console.log(chalk.blue(`  Found ${uniqueGames.length} unique games (from ${games.length} total)`));
  
  // Insert games in batches
  if (uniqueGames.length > 0) {
    const insertBatchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < uniqueGames.length; i += insertBatchSize) {
      const batch = uniqueGames.slice(i, i + insertBatchSize);
      
      const { data, error } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'external_id' })
        .select();
      
      if (error) {
        console.error(chalk.red('Insert error:'), error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`  ✅ Inserted ${inserted} games`));
  }
  
  return uniqueGames.length;
}

// Step 3: Collect Players
async function collectPlayers(sport: 'NBA' | 'NHL', year: number) {
  console.log(chalk.cyan(`\n👥 COLLECTING ${sport} PLAYERS...`));
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', sport);
  
  if (!teams || teams.length === 0) {
    console.log(chalk.red('No teams found!'));
    return 0;
  }
  
  const players = [];
  const espnSport = sport === 'NBA' ? 'basketball/nba' : 'hockey/nhl';
  
  // Collect roster for each team
  for (const team of teams) {
    const espnTeamId = team.external_id.split('_').pop();
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${espnTeamId}/roster?season=${year}`;
      const response = await limit(() => axios.get(url, { timeout: 10000 }));
      
      if (response.data.athletes) {
        for (const athlete of response.data.athletes) {
          players.push({
            external_id: `espn_${sport.toLowerCase()}_${athlete.id}`,
            name: athlete.displayName || athlete.fullName,
            position: athlete.position?.abbreviation,
            team_id: team.id,
            sport: sport,
            jersey_number: athlete.jersey,
            metadata: {
              height: athlete.height,
              weight: athlete.weight,
              age: athlete.age,
              experience: athlete.experience?.years,
              college: athlete.college?.name,
              birthPlace: athlete.birthPlace,
              status: athlete.status?.type
            }
          });
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error collecting roster for team ${espnTeamId}:`), error.message);
    }
  }
  
  console.log(chalk.blue(`  Found ${players.length} players`));
  
  // Insert players in batches
  if (players.length > 0) {
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('players')
        .upsert(batch, { onConflict: 'external_id' })
        .select();
      
      if (error) {
        console.error(chalk.red('Insert error:'), error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`  ✅ Inserted ${inserted} players`));
  }
  
  return players.length;
}

// Step 4: Collect Stats
async function collectStats(sport: 'NBA' | 'NHL', startDate: string, endDate: string) {
  console.log(chalk.cyan(`\n📊 COLLECTING ${sport} STATS...`));
  
  // Load players into cache
  const { data: players } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', sport);
  
  const playerMap = new Map<string, number>();
  players?.forEach(player => {
    playerMap.set(player.external_id, player.id);
  });
  
  console.log(chalk.blue(`  Loaded ${playerMap.size} players into cache`));
  
  // Get games to collect stats for
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', sport)
    .eq('status', 'Final')
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time');
  
  if (!games || games.length === 0) {
    console.log(chalk.yellow('No games found for stats collection'));
    return 0;
  }
  
  console.log(chalk.blue(`  Processing stats for ${games.length} games...`));
  
  const allStats = [];
  const batchSize = 50;
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    
    const batchStats = await Promise.all(
      batch.map(game => 
        limit(async () => {
          const espnGameId = game.external_id.split('_').pop();
          
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.toLowerCase() === 'nba' ? 'basketball/nba' : 'hockey/nhl'}/summary?event=${espnGameId}`;
            const response = await axios.get(url, { timeout: 15000 });
            
            const gameStats = [];
            
            if (response.data.boxscore?.players) {
              for (const team of response.data.boxscore.players) {
                for (const statGroup of team.statistics || []) {
                  for (const athlete of statGroup.athletes || []) {
                    if (!athlete.athlete?.id) continue;
                    
                    const playerId = playerMap.get(`espn_${sport.toLowerCase()}_${athlete.athlete.id}`);
                    
                    if (playerId && athlete.stats?.length > 0) {
                      const stats = transformStats(athlete.stats, sport, statGroup.name);
                      
                      if (Object.keys(stats).length > 0) {
                        gameStats.push({
                          player_id: playerId,
                          game_id: game.id,
                          game_date: new Date().toISOString().split('T')[0],
                          is_home: team.homeAway === 'home',
                          stats: stats,
                          fantasy_points: calculateFantasyPoints(stats, sport),
                          metadata: { season: '2021-22' }
                        });
                      }
                    }
                  }
                }
              }
            }
            
            return gameStats;
          } catch (error: any) {
            if (error.message !== 'Request failed with status code 404') {
              console.error(chalk.red(`Error for game ${espnGameId}:`), error.message);
            }
            return [];
          }
        })
      )
    );
    
    allStats.push(...batchStats.flat());
    
    console.log(chalk.gray(`    Processed ${i + batch.length}/${games.length} games (${allStats.length} stats collected)`));
  }
  
  // Insert stats in batches
  if (allStats.length > 0) {
    console.log(chalk.blue(`  Inserting ${allStats.length} stat records...`));
    
    const insertBatchSize = 1000;
    let inserted = 0;
    
    for (let i = 0; i < allStats.length; i += insertBatchSize) {
      const batch = allStats.slice(i, i + insertBatchSize);
      
      const { data, error } = await supabase
        .from('player_game_logs')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(chalk.red('Stats insert error:'), error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`  ✅ Inserted ${inserted} stats`));
  }
  
  return allStats.length;
}

function transformStats(espnStats: any[], sport: string, statType: string): any {
  const stats: any = {};
  
  if (sport === 'NBA') {
    const statLabels = ['MIN', 'FG', 'FGA', 'FG%', '3P', '3PA', '3P%', 'FT', 'FTA', 'FT%', 
                       'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'PTS'];
    
    espnStats.forEach((value, index) => {
      const label = statLabels[index];
      if (label && value !== null && value !== undefined) {
        switch(label) {
          case 'MIN': stats.minutes_played = parseFloat(value) || 0; break;
          case 'PTS': stats.points = parseInt(value) || 0; break;
          case 'REB': stats.rebounds = parseInt(value) || 0; break;
          case 'AST': stats.assists = parseInt(value) || 0; break;
          case 'STL': stats.steals = parseInt(value) || 0; break;
          case 'BLK': stats.blocks = parseInt(value) || 0; break;
          case 'TO': stats.turnovers = parseInt(value) || 0; break;
          case 'FG': stats.field_goals_made = parseInt(value) || 0; break;
          case 'FGA': stats.field_goals_attempted = parseInt(value) || 0; break;
        }
      }
    });
  } else if (sport === 'NHL') {
    if (statType === 'skaters') {
      const skaterLabels = ['G', 'A', 'PTS', '+/-', 'S', 'PPG', 'PPA', 'SHG', 'SHA', 'GWG', 'SOG', 'PIM', 'TOI'];
      
      espnStats.forEach((value, index) => {
        const label = skaterLabels[index];
        if (label && value !== null && value !== undefined) {
          switch(label) {
            case 'G': stats.goals = parseInt(value) || 0; break;
            case 'A': stats.assists = parseInt(value) || 0; break;
            case 'PTS': stats.points = parseInt(value) || 0; break;
            case 'SOG': stats.shots_on_goal = parseInt(value) || 0; break;
            case 'PIM': stats.penalty_minutes = parseInt(value) || 0; break;
          }
        }
      });
    }
  }
  
  return stats;
}

function calculateFantasyPoints(stats: any, sport: string): number {
  let points = 0;
  
  if (sport === 'NBA') {
    points = (stats.points || 0) + 
             (stats.rebounds || 0) * 1.2 + 
             (stats.assists || 0) * 1.5 + 
             (stats.steals || 0) * 3 + 
             (stats.blocks || 0) * 3 - 
             (stats.turnovers || 0);
  } else if (sport === 'NHL') {
    points = (stats.goals || 0) * 3 + 
             (stats.assists || 0) * 2 + 
             (stats.shots_on_goal || 0) * 0.5 - 
             (stats.penalty_minutes || 0) * 0.5;
  }
  
  return Math.max(0, points);
}

async function main() {
  console.log(chalk.red('\n🔥 NBA & NHL 2021-22 SEQUENTIAL COLLECTOR'));
  console.log(chalk.yellow('📋 Proper order: Teams → Games → Players → Stats'));
  console.log(chalk.yellow('🚀 Optimized for Ryzen 5 7600X + 32GB RAM\n'));
  
  const startTime = Date.now();
  
  // Define date ranges
  const nbaDateRange = { start: '2021-10-19', end: '2022-06-17' };
  const nhlDateRange = { start: '2021-10-12', end: '2022-06-26' };
  
  try {
    // Step 1: Collect Teams
    console.log(chalk.cyan('STEP 1: COLLECTING TEAMS'));
    const [nbaTeams, nhlTeams] = await Promise.all([
      collectTeams('NBA'),
      collectTeams('NHL')
    ]);
    
    // Step 2: Collect Games
    console.log(chalk.cyan('\nSTEP 2: COLLECTING GAMES'));
    const [nbaGames, nhlGames] = await Promise.all([
      collectGames('NBA', nbaDateRange.start, nbaDateRange.end),
      collectGames('NHL', nhlDateRange.start, nhlDateRange.end)
    ]);
    
    // Step 3: Collect Players
    console.log(chalk.cyan('\nSTEP 3: COLLECTING PLAYERS'));
    const [nbaPlayers, nhlPlayers] = await Promise.all([
      collectPlayers('NBA', 2022),
      collectPlayers('NHL', 2022)
    ]);
    
    // Step 4: Collect Stats
    console.log(chalk.cyan('\nSTEP 4: COLLECTING STATS'));
    const [nbaStats, nhlStats] = await Promise.all([
      collectStats('NBA', nbaDateRange.start, nbaDateRange.end),
      collectStats('NHL', nhlDateRange.start, nhlDateRange.end)
    ]);
    
    // Final verification
    console.log(chalk.cyan('\n📊 FINAL VERIFICATION:'));
    
    const { data: nbaFinal } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NBA')
      .eq('status', 'Final')
      .gte('start_time', '2021-10-01')
      .lt('start_time', '2022-07-01');
    
    const { data: nhlFinal } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NHL')
      .eq('status', 'Final')
      .gte('start_time', '2021-10-01')
      .lt('start_time', '2022-07-01');
    
    console.log(chalk.green(`\nNBA Results:`));
    console.log(chalk.green(`  Teams: ${nbaTeams}`));
    console.log(chalk.green(`  Games: ${nbaGames}`));
    console.log(chalk.green(`  Players: ${nbaPlayers}`));
    console.log(chalk.green(`  Stats: ${nbaStats}`));
    console.log(chalk.green(`  Final games: ${nbaFinal?.length || 0}`));
    
    console.log(chalk.green(`\nNHL Results:`));
    console.log(chalk.green(`  Teams: ${nhlTeams}`));
    console.log(chalk.green(`  Games: ${nhlGames}`));
    console.log(chalk.green(`  Players: ${nhlPlayers}`));
    console.log(chalk.green(`  Stats: ${nhlStats}`));
    console.log(chalk.green(`  Final games: ${nhlFinal?.length || 0}`));
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.cyan(`\n⏱️  Total time: ${elapsedSeconds} seconds`));
    
    console.log(chalk.green('\n🎯 Collection complete!'));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });