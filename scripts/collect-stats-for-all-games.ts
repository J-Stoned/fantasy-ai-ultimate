#!/usr/bin/env tsx
/**
 * 📊 COLLECT STATS FOR ALL REAL GAMES
 * This will collect player stats for all 4,105 real games in our database
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameToProcess {
  id: string;
  external_id: string;
  sport: string;
  home_team_id: string;
  away_team_id: string;
  game_date: string;
  season: number;
}

interface PlayerStat {
  player_id: string;
  game_id: string;
  team_id: string;
  points?: number;
  assists?: number;
  rebounds?: number;
  touchdowns?: number;
  passing_yards?: number;
  rushing_yards?: number;
  receiving_yards?: number;
  hits?: number;
  runs?: number;
  rbis?: number;
  goals?: number;
  saves?: number;
}

class StatsCollector {
  private stats = {
    gamesProcessed: 0,
    statsCollected: 0,
    errors: 0,
    alreadyHasStats: 0
  };

  async run() {
    console.log(chalk.bold.cyan('📊 COLLECTING STATS FOR ALL REAL GAMES'));
    console.log(chalk.cyan('=' .repeat(50)));
    
    try {
      // Get all games without stats
      const games = await this.getGamesWithoutStats();
      console.log(chalk.yellow(`\nFound ${games.length} games without stats\n`));
      
      if (games.length === 0) {
        console.log(chalk.green('✅ All games already have stats!'));
        return;
      }
      
      // Process games by sport
      const gamesBySport = this.groupBySport(games);
      
      for (const [sport, sportGames] of Object.entries(gamesBySport)) {
        console.log(chalk.bold.yellow(`\n🏀 Processing ${sport.toUpperCase()} games: ${sportGames.length}`));
        await this.processGamesForSport(sport, sportGames);
      }
      
      this.printSummary();
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    }
  }

  private async getGamesWithoutStats(): Promise<GameToProcess[]> {
    // First, get games that have stats
    const { data: gamesWithStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null);
    
    const gameIdsWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
    
    // Get all real games
    const { data: allGames, error } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time')
      .not('external_id', 'is', null)
      .eq('status', 'completed')  // Only completed games
      .order('start_time', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch games: ${error.message}`);
    }
    
    // Filter out games that already have stats and map to expected format
    return (allGames || [])
      .filter(game => !gameIdsWithStats.has(game.id))
      .map(game => ({
        ...game,
        game_date: game.start_time,
        season: new Date(game.start_time).getFullYear()
      }));
  }

  private groupBySport(games: GameToProcess[]): Record<string, GameToProcess[]> {
    return games.reduce((acc, game) => {
      const sport = game.sport || 'unknown';
      if (!acc[sport]) acc[sport] = [];
      acc[sport].push(game);
      return acc;
    }, {} as Record<string, GameToProcess[]>);
  }

  private async processGamesForSport(sport: string, games: GameToProcess[]) {
    const processor = this.getProcessorForSport(sport);
    
    if (!processor) {
      console.log(chalk.red(`❌ No processor for sport: ${sport}`));
      return;
    }
    
    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      
      // Process games sequentially to avoid rate limits
      for (const game of batch) {
        await this.processGame(game, processor);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const progress = Math.min(i + batchSize, games.length);
      console.log(chalk.cyan(`Progress: ${progress}/${games.length} ${sport} games`));
    }
  }

  private async processGame(
    game: GameToProcess, 
    processor: (game: GameToProcess) => Promise<PlayerStat[]>
  ) {
    try {
      const stats = await processor.call(this, game);
      
      if (stats.length > 0) {
        // Insert stats
        const { error } = await supabase
          .from('player_stats')
          .insert(stats);
        
        if (!error) {
          this.stats.statsCollected += stats.length;
          this.stats.gamesProcessed++;
        } else {
          console.error(chalk.red(`Error inserting stats for game ${game.id}:`), error);
          this.stats.errors++;
        }
      }
      
    } catch (error) {
      console.error(chalk.red(`Error processing game ${game.id}:`), error);
      this.stats.errors++;
    }
  }

  private getProcessorForSport(sport: string): ((game: GameToProcess) => Promise<PlayerStat[]>) | null {
    switch (sport.toLowerCase()) {
      case 'football':
        return this.processNFLGame;
      case 'basketball':
        return this.processNBAGame;
      case 'baseball':
        return this.processMLBGame;
      case 'hockey':
        return this.processNHLGame;
      default:
        return null;
    }
  }

  private async processNFLGame(game: GameToProcess): Promise<PlayerStat[]> {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.external_id}`
      );
      
      const stats: PlayerStat[] = [];
      const boxscore = response.data.boxscore;
      
      if (!boxscore?.players) return stats;
      
      // Process each team's players
      for (const team of boxscore.players) {
        const teamId = team.team.id;
        
        // Process different stat categories
        const categories = ['passing', 'rushing', 'receiving'];
        
        for (const category of categories) {
          const categoryStats = team.statistics?.find((s: any) => s.name === category);
          if (!categoryStats?.athletes) continue;
          
          for (const athlete of categoryStats.athletes) {
            const stat: PlayerStat = {
              player_id: athlete.athlete.id,
              game_id: game.id,
              team_id: teamId
            };
            
            // Parse stats based on category
            if (category === 'passing' && athlete.stats?.length >= 2) {
              stat.passing_yards = parseInt(athlete.stats[1]) || 0;
              stat.touchdowns = parseInt(athlete.stats[2]) || 0;
            } else if (category === 'rushing' && athlete.stats?.length >= 2) {
              stat.rushing_yards = parseInt(athlete.stats[1]) || 0;
              stat.touchdowns = parseInt(athlete.stats[2]) || 0;
            } else if (category === 'receiving' && athlete.stats?.length >= 2) {
              stat.receiving_yards = parseInt(athlete.stats[2]) || 0;
              stat.touchdowns = parseInt(athlete.stats[3]) || 0;
            }
            
            stats.push(stat);
          }
        }
      }
      
      return stats;
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Game data not available
        return [];
      }
      throw error;
    }
  }

  private async processNBAGame(game: GameToProcess): Promise<PlayerStat[]> {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.external_id}`
      );
      
      const stats: PlayerStat[] = [];
      const boxscore = response.data.boxscore;
      
      if (!boxscore?.players) return stats;
      
      for (const team of boxscore.players) {
        const teamId = team.team.id;
        const athletes = team.statistics?.[0]?.athletes || [];
        
        for (const athlete of athletes) {
          if (!athlete.stats?.length) continue;
          
          stats.push({
            player_id: athlete.athlete.id,
            game_id: game.id,
            team_id: teamId,
            points: parseInt(athlete.stats[0]) || 0,
            rebounds: parseInt(athlete.stats[1]) || 0,
            assists: parseInt(athlete.stats[2]) || 0
          });
        }
      }
      
      return stats;
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  private async processMLBGame(game: GameToProcess): Promise<PlayerStat[]> {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${game.external_id}`
      );
      
      const stats: PlayerStat[] = [];
      const boxscore = response.data.boxscore;
      
      if (!boxscore?.players) return stats;
      
      for (const team of boxscore.players) {
        const teamId = team.team.id;
        const batting = team.statistics?.find((s: any) => s.name === 'batting');
        
        if (!batting?.athletes) continue;
        
        for (const athlete of batting.athletes) {
          if (!athlete.stats?.length) continue;
          
          stats.push({
            player_id: athlete.athlete.id,
            game_id: game.id,
            team_id: teamId,
            hits: parseInt(athlete.stats[1]) || 0,
            runs: parseInt(athlete.stats[2]) || 0,
            rbis: parseInt(athlete.stats[3]) || 0
          });
        }
      }
      
      return stats;
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  private async processNHLGame(game: GameToProcess): Promise<PlayerStat[]> {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.external_id}`
      );
      
      const stats: PlayerStat[] = [];
      const boxscore = response.data.boxscore;
      
      if (!boxscore?.players) return stats;
      
      for (const team of boxscore.players) {
        const teamId = team.team.id;
        const skaters = team.statistics?.find((s: any) => s.name === 'skaters');
        
        if (!skaters?.athletes) continue;
        
        for (const athlete of skaters.athletes) {
          if (!athlete.stats?.length) continue;
          
          stats.push({
            player_id: athlete.athlete.id,
            game_id: game.id,
            team_id: teamId,
            goals: parseInt(athlete.stats[0]) || 0,
            assists: parseInt(athlete.stats[1]) || 0
          });
        }
      }
      
      return stats;
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  private printSummary() {
    console.log(chalk.bold.green('\n📊 COLLECTION COMPLETE!'));
    console.log(chalk.green('=' .repeat(50)));
    console.log(chalk.white(`Games processed: ${this.stats.gamesProcessed}`));
    console.log(chalk.white(`Stats collected: ${this.stats.statsCollected}`));
    console.log(chalk.white(`Already had stats: ${this.stats.alreadyHasStats}`));
    console.log(chalk.white(`Errors: ${this.stats.errors}`));
    
    const avgStatsPerGame = this.stats.gamesProcessed > 0 
      ? (this.stats.statsCollected / this.stats.gamesProcessed).toFixed(1)
      : '0';
    
    console.log(chalk.cyan(`\nAverage stats per game: ${avgStatsPerGame}`));
    
    if (this.stats.statsCollected > 0) {
      console.log(chalk.bold.magenta('\n🎯 Ready for pattern detection with full stats!'));
    }
  }
}

// Run the collector
const collector = new StatsCollector();
collector.run().catch(console.error);