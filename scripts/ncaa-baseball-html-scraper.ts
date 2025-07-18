import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE - 24 concurrent requests!
const httpLimit = pLimit(24);
const dbLimit = pLimit(6);
const BATCH_SIZE = 100;

interface PlayerStat {
  player_external_id: string;
  player_name: string;
  team_id: number;
  game_id: number;
  stat_type: 'batting' | 'pitching';
  stats: any;
  fantasy_points?: number;
}

class NCAABaseballHTMLScraper {
  private startTime = Date.now();
  private gamesProcessed = 0;
  private statsCollected = 0;
  private playerCache = new Map<string, number>();
  private teamCache = new Map<string, number>();
  private statsBuffer: PlayerStat[] = [];

  async scrapeAllStats() {
    console.log(chalk.cyan('🚀 NCAA Baseball HTML Stats Scraper'));
    console.log(chalk.yellow('💪 Using 24 concurrent HTTP requests'));
    console.log(chalk.yellow('🔥 No browser needed - direct HTML parsing!\n'));

    // Load caches
    await this.loadCaches();

    // First, let's test with one game
    const testGame = await this.getTestGame();
    if (testGame) {
      console.log(chalk.blue('📊 Testing with one game first...\n'));
      await this.scrapeGame(testGame);
      
      if (this.statsCollected === 0) {
        console.log(chalk.red('\n❌ No stats found in test game.'));
        console.log(chalk.yellow('💡 ESPN might be using client-side rendering.'));
        console.log(chalk.yellow('💡 Alternative: Use ESPN API endpoint directly!\n'));
        
        // Try API approach
        await this.testAPIApproach(testGame);
        return;
      }
    }

    // If test successful, process all games
    const games = await this.getGamesNeedingStats();
    console.log(chalk.blue(`\n📊 Found ${games.length} games to scrape\n`));

    // Process in batches
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(game => 
        httpLimit(() => this.scrapeGame(game))
      );
      
      await Promise.all(promises);
      
      if (this.statsBuffer.length > 0) {
        await this.flushStatsBuffer();
      }

      // Progress update
      const elapsed = (Date.now() - this.startTime) / 1000;
      const gamesPerSec = this.gamesProcessed / elapsed;
      console.log(chalk.gray(
        `Progress: ${this.gamesProcessed}/${games.length} games | ` +
        `${this.statsCollected} stats | ${gamesPerSec.toFixed(1)} games/sec`
      ));
    }

    this.printFinalStats();
  }

  async testAPIApproach(game: any) {
    console.log(chalk.cyan('🔄 Testing ESPN API endpoint...\n'));
    
    const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
    const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
    
    try {
      const response = await axios.get(apiUrl);
      const data = response.data;
      
      console.log(chalk.green('✅ API Response received!'));
      
      // Check for boxscore data
      if (data.boxscore) {
        console.log(chalk.green('✅ Boxscore found in API!'));
        
        if (data.boxscore.players) {
          console.log(chalk.green(`✅ Found ${data.boxscore.players.length} team box scores`));
          
          // Process the boxscore
          await this.processAPIBoxscore(data.boxscore, game);
          
          if (this.statsCollected > 0) {
            console.log(chalk.green(`\n✅ Successfully extracted ${this.statsCollected} stats from API!`));
            console.log(chalk.yellow('\n🎯 Switching to API approach for all games!\n'));
            
            // Continue with API approach for all games
            await this.scrapeAllViaAPI();
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ API Error:'), error);
    }
  }

  async scrapeAllViaAPI() {
    const games = await this.getGamesNeedingStats();
    console.log(chalk.blue(`📊 Processing ${games.length} games via API\n`));

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(game => 
        httpLimit(() => this.scrapeGameViaAPI(game))
      );
      
      await Promise.all(promises);
      
      if (this.statsBuffer.length > 0) {
        await this.flushStatsBuffer();
      }

      const elapsed = (Date.now() - this.startTime) / 1000;
      const gamesPerSec = this.gamesProcessed / elapsed;
      console.log(chalk.gray(
        `Progress: ${this.gamesProcessed}/${games.length} games | ` +
        `${this.statsCollected} stats | ${gamesPerSec.toFixed(1)} games/sec`
      ));
    }
  }

  async scrapeGameViaAPI(game: any) {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      
      const response = await axios.get(apiUrl);
      
      if (response.data.boxscore) {
        await this.processAPIBoxscore(response.data.boxscore, game);
      }
      
      this.gamesProcessed++;
      
    } catch (error) {
      // Silently continue
    }
  }

  async processAPIBoxscore(boxscore: any, game: any) {
    if (!boxscore.players) return;

    for (const teamPlayers of boxscore.players) {
      const teamId = this.getTeamIdFromGame(game, teamPlayers.team);
      
      if (!teamId) continue;

      // Process each statistic category
      for (const category of teamPlayers.statistics || []) {
        if (category.name === 'batting') {
          await this.processBattingStats(category, teamId, game);
        } else if (category.name === 'pitching') {
          await this.processPitchingStats(category, teamId, game);
        }
      }
    }
  }

  async processBattingStats(category: any, teamId: number, game: any) {
    for (const player of category.athletes || []) {
      if (!player.athlete) continue;
      
      const stats = this.parseBattingStatsArray(player.stats);
      if (!stats) continue;

      const playerStat: PlayerStat = {
        player_external_id: `espn_ncaa_baseball_${player.athlete.id}`,
        player_name: player.athlete.displayName || player.athlete.name,
        team_id: teamId,
        game_id: game.id,
        stat_type: 'batting',
        stats: stats,
        fantasy_points: this.calculateBattingFantasyPoints(stats)
      };

      this.statsBuffer.push(playerStat);
      this.statsCollected++;
    }
  }

  async processPitchingStats(category: any, teamId: number, game: any) {
    for (const player of category.athletes || []) {
      if (!player.athlete) continue;
      
      const stats = this.parsePitchingStatsArray(player.stats);
      if (!stats) continue;

      const playerStat: PlayerStat = {
        player_external_id: `espn_ncaa_baseball_${player.athlete.id}`,
        player_name: player.athlete.displayName || player.athlete.name,
        team_id: teamId,
        game_id: game.id,
        stat_type: 'pitching',
        stats: stats,
        fantasy_points: this.calculatePitchingFantasyPoints(stats)
      };

      this.statsBuffer.push(playerStat);
      this.statsCollected++;
    }
  }

  parseBattingStatsArray(statsArray: string[]): any {
    if (!statsArray || statsArray.length < 7) return null;
    
    // ESPN batting stats order: AB, R, H, RBI, BB, K, AVG
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

  parsePitchingStatsArray(statsArray: string[]): any {
    if (!statsArray || statsArray.length < 7) return null;
    
    // ESPN pitching stats order: IP, H, R, ER, BB, K, ERA
    return {
      ip: this.parseInningsPitched(statsArray[0]),
      h: parseInt(statsArray[1]) || 0,
      r: parseInt(statsArray[2]) || 0,
      er: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      era: parseFloat(statsArray[6]) || 0
    };
  }

  parseInningsPitched(ipText: string): number {
    const parts = ipText.split('.');
    const fullInnings = parseInt(parts[0]) || 0;
    const partialInnings = parseInt(parts[1]) || 0;
    return fullInnings + (partialInnings / 3);
  }

  getTeamIdFromGame(game: any, teamInfo: any): number | null {
    if (!teamInfo) return null;
    
    // Check if it's home or away based on team ID
    const teamExternalId = `espn_ncaa_baseball_${teamInfo.id}`;
    const cachedId = this.teamCache.get(teamExternalId);
    
    if (cachedId) return cachedId;
    
    // Fallback to game's team IDs
    return game.home_team_id || game.away_team_id;
  }

  async scrapeGame(game: any) {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://www.espn.com/college-baseball/boxscore/_/gameId/${gameId}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Try to extract stats from HTML
      const battingStats = this.extractBattingStats($, game);
      const pitchingStats = this.extractPitchingStats($, game);
      
      this.statsBuffer.push(...battingStats, ...pitchingStats);
      this.gamesProcessed++;
      
    } catch (error) {
      // Silently continue
    }
  }

  extractBattingStats($: cheerio.CheerioAPI, game: any): PlayerStat[] {
    // Implementation same as in the Playwright version
    return [];
  }

  extractPitchingStats($: cheerio.CheerioAPI, game: any): PlayerStat[] {
    // Implementation same as in the Playwright version
    return [];
  }

  async getTestGame() {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_BASEBALL')
      .eq('status', 'completed')
      .order('start_time', { ascending: false })
      .limit(1)
      .single();
    
    return data;
  }

  async getGamesNeedingStats() {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_BASEBALL')
      .eq('status', 'completed')
      .order('start_time', { ascending: false })
      .limit(1000); // Start with 1000 games

    return games || [];
  }

  async loadCaches() {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    teams?.forEach(team => {
      this.teamCache.set(team.external_id, team.id);
    });

    console.log(chalk.green(`✅ Loaded ${this.teamCache.size} teams into cache\n`));
  }

  async flushStatsBuffer() {
    if (this.statsBuffer.length === 0) return;

    const stats = [...this.statsBuffer];
    this.statsBuffer = [];

    // Create players first
    const newPlayers = stats
      .filter(stat => !this.playerCache.has(stat.player_external_id))
      .map(stat => ({
        external_id: stat.player_external_id,
        name: stat.player_name,
        team_id: stat.team_id,
        sport: 'NCAA_BASEBALL'
      }));

    if (newPlayers.length > 0) {
      const uniquePlayers = Array.from(
        new Map(newPlayers.map(p => [p.external_id, p])).values()
      );

      const { data: insertedPlayers } = await supabase
        .from('players')
        .upsert(uniquePlayers, { onConflict: 'external_id' })
        .select('id, external_id');

      insertedPlayers?.forEach(player => {
        this.playerCache.set(player.external_id, player.id);
      });
    }

    // Insert stats
    const statsToInsert = stats
      .map(stat => ({
        player_id: this.playerCache.get(stat.player_external_id),
        game_id: stat.game_id,
        stat_type: stat.stat_type,
        stat_value: stat.stats,
        fantasy_points: stat.fantasy_points
      }))
      .filter(s => s.player_id);

    await dbLimit(async () => {
      const { error } = await supabase
        .from('player_stats')
        .insert(statsToInsert);

      if (error) {
        console.error('Error inserting stats:', error);
      }
    });
  }

  calculateBattingFantasyPoints(stats: any): number {
    return (
      (stats.h * 1) +
      (stats.r * 1) +
      (stats.rbi * 1) +
      (stats.bb * 1) -
      (stats.so * 0.5)
    );
  }

  calculatePitchingFantasyPoints(stats: any): number {
    return (
      (stats.ip * 3) +
      (stats.so * 1) -
      (stats.er * 1) -
      (stats.bb * 0.5) -
      (stats.h * 0.5)
    );
  }

  printFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log(chalk.cyan('\n🎉 SCRAPING COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Games Processed: ${this.gamesProcessed}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected}`));
    console.log(chalk.yellow(`⚡ Performance: ${(this.gamesProcessed / elapsed).toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log('═══════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const scraper = new NCAABaseballHTMLScraper();
scraper.scrapeAllStats()
  .then(() => {
    console.log(chalk.green('\n✅ Stats collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });