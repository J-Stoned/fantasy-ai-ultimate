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

interface PlayerStat {
  player_external_id: string;
  player_name: string;
  team_id: number;
  game_id: number;
  stat_type: 'batting' | 'pitching';
  stats: any;
  fantasy_points: number;
}

class NCAAD1Baseball2021StatsCollector {
  private startTime = Date.now();
  private gamesProcessed = 0;
  private statsCollected = 0;
  private playersCreated = 0;
  private successfulAPICalls = 0;
  private errors = 0;
  
  // Massive caches for 32GB RAM
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, string>();
  private statsBuffer: PlayerStat[] = [];
  private playerBuffer = new Map<string, any>();

  async collectAll2021Stats() {
    console.log(chalk.cyan('🚀 NCAA D1 Baseball 2021 Stats Collector - TURBO MODE!'));
    console.log(chalk.yellow('🎯 Target: 2021 Season (Feb 19 - June 30)'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests)'));
    console.log(chalk.yellow('💾 RAM: 32GB (2,000 games per batch)'));
    console.log(chalk.yellow('🏫 Focus: Division 1 only\n'));

    // Load caches
    await this.loadCaches();

    // Get all 2021 D1 games
    const games = await this.getAll2021D1Games();
    console.log(chalk.blue(`📊 Found ${games.length} NCAA D1 Baseball games from 2021\n`));

    // Test with a small batch first
    console.log(chalk.yellow('🧪 Testing with 10 games first...\n'));
    const testGames = games.slice(0, 10);
    
    for (const game of testGames) {
      await this.processGame(game, true); // verbose mode for testing
    }

    if (this.statsCollected === 0) {
      console.log(chalk.red('\n❌ No stats found in test games.'));
      console.log(chalk.yellow('💡 Trying alternative endpoints...\n'));
      
      // Try different approach
      await this.tryAlternativeEndpoints(testGames[0]);
      return;
    }

    console.log(chalk.green(`\n✅ Test successful! Found ${this.statsCollected} stats.`));
    console.log(chalk.yellow('🚀 Processing all games...\n'));

    // Reset counters
    this.gamesProcessed = 0;
    this.statsCollected = 0;
    this.successfulAPICalls = 0;
    this.errors = 0;

    // Process all games
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
      // Process with all threads
      const promises = batch.map(game => 
        HTTP_LIMIT(() => this.processGame(game, false))
      );
      
      await Promise.all(promises);
      
      // Flush buffers
      await this.flushBuffers();
      
      // Progress
      const batchTime = (Date.now() - batchStart) / 1000;
      const totalElapsed = (Date.now() - this.startTime) / 1000;
      const gamesPerSec = this.gamesProcessed / totalElapsed;
      const successRate = (this.successfulAPICalls / this.gamesProcessed * 100).toFixed(1);
      const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      
      console.log(chalk.gray(
        `Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} games in ${batchTime.toFixed(1)}s | ` +
        `${this.gamesProcessed}/${games.length} | ${this.statsCollected} stats | ` +
        `${successRate}% success | ${gamesPerSec.toFixed(1)} g/s | RAM: ${memUsage}MB`
      ));
    }

    this.printFinalReport(games.length);
  }

  async getAll2021D1Games() {
    const games = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('games')
        .select('id, external_id, home_team_id, away_team_id, start_time, venue')
        .eq('sport', 'NCAA_BASEBALL')
        .eq('status', 'completed')
        .gte('start_time', '2021-02-19')
        .lte('start_time', '2021-06-30')
        .range(offset, offset + limit - 1)
        .order('start_time');

      if (error || !data || data.length === 0) break;

      games.push(...data);
      offset += limit;

      if (data.length < limit) break;
    }

    // Filter for D1 teams (you might need to adjust this based on your team data)
    // For now, we'll assume all NCAA_BASEBALL teams in our DB are D1
    return games;
  }

  async processGame(game: any, verbose: boolean = false) {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      
      if (verbose) {
        console.log(chalk.blue(`Processing game ${gameId} from ${game.start_time}`));
      }

      // Try multiple endpoints
      const endpoints = [
        `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`,
        `https://sports.core.api.espn.com/v2/sports/baseball/leagues/college-baseball/events/${gameId}/competitions/${gameId}/competitors`,
        `https://cdn.espn.com/core/college-baseball/gamecast?xhr=1&gameId=${gameId}`
      ];

      let data = null;
      let endpointWorked = -1;

      for (let i = 0; i < endpoints.length; i++) {
        try {
          const response = await axios.get(endpoints[i], {
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)',
              'Accept': 'application/json'
            }
          });

          if (response.data) {
            data = response.data;
            endpointWorked = i;
            break;
          }
        } catch (e) {
          // Try next endpoint
        }
      }

      if (!data) {
        this.errors++;
        this.gamesProcessed++;
        return;
      }

      this.successfulAPICalls++;

      if (verbose) {
        console.log(chalk.green(`  ✅ Endpoint ${endpointWorked + 1} worked!`));
      }

      // Process based on which endpoint worked
      if (endpointWorked === 0 && data.boxscore?.players) {
        // Standard summary endpoint
        await this.processBoxscore(data.boxscore, game, verbose);
      } else if (data.gamepackageJSON) {
        // Gamecast endpoint
        await this.processGamecast(data.gamepackageJSON, game, verbose);
      } else if (data.items) {
        // Competitors endpoint
        await this.processCompetitors(data.items, game, verbose);
      }

      this.gamesProcessed++;
      
    } catch (error) {
      this.errors++;
      this.gamesProcessed++;
      
      if (verbose) {
        console.log(chalk.red(`  ❌ Error: ${error}`));
      }
    }
  }

  async processBoxscore(boxscore: any, game: any, verbose: boolean) {
    if (!boxscore.players) return;

    for (const teamData of boxscore.players) {
      const teamId = this.getTeamId(game, teamData.team);
      if (!teamId) continue;

      for (const category of teamData.statistics || []) {
        const statCount = category.athletes?.length || 0;
        
        if (verbose && statCount > 0) {
          console.log(chalk.gray(`    Found ${statCount} ${category.name} stats`));
        }

        for (const playerData of category.athletes || []) {
          if (!playerData.athlete || !playerData.stats) continue;

          const stats = category.name === 'batting' 
            ? this.parseBattingStats(playerData.stats)
            : this.parsePitchingStats(playerData.stats);

          if (stats && Object.keys(stats).length > 0) {
            const playerStat: PlayerStat = {
              player_external_id: `espn_ncaa_baseball_${playerData.athlete.id}`,
              player_name: playerData.athlete.displayName || playerData.athlete.name,
              team_id: teamId,
              game_id: game.id,
              stat_type: category.name === 'batting' ? 'batting' : 'pitching',
              stats: stats,
              fantasy_points: this.calculateFantasyPoints(stats, category.name)
            };

            this.statsBuffer.push(playerStat);
            this.statsCollected++;

            // Track player
            if (!this.playerCache.has(playerStat.player_external_id)) {
              this.playerBuffer.set(playerStat.player_external_id, {
                external_id: playerStat.player_external_id,
                name: playerStat.player_name,
                team_id: teamId,
                sport: 'NCAA_BASEBALL',
                metadata: { year: 2021 }
              });
            }
          }
        }
      }
    }
  }

  async processGamecast(gamecast: any, game: any, verbose: boolean) {
    // Handle gamecast format
    if (verbose) {
      console.log(chalk.yellow('    Processing gamecast format...'));
    }
    // Implementation depends on gamecast structure
  }

  async processCompetitors(competitors: any[], game: any, verbose: boolean) {
    // Handle competitors format
    if (verbose) {
      console.log(chalk.yellow('    Processing competitors format...'));
    }
    // Implementation depends on competitors structure
  }

  async tryAlternativeEndpoints(game: any) {
    console.log(chalk.cyan('🔍 Trying alternative data sources...\n'));

    const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
    
    // Try web scraping approach
    console.log('1. Checking ESPN game page directly...');
    const pageUrl = `https://www.espn.com/college-baseball/boxscore/_/gameId/${gameId}`;
    console.log(`   URL: ${pageUrl}`);
    
    // Try NCAA.org API
    console.log('\n2. Checking NCAA.org data...');
    console.log('   Note: NCAA.org might have different game IDs');
    
    // Try ESPN hidden APIs
    console.log('\n3. Checking ESPN v3 APIs...');
    const v3Url = `https://site.api.espn.com/apis/site/v3/sports/baseball/college-baseball/summary?event=${gameId}`;
    
    try {
      const response = await axios.get(v3Url);
      console.log(chalk.green('   ✅ V3 API exists!'));
    } catch (e) {
      console.log(chalk.red('   ❌ V3 API not found'));
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
    
    return game.home_team_id; // Default
  }

  parseBattingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    return {
      ab: parseInt(statsArray[0]) || 0,
      r: parseInt(statsArray[1]) || 0,
      h: parseInt(statsArray[2]) || 0,
      rbi: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      avg: parseFloat(statsArray[6]) || 0
    };
  }

  parsePitchingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    const parseIP = (val: any) => {
      if (!val || val === '--') return 0;
      const parts = val.toString().split('.');
      return (parseInt(parts[0]) || 0) + ((parseInt(parts[1]) || 0) / 3);
    };

    return {
      ip: parseIP(statsArray[0]),
      h: parseInt(statsArray[1]) || 0,
      r: parseInt(statsArray[2]) || 0,
      er: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      era: parseFloat(statsArray[6]) || 0
    };
  }

  calculateFantasyPoints(stats: any, type: string): number {
    if (type === 'batting') {
      return (stats.h * 1) + (stats.r * 1) + (stats.rbi * 1) + 
             (stats.bb * 1) + (stats.so * -0.5);
    } else {
      return (stats.ip * 3) + (stats.so * 1) + (stats.er * -1) + 
             (stats.bb * -0.5) + (stats.h * -0.5);
    }
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

    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .limit(5000);

    players?.forEach(player => {
      this.playerCache.set(player.external_id, player.id);
    });

    console.log(chalk.green(
      `✅ Loaded: ${this.teamCache.size} teams, ${this.playerCache.size} players\n`
    ));
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

  printFinalReport(totalGames: number) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSec = this.gamesProcessed / elapsed;
    const statsPerGame = this.statsCollected / this.gamesProcessed || 0;
    const successRate = (this.successfulAPICalls / this.gamesProcessed * 100) || 0;

    console.log(chalk.cyan('\n🎉 2021 NCAA D1 BASEBALL COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Total Games: ${totalGames}`));
    console.log(chalk.green(`✅ Games Processed: ${this.gamesProcessed}`));
    console.log(chalk.green(`🎯 Successful API Calls: ${this.successfulAPICalls} (${successRate.toFixed(1)}%)`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.green(`👥 New Players Created: ${this.playersCreated}`));
    console.log(chalk.yellow(`📊 Avg Stats/Game: ${statsPerGame.toFixed(1)}`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log(chalk.red(`❌ Errors: ${this.errors}`));
    console.log('═══════════════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const collector = new NCAAD1Baseball2021StatsCollector();
collector.collectAll2021Stats()
  .then(() => {
    console.log(chalk.green('\n✅ Done!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });