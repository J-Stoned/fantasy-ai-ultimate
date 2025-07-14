#!/usr/bin/env tsx
/**
 * Adaptive ESPN API Parser - Intelligent Structure Detection
 * 
 * This system automatically detects and adapts to ESPN API structure changes
 * by analyzing response patterns and creating dynamic parsers for each sport.
 */

import chalk from 'chalk';

// Define the possible ESPN API response structures we've seen
interface EspnApiStructure {
  version: string;
  description: string;
  detection: (data: any) => boolean;
  playerDataPath: string[];
  teamDataPath: string[];
  parseFunction: string;
}

// Known ESPN API structures (extensible)
const KNOWN_STRUCTURES: EspnApiStructure[] = [
  {
    version: "3.0",
    description: "Current structure: boxscore.players[]",
    detection: (data) => data?.boxscore?.players && Array.isArray(data.boxscore.players),
    playerDataPath: ["boxscore", "players"],
    teamDataPath: ["boxscore", "players", "team"],
    parseFunction: "parsePlayersArrayStructure"
  },
  {
    version: "2.0", 
    description: "Legacy structure: boxscore.teams[].statistics[]",
    detection: (data) => data?.boxscore?.teams && 
                         data.boxscore.teams[0]?.statistics && 
                         data.boxscore.teams[0].statistics[0]?.athletes,
    playerDataPath: ["boxscore", "teams", "statistics", "athletes"],
    teamDataPath: ["boxscore", "teams"],
    parseFunction: "parseTeamsStatisticsStructure"
  },
  {
    version: "1.0",
    description: "Very old structure: direct athletes array",
    detection: (data) => data?.athletes && Array.isArray(data.athletes),
    playerDataPath: ["athletes"],
    teamDataPath: ["teams"],
    parseFunction: "parseDirectAthletesStructure"
  }
];

// Sport-specific stat mapping configurations
interface SportStatConfig {
  sport: string;
  statMappings: {
    [statType: string]: {
      arrayFormat?: { [index: number]: string };
      objectFormat?: { [key: string]: string };
      timeField?: string;
      keyStats: string[];
    };
  };
  standardizedFields: {
    [key: string]: (rawValue: any, statType?: string) => number;
  };
}

const SPORT_CONFIGS: SportStatConfig[] = [
  {
    sport: "NBA",
    statMappings: {
      "unknown": { // Default NBA stats
        arrayFormat: {
          0: "minutes",
          1: "fieldGoalsMade", 
          2: "fieldGoalsAttempted",
          3: "threePointersMade",
          4: "threePointersAttempted", 
          5: "freeThrowsMade",
          6: "freeThrowsAttempted",
          7: "offensiveRebounds",
          8: "defensiveRebounds", 
          9: "totalRebounds",
          10: "assists",
          11: "steals", 
          12: "blocks",
          13: "turnovers",
          14: "personalFouls",
          15: "plusMinus",
          16: "points"
        },
        timeField: "minutes",
        keyStats: ["points", "rebounds", "assists", "steals", "blocks"]
      }
    },
    standardizedFields: {
      "performance_score": (stats) => (stats.points || 0) + (stats.assists || 0) * 1.5 + (stats.totalRebounds || 0) * 1.2,
      "efficiency_rating": (stats) => stats.fieldGoalsAttempted > 0 ? (stats.fieldGoalsMade / stats.fieldGoalsAttempted) * 100 : 0,
      "usage_rate": (stats) => ((stats.fieldGoalsAttempted || 0) + (stats.turnovers || 0) + (stats.assists || 0)) / 10 * 100
    }
  },
  {
    sport: "NFL",
    statMappings: {
      "unknown": { // Passing stats
        arrayFormat: {
          0: "completions",
          1: "attempts", 
          2: "yards",
          3: "touchdowns",
          4: "interceptions",
          5: "rating",
          6: "longPass",
          7: "sacks"
        },
        keyStats: ["yards", "touchdowns", "completions", "attempts"]
      },
      "rushing": {
        arrayFormat: {
          0: "attempts",
          1: "yards",
          2: "touchdowns", 
          3: "long",
          4: "fumbles"
        },
        keyStats: ["yards", "attempts", "touchdowns"]
      },
      "receiving": {
        arrayFormat: {
          0: "targets",
          1: "receptions",
          2: "yards",
          3: "touchdowns",
          4: "long",
          5: "fumbles"
        },
        keyStats: ["receptions", "yards", "touchdowns", "targets"]
      }
    },
    standardizedFields: {
      "performance_score": (stats, statType) => {
        if (statType === "rushing") return (stats.yards || 0) * 0.1 + (stats.touchdowns || 0) * 6;
        if (statType === "receiving") return (stats.yards || 0) * 0.1 + (stats.receptions || 0) * 0.5 + (stats.touchdowns || 0) * 6;
        return (stats.yards || 0) * 0.04 + (stats.touchdowns || 0) * 4; // passing
      },
      "efficiency_rating": (stats, statType) => {
        if (statType === "rushing") return stats.attempts > 0 ? (stats.yards / stats.attempts) : 0;
        if (statType === "receiving") return stats.targets > 0 ? (stats.receptions / stats.targets) * 100 : 0;
        return stats.attempts > 0 ? (stats.completions / stats.attempts) * 100 : 0; // passing
      }
    }
  },
  {
    sport: "MLB", 
    statMappings: {
      "batting": {
        arrayFormat: {
          0: "atBats",
          1: "runs",
          2: "hits", 
          3: "rbis",
          4: "walks",
          5: "strikeouts",
          6: "plateAppearances",
          7: "leftOnBase",
          8: "battingAverage",
          9: "onBasePercentage",
          10: "sluggingPercentage",
          11: "homeRuns"
        },
        keyStats: ["hits", "runs", "rbis", "homeRuns", "atBats"]
      },
      "pitching": {
        arrayFormat: {
          0: "inningsPitched",
          1: "hits",
          2: "runs",
          3: "earnedRuns", 
          4: "walks",
          5: "strikeouts",
          6: "homeRuns",
          7: "pitches",
          8: "strikes",
          9: "era"
        },
        keyStats: ["inningsPitched", "earnedRuns", "strikeouts", "walks"]
      }
    },
    standardizedFields: {
      "performance_score": (stats, statType) => {
        if (statType === "batting") return (stats.hits || 0) + (stats.runs || 0) + (stats.rbis || 0) + (stats.homeRuns || 0) * 2;
        return (stats.inningsPitched || 0) * 3 + (stats.strikeouts || 0) - (stats.earnedRuns || 0) * 2; // pitching
      },
      "efficiency_rating": (stats, statType) => {
        if (statType === "batting") return stats.atBats > 0 ? (stats.hits / stats.atBats) * 1000 : 0; // batting average * 1000
        return stats.inningsPitched > 0 ? (stats.earnedRuns * 9) / stats.inningsPitched : 0; // ERA
      }
    }
  },
  {
    sport: "NHL",
    statMappings: {
      "unknown": { // Skater stats
        arrayFormat: {
          0: "goals",
          1: "assists", 
          2: "points",
          3: "plusMinus",
          4: "shots",
          5: "shotPercentage",
          6: "penaltyMinutes",
          7: "hits",
          8: "blocked",
          9: "takeaways",
          10: "giveaways",
          11: "faceoffWins",
          12: "faceoffLosses",
          13: "faceoffPercentage",
          14: "timeOnIce",
          15: "powerPlayTimeOnIce",
          16: "shortHandedTimeOnIce",
          17: "evenStrengthTimeOnIce",
          18: "powerPlayGoals",
          19: "powerPlayAssists",
          20: "shortHandedGoals"
        },
        timeField: "timeOnIce",
        keyStats: ["goals", "assists", "points", "shots", "hits"]
      },
      "goalie": {
        arrayFormat: {
          0: "saves",
          1: "goalsAgainst",
          2: "savePercentage", 
          3: "timeOnIce",
          4: "shots",
          5: "goals",
          6: "assists",
          7: "powerPlaySaves",
          8: "shortHandedSaves",
          9: "evenStrengthSaves",
          10: "powerPlayShotsAgainst",
          11: "shortHandedShotsAgainst"
        },
        timeField: "timeOnIce",
        keyStats: ["saves", "goalsAgainst", "savePercentage", "timeOnIce"]
      }
    },
    standardizedFields: {
      "performance_score": (stats, statType) => {
        if (statType === "goalie") return (stats.saves || 0) * 0.1 - (stats.goalsAgainst || 0) * 2;
        return (stats.goals || 0) * 3 + (stats.assists || 0) * 2 + (stats.shots || 0) * 0.1; // skater
      },
      "efficiency_rating": (stats, statType) => {
        if (statType === "goalie") return stats.shots > 0 ? (stats.saves / stats.shots) * 100 : 0; // save percentage
        return stats.shots > 0 ? (stats.goals / stats.shots) * 100 : 0; // shooting percentage
      }
    }
  }
];

class AdaptiveEspnParser {
  private detectedStructures: Map<string, EspnApiStructure> = new Map();
  private sportConfigs: Map<string, SportStatConfig> = new Map();
  
  constructor() {
    // Initialize sport configurations
    SPORT_CONFIGS.forEach(config => {
      this.sportConfigs.set(config.sport, config);
    });
    
    console.log(chalk.bold.cyan('🧠 Adaptive ESPN Parser initialized'));
    console.log(chalk.yellow(`📊 Loaded configurations for: ${Array.from(this.sportConfigs.keys()).join(', ')}`));
  }
  
  // Detect ESPN API structure for a response
  detectApiStructure(data: any): EspnApiStructure | null {
    for (const structure of KNOWN_STRUCTURES) {
      if (structure.detection(data)) {
        console.log(chalk.green(`✅ Detected API structure: ${structure.version} - ${structure.description}`));
        return structure;
      }
    }
    
    console.log(chalk.red('❌ Unknown API structure detected'));
    console.log(chalk.gray(`Available keys: ${data ? Object.keys(data).join(', ') : 'none'}`));
    
    // Try to auto-detect new structure
    return this.attemptAutoDetection(data);
  }
  
  // Attempt to automatically detect new structures
  private attemptAutoDetection(data: any): EspnApiStructure | null {
    console.log(chalk.yellow('🔍 Attempting auto-detection of new structure...'));
    
    // Look for common patterns
    const patterns = [
      { path: 'boxscore.players', check: (d: any) => d?.boxscore?.players },
      { path: 'boxscore.teams.statistics', check: (d: any) => d?.boxscore?.teams?.[0]?.statistics },
      { path: 'players', check: (d: any) => d?.players },
      { path: 'teams.players', check: (d: any) => d?.teams?.[0]?.players },
      { path: 'statistics.athletes', check: (d: any) => d?.statistics?.[0]?.athletes }
    ];
    
    for (const pattern of patterns) {
      if (pattern.check(data)) {
        console.log(chalk.blue(`🎯 Potential structure found: ${pattern.path}`));
        
        // Create dynamic structure
        const dynamicStructure: EspnApiStructure = {
          version: "auto-detected",
          description: `Auto-detected structure: ${pattern.path}`,
          detection: pattern.check,
          playerDataPath: pattern.path.split('.'),
          teamDataPath: pattern.path.split('.').slice(0, -1),
          parseFunction: "parseDynamicStructure"
        };
        
        return dynamicStructure;
      }
    }
    
    return null;
  }
  
  // Parse player stats using detected structure
  parsePlayerStats(data: any, sport: string, gameId: string): any[] {
    const structure = this.detectApiStructure(data);
    if (!structure) {
      console.log(chalk.red(`❌ Cannot parse stats for ${sport} game ${gameId} - unknown structure`));
      return [];
    }
    
    const sportConfig = this.sportConfigs.get(sport);
    if (!sportConfig) {
      console.log(chalk.red(`❌ No sport configuration found for ${sport}`));
      return [];
    }
    
    console.log(chalk.blue(`🎯 Parsing ${sport} stats using structure ${structure.version}`));
    
    // Route to appropriate parsing function
    switch (structure.parseFunction) {
      case "parsePlayersArrayStructure":
        return this.parsePlayersArrayStructure(data, sportConfig, structure);
      case "parseTeamsStatisticsStructure": 
        return this.parseTeamsStatisticsStructure(data, sportConfig, structure);
      case "parseDynamicStructure":
        return this.parseDynamicStructure(data, sportConfig, structure);
      default:
        console.log(chalk.red(`❌ Unknown parsing function: ${structure.parseFunction}`));
        return [];
    }
  }
  
  // Parse current ESPN structure: boxscore.players[]
  private parsePlayersArrayStructure(data: any, sportConfig: SportStatConfig, structure: EspnApiStructure): any[] {
    const stats: any[] = [];
    
    if (data?.boxscore?.players) {
      for (let teamIndex = 0; teamIndex < data.boxscore.players.length; teamIndex++) {
        const teamPlayers = data.boxscore.players[teamIndex];
        const teamInfo = teamPlayers.team;
        const isHome = teamPlayers.displayOrder === 1;
        
        console.log(chalk.green(`  🏀 Team ${teamIndex}: ${teamInfo.displayName} (${teamPlayers.statistics?.length || 0} stat groups)`));
        
        if (teamPlayers.statistics) {
          for (const statGroup of teamPlayers.statistics) {
            const statType = statGroup.type || 'unknown';
            console.log(chalk.yellow(`    📊 ${statType}: ${statGroup.athletes?.length || 0} athletes`));
            
            if (statGroup.athletes) {
              for (const athlete of statGroup.athletes) {
                const parsedStats = this.parseAthleteStats(
                  athlete.stats, 
                  statType, 
                  sportConfig
                );
                
                stats.push({
                  player: athlete.athlete,
                  team: teamInfo,
                  isHome,
                  statType,
                  rawStats: athlete.stats,
                  parsedStats,
                  metadata: {
                    structure: structure.version,
                    sport: sportConfig.sport,
                    parseTimestamp: new Date().toISOString()
                  }
                });
              }
            }
          }
        }
      }
    }
    
    return stats;
  }
  
  // Parse legacy ESPN structure: boxscore.teams[].statistics[]
  private parseTeamsStatisticsStructure(data: any, sportConfig: SportStatConfig, structure: EspnApiStructure): any[] {
    const stats: any[] = [];
    
    if (data?.boxscore?.teams) {
      for (const team of data.boxscore.teams) {
        const teamInfo = team.team;
        const isHome = team.homeAway === 'home';
        
        if (team.statistics) {
          for (const statGroup of team.statistics) {
            const statType = statGroup.type || 'unknown';
            
            if (statGroup.athletes) {
              for (const athlete of statGroup.athletes) {
                const parsedStats = this.parseAthleteStats(
                  athlete.stats,
                  statType,
                  sportConfig
                );
                
                stats.push({
                  player: athlete.athlete,
                  team: teamInfo,
                  isHome,
                  statType,
                  rawStats: athlete.stats,
                  parsedStats,
                  metadata: {
                    structure: structure.version,
                    sport: sportConfig.sport,
                    parseTimestamp: new Date().toISOString()
                  }
                });
              }
            }
          }
        }
      }
    }
    
    return stats;
  }
  
  // Parse dynamically detected structure
  private parseDynamicStructure(data: any, sportConfig: SportStatConfig, structure: EspnApiStructure): any[] {
    console.log(chalk.blue(`🔧 Parsing dynamic structure: ${structure.description}`));
    
    // This would implement logic to traverse the detected path
    // and extract player data regardless of structure
    const stats: any[] = [];
    
    // Navigate to player data using the detected path
    let currentData = data;
    for (const pathSegment of structure.playerDataPath) {
      if (currentData && currentData[pathSegment]) {
        currentData = currentData[pathSegment];
      } else {
        console.log(chalk.red(`❌ Path segment '${pathSegment}' not found in data`));
        return stats;
      }
    }
    
    // Try to extract player stats from whatever structure we found
    if (Array.isArray(currentData)) {
      for (const item of currentData) {
        if (item.athlete && item.stats) {
          const parsedStats = this.parseAthleteStats(item.stats, 'unknown', sportConfig);
          stats.push({
            player: item.athlete,
            team: null, // May not be available in dynamic structure
            isHome: false,
            statType: 'unknown',
            rawStats: item.stats,
            parsedStats,
            metadata: {
              structure: structure.version,
              sport: sportConfig.sport,
              parseTimestamp: new Date().toISOString()
            }
          });
        }
      }
    }
    
    return stats;
  }
  
  // Parse individual athlete stats based on sport configuration
  private parseAthleteStats(rawStats: any, statType: string, sportConfig: SportStatConfig): any {
    const statMapping = sportConfig.statMappings[statType] || sportConfig.statMappings['unknown'];
    if (!statMapping) {
      console.log(chalk.yellow(`⚠️  No stat mapping found for ${sportConfig.sport}:${statType}`));
      return { basic: {}, advanced: {}, standardized: {} };
    }
    
    const basic: any = {};
    const advanced: any = {};
    const standardized: any = {};
    
    // Parse based on whether stats are array or object format
    if (Array.isArray(rawStats) && statMapping.arrayFormat) {
      // Array format parsing
      for (const [index, statName] of Object.entries(statMapping.arrayFormat)) {
        const value = rawStats[parseInt(index)];
        if (value !== undefined && value !== '-' && value !== '') {
          basic[statName] = this.parseStatValue(value);
        }
      }
    } else if (typeof rawStats === 'object' && statMapping.objectFormat) {
      // Object format parsing
      for (const [key, statName] of Object.entries(statMapping.objectFormat)) {
        if (rawStats[key] !== undefined) {
          basic[statName] = this.parseStatValue(rawStats[key]);
        }
      }
    }
    
    // Calculate standardized fields
    for (const [fieldName, calculator] of Object.entries(sportConfig.standardizedFields)) {
      try {
        standardized[fieldName] = calculator(basic, statType);
      } catch (error) {
        console.log(chalk.red(`❌ Error calculating ${fieldName}: ${error.message}`));
        standardized[fieldName] = 0;
      }
    }
    
    return { basic, advanced, standardized };
  }
  
  // Parse stat value (handle different formats)
  private parseStatValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle fractions like "3-10"
      if (value.includes('-')) {
        const parts = value.split('-');
        return parseFloat(parts[0]) || 0;
      }
      // Handle percentages like "75.0%"
      if (value.includes('%')) {
        return parseFloat(value.replace('%', '')) || 0;
      }
      // Handle time like "32:15"
      if (value.includes(':')) {
        const [minutes, seconds] = value.split(':');
        return parseInt(minutes) + (parseInt(seconds) / 60);
      }
      // Regular number
      return parseFloat(value) || 0;
    }
    return 0;
  }
  
  // Get summary of parser capabilities
  getSummary(): any {
    return {
      supportedStructures: KNOWN_STRUCTURES.map(s => ({
        version: s.version,
        description: s.description
      })),
      supportedSports: Array.from(this.sportConfigs.keys()),
      detectedStructures: Array.from(this.detectedStructures.entries())
    };
  }
}

export { AdaptiveEspnParser, KNOWN_STRUCTURES, SPORT_CONFIGS };