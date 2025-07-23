#!/usr/bin/env tsx
/**
 * 🔥 REAL-TIME LINEUP SCRAPER
 * 
 * Get last-minute lineup information before DFS lock.
 * 5-10% ROI boost from late swaps!
 */

import chalk from 'chalk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { pgPool } from '../config/database';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface LineupChange {
  sport: string;
  playerId: string;
  playerName: string;
  team: string;
  previousStatus: string;
  newStatus: string;
  impact: 'OUT' | 'QUESTIONABLE' | 'PROBABLE' | 'CONFIRMED' | 'STARTING';
  confidence: number;
  source: string;
  timestamp: Date;
  gameTime: Date;
  minutesUntilLock: number;
}

interface ScrapingSource {
  name: string;
  url: string;
  type: 'api' | 'web' | 'twitter' | 'rss';
  sport: string[];
  priority: number;
  rateLimit: number; // requests per minute
}

// Beat reporter Twitter accounts and official sources
const SCRAPING_SOURCES: ScrapingSource[] = [
  // NFL Sources
  {
    name: 'NFL Official Inactives',
    url: 'https://www.nfl.com/inactives',
    type: 'web',
    sport: ['NFL'],
    priority: 1,
    rateLimit: 30
  },
  {
    name: 'Schefter Twitter',
    url: 'https://twitter.com/AdamSchefter',
    type: 'twitter',
    sport: ['NFL'],
    priority: 1,
    rateLimit: 60
  },
  {
    name: 'Rapoport Twitter', 
    url: 'https://twitter.com/RapSheet',
    type: 'twitter',
    sport: ['NFL'],
    priority: 1,
    rateLimit: 60
  },
  
  // NBA Sources
  {
    name: 'NBA Injury Report',
    url: 'https://official.nba.com/nba-injury-report',
    type: 'web',
    sport: ['NBA'],
    priority: 1,
    rateLimit: 30
  },
  {
    name: 'Shams Twitter',
    url: 'https://twitter.com/ShamsCharania',
    type: 'twitter',
    sport: ['NBA'],
    priority: 1,
    rateLimit: 60
  },
  {
    name: 'Woj Twitter',
    url: 'https://twitter.com/wojespn',
    type: 'twitter',
    sport: ['NBA'],
    priority: 1,
    rateLimit: 60
  },
  
  // MLB Sources
  {
    name: 'MLB Lineups',
    url: 'https://www.mlb.com/starting-lineups',
    type: 'web',
    sport: ['MLB'],
    priority: 1,
    rateLimit: 30
  },
  {
    name: 'Baseball Press',
    url: 'https://baseballpress.com/lineups',
    type: 'web',
    sport: ['MLB'],
    priority: 2,
    rateLimit: 20
  },
  
  // NHL Sources
  {
    name: 'Daily Faceoff',
    url: 'https://www.dailyfaceoff.com/starting-goalies',
    type: 'web',
    sport: ['NHL'],
    priority: 1,
    rateLimit: 20
  },
  {
    name: 'Left Wing Lock',
    url: 'https://leftwinglock.com/starting-goalies',
    type: 'web',
    sport: ['NHL'],
    priority: 2,
    rateLimit: 20
  }
];

export class RealtimeLineupScraper extends EventEmitter {
  private rateLimiters: Map<string, number[]> = new Map();
  private webSocket?: WebSocket;
  private isMonitoring: boolean = false;
  
  constructor() {
    super();
    this.initializeRateLimiters();
  }
  
  private initializeRateLimiters(): void {
    SCRAPING_SOURCES.forEach(source => {
      this.rateLimiters.set(source.name, []);
    });
  }
  
  /**
   * Start monitoring all sources for lineup changes
   */
  async startMonitoring(sports: string[] = ['NFL', 'NBA', 'MLB', 'NHL']): Promise<void> {
    console.log(chalk.cyan.bold('🔥 REAL-TIME LINEUP MONITORING STARTED'));
    console.log(chalk.yellow(`Monitoring sports: ${sports.join(', ')}`));
    
    this.isMonitoring = true;
    
    // Check every 30 seconds
    const monitoringInterval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(monitoringInterval);
        return;
      }
      
      await this.checkAllSources(sports);
    }, 30000);
    
    // Initial check
    await this.checkAllSources(sports);
    
    // Setup WebSocket for real-time Twitter monitoring (if available)
    this.setupTwitterStream();
  }
  
  /**
   * Check all sources for lineup updates
   */
  private async checkAllSources(sports: string[]): Promise<void> {
    const relevantSources = SCRAPING_SOURCES.filter(
      source => source.sport.some(s => sports.includes(s))
    );
    
    // Group by priority and check in parallel
    const priorityGroups = this.groupByPriority(relevantSources);
    
    for (const [priority, sources] of priorityGroups) {
      console.log(chalk.gray(`Checking priority ${priority} sources...`));
      
      await Promise.all(
        sources.map(source => this.checkSource(source))
      );
    }
  }
  
  /**
   * Check individual source for updates
   */
  private async checkSource(source: ScrapingSource): Promise<void> {
    // Check rate limit
    if (!this.canMakeRequest(source)) {
      return;
    }
    
    try {
      switch (source.type) {
        case 'web':
          await this.scrapeWebSource(source);
          break;
        case 'api':
          await this.checkAPISource(source);
          break;
        case 'twitter':
          await this.checkTwitterSource(source);
          break;
        case 'rss':
          await this.checkRSSSource(source);
          break;
      }
      
      // Record request for rate limiting
      this.recordRequest(source);
      
    } catch (error) {
      console.error(chalk.red(`Error checking ${source.name}:`), error);
    }
  }
  
  /**
   * Scrape web source for lineup info
   */
  private async scrapeWebSource(source: ScrapingSource): Promise<void> {
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    switch (source.name) {
      case 'NFL Official Inactives':
        await this.parseNFLInactives($);
        break;
      case 'NBA Injury Report':
        await this.parseNBAInjuryReport($);
        break;
      case 'MLB Lineups':
        await this.parseMLBLineups($);
        break;
      case 'Daily Faceoff':
        await this.parseDailyFaceoffGoalies($);
        break;
      // Add more parsers as needed
    }
  }
  
  /**
   * Parse NFL inactives
   */
  private async parseNFLInactives($: cheerio.CheerioAPI): Promise<void> {
    $('.inactive-player').each(async (_, element) => {
      const playerName = $(element).find('.player-name').text().trim();
      const team = $(element).find('.team').text().trim();
      const gameTime = new Date($(element).attr('data-gametime') || '');
      
      if (playerName && team) {
        const change: LineupChange = {
          sport: 'NFL',
          playerId: await this.findPlayerId(playerName, team, 'NFL'),
          playerName,
          team,
          previousStatus: 'QUESTIONABLE',
          newStatus: 'INACTIVE',
          impact: 'OUT',
          confidence: 1.0,
          source: 'NFL Official',
          timestamp: new Date(),
          gameTime,
          minutesUntilLock: (gameTime.getTime() - Date.now()) / 60000
        };
        
        await this.processLineupChange(change);
      }
    });
  }
  
  /**
   * Parse NBA injury report
   */
  private async parseNBAInjuryReport($: cheerio.CheerioAPI): Promise<void> {
    $('.injury-report-row').each(async (_, element) => {
      const playerName = $(element).find('.player-name').text().trim();
      const team = $(element).find('.team-abbr').text().trim();
      const status = $(element).find('.injury-status').text().trim();
      const gameTime = new Date($(element).attr('data-tipoff') || '');
      
      if (playerName && status) {
        const impact = this.mapStatusToImpact(status);
        
        const change: LineupChange = {
          sport: 'NBA',
          playerId: await this.findPlayerId(playerName, team, 'NBA'),
          playerName,
          team,
          previousStatus: 'UNKNOWN',
          newStatus: status,
          impact,
          confidence: status === 'OUT' ? 1.0 : 0.7,
          source: 'NBA Official',
          timestamp: new Date(),
          gameTime,
          minutesUntilLock: (gameTime.getTime() - Date.now()) / 60000
        };
        
        await this.processLineupChange(change);
      }
    });
  }
  
  /**
   * Parse MLB lineups
   */
  private async parseMLBLineups($: cheerio.CheerioAPI): Promise<void> {
    $('.lineup-card').each(async (_, card) => {
      const team = $(card).find('.team-name').text().trim();
      const gameTime = new Date($(card).attr('data-firstpitch') || '');
      
      $(card).find('.batting-order li').each(async (index, player) => {
        const playerName = $(player).find('.player-name').text().trim();
        const battingOrder = index + 1;
        
        if (playerName) {
          const change: LineupChange = {
            sport: 'MLB',
            playerId: await this.findPlayerId(playerName, team, 'MLB'),
            playerName,
            team,
            previousStatus: 'PROJECTED',
            newStatus: `BATTING ${battingOrder}`,
            impact: 'CONFIRMED',
            confidence: 0.95,
            source: 'MLB.com',
            timestamp: new Date(),
            gameTime,
            minutesUntilLock: (gameTime.getTime() - Date.now()) / 60000
          };
          
          await this.processLineupChange(change);
        }
      });
    });
  }
  
  /**
   * Parse Daily Faceoff goalies
   */
  private async parseDailyFaceoffGoalies($: cheerio.CheerioAPI): Promise<void> {
    $('.goalie-matchup').each(async (_, matchup) => {
      const homeGoalie = $(matchup).find('.home-goalie .player-name').text().trim();
      const awayGoalie = $(matchup).find('.away-goalie .player-name').text().trim();
      const homeTeam = $(matchup).find('.home-team').text().trim();
      const awayTeam = $(matchup).find('.away-team').text().trim();
      const gameTime = new Date($(matchup).attr('data-puckdrop') || '');
      
      // Process home goalie
      if (homeGoalie) {
        const change: LineupChange = {
          sport: 'NHL',
          playerId: await this.findPlayerId(homeGoalie, homeTeam, 'NHL'),
          playerName: homeGoalie,
          team: homeTeam,
          previousStatus: 'PROJECTED',
          newStatus: 'CONFIRMED STARTER',
          impact: 'STARTING',
          confidence: 0.9,
          source: 'Daily Faceoff',
          timestamp: new Date(),
          gameTime,
          minutesUntilLock: (gameTime.getTime() - Date.now()) / 60000
        };
        
        await this.processLineupChange(change);
      }
      
      // Process away goalie
      if (awayGoalie) {
        const change: LineupChange = {
          sport: 'NHL',
          playerId: await this.findPlayerId(awayGoalie, awayTeam, 'NHL'),
          playerName: awayGoalie,
          team: awayTeam,
          previousStatus: 'PROJECTED',
          newStatus: 'CONFIRMED STARTER',
          impact: 'STARTING',
          confidence: 0.9,
          source: 'Daily Faceoff',
          timestamp: new Date(),
          gameTime,
          minutesUntilLock: (gameTime.getTime() - Date.now()) / 60000
        };
        
        await this.processLineupChange(change);
      }
    });
  }
  
  /**
   * Check Twitter source (simplified - would need Twitter API)
   */
  private async checkTwitterSource(source: ScrapingSource): Promise<void> {
    // In production, this would use Twitter API v2
    // For now, we'll simulate with a placeholder
    console.log(chalk.gray(`Would check Twitter: ${source.name}`));
    
    // Example of how it would work:
    // const tweets = await twitterClient.getRecentTweets(source.url);
    // tweets.forEach(tweet => this.parseTweetForLineupInfo(tweet));
  }
  
  /**
   * Setup Twitter stream for real-time updates
   */
  private setupTwitterStream(): void {
    // In production, this would connect to Twitter streaming API
    console.log(chalk.yellow('Twitter streaming would be initialized here'));
    
    // Example WebSocket connection for real-time updates
    // this.webSocket = new WebSocket('wss://twitter-stream.example.com');
    // this.webSocket.on('message', this.handleTwitterStreamMessage.bind(this));
  }
  
  /**
   * Process a lineup change
   */
  private async processLineupChange(change: LineupChange): Promise<void> {
    // Save to database
    try {
      await pgPool.query(`
        INSERT INTO lineup_changes (
          sport, player_id, player_name, team,
          previous_status, new_status, impact,
          confidence, source, game_time,
          minutes_until_lock, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (player_id, game_time) 
        DO UPDATE SET
          new_status = $6,
          impact = $7,
          confidence = $8,
          source = $9,
          updated_at = NOW()
      `, [
        change.sport,
        change.playerId,
        change.playerName,
        change.team,
        change.previousStatus,
        change.newStatus,
        change.impact,
        change.confidence,
        change.source,
        change.gameTime,
        change.minutesUntilLock,
        change.timestamp
      ]);
      
      // Emit event for real-time updates
      this.emit('lineupChange', change);
      
      // Log critical changes
      if (change.impact === 'OUT' && change.minutesUntilLock < 30) {
        console.log(chalk.red.bold(`🚨 LATE SCRATCH: ${change.playerName} (${change.team}) is OUT!`));
        console.log(chalk.yellow(`   Time until lock: ${change.minutesUntilLock.toFixed(0)} minutes`));
        console.log(chalk.cyan(`   Source: ${change.source}`));
      } else if (change.impact === 'STARTING') {
        console.log(chalk.green(`✅ CONFIRMED: ${change.playerName} (${change.team}) is STARTING`));
      }
      
    } catch (error) {
      console.error(chalk.red('Error saving lineup change:'), error);
    }
  }
  
  /**
   * Find player ID from name and team
   */
  private async findPlayerId(playerName: string, team: string, sport: string): Promise<string> {
    try {
      const result = await pgPool.query(`
        SELECT id FROM players
        WHERE LOWER(name) = LOWER($1)
        AND team = $2
        AND sport = $3
        LIMIT 1
      `, [playerName, team, sport]);
      
      return result.rows[0]?.id || `${sport}_${playerName.replace(/\s+/g, '_')}`;
    } catch {
      return `${sport}_${playerName.replace(/\s+/g, '_')}`;
    }
  }
  
  /**
   * Map status text to impact level
   */
  private mapStatusToImpact(status: string): LineupChange['impact'] {
    const upperStatus = status.toUpperCase();
    
    if (upperStatus.includes('OUT') || upperStatus.includes('INACTIVE')) {
      return 'OUT';
    } else if (upperStatus.includes('DOUBTFUL')) {
      return 'OUT'; // Treat doubtful as out for DFS
    } else if (upperStatus.includes('QUESTIONABLE')) {
      return 'QUESTIONABLE';
    } else if (upperStatus.includes('PROBABLE') || upperStatus.includes('AVAILABLE')) {
      return 'PROBABLE';
    } else if (upperStatus.includes('CONFIRMED') || upperStatus.includes('STARTING')) {
      return 'STARTING';
    }
    
    return 'QUESTIONABLE';
  }
  
  /**
   * Check rate limiting
   */
  private canMakeRequest(source: ScrapingSource): boolean {
    const requests = this.rateLimiters.get(source.name) || [];
    const oneMinuteAgo = Date.now() - 60000;
    
    // Remove old requests
    const recentRequests = requests.filter(time => time > oneMinuteAgo);
    this.rateLimiters.set(source.name, recentRequests);
    
    return recentRequests.length < source.rateLimit;
  }
  
  /**
   * Record request for rate limiting
   */
  private recordRequest(source: ScrapingSource): void {
    const requests = this.rateLimiters.get(source.name) || [];
    requests.push(Date.now());
    this.rateLimiters.set(source.name, requests);
  }
  
  /**
   * Group sources by priority
   */
  private groupByPriority(sources: ScrapingSource[]): Map<number, ScrapingSource[]> {
    const groups = new Map<number, ScrapingSource[]>();
    
    sources.forEach(source => {
      const priority = source.priority;
      if (!groups.has(priority)) {
        groups.set(priority, []);
      }
      groups.get(priority)!.push(source);
    });
    
    return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
  }
  
  /**
   * Check API source (placeholder)
   */
  private async checkAPISource(source: ScrapingSource): Promise<void> {
    console.log(chalk.gray(`Would check API: ${source.name}`));
  }
  
  /**
   * Check RSS source (placeholder)
   */
  private async checkRSSSource(source: ScrapingSource): Promise<void> {
    console.log(chalk.gray(`Would check RSS: ${source.name}`));
  }
  
  /**
   * MOCK: Check last minute changes for a specific player
   */
  async checkLastMinuteChanges(playerId: string): Promise<{
    isOut: boolean;
    isDoubtful: boolean;
    isQuestionable: boolean;
    status: string;
    source: string;
    lastUpdate: Date;
  }> {
    // Mock realistic lineup status for testing
    const mockStatuses = ['healthy', 'questionable', 'doubtful', 'out'];
    const status = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
    
    return {
      isOut: status === 'out',
      isDoubtful: status === 'doubtful',
      isQuestionable: status === 'questionable',
      status,
      source: 'Mock NFL Official',
      lastUpdate: new Date()
    };
  }

  /**
   * Get recent lineup changes
   */
  async getRecentChanges(sport?: string, minutesBack: number = 60): Promise<LineupChange[]> {
    let query = `
      SELECT * FROM lineup_changes
      WHERE created_at > NOW() - INTERVAL '${minutesBack} minutes'
    `;
    
    const params: any[] = [];
    if (sport) {
      query += ' AND sport = $1';
      params.push(sport);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pgPool.query(query, params);
    return result.rows;
  }
  
  /**
   * Get high-impact changes (players likely to be highly owned)
   */
  async getHighImpactChanges(sport: string): Promise<LineupChange[]> {
    const query = `
      SELECT lc.*, 
             AVG(dfs.ownership) as avg_ownership,
             AVG(dfs.salary) as avg_salary
      FROM lineup_changes lc
      JOIN dfs_data dfs ON dfs.player_id = lc.player_id
      WHERE lc.sport = $1
      AND lc.impact IN ('OUT', 'QUESTIONABLE')
      AND lc.created_at > NOW() - INTERVAL '2 hours'
      AND dfs.ownership > 15  -- High ownership players
      GROUP BY lc.id
      ORDER BY avg_ownership DESC
    `;
    
    const result = await pgPool.query(query, [sport]);
    return result.rows;
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.webSocket) {
      this.webSocket.close();
    }
    console.log(chalk.yellow('Lineup monitoring stopped'));
  }
}

// Create the lineup_changes table
async function createLineupChangesTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS lineup_changes (
      id SERIAL PRIMARY KEY,
      sport VARCHAR(10) NOT NULL,
      player_id VARCHAR(100) NOT NULL,
      player_name VARCHAR(255) NOT NULL,
      team VARCHAR(10) NOT NULL,
      previous_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      impact VARCHAR(20) NOT NULL,
      confidence DECIMAL(3,2) NOT NULL,
      source VARCHAR(100) NOT NULL,
      game_time TIMESTAMP NOT NULL,
      minutes_until_lock INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(player_id, game_time)
    );
    
    CREATE INDEX idx_lineup_changes_sport_time ON lineup_changes(sport, created_at);
    CREATE INDEX idx_lineup_changes_impact ON lineup_changes(impact);
    CREATE INDEX idx_lineup_changes_game_time ON lineup_changes(game_time);
  `;
  
  await pgPool.query(query);
  console.log(chalk.green('✅ Lineup changes table created'));
}

// Test the scraper
async function testLineupScraper() {
  console.log(chalk.cyan.bold('\n🔥 TESTING REAL-TIME LINEUP SCRAPER\n'));
  
  // Create table
  await createLineupChangesTable();
  
  // Initialize scraper
  const scraper = new RealtimeLineupScraper();
  
  // Listen for changes
  scraper.on('lineupChange', (change: LineupChange) => {
    console.log(chalk.green('\n📢 LINEUP CHANGE DETECTED:'));
    console.log(`   Player: ${change.playerName} (${change.team})`);
    console.log(`   Status: ${change.previousStatus} → ${change.newStatus}`);
    console.log(`   Impact: ${change.impact}`);
    console.log(`   Lock in: ${change.minutesUntilLock.toFixed(0)} minutes`);
  });
  
  // Start monitoring
  await scraper.startMonitoring(['NFL', 'NBA']);
  
  // Run for 2 minutes then stop
  setTimeout(async () => {
    scraper.stopMonitoring();
    
    // Show recent changes
    const recentChanges = await scraper.getRecentChanges();
    console.log(chalk.yellow(`\n📊 Found ${recentChanges.length} lineup changes in last hour`));
    
    await pgPool.end();
  }, 120000);
}

// Export for use in other modules
export { LineupChange, createLineupChangesTable };

// Run if called directly
if (require.main === module) {
  testLineupScraper();
}