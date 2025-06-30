import { supabase } from '../../supabase/client';
import axios from 'axios';
import { cronLogger } from '../../utils/logger';

interface NFLGame {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  quarter: string;
  time_remaining: string;
  date: string;
}

interface NFLPlayerStats {
  player_id: string;
  game_id: string;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  fumbles_lost?: number;
}

export class NFLCollector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.sportsdata.io/v3/nfl/scores/json';

  constructor() {
    this.apiKey = process.env.SPORTSDATA_API_KEY;
  }

  async collectLiveScores() {
    cronLogger.info('Collecting NFL live scores');
    
    try {
      // For demo, we'll simulate data since we don't have real API keys yet
      const mockGames = await this.getMockLiveGames();
      
      for (const game of mockGames) {
        await this.updateGameInDatabase(game);
      }
      
      cronLogger.info('Updated NFL games', { count: mockGames.length });
    } catch (error) {
      cronLogger.error('NFL score collection failed', error);
      throw error;
    }
  }

  async collectPlayerStats() {
    cronLogger.info('Collecting NFL player stats');
    
    try {
      // Get today's games
      const { data: games } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id')
        .eq('sport_id', await this.getNFLSportId())
        .eq('game_date', new Date().toISOString().split('T')[0]);

      if (!games || games.length === 0) {
        cronLogger.info('No NFL games today');
        return;
      }

      // For each game, collect player stats
      for (const game of games) {
        const stats = await this.getMockPlayerStats(game.id);
        await this.updatePlayerStats(stats);
      }
      
      cronLogger.info('Updated NFL stats', { gameCount: games.length });
    } catch (error) {
      cronLogger.error('NFL stats collection failed', error);
      throw error;
    }
  }

  async collectInjuryReports() {
    cronLogger.info('Collecting NFL injury reports');
    
    try {
      const injuries = await this.getMockInjuryReports();
      
      for (const injury of injuries) {
        await supabase
          .from('player_injuries')
          .upsert({
            player_id: injury.player_id,
            injury_type: injury.type,
            body_part: injury.body_part,
            status: injury.status,
            description: injury.description,
            reported_date: new Date().toISOString(),
            is_active: true,
          }, {
            onConflict: 'player_id,is_active',
          });
      }
      
      cronLogger.info('Updated injury reports', { count: injuries.length });
    } catch (error) {
      cronLogger.error('NFL injury collection failed', error);
      throw error;
    }
  }

  private async updateGameInDatabase(game: NFLGame) {
    const { data: teams } = await supabase
      .from('teams_master')
      .select('id, abbreviation')
      .in('abbreviation', [game.home_team, game.away_team]);

    if (!teams || teams.length !== 2) return;

    const homeTeam = teams.find(t => t.abbreviation === game.home_team);
    const awayTeam = teams.find(t => t.abbreviation === game.away_team);

    await supabase
      .from('games')
      .upsert({
        id: game.id,
        sport_id: await this.getNFLSportId(),
        home_team_id: homeTeam?.id,
        away_team_id: awayTeam?.id,
        game_date: game.date,
        status: game.status,
        period: game.quarter,
        time_remaining: game.time_remaining,
        final_score_home: game.home_score,
        final_score_away: game.away_score,
        updated_at: new Date().toISOString(),
      });
  }

  private async updatePlayerStats(stats: NFLPlayerStats[]) {
    for (const stat of stats) {
      // Get current season
      const season = new Date().getFullYear();
      
      // Update player stats
      await supabase
        .from('player_stats')
        .upsert({
          player_id: stat.player_id,
          season,
          season_type: 'regular',
          stats: {
            passing_yards: stat.passing_yards || 0,
            passing_tds: stat.passing_tds || 0,
            interceptions: stat.interceptions || 0,
            rushing_yards: stat.rushing_yards || 0,
            rushing_tds: stat.rushing_tds || 0,
            receptions: stat.receptions || 0,
            receiving_yards: stat.receiving_yards || 0,
            receiving_tds: stat.receiving_tds || 0,
            fumbles_lost: stat.fumbles_lost || 0,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id,season,season_type',
        });

      // Also update game log
      await supabase
        .from('player_game_logs')
        .upsert({
          player_id: stat.player_id,
          game_id: stat.game_id,
          game_date: new Date().toISOString().split('T')[0],
          stats: {
            passing_yards: stat.passing_yards || 0,
            passing_tds: stat.passing_tds || 0,
            interceptions: stat.interceptions || 0,
            rushing_yards: stat.rushing_yards || 0,
            rushing_tds: stat.rushing_tds || 0,
            receptions: stat.receptions || 0,
            receiving_yards: stat.receiving_yards || 0,
            receiving_tds: stat.receiving_tds || 0,
            fumbles_lost: stat.fumbles_lost || 0,
          },
        });
    }
  }

  private async getNFLSportId(): Promise<string> {
    const { data } = await supabase
      .from('sports')
      .select('id')
      .eq('sport_type', 'football')
      .single();
    
    return data?.id;
  }

  // Mock data generators for demo
  private async getMockLiveGames(): Promise<NFLGame[]> {
    return [
      {
        id: 'nfl-game-001',
        home_team: 'NE',
        away_team: 'DAL',
        home_score: 21,
        away_score: 17,
        status: 'in_progress',
        quarter: '3rd',
        time_remaining: '8:45',
        date: new Date().toISOString().split('T')[0],
      },
      {
        id: 'nfl-game-002',
        home_team: 'KC',
        away_team: 'SF',
        home_score: 14,
        away_score: 14,
        status: 'in_progress',
        quarter: '2nd',
        time_remaining: '2:30',
        date: new Date().toISOString().split('T')[0],
      },
    ];
  }

  private async getMockPlayerStats(gameId: string): Promise<NFLPlayerStats[]> {
    // In real implementation, this would fetch from sports API
    return [
      {
        player_id: 'player-001',
        game_id: gameId,
        passing_yards: 285,
        passing_tds: 2,
        interceptions: 1,
        rushing_yards: 15,
      },
      {
        player_id: 'player-002',
        game_id: gameId,
        rushing_yards: 95,
        rushing_tds: 1,
        receptions: 3,
        receiving_yards: 25,
      },
    ];
  }

  private async getMockInjuryReports() {
    return [
      {
        player_id: 'player-001',
        type: 'strain',
        body_part: 'hamstring',
        status: 'questionable',
        description: 'Limited in practice',
      },
    ];
  }
}