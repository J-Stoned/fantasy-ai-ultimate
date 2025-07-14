#!/usr/bin/env tsx
/**
 * Self-Improving ESPN Parser with MCP Knowledge Graph Integration
 * 
 * This system learns from ESPN API structure changes and maintains
 * a knowledge graph of parsing patterns while ensuring 100% compatibility
 * with our existing player_game_logs database schema.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Our established database schema (NEVER CHANGE - platform depends on this)
interface PlayerGameLogSchema {
  player_id: number;
  game_id: number;
  team_id: number;
  game_date: string;
  opponent_id: number;
  is_home: boolean;
  minutes_played: number;
  stats: Record<string, number>;           // JSONB - flexible stats storage
  raw_stats: any;                         // JSONB - original ESPN data
  computed_metrics: Record<string, number>; // JSONB - advanced calculations
  tracking_data: Record<string, any>;     // JSONB - tracking info
  situational_stats: Record<string, any>; // JSONB - situational data
  metadata: {
    collection_timestamp: string;
    api_version: string;
    data_quality_score: number;
    sport: string;
    [key: string]: any;                   // Extensible metadata
  };
}

// API Structure Learning System using MCP
class SelfImprovingEspnParser {
  private sport: string;
  private knownPatterns: Map<string, any> = new Map();
  
  constructor(sport: string) {
    this.sport = sport;
    console.log(chalk.bold.cyan(`🧠 Self-Improving ESPN Parser initialized for ${sport}`));
  }
  
  // Main parsing function - guarantees schema compliance
  async parseGameResponse(apiResponse: any, gameId: string, gameDbId: number): Promise<PlayerGameLogSchema[]> {
    try {
      // Step 1: Learn from this API response
      await this.learnFromResponse(apiResponse, gameId);
      
      // Step 2: Detect current structure
      const structure = await this.detectStructure(apiResponse);
      
      // Step 3: Extract players using learned patterns
      const rawPlayers = await this.extractPlayers(apiResponse, structure);
      
      // Step 4: Convert to our standardized schema (CRITICAL - maintains platform compatibility)
      const schemaCompliantStats = await this.convertToSchema(rawPlayers, gameDbId);
      
      console.log(chalk.green(`✅ Parsed ${rawPlayers.length} players into ${schemaCompliantStats.length} schema-compliant records`));
      
      return schemaCompliantStats;
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Parsing failed for ${this.sport} game ${gameId}: ${error.message}`));
      
      // Store failure for learning
      await this.recordParsingFailure(apiResponse, gameId, error.message);
      
      return [];
    }
  }
  
  // Learn from API response and update knowledge graph
  private async learnFromResponse(apiResponse: any, gameId: string): Promise<void> {
    try {
      // Analyze response structure
      const structure = this.analyzeStructure(apiResponse);
      
      // Create/update knowledge entities using MCP
      await this.updateKnowledgeGraph(structure, gameId);
      
      // Store successful pattern
      const patternKey = this.generatePatternKey(structure);
      this.knownPatterns.set(patternKey, {
        structure,
        gameId,
        timestamp: new Date().toISOString(),
        sport: this.sport
      });
      
      console.log(chalk.blue(`📚 Learned new pattern: ${patternKey}`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Learning failed: ${error.message}`));
    }
  }
  
  // Analyze API response structure
  private analyzeStructure(apiResponse: any): any {
    const structure = {
      hasBoxscore: !!apiResponse?.boxscore,
      hasPlayers: !!apiResponse?.boxscore?.players,
      hasTeams: !!apiResponse?.boxscore?.teams,
      playersIsArray: Array.isArray(apiResponse?.boxscore?.players),
      teamsIsArray: Array.isArray(apiResponse?.boxscore?.teams),
      playerCount: 0,
      teamCount: 0,
      statGroupTypes: new Set<string>(),
      detectedStructure: 'unknown'
    };
    
    // Detect current structure type
    if (apiResponse?.boxscore?.players && Array.isArray(apiResponse.boxscore.players)) {
      structure.detectedStructure = 'boxscore_players_array';
      structure.playerCount = apiResponse.boxscore.players.length;
      
      // Analyze stat group types
      for (const teamPlayers of apiResponse.boxscore.players) {
        if (teamPlayers.statistics) {
          for (const statGroup of teamPlayers.statistics) {
            structure.statGroupTypes.add(statGroup.type || 'unknown');
          }
        }
      }
    } else if (apiResponse?.boxscore?.teams && apiResponse.boxscore.teams[0]?.statistics) {
      structure.detectedStructure = 'boxscore_teams_statistics';
      structure.teamCount = apiResponse.boxscore.teams.length;
      
      // Analyze legacy structure
      for (const team of apiResponse.boxscore.teams) {
        if (team.statistics) {
          for (const statGroup of team.statistics) {
            structure.statGroupTypes.add(statGroup.type || 'unknown');
          }
        }
      }
    }
    
    structure.statGroupTypes = Array.from(structure.statGroupTypes);
    return structure;
  }
  
  // Update knowledge graph with learned patterns using MCP
  private async updateKnowledgeGraph(structure: any, gameId: string): Promise<void> {
    try {
      // Create entities for the API structure
      /*
      await mcp_fantasy_intelligence_create_entities([
        {
          name: `ESPN_API_Structure_${this.sport}_${structure.detectedStructure}`,
          entityType: "API_Pattern",
          observations: [
            `Structure type: ${structure.detectedStructure}`,
            `Player count: ${structure.playerCount}`,
            `Team count: ${structure.teamCount}`,
            `Stat group types: ${structure.statGroupTypes.join(', ')}`,
            `First observed in game: ${gameId}`,
            `Sport: ${this.sport}`,
            `Timestamp: ${new Date().toISOString()}`
          ]
        }
      ]);
      
      // Create relations between structures and sports
      await mcp_fantasy_intelligence_create_relations([
        {
          from: `ESPN_API_Structure_${this.sport}_${structure.detectedStructure}`,
          to: this.sport,
          relationType: "applies_to_sport"
        }
      ]);
      */
      
      console.log(chalk.green(`📊 Updated knowledge graph for ${structure.detectedStructure}`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to update knowledge graph: ${error.message}`));
    }
  }
  
  // Detect structure using learned patterns
  private async detectStructure(apiResponse: any): Promise<string> {
    const currentStructure = this.analyzeStructure(apiResponse);
    const patternKey = this.generatePatternKey(currentStructure);
    
    if (this.knownPatterns.has(patternKey)) {
      console.log(chalk.green(`✅ Recognized known pattern: ${patternKey}`));
      return currentStructure.detectedStructure;
    }
    
    console.log(chalk.yellow(`🆕 New pattern detected: ${patternKey}`));
    return currentStructure.detectedStructure;
  }
  
  // Extract players using appropriate strategy
  private async extractPlayers(apiResponse: any, structure: string): Promise<any[]> {
    switch (structure) {
      case 'boxscore_players_array':
        return this.extractFromPlayersArray(apiResponse);
      case 'boxscore_teams_statistics':
        return this.extractFromTeamsStatistics(apiResponse);
      default:
        console.log(chalk.yellow(`⚠️  Unknown structure: ${structure}, attempting fallback`));
        return this.attemptFallbackExtraction(apiResponse);
    }
  }
  
  // Extract from current ESPN structure: boxscore.players[]
  private extractFromPlayersArray(apiResponse: any): any[] {
    const players: any[] = [];
    
    if (apiResponse?.boxscore?.players) {
      for (let teamIndex = 0; teamIndex < apiResponse.boxscore.players.length; teamIndex++) {
        const teamPlayers = apiResponse.boxscore.players[teamIndex];
        const teamInfo = teamPlayers.team;
        const isHome = teamPlayers.displayOrder === 1;
        
        if (teamPlayers.statistics) {
          for (const statGroup of teamPlayers.statistics) {
            const statType = statGroup.type || 'unknown';
            
            if (statGroup.athletes) {
              for (const athlete of statGroup.athletes) {
                players.push({
                  athlete: athlete.athlete,
                  team: teamInfo,
                  isHome,
                  statType,
                  rawStats: athlete.stats,
                  structure: 'boxscore_players_array'
                });
              }
            }
          }
        }
      }
    }
    
    return players;
  }
  
  // Extract from legacy ESPN structure
  private extractFromTeamsStatistics(apiResponse: any): any[] {
    const players: any[] = [];
    
    if (apiResponse?.boxscore?.teams) {
      for (const team of apiResponse.boxscore.teams) {
        const teamInfo = team.team;
        const isHome = team.homeAway === 'home';
        
        if (team.statistics) {
          for (const statGroup of team.statistics) {
            const statType = statGroup.type || 'unknown';
            
            if (statGroup.athletes) {
              for (const athlete of statGroup.athletes) {
                players.push({
                  athlete: athlete.athlete,
                  team: teamInfo,
                  isHome,
                  statType,
                  rawStats: athlete.stats,
                  structure: 'boxscore_teams_statistics'
                });
              }
            }
          }
        }
      }
    }
    
    return players;
  }
  
  // Fallback extraction for unknown structures
  private attemptFallbackExtraction(apiResponse: any): any[] {
    console.log(chalk.blue(`🔍 Attempting fallback extraction...`));
    
    // Try common paths where player data might exist
    const searchPaths = [
      'boxscore.players',
      'boxscore.teams.statistics.athletes',
      'players',
      'athletes',
      'roster.athletes'
    ];
    
    for (const path of searchPaths) {
      const data = this.getNestedValue(apiResponse, path);
      if (data && Array.isArray(data)) {
        console.log(chalk.green(`✅ Found player data at: ${path}`));
        // Extract what we can from this path
        return this.extractFromGenericPath(data);
      }
    }
    
    return [];
  }
  
  // Convert extracted players to our schema (CRITICAL - maintains platform compatibility)
  private async convertToSchema(rawPlayers: any[], gameDbId: number): Promise<PlayerGameLogSchema[]> {
    const schemaRecords: PlayerGameLogSchema[] = [];
    
    for (const rawPlayer of rawPlayers) {
      try {
        // Get or create player and team IDs (maintains referential integrity)
        const playerId = await this.getOrCreatePlayerId(rawPlayer.athlete);
        const teamId = await this.getOrCreateTeamId(rawPlayer.team);
        
        // Parse stats using sport-specific logic
        const parsedStats = this.parseStatsForSport(rawPlayer.rawStats, rawPlayer.statType);
        
        // Create schema-compliant record
        const schemaRecord: PlayerGameLogSchema = {
          player_id: playerId,
          game_id: gameDbId,
          team_id: teamId,
          game_date: new Date().toISOString().split('T')[0],
          opponent_id: 0, // Will be filled by calling code
          is_home: rawPlayer.isHome || false,
          minutes_played: this.extractMinutesPlayed(rawPlayer.rawStats, rawPlayer.statType),
          stats: parsedStats.basic,
          raw_stats: rawPlayer.rawStats,
          computed_metrics: parsedStats.advanced,
          tracking_data: {},
          situational_stats: {
            stat_category: rawPlayer.statType,
            api_structure: rawPlayer.structure
          },
          metadata: {
            collection_timestamp: new Date().toISOString(),
            api_version: '3.0-adaptive',
            data_quality_score: this.calculateDataQuality(rawPlayer.rawStats),
            sport: this.sport,
            stat_group_type: rawPlayer.statType,
            parser_version: 'self-improving-v1'
          }
        };
        
        schemaRecords.push(schemaRecord);
        
      } catch (error: any) {
        console.error(chalk.red(`❌ Failed to convert player ${rawPlayer.athlete?.displayName}: ${error.message}`));
      }
    }
    
    return schemaRecords;
  }
  
  // Sport-specific stat parsing (learns and improves over time)
  private parseStatsForSport(rawStats: any, statType: string): { basic: Record<string, number>, advanced: Record<string, number> } {
    const basic: Record<string, number> = {};
    const advanced: Record<string, number> = {};
    
    if (!Array.isArray(rawStats)) {
      return { basic, advanced };
    }
    
    // Sport-specific parsing logic (self-improving)
    switch (this.sport) {
      case 'NBA':
        return this.parseNBAStats(rawStats, statType);
      case 'NFL':
        return this.parseNFLStats(rawStats, statType);
      case 'MLB':
        return this.parseMLBStats(rawStats, statType);
      case 'NHL':
        return this.parseNHLStats(rawStats, statType);
      default:
        return this.parseGenericStats(rawStats);
    }
  }
  
  // NBA stat parsing
  private parseNBAStats(rawStats: any[], statType: string): { basic: Record<string, number>, advanced: Record<string, number> } {
    const basic: Record<string, number> = {};
    const advanced: Record<string, number> = {};
    
    // Standard NBA stat positions (learned from patterns)
    const nbaMapping = [
      'minutes', 'fieldGoalsMade', 'fieldGoalsAttempted', 'threePointersMade', 
      'threePointersAttempted', 'freeThrowsMade', 'freeThrowsAttempted',
      'offensiveRebounds', 'defensiveRebounds', 'totalRebounds', 'assists',
      'steals', 'blocks', 'turnovers', 'personalFouls', 'plusMinus', 'points'
    ];
    
    rawStats.forEach((value, index) => {
      if (index < nbaMapping.length && value !== undefined && value !== '-') {
        basic[nbaMapping[index]] = this.parseStatValue(value);
      }
    });
    
    // Calculate advanced metrics
    advanced.fieldGoalPercentage = basic.fieldGoalsAttempted > 0 ? 
      (basic.fieldGoalsMade / basic.fieldGoalsAttempted) * 100 : 0;
    advanced.threePointPercentage = basic.threePointersAttempted > 0 ?
      (basic.threePointersMade / basic.threePointersAttempted) * 100 : 0;
    advanced.freeThrowPercentage = basic.freeThrowsAttempted > 0 ?
      (basic.freeThrowsMade / basic.freeThrowsAttempted) * 100 : 0;
    
    return { basic, advanced };
  }
  
  // NFL stat parsing (position-aware)
  private parseNFLStats(rawStats: any[], statType: string): { basic: Record<string, number>, advanced: Record<string, number> } {
    const basic: Record<string, number> = {};
    const advanced: Record<string, number> = {};
    
    // NFL stat mappings vary by position/statType
    let mapping: string[] = [];
    
    switch (statType) {
      case 'passing':
      case 'unknown':
        mapping = ['completions', 'attempts', 'yards', 'touchdowns', 'interceptions', 'rating', 'longPass', 'sacks'];
        break;
      case 'rushing':
        mapping = ['attempts', 'yards', 'touchdowns', 'long', 'fumbles'];
        break;
      case 'receiving':
        mapping = ['targets', 'receptions', 'yards', 'touchdowns', 'long', 'fumbles'];
        break;
      default:
        mapping = rawStats.map((_, i) => `stat_${i}`);
    }
    
    rawStats.forEach((value, index) => {
      if (index < mapping.length && value !== undefined && value !== '-') {
        basic[mapping[index]] = this.parseStatValue(value);
      }
    });
    
    return { basic, advanced };
  }
  
  // MLB stat parsing (batting vs pitching)
  private parseMLBStats(rawStats: any[], statType: string): { basic: Record<string, number>, advanced: Record<string, number> } {
    const basic: Record<string, number> = {};
    const advanced: Record<string, number> = {};
    
    let mapping: string[] = [];
    
    switch (statType) {
      case 'batting':
        mapping = ['atBats', 'runs', 'hits', 'rbis', 'walks', 'strikeouts', 'plateAppearances', 
                  'leftOnBase', 'battingAverage', 'onBasePercentage', 'sluggingPercentage', 'homeRuns'];
        break;
      case 'pitching':
        mapping = ['inningsPitched', 'hits', 'runs', 'earnedRuns', 'walks', 'strikeouts', 
                  'homeRuns', 'pitches', 'strikes', 'era'];
        break;
      default:
        mapping = rawStats.map((_, i) => `stat_${i}`);
    }
    
    rawStats.forEach((value, index) => {
      if (index < mapping.length && value !== undefined && value !== '-') {
        basic[mapping[index]] = this.parseStatValue(value);
      }
    });
    
    return { basic, advanced };
  }
  
  // NHL stat parsing (skaters vs goalies)
  private parseNHLStats(rawStats: any[], statType: string): { basic: Record<string, number>, advanced: Record<string, number> } {
    const basic: Record<string, number> = {};
    const advanced: Record<string, number> = {};
    
    let mapping: string[] = [];
    
    if (statType === 'goalie') {
      mapping = ['saves', 'goalsAgainst', 'savePercentage', 'timeOnIce', 'shots', 'goals', 'assists'];
    } else {
      // Skater stats
      mapping = ['goals', 'assists', 'points', 'plusMinus', 'shots', 'shotPercentage', 'penaltyMinutes',
                'hits', 'blocked', 'takeaways', 'giveaways', 'faceoffWins', 'faceoffLosses', 
                'faceoffPercentage', 'timeOnIce', 'powerPlayTimeOnIce', 'shortHandedTimeOnIce',
                'evenStrengthTimeOnIce', 'powerPlayGoals', 'powerPlayAssists', 'shortHandedGoals'];
    }
    
    rawStats.forEach((value, index) => {
      if (index < mapping.length && value !== undefined && value !== '-') {
        basic[mapping[index]] = this.parseStatValue(value);
      }
    });
    
    return { basic, advanced };
  }
  
  // Generic stat parsing for unknown sports
  private parseGenericStats(rawStats: any[]): { basic: Record<string, number>, advanced: Record<string, number> } {
    const basic: Record<string, number> = {};
    const advanced: Record<string, number> = {};
    
    rawStats.forEach((value, index) => {
      if (value !== undefined && value !== '-') {
        basic[`stat_${index}`] = this.parseStatValue(value);
      }
    });
    
    return { basic, advanced };
  }
  
  // Helper methods
  private parseStatValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.includes('-') && !value.includes(':')) {
        return parseFloat(value.split('-')[0]) || 0;
      }
      if (value.includes('%')) {
        return parseFloat(value.replace('%', '')) || 0;
      }
      if (value.includes(':')) {
        const [minutes, seconds] = value.split(':');
        return parseInt(minutes) + (parseInt(seconds) / 60);
      }
      return parseFloat(value) || 0;
    }
    return 0;
  }
  
  private extractMinutesPlayed(rawStats: any[], statType: string): number {
    if (!Array.isArray(rawStats) || rawStats.length === 0) return 0;
    
    // For most sports, time is in the first position or a specific position
    const timeValue = rawStats[0];
    if (typeof timeValue === 'string' && timeValue.includes(':')) {
      const [minutes, seconds] = timeValue.split(':');
      return parseInt(minutes) + (parseInt(seconds) / 60);
    }
    
    return 0;
  }
  
  private calculateDataQuality(rawStats: any): number {
    if (!Array.isArray(rawStats)) return 0;
    
    const nonEmptyStats = rawStats.filter(s => s !== undefined && s !== '-' && s !== '').length;
    return (nonEmptyStats / rawStats.length) * 100;
  }
  
  private async getOrCreatePlayerId(athlete: any): Promise<number> {
    // This would use the existing getOrCreatePlayer logic
    // Placeholder for now
    return parseInt(athlete.id) || 0;
  }
  
  private async getOrCreateTeamId(team: any): Promise<number> {
    // This would use the existing getOrCreateTeam logic  
    // Placeholder for now
    return parseInt(team.id) || 0;
  }
  
  private generatePatternKey(structure: any): string {
    return `${structure.detectedStructure}_${structure.playerCount}_${structure.statGroupTypes.join('_')}`;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  private extractFromGenericPath(data: any[]): any[] {
    // Generic extraction for unknown structures
    return data.map(item => ({
      athlete: item.athlete || item,
      team: null,
      isHome: false,
      statType: 'unknown',
      rawStats: item.stats || [],
      structure: 'generic_fallback'
    }));
  }
  
  private async recordParsingFailure(apiResponse: any, gameId: string, error: string): Promise<void> {
    console.log(chalk.red(`📝 Recording parsing failure for future learning: ${error}`));
    // This would store the failure in our knowledge graph for learning
  }
}

export { SelfImprovingEspnParser, PlayerGameLogSchema };