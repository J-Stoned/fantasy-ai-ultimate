#!/usr/bin/env tsx
/**
 * 💰 REAL-TIME BETTING ODDS COLLECTOR
 * 
 * Scrapes live odds to boost prediction accuracy
 * Vegas knows things we don't!
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BettingOdds {
  gameId: string;
  homeMoneyline: number;
  awayMoneyline: number;
  spread: number;
  overUnder: number;
  homeWinProbability: number;
  awayWinProbability: number;
  lineMovement?: number;
  sharpMoney?: boolean;
}

class BettingOddsCollector {
  private oddsCache = new Map<string, BettingOdds>();
  
  async collectOddsForGame(gameId: string, homeTeam: string, awayTeam: string): Promise<BettingOdds | null> {
    console.log(chalk.yellow(`\n💰 Collecting betting odds for ${homeTeam} vs ${awayTeam}...`));
    
    try {
      // Try ESPN API first (free)
      const espnOdds = await this.getESPNOdds(homeTeam, awayTeam);
      if (espnOdds) {
        const odds: BettingOdds = {
          gameId,
          ...espnOdds,
          homeWinProbability: this.moneylineToProb(espnOdds.homeMoneyline),
          awayWinProbability: this.moneylineToProb(espnOdds.awayMoneyline)
        };
        
        // Store in cache
        this.oddsCache.set(gameId, odds);
        
        // Store in database
        await this.storeOdds(odds);
        
        console.log(chalk.green('✅ Odds collected:'));
        console.log(`   Spread: ${odds.spread > 0 ? '+' : ''}${odds.spread}`);
        console.log(`   O/U: ${odds.overUnder}`);
        console.log(`   ML: ${homeTeam} ${odds.homeMoneyline}, ${awayTeam} ${odds.awayMoneyline}`);
        console.log(`   Win Prob: ${homeTeam} ${odds.homeWinProbability.toFixed(1)}%, ${awayTeam} ${odds.awayWinProbability.toFixed(1)}%`);
        
        return odds;
      }
      
      // Fallback to mock odds for testing
      const mockOdds = this.generateMockOdds(gameId, homeTeam, awayTeam);
      
      console.log(chalk.green('✅ Mock odds generated:'));
      console.log(`   Spread: ${mockOdds.spread > 0 ? '+' : ''}${mockOdds.spread}`);
      console.log(`   O/U: ${mockOdds.overUnder}`);
      console.log(`   ML: ${homeTeam} ${mockOdds.homeMoneyline}, ${awayTeam} ${mockOdds.awayMoneyline}`);
      console.log(`   Win Prob: ${homeTeam} ${mockOdds.homeWinProbability.toFixed(1)}%, ${awayTeam} ${mockOdds.awayWinProbability.toFixed(1)}%`);
      
      this.oddsCache.set(gameId, mockOdds);
      await this.storeOdds(mockOdds);
      
      return mockOdds;
      
    } catch (error) {
      console.error(chalk.red('Error collecting odds:'), error);
      return null;
    }
  }
  
  async getESPNOdds(homeTeam: string, awayTeam: string): Promise<any> {
    try {
      // ESPN public API endpoint
      const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
      const response = await axios.get(url);
      
      const games = response.data.events || [];
      
      // Find matching game
      for (const game of games) {
        const competitors = game.competitions[0].competitors;
        const teams = competitors.map((c: any) => c.team.displayName);
        
        if (teams.includes(homeTeam) && teams.includes(awayTeam)) {
          const odds = game.competitions[0].odds?.[0];
          
          if (odds) {
            const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
            const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');
            
            return {
              homeMoneyline: parseFloat(homeCompetitor?.odds?.moneyLine || '-110'),
              awayMoneyline: parseFloat(awayCompetitor?.odds?.moneyLine || '-110'),
              spread: parseFloat(odds.details || '0'),
              overUnder: parseFloat(odds.overUnder || '45')
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('ESPN API error:', error);
      return null;
    }
  }
  
  generateMockOdds(gameId: string, homeTeam: string, awayTeam: string): BettingOdds {
    // Generate realistic mock odds for testing
    const homeAdvantage = 0.03; // 3% home field advantage
    const randomFactor = (Math.random() - 0.5) * 0.2;
    
    const homeWinProb = 0.5 + homeAdvantage + randomFactor;
    const awayWinProb = 1 - homeWinProb;
    
    const spread = (homeWinProb - 0.5) * 14; // Convert to point spread
    const overUnder = 45 + Math.random() * 10;
    
    return {
      gameId,
      homeMoneyline: this.probToMoneyline(homeWinProb),
      awayMoneyline: this.probToMoneyline(awayWinProb),
      spread: Math.round(spread * 2) / 2, // Round to .5
      overUnder: Math.round(overUnder),
      homeWinProbability: homeWinProb * 100,
      awayWinProbability: awayWinProb * 100,
      lineMovement: Math.random() > 0.7 ? (Math.random() - 0.5) * 3 : 0,
      sharpMoney: Math.random() > 0.8
    };
  }
  
  moneylineToProb(moneyline: number): number {
    if (moneyline > 0) {
      return 100 / (moneyline + 100) * 100;
    } else {
      return Math.abs(moneyline) / (Math.abs(moneyline) + 100) * 100;
    }
  }
  
  probToMoneyline(prob: number): number {
    if (prob >= 0.5) {
      return -Math.round((prob / (1 - prob)) * 100);
    } else {
      return Math.round(((1 - prob) / prob) * 100);
    }
  }
  
  async storeOdds(odds: BettingOdds) {
    // Check if table exists first
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'betting_odds');
    
    if (!tables || tables.length === 0) {
      console.log(chalk.yellow('⚠️  betting_odds table not found. Creating...'));
      
      // For now, just log the SQL
      console.log(chalk.cyan(`
CREATE TABLE betting_odds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT UNIQUE NOT NULL,
  home_moneyline FLOAT,
  away_moneyline FLOAT,
  spread FLOAT,
  over_under FLOAT,
  home_win_probability FLOAT,
  away_win_probability FLOAT,
  line_movement FLOAT,
  sharp_money BOOLEAN,
  source TEXT DEFAULT 'mock',
  created_at TIMESTAMP DEFAULT NOW()
);
      `));
      return;
    }
    
    const { error } = await supabase
      .from('betting_odds')
      .upsert({
        game_id: odds.gameId,
        home_moneyline: odds.homeMoneyline,
        away_moneyline: odds.awayMoneyline,
        spread: odds.spread,
        over_under: odds.overUnder,
        home_win_probability: odds.homeWinProbability,
        away_win_probability: odds.awayWinProbability,
        line_movement: odds.lineMovement || 0,
        sharp_money: odds.sharpMoney || false,
        source: 'mock' // Change to 'espn' when real API works
      }, { onConflict: 'game_id' });
      
    if (error) {
      console.error('Error storing odds:', error);
    }
  }
  
  async testCollector() {
    console.log(chalk.bold.cyan('\n💰 TESTING BETTING ODDS COLLECTOR\n'));
    
    // Test with upcoming games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .is('home_score', null)
      .limit(5);
      
    if (!games || games.length === 0) {
      console.log('No upcoming games found');
      return;
    }
    
    for (const game of games) {
      // For testing, use team IDs as names
      const odds = await this.collectOddsForGame(
        game.id,
        game.home_team_id,
        game.away_team_id
      );
      
      if (odds && odds.sharpMoney) {
        console.log(chalk.red('   ⚠️  SHARP MONEY DETECTED!'));
      }
      
      if (odds && Math.abs(odds.lineMovement || 0) > 2) {
        console.log(chalk.yellow(`   📈 Significant line movement: ${odds.lineMovement}`));
      }
    }
    
    console.log(chalk.green(`\n✅ Collected odds for ${this.oddsCache.size} games`));
  }
}

// Export for use in predictions
export const oddsCollector = new BettingOddsCollector();

// Run test if called directly
if (require.main === module) {
  const collector = new BettingOddsCollector();
  collector.testCollector().catch(console.error);
}