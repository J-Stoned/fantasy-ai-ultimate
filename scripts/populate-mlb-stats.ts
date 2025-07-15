#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1'
});

// Helper to calculate fantasy points
function calculateBattingFantasyPoints(stats: any): number {
  let points = 0;
  points += (stats.hits || 0) * 3;
  points += (stats.doubles || 0) * 2;
  points += (stats.triples || 0) * 3;
  points += (stats.homeRuns || 0) * 10;
  points += (stats.rbi || 0) * 2;
  points += (stats.runs || 0) * 2;
  points += (stats.baseOnBalls || 0) * 1;
  points += (stats.stolenBases || 0) * 5;
  points -= (stats.strikeOuts || 0) * 1;
  return points;
}

function calculatePitchingFantasyPoints(stats: any): number {
  let points = 0;
  const innings = parseFloat(stats.inningsPitched || '0');
  points += innings * 3;
  points += (stats.strikeOuts || 0) * 2;
  points += (stats.wins || 0) * 10;
  points += (stats.saves || 0) * 10;
  points -= (stats.earnedRuns || 0) * 2;
  points -= (stats.hits || 0) * 0.5;
  points -= (stats.baseOnBalls || 0) * 1;
  return points;
}

async function checkTablesExist() {
  console.log('🔍 Checking if MLB tables exist...\n');
  
  // Try to query the tables
  const { data: players, error: playersError } = await supabase
    .from('mlb_players')
    .select('*')
    .limit(1);
    
  const { data: stats, error: statsError } = await supabase
    .from('mlb_stats')
    .select('*')
    .limit(1);
    
  if (playersError?.message.includes('does not exist') || 
      statsError?.message.includes('does not exist')) {
    console.log('❌ MLB tables do not exist yet!');
    console.log('Please run the CREATE TABLE SQL from the previous script first.');
    console.log('Go to: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new');
    return false;
  }
  
  console.log('✅ MLB tables exist and are ready!');
  return true;
}

async function populateGameStats(gameId: number, gamePk: number) {
  console.log(`\n📊 Processing game ${gameId} (MLB: ${gamePk})`);
  
  try {
    // Fetch game data
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    
    const playersToInsert = [];
    const statsToInsert = [];
    
    // Process team players
    const processTeamPlayers = (teamPlayers: any, teamName: string) => {
      Object.values(teamPlayers || {}).forEach((player: any) => {
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Player info
        playersToInsert.push({
          mlb_player_id: mlbPlayerId,
          player_name: player.person.fullName,
          position: player.position?.abbreviation,
          jersey_number: parseInt(player.jerseyNumber) || null,
          current_team: teamName,
          bat_side: player.batSide?.code,
          pitch_hand: player.pitchHand?.code,
          metadata: {
            mlb_id: player.person.id,
            game_position: player.gameStatus?.substitution || false
          }
        });
        
        // Batting stats
        if (player.stats?.batting) {
          const batting = player.stats.batting;
          
          if (batting.atBats > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'at_bats',
              stat_value: batting.atBats,
              fantasy_points: 0
            });
          }
          
          if (batting.hits > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'hits',
              stat_value: batting.hits,
              fantasy_points: batting.hits * 3
            });
          }
          
          if (batting.homeRuns > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
          }
          
          if (batting.rbi > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'rbi',
              stat_value: batting.rbi,
              fantasy_points: batting.rbi * 2
            });
          }
          
          if (batting.runs > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'runs',
              stat_value: batting.runs,
              fantasy_points: batting.runs * 2
            });
          }
          
          // Total batting fantasy points
          const totalFantasy = calculateBattingFantasyPoints(batting);
          if (totalFantasy > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'batting_fantasy_total',
              stat_value: totalFantasy,
              fantasy_points: totalFantasy
            });
          }
        }
        
        // Pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          statsToInsert.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'innings_pitched',
            stat_value: parseFloat(pitching.inningsPitched || '0'),
            fantasy_points: parseFloat(pitching.inningsPitched || '0') * 3
          });
          
          if (pitching.strikeOuts > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'strikeouts',
              stat_value: pitching.strikeOuts,
              fantasy_points: pitching.strikeOuts * 2
            });
          }
          
          if (pitching.earnedRuns > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'earned_runs',
              stat_value: pitching.earnedRuns,
              fantasy_points: -pitching.earnedRuns * 2
            });
          }
          
          if (pitching.wins > 0) {
            statsToInsert.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'wins',
              stat_value: 1,
              fantasy_points: 10
            });
          }
          
          // ERA for the game
          statsToInsert.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'era',
            stat_value: parseFloat(pitching.era || '0'),
            fantasy_points: 0
          });
        }
      });
    };
    
    // Process both teams
    const homeTeamName = response.data.teams?.home?.team?.name || 'Unknown';
    const awayTeamName = response.data.teams?.away?.team?.name || 'Unknown';
    
    processTeamPlayers(response.data.teams?.home?.players, homeTeamName);
    processTeamPlayers(response.data.teams?.away?.players, awayTeamName);
    
    // Insert players (with upsert to handle duplicates)
    console.log(`  Inserting ${playersToInsert.length} players...`);
    
    for (const player of playersToInsert) {
      const { error } = await supabase
        .from('mlb_players')
        .upsert(player, { 
          onConflict: 'mlb_player_id',
          ignoreDuplicates: false 
        });
        
      if (error && !error.message.includes('duplicate')) {
        console.error(`  Error inserting player ${player.mlb_player_id}:`, error.message);
      }
    }
    
    // Insert stats
    console.log(`  Inserting ${statsToInsert.length} stats...`);
    
    let statsInserted = 0;
    for (const stat of statsToInsert) {
      const { error } = await supabase
        .from('mlb_stats')
        .insert(stat);
        
      if (error) {
        if (!error.message.includes('duplicate')) {
          console.error(`  Error inserting stat:`, error.message);
        }
      } else {
        statsInserted++;
      }
    }
    
    console.log(`  ✅ Successfully inserted ${statsInserted} stats`);
    return statsInserted;
    
  } catch (error: any) {
    console.error(`  ❌ Error processing game:`, error.message);
    return 0;
  }
}

async function populateMLBStats() {
  // Check tables exist
  const tablesExist = await checkTablesExist();
  if (!tablesExist) {
    return;
  }
  
  console.log('\n🚀 POPULATING MLB STATS\n');
  
  // Get MLB games to process
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(10); // Start with 10 games
    
  if (!games || games.length === 0) {
    console.log('No MLB games found');
    return;
  }
  
  console.log(`Found ${games.length} MLB games to process`);
  
  let totalStats = 0;
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const gamePk = parseInt(game.external_id.replace('mlb_', ''));
    
    const statsCount = await populateGameStats(game.id, gamePk);
    totalStats += statsCount;
    
    // Small delay to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Population complete!`);
  console.log(`Total stats inserted: ${totalStats}`);
  
  // Show sample queries
  console.log('\n📊 Sample Queries You Can Now Run:\n');
  
  console.log('-- Top fantasy scorers:');
  console.log(`SELECT * FROM mlb_player_game_stats 
WHERE fantasy_points > 20 
ORDER BY fantasy_points DESC 
LIMIT 10;\n`);
  
  console.log('-- Player season totals:');
  console.log(`SELECT * FROM mlb_player_season_stats 
WHERE games_played > 5 
ORDER BY total_fantasy_points DESC 
LIMIT 20;\n`);
  
  console.log('-- Team batting leaders:');
  console.log(`SELECT player_name, current_team, total_hits, total_home_runs, total_rbi
FROM mlb_player_season_stats 
WHERE position NOT IN ('P', 'RP', 'SP')
ORDER BY total_hits DESC 
LIMIT 10;`);
}

// Run the population
populateMLBStats().catch(console.error);