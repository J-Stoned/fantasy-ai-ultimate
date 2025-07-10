#!/usr/bin/env tsx
/**
 * ⚾ ULTIMATE MLB COLLECTOR V4 - 10X DEVELOPER EDITION
 * Target: Fix MLB from 2.56% to 90%+ coverage
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

class UltimateMLBCollectorV4 {
  private playerCache: PlayerCache = {};
  private fixedGames = 0;
  private failedGames = 0;
  private stats: GameStats[] = [];
  private progressBar: cliProgress.SingleBar;
  private limit = pLimit(5);
  private checkpointFile = './mlb-collector-v4-checkpoint.json';
  private processedGames = new Set<number>();

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: '⚾ MLB Fix |{bar}| {percentage}% | {value}/{total} games | Fixed: {fixed} | Failed: {failed}',
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
    console.log(chalk.yellow('Loading MLB players...'));
    
    let offset = 0;
    const limit = 1000;
    let totalPlayers = 0;
    
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'mlb');
    
    const total = count || 0;
    console.log(`Total MLB players to load: ${total}`);
    
    while (offset < total) {
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name')
        .eq('sport', 'mlb')
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
    
    console.log(chalk.green(`✅ Loaded ${totalPlayers} MLB players (${Object.keys(this.playerCache).length} cache entries)`));
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
      espnId = espnId.replace(/^mlb_/, '');
      espnId = espnId.replace(/^espn_mlb_/, '');
      
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary`,
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
        
        // Process batters
        if (team.statistics?.[0]?.athletes) {
          for (const athlete of team.statistics[0].athletes) {
            const playerId = this.findPlayer(athlete.athlete?.displayName || '');
            
            if (!playerId) continue;
            
            const battingStats = this.extractBattingStats(athlete.stats || []);
            
            if (Object.keys(battingStats).length > 0) {
              const fantasyPoints = this.calculateFantasyPoints(battingStats);
              
              this.stats.push({
                game_id: game.id,
                player_id: playerId,
                team_id: teamId,
                game_date: gameDate,
                stats: battingStats,
                fantasy_points: fantasyPoints
              });
              gameStats++;
            }
          }
        }
        
        // Process pitchers
        if (team.statistics?.[1]?.athletes) {
          for (const athlete of team.statistics[1].athletes) {
            const playerId = this.findPlayer(athlete.athlete?.displayName || '');
            
            if (!playerId) continue;
            
            const pitchingStats = this.extractPitchingStats(athlete.stats || []);
            
            if (Object.keys(pitchingStats).length > 0) {
              const fantasyPoints = this.calculateFantasyPoints(pitchingStats);
              
              this.stats.push({
                game_id: game.id,
                player_id: playerId,
                team_id: teamId,
                game_date: gameDate,
                stats: pitchingStats,
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

  extractBattingStats(stats: string[]): any {
    const result: any = {};
    
    // MLB batting stats order: AB, R, H, RBI, BB, K, AVG, OBP, SLG
    const [ab, runs, hits, rbi, bb, k, avg, obp, slg, hr, sb] = stats;
    
    if (ab && ab !== '0') {
      result.at_bats = parseInt(ab) || 0;
      result.runs = parseInt(runs) || 0;
      result.hits = parseInt(hits) || 0;
      result.rbi = parseInt(rbi) || 0;
      result.walks = parseInt(bb) || 0;
      result.strikeouts = parseInt(k) || 0;
      result.batting_avg = parseFloat(avg) || 0;
      result.on_base_pct = parseFloat(obp) || 0;
      result.slugging_pct = parseFloat(slg) || 0;
      result.home_runs = parseInt(hr) || 0;
      result.stolen_bases = parseInt(sb) || 0;
      
      // Calculate additional stats
      result.singles = result.hits - (result.home_runs || 0);
      result.total_bases = result.singles + (result.home_runs * 4);
    }
    
    return result;
  }

  extractPitchingStats(stats: string[]): any {
    const result: any = {};
    
    // MLB pitching stats order: IP, H, R, ER, BB, K, HR, ERA, PC-ST
    const [ip, hits, runs, er, bb, k, hr, era, pitches] = stats;
    
    if (ip && ip !== '0.0') {
      result.innings_pitched = parseFloat(ip) || 0;
      result.hits_allowed = parseInt(hits) || 0;
      result.runs_allowed = parseInt(runs) || 0;
      result.earned_runs = parseInt(er) || 0;
      result.walks_allowed = parseInt(bb) || 0;
      result.strikeouts = parseInt(k) || 0;
      result.home_runs_allowed = parseInt(hr) || 0;
      result.era = parseFloat(era) || 0;
      
      // Win/Loss/Save tracking would need game context
      result.pitches_thrown = parseInt(pitches?.split('-')[0]) || 0;
      result.strikes_thrown = parseInt(pitches?.split('-')[1]) || 0;
      
      // Quality start check
      if (result.innings_pitched >= 6 && result.earned_runs <= 3) {
        result.quality_start = 1;
      }
    }
    
    return result;
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // Batting points
    points += (stats.singles || 0) * 1;
    points += (stats.home_runs || 0) * 4;
    points += (stats.runs || 0) * 1;
    points += (stats.rbi || 0) * 1;
    points += (stats.walks || 0) * 1;
    points += (stats.stolen_bases || 0) * 2;
    points += (stats.strikeouts || 0) * -0.5;
    
    // Pitching points
    points += (stats.innings_pitched || 0) * 3;
    points += (stats.strikeouts || 0) * 1;
    points += (stats.earned_runs || 0) * -2;
    points += (stats.hits_allowed || 0) * -0.5;
    points += (stats.walks_allowed || 0) * -0.5;
    points += (stats.quality_start || 0) * 3;
    
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
    console.log(chalk.bold.cyan('\n⚾ ULTIMATE MLB COLLECTOR V4 - 10X DEVELOPER EDITION\n'));
    
    await this.loadCheckpoint();
    await this.loadPlayerCache();
    
    console.log(chalk.yellow('\n🔍 Finding MLB games without stats...'));
    
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport_id', 'mlb')
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
    
    console.log(chalk.bold.yellow('⚾ FINAL RESULTS:'));
    console.log(`Games processed: ${gamesWithoutStats.length}`);
    console.log(`Games fixed: ${this.fixedGames}`);
    console.log(`Games failed: ${this.failedGames}`);
    console.log(`Success rate: ${(this.fixedGames / gamesWithoutStats.length * 100).toFixed(1)}%`);
    console.log(chalk.bold.green(`\n✨ MLB COVERAGE: ${finalCoverage}%`));
    
    if (parseFloat(finalCoverage) >= 90) {
      console.log(chalk.bold.green('\n🎉 ACHIEVED 90%+ COVERAGE - PROFESSIONAL GRADE!'));
      console.log(chalk.bold.green('⚾ MLB 10X TRANSFORMATION COMPLETE!'));
    }
    
    const report = {
      sport: 'MLB',
      totalGames: all2024Games.length,
      gamesWithStats: finalGamesWithStats,
      coverage: finalCoverage,
      gamesFixed: this.fixedGames,
      gamesFailed: this.failedGames,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('./mlb-coverage-report-v4.json', JSON.stringify(report, null, 2));
    console.log(chalk.green('\n📄 Report saved to mlb-coverage-report-v4.json'));
  }
}

// RUN IT!
const collector = new UltimateMLBCollectorV4();
collector.run().catch(console.error);