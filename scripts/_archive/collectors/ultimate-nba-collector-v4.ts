#!/usr/bin/env tsx
/**
 * 🏀 ULTIMATE NBA COLLECTOR V4 - 10X DEVELOPER EDITION
 * Target: Fix NBA from 30% to 90%+ coverage
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

class UltimateNBACollectorV4 {
  private playerCache: PlayerCache = {};
  private fixedGames = 0;
  private failedGames = 0;
  private stats: GameStats[] = [];
  private progressBar: cliProgress.SingleBar;
  private limit = pLimit(5);
  private checkpointFile = './nba-collector-v4-checkpoint.json';
  private processedGames = new Set<number>();

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: '🏀 NBA Fix |{bar}| {percentage}% | {value}/{total} games | Fixed: {fixed} | Failed: {failed}',
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
    console.log(chalk.yellow('Loading NBA players...'));
    
    let offset = 0;
    const limit = 1000;
    let totalPlayers = 0;
    
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'nba');
    
    const total = count || 0;
    console.log(`Total NBA players to load: ${total}`);
    
    while (offset < total) {
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name')
        .eq('sport', 'nba')
        .range(offset, Math.min(offset + limit - 1, total - 1))
        .order('id');
      
      if (error) {
        console.error('Error loading players:', error);
        break;
      }
      
      if (players && players.length > 0) {
        players.forEach(player => {
          const baseName = this.normalizePlayerName(player.name);
          this.playerCache[baseName] = player;
          
          // Handle Jr., Sr., III variations
          const nameWithoutSuffix = baseName.replace(/\s+(jr|sr|iii|ii|iv|v)$/i, '').trim();
          if (nameWithoutSuffix !== baseName) {
            this.playerCache[nameWithoutSuffix] = player;
          }
          
          // Last name, first name format
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
    
    console.log(chalk.green(`✅ Loaded ${totalPlayers} NBA players (${Object.keys(this.playerCache).length} cache entries)`));
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
      // Clean ESPN ID
      let espnId = game.external_id;
      espnId = espnId.replace(/^espn_/, '');
      espnId = espnId.replace(/^nba_/, '');
      espnId = espnId.replace(/^espn_nba_/, '');
      
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary`,
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
            
            if (!playerId) continue;
            
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
      if (error.response?.status === 429 || error.code === 'ECONNRESET') {
        console.log(chalk.yellow(`  Rate limited on game ${game.id}, will retry...`));
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.processGame(game);
      }
      
      this.failedGames++;
      this.processedGames.add(game.id);
      return false;
    }
  }

  extractStats(stats: string[], statType: string): any {
    const result: any = {};
    
    // NBA stats order: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS
    const [min, fg, threePt, ft, oreb, dreb, reb, ast, stl, blk, to, pf, plusMinus, pts] = stats;
    
    if (min && min !== '0') {
      // Parse minutes (MM:SS to decimal)
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
      
      // Rebounds
      result.offensive_rebounds = parseInt(oreb) || 0;
      result.defensive_rebounds = parseInt(dreb) || 0;
      result.rebounds = parseInt(reb) || 0;
      
      // Other stats
      result.assists = parseInt(ast) || 0;
      result.steals = parseInt(stl) || 0;
      result.blocks = parseInt(blk) || 0;
      result.turnovers = parseInt(to) || 0;
      result.personal_fouls = parseInt(pf) || 0;
      result.plus_minus = parseInt(plusMinus) || 0;
      result.points = parseInt(pts) || 0;
      
      // Calculate percentages
      if (result.field_goals_attempted > 0) {
        result.field_goal_pct = result.field_goals_made / result.field_goals_attempted;
      }
      if (result.three_pointers_attempted > 0) {
        result.three_point_pct = result.three_pointers_made / result.three_pointers_attempted;
      }
      if (result.free_throws_attempted > 0) {
        result.free_throw_pct = result.free_throws_made / result.free_throws_attempted;
      }
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
    if (doubleCount >= 3) points += 3; // Triple-double bonus
    
    return Math.round(points * 100) / 100;
  }

  async saveStats() {
    if (this.stats.length === 0) return;
    
    console.log(chalk.yellow(`\n💾 Saving ${this.stats.length} stats to database...`));
    
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
    
    this.stats = [];
  }

  async run() {
    console.log(chalk.bold.cyan('\n🏀 ULTIMATE NBA COLLECTOR V4 - 10X DEVELOPER EDITION\n'));
    
    await this.loadCheckpoint();
    await this.loadPlayerCache();
    
    console.log(chalk.yellow('\n🔍 Finding NBA games without stats...'));
    
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (!all2024Games) {
      console.error('No games found');
      return;
    }
    
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
    
    this.progressBar.start(gamesWithoutStats.length, 0, {
      fixed: this.fixedGames,
      failed: this.failedGames
    });
    
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
      
      if ((i + batch.length) % 20 === 0) {
        await this.saveStats();
        this.saveCheckpoint();
      }
    }
    
    this.progressBar.stop();
    
    await this.saveStats();
    
    if (fs.existsSync(this.checkpointFile)) {
      fs.unlinkSync(this.checkpointFile);
    }
    
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
    
    console.log(chalk.bold.yellow('🏀 FINAL RESULTS:'));
    console.log(`Games processed: ${gamesWithoutStats.length}`);
    console.log(`Games fixed: ${this.fixedGames}`);
    console.log(`Games failed: ${this.failedGames}`);
    console.log(`Success rate: ${(this.fixedGames / gamesWithoutStats.length * 100).toFixed(1)}%`);
    console.log(chalk.bold.green(`\n✨ NBA COVERAGE: ${finalCoverage}%`));
    
    if (parseFloat(finalCoverage) >= 90) {
      console.log(chalk.bold.green('\n🎉 ACHIEVED 90%+ COVERAGE - PROFESSIONAL GRADE!'));
      console.log(chalk.bold.green('🏀 NBA 10X TRANSFORMATION COMPLETE!'));
    }
    
    const report = {
      sport: 'NBA',
      totalGames: all2024Games.length,
      gamesWithStats: finalGamesWithStats,
      coverage: finalCoverage,
      gamesFixed: this.fixedGames,
      gamesFailed: this.failedGames,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('./nba-coverage-report-v4.json', JSON.stringify(report, null, 2));
    console.log(chalk.green('\n📄 Report saved to nba-coverage-report-v4.json'));
  }
}

// RUN IT!
const collector = new UltimateNBACollectorV4();
collector.run().catch(console.error);