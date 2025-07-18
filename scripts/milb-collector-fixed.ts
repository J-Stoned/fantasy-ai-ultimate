import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import { MiLBAdapter } from './adapters/milb-adapter';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 TURBO SETTINGS
const HTTP_CONCURRENCY = 48;
const DB_BATCH_SIZE = 1000;

const httpLimit = pLimit(HTTP_CONCURRENCY);

// MiLB Levels
const MILB_LEVELS = [
  { name: 'Triple-A', code: 'MILB_AAA', sportId: 11 },
  { name: 'Double-A', code: 'MILB_AA', sportId: 12 },
  { name: 'High-A', code: 'MILB_A+', sportId: 13 },
  { name: 'Single-A', code: 'MILB_A', sportId: 14 },
  { name: 'Rookie', code: 'MILB_ROOKIE', sportId: 16 }
];

// Date range
const START_DATE = '2021-01-01';
const END_DATE = '2025-07-18';

// Track what we've inserted
const teamIdMap = new Map<string, number>(); // external_id -> internal_id
const gameIdMap = new Map<string, number>(); // external_id -> internal_id
const playerIdMap = new Map<string, number>(); // external_id -> internal_id

async function collectMiLBData() {
  console.log(chalk.cyan('⚾ MiLB Collection - FIXED VERSION\n'));
  console.log(chalk.yellow(`📅 Period: ${START_DATE} to ${END_DATE}`));
  console.log(chalk.yellow(`⚡ Settings: ${HTTP_CONCURRENCY} threads | ${DB_BATCH_SIZE} batch size\n`));
  
  const startTime = Date.now();
  
  try {
    // PHASE 1: TEAMS (Already done, but let's verify)
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('1️⃣  PHASE 1: VERIFYING TEAMS'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await loadExistingTeams();
    
    // PHASE 2: GAMES
    console.log(chalk.green('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green('2️⃣  PHASE 2: COLLECTING GAMES'));
    console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectAllGames();
    
    // PHASE 3: PLAYERS
    console.log(chalk.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('3️⃣  PHASE 3: COLLECTING PLAYERS'));
    console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectAllPlayers();
    
    // PHASE 4: STATS
    console.log(chalk.magenta('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.magenta('4️⃣  PHASE 4: COLLECTING STATS'));
    console.log(chalk.magenta('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    await collectAllStats();
    
    // Final report
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    console.log(chalk.cyan('\n\n🏆 COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Teams: ${teamIdMap.size}`));
    console.log(chalk.green(`✅ Games: ${gameIdMap.size}`));
    console.log(chalk.green(`✅ Players: ${playerIdMap.size}`));
    console.log(chalk.yellow(`⏱️  Total time: ${totalTime.toFixed(1)} minutes`));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

async function loadExistingTeams() {
  // Load all MiLB teams from database
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'MILB');
    
  if (error) {
    console.error(chalk.red('Error loading teams:'), error);
    return;
  }
  
  teams?.forEach(team => {
    teamIdMap.set(team.external_id, team.id);
  });
  
  console.log(chalk.green(`✅ Loaded ${teamIdMap.size} MiLB teams from database`));
}

async function collectAllGames() {
  // First, load existing games
  console.log(chalk.yellow('Loading existing MiLB games...'));
  const { data: existingGames } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MILB');
    
  existingGames?.forEach(game => {
    gameIdMap.set(game.external_id, game.id);
  });
  
  console.log(chalk.green(`✅ Found ${gameIdMap.size} existing MiLB games\n`));
  
  let totalGames = gameIdMap.size;
  let gamesSkipped = 0;
  
  // Process each level
  for (const level of MILB_LEVELS) {
    console.log(chalk.yellow(`\n📊 Collecting ${level.name} games...`));
    const adapter = new MiLBAdapter(level.code);
    
    // Process by month
    const startDate = new Date(START_DATE);
    const endDate = new Date(END_DATE);
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
        
        if (games.length > 0) {
          // Process in batches
          for (let i = 0; i < games.length; i += DB_BATCH_SIZE) {
            const batch = games.slice(i, i + DB_BATCH_SIZE);
            const gamesToInsert = [];
            
            for (const game of batch) {
              // Check if both teams exist in our map
              const homeTeamId = teamIdMap.get(`mlb_milb_${game.homeTeamId}`);
              const awayTeamId = teamIdMap.get(`mlb_milb_${game.awayTeamId}`);
              
              if (!homeTeamId || !awayTeamId) {
                gamesSkipped++;
                continue;
              }
              
              gamesToInsert.push({
                external_id: game.externalId,
                home_team_id: homeTeamId,
                away_team_id: awayTeamId,
                sport: 'MILB',
                league: level.name,
                start_time: game.date,
                home_score: game.homeScore,
                away_score: game.awayScore,
                status: game.status,
                scheduled_innings: game.metadata?.scheduledInnings || 9,
                actual_innings: game.metadata?.actualInnings,
                game_type: game.metadata?.gameType || 'R',
                doubleheader: game.metadata?.doubleheader || 0,
                metadata: {
                  ...game.metadata,
                  season: game.season // Store season in metadata instead
                }
              });
            }
            
            if (gamesToInsert.length > 0) {
              // Use upsert to handle duplicates
              const { data: insertedGames, error } = await supabase
                .from('games')
                .upsert(gamesToInsert, { 
                  onConflict: 'external_id',
                  ignoreDuplicates: false 
                })
                .select('id, external_id');
                
              if (error) {
                console.error(chalk.red(`Error inserting games:`, error.message));
              } else {
                insertedGames?.forEach(game => {
                  gameIdMap.set(game.external_id, game.id);
                });
                totalGames += insertedGames?.length || 0;
              }
            }
          }
          
          console.log(chalk.green(
            `✅ ${level.name} ${monthStart.toISOString().substring(0, 7)}: ${games.length} games (${totalGames} total)`
          ));
        }
        
      } catch (error) {
        console.error(chalk.red(`Error collecting games:`, error));
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }
  
  console.log(chalk.green(`\n✅ Total games collected: ${totalGames}`));
  console.log(chalk.yellow(`⚠️  Games skipped (missing teams): ${gamesSkipped}`));
}

async function collectAllPlayers() {
  // First, load existing players
  console.log(chalk.yellow('Loading existing MiLB players...'));
  const { data: existingPlayers } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', 'MILB');
    
  existingPlayers?.forEach(player => {
    playerIdMap.set(player.external_id, player.id);
  });
  
  console.log(chalk.green(`✅ Found ${playerIdMap.size} existing MiLB players\n`));
  
  let totalPlayers = playerIdMap.size;
  const processedPlayers = new Set<string>(playerIdMap.keys());
  
  // Get all games we've collected
  const gameIds = Array.from(gameIdMap.keys());
  console.log(chalk.yellow(`Processing players from ${gameIds.length} games...\n`));
  
  // Process games in batches
  for (let i = 0; i < gameIds.length; i += 100) {
    const batch = gameIds.slice(i, i + 100);
    
    const playerPromises = batch.map(gameExternalId =>
      httpLimit(async () => {
        try {
          const gameId = parseInt(gameExternalId.replace('mlb_milb_', ''));
          
          // Find which level this game belongs to
          const { data: game } = await supabase
            .from('games')
            .select('league')
            .eq('external_id', gameExternalId)
            .single();
            
          if (!game) return;
          
          const level = MILB_LEVELS.find(l => l.name === game.league);
          if (!level) return;
          
          const adapter = new MiLBAdapter(level.code);
          const stats = await adapter.getGameStats(gameId);
          
          // Extract unique players
          for (const stat of stats) {
            const playerExtId = `mlb_milb_${stat.playerId}`;
            
            if (!processedPlayers.has(playerExtId)) {
              processedPlayers.add(playerExtId);
              
              // Get player details
              const players = await adapter.getPlayers(stat.teamId);
              const player = players.find(p => p.id === stat.playerId);
              
              if (player) {
                const teamId = teamIdMap.get(`mlb_milb_${stat.teamId}`);
                if (!teamId) continue;
                
                const { data: inserted, error } = await supabase
                  .from('players')
                  .upsert({
                    external_id: player.externalId,
                    name: player.name,
                    firstname: player.firstName,
                    lastname: player.lastName,
                    team_id: teamId,
                    position: [player.position],
                    jersey_number: player.jerseyNumber,
                    sport: 'MILB',
                    milb_status: player.metadata?.status,
                    draft_year: player.metadata?.draftYear,
                    draft_round: player.metadata?.draftRound,
                    metadata: player.metadata
                  }, {
                    onConflict: 'external_id',
                    ignoreDuplicates: false
                  })
                  .select()
                  .single();
                  
                if (inserted) {
                  playerIdMap.set(player.externalId, inserted.id);
                  totalPlayers++;
                }
              }
            }
          }
          
        } catch (error) {
          // Silently skip errors
        }
      })
    );
    
    await Promise.all(playerPromises);
    
    if ((i + 100) % 1000 === 0) {
      console.log(chalk.blue(`Progress: ${i + 100}/${gameIds.length} games | ${totalPlayers} players found`));
    }
  }
  
  console.log(chalk.green(`\n✅ Total players collected: ${totalPlayers}`));
}

async function collectAllStats() {
  let totalStats = 0;
  const statsBuffer: any[] = [];
  
  // Get all games
  const gameIds = Array.from(gameIdMap.entries());
  console.log(chalk.yellow(`Collecting stats from ${gameIds.length} games...\n`));
  
  // Process games in batches
  for (let i = 0; i < gameIds.length; i += 50) {
    const batch = gameIds.slice(i, i + 50);
    
    const statsPromises = batch.map(([gameExtId, gameInternalId]) =>
      httpLimit(async () => {
        try {
          const gameId = parseInt(gameExtId.replace('mlb_milb_', ''));
          
          // Get game details
          const { data: game } = await supabase
            .from('games')
            .select('league, home_team_id, away_team_id')
            .eq('id', gameInternalId)
            .single();
            
          if (!game) return;
          
          const level = MILB_LEVELS.find(l => l.name === game.league);
          if (!level) return;
          
          const adapter = new MiLBAdapter(level.code);
          const gameStats = await adapter.getGameStats(gameId);
          
          for (const stat of gameStats) {
            const playerId = playerIdMap.get(`mlb_milb_${stat.playerId}`);
            if (!playerId) continue;
            
            statsBuffer.push({
              player_id: playerId,
              game_id: gameInternalId,
              team_id: stat.isHome ? game.home_team_id : game.away_team_id,
              opponent_id: stat.isHome ? game.away_team_id : game.home_team_id,
              game_date: new Date().toISOString(), // Will be updated from game data
              is_home: stat.isHome,
              stats: stat.stats,
              sport: 'MILB'
            });
            
            totalStats++;
            
            // Flush buffer if getting large
            if (statsBuffer.length >= DB_BATCH_SIZE) {
              await flushStatsBuffer(statsBuffer);
            }
          }
          
        } catch (error) {
          // Skip errors
        }
      })
    );
    
    await Promise.all(statsPromises);
    
    if ((i + 50) % 500 === 0) {
      console.log(chalk.blue(`Progress: ${i + 50}/${gameIds.length} games | ${totalStats} stats collected`));
    }
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
    console.error(chalk.red('Error inserting stats:', error.message));
  }
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