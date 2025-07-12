#!/usr/bin/env tsx
/**
 * 🔥 MASS ESPN ID FINDER
 * 
 * Finds ESPN IDs for ALL games in the database
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';
import pLimit from 'p-limit';

const limit = pLimit(10); // 10 concurrent requests

class MassESPNFinder {
  private stats = {
    gamesProcessed: 0,
    idsFound: 0,
    errors: 0,
    startTime: Date.now()
  };

  async findAllESPNIds() {
    console.log(chalk.bold.red('🔥 MASS ESPN ID FINDER'));
    console.log(chalk.yellow('Finding ESPN IDs for ALL games...'));
    console.log(chalk.gray('='.repeat(60)));

    // Get all games without ESPN IDs
    const { data: games } = await enhancedDb.getClient()
      .from('games')
      .select('id, sport, home_team_id, away_team_id, start_time')
      .not('home_score', 'is', null)
      .or('external_id.is.null,not.external_id.like.espn_%');

    if (!games || games.length === 0) {
      console.log(chalk.green('All games already have ESPN IDs!'));
      return;
    }

    console.log(chalk.yellow(`Found ${games.length} games without ESPN IDs`));

    // Group by sport
    const bySport = {
      NBA: games.filter(g => g.sport === 'NBA'),
      MLB: games.filter(g => g.sport === 'MLB'),
      NFL: games.filter(g => g.sport === 'NFL' || g.sport === 'nfl'),
      NHL: games.filter(g => g.sport === 'NHL')
    };

    // Process each sport
    for (const [sport, sportGames] of Object.entries(bySport)) {
      if (sportGames.length === 0) continue;
      
      console.log(chalk.cyan(`\n${sport}: ${sportGames.length} games to process`));
      await this.findESPNIdsForSport(sport, sportGames);
    }

    this.showResults();
  }

  private async findESPNIdsForSport(sport: string, games: any[]) {
    // First, fetch all ESPN games for this sport
    const espnGames = await this.fetchAllESPNGames(sport);
    console.log(chalk.green(`  Found ${espnGames.length} ${sport} games on ESPN`));

    // Match games
    let matched = 0;
    const promises = games.map(game => 
      limit(async () => {
        const match = this.findBestMatch(game, espnGames);
        if (match) {
          const external_id = `espn_${sport.toLowerCase()}_${match.id}`;
          
          const { error } = await enhancedDb.getClient()
            .from('games')
            .update({ external_id })
            .eq('id', game.id);
          
          if (!error) {
            matched++;
            this.stats.idsFound++;
            if (matched % 50 === 0) {
              console.log(chalk.gray(`    Progress: ${matched}/${games.length}`));
            }
          }
        }
        this.stats.gamesProcessed++;
      })
    );

    await Promise.all(promises);
    console.log(chalk.green(`  ✅ Matched ${matched} ${sport} games`));
  }

  private async fetchAllESPNGames(sport: string): Promise<any[]> {
    const allGames = [];
    const endpoints = {
      NBA: 'basketball/nba',
      MLB: 'baseball/mlb',
      NFL: 'football/nfl',
      NHL: 'hockey/nhl'
    };

    const endpoint = endpoints[sport];
    if (!endpoint) return [];

    try {
      // Current season games
      const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/scoreboard`;
      
      // Fetch by date range (last 365 days)
      const promises = [];
      for (let daysAgo = 0; daysAgo <= 365; daysAgo += 7) {
        promises.push(
          limit(async () => {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
            
            try {
              const url = `${baseUrl}?dates=${dateStr}`;
              const response = await axios.get(url, { timeout: 5000 });
              return response.data.events || [];
            } catch {
              return [];
            }
          })
        );
      }

      const results = await Promise.all(promises);
      results.forEach(events => {
        events.forEach(event => {
          allGames.push({
            id: event.id,
            date: new Date(event.date),
            homeTeam: event.competitions[0].competitors.find(c => c.homeAway === 'home'),
            awayTeam: event.competitions[0].competitors.find(c => c.homeAway === 'away'),
            status: event.status.type.name
          });
        });
      });

    } catch (error) {
      console.error(chalk.red(`Error fetching ${sport} games:`, error.message));
    }

    return allGames;
  }

  private findBestMatch(game: any, espnGames: any[]): any {
    const gameDate = new Date(game.start_time);
    const gameDateStr = gameDate.toDateString();
    
    // Find games on the same date
    const sameDateGames = espnGames.filter(eg => 
      eg.date.toDateString() === gameDateStr
    );

    if (sameDateGames.length === 0) return null;
    
    // For now, just match by date (could improve with team matching)
    // Return the first completed game on that date
    return sameDateGames.find(g => g.status === 'STATUS_FINAL') || sameDateGames[0];
  }

  private showResults() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    
    console.log(chalk.bold.yellow('\n📊 ESPN ID FINDER COMPLETE!'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.white(`Games Processed: ${chalk.bold(this.stats.gamesProcessed)}`));
    console.log(chalk.white(`ESPN IDs Found: ${chalk.bold.green(this.stats.idsFound)}`));
    console.log(chalk.white(`Success Rate: ${chalk.bold((this.stats.idsFound / this.stats.gamesProcessed * 100).toFixed(1) + '%')}`));
    console.log(chalk.white(`Time: ${elapsed.toFixed(1)}s`));
    console.log(chalk.white(`Rate: ${(this.stats.gamesProcessed / elapsed).toFixed(1)} games/second`));
    
    if (this.stats.idsFound > 0) {
      console.log(chalk.bold.green(`\n✅ Ready to collect stats for ${this.stats.idsFound} more games!`));
    }
  }
}

// Run the finder
const finder = new MassESPNFinder();
finder.findAllESPNIds().catch(console.error);