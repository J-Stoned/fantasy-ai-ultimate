#!/usr/bin/env tsx
/**
 * 🏈 COLLECT NFL STATS
 * 
 * Process NFL games to populate real stats
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';
import pLimit from 'p-limit';

const limit = pLimit(3);

class NFLStatsCollector {
  private stats = {
    gamesProcessed: 0,
    playersUpdated: 0,
    errors: 0,
    startTime: Date.now()
  };

  async collectAllStats() {
    console.log(chalk.bold.red('🏈 NFL STATS COLLECTOR'));
    console.log(chalk.yellow('Processing NFL games...'));
    console.log(chalk.gray('='.repeat(60)));

    try {
      // Get NFL games
      const { data: games } = await enhancedDb.getClient()
        .from('games')
        .select('id, external_id, home_team_id, away_team_id, start_time')
        .eq('sport', 'NFL')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(50);

      if (!games || games.length === 0) {
        console.log(chalk.red('No completed NFL games found'));
        return;
      }

      console.log(chalk.green(`Found ${games.length} NFL games`));

      // Check which games need stats
      const gamesNeedingStats = [];
      
      for (const game of games) {
        const { data: existingStats } = await enhancedDb.getClient()
          .from('player_game_logs')
          .select('stats')
          .eq('game_id', game.id)
          .limit(1);

        const hasRealStats = existingStats?.some(log => {
          const stats = log.stats as any;
          return stats && (stats.passing_yards > 0 || stats.rushing_yards > 0 || stats.receiving_yards > 0);
        });

        if (!hasRealStats) {
          gamesNeedingStats.push(game);
        }
      }

      console.log(chalk.yellow(`${gamesNeedingStats.length} games need stats`));

      // Filter for games with ESPN IDs
      const espnGames = gamesNeedingStats.filter(g => g.external_id?.includes('espn_'));
      console.log(chalk.cyan(`${espnGames.length} games have ESPN IDs`));

      if (espnGames.length === 0) {
        console.log(chalk.yellow('No NFL games with ESPN IDs found'));
        console.log(chalk.yellow('Searching for ESPN game IDs...'));
        await this.findNFLESPNIds();
        return;
      }

      // Process games
      const promises = espnGames.map(game => 
        limit(() => this.processGame(game))
      );

      await Promise.all(promises);
      this.showResults();

    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    }
  }

  private async processGame(game: any) {
    try {
      const espnGameId = game.external_id
        .replace('espn_', '')
        .replace(/^(nfl|nba|mlb|nhl)_/, '');

      console.log(chalk.gray(`Processing NFL game ${game.id} (ESPN: ${espnGameId})...`));

      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      const response = await axios.get(summaryUrl, { timeout: 10000 });
      
      const boxscore = response.data.boxscore;
      if (!boxscore?.players) {
        console.log(chalk.yellow(`No boxscore for game ${game.id}`));
        return;
      }

      let totalPlayers = 0;

      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id);
        
        // Process each stat category
        const categories = [
          { name: 'passing', parser: this.parsePassingStats },
          { name: 'rushing', parser: this.parseRushingStats },
          { name: 'receiving', parser: this.parseReceivingStats }
        ];

        for (const category of categories) {
          const athletes = team.statistics?.find(s => s.name === category.name)?.athletes || [];
          
          for (const athlete of athletes) {
            if (!athlete.stats || athlete.stats.length < 1) continue;

            const playerId = parseInt(athlete.athlete.id);
            const stats = category.parser.call(this, athlete.stats);
            
            // Calculate DFS points (DraftKings scoring)
            stats.fantasy_points = this.calculateNFLFantasyPoints(stats);

            // Ensure player exists
            await enhancedDb.getClient()
              .from('players')
              .upsert({
                id: playerId,
                name: athlete.athlete.displayName,
                team_id: teamId,
                sport: 'football'
              }, { onConflict: 'id' });

            // Save stats
            const { error } = await enhancedDb.getClient()
              .from('player_game_logs')
              .upsert({
                player_id: playerId,
                game_id: game.id,
                team_id: teamId,
                game_date: game.start_time,
                stats: stats,
                fantasy_points: stats.fantasy_points,
                is_home: teamId === game.home_team_id
              }, { onConflict: 'player_id,game_id' });

            if (!error) totalPlayers++;
          }
        }
      }

      if (totalPlayers > 0) {
        console.log(chalk.green(`✅ NFL game ${game.id}: ${totalPlayers} players`));
        this.stats.gamesProcessed++;
        this.stats.playersUpdated += totalPlayers;
      }

    } catch (error: any) {
      console.error(chalk.red(`NFL game ${game.id} error:`), error.message);
      this.stats.errors++;
    }
  }

  private parsePassingStats(statsArray: any[]): any {
    // ESPN passing stats format
    const compAtt = statsArray[0]?.split('/') || ['0', '0'];
    const yards = parseInt(statsArray[1]) || 0;
    const avg = parseFloat(statsArray[2]) || 0;
    const td = parseInt(statsArray[3]) || 0;
    const int = parseInt(statsArray[4]) || 0;

    return {
      passing_attempts: parseInt(compAtt[1]) || 0,
      passing_completions: parseInt(compAtt[0]) || 0,
      passing_yards: yards,
      passing_touchdowns: td,
      interceptions: int,
      passing_avg: avg,
      rushing_yards: 0,
      rushing_attempts: 0,
      rushing_touchdowns: 0,
      receiving_yards: 0,
      receptions: 0,
      receiving_touchdowns: 0,
      fantasy_points: 0
    };
  }

  private parseRushingStats(statsArray: any[]): any {
    const carries = parseInt(statsArray[0]) || 0;
    const yards = parseInt(statsArray[1]) || 0;
    const avg = parseFloat(statsArray[2]) || 0;
    const td = parseInt(statsArray[3]) || 0;
    const long = parseInt(statsArray[4]) || 0;

    return {
      rushing_attempts: carries,
      rushing_yards: yards,
      rushing_touchdowns: td,
      rushing_avg: avg,
      rushing_long: long,
      passing_yards: 0,
      passing_attempts: 0,
      passing_completions: 0,
      passing_touchdowns: 0,
      interceptions: 0,
      receiving_yards: 0,
      receptions: 0,
      receiving_touchdowns: 0,
      fantasy_points: 0
    };
  }

  private parseReceivingStats(statsArray: any[]): any {
    const rec = parseInt(statsArray[0]) || 0;
    const yards = parseInt(statsArray[1]) || 0;
    const avg = parseFloat(statsArray[2]) || 0;
    const td = parseInt(statsArray[3]) || 0;
    const long = parseInt(statsArray[4]) || 0;
    const targets = parseInt(statsArray[5]) || rec;

    return {
      receptions: rec,
      receiving_yards: yards,
      receiving_touchdowns: td,
      receiving_avg: avg,
      receiving_long: long,
      targets: targets,
      passing_yards: 0,
      passing_attempts: 0,
      passing_completions: 0,
      passing_touchdowns: 0,
      interceptions: 0,
      rushing_yards: 0,
      rushing_attempts: 0,
      rushing_touchdowns: 0,
      fantasy_points: 0
    };
  }

  private calculateNFLFantasyPoints(stats: any): number {
    // DraftKings scoring
    return (
      stats.passing_yards * 0.04 +
      stats.passing_touchdowns * 4 +
      stats.interceptions * -1 +
      stats.rushing_yards * 0.1 +
      stats.rushing_touchdowns * 6 +
      stats.receiving_yards * 0.1 +
      stats.receptions * 1 +
      stats.receiving_touchdowns * 6 +
      (stats.passing_yards >= 300 ? 3 : 0) +
      (stats.rushing_yards >= 100 ? 3 : 0) +
      (stats.receiving_yards >= 100 ? 3 : 0)
    );
  }

  private async findNFLESPNIds() {
    console.log(chalk.cyan('\n🔍 Searching for NFL ESPN IDs...'));

    try {
      // Get recent NFL games from ESPN
      const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
      const response = await axios.get(url);
      const events = response.data.events || [];

      console.log(chalk.green(`Found ${events.length} recent NFL games on ESPN`));

      // Also check past weeks
      for (let week = 1; week <= 18; week++) {
        try {
          const weekUrl = `${url}?week=${week}`;
          const weekResponse = await axios.get(weekUrl, { timeout: 5000 });
          const weekEvents = weekResponse.data.events || [];
          
          if (weekEvents.length > 0) {
            console.log(chalk.gray(`  Week ${week}: ${weekEvents.length} games`));
          }
        } catch (error) {
          // Skip week errors
        }
      }

      console.log(chalk.yellow('\nPlease manually add ESPN IDs to NFL games in the database'));
      console.log(chalk.yellow('Format: espn_nfl_[GAME_ID]'));

    } catch (error) {
      console.error(chalk.red('Error searching for NFL games:'), error);
    }
  }

  private showResults() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    
    console.log(chalk.bold.yellow('\n📊 NFL STATS COLLECTION COMPLETE!'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.white(`Games Processed: ${chalk.bold(this.stats.gamesProcessed)}`));
    console.log(chalk.white(`Players Updated: ${chalk.bold(this.stats.playersUpdated)}`));
    console.log(chalk.white(`Errors: ${chalk.red(this.stats.errors)}`));
    console.log(chalk.white(`Time: ${elapsed.toFixed(1)}s`));
    console.log(chalk.white(`Rate: ${(this.stats.playersUpdated / elapsed).toFixed(1)} players/second`));
    
    if (this.stats.gamesProcessed > 0) {
      console.log(chalk.bold.green('\n✅ REAL NFL STATS POPULATED!'));
    }
  }
}

// Run the collector
const collector = new NFLStatsCollector();
collector.collectAllStats().catch(console.error);