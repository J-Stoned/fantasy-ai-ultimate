import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE - RYZEN 5 7600X + 32GB RAM!
const HTTP_LIMIT = pLimit(48);   // 48 concurrent requests
const DB_LIMIT = pLimit(12);     // Database operations
const BATCH_SIZE = 2000;         // Huge batches!

class NCAA2024_2025TurboCollector {
  private startTime = Date.now();
  private gamesProcessed = 0;
  private gamesWithStats = 0;
  private statsCollected = 0;
  private playersCreated = 0;
  private totalAvailableStats = 0;
  
  // Massive caches for 32GB RAM
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, string>();
  private statsBuffer: any[] = [];
  private playerBuffer = new Map<string, any>();
  
  // Track what we find
  private missingGames: string[] = [];

  async collectAll() {
    console.log(chalk.cyan('🚀 NCAA Baseball 2024-2025 TURBO COLLECTOR!'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests)'));
    console.log(chalk.yellow('💾 RAM: 32GB (massive caching)'));
    console.log(chalk.yellow('🎯 Target: Find and collect ALL available stats'));
    console.log(chalk.yellow('🔧 Strategy: Pre-filter games with ESPN coverage\n'));

    // Load caches
    await this.loadCaches();

    // Process both seasons
    await this.processSeason(2024, '2024-02-16', '2024-06-25');
    await this.processSeason(2025, '2025-02-14', '2025-07-18');

    this.printFinalReport();
  }

  async loadCaches() {
    console.log(chalk.blue('📥 Loading caches...'));

    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    teams?.forEach(team => {
      this.teamCache.set(team.id, team.external_id);
    });

    // Load ALL players for better cache hit rate
    let offset = 0;
    while (true) {
      const { data: players } = await supabase
        .from('players')
        .select('id, external_id')
        .eq('sport', 'NCAA_BASEBALL')
        .range(offset, offset + 9999);
        
      if (!players || players.length === 0) break;
      
      players.forEach(player => {
        this.playerCache.set(player.external_id, player.id);
      });
      
      offset += 10000;
      if (players.length < 10000) break;
    }

    console.log(chalk.green(
      `✅ Loaded: ${this.teamCache.size} teams, ${this.playerCache.size} players\n`
    ));
  }

  async processSeason(year: number, start: string, end: string) {
    console.log(chalk.blue(`\n📅 Processing ${year} Season (${start} to ${end})...`));
    
    // Get ALL games for the season
    const games = await this.getSeasonGames(start, end);
    console.log(chalk.gray(`Found ${games.length} total games`));
    
    // First pass: Check which games have ESPN stats
    console.log(chalk.yellow('🔍 Pre-scanning for games with ESPN coverage...'));
    
    const gamesWithData: any[] = [];
    const scanBatchSize = 100;
    
    for (let i = 0; i < games.length; i += scanBatchSize) {
      const batch = games.slice(i, i + scanBatchSize);
      
      const promises = batch.map(game => 
        HTTP_LIMIT(async () => {
          const hasStats = await this.checkGameHasStats(game);
          if (hasStats) {
            gamesWithData.push(game);
          }
          return hasStats;
        })
      );
      
      await Promise.all(promises);
      
      if (i % 500 === 0) {
        console.log(chalk.gray(`  Scanned ${i + batch.length}/${games.length} games, found ${gamesWithData.length} with stats`));
      }
    }
    
    console.log(chalk.green(`✅ Found ${gamesWithData.length} games with ESPN stats (${(gamesWithData.length/games.length*100).toFixed(1)}%)`));
    
    if (gamesWithData.length === 0) {
      console.log(chalk.red('No games with stats found!'));
      return;
    }
    
    // Second pass: Collect stats from games with data
    console.log(chalk.yellow('\n📊 Collecting stats from games with ESPN coverage...'));
    
    for (let i = 0; i < gamesWithData.length; i += BATCH_SIZE) {
      const batch = gamesWithData.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
      const promises = batch.map(game => 
        HTTP_LIMIT(() => this.processGame(game, year))
      );
      
      await Promise.all(promises);
      
      // Flush buffers
      await this.flushBuffers();
      
      // Progress
      const batchTime = (Date.now() - batchStart) / 1000;
      const avgStatsPerGame = this.statsCollected / (this.gamesWithStats || 1);
      
      console.log(chalk.gray(
        `  Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} games in ${batchTime.toFixed(1)}s | ` +
        `${this.gamesWithStats}/${gamesWithData.length} processed | ${this.statsCollected} stats | ` +
        `${avgStatsPerGame.toFixed(1)} stats/game`
      ));
    }
    
    console.log(chalk.green(`✅ ${year} Complete: ${this.statsCollected} stats collected`));
  }

  async checkGameHasStats(game: any): Promise<boolean> {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      
      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)',
          'Accept': 'application/json'
        }
      });
      
      // Check if boxscore has actual player data
      if (response.data?.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          for (const category of teamData.statistics || []) {
            if (category.athletes && category.athletes.length > 0) {
              return true; // Found at least one player with stats
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async getSeasonGames(start: string, end: string) {
    const games = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'NCAA_BASEBALL')
        .eq('status', 'completed')
        .gte('start_time', start)
        .lte('start_time', end)
        .range(offset, offset + limit - 1)
        .order('start_time');

      if (error || !data || data.length === 0) break;

      games.push(...data);
      offset += limit;

      if (data.length < limit) break;
    }

    return games;
  }

  async processGame(game: any, year: number) {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)',
          'Accept': 'application/json'
        }
      });

      if (!response.data?.boxscore?.players) {
        this.gamesProcessed++;
        return;
      }

      let gameStatsCount = 0;
      let availableStats = 0;

      // Process boxscore with FIXED parsing
      for (const teamData of response.data.boxscore.players) {
        const teamId = this.getTeamId(game, teamData.team);
        if (!teamId) continue;

        for (const category of teamData.statistics || []) {
          // Use 'type' field
          const statType = category.type || category.name;
          
          for (const playerData of category.athletes || []) {
            availableStats++;
            
            if (!playerData.athlete || !playerData.stats) continue;

            const stats = statType === 'batting' 
              ? this.parseBattingStats(playerData.stats)
              : this.parsePitchingStats(playerData.stats);

            if (stats && Object.keys(stats).length > 0) {
              const playerStat = {
                player_external_id: `espn_ncaa_baseball_${playerData.athlete.id}`,
                player_name: playerData.athlete.displayName || playerData.athlete.name,
                team_id: teamId,
                game_id: game.id,
                stat_type: statType === 'batting' ? 'batting' : 'pitching',
                stats: stats,
                fantasy_points: this.calculateFantasyPoints(stats, statType)
              };

              this.statsBuffer.push(playerStat);
              this.statsCollected++;
              gameStatsCount++;

              // Track player
              if (!this.playerCache.has(playerStat.player_external_id)) {
                this.playerBuffer.set(playerStat.player_external_id, {
                  external_id: playerStat.player_external_id,
                  name: playerStat.player_name,
                  team_id: teamId,
                  sport: 'NCAA_BASEBALL',
                  metadata: { year }
                });
              }
            }
          }
        }
      }

      this.gamesProcessed++;
      this.gamesWithStats++;
      this.totalAvailableStats += availableStats;
      
      // Track high-stat games we might have missed
      if (gameStatsCount > 30) {
        console.log(chalk.green(`  💎 Found high-stat game: ${gameStatsCount} stats from game ${gameId}`));
      }
      
    } catch (error) {
      this.gamesProcessed++;
      this.missingGames.push(game.external_id);
    }
  }

  getTeamId(game: any, teamInfo: any): number | null {
    if (!teamInfo) return null;
    
    const teamExternalId = `espn_ncaa_baseball_${teamInfo.id}`;
    
    if (this.teamCache.get(game.home_team_id) === teamExternalId) {
      return game.home_team_id;
    } else if (this.teamCache.get(game.away_team_id) === teamExternalId) {
      return game.away_team_id;
    }
    
    return game.home_team_id;
  }

  parseBattingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 10) return null;
    
    // Parse the at-bat string (e.g., "2-4" means 2 hits in 4 at-bats)
    const abString = statsArray[0] || '0-0';
    const [hits, atBats] = abString.split('-').map(x => parseInt(x) || 0);
    
    // Skip if no at-bats
    if (atBats === 0) return null;
    
    return {
      ab: atBats,
      h: hits,
      r: parseInt(statsArray[2]) || 0,
      rbi: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      hr: parseInt(statsArray[6]) || 0,
      sb: parseInt(statsArray[7]) || 0,
      avg: parseFloat(statsArray[9]) || 0
    };
  }

  parsePitchingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 8) return null;
    
    const parseIP = (val: any) => {
      if (!val || val === '--' || val === '0.0') return 0;
      const parts = val.toString().split('.');
      const innings = parseInt(parts[0]) || 0;
      const outs = parseInt(parts[1]) || 0;
      return innings + (outs / 3);
    };

    const ip = parseIP(statsArray[0]);
    if (ip === 0) return null;
    
    return {
      ip: ip,
      h: parseInt(statsArray[1]) || 0,
      r: parseInt(statsArray[2]) || 0,
      er: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      hr: parseInt(statsArray[6]) || 0,
      era: parseFloat(statsArray[8]) || 0
    };
  }

  calculateFantasyPoints(stats: any, type: string): number {
    if (type === 'batting') {
      return (stats.h * 1) + (stats.r * 1) + (stats.rbi * 1) + 
             (stats.bb * 1) + (stats.hr * 3) + (stats.sb * 1) + 
             (stats.so * -0.5);
    } else {
      return (stats.ip * 3) + (stats.so * 1) + (stats.er * -1) + 
             (stats.bb * -0.5) + (stats.h * -0.5) + (stats.hr * -1);
    }
  }

  async flushBuffers() {
    // Create players
    if (this.playerBuffer.size > 0) {
      const newPlayers = Array.from(this.playerBuffer.values());
      this.playerBuffer.clear();

      await DB_LIMIT(async () => {
        const { data } = await supabase
          .from('players')
          .upsert(newPlayers, { onConflict: 'external_id' })
          .select('id, external_id');

        data?.forEach(player => {
          this.playerCache.set(player.external_id, player.id);
        });
        
        this.playersCreated += data?.length || 0;
      });
    }

    // Insert stats
    if (this.statsBuffer.length > 0) {
      const stats = [...this.statsBuffer];
      this.statsBuffer = [];

      const statsToInsert = stats
        .map(stat => ({
          player_id: this.playerCache.get(stat.player_external_id),
          game_id: stat.game_id,
          stat_type: stat.stat_type,
          stat_value: stat.stats,
          fantasy_points: stat.fantasy_points
        }))
        .filter(s => s.player_id);

      if (statsToInsert.length > 0) {
        await DB_LIMIT(async () => {
          const { error } = await supabase
            .from('player_stats')
            .insert(statsToInsert);

          if (error) {
            console.error(chalk.red('DB Error:'), error.message);
          }
        });
      }
    }
  }

  printFinalReport() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSec = this.gamesProcessed / elapsed;
    const statsPerGame = this.statsCollected / (this.gamesWithStats || 1);
    const captureRate = (this.statsCollected / this.totalAvailableStats * 100) || 0;

    console.log(chalk.cyan('\n🎉 NCAA 2024-2025 TURBO COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`✅ Games Processed: ${this.gamesProcessed.toLocaleString()}`));
    console.log(chalk.green(`📊 Games with ESPN Stats: ${this.gamesWithStats.toLocaleString()}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.green(`📊 Stats Available: ${this.totalAvailableStats.toLocaleString()}`));
    console.log(chalk.green(`👥 New Players Created: ${this.playersCreated.toLocaleString()}`));
    console.log(chalk.yellow(`📊 Avg Stats/Game: ${statsPerGame.toFixed(1)}`));
    console.log(chalk.yellow(`🎯 Capture Rate: ${captureRate.toFixed(1)}%`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log(chalk.red(`⚠️  ESPN Coverage: ${((this.gamesWithStats/this.gamesProcessed)*100).toFixed(1)}% of games have stats`));
    console.log('═══════════════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const collector = new NCAA2024_2025TurboCollector();
collector.collectAll()
  .then(() => {
    console.log(chalk.green('\n✅ 2024-2025 TURBO COLLECTION COMPLETE!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });