/**
 * 💰 Vegas Lines Service
 * Integrates betting lines and game totals for sharper DFS projections
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface VegasLine {
  game_id: string;
  sport: string;
  game_date: Date;
  home_team: string;
  away_team: string;
  spread: number; // Positive = home underdog, Negative = home favorite
  total: number; // Over/Under total
  home_ml: number; // Home moneyline
  away_ml: number; // Away moneyline
  implied_home_score: number;
  implied_away_score: number;
  books: string[]; // Which sportsbooks
  last_updated: Date;
}

export interface VegasImpact {
  game_id: string;
  total_impact: number; // High total = more scoring
  spread_impact: number; // Close spread = competitive game
  pace_factor: number; // Expected game pace
  blowout_risk: number; // Risk of non-competitive game
  correlation_boost: number; // Stack correlation adjustment
  notes: string[];
}

export class VegasService extends EventEmitter {
  private pool: Pool;
  private vegasCache: Map<string, VegasLine> = new Map();
  private impactCache: Map<string, VegasImpact> = new Map();

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  /**
   * Initialize Vegas service
   */
  async initialize(): Promise<void> {
    console.log('💰 Initializing Vegas Lines Service...');
    
    // Load current Vegas lines
    await this.loadVegasLines();
    
    console.log(`✅ Vegas service initialized with ${this.vegasCache.size} game lines`);
  }

  /**
   * Load Vegas lines from database
   */
  private async loadVegasLines(): Promise<void> {
    const query = `
      SELECT 
        vl.game_id,
        g.sport,
        g.game_date,
        ht.abbreviation as home_team,
        at.abbreviation as away_team,
        vl.spread,
        vl.total,
        vl.home_ml,
        vl.away_ml,
        vl.books,
        vl.last_updated,
        -- Calculate implied scores
        CASE 
          WHEN vl.spread < 0 THEN (vl.total / 2) - (vl.spread / 2)
          ELSE (vl.total / 2) + (vl.spread / 2)
        END as implied_home_score,
        CASE 
          WHEN vl.spread < 0 THEN (vl.total / 2) + (vl.spread / 2)
          ELSE (vl.total / 2) - (vl.spread / 2)
        END as implied_away_score
      FROM vegas_lines vl
      JOIN games g ON vl.game_id = g.id
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams at ON g.away_team_id = at.id
      WHERE g.game_date >= CURRENT_DATE
        AND g.game_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY g.game_date, g.game_time`;
    
    const result = await this.pool.query(query);
    
    this.vegasCache.clear();
    this.impactCache.clear();
    
    result.rows.forEach(row => {
      const line: VegasLine = {
        game_id: row.game_id,
        sport: row.sport,
        game_date: row.game_date,
        home_team: row.home_team,
        away_team: row.away_team,
        spread: parseFloat(row.spread),
        total: parseFloat(row.total),
        home_ml: parseInt(row.home_ml),
        away_ml: parseInt(row.away_ml),
        implied_home_score: parseFloat(row.implied_home_score),
        implied_away_score: parseFloat(row.implied_away_score),
        books: row.books || ['consensus'],
        last_updated: row.last_updated
      };
      
      this.vegasCache.set(row.game_id, line);
      
      // Calculate impact
      const impact = this.calculateVegasImpact(line);
      this.impactCache.set(row.game_id, impact);
    });
  }

  /**
   * Calculate Vegas impact on fantasy scoring
   */
  private calculateVegasImpact(line: VegasLine): VegasImpact {
    const impact: VegasImpact = {
      game_id: line.game_id,
      total_impact: 0,
      spread_impact: 0,
      pace_factor: 1.0,
      blowout_risk: 0,
      correlation_boost: 0,
      notes: []
    };
    
    // Sport-specific average totals
    const avgTotals = {
      nfl: 45,
      nba: 220,
      mlb: 9,
      nhl: 5.5
    };
    
    const avgTotal = avgTotals[line.sport] || 50;
    
    // Total impact - higher totals = more fantasy points
    const totalDiff = line.total - avgTotal;
    const totalPct = totalDiff / avgTotal;
    
    if (line.sport === 'nfl') {
      if (line.total > 50) {
        impact.total_impact = 0.2;
        impact.notes.push('🔥 High-scoring game environment (50+ total)');
      } else if (line.total > 47) {
        impact.total_impact = 0.1;
        impact.notes.push('📈 Above-average scoring expected');
      } else if (line.total < 40) {
        impact.total_impact = -0.2;
        impact.notes.push('🛡️ Low-scoring defensive battle expected');
      } else if (line.total < 43) {
        impact.total_impact = -0.1;
        impact.notes.push('📉 Below-average scoring expected');
      }
    } else if (line.sport === 'nba') {
      impact.total_impact = totalPct * 0.5; // NBA is pace-driven
      impact.pace_factor = 1 + (totalPct * 0.3);
      
      if (line.total > 235) {
        impact.notes.push('🏃 Very fast pace expected');
      } else if (line.total < 210) {
        impact.notes.push('🐌 Slow pace expected');
      }
    } else if (line.sport === 'mlb') {
      impact.total_impact = totalPct * 0.3;
      if (line.total > 10.5) {
        impact.notes.push('⚾ High-scoring game (hitter-friendly)');
      } else if (line.total < 7.5) {
        impact.notes.push('⚾ Pitcher\'s duel expected');
      }
    }
    
    // Spread impact - close games = more competitive
    const absSpread = Math.abs(line.spread);
    
    if (line.sport === 'nfl') {
      if (absSpread <= 3) {
        impact.spread_impact = 0.1;
        impact.correlation_boost = 0.1;
        impact.notes.push('🎯 Very close game - high competitiveness');
      } else if (absSpread >= 10) {
        impact.spread_impact = -0.2;
        impact.blowout_risk = 0.5;
        impact.notes.push('⚠️ Large spread - blowout risk');
      } else if (absSpread >= 7) {
        impact.spread_impact = -0.1;
        impact.blowout_risk = 0.3;
      }
    } else if (line.sport === 'nba') {
      if (absSpread >= 10) {
        impact.blowout_risk = 0.6;
        impact.notes.push('⚠️ High blowout risk - starters may rest');
      } else if (absSpread <= 4) {
        impact.spread_impact = 0.1;
        impact.notes.push('🎯 Competitive game expected');
      }
    }
    
    // Game stacking correlation boost
    if (impact.total_impact > 0 && impact.spread_impact >= 0) {
      impact.correlation_boost = 0.15;
      impact.notes.push('✨ Good game stacking opportunity');
    }
    
    // Cap values
    impact.total_impact = Math.max(-0.5, Math.min(0.5, impact.total_impact));
    impact.spread_impact = Math.max(-0.5, Math.min(0.5, impact.spread_impact));
    impact.blowout_risk = Math.max(0, Math.min(1, impact.blowout_risk));
    impact.correlation_boost = Math.max(0, Math.min(0.3, impact.correlation_boost));
    
    return impact;
  }

  /**
   * Get Vegas line for a game
   */
  getGameLine(gameId: string): VegasLine | null {
    return this.vegasCache.get(gameId) || null;
  }

  /**
   * Get Vegas impact for a game
   */
  getVegasImpact(gameId: string): VegasImpact | null {
    return this.impactCache.get(gameId) || null;
  }

  /**
   * Get games with high totals
   */
  getHighTotalGames(sport: string, threshold?: number): Array<{
    line: VegasLine;
    impact: VegasImpact;
  }> {
    const thresholds = {
      nfl: threshold || 48,
      nba: threshold || 230,
      mlb: threshold || 9.5,
      nhl: threshold || 6
    };
    
    const highTotalGames: Array<{ line: VegasLine; impact: VegasImpact }> = [];
    
    this.vegasCache.forEach((line, gameId) => {
      if (line.sport === sport && line.total >= thresholds[sport]) {
        const impact = this.impactCache.get(gameId);
        if (impact) {
          highTotalGames.push({ line, impact });
        }
      }
    });
    
    return highTotalGames.sort((a, b) => b.line.total - a.line.total);
  }

  /**
   * Get close spread games (competitive)
   */
  getCloseGames(sport: string, maxSpread: number = 3): Array<{
    line: VegasLine;
    impact: VegasImpact;
  }> {
    const closeGames: Array<{ line: VegasLine; impact: VegasImpact }> = [];
    
    this.vegasCache.forEach((line, gameId) => {
      if (line.sport === sport && Math.abs(line.spread) <= maxSpread) {
        const impact = this.impactCache.get(gameId);
        if (impact) {
          closeGames.push({ line, impact });
        }
      }
    });
    
    return closeGames.sort((a, b) => Math.abs(a.line.spread) - Math.abs(b.line.spread));
  }

  /**
   * Update Vegas lines for a game
   */
  async updateGameLine(
    gameId: string,
    lineData: Partial<VegasLine>
  ): Promise<void> {
    const query = `
      INSERT INTO vegas_lines (
        game_id, spread, total, home_ml, away_ml, books, last_updated
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (game_id) DO UPDATE SET
        spread = $2,
        total = $3,
        home_ml = $4,
        away_ml = $5,
        books = $6,
        last_updated = NOW()`;
    
    await this.pool.query(query, [
      gameId,
      lineData.spread,
      lineData.total,
      lineData.home_ml,
      lineData.away_ml,
      lineData.books || ['update']
    ]);
    
    // Reload Vegas data
    await this.loadVegasLines();
    
    // Emit update event
    this.emit('vegas:update', { gameId, lineData });
  }

  /**
   * Get Vegas report
   */
  getVegasReport(sport?: string): {
    total_games: number;
    avg_total: number;
    avg_spread: number;
    high_total_games: number;
    close_games: number;
    blowout_risks: number;
    best_game_stacks: Array<{ line: VegasLine; impact: VegasImpact }>;
  } {
    let lines = Array.from(this.vegasCache.values());
    
    if (sport) {
      lines = lines.filter(l => l.sport === sport);
    }
    
    const avgTotal = lines.reduce((sum, l) => sum + l.total, 0) / lines.length || 0;
    const avgSpread = lines.reduce((sum, l) => sum + Math.abs(l.spread), 0) / lines.length || 0;
    
    const highTotalGames = lines.filter(l => {
      const impact = this.impactCache.get(l.game_id);
      return impact && impact.total_impact > 0.1;
    }).length;
    
    const closeGames = lines.filter(l => {
      const absSpread = Math.abs(l.spread);
      return (l.sport === 'nfl' && absSpread <= 3) || 
             (l.sport === 'nba' && absSpread <= 4);
    }).length;
    
    const blowoutRisks = Array.from(this.impactCache.values())
      .filter(impact => impact.blowout_risk > 0.4).length;
    
    // Get best game stacks
    const bestStacks = Array.from(this.impactCache.entries())
      .filter(([_, impact]) => impact.correlation_boost > 0)
      .map(([gameId, impact]) => ({
        line: this.vegasCache.get(gameId)!,
        impact
      }))
      .filter(item => item.line && (!sport || item.line.sport === sport))
      .sort((a, b) => b.impact.correlation_boost - a.impact.correlation_boost)
      .slice(0, 5);
    
    return {
      total_games: lines.length,
      avg_total: Math.round(avgTotal * 10) / 10,
      avg_spread: Math.round(avgSpread * 10) / 10,
      high_total_games: highTotalGames,
      close_games: closeGames,
      blowout_risks: blowoutRisks,
      best_game_stacks: bestStacks
    };
  }

  /**
   * Mock Vegas lines for testing
   */
  async generateMockLines(gameId: string, sport: string): Promise<void> {
    const spreads = [-7, -3.5, -1, 2.5, 6, 10];
    const totals = {
      nfl: [38, 42, 45, 48, 52, 56],
      nba: [210, 220, 225, 235, 245],
      mlb: [7, 8, 9, 10, 11],
      nhl: [5, 5.5, 6, 6.5, 7]
    };
    
    const randomSpread = spreads[Math.floor(Math.random() * spreads.length)];
    const sportTotals = totals[sport] || totals.nfl;
    const randomTotal = sportTotals[Math.floor(Math.random() * sportTotals.length)];
    
    // Calculate moneylines from spread
    const homeMl = randomSpread > 0 ? 100 + (randomSpread * 20) : -100 - (Math.abs(randomSpread) * 20);
    const awayMl = randomSpread < 0 ? 100 + (Math.abs(randomSpread) * 20) : -100 - (randomSpread * 20);
    
    await this.updateGameLine(gameId, {
      spread: randomSpread,
      total: randomTotal,
      home_ml: homeMl,
      away_ml: awayMl,
      books: ['DraftKings', 'FanDuel', 'BetMGM']
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.removeAllListeners();
    console.log('🧹 Vegas service disposed');
  }
}