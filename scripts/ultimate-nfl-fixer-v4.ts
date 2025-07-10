#!/usr/bin/env tsx
/**
 * 🚀 ULTIMATE NFL FIXER V4 - 10X DEVELOPER EDITION
 * Target: Fix ALL 47 remaining games to achieve 95%+ coverage
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlayerCache {
  [key: string]: {
    id: number;
    name: string;
  };
}

interface GameStats {
  game_id: number;
  player_id: number;
  team_id?: number;
  game_date: string;
  stats: any;
  fantasy_points: number;
}

class UltimateNFLFixerV4 {
  private playerCache: PlayerCache = {};
  private fixedGames = 0;
  private failedGames = 0;
  private stats: GameStats[] = [];
  private progressBar: cliProgress.SingleBar;
  private limit = pLimit(5); // Concurrent API requests
  private checkpointFile = './nfl-fixer-v4-checkpoint.json';
  private processedGames = new Set<number>();

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: '🏈 NFL Fix |{bar}| {percentage}% | {value}/{total} games | Fixed: {fixed} | Failed: {failed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async loadCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const checkpoint = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf-8'));
        this.processedGames = new Set(checkpoint.processedGames);
        this.fixedGames = checkpoint.fixedGames || 0;
        this.failedGames = checkpoint.failedGames || 0;
        console.log(chalk.yellow(`Resuming from checkpoint: ${this.processedGames.size} games already processed`));
      }
    } catch (error) {
      console.log(chalk.yellow('No valid checkpoint found, starting fresh'));
    }
  }

  saveCheckpoint() {
    const checkpoint = {
      processedGames: Array.from(this.processedGames),
      fixedGames: this.fixedGames,
      failedGames: this.failedGames,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  async loadPlayerCache() {
    console.log(chalk.yellow('Loading NFL players...'));
    
    let offset = 0;
    const limit = 1000;
    let totalPlayers = 0;
    
    // Get total count first
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'nfl');
    
    const total = count || 0;
    console.log(`Total NFL players to load: ${total}`);
    
    while (offset < total) {
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name')
        .eq('sport', 'nfl')
        .range(offset, Math.min(offset + limit - 1, total - 1))
        .order('id');
      
      if (error) {
        console.error('Error loading players:', error);
        break;
      }
      
      if (players && players.length > 0) {
        players.forEach(player => {
          // Multiple variations for better matching
          const baseName = this.normalizePlayerName(player.name);
          this.playerCache[baseName] = player;
          
          // Also store without suffixes
          const nameWithoutSuffix = baseName.replace(/\s+(jr|sr|iii|ii|iv|v)$/i, '').trim();
          if (nameWithoutSuffix !== baseName) {
            this.playerCache[nameWithoutSuffix] = player;
          }
          
          // Store last name, first name format
          const parts = baseName.split(' ');
          if (parts.length >= 2) {
            const lastFirst = `${parts[parts.length - 1]} ${parts[0]}`;
            this.playerCache[lastFirst] = player;
          }
        });
        totalPlayers += players.length;
        offset += players.length;
        
        if (offset % 5000 === 0) {
          console.log(`  Loaded ${offset}/${total} players...`);
        }
      } else {
        break;
      }
    }
    
    console.log(chalk.green(`✅ Loaded ${totalPlayers} NFL players (${Object.keys(this.playerCache).length} cache entries)`));
  }

  normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findPlayer(displayName: string): number | null {
    const normalized = this.normalizePlayerName(displayName);
    const player = this.playerCache[normalized];
    
    if (player) {
      return player.id;
    }
    
    // Try without middle names
    const parts = normalized.split(' ');
    if (parts.length > 2) {
      const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
      if (this.playerCache[firstLast]) {
        return this.playerCache[firstLast].id;
      }
    }
    
    return null;
  }

  async processGame(game: any): Promise<boolean> {
    if (this.processedGames.has(game.id)) {
      return false;
    }

    try {
      // Clean ESPN ID - handle all formats
      let espnId = game.external_id;
      espnId = espnId.replace(/^espn_/, '');
      espnId = espnId.replace(/^nfl_/, '');
      espnId = espnId.replace(/^espn_nfl_/, '');
      
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
        {
          params: { event: espnId },
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (!response.data.boxscore?.players) {
        this.failedGames++;
        this.processedGames.add(game.id);
        return false;
      }
      
      let gameStats = 0;
      const gameDate = game.start_time.split('T')[0];
      
      // Process each team
      for (const team of response.data.boxscore.players) {
        const teamId = team.team?.id;
        
        for (const category of (team.statistics || [])) {
          const statType = category.name?.toLowerCase() || '';
          
          for (const athlete of (category.athletes || [])) {
            const playerId = this.findPlayer(athlete.athlete?.displayName || '');
            
            if (!playerId) {
              continue;
            }
            
            const statsData = this.extractStats(athlete.stats || [], statType);
            
            if (Object.keys(statsData).length > 0) {
              const fantasyPoints = this.calculateFantasyPoints(statsData);
              
              this.stats.push({
                game_id: game.id,
                player_id: playerId,
                team_id: teamId,
                game_date: gameDate,
                stats: statsData,
                fantasy_points: fantasyPoints
              });
              gameStats++;
            }
          }
        }
      }
      
      if (gameStats > 0) {
        this.fixedGames++;
        this.processedGames.add(game.id);
        return true;
      } else {
        this.failedGames++;
        this.processedGames.add(game.id);
        return false;
      }
      
    } catch (error: any) {
      // Retry logic for specific errors
      if (error.response?.status === 429 || error.code === 'ECONNRESET') {
        console.log(chalk.yellow(`  Rate limited on game ${game.id}, will retry...`));
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.processGame(game); // Retry
      }
      
      this.failedGames++;
      this.processedGames.add(game.id);
      return false;
    }
  }

  extractStats(stats: string[], statType: string): any {
    const result: any = {};
    
    if (statType.includes('passing')) {
      const [comp, att, yards, td, int, sacks, qbr] = stats;
      if (att && att !== '0') {
        result.passing_completions = parseInt(comp) || 0;
        result.passing_attempts = parseInt(att) || 0;
        result.passing_yards = parseInt(yards) || 0;
        result.passing_touchdowns = parseInt(td) || 0;
        result.passing_interceptions = parseInt(int) || 0;
        result.passing_sacks = parseInt(sacks?.split('-')[0]) || 0;
        result.qb_rating = parseFloat(qbr) || 0;
      }
    } else if (statType.includes('rushing')) {
      const [carries, yards, avg, td, long] = stats;
      if (carries && carries !== '0') {
        result.rushing_attempts = parseInt(carries) || 0;
        result.rushing_yards = parseInt(yards) || 0;
        result.rushing_touchdowns = parseInt(td) || 0;
        result.rushing_long = parseInt(long) || 0;
      }
    } else if (statType.includes('receiving')) {
      const [rec, targets, yards, avg, td, long] = stats;
      if (rec && rec !== '0') {
        result.receiving_receptions = parseInt(rec) || 0;
        result.receiving_targets = parseInt(targets) || 0;
        result.receiving_yards = parseInt(yards) || 0;
        result.receiving_touchdowns = parseInt(td) || 0;
        result.receiving_long = parseInt(long) || 0;
      }
    } else if (statType.includes('kicking')) {
      const [fgm, fga, pct, long, xpm, xpa] = stats;
      if (fga && fga !== '0') {
        result.field_goals_made = parseInt(fgm) || 0;
        result.field_goals_attempted = parseInt(fga) || 0;
        result.field_goal_pct = parseFloat(pct) || 0;
        result.field_goal_long = parseInt(long) || 0;
        result.extra_points_made = parseInt(xpm) || 0;
        result.extra_points_attempted = parseInt(xpa) || 0;
      }
    } else if (statType.includes('punting')) {
      const [punts, yards, avg, long, inside20] = stats;
      if (punts && punts !== '0') {
        result.punts = parseInt(punts) || 0;
        result.punt_yards = parseInt(yards) || 0;
        result.punt_avg = parseFloat(avg) || 0;
        result.punt_long = parseInt(long) || 0;
        result.punts_inside_20 = parseInt(inside20) || 0;
      }
    }
    
    return result;
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // Standard PPR scoring
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_touchdowns || 0) * 4;
    points += (stats.passing_interceptions || 0) * -2;
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_touchdowns || 0) * 6;
    points += (stats.receiving_receptions || 0) * 1; // Full PPR
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_touchdowns || 0) * 6;
    points += (stats.field_goals_made || 0) * 3;
    points += (stats.extra_points_made || 0) * 1;
    
    // Bonus points
    if (stats.passing_yards >= 300) points += 3;
    if (stats.rushing_yards >= 100) points += 3;
    if (stats.receiving_yards >= 100) points += 3;
    
    return Math.round(points * 100) / 100;
  }

  async saveStats() {
    if (this.stats.length === 0) return;
    
    console.log(chalk.yellow(`\n💾 Saving ${this.stats.length} stats to database...`));
    
    // Save in batches
    const batchSize = 500;
    let saved = 0;
    
    for (let i = 0; i < this.stats.length; i += batchSize) {
      const batch = this.stats.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(batch, {
          onConflict: 'game_id,player_id',
          ignoreDuplicates: true
        });
      
      if (error) {
        console.error(chalk.red('Error saving batch:'), error.message);
      } else {
        saved += batch.length;
        console.log(chalk.green(`  ✅ Saved batch ${Math.floor(i / batchSize) + 1} (${saved}/${this.stats.length})`));
      }
    }
    
    this.stats = []; // Clear buffer
  }

  async run() {
    console.log(chalk.bold.cyan('\n🚀 ULTIMATE NFL FIXER V4 - 10X DEVELOPER EDITION\n'));
    
    // Load checkpoint
    await this.loadCheckpoint();
    
    // Load players
    await this.loadPlayerCache();
    
    // Get ALL games without stats
    console.log(chalk.yellow('\n🔍 Finding NFL games without stats...'));
    
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (!all2024Games) {
      console.error('No games found');
      return;
    }
    
    // Find games without stats
    const gamesWithoutStats = [];
    for (const game of all2024Games) {
      if (this.processedGames.has(game.id)) continue;
      
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (!count || count === 0) {
        gamesWithoutStats.push(game);
      }
    }
    
    console.log(chalk.bold.yellow(`Found ${gamesWithoutStats.length} games without stats`));
    
    if (gamesWithoutStats.length === 0) {
      console.log(chalk.green('🎉 All games already have stats!'));
      return;
    }
    
    // Process games
    this.progressBar.start(gamesWithoutStats.length, 0, {
      fixed: this.fixedGames,
      failed: this.failedGames
    });
    
    // Process in parallel batches
    const batchSize = 10;
    for (let i = 0; i < gamesWithoutStats.length; i += batchSize) {
      const batch = gamesWithoutStats.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          this.limit(() => this.processGame(game))
        )
      );
      
      this.progressBar.update(i + batch.length, {
        fixed: this.fixedGames,
        failed: this.failedGames
      });
      
      // Save stats every 20 games
      if ((i + batch.length) % 20 === 0) {
        await this.saveStats();
        this.saveCheckpoint();
      }
    }
    
    this.progressBar.stop();
    
    // Save remaining stats
    await this.saveStats();
    
    // Clean up checkpoint
    if (fs.existsSync(this.checkpointFile)) {
      fs.unlinkSync(this.checkpointFile);
    }
    
    // Final coverage check
    console.log(chalk.bold.cyan('\n📊 CHECKING FINAL COVERAGE...\n'));
    
    let finalGamesWithStats = 0;
    for (const game of all2024Games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        finalGamesWithStats++;
      }
    }
    
    const finalCoverage = ((finalGamesWithStats / all2024Games.length) * 100).toFixed(1);
    
    console.log(chalk.bold.yellow('🏆 FINAL RESULTS:'));
    console.log(`Games processed: ${gamesWithoutStats.length}`);
    console.log(`Games fixed: ${this.fixedGames}`);
    console.log(`Games failed: ${this.failedGames}`);
    console.log(`Success rate: ${(this.fixedGames / gamesWithoutStats.length * 100).toFixed(1)}%`);
    console.log(chalk.bold.green(`\n✨ NFL COVERAGE: ${finalCoverage}%`));
    
    if (parseFloat(finalCoverage) >= 95) {
      console.log(chalk.bold.green('\n🎉 ACHIEVED 95%+ COVERAGE - GOLD STANDARD!'));
      console.log(chalk.bold.green('🚀 10X DEVELOPER MISSION ACCOMPLISHED!'));
    } else if (parseFloat(finalCoverage) >= 90) {
      console.log(chalk.bold.yellow('\n✅ ACHIEVED 90%+ COVERAGE - PROFESSIONAL GRADE!'));
    }
    
    // Save final report
    const report = {
      sport: 'NFL',
      totalGames: all2024Games.length,
      gamesWithStats: finalGamesWithStats,
      coverage: finalCoverage,
      gamesFixed: this.fixedGames,
      gamesFailed: this.failedGames,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('./nfl-coverage-report-v4.json', JSON.stringify(report, null, 2));
    console.log(chalk.green('\n📄 Report saved to nfl-coverage-report-v4.json'));
  }
}

// RUN IT!
const fixer = new UltimateNFLFixerV4();
fixer.run().catch(console.error);