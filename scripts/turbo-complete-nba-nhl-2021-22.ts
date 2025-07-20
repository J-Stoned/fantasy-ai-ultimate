#!/usr/bin/env tsx
/**
 * 🔥 TURBO NBA & NHL COMPLETE COLLECTOR 🔥
 * 
 * BEAST MODE: 100+ concurrent requests, batch everything!
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

// TURBO MODE: 100 concurrent requests!
const limit = pLimit(100);

// Collect ALL players FAST
async function turboCollectPlayers(sport: 'NBA' | 'NHL') {
  console.log(chalk.cyan(`\n🔥 TURBO COLLECTING ${sport} PLAYERS...`));
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', sport);
  
  if (!teams) return 0;
  
  const allPlayers = [];
  const espnSport = sport === 'NBA' ? 'basketball/nba' : 'hockey/nhl';
  
  // Get ALL rosters in parallel
  const rosterPromises = teams.flatMap(team => {
    const espnTeamId = team.external_id.split('_').pop();
    
    // Try both seasons
    return [2021, 2022].map(year => 
      limit(async () => {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${espnTeamId}/roster?season=${year}`;
          const response = await axios.get(url, { timeout: 5000 });
          
          if (response.data.athletes) {
            return response.data.athletes.map((athlete: any) => ({
              external_id: `espn_${sport.toLowerCase()}_${athlete.id}`,
              name: athlete.displayName || athlete.fullName,
              position: athlete.position?.abbreviation,
              team_id: team.id,
              sport: sport,
              jersey_number: athlete.jersey,
              metadata: {
                height: athlete.height,
                weight: athlete.weight,
                age: athlete.age
              }
            }));
          }
          return [];
        } catch {
          return [];
        }
      })
    );
  });
  
  const results = await Promise.all(rosterPromises);
  const flatPlayers = results.flat();
  
  // Deduplicate by external_id
  const uniquePlayers = Array.from(
    new Map(flatPlayers.map(p => [p.external_id, p])).values()
  );
  
  console.log(chalk.blue(`  Found ${uniquePlayers.length} unique ${sport} players`));
  
  // TURBO INSERT - all at once with ON CONFLICT
  if (uniquePlayers.length > 0) {
    const { data, error } = await supabase
      .from('players')
      .upsert(uniquePlayers, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (!error) {
      console.log(chalk.green(`  ✅ Upserted ${data?.length || 0} players`));
    }
  }
  
  return uniquePlayers.length;
}

// Collect ALL stats FAST
async function turboCollectStats(sport: 'NBA' | 'NHL', startDate: string, endDate: string) {
  console.log(chalk.cyan(`\n🔥 TURBO COLLECTING ${sport} STATS...`));
  
  // Load players
  const { data: players } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', sport);
  
  const playerMap = new Map<string, number>();
  players?.forEach(p => playerMap.set(p.external_id, p.id));
  
  console.log(chalk.blue(`  Loaded ${playerMap.size} players`));
  
  // Get games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .eq('sport', sport)
    .eq('status', 'Final')
    .gte('start_time', startDate)
    .lte('start_time', endDate);
  
  if (!games) return 0;
  
  console.log(chalk.blue(`  Processing ${games.length} games...`));
  
  const allStats = [];
  const batchSize = 100; // Process 100 games at once!
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    
    const batchPromises = batch.map(game => 
      limit(async () => {
        const espnGameId = game.external_id.split('_').pop();
        
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.toLowerCase() === 'nba' ? 'basketball/nba' : 'hockey/nhl'}/summary?event=${espnGameId}`;
          const response = await axios.get(url, { timeout: 5000 });
          
          const gameStats = [];
          const gameDate = new Date(game.start_time).toISOString().split('T')[0];
          
          if (response.data.boxscore?.players) {
            for (const team of response.data.boxscore.players) {
              const isHome = team.homeAway === 'home';
              const teamId = isHome ? game.home_team_id : game.away_team_id;
              
              for (const statGroup of team.statistics || []) {
                for (const athlete of statGroup.athletes || []) {
                  const playerId = playerMap.get(`espn_${sport.toLowerCase()}_${athlete.athlete?.id}`);
                  
                  if (playerId && athlete.stats?.length > 0) {
                    const stats = quickTransformStats(athlete.stats, sport);
                    
                    if (stats.minutes_played > 0 || stats.goals !== undefined) {
                      gameStats.push({
                        player_id: playerId,
                        game_id: game.id,
                        team_id: teamId,
                        game_date: gameDate,
                        is_home: isHome,
                        stats: stats,
                        fantasy_points: quickFantasyPoints(stats, sport),
                        metadata: { season: '2021-22' }
                      });
                    }
                  }
                }
              }
            }
          }
          
          return gameStats;
        } catch {
          return [];
        }
      })
    );
    
    const results = await Promise.all(batchPromises);
    allStats.push(...results.flat());
    
    console.log(chalk.gray(`    Processed ${Math.min(i + batchSize, games.length)}/${games.length} games (${allStats.length} stats)`));
  }
  
  // TURBO INSERT - use ON CONFLICT to skip duplicates
  if (allStats.length > 0) {
    console.log(chalk.blue(`  Inserting ${allStats.length} stats...`));
    
    // Insert in big batches
    const insertBatchSize = 1000;
    let totalInserted = 0;
    
    for (let i = 0; i < allStats.length; i += insertBatchSize) {
      const batch = allStats.slice(i, i + insertBatchSize);
      
      try {
        // Use raw SQL for faster insert with ON CONFLICT
        const { data, error } = await supabase.rpc('insert_player_stats_batch', {
          stats_data: batch
        });
        
        if (!error) {
          totalInserted += data || batch.length;
        } else {
          // Fallback to regular insert
          const { data: fallbackData } = await supabase
            .from('player_game_logs')
            .insert(batch)
            .select();
          
          totalInserted += fallbackData?.length || 0;
        }
      } catch (err) {
        console.error(chalk.red('Batch insert error, using fallback'));
        
        // Last resort - insert in smaller chunks
        for (let j = 0; j < batch.length; j += 100) {
          const smallBatch = batch.slice(j, j + 100);
          try {
            await supabase.from('player_game_logs').insert(smallBatch);
            totalInserted += smallBatch.length;
          } catch {
            // Skip this batch
          }
        }
      }
    }
    
    console.log(chalk.green(`  ✅ Inserted ~${totalInserted} stats`));
  }
  
  return allStats.length;
}

// Quick stat transform
function quickTransformStats(espnStats: any[], sport: string): any {
  const stats: any = {};
  
  if (sport === 'NBA') {
    // NBA: MIN, FG, FGA, 3P, 3PA, FT, FTA, OREB, DREB, REB, AST, STL, BLK, TO, PF, PTS
    stats.minutes_played = parseFloat(espnStats[0]) || 0;
    stats.field_goals_made = parseInt(espnStats[1]) || 0;
    stats.field_goals_attempted = parseInt(espnStats[2]) || 0;
    stats.three_pointers_made = parseInt(espnStats[4]) || 0;
    stats.three_pointers_attempted = parseInt(espnStats[5]) || 0;
    stats.free_throws_made = parseInt(espnStats[6]) || 0;
    stats.free_throws_attempted = parseInt(espnStats[7]) || 0;
    stats.rebounds = parseInt(espnStats[10]) || 0;
    stats.assists = parseInt(espnStats[11]) || 0;
    stats.steals = parseInt(espnStats[12]) || 0;
    stats.blocks = parseInt(espnStats[13]) || 0;
    stats.turnovers = parseInt(espnStats[14]) || 0;
    stats.points = parseInt(espnStats[16]) || 0;
  } else {
    // NHL: G, A, PTS, +/-, S, PPG, PPA, SHG, SHA, GWG, SOG, PIM, TOI
    stats.goals = parseInt(espnStats[0]) || 0;
    stats.assists = parseInt(espnStats[1]) || 0;
    stats.points = parseInt(espnStats[2]) || 0;
    stats.shots_on_goal = parseInt(espnStats[10]) || 0;
    stats.penalty_minutes = parseInt(espnStats[11]) || 0;
  }
  
  return stats;
}

// Quick fantasy points
function quickFantasyPoints(stats: any, sport: string): number {
  if (sport === 'NBA') {
    return (stats.points || 0) + 
           (stats.rebounds || 0) * 1.2 + 
           (stats.assists || 0) * 1.5 + 
           (stats.steals || 0) * 3 + 
           (stats.blocks || 0) * 3 - 
           (stats.turnovers || 0);
  } else {
    return (stats.goals || 0) * 3 + 
           (stats.assists || 0) * 2 + 
           (stats.shots_on_goal || 0) * 0.5 - 
           (stats.penalty_minutes || 0) * 0.5;
  }
}

// Create RPC function for batch insert
async function createBatchInsertFunction() {
  const sql = `
    CREATE OR REPLACE FUNCTION insert_player_stats_batch(stats_data jsonb)
    RETURNS integer AS $$
    DECLARE
      inserted_count integer := 0;
    BEGIN
      INSERT INTO player_game_logs (
        player_id, game_id, team_id, game_date, is_home, 
        stats, fantasy_points, metadata
      )
      SELECT 
        (stat_record->>'player_id')::integer,
        (stat_record->>'game_id')::integer,
        (stat_record->>'team_id')::integer,
        (stat_record->>'game_date')::date,
        (stat_record->>'is_home')::boolean,
        (stat_record->>'stats')::jsonb,
        (stat_record->>'fantasy_points')::numeric,
        (stat_record->>'metadata')::jsonb
      FROM jsonb_array_elements(stats_data) AS stat_record
      ON CONFLICT (player_id, game_id) DO NOTHING;
      
      GET DIAGNOSTICS inserted_count = ROW_COUNT;
      RETURN inserted_count;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  try {
    await supabase.rpc('query', { query: sql });
  } catch {
    // Function might already exist
  }
}

async function main() {
  console.log(chalk.red('\n🔥 TURBO NBA & NHL COLLECTOR - BEAST MODE 🔥'));
  console.log(chalk.yellow('⚡ 100+ concurrent requests | Batch everything!'));
  console.log(chalk.yellow('🚀 Ryzen 5 7600X = MAXIMUM SPEED!\n'));
  
  const startTime = Date.now();
  
  try {
    // Create batch insert function
    await createBatchInsertFunction();
    
    // Collect everything in parallel!
    const [nbaPlayers, nhlPlayers] = await Promise.all([
      turboCollectPlayers('NBA'),
      turboCollectPlayers('NHL')
    ]);
    
    console.log(chalk.cyan('\n📊 Now collecting stats...'));
    
    const [nbaStats, nhlStats] = await Promise.all([
      turboCollectStats('NBA', '2021-10-19', '2022-06-17'),
      turboCollectStats('NHL', '2021-10-12', '2022-06-26')
    ]);
    
    // Quick verification
    const { count: nbaStatCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>season', '2021-22')
      .in('team_id', (await supabase.from('teams').select('id').eq('sport', 'NBA')).data?.map(t => t.id) || []);
    
    const { count: nhlStatCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>season', '2021-22')
      .in('team_id', (await supabase.from('teams').select('id').eq('sport', 'NHL')).data?.map(t => t.id) || []);
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(chalk.cyan('\n📊 RESULTS:'));
    console.log(chalk.green(`NBA: ${nbaPlayers} players, ${nbaStats} stats collected (${nbaStatCount} total in DB)`));
    console.log(chalk.green(`NHL: ${nhlPlayers} players, ${nhlStats} stats collected (${nhlStatCount} total in DB)`));
    console.log(chalk.yellow(`\n⏱️  Time: ${elapsedSeconds} seconds`));
    console.log(chalk.red('🔥 TURBO COLLECTION COMPLETE!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });