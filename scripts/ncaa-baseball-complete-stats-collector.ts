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

// 🔥 RYZEN 5 7600X TURBO MODE WITH 32GB RAM!
const HTTP_LIMIT = pLimit(48);  // 48 concurrent API requests (2x increase!)
const DB_LIMIT = pLimit(12);    // More DB operations
const BATCH_SIZE = 2000;        // HUGE batches - we have 32GB RAM!

interface GameToProcess {
  id: number;
  external_id: string;
  home_team_id: number;
  away_team_id: number;
}

interface PlayerStat {
  player_external_id: string;
  player_name: string;
  team_id: number;
  game_id: number;
  stat_type: 'batting' | 'pitching';
  stats: any;
  fantasy_points?: number;
}

class NCAABaseballCompleteStatsCollector {
  private startTime = Date.now();
  private totalGames = 0;
  private gamesProcessed = 0;
  private statsCollected = 0;
  private playersCreated = 0;
  private errors = 0;
  
  // In-memory caches (32GB RAM!)
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, string>(); // id -> external_id
  
  // MASSIVE Buffers for 32GB RAM!
  private statsBuffer: PlayerStat[] = [];
  private playerBuffer = new Map<string, any>();
  private STATS_BUFFER_SIZE = 10000;  // Hold 10K stats in memory
  private PLAYER_BUFFER_SIZE = 5000;  // Hold 5K players in memory

  async collectAllStats() {
    console.log(chalk.cyan('🚀 NCAA Baseball COMPLETE Stats Collector - TURBO MODE!'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests!)'));
    console.log(chalk.yellow('💾 RAM: 32GB (2,000 games per batch!)'));
    console.log(chalk.yellow('🔥 Buffers: 10K stats + 5K players in memory'));
    console.log(chalk.yellow('🎯 Target: ALL 15,167 games\n'));

    // Pre-load caches
    await this.loadCaches();

    // Get ALL games
    const games = await this.getAllGames();
    this.totalGames = games.length;
    
    console.log(chalk.blue(`📊 Found ${this.totalGames} NCAA Baseball games\n`));

    // Process in large batches
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
      // Process batch with all 24 threads
      const promises = batch.map(game => 
        HTTP_LIMIT(() => this.processGame(game))
      );
      
      await Promise.all(promises);
      
      // Flush buffers
      await this.flushBuffers();
      
      // Progress report with RAM usage
      const batchTime = (Date.now() - batchStart) / 1000;
      const totalElapsed = (Date.now() - this.startTime) / 1000;
      const gamesPerSec = this.gamesProcessed / totalElapsed;
      const eta = (this.totalGames - this.gamesProcessed) / gamesPerSec;
      const memUsage = process.memoryUsage();
      const ramMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      console.log(chalk.gray(
        `Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} games in ${batchTime.toFixed(1)}s | ` +
        `Total: ${this.gamesProcessed}/${this.totalGames} | ` +
        `${this.statsCollected} stats | ${gamesPerSec.toFixed(1)} games/sec | ` +
        `RAM: ${ramMB}MB | ETA: ${Math.ceil(eta / 60)} min`
      ));
    }

    this.printFinalReport();
  }

  async getAllGames(): Promise<GameToProcess[]> {
    const games: GameToProcess[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('games')
        .select('id, external_id, home_team_id, away_team_id')
        .eq('sport', 'NCAA_BASEBALL')
        .eq('status', 'completed')
        .range(offset, offset + limit - 1)
        .order('id');

      if (error || !data || data.length === 0) break;

      games.push(...data);
      offset += limit;

      if (data.length < limit) break;
    }

    return games;
  }

  async processGame(game: GameToProcess) {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)'
        }
      });

      if (response.data?.boxscore?.players) {
        await this.processBoxscore(response.data.boxscore, game);
      }

      this.gamesProcessed++;
      
    } catch (error: any) {
      this.errors++;
      if (error.response?.status === 404) {
        // Game not found - normal for some old games
      } else if (error.code === 'ECONNABORTED') {
        // Timeout - skip
      } else {
        // Log other errors briefly
        if (this.errors % 100 === 0) {
          console.log(chalk.red(`Errors so far: ${this.errors}`));
        }
      }
    }
  }

  async processBoxscore(boxscore: any, game: GameToProcess) {
    for (const teamData of boxscore.players || []) {
      if (!teamData.team || !teamData.statistics) continue;

      // Determine which team this is
      const teamExternalId = `espn_ncaa_baseball_${teamData.team.id}`;
      let teamId: number;
      
      // Match team by external ID
      if (this.teamCache.get(game.home_team_id) === teamExternalId) {
        teamId = game.home_team_id;
      } else if (this.teamCache.get(game.away_team_id) === teamExternalId) {
        teamId = game.away_team_id;
      } else {
        // Try to match by team ID directly
        teamId = game.home_team_id; // Default to home
      }

      // Process each stat category
      for (const category of teamData.statistics) {
        const athletes = category.athletes || [];
        
        for (const playerData of athletes) {
          if (!playerData.athlete || !playerData.stats) continue;

          const playerExternalId = `espn_ncaa_baseball_${playerData.athlete.id}`;
          const playerName = playerData.athlete.displayName || 
                           playerData.athlete.shortName || 
                           playerData.athlete.name || 
                           'Unknown';

          // Store player info for later creation
          if (!this.playerCache.has(playerExternalId)) {
            this.playerBuffer.set(playerExternalId, {
              external_id: playerExternalId,
              name: playerName,
              team_id: teamId,
              sport: 'NCAA_BASEBALL',
              metadata: {
                jersey: playerData.athlete.jersey,
                position: playerData.athlete.position?.abbreviation
              }
            });
          }

          // Parse stats based on category
          let stats: any = null;
          let statType: 'batting' | 'pitching' = 'batting';

          if (category.name === 'batting' || category.type === 'batting') {
            stats = this.parseBattingStats(playerData.stats);
            statType = 'batting';
          } else if (category.name === 'pitching' || category.type === 'pitching') {
            stats = this.parsePitchingStats(playerData.stats);
            statType = 'pitching';
          }

          if (stats && Object.keys(stats).length > 0) {
            const playerStat: PlayerStat = {
              player_external_id: playerExternalId,
              player_name: playerName,
              team_id: teamId,
              game_id: game.id,
              stat_type: statType,
              stats: stats,
              fantasy_points: statType === 'batting' 
                ? this.calculateBattingFantasyPoints(stats)
                : this.calculatePitchingFantasyPoints(stats)
            };

            this.statsBuffer.push(playerStat);
            this.statsCollected++;
            
            // Auto-flush if buffer is full
            if (this.statsBuffer.length >= this.STATS_BUFFER_SIZE) {
              await this.flushBuffers();
            }
          }
        }
      }
    }
  }

  parseBattingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    // Convert string stats to numbers, handling "--" as 0
    const parseNum = (val: any) => {
      if (val === '--' || val === '-' || val === '') return 0;
      return parseInt(val) || 0;
    };
    
    const parseFloat = (val: any) => {
      if (val === '--' || val === '-' || val === '') return 0;
      return parseFloat(val) || 0;
    };

    return {
      ab: parseNum(statsArray[0]),
      r: parseNum(statsArray[1]),
      h: parseNum(statsArray[2]),
      rbi: parseNum(statsArray[3]),
      bb: parseNum(statsArray[4]),
      so: parseNum(statsArray[5]),
      avg: parseFloat(statsArray[6])
    };
  }

  parsePitchingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    const parseNum = (val: any) => {
      if (val === '--' || val === '-' || val === '') return 0;
      return parseInt(val) || 0;
    };

    // Parse innings pitched (e.g., "6.2" = 6 and 2/3 innings)
    const parseIP = (val: any) => {
      if (!val || val === '--') return 0;
      const parts = val.toString().split('.');
      const whole = parseInt(parts[0]) || 0;
      const fraction = parseInt(parts[1]) || 0;
      return whole + (fraction / 3);
    };

    return {
      ip: parseIP(statsArray[0]),
      h: parseNum(statsArray[1]),
      r: parseNum(statsArray[2]),
      er: parseNum(statsArray[3]),
      bb: parseNum(statsArray[4]),
      so: parseNum(statsArray[5]),
      era: parseFloat(statsArray[6]) || 0
    };
  }

  calculateBattingFantasyPoints(stats: any): number {
    return (
      (stats.h || 0) * 1 +
      (stats.r || 0) * 1 +
      (stats.rbi || 0) * 1 +
      (stats.bb || 0) * 1 +
      (stats.so || 0) * -0.5
    );
  }

  calculatePitchingFantasyPoints(stats: any): number {
    return (
      (stats.ip || 0) * 3 +
      (stats.so || 0) * 1 +
      (stats.er || 0) * -1 +
      (stats.bb || 0) * -0.5 +
      (stats.h || 0) * -0.5
    );
  }

  async loadCaches() {
    console.log(chalk.blue('📥 Loading caches...'));

    // Load all teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    teams?.forEach(team => {
      this.teamCache.set(team.id, team.external_id);
    });

    // Load existing players
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    players?.forEach(player => {
      this.playerCache.set(player.external_id, player.id);
    });

    console.log(chalk.green(
      `✅ Loaded: ${this.teamCache.size} teams, ${this.playerCache.size} existing players\n`
    ));
  }

  async flushBuffers() {
    // First, create any new players
    if (this.playerBuffer.size > 0) {
      const newPlayers = Array.from(this.playerBuffer.values());
      this.playerBuffer.clear();

      await DB_LIMIT(async () => {
        const { data, error } = await supabase
          .from('players')
          .upsert(newPlayers, { onConflict: 'external_id' })
          .select('id, external_id');

        if (data) {
          data.forEach(player => {
            this.playerCache.set(player.external_id, player.id);
          });
          this.playersCreated += data.length;
        }
      });
    }

    // Then insert stats
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
        .filter(s => s.player_id); // Only insert if we have player ID

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
    const statsPerGame = this.statsCollected / this.gamesProcessed || 0;

    console.log(chalk.cyan('\n🎉 COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Total Games: ${this.totalGames}`));
    console.log(chalk.green(`✅ Games Processed: ${this.gamesProcessed}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.green(`👥 New Players Created: ${this.playersCreated}`));
    console.log(chalk.yellow(`📊 Avg Stats/Game: ${statsPerGame.toFixed(1)}`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log(chalk.red(`❌ Errors: ${this.errors} (${(this.errors/this.totalGames*100).toFixed(1)}%)`));
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (this.statsCollected === 0) {
      console.log(chalk.red('\n⚠️  WARNING: No stats were collected!'));
      console.log(chalk.yellow('This might indicate an issue with the ESPN API.'));
    } else {
      console.log(chalk.green(`\n✅ Successfully collected ${this.statsCollected.toLocaleString()} player stats!`));
    }
  }
}

// 🚀 RUN IT!
const collector = new NCAABaseballCompleteStatsCollector();
collector.collectAllStats()
  .then(() => {
    console.log(chalk.green('\n✅ All done!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });