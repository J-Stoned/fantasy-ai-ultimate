#!/usr/bin/env tsx
/**
 * 🏀 NBA 95% COLLECTOR - Focused collector to get remaining 33 games
 * Uses smart ESPN API strategies and retry logic
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameToCollect {
  id: number;
  external_id: string;
  home_team_id: number;
  away_team_id: number;
  start_time: string;
  home_score: number;
  away_score: number;
}

class NBA95PercentCollector {
  private espnApi: AxiosInstance;
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, string>();
  private successCount = 0;
  private failureCount = 0;
  private collectedGames: number[] = [];
  
  constructor() {
    this.espnApi = axios.create({
      baseURL: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }
  
  async collect() {
    console.log(chalk.bold.cyan('\n🏀 NBA 95% COLLECTOR - ACHIEVING GOLD STANDARD\n'));
    
    try {
      // 1. Load caches
      await this.loadCaches();
      
      // 2. Get current coverage
      const coverage = await this.getCurrentCoverage();
      console.log(chalk.yellow(`Current NBA coverage: ${coverage.current}% (${coverage.gamesWithStats}/${coverage.totalGames})`));
      console.log(chalk.green(`Target: 95% (${coverage.targetGames} games)`));
      console.log(chalk.cyan(`Need: ${coverage.gamesNeeded} more games\n`));
      
      if (coverage.gamesNeeded <= 0) {
        console.log(chalk.bold.green('🎉 ALREADY AT 95%+ COVERAGE!'));
        return;
      }
      
      // 3. Get missing games
      const missingGames = await this.getMissingGames();
      console.log(chalk.gray(`Found ${missingGames.length} games without stats`));
      
      // 4. Process games with smart strategies
      const targetCount = Math.min(coverage.gamesNeeded + 5, missingGames.length); // +5 buffer
      
      for (let i = 0; i < targetCount && i < missingGames.length; i++) {
        const game = missingGames[i];
        
        // Get team names for logging
        const homeTeam = this.teamCache.get(game.home_team_id) || 'Unknown';
        const awayTeam = this.teamCache.get(game.away_team_id) || 'Unknown';
        const gameDate = new Date(game.start_time).toLocaleDateString();
        
        console.log(chalk.cyan(`\n[${i + 1}/${targetCount}] ${gameDate}: ${awayTeam} @ ${homeTeam}`));
        console.log(chalk.gray(`Game ID: ${game.id}, ESPN: ${game.external_id}`));
        
        const success = await this.collectGameStats(game);
        
        if (success) {
          this.successCount++;
          this.collectedGames.push(game.id);
          console.log(chalk.green(`✅ Successfully collected stats`));
          
          // Check if we've reached 95%
          const newCoverage = await this.getCurrentCoverage();
          if (newCoverage.currentPercent >= 95) {
            console.log(chalk.bold.green('\n🎉 ACHIEVED 95% COVERAGE! STOPPING COLLECTION.'));
            break;
          }
        } else {
          this.failureCount++;
          console.log(chalk.red(`❌ Failed to collect stats`));
        }
        
        // Save progress every 5 games
        if ((i + 1) % 5 === 0) {
          await this.saveProgress();
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 5. Generate final report
      await this.generateFinalReport();
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    }
  }
  
  private async loadCaches() {
    // Load players
    console.log(chalk.gray('Loading player cache...'));
    const { data: players } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('sport', 'nba');
    
    if (players) {
      players.forEach(player => {
        this.playerCache.set(player.name.toLowerCase(), player.id);
        this.playerCache.set(this.normalizePlayerName(player.name), player.id);
        
        // Also cache by last name
        const lastName = player.name.split(' ').slice(-1)[0].toLowerCase();
        if (!this.playerCache.has(lastName)) {
          this.playerCache.set(lastName, player.id);
        }
        
        if (player.external_id) {
          this.playerCache.set(player.external_id, player.id);
        }
      });
    }
    
    // Load teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, sport_id')
      .eq('sport_id', 'nba');
    
    if (teams) {
      teams.forEach(team => {
        this.teamCache.set(team.id, team.name);
      });
    }
    
    console.log(chalk.gray(`Loaded ${this.playerCache.size} player entries, ${this.teamCache.size} teams`));
  }
  
  private async getCurrentCoverage() {
    const { data: games, count: totalGames } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    if (!games || !totalGames) {
      throw new Error('Failed to get game count');
    }
    
    // Count games with stats
    let gamesWithStats = 0;
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (count && count > 0) gamesWithStats++;
    }
    
    const currentPercent = ((gamesWithStats / totalGames) * 100);
    const targetGames = Math.ceil(totalGames * 0.95);
    const gamesNeeded = targetGames - gamesWithStats;
    
    return {
      totalGames,
      gamesWithStats,
      current: currentPercent.toFixed(1),
      currentPercent,
      targetGames,
      gamesNeeded
    };
  }
  
  private async getMissingGames(): Promise<GameToCollect[]> {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false });
    
    if (!games) return [];
    
    const missingGames: GameToCollect[] = [];
    
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (!count || count === 0) {
        missingGames.push(game);
      }
    }
    
    return missingGames;
  }
  
  private async collectGameStats(game: GameToCollect): Promise<boolean> {
    try {
      // Extract ESPN game ID
      const espnId = game.external_id.replace(/^espn_nba_/, '');
      
      // Try multiple endpoints
      const endpoints = [
        `/summary?event=${espnId}`,
        `/boxscore?gameId=${espnId}`,
        `/game?gameId=${espnId}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await this.espnApi.get(endpoint);
          const stats = this.parseGameStats(response.data, endpoint);
          
          if (stats && stats.length >= 10) {
            await this.saveStats(game, stats);
            return true;
          }
        } catch (error) {
          // Try next endpoint
          continue;
        }
      }
      
      // Last resort: try constructing URL from date
      const gameDate = new Date(game.start_time);
      const dateStr = gameDate.toISOString().split('T')[0].replace(/-/g, '');
      
      try {
        const response = await this.espnApi.get(`/scoreboard?dates=${dateStr}`);
        const games = response.data.events || [];
        
        // Find matching game
        for (const espnGame of games) {
          if (espnGame.id === espnId || espnGame.id === game.external_id) {
            const summaryResponse = await this.espnApi.get(`/summary?event=${espnGame.id}`);
            const stats = this.parseGameStats(summaryResponse.data, 'summary');
            
            if (stats && stats.length >= 10) {
              await this.saveStats(game, stats);
              return true;
            }
          }
        }
      } catch (error) {
        // Failed all attempts
      }
      
      return false;
      
    } catch (error) {
      console.error(chalk.red('Collection error:'), error instanceof Error ? error.message : 'Unknown');
      return false;
    }
  }
  
  private parseGameStats(data: any, endpoint: string): any[] | null {
    try {
      const stats: any[] = [];
      
      // Handle different response formats
      if (data.boxscore?.players) {
        // Standard boxscore format
        for (const team of data.boxscore.players) {
          const athletes = team.statistics?.[0]?.athletes || [];
          
          for (const player of athletes) {
            const playerStats = this.parsePlayerStats(player);
            if (playerStats) {
              stats.push(playerStats);
            }
          }
        }
      } else if (data.gamepackageJSON?.boxscore) {
        // Alternative format
        const boxscore = data.gamepackageJSON.boxscore;
        for (const team of boxscore.players || []) {
          for (const player of team.statistics?.[0]?.athletes || []) {
            const playerStats = this.parsePlayerStats(player);
            if (playerStats) {
              stats.push(playerStats);
            }
          }
        }
      }
      
      return stats.length >= 10 ? stats : null;
      
    } catch (error) {
      return null;
    }
  }
  
  private parsePlayerStats(player: any): any | null {
    try {
      if (!player.athlete || !player.stats || player.stats.length < 15) {
        return null;
      }
      
      const playerId = this.findPlayerId(player.athlete.displayName);
      if (!playerId) return null;
      
      // Parse stats array
      const stats = player.stats;
      const parsed = {
        minutes: stats[0] || '0',
        fieldGoals: stats[1] || '0-0',
        threePointers: stats[2] || '0-0',
        freeThrows: stats[3] || '0-0',
        offensiveRebounds: parseInt(stats[4] || '0'),
        defensiveRebounds: parseInt(stats[5] || '0'),
        rebounds: parseInt(stats[6] || '0'),
        assists: parseInt(stats[7] || '0'),
        steals: parseInt(stats[8] || '0'),
        blocks: parseInt(stats[9] || '0'),
        turnovers: parseInt(stats[10] || '0'),
        personalFouls: parseInt(stats[11] || '0'),
        plusMinus: parseInt(stats[12] || '0'),
        points: parseInt(stats[13] || '0')
      };
      
      // Calculate fantasy points
      const fantasyPoints = this.calculateFantasyPoints(parsed);
      
      return {
        player_id: playerId,
        stats: parsed,
        fantasy_points: fantasyPoints
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private findPlayerId(name: string): number | null {
    // Try exact match first
    let playerId = this.playerCache.get(name.toLowerCase());
    if (playerId) return playerId;
    
    // Try normalized
    playerId = this.playerCache.get(this.normalizePlayerName(name));
    if (playerId) return playerId;
    
    // Try last name only
    const lastName = name.split(' ').slice(-1)[0].toLowerCase();
    playerId = this.playerCache.get(lastName);
    if (playerId) return playerId;
    
    // Try without Jr./Sr./III
    const cleanName = name.replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, '').toLowerCase();
    playerId = this.playerCache.get(cleanName);
    if (playerId) return playerId;
    
    return null;
  }
  
  private normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // DraftKings scoring
    points += (stats.points || 0) * 1;
    points += (stats.rebounds || 0) * 1.25;
    points += (stats.assists || 0) * 1.5;
    points += (stats.steals || 0) * 2;
    points += (stats.blocks || 0) * 2;
    points -= (stats.turnovers || 0) * 0.5;
    
    // Double-double bonus
    const categories = [
      stats.points >= 10,
      stats.rebounds >= 10,
      stats.assists >= 10,
      stats.steals >= 10,
      stats.blocks >= 10
    ];
    
    const doubleDoubleCount = categories.filter(Boolean).length;
    if (doubleDoubleCount >= 2) points += 1.5;
    if (doubleDoubleCount >= 3) points += 1.5; // Triple-double (total 3)
    
    return Math.round(points * 100) / 100;
  }
  
  private async saveStats(game: GameToCollect, playerStats: any[]) {
    const logs = playerStats.map(stat => ({
      game_id: game.id,
      player_id: stat.player_id,
      game_date: game.start_time,
      stats: stat.stats,
      fantasy_points: stat.fantasy_points
    }));
    
    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .insert(batch);
      
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
    }
  }
  
  private async saveProgress() {
    const coverage = await this.getCurrentCoverage();
    
    const progress = {
      timestamp: new Date().toISOString(),
      successCount: this.successCount,
      failureCount: this.failureCount,
      collectedGames: this.collectedGames,
      currentCoverage: coverage.current,
      gamesWithStats: coverage.gamesWithStats,
      totalGames: coverage.totalGames,
      remainingFor95: coverage.gamesNeeded
    };
    
    fs.writeFileSync('./nba-95-progress.json', JSON.stringify(progress, null, 2));
    console.log(chalk.gray(`\nProgress saved: ${coverage.current}% coverage`));
  }
  
  private async generateFinalReport() {
    const coverage = await this.getCurrentCoverage();
    
    const report = {
      sport: 'NBA',
      collectionDate: new Date().toISOString(),
      initialCoverage: '82.0%',
      finalCoverage: coverage.current + '%',
      totalGames: coverage.totalGames,
      gamesWithStats: coverage.gamesWithStats,
      gamesCollected: this.successCount,
      gamesFailed: this.failureCount,
      successRate: ((this.successCount / (this.successCount + this.failureCount || 1)) * 100).toFixed(1) + '%',
      achieved95: parseFloat(coverage.current) >= 95,
      collectedGameIds: this.collectedGames
    };
    
    fs.writeFileSync('./nba-95-final-report.json', JSON.stringify(report, null, 2));
    
    console.log(chalk.bold.cyan('\n📊 FINAL REPORT:\n'));
    console.log(chalk.yellow(`Coverage: 82.0% → ${coverage.current}%`));
    console.log(chalk.green(`✅ Collected: ${this.successCount} games`));
    console.log(chalk.red(`❌ Failed: ${this.failureCount} games`));
    
    if (parseFloat(coverage.current) >= 95) {
      console.log(chalk.bold.green('\n🎉 ACHIEVED 95% COVERAGE! NBA IS NOW GOLD STANDARD! 🎉'));
    } else {
      console.log(chalk.cyan(`\nStill need ${coverage.gamesNeeded} games for 95%`));
      console.log(chalk.yellow('Run again to collect more games'));
    }
  }
}

// Run the collector
const collector = new NBA95PercentCollector();
collector.collect();