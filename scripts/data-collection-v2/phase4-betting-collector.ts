#!/usr/bin/env tsx
/**
 * 🎰 PHASE 4: BETTING DATA COLLECTOR - ULTRA FAST
 * 
 * Collects betting lines and player props from multiple sources:
 * - ESPN betting API
 * - The Odds API (free tier: 500 requests/month)
 * - Action Network scraping (MCP Playwright)
 * - DraftKings/FanDuel APIs (unofficial)
 * 
 * Strategy:
 * 1. Use ESPN API for basic lines (free, fast)
 * 2. Use The Odds API for comprehensive odds
 * 3. Scrape Action Network for missing data
 * 4. Store with timestamps for historical tracking
 */

import { pgPool } from '../fantasy-ml/config/database';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from './phase2-parallel-engine';

// API Configuration
const ODDS_API_KEY = process.env.ODDS_API_KEY || 'YOUR_KEY_HERE';
const ESPN_CONCURRENCY = 100;
const ODDS_API_CONCURRENCY = 10; // Rate limited
const DB_BATCH_SIZE = 1000;

interface BettingLine {
  game_id: number;
  book: string;
  line_type: 'opening' | 'current' | 'closing';
  timestamp: Date;
  spread_home?: number;
  spread_away?: number;
  spread_home_odds?: number;
  spread_away_odds?: number;
  total?: number;
  over_odds?: number;
  under_odds?: number;
  ml_home?: number;
  ml_away?: number;
}

interface PlayerProp {
  game_id: number;
  player_id: number;
  book: string;
  prop_type: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  timestamp: Date;
}

export class BettingDataCollector {
  private engine: ParallelCollectionEngine;
  private espnLimit = pLimit(ESPN_CONCURRENCY);
  private oddsLimit = pLimit(ODDS_API_CONCURRENCY);
  private gameCache = new Map<string, number>();
  private playerCache = new Map<string, number>();
  private totalLines = 0;
  private totalProps = 0;
  private startTime = Date.now();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n🎰 PHASE 4: BETTING DATA COLLECTOR\n'));
    console.log(chalk.yellow('📊 Target: Betting lines for all 110K+ games'));
    console.log(chalk.yellow('🎯 Sources: ESPN, The Odds API, Action Network'));
    console.log(chalk.yellow('⚡ Strategy: Parallel collection with smart caching\n'));
  }
  
  async collect() {
    try {
      // Cache games and players
      await this.cacheGamesAndPlayers();
      
      // Collect from each source
      await this.collectESPNBetting();
      await this.collectOddsAPI();
      await this.collectActionNetwork();
      
      // Show summary
      await this.showSummary();
      
      const totalTime = (Date.now() - this.startTime) / 1000;
      console.log(chalk.green.bold(`\n✅ BETTING COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Lines: ${this.totalLines.toLocaleString()}`));
      console.log(chalk.yellow(`🎯 Props: ${this.totalProps.toLocaleString()}\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Betting collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  /**
   * Cache all games and players for fast lookups
   */
  private async cacheGamesAndPlayers() {
    console.log(chalk.cyan('📦 Caching games and players...'));
    
    // Cache games
    const games = await pgPool.query(`
      SELECT id, our_game_id, espn_game_id, sport, game_date
      FROM games_master
      WHERE status = 'STATUS_FINAL'
    `);
    
    games.rows.forEach(game => {
      if (game.espn_game_id) {
        this.gameCache.set(`espn_${game.espn_game_id}`, game.id);
      }
      this.gameCache.set(game.our_game_id, game.id);
    });
    
    // Cache players
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, dk_id, fd_id
      FROM players_master
    `);
    
    players.rows.forEach(player => {
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.espn_id}`, player.id);
      }
      if (player.dk_id) {
        this.playerCache.set(`dk_${player.dk_id}`, player.id);
      }
      if (player.fd_id) {
        this.playerCache.set(`fd_${player.fd_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${games.rows.length} games and ${players.rows.length} players\n`));
  }
  
  /**
   * PHASE 1: Collect from ESPN (free, comprehensive)
   */
  private async collectESPNBetting() {
    console.log(chalk.yellow.bold('📺 PHASE 1: ESPN BETTING LINES...\n'));
    
    // Get games with ESPN IDs
    const games = await pgPool.query(`
      SELECT DISTINCT g.id, g.espn_game_id, g.sport, g.game_date
      FROM games_master g
      WHERE g.espn_game_id IS NOT NULL
      AND g.status = 'STATUS_FINAL'
      AND NOT EXISTS (
        SELECT 1 FROM betting_lines bl 
        WHERE bl.game_id = g.id 
        AND bl.book = 'ESPN'
      )
      ORDER BY g.game_date DESC
      LIMIT 10000
    `);
    
    console.log(chalk.cyan(`Found ${games.rows.length} games needing ESPN betting data`));
    
    const allLines: BettingLine[] = [];
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < games.rows.length; i += BATCH_SIZE) {
      const batch = games.rows.slice(i, i + BATCH_SIZE);
      const batchLines = await this.processESPNBatch(batch);
      allLines.push(...batchLines);
      
      if (allLines.length >= DB_BATCH_SIZE) {
        await this.insertBettingLines(allLines.splice(0, DB_BATCH_SIZE));
      }
      
      if (i % 1000 === 0) {
        this.showProgress('ESPN', i, games.rows.length);
      }
    }
    
    // Insert remaining
    if (allLines.length > 0) {
      await this.insertBettingLines(allLines);
    }
    
    console.log(chalk.green(`✅ ESPN collection complete: ${this.totalLines} lines\n`));
  }
  
  /**
   * Process ESPN batch
   */
  private async processESPNBatch(games: any[]): Promise<BettingLine[]> {
    const promises = games.map(game => 
      this.espnLimit(() => this.fetchESPNOdds(game))
    );
    
    const results = await Promise.all(promises);
    return results.flat();
  }
  
  /**
   * Fetch odds from ESPN API
   */
  private async fetchESPNOdds(game: any): Promise<BettingLine[]> {
    const lines: BettingLine[] = [];
    
    try {
      const sportMap = {
        'NFL': 'football/nfl',
        'NBA': 'basketball/nba',
        'MLB': 'baseball/mlb',
        'NHL': 'hockey/nhl',
        'NCAAF': 'football/college-football',
        'NCAAB': 'basketball/mens-college-basketball'
      };
      
      const sportPath = sportMap[game.sport];
      if (!sportPath) return lines;
      
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data.pickcenter) {
        const odds = response.data.pickcenter;
        
        // Current lines
        if (odds.details) {
          lines.push({
            game_id: game.id,
            book: 'ESPN',
            line_type: 'current',
            timestamp: new Date(),
            spread_home: odds.details.spread ? -parseFloat(odds.details.spread) : undefined,
            spread_away: odds.details.spread ? parseFloat(odds.details.spread) : undefined,
            spread_home_odds: -110,
            spread_away_odds: -110,
            total: odds.details.overUnder ? parseFloat(odds.details.overUnder) : undefined,
            over_odds: -110,
            under_odds: -110,
            ml_home: odds.awayTeamOdds?.moneyLine ? parseInt(odds.awayTeamOdds.moneyLine) : undefined,
            ml_away: odds.homeTeamOdds?.moneyLine ? parseInt(odds.homeTeamOdds.moneyLine) : undefined
          });
        }
        
        // Opening lines if available
        if (odds.openingLine) {
          lines.push({
            game_id: game.id,
            book: 'ESPN',
            line_type: 'opening',
            timestamp: new Date(game.game_date),
            spread_home: odds.openingLine.spread ? -parseFloat(odds.openingLine.spread) : undefined,
            spread_away: odds.openingLine.spread ? parseFloat(odds.openingLine.spread) : undefined,
            spread_home_odds: -110,
            spread_away_odds: -110,
            total: odds.openingLine.overUnder ? parseFloat(odds.openingLine.overUnder) : undefined,
            over_odds: -110,
            under_odds: -110
          });
        }
      }
      
    } catch (error: any) {
      if (error.response?.status !== 404) {
        // Ignore 404s
      }
    }
    
    return lines;
  }
  
  /**
   * PHASE 2: The Odds API (comprehensive odds from multiple books)
   */
  private async collectOddsAPI() {
    console.log(chalk.yellow.bold('🎲 PHASE 2: THE ODDS API...\n'));
    
    if (ODDS_API_KEY === 'YOUR_KEY_HERE') {
      console.log(chalk.gray('⚠️  Skipping - No API key configured'));
      console.log(chalk.gray('   Get free key at: https://the-odds-api.com\n'));
      return;
    }
    
    // Focus on recent games to maximize API usage
    const recentGames = await pgPool.query(`
      SELECT g.id, g.sport, g.home_team_id, g.away_team_id, g.game_date,
             ht.name as home_team, at.name as away_team
      FROM games_master g
      JOIN teams_master ht ON g.home_team_id = ht.id
      JOIN teams_master at ON g.away_team_id = at.id
      WHERE g.game_date >= NOW() - INTERVAL '30 days'
      AND g.sport IN ('NFL', 'NBA', 'MLB', 'NHL')
      AND NOT EXISTS (
        SELECT 1 FROM betting_lines bl 
        WHERE bl.game_id = g.id 
        AND bl.book != 'ESPN'
      )
      ORDER BY g.game_date DESC
      LIMIT 100
    `);
    
    console.log(chalk.cyan(`Collecting odds for ${recentGames.rows.length} recent games`));
    
    const allLines: BettingLine[] = [];
    
    for (const game of recentGames.rows) {
      const lines = await this.oddsLimit(() => this.fetchOddsAPI(game));
      allLines.push(...lines);
      
      if (allLines.length >= DB_BATCH_SIZE) {
        await this.insertBettingLines(allLines.splice(0, DB_BATCH_SIZE));
      }
    }
    
    // Insert remaining
    if (allLines.length > 0) {
      await this.insertBettingLines(allLines);
    }
    
    console.log(chalk.green(`✅ Odds API collection complete\n`));
  }
  
  /**
   * Fetch from The Odds API
   */
  private async fetchOddsAPI(game: any): Promise<BettingLine[]> {
    const lines: BettingLine[] = [];
    
    try {
      const sportMap = {
        'NFL': 'americanfootball_nfl',
        'NBA': 'basketball_nba',
        'MLB': 'baseball_mlb',
        'NHL': 'icehockey_nhl'
      };
      
      const sport = sportMap[game.sport];
      if (!sport) return lines;
      
      // Try to find odds for this game
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
      const params = {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'spreads,totals,h2h',
        bookmakers: 'draftkings,fanduel,betmgm,caesars,pointsbetus'
      };
      
      const response = await axios.get(url, { params, timeout: 10000 });
      
      // Match game by teams and date
      for (const event of response.data) {
        const eventDate = new Date(event.commence_time);
        const gameDate = new Date(game.game_date);
        
        // Check if dates match (same day)
        if (eventDate.toDateString() === gameDate.toDateString()) {
          // Check if teams match
          const homeMatch = event.home_team.toLowerCase().includes(game.home_team.toLowerCase()) ||
                           game.home_team.toLowerCase().includes(event.home_team.toLowerCase());
          const awayMatch = event.away_team.toLowerCase().includes(game.away_team.toLowerCase()) ||
                           game.away_team.toLowerCase().includes(event.away_team.toLowerCase());
          
          if (homeMatch && awayMatch) {
            // Found matching game
            for (const bookmaker of event.bookmakers) {
              const line: BettingLine = {
                game_id: game.id,
                book: bookmaker.key,
                line_type: 'current',
                timestamp: new Date(bookmaker.last_update)
              };
              
              // Parse markets
              for (const market of bookmaker.markets) {
                if (market.key === 'spreads') {
                  const homeOutcome = market.outcomes.find(o => o.name === event.home_team);
                  const awayOutcome = market.outcomes.find(o => o.name === event.away_team);
                  
                  if (homeOutcome && awayOutcome) {
                    line.spread_home = homeOutcome.point;
                    line.spread_away = awayOutcome.point;
                    line.spread_home_odds = Math.round(homeOutcome.price * 100);
                    line.spread_away_odds = Math.round(awayOutcome.price * 100);
                  }
                } else if (market.key === 'totals') {
                  const overOutcome = market.outcomes.find(o => o.name === 'Over');
                  const underOutcome = market.outcomes.find(o => o.name === 'Under');
                  
                  if (overOutcome && underOutcome) {
                    line.total = overOutcome.point;
                    line.over_odds = Math.round(overOutcome.price * 100);
                    line.under_odds = Math.round(underOutcome.price * 100);
                  }
                } else if (market.key === 'h2h') {
                  const homeOutcome = market.outcomes.find(o => o.name === event.home_team);
                  const awayOutcome = market.outcomes.find(o => o.name === event.away_team);
                  
                  if (homeOutcome && awayOutcome) {
                    line.ml_home = Math.round(homeOutcome.price * 100);
                    line.ml_away = Math.round(awayOutcome.price * 100);
                  }
                }
              }
              
              lines.push(line);
            }
            
            break; // Found the game
          }
        }
      }
      
      // Check remaining API requests
      const remaining = response.headers['x-requests-remaining'];
      if (remaining) {
        console.log(chalk.gray(`  Odds API requests remaining: ${remaining}`));
      }
      
    } catch (error: any) {
      console.log(chalk.red(`  Odds API error: ${error.message}`));
    }
    
    return lines;
  }
  
  /**
   * PHASE 3: Action Network scraping (requires MCP Playwright)
   */
  private async collectActionNetwork() {
    console.log(chalk.yellow.bold('🌐 PHASE 3: ACTION NETWORK SCRAPING...\n'));
    console.log(chalk.gray('⚠️  Requires MCP Playwright server running'));
    console.log(chalk.gray('   This would scrape comprehensive betting data'));
    console.log(chalk.gray('   Including props, live odds, and consensus'));
    console.log(chalk.gray('   Skipping for now - implement with MCP tools\n'));
    
    // TODO: Implement Action Network scraping with MCP Playwright
    // This would collect:
    // - Player props (points, rebounds, assists, etc.)
    // - Live betting lines
    // - Public betting percentages
    // - Sharp money indicators
  }
  
  /**
   * Insert betting lines
   */
  private async insertBettingLines(lines: BettingLine[]) {
    if (lines.length === 0) return;
    
    await this.engine.bulkInsert('betting_lines', lines, {
      conflictTarget: 'id',
      updateColumns: [],
      batchSize: DB_BATCH_SIZE
    });
    
    this.totalLines += lines.length;
    console.log(chalk.gray(`  💾 Inserted ${lines.length} betting lines`));
  }
  
  /**
   * Insert player props
   */
  private async insertPlayerProps(props: PlayerProp[]) {
    if (props.length === 0) return;
    
    await this.engine.bulkInsert('player_props', props, {
      conflictTarget: 'id',
      updateColumns: [],
      batchSize: DB_BATCH_SIZE
    });
    
    this.totalProps += props.length;
    console.log(chalk.gray(`  💾 Inserted ${props.length} player props`));
  }
  
  /**
   * Show progress
   */
  private showProgress(source: string, current: number, total: number) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const percent = (current / total * 100).toFixed(1);
    const rate = current / elapsed;
    const eta = (total - current) / rate;
    
    console.log(chalk.green(
      `  [${source}] Progress: ${current}/${total} (${percent}%) | ` +
      `Rate: ${rate.toFixed(1)}/sec | ETA: ${eta.toFixed(0)}s`
    ));
  }
  
  /**
   * Show summary
   */
  private async showSummary() {
    console.log(chalk.cyan.bold('\n📊 BETTING DATA SUMMARY:\n'));
    
    // Count by book
    const bookResult = await pgPool.query(`
      SELECT book, COUNT(*) as count
      FROM betting_lines
      GROUP BY book
      ORDER BY count DESC
    `);
    
    console.log(chalk.yellow('📚 Lines by Book:'));
    bookResult.rows.forEach(row => {
      console.log(`  ${row.book}: ${parseInt(row.count).toLocaleString()}`);
    });
    
    // Count by sport
    const sportResult = await pgPool.query(`
      SELECT g.sport, COUNT(DISTINCT bl.game_id) as games_with_odds
      FROM betting_lines bl
      JOIN games_master g ON bl.game_id = g.id
      GROUP BY g.sport
      ORDER BY games_with_odds DESC
    `);
    
    console.log(chalk.yellow('\n🏈 Games with Odds by Sport:'));
    sportResult.rows.forEach(row => {
      console.log(`  ${row.sport}: ${parseInt(row.games_with_odds).toLocaleString()} games`);
    });
    
    // Total coverage
    const coverageResult = await pgPool.query(`
      SELECT 
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT bl.game_id) as games_with_odds
      FROM games_master g
      LEFT JOIN betting_lines bl ON g.id = bl.game_id
      WHERE g.status = 'STATUS_FINAL'
    `);
    
    const coverage = coverageResult.rows[0];
    const percent = (parseInt(coverage.games_with_odds) / parseInt(coverage.total_games) * 100).toFixed(1);
    
    console.log(chalk.yellow('\n📈 Overall Coverage:'));
    console.log(`  Total games: ${parseInt(coverage.total_games).toLocaleString()}`);
    console.log(`  Games with odds: ${parseInt(coverage.games_with_odds).toLocaleString()}`);
    console.log(`  Coverage: ${percent}%`);
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new BettingDataCollector();
  collector.collect().catch(console.error);
}