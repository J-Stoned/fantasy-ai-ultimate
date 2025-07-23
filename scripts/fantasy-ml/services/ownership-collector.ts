/**
 * 🎯 Ownership Data Collection Service
 * Collects real ownership data from DFS contests for accurate projections
 */

import { Pool } from 'pg';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { EventEmitter } from 'events';
import axios from 'axios';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export interface ContestResult {
  contest_id: string;
  contest_name: string;
  platform: 'draftkings' | 'fanduel';
  contest_date: Date;
  contest_type: string;
  entry_fee: number;
  total_entries: number;
  prize_pool: number;
  ownership_data: Map<string, number>;
  winning_score: number;
  cash_line: number;
}

export interface PlayerOwnershipData {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  salary: number;
  actual_ownership: number;
  actual_points: number;
}

export class OwnershipCollector extends EventEmitter {
  private pool: Pool;
  private browser: puppeteer.Browser | null = null;
  
  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }
  
  /**
   * Initialize the collector
   */
  async initialize(): Promise<void> {
    console.log('🎯 Initializing Ownership Collector...');
    
    // Launch puppeteer for scraping
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ Ownership Collector initialized');
  }
  
  /**
   * Collect ownership data from RotoGrinders (public data)
   */
  async collectFromRotoGrinders(
    sport: string,
    date: Date
  ): Promise<Map<string, number>> {
    console.log(`📊 Collecting ownership from RotoGrinders for ${sport} on ${date.toDateString()}`);
    
    const ownership = new Map<string, number>();
    
    try {
      // RotoGrinders provides some free ownership data
      const dateStr = date.toISOString().split('T')[0];
      const url = `https://rotogrinders.com/played?sport=${sport.toLowerCase()}&date=${dateStr}`;
      
      const page = await this.browser!.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for data to load
      await page.waitForSelector('.player-popup', { timeout: 10000 });
      
      // Extract ownership data
      const data = await page.evaluate(() => {
        const players: any[] = [];
        document.querySelectorAll('.player-popup').forEach(row => {
          const name = row.querySelector('.player-name')?.textContent?.trim();
          const owned = row.querySelector('.owned')?.textContent?.trim();
          if (name && owned) {
            players.push({
              name,
              ownership: parseFloat(owned.replace('%', ''))
            });
          }
        });
        return players;
      });
      
      // Map to our player IDs
      for (const player of data) {
        const playerId = await this.findPlayerId(player.name, sport);
        if (playerId) {
          ownership.set(playerId, player.ownership);
        }
      }
      
      await page.close();
      
      console.log(`✅ Collected ownership for ${ownership.size} players`);
    } catch (error) {
      console.error('Failed to collect from RotoGrinders:', error);
    }
    
    return ownership;
  }
  
  /**
   * Collect social media buzz
   */
  async collectSocialBuzz(
    players: string[],
    date: Date
  ): Promise<Map<string, number>> {
    console.log(`📱 Collecting social buzz for ${players.length} players`);
    
    const buzzScores = new Map<string, number>();
    
    for (const playerId of players) {
      const player = await this.getPlayerInfo(playerId);
      if (!player) continue;
      
      // Search Twitter (would need API access in production)
      const mentions = await this.searchTwitterMentions(player.name, date);
      const redditMentions = await this.searchRedditMentions(player.name, date);
      
      // Calculate buzz score (0-1)
      const twitterScore = Math.min(mentions.count / 1000, 1); // Cap at 1000 mentions
      const redditScore = Math.min(redditMentions / 100, 1); // Cap at 100 mentions
      const viralBoost = mentions.viral ? 0.2 : 0;
      
      const buzzScore = (twitterScore * 0.6 + redditScore * 0.3 + viralBoost) * 0.9; // Max 0.9
      
      buzzScores.set(playerId, buzzScore);
      
      // Store in database
      await this.pool.query(`
        INSERT INTO social_mentions 
        (player_id, player_name, platform, mention_count, unique_users, 
         sentiment_score, viral_score, slate_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (player_id, platform, slate_date) 
        DO UPDATE SET 
          mention_count = $4,
          unique_users = $5,
          sentiment_score = $6,
          viral_score = $7,
          captured_at = NOW()
      `, [
        playerId,
        player.name,
        'twitter',
        mentions.count,
        mentions.unique_users || 0,
        mentions.sentiment || 0,
        mentions.viral ? 0.8 : 0.2,
        date
      ]);
    }
    
    return buzzScores;
  }
  
  /**
   * Collect DFS network exposure
   */
  async collectDFSNetworkExposure(
    sport: string,
    date: Date
  ): Promise<Map<string, number>> {
    console.log(`🎰 Collecting DFS network exposure for ${sport}`);
    
    const exposures = new Map<string, number>();
    
    // List of DFS content sites to check
    const sources = [
      { name: 'awesemo', weight: 0.25 },
      { name: 'establish_the_run', weight: 0.2 },
      { name: 'rotogrinders', weight: 0.2 },
      { name: 'fantasyguruselite', weight: 0.15 },
      { name: 'sabersim', weight: 0.2 }
    ];
    
    for (const source of sources) {
      const mentions = await this.scrapeSourceMentions(source.name, sport, date);
      
      for (const [playerId, mentionType] of mentions) {
        const current = exposures.get(playerId) || 0;
        const boost = mentionType === 'core_play' ? source.weight : source.weight * 0.5;
        exposures.set(playerId, Math.min(current + boost, 1));
        
        // Store in database
        await this.pool.query(`
          INSERT INTO dfs_content_mentions
          (player_id, source, mention_type, slate_date, sport)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [playerId, source.name, mentionType, date, sport]);
      }
    }
    
    return exposures;
  }
  
  /**
   * Calculate narrative scores
   */
  async calculateNarrativeScores(
    players: string[],
    date: Date
  ): Promise<Map<string, number>> {
    console.log(`📖 Calculating narrative scores for ${players.length} players`);
    
    const narrativeScores = new Map<string, number>();
    
    for (const playerId of players) {
      let score = 0;
      const narratives: string[] = [];
      
      // Check for revenge game
      const isRevenge = await this.checkRevengeGame(playerId, date);
      if (isRevenge) {
        score += 0.2;
        narratives.push('revenge_game');
      }
      
      // Check for milestone
      const milestone = await this.checkMilestone(playerId);
      if (milestone) {
        score += 0.3;
        narratives.push('milestone_chase');
      }
      
      // Check if prime time
      const isPrimeTime = await this.checkPrimeTime(playerId, date);
      if (isPrimeTime) {
        score += 0.15;
        narratives.push('prime_time');
      }
      
      // Check for injury opportunity
      const injuryOpp = await this.checkInjuryOpportunity(playerId, date);
      if (injuryOpp) {
        score += 0.35;
        narratives.push('injury_opportunity');
      }
      
      narrativeScores.set(playerId, Math.min(score, 1));
      
      // Store narratives
      for (const narrative of narratives) {
        await this.pool.query(`
          INSERT INTO player_narratives
          (player_id, game_date, narrative_type, narrative_strength)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [playerId, date, narrative, score / narratives.length]);
      }
    }
    
    return narrativeScores;
  }
  
  /**
   * Store collected ownership data
   */
  async storeOwnershipData(
    contest: ContestResult,
    playerData: PlayerOwnershipData[]
  ): Promise<void> {
    // Store contest result
    await this.pool.query(`
      INSERT INTO contest_results
      (contest_id, contest_date, platform, contest_name, contest_type,
       entry_fee, total_entries, prize_pool, winning_score, cash_line,
       ownership_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (contest_id) DO NOTHING
    `, [
      contest.contest_id,
      contest.contest_date,
      contest.platform,
      contest.contest_name,
      contest.contest_type,
      contest.entry_fee,
      contest.total_entries,
      contest.prize_pool,
      contest.winning_score,
      contest.cash_line,
      JSON.stringify(Array.from(contest.ownership_data.entries()))
    ]);
    
    // Store individual player ownership
    for (const player of playerData) {
      await this.pool.query(`
        INSERT INTO historical_ownership
        (player_id, player_name, contest_date, sport, slate_type,
         contest_type, platform, actual_ownership, salary, actual_points,
         position, team)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (player_id, contest_date, slate_type, platform) 
        DO UPDATE SET
          actual_ownership = $8,
          actual_points = $10
      `, [
        player.player_id,
        player.player_name,
        contest.contest_date,
        this.getSportFromPosition(player.position),
        'MAIN', // Would determine from contest
        contest.contest_type,
        contest.platform,
        player.actual_ownership,
        player.salary,
        player.actual_points,
        player.position,
        player.team
      ]);
    }
    
    console.log(`✅ Stored ownership data for ${playerData.length} players`);
  }
  
  /**
   * Update ownership factors for upcoming slate
   */
  async updateOwnershipFactors(
    players: string[],
    date: Date
  ): Promise<void> {
    console.log(`🔄 Updating ownership factors for ${players.length} players`);
    
    // Collect all factors
    const socialBuzz = await this.collectSocialBuzz(players, date);
    const dfsExposure = await this.collectDFSNetworkExposure('nfl', date);
    const narratives = await this.calculateNarrativeScores(players, date);
    
    for (const playerId of players) {
      // Calculate recent form
      const recentForm = await this.calculateRecentForm(playerId);
      
      // Get price change
      const priceChange = await this.getPriceChange(playerId, date);
      
      // Get expert consensus
      const expertConsensus = await this.getExpertConsensus(playerId, date);
      
      await this.pool.query(`
        INSERT INTO ownership_factors
        (player_id, game_date, social_buzz_score, dfs_network_exposure,
         price_change, recent_form_score, expert_exposure, narrative_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (player_id, game_date) 
        DO UPDATE SET
          social_buzz_score = $3,
          dfs_network_exposure = $4,
          price_change = $5,
          recent_form_score = $6,
          expert_exposure = $7,
          narrative_score = $8,
          updated_at = NOW()
      `, [
        playerId,
        date,
        socialBuzz.get(playerId) || 0,
        dfsExposure.get(playerId) || 0,
        priceChange,
        recentForm,
        expertConsensus,
        narratives.get(playerId) || 0
      ]);
    }
    
    console.log('✅ Updated all ownership factors');
  }
  
  /**
   * Helper methods
   */
  
  private async findPlayerId(name: string, sport: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT id FROM players WHERE name = $1 AND sport = $2 LIMIT 1',
      [name, sport]
    );
    return result.rows[0]?.id || null;
  }
  
  private async getPlayerInfo(playerId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );
    return result.rows[0];
  }
  
  private async searchTwitterMentions(
    playerName: string,
    date: Date
  ): Promise<{ count: number; viral: boolean; sentiment: number; unique_users: number }> {
    // In production, would use Twitter API
    // Mock implementation
    return {
      count: Math.floor(Math.random() * 500),
      viral: Math.random() > 0.9,
      sentiment: Math.random() * 2 - 1,
      unique_users: Math.floor(Math.random() * 200)
    };
  }
  
  private async searchRedditMentions(playerName: string, date: Date): Promise<number> {
    // Would scrape r/dfsports
    return Math.floor(Math.random() * 50);
  }
  
  private async scrapeSourceMentions(
    source: string,
    sport: string,
    date: Date
  ): Promise<Map<string, string>> {
    // Would scrape actual sites
    // Mock implementation
    const mentions = new Map<string, string>();
    // Add some mock data
    return mentions;
  }
  
  private async checkRevengeGame(playerId: string, date: Date): Promise<boolean> {
    // Check if playing against former team
    const result = await this.pool.query(`
      SELECT COUNT(*) > 0 as is_revenge
      FROM player_team_history pth
      JOIN games g ON g.game_date = $2
      WHERE pth.player_id = $1
        AND (g.home_team_id = pth.former_team_id OR g.away_team_id = pth.former_team_id)
    `, [playerId, date]);
    
    return result.rows[0]?.is_revenge || false;
  }
  
  private async checkMilestone(playerId: string): Promise<boolean> {
    // Check if near any milestones
    // Would need milestone tracking table
    return Math.random() > 0.95;
  }
  
  private async checkPrimeTime(playerId: string, date: Date): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT g.game_time
      FROM games g
      JOIN players p ON (p.team_id = g.home_team_id OR p.team_id = g.away_team_id)
      WHERE p.id = $1 AND g.game_date = $2
    `, [playerId, date]);
    
    const gameTime = result.rows[0]?.game_time;
    if (!gameTime) return false;
    
    const hour = new Date(gameTime).getHours();
    return hour >= 20; // 8 PM or later
  }
  
  private async checkInjuryOpportunity(playerId: string, date: Date): Promise<boolean> {
    // Check if starter at same position is injured
    const result = await this.pool.query(`
      SELECT COUNT(*) > 0 as has_opportunity
      FROM players p1
      JOIN players p2 ON p1.team_id = p2.team_id AND p1.position = p2.position
      JOIN player_injuries pi ON p2.id = pi.player_id
      WHERE p1.id = $1
        AND pi.injury_status IN ('OUT', 'DOUBTFUL')
        AND p2.depth_chart_rank < p1.depth_chart_rank
    `, [playerId]);
    
    return result.rows[0]?.has_opportunity || false;
  }
  
  private async calculateRecentForm(playerId: string): Promise<number> {
    const result = await this.pool.query(`
      WITH recent_games AS (
        SELECT actual_points
        FROM game_logs
        WHERE player_id = $1
        ORDER BY game_date DESC
        LIMIT 3
      ),
      season_avg AS (
        SELECT AVG(actual_points) as avg_points
        FROM game_logs
        WHERE player_id = $1
          AND game_date >= CURRENT_DATE - INTERVAL '90 days'
      )
      SELECT 
        AVG(rg.actual_points) / NULLIF(sa.avg_points, 0) as form_score
      FROM recent_games rg, season_avg sa
    `, [playerId]);
    
    return result.rows[0]?.form_score || 1.0;
  }
  
  private async getPriceChange(playerId: string, date: Date): Promise<number> {
    const result = await this.pool.query(`
      WITH current_salary AS (
        SELECT salary
        FROM player_salaries
        WHERE player_id = $1 AND game_date = $2
      ),
      previous_salary AS (
        SELECT salary
        FROM player_salaries
        WHERE player_id = $1 AND game_date < $2
        ORDER BY game_date DESC
        LIMIT 1
      )
      SELECT 
        COALESCE(cs.salary - ps.salary, 0) as price_change
      FROM current_salary cs, previous_salary ps
    `, [playerId, date]);
    
    return result.rows[0]?.price_change || 0;
  }
  
  private async getExpertConsensus(playerId: string, date: Date): Promise<number> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT source)::FLOAT / 5 as consensus
      FROM dfs_content_mentions
      WHERE player_id = $1
        AND slate_date = $2
        AND mention_type IN ('core_play', 'gpp_play')
    `, [playerId, date]);
    
    return Math.min(result.rows[0]?.consensus || 0, 1);
  }
  
  private getSportFromPosition(position: string): string {
    const nflPositions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    const nbaPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const mlbPositions = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'];
    
    if (nflPositions.includes(position)) return 'nfl';
    if (nbaPositions.includes(position)) return 'nba';
    if (mlbPositions.includes(position)) return 'mlb';
    return 'nhl';
  }
  
  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 Ownership collector disposed');
  }
}

// Export for use
export default OwnershipCollector;