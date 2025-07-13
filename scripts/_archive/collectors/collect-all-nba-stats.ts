#!/usr/bin/env tsx
/**
 * 🔥 COLLECT ALL NBA STATS - MASS PROCESSING!
 * 
 * Process hundreds of NBA games to populate real stats
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';
import pLimit from 'p-limit';

const limit = pLimit(5); // Process 5 games concurrently

class NBAStatsCollector {
  private stats = {
    gamesProcessed: 0,
    playersUpdated: 0,
    errors: 0,
    startTime: Date.now()
  };

  async collectAllStats() {
    console.log(chalk.bold.red('🏀 NBA STATS MASS COLLECTOR'));
    console.log(chalk.yellow('Processing ALL recent NBA games...'));
    console.log(chalk.gray('='.repeat(60)));

    try {
      // Get NBA games that need stats
      const { data: games } = await enhancedDb.getClient()
        .from('games')
        .select('id, external_id, home_team_id, away_team_id, start_time')
        .eq('sport', 'NBA')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(200); // Get last 200 NBA games

      if (!games || games.length === 0) {
        console.log(chalk.red('No NBA games found'));
        return;
      }

      console.log(chalk.green(`Found ${games.length} NBA games to process`));

      // Check which games already have stats
      const gamesNeedingStats = [];
      
      for (const game of games) {
        const { data: existingStats } = await enhancedDb.getClient()
          .from('player_game_logs')
          .select('stats')
          .eq('game_id', game.id)
          .limit(1);

        const hasRealStats = existingStats?.some(log => {
          const stats = log.stats as any;
          return stats && stats.points > 0;
        });

        if (!hasRealStats) {
          gamesNeedingStats.push(game);
        }
      }

      console.log(chalk.yellow(`${gamesNeedingStats.length} games need stats`));

      // Process games with ESPN IDs
      const espnGames = gamesNeedingStats.filter(g => g.external_id?.includes('espn_'));
      console.log(chalk.cyan(`${espnGames.length} games have ESPN IDs`));

      // For games without ESPN IDs, try to find them
      const nonEspnGames = gamesNeedingStats.filter(g => !g.external_id?.includes('espn_'));
      if (nonEspnGames.length > 0) {
        console.log(chalk.yellow(`${nonEspnGames.length} games need ESPN IDs - will search for them`));
      }

      // Process all ESPN games concurrently (with limit)
      const promises = espnGames.map(game => 
        limit(() => this.processGame(game))
      );

      await Promise.all(promises);

      // Try to find ESPN IDs for other games
      if (nonEspnGames.length > 0) {
        await this.findAndProcessMissingGames(nonEspnGames);
      }

      this.showResults();

    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    }
  }

  private async processGame(game: any) {
    try {
      if (!game.external_id?.includes('espn_')) {
        return;
      }

      const espnGameId = game.external_id
        .replace('espn_', '')
        .replace(/^(nba|mlb|nfl|nhl)_/, '');

      console.log(chalk.gray(`Processing game ${game.id} (ESPN: ${espnGameId})...`));

      // Fetch boxscore
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`;
      const response = await axios.get(summaryUrl, { timeout: 10000 });
      
      const boxscore = response.data.boxscore;
      if (!boxscore?.players) {
        console.log(chalk.yellow(`No boxscore for game ${game.id}`));
        return;
      }

      let totalPlayers = 0;

      // Process each team
      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id);
        const athletes = team.statistics?.[0]?.athletes || [];

        for (const athlete of athletes) {
          if (!athlete.stats || athlete.stats.length < 14) continue;

          const playerId = parseInt(athlete.athlete.id);
          const stats = this.parseNBAStats(athlete.stats);
          
          // Calculate fantasy points
          stats.fantasy_points = (
            stats.points * 1 +
            stats.rebounds * 1.25 +
            stats.assists * 1.5 +
            stats.steals * 2 +
            stats.blocks * 2 -
            stats.turnovers * 0.5
          );

          // Ensure player exists
          await enhancedDb.getClient()
            .from('players')
            .upsert({
              id: playerId,
              name: athlete.athlete.displayName,
              team_id: teamId,
              sport: 'basketball'
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
              minutes_played: stats.minutes_played,
              is_home: teamId === game.home_team_id
            }, { onConflict: 'player_id,game_id' });

          if (!error) {
            totalPlayers++;
          }
        }
      }

      if (totalPlayers > 0) {
        console.log(chalk.green(`✅ Game ${game.id}: ${totalPlayers} players updated`));
        this.stats.gamesProcessed++;
        this.stats.playersUpdated += totalPlayers;
      }

    } catch (error: any) {
      console.error(chalk.red(`Error processing game ${game.id}:`), error.message);
      this.stats.errors++;
    }
  }

  private parseNBAStats(statsArray: any[]): any {
    const minutesStr = statsArray[0] || '0';
    const fgStr = statsArray[1] || '0-0';
    const threePtStr = statsArray[2] || '0-0';
    const ftStr = statsArray[3] || '0-0';
    
    return {
      minutes_played: parseInt(minutesStr) || 0,
      field_goals_made: parseInt(fgStr.split('-')[0]) || 0,
      field_goals_attempted: parseInt(fgStr.split('-')[1]) || 0,
      three_pointers_made: parseInt(threePtStr.split('-')[0]) || 0,
      three_pointers_attempted: parseInt(threePtStr.split('-')[1]) || 0,
      free_throws_made: parseInt(ftStr.split('-')[0]) || 0,
      free_throws_attempted: parseInt(ftStr.split('-')[1]) || 0,
      offensive_rebounds: parseInt(statsArray[4]) || 0,
      defensive_rebounds: parseInt(statsArray[5]) || 0,
      rebounds: parseInt(statsArray[6]) || 0,
      assists: parseInt(statsArray[7]) || 0,
      steals: parseInt(statsArray[8]) || 0,
      blocks: parseInt(statsArray[9]) || 0,
      turnovers: parseInt(statsArray[10]) || 0,
      personal_fouls: parseInt(statsArray[11]) || 0,
      plus_minus: parseInt(statsArray[12]) || 0,
      points: parseInt(statsArray[13]) || 0,
      fantasy_points: 0
    };
  }

  private async findAndProcessMissingGames(games: any[]) {
    console.log(chalk.cyan('\n🔍 Searching for ESPN IDs...'));

    // Get recent ESPN games from scoreboard
    try {
      const today = new Date();
      const promises = [];

      // Check last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        
        promises.push(
          limit(async () => {
            try {
              const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
              const response = await axios.get(url, { timeout: 5000 });
              return response.data.events || [];
            } catch (error) {
              return [];
            }
          })
        );
      }

      const allDaysEvents = await Promise.all(promises);
      const allEvents = allDaysEvents.flat();

      console.log(chalk.green(`Found ${allEvents.length} ESPN games from last 30 days`));

      // Match games by date and teams
      let matched = 0;
      for (const game of games) {
        const gameDate = new Date(game.start_time).toDateString();
        
        const espnGame = allEvents.find(event => {
          const eventDate = new Date(event.date).toDateString();
          if (eventDate !== gameDate) return false;
          
          // Check if teams match (simplified check)
          const competitors = event.competitions?.[0]?.competitors || [];
          return competitors.length === 2;
        });

        if (espnGame) {
          // Update game with ESPN ID
          await enhancedDb.getClient()
            .from('games')
            .update({ external_id: `espn_nba_${espnGame.id}` })
            .eq('id', game.id);
          
          game.external_id = `espn_nba_${espnGame.id}`;
          matched++;
          
          // Process the game
          await this.processGame(game);
        }
      }

      console.log(chalk.green(`✅ Matched ${matched} games with ESPN IDs`));

    } catch (error) {
      console.error(chalk.red('Error finding ESPN games:'), error);
    }
  }

  private showResults() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    
    console.log(chalk.bold.yellow('\n📊 NBA STATS COLLECTION COMPLETE!'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.white(`Games Processed: ${chalk.bold(this.stats.gamesProcessed)}`));
    console.log(chalk.white(`Players Updated: ${chalk.bold(this.stats.playersUpdated)}`));
    console.log(chalk.white(`Errors: ${chalk.red(this.stats.errors)}`));
    console.log(chalk.white(`Time: ${elapsed.toFixed(1)}s`));
    console.log(chalk.white(`Rate: ${(this.stats.playersUpdated / elapsed).toFixed(1)} players/second`));
    
    if (this.stats.gamesProcessed > 0) {
      console.log(chalk.bold.green('\n✅ REAL NBA STATS POPULATED!'));
    }
  }
}

// Run the collector
const collector = new NBAStatsCollector();
collector.collectAllStats().catch(console.error);