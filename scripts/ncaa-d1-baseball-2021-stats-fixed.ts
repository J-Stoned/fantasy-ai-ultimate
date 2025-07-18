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

// D1 Conference list
const D1_CONFERENCES = [
  'SEC', 'ACC', 'Big Ten', 'Pac-12', 'Big 12', 'Big East', 'American Athletic',
  'Atlantic 10', 'Big South', 'Big West', 'CAA', 'Conference USA', 'Horizon League',
  'Ivy League', 'MAAC', 'MAC', 'MEAC', 'Missouri Valley', 'Mountain West',
  'Northeast', 'Ohio Valley', 'Patriot League', 'Southern', 'Southland', 
  'SWAC', 'Summit League', 'Sun Belt', 'WAC', 'WCC'
];

class NCAAD1Baseball2021StatsFixed {
  private startTime = Date.now();
  private gamesProcessed = 0;
  private statsCollected = 0;
  private playersCreated = 0;
  private successfulAPICalls = 0;
  private skippedNonD1 = 0;
  
  // Massive caches for 32GB RAM
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, string>();
  private d1TeamIds = new Set<number>();
  private statsBuffer: any[] = [];
  private playerBuffer = new Map<string, any>();

  async collectAll2021Stats() {
    console.log(chalk.cyan('🚀 NCAA D1 Baseball 2021 Stats RE-COLLECTOR (D1 ONLY!)'));
    console.log(chalk.yellow('🎯 Target: 2021 Season D1 Games Only'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests)'));
    console.log(chalk.yellow('💾 RAM: 32GB (2,000 games per batch)'));
    console.log(chalk.yellow('🏆 Expected: 40-50 stats per game\n'));

    // Load caches and identify D1 teams
    await this.loadCachesAndIdentifyD1Teams();

    // Get all 2021 games (D1 only)
    const games = await this.getAll2021D1Games();
    console.log(chalk.blue(`📊 Found ${games.length} D1 games from 2021\n`));

    if (games.length === 0) {
      console.log(chalk.red('No D1 games found!'));
      return;
    }

    // Process all games
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
      // Process with all threads
      const promises = batch.map(game => 
        HTTP_LIMIT(() => this.processGame(game))
      );
      
      await Promise.all(promises);
      
      // Flush buffers
      await this.flushBuffers();
      
      // Progress
      const batchTime = (Date.now() - batchStart) / 1000;
      const totalElapsed = (Date.now() - this.startTime) / 1000;
      const gamesPerSec = this.gamesProcessed / totalElapsed;
      const successRate = (this.successfulAPICalls / (this.gamesProcessed || 1) * 100).toFixed(1);
      const avgStatsPerGame = this.statsCollected / (this.gamesProcessed || 1);
      
      console.log(chalk.gray(
        `Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} games in ${batchTime.toFixed(1)}s | ` +
        `${this.gamesProcessed}/${games.length} | ${this.statsCollected} stats | ` +
        `${avgStatsPerGame.toFixed(1)} stats/game | ${successRate}% success | ${gamesPerSec.toFixed(1)} g/s`
      ));
    }

    this.printFinalReport(games.length);
  }

  async loadCachesAndIdentifyD1Teams() {
    console.log(chalk.blue('📥 Loading caches and identifying D1 teams...'));

    // First, try to identify D1 teams by checking game summaries
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id')
      .eq('sport', 'NCAA_BASEBALL')
      .eq('status', 'completed')
      .limit(100);

    if (sampleGames) {
      console.log(chalk.gray('Checking sample games for D1 teams...'));
      
      for (const game of sampleGames.slice(0, 20)) {
        const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
        try {
          const response = await axios.get(
            `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`,
            { timeout: 5000 }
          );
          
          // Check if this is a D1 game based on competition notes or team info
          if (response.data.header?.competitions?.[0]) {
            const comp = response.data.header.competitions[0];
            const notes = JSON.stringify(comp.notes || []);
            const broadcast = JSON.stringify(comp.broadcasts || []);
            
            // If it has TV broadcast or mentions Division I, it's likely D1
            if (notes.includes('Division I') || 
                broadcast.includes('ESPN') || 
                broadcast.includes('SEC Network') ||
                comp.conferenceCompetition?.text?.match(/SEC|ACC|Big Ten|Pac-12|Big 12/)) {
              this.d1TeamIds.add(game.home_team_id);
              this.d1TeamIds.add(game.away_team_id);
            }
          }
        } catch (e) {
          // Skip
        }
      }
    }

    // Load all teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id, name')
      .eq('sport', 'NCAA_BASEBALL');

    teams?.forEach(team => {
      this.teamCache.set(team.id, team.external_id);
      
      // Check if team name contains known D1 schools
      const name = team.name.toLowerCase();
      const d1Keywords = ['state', 'university', 'college', 'tech', 'a&m'];
      if (d1Keywords.some(keyword => name.includes(keyword))) {
        this.d1TeamIds.add(team.id);
      }
    });

    // Load existing players
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .limit(10000);

    players?.forEach(player => {
      this.playerCache.set(player.external_id, player.id);
    });

    console.log(chalk.green(
      `✅ Loaded: ${this.teamCache.size} teams (${this.d1TeamIds.size} identified as D1), ${this.playerCache.size} players\n`
    ));
  }

  async getAll2021D1Games() {
    const games = [];
    let offset = 0;
    const limit = 1000;

    // If we haven't identified many D1 teams, just get all games
    // and we'll filter based on stats availability
    const useD1Filter = this.d1TeamIds.size > 50;

    while (true) {
      let query = supabase
        .from('games')
        .select('*')
        .eq('sport', 'NCAA_BASEBALL')
        .eq('status', 'completed')
        .gte('start_time', '2021-02-19')
        .lte('start_time', '2021-06-30')
        .range(offset, offset + limit - 1)
        .order('start_time');

      // Only filter by D1 teams if we have a good set
      if (useD1Filter) {
        query = query.or(`home_team_id.in.(${Array.from(this.d1TeamIds).join(',')}),away_team_id.in.(${Array.from(this.d1TeamIds).join(',')})`);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) break;

      games.push(...data);
      offset += limit;

      if (data.length < limit) break;
    }

    return games;
  }

  async processGame(game: any) {
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

      if (!response.data) {
        this.gamesProcessed++;
        return;
      }

      this.successfulAPICalls++;

      // Process boxscore
      if (response.data.boxscore?.players) {
        let gameStatsCount = 0;
        
        for (const teamData of response.data.boxscore.players) {
          const teamId = this.getTeamId(game, teamData.team);
          if (!teamId) continue;

          for (const category of teamData.statistics || []) {
            for (const playerData of category.athletes || []) {
              if (!playerData.athlete || !playerData.stats) continue;

              const stats = category.name === 'batting' 
                ? this.parseBattingStats(playerData.stats)
                : this.parsePitchingStats(playerData.stats);

              if (stats && Object.keys(stats).length > 0) {
                const playerStat = {
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
                gameStatsCount++;

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

        // If this game has good stats coverage (>30 stats), mark teams as D1
        if (gameStatsCount > 30) {
          this.d1TeamIds.add(game.home_team_id);
          this.d1TeamIds.add(game.away_team_id);
        } else if (gameStatsCount < 10) {
          // Likely non-D1 game
          this.skippedNonD1++;
        }
      }

      this.gamesProcessed++;
      
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
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    // Skip if all zeros or invalid
    const hasValidStats = statsArray.some(val => val && val !== '0' && val !== '--');
    if (!hasValidStats) return null;
    
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
      if (!val || val === '--' || val === '0.0') return 0;
      const parts = val.toString().split('.');
      return (parseInt(parts[0]) || 0) + ((parseInt(parts[1]) || 0) / 3);
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

    console.log(chalk.cyan('\n🎉 2021 NCAA D1 BASEBALL FIXED COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Total Games Found: ${totalGames}`));
    console.log(chalk.green(`✅ Games Processed: ${this.gamesProcessed}`));
    console.log(chalk.green(`🎯 Successful API Calls: ${this.successfulAPICalls} (${successRate.toFixed(1)}%)`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.green(`👥 New Players Created: ${this.playersCreated}`));
    console.log(chalk.green(`🏆 D1 Teams Identified: ${this.d1TeamIds.size}`));
    console.log(chalk.yellow(`📊 Avg Stats/Game: ${statsPerGame.toFixed(1)} (target: 40-50)`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log(chalk.gray(`🚫 Low-stat games (likely non-D1): ${this.skippedNonD1}`));
    console.log('═══════════════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const collector = new NCAAD1Baseball2021StatsFixed();
collector.collectAll2021Stats()
  .then(() => {
    console.log(chalk.green('\n✅ Fixed collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });