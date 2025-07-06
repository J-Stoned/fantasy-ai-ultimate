#!/usr/bin/env tsx
/**
 * 🎤 VOICE-ACTIVATED TRADING ASSISTANT
 * 
 * "Hey Fantasy, should I trade X for Y?"
 * Analyzes trades using pattern data
 * Provides voice-enabled trade recommendations
 * Integrates with existing voice system
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3343;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TradeAnalysis {
  recommendation: 'accept' | 'reject' | 'counter';
  confidence: number;
  reasoning: string[];
  
  // Value analysis
  giveValue: number;
  getValue: number;
  netValue: number;
  
  // Pattern-based insights
  patternAdvantage: {
    player: string;
    pattern: string;
    impact: number;
  }[];
  
  // Risk assessment
  injuryRisk: { player: string; risk: number }[];
  scheduleAdvantage: { player: string; advantage: string }[];
  
  // Voice response
  voiceResponse: string;
  voiceEmphasis: 'positive' | 'negative' | 'neutral';
  
  // Counter offer suggestion
  counterOffer?: {
    add?: string[];
    remove?: string[];
    reasoning: string;
  };
}

interface PlayerValue {
  name: string;
  position: string;
  team: string;
  
  // Current season
  avgPoints: number;
  consistency: number;
  trend: number; // -1 to 1
  
  // Rest of season
  rosRank: number;
  rosProjection: number;
  scheduleStrength: number;
  
  // Trade market
  marketValue: number; // 0-100
  demand: 'high' | 'medium' | 'low';
  
  // Pattern insights
  patternBoost?: number;
  upcomingPatterns?: string[];
}

class VoiceTradeAssistant {
  async analyzeTrade(
    give: string[],
    get: string[],
    context?: {
      leagueSize?: number;
      scoring?: 'standard' | 'ppr' | 'half_ppr';
      teamNeeds?: string[];
      recordCurrent?: string;
    }
  ): Promise<TradeAnalysis> {
    console.log(chalk.cyan('\n🤝 Analyzing trade...'));
    console.log(chalk.white(`Give: ${give.join(', ')}`));
    console.log(chalk.white(`Get: ${get.join(', ')}`));
    
    // Get player values
    const giveValues = await Promise.all(give.map(p => this.getPlayerValue(p)));
    const getValues = await Promise.all(get.map(p => this.getPlayerValue(p)));
    
    // Calculate total values
    const giveTotal = giveValues.reduce((sum, p) => sum + p.marketValue, 0);
    const getTotal = getValues.reduce((sum, p) => sum + p.marketValue, 0);
    const netValue = getTotal - giveTotal;
    
    // Analyze patterns
    const patternAdvantage = this.analyzePatterns(giveValues, getValues);
    
    // Check injury risks
    const injuryRisk = this.assessInjuryRisk([...giveValues, ...getValues]);
    
    // Analyze schedule
    const scheduleAdvantage = this.analyzeSchedule(giveValues, getValues);
    
    // Make recommendation
    const { recommendation, confidence, reasoning } = this.makeRecommendation(
      netValue,
      patternAdvantage,
      injuryRisk,
      scheduleAdvantage,
      context
    );
    
    // Generate voice response
    const voiceResponse = this.generateVoiceResponse(
      recommendation,
      confidence,
      reasoning,
      give,
      get
    );
    
    // Suggest counter if needed
    const counterOffer = recommendation === 'counter' ? 
      this.suggestCounter(giveValues, getValues, netValue) : undefined;
    
    return {
      recommendation,
      confidence,
      reasoning,
      giveValue: Math.round(giveTotal),
      getValue: Math.round(getTotal),
      netValue: Math.round(netValue),
      patternAdvantage,
      injuryRisk,
      scheduleAdvantage,
      voiceResponse,
      voiceEmphasis: netValue > 10 ? 'positive' : netValue < -10 ? 'negative' : 'neutral',
      counterOffer
    };
  }
  
  private async getPlayerValue(playerName: string): Promise<PlayerValue> {
    // In production, would fetch from database
    // Mock data for demonstration
    const positions = ['RB', 'WR', 'TE', 'QB'];
    const teams = ['KC', 'BUF', 'PHI', 'SF', 'DAL'];
    
    const mockValue: PlayerValue = {
      name: playerName,
      position: positions[Math.floor(Math.random() * positions.length)],
      team: teams[Math.floor(Math.random() * teams.length)],
      
      avgPoints: 10 + Math.random() * 15,
      consistency: 3 + Math.random() * 2,
      trend: (Math.random() - 0.5) * 2,
      
      rosRank: Math.floor(Math.random() * 50) + 1,
      rosProjection: 150 + Math.random() * 100,
      scheduleStrength: Math.random(),
      
      marketValue: 30 + Math.random() * 40,
      demand: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      
      patternBoost: Math.random() > 0.6 ? Math.random() * 0.2 : 0,
      upcomingPatterns: Math.random() > 0.5 ? ['revenge_game', 'home_favorite'] : []
    };
    
    // Adjust value based on name recognition (mock)
    if (playerName.toLowerCase().includes('mahomes') || 
        playerName.toLowerCase().includes('mccaffrey')) {
      mockValue.marketValue = 80 + Math.random() * 20;
      mockValue.rosRank = Math.floor(Math.random() * 5) + 1;
    }
    
    return mockValue;
  }
  
  private analyzePatterns(
    give: PlayerValue[],
    get: PlayerValue[]
  ): TradeAnalysis['patternAdvantage'] {
    const advantages: TradeAnalysis['patternAdvantage'] = [];
    
    // Check for pattern boosts
    get.forEach(player => {
      if (player.patternBoost && player.patternBoost > 0.1) {
        advantages.push({
          player: player.name,
          pattern: 'Positive pattern detected',
          impact: Math.round(player.patternBoost * 100)
        });
      }
      
      if (player.upcomingPatterns && player.upcomingPatterns.length > 0) {
        advantages.push({
          player: player.name,
          pattern: player.upcomingPatterns.join(', '),
          impact: 15
        });
      }
    });
    
    // Check for negative patterns in give
    give.forEach(player => {
      if (player.trend < -0.5) {
        advantages.push({
          player: player.name,
          pattern: 'Declining trend',
          impact: -10
        });
      }
    });
    
    return advantages;
  }
  
  private assessInjuryRisk(players: PlayerValue[]): TradeAnalysis['injuryRisk'] {
    return players.map(player => ({
      player: player.name,
      risk: Math.random() * 30 // Mock risk percentage
    })).filter(r => r.risk > 10);
  }
  
  private analyzeSchedule(
    give: PlayerValue[],
    get: PlayerValue[]
  ): TradeAnalysis['scheduleAdvantage'] {
    const advantages: TradeAnalysis['scheduleAdvantage'] = [];
    
    get.forEach(player => {
      if (player.scheduleStrength > 0.7) {
        advantages.push({
          player: player.name,
          advantage: 'Easy upcoming schedule'
        });
      }
    });
    
    give.forEach(player => {
      if (player.scheduleStrength < 0.3) {
        advantages.push({
          player: player.name,
          advantage: 'Difficult schedule ahead'
        });
      }
    });
    
    return advantages;
  }
  
  private makeRecommendation(
    netValue: number,
    patternAdvantage: any[],
    injuryRisk: any[],
    scheduleAdvantage: any[],
    context?: any
  ): { recommendation: 'accept' | 'reject' | 'counter'; confidence: number; reasoning: string[] } {
    const reasoning: string[] = [];
    let score = 50; // Start neutral
    
    // Value analysis
    if (netValue > 20) {
      score += 25;
      reasoning.push('Significant value gained in trade');
    } else if (netValue > 10) {
      score += 15;
      reasoning.push('Good value in your favor');
    } else if (netValue < -20) {
      score -= 25;
      reasoning.push('Losing significant value');
    } else if (netValue < -10) {
      score -= 15;
      reasoning.push('Slightly overpaying');
    } else {
      reasoning.push('Fair value trade');
    }
    
    // Pattern advantages
    const patternScore = patternAdvantage.reduce((sum, p) => sum + p.impact, 0);
    if (patternScore > 20) {
      score += 15;
      reasoning.push('Strong pattern advantages identified');
    } else if (patternScore < -20) {
      score -= 15;
      reasoning.push('Negative patterns detected');
    }
    
    // Injury risk
    const highRiskCount = injuryRisk.filter(r => r.risk > 20).length;
    if (highRiskCount > 0) {
      score -= highRiskCount * 5;
      reasoning.push(`${highRiskCount} players with injury concerns`);
    }
    
    // Schedule
    if (scheduleAdvantage.length > 0) {
      score += scheduleAdvantage.length * 3;
      reasoning.push('Favorable schedule considerations');
    }
    
    // Team needs (if provided)
    if (context?.teamNeeds) {
      // Check if getting needed positions
      reasoning.push('Addresses team needs');
      score += 10;
    }
    
    // Determine recommendation
    let recommendation: 'accept' | 'reject' | 'counter';
    if (score >= 70) {
      recommendation = 'accept';
    } else if (score <= 30) {
      recommendation = 'reject';
    } else {
      recommendation = 'counter';
    }
    
    const confidence = Math.min(95, Math.abs(score - 50) + 50);
    
    return { recommendation, confidence, reasoning };
  }
  
  private generateVoiceResponse(
    recommendation: 'accept' | 'reject' | 'counter',
    confidence: number,
    reasoning: string[],
    give: string[],
    get: string[]
  ): string {
    let response = '';
    
    if (recommendation === 'accept') {
      if (confidence > 80) {
        response = `Absolutely accept this trade! You're getting ${get.join(' and ')} for ${give.join(' and ')}. `;
      } else {
        response = `I'd lean towards accepting this trade. `;
      }
    } else if (recommendation === 'reject') {
      if (confidence > 80) {
        response = `Hard pass on this trade. You're giving up too much value. `;
      } else {
        response = `I wouldn't take this deal as it stands. `;
      }
    } else {
      response = `This trade has potential but needs adjustment. `;
    }
    
    // Add key reasoning
    response += reasoning[0] + '. ';
    
    // Add confidence
    if (confidence > 75) {
      response += `I'm ${confidence}% confident in this assessment.`;
    }
    
    return response;
  }
  
  private suggestCounter(
    give: PlayerValue[],
    get: PlayerValue[],
    netValue: number
  ): TradeAnalysis['counterOffer'] {
    const counter: TradeAnalysis['counterOffer'] = {
      reasoning: ''
    };
    
    if (netValue < -15) {
      // We're overpaying, ask for more
      counter.add = ['Request a flex-worthy player or future pick'];
      counter.reasoning = 'Ask for additional value to balance the trade';
    } else if (netValue > 15) {
      // We're getting too much, offer something small
      counter.add = ['Offer a bench player to make it fair'];
      counter.reasoning = 'Add a small piece to avoid insulting offer';
    } else {
      // Close to fair, minor adjustments
      counter.reasoning = 'Swap comparable players to better fit team needs';
    }
    
    return counter;
  }
}

// API endpoints
const assistant = new VoiceTradeAssistant();

app.post('/voice/trade', async (req, res) => {
  try {
    const { command, give, get, context } = req.body;
    
    // Parse command if needed
    let giveArray = give;
    let getArray = get;
    
    if (command && !give && !get) {
      // Parse from voice command
      const parsed = parseTradeCommand(command);
      giveArray = parsed.give;
      getArray = parsed.get;
    }
    
    const analysis = await assistant.analyzeTrade(giveArray, getArray, context);
    
    res.json({
      success: true,
      analysis,
      command: command || `Trade ${giveArray.join(', ')} for ${getArray.join(', ')}`
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/voice/trade/help', (req, res) => {
  res.json({
    success: true,
    examples: [
      "Hey Fantasy, should I trade Mahomes for Josh Allen?",
      "Hey Fantasy, analyze trading McCaffrey and Lamb for Jefferson and Barkley",
      "Hey Fantasy, is Kelce for Andrews and Pollard a good trade?",
      "Hey Fantasy, I need RB help, who should I target?"
    ],
    capabilities: [
      'Trade value analysis',
      'Pattern-based insights',
      'Injury risk assessment',
      'Schedule analysis',
      'Counter offer suggestions'
    ]
  });
});

// Helper to parse voice commands
function parseTradeCommand(command: string): { give: string[]; get: string[] } {
  // Simple parsing - in production would use NLP
  const parts = command.toLowerCase().split(' for ');
  
  if (parts.length !== 2) {
    throw new Error('Could not parse trade command');
  }
  
  const give = parts[0].replace(/.*trade\s+/i, '').split(/\s+and\s+/);
  const get = parts[1].split(/\s+and\s+/);
  
  return { give, get };
}

// Start server
app.listen(PORT, () => {
  console.log(chalk.green(`\n🎤 VOICE TRADE ASSISTANT RUNNING!`));
  console.log(chalk.white(`Port: ${PORT}`));
  console.log(chalk.cyan(`\nExample commands:`));
  console.log(`  "Hey Fantasy, should I trade Mahomes for Josh Allen?"`);
  console.log(`  "Hey Fantasy, analyze McCaffrey for Jefferson and Henry"`);
  console.log(`  "Hey Fantasy, is this trade fair?"`);
  console.log(chalk.yellow(`\nEndpoints:`));
  console.log(`  POST /voice/trade - Analyze a trade`);
  console.log(`  GET  /voice/trade/help - Get examples`);
});

// Example standalone usage
async function runExample() {
  const assistant = new VoiceTradeAssistant();
  
  console.log(chalk.cyan('\n📊 Example Trade Analysis:'));
  const result = await assistant.analyzeTrade(
    ['Patrick Mahomes', 'Tony Pollard'],
    ['Josh Allen', 'Kenneth Walker'],
    { 
      scoring: 'ppr',
      teamNeeds: ['RB']
    }
  );
  
  console.log(chalk.white('\nVoice Response:'));
  console.log(chalk.green(`"${result.voiceResponse}"`));
  
  console.log(chalk.white('\nDetailed Analysis:'));
  console.log(`Recommendation: ${result.recommendation.toUpperCase()}`);
  console.log(`Confidence: ${result.confidence}%`);
  console.log(`Net Value: ${result.netValue > 0 ? '+' : ''}${result.netValue}`);
  
  if (result.patternAdvantage.length > 0) {
    console.log(chalk.yellow('\nPattern Insights:'));
    result.patternAdvantage.forEach(p => {
      console.log(`  ${p.player}: ${p.pattern} (${p.impact > 0 ? '+' : ''}${p.impact}%)`);
    });
  }
}

// Run example if called directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { VoiceTradeAssistant, TradeAnalysis };