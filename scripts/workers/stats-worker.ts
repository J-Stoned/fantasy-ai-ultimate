/**
 * 📊 STATS WORKER THREAD
 * 
 * Runs in a separate thread to process games in parallel
 * Each worker handles a chunk of games independently
 * Communicates with main thread via messages
 */

import { parentPort, workerData } from 'worker_threads';
import axios from 'axios';
import { InMemoryCache } from '../utils/memory-cache';
import { BufferedStat } from '../utils/stats-buffer';

const { threadId, supabaseUrl, supabaseKey } = workerData;

// ESPN API mappings
const ESPN_SPORTS: Record<string, string> = {
  'NFL': 'football/nfl',
  'NBA': 'basketball/nba',
  'MLB': 'baseball/mlb',
  'NHL': 'hockey/nhl'
};

// Stat mappings for each sport
const STAT_MAPPINGS: Record<string, Record<string, string>> = {
  'NBA': {
    'MIN': 'minutes_played',
    'PTS': 'points',
    'REB': 'rebounds',
    'AST': 'assists',
    'STL': 'steals',
    'BLK': 'blocks',
    'TO': 'turnovers',
    'FGM': 'field_goals_made',
    'FGA': 'field_goals_attempted',
    'FG%': 'field_goal_percentage',
    '3PM': 'three_pointers_made',
    '3PA': 'three_pointers_attempted',
    'FTM': 'free_throws_made',
    'FTA': 'free_throws_attempted',
    'OREB': 'offensive_rebounds',
    'DREB': 'defensive_rebounds',
    'PF': 'personal_fouls'
  },
  'NFL': {
    'PASSYDS': 'passing_yards',
    'PASSTD': 'passing_touchdowns',
    'INT': 'interceptions',
    'PASSATT': 'passing_attempts',
    'PASSCOMP': 'passing_completions',
    'RUSHYDS': 'rushing_yards',
    'RUSHTD': 'rushing_touchdowns',
    'RUSHATT': 'rushing_attempts',
    'RECYDS': 'receiving_yards',
    'RECTD': 'receiving_touchdowns',
    'REC': 'receptions',
    'TARGETS': 'targets',
    'FUMBLES': 'fumbles',
    'FUMLOST': 'fumbles_lost'
  },
  'MLB': {
    'AB': 'at_bats',
    'H': 'hits',
    'R': 'runs',
    'RBI': 'runs_batted_in',
    'HR': 'home_runs',
    'BB': 'walks',
    'SO': 'strikeouts',
    '2B': 'doubles',
    '3B': 'triples',
    'SB': 'stolen_bases',
    'CS': 'caught_stealing',
    'AVG': 'batting_average',
    'OBP': 'on_base_percentage',
    'SLG': 'slugging_percentage',
    'E': 'errors'
  },
  'NHL': {
    'G': 'goals',
    'A': 'assists',
    'PTS': 'points',
    'SOG': 'shots_on_goal',
    'PIM': 'penalty_minutes',
    '+/-': 'plus_minus',
    'PPG': 'powerplay_goals',
    'PPA': 'powerplay_assists',
    'SHG': 'shorthanded_goals',
    'SHA': 'shorthanded_assists',
    'GWG': 'game_winning_goals',
    'TOI': 'time_on_ice',
    'FO%': 'faceoff_percentage',
    'BLK': 'blocks',
    'HIT': 'hits'
  }
};

let cache: InMemoryCache;

async function processGames(games: any[], sport: string, year: number) {
  const stats: BufferedStat[] = [];
  let processed = 0;
  
  for (const game of games) {
    try {
      const espnGameId = game.external_id?.split('_').pop();
      if (!espnGameId) continue;
      
      // Get game details from ESPN
      const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_SPORTS[sport]}/summary?event=${espnGameId}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'Accept-Encoding': 'gzip, deflate' }
      });
      
      const gameData = response.data;
      
      if (gameData.boxscore?.players) {
        for (const team of gameData.boxscore.players) {
          const teamId = team.team.id;
          const dbTeam = cache.getTeamByExternalId(`espn_${sport.toLowerCase()}_${teamId}`);
          
          if (!dbTeam) continue;
          
          // Get opponent team
          const isHome = team.homeAway === 'home';
          const opponentTeamId = isHome ? game.away_team_id : game.home_team_id;
          
          for (const statGroup of team.statistics || []) {
            for (const athlete of statGroup.athletes || []) {
              // Find player in cache
              const player = cache.getPlayerByExternalId(
                `espn_${sport.toLowerCase()}_${athlete.athlete.id}`
              );
              
              if (!player) continue;
              
              // Transform stats
              const transformedStats = transformStats(
                athlete.stats || [],
                statGroup.names || [],
                sport
              );
              
              if (Object.keys(transformedStats).length === 0) continue;
              
              const stat: BufferedStat = {
                player_id: player.id,
                game_id: game.id,
                team_id: dbTeam.id,
                opponent_id: opponentTeamId,
                game_date: new Date(game.start_time).toISOString().split('T')[0],
                is_home: isHome,
                sport: sport,
                stats: transformedStats,
                fantasy_points: calculateFantasyPoints(transformedStats, sport),
                metadata: {
                  historical_season: year,
                  collection_source: 'turbo-pipeline',
                  thread_id: threadId
                }
              };
              
              stats.push(stat);
            }
          }
        }
      }
      
      processed++;
      
      // Send progress update
      if (processed % 10 === 0) {
        parentPort?.postMessage({
          type: 'progress',
          processed,
          total: games.length
        });
      }
      
    } catch (error: any) {
      parentPort?.postMessage({
        type: 'error',
        error: `Failed to process game ${game.external_id}: ${error.message}`
      });
    }
  }
  
  return stats;
}

function transformStats(
  statValues: any[],
  statNames: string[],
  sport: string
): Record<string, any> {
  const stats: Record<string, any> = {};
  const mapping = STAT_MAPPINGS[sport] || {};
  
  statNames.forEach((name, index) => {
    if (mapping[name] && statValues[index] !== undefined) {
      stats[mapping[name]] = statValues[index];
    }
  });
  
  return stats;
}

function calculateFantasyPoints(stats: any, sport: string): number {
  let points = 0;
  
  switch (sport) {
    case 'NBA':
      points = (stats.points || 0) + 
               (stats.rebounds || 0) * 1.2 + 
               (stats.assists || 0) * 1.5 + 
               (stats.steals || 0) * 3 + 
               (stats.blocks || 0) * 3 - 
               (stats.turnovers || 0);
      break;
      
    case 'NFL':
      points = (stats.passing_yards || 0) / 25 + 
               (stats.passing_touchdowns || 0) * 4 - 
               (stats.interceptions || 0) * 2 +
               (stats.rushing_yards || 0) / 10 + 
               (stats.rushing_touchdowns || 0) * 6 + 
               (stats.receiving_yards || 0) / 10 + 
               (stats.receiving_touchdowns || 0) * 6 + 
               (stats.receptions || 0) * 0.5 -
               (stats.fumbles_lost || 0) * 2;
      break;
      
    case 'MLB':
      points = (stats.hits || 0) * 3 + 
               (stats.runs || 0) * 2 + 
               (stats.runs_batted_in || 0) * 2 + 
               (stats.home_runs || 0) * 4 + 
               (stats.stolen_bases || 0) * 2 +
               (stats.walks || 0) - 
               (stats.strikeouts || 0) * 0.5;
      break;
      
    case 'NHL':
      points = (stats.goals || 0) * 3 + 
               (stats.assists || 0) * 2 + 
               (stats.shots_on_goal || 0) * 0.5 +
               (stats.blocks || 0) * 0.5 +
               (stats.hits || 0) * 0.25;
      break;
  }
  
  return Math.max(0, points);
}

// Listen for messages from main thread
parentPort?.on('message', async (message) => {
  if (message.type === 'collect_stats') {
    // Deserialize cache
    cache = InMemoryCache.deserialize(message.cache);
    
    // Process games
    const stats = await processGames(
      message.games,
      message.sport,
      message.year
    );
    
    // Send stats back in batches
    const batchSize = 1000;
    for (let i = 0; i < stats.length; i += batchSize) {
      const batch = stats.slice(i, i + batchSize);
      parentPort?.postMessage({
        type: 'stats',
        data: batch
      });
    }
    
    // Send completion message
    parentPort?.postMessage({
      type: 'complete',
      totalStats: stats.length
    });
  }
});