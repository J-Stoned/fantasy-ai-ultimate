#!/usr/bin/env tsx
/**
 * 🎰 SCRAPE BETTING ODDS
 * Fetches live odds from sportsbooks
 */

import chalk from 'chalk';
import { OddsScraper } from '../lib/scrapers/odds-scraper';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function scrapeOdds() {
  console.log(chalk.bold.cyan('🎰 SPORTS BETTING ODDS SCRAPER\n'));
  
  const scraper = new OddsScraper();
  
  try {
    // Fetch NBA odds
    console.log(chalk.yellow('Fetching NBA odds...'));
    const nbaOdds = await scraper.fetchOdds('basketball_nba');
    
    // Display sample odds
    console.log(chalk.bold.green(`\n✅ Found ${nbaOdds.length} NBA games with odds\n`));
    
    // Show first 5 games
    for (let i = 0; i < Math.min(5, nbaOdds.length); i++) {
      const game = nbaOdds[i];
      console.log(chalk.bold(`${game.homeTeam} vs ${game.awayTeam}`));
      console.log(chalk.gray(`Start: ${game.commenceTime.toLocaleString()}`));
      console.log(chalk.cyan(`Bookmakers: ${game.bookmakers.length}`));
      
      // Best odds
      console.log(chalk.yellow('Best Odds:'));
      console.log(`  ${game.homeTeam}: ${game.bestOdds.homeWin.odds} (${game.bestOdds.homeWin.bookmaker})`);
      console.log(`  ${game.awayTeam}: ${game.bestOdds.awayWin.odds} (${game.bestOdds.awayWin.bookmaker})`);
      
      // Implied probabilities
      console.log(chalk.green('Market Consensus:'));
      console.log(`  ${game.homeTeam}: ${(game.impliedProbabilities.home * 100).toFixed(1)}%`);
      console.log(`  ${game.awayTeam}: ${(game.impliedProbabilities.away * 100).toFixed(1)}%`);
      
      // Arbitrage check
      if (game.arbitrageOpportunity?.exists) {
        console.log(chalk.bold.red(`💰 ARBITRAGE OPPORTUNITY: ${game.arbitrageOpportunity.profit!.toFixed(2)}% profit!`));
      }
      
      console.log('');
    }
    
    // Find all arbitrage opportunities
    await scraper.findArbitrageOpportunities();
    
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log(chalk.yellow('\n⚠️  Using demo mode - limited data available'));
      console.log(chalk.gray('To get real odds data:'));
      console.log(chalk.gray('1. Sign up at https://the-odds-api.com'));
      console.log(chalk.gray('2. Add ODDS_API_KEY to your .env.local file'));
      
      // Show demo data
      console.log(chalk.bold.cyan('\n📊 Demo Odds Data:\n'));
      
      const demoGames = [
        {
          home: 'Lakers',
          away: 'Celtics', 
          homeOdds: -110,
          awayOdds: -110,
          bookmaker: 'DraftKings'
        },
        {
          home: 'Warriors',
          away: 'Nets',
          homeOdds: -150,
          awayOdds: +130,
          bookmaker: 'FanDuel'
        },
        {
          home: 'Heat',
          away: 'Knicks',
          homeOdds: +105,
          awayOdds: -125,
          bookmaker: 'BetMGM'
        }
      ];
      
      demoGames.forEach(game => {
        console.log(chalk.bold(`${game.home} vs ${game.away}`));
        console.log(`  ${game.home}: ${game.homeOdds} (${game.bookmaker})`);
        console.log(`  ${game.away}: ${game.awayOdds} (${game.bookmaker})`);
        
        // Calculate implied probabilities
        const homeProb = game.homeOdds > 0 ? 100 / (game.homeOdds + 100) : Math.abs(game.homeOdds) / (Math.abs(game.homeOdds) + 100);
        const awayProb = game.awayOdds > 0 ? 100 / (game.awayOdds + 100) : Math.abs(game.awayOdds) / (Math.abs(game.awayOdds) + 100);
        
        console.log(chalk.green(`  Implied: ${game.home} ${(homeProb * 100).toFixed(1)}%, ${game.away} ${(awayProb * 100).toFixed(1)}%`));
        console.log('');
      });
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
  }
}

scrapeOdds().catch(console.error);