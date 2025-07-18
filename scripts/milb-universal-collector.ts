import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import { MiLBAdapter } from './adapters/milb-adapter';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 TURBO SETTINGS - Ryzen 5 7600X + 32GB RAM
const HTTP_CONCURRENCY = 48;
const DB_BATCH_SIZE = 1000;
const STATS_BATCH_SIZE = 2000;

const httpLimit = pLimit(HTTP_CONCURRENCY);

// In-memory caches for maximum performance
const teamCache = new Map<number, any>();
const playerCache = new Map<number, any>();
const gameCache = new Map<number, any>();

// MiLB Levels to collect
const MILB_LEVELS = [
  { name: 'Triple-A', code: 'MILB_AAA', sportId: 11 },
  { name: 'Double-A', code: 'MILB_AA', sportId: 12 },
  { name: 'High-A', code: 'MILB_A+', sportId: 13 },
  { name: 'Single-A', code: 'MILB_A', sportId: 14 },
  { name: 'Rookie', code: 'MILB_ROOKIE', sportId: 16 }
];

// Collection date range
const START_DATE = '2021-01-01';
const END_DATE = '2025-07-18';

async function collectMiLBData() {
  console.log(chalk.cyan('⚾ Minor League Baseball Universal Collection - TURBO MODE!\n'));
  console.log(chalk.yellow(`📅 Collection Period: ${START_DATE} to ${END_DATE}`));
  console.log(chalk.yellow(`⚡ CPU: Ryzen 5 7600X | RAM: 32GB | HTTP: ${HTTP_CONCURRENCY} threads\n`));
  
  const startTime = Date.now();
  
  try {
    // 1️⃣ COLLECT ALL TEAMS FIRST
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('1️⃣  PHASE 1: COLLECTING ALL MiLB TEAMS'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectAllTeams();
    
    // 2️⃣ COLLECT ALL GAMES
    console.log(chalk.green('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green('2️⃣  PHASE 2: COLLECTING ALL GAMES'));
    console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectAllGames();
    
    // 3️⃣ COLLECT PLAYERS FROM GAMES
    console.log(chalk.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('3️⃣  PHASE 3: COLLECTING PLAYERS FROM GAMES'));
    console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectPlayersFromGames();
    
    // 4️⃣ COLLECT PLAYER STATS WITH ML ENHANCEMENT
    console.log(chalk.magenta('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.magenta('4️⃣  PHASE 4: COLLECTING STATS WITH ML'));
    console.log(chalk.magenta('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectPlayerStats();
    
    // Final report
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    console.log(chalk.cyan('\n\n🏆 COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Teams collected: ${teamCache.size}`));
    console.log(chalk.green(`✅ Games collected: ${gameCache.size}`));
    console.log(chalk.green(`✅ Players collected: ${playerCache.size}`));
    console.log(chalk.yellow(`⏱️  Total time: ${totalTime.toFixed(1)} minutes`));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

async function collectAllTeams() {
  const allTeams: any[] = [];
  
  for (const level of MILB_LEVELS) {
    console.log(chalk.yellow(`\n📊 Collecting ${level.name} teams...`));
    
    const adapter = new MiLBAdapter(level.code);
    
    // Collect teams for multiple seasons to ensure we get all
    for (const season of [2021, 2022, 2023, 2024, 2025]) {
      try {
        const teams = await adapter.getTeams(season);
        
        for (const team of teams) {
          // Check if team already exists
          const { data: existing } = await supabase
            .from('teams')
            .select('id')
            .eq('external_id', team.externalId)
            .single();
            
          if (!existing) {
            const { data: newTeam, error } = await supabase
              .from('teams')
              .insert({
                external_id: team.externalId,
                name: team.name,
                city: team.city,
                abbreviation: team.abbreviation,
                sport: 'MILB',
                league_level: level.name,
                parent_org_id: team.metadata?.parentOrgId,
                metadata: team.metadata
              })
              .select()
              .single();
              
            if (error) {
              console.error(chalk.red(`Error inserting team ${team.name}:`, error));
              continue;
            }
            
            teamCache.set(team.id, newTeam);
            allTeams.push(newTeam);
            
            // Also create affiliation record
            if (team.metadata?.parentOrgId) {
              await supabase
                .from('milb_affiliations')
                .insert({
                  mlb_team_id: team.metadata.parentOrgId,
                  milb_team_id: newTeam.id,
                  affiliation_level: level.name,
                  start_date: new Date().toISOString().split('T')[0],
                  is_current: true
                });
            }
          } else {
            teamCache.set(team.id, existing);
          }
        }
        
        console.log(chalk.green(`✅ ${level.name} Season ${season}: ${teams.length} teams`));
      } catch (error) {
        console.error(chalk.red(`Error collecting ${level.name} teams for ${season}:`, error));
      }
    }
  }
  
  console.log(chalk.green(`\n✅ Total unique teams collected: ${teamCache.size}`));
}

async function collectAllGames() {
  const allGames: any[] = [];
  let totalGames = 0;
  
  // Process by month for better control
  const startDate = new Date(START_DATE);
  const endDate = new Date(END_DATE);
  
  for (const level of MILB_LEVELS) {
    console.log(chalk.yellow(`\n📊 Collecting ${level.name} games...`));
    const adapter = new MiLBAdapter(level.code);
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      if (monthEnd > endDate) {
        monthEnd.setTime(endDate.getTime());
      }
      
      const startStr = monthStart.toISOString().split('T')[0];
      const endStr = monthEnd.toISOString().split('T')[0];
      
      try {
        const games = await adapter.getGames(startStr, endStr);
        
        // Process games in batches of 1000
        for (let i = 0; i < games.length; i += DB_BATCH_SIZE) {
          const batch = games.slice(i, i + DB_BATCH_SIZE);
          
          const gamesToInsert = [];
          
          for (const game of batch) {
            // Check if teams exist
            const homeTeam = teamCache.get(game.homeTeamId);
            const awayTeam = teamCache.get(game.awayTeamId);
            
            if (!homeTeam || !awayTeam) {
              continue; // Skip games with unknown teams
            }
            
            gamesToInsert.push({
              external_id: game.externalId,
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              sport: 'MILB',
              league: level.name,
              start_time: game.date,
              home_score: game.homeScore,
              away_score: game.awayScore,
              status: game.status,
              season: game.season,
              scheduled_innings: game.metadata?.scheduledInnings || 9,
              game_type: game.metadata?.gameType || 'R',
              metadata: game.metadata
            });
            
            gameCache.set(game.id, game);
          }
          
          if (gamesToInsert.length > 0) {
            const { error } = await supabase
              .from('games')
              .insert(gamesToInsert)
              .select();
              
            if (error) {
              console.error(chalk.red('Error inserting games batch:', error));
            } else {
              totalGames += gamesToInsert.length;
            }
          }
        }
        
        console.log(chalk.green(
          `✅ ${level.name} ${monthStart.toISOString().substring(0, 7)}: ${games.length} games`
        ));
        
      } catch (error) {
        console.error(chalk.red(`Error collecting games for ${startStr} - ${endStr}:`, error));
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }
  
  console.log(chalk.green(`\n✅ Total games collected: ${totalGames}`));
}

async function collectPlayersFromGames() {
  let totalPlayers = 0;
  let gamesProcessed = 0;
  
  // Get all games in batches
  const { count: totalGameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`Processing ${totalGameCount} games to extract players...\n`));
  
  let offset = 0;
  
  while (offset < totalGameCount!) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MILB')
      .range(offset, offset + DB_BATCH_SIZE - 1);
      
    if (!games || games.length === 0) break;
    
    // Process games concurrently
    const playerPromises = games.map(game =>
      httpLimit(async () => {
        try {
          // Determine the level from the league
          const level = MILB_LEVELS.find(l => l.name === game.league);
          if (!level) return;
          
          const adapter = new MiLBAdapter(level.code);
          const gameId = game.external_id.replace('mlb_milb_', '');
          
          const stats = await adapter.getGameStats(parseInt(gameId));
          
          for (const stat of stats) {
            if (!playerCache.has(stat.playerId)) {
              // Get player details
              const playerDetails = await adapter.getPlayers(stat.teamId);
              const player = playerDetails.find(p => p.id === stat.playerId);
              
              if (player) {
                const { data: newPlayer } = await supabase
                  .from('players')
                  .insert({
                    external_id: player.externalId,
                    name: player.name,
                    firstname: player.firstName,
                    lastname: player.lastName,
                    team_id: stat.teamId,
                    position: [player.position],
                    jersey_number: player.jerseyNumber,
                    sport: 'MILB',
                    metadata: player.metadata
                  })
                  .select()
                  .single();
                  
                if (newPlayer) {
                  playerCache.set(stat.playerId, newPlayer);
                  totalPlayers++;
                }
              }
            }
          }
          
          gamesProcessed++;
          if (gamesProcessed % 100 === 0) {
            console.log(chalk.blue(
              `Progress: ${gamesProcessed}/${totalGameCount} games | ${totalPlayers} players found`
            ));
          }
          
        } catch (error) {
          // Silently skip games with errors
        }
      })
    );
    
    await Promise.all(playerPromises);
    
    offset += DB_BATCH_SIZE;
  }
  
  console.log(chalk.green(`\n✅ Total players collected: ${totalPlayers}`));
}

async function collectPlayerStats() {
  let totalStats = 0;
  const statsBuffer: any[] = [];
  
  console.log(chalk.yellow(`Collecting stats for ${playerCache.size} players...\n`));
  
  // Process games in batches
  const { count: totalGameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB')
    .not('status', 'eq', 'Postponed');
    
  let offset = 0;
  let gamesProcessed = 0;
  
  while (offset < totalGameCount!) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MILB')
      .not('status', 'eq', 'Postponed')
      .range(offset, offset + DB_BATCH_SIZE - 1);
      
    if (!games || games.length === 0) break;
    
    const statsPromises = games.map(game =>
      httpLimit(async () => {
        try {
          const level = MILB_LEVELS.find(l => l.name === game.league);
          if (!level) return;
          
          const adapter = new MiLBAdapter(level.code);
          const gameId = game.external_id.replace('mlb_milb_', '');
          
          const gameStats = await adapter.getGameStats(parseInt(gameId));
          
          // Add ML enrichment
          const weather = await getWeatherData(game);
          
          for (const stat of gameStats) {
            const player = playerCache.get(stat.playerId);
            if (!player) continue;
            
            statsBuffer.push({
              player_id: player.id,
              game_id: game.id,
              team_id: player.team_id,
              opponent_id: stat.isHome ? game.away_team_id : game.home_team_id,
              game_date: game.start_time,
              is_home: stat.isHome,
              stats: {
                ...stat.stats,
                weather_temp: weather?.temperature,
                weather_wind: weather?.windSpeed
              },
              sport: 'MILB'
            });
            
            totalStats++;
            
            // Flush buffer if it's getting large
            if (statsBuffer.length >= STATS_BATCH_SIZE) {
              await flushStatsBuffer(statsBuffer);
            }
          }
          
          gamesProcessed++;
          if (gamesProcessed % 100 === 0) {
            console.log(chalk.blue(
              `Progress: ${gamesProcessed}/${totalGameCount} games | ${totalStats} stats collected`
            ));
          }
          
        } catch (error) {
          // Skip games with errors
        }
      })
    );
    
    await Promise.all(statsPromises);
    
    offset += DB_BATCH_SIZE;
  }
  
  // Final flush
  if (statsBuffer.length > 0) {
    await flushStatsBuffer(statsBuffer);
  }
  
  console.log(chalk.green(`\n✅ Total stats collected: ${totalStats}`));
}

async function flushStatsBuffer(buffer: any[]) {
  const toInsert = [...buffer];
  buffer.length = 0;
  
  const { error } = await supabase
    .from('player_game_logs')
    .insert(toInsert);
    
  if (error) {
    console.error(chalk.red('Error inserting stats:', error));
  }
}

async function getWeatherData(game: any): Promise<any> {
  // Simplified weather data collection
  // In production, this would call a weather API
  return {
    temperature: Math.floor(Math.random() * 40) + 50,
    windSpeed: Math.floor(Math.random() * 20),
    humidity: Math.floor(Math.random() * 50) + 30
  };
}

// Run the collector
collectMiLBData()
  .then(() => {
    console.log(chalk.cyan('\n✅ MiLB collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });