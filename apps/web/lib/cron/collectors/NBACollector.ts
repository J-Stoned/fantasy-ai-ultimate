import { supabase } from '../../supabase/client';
import { cronLogger } from '../../utils/logger';

interface NBAPlayerStats {
  player_id: string;
  game_id: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_pointers_made: number;
  three_pointers_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
}

export class NBACollector {
  async collectLiveScores() {
    cronLogger.info('Collecting NBA live scores');
    
    try {
      const games = await this.getMockLiveGames();
      
      for (const game of games) {
        await this.updateGameInDatabase(game);
      }
      
      cronLogger.info('Updated NBA games', { count: games.length });
    } catch (error) {
      cronLogger.error('NBA score collection failed', error);
      throw error;
    }
  }

  async collectPlayerStats() {
    cronLogger.info('Collecting NBA player stats');
    
    try {
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .eq('sport_id', await this.getNBASportId())
        .eq('game_date', new Date().toISOString().split('T')[0]);

      if (!games || games.length === 0) {
        cronLogger.info('No NBA games today');
        return;
      }

      for (const game of games) {
        const stats = await this.getMockPlayerStats(game.id);
        await this.updatePlayerStats(stats);
      }
      
      cronLogger.info('Updated NBA stats', { gameCount: games.length });
    } catch (error) {
      cronLogger.error('NBA stats collection failed', error);
      throw error;
    }
  }

  private async updateGameInDatabase(game: any) {
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
        sport_id: await this.getNBASportId(),
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

  private async updatePlayerStats(stats: NBAPlayerStats[]) {
    for (const stat of stats) {
      const season = new Date().getFullYear();
      
      await supabase
        .from('player_stats')
        .upsert({
          player_id: stat.player_id,
          season,
          season_type: 'regular',
          stats: {
            minutes: stat.minutes,
            points: stat.points,
            rebounds: stat.rebounds,
            assists: stat.assists,
            steals: stat.steals,
            blocks: stat.blocks,
            turnovers: stat.turnovers,
            field_goals_made: stat.field_goals_made,
            field_goals_attempted: stat.field_goals_attempted,
            three_pointers_made: stat.three_pointers_made,
            three_pointers_attempted: stat.three_pointers_attempted,
            free_throws_made: stat.free_throws_made,
            free_throws_attempted: stat.free_throws_attempted,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id,season,season_type',
        });

      await supabase
        .from('player_game_logs')
        .upsert({
          player_id: stat.player_id,
          game_id: stat.game_id,
          game_date: new Date().toISOString().split('T')[0],
          stats: stat,
        });
    }
  }

  private async getNBASportId(): Promise<string> {
    const { data } = await supabase
      .from('sports')
      .select('id')
      .eq('sport_type', 'basketball')
      .single();
    
    return data?.id;
  }

  private async getMockLiveGames() {
    return [
      {
        id: 'nba-game-001',
        home_team: 'LAL',
        away_team: 'BOS',
        home_score: 98,
        away_score: 102,
        status: 'in_progress',
        quarter: '4th',
        time_remaining: '3:21',
        date: new Date().toISOString().split('T')[0],
      },
      {
        id: 'nba-game-002',
        home_team: 'GSW',
        away_team: 'MIA',
        home_score: 88,
        away_score: 85,
        status: 'in_progress',
        quarter: '3rd',
        time_remaining: '7:45',
        date: new Date().toISOString().split('T')[0],
      },
    ];
  }

  private async getMockPlayerStats(gameId: string): Promise<NBAPlayerStats[]> {
    return [
      {
        player_id: 'nba-player-001',
        game_id: gameId,
        minutes: 32,
        points: 28,
        rebounds: 8,
        assists: 6,
        steals: 2,
        blocks: 1,
        turnovers: 3,
        field_goals_made: 10,
        field_goals_attempted: 18,
        three_pointers_made: 3,
        three_pointers_attempted: 7,
        free_throws_made: 5,
        free_throws_attempted: 6,
      },
      {
        player_id: 'nba-player-002',
        game_id: gameId,
        minutes: 28,
        points: 22,
        rebounds: 12,
        assists: 3,
        steals: 1,
        blocks: 2,
        turnovers: 2,
        field_goals_made: 9,
        field_goals_attempted: 15,
        three_pointers_made: 1,
        three_pointers_attempted: 3,
        free_throws_made: 3,
        free_throws_attempted: 4,
      },
    ];
  }
}