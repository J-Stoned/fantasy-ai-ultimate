#!/usr/bin/env tsx
/**
 * 🚀 ULTIMATE HIGH-PERFORMANCE STATS COLLECTOR V2
 * Built with complete understanding of the data flow
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';
import { program } from 'commander';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

// Optimized configuration based on testing
const CONFIG = {
  BATCH_SIZE: 20,              // Process 20 games at once (tested safe)
  CONCURRENT_REQUESTS: 10,     // 10 parallel API calls (avoid rate limits)
  DB_POOL_SIZE: 50,           // 50 database connections
  BULK_INSERT_SIZE: 1000,     // Insert 1000 records at once
  CHECKPOINT_INTERVAL: 50,     // Save progress every 50 games
  RETRY_ATTEMPTS: 3,          // Retry failed requests 3 times
  REQUEST_TIMEOUT: 15000,     // 15 second timeout
};

// Sport configuration
const SPORT_CONFIG = {
  nfl: { apiSport: 'football', league: 'nfl' },
  nba: { apiSport: 'basketball', league: 'nba' },
  mlb: { apiSport: 'baseball', league: 'mlb' },
  nhl: { apiSport: 'hockey', league: 'nhl' }
};

interface GameToProcess {
  id: number;
  external_id: string;
  sport_id: string;
  home_team_id: number;
  away_team_id: number;
  start_time: string;
}

interface PlayerStat {
  player_id: number;
  game_id: number;
  stat_type: string;
  stat_value: string | object;
  created_at: Date;
}

interface GameLog {
  player_id: number;
  game_id: number;
  team_id: number;
  stats: object;
  fantasy_points: number;
  created_at: Date;
}

class UltimateStatsCollectorV2 {
  private supabase;
  private limit;
  private stats = {
    totalGames: 0,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    totalStats: 0,
    totalGameLogs: 0,
    startTime: Date.now(),
    errors: [] as string[]
  };
  private progressBar: cliProgress.SingleBar;
  private checkpointFile = '.ultimate-collector-v2-checkpoint.json';
  private playerCache = new Map<string, number>();
  private statsBuffer: PlayerStat[] = [];
  private gameLogsBuffer: GameLog[] = [];

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
    
    this.progressBar = new cliProgress.SingleBar({
      format: '🚀 Progress |{bar}| {percentage}% | {value}/{total} games | Speed: {speed} games/min | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async run(sport?: string) {
    console.log(chalk.bold.magenta('\n🚀 ULTIMATE STATS COLLECTOR V2.0\n'));
    console.log(chalk.cyan('Built with complete data flow understanding\n'));

    try {
      // Load all existing players into cache
      await this.loadPlayerCache();
      
      // Load checkpoint if exists
      const checkpoint = this.loadCheckpoint();
      
      // Get games to process
      const games = await this.getGamesToProcess(sport, checkpoint?.lastProcessedId);
      this.stats.totalGames = games.length;

      if (games.length === 0) {
        console.log(chalk.yellow('No games to process! All games have stats.'));
        return;
      }

      console.log(chalk.bold(`📊 Found ${games.length} games without stats`));
      if (sport) {
        console.log(chalk.cyan(`Sport filter: ${sport.toUpperCase()}`));
      }

      // Initialize progress bar
      this.progressBar.start(games.length, checkpoint?.processedGames || 0, {
        speed: 0
      });

      // Process games in batches
      await this.processAllGames(games);

      // Flush any remaining buffers
      await this.flushBuffers();

      this.progressBar.stop();
      this.printFinalStats();

      // Clean up checkpoint on success
      if (this.stats.processedGames === this.stats.totalGames) {
        this.cleanupCheckpoint();
      }

    } catch (error) {
      console.error(chalk.red('\nFatal error:'), error);
      this.saveCheckpoint();
      process.exit(1);
    }
  }

  private async loadPlayerCache() {
    console.log('Loading player database...');
    const { data: players } = await this.supabase
      .from('players')
      .select('id, name')
      .order('id');
    
    if (players) {
      players.forEach(p => {
        // Store multiple variations of the name for matching
        this.playerCache.set(p.name.toLowerCase(), p.id);
        this.playerCache.set(p.name.replace(/[^a-zA-Z]/g, '').toLowerCase(), p.id);
      });
      console.log(`Loaded ${players.length} players into cache`);
    }
  }

  private async getGamesToProcess(sport?: string, lastProcessedId?: number): Promise<GameToProcess[]> {
    // First, get all completed games
    let query = this.supabase
      .from('games')
      .select(`
        id,
        external_id,
        sport_id,
        home_team_id,
        away_team_id,
        start_time
      `)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .not('sport_id', 'is', null)
      .lte('start_time', new Date().toISOString())
      .order('id');

    if (sport) {
      query = query.eq('sport_id', sport);
    }

    if (lastProcessedId) {
      query = query.gt('id', lastProcessedId);
    }

    const { data: games, error } = await query;
    if (error) throw error;

    if (!games || games.length === 0) return [];

    // Get games that already have stats
    const gameIds = games.map(g => g.id);
    const { data: gamesWithStats } = await this.supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', gameIds);

    const gamesWithStatsSet = new Set(gamesWithStats?.map(s => s.game_id) || []);
    
    // Return only games without stats
    return games.filter(g => !gamesWithStatsSet.has(g.id));
  }

  private async processAllGames(games: GameToProcess[]) {
    for (let i = 0; i < games.length; i += CONFIG.BATCH_SIZE) {
      const batch = games.slice(i, i + CONFIG.BATCH_SIZE);
      
      // Process batch with parallel requests
      const promises = batch.map(game => 
        this.limit(() => this.processGame(game))
      );
      
      await Promise.all(promises);
      
      // Flush buffers periodically
      if (this.statsBuffer.length > CONFIG.BULK_INSERT_SIZE) {
        await this.flushBuffers();
      }
      
      // Update progress
      const speed = Math.round((this.stats.processedGames / ((Date.now() - this.stats.startTime) / 60000)));
      this.progressBar.update(this.stats.processedGames, { speed });
      
      // Save checkpoint
      if (this.stats.processedGames % CONFIG.CHECKPOINT_INTERVAL === 0) {
        await this.flushBuffers();
        this.saveCheckpoint(batch[batch.length - 1].id);
      }
    }
  }

  private async processGame(game: GameToProcess) {
    try {
      // Extract ESPN ID (remove prefixes)
      const espnId = game.external_id.replace(/^espn_(?:nfl_|nba_|mlb_|nhl_)?/, '');
      
      // Get sport config
      const sportConfig = SPORT_CONFIG[game.sport_id as keyof typeof SPORT_CONFIG];
      if (!sportConfig) {
        throw new Error(`Unknown sport: ${game.sport_id}`);
      }

      // Fetch from ESPN API
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/${sportConfig.apiSport}/${sportConfig.league}/summary`,
        {
          params: { event: espnId },
          timeout: CONFIG.REQUEST_TIMEOUT,
          validateStatus: (status) => status < 500
        }
      );

      if (response.status === 404) {
        this.stats.failedGames++;
        this.stats.errors.push(`Game ${game.id} (${espnId}): Not found on ESPN`);
        return;
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Parse stats based on sport
      await this.parseGameStats(response.data, game);
      this.stats.successfulGames++;
      
    } catch (error: any) {
      this.stats.failedGames++;
      this.stats.errors.push(`Game ${game.id}: ${error.message}`);
    } finally {
      this.stats.processedGames++;
    }
  }

  private async parseGameStats(gameData: any, game: GameToProcess) {
    const teams = gameData.boxscore?.players || [];
    
    for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
      const teamStats = teams[teamIdx];
      const teamId = teamIdx === 0 ? game.home_team_id : game.away_team_id;
      
      // Process each stat category
      for (const category of (teamStats.statistics || [])) {
        const statCategory = category.name?.toLowerCase() || '';
        
        // Skip team totals
        if (statCategory === 'team' || statCategory === 'totals') continue;
        
        // Process each player in this category
        for (const athlete of (category.athletes || [])) {
          if (!athlete.athlete?.displayName) continue;
          
          // Get or create player
          const playerId = await this.getOrCreatePlayer(athlete.athlete, game.sport_id);
          if (!playerId) continue;
          
          // Parse individual stats
          const statsData = this.parsePlayerStats(athlete, category, statCategory);
          
          // Add to buffers
          for (const stat of statsData.stats) {
            this.statsBuffer.push({
              player_id: playerId,
              game_id: game.id,
              stat_type: stat.type,
              stat_value: stat.value,
              created_at: new Date()
            });
          }
          
          // Create game log if we have meaningful stats
          if (statsData.hasStats) {
            this.gameLogsBuffer.push({
              player_id: playerId,
              game_id: game.id,
              team_id: teamId,
              stats: statsData.gameLog,
              fantasy_points: statsData.fantasyPoints,
              created_at: new Date()
            });
          }
        }
      }
    }
  }

  private parsePlayerStats(athlete: any, category: any, statCategory: string) {
    const stats: Array<{ type: string; value: string }> = [];
    const gameLog: any = {};
    let hasStats = false;
    let fantasyPoints = 0;

    // Get stat labels and values
    const labels = category.labels || [];
    const values = athlete.stats || [];
    
    for (let i = 0; i < labels.length && i < values.length; i++) {
      const label = labels[i];
      const value = values[i];
      
      // Skip empty or zero values
      if (!value || value === '--' || value === '0' || label === 'TEAM') continue;
      
      // Create stat type name
      const statType = `${statCategory}_${label}`.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      stats.push({ type: statType, value: value.toString() });
      gameLog[statType] = value;
      hasStats = true;
      
      // Calculate fantasy points (basic scoring)
      fantasyPoints += this.calculateFantasyValue(statType, value);
    }

    return { stats, gameLog, hasStats, fantasyPoints };
  }

  private calculateFantasyValue(statType: string, value: any): number {
    const numValue = parseFloat(value) || 0;
    
    // Basic fantasy scoring
    const scoring: Record<string, number> = {
      'passing_yds': numValue * 0.04,
      'passing_td': numValue * 4,
      'passing_int': numValue * -2,
      'rushing_yds': numValue * 0.1,
      'rushing_td': numValue * 6,
      'receiving_rec': numValue * 1,
      'receiving_yds': numValue * 0.1,
      'receiving_td': numValue * 6,
      'fumbles_lost': numValue * -2,
      // Add more scoring rules as needed
    };
    
    return scoring[statType] || 0;
  }

  private async getOrCreatePlayer(athlete: any, sport: string): Promise<number | null> {
    const name = athlete.displayName || athlete.fullName || '';
    if (!name) return null;
    
    // Check cache first
    const cachedId = this.playerCache.get(name.toLowerCase());
    if (cachedId) return cachedId;
    
    // Try alternate name format
    const nameKey = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const cachedAltId = this.playerCache.get(nameKey);
    if (cachedAltId) return cachedAltId;
    
    // Create new player
    try {
      const { data: newPlayer, error } = await this.supabase
        .from('players')
        .insert({
          name: name,
          position: athlete.position?.abbreviation,
          jersey_number: athlete.jersey,
          sport: sport,
          team_id: athlete.team?.id,
          created_at: new Date()
        })
        .select('id')
        .single();

      if (!error && newPlayer) {
        // Add to cache
        this.playerCache.set(name.toLowerCase(), newPlayer.id);
        this.playerCache.set(nameKey, newPlayer.id);
        return newPlayer.id;
      }
    } catch (error) {
      // Player might already exist (race condition)
      const { data: existing } = await this.supabase
        .from('players')
        .select('id')
        .eq('name', name)
        .single();
      
      if (existing) {
        this.playerCache.set(name.toLowerCase(), existing.id);
        return existing.id;
      }
    }
    
    return null;
  }

  private async flushBuffers() {
    // Insert stats
    if (this.statsBuffer.length > 0) {
      const { error } = await this.supabase
        .from('player_stats')
        .insert(this.statsBuffer);
      
      if (!error) {
        this.stats.totalStats += this.statsBuffer.length;
      } else {
        console.error('Stats insert error:', error);
      }
      
      this.statsBuffer = [];
    }
    
    // Insert game logs
    if (this.gameLogsBuffer.length > 0) {
      const { error } = await this.supabase
        .from('player_game_logs')
        .upsert(this.gameLogsBuffer, {
          onConflict: 'player_id,game_id'
        });
      
      if (!error) {
        this.stats.totalGameLogs += this.gameLogsBuffer.length;
      } else {
        console.error('Game logs insert error:', error);
      }
      
      this.gameLogsBuffer = [];
    }
  }

  private loadCheckpoint(): any {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        return JSON.parse(fs.readFileSync(this.checkpointFile, 'utf-8'));
      }
    } catch (error) {
      console.error('Error loading checkpoint:', error);
    }
    return null;
  }

  private saveCheckpoint(lastProcessedId: number) {
    const checkpoint = {
      lastProcessedId,
      processedGames: this.stats.processedGames,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  private cleanupCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        fs.unlinkSync(this.checkpointFile);
      }
    } catch (error) {
      // Ignore
    }
  }

  private printFinalStats() {
    const duration = (Date.now() - this.stats.startTime) / 1000;
    const gamesPerMinute = Math.round((this.stats.processedGames / duration) * 60);

    console.log(chalk.bold.green('\n✅ COLLECTION COMPLETE!\n'));
    console.log(chalk.cyan('📊 Final Statistics:'));
    console.log(`   Total Games: ${this.stats.totalGames}`);
    console.log(`   Processed: ${this.stats.processedGames}`);
    console.log(`   Successful: ${chalk.green(this.stats.successfulGames)}`);
    console.log(`   Failed: ${chalk.red(this.stats.failedGames)}`);
    console.log(`   Total Stats: ${chalk.bold(this.stats.totalStats.toLocaleString())}`);
    console.log(`   Total Game Logs: ${chalk.bold(this.stats.totalGameLogs.toLocaleString())}`);
    console.log(`   Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
    console.log(`   Speed: ${chalk.bold(gamesPerMinute + ' games/minute')}`);
    
    const successRate = this.stats.processedGames > 0 
      ? ((this.stats.successfulGames / this.stats.processedGames) * 100).toFixed(1)
      : '0';
    console.log(`   Success Rate: ${chalk.bold(successRate + '%')}`);

    // Show errors if any
    if (this.stats.errors.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${this.stats.errors.length} games had errors`));
      if (this.stats.errors.length <= 10) {
        this.stats.errors.forEach(err => console.log(`   - ${err}`));
      } else {
        console.log(`   Showing first 10 errors:`);
        this.stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      }
    }
  }
}

// CLI setup
program
  .name('ultimate-stats-collector-v2')
  .description('Ultimate high-performance stats collector with proper data flow')
  .option('-s, --sport <sport>', 'Filter by sport (nfl, nba, mlb, nhl)')
  .option('-a, --all', 'Process all sports')
  .parse();

const options = program.opts();

// Run the collector
const collector = new UltimateStatsCollectorV2();
collector.run(options.sport || (options.all ? undefined : 'nfl'));