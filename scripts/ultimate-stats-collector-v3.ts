#!/usr/bin/env tsx
/**
 * 🚀 ULTIMATE STATS COLLECTOR V3.0
 * Fixed version with proper player matching and game_date handling
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

// Optimized configuration
const CONFIG = {
  BATCH_SIZE: 10,              // Smaller batches for better error tracking
  CONCURRENT_REQUESTS: 5,      // Reduced to avoid rate limits
  DB_POOL_SIZE: 50,           
  BULK_INSERT_SIZE: 1000,     
  CHECKPOINT_INTERVAL: 20,     
  RETRY_ATTEMPTS: 3,          
  REQUEST_TIMEOUT: 15000,     
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
  game_date: string;  // FIXED: Added required field
  created_at: Date;
}

class UltimateStatsCollectorV3 {
  private supabase;
  private limit;
  private stats = {
    totalGames: 0,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    totalStats: 0,
    totalGameLogs: 0,
    playersCreated: 0,
    playersMatched: 0,
    startTime: Date.now(),
    errors: [] as string[]
  };
  private progressBar: cliProgress.SingleBar;
  private checkpointFile = '.ultimate-collector-v3-checkpoint.json';
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
      format: '🚀 Progress |{bar}| {percentage}% | {value}/{total} games | Players: {matched}/{created} | Speed: {speed} games/min',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async run(sport?: string) {
    console.log(chalk.bold.magenta('\n🚀 ULTIMATE STATS COLLECTOR V3.0\n'));
    console.log(chalk.cyan('Fixed: Player matching + game_date + ALL players loaded\n'));

    try {
      // Load ALL players into cache
      await this.loadPlayerCache(sport);
      
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
        speed: 0,
        matched: this.stats.playersMatched,
        created: this.stats.playersCreated
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

  private async loadPlayerCache(sport?: string) {
    console.log('Loading player database...');
    
    // First get total count
    const { count } = await this.supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  Total players: ${count}`);
    
    // Load ALL players with proper pagination (Supabase limit is 1000)
    let allPlayers: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (offset < (count || 0)) {
      const { data: players, error } = await this.supabase
        .from('players')
        .select('id, name, sport')
        .range(offset, Math.min(offset + pageSize - 1, (count || 0) - 1))
        .order('id');
      
      if (error) {
        console.error('Error loading players:', error);
        break;
      }
      
      if (players && players.length > 0) {
        allPlayers = allPlayers.concat(players);
        offset += players.length;
        
        // Show progress
        if (offset % 5000 === 0 || offset === count) {
          console.log(`  Loaded ${offset}/${count} players...`);
        }
      } else {
        break;
      }
    }
    
    // Build cache with multiple name variations
    allPlayers.forEach(p => {
      if (p.name) {
        // Original name
        this.playerCache.set(p.name.toLowerCase(), p.id);
        
        // Without special characters
        this.playerCache.set(p.name.replace(/[^a-zA-Z\s]/g, '').toLowerCase(), p.id);
        
        // Without spaces
        this.playerCache.set(p.name.replace(/\s+/g, '').toLowerCase(), p.id);
        
        // Last name only (for matching "Smith" to "John Smith")
        const parts = p.name.split(' ');
        if (parts.length > 1) {
          this.playerCache.set(parts[parts.length - 1].toLowerCase(), p.id);
        }
      }
    });
    
    console.log(chalk.green(`✓ Loaded ${allPlayers.length} players into cache (${this.playerCache.size} name variations)`));
  }

  private async getGamesToProcess(sport?: string, lastProcessedId?: number): Promise<GameToProcess[]> {
    // Get all completed games
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
      .neq('home_score', 0)  // Exclude 0-0 games
      .neq('away_score', 0)
      .not('sport_id', 'is', null)
      .lte('start_time', new Date().toISOString())
      .gte('start_time', '2024-01-01')  // Focus on 2024+ games
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
    const batchSize = 1000;
    const gamesWithStatsSet = new Set<number>();
    
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      const { data: gamesWithStats } = await this.supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch);
      
      gamesWithStats?.forEach(s => gamesWithStatsSet.add(s.game_id));
    }
    
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
      this.progressBar.update(this.stats.processedGames, { 
        speed,
        matched: this.stats.playersMatched,
        created: this.stats.playersCreated
      });
      
      // Save checkpoint
      if (this.stats.processedGames % CONFIG.CHECKPOINT_INTERVAL === 0) {
        await this.flushBuffers();
        this.saveCheckpoint(batch[batch.length - 1].id);
      }
    }
  }

  private async processGame(game: GameToProcess) {
    try {
      // Extract ESPN ID (fixed to handle both nfl_ and espn_ formats)
      const espnId = game.external_id.replace(/^(?:espn_)?(?:nfl_|nba_|mlb_|nhl_)/, '');
      
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
    const gameDate = new Date(game.start_time).toISOString().split('T')[0]; // FIXED: Extract game date
    
    let gamePlayerCount = 0;
    
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
          
          gamePlayerCount++;
          
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
              game_date: gameDate,  // FIXED: Include game_date
              created_at: new Date()
            });
          }
        }
      }
    }
    
    // Track unique players per game for debugging
    if (gamePlayerCount < 20) {
      this.stats.errors.push(`Game ${game.id}: Only ${gamePlayerCount} players found`);
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
      
      // Skip empty or zero values for most stats (but keep 0 for some)
      if (!value || value === '--' || label === 'TEAM') continue;
      
      // Allow 0 for certain stats
      const allowZero = ['TD', 'INT', 'FUM', 'SACK', 'FF', 'FR'].includes(label);
      if (value === '0' && !allowZero) continue;
      
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
    
    // Basic fantasy scoring (DraftKings/FanDuel style)
    const scoring: Record<string, number> = {
      // Passing
      'passing_yds': numValue * 0.04,
      'passing_td': numValue * 4,
      'passing_int': numValue * -1,
      // Rushing
      'rushing_yds': numValue * 0.1,
      'rushing_td': numValue * 6,
      // Receiving
      'receiving_rec': numValue * 1,
      'receiving_yds': numValue * 0.1,
      'receiving_td': numValue * 6,
      // Other
      'fumbles_lost': numValue * -2,
      'defensive_sack': numValue * 1,
      'defensive_int': numValue * 2,
      'defensive_td': numValue * 6,
      'kicking_fg': numValue * 3,
      'kicking_xp': numValue * 1,
    };
    
    return scoring[statType] || 0;
  }

  private async getOrCreatePlayer(athlete: any, sport: string): Promise<number | null> {
    const name = athlete.displayName || athlete.fullName || '';
    if (!name) return null;
    
    // Try multiple cache lookups
    const lookups = [
      name.toLowerCase(),
      name.replace(/[^a-zA-Z\s]/g, '').toLowerCase(),
      name.replace(/\s+/g, '').toLowerCase(),
    ];
    
    for (const lookup of lookups) {
      const cachedId = this.playerCache.get(lookup);
      if (cachedId) {
        this.stats.playersMatched++;
        return cachedId;
      }
    }
    
    // Create new player
    try {
      const { data: newPlayer, error } = await this.supabase
        .from('players')
        .insert({
          name: name,
          position: athlete.position?.abbreviation,
          jersey_number: athlete.jersey,
          sport: sport,
          created_at: new Date()
        })
        .select('id')
        .single();

      if (!error && newPlayer) {
        // Add to cache
        this.playerCache.set(name.toLowerCase(), newPlayer.id);
        this.stats.playersCreated++;
        return newPlayer.id;
      }
    } catch (error) {
      // Player might already exist (race condition)
      const { data: existing } = await this.supabase
        .from('players')
        .select('id')
        .eq('name', name)
        .eq('sport', sport)
        .single();
      
      if (existing) {
        this.playerCache.set(name.toLowerCase(), existing.id);
        this.stats.playersMatched++;
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
      // Remove duplicates based on player_id and game_id
      const uniqueGameLogs = new Map<string, GameLog>();
      this.gameLogsBuffer.forEach(log => {
        const key = `${log.player_id}_${log.game_id}`;
        uniqueGameLogs.set(key, log);
      });
      
      const deduplicatedLogs = Array.from(uniqueGameLogs.values());
      
      const { error } = await this.supabase
        .from('player_game_logs')
        .upsert(deduplicatedLogs, {
          onConflict: 'player_id,game_id'
        });
      
      if (!error) {
        this.stats.totalGameLogs += deduplicatedLogs.length;
      } else {
        console.error('Game logs insert error:', error);
      }
      
      this.gameLogsBuffer = [];
    }
  }

  private loadCheckpoint(): any {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const data = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf-8'));
        // Restore stats
        if (data.stats) {
          this.stats.playersMatched = data.stats.playersMatched || 0;
          this.stats.playersCreated = data.stats.playersCreated || 0;
        }
        return data;
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
    console.log(`   Players Matched: ${chalk.green(this.stats.playersMatched.toLocaleString())}`);
    console.log(`   Players Created: ${chalk.yellow(this.stats.playersCreated.toLocaleString())}`);
    console.log(`   Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
    console.log(`   Speed: ${chalk.bold(gamesPerMinute + ' games/minute')}`);
    
    const successRate = this.stats.processedGames > 0 
      ? ((this.stats.successfulGames / this.stats.processedGames) * 100).toFixed(1)
      : '0';
    console.log(`   Success Rate: ${chalk.bold(successRate + '%')}`);

    // Show errors summary
    if (this.stats.errors.length > 0) {
      const lowPlayerGames = this.stats.errors.filter(e => e.includes('Only')).length;
      const notFoundGames = this.stats.errors.filter(e => e.includes('Not found')).length;
      const otherErrors = this.stats.errors.length - lowPlayerGames - notFoundGames;
      
      console.log(chalk.yellow(`\n⚠️  Error Summary:`));
      if (notFoundGames > 0) console.log(`   - ${notFoundGames} games not found on ESPN`);
      if (lowPlayerGames > 0) console.log(`   - ${lowPlayerGames} games with <20 players`);
      if (otherErrors > 0) console.log(`   - ${otherErrors} other errors`);
    }
  }
}

// CLI setup
program
  .name('ultimate-stats-collector-v3')
  .description('Ultimate stats collector with fixed player matching and game dates')
  .option('-s, --sport <sport>', 'Filter by sport (nfl, nba, mlb, nhl)')
  .option('-a, --all', 'Process all sports')
  .parse();

const options = program.opts();

// Run the collector
const collector = new UltimateStatsCollectorV3();
collector.run(options.sport || (options.all ? undefined : 'nfl'));