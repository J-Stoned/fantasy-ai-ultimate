#!/usr/bin/env tsx
/**
 * 🏀 NBA 95% FIXER - Get remaining games for 95%+ coverage
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

class NBA95PercentFixer {
  private playerCache: Map<string, number> = new Map();
  private fixedGames = 0;
  private failedGames = 0;
  private stats: any[] = [];
  private progressBar: cliProgress.SingleBar;
  private limit = pLimit(5);

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: '🏀 NBA 95% |{bar}| {percentage}% | {value}/{total} games | Fixed: {fixed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async loadPlayerCache() {
    console.log(chalk.yellow('Loading NBA players...'));
    
    const { data: players, count } = await supabase
      .from('players')
      .select('id, name', { count: 'exact' })
      .eq('sport', 'nba');
    
    if (players) {
      players.forEach(player => {
        const key = player.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        this.playerCache.set(key, player.id);
        
        // Also store without suffixes
        const cleanKey = key.replace(/\s+(jr|sr|iii|ii|iv|v)$/i, '').trim();
        if (cleanKey !== key) {
          this.playerCache.set(cleanKey, player.id);
        }
        
        // Store last name, first name
        const parts = key.split(' ');
        if (parts.length >= 2) {
          const lastFirst = `${parts[parts.length - 1]} ${parts[0]}`;
          this.playerCache.set(lastFirst, player.id);
        }
      });
    }
    
    console.log(chalk.green(`✅ Loaded ${count} NBA players`));
  }

  findPlayer(name: string): number | null {
    const key = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return this.playerCache.get(key) || null;
  }

  async processGame(game: any): Promise<boolean> {
    try {
      let espnId = game.external_id;
      espnId = espnId.replace(/^espn_/, '').replace(/^nba_/, '');
      
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary`,
        {
          params: { event: espnId },
          timeout: 15000
        }
      );
      
      if (!response.data.boxscore?.players) {
        this.failedGames++;
        return false;
      }
      
      let gameStats = 0;
      const gameDate = game.start_time.split('T')[0];
      
      for (const team of response.data.boxscore.players) {
        for (const category of (team.statistics || [])) {
          for (const athlete of (category.athletes || [])) {
            const playerId = this.findPlayer(athlete.athlete?.displayName || '');
            
            if (!playerId) continue;
            
            const statsData = this.extractStats(athlete.stats || []);
            
            if (Object.keys(statsData).length > 0) {
              this.stats.push({
                game_id: game.id,
                player_id: playerId,
                game_date: gameDate,
                stats: statsData,
                fantasy_points: this.calculateFantasyPoints(statsData)
              });
              gameStats++;
            }
          }
        }
      }
      
      if (gameStats > 0) {
        this.fixedGames++;
        return true;
      } else {
        this.failedGames++;
        return false;
      }
      
    } catch (error: any) {
      // Retry on rate limit
      if (error.response?.status === 429) {
        await new Promise(r => setTimeout(r, 5000));
        return this.processGame(game);
      }
      this.failedGames++;
      return false;
    }
  }

  extractStats(stats: string[]): any {
    const result: any = {};
    
    // NBA stats order: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS
    const [min, fg, threePt, ft, oreb, dreb, reb, ast, stl, blk, to, pf, plusMinus, pts] = stats;
    
    if (min && min !== '0') {
      // Parse minutes
      const [mins, secs] = min.split(':').map(Number);
      result.minutes_played = mins + (secs || 0) / 60;
      
      // Field goals
      const [fgm, fga] = (fg || '0-0').split('-').map(Number);
      result.field_goals_made = fgm || 0;
      result.field_goals_attempted = fga || 0;
      
      // Three pointers
      const [tpm, tpa] = (threePt || '0-0').split('-').map(Number);
      result.three_pointers_made = tpm || 0;
      result.three_pointers_attempted = tpa || 0;
      
      // Free throws
      const [ftm, fta] = (ft || '0-0').split('-').map(Number);
      result.free_throws_made = ftm || 0;
      result.free_throws_attempted = fta || 0;
      
      // Other stats
      result.offensive_rebounds = parseInt(oreb) || 0;
      result.defensive_rebounds = parseInt(dreb) || 0;
      result.rebounds = parseInt(reb) || 0;
      result.assists = parseInt(ast) || 0;
      result.steals = parseInt(stl) || 0;
      result.blocks = parseInt(blk) || 0;
      result.turnovers = parseInt(to) || 0;
      result.personal_fouls = parseInt(pf) || 0;
      result.plus_minus = parseInt(plusMinus) || 0;
      result.points = parseInt(pts) || 0;
    }
    
    return result;
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // DraftKings scoring
    points += (stats.points || 0) * 1;
    points += (stats.three_pointers_made || 0) * 0.5;
    points += (stats.rebounds || 0) * 1.25;
    points += (stats.assists || 0) * 1.5;
    points += (stats.steals || 0) * 2;
    points += (stats.blocks || 0) * 2;
    points += (stats.turnovers || 0) * -0.5;
    
    // Double-double bonus
    let doubleCount = 0;
    if (stats.points >= 10) doubleCount++;
    if (stats.rebounds >= 10) doubleCount++;
    if (stats.assists >= 10) doubleCount++;
    if (stats.steals >= 10) doubleCount++;
    if (stats.blocks >= 10) doubleCount++;
    
    if (doubleCount >= 2) points += 1.5;
    if (doubleCount >= 3) points += 3;
    
    return Math.round(points * 100) / 100;
  }

  async saveStats() {
    if (this.stats.length === 0) return;
    
    const batchSize = 500;
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
      }
    }
    
    this.stats = [];
  }

  async run() {
    console.log(chalk.bold.cyan('\n🏀 NBA 95% FIXER - PUSHING TO GOLD STANDARD\n'));
    
    await this.loadPlayerCache();
    
    // Get ALL 2024 NBA games
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .order('start_time');
    
    if (!all2024Games) {
      console.error('No games found');
      return;
    }
    
    // Find games without stats
    const gamesWithoutStats = [];
    for (const game of all2024Games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (!count || count === 0) {
        gamesWithoutStats.push(game);
      }
    }
    
    const currentCoverage = ((all2024Games.length - gamesWithoutStats.length) / all2024Games.length * 100).toFixed(1);
    const gamesNeededFor95 = Math.ceil(all2024Games.length * 0.95) - (all2024Games.length - gamesWithoutStats.length);
    
    console.log(chalk.yellow(`Current coverage: ${currentCoverage}%`));
    console.log(chalk.yellow(`Found ${gamesWithoutStats.length} games without stats`));
    console.log(chalk.yellow(`Need to fix ${gamesNeededFor95} games for 95% coverage`));
    
    if (gamesWithoutStats.length === 0 || gamesNeededFor95 <= 0) {
      console.log(chalk.green('Already at 95%+ coverage!'));
      return;
    }
    
    // Process games prioritizing most recent first
    const gamesToProcess = gamesWithoutStats
      .sort((a, b) => b.start_time.localeCompare(a.start_time))
      .slice(0, Math.max(gamesNeededFor95, gamesWithoutStats.length));
    
    this.progressBar.start(gamesToProcess.length, 0, { fixed: 0 });
    
    const batchSize = 10;
    for (let i = 0; i < gamesToProcess.length; i += batchSize) {
      const batch = gamesToProcess.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          this.limit(() => this.processGame(game))
        )
      );
      
      this.progressBar.update(i + batch.length, { fixed: this.fixedGames });
      
      if ((i + batch.length) % 20 === 0) {
        await this.saveStats();
      }
    }
    
    this.progressBar.stop();
    await this.saveStats();
    
    // Check final coverage
    console.log(chalk.bold.cyan('\n📊 FINAL NBA COVERAGE CHECK...\n'));
    
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
    
    console.log(chalk.bold.yellow('🏀 RESULTS:'));
    console.log(`Attempted: ${gamesToProcess.length} games`);
    console.log(`Fixed: ${this.fixedGames} games`);
    console.log(`Failed: ${this.failedGames} games`);
    console.log(chalk.bold.green(`\n✨ NBA FINAL COVERAGE: ${finalCoverage}%`));
    
    if (parseFloat(finalCoverage) >= 95) {
      console.log(chalk.bold.green('\n🎉 ACHIEVED 95%+ NBA COVERAGE!'));
      console.log(chalk.bold.green('🏀 NBA IS NOW GOLD STANDARD!'));
    } else if (parseFloat(finalCoverage) >= 90) {
      console.log(chalk.bold.yellow('\n✅ ACHIEVED 90%+ NBA COVERAGE!'));
      console.log(chalk.bold.yellow('🏀 NBA IS PROFESSIONAL GRADE!'));
    }
    
    // Save report
    const report = {
      sport: 'NBA',
      totalGames: all2024Games.length,
      gamesWithStats: finalGamesWithStats,
      coverage: finalCoverage,
      gamesFixed: this.fixedGames,
      gamesFailed: this.failedGames,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('./nba-95-coverage-report.json', JSON.stringify(report, null, 2));
  }
}

const fixer = new NBA95PercentFixer();
fixer.run().catch(console.error);