#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

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

async function collectStatsForGame(gameId: string, gamePk: number) {
  try {
    console.log(`📊 Collecting stats for game ${gameId} (${gamePk})`);
    
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const statsToInsert = [];
    
    // Process home team
    const homeTeam = response.data.teams?.home;
    if (homeTeam?.players) {
      const homePlayers = Object.values(homeTeam.players);
      console.log(`  Found ${homePlayers.length} home players`);
      
      for (const player of homePlayers as any[]) {
        // Batting stats
        if (player.stats?.batting && player.stats.batting.atBats > 0) {
          const batting = player.stats.batting;
          
          // Primary batting stat
          statsToInsert.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'batting_avg',
            stat_value: parseFloat(batting.avg || '0'),
            fantasy_points: calculateBattingFantasyPoints(batting)
          });
          
          // Key individual stats
          if (batting.hits > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'hits',
              stat_value: batting.hits,
              fantasy_points: batting.hits * 3
            });
          }
          
          if (batting.homeRuns > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
          }
          
          if (batting.rbi > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'rbi',
              stat_value: batting.rbi,
              fantasy_points: batting.rbi * 2
            });
          }
        }
        
        // Pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          statsToInsert.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'era',
            stat_value: parseFloat(pitching.era || '0'),
            fantasy_points: calculatePitchingFantasyPoints(pitching)
          });
          
          if (pitching.strikeOuts > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'strikeouts_p',
              stat_value: pitching.strikeOuts,
              fantasy_points: pitching.strikeOuts * 2
            });
          }
          
          if (pitching.wins > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'wins',
              stat_value: 1,
              fantasy_points: 10
            });
          }
        }
      }
    }
    
    // Process away team (similar logic)
    const awayTeam = response.data.teams?.away;
    if (awayTeam?.players) {
      const awayPlayers = Object.values(awayTeam.players);
      console.log(`  Found ${awayPlayers.length} away players`);
      
      for (const player of awayPlayers as any[]) {
        if (player.stats?.batting && player.stats.batting.atBats > 0) {
          const batting = player.stats.batting;
          
          statsToInsert.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'batting_avg',
            stat_value: parseFloat(batting.avg || '0'),
            fantasy_points: calculateBattingFantasyPoints(batting)
          });
          
          if (batting.hits > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'hits',
              stat_value: batting.hits,
              fantasy_points: batting.hits * 3
            });
          }
          
          if (batting.homeRuns > 0) {
            statsToInsert.push({
              player_id: `mlb_${player.person.id}`,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
          }
        }
        
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          statsToInsert.push({
            player_id: `mlb_${player.person.id}`,
            game_id: gameId,
            stat_type: 'era',
            stat_value: parseFloat(pitching.era || '0'),
            fantasy_points: calculatePitchingFantasyPoints(pitching)
          });
        }
      }
    }
    
    console.log(`  Total stats to insert: ${statsToInsert.length}`);
    
    // Insert stats in batches
    if (statsToInsert.length > 0) {
      const batchSize = 100;
      let inserted = 0;
      
      for (let i = 0; i < statsToInsert.length; i += batchSize) {
        const batch = statsToInsert.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('player_stats')
          .insert(batch);
          
        if (error) {
          console.error(`  ❌ Error inserting batch: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      }
      
      console.log(`  ✅ Inserted ${inserted}/${statsToInsert.length} stats`);
    }
    
    return statsToInsert.length;
    
  } catch (error: any) {
    console.error(`  ❌ Error collecting stats: ${error.message}`);
    return 0;
  }
}

async function collectMissingStats() {
  console.log('🏃 MLB Stats Collector (Simplified)\n');
  
  // Get recent MLB games that might be missing stats
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(100);
    
  if (!games || games.length === 0) {
    console.log('No MLB games found');
    return;
  }
  
  console.log(`Found ${games.length} completed MLB games to check\n`);
  
  // Check which games already have stats
  const gameIds = games.map(g => g.id);
  const { data: existingStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .in('game_id', gameIds);
    
  const gamesWithStats = new Set(existingStats?.map(s => s.game_id) || []);
  const gamesNeedingStats = games.filter(g => !gamesWithStats.has(g.id));
  
  console.log(`${gamesNeedingStats.length} games need stats collection\n`);
  
  // Collect stats for games missing them
  let totalStats = 0;
  for (let i = 0; i < Math.min(gamesNeedingStats.length, 3); i++) {
    const game = gamesNeedingStats[i];
    const gamePk = parseInt(game.external_id.replace('mlb_', ''));
    
    const statsCount = await collectStatsForGame(game.id, gamePk);
    totalStats += statsCount;
    
    // Be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Collection complete! Total stats inserted: ${totalStats}`);
  
  // Verify
  const { count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .like('player_id', 'mlb_%');
    
  console.log(`Total MLB player stats in database: ${count}`);
}

// Run the collector
collectMissingStats().catch(console.error);