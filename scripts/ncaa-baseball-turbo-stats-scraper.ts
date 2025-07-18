import { createClient } from '@supabase/supabase-js';
import { chromium, Browser, Page } from 'playwright';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE CONFIGURATION
const BROWSER_INSTANCES = 12; // One per CPU thread
const CONCURRENT_PAGES = 24;  // 2 pages per browser
const BATCH_SIZE = 100;       // Games per batch
const MAX_RETRIES = 3;

// Rate limiting to avoid detection
const pageLimit = pLimit(CONCURRENT_PAGES);
const dbLimit = pLimit(6);

interface PlayerStat {
  player_external_id: string;
  player_name: string;
  team_id: number;
  game_id: number;
  stat_type: 'batting' | 'pitching';
  stats: any;
  fantasy_points?: number;
}

class NCAABaseballTurboStatsScraper {
  private browsers: Browser[] = [];
  private startTime = Date.now();
  private gamesProcessed = 0;
  private statsCollected = 0;
  private errors = 0;
  
  // Caches
  private playerCache = new Map<string, number>();
  private teamCache = new Map<string, number>();
  
  // Buffers
  private statsBuffer: PlayerStat[] = [];

  async scrapeAllStats() {
    console.log(chalk.cyan('🚀 NCAA Baseball Turbo Stats Scraper'));
    console.log(chalk.yellow(`💪 Launching ${BROWSER_INSTANCES} browser instances`));
    console.log(chalk.yellow(`🔥 ${CONCURRENT_PAGES} concurrent page scrapers`));
    console.log(chalk.yellow('💾 32GB RAM for maximum caching\n'));

    // Pre-load caches
    await this.loadCaches();

    // Launch browsers
    await this.launchBrowsers();

    // Get all games that need stats
    const games = await this.getGamesNeedingStats();
    console.log(chalk.blue(`📊 Found ${games.length} games to scrape\n`));

    // Process in batches
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      await this.processBatch(batch);
      
      // Progress update
      const elapsed = (Date.now() - this.startTime) / 1000;
      const gamesPerSec = this.gamesProcessed / elapsed;
      const eta = (games.length - this.gamesProcessed) / gamesPerSec;
      
      console.log(chalk.gray(
        `Progress: ${this.gamesProcessed}/${games.length} games | ` +
        `${this.statsCollected} stats | ${gamesPerSec.toFixed(1)} games/sec | ` +
        `ETA: ${Math.ceil(eta / 60)} min`
      ));
    }

    // Final flush
    await this.flushStatsBuffer();

    // Cleanup
    await this.closeBrowsers();

    this.printFinalStats();
  }

  async launchBrowsers() {
    const launchPromises = [];
    
    for (let i = 0; i < BROWSER_INSTANCES; i++) {
      launchPromises.push(
        chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            `--max-old-space-size=${Math.floor(32768 / BROWSER_INSTANCES)}` // Divide RAM
          ]
        })
      );
    }

    this.browsers = await Promise.all(launchPromises);
    console.log(chalk.green(`✅ Launched ${BROWSER_INSTANCES} browsers\n`));
  }

  async closeBrowsers() {
    await Promise.all(this.browsers.map(browser => browser.close()));
  }

  async getGamesNeedingStats(): Promise<any[]> {
    // Get games that don't have stats yet
    const { data: games } = await supabase
      .from('games')
      .select(`
        id,
        external_id,
        home_team_id,
        away_team_id,
        start_time
      `)
      .eq('sport', 'NCAA_BASEBALL')
      .eq('status', 'completed')
      .order('start_time', { ascending: false });

    if (!games) return [];

    // Filter out games that already have stats
    const gamesWithStats = new Set();
    const { data: existingStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', games.map(g => g.id));

    existingStats?.forEach(stat => gamesWithStats.add(stat.game_id));

    return games.filter(game => !gamesWithStats.has(game.id));
  }

  async processBatch(games: any[]) {
    const scrapePromises = games.map((game, index) => 
      pageLimit(async () => {
        const browserIndex = index % BROWSER_INSTANCES;
        const browser = this.browsers[browserIndex];
        return this.scrapeGame(browser, game);
      })
    );

    await Promise.all(scrapePromises);

    // Flush buffer after each batch
    if (this.statsBuffer.length > 0) {
      await this.flushStatsBuffer();
    }
  }

  async scrapeGame(browser: Browser, game: any, retries = 0): Promise<void> {
    const page = await browser.newPage();
    
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://www.espn.com/college-baseball/boxscore/_/gameId/${gameId}`;

      // Navigate with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait for box score to load
      await page.waitForSelector('.Table__TD', { timeout: 10000 });

      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract batting stats
      const battingStats = this.extractBattingStats($, game);
      this.statsBuffer.push(...battingStats);

      // Extract pitching stats
      const pitchingStats = this.extractPitchingStats($, game);
      this.statsBuffer.push(...pitchingStats);

      this.gamesProcessed++;
      this.statsCollected += battingStats.length + pitchingStats.length;

    } catch (error) {
      this.errors++;
      
      if (retries < MAX_RETRIES) {
        await page.close();
        await this.delay(1000 * (retries + 1)); // Exponential backoff
        return this.scrapeGame(browser, game, retries + 1);
      }
      
      console.error(chalk.red(`Failed to scrape game ${game.external_id}: ${error}`));
    } finally {
      await page.close();
    }
  }

  extractBattingStats($: cheerio.CheerioAPI, game: any): PlayerStat[] {
    const stats: PlayerStat[] = [];
    
    // Find batting tables (one for each team)
    $('.Boxscore__Category:contains("Batting")').each((_, category) => {
      const $category = $(category);
      const teamName = $category.find('.TeamName').text().trim();
      
      // Determine team ID based on name matching
      const isHomeTeam = $category.closest('.Boxscore__Team--home').length > 0;
      const teamId = isHomeTeam ? game.home_team_id : game.away_team_id;

      // Extract player rows
      $category.find('tbody tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length < 10) return; // Skip summary rows

        const playerName = $(cells[0]).text().trim();
        if (!playerName || playerName === 'TOTALS') return;

        // Extract stats (typical order: AB, R, H, RBI, BB, SO, AVG)
        const ab = parseInt($(cells[1]).text()) || 0;
        const r = parseInt($(cells[2]).text()) || 0;
        const h = parseInt($(cells[3]).text()) || 0;
        const rbi = parseInt($(cells[4]).text()) || 0;
        const bb = parseInt($(cells[5]).text()) || 0;
        const so = parseInt($(cells[6]).text()) || 0;
        const avg = parseFloat($(cells[7]).text()) || 0;

        const playerStats = {
          ab, r, h, rbi, bb, so, avg,
          // Additional stats if available
          doubles: parseInt($(cells[8]).text()) || 0,
          triples: parseInt($(cells[9]).text()) || 0,
          hr: parseInt($(cells[10]).text()) || 0,
          sb: parseInt($(cells[11]).text()) || 0
        };

        stats.push({
          player_external_id: this.generatePlayerExternalId(playerName, teamId),
          player_name: playerName,
          team_id: teamId,
          game_id: game.id,
          stat_type: 'batting',
          stats: playerStats,
          fantasy_points: this.calculateBattingFantasyPoints(playerStats)
        });
      });
    });

    return stats;
  }

  extractPitchingStats($: cheerio.CheerioAPI, game: any): PlayerStat[] {
    const stats: PlayerStat[] = [];
    
    // Find pitching tables
    $('.Boxscore__Category:contains("Pitching")').each((_, category) => {
      const $category = $(category);
      
      const isHomeTeam = $category.closest('.Boxscore__Team--home').length > 0;
      const teamId = isHomeTeam ? game.home_team_id : game.away_team_id;

      // Extract pitcher rows
      $category.find('tbody tr').each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length < 8) return;

        const playerName = $(cells[0]).text().trim();
        if (!playerName || playerName === 'TOTALS') return;

        // Extract stats (typical order: IP, H, R, ER, BB, SO, ERA)
        const ipText = $(cells[1]).text();
        const ip = this.parseInningsPitched(ipText);
        const h = parseInt($(cells[2]).text()) || 0;
        const r = parseInt($(cells[3]).text()) || 0;
        const er = parseInt($(cells[4]).text()) || 0;
        const bb = parseInt($(cells[5]).text()) || 0;
        const so = parseInt($(cells[6]).text()) || 0;
        const era = parseFloat($(cells[7]).text()) || 0;

        const pitcherStats = {
          ip, h, r, er, bb, so, era,
          // Decision if available
          win: $row.text().includes('(W)') ? 1 : 0,
          loss: $row.text().includes('(L)') ? 1 : 0,
          save: $row.text().includes('(S)') ? 1 : 0
        };

        stats.push({
          player_external_id: this.generatePlayerExternalId(playerName, teamId),
          player_name: playerName,
          team_id: teamId,
          game_id: game.id,
          stat_type: 'pitching',
          stats: pitcherStats,
          fantasy_points: this.calculatePitchingFantasyPoints(pitcherStats)
        });
      });
    });

    return stats;
  }

  parseInningsPitched(ipText: string): number {
    const parts = ipText.split('.');
    const fullInnings = parseInt(parts[0]) || 0;
    const partialInnings = parseInt(parts[1]) || 0;
    return fullInnings + (partialInnings / 3);
  }

  generatePlayerExternalId(playerName: string, teamId: number): string {
    // Generate consistent ID based on name and team
    const normalized = playerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `espn_ncaa_baseball_${teamId}_${normalized}`;
  }

  calculateBattingFantasyPoints(stats: any): number {
    return (
      (stats.h * 1) +
      (stats.r * 1) +
      (stats.rbi * 1) +
      (stats.bb * 1) +
      (stats.sb * 2) +
      (stats.doubles * 1) +
      (stats.triples * 2) +
      (stats.hr * 4) -
      (stats.so * 0.5)
    );
  }

  calculatePitchingFantasyPoints(stats: any): number {
    return (
      (stats.ip * 3) +
      (stats.so * 1) +
      (stats.win * 5) +
      (stats.save * 5) -
      (stats.er * 1) -
      (stats.bb * 0.5) -
      (stats.h * 0.5) -
      (stats.loss * 2)
    );
  }

  async loadCaches() {
    // Load team cache
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    teams?.forEach(team => {
      this.teamCache.set(team.external_id, team.id);
    });

    // Load existing players
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    players?.forEach(player => {
      this.playerCache.set(player.external_id, player.id);
    });

    console.log(chalk.green(`✅ Loaded caches: ${this.teamCache.size} teams, ${this.playerCache.size} players\n`));
  }

  async flushStatsBuffer() {
    if (this.statsBuffer.length === 0) return;

    const stats = [...this.statsBuffer];
    this.statsBuffer = [];

    // First, ensure all players exist
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

    // Now insert stats
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

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSec = this.gamesProcessed / elapsed;

    console.log(chalk.cyan('\n🎉 SCRAPING COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Games Processed: ${this.gamesProcessed}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected}`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log(chalk.red(`❌ Errors: ${this.errors}`));
    console.log(chalk.gray(`💻 Browsers Used: ${BROWSER_INSTANCES}`));
    console.log(chalk.gray(`🔥 Concurrent Pages: ${CONCURRENT_PAGES}`));
    console.log('═══════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const scraper = new NCAABaseballTurboStatsScraper();
scraper.scrapeAllStats()
  .then(() => {
    console.log(chalk.green('\n✅ Stats scraping complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });