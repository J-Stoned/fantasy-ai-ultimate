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

class NCAABaseballUltimateCollector {
  private startTime = Date.now();
  private gamesProcessed = 0;
  private statsCollected = 0;
  private playersCreated = 0;
  private successfulAPICalls = 0;
  private totalAvailableStats = 0;
  
  // Massive caches for 32GB RAM
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, string>();
  private statsBuffer: any[] = [];
  private playerBuffer = new Map<string, any>();
  
  // Track seasons
  private seasonStats = new Map<number, { games: number, stats: number }>();

  async collectAllSeasons() {
    console.log(chalk.cyan('🚀 NCAA BASEBALL ULTIMATE COLLECTOR - ALL SEASONS!'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests)'));
    console.log(chalk.yellow('💾 RAM: 32GB (2,000 games per batch)'));
    console.log(chalk.yellow('🎯 Target: 40-50 stats per game'));
    console.log(chalk.yellow('🔧 FIXED: Using type field instead of name\n'));

    // Load caches
    await this.loadCaches();

    // Define all seasons
    const seasons = [
      { year: 2021, start: '2021-02-19', end: '2021-06-30' },
      { year: 2022, start: '2022-02-18', end: '2022-06-27' },
      { year: 2023, start: '2023-02-17', end: '2023-06-26' },
      { year: 2024, start: '2024-02-16', end: '2024-06-25' },
      { year: 2025, start: '2025-02-14', end: '2025-07-18' }
    ];

    // Process each season
    for (const season of seasons) {
      console.log(chalk.blue(`\n📅 Processing ${season.year} Season...`));
      
      const games = await this.getSeasonGames(season.start, season.end);
      console.log(chalk.gray(`Found ${games.length} games`));
      
      if (games.length === 0) continue;
      
      // Initialize season tracking
      this.seasonStats.set(season.year, { games: 0, stats: 0 });
      
      // Process in batches
      for (let i = 0; i < games.length; i += BATCH_SIZE) {
        const batch = games.slice(i, i + BATCH_SIZE);
        const batchStart = Date.now();
        
        // Process with all threads
        const promises = batch.map(game => 
          HTTP_LIMIT(() => this.processGame(game, season.year))
        );
        
        await Promise.all(promises);
        
        // Flush buffers
        await this.flushBuffers();
        
        // Progress
        const batchTime = (Date.now() - batchStart) / 1000;
        const seasonData = this.seasonStats.get(season.year)!;
        const avgStatsPerGame = seasonData.stats / (seasonData.games || 1);
        
        console.log(chalk.gray(
          `  Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} games in ${batchTime.toFixed(1)}s | ` +
          `${seasonData.games}/${games.length} | ${seasonData.stats} stats | ` +
          `${avgStatsPerGame.toFixed(1)} stats/game`
        ));
      }
      
      const seasonData = this.seasonStats.get(season.year)!;
      console.log(chalk.green(
        `✅ ${season.year} Complete: ${seasonData.stats.toLocaleString()} stats from ${seasonData.games} games`
      ));
    }

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

    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .limit(50000); // Load more players

    players?.forEach(player => {
      this.playerCache.set(player.external_id, player.id);
    });

    console.log(chalk.green(
      `✅ Loaded: ${this.teamCache.size} teams, ${this.playerCache.size} players\n`
    ));
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

      this.successfulAPICalls++;
      let gameStatsCount = 0;
      let availableStats = 0;

      // Process boxscore with FIXED parsing
      for (const teamData of response.data.boxscore.players) {
        const teamId = this.getTeamId(game, teamData.team);
        if (!teamId) continue;

        for (const category of teamData.statistics || []) {
          // 🔧 FIX: Use 'type' field instead of 'name'
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
      this.totalAvailableStats += availableStats;
      
      // Update season stats
      const seasonData = this.seasonStats.get(year)!;
      seasonData.games++;
      seasonData.stats += gameStatsCount;
      
    } catch (error) {
      this.gamesProcessed++;
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
    // NCAA Baseball batting stats have 12 elements
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
    // NCAA Baseball pitching stats have 10 elements
    if (!Array.isArray(statsArray) || statsArray.length < 8) return null;
    
    const parseIP = (val: any) => {
      if (!val || val === '--' || val === '0.0') return 0;
      const parts = val.toString().split('.');
      const innings = parseInt(parts[0]) || 0;
      const outs = parseInt(parts[1]) || 0;
      return innings + (outs / 3);
    };

    const ip = parseIP(statsArray[0]);
    if (ip === 0) return null; // Skip pitchers who didn't pitch
    
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
    const statsPerGame = this.statsCollected / this.gamesProcessed || 0;
    const captureRate = (this.statsCollected / this.totalAvailableStats * 100) || 0;

    console.log(chalk.cyan('\n🎉 NCAA BASEBALL ULTIMATE COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`✅ Games Processed: ${this.gamesProcessed.toLocaleString()}`));
    console.log(chalk.green(`🎯 Successful API Calls: ${this.successfulAPICalls.toLocaleString()}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.green(`📊 Stats Available: ${this.totalAvailableStats.toLocaleString()}`));
    console.log(chalk.green(`👥 New Players Created: ${this.playersCreated.toLocaleString()}`));
    console.log(chalk.yellow(`📊 Avg Stats/Game: ${statsPerGame.toFixed(1)}`));
    console.log(chalk.yellow(`🎯 Capture Rate: ${captureRate.toFixed(1)}%`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log('═══════════════════════════════════════════════════════════════');
    
    console.log(chalk.blue('\n📅 Season Breakdown:'));
    for (const [year, data] of this.seasonStats) {
      const avg = data.stats / (data.games || 1);
      console.log(`  ${year}: ${data.stats.toLocaleString()} stats from ${data.games} games (${avg.toFixed(1)} avg)`);
    }
  }
}

// 🚀 RUN IT!
const collector = new NCAABaseballUltimateCollector();
collector.collectAllSeasons()
  .then(() => {
    console.log(chalk.green('\n✅ ULTIMATE COLLECTION COMPLETE!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });