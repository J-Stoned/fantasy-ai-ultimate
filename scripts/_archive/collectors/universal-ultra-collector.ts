import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import pLimit from 'p-limit';
import os from 'os';
import fs from 'fs';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🚀 UNIVERSAL ULTRA COLLECTOR
 * Combines the best features from all collectors:
 * - Parallel processing from turbo-nba-collector
 * - Smart deduplication from smart-mlb-collector
 * - Memory management from mega-smart-collector
 * - GPU concepts from master-collector
 * - Auto-daemon features
 * - Rate limiting and error handling
 */

interface CollectorConfig {
  sport: string;
  sportId: string;
  apiEndpoint: string;
  batchSize: number;
  concurrency: number;
  rateLimitDelay: number;
  statMappings: Record<string, any>;
}

interface PlayerCache {
  [key: string]: number;
}

interface CollectionStats {
  totalGames: number;
  processedGames: number;
  successfulGames: number;
  failedGames: number;
  totalStats: number;
  startTime: number;
  errors: string[];
}

class UniversalUltraCollector {
  private playerCache: PlayerCache = {};
  private stats: CollectionStats;
  private checkpointFile: string;
  private limit: any;
  private config: CollectorConfig;
  
  // Sport configurations
  private static SPORT_CONFIGS: Record<string, CollectorConfig> = {
    NBA: {
      sport: 'NBA',
      sportId: 'nba',
      apiEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=',
      batchSize: 10,
      concurrency: Math.min(os.cpus().length * 2, 20),
      rateLimitDelay: 2000,
      statMappings: {
        0: 'minutes',
        1: 'fieldGoalsMade',
        2: 'fieldGoalsAttempted',
        3: 'threePtMade',
        4: 'threePtAttempted',
        5: 'freeThrowsMade',
        6: 'freeThrowsAttempted',
        7: 'offensiveRebounds',
        8: 'defensiveRebounds',
        9: 'rebounds',
        10: 'assists',
        11: 'steals',
        12: 'blocks',
        13: 'turnovers',
        14: 'personalFouls',
        15: 'points',
        16: 'plusMinus'
      }
    },
    NFL: {
      sport: 'NFL',
      sportId: 'nfl',
      apiEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=',
      batchSize: 5,
      concurrency: Math.min(os.cpus().length, 10),
      rateLimitDelay: 3000,
      statMappings: {
        passing: {
          0: 'completions',
          1: 'attempts',
          2: 'passingYards',
          3: 'passingTDs',
          4: 'interceptions',
          5: 'sacks',
          6: 'qbRating'
        },
        rushing: {
          0: 'rushingAttempts',
          1: 'rushingYards',
          2: 'rushingTDs',
          3: 'longRushing'
        },
        receiving: {
          0: 'receptions',
          1: 'receivingYards',
          2: 'receivingTDs',
          3: 'targets'
        }
      }
    },
    MLB: {
      sport: 'MLB',
      sportId: 'mlb',
      apiEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=',
      batchSize: 8,
      concurrency: Math.min(os.cpus().length * 2, 24),
      rateLimitDelay: 2000,
      statMappings: {
        batting: {
          1: 'atBats',
          2: 'runs',
          3: 'hits',
          4: 'RBIs',
          5: 'homeRuns',
          6: 'walks',
          7: 'strikeouts'
        },
        pitching: {
          0: 'inningsPitched',
          3: 'earnedRuns',
          6: 'strikeoutsPitching'
        }
      }
    },
    NHL: {
      sport: 'NHL',
      sportId: 'nhl',
      apiEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=',
      batchSize: 8,
      concurrency: Math.min(os.cpus().length * 2, 20),
      rateLimitDelay: 2000,
      statMappings: {
        skater: {
          0: 'goals',
          1: 'assists',
          2: 'points',
          3: 'plusMinus',
          4: 'penaltyMinutes',
          5: 'shots',
          6: 'hits',
          7: 'blockedShots'
        },
        goalie: {
          0: 'saves',
          1: 'shotsAgainst',
          2: 'goalsAgainst',
          3: 'savePercentage',
          4: 'wins',
          5: 'losses'
        }
      }
    }
  };
  
  constructor(sport: string) {
    if (!UniversalUltraCollector.SPORT_CONFIGS[sport]) {
      throw new Error(`Unsupported sport: ${sport}`);
    }
    
    this.config = UniversalUltraCollector.SPORT_CONFIGS[sport];
    this.limit = pLimit(this.config.concurrency);
    this.checkpointFile = `.ultra-collector-${sport.toLowerCase()}-checkpoint.json`;
    this.stats = {
      totalGames: 0,
      processedGames: 0,
      successfulGames: 0,
      failedGames: 0,
      totalStats: 0,
      startTime: Date.now(),
      errors: []
    };
  }
  
  async run() {
    console.log(chalk.bold.cyan(`\n🚀 UNIVERSAL ULTRA COLLECTOR - ${this.config.sport} 🚀`));
    console.log(chalk.cyan('='.repeat(80)));
    console.log(chalk.yellow(`CPU Cores: ${os.cpus().length}`));
    console.log(chalk.yellow(`Concurrency: ${this.config.concurrency}`));
    console.log(chalk.yellow(`Batch Size: ${this.config.batchSize}\n`));
    
    try {
      // Load checkpoint if exists
      this.loadCheckpoint();
      
      // Get initial stats count
      const { count: startingStats } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true });
      
      console.log(chalk.cyan(`Starting with ${startingStats?.toLocaleString()} total player stats\n`));
      
      // Get games to process
      const games = await this.getGamesToProcess();
      this.stats.totalGames = games.length;
      
      if (games.length === 0) {
        console.log(chalk.green('✅ All games already have stats!'));
        return;
      }
      
      console.log(chalk.yellow(`📊 Found ${games.length} games without stats\n`));
      
      // Process games in batches
      await this.processGamesInBatches(games);
      
      // Final report
      await this.showFinalReport(startingStats || 0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Fatal error:'), error);
      this.saveCheckpoint();
    }
  }
  
  private async getGamesToProcess(): Promise<any[]> {
    console.log(chalk.cyan('🔍 Finding games without stats...'));
    
    const gamesWithoutStats: any[] = [];
    let offset = 0;
    const chunkSize = 1000;
    
    while (true) {
      // Get games chunk
      const { data: games } = await supabase
        .from('games')
        .select('id, external_id, home_team_id, away_team_id, status, home_score, away_score, start_time')
        .or(`sport.eq.${this.config.sport},sport_id.eq.${this.config.sportId}`)
        .or('status.eq.completed,status.eq.STATUS_FINAL,status.eq.Final')
        .not('external_id', 'is', null)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
        .range(offset, offset + chunkSize - 1);
      
      if (!games || games.length === 0) break;
      
      // Check which games need stats
      const gameIds = games.map(g => g.id);
      const { data: gamesWithStats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', gameIds);
      
      const hasStatsSet = new Set(gamesWithStats?.map(s => s.game_id) || []);
      
      // Add games without stats
      for (const game of games) {
        if (!hasStatsSet.has(game.id) && this.extractEspnId(game.external_id)) {
          gamesWithoutStats.push(game);
        }
      }
      
      console.log(chalk.gray(`  Scanned ${offset + games.length} games, found ${gamesWithoutStats.length} needing stats...`));
      
      if (games.length < chunkSize) break;
      offset += chunkSize;
    }
    
    // Resume from checkpoint if exists
    if (this.stats.processedGames > 0) {
      console.log(chalk.yellow(`\n📌 Resuming from checkpoint (${this.stats.processedGames} games already processed)`));
      return gamesWithoutStats.slice(this.stats.processedGames);
    }
    
    return gamesWithoutStats;
  }
  
  private async processGamesInBatches(games: any[]) {
    const totalBatches = Math.ceil(games.length / this.config.batchSize);
    
    console.log(chalk.bold.cyan(`\n🚀 Processing ${games.length} games in ${totalBatches} batches\n`));
    
    for (let i = 0; i < games.length; i += this.config.batchSize) {
      const batchNumber = Math.floor(i / this.config.batchSize) + 1;
      const batch = games.slice(i, i + this.config.batchSize);
      
      console.log(chalk.bold.yellow(`\n━━━ Batch ${batchNumber}/${totalBatches} ━━━`));
      
      // Process batch in parallel
      const promises = batch.map(game => 
        this.limit(async () => {
          try {
            const stats = await this.scrapeGameStats(game);
            if (stats > 0) {
              this.stats.successfulGames++;
              this.stats.totalStats += stats;
              return { success: true, stats };
            }
            this.stats.failedGames++;
            return { success: false, stats: 0 };
          } catch (error) {
            this.stats.failedGames++;
            this.stats.errors.push(`Game ${game.id}: ${error}`);
            return { success: false, stats: 0 };
          }
        })
      );
      
      const results = await Promise.all(promises);
      
      // Update progress
      this.stats.processedGames = i + batch.length;
      this.saveCheckpoint();
      
      // Show batch summary
      const batchSuccess = results.filter(r => r.success).length;
      const batchStats = results.reduce((sum, r) => sum + r.stats, 0);
      
      console.log(chalk.green(`  ✅ Success: ${batchSuccess}/${batch.length} games`));
      console.log(chalk.green(`  📊 Stats collected: ${batchStats}`));
      this.showProgress();
      
      // Rate limiting
      if (i + this.config.batchSize < games.length) {
        console.log(chalk.gray(`  ⏱️  Rate limit pause (${this.config.rateLimitDelay}ms)...`));
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
      }
    }
  }
  
  private async scrapeGameStats(game: any): Promise<number> {
    const espnId = this.extractEspnId(game.external_id);
    if (!espnId) return 0;
    
    try {
      const url = `${this.config.apiEndpoint}${espnId}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });
      
      const stats: any[] = [];
      
      // Sport-specific parsing
      switch (this.config.sport) {
        case 'NBA':
          stats.push(...await this.parseNBAStats(response.data, game));
          break;
        case 'NFL':
          stats.push(...await this.parseNFLStats(response.data, game));
          break;
        case 'MLB':
          stats.push(...await this.parseMLBStats(response.data, game));
          break;
        case 'NHL':
          stats.push(...await this.parseNHLStats(response.data, game));
          break;
      }
      
      // Bulk insert stats
      if (stats.length > 0) {
        const { error } = await supabase
          .from('player_stats')
          .insert(stats);
        
        if (error) throw error;
        return stats.length;
      }
      
      return 0;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(chalk.gray(`    Game ${game.id}: Not found on ESPN`));
      } else if (error.response?.status === 429) {
        console.log(chalk.yellow(`    Game ${game.id}: Rate limited`));
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log(chalk.red(`    Game ${game.id}: ${error.message}`));
      }
      return 0;
    }
  }
  
  private async parseNBAStats(data: any, game: any): Promise<any[]> {
    const stats: any[] = [];
    
    if (data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of data.boxscore.players) {
        if (!team.statistics?.[0]?.athletes) continue;
        
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        for (const athlete of team.statistics[0].athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          try {
            const playerId = await this.ensurePlayer(
              athlete.athlete.id,
              athlete.athlete.displayName || 'Unknown',
              teamId
            );
            
            // Parse stats - store as jsonb per schema
            athlete.stats.forEach((value: string, index: number) => {
              const statType = this.config.statMappings[index];
              if (statType && value && value !== '0') {
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: statType,
                  stat_value: value  // Will be converted to JSONB by Supabase
                });
              }
            });
          } catch (error) {
            // Skip player on error
          }
        }
      }
    }
    
    return stats;
  }
  
  private async parseNFLStats(data: any, game: any): Promise<any[]> {
    const stats: any[] = [];
    
    if (data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of data.boxscore.players) {
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        // Process each stat category
        for (const category of team.statistics || []) {
          const categoryType = category.name?.toLowerCase();
          if (!categoryType || !category.athletes) continue;
          
          const mapping = this.config.statMappings[categoryType];
          if (!mapping) continue;
          
          for (const athlete of category.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await this.ensurePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName || 'Unknown',
                teamId
              );
              
              // Parse stats based on category
              Object.entries(mapping).forEach(([index, statType]) => {
                const value = athlete.stats[parseInt(index)];
                if (value && value !== '0' && value !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: statType as string,
                    stat_value: value
                  });
                }
              });
            } catch (error) {
              // Skip player on error
            }
          }
        }
      }
    }
    
    return stats;
  }
  
  private async parseMLBStats(data: any, game: any): Promise<any[]> {
    const stats: any[] = [];
    
    if (data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of data.boxscore.players) {
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        // Process batting stats
        const batting = team.statistics?.find((s: any) => s.type === 'batting');
        if (batting?.athletes) {
          for (const athlete of batting.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await this.ensurePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName || 'Unknown',
                teamId
              );
              
              Object.entries(this.config.statMappings.batting).forEach(([index, statType]) => {
                const value = athlete.stats[parseInt(index)];
                if (value && value !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: statType as string,
                    stat_value: value
                  });
                }
              });
            } catch (error) {
              // Skip player
            }
          }
        }
        
        // Process pitching stats
        const pitching = team.statistics?.find((s: any) => s.type === 'pitching');
        if (pitching?.athletes) {
          for (const athlete of pitching.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await this.ensurePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName || 'Unknown',
                teamId
              );
              
              Object.entries(this.config.statMappings.pitching).forEach(([index, statType]) => {
                const value = athlete.stats[parseInt(index)];
                if (value && value !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: statType as string,
                    stat_value: value
                  });
                }
              });
            } catch (error) {
              // Skip player
            }
          }
        }
      }
    }
    
    return stats;
  }
  
  private async parseNHLStats(data: any, game: any): Promise<any[]> {
    const stats: any[] = [];
    
    if (data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of data.boxscore.players) {
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        for (const category of team.statistics || []) {
          if (!category.athletes) continue;
          
          const isGoalie = category.name?.toLowerCase().includes('goalie');
          const mapping = isGoalie ? this.config.statMappings.goalie : this.config.statMappings.skater;
          
          for (const athlete of category.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await this.ensurePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName || 'Unknown',
                teamId
              );
              
              Object.entries(mapping).forEach(([index, statType]) => {
                const value = athlete.stats[parseInt(index)];
                if (value && value !== '0' && value !== '-') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: statType as string,
                    stat_value: value
                  });
                }
              });
            } catch (error) {
              // Skip player
            }
          }
        }
      }
    }
    
    return stats;
  }
  
  private async ensurePlayer(espnId: string, name: string, teamId: number): Promise<number> {
    const standardizedId = `espn_${this.config.sportId}_${espnId}`;
    
    // Check cache first
    if (this.playerCache[standardizedId]) {
      return this.playerCache[standardizedId];
    }
    
    // Check database
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('external_id', standardizedId)
      .single();
    
    if (existing) {
      this.playerCache[standardizedId] = existing.id;
      return existing.id;
    }
    
    // Create new player
    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert({
        external_id: standardizedId,
        name: name,
        firstname: name.split(' ')[0] || '',
        lastname: name.split(' ').slice(1).join(' ') || '',
        team_id: teamId,
        sport: this.config.sport,
        sport_id: this.config.sportId,
        status: 'active'
      })
      .select('id')
      .single();
    
    if (error) throw error;
    
    this.playerCache[standardizedId] = newPlayer.id;
    return newPlayer.id;
  }
  
  private extractEspnId(externalId: string): string | null {
    const patterns = [
      new RegExp(`espn_${this.config.sportId}_(\\d+)$`),
      new RegExp(`${this.config.sportId}_(\\d+)$`),
      /^(\d+)$/
    ];
    
    for (const pattern of patterns) {
      const match = externalId.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }
  
  private showProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const gamesPerSecond = this.stats.processedGames / elapsed;
    const remainingGames = this.stats.totalGames - this.stats.processedGames;
    const eta = remainingGames / gamesPerSecond;
    const progress = (this.stats.processedGames / this.stats.totalGames * 100).toFixed(1);
    
    console.log(chalk.cyan(`\n  📊 Progress: ${this.stats.processedGames}/${this.stats.totalGames} (${progress}%)`));
    console.log(chalk.cyan(`  ⚡ Speed: ${gamesPerSecond.toFixed(1)} games/sec`));
    console.log(chalk.cyan(`  ⏱️  ETA: ${this.formatTime(eta)}`));
    console.log(chalk.cyan(`  💾 Stats collected: ${this.stats.totalStats.toLocaleString()}`));
  }
  
  private async showFinalReport(startingStats: number) {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const { count: endingStats } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true });
    
    console.log(chalk.bold.green(`\n\n🏆 ${this.config.sport} COLLECTION COMPLETE!`));
    console.log(chalk.green('='.repeat(80)));
    console.log(chalk.white(`Games processed: ${this.stats.processedGames}/${this.stats.totalGames}`));
    console.log(chalk.white(`Successful games: ${this.stats.successfulGames}`));
    console.log(chalk.white(`Failed games: ${this.stats.failedGames}`));
    console.log(chalk.white(`Success rate: ${(this.stats.successfulGames / this.stats.processedGames * 100).toFixed(1)}%`));
    console.log(chalk.white(`Total stats collected: ${this.stats.totalStats.toLocaleString()}`));
    console.log(chalk.white(`Average stats per game: ${Math.round(this.stats.totalStats / this.stats.successfulGames)}`));
    console.log(chalk.white(`Time: ${this.formatTime(elapsed)}`));
    console.log(chalk.white(`Speed: ${(this.stats.processedGames / elapsed).toFixed(1)} games/second`));
    
    console.log(chalk.cyan(`\n📊 DATABASE GROWTH:`));
    console.log(chalk.white(`Starting stats: ${startingStats.toLocaleString()}`));
    console.log(chalk.white(`Ending stats: ${endingStats?.toLocaleString()}`));
    console.log(chalk.white(`NET GAIN: +${((endingStats || 0) - startingStats).toLocaleString()} stats!`));
    
    // Check coverage
    await this.checkCoverage();
    
    // Clean up checkpoint
    this.cleanupCheckpoint();
  }
  
  private async checkCoverage() {
    console.log(chalk.cyan(`\n📈 Checking ${this.config.sport} coverage...`));
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .or(`sport.eq.${this.config.sport},sport_id.eq.${this.config.sportId}`)
      .not('home_score', 'is', null);
    
    const { data: sample } = await supabase
      .from('games')
      .select('id')
      .or(`sport.eq.${this.config.sport},sport_id.eq.${this.config.sportId}`)
      .not('home_score', 'is', null)
      .limit(500);
    
    if (sample) {
      let withStats = 0;
      for (const game of sample) {
        const { count } = await supabase
          .from('player_stats')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', game.id)
          .limit(1);
        
        if (count && count > 0) withStats++;
      }
      
      const estimatedCoverage = (withStats / sample.length * 100).toFixed(1);
      console.log(chalk.yellow(`Estimated ${this.config.sport} coverage: ~${estimatedCoverage}% (based on 500 game sample)`));
      console.log(chalk.yellow(`Total ${this.config.sport} games: ${totalGames}`));
      
      if (parseFloat(estimatedCoverage) >= 95) {
        console.log(chalk.bold.green(`\n🎉 ${this.config.sport} HAS REACHED 95%+ COVERAGE! 🎉`));
      } else {
        const gamesNeeded = Math.ceil((totalGames || 0) * 0.95) - Math.round((totalGames || 0) * (withStats / sample.length));
        console.log(chalk.yellow(`To reach 95%: ~${gamesNeeded} more games needed`));
      }
    }
  }
  
  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  
  private saveCheckpoint() {
    fs.writeFileSync(this.checkpointFile, JSON.stringify(this.stats, null, 2));
  }
  
  private loadCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const data = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf8'));
        // Only restore if from same day
        const checkpointDate = new Date(data.startTime).toDateString();
        const today = new Date().toDateString();
        if (checkpointDate === today) {
          this.stats = { ...this.stats, ...data };
          console.log(chalk.yellow('📌 Loaded checkpoint from previous run'));
        }
      }
    } catch (error) {
      console.log(chalk.gray('No valid checkpoint found'));
    }
  }
  
  private cleanupCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        fs.unlinkSync(this.checkpointFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Main execution
async function main() {
  const sport = process.argv[2]?.toUpperCase() || 'NBA';
  
  if (!['NBA', 'NFL', 'MLB', 'NHL'].includes(sport)) {
    console.error(chalk.red('❌ Invalid sport. Use: NBA, NFL, MLB, or NHL'));
    process.exit(1);
  }
  
  try {
    const collector = new UniversalUltraCollector(sport);
    await collector.run();
  } catch (error) {
    console.error(chalk.red('❌ Fatal error:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Collector interrupted. Progress saved to checkpoint.'));
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

export { UniversalUltraCollector };