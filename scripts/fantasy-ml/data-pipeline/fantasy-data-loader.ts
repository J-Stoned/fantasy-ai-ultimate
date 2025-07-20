#!/usr/bin/env tsx
/**
 * 🎯 Fantasy Sports Data Loader
 * Loads and prepares data for fantasy ML models from our 1M+ stats database
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface PlayerStats {
  player_id: string;
  player_name: string;
  team_id: string;
  game_date: Date;
  opponent_id: string;
  is_home: boolean;
  stats: Record<string, any>;
  fantasy_points?: number;
  dfs_salary?: number;
  ownership_projection?: number;
}

export interface TeamMetrics {
  team_id: string;
  offensive_rating: number;
  defensive_rating: number;
  pace: number;
  home_advantage: number;
}

export interface PlayerProjection {
  player_id: string;
  projected_points: number;
  floor: number;
  ceiling: number;
  consistency_score: number;
  breakout_probability: number;
}

export class FantasyDataLoader {
  /**
   * Load player game logs with fantasy-relevant stats
   */
  async loadPlayerGameLogs(
    sport: string, 
    startDate: string, 
    endDate: string,
    limit: number = 10000
  ): Promise<PlayerStats[]> {
    console.log(chalk.cyan(`Loading ${sport} player game logs from ${startDate} to ${endDate}...`));
    
    const { data, error } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        game_id,
        stats,
        players!inner (
          name,
          team_id,
          position
        ),
        games!inner (
          start_time,
          home_team_id,
          away_team_id,
          sport
        )
      `)
      .eq('games.sport', sport)
      .gte('games.start_time', startDate)
      .lte('games.start_time', endDate)
      .limit(limit);

    if (error) {
      console.error(chalk.red('Error loading game logs:'), error);
      return [];
    }

    // Transform to fantasy-friendly format
    return data.map((log: any) => ({
      player_id: log.player_id,
      player_name: log.players.name,
      team_id: log.players.team_id,
      game_date: new Date(log.games.start_time),
      opponent_id: log.players.team_id === log.games.home_team_id 
        ? log.games.away_team_id 
        : log.games.home_team_id,
      is_home: log.players.team_id === log.games.home_team_id,
      stats: log.stats,
      fantasy_points: this.calculateFantasyPoints(log.stats, sport)
    }));
  }

  /**
   * Load DFS salaries and ownership projections
   */
  async loadDFSData(sport: string, date: string): Promise<any[]> {
    console.log(chalk.cyan(`Loading DFS data for ${sport} on ${date}...`));
    
    const { data: salaries } = await supabase
      .from('dfs_salaries')
      .select('*')
      .eq('sport', sport)
      .eq('slate_date', date);

    const { data: ownership } = await supabase
      .from('dfs_ownership_projections')
      .select('*')
      .eq('sport', sport)
      .eq('slate_date', date);

    // Merge salary and ownership data
    const dfsMap = new Map();
    
    salaries?.forEach(s => {
      dfsMap.set(s.player_id, {
        player_id: s.player_id,
        salary: s.salary,
        platform: s.platform,
        position: s.position
      });
    });

    ownership?.forEach(o => {
      if (dfsMap.has(o.player_id)) {
        dfsMap.get(o.player_id).ownership_projection = o.projected_ownership;
      }
    });

    return Array.from(dfsMap.values());
  }

  /**
   * Load advanced player metrics
   */
  async loadAdvancedMetrics(playerIds: string[]): Promise<Map<string, any>> {
    console.log(chalk.cyan(`Loading advanced metrics for ${playerIds.length} players...`));
    
    const { data, error } = await supabase
      .from('advanced_player_metrics')
      .select('*')
      .in('player_id', playerIds);

    if (error) {
      console.error(chalk.red('Error loading advanced metrics:'), error);
      return new Map();
    }

    const metricsMap = new Map();
    data.forEach(m => {
      metricsMap.set(m.player_id, m);
    });

    return metricsMap;
  }

  /**
   * Load player injuries and availability
   */
  async loadInjuryData(date: string): Promise<Map<string, any>> {
    console.log(chalk.cyan(`Loading injury data for ${date}...`));
    
    const { data, error } = await supabase
      .from('player_injuries')
      .select('*')
      .lte('start_date', date)
      .or(`end_date.gte.${date},end_date.is.null`);

    if (error) {
      console.error(chalk.red('Error loading injuries:'), error);
      return new Map();
    }

    const injuryMap = new Map();
    data.forEach(injury => {
      injuryMap.set(injury.player_id, {
        status: injury.status,
        description: injury.description,
        return_date: injury.return_date
      });
    });

    return injuryMap;
  }

  /**
   * Load weather data for outdoor sports
   */
  async loadWeatherData(gameIds: number[]): Promise<Map<number, any>> {
    console.log(chalk.cyan(`Loading weather data for ${gameIds.length} games...`));
    
    const { data, error } = await supabase
      .from('weather_data')
      .select('*')
      .in('game_id', gameIds);

    if (error) {
      console.error(chalk.red('Error loading weather:'), error);
      return new Map();
    }

    const weatherMap = new Map();
    data.forEach(w => {
      weatherMap.set(w.game_id, {
        temperature: w.temperature,
        wind_speed: w.wind_speed,
        precipitation: w.precipitation_chance,
        conditions: w.weather_condition
      });
    });

    return weatherMap;
  }

  /**
   * Calculate fantasy points based on sport-specific scoring
   */
  private calculateFantasyPoints(stats: any, sport: string): number {
    if (!stats) return 0;

    switch (sport) {
      case 'nfl':
        return this.calculateNFLFantasyPoints(stats);
      case 'nba':
        return this.calculateNBAFantasyPoints(stats);
      case 'mlb':
        return this.calculateMLBFantasyPoints(stats);
      case 'nhl':
        return this.calculateNHLFantasyPoints(stats);
      default:
        return 0;
    }
  }

  private calculateNFLFantasyPoints(stats: any): number {
    let points = 0;
    
    // Passing
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_touchdowns || 0) * 4;
    points += (stats.passing_interceptions || 0) * -2;
    
    // Rushing
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_touchdowns || 0) * 6;
    
    // Receiving
    points += (stats.receptions || 0) * 1; // PPR
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_touchdowns || 0) * 6;
    
    // Fumbles
    points += (stats.fumbles_lost || 0) * -2;
    
    return points;
  }

  private calculateNBAFantasyPoints(stats: any): number {
    // DraftKings scoring
    let points = 0;
    
    points += (stats.points || 0) * 1;
    points += (stats.rebounds || 0) * 1.25;
    points += (stats.assists || 0) * 1.5;
    points += (stats.steals || 0) * 2;
    points += (stats.blocks || 0) * 2;
    points += (stats.turnovers || 0) * -0.5;
    
    // Double-double bonus
    const doubleCount = [
      stats.points >= 10,
      stats.rebounds >= 10,
      stats.assists >= 10,
      stats.steals >= 10,
      stats.blocks >= 10
    ].filter(Boolean).length;
    
    if (doubleCount >= 2) points += 1.5;
    if (doubleCount >= 3) points += 1.5; // Triple-double
    
    return points;
  }

  private calculateMLBFantasyPoints(stats: any): number {
    let points = 0;
    
    // Hitting
    points += (stats.singles || 0) * 3;
    points += (stats.doubles || 0) * 5;
    points += (stats.triples || 0) * 8;
    points += (stats.home_runs || 0) * 10;
    points += (stats.rbis || 0) * 2;
    points += (stats.runs || 0) * 2;
    points += (stats.walks || 0) * 2;
    points += (stats.stolen_bases || 0) * 5;
    
    // Pitching
    points += (stats.innings_pitched || 0) * 2.25;
    points += (stats.strikeouts || 0) * 2;
    points += (stats.wins || 0) * 4;
    points += (stats.earned_runs || 0) * -2;
    points += (stats.hits_allowed || 0) * -0.6;
    points += (stats.walks_allowed || 0) * -0.6;
    
    return points;
  }

  private calculateNHLFantasyPoints(stats: any): number {
    let points = 0;
    
    // Skaters
    points += (stats.goals || 0) * 3;
    points += (stats.assists || 0) * 2;
    points += (stats.shots || 0) * 0.5;
    points += (stats.blocked_shots || 0) * 0.5;
    
    // Goalies
    points += (stats.wins || 0) * 3;
    points += (stats.saves || 0) * 0.2;
    points += (stats.goals_against || 0) * -1;
    points += (stats.shutouts || 0) * 2;
    
    return points;
  }

  /**
   * Prepare feature matrix for ML models
   */
  async prepareFeatures(
    playerStats: PlayerStats[], 
    lookbackGames: number = 10
  ): Promise<any[]> {
    console.log(chalk.cyan('Preparing feature matrix for ML models...'));
    
    // Group by player
    const playerGroups = new Map<string, PlayerStats[]>();
    playerStats.forEach(stat => {
      if (!playerGroups.has(stat.player_id)) {
        playerGroups.set(stat.player_id, []);
      }
      playerGroups.get(stat.player_id)!.push(stat);
    });

    const features: any[] = [];
    
    for (const [playerId, games] of playerGroups) {
      // Sort by date
      games.sort((a, b) => a.game_date.getTime() - b.game_date.getTime());
      
      // Calculate rolling averages and features
      for (let i = lookbackGames; i < games.length; i++) {
        const recentGames = games.slice(i - lookbackGames, i);
        const currentGame = games[i];
        
        features.push({
          player_id: playerId,
          game_date: currentGame.game_date,
          
          // Recent performance
          avg_fantasy_points: this.average(recentGames.map(g => g.fantasy_points || 0)),
          std_fantasy_points: this.standardDeviation(recentGames.map(g => g.fantasy_points || 0)),
          trend_fantasy_points: this.calculateTrend(recentGames.map(g => g.fantasy_points || 0)),
          
          // Home/away splits
          home_avg: this.average(recentGames.filter(g => g.is_home).map(g => g.fantasy_points || 0)),
          away_avg: this.average(recentGames.filter(g => !g.is_home).map(g => g.fantasy_points || 0)),
          
          // Days rest
          days_rest: this.calculateDaysRest(recentGames, i),
          
          // Target (what we're predicting)
          actual_fantasy_points: currentGame.fantasy_points
        });
      }
    }
    
    return features;
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private standardDeviation(numbers: number[]): number {
    const avg = this.average(numbers);
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return Math.sqrt(this.average(squareDiffs));
  }

  private calculateTrend(numbers: number[]): number {
    if (numbers.length < 2) return 0;
    
    // Simple linear regression slope
    const n = numbers.length;
    const xSum = (n * (n - 1)) / 2;
    const xMean = xSum / n;
    const yMean = this.average(numbers);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (numbers[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateDaysRest(games: PlayerStats[], currentIndex: number): number {
    if (currentIndex === 0) return 7; // Default rest
    
    const currentDate = games[currentIndex].game_date;
    const previousDate = games[currentIndex - 1].game_date;
    
    return Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const fantasyDataLoader = new FantasyDataLoader();