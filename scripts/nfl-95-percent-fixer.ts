#!/usr/bin/env tsx
/**
 * 🏈 NFL 95% FIXER - Get remaining 47 games for 95%+ coverage
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

class NFL95PercentFixer {
  private playerCache: Map<string, number> = new Map();
  private fixedGames = 0;
  private failedGames = 0;
  private stats: any[] = [];
  private progressBar: cliProgress.SingleBar;
  private limit = pLimit(5);

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: '🏈 NFL 95% |{bar}| {percentage}% | {value}/{total} games | Fixed: {fixed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async loadPlayerCache() {
    console.log(chalk.yellow('Loading NFL players...'));
    
    const { data: players, count } = await supabase
      .from('players')
      .select('id, name', { count: 'exact' })
      .eq('sport', 'nfl');
    
    if (players) {
      players.forEach(player => {
        const key = player.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        this.playerCache.set(key, player.id);
        
        // Also store without suffixes
        const cleanKey = key.replace(/\s+(jr|sr|iii|ii|iv|v)$/i, '').trim();
        if (cleanKey !== key) {
          this.playerCache.set(cleanKey, player.id);
        }
      });
    }
    
    console.log(chalk.green(`✅ Loaded ${count} NFL players`));
  }

  findPlayer(name: string): number | null {
    const key = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return this.playerCache.get(key) || null;
  }

  async processGame(game: any): Promise<boolean> {
    try {
      let espnId = game.external_id;
      espnId = espnId.replace(/^espn_/, '').replace(/^nfl_/, '');
      
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
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
            
            const statsData = this.extractStats(athlete.stats || [], category.name?.toLowerCase() || '');
            
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
      
    } catch (error) {
      this.failedGames++;
      return false;
    }
  }

  extractStats(stats: string[], statType: string): any {
    const result: any = {};
    
    if (statType.includes('passing')) {
      const [comp, att, yards, td, int] = stats;
      if (att && att !== '0') {
        result.passing_completions = parseInt(comp) || 0;
        result.passing_attempts = parseInt(att) || 0;
        result.passing_yards = parseInt(yards) || 0;
        result.passing_touchdowns = parseInt(td) || 0;
        result.passing_interceptions = parseInt(int) || 0;
      }
    } else if (statType.includes('rushing')) {
      const [carries, yards, avg, td] = stats;
      if (carries && carries !== '0') {
        result.rushing_attempts = parseInt(carries) || 0;
        result.rushing_yards = parseInt(yards) || 0;
        result.rushing_touchdowns = parseInt(td) || 0;
      }
    } else if (statType.includes('receiving')) {
      const [rec, yards, avg, td] = stats;
      if (rec && rec !== '0') {
        result.receiving_receptions = parseInt(rec) || 0;
        result.receiving_yards = parseInt(yards) || 0;
        result.receiving_touchdowns = parseInt(td) || 0;
      }
    }
    
    return result;
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_touchdowns || 0) * 4;
    points += (stats.passing_interceptions || 0) * -2;
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_touchdowns || 0) * 6;
    points += (stats.receiving_receptions || 0) * 1;
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_touchdowns || 0) * 6;
    
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
    console.log(chalk.bold.cyan('\n🏈 NFL 95% FIXER - FINAL PUSH TO EXCELLENCE\n'));
    
    await this.loadPlayerCache();
    
    // Get ALL 2024 NFL games
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport_id', 'nfl')
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
    
    console.log(chalk.yellow(`Found ${gamesWithoutStats.length} games without stats`));
    console.log(chalk.yellow(`Need to fix ${Math.ceil(all2024Games.length * 0.95) - (all2024Games.length - gamesWithoutStats.length)} games for 95%`));
    
    if (gamesWithoutStats.length === 0) {
      console.log(chalk.green('Already at maximum coverage!'));
      return;
    }
    
    this.progressBar.start(gamesWithoutStats.length, 0, { fixed: 0 });
    
    // Process all remaining games
    const batchSize = 10;
    for (let i = 0; i < gamesWithoutStats.length; i += batchSize) {
      const batch = gamesWithoutStats.slice(i, i + batchSize);
      
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
    console.log(chalk.bold.cyan('\n📊 FINAL NFL COVERAGE CHECK...\n'));
    
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
    
    console.log(chalk.bold.yellow('🏈 RESULTS:'));
    console.log(`Attempted: ${gamesWithoutStats.length} games`);
    console.log(`Fixed: ${this.fixedGames} games`);
    console.log(`Failed: ${this.failedGames} games`);
    console.log(chalk.bold.green(`\n✨ NFL FINAL COVERAGE: ${finalCoverage}%`));
    
    if (parseFloat(finalCoverage) >= 95) {
      console.log(chalk.bold.green('\n🎉 ACHIEVED 95%+ NFL COVERAGE!'));
      console.log(chalk.bold.green('🏈 NFL IS NOW GOLD STANDARD!'));
    }
  }
}

const fixer = new NFL95PercentFixer();
fixer.run().catch(console.error);