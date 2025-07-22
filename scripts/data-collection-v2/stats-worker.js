/**
 * JavaScript worker for ultra-fast stats collection
 * This file is loaded by Worker threads
 */

const { parentPort, workerData } = require('worker_threads');
const axios = require('axios');
const { default: pLimit } = require('p-limit');

// Process games when message received
parentPort.on('message', async (msg) => {
  if (msg.type === 'process_games') {
    try {
      const stats = await processGamesInWorker(msg);
      parentPort.postMessage({ type: 'stats', data: stats });
      parentPort.postMessage({ type: 'progress', games: msg.games.length, stats: stats.length });
      parentPort.postMessage({ type: 'complete' });
    } catch (error) {
      parentPort.postMessage({ type: 'error', error: error.message });
    }
  }
});

async function processGamesInWorker(data) {
  const { sport, games, playerCache } = data;
  const allStats = [];
  // Each worker gets ~83 concurrent API calls (1000 / 12 workers)
  const apiLimit = pLimit(workerData.apiConcurrency || 83);
  
  // Process games in larger batches for speed
  const BATCH_SIZE = 50;
  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(game => 
      apiLimit(async () => {
        try {
          let stats = [];
          
          if (sport === 'NFL') {
            stats = await collectNFLGameStatsOptimized(game, playerCache);
          } else if (sport === 'NBA') {
            stats = await collectNBAGameStatsOptimized(game, playerCache);
          } else if (sport === 'MLB' || sport.startsWith('MILB')) {
            stats = await collectMLBGameStatsOptimized(game, playerCache);
          } else if (sport === 'NHL') {
            stats = await collectNHLGameStatsOptimized(game, playerCache);
          }
          
          return stats;
        } catch (error) {
          return [];
        }
      })
    );
    
    const results = await Promise.all(batchPromises);
    allStats.push(...results.flat());
  }
  
  return allStats;
}

async function collectNFLGameStatsOptimized(game, playerCache) {
  const stats = [];
  
  try {
    if (game.espn_game_id) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          for (const category of teamData.statistics || []) {
            for (const player of category.athletes || []) {
              if (player.stats && player.stats.length > 0) {
                const playerId = playerCache[`espn_NFL_${player.athlete?.id || player.id}`];
                if (playerId) {
                  const stat = parseNFLStatsOptimized(player, category.name, game, playerId);
                  if (stat) stats.push(stat);
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip failed games
  }
  
  return stats;
}

async function collectNBAGameStatsOptimized(game, playerCache) {
  const stats = [];
  
  try {
    if (game.espn_game_id) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = teamData.team.id === game.home_espn_id ? game.home_team_id : game.away_team_id;
          
          for (const player of teamData.statistics?.[0]?.athletes || []) {
            const playerId = playerCache[`espn_NBA_${player.athlete?.id || player.id}`];
            if (playerId && player.stats && player.stats.length >= 14) {
              const stat = parseNBAStatsOptimized(player, game, playerId, teamId);
              if (stat) stats.push(stat);
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip failed games
  }
  
  return stats;
}

async function collectMLBGameStatsOptimized(game, playerCache) {
  const stats = [];
  
  try {
    if (game.mlb_game_id) {
      const url = `https://statsapi.mlb.com/api/v1.1/game/${game.mlb_game_id}/feed/live`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data.liveData?.boxscore?.teams) {
        const teams = response.data.liveData.boxscore.teams;
        
        for (const side of ['home', 'away']) {
          const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
          const teamData = teams[side];
          
          for (const [playerId, playerData] of Object.entries(teamData.players || {})) {
            const player = playerData;
            const dbPlayerId = playerCache[`mlb_${player.person.id}`];
            
            if (dbPlayerId) {
              if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
                stats.push(parseMLBBattingOptimized(player, game, dbPlayerId, teamId));
              }
              
              if (player.stats?.pitching && Object.keys(player.stats.pitching).length > 0) {
                stats.push(parseMLBPitchingOptimized(player, game, dbPlayerId, teamId));
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip failed games
  }
  
  return stats.filter(s => s !== null);
}

async function collectNHLGameStatsOptimized(game, playerCache) {
  const stats = [];
  
  try {
    if (game.espn_game_id) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = teamData.team.id === game.home_espn_id ? game.home_team_id : game.away_team_id;
          
          // Skaters
          for (const player of teamData.statistics?.[0]?.athletes || []) {
            const playerId = playerCache[`espn_NHL_${player.athlete?.id || player.id}`];
            if (playerId && player.stats && player.stats.length > 0) {
              stats.push(parseNHLSkaterOptimized(player, game, playerId, teamId));
            }
          }
          
          // Goalies
          for (const player of teamData.statistics?.[1]?.athletes || []) {
            const playerId = playerCache[`espn_NHL_${player.athlete?.id || player.id}`];
            if (playerId && player.stats && player.stats.length > 0) {
              stats.push(parseNHLGoalieOptimized(player, game, playerId, teamId));
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip failed games
  }
  
  return stats.filter(s => s !== null);
}

function parseNFLStatsOptimized(player, category, game, playerId) {
  const stats = {};
  const position = player.position?.abbreviation || 'UNK';
  
  if (category === 'passing' && player.stats.length > 0) {
    const [completions, attempts] = player.stats[0]?.split('/').map(Number) || [0, 0];
    Object.assign(stats, {
      completions,
      attempts,
      passing_yards: parseInt(player.stats[1]) || 0,
      passing_touchdowns: parseInt(player.stats[2]) || 0,
      interceptions: parseInt(player.stats[3]) || 0
    });
  } else if (category === 'rushing' && player.stats.length > 0) {
    Object.assign(stats, {
      rushing_attempts: parseInt(player.stats[0]) || 0,
      rushing_yards: parseInt(player.stats[1]) || 0,
      rushing_touchdowns: parseInt(player.stats[3]) || 0
    });
  } else if (category === 'receiving' && player.stats.length > 0) {
    Object.assign(stats, {
      receptions: parseInt(player.stats[0]) || 0,
      receiving_yards: parseInt(player.stats[1]) || 0,
      receiving_touchdowns: parseInt(player.stats[3]) || 0,
      targets: parseInt(player.stats[5]) || 0
    });
  }
  
  if (Object.keys(stats).length > 0) {
    return {
      player_id: playerId,
      game_id: game.id,
      team_id: player.teamId || game.home_team_id,
      sport: 'NFL',
      season: game.season,
      position: position,
      played: true,
      started: player.starter || false,
      stats: stats,
      data_source: 'espn_api'
    };
  }
  
  return null;
}

function parseNBAStatsOptimized(player, game, playerId, teamId) {
  const values = player.stats;
  const [fgMade, fgAtt] = (values[1] || '0-0').split('-').map(Number);
  const [threeMade, threeAtt] = (values[2] || '0-0').split('-').map(Number);
  const [ftMade, ftAtt] = (values[3] || '0-0').split('-').map(Number);
  
  return {
    player_id: playerId,
    game_id: game.id,
    team_id: teamId,
    sport: 'NBA',
    season: game.season,
    position: player.position?.abbreviation || 'UNK',
    played: true,
    started: player.starter || false,
    minutes_played: parseInt(values[0]) || 0,
    stats: {
      minutes: parseInt(values[0]) || 0,
      field_goals_made: fgMade || 0,
      field_goals_attempted: fgAtt || 0,
      three_pointers_made: threeMade || 0,
      three_pointers_attempted: threeAtt || 0,
      free_throws_made: ftMade || 0,
      free_throws_attempted: ftAtt || 0,
      rebounds: parseInt(values[6]) || 0,
      assists: parseInt(values[7]) || 0,
      steals: parseInt(values[8]) || 0,
      blocks: parseInt(values[9]) || 0,
      turnovers: parseInt(values[10]) || 0,
      points: parseInt(values[13]) || 0
    },
    data_source: 'espn_api'
  };
}

function parseMLBBattingOptimized(player, game, playerId, teamId) {
  const batting = player.stats.batting;
  
  return {
    player_id: playerId,
    game_id: game.id,
    team_id: teamId,
    sport: game.sport || 'MLB',
    season: game.season,
    position: player.position?.abbreviation || 'UNK',
    played: true,
    started: player.gameStatus?.isSubstitute === false,
    stats: {
      at_bats: batting.atBats || 0,
      runs: batting.runs || 0,
      hits: batting.hits || 0,
      doubles: batting.doubles || 0,
      triples: batting.triples || 0,
      home_runs: batting.homeRuns || 0,
      rbi: batting.rbi || 0,
      walks: batting.baseOnBalls || 0,
      strikeouts: batting.strikeOuts || 0,
      stolen_bases: batting.stolenBases || 0,
      caught_stealing: batting.caughtStealing || 0
    },
    data_source: 'mlb_api'
  };
}

function parseMLBPitchingOptimized(player, game, playerId, teamId) {
  const pitching = player.stats.pitching;
  
  return {
    player_id: playerId,
    game_id: game.id,
    team_id: teamId,
    sport: game.sport || 'MLB',
    season: game.season,
    position: 'P',
    played: true,
    started: pitching.gamesStarted === 1,
    stats: {
      innings_pitched: pitching.inningsPitched || 0,
      hits_allowed: pitching.hits || 0,
      runs_allowed: pitching.runs || 0,
      earned_runs: pitching.earnedRuns || 0,
      walks_allowed: pitching.baseOnBalls || 0,
      strikeouts: pitching.strikeOuts || 0,
      home_runs_allowed: pitching.homeRuns || 0,
      pitches_thrown: pitching.numberOfPitches || 0,
      wins: pitching.wins || 0,
      losses: pitching.losses || 0,
      saves: pitching.saves || 0
    },
    data_source: 'mlb_api'
  };
}

function parseNHLSkaterOptimized(player, game, playerId, teamId) {
  const values = player.stats || [];
  
  if (values.length >= 6) {
    return {
      player_id: playerId,
      game_id: game.id,
      team_id: teamId,
      sport: 'NHL',
      season: game.season,
      position: player.position?.abbreviation || 'F',
      played: true,
      started: player.starter || false,
      stats: {
        goals: parseInt(values[0]) || 0,
        assists: parseInt(values[1]) || 0,
        points: parseInt(values[2]) || 0,
        shots: parseInt(values[3]) || 0,
        plus_minus: parseInt(values[4]) || 0,
        penalty_minutes: parseInt(values[5]) || 0
      },
      data_source: 'espn_api'
    };
  }
  
  return null;
}

function parseNHLGoalieOptimized(player, game, playerId, teamId) {
  const values = player.stats || [];
  
  if (values.length >= 4) {
    return {
      player_id: playerId,
      game_id: game.id,
      team_id: teamId,
      sport: 'NHL',
      season: game.season,
      position: 'G',
      played: true,
      started: player.starter || false,
      stats: {
        saves: parseInt(values[0]) || 0,
        shots_against: parseInt(values[1]) || 0,
        goals_against: parseInt(values[2]) || 0,
        save_percentage: parseFloat(values[3]) || 0
      },
      data_source: 'espn_api'
    };
  }
  
  return null;
}