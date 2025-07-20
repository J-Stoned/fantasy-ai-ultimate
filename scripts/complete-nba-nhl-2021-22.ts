#!/usr/bin/env tsx
/**
 * 🏀🏒 COMPLETE NBA PLAYERS & NHL STATS COLLECTOR
 * 
 * Fixes the missing pieces:
 * - Collects ALL NBA players for 2021-22
 * - Collects ALL NHL players for 2021-22
 * - Then collects stats for BOTH leagues
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

const limit = pLimit(25); // 25 concurrent requests

// Collect ALL players for a sport
async function collectAllPlayers(sport: 'NBA' | 'NHL') {
  console.log(chalk.cyan(`\n👥 COLLECTING ALL ${sport} PLAYERS FOR 2021-22...`));
  
  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', sport);
  
  if (!teams || teams.length === 0) {
    console.log(chalk.red(`No ${sport} teams found!`));
    return 0;
  }
  
  console.log(chalk.blue(`Found ${teams.length} ${sport} teams`));
  
  const allPlayers = [];
  const espnSport = sport === 'NBA' ? 'basketball/nba' : 'hockey/nhl';
  
  // Process teams in parallel
  const teamPromises = teams.map(team => 
    limit(async () => {
      const espnTeamId = team.external_id.split('_').pop();
      
      try {
        // Try both 2021 and 2022 seasons to get more complete rosters
        const urls = [
          `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${espnTeamId}/roster?season=2022`,
          `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${espnTeamId}/roster?season=2021`
        ];
        
        for (const url of urls) {
          try {
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data.athletes) {
              const teamPlayers = [];
              
              for (const athlete of response.data.athletes) {
                const player = {
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
                    status: athlete.status?.type,
                    headshot: athlete.headshot?.href
                  }
                };
                
                // Check if we already have this player
                const exists = allPlayers.some(p => p.external_id === player.external_id);
                if (!exists) {
                  teamPlayers.push(player);
                }
              }
              
              allPlayers.push(...teamPlayers);
              
              if (teamPlayers.length > 0) {
                console.log(chalk.gray(`  ${team.name}: ${teamPlayers.length} players`));
                break; // Got players, don't need to try other season
              }
            }
          } catch (err) {
            // Try next URL
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`Error collecting ${team.name}:`), error.message);
      }
    })
  );
  
  await Promise.all(teamPromises);
  
  console.log(chalk.blue(`\nTotal ${sport} players found: ${allPlayers.length}`));
  
  // Insert all players
  if (allPlayers.length > 0) {
    console.log(chalk.blue(`Inserting ${sport} players...`));
    
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < allPlayers.length; i += batchSize) {
      const batch = allPlayers.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('players')
        .upsert(batch, { 
          onConflict: 'external_id',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) {
        console.error(chalk.red('Insert error:'), error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`✅ Inserted/Updated ${inserted} ${sport} players`));
  }
  
  return allPlayers.length;
}

// Collect stats for all games
async function collectAllStats(sport: 'NBA' | 'NHL', startDate: string, endDate: string) {
  console.log(chalk.cyan(`\n📊 COLLECTING ALL ${sport} STATS...`));
  
  // Load ALL players into cache
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', sport);
  
  if (playersError) {
    console.error(chalk.red('Error loading players:'), playersError);
    return 0;
  }
  
  const playerMap = new Map<string, number>();
  players?.forEach(player => {
    playerMap.set(player.external_id, player.id);
  });
  
  console.log(chalk.blue(`  Loaded ${playerMap.size} ${sport} players into cache`));
  
  // Get ALL games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .eq('sport', sport)
    .eq('status', 'Final')
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time');
  
  if (gamesError || !games || games.length === 0) {
    console.log(chalk.yellow('No games found for stats collection'));
    return 0;
  }
  
  console.log(chalk.blue(`  Processing stats for ${games.length} games...`));
  
  const allStats = [];
  const batchSize = 25;
  let processed = 0;
  
  // Process games in batches
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
            const gameDate = new Date(game.start_time).toISOString().split('T')[0];
            
            if (response.data.boxscore?.players) {
              for (const team of response.data.boxscore.players) {
                const isHome = team.homeAway === 'home';
                const teamId = isHome ? game.home_team_id : game.away_team_id;
                
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
                          team_id: teamId,
                          game_date: gameDate,
                          is_home: isHome,
                          stats: stats,
                          fantasy_points: calculateFantasyPoints(stats, sport),
                          metadata: { 
                            season: '2021-22',
                            athlete_name: athlete.athlete.displayName
                          }
                        });
                      }
                    }
                  }
                }
              }
            }
            
            return gameStats;
          } catch (error: any) {
            if (error.response?.status !== 404) {
              console.error(chalk.red(`Error for game ${espnGameId}:`), error.message);
            }
            return [];
          }
        })
      )
    );
    
    const flatStats = batchStats.flat();
    allStats.push(...flatStats);
    
    processed += batch.length;
    console.log(chalk.gray(`    Processed ${processed}/${games.length} games (${allStats.length} stats collected)`));
  }
  
  // Insert all stats, skipping duplicates
  if (allStats.length > 0) {
    console.log(chalk.blue(`  Inserting ${allStats.length} stat records...`));
    
    const insertBatchSize = 500;
    let inserted = 0;
    let skipped = 0;
    
    for (let i = 0; i < allStats.length; i += insertBatchSize) {
      const batch = allStats.slice(i, i + insertBatchSize);
      
      // Insert one by one to handle duplicates
      for (const stat of batch) {
        const { data, error } = await supabase
          .from('player_game_logs')
          .insert(stat)
          .select();
        
        if (error) {
          if (error.code === '23505') { // Duplicate key
            skipped++;
          } else {
            console.error(chalk.red('Stats insert error:'), error);
          }
        } else {
          inserted += data?.length || 0;
        }
      }
    }
    
    console.log(chalk.green(`  ✅ Inserted ${inserted} new stats (${skipped} already existed)`));
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
      if (label && value !== null && value !== undefined && value !== '') {
        switch(label) {
          case 'MIN': 
            const minParts = value.toString().split(':');
            stats.minutes_played = minParts.length > 1 
              ? parseInt(minParts[0]) + (parseInt(minParts[1]) / 60)
              : parseFloat(value) || 0;
            break;
          case 'PTS': stats.points = parseInt(value) || 0; break;
          case 'REB': stats.rebounds = parseInt(value) || 0; break;
          case 'AST': stats.assists = parseInt(value) || 0; break;
          case 'STL': stats.steals = parseInt(value) || 0; break;
          case 'BLK': stats.blocks = parseInt(value) || 0; break;
          case 'TO': stats.turnovers = parseInt(value) || 0; break;
          case 'FG': stats.field_goals_made = parseInt(value) || 0; break;
          case 'FGA': stats.field_goals_attempted = parseInt(value) || 0; break;
          case '3P': stats.three_pointers_made = parseInt(value) || 0; break;
          case '3PA': stats.three_pointers_attempted = parseInt(value) || 0; break;
          case 'FT': stats.free_throws_made = parseInt(value) || 0; break;
          case 'FTA': stats.free_throws_attempted = parseInt(value) || 0; break;
          case 'OREB': stats.offensive_rebounds = parseInt(value) || 0; break;
          case 'DREB': stats.defensive_rebounds = parseInt(value) || 0; break;
          case 'PF': stats.personal_fouls = parseInt(value) || 0; break;
        }
      }
    });
  } else if (sport === 'NHL') {
    if (statType === 'skaters') {
      const skaterLabels = ['G', 'A', 'PTS', '+/-', 'S', 'PPG', 'PPA', 'SHG', 'SHA', 'GWG', 'SOG', 'PIM', 'TOI'];
      
      espnStats.forEach((value, index) => {
        const label = skaterLabels[index];
        if (label && value !== null && value !== undefined && value !== '') {
          switch(label) {
            case 'G': stats.goals = parseInt(value) || 0; break;
            case 'A': stats.assists = parseInt(value) || 0; break;
            case 'PTS': stats.points = parseInt(value) || 0; break;
            case 'SOG': stats.shots_on_goal = parseInt(value) || 0; break;
            case 'S': stats.shots = parseInt(value) || 0; break;
            case 'PIM': stats.penalty_minutes = parseInt(value) || 0; break;
            case 'TOI': stats.time_on_ice = value.toString(); break;
            case '+/-': stats.plus_minus = parseInt(value) || 0; break;
            case 'PPG': stats.power_play_goals = parseInt(value) || 0; break;
            case 'PPA': stats.power_play_assists = parseInt(value) || 0; break;
            case 'SHG': stats.short_handed_goals = parseInt(value) || 0; break;
            case 'GWG': stats.game_winning_goals = parseInt(value) || 0; break;
          }
        }
      });
    } else if (statType === 'goalies') {
      const goalieLabels = ['SA', 'GA', 'SV', 'SV%', 'MIN'];
      
      espnStats.forEach((value, index) => {
        const label = goalieLabels[index];
        if (label && value !== null && value !== undefined && value !== '') {
          switch(label) {
            case 'SA': stats.shots_against = parseInt(value) || 0; break;
            case 'GA': stats.goals_against = parseInt(value) || 0; break;
            case 'SV': stats.saves = parseInt(value) || 0; break;
            case 'MIN': stats.minutes_played = parseFloat(value) || 0; break;
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
    // Skater scoring
    if (stats.goals !== undefined) {
      points = (stats.goals || 0) * 3 + 
               (stats.assists || 0) * 2 + 
               (stats.shots_on_goal || 0) * 0.5 + 
               (stats.blocks || 0) * 0.5 -
               (stats.penalty_minutes || 0) * 0.5;
    }
    // Goalie scoring
    else if (stats.saves !== undefined) {
      points = (stats.saves || 0) * 0.2 + 
               (stats.wins || 0) * 5 - 
               (stats.goals_against || 0) * 2;
    }
  }
  
  return Math.max(0, points);
}

async function main() {
  console.log(chalk.red('\n🔥 COMPLETE NBA & NHL 2021-22 COLLECTOR'));
  console.log(chalk.yellow('📋 Collecting ALL players and stats'));
  console.log(chalk.yellow('🚀 Optimized for Ryzen 5 7600X + 32GB RAM\n'));
  
  const startTime = Date.now();
  
  // Define date ranges
  const nbaDateRange = { start: '2021-10-19', end: '2022-06-17' };
  const nhlDateRange = { start: '2021-10-12', end: '2022-06-26' };
  
  try {
    // Step 1: Collect ALL players for both leagues
    console.log(chalk.cyan('STEP 1: COLLECTING ALL PLAYERS'));
    const [nbaPlayers, nhlPlayers] = await Promise.all([
      collectAllPlayers('NBA'),
      collectAllPlayers('NHL')
    ]);
    
    // Step 2: Collect ALL stats
    console.log(chalk.cyan('\nSTEP 2: COLLECTING ALL STATS'));
    const [nbaStats, nhlStats] = await Promise.all([
      collectAllStats('NBA', nbaDateRange.start, nbaDateRange.end),
      collectAllStats('NHL', nhlDateRange.start, nhlDateRange.end)
    ]);
    
    // Final verification
    console.log(chalk.cyan('\n📊 FINAL VERIFICATION:'));
    
    const { data: nbaPlayerCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('sport', 'NBA');
    
    const { data: nhlPlayerCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('sport', 'NHL');
    
    const { data: nbaStatCount } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true })
      .eq('metadata->>season', '2021-22')
      .in('player_id', (await supabase.from('players').select('id').eq('sport', 'NBA')).data?.map(p => p.id) || []);
    
    const { data: nhlStatCount } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true })
      .eq('metadata->>season', '2021-22')
      .in('player_id', (await supabase.from('players').select('id').eq('sport', 'NHL')).data?.map(p => p.id) || []);
    
    console.log(chalk.green(`\nNBA Results:`));
    console.log(chalk.green(`  Players collected: ${nbaPlayers}`));
    console.log(chalk.green(`  Total NBA players in DB: ${nbaPlayerCount}`));
    console.log(chalk.green(`  Stats collected: ${nbaStats}`));
    console.log(chalk.green(`  Total NBA stats in DB: ${nbaStatCount}`));
    
    console.log(chalk.green(`\nNHL Results:`));
    console.log(chalk.green(`  Players collected: ${nhlPlayers}`));
    console.log(chalk.green(`  Total NHL players in DB: ${nhlPlayerCount}`));
    console.log(chalk.green(`  Stats collected: ${nhlStats}`));
    console.log(chalk.green(`  Total NHL stats in DB: ${nhlStatCount}`));
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.cyan(`\n⏱️  Total time: ${elapsedSeconds} seconds`));
    
    console.log(chalk.green('\n🎯 COMPLETE! All NBA and NHL data collected!'));
    
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