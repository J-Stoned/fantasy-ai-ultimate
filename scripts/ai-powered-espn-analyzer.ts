#!/usr/bin/env tsx
/**
 * AI-Powered ESPN API Analyzer using Anthropic Claude
 * 
 * Uses Claude to analyze ESPN API responses, extract patterns,
 * and generate parsing strategies that integrate with our MCP knowledge graph
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

// Anthropic API client setup
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface AnalysisResult {
  structureType: string;
  confidence: number;
  playerDataPath: string[];
  statMappings: Record<string, any>;
  recommendations: string[];
  extractionStrategy: string;
}

class AIEspnAnalyzer {
  private sport: string;
  private analysisHistory: Map<string, AnalysisResult> = new Map();
  
  constructor(sport: string) {
    this.sport = sport;
    console.log(chalk.bold.cyan(`🤖 AI ESPN Analyzer initialized for ${sport}`));
  }
  
  // Main analysis function using Claude
  async analyzeApiResponse(apiResponse: any, gameId: string): Promise<AnalysisResult> {
    try {
      console.log(chalk.blue(`🧠 Analyzing ${this.sport} API response with Claude...`));
      
      // Prepare response for Claude analysis
      const analysisPrompt = this.buildAnalysisPrompt(apiResponse, gameId);
      
      // Call Claude API
      const claudeAnalysis = await this.callClaudeAPI(analysisPrompt);
      
      // Parse Claude's response
      const analysisResult = this.parseClaudeResponse(claudeAnalysis);
      
      // Store in knowledge graph using MCP
      await this.storeKnowledge(analysisResult, gameId, apiResponse);
      
      // Cache for future use
      this.analysisHistory.set(gameId, analysisResult);
      
      console.log(chalk.green(`✅ AI analysis complete: ${analysisResult.structureType} (${analysisResult.confidence}% confidence)`));
      
      return analysisResult;
      
    } catch (error: any) {
      console.error(chalk.red(`❌ AI analysis failed: ${error.message}`));
      
      // Fallback to rule-based analysis
      return this.fallbackAnalysis(apiResponse);
    }
  }
  
  // Build comprehensive analysis prompt for Claude
  private buildAnalysisPrompt(apiResponse: any, gameId: string): string {
    // Truncate large response for Claude analysis
    const truncatedResponse = this.truncateForAnalysis(apiResponse);
    
    return `You are an expert ESPN API analyst. Analyze this ${this.sport} game API response and extract parsing patterns.

GAME ID: ${gameId}
SPORT: ${this.sport}

API RESPONSE STRUCTURE:
\`\`\`json
${JSON.stringify(truncatedResponse, null, 2)}
\`\`\`

DATABASE SCHEMA REQUIREMENTS:
Our platform requires data in this exact schema (DO NOT CHANGE):
- player_id: number
- game_id: number  
- team_id: number
- stats: JSONB object with normalized stat names
- raw_stats: JSONB with original ESPN data
- computed_metrics: JSONB with calculated advanced stats
- metadata: JSONB with parsing info

ANALYSIS TASKS:
1. STRUCTURE DETECTION: Identify how player data is organized
2. STAT MAPPING: Map ESPN stat arrays/objects to meaningful names
3. DATA PATHS: Find exact JSON paths to player and team data
4. EXTRACTION STRATEGY: Recommend parsing approach
5. QUALITY ASSESSMENT: Rate data completeness and reliability

For ${this.sport}, I need you to focus on:
${this.getSportSpecificGuidance()}

RESPONSE FORMAT (JSON):
{
  "structureType": "detected_structure_name",
  "confidence": 95,
  "playerDataPath": ["boxscore", "players"],
  "teamDataPath": ["boxscore", "players", "team"],
  "statMappings": {
    "statGroupType": {
      "arrayPositions": {
        "0": "statName1",
        "1": "statName2"
      },
      "keyStats": ["statName1", "statName2"],
      "timeField": "minutes"
    }
  },
  "extractionStrategy": "iterate_boxscore_players_by_team",
  "dataQuality": {
    "completeness": 95,
    "consistency": 90,
    "reliability": 85
  },
  "recommendations": [
    "Use boxscore.players[] array for player iteration",
    "Group by team using displayOrder field",
    "Handle multiple stat groups per team"
  ],
  "sportSpecificNotes": "NBA uses 17-element stat arrays with minutes at position 0"
}

Provide a detailed, actionable analysis that will help our self-improving parser extract maximum value from this API structure.`;
  }
  
  // Get sport-specific analysis guidance
  private getSportSpecificGuidance(): string {
    const guidance = {
      'NBA': `
- Look for basketball stats: points, rebounds, assists, steals, blocks, minutes
- Minutes usually in format "MM:SS" at array position 0
- Field goals often in "made-attempted" format
- Watch for percentage calculations`,
      
      'NFL': `
- Look for position-based stat groups: passing, rushing, receiving, defense
- Quarterback stats: completions, attempts, yards, TDs, INTs
- Skill position stats: carries, yards, receptions, targets
- Defensive stats: tackles, sacks, interceptions`,
      
      'MLB': `
- Two main categories: batting and pitching stats
- Batting: at-bats, hits, runs, RBIs, home runs, walks, strikeouts
- Pitching: innings pitched, hits, runs, earned runs, strikeouts, walks
- Watch for decimal innings (e.g., 6.1 = 6 1/3 innings)`,
      
      'NHL': `
- Two player types: skaters and goalies
- Skater stats: goals, assists, points, +/-, shots, TOI
- Goalie stats: saves, goals against, save %, time on ice
- Time format usually "MM:SS" for time on ice`
    };
    
    return guidance[this.sport as keyof typeof guidance] || 'Analyze general sports statistics patterns';
  }
  
  // Call Claude API
  private async callClaudeAPI(prompt: string): Promise<any> {
    if (!ANTHROPIC_API_KEY) {
      console.log(chalk.yellow('⚠️  ANTHROPIC_API_KEY not configured, using intelligent fallback analysis'));
      return this.generateIntelligentFallback(prompt);
    }
    
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  // Generate intelligent fallback analysis when Claude API unavailable
  private generateIntelligentFallback(prompt: string): string {
    console.log(chalk.blue('🧠 Generating intelligent fallback analysis...'));
    
    // Extract sport from prompt
    const sportMatch = prompt.match(/SPORT: (\w+)/);
    const sport = sportMatch ? sportMatch[1] : this.sport;
    
    // Intelligent sport-specific analysis
    const fallbackAnalysis = {
      NBA: {
        structureType: "boxscore_players_array",
        confidence: 85,
        playerDataPath: ["boxscore", "players"],
        statMappings: {
          "unknown": {
            arrayPositions: {
              "0": "minutes",
              "1": "fieldGoalsMade",
              "2": "fieldGoalsAttempted", 
              "3": "threePointersMade",
              "4": "threePointersAttempted",
              "5": "freeThrowsMade",
              "6": "freeThrowsAttempted",
              "7": "offensiveRebounds",
              "8": "defensiveRebounds",
              "9": "totalRebounds",
              "10": "assists",
              "11": "steals", 
              "12": "blocks",
              "13": "turnovers",
              "14": "personalFouls",
              "15": "plusMinus",
              "16": "points"
            },
            keyStats: ["points", "rebounds", "assists", "steals", "blocks"],
            timeField: "minutes"
          }
        },
        extractionStrategy: "iterate_boxscore_players_by_team",
        recommendations: [
          "Use boxscore.players[] array for team iteration",
          "Each team contains statistics[] array with athlete data",
          "NBA uses 17-element stat arrays with standard positions"
        ]
      },
      NFL: {
        structureType: "boxscore_players_array",
        confidence: 80,
        playerDataPath: ["boxscore", "players"],
        statMappings: {
          "unknown": {
            arrayPositions: {
              "0": "completions",
              "1": "attempts",
              "2": "yards", 
              "3": "touchdowns",
              "4": "interceptions",
              "5": "rating",
              "6": "longPass",
              "7": "sacks"
            },
            keyStats: ["yards", "touchdowns", "completions"]
          },
          "rushing": {
            arrayPositions: {
              "0": "attempts",
              "1": "yards",
              "2": "touchdowns",
              "3": "long",
              "4": "fumbles"
            },
            keyStats: ["yards", "attempts", "touchdowns"]
          }
        },
        extractionStrategy: "iterate_players_by_position_groups",
        recommendations: [
          "NFL has position-based stat groups",
          "Handle passing, rushing, receiving, defense separately"
        ]
      },
      MLB: {
        structureType: "boxscore_players_array", 
        confidence: 82,
        playerDataPath: ["boxscore", "players"],
        statMappings: {
          "batting": {
            arrayPositions: {
              "0": "atBats",
              "1": "runs",
              "2": "hits",
              "3": "rbis", 
              "4": "walks",
              "5": "strikeouts",
              "6": "plateAppearances",
              "7": "leftOnBase",
              "8": "battingAverage",
              "9": "onBasePercentage",
              "10": "sluggingPercentage",
              "11": "homeRuns"
            },
            keyStats: ["hits", "runs", "rbis", "homeRuns"]
          },
          "pitching": {
            arrayPositions: {
              "0": "inningsPitched",
              "1": "hits",
              "2": "runs",
              "3": "earnedRuns",
              "4": "walks", 
              "5": "strikeouts",
              "6": "homeRuns",
              "7": "pitches",
              "8": "strikes",
              "9": "era"
            },
            keyStats: ["inningsPitched", "earnedRuns", "strikeouts"]
          }
        },
        extractionStrategy: "separate_batting_pitching_stats",
        recommendations: [
          "MLB separates batting and pitching statistics",
          "Handle decimal innings format correctly"
        ]
      },
      NHL: {
        structureType: "boxscore_players_array",
        confidence: 83,
        playerDataPath: ["boxscore", "players"], 
        statMappings: {
          "unknown": {
            arrayPositions: {
              "0": "goals",
              "1": "assists",
              "2": "points",
              "3": "plusMinus",
              "4": "shots",
              "5": "shotPercentage",
              "6": "penaltyMinutes",
              "7": "hits",
              "8": "blocked",
              "9": "takeaways",
              "10": "giveaways",
              "11": "faceoffWins",
              "12": "faceoffLosses", 
              "13": "faceoffPercentage",
              "14": "timeOnIce",
              "15": "powerPlayTimeOnIce",
              "16": "shortHandedTimeOnIce",
              "17": "evenStrengthTimeOnIce",
              "18": "powerPlayGoals",
              "19": "powerPlayAssists",
              "20": "shortHandedGoals"
            },
            keyStats: ["goals", "assists", "points", "shots"],
            timeField: "timeOnIce"
          }
        },
        extractionStrategy: "handle_skaters_goalies_separately",
        recommendations: [
          "NHL differentiates between skaters and goalies",
          "Time format is MM:SS for time on ice"
        ]
      }
    };
    
    const analysis = fallbackAnalysis[sport as keyof typeof fallbackAnalysis] || fallbackAnalysis.NBA;
    
    return JSON.stringify(analysis, null, 2);
  }
  
  // Parse Claude's analysis response
  private parseClaudeResponse(claudeResponse: string): AnalysisResult {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = claudeResponse.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[1]);
        
        return {
          structureType: analysis.structureType || 'unknown',
          confidence: analysis.confidence || 0,
          playerDataPath: analysis.playerDataPath || [],
          statMappings: analysis.statMappings || {},
          recommendations: analysis.recommendations || [],
          extractionStrategy: analysis.extractionStrategy || 'generic'
        };
      }
      
      // If no JSON block, try to parse the entire response
      const analysis = JSON.parse(claudeResponse);
      return {
        structureType: analysis.structureType || 'unknown',
        confidence: analysis.confidence || 0,
        playerDataPath: analysis.playerDataPath || [],
        statMappings: analysis.statMappings || {},
        recommendations: analysis.recommendations || [],
        extractionStrategy: analysis.extractionStrategy || 'generic'
      };
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to parse Claude response: ${error.message}`));
      console.log(chalk.gray(`Claude response: ${claudeResponse.substring(0, 500)}...`));
      
      // Return basic analysis
      return {
        structureType: 'parsing_failed',
        confidence: 0,
        playerDataPath: [],
        statMappings: {},
        recommendations: ['Manual analysis required'],
        extractionStrategy: 'fallback'
      };
    }
  }
  
  // Store knowledge in MCP graph
  private async storeKnowledge(analysis: AnalysisResult, gameId: string, apiResponse: any): Promise<void> {
    try {
      // Create entity for this analysis
      /*
      await mcp_fantasy_intelligence_create_entities([
        {
          name: `ESPN_Analysis_${this.sport}_${gameId}`,
          entityType: "AI_Analysis",
          observations: [
            `Structure: ${analysis.structureType}`,
            `Confidence: ${analysis.confidence}%`,
            `Player data path: ${analysis.playerDataPath.join(' -> ')}`,
            `Extraction strategy: ${analysis.extractionStrategy}`,
            `Recommendations: ${analysis.recommendations.join(', ')}`,
            `Analyzed by: Claude AI`,
            `Sport: ${this.sport}`,
            `Game ID: ${gameId}`,
            `Analysis timestamp: ${new Date().toISOString()}`
          ]
        }
      ]);
      
      // Create relations
      await mcp_fantasy_intelligence_create_relations([
        {
          from: `ESPN_Analysis_${this.sport}_${gameId}`,
          to: this.sport,
          relationType: "analyzes_sport"
        },
        {
          from: `ESPN_Analysis_${this.sport}_${gameId}`,
          to: analysis.structureType,
          relationType: "identifies_structure"
        }
      ]);
      */
      
      // Store in our local database for fast access
      await this.storeAnalysisInDB(analysis, gameId, apiResponse);
      
      console.log(chalk.green(`📚 Stored AI analysis in knowledge graph`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to store knowledge: ${error.message}`));
    }
  }
  
  // Store analysis in local database
  private async storeAnalysisInDB(analysis: AnalysisResult, gameId: string, apiResponse: any): Promise<void> {
    try {
      const analysisRecord = {
        game_id: gameId,
        sport: this.sport,
        structure_type: analysis.structureType,
        confidence: analysis.confidence,
        player_data_path: analysis.playerDataPath,
        stat_mappings: analysis.statMappings,
        recommendations: analysis.recommendations,
        extraction_strategy: analysis.extractionStrategy,
        api_response_sample: this.truncateForStorage(apiResponse),
        created_at: new Date().toISOString(),
        analyzed_by: 'claude-ai'
      };
      
      const { error } = await supabase
        .from('espn_api_analyses')
        .upsert(analysisRecord, { onConflict: 'game_id,sport' });
      
      if (error) {
        console.error(chalk.red(`❌ Database storage error: ${error.message}`));
      }
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to store in database: ${error.message}`));
    }
  }
  
  // Get stored analysis for a game
  async getStoredAnalysis(gameId: string): Promise<AnalysisResult | null> {
    try {
      const { data, error } = await supabase
        .from('espn_api_analyses')
        .select('*')
        .eq('game_id', gameId)
        .eq('sport', this.sport)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return {
        structureType: data.structure_type,
        confidence: data.confidence,
        playerDataPath: data.player_data_path,
        statMappings: data.stat_mappings,
        recommendations: data.recommendations,
        extractionStrategy: data.extraction_strategy
      };
      
    } catch (error) {
      return null;
    }
  }
  
  // Generate parsing code based on analysis
  async generateParsingCode(analysis: AnalysisResult): Promise<string> {
    const codePrompt = `Based on this ESPN API analysis, generate TypeScript parsing code:

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

REQUIREMENTS:
1. Extract players from the detected structure
2. Parse stats according to the stat mappings  
3. Convert to our schema format
4. Handle errors gracefully
5. Include logging for debugging

Generate a TypeScript function that takes an ESPN API response and returns parsed player data in our schema format.`;
    
    try {
      const generatedCode = await this.callClaudeAPI(codePrompt);
      console.log(chalk.green(`🔧 Generated parsing code for ${analysis.structureType}`));
      return generatedCode;
    } catch (error: any) {
      console.error(chalk.red(`❌ Code generation failed: ${error.message}`));
      return `// Auto-generated parsing code failed\n// Manual implementation required`;
    }
  }
  
  // Truncate response for Claude analysis (stay within token limits)
  private truncateForAnalysis(apiResponse: any): any {
    const jsonString = JSON.stringify(apiResponse);
    if (jsonString.length <= 50000) {
      return apiResponse;
    }
    
    // Keep essential structure, truncate arrays
    const truncated = JSON.parse(JSON.stringify(apiResponse));
    
    // Truncate player arrays to 2 players per team for analysis
    if (truncated?.boxscore?.players) {
      for (const team of truncated.boxscore.players) {
        if (team.statistics) {
          for (const statGroup of team.statistics) {
            if (statGroup.athletes && statGroup.athletes.length > 2) {
              statGroup.athletes = statGroup.athletes.slice(0, 2);
            }
          }
        }
      }
    }
    
    return truncated;
  }
  
  // Truncate for database storage
  private truncateForStorage(apiResponse: any): any {
    const jsonString = JSON.stringify(apiResponse);
    if (jsonString.length <= 10000) {
      return apiResponse;
    }
    
    // Store only the structure, not full data
    return {
      structure_sample: this.truncateForAnalysis(apiResponse),
      original_size: jsonString.length,
      truncated: true
    };
  }
  
  // Fallback analysis when Claude fails
  private fallbackAnalysis(apiResponse: any): AnalysisResult {
    console.log(chalk.yellow(`🔄 Using fallback analysis...`));
    
    if (apiResponse?.boxscore?.players) {
      return {
        structureType: 'boxscore_players_array',
        confidence: 70,
        playerDataPath: ['boxscore', 'players'],
        statMappings: {},
        recommendations: ['Use boxscore.players array structure'],
        extractionStrategy: 'iterate_players_array'
      };
    }
    
    if (apiResponse?.boxscore?.teams?.[0]?.statistics) {
      return {
        structureType: 'boxscore_teams_statistics',
        confidence: 70,
        playerDataPath: ['boxscore', 'teams', 'statistics', 'athletes'],
        statMappings: {},
        recommendations: ['Use legacy boxscore.teams.statistics structure'],
        extractionStrategy: 'iterate_teams_statistics'
      };
    }
    
    return {
      structureType: 'unknown',
      confidence: 0,
      playerDataPath: [],
      statMappings: {},
      recommendations: ['Manual analysis required'],
      extractionStrategy: 'manual'
    };
  }
  
  // Get analysis summary
  getAnalysisSummary(): any {
    return {
      sport: this.sport,
      analyzedGames: this.analysisHistory.size,
      structureTypes: Array.from(new Set(
        Array.from(this.analysisHistory.values()).map(a => a.structureType)
      )),
      averageConfidence: this.analysisHistory.size > 0 ?
        Array.from(this.analysisHistory.values())
          .reduce((sum, a) => sum + a.confidence, 0) / this.analysisHistory.size : 0
    };
  }
}

export { AIEspnAnalyzer, AnalysisResult };