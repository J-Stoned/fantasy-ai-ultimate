#!/usr/bin/env tsx
/**
 * 🏥 INJURY MONITORING SYSTEM
 * 
 * First to know = first to profit!
 * Avoid 15-20% of bust performances by tracking injuries.
 */

import chalk from 'chalk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { pgPool } from '../config/database';
import { EventEmitter } from 'events';
import { OpenAI } from 'openai';

interface InjuryReport {
  playerId: string;
  playerName: string;
  team: string;
  sport: string;
  position: string;
  injuryType: string;
  bodyPart: string;
  status: 'healthy' | 'probable' | 'questionable' | 'doubtful' | 'out' | 'ir';
  previousStatus?: string;
  practiceStatus?: 'full' | 'limited' | 'dnp' | 'unknown';
  timeline?: string;  // "day-to-day", "week-to-week", "2-4 weeks", etc.
  severity: number;   // 0-1 score
  fantasyImpact: number;  // 0-1 score of impact on fantasy value
  confidence: number;  // 0-1 confidence in the report
  source: string;
  sourceUrl?: string;
  reportDate: Date;
  lastUpdate: Date;
  notes?: string;
  coachSpeak?: string;  // Raw coach quotes
  decodedMeaning?: string;  // AI interpretation
}

interface PracticeReport {
  team: string;
  sport: string;
  date: Date;
  players: {
    playerName: string;
    status: 'full' | 'limited' | 'dnp';
    reason?: string;
  }[];
}

interface InjuryPattern {
  injuryType: string;
  bodyPart: string;
  position: string;
  typicalRecovery: string;
  reinjuryRisk: number;
  performanceImpact: {
    immediate: number;    // First game back
    shortTerm: number;   // 2-4 games
    longTerm: number;    // Rest of season
  };
}

// Common injury patterns and recovery times
const INJURY_PATTERNS: InjuryPattern[] = [
  // NFL
  {
    injuryType: 'hamstring',
    bodyPart: 'leg',
    position: 'RB',
    typicalRecovery: '2-4 weeks',
    reinjuryRisk: 0.35,
    performanceImpact: { immediate: 0.75, shortTerm: 0.85, longTerm: 0.95 }
  },
  {
    injuryType: 'ankle sprain',
    bodyPart: 'ankle',
    position: 'WR',
    typicalRecovery: '1-3 weeks',
    reinjuryRisk: 0.25,
    performanceImpact: { immediate: 0.80, shortTerm: 0.90, longTerm: 0.98 }
  },
  {
    injuryType: 'shoulder',
    bodyPart: 'shoulder',
    position: 'QB',
    typicalRecovery: '2-6 weeks',
    reinjuryRisk: 0.30,
    performanceImpact: { immediate: 0.70, shortTerm: 0.85, longTerm: 0.95 }
  },
  
  // NBA
  {
    injuryType: 'knee soreness',
    bodyPart: 'knee',
    position: 'C',
    typicalRecovery: 'day-to-day',
    reinjuryRisk: 0.40,
    performanceImpact: { immediate: 0.85, shortTerm: 0.90, longTerm: 0.95 }
  },
  {
    injuryType: 'load management',
    bodyPart: 'rest',
    position: 'any',
    typicalRecovery: '1 game',
    reinjuryRisk: 0.10,
    performanceImpact: { immediate: 1.00, shortTerm: 1.00, longTerm: 1.00 }
  },
  
  // Add more patterns...
];

// Coach speak decoder patterns
const COACH_SPEAK_PATTERNS = [
  { phrase: 'day-to-day', probability: 0.65, meaning: 'Likely misses 1-2 games' },
  { phrase: 'game-time decision', probability: 0.55, meaning: 'Slightly more likely to play' },
  { phrase: 'week-to-week', probability: 0.20, meaning: 'Out 2-4 weeks minimum' },
  { phrase: 'progressing well', probability: 0.70, meaning: 'On track to return soon' },
  { phrase: 'setback', probability: 0.15, meaning: 'Timeline extended significantly' },
  { phrase: 'we\'ll see', probability: 0.30, meaning: 'Pessimistic outlook' },
  { phrase: 'hopeful', probability: 0.45, meaning: 'Less than 50% chance' },
  { phrase: 'cautious', probability: 0.25, meaning: 'Likely held out longer' },
  { phrase: 'feels good', probability: 0.75, meaning: 'Probable to play' },
  { phrase: 'sore', probability: 0.60, meaning: 'May play through it' },
  { phrase: 'tightness', probability: 0.40, meaning: 'Higher risk if plays' },
  { phrase: 'managing', probability: 0.50, meaning: 'Will play limited' }
];

export class InjuryMonitoringSystem extends EventEmitter {
  private openai?: OpenAI;
  private updateInterval?: NodeJS.Timer;
  private practiceReportCache: Map<string, PracticeReport> = new Map();
  
  constructor(openaiKey?: string) {
    super();
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }
  
  /**
   * Start monitoring injuries across all sports
   */
  async startMonitoring(): Promise<void> {
    console.log(chalk.cyan.bold('🏥 INJURY MONITORING SYSTEM STARTED'));
    
    // Check every 15 minutes
    this.updateInterval = setInterval(async () => {
      await this.checkAllSources();
    }, 15 * 60 * 1000);
    
    // Initial check
    await this.checkAllSources();
  }
  
  /**
   * Check all injury sources
   */
  private async checkAllSources(): Promise<void> {
    console.log(chalk.yellow('Checking injury reports...'));
    
    try {
      // Check official injury reports
      await Promise.all([
        this.checkNFLInjuryReport(),
        this.checkNBAInjuryReport(),
        this.checkMLBInjuryReport(),
        this.checkNHLInjuryReport()
      ]);
      
      // Check practice reports
      await this.checkPracticeReports();
      
      // Analyze coach quotes if GPT available
      if (this.openai) {
        await this.analyzeCoachQuotes();
      }
      
      // Calculate fantasy impact
      await this.updateFantasyImpacts();
      
    } catch (error) {
      console.error(chalk.red('Error checking injury sources:'), error);
    }
  }
  
  /**
   * Check NFL injury report
   */
  private async checkNFLInjuryReport(): Promise<void> {
    // This would scrape official NFL injury reports
    // For demo, we'll simulate
    
    const mockInjuries: Partial<InjuryReport>[] = [
      {
        playerName: 'Patrick Mahomes',
        team: 'KC',
        sport: 'NFL',
        position: 'QB',
        injuryType: 'ankle sprain',
        bodyPart: 'ankle',
        status: 'questionable',
        practiceStatus: 'limited',
        timeline: 'day-to-day',
        coachSpeak: 'He\'s progressing well, we\'ll see how he feels Sunday'
      },
      {
        playerName: 'Christian McCaffrey',
        team: 'SF',
        sport: 'NFL',
        position: 'RB',
        injuryType: 'hamstring',
        bodyPart: 'leg',
        status: 'doubtful',
        practiceStatus: 'dnp',
        timeline: '2-3 weeks',
        coachSpeak: 'We\'re being cautious with him'
      }
    ];
    
    for (const injury of mockInjuries) {
      await this.processInjuryReport(injury as InjuryReport);
    }
  }
  
  /**
   * Check NBA injury report
   */
  private async checkNBAInjuryReport(): Promise<void> {
    // Would check official NBA injury report
    console.log(chalk.gray('Checking NBA injuries...'));
  }
  
  /**
   * Check MLB injury report
   */
  private async checkMLBInjuryReport(): Promise<void> {
    // Would check MLB IL/injury updates
    console.log(chalk.gray('Checking MLB injuries...'));
  }
  
  /**
   * Check NHL injury report
   */
  private async checkNHLInjuryReport(): Promise<void> {
    // Would check NHL injury updates
    console.log(chalk.gray('Checking NHL injuries...'));
  }
  
  /**
   * Check practice reports for all teams
   */
  private async checkPracticeReports(): Promise<void> {
    // This would check team practice reports
    // Practice participation is often the best injury indicator
    
    const mockPracticeReport: PracticeReport = {
      team: 'KC',
      sport: 'NFL',
      date: new Date(),
      players: [
        { playerName: 'Patrick Mahomes', status: 'limited', reason: 'ankle' },
        { playerName: 'Travis Kelce', status: 'full', reason: undefined },
        { playerName: 'Chris Jones', status: 'dnp', reason: 'rest' }
      ]
    };
    
    this.practiceReportCache.set('KC_NFL', mockPracticeReport);
  }
  
  /**
   * Process an injury report
   */
  private async processInjuryReport(report: InjuryReport): Promise<void> {
    // Find player ID
    report.playerId = await this.findPlayerId(report.playerName, report.team, report.sport);
    
    // Calculate severity and impact
    const analysis = this.analyzeInjury(report);
    report.severity = analysis.severity;
    report.fantasyImpact = analysis.fantasyImpact;
    report.confidence = analysis.confidence;
    
    // Decode coach speak if available
    if (report.coachSpeak && this.openai) {
      report.decodedMeaning = await this.decodeCoachSpeak(report.coachSpeak, report);
    } else if (report.coachSpeak) {
      report.decodedMeaning = this.simpleCoachSpeakDecode(report.coachSpeak);
    }
    
    // Get previous status
    const previousReport = await this.getPreviousInjuryStatus(report.playerId);
    report.previousStatus = previousReport?.status;
    
    // Save to database
    await this.saveInjuryReport(report);
    
    // Emit alerts for significant changes
    if (this.isSignificantChange(previousReport, report)) {
      this.emit('injuryAlert', report);
      
      console.log(chalk.red.bold(`\n🚨 INJURY ALERT: ${report.playerName} (${report.team})`));
      console.log(chalk.yellow(`   Status: ${previousReport?.status || 'healthy'} → ${report.status}`));
      console.log(chalk.yellow(`   Impact: ${(report.fantasyImpact * 100).toFixed(0)}% reduction expected`));
      if (report.decodedMeaning) {
        console.log(chalk.cyan(`   Analysis: ${report.decodedMeaning}`));
      }
    }
  }
  
  /**
   * Analyze injury severity and fantasy impact
   */
  private analyzeInjury(report: InjuryReport): {
    severity: number;
    fantasyImpact: number;
    confidence: number;
  } {
    let severity = 0.5;
    let fantasyImpact = 0.5;
    let confidence = 0.7;
    
    // Status-based severity
    switch (report.status) {
      case 'out':
        severity = 1.0;
        fantasyImpact = 1.0;
        confidence = 1.0;
        break;
      case 'doubtful':
        severity = 0.8;
        fantasyImpact = 0.85;
        confidence = 0.9;
        break;
      case 'questionable':
        severity = 0.5;
        fantasyImpact = 0.4;
        confidence = 0.6;
        break;
      case 'probable':
        severity = 0.3;
        fantasyImpact = 0.15;
        confidence = 0.8;
        break;
    }
    
    // Practice status modifier
    if (report.practiceStatus) {
      switch (report.practiceStatus) {
        case 'dnp':
          severity *= 1.3;
          fantasyImpact *= 1.2;
          break;
        case 'limited':
          severity *= 1.1;
          fantasyImpact *= 1.05;
          break;
        case 'full':
          severity *= 0.7;
          fantasyImpact *= 0.6;
          confidence += 0.1;
          break;
      }
    }
    
    // Find matching injury pattern
    const pattern = INJURY_PATTERNS.find(p => 
      p.injuryType === report.injuryType && 
      p.position === report.position
    );
    
    if (pattern) {
      // Adjust based on historical data
      fantasyImpact = fantasyImpact * pattern.performanceImpact.immediate;
      confidence = Math.min(0.95, confidence + 0.1);
    }
    
    // Position importance modifier
    const positionImportance: Record<string, number> = {
      'QB': 1.0,
      'RB': 0.9,
      'WR': 0.8,
      'TE': 0.7,
      'K': 0.6,
      'DEF': 0.5,
      'C': 0.85,  // NBA
      'PG': 0.9,  // NBA
      'SP': 1.0,  // MLB
      'RP': 0.7   // MLB
    };
    
    const importance = positionImportance[report.position] || 0.7;
    fantasyImpact *= importance;
    
    // Normalize values
    severity = Math.min(1, Math.max(0, severity));
    fantasyImpact = Math.min(1, Math.max(0, fantasyImpact));
    confidence = Math.min(1, Math.max(0, confidence));
    
    return { severity, fantasyImpact, confidence };
  }
  
  /**
   * Decode coach speak using GPT
   */
  private async decodeCoachSpeak(quote: string, context: InjuryReport): Promise<string> {
    if (!this.openai) return this.simpleCoachSpeakDecode(quote);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are an expert at decoding NFL/NBA coach speak about injuries. Provide realistic probability of player playing and expected performance impact.'
        }, {
          role: 'user',
          content: `Coach quote: "${quote}"\nPlayer: ${context.playerName}\nInjury: ${context.injuryType}\nStatus: ${context.status}\n\nWhat does this really mean?`
        }],
        temperature: 0.3,
        max_tokens: 100
      });
      
      return response.choices[0]?.message?.content || this.simpleCoachSpeakDecode(quote);
    } catch (error) {
      return this.simpleCoachSpeakDecode(quote);
    }
  }
  
  /**
   * Simple coach speak decoder without GPT
   */
  private simpleCoachSpeakDecode(quote: string): string {
    const lowerQuote = quote.toLowerCase();
    
    for (const pattern of COACH_SPEAK_PATTERNS) {
      if (lowerQuote.includes(pattern.phrase)) {
        return `${pattern.meaning} (${(pattern.probability * 100).toFixed(0)}% chance to play)`;
      }
    }
    
    return 'Uncertain outlook';
  }
  
  /**
   * Get previous injury status for comparison
   */
  private async getPreviousInjuryStatus(playerId: string): Promise<InjuryReport | null> {
    const query = `
      SELECT * FROM injury_reports
      WHERE player_id = $1
      ORDER BY report_date DESC
      LIMIT 1
    `;
    
    const result = await pgPool.query(query, [playerId]);
    return result.rows[0] || null;
  }
  
  /**
   * Check if injury change is significant
   */
  private isSignificantChange(previous: InjuryReport | null, current: InjuryReport): boolean {
    if (!previous) return current.status !== 'healthy';
    
    const statusRank: Record<string, number> = {
      'healthy': 0,
      'probable': 1,
      'questionable': 2,
      'doubtful': 3,
      'out': 4,
      'ir': 5
    };
    
    const previousRank = statusRank[previous.status] || 0;
    const currentRank = statusRank[current.status] || 0;
    
    // Significant if moved 2+ levels or went to out/ir
    return Math.abs(currentRank - previousRank) >= 2 || currentRank >= 4;
  }
  
  /**
   * Save injury report to database
   */
  private async saveInjuryReport(report: InjuryReport): Promise<void> {
    const query = `
      INSERT INTO injury_reports (
        player_id, player_name, team, sport, position,
        injury_type, body_part, status, previous_status,
        practice_status, timeline, severity, fantasy_impact,
        confidence, source, source_url, coach_speak,
        decoded_meaning, notes, report_date, last_update
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (player_id, report_date) DO UPDATE SET
        status = $8,
        practice_status = $10,
        timeline = $11,
        severity = $12,
        fantasy_impact = $13,
        confidence = $14,
        coach_speak = $17,
        decoded_meaning = $18,
        notes = $19,
        last_update = $21
    `;
    
    await pgPool.query(query, [
      report.playerId,
      report.playerName,
      report.team,
      report.sport,
      report.position,
      report.injuryType,
      report.bodyPart,
      report.status,
      report.previousStatus,
      report.practiceStatus,
      report.timeline,
      report.severity,
      report.fantasyImpact,
      report.confidence,
      report.source,
      report.sourceUrl,
      report.coachSpeak,
      report.decodedMeaning,
      report.notes,
      report.reportDate || new Date(),
      new Date()
    ]);
  }
  
  /**
   * Update fantasy impacts based on injuries
   */
  private async updateFantasyImpacts(): Promise<void> {
    // Update projected points based on injury status
    const query = `
      UPDATE player_projections pp
      SET injury_adjusted_points = 
        CASE 
          WHEN ir.status = 'out' THEN 0
          WHEN ir.status = 'doubtful' THEN projected_points * 0.15
          WHEN ir.status = 'questionable' THEN projected_points * 0.60
          WHEN ir.status = 'probable' THEN projected_points * 0.85
          ELSE projected_points
        END,
        injury_discount = 1 - ir.fantasy_impact
      FROM injury_reports ir
      WHERE pp.player_id = ir.player_id
      AND ir.report_date >= CURRENT_DATE
    `;
    
    await pgPool.query(query);
  }
  
  /**
   * Analyze coach quotes from press conferences
   */
  private async analyzeCoachQuotes(): Promise<void> {
    // This would analyze recent coach quotes about injuries
    console.log(chalk.gray('Analyzing coach quotes...'));
  }
  
  /**
   * Find player ID
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
   * MOCK: Get latest injury report for a player
   */
  async getLatestInjuryReport(playerId: string): Promise<{
    risk: number;
    status: string;
    injuryType?: string;
    timeline?: string;
    fantasyImpact: number;
    confidence: number;
  }> {
    // Mock injury data for testing
    const statuses = ['healthy', 'probable', 'questionable', 'doubtful', 'out'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    const injuryTypes = ['hamstring', 'ankle', 'knee', 'shoulder', 'concussion', 'rest'];
    const injuryType = status !== 'healthy' ? injuryTypes[Math.floor(Math.random() * injuryTypes.length)] : undefined;
    
    let risk = 0;
    let fantasyImpact = 0;
    
    switch (status) {
      case 'out':
        risk = 1.0;
        fantasyImpact = 1.0;
        break;
      case 'doubtful':
        risk = 0.8;
        fantasyImpact = 0.7;
        break;
      case 'questionable':
        risk = 0.4;
        fantasyImpact = 0.3;
        break;
      case 'probable':
        risk = 0.2;
        fantasyImpact = 0.1;
        break;
      default:
        risk = 0.05;
        fantasyImpact = 0.0;
    }
    
    return {
      risk,
      status,
      injuryType,
      timeline: status !== 'healthy' ? 'day-to-day' : undefined,
      fantasyImpact,
      confidence: 0.8
    };
  }

  /**
   * Get current injury report for a player
   */ 
  async getPlayerInjuryStatus(playerId: string): Promise<InjuryReport | null> {
    const query = `
      SELECT * FROM injury_reports
      WHERE player_id = $1
      AND report_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY report_date DESC
      LIMIT 1
    `;
    
    const result = await pgPool.query(query, [playerId]);
    return result.rows[0] || null;
  }
  
  /**
   * Get all injured players for a sport
   */
  async getInjuredPlayers(sport: string, minFantasyImpact: number = 0.2): Promise<InjuryReport[]> {
    const query = `
      SELECT DISTINCT ON (player_id) *
      FROM injury_reports
      WHERE sport = $1
      AND status != 'healthy'
      AND fantasy_impact >= $2
      AND report_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY player_id, report_date DESC
    `;
    
    const result = await pgPool.query(query, [sport, minFantasyImpact]);
    return result.rows;
  }
  
  /**
   * Get injury risk score for a player
   */
  async getInjuryRisk(playerId: string): Promise<{
    currentRisk: number;
    historicalInjuries: number;
    lastInjury?: Date;
    reinjuryProbability: number;
  }> {
    // Get injury history
    const historyQuery = `
      SELECT 
        COUNT(*) as total_injuries,
        MAX(report_date) as last_injury,
        AVG(severity) as avg_severity
      FROM injury_reports
      WHERE player_id = $1
      AND status != 'healthy'
      AND report_date >= CURRENT_DATE - INTERVAL '365 days'
    `;
    
    const history = await pgPool.query(historyQuery, [playerId]);
    const { total_injuries, last_injury, avg_severity } = history.rows[0];
    
    // Calculate risk
    let currentRisk = 0.1; // Base risk
    
    // Recent injury modifier
    if (last_injury) {
      const daysSinceInjury = (Date.now() - new Date(last_injury).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceInjury < 30) currentRisk += 0.3;
      else if (daysSinceInjury < 60) currentRisk += 0.2;
      else if (daysSinceInjury < 90) currentRisk += 0.1;
    }
    
    // Injury frequency modifier
    currentRisk += Math.min(0.3, total_injuries * 0.1);
    
    // Severity modifier
    currentRisk += (avg_severity || 0) * 0.2;
    
    // Calculate reinjury probability
    const reinjuryProbability = Math.min(0.5, currentRisk * 1.5);
    
    return {
      currentRisk: Math.min(1, currentRisk),
      historicalInjuries: total_injuries || 0,
      lastInjury: last_injury ? new Date(last_injury) : undefined,
      reinjuryProbability
    };
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      console.log(chalk.yellow('Injury monitoring stopped'));
    }
  }
}

// Create injury tables
async function createInjuryTables() {
  const queries = [
    `
    CREATE TABLE IF NOT EXISTS injury_reports (
      id SERIAL PRIMARY KEY,
      player_id VARCHAR(100) NOT NULL,
      player_name VARCHAR(255) NOT NULL,
      team VARCHAR(10) NOT NULL,
      sport VARCHAR(10) NOT NULL,
      position VARCHAR(10) NOT NULL,
      injury_type VARCHAR(100),
      body_part VARCHAR(50),
      status VARCHAR(20) NOT NULL,
      previous_status VARCHAR(20),
      practice_status VARCHAR(20),
      timeline VARCHAR(50),
      severity DECIMAL(3,2),
      fantasy_impact DECIMAL(3,2),
      confidence DECIMAL(3,2),
      source VARCHAR(100),
      source_url TEXT,
      coach_speak TEXT,
      decoded_meaning TEXT,
      notes TEXT,
      report_date DATE NOT NULL,
      last_update TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(player_id, report_date)
    );
    `,
    `
    CREATE INDEX idx_injury_player_date ON injury_reports(player_id, report_date DESC);
    CREATE INDEX idx_injury_sport_status ON injury_reports(sport, status);
    CREATE INDEX idx_injury_impact ON injury_reports(fantasy_impact DESC);
    CREATE INDEX idx_injury_recent ON injury_reports(report_date DESC);
    `,
    `
    CREATE TABLE IF NOT EXISTS player_projections (
      player_id VARCHAR(100) PRIMARY KEY,
      projected_points DECIMAL(6,2),
      injury_adjusted_points DECIMAL(6,2),
      injury_discount DECIMAL(3,2) DEFAULT 1.0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `
  ];
  
  for (const query of queries) {
    try {
      await pgPool.query(query);
    } catch (error) {
      console.log(chalk.gray('Table might already exist'));
    }
  }
  
  console.log(chalk.green('✅ Injury tables created'));
}

// Test the injury monitoring system
async function testInjuryMonitoring() {
  console.log(chalk.cyan.bold('\n🏥 TESTING INJURY MONITORING SYSTEM\n'));
  
  // Create tables
  await createInjuryTables();
  
  // Initialize system
  const injurySystem = new InjuryMonitoringSystem();
  
  // Listen for alerts
  injurySystem.on('injuryAlert', (report: InjuryReport) => {
    console.log(chalk.red.bold('\n🚨 INJURY ALERT:'));
    console.log(`   Player: ${report.playerName} (${report.team})`);
    console.log(`   Status: ${report.previousStatus} → ${report.status}`);
    console.log(`   Fantasy Impact: -${(report.fantasyImpact * 100).toFixed(0)}%`);
    if (report.decodedMeaning) {
      console.log(`   Analysis: ${report.decodedMeaning}`);
    }
  });
  
  // Start monitoring
  await injurySystem.startMonitoring();
  
  // Test injury risk calculation
  setTimeout(async () => {
    console.log(chalk.cyan('\n📊 Injury Risk Examples:'));
    
    const testPlayers = ['NFL_Patrick_Mahomes', 'NFL_Christian_McCaffrey'];
    for (const playerId of testPlayers) {
      const risk = await injurySystem.getInjuryRisk(playerId);
      console.log(`\n${playerId}:`);
      console.log(`   Current Risk: ${(risk.currentRisk * 100).toFixed(0)}%`);
      console.log(`   Historical Injuries: ${risk.historicalInjuries}`);
      console.log(`   Reinjury Probability: ${(risk.reinjuryProbability * 100).toFixed(0)}%`);
    }
    
    // Get all injured players
    const injured = await injurySystem.getInjuredPlayers('NFL');
    console.log(chalk.yellow(`\n📋 Currently injured NFL players: ${injured.length}`));
    
    injurySystem.stopMonitoring();
    await pgPool.end();
  }, 5000);
}

// Export for use in other modules
export { InjuryReport, PracticeReport, createInjuryTables };

// Run if called directly
if (require.main === module) {
  testInjuryMonitoring();
}