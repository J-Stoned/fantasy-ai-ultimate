import { NextRequest, NextResponse } from 'next/server';
import { gameStatsService } from '@/lib/database/game-stats-service';
import { playerDataService } from '@/lib/database/player-data-service';
import { logger } from '@/lib/logging/logger';

interface MLTrainingRequest {
  sport?: string;
  season?: string;
  positions?: string[];
  limit?: number;
  includeGameLogs?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const sport = searchParams.get('sport') || 'NFL';
    const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : 2024;
    const positions = searchParams.get('positions')?.split(',') || ['QB', 'RB', 'WR', 'TE'];
    const limit = parseInt(searchParams.get('limit') || '10000');
    const includeGameLogs = searchParams.get('includeGameLogs') !== 'false'; // Default to true
    
    logger.info('ML Training Data Request', {
      sport,
      season,
      positions,
      limit,
      includeGameLogs
    });

    // Get players using our enhanced player data service
    const { data: playersData, error: playersError } = await playerDataService.getPlayers({
      sport,
      positions,
      include_stats: includeGameLogs,
      limit: Math.min(limit, 1000) // Reasonable limit for players
    });

    if (playersError) {
      logger.error('Error fetching ML training players:', playersError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch players for ML training',
        details: playersError
      }, { status: 500 });
    }

    if (!playersData || playersData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No players found for ML training',
        data: {
          players: [],
          gameLogs: [],
          metadata: {
            sport,
            positions,
            playerCount: 0,
            gameLogCount: 0
          }
        }
      });
    }

    // Prepare ML-ready player features
    const mlPlayers = playersData.map(player => ({
      // Core identifiers
      id: player.id,
      name: player.name,
      
      // Categorical features
      position: player.position,
      team: player.team_abbreviation || player.team,
      sport: player.sport,
      status: player.status,
      avatar_tier: player.avatar_tier,
      
      // Numerical features
      jersey_number: player.jersey_number ? parseInt(player.jersey_number) : null,
      height_inches: player.height_inches || null,
      weight_lbs: player.weight_lbs || null,
      overall_rating: player.overall_rating || null,
      draft_year: player.draft_year || null,
      draft_round: player.draft_round || null,
      age: player.age || null,
      bmi: player.bmi || null,
      years_pro: player.years_pro || null,
      
      // Performance metrics (from season stats if available)
      avg_fantasy_points: player.season_stats?.avg_fantasy_points || null,
      avg_dk_points: player.season_stats?.avg_dk_points || null,
      avg_fd_points: player.season_stats?.avg_fd_points || null,
      avg_yahoo_points: player.season_stats?.avg_yahoo_points || null,
      consistency_score: player.season_stats?.consistency_score || null,
      trending: player.trending || null,
      
      // Additional metadata
      college: player.college,
      created_at: player.created_at,
      updated_at: player.updated_at
    }));

    // Initialize response
    let responseData: any = {
      players: mlPlayers,
      gameLogs: [],
      metadata: {
        sport,
        positions,
        season,
        playerCount: mlPlayers.length,
        gameLogCount: 0,
        generatedAt: new Date().toISOString(),
        features: {
          categorical: ['position', 'team', 'sport', 'status', 'avatar_tier', 'college', 'trending'],
          numerical: ['jersey_number', 'height_inches', 'weight_lbs', 'overall_rating', 
                     'draft_year', 'draft_round', 'age', 'bmi', 'years_pro',
                     'avg_fantasy_points', 'avg_dk_points', 'avg_fd_points', 'avg_yahoo_points', 'consistency_score'],
          derived: ['bmi', 'age', 'years_pro', 'consistency_score']
        }
      }
    };

    // Get comprehensive game logs for ML training using our game stats service
    if (includeGameLogs) {
      try {
        logger.info('Fetching game logs for ML training');
        
        // Get game stats for all players using our enhanced service
        const { data: gameStatsData, error: gameStatsError } = await gameStatsService.getGameStats({
          sport,
          season,
          limit: Math.min(limit, 50000), // Large limit for training data
          include_stats: true
        });

        if (gameStatsError) {
          logger.warn('Failed to fetch game stats for ML training:', gameStatsError);
          responseData.metadata.gameLogsError = 'Game stats unavailable: ' + gameStatsError;
        } else if (gameStatsData && gameStatsData.length > 0) {
          // Transform game stats to ML training format
          responseData.gameLogs = gameStatsData.map(stat => {
            const baseRecord = {
              // Identifiers
              player_id: stat.player_id,
              player_name: stat.player_name,
              position: stat.position,
              sport: stat.sport,
              team: stat.team,
              opponent: stat.opponent,
              game_date: stat.game_date,
              season: stat.season,
              week: stat.week,
              is_home: stat.is_home,
              
              // Target variables for ML (what we want to predict)
              fantasy_points: stat.fantasy_points || 0,
              dk_points: stat.dk_points || 0,
              fd_points: stat.fd_points || 0,
              yahoo_points: stat.yahoo_points || 0,
              espn_points: stat.espn_points || 0,
              
              // Context
              played: stat.played,
              started: stat.started,
              confidence_score: stat.confidence_score
            };

            // Add sport-specific features
            if (sport === 'NFL' && stat.nfl_stats) {
              return {
                ...baseRecord,
                // NFL-specific features for ML training
                passing_yards: stat.nfl_stats.passing_yards || 0,
                passing_tds: stat.nfl_stats.passing_tds || 0,
                passing_ints: stat.nfl_stats.passing_ints || 0,
                rushing_yards: stat.nfl_stats.rushing_yards || 0,
                rushing_tds: stat.nfl_stats.rushing_tds || 0,
                receiving_yards: stat.nfl_stats.receiving_yards || 0,
                receiving_tds: stat.nfl_stats.receiving_tds || 0,
                receptions: stat.nfl_stats.receptions || 0,
                targets: stat.nfl_stats.targets || 0,
                fumbles_lost: stat.nfl_stats.fumbles_lost || 0
              };
            } else if (sport === 'NBA' && stat.nba_stats) {
              return {
                ...baseRecord,
                // NBA-specific features for ML training
                points: stat.nba_stats.points || 0,
                rebounds: stat.nba_stats.rebounds || 0,
                assists: stat.nba_stats.assists || 0,
                steals: stat.nba_stats.steals || 0,
                blocks: stat.nba_stats.blocks || 0,
                turnovers: stat.nba_stats.turnovers || 0,
                minutes: stat.nba_stats.minutes || 0,
                field_goals_made: stat.nba_stats.field_goals_made || 0,
                field_goals_attempted: stat.nba_stats.field_goals_attempted || 0,
                three_pointers_made: stat.nba_stats.three_pointers_made || 0,
                three_pointers_attempted: stat.nba_stats.three_pointers_attempted || 0,
                free_throws_made: stat.nba_stats.free_throws_made || 0,
                free_throws_attempted: stat.nba_stats.free_throws_attempted || 0
              };
            } else if (sport === 'MLB' && stat.mlb_stats) {
              return {
                ...baseRecord,
                // MLB-specific features for ML training
                at_bats: stat.mlb_stats.at_bats || 0,
                hits: stat.mlb_stats.hits || 0,
                runs: stat.mlb_stats.runs || 0,
                rbis: stat.mlb_stats.rbis || 0,
                home_runs: stat.mlb_stats.home_runs || 0,
                doubles: stat.mlb_stats.doubles || 0,
                triples: stat.mlb_stats.triples || 0,
                walks: stat.mlb_stats.walks || 0,
                strikeouts: stat.mlb_stats.strikeouts || 0,
                stolen_bases: stat.mlb_stats.stolen_bases || 0,
                batting_average: stat.mlb_stats.batting_average || 0
              };
            } else if (sport === 'NHL' && stat.nhl_stats) {
              return {
                ...baseRecord,
                // NHL-specific features for ML training
                goals: stat.nhl_stats.goals || 0,
                assists: stat.nhl_stats.assists || 0,
                shots: stat.nhl_stats.shots || 0,
                saves: stat.nhl_stats.saves || 0,
                shots_against: stat.nhl_stats.shots_against || 0,
                time_on_ice: stat.nhl_stats.time_on_ice || 0,
                power_play_goals: stat.nhl_stats.power_play_goals || 0,
                power_play_assists: stat.nhl_stats.power_play_assists || 0,
                hits: stat.nhl_stats.hits || 0,
                blocked_shots: stat.nhl_stats.blocked_shots || 0,
                penalty_minutes: stat.nhl_stats.penalty_minutes || 0
              };
            }

            return baseRecord;
          });
          
          responseData.metadata.gameLogCount = responseData.gameLogs.length;
          
          // Update features list based on sport
          const sportFeatures = {
            'NFL': ['passing_yards', 'passing_tds', 'passing_ints', 'rushing_yards', 'rushing_tds', 
                   'receiving_yards', 'receiving_tds', 'receptions', 'targets', 'fumbles_lost'],
            'NBA': ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'minutes',
                   'field_goals_made', 'field_goals_attempted', 'three_pointers_made', 'three_pointers_attempted',
                   'free_throws_made', 'free_throws_attempted'],
            'MLB': ['at_bats', 'hits', 'runs', 'rbis', 'home_runs', 'doubles', 'triples', 
                   'walks', 'strikeouts', 'stolen_bases', 'batting_average'],
            'NHL': ['goals', 'assists', 'shots', 'saves', 'shots_against', 'time_on_ice',
                   'power_play_goals', 'power_play_assists', 'hits', 'blocked_shots', 'penalty_minutes']
          };
          
          responseData.metadata.features.gameStats = [
            'fantasy_points', 'dk_points', 'fd_points', 'yahoo_points', 'espn_points',
            'played', 'started', 'confidence_score',
            ...(sportFeatures[sport as keyof typeof sportFeatures] || [])
          ];
        }
      } catch (gameLogError) {
        logger.warn('Failed to fetch game logs for ML training:', gameLogError);
        responseData.metadata.gameLogsError = 'Game logs unavailable: ' + (gameLogError instanceof Error ? gameLogError.message : 'Unknown error');
      }
    }

    // Add data quality metrics
    responseData.metadata.dataQuality = {
      playersWithRating: mlPlayers.filter(p => p.overall_rating !== null).length,
      playersWithPhysicalStats: mlPlayers.filter(p => p.height_inches && p.weight_lbs).length,
      playersWithDraftInfo: mlPlayers.filter(p => p.draft_year && p.draft_round).length,
      playersWithSeasonStats: mlPlayers.filter(p => p.avg_fantasy_points !== null).length,
      completenessScore: Math.round(
        (mlPlayers.filter(p => p.overall_rating && p.height_inches && p.weight_lbs && p.avg_fantasy_points).length / mlPlayers.length) * 100
      )
    };

    logger.info('ML training data processed successfully', {
      sport,
      season,
      playerCount: responseData.metadata.playerCount,
      gameLogCount: responseData.metadata.gameLogCount,
      completenessScore: responseData.metadata.dataQuality.completenessScore
    });

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error('Failed to fetch ML training data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch ML training data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: MLTrainingRequest = await request.json();
    
    // This endpoint can be enhanced for custom ML training data requests
    // For now, redirect to GET with query parameters
    const queryParams = new URLSearchParams({
      sport: body.sport || 'NFL',
      positions: body.positions?.join(',') || 'QB,RB,WR,TE',
      limit: body.limit?.toString() || '1000',
      includeGameLogs: body.includeGameLogs?.toString() || 'false'
    });
    
    if (body.season) {
      queryParams.set('season', body.season);
    }
    
    const url = new URL(request.url);
    url.search = queryParams.toString();
    
    return NextResponse.redirect(url, { status: 307 });

  } catch (error) {
    logger.error('Failed to process ML training data request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}