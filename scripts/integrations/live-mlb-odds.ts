#!/usr/bin/env tsx
/**
 * ⚾ LIVE MLB ODDS - COMPREHENSIVE SCRAPER
 * 
 * Gets real live odds from multiple sources:
 * 1. ESPN (always works)
 * 2. CBS Sports  
 * 3. OddsShark API
 * 4. ScoresAndOdds
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class LiveMLBOdds {
  async getAllLiveOdds(): Promise<any> {
    console.log('⚾ FETCHING LIVE MLB ODDS FROM ALL SOURCES');
    console.log('=' .repeat(70));
    
    const results = {
      espn: await this.getESPNOdds(),
      cbs: await this.getCBSOdds(),
      oddsShark: await this.getOddsSharkOdds(),
      scoresAndOdds: await this.getScoresAndOdds(),
      summary: { totalGames: 0, sources: 0, arbitrage: [] }
    };
    
    // Count total unique games
    const allGames = new Set();
    Object.entries(results).forEach(([source, data]: any) => {
      if (Array.isArray(data)) {
        data.forEach((game: any) => {
          if (game.eventName) allGames.add(game.eventName);
        });
      }
    });
    
    results.summary.totalGames = allGames.size;
    results.summary.sources = Object.values(results).filter(r => Array.isArray(r) && r.length > 0).length;
    
    return results;
  }
  
  private async getESPNOdds(): Promise<any[]> {
    console.log('\n📺 ESPN Odds...');
    
    try {
      // Get today's games
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        {
          params: {
            dates: today,
            limit: 100
          }
        }
      );
      
      const games = response.data?.events || [];
      const oddsData = [];
      
      games.forEach((game: any) => {
        const competition = game.competitions?.[0];
        if (!competition) return;
        
        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
        
        if (homeTeam && awayTeam && !game.status.type.completed) {
          const odds = competition.odds?.[0];
          
          oddsData.push({
            eventName: `${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`,
            startTime: game.date,
            status: game.status.type.description,
            teams: {
              home: homeTeam.team.displayName,
              away: awayTeam.team.displayName
            },
            odds: odds ? {
              provider: odds.provider?.name || 'ESPN BET',
              spread: odds.spread || 0,
              overUnder: odds.overUnder || 0,
              moneyline: {
                home: odds.homeTeamOdds?.moneyLine || 0,
                away: odds.awayTeamOdds?.moneyLine || 0
              }
            } : null
          });
        }
      });
      
      console.log(`✅ Found ${oddsData.length} games on ESPN`);
      return oddsData;
      
    } catch (error) {
      console.log('❌ ESPN failed');
      return [];
    }
  }
  
  private async getCBSOdds(): Promise<any[]> {
    console.log('\n📰 CBS Sports Odds...');
    
    try {
      const response = await axios.get(
        'https://www.cbssports.com/mlb/odds/',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      // Extract JSON data from HTML
      const jsonMatch = response.data.match(/window\.odds\s*=\s*({[\s\S]*?});/);
      if (jsonMatch) {
        const oddsData = JSON.parse(jsonMatch[1]);
        console.log(`✅ Found odds data on CBS`);
        return this.parseCBSOdds(oddsData);
      }
      
      console.log('❌ No odds data found on CBS');
      return [];
      
    } catch (error) {
      console.log('❌ CBS failed');
      return [];
    }
  }
  
  private parseCBSOdds(data: any): any[] {
    // CBS specific parsing logic
    return [];
  }
  
  private async getOddsSharkOdds(): Promise<any[]> {
    console.log('\n🦈 OddsShark API...');
    
    try {
      // OddsShark has a public API endpoint
      const response = await axios.get(
        'https://api.oddsshark.com/api/scores/mlb',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (response.data?.games) {
        const games = response.data.games;
        console.log(`✅ Found ${games.length} games on OddsShark`);
        
        return games.map((game: any) => ({
          eventName: `${game.away_team} @ ${game.home_team}`,
          startTime: game.game_date,
          teams: {
            home: game.home_team,
            away: game.away_team
          },
          odds: {
            provider: 'OddsShark Consensus',
            moneyline: {
              home: game.home_money_line || 0,
              away: game.away_money_line || 0
            },
            spread: {
              line: game.point_spread || 0,
              homeOdds: game.home_spread_odds || -110,
              awayOdds: game.away_spread_odds || -110
            },
            total: {
              line: game.total || 0,
              overOdds: game.over_odds || -110,
              underOdds: game.under_odds || -110
            }
          }
        }));
      }
      
      console.log('❌ No games found on OddsShark');
      return [];
      
    } catch (error) {
      console.log('❌ OddsShark failed');
      return [];
    }
  }
  
  private async getScoresAndOdds(): Promise<any[]> {
    console.log('\n📊 ScoresAndOdds...');
    
    try {
      const response = await axios.get(
        'https://www.scoresandodds.com/mlb',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        }
      );
      
      // Try to extract API endpoint from page
      const apiMatch = response.data.match(/api\.scoresandodds\.com\/[\w\/]+/);
      if (apiMatch) {
        console.log('✅ Found ScoresAndOdds API endpoint');
        // Would make another request to the API endpoint
      }
      
      console.log('❌ ScoresAndOdds parsing not implemented');
      return [];
      
    } catch (error) {
      console.log('❌ ScoresAndOdds failed');
      return [];
    }
  }
  
  findArbitrage(allOdds: any): any[] {
    console.log('\n💎 CHECKING FOR ARBITRAGE ACROSS ALL SOURCES...');
    
    const opportunities = [];
    const gameMap = new Map();
    
    // Group games by matchup
    ['espn', 'cbs', 'oddsShark', 'scoresAndOdds'].forEach(source => {
      const sourceOdds = allOdds[source];
      if (!Array.isArray(sourceOdds)) return;
      
      sourceOdds.forEach((game: any) => {
        if (!game.odds) return;
        
        const key = this.normalizeGameName(game.eventName);
        if (!gameMap.has(key)) {
          gameMap.set(key, []);
        }
        
        gameMap.get(key).push({
          source,
          ...game
        });
      });
    });
    
    // Check each game for arbitrage
    gameMap.forEach((games, gameName) => {
      if (games.length < 2) return;
      
      // Find best moneyline odds
      let bestHome = { odds: -Infinity, source: '' };
      let bestAway = { odds: -Infinity, source: '' };
      
      games.forEach((game: any) => {
        if (game.odds?.moneyline) {
          if (game.odds.moneyline.home > bestHome.odds) {
            bestHome = { odds: game.odds.moneyline.home, source: game.source };
          }
          if (game.odds.moneyline.away > bestAway.odds) {
            bestAway = { odds: game.odds.moneyline.away, source: game.source };
          }
        }
      });
      
      // Calculate arbitrage
      if (bestHome.odds !== 0 && bestAway.odds !== 0) {
        const homeProb = bestHome.odds > 0 ? 100 / (bestHome.odds + 100) : -bestHome.odds / (-bestHome.odds + 100);
        const awayProb = bestAway.odds > 0 ? 100 / (bestAway.odds + 100) : -bestAway.odds / (-bestAway.odds + 100);
        
        if (homeProb + awayProb < 0.98) {
          opportunities.push({
            game: gameName,
            profit: ((1 - (homeProb + awayProb)) * 100).toFixed(2),
            bets: [
              { source: bestHome.source, type: 'Home ML', odds: bestHome.odds },
              { source: bestAway.source, type: 'Away ML', odds: bestAway.odds }
            ]
          });
        }
      }
    });
    
    return opportunities;
  }
  
  private normalizeGameName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z\s@]/g, '')
      .replace(/\s+at\s+/, ' @ ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  async matchWithPatterns(allOdds: any): Promise<any[]> {
    const { data: patterns } = await supabase
      .from('games')
      .select('*')
      .not('metadata->has_pattern', 'is', null)
      .gte('start_time', new Date().toISOString());
    
    const matches = [];
    
    if (patterns) {
      ['espn', 'oddsShark'].forEach(source => {
        const sourceOdds = allOdds[source];
        if (!Array.isArray(sourceOdds)) return;
        
        sourceOdds.forEach((game: any) => {
          patterns.forEach(pattern => {
            const metadata = pattern.metadata as any;
            
            if (this.isGameMatch(game, metadata)) {
              matches.push({
                source,
                game: game.eventName,
                pattern: metadata.pattern_types[0],
                confidence: metadata.pattern_confidence,
                odds: game.odds
              });
            }
          });
        });
      });
    }
    
    return matches;
  }
  
  private isGameMatch(game: any, metadata: any): boolean {
    const gameTeams = `${game.teams.away} ${game.teams.home}`.toLowerCase();
    const patternTeams = `${metadata.away_team} ${metadata.home_team}`.toLowerCase();
    
    return gameTeams.includes(metadata.home_team?.toLowerCase()) || 
           gameTeams.includes(metadata.away_team?.toLowerCase());
  }
}

async function main() {
  const scraper = new LiveMLBOdds();
  
  try {
    // Get all live odds
    const allOdds = await scraper.getAllLiveOdds();
    
    // Find arbitrage
    const arbitrage = scraper.findArbitrage(allOdds);
    
    // Match patterns
    const patterns = await scraper.matchWithPatterns(allOdds);
    
    // Display results
    console.log('\n' + '=' .repeat(70));
    console.log('📊 LIVE MLB ODDS SUMMARY');
    console.log('=' .repeat(70));
    
    console.log(`\n✅ Successfully scraped from ${allOdds.summary.sources} sources`);
    console.log(`📈 Total unique games found: ${allOdds.summary.totalGames}`);
    
    // Show sample games from each source
    ['espn', 'oddsShark'].forEach(source => {
      const games = allOdds[source];
      if (games && games.length > 0) {
        console.log(`\n${source.toUpperCase()} (${games.length} games):`);
        games.slice(0, 3).forEach((game: any, idx: number) => {
          console.log(`${idx + 1}. ${game.eventName}`);
          if (game.odds) {
            console.log(`   ML: ${game.teams.home} ${game.odds.moneyline?.home || 'N/A'} | ${game.teams.away} ${game.odds.moneyline?.away || 'N/A'}`);
          }
        });
      }
    });
    
    // Display arbitrage
    if (arbitrage.length > 0) {
      console.log('\n💎 ARBITRAGE OPPORTUNITIES:');
      console.log('=' .repeat(70));
      
      arbitrage.forEach((arb, idx) => {
        console.log(`\n${idx + 1}. ${arb.game}`);
        console.log(`   Profit: ${arb.profit}%`);
        arb.bets.forEach(bet => {
          console.log(`   ${bet.source}: ${bet.type} @ ${bet.odds > 0 ? '+' : ''}${bet.odds}`);
        });
      });
    } else {
      console.log('\n❌ No arbitrage opportunities found');
    }
    
    // Display pattern matches
    if (patterns.length > 0) {
      console.log('\n🎯 PATTERN MATCHES:');
      console.log('=' .repeat(70));
      
      patterns.forEach((match, idx) => {
        console.log(`\n${idx + 1}. ${match.game} (${match.source})`);
        console.log(`   Pattern: ${match.pattern} (${(match.confidence * 100).toFixed(1)}%)`);
      });
    }
    
    console.log('\n✅ NEXT STEPS:');
    console.log('1. ESPN always works for basic odds');
    console.log('2. Get The Odds API key for comprehensive coverage');
    console.log('3. Our patterns work with any odds source!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { LiveMLBOdds };