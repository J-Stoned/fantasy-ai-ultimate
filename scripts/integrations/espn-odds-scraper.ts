#!/usr/bin/env tsx
/**
 * 📺 ESPN ODDS SCRAPER
 * 
 * Uses ESPN's public API to get MLB odds
 * Never gets blocked! No authentication needed!
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ESPNGame {
  id: string;
  name: string;
  date: string;
  status: {
    type: {
      completed: boolean;
      description: string;
    };
  };
  competitions: Array<{
    competitors: Array<{
      id: string;
      team: {
        id: string;
        name: string;
        displayName: string;
        abbreviation: string;
      };
      homeAway: 'home' | 'away';
      score?: string;
    }>;
    odds?: Array<{
      provider: {
        id: string;
        name: string;
      };
      details: string;
      overUnder?: number;
      spread?: number;
      overOdds?: number;
      underOdds?: number;
      awayTeamOdds?: {
        moneyLine?: number;
        spreadOdds?: number;
      };
      homeTeamOdds?: {
        moneyLine?: number;
        spreadOdds?: number;
      };
    }>;
  }>;
}

class ESPNOddsScraper {
  private readonly BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';
  
  async getMLBOdds(includeOdds: boolean = true): Promise<ESPNGame[]> {
    console.log('📺 Fetching MLB data from ESPN...');
    
    try {
      const url = `${this.BASE_URL}/baseball/mlb/scoreboard`;
      const params: any = {
        dates: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        limit: 50
      };
      
      if (includeOdds) {
        params.include = 'odds';
      }
      
      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const games = response.data?.events || [];
      console.log(`✅ Found ${games.length} MLB games on ESPN`);
      
      return games;
      
    } catch (error) {
      console.error('❌ Error fetching ESPN data:', error);
      return [];
    }
  }
  
  async getDetailedOdds(gameId: string): Promise<any> {
    console.log(`📊 Fetching detailed odds for game ${gameId}...`);
    
    try {
      const response = await axios.get(
        `${this.BASE_URL}/baseball/mlb/summary`,
        {
          params: { event: gameId },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      return response.data?.odds || [];
      
    } catch (error) {
      console.error('❌ Error fetching game details:', error);
      return null;
    }
  }
  
  parseOddsData(games: ESPNGame[]): any[] {
    const oddsData = [];
    
    games.forEach(game => {
      const competition = game.competitions[0];
      if (!competition) return;
      
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) return;
      
      const gameOdds = {
        gameId: game.id,
        eventName: game.name,
        startTime: game.date,
        status: game.status.type.description,
        completed: game.status.type.completed,
        teams: {
          home: {
            id: homeTeam.team.id,
            name: homeTeam.team.displayName,
            abbreviation: homeTeam.team.abbreviation,
            score: homeTeam.score
          },
          away: {
            id: awayTeam.team.id,
            name: awayTeam.team.displayName,
            abbreviation: awayTeam.team.abbreviation,
            score: awayTeam.score
          }
        },
        odds: [] as any[]
      };
      
      // Parse odds from each provider
      if (competition.odds && competition.odds.length > 0) {
        competition.odds.forEach(odd => {
          const bookOdds = {
            provider: odd.provider.name,
            spread: {
              line: odd.spread || 0,
              homeOdds: odd.homeTeamOdds?.spreadOdds || -110,
              awayOdds: odd.awayTeamOdds?.spreadOdds || -110
            },
            moneyline: {
              home: odd.homeTeamOdds?.moneyLine || -110,
              away: odd.awayTeamOdds?.moneyLine || -110
            },
            total: {
              line: odd.overUnder || 0,
              over: odd.overOdds || -110,
              under: odd.underOdds || -110
            }
          };
          
          gameOdds.odds.push(bookOdds);
        });
      }
      
      if (gameOdds.odds.length > 0 || !game.status.type.completed) {
        oddsData.push(gameOdds);
      }
    });
    
    return oddsData;
  }
  
  findArbitrageOpportunities(oddsData: any[]): any[] {
    const opportunities = [];
    
    oddsData.forEach(game => {
      if (game.odds.length < 2) return; // Need at least 2 books
      
      // Check moneyline arbitrage
      let bestHomeML = -Infinity;
      let bestHomeBook = '';
      let bestAwayML = -Infinity;
      let bestAwayBook = '';
      
      game.odds.forEach((bookOdds: any) => {
        if (bookOdds.moneyline.home > bestHomeML) {
          bestHomeML = bookOdds.moneyline.home;
          bestHomeBook = bookOdds.provider;
        }
        if (bookOdds.moneyline.away > bestAwayML) {
          bestAwayML = bookOdds.moneyline.away;
          bestAwayBook = bookOdds.provider;
        }
      });
      
      // Calculate implied probabilities
      const homeProb = bestHomeML > 0 ? 100 / (bestHomeML + 100) : -bestHomeML / (-bestHomeML + 100);
      const awayProb = bestAwayML > 0 ? 100 / (bestAwayML + 100) : -bestAwayML / (-bestAwayML + 100);
      
      if (homeProb + awayProb < 0.98) { // 2% profit threshold
        const profit = (1 - (homeProb + awayProb)) * 100;
        
        opportunities.push({
          game: game.eventName,
          type: 'Moneyline',
          profit: profit.toFixed(2),
          bets: [
            {
              book: bestHomeBook,
              team: game.teams.home.name,
              odds: bestHomeML,
              stake: (awayProb * 1000).toFixed(2)
            },
            {
              book: bestAwayBook,
              team: game.teams.away.name,
              odds: bestAwayML,
              stake: (homeProb * 1000).toFixed(2)
            }
          ]
        });
      }
      
      // Check totals arbitrage
      let bestOver = -Infinity;
      let bestOverBook = '';
      let bestUnder = -Infinity;
      let bestUnderBook = '';
      let totalLine = 0;
      
      game.odds.forEach((bookOdds: any) => {
        if (bookOdds.total.over > bestOver) {
          bestOver = bookOdds.total.over;
          bestOverBook = bookOdds.provider;
          totalLine = bookOdds.total.line;
        }
        if (bookOdds.total.under > bestUnder) {
          bestUnder = bookOdds.total.under;
          bestUnderBook = bookOdds.provider;
        }
      });
      
      const overProb = bestOver > 0 ? 100 / (bestOver + 100) : -bestOver / (-bestOver + 100);
      const underProb = bestUnder > 0 ? 100 / (bestUnder + 100) : -bestUnder / (-bestUnder + 100);
      
      if (overProb + underProb < 0.98 && totalLine > 0) {
        const profit = (1 - (overProb + underProb)) * 100;
        
        opportunities.push({
          game: game.eventName,
          type: `Total ${totalLine}`,
          profit: profit.toFixed(2),
          bets: [
            {
              book: bestOverBook,
              selection: `Over ${totalLine}`,
              odds: bestOver,
              stake: (underProb * 1000).toFixed(2)
            },
            {
              book: bestUnderBook,
              selection: `Under ${totalLine}`,
              odds: bestUnder,
              stake: (overProb * 1000).toFixed(2)
            }
          ]
        });
      }
    });
    
    return opportunities;
  }
  
  async matchWithPatterns(oddsData: any[]): Promise<any[]> {
    console.log('\n🎯 Matching with our betting patterns...');
    
    // Get today's patterns from database
    const { data: patterns } = await supabase
      .from('games')
      .select('*')
      .not('metadata->has_pattern', 'is', null)
      .gte('start_time', new Date().toISOString());
    
    const matches = [];
    
    if (patterns) {
      oddsData.forEach(game => {
        patterns.forEach(pattern => {
          const metadata = pattern.metadata as any;
          
          // Match by team names
          const homeMatch = game.teams.home.name.toLowerCase().includes(metadata.home_team?.toLowerCase()) ||
                           metadata.home_team?.toLowerCase().includes(game.teams.home.name.toLowerCase());
          const awayMatch = game.teams.away.name.toLowerCase().includes(metadata.away_team?.toLowerCase()) ||
                           metadata.away_team?.toLowerCase().includes(game.teams.away.name.toLowerCase());
          
          if ((homeMatch || awayMatch) && metadata.has_pattern) {
            // Get best odds for this game
            let bestML = { home: -Infinity, away: -Infinity, book: '' };
            
            game.odds.forEach((bookOdds: any) => {
              if (bookOdds.moneyline.home > bestML.home) {
                bestML.home = bookOdds.moneyline.home;
                bestML.book = bookOdds.provider;
              }
              if (bookOdds.moneyline.away > bestML.away) {
                bestML.away = bookOdds.moneyline.away;
              }
            });
            
            // Calculate expected value
            const confidence = metadata.pattern_confidence || 0.65;
            const odds = metadata.pattern_types?.[0] === 'back_to_back_fade' ? bestML.away : bestML.home;
            const decimal = odds > 0 ? (odds / 100) + 1 : (-100 / odds) + 1;
            const ev = (confidence * (decimal - 1)) - (1 - confidence);
            
            matches.push({
              pattern: metadata.pattern_types[0],
              confidence: confidence,
              game: game.eventName,
              recommendation: this.getPatternRecommendation(metadata.pattern_types[0], game, bestML),
              expectedValue: (ev * 100).toFixed(2),
              bestBook: bestML.book
            });
          }
        });
      });
    }
    
    return matches.sort((a, b) => parseFloat(b.expectedValue) - parseFloat(a.expectedValue));
  }
  
  private getPatternRecommendation(pattern: string, game: any, bestOdds: any): string {
    switch (pattern) {
      case 'back_to_back_fade':
        return `Bet ${game.teams.away.name} ML @ ${bestOdds.away > 0 ? '+' : ''}${bestOdds.away}`;
      case 'altitude_advantage':
        return `Bet Over ${game.odds[0]?.total.line || 'N/A'}`;
      case 'embarrassment_revenge':
        return `Bet ${game.teams.home.name} ML @ ${bestOdds.home > 0 ? '+' : ''}${bestOdds.home}`;
      default:
        return 'Check game details';
    }
  }
}

async function main() {
  console.log('📺 ESPN MLB ODDS SCRAPER');
  console.log('=' .repeat(70));
  console.log('✅ No authentication required!');
  console.log('✅ Never gets blocked!');
  console.log('✅ Real-time odds from multiple sportsbooks!\n');
  
  const scraper = new ESPNOddsScraper();
  
  try {
    // Get games with odds
    const games = await scraper.getMLBOdds(true);
    
    if (games.length === 0) {
      console.log('No games found. Try again later.');
      return;
    }
    
    // Parse odds data
    const oddsData = scraper.parseOddsData(games);
    
    console.log(`\n📊 GAMES WITH ODDS: ${oddsData.length}`);
    console.log('=' .repeat(70));
    
    // Display games and best odds
    oddsData.slice(0, 10).forEach((game, idx) => {
      console.log(`\n${idx + 1}. ${game.eventName}`);
      console.log(`   Status: ${game.status} | Start: ${new Date(game.startTime).toLocaleString()}`);
      
      if (game.odds.length > 0) {
        console.log(`   Sportsbooks: ${game.odds.map((o: any) => o.provider).join(', ')}`);
        
        // Find best moneyline odds
        let bestML = { home: -Infinity, away: -Infinity, homeBook: '', awayBook: '' };
        
        game.odds.forEach((bookOdds: any) => {
          if (bookOdds.moneyline.home > bestML.home) {
            bestML.home = bookOdds.moneyline.home;
            bestML.homeBook = bookOdds.provider;
          }
          if (bookOdds.moneyline.away > bestML.away) {
            bestML.away = bookOdds.moneyline.away;
            bestML.awayBook = bookOdds.provider;
          }
        });
        
        console.log(`   Best ML: ${game.teams.home.name} ${bestML.home > 0 ? '+' : ''}${bestML.home} (${bestML.homeBook})`);
        console.log(`           ${game.teams.away.name} ${bestML.away > 0 ? '+' : ''}${bestML.away} (${bestML.awayBook})`);
      } else {
        console.log('   No odds available yet');
      }
    });
    
    // Find arbitrage
    const arbitrage = scraper.findArbitrageOpportunities(oddsData);
    
    if (arbitrage.length > 0) {
      console.log('\n💎 ARBITRAGE OPPORTUNITIES:');
      console.log('=' .repeat(70));
      
      arbitrage.forEach((arb, idx) => {
        console.log(`\n${idx + 1}. ${arb.game} - ${arb.type}`);
        console.log(`   Profit: ${arb.profit}%`);
        arb.bets.forEach((bet: any) => {
          const desc = bet.team || bet.selection;
          console.log(`   ${bet.book}: ${desc} @ ${bet.odds > 0 ? '+' : ''}${bet.odds} (Bet $${bet.stake})`);
        });
      });
    } else {
      console.log('\n❌ No arbitrage opportunities found');
    }
    
    // Match with patterns
    const patternMatches = await scraper.matchWithPatterns(oddsData);
    
    if (patternMatches.length > 0) {
      console.log('\n🎯 PATTERN BETTING OPPORTUNITIES:');
      console.log('=' .repeat(70));
      
      patternMatches.slice(0, 5).forEach((match, idx) => {
        console.log(`\n${idx + 1}. ${match.game}`);
        console.log(`   Pattern: ${match.pattern} (${(match.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`   Expected Value: +${match.expectedValue}%`);
        console.log(`   Recommendation: ${match.recommendation}`);
        console.log(`   Best Book: ${match.bestBook}`);
      });
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('=' .repeat(70));
    console.log(`Total Games: ${games.length}`);
    console.log(`Games with Odds: ${oddsData.length}`);
    console.log(`Arbitrage Opportunities: ${arbitrage.length}`);
    console.log(`Pattern Matches: ${patternMatches.length}`);
    
    // Save to database
    if (oddsData.length > 0) {
      console.log('\n💾 Saving odds to database...');
      
      const records = [];
      oddsData.forEach(game => {
        game.odds.forEach((bookOdds: any) => {
          records.push({
            event_id: `${game.gameId}_${bookOdds.provider}`,
            event_name: game.eventName,
            sport: 'MLB',
            sportsbook: bookOdds.provider.toLowerCase(),
            market_type: 'all',
            home_line: bookOdds.spread.line,
            away_line: -bookOdds.spread.line,
            home_odds: bookOdds.spread.homeOdds,
            away_odds: bookOdds.spread.awayOdds,
            over_line: bookOdds.total.line,
            under_line: bookOdds.total.line,
            over_odds: bookOdds.total.over,
            under_odds: bookOdds.total.under,
            fetched_at: new Date(),
            expires_at: new Date(Date.now() + 5 * 60000) // 5 minutes
          });
        });
      });
      
      const { error } = await supabase
        .from('live_odds_cache')
        .upsert(records, { onConflict: 'event_id' });
      
      if (!error) {
        console.log(`✅ Saved ${records.length} odds records to database`);
      } else {
        console.log('❌ Error saving to database:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { ESPNOddsScraper };