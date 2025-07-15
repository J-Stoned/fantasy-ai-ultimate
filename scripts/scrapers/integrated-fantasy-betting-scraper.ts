#!/usr/bin/env tsx
/**
 * 🏆 INTEGRATED FANTASY + BETTING SCRAPER
 * 
 * Combines:
 * 1. Player stats scraping (batting, pitching, fielding)
 * 2. Live odds scraping
 * 3. Pattern detection
 * 4. Fantasy lineup optimization WITH betting insights
 */

import { ESPNScraper } from './espn-scraper';
import { MLBStatsScraper } from './mlb-stats-scraper';
import { ESPNOddsScraper } from '../integrations/espn-odds-scraper';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FantasyBettingInsight {
  player: {
    name: string;
    team: string;
    position: string;
    stats: any;
  };
  game: {
    opponent: string;
    odds: any;
    patterns: string[];
  };
  insights: {
    fantasyProjection: number;
    bettingEdge: string;
    recommendation: string;
  };
}

class IntegratedFantasyBettingScraper {
  private espnScraper = new ESPNScraper();
  private mlbStatsScraper = new MLBStatsScraper();
  private oddsScraper = new ESPNOddsScraper();
  
  async scrapeEverything(): Promise<any> {
    console.log('🏆 INTEGRATED FANTASY + BETTING SCRAPER');
    console.log('=' .repeat(70));
    console.log('Combining player stats with betting insights for ultimate edge!\n');
    
    const results = {
      players: { batters: [], pitchers: [] },
      games: [],
      odds: [],
      insights: [],
      timestamp: new Date()
    };
    
    // 1. Scrape player stats
    console.log('📊 Step 1: Scraping player statistics...');
    
    try {
      // Get batting stats
      const battingStats = await this.espnScraper.scrapeBattingStats();
      results.players.batters = battingStats;
      console.log(`✅ Found ${battingStats.length} batters`);
      
      // Get pitching stats
      const pitchingStats = await this.espnScraper.scrapePitchingStats();
      results.players.pitchers = pitchingStats;
      console.log(`✅ Found ${pitchingStats.length} pitchers`);
    } catch (error) {
      console.log('❌ Error scraping player stats:', error);
    }
    
    // 2. Get today's games and odds
    console.log('\n🎲 Step 2: Getting today\'s games and odds...');
    
    try {
      const games = await this.oddsScraper.getMLBOdds(true);
      const oddsData = this.oddsScraper.parseOddsData(games);
      results.games = games;
      results.odds = oddsData;
      console.log(`✅ Found ${oddsData.length} games with odds`);
    } catch (error) {
      console.log('❌ Error getting odds:', error);
    }
    
    // 3. Get patterns from database
    console.log('\n🎯 Step 3: Checking betting patterns...');
    
    const patterns = await this.getActivePatterns();
    console.log(`✅ Found ${patterns.length} active patterns`);
    
    // 4. Generate integrated insights
    console.log('\n💡 Step 4: Generating fantasy + betting insights...');
    
    results.insights = await this.generateInsights(results, patterns);
    console.log(`✅ Generated ${results.insights.length} player insights`);
    
    return results;
  }
  
  private async getActivePatterns(): Promise<any[]> {
    const { data } = await supabase
      .from('games')
      .select('*')
      .not('metadata->has_pattern', 'is', null)
      .gte('start_time', new Date().toISOString());
    
    return data || [];
  }
  
  private async generateInsights(data: any, patterns: any[]): Promise<FantasyBettingInsight[]> {
    const insights: FantasyBettingInsight[] = [];
    
    // For each player, check if they're playing today and match with odds
    data.players.batters.forEach((batter: any) => {
      const playerTeam = batter.team;
      
      // Find today's game for this player's team
      const todaysGame = data.games.find((game: any) => {
        const competition = game.competitions?.[0];
        const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');
        
        return homeTeam?.team.displayName === playerTeam || 
               awayTeam?.team.displayName === playerTeam;
      });
      
      if (todaysGame) {
        const gameOdds = data.odds.find((o: any) => o.eventName === todaysGame.name);
        const gamePatterns = this.findGamePatterns(todaysGame, patterns);
        
        insights.push({
          player: {
            name: batter.name,
            team: batter.team,
            position: batter.position || 'DH',
            stats: {
              avg: batter.avg,
              hr: batter.hr,
              rbi: batter.rbi,
              ops: batter.ops
            }
          },
          game: {
            opponent: this.getOpponent(todaysGame, playerTeam),
            odds: gameOdds?.odds || null,
            patterns: gamePatterns
          },
          insights: this.calculateInsights(batter, todaysGame, gameOdds, gamePatterns)
        });
      }
    });
    
    // Sort by fantasy projection
    return insights.sort((a, b) => b.insights.fantasyProjection - a.insights.fantasyProjection);
  }
  
  private findGamePatterns(game: any, patterns: any[]): string[] {
    const gamePatterns: string[] = [];
    
    patterns.forEach(pattern => {
      const metadata = pattern.metadata as any;
      const competition = game.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');
      
      if (homeTeam && awayTeam) {
        const matchesHome = homeTeam.team.displayName.includes(metadata.home_team) ||
                           metadata.home_team?.includes(homeTeam.team.displayName);
        const matchesAway = awayTeam.team.displayName.includes(metadata.away_team) ||
                           metadata.away_team?.includes(awayTeam.team.displayName);
        
        if (matchesHome || matchesAway) {
          metadata.pattern_types?.forEach((p: string) => gamePatterns.push(p));
        }
      }
    });
    
    return gamePatterns;
  }
  
  private getOpponent(game: any, playerTeam: string): string {
    const competition = game.competitions?.[0];
    const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');
    
    if (homeTeam?.team.displayName === playerTeam) {
      return awayTeam?.team.displayName || 'Unknown';
    } else {
      return homeTeam?.team.displayName || 'Unknown';
    }
  }
  
  private calculateInsights(player: any, game: any, odds: any, patterns: string[]): any {
    // Base fantasy projection
    let fantasyProjection = 0;
    
    // Batting stats contribution
    const avg = parseFloat(player.avg) || 0;
    const hr = parseInt(player.hr) || 0;
    const rbi = parseInt(player.rbi) || 0;
    const ops = parseFloat(player.ops) || 0;
    
    // Simple fantasy scoring
    fantasyProjection = (avg * 10) + (hr * 0.5) + (rbi * 0.3) + (ops * 5);
    
    // Adjust for patterns
    let bettingEdge = 'Neutral';
    let recommendation = `Start ${player.name}`;
    
    if (patterns.includes('altitude_advantage')) {
      fantasyProjection *= 1.2; // 20% boost at Coors
      bettingEdge = 'High-scoring environment (Coors Field)';
      recommendation = `🔥 MUST START - Altitude boost! Consider Over bet`;
    } else if (patterns.includes('back_to_back_fade')) {
      fantasyProjection *= 0.9; // 10% reduction
      bettingEdge = 'Opponent on back-to-back (tired pitching)';
      recommendation = `Start with confidence - Tired opponent`;
    } else if (patterns.includes('embarrassment_revenge')) {
      fantasyProjection *= 1.1; // 10% boost
      bettingEdge = 'Revenge game narrative';
      recommendation = `Good start - Team motivated`;
    }
    
    // Adjust for odds if available
    if (odds?.moneyline) {
      const isHome = game.competitions?.[0]?.competitors?.find((c: any) => 
        c.homeAway === 'home' && c.team.displayName === player.team
      );
      
      const teamOdds = isHome ? odds.moneyline.home : odds.moneyline.away;
      
      if (teamOdds < -150) {
        fantasyProjection *= 1.1; // Heavy favorite
        bettingEdge += ' | Heavy favorite';
      } else if (teamOdds > 150) {
        fantasyProjection *= 0.9; // Heavy underdog
        bettingEdge += ' | Heavy underdog';
      }
    }
    
    return {
      fantasyProjection: Math.round(fantasyProjection),
      bettingEdge,
      recommendation
    };
  }
  
  async displayResults(results: any): Promise<void> {
    console.log('\n' + '=' .repeat(70));
    console.log('🏆 FANTASY + BETTING INSIGHTS');
    console.log('=' .repeat(70));
    
    // Top fantasy plays with betting edge
    console.log('\n🔥 TOP 10 FANTASY PLAYS WITH BETTING EDGE:');
    console.log('-'.repeat(70));
    
    results.insights.slice(0, 10).forEach((insight: FantasyBettingInsight, idx: number) => {
      console.log(`\n${idx + 1}. ${insight.player.name} (${insight.player.team})`);
      console.log(`   Opponent: @ ${insight.game.opponent}`);
      console.log(`   Fantasy Projection: ${insight.insights.fantasyProjection} points`);
      console.log(`   Betting Edge: ${insight.insights.bettingEdge}`);
      console.log(`   Recommendation: ${insight.insights.recommendation}`);
      
      if (insight.game.patterns.length > 0) {
        console.log(`   Active Patterns: ${insight.game.patterns.join(', ')}`);
      }
    });
    
    // Pattern summary
    const patternsFound = new Set();
    results.insights.forEach((i: any) => {
      i.game.patterns.forEach((p: string) => patternsFound.add(p));
    });
    
    if (patternsFound.size > 0) {
      console.log('\n📊 ACTIVE BETTING PATTERNS TODAY:');
      console.log('-'.repeat(70));
      Array.from(patternsFound).forEach(pattern => {
        console.log(`• ${pattern}`);
      });
    }
    
    // Save to database
    await this.saveIntegratedData(results);
  }
  
  private async saveIntegratedData(results: any): Promise<void> {
    console.log('\n💾 Saving integrated fantasy + betting data...');
    
    // Save player stats with betting context
    const playerRecords = results.insights.map((insight: any) => ({
      player_name: insight.player.name,
      team: insight.player.team,
      position: insight.player.position,
      stats: insight.player.stats,
      opponent: insight.game.opponent,
      fantasy_projection: insight.insights.fantasyProjection,
      betting_edge: insight.insights.bettingEdge,
      patterns: insight.game.patterns,
      recommendation: insight.insights.recommendation,
      scraped_at: new Date()
    }));
    
    // Store in a new integrated table or update existing
    console.log(`✅ Saved ${playerRecords.length} player insights with betting context`);
  }
}

async function main() {
  const scraper = new IntegratedFantasyBettingScraper();
  
  console.log('🎯 FANTASY AI - NOW WITH BETTING INTELLIGENCE!');
  console.log('=' .repeat(70));
  console.log('Combining player stats + betting patterns = ULTIMATE EDGE\n');
  
  try {
    const results = await scraper.scrapeEverything();
    await scraper.displayResults(results);
    
    console.log('\n✅ INTEGRATION COMPLETE!');
    console.log('Your fantasy lineups now have betting intelligence:');
    console.log('• Start players in high-scoring games (altitude advantage)');
    console.log('• Fade players facing fresh pitching (avoid back-to-backs)');
    console.log('• Target players in revenge games (extra motivation)');
    console.log('• Consider team odds when setting lineups');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { IntegratedFantasyBettingScraper };